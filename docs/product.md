# Product Overview

Storacha Multichain Checkpointer enables verifiable cross-chain checkpointing of Storacha CIDs.

It allows users to upload a file to Storacha, verify its CID across IPFS gateways, and anchor that CID on a source chain. The proof is then propagated to a destination chain using Wormhole.

The result is a verifiable, cross-chain record of file existence and metadata.

---

## What Problem It Solves

When data is stored off-chain, there is often no portable on-chain proof that the data existed at a specific time.

This project solves that by:

- Anchoring a Storacha CID on a source chain
- Propagating that proof to another chain
- Making the checkpoint verifiable across chains

It separates storage from verification while preserving integrity.

---

## Core Capabilities (Live)

- Upload files to Storacha
- Verify CID availability across IPFS gateways
- Create blockchain checkpoints with metadata
- Propagate checkpoints cross-chain via Wormhole
- Store verified checkpoints on a destination chain
- Multi-wallet support (Injected, MetaMask, WalletConnect)
- Built-in end-to-end test flow

---

## How It Works at a Product Level

1. A user uploads a file.
2. The system generates a CID.
3. The user creates a checkpoint on a source chain.
4. Wormhole propagates the proof.
5. The destination chain stores the verified checkpoint.

This creates a portable, cross-chain record of file existence.

---

## Design Principles

Chain-agnostic
The system is not limited to specific EVM testnets. Any supported source and destination chains can be added.

Transport-first
Wormhole handles cross-chain delivery. The application logic remains simple and verifiable.

Minimal trust surface
The receiver only accepts messages from the configured source contract and prevents replay using VAA hash tracking.

Frontend transparency
The test interface exposes initialization, verification, and status states for clear debugging and validation.

---

## Target Use Cases

- Cross-chain data anchoring
- Verifiable research artifacts
- Checkpointing AI datasets
- Proof of storage existence
- Multi-chain provenance tracking

---

## Roadmap: Phase 1 Data Attestation

The next phase extends checkpointing into structured data attestation.

Planned additions:

- Structured attestation payload format
- Indexed provenance storage
- TypeScript SDK for building attestations
- Agent integration layer

This builds on the existing cross-chain transport without replacing it.
