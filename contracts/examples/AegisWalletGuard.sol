// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAegisScanner.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AegisWalletGuard — Example: Token Approval Guard with Aegis
 * @notice Wraps ERC-20 approve() to block approvals for honeypots and high-tax tokens.
 *         Users interact via this contract instead of approving tokens directly.
 *
 * @dev This is an EXAMPLE contract for integration guide purposes.
 *      Shows how to use getTokenFlags() for granular risk checks.
 */
contract AegisWalletGuard {
    IAegisScanner public immutable aegis;

    error HoneypotDetected(address token);
    error HighTaxToken(address token);
    error UnverifiedContract(address token);

    constructor(address _aegis) {
        aegis = IAegisScanner(_aegis);
    }

    /// @notice Approve a spender, but only if the token passes Aegis security checks
    /// @param token The BEP-20 token to approve
    /// @param spender The address allowed to spend
    /// @param amount The approval amount
    function safeApprove(address token, address spender, uint256 amount) external {
        IAegisScanner.TokenFlags memory flags = aegis.getTokenFlags(token);

        if (flags.isHoneypot) revert HoneypotDetected(token);
        if (flags.hasHighTax) revert HighTaxToken(token);
        if (flags.isUnverified) revert UnverifiedContract(token);

        // Caller must have already transferred tokens to this contract
        // or this contract must be called via delegatecall
        IERC20(token).approve(spender, amount);
    }

    /// @notice Batch check safety for a portfolio of tokens
    /// @param tokens Array of token addresses to check
    /// @return safe Array of booleans — true if Aegis considers the token safe
    function checkPortfolio(address[] calldata tokens) external view returns (bool[] memory safe) {
        return aegis.isTokenSafeBatch(tokens);
    }

    /// @notice Get detailed risk data for a single token
    /// @param token The token to inspect
    /// @return risk The full risk data struct
    /// @return flags The structured boolean flags
    function inspect(address token)
        external view
        returns (IAegisScanner.TokenRiskData memory risk, IAegisScanner.TokenFlags memory flags)
    {
        risk = aegis.getTokenRisk(token);
        flags = aegis.getTokenFlags(token);
    }
}
