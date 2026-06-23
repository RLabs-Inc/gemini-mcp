#!/usr/bin/env node

/**
 * Gemini - Dual Mode Entry Point
 *
 * 1. MCP Server Mode (default): `gemini-mcp` or `gemini serve`
 * 2. CLI Mode: `gcli <command> [options]`
 *
 * This integrates Google's Gemini models with Claude Code (MCP)
 * and provides a beautiful standalone CLI experience.
 */

import { runCli } from './cli/index.js'
import { startMcpServer } from './server.js'

// --- Global HTTP proxy injection for Node.js native fetch ---
// Node.js's built-in fetch (powered by undici) does NOT automatically read
// HTTP_PROXY / HTTPS_PROXY. We manually inject a ProxyAgent as the global
// undici dispatcher so all downstream network calls (including @google/genai)
// go through the proxy, which is essential for developers behind firewalls.
import { createRequire } from 'node:module'

;(function setupGlobalProxy(): void {
  const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY
  if (!proxyUrl) return

  try {
    const req = createRequire(import.meta.url)
    const { ProxyAgent } = req('undici') as { ProxyAgent: new (uri: string) => unknown }
    const dispatcher = new ProxyAgent(proxyUrl)
    // This symbol is the stable hook undici exposes to replace its global dispatcher.
    // Node 18+ uses undici internally; the symbol is the same regardless of whether
    // undici is bundled by Node or installed as a standalone package.
    ;(globalThis as Record<symbol, unknown>)[Symbol.for('undici.globalDispatcher.1')] = dispatcher
    console.error(`[Proxy] Detected HTTP_PROXY, global proxy agent injected.`)
  } catch (err: unknown) {
    console.error(
      `[Proxy] Failed to inject proxy agent: ${err instanceof Error ? err.message : String(err)}`
    )
  }
})()

// Get command line arguments
const args = process.argv.slice(2)

// Determine mode based on first argument
const firstArg = args[0]

// MCP server mode conditions:
// 1. No arguments (default behavior for MCP)
// 2. Explicit 'serve' command
// 3. Legacy flags that were for MCP server
const mcpServerFlags = ['--verbose', '-v', '--quiet', '-q', '--help', '-h']
const isMcpMode = args.length === 0 || firstArg === 'serve' || (args.length === 1 && mcpServerFlags.includes(firstArg))

if (isMcpMode) {
  // Start MCP server (existing behavior)
  startMcpServer(args)
} else {
  // Run CLI
  runCli(args)
}
