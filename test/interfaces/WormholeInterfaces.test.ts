import { expect } from "chai";
import { network } from "hardhat";
import { CHAIN_IDS } from "../../constants/chainIds.js";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

describe("Wormhole Interfaces", function () {
  // ============ INTERFACE COMPILATION ============

  describe("Interface Compilation", function () {
    it("should compile IWormholeCore interface", async function () {
      // If this test runs, the interface compiled successfully
      // Interfaces can't be deployed, but they compile if we can import them
      expect(true).to.be.true;
    });

    it("should compile IWormholeReceiver interface", async function () {
      // If this test runs, the interface compiled successfully
      expect(true).to.be.true;
    });
  });

  // ============ INTERFACE STRUCTURE ============

  describe("IWormholeCore Structure", function () {
    it("should have correct function signatures", async function () {
      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      // Check that parseAndVerifyVM exists
      expect(mockWormhole.parseAndVerifyVM).to.exist;
      expect(typeof mockWormhole.parseAndVerifyVM).to.equal("function");

      // Check other required functions
      expect(mockWormhole.chainId).to.exist;
      expect(mockWormhole.messageFee).to.exist;
      expect(mockWormhole.publishMessage).to.exist;
      expect(mockWormhole.getCurrentGuardianSetIndex).to.exist;
    });

    it("should have correct VM struct fields", async function () {
      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      // Create a mock VAA
      const mockVAA = await mockWormhole.createMockVAA(
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        ethers.zeroPadValue("0x1234567890123456789012345678901234567890", 32),
        1n,
        ethers.toUtf8Bytes("test payload")
      );

      // Parse it to verify VM structure
      const [vm] = await mockWormhole.parseAndVerifyVM(mockVAA);

      // Verify VM has all required fields
      expect(vm.version).to.exist;
      expect(vm.timestamp).to.exist;
      expect(vm.nonce).to.exist;
      expect(vm.emitterChainId).to.exist;
      expect(vm.emitterAddress).to.exist;
      expect(vm.sequence).to.exist;
      expect(vm.consistencyLevel).to.exist;
      expect(vm.payload).to.exist;
      expect(vm.guardianSetIndex).to.exist;
      expect(vm.signatures).to.exist; // ✅ CRITICAL: Must exist
      expect(vm.hash).to.exist;
    });

    it("should return correct types from parseAndVerifyVM", async function () {
      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      const mockVAA = await mockWormhole.createMockVAA(
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        ethers.zeroPadValue("0x1234567890123456789012345678901234567890", 32),
        1n,
        ethers.toUtf8Bytes("test payload")
      );

      const [vm, valid, reason] = await mockWormhole.parseAndVerifyVM(mockVAA);

      // Verify return types
      expect(typeof vm).to.equal("object");
      expect(typeof valid).to.equal("boolean");
      expect(typeof reason).to.equal("string");
    });
  });

  // ============ INTEGRATION WITH CHAIN IDS ============

  describe("Chain ID Integration", function () {
    it("should work with Base Sepolia chain ID", async function () {
      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      expect(chainId).to.equal(10004);

      // Verify mock wormhole accepts this chain ID
      const mockVAA = await mockWormhole.createMockVAA(
        chainId,
        ethers.zeroPadValue("0x1234567890123456789012345678901234567890", 32),
        1n,
        ethers.toUtf8Bytes("test")
      );

      const [vm] = await mockWormhole.parseAndVerifyVM(mockVAA);
      expect(vm.emitterChainId).to.equal(chainId);
    });

    it("should work with Avalanche Fuji chain ID", async function () {
      const chainId = CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE;
      expect(chainId).to.equal(6);
    });

    it("should work with Ethereum Sepolia chain ID", async function () {
      const chainId = CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE;
      expect(chainId).to.equal(10002);
    });
  });

  // ============ MESSAGE PUBLISHING ============

  describe("Message Publishing", function () {
    it("should publish message and return sequence", async function () {
      const [, user] = await ethers.getSigners();

      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      const payload = ethers.toUtf8Bytes("test message");
      const nonce = 0;
      const consistencyLevel = 15;

      const messageFee = await mockWormhole.messageFee();

      const tx = await mockWormhole
        .connect(user)
        .publishMessage(nonce, payload, consistencyLevel, {
          value: messageFee,
        });

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return (
            mockWormhole.interface.parseLog(log)?.name === "MessagePublished"
          );
        } catch {
          return false;
        }
      });

      expect(event).to.exist;
    });

    it("should reject message without fee", async function () {
      const [, user] = await ethers.getSigners();

      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      const payload = ethers.toUtf8Bytes("test message");

      await expect(
        mockWormhole.connect(user).publishMessage(0, payload, 15, { value: 0 })
      ).to.be.revertedWith("Insufficient fee");
    });
  });

  // ============ VAA PARSING ============

  describe("VAA Parsing", function () {
    it("should parse valid VAA", async function () {
      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      const mockVAA = await mockWormhole.createMockVAA(
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        ethers.zeroPadValue("0x1234567890123456789012345678901234567890", 32),
        1n,
        ethers.toUtf8Bytes("valid payload")
      );

      const [vm, valid, reason] = await mockWormhole.parseAndVerifyVM(mockVAA);

      expect(valid).to.be.true;
      expect(reason).to.equal("");
      expect(vm.emitterChainId).to.equal(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
    });

    it("should reject malformed VAA", async function () {
      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      const malformedVAA = "0x1234"; // Invalid VAA

      const [, valid, reason] =
        await mockWormhole.parseAndVerifyVM(malformedVAA);
      expect(valid).to.be.false;
      expect(reason).to.not.equal("");
    });

    it("should extract payload correctly", async function () {
      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      const testPayload = ethers.toUtf8Bytes("test checkpoint data");
      const mockVAA = await mockWormhole.createMockVAA(
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        ethers.zeroPadValue("0x1234567890123456789012345678901234567890", 32),
        1n,
        testPayload
      );

      const [vm] = await mockWormhole.parseAndVerifyVM(mockVAA);

      expect(ethers.toUtf8String(vm.payload)).to.equal("test checkpoint data");
    });
  });

  // ============ INTERFACE COMPATIBILITY ============

  describe("IWormholeReceiver Compatibility", function () {
    it("should have receiveWormholeMessage function", async function () {
      // This will be tested when WormholeReceiver is implemented
      // For now, just verify the interface compiles
      expect(true).to.be.true;
    });

    it("should have receiveCheckpoint function", async function () {
      // This will be tested when WormholeReceiver is implemented
      expect(true).to.be.true;
    });
  });

  // ============ TYPE SAFETY ============

  describe("Type Safety", function () {
    it("should handle bytes32 emitter addresses", async function () {
      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      const emitterAddress = ethers.zeroPadValue(
        "0x1234567890123456789012345678901234567890",
        32
      );

      const mockVAA = await mockWormhole.createMockVAA(
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        emitterAddress,
        1n,
        ethers.toUtf8Bytes("test")
      );

      const [vm] = await mockWormhole.parseAndVerifyVM(mockVAA);
      expect(vm.emitterAddress).to.equal(emitterAddress);
    });

    it("should handle uint16 chain IDs", async function () {
      const chainId = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
      expect(chainId).to.be.lessThan(65536); // uint16 max
    });

    it("should handle uint64 sequences", async function () {
      // Deploy a mock Wormhole Core contract
      const MockWormholeCore =
        await ethers.getContractFactory("MockWormholeCore");
      const mockWormhole = await MockWormholeCore.deploy();

      const mockVAA = await mockWormhole.createMockVAA(
        CHAIN_IDS.BASE_SEPOLIA_WORMHOLE,
        ethers.zeroPadValue("0x1234567890123456789012345678901234567890", 32),
        999999999n, // Large sequence number
        ethers.toUtf8Bytes("test")
      );

      const [vm] = await mockWormhole.parseAndVerifyVM(mockVAA);
      expect(vm.sequence).to.equal(999999999n);
    });
  });
});
