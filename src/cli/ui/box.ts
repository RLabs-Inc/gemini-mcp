/**
 * Box Component for CLI
 *
 * Creates beautiful bordered boxes for headers, results, and highlights.
 */

import { getTheme } from './theme.js'

export interface BoxOptions {
  title?: string
  padding?: number
  margin?: number
  borderColor?: (text: string) => string
  titleColor?: (text: string) => string
  width?: number | 'auto'
  align?: 'left' | 'center' | 'right'
}

// Get terminal width safely
function getTerminalWidth(): number {
  return process.stdout.columns ?? 80
}

// Strip ANSI codes for length calculation
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

// Pad string to width
function pad(str: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
  const visibleLength = stripAnsi(str).length
  const padding = width - visibleLength

  if (padding <= 0) return str

  switch (align) {
    case 'center': {
      const left = Math.floor(padding / 2)
      const right = padding - left
      return ' '.repeat(left) + str + ' '.repeat(right)
    }
    case 'right':
      return ' '.repeat(padding) + str
    default:
      return str + ' '.repeat(padding)
  }
}

export function box(content: string | string[], options: BoxOptions = {}): string {
  const theme = getTheme()
  const {
    title,
    padding = 1,
    margin = 0,
    borderColor = theme.colors.primary,
    titleColor = theme.colors.highlight,
    width = 'auto',
    align = 'left',
  } = options

  const { topLeft, topRight, bottomLeft, bottomRight, horizontal, vertical } = theme.box

  // Normalize content to array of lines
  const lines = Array.isArray(content) ? content : content.split('\n')

  // Calculate widths
  const termWidth = getTerminalWidth()
  const maxLineWidth = Math.max(...lines.map((l) => stripAnsi(l).length))
  const titleWidth = title ? stripAnsi(title).length + 2 : 0 // +2 for spaces around title

  let innerWidth: number
  if (width === 'auto') {
    innerWidth = Math.max(maxLineWidth, titleWidth) + padding * 2
  } else {
    innerWidth = Math.min(width, termWidth - 4) - 2 // -2 for borders
  }

  const marginStr = ' '.repeat(margin)
  const paddingStr = ' '.repeat(padding)

  // Build the box
  const result: string[] = []

  // Top border with optional title
  if (title) {
    const titleStr = ` ${titleColor(title)} `
    const leftBorder = horizontal.repeat(2)
    const rightBorderLen = innerWidth - 4 - stripAnsi(title).length
    const rightBorder = horizontal.repeat(Math.max(0, rightBorderLen))
    result.push(marginStr + borderColor(topLeft + leftBorder) + titleStr + borderColor(rightBorder + topRight))
  } else {
    result.push(marginStr + borderColor(topLeft + horizontal.repeat(innerWidth) + topRight))
  }

  // Content lines with padding
  for (const line of lines) {
    const paddedLine = pad(line, innerWidth - padding * 2, align)
    result.push(marginStr + borderColor(vertical) + paddingStr + paddedLine + paddingStr + borderColor(vertical))
  }

  // Bottom border
  result.push(marginStr + borderColor(bottomLeft + horizontal.repeat(innerWidth) + bottomRight))

  return result.join('\n')
}

// Quick box variants
export function header(title: string, subtitle?: string): string {
  const theme = getTheme()
  const content = subtitle ? [title, theme.colors.muted(subtitle)] : [title]
  return box(content, {
    borderColor: theme.colors.primary,
    titleColor: theme.colors.highlight,
    align: 'center',
    padding: 2,
  })
}

export function success(message: string): string {
  const theme = getTheme()
  return box(`${theme.symbols.success} ${message}`, {
    borderColor: theme.colors.success,
    padding: 1,
  })
}

export function error(message: string): string {
  const theme = getTheme()
  return box(`${theme.symbols.error} ${message}`, {
    borderColor: theme.colors.error,
    padding: 1,
  })
}

export function warning(message: string): string {
  const theme = getTheme()
  return box(`${theme.symbols.warning} ${message}`, {
    borderColor: theme.colors.warning,
    padding: 1,
  })
}

export function info(message: string): string {
  const theme = getTheme()
  return box(`${theme.symbols.info} ${message}`, {
    borderColor: theme.colors.info,
    padding: 1,
  })
}
