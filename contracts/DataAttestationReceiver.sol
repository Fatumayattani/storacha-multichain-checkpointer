// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IWormholeCore.sol";
import "./libraries/DataAttestationCodec.sol";
import "./DataAttestationRegistry.sol";

/**
 * @title DataAttestationReceiver
 * @notice Receives and validates cross-chain data attestations via Wormhole.
 * @dev Reuses patterns from WormholeReceiver for secure message reception.
 *      This contract acts as the designated receiver for the DataAttestationRegistry.
 * 
 * SECURITY FEATURES:
 * - VAA verification using Wormhole Core
 * - Replay attack prevention (consumed VAAs tracking)
 * - Trusted emitter whitelist per chain
 * - ReentrancyGuard for external calls
 */
contract DataAttestationReceiver is Ownable, ReentrancyGuard {
    using DataAttestationCodec for DataAttestationCodec.DataAttestation;

    // ============ STATE VARIABLES ============

    /// @notice Wormhole Core Bridge contract
    IWormholeCore public immutable wormholeCore;

    /// @notice DataAttestationRegistry contract where verified data is stored
    DataAttestationRegistry public immutable registry;

    /// @notice Replay protection: vaaHash => consumed
    mapping(bytes32 => bool) public consumedVAAs;

    /// @notice Trusted emitters per source chain
    /// Emitter address is bytes32 (Wormhole format: address left-padded to 32 bytes)
    mapping(uint16 => mapping(bytes32 => bool)) public trustedEmitters;

    // ============ ERRORS ============

    /// @notice Invalid Wormhole Core address
    error InvalidWormholeCore();

    /// @notice Invalid Registry address
    error InvalidRegistry();

    /// @notice VAA verification failed
    error InvalidVAA();

    /// @notice VAA already consumed (replay attack)
    /// @param vaaHash The consumed VAA hash
    error VAAConsumed(bytes32 vaaHash);

    /// @notice Message from untrusted emitter
    /// @param chainId Source chain ID
    /// @param emitter Emitter address
    error UntrustedEmitter(uint16 chainId, bytes32 emitter);

    /// @notice Invalid message format or content
    /// @param reason Detailed reason
    error InvalidMessage(string reason);

    /// @notice Emitter already trusted
    error EmitterAlreadyTrusted(uint16 chainId, bytes32 emitter);

    /// @notice Emitter not trusted
    error EmitterNotTrusted(uint16 chainId, bytes32 emitter);

    /// @notice Zero address provided
    error ZeroAddress();

    // ============ EVENTS ============

    /**
     * @notice Emitted when an attestation is successfully received and recorded
     * @param vaaHash Unique VAA hash
     * @param sourceChainId Wormhole chain ID where message originated
     * @param emitterAddress Emitter address on source chain
     * @param cid Content identifier
     * @param creator Attestation creator
     * @param timestamp Attestation timestamp
     */
    event AttestationReceived(
        bytes32 indexed vaaHash,
        uint16 indexed sourceChainId,
        bytes32 indexed emitterAddress,
        string cid,
        address creator,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a trusted emitter is added
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address (bytes32)
     */
    event TrustedEmitterAdded(uint16 indexed chainId, bytes32 indexed emitter);

    /**
     * @notice Emitted when a trusted emitter is removed
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address (bytes32)
     */
    event TrustedEmitterRemoved(uint16 indexed chainId, bytes32 indexed emitter);

    // ============ CONSTRUCTOR ============

    /**
     * @notice Initialize DataAttestationReceiver contract
     * @param _wormholeCore Address of Wormhole Core Bridge
     * @param _registry Address of DataAttestationRegistry
     * @param _initialOwner Address of contract owner
     */
    constructor(
        address _wormholeCore,
        address _registry,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_wormholeCore == address(0)) revert InvalidWormholeCore();
        if (_registry == address(0)) revert InvalidRegistry();

        wormholeCore = IWormholeCore(_wormholeCore);
        registry = DataAttestationRegistry(_registry);
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @notice Process a Wormhole VAA and forward to DataAttestationRegistry
     * @param encodedVaa The encoded VAA bytes from Wormhole
     * @dev This is the main entry point for receiving cross-chain attestations
     */
    function receiveAttestation(bytes calldata encodedVaa) external nonReentrant {
        // Step 1: Parse and verify VAA
        (IWormholeCore.VM memory vm, bool valid, ) = wormholeCore.parseAndVerifyVM(encodedVaa);
        if (!valid) revert InvalidVAA();

        // Step 2: Compute VAA hash for replay protection
        bytes32 vaaHash = vm.hash;

        // Step 3: Check replay protection
        if (consumedVAAs[vaaHash]) revert VAAConsumed(vaaHash);

        // Step 4: Validate emitter
        if (!trustedEmitters[vm.emitterChainId][vm.emitterAddress]) {
            revert UntrustedEmitter(vm.emitterChainId, vm.emitterAddress);
        }

        // Step 5: Decode payload
        // abi.decode (called inside DataAttestationCodec.decode) will revert if payload is malformed
        DataAttestationCodec.DataAttestation memory attestation = DataAttestationCodec.decode(vm.payload);

        // Step 6: Forward to registry
        // The registry should have this contract as its designated receiver
        registry.recordAttestation(
            vaaHash,
            attestation.cid,
            attestation.creator,
            attestation.timestamp,
            attestation.lineage,
            attestation.licenseHash
        );

        // Step 7: Mark VAA as consumed (after successful processing)
        consumedVAAs[vaaHash] = true;

        // Step 8: Emit event
        emit AttestationReceived(
            vaaHash,
            vm.emitterChainId,
            vm.emitterAddress,
            attestation.cid,
            attestation.creator,
            attestation.timestamp
        );
    }

    // ============ ACCESS CONTROL FUNCTIONS ============

    /**
     * @notice Add a trusted emitter to the whitelist
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address in bytes32 format
     */
    function addTrustedEmitter(uint16 chainId, bytes32 emitter) external onlyOwner {
        if (chainId == 0) revert InvalidMessage("Chain ID cannot be zero");
        if (emitter == bytes32(0)) revert ZeroAddress();
        if (trustedEmitters[chainId][emitter]) revert EmitterAlreadyTrusted(chainId, emitter);

        trustedEmitters[chainId][emitter] = true;
        emit TrustedEmitterAdded(chainId, emitter);
    }

    /**
     * @notice Remove a trusted emitter from the whitelist
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address in bytes32 format
     */
    function removeTrustedEmitter(uint16 chainId, bytes32 emitter) external onlyOwner {
        if (!trustedEmitters[chainId][emitter]) revert EmitterNotTrusted(chainId, emitter);

        trustedEmitters[chainId][emitter] = false;
        emit TrustedEmitterRemoved(chainId, emitter);
    }

    /**
     * @notice Batch add multiple trusted emitters
     * @param chainIds Array of Wormhole chain IDs
     * @param emitters Array of emitter addresses
     */
    function addTrustedEmitterBatch(
        uint16[] calldata chainIds,
        bytes32[] calldata emitters
    ) external onlyOwner {
        if (chainIds.length != emitters.length) {
            revert InvalidMessage("Array length mismatch");
        }

        for (uint256 i = 0; i < chainIds.length; i++) {
            uint16 chainId = chainIds[i];
            bytes32 emitter = emitters[i];

            if (chainId == 0) revert InvalidMessage("Chain ID cannot be zero");
            if (emitter == bytes32(0)) revert ZeroAddress();
            if (trustedEmitters[chainId][emitter]) revert EmitterAlreadyTrusted(chainId, emitter);

            trustedEmitters[chainId][emitter] = true;
            emit TrustedEmitterAdded(chainId, emitter);
        }
    }

    // ============ QUERY FUNCTIONS ============

    /**
     * @notice Check if a VAA hash has been consumed
     * @param vaaHash The VAA hash to check
     */
    function isVAAConsumed(bytes32 vaaHash) external view returns (bool) {
        return consumedVAAs[vaaHash];
    }

    /**
     * @notice Check if an emitter is trusted on a specific chain
     * @param chainId Wormhole chain ID
     * @param emitter Emitter address in bytes32
     */
    function isTrustedEmitter(uint16 chainId, bytes32 emitter) external view returns (bool) {
        return trustedEmitters[chainId][emitter];
    }
}
