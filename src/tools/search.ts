/**
 * Google Search Grounding Tool - Real-time web information with citations
 *
 * This tool connects Gemini to Google Search for:
 * - Accurate answers grounded in real-world information
 * - Access to recent events and current topics
 * - Verifiable sources with citations
 *
 * Returns responses with inline citations linked to source URLs.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { logger } from '../utils/logger.js'

// Types for grounding metadata
interface GroundingChunk {
  web?: {
    uri: string
    title: string
  }
}

interface GroundingSupport {
  segment?: {
    startIndex: number
    endIndex: number
    text: string
  }
  groundingChunkIndices?: number[]
}

interface GroundingMetadata {
  webSearchQueries?: string[]
  groundingChunks?: GroundingChunk[]
  groundingSupports?: GroundingSupport[]
}

/**
 * Add inline citations to text based on grounding metadata
 */
function addCitations(text: string, supports: GroundingSupport[], chunks: GroundingChunk[]): string {
  if (!supports || !chunks || supports.length === 0) {
    return text
  }

  // Sort supports by endIndex in descending order to avoid shifting issues
  const sortedSupports = [...supports].sort((a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0))

  let result = text

  for (const support of sortedSupports) {
    const endIndex = support.segment?.endIndex
    if (endIndex === undefined || !support.groundingChunkIndices?.length) {
      continue
    }

    const citationLinks = support.groundingChunkIndices
      .map((i) => {
        const uri = chunks[i]?.web?.uri
        const title = chunks[i]?.web?.title
        if (uri) {
          return `[${title || i + 1}](${uri})`
        }
        return null
      })
      .filter(Boolean)

    if (citationLinks.length > 0) {
      const citationString = ' ' + citationLinks.join(', ')
      result = result.slice(0, endIndex) + citationString + result.slice(endIndex)
    }
  }

  return result
}

/**
 * Register Google Search grounding tools with the MCP server
 */
export function registerSearchTool(server: McpServer): void {
  server.tool(
    'gemini-search',
    {
      query: z
        .string()
        .describe('The question or topic to search for. Gemini will use Google Search to find current information.'),
      returnCitations: z.boolean().default(true).describe('Include inline citations with source URLs'),
    },
    async ({ query, returnCitations }) => {
      logger.info(`Google Search query: ${query.substring(0, 50)}...`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-preview'

        // Execute with Google Search tool enabled
        const response = await genAI.models.generateContent({
          model,
          contents: query,
          config: {
            tools: [{ googleSearch: {} }],
          },
        })

        const candidate = response.candidates?.[0]
        if (!candidate) {
          throw new Error('No response from search')
        }

        let responseText = response.text || ''
        const groundingMetadata = candidate.groundingMetadata as GroundingMetadata | undefined

        // Build response with citations if requested
        if (returnCitations && groundingMetadata) {
          const supports = groundingMetadata.groundingSupports || []
          const chunks = groundingMetadata.groundingChunks || []

          if (supports.length > 0 && chunks.length > 0) {
            responseText = addCitations(responseText, supports, chunks)
          }

          // Add sources section at the end
          if (chunks.length > 0) {
            responseText += '\n\n---\n**Sources:**\n'
            const seenUrls = new Set<string>()
            for (const chunk of chunks) {
              if (chunk.web?.uri && !seenUrls.has(chunk.web.uri)) {
                seenUrls.add(chunk.web.uri)
                responseText += `- [${chunk.web.title || 'Source'}](${chunk.web.uri})\n`
              }
            }
          }

          // Add search queries used (for transparency)
          if (groundingMetadata.webSearchQueries?.length) {
            responseText += `\n*Searches performed: ${groundingMetadata.webSearchQueries.join(', ')}*`
          }
        }

        logger.info('Google Search completed successfully')

        return {
          content: [
            {
              type: 'text' as const,
              text: responseText,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error in Google Search: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error performing search: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
