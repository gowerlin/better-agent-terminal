/**
 * BUG-165 / T0698: TerminalPanel's wheel handler. In a codex tab on the alternate screen with SGR
 * wheel tracking it sends one report per line (through `terminal.input`, so onData → PTY like
 * xterm's own report) and returns false; in every other case it returns true and sends nothing,
 * so xterm handles the event as before. The encoding itself: src/lib/__tests__/terminal-wheel-reports.test.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { workspaceStore } from '../stores/workspace-store'

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
      created: 0,
      wheelHandler: null as ((event: WheelEvent) => boolean) | null,
      onData: null as ((data: string) => void) | null,
      inputs: [] as Array<[string, boolean | undefined]>,
      bufferType: 'alternate',
      mouseTrackingMode: 'any',
      encoding: 'SGR' as string | undefined,
      element: null as HTMLElement | null,
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
          if (prop === 'attachCustomWheelEventHandler') return (fn: (event: WheelEvent) => boolean) => { xterm.wheelHandler = fn }
          if (prop === 'onData') return (fn: (data: string) => void) => { xterm.onData = fn; return { dispose() {} } }
          // xterm 5.5.0 `input(data, wasUserInput)` → `triggerDataEvent` → onData
          if (prop === 'input') return (data: string, wasUserInput?: boolean) => { xterm.inputs.push([data, wasUserInput]); xterm.onData?.(data) }
          if (prop === 'modes') return { get mouseTrackingMode() { return xterm.mouseTrackingMode } }
          if (prop === '_core') return { coreMouseService: { get activeEncoding() { return xterm.encoding } } }
          if (prop === 'buffer') return { get active() { return { type: xterm.bufferType } }, onBufferChange: () => ({ dispose() {} }) }
          if (prop === 'element') return xterm.element
          if (prop === 'cols') return 80
          if (prop === 'rows') return 24
          if (prop === 'options') return { scrollSensitivity: 1, fastScrollSensitivity: 5, fastScrollModifier: 'alt' }
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
  const namespaces: Record<string, unknown> = { platform: 'darwin' }
  return new Proxy(namespaces, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!(prop in target)) target[prop] = namespace(prop)
      return target[prop]
    },
  })
}

const ptyWrite = vi.fn(async (..._args: unknown[]) => undefined)
const debugLog = vi.fn()
let agentPreset: string | undefined = 'codex-cli'

async function renderTerminal(id: string) {
  vi.spyOn(workspaceStore, 'getState').mockImplementation(() => ({
    workspaces: [], activeWorkspaceId: null, activeTerminalId: id, focusedTerminalId: id,
    terminals: [{ id, workspaceId: 'w', type: 'terminal', title: 't', cwd: '/', agentPreset, scrollbackBuffer: [] }],
  }) as unknown as ReturnType<typeof workspaceStore.getState>)
  const { TerminalPanel } = await import('../components/TerminalPanel')
  const before = xterm.created
  render(<TerminalPanel terminalId={id} isActive={true} />)
  await waitFor(() => expect(xterm.created).toBeGreaterThan(before))
  await waitFor(() => expect(xterm.wheelHandler).not.toBeNull())
}

/** A wheel event over cell (5, 3) of the 9 x 17 px grid at (10, 20). */
const wheel = (init: WheelEventInit = {}) => new WheelEvent('wheel', {
  deltaY: 51, deltaMode: 0, clientX: 10 + 9 * 4 + 1, clientY: 20 + 17 * 2 + 1, bubbles: true, cancelable: true, ...init,
})

const reportWrites = () => ptyWrite.mock.calls.filter(c => typeof c[1] === 'string' && (c[1] as string).startsWith('\x1b[<'))

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return [] } })
})

