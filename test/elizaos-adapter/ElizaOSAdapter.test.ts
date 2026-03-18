import { expect } from "chai";
import { createAttestationAction } from "../../elizaos-adapter/action.js";
import { storachaAttestationPlugin } from "../../elizaos-adapter/plugin.js";
import { simulatedPublish } from "../../elizaos-adapter/publisher.js";
import { normalizeAttestation } from "../../sdk/index.js";
import type { IAgentRuntime, Message } from "../../elizaos-adapter/types.js";

function mockRuntime(settings: Record<string, string> = {}): IAgentRuntime {
  return {
    getSetting(key: string) {
      return settings[key];
    },
  };
}

function mockMessage(content: Record<string, unknown>): Message {
  return { content };
}

const SAMPLE_CID = "bafybeidataattestationexamplecidbafybeidataattestation";
const SAMPLE_CREATOR = "0x1234567890123456789012345678901234567890";

describe("ElizaOS Adapter", function () {
  describe("Plugin registration", function () {
    it("should export a plugin with the correct name", function () {
      expect(storachaAttestationPlugin.name).to.equal("storacha-attestation");
    });

    it("should register one action", function () {
      expect(storachaAttestationPlugin.actions).to.have.length(1);
      expect(storachaAttestationPlugin.actions![0].name).to.equal(
        "CREATE_ATTESTATION"
      );
    });
  });

  describe("Action validation", function () {
    it("should return true when message has a CID", async function () {
      const runtime = mockRuntime();
      const message = mockMessage({ cid: SAMPLE_CID });
      const result = await createAttestationAction.validate(runtime, message);
      expect(result).to.be.true;
    });

    it("should return false when message has no CID", async function () {
      const runtime = mockRuntime();
      const message = mockMessage({ text: "hello" });
      const result = await createAttestationAction.validate(runtime, message);
      expect(result).to.be.false;
    });

    it("should return false when CID is empty string", async function () {
      const runtime = mockRuntime();
      const message = mockMessage({ cid: "" });
      const result = await createAttestationAction.validate(runtime, message);
      expect(result).to.be.false;
    });
  });

  describe("Action handler - success", function () {
    it("should create attestation with explicit fields", async function () {
      const runtime = mockRuntime();
      const message = mockMessage({
        cid: SAMPLE_CID,
        creator: SAMPLE_CREATOR,
        timestamp: 1710000000,
      });

      const result = await createAttestationAction.handler(runtime, message);

      expect(result.success).to.be.true;
      expect(result.data).to.exist;
      expect(result.data!.cid).to.equal(SAMPLE_CID);
      expect(result.data!.creator).to.equal(SAMPLE_CREATOR);
      expect(result.data!.payload).to.be.a("string");
      expect((result.data!.payload as string).startsWith("0x")).to.be.true;
    });

    it("should use runtime setting for creator if not in message", async function () {
      const runtime = mockRuntime({
        ATTESTATION_CREATOR_ADDRESS: SAMPLE_CREATOR,
      });
      const message = mockMessage({ cid: SAMPLE_CID });

      const result = await createAttestationAction.handler(runtime, message);

      expect(result.success).to.be.true;
      expect(result.data!.creator).to.equal(SAMPLE_CREATOR);
    });

    it("should auto-generate timestamp if not provided", async function () {
      const before = Math.floor(Date.now() / 1000);
      const runtime = mockRuntime({
        ATTESTATION_CREATOR_ADDRESS: SAMPLE_CREATOR,
      });
      const message = mockMessage({ cid: SAMPLE_CID });

      const result = await createAttestationAction.handler(runtime, message);
      const after = Math.floor(Date.now() / 1000);

      expect(result.success).to.be.true;
      const ts = Number(result.data!.timestamp);
      expect(ts).to.be.at.least(before);
      expect(ts).to.be.at.most(after);
    });

    it("should invoke callback on success", async function () {
      const runtime = mockRuntime();
      const message = mockMessage({
        cid: SAMPLE_CID,
        creator: SAMPLE_CREATOR,
      });

      let callbackCalled = false;
      const callback = () => {
        callbackCalled = true;
      };

      await createAttestationAction.handler(
        runtime,
        message,
        undefined,
        undefined,
        callback
      );

      expect(callbackCalled).to.be.true;
    });
  });

  describe("Action handler - errors", function () {
    it("should fail when CID is missing", async function () {
      const runtime = mockRuntime({
        ATTESTATION_CREATOR_ADDRESS: SAMPLE_CREATOR,
      });
      const message = mockMessage({ text: "no cid" });

      const result = await createAttestationAction.handler(runtime, message);

      expect(result.success).to.be.false;
      expect(result.error).to.include("cid");
    });

    it("should fail when creator is missing everywhere", async function () {
      const runtime = mockRuntime();
      const message = mockMessage({ cid: SAMPLE_CID });

      const result = await createAttestationAction.handler(runtime, message);

      expect(result.success).to.be.false;
      expect(result.error).to.include("creator");
    });

    it("should fail on invalid CID (too short)", async function () {
      const runtime = mockRuntime();
      const message = mockMessage({
        cid: "short",
        creator: SAMPLE_CREATOR,
      });

      const result = await createAttestationAction.handler(runtime, message);

      expect(result.success).to.be.false;
      expect(result.error).to.include("CID");
    });

    it("should invoke callback on failure", async function () {
      const runtime = mockRuntime();
      const message = mockMessage({ text: "no cid" });

      let callbackText = "";
      const callback = (response: { text: string }) => {
        callbackText = response.text;
      };

      await createAttestationAction.handler(
        runtime,
        message,
        undefined,
        undefined,
        callback
      );

      expect(callbackText).to.include("failed");
    });
  });

  describe("Simulated publisher", function () {
    it("should return a successful result with encoded payload", async function () {
      const attestation = normalizeAttestation({
        cid: SAMPLE_CID,
        creator: SAMPLE_CREATOR,
        timestamp: 1710000000,
      });

      const result = await simulatedPublish(attestation);

      expect(result.success).to.be.true;
      expect(result.payload).to.be.a("string");
      expect(result.payload.startsWith("0x")).to.be.true;
      expect(result.attestation.cid).to.equal(SAMPLE_CID);
      expect(result.timestamp).to.be.a("string");
    });
  });
});
