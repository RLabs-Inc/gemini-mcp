/**
 * Config Command
 *
 * Set and view CLI configuration.
 * gemini config set api-key YOUR_KEY
 * gemini config show
 */

import { parseArgs } from 'node:util'
import { loadConfig, saveConfig, getConfigPath, getConfigDir } from '../config.js'
import { print, printError, printSuccess, printMuted, printWarning, t, header, box } from '../ui/index.js'

function showHelp(): void {
  const theme = t()

  print(header('gemini config', 'CLI configuration'))
  print('')

  print(theme.colors.primary('Usage:'))
  print(`  gemini config ${theme.colors.muted('<command>')} [options]`)
  print('')

  print(theme.colors.primary('Commands:'))
  print(`  ${theme.colors.highlight('set')}    ${theme.colors.muted('Set a configuration value')}`)
  print(`  ${theme.colors.highlight('show')}   ${theme.colors.muted('Show current configuration')}`)
  print(`  ${theme.colors.highlight('path')}   ${theme.colors.muted('Show config file path')}`)
  print('')

  print(theme.colors.primary('Settings:'))
  print(`  ${theme.colors.highlight('api-key')}         ${theme.colors.muted('Your Gemini API key')}`)
  print(`  ${theme.colors.highlight('theme')}           ${theme.colors.muted('Default theme (terminal, neon, minimal, ocean, forest)')}`)
  print(`  ${theme.colors.highlight('output-dir')}      ${theme.colors.muted('Directory for generated files')}`)
  print(`  ${theme.colors.highlight('default-voice')}   ${theme.colors.muted('Default TTS voice')}`)
  print(`  ${theme.colors.highlight('default-model')}   ${theme.colors.muted('Default model (pro or flash)')}`)
  print('')

  print(theme.colors.primary('Examples:'))
  print(theme.colors.muted('  gemini config set api-key AIzaSy...'))
  print(theme.colors.muted('  gemini config set theme neon'))
  print(theme.colors.muted('  gemini config set output-dir ~/Documents/Gemini'))
  print(theme.colors.muted('  gemini config show'))
}

async function showConfig(): Promise<void> {
  const theme = t()
  const config = await loadConfig()

  print(header('Current Configuration', getConfigPath()))
  print('')

  const lines = [
    `${theme.colors.primary('API Key:')} ${config.apiKey ? theme.colors.success('Set (hidden)') : theme.colors.error('Not set')}`,
    `${theme.colors.primary('Theme:')} ${config.theme}`,
    `${theme.colors.primary('Output Dir:')} ${config.outputDir}`,
    `${theme.colors.primary('Default Voice:')} ${config.defaultVoice}`,
    `${theme.colors.primary('Image Size:')} ${config.defaultImageSize}`,
    `${theme.colors.primary('Image Ratio:')} ${config.defaultImageRatio}`,
    `${theme.colors.primary('Video Ratio:')} ${config.defaultVideoRatio}`,
  ]

  print(box(lines, { title: 'Settings' }))
  print('')

  if (!config.apiKey) {
    printWarning('API key not set. Set it with:')
    print(theme.colors.muted('  gemini config set api-key YOUR_API_KEY'))
    print('')
    print(theme.colors.muted('Or set the GEMINI_API_KEY environment variable.'))
  }
}

async function setConfig(key: string, value: string): Promise<void> {
  const theme = t()

  // Map user-friendly keys to config keys
  const keyMap: Record<string, string> = {
    'api-key': 'apiKey',
    'apikey': 'apiKey',
    'theme': 'theme',
    'output-dir': 'outputDir',
    'outputdir': 'outputDir',
    'default-voice': 'defaultVoice',
    'voice': 'defaultVoice',
    'default-model': 'defaultModel',
    'model': 'defaultModel',
    'image-size': 'defaultImageSize',
    'image-ratio': 'defaultImageRatio',
    'video-ratio': 'defaultVideoRatio',
  }

  const configKey = keyMap[key.toLowerCase()]
  if (!configKey) {
    printError(`Unknown setting: ${key}`)
    printMuted('Valid settings: api-key, theme, output-dir, default-voice')
    process.exit(1)
  }

  // Validate values
  if (configKey === 'theme') {
    const validThemes = ['terminal', 'neon', 'minimal', 'ocean', 'forest']
    if (!validThemes.includes(value)) {
      printError(`Invalid theme: ${value}`)
      printMuted(`Valid themes: ${validThemes.join(', ')}`)
      process.exit(1)
    }
  }

  if (configKey === 'defaultImageSize') {
    const validSizes = ['1K', '2K', '4K']
    if (!validSizes.includes(value)) {
      printError(`Invalid image size: ${value}`)
      printMuted(`Valid sizes: ${validSizes.join(', ')}`)
      process.exit(1)
    }
  }

  // Save the config
  await saveConfig({ [configKey]: value })

  // Show confirmation
  const displayValue = configKey === 'apiKey' ? '***' + value.slice(-4) : value
  printSuccess(`Set ${key} = ${displayValue}`)

  if (configKey === 'apiKey') {
    print('')
    print(theme.colors.muted('Your API key is now stored in:'))
    print(theme.colors.muted(`  ${getConfigPath()}`))
    print('')
    printWarning('Keep this file secure. Do not share it.')
  }
}

export async function configCommand(argv: string[]): Promise<void> {
  const { positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  })

  const subCommand = positionals[0]

  if (!subCommand || subCommand === 'help') {
    showHelp()
    return
  }

  switch (subCommand) {
    case 'show':
      await showConfig()
      break

    case 'path':
      print(getConfigPath())
      break

    case 'set':
      const key = positionals[1]
      const value = positionals.slice(2).join(' ')

      if (!key || !value) {
        printError('Usage: gemini config set <key> <value>')
        printMuted('Example: gemini config set api-key YOUR_KEY')
        process.exit(1)
      }

      await setConfig(key, value)
      break

    default:
      printError(`Unknown config command: ${subCommand}`)
      printMuted('Valid commands: set, show, path')
      process.exit(1)
  }
}
