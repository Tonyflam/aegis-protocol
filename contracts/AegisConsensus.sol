// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./AegisStaking.sol";
import "./AegisScanner.sol";

/**
 * @title AegisConsensus — Multi-Agent Consensus Protocol
 * @author Aegis Protocol (Uniq Minds)
 * @notice Collects risk attestations from multiple staked agents and produces
 *         a finalized, consensus-weighted risk score. At least 3 independent
 *         attestations are required before a token's score is finalized and
 *         pushed to the AegisScanner oracle.
 *
 * @dev Consensus flow:
 *   1. Staked agents submit attestations (token address + full scan data)
 *   2. Attestations accumulate in a "round" per token
 *   3. When MIN_ATTESTATIONS (3) are met, anyone can call finalizeConsensus()
 *   4. Finalization computes weighted average risk score (by stake tier)
 *   5. Outlier detection: attestations deviating >30 points from median are flagged
 *   6. Boolean security flags resolved by weighted majority vote
 *   7. Final result submitted to AegisScanner via submitScan()
 *
 *   Disputes: any staked agent can challenge a finalized score by locking
 *   additional $UNIQ. Owner resolves; if upheld, challenger is rewarded.
 */
contract AegisConsensus is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Custom Errors ───────────────────────────────────────

    error InvalidToken();
    error InvalidRiskScore();
    error InvalidBasisPoints();
    error AgentNotStaked();
    error AlreadyAttested();
    error RoundAlreadyFinalized();
    error NotEnoughAttestations();
    error RoundNotActive();
    error DisputeAlreadyActive();
    error NoActiveDispute();
    error DisputeAlreadyResolved();
    error InsufficientDisputeStake();

    // ─── Constants ───────────────────────────────────────────

    /// @notice Minimum independent attestations before consensus can finalize
    uint256 public constant MIN_ATTESTATIONS = 3;

    /// @notice Risk score deviation threshold for outlier detection
    uint256 public constant OUTLIER_THRESHOLD = 30;

    /// @notice Maximum round lifetime before it can be replaced
    uint256 public constant ROUND_TIMEOUT = 24 hours;

    /// @notice $UNIQ required to initiate a dispute
    uint256 public constant DISPUTE_STAKE = 50_000e18;

    // ─── Structs ─────────────────────────────────────────────

    struct Attestation {
        address agent;
        uint256 riskScore;
        uint256 liquidity;
        uint256 holderCount;
        uint256 topHolderPercent;
        uint256 buyTax;
        uint256 sellTax;
        bool[7] boolFlags;
        bytes32 reasoningHash;
        uint256 weight;
        uint256 timestamp;
        bool isOutlier;
    }

    struct ConsensusRound {
        address token;
        uint256 roundId;
        uint256 createdAt;
        bool finalized;
        uint256 attestationCount;
        uint8 finalRiskScore;
    }

    struct Dispute {
        address challenger;
        uint256 challengeStake;
        uint256 proposedScore;
        uint256 createdAt;
        bool resolved;
        bool upheld;
    }

    // ─── State ───────────────────────────────────────────────

    AegisStaking public immutable staking;
    AegisScanner public immutable scanner;

    /// @notice Active consensus round per token
    mapping(address => ConsensusRound) public rounds;

    /// @dev token => roundId => attestations array
    mapping(address => mapping(uint256 => Attestation[])) internal _attestations;

    /// @dev token => roundId => agent => has attested
    mapping(address => mapping(uint256 => mapping(address => bool))) public hasAttested;

    /// @notice Active disputes per token
    mapping(address => Dispute) public disputes;

    /// @notice First agent to scan a given token (earns first-to-scan bonus)
    mapping(address => address) public firstScanner;

    /// @notice Global counters
    uint256 public totalRounds;
    uint256 public totalAttestations;
    uint256 public totalFinalizations;

    // ─── Events ──────────────────────────────────────────────

    event RoundCreated(address indexed token, uint256 roundId);
    event AttestationSubmitted(address indexed token, address indexed agent, uint256 riskScore, uint256 roundId);
    event ConsensusFinalized(address indexed token, uint256 roundId, uint8 finalRiskScore, uint256 attestationCount);
    event OutlierDetected(address indexed token, address indexed agent, uint256 riskScore, uint256 median);
    event DisputeCreated(address indexed token, address indexed challenger, uint256 proposedScore);
    event DisputeResolved(address indexed token, bool upheld, address indexed challenger);

    // ─── Constructor ─────────────────────────────────────────

    constructor(address _staking, address _scanner) Ownable(msg.sender) {
        staking = AegisStaking(_staking);
        scanner = AegisScanner(_scanner);
    }

    // ═════════════════════════════════════════════════════════
    //                  ATTESTATION FUNCTIONS
    // ═════════════════════════════════════════════════════════

    /**
     * @notice Submit a risk attestation for a token
     * @dev Agent must be staked at minimum Scout level.
     *      Creates a new round if none exists, previous is finalized, or timed out.
     */
    function submitAttestation(
        address token,
        uint256 riskScore,
        uint256 liquidity,
        uint256 holderCount,
        uint256 topHolderPercent,
        uint256 buyTax,
        uint256 sellTax,
        bool[7] calldata boolFlags,
        bytes32 reasoningHash
    ) external whenNotPaused {
        if (token == address(0)) revert InvalidToken();
        if (riskScore > 100) revert InvalidRiskScore();
        if (topHolderPercent > 10000) revert InvalidBasisPoints();
        if (!staking.isStaked(msg.sender)) revert AgentNotStaked();

        ConsensusRound storage round = rounds[token];

        // Start new round if needed
        if (round.createdAt == 0 || round.finalized ||
            (block.timestamp - round.createdAt > ROUND_TIMEOUT)) {
            _startNewRound(token);
            round = rounds[token];
        }

        if (hasAttested[token][round.roundId][msg.sender]) revert AlreadyAttested();

        uint256 weight = staking.getWeight(msg.sender);

        _attestations[token][round.roundId].push(Attestation({
            agent: msg.sender,
            riskScore: riskScore,
            liquidity: liquidity,
            holderCount: holderCount,
            topHolderPercent: topHolderPercent,
            buyTax: buyTax,
            sellTax: sellTax,
            boolFlags: boolFlags,
            reasoningHash: reasoningHash,
            weight: weight,
            timestamp: block.timestamp,
            isOutlier: false
        }));

        hasAttested[token][round.roundId][msg.sender] = true;
        round.attestationCount++;
        totalAttestations++;

        // Track first-to-scan
        if (firstScanner[token] == address(0)) {
            firstScanner[token] = msg.sender;
        }

        emit AttestationSubmitted(token, msg.sender, riskScore, round.roundId);
    }

    // ═════════════════════════════════════════════════════════
    //                  CONSENSUS FINALIZATION
    // ═════════════════════════════════════════════════════════

    /**
     * @notice Finalize consensus for a token and push the result to AegisScanner
     * @dev Anyone can call this once MIN_ATTESTATIONS are met.
     *      Computes weighted average risk score, majority-vote boolean flags,
     *      detects outliers, and submits the consensus result on-chain.
     */
    function finalizeConsensus(address token) external whenNotPaused {
        ConsensusRound storage round = rounds[token];
        if (round.createdAt == 0) revert RoundNotActive();
        if (round.finalized) revert RoundAlreadyFinalized();
        if (round.attestationCount < MIN_ATTESTATIONS) revert NotEnoughAttestations();

        Attestation[] storage attestations = _attestations[token][round.roundId];
        uint256 count = attestations.length;

        // ── Step 1: Compute median for outlier detection ─────
        uint256 median = _computeMedian(attestations);

        // ── Step 2: Weighted aggregation (excluding outliers) ─
        uint256 weightedRisk;
        uint256 totalWeight;
        uint256 wLiquidity;
        uint256 wHolders;
        uint256 wTopHolder;
        uint256 wBuyTax;
        uint256 wSellTax;
        uint256[7] memory flagVotesFor;
        uint256[7] memory flagTotalWeight;

        for (uint256 i; i < count;) {
            Attestation storage att = attestations[i];

            // Outlier detection
            uint256 diff = att.riskScore > median
                ? att.riskScore - median
                : median - att.riskScore;

            if (diff > OUTLIER_THRESHOLD) {
                att.isOutlier = true;
                emit OutlierDetected(token, att.agent, att.riskScore, median);
                unchecked { ++i; }
                continue;
            }

            weightedRisk += att.riskScore * att.weight;
            totalWeight  += att.weight;
            wLiquidity   += att.liquidity * att.weight;
            wHolders     += att.holderCount * att.weight;
            wTopHolder   += att.topHolderPercent * att.weight;
            wBuyTax      += att.buyTax * att.weight;
            wSellTax     += att.sellTax * att.weight;

            for (uint256 j; j < 7;) {
                flagTotalWeight[j] += att.weight;
                if (att.boolFlags[j]) flagVotesFor[j] += att.weight;
                unchecked { ++j; }
            }

            unchecked { ++i; }
        }

        // Fallback: if all attestations were outliers, include everyone
        if (totalWeight == 0) {
            for (uint256 i; i < count;) {
                Attestation storage att = attestations[i];
                weightedRisk += att.riskScore * att.weight;
                totalWeight  += att.weight;
                wLiquidity   += att.liquidity * att.weight;
                wHolders     += att.holderCount * att.weight;
                wTopHolder   += att.topHolderPercent * att.weight;
                wBuyTax      += att.buyTax * att.weight;
                wSellTax     += att.sellTax * att.weight;
                for (uint256 j; j < 7;) {
                    flagTotalWeight[j] += att.weight;
                    if (att.boolFlags[j]) flagVotesFor[j] += att.weight;
                    unchecked { ++j; }
                }
                unchecked { ++i; }
            }
        }

        // ── Step 3: Build consensus result ───────────────────
        uint8 finalRisk = uint8(weightedRisk / totalWeight);

        bool[7] memory finalFlags;
        for (uint256 j; j < 7;) {
            // Majority vote: if >50% of weight voted true
            finalFlags[j] = flagVotesFor[j] * 2 > flagTotalWeight[j];
            unchecked { ++j; }
        }

        // Use reasoning hash from highest-weight non-outlier attestation
        bytes32 bestHash;
        uint256 bestWeight;
        for (uint256 i; i < count;) {
            if (!attestations[i].isOutlier && attestations[i].weight > bestWeight) {
                bestWeight = attestations[i].weight;
                bestHash = attestations[i].reasoningHash;
            }
            unchecked { ++i; }
        }

        // ── Step 4: Submit to AegisScanner oracle ────────────
        scanner.submitScan(
            token,
            uint256(finalRisk),
            wLiquidity / totalWeight,
            wHolders / totalWeight,
            wTopHolder / totalWeight,
            wBuyTax / totalWeight,
            wSellTax / totalWeight,
            finalFlags,
            "",
            bestHash
        );

        round.finalized = true;
        round.finalRiskScore = finalRisk;
        totalFinalizations++;

        emit ConsensusFinalized(token, round.roundId, finalRisk, count);
    }

    // ═════════════════════════════════════════════════════════
    //                  DISPUTE MECHANISM
    // ═════════════════════════════════════════════════════════

    /**
     * @notice Challenge a finalized consensus score by staking $UNIQ
     * @param token The token whose score is being disputed
     * @param proposedScore The score the challenger believes is correct (0-100)
     */
    function disputeScore(address token, uint256 proposedScore) external nonReentrant whenNotPaused {
        if (proposedScore > 100) revert InvalidRiskScore();
        ConsensusRound storage round = rounds[token];
        if (!round.finalized) revert RoundNotActive();
        if (disputes[token].createdAt != 0 && !disputes[token].resolved) revert DisputeAlreadyActive();
        if (!staking.isStaked(msg.sender)) revert AgentNotStaked();

        IERC20 uniq = IERC20(address(staking.uniqToken()));
        uniq.safeTransferFrom(msg.sender, address(this), DISPUTE_STAKE);

        disputes[token] = Dispute({
            challenger: msg.sender,
            challengeStake: DISPUTE_STAKE,
            proposedScore: proposedScore,
            createdAt: block.timestamp,
            resolved: false,
            upheld: false
        });

        emit DisputeCreated(token, msg.sender, proposedScore);
    }

    /**
     * @notice Resolve a dispute (owner / protocol governance only)
     * @param token The disputed token
     * @param upheld True if the challenger was correct (they get stake back + reward)
     */
    function resolveDispute(address token, bool upheld) external onlyOwner {
        Dispute storage d = disputes[token];
        if (d.createdAt == 0) revert NoActiveDispute();
        if (d.resolved) revert DisputeAlreadyResolved();

        d.resolved = true;
        d.upheld = upheld;

        IERC20 uniq = IERC20(address(staking.uniqToken()));

        if (upheld) {
            // Challenger was right — return stake
            uniq.safeTransfer(d.challenger, d.challengeStake);
        } else {
            // Challenger was wrong — stake goes to treasury
            uniq.safeTransfer(owner(), d.challengeStake);
        }

        emit DisputeResolved(token, upheld, d.challenger);
    }

    // ═════════════════════════════════════════════════════════
    //                    VIEW FUNCTIONS
    // ═════════════════════════════════════════════════════════

    /**
     * @notice Get all attestations for a specific round
     */
    function getAttestations(address token, uint256 roundId) external view returns (Attestation[] memory) {
        return _attestations[token][roundId];
    }

    /**
     * @notice Get the current active round for a token
     */
    function getActiveRound(address token) external view returns (ConsensusRound memory) {
        return rounds[token];
    }

    /**
     * @notice Get the number of attestations in the current active round
     */
    function getAttestationCount(address token) external view returns (uint256) {
        ConsensusRound storage round = rounds[token];
        if (round.createdAt == 0 || round.finalized) return 0;
        return round.attestationCount;
    }

    // ═════════════════════════════════════════════════════════
    //                    ADMIN FUNCTIONS
    // ═════════════════════════════════════════════════════════

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Internal ────────────────────────────────────────────

    function _startNewRound(address token) internal {
        uint256 roundId = ++totalRounds;
        rounds[token] = ConsensusRound({
            token: token,
            roundId: roundId,
            createdAt: block.timestamp,
            finalized: false,
            attestationCount: 0,
            finalRiskScore: 0
        });
        emit RoundCreated(token, roundId);
    }

    /**
     * @dev Compute median risk score from attestations using insertion sort.
     *      Gas-efficient for small arrays (expected: 3-10 attestations).
     */
    function _computeMedian(Attestation[] storage attestations) internal view returns (uint256) {
        uint256 len = attestations.length;
        uint256[] memory scores = new uint256[](len);
        for (uint256 i; i < len;) {
            scores[i] = attestations[i].riskScore;
            unchecked { ++i; }
        }
        // Insertion sort
        for (uint256 i = 1; i < len;) {
            uint256 key = scores[i];
            uint256 j = i;
            while (j > 0 && scores[j - 1] > key) {
                scores[j] = scores[j - 1];
                j--;
            }
            scores[j] = key;
            unchecked { ++i; }
        }
        if (len % 2 == 1) return scores[len / 2];
        return (scores[len / 2 - 1] + scores[len / 2]) / 2;
    }
}
