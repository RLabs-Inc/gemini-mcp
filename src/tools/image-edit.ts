/**
 * Image Editing Tool - Multi-turn conversational image editing with Nano Banana Pro
 *
 * This tool enables iterative image refinement through conversation.
 * Uses Gemini 3's chat sessions to maintain context and thought signatures.
 *
 * Workflow:
 * 1. Start an edit session with an initial image generation
 * 2. Continue refining with follow-up prompts ("make it warmer", "add more clouds")
 * 3. Each response returns the updated image
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleGenAI, Modality } from '@google/genai'
import { logger } from '../utils/logger.js'
import * as fs from 'fs'
import * as path from 'path'

// Store active image editing sessions
// The SDK handles thought signatures automatically when using chat sessions
const activeEditSessions = new Map<
  string,
  {
    chat: unknown
    lastImageBase64?: string
    lastImageMimeType?: string
  }
>()

// Get output directory
function getOutputDir(): string {
  return (
    process.env.GEMINI_OUTPUT_DIR || path.join(process.cwd(), 'gemini-output')
  )
}

// Save image to disk
function saveImage(base64: string, mimeType: string): string {
  const outputDir = getOutputDir()
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const timestamp = Date.now()
  const extension = mimeType.split('/')[1] || 'png'
  const filename = `edit-${timestamp}.${extension}`
  const filePath = path.join(outputDir, filename)

  const buffer = Buffer.from(base64, 'base64')
  fs.writeFileSync(filePath, buffer)

  return filePath
}

/**
 * Register image editing tools with the MCP server
 */
