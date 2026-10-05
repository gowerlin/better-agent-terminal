/**
 * T0462 (PLAN-039): per-profile remote connection registry. Each remote profile
 * keeps its own client; the cap, the idle grace after the last window closes,
 * the first-window guard, the per-profile mutex and same-target detection are
 * exercised here with a fake client (no electron, no network).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FIRST_WINDOW_GRACE_MS,
  IDLE_GRACE_MS,
  MAX_CONCURRENT_REMOTE_PROFILES,
  RemoteConnectionRegistry,
  type RegistryClient,
} from '../remote-connection-registry'
import type { RemoteConnectBoundProfile } from '../remote-connect-plan'

const PIN = 'AB:CD:EF:01:23:45:67:89'

class FakeClient implements RegistryClient {
  isConnected = false
  isReconnecting = false
  disconnects = 0
  constructor(readonly profileId: string) {}
  async disconnect(): Promise<void> {
    this.disconnects++
    this.isConnected = false
    this.isReconnecting = false
  }
}

function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const profileFor = (id: string, overrides: Partial<RemoteConnectBoundProfile> = {}): RemoteConnectBoundProfile => ({
  type: 'remote',
  remoteHost: `host-${id}`,
  remotePort: 9876,
  remoteToken: `tok-${id}`,
  remoteFingerprint: PIN,
  ...overrides,
})

const requestFor = (profile: RemoteConnectBoundProfile) => ({
  host: profile.remoteHost ?? '',
  port: profile.remotePort ?? 9876,
  token: profile.remoteToken ?? '',
})

/** Connect succeeds immediately with the pinned fingerprint. */
const okRun = async (client: FakeClient) => {
  client.isConnected = true
  return { ok: true, fingerprint: PIN }
}

function setup(opts: { cap?: number } = {}) {
  const liveWindows = new Map<string, number>()
  const created: FakeClient[] = []
  const released: Array<[string, string]> = []
  const registry = new RemoteConnectionRegistry<FakeClient>({
    createClient: (profileId) => {
      const client = new FakeClient(profileId)
      created.push(client)
      return client
    },
    countLiveWindows: (profileId) => liveWindows.get(profileId) ?? 0,
    onReleased: (profileId, reason) => { released.push([profileId, reason]) },
    cap: opts.cap,
  })
  const connect = (id: string, run: (client: FakeClient, expected: string | undefined) => Promise<{ ok: boolean; fingerprint?: string }> = okRun, overrides: Partial<RemoteConnectBoundProfile> = {}) => {
    const profile = profileFor(id, overrides)
    return registry.connect({ profileId: id, profile, request: requestFor(profile), run })
  }
  return { registry, liveWindows, created, released, connect }
}

describe('constants (T0459 Q1 / Q2)', () => {
  it('caps at 8 profiles with a 15 s idle grace and a 60 s first-window guard', () => {
    expect(MAX_CONCURRENT_REMOTE_PROFILES).toBe(8)
    expect(IDLE_GRACE_MS).toBe(15_000)
    expect(FIRST_WINDOW_GRACE_MS).toBe(60_000)
  })
})

