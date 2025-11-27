# Frontend Setup Guide

## Overview

This frontend application provides a user interface for the Storacha Multichain Checkpointer system, enabling users to create, manage, and track cross-chain checkpoints across Base Sepolia and Avalanche Fuji testnets.

## Tech Stack

- **Framework**: Next.js 15.5.5 (App Router)
- **React**: 19.1.0
- **TypeScript**: 5.x
- **Styling**: Tailwind CSS v4
- **Web3**: Wagmi v2.18.0 + Viem v2.38.1 + ethers v6.15.0
- **Storage**: Storacha/web3.storage
- **State Management**: @tanstack/react-query v5.90.2

## Prerequisites

- Node.js 18+ or 20+
- npm, yarn, or pnpm
- MetaMask or compatible Web3 wallet
- Access to Base Sepolia and Avalanche Fuji testnets

## Installation

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

### 3. Configure Contract Addresses

Edit `.env.local` and update the following:

```env
# Base Sepolia Publisher Contract
# TODO: Update this with Fatuma's new deployment address
NEXT_PUBLIC_BASE_SEPOLIA_PUBLISHER_ADDRESS=0xYOUR_PUBLISHER_ADDRESS

# Avalanche Fuji Receiver Contract (DEPLOYED ✅)
NEXT_PUBLIC_FUJI_RECEIVER_ADDRESS=0x75d2b02f5980D4D1BB6cf7d3829A7a1F3BB1Ef76
```

### 4. WalletConnect Configuration (Optional)

Get a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/):

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

## Running the Application

### Development Mode

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── dashboard/               # Dashboard page
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing page
│   └── globals.css             # Global styles
├── components/
│   ├── ui/                     # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Toast.tsx
│   │   └── index.ts
│   ├── WalletConnector.tsx     # Wallet connection
│   └── Providers.tsx           # React providers
├── hooks/
│   ├── useStoracha.ts          # Storacha upload hook
│   └── useStorachaCheckpointer.ts  # Contract interaction
├── lib/
│   ├── contracts.ts            # Contract configuration
│   ├── wagmi.ts                # Wagmi setup
│   ├── chains.ts               # Chain configs
│   └── utils.ts                # Utility functions
├── styles/
│   └── design-tokens.css       # Design system tokens
├── constants/
│   └── index.ts                # Contract ABIs
└── utils/
    └── ipfsGateways.ts         # IPFS utilities
```

## Key Features

### 1. Component Library

Reusable UI components with consistent styling:

```typescript
import { Button, Card, Badge, useToast } from '@/components/ui';

// Button variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>

// Toast notifications
const { showToast } = useToast();
showToast({ type: 'success', title: 'Success!', description: 'Operation completed' });
```

### 2. Contract Configuration

Environment-based contract management:

```typescript
import { getContractAddress, ContractType, CHAIN_IDS } from "@/lib/contracts";

// Get contract address
const publisherAddress = getContractAddress(
  CHAIN_IDS.BASE_SEPOLIA,
  ContractType.PUBLISHER
);
```

### 3. Wallet Integration

- MetaMask
- WalletConnect
- Injected wallets
- Multi-chain support (Base Sepolia, Avalanche Fuji)

### 4. Dashboard Features

- Checkpoint management
- Transaction history
- Network status
- Cross-chain tracking

## Contract Integration Status

### ✅ Deployed Contracts

| Network        | Contract  | Address                                      | Status                 |
| -------------- | --------- | -------------------------------------------- | ---------------------- |
| Avalanche Fuji | Receiver  | `0x75d2b02f5980D4D1BB6cf7d3829A7a1F3BB1Ef76` | ✅ Deployed            |
| Base Sepolia   | Publisher | TBD                                          | ⏳ Pending v6 redeploy |

### Contract Compatibility

- Frontend uses **ethers v6.15.0** ✅
- Compatible with Hany's Receiver deployment ✅
- Waiting for Fatuma's Publisher redeployment

## Development Workflow

### 1. Component Development

All UI components are in `/components/ui/`:

```typescript
// Example: Using Button component
import Button from '@/components/ui/Button';

<Button
  variant="primary"
  size="md"
  isLoading={false}
  leftIcon={<Icon />}
  onClick={handleClick}
>
  Click Me
</Button>
```

### 2. Adding New Pages

Create pages in `/app/`:

```typescript
// app/new-page/page.tsx
export default function NewPage() {
  return <div>New Page Content</div>;
}
```

### 3. Custom Hooks

Create hooks in `/hooks/`:

```typescript
// hooks/useMyHook.ts
import { useState } from "react";

export function useMyHook() {
  const [state, setState] = useState();
  return { state, setState };
}
```

## Testing Contracts

### Base Sepolia (Publisher)

1. Connect wallet to Base Sepolia
2. Ensure you have Sepolia ETH
3. Create a checkpoint
4. Verify Wormhole message publication

### Avalanche Fuji (Receiver)

1. Connect wallet to Avalanche Fuji
2. Verify contract at: https://testnet.snowtrace.io/address/0x75d2b02f5980D4D1BB6cf7d3829A7a1F3BB1Ef76
3. Monitor cross-chain messages

## Troubleshooting

### Contract Not Deployed Error

If you see "Contract not deployed on [chain]":

1. Check `.env.local` has correct contract addresses
2. Verify addresses are not `0x0000...`
3. Restart dev server after env changes

### Wallet Connection Issues

1. Ensure MetaMask is unlocked
2. Switch to correct network (Base Sepolia or Avalanche Fuji)
3. Clear browser cache and reconnect

### Build Errors

If you encounter TypeScript errors:

```bash
npm run type-check
```

If you encounter linting errors:

```bash
npm run lint
```

## Environment Variables Reference

### Required

| Variable                                     | Description                         | Example       |
| -------------------------------------------- | ----------------------------------- | ------------- |
| `NEXT_PUBLIC_BASE_SEPOLIA_PUBLISHER_ADDRESS` | Publisher contract on Base Sepolia  | `0xABC...`    |
| `NEXT_PUBLIC_FUJI_RECEIVER_ADDRESS`          | Receiver contract on Avalanche Fuji | `0x75d2b0...` |

### Optional

| Variable                               | Description              | Default |
| -------------------------------------- | ------------------------ | ------- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID | -       |
| `NEXT_PUBLIC_DEBUG_MODE`               | Enable debug logging     | `false` |
| `NEXT_PUBLIC_USE_MOCK_DATA`            | Use mock data            | `false` |

## Design System

### Colors

- **Primary**: Purple (`--color-primary-*`)
- **Secondary**: Blue (`--color-secondary-*`)
- **Success**: Green
- **Warning**: Orange
- **Error**: Red
- **Info**: Blue

### Spacing

Uses 4px base unit: `--spacing-1` through `--spacing-24`

### Typography

Font sizes: `xs`, `sm`, `base`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`

## Next Steps

1. **Update Publisher Address**
2. **Test Cross-Chain Flow**: Create checkpoint on Base → Verify on Fuji
3. **Add More Features**:
   - Checkpoint history list
   - Transaction tracking
   - CID explorer
   - File upload UI
   - Analytics dashboard

## Support

For issues or questions:

- Check the [main README](../README.md)
- Review contract deployment logs
- Contact the team in the project channel

## Contributing

1. Create feature branch from `main`
2. Make changes
3. Test thoroughly
4. Submit PR with clear description

---

**Status**: Ready for contract integration once Publisher address is available!
