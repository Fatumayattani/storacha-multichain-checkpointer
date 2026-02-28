import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

describe("DataAttestationCodec Library", function () {
  let codecTest: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  before(async function () {
    const DataAttestationCodecTest = await ethers.getContractFactory(
      "DataAttestationCodecTest"
    );
    codecTest = await DataAttestationCodecTest.deploy();
  });

  function buildSampleAttestation(overrides: Partial<any> = {}) {
    const now = Math.floor(Date.now() / 1000);
    return {
      cid: "bafybeidataattestationexamplecidbafybeidataattestation",
      creator: "0x1234567890123456789012345678901234567890",
      timestamp: now,
      lineage: ethers.keccak256(ethers.toUtf8Bytes("parent-lineage")),
      licenseHash: ethers.keccak256(ethers.toUtf8Bytes("license-v1")),
      ...overrides,
    };
  }

  describe("Encoding / Decoding", function () {
    it("should roundtrip encode/decode correctly with all fields set", async function () {
      const attestation = buildSampleAttestation();

      const encoded = await codecTest.encodeAttestation(attestation);
      const decoded = await codecTest.decodeAttestation(encoded);

      expect(decoded.cid).to.equal(attestation.cid);
      expect(decoded.creator).to.equal(attestation.creator);
      expect(decoded.timestamp).to.equal(attestation.timestamp);
      expect(decoded.lineage).to.equal(attestation.lineage);
      expect(decoded.licenseHash).to.equal(attestation.licenseHash);
    });

    it("should handle empty optional fields deterministically", async function () {
      const attestation = buildSampleAttestation({
        lineage: ethers.ZeroHash,
        licenseHash: ethers.ZeroHash,
      });

      const encoded = await codecTest.encodeAttestation(attestation);
      const decoded = await codecTest.decodeAttestation(encoded);

      expect(decoded.cid).to.equal(attestation.cid);
      expect(decoded.creator).to.equal(attestation.creator);
      expect(decoded.timestamp).to.equal(attestation.timestamp);
      expect(decoded.lineage).to.equal(ethers.ZeroHash);
      expect(decoded.licenseHash).to.equal(ethers.ZeroHash);
    });

    it("should produce deterministic encoding for identical attestations", async function () {
      const attestation = buildSampleAttestation();

      const encoded1 = await codecTest.encodeAttestation(attestation);
      const encoded2 = await codecTest.encodeAttestation(attestation);

      expect(encoded1).to.equal(encoded2);
    });

    it("should change encoding when any field changes", async function () {
      const base = buildSampleAttestation();

      const encodedBase = await codecTest.encodeAttestation(base);
      const encodedDifferentCid = await codecTest.encodeAttestation({
        ...base,
        cid: base.cid + "-alt",
      });
      const encodedDifferentCreator = await codecTest.encodeAttestation({
        ...base,
        creator: "0x0000000000000000000000000000000000000001",
      });
      const encodedDifferentTimestamp = await codecTest.encodeAttestation({
        ...base,
        timestamp: base.timestamp + 1,
      });
      const encodedDifferentLineage = await codecTest.encodeAttestation({
        ...base,
        lineage: ethers.keccak256(ethers.toUtf8Bytes("other-lineage")),
      });
      const encodedDifferentLicense = await codecTest.encodeAttestation({
        ...base,
        licenseHash: ethers.keccak256(ethers.toUtf8Bytes("license-v2")),
      });

      expect(encodedDifferentCid).to.not.equal(encodedBase);
      expect(encodedDifferentCreator).to.not.equal(encodedBase);
      expect(encodedDifferentTimestamp).to.not.equal(encodedBase);
      expect(encodedDifferentLineage).to.not.equal(encodedBase);
      expect(encodedDifferentLicense).to.not.equal(encodedBase);
    });
  });
});
