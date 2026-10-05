/**
 * T0462 (PLAN-039): per-profile remote connection registry.
 *
 * main.ts used to hold a single module-level `remoteClient`: opening a second
 * remote profile pushed the first one's client out, and its windows fell back
 * to `'other-profile'`. The registry keeps one entry per remote profile:
 *
 * - **cap** — at most `MAX_CONCURRENT_REMOTE_PROFILES` entries (connecting and
 *   reconnecting ones included). A new profile at the cap is refused; no
 *   existing connection is pushed out. The admission check and the entry
 *   placeholder happen synchronously, before the first `await`, so two profiles
 *   opening at once cannot both pass the check.
 * - **per-profile mutex** — connect / release / drop of one profile run one at
 *   a time (T0184 / T0430 / T0442 semantics); different profiles never wait on
 *   each other, so their handshakes and SSH tunnels run in parallel.
 * - **idle release** — when the profile's last window closed, the entry is
 *   disconnected after `IDLE_GRACE_MS`; the live window count is computed again
 *   at expiry, and a reuse cancels the pending release.
 * - **first-window guard** — a connection made before its window exists
 *   (`loadProfileSnapshotDetailed`) is released after `FIRST_WINDOW_GRACE_MS`
 *   when no window ever shows up.
 * - **same target** — two profiles pointing at one server (host + port + token)
 *   are allowed; the connect outcome names the other profiles so the caller can
 *   warn (T0459 Q3).
 *
 * No electron import: the client factory, the live window count and the release
 * callback are injected (main.ts wires them in T0463 / T0464).
 */
import {
  BINDING_MISSING_ERROR,
  findSameTargetProfiles,
  planConnectionAdmission,
  planIdleRelease,
  planProfileRemoteConnect,
  settleRemoteConnect,
  type RemoteConnectBoundProfile,
  type RemoteConnectRequest,
  type RemoteConnectTarget,
  type RemoteProfileConnState,
} from './remote-connect-plan'

/** T0459 Q2: concurrent remote profiles (temporary test / list-profiles clients are not counted). */
export const MAX_CONCURRENT_REMOTE_PROFILES = 8
/** T0459 Q1: grace between a profile's last window closing and its disconnect. */
export const IDLE_GRACE_MS = 15_000
/** How long a connection may wait for its first window before it is released. */
export const FIRST_WINDOW_GRACE_MS = 60_000
/** Upper bound `disconnectAll` waits for clients (and their ssh subprocesses) at quit. */
export const DISCONNECT_ALL_TIMEOUT_MS = 2_000

/** The part of `RemoteClient` the registry relies on. */
export interface RegistryClient {
  readonly isConnected: boolean
  readonly isReconnecting: boolean
  disconnect(): Promise<void>
}

export type RemoteReleaseReason = 'idle' | 'first-window'

/** A profile's entry as callers see it (`client: null` = first connect in progress). */
export interface RemoteProfileConnection<C> {
  readonly profileId: string
  readonly client: C | null
  /** What the client was connected to; replaces main.ts's `remoteClientTargets` WeakMap. */
  readonly target: RemoteConnectTarget | null
}

export interface RemoteConnectionRegistryOptions<C extends RegistryClient, P extends RemoteConnectBoundProfile> {
  /** Builds the candidate client for a `connect` plan (main: `bindRemoteClient(new RemoteClient(...))`). */
  createClient: (profileId: string, profile: P | null) => C
  /** Live windows bound to the profile (main: `getWindowsForProfile(profileId).length`). */
  countLiveWindows: (profileId: string) => number
  /** Called after an idle / first-window release disconnected and removed an entry. */
  onReleased?: (profileId: string, reason: RemoteReleaseReason) => void
  cap?: number
  idleGraceMs?: number
  firstWindowGraceMs?: number
}

/** What `run` must report about the candidate's connect. */
export interface RegistryRunResult {
  ok: boolean
  /** The observed server fingerprint. */
  fingerprint?: string
}

