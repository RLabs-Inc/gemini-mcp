/**
 * Tests for Tool Groups Configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getEnabledToolGroups, TOOL_GROUPS, PRESETS } from './tool-groups.js'

// Mock the logger module
vi.mock('../utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

// Import the mocked logger to verify calls
import { logger } from '../utils/logger.js'

describe('tool-groups', () => {
  describe('TOOL_GROUPS constant', () => {
    it('should have all 18 tool groups defined', () => {
      const expectedGroups = [
        'query',
        'brainstorm',
        'analyze',
        'summarize',
        'image-gen',
        'image-edit',
        'video-gen',
        'code-exec',
        'search',
        'structured',
        'youtube',
        'document',
        'url-context',
        'cache',
        'speech',
        'token-count',
        'deep-research',
        'image-analyze',
      ]

      expect(Object.keys(TOOL_GROUPS)).toHaveLength(18)
      for (const group of expectedGroups) {
        expect(TOOL_GROUPS).toHaveProperty(group)
      }
    })

    it('should have valid register function names for each group', () => {
      for (const [_groupId, config] of Object.entries(TOOL_GROUPS)) {
        expect(config.registerFn).toBeDefined()
        expect(config.registerFn).toMatch(/^register[A-Z][a-zA-Z]+Tool$/)
      }
    })

    it('should have non-empty tools array for each group', () => {
      for (const [_groupId, config] of Object.entries(TOOL_GROUPS)) {
        expect(config.tools).toBeDefined()
        expect(Array.isArray(config.tools)).toBe(true)
        expect(config.tools.length).toBeGreaterThan(0)
        // Each tool should be a non-empty string
        for (const tool of config.tools) {
          expect(typeof tool).toBe('string')
          expect(tool.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('PRESETS constant', () => {
    it('should have minimal preset with query and brainstorm', () => {
      expect(PRESETS.minimal).toEqual(['query', 'brainstorm'])
    })

    it('should have text preset with text-focused tools', () => {
      expect(PRESETS.text).toContain('query')
      expect(PRESETS.text).toContain('brainstorm')
      expect(PRESETS.text).toContain('analyze')
      expect(PRESETS.text).toContain('summarize')
      expect(PRESETS.text).toContain('structured')
      expect(PRESETS.text).toHaveLength(5)
    })

    it('should have image preset with image tools', () => {
      expect(PRESETS.image).toContain('query')
      expect(PRESETS.image).toContain('image-gen')
      expect(PRESETS.image).toContain('image-edit')
      expect(PRESETS.image).toContain('image-analyze')
      expect(PRESETS.image).toHaveLength(4)
    })

    it('should have research preset with research tools', () => {
      expect(PRESETS.research).toContain('query')
      expect(PRESETS.research).toContain('search')
      expect(PRESETS.research).toContain('deep-research')
      expect(PRESETS.research).toContain('url-context')
      expect(PRESETS.research).toContain('document')
      expect(PRESETS.research).toHaveLength(5)
    })

    it('should have media preset with media tools', () => {
      expect(PRESETS.media).toContain('query')
      expect(PRESETS.media).toContain('image-gen')
      expect(PRESETS.media).toContain('image-edit')
      expect(PRESETS.media).toContain('image-analyze')
      expect(PRESETS.media).toContain('video-gen')
      expect(PRESETS.media).toContain('youtube')
      expect(PRESETS.media).toContain('speech')
      expect(PRESETS.media).toHaveLength(7)
    })

    it('should have full preset with all groups', () => {
      const allGroupIds = Object.keys(TOOL_GROUPS)
      expect(PRESETS.full).toHaveLength(allGroupIds.length)
      for (const groupId of allGroupIds) {
        expect(PRESETS.full).toContain(groupId)
      }
    })

    it('should include query in every preset except full', () => {
      const presetsWithQuery = ['minimal', 'text', 'image', 'research', 'media']
      for (const presetName of presetsWithQuery) {
        expect(PRESETS[presetName]).toContain('query')
      }
    })
  })

  describe('getEnabledToolGroups()', () => {
    const originalEnv = process.env

    beforeEach(() => {
      // Reset environment before each test
      process.env = { ...originalEnv }
      delete process.env.GEMINI_TOOL_PRESET
      delete process.env.GEMINI_ENABLED_TOOLS
      vi.clearAllMocks()
    })

    afterEach(() => {
      process.env = originalEnv
    })

    // Default behavior
    describe('default behavior', () => {
      it('should return all groups when no env vars set', () => {
        const result = getEnabledToolGroups()
        const allGroups = Object.keys(TOOL_GROUPS)

        expect(result.size).toBe(allGroups.length)
        for (const group of allGroups) {
          expect(result.has(group)).toBe(true)
        }
      })

      it('should return all groups when GEMINI_ENABLED_TOOLS is empty string', () => {
        process.env.GEMINI_ENABLED_TOOLS = ''

        const result = getEnabledToolGroups()
        const allGroups = Object.keys(TOOL_GROUPS)

        expect(result.size).toBe(allGroups.length)
      })
    })

    // Preset-only behavior
    describe('preset-only behavior', () => {
      it('should return preset groups when only GEMINI_TOOL_PRESET set', () => {
        process.env.GEMINI_TOOL_PRESET = 'minimal'

        const result = getEnabledToolGroups()

        expect(result.size).toBe(2)
        expect(result.has('query')).toBe(true)
        expect(result.has('brainstorm')).toBe(true)
      })

      it('should handle text preset correctly', () => {
        process.env.GEMINI_TOOL_PRESET = 'text'

        const result = getEnabledToolGroups()

        expect(result.size).toBe(5)
        expect(result.has('query')).toBe(true)
        expect(result.has('brainstorm')).toBe(true)
        expect(result.has('analyze')).toBe(true)
        expect(result.has('summarize')).toBe(true)
        expect(result.has('structured')).toBe(true)
      })

      it('should handle unknown preset by returning all groups with warning', () => {
        process.env.GEMINI_TOOL_PRESET = 'nonexistent'

        const result = getEnabledToolGroups()
        const allGroups = Object.keys(TOOL_GROUPS)

        expect(result.size).toBe(allGroups.length)
        expect(logger.warn).toHaveBeenCalledWith('Unknown tool preset: nonexistent. Loading all tools.')
      })
    })

    // Explicit-only behavior
    describe('explicit-only behavior', () => {
      it('should return only specified groups when GEMINI_ENABLED_TOOLS set', () => {
        process.env.GEMINI_ENABLED_TOOLS = 'query,search'

        const result = getEnabledToolGroups()

        expect(result.size).toBe(2)
        expect(result.has('query')).toBe(true)
        expect(result.has('search')).toBe(true)
      })

      it('should filter out invalid group names with warning', () => {
        process.env.GEMINI_ENABLED_TOOLS = 'query,invalid-group,search'

        const result = getEnabledToolGroups()

        expect(result.size).toBe(2)
        expect(result.has('query')).toBe(true)
        expect(result.has('search')).toBe(true)
        expect(result.has('invalid-group')).toBe(false)
        expect(logger.warn).toHaveBeenCalledWith('Unknown tool group: invalid-group. Skipping.')
      })
    })

    // Hybrid combining behavior
    describe('hybrid combining behavior', () => {
      it('should combine preset + explicit tools additively', () => {
        process.env.GEMINI_TOOL_PRESET = 'minimal' // query and brainstorm
        process.env.GEMINI_ENABLED_TOOLS = 'image-gen,video-gen'

        const result = getEnabledToolGroups()

        expect(result.size).toBe(4)
        expect(result.has('query')).toBe(true) // From preset
        expect(result.has('brainstorm')).toBe(true) // From preset
        expect(result.has('image-gen')).toBe(true) // From explicit
        expect(result.has('video-gen')).toBe(true) // From explicit
      })

      it('should deduplicate when preset and explicit overlap', () => {
        process.env.GEMINI_TOOL_PRESET = 'text' // query, brainstorm, analyze, summarize, structured
        process.env.GEMINI_ENABLED_TOOLS = 'query,analyze,search' // query and analyze overlap

        const result = getEnabledToolGroups()

        expect(result.size).toBe(6)
        expect(result.has('query')).toBe(true)
        expect(result.has('brainstorm')).toBe(true)
        expect(result.has('analyze')).toBe(true)
        expect(result.has('summarize')).toBe(true)
        expect(result.has('structured')).toBe(true)
        expect(result.has('search')).toBe(true)
      })

      it('should include query and brainstorm from preset and image-gen from explicit', () => {
        process.env.GEMINI_TOOL_PRESET = 'minimal'
        process.env.GEMINI_ENABLED_TOOLS = 'image-gen'

        const result = getEnabledToolGroups()

        expect(result.size).toBe(3)
        expect(result.has('query')).toBe(true)
        expect(result.has('brainstorm')).toBe(true)
        expect(result.has('image-gen')).toBe(true)
      })
    })

    // Edge cases
    describe('edge cases', () => {
      it('should handle whitespace in GEMINI_ENABLED_TOOLS', () => {
        process.env.GEMINI_ENABLED_TOOLS = '  query  ,  search  ,  image-gen  '

        const result = getEnabledToolGroups()

        expect(result.size).toBe(3)
        expect(result.has('query')).toBe(true)
        expect(result.has('search')).toBe(true)
        expect(result.has('image-gen')).toBe(true)
      })

      it('should handle trailing commas', () => {
        process.env.GEMINI_ENABLED_TOOLS = 'query,search,'

        const result = getEnabledToolGroups()

        expect(result.size).toBe(2)
        expect(result.has('query')).toBe(true)
        expect(result.has('search')).toBe(true)
      })

      it('should handle leading commas', () => {
        process.env.GEMINI_ENABLED_TOOLS = ',query,search'

        const result = getEnabledToolGroups()

        expect(result.size).toBe(2)
        expect(result.has('query')).toBe(true)
        expect(result.has('search')).toBe(true)
      })

      it('should handle multiple consecutive commas', () => {
        process.env.GEMINI_ENABLED_TOOLS = 'query,,search,,,image-gen'

        const result = getEnabledToolGroups()

        expect(result.size).toBe(3)
        expect(result.has('query')).toBe(true)
        expect(result.has('search')).toBe(true)
        expect(result.has('image-gen')).toBe(true)
      })

      it('should handle whitespace-only GEMINI_ENABLED_TOOLS', () => {
        process.env.GEMINI_ENABLED_TOOLS = '   '

        const result = getEnabledToolGroups()
        const allGroups = Object.keys(TOOL_GROUPS)

        expect(result.size).toBe(allGroups.length)
      })

      it('should handle whitespace in GEMINI_TOOL_PRESET', () => {
        process.env.GEMINI_TOOL_PRESET = '  minimal  '

        const result = getEnabledToolGroups()

        expect(result.size).toBe(2)
        expect(result.has('query')).toBe(true)
        expect(result.has('brainstorm')).toBe(true)
      })

      it('should be case-sensitive for group names', () => {
        process.env.GEMINI_ENABLED_TOOLS = 'Query,SEARCH,Image-Gen'

        const result = getEnabledToolGroups()

        // These should be invalid because group names are lowercase/kebab-case
        expect(result.size).toBe(0)
        expect(logger.warn).toHaveBeenCalledTimes(3)
      })

      it('should be case-sensitive for preset names', () => {
        process.env.GEMINI_TOOL_PRESET = 'MINIMAL'

        const result = getEnabledToolGroups()
        const allGroups = Object.keys(TOOL_GROUPS)

        // Unknown preset returns all groups
        expect(result.size).toBe(allGroups.length)
        expect(logger.warn).toHaveBeenCalledWith('Unknown tool preset: MINIMAL. Loading all tools.')
      })
    })
  })
})
