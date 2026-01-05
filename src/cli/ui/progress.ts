/**
 * Progress Bar for CLI
 *
 * Animated progress indicators for long-running operations.
 */

import { getTheme } from './theme.js'

export interface ProgressOptions {
  total?: number
  width?: number
  complete?: string
  incomplete?: string
  head?: string
  showPercent?: boolean
  showEta?: boolean
  showValue?: boolean
}

export class Progress {
  private current: number = 0
  private total: number
  private width: number
  private complete: string
  private incomplete: string
  private head: string
  private showPercent: boolean
  private showEta: boolean
  private showValue: boolean
  private startTime: number = Date.now()
  private stream: NodeJS.WriteStream = process.stderr
  private label: string = ''

  constructor(options: ProgressOptions = {}) {
    const theme = getTheme()
    this.total = options.total ?? 100
    this.width = options.width ?? 30
    this.complete = options.complete ?? '█'
    this.incomplete = options.incomplete ?? '░'
    this.head = options.head ?? '█'
    this.showPercent = options.showPercent ?? true
    this.showEta = options.showEta ?? true
    this.showValue = options.showValue ?? false
  }

  start(label?: string): this {
    if (label) this.label = label
    this.startTime = Date.now()
    this.current = 0
    // Hide cursor
    this.stream.write('\x1b[?25l')
    this.render()
    return this
  }

  update(value: number, label?: string): this {
    this.current = Math.min(value, this.total)
    if (label) this.label = label
    this.render()
    return this
  }

  increment(amount: number = 1): this {
    return this.update(this.current + amount)
  }

  private render(): void {
    const theme = getTheme()
    const percent = this.current / this.total
    const completed = Math.floor(this.width * percent)
    const remaining = this.width - completed

    // Build bar
    let bar = ''
    if (completed > 0) {
      bar += theme.colors.primary(this.complete.repeat(completed - 1))
      bar += theme.colors.highlight(this.head)
    }
    bar += theme.colors.muted(this.incomplete.repeat(remaining))

    // Build status
    const parts: string[] = []

    if (this.label) {
      parts.push(this.label)
    }

    parts.push(bar)

    if (this.showPercent) {
      parts.push(theme.colors.text(`${Math.floor(percent * 100)}%`))
    }

    if (this.showValue) {
      parts.push(theme.colors.muted(`(${this.current}/${this.total})`))
    }

    if (this.showEta && percent > 0 && percent < 1) {
      const elapsed = (Date.now() - this.startTime) / 1000
      const estimatedTotal = elapsed / percent
      const eta = Math.ceil(estimatedTotal - elapsed)
      parts.push(theme.colors.muted(`(${formatTime(eta)})`))
    }

    this.stream.write(`\r\x1b[K${parts.join(' ')}`)
  }

  done(message?: string): void {
    const theme = getTheme()
    this.current = this.total

    // Clear and show final state
    this.stream.write('\r\x1b[K')

    if (message) {
      this.stream.write(`${theme.colors.success(theme.symbols.success)} ${message}\n`)
    } else {
      const elapsed = (Date.now() - this.startTime) / 1000
      this.stream.write(
        `${theme.colors.success(theme.symbols.success)} ${this.label || 'Complete'} ` +
        `${theme.colors.muted(`(${formatTime(elapsed)})`)}\n`
      )
    }

    // Show cursor
    this.stream.write('\x1b[?25h')
  }

  fail(message?: string): void {
    const theme = getTheme()
    this.stream.write('\r\x1b[K')
    this.stream.write(
      `${theme.colors.error(theme.symbols.error)} ${message || 'Failed'}\n`
    )
    this.stream.write('\x1b[?25h')
  }
}

// Format seconds to human readable
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.ceil(seconds % 60)
    return `${mins}m ${secs}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }
}

// Convenience function
export function progress(options?: ProgressOptions): Progress {
  return new Progress(options)
}
