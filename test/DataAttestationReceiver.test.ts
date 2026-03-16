import { expect } from "chai";
import { network } from "hardhat";
import { CHAIN_IDS } from "../constants/chainIds.js";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

/**
 * @title DataAttestationReceiver Test Suite
 * @notice Comprehensive tests for DataAttestationReceiver contract
 * @dev Tests valid flow, replay rejection, untrusted emitter, and malformed payload
 */
describe("DataAttestationReceiver Contract", function () {
  let receiver: any;
  let registry: any;
  let mockWormhole: any;
  let codecTest: any;
  let owner: any;
  let other: any;
  let attacker: any;

  const CID = "bafybeireceivertestcidbafybeireceivertestcid";
  const SOURCE_CHAIN = CHAIN_IDS.BASE_SEPOLIA_WORMHOLE;
  const EMITTER = ethers.zeroPadValue("0x1234", 32);

  beforeEach(async function () {
    [owner, other, attacker] = await ethers.getSigners();

    // Deploy MockWormholeCore
    const MockWormholeCore =
      await ethers.getContractFactory("MockWormholeCore");
    mockWormhole = await MockWormholeCore.deploy();

    // Deploy DataAttestationCodecTest
    const DataAttestationCodecTest = await ethers.getContractFactory(
      "DataAttestationCodecTest"
    );
    codecTest = await DataAttestationCodecTest.deploy();

    // Deploy DataAttestationRegistry (dummy receiver first)
    const DataAttestationRegistry = await ethers.getContractFactory(
      "DataAttestationRegistry"
    );
    registry = await DataAttestationRegistry.deploy(
      owner.address,
      owner.address
    );

    // Deploy DataAttestationReceiver
    const DataAttestationReceiver = await ethers.getContractFactory(
      "DataAttestationReceiver"
    );
    receiver = await DataAttestationReceiver.deploy(
      await mockWormhole.getAddress(),
      await registry.getAddress(),
      owner.address
    );

    // Update Registry receiver to the actual DataAttestationReceiver
    await registry.connect(owner).setReceiver(await receiver.getAddress());
  });

  describe("Deployment", function () {
    it("should initialize with correct addresses", async function () {
      expect(await receiver.wormholeCore()).to.equal(
        await mockWormhole.getAddress()
      );
      expect(await receiver.registry()).to.equal(await registry.getAddress());
      expect(await receiver.owner()).to.equal(owner.address);
    });

    it("should revert with zero Wormhole Core address", async function () {
      const DataAttestationReceiver = await ethers.getContractFactory(
        "DataAttestationReceiver"
      );
      await expect(
        DataAttestationReceiver.deploy(
          ethers.ZeroAddress,
          await registry.getAddress(),
          owner.address
        )
      ).to.be.revertedWithCustomError(
        DataAttestationReceiver,
        "InvalidWormholeCore"
      );
    });

    it("should revert with zero registry address", async function () {
      const DataAttestationReceiver = await ethers.getContractFactory(
        "DataAttestationReceiver"
      );
      await expect(
        DataAttestationReceiver.deploy(
          await mockWormhole.getAddress(),
          ethers.ZeroAddress,
          owner.address
        )
      ).to.be.revertedWithCustomError(
        DataAttestationReceiver,
        "InvalidRegistry"
      );
    });
  });

  describe("Trusted Emitters", function () {
    it("should allow owner to add trusted emitter", async function () {
      await expect(
        receiver.connect(owner).addTrustedEmitter(SOURCE_CHAIN, EMITTER)
      )
        .to.emit(receiver, "TrustedEmitterAdded")
        .withArgs(SOURCE_CHAIN, EMITTER);

      expect(await receiver.isTrustedEmitter(SOURCE_CHAIN, EMITTER)).to.be.true;
    });

    it("should allow owner to batch add trusted emitters", async function () {
      const chainIds = [
        CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE,
        CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE,
      ];
      const emitters = [
        ethers.zeroPadValue("0x5678", 32),
        ethers.zeroPadValue("0x9abc", 32),
      ];

      await receiver.connect(owner).addTrustedEmitterBatch(chainIds, emitters);

      expect(await receiver.isTrustedEmitter(chainIds[0], emitters[0])).to.be
        .true;
      expect(await receiver.isTrustedEmitter(chainIds[1], emitters[1])).to.be
        .true;
    });

    it("should allow owner to remove trusted emitter", async function () {
      await receiver.connect(owner).addTrustedEmitter(SOURCE_CHAIN, EMITTER);
      await expect(
        receiver.connect(owner).removeTrustedEmitter(SOURCE_CHAIN, EMITTER)
      )
        .to.emit(receiver, "TrustedEmitterRemoved")
        .withArgs(SOURCE_CHAIN, EMITTER);

      expect(await receiver.isTrustedEmitter(SOURCE_CHAIN, EMITTER)).to.be
        .false;
    });

    it("should reject non-owner modifying emitters", async function () {
      await expect(
        receiver.connect(attacker).addTrustedEmitter(SOURCE_CHAIN, EMITTER)
      ).to.be.revertedWithCustomError(receiver, "OwnableUnauthorizedAccount");
    });
  });

  describe("VAA Processing & Forwarding", function () {
    let validVaa: string;
    let attestation: any;

    beforeEach(async function () {
      // Add trusted emitter
      await receiver.connect(owner).addTrustedEmitter(SOURCE_CHAIN, EMITTER);

      // Create valid attestation payload
      attestation = {
        cid: CID,
        creator: other.address,
        timestamp: Math.floor(Date.now() / 1000),
        lineage: ethers.keccak256(ethers.toUtf8Bytes("lineage")),
        licenseHash: ethers.keccak256(ethers.toUtf8Bytes("license")),
      };

      const payload = await codecTest.encodeAttestation(attestation);

      // Create mock VAA
      validVaa = await mockWormhole.createMockVAA(
        SOURCE_CHAIN,
        EMITTER,
        1,
        payload
      );
    });

    it("should successfully receive and record a valid attestation", async function () {
      const tx = await receiver.receiveAttestation(validVaa);
      const receipt = await tx.wait();

      // Find AttestationReceived event in receiver
      const receiverEvent = receipt.logs
        .filter((log: any) => log.address === receiver.target)
        .map((log: any) => receiver.interface.parseLog(log))
        .find((parsed: any) => parsed?.name === "AttestationReceived");

      expect(receiverEvent).to.not.be.undefined;
      const vaaHash = receiverEvent!.args.vaaHash;

      // Verify registry was called and data recorded
      const record = await registry.getAttestation(vaaHash);
      expect(record.cid).to.equal(CID);
      expect(record.creator).to.equal(other.address);
      expect(record.timestamp).to.equal(attestation.timestamp);
      expect(record.lineage).to.equal(attestation.lineage);
      expect(record.licenseHash).to.equal(attestation.licenseHash);

      // Verify VAA marked as consumed
      expect(await receiver.isVAAConsumed(vaaHash)).to.be.true;
    });

    it("should reject replay attacks", async function () {
      await receiver.receiveAttestation(validVaa);
      await expect(
        receiver.receiveAttestation(validVaa)
      ).to.be.revertedWithCustomError(receiver, "VAAConsumed");
    });

    it("should reject VAAs from untrusted emitters", async function () {
      const UNTRUSTED_EMITTER = ethers.zeroPadValue("0x5678", 32);
      const untrustedVaa = await mockWormhole.createMockVAA(
        SOURCE_CHAIN,
        UNTRUSTED_EMITTER,
        2,
        "0x"
      );

      await expect(receiver.receiveAttestation(untrustedVaa))
        .to.be.revertedWithCustomError(receiver, "UntrustedEmitter")
        .withArgs(SOURCE_CHAIN, UNTRUSTED_EMITTER);
    });

    it("should reject malformed payloads", async function () {
      const malformedPayload = "0x1234"; // Not a valid ABI-encoded DataAttestation
      const malformedVaa = await mockWormhole.createMockVAA(
        SOURCE_CHAIN,
        EMITTER,
        3,
        malformedPayload
      );

      // Decoding will fail inside DataAttestationCodec.decode (abi.decode)
      await expect(
        receiver.receiveAttestation(malformedVaa)
      ).to.be.revertedWithoutReason();
    });

    it("should reject invalid VAAs (mock verification failure)", async function () {
      const invalidVaa = "0x"; // MockWormholeCore will fail to decode this
      await expect(
        receiver.receiveAttestation(invalidVaa)
      ).to.be.revertedWithCustomError(receiver, "InvalidVAA");
    });
  });
});
