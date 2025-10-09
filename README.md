# 🌐 Storacha Multichain Checkpointer

**Storacha Multichain Checkpointer** is an **on-chain protocol** built on a smart contract system that allows anyone to **publish and synchronize Storacha CIDs across multiple chains** using **Wormhole** as the cross-chain transport layer.

The protocol makes it simple to anchor content stored on Storacha, propagate that state to other networks, and verify it transparently on-chain — without centralized infrastructure.

---

## ✨ Key Features

- ✅ **On-chain CID anchoring** — securely store CID, tags, and expiry on the source chain
- 🌉 **Cross-chain propagation** — broadcast checkpoint messages to multiple target chains through Wormhole
- 🪶 **Lightweight architecture** — no backend needed in MVP (client-side uploads only)
- 🔍 **Optional CID verification** — UI checks against IPFS gateways before submission
- 🧭 **Upgradeable flow** — can integrate oracles or off-chain verifiers in later versions

---

## 🧭 Architecture Overview

```
+-------------------------+
|      User / Client      |
|  (Storacha Upload + UI) |
+-----------+-------------+
            |
            |  CID
            v
+-----------------------------+
| Storacha Checkpointer (EVM) |
| - createCheckpoint          |
| - emits CheckpointCreated   |
+-----------+-----------------+
            |
            | Wormhole Message
            v
+------------------------------+
| Receiver Contract (Target)   |
| - decode + store CID         |
| - verify VAA via Wormhole    |
+------------------------------+
```

---

## 🧱 Smart Contract / Protocol Components

### 1. Checkpointer (Sender)

- Anchors CID and metadata on the source chain
- Serializes and publishes Wormhole message

```solidity
function createCheckpoint(
    string calldata cid,
    bytes32 tag,
    uint256 duration,
    bool publishToWormhole,
    uint16[] calldata targetChains
) external payable;
```

### 2. Receiver

- Receives Wormhole VAA
- Decodes and persists the checkpoint
- Emits `CheckpointReceived`

### 3. Frontend

- Handles client-side upload with [w3up](https://w3up.dev)
- Verifies CID availability using IPFS gateways
- Submits transaction to Checkpointer contract

---

## 📜 Message Structure

```solidity
struct StorachaCheckpointMessage {
    uint8 version;
    string cid;
    bytes32 tag;
    uint256 expiresAt;
    address creator;
    uint256 timestamp;
    uint16 sourceChainId;
}
```

This message is broadcasted through Wormhole from the source chain to target chains and verified by receiver contracts.

---

## 🧪 Current MVP Scope

- ✅ Client-side Storacha uploads (no backend)
- ✅ Trust-on-first-write verification
- ✅ Wormhole message publishing and receiving
- ✅ Base Sepolia → Avalanche Fuji testnet flow
- 🧪 Optional client CID availability checks
- 🪶 Lightweight gas footprint

---

## 🚀 Roadmap

| Phase | Workstream        | Description                                  | Status         |
| ----- | ----------------- | -------------------------------------------- | -------------- |
| 1     | Sender Contract   | Implement `createCheckpoint` + serialization | 🟡 In Progress |
| 2     | Receiver Contract | Wormhole VAA validation and storage          | 🟡 In Progress |
| 3     | Frontend          | Upload + CID check + transaction submit      | 🟡 In Progress |
| 4     | Integration       | End-to-end Base Sepolia → Fuji test          | ⏳ Upcoming    |
| 5     | V2 Expansion      | Add off-chain verifier + sponsor relayer     | ⏳ Planned     |

---

## 🧑‍💻 Team & Roles

- **Fatuma** — Sender contract, serialization logic, Wormhole message publisher
- **Patrick** — Frontend: upload flow, CID verification UI, transaction submission
- **Hany** — Wormhole environment setup, receiver contract, cross-chain testing

---

## 🧪 Testnet Environment

- **Source Chain:** Base Sepolia
- **Target Chain:** Avalanche Fuji
- **Additional:** Ethereum Sepolia (next phase)
- **Cross-chain Transport:** Wormhole Guardian Network (testnet)

---

## 🛠️ Local Development

**Prerequisites**

- Node.js ≥ 18
- pnpm or npm
- Hardhat
- Foundry (optional)
- Wormhole CLI
- `.env` file with your keys

```bash
# Install dependencies
pnpm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deploy.ts --network baseSepolia
```

---

## 🌍 Example Flow

1. User uploads file to Storacha and gets CID
2. UI verifies CID availability
3. User calls `createCheckpoint`
4. Wormhole message published to target chains
5. Receiver contract decodes message and stores checkpoint
6. Anyone can retrieve and verify CID cross-chain

---

## 🧠 Future Enhancements

- 🪙 Oracle-based CID verification (e.g. Chainlink Functions)
- 🧭 Relay/sponsor model for Wormhole costs
- 🛡 Attestation and expiry enforcement
- 🧰 Dev-friendly SDK for integration into other apps
- 🌐 Multi-chain dashboard for monitoring checkpoints

---

## 🤝 Contributing

We welcome contributors!
Open an issue or PR to suggest improvements.
For dev coordination, join the Storacha Hackathon workspace and check the open GitHub Discussions.

---

## 📜 License

MIT © 2025
