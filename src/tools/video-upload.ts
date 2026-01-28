/**
 * Video Upload Tool - Analyze local video files and inline video data
 *
 * Complements the YouTube analysis tool by supporting:
 * 1. Local video files - Upload and analyze video files from disk
 * 2. Inline video data - Process base64-encoded video content
 *
 * Features:
 * - Video summarization
 * - Q&A about video content
 * - Timestamp-based analysis (clipping)
 * - Audio and visual understanding
 * - Automatic file size handling (inline vs Files API)
 *
 * Supported formats: MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V, MPG, MPEG, 3GP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { logger } from '../utils/logger.js'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Get MIME type from video file extension
 */
function getVideoMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv',
    '.m4v': 'video/mp4',
    '.mpg': 'video/mpeg',
    '.mpeg': 'video/mpeg',
    '.3gp': 'video/3gpp',
  }
  return mimeTypes[ext] || 'video/mp4'
}

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
 * Register video upload tools with the MCP server
 */
export function registerVideoUploadTool(server: McpServer): void {
  // Main tool for local video file analysis
  server.tool(
    'gemini-analyze-video',
    {
      videoPath: z
        .string()
        .optional()
        .describe('Path to local video file (MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V, MPG, MPEG, 3GP)'),
      videoData: z
        .string()
        .optional()
        .describe('Base64-encoded video data (for inline video processing)'),
      mimeType: z
        .string()
        .optional()
        .describe('MIME type when using videoData (e.g., "video/mp4", "video/quicktime"). Defaults to "video/mp4".'),
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
      mediaResolution: z
        .enum(['low', 'medium', 'high'])
        .default('medium')
        .describe('Resolution for processing: low (faster), medium (balanced), high (more detail)'),
    },
    async ({ videoPath, videoData, mimeType, question, startTime, endTime, mediaResolution }) => {
      // Validate input
      if (!videoPath && !videoData) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: Please provide either videoPath or videoData parameter',
            },
          ],
          isError: true,
        }
      }

      const inputType = videoPath ? 'local file' : 'inline data'
      logger.info(`Video analysis: ${inputType}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-preview'

        // Map resolution to API parameter
        const resolutionMap: Record<string, unknown> = {
          low: 'media_resolution_low',
          medium: 'media_resolution_medium',
          high: 'media_resolution_high',
        }

        const config: Record<string, unknown> = {}
        if (mediaResolution !== 'medium') {
          config.mediaResolution = resolutionMap[mediaResolution]
        }

        let videoPart: Record<string, unknown>

        // Route 1: Local video file
        if (videoPath) {
          logger.debug(`Processing local video file: ${videoPath}`)

          // Check file exists
          if (!fs.existsSync(videoPath)) {
            throw new Error(`File not found: ${videoPath}`)
          }

          const fileBuffer = fs.readFileSync(videoPath)
          const videoMimeType = getVideoMimeType(videoPath)
          const fileSize = fileBuffer.length

          logger.debug(`Video size: ${fileSize} bytes, MIME type: ${videoMimeType}`)

          // For small files (<20MB), use inline data
          // For larger files, use Files API
          if (fileSize > 20 * 1024 * 1024) {
            logger.info('Large video file detected, uploading via Files API...')

            const uploadedFile = await genAI.files.upload({
              file: new Blob([fileBuffer], { type: videoMimeType }),
              config: { mimeType: videoMimeType },
            })

            videoPart = {
              fileData: {
                fileUri: uploadedFile.uri,
                mimeType: uploadedFile.mimeType,
              },
            }
          } else {
            // Use inline data for smaller files
            const base64Data = fileBuffer.toString('base64')
            videoPart = {
              inlineData: {
                mimeType: videoMimeType,
                data: base64Data,
              },
            }
          }
        }
        // Route 2: Inline video data (base64)
        else if (videoData) {
          logger.debug('Processing inline video data')
          const videoMimeType = mimeType || 'video/mp4'

          videoPart = {
            inlineData: {
              mimeType: videoMimeType,
              data: videoData,
            },
          }
        } else {
          throw new Error('No valid video input provided')
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
          config: Object.keys(config).length > 0 ? config : undefined,
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

        logger.info(`Video analysis completed successfully (${inputType})`)

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
        logger.error(`Error in video analysis: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error analyzing video: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Convenience tool for video summarization
  server.tool(
    'gemini-summarize-video',
    {
      videoPath: z
        .string()
        .optional()
        .describe('Path to local video file'),
      videoData: z
        .string()
        .optional()
        .describe('Base64-encoded video data'),
      mimeType: z
        .string()
        .optional()
        .describe('MIME type when using videoData (defaults to "video/mp4")'),
      style: z
        .enum(['brief', 'detailed', 'bullet-points', 'chapters'])
        .default('brief')
        .describe('Summary style'),
      mediaResolution: z
        .enum(['low', 'medium', 'high'])
        .default('medium')
        .describe('Resolution for processing'),
    },
    async ({ videoPath, videoData, mimeType, style, mediaResolution }) => {
      // Validate input
      if (!videoPath && !videoData) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: Please provide either videoPath or videoData parameter',
            },
          ],
          isError: true,
        }
      }

      const inputType = videoPath ? 'local file' : 'inline data'
      logger.info(`Video summary: ${inputType}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = process.env.GEMINI_FLASH_MODEL || 'gemini-3-flash-preview'

        // Map resolution to API parameter
        const resolutionMap: Record<string, unknown> = {
          low: 'media_resolution_low',
          medium: 'media_resolution_medium',
          high: 'media_resolution_high',
        }

        const config: Record<string, unknown> = {}
        if (mediaResolution !== 'medium') {
          config.mediaResolution = resolutionMap[mediaResolution]
        }

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

        let videoPart: Record<string, unknown>

        // Route 1: Local video file
        if (videoPath) {
          logger.debug(`Processing local video file: ${videoPath}`)

          if (!fs.existsSync(videoPath)) {
            throw new Error(`File not found: ${videoPath}`)
          }

          const fileBuffer = fs.readFileSync(videoPath)
          const videoMimeType = getVideoMimeType(videoPath)
          const fileSize = fileBuffer.length

          logger.debug(`Video size: ${fileSize} bytes, MIME type: ${videoMimeType}`)

          if (fileSize > 20 * 1024 * 1024) {
            logger.info('Large video file detected, uploading via Files API...')

            const uploadedFile = await genAI.files.upload({
              file: new Blob([fileBuffer], { type: videoMimeType }),
              config: { mimeType: videoMimeType },
            })

            videoPart = {
              fileData: {
                fileUri: uploadedFile.uri,
                mimeType: uploadedFile.mimeType,
              },
            }
          } else {
            const base64Data = fileBuffer.toString('base64')
            videoPart = {
              inlineData: {
                mimeType: videoMimeType,
                data: base64Data,
              },
            }
          }
        }
        // Route 2: Inline video data
        else if (videoData) {
          logger.debug('Processing inline video data')
          const videoMimeType = mimeType || 'video/mp4'

          videoPart = {
            inlineData: {
              mimeType: videoMimeType,
              data: videoData,
            },
          }
        } else {
          throw new Error('No valid video input provided')
        }

        const contents = [
          {
            role: 'user',
            parts: [videoPart, { text: prompt }],
          },
        ]

        const response = await genAI.models.generateContent({
          model,
          contents,
          config: Object.keys(config).length > 0 ? config : undefined,
        })

        logger.info(`Video summary completed successfully (${inputType})`)

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
        logger.error(`Error in video summary: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error summarizing video: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
