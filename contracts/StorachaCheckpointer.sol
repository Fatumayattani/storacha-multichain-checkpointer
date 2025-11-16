// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAvailabilityVerifier.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ReentrancyGuard {
    uint256 private locked = 1;
    modifier nonReentrant() {
        require(locked == 1, "reentrancy");
        locked = 2;
        _;
        locked = 1;
    }
}

interface IWormhole {
    function publishMessage(
        uint32 nonce,
        bytes calldata payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence);
    
    function messageFee() external view returns (uint256);
}

contract StorachaCheckpointer is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    struct Checkpoint {
        address user;
        string cid;
        bytes32 tag;
        uint256 expiresAt;
        uint256 timestamp;
        bool verified;
    }

    uint256 public nextCheckpointId = 1;
    mapping(uint256 => Checkpoint) public checkpoints;
    mapping(bytes32 => uint256[]) public byCid;

    IAvailabilityVerifier public verifier;
    IWormhole public wormhole;
    uint256 public pricePerSecondWei = 1e15;
    address public feeRecipient;

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

    function _wormholeChainId() internal view virtual returns (uint16) {
        if (block.chainid == 84532) return 10004; // Base Sepolia
        if (block.chainid == 43113) return 6;     // Avalanche Fuji
        if (block.chainid == 11155111) return 10002; // Ethereum Sepolia
        revert("Unsupported chain");
    }

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
        uint256 wormholeFee = 0;
        
        if (publishToWormhole) {
            require(address(wormhole) != address(0), "wormhole not set");
            wormholeFee = IWormhole(address(wormhole)).messageFee();
        }
        
        uint256 totalCost = cost + wormholeFee;
        require(msg.value >= totalCost, "underpay");

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

        if (publishToWormhole) {
            bytes memory payload = abi.encode(
                uint8(1),
                cid,
                tag,
                expiresAt,
                msg.sender,
                block.timestamp,
                _wormholeChainId() // ✅ fixed chain ID
            );
            wormhole.publishMessage{value: wormholeFee}(0, payload, 1);
        }

        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
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

    function withdraw(address payable to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        if (to == address(0)) {
            to = feeRecipient != address(0) ? payable(feeRecipient) : payable(msg.sender);
        }
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit FeesWithdrawn(to, amount);
    }

    function getCheckpointByCreatorTag(address creator, bytes32 tag)
        external
        view
        returns (Checkpoint memory, uint256 id)
    {
        for (uint256 i = 1; i < nextCheckpointId; i++) {
            if (checkpoints[i].user == creator && checkpoints[i].tag == tag) {
                return (checkpoints[i], i);
            }
        }
        revert("not found");
    }
}
