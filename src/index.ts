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

// Get command line arguments
const args = process.argv.slice(2)

// Determine mode based on first argument
const firstArg = args[0]

// MCP server mode conditions:
// 1. No arguments (default behavior for MCP)
// 2. Explicit 'serve' command
// 3. Legacy flags that were for MCP server
const mcpServerFlags = ['--verbose', '-v', '--quiet', '-q', '--help', '-h']
const isMcpMode =
  args.length === 0 ||
  firstArg === 'serve' ||
  (args.length === 1 && mcpServerFlags.includes(firstArg))

if (isMcpMode) {
  // Start MCP server (existing behavior)
  startMcpServer(args)
} else {
  // Run CLI
  runCli(args)
}
