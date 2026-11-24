/**
 * T0562 / D147: `terminal:set-role` — a program running in a tab declares the tab's role
 * (`bat-terminal.mjs --set-role tower [--terminal-id <id>] [--agent <id>]`, called by CT when a
 * Tower starts). BAT then titles that tab `<agent> · Tower` (src/lib/tower-terminal-title.ts),
 * unless the user named the tab.
 *
 * T0565 / D148: `--mode yolo|ask|off|on` (optional) declares the Tower's CT mode. Main records
 * role + mode on the PTY (`PtyManager.setTerminalRole`; kept by restart / recovery, gone with the
 * PTY) so PLAN-044 can ask `PtyManager.isYoloTerminal`. No `mode` keeps the recorded one.
 *
 * Main only checks the request and that the PTY runs here, then sends
 * `terminal:role-changed { id, role, ptyAgent?, ptyAgentName?, agent?, agentName?, mode? }` to every
 * window (Electron: + broadcastHub; headless: the connected clients); the window holding the tab
 * decides whether its title is still BAT's default and applies it (`workspaceStore.applyTerminalRole`).
 *
 * Contract (T0562「介面契約」, T0565 adds `mode`): `{ terminalId, role, agent?, mode? }` →
 *   `{ ok: true, terminalId, role, mode? }` (`mode` = the mode now recorded) or
 *   `{ ok: false, code }` with code INVALID_ARGS | NOT_FOUND. An unknown `mode` → INVALID_ARGS.
 * `agent` is a display-name hint only: normalized like `--agent` (`normalizeAgentAlias`) and
 * dropped when the agent registry does not know it — never a reason to refuse.
 *
 * PLAN-068 W0 / T0903 (R11, BAT ↔ CT contract v2): `batContract` (optional, a whole number ≥ 1, from
 * `--bat-contract <n>`) is the contract the Tower speaks. Main records it on the PTY
 * (`PtyManager.setTerminalRole`'s 4th argument, read with `getTowerContract`) — every call
 * overwrites it and a call without `batContract` clears it — and answers
 * `towerContract` (the value recorded) + `batContract` (`BAT_CONTRACT_VERSION`, the highest this BAT
 * supports) only when the request carried it, so a call without it answers exactly as before.
 * A value that is not a whole number ≥ 1 → INVALID_ARGS. `terminal:role-changed` always carries
 * `towerContract` (null = not declared) so the renderer can show the §6′ badge / hint.
 *
 * Headless bat-server registers the same handler (electron/handlers/terminal.ts); its helper
 * capability lets a tower set its own terminal only (electron/remote/helper-capability.ts).
 *
 * 🔴 No `electron` import here (shared with headless).
 */
import { agentRegistry } from './agent-runtime/agent-registry'
import { normalizeAgentAlias } from './terminal-command-handlers'
import { normalizeCtMode, type CtMode } from './ct-mode'
import { BAT_CONTRACT_VERSION, parseBatContract } from '../src/lib/tower-contract'

export const SET_ROLE_CHANNEL = 'terminal:set-role'
export const ROLE_CHANGED_CHANNEL = 'terminal:role-changed'

/** The roles a tab can be given (T0562: Tower only). */
export const TERMINAL_ROLES = ['tower'] as const
export type TerminalRole = typeof TERMINAL_ROLES[number]

export type SetRoleErrorCode = 'INVALID_ARGS' | 'NOT_FOUND'

export type SetRoleResult =
  | { ok: true; terminalId: string; role: TerminalRole; mode?: CtMode; towerContract?: number; batContract?: number }
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
  /** T0565: the Tower's recorded CT mode (renderer ignores it; titles do not change). */
  mode?: CtMode
  /** T0903: the BAT ↔ CT contract the Tower declared with this call (null = not declared). */
  towerContract: number | null
}

/** Terminal ids are uuids / hex; same whitelist as other external ids. */
const TERMINAL_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/
const AGENT_HINT_MAX = 128

export interface SetRolePtyManager {
  isAlive(id: string): boolean
  /** T0525: the `agentPreset` PTY `id` was created with. */
  getAgentPreset?(id: string): string | undefined
  /**
   * T0565: record the declared role / mode (`mode` undefined keeps the recorded one).
   * T0903: `towerContract` is always overwritten (undefined = not declared).
   */
  setTerminalRole?(id: string, role: TerminalRole, mode?: CtMode, towerContract?: number): boolean
  /** T0565: the mode now recorded for a Tower PTY. */
  getTowerMode?(id: string): CtMode | undefined
  /** T0903: the contract now recorded for a Tower PTY. */
  getTowerContract?(id: string): number | undefined
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
  let mode: CtMode | undefined
  if (opts.mode !== undefined && opts.mode !== null) {
    const normalized = normalizeCtMode(opts.mode)
    if (!normalized) return refuse('INVALID_ARGS', `mode=${String(opts.mode)}`)
    mode = normalized
  }
  // T0903: undefined / null = the call did not declare a contract (an older CT, or a CT that went back)
  const contractGiven = opts.batContract !== undefined && opts.batContract !== null
  let towerContract: number | undefined
  if (contractGiven) {
    const parsed = parseBatContract(opts.batContract)
    if (parsed === null) return refuse('INVALID_ARGS', `batContract=${String(opts.batContract).slice(0, 32)}`)
    towerContract = parsed
  }

  const ptyManager = deps.getPtyManager()
  if (!ptyManager || !ptyManager.isAlive(terminalId)) return refuse('NOT_FOUND', `id=${terminalId} role=${role}`)

  ptyManager.setTerminalRole?.(terminalId, role, mode, towerContract)
  // Test doubles without the recorder echo the request.
  const recordedMode = ptyManager.getTowerMode ? ptyManager.getTowerMode(terminalId) : mode
  const recordedContract = ptyManager.getTowerContract ? ptyManager.getTowerContract(terminalId) : towerContract

  const change: TerminalRoleChange = { id: terminalId, role, towerContract: recordedContract ?? null }
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

  if (recordedMode) change.mode = recordedMode

  const windows = deps.emit(ROLE_CHANGED_CHANNEL, change)
  deps.logger.log(`[set-role] id=${terminalId} role=${role} mode=${recordedMode ?? 'none'}${mode ? '' : ' (no --mode)'} contract=${recordedContract ?? 'none'} ptyAgent=${change.ptyAgent ?? 'none'} agent=${change.agent ?? 'none'}${hintNote} → sent${typeof windows === 'number' ? ` windows=${windows}` : ''}`)
  deps.mirrorToBatScripts?.('set-role', {
    result: 'OK',
    terminalId,
    role,
    ...(recordedMode ? { mode: recordedMode } : {}),
    ...(recordedContract !== undefined ? { towerContract: recordedContract } : {}),
    ...(change.ptyAgent ? { ptyAgent: change.ptyAgent } : {}),
    ...(change.agent ? { agent: change.agent } : {}),
    ...(hintNote ? { ignoredAgent: hint } : {}),
  })
  return {
    ok: true,
    terminalId,
    role,
    ...(recordedMode ? { mode: recordedMode } : {}),
    // T0903: only for a call that declared a contract — an older CT's call is answered as before
    ...(contractGiven && recordedContract !== undefined ? { towerContract: recordedContract, batContract: BAT_CONTRACT_VERSION } : {}),
  }
}
