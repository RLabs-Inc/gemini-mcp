/**
 * YouTube Analysis Tool - Analyze YouTube videos directly by URL
 *
 * Gemini can process YouTube videos natively, enabling:
 * - Video summarization
 * - Q&A about video content
 * - Timestamp-based analysis
 * - Audio and visual understanding
 *
 * Supports clipping intervals to analyze specific portions of videos.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { logger } from '../utils/logger.js'

/**
 * Parse time string to seconds (supports formats like "1m30s", "90s", "1:30", "90")
 */
function parseTimeToSeconds(time: string): string {
  // Handle MM:SS format
  if (time.includes(':')) {
    const [mins, secs] = time.split(':').map(Number)
    return `${mins * 60 + secs}s`
  }

  // Handle XmYs format
  const minMatch = time.match(/(\d+)m/)
  const secMatch = time.match(/(\d+)s/)
  const mins = minMatch ? parseInt(minMatch[1]) : 0
  const secs = secMatch ? parseInt(secMatch[1]) : 0

  if (mins > 0 || secMatch) {
    return `${mins * 60 + secs}s`
  }

  // Handle plain number (assume seconds)
  const num = parseInt(time)
  if (!isNaN(num)) {
    return `${num}s`
  }

  return time
}

/**
 * Register YouTube analysis tools with the MCP server
 */
export function registerYouTubeTool(server: McpServer): void {
  server.tool(
    'gemini-youtube',
    {
      url: z
        .string()
        .describe('YouTube video URL (e.g., https://www.youtube.com/watch?v=...)'),
      question: z
        .string()
        .describe('Question about the video or task to perform (e.g., "Summarize this video", "What happens at 2:30?")'),
      startTime: z
        .string()
        .optional()
        .describe('Start time for analysis (e.g., "1m30s", "90", "1:30"). Optional.'),
      endTime: z
        .string()
        .optional()
        .describe('End time for analysis (e.g., "5m00s", "300", "5:00"). Optional.'),
    },
    async ({ url, question, startTime, endTime }) => {
      logger.info(`YouTube analysis: ${url.substring(0, 50)}...`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        // Validate YouTube URL
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
          throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-preview'

        // Build the video part with optional clipping
        const videoPart: Record<string, unknown> = {
          fileData: {
            fileUri: url,
            mimeType: 'video/*',
          },
        }

        // Add video metadata for clipping if provided
        if (startTime || endTime) {
          const videoMetadata: Record<string, string> = {}
          if (startTime) {
            videoMetadata.startOffset = parseTimeToSeconds(startTime)
          }
          if (endTime) {
            videoMetadata.endOffset = parseTimeToSeconds(endTime)
          }
          videoPart.videoMetadata = videoMetadata
        }

        // Build contents
        const contents = [
          {
            role: 'user',
            parts: [videoPart, { text: question }],
          },
        ]

        // Execute
        const response = await genAI.models.generateContent({
          model,
          contents,
        })

        const responseText = response.text || ''

        // Build response with context
        let resultText = responseText
        if (startTime || endTime) {
          const clipInfo = []
          if (startTime) clipInfo.push(`from ${startTime}`)
          if (endTime) clipInfo.push(`to ${endTime}`)
          resultText = `*Analyzed video clip ${clipInfo.join(' ')}*\n\n${responseText}`
        }

        logger.info('YouTube analysis completed successfully')

        return {
          content: [
            {
              type: 'text' as const,
              text: resultText,
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in YouTube analysis: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error analyzing YouTube video: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Convenience tool for YouTube summarization
  server.tool(
    'gemini-youtube-summary',
    {
      url: z.string().describe('YouTube video URL'),
      style: z
        .enum(['brief', 'detailed', 'bullet-points', 'chapters'])
        .default('brief')
        .describe('Summary style'),
    },
    async ({ url, style }) => {
      logger.info(`YouTube summary: ${url.substring(0, 50)}...`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
          throw new Error('Invalid YouTube URL')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_FLASH_MODEL || 'gemini-3-flash-preview'

        // Build prompt based on style
        let prompt: string
        switch (style) {
          case 'brief':
            prompt = 'Summarize this video in 2-3 sentences.'
            break
          case 'detailed':
            prompt =
              'Provide a detailed summary of this video, covering all main points and key takeaways. Include relevant timestamps for important moments.'
            break
          case 'bullet-points':
            prompt =
              'Summarize this video as a bullet-point list of key points and takeaways.'
            break
          case 'chapters':
            prompt =
              'Create a chapter breakdown of this video with timestamps and descriptions for each section.'
            break
          default:
            prompt = 'Summarize this video.'
        }

        const contents = [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  fileUri: url,
                  mimeType: 'video/*',
                },
              },
              { text: prompt },
            ],
          },
        ]

        const response = await genAI.models.generateContent({
          model,
          contents,
        })

        logger.info('YouTube summary completed successfully')

        return {
          content: [
            {
              type: 'text' as const,
              text: response.text || 'Unable to generate summary.',
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in YouTube summary: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error summarizing YouTube video: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
