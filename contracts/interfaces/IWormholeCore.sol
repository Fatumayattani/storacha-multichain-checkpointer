// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IWormholeCore
 * @notice Interface for Wormhole Core Bridge contract
 * @dev Based on actual Wormhole Core Bridge implementation
 * @dev Source: https://github.com/wormhole-foundation/wormhole/blob/main/ethereum/contracts/Interfaces.sol
 */
interface IWormholeCore {
    
    // ============ STRUCTS ============
    
    /**
     * @notice Guardian signature structure
     */
    struct Signature {
        bytes32 r;
        bytes32 s;
        uint8 v;
        uint8 guardianIndex;
    }
    
    /**
     * @notice Verified Message (VM) structure
     * @dev Contains the parsed and verified VAA data
     */
    struct VM {
        uint8 version;
        uint32 timestamp;
        uint32 nonce;
        uint16 emitterChainId;
        bytes32 emitterAddress;
        uint64 sequence;
        uint8 consistencyLevel;
        bytes payload;
        uint32 guardianSetIndex;
        Signature[] signatures;
        bytes32 hash;
    }
    
    // ============ FUNCTIONS ============
    
    /**
     * @notice Parse and verify a Wormhole VAA
     * @param encodedVM The encoded VAA bytes
     * @return vm The parsed VM structure
     * @return valid Whether the VAA is valid
     * @return reason Reason for invalidity (if applicable)
     * @dev This is the primary function for VAA verification
     */
    function parseAndVerifyVM(bytes calldata encodedVM)
        external
        view
        returns (
            VM memory vm,
            bool valid,
            string memory reason
        );
    
    /**
     * @notice Get the chain ID of this chain
     * @return chainId The Wormhole chain ID
     */
    function chainId() external view returns (uint16);
    
    /**
     * @notice Get the address of the governance contract
     * @return governanceContract The governance contract address
     */
    function governanceContract() external view returns (bytes32);
    
    /**
     * @notice Get the current guardian set index
     * @return index The current guardian set index
     */
    function getCurrentGuardianSetIndex() external view returns (uint32);
    
    /**
     * @notice Get the message fee
     * @return fee The fee in wei for publishing a message
     */
    function messageFee() external view returns (uint256);
    
    /**
     * @notice Publish a message
     * @param nonce The nonce for message ordering
     * @param payload The message payload
     * @param consistencyLevel The desired consistency level
     * @return sequence The sequence number of the published message
     * @dev Requires payment of messageFee()
     */
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence);
}
