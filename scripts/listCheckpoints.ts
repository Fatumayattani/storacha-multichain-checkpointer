import hre from "hardhat";

async function main() {
  const cpAddr = process.env.CHECKPOINTER;
  const cid = process.env.CID_DIGEST;

  if (!cpAddr || !cid) {
    throw new Error("Set CHECKPOINTER and CID_DIGEST environment variables");
  }
  const cp = await hre.ethers.getContractAt("StorachaCheckpointer", cpAddr);
  const ids: bigint[] = await cp.getCheckpointsByCid(cid);
  console.log(`Checkpoints for CID ${cid}:`);
  for (const id of ids) {
    const checkpoint = await cp.getCheckpoint(id);
    console.log(`- ID: ${id}`);
    console.log(`  Owner: ${checkpoint.owner}`);
    console.log(`  Start: ${checkpoint.startTime}`);
    console.log(`  Expiry: ${checkpoint.expiryTime}`);
    console.log(`  Verified: ${checkpoint.verified}`);
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
