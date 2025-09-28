import { ethers } from "ethers";

async function main() {
  const payload = process.env.PAYLOAD_HEX;
  if (!payload) {
    throw new Error("Set PAYLOAD_HEX environment variable");
  }

  const abi = new ethers.AbiCoder();
  const [version, id, owner, cid, start, expiry, verified] = abi.decode(
    ["uint8", "uint256", "address", "bytes32", "uint64", "uint64", "bool"],
    payload
  );

  console.log("Decoded Payload:");
  console.log(`  Version: ${version}`);
  console.log(`  ID: ${id}`);
  console.log(`  Owner: ${owner}`);
  console.log(`  CID: ${cid}`);
  console.log(`  Start: ${start}`);
  console.log(`  Expiry: ${expiry}`);
  console.log(`  Verified: ${verified}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
