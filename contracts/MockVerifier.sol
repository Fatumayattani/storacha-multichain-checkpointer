// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAvailabilityVerifier.sol";

/// @title Mock verifier for testing
/// @dev Owner can manually set availability for specific CIDs
contract MockVerifier is IAvailabilityVerifier {
    mapping(bytes32 => bool) public available;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function setMockAvailable(bytes32 cid, bool availableStatus) external onlyOwner {
        available[cid] = availableStatus;
    }

    function isAvailable(bytes32 cid, bytes calldata) external view override returns (bool) {
        return available[cid];
    }
}
