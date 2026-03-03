// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../libraries/DataAttestationCodec.sol";

/**
 * @title DataAttestationCodecTest
 * @notice Test contract for DataAttestationCodec library
 */
contract DataAttestationCodecTest {
    using DataAttestationCodec for DataAttestationCodec.DataAttestation;

    function encodeAttestation(DataAttestationCodec.DataAttestation memory attestation)
        external
        pure
        returns (bytes memory)
    {
        return DataAttestationCodec.encode(attestation);
    }

    function decodeAttestation(bytes memory payload)
        external
        pure
        returns (DataAttestationCodec.DataAttestation memory)
    {
        return DataAttestationCodec.decode(payload);
    }
}

