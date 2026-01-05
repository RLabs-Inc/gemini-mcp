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

const VERSION = '0.7.0'

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
  search: placeholderCommand('search'),
  tokens: {
    name: 'tokens',
    description: 'Count tokens in text or files',
    run: tokensCommand,
  },
  research: placeholderCommand('research'),
  image: placeholderCommand('image'),
  speak: placeholderCommand('speak'),
  video: placeholderCommand('video'),
  music: placeholderCommand('music'),
}

function showHelp(): void {
  const theme = t()

  print(
    header('Gemini CLI', `AI-powered tools at your terminal (v${VERSION})`)
  )
  print('')

  print(theme.colors.primary('Usage:'))
  print(`  gemini ${theme.colors.muted('<command>')} [options]`)
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
  print('')

  print(theme.colors.primary('Options:'))
  print(`  ${theme.colors.highlight('-h, --help')}     ${theme.colors.muted('Show this help')}`)
  print(`  ${theme.colors.highlight('-v, --version')}  ${theme.colors.muted('Show version')}`)
  print(`  ${theme.colors.highlight('--theme')}        ${theme.colors.muted('Set color theme (terminal, neon, minimal, ocean, forest)')}`)
  print('')

  print(theme.colors.primary('Examples:'))
  print(theme.colors.muted('  gemini query "What is the meaning of life?"'))
  print(theme.colors.muted('  gemini search "latest AI news"'))
  print(theme.colors.muted('  gemini image "a cat in space" --size 4K'))
  print(theme.colors.muted('  gemini research "MCP ecosystem" --format outline'))
  print('')

  print(theme.colors.muted(`Run 'gemini <command> --help' for command-specific options.`))
}

function showVersion(): void {
  const theme = t()
  print(`${theme.colors.primary('gemini')} ${theme.colors.highlight(`v${VERSION}`)}`)
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
    printMuted(`Run 'gemini --help' for available commands`)
    process.exit(1)
  }

  // Get command arguments (everything after the command)
  const commandArgs = argv.slice(commandStartIndex)

  // Check if command has --help flag (don't require API key for help)
  const isCommandHelp = commandArgs.includes('--help') || commandArgs.includes('-h')

  // Check for API key (only needed for actual commands, not help)
  if (!isCommandHelp) {
    const apiKey = getApiKey(config)
    if (!apiKey) {
      printError('GEMINI_API_KEY environment variable is required')
      printMuted('Set it in your shell or in ~/.config/gemini-cli/config.json')
      process.exit(1)
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
