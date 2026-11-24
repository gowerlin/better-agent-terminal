/**
 * PLAN-068 W1 / T0904 (T0902 §2.4 B0, R3′): the Enter of a helper notification into a contract-2
 * Tower tab goes through `terminal.input('\r', false)` — measured against a real xterm 5.5.0 opened
 * in jsdom, next to the synthetic keydown every other tab keeps:
 *
 *   - same bytes on `onData` (`\r`, one event) as the keydown path
 *   - the viewport stays where the user scrolled it (the keydown path jumps to the bottom)
 *   - the selection stays (the keydown path clears it)
 *   - the focus stays where it was (the keydown path needs the xterm textarea focused)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { Terminal } from '@xterm/xterm'
import { submitEnterWithoutFocus, towerSubmitEnterPath } from '../tower-submit-enter'
import { dispatchSyntheticEnterKeydown } from '../../utils/terminal-keyboard-event'

beforeAll(() => {
  // jsdom has no matchMedia; xterm's DPR listener asks for it on open()
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }),
    })
  }
})

const opened: Terminal[] = []
afterEach(() => {
  for (const terminal of opened.splice(0)) terminal.dispose()
  document.body.innerHTML = ''
})

/** A real xterm opened in a jsdom container, 200 lines written, scrolled up 20 lines. */
async function scrolledUpTerminal(): Promise<{ terminal: Terminal; textarea: HTMLTextAreaElement; other: HTMLInputElement }> {
  const host = document.createElement('div')
  const other = document.createElement('input')
  document.body.append(host, other)
  const terminal = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
  opened.push(terminal)
  terminal.open(host)
  const lines = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\r\n')
  await new Promise<void>(resolve => terminal.write(lines, resolve))
  terminal.scrollLines(-20)
  const textarea = host.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement
  return { terminal, textarea, other }
}

function captureData(terminal: Terminal): string[] {
  const out: string[] = []
  terminal.onData(data => out.push(data))
  return out
}

describe('which tab takes which path (R3′)', () => {
  test('only a contract-2 Tower (`match`) gets the xterm input path', () => {
    expect(towerSubmitEnterPath('match')).toBe('xterm-input')
    for (const status of ['ct-outdated', 'bat-outdated', 'not-tower', null, undefined] as const) {
      expect(towerSubmitEnterPath(status)).toBe('dom-keydown')
    }
  })

  test('source guard (TerminalPanel.tsx): the keypress Enter asks the tab\'s contract; T0566 keeps the keydown', () => {
    const source = readFileSync(resolve(__dirname, '../../components/TerminalPanel.tsx'), 'utf-8')
    expect(source).toContain('const path = towerSubmitEnterPath(getTowerContract(terminalId)?.status)')
    expect(source).toContain("withoutFocus: path === 'xterm-input'")
    // the usage-limit continue (T0566): the keydown with the focus given back, never `withoutFocus`
    const usageLimit = source.match(/dispatchEnter\(\{ traceId: info\.traceId, source: 'usage-limit'[^\n]*/)?.[0] ?? ''
    expect(usageLimit).toContain('restoreFocus: true')
    expect(usageLimit).not.toContain('withoutFocus')
    // `submitEnterWithoutFocus` is reached only through `withoutFocus`
    expect(source.match(/submitEnterWithoutFocus\(/g)).toHaveLength(1)
  })
})

describe('B0 against a real xterm 5.5.0', () => {
  test('setup: the terminal is scrolled up', async () => {
    const { terminal } = await scrolledUpTerminal()
    expect(terminal.buffer.active.viewportY).toBeLessThan(terminal.buffer.active.baseY)
  })

  test('the same bytes as the keydown path: one `\\r`', async () => {
    const a = await scrolledUpTerminal()
    const viaInput = captureData(a.terminal)
    submitEnterWithoutFocus(a.terminal)
    const b = await scrolledUpTerminal()
    const viaKeydown = captureData(b.terminal)
    b.textarea.focus()
    dispatchSyntheticEnterKeydown(b.textarea)
    expect(viaKeydown).toEqual(['\r'])
    expect(viaInput).toEqual(viaKeydown)
  })

  test('the viewport stays where the user scrolled it (the keydown path jumps to the bottom)', async () => {
    const a = await scrolledUpTerminal()
    const before = a.terminal.buffer.active.viewportY
    submitEnterWithoutFocus(a.terminal)
    expect(a.terminal.buffer.active.viewportY).toBe(before)

    const b = await scrolledUpTerminal()
    b.textarea.focus()
    dispatchSyntheticEnterKeydown(b.textarea)
    expect(b.terminal.buffer.active.viewportY).toBe(b.terminal.buffer.active.baseY)
  })

  test('the selection stays (the keydown path clears it)', async () => {
    const a = await scrolledUpTerminal()
    a.terminal.select(0, a.terminal.buffer.active.viewportY, 10)
    expect(a.terminal.hasSelection()).toBe(true)
    const selected = a.terminal.getSelection()
    expect(selected).toMatch(/^line \d+/)
    submitEnterWithoutFocus(a.terminal)
    expect(a.terminal.hasSelection()).toBe(true)
    expect(a.terminal.getSelection()).toBe(selected)

    const b = await scrolledUpTerminal()
    b.terminal.select(0, b.terminal.buffer.active.viewportY, 10)
    b.textarea.focus()
    dispatchSyntheticEnterKeydown(b.textarea)
    expect(b.terminal.hasSelection()).toBe(false)
  })

  test('the focus does not move (it stays in another element)', async () => {
    const a = await scrolledUpTerminal()
    a.other.focus()
    expect(document.activeElement).toBe(a.other)
    const data = captureData(a.terminal)
    submitEnterWithoutFocus(a.terminal)
    expect(document.activeElement).toBe(a.other)
    expect(data).toEqual(['\r'])
  })
})
