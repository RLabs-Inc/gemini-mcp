/**
 * Context Caching Tool - Cache large content for cost savings
 *
 * When working with large documents or videos repeatedly, caching saves costs
 * by storing the tokenized content and reusing it across requests.
 *
 * Useful for:
 * - Chatbots with extensive system instructions
 * - Repetitive analysis of large files
 * - Recurring queries against document sets
 * - Code repository analysis
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { logger } from '../utils/logger.js'
import * as fs from 'fs'
import * as path from 'path'

// Store active caches for reference
const activeCaches = new Map<string, { name: string; model: string; displayName: string; expireTime: Date }>()

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.mp4': 'video/mp4',
    '.mov': 'video/mov',
    '.avi': 'video/avi',
    '.webm': 'video/webm',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Register caching tools with the MCP server
 */
export function registerCacheTool(server: McpServer): void {
  // Create a cache from a file
  server.tool(
    'gemini-create-cache',
    {
      filePath: z.string().describe('Path to the file to cache'),
      displayName: z.string().describe('A name to identify this cache'),
      systemInstruction: z
        .string()
        .optional()
        .describe('System instruction to include with the cache'),
      ttlMinutes: z
        .number()
        .min(1)
        .max(1440)
        .default(60)
        .describe('Time to live in minutes (1-1440, default 60)'),
    },
    async ({ filePath, displayName, systemInstruction, ttlMinutes }) => {
      logger.info(`Creating cache: ${displayName}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`)
        }

        const genAI = new GoogleGenAI({ apiKey })

        // Use a specific model version for caching (required)
        const model = 'gemini-2.0-flash-001'

        // Upload the file first
        const fileBuffer = fs.readFileSync(filePath)
        const mimeType = getMimeType(filePath)

        logger.info(`Uploading file: ${filePath} (${mimeType})`)

        const uploadedFile = await genAI.files.upload({
          file: new Blob([fileBuffer], { type: mimeType }),
          config: { mimeType },
        })

        // Create the cache
        const cacheConfig: Record<string, unknown> = {
          displayName,
          contents: [
            {
              parts: [
                {
                  fileData: {
                    fileUri: uploadedFile.uri,
                    mimeType: uploadedFile.mimeType,
                  },
                },
              ],
            },
          ],
          ttl: `${ttlMinutes * 60}s`,
        }

        if (systemInstruction) {
          cacheConfig.systemInstruction = systemInstruction
        }

        const cache = await genAI.caches.create({
          model,
          config: cacheConfig,
        })

        // Store cache info
        const expireTime = new Date(Date.now() + ttlMinutes * 60 * 1000)
        activeCaches.set(displayName, {
          name: cache.name || displayName,
          model,
          displayName,
          expireTime,
        })

        logger.info(`Cache created: ${cache.name}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Cache created successfully!\n\n**Name:** ${cache.name}\n**Display Name:** ${displayName}\n**Model:** ${model}\n**Expires:** ${expireTime.toISOString()}\n\nUse gemini-query-cache with this cache name to query the cached content.`,
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error creating cache: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error creating cache: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Query using a cached content
  server.tool(
    'gemini-query-cache',
    {
      cacheName: z.string().describe('The cache name or display name'),
      question: z.string().describe('Question to ask about the cached content'),
    },
    async ({ cacheName, question }) => {
      logger.info(`Querying cache: ${cacheName}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })

        // Look up cache by display name or use as-is
        const cacheInfo = activeCaches.get(cacheName)
        const actualCacheName = cacheInfo?.name || cacheName
        const model = cacheInfo?.model || 'gemini-2.0-flash-001'

        // Query with cached content
        const response = await genAI.models.generateContent({
          model,
          contents: question,
          config: {
            cachedContent: actualCacheName,
          },
        })

        const usageMetadata = response.usageMetadata as {
          promptTokenCount?: number
          cachedContentTokenCount?: number
          candidatesTokenCount?: number
          totalTokenCount?: number
        } | undefined

        let usageInfo = ''
        if (usageMetadata) {
          usageInfo = `\n\n---\n**Token Usage:**\n`
          usageInfo += `- Total: ${usageMetadata.totalTokenCount || 0}\n`
          usageInfo += `- Cached: ${usageMetadata.cachedContentTokenCount || 0}\n`
          usageInfo += `- New prompt: ${usageMetadata.promptTokenCount || 0}\n`
          usageInfo += `- Response: ${usageMetadata.candidatesTokenCount || 0}`
        }

        logger.info('Cache query completed')

        return {
          content: [
            {
              type: 'text' as const,
              text: (response.text || 'No response.') + usageInfo,
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error querying cache: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error querying cache: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // List active caches
  server.tool(
    'gemini-list-caches',
    {},
    async () => {
      logger.info('Listing caches')

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })

        // Get caches from API
        const caches: Array<{ name?: string; displayName?: string; model?: string; expireTime?: string }> = []
        const cacheList = await genAI.caches.list()
        if (cacheList && Array.isArray(cacheList)) {
          for (const cache of cacheList) {
            caches.push(cache as { name?: string; displayName?: string; model?: string; expireTime?: string })
          }
        }

        if (caches.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No active caches found.\n\nCreate one with gemini-create-cache.',
              },
            ],
          }
        }

        let text = '**Active Caches:**\n\n'
        for (const cache of caches) {
          text += `- **${cache.displayName || cache.name}**\n`
          text += `  - Name: ${cache.name}\n`
          text += `  - Model: ${cache.model}\n`
          text += `  - Expires: ${cache.expireTime}\n\n`
        }

        return {
          content: [
            {
              type: 'text' as const,
              text,
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error listing caches: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error listing caches: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Delete a cache
  server.tool(
    'gemini-delete-cache',
    {
      cacheName: z.string().describe('The cache name to delete'),
    },
    async ({ cacheName }) => {
      logger.info(`Deleting cache: ${cacheName}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })

        // Look up by display name
        const cacheInfo = activeCaches.get(cacheName)
        const actualCacheName = cacheInfo?.name || cacheName

        await genAI.caches.delete({ name: actualCacheName })

        // Remove from local tracking
        activeCaches.delete(cacheName)

        logger.info('Cache deleted')

        return {
          content: [
            {
              type: 'text' as const,
              text: `Cache "${cacheName}" deleted successfully.`,
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error deleting cache: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error deleting cache: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
