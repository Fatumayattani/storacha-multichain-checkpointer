import { expect } from "chai";
import { network } from "hardhat";
import {
  encodeAttestation,
  decodeAttestation,
  validateAttestation,
  normalizeAttestation,
  ZERO_BYTES32,
} from "../../sdk/index.js";
import type { DataAttestation } from "../../sdk/types.js";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

describe("DataAttestation SDK", function () {
  let codecTest: any;

  before(async function () {
    const DataAttestationCodecTest = await ethers.getContractFactory(
      "DataAttestationCodecTest"
    );
    codecTest = await DataAttestationCodecTest.deploy();
  });

  const sampleAttestation: DataAttestation = {
    cid: "bafybeidataattestationexamplecidbafybeidataattestation",
    creator: "0x1234567890123456789012345678901234567890",
    timestamp: 1710000000,
    lineage: ethers.keccak256(ethers.toUtf8Bytes("parent-lineage")),
    licenseHash: ethers.keccak256(ethers.toUtf8Bytes("license-v1")),
  };

  describe("Validation", function () {
    it("should validate a correct attestation", function () {
      expect(() => validateAttestation(sampleAttestation)).to.not.throw();
    });

    it("should throw on invalid CID", function () {
      const invalid = { ...sampleAttestation, cid: "short" };
      expect(() => validateAttestation(invalid)).to.throw(/Invalid CID/);
    });

    it("should throw on invalid creator address", function () {
      const invalid = { ...sampleAttestation, creator: "0xinvalid" };
      expect(() => validateAttestation(invalid)).to.throw(/Invalid creator/);
    });

    it("should throw on invalid lineage hex", function () {
      const invalid = { ...sampleAttestation, lineage: "0x123" };
      expect(() => validateAttestation(invalid)).to.throw(/Invalid lineage/);
    });
  });

  describe("Encoding Parity (Golden Vector Tests)", function () {
    it("should match Solidity encoding for a full attestation", async function () {
      const sdkEncoded = encodeAttestation(sampleAttestation);
      const solidityEncoded =
        await codecTest.encodeAttestation(sampleAttestation);

      expect(sdkEncoded).to.equal(solidityEncoded);
    });

    it("should match Solidity encoding with default optional fields", async function () {
      const minimalAttestation: DataAttestation = {
        cid: sampleAttestation.cid,
        creator: sampleAttestation.creator,
        timestamp: sampleAttestation.timestamp,
      };

      const sdkEncoded = encodeAttestation(minimalAttestation);
      const solidityEncoded = await codecTest.encodeAttestation({
        ...minimalAttestation,
        lineage: ZERO_BYTES32,
        licenseHash: ZERO_BYTES32,
      });

      expect(sdkEncoded).to.equal(solidityEncoded);
    });

    it("should match Solidity encoding with explicit zero fields", async function () {
      const zeroFieldsAttestation: DataAttestation = {
        ...sampleAttestation,
        lineage: ZERO_BYTES32,
        licenseHash: ZERO_BYTES32,
      };

      const sdkEncoded = encodeAttestation(zeroFieldsAttestation);
      const solidityEncoded = await codecTest.encodeAttestation(
        zeroFieldsAttestation
      );

      expect(sdkEncoded).to.equal(solidityEncoded);
    });
  });

  describe("Roundtrip", function () {
    it("should decode what it encodes", function () {
      const encoded = encodeAttestation(sampleAttestation);
      const decoded = decodeAttestation(encoded);

      expect(decoded.cid).to.equal(sampleAttestation.cid);
      expect(decoded.creator.toLowerCase()).to.equal(
        sampleAttestation.creator.toLowerCase()
      );
      expect(Number(decoded.timestamp)).to.equal(
        Number(sampleAttestation.timestamp)
      );
      expect(decoded.lineage).to.equal(sampleAttestation.lineage);
      expect(decoded.licenseHash).to.equal(sampleAttestation.licenseHash);
    });
  });

  describe("Normalization", function () {
    it("should fill optional fields with defaults", function () {
      const minimal: DataAttestation = {
        cid: sampleAttestation.cid,
        creator: sampleAttestation.creator,
        timestamp: sampleAttestation.timestamp,
      };

      const normalized = normalizeAttestation(minimal);
      expect(normalized.lineage).to.equal(ZERO_BYTES32);
      expect(normalized.licenseHash).to.equal(ZERO_BYTES32);
    });
  });
});
