/**
 * Research Command
 *
 * Deep research agent for comprehensive investigation.
 * gemini research "your research question"
 */

import { parseArgs } from 'node:util'
import { initGeminiClient, startDeepResearch, checkDeepResearch } from '../../gemini-client.js'
import { setupLogger } from '../../utils/logger.js'
import { spinner, progress, print, printError, printSuccess, printMuted, printWarning, t, header, box } from '../ui/index.js'

function showHelp(): void {
  const theme = t()

  print(header('gemini research', 'Deep research agent'))
  print('')

  print(theme.colors.primary('Usage:'))
  print(`  gemini research ${theme.colors.muted('"your research question"')}`)
  print('')

  print(theme.colors.primary('Options:'))
  print(`  ${theme.colors.highlight('--format, -f')}  ${theme.colors.muted('Output format: report, outline, brief (default: report)')}`)
  print(`  ${theme.colors.highlight('--wait, -w')}    ${theme.colors.muted('Wait for completion (can take 5-60 mins)')}`)
  print(`  ${theme.colors.highlight('--help, -h')}    ${theme.colors.muted('Show this help')}`)
  print('')

  print(theme.colors.primary('Examples:'))
  print(theme.colors.muted('  gemini research "MCP ecosystem and best practices"'))
  print(theme.colors.muted('  gemini research "AI coding assistants comparison" --format outline'))
  print(theme.colors.muted('  gemini research "Bun vs Node.js performance" --wait'))
  print('')

  print(theme.colors.warning(`${theme.symbols.warning} Deep research typically takes 5-20 minutes (max 60 min)`))
}

export async function researchCommand(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      format: { type: 'string', short: 'f', default: 'report' },
      wait: { type: 'boolean', short: 'w', default: false },
    },
    allowPositionals: true,
  })

  if (values.help) {
    showHelp()
    return
  }

  // Get query from positional args
  const query = positionals.join(' ')
  if (!query) {
    printError('No research question provided')
    printMuted('Usage: gemini research "your question"')
    process.exit(1)
  }

  const theme = t()
  const s = spinner()
  const format = values.format as string
  const shouldWait = values.wait

  try {
    // Suppress logger output for CLI
    setupLogger('quiet')

    // Initialize Gemini client
    s.start('Connecting to Gemini...')
    await initGeminiClient()

    // Build the research prompt with format
    let researchPrompt = query
    if (format && format !== 'report') {
      researchPrompt = `${query}\n\nFormat the output as: ${format}`
    }

    // Start the research
    s.update('Starting deep research agent...')
    const result = await startDeepResearch(researchPrompt)

    s.success('Research started!')
    print('')

    // Show research info
    const infoLines = [
      `${theme.colors.primary('Research ID:')} ${result.id}`,
      `${theme.colors.primary('Query:')} ${query.substring(0, 60)}${query.length > 60 ? '...' : ''}`,
      `${theme.colors.primary('Format:')} ${format}`,
      `${theme.colors.primary('Status:')} ${theme.colors.warning('In Progress')}`,
    ]

    print(box(infoLines, { title: 'Deep Research' }))
    print('')

    if (!shouldWait) {
      // Not waiting - give instructions
      print(theme.colors.info(`${theme.symbols.info} Research is running in the background.`))
      print('')
      print('To check status:')
      print(theme.colors.muted(`  gemini research-status ${result.id}`))
      print('')
      print(theme.colors.muted('Research typically takes 5-20 minutes (max 60 min).'))
      print(theme.colors.muted('Results will be saved to your configured output directory.'))
      return
    }

    // Wait for completion
    print(theme.colors.info(`${theme.symbols.info} Waiting for research to complete...`))
    print(theme.colors.muted('This may take 5-60 minutes. Press Ctrl+C to exit (research continues in background).'))
    print('')

    const p = progress({ total: 100, showEta: false })
    p.start('Researching')

    let lastStatus = 'pending'
    let attempts = 0
    const maxAttempts = 180 // 30 seconds * 180 = 90 minutes max
    const pollInterval = 30000 // 30 seconds

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      attempts++

      // Update progress (fake progress since we don't know actual %)
      const fakeProgress = Math.min(95, attempts * 2)
      p.update(fakeProgress, `Researching (${Math.floor(attempts * 0.5)}m)`)

      try {
        const status = await checkDeepResearch(result.id)

        if (status.status === 'completed') {
          p.done('Research complete!')
          print('')

          // Show the results
          if (status.outputs && status.outputs.length > 0) {
            const resultText = status.outputs[status.outputs.length - 1].text || 'No text output'
            print(theme.colors.primary('Research Results:'))
            print('')
            print(resultText)
          }

          if (status.savedPath) {
            print('')
            printSuccess(`Full response saved to: ${status.savedPath}`)
          }

          return
        } else if (status.status === 'failed') {
          p.fail('Research failed')
          printError(status.error || 'Unknown error')
          process.exit(1)
        }

        lastStatus = status.status
      } catch (error) {
        // Polling error - continue trying
        console.error('Polling error:', error)
      }
    }

    // Timed out
    p.fail('Research timed out')
    printWarning('Research is still running. Check status later:')
    print(theme.colors.muted(`  gemini research-status ${result.id}`))

  } catch (error) {
    s.error('Research failed')
    printError(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
