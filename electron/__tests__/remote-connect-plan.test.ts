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
  settleRemoteConnect,
  planRemoteConnect,
  type RemoteConnectBoundProfile,
  type RemoteConnectCurrent,
} from '../remote/remote-connect-plan'

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
