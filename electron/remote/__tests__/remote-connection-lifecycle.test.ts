/**
 * T0464 (PLAN-039): main.ts lifecycle of the per-profile remote connections, with
 * the main-side pieces modelled the way main wires them:
 *
 * - live windows: `collectProfileWindows` over a `windowMap`, the window registry's
 *   cached entries and the detached windows (main `getWindowsForProfile`, also the
 *   registry's `countLiveWindows`)
 * - window `closed`: `windowMap.delete` then `noteAnyWindowClosed()` (main
 *   `noteRemoteWindowClosed`); minimize-to-tray only hides, the window stays
 * - quit: `disconnectAll(DISCONNECT_ALL_TIMEOUT_MS)` awaited through `settleWithin`
 *
 * main.ts itself needs electron, so the wiring is guarded in source by
 * electron/__tests__/remote-connect-plan.test.ts ("T0464 source guard").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collectProfileWindows,
  DISCONNECT_ALL_TIMEOUT_MS,
  FIRST_WINDOW_GRACE_MS,
  IDLE_GRACE_MS,
  MAX_CONCURRENT_REMOTE_PROFILES,
  RemoteConnectionRegistry,
  settleWithin,
  type RegistryClient,
} from '../remote-connection-registry'
import { describeSameTargetWarning, type RemoteConnectBoundProfile } from '../remote-connect-plan'
import { describeRemoteProfileFailure } from '../remote-profile-error'

const PIN = 'AB:CD:EF:01:23:45:67:89'

class FakeWindow {
  destroyed = false
  visible = true
  isDestroyed(): boolean { return this.destroyed }
  /** minimize-to-tray close: the window is hidden, not destroyed. */
  hide(): void { this.visible = false }
  show(): void { this.visible = true }
}

class FakeClient implements RegistryClient {
  isConnected = false
  isReconnecting = false
  disconnects = 0
  /** Set to make disconnect() wait (an ssh subprocess slow to exit). */
  hold: Promise<void> | null = null
  async disconnect(): Promise<void> {
    this.disconnects++
    if (this.hold) await this.hold
    this.isConnected = false
  }
}

const profileFor = (id: string, overrides: Partial<RemoteConnectBoundProfile> = {}): RemoteConnectBoundProfile => ({
  type: 'remote',
  remoteHost: `host-${id}`,
  remotePort: 9876,
  remoteToken: `tok-${id}`,
  remoteFingerprint: PIN,
  ...overrides,
})

/** A small model of main.ts: windowMap + window registry + detached windows + the registry. */
function mainModel() {
  const windowMap = new Map<string, FakeWindow>()
  const registryEntries: Array<{ id: string; profileId: string }> = []
  const detachedWindows = new Map<string, FakeWindow>()
  const detachedParentProfile = new Map<string, string>()
  const released: Array<{ profileId: string; reason: string }> = []
  const clients = new Map<string, FakeClient[]>()

  const getWindowsForProfile = (profileId: string | null) => collectProfileWindows({
    profileId,
    registryEntries,
    windows: windowMap,
    detachedWindows,
    detachedProfileId: (workspaceId) => detachedParentProfile.get(workspaceId) ?? null,
  })

  const registry = new RemoteConnectionRegistry<FakeClient>({
    createClient: (profileId) => {
      const client = new FakeClient()
      clients.set(profileId, [...(clients.get(profileId) ?? []), client])
      return client
    },
    countLiveWindows: (profileId) => getWindowsForProfile(profileId).length,
    onReleased: (profileId, reason) => released.push({ profileId, reason }),
  })

  let nextWindow = 0
  const model = {
    windowMap,
    registry,
    released,
    clients,
    getWindowsForProfile,
    /** loadProfileSnapshotDetailed / remote:connect: connect (or reuse) the profile's client. */
    connect(profileId: string, overrides: Partial<RemoteConnectBoundProfile> = {}) {
      const profile = profileFor(profileId, overrides)
      return registry.connect({
        profileId,
        profile,
        request: { host: profile.remoteHost!, port: profile.remotePort!, token: profile.remoteToken! },
        run: async (client) => {
          client.isConnected = true
          return { ok: true, fingerprint: PIN }
        },
      })
    },
    openWindow(profileId: string): string {
      const id = `win-${++nextWindow}`
      registryEntries.push({ id, profileId })
      windowMap.set(id, new FakeWindow())
      return id
    },
    /** win.on('closed'): windowMap.delete, then noteRemoteWindowClosed (registry entry may already be gone). */
    closeWindow(id: string) {
      const win = windowMap.get(id)!
      win.destroyed = true
      windowMap.delete(id)
      const at = registryEntries.findIndex(e => e.id === id)
      if (at !== -1) registryEntries.splice(at, 1)
      return registry.noteAnyWindowClosed()
    },
    detach(workspaceId: string, parentProfileId: string) {
      detachedWindows.set(workspaceId, new FakeWindow())
      detachedParentProfile.set(workspaceId, parentProfileId)
    },
    closeDetached(workspaceId: string) {
      detachedWindows.get(workspaceId)!.destroyed = true
      detachedWindows.delete(workspaceId)
      detachedParentProfile.delete(workspaceId)
      return registry.noteAnyWindowClosed()
    },
  }
  return model
}

