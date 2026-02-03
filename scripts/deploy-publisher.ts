/**
 * @title Deploy StorachaCheckpointer (Publisher) Contract
 * @notice Deploys StorachaCheckpointer to Base Sepolia testnet
 * @dev This script handles deployment, configuration, and saves deployment information
 *
 * Usage:
 *   npx hardhat run scripts/deploy-publisher.ts --network baseSepolia
 *
 * Environment Variables Required:
 *   BASE_SEPOLIA_RPC_URL - RPC endpoint for Base Sepolia
 *   DEPLOYER_PRIVATE_KEY - Private key of deployer (will become owner)
 */

import { network } from "hardhat";
import { getChainConfig } from "../config/wormhole.config.js";
import { CHAIN_IDS } from "../constants/chainIds.js";
import { updateFrontendConfig } from "./utils/frontend-config.js";
import * as fs from "fs";
import * as path from "path";

const { ethers } = await network.connect({
  network: process.env.HARDHAT_NETWORK || "baseSepolia",
  chainType: "l1",
});

interface DeploymentInfo {
  network: string;
  chainId: number;
  wormholeChainId: number;
  publisherAddress: string;
  mockVerifierAddress: string;
  wormholeCoreAddress: string;
  ownerAddress: string;
  deployedAt: string;
  transactionHash: string;
  blockNumber: number;
}

async function deployPublisher() {
  console.log("\n🚀 Deploying StorachaCheckpointer (Publisher) Contract");
  console.log("===================================================\n");

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("📝 Deployer address:", deployerAddress);

  const networkInfo = await ethers.provider.getNetwork();
  const chainId = Number(networkInfo.chainId);
  console.log("🌐 Network chain ID:", chainId);

  let wormholeChainId: number;
  if (chainId === 43113) {
    wormholeChainId = CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE;
  } else if (chainId === 84532) {
    wormholeChainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
  } else if (chainId === 11155111) {
    wormholeChainId = CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE;
  } else {
    throw new Error(
      `Unsupported chain ID: ${chainId}. Supported: 43113 (Fuji), 84532 (Base Sepolia), 11155111 (Ethereum Sepolia)`
    );
  }

  console.log("🔗 Wormhole chain ID:", wormholeChainId);

  const chainConfig = getChainConfig(wormholeChainId);
  const wormholeCoreAddress = chainConfig.wormholeCoreAddress;
  console.log("🌉 Wormhole Core address:", wormholeCoreAddress);
  console.log("📍 Chain name:", chainConfig.chainName);

  const balance = await ethers.provider.getBalance(deployerAddress);
  console.log("💰 Deployer balance:", ethers.formatEther(balance), "ETH");
  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  Warning: Low balance. Deployment may fail.");
  }

  console.log("\n📚 Deploying MockVerifier contract...");
  const MockVerifier = await ethers.getContractFactory("MockVerifier");
  const mockVerifier = await MockVerifier.deploy();
  await mockVerifier.waitForDeployment();
  const mockVerifierAddress = await mockVerifier.getAddress();
  console.log("✅ MockVerifier deployed to:", mockVerifierAddress);

  console.log("\n📚 Deploying StorachaCheckpointer contract...");
  const StorachaCheckpointer = await ethers.getContractFactory(
    "StorachaCheckpointer"
  );

  const publisher = await StorachaCheckpointer.deploy(deployerAddress);

  console.log("⏳ Waiting for deployment transaction...");
  const deploymentTx = publisher.deploymentTransaction();
  if (!deploymentTx) {
    throw new Error("Deployment transaction not found");
  }

  const receipt = await deploymentTx.wait();
  const publisherAddress = await publisher.getAddress();

  console.log("\n✅ Deployment Successful!");
  console.log("========================\n");
  console.log("📄 Contract address:", publisherAddress);
  console.log("🔗 Transaction hash:", receipt!.hash);
  console.log("📦 Block number:", receipt!.blockNumber);
  console.log("👤 Owner address:", deployerAddress);

  console.log("\n⚙️  Configuring Publisher...");

  console.log("Setting Verifier...");
  const tx1 = await publisher.setVerifier(mockVerifierAddress);
  await tx1.wait();
  console.log("✅ Verifier set");

  console.log("Setting Wormhole Core...");
  const tx2 = await publisher.setWormhole(wormholeCoreAddress);
  await tx2.wait();
  console.log("✅ Wormhole Core set");

  const deploymentInfo: DeploymentInfo = {
    network: chainConfig.chainName,
    chainId: chainId,
    wormholeChainId: wormholeChainId,
    publisherAddress: publisherAddress,
    mockVerifierAddress: mockVerifierAddress,
    wormholeCoreAddress: wormholeCoreAddress,
    ownerAddress: deployerAddress,
    deployedAt: new Date().toISOString(),
    transactionHash: receipt!.hash,
    blockNumber: receipt!.blockNumber,
  };

  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `publisher-${chainConfig.chainName.toLowerCase().replace(/\s+/g, "-")}-${chainId}.json`
  );

  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deploymentInfo, null, 2),
    "utf-8"
  );

  console.log("💾 Deployment info saved to:", deploymentFile);

  console.log("\n📝 Updating frontend configuration...");
  await updateFrontendConfig("PUBLISHER", chainId, publisherAddress);

  console.log("\n🎉 Deployment and Configuration complete!");
  return deploymentInfo;
}

deployPublisher()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
