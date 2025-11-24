/**
 * @title Wormhole Configuration
 * @notice Centralized Wormhole testnet configuration
 * @dev Contains Guardian RPC, consistency level, and Wormhole Core addresses
 */

import { CHAIN_IDS } from "../constants/chainIds.ts";

/**
 * @notice Chain-specific Wormhole configuration
 */
export interface ChainConfig {
  /** Wormhole Core contract address */
  wormholeCoreAddress: string;
  /** Human-readable chain name */
  chainName: string;
  /** Block explorer URL */
  explorerUrl: string;
}

/**
 * @notice Wormhole Core addresses by Wormhole chain ID
 * @dev Key is Wormhole chain ID (uint16), not EVM chain ID
 */
export const WORMHOLE_CORE_ADDRESSES: Record<number, string> = {
  [CHAIN_IDS.BASE_SEPOLIA_WORMHOLE]:
    "0x79A1027a6A159502049F10906D333EC57E95F083",
  [CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE]:
    "0x7bbcE28e64B3F8b84d876Ab298393c38ad7aac4C",
  [CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE]:
    "0x4a8bc80Ed5a4067f1FFf25799C844145DDF9e5e5",
};

/**
 * @notice Chain metadata by Wormhole chain ID
 */
export const CHAIN_METADATA: Record<
  number,
  Omit<ChainConfig, "wormholeCoreAddress">
> = {
  [CHAIN_IDS.BASE_SEPOLIA_WORMHOLE]: {
    chainName: "Base Sepolia",
    explorerUrl: "https://sepolia.basescan.org",
  },
  [CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE]: {
    chainName: "Avalanche Fuji",
    explorerUrl: "https://testnet.snowtrace.io",
  },
  [CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE]: {
    chainName: "Ethereum Sepolia",
    explorerUrl: "https://sepolia.etherscan.io",
  },
};

/**
 * @notice Testnet Wormhole configuration
 */
export const WORMHOLE_CONFIG = {
  /** Guardian RPC endpoint for testnet */
  guardianRPC: "https://api.testnet.wormholescan.io",

  /** Consistency level (1 = immediate, 15 = finalized) */
  consistencyLevel: 1,
} as const;

/**
 * @notice Get Wormhole Core address by Wormhole chain ID
 * @param wormholeChainId Wormhole chain ID from message
 * @returns Wormhole Core address
 * @throws Error if chain not supported
 */
export function getWormholeCoreAddress(wormholeChainId: number): string {
  const address = WORMHOLE_CORE_ADDRESSES[wormholeChainId];
  if (!address) {
    throw new Error(
      `No Wormhole Core address for chain ID: ${wormholeChainId}`
    );
  }
  return address;
}

/**
 * @notice Get chain metadata by Wormhole chain ID
 * @param wormholeChainId Wormhole chain ID
 * @returns Chain metadata
 * @throws Error if chain not supported
 */
export function getChainMetadata(
  wormholeChainId: number
): Omit<ChainConfig, "wormholeCoreAddress"> {
  const metadata = CHAIN_METADATA[wormholeChainId];
  if (!metadata) {
    throw new Error(`No metadata for chain ID: ${wormholeChainId}`);
  }
  return metadata;
}

/**
 * @notice Get complete chain config by Wormhole chain ID
 * @param wormholeChainId Wormhole chain ID
 * @returns Complete chain configuration
 * @throws Error if chain not supported
 */
export function getChainConfig(wormholeChainId: number): ChainConfig {
  return {
    wormholeCoreAddress: getWormholeCoreAddress(wormholeChainId),
    ...getChainMetadata(wormholeChainId),
  };
}

/**
 * @notice Check if Wormhole chain is supported
 * @param wormholeChainId Wormhole chain ID
 * @returns True if supported
 */
export function isChainSupported(wormholeChainId: number): boolean {
  return wormholeChainId in WORMHOLE_CORE_ADDRESSES;
}
