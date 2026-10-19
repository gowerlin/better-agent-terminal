/**
 * T0667 (BUG-136 hypothesis C): the thumbnail preview stays bounded when the output has no `\n`
 * (codex alt screen on Linux / macOS PTYs), and ordinary shell output still shows the same last
 * 8 lines as before.
 */
import { describe, expect, test } from 'vitest'
import {
  PREVIEW_INPUT_TAIL_CHARS,
  PREVIEW_LINE_MAX_CHARS,
  PREVIEW_LINES,
  PREVIEW_MAX_CHARS,
  appendPreviewInput,
  outputPreview,
  stripAnsi,
  tailPreviewInput,
  textPreview,
} from '../thumbnail-preview'

/** The flush before T0667 (src/components/TerminalThumbnail.tsx), for comparison. */
const legacyOutputPreview = (raw: string) => stripAnsi(raw).split('\n').slice(-8).join('\n')

/** One codex-like alt screen redraw: `CSI row;col H` + SGR + text, no `\n`. */
function altScreenFrame(seed: number): string {
  let s = ''
  for (let row = 1; row <= 40; row++) {
    s += `\x1b[${row};1H\x1b[38;5;${(seed + row) % 255}m row ${row} frame ${seed} lorem ipsum dolor sit amet\x1b[0m\x1b[K`
  }
  return s
}

/** Feeds `chunks` the way TerminalThumbnail does: append per chunk, flush every `perFlush` chunks. */
function feed(chunks: string[], perFlush: number, onFlush?: (preview: string) => void): string {
  let cache = ''
  let pending: string | null = null
  chunks.forEach((chunk, i) => {
    pending = appendPreviewInput(pending ?? cache, chunk)
    if ((i + 1) % perFlush === 0 || i === chunks.length - 1) {
      cache = outputPreview(pending)
      pending = null
      onFlush?.(cache)
    }
  })
  return cache
}

describe('limits (T0667)', () => {
  test('the output limit follows from the line limit', () => {
    expect(PREVIEW_LINES).toBe(8)
    expect(PREVIEW_MAX_CHARS).toBe(PREVIEW_LINES * PREVIEW_LINE_MAX_CHARS + PREVIEW_LINES - 1)
    expect(PREVIEW_MAX_CHARS).toBeLessThanOrEqual(2100)
    expect(PREVIEW_INPUT_TAIL_CHARS).toBe(16 * 1024)
  })
})

describe('output without \\n stays bounded (T0667)', () => {
  test('~10 MB of alt screen redraws: the preview is ≤ the limit and stops growing', () => {
    const chunks: string[] = []
    let total = 0
    for (let i = 0; total < 10 * 1024 * 1024; i++) {
      const c = altScreenFrame(i)
      chunks.push(c)
      total += c.length
    }
    expect(chunks.join('').includes('\n')).toBe(false)
    expect(legacyOutputPreview(chunks.slice(0, 100).join('')).length).toBeGreaterThan(100 * 1000) // before: grows with the output

    const lengths: number[] = []
    const preview = feed(chunks, 32, p => lengths.push(p.length))
    expect(lengths.length).toBeGreaterThan(100)
    expect(Math.max(...lengths)).toBeLessThanOrEqual(PREVIEW_MAX_CHARS)
    // no growth across later flushes
    const later = lengths.slice(10)
    expect(Math.max(...later)).toBe(Math.min(...later))
    expect(preview).not.toContain('\x1b')
    expect(preview).toMatch(/row \d+ frame \d+/)
  })

  test('the pending input never exceeds twice the input limit, however small the chunks', () => {
    let pending = ''
    let max = 0
    for (let i = 0; i < 20000; i++) {
      pending = appendPreviewInput(pending, `\x1b[${i % 40};1Hx${i}`)
      max = Math.max(max, pending.length)
    }
    expect(max).toBeLessThanOrEqual(2 * PREVIEW_INPUT_TAIL_CHARS + 20)
    expect(outputPreview(pending).length).toBeLessThanOrEqual(PREVIEW_MAX_CHARS)
  })

  test('one huge line is cut to the line limit; every line of a preview is capped', () => {
    expect(outputPreview('a'.repeat(100_000))).toBe('a'.repeat(PREVIEW_LINE_MAX_CHARS))
    expect(outputPreview(`${'b'.repeat(500)}\nshort`).split('\n')).toEqual(['b'.repeat(PREVIEW_LINE_MAX_CHARS), 'short'])
  })

  test('a line cap does not leave half a surrogate pair', () => {
    const line = 'x'.repeat(PREVIEW_LINE_MAX_CHARS - 1) + '😀'.repeat(10)
    const capped = outputPreview(line)
    expect(capped.length).toBe(PREVIEW_LINE_MAX_CHARS - 1)
    expect(capped).toBe('x'.repeat(PREVIEW_LINE_MAX_CHARS - 1))
  })
})

