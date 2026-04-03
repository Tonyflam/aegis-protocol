// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAegisScanner.sol";

/**
 * @title AegisSafeSwap — Example: DEX Router Wrapper with Aegis Token Safety
 * @notice Wraps PancakeSwap router and checks IAegisScanner before every swap.
 *         If the output token is flagged as unsafe, the swap reverts.
 *
 * @dev This is an EXAMPLE contract for integration guide purposes.
 *      Import IAegisScanner and use isTokenSafe() to guard any on-chain action.
 */

interface IPancakeRouter {
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract AegisSafeSwap {
    IAegisScanner public immutable aegis;
    IPancakeRouter public immutable router;

    error UnsafeToken(address token, uint8 riskScore);
    error TokenNotScanned(address token);

    constructor(address _aegis, address _router) {
        aegis = IAegisScanner(_aegis);
        router = IPancakeRouter(_router);
    }

    /// @notice Swap BNB → Token, reverts if Aegis flags the output token as unsafe
    function safeSwapBNBForTokens(
        uint amountOutMin,
        address[] calldata path,
        uint deadline
    ) external payable returns (uint[] memory amounts) {
        address tokenOut = path[path.length - 1];
        _requireSafe(tokenOut);

        return router.swapExactETHForTokens{value: msg.value}(
            amountOutMin,
            path,
            msg.sender,
            deadline
        );
    }

    /// @notice Check token safety before any interaction
    function _requireSafe(address token) internal view {
        if (!aegis.isScanned(token)) revert TokenNotScanned(token);
        if (!aegis.isTokenSafe(token)) {
            IAegisScanner.TokenRiskData memory risk = aegis.getTokenRisk(token);
            revert UnsafeToken(token, risk.riskScore);
        }
    }
}
