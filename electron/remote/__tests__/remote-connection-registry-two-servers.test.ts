// @vitest-environment node
/**
 * T0463 (PLAN-039): main.ts keeps one RemoteClient per remote profile. Two real
 * clients in one registry against two in-process headless servers: a server that
 * goes away only puts its own profile into reconnecting; the other profile keeps
 * routing and invoking as before (no `'other-profile'`, no shared slot).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { RemoteClient } from '../remote-client'
import { planProfileProxiedInvokeRoute, type RemoteConnectBoundProfile } from '../remote-connect-plan'
import { RemoteConnectionRegistry } from '../remote-connection-registry'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

const profileOf = (h: HeadlessHarness): RemoteConnectBoundProfile => ({
  type: 'remote',
  remoteHost: '127.0.0.1',
  remotePort: h.port,
  remoteToken: h.token,
  remoteFingerprint: h.fingerprint,
})

describe('RemoteConnectionRegistry with two headless servers', () => {
  const cleanups: Array<() => Promise<unknown>> = []
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!().catch(() => undefined)
  })

  it('stopping Q\'s server leaves only Q reconnecting; P keeps invoking', async () => {
    const serverP = await startHeadlessHarness({ timeoutMs: 15_000 })
    cleanups.push(() => serverP.dispose())
    const serverQ = await startHeadlessHarness({ timeoutMs: 15_000 })
    let qDisposed = false
    cleanups.push(() => (qDisposed ? Promise.resolve() : serverQ.dispose()))

    // Like main: every profile client's events go to that profile's windows (none here).
    const registry = new RemoteConnectionRegistry<RemoteClient, RemoteConnectBoundProfile>({
      createClient: () => new RemoteClient(() => []),
      countLiveWindows: () => 1,
    })
    cleanups.push(() => registry.disconnectAll())

    const connect = (profileId: string, h: HeadlessHarness) => registry.connect({
      profileId,
      profile: profileOf(h),
      request: { host: '127.0.0.1', port: h.port, token: h.token },
      run: (client, expected) => client.connect('127.0.0.1', h.port, h.token, `T0463 ${profileId}`, expected),
    })
    const [p, q] = await Promise.all([connect('P', serverP), connect('Q', serverQ)])
    expect(p.kind).toBe('connected')
    expect(q.kind).toBe('connected')
    expect(registry.size).toBe(2)
    expect(registry.get('P')!.client).not.toBe(registry.get('Q')!.client)

    const route = (profileId: string) => planProfileProxiedInvokeRoute({
      senderIsRemote: true,
      senderProfileId: profileId,
      conn: registry.connectionState(profileId),
    })
    expect(route('P')).toEqual({ kind: 'remote' })
    expect(route('Q')).toEqual({ kind: 'remote' })

    // A second connect for P (the renderer's initProfile) reuses P's verified client.
    const again = await connect('P', serverP)
    expect(again.kind).toBe('reuse')
    expect(registry.size).toBe(2)

    await serverQ.dispose()
    qDisposed = true
    await expect.poll(() => registry.connectionState('Q')?.isReconnecting, { timeout: 5_000 }).toBe(true)

    expect(registry.connectionState('P')).toEqual({ isConnected: true, isReconnecting: false })
    expect(route('P')).toEqual({ kind: 'remote' })
    expect(route('Q')).toMatchObject({ kind: 'refuse', profileId: 'Q', reason: 'reconnecting' })
    await expect(registry.get('P')!.client!.invoke('profile:load-snapshot', ['default'])).resolves.not.toBeUndefined()

    // Dropping Q (pin change / sender-scoped remote:disconnect) never touches P.
    expect(await registry.dropProfile('Q')).toBe(true)
    expect(registry.connectionState('Q')).toBeNull()
    expect(route('Q')).toMatchObject({ kind: 'refuse', reason: 'no-client' })
    expect(registry.isProfileLive('P')).toBe(true)
  }, 40_000)
})
