/**
 * Query Command
 *
 * Direct queries to Gemini with thinking level control.
 * gemini query "your prompt" [--thinking high]
 */

import { parseArgs } from 'node:util'
import { initGeminiClient, generateWithGeminiPro, generateWithGeminiFlash } from '../../gemini-client.js'
import { setupLogger } from '../../utils/logger.js'
import { spinner, print, printError, printMuted, t, header } from '../ui/index.js'

interface QueryOptions {
  prompt: string
  thinking: 'minimal' | 'low' | 'medium' | 'high'
  model: 'pro' | 'flash'
}

function showHelp(): void {
  const theme = t()

  print(header('gemini query', 'Query Gemini directly'))
  print('')

  print(theme.colors.primary('Usage:'))
  print(`  gemini query ${theme.colors.muted('"your prompt"')} [options]`)
  print('')

  print(theme.colors.primary('Options:'))
  print(`  ${theme.colors.highlight('--thinking, -t')}  ${theme.colors.muted('Thinking level: minimal, low, medium, high (default: high)')}`)
  print(`  ${theme.colors.highlight('--model, -m')}     ${theme.colors.muted('Model to use: pro, flash (default: pro)')}`)
  print(`  ${theme.colors.highlight('--help, -h')}      ${theme.colors.muted('Show this help')}`)
  print('')

  print(theme.colors.primary('Examples:'))
  print(theme.colors.muted('  gemini query "What is the meaning of life?"'))
  print(theme.colors.muted('  gemini query "Explain quantum computing" --thinking high'))
  print(theme.colors.muted('  gemini query "Quick fact check" -t minimal -m flash'))
}

export async function queryCommand(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      thinking: { type: 'string', short: 't', default: 'high' },
      model: { type: 'string', short: 'm', default: 'pro' },
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
    printError('No prompt provided')
    printMuted('Usage: gemini query "your prompt"')
    process.exit(1)
  }

  // Validate thinking level
  const validThinking = ['minimal', 'low', 'medium', 'high']
  const thinking = values.thinking as string
  if (!validThinking.includes(thinking)) {
    printError(`Invalid thinking level: ${thinking}`)
    printMuted(`Valid options: ${validThinking.join(', ')}`)
    process.exit(1)
  }

  // Validate model
  const validModels = ['pro', 'flash']
  const model = values.model as string
  if (!validModels.includes(model)) {
    printError(`Invalid model: ${model}`)
    printMuted(`Valid options: ${validModels.join(', ')}`)
    process.exit(1)
  }

  const theme = t()
  const s = spinner()

  try {
    // Suppress logger output for CLI (we use our own spinner/output)
    setupLogger('quiet')

    // Initialize Gemini client
    s.start('Connecting to Gemini...')
    await initGeminiClient()

    // Query Gemini based on model
    s.update(`Thinking (${thinking})...`)
    const options = {
      thinkingLevel: thinking as 'minimal' | 'low' | 'medium' | 'high'
    }

    const result = model === 'flash'
      ? await generateWithGeminiFlash(prompt, options)
      : await generateWithGeminiPro(prompt, options)

    s.success('Response received')
    print('')

    // Show the response
    print(theme.colors.primary('Response:'))
    print('')
    print(result)
    print('')

  } catch (error) {
    s.error('Query failed')
    printError(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
