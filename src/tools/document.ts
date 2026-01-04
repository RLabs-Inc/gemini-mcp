/**
 * Document Analysis Tool - Analyze PDFs and documents
 *
 * Gemini can process documents including PDFs, enabling:
 * - Document summarization
 * - Information extraction
 * - Q&A about document content
 * - Table and chart understanding
 *
 * Uses the Files API for larger documents.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { logger } from '../utils/logger.js'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.xml': 'application/xml',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.doc': 'application/msword',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Register document analysis tools with the MCP server
 */
export function registerDocumentTool(server: McpServer): void {
  server.tool(
    'gemini-analyze-document',
    {
      filePath: z
        .string()
        .describe('Path to the document file (PDF, TXT, CSV, DOCX, etc.)'),
      question: z
        .string()
        .describe(
          'Question about the document or task to perform (e.g., "Summarize this document", "Extract all dates mentioned")'
        ),
      mediaResolution: z
        .enum(['low', 'medium', 'high'])
        .default('medium')
        .describe(
          'Resolution for processing: low (faster, less detail), medium (balanced), high (more detail, more tokens)'
        ),
    },
    async ({ filePath, question, mediaResolution }) => {
      logger.info(`Document analysis: ${filePath}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        // Check file exists
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`)
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-preview'

        // Read file
        const fileBuffer = fs.readFileSync(filePath)
        const mimeType = getMimeType(filePath)
        const fileSize = fileBuffer.length

        logger.debug(`File size: ${fileSize} bytes, MIME type: ${mimeType}`)

        // Map resolution to API parameter
        const resolutionMap: Record<string, unknown> = {
          low: 'media_resolution_low',
          medium: 'media_resolution_medium',
          high: 'media_resolution_high',
        }

        // For small files (<20MB), use inline data
        // For larger files, we would need to use the Files API (upload first)
        if (fileSize > 20 * 1024 * 1024) {
          // Upload using Files API
          logger.info('Large file detected, uploading via Files API...')

          const uploadedFile = await genAI.files.upload({
            file: new Blob([fileBuffer], { type: mimeType }),
            config: { mimeType },
          })

          const config: Record<string, unknown> = {}
          if (mediaResolution !== 'medium') {
            config.mediaResolution = resolutionMap[mediaResolution]
          }

          const response = await genAI.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    fileData: {
                      fileUri: uploadedFile.uri,
                      mimeType: uploadedFile.mimeType,
                    },
                  },
                  { text: question },
                ],
              },
            ],
            config: Object.keys(config).length > 0 ? config : undefined,
          })

          logger.info('Document analysis completed (via Files API)')

          return {
            content: [
              {
                type: 'text' as const,
                text: response.text || 'Unable to analyze document.',
              },
            ],
          }
        } else {
          // Use inline data for smaller files
          const base64Data = fileBuffer.toString('base64')

          const inlineConfig: Record<string, unknown> = {}
          if (mediaResolution !== 'medium') {
            inlineConfig.mediaResolution = resolutionMap[mediaResolution]
          }

          const response = await genAI.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                  { text: question },
                ],
              },
            ],
            config: Object.keys(inlineConfig).length > 0 ? inlineConfig : undefined,
          })

          logger.info('Document analysis completed')

          return {
            content: [
              {
                type: 'text' as const,
                text: response.text || 'Unable to analyze document.',
              },
            ],
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in document analysis: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error analyzing document: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Convenience tool for PDF summarization
  server.tool(
    'gemini-summarize-pdf',
    {
      filePath: z.string().describe('Path to the PDF file'),
      style: z
        .enum(['brief', 'detailed', 'outline', 'key-points'])
        .default('brief')
        .describe('Summary style'),
    },
    async ({ filePath, style }) => {
      logger.info(`PDF summary: ${filePath}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`)
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_FLASH_MODEL || 'gemini-3-flash-preview'

        // Build prompt based on style
        let prompt: string
        switch (style) {
          case 'brief':
            prompt = 'Provide a brief summary of this document in 2-3 paragraphs.'
            break
          case 'detailed':
            prompt =
              'Provide a comprehensive summary of this document, covering all main sections, key arguments, and conclusions.'
            break
          case 'outline':
            prompt =
              'Create an outline of this document showing its structure and main topics with sub-points.'
            break
          case 'key-points':
            prompt =
              'Extract the key points and takeaways from this document as a bullet-point list.'
            break
          default:
            prompt = 'Summarize this document.'
        }

        const fileBuffer = fs.readFileSync(filePath)
        const mimeType = getMimeType(filePath)
        const base64Data = fileBuffer.toString('base64')

        const response = await genAI.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                { text: prompt },
              ],
            },
          ],
        })

        logger.info('PDF summary completed')

        return {
          content: [
            {
              type: 'text' as const,
              text: response.text || 'Unable to summarize document.',
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in PDF summary: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error summarizing PDF: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Tool for extracting tables from documents
  server.tool(
    'gemini-extract-tables',
    {
      filePath: z.string().describe('Path to the document file'),
      outputFormat: z
        .enum(['markdown', 'csv', 'json'])
        .default('markdown')
        .describe('Output format for extracted tables'),
    },
    async ({ filePath, outputFormat }) => {
      logger.info(`Table extraction: ${filePath}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`)
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-preview'

        // Build prompt for table extraction
        let prompt: string
        switch (outputFormat) {
          case 'csv':
            prompt =
              'Extract all tables from this document and output them as CSV format. Separate multiple tables with blank lines and add a header comment for each table.'
            break
          case 'json':
            prompt =
              'Extract all tables from this document and output them as a JSON array. Each table should be an object with "title" and "rows" (array of objects with column headers as keys).'
            break
          case 'markdown':
          default:
            prompt =
              'Extract all tables from this document and output them as markdown tables. Add a title for each table.'
        }

        const fileBuffer = fs.readFileSync(filePath)
        const mimeType = getMimeType(filePath)
        const base64Data = fileBuffer.toString('base64')

        const response = await genAI.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                { text: prompt },
              ],
            },
          ],
        })

        logger.info('Table extraction completed')

        return {
          content: [
            {
              type: 'text' as const,
              text: response.text || 'No tables found in the document.',
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in table extraction: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error extracting tables: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
