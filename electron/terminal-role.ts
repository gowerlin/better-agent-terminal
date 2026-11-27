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
 * PLAN-068 W9 / T0910 (T0902 §3.1′ / §7.2): a call that declared a contract also answers `hooksStatus`
 * (`PtyManager.getHooksStatus`, electron/claude-hooks-status.ts), from which the helper prints the
 * `hooks:` line. Without any hook report yet (and not codex) the answer waits up to
 * `HOOKS_STATUS_WAIT_MS` (2 s) for the first one. `--agent` is also noted as the tab's agent hint
 * (`noteTowerAgentHint`: a codex Tower BAT did not launch answers `n/a (codex)`). A call without
 * `batContract` answers synchronously and exactly as before.
 *
 * Headless bat-server registers the same handler (electron/handlers/terminal.ts); its helper
 * capability lets a tower set its own terminal only (electron/remote/helper-capability.ts).
 *
 * T0949 / BUG-230: the declaration (role / mode / contract, + the `--agent` hint) survives a BAT reopen
 * that reattaches the same PTY process: `TowerRolePersistence` keeps each running Tower's last
 * declaration with the pid of the process that made it in `<userData>/tower-roles.json` and, on the
 * Terminal Server's PTY list, puts it back when the listed pid is that pid (`decideTowerRoleRestore`),
 * then sends `terminal:role-changed` as a `--set-role` would. A ⏻ restart, the T0704 recovery, the
 * Recovery prompt's fresh start or a new PTY never restore (another pid / no surviving server); the
 * `--set-role` request, answer and stdout are unchanged. Electron only (headless has no reattach).
 *
 * 🔴 No `electron` import here (shared with headless).
 */
import * as fs from 'fs'
import * as path from 'path'
import { agentRegistry } from './agent-runtime/agent-registry'
import { normalizeAgentAlias } from './terminal-command-handlers'
import { normalizeCtMode, type CtMode } from './ct-mode'
import { BAT_CONTRACT_VERSION, parseBatContract } from '../src/lib/tower-contract'
import { HOOKS_STATUS_WAIT_MS, hooksAgentKindOf, hooksStatusNeedsWait, type HooksAgentKind, type HooksStatus } from './claude-hooks-status'

export const SET_ROLE_CHANNEL = 'terminal:set-role'
export const ROLE_CHANGED_CHANNEL = 'terminal:role-changed'

/** The roles a tab can be given (T0562: Tower only). */
export const TERMINAL_ROLES = ['tower'] as const
export type TerminalRole = typeof TERMINAL_ROLES[number]

export type SetRoleErrorCode = 'INVALID_ARGS' | 'NOT_FOUND'

export type SetRoleResult =
  | { ok: true; terminalId: string; role: TerminalRole; mode?: CtMode; towerContract?: number; batContract?: number; hooksStatus?: HooksStatus | null }
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
  /** PLAN-068 W9 / T0910: `PtyManager.getHooksStatus`. Absent (test doubles) ⇒ no `hooksStatus` in the answer. */
  getHooksStatus?(id: string): HooksStatus | null
  /** T0910: `PtyManager.waitForHookReport` (the §7.2 wait). Absent ⇒ no wait. */
  waitForHookReport?(id: string, timeoutMs: number): Promise<boolean>
  /** T0910: `PtyManager.noteTowerAgentHint` (the `--agent` hint, every call overwrites). */
  noteTowerAgentHint?(id: string, kind: HooksAgentKind | null): void
  /**
   * T0949 / BUG-230: `PtyManager.noteTowerDeclaration` — this `--set-role` was made by the process
   * now running in PTY `id` (its pid is what a reattach compares), with this `--agent` hint.
   * Absent (test doubles, an older host) ⇒ nothing is kept for a reattach.
   */
  noteTowerDeclaration?(id: string, agent?: string): void
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

/**
 * T0910: a Promise only for a `--bat-contract` call that waits for the first hook report (§7.2);
 * every other call (an older CT's included) answers synchronously, exactly as before.
 */
