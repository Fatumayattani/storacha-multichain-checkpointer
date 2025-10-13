// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IWormholeCore.sol";

/**
 * @title MockWormholeCore
 * @notice Mock implementation of Wormhole Core for testing
 * @dev Simulates Wormhole Core Bridge functionality
 */
contract MockWormholeCore is IWormholeCore {
    
    uint64 private _nextSequence = 1;
    uint16 private _chainId = 2;  // Wormhole testnet chain ID
    uint256 private _messageFee = 0.001 ether;
    uint32 private _guardianSetIndex = 0;
    
    mapping(bytes32 => bool) private _consumedVAAs;
    
    event MessagePublished(
        address indexed sender,
        uint64 sequence,
        uint32 nonce,
        bytes payload,
        uint8 consistencyLevel
    );
    
    // ============ WORMHOLE CORE FUNCTIONS ============
    
    function parseAndVerifyVM(bytes calldata encodedVM)
        external
        view
        override
        returns (
            VM memory vm,
            bool valid,
            string memory reason
        )
    {
        // Decode the mock VAA
        try this.decodeMockVAA(encodedVM) returns (VM memory decodedVm) {
            vm = decodedVm;
            valid = true;
            reason = "";
        } catch {
            vm = VM({
                version: 0,
                timestamp: 0,
                nonce: 0,
                emitterChainId: 0,
                emitterAddress: bytes32(0),
                sequence: 0,
                consistencyLevel: 0,
                payload: new bytes(0),
                guardianSetIndex: 0,
                signatures: new Signature[](0),
                hash: bytes32(0)
            });
            valid = false;
            reason = "Invalid VAA format";
        }
    }
    
    function chainId() external view override returns (uint16) {
        return _chainId;
    }
    
    function governanceContract() external pure override returns (bytes32) {
        return bytes32(0);
    }
    
    function getCurrentGuardianSetIndex() external view override returns (uint32) {
        return _guardianSetIndex;
    }
    
    function messageFee() external view override returns (uint256) {
        return _messageFee;
    }
    
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    )
        external
        payable
        override
        returns (uint64 sequence)
    {
        require(msg.value >= _messageFee, "Insufficient fee");
        
        sequence = _nextSequence++;
        
        emit MessagePublished(
            msg.sender,
            sequence,
            nonce,
            payload,
            consistencyLevel
        );
        
        return sequence;
    }
    
    // ============ MOCK HELPERS ============
    
    /**
     * @notice Create a mock VAA for testing
     */
    function createMockVAA(
        uint16 emitterChainId,
        bytes32 emitterAddress,
        uint64 sequence,
        bytes memory payload
    )
        external
        view
        returns (bytes memory)
    {
        VM memory vm = VM({
            version: 1,
            timestamp: uint32(block.timestamp),
            nonce: 0,
            emitterChainId: emitterChainId,
            emitterAddress: emitterAddress,
            sequence: sequence,
            consistencyLevel: 15,
            payload: payload,
            guardianSetIndex: _guardianSetIndex,
            signatures: new Signature[](0),  // Mock: no signatures
            hash: keccak256(payload)
        });
        
        return abi.encode(vm);
    }
    
    /**
     * @notice Decode a mock VAA
     */
    function decodeMockVAA(bytes calldata encodedVM)
        external
        pure
        returns (VM memory vm)
    {
        return abi.decode(encodedVM, (VM));
    }
    
    /**
     * @notice Set the message fee (for testing)
     */
    function setMessageFee(uint256 newFee) external {
        _messageFee = newFee;
    }
    
    /**
     * @notice Set the chain ID (for testing)
     */
    function setChainId(uint16 newChainId) external {
        _chainId = newChainId;
    }
}
