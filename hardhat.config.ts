import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "dotenv/config";

// ✅ Safe fallback loader for environment variables
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;
const AVALANCHE_FUJI_RPC_URL = process.env.AVALANCHE_FUJI_RPC_URL;
const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;
const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY || SEPOLIA_PRIVATE_KEY;

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin],

  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    // ✅ Local simulated networks
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },

    // ✅ Testnet networks (only register if env vars exist)
    ...(SEPOLIA_RPC_URL && DEPLOYER_PRIVATE_KEY
      ? {
          sepolia: {
            type: "http",
            chainType: "l1",
            url: SEPOLIA_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
          },
        }
      : {}),
    ...(AVALANCHE_FUJI_RPC_URL && DEPLOYER_PRIVATE_KEY
      ? {
          avalancheFuji: {
            type: "http",
            chainType: "l1",
            url: AVALANCHE_FUJI_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            chainId: 43113,
          },
        }
      : {}),
    ...(BASE_SEPOLIA_RPC_URL && DEPLOYER_PRIVATE_KEY
      ? {
          baseSepolia: {
            type: "http",
            chainType: "l1",
            url: BASE_SEPOLIA_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            chainId: 84532,
          },
        }
      : {}),
  },
};

export default config;
