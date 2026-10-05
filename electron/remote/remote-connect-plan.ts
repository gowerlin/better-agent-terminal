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

/** A client slot: one registry entry's client (T0463: was main.ts's single module-level slot). */
export interface RemoteClientSlot<C> {
  client: C | null
  profileId: string | null
}

/**
 * T0430: settle the slot after a `connect` plan ran (T0462: one registry entry's
 * client). The slot only changes on success (the candidate takes over, the previous client is disposed); a failed
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

export type RemoteWindowState = 'connected' | 'reconnecting' | 'disconnected'

/** Why a remote-profile window is not served right now. */
export type RemoteNotConnectedReason = 'no-client' | 'reconnecting' | 'disconnected'

export interface RemoteWindowStatus {
  profileId: string
  connected: boolean
  state: RemoteWindowState
  reason: RemoteNotConnectedReason | null
}

/** T0443: the refused invoke's error message; starts with the error code. */
export function formatRemoteNotConnectedError(channel: string, profileId: string, reason: RemoteNotConnectedReason): string {
  return `${REMOTE_NOT_CONNECTED}: remote profile ${profileId} is not connected (${reason}); ${channel} was not run on this machine`
}

/**
 * T0446 (BUG-112): what main records when `workspace:detach` opens a workspace in
 * a window of its own. That window is not in `windowMap` and has no registry
 * entry; it carries its parent window's profile binding.
 */
export interface DetachedWindowRecord {
  parentWindowId: string | null
  /** The parent's profile binding when the workspace was detached (null = no binding). */
  profileId: string | null
  /** false when that binding could not be read at detach time. */
  resolved: boolean
}

/** An IPC sender's profile binding (`profileId: null` = none, a local window). */
export type SenderProfileBinding =
  | { kind: 'bound'; profileId: string | null }
  | { kind: 'unresolved' }

/**
 * T0446: the profile id an unresolved detached window routes under. It never
 * matches a real profile, so no registry entry ever serves it: every proxied
 * call is refused, never run on this machine.
 */
export const UNRESOLVED_DETACHED_PROFILE_ID = '(unresolved-detached-window)'

/**
 * T0446 (BUG-112): a detached window's binding. `parentProfileId` is the parent's
 * current binding (`undefined` = parent closed or its entry unreadable). The parent
 * wins while it names a profile; otherwise the binding recorded at detach time. A
 * known profile binding is never downgraded to "none" (that would be local), and
 * when neither side is known the window is unresolved — fail closed.
 */
export function resolveDetachedProfileBinding(
  record: DetachedWindowRecord | undefined,
  parentProfileId: string | null | undefined,
): SenderProfileBinding {
  if (!record) return { kind: 'unresolved' }
  if (parentProfileId) return { kind: 'bound', profileId: parentProfileId }
  if (record.resolved && record.profileId) return { kind: 'bound', profileId: record.profileId }
  if (parentProfileId === null || record.resolved) return { kind: 'bound', profileId: null }
  return { kind: 'unresolved' }
}

/** T0446: the binding's profile id, `null` when unbound or unresolved (never "connected"). */
export function senderBindingProfileId(binding: SenderProfileBinding): string | null {
  return binding.kind === 'bound' ? binding.profileId : null
}

/**
 * T0446 (BUG-112): `planProfileProxiedInvokeRoute` input for a detached window.
 * `profileType` is the bound profile's type now (`null` = profile not found).
 * Unbound → local, same as its parent; a profile that cannot be looked up and an
 * unresolved binding are treated as remote, so they are refused unless that
 * profile's own client is live.
 */
export function detachedSenderRouteIdentity(
  binding: SenderProfileBinding,
  profileType: 'local' | 'remote' | null,
): { senderIsRemote: boolean; senderProfileId: string | null } {
  if (binding.kind === 'unresolved') return { senderIsRemote: true, senderProfileId: UNRESOLVED_DETACHED_PROFILE_ID }
  if (!binding.profileId) return { senderIsRemote: false, senderProfileId: null }
  return { senderIsRemote: profileType !== 'local', senderProfileId: binding.profileId }
}

/*
 * T0462 (PLAN-039): profile-keyed variants for the per-profile connection
 * registry (`remote-connection-registry.ts`). Each profile has its own entry,
 * so a window is only ever served — or refused — by its own profile's client
 * and `'other-profile'` no longer occurs. T0463 moved main.ts to the registry
 * and removed the single-slot functions.
 */

export const BINDING_MISSING_ERROR = 'Window is not bound to a profile'

/** A profile's registry entry as `planProfileRemoteConnect` sees it. */
export interface RemoteProfileConnectEntry {
  isConnected: boolean
  target: RemoteConnectTarget | null
}

export type RemoteProfileConnectPlan =
  | RemoteConnectPlan
  | { kind: 'reject'; error: string; errorCode: 'binding-missing' }

/**
 * T0462: `planRemoteConnect` keyed by the bound profile. `entry` is that
 * profile's own registry entry, so a reuse never depends on who else is
 * connected. A window without a profile binding has no registry key and is
 * refused.
 */
export function planProfileRemoteConnect(input: {
  request: RemoteConnectRequest
  boundProfileId: string | null
  boundProfile: RemoteConnectBoundProfile | null
  entry: RemoteProfileConnectEntry | null
}): RemoteProfileConnectPlan {
  const { request, boundProfileId, boundProfile, entry } = input
  if (boundProfileId === null) return { kind: 'reject', error: BINDING_MISSING_ERROR, errorCode: 'binding-missing' }
  return planRemoteConnect({
    request,
    boundProfileId,
    boundProfile,
    current: entry ? { profileId: boundProfileId, isConnected: entry.isConnected, target: entry.target } : null,
  })
}

