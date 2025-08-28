# Storacha Multichain Checkpointer

A smart contract system for checkpointing **Storacha CIDs** on-chain, validating their **availability proofs** (e.g., from Filecoin), and optionally **mirroring state across chains** via Wormhole. This project enables verifiable, time-bound guarantees of storage availability that can be consumed across ecosystems.

---

## Key Features

* **CID Checkpointing**: Users can register a CID on-chain with a defined duration.
* **Availability Proofs**: Integrates with an external Verifier contract to validate storage proofs.
* **Configurable Fees**: Admin defines fee per second of checkpoint duration; users pay accordingly.
* **Extendable Duration**: Users can extend checkpoint lifetimes at any time.
* **Cross-chain Sync (Optional)**: Publishes checkpoint metadata through Wormhole for multi-chain availability.
* **Auditability**: All checkpoints, extensions, and verifications are permanently logged on-chain.

---

## Architecture Overview

1. **Storacha Upload**

   * User uploads data to Storacha and retrieves a CID.

2. **Checkpoint Creation**

   * User calls the contract with `cidDigest`, desired duration, and fee payment.
   * Contract stores checkpoint metadata and expiry.

3. **Availability Verification**

   * If configured, contract queries an Availability Verifier (e.g., Filecoin proof oracle) to mark the CID as valid.

4. **Optional Wormhole Publish**

   * Checkpoint details are emitted to Wormhole, allowing other chains to mirror and consume this state.

---

## Components

* **StorachaCheckpointer**: Core contract for creating and managing checkpoints.
* **Availability Verifier**: Plug-in interface to validate proofs (mocked here, pluggable with Filecoin oracles).
* **Wormhole Integration**: Optional publisher + receiver contracts for cross-chain state mirroring.
* **Scripts & Tests**: Hardhat scripts for deployment, testing, and verification flows.

---

## Use Cases

* **Auditable Proof of Storage**: Users can pin data on Storacha and anchor its proof on-chain.
* **Cross-chain Availability**: Other chains can reference checkpointed state without direct access to Filecoin or Storacha.
* **Warm Storage Guarantees**: Applications can query recent checkpoints to ensure data remains accessible.
* **Compliance & Trust**: Builders can provide verifiable guarantees for stored user data.

---

## Getting Started

* Deploy contracts with Hardhat.
* Set verifier contract (mock, Filecoin pipeline, or oracle).
* Configure fees and Wormhole settings.
* Users begin checkpointing CIDs by paying duration-based fees.

---

📚 <span style="color:red">[Storacha Documentation](https://docs.storacha.network)</span> 

## Roadmap

* ⏳ MVP with checkpointing and fee model
* ⏳ Mock Verifier for local development
* ⏳ Wormhole integration with full VAA verification
* ⏳ React frontend for creating and extending checkpoints
* ⏳ Off-chain relayer to feed Filecoin proofs into verifier
* ⏳ Deployment guides for testnets and mainnet

---

## Contributing

Contributions are welcome! Please open an issue for feature requests, integrations, or bug reports. PRs with improvements to Verifier adapters, cross-chain support, or front-end tools are encouraged.

---

## License

MIT License — free to use, modify, and distribute.

