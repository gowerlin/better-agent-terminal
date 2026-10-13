/**
 * T0504: ask a renderer to save its workspace state now (`workspace:flush-save` →
 * `workspace:flush-save-done`), bounded by a timeout.
 *
 * Used by the quit path (every window) and by a detached workspace window's close: a
 * detached window saves terminal adds / removes right away, but a rename or a new
 * sdkSessionId only reaches the parent's entry with its 30 s autosave, so closing it
 * without a flush could drop up to 30 s of such changes.
 */

export const FLUSH_SAVE_CHANNEL = 'workspace:flush-save'
export const FLUSH_SAVE_DONE_CHANNEL = 'workspace:flush-save-done'
/** Quit path: per renderer, all renderers flush in parallel. */
export const QUIT_FLUSH_TIMEOUT_MS = 2000
/** Closing a detached workspace window waits at most this long before it closes anyway. */
export const DETACHED_CLOSE_FLUSH_TIMEOUT_MS = 1500

export type FlushResult = 'done' | 'timeout' | 'gone'

export interface FlushWebContents {
  isDestroyed(): boolean
  send(channel: string): void
  on(event: 'destroyed', listener: () => void): unknown
  removeListener(event: 'destroyed', listener: () => void): unknown
}

export interface FlushIpc {
  on(channel: string, listener: (event: { sender: unknown }) => void): unknown
  removeListener(channel: string, listener: (event: { sender: unknown }) => void): unknown
}

/**
 * Resolves 'done' once THIS renderer acked (an ack from another window does not count),
 * 'timeout' after `timeoutMs`, 'gone' when the renderer is or gets destroyed. Never rejects.
 * The renderer acks after its `workspace:save` resolved, so on 'done' the save is in the
 * registry already.
 */
export function requestRendererFlush(wc: FlushWebContents, ipc: FlushIpc, timeoutMs: number): Promise<FlushResult> {
  if (wc.isDestroyed()) return Promise.resolve('gone')
  return new Promise<FlushResult>((resolve) => {
    let settled = false
    const finish = (result: FlushResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ipc.removeListener(FLUSH_SAVE_DONE_CHANNEL, onDone)
      wc.removeListener('destroyed', onGone)
      resolve(result)
    }
    const onDone = (event: { sender: unknown }) => { if (event.sender === wc) finish('done') }
    const onGone = () => finish('gone')
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    ipc.on(FLUSH_SAVE_DONE_CHANNEL, onDone)
    wc.on('destroyed', onGone)
    try {
      wc.send(FLUSH_SAVE_CHANNEL)
    } catch {
      finish('gone')
    }
  })
}

/**
 * T0508: `requestRendererFlush` with one flush per renderer at a time — a second request
 * while one runs gets the same promise. A detached window closed while the quit dialog was
 * open is still flushing when the user confirms; the quit flush joins that flush instead of
 * asking the renderer again.
 */
export function createRendererFlusher(ipc: FlushIpc): (wc: FlushWebContents, timeoutMs: number) => Promise<FlushResult> {
  const inFlight = new Map<FlushWebContents, Promise<FlushResult>>()
  return (wc, timeoutMs) => {
    const running = inFlight.get(wc)
    if (running) return running
    const flushed = requestRendererFlush(wc, ipc, timeoutMs).then((result) => {
      inFlight.delete(wc)
      return result
    })
    inFlight.set(wc, flushed)
    return flushed
  }
}

export interface FlushBeforeCloseWindow {
  on(event: 'close', listener: (e: { preventDefault(): void }) => void): unknown
  once(event: 'closed', listener: () => void): unknown
  isDestroyed(): boolean
  destroy(): void
}

export interface FlushBeforeCloseOptions {
  /** One bounded flush of this window's renderer (`requestRendererFlush`). */
  flush: () => Promise<FlushResult>
  /** true → close without a flush (app quitting: the quit path flushed every window already). */
  skip: () => boolean
  onResult?: (result: FlushResult | 'error', elapsedMs: number) => void
}

export interface CloseGuard {
  /** T0508: resolves on the window's 'closed' once its flush-before-close started; null before that. */
  closing(): Promise<void> | null
}

/**
 * Holds a window's close until its renderer flushed (or the flush timed out / failed),
 * then destroys it, so 'closed' — and whatever runs after it — comes after the last save.
 * A second close while the flush runs is absorbed; a flush is never started twice.
 */
export function flushBeforeClose(win: FlushBeforeCloseWindow, opts: FlushBeforeCloseOptions): CloseGuard {
  let flushing = false
  let closed: Promise<void> | null = null
  win.on('close', (e) => {
    if (opts.skip()) return
    e.preventDefault()
    if (flushing) return
    flushing = true
    closed = new Promise<void>((resolve) => { win.once('closed', () => resolve()) })
    const startedAt = Date.now()
    let flushed: Promise<FlushResult>
    try {
      flushed = opts.flush()
    } catch {
      flushed = Promise.reject(new Error('flush threw'))
    }
    void flushed
      .then((result): FlushResult | 'error' => result, () => 'error' as const)
      .then((result) => {
        try { opts.onResult?.(result, Date.now() - startedAt) } catch { /* logging only */ }
        if (!win.isDestroyed()) win.destroy()
      })
  })
  return { closing: () => closed }
}

/**
 * T0508: a detached window is still going away while it flushes before close and, after
 * 'closed', until its parent was told 'workspace:reattached' (after the registry's whenIdle).
 * Detaching the same workspace in that span must neither focus the closing window nor open a
 * new one the parent would then mark as reattached; main waits for `pending()` instead.
 */
export class DetachedTeardowns {
  private readonly reattaching = new Map<string, Promise<void>>()

  /** From the window's 'closed': `notified` settles once the parent was told 'workspace:reattached'. */
  reattachPending(workspaceId: string, notified: Promise<unknown>): void {
    const done: Promise<void> = notified.then(() => {
      if (this.reattaching.get(workspaceId) === done) this.reattaching.delete(workspaceId)
    }, () => {
      if (this.reattaching.get(workspaceId) === done) this.reattaching.delete(workspaceId)
    })
    this.reattaching.set(workspaceId, done)
  }

  /**
   * What a new detach of `workspaceId` has to wait for, or null when it may focus / open now.
   * `current` is the close guard of the window registered for the workspace, if there is one.
   */
  pending(workspaceId: string, current: CloseGuard | undefined): Promise<void> | null {
    if (current) return current.closing()
    return this.reattaching.get(workspaceId) ?? null
  }
}
