/**
 * Logger Utility - Provides logging capabilities with different verbosity levels
 */

export type LogLevel = 'quiet' | 'normal' | 'verbose'

interface Logger {
  error: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  debug: (message: string, ...args: unknown[]) => void
  // Special logging methods for prompts and responses
  prompt: (prompt: string) => void
  response: (response: string) => void
}

/**
 * Current logging level
 */
let currentLogLevel: LogLevel = 'normal'

/**
 * Sets up the logger with the specified verbosity level
 */
export function setupLogger(level: LogLevel): void {
  currentLogLevel = level
}

/**
 * Returns whether full prompts and responses should be logged
 */
export function shouldLogFullMessages(): boolean {
  return currentLogLevel === 'verbose'
}

/**
 * Returns whether info messages should be logged
 */
export function shouldLogInfo(): boolean {
  return currentLogLevel !== 'quiet'
}

/**
 * Returns whether debug messages should be logged
 */
export function shouldLogDebug(): boolean {
  return currentLogLevel === 'verbose'
}

/**
 * The logger instance
 */
export const logger: Logger = {
  error: (message: string, ...args: unknown[]) => {
    // Errors are always logged
    console.error(`ERROR: ${message}`, ...args)
  },

  warn: (message: string, ...args: unknown[]) => {
    // Warnings are always logged
    console.warn(`WARN: ${message}`, ...args)
  },

  info: (message: string, ...args: unknown[]) => {
    // Info messages are logged in normal and verbose modes
    if (shouldLogInfo()) {
      console.info(`INFO: ${message}`, ...args)
    }
  },

  debug: (message: string, ...args: unknown[]) => {
    // Debug messages are only logged in verbose mode
    if (shouldLogDebug()) {
      console.debug(`DEBUG: ${message}`, ...args)
    }
  },

  prompt: (prompt: string) => {
    // Prompts are only fully logged in verbose mode
    if (shouldLogFullMessages()) {
      console.info(`\n===== PROMPT =====\n${prompt}\n==================\n`)
    } else if (shouldLogInfo()) {
      // In normal mode, just log a summary
      const summary = prompt.length > 100 ? `${prompt.substring(0, 100)}...` : prompt
      console.info(`PROMPT: ${summary}`)
    }
  },

  response: (response: string) => {
    // Responses are only fully logged in verbose mode
    if (shouldLogFullMessages()) {
      console.info(`\n===== RESPONSE =====\n${response}\n====================\n`)
    } else if (shouldLogInfo()) {
      // In normal mode, just log a summary
      const summary = response.length > 100 ? `${response.substring(0, 100)}...` : response
      console.info(`RESPONSE: ${summary}`)
    }
  },
}
