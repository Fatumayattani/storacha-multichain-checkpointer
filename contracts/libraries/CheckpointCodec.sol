// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CheckpointCodec
 * @notice Library for encoding/decoding Storacha checkpoint messages
 * @dev CRITICAL: This library defines the cross-chain message protocol
 * 
 * SECURITY: Any changes to encoding MUST maintain backward compatibility
 * or increment the version number and handle migration.
 */
library CheckpointCodec {
    // ============ CONSTANTS ============
    
    /// @notice Current protocol version
    uint8 public constant VERSION = 2;
    
    /// @notice Minimum CID length (IPFS CIDv0: 46 chars minimum)
    uint256 public constant MIN_CID_LENGTH = 40;
    
    /// @notice Maximum CID length (reasonable upper bound)
    uint256 public constant MAX_CID_LENGTH = 100;
    
    /// @notice Maximum message age (7 days in seconds)
    uint256 public constant MAX_MESSAGE_AGE = 7 days;
    
    // ============ ERRORS ============
    
    error InvalidVersion();
    error InvalidCID();
    error InvalidTimestamp();
    error InvalidExpiration();
    error InvalidCreator();
    error InvalidSourceChain();
    error MessageTooOld();
    
    // ============ STRUCTS ============
    
    /**
     * @notice Storacha checkpoint message structure
     * @dev This structure MUST remain stable for cross-chain compatibility
     */
    struct StorachaCheckpointMessage {
        uint8 version;           // Protocol version (must be 1 or 2)
        string cid;              // IPFS CID (40-100 characters)
        bytes32 tag;             // Unique identifier
        uint256 expiresAt;       // Expiration timestamp
        address creator;         // Message creator
        uint256 timestamp;       // Creation timestamp
        uint16 sourceChainId;    // Wormhole chain ID
        bool revoked;            // Revocation status (v2+)
    }
    
    // ============ ENCODING ============
    
    /**
     * @notice Encode a checkpoint message to bytes
     * @param message The message to encode
     * @return Encoded message bytes
     * @dev Uses Solidity's native abi.encode for compatibility
     */
    function encode(StorachaCheckpointMessage memory message) 
        internal 
        pure 
        returns (bytes memory) 
    {
        return abi.encode(
            message.version,
            message.cid,
            message.tag,
            message.expiresAt,
            message.creator,
            message.timestamp,
            message.sourceChainId,
            message.revoked
        );
    }
    
    // ============ DECODING ============
    
    /**
     * @notice Decode bytes to checkpoint message
     * @param payload The encoded message bytes
     * @return Decoded message
     * @dev Supports version 1 (7 fields) and version 2 (8 fields)
     */
    function decode(bytes memory payload) 
        internal 
        pure 
        returns (StorachaCheckpointMessage memory) 
    {
        // Peek at version (first 32 bytes)
        uint256 version;
        assembly {
            version := mload(add(payload, 32))
        }

        if (version == 2) {
            (
                uint8 v,
                string memory cid,
                bytes32 tag,
                uint256 expiresAt,
                address creator,
                uint256 timestamp,
                uint16 sourceChainId,
                bool revoked
            ) = abi.decode(
                payload,
                (uint8, string, bytes32, uint256, address, uint256, uint16, bool)
            );
            
            return StorachaCheckpointMessage({
                version: v,
                cid: cid,
                tag: tag,
                expiresAt: expiresAt,
                creator: creator,
                timestamp: timestamp,
                sourceChainId: sourceChainId,
                revoked: revoked
            });
        } else {
            // Default to version 1
            (
                uint8 v,
                string memory cid,
                bytes32 tag,
                uint256 expiresAt,
                address creator,
                uint256 timestamp,
                uint16 sourceChainId
            ) = abi.decode(
                payload,
                (uint8, string, bytes32, uint256, address, uint256, uint16)
            );
            
            return StorachaCheckpointMessage({
                version: v,
                cid: cid,
                tag: tag,
                expiresAt: expiresAt,
                creator: creator,
                timestamp: timestamp,
                sourceChainId: sourceChainId,
                revoked: false
            });
        }
    }
    
    // ============ VALIDATION ============
    
    /**
     * @notice Validate a checkpoint message
     * @param message The message to validate
     * @return True if valid, false otherwise
     * @dev Comprehensive validation for message integrity
     */
    function validate(StorachaCheckpointMessage memory message) 
        internal 
        view 
        returns (bool) 
    {
        // Check version
        if (message.version != VERSION) {
            return false;
        }
        
        // Check CID
        bytes memory cidBytes = bytes(message.cid);
        if (cidBytes.length == 0) {  // Added: Check empty first
            return false;
        }
        if (cidBytes.length < MIN_CID_LENGTH || cidBytes.length > MAX_CID_LENGTH) {
            return false;
        }
        
        // Check timestamp (not in future, allowing small clock drift)
        if (message.timestamp > block.timestamp + 60) {  // Added: 1 min tolerance
            return false;
        }
        
        // Check expiration (must be in future)
        if (message.expiresAt <= block.timestamp) {
            return false;
        }
        
        // Check creator (not zero address)
        if (message.creator == address(0)) {
            return false;
        }
        
        // Check source chain ID (not zero)
        if (message.sourceChainId == 0) {
            return false;
        }
        
        // Check message age
        if (message.timestamp < block.timestamp && block.timestamp - message.timestamp > MAX_MESSAGE_AGE) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @notice Validate a checkpoint message with custom errors
     * @param message The message to validate
     * @dev Throws specific errors for better debugging
     */
    function validateWithErrors(StorachaCheckpointMessage memory message) 
        internal 
        view 
    {
        if (message.version != VERSION) {
            revert InvalidVersion();
        }
        
        bytes memory cidBytes = bytes(message.cid);
        if (cidBytes.length == 0 || cidBytes.length < MIN_CID_LENGTH || cidBytes.length > MAX_CID_LENGTH) {
            revert InvalidCID();
        }
        
        if (message.timestamp > block.timestamp + 60) {
            revert InvalidTimestamp();
        }
        
        if (message.expiresAt <= block.timestamp) {
            revert InvalidExpiration();
        }
        
        if (message.creator == address(0)) {
            revert InvalidCreator();
        }
        
        if (message.sourceChainId == 0) {
            revert InvalidSourceChain();
        }
        
        if (message.timestamp < block.timestamp && block.timestamp - message.timestamp > MAX_MESSAGE_AGE) {
            revert MessageTooOld();
        }
    }
    
    // ============ UTILITIES ============
    
    /**
     * @notice Get checkpoint ID (unique identifier)
     * @param message The message to get ID for
     * @return Unique checkpoint ID
     * @dev Hash of creator + tag + sourceChainId ensures uniqueness per chain
     */
    function getCheckpointId(StorachaCheckpointMessage memory message) 
        internal 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encodePacked(
            message.creator,
            message.tag,
            message.sourceChainId
        ));
    }
    
    /**
     * @notice Get message hash for integrity verification
     * @param message The message to hash
     * @return Message hash
     * @dev Full message hash for integrity checking
     */
    function getMessageHash(StorachaCheckpointMessage memory message) 
        internal 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encode(
            message.version,
            message.cid,
            message.tag,
            message.expiresAt,
            message.creator,
            message.timestamp,
            message.sourceChainId,
            message.revoked
        ));
    }
    
    /**
     * @notice Check if message is expired
     * @param message The message to check
     * @return True if expired
     */
    function isExpired(StorachaCheckpointMessage memory message) 
        internal 
        view 
        returns (bool) 
    {
        return message.expiresAt <= block.timestamp;
    }
    
    /**
     * @notice Check if message is too old
     * @param message The message to check
     * @return True if too old
     */
    function isTooOld(StorachaCheckpointMessage memory message) 
        internal 
        view 
        returns (bool) 
    {
        return message.timestamp < block.timestamp && 
               block.timestamp - message.timestamp > MAX_MESSAGE_AGE;
    }
}
