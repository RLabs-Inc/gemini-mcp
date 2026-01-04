/**
 * Code Execution Tool - Let Gemini write and run Python code
 *
 * This tool enables Gemini to generate and execute Python code in a sandboxed environment.
 * Useful for:
 * - Data analysis with pandas
 * - Math computations
 * - Chart generation with matplotlib
 * - File processing
 *
 * Supported libraries include: numpy, pandas, matplotlib, scipy, scikit-learn, tensorflow, and more.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { logger } from '../utils/logger.js'
import * as fs from 'fs'
import * as path from 'path'

// Get output directory for generated files (charts, etc.)
function getOutputDir(): string {
  return (
    process.env.GEMINI_OUTPUT_DIR || path.join(process.cwd(), 'gemini-output')
  )
}

// Interface for code execution result parts
interface CodeExecutionPart {
  text?: string
  executableCode?: {
    language: string
    code: string
  }
  codeExecutionResult?: {
    outcome: string
    output: string
  }
  inlineData?: {
    data: string
    mimeType: string
  }
}

/**
 * Register code execution tools with the MCP server
 */
export function registerCodeExecTool(server: McpServer): void {
  server.tool(
    'gemini-run-code',
    {
      prompt: z
        .string()
        .describe(
          'What you want Gemini to compute or analyze. Gemini will write Python code and execute it.'
        ),
      data: z
        .string()
        .optional()
        .describe(
          'Optional CSV or text data to analyze. Will be passed to the code environment.'
        ),
    },
    async ({ prompt, data }) => {
      logger.info(`Code execution request: ${prompt.substring(0, 50)}...`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-preview'

        // Build contents with optional data
        const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

        if (data) {
          // Add data as inline content
          contents.push({
            inlineData: {
              mimeType: 'text/csv',
              data: Buffer.from(data).toString('base64'),
            },
          })
        }

        contents.push({ text: prompt })

        // Execute with code execution tool enabled
        const response = await genAI.models.generateContent({
          model,
          contents,
          config: {
            tools: [{ codeExecution: {} }],
          },
        })

        // Process the response parts
        const parts = response.candidates?.[0]?.content?.parts as CodeExecutionPart[] | undefined
        if (!parts) {
          throw new Error('No response parts from code execution')
        }

        const resultContent: Array<
          | { type: 'text'; text: string }
          | { type: 'image'; data: string; mimeType: string }
        > = []

        let codeBlock = ''
        let executionOutput = ''
        let explanation = ''

        for (const part of parts) {
          if (part.text) {
            explanation += part.text + '\n'
          }
          if (part.executableCode) {
            codeBlock = part.executableCode.code
          }
          if (part.codeExecutionResult) {
            executionOutput = part.codeExecutionResult.output
          }
          if (part.inlineData) {
            // This is a generated image (chart/graph)
            resultContent.push({
              type: 'image',
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType,
            })

            // Save the image to disk
            const outputDir = getOutputDir()
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true })
            }
            const timestamp = Date.now()
            const ext = part.inlineData.mimeType.split('/')[1] || 'png'
            const filename = `chart-${timestamp}.${ext}`
            const filePath = path.join(outputDir, filename)
            const buffer = Buffer.from(part.inlineData.data, 'base64')
            fs.writeFileSync(filePath, buffer)
            logger.info(`Chart saved to: ${filePath}`)
          }
        }

        // Build the text response
        let textResponse = ''
        if (explanation.trim()) {
          textResponse += `**Explanation:**\n${explanation.trim()}\n\n`
        }
        if (codeBlock) {
          textResponse += `**Generated Code:**\n\`\`\`python\n${codeBlock}\n\`\`\`\n\n`
        }
        if (executionOutput) {
          textResponse += `**Execution Output:**\n\`\`\`\n${executionOutput}\n\`\`\`\n`
        }

        resultContent.unshift({
          type: 'text',
          text: textResponse || 'Code execution completed.',
        })

        logger.info('Code execution completed successfully')

        return { content: resultContent }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in code execution: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error executing code: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
