/**
 * Fixed-capacity line buffer for PTY output.
 * Splits incoming data on '\n' boundaries and discards oldest lines
 * when capacity is exceeded. Used to replay output on reconnect.
 */
export class RingBuffer {
  private lines: string[] = []
  private readonly maxLines: number

  constructor(maxLines = 1000) {
    this.maxLines = maxLines
  }

  /**
   * Append raw PTY data. Handles partial lines by merging the first new
   * chunk with the last existing line (since PTY data can split mid-line).
   */
  push(data: string): void {
    const newLines = data.split('\n')

    if (this.lines.length > 0 && newLines.length > 0) {
      // Merge last existing partial line with first incoming chunk
      this.lines[this.lines.length - 1] += newLines.shift()!
    }

    for (const line of newLines) {
      this.lines.push(line)
    }

    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines)
    }
  }

  /** Return a copy of all buffered lines. */
  getLines(): string[] {
    return [...this.lines]
  }

  clear(): void {
    this.lines = []
  }

  get lineCount(): number {
    return this.lines.length
  }
}
