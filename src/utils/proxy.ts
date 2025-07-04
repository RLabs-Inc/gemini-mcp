/**
 * Proxy Configuration - Handles HTTP/HTTPS proxy settings
 * 
 * This module configures proxy support for the Gemini API client
 * using the standard http_proxy and https_proxy environment variables.
 */

import { ProxyAgent } from 'undici'
import { logger } from './logger.js'

/**
 * Configure global fetch to use proxy if environment variables are set
 */
export async function configureProxy(): Promise<void> {
  const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY
  const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY
  const noProxy = process.env.no_proxy || process.env.NO_PROXY
  
  const proxyUrl = httpsProxy || httpProxy
  
  if (!proxyUrl) {
    logger.debug('No proxy configuration found')
    return
  }
  
  logger.info(`Configuring proxy: ${proxyUrl}`)
  
  // Parse no_proxy hosts
  const noProxyHosts = noProxy ? noProxy.split(',').map(h => h.trim().toLowerCase()) : []
  
  // Check if Gemini API should bypass proxy
  const geminiHosts = ['generativelanguage.googleapis.com', 'aiplatform.googleapis.com']
  const shouldBypassProxy = geminiHosts.some(host => 
    noProxyHosts.some(noProxyHost => {
      // Handle various no_proxy formats
      if (noProxyHost === host) return true
      if (noProxyHost.startsWith('.') && host.endsWith(noProxyHost)) return true
      if (noProxyHost.startsWith('*') && host.endsWith(noProxyHost.slice(1))) return true
      // Handle domain suffix without leading dot
      if (!noProxyHost.includes('*') && !noProxyHost.startsWith('.') && host.endsWith('.' + noProxyHost)) return true
      return false
    })
  )
  
  if (shouldBypassProxy) {
    logger.info('Gemini API hosts are in no_proxy list, bypassing proxy')
    return
  }
  
  logger.debug(`Gemini API will use proxy (not in no_proxy: ${noProxyHosts.join(', ')})`)
  
  try {
    // Create undici ProxyAgent which works with native fetch
    const dispatcher = new ProxyAgent({
      uri: proxyUrl,
      connect: {
        timeout: 30000, // 30 second timeout
      },
    })
    
    // Override global dispatcher for undici
    const { setGlobalDispatcher } = await import('undici')
    
    // Set the proxy agent as global dispatcher
    // For simplicity, we'll use the ProxyAgent directly without no_proxy handling
    // as undici's ProxyAgent doesn't easily support selective proxy bypass
    setGlobalDispatcher(dispatcher)
    
    logger.info('Proxy configuration completed successfully')
  } catch (error) {
    logger.error('Failed to configure proxy:', error)
    throw new Error(`Failed to configure proxy: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Get proxy information for logging
 */
export function getProxyInfo(): string | null {
  const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY
  const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY
  const noProxy = process.env.no_proxy || process.env.NO_PROXY
  
  if (!httpProxy && !httpsProxy) {
    return null
  }
  
  const info: string[] = []
  if (httpsProxy) info.push(`HTTPS_PROXY: ${httpsProxy}`)
  if (httpProxy && httpProxy !== httpsProxy) info.push(`HTTP_PROXY: ${httpProxy}`)
  if (noProxy) info.push(`NO_PROXY: ${noProxy}`)
  
  return info.join(', ')
}