describe('connect — one entry per profile', () => {
  it('creates a client per profile through the injected factory and keeps them side by side', async () => {
    const { registry, created, connect, liveWindows } = setup()
    liveWindows.set('P', 1).set('Q', 1)
    const p = await connect('P')
    const q = await connect('Q')
    expect(p).toMatchObject({ kind: 'connected', sameTargetProfileIds: [] })
    expect(q.kind).toBe('connected')
    expect(created.map(c => c.profileId)).toEqual(['P', 'Q'])
    expect(registry.size).toBe(2)
    expect(registry.connectionState('P')).toEqual({ isConnected: true, isReconnecting: false })
    expect(registry.connectionState('Q')).toEqual({ isConnected: true, isReconnecting: false })
    expect(registry.get('P')?.target).toEqual({ host: 'host-P', port: 9876, token: 'tok-P', fingerprint: PIN })
    expect(created.every(c => c.disconnects === 0)).toBe(true)
  })

  it('passes the pinned fingerprint to run', async () => {
    const { connect, liveWindows } = setup()
    liveWindows.set('P', 1)
    const run = vi.fn(okRun)
    await connect('P', run)
    expect(run).toHaveBeenCalledWith(expect.any(FakeClient), PIN)
  })

  it('reuses the profile\'s live client for the same target + pin without building another', async () => {
    const { connect, created, liveWindows } = setup()
    liveWindows.set('P', 1)
    const first = await connect('P')
    const again = await connect('P')
    expect(again).toEqual({ kind: 'reuse', client: (first as { client: FakeClient }).client, fingerprint: PIN })
    expect(created).toHaveLength(1)
  })

  it('refuses a window with no profile binding without taking a slot', async () => {
    const { registry, created } = setup()
    const profile = profileFor('P')
    const outcome = await registry.connect({ profileId: null, profile, request: requestFor(profile), run: okRun })
    expect(outcome).toMatchObject({ kind: 'reject', errorCode: 'binding-missing' })
    expect(registry.size).toBe(0)
    expect(created).toHaveLength(0)
  })

  it('a refused plan (legacy profile, no pin) frees the slot it took', async () => {
    const { registry, created, connect } = setup()
    const outcome = await connect('P', okRun, { remoteFingerprint: undefined })
    expect(outcome).toMatchObject({ kind: 'reject', errorCode: 'fingerprint-missing' })
    expect(registry.size).toBe(0)
    expect(created).toHaveLength(0)
  })

  it('a failed first connect disposes the candidate and frees the slot', async () => {
    const { registry, created, connect } = setup()
    const outcome = await connect('P', async () => ({ ok: false }))
    expect(outcome).toEqual({ kind: 'failed', result: { ok: false } })
    expect(created[0].disconnects).toBe(1)
    expect(registry.has('P')).toBe(false)
  })

  it('a failed reconnect keeps the current client and disposes only the candidate (T0430)', async () => {
    const { registry, created, connect, liveWindows } = setup()
    liveWindows.set('P', 1)
    await connect('P')
    created[0].isConnected = false // dropped; the next connect builds a candidate
    const outcome = await connect('P', async () => ({ ok: false }))
    expect(outcome.kind).toBe('failed')
    expect(created).toHaveLength(2)
    expect(created[1].disconnects).toBe(1)
    expect(created[0].disconnects).toBe(0)
    expect(registry.get('P')?.client).toBe(created[0])
  })

  it('a successful reconnect swaps in the candidate and disposes the previous client', async () => {
    const { registry, created, connect, liveWindows } = setup()
    liveWindows.set('P', 1)
    await connect('P')
    created[0].isConnected = false
    const outcome = await connect('P')
    expect(outcome.kind).toBe('connected')
    expect(registry.get('P')?.client).toBe(created[1])
    await Promise.resolve()
    expect(created[0].disconnects).toBe(1)
  })

  it('a throwing run disposes the candidate, frees the slot and rethrows', async () => {
    const { registry, created, connect } = setup()
    await expect(connect('P', async () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(created[0].disconnects).toBe(1)
    expect(registry.has('P')).toBe(false)
  })
})

describe('cap — MAX_CONCURRENT_REMOTE_PROFILES', () => {
  it('rejects the 9th profile without building a client or touching the other 8', async () => {
    const { registry, created, connect, liveWindows } = setup()
    for (let i = 1; i <= 8; i++) {
      liveWindows.set(`P${i}`, 1)
      expect((await connect(`P${i}`)).kind).toBe('connected')
    }
    const ninth = await connect('P9')
    expect(ninth).toEqual({ kind: 'limit', cap: 8 })
    expect(created).toHaveLength(8)
    expect(registry.size).toBe(8)
    expect(created.every(c => c.disconnects === 0 && c.isConnected)).toBe(true)
    expect(registry.has('P9')).toBe(false)
  })

  it('a profile that already has an entry is never refused at the cap', async () => {
    const { connect, liveWindows } = setup({ cap: 2 })
    liveWindows.set('P', 1).set('Q', 1)
    await connect('P')
    await connect('Q')
    expect((await connect('P')).kind).toBe('reuse')
  })

  it('two admissions racing for the last slot never exceed the cap', async () => {
    const { registry, connect, created } = setup()
    const gates: Array<ReturnType<typeof deferred>> = []
    const gatedRun = async (client: FakeClient) => {
      const gate = deferred()
      gates.push(gate)
      await gate.promise
      client.isConnected = true
      return { ok: true, fingerprint: PIN }
    }
    // 7 connects in flight hold placeholders
    const inFlight = Array.from({ length: 7 }, (_, i) => connect(`P${i + 1}`, gatedRun))
    expect(registry.size).toBe(7)
    const a = connect('A', gatedRun)
    const b = connect('B', gatedRun)
    expect(registry.size).toBe(8)
    await expect(b).resolves.toEqual({ kind: 'limit', cap: 8 })
    // let every queued exclusive section start, then release the handshakes
    await vi.waitFor(() => expect(gates).toHaveLength(8))
    for (const gate of gates) gate.resolve()
    await Promise.all([...inFlight, a])
    expect(registry.size).toBe(8)
    expect(created).toHaveLength(8)
    expect(registry.has('B')).toBe(false)
  })

  it('a failed connect gives its slot back to the next profile', async () => {
    const { registry, connect } = setup({ cap: 1 })
    await connect('P', async () => ({ ok: false }))
    expect((await connect('Q')).kind).toBe('connected')
    expect(registry.size).toBe(1)
  })
})

describe('idle release — last window closed + grace (T0459 Q1)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  async function connected() {
    const ctx = setup()
    ctx.liveWindows.set('P', 1)
    await ctx.connect('P')
    return ctx
  }

  it('disconnects and drops the entry once the grace runs out with no window left', async () => {
    const { registry, created, released, liveWindows } = await connected()
    liveWindows.set('P', 0)
    expect(registry.noteWindowClosed('P')).toBe('scheduled')
    expect(registry.pendingRelease('P')).toBe('idle')
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS - 1)
    expect(registry.has('P')).toBe(true)
    expect(created[0].disconnects).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(registry.has('P')).toBe(false)
    expect(created[0].disconnects).toBe(1)
    expect(released).toEqual([['P', 'idle']])
  })

  it('does nothing while another window of the profile is still open', async () => {
    const { registry, created } = await connected()
    expect(registry.noteWindowClosed('P')).toBe('kept')
    expect(registry.pendingRelease('P')).toBeNull()
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS * 2)
    expect(created[0].disconnects).toBe(0)
  })

  it('recomputes at expiry: a window that came back in the meantime keeps the connection', async () => {
    const { registry, created, released, liveWindows } = await connected()
    liveWindows.set('P', 0)
    registry.noteWindowClosed('P')
    liveWindows.set('P', 1)
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS)
    expect(registry.has('P')).toBe(true)
    expect(created[0].disconnects).toBe(0)
    expect(released).toEqual([])
    expect(registry.pendingRelease('P')).toBeNull()
  })

  it('a reuse from a reopened window cancels the pending release', async () => {
    const { registry, created, connect, liveWindows } = await connected()
    liveWindows.set('P', 0)
    registry.noteWindowClosed('P')
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS / 2)
    liveWindows.set('P', 1)
    expect((await connect('P')).kind).toBe('reuse')
    expect(registry.pendingRelease('P')).toBeNull()
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS)
    expect(registry.has('P')).toBe(true)
    expect(created[0].disconnects).toBe(0)
  })

  it('cancelRelease cancels even after the timer fired but before its exclusive section ran', async () => {
    const { registry, created, liveWindows } = await connected()
    liveWindows.set('P', 0)
    registry.noteWindowClosed('P')
    const hold = deferred()
    void registry.runExclusive('P', () => hold.promise) // queue ahead of the release check
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS)
    registry.cancelRelease('P')
    hold.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(registry.has('P')).toBe(true)
    expect(created[0].disconnects).toBe(0)
  })

  it('closing another window restarts the grace from the last close', async () => {
    const { registry, liveWindows } = await connected()
    liveWindows.set('P', 0)
    registry.noteWindowClosed('P')
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS - 1000)
    registry.noteWindowClosed('P')
    await vi.advanceTimersByTimeAsync(1000)
    expect(registry.has('P')).toBe(true)
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS - 1000)
    expect(registry.has('P')).toBe(false)
  })

  it('a profile without an entry has nothing to release', () => {
    const { registry } = setup()
    expect(registry.noteWindowClosed('nobody')).toBe('none')
  })

  it('a released profile frees its slot for another profile', async () => {
    const ctx = setup({ cap: 1 })
    ctx.liveWindows.set('P', 1).set('Q', 1)
    await ctx.connect('P')
    expect((await ctx.connect('Q')).kind).toBe('limit')
    ctx.liveWindows.set('P', 0)
    ctx.registry.noteWindowClosed('P')
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS)
    expect((await ctx.connect('Q')).kind).toBe('connected')
  })
})

