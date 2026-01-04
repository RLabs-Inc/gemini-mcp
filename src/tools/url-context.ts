/**
 * URL Context Tool - Analyze web pages by URL
 *
 * The URL context tool lets you provide URLs for Gemini to analyze.
 * Useful for:
 * - Extract data from web pages (prices, names, key findings)
 * - Compare documents from multiple URLs
 * - Synthesize content from several sources
 * - Analyze code from GitHub or documentation sites
 *
 * Can be combined with Google Search for powerful workflows.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { logger } from '../utils/logger.js'

// Types for URL context metadata
interface UrlMetadata {
  retrievedUrl: string
  urlRetrievalStatus: string
}

interface UrlContextMetadata {
  urlMetadata?: UrlMetadata[]
}

/**
 * Register URL context tools with the MCP server
 */
export function registerUrlContextTool(server: McpServer): void {
  server.tool(
    'gemini-analyze-url',
    {
      urls: z
        .array(z.string())
        .min(1)
        .max(20)
        .describe('URLs to analyze (1-20 URLs)'),
      question: z
        .string()
        .describe('Question about the URLs or task to perform'),
      useGoogleSearch: z
        .boolean()
        .default(false)
        .describe('Also use Google Search to find additional context'),
    },
    async ({ urls, question, useGoogleSearch }) => {
      logger.info(`URL context analysis: ${urls.length} URLs`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-preview'

        // Build the prompt with URLs
        const urlList = urls.map((url, i) => `${i + 1}. ${url}`).join('\n')
        const prompt = `${question}\n\nURLs to analyze:\n${urlList}`

        // Build tools config
        const tools: Array<Record<string, unknown>> = [{ urlContext: {} }]
        if (useGoogleSearch) {
          tools.push({ googleSearch: {} })
        }

        // Execute
        const response = await genAI.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools,
          },
        })

        const candidate = response.candidates?.[0]
        if (!candidate) {
          throw new Error('No response from URL analysis')
        }

        let responseText = response.text || ''

        // Add URL retrieval status if available
        const urlContextMetadata = candidate.urlContextMetadata as UrlContextMetadata | undefined
        if (urlContextMetadata?.urlMetadata) {
          responseText += '\n\n---\n**URL Retrieval Status:**\n'
          for (const meta of urlContextMetadata.urlMetadata) {
            const status =
              meta.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS'
                ? '✓'
                : '✗'
            responseText += `${status} ${meta.retrievedUrl}\n`
          }
        }

        logger.info('URL context analysis completed')

        return {
          content: [
            {
              type: 'text' as const,
              text: responseText,
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in URL analysis: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error analyzing URLs: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Convenience tool for comparing content from multiple URLs
  server.tool(
    'gemini-compare-urls',
    {
      url1: z.string().describe('First URL to compare'),
      url2: z.string().describe('Second URL to compare'),
      aspect: z
        .string()
        .optional()
        .describe('Specific aspect to compare (e.g., "pricing", "features", "ingredients")'),
    },
    async ({ url1, url2, aspect }) => {
      logger.info(`URL comparison: ${url1} vs ${url2}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_FLASH_MODEL || 'gemini-3-flash-preview'

        const prompt = aspect
          ? `Compare the ${aspect} from these two URLs:\n1. ${url1}\n2. ${url2}\n\nProvide a detailed comparison highlighting differences and similarities.`
          : `Compare the content from these two URLs:\n1. ${url1}\n2. ${url2}\n\nProvide a comprehensive comparison of key information from both sources.`

        const response = await genAI.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ urlContext: {} }],
          },
        })

        logger.info('URL comparison completed')

        return {
          content: [
            {
              type: 'text' as const,
              text: response.text || 'Unable to compare URLs.',
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in URL comparison: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error comparing URLs: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Tool for extracting specific data from URLs
  server.tool(
    'gemini-extract-from-url',
    {
      url: z.string().describe('URL to extract data from'),
      dataType: z
        .enum(['prices', 'contacts', 'dates', 'products', 'links', 'custom'])
        .describe('Type of data to extract'),
      customFields: z
        .string()
        .optional()
        .describe('For custom extraction: comma-separated fields to extract'),
    },
    async ({ url, dataType, customFields }) => {
      logger.info(`URL extraction: ${dataType} from ${url}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_FLASH_MODEL || 'gemini-3-flash-preview'

        // Build prompt based on data type
        let prompt: string
        switch (dataType) {
          case 'prices':
            prompt = `Extract all prices and pricing information from this URL: ${url}\n\nReturn as a structured list with item name and price.`
            break
          case 'contacts':
            prompt = `Extract all contact information (emails, phone numbers, addresses, social media) from this URL: ${url}`
            break
          case 'dates':
            prompt = `Extract all dates, times, and scheduling information from this URL: ${url}`
            break
          case 'products':
            prompt = `Extract all product names, descriptions, and details from this URL: ${url}`
            break
          case 'links':
            prompt = `Extract all important links from this URL: ${url}\n\nCategorize them by purpose.`
            break
          case 'custom':
            if (!customFields) {
              throw new Error('customFields required for custom extraction')
            }
            prompt = `Extract the following information from this URL: ${url}\n\nFields to extract: ${customFields}`
            break
          default:
            prompt = `Extract key information from this URL: ${url}`
        }

        const response = await genAI.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ urlContext: {} }],
          },
        })

        logger.info('URL extraction completed')

        return {
          content: [
            {
              type: 'text' as const,
              text: response.text || 'No data extracted.',
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in URL extraction: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error extracting from URL: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
