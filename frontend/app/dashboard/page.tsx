"use client";

import { useAccount, useReadContracts } from "wagmi";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import WalletConnector from "@/components/WalletConnector";
import {
  DocumentIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { formatAddress } from "@/lib/utils";
import { getChainName, getContractABI } from "@/lib/contracts";
import useStorachaCheckpointer from "@/hooks/useStorachaCheckpointer";

export default function DashboardPage() {
  const { address, isConnected, chain } = useAccount();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    contractAddress,
    nextCheckpointId,
    revokeCheckpoint,
    isCreating,
    refetchNextCheckpointId
  } = useStorachaCheckpointer();

  const checkpointIds = useMemo(() => {
    if (!nextCheckpointId) return [];
    const count = Number(nextCheckpointId) - 1;
    return Array.from({ length: count }, (_, i) => BigInt(i + 1)).reverse(); // Latest first
  }, [nextCheckpointId]);

  // Fetch all checkpoints
  const { data: checkpointsData, refetch: refetchCheckpoints } = useReadContracts({
    contracts: checkpointIds.map((id) => ({
      address: contractAddress as `0x${string}`,
      abi: getContractABI(),
      functionName: "checkpoints",
      args: [id],
    })) as any,
    query: {
      enabled: !!contractAddress && checkpointIds.length > 0,
    }
  });

  const checkpoints = useMemo(() => {
    if (!checkpointsData) return [];
    
    const results: any[] = [];
    checkpointsData.forEach((res, index) => {
      if (res.status === "success" && res.result) {
        const [user, cid, tag, expiresAt, timestamp, verified, revoked] = res.result as any;
        results.push({
          id: checkpointIds[index],
          user,
          cid,
          tag,
          expiresAt,
          timestamp,
          verified,
          revoked,
        });
      }
    });

    return results.filter((cp) => cp.user.toLowerCase() === address?.toLowerCase());
  }, [checkpointsData, checkpointIds, address]);

  const stats = useMemo(() => {
    const total = checkpoints.length;
    const active = checkpoints.filter(cp => !cp.revoked && Number(cp.expiresAt) > Date.now() / 1000).length;
    const revoked = checkpoints.filter(cp => cp.revoked).length;
    const expired = checkpoints.filter(cp => !cp.revoked && Number(cp.expiresAt) <= Date.now() / 1000).length;
    return { total, active, revoked, expired };
  }, [checkpoints]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchNextCheckpointId(), refetchCheckpoints()]);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleRevoke = async (id: bigint) => {
    try {
      if (confirm("Are you sure you want to revoke this checkpoint? This will also propagate to other chains if selected.")) {
        const publishToWormhole = confirm("Propagate revocation via Wormhole?");
        await revokeCheckpoint(id, publishToWormhole);
        handleRefresh();
      }
    } catch (error) {
      console.error("Revocation failed:", error);
    }
  };

  const handleCreateCheckpoint = () => {
    router.push('/test');
  };

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
            <div className="ml-auto flex gap-4">
              <button
                onClick={handleCreateCheckpoint}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 border-2 border-black font-semibold"
              >
                + New Checkpoint
              </button>
              <WalletConnector />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white border-2 border-black rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">Total</p>
                <p className="text-3xl font-bold mt-2 text-black">{stats.total}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg border-2 border-black">
                <DocumentIcon className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">Active</p>
                <p className="text-3xl font-bold mt-2 text-black">{stats.active}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg border-2 border-black">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">Revoked</p>
                <p className="text-3xl font-bold mt-2 text-black">{stats.revoked}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg border-2 border-black">
                <XCircleIcon className="w-8 h-8 text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">Expired</p>
                <p className="text-3xl font-bold mt-2 text-black">{stats.expired}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg border-2 border-black">
                <ClockIcon className="w-8 h-8 text-yellow-600" />
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
        <div className="bg-white border-2 border-black rounded-lg overflow-hidden">
          <div className="p-6 border-b-2 border-black flex items-center justify-between bg-gray-50">
            <h2 className="text-xl font-semibold text-black">Recent Checkpoints</h2>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`px-4 py-2 bg-black text-white rounded hover:bg-red-600 border-2 border-black inline-flex items-center gap-2 transition-all ${isRefreshing ? 'opacity-50' : ''}`}
            >
              <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="overflow-x-auto">
            {checkpoints.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-black">
                    <th className="p-4 font-bold text-black">ID</th>
                    <th className="p-4 font-bold text-black">CID</th>
                    <th className="p-4 font-bold text-black">Status</th>
                    <th className="p-4 font-bold text-black">Expires At</th>
                    <th className="p-4 font-bold text-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.map((cp) => {
                    const isExpired = Number(cp.expiresAt) <= Date.now() / 1000;
                    return (
                      <tr key={cp.id.toString()} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-mono text-sm">{cp.id.toString()}</td>
                        <td className="p-4 font-mono text-sm">
                          <span title={cp.cid}>{formatAddress(cp.cid)}</span>
                        </td>
                        <td className="p-4">
                          {cp.revoked ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
                              <XCircleIcon className="w-3 h-3 mr-1" />
                              Revoked
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                              <ClockIcon className="w-3 h-3 mr-1" />
                              Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                              <CheckCircleIcon className="w-3 h-3 mr-1" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-sm">
                          {new Date(Number(cp.expiresAt) * 1000).toLocaleString()}
                        </td>
                        <td className="p-4">
                          {!cp.revoked && !isExpired && (
                            <button
                              onClick={() => handleRevoke(cp.id)}
                              disabled={isCreating}
                              className="px-3 py-1 bg-white text-red-600 border border-red-600 rounded hover:bg-red-50 text-xs font-semibold disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <DocumentIcon className="w-16 h-16 mx-auto text-red-600 mb-4" />
                <h3 className="text-lg font-semibold text-black mb-2">No checkpoints yet</h3>
                <p className="text-black mb-6">Get started by creating your first checkpoint</p>
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