describe('the input cut never starts inside an escape sequence (T0667)', () => {
  test('a cut inside `CSI 31m` starts at the next ESC', () => {
    const head = 'x'.repeat(100)
    const raw = `${head}\x1b[31m${'y'.repeat(PREVIEW_INPUT_TAIL_CHARS - 10)}\x1b[0mtail`
    // the window starts in the middle of `\x1b[31m` (at `1m…`)
    const window = raw.slice(raw.length - PREVIEW_INPUT_TAIL_CHARS)
    expect(window.startsWith('1m')).toBe(true)
    const cut = tailPreviewInput(raw)
    expect(cut.startsWith('\x1b[0m')).toBe(true)
    expect(outputPreview(raw)).toBe('tail')
  })

  test('alt screen output cut at every offset: no `[31m`-style remnant at the start', () => {
    const frame = altScreenFrame(7).repeat(20)
    for (let extra = 0; extra < 60; extra++) {
      const raw = 'z'.repeat(extra) + frame
      const preview = outputPreview(raw)
      expect(preview).not.toMatch(/^\[?[0-9;?]+[A-Za-z]/)
      expect(preview).not.toContain('\x1b')
      expect(preview.startsWith(' row ')).toBe(true)
    }
  })

  test('a cut inside a line starts after the next \\n', () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `line ${i} ${'.'.repeat(20)}`)
    const raw = lines.join('\n')
    const cut = tailPreviewInput(raw)
    expect(cut.length).toBeLessThanOrEqual(PREVIEW_INPUT_TAIL_CHARS)
    expect(cut.startsWith('line ')).toBe(true)
    expect(outputPreview(raw)).toBe(lines.slice(-8).join('\n'))
  })

  test('short input is kept whole', () => {
    expect(tailPreviewInput('\x1b[31mred')).toBe('\x1b[31mred')
  })
})

describe('ordinary shell output is unchanged (T0667)', () => {
  const samples: string[] = [
    'PS C:\\work> ',
    '$ ls\r\nREADME.md  package.json  src\r\n$ ',
    Array.from({ length: 30 }, (_, i) => `\x1b[32m${i}\x1b[0m: \x1b[1mbuild step ${i}\x1b[0m done\r\n`).join('') + '\x1b]0;title\x07$ ',
    'npm test\r\n\x1b[?25l\x1b[2K\x1b[1G progress 10%\r progress 50%\r progress 100%\r\n\x1b[?25h> done\n',
    'line with powerline \uE0B0 and box ─── and braille ⠋\nnext\n',
  ]

  test.each(samples.map((s, i) => [i, s]))('sample %i: same last 8 lines as before', (_i, sample) => {
    expect(outputPreview(sample as string)).toBe(legacyOutputPreview(sample as string))
  })

  test('chunked over several flushes: same result as before', () => {
    const chunks = Array.from({ length: 200 }, (_, i) => `\x1b[36m~/repo\x1b[0m $ echo ${i}\r\n${i}\r\n`)
    let legacyCache = ''
    let legacyPending: string | null = null
    chunks.forEach((chunk, i) => {
      legacyPending = (legacyPending ?? legacyCache) + chunk
      if ((i + 1) % 7 === 0 || i === chunks.length - 1) {
        legacyCache = legacyOutputPreview(legacyPending)
        legacyPending = null
      }
    })
    expect(feed(chunks, 7)).toBe(legacyCache)
    expect(legacyCache.split('\n')).toHaveLength(PREVIEW_LINES)
  })
})

describe('Claude agent text (T0667)', () => {
  test('streamed text without \\n stays bounded', () => {
    let preview = ''
    for (let i = 0; i < 5000; i++) preview = textPreview(preview + `token${i} `)
    expect(preview.length).toBeLessThanOrEqual(PREVIEW_MAX_CHARS)
  })

  test('ordinary streamed text: same last 8 lines as before', () => {
    const text = Array.from({ length: 20 }, (_, i) => `- point ${i}: ─ box chars stay`).join('\n')
    expect(textPreview(text)).toBe(text.split('\n').slice(-8).join('\n'))
  })
})
