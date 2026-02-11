"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import WalletConnector from "@/components/WalletConnector";
import CheckpointList from "@/components/dashboard/CheckpointList";
import { useStorachaCheckpointer } from "@/hooks/useStorachaCheckpointer";
import {
  DocumentIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";
import { formatAddress } from "@/lib/utils";
import { getChainName } from "@/lib/contracts";

export default function DashboardPage() {
  const { address, isConnected, chain } = useAccount();
  const router = useRouter();
  
  const { 
    checkpointIds, 
    refetchUserCheckpoints, 
    contractAddress 
  } = useStorachaCheckpointer();

  const handleCreateCheckpoint = () => {
    router.push('/test');
  };

  const handleRefresh = async () => {
    await refetchUserCheckpoints();
  };

  const totalCheckpoints = checkpointIds?.length || 0;

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor: '#eee4f2'}}>
        <div className="bg-white border-2 border-black rounded-lg p-6 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4 text-black">Connect Your Wallet</h2>
          <p className="text-black mb-6">Please connect your wallet to view your checkpoint dashboard</p>
          <WalletConnector />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{backgroundColor: '#eee4f2'}}>
      {/* Header */}
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="bg-white border-2 border-black rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black">
                📊 Checkpoint Dashboard
              </h1>
              <p className="text-black mt-1">
                Manage your cross-chain checkpoints
              </p>
            </div>
            <div className="ml-auto">
              <WalletConnector />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white border-2 border-black rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">
                  Total Checkpoints
                </p>
                <p className="text-3xl font-bold mt-2 text-black">{totalCheckpoints}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg border-2 border-black">
                <DocumentIcon className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">
                  Wallet Address
                </p>
                <p className="text-xl font-bold mt-2 text-black">{formatAddress(address || "")}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg border-2 border-black">
                <CheckCircleIcon className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">
                  Connected Chain
                </p>
                <p className="text-xl font-bold mt-2 text-black">{chain ? getChainName(chain.id) : "Unknown"}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg border-2 border-black">
                <ClockIcon className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Network Status */}
        <div className="bg-white border-2 border-black rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-black">Network Status</h2>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-black border-2 border-black">
                <span className="w-2 h-2 bg-red-600 rounded-full mr-2"></span>
                {chain ? getChainName(chain.id) : "Not Connected"}
              </span>
            </div>
            <div className="text-sm text-black">
              Connected: <span className="font-mono font-semibold">{formatAddress(address || "")}</span>
            </div>
          </div>
        </div>

        {/* Checkpoints List */}
        <div className="bg-white border-2 border-black rounded-lg">
          <div className="p-6 border-b-2 border-black">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-black">Recent Checkpoints</h2>
              <button 
                onClick={handleRefresh}
                className="px-4 py-2 bg-black text-white rounded hover:bg-red-600 border-2 border-black inline-flex items-center gap-2"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="p-6">
            {checkpointIds && contractAddress ? (
              <CheckpointList 
                contractAddress={contractAddress as `0x${string}`} 
                checkpointIds={checkpointIds} 
              />
            ) : (
              <div className="text-center py-12">
                <DocumentIcon className="w-16 h-16 mx-auto text-red-600 mb-4" />
                <h3 className="text-lg font-semibold text-black mb-2">
                  No checkpoints yet
                </h3>
                <p className="text-black mb-6">
                  Get started by creating your first checkpoint
                </p>
                <button
                  onClick={handleCreateCheckpoint}
                  className="px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700 border-2 border-black font-semibold"
                >
                  Create Checkpoint
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