/** Lets the registry's per-profile mutex chains run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('collectProfileWindows (main getWindowsForProfile)', () => {
  it('matches registry windows by profile and detached windows by their parent binding', () => {
    const win1 = new FakeWindow()
    const win2 = new FakeWindow()
    const detached = new FakeWindow()
    const wins = collectProfileWindows({
      profileId: 'P',
      registryEntries: [{ id: 'w1', profileId: 'P' }, { id: 'w2', profileId: 'Q' }],
      windows: [['w1', win1], ['w2', win2]],
      // A detached window is keyed by workspaceId — never matched against registry ids.
      detachedWindows: [['w1', detached]],
      detachedProfileId: (workspaceId) => (workspaceId === 'w1' ? 'P' : null),
    })
    expect(wins).toEqual([win1, detached])
  })

  it('leaves out destroyed windows but keeps windows hidden to the tray', () => {
    const hidden = new FakeWindow()
    hidden.hide()
    const destroyed = new FakeWindow()
    destroyed.destroyed = true
    const wins = collectProfileWindows({
      profileId: 'P',
      registryEntries: [{ id: 'a', profileId: 'P' }, { id: 'b', profileId: 'P' }],
      windows: new Map([['a', hidden], ['b', destroyed]]),
      detachedWindows: [],
      detachedProfileId: () => null,
    })
    expect(wins).toEqual([hidden])
  })

  it('has no windows for a null profile', () => {
    expect(collectProfileWindows({
      profileId: null,
      registryEntries: [{ id: 'a', profileId: 'P' }],
      windows: [['a', new FakeWindow()]],
      detachedWindows: [],
      detachedProfileId: () => null,
    })).toEqual([])
  })
})

describe('remote connection lifecycle (main model)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('closing the last window releases the connection after the grace; other profiles stay', async () => {
    const main = mainModel()
    const p = main.openWindow('P')
    main.openWindow('Q')
    expect((await main.connect('P')).kind).toBe('connected')
    expect((await main.connect('Q')).kind).toBe('connected')

    expect(main.closeWindow(p).get('P')).toBe('scheduled')
    expect(main.registry.pendingRelease('Q')).toBeNull()

    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS - 1)
    expect(main.registry.has('P')).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(main.registry.has('P')).toBe(false)
    expect(main.clients.get('P')![0].disconnects).toBe(1)
    expect(main.released).toEqual([{ profileId: 'P', reason: 'idle' }])
    expect(main.registry.isProfileLive('Q')).toBe(true)
  })

  it('reopening a window within the grace reuses the client and cancels the release', async () => {
    const main = mainModel()
    const first = main.openWindow('P')
    await main.connect('P')
    main.closeWindow(first)
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS / 2)

    main.openWindow('P')
    const again = await main.connect('P')
    expect(again.kind).toBe('reuse')
    expect(main.registry.pendingRelease('P')).toBeNull()
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS * 2)
    await flush()
    expect(main.registry.isProfileLive('P')).toBe(true)
    expect(main.clients.get('P')).toHaveLength(1)
    expect(main.clients.get('P')![0].disconnects).toBe(0)
  })

  it('counts again at expiry: a window opened without a connect still keeps the profile', async () => {
    const main = mainModel()
    const first = main.openWindow('P')
    await main.connect('P')
    main.closeWindow(first)
    main.openWindow('P') // e.g. a window restored before its renderer calls remote:connect
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS)
    await flush()
    expect(main.registry.isProfileLive('P')).toBe(true)
    expect(main.released).toEqual([])
  })

  it('a window hidden to the tray keeps its profile live — hiding never starts a release', async () => {
    const main = mainModel()
    const id = main.openWindow('P')
    await main.connect('P')
    main.windowMap.get(id)!.hide() // minimize-to-tray close handler: win.hide(), no 'closed' event
    expect(main.getWindowsForProfile('P')).toHaveLength(1)
    // Another window closing (any profile) re-checks P: still live, nothing scheduled.
    const other = main.openWindow('local')
    expect(main.closeWindow(other).get('P')).toBe('kept')
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS * 4)
    await flush()
    expect(main.registry.isProfileLive('P')).toBe(true)
    expect(main.registry.pendingRelease('P')).toBeNull()
  })

  it('a detached window of the profile keeps it live; closing it last starts the grace', async () => {
    const main = mainModel()
    const parent = main.openWindow('P')
    main.detach('ws-1', 'P')
    await main.connect('P')
    expect(main.closeWindow(parent).get('P')).toBe('kept')
    expect(main.closeDetached('ws-1').get('P')).toBe('scheduled')
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS)
    await flush()
    expect(main.registry.has('P')).toBe(false)
  })

  it('a connection made before its window exists keeps FIRST_WINDOW_GRACE_MS even when an unrelated window closes', async () => {
    const main = mainModel()
    // loadProfileSnapshotDetailed connects first, the window is created afterwards.
    await main.connect('P')
    expect(main.registry.pendingRelease('P')).toBe('first-window')
    const unrelated = main.openWindow('local')
    expect(main.closeWindow(unrelated).get('P')).toBe('scheduled')
    expect(main.registry.pendingRelease('P')).toBe('first-window')
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS)
    await flush()
    expect(main.registry.isProfileLive('P')).toBe(true)
    // No window ever showed up: released at the first-window guard.
    await vi.advanceTimersByTimeAsync(FIRST_WINDOW_GRACE_MS - IDLE_GRACE_MS)
    await flush()
    expect(main.registry.has('P')).toBe(false)
    expect(main.released).toEqual([{ profileId: 'P', reason: 'first-window' }])
  })

  it('a first window that shows up in time keeps the connection (counted again at expiry)', async () => {
    const main = mainModel()
    await main.connect('P')
    main.openWindow('P')
    await vi.advanceTimersByTimeAsync(FIRST_WINDOW_GRACE_MS)
    await flush()
    expect(main.registry.isProfileLive('P')).toBe(true)
    expect(main.released).toEqual([])
  })

  it('refuses the 9th remote profile without pushing an existing connection out', async () => {
    const main = mainModel()
    for (let i = 0; i < MAX_CONCURRENT_REMOTE_PROFILES; i++) {
      main.openWindow(`P${i}`)
      expect((await main.connect(`P${i}`)).kind).toBe('connected')
    }
    main.openWindow('P9')
    const ninth = await main.connect('P9')
    expect(ninth).toEqual({ kind: 'limit', cap: MAX_CONCURRENT_REMOTE_PROFILES })
    expect(main.clients.has('P9')).toBe(false)
    for (let i = 0; i < MAX_CONCURRENT_REMOTE_PROFILES; i++) {
      expect(main.registry.isProfileLive(`P${i}`)).toBe(true)
      expect(main.clients.get(`P${i}`)![0].disconnects).toBe(0)
    }

    // What the user sees: main's limit dialog (localized), not "unreachable".
    const dialog = describeRemoteProfileFailure(
      { reason: 'limit', host: 'host-P9', port: 9876, label: 'P9', limit: ninth.kind === 'limit' ? ninth.cap : undefined },
      { lang: 'zh-TW', idleGraceMs: IDLE_GRACE_MS },
    )
    expect(dialog.title).toBe('遠端配置已達上限')
    expect(dialog.message).toContain('P9')
    expect(dialog.detail).toContain(`${MAX_CONCURRENT_REMOTE_PROFILES} 個遠端配置`)
    expect(dialog.detail).toContain('15 秒')

    // Once a profile's last window closed and its grace ran out, the slot is free again.
    main.closeWindow([...main.windowMap.keys()][0])
    await vi.advanceTimersByTimeAsync(IDLE_GRACE_MS)
    await flush()
    expect((await main.connect('P9')).kind).toBe('connected')
  })

  it('allows two profiles on one server and reports them for the warn log', async () => {
    const main = mainModel()
    main.openWindow('P')
    main.openWindow('Q')
    const shared = { remoteHost: 'shared', remotePort: 9876, remoteToken: 'same-token' }
    await main.connect('P', shared)
    const q = await main.connect('Q', shared)
    expect(q.kind).toBe('connected')
    if (q.kind !== 'connected') return
    expect(q.sameTargetProfileIds).toEqual(['P'])
    const warning = describeSameTargetWarning('Q', q.target, q.sameTargetProfileIds)
    expect(warning).toContain('shared:9876')
    expect(warning).not.toContain('same-token')
    expect(main.registry.isProfileLive('P')).toBe(true)
  })
})

describe('quit waits for every remote client (main cleanupAllProcesses)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('resolves once every client disconnected (Promise.allSettled), also when one throws', async () => {
    const main = mainModel()
    for (const id of ['P', 'Q', 'R']) {
      main.openWindow(id)
      await main.connect(id)
    }
    let releaseQ!: () => void
    const q = main.clients.get('Q')![0]
    q.hold = new Promise<void>(resolve => { releaseQ = resolve })
    main.clients.get('R')![0].disconnect = async () => { throw new Error('ssh already gone') }

    let done = false
    const quit = settleWithin([main.registry.disconnectAll(DISCONNECT_ALL_TIMEOUT_MS)], DISCONNECT_ALL_TIMEOUT_MS).then((settled) => { done = true; return settled })
    await vi.advanceTimersByTimeAsync(500)
    expect(done).toBe(false)
    releaseQ()
    await vi.advanceTimersByTimeAsync(0)
    expect(await quit).toBe(true)
    expect(main.registry.size).toBe(0)
    expect(main.clients.get('P')![0].disconnects).toBe(1)
    expect(q.disconnects).toBe(1)
  })

  it('stops waiting after DISCONNECT_ALL_TIMEOUT_MS when an ssh subprocess hangs', async () => {
    const main = mainModel()
    main.openWindow('P')
    await main.connect('P')
    main.clients.get('P')![0].hold = new Promise<void>(() => { /* never exits */ })

    let settled: boolean | null = null
    const wizardTunnels = Promise.resolve()
    const quit = settleWithin([wizardTunnels, main.registry.disconnectAll(DISCONNECT_ALL_TIMEOUT_MS)], DISCONNECT_ALL_TIMEOUT_MS)
      .then((value) => { settled = value })
    await vi.advanceTimersByTimeAsync(DISCONNECT_ALL_TIMEOUT_MS - 1)
    expect(settled).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    await quit
    // disconnectAll gave up at its own cap first, so the outer wait saw it settle.
    expect(settled).toBe(true)
    expect(main.registry.size).toBe(0)
  })
})

describe('settleWithin', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('resolves true when all settle in time, rejections included', async () => {
    await expect(settleWithin([Promise.resolve(1), Promise.reject(new Error('x'))], 100)).resolves.toBe(true)
  })

  it('resolves false at the timeout and never rejects', async () => {
    const result = settleWithin([new Promise(() => { /* hangs */ })], 2_000)
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(result).resolves.toBe(false)
  })

  it('resolves true right away for nothing to wait on', async () => {
    await expect(settleWithin([], 2_000)).resolves.toBe(true)
  })
})
