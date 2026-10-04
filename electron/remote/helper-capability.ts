/**
 * PLAN-036 P3 / K (T0432, T0420 方案 A'): per-PTY capability tokens for the helpers
 * (`bat-terminal.mjs` / `bat-notify.mjs`) running inside a headless PTY.
 *
 * A capability authenticates a RemoteServer connection as a *helper*, not a client:
 * it may invoke only the channels of its role, only against the terminal it is bound
 * to (`authorizeHelperInvoke`). Everything else is denied.
 *
 *   - role `tower`  (PTY without a notify target): `terminal:create-agent-command`,
 *     creating a NEW terminal whose notify target is the tower itself (or none)
 *   - role `worker` (PTY created with `BAT_TOWER_TERMINAL_ID`): `terminal:notify` /
 *     `pty:write` / `terminal:keypress`, target = that tower only
 *
 * Tokens are `randomBytes(32)` and live in memory only: the registry keeps their
 * SHA-256 digest (never the token), nothing is persisted or logged, the PTY's exit /
 * kill revokes its token, and a new server process starts with an empty registry.
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
    const token = randomBytes(CAPABILITY_TOKEN_BYTES).toString('base64url')
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

  /** Revokes every capability bound to PTY `terminalId`; returns how many were revoked. */
  revokeTerminal(terminalId: string): number {
    let revoked = 0
    for (const [key, entry] of this.entries) {
      if (entry.capability.terminalId === terminalId) {
        this.entries.delete(key)
        revoked++
      }
    }
    return revoked
  }

  /** Revokes everything (server stop). */
  clear(): void {
    this.entries.clear()
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

export interface HelperInvokeContext {
  /** Whether a PTY with this id is running. Missing ⇒ creating a terminal is denied (fail closed). */
  isTerminalAlive?: (id: string) => boolean
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
  const roles = HELPER_CHANNEL_ROLES[channel]
  if (!roles) return deny('channel-not-allowed')
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
      return args[0] === capability.towerId ? { ok: true } : deny('target-not-bound')
    default:
      return deny('channel-not-allowed')
  }
}
