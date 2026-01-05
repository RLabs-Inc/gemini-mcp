/**
 * Animated Spinner for CLI
 *
 * Beautiful loading indicators that work in any terminal.
 */

import { getTheme } from './theme.js'

export interface SpinnerOptions {
  text?: string
  color?: (text: string) => string
  frames?: string[]
  interval?: number
}

export class Spinner {
  private text: string
  private color: (text: string) => string
  private frames: string[]
  private interval: number
  private currentFrame: number = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private stream: NodeJS.WriteStream = process.stderr

  constructor(options: SpinnerOptions = {}) {
    const theme = getTheme()
    this.text = options.text ?? 'Loading...'
    this.color = options.color ?? theme.colors.primary
    this.frames = options.frames ?? theme.symbols.spinner
    this.interval = options.interval ?? 80
  }

  start(text?: string): this {
    if (text) this.text = text
    if (this.timer) return this

    // Hide cursor
    this.stream.write('\x1b[?25l')

    this.timer = setInterval(() => {
      this.render()
      this.currentFrame = (this.currentFrame + 1) % this.frames.length
    }, this.interval)

    return this
  }

  private render(): void {
    // Clear line and write spinner
    const frame = this.color(this.frames[this.currentFrame])
    this.stream.write(`\r${frame} ${this.text}`)
  }

  update(text: string): this {
    this.text = text
    return this
  }

  stop(): this {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    // Clear line and show cursor
    this.stream.write('\r\x1b[K\x1b[?25h')
    return this
  }

  success(text?: string): void {
    this.stopWithSymbol('success', text)
  }

  error(text?: string): void {
    this.stopWithSymbol('error', text)
  }

  warn(text?: string): void {
    this.stopWithSymbol('warning', text)
  }

  info(text?: string): void {
    this.stopWithSymbol('info', text)
  }

  private stopWithSymbol(type: 'success' | 'error' | 'warning' | 'info', text?: string): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    const theme = getTheme()
    const symbol = theme.symbols[type]
    const color = theme.colors[type]
    const message = text ?? this.text

    // Clear line, print result, show cursor
    this.stream.write(`\r\x1b[K${color(symbol)} ${message}\n\x1b[?25h`)
  }
}

// Convenience function
export function spinner(options?: SpinnerOptions | string): Spinner {
  if (typeof options === 'string') {
    return new Spinner({ text: options })
  }
  return new Spinner(options)
}

// Pre-configured spinners for common operations
export const spinners = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['-', '\\', '|', '/'],
  circle: ['◐', '◓', '◑', '◒'],
  arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
  pulse: ['█', '▓', '▒', '░', '▒', '▓'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
  arrows: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  moon: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
  clock: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
}
