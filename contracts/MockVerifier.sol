// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAvailabilityVerifier.sol";

/// @title Mock verifier for testing
/// @dev Owner can manually set availability for specific CIDs
contract MockVerifier is IAvailabilityVerifier {
    mapping(bytes32 => bool) public available;
    address public owner;

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
        
        if (availableStatus) {
            emit VerificationSubmitted(cid, msg.sender, block.timestamp);
        } else {
            emit VerificationRevoked(cid, msg.sender, block.timestamp);
        }
    }

    function isAvailable(bytes32 cid, bytes calldata) external view override returns (bool) {
        return available[cid];
    }
}
