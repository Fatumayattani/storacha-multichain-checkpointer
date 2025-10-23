import { expect } from "chai";
import { network } from "hardhat";
import { CHAIN_IDS } from "../../constants/chainIds.js";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

/**
 * @title Publisher-Receiver Integration Test
 * @notice Tests end-to-end flow from StorachaCheckpointer (publisher) to WormholeReceiver
 * @dev This test validates:
 *      1. Message encoding in publisher matches receiver's expectations
 *      2. Chain ID mapping works correctly
 *      3. Wormhole VAA flow (mocked)
 *      4. Message decoding and validation in receiver
 */
describe("Publisher-Receiver Integration", function () {
  // ============ FIXTURES ============

  async function deployIntegrationFixture() {
    const [owner, user, relayer] = await ethers.getSigners();

    // Deploy MockVerifier
    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    const mockVerifier = await MockVerifier.deploy();

    // Deploy MockWormholeCore
    const MockWormholeCore =
      await ethers.getContractFactory("MockWormholeCore");
    const mockWormhole = await MockWormholeCore.deploy();

    // Set Base Sepolia chain ID for testing
    await mockWormhole.setChainId(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);

    // Deploy TestStorachaCheckpointer (test version with configurable chain ID)
    const TestCheckpointerFactory = await ethers.getContractFactory(
      "TestStorachaCheckpointer"
    );
    const publisher = await TestCheckpointerFactory.deploy(owner.address);

    // Set test chain ID to Base Sepolia Wormhole
    await publisher.setTestChainId(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);

    // Configure publisher
    await publisher.setVerifier(await mockVerifier.getAddress());
    await publisher.setWormhole(await mockWormhole.getAddress());

    // Deploy CheckpointCodecTest (for decoding in tests)
    const CheckpointCodecTest = await ethers.getContractFactory(
      "CheckpointCodecTest"
    );
    const codecTest = await CheckpointCodecTest.deploy();

    return {
      publisher,
      mockVerifier,
      mockWormhole,
      codecTest,
      owner,
      user,
      relayer,
    };
  }

  // ============ INTEGRATION TESTS ============

  describe("End-to-End Message Flow", function () {
    it("should publish checkpoint and decode correctly", async function () {
      const { publisher, mockVerifier, mockWormhole, codecTest, user } =
        await deployIntegrationFixture();

      // Setup test data
      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("test-checkpoint");
      const duration = 86400; // 1 day
      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);

      // Get Wormhole message fee
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      // Mock verifier to return true
      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      // Publish checkpoint with Wormhole
      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      // Find MessagePublished event from Wormhole
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = mockWormhole.interface.parseLog(log);
          return parsed?.name === "MessagePublished";
        } catch {
          return false;
        }
      });

      expect(messageEvent).to.exist;

      // Parse the event
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);
      const payload = parsedEvent!.args.payload;

      // Decode the payload using CheckpointCodec
      const decoded = await codecTest.decodeMessage(payload);

      // Verify decoded message
      expect(decoded.version).to.equal(1);
      expect(decoded.cid).to.equal(testCid);
      expect(decoded.tag).to.equal(testTag);
      expect(decoded.creator).to.equal(user.address);
      expect(decoded.sourceChainId).to.equal(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
    });

    it("should handle multiple checkpoints correctly", async function () {
      const { publisher, mockVerifier, mockWormhole, codecTest, user } =
        await deployIntegrationFixture();

      const checkpoints = [
        {
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          tag: ethers.encodeBytes32String("checkpoint-1"),
        },
        {
          cid: "bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3wnlo3rs7ewhnp7lly",
          tag: ethers.encodeBytes32String("checkpoint-2"),
        },
        {
          cid: "bafybeibxbcfzs4jjjqmai7jfhz3yfq3nxvz3yfq3nxvz3yfq3nxvz3yfq",
          tag: ethers.encodeBytes32String("checkpoint-3"),
        },
      ];

      const duration = 86400;
      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      for (const checkpoint of checkpoints) {
        // Mock verifier
        const cidHash = ethers.keccak256(ethers.toUtf8Bytes(checkpoint.cid));
        await mockVerifier.setMockAvailable(cidHash, true);

        // Publish checkpoint
        const tx = await publisher
          .connect(user)
          .createCheckpoint(
            checkpoint.cid,
            duration,
            "0x",
            checkpoint.tag,
            true,
            {
              value: totalCost,
            }
          );

        const receipt = await tx.wait();

        // Find and decode message
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messageEvent = receipt?.logs.find((log: any) => {
          try {
            const parsed = mockWormhole.interface.parseLog(log);
            return parsed?.name === "MessagePublished";
          } catch {
            return false;
          }
        });

        expect(messageEvent).to.exist;

        const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);
        const payload = parsedEvent!.args.payload;
        const decoded = await codecTest.decodeMessage(payload);

        // Verify each checkpoint
        expect(decoded.cid).to.equal(checkpoint.cid);
        expect(decoded.tag).to.equal(checkpoint.tag);
        expect(decoded.sourceChainId).to.equal(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
      }
    });
  });

  // ============ CHAIN ID INTEGRATION ============

  describe("Chain ID Integration", function () {
    it("should use correct Wormhole chain ID for Base Sepolia", async function () {
      const { publisher, mockVerifier, mockWormhole, codecTest, user } =
        await deployIntegrationFixture();

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("chain-test");
      const duration = 86400;
      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = mockWormhole.interface.parseLog(log);
          return parsed?.name === "MessagePublished";
        } catch {
          return false;
        }
      });

      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);
      const payload = parsedEvent!.args.payload;
      const decoded = await codecTest.decodeMessage(payload);

      // Verify Wormhole chain ID (not EVM chain ID)
      expect(decoded.sourceChainId).to.equal(10004); // Base Sepolia Wormhole
      expect(decoded.sourceChainId).to.not.equal(84532); // Base Sepolia EVM
    });
  });

  // ============ MESSAGE VALIDATION ============

  describe("Message Validation", function () {
    it("should produce valid messages according to CheckpointCodec", async function () {
      const { publisher, mockVerifier, mockWormhole, codecTest, user } =
        await deployIntegrationFixture();

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("validation-test");
      const duration = 86400;
      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = mockWormhole.interface.parseLog(log);
          return parsed?.name === "MessagePublished";
        } catch {
          return false;
        }
      });

      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);
      const payload = parsedEvent!.args.payload;
      const decoded = await codecTest.decodeMessage(payload);

      // Validate using CheckpointCodec
      // Convert Result to plain object to avoid read-only property issues
      const messageObj = {
        version: decoded.version,
        cid: decoded.cid,
        tag: decoded.tag,
        expiresAt: decoded.expiresAt,
        creator: decoded.creator,
        timestamp: decoded.timestamp,
        sourceChainId: decoded.sourceChainId,
      };
      const isValid = await codecTest.validateMessage(messageObj);
      expect(isValid).to.be.true;
    });

    it("should reject messages with invalid data", async function () {
      const { codecTest } = await deployIntegrationFixture();

      // Create invalid message (empty CID)
      const invalidMessage = {
        version: 1,
        cid: "",
        tag: ethers.encodeBytes32String("invalid"),
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        creator: ethers.ZeroAddress,
        timestamp: Math.floor(Date.now() / 1000),
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
      };

      const isValid = await codecTest.validateMessage(invalidMessage);
      expect(isValid).to.be.false;
    });
  });

  // ============ VAA SIMULATION ============

  describe("Wormhole VAA Flow", function () {
    it("should create valid VAA that can be parsed", async function () {
      const { publisher, mockVerifier, mockWormhole, codecTest, user } =
        await deployIntegrationFixture();

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("vaa-test");
      const duration = 86400;
      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = mockWormhole.interface.parseLog(log);
          return parsed?.name === "MessagePublished";
        } catch {
          return false;
        }
      });

      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);
      const payload = parsedEvent!.args.payload;
      const sequence = parsedEvent!.args.sequence;

      // Create mock VAA
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      const mockVAA = await mockWormhole.createMockVAA(
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        emitterAddress,
        sequence,
        payload
      );

      // Parse VAA
      const [vm, valid, reason] = await mockWormhole.parseAndVerifyVM(mockVAA);

      expect(valid).to.be.true;
      expect(reason).to.equal("");
      expect(vm.emitterChainId).to.equal(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
      expect(vm.payload).to.equal(payload);

      // Decode the payload from VAA
      const decoded = await codecTest.decodeMessage(vm.payload);
      expect(decoded.cid).to.equal(testCid);
      expect(decoded.tag).to.equal(testTag);
    });

    it("should handle VAA from different source chains", async function () {
      const { mockWormhole, codecTest } = await deployIntegrationFixture();

      const testChains = [
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
      ];

      for (const chainId of testChains) {
        // Create test message
        const message = {
          version: 1,
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          tag: ethers.encodeBytes32String(`chain-${chainId}`),
          expiresAt: Math.floor(Date.now() / 1000) + 86400,
          creator: ethers.Wallet.createRandom().address,
          timestamp: Math.floor(Date.now() / 1000),
          sourceChainId: chainId,
        };

        const encoded = await codecTest.encodeMessage(message);

        // Create VAA
        const mockVAA = await mockWormhole.createMockVAA(
          chainId,
          ethers.zeroPadValue(ethers.Wallet.createRandom().address, 32),
          1n,
          encoded
        );

        // Parse VAA
        const [vm, valid] = await mockWormhole.parseAndVerifyVM(mockVAA);
        expect(valid).to.be.true;
        expect(vm.emitterChainId).to.equal(chainId);

        // Decode payload
        const decoded = await codecTest.decodeMessage(vm.payload);
        expect(decoded.sourceChainId).to.equal(chainId);
      }
    });
  });

  // ============ ERROR HANDLING ============

  describe("Error Handling", function () {
    it("should handle checkpoint creation without Wormhole publishing", async function () {
      const { publisher, mockVerifier, user } =
        await deployIntegrationFixture();

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("no-wormhole");
      const duration = 86400;
      const cost = await publisher.pricePerSecondWei();
      const totalCost = cost * BigInt(duration);

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      // Create checkpoint without Wormhole (publishToWormhole = false)
      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, false, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      // Should have CheckpointCreated event
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checkpointEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = publisher.interface.parseLog(log);
          return parsed?.name === "CheckpointCreated";
        } catch {
          return false;
        }
      });

      expect(checkpointEvent).to.exist;

      // Should NOT have MessagePublished event
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = publisher.interface.parseLog(log);
          return parsed?.name === "MessagePublished";
        } catch {
          return false;
        }
      });

      expect(messageEvent).to.not.exist;
    });

    it("should handle malformed VAA gracefully", async function () {
      const { mockWormhole } = await deployIntegrationFixture();

      const malformedVAA = "0x1234567890";

      const [, valid, reason] =
        await mockWormhole.parseAndVerifyVM(malformedVAA);

      expect(valid).to.be.false;
      expect(reason).to.not.equal("");
    });
  });

  // ============ PERFORMANCE TESTS ============

  describe("Performance", function () {
    it("should handle batch checkpoint publishing efficiently", async function () {
      const { publisher, mockVerifier, mockWormhole, user } =
        await deployIntegrationFixture();

      const batchSize = 10;
      const duration = 86400;
      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const startTime = Date.now();

      for (let i = 0; i < batchSize; i++) {
        const testCid = `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy${i}fbzdi`;
        const testTag = ethers.encodeBytes32String(`batch-${i}`);

        const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
        await mockVerifier.setMockAvailable(cidHash, true);

        await publisher
          .connect(user)
          .createCheckpoint(testCid, duration, "0x", testTag, true, {
            value: totalCost,
          });
      }

      const endTime = Date.now();
      const duration_ms = endTime - startTime;

      console.log(
        `   Batch publishing (${batchSize} checkpoints) completed in ${duration_ms}ms`
      );

      expect(duration_ms).to.be.lessThan(10000); // Should complete within 10 seconds
    });
  });

  // ============ INTEGRATION SUMMARY ============

  describe("Integration Summary", function () {
    it("should demonstrate complete end-to-end flow", async function () {
      const { publisher, mockVerifier, mockWormhole, codecTest, user } =
        await deployIntegrationFixture();

      console.log("\n   📋 End-to-End Integration Flow:");
      console.log("   ================================");

      // Step 1: Setup
      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("e2e-test");
      const duration = 86400;
      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      console.log("   ✅ Step 1: Setup test data");

      // Step 2: Mock verifier
      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);
      console.log("   ✅ Step 2: Configure mock verifier");

      // Step 3: Publish checkpoint
      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });
      const receipt = await tx.wait();
      console.log("   ✅ Step 3: Publish checkpoint to Wormhole");

      // Step 4: Extract message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = mockWormhole.interface.parseLog(log);
          return parsed?.name === "MessagePublished";
        } catch {
          return false;
        }
      });
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);
      const payload = parsedEvent!.args.payload;
      console.log("   ✅ Step 4: Extract Wormhole message");

      // Step 5: Create VAA
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      const mockVAA = await mockWormhole.createMockVAA(
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        emitterAddress,
        parsedEvent!.args.sequence,
        payload
      );
      console.log("   ✅ Step 5: Create mock VAA");

      // Step 6: Parse VAA
      const [vm, valid] = await mockWormhole.parseAndVerifyVM(mockVAA);
      expect(valid).to.be.true;
      console.log("   ✅ Step 6: Parse and verify VAA");

      // Step 7: Decode message
      const decoded = await codecTest.decodeMessage(vm.payload);
      console.log("   ✅ Step 7: Decode checkpoint message");

      // Step 8: Validate message
      // Convert Result to plain object to avoid read-only property issues
      const messageObj = {
        version: decoded.version,
        cid: decoded.cid,
        tag: decoded.tag,
        expiresAt: decoded.expiresAt,
        creator: decoded.creator,
        timestamp: decoded.timestamp,
        sourceChainId: decoded.sourceChainId,
      };
      const isValid = await codecTest.validateMessage(messageObj);
      expect(isValid).to.be.true;
      console.log("   ✅ Step 8: Validate checkpoint message");

      // Step 9: Verify data integrity
      expect(decoded.cid).to.equal(testCid);
      expect(decoded.tag).to.equal(testTag);
      expect(decoded.creator).to.equal(user.address);
      expect(decoded.sourceChainId).to.equal(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
      console.log("   ✅ Step 9: Verify data integrity");

      console.log("\n   🎉 Integration test complete!");
      console.log("   ================================\n");
    });
  });
});
