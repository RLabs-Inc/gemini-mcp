/**
 * Output Directory Utility
 *
 * Determines platform-appropriate output directories for generated files.
 * Uses user config directories with unique per-project subdirectories.
 *
 * Platform defaults:
 * - macOS/Linux: ~/.config/gemini-mcp/output/<project-hash>
 * - Windows: %APPDATA%/gemini-mcp/output/<project-hash>
 *
 * Environment variable GEMINI_OUTPUT_DIR overrides platform defaults.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'

/**
 * Find the git repository root by walking up the directory tree
 * Returns null if not in a git repository
 */
function findGitRoot(startDir: string): string | null {
  let dir = startDir
  while (dir !== path.dirname(dir)) {
    // Stop at filesystem root
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir
    }
    dir = path.dirname(dir)
  }
  return null
}

/**
 * Get unique identifier for current project
 * Uses git repository root if available, otherwise current working directory.
 * Resolves symlinks to ensure consistent identifiers.
 */
export function getProjectIdentifier(): string {
  // Resolve symlinks in current working directory
  const resolvedCwd = fs.realpathSync(process.cwd())

  // Check if we're in a git repository
  const gitRoot = findGitRoot(resolvedCwd)

  if (gitRoot) {
    // Resolve symlinks in git root as well
    const resolvedGitRoot = fs.realpathSync(gitRoot)

    // Create short hash of the resolved git root path
    return crypto
      .createHash('sha256')
      .update(resolvedGitRoot)
      .digest('hex')
      .substring(0, 16)
  }

  // Not a git repository, use resolved current directory
  return crypto
    .createHash('sha256')
    .update(resolvedCwd)
    .digest('hex')
    .substring(0, 16)
}

/**
 * Get platform-appropriate base configuration directory
 */
export function getConfigBaseDir(): string {
  const platform = process.platform

  switch (platform) {
    case 'win32':
      // Windows: %APPDATA%/gemini-mcp
      return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'gemini-mcp'
      )

    case 'darwin':
    case 'linux':
    default:
      // macOS/Linux: ~/.config/gemini-mcp (XDG standard)
      return path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
        'gemini-mcp'
      )
  }
}

/**
 * Get output directory for generated files
 *
 * Returns project-specific output directory for images, videos, audio, etc.
 *
 * Priority:
 * 1. GEMINI_OUTPUT_DIR environment variable (if set)
 * 2. Platform config directory with project-specific subdirectory
 *
 * @returns Absolute path to output directory
 */
export function getOutputDir(): string {
  // Environment variable takes precedence
  if (process.env.GEMINI_OUTPUT_DIR) {
    return process.env.GEMINI_OUTPUT_DIR
  }

  // Get platform-appropriate base directory
  const baseDir = getConfigBaseDir()

  // Create project-specific subdirectory
  const projectId = getProjectIdentifier()
  const outputPath = path.join(baseDir, 'output', projectId)

  return outputPath
}

/**
 * Ensure output directory exists
 * Creates the directory if it doesn't exist.
 *
 * @param dir Optional directory path, defaults to getOutputDir()
 */
export function ensureOutputDir(dir?: string): string {
  const outputDir = dir || getOutputDir()

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  return outputDir
}
