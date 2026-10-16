/**
 * T0568 / BUG-142: a right-click in a terminal tab opens BAT's Copy / Paste menu only while the
 * program does not track the mouse (the claude CLI's TUI tracks it and pastes on right-click
 * itself). Shift + right-click opens the menu anyway. e2e: e2e/t0568-context-menu-mouse-tracking.spec.ts.
 *
 * T0569 / BUG-143: Escape with the menu open and focus in the terminal closes the menu and is not
 * sent to the PTY; with the menu closed Escape reaches the PTY as before.
 *
 * T0571 / BUG-144: xterm clears its selection on every user input, mouse reports included, so with
 * any-event tracking (the claude CLI) a Shift + drag selection was gone by the Shift + right-click.
 * A selection dropped only for a mouse report is put back; Copy writes the text taken at the
 * right-click. e2e: e2e/t0571-shift-right-click-copy.spec.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import {
  isMouseTrackingOn,
  isSgrMouseReport,
  MouseReportSelectionKeeper,
  shouldCloseTerminalContextMenuOnKey,
  shouldShowTerminalContextMenu,
  type SelectionKeeperTerminal,
} from '../lib/terminal-context-menu'

const { deepStub, xterm } = vi.hoisted(() => {
  const deepStub = (): unknown => new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') return undefined
      if (prop === Symbol.toPrimitive) return () => 0
      return deepStub()
    },
    apply: () => deepStub(),
    construct: () => deepStub() as object,
  })
  return {
    deepStub,
    xterm: {
      mouseTrackingMode: 'none' as string,
      selection: '',
      created: 0,
      keyHandler: null as ((event: KeyboardEvent) => boolean) | null,
      onData: null as ((data: string) => void) | null,
      onSelectionChange: null as (() => void) | null,
      // the fake selection: `select()` gives `selection` back only for the range last set by `selectInTerminal`
      range: null as { start: { x: number; y: number }; end: { x: number; y: number } } | null,
      rangeText: '',
      selects: [] as Array<[number, number, number]>,
    },
  }
})

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    constructor() {
      xterm.created++
      const stub = deepStub() as Record<string | symbol, unknown>
      return new Proxy({}, {
        get(_target, prop) {
          if (prop === 'modes') return { get mouseTrackingMode() { return xterm.mouseTrackingMode } }
          if (prop === 'getSelection') return () => xterm.selection
          if (prop === 'attachCustomKeyEventHandler') return (fn: (event: KeyboardEvent) => boolean) => { xterm.keyHandler = fn }
          if (prop === 'onData') return (fn: (data: string) => void) => { xterm.onData = fn; return { dispose() {} } }
          if (prop === 'onSelectionChange') return (fn: () => void) => { xterm.onSelectionChange = fn; return { dispose() {} } }
          if (prop === 'cols') return 80
          if (prop === 'hasSelection') return () => xterm.selection !== ''
          if (prop === 'getSelectionPosition') return () => (xterm.selection ? xterm.range ?? undefined : undefined)
          if (prop === 'clearSelection') return () => { xterm.selection = ''; xterm.onSelectionChange?.() }
          if (prop === 'select') return (column: number, row: number, length: number) => {
            xterm.selects.push([column, row, length])
            const r = xterm.range
            const same = r && r.start.x === column && r.start.y === row && (r.end.y - r.start.y) * 80 + r.end.x - r.start.x === length
            xterm.selection = same ? xterm.rangeText : 'elsewhere'
            xterm.onSelectionChange?.()
          }
          return stub[prop]
        },
        set: () => true,
      })
    }
  },
}))
const stubClass = () => class { constructor() { return deepStub() as object } }
vi.mock('@xterm/addon-fit', () => ({ FitAddon: stubClass() }))
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: stubClass() }))
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: stubClass() }))
vi.mock('@xterm/addon-canvas', () => ({ CanvasAddon: stubClass() }))
vi.mock('../utils/terminal-decoration-manager', () => ({ TerminalDecorationManager: stubClass() }))

/** Every namespace / method resolves; `on*` subscriptions return an unsubscribe. */
function permissiveApi(overrides: Record<string, Record<string, unknown>>): unknown {
  const leaf = (name: string) => vi.fn((..._args: unknown[]) => (name.startsWith('on') ? () => {} : Promise.resolve(undefined)))
  const namespace = (ns: string) => {
    const cache: Record<string, unknown> = { ...(overrides[ns] ?? {}) }
    return new Proxy(cache, {
      get(target, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined
        if (!(prop in target)) target[prop] = leaf(prop)
        return target[prop]
      },
    })
  }
  const namespaces: Record<string, unknown> = { platform: 'win32' }
  return new Proxy(namespaces, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!(prop in target)) target[prop] = namespace(prop)
      return target[prop]
    },
  })
}

