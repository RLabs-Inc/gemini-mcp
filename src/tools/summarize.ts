/**
 * Summarize Tool - Provides content summarization using Gemini models
 *
 * This tool allows summarizing long text content at different levels of detail.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { generateWithGeminiFlash } from '../gemini-client.js'

/**
 * Register summarization tools with the MCP server
 */
export function registerSummarizeTool(server: McpServer): void {
  server.tool(
    'gemini-summarize',
    {
      content: z.string().describe('The content to summarize'),
      length: z.enum(['brief', 'moderate', 'detailed']).default('moderate').describe('The desired summary length'),
      format: z.enum(['paragraph', 'bullet-points', 'outline']).default('paragraph').describe('The output format'),
    },
    async ({ content, length, format }) => {
      console.log(`Summarizing content (${length}, ${format})`)

      try {
        // Configure length parameters
        let wordCount: string
        switch (length) {
          case 'brief':
            wordCount = '50-100 words'
            break
          case 'moderate':
            wordCount = '150-250 words'
            break
          case 'detailed':
            wordCount = '300-500 words'
            break
          default:
            wordCount = '150-250 words'
        }

        // Configure format instructions
        let formatInstructions: string
        switch (format) {
          case 'bullet-points':
            formatInstructions = 'Use bullet points for each key idea or concept.'
            break
          case 'outline':
            formatInstructions = 'Create a structured outline with main points and sub-points.'
            break
          case 'paragraph':
          default:
            formatInstructions = 'Use cohesive paragraphs with clear transitions.'
        }

        const prompt = `
Summarize the following content in ${wordCount}. ${formatInstructions}

Focus on capturing the most important information, main arguments, and key conclusions.

Content to summarize:
"""
${content}
"""
`

        const response = await generateWithGeminiFlash(prompt)

        return {
          content: [
            {
              type: 'text',
              text: response,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`Error summarizing content: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
