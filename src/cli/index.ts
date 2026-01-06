/**
 * Gemini CLI Router
 *
 * Routes commands to their handlers and provides the main CLI interface.
 */

import { parseArgs } from 'node:util'
import { loadConfig, setCachedConfig, getApiKey } from './config.js'
import { setTheme, header, print, printError, printMuted, t } from './ui/index.js'

// Import commands
import { queryCommand } from './commands/query.js'
import { tokensCommand } from './commands/tokens.js'
import { searchCommand } from './commands/search.js'
import { researchCommand } from './commands/research.js'
import { speakCommand } from './commands/speak.js'
import { configCommand } from './commands/config.js'
import { imageCommand } from './commands/image.js'
import { videoCommand } from './commands/video.js'

const VERSION = '0.7.1'

interface Command {
  name: string
  description: string
  aliases?: string[]
  run: (args: string[]) => Promise<void>
}

// Placeholder command for development
const placeholderCommand = (name: string): Command => ({
  name,
  description: `${name} command (coming soon)`,
  run: async () => {
    printMuted(`${name} command not yet implemented`)
  },
})

const commands: Record<string, Command> = {
  query: {
    name: 'query',
    description: 'Query Gemini directly',
    run: queryCommand,
  },
  search: {
    name: 'search',
    description: 'Real-time web search',
    run: searchCommand,
  },
  tokens: {
    name: 'tokens',
    description: 'Count tokens in text or files',
    run: tokensCommand,
  },
  research: {
    name: 'research',
    description: 'Deep research agent',
    run: researchCommand,
  },
  image: {
    name: 'image',
    description: 'Generate images',
    run: imageCommand,
  },
  speak: {
    name: 'speak',
    description: 'Text-to-speech',
    run: speakCommand,
  },
  video: {
    name: 'video',
    description: 'Generate videos',
    run: videoCommand,
  },
  music: placeholderCommand('music'),
  config: {
    name: 'config',
    description: 'Set API key and preferences',
    run: configCommand,
  },
}

function showHelp(): void {
  const theme = t()

  print(
    header('Gemini CLI', `AI-powered tools at your terminal (v${VERSION})`)
  )
  print('')

  print(theme.colors.primary('Usage:'))
  print(`  gcli ${theme.colors.muted('<command>')} [options]`)
  print('')

  print(theme.colors.primary('Commands:'))
  print(`  ${theme.colors.highlight('query')}     ${theme.colors.muted('Query Gemini directly')}`)
  print(`  ${theme.colors.highlight('search')}    ${theme.colors.muted('Real-time web search')}`)
  print(`  ${theme.colors.highlight('tokens')}    ${theme.colors.muted('Count tokens in text/file')}`)
  print(`  ${theme.colors.highlight('research')}  ${theme.colors.muted('Deep research agent')}`)
  print(`  ${theme.colors.highlight('image')}     ${theme.colors.muted('Generate images')}`)
  print(`  ${theme.colors.highlight('speak')}     ${theme.colors.muted('Text-to-speech')}`)
  print(`  ${theme.colors.highlight('video')}     ${theme.colors.muted('Generate videos')}`)
  print(`  ${theme.colors.highlight('music')}     ${theme.colors.muted('Generate music')}`)
  print(`  ${theme.colors.highlight('config')}    ${theme.colors.muted('Set API key and preferences')}`)
  print('')

  print(theme.colors.primary('Options:'))
  print(`  ${theme.colors.highlight('-h, --help')}     ${theme.colors.muted('Show this help')}`)
  print(`  ${theme.colors.highlight('-v, --version')}  ${theme.colors.muted('Show version')}`)
  print(`  ${theme.colors.highlight('--theme')}        ${theme.colors.muted('Set color theme (terminal, neon, minimal, ocean, forest)')}`)
  print('')

  print(theme.colors.primary('Examples:'))
  print(theme.colors.muted('  gcli query "What is the meaning of life?"'))
  print(theme.colors.muted('  gcli search "latest AI news"'))
  print(theme.colors.muted('  gcli image "a cat in space" --size 4K'))
  print(theme.colors.muted('  gcli research "MCP ecosystem" --format outline'))
  print('')

  print(theme.colors.muted(`Run 'gcli <command> --help' for command-specific options.`))
}

function showVersion(): void {
  const theme = t()
  print(`${theme.colors.primary('gcli')} ${theme.colors.highlight(`v${VERSION}`)}`)
}

export async function runCli(argv: string[]): Promise<void> {
  // Load config first
  const config = await loadConfig()
  setCachedConfig(config)

  // Extract global flags and find command
  // Global flags: --theme <value>, --help/-h, --version/-v
  let themeName = config.theme
  let showHelpFlag = false
  let showVersionFlag = false
  let commandName: string | null = null
  let commandStartIndex = 0

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--theme' && argv[i + 1]) {
      themeName = argv[i + 1]
      i++ // Skip the theme value
    } else if (arg === '--help' || arg === '-h') {
      showHelpFlag = true
    } else if (arg === '--version' || arg === '-v') {
      showVersionFlag = true
    } else if (!arg.startsWith('-')) {
      // Found a command
      commandName = arg
      commandStartIndex = i + 1
      break
    }
  }

  // Apply theme
  setTheme(themeName)

  // Handle version flag
  if (showVersionFlag) {
    showVersion()
    return
  }

  // Handle help flag or no command
  if (showHelpFlag || !commandName) {
    showHelp()
    return
  }

  // Get command handler
  const command = commands[commandName]

  if (!command) {
    printError(`Unknown command: ${commandName}`)
    printMuted(`Run 'gcli --help' for available commands`)
    process.exit(1)
  }

  // Get command arguments (everything after the command)
  const commandArgs = argv.slice(commandStartIndex)

  // Check if command has --help flag (don't require API key for help)
  const isCommandHelp = commandArgs.includes('--help') || commandArgs.includes('-h')

  // Commands that don't need API key
  const noApiKeyCommands = ['config']

  // Check for API key (only needed for actual commands, not help or config)
  if (!isCommandHelp && !noApiKeyCommands.includes(commandName)) {
    const apiKey = getApiKey(config)
    if (!apiKey) {
      printError('GEMINI_API_KEY environment variable is required')
      printMuted('Set it with: gcli config set api-key YOUR_KEY')
      process.exit(1)
    }
    // Set env var from config for gemini-client.ts to use
    if (!process.env.GEMINI_API_KEY && apiKey) {
      process.env.GEMINI_API_KEY = apiKey
    }
  }

  // Run command with remaining args
  try {
    await command.run(commandArgs)
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