const debugLog = vi.fn()
const ptyWrite = vi.fn(async (..._args: unknown[]) => undefined)

/**
 * A keydown in xterm's textarea, the way xterm 5.5.0 `_keyDown` treats it: the custom key handler
 * runs first and `false` stops it; otherwise Escape is written to the PTY (`onData('\x1b')`) and
 * the event is cancelled (`preventDefault` + `stopPropagation`), so document never sees it.
 */
function pressInTerminal(init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  let result: boolean | undefined
  act(() => {
    result = xterm.keyHandler!(event)
    if (result !== false && event.key === 'Escape' && !event.isComposing) {
      xterm.onData!('\x1b')
      event.preventDefault()
      event.stopPropagation()
    }
  })
  return { event, result }
}

const escWrites = () => ptyWrite.mock.calls.filter(c => c[1] === '\x1b')

/** A Shift + drag selection made in xterm. */
function selectInTerminal(text: string, start = { x: 2, y: 4 }, end = { x: 12, y: 4 }) {
  act(() => {
    xterm.range = { start, end }
    xterm.rangeText = text
    xterm.selection = text
    xterm.onSelectionChange?.()
  })
}

/** xterm 5.5.0 sending user input: `onUserInput` clears the selection, then `onData` carries it. */
function terminalInput(data: string) {
  act(() => {
    if (xterm.selection) {
      xterm.selection = ''
      xterm.onSelectionChange?.()
    }
    xterm.onData!(data)
  })
}

const clickCopy = () => act(() => { (document.querySelector('.context-menu .context-menu-item') as HTMLButtonElement).click() })

const clipboardWrites = vi.fn(async (_text: string) => undefined)

async function renderTerminal(id: string) {
  const { TerminalPanel } = await import('../components/TerminalPanel')
  const before = xterm.created
  const view = render(<TerminalPanel terminalId={id} isActive={true} />)
  await waitFor(() => expect(xterm.created).toBeGreaterThan(before))
  const panel = view.container.querySelector('.terminal-panel')!
  const rightClick = (init: MouseEventInit = {}) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5, ...init })
    act(() => { panel.dispatchEvent(event) })
    return event
  }
  return { ...view, rightClick }
}

const menuItems = () => Array.from(document.querySelectorAll('.context-menu .context-menu-item')).map(b => b.textContent)

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return [] } })
})

beforeEach(() => {
  xterm.mouseTrackingMode = 'none'
  xterm.selection = ''
  xterm.keyHandler = null
  xterm.onData = null
  xterm.onSelectionChange = null
  xterm.range = null
  xterm.rangeText = ''
  xterm.selects = []
  clipboardWrites.mockClear()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboardWrites, readText: async () => '' } })
  debugLog.mockClear()
  ptyWrite.mockClear()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    pty: { create: vi.fn(async () => ({ ok: true, created: true })), getBuffer: vi.fn(async () => null), write: ptyWrite },
    debug: { log: debugLog, isDebugMode: false },
  })
})

afterEach(() => {
  cleanup()
})

describe('shouldShowTerminalContextMenu', () => {
  test('xterm tracking modes count as on; none / unknown values count as off', () => {
    for (const mode of ['x10', 'vt200', 'drag', 'any']) expect(isMouseTrackingOn(mode)).toBe(true)
    for (const mode of ['none', '', 'VT200', undefined, null, 0, {}]) expect(isMouseTrackingOn(mode)).toBe(false)
  })

  test('menu shows when tracking is off, not when on, and always with Shift', () => {
    expect(shouldShowTerminalContextMenu('none', false)).toBe(true)
    expect(shouldShowTerminalContextMenu('none', true)).toBe(true)
    for (const mode of ['x10', 'vt200', 'drag', 'any']) {
      expect(shouldShowTerminalContextMenu(mode, false)).toBe(false)
      expect(shouldShowTerminalContextMenu(mode, true)).toBe(true)
    }
  })
})

