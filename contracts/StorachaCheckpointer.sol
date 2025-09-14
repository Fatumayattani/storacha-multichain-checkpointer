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
    function publishMessage(uint32 nonce, bytes calldata payload, uint8 consistencyLevel)
        external
        payable
        returns (uint64 sequence);
}

/// @title Storacha Checkpointer
/// @notice Allows pinning data availability proofs onchain and bridging via Wormhole
contract StorachaCheckpointer is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    struct Checkpoint {
        address user;
        bytes32 cid;
        bytes32 tag;
        uint256 expiresAt;
        bool verified;
    }

    uint256 public nextCheckpointId = 1;
    mapping(uint256 => Checkpoint) public checkpoints;
    mapping(bytes32 => uint256[]) public byCid;

    IAvailabilityVerifier public verifier;
    IWormhole public wormhole;
    uint256 public pricePerSecondWei = 1e15; // 0.001 ETH per second
    address public feeRecipient;

    event CheckpointCreated(uint256 indexed id, address indexed user, bytes32 cid, bytes32 tag, uint256 expiresAt);
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

    function createCheckpoint(
        bytes32 cid,
        uint256 duration,
        bytes calldata verifierData,
        bytes32 tag,
        bool publishToWormhole
    ) external payable nonReentrant {
        require(address(verifier) != address(0), "verifier not set");
        require(duration > 0, "duration=0");

        uint256 cost = pricePerSecondWei * duration;
        require(msg.value >= cost, "underpay");

        bool ok = verifier.isAvailable(cid, verifierData);
        require(ok, "not available");

        uint256 expiresAt = block.timestamp + duration;
        uint256 id = nextCheckpointId++;

        checkpoints[id] = Checkpoint(msg.sender, cid, tag, expiresAt, ok);
        byCid[cid].push(id);

        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }

        if (publishToWormhole) {
            bytes memory payload = abi.encode(uint8(1), cid, tag, expiresAt);
            wormhole.publishMessage(0, payload, 1);
        }

        emit CheckpointCreated(id, msg.sender, cid, tag, expiresAt);
    }

    function extendCheckpoint(uint256 id, uint256 addDuration) external payable nonReentrant {
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
            to = feeRecipient != address(0) ? payable(feeRecipient) : payable(getRoleMember(ADMIN_ROLE, 0));
        }
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit FeesWithdrawn(to, amount);
    }
}
