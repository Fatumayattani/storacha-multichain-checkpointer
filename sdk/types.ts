/**
 * @title DataAttestation
 * @notice Data attestation structure mirroring DataAttestationCodec.sol
 */
export interface DataAttestation {
  cid: string;
  creator: string;
  timestamp: bigint | number;
  lineage?: string;
  licenseHash?: string;
}

/**
 * @notice Constants for DataAttestation
 */
export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
