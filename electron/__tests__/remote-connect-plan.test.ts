/**
 * T0419 (BUG-096): the renderer's initProfile `remote:connect` used to build a
 * fresh client without a fingerprint (TOFU accepts any cert) and replace the
 * client main had already connected with the profile's pinned fingerprint.
 *
 * T0463 (PLAN-039): main.ts keeps one connection per remote profile
 * (`RemoteConnectionRegistry`); the T0430 / T0442 / T0443 wiring guards below
 * were migrated from the single module-level slot.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BINDING_MISSING_ERROR,
  LEGACY_PROFILE_ERROR,
  REMOTE_NOT_CONNECTED,
  computeProfileWindowStatus,
  findSameTargetProfiles,
  planConnectionAdmission,
  planIdleRelease,
  planProfileProxiedInvokeRoute,
  planProfileRemoteConnect,
  planProfileStatusPushes,
  shouldDropProfileConnectionOnUpdate,
  type RemoteProfileConnState,
  formatRemoteNotConnectedError,
  isRemoteFingerprintChange,
  settleRemoteConnect,
  planRemoteConnect,
  type RemoteConnectBoundProfile,
  type RemoteConnectCurrent,
} from '../remote/remote-connect-plan'
import { REMOTE_NOT_CONNECTED as RENDERER_REMOTE_NOT_CONNECTED, isRemoteNotConnectedError } from '../../src/lib/remote-not-connected'

const PIN = 'AB:CD:EF:01:23:45:67:89'
const OTHER = '11:22:33:44:55:66:77:88'

const profile: RemoteConnectBoundProfile = {
  type: 'remote',
  remoteHost: 'localhost',
  remotePort: 9877,
  remoteToken: 'tok',
  remoteFingerprint: PIN,
}

const request = { host: 'localhost', port: 9877, token: 'tok' }

const verified: RemoteConnectCurrent = {
  profileId: 'p1',
  isConnected: true,
  target: { host: 'localhost', port: 9877, token: 'tok', fingerprint: PIN },
}

describe('planRemoteConnect — reuse the verified client', () => {
  it('reuses the client loadProfileSnapshotDetailed connected for the same profile + target', () => {
    expect(planRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, current: verified }))
      .toEqual({ kind: 'reuse', fingerprint: PIN })
  })

  it('reuses when the renderer also passes the pinned fingerprint (any case / separators)', () => {
    const fingerprint = PIN.replace(/:/g, '').toLowerCase()
    expect(planRemoteConnect({ request: { ...request, fingerprint }, boundProfileId: 'p1', boundProfile: profile, current: verified }).kind)
      .toBe('reuse')
  })

  it('reconnects (pinned) when the existing client is not connected', () => {
    expect(planRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, current: { ...verified, isConnected: false } }))
      .toEqual({ kind: 'connect', expectedFingerprint: PIN })
  })

  it('reconnects (pinned) when the existing client belongs to another profile', () => {
    expect(planRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, current: { ...verified, profileId: 'p2' } }))
      .toEqual({ kind: 'connect', expectedFingerprint: PIN })
  })

  it('reconnects (pinned) when the existing client targets another token or port', () => {
    const otherToken = { ...verified, target: { ...verified.target!, token: 'old' } }
    const otherPort = { ...verified, target: { ...verified.target!, port: 9876 } }
    expect(planRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, current: otherToken }).kind).toBe('connect')
    expect(planRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, current: otherPort }).kind).toBe('connect')
  })

  it('reconnects (pinned) when the existing client observed a different fingerprint', () => {
    const unpinned = { ...verified, target: { ...verified.target!, fingerprint: OTHER } }
    expect(planRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, current: unpinned }))
      .toEqual({ kind: 'connect', expectedFingerprint: PIN })
  })

  it('reconnects (pinned) when there is no current client or no recorded target', () => {
    expect(planRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, current: null }))
      .toEqual({ kind: 'connect', expectedFingerprint: PIN })
    expect(planRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, current: { ...verified, target: null } }).kind)
      .toBe('connect')
  })

  it('uses the default port 9876 when the profile has none', () => {
    const noPort = { ...profile, remotePort: undefined }
    const current = { ...verified, target: { ...verified.target!, port: 9876 } }
    expect(planRemoteConnect({ request: { ...request, port: 9876 }, boundProfileId: 'p1', boundProfile: noPort, current }).kind)
      .toBe('reuse')
  })
})

describe('planRemoteConnect — pinning', () => {
  it('never connects a remote-bound window without a fingerprint (no TOFU replacement)', () => {
    const plan = planRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, current: null })
    expect(plan.kind).toBe('connect')
    expect(plan.kind === 'connect' && plan.expectedFingerprint).toBe(PIN)
  })

  it('rejects a renderer fingerprint that disagrees with the pin', () => {
    expect(planRemoteConnect({ request: { ...request, fingerprint: OTHER }, boundProfileId: 'p1', boundProfile: profile, current: verified }))
      .toMatchObject({ kind: 'reject', errorCode: 'fingerprint-mismatch' })
  })

  it('rejects a legacy remote profile without remoteFingerprint (same rule as loadProfileSnapshotDetailed)', () => {
    const legacy = { ...profile, remoteFingerprint: undefined }
    expect(planRemoteConnect({ request, boundProfileId: 'p1', boundProfile: legacy, current: null }))
      .toEqual({ kind: 'reject', error: LEGACY_PROFILE_ERROR, errorCode: 'fingerprint-missing' })
    // a renderer-supplied fingerprint does not stand in for the missing pin
    expect(planRemoteConnect({ request: { ...request, fingerprint: OTHER }, boundProfileId: 'p1', boundProfile: legacy, current: null }).kind)
      .toBe('reject')
  })

  it('a remote-bound window asking for another target needs its own fingerprint', () => {
    const elsewhere = { host: '10.0.0.5', port: 9876, token: 'x' }
    expect(planRemoteConnect({ request: elsewhere, boundProfileId: 'p1', boundProfile: profile, current: verified }))
      .toMatchObject({ kind: 'reject', errorCode: 'fingerprint-missing' })
    expect(planRemoteConnect({ request: { ...elsewhere, fingerprint: OTHER }, boundProfileId: 'p1', boundProfile: profile, current: verified }))
      .toEqual({ kind: 'connect', expectedFingerprint: OTHER })
  })
})

describe('planRemoteConnect — windows not bound to a remote profile keep the old behaviour', () => {
  it('passes the renderer fingerprint through, TOFU when absent', () => {
    expect(planRemoteConnect({ request, boundProfileId: null, boundProfile: null, current: verified }))
      .toEqual({ kind: 'connect', expectedFingerprint: undefined })
    expect(planRemoteConnect({ request: { ...request, fingerprint: PIN }, boundProfileId: 'local', boundProfile: { type: 'local' }, current: null }))
      .toEqual({ kind: 'connect', expectedFingerprint: PIN })
  })

  it('does not reuse without a bound profile', () => {
    const unbound = { ...verified, profileId: null }
    expect(planRemoteConnect({ request: { ...request, fingerprint: PIN }, boundProfileId: null, boundProfile: null, current: unbound }).kind)
      .toBe('connect')
  })
})

// T0430: a failed `connect` used to null the slot without disconnecting the
// previous client, leaving it connected / auto-reconnecting with no reference.
interface FakeClient { name: string }
const oldClient: FakeClient = { name: 'old' }
const candidate: FakeClient = { name: 'candidate' }

/** No client may be dropped: each one is either still in the slot or disposed. */
function expectNoOrphans(
  before: { client: FakeClient | null },
  cand: FakeClient | null,
  out: { slot: { client: FakeClient | null }; dispose: FakeClient[] },
) {
  for (const c of [before.client, cand]) {
    if (!c) continue
    expect(out.slot.client === c || out.dispose.includes(c)).toBe(true)
  }
  if (out.slot.client) expect(out.dispose).not.toContain(out.slot.client)
}

