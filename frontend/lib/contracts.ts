/**
 * Contract Configuration Utility
 * Manages contract addresses and ABIs across different networks
 */

import { ABI as STORACHA_CHECKPOINTER_ABI } from "../constants";

// Supported chain IDs
export const CHAIN_IDS = {
  BASE_SEPOLIA: 84532,
  AVALANCHE_FUJI: 43113,
} as const;

export type SupportedChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

// Contract types
export enum ContractType {
  PUBLISHER = "PUBLISHER",
  RECEIVER = "RECEIVER",
}

// Contract address configuration
interface ContractAddresses {
  [ContractType.PUBLISHER]?: `0x${string}`;
  [ContractType.RECEIVER]?: `0x${string}`;
}

// Chain configuration
interface ChainConfig {
  chainId: number;
  name: string;
  contracts: ContractAddresses;
  isTestnet: boolean;
  blockExplorer: string;
  wormholeChainId: number;
}

// Chain configurations (static info only)
export const CHAIN_CONFIGS: Record<
  SupportedChainId,
  Omit<ChainConfig, "contracts">
> = {
  [CHAIN_IDS.BASE_SEPOLIA]: {
    chainId: CHAIN_IDS.BASE_SEPOLIA,
    name: "Base Sepolia",
    isTestnet: true,
    blockExplorer: "https://sepolia.basescan.org",
    wormholeChainId: 30, // Wormhole chain ID for Base
  },
  [CHAIN_IDS.AVALANCHE_FUJI]: {
    chainId: CHAIN_IDS.AVALANCHE_FUJI,
    name: "Avalanche Fuji",
    isTestnet: true,
    blockExplorer: "https://testnet.snowtrace.io",
    wormholeChainId: 6, // Wormhole chain ID for Avalanche
  },
};

// Contract addresses - Update these when contracts are deployed
const CONTRACT_ADDRESSES = {
  BASE_SEPOLIA_PUBLISHER: "" as `0x${string}` | "", // TODO: Update with deployed address
  AVALANCHE_FUJI_RECEIVER:
    "0x75d2b02f5980D4D1BB6cf7d3829A7a1F3BB1Ef76" as `0x${string}`,
};

// Dynamic contract address lookup
function getContractAddressFromEnv(
  chainId: SupportedChainId,
  contractType: ContractType
): `0x${string}` | undefined {
  console.log(
    `[getContractAddressFromEnv] Looking up ${contractType} on chain ${chainId}`
  );

  let address: `0x${string}` | "" | undefined;

  if (
    chainId === CHAIN_IDS.BASE_SEPOLIA &&
    contractType === ContractType.PUBLISHER
  ) {
    // Try env var first, fallback to hardcoded
    address =
      (process.env
        .NEXT_PUBLIC_BASE_SEPOLIA_PUBLISHER_ADDRESS as `0x${string}`) ||
      CONTRACT_ADDRESSES.BASE_SEPOLIA_PUBLISHER;
  } else if (
    chainId === CHAIN_IDS.AVALANCHE_FUJI &&
    contractType === ContractType.RECEIVER
  ) {
    // Try env var first, fallback to hardcoded
    address =
      (process.env.NEXT_PUBLIC_FUJI_RECEIVER_ADDRESS as `0x${string}`) ||
      CONTRACT_ADDRESSES.AVALANCHE_FUJI_RECEIVER;
  } else {
    console.log(
      `[getContractAddressFromEnv] No contract configured for ${contractType} on chain ${chainId}`
    );
    return undefined;
  }

  console.log(`[getContractAddressFromEnv] Resolved address:`, address);

  if (
    !address ||
    address === "0x0000000000000000000000000000000000000000"
  ) {
    console.log(`[getContractAddressFromEnv] Address is empty or zero address`);
    return undefined;
  }

  console.log(`[getContractAddressFromEnv] Returning:`, address);
  return address as `0x${string}`;
}

/**
 * Get contract address for a specific chain and contract type
 */
export function getContractAddress(
  chainId: SupportedChainId,
  contractType: ContractType
): `0x${string}` | null {
  console.log(
    `[getContractAddress] Looking up ${contractType} on chain ${chainId}`
  );

  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    console.warn(`[getContractAddress] Chain ID ${chainId} not supported`);
    return null;
  }

  console.log(`[getContractAddress] Config found:`, config);

  // Get address dynamically from environment
  const address = getContractAddressFromEnv(chainId, contractType);

  if (!address) {
    console.warn(
      `[getContractAddress] Contract ${contractType} not deployed on ${config.name} (Chain ID: ${chainId})`
    );
    return null;
  }

  console.log(`[getContractAddress] Found address:`, address);
  return address;
}

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: number): Omit<ChainConfig, "contracts"> | null {
  return CHAIN_CONFIGS[chainId as SupportedChainId] || null;
}

/**
 * Check if a contract is deployed on a specific chain
 */
export function isContractDeployed(
  chainId: SupportedChainId,
  contractType: ContractType
): boolean {
  return getContractAddress(chainId, contractType) !== null;
}

/**
 * Get contract ABI
 */
export function getContractABI() {
  return STORACHA_CHECKPOINTER_ABI;
}

/**
 * Get block explorer URL for a transaction
 */
export function getTransactionUrl(
  chainId: SupportedChainId,
  txHash: string
): string {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) return "";
  return `${config.blockExplorer}/tx/${txHash}`;
}

/**
 * Get block explorer URL for an address
 */
export function getAddressUrl(
  chainId: SupportedChainId,
  address: string
): string {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) return "";
  return `${config.blockExplorer}/address/${address}`;
}

/**
 * Get all supported chains
 */
export function getSupportedChains(): Omit<ChainConfig, "contracts">[] {
  return Object.values(CHAIN_CONFIGS);
}

/**
 * Check if chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CHAIN_CONFIGS;
}

/**
 * Get Wormhole chain ID from EVM chain ID
 */
export function getWormholeChainId(chainId: SupportedChainId): number {
  const config = CHAIN_CONFIGS[chainId];
  return config?.wormholeChainId || 0;
}

/**
 * Get chain name by chain ID
 */
export function getChainName(chainId: number): string {
  const config = getChainConfig(chainId);
  return config?.name || "Unknown Chain";
}