export type RegistryConnectOutcome<C, R> =
  | { kind: 'reject'; error: string; errorCode: 'binding-missing' | 'fingerprint-missing' | 'fingerprint-mismatch' }
  | { kind: 'limit'; cap: number }
  | { kind: 'reuse'; client: C; fingerprint: string }
  | { kind: 'connected'; client: C; result: R; target: RemoteConnectTarget; sameTargetProfileIds: string[] }
  | { kind: 'failed'; result: R }
  /** The entry was torn down (`disconnectAll`) while the candidate was connecting; the candidate is disposed. */
  | { kind: 'aborted' }

interface Entry<C> {
  profileId: string
  client: C | null
  target: RemoteConnectTarget | null
  releaseTimer: ReturnType<typeof setTimeout> | null
  releaseKind: RemoteReleaseReason | null
  /** Bumped on every schedule / cancel; a fired timer only acts on its own generation. */
  releaseGeneration: number
}

async function disconnectQuietly(client: RegistryClient | null): Promise<void> {
  if (!client) return
  try {
    await client.disconnect()
  } catch {
    /* ignore */
  }
}

export class RemoteConnectionRegistry<C extends RegistryClient, P extends RemoteConnectBoundProfile = RemoteConnectBoundProfile> {
  private readonly entries = new Map<string, Entry<C>>()
  private readonly mutexes = new Map<string, Promise<unknown>>()
  private readonly createClient: (profileId: string, profile: P | null) => C
  private readonly countLiveWindows: (profileId: string) => number
  private readonly onReleased?: (profileId: string, reason: RemoteReleaseReason) => void
  readonly cap: number
  private readonly idleGraceMs: number
  private readonly firstWindowGraceMs: number

  constructor(options: RemoteConnectionRegistryOptions<C, P>) {
    this.createClient = options.createClient
    this.countLiveWindows = options.countLiveWindows
    this.onReleased = options.onReleased
    this.cap = options.cap ?? MAX_CONCURRENT_REMOTE_PROFILES
    this.idleGraceMs = options.idleGraceMs ?? IDLE_GRACE_MS
    this.firstWindowGraceMs = options.firstWindowGraceMs ?? FIRST_WINDOW_GRACE_MS
  }

  get size(): number {
    return this.entries.size
  }

  has(profileId: string): boolean {
    return this.entries.has(profileId)
  }

  profileIds(): string[] {
    return [...this.entries.keys()]
  }

  get(profileId: string): RemoteProfileConnection<C> | undefined {
    const entry = this.entries.get(profileId)
    return entry ? { profileId, client: entry.client, target: entry.target } : undefined
  }

  /** The profile's client state for the status / routing rules (`null` = no client). */
  connectionState(profileId: string): RemoteProfileConnState | null {
    const client = this.entries.get(profileId)?.client
    return client ? { isConnected: client.isConnected, isReconnecting: client.isReconnecting } : null
  }

  isProfileLive(profileId: string): boolean {
    return this.entries.get(profileId)?.client?.isConnected === true
  }

  /** Profiles whose entry targets this server (host + port + token). */
  sameTargetProfiles(target: { host: string; port: number; token: string }, excludeProfileId?: string): string[] {
    return findSameTargetProfiles(this.entries.values(), target, excludeProfileId)
  }

  /** Which release is pending for the profile, if any. */
  pendingRelease(profileId: string): RemoteReleaseReason | null {
    return this.entries.get(profileId)?.releaseKind ?? null
  }

  /**
   * Runs `fn` after every earlier operation of the same profile settled. A
   * rejected operation does not break the chain. Other profiles are not blocked.
   */
  runExclusive<T>(profileId: string, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.mutexes.get(profileId) ?? Promise.resolve()
    const task = previous.then(() => fn())
    const tail = task.catch(() => { /* keep the chain alive */ })
    this.mutexes.set(profileId, tail)
    void tail.then(() => {
      if (this.mutexes.get(profileId) === tail) this.mutexes.delete(profileId)
    })
    return task
  }