export function setTerminalRole(args: unknown, deps: SetTerminalRoleDeps): SetRoleResult | Promise<SetRoleResult> {
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

  const hint = typeof opts.agent === 'string' ? opts.agent.trim().slice(0, AGENT_HINT_MAX) : ''
  let hintAgent: string | undefined
  let hintNote = ''
  if (hint && hint !== 'default') {
    const agent = normalizeAgentAlias(hint, isKnown)
    if (isKnown(agent) && agent !== 'none') hintAgent = agent
    else hintNote = ` (--agent ${hint} unknown, ignored)`
  }
  // T0910: before the role (which re-reads the hooks status); every call overwrites it
  ptyManager.noteTowerAgentHint?.(terminalId, hooksAgentKindOf(hintAgent))

  ptyManager.setTerminalRole?.(terminalId, role, mode, towerContract)
  // T0949: what a reattach after BAT reopens may restore (the declaring process's pid + this hint)
  ptyManager.noteTowerDeclaration?.(terminalId, hintAgent)
  // Test doubles without the recorder echo the request.
  const recordedMode = ptyManager.getTowerMode ? ptyManager.getTowerMode(terminalId) : mode
  const recordedContract = ptyManager.getTowerContract ? ptyManager.getTowerContract(terminalId) : towerContract

  const change = buildTerminalRoleChange({
    id: terminalId,
    role,
    towerContract: recordedContract,
    ptyAgent: ptyManager.getAgentPreset?.(terminalId),
    agent: hintAgent,
    mode: recordedMode,
  }, nameOf)

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
  const answer: SetRoleResult = {
    ok: true,
    terminalId,
    role,
    ...(recordedMode ? { mode: recordedMode } : {}),
    // T0903: only for a call that declared a contract — an older CT's call is answered as before
    ...(contractGiven && recordedContract !== undefined ? { towerContract: recordedContract, batContract: BAT_CONTRACT_VERSION } : {}),
  }
  // PLAN-068 W9 / T0910 (§3.1′ / §7.2): + `hooksStatus`, only for a call that declared a contract (the
  // `hooks:` line); without a report yet (and not codex) the answer waits up to HOOKS_STATUS_WAIT_MS
  // for one — claude's `SessionStart` is async and may come after CT's first command.
  if (!contractGiven || recordedContract === undefined || !ptyManager.getHooksStatus) return answer
  const getStatus = ptyManager.getHooksStatus.bind(ptyManager)
  const withStatus = (waited: string): SetRoleResult => {
    let hooksStatus: HooksStatus | null = null
    try { hooksStatus = getStatus(terminalId) } catch { /* reported as null */ }
    deps.logger.log(`[set-role] id=${terminalId} hooks=${describeHooksStatus(hooksStatus)}${waited}`)
    return { ...answer, hooksStatus }
  }
  let initial: HooksStatus | null = null
  try { initial = getStatus(terminalId) } catch { /* below */ }
  if (!hooksStatusNeedsWait(initial) || !ptyManager.waitForHookReport) return withStatus('')
  const startedAt = Date.now()
  return ptyManager.waitForHookReport(terminalId, HOOKS_STATUS_WAIT_MS)
    .catch(() => false)
    .then(reported => withStatus(` (waited ${Date.now() - startedAt} ms${reported ? '' : ', no report'})`))
}

/** T0910: a status for the log (codes only). */
function describeHooksStatus(status: HooksStatus | null): string {
  if (!status) return 'null'
  if (status.state === 'ok') return `ok (${status.origin}, set ${status.set}${status.reason ? `, ${status.reason}` : ''})`
  return `${status.state} (${status.reason})`
}

// ── T0949 / BUG-230: the declaration survives a reattach of the same PTY ──

/** What `terminal:role-changed` is built from (a `--set-role`, a restore, a window's load). */
export interface TerminalRoleChangeInput {
  id: string
  role: TerminalRole
  /** The contract recorded on the PTY (undefined = not declared). */
  towerContract?: number
  /** The agent preset the PTY was created with. */
  ptyAgent?: string
  /** The `--agent` hint, normalized to a registry id. */
  agent?: string
  mode?: CtMode
}

/**
 * The one shape of `terminal:role-changed` (T0562 / T0565 / T0903): `setTerminalRole` and the T0949
 * restore / resend all build it here. `nameOf` names an agent id (the registry by default).
 */
export function buildTerminalRoleChange(input: TerminalRoleChangeInput, nameOf: (agentId: string) => string | undefined = registryAgentName): TerminalRoleChange {
  const change: TerminalRoleChange = { id: input.id, role: input.role, towerContract: input.towerContract ?? null }
  if (input.ptyAgent && input.ptyAgent !== 'none') {
    change.ptyAgent = input.ptyAgent
    const name = nameOf(input.ptyAgent)
    if (name) change.ptyAgentName = name
  }
  if (input.agent) {
    change.agent = input.agent
    const name = nameOf(input.agent)
    if (name) change.agentName = name
  }
  if (input.mode) change.mode = input.mode
  return change
}

