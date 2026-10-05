/**
 * T0443 (BUG-110): renderer side of the remote-window fail-closed routing.
 *
 * A remote-profile window whose own profile's connection is not live (no client,
 * reconnecting, gave up; T0463: each remote profile has its own connection, so
 * another profile never takes it away) gets its proxied invokes refused by main
 * with `REMOTE_NOT_CONNECTED` instead of having them run on this machine. Main
 * also pushes `remote:client-status-changed` when the state changes and
 * `remote:invoke-refused` for each refusal (electron/remote/remote-connect-plan.ts).
 *
 * Electron only carries an IPC error's message, so the code is matched in it.
 */

/** Same literal as electron/remote/remote-connect-plan.ts (guarded by a test). */
export const REMOTE_NOT_CONNECTED = 'REMOTE_NOT_CONNECTED'

export type RemoteNotConnectedReason = 'no-client' | 'reconnecting' | 'disconnected'

export interface RemoteWindowStatusEvent {
  profileId: string
  connected: boolean
  state: 'connected' | 'reconnecting' | 'disconnected'
  reason: RemoteNotConnectedReason | null
}

export interface RemoteInvokeRefusedEvent {
  errorCode: typeof REMOTE_NOT_CONNECTED
  profileId: string
  reason: RemoteNotConnectedReason
  channel: string
}

/** The subset of `window.electronAPI.remote` these helpers use. */
export interface RemoteStatusApi {
  onClientStatusChanged: (callback: (status: RemoteWindowStatusEvent) => void) => () => void
  clientStatus: () => Promise<{ connected: boolean }>
}

export function isRemoteNotConnectedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return message.includes(REMOTE_NOT_CONNECTED)
}

/**
 * One notice per outage: the first refusal after (re)connecting asks for a
 * notice, later refusals stay quiet until a `connected` status resets it — a
 * disconnected window refuses every keystroke's `pty:write`.
 */
export function createRemoteOutageNotice() {
  let notified = false
  return {
    /** A refusal arrived; true when this one should be shown. */
    onRefused(): boolean {
      if (notified) return false
      notified = true
      return true
    },
    onStatus(status: Pick<RemoteWindowStatusEvent, 'connected'>): void {
      if (status.connected) notified = false
    },
  }
}

/** `RemoteStatusApi` plus the refusal push. */
export interface RemoteWindowEventsApi extends RemoteStatusApi {
  onInvokeRefused: (callback: (info: RemoteInvokeRefusedEvent) => void) => () => void
}

/**
 * App wiring: forward every status change, and turn refusals into at most one
 * notice per outage (reset by the next `connected` status). Returns unsubscribe.
 */
export function subscribeRemoteWindowStatus(
  api: RemoteWindowEventsApi,
  handlers: {
    onStatus: (status: RemoteWindowStatusEvent) => void
    onNotice: (info: RemoteInvokeRefusedEvent) => void
  },
): () => void {
  const outage = createRemoteOutageNotice()
  const unsubStatus = api.onClientStatusChanged((status) => {
    outage.onStatus(status)
    handlers.onStatus(status)
  })
  const unsubRefused = api.onInvokeRefused((info) => {
    if (outage.onRefused()) handlers.onNotice(info)
  })
  return () => {
    unsubStatus()
    unsubRefused()
  }
}

/**
 * Resolves on the next `connected` status for this window. Also asks once, so
 * a connection that came back between the refusal and the subscription is not
 * missed.
 */
export function waitForRemoteConnected(api: RemoteStatusApi): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    let unsubscribe: (() => void) | null = null
    const finish = () => {
      if (done) return
      done = true
      unsubscribe?.()
      resolve()
    }
    unsubscribe = api.onClientStatusChanged((status) => {
      if (status.connected) finish()
    })
    if (done) unsubscribe()
    api.clientStatus().then((s) => { if (s.connected) finish() }).catch(() => { /* wait for the event */ })
  })
}

/**
 * Init-path retry: run `call`; when it is refused with REMOTE_NOT_CONNECTED, run
 * it once more after the window is connected again. Any other error, or a
 * second refusal, propagates. Stays pending while the window is disconnected,
 * so only fire-and-forget callers should use it.
 */
export async function retryOnceWhenRemoteConnected<T>(call: () => Promise<T>, api: RemoteStatusApi): Promise<T> {
  try {
    return await call()
  } catch (err) {
    if (!isRemoteNotConnectedError(err)) throw err
    await waitForRemoteConnected(api)
    return call()
  }
}

/**
 * Init-path load that must not block startup: run `load`; when it is refused
 * with REMOTE_NOT_CONNECTED, return `true` (deferred) right away and run it once
 * more in the background after the window is connected again.
 */
export async function loadNowOrWhenRemoteConnected(
  load: () => Promise<void>,
  api: RemoteStatusApi,
  onRetryError?: (err: unknown) => void,
): Promise<boolean> {
  try {
    await load()
    return false
  } catch (err) {
    if (!isRemoteNotConnectedError(err)) throw err
    void waitForRemoteConnected(api).then(load).catch((retryErr) => onRetryError?.(retryErr))
    return true
  }
}
