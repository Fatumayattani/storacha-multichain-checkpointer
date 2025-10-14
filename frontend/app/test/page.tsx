'use client'

import React, { useState } from 'react'
import { useStoracha } from '@/hooks/useStoracha'
import { verifyCIDAvailability, useCIDVerification, getIPFSUrl } from '@/utils/ipfsGateways'
import WalletConnector from '@/components/WalletConnector'

export default function TestPage() {
  const [testResults, setTestResults] = useState<string[]>([])
  const [testFile, setTestFile] = useState<File | null>(null)
  
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

  const clearResults = () => {
    setTestResults([])
    clearStorachaError()
    clearCIDError()
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">🧪 Storacha & IPFS Gateway Testing</h1>
      
      {/* Wallet Connection */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">1. Wallet Connection</h2>
        <WalletConnector />
      </div>

      {/* Test Controls */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">2. Test Controls</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <button
            onClick={testStorachaInit}
            disabled={isUploading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Test Storacha Init
          </button>
          
          <button
            onClick={testCIDVerification}
            disabled={isVerifying}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Test CID Verification
          </button>
          
          <button
            onClick={testInvalidCID}
            disabled={isVerifying}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            Test Invalid CID
          </button>
          
          <button
            onClick={clearResults}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Results
          </button>
        </div>

        {/* File Upload Test */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">File Upload Test</h3>
          <div className="flex gap-4 items-center">
            <input
              type="file"
              onChange={(e) => setTestFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={testFileUpload}
              disabled={!testFile || isUploading || !client}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 whitespace-nowrap"
            >
              {isUploading ? 'Uploading...' : 'Test Upload'}
            </button>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Storacha Status</h3>
          <div className={`text-sm ${client ? 'text-green-600' : 'text-gray-500'}`}>
            {client ? '✅ Client Ready' : '⏳ Not Initialized'}
          </div>
          {isUploading && (
            <div className="text-sm text-blue-600 mt-1">
              📤 Uploading... {uploadProgress?.percentage || 0}%
            </div>
          )}
          {storachaError && (
            <div className="text-sm text-red-600 mt-1">❌ {storachaError}</div>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">CID Verification</h3>
          <div className={`text-sm ${isVerifying ? 'text-blue-600' : 'text-gray-500'}`}>
            {isVerifying ? '🔄 Verifying...' : '⏳ Ready'}
          </div>
          {verificationResult && (
            <div className="text-sm text-green-600 mt-1">
              ✅ {verificationResult.successfulChecks}/{verificationResult.totalChecked} gateways
            </div>
          )}
          {cidError && (
            <div className="text-sm text-red-600 mt-1">❌ {cidError}</div>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Test File</h3>
          <div className="text-sm text-gray-600">
            {testFile ? `📄 ${testFile.name}` : '📄 No file selected'}
          </div>
          {testFile && (
            <div className="text-xs text-gray-500 mt-1">
              {(testFile.size / 1024).toFixed(1)} KB
            </div>
          )}
        </div>
      </div>

      {/* Test Results */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">3. Test Results</h2>
        <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
          {testResults.length === 0 ? (
            <div className="text-gray-500">Run tests to see results...</div>
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