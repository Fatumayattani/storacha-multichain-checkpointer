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
    
    // ============ CORE FUNCTIONS (TO BE IMPLEMENTED) ============
    
    /**
     * @notice Process a Wormhole VAA and store checkpoint
     * @param encodedVaa The encoded VAA bytes from Wormhole
     * @dev Implementation in Sub-task 5.2
     * 
     * FLOW:
     * 1. Parse and verify VAA using wormholeCore.parseAndVerifyVM()
     * 2. Check replay protection (consumedVAAs)
     * 3. Validate emitter (trustedEmitters)
     * 4. Decode payload using CheckpointCodec
     * 5. Validate message (expiration, age, format)
     * 6. Store checkpoint
     * 7. Emit CheckpointReceived event
     */
    function receiveCheckpoint(bytes calldata encodedVaa) 
        external 
        override 
        nonReentrant 
    {
        // Sub-task 5.2: VAA Processing & Message Reception
        revert("Not implemented - Sub-task 5.2");
    }
    
    /**
     * @notice Internal message reception handler
     * @param payload The encoded checkpoint message (CheckpointCodec format)
     * @param sourceChain The Wormhole chain ID
     * @param sourceAddress The emitter address (bytes32)
     * @dev Implementation in Sub-task 5.2
     * 
     * NOTE: This function is called internally by receiveCheckpoint()
     * It's part of IWormholeReceiver interface but not meant for external calls
     */
    function receiveWormholeMessage(
        bytes memory payload,
        uint16 sourceChain,
        bytes32 sourceAddress
    ) external override {
        // Sub-task 5.2: Message Processing
        revert("Not implemented - Sub-task 5.2");
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
