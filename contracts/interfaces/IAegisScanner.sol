// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAegisScanner — On-Chain Security Oracle Interface
 * @author Aegis Protocol (Uniq Minds)
 * @notice The public interface for querying token security data on BNB Chain.
 *         Any smart contract, wallet, or agent can call these functions to check
 *         whether a token is safe before executing swaps, approvals, or deposits.
 *
 * @dev Integration example:
 *
 *   modifier aegisSafe(address token) {
 *       require(IAegisScanner(AEGIS_SCANNER).isTokenSafe(token), "Aegis: unsafe token");
 *       _;
 *   }
 *
 *   function swap(address tokenOut, uint256 amount) external aegisSafe(tokenOut) {
 *       // ... normal swap logic
 *   }
 */
interface IAegisScanner {
    /// @notice Core risk data returned for any scanned token
    struct TokenRiskData {
        uint8 riskScore;        // 0-100 (0 = safe, 100 = scam)
        uint48 lastUpdated;     // Timestamp of most recent scan
        address attestedBy;     // Agent address that submitted the scan
        bytes32 reasoningHash;  // IPFS CID of full AI analysis (keccak256-encoded)
    }

    /// @notice Structured boolean security flags for a token
    struct TokenFlags {
        bool isHoneypot;
        bool hasHighTax;
        bool isUnverified;
        bool hasConcentratedOwnership;
        bool hasLowLiquidity;
    }

    // ─── Core Oracle Queries ─────────────────────────────────

    /**
     * @notice Get the full risk assessment for a token
     * @param token The BEP-20 token address to query
     * @return data The risk data struct (score, timestamp, attester, reasoning)
     */
    function getTokenRisk(address token) external view returns (TokenRiskData memory data);

    /**
     * @notice Check if a token is considered safe
     * @dev Returns false if: never scanned, risk score >= 70, or scan data is stale (>24h)
     * @param token The BEP-20 token address to check
     * @return safe True only if scanned, score < 70, and data is fresh
     */
    function isTokenSafe(address token) external view returns (bool safe);

    /**
     * @notice Get structured security flags for a token
     * @param token The BEP-20 token address to query
     * @return flags The boolean security flags struct
     */
    function getTokenFlags(address token) external view returns (TokenFlags memory flags);

    // ─── Batch Queries ───────────────────────────────────────

    /**
     * @notice Batch query risk data for multiple tokens in one call
     * @param tokens Array of BEP-20 token addresses
     * @return data Array of risk data structs (same order as input)
     */
    function getTokenRiskBatch(address[] calldata tokens) external view returns (TokenRiskData[] memory data);

    /**
     * @notice Batch check safety for multiple tokens
     * @param tokens Array of BEP-20 token addresses
     * @return results Array of safety booleans (same order as input)
     */
    function isTokenSafeBatch(address[] calldata tokens) external view returns (bool[] memory results);

    // ─── Metadata ────────────────────────────────────────────

    /**
     * @notice Check if a token has been scanned at least once
     * @param token The BEP-20 token address
     * @return scanned True if at least one scan exists
     */
    function isScanned(address token) external view returns (bool scanned);

    /**
     * @notice Get the staleness threshold in seconds
     * @return threshold Seconds after which scan data is considered stale
     */
    function stalenessThreshold() external view returns (uint256 threshold);

    // ─── Events ──────────────────────────────────────────────

    /// @notice Emitted when a token risk scan is submitted or updated
    event TokenRiskUpdated(
        address indexed token,
        uint8 riskScore,
        address indexed agent,
        bytes32 reasoningHash,
        uint256 timestamp
    );

    /// @notice Emitted when a scanner is authorized or deauthorized
    event ScannerAuthorized(address indexed scanner, bool authorized);
}
