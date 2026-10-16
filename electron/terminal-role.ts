/**
 * T0562 / D147: `terminal:set-role` — a program running in a tab declares the tab's role
 * (`bat-terminal.mjs --set-role tower [--terminal-id <id>] [--agent <id>]`, called by CT when a
 * Tower starts). BAT then titles that tab `<agent> · Tower` (src/lib/tower-terminal-title.ts),
 * unless the user named the tab.
 *
 * Main only checks the request and that the PTY runs here, then sends
 * `terminal:role-changed { id, role, ptyAgent?, ptyAgentName?, agent?, agentName? }` to every
 * window (Electron: + broadcastHub; headless: the connected clients); the window holding the tab
 * decides whether its title is still BAT's default and applies it (`workspaceStore.applyTerminalRole`).
 *
 * Contract (T0562「介面契約」): `{ terminalId, role, agent? }` →
 *   `{ ok: true, terminalId, role }` or `{ ok: false, code }` with code INVALID_ARGS | NOT_FOUND.
 * `agent` is a display-name hint only: normalized like `--agent` (`normalizeAgentAlias`) and
 * dropped when the agent registry does not know it — never a reason to refuse.
 *
 * Headless bat-server registers the same handler (electron/handlers/terminal.ts); its helper
 * capability lets a tower set its own terminal only (electron/remote/helper-capability.ts).
 *
 * 🔴 No `electron` import here (shared with headless).
 */
import { agentRegistry } from './agent-runtime/agent-registry'
import { normalizeAgentAlias } from './terminal-command-handlers'

export const SET_ROLE_CHANNEL = 'terminal:set-role'
export const ROLE_CHANGED_CHANNEL = 'terminal:role-changed'

/** The roles a tab can be given (T0562: Tower only). */
export const TERMINAL_ROLES = ['tower'] as const
export type TerminalRole = typeof TERMINAL_ROLES[number]

export type SetRoleErrorCode = 'INVALID_ARGS' | 'NOT_FOUND'

export type SetRoleResult =
  | { ok: true; terminalId: string; role: TerminalRole }
  | { ok: false; code: SetRoleErrorCode }

/** `terminal:role-changed` payload. */
export interface TerminalRoleChange {
  id: string
  role: TerminalRole
  /** The agent preset the PTY was created with (not `none`). */
  ptyAgent?: string
  /** That agent's registry name (custom CLIs are not renderer presets). */
  ptyAgentName?: string
  /** The caller's `--agent` hint, normalized to a registry id. */
  agent?: string
  agentName?: string
}

/** Terminal ids are uuids / hex; same whitelist as other external ids. */
const TERMINAL_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/
const AGENT_HINT_MAX = 128

export interface SetRolePtyManager {
  isAlive(id: string): boolean
  /** T0525: the `agentPreset` PTY `id` was created with. */
  getAgentPreset?(id: string): string | undefined
}

export interface SetTerminalRoleDeps {
  getPtyManager(): SetRolePtyManager | null
  emit(channel: string, payload: unknown): unknown
  logger: { log(...args: unknown[]): void }
  /** Default: the agent registry. */
  isKnownAgent?(agentId: string): boolean
  /** Default: the agent registry's name. */
  agentName?(agentId: string): string | undefined
  mirrorToBatScripts?(event: string, payload: Record<string, unknown>): void
}

/** `--set-role` value → role: trimmed, case-insensitive; anything else → null. */
export function normalizeTerminalRole(raw: unknown): TerminalRole | null {
  if (typeof raw !== 'string') return null
  const role = raw.trim().toLowerCase()
  return (TERMINAL_ROLES as readonly string[]).includes(role) ? role as TerminalRole : null
}

function registryHasAgent(agentId: string): boolean {
  try {
    return agentRegistry.getDefinition(agentId) !== undefined
  } catch {
    return false
  }
}

function registryAgentName(agentId: string): string | undefined {
  try {
    return agentRegistry.getDefinition(agentId)?.name || undefined
  } catch {
    return undefined
  }
}

export function setTerminalRole(args: unknown, deps: SetTerminalRoleDeps): SetRoleResult {
  const isKnown = deps.isKnownAgent ?? registryHasAgent
  const nameOf = deps.agentName ?? registryAgentName
  const opts = args && typeof args === 'object' && !Array.isArray(args) ? args as Record<string, unknown> : null
  const refuse = (code: SetRoleErrorCode, detail: string): SetRoleResult => {
    deps.logger.log(`[set-role] ${detail} → ${code}`)
    deps.mirrorToBatScripts?.('set-role', { result: code, detail })
    return { ok: false, code }
  }
  if (!opts) return refuse('INVALID_ARGS', 'no request object')
  const role = normalizeTerminalRole(opts.role)
  if (!role) return refuse('INVALID_ARGS', `role=${String(opts.role)}`)
  const terminalId = typeof opts.terminalId === 'string' ? opts.terminalId.trim() : ''
  if (!TERMINAL_ID_PATTERN.test(terminalId)) return refuse('INVALID_ARGS', `terminalId=${String(opts.terminalId)}`)
  if (opts.agent !== undefined && opts.agent !== null && typeof opts.agent !== 'string') {
    return refuse('INVALID_ARGS', 'agent is not a string')
  }

  const ptyManager = deps.getPtyManager()
  if (!ptyManager || !ptyManager.isAlive(terminalId)) return refuse('NOT_FOUND', `id=${terminalId} role=${role}`)

  const change: TerminalRoleChange = { id: terminalId, role }
  const ptyAgent = ptyManager.getAgentPreset?.(terminalId)
  if (ptyAgent && ptyAgent !== 'none') {
    change.ptyAgent = ptyAgent
    const name = nameOf(ptyAgent)
    if (name) change.ptyAgentName = name
  }
  const hint = typeof opts.agent === 'string' ? opts.agent.trim().slice(0, AGENT_HINT_MAX) : ''
  let hintNote = ''
  if (hint && hint !== 'default') {
    const agent = normalizeAgentAlias(hint, isKnown)
    if (isKnown(agent) && agent !== 'none') {
      change.agent = agent
      const name = nameOf(agent)
      if (name) change.agentName = name
    } else {
      hintNote = ` (--agent ${hint} unknown, ignored)`
    }
  }

  const windows = deps.emit(ROLE_CHANGED_CHANNEL, change)
  deps.logger.log(`[set-role] id=${terminalId} role=${role} ptyAgent=${change.ptyAgent ?? 'none'} agent=${change.agent ?? 'none'}${hintNote} → sent${typeof windows === 'number' ? ` windows=${windows}` : ''}`)
  deps.mirrorToBatScripts?.('set-role', {
    result: 'OK',
    terminalId,
    role,
    ...(change.ptyAgent ? { ptyAgent: change.ptyAgent } : {}),
    ...(change.agent ? { agent: change.agent } : {}),
    ...(hintNote ? { ignoredAgent: hint } : {}),
  })
  return { ok: true, terminalId, role }
}
