// Contract addresses - deployed on BSC Testnet (Chain ID 97)
export const CONTRACTS = {
  SCANNER: process.env.NEXT_PUBLIC_SCANNER_ADDRESS || "0xd347390e2553D3FDC204F6DcF22e31d8E921819B",
  REGISTRY: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF",
  VAULT: process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x15Ef23024c2b90beA81E002349C70f0C2A09433F",
  LOGGER: process.env.NEXT_PUBLIC_LOGGER_ADDRESS || "0x874d78947bd660665de237b16Ca05cd39b7feF6f",
  TOKEN_GATE: process.env.NEXT_PUBLIC_TOKEN_GATE_ADDRESS || "0x672c5cC370085c3c6B5bcf2870e1A0Aa62Ff3D69",
  STAKING: process.env.NEXT_PUBLIC_STAKING_ADDRESS || "0x42f5cA7e5a633dd217Ea7f813Ee2465523A7FC2d",
  CONSENSUS: process.env.NEXT_PUBLIC_CONSENSUS_ADDRESS || "0xD1C2639f1970DA09DE51f1bB5290deda06BfB42b",
  CERTIFICATION: process.env.NEXT_PUBLIC_CERTIFICATION_ADDRESS || "0xABA74d14F489F572ed6520950c7D2059F70F2444",
  UNIQ_TOKEN: process.env.NEXT_PUBLIC_UNIQ_TOKEN_ADDRESS || "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777",
};

// Agent Staking Tiers (AegisStaking)
export const AGENT_TIERS = ["Scout", "Guardian", "Sentinel", "Archon"] as const;
export const AGENT_TIER_THRESHOLDS = {
  Scout: 10_000,
  Guardian: 100_000,
  Sentinel: 500_000,
  Archon: 1_000_000,
};

// $UNIQ Holder Tiers (TokenGate)
export const HOLDER_TIERS = ["None", "Bronze", "Silver", "Gold"] as const;

// Risk scoring
export const RISK_LEVELS = ["Safe", "Low", "Medium", "High", "Critical"] as const;
export const RISK_COLORS = ["#22c55e", "#22c55e", "#eab308", "#f97316", "#ef4444"] as const;

export const CHAIN_CONFIG = {
  bscTestnet: {
    chainId: "0x61",
    chainIdDecimal: 97,
    chainName: "BNB Smart Chain Testnet",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
    blockExplorerUrls: ["https://testnet.bscscan.com"],
  },
  bscMainnet: {
    chainId: "0x38",
    chainIdDecimal: 56,
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed1.binance.org"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
};
