// Contract addresses - deployed on BSC Testnet (Chain ID 97)
export const CONTRACTS = {
  REGISTRY: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "0x7908c25C63AbAB47cb82bE50DBD874ED807EE8fF",
  VAULT: process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x15Ef23024c2b90beA81E002349C70f0C2A09433F",
  DECISION_LOGGER: process.env.NEXT_PUBLIC_LOGGER_ADDRESS || "0x874d78947bd660665de237b16Ca05cd39b7feF6f",
  TOKEN_GATE: process.env.NEXT_PUBLIC_TOKEN_GATE_ADDRESS || "0x672c5cC370085c3c6B5bcf2870e1A0Aa62Ff3D69",
  UNIQ_TOKEN: process.env.NEXT_PUBLIC_UNIQ_TOKEN_ADDRESS || "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777",
};

// $UNIQ Holder Tiers
export const HOLDER_TIERS = ["None", "Bronze", "Silver", "Gold"] as const;
export const HOLDER_TIER_COLORS = ["#6b7280", "#cd7f32", "#c0c0c0", "#ffd700"] as const;
export const HOLDER_TIER_THRESHOLDS = {
  Bronze: 10_000,
  Silver: 100_000,
  Gold:   1_000_000,
};

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

export const RISK_LEVELS = ["None", "Low", "Medium", "High", "Critical"] as const;
export const RISK_COLORS = ["#6b7280", "#22c55e", "#eab308", "#f97316", "#ef4444"] as const;
export const ACTION_TYPES = ["Emergency Withdraw", "Rebalance", "Alert Only", "Stop Loss", "Take Profit"] as const;
export const AGENT_TIERS = ["Scout", "Guardian", "Sentinel", "Archon"] as const;
export const AGENT_STATUSES = ["Active", "Paused", "Decommissioned"] as const;
