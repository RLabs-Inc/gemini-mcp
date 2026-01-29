#!/usr/bin/env bun

/**
 * Test Script for Video Upload Functionality
 *
 * This script tests the new gemini-analyze-video and gemini-summarize-video tools
 * with a local video file.
 *
 * Usage:
 *   bun test-video-upload.ts <path-to-video> [question]
 *
 * Examples:
 *   bun test-video-upload.ts ./sample.mp4
 *   bun test-video-upload.ts ./sample.mp4 "What happens in this video?"
 */

import { GoogleGenAI } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'

// Get video path from command line
const videoPath = process.argv[2]
const question = process.argv[3] || 'Summarize this video in 2-3 sentences.'

if (!videoPath) {
  console.log('Usage: bun test-video-upload.ts <path-to-video> [question]')
  console.log('')
  console.log('Examples:')
  console.log('  bun test-video-upload.ts ./sample.mp4')
  console.log('  bun test-video-upload.ts ./sample.mp4 "What happens in this video?"')
  process.exit(1)
}

// Check file exists
if (!fs.existsSync(videoPath)) {
  console.error(`Error: File not found: ${videoPath}`)
  process.exit(1)
}

// Get MIME type
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

async function testVideoAnalysis() {
  console.log('🎬 Testing Video Upload Functionality')
  console.log('=====================================')
  console.log('')

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is required')
    console.error('Set it with: export GEMINI_API_KEY=your_key_here')
    process.exit(1)
  }

  console.log(`📁 Video file: ${videoPath}`)

  // Read file
  const fileBuffer = fs.readFileSync(videoPath)
  const mimeType = getVideoMimeType(videoPath)
  const fileSize = fileBuffer.length
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2)

  console.log(`📊 File size: ${fileSizeMB} MB`)
  console.log(`🎞️  MIME type: ${mimeType}`)
  console.log(`❓ Question: ${question}`)
  console.log('')

  const genAI = new GoogleGenAI({ apiKey })
  const model = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-preview'

  try {
    let videoPart: Record<string, unknown>

    // Check file size and use appropriate method
    if (fileSize > 20 * 1024 * 1024) {
      console.log('⬆️  Uploading via Files API (large file)...')

      const uploadedFile = await genAI.files.upload({
        file: new Blob([fileBuffer], { type: mimeType }),
        config: { mimeType: mimeType },
      })

      console.log(`✅ Uploaded: ${uploadedFile.uri}`)
      console.log('')

      videoPart = {
        fileData: {
          fileUri: uploadedFile.uri,
          mimeType: uploadedFile.mimeType,
        },
      }
    } else {
      console.log('📤 Using inline data (small file)...')
      console.log('')

      const base64Data = fileBuffer.toString('base64')
      videoPart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      }
    }

    console.log('🤖 Analyzing video with Gemini...')
    console.log('')

    const response = await genAI.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [videoPart, { text: question }],
        },
      ],
    })

    const responseText = response.text || ''

    console.log('✨ Analysis Result:')
    console.log('==================')
    console.log(responseText)
    console.log('')
    console.log('✅ Test completed successfully!')

  } catch (error) {
    console.error('')
    console.error('❌ Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

// Run the test
testVideoAnalysis()