/** T0462: a profile's pin changed — drop that profile's entry, if it has one. */
export function shouldDropProfileConnectionOnUpdate(input: {
  applied: boolean
  previousFingerprint: string | undefined
  nextFingerprint: string | undefined
  hasConnection: boolean
}): boolean {
  const { applied, previousFingerprint, nextFingerprint, hasConnection } = input
  if (!applied || !hasConnection) return false
  return isRemoteFingerprintChange(previousFingerprint, nextFingerprint)
}

/** What a profile's registry entry holds right now (`null` = no client). */
export interface RemoteProfileConnState {
  isConnected: boolean
  isReconnecting: boolean
}

export type RemoteProfileNotConnectedReason = RemoteNotConnectedReason

export interface RemoteProfileWindowStatus extends RemoteWindowStatus {
  reason: RemoteProfileNotConnectedReason | null
}

/** T0462: connection state as seen by the windows bound to `profileId`. */
export function computeProfileWindowStatus(profileId: string, conn: RemoteProfileConnState | null): RemoteProfileWindowStatus {
  if (!conn) return { profileId, connected: false, state: 'disconnected', reason: 'no-client' }
  if (conn.isConnected) return { profileId, connected: true, state: 'connected', reason: null }
  if (conn.isReconnecting) return { profileId, connected: false, state: 'reconnecting', reason: 'reconnecting' }
  return { profileId, connected: false, state: 'disconnected', reason: 'disconnected' }
}

export type ProfileProxiedInvokeRoute =
  | { kind: 'local' }
  | { kind: 'remote' }
  | { kind: 'refuse'; errorCode: typeof REMOTE_NOT_CONNECTED; profileId: string; reason: RemoteProfileNotConnectedReason }

/**
 * T0443 / T0462: where `bindProxiedHandlersToIpc` sends a non-ALWAYS_LOCAL
 * channel (ALWAYS_LOCAL channels short-circuit to the local handler before this
 * runs). A local window — or one with no profile binding — stays local. A
 * remote-profile window goes to its remote server only while its own profile's
 * entry (`conn`, looked up by the caller with `senderProfileId`) is connected;
 * otherwise it is refused, never run on this machine.
 */
export function planProfileProxiedInvokeRoute(input: {
  senderIsRemote: boolean
  senderProfileId: string | null
  conn: RemoteProfileConnState | null
}): ProfileProxiedInvokeRoute {
  const { senderIsRemote, senderProfileId, conn } = input
  if (!senderIsRemote || !senderProfileId) return { kind: 'local' }
  const status = computeProfileWindowStatus(senderProfileId, conn)
  if (status.connected) return { kind: 'remote' }
  return { kind: 'refuse', errorCode: REMOTE_NOT_CONNECTED, profileId: senderProfileId, reason: status.reason ?? 'disconnected' }
}

/**
 * T0443 / T0462: which profiles get a `remote:client-status-changed` push.
 * `profileIds` names every profile the change may concern; each is computed from
 * its own entry and pushed once, only when its status differs from the last one
 * pushed (`lastPushed` is updated in place).
 */
export function planProfileStatusPushes(
  profileIds: ReadonlyArray<string | null | undefined>,
  getConn: (profileId: string) => RemoteProfileConnState | null,
  lastPushed: Map<string, string>,
): RemoteProfileWindowStatus[] {
  const pushes: RemoteProfileWindowStatus[] = []
  for (const profileId of new Set(profileIds)) {
    if (!profileId) continue
    const status = computeProfileWindowStatus(profileId, getConn(profileId))
    const key = `${status.state}:${status.reason ?? ''}`
    if (lastPushed.get(profileId) === key) continue
    lastPushed.set(profileId, key)
    pushes.push(status)
  }
  return pushes
}

export type ConnectionAdmission =
  | { kind: 'existing' }
  | { kind: 'admit' }
  | { kind: 'reject'; reason: 'limit'; cap: number }

/**
 * T0462 (T0459 Q2): may a profile take a registry entry? Entries count while
 * connecting or reconnecting; a profile that already has one is never refused.
 * At the cap a new profile is refused — no existing connection is pushed out.
 */
export function planConnectionAdmission(input: { entryCount: number; hasEntry: boolean; cap: number }): ConnectionAdmission {
  if (input.hasEntry) return { kind: 'existing' }
  if (input.entryCount >= input.cap) return { kind: 'reject', reason: 'limit', cap: input.cap }
  return { kind: 'admit' }
}

/**
 * T0462 (T0459 Q1): after a window of the profile closed (and again when the
 * grace runs out), release its entry only when no live window is left.
 */
export function planIdleRelease(input: { liveWindowCount: number; hasEntry: boolean }): { kind: 'none' | 'keep' | 'release' } {
  if (!input.hasEntry) return { kind: 'none' }
  return { kind: input.liveWindowCount > 0 ? 'keep' : 'release' }
}

/**
 * T0462 (T0459 Q3): profiles whose entry targets the same server (host + port
 * + token). Allowed, but logged: both connections receive that server's events.
 */
export function findSameTargetProfiles(
  entries: Iterable<{ profileId: string; target: { host: string; port: number; token: string } | null }>,
  target: { host: string; port: number; token: string },
  excludeProfileId?: string,
): string[] {
  const matches: string[] = []
  for (const entry of entries) {
    if (entry.profileId === excludeProfileId || !entry.target) continue
    if (sameTarget(entry.target, target)) matches.push(entry.profileId)
  }
  return matches
}
