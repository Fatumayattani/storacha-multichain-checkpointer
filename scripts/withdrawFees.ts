import hre from "hardhat";
import { ethers } from "hardhat";

async function main() {
  const cpAddr = process.env.CHECKPOINTER;
  const to = process.env.WITHDRAW_TO;
  const amount = process.env.AMOUNT_WEI;

  if (!cpAddr || !to || !amount) {
    throw new Error("Set CHECKPOINTER, WITHDRAW_TO, and AMOUNT_WEI environment variables");
  }
  const [signer] = await ethers.getSigners();
  const cp = await ethers.getContractAt("StorachaCheckpointer", cpAddr);

  const tx = await cp.connect(signer).withdraw(to, BigInt(amount));
  await tx.wait();

  console.log(`Withdrew ${amount} wei to ${to}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
