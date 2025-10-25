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
    
    /// @notice CID hash to VAA hash lookup (for CID queries)
    /// @dev Using keccak256(bytes(cid)) as key for gas efficiency
    /// One CID = One checkpoint (uniqueness enforced)
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
    
    /// @notice Invalid owner address (zero address)
    error InvalidOwner();
    
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
     * @dev Both addresses must be non-zero
     */
    constructor(address _wormholeCore, address _initialOwner) 
        Ownable(_initialOwner) 
    {
        if (_wormholeCore == address(0)) revert InvalidWormholeCore();
        if (_initialOwner == address(0)) revert InvalidOwner();
        
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
     * 4. Extract payload and call receiveWormholeMessage()
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
        
        // Step 5: Process message (will store checkpoint)
        this.receiveWormholeMessage(
            vm.payload,
            vm.emitterChainId,
            vm.emitterAddress
        );
        
        // Step 6: Mark VAA as consumed (after successful processing)
        consumedVAAs[vaaHash] = true;
    }
    
    /**
     * @notice Internal message reception handler
     * @param payload The encoded checkpoint message (CheckpointCodec format)
     * @param sourceChain The Wormhole chain ID
     * @param sourceAddress The emitter address (bytes32)
     * @dev This function decodes, validates, and stores the checkpoint
     * 
     * NOTE: This function is part of IWormholeReceiver interface.
     * It's called by receiveCheckpoint() after VAA verification.
     * Marked 'external' for interface compliance but should only be called
     * by this contract via 'this.receiveWormholeMessage()'.
     * 
     * FLOW:
     * 1. Decode payload using CheckpointCodec
     * 2. Validate message (CheckpointCodec.validateWithErrors)
     * 3. Check CID uniqueness
     * 4. Compute VAA hash
     * 5. Store checkpoint
     * 6. Update indices
     * 7. Emit event
     * 
     * @custom:reverts InvalidMessage if decoding fails
     * @custom:reverts CheckpointExpired if message expired
     * @custom:reverts CheckpointTooOld if message too old
     * @custom:reverts CIDAlreadyExists if CID already stored
     */
    function receiveWormholeMessage(
        bytes memory payload,
        uint16 sourceChain,
        bytes32 sourceAddress
    ) external override {
        // Security: Only allow calls from this contract
        // (called via this.receiveWormholeMessage in receiveCheckpoint)
        require(msg.sender == address(this), "Internal only");
        
        // Step 1: Decode message using CheckpointCodec
        CheckpointCodec.StorachaCheckpointMessage memory message;
        
        try this._decodeMessage(payload) returns (
            CheckpointCodec.StorachaCheckpointMessage memory decoded
        ) {
            message = decoded;
        } catch {
            revert InvalidMessage("Decode failed");
        }
        
        // Step 2: Validate message
        // CheckpointCodec.validateWithErrors will revert with specific errors if invalid
        CheckpointCodec.validateWithErrors(message);
        
        // Step 3: Check CID uniqueness
        bytes32 cidHash = getCidHash(message.cid);
        if (cidHashToVaaHash[cidHash] != bytes32(0)) {
            revert CIDAlreadyExists(cidHash);
        }
        
        // Step 4: Compute VAA hash from message components
        // We reconstruct this from the message hash since we don't have
        // access to the original encodedVaa in this function
        bytes32 vaaHash = CheckpointCodec.getMessageHash(message);
        
        // Step 5: Store checkpoint
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
        
        // Step 6: Update indices
        cidHashToVaaHash[cidHash] = vaaHash;
        
        // Step 7: Update counters
        checkpointCountByChain[sourceChain]++;
        totalCheckpoints++;
        
        // Step 8: Emit event
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
     * @notice Helper function to decode message (for try-catch)
     * @param payload The encoded message
     * @return Decoded message
     * @dev External function needed for try-catch pattern
     */
    function _decodeMessage(bytes memory payload) 
        external 
        pure 
        returns (CheckpointCodec.StorachaCheckpointMessage memory) 
    {
        return CheckpointCodec.decode(payload);
    }
    
    // ============ ACCESS CONTROL FUNCTIONS (TO BE IMPLEMENTED) ============
    
    /**
     * @notice Add a trusted emitter
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address (bytes32 format)
     * @dev Implementation in Sub-task 5.3
     * @dev Only owner can call
     */
    function addTrustedEmitter(uint16 chainId, bytes32 emitter) 
        external 
        onlyOwner 
    {
        // Sub-task 5.3: Access Control & Trusted Emitters
        revert("Not implemented - Sub-task 5.3");
    }
    
    /**
     * @notice Remove a trusted emitter
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address (bytes32 format)
     * @dev Implementation in Sub-task 5.3
     * @dev Only owner can call
     */
    function removeTrustedEmitter(uint16 chainId, bytes32 emitter) 
        external 
        onlyOwner 
    {
        // Sub-task 5.3: Access Control & Trusted Emitters
        revert("Not implemented - Sub-task 5.3");
    }
    
    // ============ QUERY FUNCTIONS (TO BE IMPLEMENTED) ============
    
    /**
     * @notice Get checkpoint by VAA hash
     * @param vaaHash The VAA hash
     * @return checkpoint The stored checkpoint
     * @dev Implementation in Sub-task 5.4
     * @dev Reverts if checkpoint doesn't exist
     */
    function getCheckpoint(bytes32 vaaHash) 
        external 
        view 
        returns (StoredCheckpoint memory checkpoint) 
    {
        // Sub-task 5.4: Query Functions & Utilities
        revert("Not implemented - Sub-task 5.4");
    }
    
    /**
     * @notice Get checkpoint by CID
     * @param cid The IPFS CID
     * @return checkpoint The stored checkpoint
     * @dev Implementation in Sub-task 5.4
     * @dev Uses cidHashToVaaHash mapping for lookup
     * @dev Reverts if checkpoint doesn't exist
     */
    function getCheckpointByCid(string calldata cid) 
        external 
        view 
        returns (StoredCheckpoint memory checkpoint) 
    {
        // Sub-task 5.4: Query Functions & Utilities
        revert("Not implemented - Sub-task 5.4");
    }
    
    /**
     * @notice Check if checkpoint is valid (exists and not expired)
     * @param vaaHash The VAA hash
     * @return valid True if checkpoint exists and not expired
     * @dev Implementation in Sub-task 5.4
     */
    function isCheckpointValid(bytes32 vaaHash) 
        external 
        view 
        returns (bool valid) 
    {
        // Sub-task 5.4: Query Functions & Utilities
        revert("Not implemented - Sub-task 5.4");
    }
}
