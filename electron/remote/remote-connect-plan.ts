/**
 * T0419 (BUG-096): decide what the `remote:connect` IPC handler does with a
 * renderer request.
 *
 * The window of a remote profile is created only after main already connected
 * with the profile's pinned fingerprint (`loadProfileSnapshotDetailed`). The
 * renderer's initProfile then calls `remote:connect` for the same target; that
 * used to build a fresh client without a fingerprint (TOFU accepts any cert)
 * and swap out the pinned one. Now:
 *
 * - a window bound to a remote profile always connects with the profile's
 *   pinned fingerprint; a profile without one is refused, same as
 *   `loadProfileSnapshotDetailed` (legacy plaintext setup, re-pair needed)
 * - a renderer-supplied fingerprint that disagrees with the pin is refused
 * - a client already connected for the same profile + target + pin is reused
 *
 * First-time TOFU never goes through `remote:connect` (ProfilePanel uses
 * `remote:list-profiles` / `remote:test-connection`, the setup wizard pins its
 * own), and windows not bound to a remote profile keep the old behaviour.
 *
 * Pure module (no electron import).
 */
import { normalizeFingerprint } from './remote-client'

export const DEFAULT_REMOTE_PORT = 9876

/** What a live client was connected to; the fingerprint is the observed one. */
export interface RemoteConnectTarget {
  host: string
  port: number
  token: string
  fingerprint: string
}

export interface RemoteConnectRequest {
  host: string
  port: number
  token: string
  fingerprint?: string
}

export interface RemoteConnectBoundProfile {
  type?: 'local' | 'remote'
  remoteHost?: string
  remotePort?: number
  remoteToken?: string
  remoteFingerprint?: string
}

export interface RemoteConnectCurrent {
  profileId: string | null
  isConnected: boolean
  target: RemoteConnectTarget | null
}

export type RemoteConnectPlan =
  | { kind: 'reject'; error: string; errorCode: 'fingerprint-missing' | 'fingerprint-mismatch' }
  | { kind: 'reuse'; fingerprint: string }
  | { kind: 'connect'; expectedFingerprint: string | undefined }

export const LEGACY_PROFILE_ERROR = 'Profile has no pinned server fingerprint (legacy setup)'
export const RENDERER_FINGERPRINT_MISMATCH_ERROR = 'Requested fingerprint does not match the profile\'s pinned value'

function sameTarget(a: { host: string; port: number; token: string }, b: { host: string; port: number; token: string }): boolean {
  return a.host === b.host && a.port === b.port && a.token === b.token
}

export function planRemoteConnect(input: {
  request: RemoteConnectRequest
  boundProfileId: string | null
  boundProfile: RemoteConnectBoundProfile | null
  current: RemoteConnectCurrent | null
}): RemoteConnectPlan {
  const { request, boundProfileId, boundProfile, current } = input
  const requested = request.fingerprint ? normalizeFingerprint(request.fingerprint) : ''

  if (boundProfile?.type !== 'remote') {
    return { kind: 'connect', expectedFingerprint: requested || undefined }
  }

  const profileTarget = {
    host: boundProfile.remoteHost ?? '',
    port: boundProfile.remotePort || DEFAULT_REMOTE_PORT,
    token: boundProfile.remoteToken ?? '',
  }
  const pinned = boundProfile.remoteFingerprint ? normalizeFingerprint(boundProfile.remoteFingerprint) : ''

  let expected: string
  if (sameTarget(request, profileTarget)) {
    if (!pinned) return { kind: 'reject', error: LEGACY_PROFILE_ERROR, errorCode: 'fingerprint-missing' }
    if (requested && requested !== pinned) {
      return { kind: 'reject', error: RENDERER_FINGERPRINT_MISMATCH_ERROR, errorCode: 'fingerprint-mismatch' }
    }
    expected = pinned
  } else {
    // A remote-bound window asking for some other target still needs a pin.
    if (!requested) return { kind: 'reject', error: LEGACY_PROFILE_ERROR, errorCode: 'fingerprint-missing' }
    expected = requested
  }

  if (
    current?.isConnected &&
    boundProfileId !== null &&
    current.profileId === boundProfileId &&
    current.target &&
    sameTarget(current.target, request) &&
    normalizeFingerprint(current.target.fingerprint) === expected
  ) {
    return { kind: 'reuse', fingerprint: current.target.fingerprint }
  }

  return { kind: 'connect', expectedFingerprint: expected }
}

/** The single module-level client slot `remote:connect` writes. */
export interface RemoteClientSlot<C> {
  client: C | null
  profileId: string | null
}

/**
 * T0430: settle the slot after a `connect` plan ran. The slot only changes on
 * success (the candidate takes over, the previous client is disposed); a failed
 * connect leaves the slot untouched and disposes the candidate, which may hold a
 * live SSH tunnel whose `tunnel-down` would otherwise schedule reconnects. Every
 * client either stays in the slot or is returned in `dispose` — none is dropped
 * unreferenced while still connected or reconnecting.
 */
export function settleRemoteConnect<C>(input: {
  slot: RemoteClientSlot<C>
  candidate: C | null
  candidateProfileId: string | null
  ok: boolean
}): { slot: RemoteClientSlot<C>; dispose: C[] } {
  const { slot, candidate, candidateProfileId, ok } = input
  if (ok && candidate) {
    return {
      slot: { client: candidate, profileId: candidateProfileId },
      dispose: slot.client && slot.client !== candidate ? [slot.client] : [],
    }
  }
  return {
    slot,
    dispose: candidate && candidate !== slot.client ? [candidate] : [],
  }
}
