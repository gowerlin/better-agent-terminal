/**
 * PLAN-036 P3 / K (T0432, T0420 方案 A'): per-PTY capability tokens for the helpers
 * (`bat-terminal.mjs` / `bat-notify.mjs`) running inside a headless PTY.
 *
 * A capability authenticates a RemoteServer connection as a *helper*, not a client:
 * it may invoke only the channels of its role, only against the terminal it is bound
 * to (`authorizeHelperInvoke`). Everything else is denied.
 *
 *   - role `tower`  (PTY without a notify target): `terminal:create-agent-command`,
 *     creating a NEW terminal whose notify target is the tower itself (or none), with a
 *     registry agent, within `HelperTowerSpawnQuota` (T0450)
 *     PLAN-041 / T0536: also `terminal:close-worker` for itself only (`towerId` = its own
 *     terminal); the handler then closes only a worker of this tower (`isWorkerOf`)
 *     T0562: also `terminal:set-role` for its own terminal only (`terminalId` = its own terminal)
 *   - role `worker` (PTY created with `BAT_TOWER_TERMINAL_ID`): `terminal:notify` /
 *     `pty:write` (printable text only, T0450) / `terminal:keypress`, target = that tower only
 *
 * PLAN-047 / T0575 (D149): Electron's local PTYs get these capabilities too (`buildLocalHelperEnv`),
 * no longer the full server token. The local RemoteServer uses `LOCAL_HELPER_CHANNEL_ROLES`, which
 * also lets a tower call `terminal:create-with-command` (raw command mode) under the
 * create-agent-command limits; headless keeps `HELPER_CHANNEL_ROLES` (raw command denied).
 *
 * Tokens are `HELPER_CAPABILITY_TOKEN_PREFIX` + `randomBytes(32)`; the registry keeps their
 * SHA-256 digest (never the token) and nothing logs a token. The PTY's exit / kill revokes its
 * token. Headless keeps them in memory only: a new server process starts with an empty registry.
 * Revoked digests are remembered for a while (bounded, TTL) so a stale helper gets
 * `Capability revoked` instead of counting as a failed auth (T0449).
 *
 * PLAN-047 / T0576: Electron persists the live records (digest + binding, `records()` /
 * `onChange`) to `<userData>/helper-capabilities.json` (`writeHelperCapabilityStore`), because
 * the Terminal Server keeps the PTYs — and the tokens in their env — alive while BAT is closed.
 * The next BAT process `restore`s them as *pending*, and `settleRestored` keeps only those whose
 * PTY the Terminal Server still runs (T0108 replay list); no surviving server ⇒ all dropped.
 *
 * 🔴 No `electron` import here (headless-electron-free guard).
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

export type HelperCapabilityRole = 'tower' | 'worker'

export interface HelperCapability {
  terminalId: string
  /** Worker only: the tower terminal this PTY reports to (its `BAT_TOWER_TERMINAL_ID`). */
  towerId?: string
  role: HelperCapabilityRole
}

/** Terminal ids a capability may be bound to / name (same whitelist as other external ids). */
export const HELPER_TERMINAL_ID_PATTERN = /^[a-zA-Z0-9._-]+$/

const CAPABILITY_TOKEN_BYTES = 32

/**
 * T0449 (T0445 #5): every capability token starts with this. `.` is outside base64url /
 * hex, so a generated server token never carries it: a failed auth with this prefix is a
 * capability failure, not a server-token guess (see `isCapabilityTokenShaped`).
 */
export const HELPER_CAPABILITY_TOKEN_PREFIX = 'batcap.'

/** T0449: how long / how many revoked capability digests are remembered. */
export const REVOKED_CAPABILITY_TTL_MS = 10 * 60_000
export const REVOKED_CAPABILITY_CAPACITY = 1024

/** T0449: whether `token` has the capability token form (prefix), regardless of validity. */
export function isCapabilityTokenShaped(token: unknown): token is string {
  return typeof token === 'string' && token.startsWith(HELPER_CAPABILITY_TOKEN_PREFIX)
}

export interface HelperCapabilityRegistryOptions {
  /** Clock for the revoked-digest TTL and `issuedAt` (tests). Default `Date.now`. */
  now?: () => number
  revokedTtlMs?: number
  revokedCapacity?: number
  /**
   * T0576: called after the live records changed (issue / revoke / clear / restore / settle);
   * Electron writes `records()` to disk here. A throwing listener is ignored.
   */
  onChange?: () => void
}

