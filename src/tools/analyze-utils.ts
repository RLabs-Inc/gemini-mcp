/**
 * Analyze Tool Utilities - Pure functions for code analysis prompt construction
 *
 * These utility functions are extracted for testability and reusability.
 * They have no external dependencies beyond Node.js built-ins.
 */

import * as fs from 'fs'
import * as path from 'path'

/**
 * Maximum file size for code analysis (20MB)
 */
export const MAX_FILE_SIZE = 20 * 1024 * 1024

/**
 * Focus areas for code analysis
 */
export type AnalysisFocus = 'quality' | 'security' | 'performance' | 'bugs' | 'general'

/**
 * Represents a file's content for analysis
 */
export interface FileContent {
  filename: string
  content: string
  ext: string
}

/**
 * Input parameters for code analysis
 */
export interface CodeAnalysisInput {
  code?: string
  filePath?: string
  filePaths?: string[]
  language?: string
  focus: AnalysisFocus
}

/**
 * Result of building the analysis prompt
 */
export interface PromptBuildResult {
  prompt: string
  fileCount: number
  hasInlineCode: boolean
}

/**
 * File system interface for dependency injection (testing)
 */
export interface FileSystemLike {
  existsSync: typeof fs.existsSync
  statSync: typeof fs.statSync
  readFileSync: typeof fs.readFileSync
}

/**
 * Normalize file paths from inputs - coerce filePath to array, merge with filePaths
 */
export function normalizeFilePaths(filePath?: string, filePaths?: string[]): string[] {
  const allPaths: string[] = []
  if (filePath) {
    allPaths.push(filePath)
  }
  if (filePaths) {
    allPaths.push(...filePaths)
  }
  return allPaths
}

/**
 * Read and validate files for analysis
 * @throws Error if file not found or too large
 */
export function readFilesForAnalysis(paths: string[], fileSystem: FileSystemLike = fs): FileContent[] {
  const fileContents: FileContent[] = []

  for (const fp of paths) {
    if (!fileSystem.existsSync(fp)) {
      throw new Error(`File not found: ${fp}`)
    }
    const stats = fileSystem.statSync(fp)
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${fp} (${Math.round(stats.size / 1024 / 1024)}MB, max 20MB)`)
    }
    const content = fileSystem.readFileSync(fp, 'utf-8')
    const filename = path.basename(fp)
    const ext = path.extname(fp).slice(1) // Remove leading dot
    fileContents.push({ filename, content, ext })
  }

  return fileContents
}

/**
 * Build the code section of the prompt from file contents and inline code
 */
export function buildCodeSection(fileContents: FileContent[], code?: string, language?: string): string {
  let codeSection = ''

  if (fileContents.length > 0) {
    // Format each file with its name
    for (const { filename, content, ext } of fileContents) {
      const langHint = language || ext || ''
      codeSection += `### ${filename}\n\`\`\`${langHint}\n${content}\n\`\`\`\n\n`
    }
  }

  if (code) {
    // Append inline code if provided
    const langHint = language || ''
    if (fileContents.length > 0) {
      codeSection += `### Inline Code\n\`\`\`${langHint}\n${code}\n\`\`\`\n\n`
    } else {
      codeSection += `\`\`\`${langHint}\n${code}\n\`\`\`\n\n`
    }
  }

  return codeSection
}

/**
 * Build the analysis target text based on file count and language
 */
export function buildAnalysisTarget(fileCount: number, language?: string): string {
  const langText = language ? `${language} code` : 'code'
  return fileCount > 0
    ? `the following ${fileCount === 1 ? 'file' : `${fileCount} files`}`
    : `the following ${langText}`
}

/**
 * Get the focus-specific instructions for the analysis
 */
export function getFocusInstructions(focus: AnalysisFocus): string {
  switch (focus) {
    case 'quality':
      return '1. Code quality assessment\n2. Style and readability review\n3. Maintainability considerations\n4. Suggested improvements'
    case 'security':
      return '1. Security vulnerabilities identification\n2. Potential exploit vectors\n3. Security best practices assessment\n4. Security improvements'
    case 'performance':
      return '1. Performance bottlenecks\n2. Optimization opportunities\n3. Algorithmic complexity analysis\n4. Performance improvement suggestions'
    case 'bugs':
      return "1. Bugs and logical errors\n2. Edge cases that aren't handled\n3. Potential runtime errors\n4. Bug fix suggestions"
    case 'general':
    default:
      return '1. Overall code assessment\n2. Strengths and weaknesses\n3. Potential issues (bugs, security, performance)\n4. Suggested improvements'
  }
}

/**
 * Build the complete analysis prompt
 * @throws Error if no code provided
 */
export function buildAnalysisPrompt(
  fileContents: FileContent[],
  code?: string,
  language?: string,
  focus: AnalysisFocus = 'general'
): PromptBuildResult {
  // Validate that we have something to analyze
  if (fileContents.length === 0 && !code) {
    throw new Error("No code provided. Please specify 'code', 'filePath', or 'filePaths'.")
  }

  const codeSection = buildCodeSection(fileContents, code, language)
  const analysisTarget = buildAnalysisTarget(fileContents.length, language)
  const focusInstructions = getFocusInstructions(focus)

  const prompt = `
Analyze ${analysisTarget} with a focus on ${focus}:

${codeSection}
Please provide:
${focusInstructions}
`

  return {
    prompt,
    fileCount: fileContents.length,
    hasInlineCode: !!code,
  }
}
