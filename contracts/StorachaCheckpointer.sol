// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAvailabilityVerifier.sol";
import "./WormholeReceiver.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Minimal ReentrancyGuard
contract ReentrancyGuard {
    uint256 private locked = 1;
    modifier nonReentrant() {
        require(locked == 1, "reentrancy");
        locked = 2;
        _;
        locked = 1;
    }
}

/// @notice Wormhole-like interface
interface IWormhole {
    function publishMessage(
        uint32 nonce,
        bytes calldata payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence);
}

/// @title Storacha Checkpointer
/// @notice Allows pinning data availability proofs onchain and broadcasting via Wormhole
contract StorachaCheckpointer is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    struct Checkpoint {
        address user;
        string cid;            // human-readable CID string
        bytes32 tag;
        uint256 expiresAt;
        uint256 timestamp;     // created at
        bool verified;
    }

    uint256 public nextCheckpointId = 1;
    mapping(uint256 => Checkpoint) public checkpoints;

    // index by hash of CID for efficient lookups
    mapping(bytes32 => uint256[]) public byCid;

    IAvailabilityVerifier public verifier;
    IWormhole public wormhole;
    uint256 public pricePerSecondWei = 1e15; // 0.001 ETH per second
    address public feeRecipient;

    /// @dev emits both cidHash (indexed) for filtering and cid (string) for readability
    event CheckpointCreated(
        uint256 indexed id,
        address indexed user,
        bytes32 indexed cidHash,
        bytes32 tag,
        string cid,
        uint256 expiresAt,
        uint256 timestamp
    );

    event CheckpointExtended(uint256 indexed id, uint256 newExpiry);
    event FeesWithdrawn(address to, uint256 amount);

    constructor(address admin) {
        _grantRole(ADMIN_ROLE, admin);
        feeRecipient = admin;
    }

    function setVerifier(address v) external onlyRole(ADMIN_ROLE) {
        verifier = IAvailabilityVerifier(v);
    }

    function setWormhole(address w) external onlyRole(ADMIN_ROLE) {
        wormhole = IWormhole(w);
    }

    function setFeeRecipient(address r) external onlyRole(ADMIN_ROLE) {
        feeRecipient = r;
    }

    function setPricePerSecondWei(uint256 p) external onlyRole(ADMIN_ROLE) {
        pricePerSecondWei = p;
    }

    /// @notice Create a checkpoint and optionally publish a Wormhole message
    /// @param cid Human-readable IPFS CID string
    /// @param duration Seconds to keep the checkpoint alive
    /// @param verifierData Opaque data for the availability verifier
    /// @param tag User-defined label
    /// @param publishToWormhole If true, publish Wormhole payload
    function createCheckpoint(
        string calldata cid,
        uint256 duration,
        bytes calldata verifierData,
        bytes32 tag,
        bool publishToWormhole
    ) external payable nonReentrant {
        require(address(verifier) != address(0), "verifier not set");
        require(duration > 0, "duration=0");

        uint256 cost = pricePerSecondWei * duration;
        require(msg.value >= cost, "underpay");

        // use hash of CID string to interface with existing verifier
        bytes32 cidHash = keccak256(bytes(cid));
        bool ok = verifier.isAvailable(cidHash, verifierData);
        require(ok, "not available");

        uint256 expiresAt = block.timestamp + duration;
        uint256 id = nextCheckpointId++;

        checkpoints[id] = Checkpoint({
            user: msg.sender,
            cid: cid,
            tag: tag,
            expiresAt: expiresAt,
            timestamp: block.timestamp,
            verified: ok
        });

        byCid[cidHash].push(id);

        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }

        // MVP Wormhole payload
        // struct StorachaCheckpointMessage {
        //   uint8 version;
        //   string cid;
        //   bytes32 tag;
        //   uint256 expiresAt;
        //   address creator;
        //   uint256 timestamp;
        //   uint16 sourceChainId;
        // }
        if (publishToWormhole) {
            bytes memory payload = abi.encode(
                uint8(1),                // version
                cid,                     // string CID
                tag,                     // tag
                expiresAt,               // expiry
                msg.sender,              // creator
                block.timestamp,         // timestamp
                uint16(block.chainid)    // source chain id (Wormhole style)
            );
            // consistencyLevel 1 for testnet by default
            wormhole.publishMessage(0, payload, 1);
        }

        emit CheckpointCreated(
            id,
            msg.sender,
            cidHash,
            tag,
            cid,
            expiresAt,
            block.timestamp
        );
    }

    function extendCheckpoint(uint256 id, uint256 addDuration)
        external
        payable
        nonReentrant
    {
        Checkpoint storage cp = checkpoints[id];
        require(cp.user == msg.sender, "not owner");
        require(addDuration > 0, "bad duration");

        uint256 cost = pricePerSecondWei * addDuration;
        require(msg.value >= cost, "underpay");

        cp.expiresAt += addDuration;

        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }

        emit CheckpointExtended(id, cp.expiresAt);
    }

    /// @notice Withdraw collected fees to a recipient. If `to` is zero, uses feeRecipient.
    function withdraw(address payable to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        if (to == address(0)) {
            to = feeRecipient != address(0) ? payable(feeRecipient) : payable(msg.sender);
        }
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit FeesWithdrawn(to, amount);
    }

    /// @notice Convenience view to fetch checkpoint by creator and tag
    function getCheckpointByCreatorTag(address creator, bytes32 tag)
        external
        view
        returns (Checkpoint memory, uint256 id)
    {
        // linear scan of byCid would be inefficient, so expose simple read helpers if needed
        // callers can still track their ids from events in most flows
        for (uint256 i = 1; i < nextCheckpointId; i++) {
            if (checkpoints[i].user == creator && checkpoints[i].tag == tag) {
                return (checkpoints[i], i);
            }
        }
        revert("not found");
    }
}
