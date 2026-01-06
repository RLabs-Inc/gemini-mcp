/**
 * Search Command
 *
 * Real-time web search powered by Gemini + Google Search.
 * gcli search "your query"
 */

import { parseArgs } from 'node:util'
import { GoogleGenAI } from '@google/genai'
import { setupLogger } from '../../utils/logger.js'
import { spinner, print, printError, printMuted, t, header } from '../ui/index.js'

// Types for grounding metadata
interface GroundingChunk {
  web?: {
    uri: string
    title: string
  }
}

interface GroundingSupport {
  segment?: {
    startIndex: number
    endIndex: number
    text: string
  }
  groundingChunkIndices?: number[]
}

interface GroundingMetadata {
  webSearchQueries?: string[]
  groundingChunks?: GroundingChunk[]
  groundingSupports?: GroundingSupport[]
}

function showHelp(): void {
  const theme = t()

  print(header('gcli search', 'Real-time web search'))
  print('')

  print(theme.colors.primary('Usage:'))
  print(`  gcli search ${theme.colors.muted('"your query"')}`)
  print('')

  print(theme.colors.primary('Options:'))
  print(`  ${theme.colors.highlight('--no-citations')}  ${theme.colors.muted('Hide inline citations')}`)
  print(`  ${theme.colors.highlight('--help, -h')}      ${theme.colors.muted('Show this help')}`)
  print('')

  print(theme.colors.primary('Examples:'))
  print(theme.colors.muted('  gcli search "latest news about AI"'))
  print(theme.colors.muted('  gcli search "weather in São Paulo"'))
  print(theme.colors.muted('  gcli search "MCP Model Context Protocol"'))
}

/**
 * Add inline citations to text based on grounding metadata
 */
function addCitations(
  text: string,
  supports: GroundingSupport[],
  chunks: GroundingChunk[]
): string {
  if (!supports || !chunks || supports.length === 0) {
    return text
  }

  // Sort supports by endIndex in descending order to avoid shifting issues
  const sortedSupports = [...supports].sort(
    (a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0)
  )

  let result = text

  for (const support of sortedSupports) {
    const endIndex = support.segment?.endIndex
    if (endIndex === undefined || !support.groundingChunkIndices?.length) {
      continue
    }

    const citationLinks = support.groundingChunkIndices
      .map((i) => {
        const uri = chunks[i]?.web?.uri
        const title = chunks[i]?.web?.title
        if (uri) {
          return `[${title || i + 1}](${uri})`
        }
        return null
      })
      .filter(Boolean)

    if (citationLinks.length > 0) {
      const citationString = ' ' + citationLinks.join(', ')
      result = result.slice(0, endIndex) + citationString + result.slice(endIndex)
    }
  }

  return result
}

export async function searchCommand(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      'no-citations': { type: 'boolean', default: false },
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
    printError('No search query provided')
    printMuted('Usage: gcli search "your query"')
    process.exit(1)
  }

  const theme = t()
  const s = spinner()
  const returnCitations = !values['no-citations']

  try {
    // Suppress logger output for CLI
    setupLogger('quiet')

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set')
    }

    s.start('Searching the web...')

    const genAI = new GoogleGenAI({ apiKey })
    const model = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-preview'

    // Execute with Google Search tool enabled
    const response = await genAI.models.generateContent({
      model,
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })

    const candidate = response.candidates?.[0]
    if (!candidate) {
      throw new Error('No response from search')
    }

    let responseText = response.text || ''
    const groundingMetadata = candidate.groundingMetadata as GroundingMetadata | undefined

    // Build response with citations if requested
    const sources: Array<{ title: string; url: string }> = []

    if (returnCitations && groundingMetadata) {
      const supports = groundingMetadata.groundingSupports || []
      const chunks = groundingMetadata.groundingChunks || []

      if (supports.length > 0 && chunks.length > 0) {
        responseText = addCitations(responseText, supports, chunks)
      }

      // Collect unique sources
      const seenUrls = new Set<string>()
      for (const chunk of chunks) {
        if (chunk.web?.uri && !seenUrls.has(chunk.web.uri)) {
          seenUrls.add(chunk.web.uri)
          sources.push({
            title: chunk.web.title || 'Source',
            url: chunk.web.uri,
          })
        }
      }
    }

    s.success('Search complete')
    print('')

    // Display the response
    print(responseText)
    print('')

    // Display sources if available
    if (sources.length > 0) {
      print(theme.colors.muted('─'.repeat(40)))
      print(theme.colors.primary('Sources:'))
      for (const source of sources) {
        print(`  ${theme.symbols.bullet} ${theme.colors.info(source.title)}`)
        print(`    ${theme.colors.muted(source.url)}`)
      }
    }

    // Show search queries used
    if (groundingMetadata?.webSearchQueries?.length) {
      print('')
      print(theme.colors.muted(`Searches: ${groundingMetadata.webSearchQueries.join(', ')}`))
    }

    print('')

  } catch (error) {
    s.error('Search failed')
    printError(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
