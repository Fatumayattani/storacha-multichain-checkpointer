# Deployment Guide

This document describes how to deploy and test Storacha Multichain Checkpointer on testnets.

Current live flow:

Base Sepolia → Wormhole → Avalanche Fuji

---

## Prerequisites

- Node.js installed
- Hardhat configured
- Testnet funds on Base Sepolia and Avalanche Fuji
- RPC endpoints for both networks

---

## 1. Clone and Install

```bash
git clone https://github.com/Fatumayattani/storacha-multichain-checkpointer.git
cd storacha-multichain-checkpointer
npm install
```

---

## 2. Configure Deployment Environment

Create a `.env` file in the project root for Hardhat:

```env
BASE_SEPOLIA_RPC_URL=
AVALANCHE_FUJI_RPC_URL=
PRIVATE_KEY=
```

Notes:

- `PRIVATE_KEY` must have testnet funds
- Never commit this file
- Used only for deployment

Ensure `hardhat.config.ts` reads these values for the corresponding networks.

---

## 3. Deploy Publisher (Base Sepolia)

Deploy the publisher contract on Base Sepolia:

```bash
npx hardhat run scripts/deploy-publisher.ts --network baseSepolia
```

After deployment:

- Copy the deployed publisher address
- Add it to the frontend `.env`:

```env
NEXT_PUBLIC_BASE_SEPOLIA_PUBLISHER_ADDRESS=
```

---

## 4. Deploy Receiver (Avalanche Fuji)

Deploy the receiver contract on Avalanche Fuji:

```bash
npx hardhat run scripts/deploy-receiver.ts --network avalancheFuji
```

After deployment:

- Copy the deployed receiver address
- If applicable, copy registry address
- Update frontend `.env`:

```env
NEXT_PUBLIC_FUJI_RECEIVER_ADDRESS=
NEXT_PUBLIC_FUJI_REGISTRY_ADDRESS=
```

---

## 5. Configure Wormhole Trusted Emitter

After both deployments:

- Set the Base Sepolia publisher contract as the trusted emitter on the Avalanche Fuji receiver
- Verify Wormhole core addresses are configured correctly
- Confirm replay protection is active

This ensures only valid cross-chain messages are processed.

---

## 6. Configure Frontend Environment

Create a `.env` file in the frontend root:

```env
NEXT_PUBLIC_SUPPORTED_CHAINS=
NEXT_PUBLIC_DEFAULT_CHAIN_ID=

NEXT_PUBLIC_BASE_SEPOLIA_PUBLISHER_ADDRESS=
NEXT_PUBLIC_FUJI_RECEIVER_ADDRESS=
NEXT_PUBLIC_FUJI_REGISTRY_ADDRESS=

NEXT_PUBLIC_WORMHOLE_CHAIN_ID_BASE=
NEXT_PUBLIC_WORMHOLE_CHAIN_ID_AVALANCHE=
NEXT_PUBLIC_WORMHOLE_RPC=
```

Important:

- Do not store private keys in frontend configuration
- Only `NEXT_PUBLIC_` variables are exposed to the browser

---

## 7. Run the Frontend

```bash
npm run dev
```

Open the application and perform:

1. Connect Wallet (MetaMask or WalletConnect)
2. Upload file to Storacha
3. Verify CID via IPFS gateways
4. Create checkpoint on Base Sepolia
5. Wait for Wormhole relay
6. Confirm record stored on Avalanche Fuji

---

## 8. Full End-to-End Test

Use the built-in UI testing controls:

- Test Storacha Init
- Test CID Verification
- Test Contract
- Full E2E Test

This validates:

Upload → Verify → Checkpoint → Cross-chain propagation → Registry confirmation

---

## Security Notes

- Never commit deployment `.env` files
- Keep private keys separate from frontend configuration
- Always verify trusted emitter settings after deployment
