import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

describe("StorachaCheckpointer DoS Fix", function () {
  let checkpointer: any;
  let mockVerifier: any;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    mockVerifier = await MockVerifier.deploy();

    const StorachaCheckpointer = await ethers.getContractFactory(
      "StorachaCheckpointer"
    );
    checkpointer = await StorachaCheckpointer.deploy(owner.address);

    await checkpointer.setVerifier(await mockVerifier.getAddress());
  });

  async function setAvailable(cid: string) {
    const cidHash = ethers.keccak256(ethers.toUtf8Bytes(cid));
    await mockVerifier.setMockAvailable(cidHash, true);
  }

  it("should store and retrieve checkpoint by creator and tag in O(1)", async function () {
    const cid = "QmTest123";
    await setAvailable(cid);
    const tag = ethers.encodeBytes32String("test-tag");
    const duration = 3600;
    const price = await checkpointer.pricePerSecondWei();
    const cost = price * BigInt(duration);

    await checkpointer
      .connect(user)
      .createCheckpoint(cid, duration, "0x", tag, false, { value: cost });

    const [cp, id] = await checkpointer.getCheckpointByCreatorTag(
      user.address,
      tag
    );
    expect(cp.cid).to.equal(cid);
    expect(cp.tag).to.equal(tag);
    expect(id).to.equal(1);
  });

  it("should update mapping when overwriting with same tag (Last Write Wins)", async function () {
    await setAvailable("QmFirst");
    await setAvailable("QmSecond");
    const tag = ethers.encodeBytes32String("test-tag");
    const duration = 3600;
    const price = await checkpointer.pricePerSecondWei();
    const cost = price * BigInt(duration);

    await checkpointer
      .connect(user)
      .createCheckpoint("QmFirst", duration, "0x", tag, false, { value: cost });

    await checkpointer
      .connect(user)
      .createCheckpoint("QmSecond", duration, "0x", tag, false, {
        value: cost,
      });

    const [cp, id] = await checkpointer.getCheckpointByCreatorTag(
      user.address,
      tag
    );
    expect(cp.cid).to.equal("QmSecond");
    expect(id).to.equal(2);
  });

  it("should handle multiple tags correctly", async function () {
    await setAvailable("Qm1");
    await setAvailable("Qm2");
    const tag1 = ethers.encodeBytes32String("tag-1");
    const tag2 = ethers.encodeBytes32String("tag-2");
    const duration = 3600;
    const price = await checkpointer.pricePerSecondWei();
    const cost = price * BigInt(duration);

    await checkpointer
      .connect(user)
      .createCheckpoint("Qm1", duration, "0x", tag1, false, { value: cost });
    await checkpointer
      .connect(user)
      .createCheckpoint("Qm2", duration, "0x", tag2, false, { value: cost });

    const [cp1, id1] = await checkpointer.getCheckpointByCreatorTag(
      user.address,
      tag1
    );
    expect(cp1.cid).to.equal("Qm1");
    expect(id1).to.equal(1);

    const [cp2, id2] = await checkpointer.getCheckpointByCreatorTag(
      user.address,
      tag2
    );
    expect(cp2.cid).to.equal("Qm2");
    expect(id2).to.equal(2);
  });

  it("should revert if tag not found", async function () {
    const tag = ethers.encodeBytes32String("non-existent");
    await expect(
      checkpointer.getCheckpointByCreatorTag(user.address, tag)
    ).to.be.revertedWith("not found");
  });
});
