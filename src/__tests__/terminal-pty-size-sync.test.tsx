/**
 * T0572 / BUG-145: the view sends its fitted size again once a PTY was spawned for it.
 *
 * The tab enters the store and TerminalPanel sends its first `pty:resize` before `pty:create`
 * reaches the host (the shell lookup is awaited first); the host drops a resize for an id it does
 * not know yet, and the view's dedup never sent the same size again — the PTY kept its spawn size
 * (120x30). ⏻ restart spawned the new PTY at 120x30 while the dedup said the size was sent.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import i18n from '../i18n'
import { createPtyWithReplay, requestPtySizeSync, resetPtyReplayRegistry, restartOrCreatePty } from '../lib/pty-replay'
import { PTY_LIMIT_REACHED, type CreatePtyOptions, type PtyCreateResult } from '../types'

const { deepStub, size } = vi.hoisted(() => {
  const deepStub = (): unknown => new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') return undefined
      if (prop === Symbol.toPrimitive) return () => 0
      return deepStub()
    },
    apply: () => deepStub(),
    construct: () => deepStub() as object,
  })
  // xterm's size before / after FitAddon.fit() (the container's size in cells)
  return { deepStub, size: { cols: 80, rows: 24, fitCols: 137, fitRows: 35, created: 0 } }
})

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    constructor() {
      size.created++
      const stub = deepStub() as Record<string | symbol, unknown>
      return new Proxy({}, {
        get(_target, prop) {
          if (prop === 'cols') return size.cols
          if (prop === 'rows') return size.rows
          if (prop === 'resize') return (cols: number, rows: number) => { size.cols = cols; size.rows = rows }
          return stub[prop]
        },
        set: () => true,
      })
    }
  },
}))
const stubClass = () => class { constructor() { return deepStub() as object } }
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    activate() {}
    dispose() {}
    fit() { size.cols = size.fitCols; size.rows = size.fitRows }
  },
}))
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

const ID = 't0572-tab'
const OPTS: CreatePtyOptions = { id: ID, cwd: '/w', type: 'terminal', shell: '/bin/zsh' }
const ptyResize = vi.fn((..._args: unknown[]) => undefined)
const resizes = () => ptyResize.mock.calls.filter(c => c[0] === ID).map(c => `${c[1]}x${c[2]}`)

beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return [] } })
  await i18n.changeLanguage('en')
})

beforeEach(() => {
  size.cols = 80
  size.rows = 24
  size.fitCols = 137
  size.fitRows = 35
  ptyResize.mockClear()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = permissiveApi({
    pty: { resize: ptyResize, getBuffer: vi.fn(async () => null) },
    debug: { log: vi.fn(), isDebugMode: false },
  })
})

afterEach(() => {
  cleanup()
  resetPtyReplayRegistry()
})

/** Mounts an active view and waits for its first resize (the isActive effect / the 100 ms initial one). */
async function mountActive() {
  const { TerminalPanel } = await import('../components/TerminalPanel')
  const before = size.created
  const view = render(<TerminalPanel terminalId={ID} isActive={true} />)
  await waitFor(() => expect(size.created).toBeGreaterThan(before))
  await waitFor(() => expect(resizes()).toEqual(['137x35']))
  // the 100 ms initial resize runs too; the dedup keeps it from sending the same size again
  await new Promise(r => setTimeout(r, 150))
  expect(resizes()).toEqual(['137x35'])
  return view
}

describe('T0572: the fitted size reaches a newly spawned PTY', () => {
  test('pty:create answers created after the view already sent its size → the size is sent again (after create resolved)', async () => {
    await mountActive()
    let resolveCreate!: (v: PtyCreateResult) => void
    const create = vi.fn(() => new Promise<PtyCreateResult>(r => { resolveCreate = r }))
    const done = createPtyWithReplay(OPTS, { create })
    await Promise.resolve()
    // nothing until the host answers: before that the id may not exist there
    expect(resizes()).toEqual(['137x35'])
    await act(async () => { resolveCreate({ ok: true, created: true }); await done })
    expect(resizes()).toEqual(['137x35', '137x35'])
  })

  test('PTY already running (created: false, replay) or create failed → no extra resize', async () => {
    await mountActive()
    await act(async () => { await createPtyWithReplay(OPTS, { create: async () => ({ ok: true, created: false }) }) })
    await act(async () => { await createPtyWithReplay(OPTS, { create: async () => ({ ok: false, created: false }) }) })
    await act(async () => { await createPtyWithReplay(OPTS, { create: async () => ({ ok: false, created: false, code: PTY_LIMIT_REACHED, limit: 1 }) }) })
    expect(resizes()).toEqual(['137x35'])
  })

  test('⏻ restart (pty:restart true) → the unchanged size is sent to the new PTY', async () => {
    await mountActive()
    await act(async () => {
      expect(await restartOrCreatePty(OPTS, { restart: async () => true, create: async () => ({ ok: true, created: true }) }))
        .toEqual({ ok: true, via: 'restart', spawned: true })
    })
    expect(resizes()).toEqual(['137x35', '137x35'])
  })

  test('restart of a gone PTY (restart false → create) → sent once', async () => {
    await mountActive()
    await act(async () => {
      await restartOrCreatePty(OPTS, { restart: async () => false, create: async () => ({ ok: true, created: true }) })
    })
    expect(resizes()).toEqual(['137x35', '137x35'])
  })

  test('hidden view: nothing sent now (no fit of a hidden container); its next activation sends even the same size', async () => {
    const view = await mountActive()
    const { TerminalPanel } = await import('../components/TerminalPanel')
    view.rerender(<TerminalPanel terminalId={ID} isActive={false} />)
    act(() => requestPtySizeSync(ID))
    await new Promise(r => setTimeout(r, 50))
    expect(resizes()).toEqual(['137x35'])
    view.rerender(<TerminalPanel terminalId={ID} isActive={true} />)
    await waitFor(() => expect(resizes()).toEqual(['137x35', '137x35']))
  })

  test('a later fit to a new size still goes out once (dedup kept for ordinary resizes)', async () => {
    const view = await mountActive()
    const { TerminalPanel } = await import('../components/TerminalPanel')
    act(() => requestPtySizeSync(ID))
    expect(resizes()).toEqual(['137x35', '137x35'])
    // re-activation with the same size: deduped as before T0572
    view.rerender(<TerminalPanel terminalId={ID} isActive={false} />)
    view.rerender(<TerminalPanel terminalId={ID} isActive={true} />)
    await new Promise(r => setTimeout(r, 50))
    expect(resizes()).toEqual(['137x35', '137x35'])
    size.fitCols = 120
    window.dispatchEvent(new CustomEvent('terminal-redraw', { detail: { terminalId: ID } }))
    expect(resizes()).toEqual(['137x35', '137x35', '120x35'])
  })

  test('unmounted view: the request is dropped (its first resize after mount reaches the PTY)', async () => {
    const view = await mountActive()
    view.unmount()
    expect(() => requestPtySizeSync(ID)).not.toThrow()
    expect(resizes()).toEqual(['137x35'])
  })
})
