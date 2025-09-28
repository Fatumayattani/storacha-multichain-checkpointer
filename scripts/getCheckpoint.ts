import hre from "hardhat";

async function main() {
  const cpAddr = process.env.CHECKPOINTER;
  const id = process.env.CHECKPOINT_ID;

  if (!cpAddr || !id) {
    throw new Error("Set CHECKPOINTER and CHECKPOINT_ID environment variables");
  }

  const cp = await hre.ethers.getContractAt("StorachaCheckpointer", cpAddr);
  const checkpoint = await cp.getCheckpoint(BigInt(id));

  console.log(`Checkpoint ${id}:`);
  console.log(`  Owner: ${checkpoint.owner}`);
  console.log(`  CID: ${checkpoint.cidDigest}`);
  console.log(`  Start: ${checkpoint.startTime}`);
  console.log(`  Expiry: ${checkpoint.expiryTime}`);
  console.log(`  Verified: ${checkpoint.verified}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