  /**
   * Connect (or reuse) the profile's client. The cap is checked and the entry
   * reserved synchronously; the plan, the handshake (`run`) and the swap run in
   * the profile's mutex. Only a successful connect replaces the entry's client;
   * a failed one disposes the candidate, and an entry that never got a client
   * gives its slot back.
   */
  connect<R extends RegistryRunResult>(input: {
    profileId: string | null
    profile: P | null
    request: RemoteConnectRequest
    run: (client: C, expectedFingerprint: string | undefined) => Promise<R>
  }): Promise<RegistryConnectOutcome<C, R>> {
    const { profileId } = input
    if (profileId === null) {
      return Promise.resolve({ kind: 'reject', error: BINDING_MISSING_ERROR, errorCode: 'binding-missing' })
    }
    if (!this.admit(profileId)) return Promise.resolve({ kind: 'limit', cap: this.cap })
    return this.runExclusive(profileId, () => this.connectExclusive(profileId, input))
  }

  /**
   * A window of the profile closed. With no live window left the entry is
   * released after the idle grace; otherwise any pending release is cancelled.
   */
  noteWindowClosed(profileId: string): 'none' | 'kept' | 'scheduled' {
    const entry = this.entries.get(profileId)
    const plan = planIdleRelease({ liveWindowCount: this.countLiveWindows(profileId), hasEntry: !!entry })
    if (!entry || plan.kind === 'none') return 'none'
    if (plan.kind === 'keep') {
      this.clearRelease(entry)
      return 'kept'
    }
    this.scheduleRelease(entry, 'idle', this.idleGraceMs)
    return 'scheduled'
  }

  /** Cancels the profile's pending release, including one whose timer already fired. */
  cancelRelease(profileId: string): void {
    const entry = this.entries.get(profileId)
    if (entry) this.clearRelease(entry)
  }

  /** Disconnects and removes the profile's entry (pin change, sender-scoped `remote:disconnect`). */
  dropProfile(profileId: string): Promise<boolean> {
    return this.runExclusive(profileId, async () => {
      const entry = this.entries.get(profileId)
      if (!entry) return false
      this.clearRelease(entry)
      this.entries.delete(profileId)
      await disconnectQuietly(entry.client)
      return true
    })
  }

