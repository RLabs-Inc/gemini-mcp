/**
 * Tests for the gemini-analyze-code tool prompt construction
 *
 * These tests verify the prompt building logic for different input parameter permutations:
 * 1. code only (inline code)
 * 2. filePath only (single file)
 * 3. filePaths only (multiple files)
 * 4. filePath + filePaths (merged into single array)
 * 5. code + filePath (inline code appended after file)
 * 6. code + filePaths (inline code appended after files)
 * 7. No inputs provided (should throw error)
 * 8. File not found (should throw error)
 * 9. File too large (should throw error for files > 20MB)
 */

import { describe, it, expect, vi } from 'vitest'
import {
  normalizeFilePaths,
  readFilesForAnalysis,
  buildCodeSection,
  buildAnalysisTarget,
  getFocusInstructions,
  buildAnalysisPrompt,
  MAX_FILE_SIZE,
  type FileContent,
} from '../analyze-utils.js'

describe('gemini-analyze-code prompt construction', () => {
  describe('normalizeFilePaths', () => {
    it('should return empty array when no paths provided', () => {
      expect(normalizeFilePaths()).toEqual([])
      expect(normalizeFilePaths(undefined, undefined)).toEqual([])
    })

    it('should return array with single path when only filePath provided', () => {
      expect(normalizeFilePaths('/path/to/file.ts')).toEqual(['/path/to/file.ts'])
    })

    it('should return array when only filePaths provided', () => {
      expect(normalizeFilePaths(undefined, ['/path/a.ts', '/path/b.ts'])).toEqual(['/path/a.ts', '/path/b.ts'])
    })

    it('should merge filePath and filePaths with filePath first', () => {
      expect(normalizeFilePaths('/path/single.ts', ['/path/a.ts', '/path/b.ts'])).toEqual([
        '/path/single.ts',
        '/path/a.ts',
        '/path/b.ts',
      ])
    })
  })

  describe('readFilesForAnalysis', () => {
    it('should return empty array for empty paths', () => {
      const mockFs = {
        existsSync: vi.fn(),
        statSync: vi.fn(),
        readFileSync: vi.fn(),
      }
      expect(readFilesForAnalysis([], mockFs)).toEqual([])
    })

    it('should throw error when file not found', () => {
      const mockFs = {
        existsSync: vi.fn().mockReturnValue(false),
        statSync: vi.fn(),
        readFileSync: vi.fn(),
      }

      expect(() => readFilesForAnalysis(['/nonexistent/file.ts'], mockFs)).toThrow(
        'File not found: /nonexistent/file.ts'
      )
    })

    it('should throw error when file too large (> 20MB)', () => {
      const mockFs = {
        existsSync: vi.fn().mockReturnValue(true),
        statSync: vi.fn().mockReturnValue({ size: 25 * 1024 * 1024 }), // 25MB
        readFileSync: vi.fn(),
      }

      expect(() => readFilesForAnalysis(['/path/huge-file.ts'], mockFs)).toThrow(
        'File too large: /path/huge-file.ts (25MB, max 20MB)'
      )
    })

    it('should read file and extract filename and extension', () => {
      const mockFs = {
        existsSync: vi.fn().mockReturnValue(true),
        statSync: vi.fn().mockReturnValue({ size: 100 }),
        readFileSync: vi.fn().mockReturnValue('const x = 1;'),
      }

      const result = readFilesForAnalysis(['/path/to/example.ts'], mockFs)

      expect(result).toEqual([
        {
          filename: 'example.ts',
          content: 'const x = 1;',
          ext: 'ts',
        },
      ])
    })

    it('should handle files without extension', () => {
      const mockFs = {
        existsSync: vi.fn().mockReturnValue(true),
        statSync: vi.fn().mockReturnValue({ size: 100 }),
        readFileSync: vi.fn().mockReturnValue('#!/bin/bash'),
      }

      const result = readFilesForAnalysis(['/path/to/Makefile'], mockFs)

      expect(result).toEqual([
        {
          filename: 'Makefile',
          content: '#!/bin/bash',
          ext: '',
        },
      ])
    })

    it('should read multiple files', () => {
      const mockFs = {
        existsSync: vi.fn().mockReturnValue(true),
        statSync: vi.fn().mockReturnValue({ size: 100 }),
        readFileSync: vi
          .fn()
          .mockReturnValueOnce('const a = 1;')
          .mockReturnValueOnce('const b = 2;')
          .mockReturnValueOnce('const c = 3;'),
      }

      const result = readFilesForAnalysis(['/path/a.ts', '/path/b.js', '/path/c.py'], mockFs)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ filename: 'a.ts', content: 'const a = 1;', ext: 'ts' })
      expect(result[1]).toEqual({ filename: 'b.js', content: 'const b = 2;', ext: 'js' })
      expect(result[2]).toEqual({ filename: 'c.py', content: 'const c = 3;', ext: 'py' })
    })
  })

  describe('buildCodeSection', () => {
    it('should format single file with header and code block', () => {
      const fileContents: FileContent[] = [{ filename: 'example.ts', content: 'const x = 1;', ext: 'ts' }]

      const result = buildCodeSection(fileContents)

      expect(result).toContain('### example.ts')
      expect(result).toContain('```ts')
      expect(result).toContain('const x = 1;')
      expect(result).toContain('```')
    })

    it('should use language override for code block hint', () => {
      const fileContents: FileContent[] = [{ filename: 'example.ts', content: 'const x = 1;', ext: 'ts' }]

      const result = buildCodeSection(fileContents, undefined, 'typescript')

      expect(result).toContain('```typescript')
    })

    it('should format multiple files with headers', () => {
      const fileContents: FileContent[] = [
        { filename: 'a.ts', content: 'const a = 1;', ext: 'ts' },
        { filename: 'b.ts', content: 'const b = 2;', ext: 'ts' },
        { filename: 'c.ts', content: 'const c = 3;', ext: 'ts' },
      ]

      const result = buildCodeSection(fileContents)

      expect(result).toContain('### a.ts')
      expect(result).toContain('### b.ts')
      expect(result).toContain('### c.ts')
      expect(result).toContain('const a = 1;')
      expect(result).toContain('const b = 2;')
      expect(result).toContain('const c = 3;')
    })

    it('should format inline code only (no files) without header', () => {
      const result = buildCodeSection([], 'const inline = true;')

      expect(result).not.toContain('### Inline Code')
      expect(result).toContain('```')
      expect(result).toContain('const inline = true;')
    })

    it('should format inline code with language hint', () => {
      const result = buildCodeSection([], 'const inline = true;', 'javascript')

      expect(result).toContain('```javascript')
      expect(result).toContain('const inline = true;')
    })

    it('should append inline code with header when mixed with files', () => {
      const fileContents: FileContent[] = [{ filename: 'example.ts', content: 'const x = 1;', ext: 'ts' }]

      const result = buildCodeSection(fileContents, 'const inline = true;')

      expect(result).toContain('### example.ts')
      expect(result).toContain('### Inline Code')
      expect(result).toContain('const x = 1;')
      expect(result).toContain('const inline = true;')
    })

    it('should append inline code after all files when mixed with multiple files', () => {
      const fileContents: FileContent[] = [
        { filename: 'a.ts', content: 'const a = 1;', ext: 'ts' },
        { filename: 'b.ts', content: 'const b = 2;', ext: 'ts' },
      ]

      const result = buildCodeSection(fileContents, 'const inline = true;', 'typescript')

      // Check order: files come first, then inline code
      const aIndex = result.indexOf('### a.ts')
      const bIndex = result.indexOf('### b.ts')
      const inlineIndex = result.indexOf('### Inline Code')

      expect(aIndex).toBeLessThan(bIndex)
      expect(bIndex).toBeLessThan(inlineIndex)
    })

    it('should return empty string when no content provided', () => {
      const result = buildCodeSection([])
      expect(result).toBe('')
    })
  })

  describe('buildAnalysisTarget', () => {
    it('should return "the following code" when no files', () => {
      expect(buildAnalysisTarget(0)).toBe('the following code')
    })

    it('should return "the following <language> code" when language provided and no files', () => {
      expect(buildAnalysisTarget(0, 'TypeScript')).toBe('the following TypeScript code')
    })

    it('should return "the following file" for single file', () => {
      expect(buildAnalysisTarget(1)).toBe('the following file')
    })

    it('should return "the following N files" for multiple files', () => {
      expect(buildAnalysisTarget(2)).toBe('the following 2 files')
      expect(buildAnalysisTarget(3)).toBe('the following 3 files')
      expect(buildAnalysisTarget(10)).toBe('the following 10 files')
    })

    it('should ignore language parameter when files are present', () => {
      expect(buildAnalysisTarget(1, 'TypeScript')).toBe('the following file')
      expect(buildAnalysisTarget(3, 'Python')).toBe('the following 3 files')
    })
  })

  describe('getFocusInstructions', () => {
    it('should return quality instructions', () => {
      const result = getFocusInstructions('quality')
      expect(result).toContain('Code quality assessment')
      expect(result).toContain('Style and readability review')
      expect(result).toContain('Maintainability considerations')
      expect(result).toContain('Suggested improvements')
    })

    it('should return security instructions', () => {
      const result = getFocusInstructions('security')
      expect(result).toContain('Security vulnerabilities identification')
      expect(result).toContain('Potential exploit vectors')
      expect(result).toContain('Security best practices assessment')
      expect(result).toContain('Security improvements')
    })

    it('should return performance instructions', () => {
      const result = getFocusInstructions('performance')
      expect(result).toContain('Performance bottlenecks')
      expect(result).toContain('Optimization opportunities')
      expect(result).toContain('Algorithmic complexity analysis')
      expect(result).toContain('Performance improvement suggestions')
    })

    it('should return bugs instructions', () => {
      const result = getFocusInstructions('bugs')
      expect(result).toContain('Bugs and logical errors')
      expect(result).toContain("Edge cases that aren't handled")
      expect(result).toContain('Potential runtime errors')
      expect(result).toContain('Bug fix suggestions')
    })

    it('should return general instructions', () => {
      const result = getFocusInstructions('general')
      expect(result).toContain('Overall code assessment')
      expect(result).toContain('Strengths and weaknesses')
      expect(result).toContain('Potential issues (bugs, security, performance)')
      expect(result).toContain('Suggested improvements')
    })
  })

  describe('buildAnalysisPrompt', () => {
    describe('Case 1: code only (inline code)', () => {
      it('should build prompt with inline code only', () => {
        const result = buildAnalysisPrompt([], 'const x = 1;')

        expect(result.prompt).toContain('Analyze the following code')
        expect(result.prompt).toContain('```')
        expect(result.prompt).toContain('const x = 1;')
        expect(result.fileCount).toBe(0)
        expect(result.hasInlineCode).toBe(true)
      })

      it('should include language in target text when provided', () => {
        const result = buildAnalysisPrompt([], 'const x = 1;', 'TypeScript')

        expect(result.prompt).toContain('Analyze the following TypeScript code')
        expect(result.prompt).toContain('```TypeScript')
      })
    })

    describe('Case 2: filePath only (single file)', () => {
      it('should build prompt with single file', () => {
        const fileContents: FileContent[] = [{ filename: 'example.ts', content: 'const x = 1;', ext: 'ts' }]

        const result = buildAnalysisPrompt(fileContents)

        expect(result.prompt).toContain('Analyze the following file')
        expect(result.prompt).toContain('### example.ts')
        expect(result.prompt).toContain('```ts')
        expect(result.prompt).toContain('const x = 1;')
        expect(result.fileCount).toBe(1)
        expect(result.hasInlineCode).toBe(false)
      })
    })

    describe('Case 3: filePaths only (multiple files)', () => {
      it('should build prompt with multiple files', () => {
        const fileContents: FileContent[] = [
          { filename: 'a.ts', content: 'const a = 1;', ext: 'ts' },
          { filename: 'b.ts', content: 'const b = 2;', ext: 'ts' },
          { filename: 'c.ts', content: 'const c = 3;', ext: 'ts' },
        ]

        const result = buildAnalysisPrompt(fileContents)

        expect(result.prompt).toContain('Analyze the following 3 files')
        expect(result.prompt).toContain('### a.ts')
        expect(result.prompt).toContain('### b.ts')
        expect(result.prompt).toContain('### c.ts')
        expect(result.fileCount).toBe(3)
        expect(result.hasInlineCode).toBe(false)
      })
    })

    describe('Case 4: filePath + filePaths (merged into single array)', () => {
      it('should build prompt with merged file paths', () => {
        // This tests that the merged array of 4 files produces correct prompt
        const fileContents: FileContent[] = [
          { filename: 'single.ts', content: 'const single = 1;', ext: 'ts' },
          { filename: 'a.ts', content: 'const a = 1;', ext: 'ts' },
          { filename: 'b.ts', content: 'const b = 2;', ext: 'ts' },
          { filename: 'c.ts', content: 'const c = 3;', ext: 'ts' },
        ]

        const result = buildAnalysisPrompt(fileContents)

        expect(result.prompt).toContain('Analyze the following 4 files')
        expect(result.prompt).toContain('### single.ts')
        expect(result.prompt).toContain('### a.ts')
        expect(result.prompt).toContain('### b.ts')
        expect(result.prompt).toContain('### c.ts')
        expect(result.fileCount).toBe(4)
      })
    })

    describe('Case 5: code + filePath (inline code appended after file)', () => {
      it('should append inline code after file with header', () => {
        const fileContents: FileContent[] = [{ filename: 'example.ts', content: 'const x = 1;', ext: 'ts' }]

        const result = buildAnalysisPrompt(fileContents, 'const inline = true;')

        expect(result.prompt).toContain('Analyze the following file')
        expect(result.prompt).toContain('### example.ts')
        expect(result.prompt).toContain('### Inline Code')
        expect(result.prompt).toContain('const x = 1;')
        expect(result.prompt).toContain('const inline = true;')
        expect(result.fileCount).toBe(1)
        expect(result.hasInlineCode).toBe(true)

        // Verify order: file comes before inline code
        const fileIndex = result.prompt.indexOf('### example.ts')
        const inlineIndex = result.prompt.indexOf('### Inline Code')
        expect(fileIndex).toBeLessThan(inlineIndex)
      })
    })

    describe('Case 6: code + filePaths (inline code appended after files)', () => {
      it('should append inline code after all files with header', () => {
        const fileContents: FileContent[] = [
          { filename: 'a.ts', content: 'const a = 1;', ext: 'ts' },
          { filename: 'b.ts', content: 'const b = 2;', ext: 'ts' },
        ]

        const result = buildAnalysisPrompt(fileContents, 'const inline = true;')

        expect(result.prompt).toContain('Analyze the following 2 files')
        expect(result.prompt).toContain('### a.ts')
        expect(result.prompt).toContain('### b.ts')
        expect(result.prompt).toContain('### Inline Code')
        expect(result.fileCount).toBe(2)
        expect(result.hasInlineCode).toBe(true)

        // Verify order: all files come before inline code
        const aIndex = result.prompt.indexOf('### a.ts')
        const bIndex = result.prompt.indexOf('### b.ts')
        const inlineIndex = result.prompt.indexOf('### Inline Code')
        expect(aIndex).toBeLessThan(bIndex)
        expect(bIndex).toBeLessThan(inlineIndex)
      })
    })

    describe('Case 7: No inputs provided', () => {
      it('should throw error when no code or files provided', () => {
        expect(() => buildAnalysisPrompt([])).toThrow(
          "No code provided. Please specify 'code', 'filePath', or 'filePaths'."
        )
      })

      it('should throw error when code is empty string and no files', () => {
        expect(() => buildAnalysisPrompt([], '')).toThrow(
          "No code provided. Please specify 'code', 'filePath', or 'filePaths'."
        )
      })
    })

    describe('Focus parameter variations', () => {
      const fileContents: FileContent[] = [{ filename: 'test.ts', content: 'const x = 1;', ext: 'ts' }]

      it('should include quality focus in prompt', () => {
        const result = buildAnalysisPrompt(fileContents, undefined, undefined, 'quality')
        expect(result.prompt).toContain('with a focus on quality')
        expect(result.prompt).toContain('Code quality assessment')
      })

      it('should include security focus in prompt', () => {
        const result = buildAnalysisPrompt(fileContents, undefined, undefined, 'security')
        expect(result.prompt).toContain('with a focus on security')
        expect(result.prompt).toContain('Security vulnerabilities identification')
      })

      it('should include performance focus in prompt', () => {
        const result = buildAnalysisPrompt(fileContents, undefined, undefined, 'performance')
        expect(result.prompt).toContain('with a focus on performance')
        expect(result.prompt).toContain('Performance bottlenecks')
      })

      it('should include bugs focus in prompt', () => {
        const result = buildAnalysisPrompt(fileContents, undefined, undefined, 'bugs')
        expect(result.prompt).toContain('with a focus on bugs')
        expect(result.prompt).toContain('Bugs and logical errors')
      })

      it('should default to general focus', () => {
        const result = buildAnalysisPrompt(fileContents)
        expect(result.prompt).toContain('with a focus on general')
        expect(result.prompt).toContain('Overall code assessment')
      })
    })

    describe('Language hint handling', () => {
      it('should use file extension as language hint when no language specified', () => {
        const fileContents: FileContent[] = [{ filename: 'example.py', content: 'x = 1', ext: 'py' }]

        const result = buildAnalysisPrompt(fileContents)

        expect(result.prompt).toContain('```py')
      })

      it('should use explicit language over file extension', () => {
        const fileContents: FileContent[] = [{ filename: 'example.py', content: 'x = 1', ext: 'py' }]

        const result = buildAnalysisPrompt(fileContents, undefined, 'python')

        expect(result.prompt).toContain('```python')
      })

      it('should handle files without extension', () => {
        const fileContents: FileContent[] = [{ filename: 'Makefile', content: 'all:', ext: '' }]

        const result = buildAnalysisPrompt(fileContents)

        expect(result.prompt).toContain('### Makefile')
        expect(result.prompt).toContain('```\n') // Empty language hint
      })
    })
  })

  describe('MAX_FILE_SIZE constant', () => {
    it('should be 20MB', () => {
      expect(MAX_FILE_SIZE).toBe(20 * 1024 * 1024)
    })
  })

  describe('Integration: normalizeFilePaths + readFilesForAnalysis + buildAnalysisPrompt', () => {
    it('should work together for single file path', () => {
      const mockFs = {
        existsSync: vi.fn().mockReturnValue(true),
        statSync: vi.fn().mockReturnValue({ size: 100 }),
        readFileSync: vi.fn().mockReturnValue('const x = 1;'),
      }

      const paths = normalizeFilePaths('/path/example.ts')
      const fileContents = readFilesForAnalysis(paths, mockFs)
      const result = buildAnalysisPrompt(fileContents)

      expect(result.prompt).toContain('Analyze the following file')
      expect(result.prompt).toContain('### example.ts')
    })

    it('should work together for merged file paths', () => {
      const mockFs = {
        existsSync: vi.fn().mockReturnValue(true),
        statSync: vi.fn().mockReturnValue({ size: 100 }),
        readFileSync: vi
          .fn()
          .mockReturnValueOnce('const single = 1;')
          .mockReturnValueOnce('const a = 1;')
          .mockReturnValueOnce('const b = 2;'),
      }

      const paths = normalizeFilePaths('/path/single.ts', ['/path/a.ts', '/path/b.ts'])
      const fileContents = readFilesForAnalysis(paths, mockFs)
      const result = buildAnalysisPrompt(fileContents)

      expect(result.prompt).toContain('Analyze the following 3 files')
      expect(result.prompt).toContain('### single.ts')
      expect(result.prompt).toContain('### a.ts')
      expect(result.prompt).toContain('### b.ts')
    })

    it('should work together for files plus inline code', () => {
      const mockFs = {
        existsSync: vi.fn().mockReturnValue(true),
        statSync: vi.fn().mockReturnValue({ size: 100 }),
        readFileSync: vi.fn().mockReturnValue('const x = 1;'),
      }

      const paths = normalizeFilePaths('/path/example.ts')
      const fileContents = readFilesForAnalysis(paths, mockFs)
      const result = buildAnalysisPrompt(fileContents, 'const inline = true;')

      expect(result.prompt).toContain('### example.ts')
      expect(result.prompt).toContain('### Inline Code')
      expect(result.hasInlineCode).toBe(true)
    })
  })
})