/**
 * T0949 / BUG-230: the file Electron keeps its Towers' declarations in, under userData. A Tower's
 * `role` / `towerMode` / `towerContract` live on main's `PtyInstance`; when BAT reopens and the Terminal
 * Server kept the PTY, the new main registers it from the server's list (T0108) without them, so the
 * Inbox found no Tower and answers could not be sent until CT declared again.
 */
export const TOWER_ROLE_STORE_FILE = 'tower-roles.json'
/** Store format version (`{ version, towers: PersistedTowerRole[] }`). */
export const TOWER_ROLE_STORE_VERSION = 1

/**
 * One declaration as stored: the last `--set-role` of a running PTY, and the pid of the process that
 * made it. Never a token, never output — ids, numbers and agent ids only.
 */
export interface PersistedTowerRole {
  terminalId: string
  /** The PTY's pid when CT declared (Terminal Server `pty:created` / `pty:list`). */
  pid: number
  role: TerminalRole
  mode?: CtMode
  towerContract?: number
  /** The agent preset the PTY was created with (for the title of the restored event only). */
  ptyAgent?: string
  /** The `--agent` hint of that `--set-role` (a registry id). */
  agent?: string
}

/** A declaration as PtyManager reports / takes it back (`PersistedTowerRole` without the id). */
export type TowerDeclaration = Omit<PersistedTowerRole, 'terminalId'>

export type TowerRoleStoreRead =
  | { status: 'missing'; towers: [] }
  | { status: 'ok'; towers: PersistedTowerRole[]; skipped: number }
  | { status: 'corrupt'; towers: []; error: string }

const STORED_AGENT_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

function validTowerRole(raw: unknown): PersistedTowerRole | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { terminalId, pid, role, mode, towerContract, ptyAgent, agent } = raw as Record<string, unknown>
  if (typeof terminalId !== 'string' || !TERMINAL_ID_PATTERN.test(terminalId)) return null
  if (typeof pid !== 'number' || !Number.isSafeInteger(pid) || pid <= 0) return null
  const normalizedRole = normalizeTerminalRole(role)
  if (!normalizedRole || role !== normalizedRole) return null
  const out: PersistedTowerRole = { terminalId, pid, role: normalizedRole }
  if (mode !== undefined) {
    const normalized = normalizeCtMode(mode)
    if (!normalized || mode !== normalized) return null
    out.mode = normalized
  }
  if (towerContract !== undefined) {
    const parsed = parseBatContract(towerContract)
    if (parsed === null) return null
    out.towerContract = parsed
  }
  for (const [key, value] of [['ptyAgent', ptyAgent], ['agent', agent]] as const) {
    if (value === undefined) continue
    if (typeof value !== 'string' || !STORED_AGENT_ID_PATTERN.test(value)) return null
    out[key] = value
  }
  return out
}

/**
 * T0949: reads the store. A missing file is `missing`; unreadable JSON, another version or no `towers`
 * array is `corrupt`; invalid entries are skipped (counted).
 */
export function readTowerRoleStore(filePath: string): TowerRoleStoreRead {
  let text: string
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { status: 'missing', towers: [] }
    return { status: 'corrupt', towers: [], error: error instanceof Error ? error.message : String(error) }
  }
  try {
    const parsed = JSON.parse(text) as { version?: unknown; towers?: unknown }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== TOWER_ROLE_STORE_VERSION || !Array.isArray(parsed.towers)) {
      return { status: 'corrupt', towers: [], error: 'unexpected format' }
    }
    const towers: PersistedTowerRole[] = []
    for (const raw of parsed.towers as unknown[]) {
      const tower = validTowerRole(raw)
      if (tower && !towers.some(t => t.terminalId === tower.terminalId)) towers.push(tower)
    }
    return { status: 'ok', towers, skipped: parsed.towers.length - towers.length }
  } catch (error) {
    return { status: 'corrupt', towers: [], error: error instanceof Error ? error.message : String(error) }
  }
}

