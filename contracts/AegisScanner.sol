// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IAegisScanner.sol";

/**
 * @title AegisScanner — On-Chain Security Oracle
 * @author Aegis Protocol (Uniq Minds)
 * @notice Stores AI-generated risk assessments for any BEP-20 token on BSC.
 *         Authorized agents push scan results on-chain. Any contract or wallet
 *         can query token safety via the IAegisScanner interface before executing
 *         swaps, approvals, or deposits.
 *
 * @dev Implements IAegisScanner for composable on-chain security queries.
 *      Designed as chain-level middleware — other protocols import IAegisScanner
 *      and call getTokenRisk() / isTokenSafe() without depending on this implementation.
 *
 * Risk flags:
 *   HONEYPOT          — Token cannot be sold after buying
 *   HIGH_TAX          — Buy/sell tax exceeds 10%
 *   UNVERIFIED        — Contract source not verified on BSCScan
 *   WHALE_DOMINATED   — Top holder owns >50%
 *   LOW_LIQUIDITY     — Under $10K liquidity, high slippage
 *   PROXY_CONTRACT    — Upgradeable proxy (owner can change logic)
 *   MINT_FUNCTION     — Owner can mint new tokens
 *   PAUSE_FUNCTION    — Owner can pause transfers
 *   BLACKLIST_FUNCTION — Owner can blacklist addresses
 *   RUG_PULL_RISK     — Owner can drain liquidity / mint unlimited
 */
