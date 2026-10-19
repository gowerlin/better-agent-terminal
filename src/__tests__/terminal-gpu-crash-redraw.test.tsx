/**
 * T0669 / BUG-164: after a GPU process crash (main sends `system:gpu-process-gone` with the
 * session's crash count) the visible terminal redraws once — clearTextureAtlas() + refresh(0,
 * rows - 1) — when its canvases are usable again. Hidden terminals do nothing (the isActive
 * effect redraws them on activation, unchanged).
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { resetPtyReplayRegistry } from '../lib/pty-replay'

interface FakeTerminal {
  clearTextureAtlas: ReturnType<typeof vi.fn>
  refresh: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
}

const { deepStub, terminals } = vi.hoisted(() => {
  const deepStub = (): unknown => new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') return undefined
      if (prop === Symbol.toPrimitive) return () => 0
      return deepStub()
    },
    apply: () => deepStub(),
    construct: () => deepStub() as object,
  })
  return { deepStub, terminals: [] as FakeTerminal[] }
})

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    constructor() {
      const stub = deepStub() as Record<string | symbol, unknown>
      const fake: FakeTerminal = { clearTextureAtlas: vi.fn(), refresh: vi.fn(), focus: vi.fn() }
      terminals.push(fake)
      return new Proxy({}, {
        get(_target, prop) {
          if (prop === 'cols') return 80
          if (prop === 'rows') return 24
          if (prop in fake) return fake[prop as keyof FakeTerminal]
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

const gpuListeners = new Set<(info: { crash: number }) => void>()
const debugLog = vi.fn((..._args: unknown[]) => undefined)
const gpuCrash = (crash: number) => act(() => { for (const listener of [...gpuListeners]) listener({ crash }) })
const redrawLogs = () => debugLog.mock.calls.map(c => String(c[0])).filter(line => line.startsWith('[gpu] terminal redraw after'))
const pause = (ms: number) => act(() => new Promise<void>(r => setTimeout(r, ms)))

let visibility: DocumentVisibilityState = 'visible'
let contextLost = false

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return [] } })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  HTMLCanvasElement.prototype.getContext = (() => ({ isContextLost: () => contextLost })) as unknown as typeof HTMLCanvasElement.prototype.getContext
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  terminals.length = 0
  gpuListeners.clear()
  debugLog.mockClear()
  visibility = 'visible'
  contextLost = false
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    pty: { getBuffer: vi.fn(async () => null) },
    debug: { log: debugLog, isDebugMode: false },
    system: {
      onGpuProcessGone: vi.fn((cb: (info: { crash: number }) => void) => {
        gpuListeners.add(cb)
        return () => gpuListeners.delete(cb)
      }),
    },
  })
})

afterEach(() => {
  cleanup()
  resetPtyReplayRegistry()
})

/** Mounts one active and one hidden view; returns their fake terminals after the isActive effect ran. */
async function mountPair() {
  const { TerminalPanel } = await import('../components/TerminalPanel')
  const view = render(
    <>
      <TerminalPanel terminalId="visible-tab" isActive={true} />
      <TerminalPanel terminalId="hidden-tab" isActive={false} />
    </>,
  )
  await waitFor(() => expect(terminals).toHaveLength(2))
  const [visible, hidden] = terminals
  // the isActive effect's own redraw on mount (Win11 fix) — not part of the GPU path
  await waitFor(() => expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(1))
  for (const t of terminals) { t.clearTextureAtlas.mockClear(); t.refresh.mockClear() }
  return { view, visible, hidden }
}

