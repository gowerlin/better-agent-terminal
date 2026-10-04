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

/**
 * T0442: `profile:update` changed the profile's pin. Compared normalized (case
 * and separators ignored); `undefined` in the update means "field untouched".
 */
export function isRemoteFingerprintChange(previous: string | undefined, next: string | undefined): boolean {
  if (next === undefined) return false
  return normalizeFingerprint(previous ?? '') !== normalizeFingerprint(next)
}

/**
 * T0442: fail closed when a profile's pin changes. The slot's client was
 * verified against the old pin, so it is dropped when it is bound to that
 * profile; the renderer's next `remote:connect` reconnects with the new pin.
 * Updates that did not apply, leave the pin alone, or target another profile
 * never touch the slot.
 */
export function shouldDropClientOnProfileUpdate(input: {
  profileId: string
  applied: boolean
  previousFingerprint: string | undefined
  nextFingerprint: string | undefined
  slotProfileId: string | null
}): boolean {
  const { profileId, applied, previousFingerprint, nextFingerprint, slotProfileId } = input
  if (!applied || slotProfileId === null || slotProfileId !== profileId) return false
  return isRemoteFingerprintChange(previousFingerprint, nextFingerprint)
}

/**
 * T0443 (BUG-110): error code a remote-profile window gets when its proxied
 * invoke is refused because the window's remote connection is not live.
 * Electron only carries an IPC error's `message` to the renderer, so the code
 * leads the message (`src/lib/remote-not-connected.ts` matches on it).
 */
export const REMOTE_NOT_CONNECTED = 'REMOTE_NOT_CONNECTED'

/** T0443: main → renderer push whenever a profile's connection state may have changed. */
export const REMOTE_CLIENT_STATUS_CHANGED_CHANNEL = 'remote:client-status-changed'

/** T0443: main → renderer push when a proxied invoke was refused (REMOTE_NOT_CONNECTED). */
export const REMOTE_INVOKE_REFUSED_CHANNEL = 'remote:invoke-refused'

/** What the single client slot holds right now (`profileId: null` = empty slot). */
export interface RemoteSlotState {
  profileId: string | null
  isConnected: boolean
  isReconnecting: boolean
}

export type RemoteWindowState = 'connected' | 'reconnecting' | 'disconnected'

/** Why a remote-profile window is not served right now. */
export type RemoteNotConnectedReason = 'no-client' | 'other-profile' | 'reconnecting' | 'disconnected'

export interface RemoteWindowStatus {
  profileId: string
  connected: boolean
  state: RemoteWindowState
  reason: RemoteNotConnectedReason | null
}

/**
 * T0443: connection state as seen by the windows bound to `profileId`. Only the
 * slot's own client serves them: an empty slot or a slot owned by another
 * remote profile means "not connected", whatever that other client is doing.
 */
export function computeRemoteWindowStatus(profileId: string, slot: RemoteSlotState): RemoteWindowStatus {
  if (slot.profileId === null) return { profileId, connected: false, state: 'disconnected', reason: 'no-client' }
  if (slot.profileId !== profileId) return { profileId, connected: false, state: 'disconnected', reason: 'other-profile' }
  if (slot.isConnected) return { profileId, connected: true, state: 'connected', reason: null }
  if (slot.isReconnecting) return { profileId, connected: false, state: 'reconnecting', reason: 'reconnecting' }
  return { profileId, connected: false, state: 'disconnected', reason: 'disconnected' }
}

export type ProxiedInvokeRoute =
  | { kind: 'local' }
  | { kind: 'remote' }
  | { kind: 'refuse'; errorCode: typeof REMOTE_NOT_CONNECTED; profileId: string; reason: RemoteNotConnectedReason }

/**
 * T0443 (BUG-110): where `bindProxiedHandlersToIpc` sends a non-ALWAYS_LOCAL
 * channel (ALWAYS_LOCAL channels short-circuit to the local handler before this
 * runs). A local window — or one with no profile binding — stays local. A
 * remote-profile window goes to its remote server only while the slot is its
 * own and connected; otherwise it is refused, never run on this machine.
 */
export function planProxiedInvokeRoute(input: {
  senderIsRemote: boolean
  senderProfileId: string | null
  slot: RemoteSlotState
}): ProxiedInvokeRoute {
  const { senderIsRemote, senderProfileId, slot } = input
  if (!senderIsRemote || !senderProfileId) return { kind: 'local' }
  const status = computeRemoteWindowStatus(senderProfileId, slot)
  if (status.connected) return { kind: 'remote' }
  return { kind: 'refuse', errorCode: REMOTE_NOT_CONNECTED, profileId: senderProfileId, reason: status.reason ?? 'disconnected' }
}

/** T0443: the refused invoke's error message; starts with the error code. */
export function formatRemoteNotConnectedError(channel: string, profileId: string, reason: RemoteNotConnectedReason): string {
  return `${REMOTE_NOT_CONNECTED}: remote profile ${profileId} is not connected (${reason}); ${channel} was not run on this machine`
}

/**
 * T0443: which profiles get a `remote:client-status-changed` push after a slot
 * change or a client status ping. `profileIds` names every profile the change
 * may concern (previous slot owner, new owner, the candidate's profile); each is
 * pushed once, only when its status differs from the last one pushed
 * (`lastPushed` is updated in place).
 */
export function planRemoteStatusPushes(
  profileIds: ReadonlyArray<string | null | undefined>,
  slot: RemoteSlotState,
  lastPushed: Map<string, string>,
): RemoteWindowStatus[] {
  const pushes: RemoteWindowStatus[] = []
  for (const profileId of new Set(profileIds)) {
    if (!profileId) continue
    const status = computeRemoteWindowStatus(profileId, slot)
    const key = `${status.state}:${status.reason ?? ''}`
    if (lastPushed.get(profileId) === key) continue
    lastPushed.set(profileId, key)
    pushes.push(status)
  }
  return pushes
}
