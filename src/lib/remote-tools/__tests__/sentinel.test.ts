/**
 * T0409: completion sentinel — wrap format, nonce validation, and the matcher across
 * chunk splits, ANSI noise, the echoed command line and wrong nonces.
 */
import { describe, expect, it } from 'vitest'
import { createSentinelMatcher, generateNonce, stripAnsi, wrapWithSentinel } from '../sentinel'

const NONCE = '0123456789abcdef'
const OTHER = 'fedcba9876543210'

/** What printf actually writes, as a PTY renders it (\n → \r\n). */
const output = (nonce: string, code: number) => `\r\n__BAT_TOOL_DONE_${nonce}_${code}__\r\n`

function feedAll(matcher: ReturnType<typeof createSentinelMatcher>, chunks: string[]): Array<number | null> {
  return chunks.map((c) => matcher.feed(c))
}

describe('wrapWithSentinel', () => {
  it('appends the printf sentinel with the nonce and $?', () => {
    expect(wrapWithSentinel('claude update', NONCE)).toBe(
      `claude update; printf '\\n__BAT_TOOL_DONE_%s_%s__\\n' '0123456789abcdef' "$?"`,
    )
  })

  it('rejects malformed nonces', () => {
    for (const bad of ['', '0123456789ABCDEF', '0123456789abcde', '0123456789abcdef0', "0123456789abcde'", '$(id)$(id)$(id)xx', '0123456789abcdeg']) {
      expect(() => wrapWithSentinel('true', bad)).toThrow(TypeError)
      expect(() => createSentinelMatcher(bad)).toThrow(TypeError)
    }
  })

  it('rejects multi-line, empty and separator-terminated commands', () => {
    expect(() => wrapWithSentinel('a\nb', NONCE)).toThrow(TypeError)
    expect(() => wrapWithSentinel('a\rb', NONCE)).toThrow(TypeError)
    expect(() => wrapWithSentinel('   ', NONCE)).toThrow(TypeError)
    expect(() => wrapWithSentinel('true;', NONCE)).toThrow(TypeError)
    expect(() => wrapWithSentinel('sleep 1 &', NONCE)).toThrow(TypeError)
    expect(wrapWithSentinel('  true  ', NONCE).startsWith('true; printf')).toBe(true)
  })
})

describe('generateNonce', () => {
  it('returns 16 lowercase hex chars, different each call', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const n = generateNonce()
      expect(n).toMatch(/^[0-9a-f]{16}$/)
      seen.add(n)
    }
    expect(seen.size).toBe(50)
    // Usable directly by wrap / matcher.
    const n = generateNonce()
    expect(() => wrapWithSentinel('true', n)).not.toThrow()
    expect(createSentinelMatcher(n).feed(output(n, 0))).toBe(0)
  })
})

describe('createSentinelMatcher', () => {
  it('detects exit code 0, non-zero and multi-digit codes', () => {
    for (const code of [0, 1, 2, 42, 127, 130, 255]) {
      const m = createSentinelMatcher(NONCE)
      expect(m.feed(`installing...\r\n${output(NONCE, code)}$ `)).toBe(code)
      expect(m.exitCode).toBe(code)
    }
  })

  it('does not match the echoed command line (printf format string)', () => {
    const typed = wrapWithSentinel('curl -fsSL https://claude.ai/install.sh | bash -s stable', NONCE)
    const m = createSentinelMatcher(NONCE)
    // Echo as a shell renders it, including readline-style redraw escapes.
    expect(m.feed(`\x1b[?2004h$ ${typed}\r\n\x1b[?2004l\r`)).toBeNull()
    expect(m.feed('Setting up Claude Code...\r\n')).toBeNull()
    expect(m.exitCode).toBeNull()
    expect(m.feed(output(NONCE, 0))).toBe(0)
  })

  it('ignores another nonce and partial / malformed markers', () => {
    const m = createSentinelMatcher(NONCE)
    expect(m.feed(output(OTHER, 0))).toBeNull()
    expect(m.feed(`__BAT_TOOL_DONE_${NONCE}___\r\n`)).toBeNull()
    expect(m.feed(`__BAT_TOOL_DONE_${NONCE}_x__\r\n`)).toBeNull()
    expect(m.feed(`__BAT_TOOL_DONE_${NONCE}_1000__\r\n`)).toBeNull()
    expect(m.feed(`__BAT_TOOL_DONE_${NONCE}_%s__\r\n`)).toBeNull()
    expect(m.exitCode).toBeNull()
  })

  it('reassembles a marker split across chunks at every position', () => {
    const full = `progress\r\n${output(NONCE, 127)}$ `
    for (let i = 1; i < full.length; i++) {
      const m = createSentinelMatcher(NONCE)
      const results = feedAll(m, [full.slice(0, i), full.slice(i)])
      expect(results.filter((r) => r !== null)).toEqual([127])
      expect(m.exitCode).toBe(127)
    }
  })

  it('handles one-character chunks', () => {
    const m = createSentinelMatcher(NONCE)
    const results = feedAll(m, Array.from(output(NONCE, 3)))
    expect(results.filter((r) => r !== null)).toEqual([3])
  })

  it('strips ANSI inside the marker, including escapes split across chunks', () => {
    const colored = `\r\n\x1b[32m__BAT_TOOL_\x1b[0mDONE_${NONCE.slice(0, 7)}\x1b]0;title\x07${NONCE.slice(7)}_\x1b[1m0\x1b[0m__\r\n`
    const m = createSentinelMatcher(NONCE)
    expect(m.feed(colored)).toBe(0)

    for (let i = 1; i < colored.length; i++) {
      const split = createSentinelMatcher(NONCE)
      const results = feedAll(split, [colored.slice(0, i), colored.slice(i)])
      expect(results.filter((r) => r !== null)).toEqual([0])
    }
  })

  it('finds the marker after a large amount of earlier output', () => {
    const m = createSentinelMatcher(NONCE)
    for (let i = 0; i < 200; i++) expect(m.feed(`line ${i} ${'x'.repeat(100)}\r\n`)).toBeNull()
    expect(m.feed(output(NONCE, 1))).toBe(1)
  })

  it('reports only once; later output is ignored', () => {
    const m = createSentinelMatcher(NONCE)
    expect(m.feed(output(NONCE, 0))).toBe(0)
    expect(m.feed(output(NONCE, 1))).toBeNull()
    expect(m.exitCode).toBe(0)
  })

  it('tolerates empty and non-string chunks', () => {
    const m = createSentinelMatcher(NONCE)
    expect(m.feed('')).toBeNull()
    expect(m.feed(undefined as unknown as string)).toBeNull()
    expect(m.feed(output(NONCE, 0))).toBe(0)
  })
})

describe('stripAnsi', () => {
  it('removes CSI, OSC, charset and two-byte escapes', () => {
    expect(stripAnsi('\x1b[1;32mok\x1b[0m \x1b]0;t\x07a\x1b]8;;u\x1b\\b \x1b(Bc \x1b=d \x9b2Ke')).toBe('ok ab c d e')
  })
})
