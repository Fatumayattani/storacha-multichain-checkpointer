// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAvailabilityVerifier.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./libraries/CheckpointCodec.sol";

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
        bool revoked;
    }

    uint256 public nextCheckpointId = 1;
    mapping(uint256 => Checkpoint) public checkpoints;
    mapping(bytes32 => uint256[]) public byCid;
    mapping(address => mapping(bytes32 => uint256)) public checkpointIdsByCreatorTag;

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

    event CheckpointRevoked(uint256 indexed id, address indexed user);

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
            verified: ok,
            revoked: false
        });

        checkpointIdsByCreatorTag[msg.sender][tag] = id;

        byCid[cidHash].push(id);

        if (publishToWormhole) {
            CheckpointCodec.StorachaCheckpointMessage memory message = CheckpointCodec.StorachaCheckpointMessage({
                version: CheckpointCodec.VERSION,
                cid: cid,
                tag: tag,
                expiresAt: expiresAt,
                creator: msg.sender,
                timestamp: block.timestamp,
                sourceChainId: _wormholeChainId(),
                revoked: false
            });
            bytes memory payload = CheckpointCodec.encode(message);
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
        require(!cp.revoked, "already revoked");
        require(addDuration > 0, "bad duration");

        uint256 cost = pricePerSecondWei * addDuration;
        require(msg.value >= cost, "underpay");

        cp.expiresAt += addDuration;

        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }

        emit CheckpointExtended(id, cp.expiresAt);
    }

    function revokeCheckpoint(uint256 id, bool publishToWormhole)
        external
        payable
        nonReentrant
    {
        Checkpoint storage cp = checkpoints[id];
        require(cp.user == msg.sender, "not owner");
        require(!cp.revoked, "already revoked");

        cp.revoked = true;

        if (publishToWormhole) {
            require(address(wormhole) != address(0), "wormhole not set");
            uint256 wormholeFee = wormhole.messageFee();
            require(msg.value >= wormholeFee, "underpay wormhole fee");

            CheckpointCodec.StorachaCheckpointMessage memory message = CheckpointCodec.StorachaCheckpointMessage({
                version: CheckpointCodec.VERSION,
                cid: cp.cid,
                tag: cp.tag,
                expiresAt: cp.expiresAt,
                creator: cp.user,
                timestamp: cp.timestamp,
                sourceChainId: _wormholeChainId(),
                revoked: true
            });
            bytes memory payload = CheckpointCodec.encode(message);
            wormhole.publishMessage{value: wormholeFee}(0, payload, 1);

            if (msg.value > wormholeFee) {
                payable(msg.sender).transfer(msg.value - wormholeFee);
            }
        }

        emit CheckpointRevoked(id, msg.sender);
    }

    function getWormholeFee() public view returns (uint256) {
        if (address(wormhole) == address(0)) return 0;
        return wormhole.messageFee();
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
        id = checkpointIdsByCreatorTag[creator][tag];
        require(id != 0, "not found");
        return (checkpoints[id], id);
    }
}