describe('TerminalPanel right-click (T0568)', () => {
  test('mouse tracking off (a plain shell): the menu opens, with Copy when text is selected', async () => {
    const { rightClick } = await renderTerminal('t0568-shell')
    const event = rightClick()
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => expect(menuItems()).toEqual(['貼上']))

    act(() => { document.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await waitFor(() => expect(menuItems()).toEqual([]))
    xterm.selection = 'picked'
    rightClick()
    await waitFor(() => expect(menuItems()).toEqual(['複製', '貼上']))
  })

  test.each(['x10', 'vt200', 'drag', 'any'])('mouse tracking %s: no menu, the native one is still suppressed', async (mode) => {
    xterm.mouseTrackingMode = mode
    const { rightClick } = await renderTerminal(`t0568-tracking-${mode}`)
    const event = rightClick()
    expect(event.defaultPrevented).toBe(true)
    await new Promise(r => setTimeout(r, 20))
    expect(menuItems()).toEqual([])
    expect(debugLog).toHaveBeenCalledWith(expect.stringContaining(`[terminal-context-menu] terminal=t0568-tracking-${mode} not shown: the program tracks the mouse (${mode})`))
  })

  test('mouse tracking on + Shift: the menu opens (Copy for a Shift-drag selection)', async () => {
    xterm.mouseTrackingMode = 'any'
    xterm.selection = 'shift-dragged'
    const { rightClick } = await renderTerminal('t0568-shift')
    rightClick({ shiftKey: true })
    await waitFor(() => expect(menuItems()).toEqual(['複製', '貼上']))
  })

  test('the mode is read at the click: turning tracking off later brings the menu back', async () => {
    xterm.mouseTrackingMode = 'vt200'
    const { rightClick } = await renderTerminal('t0568-toggle')
    rightClick()
    await new Promise(r => setTimeout(r, 20))
    expect(menuItems()).toEqual([])
    xterm.mouseTrackingMode = 'none'
    rightClick()
    await waitFor(() => expect(menuItems()).toEqual(['貼上']))
  })
})

describe('shouldCloseTerminalContextMenuOnKey (T0569)', () => {
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) => ({ key: k, isComposing: false, keyCode: k === 'Escape' ? 27 : 0, ...extra })

  test('Escape closes the open menu', () => {
    expect(shouldCloseTerminalContextMenuOnKey(key('Escape'), true, false)).toBe(true)
  })

  test('menu closed, other keys, or an IME composing: no', () => {
    expect(shouldCloseTerminalContextMenuOnKey(key('Escape'), false, false)).toBe(false)
    for (const k of ['a', 'Enter', 'Esc', 'Tab']) expect(shouldCloseTerminalContextMenuOnKey(key(k), true, false)).toBe(false)
    expect(shouldCloseTerminalContextMenuOnKey(key('Escape'), true, true)).toBe(false)
    expect(shouldCloseTerminalContextMenuOnKey(key('Escape', { isComposing: true }), true, false)).toBe(false)
    expect(shouldCloseTerminalContextMenuOnKey(key('Escape', { keyCode: 229 }), true, false)).toBe(false)
  })
})