describe('T0669: redraw after a GPU process crash', () => {
  test('only the visible terminal redraws (clearTextureAtlas + refresh(0, rows - 1)); the hidden one does nothing', async () => {
    const { visible, hidden } = await mountPair()
    await gpuCrash(1)
    expect(visible.clearTextureAtlas).not.toHaveBeenCalled() // waits for the canvases first
    await waitFor(() => expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(1))
    expect(visible.refresh).toHaveBeenCalledWith(0, 23)
    await pause(400)
    expect(hidden.clearTextureAtlas).not.toHaveBeenCalled()
    expect(hidden.refresh).not.toHaveBeenCalled()
    expect(redrawLogs()).toEqual(['[gpu] terminal redraw after GPU crash terminal=visible-tab crash=#1 trigger=settled'])
  })

  test('the same crash number (or an older one) redraws only once', async () => {
    const { visible } = await mountPair()
    await gpuCrash(1)
    await waitFor(() => expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(1))
    await gpuCrash(1)
    await gpuCrash(1)
    await pause(1_400)
    expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(1)
    expect(visible.refresh).toHaveBeenCalledTimes(1)
  })

  test('crashes arriving while a redraw waits share it (one redraw, newest number)', async () => {
    const { visible } = await mountPair()
    await gpuCrash(1)
    await gpuCrash(2)
    await waitFor(() => expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(1))
    await pause(1_400)
    expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(1)
    expect(redrawLogs()).toEqual(['[gpu] terminal redraw after GPU crash terminal=visible-tab crash=#2 trigger=settled'])
  })

  test('back-to-back crashes are throttled: a second redraw waits ≥ 1 s after the first', async () => {
    const { visible } = await mountPair()
    await gpuCrash(1)
    await waitFor(() => expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(1))
    const firstAt = Date.now()
    await gpuCrash(2)
    await pause(600)
    expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(2), { timeout: 2_000 })
    expect(Date.now() - firstAt).toBeGreaterThanOrEqual(950)
    expect(redrawLogs()[1]).toBe('[gpu] terminal redraw after GPU crash terminal=visible-tab crash=#2 trigger=settled')
  })

  test('a layer canvas still reports a lost context → waits for its contextrestored', async () => {
    const { view, visible } = await mountPair()
    const panel = view.container.querySelector('.terminal-panel')!
    const screen = document.createElement('div')
    screen.className = 'xterm-screen'
    const canvas = document.createElement('canvas')
    screen.appendChild(canvas)
    panel.appendChild(screen)
    contextLost = true
    await gpuCrash(1)
    await pause(700)
    expect(visible.clearTextureAtlas).not.toHaveBeenCalled()
    contextLost = false
    await act(() => { canvas.dispatchEvent(new Event('contextrestored')) })
    await waitFor(() => expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(1))
    expect(redrawLogs()).toEqual(['[gpu] terminal redraw after GPU crash terminal=visible-tab crash=#1 trigger=contextrestored'])
  })

  test('window hidden (minimized) → no redraw until it shows again', async () => {
    const { visible } = await mountPair()
    visibility = 'hidden'
    await gpuCrash(1)
    await pause(600)
    expect(visible.clearTextureAtlas).not.toHaveBeenCalled()
    visibility = 'visible'
    await act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(visible.clearTextureAtlas).toHaveBeenCalledTimes(1))
    expect(visible.refresh).toHaveBeenCalledWith(0, 23)
  })

  test('the hidden terminal is redrawn by the isActive effect on activation, as before (no GPU log line)', async () => {
    const { TerminalPanel } = await import('../components/TerminalPanel')
    const view = render(<TerminalPanel terminalId="later-tab" isActive={false} />)
    await waitFor(() => expect(terminals).toHaveLength(1))
    const [term] = terminals
    await gpuCrash(1)
    await pause(400)
    expect(term.clearTextureAtlas).not.toHaveBeenCalled()
    view.rerender(<TerminalPanel terminalId="later-tab" isActive={true} />)
    await waitFor(() => expect(term.clearTextureAtlas).toHaveBeenCalledTimes(1))
    expect(term.refresh).toHaveBeenCalledWith(0, 23)
    await pause(400)
    expect(term.clearTextureAtlas).toHaveBeenCalledTimes(1)
    expect(redrawLogs()).toEqual([])
  })

  test('unmount while waiting → nothing runs, listener removed', async () => {
    const { view, visible } = await mountPair()
    await gpuCrash(1)
    view.unmount()
    expect(gpuListeners.size).toBe(0)
    await pause(400)
    expect(visible.clearTextureAtlas).not.toHaveBeenCalled()
  })
})

describe('T0669: the isActive effect is unchanged (source guard)', () => {
  test('its body and dependencies are the pre-T0669 ones', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../components/TerminalPanel.tsx'), 'utf-8').replace(/\r\n/g, '\n')
    const start = source.indexOf('  // Handle terminal resize and focus when becoming active\n')
    const end = source.indexOf('  }, [isActive, terminalReady, terminalId])\n', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(source.slice(start, end)).toBe(`  // Handle terminal resize and focus when becoming active
  useEffect(() => {
    if (isActive && terminalReady && terminalRef.current) {
      const terminal = terminalRef.current

      // Single RAF — resize + focus; nested RAF handles clearTextureAtlas (Win11 text overlap fix)
      const rafId = requestAnimationFrame(() => {
        if (!terminal) return

        dlog(\`[resize] isActive effect → doResize terminal=\${terminalId}\`)
        doResizeRef.current?.()
        terminal.focus()

        // Force refresh terminal content to fix black screen / text overlap after visibility change (Win11 fix)
        requestAnimationFrame(() => {
          terminal.clearTextureAtlas()
          terminal.refresh(0, terminal.rows - 1)
          terminal.focus()
        })
      })

      return () => cancelAnimationFrame(rafId)
    }
`)
  })
})
