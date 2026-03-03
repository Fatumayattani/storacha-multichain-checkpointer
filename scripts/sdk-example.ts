/**
 * @title SDK Example
 * @notice Example script demonstrating how to use the DataAttestation SDK
 */
import {
  encodeAttestation,
  decodeAttestation,
  validateAttestation,
  normalizeAttestation,
  DataAttestation,
} from "../sdk/index.js";

async function main() {
  console.log("--- DataAttestation SDK Example ---");

  const attestation: DataAttestation = {
    cid: "bafybeidataattestationexamplecidbafybeidataattestation",
    creator: "0x1234567890123456789012345678901234567890",
    timestamp: Math.floor(Date.now() / 1000),
  };

  console.log("\nOriginal Attestation:", attestation);

  try {
    validateAttestation(attestation);
    console.log("✅ Attestation is valid.");
  } catch (error: any) {
    console.error("❌ Validation failed:", error.message);
    return;
  }

  const normalized = normalizeAttestation(attestation);
  console.log("\nNormalized Attestation (with defaults):", normalized);

  const encoded = encodeAttestation(attestation);
  console.log("\nEncoded Payload (for DataAttestationCodec.sol):");
  console.log(encoded);

  const decoded = decodeAttestation(encoded);
  console.log("\nDecoded Attestation (verified):", decoded);

  console.log("\n--- Example Complete ---");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