/** T0949: writes the store atomically (temp file + rename, POSIX 0600). Throws on failure. */
export function writeTowerRoleStore(filePath: string, towers: readonly PersistedTowerRole[]): void {
  const body = JSON.stringify({ version: TOWER_ROLE_STORE_VERSION, towers }, null, 2) + '\n'
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`)
  fs.writeFileSync(tmp, body, { encoding: 'utf8', mode: 0o600 })
  try {
    fs.renameSync(tmp, filePath)
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }) } catch { /* best-effort */ }
    throw error
  }
}

export type TowerRoleRestoreDecision =
  | { restore: true }
  | { restore: false; reason: 'not-running' | 'pid-unknown' | 'pid-mismatch' | 'declared-since' }

/**
 * T0949: whether a stored declaration goes back onto a PTY this process registered from the Terminal
 * Server's list. Only the same process: the PTY runs, its pid (from the list) is the pid that declared,
 * and nothing was declared on it in this process yet (a newer `--set-role` wins). A ⏻ restart, the
 * T0704 recovery or a new PTY under the id has another pid (or no stored entry at all).
 */
export function decideTowerRoleRestore(
  stored: Pick<PersistedTowerRole, 'pid'>,
  current: { alive: boolean; pid?: number; role?: TerminalRole },
): TowerRoleRestoreDecision {
  if (!current.alive) return { restore: false, reason: 'not-running' }
  if (current.pid === undefined) return { restore: false, reason: 'pid-unknown' }
  if (current.pid !== stored.pid) return { restore: false, reason: 'pid-mismatch' }
  if (current.role !== undefined) return { restore: false, reason: 'declared-since' }
  return { restore: true }
}

/** What `TowerRolePersistence` reads from / puts back into PtyManager (the class satisfies it). */
export interface TowerRolePtySource {
  listTerminalIds(): string[]
  /** The declaration of running PTY `id` if the process that made it still runs there (else null). */
  getTowerDeclaration(id: string): TowerDeclaration | null
  /** The pid of running PTY `id` (undefined = not known). */
  getPid(id: string): number | undefined
  getTerminalRole(id: string): TerminalRole | undefined
  getTowerMode(id: string): CtMode | undefined
  getTowerContract(id: string): number | undefined
  getAgentPreset(id: string): string | undefined
  /** The `--agent` hint of the declaration now recorded (undefined = none). */
  getTowerAgent(id: string): string | undefined
  /** Puts a declaration back (role / mode / contract / hint, and its pid). false = no such PTY. */
  restoreTowerDeclaration(id: string, declaration: TowerDeclaration): boolean
}

export interface TowerRolePersistenceOptions {
  /** null until the PtyManager exists. */
  getPtyManager(): TowerRolePtySource | null
  /** `terminal:role-changed` to the windows (and broadcastHub), as a `--set-role` sends it. */
  emit(channel: string, payload: unknown): unknown
  log: { log(message: string): void; warn(message: string): void }
  /** Default: the agent registry's name. */
  agentName?(agentId: string): string | undefined
}

/** Log form of a terminal id (first 8 characters, T0949 ⑥). */
function shortId(id: string): string {
  return id.slice(0, 8)
}

/**
 * T0949 / BUG-230: Electron's Tower declaration store (the T0642 `ClaudeSessionPersistence` pattern).
 * `load` (whenReady, before the Terminal Server reconnects) reads the previous process's entries as
 * pending; `settle` (the Terminal Server's PTY list, or no surviving server) puts back each one whose
 * PTY runs with the same pid (`decideTowerRoleRestore`) and sends `terminal:role-changed`, and drops
 * the rest; `persist` (a declaration, a PTY's pid, a PTY exit, the recovery) writes the running PTYs'
 * declarations whose declaring process still runs, plus the still-pending ones. `roleChanges` is the
 * event of every Tower main knows now (a window that finished loading gets them).
 * Nothing is written before `load`, nor when the content did not change. Never throws. Logs
 * `[tower-role] …` with a terminal id's first 8 characters, the role, mode and contract only.
 * Headless does not persist (bat-server has no Terminal Server to reattach).
 */
export class TowerRolePersistence {
  private filePath: string | null = null
  private pending = new Map<string, PersistedTowerRole>()
  private lastWritten: string | null = null
  /** The stored agent preset of a restored Tower, for its events until main learns the PTY's own. */
  private restoredPtyAgents = new Map<string, string>()

  constructor(private readonly opts: TowerRolePersistenceOptions) {}

  load(filePath: string): TowerRoleStoreRead['status'] {
    if (this.filePath) return 'ok'
    const name = path.basename(filePath)
    const stored = readTowerRoleStore(filePath)
    if (stored.status === 'corrupt') {
      this.opts.log.warn(`[tower-role] ${name} unreadable (${stored.error}) — nothing restored`)
    } else if (stored.status === 'ok') {
      for (const tower of stored.towers) this.pending.set(tower.terminalId, tower)
      if (stored.towers.length > 0 || stored.skipped > 0) {
        this.opts.log.log(`[tower-role] loaded ${stored.towers.length} entr${stored.towers.length === 1 ? 'y' : 'ies'} from ${name}${stored.skipped > 0 ? ` (${stored.skipped} invalid skipped)` : ''} — pending the Terminal Server's PTY list`)
      }
    }
    this.filePath = filePath
    if (stored.status === 'corrupt' || (stored.status === 'ok' && stored.skipped > 0)) this.persist()
    else this.lastWritten = stored.status === 'ok' ? this.body() : bodyOfTowers([])
    return stored.status
  }

  hasPending(): boolean {
    return this.pending.size > 0
  }

  settle(isAlive: (terminalId: string) => boolean, reason: string): void {
    if (this.pending.size === 0) return
    const pm = this.opts.getPtyManager()
    for (const stored of this.pending.values()) {
      const id = stored.terminalId
      const alive = !!pm && isAlive(id)
      const decision = decideTowerRoleRestore(stored, {
        alive,
        pid: alive ? pm!.getPid(id) : undefined,
        role: alive ? pm!.getTerminalRole(id) : undefined,
      })
      if (!decision.restore) {
        this.opts.log.log(`[tower-role] not restored: terminal=${shortId(id)} (${decision.reason}; ${reason})`)
        continue
      }
      const { terminalId: _id, ...declaration } = stored
      if (!pm!.restoreTowerDeclaration(id, declaration)) {
        this.opts.log.log(`[tower-role] not restored: terminal=${shortId(id)} (not-running; ${reason})`)
        continue
      }
      if (stored.ptyAgent) this.restoredPtyAgents.set(id, stored.ptyAgent)
      const change = this.roleChangeOf(pm!, id)
      this.opts.log.log(`[tower-role] restored: terminal=${shortId(id)} role=${stored.role} mode=${change?.mode ?? 'none'} contract=${change?.towerContract ?? 'none'} (${reason})`)
      if (!change) continue
      try {
        this.opts.emit(ROLE_CHANGED_CHANNEL, change)
      } catch (error) {
        this.opts.log.warn(`[tower-role] role-changed for terminal=${shortId(id)} failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    this.pending.clear()
    this.persist()
  }

  /** The entries to store: running PTYs' declarations (current values win), then the pending ones. */
  entries(): PersistedTowerRole[] {
    const out = new Map<string, PersistedTowerRole>()
    const pm = this.opts.getPtyManager()
    for (const id of pm?.listTerminalIds() ?? []) {
      let declaration: TowerDeclaration | null = null
      try { declaration = pm!.getTowerDeclaration(id) } catch { /* not stored */ }
      if (!declaration) continue
      const ptyAgent = declaration.ptyAgent ?? this.restoredPtyAgents.get(id)
      const entry = validTowerRole({ terminalId: id, ...declaration, ...(ptyAgent ? { ptyAgent } : {}) })
      if (entry) out.set(id, entry)
    }
    for (const tower of this.pending.values()) {
      if (!out.has(tower.terminalId)) out.set(tower.terminalId, { ...tower })
    }
    return [...out.values()]
  }

  /** `terminal:role-changed` of every Tower main knows now (sent to a window once it loaded). */
  roleChanges(): TerminalRoleChange[] {
    const pm = this.opts.getPtyManager()
    if (!pm) return []
    const out: TerminalRoleChange[] = []
    for (const id of pm.listTerminalIds()) {
      const change = this.roleChangeOf(pm, id)
      if (change) out.push(change)
    }
    return out
  }

  persist(): void {
    if (!this.filePath) return
    try {
      // a restored Tower whose PTY ended / changed no longer needs its stored preset
      const pm = this.opts.getPtyManager()
      for (const id of [...this.restoredPtyAgents.keys()]) {
        if (!pm || pm.getTerminalRole(id) === undefined) this.restoredPtyAgents.delete(id)
      }
      const towers = this.entries()
      const body = bodyOfTowers(towers)
      if (body === this.lastWritten) return
      writeTowerRoleStore(this.filePath, towers)
      this.lastWritten = body
    } catch (error) {
      this.opts.log.warn(`[tower-role] could not write ${path.basename(this.filePath)}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private body(): string {
    return bodyOfTowers(this.entries())
  }

  private roleChangeOf(pm: TowerRolePtySource, id: string): TerminalRoleChange | null {
    try {
      const role = pm.getTerminalRole(id)
      if (!role) return null
      return buildTerminalRoleChange({
        id,
        role,
        towerContract: pm.getTowerContract(id),
        ptyAgent: pm.getAgentPreset(id) ?? this.restoredPtyAgents.get(id),
        agent: pm.getTowerAgent(id),
        mode: pm.getTowerMode(id),
      }, this.opts.agentName ?? registryAgentName)
    } catch {
      return null
    }
  }
}

/** What `persist` compares to skip an unchanged write. */
function bodyOfTowers(towers: readonly PersistedTowerRole[]): string {
  return JSON.stringify(towers)
}