describe('TerminalPanel Escape with the right-click menu (T0569 / BUG-143)', () => {
  test('menu closed: Escape goes to the PTY as before', async () => {
    await renderTerminal('t0569-closed')
    await waitFor(() => expect(xterm.keyHandler).not.toBeNull())
    const { result } = pressInTerminal({ key: 'Escape', keyCode: 27 })
    expect(result).toBe(true)
    expect(escWrites()).toEqual([['t0569-closed', '\x1b']])
  })

  test('menu open + focus in the terminal: Escape closes the menu and is not written to the PTY', async () => {
    const { rightClick } = await renderTerminal('t0569-open')
    await waitFor(() => expect(xterm.keyHandler).not.toBeNull())
    rightClick()
    await waitFor(() => expect(menuItems()).toEqual(['貼上']))

    const { event, result } = pressInTerminal({ key: 'Escape', keyCode: 27 })
    expect(result).toBe(false)
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => expect(menuItems()).toEqual([]))
    expect(escWrites()).toEqual([])
    expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('[terminal-context-menu] terminal=t0569-open closed by Escape'))

    // The next Escape, with the menu gone, reaches the program again.
    pressInTerminal({ key: 'Escape', keyCode: 27 })
    expect(escWrites()).toEqual([['t0569-open', '\x1b']])
  })

  test('menu open via Shift + right-click while tracking (T0568): Escape closes it too', async () => {
    xterm.mouseTrackingMode = 'any'
    const { rightClick } = await renderTerminal('t0569-shift')
    await waitFor(() => expect(xterm.keyHandler).not.toBeNull())
    rightClick({ shiftKey: true })
    await waitFor(() => expect(menuItems()).toEqual(['貼上']))
    expect(pressInTerminal({ key: 'Escape', keyCode: 27 }).result).toBe(false)
    await waitFor(() => expect(menuItems()).toEqual([]))
    expect(escWrites()).toEqual([])
  })

  test('menu open: an IME composing keeps the menu and leaves Escape to xterm', async () => {
    const { rightClick } = await renderTerminal('t0569-ime')
    await waitFor(() => expect(xterm.keyHandler).not.toBeNull())
    rightClick()
    await waitFor(() => expect(menuItems()).toEqual(['貼上']))
    expect(pressInTerminal({ key: 'Escape', keyCode: 229, isComposing: true }).result).toBe(true)
    await new Promise(r => setTimeout(r, 20))
    expect(menuItems()).toEqual(['貼上'])
  })

  test('menu open: other keys are not taken by the menu', async () => {
    const { rightClick } = await renderTerminal('t0569-other')
    await waitFor(() => expect(xterm.keyHandler).not.toBeNull())
    rightClick()
    await waitFor(() => expect(menuItems()).toEqual(['貼上']))
    expect(pressInTerminal({ key: 'a', keyCode: 65 }).result).toBe(true)
    await new Promise(r => setTimeout(r, 20))
    expect(menuItems()).toEqual(['貼上'])
  })

  test('focus outside the terminal: Escape on document still closes the menu (BUG-011a)', async () => {
    const { rightClick } = await renderTerminal('t0569-document')
    rightClick()
    await waitFor(() => expect(menuItems()).toEqual(['貼上']))
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await waitFor(() => expect(menuItems()).toEqual([]))
    expect(escWrites()).toEqual([])
  })
})

