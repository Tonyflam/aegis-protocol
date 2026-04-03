# Aegis Scanner — Integration Guide

> **Network**: BNB Chain (BSC)  
> **Interface**: `IAegisScanner`  
> **Contract**: [contracts/interfaces/IAegisScanner.sol](../contracts/interfaces/IAegisScanner.sol)

## Overview

Aegis Scanner is an on-chain security oracle that stores AI-generated risk assessments for any BEP-20 token on BSC. Any smart contract can query token safety **before** executing swaps, approvals, or deposits — one `view` call, zero gas for the caller.

```
Your Contract  ──view call──▶  IAegisScanner.isTokenSafe(token)
                                     │
                                     ▼
                              AegisScanner (deployed)
                              ┌──────────────────────┐
                              │ tokenScans[token]     │
                              │  · riskScore  0-100   │
                              │  · lastUpdated        │
                              │  · 5 boolean flags    │
                              │  · reasoningHash      │
                              └──────────────────────┘
```

---

## Quick Start — 5 Lines of Solidity

```solidity
import { IAegisScanner } from "@aegis-protocol/contracts/interfaces/IAegisScanner.sol";

contract MyDex {
    IAegisScanner public immutable aegis;

    constructor(address scanner) {
        aegis = IAegisScanner(scanner);
    }

    modifier onlySafe(address token) {
        require(aegis.isTokenSafe(token), "Aegis: unsafe token");
        _;
    }

    function swap(address tokenOut, uint256 amount) external onlySafe(tokenOut) {
        // Normal swap logic — only executes if Aegis says safe
    }
}
```

---

## Interface Reference

### Structs

```solidity
struct TokenRiskData {
    uint8   riskScore;      // 0 = safe, 100 = scam
    uint48  lastUpdated;    // Unix timestamp of most recent scan
    address attestedBy;     // Agent wallet that submitted the scan
    bytes32 reasoningHash;  // keccak256 of full AI analysis (verifiable on IPFS)
}

struct TokenFlags {
    bool isHoneypot;              // Cannot sell after buying
    bool hasHighTax;              // Buy or sell tax > 10%
    bool isUnverified;            // Source code not verified on BSCScan
    bool hasConcentratedOwnership; // Top holder > 50% of supply
    bool hasLowLiquidity;         // Under $10K liquidity
}
```

### Core Functions

| Function | Returns | Gas | Description |
|---|---|---|---|
| `isTokenSafe(address)` | `bool` | ~2.6K | Single-call safety check. Returns `false` if unscanned, score ≥ 70, honeypot, or stale (>24h). |
| `getTokenRisk(address)` | `TokenRiskData` | ~2.8K | Full risk data: score, timestamp, attester, reasoning hash. |
| `getTokenFlags(address)` | `TokenFlags` | ~3.0K | Structured boolean flags (honeypot, high tax, unverified, whale, low liq). |
| `isScanned(address)` | `bool` | ~2.4K | Whether the token has been scanned at least once. |
| `stalenessThreshold()` | `uint256` | ~2.3K | Current freshness window in seconds (default: 86400 = 24h). |

### Batch Functions

| Function | Returns | Gas | Description |
|---|---|---|---|
| `isTokenSafeBatch(address[])` | `bool[]` | ~2.6K per token | Check safety for up to 100 tokens in one call. |
| `getTokenRiskBatch(address[])` | `TokenRiskData[]` | ~2.8K per token | Full risk data for up to 100 tokens. |

### Events

```solidity
event TokenRiskUpdated(address indexed token, uint8 riskScore, address indexed agent, bytes32 reasoningHash, uint256 timestamp);
event ScannerAuthorized(address indexed scanner, bool authorized);
```

---

## Integration Patterns

### Pattern 1: Swap Guard (DEX Router Wrapper)

Protect users from swapping into scam tokens:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IAegisScanner } from "@aegis-protocol/contracts/interfaces/IAegisScanner.sol";

interface IPancakeRouter {
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);
}

