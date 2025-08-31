// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Interface for availability verifiers
interface IAvailabilityVerifier {
    /// @notice Returns true if the given CID is considered available
    /// @param cid CID digest (keccak256 or similar hash)
    /// @param verifierData Arbitrary data required by the verifier (e.g., proof)
    /// @return available True if the verifier considers the CID available
    function isAvailable(bytes32 cid, bytes calldata verifierData) external view returns (bool available);
}
