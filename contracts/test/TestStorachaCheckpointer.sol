// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../StorachaCheckpointer.sol";

/**
 * @title TestStorachaCheckpointer
 * @notice Test version of StorachaCheckpointer that allows setting chain ID
 * @dev This contract is only for testing purposes
 */
contract TestStorachaCheckpointer is StorachaCheckpointer {
    uint16 private _testChainId;

    constructor(address admin) StorachaCheckpointer(admin) {
        _testChainId = 10004; // Default to Base Sepolia Wormhole
    }

    /**
     * @notice Set the test chain ID
     * @param chainId The Wormhole chain ID to use for testing
     */
    function setTestChainId(uint16 chainId) external onlyRole(ADMIN_ROLE) {
        _testChainId = chainId;
    }

    /**
     * @notice Override _wormholeChainId to return test chain ID
     */
    function _wormholeChainId() internal view override returns (uint16) {
        return _testChainId;
    }
}

