import { isAddress, isHexString } from "ethers";
import { DataAttestation, ZERO_BYTES32 } from "./types.js";

/**
 * @notice Validate a DataAttestation object for required fields and types
 * @param attestation The attestation object to validate
 * @throws Error if the attestation is invalid
 */
export function validateAttestation(attestation: DataAttestation): void {
  if (!attestation.cid || typeof attestation.cid !== "string") {
    throw new Error("Invalid CID: must be a non-empty string.");
  }

  if (attestation.cid.length < 40) {
    throw new Error(
      `Invalid CID: too short (${attestation.cid.length} chars).`
    );
  }

  if (!attestation.creator || !isAddress(attestation.creator)) {
    throw new Error(
      `Invalid creator: must be a valid Ethereum address. Got ${attestation.creator}`
    );
  }

  if (attestation.timestamp === undefined || attestation.timestamp === null) {
    throw new Error("Invalid timestamp: must be provided.");
  }

  try {
    const ts = BigInt(attestation.timestamp);
    if (ts < 0n) {
      throw new Error("Invalid timestamp: must be non-negative.");
    }
  } catch (e) {
    throw new Error(
      `Invalid timestamp: must be a valid number or bigint. Got ${attestation.timestamp}`
    );
  }

  if (attestation.lineage && !isHexString(attestation.lineage, 32)) {
    throw new Error(
      `Invalid lineage: must be a 32-byte hex string. Got ${attestation.lineage}`
    );
  }

  if (attestation.licenseHash && !isHexString(attestation.licenseHash, 32)) {
    throw new Error(
      `Invalid licenseHash: must be a 32-byte hex string. Got ${attestation.licenseHash}`
    );
  }
}

/**
 * @notice Normalize a DataAttestation object by filling in optional fields with defaults
 * @param attestation The attestation object to normalize
 * @returns Normalized DataAttestation object
 */
export function normalizeAttestation(
  attestation: DataAttestation
): Required<DataAttestation> {
  return {
    cid: attestation.cid,
    creator: attestation.creator,
    timestamp: BigInt(attestation.timestamp),
    lineage: attestation.lineage || ZERO_BYTES32,
    licenseHash: attestation.licenseHash || ZERO_BYTES32,
  };
}
