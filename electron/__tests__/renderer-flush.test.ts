/**
 * T0504: a detached workspace window flushes its workspace state before it closes, so a
 * rename / new sdkSessionId (saved by the 30 s autosave only) reaches the parent's entry
 * before 'closed' → whenIdle() → 'workspace:reattached'. A flush that times out or fails
 * never keeps the window open. The quit path uses the same per-renderer flush.
 * main.ts wiring is guarded in detached-workspace-persistence.test.ts.
 * T0508: one flush per renderer at a time (a quit confirmed while a detached window flushes
 * joins that flush), the quit dialog no longer skips the close flush, and a detach of a
 * workspace whose window is still going away waits for it instead of focusing it.
 */
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const paths = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => paths.userData } }))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import {
  createRendererFlusher,
  DETACHED_CLOSE_FLUSH_TIMEOUT_MS,
  DetachedTeardowns,
  FLUSH_SAVE_CHANNEL,
  FLUSH_SAVE_DONE_CHANNEL,
  flushBeforeClose,
  QUIT_FLUSH_TIMEOUT_MS,
  requestRendererFlush,
  type FlushResult,
} from '../renderer-flush'
import { saveDetachedWorkspaceTerminals, WindowRegistry } from '../window-registry'

/** webContents stand-in: records sends, 'destroyed' like Electron's. */
class FakeWebContents extends EventEmitter {
  destroyed = false
  sent: string[] = []
  onSend: (channel: string) => void = () => {}
  isDestroyed() { return this.destroyed }
  send(channel: string) {
    if (this.destroyed) throw new Error('Object has been destroyed')
    this.sent.push(channel)
    this.onSend(channel)
  }
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.emit('destroyed')
  }
}

/** BrowserWindow stand-in: close() emits a preventable 'close', destroy() skips it and emits 'closed'. */
class FakeWindow extends EventEmitter {
  webContents = new FakeWebContents()
  destroyed = false
  isDestroyed() { return this.destroyed }
  close() {
    if (this.destroyed) return
    let prevented = false
    this.emit('close', { preventDefault: () => { prevented = true } })
    if (!prevented) this.destroy()
  }
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.webContents.destroy()
    this.emit('closed')
  }
}

const ipc = new EventEmitter()
const ack = (sender: unknown) => ipc.emit(FLUSH_SAVE_DONE_CHANNEL, { sender })

afterEach(() => {
  vi.useRealTimers()
  ipc.removeAllListeners()
})

describe('requestRendererFlush', () => {
  it('asks the renderer and resolves on its own ack; listeners are removed afterwards', async () => {
    const wc = new FakeWebContents()
    wc.onSend = () => queueMicrotask(() => ack(wc))
    await expect(requestRendererFlush(wc, ipc, 1000)).resolves.toBe('done')
    expect(wc.sent).toEqual([FLUSH_SAVE_CHANNEL])
    expect(ipc.listenerCount(FLUSH_SAVE_DONE_CHANNEL)).toBe(0)
    expect(wc.listenerCount('destroyed')).toBe(0)
  })

  it("another window's ack does not release the wait (quit flushes several windows at once)", async () => {
    vi.useFakeTimers()
    const a = new FakeWebContents()
    const b = new FakeWebContents()
    const results: Record<string, FlushResult> = {}
    void requestRendererFlush(a, ipc, QUIT_FLUSH_TIMEOUT_MS).then(r => { results.a = r })
    void requestRendererFlush(b, ipc, QUIT_FLUSH_TIMEOUT_MS).then(r => { results.b = r })
    ack(a)
    await vi.advanceTimersByTimeAsync(0)
    expect(results).toEqual({ a: 'done' })
    await vi.advanceTimersByTimeAsync(QUIT_FLUSH_TIMEOUT_MS)
    expect(results).toEqual({ a: 'done', b: 'timeout' })
    expect(ipc.listenerCount(FLUSH_SAVE_DONE_CHANNEL)).toBe(0)
  })

  it("times out when the renderer never acks, and a late ack changes nothing", async () => {
    vi.useFakeTimers()
    const wc = new FakeWebContents()
    const p = requestRendererFlush(wc, ipc, 500)
    await vi.advanceTimersByTimeAsync(500)
    await expect(p).resolves.toBe('timeout')
    expect(() => ack(wc)).not.toThrow()
  })

  it("'gone' for a destroyed renderer, one destroyed mid-flush, or one whose send throws", async () => {
    const dead = new FakeWebContents()
    dead.destroy()
    await expect(requestRendererFlush(dead, ipc, 1000)).resolves.toBe('gone')
    expect(dead.sent).toEqual([])

    const dying = new FakeWebContents()
    const p = requestRendererFlush(dying, ipc, 1000)
    dying.destroy()
    await expect(p).resolves.toBe('gone')

    const broken = new FakeWebContents()
    broken.onSend = () => { throw new Error('send failed') }
    await expect(requestRendererFlush(broken, ipc, 1000)).resolves.toBe('gone')
    expect(ipc.listenerCount(FLUSH_SAVE_DONE_CHANNEL)).toBe(0)
  })
})

