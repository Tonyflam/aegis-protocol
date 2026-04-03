import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("AegisScanner", function () {
  async function deployScannerFixture() {
    const [owner, scanner1, scanner2, user1] = await ethers.getSigners();

    const Scanner = await ethers.getContractFactory("AegisScanner");
    const aegisScanner = await Scanner.deploy();

    // Authorize scanner1
    await aegisScanner.setScannerAuthorization(scanner1.address, true);

    return { aegisScanner, owner, scanner1, scanner2, user1 };
  }

  // Helper: generate a random token-like address
  function randomAddress() {
    return ethers.Wallet.createRandom().address;
  }

  // Standard bool flags: [honeypot, canMint, canPause, canBlacklist, renounced, lpLocked, verified]
  const SAFE_FLAGS: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [false, false, false, false, true, true, true];
  const HONEYPOT_FLAGS: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [true, true, true, true, false, false, false];
  const RISKY_FLAGS: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [false, true, true, false, false, false, false];

  // Reasoning hash for V2 tests
  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmSampleAnalysis"));
  const ZERO_HASH = ethers.ZeroHash;

  // ═══════════════════════════════════════════════════════════
  //                      DEPLOYMENT
  // ═══════════════════════════════════════════════════════════

  describe("Deployment", function () {
    it("should set correct owner", async function () {
      const { aegisScanner, owner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.owner()).to.equal(owner.address);
    });

    it("should authorize owner as scanner by default", async function () {
      const { aegisScanner, owner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.authorizedScanners(owner.address)).to.be.true;
    });

    it("should start with zero scans", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.totalScans()).to.equal(0);
      expect(await aegisScanner.getScannedTokenCount()).to.equal(0);
    });

    it("should start with zero honeypots and rug risks", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.totalHoneypots()).to.equal(0);
      expect(await aegisScanner.totalRugRisks()).to.equal(0);
    });

    it("should set default staleness threshold to 24 hours", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.stalenessThreshold()).to.equal(24 * 60 * 60);
    });

    it("should expose RISK_THRESHOLD as 70", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.RISK_THRESHOLD()).to.equal(70);
    });

    it("should expose MAX_BATCH_SIZE as 100", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.MAX_BATCH_SIZE()).to.equal(100);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                  SCANNER AUTHORIZATION
  // ═══════════════════════════════════════════════════════════

  describe("Scanner Authorization", function () {
    it("should allow owner to authorize a scanner", async function () {
      const { aegisScanner, scanner2 } = await loadFixture(deployScannerFixture);
      await aegisScanner.setScannerAuthorization(scanner2.address, true);
      expect(await aegisScanner.authorizedScanners(scanner2.address)).to.be.true;
    });

    it("should allow owner to revoke a scanner", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      await aegisScanner.setScannerAuthorization(scanner1.address, false);
      expect(await aegisScanner.authorizedScanners(scanner1.address)).to.be.false;
    });

    it("should emit ScannerAuthorized event", async function () {
      const { aegisScanner, scanner2 } = await loadFixture(deployScannerFixture);
      await expect(aegisScanner.setScannerAuthorization(scanner2.address, true))
        .to.emit(aegisScanner, "ScannerAuthorized")
        .withArgs(scanner2.address, true);
    });

    it("should reject non-owner authorization", async function () {
      const { aegisScanner, scanner1, scanner2 } = await loadFixture(deployScannerFixture);
      await expect(
        aegisScanner.connect(scanner1).setScannerAuthorization(scanner2.address, true)
      ).to.be.revertedWithCustomError(aegisScanner, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════
  //              SUBMIT SCAN (LEGACY 9-ARG)
  // ═══════════════════════════════════════════════════════════

  describe("Submit Scan (legacy)", function () {
    it("should accept a valid scan from authorized scanner", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
          token, 25, ethers.parseEther("50000"), 1500, 1200, 300, 300, SAFE_FLAGS, "VERIFIED"
        )
      ).to.emit(aegisScanner, "TokenScanned");
    });

    it("should reject scan from unauthorized address", async function () {
      const { aegisScanner, user1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(user1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
          token, 25, ethers.parseEther("50000"), 1500, 1200, 300, 300, SAFE_FLAGS, ""
        )
      ).to.be.revertedWithCustomError(aegisScanner, "NotAuthorizedScanner");
    });

    it("should reject zero address token", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
          ethers.ZeroAddress, 25, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
        )
      ).to.be.revertedWithCustomError(aegisScanner, "InvalidToken");
    });

    it("should reject risk score > 100", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
          token, 101, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
        )
      ).to.be.revertedWithCustomError(aegisScanner, "InvalidRiskScore");
    });

    it("should reject topHolderPercent > 10000", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
          token, 50, 0, 0, 10001, 0, 0, SAFE_FLAGS, ""
        )
      ).to.be.revertedWithCustomError(aegisScanner, "InvalidBasisPoints");
    });

    it("should store all scan fields correctly", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 35, ethers.parseEther("25000"), 800, 2500, 500, 700, RISKY_FLAGS, "MINT_FUNCTION,PAUSE_FUNCTION"
      );

      const scan = await aegisScanner.getTokenScan(token);
      expect(scan.token).to.equal(token);
      expect(scan.riskScore).to.equal(35);
      expect(scan.liquidity).to.equal(ethers.parseEther("25000"));
      expect(scan.holderCount).to.equal(800);
      expect(scan.topHolderPercent).to.equal(2500);
      expect(scan.buyTax).to.equal(500);
      expect(scan.sellTax).to.equal(700);
      expect(scan.isHoneypot).to.be.false;
      expect(scan.ownerCanMint).to.be.true;
      expect(scan.ownerCanPause).to.be.true;
      expect(scan.ownerCanBlacklist).to.be.false;
      expect(scan.isContractRenounced).to.be.false;
      expect(scan.isLiquidityLocked).to.be.false;
      expect(scan.isVerified).to.be.false;
      expect(scan.scannedBy).to.equal(scanner1.address);
      expect(scan.flags).to.equal("MINT_FUNCTION,PAUSE_FUNCTION");
      expect(scan.reasoningHash).to.equal(ZERO_HASH); // legacy → zero hash
      expect(scan.scanVersion).to.equal(1);
    });

    it("should overwrite previous scan for same token", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 80, 0, 10, 5000, 0, 0, HONEYPOT_FLAGS, "HONEYPOT"
      );
      expect(await aegisScanner.getTokenRiskScore(token)).to.equal(80);

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 20, ethers.parseEther("100000"), 5000, 500, 100, 100, SAFE_FLAGS, "VERIFIED"
      );
      expect(await aegisScanner.getTokenRiskScore(token)).to.equal(20);
    });

    it("should increment totalScans on each scan", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      for (let i = 0; i < 3; i++) {
        await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
          randomAddress(), 10 + i, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
        );
      }
      expect(await aegisScanner.totalScans()).to.equal(3);
    });

    it("should track unique token count correctly on rescan", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](token, 30, 0, 0, 0, 0, 0, SAFE_FLAGS, "");
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](token, 40, 0, 0, 0, 0, 0, SAFE_FLAGS, "");

      expect(await aegisScanner.totalScans()).to.equal(2);
      expect(await aegisScanner.getScannedTokenCount()).to.equal(1);
    });

    it("should increment honeypot counter", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        randomAddress(), 100, 0, 0, 0, 0, 0, HONEYPOT_FLAGS, "HONEYPOT"
      );
      expect(await aegisScanner.totalHoneypots()).to.equal(1);
    });

    it("should increment rug risk counter for score >= 70", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        randomAddress(), 70, 0, 0, 0, 0, 0, RISKY_FLAGS, "RUG_PULL_RISK"
      );
      expect(await aegisScanner.totalRugRisks()).to.equal(1);
    });

    it("should not increment rug risk counter for score < 70", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        randomAddress(), 69, 0, 0, 0, 0, 0, RISKY_FLAGS, ""
      );
      expect(await aegisScanner.totalRugRisks()).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //          SUBMIT SCAN V2 (10-ARG WITH REASONING HASH)
  // ═══════════════════════════════════════════════════════════

  describe("Submit Scan V2 (with reasoningHash)", function () {
    it("should store reasoningHash correctly", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
        token, 25, ethers.parseEther("50000"), 1500, 1200, 300, 300, SAFE_FLAGS, "VERIFIED", SAMPLE_HASH
      );

      const scan = await aegisScanner.getTokenScan(token);
      expect(scan.reasoningHash).to.equal(SAMPLE_HASH);
    });

    it("should increment scanVersion on each rescan", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
        token, 25, 0, 0, 0, 0, 0, SAFE_FLAGS, "", SAMPLE_HASH
      );
      expect((await aegisScanner.getTokenScan(token)).scanVersion).to.equal(1);

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
        token, 30, 0, 0, 0, 0, 0, SAFE_FLAGS, "", SAMPLE_HASH
      );
      expect((await aegisScanner.getTokenScan(token)).scanVersion).to.equal(2);

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
        token, 35, 0, 0, 0, 0, 0, SAFE_FLAGS, "", SAMPLE_HASH
      );
      expect((await aegisScanner.getTokenScan(token)).scanVersion).to.equal(3);
    });

    it("should emit TokenRiskUpdated with reasoningHash", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
          token, 45, ethers.parseEther("10000"), 500, 3000, 200, 300, SAFE_FLAGS, "", SAMPLE_HASH
        )
      )
        .to.emit(aegisScanner, "TokenRiskUpdated")
        .withArgs(token, 45, scanner1.address, SAMPLE_HASH, (v: bigint) => v > 0n);
    });

    it("should reject scan from unauthorized address", async function () {
      const { aegisScanner, user1 } = await loadFixture(deployScannerFixture);

      await expect(
        aegisScanner.connect(user1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
          randomAddress(), 25, 0, 0, 0, 0, 0, SAFE_FLAGS, "", SAMPLE_HASH
        )
      ).to.be.revertedWithCustomError(aegisScanner, "NotAuthorizedScanner");
    });

    it("should reject zero address token", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
          ethers.ZeroAddress, 25, 0, 0, 0, 0, 0, SAFE_FLAGS, "", SAMPLE_HASH
        )
      ).to.be.revertedWithCustomError(aegisScanner, "InvalidToken");
    });

    it("should reject risk score > 100", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
          randomAddress(), 101, 0, 0, 0, 0, 0, SAFE_FLAGS, "", SAMPLE_HASH
        )
      ).to.be.revertedWithCustomError(aegisScanner, "InvalidRiskScore");
    });
  });

  // ═══════════════════════════════════════════════════════════
  //            LEGACY VIEW FUNCTIONS (backward compat)
  // ═══════════════════════════════════════════════════════════

  describe("Legacy View Functions", function () {
    it("getTokenRiskScore should return correct score", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 55, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
      );
      expect(await aegisScanner.getTokenRiskScore(token)).to.equal(55);
    });

    it("isHoneypot should return correct status", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const safe = randomAddress();
      const honeypot = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](safe, 10, 0, 0, 0, 0, 0, SAFE_FLAGS, "");
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](honeypot, 100, 0, 0, 0, 0, 0, HONEYPOT_FLAGS, "HONEYPOT");

      expect(await aegisScanner.isHoneypot(safe)).to.be.false;
      expect(await aegisScanner.isHoneypot(honeypot)).to.be.true;
    });

    it("isScanned should return false for unscanned token", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.isScanned(randomAddress())).to.be.false;
    });

    it("isScanned should return true after scan", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](token, 10, 0, 0, 0, 0, 0, SAFE_FLAGS, "");
      expect(await aegisScanner.isScanned(token)).to.be.true;
    });

    it("getRecentScans should return most recent first", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const tokens = [randomAddress(), randomAddress(), randomAddress()];

      for (let i = 0; i < 3; i++) {
        await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
          tokens[i], (i + 1) * 10, 0, 0, 0, 0, 0, SAFE_FLAGS, `TOKEN_${i}`
        );
      }

      const recent = await aegisScanner.getRecentScans(3);
      expect(recent.length).to.equal(3);
      // Most recent first
      expect(recent[0].token).to.equal(tokens[2]);
      expect(recent[1].token).to.equal(tokens[1]);
      expect(recent[2].token).to.equal(tokens[0]);
    });

    it("getRecentScans should handle count > total", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        randomAddress(), 10, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
      );

      const recent = await aegisScanner.getRecentScans(100);
      expect(recent.length).to.equal(1);
    });

    it("getScannerStats should return correct totals", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      // Submit: 1 safe, 1 honeypot, 1 risky (score 75)
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](randomAddress(), 10, 0, 0, 0, 0, 0, SAFE_FLAGS, "");
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](randomAddress(), 100, 0, 0, 0, 0, 0, HONEYPOT_FLAGS, "HONEYPOT");
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](randomAddress(), 75, 0, 0, 0, 0, 0, RISKY_FLAGS, "RUG_PULL_RISK");

      const [totalScans, totalHoneypots, totalRugRisks, totalTokens] = await aegisScanner.getScannerStats();
      expect(totalScans).to.equal(3);
      expect(totalHoneypots).to.equal(1);
      expect(totalRugRisks).to.equal(2); // honeypot (100 >= 70) + risky (75 >= 70)
      expect(totalTokens).to.equal(3);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                   EVENT EMISSION
  // ═══════════════════════════════════════════════════════════

  describe("Event Emission", function () {
    it("should emit TokenScanned with correct params (legacy)", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
          token, 45, ethers.parseEther("10000"), 500, 3000, 200, 300, SAFE_FLAGS, "LIMITED_LIQUIDITY"
        )
      )
        .to.emit(aegisScanner, "TokenScanned")
        .withArgs(token, 45, false, ethers.parseEther("10000"), scanner1.address, (v: bigint) => v > 0n);
    });

    it("should emit both TokenScanned and TokenRiskUpdated on legacy submit", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      const tx = aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 50, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
      );
      await expect(tx).to.emit(aegisScanner, "TokenScanned");
      await expect(tx).to.emit(aegisScanner, "TokenRiskUpdated").withArgs(token, 50, scanner1.address, ZERO_HASH, (v: bigint) => v > 0n);
    });

    it("should emit both events on V2 submit", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      const tx = aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
        token, 50, 0, 0, 0, 0, 0, SAFE_FLAGS, "", SAMPLE_HASH
      );
      await expect(tx).to.emit(aegisScanner, "TokenScanned");
      await expect(tx).to.emit(aegisScanner, "TokenRiskUpdated").withArgs(token, 50, scanner1.address, SAMPLE_HASH, (v: bigint) => v > 0n);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //           ORACLE INTERFACE — getTokenRisk()
  // ═══════════════════════════════════════════════════════════

  describe("Oracle: getTokenRisk", function () {
    it("should return zero data for unscanned token", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      const data = await aegisScanner.getTokenRisk(randomAddress());
      expect(data.riskScore).to.equal(0);
      expect(data.lastUpdated).to.equal(0);
      expect(data.attestedBy).to.equal(ethers.ZeroAddress);
      expect(data.reasoningHash).to.equal(ZERO_HASH);
    });

    it("should return correct risk data after scan", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
        token, 42, ethers.parseEther("75000"), 2000, 800, 100, 200, SAFE_FLAGS, "", SAMPLE_HASH
      );

      const data = await aegisScanner.getTokenRisk(token);
      expect(data.riskScore).to.equal(42);
      expect(data.lastUpdated).to.be.gt(0);
      expect(data.attestedBy).to.equal(scanner1.address);
      expect(data.reasoningHash).to.equal(SAMPLE_HASH);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //           ORACLE INTERFACE — isTokenSafe()
  // ═══════════════════════════════════════════════════════════

  describe("Oracle: isTokenSafe", function () {
    it("should return false for unscanned token", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.isTokenSafe(randomAddress())).to.be.false;
    });

    it("should return true for fresh safe scan", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 30, ethers.parseEther("50000"), 1000, 500, 100, 100, SAFE_FLAGS, ""
      );
      expect(await aegisScanner.isTokenSafe(token)).to.be.true;
    });

    it("should return false for high risk score (>= 70)", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 70, ethers.parseEther("50000"), 1000, 500, 100, 100, SAFE_FLAGS, ""
      );
      expect(await aegisScanner.isTokenSafe(token)).to.be.false;
    });

    it("should return true for score just below threshold (69)", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 69, ethers.parseEther("50000"), 1000, 500, 100, 100, SAFE_FLAGS, ""
      );
      expect(await aegisScanner.isTokenSafe(token)).to.be.true;
    });

    it("should return false for honeypot (even with low score)", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      // Honeypot with low risk score — still unsafe
      const honeypotLow: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [true, false, false, false, true, true, true];
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 10, ethers.parseEther("100000"), 5000, 200, 0, 0, honeypotLow, ""
      );
      expect(await aegisScanner.isTokenSafe(token)).to.be.false;
    });

    it("should return false for stale scan (> 24h)", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 10, ethers.parseEther("50000"), 1000, 500, 100, 100, SAFE_FLAGS, ""
      );
      expect(await aegisScanner.isTokenSafe(token)).to.be.true;

      // Advance time past staleness threshold (24h + 1s)
      await time.increase(24 * 60 * 60 + 1);

      expect(await aegisScanner.isTokenSafe(token)).to.be.false;
    });

    it("should return true at exactly 24h (not stale yet)", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 10, ethers.parseEther("50000"), 1000, 500, 100, 100, SAFE_FLAGS, ""
      );

      // Advance time to exactly staleness threshold
      await time.increase(24 * 60 * 60);

      expect(await aegisScanner.isTokenSafe(token)).to.be.true;
    });

    it("should become safe again after rescan refreshes timestamp", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 10, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
      );

      // Go stale
      await time.increase(25 * 60 * 60);
      expect(await aegisScanner.isTokenSafe(token)).to.be.false;

      // Rescan
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 10, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
      );
      expect(await aegisScanner.isTokenSafe(token)).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════
  //           ORACLE INTERFACE — getTokenFlags()
  // ═══════════════════════════════════════════════════════════

  describe("Oracle: getTokenFlags", function () {
    it("should return all-false flags for safe verified token", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 10, ethers.parseEther("50000"), 5000, 1000, 100, 100, SAFE_FLAGS, ""
      );

      const flags = await aegisScanner.getTokenFlags(token);
      expect(flags.isHoneypot).to.be.false;
      expect(flags.hasHighTax).to.be.false;       // 1% buy + 1% sell < 10%
      expect(flags.isUnverified).to.be.false;      // isVerified = true
      expect(flags.hasConcentratedOwnership).to.be.false; // 10% < 50%
      expect(flags.hasLowLiquidity).to.be.false;   // $50K > $10K
    });

    it("should detect honeypot flag", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 100, ethers.parseEther("50000"), 100, 1000, 0, 0, HONEYPOT_FLAGS, ""
      );

      expect((await aegisScanner.getTokenFlags(token)).isHoneypot).to.be.true;
    });

    it("should detect high tax (buyTax > 10%)", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      // buyTax = 1001 bps (10.01%), sellTax = 100 bps (1%)
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 50, ethers.parseEther("50000"), 1000, 1000, 1001, 100, SAFE_FLAGS, ""
      );

      expect((await aegisScanner.getTokenFlags(token)).hasHighTax).to.be.true;
    });

    it("should detect high tax (sellTax > 10%)", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      // buyTax = 100 bps (1%), sellTax = 1500 bps (15%)
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 50, ethers.parseEther("50000"), 1000, 1000, 100, 1500, SAFE_FLAGS, ""
      );

      expect((await aegisScanner.getTokenFlags(token)).hasHighTax).to.be.true;
    });

    it("should not flag exactly 10% tax as high", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      // buyTax = 1000 bps (exactly 10%)
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 50, ethers.parseEther("50000"), 1000, 1000, 1000, 1000, SAFE_FLAGS, ""
      );

      expect((await aegisScanner.getTokenFlags(token)).hasHighTax).to.be.false;
    });

    it("should detect unverified contract", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      // isVerified = false (RISKY_FLAGS has verified=false at index 6)
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 50, ethers.parseEther("50000"), 1000, 1000, 100, 100, RISKY_FLAGS, ""
      );

      expect((await aegisScanner.getTokenFlags(token)).isUnverified).to.be.true;
    });

    it("should detect concentrated ownership (> 50%)", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      // topHolderPercent = 5001 bps (50.01%)
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 50, ethers.parseEther("50000"), 1000, 5001, 100, 100, SAFE_FLAGS, ""
      );

      expect((await aegisScanner.getTokenFlags(token)).hasConcentratedOwnership).to.be.true;
    });

    it("should not flag exactly 50% as concentrated", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      // topHolderPercent = 5000 bps (exactly 50%)
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 50, ethers.parseEther("50000"), 1000, 5000, 100, 100, SAFE_FLAGS, ""
      );

      expect((await aegisScanner.getTokenFlags(token)).hasConcentratedOwnership).to.be.false;
    });

    it("should detect low liquidity (< $10K)", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      // liquidity = 9999e18 ($9,999)
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 50, ethers.parseEther("9999"), 1000, 1000, 100, 100, SAFE_FLAGS, ""
      );

      expect((await aegisScanner.getTokenFlags(token)).hasLowLiquidity).to.be.true;
    });

    it("should not flag exactly $10K as low liquidity", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      // liquidity = 10000e18 (exactly $10K)
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 50, ethers.parseEther("10000"), 1000, 1000, 100, 100, SAFE_FLAGS, ""
      );

      expect((await aegisScanner.getTokenFlags(token)).hasLowLiquidity).to.be.false;
    });
  });

  // ═══════════════════════════════════════════════════════════
  //           ORACLE INTERFACE — BATCH QUERIES
  // ═══════════════════════════════════════════════════════════

  describe("Oracle: Batch Queries", function () {
    it("getTokenRiskBatch should return data for multiple tokens", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const tokens = [randomAddress(), randomAddress(), randomAddress()];

      for (let i = 0; i < 3; i++) {
        await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
          tokens[i], (i + 1) * 20, 0, 0, 0, 0, 0, SAFE_FLAGS, "", SAMPLE_HASH
        );
      }

      const data = await aegisScanner.getTokenRiskBatch(tokens);
      expect(data.length).to.equal(3);
      expect(data[0].riskScore).to.equal(20);
      expect(data[1].riskScore).to.equal(40);
      expect(data[2].riskScore).to.equal(60);
      expect(data[0].attestedBy).to.equal(scanner1.address);
    });

    it("getTokenRiskBatch should return zeros for unscanned tokens", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      const tokens = [randomAddress(), randomAddress()];

      const data = await aegisScanner.getTokenRiskBatch(tokens);
      expect(data[0].riskScore).to.equal(0);
      expect(data[0].lastUpdated).to.equal(0);
      expect(data[1].riskScore).to.equal(0);
    });

    it("getTokenRiskBatch should handle empty array", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      const data = await aegisScanner.getTokenRiskBatch([]);
      expect(data.length).to.equal(0);
    });

    it("getTokenRiskBatch should revert if > MAX_BATCH_SIZE", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      const tokens = Array.from({ length: 101 }, () => randomAddress());

      await expect(aegisScanner.getTokenRiskBatch(tokens))
        .to.be.revertedWithCustomError(aegisScanner, "BatchTooLarge");
    });

    it("isTokenSafeBatch should return correct results", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const safeToken = randomAddress();
      const riskyToken = randomAddress();
      const unscannedToken = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        safeToken, 30, ethers.parseEther("50000"), 1000, 500, 100, 100, SAFE_FLAGS, ""
      );
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        riskyToken, 85, 0, 0, 0, 0, 0, RISKY_FLAGS, ""
      );

      const results = await aegisScanner.isTokenSafeBatch([safeToken, riskyToken, unscannedToken]);
      expect(results[0]).to.be.true;   // safe
      expect(results[1]).to.be.false;  // high risk score
      expect(results[2]).to.be.false;  // unscanned
    });

    it("isTokenSafeBatch should respect staleness", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 10, ethers.parseEther("50000"), 1000, 500, 100, 100, SAFE_FLAGS, ""
      );

      let results = await aegisScanner.isTokenSafeBatch([token]);
      expect(results[0]).to.be.true;

      await time.increase(25 * 60 * 60); // 25 hours

      results = await aegisScanner.isTokenSafeBatch([token]);
      expect(results[0]).to.be.false;
    });

    it("isTokenSafeBatch should revert if > MAX_BATCH_SIZE", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      const tokens = Array.from({ length: 101 }, () => randomAddress());

      await expect(aegisScanner.isTokenSafeBatch(tokens))
        .to.be.revertedWithCustomError(aegisScanner, "BatchTooLarge");
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                   ADMIN FUNCTIONS
  // ═══════════════════════════════════════════════════════════

  describe("Admin: Staleness Threshold", function () {
    it("should allow owner to update staleness threshold", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      await aegisScanner.setStalenessThreshold(12 * 60 * 60); // 12 hours
      expect(await aegisScanner.stalenessThreshold()).to.equal(12 * 60 * 60);
    });

    it("should reject staleness threshold below 1 hour", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      await expect(aegisScanner.setStalenessThreshold(3599))
        .to.be.revertedWith("Threshold out of range");
    });

    it("should reject staleness threshold above 7 days", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      await expect(aegisScanner.setStalenessThreshold(7 * 24 * 60 * 60 + 1))
        .to.be.revertedWith("Threshold out of range");
    });

    it("should accept boundary values (1 hour and 7 days)", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      await aegisScanner.setStalenessThreshold(3600); // 1 hour
      expect(await aegisScanner.stalenessThreshold()).to.equal(3600);

      await aegisScanner.setStalenessThreshold(7 * 24 * 60 * 60); // 7 days
      expect(await aegisScanner.stalenessThreshold()).to.equal(7 * 24 * 60 * 60);
    });

    it("should reject non-owner", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      await expect(
        aegisScanner.connect(scanner1).setStalenessThreshold(12 * 60 * 60)
      ).to.be.revertedWithCustomError(aegisScanner, "OwnableUnauthorizedAccount");
    });

    it("updated threshold should affect isTokenSafe", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 10, ethers.parseEther("50000"), 1000, 500, 100, 100, SAFE_FLAGS, ""
      );

      // Shorten staleness to 1 hour
      await aegisScanner.setStalenessThreshold(3600);

      // Advance 2 hours — now stale
      await time.increase(2 * 60 * 60);
      expect(await aegisScanner.isTokenSafe(token)).to.be.false;
    });
  });

  describe("Admin: Pause", function () {
    it("should allow owner to pause", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      await aegisScanner.pause();
      expect(await aegisScanner.paused()).to.be.true;
    });

    it("should block submissions when paused", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      await aegisScanner.pause();

      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
          randomAddress(), 10, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
        )
      ).to.be.revertedWithCustomError(aegisScanner, "EnforcedPause");
    });

    it("should block V2 submissions when paused", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      await aegisScanner.pause();

      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
          randomAddress(), 10, 0, 0, 0, 0, 0, SAFE_FLAGS, "", SAMPLE_HASH
        )
      ).to.be.revertedWithCustomError(aegisScanner, "EnforcedPause");
    });

    it("should allow reads when paused", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      // Submit before pause
      await aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
        token, 10, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
      );
      await aegisScanner.pause();

      // All reads should still work
      expect(await aegisScanner.getTokenRiskScore(token)).to.equal(10);
      expect(await aegisScanner.isScanned(token)).to.be.true;
      expect(await aegisScanner.isTokenSafe(token)).to.be.true;
      const data = await aegisScanner.getTokenRisk(token);
      expect(data.riskScore).to.equal(10);
    });

    it("should allow owner to unpause", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      await aegisScanner.pause();
      await aegisScanner.unpause();

      // Should work again
      await expect(
        aegisScanner.connect(scanner1)["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string)"](
          randomAddress(), 10, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
        )
      ).to.emit(aegisScanner, "TokenScanned");
    });

    it("should reject non-owner pause", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      await expect(
        aegisScanner.connect(scanner1).pause()
      ).to.be.revertedWithCustomError(aegisScanner, "OwnableUnauthorizedAccount");
    });
  });
});
