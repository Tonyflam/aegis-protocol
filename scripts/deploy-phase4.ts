// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Phase 3-4 Contract Deployment (BSC Testnet)
// Deploys: AegisScanner, AegisStaking, AegisConsensus, AegisCertification
// Wires into existing: AegisRegistry, DecisionLogger, AegisTokenGate
// ═══════════════════════════════════════════════════════════════

import { ethers } from "hardhat";
import * as fs from "fs";

// Existing Phase 1-2 deployments (from deployment.json)
const EXISTING = {
  AegisRegistry: "0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF",
  AegisVault: "0x15Ef23024c2b90beA81E002349C70f0C2A09433F",
  DecisionLogger: "0x874d78947bd660665de237b16Ca05cd39b7feF6f",
  AegisTokenGate: "0x672c5cC370085c3c6B5bcf2870e1A0Aa62Ff3D69",
};

const UNIQ_TOKEN = process.env.UNIQ_TOKEN_ADDRESS || "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777";
const CERTIFICATION_FEE = ethers.parseEther("100000"); // 100K UNIQ

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("═".repeat(60));
  console.log("  AEGIS PROTOCOL — PHASE 3-4 DEPLOYMENT");
  console.log("═".repeat(60));
  console.log(`  Deployer:  ${deployer.address}`);
  console.log(`  Balance:   ${ethers.formatEther(balance)} tBNB`);
  console.log(`  Network:   Chain ID ${network.chainId}`);
  console.log(`  $UNIQ:     ${UNIQ_TOKEN}`);
  console.log("═".repeat(60));

  // Validate chain
  if (network.chainId !== 97n) {
    throw new Error(`Expected BSC Testnet (97), got ${network.chainId}`);
  }
  if (balance < ethers.parseEther("0.05")) {
    throw new Error(`Insufficient balance: ${ethers.formatEther(balance)} tBNB (need >0.05)`);
  }

  // Validate existing contracts have code
  for (const [name, addr] of Object.entries(EXISTING)) {
    const code = await ethers.provider.getCode(addr);
    if (code.length <= 2) throw new Error(`${name} not found at ${addr}`);
    console.log(`  ✓ ${name} verified at ${addr}`);
  }
  console.log("");

  // ─── 1. Deploy AegisScanner ──────────────────────────────
  console.log("1. Deploying AegisScanner (Security Oracle)...");
  const Scanner = await ethers.getContractFactory("AegisScanner");
  const scanner = await Scanner.deploy();
  await scanner.waitForDeployment();
  const scannerAddr = await scanner.getAddress();
  console.log(`   ✓ AegisScanner deployed: ${scannerAddr}`);

  // ─── 2. Deploy AegisStaking ──────────────────────────────
  console.log("\n2. Deploying AegisStaking ($UNIQ Staking)...");
  const Staking = await ethers.getContractFactory("AegisStaking");
  const staking = await Staking.deploy(UNIQ_TOKEN);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log(`   ✓ AegisStaking deployed: ${stakingAddr}`);

  // ─── 3. Deploy AegisConsensus ────────────────────────────
  console.log("\n3. Deploying AegisConsensus (Multi-Agent Voting)...");
  const Consensus = await ethers.getContractFactory("AegisConsensus");
  const consensus = await Consensus.deploy(stakingAddr, scannerAddr);
  await consensus.waitForDeployment();
  const consensusAddr = await consensus.getAddress();
  console.log(`   ✓ AegisConsensus deployed: ${consensusAddr}`);

  // ─── 4. Deploy AegisCertification ────────────────────────
  console.log("\n4. Deploying AegisCertification (Safety NFTs)...");
  const Cert = await ethers.getContractFactory("AegisCertification");
  const cert = await Cert.deploy(scannerAddr, UNIQ_TOKEN, CERTIFICATION_FEE);
  await cert.waitForDeployment();
  const certAddr = await cert.getAddress();
  console.log(`   ✓ AegisCertification deployed: ${certAddr}`);

  // ─── 5. Configure Permissions ────────────────────────────
  console.log("\n5. Configuring permissions...");

  // Authorize deployer as scanner agent
  const tx1 = await scanner.setScannerAuthorization(deployer.address, true);
  await tx1.wait();
  console.log("   ✓ Deployer authorized as scanner agent");

  // Authorize consensus contract to submit scans to scanner
  const tx2 = await scanner.setScannerAuthorization(consensusAddr, true);
  await tx2.wait();
  console.log("   ✓ Consensus contract authorized as scanner");

  // ─── 6. Verify Permissions ───────────────────────────────
  console.log("\n6. Verifying permissions...");
  const deployerAuthorized = await scanner.authorizedScanners(deployer.address);
  const consensusAuthorized = await scanner.authorizedScanners(consensusAddr);
  console.log(`   Deployer is authorized scanner: ${deployerAuthorized}`);
  console.log(`   Consensus is authorized scanner: ${consensusAuthorized}`);

  if (!deployerAuthorized || !consensusAuthorized) {
    throw new Error("Permission configuration failed");
  }

  // ─── 7. Test Scanner Accepts Submissions ─────────────────
  console.log("\n7. Running test scan submission...");
  const testToken = "0x0000000000000000000000000000000000000001"; // sentinel address
  const testHash = ethers.keccak256(ethers.toUtf8Bytes("Aegis deployment validation scan"));
  const tx3 = await scanner.submitScan(
    testToken,
    0,      // riskScore: 0 (safe)
    0,      // liquidity
    0,      // holderCount
    0,      // topHolderPercent
    0,      // buyTax
    0,      // sellTax
    [false, false, false, false, false, false, false], // boolFlags
    "DEPLOYMENT_TEST",
    testHash
  );
  await tx3.wait();
  console.log(`   ✓ Test scan submitted (tx: ${tx3.hash})`);

  // Verify test scan is stored
  const testScan = await scanner.getTokenScan(testToken);
  console.log(`   ✓ Test scan verified on-chain (version: ${testScan.scanVersion})`);

  // Verify stats
  const stats = await scanner.getScannerStats();
  console.log(`   ✓ Scanner stats: totalScans=${stats[0]}, tokens=${stats[3]}`);

  // ─── Summary ─────────────────────────────────────────────
  const balanceAfter = await ethers.provider.getBalance(deployer.address);
  const gasUsed = balance - balanceAfter;

  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 3-4 DEPLOYMENT COMPLETE");
  console.log("═".repeat(60));
  console.log(`  AegisScanner:       ${scannerAddr}`);
  console.log(`  AegisStaking:       ${stakingAddr}`);
  console.log(`  AegisConsensus:     ${consensusAddr}`);
  console.log(`  AegisCertification: ${certAddr}`);
  console.log("  ─── Existing (Phase 1-2) ───");
  console.log(`  AegisRegistry:      ${EXISTING.AegisRegistry}`);
  console.log(`  AegisVault:         ${EXISTING.AegisVault}`);
  console.log(`  DecisionLogger:     ${EXISTING.DecisionLogger}`);
  console.log(`  AegisTokenGate:     ${EXISTING.AegisTokenGate}`);
  console.log("  ───────────────────────────");
  console.log(`  Gas Used:           ${ethers.formatEther(gasUsed)} tBNB`);
  console.log(`  Balance Remaining:  ${ethers.formatEther(balanceAfter)} tBNB`);
  console.log("═".repeat(60));

  // ─── Save Deployment ─────────────────────────────────────
  const deploymentData = {
    network: "bscTestnet",
    chainId: 97,
    deployedAt: new Date().toISOString(),
    contracts: {
      // Phase 1-2
      AegisRegistry: EXISTING.AegisRegistry,
      AegisVault: EXISTING.AegisVault,
      DecisionLogger: EXISTING.DecisionLogger,
      AegisTokenGate: EXISTING.AegisTokenGate,
      // Phase 3-4
      AegisScanner: scannerAddr,
      AegisStaking: stakingAddr,
      AegisConsensus: consensusAddr,
      AegisCertification: certAddr,
    },
    configuration: {
      registrationFee: "0.001",
      maxAgents: 10000,
      protocolFeeBps: 50,
      minDeposit: "0.001",
      certificationFee: ethers.formatEther(CERTIFICATION_FEE),
      uniqToken: UNIQ_TOKEN,
    },
  };

  fs.writeFileSync("deployment.json", JSON.stringify(deploymentData, null, 2));
  console.log("\n  ✓ deployment.json updated with all 8 contracts\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error.message || error);
    process.exit(1);
  });
