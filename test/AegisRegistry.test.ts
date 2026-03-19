import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { AegisRegistry } from "../typechain-types";

describe("AegisRegistry", function () {
  const REGISTRATION_FEE = ethers.parseEther("0.01");
  const MAX_AGENTS = 1000;

  async function deployRegistryFixture() {
    const [owner, operator1, operator2, reviewer] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AegisRegistry");
    const registry = await Registry.deploy(REGISTRATION_FEE, MAX_AGENTS);

    return { registry, owner, operator1, operator2, reviewer };
  }

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      expect(await registry.name()).to.equal("Aegis Guardian Agent");
      expect(await registry.symbol()).to.equal("AEGIS");
    });

    it("should set registration fee and max agents", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      expect(await registry.registrationFee()).to.equal(REGISTRATION_FEE);
      expect(await registry.maxAgents()).to.equal(MAX_AGENTS);
    });

    it("should set correct owner", async function () {
      const { registry, owner } = await loadFixture(deployRegistryFixture);
      expect(await registry.owner()).to.equal(owner.address);
    });
  });

  describe("Agent Registration", function () {
    it("should register a new agent successfully", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(operator1).registerAgent(
          "Guardian Alpha",
          "ipfs://QmAgent1",
          1, // Guardian tier
          { value: REGISTRATION_FEE }
        )
      ).to.emit(registry, "AgentRegistered");

      const agent = await registry.getAgent(0);
      expect(agent.name).to.equal("Guardian Alpha");
      expect(agent.operator).to.equal(operator1.address);
      expect(agent.status).to.equal(0); // Active
      expect(agent.tier).to.equal(1); // Guardian
    });

    it("should mint ERC-721 token to operator", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent(
        "Guardian Beta",
        "ipfs://QmAgent2",
        0,
        { value: REGISTRATION_FEE }
      );

      expect(await registry.ownerOf(0)).to.equal(operator1.address);
      expect(await registry.balanceOf(operator1.address)).to.equal(1);
    });

    it("should revert if fee is insufficient", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(operator1).registerAgent(
          "Test",
          "ipfs://test",
          0,
          { value: ethers.parseEther("0.001") }
        )
      ).to.be.revertedWith("Insufficient registration fee");
    });

    it("should revert if operator already has an agent", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent(
        "Agent 1",
        "ipfs://1",
        0,
        { value: REGISTRATION_FEE }
      );

      await expect(
        registry.connect(operator1).registerAgent(
          "Agent 2",
          "ipfs://2",
          0,
          { value: REGISTRATION_FEE }
        )
      ).to.be.revertedWith("Operator already has an agent");
    });

    it("should refund excess payment", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      const excessPayment = ethers.parseEther("0.05");
      const balanceBefore = await ethers.provider.getBalance(operator1.address);

      const tx = await registry.connect(operator1).registerAgent(
        "Test",
        "ipfs://test",
        0,
        { value: excessPayment }
      );
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(operator1.address);
      // Balance decreased by fee + gas, not full payment
      expect(balanceBefore - balanceAfter).to.be.closeTo(
        REGISTRATION_FEE + gasUsed,
        ethers.parseEther("0.001")
      );
    });

    it("should increment agent count", async function () {
      const { registry, operator1, operator2 } = await loadFixture(deployRegistryFixture);

      expect(await registry.getAgentCount()).to.equal(0);

      await registry.connect(operator1).registerAgent("A1", "ipfs://1", 0, { value: REGISTRATION_FEE });
      expect(await registry.getAgentCount()).to.equal(1);

      await registry.connect(operator2).registerAgent("A2", "ipfs://2", 0, { value: REGISTRATION_FEE });
      expect(await registry.getAgentCount()).to.equal(2);
    });
  });

  describe("Agent Management", function () {
    it("should update agent URI", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://old", 0, { value: REGISTRATION_FEE });
      await registry.connect(operator1).updateAgentURI(0, "ipfs://new");

      const agent = await registry.getAgent(0);
      expect(agent.agentURI).to.equal("ipfs://new");
    });

    it("should change agent status", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      await expect(
        registry.connect(operator1).setAgentStatus(0, 1) // Paused
      ).to.emit(registry, "AgentStatusChanged");

      expect(await registry.isAgentActive(0)).to.equal(false);
    });

    it("should not allow non-operator to manage agent", async function () {
      const { registry, operator1, operator2 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      await expect(
        registry.connect(operator2).updateAgentURI(0, "ipfs://hack")
      ).to.be.revertedWith("Not agent operator");
    });

    it("should upgrade agent tier (owner only)", async function () {
      const { registry, owner, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      await registry.connect(owner).upgradeAgentTier(0, 3); // Archon

      const agent = await registry.getAgent(0);
      expect(agent.tier).to.equal(3);
    });
  });

  describe("Reputation System", function () {
    it("should allow feedback on agents", async function () {
      const { registry, operator1, reviewer } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      await expect(
        registry.connect(reviewer).giveFeedback(0, 5, "Excellent protection!")
      ).to.emit(registry, "ReputationFeedback");

      expect(await registry.getReputationCount(0)).to.equal(1);
    });

    it("should calculate average reputation score", async function () {
      const { registry, operator1, operator2, reviewer } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      await registry.connect(reviewer).giveFeedback(0, 5, "Great!");
      await registry.connect(operator2).giveFeedback(0, 3, "Good");

      // Average: (5+3)/2 = 4.0 → 400 (scaled by 100)
      expect(await registry.getReputationScore(0)).to.equal(400);
    });

    it("should not allow self-review", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      await expect(
        registry.connect(operator1).giveFeedback(0, 5, "Self review")
      ).to.be.revertedWith("Cannot review own agent");
    });
  });

  describe("Agent Stats", function () {
    it("should record agent actions from authorized vault", async function () {
      const { registry, owner, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      // Authorize owner as a vault for testing
      await registry.setVaultAuthorization(owner.address, true);

      await registry.recordAgentAction(0, true, ethers.parseEther("10"));

      const agent = await registry.getAgent(0);
      expect(agent.totalDecisions).to.equal(1);
      expect(agent.successfulActions).to.equal(1);
      expect(agent.totalValueProtected).to.equal(ethers.parseEther("10"));
    });

    it("should calculate success rate", async function () {
      const { registry, owner, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });
      await registry.setVaultAuthorization(owner.address, true);

      // 3 actions, 2 successful
      await registry.recordAgentAction(0, true, ethers.parseEther("5"));
      await registry.recordAgentAction(0, true, ethers.parseEther("3"));
      await registry.recordAgentAction(0, false, 0);

      // 2/3 = 66.66% → 6666 basis points
      expect(await registry.getSuccessRate(0)).to.equal(6666);
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to withdraw fees", async function () {
      const { registry, owner, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await registry.withdrawFees();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(balanceAfter - balanceBefore + gasUsed).to.equal(REGISTRATION_FEE);
    });

    it("should update registration fee", async function () {
      const { registry, owner } = await loadFixture(deployRegistryFixture);

      const newFee = ethers.parseEther("0.05");
      await registry.setRegistrationFee(newFee);
      expect(await registry.registrationFee()).to.equal(newFee);
    });
  });

  describe("Edge Cases", function () {
    it("should revert registration with empty name", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(operator1).registerAgent("", "ipfs://test", 0, { value: REGISTRATION_FEE })
      ).to.be.revertedWith("Invalid name length");
    });

    it("should revert when max agents reached", async function () {
      const [, op1, op2, op3] = await ethers.getSigners();

      // Deploy with max 2 agents
      const Registry = await ethers.getContractFactory("AegisRegistry");
      const smallRegistry = await Registry.deploy(REGISTRATION_FEE, 2);

      await smallRegistry.connect(op1).registerAgent("A1", "ipfs://1", 0, { value: REGISTRATION_FEE });
      await smallRegistry.connect(op2).registerAgent("A2", "ipfs://2", 0, { value: REGISTRATION_FEE });

      await expect(
        smallRegistry.connect(op3).registerAgent("A3", "ipfs://3", 0, { value: REGISTRATION_FEE })
      ).to.be.revertedWith("Max agents reached");
    });

    it("should prevent decommissioned agent from changing status", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });
      await registry.connect(operator1).setAgentStatus(0, 2); // Decommissioned

      await expect(
        registry.connect(operator1).setAgentStatus(0, 0) // Try to reactivate
      ).to.be.revertedWith("Agent decommissioned");
    });

    it("should revert non-owner tier upgrade", async function () {
      const { registry, operator1, operator2 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      await expect(
        registry.connect(operator2).upgradeAgentTier(0, 2)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should revert tier downgrade", async function () {
      const { registry, owner, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 2, { value: REGISTRATION_FEE });

      await expect(
        registry.connect(owner).upgradeAgentTier(0, 1) // Downgrade Sentinel → Guardian
      ).to.be.revertedWith("Can only upgrade tier");
    });

    it("should return zero success rate for agent with no decisions", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      expect(await registry.getSuccessRate(0)).to.equal(0);
    });

    it("should reject feedback score out of range", async function () {
      const { registry, operator1, operator2 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      await expect(
        registry.connect(operator2).giveFeedback(0, 0, "Bad score")
      ).to.be.revertedWith("Score must be 1-5");

      await expect(
        registry.connect(operator2).giveFeedback(0, 6, "Bad score")
      ).to.be.revertedWith("Score must be 1-5");
    });

    it("should reject unauthorized vault calling recordAgentAction", async function () {
      const { registry, operator1, operator2 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent("Test", "ipfs://test", 0, { value: REGISTRATION_FEE });

      await expect(
        registry.connect(operator2).recordAgentAction(0, true, ethers.parseEther("1"))
      ).to.be.revertedWith("Not authorized vault");
    });

    it("should reject zero address for vault authorization", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.setVaultAuthorization(ethers.ZeroAddress, true)
      ).to.be.revertedWith("Invalid vault address");
    });

    it("should revert getAgent for non-existent agent", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.getAgent(999)
      ).to.be.revertedWith("Agent does not exist");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Phase 2: TokenGate Holder Badge Tests
  // ═══════════════════════════════════════════════════════════════

  describe("Holder Badge Integration", function () {
    const BRONZE = ethers.parseEther("10000");
    const GOLD   = ethers.parseEther("1000000");
    const TOTAL  = ethers.parseEther("1000000000");

    async function deployWithTokenGateFixture() {
      const base = await deployRegistryFixture();
      const { registry, owner, operator1 } = base;

      // Deploy mock $UNIQ
      const Token = await ethers.getContractFactory("MockERC20");
      const uniq = await Token.deploy("Uniq Minds", "UNIQ", TOTAL);

      // Deploy TokenGate
      const Gate = await ethers.getContractFactory("AegisTokenGate");
      const gate = await Gate.deploy(await uniq.getAddress());

      // Wire TokenGate into Registry
      await registry.setTokenGate(await gate.getAddress());

      // Register an agent for operator1
      await registry.connect(operator1).registerAgent(
        "Test Agent", "ipfs://test", 0,
        { value: REGISTRATION_FEE }
      );

      return { ...base, uniq, gate };
    }

    it("should return false for isUNIQHolder when no TokenGate set", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent(
        "Test", "ipfs://test", 0, { value: REGISTRATION_FEE }
      );

      expect(await registry.isUNIQHolder(0)).to.be.false;
    });

    it("should return true for isUNIQHolder when operator holds tokens", async function () {
      const { registry, uniq, owner, operator1 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(operator1.address, BRONZE);
      expect(await registry.isUNIQHolder(0)).to.be.true;
    });

    it("should return false for isUNIQHolder when operator has no tokens", async function () {
      const { registry, operator1 } = await loadFixture(deployWithTokenGateFixture);
      expect(await registry.isUNIQHolder(0)).to.be.false;
    });

    it("should refresh holder badge to correct tier", async function () {
      const { registry, uniq, owner, operator1 } = await loadFixture(deployWithTokenGateFixture);

      await uniq.transfer(operator1.address, GOLD);
      await registry.refreshHolderBadge(0);

      expect(await registry.getHolderBadge(0)).to.equal(3); // Gold
    });

    it("should emit HolderBadgeUpdated on refresh", async function () {
      const { registry, uniq, owner, operator1 } = await loadFixture(deployWithTokenGateFixture);

      await uniq.transfer(operator1.address, BRONZE);

      await expect(
        registry.refreshHolderBadge(0)
      ).to.emit(registry, "HolderBadgeUpdated");
    });

    it("should update badge when holder sells tokens", async function () {
      const { registry, uniq, owner, operator1, operator2 } = await loadFixture(deployWithTokenGateFixture);

      await uniq.transfer(operator1.address, GOLD);
      await registry.refreshHolderBadge(0);
      expect(await registry.getHolderBadge(0)).to.equal(3); // Gold

      // Sell most tokens
      await uniq.connect(operator1).transfer(operator2.address, ethers.parseEther("999000"));
      await registry.refreshHolderBadge(0);
      expect(await registry.getHolderBadge(0)).to.equal(0); // None (1K left)
    });

    it("should revert refreshHolderBadge when no TokenGate set", async function () {
      const { registry, operator1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(operator1).registerAgent(
        "Test", "ipfs://test", 0, { value: REGISTRATION_FEE }
      );

      await expect(
        registry.refreshHolderBadge(0)
      ).to.be.revertedWith("TokenGate not set");
    });

    it("should emit TokenGateUpdated event on set", async function () {
      const { registry, gate } = await loadFixture(deployWithTokenGateFixture);

      await expect(
        registry.setTokenGate(await gate.getAddress())
      ).to.emit(registry, "TokenGateUpdated");
    });
  });
});