describe('first-window guard — connected but no window was created', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('releases a connection no window ever attached to after 60 s', async () => {
    const { registry, created, released, connect } = setup()
    await connect('P') // loadProfileSnapshotDetailed: the window is created afterwards
    expect(registry.pendingRelease('P')).toBe('first-window')
    await vi.advanceTimersByTimeAsync(FIRST_WINDOW_GRACE_MS - 1)
    expect(registry.has('P')).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(registry.has('P')).toBe(false)
    expect(created[0].disconnects).toBe(1)
    expect(released).toEqual([['P', 'first-window']])
  })

  it('the first window\'s remote:connect reuse cancels the guard', async () => {
    const { registry, connect, liveWindows } = setup()
    await connect('P')
    liveWindows.set('P', 1)
    expect((await connect('P')).kind).toBe('reuse')
    expect(registry.pendingRelease('P')).toBeNull()
    await vi.advanceTimersByTimeAsync(FIRST_WINDOW_GRACE_MS)
    expect(registry.has('P')).toBe(true)
  })

  it('a window that exists at expiry keeps the connection even without a reuse', async () => {
    const { registry, connect, liveWindows } = setup()
    await connect('P')
    liveWindows.set('P', 1)
    await vi.advanceTimersByTimeAsync(FIRST_WINDOW_GRACE_MS)
    expect(registry.has('P')).toBe(true)
  })
})

