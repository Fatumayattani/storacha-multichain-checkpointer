'use client'

import React from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { isSupportedChain, supportedChains } from '@/lib/chains'
import { ChevronDownIcon, WalletIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'

export function WalletConnector() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  // Check if current chain is supported
  const isUnsupportedChain = isConnected && chain && !isSupportedChain(chain.id)

  const handleConnect = (connectorId: string) => {
    const connector = connectors.find(c => c.id === connectorId)
    if (connector) {
      connect({ connector })
    }
  }

  const handleSwitchChain = (chainId: number) => {
    switchChain({ chainId })
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-gray-900">Connect Wallet</h3>
        <p className="text-sm text-gray-600">
          Connect your wallet to create checkpoints across multiple chains
        </p>
        
        <div className="grid gap-2">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => handleConnect(connector.id)}
              disabled={isPending}
              className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <WalletIcon className="w-5 h-5 text-gray-600" />
              <span className="font-medium">{connector.name}</span>
              {isPending && (
                <div className="ml-auto w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Wallet Status */}
      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full" />
          <div>
            <p className="font-medium text-green-900">Wallet Connected</p>
            <p className="text-sm text-green-700">{formatAddress(address!)}</p>
          </div>
        </div>
        <button
          onClick={() => disconnect()}
          className="text-sm text-green-700 hover:text-green-900 underline"
        >
          Disconnect
        </button>
      </div>

      {/* Network Status */}
      {isUnsupportedChain ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <p className="font-medium text-red-900">Unsupported Network</p>
          </div>
          <p className="text-sm text-red-700 mb-3">
            Please switch to a supported network to create checkpoints.
          </p>
          <div className="flex gap-2">
            {supportedChains.map((supportedChain) => (
              <button
                key={supportedChain.id}
                onClick={() => handleSwitchChain(supportedChain.id)}
                disabled={isSwitching}
                className="px-3 py-1 text-sm bg-red-100 text-red-800 border border-red-300 rounded hover:bg-red-200 disabled:opacity-50"
              >
                {supportedChain.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-900">Current Network</p>
              <p className="text-sm text-blue-700">{chain?.name}</p>
            </div>
            
            {/* Network Switcher */}
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-800 border border-blue-300 rounded hover:bg-blue-200 disabled:opacity-50">
                Switch
                <ChevronDownIcon className="w-4 h-4" />
              </Menu.Button>
              
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg focus:outline-none">
                  {supportedChains.map((supportedChain) => (
                    <Menu.Item key={supportedChain.id}>
                      {({ active }) => (
                        <button
                          onClick={() => handleSwitchChain(supportedChain.id)}
                          disabled={isSwitching || supportedChain.id === chain?.id}
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } ${
                            supportedChain.id === chain?.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                          } group flex w-full items-center px-3 py-2 text-sm disabled:opacity-50`}
                        >
                          {supportedChain.name}
                          {supportedChain.id === chain?.id && (
                            <span className="ml-auto text-xs">Current</span>
                          )}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      )}

      {/* Chain Information */}
      <div className="text-sm text-gray-600">
        <p>Supported Networks:</p>
        <ul className="mt-1 space-y-1">
          {supportedChains.map((supportedChain) => (
            <li key={supportedChain.id} className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-400 rounded-full" />
              {supportedChain.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default WalletConnector