// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../libraries/CheckpointCodec.sol";

/**
 * @title CheckpointCodecTest
 * @notice Test contract for CheckpointCodec library
 */
contract CheckpointCodecTest {
    
    function VERSION() external pure returns (uint8) {
        return CheckpointCodec.VERSION;
    }
    
    function MIN_CID_LENGTH() external pure returns (uint256) {
        return CheckpointCodec.MIN_CID_LENGTH;
    }
    
    function MAX_CID_LENGTH() external pure returns (uint256) {
        return CheckpointCodec.MAX_CID_LENGTH;
    }
    
    function MAX_MESSAGE_AGE() external pure returns (uint256) {
        return CheckpointCodec.MAX_MESSAGE_AGE;
    }
    
    function encodeMessage(CheckpointCodec.StorachaCheckpointMessage memory message) 
        external 
        pure 
        returns (bytes memory) 
    {
        return CheckpointCodec.encode(message);
    }
    
    function decodeMessage(bytes memory encoded) 
        external 
        pure 
        returns (CheckpointCodec.StorachaCheckpointMessage memory) 
    {
        return CheckpointCodec.decode(encoded);
    }
    
    function validateMessage(CheckpointCodec.StorachaCheckpointMessage memory message) 
        external 
        view 
        returns (bool) 
    {
        return CheckpointCodec.validate(message);
    }
    
    function validateMessageWithErrors(CheckpointCodec.StorachaCheckpointMessage memory message) 
        external 
        view 
    {
        CheckpointCodec.validateWithErrors(message);
    }
    
    function getCheckpointId(CheckpointCodec.StorachaCheckpointMessage memory message) 
        external 
        pure 
        returns (bytes32) 
    {
        return CheckpointCodec.getCheckpointId(message);
    }
    
    function getMessageHash(CheckpointCodec.StorachaCheckpointMessage memory message) 
        external 
        pure 
        returns (bytes32) 
    {
        return CheckpointCodec.getMessageHash(message);
    }
    
    function isExpired(CheckpointCodec.StorachaCheckpointMessage memory message) 
        external 
        view 
        returns (bool) 
    {
        return CheckpointCodec.isExpired(message);
    }
    
    function isTooOld(CheckpointCodec.StorachaCheckpointMessage memory message) 
        external 
        view 
        returns (bool) 
    {
        return CheckpointCodec.isTooOld(message);
    }
}
