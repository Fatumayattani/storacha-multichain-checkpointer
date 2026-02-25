# Roadmap

Storacha Multichain Checkpointer evolves in structured phases.

Each phase builds on a verified cross-chain transport foundation.

---

# Phase 1 — Cross-Chain Checkpointing (Live)

Status: Live on testnets

Phase 1 established the core cross-chain checkpoint system.

### Delivered Capabilities

- File upload to Storacha
- CID verification across IPFS gateways
- Checkpoint creation on a source chain
- Cross-chain propagation using Wormhole
- Secure reception and storage on a destination chain
- Replay protection using VAA hash tracking
- Trusted emitter validation
- Multi-wallet support
- End-to-end test flow

This phase validated that Storacha CIDs can be anchored on one chain and securely propagated to another.

The transport layer and security model are stable.

---

# Phase 2 — Structured Data Attestation

Status: In Progress

Phase 2 extends checkpointing into structured, queryable cross-chain attestations.

The existing transport layer remains unchanged:

Source chain publisher
→ Wormhole
→ Destination chain receiver

### Planned Additions

- Structured attestation payload format
- Extended decoding logic on receiver
- Dedicated on-chain registry for indexed provenance
- TypeScript SDK for building attestations
- Agent integration layer

### Goals

- Preserve replay protection and emitter validation
- Enable richer metadata storage
- Support indexed provenance queries
- Improve developer integration

Phase 2 builds on Phase 1 without replacing its architecture.

---

# Phase 3 — Ecosystem Validation and Expansion

Status: Planned

Phase 3 focuses on adoption and refinement.

### Focus Areas

- Pilot integrations
- Contributor onboarding
- Performance benchmarking
- Multi-destination support
- Additional chain integrations

The objective is to validate real-world usage and improve developer experience.

---

# Design Principles

Incremental evolution
Each phase builds on verified infrastructure.

Transport stability first
Wormhole-based cross-chain integrity remains the foundation.

Chain-agnostic design
The system is not limited to specific networks.

Security-first expansion
Emitter validation and replay protection remain mandatory safeguards.