  /**
   * App quit: removes every entry and waits for their clients to disconnect, at
   * most `timeoutMs`. Does not queue behind the per-profile mutexes. Returns the
   * number of entries removed.
   */
  async disconnectAll(timeoutMs = DISCONNECT_ALL_TIMEOUT_MS): Promise<number> {
    const entries = [...this.entries.values()]
    this.entries.clear()
    for (const entry of entries) this.clearRelease(entry)
    const clients = entries.map(e => e.client).filter((c): c is C => c !== null)
    if (clients.length > 0) {
      let timer: ReturnType<typeof setTimeout> | null = null
      await Promise.race([
        Promise.allSettled(clients.map(c => Promise.resolve().then(() => c.disconnect()))),
        new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs) }),
      ])
      if (timer) clearTimeout(timer)
    }
    return entries.length
  }

  /** Reserves an entry for the profile; false when a new profile hits the cap. */
  private admit(profileId: string): boolean {
    const admission = planConnectionAdmission({ entryCount: this.entries.size, hasEntry: this.entries.has(profileId), cap: this.cap })
    if (admission.kind === 'reject') return false
    if (admission.kind === 'admit') {
      this.entries.set(profileId, { profileId, client: null, target: null, releaseTimer: null, releaseKind: null, releaseGeneration: 0 })
    }
    return true
  }

  private async connectExclusive<R extends RegistryRunResult>(
    profileId: string,
    input: { profile: P | null; request: RemoteConnectRequest; run: (client: C, expectedFingerprint: string | undefined) => Promise<R> },
  ): Promise<RegistryConnectOutcome<C, R>> {
    const { profile, request, run } = input
    // An earlier operation in the queue may have released the entry.
    if (!this.entries.has(profileId) && !this.admit(profileId)) return { kind: 'limit', cap: this.cap }
    const entry = this.entries.get(profileId)!

    const plan = planProfileRemoteConnect({
      request,
      boundProfileId: profileId,
      boundProfile: profile,
      entry: entry.client ? { isConnected: entry.client.isConnected, target: entry.target } : null,
    })
    if (plan.kind === 'reject') {
      this.dropIfEmpty(entry)
      return { kind: 'reject', error: plan.error, errorCode: plan.errorCode }
    }
    if (plan.kind === 'reuse' && entry.client) {
      this.armAfterUse(entry)
      return { kind: 'reuse', client: entry.client, fingerprint: plan.fingerprint }
    }

    const candidate = this.createClient(profileId, profile)
    let result: R
    try {
      result = await run(candidate, plan.kind === 'connect' ? plan.expectedFingerprint : undefined)
    } catch (err) {
      await this.settle(entry, candidate, false)
      throw err
    }
    if (this.entries.get(profileId) !== entry) {
      await disconnectQuietly(candidate)
      return { kind: 'aborted' }
    }
    if (!result.ok) {
      await this.settle(entry, candidate, false)
      return { kind: 'failed', result }
    }
    const target: RemoteConnectTarget = { host: request.host, port: request.port, token: request.token, fingerprint: result.fingerprint ?? '' }
    entry.target = target
    await this.settle(entry, candidate, true)
    this.armAfterUse(entry)
    return { kind: 'connected', client: candidate, result, target, sameTargetProfileIds: this.sameTargetProfiles(target, profileId) }
  }

  /** T0430 swap rule within the entry: the candidate takes over only on success. */
  private async settle(entry: Entry<C>, candidate: C, ok: boolean): Promise<void> {
    const next = settleRemoteConnect({
      slot: { client: entry.client, profileId: entry.profileId },
      candidate,
      candidateProfileId: entry.profileId,
      ok,
    })
    entry.client = next.slot.client
    if (ok) {
      for (const client of next.dispose) void disconnectQuietly(client)
      return
    }
    await Promise.all(next.dispose.map(disconnectQuietly))
    this.dropIfEmpty(entry)
  }

  /** An entry that never got a client gives its slot back. */
  private dropIfEmpty(entry: Entry<C>): void {
    if (entry.client !== null || this.entries.get(entry.profileId) !== entry) return
    this.clearRelease(entry)
    this.entries.delete(entry.profileId)
  }

  /**
   * After a connect or reuse: a profile with a live window keeps its entry (any
   * pending release is cancelled); one without a window yet gets the
   * first-window guard.
   */
  private armAfterUse(entry: Entry<C>): void {
    if (this.countLiveWindows(entry.profileId) > 0) this.clearRelease(entry)
    else this.scheduleRelease(entry, 'first-window', this.firstWindowGraceMs)
  }

  private scheduleRelease(entry: Entry<C>, kind: RemoteReleaseReason, delayMs: number): void {
    this.clearRelease(entry)
    const generation = entry.releaseGeneration
    entry.releaseKind = kind
    const timer = setTimeout(() => {
      if (entry.releaseGeneration !== generation) return
      entry.releaseTimer = null
      void this.runExclusive(entry.profileId, () => this.releaseIfIdle(entry, generation, kind)).catch(() => { /* ignore */ })
    }, delayMs)
    ;(timer as { unref?: () => void }).unref?.()
    entry.releaseTimer = timer
  }

  private clearRelease(entry: Entry<C>): void {
    if (entry.releaseTimer) clearTimeout(entry.releaseTimer)
    entry.releaseTimer = null
    entry.releaseKind = null
    entry.releaseGeneration++
  }

  private async releaseIfIdle(entry: Entry<C>, generation: number, kind: RemoteReleaseReason): Promise<void> {
    if (this.entries.get(entry.profileId) !== entry || entry.releaseGeneration !== generation) return
    entry.releaseKind = null
    const plan = planIdleRelease({ liveWindowCount: this.countLiveWindows(entry.profileId), hasEntry: true })
    if (plan.kind !== 'release') return
    this.entries.delete(entry.profileId)
    await disconnectQuietly(entry.client)
    this.onReleased?.(entry.profileId, kind)
  }
}
