import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

describe("DataAttestationRegistry", function () {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registry: any;
  let receiver: { address: string };
  let creator1: { address: string };
  let creator2: { address: string };
  let other: { address: string };

  const CID_A = "bafybeiregistrycidaexamplebafybeiregistrycidaexample";
  const CID_B = "bafybeiregistrycidbexamplebafybeiregistrycidbexample";
  const LINEAGE = ethers.keccak256(ethers.toUtf8Bytes("lineage-ref"));
  const LICENSE = ethers.keccak256(ethers.toUtf8Bytes("license-v1"));

  beforeEach(async function () {
    const [receiverSigner, c1, c2, otherSigner] = await ethers.getSigners();
    receiver = receiverSigner;
    creator1 = c1;
    creator2 = c2;
    other = otherSigner;
    const DataAttestationRegistry = await ethers.getContractFactory(
      "DataAttestationRegistry"
    );
    registry = await DataAttestationRegistry.deploy(receiver.address);
  });

  describe("Access control", function () {
    it("should allow only the receiver to call recordAttestation", async function () {
      const uniqueId = ethers.keccak256(ethers.toUtf8Bytes("access-1"));
      const ts = Math.floor(Date.now() / 1000);
      await registry
        .connect(receiver)
        .recordAttestation(
          uniqueId,
          CID_A,
          creator1.address,
          ts,
          LINEAGE,
          LICENSE
        );
      expect(await registry.attestationExists(uniqueId)).to.be.true;
    });

    it("should revert when non-receiver calls recordAttestation", async function () {
      const uniqueId = ethers.keccak256(ethers.toUtf8Bytes("access-2"));
      const ts = Math.floor(Date.now() / 1000);
      await expect(
        registry
          .connect(other)
          .recordAttestation(
            uniqueId,
            CID_A,
            creator1.address,
            ts,
            ethers.ZeroHash,
            ethers.ZeroHash
          )
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCaller");
    });

    it("should store receiver address from constructor", async function () {
      expect(await registry.receiver()).to.equal(receiver.address);
    });
  });

  describe("Storage and recording", function () {
    it("should record an attestation and store all fields", async function () {
      const uniqueId = ethers.keccak256(ethers.toUtf8Bytes("unique-1"));
      const timestamp = Math.floor(Date.now() / 1000);

      const tx = await registry
        .connect(receiver)
        .recordAttestation(
          uniqueId,
          CID_A,
          creator1.address,
          timestamp,
          LINEAGE,
          LICENSE
        );
      const receipt = await tx.wait();
      await expect(tx)
        .to.emit(registry, "AttestationRecorded")
        .withArgs(
          uniqueId,
          ethers.keccak256(ethers.toUtf8Bytes(CID_A)),
          creator1.address,
          CID_A,
          timestamp,
          LINEAGE,
          LICENSE,
          (await ethers.provider.getBlock(receipt!.blockHash))!.timestamp
        );

      const record = await registry.getAttestation(uniqueId);
      expect(record.cid).to.equal(CID_A);
      expect(record.creator).to.equal(creator1.address);
      expect(record.timestamp).to.equal(timestamp);
      expect(record.lineage).to.equal(LINEAGE);
      expect(record.licenseHash).to.equal(LICENSE);
      expect(record.recordedAt).to.be.gt(0);

      expect(await registry.attestationExists(uniqueId)).to.be.true;
      expect(await registry.totalAttestations()).to.equal(1n);
    });

    it("should allow multiple attestations for the same CID (different uniqueIds)", async function () {
      const id1 = ethers.keccak256(ethers.toUtf8Bytes("multi-1"));
      const id2 = ethers.keccak256(ethers.toUtf8Bytes("multi-2"));
      const id3 = ethers.keccak256(ethers.toUtf8Bytes("multi-3"));
      const ts = Math.floor(Date.now() / 1000);

      await registry
        .connect(receiver)
        .recordAttestation(id1, CID_A, creator1.address, ts, LINEAGE, LICENSE);
      await registry
        .connect(receiver)
        .recordAttestation(
          id2,
          CID_A,
          creator2.address,
          ts,
          ethers.ZeroHash,
          ethers.ZeroHash
        );
      await registry
        .connect(receiver)
        .recordAttestation(
          id3,
          CID_A,
          creator1.address,
          ts + 1,
          LINEAGE,
          LICENSE
        );

      expect(await registry.countByCID(CID_A)).to.equal(3n);
      expect(await registry.totalAttestations()).to.equal(3n);
    });
  });

  describe("Duplicate protection (replay)", function () {
    it("should revert when recording the same uniqueId twice", async function () {
      const uniqueId = ethers.keccak256(ethers.toUtf8Bytes("replay-id"));
      const ts = Math.floor(Date.now() / 1000);

      await registry
        .connect(receiver)
        .recordAttestation(
          uniqueId,
          CID_B,
          creator1.address,
          ts,
          ethers.ZeroHash,
          ethers.ZeroHash
        );

      await expect(
        registry
          .connect(receiver)
          .recordAttestation(
            uniqueId,
            CID_B,
            creator1.address,
            ts,
            ethers.ZeroHash,
            ethers.ZeroHash
          )
      )
        .to.be.revertedWithCustomError(registry, "DuplicateAttestation")
        .withArgs(uniqueId);
    });

    it("should revert when uniqueId is zero", async function () {
      const ts = Math.floor(Date.now() / 1000);
      await expect(
        registry
          .connect(receiver)
          .recordAttestation(
            ethers.ZeroHash,
            CID_A,
            creator1.address,
            ts,
            ethers.ZeroHash,
            ethers.ZeroHash
          )
      ).to.be.revertedWithCustomError(registry, "ZeroUniqueId");
    });
  });

  describe("Events", function () {
    it("should emit AttestationRecorded with correct indexed and data fields", async function () {
      const uniqueId = ethers.keccak256(ethers.toUtf8Bytes("event-test"));
      const ts = Math.floor(Date.now() / 1000);
      const tx = await registry
        .connect(receiver)
        .recordAttestation(
          uniqueId,
          CID_B,
          creator2.address,
          ts,
          LINEAGE,
          LICENSE
        );
      const receipt = await tx.wait();
      const log = receipt!.logs.find(
        (l: { topics: string[]; data: string }) => {
          try {
            const parsed = registry.interface.parseLog({
              topics: l.topics as readonly string[],
              data: l.data,
            });
            return parsed?.name === "AttestationRecorded";
          } catch {
            return false;
          }
        }
      );
      expect(log).to.exist;
      const parsed = registry.interface.parseLog({
        topics: (log as { topics: string[]; data: string })
          .topics as readonly string[],
        data: (log as { topics: string[]; data: string }).data,
      });
      expect(parsed!.args.uniqueId).to.equal(uniqueId);
      expect(parsed!.args.cidHash).to.equal(
        ethers.keccak256(ethers.toUtf8Bytes(CID_B))
      );
      expect(parsed!.args.creator).to.equal(creator2.address);
      expect(parsed!.args.cid).to.equal(CID_B);
      expect(parsed!.args.timestamp).to.equal(ts);
      expect(parsed!.args.lineage).to.equal(LINEAGE);
      expect(parsed!.args.licenseHash).to.equal(LICENSE);
      expect(parsed!.args.recordedAt).to.be.gt(0);
    });
  });

  describe("Query: getAttestation", function () {
    it("should revert when attestation does not exist", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      await expect(registry.getAttestation(fakeId))
        .to.be.revertedWithCustomError(registry, "AttestationNotFound")
        .withArgs(fakeId);
    });

    it("should return false for attestationExists when not recorded", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent2"));
      expect(await registry.attestationExists(fakeId)).to.be.false;
    });
  });

  describe("Query: getAttestationsByCID (paginated)", function () {
    beforeEach(async function () {
      const ts = Math.floor(Date.now() / 1000);
      await registry
        .connect(receiver)
        .recordAttestation(
          ethers.keccak256(ethers.toUtf8Bytes("cid-pag-1")),
          CID_A,
          creator1.address,
          ts,
          LINEAGE,
          LICENSE
        );
      await registry
        .connect(receiver)
        .recordAttestation(
          ethers.keccak256(ethers.toUtf8Bytes("cid-pag-2")),
          CID_A,
          creator2.address,
          ts,
          ethers.ZeroHash,
          ethers.ZeroHash
        );
      await registry
        .connect(receiver)
        .recordAttestation(
          ethers.keccak256(ethers.toUtf8Bytes("cid-pag-3")),
          CID_A,
          creator1.address,
          ts + 1,
          LINEAGE,
          LICENSE
        );
    });

    it("should return all attestations for a CID when limit >= total", async function () {
      const [records, total] = await registry.getAttestationsByCID(
        CID_A,
        0,
        10
      );
      expect(total).to.equal(3n);
      expect(records.length).to.equal(3);
      expect(records.every((r: { cid: string }) => r.cid === CID_A)).to.be.true;
    });

    it("should respect offset and limit", async function () {
      const [page1, total1] = await registry.getAttestationsByCID(CID_A, 0, 2);
      expect(total1).to.equal(3n);
      expect(page1.length).to.equal(2);

      const [page2, total2] = await registry.getAttestationsByCID(CID_A, 2, 5);
      expect(total2).to.equal(3n);
      expect(page2.length).to.equal(1);
    });

    it("should return empty array and total when offset >= total", async function () {
      const [records, total] = await registry.getAttestationsByCID(
        CID_A,
        10,
        5
      );
      expect(total).to.equal(3n);
      expect(records.length).to.equal(0);
    });

    it("should return empty array and zero total for unknown CID", async function () {
      const unknownCid = "bafybeiunknowncidunknowncidunknowncidunknown";
      const [records, total] = await registry.getAttestationsByCID(
        unknownCid,
        0,
        10
      );
      expect(total).to.equal(0n);
      expect(records.length).to.equal(0);
    });
  });

  describe("Query: getAttestationsByCreator (paginated)", function () {
    beforeEach(async function () {
      const ts = Math.floor(Date.now() / 1000);
      await registry
        .connect(receiver)
        .recordAttestation(
          ethers.keccak256(ethers.toUtf8Bytes("creator-pag-1")),
          CID_A,
          creator1.address,
          ts,
          LINEAGE,
          LICENSE
        );
      await registry
        .connect(receiver)
        .recordAttestation(
          ethers.keccak256(ethers.toUtf8Bytes("creator-pag-2")),
          CID_B,
          creator1.address,
          ts + 1,
          ethers.ZeroHash,
          ethers.ZeroHash
        );
    });

    it("should return attestations by creator with pagination", async function () {
      const [records, total] = await registry.getAttestationsByCreator(
        creator1.address,
        0,
        10
      );
      expect(total).to.equal(2n);
      expect(records.length).to.equal(2);
      expect(
        records.every(
          (r: { creator: string }) => r.creator === creator1.address
        )
      ).to.be.true;
    });

    it("should respect offset and limit for creator", async function () {
      const [page1, total1] = await registry.getAttestationsByCreator(
        creator1.address,
        0,
        1
      );
      expect(total1).to.equal(2n);
      expect(page1.length).to.equal(1);

      const [page2] = await registry.getAttestationsByCreator(
        creator1.address,
        1,
        10
      );
      expect(page2.length).to.equal(1);
    });

    it("should return empty for creator with no attestations", async function () {
      const newAddr = ethers.Wallet.createRandom().address;
      const [records, total] = await registry.getAttestationsByCreator(
        newAddr,
        0,
        10
      );
      expect(total).to.equal(0n);
      expect(records.length).to.equal(0);
      expect(await registry.countByCreator(newAddr)).to.equal(0n);
    });
  });

  describe("Count helpers", function () {
    it("countByCID should match getAttestationsByCID total", async function () {
      const ts = Math.floor(Date.now() / 1000);
      await registry
        .connect(receiver)
        .recordAttestation(
          ethers.keccak256(ethers.toUtf8Bytes("count-cid-1")),
          CID_A,
          creator1.address,
          ts,
          ethers.ZeroHash,
          ethers.ZeroHash
        );
      const count = await registry.countByCID(CID_A);
      const [, total] = await registry.getAttestationsByCID(CID_A, 0, 100);
      expect(count).to.equal(total);
    });

    it("countByCreator should match getAttestationsByCreator total", async function () {
      const ts = Math.floor(Date.now() / 1000);
      await registry
        .connect(receiver)
        .recordAttestation(
          ethers.keccak256(ethers.toUtf8Bytes("count-creator-1")),
          CID_A,
          creator1.address,
          ts,
          ethers.ZeroHash,
          ethers.ZeroHash
        );
      const count = await registry.countByCreator(creator1.address);
      const [, total] = await registry.getAttestationsByCreator(
        creator1.address,
        0,
        100
      );
      expect(count).to.equal(total);
    });
  });
});