contract AegisSafeSwap {
    IAegisScanner public immutable aegis;
    IPancakeRouter public immutable router;

    error UnsafeToken(address token, uint8 riskScore);

    constructor(address _aegis, address _router) {
        aegis = IAegisScanner(_aegis);
        router = IPancakeRouter(_router);
    }

    /// @notice Swap BNB → Token, but only if Aegis says the token is safe
    function safeSwap(
        uint amountOutMin,
        address[] calldata path,
        uint deadline
    ) external payable returns (uint[] memory amounts) {
        address tokenOut = path[path.length - 1];

        // Check Aegis oracle
        if (!aegis.isTokenSafe(tokenOut)) {
            IAegisScanner.TokenRiskData memory risk = aegis.getTokenRisk(tokenOut);
            revert UnsafeToken(tokenOut, risk.riskScore);
        }

        return router.swapExactETHForTokens{value: msg.value}(
            amountOutMin, path, msg.sender, deadline
        );
    }
}
```

### Pattern 2: Approval Guard (Wallet Security)

Block token approvals for flagged tokens:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IAegisScanner } from "@aegis-protocol/contracts/interfaces/IAegisScanner.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AegisWalletGuard {
    IAegisScanner public immutable aegis;

    error HoneypotDetected(address token);
    error HighTaxToken(address token);

    constructor(address _aegis) {
        aegis = IAegisScanner(_aegis);
    }

    /// @notice Approve a spender, but only if the token passes Aegis checks
    function safeApprove(address token, address spender, uint256 amount) external {
        IAegisScanner.TokenFlags memory flags = aegis.getTokenFlags(token);

        if (flags.isHoneypot) revert HoneypotDetected(token);
        if (flags.hasHighTax) revert HighTaxToken(token);

        IERC20(token).approve(spender, amount);
    }

    /// @notice Batch check a portfolio of tokens
    function checkPortfolio(address[] calldata tokens)
        external view
        returns (bool[] memory safe)
    {
        return aegis.isTokenSafeBatch(tokens);
    }
}
```

### Pattern 3: Lending Protocol Guard

Prevent accepting flagged tokens as collateral:

```solidity
modifier onlyCleanCollateral(address token) {
    require(aegis.isScanned(token), "Aegis: not scanned");
    IAegisScanner.TokenRiskData memory risk = aegis.getTokenRisk(token);
    require(risk.riskScore < 40, "Aegis: too risky for collateral");
    require(block.timestamp - uint256(risk.lastUpdated) < 12 hours, "Aegis: stale data");
    _;
}
```

---

## TypeScript / Frontend Integration

### Using ethers.js v6

```typescript
import { ethers } from "ethers";
import { SCANNER_ABI } from "@aegis-protocol/scanner-sdk";

const SCANNER_ADDRESS = "0x..."; // Deployed AegisScanner address

const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");
const scanner = new ethers.Contract(SCANNER_ADDRESS, SCANNER_ABI, provider);

// Single token check
const safe = await scanner.isTokenSafe("0x...");
console.log("Safe:", safe);

// Full risk data
const risk = await scanner.getTokenRisk("0x...");
console.log(`Score: ${risk.riskScore}/100, Last Updated: ${risk.lastUpdated}`);

// Structured flags
const flags = await scanner.getTokenFlags("0x...");
if (flags.isHoneypot) console.warn("HONEYPOT DETECTED!");

// Batch check (e.g. portfolio)
const tokens = ["0xaaa...", "0xbbb...", "0xccc..."];
const results = await scanner.isTokenSafeBatch(tokens);
tokens.forEach((t, i) => console.log(`${t}: ${results[i] ? "SAFE" : "UNSAFE"}`));
```

---

## Safety Rules

1. **`isTokenSafe()` returns `false` by default** — unscanned tokens are treated as unsafe. This is deliberate: fail-closed, not fail-open.
2. **Staleness protection** — Data older than 24 hours (configurable) is automatically treated as unsafe. Markets move fast; stale data kills.
3. **Honeypot override** — Even if `riskScore < 70`, a token flagged as honeypot is **never** reported as safe.
4. **Batch limit: 100** — `getTokenRiskBatch()` and `isTokenSafeBatch()` revert if more than 100 tokens are passed (gas DoS protection).

---

## Deployed Addresses

| Network | Scanner Address | Status |
|---|---|---|
| BSC Testnet (97) | *Deploy with `npx hardhat run scripts/deploy.ts --network bscTestnet`* | Active |
| BSC Mainnet (56) | TBD — Phase 5 | Not yet deployed |

---

## SDK Installation

```bash
npm install @aegis-protocol/scanner-sdk
```

```typescript
import { SCANNER_ABI, IAegisScanner } from "@aegis-protocol/scanner-sdk";
```

See the [scanner-sdk/](../scanner-sdk/) package for full TypeScript types and ABI exports.
