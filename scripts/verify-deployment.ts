import { ethers } from "hardhat";

async function main() {
  console.log("\n=== AEGIS PROTOCOL — DEPLOYMENT VERIFICATION ===\n");

  const contracts: Record<string, string> = {
    AegisScanner: "0xd347390e2553D3FDC204F6DcF22e31d8E921819B",
    AegisStaking: "0x42f5cA7e5a633dd217Ea7f813Ee2465523A7FC2d",
    AegisConsensus: "0xD1C2639f1970DA09DE51f1bB5290deda06BfB42b",
    AegisCertification: "0xABA74d14F489F572ed6520950c7D2059F70F2444",
    AegisRegistry: "0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF",
    DecisionLogger: "0x874d78947bd660665de237b16Ca05cd39b7feF6f",
    AegisTokenGate: "0x672c5cC370085c3c6B5bcf2870e1A0Aa62Ff3D69",
    AegisVault: "0x15Ef23024c2b90beA81E002349C70f0C2A09433F",
  };

  // 1. Verify all contracts exist on-chain
  console.log("1. Contract bytecode verification:");
  for (const [name, addr] of Object.entries(contracts)) {
    const code = await ethers.provider.getCode(addr);
    const status = code.length > 2 ? `✓ DEPLOYED (${code.length} bytes)` : "✗ NOT FOUND";
    console.log(`   ${name}: ${status}`);
  }

  // 2. Verify Scanner accepts reads
  console.log("\n2. AegisScanner read verification:");
  const scanner = await ethers.getContractAt("AegisScanner", contracts.AegisScanner);
  const stats = await scanner.getScannerStats();
  console.log(`   Total scans: ${stats[0]}`);
  console.log(`   Total honeypots: ${stats[1]}`);
  console.log(`   Total rug risks: ${stats[2]}`);
  console.log(`   Total tokens: ${stats[3]}`);

  // 3. Verify Registry reads
  console.log("\n3. AegisRegistry read verification:");
  const registry = await ethers.getContractAt("AegisRegistry", contracts.AegisRegistry);
  const agentCount = await registry.getAgentCount();
  console.log(`   Agent count: ${agentCount}`);

  // 4. Verify DecisionLogger reads
  console.log("\n4. DecisionLogger read verification:");
  const logger = await ethers.getContractAt("DecisionLogger", contracts.DecisionLogger);
  const [signer] = await ethers.getSigners();
  const decisionCount = await logger.getDecisionCount();
  console.log(`   Total decisions logged: ${decisionCount}`);

  // 5. Test scan submission
  console.log("\n5. Test scan submission:");
  const testToken = "0x0000000000000000000000000000000000000001";
  try {
    // Check if already scanned
    const isScanned = await scanner.isScanned(testToken);
    if (isScanned) {
      console.log("   Test token already scanned — skipping duplicate submission");
      const scan = await scanner.getTokenScan(testToken);
      console.log(`   Existing scan: score=${scan.riskScore}, flags="${scan.flags}"`);
    } else {
      const boolFlags: boolean[] = [false, false, false, false, false, false, true];
      const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes("Verification test scan " + Date.now()));

      const tx = await scanner["submitScan(address,uint256,uint256,uint256,uint256,uint256,uint256,bool[7],string,bytes32)"](
        testToken, 15, 0, 100, 500, 0, 0, boolFlags, "VERIFIED,TEST", reasoningHash
      );
      const receipt = await tx.wait();
      console.log(`   ✓ Submission accepted — tx: ${receipt!.hash}`);

      // Verify it stored correctly
      const result = await scanner.getTokenScan(testToken);
      console.log(`   ✓ Read back: score=${result.riskScore}, flags="${result.flags}"`);
      
      // Verify isTokenSafe
      const safe = await scanner.isTokenSafe(testToken);
      console.log(`   ✓ isTokenSafe: ${safe}`);
    }
  } catch (err: any) {
    console.log(`   ✗ Submission failed: ${err.message?.slice(0, 100)}`);
  }

  // 6. Check wallet
  console.log("\n6. Wallet status:");
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`   Address: ${signer.address}`);
  console.log(`   Balance: ${ethers.formatEther(balance)} tBNB`);

  const network = await ethers.provider.getNetwork();
  console.log(`   Chain ID: ${network.chainId}`);

  console.log("\n=== VERIFICATION COMPLETE ===\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