describe('same target — two profiles, one server (T0459 Q3: allow + warn)', () => {
  it('reports the other profiles already connected to the same host:port:token', async () => {
    const { connect, liveWindows } = setup()
    liveWindows.set('P', 1).set('Q', 1).set('R', 1)
    const shared = { remoteHost: 'shared', remoteToken: 'tok' }
    await connect('P', okRun, shared)
    const q = await connect('Q', okRun, shared)
    const r = await connect('R')
    expect(q).toMatchObject({ kind: 'connected', sameTargetProfileIds: ['P'] })
    expect(r).toMatchObject({ kind: 'connected', sameTargetProfileIds: [] })
  })

  it('sameTargetProfiles looks the target up on demand', async () => {
    const { registry, connect, liveWindows } = setup()
    liveWindows.set('P', 1)
    await connect('P')
    expect(registry.sameTargetProfiles({ host: 'host-P', port: 9876, token: 'tok-P' })).toEqual(['P'])
    expect(registry.sameTargetProfiles({ host: 'host-P', port: 9876, token: 'tok-P' }, 'P')).toEqual([])
  })
})

describe('per-profile mutex', () => {
  it('serialises operations of one profile, in order, and survives a rejected one', async () => {
    const { registry } = setup()
    const order: string[] = []
    const gate = deferred()
    const first = registry.runExclusive('P', async () => { order.push('1-start'); await gate.promise; order.push('1-end') })
    const second = registry.runExclusive('P', async () => { order.push('2'); throw new Error('nope') })
    const third = registry.runExclusive('P', async () => { order.push('3'); return 3 })
    await Promise.resolve()
    await Promise.resolve()
    expect(order).toEqual(['1-start'])
    gate.resolve()
    await first
    await expect(second).rejects.toThrow('nope')
    await expect(third).resolves.toBe(3)
    expect(order).toEqual(['1-start', '1-end', '2', '3'])
  })

  it('does not block another profile', async () => {
    const { registry } = setup()
    const gate = deferred()
    const p = registry.runExclusive('P', () => gate.promise)
    await expect(registry.runExclusive('Q', async () => 'q')).resolves.toBe('q')
    gate.resolve()
    await p
  })

  it('two connects of one profile run one after the other (the second reuses)', async () => {
    const { connect, created, liveWindows } = setup()
    liveWindows.set('P', 1)
    const gate = deferred()
    let concurrent = 0
    let maxConcurrent = 0
    const run = async (client: FakeClient) => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await gate.promise
      concurrent--
      client.isConnected = true
      return { ok: true, fingerprint: PIN }
    }
    const a = connect('P', run)
    const b = connect('P', run)
    await Promise.resolve()
    gate.resolve()
    expect((await a).kind).toBe('connected')
    expect((await b).kind).toBe('reuse')
    expect(maxConcurrent).toBe(1)
    expect(created).toHaveLength(1)
  })

  it('handshakes of different profiles run in parallel', async () => {
    const { connect, liveWindows } = setup()
    liveWindows.set('P', 1).set('Q', 1)
    const started: string[] = []
    const gate = deferred()
    const run = async (client: FakeClient) => {
      started.push(client.profileId)
      await gate.promise
      client.isConnected = true
      return { ok: true, fingerprint: PIN }
    }
    const p = connect('P', run)
    const q = connect('Q', run)
    await vi.waitFor(() => expect(started.sort()).toEqual(['P', 'Q']))
    gate.resolve()
    await Promise.all([p, q])
  })
})

