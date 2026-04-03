import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("AegisStaking", function () {
  const SCOUT_STAKE    = ethers.parseEther("10000");
  const GUARDIAN_STAKE  = ethers.parseEther("100000");
  const SENTINEL_STAKE  = ethers.parseEther("500000");
  const ARCHON_STAKE    = ethers.parseEther("1000000");
  const COOLDOWN        = 7 * 24 * 60 * 60; // 7 days in seconds

  async function deployStakingFixture() {
    const [owner, agent1, agent2, agent3] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const uniq = await MockERC20.deploy("Uniq Token", "UNIQ", ethers.parseEther("100000000"));

    const Staking = await ethers.getContractFactory("AegisStaking");
    const staking = await Staking.deploy(await uniq.getAddress());

    // Distribute tokens to agents
    await uniq.transfer(agent1.address, ethers.parseEther("2000000"));
    await uniq.transfer(agent2.address, ethers.parseEther("2000000"));
    await uniq.transfer(agent3.address, ethers.parseEther("2000000"));

    return { staking, uniq, owner, agent1, agent2, agent3 };
  }

  // ═══════════════════════════════════════════════════════════
  //                       DEPLOYMENT
  // ═══════════════════════════════════════════════════════════

  describe("Deployment", function () {
    it("should set correct owner", async function () {
      const { staking, owner } = await loadFixture(deployStakingFixture);
      expect(await staking.owner()).to.equal(owner.address);
    });

    it("should set the UNIQ token address", async function () {
      const { staking, uniq } = await loadFixture(deployStakingFixture);
      expect(await staking.uniqToken()).to.equal(await uniq.getAddress());
    });

    it("should start with zero total staked", async function () {
      const { staking } = await loadFixture(deployStakingFixture);
      expect(await staking.totalStaked()).to.equal(0);
    });

    it("should have correct tier thresholds", async function () {
      const { staking } = await loadFixture(deployStakingFixture);
      expect(await staking.SCOUT_STAKE()).to.equal(SCOUT_STAKE);
      expect(await staking.GUARDIAN_STAKE()).to.equal(GUARDIAN_STAKE);
      expect(await staking.SENTINEL_STAKE()).to.equal(SENTINEL_STAKE);
      expect(await staking.ARCHON_STAKE()).to.equal(ARCHON_STAKE);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                       STAKING
  // ═══════════════════════════════════════════════════════════

  describe("Staking", function () {
    it("should allow staking UNIQ tokens", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);

      expect(await staking.getStake(agent1.address)).to.equal(SCOUT_STAKE);
      expect(await staking.totalStaked()).to.equal(SCOUT_STAKE);
    });

    it("should emit Staked event with correct tier", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), GUARDIAN_STAKE);

      await expect(staking.connect(agent1).stake(GUARDIAN_STAKE))
        .to.emit(staking, "Staked")
        .withArgs(agent1.address, GUARDIAN_STAKE, GUARDIAN_STAKE, 2); // 2 = Guardian
    });

    it("should allow incremental staking", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), ethers.parseEther("5000000"));

      await staking.connect(agent1).stake(SCOUT_STAKE);
      expect(await staking.getStakeTier(agent1.address)).to.equal(1); // Scout

      await staking.connect(agent1).stake(ethers.parseEther("90000"));
      expect(await staking.getStakeTier(agent1.address)).to.equal(2); // Guardian
    });

    it("should reject staking zero amount", async function () {
      const { staking, agent1 } = await loadFixture(deployStakingFixture);
      await expect(staking.connect(agent1).stake(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
    });

    it("should cancel pending unstake request when re-staking", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), ethers.parseEther("5000000"));

      await staking.connect(agent1).stake(SCOUT_STAKE);
      await staking.connect(agent1).requestUnstake();

      // Re-stake should cancel unstake request
      await staking.connect(agent1).stake(SCOUT_STAKE);
      const info = await staking.stakes(agent1.address);
      expect(info.unstakeRequestedAt).to.equal(0);
    });

    it("should track stakedAt timestamp", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      const tx = await staking.connect(agent1).stake(SCOUT_STAKE);
      const block = await tx.getBlock();

      const info = await staking.stakes(agent1.address);
      expect(info.stakedAt).to.equal(block!.timestamp);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                    TIER CLASSIFICATION
  // ═══════════════════════════════════════════════════════════

  describe("Tier Classification", function () {
    it("should return None for unstaked agent", async function () {
      const { staking, agent1 } = await loadFixture(deployStakingFixture);
      expect(await staking.getStakeTier(agent1.address)).to.equal(0); // None
    });

    it("should return None for below-minimum stake", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), ethers.parseEther("5000"));
      await staking.connect(agent1).stake(ethers.parseEther("5000"));
      expect(await staking.getStakeTier(agent1.address)).to.equal(0); // None
    });

    it("should return Scout for 10K UNIQ", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);
      expect(await staking.getStakeTier(agent1.address)).to.equal(1);
    });

    it("should return Guardian for 100K UNIQ", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), GUARDIAN_STAKE);
      await staking.connect(agent1).stake(GUARDIAN_STAKE);
      expect(await staking.getStakeTier(agent1.address)).to.equal(2);
    });

    it("should return Sentinel for 500K UNIQ", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SENTINEL_STAKE);
      await staking.connect(agent1).stake(SENTINEL_STAKE);
      expect(await staking.getStakeTier(agent1.address)).to.equal(3);
    });

    it("should return Archon for 1M UNIQ", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), ARCHON_STAKE);
      await staking.connect(agent1).stake(ARCHON_STAKE);
      expect(await staking.getStakeTier(agent1.address)).to.equal(4);
    });

    it("should return highest matching tier for overstake", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      const amount = ethers.parseEther("600000"); // Between Sentinel and Archon
      await uniq.connect(agent1).approve(await staking.getAddress(), amount);
      await staking.connect(agent1).stake(amount);
      expect(await staking.getStakeTier(agent1.address)).to.equal(3); // Sentinel
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                     WEIGHT SYSTEM
  // ═══════════════════════════════════════════════════════════

  describe("Weight System", function () {
    it("should return 0 weight for unstaked agent", async function () {
      const { staking, agent1 } = await loadFixture(deployStakingFixture);
      expect(await staking.getWeight(agent1.address)).to.equal(0);
    });

    it("should return 10000 (1x) for Scout", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);
      expect(await staking.getWeight(agent1.address)).to.equal(10000);
    });

    it("should return 30000 (3x) for Guardian", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), GUARDIAN_STAKE);
      await staking.connect(agent1).stake(GUARDIAN_STAKE);
      expect(await staking.getWeight(agent1.address)).to.equal(30000);
    });

    it("should return 80000 (8x) for Sentinel", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SENTINEL_STAKE);
      await staking.connect(agent1).stake(SENTINEL_STAKE);
      expect(await staking.getWeight(agent1.address)).to.equal(80000);
    });

    it("should return 200000 (20x) for Archon", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), ARCHON_STAKE);
      await staking.connect(agent1).stake(ARCHON_STAKE);
      expect(await staking.getWeight(agent1.address)).to.equal(200000);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                     isStaked CHECK
  // ═══════════════════════════════════════════════════════════

  describe("isStaked", function () {
    it("should return false for unstaked agents", async function () {
      const { staking, agent1 } = await loadFixture(deployStakingFixture);
      expect(await staking.isStaked(agent1.address)).to.be.false;
    });

    it("should return false for below-minimum stake", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), ethers.parseEther("9999"));
      await staking.connect(agent1).stake(ethers.parseEther("9999"));
      expect(await staking.isStaked(agent1.address)).to.be.false;
    });

    it("should return true for Scout-level stake", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);
      expect(await staking.isStaked(agent1.address)).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                       UNSTAKING
  // ═══════════════════════════════════════════════════════════

  describe("Unstaking", function () {
    it("should allow requesting unstake", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);

      await expect(staking.connect(agent1).requestUnstake())
        .to.emit(staking, "UnstakeRequested");
    });

    it("should reject unstake request when not staked", async function () {
      const { staking, agent1 } = await loadFixture(deployStakingFixture);
      await expect(staking.connect(agent1).requestUnstake())
        .to.be.revertedWithCustomError(staking, "NotStaked");
    });

    it("should reject duplicate unstake requests", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);
      await staking.connect(agent1).requestUnstake();

      await expect(staking.connect(agent1).requestUnstake())
        .to.be.revertedWithCustomError(staking, "UnstakeAlreadyRequested");
    });

    it("should allow withdrawal after cooldown", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);

      await staking.connect(agent1).requestUnstake();
      await time.increase(COOLDOWN);

      const balBefore = await uniq.balanceOf(agent1.address);
      await staking.connect(agent1).withdraw();
      const balAfter = await uniq.balanceOf(agent1.address);

      expect(balAfter - balBefore).to.equal(SCOUT_STAKE);
      expect(await staking.getStake(agent1.address)).to.equal(0);
      expect(await staking.totalStaked()).to.equal(0);
    });

    it("should reject withdrawal before cooldown", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);
      await staking.connect(agent1).requestUnstake();

      // Only advance 3 days (cooldown is 7)
      await time.increase(3 * 24 * 60 * 60);

      await expect(staking.connect(agent1).withdraw())
        .to.be.revertedWithCustomError(staking, "CooldownNotMet");
    });

    it("should reject withdrawal without unstake request", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);

      await expect(staking.connect(agent1).withdraw())
        .to.be.revertedWithCustomError(staking, "NoUnstakeRequest");
    });

    it("should delete stake info after withdrawal", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);
      await staking.connect(agent1).requestUnstake();
      await time.increase(COOLDOWN);
      await staking.connect(agent1).withdraw();

      const info = await staking.stakes(agent1.address);
      expect(info.amount).to.equal(0);
      expect(info.stakedAt).to.equal(0);
      expect(info.unstakeRequestedAt).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                       SLASHING
  // ═══════════════════════════════════════════════════════════

  describe("Slashing", function () {
    it("should allow owner to slash an agent", async function () {
      const { staking, uniq, owner, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), GUARDIAN_STAKE);
      await staking.connect(agent1).stake(GUARDIAN_STAKE);

      const slashAmount = ethers.parseEther("50000");
      const ownerBalBefore = await uniq.balanceOf(owner.address);

      await expect(staking.slash(agent1.address, slashAmount, "Submitted false data"))
        .to.emit(staking, "Slashed")
        .withArgs(agent1.address, slashAmount, "Submitted false data");

      expect(await staking.getStake(agent1.address)).to.equal(GUARDIAN_STAKE - slashAmount);
      const ownerBalAfter = await uniq.balanceOf(owner.address);
      expect(ownerBalAfter - ownerBalBefore).to.equal(slashAmount);
    });

    it("should reject slashing more than stake", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);

      await expect(staking.slash(agent1.address, SCOUT_STAKE + 1n, "Over-slash"))
        .to.be.revertedWithCustomError(staking, "SlashExceedsStake");
    });

    it("should reject slashing by non-owner", async function () {
      const { staking, uniq, agent1, agent2 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);

      await expect(staking.connect(agent2).slash(agent1.address, SCOUT_STAKE, "Attempted slash"))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });

    it("should downgrade tier after slash", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), GUARDIAN_STAKE);
      await staking.connect(agent1).stake(GUARDIAN_STAKE);
      expect(await staking.getStakeTier(agent1.address)).to.equal(2); // Guardian

      await staking.slash(agent1.address, ethers.parseEther("95000"), "Bad data");
      // 100K - 95K = 5K → below Scout threshold
      expect(await staking.getStakeTier(agent1.address)).to.equal(0); // None
    });

    it("should update totalStaked after slash", async function () {
      const { staking, uniq, agent1 } = await loadFixture(deployStakingFixture);
      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);

      const slashAmount = ethers.parseEther("3000");
      await staking.slash(agent1.address, slashAmount, "Partial slash");
      expect(await staking.totalStaked()).to.equal(SCOUT_STAKE - slashAmount);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //                    MULTIPLE AGENTS
  // ═══════════════════════════════════════════════════════════

  describe("Multiple Agents", function () {
    it("should track independent stakes", async function () {
      const { staking, uniq, agent1, agent2, agent3 } = await loadFixture(deployStakingFixture);

      await uniq.connect(agent1).approve(await staking.getAddress(), SCOUT_STAKE);
      await staking.connect(agent1).stake(SCOUT_STAKE);

      await uniq.connect(agent2).approve(await staking.getAddress(), GUARDIAN_STAKE);
      await staking.connect(agent2).stake(GUARDIAN_STAKE);

      await uniq.connect(agent3).approve(await staking.getAddress(), ARCHON_STAKE);
      await staking.connect(agent3).stake(ARCHON_STAKE);

      expect(await staking.totalStaked()).to.equal(SCOUT_STAKE + GUARDIAN_STAKE + ARCHON_STAKE);
      expect(await staking.getStakeTier(agent1.address)).to.equal(1); // Scout
      expect(await staking.getStakeTier(agent2.address)).to.equal(2); // Guardian
      expect(await staking.getStakeTier(agent3.address)).to.equal(4); // Archon
    });
  });
});
