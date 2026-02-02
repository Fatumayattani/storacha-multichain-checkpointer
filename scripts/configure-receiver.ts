/**
 * @title Configure WormholeReceiver Trusted Emitters
 * @notice Adds trusted emitter addresses to the receiver contract
 * @dev This script configures which publisher contracts are trusted per chain
 *
 * Usage:
 *   npx hardhat run scripts/configure-receiver.ts --network avalancheFuji \
 *     --receiver <RECEIVER_ADDRESS> \
 *     --publisher <PUBLISHER_ADDRESS> \
 *     --chain-id <WORMHOLE_CHAIN_ID>
 *
 * Example:
 *   npx hardhat run scripts/configure-receiver.ts --network avalancheFuji \
 *     --receiver 0x1234... \
 *     --publisher 0x5678... \
 *     --chain-id 10004
 *
 * Environment Variables Required:
 *   DEPLOYER_PRIVATE_KEY - Private key of contract owner
 */

import { network } from "hardhat";
import { CHAIN_IDS } from "../constants/chainIds.js";
import * as fs from "fs";
import * as path from "path";

const { ethers } = await network.connect({
  network: process.env.HARDHAT_NETWORK || "avalancheFuji",
  chainType: "l1",
});

/**
 * @notice Parse command line arguments
 */
function parseArgs() {
  const args: Record<string, string> = {};
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i].startsWith("--")) {
      const key = process.argv[i].slice(2);
      const value = process.argv[i + 1];
      if (value && !value.startsWith("--")) {
        args[key] = value;
      }
    }
  }
  return args;
}

/**
 * @notice Convert EVM address to Wormhole format (bytes32, left-padded)
 * @param address EVM address (20 bytes)
 * @returns Wormhole address (32 bytes, left-padded)
 */
function toWormholeAddress(address: string): string {
  // Remove 0x prefix if present
  const cleanAddress = address.startsWith("0x") ? address.slice(2) : address;

  // Validate address length (should be 40 hex chars = 20 bytes)
  if (cleanAddress.length !== 40) {
    throw new Error(`Invalid address length: ${address}`);
  }

  // Left-pad to 32 bytes (64 hex chars)
  return "0x" + cleanAddress.padStart(64, "0");
}

/**
 * @notice Get human-readable chain name from Wormhole chain ID
 */
function getChainName(chainId: number): string {
  switch (chainId) {
    case CHAIN_IDS.BASE_SEPOLIA_WORMHOLE:
      return "Base Sepolia";
    case CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE:
      return "Avalanche Fuji";
    case CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE:
      return "Ethereum Sepolia";
    default:
      return `Chain ${chainId}`;
  }
}

/**
 * @notice Main configuration function
 */
async function configureReceiver() {
  console.log("\n⚙️  Configuring WormholeReceiver Trusted Emitters");
  console.log("==============================================\n");

  // Parse command line arguments
  const args = parseArgs();
  const receiverAddress = args["receiver"];
  const publisherAddress = args["publisher"];
  const chainIdArg = args["chain-id"] || args["chainId"];

  // Validate required arguments
  if (!receiverAddress) {
    throw new Error("Missing --receiver argument");
  }

  if (!publisherAddress) {
    throw new Error("Missing --publisher argument");
  }

  if (!chainIdArg) {
    throw new Error("Missing --chain-id argument");
  }

  const sourceChainId = parseInt(chainIdArg, 10);
  if (isNaN(sourceChainId)) {
    throw new Error(`Invalid chain ID: ${chainIdArg}`);
  }

  // Validate addresses
  if (!ethers.isAddress(receiverAddress)) {
    throw new Error(`Invalid receiver address: ${receiverAddress}`);
  }

  if (!ethers.isAddress(publisherAddress)) {
    throw new Error(`Invalid publisher address: ${publisherAddress}`);
  }

  console.log("📝 Configuration Parameters:");
  console.log("   Receiver address:", receiverAddress);
  console.log("   Publisher address:", publisherAddress);
  console.log(
    "   Source chain ID:",
    sourceChainId,
    `(${getChainName(sourceChainId)})`
  );

  // Get signer (must be owner)
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log("\n👤 Signer address:", signerAddress);

  // Connect to receiver contract
  const WormholeReceiver = await ethers.getContractFactory("WormholeReceiver");
  const receiver = WormholeReceiver.attach(receiverAddress);

  // Verify signer is owner
  const owner = await receiver.owner();
  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(
      `Signer ${signerAddress} is not the contract owner. Owner is ${owner}`
    );
  }

  console.log("✅ Signer is contract owner");

  // Check if emitter is already trusted
  const emitterWormholeFormat = toWormholeAddress(publisherAddress);
  const isAlreadyTrusted = await receiver.isTrustedEmitter(
    sourceChainId,
    emitterWormholeFormat
  );

  if (isAlreadyTrusted) {
    console.log("ℹ️  Emitter is already trusted. Skipping configuration.");
    return;
  }

  // Convert publisher address to Wormhole format
  console.log("\n🔄 Converting address to Wormhole format...");
  console.log("   EVM address (20 bytes):", publisherAddress);
  console.log("   Wormhole address (32 bytes):", emitterWormholeFormat);

  // Add trusted emitter
  console.log("\n⏳ Adding trusted emitter...");
  const tx = await receiver.addTrustedEmitter(
    sourceChainId,
    emitterWormholeFormat
  );
  console.log("   Transaction hash:", tx.hash);

  console.log("⏳ Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("   Block number:", receipt!.blockNumber);
  console.log("   Gas used:", receipt!.gasUsed.toString());

  // Verify configuration
  console.log("\n🔍 Verifying configuration...");
  const isTrusted = await receiver.isTrustedEmitter(
    sourceChainId,
    emitterWormholeFormat
  );

  if (!isTrusted) {
    throw new Error("Failed to add trusted emitter");
  }

  console.log("✅ Trusted emitter added successfully");

  // Print configuration summary
  console.log("\n📋 Configuration Summary:");
  console.log("=======================\n");
  console.log("✅ Receiver:", receiverAddress);
  console.log("✅ Publisher:", publisherAddress);
  console.log(
    "✅ Source Chain:",
    getChainName(sourceChainId),
    `(${sourceChainId})`
  );
  console.log("✅ Wormhole Format:", emitterWormholeFormat);
  console.log("✅ Transaction:", receipt!.hash);

  // Save configuration to file
  const configDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configFile = path.join(
    configDir,
    `receiver-config-${receiverAddress.slice(2, 10)}.json`
  );

  interface ReceiverConfig {
    trustedEmitters?: Array<{
      chainId: number;
      chainName: string;
      publisherAddress: string;
      wormholeAddress: string;
      configuredAt: string;
      transactionHash: string;
    }>;
  }

  let config: ReceiverConfig = {};
  if (fs.existsSync(configFile)) {
    config = JSON.parse(fs.readFileSync(configFile, "utf-8")) as ReceiverConfig;
  }

  if (!config.trustedEmitters) {
    config.trustedEmitters = [];
  }

  config.trustedEmitters.push({
    chainId: sourceChainId,
    chainName: getChainName(sourceChainId),
    publisherAddress: publisherAddress,
    wormholeAddress: emitterWormholeFormat,
    configuredAt: new Date().toISOString(),
    transactionHash: receipt!.hash,
  });

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");
  console.log("💾 Configuration saved to:", configFile);

  console.log("\n🎉 Configuration complete!");
}

// Execute configuration if run directly
configureReceiver()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Configuration failed:");
    console.error(error);
    process.exit(1);
  });

export { configureReceiver, toWormholeAddress };
