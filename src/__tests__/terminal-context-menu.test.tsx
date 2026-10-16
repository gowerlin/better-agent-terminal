/**
 * T0568 / BUG-142: a right-click in a terminal tab opens BAT's Copy / Paste menu only while the
 * program does not track the mouse (the claude CLI's TUI tracks it and pastes on right-click
 * itself). Shift + right-click opens the menu anyway. e2e: e2e/t0568-context-menu-mouse-tracking.spec.ts.
 *
 * T0569 / BUG-143: Escape with the menu open and focus in the terminal closes the menu and is not
 * sent to the PTY; with the menu closed Escape reaches the PTY as before.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { isMouseTrackingOn, shouldCloseTerminalContextMenuOnKey, shouldShowTerminalContextMenu } from '../lib/terminal-context-menu'

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
