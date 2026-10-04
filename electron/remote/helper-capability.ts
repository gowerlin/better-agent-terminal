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
 *   - role `worker` (PTY created with `BAT_TOWER_TERMINAL_ID`): `terminal:notify` /
 *     `pty:write` (printable text only, T0450) / `terminal:keypress`, target = that tower only
 *
 * Tokens are `HELPER_CAPABILITY_TOKEN_PREFIX` + `randomBytes(32)` and live in memory only:
 * the registry keeps their SHA-256 digest (never the token), nothing is persisted or
 * logged, the PTY's exit / kill revokes its token, and a new server process starts with
 * an empty registry. Revoked digests are remembered for a while (bounded, TTL) so a
 * stale helper gets `Capability revoked` instead of counting as a failed auth (T0449).
 *
 * 🔴 No `electron` import here (headless-electron-free guard).
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto'

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
  /** Clock for the revoked-digest TTL (tests). Default `Date.now`. */
  now?: () => number
  revokedTtlMs?: number
  revokedCapacity?: number
}

interface CapabilityEntry {
  digest: Buffer
  capability: HelperCapability
}

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

export class HelperCapabilityRegistry {
  /** digest (hex) → entry */
  private readonly entries = new Map<string, CapabilityEntry>()
  /** T0449: revoked digest (hex) → forget-at time; insertion order = oldest first. */
  private readonly revoked = new Map<string, number>()
  private readonly now: () => number
  private readonly revokedTtlMs: number
  private readonly revokedCapacity: number

  constructor(opts: HelperCapabilityRegistryOptions = {}) {
    this.now = opts.now ?? Date.now
    this.revokedTtlMs = opts.revokedTtlMs ?? REVOKED_CAPABILITY_TTL_MS
    this.revokedCapacity = Math.max(0, opts.revokedCapacity ?? REVOKED_CAPABILITY_CAPACITY)
  }

  get size(): number {
    return this.entries.size
  }

  /**
   * Issues the capability of PTY `terminalId` and returns its token. One live token per
   * PTY: issuing again (re-create / restart) revokes the previous one. `towerId` makes
   * it a worker capability bound to that tower.
   */
  issue(terminalId: string, opts: { towerId?: string } = {}): string {
    if (!isTerminalId(terminalId)) throw new Error('helper capability: invalid terminal id')
    const towerId = opts.towerId || undefined
    if (towerId !== undefined && !isTerminalId(towerId)) throw new Error('helper capability: invalid tower id')
    this.revokeTerminal(terminalId)
    const token = HELPER_CAPABILITY_TOKEN_PREFIX + randomBytes(CAPABILITY_TOKEN_BYTES).toString('base64url')
    const digest = digestOf(token)
    const capability: HelperCapability = towerId
      ? { terminalId, towerId, role: 'worker' }
      : { terminalId, role: 'tower' }
    this.entries.set(digest.toString('hex'), { digest, capability })
    return token
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

  /** Revokes every capability bound to PTY `terminalId`; returns how many were revoked. */
  revokeTerminal(terminalId: string): number {
    let revoked = 0
    for (const [key, entry] of this.entries) {
      if (entry.capability.terminalId === terminalId) {
        this.entries.delete(key)
        this.rememberRevoked(key)
        revoked++
      }
    }
    return revoked
  }

  /** Revokes everything (server stop). */
  clear(): void {
    for (const key of this.entries.keys()) this.rememberRevoked(key)
    this.entries.clear()
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
  'terminal:notify': ['worker'],
  'pty:write': ['worker'],
  'terminal:keypress': ['worker'],
}

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
  if (typeof channel !== 'string') return deny('channel-not-allowed')
  if (!Object.prototype.hasOwnProperty.call(HELPER_CHANNEL_ROLES, channel)) return deny('channel-not-allowed')
  if (!Array.isArray(args)) return deny('invalid-args')
  const roles = HELPER_CHANNEL_ROLES[channel]
  if (!roles.includes(capability.role)) return deny('role-not-allowed')

  switch (channel) {
    case 'terminal:create-agent-command': {
      const opts = asRecord(args[0])
      if (!opts) return deny('invalid-payload')
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
