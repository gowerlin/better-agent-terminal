/**
 * T0419 (BUG-096): the renderer's initProfile `remote:connect` used to build a
 * fresh client without a fingerprint (TOFU accepts any cert) and replace the
 * client main had already connected with the profile's pinned fingerprint.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LEGACY_PROFILE_ERROR,
  REMOTE_NOT_CONNECTED,
  computeRemoteWindowStatus,
  formatRemoteNotConnectedError,
  isRemoteFingerprintChange,
  planProxiedInvokeRoute,
  planRemoteStatusPushes,
  settleRemoteConnect,
  planRemoteConnect,
  shouldDropClientOnProfileUpdate,
  type RemoteConnectBoundProfile,
  type RemoteConnectCurrent,
  type RemoteSlotState,
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

describe('remote:connect handler wiring (T0430 source guard)', () => {
  const src = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')
  const start = src.indexOf("ipcMain.handle('remote:connect'")
  const handler = src.slice(start, src.indexOf("ipcMain.handle('remote:disconnect'", start))

  it('never nulls the slot directly; every outcome goes through settleRemoteConnect', () => {
    expect(start).toBeGreaterThan(-1)
    expect(handler).not.toMatch(/remoteClient\s*=\s*null/)
    expect(handler).not.toMatch(/remoteClientProfileId\s*=\s*null/)
    expect(handler).toMatch(/settleRemoteConnect\(/)
  })

  it('the reject branch returns before touching the slot', () => {
    const reject = handler.slice(handler.indexOf("plan.kind === 'reject'"), handler.indexOf("plan.kind === 'reuse'"))
    expect(reject).toMatch(/return \{ error: plan\.error/)
    expect(reject).not.toMatch(/settleSlot|remoteClient\s*=|remoteClientProfileId\s*=/)
  })
})

describe('loadProfileSnapshotDetailed wiring (T0442 source guard)', () => {
  const src = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')
  const start = src.indexOf('async function loadProfileSnapshotDetailed(')
  const fn = src.slice(start, src.indexOf('function showRemoteProfileFailureDialog(', start))

  it('settles the slot through settleRemoteConnect instead of assigning it', () => {
    expect(start).toBeGreaterThan(-1)
    expect(fn).toMatch(/settleRemoteConnect\(/)
    expect(fn).not.toMatch(/remoteClient\s*=\s*client/)
  })

  it('a failed connect (result or throw) disposes the candidate before returning', () => {
    const failed = fn.slice(fn.indexOf('if (!result.ok)'), fn.indexOf('remoteClientTargets.set(client'))
    expect(failed).toMatch(/await settleSlot\(false\)[\s\S]*return \{ kind: 'remote-unreachable'/)
    const threw = fn.slice(fn.indexOf('connect threw'))
    expect(threw).toMatch(/await settleSlot\(false\)/)
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

describe('shouldDropClientOnProfileUpdate — pin change fails closed (T0442)', () => {
  const base = { profileId: 'p1', applied: true, previousFingerprint: PIN, nextFingerprint: OTHER, slotProfileId: 'p1' as string | null }

  it('drops the slot client bound to the profile whose pin changed', () => {
    expect(shouldDropClientOnProfileUpdate(base)).toBe(true)
  })

  it('keeps the slot when the pin is unchanged (same value in another format, or not in the update)', () => {
    expect(shouldDropClientOnProfileUpdate({ ...base, nextFingerprint: PIN.toLowerCase() })).toBe(false)
    expect(shouldDropClientOnProfileUpdate({ ...base, nextFingerprint: undefined })).toBe(false)
  })

  it('keeps the slot when another profile is updated or the slot is empty', () => {
    expect(shouldDropClientOnProfileUpdate({ ...base, slotProfileId: 'q' })).toBe(false)
    expect(shouldDropClientOnProfileUpdate({ ...base, slotProfileId: null })).toBe(false)
  })

  it('keeps the slot when the update did not apply', () => {
    expect(shouldDropClientOnProfileUpdate({ ...base, applied: false })).toBe(false)
  })
})

describe('profile:update handler wiring (T0442 source guard)', () => {
  const src = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')
  const start = src.indexOf("ipcMain.handle('profile:update'")
  const handler = src.slice(start, src.indexOf("ipcMain.handle('profile:get'", start))

  it('reads the old pin before updating and clears the slot only behind shouldDropClientOnProfileUpdate', () => {
    expect(start).toBeGreaterThan(-1)
    expect(handler.indexOf('previousFingerprint =')).toBeLessThan(handler.indexOf('profileManager.update('))
    const guard = handler.indexOf('shouldDropClientOnProfileUpdate(')
    expect(guard).toBeGreaterThan(-1)
    expect(handler.indexOf('remoteClient = null')).toBeGreaterThan(guard)
    expect(handler).toMatch(/remoteOpMutex\.then\(/)
  })
})

// ── T0443 (BUG-110): remote-window fail-closed routing ──

const EMPTY_SLOT: RemoteSlotState = { profileId: null, isConnected: false, isReconnecting: false }
const slotOf = (profileId: string, isConnected: boolean, isReconnecting = false): RemoteSlotState =>
  ({ profileId, isConnected, isReconnecting })

describe('planProxiedInvokeRoute (T0443 routing matrix)', () => {
  const cases: Array<{ name: string; senderIsRemote: boolean; senderProfileId: string | null; slot: RemoteSlotState; expected: string; reason?: string }> = [
    // local window (or no profile binding): always local, whatever the slot holds
    { name: 'local window, empty slot', senderIsRemote: false, senderProfileId: 'local-1', slot: EMPTY_SLOT, expected: 'local' },
    { name: 'local window, slot connected for a remote profile', senderIsRemote: false, senderProfileId: 'local-1', slot: slotOf('remote-P', true), expected: 'local' },
    { name: 'local window, slot reconnecting', senderIsRemote: false, senderProfileId: 'local-1', slot: slotOf('remote-P', false, true), expected: 'local' },
    { name: 'window without a registry entry', senderIsRemote: false, senderProfileId: null, slot: slotOf('remote-P', true), expected: 'local' },
    // remote window
    { name: 'remote window, own slot connected', senderIsRemote: true, senderProfileId: 'remote-P', slot: slotOf('remote-P', true), expected: 'remote' },
    { name: 'remote window, own slot reconnecting', senderIsRemote: true, senderProfileId: 'remote-P', slot: slotOf('remote-P', false, true), expected: 'refuse', reason: 'reconnecting' },
    { name: 'remote window, own slot disconnected (gave up)', senderIsRemote: true, senderProfileId: 'remote-P', slot: slotOf('remote-P', false), expected: 'refuse', reason: 'disconnected' },
    { name: 'remote window, slot owned by another profile (connected)', senderIsRemote: true, senderProfileId: 'remote-P', slot: slotOf('remote-Q', true), expected: 'refuse', reason: 'other-profile' },
    { name: 'remote window, empty slot (pin change / remote:disconnect)', senderIsRemote: true, senderProfileId: 'remote-P', slot: EMPTY_SLOT, expected: 'refuse', reason: 'no-client' },
  ]

  for (const c of cases) {
    it(c.name, () => {
      const route = planProxiedInvokeRoute({ senderIsRemote: c.senderIsRemote, senderProfileId: c.senderProfileId, slot: c.slot })
      expect(route.kind).toBe(c.expected)
      if (route.kind === 'refuse') {
        expect(route).toEqual({ kind: 'refuse', errorCode: REMOTE_NOT_CONNECTED, profileId: c.senderProfileId, reason: c.reason })
      }
    })
  }

  it('a remote window is never routed local, for any slot state', () => {
    const slots = [EMPTY_SLOT, slotOf('remote-P', true), slotOf('remote-P', false), slotOf('remote-P', false, true), slotOf('remote-Q', true), slotOf('remote-Q', false, true)]
    for (const slot of slots) {
      expect(planProxiedInvokeRoute({ senderIsRemote: true, senderProfileId: 'remote-P', slot }).kind).not.toBe('local')
    }
  })
})

describe('computeRemoteWindowStatus (T0443)', () => {
  it('reports the state seen by the windows bound to the profile', () => {
    expect(computeRemoteWindowStatus('P', slotOf('P', true))).toEqual({ profileId: 'P', connected: true, state: 'connected', reason: null })
    expect(computeRemoteWindowStatus('P', slotOf('P', false, true))).toEqual({ profileId: 'P', connected: false, state: 'reconnecting', reason: 'reconnecting' })
    expect(computeRemoteWindowStatus('P', slotOf('P', false))).toEqual({ profileId: 'P', connected: false, state: 'disconnected', reason: 'disconnected' })
    expect(computeRemoteWindowStatus('P', slotOf('Q', true))).toEqual({ profileId: 'P', connected: false, state: 'disconnected', reason: 'other-profile' })
    expect(computeRemoteWindowStatus('P', EMPTY_SLOT)).toEqual({ profileId: 'P', connected: false, state: 'disconnected', reason: 'no-client' })
  })
})

describe('REMOTE_NOT_CONNECTED error (T0443)', () => {
  it('leads the message, survives Electron IPC wrapping, and matches the renderer constant', () => {
    const message = formatRemoteNotConnectedError('pty:create', 'remote-P', 'other-profile')
    expect(message.startsWith(`${REMOTE_NOT_CONNECTED}:`)).toBe(true)
    expect(message).toContain('remote-P')
    expect(message).toContain('pty:create')
    expect(RENDERER_REMOTE_NOT_CONNECTED).toBe(REMOTE_NOT_CONNECTED)
    // ipcRenderer.invoke rejects with "Error invoking remote method '<ch>': Error: <message>"
    expect(isRemoteNotConnectedError(new Error(`Error invoking remote method 'pty:create': Error: ${message}`))).toBe(true)
  })
})

describe('planRemoteStatusPushes (T0443 push targets)', () => {
  it('slot handover Q → P: both profiles are pushed, P connected and Q not connected (other-profile)', () => {
    const last = new Map<string, string>()
    const pushes = planRemoteStatusPushes(['remote-Q', 'remote-P', 'remote-P'], slotOf('remote-P', true), last)
    expect(pushes).toEqual([
      { profileId: 'remote-Q', connected: false, state: 'disconnected', reason: 'other-profile' },
      { profileId: 'remote-P', connected: true, state: 'connected', reason: null },
    ])
  })

  it('pin change / remote:disconnect clears the slot: the old owner is pushed no-client', () => {
    const last = new Map<string, string>([['remote-P', 'connected:']])
    expect(planRemoteStatusPushes(['remote-P'], EMPTY_SLOT, last))
      .toEqual([{ profileId: 'remote-P', connected: false, state: 'disconnected', reason: 'no-client' }])
  })

  it('pushes only on change and skips null ids; a failed connect leaves the slot owner quiet', () => {
    const last = new Map<string, string>()
    expect(planRemoteStatusPushes(['remote-P', null, undefined], slotOf('remote-P', true), last)).toHaveLength(1)
    // same state again (client ping + slot ping) → nothing
    expect(planRemoteStatusPushes(['remote-P'], slotOf('remote-P', true), last)).toEqual([])
    // socket dropped → reconnecting → connected again
    expect(planRemoteStatusPushes(['remote-P'], slotOf('remote-P', false, true), last).map(s => s.state)).toEqual(['reconnecting'])
    expect(planRemoteStatusPushes(['remote-P'], slotOf('remote-P', true), last).map(s => s.state)).toEqual(['connected'])
    // a failed connect for Q keeps P in the slot: P unchanged (quiet), Q told it is not connected
    expect(planRemoteStatusPushes(['remote-P', 'remote-P', 'remote-Q'], slotOf('remote-P', true), last))
      .toEqual([{ profileId: 'remote-Q', connected: false, state: 'disconnected', reason: 'other-profile' }])
  })
})

describe('bindProxiedHandlersToIpc wiring (T0443 source guard)', () => {
  const src = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')
  const start = src.indexOf('function bindProxiedHandlersToIpc()')
  const fn = src.slice(start, src.indexOf('// ── Renderer debug log', start))

  it('keeps the ALWAYS_LOCAL short-circuit ahead of any routing', () => {
    expect(start).toBeGreaterThan(-1)
    const shortCircuit = fn.indexOf('if (ALWAYS_LOCAL_CHANNELS.has(channel))')
    expect(shortCircuit).toBeGreaterThan(-1)
    expect(fn.slice(shortCircuit, fn.indexOf('}', shortCircuit))).toMatch(/return invokeHandler\(channel, args, windowId\)/)
    expect(shortCircuit).toBeLessThan(fn.indexOf('planProxiedInvokeRoute('))
  })

  it('routes through planProxiedInvokeRoute; the local handler runs only for the local route', () => {
    expect(fn).not.toMatch(/senderProfileId === remoteClientProfileId/)
    const afterRoute = fn.slice(fn.indexOf('planProxiedInvokeRoute('))
    expect(afterRoute.match(/invokeHandler\(/g) ?? []).toHaveLength(1)
    expect(afterRoute).toMatch(/if \(route\.kind === 'local'\) return invokeHandler\(/)
    // anything that is neither local nor a live remote is refused with the code
    expect(afterRoute).toMatch(/throw Object\.assign\(new Error\(formatRemoteNotConnectedError\(/)
    expect(afterRoute).toMatch(/REMOTE_INVOKE_REFUSED_CHANNEL/)
  })
})

describe('remote status push wiring (T0443 source guard)', () => {
  const src = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')
  const section = (from: string, to: string) => {
    const at = src.indexOf(from)
    expect(at, from).toBeGreaterThan(-1)
    return src.slice(at, src.indexOf(to, at))
  }

  it('every slot change pushes the status of the profiles it concerns', () => {
    const snapshot = section('async function loadProfileSnapshotDetailed(', 'function showRemoteProfileFailureDialog(')
    expect(snapshot).toMatch(/remoteClientProfileId = next\.slot\.profileId\s+pushRemoteClientStatus\(previousProfileId, next\.slot\.profileId, profileId\)/)
    const connect = section("ipcMain.handle('remote:connect'", "ipcMain.handle('remote:disconnect'")
    expect(connect).toMatch(/remoteClientProfileId = next\.slot\.profileId\s+pushRemoteClientStatus\(previousProfileId, next\.slot\.profileId, candidateProfileId\)/)
    const disconnect = section("ipcMain.handle('remote:disconnect'", "ipcMain.handle('remote:client-status'")
    expect(disconnect).toMatch(/remoteClientProfileId = null\s+pushRemoteClientStatus\(previousProfileId\)/)
    const update = section("ipcMain.handle('profile:update'", "ipcMain.handle('profile:get'")
    expect(update).toMatch(/remoteClientProfileId = null\s+pushRemoteClientStatus\(profileId\)/)
  })

  it('every bound client pings its own profile, and pushes go only to that profile\'s windows', () => {
    const bind = section('function bindRemoteClient(', 'function currentRemoteSlot(')
    expect(bind).toMatch(/setStatusChangeListener\(\(\) => pushRemoteClientStatus\(profileId\)\)/)
    const push = section('function pushRemoteClientStatus(', 'type SnapshotLoadResult')
    expect(push).toMatch(/planRemoteStatusPushes\(profileIds, currentRemoteSlot\(\), lastPushedRemoteStatus\)/)
    expect(push).toMatch(/getWindowsForProfile\(status\.profileId\)/)
    expect(push).toMatch(/REMOTE_CLIENT_STATUS_CHANGED_CHANNEL/)
  })
})
