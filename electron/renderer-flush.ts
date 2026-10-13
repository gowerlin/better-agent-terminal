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

export interface FlushBeforeCloseWindow {
  on(event: 'close', listener: (e: { preventDefault(): void }) => void): unknown
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

/**
 * Holds a window's close until its renderer flushed (or the flush timed out / failed),
 * then destroys it, so 'closed' — and whatever runs after it — comes after the last save.
 * A second close while the flush runs is absorbed; a flush is never started twice.
 */
export function flushBeforeClose(win: FlushBeforeCloseWindow, opts: FlushBeforeCloseOptions): void {
  let flushing = false
  win.on('close', (e) => {
    if (opts.skip()) return
    e.preventDefault()
    if (flushing) return
    flushing = true
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
}