describe('MouseReportSelectionKeeper (T0571 / BUG-144)', () => {
  type Range = { start: { x: number; y: number }; end: { x: number; y: number } }

  /** xterm's selection model, enough for the keeper: `select` yields the text only for the original range. */
  function fakeTerminal(cols = 80) {
    const state = { text: '', range: undefined as Range | undefined, original: '', originalRange: '', columnMode: false }
    const listeners: Array<() => void> = []
    const fire = () => listeners.forEach(fn => fn())
    const term: SelectionKeeperTerminal = {
      cols,
      hasSelection: () => state.text !== '',
      getSelection: () => state.text,
      getSelectionPosition: () => (state.text ? state.range : undefined),
      select: vi.fn((x: number, y: number, length: number) => {
        state.range = { start: { x, y }, end: { x: (x + length) % cols, y: y + Math.floor((x + length) / cols) } }
        // a NORMAL-mode range over a column selection's corners reads differently
        state.text = !state.columnMode && JSON.stringify(state.range) === state.originalRange ? state.original : 'other text'
        fire()
      }),
      clearSelection: vi.fn(() => { state.text = ''; fire() }),
    }
    const setSel = (text: string, start: Range['start'], end: Range['end']) => {
      state.text = text
      state.range = { start, end }
      state.original = text
      state.originalRange = JSON.stringify(state.range)
      fire()
    }
    const clear = () => { state.text = ''; fire() }
    const tasks: Array<() => void> = []
    const keeper = new MouseReportSelectionKeeper(term, fn => tasks.push(fn))
    listeners.push(() => keeper.handleSelectionChange())
    const flush = () => tasks.splice(0).forEach(fn => fn())
    return { term, state, keeper, setSel, clear, flush }
  }

  test('SGR mouse reports are recognised; keys, focus reports and X10 reports are not', () => {
    for (const d of ['\x1b[<35;22;2M', '\x1b[<0;21;2m', '\x1b[<39;1;1M', '\x1b[<64;100;40M']) expect(isSgrMouseReport(d)).toBe(true)
    for (const d of ['a', '\r', '\x1b', '\x1b[I', '\x1b[O', '\x1b[M #!', '\x1b[<35;22;2Mx', '\x1b[<35;22M', '\x1b[A']) expect(isSgrMouseReport(d)).toBe(false)
  })

  test('a selection cleared for a mouse report comes back (same range, also across lines)', () => {
    const { term, keeper, setSel, clear } = fakeTerminal()
    setSel('two\nlines', { x: 70, y: 3 }, { x: 5, y: 4 })
    clear()
    keeper.handleData('\x1b[<35;22;2M')
    expect(term.select).toHaveBeenCalledWith(70, 3, 15)
    expect(term.getSelection()).toBe('two\nlines')
    // and again for the next report
    clear()
    keeper.handleData('\x1b[<39;23;2M')
    expect(term.select).toHaveBeenCalledTimes(2)
    expect(term.getSelection()).toBe('two\nlines')
  })

  test('cleared for anything but a mouse report: stays cleared', () => {
    const { term, keeper, setSel, clear, flush } = fakeTerminal()
    setSel('typed over', { x: 1, y: 1 }, { x: 11, y: 1 })
    clear()
    keeper.handleData('a')
    keeper.handleData('\x1b[<35;22;2M')
    expect(term.select).not.toHaveBeenCalled()

    // no input followed (buffer switch, trim, tracking turned on): a later report does not bring it back
    setSel('switched', { x: 1, y: 1 }, { x: 9, y: 1 })
    clear()
    flush()
    keeper.handleData('\x1b[<35;22;2M')
    expect(term.select).not.toHaveBeenCalled()
  })

  test('forget(): a click or wheel the program gets ends it', () => {
    const { term, keeper, setSel, clear } = fakeTerminal()
    setSel('clicked away', { x: 1, y: 1 }, { x: 13, y: 1 })
    keeper.forget()
    clear()
    keeper.handleData('\x1b[<0;5;5M')
    expect(term.select).not.toHaveBeenCalled()
  })

  test('the default scheduler calls queueMicrotask unbound (Chromium throws "Illegal invocation" otherwise)', async () => {
    const real = globalThis.queueMicrotask
    vi.stubGlobal('queueMicrotask', function (this: unknown, fn: () => void) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation')
      real(fn)
    })
    try {
      let text = 'kept'
      const term: SelectionKeeperTerminal = {
        cols: 80,
        hasSelection: () => text !== '',
        getSelection: () => text,
        getSelectionPosition: () => ({ start: { x: 1, y: 1 }, end: { x: 5, y: 1 } }),
        select: vi.fn(),
        clearSelection: vi.fn(),
      }
      const keeper = new MouseReportSelectionKeeper(term)
      keeper.handleSelectionChange()
      text = ''
      expect(() => keeper.handleSelectionChange()).not.toThrow()
      await Promise.resolve()
      keeper.handleData('\x1b[<35;22;2M')
      expect(term.select).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
      vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
      vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return [] } })
    }
  })

  test('a range that no longer gives the same text (column selection, resize) is not brought back', () => {
    const { term, state, keeper, setSel, clear } = fakeTerminal()
    setSel('col\nsel', { x: 4, y: 1 }, { x: 7, y: 2 })
    state.columnMode = true
    clear()
    keeper.handleData('\x1b[<35;9;9M')
    expect(term.select).toHaveBeenCalledTimes(1)
    expect(term.clearSelection).toHaveBeenCalledTimes(1)
    expect(term.getSelection()).toBe('')
    keeper.handleData('\x1b[<35;10;9M')
    expect(term.select).toHaveBeenCalledTimes(1)
  })
})