describe('flushBeforeClose', () => {
  it('holds the close until the flush resolved, then destroys the window once', async () => {
    const win = new FakeWindow()
    let release!: (r: FlushResult) => void
    const flush = vi.fn(() => new Promise<FlushResult>(r => { release = r }))
    const onResult = vi.fn()
    const closed = vi.fn()
    win.on('closed', closed)
    flushBeforeClose(win, { flush, skip: () => false, onResult })

    win.close()
    win.close() // a second click while flushing: absorbed, no second flush
    expect(flush).toHaveBeenCalledTimes(1)
    expect(win.isDestroyed()).toBe(false)
    release('done')
    await vi.waitFor(() => expect(closed).toHaveBeenCalledTimes(1))
    expect(onResult).toHaveBeenCalledWith('done', expect.any(Number))
  })

  it('closes anyway when the flush times out, rejects or throws', async () => {
    vi.useFakeTimers()
    const timedOut = new FakeWindow()
    const onResult = vi.fn()
    flushBeforeClose(timedOut, {
      skip: () => false,
      flush: () => requestRendererFlush(timedOut.webContents, ipc, DETACHED_CLOSE_FLUSH_TIMEOUT_MS),
      onResult,
    })
    timedOut.close()
    await vi.advanceTimersByTimeAsync(DETACHED_CLOSE_FLUSH_TIMEOUT_MS - 1)
    expect(timedOut.isDestroyed()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(timedOut.isDestroyed()).toBe(true)
    expect(onResult).toHaveBeenCalledWith('timeout', DETACHED_CLOSE_FLUSH_TIMEOUT_MS)
    vi.useRealTimers()

    const rejected = new FakeWindow()
    const onRejected = vi.fn()
    flushBeforeClose(rejected, { skip: () => false, flush: () => Promise.reject(new Error('x')), onResult: onRejected })
    rejected.close()
    await vi.waitFor(() => expect(rejected.isDestroyed()).toBe(true))
    expect(onRejected).toHaveBeenCalledWith('error', expect.any(Number))

    const threw = new FakeWindow()
    flushBeforeClose(threw, { skip: () => false, flush: () => { throw new Error('y') }, onResult: () => { throw new Error('log failed') } })
    threw.close()
    await vi.waitFor(() => expect(threw.isDestroyed()).toBe(true))
  })

  it('skip (app quitting) closes right away without a flush', () => {
    const win = new FakeWindow()
    const flush = vi.fn(async (): Promise<FlushResult> => 'done')
    flushBeforeClose(win, { flush, skip: () => true })
    win.close()
    expect(win.isDestroyed()).toBe(true)
    expect(flush).not.toHaveBeenCalled()
  })

  it('a window destroyed while flushing is not destroyed twice', async () => {
    const win = new FakeWindow()
    const closed = vi.fn()
    win.on('closed', closed)
    flushBeforeClose(win, { skip: () => false, flush: () => requestRendererFlush(win.webContents, ipc, 1000) })
    win.close()
    win.destroy()
    await new Promise(r => setTimeout(r, 0))
    expect(closed).toHaveBeenCalledTimes(1)
  })
})

describe('detached close order on a real registry: flush save → closed → whenIdle → reattached', () => {
  const parentId = 'win-parent'
  let registry: WindowRegistry

  beforeEach(async () => {
    paths.userData = mkdtempSync(join(tmpdir(), 'bat-t0504-'))
    registry = new WindowRegistry()
    await registry.saveEntry({
      id: parentId,
      workspaces: [{ id: 'A', folderPath: '/a' }, { id: 'D', folderPath: '/d' }],
      activeWorkspaceId: 'A',
      activeGroup: null,
      terminals: [{ id: 'a1', workspaceId: 'A', title: 'a1' }, { id: 'd1', workspaceId: 'D', title: 'old name' }],
      activeTerminalId: null,
      lastActiveAt: 0,
    })
  })

  afterEach(() => rmSync(paths.userData, { recursive: true, force: true }))

  const titleOf = async (id: string) =>
    ((await registry.getEntry(parentId))?.terminals ?? []).map(t => t as { id: string; title?: string }).find(t => t.id === id)?.title

  /** main.ts's detached window: flush before close; on 'closed' wait for the registry, then reattach. */
  function openDetached(renderer: (wc: FakeWebContents) => void) {
    const win = new FakeWindow()
    const events: string[] = []
    let reattachedTitle: string | undefined
    const reattached = new Promise<void>((resolve) => {
      win.on('closed', () => {
        events.push('closed')
        void registry.whenIdle().then(async () => {
          reattachedTitle = await titleOf('d1')
          events.push('reattached')
          resolve()
        })
      })
    })
    flushBeforeClose(win, {
      skip: () => false,
      flush: () => requestRendererFlush(win.webContents, ipc, DETACHED_CLOSE_FLUSH_TIMEOUT_MS),
      onResult: (result) => events.push(`flush:${result}`),
    })
    renderer(win.webContents)
    return { win, events, reattached, reattachedTitle: () => reattachedTitle }
  }

  it('a rename made just before closing is in the parent entry when the parent adopts the workspace', async () => {
    const d = openDetached((wc) => {
      // The detached renderer: workspaceStore.save() → workspace:save (merge into the parent), then ack.
      wc.onSend = (channel) => {
        if (channel !== FLUSH_SAVE_CHANNEL) return
        void (async () => {
          await new Promise(r => setTimeout(r, 20))
          d.events.push('save')
          await saveDetachedWorkspaceTerminals(registry, parentId, 'D', {
            workspaces: [{ id: 'D', folderPath: '/d' }],
            activeWorkspaceId: 'D',
            terminals: [{ id: 'd1', workspaceId: 'D', title: 'new name' }],
          })
          ack(wc)
        })()
      }
    })
    d.win.close()
    expect(d.win.isDestroyed()).toBe(false)
    await d.reattached
    expect(d.events).toEqual(['save', 'flush:done', 'closed', 'reattached'])
    expect(d.reattachedTitle()).toBe('new name')
    // Restart: a fresh registry reads the same file.
    expect(((await new WindowRegistry().getEntry(parentId))?.terminals ?? []).map(t => (t as { title?: string }).title)).toEqual(['a1', 'new name'])
  })

  it('a renderer that never acks still closes after the timeout and reattaches with what was saved', async () => {
    vi.useFakeTimers()
    const d = openDetached(() => { /* hung renderer */ })
    d.win.close()
    await vi.advanceTimersByTimeAsync(DETACHED_CLOSE_FLUSH_TIMEOUT_MS)
    vi.useRealTimers()
    await d.reattached
    expect(d.events).toEqual(['flush:timeout', 'closed', 'reattached'])
    expect(d.reattachedTitle()).toBe('old name')
  })
})

describe('T0508: createRendererFlusher — one flush per renderer at a time', () => {
  it('a second request while one runs gets the same promise; the renderer is asked once', async () => {
    const flushRenderer = createRendererFlusher(ipc)
    const wc = new FakeWebContents()
    const first = flushRenderer(wc, DETACHED_CLOSE_FLUSH_TIMEOUT_MS)
    const second = flushRenderer(wc, QUIT_FLUSH_TIMEOUT_MS)
    expect(second).toBe(first)
    expect(wc.sent).toEqual([FLUSH_SAVE_CHANNEL])
    ack(wc)
    await expect(first).resolves.toBe('done')
    expect(ipc.listenerCount(FLUSH_SAVE_DONE_CHANNEL)).toBe(0)

    // Once it settled, the next request asks again.
    const third = flushRenderer(wc, QUIT_FLUSH_TIMEOUT_MS)
    expect(third).not.toBe(first)
    expect(wc.sent).toEqual([FLUSH_SAVE_CHANNEL, FLUSH_SAVE_CHANNEL])
    ack(wc)
    await expect(third).resolves.toBe('done')
  })

  it('renderers are independent, and a timed-out flush frees the slot', async () => {
    vi.useFakeTimers()
    const flushRenderer = createRendererFlusher(ipc)
    const a = new FakeWebContents()
    const b = new FakeWebContents()
    const pa = flushRenderer(a, 500)
    const pb = flushRenderer(b, 500)
    expect(pb).not.toBe(pa)
    ack(b)
    await expect(pb).resolves.toBe('done')
    await vi.advanceTimersByTimeAsync(500)
    await expect(pa).resolves.toBe('timeout')
    expect(flushRenderer(a, 500)).not.toBe(pa)
    expect(a.sent).toEqual([FLUSH_SAVE_CHANNEL, FLUSH_SAVE_CHANNEL])
  })
})

describe('T0508: flushBeforeClose close guard', () => {
  it('closing() is null until the flush starts, then resolves on closed', async () => {
    const win = new FakeWindow()
    let release!: (r: FlushResult) => void
    const guard = flushBeforeClose(win, { skip: () => false, flush: () => new Promise<FlushResult>(r => { release = r }) })
    expect(guard.closing()).toBeNull()
    win.close()
    const closing = guard.closing()
    expect(closing).not.toBeNull()
    let settled = false
    void closing!.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    release('done')
    await closing
    expect(win.isDestroyed()).toBe(true)
    expect(guard.closing()).toBe(closing)
  })

  it('a skipped close (quit flush running) is not a flush-before-close: closing() stays null', () => {
    const win = new FakeWindow()
    const guard = flushBeforeClose(win, { skip: () => true, flush: async () => 'done' })
    win.close()
    expect(win.isDestroyed()).toBe(true)
    expect(guard.closing()).toBeNull()
  })
})

describe('T0508: quit dialog — close a detached window, then cancel or confirm the quit', () => {
  /** main.ts: `skip: () => quitFlushStarted`, both paths through one `flushRenderer`. */
  function setup() {
    const quit = { flushStarted: false }
    const flushRenderer = createRendererFlusher(ipc)
    const win = new FakeWindow()
    const events: string[] = []
    win.webContents.onSend = (channel) => { if (channel === FLUSH_SAVE_CHANNEL) events.push('flush-save') }
    win.on('closed', () => events.push('closed'))
    flushBeforeClose(win, {
      skip: () => quit.flushStarted,
      flush: () => flushRenderer(win.webContents, DETACHED_CLOSE_FLUSH_TIMEOUT_MS),
      onResult: (result) => events.push(`flush:${result}`),
    })
    /** before-quit once the dialog was confirmed: set the flag, then flush every renderer still around. */
    const quitFlush = (): Promise<FlushResult> => {
      quit.flushStarted = true
      return win.isDestroyed() ? Promise.resolve('gone') : flushRenderer(win.webContents, QUIT_FLUSH_TIMEOUT_MS)
    }
    return { win, events, quitFlush }
  }

  it('closed while the dialog is open: it flushes (a cancelled quit loses nothing)', async () => {
    const d = setup()
    d.win.close() // dialog open: isAppQuitting is true, but the quit flush has not started
    expect(d.events).toEqual(['flush-save'])
    expect(d.win.isDestroyed()).toBe(false)
    ack(d.win.webContents) // the renderer saved
    await vi.waitFor(() => expect(d.events).toEqual(['flush-save', 'flush:done', 'closed']))
    // Cancel: nothing else to do — the save landed before the window closed.
  })

  it('confirmed while that flush still runs: the quit flush joins it, the renderer is asked once', async () => {
    const d = setup()
    d.win.close()
    const quitResult = d.quitFlush()
    expect(d.events).toEqual(['flush-save'])
    ack(d.win.webContents)
    await expect(quitResult).resolves.toBe('done')
    await vi.waitFor(() => expect(d.events).toEqual(['flush-save', 'flush:done', 'closed']))
  })

  it('closed after the quit flush started (app.quit() closing windows): no second flush', async () => {
    const d = setup()
    const quitResult = d.quitFlush()
    ack(d.win.webContents)
    await expect(quitResult).resolves.toBe('done')
    d.win.close()
    expect(d.win.isDestroyed()).toBe(true)
    expect(d.events).toEqual(['flush-save', 'closed'])
  })
})

describe('T0508: detach again while the workspace window is still going away', () => {
  /**
   * main.ts's 'workspace:detach' / 'closed' wiring: detachedWindows + close guards +
   * DetachedTeardowns; the parent is told 'workspace:reattached' after the registry's
   * whenIdle (here `idle`, which a test can hold).
   */
  function setup() {
    const flushRenderer = createRendererFlusher(ipc)
    const windows = new Map<string, FakeWindow>()
    const guards = new WeakMap<FakeWindow, ReturnType<typeof flushBeforeClose>>()
    const teardowns = new DetachedTeardowns()
    const events: string[] = []
    let releaseIdle: () => void = () => {}
    let idle = Promise.resolve()
    const holdIdle = () => { idle = new Promise<void>(r => { releaseIdle = r }) }
    const pending = (ws: string) => {
      const win = windows.get(ws)
      return teardowns.pending(ws, win && guards.get(win))
    }
    let opened = 0
    const open = (ws: string) => {
      const win = new FakeWindow()
      const name = `win${++opened}`
      win.webContents.onSend = (channel) => { if (channel === FLUSH_SAVE_CHANNEL) events.push(`${name}:flush-save`) }
      guards.set(win, flushBeforeClose(win, {
        skip: () => false,
        flush: () => flushRenderer(win.webContents, DETACHED_CLOSE_FLUSH_TIMEOUT_MS),
      }))
      windows.set(ws, win)
      win.on('closed', () => {
        events.push(`${name}:closed`)
        if (windows.get(ws) === win) windows.delete(ws)
        teardowns.reattachPending(ws, idle.then(() => { events.push(`${name}:reattached`) }))
      })
      events.push(`${name}:opened`)
      return win
    }
    const focus = (win: FakeWindow) => events.push(`focus:${win.isDestroyed() ? 'destroyed' : 'live'}`)
    /** The 'workspace:detach' handler. */
    const detach = async (ws: string) => {
      if (windows.has(ws) && !pending(ws)) { focus(windows.get(ws)!); return }
      await Promise.resolve() // getSenderProfileBinding
      for (let p = pending(ws); p; p = pending(ws)) await p
      if (windows.has(ws)) { focus(windows.get(ws)!); return }
      open(ws)
    }
    return { windows, events, detach, open, holdIdle, releaseIdle: () => releaseIdle() }
  }

  it('a detach during the flush waits for closed and reattached, then opens a new window', async () => {
    const t = setup()
    const first = t.open('D')
    t.holdIdle()
    first.close()
    const detached = t.detach('D')
    await new Promise(r => setTimeout(r, 0))
    expect(t.events).toEqual(['win1:opened', 'win1:flush-save'])
    ack(first.webContents)
    await vi.waitFor(() => expect(t.events).toContain('win1:closed'))
    await new Promise(r => setTimeout(r, 0))
    expect(t.events).not.toContain('win2:opened') // the parent was not told it reattached yet
    t.releaseIdle()
    await detached
    expect(t.events).toEqual(['win1:opened', 'win1:flush-save', 'win1:closed', 'win1:reattached', 'win2:opened'])
    expect(t.windows.get('D')).not.toBe(first)
  })

  it('two detach clicks during the flush open one window (the second focuses it)', async () => {
    const t = setup()
    const first = t.open('D')
    first.close()
    const a = t.detach('D')
    const b = t.detach('D')
    ack(first.webContents)
    await Promise.all([a, b])
    expect(t.events.filter(e => e.endsWith(':opened'))).toEqual(['win1:opened', 'win2:opened'])
    expect(t.events.at(-1)).toBe('focus:live')
    expect(t.events).not.toContain('focus:destroyed')
  })

  it('a hung renderer delays the new window by at most the close-flush timeout', async () => {
    vi.useFakeTimers()
    const t = setup()
    const first = t.open('D')
    first.close()
    const detached = t.detach('D')
    await vi.advanceTimersByTimeAsync(DETACHED_CLOSE_FLUSH_TIMEOUT_MS - 1)
    expect(t.events).not.toContain('win2:opened')
    await vi.advanceTimersByTimeAsync(1)
    await detached
    expect(t.events).toEqual(['win1:opened', 'win1:flush-save', 'win1:closed', 'win1:reattached', 'win2:opened'])
  })

  it('an open window that is not closing is focused right away', async () => {
    const t = setup()
    t.open('D')
    await t.detach('D')
    expect(t.events).toEqual(['win1:opened', 'focus:live'])
  })

  it('a pending reattach is forgotten once the parent was told, also when that failed', async () => {
    const teardowns = new DetachedTeardowns()
    let fail: (e: Error) => void = () => {}
    teardowns.reattachPending('D', new Promise((_resolve, reject) => { fail = reject }))
    const waiting = teardowns.pending('D', undefined)
    expect(waiting).not.toBeNull()
    fail(new Error('whenIdle failed'))
    await expect(waiting).resolves.toBeUndefined()
    expect(teardowns.pending('D', undefined)).toBeNull()
  })
})