/**
 * T0576: one live capability as it is persisted — the SHA-256 digest of the token (hex), never
 * the token, plus its binding and when it was issued (ms since epoch).
 */
export interface PersistedHelperCapability {
  digest: string
  terminalId: string
  role: HelperCapabilityRole
  towerId?: string
  issuedAt: number
}

interface CapabilityEntry {
  digest: Buffer
  capability: HelperCapability
  issuedAt: number
  /**
   * T0576: loaded by `restore`, not yet matched against the PTYs the Terminal Server still runs
   * (`settleRestored`). While pending, `issue` for the same terminal does not revoke it: a
   * restored tab's `pty:create` may reach the main process before the T0108 replay list and get
   * a capability whose env goes nowhere (the server keeps the running PTY).
   */
  pending?: boolean
}

const DIGEST_HEX_PATTERN = /^[0-9a-f]{64}$/

function digestOf(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

/**
 * Constant-time string comparison (server token / capability digests). Different
 * lengths return false before `timingSafeEqual`, which throws on a length mismatch.
 */
export function safeTokenEqual(candidate: unknown, expected: string): boolean {
  if (typeof candidate !== 'string' || !candidate || !expected) return false
  const a = Buffer.from(candidate, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function isTerminalId(value: unknown): value is string {
  return typeof value === 'string' && HELPER_TERMINAL_ID_PATTERN.test(value)
}

/** T0576: a persisted record as the registry accepts it, or null (malformed / inconsistent). */
function parsePersistedRecord(raw: unknown): PersistedHelperCapability | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { digest, terminalId, role, towerId, issuedAt } = raw as Record<string, unknown>
  if (typeof digest !== 'string' || !DIGEST_HEX_PATTERN.test(digest)) return null
  if (!isTerminalId(terminalId)) return null
  if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt)) return null
  if (role === 'worker') {
    if (!isTerminalId(towerId) || towerId === terminalId) return null
    return { digest, terminalId, role, towerId, issuedAt }
  }
  if (role === 'tower' && towerId === undefined) return { digest, terminalId, role, issuedAt }
  return null
}

export class HelperCapabilityRegistry {
  /** digest (hex) → entry */
  private readonly entries = new Map<string, CapabilityEntry>()
  /** T0449: revoked digest (hex) → forget-at time; insertion order = oldest first. */
  private readonly revoked = new Map<string, number>()
  private readonly now: () => number
  private readonly revokedTtlMs: number
  private readonly revokedCapacity: number
  private readonly onChange?: () => void

  constructor(opts: HelperCapabilityRegistryOptions = {}) {
    this.now = opts.now ?? Date.now
    this.revokedTtlMs = opts.revokedTtlMs ?? REVOKED_CAPABILITY_TTL_MS
    this.revokedCapacity = Math.max(0, opts.revokedCapacity ?? REVOKED_CAPABILITY_CAPACITY)
    this.onChange = opts.onChange
  }

  get size(): number {
    return this.entries.size
  }

  /**
   * Issues the capability of PTY `terminalId` and returns its token. One live token per
   * PTY: issuing again (re-create / restart) revokes the previous one. `towerId` makes
   * it a worker capability bound to that tower.
   * T0576: a *pending* restored capability of the terminal is kept (`CapabilityEntry.pending`);
   * `settleRestored` later keeps one of the two.
   */
  issue(terminalId: string, opts: { towerId?: string } = {}): string {
    if (!isTerminalId(terminalId)) throw new Error('helper capability: invalid terminal id')
    const towerId = opts.towerId || undefined
    if (towerId !== undefined && !isTerminalId(towerId)) throw new Error('helper capability: invalid tower id')
    this.revokeWhere(entry => entry.capability.terminalId === terminalId && !entry.pending, false)
    const token = HELPER_CAPABILITY_TOKEN_PREFIX + randomBytes(CAPABILITY_TOKEN_BYTES).toString('base64url')
    const digest = digestOf(token)
    const capability: HelperCapability = towerId
      ? { terminalId, towerId, role: 'worker' }
      : { terminalId, role: 'tower' }
    this.entries.set(digest.toString('hex'), { digest, capability, issuedAt: this.now() })
    this.changed()
    return token
  }