describe('TerminalPanel Shift + right-click Copy while tracking (T0571 / BUG-144)', () => {
  test('tracking on + Shift + a selection: Copy writes the selection to the clipboard', async () => {
    xterm.mouseTrackingMode = 'any'
    const { rightClick } = await renderTerminal('t0571-copy')
    selectInTerminal('shift-dragged')
    rightClick({ shiftKey: true })
    await waitFor(() => expect(menuItems()).toEqual(['複製', '貼上']))
    clickCopy()
    expect(clipboardWrites).toHaveBeenCalledWith('shift-dragged')
    await waitFor(() => expect(menuItems()).toEqual([]))
  })

  test('the pointer moving after the drag (DECSET 1003 move reports) no longer loses the selection', async () => {
    xterm.mouseTrackingMode = 'any'
    const { rightClick } = await renderTerminal('t0571-moved')
    selectInTerminal('alpha beta', { x: 10, y: 1 }, { x: 20, y: 1 })
    terminalInput('\x1b[<35;22;2M')
    terminalInput('\x1b[<39;23;2M')
    expect(xterm.selects).toEqual([[10, 1, 10], [10, 1, 10]])
    expect(xterm.selection).toBe('alpha beta')
    // the reports still went to the PTY unchanged
    expect(ptyWrite.mock.calls.map(c => c[1])).toEqual(['\x1b[<35;22;2M', '\x1b[<39;23;2M'])
    rightClick({ shiftKey: true })
    await waitFor(() => expect(menuItems()).toEqual(['複製', '貼上']))
    clickCopy()
    expect(clipboardWrites).toHaveBeenCalledWith('alpha beta')
  })

  test('typing after the selection, a click or the wheel the program gets: the selection stays cleared', async () => {
    xterm.mouseTrackingMode = 'any'
    const { rightClick, container } = await renderTerminal('t0571-cleared')
    selectInTerminal('typed over')
    terminalInput('x')
    terminalInput('\x1b[<35;22;2M')
    expect(xterm.selects).toEqual([])
    rightClick({ shiftKey: true })
    await waitFor(() => expect(menuItems()).toEqual(['貼上']))
    act(() => { document.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await waitFor(() => expect(menuItems()).toEqual([]))

    const panel = container.querySelector('.terminal-panel')!
    selectInTerminal('clicked away')
    act(() => { panel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })) })
    terminalInput('\x1b[<0;5;5M')
    expect(xterm.selects).toEqual([])

    selectInTerminal('right-clicked to the program')
    act(() => { panel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 })) })
    terminalInput('\x1b[<2;5;5M')
    expect(xterm.selects).toEqual([])

    // the Shift + right press keeps it (that is the click that opens the menu)
    selectInTerminal('kept')
    act(() => { panel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2, shiftKey: true })) })
    terminalInput('\x1b[<39;6;5M')
    expect(xterm.selection).toBe('kept')

    act(() => { panel.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 1 })) })
    terminalInput('\x1b[<65;6;5M')
    expect(xterm.selection).toBe('')
  })

  test('Copy writes what was selected at the right-click, and nothing is carried to the next menu', async () => {
    xterm.mouseTrackingMode = 'any'
    const { rightClick } = await renderTerminal('t0571-snapshot')
    selectInTerminal('at the click')
    rightClick({ shiftKey: true })
    await waitFor(() => expect(menuItems()).toEqual(['複製', '貼上']))
    // xterm drops the selection while the menu is open (a key, a buffer switch): Copy still has the text
    act(() => { xterm.selection = ''; xterm.onSelectionChange?.() })
    clickCopy()
    expect(clipboardWrites).toHaveBeenCalledWith('at the click')
    await waitFor(() => expect(menuItems()).toEqual([]))

    rightClick({ shiftKey: true })
    await waitFor(() => expect(menuItems()).toEqual(['貼上']))
  })

  test('tracking on without Shift: still no menu, even with a selection (T0568)', async () => {
    xterm.mouseTrackingMode = 'any'
    const { rightClick } = await renderTerminal('t0571-no-shift')
    selectInTerminal('ignored')
    rightClick()
    await new Promise(r => setTimeout(r, 20))
    expect(menuItems()).toEqual([])
  })

  test('tracking off (a plain shell): Copy as before', async () => {
    const { rightClick } = await renderTerminal('t0571-shell')
    selectInTerminal('shell text')
    rightClick()
    await waitFor(() => expect(menuItems()).toEqual(['複製', '貼上']))
    clickCopy()
    expect(clipboardWrites).toHaveBeenCalledWith('shell text')
  })
})
