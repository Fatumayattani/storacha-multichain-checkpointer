/**
 * @title createAttestationAction
 * @notice ElizaOS action that bridges agent messages to the DataAttestation SDK.
 */
import { validateAttestation, normalizeAttestation } from "../sdk/index.js";
import type { DataAttestation } from "../sdk/types.js";
import { simulatedPublish } from "./publisher.js";
import type {
  Action,
  IAgentRuntime,
  Message,
  ActionResult,
  ActionCallback,
} from "./types.js";

function extractAttestation(
  runtime: IAgentRuntime,
  message: Message
): DataAttestation {
  const content = message.content;

  const cid = content.cid as string | undefined;
  if (!cid) {
    throw new Error(
      "Missing 'cid' in message content. Provide a Storacha CID to attest."
    );
  }

  const creator =
    (content.creator as string | undefined) ||
    runtime.getSetting("ATTESTATION_CREATOR_ADDRESS");
  if (!creator) {
    throw new Error(
      "Missing creator address. Set 'creator' in message content " +
        "or configure ATTESTATION_CREATOR_ADDRESS in agent settings."
    );
  }

  const timestamp =
    (content.timestamp as number | undefined) ?? Math.floor(Date.now() / 1000);

  const attestation: DataAttestation = {
    cid,
    creator,
    timestamp,
  };

  if (content.lineage) {
    attestation.lineage = content.lineage as string;
  }
  if (content.licenseHash) {
    attestation.licenseHash = content.licenseHash as string;
  }

  return attestation;
}

export const createAttestationAction: Action = {
  name: "CREATE_ATTESTATION",
  description:
    "Create a Storacha data attestation from a CID and publish it. " +
    "Requires 'cid' in message content. Optionally accepts 'creator', " +
    "'timestamp', 'lineage', and 'licenseHash'.",
  similes: [
    "ATTEST_DATA",
    "PUBLISH_ATTESTATION",
    "CREATE_DATA_ATTESTATION",
    "STORACHA_ATTEST",
  ],
  examples: [
    [
      {
        user: "agent",
        content: {
          text: "Create attestation for CID",
          cid: "bafybeidataattestationexamplecidbafybeidataattestation",
          creator: "0x1234567890123456789012345678901234567890",
        },
      },
    ],
  ],
  validate: async (
    _runtime: IAgentRuntime,
    message: Message
  ): Promise<boolean> => {
    return (
      typeof message.content?.cid === "string" && message.content.cid.length > 0
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Message,
    _state?: unknown,
    _options?: unknown,
    callback?: ActionCallback
  ): Promise<ActionResult> => {
    try {
      const attestation = extractAttestation(runtime, message);
      validateAttestation(attestation);
      const normalized = normalizeAttestation(attestation);
      const result = await simulatedPublish(normalized);

      if (callback) {
        callback({
          text: `Attestation created for CID: ${normalized.cid}`,
          data: {
            cid: normalized.cid,
            creator: normalized.creator,
            timestamp: String(normalized.timestamp),
            payload: result.payload,
          },
        });
      }

      return {
        success: true,
        data: {
          cid: normalized.cid,
          creator: normalized.creator,
          timestamp: String(normalized.timestamp),
          payload: result.payload,
          publishedAt: result.timestamp,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (callback) {
        callback({
          text: `Attestation failed: ${errorMessage}`,
        });
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};
