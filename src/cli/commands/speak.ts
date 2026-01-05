/**
 * Speak Command
 *
 * Text-to-speech with multiple voices.
 * gemini speak "your text" --voice Kore
 */

import { parseArgs } from 'node:util'
import { GoogleGenAI, Modality } from '@google/genai'
import { setupLogger } from '../../utils/logger.js'
import { getOutputDir } from '../../gemini-client.js'
import { spinner, print, printError, printSuccess, printMuted, t, header, box } from '../ui/index.js'
import { join } from 'node:path'

// Available voices
const VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
  'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba',
  'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
  'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi',
  'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'
]

function showHelp(): void {
  const theme = t()

  print(header('gemini speak', 'Text-to-speech'))
  print('')

  print(theme.colors.primary('Usage:'))
  print(`  gemini speak ${theme.colors.muted('"your text"')} [options]`)
  print('')

  print(theme.colors.primary('Options:'))
  print(`  ${theme.colors.highlight('--voice, -v')}    ${theme.colors.muted('Voice to use (default: Kore)')}`)
  print(`  ${theme.colors.highlight('--output, -o')}   ${theme.colors.muted('Output file path')}`)
  print(`  ${theme.colors.highlight('--style, -s')}    ${theme.colors.muted('Speaking style (e.g., "cheerfully", "sadly")')}`)
  print(`  ${theme.colors.highlight('--list-voices')} ${theme.colors.muted('List all available voices')}`)
  print(`  ${theme.colors.highlight('--help, -h')}     ${theme.colors.muted('Show this help')}`)
  print('')

  print(theme.colors.primary('Popular Voices:'))
  print(theme.colors.muted('  Kore     - Firm, authoritative'))
  print(theme.colors.muted('  Puck     - Upbeat, energetic'))
  print(theme.colors.muted('  Zephyr   - Bright, clear'))
  print(theme.colors.muted('  Charon   - Informative, calm'))
  print(theme.colors.muted('  Aoede    - Breezy, light'))
  print('')

  print(theme.colors.primary('Examples:'))
  print(theme.colors.muted('  gemini speak "Hello world!" --voice Puck'))
  print(theme.colors.muted('  gemini speak "Important message" -v Kore -o message.mp3'))
  print(theme.colors.muted('  gemini speak "Exciting news!" --style "enthusiastically"'))
  print(theme.colors.muted('  gemini speak --list-voices'))
}

function listVoices(): void {
  const theme = t()

  print(header('Available Voices', '30 TTS voices'))
  print('')

  // Group voices into columns
  const cols = 5
  const rows = Math.ceil(VOICES.length / cols)

  for (let row = 0; row < rows; row++) {
    let line = '  '
    for (let col = 0; col < cols; col++) {
      const idx = row + col * rows
      if (idx < VOICES.length) {
        const voice = VOICES[idx]
        line += voice.padEnd(16)
      }
    }
    print(theme.colors.muted(line))
  }
  print('')
}

export async function speakCommand(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      voice: { type: 'string', short: 'v', default: 'Kore' },
      output: { type: 'string', short: 'o' },
      style: { type: 'string', short: 's' },
      'list-voices': { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })

  if (values.help) {
    showHelp()
    return
  }

  if (values['list-voices']) {
    listVoices()
    return
  }

  // Get text from positional args
  const text = positionals.join(' ')
  if (!text) {
    printError('No text provided')
    printMuted('Usage: gemini speak "your text"')
    process.exit(1)
  }

  const theme = t()
  const s = spinner()
  const voice = values.voice as string
  const style = values.style as string | undefined

  // Validate voice
  if (!VOICES.includes(voice)) {
    printError(`Unknown voice: ${voice}`)
    printMuted(`Run 'gemini speak --list-voices' to see available voices`)
    process.exit(1)
  }

  try {
    // Suppress logger output for CLI
    setupLogger('quiet')

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set')
    }

    s.start(`Generating speech with ${voice}...`)

    const genAI = new GoogleGenAI({ apiKey })

    // Build prompt with optional style
    let prompt = text
    if (style) {
      prompt = `Say this ${style}: "${text}"`
    }

    // Generate speech
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: prompt,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    })

    // Extract audio data
    const candidate = response.candidates?.[0]
    if (!candidate?.content?.parts?.[0]) {
      throw new Error('No audio generated')
    }

    const part = candidate.content.parts[0]
    if (!('inlineData' in part) || !part.inlineData?.data) {
      throw new Error('No audio data in response')
    }

    // Determine output path
    const outputPath = values.output as string ||
      join(getOutputDir(), `speech-${Date.now()}.mp3`)

    // Save audio file
    const audioBuffer = Buffer.from(part.inlineData.data, 'base64')
    await Bun.write(outputPath, audioBuffer)

    s.success('Speech generated!')
    print('')

    // Show info
    const infoLines = [
      `${theme.colors.primary('Voice:')} ${voice}`,
      `${theme.colors.primary('Text:')} ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
      style ? `${theme.colors.primary('Style:')} ${style}` : null,
      `${theme.colors.primary('File:')} ${outputPath}`,
      `${theme.colors.primary('Size:')} ${(audioBuffer.length / 1024).toFixed(1)} KB`,
    ].filter(Boolean) as string[]

    print(box(infoLines, { title: 'Text-to-Speech' }))
    print('')

    printSuccess(`Audio saved to: ${outputPath}`)

  } catch (error) {
    s.error('Speech generation failed')
    printError(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
