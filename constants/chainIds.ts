/**
 * @title Chain ID Constants
 * @notice Standardized chain ID mappings for Wormhole cross-chain communication
 * @dev These constants ensure consistent chain identification across the system
 */

/**
 * @notice EVM and Wormhole chain ID constants
 * @dev EVM chain IDs are used by Ethereum clients, Wormhole chain IDs are used in cross-chain messages
 */
export const CHAIN_IDS = {
  // EVM Chain IDs (used by RPC providers and wallets)
  BASE_SEPOLIA_EVM: 84532,
  AVALANCHE_FUJI_EVM: 43113,
  ETHEREUM_SEPOLIA_EVM: 11155111,

  // Wormhole Chain IDs (used in cross-chain messages)
  BASE_SEPOLIA_WORMHOLE: 10004,
  AVALANCHE_FUJI_WORMHOLE: 6,
  ETHEREUM_SEPOLIA_WORMHOLE: 10002,
} as const;

/**
 * @notice Convert EVM chain ID to Wormhole chain ID
 * @param evmChainId The EVM chain ID to convert
 * @returns The corresponding Wormhole chain ID
 * @throws Error if EVM chain ID is not supported
 */
export function evmToWormholeChainId(evmChainId: number): number {
  switch (evmChainId) {
    case CHAIN_IDS.BASE_SEPOLIA_EVM:
      return CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
    case CHAIN_IDS.AVALANCHE_FUJI_EVM:
      return CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE;
    case CHAIN_IDS.ETHEREUM_SEPOLIA_EVM:
      return CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE;
    default:
      throw new Error(`Unsupported EVM chain ID: ${evmChainId}`);
  }
}

/**
 * @notice Convert Wormhole chain ID to EVM chain ID
 * @param wormholeChainId The Wormhole chain ID to convert
 * @returns The corresponding EVM chain ID
 * @throws Error if Wormhole chain ID is not supported
 */
export function wormholeToEvmChainId(wormholeChainId: number): number {
  switch (wormholeChainId) {
    case CHAIN_IDS.BASE_SEPOLIA_WORMHOLE:
      return CHAIN_IDS.BASE_SEPOLIA_EVM;
    case CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE:
      return CHAIN_IDS.AVALANCHE_FUJI_EVM;
    case CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE:
      return CHAIN_IDS.ETHEREUM_SEPOLIA_EVM;
    default:
      throw new Error(`Unsupported Wormhole chain ID: ${wormholeChainId}`);
  }
}

/**
 * @notice Check if an EVM chain ID is supported
 * @param evmChainId The EVM chain ID to check
 * @returns True if supported, false otherwise
 */
export function isSupportedEvmChainId(evmChainId: number): boolean {
  return (
    evmChainId === CHAIN_IDS.BASE_SEPOLIA_EVM ||
    evmChainId === CHAIN_IDS.AVALANCHE_FUJI_EVM ||
    evmChainId === CHAIN_IDS.ETHEREUM_SEPOLIA_EVM
  );
}

/**
 * @notice Check if a Wormhole chain ID is supported
 * @param wormholeChainId The Wormhole chain ID to check
 * @returns True if supported, false otherwise
 */
export function isSupportedWormholeChainId(wormholeChainId: number): boolean {
  return (
    wormholeChainId === CHAIN_IDS.BASE_SEPOLIA_WORMHOLE ||
    wormholeChainId === CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE ||
    wormholeChainId === CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE
  );
}

/**
 * @notice Get human-readable chain name from EVM chain ID
 * @param evmChainId The EVM chain ID
 * @returns Human-readable chain name
 */
export function getChainName(evmChainId: number): string {
  switch (evmChainId) {
    case CHAIN_IDS.BASE_SEPOLIA_EVM:
      return "Base Sepolia";
    case CHAIN_IDS.AVALANCHE_FUJI_EVM:
      return "Avalanche Fuji";
    case CHAIN_IDS.ETHEREUM_SEPOLIA_EVM:
      return "Ethereum Sepolia";
    default:
      return "Unknown Chain";
  }
}
