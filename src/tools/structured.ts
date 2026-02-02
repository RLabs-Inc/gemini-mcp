/**
 * Structured Output Tool - Get JSON responses with schema validation
 *
 * This tool enables Gemini to generate responses that adhere to a provided JSON Schema.
 * Useful for:
 * - Data extraction from unstructured text
 * - Structured classification
 * - Generating data for APIs or databases
 *
 * Supports combining with Google Search for grounded structured data.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { logger } from '../utils/logger.js'

/**
 * Register structured output tools with the MCP server
 */
export function registerStructuredTool(server: McpServer): void {
  server.tool(
    'gemini-structured',
    {
      prompt: z.string().describe('The prompt or data to process'),
      schema: z
        .string()
        .describe(
          'JSON Schema as a string. Example: {"type":"object","properties":{"name":{"type":"string"},"age":{"type":"integer"}},"required":["name"]}'
        ),
      useGoogleSearch: z
        .boolean()
        .default(false)
        .describe('Use Google Search to ground the response in real-world data'),
    },
    async ({ prompt, schema, useGoogleSearch }) => {
      logger.info(`Structured output request: ${prompt.substring(0, 50)}...`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        // Parse the schema
        let jsonSchema: Record<string, unknown>
        try {
          jsonSchema = JSON.parse(schema)
        } catch {
          throw new Error('Invalid JSON schema provided. Please provide a valid JSON Schema string.')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-preview'

        // Build config
        const config: Record<string, unknown> = {
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema,
        }

        // Add Google Search if requested
        if (useGoogleSearch) {
          config.tools = [{ googleSearch: {} }]
        }

        // Execute
        const response = await genAI.models.generateContent({
          model,
          contents: prompt,
          config,
        })

        const responseText = response.text || ''

        // Validate that we got valid JSON
        let parsedResponse: unknown
        try {
          parsedResponse = JSON.parse(responseText)
        } catch {
          throw new Error('Response was not valid JSON')
        }

        // Format nicely for display
        const formattedJson = JSON.stringify(parsedResponse, null, 2)

        logger.info('Structured output completed successfully')

        return {
          content: [
            {
              type: 'text' as const,
              text: `**Structured Response:**\n\`\`\`json\n${formattedJson}\n\`\`\``,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error in structured output: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating structured output: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Convenience tool for common extraction patterns
  server.tool(
    'gemini-extract',
    {
      text: z.string().describe('The text to extract information from'),
      extractType: z
        .enum(['entities', 'facts', 'summary', 'keywords', 'sentiment', 'custom'])
        .describe('What type of information to extract'),
      customFields: z
        .string()
        .optional()
        .describe(
          'For custom extraction: comma-separated list of fields to extract. Example: "name, date, amount, description"'
        ),
    },
    async ({ text, extractType, customFields }) => {
      logger.info(`Extraction request: ${extractType}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_FLASH_MODEL || 'gemini-3-flash-preview'

        // Build schema based on extraction type
        let schema: Record<string, unknown>
        let prompt: string

        switch (extractType) {
          case 'entities':
            schema = {
              type: 'object',
              properties: {
                people: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Names of people mentioned',
                },
                organizations: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Organizations mentioned',
                },
                locations: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Locations mentioned',
                },
                dates: { type: 'array', items: { type: 'string' }, description: 'Dates mentioned' },
                amounts: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Monetary amounts or quantities',
                },
              },
              required: ['people', 'organizations', 'locations', 'dates', 'amounts'],
            }
            prompt = `Extract all named entities from the following text:\n\n${text}`
            break

          case 'facts':
            schema = {
              type: 'object',
              properties: {
                facts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      fact: { type: 'string', description: 'A factual statement' },
                      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                    },
                    required: ['fact', 'confidence'],
                  },
                },
              },
              required: ['facts'],
            }
            prompt = `Extract all factual statements from the following text:\n\n${text}`
            break

          case 'summary':
            schema = {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'A brief title' },
                summary: { type: 'string', description: 'A concise summary' },
                keyPoints: { type: 'array', items: { type: 'string' }, description: 'Key points' },
                topics: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Main topics covered',
                },
              },
              required: ['title', 'summary', 'keyPoints', 'topics'],
            }
            prompt = `Summarize the following text and extract key information:\n\n${text}`
            break

          case 'keywords':
            schema = {
              type: 'object',
              properties: {
                keywords: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Important keywords',
                },
                phrases: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Important phrases',
                },
                categories: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Topic categories',
                },
              },
              required: ['keywords', 'phrases', 'categories'],
            }
            prompt = `Extract keywords, important phrases, and topic categories from the following text:\n\n${text}`
            break

          case 'sentiment':
            schema = {
              type: 'object',
              properties: {
                overallSentiment: {
                  type: 'string',
                  enum: ['positive', 'negative', 'neutral', 'mixed'],
                },
                sentimentScore: {
                  type: 'number',
                  description: 'Score from -1 (negative) to 1 (positive)',
                },
                emotions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Emotions detected',
                },
                reasoning: {
                  type: 'string',
                  description: 'Brief explanation of the sentiment analysis',
                },
              },
              required: ['overallSentiment', 'sentimentScore', 'emotions', 'reasoning'],
            }
            prompt = `Analyze the sentiment of the following text:\n\n${text}`
            break

          case 'custom': {
            if (!customFields) {
              throw new Error('customFields is required for custom extraction')
            }
            const fields = customFields.split(',').map((f) => f.trim())
            const properties: Record<string, { type: string; description: string }> = {}
            for (const field of fields) {
              properties[field] = {
                type: 'string',
                description: `The ${field} extracted from the text`,
              }
            }
            schema = {
              type: 'object',
              properties,
              required: fields,
            }
            prompt = `Extract the following information from the text: ${customFields}\n\nText:\n${text}`
            break
          }

          default:
            throw new Error(`Unknown extraction type: ${extractType}`)
        }

        // Execute
        const response = await genAI.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
          },
        })

        const responseText = response.text || ''
        const parsedResponse = JSON.parse(responseText)
        const formattedJson = JSON.stringify(parsedResponse, null, 2)

        logger.info('Extraction completed successfully')

        return {
          content: [
            {
              type: 'text' as const,
              text: `**Extracted ${extractType}:**\n\`\`\`json\n${formattedJson}\n\`\`\``,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error in extraction: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error extracting data: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
