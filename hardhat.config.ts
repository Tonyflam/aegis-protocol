import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

function normalizePrivateKey(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "your_private_key_here") return undefined;
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-fA-F]{64}$/.test(prefixed) ? prefixed : undefined;
}

const PRIVATE_KEY = normalizePrivateKey(process.env.PRIVATE_KEY);
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const BSC_TESTNET_RPC = process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545";
const BSC_MAINNET_RPC = process.env.BSC_MAINNET_RPC || "https://bsc-dataseed1.binance.org";
const OPBNB_TESTNET_RPC = process.env.OPBNB_TESTNET_RPC || "https://opbnb-testnet-rpc.bnbchain.org";
const OPBNB_MAINNET_RPC = process.env.OPBNB_MAINNET_RPC || "https://opbnb-mainnet-rpc.bnbchain.org";
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    bscTestnet: {
      url: BSC_TESTNET_RPC,
      chainId: 97,
      accounts,
      gasPrice: 10000000000,
    },
    bscMainnet: {
      url: BSC_MAINNET_RPC,
      chainId: 56,
      accounts,
      gasPrice: 3000000000,
    },
    opBNBTestnet: {
      url: OPBNB_TESTNET_RPC,
      chainId: 5611,
      accounts,
      gasPrice: 1000000000,
    },
    opBNB: {
      url: OPBNB_MAINNET_RPC,
      chainId: 204,
      accounts,
      gasPrice: 1000000000,
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: BSCSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY,
    },
  },
  sourcify: {
    enabled: true,
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
