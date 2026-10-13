/**
 * T0513 (BUG-123): remote card status light — this machine's facts first, a probe
 * of the target only for a profile with no connection and no window.
 */
import { describe, expect, test } from 'vitest'
import {
  computeRemoteCardStatus,
  formatRemoteStatusTitle,
  isProbeableRemoteProfile,
  needsRemoteProbe,
  type RemoteProfileConnectionSnapshot,
} from '../remote-status'
import type { ProfileEntry } from '../types'

const now = Date.now()
const WSL: ProfileEntry = {
  id: 'wsl', name: 'WSL', type: 'remote', targetOS: 'wsl-linux', wslDistro: 'Ubuntu-24.04',
  remoteHost: 'localhost', remotePort: 9877, remoteToken: 'tok', remoteFingerprint: 'fp', createdAt: now, updatedAt: now,
}
const SSH: ProfileEntry = { ...WSL, id: 'ssh', targetOS: 'ssh-linux', sshHost: 'box' }

function conn(state: RemoteProfileConnectionSnapshot['state'], windows = 0): RemoteProfileConnectionSnapshot {
  return { profileId: 'wsl', state, windows }
}

describe('computeRemoteCardStatus', () => {
  test('a live connection is green even when the target reports no active profile (headless stub)', () => {
    expect(computeRemoteCardStatus({ profile: WSL, conn: conn('connected', 1), probe: { ok: true, remoteActive: false } }))
      .toEqual({ status: 'connected', reason: 'linked' })
  })

  test('connecting / reconnecting are yellow', () => {
    expect(computeRemoteCardStatus({ profile: WSL, conn: conn('connecting') }).status).toBe('connecting')
    expect(computeRemoteCardStatus({ profile: WSL, conn: conn('reconnecting', 1) }))
      .toEqual({ status: 'connecting', reason: 'reconnecting' })
  })

  test('a dead client, or an open window without a connection, is red (link lost)', () => {
    expect(computeRemoteCardStatus({ profile: WSL, conn: conn('disconnected') })).toEqual({ status: 'disconnected', reason: 'linkLost' })
    expect(computeRemoteCardStatus({ profile: WSL, conn: conn(null, 2) })).toEqual({ status: 'disconnected', reason: 'linkLost' })
  })

  test('no window and nothing checked is idle, never red', () => {
    expect(computeRemoteCardStatus({ profile: WSL })).toEqual({ status: 'idle', reason: 'notChecked' })
    expect(computeRemoteCardStatus({ profile: WSL, conn: conn(null, 0) })).toEqual({ status: 'idle', reason: 'notChecked' })
  })

  test('no window, reachable server is idle; a legacy target with the profile open says so', () => {
    expect(computeRemoteCardStatus({ profile: WSL, probe: { ok: true, remoteActive: false } })).toEqual({ status: 'idle', reason: 'reachable' })
    expect(computeRemoteCardStatus({ profile: WSL, probe: { ok: true, remoteActive: true } })).toEqual({ status: 'idle', reason: 'reachableRemoteActive' })
  })

  test('a failed probe is red and keeps the error', () => {
    expect(computeRemoteCardStatus({ profile: WSL, probe: { ok: false, errorCode: 'network', error: 'connect ECONNREFUSED 127.0.0.1:9877' } }))
      .toEqual({ status: 'disconnected', reason: 'probeFailed', errorCode: 'network', detail: 'connect ECONNREFUSED 127.0.0.1:9877' })
  })

  test('host + token without a pinned fingerprint is red (main refuses to connect it)', () => {
    expect(computeRemoteCardStatus({ profile: { ...WSL, remoteFingerprint: undefined } })).toEqual({ status: 'disconnected', reason: 'fingerprintMissing' })
  })
})

describe('probe selection', () => {
  test('ssh-* profiles are never probed (their address is the server-side localhost behind the tunnel)', () => {
    expect(isProbeableRemoteProfile(SSH)).toBe(false)
    expect(isProbeableRemoteProfile({ ...SSH, targetOS: 'ssh-darwin' })).toBe(false)
    expect(isProbeableRemoteProfile(WSL)).toBe(true)
    expect(isProbeableRemoteProfile({ ...WSL, remoteFingerprint: undefined })).toBe(false)
    expect(isProbeableRemoteProfile({ ...WSL, type: 'local' })).toBe(false)
  })

  test('only a profile with no connection and no window is probed', () => {
    expect(needsRemoteProbe(WSL, undefined)).toBe(true)
    expect(needsRemoteProbe(WSL, conn(null, 0))).toBe(true)
    expect(needsRemoteProbe(WSL, conn('connected', 1))).toBe(false)
    expect(needsRemoteProbe(WSL, conn(null, 1))).toBe(false)
    expect(needsRemoteProbe(WSL, conn('disconnected', 0))).toBe(false)
  })
})

describe('formatRemoteStatusTitle', () => {
  const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}|${JSON.stringify(opts)}` : key)

  test('plain reasons map to profiles.statusReason.*', () => {
    expect(formatRemoteStatusTitle(t, { status: 'connected', reason: 'linked' })).toBe('profiles.statusReason.linked')
  })

  test('a failed probe carries the short reason and the raw error', () => {
    expect(formatRemoteStatusTitle(t, { status: 'disconnected', reason: 'probeFailed', errorCode: 'fingerprint-mismatch', detail: 'Fingerprint mismatch' }))
      .toBe('profiles.statusReason.probeFailed|{"reason":"profiles.statusProbeError.fingerprintMismatch (Fingerprint mismatch)"}')
    expect(formatRemoteStatusTitle(t, { status: 'disconnected', reason: 'probeFailed', detail: 'boom' }))
      .toBe('profiles.statusReason.probeFailed|{"reason":"profiles.statusProbeError.unknown (boom)"}')
  })
})
