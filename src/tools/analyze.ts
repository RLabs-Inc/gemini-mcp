/**
 * Analyze Tool - Provides analysis capabilities using Gemini models
 *
 * This tool allows analyzing code, text, or specific content with Gemini.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { generateWithGeminiPro } from '../gemini-client.js'

/**
 * Register analysis tools with the MCP server
 */
export function registerAnalyzeTool(server: McpServer): void {
  // Code analysis tool
  server.tool(
    'gemini-analyze-code',
    {
      code: z.string().describe('The code to analyze'),
      language: z.string().optional().describe('The programming language of the code'),
      focus: z
        .enum(['quality', 'security', 'performance', 'bugs', 'general'])
        .default('general')
        .describe('What aspect to focus the analysis on'),
    },
    async ({ code, language, focus }) => {
      console.log(`Analyzing code with focus on ${focus}`)

      try {
        const langText = language ? `${language} code` : 'code'
        const prompt = `
Analyze the following ${langText} with a focus on ${focus}:

\`\`\`${language ? language : ''}
${code}
\`\`\`

Please provide:
${focus === 'quality' ? '1. Code quality assessment\n2. Style and readability review\n3. Maintainability considerations\n4. Suggested improvements' : ''}
${focus === 'security' ? '1. Security vulnerabilities identification\n2. Potential exploit vectors\n3. Security best practices assessment\n4. Security improvements' : ''}
${focus === 'performance' ? '1. Performance bottlenecks\n2. Optimization opportunities\n3. Algorithmic complexity analysis\n4. Performance improvement suggestions' : ''}
${focus === 'bugs' ? "1. Bugs and logical errors\n2. Edge cases that aren't handled\n3. Potential runtime errors\n4. Bug fix suggestions" : ''}
${focus === 'general' ? '1. Overall code assessment\n2. Strengths and weaknesses\n3. Potential issues (bugs, security, performance)\n4. Suggested improvements' : ''}
`

        const response = await generateWithGeminiPro(prompt)

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
        console.error(`Error analyzing code: ${errorMessage}`)

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

  // Text analysis tool
  server.tool(
    'gemini-analyze-text',
    {
      text: z.string().describe('The text to analyze'),
      type: z
        .enum(['sentiment', 'summary', 'entities', 'key-points', 'general'])
        .default('general')
        .describe('Type of analysis to perform'),
    },
    async ({ text, type }) => {
      console.log(`Analyzing text with focus on ${type}`)

      try {
        const prompt = `
Analyze the following text with a focus on ${type}:

"""
${text}
"""

Please provide:
${type === 'sentiment' ? '1. Overall sentiment (positive, negative, neutral)\n2. Sentiment intensity\n3. Key emotional elements\n4. Sentiment by topic/section if applicable' : ''}
${type === 'summary' ? '1. Concise summary of the main points\n2. Key takeaways\n3. Important details\n4. Context and implications' : ''}
${type === 'entities' ? '1. People mentioned\n2. Organizations mentioned\n3. Locations mentioned\n4. Other notable entities (products, events, etc.)' : ''}
${type === 'key-points' ? '1. Main arguments or claims\n2. Supporting evidence\n3. Conclusions reached\n4. Logical structure analysis' : ''}
${type === 'general' ? '1. Overall summary\n2. Key themes and topics\n3. Tone and style assessment\n4. Notable insights and implications' : ''}
`

        const response = await generateWithGeminiPro(prompt)

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
        console.error(`Error analyzing text: ${errorMessage}`)

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
