import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AegisVault", function () {
  const REGISTRATION_FEE = ethers.parseEther("0.01");
  const MAX_AGENTS = 1000;
  const PROTOCOL_FEE_BPS = 50; // 0.5%
  const MIN_DEPOSIT = ethers.parseEther("0.001");

  async function deployFullFixture() {
    const [owner, user1, user2, agentOperator] = await ethers.getSigners();

    // Deploy Registry
    const Registry = await ethers.getContractFactory("AegisRegistry");
    const registry = await Registry.deploy(REGISTRATION_FEE, MAX_AGENTS);

    // Deploy Vault
    const Vault = await ethers.getContractFactory("AegisVault");
    const vault = await Vault.deploy(
      await registry.getAddress(),
      PROTOCOL_FEE_BPS,
      MIN_DEPOSIT
    );

    // Authorize vault in registry
    await registry.setVaultAuthorization(await vault.getAddress(), true);

    // Register an agent
    await registry.connect(agentOperator).registerAgent(
      "Guardian Alpha",
      "ipfs://agent1",
      1, // Guardian tier
      { value: REGISTRATION_FEE }
    );

    // Authorize the agent operator in vault
    await vault.setOperatorAuthorization(agentOperator.address, true);

    return { registry, vault, owner, user1, user2, agentOperator };
  }

  describe("Deployment", function () {
    it("should set correct registry address", async function () {
      const { vault, registry } = await loadFixture(deployFullFixture);
      expect(await vault.registryAddress()).to.equal(await registry.getAddress());
    });

    it("should set correct protocol fee", async function () {
      const { vault } = await loadFixture(deployFullFixture);
      expect(await vault.protocolFeeBps()).to.equal(PROTOCOL_FEE_BPS);
    });

    it("should reject fee > 5%", async function () {
      const { registry } = await loadFixture(deployFullFixture);
      const Vault = await ethers.getContractFactory("AegisVault");
      await expect(
        Vault.deploy(await registry.getAddress(), 600, MIN_DEPOSIT)
      ).to.be.revertedWithCustomError(Vault, "FeeTooHigh");
    });
  });

  describe("Deposits", function () {
    it("should accept BNB deposits", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      const depositAmount = ethers.parseEther("1");
      await expect(
        vault.connect(user1).deposit({ value: depositAmount })
      ).to.emit(vault, "Deposited");

      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(depositAmount);
      expect(position.isActive).to.be.true;
    });

    it("should reject deposits below minimum", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).deposit({ value: ethers.parseEther("0.0001") })
      ).to.be.revertedWithCustomError(vault, "BelowMinDeposit");
    });

    it("should accumulate multiple deposits", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });

      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(ethers.parseEther("3"));
    });

    it("should set default risk profile on first deposit", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const riskProfile = await vault.getRiskProfile(user1.address);
      expect(riskProfile.maxSlippage).to.equal(100); // 1%
      expect(riskProfile.stopLossThreshold).to.equal(1000); // 10%
      expect(riskProfile.allowAutoWithdraw).to.be.true;
    });

    it("should track total deposited", async function () {
      const { vault, user1, user2 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user2).deposit({ value: ethers.parseEther("2") });

      expect(await vault.totalBnbDeposited()).to.equal(ethers.parseEther("3"));
    });
  });

  describe("Withdrawals", function () {
    it("should withdraw partial BNB", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });

      await expect(
        vault.connect(user1).withdraw(ethers.parseEther("1"))
      ).to.emit(vault, "Withdrawn");

      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(ethers.parseEther("1"));
    });

    it("should withdraw all BNB when amount is 0", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).withdraw(0);

      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(0);
      expect(position.isActive).to.be.false;
    });

    it("should revert on insufficient balance", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).withdraw(ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("should emergency withdraw all assets", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("5") });
      await vault.connect(user1).authorizeAgent(0);

      await vault.connect(user1).emergencyWithdraw();

      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(0);
      expect(position.isActive).to.be.false;
      expect(position.agentAuthorized).to.be.false;
    });
  });

  describe("Agent Authorization", function () {
    it("should authorize an agent", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).authorizeAgent(0)
      ).to.emit(vault, "AgentAuthorized");

      const position = await vault.getPosition(user1.address);
      expect(position.agentAuthorized).to.be.true;
      expect(position.authorizedAgentId).to.equal(0);
    });

    it("should revoke an agent", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(user1).revokeAgent()
      ).to.emit(vault, "AgentRevoked");

      const position = await vault.getPosition(user1.address);
      expect(position.agentAuthorized).to.be.false;
    });
  });

  describe("Risk Profile", function () {
    it("should update risk profile", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await vault.connect(user1).updateRiskProfile(
        200,   // 2% max slippage
        2000,  // 20% stop loss
        ethers.parseEther("0.5"),  // 0.5 BNB max action
        true,  // allow auto withdraw
        true   // allow auto swap
      );

      const riskProfile = await vault.getRiskProfile(user1.address);
      expect(riskProfile.maxSlippage).to.equal(200);
      expect(riskProfile.stopLossThreshold).to.equal(2000);
      expect(riskProfile.allowAutoSwap).to.be.true;
    });

    it("should reject excessive slippage", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).updateRiskProfile(1500, 1000, ethers.parseEther("1"), true, false)
      ).to.be.revertedWith("Slippage too high");
    });
  });

  describe("Protection Execution", function () {
    it("should execute emergency withdrawal protection", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      // Setup: user deposits and authorizes agent
      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Rug pull detected on protocol XYZ"));
      const protectValue = ethers.parseEther("1");

      const balanceBefore = await ethers.provider.getBalance(user1.address);

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address,
          0, // EmergencyWithdraw
          protectValue,
          reasonHash
        )
      ).to.emit(vault, "ProtectionExecuted");

      const balanceAfter = await ethers.provider.getBalance(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(protectValue);

      // Check vault stats
      expect(await vault.totalActionsExecuted()).to.equal(1);
      expect(await vault.totalValueProtected()).to.equal(protectValue);
    });

    it("should reject unauthorized agent execution", async function () {
      const { vault, user1, user2 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(user2).executeProtection(
          user1.address,
          0,
          ethers.parseEther("0.5"),
          ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(vault, "NotAuthorizedOperator");
    });

    it("should reject protection exceeding max action value", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      const depositAmount = ethers.parseEther("2");
      await vault.connect(user1).deposit({ value: depositAmount });
      await vault.connect(user1).authorizeAgent(0);

      // Default max action value is deposit / 2 = 1 BNB
      // Try to protect 1.5 BNB
      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address,
          0,
          ethers.parseEther("1.5"),
          ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(vault, "ExceedsMaxActionValue");
    });

    it("should track action history", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Market crash detected"));

      await vault.connect(agentOperator).executeProtection(
        user1.address,
        2, // AlertOnly
        0,
        reasonHash
      );

      const action = await vault.getAction(0);
      expect(action.agentId).to.equal(0);
      expect(action.user).to.equal(user1.address);
      expect(action.actionType).to.equal(2); // AlertOnly
      expect(action.reasonHash).to.equal(reasonHash);
      expect(action.successful).to.be.true;

      const userActionIds = await vault.getUserActions(user1.address);
      expect(userActionIds.length).to.equal(1);
    });
  });

  describe("Vault Stats", function () {
    it("should return accurate vault statistics", async function () {
      const { vault, user1, user2, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("3") });
      await vault.connect(user2).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      await vault.connect(agentOperator).executeProtection(
        user1.address, 0, ethers.parseEther("1"), ethers.ZeroHash
      );

      const stats = await vault.getVaultStats();
      expect(stats[0]).to.equal(ethers.parseEther("4")); // 3+2-1 = 4 BNB
      expect(stats[1]).to.equal(1); // 1 action
      expect(stats[2]).to.equal(ethers.parseEther("1")); // 1 BNB protected
    });
  });

  describe("Deposit Pausing", function () {
    it("should revert deposits when paused", async function () {
      const { vault, owner, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(owner).setDepositsPaused(true);

      await expect(
        vault.connect(user1).deposit({ value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(vault, "DepositsPaused");
    });

    it("should accept deposits after unpausing", async function () {
      const { vault, owner, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(owner).setDepositsPaused(true);
      await vault.connect(owner).setDepositsPaused(false);

      await expect(
        vault.connect(user1).deposit({ value: ethers.parseEther("1") })
      ).to.emit(vault, "Deposited");
    });
  });

  describe("Position Guard", function () {
    it("should revert withdraw without active position", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).withdraw(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(vault, "NoActivePosition");
    });

    it("should revert authorizeAgent without active position", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).authorizeAgent(0)
      ).to.be.revertedWithCustomError(vault, "NoActivePosition");
    });

    it("should revert revokeAgent without active position", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).revokeAgent()
      ).to.be.revertedWithCustomError(vault, "NoActivePosition");
    });

    it("should revert updateRiskProfile without active position", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).updateRiskProfile(100, 1000, ethers.parseEther("1"), true, false)
      ).to.be.revertedWithCustomError(vault, "NoActivePosition");
    });
  });

  describe("Constructor Validation", function () {
    it("should revert on zero registry address", async function () {
      const Vault = await ethers.getContractFactory("AegisVault");
      await expect(
        Vault.deploy(ethers.ZeroAddress, 50, ethers.parseEther("0.001"))
      ).to.be.revertedWithCustomError(Vault, "InvalidRegistry");
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to set min deposit", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      const newMin = ethers.parseEther("0.01");
      await vault.connect(owner).setMinDeposit(newMin);
      expect(await vault.minDeposit()).to.equal(newMin);
    });

    it("should allow owner to update protocol fee", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      await vault.connect(owner).setProtocolFee(100);
      expect(await vault.protocolFeeBps()).to.equal(100);
    });

    it("should revert protocol fee above 5%", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(owner).setProtocolFee(600)
      ).to.be.revertedWithCustomError(vault, "FeeTooHigh");
    });

    it("should revert setOperatorAuthorization with zero address", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(owner).setOperatorAuthorization(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(vault, "InvalidOperator");
    });
  });

  describe("Protection Edge Cases", function () {
    it("should execute StopLoss protection action", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      const balanceBefore = await ethers.provider.getBalance(user1.address);

      await vault.connect(agentOperator).executeProtection(
        user1.address,
        3, // StopLoss
        ethers.parseEther("0.5"),
        ethers.ZeroHash
      );

      const balanceAfter = await ethers.provider.getBalance(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("0.5"));
    });

    it("should revert EmergencyWithdraw when auto withdraw disabled", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).updateRiskProfile(100, 1000, ethers.parseEther("1"), false, false);
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address,
          0, // EmergencyWithdraw
          ethers.parseEther("0.5"),
          ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(vault, "AutoWithdrawNotAllowed");
    });

    it("should revert StopLoss when auto withdraw disabled", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).updateRiskProfile(100, 1000, ethers.parseEther("1"), false, false);
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address,
          3, // StopLoss
          ethers.parseEther("0.5"),
          ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(vault, "AutoWithdrawNotAllowed");
    });

    it("should execute AlertOnly with zero value", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address, 2, 0, ethers.ZeroHash
        )
      ).to.emit(vault, "ProtectionExecuted");

      // Balance unchanged
      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(ethers.parseEther("1"));
    });

    it("should revert protection when no agent authorized", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address, 0, ethers.parseEther("0.5"), ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(vault, "NoAgentAuthorized");
    });

    it("should track multiple sequential actions", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("5") });
      await vault.connect(user1).authorizeAgent(0);

      // Execute 3 actions
      await vault.connect(agentOperator).executeProtection(
        user1.address, 2, 0, ethers.ZeroHash // AlertOnly
      );
      await vault.connect(agentOperator).executeProtection(
        user1.address, 0, ethers.parseEther("0.5"), ethers.ZeroHash // EmergencyWithdraw
      );
      await vault.connect(agentOperator).executeProtection(
        user1.address, 2, 0, ethers.ZeroHash // AlertOnly
      );

      expect(await vault.totalActionsExecuted()).to.equal(3);
      const userActionIds = await vault.getUserActions(user1.address);
      expect(userActionIds.length).to.equal(3);
    });
  });

  describe("Action History", function () {
    it("should revert getAction with invalid ID", async function () {
      const { vault } = await loadFixture(deployFullFixture);

      await expect(
        vault.getAction(999)
      ).to.be.revertedWithCustomError(vault, "ActionDoesNotExist");
    });

    it("should return correct action count", async function () {
      const { vault } = await loadFixture(deployFullFixture);
      expect(await vault.getActionCount()).to.equal(0);
    });

    it("should track agent action IDs", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      await vault.connect(agentOperator).executeProtection(
        user1.address, 2, 0, ethers.ZeroHash
      );

      const agentActionIds = await vault.getAgentActions(0);
      expect(agentActionIds.length).to.equal(1);
      expect(agentActionIds[0]).to.equal(0);
    });
  });

  describe("Risk Profile Validation", function () {
    it("should revert stop loss above 50%", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).updateRiskProfile(100, 6000, ethers.parseEther("1"), true, false)
      ).to.be.revertedWith("Stop loss too high");
    });
  });

  describe("Emergency Withdraw", function () {
    it("should work even with zero BNB balance", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      // No deposit, just call emergency withdraw — should not revert
      await vault.connect(user1).emergencyWithdraw();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Phase 2: TokenGate Integration Tests
  // ═══════════════════════════════════════════════════════════════

  describe("TokenGate Integration", function () {
    const BRONZE = ethers.parseEther("10000");
    const SILVER = ethers.parseEther("100000");
    const GOLD   = ethers.parseEther("1000000");
    const TOTAL  = ethers.parseEther("1000000000");

    async function deployWithTokenGateFixture() {
      const base = await deployFullFixture();
      const { vault, owner } = base;

      // Deploy mock $UNIQ
      const Token = await ethers.getContractFactory("MockERC20");
      const uniq = await Token.deploy("Uniq Minds", "UNIQ", TOTAL);

      // Deploy TokenGate
      const Gate = await ethers.getContractFactory("AegisTokenGate");
      const gate = await Gate.deploy(await uniq.getAddress());

      // Wire TokenGate into Vault
      await vault.setTokenGate(await gate.getAddress());

      return { ...base, uniq, gate };
    }

    it("should return base fee when no TokenGate set", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(PROTOCOL_FEE_BPS);
    });

    it("should return base fee for non-holder with TokenGate set", async function () {
      const { vault, user1 } = await loadFixture(deployWithTokenGateFixture);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(PROTOCOL_FEE_BPS);
    });

    it("should return discounted fee for bronze holder", async function () {
      const { vault, uniq, owner, user1 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, BRONZE);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(40); // 50 - 10
    });

    it("should return discounted fee for silver holder", async function () {
      const { vault, uniq, owner, user1 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, SILVER);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(25); // 50 - 25
    });

    it("should return discounted fee for gold holder", async function () {
      const { vault, uniq, owner, user1 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(10); // 50 - 40
    });

    it("should allow owner to set TokenGate", async function () {
      const { vault, owner, gate } = await loadFixture(deployWithTokenGateFixture);
      expect(await vault.tokenGate()).to.equal(await gate.getAddress());
    });

    it("should emit TokenGateUpdated event", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      const Gate = await ethers.getContractFactory("AegisTokenGate");
      const Token = await ethers.getContractFactory("MockERC20");
      const uniq = await Token.deploy("Uniq", "UNIQ", TOTAL);
      const gate = await Gate.deploy(await uniq.getAddress());

      await expect(
        vault.setTokenGate(await gate.getAddress())
      ).to.emit(vault, "TokenGateUpdated");
    });

    it("should allow disabling TokenGate (set to zero address)", async function () {
      const { vault, owner } = await loadFixture(deployWithTokenGateFixture);
      await vault.setTokenGate(ethers.ZeroAddress);
      expect(await vault.tokenGate()).to.equal(ethers.ZeroAddress);
    });

    it("should return base fee after TokenGate disabled", async function () {
      const { vault, uniq, owner, user1 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(10); // discounted

      await vault.setTokenGate(ethers.ZeroAddress);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(PROTOCOL_FEE_BPS); // back to base
    });

    it("should update fee dynamically when user sells tokens", async function () {
      const { vault, uniq, owner, user1, user2 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(10); // Gold discount

      // User sells most tokens
      await uniq.connect(user1).transfer(user2.address, ethers.parseEther("990000"));
      expect(await vault.getEffectiveFee(user1.address)).to.equal(40); // Bronze discount (10K left)
    });
  });
});
