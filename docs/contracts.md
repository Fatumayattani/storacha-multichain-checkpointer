# Contracts

Storacha Multichain Checkpointer uses two smart contracts:

1. A Publisher contract on the source chain
2. A WormholeReceiver contract on the destination chain

Wormhole is not a blockchain.
It is the messaging layer that connects blockchains.

The flow looks like this:

Source chain
→ Publisher
→ Wormhole (message transport)
→ Destination chain
→ WormholeReceiver

---

# WormholeReceiver (Destination Chain)

The WormholeReceiver contract lives on the destination chain.

Its job is to safely receive cross-chain checkpoint messages and store them on-chain.

---

## What It Does

When a cross-chain message arrives, the contract:

1. Verifies the message using Wormhole
2. Confirms the message came from a trusted publisher contract
3. Ensures the same message has not already been processed
4. Decodes the checkpoint data
5. Stores the checkpoint on-chain
6. Emits an event

---

## What Is Stored

Each checkpoint includes:

- CID (IPFS content identifier)
- Tag (user-defined label)
- Expiration timestamp
- Creator address (from source chain)
- Source chain ID
- Publisher address
- Time received on the destination chain

Checkpoints are stored using the Wormhole VAA hash as the unique key.

---

## Replay Protection

Each Wormhole message has a unique VAA hash.

When a message is processed:

- Its VAA hash is marked as consumed
- If the same message is submitted again, it will revert

This prevents duplicate checkpoint storage.

---

## Trusted Emitters

The receiver only accepts messages from approved publisher contracts.

The contract owner can:

- Add trusted emitters
- Remove trusted emitters
- Batch add emitters

If a message comes from an untrusted contract, it is rejected.

---

## Querying Checkpoints

You can query checkpoints in several ways:

- By VAA hash
- By CID and source chain
- By checking multiple chains
- By checking if a checkpoint is expired
- By checking if a checkpoint exists

The same CID can exist on multiple source chains.
CID uniqueness is enforced per source chain.

---

## Security Protections

The receiver contract includes:

- Wormhole signature verification
- Trusted emitter validation
- Replay protection using VAA hashes
- Reentrancy protection
- Structured message validation via CheckpointCodec

---

## Relationship to Publisher

The Publisher contract runs on the source chain.

It:

- Accepts checkpoint creation requests
- Encodes checkpoint data
- Sends the message through Wormhole

The Receiver contract:

- Verifies the message
- Stores the checkpoint
- Makes it queryable on the destination chain

Wormhole only transports and verifies the message.
It is not a chain and does not store checkpoints.

---

## Deployment

Publisher:

```bash id="rq1w6h"
npx hardhat run scripts/deploy-publisher.ts --network <sourceNetwork>
```

Receiver:

```bash id="ha1m1y"
npx hardhat run scripts/deploy-receiver.ts --network <destinationNetwork>
```

Deployment uses RPC URLs and a private key configured via environment variables.
Private keys are never exposed to the frontend.
