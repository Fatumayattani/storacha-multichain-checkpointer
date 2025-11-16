import { Chain } from "viem";

// Base Sepolia testnet configuration
export const baseSepolia: Chain = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://sepolia.base.org"],
    },
    public: {
      http: ["https://sepolia.base.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url: "https://sepolia.basescan.org",
    },
  },
  testnet: true,
};

// Avalanche Fuji testnet configuration
export const avalancheFuji: Chain = {
  id: 43113,
  name: "Avalanche Fuji",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://api.avax-test.network/ext/bc/C/rpc"],
    },
    public: {
      http: ["https://api.avax-test.network/ext/bc/C/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "SnowTrace",
      url: "https://testnet.snowtrace.io",
    },
  },
  testnet: true,
};

// Ethereum Sepolia (for future use)
export const ethereumSepolia: Chain = {
  id: 11155111,
  name: "Ethereum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.sepolia.org"],
    },
    public: {
      http: ["https://rpc.sepolia.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://sepolia.etherscan.io",
    },
  },
  testnet: true,
};

// Supported chains array
export const supportedChains = [baseSepolia, avalancheFuji] as const;

// Chain mapping for easy lookup
export const chainMap = {
  [baseSepolia.id]: baseSepolia,
  [avalancheFuji.id]: avalancheFuji,
  [ethereumSepolia.id]: ethereumSepolia,
} as const;

// Get chain by ID
export function getChainById(chainId: number): Chain | undefined {
  return chainMap[chainId as keyof typeof chainMap];
}

// Check if chain is supported
export function isSupportedChain(chainId: number): boolean {
  return chainId in chainMap;
}

// Wormhole chain ID mapping (EVM chain ID -> Wormhole chain ID)
export const wormholeChainMap = {
  [baseSepolia.id]: 30, // Base Sepolia Wormhole chain ID
  [avalancheFuji.id]: 6, // Avalanche Fuji Wormhole chain ID
  [ethereumSepolia.id]: 10001, // Ethereum Sepolia Wormhole chain ID
} as const;

// Get Wormhole chain ID from EVM chain ID
export function getWormholeChainId(evmChainId: number): number | undefined {
  return wormholeChainMap[evmChainId as keyof typeof wormholeChainMap];
}
