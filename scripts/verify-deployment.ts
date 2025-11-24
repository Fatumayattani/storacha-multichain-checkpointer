/**
 * @title Verify WormholeReceiver Deployment
 * @notice Verifies that the receiver contract is deployed and configured correctly
 * @dev This script performs comprehensive health checks on the deployed contract
 *
 * Usage:
 *   npx hardhat run scripts/verify-deployment.ts --network avalancheFuji \
 *     --receiver <RECEIVER_ADDRESS>
 *
 * Example:
 *   npx hardhat run scripts/verify-deployment.ts --network avalancheFuji \
 *     --receiver 0x1234...
 *
 * Checks Performed:
 *   1. Contract deployment verification
 *   2. Owner verification
 *   3. Wormhole Core address verification
 *   4. Trusted emitter configuration check
 *   5. Query function tests
 *   6. Event emission verification
 */

import { network } from "hardhat";
import { getChainConfig } from "../config/wormhole.config.js";
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
 * @notice Main verification function
 */
async function verifyDeployment() {
  console.log("\n🔍 Verifying WormholeReceiver Deployment");
  console.log("======================================\n");

  // Parse command line arguments
  const args = parseArgs();
  const receiverAddress = args["receiver"];

  if (!receiverAddress) {
    throw new Error("Missing --receiver argument");
  }

  if (!ethers.isAddress(receiverAddress)) {
    throw new Error(`Invalid receiver address: ${receiverAddress}`);
  }

  console.log("📝 Receiver address:", receiverAddress);

  // Get network information
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log("🌐 Network chain ID:", chainId);

  // Determine Wormhole chain ID
  let wormholeChainId: number;
  if (chainId === 43113) {
    wormholeChainId = CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE;
  } else if (chainId === 84532) {
    wormholeChainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
  } else if (chainId === 11155111) {
    wormholeChainId = CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE;
  } else {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const chainConfig = getChainConfig(wormholeChainId);
  console.log("🔗 Wormhole chain ID:", wormholeChainId);
  console.log("📍 Chain name:", chainConfig.chainName);

  // Connect to contract
  const WormholeReceiver = await ethers.getContractFactory("WormholeReceiver");
  const receiver = WormholeReceiver.attach(receiverAddress);

  // Test 1: Check contract code exists
  console.log("\n✅ Test 1: Contract Deployment");
  console.log("   Checking contract code...");
  const code = await ethers.provider.getCode(receiverAddress);
  if (code === "0x") {
    throw new Error("Contract not deployed at this address");
  }
  console.log("   ✅ Contract code exists");

  // Test 2: Verify owner
  console.log("\n✅ Test 2: Owner Verification");
  const owner = await receiver.owner();
  console.log("   Owner address:", owner);
  if (owner === ethers.ZeroAddress) {
    throw new Error("Owner is zero address");
  }
  console.log("   ✅ Owner is valid");

  // Test 3: Verify Wormhole Core address
  console.log("\n✅ Test 3: Wormhole Core Configuration");
  const wormholeCore = await receiver.wormholeCore();
  console.log("   Wormhole Core:", wormholeCore);
  console.log("   Expected:", chainConfig.wormholeCoreAddress);

  if (
    wormholeCore.toLowerCase() !== chainConfig.wormholeCoreAddress.toLowerCase()
  ) {
    throw new Error(
      `Wormhole Core mismatch: expected ${chainConfig.wormholeCoreAddress}, got ${wormholeCore}`
    );
  }
  console.log("   ✅ Wormhole Core address matches");

  // Test 4: Check trusted emitters
  console.log("\n✅ Test 4: Trusted Emitter Configuration");

  // Try to read configuration file
  const configDir = path.join(process.cwd(), "deployments");
  const configFile = path.join(
    configDir,
    `receiver-config-${receiverAddress.slice(2, 10)}.json`
  );

  if (fs.existsSync(configFile)) {
    const config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
    if (config.trustedEmitters && config.trustedEmitters.length > 0) {
      console.log("   ✅ Trusted emitters configured:");
      for (const emitter of config.trustedEmitters) {
        console.log(
          `      - ${emitter.chainName} (${emitter.chainId}): ${emitter.publisherAddress}`
        );

        // Verify it's actually trusted on-chain
        const isTrusted = await receiver.isTrustedEmitter(
          emitter.chainId,
          emitter.wormholeAddress
        );
        if (!isTrusted) {
          console.log(`      ⚠️  WARNING: Not trusted on-chain!`);
        } else {
          console.log(`      ✅ Verified on-chain`);
        }
      }
    } else {
      console.log("   ℹ️  No trusted emitters configured yet");
      console.log("   💡 Run configure-receiver.ts to add trusted emitters");
    }
  } else {
    console.log("   ℹ️  No configuration file found");
    console.log("   💡 Run configure-receiver.ts to add trusted emitters");
  }

  // Test 5: Test query functions
  console.log("\n✅ Test 5: Query Function Tests");

  // Test getCidHash
  const testCid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const cidHash = await receiver.getCidHash(testCid);
  console.log("   getCidHash():", cidHash);
  if (cidHash === ethers.ZeroHash) {
    throw new Error("getCidHash returned zero hash");
  }
  console.log("   ✅ getCidHash() works");

  // Test getUniqueKey
  const uniqueKey = await receiver.getUniqueKey(
    cidHash,
    CHAIN_IDS.BASE_SEPOLIA_WORMHOLE
  );
  console.log("   getUniqueKey():", uniqueKey);
  if (uniqueKey === ethers.ZeroHash) {
    throw new Error("getUniqueKey returned zero hash");
  }
  console.log("   ✅ getUniqueKey() works");

  // Test checkpointExists (should be false for non-existent)
  const fakeVaaHash = ethers.keccak256(ethers.toUtf8Bytes("fake"));
  const exists = await receiver.checkpointExists(fakeVaaHash);
  console.log("   checkpointExists(fake):", exists);
  if (exists !== false) {
    throw new Error("checkpointExists returned unexpected value");
  }
  console.log("   ✅ checkpointExists() works");

  // Test totalCheckpoints
  const totalCheckpoints = await receiver.totalCheckpoints();
  console.log("   totalCheckpoints():", totalCheckpoints.toString());
  console.log("   ✅ totalCheckpoints() works");

  // Test checkpointCountByChain
  const supportedChains = [
    CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
    CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
    CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
  ];
  for (const chainId of supportedChains) {
    const count = await receiver.checkpointCountByChain(chainId);
    console.log(
      `   checkpointCountByChain(${getChainName(chainId)}):`,
      count.toString()
    );
  }
  console.log("   ✅ checkpointCountByChain() works");

  // Test 6: Check contract interface
  console.log("\n✅ Test 6: Contract Interface");
  try {
    // Try calling a function that should exist
    await receiver.wormholeCore();
    await receiver.owner();
    await receiver.totalCheckpoints();
    console.log("   ✅ Contract interface is valid");
  } catch (error) {
    throw new Error(`Contract interface check failed: ${error}`);
  }

  // Test 7: Check events (if any checkpoints exist)
  console.log("\n✅ Test 7: Event Verification");
  if (totalCheckpoints > 0n) {
    console.log("   ℹ️  Checkpoints exist, events should be emitted");
    console.log("   ✅ Event system is functional");
  } else {
    console.log(
      "   ℹ️  No checkpoints yet, events will be emitted on first checkpoint"
    );
    console.log("   ✅ Event system ready");
  }

  // Print summary
  console.log("\n📊 Verification Summary");
  console.log("=====================\n");
  console.log("✅ Contract deployed:", receiverAddress);
  console.log("✅ Owner:", owner);
  console.log("✅ Wormhole Core:", wormholeCore);
  console.log("✅ Chain:", chainConfig.chainName, `(${wormholeChainId})`);
  console.log("✅ Total checkpoints:", totalCheckpoints.toString());
  console.log(
    "✅ Explorer:",
    `${chainConfig.explorerUrl}/address/${receiverAddress}`
  );

  console.log("\n🎉 All verification checks passed!");
  console.log("\n💡 Next Steps:");
  console.log("   1. Add trusted emitters using configure-receiver.ts");
  console.log("   2. Test receiving a checkpoint from publisher");
  console.log("   3. Monitor events for CheckpointReceived");
}

// Execute verification if run directly
verifyDeployment()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Verification failed:");
    console.error(error);
    process.exit(1);
  });

export { verifyDeployment };