  /** T0576: the live capabilities as persisted (digest, binding, issuedAt) — never a token. */
  records(): PersistedHelperCapability[] {
    const out: PersistedHelperCapability[] = []
    for (const [key, entry] of this.entries) {
      const { terminalId, towerId, role } = entry.capability
      out.push(towerId
        ? { digest: key, terminalId, role, towerId, issuedAt: entry.issuedAt }
        : { digest: key, terminalId, role, issuedAt: entry.issuedAt })
    }
    return out
  }

  /**
   * T0576: loads persisted records (a previous BAT process) as *pending* capabilities: they
   * authenticate right away, until `settleRestored` keeps the ones whose PTY still runs.
   * Malformed records (digest, ids, role / tower mismatch) and digests already live are skipped.
   * Returns how many were restored.
   */
  restore(records: readonly unknown[]): number {
    let restored = 0
    for (const raw of records) {
      const record = parsePersistedRecord(raw)
      if (!record || this.entries.has(record.digest)) continue
      const capability: HelperCapability = record.towerId
        ? { terminalId: record.terminalId, towerId: record.towerId, role: 'worker' }
        : { terminalId: record.terminalId, role: 'tower' }
      this.revoked.delete(record.digest)
      this.entries.set(record.digest, { digest: Buffer.from(record.digest, 'hex'), capability, issuedAt: record.issuedAt, pending: true })
      restored++
    }
    if (restored > 0) this.changed()
    return restored
  }

  /**
   * T0576: settles the pending restored capabilities once it is known which PTYs survived the
   * BAT restart (`isAlive`: on the Terminal Server's replay list; `() => false` when no Terminal
   * Server survived). A surviving PTY keeps its restored capability — the token in its env — and
   * loses any capability issued for it meanwhile (that env went nowhere); a gone PTY loses the
   * restored one. Returns the terminal ids kept / dropped.
   */
  settleRestored(isAlive: (terminalId: string) => boolean): { kept: string[]; dropped: string[] } {
    const kept = new Set<string>()
    const dropped = new Set<string>()
    for (const entry of this.entries.values()) {
      if (!entry.pending) continue
      if (isAlive(entry.capability.terminalId)) kept.add(entry.capability.terminalId)
      else dropped.add(entry.capability.terminalId)
    }
    if (kept.size === 0 && dropped.size === 0) return { kept: [], dropped: [] }
    this.revokeWhere(entry => entry.pending
      ? dropped.has(entry.capability.terminalId)
      : kept.has(entry.capability.terminalId), false)
    for (const entry of this.entries.values()) entry.pending = false
    this.changed()
    return { kept: [...kept], dropped: [...dropped] }
  }

  /** T0576: whether a restored capability still waits for `settleRestored`. */
  hasPendingRestored(): boolean {
    for (const entry of this.entries.values()) if (entry.pending) return true
    return false
  }

  /**
   * Resolves a presented token. Returns the lookup `key` (for `lookup`, i.e. the
   * revocation check on every later frame) and a copy of the capability, or null.
   */
  verify(token: unknown): { key: string; capability: HelperCapability } | null {
    if (typeof token !== 'string' || !token) return null
    const digest = digestOf(token)
    const key = digest.toString('hex')
    const entry = this.entries.get(key)
    if (!entry || !timingSafeEqual(entry.digest, digest)) return null
    return { key, capability: { ...entry.capability } }
  }

  /** The capability behind `key` while it is still live (not revoked), else null. */
  lookup(key: string): HelperCapability | null {
    const entry = this.entries.get(key)
    return entry ? { ...entry.capability } : null
  }

  /**
   * T0449: whether `token` is a capability revoked within the last `revokedTtlMs` (and not
   * yet evicted by the capacity bound). Unknown / live / expired ⇒ false.
   */
  isRecentlyRevoked(token: unknown): boolean {
    if (typeof token !== 'string' || !token) return false
    this.pruneRevoked()
    return this.revoked.has(digestOf(token).toString('hex'))
  }

  /**
   * PLAN-041 / T0536: whether PTY `childId` holds a live worker capability bound to tower
   * `towerId` — i.e. that tower dispatched it (`BAT_TOWER_TERMINAL_ID`). A terminal is never a
   * worker of itself. The `terminal:close-worker` handler checks its candidate with this.
   */
  isWorkerOf(childId: string, towerId: string): boolean {
    if (!childId || !towerId || childId === towerId) return false
    for (const entry of this.entries.values()) {
      const { capability } = entry
      if (capability.role === 'worker' && capability.terminalId === childId && capability.towerId === towerId) return true
    }
    return false
  }

