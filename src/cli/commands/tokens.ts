/**
 * Tokens Command
 *
 * Count tokens in text or files.
 * gcli tokens "your text"
 * gcli tokens @file.txt
 */

import { parseArgs } from 'node:util'
import { initGeminiClient, countTokens } from '../../gemini-client.js'
import { setupLogger } from '../../utils/logger.js'
import { spinner, print, printError, printMuted, t, header, box } from '../ui/index.js'

function showHelp(): void {
  const theme = t()

  print(header('gcli tokens', 'Count tokens in text or files'))
  print('')

  print(theme.colors.primary('Usage:'))
  print(`  gcli tokens ${theme.colors.muted('"your text"')}`)
  print(`  gcli tokens ${theme.colors.muted('@file.txt')}`)
  print('')

  print(theme.colors.primary('Options:'))
  print(
    `  ${theme.colors.highlight('--model, -m')}  ${theme.colors.muted('Model for tokenization: pro, flash (default: flash)')}`
  )
  print(`  ${theme.colors.highlight('--help, -h')}   ${theme.colors.muted('Show this help')}`)
  print('')

  print(theme.colors.primary('Examples:'))
  print(theme.colors.muted('  gcli tokens "Hello, world!"'))
  print(theme.colors.muted('  gcli tokens @README.md'))
  print(theme.colors.muted('  gcli tokens @src/index.ts --model pro'))
}

export async function tokensCommand(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      model: { type: 'string', short: 'm', default: 'flash' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    showHelp()
    return
  }

  // Get input from positional args
  const input = positionals.join(' ')
  if (!input) {
    printError('No text or file provided')
    printMuted('Usage: gcli tokens "your text" or gcli tokens @file.txt')
    process.exit(1)
  }

  const theme = t()
  const s = spinner()

  try {
    // Suppress logger output for CLI
    setupLogger('quiet')

    // Check if input is a file reference
    let text: string
    let source: string

    if (input.startsWith('@')) {
      const filePath = input.slice(1)
      s.start(`Reading ${filePath}...`)

      const file = Bun.file(filePath)
      const exists = await file.exists()

      if (!exists) {
        s.error(`File not found: ${filePath}`)
        process.exit(1)
      }

      text = await file.text()
      source = filePath
    } else {
      text = input
      source = 'text input'
    }

    // Initialize Gemini client
    s.update('Connecting to Gemini...')
    await initGeminiClient()

    // Count tokens
    s.update('Counting tokens...')
    const model = values.model as 'pro' | 'flash'
    const result = await countTokens(text, model)

    s.success('Token count complete')
    print('')

    // Display results in a nice box
    const lines = [
      `${theme.colors.primary('Source:')} ${source}`,
      `${theme.colors.primary('Model:')} ${model}`,
      `${theme.colors.primary('Tokens:')} ${theme.colors.highlight(result.totalTokens.toLocaleString())}`,
    ]

    // Add character count for context
    lines.push(`${theme.colors.muted('Characters:')} ${text.length.toLocaleString()}`)

    // Estimate cost (rough estimates based on typical pricing)
    // Input: ~$0.075 per 1M tokens for Flash, ~$1.25 per 1M tokens for Pro
    const costPer1M = model === 'flash' ? 0.075 : 1.25
    const estimatedCost = (result.totalTokens / 1_000_000) * costPer1M
    if (estimatedCost > 0.0001) {
      lines.push(`${theme.colors.muted('Est. cost:')} $${estimatedCost.toFixed(6)}`)
    }

    print(box(lines, { title: 'Token Count' }))
    print('')
  } catch (error) {
    s.error('Token count failed')
    printError(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