export function registerImageEditTool(server: McpServer): void {
  // Start a new image editing session
  server.tool(
    'gemini-start-image-edit',
    {
      prompt: z
        .string()
        .describe('Initial prompt to generate the base image to edit'),
      aspectRatio: z
        .enum([
          '1:1',
          '2:3',
          '3:2',
          '3:4',
          '4:3',
          '4:5',
          '5:4',
          '9:16',
          '16:9',
          '21:9',
        ])
        .default('1:1')
        .describe('Aspect ratio for the image'),
      imageSize: z
        .enum(['1K', '2K', '4K'])
        .default('2K')
        .describe('Resolution: 1K (fast), 2K (balanced), 4K (highest quality)'),
      useGoogleSearch: z
        .boolean()
        .default(false)
        .describe('Ground the image in real-world info via Google Search'),
    },
    async ({ prompt, aspectRatio, imageSize, useGoogleSearch }) => {
      logger.info(`Starting image edit session: ${prompt.substring(0, 50)}...`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const imageModel =
          process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview'

        // Create a chat session for multi-turn editing
        // The SDK handles thought signatures automatically in chat mode
        const chatConfig: Record<string, unknown> = {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        }

        if (useGoogleSearch) {
          chatConfig.tools = [{ googleSearch: {} }]
        }

        const chat = genAI.chats.create({
          model: imageModel,
          config: chatConfig,
        })

        // Send the initial prompt
        const response = await chat.sendMessage({ message: prompt })

        // Extract image from response
        const parts = response.candidates?.[0]?.content?.parts
        if (!parts) {
          throw new Error('No parts in response')
        }

        let imageData: string | undefined
        let mimeType = 'image/png'
        let description: string | undefined

        for (const part of parts) {
          if ((part as { inlineData?: { data: string; mimeType?: string } }).inlineData) {
            const inlineData = (part as { inlineData: { data: string; mimeType?: string } }).inlineData
            imageData = inlineData.data
            mimeType = inlineData.mimeType || 'image/png'
          } else if ((part as { text?: string }).text) {
            description = (part as { text: string }).text
          }
        }

        if (!imageData) {
          throw new Error('No image data in response')
        }

        // Generate session ID and store the chat
        const sessionId = `edit-${Date.now()}-${Math.random().toString(36).substring(7)}`
        activeEditSessions.set(sessionId, {
          chat,
          lastImageBase64: imageData,
          lastImageMimeType: mimeType,
        })

        // Save to disk
        const filePath = saveImage(imageData, mimeType)

        logger.info(`Image edit session started: ${sessionId}`)

        return {
          content: [
            {
              type: 'image' as const,
              data: imageData,
              mimeType,
            },
            {
              type: 'text' as const,
              text: `Image edit session started!\n\nSession ID: ${sessionId}\nSettings: ${imageSize}, ${aspectRatio}${useGoogleSearch ? ', with Google Search' : ''}\nSaved to: ${filePath}\n\nUse gemini-continue-image-edit with this session ID to make changes.${description ? `\n\nGemini's description: ${description}` : ''}`,
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error starting image edit session: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error starting image edit session: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Continue editing in an existing session
  server.tool(
    'gemini-continue-image-edit',
    {
      sessionId: z.string().describe('The session ID from gemini-start-image-edit'),
      prompt: z
        .string()
        .describe(
          'Edit instruction (e.g., "make it warmer", "add mountains in the background", "change to night time")'
        ),
    },
    async ({ sessionId, prompt }) => {
      logger.info(`Continuing image edit: ${prompt.substring(0, 50)}...`)

      try {
        const session = activeEditSessions.get(sessionId)
        if (!session) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Session not found: ${sessionId}\n\nActive sessions may have expired. Start a new session with gemini-start-image-edit.`,
              },
            ],
            isError: true,
          }
        }

        // Send the edit instruction
        const chat = session.chat as { sendMessage: (opts: { message: string }) => Promise<unknown> }
        const response = await chat.sendMessage({ message: prompt }) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ inlineData?: { data: string; mimeType?: string }; text?: string }>
            }
          }>
        }

        // Extract image from response
        const parts = response.candidates?.[0]?.content?.parts
        if (!parts) {
          throw new Error('No parts in response')
        }

        let imageData: string | undefined
        let mimeType = 'image/png'
        let description: string | undefined

        for (const part of parts) {
          if (part.inlineData) {
            imageData = part.inlineData.data
            mimeType = part.inlineData.mimeType || 'image/png'
          } else if (part.text) {
            description = part.text
          }
        }

        if (!imageData) {
          // Sometimes the model responds with just text (explanation)
          return {
            content: [
              {
                type: 'text' as const,
                text: description || 'No image generated. Try a different edit instruction.',
              },
            ],
          }
        }

        // Update session with new image
        session.lastImageBase64 = imageData
        session.lastImageMimeType = mimeType

        // Save to disk
        const filePath = saveImage(imageData, mimeType)

        logger.info(`Image edit continued successfully`)

        return {
          content: [
            {
              type: 'image' as const,
              data: imageData,
              mimeType,
            },
            {
              type: 'text' as const,
              text: `Image updated!\n\nSession ID: ${sessionId}\nSaved to: ${filePath}\n\nContinue editing with more instructions or start a new session.${description ? `\n\nGemini's description: ${description}` : ''}`,
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error continuing image edit: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error continuing image edit: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // End/close an editing session
  server.tool(
    'gemini-end-image-edit',
    {
      sessionId: z.string().describe('The session ID to close'),
    },
    async ({ sessionId }) => {
      const session = activeEditSessions.get(sessionId)
      if (!session) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Session not found or already closed: ${sessionId}`,
            },
          ],
        }
      }

      // Remove the session
      activeEditSessions.delete(sessionId)
      logger.info(`Image edit session closed: ${sessionId}`)

      return {
        content: [
          {
            type: 'text' as const,
            text: `Session ${sessionId} closed successfully.`,
          },
        ],
      }
    }
  )

  // List active editing sessions
  server.tool(
    'gemini-list-image-sessions',
    {},
    async () => {
      const sessions = Array.from(activeEditSessions.keys())

      if (sessions.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No active image editing sessions.\n\nStart one with gemini-start-image-edit.',
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Active image editing sessions:\n\n${sessions.map((id) => `• ${id}`).join('\n')}\n\nUse gemini-continue-image-edit with a session ID to continue editing.`,
          },
        ],
      }
    }
  )
}
