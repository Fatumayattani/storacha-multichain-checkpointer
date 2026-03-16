/**
 * @title SimulatedPublisher
 * @notice Logs attestation payloads instead of publishing on-chain.
 *         Replace with a real publisher for production use.
 */
import { encodeAttestation } from "../sdk/index.js";
import type { DataAttestation } from "../sdk/types.js";

export interface PublishResult {
  success: boolean;
  payload: string;
  attestation: Required<DataAttestation>;
  timestamp: string;
}

export async function simulatedPublish(
  attestation: Required<DataAttestation>
): Promise<PublishResult> {
  const payload = encodeAttestation(attestation);

  console.log("[SimulatedPublisher] Attestation encoded successfully");
  console.log("[SimulatedPublisher] CID:", attestation.cid);
  console.log("[SimulatedPublisher] Creator:", attestation.creator);
  console.log("[SimulatedPublisher] Timestamp:", String(attestation.timestamp));
  console.log("[SimulatedPublisher] Payload:", payload);

  return {
    success: true,
    payload,
    attestation,
    timestamp: new Date().toISOString(),
  };
}
