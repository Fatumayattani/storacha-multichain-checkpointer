import { AbiCoder, getAddress, isHexString } from "ethers";
import { DataAttestation, ZERO_BYTES32 } from "./types.js";

const abiCoder = AbiCoder.defaultAbiCoder();

/**
 * @notice Encode a DataAttestation payload into bytes compatible with DataAttestationCodec.sol
 * @param attestation The attestation object to encode
 * @returns Hex string of the encoded payload
 */
export function encodeAttestation(attestation: DataAttestation): string {
  const lineage = attestation.lineage || ZERO_BYTES32;
  const licenseHash = attestation.licenseHash || ZERO_BYTES32;

  const creator = getAddress(attestation.creator);

  if (!isHexString(lineage, 32)) {
    throw new Error(
      `Invalid lineage: must be a 32-byte hex string. Got ${lineage}`
    );
  }
  if (!isHexString(licenseHash, 32)) {
    throw new Error(
      `Invalid licenseHash: must be a 32-byte hex string. Got ${licenseHash}`
    );
  }

  return abiCoder.encode(
    ["string", "address", "uint256", "bytes32", "bytes32"],
    [
      attestation.cid,
      creator,
      BigInt(attestation.timestamp),
      lineage,
      licenseHash,
    ]
  );
}

/**
 * @notice Decode a bytes payload into a DataAttestation object
 * @param payload Hex string of the encoded payload
 * @returns The decoded DataAttestation object
 */
export function decodeAttestation(payload: string): DataAttestation {
  const decoded = abiCoder.decode(
    ["string", "address", "uint256", "bytes32", "bytes32"],
    payload
  );

  return {
    cid: decoded[0],
    creator: decoded[1],
    timestamp: decoded[2],
    lineage: decoded[3],
    licenseHash: decoded[4],
  };
}
