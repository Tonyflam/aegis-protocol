// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAegisScanner.sol";

/**
 * @title AegisCertification — Security Certification NFT
 * @author Aegis Protocol (Uniq Minds)
 * @notice Tokens that pass continuous Aegis scanning earn a non-transferable
 *         "Aegis Certified" NFT. Certification can be revoked if the token's
 *         risk score increases above the safety threshold.
 *
 * @dev Certification flow:
 *   1. Token project pays certification fee in $UNIQ
 *   2. Aegis validates the token has been scanned and is currently safe
 *   3. An ERC-721 Certification NFT is minted to the token's operator address
 *   4. Background monitoring: if risk score rises, certification is revoked (burned)
 *   5. Only one certification per token at a time
 */
contract AegisCertification is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Custom Errors ───────────────────────────────────────

    error TokenNotSafe();
    error TokenNotScanned();
    error AlreadyCertified();
    error NotCertified();
    error CertificationStillValid();
    error ZeroAddress();

    // ─── Structs ─────────────────────────────────────────────

    struct Certification {
        address token;           // Certified BEP-20 token address
        address certifiedTo;     // Address that paid for certification
        uint256 certifiedAt;     // Timestamp of certification
        uint256 riskScoreAtCert; // Risk score at time of certification
    }

    // ─── State ───────────────────────────────────────────────

    IAegisScanner public immutable scanner;
    IERC20 public immutable uniqToken;

    /// @notice Fee in $UNIQ required for certification
    uint256 public certificationFee;

    /// @notice Next certification NFT ID
    uint256 private _nextCertId;

    /// @notice token address => certification ID (0 = not certified)
    mapping(address => uint256) public tokenCertId;

    /// @notice cert ID => certification data
    mapping(uint256 => Certification) public certifications;

    /// @notice Total active certifications
    uint256 public activeCertifications;

    // ─── Events ──────────────────────────────────────────────

    event TokenCertified(address indexed token, uint256 indexed certId, address indexed certifiedTo, uint256 riskScore);
    event CertificationRevoked(address indexed token, uint256 indexed certId, string reason);
    event CertificationFeeUpdated(uint256 oldFee, uint256 newFee);

    // ─── Constructor ─────────────────────────────────────────

    constructor(
        address _scanner,
        address _uniqToken,
        uint256 _certificationFee
    ) ERC721("Aegis Certification", "AEGIS-CERT") Ownable(msg.sender) {
        scanner = IAegisScanner(_scanner);
        uniqToken = IERC20(_uniqToken);
        certificationFee = _certificationFee;
        _nextCertId = 1; // Start at 1 so 0 means "not certified"
    }

    // ═════════════════════════════════════════════════════════
    //                   CERTIFICATION
    // ═════════════════════════════════════════════════════════

    /**
     * @notice Apply for certification for a token
     * @param token The BEP-20 token to certify
     * @dev Requires prior $UNIQ approve(). Token must be scanned and safe.
     */
    function certify(address token) external nonReentrant returns (uint256 certId) {
        if (token == address(0)) revert ZeroAddress();
        if (tokenCertId[token] != 0) revert AlreadyCertified();
        if (!scanner.isScanned(token)) revert TokenNotScanned();
        if (!scanner.isTokenSafe(token)) revert TokenNotSafe();

        // Collect certification fee
        if (certificationFee > 0) {
            uniqToken.safeTransferFrom(msg.sender, address(this), certificationFee);
        }

        IAegisScanner.TokenRiskData memory risk = scanner.getTokenRisk(token);

        certId = _nextCertId++;
        certifications[certId] = Certification({
            token: token,
            certifiedTo: msg.sender,
            certifiedAt: block.timestamp,
            riskScoreAtCert: risk.riskScore
        });
        tokenCertId[token] = certId;
        activeCertifications++;

        _safeMint(msg.sender, certId);

        emit TokenCertified(token, certId, msg.sender, risk.riskScore);
    }

    /**
     * @notice Revoke certification if the token is no longer safe
     * @param token The token whose certification should be revoked
     * @dev Anyone can call this — it checks the scanner and burns the NFT
     *      if the token is no longer safe.
     */
    function revokeCertification(address token) external {
        uint256 certId = tokenCertId[token];
        if (certId == 0) revert NotCertified();

        // Check if the token is still safe
        bool safe = scanner.isTokenSafe(token);
        if (safe) revert CertificationStillValid();

        // Burn the NFT and clear references
        _burn(certId);

        delete tokenCertId[token];
        activeCertifications--;

        emit CertificationRevoked(token, certId, safe ? "admin" : "token_unsafe");
    }

    /**
     * @notice Admin revoke (owner can force-revoke any certification)
     * @param token The token whose certification to revoke
     * @param reason Human-readable reason for revocation
     */
    function adminRevoke(address token, string calldata reason) external onlyOwner {
        uint256 certId = tokenCertId[token];
        if (certId == 0) revert NotCertified();

        _burn(certId);
        delete tokenCertId[token];
        activeCertifications--;

        emit CertificationRevoked(token, certId, reason);
    }

    // ═════════════════════════════════════════════════════════
    //                    VIEW FUNCTIONS
    // ═════════════════════════════════════════════════════════

    /**
     * @notice Check if a token is currently certified
     */
    function isCertified(address token) external view returns (bool) {
        return tokenCertId[token] != 0;
    }

    /**
     * @notice Get certification details for a token
     */
    function getCertification(address token) external view returns (Certification memory) {
        uint256 certId = tokenCertId[token];
        if (certId == 0) revert NotCertified();
        return certifications[certId];
    }

    // ═════════════════════════════════════════════════════════
    //                    ADMIN FUNCTIONS
    // ═════════════════════════════════════════════════════════

    /**
     * @notice Update certification fee
     */
    function setCertificationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = certificationFee;
        certificationFee = newFee;
        emit CertificationFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Withdraw accumulated $UNIQ fees to treasury
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = uniqToken.balanceOf(address(this));
        require(balance > 0, "No fees");
        uniqToken.safeTransfer(owner(), balance);
    }

    /**
     * @notice Non-transferable: override transfer to revert
     * @dev Soulbound — certifications cannot be traded
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        // Allow minting (from == 0) and burning (to == 0), block transfers
        require(from == address(0) || to == address(0), "Certification: non-transferable");
        return from;
    }
}
