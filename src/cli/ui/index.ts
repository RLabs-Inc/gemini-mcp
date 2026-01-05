/**
 * UI Components for Gemini CLI
 *
 * Beautiful, theme-aware terminal UI components.
 */

// Colors
export * from './colors.js'

// Theme system
export { getTheme, setTheme, t, themes } from './theme.js'
export type { Theme } from './theme.js'

// Components
export { Spinner, spinner, spinners } from './spinner.js'
export type { SpinnerOptions } from './spinner.js'

export { Progress, progress } from './progress.js'
export type { ProgressOptions } from './progress.js'

export { box, header, success, error, warning, info } from './box.js'
export type { BoxOptions } from './box.js'

// Quick print helpers using theme
import { getTheme } from './theme.js'

export function print(message: string): void {
  console.log(message)
}

export function printSuccess(message: string): void {
  const theme = getTheme()
  console.log(`${theme.colors.success(theme.symbols.success)} ${message}`)
}

export function printError(message: string): void {
  const theme = getTheme()
  console.error(`${theme.colors.error(theme.symbols.error)} ${message}`)
}

export function printWarning(message: string): void {
  const theme = getTheme()
  console.log(`${theme.colors.warning(theme.symbols.warning)} ${message}`)
}

export function printInfo(message: string): void {
  const theme = getTheme()
  console.log(`${theme.colors.info(theme.symbols.info)} ${message}`)
}

export function printMuted(message: string): void {
  const theme = getTheme()
  console.log(theme.colors.muted(message))
}

// Newline helper
export function nl(count: number = 1): void {
  console.log('\n'.repeat(count - 1))
}
