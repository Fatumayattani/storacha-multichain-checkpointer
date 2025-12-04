'use client'

import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function HomePage() {
  return (
    <div className="min-h-screen p-6">
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Storacha Multichain Checkpointer
          </h1>
          <p className="text-foreground-muted text-lg mb-8">
            Decentralized file checkpointing across multiple blockchains with IPFS verification
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card-bg border-2 border-card-border rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Features</h2>
            <ul className="space-y-2 text-foreground-muted">
              <li className="flex items-center">
                <span className="text-accent mr-2">✓</span>
                Upload files to Storacha (web3.storage)
              </li>
              <li className="flex items-center">
                <span className="text-accent mr-2">✓</span>
                Verify CID availability across IPFS gateways
              </li>
              <li className="flex items-center">
                <span className="text-accent mr-2">✓</span>
                Create blockchain checkpoints with metadata
              </li>
              <li className="flex items-center">
                <span className="text-accent mr-2">✓</span>
                Cross-chain messaging via Wormhole
              </li>
              <li className="flex items-center">
                <span className="text-accent mr-2">✓</span>
                Multi-wallet support (MetaMask, WalletConnect)
              </li>
            </ul>
          </div>

          <div className="bg-card-bg border-2 border-card-border rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Get Started</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">1. Connect Wallet</h3>
                <p className="text-foreground-muted text-sm">
                  Connect your Web3 wallet to interact with the contracts
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">2. Upload Files</h3>
                <p className="text-foreground-muted text-sm">
                  Upload files to Storacha for decentralized storage
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">3. Create Checkpoints</h3>
                <p className="text-foreground-muted text-sm">
                  Create blockchain checkpoints with CID verification
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/test"
            className="inline-block px-8 py-4 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors border-2 border-card-border font-semibold shadow-lg hover:shadow-xl"
          >
            Go to Test Page
          </Link>
        </div>

        <div className="bg-card-bg border-2 border-card-border rounded-lg p-6 mt-8 shadow-lg">
          <h2 className="text-xl font-semibold text-foreground mb-4">About This Project</h2>
          <p className="text-foreground-muted mb-4">
            The Storacha Multichain Checkpointer is a decentralized application that enables users to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-foreground-muted">
            <li>Store files permanently on IPFS via Storacha (web3.storage)</li>
            <li>Create tamper-proof checkpoints on multiple blockchains</li>
            <li>Verify file availability across the IPFS network</li>
            <li>Enable cross-chain communication through Wormhole protocol</li>
            <li>Provide a foundation for decentralized backup and archival systems</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