contract AegisScanner is IAegisScanner, Ownable, Pausable {
    // ─── Custom Errors ───────────────────────────────────────
    error InvalidToken();
    error InvalidRiskScore();
    error InvalidBasisPoints();
    error NotAuthorizedScanner();
    error BatchTooLarge();

    // ─── Constants ───────────────────────────────────────────
    /// @notice Risk score threshold: tokens at or above this are considered unsafe
    uint8 public constant RISK_THRESHOLD = 70;

    /// @notice Maximum tokens per batch query (prevents gas DoS)
    uint256 public constant MAX_BATCH_SIZE = 100;

    /// @notice Default staleness threshold: 24 hours
    uint256 private constant DEFAULT_STALENESS = 24 hours;

    // ─── Structs ─────────────────────────────────────────────
    struct TokenScan {
        address token;
        uint256 riskScore;        // 0-100 (0 = safe, 100 = scam)
        uint256 liquidity;        // USD value of LP (scaled by 1e18)
        uint256 holderCount;
        uint256 topHolderPercent; // basis points (5000 = 50%)
        uint256 buyTax;           // basis points
        uint256 sellTax;          // basis points
        bool isHoneypot;
        bool ownerCanMint;
        bool ownerCanPause;
        bool ownerCanBlacklist;
        bool isContractRenounced;
        bool isLiquidityLocked;
        bool isVerified;
        uint256 scanTimestamp;
        address scannedBy;        // agent address that submitted
        string flags;             // comma-separated flag list (legacy compat)
        bytes32 reasoningHash;    // IPFS CID of full AI analysis
        uint256 scanVersion;      // number of times this token has been scanned
    }

    // ─── State ───────────────────────────────────────────────
    mapping(address => TokenScan) public tokenScans;
    mapping(address => bool) public authorizedScanners;
    address[] public scannedTokens;
    mapping(address => bool) private _tokenExists;

    uint256 public totalScans;
    uint256 public totalHoneypots;
    uint256 public totalRugRisks;

    /// @notice Configurable staleness threshold (owner can adjust)
    uint256 public override stalenessThreshold;

    // ─── Events (legacy compat) ──────────────────────────────
    event TokenScanned(
        address indexed token,
        uint256 riskScore,
        bool isHoneypot,
        uint256 liquidity,
        address indexed scannedBy,
        uint256 timestamp
    );

    // ─── Constructor ─────────────────────────────────────────
    constructor() Ownable(msg.sender) {
        authorizedScanners[msg.sender] = true;
        stalenessThreshold = DEFAULT_STALENESS;
    }

    // ─── Modifiers ───────────────────────────────────────────
    modifier onlyScanner() {
        if (!authorizedScanners[msg.sender]) revert NotAuthorizedScanner();
        _;
    }

    // ═════════════════════════════════════════════════════════
    //                    WRITE FUNCTIONS
    // ═════════════════════════════════════════════════════════

    /**
     * @notice Submit a token risk scan result
     * @param token The BEP-20 token address
     * @param riskScore 0-100 risk score
     * @param liquidity USD liquidity in wei (1e18 = $1)
     * @param holderCount Number of unique holders
     * @param topHolderPercent Top holder % in basis points
     * @param buyTax Buy tax in basis points
     * @param sellTax Sell tax in basis points
     * @param boolFlags Packed: [honeypot, canMint, canPause, canBlacklist, renounced, lpLocked, verified]
     * @param flags Comma-separated flag string (legacy compat)
     * @param reasoningHash IPFS CID of full AI analysis (bytes32-encoded)
     */
    function submitScan(
        address token,
        uint256 riskScore,
        uint256 liquidity,
        uint256 holderCount,
        uint256 topHolderPercent,
        uint256 buyTax,
        uint256 sellTax,
        bool[7] calldata boolFlags,
        string calldata flags,
        bytes32 reasoningHash
    ) external onlyScanner whenNotPaused {
        if (token == address(0)) revert InvalidToken();
        if (riskScore > 100) revert InvalidRiskScore();
        if (topHolderPercent > 10000) revert InvalidBasisPoints();

        uint256 newVersion = tokenScans[token].scanVersion + 1;

        tokenScans[token] = TokenScan({
            token: token,
            riskScore: riskScore,
            liquidity: liquidity,
            holderCount: holderCount,
            topHolderPercent: topHolderPercent,
            buyTax: buyTax,
            sellTax: sellTax,
            isHoneypot: boolFlags[0],
            ownerCanMint: boolFlags[1],
            ownerCanPause: boolFlags[2],
            ownerCanBlacklist: boolFlags[3],
            isContractRenounced: boolFlags[4],
            isLiquidityLocked: boolFlags[5],
            isVerified: boolFlags[6],
            scanTimestamp: block.timestamp,
            scannedBy: msg.sender,
            flags: flags,
            reasoningHash: reasoningHash,
            scanVersion: newVersion
        });

        if (!_tokenExists[token]) {
            scannedTokens.push(token);
            _tokenExists[token] = true;
        }

        unchecked {
            totalScans++;
            if (boolFlags[0]) totalHoneypots++;
            if (riskScore >= RISK_THRESHOLD) totalRugRisks++;
        }

        // Emit both legacy and oracle events
        emit TokenScanned(token, riskScore, boolFlags[0], liquidity, msg.sender, block.timestamp);
        emit TokenRiskUpdated(token, uint8(riskScore), msg.sender, reasoningHash, block.timestamp);
    }

    /**
     * @notice Submit scan using legacy signature (backward compat, no reasoningHash)
     * @dev Delegates to the full submitScan with bytes32(0) as reasoningHash
     */
    function submitScan(
        address token,
        uint256 riskScore,
        uint256 liquidity,
        uint256 holderCount,
        uint256 topHolderPercent,
        uint256 buyTax,
        uint256 sellTax,
        bool[7] calldata boolFlags,
        string calldata flags
    ) external onlyScanner whenNotPaused {
        if (token == address(0)) revert InvalidToken();
        if (riskScore > 100) revert InvalidRiskScore();
        if (topHolderPercent > 10000) revert InvalidBasisPoints();

        uint256 newVersion = tokenScans[token].scanVersion + 1;

        tokenScans[token] = TokenScan({
            token: token,
            riskScore: riskScore,
            liquidity: liquidity,
            holderCount: holderCount,
            topHolderPercent: topHolderPercent,
            buyTax: buyTax,
            sellTax: sellTax,
            isHoneypot: boolFlags[0],
            ownerCanMint: boolFlags[1],
            ownerCanPause: boolFlags[2],
            ownerCanBlacklist: boolFlags[3],
            isContractRenounced: boolFlags[4],
            isLiquidityLocked: boolFlags[5],
            isVerified: boolFlags[6],
            scanTimestamp: block.timestamp,
            scannedBy: msg.sender,
            flags: flags,
            reasoningHash: bytes32(0),
            scanVersion: newVersion
        });

        if (!_tokenExists[token]) {
            scannedTokens.push(token);
            _tokenExists[token] = true;
        }

        unchecked {
            totalScans++;
            if (boolFlags[0]) totalHoneypots++;
            if (riskScore >= RISK_THRESHOLD) totalRugRisks++;
        }

        emit TokenScanned(token, riskScore, boolFlags[0], liquidity, msg.sender, block.timestamp);
        emit TokenRiskUpdated(token, uint8(riskScore), msg.sender, bytes32(0), block.timestamp);
    }

    // ═════════════════════════════════════════════════════════
    //              IAegisScanner ORACLE INTERFACE
    // ═════════════════════════════════════════════════════════

    /// @inheritdoc IAegisScanner
    function getTokenRisk(address token) external view override returns (TokenRiskData memory data) {
        TokenScan storage scan = tokenScans[token];
        data = TokenRiskData({
            riskScore: uint8(scan.riskScore),
            lastUpdated: uint48(scan.scanTimestamp),
            attestedBy: scan.scannedBy,
            reasoningHash: scan.reasoningHash
        });
    }

    /// @inheritdoc IAegisScanner
    function isTokenSafe(address token) external view override returns (bool safe) {
        TokenScan storage scan = tokenScans[token];
        // Not scanned → not safe
        if (scan.scanTimestamp == 0) return false;
        // Stale data → not safe
        if (block.timestamp - scan.scanTimestamp > stalenessThreshold) return false;
        // High risk → not safe
        if (scan.riskScore >= RISK_THRESHOLD) return false;
        // Honeypot → not safe (regardless of score)
        if (scan.isHoneypot) return false;
        return true;
    }

    /// @inheritdoc IAegisScanner
    function getTokenFlags(address token) external view override returns (TokenFlags memory flags) {
        TokenScan storage scan = tokenScans[token];
        flags = TokenFlags({
            isHoneypot: scan.isHoneypot,
            hasHighTax: scan.buyTax > 1000 || scan.sellTax > 1000, // >10% tax
            isUnverified: !scan.isVerified,
            hasConcentratedOwnership: scan.topHolderPercent > 5000, // >50%
            hasLowLiquidity: scan.liquidity < 10000e18             // <$10K
        });
    }

    /// @inheritdoc IAegisScanner
    function getTokenRiskBatch(address[] calldata tokens) external view override returns (TokenRiskData[] memory data) {
        uint256 len = tokens.length;
        if (len > MAX_BATCH_SIZE) revert BatchTooLarge();
        data = new TokenRiskData[](len);
        for (uint256 i; i < len;) {
            TokenScan storage scan = tokenScans[tokens[i]];
            data[i] = TokenRiskData({
                riskScore: uint8(scan.riskScore),
                lastUpdated: uint48(scan.scanTimestamp),
                attestedBy: scan.scannedBy,
                reasoningHash: scan.reasoningHash
            });
            unchecked { ++i; }
        }
    }

    /// @inheritdoc IAegisScanner
    function isTokenSafeBatch(address[] calldata tokens) external view override returns (bool[] memory results) {
        uint256 len = tokens.length;
        if (len > MAX_BATCH_SIZE) revert BatchTooLarge();
        results = new bool[](len);
        for (uint256 i; i < len;) {
            TokenScan storage scan = tokenScans[tokens[i]];
            results[i] = scan.scanTimestamp != 0
                && (block.timestamp - scan.scanTimestamp <= stalenessThreshold)
                && scan.riskScore < RISK_THRESHOLD
                && !scan.isHoneypot;
            unchecked { ++i; }
        }
    }

    /// @inheritdoc IAegisScanner
    function isScanned(address token) external view override returns (bool) {
        return _tokenExists[token];
    }

    // ═════════════════════════════════════════════════════════
    //              LEGACY VIEW FUNCTIONS (backward compat)
    // ═════════════════════════════════════════════════════════

    function getTokenScan(address token) external view returns (TokenScan memory) {
        return tokenScans[token];
    }

    function getTokenRiskScore(address token) external view returns (uint256) {
        return tokenScans[token].riskScore;
    }

    function isHoneypot(address token) external view returns (bool) {
        return tokenScans[token].isHoneypot;
    }

    function getScannedTokenCount() external view returns (uint256) {
        return scannedTokens.length;
    }

    function getRecentScans(uint256 count) external view returns (TokenScan[] memory) {
        uint256 len = scannedTokens.length;
        uint256 resultLen = count < len ? count : len;
        TokenScan[] memory results = new TokenScan[](resultLen);
        for (uint256 i; i < resultLen;) {
            results[i] = tokenScans[scannedTokens[len - 1 - i]];
            unchecked { ++i; }
        }
        return results;
    }

    function getScannerStats() external view returns (uint256, uint256, uint256, uint256) {
        return (totalScans, totalHoneypots, totalRugRisks, scannedTokens.length);
    }

    // ═════════════════════════════════════════════════════════
    //                    ADMIN FUNCTIONS
    // ═════════════════════════════════════════════════════════

    function setScannerAuthorization(address scanner, bool authorized) external onlyOwner {
        authorizedScanners[scanner] = authorized;
        emit ScannerAuthorized(scanner, authorized);
    }

    /**
     * @notice Update the staleness threshold
     * @param newThreshold New threshold in seconds (minimum 1 hour, maximum 7 days)
     */
    function setStalenessThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold >= 1 hours && newThreshold <= 7 days, "Threshold out of range");
        stalenessThreshold = newThreshold;
    }

    /// @notice Pause scan submissions (emergency)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause scan submissions
    function unpause() external onlyOwner {
        _unpause();
    }
}
