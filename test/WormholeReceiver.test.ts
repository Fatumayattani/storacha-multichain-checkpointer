import { expect } from "chai";
import { network } from "hardhat";
import { CHAIN_IDS } from "../constants/chainIds.js";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

/**
 * @title WormholeReceiver Test Suite
 * @notice Comprehensive tests for WormholeReceiver contract
 * @dev Tests all functionality: deployment, access control, VAA processing, queries
 */
describe("WormholeReceiver Contract", function () {
  // ============ FIXTURES ============

  async function deployFixture() {
    const [owner, user, relayer, attacker] = await ethers.getSigners();

    // Deploy MockWormholeCore
    const MockWormholeCore =
      await ethers.getContractFactory("MockWormholeCore");
    const mockWormhole = await MockWormholeCore.deploy();
    await mockWormhole.setChainId(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);

    // Deploy WormholeReceiver
    const WormholeReceiver =
      await ethers.getContractFactory("WormholeReceiver");
    const receiver = await WormholeReceiver.deploy(
      await mockWormhole.getAddress(),
      owner.address
    );

    // Deploy StorachaCheckpointer (publisher)
    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    const mockVerifier = await MockVerifier.deploy();

    const TestCheckpointerFactory = await ethers.getContractFactory(
      "TestStorachaCheckpointer"
    );
    const publisher = await TestCheckpointerFactory.deploy(owner.address);
    await publisher.setTestChainId(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
    await publisher.setVerifier(await mockVerifier.getAddress());
    await publisher.setWormhole(await mockWormhole.getAddress());

    // Deploy CheckpointCodecTest for encoding/decoding
    const CheckpointCodecTest = await ethers.getContractFactory(
      "CheckpointCodecTest"
    );
    const codecTest = await CheckpointCodecTest.deploy();

    return {
      receiver,
      mockWormhole,
      publisher,
      mockVerifier,
      codecTest,
      owner,
      user,
      relayer,
      attacker,
    };
  }

  // ============ DEPLOYMENT & INITIALIZATION ============

  describe("Deployment & Initialization", function () {
    it("should deploy with correct Wormhole Core address", async function () {
      const { receiver, mockWormhole } = await deployFixture();
      const wormholeAddress = await receiver.wormholeCore();
      expect(wormholeAddress).to.equal(await mockWormhole.getAddress());
    });

    it("should deploy with correct owner", async function () {
      const { receiver, owner } = await deployFixture();
      const ownerAddress = await receiver.owner();
      expect(ownerAddress).to.equal(owner.address);
    });

    it("should have zero checkpoints initially", async function () {
      const { receiver } = await deployFixture();
      const total = await receiver.totalCheckpoints();
      expect(total).to.equal(0);
    });

    it("should revert with zero Wormhole Core address", async function () {
      const [owner] = await ethers.getSigners();
      const WormholeReceiver =
        await ethers.getContractFactory("WormholeReceiver");

      await expect(
        WormholeReceiver.deploy(ethers.ZeroAddress, owner.address)
      ).to.be.revertedWithCustomError(WormholeReceiver, "InvalidWormholeCore");
    });

    it("should revert with zero owner address", async function () {
      const { mockWormhole } = await deployFixture();
      const WormholeReceiver =
        await ethers.getContractFactory("WormholeReceiver");

      // OpenZeppelin Ownable throws OwnableInvalidOwner for zero address
      await expect(
        WormholeReceiver.deploy(
          await mockWormhole.getAddress(),
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(WormholeReceiver, "OwnableInvalidOwner");
    });
  });

  // ============ ACCESS CONTROL - ADD TRUSTED EMITTER ============

  describe("Access Control - Add Trusted Emitter", function () {
    it("should allow owner to add trusted emitter", async function () {
      const { receiver, publisher, owner } = await deployFixture();

      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );

      await expect(
        receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress)
      )
        .to.emit(receiver, "TrustedEmitterAdded")
        .withArgs(chainId, emitterAddress);

      const isTrusted = await receiver.isTrustedEmitter(
        chainId,
        emitterAddress
      );
      expect(isTrusted).to.be.true;
    });

    it("should reject non-owner adding trusted emitter", async function () {
      const { receiver, publisher, attacker } = await deployFixture();

      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );

      await expect(
        receiver.connect(attacker).addTrustedEmitter(chainId, emitterAddress)
      ).to.be.revertedWithCustomError(receiver, "OwnableUnauthorizedAccount");
    });

    it("should reject zero chain ID", async function () {
      const { receiver, publisher, owner } = await deployFixture();

      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );

      await expect(
        receiver.connect(owner).addTrustedEmitter(0, emitterAddress)
      ).to.be.revertedWithCustomError(receiver, "InvalidMessage");
    });

    it("should reject zero emitter address", async function () {
      const { receiver, owner } = await deployFixture();

      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;

      await expect(
        receiver.connect(owner).addTrustedEmitter(chainId, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(receiver, "ZeroAddress");
    });

    it("should reject duplicate emitter", async function () {
      const { receiver, publisher, owner } = await deployFixture();

      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );

      // Add first time
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      // Try to add again
      await expect(
        receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress)
      ).to.be.revertedWithCustomError(receiver, "EmitterAlreadyTrusted");
    });
  });

  // ============ ACCESS CONTROL - REMOVE TRUSTED EMITTER ============

  describe("Access Control - Remove Trusted Emitter", function () {
    it("should allow owner to remove trusted emitter", async function () {
      const { receiver, publisher, owner } = await deployFixture();

      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );

      // Add emitter first
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      // Remove emitter
      await expect(
        receiver.connect(owner).removeTrustedEmitter(chainId, emitterAddress)
      )
        .to.emit(receiver, "TrustedEmitterRemoved")
        .withArgs(chainId, emitterAddress);

      const isTrusted = await receiver.isTrustedEmitter(
        chainId,
        emitterAddress
      );
      expect(isTrusted).to.be.false;
    });

    it("should reject removing non-existent emitter", async function () {
      const { receiver, publisher, owner } = await deployFixture();

      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );

      await expect(
        receiver.connect(owner).removeTrustedEmitter(chainId, emitterAddress)
      ).to.be.revertedWithCustomError(receiver, "EmitterNotTrusted");
    });

    it("should reject non-owner removing emitter", async function () {
      const { receiver, publisher, owner, attacker } = await deployFixture();

      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );

      // Add emitter as owner
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      // Try to remove as attacker
      await expect(
        receiver.connect(attacker).removeTrustedEmitter(chainId, emitterAddress)
      ).to.be.revertedWithCustomError(receiver, "OwnableUnauthorizedAccount");
    });
  });

  // ============ ACCESS CONTROL - BATCH ADD ============

  describe("Access Control - Batch Add", function () {
    it("should add multiple emitters in batch", async function () {
      const { receiver, owner } = await deployFixture();

      const chainIds = [
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
      ];
      const emitters = [
        ethers.zeroPadValue("0x0001", 32),
        ethers.zeroPadValue("0x0002", 32),
        ethers.zeroPadValue("0x0003", 32),
      ];

      await receiver.connect(owner).addTrustedEmitterBatch(chainIds, emitters);

      for (let i = 0; i < chainIds.length; i++) {
        const isTrusted = await receiver.isTrustedEmitter(
          chainIds[i],
          emitters[i]
        );
        expect(isTrusted).to.be.true;
      }
    });

    it("should reject mismatched array lengths", async function () {
      const { receiver, owner } = await deployFixture();

      const chainIds = [CHAIN_IDS.BASE_SEPOLIA_WORMHOLE];
      const emitters = [
        ethers.zeroPadValue("0x0001", 32),
        ethers.zeroPadValue("0x0002", 32),
      ];

      await expect(
        receiver.connect(owner).addTrustedEmitterBatch(chainIds, emitters)
      ).to.be.revertedWithCustomError(receiver, "InvalidMessage");
    });
  });

  // ============ HELPER FUNCTIONS ============

  describe("Helper Functions", function () {
    it("should compute CID hash correctly", async function () {
      const { receiver } = await deployFixture();

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));

      const actualHash = await receiver.getCidHash(testCid);
      expect(actualHash).to.equal(expectedHash);
    });

    it("should return false for non-existent checkpoint", async function () {
      const { receiver } = await deployFixture();

      const fakeVaaHash = ethers.randomBytes(32);
      const exists = await receiver.checkpointExists(fakeVaaHash);
      expect(exists).to.be.false;
    });

    it("should return true for expired non-existent checkpoint", async function () {
      const { receiver } = await deployFixture();

      const fakeVaaHash = ethers.randomBytes(32);
      const expired = await receiver.isExpired(fakeVaaHash);
      expect(expired).to.be.true;
    });
  });

  // ============ VAA PROCESSING & MESSAGE RECEPTION ============

  describe("VAA Processing & Message Reception", function () {
    it("should receive and store valid checkpoint", async function () {
      const { receiver, publisher, mockVerifier, mockWormhole, owner, user } =
        await deployFixture();

      // Setup: Add trusted emitter
      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      // Create checkpoint via publisher
      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("test-checkpoint");
      const duration = 86400; // 1 day

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      // Find MessagePublished event
      const wormholeAddress = await mockWormhole.getAddress();
      const publishedEvent = receipt?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      expect(publishedEvent).to.not.be.undefined;

      const payload = publishedEvent!.args.payload;
      const sequence = publishedEvent!.args.sequence;

      // Create mock VAA
      const mockVaa = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        sequence,
        payload
      );

      // Receive checkpoint
      await expect(receiver.receiveCheckpoint(mockVaa)).to.emit(
        receiver,
        "CheckpointReceived"
      );

      // Verify counters
      const totalCheckpoints = await receiver.totalCheckpoints();
      expect(totalCheckpoints).to.equal(1);

      const chainCount = await receiver.checkpointCountByChain(chainId);
      expect(chainCount).to.equal(1);
    });

    it("should reject invalid VAA", async function () {
      const { receiver } = await deployFixture();

      const invalidVaa = "0x1234";

      await expect(
        receiver.receiveCheckpoint(invalidVaa)
      ).to.be.revertedWithCustomError(receiver, "InvalidVAA");
    });

    it("should reject VAA from untrusted emitter", async function () {
      const { receiver, publisher, mockVerifier, mockWormhole, user } =
        await deployFixture();

      // Create checkpoint but DON'T add emitter to whitelist
      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("test-checkpoint");
      const duration = 86400;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      const wormholeAddress = await mockWormhole.getAddress();
      const publishedEvent = receipt?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      const payload = publishedEvent!.args.payload;
      const sequence = publishedEvent!.args.sequence;
      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );

      const mockVaa = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        sequence,
        payload
      );

      // Try to receive without trusting emitter
      await expect(
        receiver.receiveCheckpoint(mockVaa)
      ).to.be.revertedWithCustomError(receiver, "UntrustedEmitter");
    });

    it("should reject replay attack", async function () {
      const { receiver, publisher, mockVerifier, mockWormhole, owner, user } =
        await deployFixture();

      // Setup
      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      // Create checkpoint
      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("test-checkpoint");
      const duration = 86400;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      const wormholeAddress = await mockWormhole.getAddress();
      const publishedEvent = receipt?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      const payload = publishedEvent!.args.payload;
      const sequence = publishedEvent!.args.sequence;

      const mockVaa = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        sequence,
        payload
      );

      // Receive once
      await receiver.receiveCheckpoint(mockVaa);

      // Try to receive again (replay)
      await expect(
        receiver.receiveCheckpoint(mockVaa)
      ).to.be.revertedWithCustomError(receiver, "VAAConsumed");
    });

    it("should reject duplicate CID", async function () {
      const { receiver, publisher, mockVerifier, mockWormhole, owner, user } =
        await deployFixture();

      // Setup
      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag1 = ethers.encodeBytes32String("test-1");
      const testTag2 = ethers.encodeBytes32String("test-2");
      const duration = 86400;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      // Create first checkpoint
      const tx1 = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag1, true, {
          value: totalCost,
        });

      const receipt1 = await tx1.wait();

      const wormholeAddress = await mockWormhole.getAddress();
      const event1 = receipt1?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      const mockVaa1 = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        event1!.args.sequence,
        event1!.args.payload
      );

      // Receive first
      await receiver.receiveCheckpoint(mockVaa1);

      // Create second checkpoint with SAME CID
      const tx2 = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag2, true, {
          value: totalCost,
        });

      const receipt2 = await tx2.wait();

      const event2 = receipt2?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      const mockVaa2 = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        event2!.args.sequence,
        event2!.args.payload
      );

      // Try to receive second (should fail - duplicate CID on same chain)
      await expect(
        receiver.receiveCheckpoint(mockVaa2)
      ).to.be.revertedWithCustomError(receiver, "CIDAlreadyExistsOnChain");
    });
  });

  // ============ QUERY FUNCTIONS ============

  describe("Query Functions", function () {
    it("should query checkpoint by VAA hash", async function () {
      const { receiver, publisher, mockVerifier, mockWormhole, owner, user } =
        await deployFixture();

      // Setup and receive checkpoint
      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("test-query");
      const duration = 86400;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      const wormholeAddress = await mockWormhole.getAddress();
      const publishedEvent = receipt?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      const payload = publishedEvent!.args.payload;
      const sequence = publishedEvent!.args.sequence;

      const mockVaa = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        sequence,
        payload
      );

      const receiveTx = await receiver.receiveCheckpoint(mockVaa);
      const receiveReceipt = await receiveTx.wait();

      // Get vaaHash from event
      const receiverAddress = await receiver.getAddress();
      const receivedEvent = receiveReceipt?.logs
        .filter((log) => log.address === receiverAddress)
        .map((log) => receiver.interface.parseLog(log))
        .find((parsed) => parsed?.name === "CheckpointReceived");

      const vaaHash = receivedEvent!.args.vaaHash;

      // Query checkpoint
      const checkpoint = await receiver.getCheckpoint(vaaHash);

      expect(checkpoint.cid).to.equal(testCid);
      expect(checkpoint.tag).to.equal(testTag);
      expect(checkpoint.creator).to.equal(user.address);
      expect(checkpoint.sourceChainId).to.equal(chainId);
    });

    it("should query checkpoint by CID", async function () {
      const { receiver, publisher, mockVerifier, mockWormhole, owner, user } =
        await deployFixture();

      // Setup and receive checkpoint
      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("test-cid-query");
      const duration = 86400;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      const wormholeAddress = await mockWormhole.getAddress();
      const publishedEvent = receipt?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      const payload = publishedEvent!.args.payload;
      const sequence = publishedEvent!.args.sequence;

      const mockVaa = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        sequence,
        payload
      );

      await receiver.receiveCheckpoint(mockVaa);

      // Query by CID (requires chain ID now)
      const checkpoint = await receiver.getCheckpointByCid(testCid, chainId);

      expect(checkpoint.cid).to.equal(testCid);
      expect(checkpoint.tag).to.equal(testTag);
      expect(checkpoint.creator).to.equal(user.address);
    });

    it("should validate checkpoint correctly", async function () {
      const { receiver, publisher, mockVerifier, mockWormhole, owner, user } =
        await deployFixture();

      // Setup and receive checkpoint
      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("test-valid");
      const duration = 86400;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      const wormholeAddress = await mockWormhole.getAddress();
      const publishedEvent = receipt?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      const payload = publishedEvent!.args.payload;
      const sequence = publishedEvent!.args.sequence;

      const mockVaa = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        sequence,
        payload
      );

      const receiveTx = await receiver.receiveCheckpoint(mockVaa);
      const receiveReceipt = await receiveTx.wait();

      const receiverAddress = await receiver.getAddress();
      const receivedEvent = receiveReceipt?.logs
        .filter((log) => log.address === receiverAddress)
        .map((log) => receiver.interface.parseLog(log))
        .find((parsed) => parsed?.name === "CheckpointReceived");

      const vaaHash = receivedEvent!.args.vaaHash;

      // Check validity
      const isValid = await receiver.isCheckpointValid(vaaHash);
      expect(isValid).to.be.true;
    });

    it("should return false for non-existent checkpoint", async function () {
      const { receiver } = await deployFixture();

      const fakeVaaHash = ethers.randomBytes(32);
      const isValid = await receiver.isCheckpointValid(fakeVaaHash);
      expect(isValid).to.be.false;
    });

    it("should revert when querying non-existent checkpoint", async function () {
      const { receiver } = await deployFixture();

      const fakeVaaHash = ethers.randomBytes(32);

      await expect(
        receiver.getCheckpoint(fakeVaaHash)
      ).to.be.revertedWithCustomError(receiver, "CheckpointNotFound");
    });
  });

  // ============ CONVENIENCE FUNCTIONS ============

  describe("Convenience Functions", function () {
    it("should query CID from any chain (first match)", async function () {
      const { receiver, publisher, mockVerifier, mockWormhole, owner, user } =
        await deployFixture();

      // Setup: Add trusted emitter for Base Sepolia
      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      // Create and receive checkpoint on Base Sepolia
      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("test-any-chain");
      const duration = 86400;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      const wormholeAddress = await mockWormhole.getAddress();
      const publishedEvent = receipt?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      const mockVaa = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        publishedEvent!.args.sequence,
        publishedEvent!.args.payload
      );

      await receiver.receiveCheckpoint(mockVaa);

      // Query using getCheckpointByCidAnyChain - Base is first in list
      const chainsToCheck = [
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
      ];

      const checkpoint = await receiver.getCheckpointByCidAnyChain(
        testCid,
        chainsToCheck
      );

      expect(checkpoint.cid).to.equal(testCid);
      expect(checkpoint.tag).to.equal(testTag);
      expect(checkpoint.sourceChainId).to.equal(chainId);
    });

    it("should query CID from any chain (later match)", async function () {
      const { receiver, publisher, mockVerifier, mockWormhole, owner, user } =
        await deployFixture();

      // Setup: Add trusted emitter for Avalanche
      const chainId = CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE;
      await mockWormhole.setChainId(chainId);

      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);

      // Update publisher chain ID
      const TestCheckpointer = await ethers.getContractFactory(
        "TestStorachaCheckpointer"
      );
      const publisher2 = TestCheckpointer.attach(await publisher.getAddress());
      await publisher2.setTestChainId(chainId);

      // Create checkpoint
      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("test-avalanche");
      const duration = 86400;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      const wormholeAddress = await mockWormhole.getAddress();
      const publishedEvent = receipt?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      const mockVaa = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        publishedEvent!.args.sequence,
        publishedEvent!.args.payload
      );

      await receiver.receiveCheckpoint(mockVaa);

      // Query: Base doesn't have it, Avalanche does (2nd in list)
      const chainsToCheck = [
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
      ];

      const checkpoint = await receiver.getCheckpointByCidAnyChain(
        testCid,
        chainsToCheck
      );

      expect(checkpoint.cid).to.equal(testCid);
      expect(checkpoint.sourceChainId).to.equal(chainId);
    });

    it("should revert when CID not found on any chain", async function () {
      const { receiver } = await deployFixture();

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const chainsToCheck = [
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
      ];

      await expect(
        receiver.getCheckpointByCidAnyChain(testCid, chainsToCheck)
      ).to.be.revertedWithCustomError(receiver, "CheckpointNotFound");
    });

    it("should check CID existence on multiple chains", async function () {
      const { receiver, publisher, mockVerifier, mockWormhole, owner, user } =
        await deployFixture();

      // Setup: Add trusted emitters for Base and Ethereum
      const baseChainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      await receiver
        .connect(owner)
        .addTrustedEmitter(baseChainId, emitterAddress);

      // Create checkpoint on Base Sepolia only
      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("test-existence");
      const duration = 86400;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      const wormholeAddress = await mockWormhole.getAddress();
      const publishedEvent = receipt?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      const mockVaa = await mockWormhole.createMockVAA(
        baseChainId,
        emitterAddress,
        publishedEvent!.args.sequence,
        publishedEvent!.args.payload
      );

      await receiver.receiveCheckpoint(mockVaa);

      // Check existence on all three chains
      const chainsToCheck = [
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
      ];

      const exists = await receiver.checkCidExistsOnChains(
        testCid,
        chainsToCheck
      );

      expect(exists).to.have.lengthOf(3);
      expect(exists[0]).to.be.true; // Base Sepolia - exists
      expect(exists[1]).to.be.false; // Avalanche Fuji - doesn't exist
      expect(exists[2]).to.be.false; // Ethereum Sepolia - doesn't exist
    });

    it("should return all false when CID doesn't exist anywhere", async function () {
      const { receiver } = await deployFixture();

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const chainsToCheck = [
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
      ];

      const exists = await receiver.checkCidExistsOnChains(
        testCid,
        chainsToCheck
      );

      expect(exists).to.have.lengthOf(3);
      expect(exists[0]).to.be.false;
      expect(exists[1]).to.be.false;
      expect(exists[2]).to.be.false;
    });

    it("should handle empty chains array", async function () {
      const { receiver } = await deployFixture();

      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const chainsToCheck: number[] = [];

      const exists = await receiver.checkCidExistsOnChains(
        testCid,
        chainsToCheck
      );

      expect(exists).to.have.lengthOf(0);
    });
  });

  // ============ INTEGRATION SUMMARY ============

  describe("Integration Summary", function () {
    it("should demonstrate complete workflow", async function () {
      console.log("\n   📋 Complete WormholeReceiver Workflow:");
      console.log("   =====================================");

      const { receiver, publisher, mockVerifier, mockWormhole, owner, user } =
        await deployFixture();

      console.log("   ✅ Step 1: Deploy WormholeReceiver");
      expect(await receiver.totalCheckpoints()).to.equal(0);

      console.log("   ✅ Step 2: Add trusted emitter");
      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      const emitterAddress = ethers.zeroPadValue(
        await publisher.getAddress(),
        32
      );
      await receiver.connect(owner).addTrustedEmitter(chainId, emitterAddress);
      expect(await receiver.isTrustedEmitter(chainId, emitterAddress)).to.be
        .true;

      console.log("   ✅ Step 3: Publish checkpoint from source chain");
      const testCid =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      const testTag = ethers.encodeBytes32String("workflow-test");
      const duration = 86400;

      const cidHash = ethers.keccak256(ethers.toUtf8Bytes(testCid));
      await mockVerifier.setMockAvailable(cidHash, true);

      const cost = await publisher.pricePerSecondWei();
      const checkpointCost = cost * BigInt(duration);
      const wormholeFee = await mockWormhole.messageFee();
      const totalCost = checkpointCost + wormholeFee;

      const tx = await publisher
        .connect(user)
        .createCheckpoint(testCid, duration, "0x", testTag, true, {
          value: totalCost,
        });

      const receipt = await tx.wait();

      console.log("   ✅ Step 4: Extract Wormhole message");
      const wormholeAddress = await mockWormhole.getAddress();
      const publishedEvent = receipt?.logs
        .filter((log) => log.address === wormholeAddress)
        .map((log) => mockWormhole.interface.parseLog(log))
        .find((parsed) => parsed?.name === "MessagePublished");

      expect(publishedEvent).to.not.be.undefined;

      console.log("   ✅ Step 5: Create VAA");
      const mockVaa = await mockWormhole.createMockVAA(
        chainId,
        emitterAddress,
        publishedEvent!.args.sequence,
        publishedEvent!.args.payload
      );

      console.log("   ✅ Step 6: Receive checkpoint on destination chain");
      const receiveTx = await receiver.receiveCheckpoint(mockVaa);
      const receiveReceipt = await receiveTx.wait();

      console.log("   ✅ Step 7: Verify checkpoint stored");
      expect(await receiver.totalCheckpoints()).to.equal(1);

      console.log("   ✅ Step 8: Query checkpoint by CID");
      const checkpoint = await receiver.getCheckpointByCid(testCid, chainId);
      expect(checkpoint.cid).to.equal(testCid);
      expect(checkpoint.creator).to.equal(user.address);

      console.log("   ✅ Step 9: Validate checkpoint");
      const receiverAddress = await receiver.getAddress();
      const receivedEvent = receiveReceipt?.logs
        .filter((log) => log.address === receiverAddress)
        .map((log) => receiver.interface.parseLog(log))
        .find((parsed) => parsed?.name === "CheckpointReceived");

      const vaaHash = receivedEvent!.args.vaaHash;
      const isValid = await receiver.isCheckpointValid(vaaHash);
      expect(isValid).to.be.true;

      console.log("\n   🎉 Complete workflow successful!");
      console.log("   =====================================\n");
    });
  });
});
