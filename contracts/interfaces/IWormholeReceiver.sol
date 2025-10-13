// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IWormholeReceiver
 * @notice Custom interface for contracts receiving cross-chain messages
 * @dev This is NOT a Wormhole standard interface - it's our project's convention
 * 
 * USAGE:
 * - WormholeReceiver implements this interface
 * - Any contract wanting to receive messages should implement this
 * - The actual message flow is: User -> Wormhole Core -> Guardian Network -> VAA -> Our Receiver
 */
interface IWormholeReceiver {
    
    /**
     * @notice Receive a cross-chain checkpoint message
     * @param payload The encoded checkpoint message (CheckpointCodec format)
     * @param sourceChain The Wormhole chain ID where message originated
     * @param sourceAddress The emitter address on source chain (bytes32 format)
     * @dev This function should:
     *      1. Decode the payload using CheckpointCodec
     *      2. Validate the message
     *      3. Store the checkpoint
     *      4. Emit events
     */
    function receiveWormholeMessage(
        bytes memory payload,
        uint16 sourceChain,
        bytes32 sourceAddress
    ) external;
    
    /**
     * @notice Process a Wormhole VAA directly
     * @param encodedVaa The encoded VAA bytes from Wormhole
     * @dev This is the actual entry point for receiving VAAs
     *      It will:
     *      1. Call IWormholeCore.parseAndVerifyVM()
     *      2. Extract payload, sourceChain, sourceAddress
     *      3. Call receiveWormholeMessage()
     */
    function receiveCheckpoint(bytes calldata encodedVaa) external;
}