  /**
   * T0576: whether PTY `terminalId` holds a live worker capability (of any tower). That binding
   * is its env's `BAT_TOWER_TERMINAL_ID`; the close-worker ownership check prefers it over the
   * saved tab (`capabilityOrSavedTabOwnership`).
   */
  hasWorkerCapability(terminalId: string): boolean {
    for (const entry of this.entries.values()) {
      if (entry.capability.role === 'worker' && entry.capability.terminalId === terminalId) return true
    }
    return false
  }

  /** Revokes every capability bound to PTY `terminalId`; returns how many were revoked. */
  revokeTerminal(terminalId: string): number {
    return this.revokeWhere(entry => entry.capability.terminalId === terminalId)
  }

  /** Revokes everything (server stop). */
  clear(): void {
    if (this.entries.size === 0) return
    for (const key of this.entries.keys()) this.rememberRevoked(key)
    this.entries.clear()
    this.changed()
  }

  private revokeWhere(match: (entry: CapabilityEntry) => boolean, notify = true): number {
    let revoked = 0
    for (const [key, entry] of this.entries) {
      if (match(entry)) {
        this.entries.delete(key)
        this.rememberRevoked(key)
        revoked++
      }
    }
    if (revoked > 0 && notify) this.changed()
    return revoked
  }

  private changed(): void {
    if (!this.onChange) return
    try {
      this.onChange()
    } catch {
      // the persisted copy is best-effort; the registry is the authority
    }
  }

  private rememberRevoked(key: string): void {
    if (this.revokedCapacity === 0) return
    this.pruneRevoked()
    this.revoked.delete(key)
    this.revoked.set(key, this.now() + this.revokedTtlMs)
    while (this.revoked.size > this.revokedCapacity) {
      const oldest = this.revoked.keys().next().value
      if (oldest === undefined) break
      this.revoked.delete(oldest)
    }
  }

  /** Drops expired revoked digests (insertion order ⇒ expiry order, TTL is constant). */
  private pruneRevoked(): void {
    const now = this.now()
    for (const [key, forgetAt] of this.revoked) {
      if (forgetAt > now) break
      this.revoked.delete(key)
    }
  }
}

/**
 * `customEnv` keys a helper may set on a terminal it creates — exactly what
 * bat-terminal.mjs sends (T0133 / T0180 / BUG-075). `BAT_TOWER_TERMINAL_ID` is
 * additionally bound to the caller (see `authorizeHelperInvoke`).
 */
export const HELPER_CREATE_ENV_KEYS: readonly string[] = [
  'BAT_TOWER_TERMINAL_ID',
  'CT_INTERACTIVE',
  'CT_MODE',
  'MSYS_NO_PATHCONV',
]

/** Channel → roles allowed to invoke it. Anything not listed is denied to every helper. */
export const HELPER_CHANNEL_ROLES: Readonly<Record<string, readonly HelperCapabilityRole[]>> = {
  'terminal:create-agent-command': ['tower'],
  // PLAN-041 / T0536: `bat-terminal.mjs --close-worker` — a tower closes a worker it dispatched
  'terminal:close-worker': ['tower'],
  // T0562 / D147: `bat-terminal.mjs --set-role tower` — a tower titles its own tab
  'terminal:set-role': ['tower'],
  'terminal:notify': ['worker'],
  'pty:write': ['worker'],
  'terminal:keypress': ['worker'],
}

/**
 * PLAN-047 / T0575 (D149): the role table of Electron's local RemoteServer — the headless one plus
 * raw command mode (`bat-terminal.mjs claude "/ct-exec T####"` → `terminal:create-with-command`) for
 * a tower, checked like `terminal:create-agent-command` (new id, no `shell`, `customEnv` whitelist,
 * `BAT_TOWER_TERMINAL_ID` = itself, `HelperTowerSpawnQuota`). A tower can run any command in its own
 * shell anyway; one more tab with a command of its choice adds little. Headless is unchanged.
 */
export const LOCAL_HELPER_CHANNEL_ROLES: Readonly<Record<string, readonly HelperCapabilityRole[]>> = {
  ...HELPER_CHANNEL_ROLES,
  'terminal:create-with-command': ['tower'],
}

