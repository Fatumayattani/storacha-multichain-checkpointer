// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Wormhole Receiver for checkpoint messages
abstract contract WormholeReceiver {
    event CheckpointReceived(bytes32 indexed cid, bytes32 tag, uint256 expiresAt);

    /// @notice Called when a checkpoint message is delivered from Wormhole
    /// @param payload ABI encoded: (version, cid, tag, expiresAt)
    function receiveWormholeMessage(bytes calldata payload) external virtual {
        (uint8 version, bytes32 cid, bytes32 tag, uint256 expiresAt) =
            abi.decode(payload, (uint8, bytes32, bytes32, uint256));
        require(version == 1, "invalid version");
        emit CheckpointReceived(cid, tag, expiresAt);
    }
}
