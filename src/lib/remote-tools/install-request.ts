/**
 * T0412 (PLAN-037 E): cross-window install queue, used by Electron main (T0407 §4 安裝 1-3).
 *
 *   local window (wizard / ProfileCard) ── remote-tools:request-install({ profileId, toolId, kind })
 *     → main validates, parks the request per profile (a newer one replaces it), opens or focuses
 *       that profile's window and pings it (`remote-tools:install-pending`)
 *   remote profile window ── remote-tools:take-pending-install
 *     → main hands the request only to a connected window bound to that profile; taking deletes it
 *
 * Only tool + kind travel: the remote window rebuilds the command from its own detection.
 * Electron-free so main's handlers are unit-testable.
 */
import {
  REMOTE_TOOL_IDS,
  REMOTE_TOOL_INSTALL_KINDS,
  type RemoteToolId,
  type RemoteToolInstallKind,
  type RemoteToolInstallRequest,
  type RemoteToolInstallRequestResult,
} from '../../types/remote-tools'

/** Same whitelist as `remote:detect-arch` / `remote:detect-tools`. */
const PROFILE_ID_RE = /^[a-zA-Z0-9._-]+$/

/** A request nobody took within this time (window failed to connect, user gave up) is dropped. */
export const PENDING_INSTALL_TTL_MS = 5 * 60_000

export type RemoteToolInstallValidation =
  | { ok: true; request: RemoteToolInstallRequest }
  | { ok: false; error: string }

/** Copies only the three fields after checking each; never echoes the rejected value. */
export function validateRemoteToolInstallRequest(raw: unknown): RemoteToolInstallValidation {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid install request' }
  const { profileId, toolId, kind } = raw as { profileId?: unknown; toolId?: unknown; kind?: unknown }
  if (typeof profileId !== 'string' || !PROFILE_ID_RE.test(profileId)) return { ok: false, error: 'Invalid profileId' }
  if (typeof toolId !== 'string' || !(REMOTE_TOOL_IDS as readonly string[]).includes(toolId)) return { ok: false, error: 'Invalid toolId' }
  if (typeof kind !== 'string' || !(REMOTE_TOOL_INSTALL_KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Invalid kind' }
  return { ok: true, request: { profileId, toolId: toolId as RemoteToolId, kind: kind as RemoteToolInstallKind } }
}

interface PendingEntry {
  request: RemoteToolInstallRequest
  at: number
}

/** `pendingInstalls: Map<profileId, Request>` — at most one per profile, the newest wins. */
export class PendingRemoteToolInstalls {
  private readonly pending = new Map<string, PendingEntry>()

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs: number = PENDING_INSTALL_TTL_MS,
  ) {}

  put(request: RemoteToolInstallRequest): void {
    this.pending.set(request.profileId, { request, at: this.now() })
  }

  /** Removes and returns the request for `profileId`; null when none or expired. */
  take(profileId: string): RemoteToolInstallRequest | null {
    const entry = this.pending.get(profileId)
    if (!entry) return null
    this.pending.delete(profileId)
    return this.now() - entry.at > this.ttlMs ? null : entry.request
  }

  /** Drops `request` unless a newer one already replaced it. */
  discard(request: RemoteToolInstallRequest): void {
    if (this.pending.get(request.profileId)?.request === request) this.pending.delete(request.profileId)
  }

  has(profileId: string): boolean {
    return this.pending.has(profileId)
  }

  get size(): number {
    return this.pending.size
  }
}

export interface RemoteToolInstallIpcDeps {
  getProfile(profileId: string): Promise<{ type?: string } | null | undefined>
  /** `app:open-new-instance` logic: focus an open window of the profile, or restore / open one. */
  openProfileWindow(profileId: string): Promise<{ error?: string } | unknown>
  /** Pings the profile's open windows so an already-connected one takes the request now. */
  notifyProfileWindows(profileId: string): void
}

/** What the remote window gets: tool + kind only. */
export type PendingRemoteToolInstall = Pick<RemoteToolInstallRequest, 'toolId' | 'kind'>

export interface RemoteToolInstallSender {
  /** Profile bound to the sender window's registry entry (null: none / unknown window). */
  profileId: string | null | undefined
  /** The sender is connected to that profile's bat-server (a live remote window). */
  connected: boolean
}

export function createRemoteToolInstallIpc(queue: PendingRemoteToolInstalls, deps: RemoteToolInstallIpcDeps) {
  return {
    async requestInstall(raw: unknown): Promise<RemoteToolInstallRequestResult> {
      const validated = validateRemoteToolInstallRequest(raw)
      if (!validated.ok) return validated
      const { request } = validated
      const profile = await deps.getProfile(request.profileId)
      if (!profile) return { ok: false, error: `Profile not found: ${request.profileId}` }
      if (profile.type !== 'remote') return { ok: false, error: 'Not a remote profile' }

      queue.put(request)
      let opened: unknown
      try {
        opened = await deps.openProfileWindow(request.profileId)
      } catch (err) {
        queue.discard(request)
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
      const openError = opened && typeof opened === 'object' ? (opened as { error?: unknown }).error : undefined
      if (typeof openError === 'string' && openError) {
        queue.discard(request)
        return { ok: false, error: openError }
      }
      deps.notifyProfileWindows(request.profileId)
      return { ok: true }
    },

    /** Only a connected window bound to the request's profile can take it; taking deletes it. */
    takePendingInstall(sender: RemoteToolInstallSender): PendingRemoteToolInstall | null {
      const { profileId } = sender
      if (!sender.connected || typeof profileId !== 'string' || !PROFILE_ID_RE.test(profileId)) return null
      const request = queue.take(profileId)
      return request ? { toolId: request.toolId, kind: request.kind } : null
    },
  }
}