beforeEach(() => {
  xterm.wheelHandler = null
  xterm.onData = null
  xterm.inputs = []
  xterm.bufferType = 'alternate'
  xterm.mouseTrackingMode = 'any'
  xterm.encoding = 'SGR'
  agentPreset = 'codex-cli'
  xterm.element = document.createElement('div')
  const screen = xterm.element.appendChild(document.createElement('div'))
  screen.className = 'xterm-screen'
  screen.getBoundingClientRect = () => ({ left: 10, top: 20, width: 720, height: 408, right: 730, bottom: 428, x: 10, y: 20, toJSON() {} }) as DOMRect
  ptyWrite.mockClear()
  debugLog.mockClear()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    pty: {
      create: vi.fn(async () => ({ ok: true, created: true })),
      getBuffer: vi.fn(async () => null),
      write: ptyWrite,
    },
    debug: { log: debugLog, isDebugMode: false },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TerminalPanel wheel handler (T0698)', () => {
  test('codex tab, alternate screen, tracking, SGR: one report per line through onData to the PTY; xterm stopped', async () => {
    await renderTerminal('t0698-codex')
    expect(xterm.wheelHandler!(wheel())).toBe(false)
    expect(xterm.inputs).toEqual(Array(3).fill(['\x1b[<65;5;3M', true]))
    expect(reportWrites().map(c => c[1])).toEqual(Array(3).fill('\x1b[<65;5;3M'))
    expect(reportWrites().every(c => c[0] === 't0698-codex')).toBe(true)
    expect(debugLog.mock.calls.some(c => String(c[0]).startsWith('[wheel-reports] on terminal=t0698-codex'))).toBe(true)

    // up, under 1 line: nothing sent yet, still not xterm's
    expect(xterm.wheelHandler!(wheel({ deltaY: -10, clientX: 10, clientY: 20 }))).toBe(false)
    expect(xterm.inputs).toHaveLength(3)
    expect(xterm.wheelHandler!(wheel({ deltaY: -10, clientX: 10, clientY: 20, ctrlKey: true }))).toBe(false)
    expect(xterm.inputs.at(-1)).toEqual(['\x1b[<80;1;1M', true])

    // momentum burst: capped at 8
    xterm.inputs = []
    expect(xterm.wheelHandler!(wheel({ deltaY: 1000 }))).toBe(false)
    expect(xterm.inputs).toHaveLength(8)
  })

  test('drag / vt200 tracking count too', async () => {
    await renderTerminal('t0698-vt200')
    for (const mode of ['drag', 'vt200']) {
      xterm.mouseTrackingMode = mode
      xterm.inputs = []
      expect(xterm.wheelHandler!(wheel({ deltaY: 17 }))).toBe(false)
      expect(xterm.inputs).toHaveLength(1)
    }
  })

  const handedToXterm = async (id: string, change: () => void, event = wheel()) => {
    await renderTerminal(id)
    change()
    expect(xterm.wheelHandler!(event)).toBe(true)
    expect(xterm.inputs).toEqual([])
    expect(reportWrites()).toEqual([])
  }

  test('not a codex tab (claude CLI, a plain shell): xterm handles it', async () => {
    agentPreset = 'claude-cli'
    await handedToXterm('t0698-claude', () => {})
    cleanup()
    agentPreset = undefined
    await handedToXterm('t0698-shell', () => {})
  })

  test('normal buffer: xterm handles it', async () => {
    await handedToXterm('t0698-normal', () => { xterm.bufferType = 'normal' })
  })

  test('no tracking, or X10: xterm handles it', async () => {
    await handedToXterm('t0698-none', () => { xterm.mouseTrackingMode = 'none' })
    cleanup()
    await handedToXterm('t0698-x10', () => { xterm.mouseTrackingMode = 'x10' })
  })

  test('encoding other than SGR (or unreadable): xterm handles it', async () => {
    await handedToXterm('t0698-default', () => { xterm.encoding = 'DEFAULT' })
    cleanup()
    await handedToXterm('t0698-pixels', () => { xterm.encoding = 'SGR_PIXELS' })
    cleanup()
    await handedToXterm('t0698-unknown', () => { xterm.encoding = undefined })
  })

  test('Shift held or no vertical delta: xterm handles it', async () => {
    await handedToXterm('t0698-shift', () => {}, wheel({ shiftKey: true }))
    cleanup()
    await handedToXterm('t0698-horizontal', () => {}, wheel({ deltaY: 0, deltaX: 40 }))
  })

  test('no screen element yet: xterm handles it', async () => {
    await handedToXterm('t0698-noscreen', () => { xterm.element!.innerHTML = '' })
  })

  test('back to xterm when codex leaves the alternate screen, and the carried fraction is dropped', async () => {
    await renderTerminal('t0698-leave')
    expect(xterm.wheelHandler!(wheel({ deltaY: 15 }))).toBe(false) // 0.88 line carried
    xterm.bufferType = 'normal'
    expect(xterm.wheelHandler!(wheel({ deltaY: 15 }))).toBe(true)
    expect(debugLog.mock.calls.some(c => String(c[0]).startsWith('[wheel-reports] off terminal=t0698-leave'))).toBe(true)
    xterm.bufferType = 'alternate'
    expect(xterm.wheelHandler!(wheel({ deltaY: 15 }))).toBe(false)
    expect(xterm.inputs).toEqual([])
  })
})
