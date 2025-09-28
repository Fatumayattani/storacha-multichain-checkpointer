// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAvailabilityVerifier.sol";

/// @title Mock verifier for testing
/// @dev Owner can manually set availability for specific CIDs
contract MockVerifier is IAvailabilityVerifier {
    mapping(bytes32 => bool) public available;
    address public owner;

    /// @notice Structure to store detailed verification information
    struct VerificationInfo {
        bool isVerified;
        uint256 timestamp;
        address verifier;
    }

    /// @notice Mapping from CID to detailed verification information
    mapping(bytes32 => VerificationInfo) public verifications;

    event VerificationSubmitted(bytes32 indexed cid, address indexed submitter, uint256 timestamp);
    event VerificationRevoked(bytes32 indexed cid, address indexed revoker, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function setMockAvailable(bytes32 cid, bool availableStatus) external onlyOwner {
        available[cid] = availableStatus;
        
        // Store detailed verification information
        verifications[cid] = VerificationInfo({
            isVerified: availableStatus,
            timestamp: block.timestamp,
            verifier: msg.sender
        });
        
        if (availableStatus) {
            emit VerificationSubmitted(cid, msg.sender, block.timestamp);
        } else {
            emit VerificationRevoked(cid, msg.sender, block.timestamp);
        }
    }

    function isAvailable(bytes32 cid, bytes calldata) external view override returns (bool) {
        return available[cid];
    }

    /// @notice Revoke verification for a CID (testing utility)
    /// @param cid The CID to revoke verification for
    function revokeVerification(bytes32 cid) external onlyOwner {
        available[cid] = false;
        
        // Store detailed verification information
        verifications[cid] = VerificationInfo({
            isVerified: false,
            timestamp: block.timestamp,
            verifier: msg.sender
        });
        
        emit VerificationRevoked(cid, msg.sender, block.timestamp);
    }

    /// @notice Get detailed verification information for a CID
    /// @param cid The CID to check
    /// @return isVerified Whether the CID is verified
    /// @return timestamp When the verification was set
    /// @return verifier Who set the verification
    function getVerificationInfo(bytes32 cid) external view returns (bool isVerified, uint256 timestamp, address verifier) {
        VerificationInfo memory info = verifications[cid];
        return (info.isVerified, info.timestamp, info.verifier);
    }

    /// @notice Get the timestamp when a CID was verified
    /// @param cid The CID to check
    /// @return timestamp When the verification was set (0 if not verified)
    function getVerificationTimestamp(bytes32 cid) external view returns (uint256 timestamp) {
        return verifications[cid].timestamp;
    }

    /// @notice Set availability for multiple CIDs in a single transaction
    /// @param cids Array of CIDs to set
    /// @param statuses Array of availability statuses (must match cids length)
    function batchSetMockAvailable(bytes32[] calldata cids, bool[] calldata statuses) external onlyOwner {
        require(cids.length == statuses.length, "arrays length mismatch");
        require(cids.length > 0, "empty arrays");
        
        for (uint256 i = 0; i < cids.length; i++) {
            bytes32 cid = cids[i];
            bool availableStatus = statuses[i];
            
            available[cid] = availableStatus;
            
            // Store detailed verification information
            verifications[cid] = VerificationInfo({
                isVerified: availableStatus,
                timestamp: block.timestamp,
                verifier: msg.sender
            });
            
            if (availableStatus) {
                emit VerificationSubmitted(cid, msg.sender, block.timestamp);
            } else {
                emit VerificationRevoked(cid, msg.sender, block.timestamp);
            }
        }
    }

    /// @notice Set all CIDs to the same availability status
    /// @param cids Array of CIDs to set
    /// @param status The availability status to set for all CIDs
    function batchSetAllAvailable(bytes32[] calldata cids, bool status) external onlyOwner {
        require(cids.length > 0, "empty array");
        
        for (uint256 i = 0; i < cids.length; i++) {
            bytes32 cid = cids[i];
            
            available[cid] = status;
            
            // Store detailed verification information
            verifications[cid] = VerificationInfo({
                isVerified: status,
                timestamp: block.timestamp,
                verifier: msg.sender
            });
            
            if (status) {
                emit VerificationSubmitted(cid, msg.sender, block.timestamp);
            } else {
                emit VerificationRevoked(cid, msg.sender, block.timestamp);
            }
        }
    }
}
