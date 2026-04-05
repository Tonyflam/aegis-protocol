<div align="center">

# Aegis

### BNB Chain Token Safety Scanner

[![Built for BNB Chain](https://img.shields.io/badge/Built_for-BNB_Chain-F0B90B?style=for-the-badge&logo=binance)](https://www.bnbchain.org/)
[![Tests](https://img.shields.io/badge/Tests-356%2F356_Passing-22c55e?style=for-the-badge)](./test/)
[![Deployed](https://img.shields.io/badge/BSC_Testnet-Live-F0B90B?style=for-the-badge)](https://testnet.bscscan.com/address/0xd347390e2553D3FDC204F6DcF22e31d8E921819B)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)

**Paste any BNB Chain token address. Get a safety report in seconds.**

Honeypot detection · Tax analysis · Liquidity checks · Ownership audit · On-chain results

**[Launch Scanner](https://aegis-protocol-1.vercel.app/scanner) · [Live App](https://aegis-protocol-1.vercel.app/) · [Demo Video](https://youtu.be/zEeFEduh6eg) · [BSCScan](https://testnet.bscscan.com/address/0xd347390e2553D3FDC204F6DcF22e31d8E921819B)**

*BNB Chain Hackathon Winner — #6 of 200 projects*

</div>

---

## What Aegis Does

Aegis scans tokens on BNB Chain and tells you if they're safe. Every scan checks for:

| Check | What It Detects |
|-------|----------------|
| **Honeypot** | Tokens that let you buy but prevent selling |
| **Tax Traps** | Hidden buy/sell fees that drain your wallet |
| **Rug Pull Risk** | Unlocked liquidity, concentrated ownership |
| **Mint/Pause** | Owner can create tokens or freeze transfers |
| **Blacklist** | Owner can block specific addresses |
| **Verification** | Whether source code is published on BSCScan |

Results are scored **0–100** and stored on-chain in the AegisScanner contract. Any smart contract can query them.

---

## How It Works

```
1. Paste Address  →  2. Get Risk Score  →  3. Stored On-Chain
```

1. **Enter a token address** on the scanner page, or new PancakeSwap tokens are scanned automatically
2. **Aegis analyzes the contract** across multiple security vectors using GoPlus data + on-chain checks
3. **Results are written to the AegisScanner smart contract** — permanent, immutable, queryable by any protocol

---

## For Developers

Any DEX, wallet, or trading bot can check token safety with one line of Solidity:

```solidity
interface IAegisScanner {
    function isTokenSafe(address token) external view returns (bool);
    function getTokenRisk(address token) external view returns (uint8 riskScore, uint48 lastUpdated, address attestedBy, bytes32 reasoningHash);
    function getTokenFlags(address token) external view returns (bool isHoneypot, bool hasHighTax, bool isUnverified, bool hasConcentratedOwnership, bool hasLowLiquidity);
}

// Add to any swap function:
modifier aegisSafe(address token) {
    require(IAegisScanner(AEGIS).isTokenSafe(token), "Aegis: token flagged unsafe");
    _;
}
```

View calls are **free** (zero gas). Integration examples in [`contracts/examples/`](./contracts/examples/).

---

## Quick Start

```bash
# Clone & install
git clone https://github.com/Tonyflam/aegis-protocol.git
cd aegis-protocol && npm install --legacy-peer-deps

# Run tests (356 passing)
export NODE_OPTIONS="--no-experimental-require-module"
npx hardhat test

# Start frontend
cd frontend && npm install && npm run dev
# → http://localhost:3000

# Start scanner agent (optional)
cd agent && npm install && npx ts-node src/scan-service.ts
```

---

## Deployed Contract

| Contract | Address | Network |
|----------|---------|---------|
| **AegisScanner** | [`0xd347390e2553D3FDC204F6DcF22e31d8E921819B`](https://testnet.bscscan.com/address/0xd347390e2553D3FDC204F6DcF22e31d8E921819B) | BSC Testnet |

The scanner contract stores all scan results on-chain. Query it from your contracts using the `IAegisScanner` interface.

---

## $UNIQ Token

| Property | Details |
|----------|---------|
| **Contract** | [`0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777`](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) |
| **Chain** | BNB Smart Chain |
| **Supply** | 1,000,000,000 |
| **Ownership** | Renounced |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Scanner Contract** | Solidity 0.8.24, OpenZeppelin, Hardhat |
| **Scanner Agent** | TypeScript, GoPlus API, PancakeSwap listener |
| **Frontend** | Next.js 14, Tailwind CSS, ethers.js v6 |
| **Blockchain** | BNB Smart Chain (BSC Testnet) |
| **Testing** | Hardhat + Chai (356 tests) |

---

## Roadmap

| Phase | Status | Focus |
|-------|--------|-------|
| **Token Scanner** | ✅ Shipped | Honeypot detection, tax analysis, on-chain results, live scanning |
| **API & Growth** | Next | Public API, Telegram bot, partner integrations, mainnet deployment |
| **Decentralization** | Planned | Multi-agent consensus, staking, community-run scanner network |

---

<div align="center">

**Built by [Uniq Minds](https://x.com/uniq_minds)**

[Scanner](https://aegis-protocol-1.vercel.app/scanner) · [GitHub](https://github.com/Tonyflam/aegis-protocol) · [$UNIQ](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) · [Twitter](https://x.com/uniq_minds)

</div>
