import { useState, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseEther, encodePacked, keccak256 } from "viem";
import {
  getContractAddress,
  getContractABI,
  ContractType,
  CHAIN_IDS,
  type SupportedChainId,
} from "../lib/contracts";

export interface CreateCheckpointParams {
  cid: string;
  tag: string;
  duration: number; // in seconds
  publishToWormhole: boolean;
  verifierData?: `0x${string}`; // optional, defaults to empty bytes
}

export interface Checkpoint {
  user: `0x${string}`;
  cid: string;
  tag: `0x${string}`;
  expiresAt: bigint;
  timestamp: bigint;
  verified: boolean;
  revoked: boolean;
}

export function useStorachaCheckpointer() {
  const { chain, address } = useAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine contract type based on chain
  const contractType =
    chain?.id === CHAIN_IDS.BASE_SEPOLIA
      ? ContractType.PUBLISHER
      : ContractType.RECEIVER;

  // Get contract address for current chain
  const contractAddress = chain?.id
    ? getContractAddress(chain.id as SupportedChainId, contractType)
    : null;

  // Contract write
  const {
    writeContract,
    data: hash,
    isPending,
    isError,
    error: contractError,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Read price per second
  const { data: pricePerSecond } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: getContractABI(),
    functionName: "pricePerSecondWei",
    query: {
      enabled: !!contractAddress && chain?.id !== undefined,
    },
  });

  const { data: wormholeFee } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: getContractABI(),
    functionName: "getWormholeFee",
    query: {
      enabled: !!contractAddress && chain?.id !== undefined,
    },
  });

  const { data: nextCheckpointId, refetch: refetchNextCheckpointId } =
    useReadContract({
      address: contractAddress as `0x${string}`,
      abi: getContractABI(),
      functionName: "nextCheckpointId",
      query: {
        enabled: !!contractAddress && chain?.id !== undefined,
      },
    });

  // Calculate checkpoint cost
  const calculateCost = useCallback(
    (duration: number, publishToWormhole: boolean = false): bigint => {
      let cost = BigInt(0);
      if (pricePerSecond) {
        cost = BigInt(pricePerSecond.toString()) * BigInt(duration);
      } else {
        // Fallback: 0.001 ETH per second (as per contract default)
        cost = parseEther("0.001") * BigInt(duration);
      }

      if (publishToWormhole && wormholeFee) {
        cost += BigInt(wormholeFee.toString());
      }

      return cost;
    },
    [pricePerSecond, wormholeFee]
  );

  // Create a checkpoint
  const createCheckpoint = useCallback(
    async (params: CreateCheckpointParams) => {
      if (!chain) {
        throw new Error("No chain connected");
      }

      if (!contractAddress) {
        throw new Error(
          `Contract not deployed on ${chain.name}. Please check your environment configuration.`
        );
      }

      if (!address) {
        throw new Error("Wallet not connected");
      }

      setIsCreating(true);
      setError(null);

      try {
        // Convert tag string to bytes32
        const tagBytes32 = keccak256(encodePacked(["string"], [params.tag]));

        // Calculate cost for the duration and wormhole fee
        const cost = calculateCost(params.duration, params.publishToWormhole);

        // Use empty verifier data for MVP (as per contract comment about MockVerifier)
        const verifierData = params.verifierData || "0x";

        console.log("🔄 Creating checkpoint with params:", {
          cid: params.cid,
          duration: params.duration,
          verifierData,
          tag: params.tag,
          tagBytes32,
          publishToWormhole: params.publishToWormhole,
          cost: cost.toString(),
          contractAddress,
        });

        // Call the contract
        writeContract({
          address: contractAddress as `0x${string}`,
          abi: getContractABI(),
          functionName: "createCheckpoint",
          args: [
            params.cid,
            BigInt(params.duration),
            verifierData,
            tagBytes32,
            params.publishToWormhole,
          ],
          value: cost,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create checkpoint";
        setError(errorMessage);
        setIsCreating(false);
        throw new Error(errorMessage);
      }
    },
    [chain, contractAddress, address, calculateCost, writeContract]
  );

  const revokeCheckpoint = useCallback(
    async (id: bigint, publishToWormhole: boolean) => {
      if (!chain) throw new Error("No chain connected");
      if (!contractAddress) throw new Error("Contract not deployed");
      if (!address) throw new Error("Wallet not connected");

      setIsCreating(true);
      setError(null);

      try {
        const cost =
          publishToWormhole && wormholeFee
            ? BigInt(wormholeFee.toString())
            : BigInt(0);

        console.log("🔄 Revoking checkpoint:", {
          id: id.toString(),
          publishToWormhole,
          cost: cost.toString(),
        });

        writeContract({
          address: contractAddress as `0x${string}`,
          abi: getContractABI(),
          functionName: "revokeCheckpoint",
          args: [id, publishToWormhole],
          value: cost,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to revoke checkpoint";
        setError(errorMessage);
        setIsCreating(false);
        throw new Error(errorMessage);
      }
    },
    [chain, contractAddress, address, wormholeFee, writeContract]
  );

  // Get checkpoint by user and tag
  const getCheckpointByTag = useCallback(
    async (
      tag: string
    ): Promise<{ checkpoint: Checkpoint; id: bigint } | null> => {
      if (!contractAddress || !address) {
        return null;
      }

      try {
        // Convert tag to bytes32 when implementing actual contract call
        // const tagBytes32 = keccak256(encodePacked(['string'], [tag]))

        // Note: This would need to be implemented as a read function call
        // For now, return null as this requires actual contract deployment
        console.log("Getting checkpoint for tag:", tag);
        return null;
      } catch (err) {
        console.error("Error fetching checkpoint:", err);
        return null;
      }
    },
    [contractAddress, address]
  );

  // Reset state
  const reset = useCallback(() => {
    setIsCreating(false);
    setError(null);
  }, []);

  return {
    // Contract info
    contractAddress,
    isContractAvailable: !!contractAddress,
    contractType,
    pricePerSecond,
    nextCheckpointId: nextCheckpointId as bigint | undefined,

    // Transaction state
    createCheckpoint,
    revokeCheckpoint,
    hash,
    isCreating: isCreating || isPending,
    isConfirming,
    isSuccess,
    isError: isError || !!error,
    error: error || contractError?.message,

    // Utilities
    calculateCost,
    getCheckpointByTag,
    refetchNextCheckpointId,
    reset,
    clearError: () => setError(null),
  };
}

export default useStorachaCheckpointer;
