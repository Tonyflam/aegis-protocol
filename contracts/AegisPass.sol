// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AegisPass — Soulbound tier pass (ERC-721, non-transferable)
/// @notice Issued to Protector Hunt winners. Permanent. No expiry. No transfer.
///         Each token encodes a tier (1 = Bronze, 2 = Silver). Off-chain readers
///         (TokenGate, /api/campaign/entries, /api/scanner/fees) treat the highest
///         pass tier held as a floor on the wallet's effective tier — winners keep
///         their fee discount + perks even after selling $UNIQ.
/// @dev Inlined IERC721 events + ERC165 to avoid OZ dep. ~110 LOC, audited pattern.
contract AegisPass {
    // ─── ERC-721 events ───────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // ─── Custom events ────────────────────────────────────────
    event Minted(address indexed to, uint256 indexed tokenId, uint8 tier);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Errors ───────────────────────────────────────────────
    error NotOwner();
    error Soulbound();
    error InvalidTier();
    error AlreadyHasHigherOrEqualTier();
    error ZeroAddress();
    error TokenDoesNotExist();

    // ─── Constants ────────────────────────────────────────────
    uint8 public constant TIER_BRONZE = 1;
    uint8 public constant TIER_SILVER = 2;

    string public constant name = "Aegis Protector Pass";
    string public constant symbol = "AEGIS-PASS";

    // ─── State ────────────────────────────────────────────────
    address public owner;
    uint256 public totalSupply;
    string public baseURI;

    mapping(uint256 => address) private _ownerOf;
    mapping(uint256 => uint8) public tierOf;          // tokenId → tier
    mapping(address => uint256) public balanceOf;
    mapping(address => uint8) public highestTierOf;   // address → max tier held

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(string memory _baseURI) {
        owner = msg.sender;
        baseURI = _baseURI;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ─── Admin ────────────────────────────────────────────────
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setBaseURI(string calldata _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    /// @notice Mint a soulbound pass. One-shot per (recipient, tier).
    /// @dev Owner can only issue passes that strictly upgrade the recipient's
    ///      current tier — prevents accidental double-issue.
    function mint(address to, uint8 tier) external onlyOwner returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (tier != TIER_BRONZE && tier != TIER_SILVER) revert InvalidTier();
        if (highestTierOf[to] >= tier) revert AlreadyHasHigherOrEqualTier();

        tokenId = ++totalSupply;
        _ownerOf[tokenId] = to;
        tierOf[tokenId] = tier;
        balanceOf[to] += 1;
        highestTierOf[to] = tier;

        emit Transfer(address(0), to, tokenId);
        emit Minted(to, tokenId, tier);
    }

    /// @notice Batch-mint for the Day-of-draw script. Same upgrade-only rule.
    function batchMint(address[] calldata recipients, uint8[] calldata tiers) external onlyOwner {
        if (recipients.length != tiers.length) revert InvalidTier();
        for (uint256 i = 0; i < recipients.length; ++i) {
            address to = recipients[i];
            uint8 t = tiers[i];
            if (to == address(0)) revert ZeroAddress();
            if (t != TIER_BRONZE && t != TIER_SILVER) revert InvalidTier();
            if (highestTierOf[to] >= t) continue; // skip silently in batch

            uint256 tokenId = ++totalSupply;
            _ownerOf[tokenId] = to;
            tierOf[tokenId] = t;
            balanceOf[to] += 1;
            highestTierOf[to] = t;
            emit Transfer(address(0), to, tokenId);
            emit Minted(to, tokenId, t);
        }
    }

    // ─── ERC-721 views ────────────────────────────────────────
    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _ownerOf[tokenId];
        if (o == address(0)) revert TokenDoesNotExist();
        return o;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_ownerOf[tokenId] == address(0)) revert TokenDoesNotExist();
        // baseURI/{tier}.json — single metadata file per tier
        uint8 t = tierOf[tokenId];
        string memory tierStr = t == TIER_SILVER ? "silver" : "bronze";
        return string.concat(baseURI, tierStr, ".json");
    }

    // ─── Soulbound: all transfer paths revert ────────────────
    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    // ─── ERC-165 ──────────────────────────────────────────────
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC165
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x5b5e139f;   // ERC721Metadata
    }
}
