/**
 * scripts/deploy-campaign.ts — Day -1 deployment.
 *
 * Deploys both campaign contracts to BSC mainnet:
 *   1. AegisCampaignClaim (Merkle distributor + 14-day linear vest)
 *      - Funded post-deploy with 25,000,000 $UNIQ from treasury
 *      - Merkle root set by scripts/draw.ts output on Jun 1
 *   2. AegisPass (soulbound ERC-721 tier pass)
 *      - Minted to top-6 winners on Jun 1 (1 Silver + 5 Bronze)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-campaign.ts --network bsc-mainnet
 *
 * Required env:
 *   PRIVATE_KEY — deployer key with ~0.05 BNB
 *
 * Outputs (printed):
 *   - CAMPAIGN_CLAIM address  → set NEXT_PUBLIC_CAMPAIGN_CLAIM_ADDRESS in Vercel
 *   - AEGIS_PASS address      → set NEXT_PUBLIC_AEGIS_PASS_ADDRESS in Vercel
 *   - Bscscan verify commands ready to paste
 */

import { ethers } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== 56) {
    throw new Error(`Expected BSC mainnet (chainId 56), got ${network.chainId}`);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  const UNIQ_TOKEN = "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777";
  const TREASURY = process.env.TREASURY_ADDRESS || deployer.address;
  const PASS_BASE_URI = process.env.PASS_BASE_URI || "https://aegisguardian.xyz/api/pass/";

  console.log("═".repeat(60));
  console.log("  AEGIS PROTECTOR HUNT — DAY -1 DEPLOYMENT");
  console.log("═".repeat(60));
  console.log("  Deployer:    ", deployer.address);
  console.log("  Balance:     ", ethers.formatEther(balance), "BNB");
  console.log("  $UNIQ:       ", UNIQ_TOKEN);
  console.log("  Treasury:    ", TREASURY);
  console.log("  Pass baseURI:", PASS_BASE_URI);
  console.log("═".repeat(60));

  if (balance < ethers.parseEther("0.02")) {
    throw new Error("Need ≥ 0.02 BNB for deployment");
  }

  // ─── 1. AegisCampaignClaim ────────────────────────────────
  console.log("\n[1/2] Deploying AegisCampaignClaim...");
  const Claim = await ethers.getContractFactory("AegisCampaignClaim");
  const claim = await Claim.deploy(UNIQ_TOKEN);
  await claim.waitForDeployment();
  const claimAddr = await claim.getAddress();
  console.log("      ✅", claimAddr);

  // ─── 2. AegisPass ─────────────────────────────────────────
  console.log("\n[2/2] Deploying AegisPass...");
  const Pass = await ethers.getContractFactory("AegisPass");
  const pass = await Pass.deploy(PASS_BASE_URI);
  await pass.waitForDeployment();
  const passAddr = await pass.getAddress();
  console.log("      ✅", passAddr);

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  DEPLOYED — SET THESE IN VERCEL ENV");
  console.log("═".repeat(60));
  console.log(`  NEXT_PUBLIC_CAMPAIGN_CLAIM_ADDRESS=${claimAddr}`);
  console.log(`  NEXT_PUBLIC_AEGIS_PASS_ADDRESS=${passAddr}`);
  console.log("");
  console.log("  Next steps (manual):");
  console.log(`  1. Transfer 25,000,000 $UNIQ from treasury → ${claimAddr}`);
  console.log(`  2. Verify on bscscan:`);
  console.log(`     npx hardhat verify --network bsc-mainnet ${claimAddr} ${UNIQ_TOKEN}`);
  console.log(`     npx hardhat verify --network bsc-mainnet ${passAddr} "${PASS_BASE_URI}"`);
  console.log(`  3. Tweet launch thread with addresses (see CAMPAIGN_PROTECTOR_HUNT.md Day -1)`);
  console.log("═".repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
