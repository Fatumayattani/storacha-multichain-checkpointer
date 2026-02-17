/**
 * @title Deploy WormholeReceiver Contract
 * @notice Deploys WormholeReceiver to Avalanche Fuji testnet
 * @dev This script handles deployment and saves deployment information
 *
 * Usage:
 *   npx hardhat run scripts/deploy-receiver.ts --network avalancheFuji
 *
 * Environment Variables Required:
 *   AVALANCHE_FUJI_RPC_URL - RPC endpoint for Avalanche Fuji
 *   DEPLOYER_PRIVATE_KEY - Private key of deployer (will become owner)
 */

import { network } from "hardhat";
import { getChainConfig } from "../config/wormhole.config.js";
import { CHAIN_IDS } from "../constants/chainIds.js";
import { updateFrontendConfig } from "./utils/frontend-config.js";
import * as fs from "fs";
import * as path from "path";

const { ethers } = await network.connect({
  network: process.env.HARDHAT_NETWORK || "avalancheFuji",
  chainType: "l1",
});

/**
 * @notice Deployment information structure
 */
interface DeploymentInfo {
  network: string;
  chainId: number;
  wormholeChainId: number;
  receiverAddress: string;
  wormholeCoreAddress: string;
  ownerAddress: string;
  deployedAt: string;
  transactionHash: string;
  blockNumber: number;
}

/**
 * @notice Main deployment function
 */
async function deployReceiver() {
  console.log("\n🚀 Deploying WormholeReceiver Contract");
  console.log("=====================================\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("📝 Deployer address:", deployerAddress);

  // Get network information
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log("🌐 Network chain ID:", chainId);

  // Determine Wormhole chain ID
  let wormholeChainId: number;
  if (chainId === 43113) {
    // Avalanche Fuji EVM
    wormholeChainId = CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE;
  } else if (chainId === 84532) {
    // Base Sepolia EVM
    wormholeChainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
  } else if (chainId === 11155111) {
    // Ethereum Sepolia EVM
    wormholeChainId = CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE;
  } else {
    throw new Error(
      `Unsupported chain ID: ${chainId}. Supported: 43113 (Fuji), 84532 (Base Sepolia), 11155111 (Ethereum Sepolia)`
    );
  }

  console.log("🔗 Wormhole chain ID:", wormholeChainId);

  // Get Wormhole Core address
  const chainConfig = getChainConfig(wormholeChainId);
  const wormholeCoreAddress = chainConfig.wormholeCoreAddress;
  console.log("🌉 Wormhole Core address:", wormholeCoreAddress);
  console.log("📍 Chain name:", chainConfig.chainName);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployerAddress);
  console.log("💰 Deployer balance:", ethers.formatEther(balance), "ETH");
  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  Warning: Low balance. Deployment may fail.");
  }

  // Deploy CheckpointCodec library first (if needed as library)
  // Note: CheckpointCodec is currently an internal library, not deployed separately
  console.log("\n📚 Deploying WormholeReceiver contract...");

  // Get contract factory
  const WormholeReceiver = await ethers.getContractFactory("WormholeReceiver");

  // Deploy contract
  console.log("⏳ Deploying...");
  const receiver = await WormholeReceiver.deploy(
    wormholeCoreAddress,
    deployerAddress // Owner address
  );

  console.log("⏳ Waiting for deployment transaction...");
  const deploymentTx = receiver.deploymentTransaction();
  if (!deploymentTx) {
    throw new Error("Deployment transaction not found");
  }

  const receipt = await deploymentTx.wait();
  const receiverAddress = await receiver.getAddress();

  console.log("\n✅ Deployment Successful!");
  console.log("========================\n");
  console.log("📄 Contract address:", receiverAddress);
  console.log("🔗 Transaction hash:", receipt!.hash);
  console.log("📦 Block number:", receipt!.blockNumber);
  console.log("👤 Owner address:", deployerAddress);
  console.log("🌉 Wormhole Core:", wormholeCoreAddress);
  console.log(
    "🔗 Explorer:",
    `${chainConfig.explorerUrl}/address/${receiverAddress}`
  );

  // Verify contract is deployed correctly
  console.log("\n🔍 Verifying deployment...");
  const owner = await receiver.owner();
  const wormholeCore = await receiver.wormholeCore();

  if (owner.toLowerCase() !== deployerAddress.toLowerCase()) {
    throw new Error(
      `Owner mismatch: expected ${deployerAddress}, got ${owner}`
    );
  }

  if (wormholeCore.toLowerCase() !== wormholeCoreAddress.toLowerCase()) {
    throw new Error(
      `Wormhole Core mismatch: expected ${wormholeCoreAddress}, got ${wormholeCore}`
    );
  }

  console.log("✅ Contract verification passed");

  // Save deployment information
  const deploymentInfo: DeploymentInfo = {
    network: chainConfig.chainName,
    chainId: chainId,
    wormholeChainId: wormholeChainId,
    receiverAddress: receiverAddress,
    wormholeCoreAddress: wormholeCoreAddress,
    ownerAddress: deployerAddress,
    deployedAt: new Date().toISOString(),
    transactionHash: receipt!.hash,
    blockNumber: receipt!.blockNumber,
  };

  // Save to deployments directory
  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `receiver-${chainConfig.chainName.toLowerCase().replace(/\s+/g, "-")}-${chainId}.json`
  );

  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deploymentInfo, null, 2),
    "utf-8"
  );

  console.log("💾 Deployment info saved to:", deploymentFile);

  // Update frontend config
  console.log("\n📝 Updating frontend configuration...");
  await updateFrontendConfig("RECEIVER", chainId, receiverAddress);

  // Print next steps
  console.log("\n📋 Next Steps:");
  console.log("=============\n");
  console.log("1. Configure trusted emitter:");
  console.log(
    `   npx hardhat run scripts/configure-receiver.ts --network avalancheFuji \\`
  );
  console.log(`     --receiver ${receiverAddress} \\`);
  console.log(`     --publisher <PUBLISHER_ADDRESS> \\`);
  console.log(`     --chain-id ${CHAIN_IDS.BASE_SEPOLIA_WORMHOLE}`);
  console.log("");
  console.log("2. Verify deployment:");
  console.log(
    `   npx hardhat run scripts/verify-deployment.ts --network avalancheFuji \\`
  );
  console.log(`     --receiver ${receiverAddress}`);
  console.log("");

  return deploymentInfo;
}

// Execute deployment if run directly
deployReceiver()
  .then(() => {
    console.log("\n🎉 Deployment complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

export { deployReceiver, type DeploymentInfo };
