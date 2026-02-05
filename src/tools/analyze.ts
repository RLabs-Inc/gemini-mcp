/**
 * Analyze Tool - Provides analysis capabilities using Gemini models
 *
 * This tool allows analyzing code, text, or specific content with Gemini.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { generateWithGeminiPro } from '../gemini-client.js'
import { normalizeFilePaths, readFilesForAnalysis, buildAnalysisPrompt } from './analyze-utils.js'

// Re-export utilities for external use
export {
  normalizeFilePaths,
  readFilesForAnalysis,
  buildCodeSection,
  buildAnalysisTarget,
  getFocusInstructions,
  buildAnalysisPrompt,
  MAX_FILE_SIZE,
  type FileContent,
  type AnalysisFocus,
  type CodeAnalysisInput,
  type PromptBuildResult,
} from './analyze-utils.js'

/**
 * Register analysis tools with the MCP server
 */
export function registerAnalyzeTool(server: McpServer): void {
  // Code analysis tool
  server.tool(
    'gemini-analyze-code',
    {
      code: z.string().optional().describe('The code to analyze (inline)'),
      filePath: z.string().optional().describe('Path to a single code file to analyze'),
      filePaths: z.array(z.string()).optional().describe('Paths to multiple code files to analyze together'),
      language: z.string().optional().describe('The programming language of the code'),
      focus: z
        .enum(['quality', 'security', 'performance', 'bugs', 'general'])
        .default('general')
        .describe('What aspect to focus the analysis on'),
    },
    async ({ code, filePath, filePaths, language, focus }) => {
      console.log(`Analyzing code with focus on ${focus}`)

      try {
        // Normalize file paths
        const allPaths = normalizeFilePaths(filePath, filePaths)

        // Read files
        const fileContents = readFilesForAnalysis(allPaths)

        // Build prompt
        const { prompt } = buildAnalysisPrompt(fileContents, code, language, focus)

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
