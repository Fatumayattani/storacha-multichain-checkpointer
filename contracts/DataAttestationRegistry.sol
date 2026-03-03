// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DataAttestationRegistry
 * @notice Stores and indexes verified data attestations on-chain (e.g. from Wormhole).
 * @dev Replay protection is by uniqueId (e.g. VAA hash): the same message cannot be
 *      recorded twice. Multiple attestations for the same CID are allowed.
 *      Only the designated receiver (e.g. WormholeReceiver) may call recordAttestation.
 */
contract DataAttestationRegistry {
    // ============ STRUCTS ============

    /// @notice Stored attestation record (CID, creator, timestamp, lineage, license, recordedAt)
    struct AttestationRecord {
        string cid;
        address creator;
        uint256 timestamp;
        bytes32 lineage;
        bytes32 licenseHash;
        uint256 recordedAt;
    }

    // ============ STORAGE ============

    /// @notice Replay protection and primary lookup: uniqueId (e.g. VAA hash) => record
    mapping(bytes32 => AttestationRecord) public attestationsByUniqueId;

    /// @notice CID hash => ordered list of uniqueIds for paginated getAttestationsByCID
    mapping(bytes32 => bytes32[]) private _cidToUniqueIds;

    /// @notice Creator => ordered list of uniqueIds for paginated getAttestationsByCreator
    mapping(address => bytes32[]) private _creatorToUniqueIds;

    /// @notice Total number of attestations recorded
    uint256 public totalAttestations;

    /// @notice Only this address (e.g. WormholeReceiver) may call recordAttestation
    address public receiver;

    // ============ ERRORS ============

    /// @notice uniqueId is zero
    error ZeroUniqueId();

    /// @notice Attestation already recorded for this uniqueId (replay)
    /// @param uniqueId The duplicate uniqueId
    error DuplicateAttestation(bytes32 uniqueId);

    /// @notice Attestation not found for the given uniqueId
    /// @param uniqueId The requested uniqueId
    error AttestationNotFound(bytes32 uniqueId);

    /// @notice Caller is not the designated receiver
    error UnauthorizedCaller();

    /// @notice Receiver address cannot be zero
    error ZeroReceiver();

    // ============ MODIFIERS ============

    /// @notice Restricts recordAttestation to the designated receiver contract
    modifier onlyReceiver() {
        if (msg.sender != receiver) revert UnauthorizedCaller();
        _;
    }

    // ============ CONSTRUCTOR ============

    /// @param _receiver Address allowed to call recordAttestation (e.g. WormholeReceiver)
    constructor(address _receiver) {
        if (_receiver == address(0)) revert ZeroReceiver();
        receiver = _receiver;
    }

    // ============ EVENTS ============

    /// @notice Emitted when a new attestation is recorded
    /// @param uniqueId Replay id (e.g. VAA hash)
    /// @param cidHash keccak256(cid) for indexing
    /// @param creator Attestation creator
    /// @param cid Full CID string
    /// @param timestamp Attestation timestamp
    /// @param lineage Lineage reference (optional)
    /// @param licenseHash License hash (optional)
    /// @param recordedAt Block timestamp when recorded
    event AttestationRecorded(
        bytes32 indexed uniqueId,
        bytes32 indexed cidHash,
        address indexed creator,
        string cid,
        uint256 timestamp,
        bytes32 lineage,
        bytes32 licenseHash,
        uint256 recordedAt
    );

    // ============ WRITE ============

    /**
     * @notice Record a verified attestation (e.g. after Wormhole VAA verification).
     * @param uniqueId Unique id for replay protection (e.g. VAA hash). Must not be zero; must not have been used before.
     * @param cid Content identifier (e.g. IPFS CID)
     * @param creator Attestation creator address
     * @param timestamp Attestation timestamp
     * @param lineage Optional lineage reference (use bytes32(0) if none)
     * @param licenseHash Optional license hash (use bytes32(0) if none)
     */
    function recordAttestation(
        bytes32 uniqueId,
        string calldata cid,
        address creator,
        uint256 timestamp,
        bytes32 lineage,
        bytes32 licenseHash
    ) external onlyReceiver {
        if (uniqueId == bytes32(0)) revert ZeroUniqueId();
        if (attestationsByUniqueId[uniqueId].recordedAt != 0) revert DuplicateAttestation(uniqueId);

        attestationsByUniqueId[uniqueId] = AttestationRecord({
            cid: cid,
            creator: creator,
            timestamp: timestamp,
            lineage: lineage,
            licenseHash: licenseHash,
            recordedAt: block.timestamp
        });

        bytes32 cidHash = keccak256(bytes(cid));
        _cidToUniqueIds[cidHash].push(uniqueId);
        _creatorToUniqueIds[creator].push(uniqueId);
        totalAttestations++;

        emit AttestationRecorded(
            uniqueId,
            cidHash,
            creator,
            cid,
            timestamp,
            lineage,
            licenseHash,
            block.timestamp
        );
    }

    // ============ QUERIES ============

    /**
     * @notice Get a single attestation by its unique id
     * @param uniqueId The replay id (e.g. VAA hash)
     */
    function getAttestation(bytes32 uniqueId)
        external
        view
        returns (AttestationRecord memory)
    {
        if (attestationsByUniqueId[uniqueId].recordedAt == 0) revert AttestationNotFound(uniqueId);
        return attestationsByUniqueId[uniqueId];
    }

    /**
     * @notice Get attestations for a CID with pagination
     * @param cid The content identifier
     * @param offset Starting index (0-based)
     * @param limit Max number of records to return
     * @return records The attestation records in range
     * @return total Total number of attestations for this CID
     */
    function getAttestationsByCID(
        string calldata cid,
        uint256 offset,
        uint256 limit
    ) external view returns (AttestationRecord[] memory records, uint256 total) {
        bytes32 cidHash = keccak256(bytes(cid));
        bytes32[] storage ids = _cidToUniqueIds[cidHash];
        total = ids.length;
        (records, ) = _paginate(ids, offset, limit, total);
        return (records, total);
    }

    /**
     * @notice Get attestations by creator with pagination
     * @param creator The creator address
     * @param offset Starting index (0-based)
     * @param limit Max number of records to return
     * @return records The attestation records in range
     * @return total Total number of attestations by this creator
     */
    function getAttestationsByCreator(
        address creator,
        uint256 offset,
        uint256 limit
    ) external view returns (AttestationRecord[] memory records, uint256 total) {
        bytes32[] storage ids = _creatorToUniqueIds[creator];
        total = ids.length;
        (records, ) = _paginate(ids, offset, limit, total);
        return (records, total);
    }

    /**
     * @notice Total count of attestations for a CID
     */
    function countByCID(string calldata cid) external view returns (uint256) {
        return _cidToUniqueIds[keccak256(bytes(cid))].length;
    }

    /**
     * @notice Total count of attestations by a creator
     */
    function countByCreator(address creator) external view returns (uint256) {
        return _creatorToUniqueIds[creator].length;
    }

    /**
     * @notice Check if an attestation exists for the given uniqueId
     */
    function attestationExists(bytes32 uniqueId) external view returns (bool) {
        return attestationsByUniqueId[uniqueId].recordedAt != 0;
    }

    // ============ INTERNAL ============

    function _paginate(
        bytes32[] storage ids,
        uint256 offset,
        uint256 limit,
        uint256 total
    ) internal view returns (AttestationRecord[] memory records, uint256 returned) {
        if (offset >= total || limit == 0) {
            return (new AttestationRecord[](0), 0);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        returned = end - offset;
        records = new AttestationRecord[](returned);
        for (uint256 i = 0; i < returned; i++) {
            records[i] = attestationsByUniqueId[ids[offset + i]];
        }
        return (records, returned);
    }
}
