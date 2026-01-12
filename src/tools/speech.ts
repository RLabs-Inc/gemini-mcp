/**
 * Speech Generation Tool - Text-to-Speech with Gemini
 *
 * Generate high-quality speech from text using Gemini's native TTS.
 * Features:
 * - 30 voice options with different tones and styles
 * - Multi-speaker support (up to 2 speakers)
 * - Controllable style, accent, pace via natural language
 * - 24 language support
 *
 * Output: WAV files saved to the output directory
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleGenAI, Modality } from '@google/genai'
import { logger } from '../utils/logger.js'
import { ensureOutputDir } from '../utils/output-dir.js'
import * as fs from 'fs'
import * as path from 'path'

// Save PCM audio as WAV file
function saveWavFile(
  filename: string,
  pcmData: Buffer,
  channels = 1,
  sampleRate = 24000,
  bitsPerSample = 16
): string {
  const outputDir = ensureOutputDir()
  const filePath = path.join(outputDir, filename)

  // Create WAV header
  const byteRate = (sampleRate * channels * bitsPerSample) / 8
  const blockAlign = (channels * bitsPerSample) / 8
  const dataSize = pcmData.length
  const headerSize = 44
  const fileSize = headerSize + dataSize - 8

  const header = Buffer.alloc(headerSize)

  // RIFF header
  header.write('RIFF', 0)
  header.writeUInt32LE(fileSize, 4)
  header.write('WAVE', 8)

  // fmt chunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // chunk size
  header.writeUInt16LE(1, 20) // audio format (PCM)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)

  // data chunk
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  // Write file
  fs.writeFileSync(filePath, Buffer.concat([header, pcmData]))

  return filePath
}

// Available voices
const VOICES = [
  'Zephyr',
  'Puck',
  'Charon',
  'Kore',
  'Fenrir',
  'Leda',
  'Orus',
  'Aoede',
  'Callirrhoe',
  'Autonoe',
  'Enceladus',
  'Iapetus',
  'Umbriel',
  'Algieba',
  'Despina',
  'Erinome',
  'Algenib',
  'Rasalgethi',
  'Laomedeia',
  'Achernar',
  'Alnilam',
  'Schedar',
  'Gacrux',
  'Pulcherrima',
  'Achird',
  'Zubenelgenubi',
  'Vindemiatrix',
  'Sadachbia',
  'Sadaltager',
  'Sulafat',
] as const

type Voice = (typeof VOICES)[number]

/**
 * Register speech generation tools with the MCP server
 */
