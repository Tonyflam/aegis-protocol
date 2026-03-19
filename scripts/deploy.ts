import { ethers, network } from "hardhat";

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric env var ${name}: ${raw}`);
  }
  return parsed;
}

function getEnvBoolean(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.toLowerCase() === "true";
}

async function main() {
  if (network.name === "bscMainnet" && !getEnvBoolean("ALLOW_MAINNET_DEPLOY", false)) {
    throw new Error(
      "Refusing to deploy to bscMainnet without ALLOW_MAINNET_DEPLOY=true in env."
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // Launch parameters are env-configurable for testnet and mainnet parity.
  const registrationFee = ethers.parseEther(process.env.REGISTRATION_FEE_BNB || "0.001");
  const maxAgents = getEnvNumber("MAX_AGENTS", 10000);
  const protocolFeeBps = getEnvNumber("PROTOCOL_FEE_BPS", 50);
  const minDeposit = ethers.parseEther(process.env.MIN_DEPOSIT_BNB || "0.001");
  const initialAgentName = process.env.INITIAL_AGENT_NAME || "Aegis Guardian Alpha";
  const initialAgentMetadataUri = process.env.INITIAL_AGENT_METADATA_URI || "https://aegis-protocol.io/agent/alpha";
  const initialAgentTier = getEnvNumber("INITIAL_AGENT_TIER", 3);
  const skipInitialAgent = getEnvBoolean("SKIP_INITIAL_AGENT", false);

  if (protocolFeeBps < 0 || protocolFeeBps > 10_000) {
    throw new Error(`PROTOCOL_FEE_BPS must be between 0 and 10000, got ${protocolFeeBps}`);
  }
  if (maxAgents <= 0) {
    throw new Error(`MAX_AGENTS must be > 0, got ${maxAgents}`);
  }

  console.log("\n1. Deploying AegisRegistry...");
  const Registry = await ethers.getContractFactory("AegisRegistry");
  const registry = await Registry.deploy(registrationFee, maxAgents);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   AegisRegistry deployed to:", registryAddress);

  console.log("\n2. Deploying AegisVault...");
  const Vault = await ethers.getContractFactory("AegisVault");
  const vault = await Vault.deploy(registryAddress, protocolFeeBps, minDeposit);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   AegisVault deployed to:", vaultAddress);

  // ─── Deploy DecisionLogger ────────────────────────────────
  console.log("\n3. Deploying DecisionLogger...");
  const Logger = await ethers.getContractFactory("DecisionLogger");
  const logger = await Logger.deploy();
  await logger.waitForDeployment();
  const loggerAddress = await logger.getAddress();
  console.log("   DecisionLogger deployed to:", loggerAddress);

  // ─── Configure Permissions ────────────────────────────────
  console.log("\n4. Configuring permissions...");

  // Authorize vault in registry (so vault can update agent stats)
  const tx1 = await registry.setVaultAuthorization(vaultAddress, true);
  await tx1.wait();
  console.log("   ✓ Vault authorized in Registry");

  // Authorize deployer as operator in vault (for agent operations)
  const tx2 = await vault.setOperatorAuthorization(deployer.address, true);
  await tx2.wait();
  console.log("   ✓ Deployer authorized as operator in Vault");

  // Authorize deployer as logger
  const tx3 = await logger.setLoggerAuthorization(deployer.address, true);
  await tx3.wait();
  console.log("   ✓ Deployer authorized as logger in DecisionLogger");

  // ─── Register Initial Agent ───────────────────────────────
  if (skipInitialAgent) {
    console.log("\n5. Skipping initial agent registration (SKIP_INITIAL_AGENT=true)");
  } else {
    console.log("\n5. Registering initial Aegis Guardian Agent...");
    const tx4 = await registry.registerAgent(
      initialAgentName,
      initialAgentMetadataUri,
      initialAgentTier,
      { value: registrationFee }
    );
    await tx4.wait();
    console.log(`   ✓ Agent '${initialAgentName}' registered (ID: 0)`);
  }

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═".repeat(60));
  console.log(`  Network:          ${(await ethers.provider.getNetwork()).name}`);
  console.log(`  Chain ID:         ${(await ethers.provider.getNetwork()).chainId}`);
  console.log(`  Deployer:         ${deployer.address}`);
  console.log(`  AegisRegistry:    ${registryAddress}`);
  console.log(`  AegisVault:       ${vaultAddress}`);
  console.log(`  DecisionLogger:   ${loggerAddress}`);
  console.log("═".repeat(60));

  // Save deployment addresses
  const fs = await import("fs");
  const deploymentData = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      AegisRegistry: registryAddress,
      AegisVault: vaultAddress,
      DecisionLogger: loggerAddress,
    },
    configuration: {
      registrationFee: ethers.formatEther(registrationFee),
      maxAgents: maxAgents,
      protocolFeeBps: protocolFeeBps,
      minDeposit: ethers.formatEther(minDeposit),
    },
  };

  const deploymentFile = `deployment.${network.name}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  fs.writeFileSync("deployment.json", JSON.stringify(deploymentData, null, 2));
  console.log(`\n  Deployment info saved to ${deploymentFile} and deployment.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
