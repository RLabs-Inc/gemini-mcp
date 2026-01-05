/**
 * Terminal Color Utilities
 *
 * Uses ANSI escape codes directly for zero dependencies.
 * Respects NO_COLOR and FORCE_COLOR environment variables.
 * Bun handles these natively in TTY detection.
 */

// ANSI escape codes
const ESC = '\x1b['
const RESET = `${ESC}0m`

// Check if colors should be used
function shouldUseColors(): boolean {
  // NO_COLOR takes precedence (https://no-color.org/)
  if (process.env.NO_COLOR !== undefined) return false

  // FORCE_COLOR overrides TTY detection
  if (process.env.FORCE_COLOR !== undefined) return true

  // Check if stdout is a TTY
  return process.stdout.isTTY ?? false
}

const colorsEnabled = shouldUseColors()

// Color function factory
function createColor(code: string) {
  return (text: string): string => {
    if (!colorsEnabled) return text
    return `${ESC}${code}m${text}${RESET}`
  }
}

// Foreground colors
export const black = createColor('30')
export const red = createColor('31')
export const green = createColor('32')
export const yellow = createColor('33')
export const blue = createColor('34')
export const magenta = createColor('35')
export const cyan = createColor('36')
export const white = createColor('37')

// Bright foreground colors
export const brightBlack = createColor('90')
export const brightRed = createColor('91')
export const brightGreen = createColor('92')
export const brightYellow = createColor('93')
export const brightBlue = createColor('94')
export const brightMagenta = createColor('95')
export const brightCyan = createColor('96')
export const brightWhite = createColor('97')

// Background colors
export const bgBlack = createColor('40')
export const bgRed = createColor('41')
export const bgGreen = createColor('42')
export const bgYellow = createColor('43')
export const bgBlue = createColor('44')
export const bgMagenta = createColor('45')
export const bgCyan = createColor('46')
export const bgWhite = createColor('47')

// Text styles
export const bold = createColor('1')
export const dim = createColor('2')
export const italic = createColor('3')
export const underline = createColor('4')
export const inverse = createColor('7')
export const strikethrough = createColor('9')

// RGB color support (for themes)
export function rgb(r: number, g: number, b: number) {
  return (text: string): string => {
    if (!colorsEnabled) return text
    return `${ESC}38;2;${r};${g};${b}m${text}${RESET}`
  }
}

export function bgRgb(r: number, g: number, b: number) {
  return (text: string): string => {
    if (!colorsEnabled) return text
    return `${ESC}48;2;${r};${g};${b}m${text}${RESET}`
  }
}

// 256 color support
export function color256(code: number) {
  return (text: string): string => {
    if (!colorsEnabled) return text
    return `${ESC}38;5;${code}m${text}${RESET}`
  }
}

// Hex color support (convenience)
export function hex(hexColor: string) {
  const h = hexColor.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return rgb(r, g, b)
}

// Utility exports
export const colors = {
  enabled: colorsEnabled,
  reset: RESET,
}

// Chainable style builder
export function style(...styles: Array<(text: string) => string>) {
  return (text: string): string => {
    return styles.reduce((t, s) => s(t), text)
  }
}
