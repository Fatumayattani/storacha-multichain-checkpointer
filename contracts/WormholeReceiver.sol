// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IWormholeCore.sol";
import "./interfaces/IWormholeReceiver.sol";
import "./libraries/CheckpointCodec.sol";

/**
 * @title WormholeReceiver
 * @notice Receives and validates cross-chain checkpoint messages via Wormhole
 * @dev Implements secure message reception with replay protection and emitter validation
 * 
 * SECURITY FEATURES:
 * - VAA verification using Wormhole Core
 * - Replay attack prevention (consumed VAAs tracking)
 * - Trusted emitter whitelist per chain
 * - Message validation (expiration, age, format)
 * - ReentrancyGuard for external calls
 * 
 * USAGE:
 * 1. Deploy contract with Wormhole Core address
 * 2. Add trusted emitters (publisher contracts) via addTrustedEmitter()
 * 3. Users submit VAAs via receiveCheckpoint()
 * 4. Query checkpoints via various getter functions
 * 
 * @custom:security-contact security@storacha.network
 */
contract WormholeReceiver is IWormholeReceiver, Ownable, ReentrancyGuard {
    
    // ============ STATE VARIABLES ============
    
    /// @notice Wormhole Core Bridge contract
    IWormholeCore public immutable wormholeCore;
    
    // ============ STORAGE ============
    
    /**
     * @notice Stored checkpoint structure
     * @dev Optimized storage layout - no redundant fields
     * 
     * NOTE: vaaHash is NOT stored here because it's the mapping key.
     * Access pattern: checkpoints[vaaHash] = StoredCheckpoint
     */
    struct StoredCheckpoint {
        string cid;              // IPFS CID (40-100 chars)
        bytes32 tag;             // User-defined tag for indexing
        uint256 expiresAt;       // Expiration timestamp
        address creator;         // Original creator on source chain
        uint256 timestamp;       // Creation time on SOURCE chain
        uint16 sourceChainId;    // Wormhole chain ID (10004, 6, 10002)
        bytes32 emitterAddress;  // Publisher contract address (bytes32)
        uint256 receivedAt;      // When received on THIS chain
    }
    
    /// @notice Main checkpoint storage (VAA hash => checkpoint)
    /// @dev VAA hash is keccak256(encodedVaa) - unique per VAA
    mapping(bytes32 => StoredCheckpoint) public checkpoints;
    
    /// @notice CID+Chain to VAA hash lookup (for CID queries)
    /// @dev Key is keccak256(abi.encodePacked(cidHash, chainId))
    /// Same CID can exist on different chains (one per chain)
    /// Use getUniqueKey(cidHash, chainId) to compute key
    mapping(bytes32 => bytes32) public cidHashToVaaHash;
    
    /// @notice Replay protection: consumed VAA hashes
    /// @dev Prevents same VAA from being processed twice
    mapping(bytes32 => bool) public consumedVAAs;
    
    /// @notice Trusted emitter whitelist: chainId => emitter => trusted
    /// @dev Only messages from trusted emitters are accepted
    /// Emitter address is bytes32 (Wormhole format: address left-padded to 32 bytes)
    mapping(uint16 => mapping(bytes32 => bool)) public trustedEmitters;
    
    /// @notice Checkpoint count per source chain
    mapping(uint16 => uint256) public checkpointCountByChain;
    
    /// @notice Total checkpoint count across all chains
    uint256 public totalCheckpoints;
    
    // ============ ERRORS ============
    
    /// @notice Invalid Wormhole Core address (zero address)
    error InvalidWormholeCore();
    
    /// @notice VAA verification failed
    error InvalidVAA();
    
    /// @notice VAA already consumed (replay attack)
    /// @param vaaHash The consumed VAA hash
    error VAAConsumed(bytes32 vaaHash);
    
    /// @notice Message from untrusted emitter
    /// @param chainId Source chain ID
    /// @param emitter Emitter address
    error UntrustedEmitter(uint16 chainId, bytes32 emitter);
    
    /// @notice Checkpoint already expired
    error CheckpointExpired();
    
    /// @notice Message too old (> 7 days)
    error CheckpointTooOld();
    
    /// @notice Checkpoint not found
    /// @param vaaHash The requested VAA hash
    error CheckpointNotFound(bytes32 vaaHash);
    
    /// @notice Invalid message format or content
    /// @param reason Detailed reason
    error InvalidMessage(string reason);
    
    /// @notice Emitter already trusted
    /// @param chainId Chain ID
    /// @param emitter Emitter address
    error EmitterAlreadyTrusted(uint16 chainId, bytes32 emitter);
    
    /// @notice Emitter not trusted
    /// @param chainId Chain ID
    /// @param emitter Emitter address
    error EmitterNotTrusted(uint16 chainId, bytes32 emitter);
    
    /// @notice CID already exists (duplicate)
    /// @param cidHash Hash of the CID
    error CIDAlreadyExists(bytes32 cidHash);
    
    /// @notice Zero address provided
    error ZeroAddress();
    
    // ============ EVENTS ============
    
    /**
     * @notice Emitted when a checkpoint is successfully received
     * @param vaaHash Unique VAA hash
     * @param cidHash Hash of the CID (for efficient filtering)
     * @param tag User-defined tag
     * @param sourceChainId Wormhole chain ID where message originated
     * @param creator Original creator address
     * @param cid Full IPFS CID string
     * @param expiresAt Expiration timestamp
     * @param receivedAt Reception timestamp on this chain
     */
    event CheckpointReceived(
        bytes32 indexed vaaHash,
        bytes32 indexed cidHash,
        bytes32 indexed tag,
        uint16 sourceChainId,
        address creator,
        string cid,
        uint256 expiresAt,
        uint256 receivedAt
    );
    
    /**
     * @notice Emitted when a trusted emitter is added
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address (bytes32)
     */
    event TrustedEmitterAdded(
        uint16 indexed chainId,
        bytes32 indexed emitter
    );
    
    /**
     * @notice Emitted when a trusted emitter is removed
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address (bytes32)
     */
    event TrustedEmitterRemoved(
        uint16 indexed chainId,
        bytes32 indexed emitter
    );
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Initialize WormholeReceiver contract
     * @param _wormholeCore Address of Wormhole Core Bridge
     * @param _initialOwner Address of contract owner
     * @dev Owner can add/remove trusted emitters
     * @dev OpenZeppelin Ownable validates _initialOwner is non-zero
     */
    constructor(address _wormholeCore, address _initialOwner) 
        Ownable(_initialOwner) 
    {
        if (_wormholeCore == address(0)) revert InvalidWormholeCore();
        // Note: OpenZeppelin Ownable already validates _initialOwner != address(0)
        
        wormholeCore = IWormholeCore(_wormholeCore);
    }
    
    // ============ HELPER FUNCTIONS ============
    
    /**
     * @notice Get CID hash for efficient lookups
     * @param cid The IPFS CID string
     * @return Hash of the CID (keccak256)
     * @dev Use this for cidHashToVaaHash mapping lookups
     */
    function getCidHash(string memory cid) public pure returns (bytes32) {
        return keccak256(bytes(cid));
    }
    
    /**
     * @notice Get unique key for CID + chain combination
     * @param cidHash The hashed CID
     * @param sourceChainId The Wormhole chain ID
     * @return Unique key for mapping lookup
     * @dev Same CID can exist on different chains with different keys
     */
    function getUniqueKey(bytes32 cidHash, uint16 sourceChainId) 
        public 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encodePacked(cidHash, sourceChainId));
    }
    
    /**
     * @notice Check if checkpoint exists
     * @param vaaHash The VAA hash
     * @return True if checkpoint exists
     * @dev Checks if creator is non-zero (all valid checkpoints have a creator)
     */
    function checkpointExists(bytes32 vaaHash) public view returns (bool) {
        return checkpoints[vaaHash].creator != address(0);
    }
    
    /**
     * @notice Check if checkpoint is expired
     * @param vaaHash The VAA hash
     * @return True if expired or doesn't exist
     * @dev Non-existent checkpoints are considered expired
     */
    function isExpired(bytes32 vaaHash) public view returns (bool) {
        if (!checkpointExists(vaaHash)) return true;
        return block.timestamp > checkpoints[vaaHash].expiresAt;
    }
    
    /**
     * @notice Check if emitter is trusted
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address (bytes32)
     * @return True if emitter is trusted on this chain
     */
    function isTrustedEmitter(uint16 chainId, bytes32 emitter) 
        public 
        view 
        returns (bool) 
    {
        return trustedEmitters[chainId][emitter];
    }
    
    // ============ CORE FUNCTIONS ============
    
    /**
     * @notice Process a Wormhole VAA and store checkpoint
     * @param encodedVaa The encoded VAA bytes from Wormhole
     * @dev This is the main entry point for receiving cross-chain messages
     * 
     * SECURITY:
     * - Verifies VAA signatures using Wormhole Core
     * - Prevents replay attacks
     * - Validates emitter against whitelist
     * - Uses nonReentrant modifier
     * 
     * FLOW:
     * 1. Parse and verify VAA using wormholeCore.parseAndVerifyVM()
     * 2. Check replay protection (consumedVAAs)
     * 3. Validate emitter (trustedEmitters)
     * 4. Extract payload and process internally
     * 5. Mark VAA as consumed
     * 
     * @custom:reverts InvalidVAA if VAA verification fails
     * @custom:reverts VAAConsumed if VAA already processed
     * @custom:reverts UntrustedEmitter if emitter not whitelisted
     */
    function receiveCheckpoint(bytes calldata encodedVaa) 
        external 
        override 
        nonReentrant 
    {
        // Step 1: Parse and verify VAA
        (IWormholeCore.VM memory vm, bool valid, ) = 
            wormholeCore.parseAndVerifyVM(encodedVaa);
        
        if (!valid) {
            revert InvalidVAA();
        }
        
        // Step 2: Compute VAA hash for replay protection
        bytes32 vaaHash = vm.hash;
        
        // Step 3: Check replay protection
        if (consumedVAAs[vaaHash]) {
            revert VAAConsumed(vaaHash);
        }
        
        // Step 4: Validate emitter
        if (!trustedEmitters[vm.emitterChainId][vm.emitterAddress]) {
            revert UntrustedEmitter(vm.emitterChainId, vm.emitterAddress);
        }
        
        // Step 5: Process message internally (pass real VAA hash)
        _processCheckpoint(
            vm.payload,
            vm.emitterChainId,
            vm.emitterAddress,
            vaaHash  // ✅ CRITICAL: Pass the real Wormhole VAA hash
        );
        
        // Step 6: Mark VAA as consumed (after successful processing)
        // NOTE: If processing reverts, VAA remains unconsumed for retry
        consumedVAAs[vaaHash] = true;
    }
    
    /**
     * @notice Internal checkpoint processing function
     * @param payload The encoded checkpoint message (CheckpointCodec format)
     * @param sourceChain The Wormhole chain ID
     * @param sourceAddress The emitter address (bytes32)
     * @param vaaHash The real Wormhole VAA hash
     * @dev This function decodes, validates, and stores the checkpoint
     * 
     * CRITICAL: vaaHash MUST be the real Wormhole VM hash (vm.hash)
     * NOT a computed hash from message content!
     * 
     * FLOW:
     * 1. Decode payload using CheckpointCodec
     * 2. Validate message (CheckpointCodec.validateWithErrors)
     * 3. Check CID uniqueness (per-chain)
     * 4. Store checkpoint using REAL vaaHash
     * 5. Update indices
     * 6. Emit event
     * 
     * @custom:reverts InvalidMessage if decoding fails
     * @custom:reverts CheckpointExpired if message expired
     * @custom:reverts CheckpointTooOld if message too old
     * @custom:reverts CIDAlreadyExists if CID already stored on this chain
     */
    function _processCheckpoint(
        bytes memory payload,
        uint16 sourceChain,
        bytes32 sourceAddress,
        bytes32 vaaHash
    ) internal {
        // Step 1: Decode message using CheckpointCodec
        // abi.decode will revert with clear error if payload is malformed
        CheckpointCodec.StorachaCheckpointMessage memory message = 
            CheckpointCodec.decode(payload);
        
        // Step 2: Validate message
        // CheckpointCodec.validateWithErrors will revert with specific errors if invalid
        CheckpointCodec.validateWithErrors(message);
        
        // Step 3: Check CID uniqueness PER CHAIN
        // Same CID can be checkpointed on different chains
        bytes32 cidHash = getCidHash(message.cid);
        bytes32 uniqueKey = keccak256(abi.encodePacked(cidHash, sourceChain));
        
        if (cidHashToVaaHash[uniqueKey] != bytes32(0)) {
            revert CIDAlreadyExists(cidHash);
        }
        
        // Step 4: Store checkpoint using REAL Wormhole VAA hash
        checkpoints[vaaHash] = StoredCheckpoint({
            cid: message.cid,
            tag: message.tag,
            expiresAt: message.expiresAt,
            creator: message.creator,
            timestamp: message.timestamp,
            sourceChainId: sourceChain,
            emitterAddress: sourceAddress,
            receivedAt: block.timestamp
        });
        
        // Step 5: Update indices (CID + chain -> VAA hash)
        cidHashToVaaHash[uniqueKey] = vaaHash;
        
        // Step 6: Update counters
        checkpointCountByChain[sourceChain]++;
        totalCheckpoints++;
        
        // Step 7: Emit event
        emit CheckpointReceived(
            vaaHash,
            cidHash,
            message.tag,
            sourceChain,
            message.creator,
            message.cid,
            message.expiresAt,
            block.timestamp
        );
    }
    
    /**
     * @notice IWormholeReceiver interface implementation (STUB)
     * @dev This function is NOT used. Use receiveCheckpoint() instead.
     * Kept for interface compliance only.
     */
    function receiveWormholeMessage(
        bytes memory,
        uint16,
        bytes32
    ) external override pure {
        revert("Use receiveCheckpoint() instead");
    }
    
    // ============ ACCESS CONTROL FUNCTIONS ============
    
    /**
     * @notice Add a trusted emitter to the whitelist
     * @param chainId Wormhole chain ID (e.g., 10004 for Base Sepolia)
     * @param emitter Emitter address in bytes32 format (publisher contract)
     * @dev Only owner can call this function
     * @dev Emitter address should be the bytes32 representation of the publisher contract
     * 
     * USAGE:
     * - Deploy StorachaCheckpointer on source chain (e.g., Base Sepolia)
     * - Convert address to bytes32: bytes32(uint256(uint160(address)))
     * - Call addTrustedEmitter(10004, emitterBytes32)
     * 
     * VALIDATION:
     * - Chain ID must be non-zero
     * - Emitter must be non-zero
     * - Emitter must not already be trusted
     * 
     * @custom:reverts EmitterAlreadyTrusted if emitter already whitelisted
     */
    function addTrustedEmitter(uint16 chainId, bytes32 emitter) 
        external 
        onlyOwner 
    {
        // Validate chain ID
        if (chainId == 0) {
            revert InvalidMessage("Chain ID cannot be zero");
        }
        
        // Validate emitter address
        if (emitter == bytes32(0)) {
            revert ZeroAddress();
        }
        
        // Check if already trusted
        if (trustedEmitters[chainId][emitter]) {
            revert EmitterAlreadyTrusted(chainId, emitter);
        }
        
        // Add to whitelist
        trustedEmitters[chainId][emitter] = true;
        
        // Emit event
        emit TrustedEmitterAdded(chainId, emitter);
    }
    
    /**
     * @notice Remove a trusted emitter from the whitelist
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address in bytes32 format
     * @dev Only owner can call this function
     * 
     * USAGE:
     * - Call removeTrustedEmitter(chainId, emitterBytes32) to revoke trust
     * - After removal, messages from this emitter will be rejected
     * 
     * VALIDATION:
     * - Chain ID must be non-zero
     * - Emitter must be non-zero
     * - Emitter must be currently trusted
     * 
     * @custom:reverts EmitterNotTrusted if emitter not in whitelist
     */
    function removeTrustedEmitter(uint16 chainId, bytes32 emitter) 
        external 
        onlyOwner 
    {
        // Validate chain ID
        if (chainId == 0) {
            revert InvalidMessage("Chain ID cannot be zero");
        }
        
        // Validate emitter address
        if (emitter == bytes32(0)) {
            revert ZeroAddress();
        }
        
        // Check if currently trusted
        if (!trustedEmitters[chainId][emitter]) {
            revert EmitterNotTrusted(chainId, emitter);
        }
        
        // Remove from whitelist
        trustedEmitters[chainId][emitter] = false;
        
        // Emit event
        emit TrustedEmitterRemoved(chainId, emitter);
    }
    
    /**
     * @notice Batch add multiple trusted emitters
     * @param chainIds Array of Wormhole chain IDs
     * @param emitters Array of emitter addresses (bytes32 format)
     * @dev Only owner can call this function
     * @dev Arrays must have the same length
     * @dev Useful for initial setup or migrating to new publishers
     * 
     * EXAMPLE:
     * chainIds = [10004, 6, 10002]  // Base, Avalanche, Ethereum
     * emitters = [publisher1, publisher2, publisher3]
     */
    function addTrustedEmitterBatch(
        uint16[] calldata chainIds,
        bytes32[] calldata emitters
    ) external onlyOwner {
        // Validate array lengths match
        if (chainIds.length != emitters.length) {
            revert InvalidMessage("Array length mismatch");
        }
        
        // Add each emitter
        for (uint256 i = 0; i < chainIds.length; i++) {
            // Reuse single-add logic (includes all validation)
            // Note: We don't use 'this.addTrustedEmitter' to save gas
            uint16 chainId = chainIds[i];
            bytes32 emitter = emitters[i];
            
            // Validate
            if (chainId == 0) {
                revert InvalidMessage("Chain ID cannot be zero");
            }
            if (emitter == bytes32(0)) {
                revert ZeroAddress();
            }
            if (trustedEmitters[chainId][emitter]) {
                revert EmitterAlreadyTrusted(chainId, emitter);
            }
            
            // Add
            trustedEmitters[chainId][emitter] = true;
            
            // Emit
            emit TrustedEmitterAdded(chainId, emitter);
        }
    }
    
    // ============ QUERY FUNCTIONS ============
    
    /**
     * @notice Get checkpoint by VAA hash
     * @param vaaHash The VAA hash (from Wormhole VM)
     * @return checkpoint The stored checkpoint with all metadata
     * @dev This is the primary way to query checkpoints
     * 
     * USAGE:
     * - After receiving a VAA, the vaaHash is emitted in CheckpointReceived event
     * - Use this hash to query the full checkpoint data
     * 
     * RETURNS:
     * - StoredCheckpoint struct with all fields
     * - If checkpoint doesn't exist, all fields will be default values
     * - Use checkpointExists(vaaHash) to verify existence first
     * 
     * @custom:reverts CheckpointNotFound if checkpoint doesn't exist
     */
    function getCheckpoint(bytes32 vaaHash) 
        external 
        view 
        returns (StoredCheckpoint memory checkpoint) 
    {
        // Check if checkpoint exists
        if (!checkpointExists(vaaHash)) {
            revert CheckpointNotFound(vaaHash);
        }
        
        // Return checkpoint from storage
        return checkpoints[vaaHash];
    }
    
    /**
     * @notice Get checkpoint by CID and source chain
     * @param cid The IPFS CID string
     * @param sourceChainId The Wormhole chain ID where checkpoint was created
     * @return checkpoint The stored checkpoint with all metadata
     * @dev Uses cidHashToVaaHash mapping for efficient lookup
     * 
     * USAGE:
     * - Query checkpoint using the IPFS CID and source chain
     * - Same CID can exist on multiple chains (one per chain)
     * 
     * FLOW:
     * 1. Hash the CID string to bytes32
     * 2. Compute unique key from CID hash + chain ID
     * 3. Look up VAA hash in cidHashToVaaHash mapping
     * 4. Return checkpoint using VAA hash
     * 
     * @custom:reverts CheckpointNotFound if CID not found on specified chain
     */
    function getCheckpointByCid(string calldata cid, uint16 sourceChainId) 
        external 
        view 
        returns (StoredCheckpoint memory checkpoint) 
    {
        // Hash the CID
        bytes32 cidHash = getCidHash(cid);
        
        // Compute unique key (CID + chain)
        bytes32 uniqueKey = keccak256(abi.encodePacked(cidHash, sourceChainId));
        
        // Look up VAA hash
        bytes32 vaaHash = cidHashToVaaHash[uniqueKey];
        
        // Check if exists
        if (vaaHash == bytes32(0)) {
            revert CheckpointNotFound(bytes32(0));
        }
        
        // Return checkpoint
        return checkpoints[vaaHash];
    }
    
    /**
     * @notice Check if checkpoint is valid (exists and not expired)
     * @param vaaHash The VAA hash
     * @return valid True if checkpoint exists and is not expired
     * @dev This is a convenience function combining existence and expiration checks
     * 
     * USAGE:
     * - Before using checkpoint data, verify it's still valid
     * - Returns false if checkpoint doesn't exist
     * - Returns false if checkpoint has expired
     * 
     * LOGIC:
     * valid = checkpointExists(vaaHash) && !isExpired(vaaHash)
     */
    function isCheckpointValid(bytes32 vaaHash) 
        external 
        view 
        returns (bool valid) 
    {
        // Check existence and expiration
        return checkpointExists(vaaHash) && !isExpired(vaaHash);
    }
    
    /**
     * @notice Get the VAA hash for a given CID and source chain
     * @param cid The IPFS CID string
     * @param sourceChainId The Wormhole chain ID where checkpoint was created
     * @return vaaHash The VAA hash, or bytes32(0) if not found
     * @dev Useful for checking if a CID exists on a chain without reverting
     * 
     * USAGE:
     * - Check if CID has been checkpointed on a specific chain
     * - Get VAA hash to use with other query functions
     * - Returns bytes32(0) if CID not found (does not revert)
     */
    function getVaaHashByCid(string calldata cid, uint16 sourceChainId) 
        external 
        view 
        returns (bytes32 vaaHash) 
    {
        bytes32 cidHash = getCidHash(cid);
        bytes32 uniqueKey = getUniqueKey(cidHash, sourceChainId);
        return cidHashToVaaHash[uniqueKey];
    }
    
    /**
     * @notice Get checkpoint creation timestamp (on source chain)
     * @param vaaHash The VAA hash
     * @return timestamp The creation timestamp
     * @dev Returns the timestamp when checkpoint was created on source chain
     * @custom:reverts CheckpointNotFound if checkpoint doesn't exist
     */
    function getCheckpointTimestamp(bytes32 vaaHash) 
        external 
        view 
        returns (uint256 timestamp) 
    {
        if (!checkpointExists(vaaHash)) {
            revert CheckpointNotFound(vaaHash);
        }
        return checkpoints[vaaHash].timestamp;
    }
    
    /**
     * @notice Get checkpoint expiration timestamp
     * @param vaaHash The VAA hash
     * @return expiresAt The expiration timestamp
     * @dev Returns the timestamp when checkpoint expires
     * @custom:reverts CheckpointNotFound if checkpoint doesn't exist
     */
    function getCheckpointExpiration(bytes32 vaaHash) 
        external 
        view 
        returns (uint256 expiresAt) 
    {
        if (!checkpointExists(vaaHash)) {
            revert CheckpointNotFound(vaaHash);
        }
        return checkpoints[vaaHash].expiresAt;
    }
    
    /**
     * @notice Get time remaining until expiration
     * @param vaaHash The VAA hash
     * @return remaining Seconds until expiration (0 if expired)
     * @dev Returns 0 if checkpoint doesn't exist or has expired
     */
    function getTimeRemaining(bytes32 vaaHash) 
        external 
        view 
        returns (uint256 remaining) 
    {
        if (!checkpointExists(vaaHash)) {
            return 0;
        }
        
        uint256 expiresAt = checkpoints[vaaHash].expiresAt;
        
        if (block.timestamp >= expiresAt) {
            return 0;
        }
        
        return expiresAt - block.timestamp;
    }
    
    /**
     * @notice Get checkpoint creator address
     * @param vaaHash The VAA hash
     * @return creator The creator address from source chain
     * @custom:reverts CheckpointNotFound if checkpoint doesn't exist
     */
    function getCheckpointCreator(bytes32 vaaHash) 
        external 
        view 
        returns (address creator) 
    {
        if (!checkpointExists(vaaHash)) {
            revert CheckpointNotFound(vaaHash);
        }
        return checkpoints[vaaHash].creator;
    }
}
