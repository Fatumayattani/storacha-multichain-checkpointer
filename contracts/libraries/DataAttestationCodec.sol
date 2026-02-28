// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DataAttestationCodec
 * @notice Library for encoding and decoding data attestation payloads
 * @dev Defines a minimal canonical format for data attestations transported via Wormhole.
 *
 * Canonical format (ABI-encoded in this exact order):
 * - string cid
 * - address creator
 * - uint256 timestamp
 * - bytes32 lineage
 * - bytes32 licenseHash
 *
 * "Optional" fields are represented as zero-values when not used:
 * - lineage == bytes32(0)   → no lineage reference
 * - licenseHash == bytes32(0) → no license information
 */
library DataAttestationCodec {
    /**
     * @notice Data attestation structure
     * @dev This structure MUST remain stable for cross-chain compatibility.
     */
    struct DataAttestation {
        string cid;          // IPFS/content identifier
        address creator;     // Attestation creator
        uint256 timestamp;   // Attestation timestamp
        bytes32 lineage;     // Optional lineage reference (e.g. parent CID hash)
        bytes32 licenseHash; // Optional license identifier/hash
    }

    /**
     * @notice Encode a data attestation into bytes
     * @param attestation The attestation to encode
     * @return Encoded attestation bytes
     * @dev Uses Solidity's abi.encode for deterministic encoding.
     */
    function encode(DataAttestation memory attestation)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(
            attestation.cid,
            attestation.creator,
            attestation.timestamp,
            attestation.lineage,
            attestation.licenseHash
        );
    }

    /**
     * @notice Decode bytes into a data attestation
     * @param payload Encoded attestation bytes
     * @return Decoded DataAttestation struct
     * @dev Expects payloads produced by {encode}. Malformed payloads will revert.
     */
    function decode(bytes memory payload)
        internal
        pure
        returns (DataAttestation memory)
    {
        (
            string memory cid,
            address creator,
            uint256 timestamp,
            bytes32 lineage,
            bytes32 licenseHash
        ) = abi.decode(payload, (string, address, uint256, bytes32, bytes32));

        return DataAttestation({
            cid: cid,
            creator: creator,
            timestamp: timestamp,
            lineage: lineage,
            licenseHash: licenseHash
        });
    }
}

