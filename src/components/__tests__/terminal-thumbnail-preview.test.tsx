/**
 * T0667 (BUG-136 hypothesis C): a thumbnail's `.thumbnail-preview` stays bounded when a tab prints
 * lots of output without `\n` (codex alt screen on Linux / macOS PTYs) or Claude streams text
 * without `\n`; ordinary shell output still shows its last 8 lines.
 */
import { act } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import { TerminalThumbnail, clearPreviewCache } from '../TerminalThumbnail'
import { PREVIEW_MAX_CHARS } from '../../lib/thumbnail-preview'
import type { TerminalInstance } from '../../types'

type OutputListener = (id: string, data: string) => void
type StreamListener = (sessionId: string, data: unknown) => void
let onOutput: OutputListener = () => {}
let onStream: StreamListener = () => {}

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  await i18n.changeLanguage('en')
  // TerminalThumbnail registers its listeners once per module, on the first mount
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    debug: { log: vi.fn() },
    pty: { onOutput: vi.fn((cb: OutputListener) => { onOutput = cb; return () => {} }) },
    claude: { onMessage: vi.fn(() => () => {}), onStream: vi.fn((cb: StreamListener) => { onStream = cb; return () => {} }) },
    agent: { getDefinition: vi.fn(async () => null) },
  }
})

afterEach(() => {
  vi.useRealTimers()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const term = (id: string, extra: Partial<TerminalInstance> = {}): TerminalInstance => ({
  id, workspaceId: 'ws', type: 'terminal', title: `Tab ${id}`, cwd: '/tmp/ws', scrollbackBuffer: [], ...extra,
})

function renderThumb(terminal: TerminalInstance, onClick = vi.fn()) {
  clearPreviewCache(terminal.id)
  render(<TerminalThumbnail terminal={terminal} isActive={false} onClick={onClick} />)
  return screen.getByText(terminal.title).closest('.thumbnail') as HTMLElement
}

const previewOf = (thumb: HTMLElement) => (thumb.querySelector('.thumbnail-preview') as HTMLElement).textContent ?? ''
const flush = () => act(() => { vi.advanceTimersByTime(150) })

/** One codex-like alt screen redraw: `CSI row;col H` + SGR + text, no `\n`. */
function altScreenFrame(seed: number): string {
  let s = ''
  for (let row = 1; row <= 40; row++) s += `\x1b[${row};1H\x1b[1;3${row % 8}m row ${row} frame ${seed}\x1b[0m\x1b[K`
  return s
}

describe('thumbnail preview stays bounded (T0667)', () => {
  test('~10 MB of PTY output without \\n: the preview is ≤ the limit and stops growing', () => {
    vi.useFakeTimers()
    const thumb = renderThumb(term('codex'))
    const lengths: number[] = []
    let fed = 0
    for (let batch = 0; fed < 10 * 1024 * 1024; batch++) {
      for (let i = 0; i < 32; i++) {
        const frame = altScreenFrame(batch * 32 + i)
        fed += frame.length
        onOutput('codex', frame)
      }
      flush()
      lengths.push(previewOf(thumb).length)
    }
    expect(Math.max(...lengths)).toBeLessThanOrEqual(PREVIEW_MAX_CHARS)
    expect(previewOf(thumb)).not.toContain('\x1b')
    // no growth: the last 8 rows of the latest frame (T0714)
    expect(previewOf(thumb).split('\n')).toEqual(Array.from({ length: 8 }, (_, i) =>
      expect.stringMatching(new RegExp(`^ row ${33 + i} frame \\d+$`))))
  })

  test('Claude streaming text without \\n: the preview is ≤ the limit', () => {
    const thumb = renderThumb(term('claude'))
    act(() => {
      for (let i = 0; i < 20000; i++) onStream('claude', { text: `token${i} ` })
    })
    expect(previewOf(thumb).length).toBeGreaterThan(0)
    expect(previewOf(thumb).length).toBeLessThanOrEqual(PREVIEW_MAX_CHARS)
  })
})

describe('BUG-175: a TUI that redraws with cursor moves (T0714)', () => {
  test('claude-like output without \\n: the preview follows the latest lines, no `>0q>4m`', () => {
    vi.useFakeTimers()
    const thumb = renderThumb(term('worker'))
    onOutput('worker', 'demo@mac ~/proj % claude\r\n\x1b[>0q\x1b[>4mClaude Code\x1b[13Gv2.1.306')
    flush()
    expect(previewOf(thumb)).toBe('demo@mac ~/proj % claude\nClaude Codev2.1.306')
    onOutput('worker', '\x1b[?1049h\x1b[2J\x1b[H')
    for (let i = 1; i <= 20; i++) {
      onOutput('worker', `\x1b[H\r\x1b[${3 + i}B⏺ Step ${i}\r\x1b[1B✻ Working… (${i}s)\x1b[30;1H\x1b[28;3H`)
      onOutput('worker', `\x1b[H\r\x1b[12C\x1b[24B${i % 10}\x1b[30;1H\x1b[28;3H`) // timer tick, in place
      flush()
      expect(previewOf(thumb).split('\n').slice(-2)).toEqual([`⏺ Step ${i}`, `✻ Working… (${i}s)`])
    }
    expect(previewOf(thumb)).not.toContain('>0q')
    expect(previewOf(thumb)).not.toContain('\x1b')
  })
})

describe('ordinary output and the thumbnail itself are unchanged (T0667)', () => {
  test('shell output: the last 8 lines, ANSI removed', () => {
    vi.useFakeTimers()
    const thumb = renderThumb(term('shell'))
    for (let i = 0; i < 20; i++) onOutput('shell', `\x1b[32m$\x1b[0m echo ${i}\r\n${i}\r\n`)
    flush()
    const expected = Array.from({ length: 20 }, (_, i) => [`$ echo ${i}`, `${i}`]).flat().concat('').slice(-8)
    expect(previewOf(thumb)).toBe(expected.join('\n'))
  })

  test('no output yet: the `$ _` placeholder; clicking still calls onClick', () => {
    const onClick = vi.fn()
    const thumb = renderThumb(term('idle'), onClick)
    expect(previewOf(thumb)).toBe('$ _')
    fireEvent.click(thumb)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
