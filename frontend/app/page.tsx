'use client'

import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#eee4f2] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-black mb-4">
            Storacha Multichain Checkpointer
          </h1>
          <p className="text-black text-lg mb-8">
            Decentralized file checkpointing across multiple blockchains with IPFS verification
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border-2 border-black rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-black mb-4">Features</h2>
            <ul className="space-y-2 text-black">
              <li className="flex items-center">
                <span className="text-red-600 mr-2">✓</span>
                Upload files to Storacha (web3.storage)
              </li>
              <li className="flex items-center">
                <span className="text-red-600 mr-2">✓</span>
                Verify CID availability across IPFS gateways
              </li>
              <li className="flex items-center">
                <span className="text-red-600 mr-2">✓</span>
                Create blockchain checkpoints with metadata
              </li>
              <li className="flex items-center">
                <span className="text-red-600 mr-2">✓</span>
                Cross-chain messaging via Wormhole
              </li>
              <li className="flex items-center">
                <span className="text-red-600 mr-2">✓</span>
                Multi-wallet support (MetaMask, WalletConnect)
              </li>
            </ul>
          </div>

          <div className="bg-white border-2 border-black rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-black mb-4">Get Started</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-black mb-2">1. Connect Wallet</h3>
                <p className="text-black text-sm">
                  Connect your Web3 wallet to interact with the contracts
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-black mb-2">2. Upload Files</h3>
                <p className="text-black text-sm">
                  Upload files to Storacha for decentralized storage
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-black mb-2">3. Create Checkpoints</h3>
                <p className="text-black text-sm">
                  Create blockchain checkpoints with CID verification
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/test"
            className="inline-block px-8 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors border-2 border-black font-semibold"
          >
            Go to Test Page
          </Link>
        </div>

        <div className="bg-white border-2 border-black rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold text-black mb-4">About This Project</h2>
          <p className="text-black mb-4">
            The Storacha Multichain Checkpointer is a decentralized application that enables users to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-black">
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