describe('drop / disconnectAll', () => {
  it('dropProfile disconnects and removes only that profile', async () => {
    const { registry, created, connect, liveWindows } = setup()
    liveWindows.set('P', 1).set('Q', 1)
    await connect('P')
    await connect('Q')
    await expect(registry.dropProfile('P')).resolves.toBe(true)
    await expect(registry.dropProfile('P')).resolves.toBe(false)
    expect(created[0].disconnects).toBe(1)
    expect(created[1].disconnects).toBe(0)
    expect(registry.profileIds()).toEqual(['Q'])
  })

  it('disconnectAll disconnects every client, clears pending releases, and gives up after the timeout', async () => {
    const { registry, created, connect, liveWindows } = setup()
    liveWindows.set('P', 1).set('Q', 1)
    await connect('P')
    await connect('Q')
    liveWindows.set('P', 0)
    registry.noteWindowClosed('P')
    created[1].disconnect = () => new Promise<void>(() => { /* hangs */ })
    const started = Date.now()
    await expect(registry.disconnectAll(30)).resolves.toBe(2)
    expect(Date.now() - started).toBeLessThan(1000)
    expect(created[0].disconnects).toBe(1)
    expect(registry.size).toBe(0)
    expect(registry.pendingRelease('P')).toBeNull()
  })
})
