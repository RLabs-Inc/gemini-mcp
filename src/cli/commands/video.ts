/**
 * Video Command
 *
 * Generate videos with Gemini's Veo model.
 * gemini video "a cat playing piano"
 */

import { parseArgs } from 'node:util'
import { initGeminiClient, startVideoGeneration, checkVideoStatus } from '../../gemini-client.js'
import { setupLogger } from '../../utils/logger.js'
import { spinner, progress, print, printError, printSuccess, printMuted, printWarning, t, header, box } from '../ui/index.js'

function showHelp(): void {
  const theme = t()

  print(header('gemini video', 'Generate videos with AI'))
  print('')

  print(theme.colors.primary('Usage:'))
  print(`  gemini video ${theme.colors.muted('"your prompt"')} [options]`)
  print('')

  print(theme.colors.primary('Options:'))
  print(`  ${theme.colors.highlight('--ratio, -r')}    ${theme.colors.muted('Aspect ratio: 16:9, 9:16 (default: 16:9)')}`)
  print(`  ${theme.colors.highlight('--wait, -w')}     ${theme.colors.muted('Wait for completion (can take several minutes)')}`)
  print(`  ${theme.colors.highlight('--negative')}     ${theme.colors.muted('Things to avoid (e.g., "text, watermarks")')}`)
  print(`  ${theme.colors.highlight('--help, -h')}     ${theme.colors.muted('Show this help')}`)
  print('')

  print(theme.colors.primary('Examples:'))
  print(theme.colors.muted('  gemini video "a cat playing piano"'))
  print(theme.colors.muted('  gemini video "sunset timelapse" --ratio 16:9 --wait'))
  print(theme.colors.muted('  gemini video "robot dancing" -r 9:16 --negative "text, blur"'))
  print('')

  print(theme.colors.warning(`${theme.symbols.warning} Video generation can take 2-5 minutes`))
}

export async function videoCommand(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      ratio: { type: 'string', short: 'r', default: '16:9' },
      wait: { type: 'boolean', short: 'w', default: false },
      negative: { type: 'string' },
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
    printError('No video prompt provided')
    printMuted('Usage: gemini video "your prompt"')
    process.exit(1)
  }

  const theme = t()
  const s = spinner()
  const ratio = values.ratio as string
  const shouldWait = values.wait as boolean
  const negativePrompt = values.negative as string | undefined

  // Validate ratio
  if (ratio !== '16:9' && ratio !== '9:16') {
    printError(`Invalid ratio: ${ratio}`)
    printMuted('Valid ratios: 16:9, 9:16')
    process.exit(1)
  }

  try {
    // Suppress logger output for CLI
    setupLogger('quiet')

    // Initialize Gemini client
    s.start('Connecting to Gemini...')
    await initGeminiClient()

    // Start video generation
    s.update('Starting video generation...')
    const result = await startVideoGeneration(prompt, {
      aspectRatio: ratio as '16:9' | '9:16',
      negativePrompt,
    })

    if (!result.operationName) {
      throw new Error('Failed to start video generation')
    }

    s.success('Video generation started!')
    print('')

    // Show info
    const infoLines = [
      `${theme.colors.primary('Operation:')} ${result.operationName}`,
      `${theme.colors.primary('Prompt:')} ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`,
      `${theme.colors.primary('Ratio:')} ${ratio}`,
      negativePrompt ? `${theme.colors.primary('Avoid:')} ${negativePrompt}` : null,
      `${theme.colors.primary('Status:')} ${theme.colors.warning('Processing')}`,
    ].filter(Boolean) as string[]

    print(box(infoLines, { title: 'Video Generation' }))
    print('')

    if (!shouldWait) {
      // Not waiting - give instructions
      print(theme.colors.info(`${theme.symbols.info} Video is being generated in the background.`))
      print('')
      print('Check status with the MCP tool: gemini-check-video')
      print('')
      print(theme.colors.muted('Video generation typically takes 2-5 minutes.'))
      return
    }

    // Wait for completion
    print(theme.colors.info(`${theme.symbols.info} Waiting for video to complete...`))
    print(theme.colors.muted('This typically takes 2-5 minutes. Press Ctrl+C to exit.'))
    print('')

    const p = progress({ total: 100, showEta: false })
    p.start('Generating video')

    let attempts = 0
    const maxAttempts = 60 // 10 seconds * 60 = 10 minutes max
    const pollInterval = 10000 // 10 seconds

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      attempts++

      // Update progress (fake progress)
      const fakeProgress = Math.min(95, attempts * 3)
      p.update(fakeProgress, `Generating video (${attempts * 10}s)`)

      try {
        const status = await checkVideoStatus(result.operationName)

        if (status.status === 'completed' && status.filePath) {
          p.done('Video complete!')
          print('')

          // Get file stats
          const file = Bun.file(status.filePath)
          const fileSize = file.size

          const resultLines = [
            `${theme.colors.primary('File:')} ${status.filePath}`,
            `${theme.colors.primary('Size:')} ${(fileSize / (1024 * 1024)).toFixed(1)} MB`,
          ]

          print(box(resultLines, { title: 'Video Ready' }))
          print('')

          printSuccess(`Video saved to: ${status.filePath}`)
          print('')
          print(theme.colors.muted(`Open with: open "${status.filePath}"`))

          return
        } else if (status.status === 'failed') {
          p.fail('Video generation failed')
          printError(status.error || 'Unknown error')
          process.exit(1)
        }
        // Still processing, continue
      } catch (error) {
        // Polling error - continue trying
      }
    }

    // Timed out
    p.fail('Video generation timed out')
    printWarning('Video may still be generating.')

  } catch (error) {
    s.error('Video generation failed')
    printError(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
