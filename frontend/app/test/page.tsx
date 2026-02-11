"use client";

import React, { useState } from 'react'
import { useStoracha } from '@/hooks/useStoracha'
import { useStorachaCheckpointer } from '@/hooks/useStorachaCheckpointer'
import { verifyCIDAvailability, useCIDVerification, getIPFSUrl } from '@/utils/ipfsGateways'
import WalletConnector from '@/components/WalletConnector'
import { useAccount } from 'wagmi'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function TestPage() {
  const [testResults, setTestResults] = useState<string[]>([])
  const [testFile, setTestFile] = useState<File | null>(null)
  const [testCID, setTestCID] = useState<string>('')
  const [testTag, setTestTag] = useState<string>('test-checkpoint')
  const [testDuration, setTestDuration] = useState<number>(3600) // 1 hour
  const [revokeId, setRevokeId] = useState<string>('')
  const [propagateRevocation, setPropagateRevocation] = useState<boolean>(true)
  const [storachaEmail, setStorachaEmail] = useState<string>('')
  const [delegationProof, setDelegationProof] = useState<string>('')
  
  const { isConnected, address, chain } = useAccount()
  
  const { 
    client, 
    isUploading, 
    uploadProgress, 
    error: storachaError, 
    initializeClient, 
    uploadFile,
    addExistingSpace,
    clearError: clearStorachaError,
  } = useStoracha();

  const {
    contractAddress,
    isContractAvailable,
    pricePerSecond,
    createCheckpoint,
    revokeCheckpoint,
    isCreating,
    isConfirming,
    isSuccess,
    error: contractError,
    calculateCost,
    reset: resetContract,
    clearError: clearContractError,
  } = useStorachaCheckpointer();

  const {
    isVerifying,
    verificationResult,
    error: cidError,
    clearError: clearCIDError,
  } = useCIDVerification();

  const addResult = (result: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  const testStorachaInit = async () => {
    try {
      addResult("🔄 Testing Storacha client initialization...");
      if (storachaEmail) {
        addResult(`📧 Logging in with: ${storachaEmail}`);
        addResult(
          "⚠️ Check your email for verification link if this is first time!"
        );
      }
      await initializeClient(storachaEmail || undefined);
      addResult("✅ Storacha client initialized successfully!");
      const currentSpaceDid = client?.currentSpace()?.did();
      if (currentSpaceDid) {
        addResult(`📍 Using space: ${currentSpaceDid}`);
      }
    } catch (error) {
      addResult(
        `❌ Storacha init failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // Test 1b: Import Existing Space
  const testImportSpace = async () => {
    try {
      if (!delegationProof) {
        addResult("❌ Please paste your delegation proof first");
        return;
      }

      if (!client) {
        addResult(
          '❌ Please initialize Storacha client first (click "Test Storacha Init")'
        );
        return;
      }

      addResult("🔄 Importing existing space from delegation...");

      // Parse the delegation proof (could be JSON string)
      let proof;
      try {
        proof = JSON.parse(delegationProof);
      } catch {
        // If not JSON, try to use as-is
        proof = delegationProof;
      }

      const space = await addExistingSpace(proof);
      addResult("✅ Space imported successfully!");
      addResult(`📍 Space DID: ${space.did()}`);
    } catch (error) {
      addResult(
        `❌ Import space failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const testCIDVerification = async () => {
    try {
      const testCID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
      
      addResult(`🔄 Testing CID verification for: ${testCID}`)
      const result = await verifyCIDAvailability(testCID)
      
      addResult(`📊 CID Verification Results:`)
      addResult(`   Available: ${result.isAvailable ? '✅ Yes' : '❌ No'}`)
      addResult(`   Successful checks: ${result.successfulChecks}/${result.totalChecked}`)
      
      result.gateways.forEach(gateway => {
        const status = gateway.available ? '✅' : '❌'
        addResult(`   ${status} ${gateway.gateway} (${gateway.responseTime}ms)`)
      })

      if (result.isAvailable) {
        const url = getIPFSUrl(testCID, result);
        addResult(`🔗 Best URL: ${url}`);
      }
    } catch (error) {
      addResult(
        `❌ CID verification failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const testFileUpload = async () => {
    if (!testFile) {
      addResult("❌ Please select a file first");
      return;
    }

    if (!client) {
      addResult("❌ Storacha client not initialized. Run init test first.");
      return;
    }

    try {
      addResult(
        `🔄 Testing file upload: ${testFile.name} (${testFile.size} bytes)`
      );
      const result = await uploadFile(testFile);

      addResult("✅ File uploaded successfully!");
      addResult(`   CID: ${result.cid}`);
      addResult(`   Size: ${result.size} bytes`);
      addResult(`   Name: ${result.name}`);

      addResult('🔄 Verifying uploaded CID...')
      const verification = await verifyCIDAvailability(result.cid)
      addResult(`   Verification: ${verification.isAvailable ? '✅ Available' : '❌ Not yet available'}`)
      
    } catch (error) {
      addResult(
        `❌ File upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const testInvalidCID = async () => {
    try {
      addResult("🔄 Testing invalid CID handling...");
      await verifyCIDAvailability("invalid-cid-123");
      addResult("❌ Should have thrown error for invalid CID");
    } catch (error) {
      addResult(
        `✅ Correctly rejected invalid CID: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const testContractConnection = async () => {
    try {
      addResult("🔄 Testing contract connection...");

      if (!isConnected) {
        addResult("❌ Wallet not connected");
        return;
      }

      addResult(`📍 Connected to: ${chain?.name || "Unknown chain"}`);
      addResult(`💰 Wallet: ${address}`);
      addResult(`📜 Contract: ${contractAddress || "Not available"}`);
      addResult(
        `✅ Contract Available: ${isContractAvailable ? "Yes" : "No (using mock)"}`
      );

      if (pricePerSecond) {
        addResult(`💰 Price per second: ${pricePerSecond.toString()} wei`);
      } else {
        addResult("💰 Price per second: Using fallback (0.001 ETH/sec)");
      }
      
      const cost = calculateCost(testDuration)
      addResult(`💵 Cost for ${testDuration}s: ${cost.toString()} wei (${(Number(cost) / 1e18).toFixed(6)} ETH)`)
      
    } catch (error) {
      addResult(
        `❌ Contract connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const testCreateCheckpoint = async () => {
    try {
      addResult("🔄 Testing checkpoint creation...");

      if (!isConnected) {
        addResult("❌ Wallet not connected");
        return;
      }

      if (!testCID) {
        addResult("❌ Please enter a CID to test with");
        return;
      }

      const params = {
        cid: testCID,
        tag: testTag,
        duration: testDuration,
        publishToWormhole: true,
      };

      addResult(`📋 Checkpoint params:`);
      addResult(`   CID: ${params.cid}`);
      addResult(`   Tag: ${params.tag}`);
      addResult(
        `   Duration: ${params.duration}s (${Math.round(params.duration / 3600)}h)`
      );
      addResult(`   Wormhole: ${params.publishToWormhole ? "Yes" : "No"}`);

      const cost = calculateCost(params.duration, params.publishToWormhole);
      addResult(`   Cost: ${(Number(cost) / 1e18).toFixed(6)} ETH`);

      if (!isContractAvailable) {
        addResult(
          "⚠️ Using mock contract - would call createCheckpoint() with above params"
        );
        addResult("✅ Mock checkpoint creation test passed!");
        return;
      }
      
      await createCheckpoint(params)
      addResult('🔄 Transaction submitted! Waiting for confirmation...')
      
    } catch (error) {
      addResult(
        `❌ Checkpoint creation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const testRevokeCheckpoint = async () => {
    try {
      addResult("🔄 Testing checkpoint revocation...");

      if (!isConnected) {
        addResult("❌ Wallet not connected");
        return;
      }

      if (!revokeId) {
        addResult("❌ Please enter a Checkpoint ID to revoke");
        return;
      }

      const id = BigInt(revokeId);
      addResult(`📋 Revocation params:`);
      addResult(`   ID: ${id.toString()}`);
      addResult(`   Propagate: ${propagateRevocation ? "Yes" : "No"}`);

      if (!isContractAvailable) {
        addResult(
          "⚠️ Using mock contract - would call revokeCheckpoint() with above params"
        );
        addResult("✅ Mock checkpoint revocation test passed!");
        return;
      }

      await revokeCheckpoint(id, propagateRevocation);
      addResult('🔄 Revocation transaction submitted! Waiting for confirmation...');
    } catch (error) {
      addResult(
        `❌ Checkpoint revocation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const testEndToEndFlow = async () => {
    try {
      addResult('🔄 Testing complete end-to-end flow...')
      
      if (!testFile) {
        addResult("❌ Please select a file for end-to-end test");
        return;
      }

      if (!client) {
        addResult("❌ Storacha client not initialized");
        return;
      }

      if (!isConnected) {
        addResult("❌ Wallet not connected");
        return;
      }
      
      addResult('📤 Step 1: Uploading to Storacha...')
      const uploadResult = await uploadFile(testFile)
      addResult(`✅ Upload successful! CID: ${uploadResult.cid}`)
      
      addResult('🔍 Step 2: Verifying CID...')
      const verification = await verifyCIDAvailability(uploadResult.cid)
      addResult(`✅ CID verification: ${verification.isAvailable ? 'Available' : 'Not yet available'}`)
      
      addResult('📋 Step 3: Creating checkpoint...')
      const checkpointParams = {
        cid: uploadResult.cid,
        tag: `file-${Date.now()}`,
        duration: testDuration,
        publishToWormhole: true,
      };

      if (!isContractAvailable) {
        addResult("⚠️ Mock contract - would create checkpoint here");
        addResult("✅ End-to-end flow test completed!");
      } else {
        await createCheckpoint(checkpointParams);
        addResult(
          "✅ End-to-end flow initiated! Check wallet for transaction."
        );
      }
    } catch (error) {
      addResult(
        `❌ End-to-end flow failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const clearResults = () => {
    setTestResults([]);
    clearStorachaError();
    clearCIDError();
    clearContractError();
    resetContract();
  };

  return (
    <div className="min-h-screen">
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-foreground">🧪 Storacha & IPFS Gateway Testing</h1>
      
        <div className="bg-card-bg border-2 border-card-border rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-foreground">1. Wallet Connection</h2>
          <WalletConnector />
        </div>

        <div className="bg-card-bg border-2 border-card-border rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-foreground">2. Storacha Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Storacha Email (Optional)</label>
              <input
                type="email"
                value={storachaEmail}
                onChange={(e) => setStorachaEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-3 py-2 border-2 border-card-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-input-bg text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Delegation Proof (JSON)</label>
              <textarea
                value={delegationProof}
                onChange={(e) => setDelegationProof(e.target.value)}
                placeholder='Paste delegation proof JSON here...'
                className="w-full px-3 py-2 border-2 border-card-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-input-bg text-foreground h-11 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={testStorachaInit}
              disabled={isUploading}
              className="px-4 py-2 bg-foreground text-background rounded hover:bg-accent disabled:opacity-50 border-2 border-card-border transition-colors"
            >
              Init Storacha Client
            </button>
            <button
              onClick={testImportSpace}
              disabled={!delegationProof || !client}
              className="px-4 py-2 bg-foreground text-background rounded hover:bg-accent disabled:opacity-50 border-2 border-card-border transition-colors"
            >
              Import Space
            </button>
          </div>
        </div>

        <div className="bg-card-bg border-2 border-card-border rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-foreground">3. Test Controls</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <button
              onClick={testCIDVerification}
              disabled={isVerifying}
              className="px-4 py-2 bg-foreground text-background rounded hover:bg-accent disabled:opacity-50 border-2 border-card-border transition-colors"
            >
              Test CID Verification
            </button>

            <button
              onClick={testContractConnection}
              disabled={!isConnected}
              className="px-4 py-2 bg-foreground text-background rounded hover:bg-accent disabled:opacity-50 border-2 border-card-border transition-colors"
            >
              Test Contract
            </button>

            <button
              onClick={testInvalidCID}
              disabled={isVerifying}
              className="px-4 py-2 bg-foreground text-background rounded hover:bg-accent disabled:opacity-50 border-2 border-card-border transition-colors"
            >
              Test Invalid CID
            </button>

            <button
              onClick={testCreateCheckpoint}
              disabled={!isConnected || isCreating}
              className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 border-2 border-card-border transition-colors"
            >
              {isCreating ? "Creating..." : "Create Checkpoint"}
            </button>

            <button
              onClick={testRevokeCheckpoint}
              disabled={!isConnected || isCreating}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 border-2 border-card-border transition-colors"
            >
              {isCreating ? "Revoking..." : "Revoke Checkpoint"}
            </button>

            <button
              onClick={clearResults}
              className="px-4 py-2 bg-foreground text-background rounded hover:bg-accent border-2 border-card-border transition-colors"
            >
              Clear Results
            </button>
          </div>

          <div className="border-t-2 border-card-border pt-4 mb-4">
            <h3 className="font-medium mb-2 text-foreground">File Upload Test</h3>
            <div className="flex gap-4 items-center">
              <input
                type="file"
                onChange={(e) => setTestFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-2 file:border-card-border file:text-sm file:font-semibold file:bg-card-bg file:text-foreground hover:file:bg-accent hover:file:text-white transition-colors"
              />
              <button
                onClick={testFileUpload}
                disabled={!testFile || isUploading || !client}
                className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 whitespace-nowrap border-2 border-card-border transition-colors"
              >
                {isUploading ? "Uploading..." : "Test Upload"}
              </button>
            </div>
          </div>

          <div className="border-t-2 border-card-border pt-4">
            <h3 className="font-medium mb-2 text-foreground">Contract Test Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Test CID</label>
                <input
                  type="text"
                  value={testCID}
                  onChange={(e) => setTestCID(e.target.value)}
                  placeholder="Enter CID to test with..."
                  className="w-full px-3 py-2 border-2 border-card-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-input-bg text-foreground placeholder:text-foreground-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tag</label>
                <input
                  type="text"
                  value={testTag}
                  onChange={(e) => setTestTag(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-card-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-input-bg text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Duration (seconds)</label>
                <input
                  type="number"
                  value={testDuration}
                  onChange={(e) => setTestDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-card-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-input-bg text-foreground"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pt-4 border-t-2 border-card-border">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Revoke Checkpoint ID</label>
                <input
                  type="text"
                  value={revokeId}
                  onChange={(e) => setRevokeId(e.target.value)}
                  placeholder="ID to revoke..."
                  className="w-full px-3 py-2 border-2 border-card-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-input-bg text-foreground"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={propagateRevocation}
                    onChange={(e) => setPropagateRevocation(e.target.checked)}
                    className="w-4 h-4 rounded border-card-border text-accent focus:ring-accent"
                  />
                  Propagate via Wormhole
                </label>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={testEndToEndFlow}
                disabled={!testFile || !client || !isConnected || isUploading || isCreating}
                className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 whitespace-nowrap border-2 border-card-border transition-colors"
              >
                {isUploading || isCreating
                  ? "Processing..."
                  : "🚀 Full E2E Test"}
              </button>
              <div className="text-sm text-foreground-muted flex items-center">
                Upload → Verify → Checkpoint
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card-bg border-2 border-card-border rounded-lg p-4 shadow-lg">
            <h3 className="font-semibold mb-2 text-foreground">Storacha Status</h3>
            <div className={`text-sm ${client ? 'text-success' : 'text-accent'}`}>
              {client ? '✅ Client Ready' : '⏳ Not Initialized'}
            </div>
            {isUploading && (
              <div className="text-sm text-foreground-muted mt-1">
                📤 Uploading... {uploadProgress?.percentage || 0}%
              </div>
            )}
            {storachaError && (
              <div className="text-sm text-accent mt-1">❌ {storachaError}</div>
            )}
          </div>

          <div className="bg-card-bg border-2 border-card-border rounded-lg p-4 shadow-lg">
            <h3 className="font-semibold mb-2 text-foreground">CID Verification</h3>
            <div className={`text-sm ${isVerifying ? 'text-foreground-muted' : 'text-success'}`}>
              {isVerifying ? '🔄 Verifying...' : '⏳ Ready'}
            </div>
            {verificationResult && (
              <div className="text-sm text-success mt-1">
                ✅ {verificationResult.successfulChecks}/{verificationResult.totalChecked} gateways
              </div>
            )}
            {cidError && (
              <div className="text-sm text-accent mt-1">❌ {cidError}</div>
            )}
          </div>

          <div className="bg-card-bg border-2 border-card-border rounded-lg p-4 shadow-lg">
            <h3 className="font-semibold mb-2 text-foreground">Contract Status</h3>
            <div className={`text-sm ${isConnected ? 'text-success' : 'text-accent'}`}>
              {isConnected ? `✅ ${chain?.name}` : '⏳ Not Connected'}
            </div>
            <div className={`text-sm ${isContractAvailable ? 'text-success' : 'text-foreground-muted'} mt-1`}>
              {isContractAvailable ? '📜 Contract Ready' : '📜 Mock Contract'}
            </div>
            {isCreating && (
              <div className="text-sm text-foreground-muted mt-1">🔄 Creating...</div>
            )}
            {isConfirming && (
              <div className="text-sm text-foreground-muted mt-1">⏳ Confirming...</div>
            )}
            {isSuccess && (
              <div className="text-sm text-success mt-1">✅ Success!</div>
            )}
            {contractError && (
              <div className="text-sm text-accent mt-1">❌ {contractError}</div>
            )}
          </div>

          <div className="bg-card-bg border-2 border-card-border rounded-lg p-4 shadow-lg">
            <h3 className="font-semibold mb-2 text-foreground">Test File</h3>
            <div className="text-sm text-foreground">
              {testFile ? `📄 ${testFile.name}` : '📄 No file selected'}
            </div>
            {testFile && (
              <div className="text-xs text-foreground-muted mt-1">
                {(testFile.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>
        </div>

        <div className="bg-card-bg border-2 border-card-border rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-foreground">3. Test Results</h2>
          <div className="bg-background-secondary dark:bg-[#0a0a12] p-4 rounded font-mono text-sm max-h-96 overflow-y-auto border-2 border-card-border text-foreground">
            {testResults.length === 0 ? (
              <div className="text-foreground-muted">Run tests to see results...</div>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="mb-1">{result}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
