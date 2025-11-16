import React from 'react'

export interface GatewayCheck {
  gateway: string
  available: boolean
  responseTime: number
  error?: string
}

export interface CIDVerificationResult {
  cid: string
  isAvailable: boolean
  gateways: GatewayCheck[]
  totalChecked: number
  successfulChecks: number
}

// List of IPFS gateways to check - prioritizing Storacha-compatible gateways
export const IPFS_GATEWAYS = [
  'https://w3s.link', // Primary Storacha gateway
  'https://storacha.link', // Official Storacha gateway
  'https://ipfs.io/ipfs', // IPFS.io public gateway
  'https://dweb.link/ipfs', // Protocol Labs gateway
  'https://cloudflare-ipfs.com/ipfs' // Cloudflare gateway
]

/**
 * Check if a CID is available on a specific IPFS gateway
 */
async function checkGateway(cid: string, gateway: string, timeout = 5000): Promise<GatewayCheck> {
  const startTime = Date.now()
  
  // Construct URL based on gateway format
  let url: string
  if (gateway.includes('w3s.link') || gateway.includes('storacha.link')) {
    // Storacha gateways use subdomain format
    url = `https://${cid}.ipfs.${gateway.replace('https://', '')}`
  } else if (gateway.includes('cloudflare')) {
    // Cloudflare gateway format
    url = `${gateway}/${cid}`
  } else {
    // Traditional IPFS gateways use path format  
    url = `${gateway}/${cid}`
  }
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to avoid downloading content
      signal: controller.signal,
      cache: 'no-store'
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    const result = {
      gateway,
      available: response.ok,
      responseTime,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
    }
    
    console.log(`Gateway ${gateway}: ${response.ok ? '✅' : '❌'} ${response.status} (${responseTime}ms)`)
    return result
  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return {
      gateway,
      available: false,
      responseTime,
      error: errorMessage
    }
  }
}

/**
 * Verify CID availability across multiple IPFS gateways
 * 
 * SECURITY NOTE: This function only checks availability via HTTP HEAD requests.
 * For production use with sensitive data, consider implementing CAR-based
 * CID verification (similar to Storacha's decrypt-handler.js) to prevent
 * content tampering attacks. Current implementation is suitable for MVP.
 */
export async function verifyCIDAvailability(
  cid: string,
  gateways: string[] = IPFS_GATEWAYS,
  timeout = 5000
): Promise<CIDVerificationResult> {
  if (!cid || !cid.trim()) {
    throw new Error('CID is required')
  }
  
  // Clean the CID (remove any whitespace)
  const cleanCID = cid.trim()
  
  // Validate CID format (basic length and character check)
  // CIDs typically start with 'bafy', 'bafk', 'Qm', etc.
  if (cleanCID.length < 10 || !/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{52}|bafk[a-z2-7]{52})/.test(cleanCID)) {
    throw new Error('Invalid CID format - must be a valid IPFS CID')
  }
  
  console.log(`Verifying CID: ${cleanCID} across ${gateways.length} gateways`)
  
  // Check all gateways in parallel
  const gatewayChecks = await Promise.all(
    gateways.map(gateway => checkGateway(cleanCID, gateway, timeout))
  )
  
  const successfulChecks = gatewayChecks.filter(check => check.available).length
  const isAvailable = successfulChecks > 0
  
  return {
    cid: cleanCID,
    isAvailable,
    gateways: gatewayChecks,
    totalChecked: gateways.length,
    successfulChecks
  }
}

/**
 * Get the fastest responding gateway for a CID
 */
export function getFastestGateway(verificationResult: CIDVerificationResult): GatewayCheck | null {
  const availableGateways = verificationResult.gateways.filter(g => g.available)
  
  if (availableGateways.length === 0) {
    return null
  }
  
  return availableGateways.reduce((fastest, current) => 
    current.responseTime < fastest.responseTime ? current : fastest
  )
}

/**
 * Generate a public IPFS URL for a CID using the fastest gateway
 */
export function getIPFSUrl(cid: string, verificationResult?: CIDVerificationResult): string {
  let gateway: string
  
  if (verificationResult) {
    const fastestGateway = getFastestGateway(verificationResult)
    if (fastestGateway) {
      gateway = fastestGateway.gateway
    } else {
      gateway = IPFS_GATEWAYS[0]
    }
  } else {
    gateway = IPFS_GATEWAYS[0]
  }
  
  // Construct URL based on gateway format
  if (gateway.includes('w3s.link') || gateway.includes('storacha.link')) {
    // Storacha gateways use subdomain format
    return `https://${cid}.ipfs.${gateway.replace('https://', '')}`
  } else {
    // Traditional IPFS gateways use path format
    return `${gateway}/${cid}`
  }
}

/**
 * Hook for CID verification with React state management
 */
export function useCIDVerification() {
  const [isVerifying, setIsVerifying] = React.useState(false)
  const [verificationResult, setVerificationResult] = React.useState<CIDVerificationResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  
  const verifyCID = React.useCallback(async (cid: string) => {
    setIsVerifying(true)
    setError(null)
    setVerificationResult(null)
    
    try {
      const result = await verifyCIDAvailability(cid)
      setVerificationResult(result)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsVerifying(false)
    }
  }, [])
  
  return {
    isVerifying,
    verificationResult,
    error,
    verifyCID,
    clearError: () => setError(null)
  }
}

