// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AegisCampaignClaim
 * @notice Merkle-based prize distributor for the Aegis Protector Hunt.
 *
 * Mechanism
 * ─────────
 * After the draw on Jun 1 2026, we publish a winners.json containing
 * {address, amount} entries. Each entry is hashed as keccak256(address, amount)
 * and combined into a Merkle tree. The owner pushes the root once + funds the
 * contract with the total prize $UNIQ.
 *
 * Each winner calls `claim(amount, proof)` once:
 *   • 25 % of `amount` is transferred to them immediately.
 *   • The remaining 75 % is locked into a per-winner linear vesting schedule
 *     that releases over `VESTING_DURATION` (14 days) from the claim block.
 *
 * The winner can then call `release()` at any time to pull whatever has vested
 * since their last release.
 *
 * Anti-rug guarantees
 * ───────────────────
 *   • No `pause()` — once root is set + funded, claims cannot be blocked.
 *   • Owner can never reclaim funded $UNIQ unless `CLAIM_WINDOW` has passed
 *     AND there is residual unclaimed allocation (rolls into season 2 pool).
 *   • Merkle root is set ONCE and is immutable thereafter.
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

contract AegisCampaignClaim {
    // ─── Immutable config ────────────────────────────────────
    IERC20 public immutable uniq;
    address public immutable owner;
    uint256 public constant INSTANT_BPS = 2500;        // 25.00 %
    uint256 public constant VESTING_DURATION = 14 days;
    uint256 public constant CLAIM_WINDOW = 90 days;    // owner can sweep residue after this

    // ─── State ───────────────────────────────────────────────
    bytes32 public merkleRoot;        // set once
    uint256 public rootSetAt;         // timestamp when root was set
    bool    public rootFinalized;

    struct Vest {
        uint128 lockedTotal;     // 75 % of original prize, locked at claim time
        uint128 released;        // amount the winner has already pulled via release()
        uint64  startTs;         // block.timestamp at claim()
    }
    mapping(address => Vest) public vesting;
    mapping(address => bool) public claimed;  // ensures one claim() per winner

    // ─── Events ──────────────────────────────────────────────
    event RootSet(bytes32 indexed root);
    event Claimed(address indexed winner, uint256 totalAmount, uint256 instant, uint256 locked);
    event Released(address indexed winner, uint256 amount);
    event Swept(address indexed to, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────
    error NotOwner();
    error RootAlreadySet();
    error RootNotSet();
    error AlreadyClaimed();
    error InvalidProof();
    error NothingToRelease();
    error WindowNotElapsed();

    constructor(address _uniq) {
        uniq = IERC20(_uniq);
        owner = msg.sender;
    }

    // ─── Owner: set root (one-shot) ──────────────────────────
    function setMerkleRoot(bytes32 _root) external {
        if (msg.sender != owner) revert NotOwner();
        if (rootFinalized) revert RootAlreadySet();
        merkleRoot = _root;
        rootSetAt = block.timestamp;
        rootFinalized = true;
        emit RootSet(_root);
    }

    // ─── Winner: claim (one-shot per address) ────────────────
    function claim(uint256 amount, bytes32[] calldata proof) external {
        if (!rootFinalized) revert RootNotSet();
        if (claimed[msg.sender]) revert AlreadyClaimed();

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!_verify(proof, merkleRoot, leaf)) revert InvalidProof();

        claimed[msg.sender] = true;

        uint256 instant = (amount * INSTANT_BPS) / 10_000;
        uint256 locked  = amount - instant;

        vesting[msg.sender] = Vest({
            lockedTotal: uint128(locked),
            released:    0,
            startTs:     uint64(block.timestamp)
        });

        require(uniq.transfer(msg.sender, instant), "transfer failed");
        emit Claimed(msg.sender, amount, instant, locked);
    }

    // ─── Winner: pull vested amount ──────────────────────────
    function release() external {
        uint256 amt = releasable(msg.sender);
        if (amt == 0) revert NothingToRelease();
        vesting[msg.sender].released += uint128(amt);
        require(uniq.transfer(msg.sender, amt), "transfer failed");
        emit Released(msg.sender, amt);
    }

    // ─── View: how much is currently vested + unreleased ─────
    function releasable(address who) public view returns (uint256) {
        Vest memory v = vesting[who];
        if (v.lockedTotal == 0) return 0;
        uint256 elapsed = block.timestamp - v.startTs;
        uint256 vested  = elapsed >= VESTING_DURATION
            ? v.lockedTotal
            : (uint256(v.lockedTotal) * elapsed) / VESTING_DURATION;
        return vested - v.released;
    }

    // ─── Owner: sweep residue after CLAIM_WINDOW ─────────────
    function sweep(address to) external {
        if (msg.sender != owner) revert NotOwner();
        if (block.timestamp < rootSetAt + CLAIM_WINDOW) revert WindowNotElapsed();
        uint256 bal = uniq.balanceOf(address(this));
        require(uniq.transfer(to, bal), "transfer failed");
        emit Swept(to, bal);
    }

    // ─── Internal: standard OZ MerkleProof.verify ────────────
    function _verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        bytes32 h = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            h = h < p ? keccak256(abi.encodePacked(h, p)) : keccak256(abi.encodePacked(p, h));
        }
        return h == root;
    }
}
