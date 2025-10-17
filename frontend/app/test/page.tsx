'use client'

import React, { useState } from 'react'
import { useStoracha } from '@/hooks/useStoracha'
import { useStorachaCheckpointer } from '@/hooks/useStorachaCheckpointer'
import { verifyCIDAvailability, useCIDVerification, getIPFSUrl } from '@/utils/ipfsGateways'
import WalletConnector from '@/components/WalletConnector'
import { useAccount } from 'wagmi'

export default function TestPage() {
  const [testResults, setTestResults] = useState<string[]>([])
  const [testFile, setTestFile] = useState<File | null>(null)
  const [testCID, setTestCID] = useState<string>('')
  const [testTag, setTestTag] = useState<string>('test-checkpoint')
  const [testDuration, setTestDuration] = useState<number>(3600) // 1 hour
  
  // Account info
  const { isConnected, address, chain } = useAccount()
  
  // Storacha hook
  const { 
    client, 
    isUploading, 
    uploadProgress, 
    error: storachaError, 
    initializeClient, 
    uploadFile,
    clearError: clearStorachaError
  } = useStoracha()

  // Contract hook
  const {
    contractAddress,
    isContractAvailable,
    pricePerSecond,
    createCheckpoint,
    hash,
    isCreating,
    isConfirming,
    isSuccess,
    isError: isContractError,
    error: contractError,
    calculateCost,
    reset: resetContract,
    clearError: clearContractError
  } = useStorachaCheckpointer()

  // CID verification hook  
  const {
    isVerifying,
    verificationResult,
    error: cidError,
    clearError: clearCIDError
  } = useCIDVerification()

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`])
  }

  // Test 1: Initialize Storacha Client
  const testStorachaInit = async () => {
    try {
      addResult('🔄 Testing Storacha client initialization...')
      await initializeClient()
      addResult('✅ Storacha client initialized successfully!')
    } catch (error) {
      addResult(`❌ Storacha init failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Test 2: CID Verification with known good CID
  const testCIDVerification = async () => {
    try {
      // Use a known good CID (example from IPFS docs)
      const testCID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG' // "Hello World" example
      
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
        const url = getIPFSUrl(testCID, result)
        addResult(`🔗 Best URL: ${url}`)
      }
    } catch (error) {
      addResult(`❌ CID verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Test 3: File Upload (if client is initialized)
  const testFileUpload = async () => {
    if (!testFile) {
      addResult('❌ Please select a file first')
      return
    }

    if (!client) {
      addResult('❌ Storacha client not initialized. Run init test first.')
      return
    }

    try {
      addResult(`🔄 Testing file upload: ${testFile.name} (${testFile.size} bytes)`)
      const result = await uploadFile(testFile)
      
      addResult('✅ File uploaded successfully!')
      addResult(`   CID: ${result.cid}`)
      addResult(`   Size: ${result.size} bytes`)
      addResult(`   Name: ${result.name}`)

      // Now test verification of the uploaded CID
      addResult('🔄 Verifying uploaded CID...')
      const verification = await verifyCIDAvailability(result.cid)
      addResult(`   Verification: ${verification.isAvailable ? '✅ Available' : '❌ Not yet available'}`)
      
    } catch (error) {
      addResult(`❌ File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Test 4: Invalid CID handling
  const testInvalidCID = async () => {
    try {
      addResult('🔄 Testing invalid CID handling...')
      await verifyCIDAvailability('invalid-cid-123')
      addResult('❌ Should have thrown error for invalid CID')
    } catch (error) {
      addResult(`✅ Correctly rejected invalid CID: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Test 5: Contract Connection
  const testContractConnection = async () => {
    try {
      addResult('🔄 Testing contract connection...')
      
      if (!isConnected) {
        addResult('❌ Wallet not connected')
        return
      }
      
      addResult(`📍 Connected to: ${chain?.name || 'Unknown chain'}`)
      addResult(`💰 Wallet: ${address}`)
      addResult(`📜 Contract: ${contractAddress || 'Not available'}`)
      addResult(`✅ Contract Available: ${isContractAvailable ? 'Yes' : 'No (using mock)'}`)
      
      if (pricePerSecond) {
        addResult(`💰 Price per second: ${pricePerSecond.toString()} wei`)
      } else {
        addResult('💰 Price per second: Using fallback (0.001 ETH/sec)')
      }
      
      // Test cost calculation
      const cost = calculateCost(testDuration)
      addResult(`💵 Cost for ${testDuration}s: ${cost.toString()} wei (${(Number(cost) / 1e18).toFixed(6)} ETH)`)
      
    } catch (error) {
      addResult(`❌ Contract connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Test 6: Create Checkpoint (Mock)
  const testCreateCheckpoint = async () => {
    try {
      addResult('🔄 Testing checkpoint creation...')
      
      if (!isConnected) {
        addResult('❌ Wallet not connected')
        return
      }
      
      if (!testCID) {
        addResult('❌ Please enter a CID to test with')
        return
      }
      
      const params = {
        cid: testCID,
        tag: testTag,
        duration: testDuration,
        publishToWormhole: true
      }
      
      addResult(`📋 Checkpoint params:`)
      addResult(`   CID: ${params.cid}`)
      addResult(`   Tag: ${params.tag}`)
      addResult(`   Duration: ${params.duration}s (${Math.round(params.duration/3600)}h)`)
      addResult(`   Wormhole: ${params.publishToWormhole ? 'Yes' : 'No'}`)
      
      const cost = calculateCost(params.duration)
      addResult(`   Cost: ${(Number(cost) / 1e18).toFixed(6)} ETH`)
      
      if (!isContractAvailable) {
        addResult('⚠️ Using mock contract - would call createCheckpoint() with above params')
        addResult('✅ Mock checkpoint creation test passed!')
        return
      }
      
      // If real contract is available, try the actual call
      await createCheckpoint(params)
      addResult('🔄 Transaction submitted! Waiting for confirmation...')
      
    } catch (error) {
      addResult(`❌ Checkpoint creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Test 7: End-to-End Flow
  const testEndToEndFlow = async () => {
    try {
      addResult('🔄 Testing complete end-to-end flow...')
      
      // Step 1: Upload file to Storacha
      if (!testFile) {
        addResult('❌ Please select a file for end-to-end test')
        return
      }
      
      if (!client) {
        addResult('❌ Storacha client not initialized')
        return
      }
      
      if (!isConnected) {
        addResult('❌ Wallet not connected')
        return
      }
      
      addResult('📤 Step 1: Uploading to Storacha...')
      const uploadResult = await uploadFile(testFile)
      addResult(`✅ Upload successful! CID: ${uploadResult.cid}`)
      
      // Step 2: Verify CID
      addResult('🔍 Step 2: Verifying CID...')
      const verification = await verifyCIDAvailability(uploadResult.cid)
      addResult(`✅ CID verification: ${verification.isAvailable ? 'Available' : 'Not yet available'}`)
      
      // Step 3: Create checkpoint
      addResult('📋 Step 3: Creating checkpoint...')
      const checkpointParams = {
        cid: uploadResult.cid,
        tag: `file-${Date.now()}`,
        duration: testDuration,
        publishToWormhole: true
      }
      
      if (!isContractAvailable) {
        addResult('⚠️ Mock contract - would create checkpoint here')
        addResult('✅ End-to-end flow test completed!')
      } else {
        await createCheckpoint(checkpointParams)
        addResult('✅ End-to-end flow initiated! Check wallet for transaction.')
      }
      
    } catch (error) {
      addResult(`❌ End-to-end flow failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const clearResults = () => {
    setTestResults([])
    clearStorachaError()
    clearCIDError() 
    clearContractError()
    resetContract()
  }

  return (
    <div className="min-h-screen" style={{backgroundColor: '#eee4f2'}}>
      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-black">🧪 Storacha & IPFS Gateway Testing</h1>
      
        {/* Wallet Connection */}
        <div className="bg-white border-2 border-black rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-black">1. Wallet Connection</h2>
          <WalletConnector />
        </div>

        {/* Test Controls */}
        <div className="bg-white border-2 border-black rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-black">2. Test Controls</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <button
              onClick={testStorachaInit}
              disabled={isUploading}
              className="px-4 py-2 bg-black text-white rounded hover:bg-red-600 disabled:opacity-50 border-2 border-black"
            >
              Test Storacha Init
            </button>
            
            <button
              onClick={testCIDVerification}
              disabled={isVerifying}
              className="px-4 py-2 bg-black text-white rounded hover:bg-red-600 disabled:opacity-50 border-2 border-black"
            >
              Test CID Verification
            </button>
            
            <button
              onClick={testContractConnection}
              disabled={!isConnected}
              className="px-4 py-2 bg-black text-white rounded hover:bg-red-600 disabled:opacity-50 border-2 border-black"
            >
              Test Contract
            </button>
            
            <button
              onClick={testInvalidCID}
              disabled={isVerifying}
              className="px-4 py-2 bg-black text-white rounded hover:bg-red-600 disabled:opacity-50 border-2 border-black"
            >
              Test Invalid CID
            </button>
            
            <button
              onClick={testCreateCheckpoint}
              disabled={!isConnected || isCreating}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 border-2 border-black"
            >
              {isCreating ? 'Creating...' : 'Create Checkpoint'}
            </button>
            
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-black text-white rounded hover:bg-red-600 border-2 border-black"
            >
              Clear Results
            </button>
          </div>

          {/* File Upload Test */}
          <div className="border-t-2 border-black pt-4 mb-4">
            <h3 className="font-medium mb-2 text-black">File Upload Test</h3>
            <div className="flex gap-4 items-center">
              <input
                type="file"
                onChange={(e) => setTestFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded file:border-2 file:border-black file:text-sm file:font-semibold file:bg-white file:text-black hover:file:bg-red-50"
              />
              <button
                onClick={testFileUpload}
                disabled={!testFile || isUploading || !client}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 whitespace-nowrap border-2 border-black"
              >
                {isUploading ? 'Uploading...' : 'Test Upload'}
              </button>
            </div>
          </div>

          {/* Contract Test Inputs */}
          <div className="border-t-2 border-black pt-4">
            <h3 className="font-medium mb-2 text-black">Contract Test Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Test CID</label>
                <input
                  type="text"
                  value={testCID}
                  onChange={(e) => setTestCID(e.target.value)}
                  placeholder="Enter CID to test with..."
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Tag</label>
                <input
                  type="text"
                  value={testTag}
                  onChange={(e) => setTestTag(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Duration (seconds)</label>
                <input
                  type="number"
                  value={testDuration}
                  onChange={(e) => setTestDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-black"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={testEndToEndFlow}
                disabled={!testFile || !client || !isConnected || isUploading || isCreating}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 whitespace-nowrap border-2 border-black"
              >
                {isUploading || isCreating ? 'Processing...' : '🚀 Full E2E Test'}
              </button>
              <div className="text-sm text-black flex items-center">
                Upload → Verify → Checkpoint
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border-2 border-black rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-black">Storacha Status</h3>
          <div className={`text-sm ${client ? 'text-black' : 'text-red-600'}`}>
            {client ? '✅ Client Ready' : '⏳ Not Initialized'}
          </div>
          {isUploading && (
            <div className="text-sm text-black mt-1">
              📤 Uploading... {uploadProgress?.percentage || 0}%
            </div>
          )}
          {storachaError && (
            <div className="text-sm text-red-600 mt-1">❌ {storachaError}</div>
          )}
        </div>

        <div className="bg-white border-2 border-black rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-black">CID Verification</h3>
          <div className={`text-sm ${isVerifying ? 'text-black' : 'text-red-600'}`}>
            {isVerifying ? '🔄 Verifying...' : '⏳ Ready'}
          </div>
          {verificationResult && (
            <div className="text-sm text-black mt-1">
              ✅ {verificationResult.successfulChecks}/{verificationResult.totalChecked} gateways
            </div>
          )}
          {cidError && (
            <div className="text-sm text-red-600 mt-1">❌ {cidError}</div>
          )}
        </div>

        <div className="bg-white border-2 border-black rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-black">Contract Status</h3>
          <div className={`text-sm ${isConnected ? 'text-black' : 'text-red-600'}`}>
            {isConnected ? `✅ ${chain?.name}` : '⏳ Not Connected'}
          </div>
          <div className={`text-sm ${isContractAvailable ? 'text-black' : 'text-red-600'} mt-1`}>
            {isContractAvailable ? '📜 Contract Ready' : '📜 Mock Contract'}
          </div>
          {isCreating && (
            <div className="text-sm text-black mt-1">🔄 Creating...</div>
          )}
          {isConfirming && (
            <div className="text-sm text-black mt-1">⏳ Confirming...</div>
          )}
          {isSuccess && (
            <div className="text-sm text-black mt-1">✅ Success!</div>
          )}
          {contractError && (
            <div className="text-sm text-red-600 mt-1">❌ {contractError}</div>
          )}
        </div>

        <div className="bg-white border-2 border-black rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-black">Test File</h3>
          <div className="text-sm text-black">
            {testFile ? `📄 ${testFile.name}` : '📄 No file selected'}
          </div>
          {testFile && (
            <div className="text-xs text-red-600 mt-1">
              {(testFile.size / 1024).toFixed(1)} KB
            </div>
          )}
        </div>
      </div>

      {/* Test Results */}
      <div className="bg-white border-2 border-black rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-black">3. Test Results</h2>
        <div className="bg-black text-white p-4 rounded font-mono text-sm max-h-96 overflow-y-auto border-2 border-black">
          {testResults.length === 0 ? (
            <div className="text-red-600">Run tests to see results...</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1">{result}</div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
