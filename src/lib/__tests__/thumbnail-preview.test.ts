/**
 * T0667 (BUG-136 hypothesis C): the thumbnail preview stays bounded when the output has no `\n`
 * (codex alt screen on Linux / macOS PTYs), and ordinary shell output still shows the same last
 * 8 lines as before.
 */
import { describe, expect, test } from 'vitest'
import {
  IN_PLACE_UPDATE_MAX_CHARS,
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

/**
 * stripAnsi before T0714: a CSI was removed only with `[0-9;?]` params and a letter final; any
 * other `\x1b[` lost just those two characters (to `\x1b.`), leaving e.g. `>0q`.
 */
const t0667StripAnsi = (s: string) => stripAnsi(s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b\[/g, ''))

/** outputPreview before T0714 (T0667): only `\n` breaks lines. */
const t0667OutputPreview = (raw: string) =>
  t0667StripAnsi(tailPreviewInput(raw)).split('\n').slice(-PREVIEW_LINES).map(l => l.slice(0, PREVIEW_LINE_MAX_CHARS)).join('\n')

/** One codex-like alt screen redraw: `CSI row;col H` + SGR + text, no `\n`. */
function altScreenFrame(seed: number): string {
  let s = ''
  for (let row = 1; row <= 40; row++) {
    s += `\x1b[${row};1H\x1b[38;5;${(seed + row) % 255}m row ${row} frame ${seed} lorem ipsum dolor sit amet\x1b[0m\x1b[K`
  }
  return s
}

/** Feeds `chunks` the way TerminalThumbnail does: append per chunk, flush every `perFlush` chunks. */
function feed(chunks: string[], perFlush: number, onFlush?: (preview: string) => void, flush = outputPreview): string {
  let cache = ''
  let pending: string | null = null
  chunks.forEach((chunk, i) => {
    pending = appendPreviewInput(pending ?? cache, chunk)
    if ((i + 1) % perFlush === 0 || i === chunks.length - 1) {
      cache = flush(pending)
      pending = null
      onFlush?.(cache)
    }
  })
  return cache
}

/*
 * claude on a macOS / Linux PTY (T0714). Shaped after a WSL recording of claude 2.1.287 (`script`,
 * 0 `\n` after the alt screen switch) and BUG-175's screenshot (`>0q>4m`, `Claude Codev2.1.306`);
 * paths and names are made up.
 */
const CLAUDE_START =
  '\x1b]0;demo@mac:~/proj\x07demo@mac ~/proj % claude\r\n' +
  '\x1b[?2004h\x1b[>0q\x1b[>4m\x1b[38;5;174mClaude Code\x1b[13G\x1b[38;5;246mv2.1.306\x1b[39m'
const CLAUDE_ALT_SCREEN =
  '\x1b]0;✳ Claude Code\x07\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l\x1b[H\r\x1b[11C\x1b[1B\x1b[1mClaude Code\x1b[24G\x1b[22m' +
  '\x1b[38;5;246mv2.1.306\r\x1b[11C\x1b[1BOpus 5.5 · Claude Max\r\x1b[11C\x1b[1B/Users/demo/proj\r\x1b[22B' +
  '\x1b[38;5;244m──────\r\x1b[1B\x1b[39m❯\u00a0\r\x1b[1B\x1b[38;5;244m──────\r\x1b[2C\x1b[1B' +
  '\x1b[38;5;220m⏵⏵ auto mode on\x1b[38;5;246m (shift+tab to cycle)\x1b[39m\x1b[30;1H\x1b[28;3H\x1b[?25h'
/** A new transcript line written by the diff renderer (home, then relative moves). */
const claudeMessage = (i: number) =>
  `\x1b[?25l\x1b[H\r\x1b[${4 + (i % 18)}B\x1b[38;5;231m⏺ Read src/file${i}.ts\x1b[39m\r\x1b[1B  ⎿  ${i * 10} lines` +
  `\r\x1b[1B\x1b[38;5;174m✻\x1b[3GThinking… (${i}s · esc to interrupt)\x1b[39m\x1b[30;1H\x1b[28;3H\x1b[?25h`
/** A timer tick: one digit rewritten in place, past column 1. */
const claudeTick = (i: number) =>
  `\x1b[?25l\x1b[H\r\x1b[12C\x1b[24B\x1b[38;5;246m${i % 10}\x1b[39m\x1b[30;1H\x1b[28;3H\x1b[?25h`

function claudeSession(messages: number): string[] {
  const chunks = [CLAUDE_START, CLAUDE_ALT_SCREEN]
  for (let i = 1; i <= messages; i++) chunks.push(claudeMessage(i), claudeTick(i), claudeTick(i + 1))
  return chunks
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
    const previews: string[] = []
    const preview = feed(chunks, 32, p => { lengths.push(p.length); previews.push(p) })
    expect(lengths.length).toBeGreaterThan(100)
    expect(Math.max(...lengths)).toBeLessThanOrEqual(PREVIEW_MAX_CHARS)
    // no growth across later flushes: each shows the last 8 rows of its latest frame (T0714)
    for (const p of previews.slice(10)) {
      expect(p.split('\n')).toEqual(Array.from({ length: PREVIEW_LINES }, (_, i) =>
        expect.stringMatching(new RegExp(`^ row ${33 + i} frame \\d+ lorem ipsum dolor sit amet$`))))
    }
    expect(preview).not.toContain('\x1b')
    expect(preview.split('\n')[PREVIEW_LINES - 1]).toBe(` row 40 frame ${chunks.length - 1} lorem ipsum dolor sit amet`)
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

describe('BUG-175: output that moves the cursor instead of sending \\n (T0714)', () => {
  test('cause 1: before T0714 the preview stayed on the startup screen', () => {
    const before: string[] = []
    feed(claudeSession(40), 1, p => before.push(p), t0667OutputPreview)
    const stuck = before[before.length - 1]
    expect(stuck.split('\n')[1]).toMatch(/^>0q>4mClaude Codev2\.1\.306/) // the BUG-175 screenshot
    expect(before.slice(20).every(p => p === stuck)).toBe(true) // never changes again
    expect(stuck).not.toContain('file40')
  })

  test('the preview follows the latest transcript lines', () => {
    const previews: string[] = []
    const last = feed(claudeSession(40), 1, p => previews.push(p))
    expect(last).not.toContain('>0q')
    expect(last).not.toContain('\x1b')
    const lines = last.split('\n')
    expect(lines).toContain('⏺ Read src/file40.ts')
    expect(lines).toContain('  ⎿  400 lines')
    expect(lines[lines.length - 1]).toBe('✻Thinking… (40s · esc to interrupt)')
    // the timer ticks (one digit past column 1) add no lines
    expect(lines.every(l => !/^\d$/.test(l))).toBe(true)
    // it changes with every message
    expect(new Set(previews).size).toBeGreaterThan(40)
  })

  test('alt screen start: the shell lines before it are dropped', () => {
    expect(outputPreview(CLAUDE_START + CLAUDE_ALT_SCREEN)).toBe([
      'Claude Codev2.1.306', 'Opus 5.5 · Claude Max', '/Users/demo/proj', '❯\u00a0', '⏵⏵ auto mode on (shift+tab to cycle)',
    ].join('\n'))
  })

  test('cause 2: CSI with `>` / `<` / `=` / intermediate bytes / other finals left text behind', () => {
    const seqs = ['\x1b[>0q', '\x1b[>4m', '\x1b[>4;2m', '\x1b[?u', '\x1b[<u', '\x1b[=5u', '\x1b[2 q', '\x1b[!p', '\x1b[5@', '\x1b[3`', '\x1b[?2026$p']
    const raw = `a${seqs.join('')}b`
    expect(t0667StripAnsi(raw)).toBe('a>0q>4m>4;2m<u=5u2 q!p5@3`?2026$pb')
    expect(stripAnsi(raw)).toBe('ab')
    for (const s of seqs) expect(stripAnsi(`x${s}y`), JSON.stringify(s)).toBe('xy')
  })

  test('absolute and relative moves to another row break the line', () => {
    expect(outputPreview('a\x1b[2;1Hb\x1b[3;1Hc')).toBe('a\nb\nc')
    expect(outputPreview('a\x1b[5Hb\x1b[Hc\x1b[7d\rd')).toBe('a\nb\nc\nd')
    expect(outputPreview('top\x1b[H\r\x1b[1Bone\r\x1b[1Btwo\x1b[2A\rthree')).toBe('top\none\ntwo\nthree')
    expect(outputPreview('a\x1b[2Eb\x1b[Fc\x1bD\rd\x1bEe\x1bM\rf')).toBe('a\nb\nc\nd\ne\nf')
  })

  test('moves within a row do not break it', () => {
    // same row (known): `CSI row;col H`, column moves
    expect(outputPreview('\x1b[3;1Hfoo\x1b[3;10Hbar\x1b[20Gbaz\x1b[2Cqux\x1b[1Dx')).toBe('foobarbazquxx')
    // row unknown, column > 1: ConPTY re-drawing a PSReadLine prompt line
    expect(outputPreview('PS C:\\Users\\demo>\x1b[1C\x1b[30;19H\x1b[93mecho\x1b[m hi')).toBe('PS C:\\Users\\demo>echo hi')
  })

  test('no empty lines: a move followed by nothing, blank padding or a \\n adds no line', () => {
    expect(outputPreview('a\x1b[5;1H')).toBe('a')
    expect(outputPreview('a\x1b[5;1H\x1b[K\x1b[6;1H   \x1b[7;1Hb')).toBe('a\nb')
    expect(outputPreview('a\x1b[5;1H\r\nb')).toBe(t0667OutputPreview('a\x1b[5;1H\r\nb'))
    expect(outputPreview('a\r\n\x1b[5;1Hb')).toBe('a\nb')
    expect(outputPreview('a\x1b[5;1H──────\x1b[6;1Hb')).toBe('a\nb')
  })

  test(`in-place updates: fewer than ${IN_PLACE_UPDATE_MAX_CHARS} visible characters past column 1 of another row are dropped`, () => {
    const prev = 'Working… (3s)'
    expect(outputPreview(`${prev}\x1b[H\r\x1b[10C\x1b[4B4\x1b[30;1H\x1b[28;3H`)).toBe(prev)
    expect(outputPreview(`${prev}\x1b[3;1H\x1b[4;11H${'x'.repeat(IN_PLACE_UPDATE_MAX_CHARS - 1)}`)).toBe(prev)
    // longer text past column 1 is content (a header next to a logo, an indented line)
    expect(outputPreview(`${prev}\x1b[3;1H\x1b[4;11H${'x'.repeat(IN_PLACE_UPDATE_MAX_CHARS)}`)).toBe(`${prev}\n${'x'.repeat(IN_PLACE_UPDATE_MAX_CHARS)}`)
    // short text at column 1 is a line
    expect(outputPreview(`${prev}\x1b[4;1H❯`)).toBe(`${prev}\n❯`)
    // dropped only up to the next move / `\n`
    expect(outputPreview(`${prev}\x1b[3;1H\x1b[4;11H5\x1b[5;1Hnext`)).toBe(`${prev}\nnext`)
    expect(outputPreview(`${prev}\x1b[3;1H\x1b[4;11H5\nnext`)).toBe(`${prev}\nnext`)
  })

  test('screen clear and alt screen switches restart the preview', () => {
    expect(outputPreview('old 1\r\nold 2\r\n\x1b[?1049h\x1b[Hnew')).toBe('new')
    expect(outputPreview('old\r\n\x1b[H\x1b[2J$ ')).toBe('$ ')
    expect(outputPreview('in tui\x1b[?1049l\r\n$ ')).toBe('\n$ ')
    expect(outputPreview('a\x1b[?47hb\x1b[?1047lc')).toBe('c')
    // other erases do not
    expect(outputPreview('a\r\nb\x1b[J\x1b[1J\x1b[3J')).toBe('a\nb')
  })

  test('a codex-like frame cut at every offset: no remnant, rows as lines', () => {
    const frame = altScreenFrame(3)
    for (let cut = 0; cut < 120; cut++) {
      const lines = outputPreview(frame.slice(cut)).split('\n')
      expect(lines.slice(-7)).toEqual(Array.from({ length: 7 }, (_, i) => ` row ${34 + i} frame 3 lorem ipsum dolor sit amet`))
    }
  })

  test('1 MiB without \\n: bounded, and the time stays linear', () => {
    const frames: string[] = []
    let size = 0
    for (let i = 0; size < 1024 * 1024; i++) {
      const c = i % 3 === 0 ? claudeMessage(i) : i % 3 === 1 ? claudeTick(i) : altScreenFrame(i)
      frames.push(c)
      size += c.length
    }
    const raw = frames.join('')
    expect(raw.includes('\n')).toBe(false)
    const t0 = performance.now()
    const one = outputPreview(raw)
    const t1 = performance.now()
    const chunks: string[] = []
    for (let i = 0; i < raw.length; i += 4096) chunks.push(raw.slice(i, i + 4096))
    const fed = feed(chunks, 8)
    const t2 = performance.now()
    expect(one.length).toBeLessThanOrEqual(PREVIEW_MAX_CHARS)
    expect(fed.length).toBeLessThanOrEqual(PREVIEW_MAX_CHARS)
    expect(t1 - t0).toBeLessThan(200)
    expect(t2 - t1).toBeLessThan(1_000)
    // an escape-heavy 1 MiB that never completes a sequence
    const escs = '\x1b['.repeat(512 * 1024)
    const t3 = performance.now()
    expect(outputPreview(escs).length).toBeLessThanOrEqual(PREVIEW_MAX_CHARS)
    expect(performance.now() - t3).toBeLessThan(200)
  })
})

describe('ordinary output stays the same (T0714)', () => {
  /* Windows ConPTY output (node-pty: pwsh, cmd), shaped after recordings; paths made up. */
  const conpty: string[] = [
    '\x1b[?9001h\x1b[?1004h\x1b[?25l\x1b[2J\x1b[m\x1b[H\x1b]0;pwsh\x07\x1b[?25hPS C:\\Users\\demo> \x1b[?25l\x1b[93mecho \x1b[37mhello    \x1b[1;23H\x1b[?25h\x1b[m\r\nhello\r\nPS C:\\Users\\demo> ',
    'PS C:\\Users\\demo>\x1b[1C\x1b[?25l\x1b[30;19H> \x1b[92mfor \x1b[37m(\x1b[92m$i\x1b[37m) {}\x1b[?25h\x1b[m\r\nline 0\r\nline 1\r\n',
    '\x1b[93m\bec\x1b[97m\x1b[2m\x1b[3mho hello\x1b[1;23H\x1b[?25h\x1b[m\x1b[?25l\x1b[93m\x1b[1;19Hech\x1b[97m\x1b[2m\x1b[3mo hello\x1b[1;24H\x1b[?25h',
    'd----        2026/10/28 12:40\x1b[16X\x1b[44m\x1b[1m\x1b[16C.tmp\x1b[m\r\nd----        2026/10/27 04:46\x1b[16X\x1b[44m\x1b[1m\x1b[16CC0FFEE\r\x1b[?25h\x1b[m\nd----        2026/10/28 03:45\x1b[44m\x1b[1m\x1b[16Cx.zip\x1b[m\x1b[K\r\n',
  ]

  test.each(conpty.map((s, i) => [i, s]))('ConPTY sample %i: same as before T0714', (_i, sample) => {
    expect(outputPreview(sample as string)).toBe(t0667OutputPreview(sample as string))
  })

  test('ConPTY samples chunked over flushes: same as before T0714', () => {
    const chunks = conpty.flatMap(s => s.match(/[\s\S]{1,7}/g)!)
    expect(feed(chunks, 1)).toBe(feed(chunks, 1, undefined, t0667OutputPreview))
    expect(feed(chunks, 5)).toBe(feed(chunks, 5, undefined, t0667OutputPreview))
  })

  test('ConPTY skipping a blank row with `CSI row;1 H`: separate lines now (glued before)', () => {
    const raw = 'Microsoft Windows\r\n(c) Microsoft Corporation.\x1b[4;1HC:\\Users\\demo>'
    expect(t0667OutputPreview(raw)).toBe('Microsoft Windows\n(c) Microsoft Corporation.C:\\Users\\demo>')
    expect(outputPreview(raw)).toBe('Microsoft Windows\n(c) Microsoft Corporation.\nC:\\Users\\demo>')
  })
})
