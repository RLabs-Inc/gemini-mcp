/**
 * Image Generation Tool - Generate images using Gemini's Nano Banana Pro model
 *
 * This tool generates actual images from text descriptions and returns them
 * both as base64 (for Claude to view) and saves them to disk (for user access).
 *
 * Nano Banana Pro Features:
 * - Up to 4K resolution
 * - 10 aspect ratios
 * - Google Search grounding for real-world accuracy
 * - High-fidelity text rendering
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { generateImage, getOutputDir, type AspectRatio, type ImageSize } from '../gemini-client.js'
import { logger } from '../utils/logger.js'

/**
 * Register image generation tools with the MCP server
 */
export function registerImageGenTool(server: McpServer): void {
  // Image generation tool with full Nano Banana Pro capabilities
  server.tool(
    'gemini-generate-image',
    {
      prompt: z.string().describe('Description of the image to generate'),
      style: z
        .string()
        .optional()
        .describe('Art style (e.g., "photorealistic", "watercolor", "anime", "oil painting", "cyberpunk")'),
      aspectRatio: z
        .enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'])
        .default('1:1')
        .describe('Aspect ratio: 1:1 (square), 16:9 (widescreen), 9:16 (portrait/mobile), 21:9 (ultrawide), etc.'),
      imageSize: z
        .enum(['1K', '2K', '4K'])
        .default('2K')
        .describe('Resolution: 1K (fast), 2K (balanced, default), 4K (highest quality)'),
      useGoogleSearch: z
        .boolean()
        .default(false)
        .describe(
          'Ground the image in real-world info via Google Search (useful for current events, real places, etc.)'
        ),
    },
    async ({ prompt, style, aspectRatio, imageSize, useGoogleSearch }) => {
      logger.info(`Generating ${imageSize} image: ${prompt.substring(0, 50)}...`)

      try {
        const result = await generateImage(prompt, {
          aspectRatio: aspectRatio as AspectRatio,
          imageSize: imageSize as ImageSize,
          style,
          saveToFile: true,
          useGoogleSearch,
        })

        // Return the image in MCP format - Claude will be able to SEE this!
        const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [
          {
            type: 'image',
            data: result.base64,
            mimeType: result.mimeType,
          },
          {
            type: 'text',
            text: `Image generated successfully!\n\nSettings: ${imageSize}, ${aspectRatio}${useGoogleSearch ? ', with Google Search grounding' : ''}\nSaved to: ${result.filePath}\nOutput directory: ${getOutputDir()}${result.description ? `\n\nGemini's description: ${result.description}` : ''}`,
          },
        ]

        return { content }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error generating image: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating image: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Legacy image prompt tool (for compatibility) - generates text prompts for other tools
  server.tool(
    'gemini-image-prompt',
    {
      description: z.string().describe('Description of the image to generate a prompt for'),
      style: z.string().optional().describe('The artistic style for the image'),
      mood: z.string().optional().describe('The mood or atmosphere of the image'),
      details: z.string().optional().describe('Additional details to include'),
    },
    async ({ description, style, mood, details }) => {
      logger.info(`Generating image prompt for: ${description}`)

      try {
        // Import the text generation function
        const { generateWithGeminiPro } = await import('../gemini-client.js')

        const prompt = `
You are an expert at creating detailed text-to-image prompts for generative AI art tools.
Based on the following description, create a highly detailed, structured prompt that would produce the best possible image.

Description: ${description}
${style ? `Style: ${style}` : ''}
${mood ? `Mood: ${mood}` : ''}
${details ? `Additional details: ${details}` : ''}

Format your response as follows:
1. A refined one-paragraph image prompt that's highly detailed and descriptive
2. Key elements that should be emphasized
3. Technical suggestions (like camera angle, lighting, etc.)
4. Style references that would work well

Use detail-rich, vivid language that generative AI image models would respond well to.
`

        const response = await generateWithGeminiPro(prompt)

        return {
          content: [
            {
              type: 'text' as const,
              text: response,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error generating image prompt: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