export function registerSpeechTool(server: McpServer): void {
  // Single speaker TTS
  server.tool(
    'gemini-speak',
    {
      text: z.string().describe('The text to convert to speech'),
      voice: z
        .enum(VOICES)
        .default('Kore')
        .describe(
          'Voice to use. Popular: Kore (firm), Puck (upbeat), Zephyr (bright), Charon (informative), Aoede (breezy)'
        ),
      style: z
        .string()
        .optional()
        .describe(
          'Style instructions (e.g., "cheerfully", "in a spooky whisper", "with excitement")'
        ),
    },
    async ({ text, voice, style }) => {
      logger.info(`Speech generation: ${text.substring(0, 50)}...`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = 'gemini-2.5-flash-preview-tts'

        // Build prompt with optional style
        const prompt = style ? `Say ${style}: "${text}"` : text

        // Generate speech
        const response = await genAI.models.generateContent({
          model,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        })

        // Extract audio data
        const audioData =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
        if (!audioData) {
          throw new Error('No audio data in response')
        }

        // Save as WAV
        const audioBuffer = Buffer.from(audioData, 'base64')
        const timestamp = Date.now()
        const filename = `speech-${timestamp}.wav`
        const filePath = saveWavFile(filename, audioBuffer)

        logger.info(`Speech saved to: ${filePath}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Speech generated successfully!\n\n**Voice:** ${voice}\n**File:** ${filePath}\n**Duration:** ~${Math.round(audioBuffer.length / 48000)}s\n\nThe audio file has been saved and can be played with any audio player.`,
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in speech generation: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating speech: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Multi-speaker TTS (for dialogues/podcasts)
  server.tool(
    'gemini-dialogue',
    {
      script: z
        .string()
        .describe(
          'The dialogue script with speaker names. Format: "Speaker1: line\\nSpeaker2: line"'
        ),
      speaker1: z.string().describe('Name of first speaker as used in script'),
      speaker1Voice: z
        .enum(VOICES)
        .default('Kore')
        .describe('Voice for speaker 1'),
      speaker2: z.string().describe('Name of second speaker as used in script'),
      speaker2Voice: z
        .enum(VOICES)
        .default('Puck')
        .describe('Voice for speaker 2'),
      style: z
        .string()
        .optional()
        .describe(
          'Style instructions for the dialogue (e.g., "Make Speaker1 sound tired, Speaker2 excited")'
        ),
    },
    async ({
      script,
      speaker1,
      speaker1Voice,
      speaker2,
      speaker2Voice,
      style,
    }) => {
      logger.info(`Dialogue generation: ${speaker1} & ${speaker2}`)

      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY not set')
        }

        const genAI = new GoogleGenAI({ apiKey })
        const model = 'gemini-2.5-flash-preview-tts'

        // Build prompt
        let prompt = script
        if (style) {
          prompt = `${style}\n\n${script}`
        }

        // Generate multi-speaker speech
        const response = await genAI.models.generateContent({
          model,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: speaker1,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: speaker1Voice },
                    },
                  },
                  {
                    speaker: speaker2,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: speaker2Voice },
                    },
                  },
                ],
              },
            },
          },
        })

        // Extract audio data
        const audioData =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
        if (!audioData) {
          throw new Error('No audio data in response')
        }

        // Save as WAV
        const audioBuffer = Buffer.from(audioData, 'base64')
        const timestamp = Date.now()
        const filename = `dialogue-${timestamp}.wav`
        const filePath = saveWavFile(filename, audioBuffer)

        logger.info(`Dialogue saved to: ${filePath}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Dialogue generated successfully!\n\n**Speakers:**\n- ${speaker1}: ${speaker1Voice}\n- ${speaker2}: ${speaker2Voice}\n\n**File:** ${filePath}\n**Duration:** ~${Math.round(audioBuffer.length / 48000)}s`,
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error in dialogue generation: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating dialogue: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // List available voices
  server.tool('gemini-list-voices', {}, async () => {
    const voiceDescriptions: Record<string, string> = {
      Zephyr: 'Bright',
      Puck: 'Upbeat',
      Charon: 'Informative',
      Kore: 'Firm',
      Fenrir: 'Excitable',
      Leda: 'Youthful',
      Orus: 'Firm',
      Aoede: 'Breezy',
      Callirrhoe: 'Easy-going',
      Autonoe: 'Bright',
      Enceladus: 'Breathy',
      Iapetus: 'Clear',
      Umbriel: 'Easy-going',
      Algieba: 'Smooth',
      Despina: 'Smooth',
      Erinome: 'Clear',
      Algenib: 'Gravelly',
      Rasalgethi: 'Informative',
      Laomedeia: 'Upbeat',
      Achernar: 'Soft',
      Alnilam: 'Firm',
      Schedar: 'Even',
      Gacrux: 'Mature',
      Pulcherrima: 'Forward',
      Achird: 'Friendly',
      Zubenelgenubi: 'Casual',
      Vindemiatrix: 'Gentle',
      Sadachbia: 'Lively',
      Sadaltager: 'Knowledgeable',
      Sulafat: 'Warm',
    }

    let text = '**Available Voices for Speech Generation:**\n\n'
    for (const voice of VOICES) {
      text += `- **${voice}** - ${voiceDescriptions[voice] || ''}\n`
    }
    text +=
      '\n*Use these voices with gemini-speak or gemini-dialogue tools.*'

    return {
      content: [
        {
          type: 'text' as const,
          text,
        },
      ],
    }
  })
}