describe('settleRemoteConnect — slot swaps only on success (T0430)', () => {
  const slot = { client: oldClient, profileId: 'q' }

  it('failed connect keeps the current client and its profile, disposes the candidate', () => {
    const out = settleRemoteConnect({ slot, candidate, candidateProfileId: 'p1', ok: false })
    expect(out.slot).toEqual({ client: oldClient, profileId: 'q' })
    expect(out.dispose).toEqual([candidate])
    expectNoOrphans(slot, candidate, out)
  })

  it('failed connect with an empty slot still disposes the candidate', () => {
    const empty = { client: null, profileId: null }
    const out = settleRemoteConnect({ slot: empty, candidate, candidateProfileId: 'p1', ok: false })
    expect(out.slot).toEqual(empty)
    expect(out.dispose).toEqual([candidate])
  })

  it('a throw before the candidate exists changes nothing', () => {
    const out = settleRemoteConnect<FakeClient>({ slot, candidate: null, candidateProfileId: null, ok: false })
    expect(out).toEqual({ slot, dispose: [] })
  })

  it('successful connect installs the candidate and disposes the previous client', () => {
    const out = settleRemoteConnect({ slot, candidate, candidateProfileId: 'p1', ok: true })
    expect(out.slot).toEqual({ client: candidate, profileId: 'p1' })
    expect(out.dispose).toEqual([oldClient])
    expectNoOrphans(slot, candidate, out)
  })

  it('successful connect into an empty slot disposes nothing', () => {
    const out = settleRemoteConnect({ slot: { client: null, profileId: null }, candidate, candidateProfileId: 'p1', ok: true })
    expect(out).toEqual({ slot: { client: candidate, profileId: 'p1' }, dispose: [] })
  })
})