/** T0575: channels that create a terminal — they also pass `HelperTowerSpawnQuota`. */
export const HELPER_CREATE_CHANNELS: readonly string[] = ['terminal:create-agent-command', 'terminal:create-with-command']

/**
 * T0450 (T0445 #6): what a worker may `pty:write` into its tower — printable text only. C0
 * controls (`\r` / `\n` / `\t` / `\x03` / ESC …), DEL and C1 controls are refused, so a worker
 * capability can pre-fill a line but never submit, interrupt or drive the tower's terminal;
 * submitting is `terminal:keypress` (Enter through the client's xterm).
 */
export const HELPER_PTY_WRITE_FORBIDDEN = /[\u0000-\u001f\u007f-\u009f]/

export interface HelperInvokeContext {
  /** Whether a PTY with this id is running. Missing ⇒ creating a terminal is denied (fail closed). */
  isTerminalAlive?: (id: string) => boolean
  /**
   * T0450 (T0445 #7): whether `agent` is an agent registry id (builtin or a registered custom
   * CLI). Missing ⇒ an explicit agent is denied (fail closed); `default` / omitted is the
   * host's configured default agent.
   */
  isKnownAgent?: (agent: string) => boolean
  /** T0575: the server's role table. Default `HELPER_CHANNEL_ROLES` (headless). */
  channelRoles?: Readonly<Record<string, readonly HelperCapabilityRole[]>>
}

export type HelperInvokeDecision = { ok: true } | { ok: false; reason: string }

