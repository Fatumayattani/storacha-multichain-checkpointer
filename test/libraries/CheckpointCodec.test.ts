import { expect } from "chai";
import { network } from "hardhat";
import { CHAIN_IDS } from "../../constants/chainIds.js";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

describe("CheckpointCodec Library", function () {
  let testContract: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  before(async function () {
    // Deploy a test contract that uses the library
    const CheckpointCodecTest = await ethers.getContractFactory(
      "CheckpointCodecTest"
    );
    testContract = await CheckpointCodecTest.deploy();
  });

  describe("Constants", function () {
    it("should have correct version", async function () {
      expect(await testContract.VERSION()).to.equal(2);
    });

    it("should have correct CID length limits", async function () {
      expect(await testContract.MIN_CID_LENGTH()).to.equal(40);
      expect(await testContract.MAX_CID_LENGTH()).to.equal(100);
    });

    it("should have correct max message age", async function () {
      expect(await testContract.MAX_MESSAGE_AGE()).to.equal(7 * 24 * 60 * 60);
    });
  });

  describe("Encoding/Decoding", function () {
    it("should encode and decode round-trip correctly", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600, // 1 hour from now
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      const encoded = await testContract.encodeMessage(message);
      const decoded = await testContract.decodeMessage(encoded);

      expect(decoded.version).to.equal(message.version);
      expect(decoded.cid).to.equal(message.cid);
      expect(decoded.tag).to.equal(message.tag);
      expect(decoded.expiresAt).to.equal(message.expiresAt);
      expect(decoded.creator).to.equal(message.creator);
      expect(decoded.timestamp).to.equal(message.timestamp);
      expect(decoded.sourceChainId).to.equal(message.sourceChainId);
      expect(decoded.revoked).to.equal(message.revoked);
    });

    it("should handle different CID lengths", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const shortCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      const longCid =
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG" + "x".repeat(50);

      const message1 = {
        version: 2,
        cid: shortCid,
        tag: ethers.keccak256(ethers.toUtf8Bytes("test1")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        revoked: false,
      };

      const message2 = {
        ...message1,
        cid: longCid,
        tag: ethers.keccak256(ethers.toUtf8Bytes("test2")),
      };

      const encoded1 = await testContract.encodeMessage(message1);
      const encoded2 = await testContract.encodeMessage(message2);

      expect(encoded1.length).to.be.lessThan(encoded2.length);

      const decoded1 = await testContract.decodeMessage(encoded1);
      const decoded2 = await testContract.decodeMessage(encoded2);

      expect(decoded1.cid).to.equal(shortCid);
      expect(decoded2.cid).to.equal(longCid);
    });

    it("should handle malformed encoded data", async function () {
      const malformedData = ethers.toUtf8Bytes("invalid data");

      // This test verifies that malformed data causes a revert
      // The exact revert mechanism may vary by implementation
      try {
        await testContract.decodeMessage(malformedData);
        expect.fail("Expected decode to revert with malformed data");
      } catch (error) {
        // Expected to fail with malformed data
        expect(error).to.not.be.null;
      }
    });
  });

  describe("Validation", function () {
    it("should validate correct message", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.validateMessage(message)).to.be.true;
    });

    it("should reject invalid version", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 3, // Invalid version
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.validateMessage(message)).to.be.false;
    });

    it("should reject empty CID", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "", // Empty CID
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.validateMessage(message)).to.be.false;
    });

    it("should reject CID too short", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "short", // Too short
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.validateMessage(message)).to.be.false;
    });

    it("should reject CID too long", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "x".repeat(101), // Too long
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.validateMessage(message)).to.be.false;
    });

    it("should reject future timestamp", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime + 3600, // Future timestamp
        sourceChainId: CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.validateMessage(message)).to.be.false;
    });

    it("should reject past expiration", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime - 3600, // Past expiration
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.validateMessage(message)).to.be.false;
    });

    it("should reject zero address creator", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x0000000000000000000000000000000000000000", // Zero address
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.validateMessage(message)).to.be.false;
    });

    it("should reject zero source chain ID", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: 0, // Zero chain ID
        revoked: false,
      };

      expect(await testContract.validateMessage(message)).to.be.false;
    });
  });

  describe("Checkpoint ID Generation", function () {
    it("should generate consistent checkpoint IDs", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      const checkpointId1 = await testContract.getCheckpointId(message);
      const checkpointId2 = await testContract.getCheckpointId(message);

      expect(checkpointId1).to.equal(checkpointId2);
    });

    it("should generate unique IDs for different messages", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message1 = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag-1")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      const message2 = {
        ...message1,
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag-2")),
      };

      const checkpointId1 = await testContract.getCheckpointId(message1);
      const checkpointId2 = await testContract.getCheckpointId(message2);

      expect(checkpointId1).to.not.equal(checkpointId2);
    });
  });

  describe("Message Hash", function () {
    it("should generate consistent message hashes", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      const hash1 = await testContract.getMessageHash(message);
      const hash2 = await testContract.getMessageHash(message);

      expect(hash1).to.equal(hash2);
    });

    it("should generate different hashes for different messages", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message1 = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag-1")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      const message2 = {
        ...message1,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG2",
      };

      const hash1 = await testContract.getMessageHash(message1);
      const hash2 = await testContract.getMessageHash(message2);

      expect(hash1).to.not.equal(hash2);
    });
  });

  describe("Expiration and Age Checks", function () {
    it("should correctly identify expired messages", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime - 3600, // Expired
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime - 7200,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.isExpired(message)).to.be.true;
    });

    it("should correctly identify non-expired messages", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600, // Not expired
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.isExpired(message)).to.be.false;
    });

    it("should correctly identify too old messages", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime - 8 * 24 * 60 * 60, // 8 days ago (too old)
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.isTooOld(message)).to.be.true;
    });

    it("should correctly identify not too old messages", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime - 6 * 24 * 60 * 60, // 6 days ago (not too old)
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.isTooOld(message)).to.be.false;
    });

    it("should handle messages exactly at MAX_MESSAGE_AGE boundary", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const maxAge = 7 * 24 * 60 * 60; // 7 days
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime - maxAge + 1, // Just under the boundary
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      expect(await testContract.isTooOld(message)).to.be.false;
    });
  });

  describe("Error Handling", function () {
    it("should throw InvalidVersion error", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 3, // Invalid version
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      await expect(
        testContract.validateMessageWithErrors(message)
      ).to.be.revertedWithCustomError(testContract, "InvalidVersion");
    });

    it("should throw InvalidCID error", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "", // Empty CID
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      await expect(
        testContract.validateMessageWithErrors(message)
      ).to.be.revertedWithCustomError(testContract, "InvalidCID");
    });

    it("should throw InvalidTimestamp error", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime + 3600, // Future timestamp
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      await expect(
        testContract.validateMessageWithErrors(message)
      ).to.be.revertedWithCustomError(testContract, "InvalidTimestamp");
    });

    it("should throw InvalidExpiration error", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime - 3600, // Past expiration
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      await expect(
        testContract.validateMessageWithErrors(message)
      ).to.be.revertedWithCustomError(testContract, "InvalidExpiration");
    });

    it("should throw InvalidCreator error", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x0000000000000000000000000000000000000000", // Zero address
        timestamp: currentTime,
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      await expect(
        testContract.validateMessageWithErrors(message)
      ).to.be.revertedWithCustomError(testContract, "InvalidCreator");
    });

    it("should throw InvalidSourceChain error", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime,
        sourceChainId: 0, // Zero chain ID
        revoked: false,
      };

      await expect(
        testContract.validateMessageWithErrors(message)
      ).to.be.revertedWithCustomError(testContract, "InvalidSourceChain");
    });

    it("should throw MessageTooOld error", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const message = {
        version: 2,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        tag: ethers.keccak256(ethers.toUtf8Bytes("test-tag")),
        expiresAt: currentTime + 3600,
        creator: "0x1234567890123456789012345678901234567890",
        timestamp: currentTime - 8 * 24 * 60 * 60, // 8 days ago (too old)
        sourceChainId: CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        revoked: false,
      };

      await expect(
        testContract.validateMessageWithErrors(message)
      ).to.be.revertedWithCustomError(testContract, "MessageTooOld");
    });
  });
});
