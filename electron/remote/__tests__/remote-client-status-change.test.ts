// @vitest-environment node
/**
 * T0443 (BUG-110): RemoteClient pings its status listener on every change main
 * turns into `remote:client-status-changed` — auth ok, server drop (→ reconnecting)
 * and disconnect(). A real client against an in-process headless server.
 */
import { describe, expect, it } from 'vitest'
import { RemoteClient } from '../remote-client'
import { startHeadlessHarness } from './helpers/headless-harness'

describe('RemoteClient status change listener', () => {
  it('pings on connect, on a server drop (reconnecting) and on disconnect()', async () => {
    const harness = await startHeadlessHarness({ timeoutMs: 15_000 })
    const client = new RemoteClient(() => [])
    const seen: Array<{ connected: boolean; reconnecting: boolean }> = []
    client.setStatusChangeListener(() => seen.push({ connected: client.isConnected, reconnecting: client.isReconnecting }))
    let disposed = false
    try {
      const result = await client.connect('127.0.0.1', harness.port, harness.token, 'T0443 client', harness.fingerprint)
      expect(result.ok, result.error).toBe(true)
      expect(seen).toEqual([{ connected: true, reconnecting: false }])

      await harness.dispose()
      disposed = true
      await expect.poll(() => seen.length, { timeout: 5_000 }).toBe(2)
      expect(seen[1]).toEqual({ connected: false, reconnecting: true })
      expect(client.isReconnecting).toBe(true)

      await client.disconnect()
      expect(seen[seen.length - 1]).toEqual({ connected: false, reconnecting: false })
      expect(client.isReconnecting).toBe(false)
    } finally {
      await client.disconnect()
      if (!disposed) await harness.dispose()
    }
  }, 30_000)

  it('a throwing listener does not break disconnect()', async () => {
    const client = new RemoteClient(() => [])
    client.setStatusChangeListener(() => { throw new Error('listener boom') })
    await expect(client.disconnect()).resolves.toBeUndefined()
  })
})
