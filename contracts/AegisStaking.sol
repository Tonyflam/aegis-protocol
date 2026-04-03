// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AegisStaking — $UNIQ Staking for Oracle Agents
 * @author Aegis Protocol (Uniq Minds)
 * @notice Agents stake $UNIQ tokens to participate in the Security Oracle Network.
 *         Stake amount determines the agent's tier and consensus weight.
 *         Staking provides skin-in-the-game: agents that submit provably wrong
 *         data can be slashed, losing part of their stake.
 *
 * @dev Tier thresholds:
 *   Scout    — 10,000 UNIQ   (1× weight)
 *   Guardian — 100,000 UNIQ  (3× weight)
 *   Sentinel — 500,000 UNIQ  (8× weight)
 *   Archon   — 1,000,000 UNIQ (20× weight)
 */
contract AegisStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────

    enum StakeTier { None, Scout, Guardian, Sentinel, Archon }

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 unstakeRequestedAt; // 0 = no pending request
    }

    // ─── Constants ───────────────────────────────────────────

    uint256 public constant SCOUT_STAKE    = 10_000e18;
    uint256 public constant GUARDIAN_STAKE  = 100_000e18;
    uint256 public constant SENTINEL_STAKE  = 500_000e18;
    uint256 public constant ARCHON_STAKE    = 1_000_000e18;

    uint256 public constant UNSTAKE_COOLDOWN = 7 days;

    /// @notice Weight multipliers (basis points: 10000 = 1×)
    uint256 public constant SCOUT_WEIGHT    = 10_000;   // 1×
    uint256 public constant GUARDIAN_WEIGHT  = 30_000;   // 3×
    uint256 public constant SENTINEL_WEIGHT  = 80_000;   // 8×
    uint256 public constant ARCHON_WEIGHT    = 200_000;  // 20×

    // ─── Custom Errors ───────────────────────────────────────

    error ZeroAmount();
    error NotStaked();
    error UnstakeAlreadyRequested();
    error NoUnstakeRequest();
    error CooldownNotMet();
    error SlashExceedsStake();

    // ─── State ───────────────────────────────────────────────

    IERC20 public immutable uniqToken;

    mapping(address => StakeInfo) public stakes;

    uint256 public totalStaked;

    // ─── Events ──────────────────────────────────────────────

    event Staked(address indexed agent, uint256 amount, uint256 totalStake, StakeTier tier);
    event UnstakeRequested(address indexed agent, uint256 amount, uint256 unlockTime);
    event Withdrawn(address indexed agent, uint256 amount);
    event Slashed(address indexed agent, uint256 amount, string reason);

    // ─── Constructor ─────────────────────────────────────────

    constructor(address _uniqToken) Ownable(msg.sender) {
        uniqToken = IERC20(_uniqToken);
    }

    // ═════════════════════════════════════════════════════════
    //                    STAKING FUNCTIONS
    // ═════════════════════════════════════════════════════════

    /**
     * @notice Stake $UNIQ tokens to participate in the oracle network
     * @param amount Amount of $UNIQ to stake (18 decimals)
     */
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uniqToken.safeTransferFrom(msg.sender, address(this), amount);

        StakeInfo storage info = stakes[msg.sender];
        info.amount += amount;
        if (info.stakedAt == 0) {
            info.stakedAt = block.timestamp;
        }
        // Cancel pending unstake if agent re-stakes
        info.unstakeRequestedAt = 0;

        totalStaked += amount;

        emit Staked(msg.sender, amount, info.amount, getStakeTier(msg.sender));
    }

    /**
     * @notice Request to unstake (starts cooldown timer)
     */
    function requestUnstake() external {
        StakeInfo storage info = stakes[msg.sender];
        if (info.amount == 0) revert NotStaked();
        if (info.unstakeRequestedAt != 0) revert UnstakeAlreadyRequested();

        info.unstakeRequestedAt = block.timestamp;

        emit UnstakeRequested(msg.sender, info.amount, block.timestamp + UNSTAKE_COOLDOWN);
    }

    /**
     * @notice Withdraw staked $UNIQ after cooldown period
     */
    function withdraw() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        if (info.amount == 0) revert NotStaked();
        if (info.unstakeRequestedAt == 0) revert NoUnstakeRequest();
        if (block.timestamp < info.unstakeRequestedAt + UNSTAKE_COOLDOWN) revert CooldownNotMet();

        uint256 amount = info.amount;
        totalStaked -= amount;

        delete stakes[msg.sender];

        uniqToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Slash an agent's stake (only owner / protocol governance)
     * @param agent Agent address to slash
     * @param amount Amount to slash
     * @param reason Human-readable reason for the slash
     */
    function slash(address agent, uint256 amount, string calldata reason) external onlyOwner {
        StakeInfo storage info = stakes[agent];
        if (amount > info.amount) revert SlashExceedsStake();

        info.amount -= amount;
        totalStaked -= amount;

        // Slashed tokens go to protocol treasury (owner)
        uniqToken.safeTransfer(owner(), amount);

        emit Slashed(agent, amount, reason);
    }

    // ═════════════════════════════════════════════════════════
    //                    VIEW FUNCTIONS
    // ═════════════════════════════════════════════════════════

    /**
     * @notice Get the staking tier for an agent based on their stake
     * @param agent Agent address
     * @return tier The agent's current stake tier
     */
    function getStakeTier(address agent) public view returns (StakeTier) {
        uint256 amount = stakes[agent].amount;
        if (amount >= ARCHON_STAKE)   return StakeTier.Archon;
        if (amount >= SENTINEL_STAKE) return StakeTier.Sentinel;
        if (amount >= GUARDIAN_STAKE) return StakeTier.Guardian;
        if (amount >= SCOUT_STAKE)    return StakeTier.Scout;
        return StakeTier.None;
    }

    /**
     * @notice Get the consensus weight for an agent
     * @param agent Agent address
     * @return weight Weight multiplier in basis points (0 if not staked enough)
     */
    function getWeight(address agent) external view returns (uint256) {
        StakeTier tier = getStakeTier(agent);
        if (tier == StakeTier.Archon)   return ARCHON_WEIGHT;
        if (tier == StakeTier.Sentinel) return SENTINEL_WEIGHT;
        if (tier == StakeTier.Guardian) return GUARDIAN_WEIGHT;
        if (tier == StakeTier.Scout)    return SCOUT_WEIGHT;
        return 0;
    }

    /**
     * @notice Check if an agent meets the minimum stake requirement
     * @param agent Agent address
     * @return True if staked >= SCOUT_STAKE
     */
    function isStaked(address agent) external view returns (bool) {
        return stakes[agent].amount >= SCOUT_STAKE;
    }

    /**
     * @notice Get the raw stake amount for an agent
     * @param agent Agent address
     * @return amount Staked $UNIQ amount
     */
    function getStake(address agent) external view returns (uint256) {
        return stakes[agent].amount;
    }
}
