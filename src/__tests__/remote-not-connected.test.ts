/**
 * T0443 (BUG-110): renderer side of the remote-window fail-closed routing —
 * error matching, one notice per outage, and the init-path "retry once after
 * connected" helpers (App initProfile settings load, WorkspaceView restore).
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  REMOTE_NOT_CONNECTED,
  isRemoteNotConnectedError,
  loadNowOrWhenRemoteConnected,
  retryOnceWhenRemoteConnected,
  subscribeRemoteWindowStatus,
  waitForRemoteConnected,
  type RemoteInvokeRefusedEvent,
  type RemoteWindowStatusEvent,
} from '../lib/remote-not-connected'

const refusedError = (channel = 'pty:create') =>
  new Error(`Error invoking remote method '${channel}': Error: ${REMOTE_NOT_CONNECTED}: remote profile P is not connected (reconnecting); ${channel} was not run on this machine`)

const status = (connected: boolean): RemoteWindowStatusEvent => connected
  ? { profileId: 'P', connected: true, state: 'connected', reason: null }
  : { profileId: 'P', connected: false, state: 'reconnecting', reason: 'reconnecting' }

const refusal = (channel: string): RemoteInvokeRefusedEvent =>
  ({ errorCode: REMOTE_NOT_CONNECTED, profileId: 'P', reason: 'reconnecting', channel })

/** Fake `window.electronAPI.remote`: emit status / refusal pushes by hand. */
function fakeRemoteApi(initiallyConnected = false) {
  const statusListeners = new Set<(s: RemoteWindowStatusEvent) => void>()
  const refusedListeners = new Set<(i: RemoteInvokeRefusedEvent) => void>()
  let connected = initiallyConnected
  return {
    api: {
      onClientStatusChanged: (cb: (s: RemoteWindowStatusEvent) => void) => {
        statusListeners.add(cb)
        return () => { statusListeners.delete(cb) }
      },
      onInvokeRefused: (cb: (i: RemoteInvokeRefusedEvent) => void) => {
        refusedListeners.add(cb)
        return () => { refusedListeners.delete(cb) }
      },
      clientStatus: async () => ({ connected }),
    },
    emitStatus(s: RemoteWindowStatusEvent) {
      connected = s.connected
      for (const cb of [...statusListeners]) cb(s)
    },
    emitRefused(i: RemoteInvokeRefusedEvent) {
      for (const cb of [...refusedListeners]) cb(i)
    },
    listenerCount: () => statusListeners.size + refusedListeners.size,
  }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('isRemoteNotConnectedError', () => {
  it('matches the code inside the Electron-wrapped message only', () => {
    expect(isRemoteNotConnectedError(refusedError())).toBe(true)
    expect(isRemoteNotConnectedError(REMOTE_NOT_CONNECTED)).toBe(true)
    expect(isRemoteNotConnectedError(new Error('Not connected to remote server'))).toBe(false)
    expect(isRemoteNotConnectedError(new Error('Remote invoke timeout: pty:create'))).toBe(false)
    expect(isRemoteNotConnectedError(undefined)).toBe(false)
  })
})

describe('subscribeRemoteWindowStatus (App notice)', () => {
  it('shows one notice per outage however many invokes are refused, again after reconnecting', () => {
    const fake = fakeRemoteApi()
    const onStatus = vi.fn()
    const onNotice = vi.fn()
    const unsubscribe = subscribeRemoteWindowStatus(fake.api, { onStatus, onNotice })

    fake.emitStatus(status(false))
    fake.emitRefused(refusal('pty:write'))
    fake.emitRefused(refusal('pty:write'))
    fake.emitRefused(refusal('pty:resize'))
    expect(onNotice).toHaveBeenCalledTimes(1)
    expect(onNotice).toHaveBeenCalledWith(refusal('pty:write'))

    // a reconnecting push does not re-arm the notice; connected does
    fake.emitStatus(status(false))
    fake.emitRefused(refusal('git:status'))
    expect(onNotice).toHaveBeenCalledTimes(1)
    fake.emitStatus(status(true))
    fake.emitStatus(status(false))
    fake.emitRefused(refusal('fs:readdir'))
    fake.emitRefused(refusal('fs:readdir'))
    expect(onNotice).toHaveBeenCalledTimes(2)

    expect(onStatus.mock.calls.map(([s]) => s.connected)).toEqual([false, false, true, false])
    unsubscribe()
    expect(fake.listenerCount()).toBe(0)
  })
})

describe('waitForRemoteConnected', () => {
  it('resolves on the next connected push and unsubscribes', async () => {
    const fake = fakeRemoteApi(false)
    let resolved = false
    const wait = waitForRemoteConnected(fake.api).then(() => { resolved = true })
    await flush()
    fake.emitStatus(status(false))
    await flush()
    expect(resolved).toBe(false)
    fake.emitStatus(status(true))
    await wait
    expect(fake.listenerCount()).toBe(0)
  })

  it('resolves when the connection came back before the subscription', async () => {
    const fake = fakeRemoteApi(true)
    await expect(waitForRemoteConnected(fake.api)).resolves.toBeUndefined()
    expect(fake.listenerCount()).toBe(0)
  })
})

describe('retryOnceWhenRemoteConnected (WorkspaceView restore)', () => {
  it('runs the call once more after connected when it was refused', async () => {
    const fake = fakeRemoteApi(false)
    const call = vi.fn()
      .mockRejectedValueOnce(refusedError())
      .mockResolvedValueOnce({ ok: true, created: false })
    const result = retryOnceWhenRemoteConnected(call, fake.api)
    await flush()
    expect(call).toHaveBeenCalledTimes(1)
    fake.emitStatus(status(true))
    await expect(result).resolves.toEqual({ ok: true, created: false })
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('retries only once, and never for other errors', async () => {
    const fake = fakeRemoteApi(true)
    const twiceRefused = vi.fn().mockRejectedValue(refusedError())
    await expect(retryOnceWhenRemoteConnected(twiceRefused, fake.api)).rejects.toThrow(REMOTE_NOT_CONNECTED)
    expect(twiceRefused).toHaveBeenCalledTimes(2)

    const other = vi.fn().mockRejectedValue(new Error('PTY_LIMIT_REACHED'))
    await expect(retryOnceWhenRemoteConnected(other, fake.api)).rejects.toThrow('PTY_LIMIT_REACHED')
    expect(other).toHaveBeenCalledTimes(1)
  })
})

describe('loadNowOrWhenRemoteConnected (App initProfile settings)', () => {
  it('does not block init: reports deferred, loads once in the background after connected', async () => {
    const fake = fakeRemoteApi(false)
    const load = vi.fn()
      .mockRejectedValueOnce(refusedError('settings:load'))
      .mockResolvedValueOnce(undefined)
    await expect(loadNowOrWhenRemoteConnected(load, fake.api)).resolves.toBe(true)
    expect(load).toHaveBeenCalledTimes(1)
    fake.emitStatus(status(true))
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })

  it('loads normally when connected and rethrows other errors', async () => {
    const fake = fakeRemoteApi(true)
    const load = vi.fn().mockResolvedValue(undefined)
    await expect(loadNowOrWhenRemoteConnected(load, fake.api)).resolves.toBe(false)
    expect(load).toHaveBeenCalledTimes(1)
    await expect(loadNowOrWhenRemoteConnected(() => Promise.reject(new Error('boom')), fake.api)).rejects.toThrow('boom')
  })

  it('reports a failing background retry instead of rejecting unhandled', async () => {
    const fake = fakeRemoteApi(false)
    const onRetryError = vi.fn()
    const load = vi.fn().mockRejectedValue(refusedError('settings:load'))
    await loadNowOrWhenRemoteConnected(load, fake.api, onRetryError)
    fake.emitStatus(status(true))
    await vi.waitFor(() => expect(onRetryError).toHaveBeenCalledTimes(1))
  })
})

describe('init path call sites (source guard)', () => {
  const app = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')
  const workspaceView = readFileSync(join(__dirname, '..', 'components', 'WorkspaceView.tsx'), 'utf8')

  it('App: profile:list falls back to listLocal, settings load is deferred, profile:load refusal is caught', () => {
    expect(app).toMatch(/profile\.list\(\)\.catch\([\s\S]{0,200}isRemoteNotConnectedError\(err\)[\s\S]{0,200}profile\.listLocal\(\)/)
    expect(app).not.toMatch(/await settingsStore\.load\(\)/)
    expect(app.match(/loadNowOrWhenRemoteConnected\(\(\) => settingsStore\.load\(\)/g) ?? []).toHaveLength(2)
    expect(app).toMatch(/profile\.load\(localProfile\.id\)\.then\(\(\) => false, \(err: unknown\) => \{\s+if \(!isRemoteNotConnectedError\(err\)\) throw err/)
    expect(app).toMatch(/subscribeRemoteWindowStatus\(window\.electronAPI\.remote/)
  })

  it('WorkspaceView: restore init retries once on connect; new terminals are not retried', () => {
    expect(workspaceView).toMatch(/retryOnceWhenRemoteConnected\(initTerminals, window\.electronAPI\.remote\)/)
    expect(workspaceView).toMatch(/createPtyWithReplay\(createOpts, restorePtyApi\)/)
    expect(workspaceView).toMatch(/\}, restorePtyApi\)\.then\(/)
    expect(workspaceView.match(/restorePtyApi\)/g) ?? []).toHaveLength(2)
  })
})
