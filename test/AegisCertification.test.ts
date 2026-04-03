import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("AegisCertification", function () {
  const CERT_FEE = ethers.parseEther("10000");

  // Standard bool flags
  const SAFE_FLAGS: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] =
    [false, false, false, false, true, true, true];
  const HONEYPOT_FLAGS: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] =
    [true, true, true, true, false, false, false];

  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmCertAnalysis"));

  function randomAddress() {
    return ethers.Wallet.createRandom().address;
  }

  async function deployCertFixture() {
    const [owner, project1, project2, user1] = await ethers.getSigners();

    // Deploy mock UNIQ
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const uniq = await MockERC20.deploy("Uniq Token", "UNIQ", ethers.parseEther("100000000"));

    // Deploy Scanner
    const Scanner = await ethers.getContractFactory("AegisScanner");
    const scanner = await Scanner.deploy();

    // Deploy Certification
    const Cert = await ethers.getContractFactory("AegisCertification");
    const cert = await Cert.deploy(
      await scanner.getAddress(),
      await uniq.getAddress(),
      CERT_FEE
    );

    // Distribute UNIQ
    await uniq.transfer(project1.address, ethers.parseEther("500000"));
    await uniq.transfer(project2.address, ethers.parseEther("500000"));

    return { cert, scanner, uniq, owner, project1, project2, user1 };
  }

  async function scanToken(scanner: any, token: string, riskScore: number, honeypot: boolean = false) {
    const flags: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = honeypot
      ? HONEYPOT_FLAGS
      : SAFE_FLAGS;
    await scanner["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
      token, riskScore,
      ethers.parseEther("100"), 500, 2000, 300, 300,
      flags, "", SAMPLE_HASH
    );
  }

  async function certifyToken(cert: any, scanner: any, uniq: any, project: any): Promise<string> {
    const token = randomAddress();
    await scanToken(scanner, token, 25);
    await uniq.connect(project).approve(await cert.getAddress(), CERT_FEE);
    await cert.connect(project).certify(token);
    return token;
  }

  // ═══════════════════════════════════════════════════════════
  //                       DEPLOYMENT
  // ═══════════════════════════════════════════════════════════

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      const { cert } = await loadFixture(deployCertFixture);
      expect(await cert.name()).to.equal("Aegis Certification");
      expect(await cert.symbol()).to.equal("AEGIS-CERT");
    });

    it("should set correct scanner", async function () {
      const { cert, scanner } = await loadFixture(deployCertFixture);
      expect(await cert.scanner()).to.equal(await scanner.getAddress());
    });

    it("should set correct fee", async function () {
      const { cert } = await loadFixture(deployCertFixture);
      expect(await cert.certificationFee()).to.equal(CERT_FEE);
    });

    it("should start with zero active certifications", async function () {
      const { cert } = await loadFixture(deployCertFixture);
      expect(await cert.activeCertifications()).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                    CERTIFICATION
  // ═══════════════════════════════════════════════════════════

  describe("Certification", function () {
    it("should certify a safe scanned token", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = randomAddress();
      await scanToken(scanner, token, 25);

      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);

      await expect(cert.connect(project1).certify(token))
        .to.emit(cert, "TokenCertified");

      expect(await cert.isCertified(token)).to.be.true;
      expect(await cert.activeCertifications()).to.equal(1);
    });

    it("should transfer UNIQ fee to contract", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = randomAddress();
      await scanToken(scanner, token, 25);

      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);
      await cert.connect(project1).certify(token);

      expect(await uniq.balanceOf(await cert.getAddress())).to.equal(CERT_FEE);
    });

    it("should store correct certification data", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = randomAddress();
      await scanToken(scanner, token, 30);
      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);
      await cert.connect(project1).certify(token);

      const data = await cert.getCertification(token);
      expect(data.token).to.equal(token);
      expect(data.certifiedTo).to.equal(project1.address);
      expect(data.riskScoreAtCert).to.equal(30);
    });

    it("should mint certification NFT to the caller", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = randomAddress();
      await scanToken(scanner, token, 25);
      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);
      await cert.connect(project1).certify(token);

      expect(await cert.balanceOf(project1.address)).to.equal(1);
    });

    it("should reject certifying unscanned token", async function () {
      const { cert, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = randomAddress();
      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);

      await expect(cert.connect(project1).certify(token))
        .to.be.revertedWithCustomError(cert, "TokenNotScanned");
    });

    it("should reject certifying unsafe token", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = randomAddress();
      await scanToken(scanner, token, 85); // High risk

      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);
      await expect(cert.connect(project1).certify(token))
        .to.be.revertedWithCustomError(cert, "TokenNotSafe");
    });

    it("should reject certifying honeypot token", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = randomAddress();
      await scanToken(scanner, token, 20, true); // Low score but honeypot

      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);
      await expect(cert.connect(project1).certify(token))
        .to.be.revertedWithCustomError(cert, "TokenNotSafe");
    });

    it("should reject duplicate certification", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = await certifyToken(cert, scanner, uniq, project1);

      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);
      await expect(cert.connect(project1).certify(token))
        .to.be.revertedWithCustomError(cert, "AlreadyCertified");
    });

    it("should reject zero address token", async function () {
      const { cert, uniq, project1 } = await loadFixture(deployCertFixture);
      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);
      await expect(cert.connect(project1).certify(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(cert, "ZeroAddress");
    });

    it("should allow certifying with zero fee", async function () {
      const { cert, scanner, uniq, owner, project1 } = await loadFixture(deployCertFixture);
      await cert.setCertificationFee(0);

      const token = randomAddress();
      await scanToken(scanner, token, 25);
      await cert.connect(project1).certify(token);

      expect(await cert.isCertified(token)).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                     REVOCATION
  // ═══════════════════════════════════════════════════════════

  describe("Revocation", function () {
    it("should revoke certification when token becomes unsafe", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = await certifyToken(cert, scanner, uniq, project1);

      // Re-scan with high risk (overwrite existing scan)
      await scanToken(scanner, token, 85);

      await expect(cert.revokeCertification(token))
        .to.emit(cert, "CertificationRevoked");

      expect(await cert.isCertified(token)).to.be.false;
      expect(await cert.activeCertifications()).to.equal(0);
    });

    it("should revoke when scan data becomes stale", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = await certifyToken(cert, scanner, uniq, project1);

      // Advance past staleness threshold (24h)
      await time.increase(24 * 60 * 60 + 1);

      // Token is no longer safe (stale data)
      await cert.revokeCertification(token);
      expect(await cert.isCertified(token)).to.be.false;
    });

    it("should reject revocation of still-safe token", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = await certifyToken(cert, scanner, uniq, project1);

      await expect(cert.revokeCertification(token))
        .to.be.revertedWithCustomError(cert, "CertificationStillValid");
    });

    it("should reject revocation of non-certified token", async function () {
      const { cert } = await loadFixture(deployCertFixture);
      await expect(cert.revokeCertification(randomAddress()))
        .to.be.revertedWithCustomError(cert, "NotCertified");
    });

    it("should burn the NFT on revocation", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = await certifyToken(cert, scanner, uniq, project1);
      expect(await cert.balanceOf(project1.address)).to.equal(1);

      await scanToken(scanner, token, 80);
      await cert.revokeCertification(token);

      expect(await cert.balanceOf(project1.address)).to.equal(0);
    });

    it("should allow admin to force-revoke", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = await certifyToken(cert, scanner, uniq, project1);

      await expect(cert.adminRevoke(token, "Suspicious activity"))
        .to.emit(cert, "CertificationRevoked");

      expect(await cert.isCertified(token)).to.be.false;
    });

    it("should reject admin revoke by non-owner", async function () {
      const { cert, scanner, uniq, project1, project2 } = await loadFixture(deployCertFixture);
      const token = await certifyToken(cert, scanner, uniq, project1);

      await expect(cert.connect(project2).adminRevoke(token, "Attempted revoke"))
        .to.be.revertedWithCustomError(cert, "OwnableUnauthorizedAccount");
    });

    it("should allow re-certification after revocation", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = await certifyToken(cert, scanner, uniq, project1);

      // Revoke via admin
      await cert.adminRevoke(token, "Test revoke");
      expect(await cert.isCertified(token)).to.be.false;

      // Re-scan as safe and re-certify
      await scanToken(scanner, token, 20);
      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);
      await cert.connect(project1).certify(token);
      expect(await cert.isCertified(token)).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                    NON-TRANSFERABLE
  // ═══════════════════════════════════════════════════════════

  describe("Soulbound (Non-Transferable)", function () {
    it("should reject transfer between accounts", async function () {
      const { cert, scanner, uniq, project1, project2 } = await loadFixture(deployCertFixture);
      const token = await certifyToken(cert, scanner, uniq, project1);
      const certId = await cert.tokenCertId(token);

      await expect(
        cert.connect(project1).transferFrom(project1.address, project2.address, certId)
      ).to.be.revertedWith("Certification: non-transferable");
    });

    it("should allow minting (from zero address)", async function () {
      const { cert, scanner, uniq, project1 } = await loadFixture(deployCertFixture);
      const token = randomAddress();
      await scanToken(scanner, token, 25);
      await uniq.connect(project1).approve(await cert.getAddress(), CERT_FEE);

      // Should not revert — minting is allowed
      await cert.connect(project1).certify(token);
      expect(await cert.balanceOf(project1.address)).to.equal(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                    ADMIN FUNCTIONS
  // ═══════════════════════════════════════════════════════════

  describe("Admin", function () {
    it("should allow owner to update certification fee", async function () {
      const { cert } = await loadFixture(deployCertFixture);
      const newFee = ethers.parseEther("50000");
      await expect(cert.setCertificationFee(newFee))
        .to.emit(cert, "CertificationFeeUpdated")
        .withArgs(CERT_FEE, newFee);
      expect(await cert.certificationFee()).to.equal(newFee);
    });

    it("should allow owner to withdraw fees", async function () {
      const { cert, scanner, uniq, owner, project1 } = await loadFixture(deployCertFixture);
      await certifyToken(cert, scanner, uniq, project1);

      const ownerBalBefore = await uniq.balanceOf(owner.address);
      await cert.withdrawFees();
      const ownerBalAfter = await uniq.balanceOf(owner.address);
      expect(ownerBalAfter - ownerBalBefore).to.equal(CERT_FEE);
    });

    it("should reject withdraw when no fees", async function () {
      const { cert } = await loadFixture(deployCertFixture);
      await expect(cert.withdrawFees()).to.be.revertedWith("No fees");
    });

    it("should reject fee update by non-owner", async function () {
      const { cert, project1 } = await loadFixture(deployCertFixture);
      await expect(cert.connect(project1).setCertificationFee(0))
        .to.be.revertedWithCustomError(cert, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                    MULTIPLE CERTS
  // ═══════════════════════════════════════════════════════════

  describe("Multiple Certifications", function () {
    it("should certify multiple tokens independently", async function () {
      const { cert, scanner, uniq, project1, project2 } = await loadFixture(deployCertFixture);

      const token1 = await certifyToken(cert, scanner, uniq, project1);
      const token2 = await certifyToken(cert, scanner, uniq, project2);

      expect(await cert.isCertified(token1)).to.be.true;
      expect(await cert.isCertified(token2)).to.be.true;
      expect(await cert.activeCertifications()).to.equal(2);
    });

    it("should maintain correct count after revocation", async function () {
      const { cert, scanner, uniq, project1, project2 } = await loadFixture(deployCertFixture);

      const token1 = await certifyToken(cert, scanner, uniq, project1);
      await certifyToken(cert, scanner, uniq, project2);
      expect(await cert.activeCertifications()).to.equal(2);

      await cert.adminRevoke(token1, "Test");
      expect(await cert.activeCertifications()).to.equal(1);
    });
  });
});
