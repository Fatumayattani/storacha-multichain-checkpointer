/**
 * @title storachaAttestationPlugin
 * @notice ElizaOS plugin that registers the attestation action.
 */
import type { Plugin } from "./types.js";
import { createAttestationAction } from "./action.js";

export const storachaAttestationPlugin: Plugin = {
  name: "storacha-attestation",
  description:
    "Storacha data attestation plugin. Enables agents to create " +
    "and publish verifiable data attestations for Storacha CIDs.",
  actions: [createAttestationAction],
};
