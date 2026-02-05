/**
 * Tool Groups Configuration
 *
 * Defines tool group mappings and presets for selective tool loading.
 * Environment variables:
 * - GEMINI_ENABLED_TOOLS: Comma-separated list of group IDs to enable
 * - GEMINI_TOOL_PRESET: Preset profile name (minimal, text, image, research, media, full)
 */

import { logger } from '../utils/logger.js'

// Tool group definitions: groupId -> metadata
export const TOOL_GROUPS: Record<string, { registerFn: string; tools: string[] }> = {
  query: { registerFn: 'registerQueryTool', tools: ['gemini-query'] },
  brainstorm: { registerFn: 'registerBrainstormTool', tools: ['gemini-brainstorm'] },
  analyze: { registerFn: 'registerAnalyzeTool', tools: ['gemini-analyze-code', 'gemini-analyze-text'] },
  summarize: { registerFn: 'registerSummarizeTool', tools: ['gemini-summarize'] },
  'image-gen': {
    registerFn: 'registerImageGenTool',
    tools: ['gemini-generate-image', 'gemini-image-prompt'],
  },
  'image-edit': {
    registerFn: 'registerImageEditTool',
    tools: [
      'gemini-start-image-edit',
      'gemini-continue-image-edit',
      'gemini-end-image-edit',
      'gemini-list-image-sessions',
    ],
  },
  'video-gen': { registerFn: 'registerVideoGenTool', tools: ['gemini-generate-video', 'gemini-check-video'] },
  'code-exec': { registerFn: 'registerCodeExecTool', tools: ['gemini-run-code'] },
  search: { registerFn: 'registerSearchTool', tools: ['gemini-search'] },
  structured: { registerFn: 'registerStructuredTool', tools: ['gemini-structured', 'gemini-extract'] },
  youtube: { registerFn: 'registerYouTubeTool', tools: ['gemini-youtube', 'gemini-youtube-summary'] },
  document: {
    registerFn: 'registerDocumentTool',
    tools: ['gemini-analyze-document', 'gemini-summarize-pdf', 'gemini-extract-tables'],
  },
  'url-context': {
    registerFn: 'registerUrlContextTool',
    tools: ['gemini-analyze-url', 'gemini-compare-urls', 'gemini-extract-from-url'],
  },
  cache: {
    registerFn: 'registerCacheTool',
    tools: ['gemini-create-cache', 'gemini-query-cache', 'gemini-list-caches', 'gemini-delete-cache'],
  },
  speech: { registerFn: 'registerSpeechTool', tools: ['gemini-speak', 'gemini-dialogue', 'gemini-list-voices'] },
  'token-count': { registerFn: 'registerTokenCountTool', tools: ['gemini-count-tokens'] },
  'deep-research': {
    registerFn: 'registerDeepResearchTool',
    tools: ['gemini-deep-research', 'gemini-check-research', 'gemini-research-followup'],
  },
  'image-analyze': { registerFn: 'registerImageAnalyzeTool', tools: ['gemini-analyze-image'] },
}

// Preset definitions
export const PRESETS: Record<string, string[]> = {
  minimal: ['query', 'brainstorm'],
  text: ['query', 'brainstorm', 'analyze', 'summarize', 'structured'],
  image: ['query', 'image-gen', 'image-edit', 'image-analyze'],
  research: ['query', 'search', 'deep-research', 'url-context', 'document'],
  media: ['query', 'image-gen', 'image-edit', 'image-analyze', 'video-gen', 'youtube', 'speech'],
  full: Object.keys(TOOL_GROUPS),
}

/**
 * Get the set of enabled tool group IDs based on environment configuration.
 */
export function getEnabledToolGroups(): Set<string> {
  const presetName = process.env.GEMINI_TOOL_PRESET?.trim()
  const explicitTools = process.env.GEMINI_ENABLED_TOOLS?.trim()

  // Default: all tools enabled (backward compatible)
  if (!presetName && !explicitTools) {
    return new Set(Object.keys(TOOL_GROUPS))
  }

  const enabledGroups = new Set<string>()

  // Add preset groups if specified
  if (presetName) {
    const presetGroups = PRESETS[presetName]
    if (presetGroups) {
      presetGroups.forEach((g) => enabledGroups.add(g))
    } else {
      logger.warn(`Unknown tool preset: ${presetName}. Loading all tools.`)
      return new Set(Object.keys(TOOL_GROUPS))
    }
  }

  // Add explicit groups if specified
  if (explicitTools) {
    const groups = explicitTools
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean)
    for (const group of groups) {
      if (TOOL_GROUPS[group]) {
        enabledGroups.add(group)
      } else {
        logger.warn(`Unknown tool group: ${group}. Skipping.`)
      }
    }
  }

  return enabledGroups
}
