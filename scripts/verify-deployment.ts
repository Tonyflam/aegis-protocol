import fs from "fs";
import path from "path";
import { run, network } from "hardhat";

type DeploymentFile = {
  contracts: {
    AegisRegistry: string;
    AegisVault: string;
    DecisionLogger: string;
  };
  configuration: {
    registrationFee: string;
    maxAgents: number;
    protocolFeeBps: number;
    minDeposit: string;
  };
};

function loadDeploymentFile(): DeploymentFile {
  const explicit = process.env.DEPLOYMENT_FILE;
  const preferred = explicit || `deployment.${network.name}.json`;
  const preferredPath = path.resolve(preferred);
  const fallbackPath = path.resolve("deployment.json");

  if (fs.existsSync(preferredPath)) {
    return JSON.parse(fs.readFileSync(preferredPath, "utf8")) as DeploymentFile;
  }
  if (fs.existsSync(fallbackPath)) {
    return JSON.parse(fs.readFileSync(fallbackPath, "utf8")) as DeploymentFile;
  }

  throw new Error(
    `No deployment file found. Tried ${preferredPath} and ${fallbackPath}. ` +
      "Run deploy first or set DEPLOYMENT_FILE."
  );
}

async function verifyContract(address: string, constructorArguments: unknown[]) {
  try {
    await run("verify:verify", {
      address,
      constructorArguments,
    });
    console.log(`   Verified: ${address}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already verified")) {
      console.log(`   Already verified: ${address}`);
      return;
    }
    throw error;
  }
}

async function main() {
  const deployment = loadDeploymentFile();
  const { contracts, configuration } = deployment;

  console.log(`Verifying deployment on network: ${network.name}`);
  console.log(`Registry: ${contracts.AegisRegistry}`);
  console.log(`Vault: ${contracts.AegisVault}`);
  console.log(`Logger: ${contracts.DecisionLogger}`);

  console.log("\n1) Verifying AegisRegistry...");
  await verifyContract(contracts.AegisRegistry, [
    configuration.registrationFee,
    configuration.maxAgents,
  ]);

  console.log("\n2) Verifying AegisVault...");
  await verifyContract(contracts.AegisVault, [
    contracts.AegisRegistry,
    configuration.protocolFeeBps,
    configuration.minDeposit,
  ]);

  console.log("\n3) Verifying DecisionLogger...");
  await verifyContract(contracts.DecisionLogger, []);

  console.log("\nVerification flow complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
