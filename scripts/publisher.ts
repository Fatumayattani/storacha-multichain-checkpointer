import { ethers } from "ethers";
import dotenv from "dotenv";
import {
  getWormholeCoreAddress,
  WORMHOLE_CONFIG,
} from "../config/wormhole.config.ts";
import { CHAIN_IDS } from "../constants/chainIds.ts";
import {
  getEmitterAddressEth,
  parseSequenceFromLogEth,
} from "@certusone/wormhole-sdk";

dotenv.config();

const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// ✅ Use Wormhole chain ID constant (not EVM ID)
const SOURCE_CHAIN_ID = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
const WORMHOLE_CORE = getWormholeCoreAddress(SOURCE_CHAIN_ID);

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// ABI for Wormhole Core
const coreAbi = [
  "function publishMessage(uint32 nonce, bytes payload, uint8 consistencyLevel) payable returns (uint64)",
];

/**
 * Encodes a checkpoint message to match CheckpointCodec
 */
function encodeCheckpoint(
  cid: string,
  tag: string,
  expiresAt: number,
  creator: string,
  timestamp: number,
  sourceChainId: number
): string {
  const abiCoder = ethers.utils.defaultAbiCoder;
  return abiCoder.encode(
    ["uint8", "string", "bytes32", "uint256", "address", "uint256", "uint16"],
    [1, cid, tag, expiresAt, creator, timestamp, sourceChainId]
  );
}

/**
 * Publishes a Wormhole message containing checkpoint data
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

  const coreContract = new ethers.Contract(WORMHOLE_CORE, coreAbi, signer);

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

// Run with: npx ts-node scripts/publisher.ts
if (process.argv[1] === new URL(import.meta.url).pathname) {
  (async () => {
    const cid = "bafyExampleCid123";
    const tag = ethers.utils.formatBytes32String("file1");
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    await publishCheckpoint(cid, tag, expiresAt);
  })();
}
