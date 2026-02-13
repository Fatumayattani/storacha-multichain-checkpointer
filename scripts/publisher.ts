import {
  JsonRpcProvider,
  Wallet,
  Contract,
  AbiCoder,
  encodeBytes32String,
} from "ethers";
import dotenv from "dotenv";
import {
  getWormholeCoreAddress,
  WORMHOLE_CONFIG,
} from "../config/wormhole.config.ts";
import { CHAIN_IDS } from "../constants/chainIds.ts";
import {
  getEmitterAddressEth,
  parseSequenceFromLogEth,
} from "@wormhole-foundation/sdk-evm";

dotenv.config();

// quick env sanity checks (safe to log)
console.log("RPC_URL loaded:", process.env.RPC_URL?.slice(0, 40) + "...");
console.log("PRIVATE_KEY loaded:", !!process.env.PRIVATE_KEY);

const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// Wormhole chain ID (use the wormhole constant, not EVM chain id)
const SOURCE_CHAIN_ID = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
const WORMHOLE_CORE = getWormholeCoreAddress(SOURCE_CHAIN_ID);

// ethers v6 provider and signer
const provider = new JsonRpcProvider(RPC_URL);
const signer = new Wallet(PRIVATE_KEY, provider);

// Wormhole core contract ABI (only the fn we need)
const coreAbi = [
  "function publishMessage(uint32 nonce, bytes payload, uint8 consistencyLevel) payable returns (uint64)",
];

/**
 * Encodes a checkpoint message to match the CheckpointCodec used by the Receiver.
 * Types must match the decoding side exactly.
 */
function encodeCheckpoint(
  cid: string,
  tag: string,
  expiresAt: number,
  creator: string,
  timestamp: number,
  sourceChainId: number
): string {
  const abiCoder = new AbiCoder();
  return abiCoder.encode(
    ["uint8", "string", "bytes32", "uint256", "address", "uint256", "uint16"],
    [1, cid, tag, expiresAt, creator, timestamp, sourceChainId]
  );
}

/**
 * Publishes a Wormhole message containing checkpoint data.
 */
export async function publishCheckpoint(
  cid: string,
  tag: string,
  expiresAt: number
) {
  const creator = await signer.getAddress();
  const timestamp = Math.floor(Date.now() / 1000);

  const payload = encodeCheckpoint(
    cid,
    tag,
    expiresAt,
    creator,
    timestamp,
    SOURCE_CHAIN_ID
  );

  console.log("Publishing checkpoint to Wormhole...");
  console.log("Source chain:", SOURCE_CHAIN_ID);
  console.log("Core address:", WORMHOLE_CORE);
  console.log("Payload (encoded):", payload);

  const coreContract = new Contract(WORMHOLE_CORE, coreAbi, signer);

  const tx = await coreContract.publishMessage(
    0, // nonce
    payload,
    WORMHOLE_CONFIG.consistencyLevel,
    { value: 0 }
  );

  const receipt = await tx.wait();
  const sequence = parseSequenceFromLogEth(receipt, WORMHOLE_CORE);
  const emitter = await getEmitterAddressEth(WORMHOLE_CORE);

  console.log("✅ Checkpoint published");
  console.log("Emitter:", emitter);
  console.log("Sequence:", sequence);

  return { emitter, sequence };
}

/**
 * Run script (always executed when file is run directly)
 * Adjust cid/tag/expiresAt as needed.
 */
(async () => {
  try {
    const cid = "bafyExampleCid123";
    const tag = encodeBytes32String("file1"); // ethers v6 helper
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    const result = await publishCheckpoint(cid, tag, expiresAt);
    console.log("✅ Publisher result:", result);
  } catch (err) {
    console.error("❌ Error running publisher:", err);
  }
})();