/** T0463 (PLAN-039): main.ts source, for the wiring guards below. */
const mainSrc = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')
function mainSection(from: string, to: string): string {
  const at = mainSrc.indexOf(from)
  expect(at, from).toBeGreaterThan(-1)
  const end = mainSrc.indexOf(to, at)
  expect(end, to).toBeGreaterThan(at)
  return mainSrc.slice(at, end)
}

describe('main.ts holds one connection per remote profile (T0463 source guard)', () => {
  it('has no module-level single client slot left', () => {
    expect(mainSrc).not.toMatch(/^let remoteClient\b/m)
    expect(mainSrc).not.toMatch(/\bremoteClientProfileId\b/)
    expect(mainSrc).not.toMatch(/\bremoteOpMutex\b/)
    expect(mainSrc).not.toMatch(/\bremoteClientTargets\b/)
    expect(mainSrc).not.toMatch(/\bcurrentRemoteSlot\b/)
    expect(mainSrc).toMatch(/^const remoteConnections = new RemoteConnectionRegistry<RemoteClient, ProfileEntry>\(\{/m)
  })

  it('every profile client is built by the registry factory, events scoped to the registry key', () => {
    const constructions = mainSrc.match(/new RemoteClient\([^\n]*/g) ?? []
    const profileClients = constructions.filter(c => !c.startsWith('new RemoteClient(() => []'))
    expect(profileClients).toEqual([
      'new RemoteClient(() => getWindowsForProfile(profileId), profile), profileId),',
    ])
    expect(mainSrc).toMatch(/createClient: \(profileId, profile\) => bindRemoteClient\(new RemoteClient\(\(\) => getWindowsForProfile\(profileId\), profile\), profileId\)/)
  })

  it('app quit tears down every profile\'s client', () => {
    const cleanup = mainSection('function cleanupAllProcesses()', '// Handle launch arguments')
    expect(cleanup).toMatch(/remoteConnections\.disconnectAll\(\)/)
  })

  it('a closed registry / detached window lets the registry release profiles left without a window', () => {
    const closed = mainSection("win.on('closed', () => {", '// Rebuild tray menu after window title is available')
    expect(closed.indexOf('noteRemoteWindowClosed()')).toBeGreaterThan(closed.indexOf('windowMap.delete(windowId)'))
    const detach = mainSection("ipcMain.handle('workspace:detach'", "ipcMain.handle('workspace:reattach'")
    const detachedClosed = detach.slice(detach.indexOf("detachedWin.on('closed'"))
    expect(detachedClosed.indexOf('noteRemoteWindowClosed()')).toBeGreaterThan(detachedClosed.indexOf('detachedWindows.delete(workspaceId)'))
    const note = mainSection('function noteRemoteWindowClosed()', '/** T0463: the profile\'s own client')
    expect(note).toMatch(/for \(const profileId of remoteConnections\.profileIds\(\)\) remoteConnections\.noteWindowClosed\(profileId\)/)
  })
})

describe('remote:connect handler wiring (T0430 / T0463 source guard)', () => {
  const handler = mainSection("ipcMain.handle('remote:connect'", "ipcMain.handle('remote:disconnect'")

  it('connects through the registry keyed by the sender\'s bound profile', () => {
    expect(handler).toMatch(/remoteConnections\.connect\(\{\s*profileId: boundProfileId,\s*profile: boundProfile,\s*request: \{ host, port, token, fingerprint \},/)
    expect(handler).toMatch(/run: \(client, expectedFingerprint\) => client\.connect\(host, port, token, label, expectedFingerprint\)/)
    expect(handler).not.toMatch(/new RemoteClient\(/)
    expect(handler).not.toMatch(/remoteClient\s*=/)
  })

  it('a refused, capped or failed connect returns an error and never reports connected', () => {
    const between = (from: string, to: string) => handler.slice(handler.indexOf(from), handler.indexOf(to))
    expect(between("case 'reject':", "case 'limit':")).toMatch(/return \{ error: outcome\.error, errorCode: outcome\.errorCode \}/)
    expect(between("case 'limit':", "case 'aborted':")).toMatch(/return \{ error: [^\n]*errorCode: 'remote-limit' \}/)
    expect(between("case 'failed':", "case 'reuse':")).toMatch(/return \{ error: outcome\.result\.error/)
    expect(handler.match(/connected: true/g) ?? []).toHaveLength(2)
  })
})

describe('loadProfileSnapshotDetailed wiring (T0442 / T0463 source guard)', () => {
  const fn = mainSection('async function loadProfileSnapshotDetailed(', 'function showRemoteProfileFailureDialog(')

  it('connects through the profile\'s own registry entry; the registry decides reuse first', () => {
    expect(fn).toMatch(/remoteConnections\.connect\(\{\s*profileId,\s*profile: profileEntry,\s*request: \{ host, port, token \},/)
    expect(fn).not.toMatch(/new RemoteClient\(/)
    expect(fn).toMatch(/case 'reuse':/)
  })

  it('every failure outcome (refused, cap, aborted, failed, threw) returns remote-unreachable before any snapshot fetch', () => {
    const fetch = fn.indexOf("client.invoke('profile:load-snapshot'")
    expect(fetch).toBeGreaterThan(-1)
    for (const kind of ['threw', 'reject', 'limit', 'aborted', 'failed']) {
      const at = fn.indexOf(`case '${kind}':`)
      expect(at, kind).toBeGreaterThan(-1)
      expect(at, kind).toBeLessThan(fetch)
      expect(fn.slice(at, fn.indexOf('case ', at + 6)), kind).toMatch(/return \{ kind: 'remote-unreachable'/)
    }
  })
})

describe('isRemoteFingerprintChange (T0442)', () => {
  it('an update without remoteFingerprint is not a change', () => {
    expect(isRemoteFingerprintChange(PIN, undefined)).toBe(false)
  })

  it('ignores case and separators', () => {
    expect(isRemoteFingerprintChange(PIN, PIN.toLowerCase().replace(/:/g, ''))).toBe(false)
  })

  it('a different pin, or clearing / first-setting it, is a change', () => {
    expect(isRemoteFingerprintChange(PIN, OTHER)).toBe(true)
    expect(isRemoteFingerprintChange(PIN, '')).toBe(true)
    expect(isRemoteFingerprintChange(undefined, PIN)).toBe(true)
  })
})

describe('profile:update handler wiring (T0442 / T0463 source guard)', () => {
  const handler = mainSection("ipcMain.handle('profile:update'", "ipcMain.handle('profile:get'")

  it('reads the old pin before updating and drops only that profile\'s entry, behind shouldDropProfileConnectionOnUpdate', () => {
    expect(handler.indexOf('previousFingerprint =')).toBeLessThan(handler.indexOf('profileManager.update('))
    const guard = handler.indexOf('shouldDropProfileConnectionOnUpdate(')
    expect(guard).toBeGreaterThan(-1)
    expect(handler).toMatch(/hasConnection: remoteConnections\.has\(profileId\)/)
    expect(handler.indexOf('await remoteConnections.dropProfile(profileId)')).toBeGreaterThan(guard)
    expect(handler).not.toMatch(/disconnectAll/)
  })
})

describe('remote:disconnect handler wiring (T0463: sender-scoped)', () => {
  const handler = mainSection("ipcMain.handle('remote:disconnect'", "ipcMain.handle('remote:client-status'")

  it('drops only the sender\'s own profile connection', () => {
    expect(handler).toMatch(/senderBindingProfileId\(await getSenderProfileBinding\(event\.sender\)\)/)
    expect(handler).toMatch(/if \(!profileId\) return true/)
    expect(handler).toMatch(/await remoteConnections\.dropProfile\(profileId\)/)
    expect(handler).not.toMatch(/disconnectAll|profileIds\(\)/)
  })
})

// ── T0443 (BUG-110): remote-window fail-closed routing, per profile (T0463) ──

const CONNECTED: RemoteProfileConnState = { isConnected: true, isReconnecting: false }
const RECONNECTING: RemoteProfileConnState = { isConnected: false, isReconnecting: true }
const GAVE_UP: RemoteProfileConnState = { isConnected: false, isReconnecting: false }

describe('planProfileProxiedInvokeRoute (T0443 routing matrix, T0463 per profile)', () => {
  const cases: Array<{ name: string; senderIsRemote: boolean; senderProfileId: string | null; conn: RemoteProfileConnState | null; expected: string; reason?: string }> = [
    // local window (or no profile binding): always local, whatever any connection does
    { name: 'local window, no connection', senderIsRemote: false, senderProfileId: 'local-1', conn: null, expected: 'local' },
    { name: 'local window, a connection is up', senderIsRemote: false, senderProfileId: 'local-1', conn: CONNECTED, expected: 'local' },
    { name: 'local window, a connection is reconnecting', senderIsRemote: false, senderProfileId: 'local-1', conn: RECONNECTING, expected: 'local' },
    { name: 'window without a registry entry', senderIsRemote: false, senderProfileId: null, conn: CONNECTED, expected: 'local' },
    // remote window: its own profile's entry only
    { name: 'remote window, own connection connected', senderIsRemote: true, senderProfileId: 'remote-P', conn: CONNECTED, expected: 'remote' },
    { name: 'remote window, own connection reconnecting', senderIsRemote: true, senderProfileId: 'remote-P', conn: RECONNECTING, expected: 'refuse', reason: 'reconnecting' },
    { name: 'remote window, own connection gave up', senderIsRemote: true, senderProfileId: 'remote-P', conn: GAVE_UP, expected: 'refuse', reason: 'disconnected' },
    { name: 'remote window, no own connection (pin change / remote:disconnect / released)', senderIsRemote: true, senderProfileId: 'remote-P', conn: null, expected: 'refuse', reason: 'no-client' },
  ]

  for (const c of cases) {
    it(c.name, () => {
      const route = planProfileProxiedInvokeRoute({ senderIsRemote: c.senderIsRemote, senderProfileId: c.senderProfileId, conn: c.conn })
      expect(route.kind).toBe(c.expected)
      if (route.kind === 'refuse') {
        expect(route).toEqual({ kind: 'refuse', errorCode: REMOTE_NOT_CONNECTED, profileId: c.senderProfileId, reason: c.reason })
      }
    })
  }

  it('a remote window is never routed local, for any state of its own connection', () => {
    for (const conn of [null, CONNECTED, RECONNECTING, GAVE_UP]) {
      expect(planProfileProxiedInvokeRoute({ senderIsRemote: true, senderProfileId: 'remote-P', conn }).kind).not.toBe('local')
    }
  })

  it('another profile\'s connection never serves the window: P without an entry is refused while Q is connected', () => {
    const entries = new Map<string, RemoteProfileConnState>([['remote-Q', CONNECTED]])
    const route = (profileId: string) => planProfileProxiedInvokeRoute({ senderIsRemote: true, senderProfileId: profileId, conn: entries.get(profileId) ?? null })
    expect(route('remote-Q')).toEqual({ kind: 'remote' })
    expect(route('remote-P')).toEqual({ kind: 'refuse', errorCode: REMOTE_NOT_CONNECTED, profileId: 'remote-P', reason: 'no-client' })
  })
})

describe('REMOTE_NOT_CONNECTED error (T0443)', () => {
  it('leads the message, survives Electron IPC wrapping, and matches the renderer constant', () => {
    const message = formatRemoteNotConnectedError('pty:create', 'remote-P', 'no-client')
    expect(message.startsWith(`${REMOTE_NOT_CONNECTED}:`)).toBe(true)
    expect(message).toContain('remote-P')
    expect(message).toContain('pty:create')
    expect(RENDERER_REMOTE_NOT_CONNECTED).toBe(REMOTE_NOT_CONNECTED)
    // ipcRenderer.invoke rejects with "Error invoking remote method '<ch>': Error: <message>"
    expect(isRemoteNotConnectedError(new Error(`Error invoking remote method 'pty:create': Error: ${message}`))).toBe(true)
  })
})

describe('planProfileStatusPushes (T0443 push targets, T0463 per profile)', () => {
  it('opening Q never changes P: only Q is pushed', () => {
    const entries = new Map<string, RemoteProfileConnState>([['remote-P', CONNECTED]])
    const last = new Map<string, string>()
    planProfileStatusPushes(['remote-P'], id => entries.get(id) ?? null, last)
    entries.set('remote-Q', CONNECTED)
    expect(planProfileStatusPushes(['remote-P', 'remote-Q'], id => entries.get(id) ?? null, last))
      .toEqual([{ profileId: 'remote-Q', connected: true, state: 'connected', reason: null }])
  })

  it('pin change / remote:disconnect drops the entry: that profile is pushed no-client', () => {
    const last = new Map<string, string>([['remote-P', 'connected:']])
    expect(planProfileStatusPushes(['remote-P'], () => null, last))
      .toEqual([{ profileId: 'remote-P', connected: false, state: 'disconnected', reason: 'no-client' }])
  })

  it('pushes only on change; a failed connect for Q leaves P quiet', () => {
    const entries = new Map<string, RemoteProfileConnState>([['remote-P', CONNECTED]])
    const get = (id: string) => entries.get(id) ?? null
    const last = new Map<string, string>()
    expect(planProfileStatusPushes(['remote-P'], get, last)).toHaveLength(1)
    // socket dropped → reconnecting → connected again
    entries.set('remote-P', RECONNECTING)
    expect(planProfileStatusPushes(['remote-P'], get, last).map(s => s.state)).toEqual(['reconnecting'])
    entries.set('remote-P', CONNECTED)
    expect(planProfileStatusPushes(['remote-P'], get, last).map(s => s.state)).toEqual(['connected'])
    // a failed connect for Q (no entry left) — P unchanged and quiet, Q told no-client
    expect(planProfileStatusPushes(['remote-P', 'remote-Q'], get, last))
      .toEqual([{ profileId: 'remote-Q', connected: false, state: 'disconnected', reason: 'no-client' }])
  })
})

describe('bindProxiedHandlersToIpc wiring (T0443 / T0463 source guard)', () => {
  const fn = mainSection('function bindProxiedHandlersToIpc()', '// ── Renderer debug log')

  it('keeps the ALWAYS_LOCAL short-circuit ahead of any routing', () => {
    const shortCircuit = fn.indexOf('if (ALWAYS_LOCAL_CHANNELS.has(channel))')
    expect(shortCircuit).toBeGreaterThan(-1)
    expect(fn.slice(shortCircuit, fn.indexOf('}', shortCircuit))).toMatch(/return invokeHandler\(channel, args, windowId\)/)
    expect(shortCircuit).toBeLessThan(fn.indexOf('planProfileProxiedInvokeRoute('))
  })

  it('routes on the sender profile\'s own entry; the local handler runs only for the local route', () => {
    expect(fn).toMatch(/const conn = senderProfileId \? remoteConnections\.connectionState\(senderProfileId\) : null/)
    expect(fn).toMatch(/planProfileProxiedInvokeRoute\(\{ senderIsRemote, senderProfileId, conn \}\)/)
    const afterRoute = fn.slice(fn.indexOf('planProfileProxiedInvokeRoute('))
    expect(afterRoute.match(/invokeHandler\(/g) ?? []).toHaveLength(1)
    expect(afterRoute).toMatch(/if \(route\.kind === 'local'\) return invokeHandler\(/)
    // the remote exit is the sender profile's own live client
    expect(afterRoute).toMatch(/const senderClient = route\.kind === 'remote' \? liveRemoteClient\(senderProfileId\) : null\s+if \(senderClient\) return senderClient\.invoke\(channel, args\)/)
    // anything that is neither local nor a live remote is refused with the code
    expect(afterRoute).toMatch(/throw Object\.assign\(new Error\(formatRemoteNotConnectedError\(/)
    expect(afterRoute).toMatch(/REMOTE_INVOKE_REFUSED_CHANNEL/)
  })
})

describe('remote status push wiring (T0443 / T0463 source guard)', () => {
  it('every registry change pushes the status of the profile it concerns', () => {
    const snapshot = mainSection('async function loadProfileSnapshotDetailed(', 'function showRemoteProfileFailureDialog(')
    expect(snapshot).toMatch(/remoteConnections\.connect\([\s\S]*?\)\.catch\([^\n]*\n\s+pushRemoteClientStatus\(profileId\)/)
    const connect = mainSection("ipcMain.handle('remote:connect'", "ipcMain.handle('remote:disconnect'")
    expect(connect).toMatch(/remoteConnections\.connect\([\s\S]*?\}\)\n\s+pushRemoteClientStatus\(boundProfileId\)/)
    const disconnect = mainSection("ipcMain.handle('remote:disconnect'", "ipcMain.handle('remote:client-status'")
    expect(disconnect).toMatch(/await remoteConnections\.dropProfile\(profileId\)\s+pushRemoteClientStatus\(profileId\)/)
    const update = mainSection("ipcMain.handle('profile:update'", "ipcMain.handle('profile:get'")
    expect(update).toMatch(/await remoteConnections\.dropProfile\(profileId\)\s+pushRemoteClientStatus\(profileId\)/)
    const registry = mainSection('const remoteConnections = new RemoteConnectionRegistry', '\n})\n')
    expect(registry).toMatch(/onReleased: \(profileId, reason\) => \{[\s\S]*pushRemoteClientStatus\(profileId\)/)
  })

  it('every bound client pings its own profile, and pushes go only to that profile\'s windows', () => {
    const bind = mainSection('function bindRemoteClient(', 'function noteRemoteWindowClosed(')
    expect(bind).toMatch(/setStatusChangeListener\(\(\) => pushRemoteClientStatus\(profileId\)\)/)
    const push = mainSection('function pushRemoteClientStatus(', 'type SnapshotLoadResult')
    expect(push).toMatch(/planProfileStatusPushes\(profileIds, \(profileId\) => remoteConnections\.connectionState\(profileId\), lastPushedRemoteStatus\)/)
    expect(push).toMatch(/getWindowsForProfile\(status\.profileId\)/)
    expect(push).toMatch(/REMOTE_CLIENT_STATUS_CHANGED_CHANNEL/)
  })

  it('status, path translation, WSL folder default and remote-tool installs read the sender profile\'s own entry', () => {
    const status = mainSection("ipcMain.handle('remote:client-status'", "ipcMain.handle('remote:test-connection'")
    expect(status).toMatch(/liveRemoteClient\(senderBindingProfileId\(await getSenderProfileBinding\(event\.sender\)\)\)/)
    expect(mainSection('async function clientPathTranslatorForBinding(', 'async function resolveDetachedClientPaths('))
      .toMatch(/remoteConnections\.get\(profile\.id\)\?\.client\?\.pathTranslator/)
    expect(mainSection('async function wslFolderDefaultForSender(', 'function registerLocalHandlers(')).toMatch(/liveRemoteClient\(profileId\)/)
    expect(mainSection("ipcMain.handle('remote-tools:take-pending-install'", '// Cross-window workspace move')).toMatch(/const connected = !!liveRemoteClient\(profileId\)/)
    expect(mainSection('function syncRemoteWorkspaceRoots(', 'type SnapshotLoadResult')).toMatch(/remoteConnections\.get\(windowProfileId\)/)
  })
})

/**
 * T0462 (PLAN-039): profile-keyed variants for the per-profile connection
 * registry. Every remote profile has its own entry, so there is no slot to lose
 * to another profile and no `'other-profile'` reason.
 */
describe('planProfileRemoteConnect — keyed by the bound profile', () => {
  const entry = { isConnected: true, target: verified.target }

  it('refuses a window without a profile binding (the registry has no key for it)', () => {
    expect(planProfileRemoteConnect({ request, boundProfileId: null, boundProfile: null, entry: null }))
      .toEqual({ kind: 'reject', error: BINDING_MISSING_ERROR, errorCode: 'binding-missing' })
    expect(planProfileRemoteConnect({ request, boundProfileId: null, boundProfile: profile, entry }).kind).toBe('reject')
  })

  it('reuses the profile\'s own live entry for the same target + pin', () => {
    expect(planProfileRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, entry }))
      .toEqual({ kind: 'reuse', fingerprint: PIN })
  })

  it('connects pinned without an entry, with a dead entry, or when the entry targets something else', () => {
    expect(planProfileRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, entry: null }))
      .toEqual({ kind: 'connect', expectedFingerprint: PIN })
    expect(planProfileRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, entry: { ...entry, isConnected: false } }).kind)
      .toBe('connect')
    expect(planProfileRemoteConnect({ request, boundProfileId: 'p1', boundProfile: profile, entry: { ...entry, target: null } }).kind)
      .toBe('connect')
    expect(planProfileRemoteConnect({
      request, boundProfileId: 'p1', boundProfile: profile, entry: { ...entry, target: { ...entry.target!, fingerprint: OTHER } },
    })).toEqual({ kind: 'connect', expectedFingerprint: PIN })
  })

  it('keeps the T0419 pin rules', () => {
    expect(planProfileRemoteConnect({ request, boundProfileId: 'p1', boundProfile: { ...profile, remoteFingerprint: undefined }, entry: null }).kind)
      .toBe('reject')
    expect(planProfileRemoteConnect({ request: { ...request, fingerprint: OTHER }, boundProfileId: 'p1', boundProfile: profile, entry }))
      .toMatchObject({ kind: 'reject', errorCode: 'fingerprint-mismatch' })
  })
})

describe('computeProfileWindowStatus / planProfileProxiedInvokeRoute — each profile on its own', () => {
  const connected: RemoteProfileConnState = { isConnected: true, isReconnecting: false }
  const reconnecting: RemoteProfileConnState = { isConnected: false, isReconnecting: true }
  const dead: RemoteProfileConnState = { isConnected: false, isReconnecting: false }

  it('maps the profile\'s own entry; no entry is no-client and other-profile never appears', () => {
    expect(computeProfileWindowStatus('p1', null)).toEqual({ profileId: 'p1', connected: false, state: 'disconnected', reason: 'no-client' })
    expect(computeProfileWindowStatus('p1', connected)).toEqual({ profileId: 'p1', connected: true, state: 'connected', reason: null })
    expect(computeProfileWindowStatus('p1', reconnecting)).toEqual({ profileId: 'p1', connected: false, state: 'reconnecting', reason: 'reconnecting' })
    expect(computeProfileWindowStatus('p1', dead)).toEqual({ profileId: 'p1', connected: false, state: 'disconnected', reason: 'disconnected' })
  })

  it('P connected × Q reconnecting route independently', () => {
    const conns: Record<string, RemoteProfileConnState | null> = { P: connected, Q: reconnecting }
    const route = (senderProfileId: string | null, senderIsRemote = true) =>
      planProfileProxiedInvokeRoute({ senderIsRemote, senderProfileId, conn: senderProfileId ? conns[senderProfileId] ?? null : null })
    expect(route('P')).toEqual({ kind: 'remote' })
    expect(route('Q')).toEqual({ kind: 'refuse', errorCode: REMOTE_NOT_CONNECTED, profileId: 'Q', reason: 'reconnecting' })
    expect(route('R')).toEqual({ kind: 'refuse', errorCode: REMOTE_NOT_CONNECTED, profileId: 'R', reason: 'no-client' })
    expect(route(null)).toEqual({ kind: 'local' })
    expect(route('P', false)).toEqual({ kind: 'local' })
  })

  it('pushes each profile\'s own status, once per change', () => {
    const conns = new Map<string, RemoteProfileConnState | null>([['P', connected], ['Q', reconnecting]])
    const lastPushed = new Map<string, string>()
    const getConn = (id: string) => conns.get(id) ?? null
    expect(planProfileStatusPushes(['P', 'Q', 'P', null, undefined], getConn, lastPushed).map(s => [s.profileId, s.state]))
      .toEqual([['P', 'connected'], ['Q', 'reconnecting']])
    expect(planProfileStatusPushes(['P', 'Q'], getConn, lastPushed)).toEqual([])
    conns.set('Q', connected)
    expect(planProfileStatusPushes(['P', 'Q'], getConn, lastPushed).map(s => [s.profileId, s.state])).toEqual([['Q', 'connected']])
    conns.delete('P')
    expect(planProfileStatusPushes(['P'], getConn, lastPushed)).toEqual([{ profileId: 'P', connected: false, state: 'disconnected', reason: 'no-client' }])
  })
})

describe('shouldDropProfileConnectionOnUpdate — only the updated profile\'s entry', () => {
  const base = { applied: true, previousFingerprint: PIN, nextFingerprint: OTHER, hasConnection: true }

  it('drops the entry when its pin changed', () => {
    expect(shouldDropProfileConnectionOnUpdate(base)).toBe(true)
  })

  it('keeps it when nothing changed, the update failed, or there is no entry', () => {
    expect(shouldDropProfileConnectionOnUpdate({ ...base, nextFingerprint: PIN.toLowerCase() })).toBe(false)
    expect(shouldDropProfileConnectionOnUpdate({ ...base, nextFingerprint: undefined })).toBe(false)
    expect(shouldDropProfileConnectionOnUpdate({ ...base, applied: false })).toBe(false)
    expect(shouldDropProfileConnectionOnUpdate({ ...base, hasConnection: false })).toBe(false)
  })
})

describe('planConnectionAdmission — concurrent remote profile cap', () => {
  it('admits under the cap, rejects at the cap, and never counts an existing entry twice', () => {
    expect(planConnectionAdmission({ entryCount: 0, hasEntry: false, cap: 8 })).toEqual({ kind: 'admit' })
    expect(planConnectionAdmission({ entryCount: 7, hasEntry: false, cap: 8 })).toEqual({ kind: 'admit' })
    expect(planConnectionAdmission({ entryCount: 8, hasEntry: false, cap: 8 })).toEqual({ kind: 'reject', reason: 'limit', cap: 8 })
    expect(planConnectionAdmission({ entryCount: 8, hasEntry: true, cap: 8 })).toEqual({ kind: 'existing' })
  })
})

describe('planIdleRelease — last window closed', () => {
  it('releases only an existing entry with no live window left', () => {
    expect(planIdleRelease({ liveWindowCount: 0, hasEntry: true })).toEqual({ kind: 'release' })
    expect(planIdleRelease({ liveWindowCount: 1, hasEntry: true })).toEqual({ kind: 'keep' })
    expect(planIdleRelease({ liveWindowCount: 0, hasEntry: false })).toEqual({ kind: 'none' })
  })
})

describe('findSameTargetProfiles — two profiles, one server', () => {
  const target = { host: 'h', port: 9876, token: 't', fingerprint: PIN }
  const entries = [
    { profileId: 'P', target },
    { profileId: 'Q', target: { ...target, fingerprint: OTHER } },
    { profileId: 'R', target: { ...target, token: 'other' } },
    { profileId: 'S', target: null },
  ]

  it('matches host + port + token (not the fingerprint) and skips the asking profile', () => {
    expect(findSameTargetProfiles(entries, target)).toEqual(['P', 'Q'])
    expect(findSameTargetProfiles(entries, target, 'P')).toEqual(['Q'])
    expect(findSameTargetProfiles(entries, { ...target, port: 1 })).toEqual([])
  })
})
