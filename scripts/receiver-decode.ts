import { ethers } from "ethers";

/**
 * Decodes a checkpoint payload encoded in the same format
 * as CheckpointCodec.sol on-chain.
 */
function decodeCheckpoint(payload: string) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const [version, cid, tag, expiresAt, creator, timestamp, sourceChainId] =
    abiCoder.decode(
      ["uint8", "string", "bytes32", "uint256", "address", "uint256", "uint16"],
      payload
    );

  return {
    version: Number(version),
    cid,
    tag: ethers.decodeBytes32String(tag),
    expiresAt: Number(expiresAt),
    creator,
    timestamp: Number(timestamp),
    sourceChainId: Number(sourceChainId),
  };
}

async function main() {
  // Example payload you got from publisher.ts
  // You can copy-paste this from console logs after running your publisher script
  const encodedPayload =
    "0x00000000000000000000000000000000000000000000000000000000000000..."; // replace with real one

  const decoded = decodeCheckpoint(encodedPayload);

  console.log("✅ Decoded Checkpoint Payload:");
  console.log("Version:", decoded.version);
  console.log("CID:", decoded.cid);
  console.log("Tag:", decoded.tag);
  console.log("Expires At:", new Date(decoded.expiresAt * 1000).toISOString());
  console.log("Creator:", decoded.creator);
  console.log("Timestamp:", new Date(decoded.timestamp * 1000).toISOString());
  console.log("Source Chain ID:", decoded.sourceChainId);
}

main().catch((err) => {
  console.error("❌ Failed to decode payload:", err);
});
