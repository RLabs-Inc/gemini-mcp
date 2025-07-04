#!/usr/bin/env node

/**
 * MCP Server Gemini - Integrates Google's Gemini models with Claude Code
 *
 * This MCP server provides access to Gemini models for use in Claude Code.
 * Features include direct queries, brainstorming, and analysis tools.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { parseArgs } from 'node:util'

// Import tools
import { registerQueryTool } from './tools/query.js'
import { registerBrainstormTool } from './tools/brainstorm.js'
import { registerAnalyzeTool } from './tools/analyze.js'
import { registerSummarizeTool } from './tools/summarize.js'
import { registerImageGenTool } from './tools/image-gen.js'

// Import Gemini client and logger
import { initGeminiClient } from './gemini-client.js'
import { setupLogger, logger, LogLevel } from './utils/logger.js'
import { getProxyInfo } from './utils/proxy.js'

// Parse command line arguments
const { values } = parseArgs({
  options: {
    verbose: {
      type: 'boolean',
      short: 'v',
      default: false,
    },
    quiet: {
      type: 'boolean',
      short: 'q',
      default: false,
    },
    help: {
      type: 'boolean',
      short: 'h',
      default: false,
    },
  },
})

// Show help if requested
if (values.help) {
  console.log(`
MCP Server Gemini - Integrates Google's Gemini models with Claude Code

Usage:
  gemini-mcp [options]

Options:
  -v, --verbose    Enable verbose logging (shows all prompts and responses)
  -q, --quiet      Run in quiet mode (minimal logging)
  -h, --help       Show this help message

Environment Variables:
  GEMINI_API_KEY   (required) Your Google Gemini API key
  VERBOSE          (optional) Set to "true" to enable verbose logging
  QUIET            (optional) Set to "true" to enable quiet mode
  GEMINI_MODEL     (optional) Default Gemini model to use
  GEMINI_PRO_MODEL (optional) Specify Pro model variant
  GEMINI_FLASH_MODEL (optional) Specify Flash model variant
  
Proxy Configuration:
  http_proxy       (optional) HTTP proxy URL (e.g., http://proxy.example.com:8080)
  https_proxy      (optional) HTTPS proxy URL (e.g., http://proxy.example.com:8080)
  no_proxy         (optional) Comma-separated list of hosts to bypass proxy
  `)
  process.exit(0)
}

// Configure logging mode based on command line args or environment variables
let logLevel: LogLevel = 'normal'
if (values.verbose || process.env.VERBOSE === 'true') {
  logLevel = 'verbose'
} else if (values.quiet || process.env.QUIET === 'true') {
  logLevel = 'quiet'
}
setupLogger(logLevel)

// Check for required API key
if (!process.env.GEMINI_API_KEY) {
  logger.error('Error: GEMINI_API_KEY environment variable is required')
  process.exit(1)
}

// Get model name from environment or use default
// Use a safeguard to ensure we always have a valid model name
const defaultModel = 'gemini-1.5-pro'
const geminiModel = process.env.GEMINI_MODEL || defaultModel

// Log model configuration for debugging
logger.debug(`Model configuration:
  - GEMINI_MODEL: ${process.env.GEMINI_MODEL || '(not set, using default)'}
  - GEMINI_PRO_MODEL: ${process.env.GEMINI_PRO_MODEL || '(not set, using default)'}
  - GEMINI_FLASH_MODEL: ${process.env.GEMINI_FLASH_MODEL || '(not set, using default)'}`)

async function main() {
  logger.info(`Starting MCP Gemini Server with model: ${geminiModel}`)
  logger.info(`Logging mode: ${logLevel}`)
  
  // Log proxy configuration if present
  const proxyInfo = getProxyInfo()
  if (proxyInfo) {
    logger.info(`Proxy settings: ${proxyInfo}`)
  }

  // Handle unexpected stdio errors
  process.stdin.on('error', (err) => {
    logger.error('STDIN error:', err)
    // Don't exit, just log
  })
  
  process.stdout.on('error', (err) => {
    logger.error('STDOUT error:', err)
    // Don't exit, just log
  })

  try {
    // Initialize Gemini client
    await initGeminiClient()

    // Create MCP server
    const server = new McpServer({
      name: 'Gemini',
      version: '0.1.0',
    })

    // Register tools
    registerQueryTool(server)
    registerBrainstormTool(server)
    registerAnalyzeTool(server)
    registerSummarizeTool(server)
    registerImageGenTool(server)

    // Start server with stdio transport with enhanced error handling
    const transport = new StdioServerTransport()

    // Set up error handling for transport with improved error recovery
    transport.onclose = () => {
      logger.warn('MCP transport connection closed')
      logger.debug('Connection closed event triggered')
      
      // Attempt to recover connection after brief delay with backoff strategy
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      
      const attemptReconnect = () => {
        if (reconnectAttempts >= maxReconnectAttempts) {
          logger.error(`Failed to reconnect after ${maxReconnectAttempts} attempts`);
          return;
        }
        
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts - 1), 10000);
        
        logger.info(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts}) after ${delay}ms...`);
        
        setTimeout(() => {
          try {
            // Check if stdin/stdout are still available
            if (process.stdin.destroyed || process.stdout.destroyed) {
              logger.error('Cannot reconnect: stdin or stdout is destroyed');
              return;
            }
            
            server.connect(transport)
              .then(() => {
                logger.info('Successfully reconnected to MCP transport');
                reconnectAttempts = 0;
              })
              .catch(e => {
                logger.error('Reconnection failed:', e);
                attemptReconnect(); // Try again with backoff
              });
          } catch (e) {
            logger.error('Error during reconnection attempt:', e);
            attemptReconnect(); // Try again with backoff
          }
        }, delay);
      };
      
      attemptReconnect();
    }

    transport.onerror = (error) => {
      logger.error('MCP transport error:', error)
      // Log detailed error information for debugging
      if (error instanceof Error) {
        logger.debug(`Error name: ${error.name}, message: ${error.message}`)
        logger.debug(`Stack trace: ${error.stack}`)
      }
    }

    // Set up error handling for the connection with more diagnostics
    try {
      // Log environment diagnostic info before connecting
      logger.debug(`Process details - PID: ${process.pid}, Node version: ${process.version}`)
      logger.debug(`Environment variables: API_KEY=${process.env.GEMINI_API_KEY ? 'SET' : 'NOT_SET'}, VERBOSE=${process.env.VERBOSE || 'not set'}`)
      logger.debug(`Process stdin/stdout state - isTTY: ${process.stdin.isTTY}, ${process.stdout.isTTY}`)
      
      await server.connect(transport)
      logger.info('MCP Gemini Server running')
    } catch (err) {
      logger.error('Failed to connect MCP server transport:', err)
      
      // More detailed error logging
      if (err instanceof Error) {
        logger.debug(`Error stack: ${err.stack}`)
        logger.debug(`Error details: name=${err.name}, message=${err.message}`)
      } else {
        logger.debug(`Non-Error object thrown: ${JSON.stringify(err)}`)
      }
      
      logger.warn('Server will attempt to continue running despite connection error')
    }

    // Handle process termination
    process.on('SIGINT', async () => {
      logger.info('Shutting down MCP Gemini Server')
      await server.close()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      logger.info('Shutting down MCP Gemini Server')
      await server.close()
      process.exit(0)
    })
  } catch (error) {
    logger.error('Failed to start MCP Gemini Server:', error)
    process.exit(1)
  }
}

main()
