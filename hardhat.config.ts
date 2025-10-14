import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

// ✅ Safe fallback loader for environment variables
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;

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

    // ✅ Only register Sepolia if env vars exist
    ...(SEPOLIA_RPC_URL && SEPOLIA_PRIVATE_KEY
      ? {
          sepolia: {
            type: "http",
            chainType: "l1",
            url: SEPOLIA_RPC_URL,
            accounts: [SEPOLIA_PRIVATE_KEY],
          },
        }
      : {}),
  },
};

export default config;
