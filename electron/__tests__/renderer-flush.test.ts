/**
 * T0504: a detached workspace window flushes its workspace state before it closes, so a
 * rename / new sdkSessionId (saved by the 30 s autosave only) reaches the parent's entry
 * before 'closed' → whenIdle() → 'workspace:reattached'. A flush that times out or fails
 * never keeps the window open. The quit path uses the same per-renderer flush.
 * main.ts wiring is guarded in detached-workspace-persistence.test.ts.
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
  DETACHED_CLOSE_FLUSH_TIMEOUT_MS,
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
