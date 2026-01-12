/**
 * Image Command
 *
 * Generate images with Gemini's Imagen model.
 * gcli image "a cat in space"
 */

import { parseArgs } from 'node:util'
import { initGeminiClient, generateImage } from '../../gemini-client.js'
import { setupLogger } from '../../utils/logger.js'
import { spinner, print, printError, printSuccess, printMuted, t, header, box } from '../ui/index.js'

// Valid options
const VALID_SIZES = ['1K', '2K', '4K']
const VALID_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']

function showHelp(): void {
  const theme = t()

  print(header('gcli image', 'Generate images with AI'))
  print('')

  print(theme.colors.primary('Usage:'))
  print(`  gcli image ${theme.colors.muted('"your prompt"')} [options]`)
  print('')

  print(theme.colors.primary('Options:'))
  print(`  ${theme.colors.highlight('--size, -s')}     ${theme.colors.muted('Resolution: 1K, 2K, 4K (default: 2K)')}`)
  print(`  ${theme.colors.highlight('--ratio, -r')}    ${theme.colors.muted('Aspect ratio (default: 1:1)')}`)
  print(`  ${theme.colors.highlight('--output, -o')}   ${theme.colors.muted('Output file path')}`)
  print(`  ${theme.colors.highlight('--style')}        ${theme.colors.muted('Art style (e.g., "watercolor", "cyberpunk")')}`)
  print(`  ${theme.colors.highlight('--search')}       ${theme.colors.muted('Use Google Search for real-world accuracy')}`)
  print(`  ${theme.colors.highlight('--help, -h')}     ${theme.colors.muted('Show this help')}`)
  print('')

  print(theme.colors.primary('Aspect Ratios:'))
  print(theme.colors.muted('  1:1   - Square (default)'))
  print(theme.colors.muted('  16:9  - Widescreen landscape'))
  print(theme.colors.muted('  9:16  - Portrait/mobile'))
  print(theme.colors.muted('  4:3   - Classic landscape'))
  print(theme.colors.muted('  3:4   - Classic portrait'))
  print(theme.colors.muted('  21:9  - Ultrawide cinematic'))
  print('')

  print(theme.colors.primary('Examples:'))
  print(theme.colors.muted('  gcli image "a cat astronaut floating in space"'))
  print(theme.colors.muted('  gcli image "sunset over mountains" --ratio 16:9 --size 4K'))
  print(theme.colors.muted('  gcli image "portrait of a robot" -r 3:4 --style "oil painting"'))
  print(theme.colors.muted('  gcli image "Eiffel Tower at night" --search'))
}

export async function imageCommand(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      size: { type: 'string', short: 's', default: '2K' },
      ratio: { type: 'string', short: 'r', default: '1:1' },
      output: { type: 'string', short: 'o' },
      style: { type: 'string' },
      search: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })

  if (values.help) {
    showHelp()
    return
  }

  // Get prompt from positional args
  const prompt = positionals.join(' ')
  if (!prompt) {
    printError('No image prompt provided')
    printMuted('Usage: gcli image "your prompt"')
    process.exit(1)
  }

  const theme = t()
  const s = spinner()
  const size = values.size as string
  const ratio = values.ratio as string
  const style = values.style as string | undefined
  const useSearch = values.search as boolean

  // Validate size
  if (!VALID_SIZES.includes(size)) {
    printError(`Invalid size: ${size}`)
    printMuted(`Valid sizes: ${VALID_SIZES.join(', ')}`)
    process.exit(1)
  }

  // Validate ratio
  if (!VALID_RATIOS.includes(ratio)) {
    printError(`Invalid ratio: ${ratio}`)
    printMuted(`Valid ratios: ${VALID_RATIOS.join(', ')}`)
    process.exit(1)
  }

  try {
    // Suppress logger output for CLI
    setupLogger('quiet')

    // Initialize Gemini client
    s.start('Connecting to Gemini...')
    await initGeminiClient()

    // Build full prompt with style if provided
    let fullPrompt = prompt
    if (style) {
      fullPrompt = `${prompt}, in ${style} style`
    }

    // Generate image
    s.update('Generating image...')
    const result = await generateImage(fullPrompt, {
      aspectRatio: ratio as any, // Type assertion for ratio string
      imageSize: size as '1K' | '2K' | '4K',
      useGoogleSearch: useSearch,
    })

    if (!result.filePath) {
      throw new Error('Image generation failed - no file created')
    }

    s.success('Image generated!')
    print('')

    // Get file stats
    const file = Bun.file(result.filePath)
    const fileSize = file.size

    // Show info
    const infoLines = [
      `${theme.colors.primary('Prompt:')} ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`,
      style ? `${theme.colors.primary('Style:')} ${style}` : null,
      `${theme.colors.primary('Size:')} ${size}`,
      `${theme.colors.primary('Ratio:')} ${ratio}`,
      useSearch ? `${theme.colors.primary('Search:')} Enabled` : null,
      `${theme.colors.primary('File:')} ${result.filePath}`,
      `${theme.colors.primary('File Size:')} ${(fileSize / 1024).toFixed(1)} KB`,
    ].filter(Boolean) as string[]

    print(box(infoLines, { title: 'Image Generated' }))
    print('')

    printSuccess(`Image saved to: ${result.filePath}`)

    // Hint about opening
    print('')
    print(theme.colors.muted(`Open with: open "${result.filePath}"`))

  } catch (error) {
    s.error('Image generation failed')
    printError(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
