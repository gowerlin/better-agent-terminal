// T0513 (BUG-123) — status light of a remote card in the Profile dialog.
//
// The light used to ask the target's `profile:list` whether the card's profile
// was active there. A headless bat-server (WSL / SSH / Docker) answers that with
// an empty stub, so those cards were red even with their window open. The light
// now follows this machine's facts first: the connection the main process holds
// for the profile (PLAN-039 registry) and the profile's live windows. A probe of
// the target only decides between "idle" and "connection failed" for a profile
// that has neither.
import type { ConnectionStatus, ProfileEntry } from './types'

/** Mirrors main's `RemoteProfileConnectionSnapshot` (`remote:profile-connection-states`). */
export interface RemoteProfileConnectionSnapshot {
  profileId: string
  /** null = no connection held on this machine. */
  state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | null
  /** Live windows bound to the profile (detached and tray-hidden ones count). */
  windows: number
}

/** What a probe of the target (`remote:list-profiles`) found. */
export type RemoteProbeResult =
  | { ok: true; remoteActive: boolean }
  | { ok: false; errorCode?: string; error: string }

/** i18n key suffix under `profiles.status.*` explaining the light. */
export type RemoteStatusReason =
  | 'linked'
  | 'connecting'
  | 'reconnecting'
  | 'linkLost'
  | 'fingerprintMissing'
  | 'probeFailed'
  | 'reachable'
  | 'reachableRemoteActive'
  | 'notChecked'

export interface RemoteCardStatus {
  status: ConnectionStatus
  reason: RemoteStatusReason
  /** Failed probe: RemoteClient's errorCode (auth-failed / fingerprint-mismatch / timeout / network / …). */
  errorCode?: string
  /** Failed probe: raw error text. */
  detail?: string
}

/** Probe error codes with a translated short reason (`profiles.statusProbeError.*`). */
const PROBE_ERROR_KEYS: Record<string, string> = {
  'auth-failed': 'authFailed',
  'fingerprint-mismatch': 'fingerprintMismatch',
  timeout: 'timeout',
  network: 'network',
}

/**
 * ssh-* profiles always connect through an SSH tunnel (T0425): their
 * `remoteHost:remotePort` is the server's localhost, so a direct probe would
 * reach this machine instead. Such a profile is never probed.
 */
export function isProbeableRemoteProfile(profile: ProfileEntry): boolean {
  if (profile.type !== 'remote') return false
  if (profile.targetOS === 'ssh-linux' || profile.targetOS === 'ssh-darwin') return false
  return !!(profile.remoteHost && profile.remoteToken && profile.remoteFingerprint)
}

/** Should the dialog probe this profile's target? Only when this machine has nothing to say about it. */
export function needsRemoteProbe(profile: ProfileEntry, conn: RemoteProfileConnectionSnapshot | undefined): boolean {
  if (!isProbeableRemoteProfile(profile)) return false
  return !conn || (conn.state === null && conn.windows === 0)
}

export function computeRemoteCardStatus(input: {
  profile: ProfileEntry
  conn?: RemoteProfileConnectionSnapshot
  probe?: RemoteProbeResult
}): RemoteCardStatus {
  const { profile, conn, probe } = input
  switch (conn?.state) {
    case 'connected':
      return { status: 'connected', reason: 'linked' }
    case 'connecting':
      return { status: 'connecting', reason: 'connecting' }
    case 'reconnecting':
      return { status: 'connecting', reason: 'reconnecting' }
    case 'disconnected':
      return { status: 'disconnected', reason: 'linkLost' }
  }
  // A window is open but this machine holds no connection for it.
  if (conn && conn.windows > 0) return { status: 'disconnected', reason: 'linkLost' }
  // main refuses to connect a remote profile without a pinned fingerprint.
  if (profile.remoteHost && profile.remoteToken && !profile.remoteFingerprint) {
    return { status: 'disconnected', reason: 'fingerprintMissing' }
  }
  if (probe && !probe.ok) return { status: 'disconnected', reason: 'probeFailed', errorCode: probe.errorCode, detail: probe.error }
  if (probe?.ok) return { status: 'idle', reason: probe.remoteActive ? 'reachableRemoteActive' : 'reachable' }
  return { status: 'idle', reason: 'notChecked' }
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/** Tooltip of the light: `profiles.statusReason.*`, a failed probe adds its short reason and raw error. */
export function formatRemoteStatusTitle(t: Translate, status: RemoteCardStatus): string {
  if (status.reason !== 'probeFailed') return t(`profiles.statusReason.${status.reason}`)
  const key = (status.errorCode && PROBE_ERROR_KEYS[status.errorCode]) || 'unknown'
  const short = t(`profiles.statusProbeError.${key}`)
  const detail = status.detail && status.detail.trim() ? ` (${status.detail.trim()})` : ''
  return t('profiles.statusReason.probeFailed', { reason: `${short}${detail}` })
}
