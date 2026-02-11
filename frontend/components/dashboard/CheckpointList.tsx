"use client";

import { useReadContract } from "wagmi";
import { 
  DocumentIcon, 
  ClockIcon, 
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import { getContractABI } from "@/lib/contracts";
import Badge from "../ui/Badge";

interface CheckpointListProps {
  contractAddress: `0x${string}`;
  checkpointIds: bigint[];
}

function CheckpointRow({ 
  id, 
  contractAddress 
}: { 
  id: bigint; 
  contractAddress: `0x${string}` 
}) {
  const { data, isLoading, isError } = useReadContract({
    address: contractAddress,
    abi: getContractABI(),
    functionName: "checkpoints",
    args: [id],
  });

  if (isLoading) {
    return (
      <div className="animate-pulse flex items-center justify-between p-4 border-b-2 border-black last:border-b-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-neutral-200 rounded-lg border-2 border-black" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-neutral-200 rounded" />
            <div className="h-3 w-48 bg-neutral-200 rounded" />
          </div>
        </div>
        <div className="w-24 h-8 bg-neutral-200 rounded-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-4 border-b-2 border-black last:border-b-0 flex items-center gap-2 text-red-600">
        <ExclamationTriangleIcon className="w-5 h-5" />
        <span className="text-sm">Failed to load checkpoint #{id.toString()}</span>
      </div>
    );
  }

  const checkpoint = data as unknown as [string, string, `0x${string}`, bigint, bigint, boolean];
  const [, cid, tag, expiresAt, timestamp, verified] = checkpoint;

  const isExpired = Number(expiresAt) * 1000 < Date.now();
  const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;

  return (
    <div className="p-4 border-b-2 border-black last:border-b-0 hover:bg-neutral-50 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-100 rounded-lg border-2 border-black shrink-0">
            <DocumentIcon className="w-6 h-6 text-red-600" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-black truncate max-w-[200px] md:max-w-md">
                {cid}
              </span>
              <a 
                href={ipfsUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-neutral-500 hover:text-red-600 transition-colors"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                Created {formatDistanceToNow(Number(timestamp) * 1000)} ago
              </span>
              <span className="flex items-center gap-1">
                <Badge variant="secondary" size="sm" className="font-mono text-[10px] border-black/10">
                  Tag: {tag.substring(0, 10)}...
                </Badge>
              </span>
              <span className="font-mono bg-neutral-100 px-1 rounded">
                ID: {id.toString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <div className="text-right mr-2 hidden md:block">
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Expires</p>
            <p className={`text-sm font-bold ${isExpired ? 'text-red-600' : 'text-black'}`}>
              {new Date(Number(expiresAt) * 1000).toLocaleDateString()}
            </p>
          </div>
          
          <Badge 
            variant={verified ? "success" : "warning"} 
            className="border-2 border-black font-bold uppercase tracking-tight"
          >
            {verified ? "Verified" : "Pending"}
          </Badge>

          {isExpired && (
            <Badge 
              variant="error" 
              className="border-2 border-black font-bold uppercase tracking-tight"
            >
              Expired
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckpointList({ 
  contractAddress, 
  checkpointIds 
}: CheckpointListProps) {
  // Sort IDs in descending order to show newest first
  const sortedIds = [...checkpointIds].sort((a, b) => Number(b - a));

  if (sortedIds.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="w-16 h-16 mx-auto text-red-600 mb-4" />
        <h3 className="text-lg font-semibold text-black mb-2">
          No checkpoints yet
        </h3>
        <p className="text-black mb-6">
          Get started by creating your first checkpoint
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-black">
      {sortedIds.map((id) => (
        <CheckpointRow 
          key={id.toString()} 
          id={id} 
          contractAddress={contractAddress} 
        />
      ))}
    </div>
  );
}
