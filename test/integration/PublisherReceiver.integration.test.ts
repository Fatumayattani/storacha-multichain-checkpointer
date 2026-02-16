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

  const BASE_CHAIN = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
  const AVALANCHE_CHAIN = CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE;
  const ETHEREUM_CHAIN = CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE;
  const DEFAULT_DURATION = 86400;

  function toWormholeAddress(address: string) {
    return ethers.zeroPadValue(address, 32);
  }

  async function deployReceiverWithEmitters(
    targetChainId: number,
    owner: any,
    emitters: Array<{ chainId: number; emitterAddress: string }>
  ) {
    const MockWormholeCore =
      await ethers.getContractFactory("MockWormholeCore");
    const targetWormhole = await MockWormholeCore.deploy();
    await targetWormhole.setChainId(targetChainId);

    const WormholeReceiver =
      await ethers.getContractFactory("WormholeReceiver");
    const receiver = await WormholeReceiver.deploy(
      await targetWormhole.getAddress(),
      await owner.getAddress()
    );

    for (const { chainId, emitterAddress } of emitters) {
      await receiver
        .connect(owner)
        .addTrustedEmitter(chainId, toWormholeAddress(emitterAddress));
    }

    return { receiver, targetWormhole };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findMessagePublishedEvent(receipt: any, mockWormhole: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return receipt?.logs?.find((log: any) => {
      try {
        const parsed = mockWormhole.interface.parseLog(log);
        return parsed?.name === "MessagePublished";
      } catch {
        return false;
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function buildMockVaa(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    targetWormhole: any,
    publisherAddress: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsedEvent: any,
    sourceChainId: number
  ) {
    return targetWormhole.createMockVAA(
      sourceChainId,
      toWormholeAddress(publisherAddress),
      parsedEvent.args.sequence,
      parsedEvent.args.payload
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parseCheckpointReceivedEvent(receipt: any, receiver: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const log = receipt?.logs?.find((entry: any) => {
      try {
        const parsed = receiver.interface.parseLog(entry);
        return parsed?.name === "CheckpointReceived";
      } catch {
        return false;
      }
    });

    if (!log) {
      return undefined;
    }

    return receiver.interface.parseLog(log);
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
      expect(decoded.version).to.equal(2);
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
        revoked: decoded.revoked,
      };
      const isValid = await codecTest.validateMessage(messageObj);
      expect(isValid).to.be.true;
    });

    it("should reject messages with invalid data", async function () {
      const { codecTest } = await deployIntegrationFixture();

      // Create invalid message (empty CID)
      const invalidMessage = {
        version: 2,
        cid: "",
        tag: ethers.encodeBytes32String("invalid"),
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        creator: ethers.ZeroAddress,
        timestamp: Math.floor(Date.now() / 1000),
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      const isValid = await codecTest.validateMessage(invalidMessage);
      expect(isValid).to.be.false;
    });
  });

  describe("WormholeReceiver Integration", function () {
    it("should relay Base checkpoints to an Avalanche receiver", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver, targetWormhole } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const testCid = "bafybeibqavalancheflowbafybeibqavalancheflowbafybeib";
      const testTag = ethers.encodeBytes32String("base-to-ava");
      const duration = DEFAULT_DURATION;
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

      const messageEvent = findMessagePublishedEvent(receipt, mockWormhole);
      expect(messageEvent).to.exist;
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);

      const vaa = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedEvent,
        BASE_CHAIN
      );

      const deliverTx = await receiver.receiveCheckpoint(vaa);
      const deliverReceipt = await deliverTx.wait();

      const checkpointEvent = parseCheckpointReceivedEvent(
        deliverReceipt,
        receiver
      );
      expect(checkpointEvent).to.exist;
      const vaaHash = checkpointEvent!.args.vaaHash;

      const stored = await receiver.getCheckpoint(vaaHash);
      expect(stored.cid).to.equal(testCid);
      expect(stored.tag).to.equal(testTag);
      expect(stored.sourceChainId).to.equal(BASE_CHAIN);
      expect(await receiver.totalCheckpoints()).to.equal(1n);
      expect(await receiver.checkpointCountByChain(BASE_CHAIN)).to.equal(1n);

      const byCid = await receiver.getCheckpointByCid(testCid, BASE_CHAIN);
      expect(byCid.cid).to.equal(testCid);

      const exists = await receiver.checkCidExistsOnChains(testCid, [
        BASE_CHAIN,
        AVALANCHE_CHAIN,
      ]);
      expect(exists).to.deep.equal([true, false]);
    });

    it("should relay Base checkpoints to an Ethereum receiver", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver, targetWormhole } = await deployReceiverWithEmitters(
        ETHEREUM_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const testCid = "bafybeietherrelaybeaconbafybeietherrelaybeaconxyz";
      const testTag = ethers.encodeBytes32String("base-to-eth");
      const duration = DEFAULT_DURATION;
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

      const messageEvent = findMessagePublishedEvent(receipt, mockWormhole);
      expect(messageEvent).to.exist;
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);

      const vaa = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedEvent,
        BASE_CHAIN
      );

      const deliverTx = await receiver.receiveCheckpoint(vaa);
      const deliverReceipt = await deliverTx.wait();

      const checkpointEvent = parseCheckpointReceivedEvent(
        deliverReceipt,
        receiver
      );
      expect(checkpointEvent).to.exist;
      const vaaHash = checkpointEvent!.args.vaaHash;

      const stored = await receiver.getCheckpoint(vaaHash);
      expect(stored.cid).to.equal(testCid);
      expect(stored.sourceChainId).to.equal(BASE_CHAIN);
      expect(await receiver.totalCheckpoints()).to.equal(1n);

      const byCid = await receiver.getCheckpointByCid(testCid, BASE_CHAIN);
      expect(byCid.creator).to.equal(user.address);
    });
  });

  describe("Multi-chain Receiver Scenarios", function () {
    it("should allow the same CID on multiple source chains", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver, targetWormhole } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
          {
            chainId: AVALANCHE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const sharedCid =
        "bafybeimultichaincidexamplebafybeimultichaincidexample";
      const duration = DEFAULT_DURATION;
      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;
      const tagBase = ethers.encodeBytes32String("cid-base");
      const tagAvalanche = ethers.encodeBytes32String("cid-ava");

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(sharedCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      // Publish from Base
      await publisher.setTestChainId(BASE_CHAIN);
      const txBase = await publisher
        .connect(user)
        .createCheckpoint(sharedCid, duration, "0x", tagBase, true, {
          value: totalCost,
        });
      const receiptBase = await txBase.wait();
      const eventBase = findMessagePublishedEvent(receiptBase, mockWormhole);
      const parsedBase = mockWormhole.interface.parseLog(eventBase!);
      const vaaBase = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedBase,
        BASE_CHAIN
      );
      await receiver.receiveCheckpoint(vaaBase);

      // Publish from Avalanche (different source chain, same CID)
      await publisher.setTestChainId(AVALANCHE_CHAIN);
      const txAvalanche = await publisher
        .connect(user)
        .createCheckpoint(sharedCid, duration, "0x", tagAvalanche, true, {
          value: totalCost,
        });
      const receiptAvalanche = await txAvalanche.wait();
      const eventAvalanche = findMessagePublishedEvent(
        receiptAvalanche,
        mockWormhole
      );
      const parsedAvalanche = mockWormhole.interface.parseLog(eventAvalanche!);
      const vaaAvalanche = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedAvalanche,
        AVALANCHE_CHAIN
      );
      await receiver.receiveCheckpoint(vaaAvalanche);

      expect(await receiver.totalCheckpoints()).to.equal(2n);
      expect(await receiver.checkpointCountByChain(BASE_CHAIN)).to.equal(1n);
      expect(await receiver.checkpointCountByChain(AVALANCHE_CHAIN)).to.equal(
        1n
      );

      const exists = await receiver.checkCidExistsOnChains(sharedCid, [
        BASE_CHAIN,
        AVALANCHE_CHAIN,
        ETHEREUM_CHAIN,
      ]);
      expect(exists).to.deep.equal([true, true, false]);

      const baseCheckpoint = await receiver.getCheckpointByCid(
        sharedCid,
        BASE_CHAIN
      );
      const avalancheCheckpoint = await receiver.getCheckpointByCid(
        sharedCid,
        AVALANCHE_CHAIN
      );
      expect(baseCheckpoint.tag).to.equal(tagBase);
      expect(avalancheCheckpoint.tag).to.equal(tagAvalanche);
    });

    it("should deliver the same VAA to multiple receivers", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver: avalancheReceiver, targetWormhole: avalancheWormhole } =
        await deployReceiverWithEmitters(AVALANCHE_CHAIN, owner, [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]);

      const { receiver: ethereumReceiver } = await deployReceiverWithEmitters(
        ETHEREUM_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const testCid = "bafybeibroadcastcidbafybeibroadcastcidbafybeibroadc";
      const testTag = ethers.encodeBytes32String("broadcast");
      const duration = DEFAULT_DURATION;
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
      const messageEvent = findMessagePublishedEvent(receipt, mockWormhole);
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);

      const vaa = await buildMockVaa(
        avalancheWormhole,
        await publisher.getAddress(),
        parsedEvent,
        BASE_CHAIN
      );

      await avalancheReceiver.receiveCheckpoint(vaa);
      await ethereumReceiver.receiveCheckpoint(vaa);

      const avalancheStored = await avalancheReceiver.getCheckpointByCid(
        testCid,
        BASE_CHAIN
      );
      const ethereumStored = await ethereumReceiver.getCheckpointByCid(
        testCid,
        BASE_CHAIN
      );

      expect(avalancheStored.cid).to.equal(testCid);
      expect(ethereumStored.cid).to.equal(testCid);
    });
  });

  describe("Security & Validation Tests", function () {
    it("should reject replay attack (same VAA submitted twice)", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver, targetWormhole } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const testCid = "bafybeireplayattackcidbafybeireplayattackcidexample";
      const testTag = ethers.encodeBytes32String("replay-test");
      const duration = DEFAULT_DURATION;
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
      const messageEvent = findMessagePublishedEvent(receipt, mockWormhole);
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);

      const vaa = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedEvent,
        BASE_CHAIN
      );

      // First submission - should succeed
      await expect(receiver.receiveCheckpoint(vaa)).to.emit(
        receiver,
        "CheckpointReceived"
      );

      // Second submission - should fail with VAAConsumed error
      await expect(receiver.receiveCheckpoint(vaa))
        .to.be.revertedWithCustomError(receiver, "VAAConsumed")
        .withArgs(
          await targetWormhole.parseAndVerifyVM(vaa).then((r) => r[0].hash)
        );
    });

    it("should reject VAA from untrusted emitter", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      // Deploy receiver WITHOUT adding publisher as trusted emitter
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const targetWormhole = await MockWormholeCore.deploy();
      await targetWormhole.setChainId(AVALANCHE_CHAIN);

      const WormholeReceiver =
        await ethers.getContractFactory("WormholeReceiver");
      const receiver = await WormholeReceiver.deploy(
        await targetWormhole.getAddress(),
        await owner.getAddress()
      );

      const testCid = "bafybeiuntrustedcidbafybeiuntrustedcidexampledata";
      const testTag = ethers.encodeBytes32String("untrusted");
      const duration = DEFAULT_DURATION;
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
      const messageEvent = findMessagePublishedEvent(receipt, mockWormhole);
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);

      const vaa = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedEvent,
        BASE_CHAIN
      );

      // Should fail with UntrustedEmitter error
      await expect(receiver.receiveCheckpoint(vaa))
        .to.be.revertedWithCustomError(receiver, "UntrustedEmitter")
        .withArgs(BASE_CHAIN, toWormholeAddress(await publisher.getAddress()));
    });

    it("should reject duplicate CID on same source chain", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver, targetWormhole } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const sharedCid = "bafybeiduplicatecidbafybeiduplicatecidexampledata";
      const testTag1 = ethers.encodeBytes32String("first");
      const testTag2 = ethers.encodeBytes32String("second");
      const duration = DEFAULT_DURATION;
      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(sharedCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      // First checkpoint - should succeed
      const tx1 = await publisher
        .connect(user)
        .createCheckpoint(sharedCid, duration, "0x", testTag1, true, {
          value: totalCost,
        });
      const receipt1 = await tx1.wait();
      const event1 = findMessagePublishedEvent(receipt1, mockWormhole);
      const parsed1 = mockWormhole.interface.parseLog(event1!);
      const vaa1 = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsed1,
        BASE_CHAIN
      );
      await receiver.receiveCheckpoint(vaa1);

      // Second checkpoint with SAME CID on SAME chain - should fail
      const tx2 = await publisher
        .connect(user)
        .createCheckpoint(sharedCid, duration, "0x", testTag2, true, {
          value: totalCost,
        });
      const receipt2 = await tx2.wait();
      const event2 = findMessagePublishedEvent(receipt2, mockWormhole);
      const parsed2 = mockWormhole.interface.parseLog(event2!);
      const vaa2 = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsed2,
        BASE_CHAIN
      );

      await expect(receiver.receiveCheckpoint(vaa2))
        .to.be.revertedWithCustomError(receiver, "CIDAlreadyExistsOnChain")
        .withArgs(cidHash, BASE_CHAIN);
    });

    it("should fully validate CheckpointReceived event arguments", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver, targetWormhole } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const testCid = "bafybeieventvalidationcidbafybeieventvalidationcid";
      const testTag = ethers.encodeBytes32String("event-test");
      const duration = DEFAULT_DURATION;
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
      const messageEvent = findMessagePublishedEvent(receipt, mockWormhole);
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);

      const vaa = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedEvent,
        BASE_CHAIN
      );

      const deliverTx = await receiver.receiveCheckpoint(vaa);
      const deliverReceipt = await deliverTx.wait();

      const checkpointEvent = parseCheckpointReceivedEvent(
        deliverReceipt,
        receiver
      );
      expect(checkpointEvent).to.exist;

      // Validate ALL event arguments
      const args = checkpointEvent!.args;
      expect(args.vaaHash).to.exist;
      expect(args.cidHash).to.equal(cidHash);
      expect(args.tag).to.equal(testTag);
      expect(args.sourceChainId).to.equal(BASE_CHAIN);
      expect(args.creator).to.equal(user.address);
      expect(args.cid).to.equal(testCid);
      expect(args.expiresAt).to.be.gt(0);
      expect(args.receivedAt).to.be.gt(0);
    });

    it("should verify cidHashToVaaHash mapping correctness", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver, targetWormhole } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const testCid = "bafybeimappingtestcidbafybeimappingtestcidexample";
      const testTag = ethers.encodeBytes32String("mapping");
      const duration = DEFAULT_DURATION;
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
      const messageEvent = findMessagePublishedEvent(receipt, mockWormhole);
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);

      const vaa = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedEvent,
        BASE_CHAIN
      );

      const deliverTx = await receiver.receiveCheckpoint(vaa);
      const deliverReceipt = await deliverTx.wait();
      const checkpointEvent = parseCheckpointReceivedEvent(
        deliverReceipt,
        receiver
      );
      const vaaHash = checkpointEvent!.args.vaaHash;

      // Verify cidHashToVaaHash mapping
      const mappedVaaHash = await receiver.getVaaHashByCid(testCid, BASE_CHAIN);
      expect(mappedVaaHash).to.equal(vaaHash);
      expect(mappedVaaHash).to.not.equal(ethers.ZeroHash);

      // Verify getUniqueKey helper produces correct key
      const uniqueKey = await receiver.getUniqueKey(cidHash, BASE_CHAIN);
      expect(uniqueKey).to.equal(
        ethers.keccak256(
          ethers.solidityPacked(["bytes32", "uint16"], [cidHash, BASE_CHAIN])
        )
      );
    });
  });

  describe("Query Function Edge Cases", function () {
    it("should revert when querying non-existent checkpoint", async function () {
      const { owner } = await deployIntegrationFixture();

      const { receiver } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        []
      );

      const fakeVaaHash = ethers.keccak256(ethers.toUtf8Bytes("fake"));

      await expect(receiver.getCheckpoint(fakeVaaHash))
        .to.be.revertedWithCustomError(receiver, "CheckpointNotFound")
        .withArgs(fakeVaaHash);
    });

    it("should revert when querying CID that doesn't exist", async function () {
      const { owner } = await deployIntegrationFixture();

      const { receiver } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        []
      );

      const fakeCid = "bafybeinonexistentcidbafybeinonexistentcidexample";

      await expect(
        receiver.getCheckpointByCid(fakeCid, BASE_CHAIN)
      ).to.be.revertedWithCustomError(receiver, "CheckpointNotFound");
    });

    it("should return false for non-existent checkpoint validity check", async function () {
      const { owner } = await deployIntegrationFixture();

      const { receiver } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        []
      );

      const fakeVaaHash = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      const isValid = await receiver.isCheckpointValid(fakeVaaHash);

      expect(isValid).to.be.false;
    });

    it("should return zero hash for non-existent CID lookup", async function () {
      const { owner } = await deployIntegrationFixture();

      const { receiver } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        []
      );

      const fakeCid = "bafybeinonexistentcidbafybeinonexistentcidexample";
      const vaaHash = await receiver.getVaaHashByCid(fakeCid, BASE_CHAIN);

      expect(vaaHash).to.equal(ethers.ZeroHash);
    });

    it("should handle getCheckpointByCidAnyChain with no matches", async function () {
      const { owner } = await deployIntegrationFixture();

      const { receiver } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        []
      );

      const fakeCid = "bafybeinonexistentcidbafybeinonexistentcidexample";

      await expect(
        receiver.getCheckpointByCidAnyChain(fakeCid, [
          BASE_CHAIN,
          AVALANCHE_CHAIN,
          ETHEREUM_CHAIN,
        ])
      ).to.be.revertedWithCustomError(receiver, "CheckpointNotFound");
    });

    it("should return all false for checkCidExistsOnChains with no matches", async function () {
      const { owner } = await deployIntegrationFixture();

      const { receiver } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        []
      );

      const fakeCid = "bafybeinonexistentcidbafybeinonexistentcidexample";
      const exists = await receiver.checkCidExistsOnChains(fakeCid, [
        BASE_CHAIN,
        AVALANCHE_CHAIN,
        ETHEREUM_CHAIN,
      ]);

      expect(exists).to.deep.equal([false, false, false]);
    });
  });

  describe("WormholeReceiver Failure Scenarios", function () {
    it("should accept delayed delivery that is still before expiry", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver, targetWormhole } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const testCid = "bafybeidelayedcidbafybeidelayedcidexampledata";
      const testTag = ethers.encodeBytes32String("delayed-valid");
      const duration = DEFAULT_DURATION;
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
      const messageEvent = findMessagePublishedEvent(receipt, mockWormhole);
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);

      const vaa = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedEvent,
        BASE_CHAIN
      );

      const snapshotId = await ethers.provider.send("evm_snapshot", []);
      await ethers.provider.send("evm_increaseTime", [3600]); // +1 hour
      await ethers.provider.send("evm_mine", []);

      await expect(receiver.receiveCheckpoint(vaa)).to.emit(
        receiver,
        "CheckpointReceived"
      );

      await ethers.provider.send("evm_revert", [snapshotId]);
    });

    it("should reject delivery if checkpoint expired in transit", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver, targetWormhole } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const testCid = "bafybeiexpiredincidbafybeiexpiredincidxy";
      const testTag = ethers.encodeBytes32String("expired");
      const duration = 60; // 1 minute expiry
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
      const messageEvent = findMessagePublishedEvent(receipt, mockWormhole);
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);

      const vaa = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedEvent,
        BASE_CHAIN
      );

      const snapshotId = await ethers.provider.send("evm_snapshot", []);
      await ethers.provider.send("evm_increaseTime", [180]); // wait 3 minutes
      await ethers.provider.send("evm_mine", []);

      await expect(
        receiver.receiveCheckpoint(vaa)
      ).to.be.revertedWithCustomError(receiver, "InvalidExpiration");

      await ethers.provider.send("evm_revert", [snapshotId]);
    });

    it("should reject messages that are older than the allowed age", async function () {
      const { publisher, mockVerifier, mockWormhole, owner, user } =
        await deployIntegrationFixture();

      const { receiver, targetWormhole } = await deployReceiverWithEmitters(
        AVALANCHE_CHAIN,
        owner,
        [
          {
            chainId: BASE_CHAIN,
            emitterAddress: await publisher.getAddress(),
          },
        ]
      );

      const testCid = "bafybeitoooldcidbafybeitoooldcidbafybeitoooldcid123";
      const testTag = ethers.encodeBytes32String("too-old");
      const duration = DEFAULT_DURATION * 20; // keep expiry far in future
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
      const messageEvent = findMessagePublishedEvent(receipt, mockWormhole);
      const parsedEvent = mockWormhole.interface.parseLog(messageEvent!);

      const vaa = await buildMockVaa(
        targetWormhole,
        await publisher.getAddress(),
        parsedEvent,
        BASE_CHAIN
      );

      const snapshotId = await ethers.provider.send("evm_snapshot", []);
      await ethers.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]); // +8 days
      await ethers.provider.send("evm_mine", []);

      await expect(
        receiver.receiveCheckpoint(vaa)
      ).to.be.revertedWithCustomError(receiver, "MessageTooOld");

      await ethers.provider.send("evm_revert", [snapshotId]);
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
          version: 2,
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          tag: ethers.encodeBytes32String(`chain-${chainId}`),
          expiresAt: Math.floor(Date.now() / 1000) + 86400,
          creator: ethers.Wallet.createRandom().address,
          timestamp: Math.floor(Date.now() / 1000),
          sourceChainId: chainId,
          revoked: false,
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
        revoked: decoded.revoked,
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