function deny(reason: string): HelperInvokeDecision {
  return { ok: false, reason }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/**
 * Default-deny authorization of one helper invoke (channel whitelist + target binding).
 * `args` are the frame args as the handler would receive them.
 */
export function authorizeHelperInvoke(
  capability: HelperCapability,
  channel: string,
  args: unknown[],
  ctx: HelperInvokeContext = {},
): HelperInvokeDecision {
  // T0447 (T0445 #2): frame fields are attacker-controlled. Own keys only — `constructor` /
  // `__proto__` / `toString` … must not resolve to Object.prototype members, and a non-string
  // channel (e.g. `['pty:write']`) must not be coerced into a whitelisted key.
  const channelRoles = ctx.channelRoles ?? HELPER_CHANNEL_ROLES
  if (typeof channel !== 'string') return deny('channel-not-allowed')
  if (!Object.prototype.hasOwnProperty.call(channelRoles, channel)) return deny('channel-not-allowed')
  if (!Array.isArray(args)) return deny('invalid-args')
  const roles = channelRoles[channel]
  if (!roles.includes(capability.role)) return deny('role-not-allowed')

  switch (channel) {
    case 'terminal:create-with-command':
    case 'terminal:create-agent-command': {
      const opts = asRecord(args[0])
      if (!opts) return deny('invalid-payload')
      // T0575: raw command mode — the command is typed into the new shell; a string or nothing.
      if (channel === 'terminal:create-with-command' && opts.command !== undefined && opts.command !== null && typeof opts.command !== 'string') {
        return deny('invalid-payload')
      }
      // A NEW terminal only: create-with-command types the command into an existing id.
      if (!isTerminalId(opts.id)) return deny('invalid-terminal-id')
      if (opts.id === capability.terminalId) return deny('target-not-bound')
      if (!ctx.isTerminalAlive) return deny('terminal-liveness-unknown')
      if (ctx.isTerminalAlive(opts.id)) return deny('terminal-exists')
      // The host's default shell only; a client-chosen executable is not a helper's call.
      if (opts.shell !== undefined && opts.shell !== null && opts.shell !== '') return deny('shell-not-allowed')
      // T0450 (T0445 #7): a registry agent only — an unknown id is not something to launch.
      if (opts.agent !== undefined && opts.agent !== null && opts.agent !== '' && opts.agent !== 'default') {
        if (typeof opts.agent !== 'string') return deny('invalid-agent')
        if (!ctx.isKnownAgent) return deny('agent-registry-unknown')
        if (!ctx.isKnownAgent(opts.agent)) return deny('agent-not-allowed')
      }
      if (opts.customEnv !== undefined && opts.customEnv !== null) {
        const env = asRecord(opts.customEnv)
        if (!env) return deny('invalid-custom-env')
        for (const [key, value] of Object.entries(env)) {
          if (!HELPER_CREATE_ENV_KEYS.includes(key)) return deny('custom-env-not-allowed')
          if (typeof value !== 'string') return deny('invalid-custom-env')
        }
        // The new worker may only report back to the tower that created it.
        if (env.BAT_TOWER_TERMINAL_ID !== undefined && env.BAT_TOWER_TERMINAL_ID !== capability.terminalId) {
          return deny('tower-not-bound')
        }
      }
      return { ok: true }
    }
    case 'terminal:close-worker': {
      // PLAN-041 / T0536: `{ towerId, workorder, delayMs? }`. A tower asks for itself only —
      // naming another tower would close that tower's workers. Which worker the work order
      // resolves to (and whether it belongs to this tower) is the handler's check (`isWorkerOf`).
      const opts = asRecord(args[0])
      if (!opts) return deny('invalid-payload')
      if (opts.towerId !== capability.terminalId) return deny('tower-not-bound')
      return { ok: true }
    }
    case 'terminal:set-role': {
      // T0562: `{ terminalId, role, agent? }`. A tower sets the role of its own tab only.
      const opts = asRecord(args[0])
      if (!opts) return deny('invalid-payload')
      if (opts.terminalId !== capability.terminalId) return deny('target-not-bound')
      return { ok: true }
    }
    case 'terminal:notify':
    case 'terminal:keypress': {
      const opts = asRecord(args[0])
      if (!opts) return deny('invalid-payload')
      return opts.targetId === capability.towerId ? { ok: true } : deny('target-not-bound')
    }
    case 'pty:write':
      if (args[0] !== capability.towerId) return deny('target-not-bound')
      // T0450 (T0445 #6): pre-fill text only; submitting is terminal:keypress.
      if (typeof args[1] !== 'string') return deny('invalid-payload')
      return HELPER_PTY_WRITE_FORBIDDEN.test(args[1]) ? deny('control-character-not-allowed') : { ok: true }
    default:
      return deny('channel-not-allowed')
  }
}

/** T0450 (T0445 #7): most child PTYs one tower may have running (created through its capability). */
export const HELPER_TOWER_MAX_LIVE_CHILDREN = 8
/** T0450: least time between two terminal creations of one tower. */
export const HELPER_TOWER_CREATE_INTERVAL_MS = 1000
/** T0450: PTY slots a helper may never take — kept for the clients (only when the server caps PTYs). */
export const HELPER_CLIENT_RESERVED_PTYS = 8

/** T0450: the server's PTY usage. `max` 0 = unlimited (no reserve is kept then). */
export interface HelperPtyCapacity {
  count: number
  max: number
}

export interface HelperSpawnContext {
  isTerminalAlive: (id: string) => boolean
  /** Missing / null ⇒ the creation is denied (fail closed). */
  getPtyCapacity?: () => HelperPtyCapacity | null
}

export interface HelperTowerSpawnQuotaOptions {
  now?: () => number
  maxLiveChildren?: number
  createIntervalMs?: number
  reservedForClients?: number
}

export type HelperSpawnReservation = { ok: true; settle: () => void } | { ok: false; reason: string }

interface TowerSpawnEntry {
  /** Child ids created (or being created) by this tower; pruned once their PTY is gone. */
  children: Set<string>
  /** Children whose creation is still in flight (not counted by the PTY manager yet). */
  pending: Set<string>
  lastCreateAt: number
}

/**
 * T0450 (T0445 #7): limits on terminals a tower capability creates (`terminal:create-agent-command`),
 * checked after `authorizeHelperInvoke` allowed the invoke:
 *   - at most `maxLiveChildren` of its children running (in flight counts)
 *   - at least `createIntervalMs` between two creations (every allowed attempt counts)
 *   - with a PTY cap, helpers stop `reservedForClients` slots short of it, so a tower never
 *     takes the last slots the BAT clients need to open terminals
 * Keyed by the tower's terminal id (one live capability per PTY, so this is per token, and a
 * restarted tower keeps its running children's count). Memory only, like the registry.
 */
export class HelperTowerSpawnQuota {
  private readonly towers = new Map<string, TowerSpawnEntry>()
  private readonly now: () => number
  private readonly maxLiveChildren: number
  private readonly createIntervalMs: number
  private readonly reservedForClients: number

  constructor(opts: HelperTowerSpawnQuotaOptions = {}) {
    this.now = opts.now ?? Date.now
    this.maxLiveChildren = opts.maxLiveChildren ?? HELPER_TOWER_MAX_LIVE_CHILDREN
    this.createIntervalMs = opts.createIntervalMs ?? HELPER_TOWER_CREATE_INTERVAL_MS
    this.reservedForClients = opts.reservedForClients ?? HELPER_CLIENT_RESERVED_PTYS
  }

  /**
   * Checks the quota of tower `towerId` for creating `childId` and, when allowed, records the
   * creation synchronously (so pipelined invokes see it). `settle()` once the creation is done.
   */
  reserve(towerId: string, childId: string, ctx: HelperSpawnContext): HelperSpawnReservation {
    const capacity = ctx.getPtyCapacity?.() ?? null
    if (!capacity) return { ok: false, reason: 'pty-capacity-unknown' }
    const now = this.now()
    this.prune(ctx.isTerminalAlive, now)

    const entry = this.towers.get(towerId)
    if (entry && now - entry.lastCreateAt < this.createIntervalMs) return { ok: false, reason: 'create-rate-limited' }
    if (entry && entry.children.size >= this.maxLiveChildren) return { ok: false, reason: 'too-many-children' }
    if (capacity.max > 0) {
      // In-flight creations are not running PTYs yet; count them so a burst cannot overshoot.
      let inFlight = 0
      for (const tower of this.towers.values()) {
        for (const id of tower.pending) if (!ctx.isTerminalAlive(id)) inFlight++
      }
      if (capacity.count + inFlight >= capacity.max - this.reservedForClients) {
        return { ok: false, reason: 'pty-quota-reserved' }
      }
    }

    const record = entry ?? { children: new Set<string>(), pending: new Set<string>(), lastCreateAt: now }
    record.children.add(childId)
    record.pending.add(childId)
    record.lastCreateAt = now
    this.towers.set(towerId, record)
    let settled = false
    return {
      ok: true,
      settle: () => {
        if (settled) return
        settled = true
        record.pending.delete(childId)
        if (!ctx.isTerminalAlive(childId)) record.children.delete(childId)
      },
    }
  }

  /** Running children of tower `towerId` (in flight included) — tests / diagnostics. */
  liveChildren(towerId: string, isTerminalAlive: (id: string) => boolean): number {
    this.prune(isTerminalAlive, this.now())
    return this.towers.get(towerId)?.children.size ?? 0
  }

  /** Drops children whose PTY is gone, and towers with nothing left to limit. */
  private prune(isTerminalAlive: (id: string) => boolean, now: number): void {
    for (const [towerId, entry] of this.towers) {
      for (const id of entry.children) {
        if (!entry.pending.has(id) && !isTerminalAlive(id)) entry.children.delete(id)
      }
      if (entry.children.size === 0 && now - entry.lastCreateAt >= this.createIntervalMs) this.towers.delete(towerId)
    }
  }
}

/** T0575: where the local helpers connect — Electron's own RemoteServer (null = not listening). */
export interface LocalHelperEndpoint {
  port: number
}

/**
 * PLAN-047 / T0575 (D149): the helper env of a local (Electron) PTY — `BAT_REMOTE_PORT` + a
 * capability issued for it as `BAT_REMOTE_TOKEN`, never the server token. Role as on headless
 * (`buildHeadlessHelperEnv`): `customEnv.BAT_TOWER_TERMINAL_ID` ⇒ worker bound to that tower, else
 * tower. The other helper paths stay as before (`BAT_HELPER_DIR` / `BAT_USER_DATA` from PtyManager;
 * the helpers find `server-cert.json` / `Logs` under `BAT_USER_DATA`).
 *
 * Returns `{}` and issues nothing when the RemoteServer is not listening or the id is refused; the
 * PTY then has no `BAT_REMOTE_*` at all (PtyManager drops inherited ones, T0574 gap 4).
 * Logs the terminal id and role, never the token.
 */
export function buildLocalHelperEnv(opts: {
  id: string
  customEnv: Record<string, string>
  capabilities: HelperCapabilityRegistry
  endpoint: LocalHelperEndpoint | null
  log?: (message: string) => void
}): Record<string, string> {
  const { id, customEnv, capabilities, endpoint } = opts
  if (!endpoint) {
    opts.log?.(`[helper-cap] not issued: terminal=${id} (RemoteServer not listening)`)
    return {}
  }
  const towerId = typeof customEnv.BAT_TOWER_TERMINAL_ID === 'string' && customEnv.BAT_TOWER_TERMINAL_ID
    ? customEnv.BAT_TOWER_TERMINAL_ID
    : undefined
  let token: string
  try {
    token = capabilities.issue(id, { towerId })
  } catch (error) {
    opts.log?.(`[helper-cap] not issued: terminal=${id} (${error instanceof Error ? error.message : String(error)})`)
    return {}
  }
  opts.log?.(`[helper-cap] issued: terminal=${id} role=${towerId ? `worker tower=${towerId}` : 'tower'}`)
  return {
    BAT_REMOTE_PORT: String(endpoint.port),
    BAT_REMOTE_TOKEN: token,
  }
}

/** T0576: the file Electron keeps its local capability records in, under userData. */
export const HELPER_CAPABILITY_STORE_FILE = 'helper-capabilities.json'
/** T0576: store format version (`{ version, capabilities: PersistedHelperCapability[] }`). */
export const HELPER_CAPABILITY_STORE_VERSION = 1

export type HelperCapabilityStoreRead =
  | { status: 'missing'; records: [] }
  | { status: 'ok'; records: unknown[] }
  | { status: 'corrupt'; records: []; error: string }

/**
 * T0576: reads the capability store. A missing file is `missing`; unreadable JSON, another
 * version or no `capabilities` array is `corrupt` (the caller logs it and starts empty).
 * Record contents are validated by `HelperCapabilityRegistry.restore`.
 */
export function readHelperCapabilityStore(filePath: string): HelperCapabilityStoreRead {
  let text: string
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { status: 'missing', records: [] }
    return { status: 'corrupt', records: [], error: error instanceof Error ? error.message : String(error) }
  }
  try {
    const parsed = JSON.parse(text) as { version?: unknown; capabilities?: unknown }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== HELPER_CAPABILITY_STORE_VERSION || !Array.isArray(parsed.capabilities)) {
      return { status: 'corrupt', records: [], error: 'unexpected format' }
    }
    return { status: 'ok', records: parsed.capabilities }
  } catch (error) {
    return { status: 'corrupt', records: [], error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * T0576: writes the records atomically — a temp file in the same directory, then rename over the
 * store — so a crash leaves either the old or the new file, never half of one. Digests and
 * bindings only; the caller never has a token to write. Throws on failure.
 */
export function writeHelperCapabilityStore(filePath: string, records: readonly PersistedHelperCapability[]): void {
  const body = JSON.stringify({ version: HELPER_CAPABILITY_STORE_VERSION, capabilities: records }, null, 2) + '\n'
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`)
  fs.writeFileSync(tmp, body, { encoding: 'utf8', mode: 0o600 })
  try {
    fs.renameSync(tmp, filePath)
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }) } catch { /* best-effort */ }
    throw error
  }
}

/**
 * T0576: loads the store into `registry` as pending capabilities (`restore`). A damaged store is
 * logged (`warn`) and replaced by an empty one; invalid records are skipped and the store is
 * rewritten without them. Never throws — a restart must not fail over this file.
 */
export function restoreHelperCapabilitiesFromStore(opts: {
  registry: HelperCapabilityRegistry
  filePath: string
  log: { log(message: string): void; warn(message: string): void }
}): { status: HelperCapabilityStoreRead['status']; restored: number; skipped: number } {
  const { registry, filePath, log } = opts
  const name = path.basename(filePath)
  const rewrite = () => {
    try {
      writeHelperCapabilityStore(filePath, registry.records())
    } catch (error) {
      log.warn(`[helper-cap] could not rewrite ${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const stored = readHelperCapabilityStore(filePath)
  if (stored.status === 'missing') return { status: 'missing', restored: 0, skipped: 0 }
  if (stored.status === 'corrupt') {
    log.warn(`[helper-cap] ${name} unreadable (${stored.error}) — starting with no restored capabilities`)
    rewrite()
    return { status: 'corrupt', restored: 0, skipped: 0 }
  }
  const restored = registry.restore(stored.records)
  const skipped = stored.records.length - restored
  if (stored.records.length > 0) {
    log.log(`[helper-cap] restored ${restored} capability record(s) from ${name}${skipped > 0 ? ` (${skipped} invalid skipped)` : ''} — pending the Terminal Server's PTY list`)
  }
  if (skipped > 0) {
    log.warn(`[helper-cap] ${name}: ${skipped} invalid record(s) dropped`)
    rewrite()
  }
  return { status: 'ok', restored, skipped }
}
