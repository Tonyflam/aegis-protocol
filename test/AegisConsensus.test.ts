import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("AegisConsensus", function () {
  const SCOUT_STAKE   = ethers.parseEther("10000");
  const GUARDIAN_STAKE = ethers.parseEther("100000");
  const SENTINEL_STAKE = ethers.parseEther("500000");
  const ARCHON_STAKE   = ethers.parseEther("1000000");
  const DISPUTE_STAKE  = ethers.parseEther("50000");

  // Standard bool flags: [honeypot, canMint, canPause, canBlacklist, renounced, lpLocked, verified]
  const SAFE_FLAGS: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] =
    [false, false, false, false, true, true, true];
  const HONEYPOT_FLAGS: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] =
    [true, true, true, true, false, false, false];

  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("ipfs://QmConsensusAnalysis"));

  function randomAddress() {
    return ethers.Wallet.createRandom().address;
  }

  async function deployConsensusFixture() {
    const [owner, agent1, agent2, agent3, agent4, agent5, user1] = await ethers.getSigners();

    // Deploy mock UNIQ
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const uniq = await MockERC20.deploy("Uniq Token", "UNIQ", ethers.parseEther("100000000"));

    // Deploy Staking
    const Staking = await ethers.getContractFactory("AegisStaking");
    const staking = await Staking.deploy(await uniq.getAddress());

    // Deploy Scanner
    const Scanner = await ethers.getContractFactory("AegisScanner");
    const scanner = await Scanner.deploy();

    // Deploy Consensus
    const Consensus = await ethers.getContractFactory("AegisConsensus");
    const consensus = await Consensus.deploy(await staking.getAddress(), await scanner.getAddress());

    // Authorize Consensus contract as a scanner on the AegisScanner
    await scanner.setScannerAuthorization(await consensus.getAddress(), true);

    // Distribute tokens and stake agents
    for (const agent of [agent1, agent2, agent3, agent4, agent5]) {
      await uniq.transfer(agent.address, ethers.parseEther("2000000"));
    }
    // Also give user1 tokens for dispute tests
    await uniq.transfer(user1.address, ethers.parseEther("500000"));

    return { consensus, staking, scanner, uniq, owner, agent1, agent2, agent3, agent4, agent5, user1 };
  }

  async function stakeAgent(staking: any, uniq: any, agent: any, amount: bigint) {
    await uniq.connect(agent).approve(await staking.getAddress(), amount);
    await staking.connect(agent).stake(amount);
  }

  async function submitSafeAttestation(consensus: any, agent: any, token: string, riskScore: number) {
    await consensus.connect(agent).submitAttestation(
      token,
      riskScore,
      ethers.parseEther("100"),  // liquidity
      500,                        // holderCount
      2000,                       // topHolderPercent (20%)
      300,                        // buyTax (3%)
      300,                        // sellTax (3%)
      SAFE_FLAGS,
      SAMPLE_HASH
    );
  }

  // ═══════════════════════════════════════════════════════════
  //                       DEPLOYMENT
  // ═══════════════════════════════════════════════════════════

  describe("Deployment", function () {
    it("should set correct owner", async function () {
      const { consensus, owner } = await loadFixture(deployConsensusFixture);
      expect(await consensus.owner()).to.equal(owner.address);
    });

    it("should reference staking contract", async function () {
      const { consensus, staking } = await loadFixture(deployConsensusFixture);
      expect(await consensus.staking()).to.equal(await staking.getAddress());
    });

    it("should reference scanner contract", async function () {
      const { consensus, scanner } = await loadFixture(deployConsensusFixture);
      expect(await consensus.scanner()).to.equal(await scanner.getAddress());
    });

    it("should start with zero counters", async function () {
      const { consensus } = await loadFixture(deployConsensusFixture);
      expect(await consensus.totalRounds()).to.equal(0);
      expect(await consensus.totalAttestations()).to.equal(0);
      expect(await consensus.totalFinalizations()).to.equal(0);
    });

    it("should have correct constants", async function () {
      const { consensus } = await loadFixture(deployConsensusFixture);
      expect(await consensus.MIN_ATTESTATIONS()).to.equal(3);
      expect(await consensus.OUTLIER_THRESHOLD()).to.equal(30);
      expect(await consensus.ROUND_TIMEOUT()).to.equal(24 * 60 * 60);
      expect(await consensus.DISPUTE_STAKE()).to.equal(DISPUTE_STAKE);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                     ATTESTATIONS
  // ═══════════════════════════════════════════════════════════

  describe("Attestations", function () {
    it("should accept attestation from staked agent", async function () {
      const { consensus, staking, uniq, agent1 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 25);

      expect(await consensus.totalAttestations()).to.equal(1);
      const round = await consensus.getActiveRound(token);
      expect(round.attestationCount).to.equal(1);
    });

    it("should create a new round on first attestation", async function () {
      const { consensus, staking, uniq, agent1 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 25);

      expect(await consensus.totalRounds()).to.equal(1);
      const round = await consensus.getActiveRound(token);
      expect(round.attestationCount).to.equal(1);
      expect(round.finalized).to.be.false;
    });

    it("should reject attestation from unstaked agent", async function () {
      const { consensus, agent1 } = await loadFixture(deployConsensusFixture);
      const token = randomAddress();

      await expect(submitSafeAttestation(consensus, agent1, token, 25))
        .to.be.revertedWithCustomError(consensus, "AgentNotStaked");
    });

    it("should reject duplicate attestation in same round", async function () {
      const { consensus, staking, uniq, agent1 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 25);
      await expect(submitSafeAttestation(consensus, agent1, token, 30))
        .to.be.revertedWithCustomError(consensus, "AlreadyAttested");
    });

    it("should reject invalid risk score (>100)", async function () {
      const { consensus, staking, uniq, agent1 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);

      await expect(consensus.connect(agent1).submitAttestation(
        randomAddress(), 101, ethers.parseEther("100"), 500, 2000, 300, 300, SAFE_FLAGS, SAMPLE_HASH
      )).to.be.revertedWithCustomError(consensus, "InvalidRiskScore");
    });

    it("should reject invalid basisPoints (>10000)", async function () {
      const { consensus, staking, uniq, agent1 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);

      await expect(consensus.connect(agent1).submitAttestation(
        randomAddress(), 50, ethers.parseEther("100"), 500, 10001, 300, 300, SAFE_FLAGS, SAMPLE_HASH
      )).to.be.revertedWithCustomError(consensus, "InvalidBasisPoints");
    });

    it("should reject zero address token", async function () {
      const { consensus, staking, uniq, agent1 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);

      await expect(submitSafeAttestation(consensus, agent1, ethers.ZeroAddress, 25))
        .to.be.revertedWithCustomError(consensus, "InvalidToken");
    });

    it("should accept multiple agents attesting same token", async function () {
      const { consensus, staking, uniq, agent1, agent2, agent3 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, GUARDIAN_STAKE);
      await stakeAgent(staking, uniq, agent3, SENTINEL_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 20);
      await submitSafeAttestation(consensus, agent2, token, 25);
      await submitSafeAttestation(consensus, agent3, token, 30);

      const round = await consensus.getActiveRound(token);
      expect(round.attestationCount).to.equal(3);
    });

    it("should track first-to-scan agent", async function () {
      const { consensus, staking, uniq, agent1, agent2 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 25);
      await submitSafeAttestation(consensus, agent2, token, 30);

      expect(await consensus.firstScanner(token)).to.equal(agent1.address);
    });

    it("should start new round after timeout", async function () {
      const { consensus, staking, uniq, agent1, agent2 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 25);
      expect(await consensus.totalRounds()).to.equal(1);

      // Advance past ROUND_TIMEOUT (24h)
      await time.increase(24 * 60 * 60 + 1);

      await submitSafeAttestation(consensus, agent2, token, 30);
      expect(await consensus.totalRounds()).to.equal(2);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                  CONSENSUS FINALIZATION
  // ═══════════════════════════════════════════════════════════

  describe("Consensus Finalization", function () {
    it("should finalize with 3 attestations (equal weight)", async function () {
      const { consensus, staking, scanner, uniq, agent1, agent2, agent3 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent3, SCOUT_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 20);
      await submitSafeAttestation(consensus, agent2, token, 25);
      await submitSafeAttestation(consensus, agent3, token, 30);

      await expect(consensus.finalizeConsensus(token))
        .to.emit(consensus, "ConsensusFinalized");

      // Weighted average: (20+25+30)/3 = 25
      const round = await consensus.getActiveRound(token);
      expect(round.finalized).to.be.true;
      expect(round.finalRiskScore).to.equal(25);

      // Check the scanner was updated
      const scannerRisk = await scanner.getTokenRisk(token);
      expect(scannerRisk.riskScore).to.equal(25);
    });

    it("should weight by stake tier", async function () {
      const { consensus, staking, scanner, uniq, agent1, agent2, agent3 } = await loadFixture(deployConsensusFixture);
      // Scout (1×), Guardian (3×), Archon (20×)
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, GUARDIAN_STAKE);
      await stakeAgent(staking, uniq, agent3, ARCHON_STAKE);
      const token = randomAddress();

      // Scout says 20, Guardian says 30, Archon says 50
      await submitSafeAttestation(consensus, agent1, token, 20);
      await submitSafeAttestation(consensus, agent2, token, 30);
      await submitSafeAttestation(consensus, agent3, token, 50);

      await consensus.finalizeConsensus(token);

      // Weighted: (20*10000 + 30*30000 + 50*200000) / (10000+30000+200000)
      // = (200000 + 900000 + 10000000) / 240000 = 11100000 / 240000 = 46.25 → 46
      const scannerRisk = await scanner.getTokenRisk(token);
      expect(scannerRisk.riskScore).to.equal(46);
    });

    it("should reject finalization with <3 attestations", async function () {
      const { consensus, staking, uniq, agent1, agent2 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 20);
      await submitSafeAttestation(consensus, agent2, token, 25);

      await expect(consensus.finalizeConsensus(token))
        .to.be.revertedWithCustomError(consensus, "NotEnoughAttestations");
    });

    it("should reject double finalization", async function () {
      const { consensus, staking, uniq, agent1, agent2, agent3 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent3, SCOUT_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 20);
      await submitSafeAttestation(consensus, agent2, token, 25);
      await submitSafeAttestation(consensus, agent3, token, 30);

      await consensus.finalizeConsensus(token);
      await expect(consensus.finalizeConsensus(token))
        .to.be.revertedWithCustomError(consensus, "RoundAlreadyFinalized");
    });

    it("should reject finalization for non-existent round", async function () {
      const { consensus } = await loadFixture(deployConsensusFixture);
      await expect(consensus.finalizeConsensus(randomAddress()))
        .to.be.revertedWithCustomError(consensus, "RoundNotActive");
    });

    it("should detect outliers (>30 point deviation from median)", async function () {
      const { consensus, staking, scanner, uniq, agent1, agent2, agent3 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent3, SCOUT_STAKE);
      const token = randomAddress();

      // Agent1: 20, Agent2: 25, Agent3: 80 (outlier — median is 25, deviation = 55)
      await submitSafeAttestation(consensus, agent1, token, 20);
      await submitSafeAttestation(consensus, agent2, token, 25);
      await submitSafeAttestation(consensus, agent3, token, 80);

      await expect(consensus.finalizeConsensus(token))
        .to.emit(consensus, "OutlierDetected")
        .withArgs(token, agent3.address, 80, 25);

      // Excluded outlier: average of (20+25)/2 = 22
      const scannerRisk = await scanner.getTokenRisk(token);
      expect(scannerRisk.riskScore).to.equal(22);
    });

    it("should handle all-outlier edge case (include everyone)", async function () {
      const { consensus, staking, scanner, uniq, agent1, agent2, agent3 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent3, SCOUT_STAKE);
      const token = randomAddress();

      // All widely spread: median=50, all deviate >30
      await submitSafeAttestation(consensus, agent1, token, 0);
      await submitSafeAttestation(consensus, agent2, token, 50);
      await submitSafeAttestation(consensus, agent3, token, 100);

      await consensus.finalizeConsensus(token);

      // Fallback: include all → (0+50+100)/3 = 50
      const scannerRisk = await scanner.getTokenRisk(token);
      expect(scannerRisk.riskScore).to.equal(50);
    });

    it("should resolve boolean flags by weighted majority", async function () {
      const { consensus, staking, scanner, uniq, agent1, agent2, agent3 } = await loadFixture(deployConsensusFixture);
      // Scout (1×), Scout (1×), Archon (20×) — Archon dominates
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent3, ARCHON_STAKE);
      const token = randomAddress();

      // Scout agents say honeypot=true, Archon says honeypot=false
      // Archon has 20× weight → honeypot should be false
      await consensus.connect(agent1).submitAttestation(
        token, 80, ethers.parseEther("1"), 10, 8000, 5000, 5000,
        [true, false, false, false, true, true, true], SAMPLE_HASH
      );
      await consensus.connect(agent2).submitAttestation(
        token, 75, ethers.parseEther("1"), 10, 8000, 5000, 5000,
        [true, false, false, false, true, true, true], SAMPLE_HASH
      );
      await consensus.connect(agent3).submitAttestation(
        token, 72, ethers.parseEther("1"), 10, 8000, 5000, 5000,
        [false, false, false, false, true, true, true], SAMPLE_HASH
      );

      await consensus.finalizeConsensus(token);

      // Archon weight (200000) > 2× Scout weight (2*10000 = 20000)
      // So honeypot=false wins the majority vote
      const flags = await scanner.getTokenFlags(token);
      expect(flags.isHoneypot).to.be.false;
    });

    it("should use highest-weight reasoning hash", async function () {
      const { consensus, staking, scanner, uniq, agent1, agent2, agent3 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, GUARDIAN_STAKE);
      await stakeAgent(staking, uniq, agent3, SCOUT_STAKE);
      const token = randomAddress();

      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("scout1"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("guardian"));
      const hash3 = ethers.keccak256(ethers.toUtf8Bytes("scout2"));

      await consensus.connect(agent1).submitAttestation(
        token, 30, ethers.parseEther("100"), 500, 2000, 300, 300, SAFE_FLAGS, hash1
      );
      await consensus.connect(agent2).submitAttestation(
        token, 35, ethers.parseEther("100"), 500, 2000, 300, 300, SAFE_FLAGS, hash2
      );
      await consensus.connect(agent3).submitAttestation(
        token, 25, ethers.parseEther("100"), 500, 2000, 300, 300, SAFE_FLAGS, hash3
      );

      await consensus.finalizeConsensus(token);

      // Guardian (3×) has highest weight → should use hash2
      const risk = await scanner.getTokenRisk(token);
      expect(risk.reasoningHash).to.equal(hash2);
    });

    it("should allow new round after finalization", async function () {
      const { consensus, staking, uniq, agent1, agent2, agent3 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent3, SCOUT_STAKE);
      const token = randomAddress();

      // Round 1
      await submitSafeAttestation(consensus, agent1, token, 20);
      await submitSafeAttestation(consensus, agent2, token, 25);
      await submitSafeAttestation(consensus, agent3, token, 30);
      await consensus.finalizeConsensus(token);

      // Round 2 — same agents can attest again
      await submitSafeAttestation(consensus, agent1, token, 15);
      expect(await consensus.totalRounds()).to.equal(2);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                     DISPUTE MECHANISM
  // ═══════════════════════════════════════════════════════════

  describe("Disputes", function () {
    async function finalizedRoundFixture() {
      const base = await deployConsensusFixture();
      const { consensus, staking, uniq, agent1, agent2, agent3 } = base;
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent3, SCOUT_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 20);
      await submitSafeAttestation(consensus, agent2, token, 25);
      await submitSafeAttestation(consensus, agent3, token, 30);
      await consensus.finalizeConsensus(token);

      return { ...base, token };
    }

    it("should allow staked agent to dispute finalized score", async function () {
      const { consensus, staking, uniq, agent4, token } = await loadFixture(finalizedRoundFixture);
      await stakeAgent(staking, uniq, agent4, SCOUT_STAKE);
      await uniq.connect(agent4).approve(await consensus.getAddress(), DISPUTE_STAKE);

      await expect(consensus.connect(agent4).disputeScore(token, 70))
        .to.emit(consensus, "DisputeCreated")
        .withArgs(token, agent4.address, 70);
    });

    it("should reject dispute from unstaked agent", async function () {
      const { consensus, user1, token } = await loadFixture(finalizedRoundFixture);
      await expect(consensus.connect(user1).disputeScore(token, 70))
        .to.be.revertedWithCustomError(consensus, "AgentNotStaked");
    });

    it("should reject dispute on non-finalized round", async function () {
      const { consensus, staking, uniq, agent4 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent4, SCOUT_STAKE);
      const token = randomAddress();

      await expect(consensus.connect(agent4).disputeScore(token, 70))
        .to.be.revertedWithCustomError(consensus, "RoundNotActive");
    });

    it("should reject duplicate dispute", async function () {
      const { consensus, staking, uniq, agent4, agent5, token } = await loadFixture(finalizedRoundFixture);
      await stakeAgent(staking, uniq, agent4, SCOUT_STAKE);
      await uniq.connect(agent4).approve(await consensus.getAddress(), DISPUTE_STAKE);
      await consensus.connect(agent4).disputeScore(token, 70);

      await stakeAgent(staking, uniq, agent5, SCOUT_STAKE);
      await uniq.connect(agent5).approve(await consensus.getAddress(), DISPUTE_STAKE);
      await expect(consensus.connect(agent5).disputeScore(token, 60))
        .to.be.revertedWithCustomError(consensus, "DisputeAlreadyActive");
    });

    it("should resolve dispute upheld — return stake to challenger", async function () {
      const { consensus, staking, uniq, owner, agent4, token } = await loadFixture(finalizedRoundFixture);
      await stakeAgent(staking, uniq, agent4, SCOUT_STAKE);
      await uniq.connect(agent4).approve(await consensus.getAddress(), DISPUTE_STAKE);
      await consensus.connect(agent4).disputeScore(token, 70);

      const balBefore = await uniq.balanceOf(agent4.address);
      await consensus.resolveDispute(token, true);
      const balAfter = await uniq.balanceOf(agent4.address);

      expect(balAfter - balBefore).to.equal(DISPUTE_STAKE);

      const dispute = await consensus.disputes(token);
      expect(dispute.resolved).to.be.true;
      expect(dispute.upheld).to.be.true;
    });

    it("should resolve dispute not upheld — stake goes to treasury", async function () {
      const { consensus, staking, uniq, owner, agent4, token } = await loadFixture(finalizedRoundFixture);
      await stakeAgent(staking, uniq, agent4, SCOUT_STAKE);
      await uniq.connect(agent4).approve(await consensus.getAddress(), DISPUTE_STAKE);
      await consensus.connect(agent4).disputeScore(token, 70);

      const ownerBalBefore = await uniq.balanceOf(owner.address);
      await consensus.resolveDispute(token, false);
      const ownerBalAfter = await uniq.balanceOf(owner.address);

      expect(ownerBalAfter - ownerBalBefore).to.equal(DISPUTE_STAKE);
    });

    it("should reject resolve by non-owner", async function () {
      const { consensus, staking, uniq, agent4, agent5, token } = await loadFixture(finalizedRoundFixture);
      await stakeAgent(staking, uniq, agent4, SCOUT_STAKE);
      await uniq.connect(agent4).approve(await consensus.getAddress(), DISPUTE_STAKE);
      await consensus.connect(agent4).disputeScore(token, 70);

      await expect(consensus.connect(agent5).resolveDispute(token, true))
        .to.be.revertedWithCustomError(consensus, "OwnableUnauthorizedAccount");
    });

    it("should reject resolving non-existent dispute", async function () {
      const { consensus } = await loadFixture(deployConsensusFixture);
      await expect(consensus.resolveDispute(randomAddress(), true))
        .to.be.revertedWithCustomError(consensus, "NoActiveDispute");
    });

    it("should reject double resolution", async function () {
      const { consensus, staking, uniq, agent4, token } = await loadFixture(finalizedRoundFixture);
      await stakeAgent(staking, uniq, agent4, SCOUT_STAKE);
      await uniq.connect(agent4).approve(await consensus.getAddress(), DISPUTE_STAKE);
      await consensus.connect(agent4).disputeScore(token, 70);
      await consensus.resolveDispute(token, true);

      await expect(consensus.resolveDispute(token, false))
        .to.be.revertedWithCustomError(consensus, "DisputeAlreadyResolved");
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                      VIEW FUNCTIONS
  // ═══════════════════════════════════════════════════════════

  describe("View Functions", function () {
    it("should return attestations for a round", async function () {
      const { consensus, staking, uniq, agent1, agent2 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, GUARDIAN_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 20);
      await submitSafeAttestation(consensus, agent2, token, 30);

      const attestations = await consensus.getAttestations(token, 1);
      expect(attestations.length).to.equal(2);
      expect(attestations[0].agent).to.equal(agent1.address);
      expect(attestations[1].agent).to.equal(agent2.address);
      expect(attestations[0].weight).to.equal(10000);  // Scout
      expect(attestations[1].weight).to.equal(30000);  // Guardian
    });

    it("should return 0 attestation count for finalized round", async function () {
      const { consensus, staking, uniq, agent1, agent2, agent3 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent2, SCOUT_STAKE);
      await stakeAgent(staking, uniq, agent3, SCOUT_STAKE);
      const token = randomAddress();

      await submitSafeAttestation(consensus, agent1, token, 20);
      await submitSafeAttestation(consensus, agent2, token, 25);
      await submitSafeAttestation(consensus, agent3, token, 30);
      await consensus.finalizeConsensus(token);

      // Active attestation count should return 0 since round is finalized
      expect(await consensus.getAttestationCount(token)).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                    PAUSE / UNPAUSE
  // ═══════════════════════════════════════════════════════════

  describe("Pausable", function () {
    it("should reject attestations when paused", async function () {
      const { consensus, staking, uniq, agent1 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await consensus.pause();

      await expect(submitSafeAttestation(consensus, agent1, randomAddress(), 25))
        .to.be.revertedWithCustomError(consensus, "EnforcedPause");
    });

    it("should allow attestations after unpause", async function () {
      const { consensus, staking, uniq, agent1 } = await loadFixture(deployConsensusFixture);
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);
      await consensus.pause();
      await consensus.unpause();

      const token = randomAddress();
      await submitSafeAttestation(consensus, agent1, token, 25);
      expect(await consensus.totalAttestations()).to.equal(1);
    });

    it("should reject pause by non-owner", async function () {
      const { consensus, agent1 } = await loadFixture(deployConsensusFixture);
      await expect(consensus.connect(agent1).pause())
        .to.be.revertedWithCustomError(consensus, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                   INTEGRATION / E2E
  // ═══════════════════════════════════════════════════════════

  describe("End-to-End Flow", function () {
    it("should complete full consensus lifecycle", async function () {
      const { consensus, staking, scanner, uniq, agent1, agent2, agent3, agent4 } =
        await loadFixture(deployConsensusFixture);

      // 1. Agents stake
      await stakeAgent(staking, uniq, agent1, SCOUT_STAKE);     // 1×
      await stakeAgent(staking, uniq, agent2, GUARDIAN_STAKE);   // 3×
      await stakeAgent(staking, uniq, agent3, SENTINEL_STAKE);   // 8×

      const token = randomAddress();

      // 2. Agents submit attestations
      await submitSafeAttestation(consensus, agent1, token, 40);
      await submitSafeAttestation(consensus, agent2, token, 45);
      await submitSafeAttestation(consensus, agent3, token, 50);

      // 3. Finalize consensus
      await consensus.finalizeConsensus(token);

      // 4. Verify scanner was updated
      expect(await scanner.isScanned(token)).to.be.true;
      const risk = await scanner.getTokenRisk(token);
      // Weighted: (40*10000 + 45*30000 + 50*80000) / (10000+30000+80000)
      // = (400000 + 1350000 + 4000000) / 120000 = 5750000/120000 ≈ 47
      expect(risk.riskScore).to.equal(47);

      // 5. Dispute the score
      await stakeAgent(staking, uniq, agent4, SCOUT_STAKE);
      await uniq.connect(agent4).approve(await consensus.getAddress(), DISPUTE_STAKE);
      await consensus.connect(agent4).disputeScore(token, 80);

      // 6. Resolve dispute (not upheld)
      await consensus.resolveDispute(token, false);

      // 7. Verify counters
      expect(await consensus.totalRounds()).to.equal(1);
      expect(await consensus.totalAttestations()).to.equal(3);
      expect(await consensus.totalFinalizations()).to.equal(1);
    });
  });
});
