/**
 * PLAN-063 子項 2 / T0821: tells the user, on the first start after an upgrade, that the upgrade
 * ended their terminals.
 *
 * T0820 measured it on Windows: the NSIS installer ends every process under the install directory
 * (TerminateProcess), BAT and the Terminal Server included; the shells end with the server (it owns
 * their ConPTY). On reopen nothing survives, so BAT takes the orphan cleanup path of
 * `startTerminalServer` (electron/main.ts: `orphan PID … detected` → `killOrphanPtyProcesses` →
 * `Cleaned N orphan PTY process(es) from registry`) — no Recovery prompt, no word to the user.
 *
 * Detection (`detectUpgradeInterruption`): the version of the previous run (`last-run-version.json`
 * in userData, written at every start) differs from this one **and** this start's orphan cleanup
 * found N ≥ 1 PTYs in the registry — **or** (T0823, PLAN-063 子項 3) the installer asked the previous
 * BAT to quit normally and it recorded N ≥ 1 ended PTYs (`installer-quit-record.json`, read once:
 * electron/installer-quit-request.ts); a normal quit leaves no orphan. N = both lists joined by id.
 * The same version (a crash), no ended PTY, or no previous version (first run, unreadable file) →
 * nothing, as before T0821 — except (T0846, D278) an installer quit record with N ≥ 1 PTYs, which
 * triggers even when the version is the same (a reinstall of the same version; a crash leaves no
 * record). The notice then has `previousVersion === currentVersion` and the renderer shows its
 * reinstall text. The check runs once per process.
 *
 * What it adds: one notice for the renderer (`terminal-server:query-upgrade-interruption`, given to
 * the first window that asks, then null — shown once) and the agent tabs among the ended PTYs in the
 * existing InterruptedAgentsStore (T0766 / T0767: resume, dismiss, nothing on its own). Which tabs
 * were agents (`buildUpgradeInterruptedSources`): the saved tab's `agentPreset` (windows.json) or a
 * claude session record of the previous process (claude-sessions.json). The orphan cleanup itself,
 * the Recovery prompt and the Terminal Server recovery are unchanged.
 *
 * 🔴 No `electron` import; no path at import time (main passes the userData path). Never throws.
 * Logs `[upgrade-interruption] …` with versions and counts only — no session id, no command.
 */
import * as fs from 'fs'
import * as path from 'path'
import type { InterruptedAgentSource } from './interrupted-agents'
import { CLAUDE_SESSION_ID_PATTERN } from './terminal-blocked-state'

export const LAST_RUN_VERSION_FILE = 'last-run-version.json'
const LAST_RUN_VERSION_SCHEMA = 1
/** A version string as BAT writes it (semver with pre-release / build parts); anything else is ignored. */
const VERSION_PATTERN = /^[0-9A-Za-z.+-]{1,64}$/

export interface UpgradeInterruptionLogger {
  log(message: string): void
}

/** The version the previous run wrote, or null (missing, unreadable, unexpected content). Never throws. */
export function readLastRunVersion(filePath: string): string | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { version?: unknown }
    const version = parsed && typeof parsed === 'object' ? parsed.version : undefined
    return typeof version === 'string' && VERSION_PATTERN.test(version) ? version : null
  } catch {
    return null
  }
}

/** Writes this run's version (temp file + rename). Returns false on failure; never throws. */
export function writeLastRunVersion(filePath: string, version: string): boolean {
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`)
  try {
    fs.writeFileSync(tmp, JSON.stringify({ schema: LAST_RUN_VERSION_SCHEMA, version }) + '\n', 'utf8')
    fs.renameSync(tmp, filePath)
    return true
  } catch {
    try { fs.rmSync(tmp, { force: true }) } catch { /* best-effort */ }
    return false
  }
}

export interface UpgradeInterruptionInput {
  /** `readLastRunVersion` before this run wrote its own (null = unknown). */
  previousVersion: string | null
  currentVersion: string
  /** PTYs this start's orphan cleanup found in the registry (0 = no orphan cleanup / empty registry). */
  orphanPtyCount: number
  /**
   * T0823: PTYs the installer's quit request ended (`installer-quit-record.json`, written by the BAT
   * that quit normally; 0 / absent = no record). A normal quit leaves no orphan, so this is the other
   * way the same notice is reached.
   */
  installerQuitPtyCount?: number
}

function atLeastOne(count: number | undefined): boolean {
  return typeof count === 'number' && Number.isInteger(count) && count >= 1
}

/**
 * The upgrade ended N terminals (see the file header). No previous version → never. T0846: the
 * installer quit record N ≥ 1 → always, the same version included (a reinstall); otherwise version
 * changed **and** orphan cleanup N ≥ 1 (the same version with orphans only is a crash).
 */
export function detectUpgradeInterruption(input: UpgradeInterruptionInput): boolean {
  if (input.previousVersion === null) return false
  if (atLeastOne(input.installerQuitPtyCount)) return true
  if (input.previousVersion === input.currentVersion) return false
  return atLeastOne(input.orphanPtyCount)
}

/**
 * What the renderer shows (`terminal-server:query-upgrade-interruption`). T0846:
 * `previousVersion === currentVersion` = a reinstall of the same version (installer quit record).
 */
export interface UpgradeInterruptionNotice {
  previousVersion: string
  currentVersion: string
  /** Terminals the upgrade ended (the orphan cleanup's N; T0823: ∪ the installer quit record's, by id). */
  ptyCount: number
  /** Of those, the agent tabs listed in InterruptedAgentsDialog. */
  agentCount: number
}

/** One PTY the orphan cleanup found (`PtyRegistryEntry` subset). */
export interface OrphanPtyEntry {
  id: string
  cwd?: string
}

/** One previous-process claude session record (`PersistedClaudeSession`). */
export interface PendingClaudeSession {
  terminalId: string
  name: string | null
  sessionId: string | null
}

/** windows.json entries as far as this module reads them (`WindowEntry` matches structurally). */
export interface SavedWindowEntry {
  terminals?: unknown[]
}

interface SavedTerminal {
  workspaceId?: string
  agentPreset?: string
  launchRole?: 'tower'
  cwd?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function savedTerminals(entries: readonly SavedWindowEntry[]): Map<string, SavedTerminal> {
  const out = new Map<string, SavedTerminal>()
  for (const entry of entries) {
    for (const raw of Array.isArray(entry?.terminals) ? entry.terminals : []) {
      const terminal = asRecord(raw)
      const id = nonEmpty(terminal?.id)
      if (!terminal || !id || out.has(id)) continue
      const workspaceId = nonEmpty(terminal.workspaceId)
      const agentPreset = nonEmpty(terminal.agentPreset)
      const cwd = nonEmpty(terminal.cwd)
      out.set(id, {
        ...(workspaceId ? { workspaceId } : {}),
        ...(agentPreset ? { agentPreset } : {}),
        ...(terminal.launchRole === 'tower' ? { launchRole: 'tower' as const } : {}),
        ...(cwd ? { cwd } : {}),
      })
    }
  }
  return out
}

/**
 * The ended PTYs as `InterruptedAgentSource`s (`buildInterruptedAgentSnapshot` keeps the agents):
 * `agentPreset` from the saved tab; a claude session record without one (a helper-dispatched claude,
 * whose tab has no `agentPreset`) makes it `claude-cli`; the session id only when it is a UUID.
 * Nothing else survives an upgrade (no `session-start`, no workorder env): `startedAt` null,
 * `blockedDetection` `none`.
 */
export function buildUpgradeInterruptedSources(
  orphans: readonly OrphanPtyEntry[],
  windows: readonly SavedWindowEntry[],
  claudeSessions: readonly PendingClaudeSession[],
): InterruptedAgentSource[] {
  const terminals = savedTerminals(windows)
  const sessions = new Map<string, PendingClaudeSession>()
  for (const session of claudeSessions) if (session?.terminalId) sessions.set(session.terminalId, session)
  const seen = new Set<string>()
  const out: InterruptedAgentSource[] = []
  for (const orphan of orphans) {
    const id = nonEmpty(orphan?.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const terminal = terminals.get(id)
    const session = sessions.get(id)
    const sessionId = session?.sessionId && CLAUDE_SESSION_ID_PATTERN.test(session.sessionId) ? session.sessionId : null
    const savedPreset = terminal?.agentPreset && terminal.agentPreset !== 'none' ? terminal.agentPreset : undefined
    const agentPreset = savedPreset ?? (session && (session.name || sessionId) ? 'claude-cli' : terminal?.agentPreset)
    const cwd = nonEmpty(orphan.cwd) ?? terminal?.cwd ?? ''
    out.push({
      terminalId: id,
      cwd,
      ...(terminal?.workspaceId ? { workspaceId: terminal.workspaceId } : {}),
      ...(agentPreset ? { agentPreset } : {}),
      ...(terminal?.launchRole === 'tower' ? { role: 'tower' as const } : {}),
      startedAt: null,
      sessionId,
      blockedDetection: 'none',
    })
  }
  return out
}

export interface UpgradeInterruptionCheckOptions {
  /** `<userData>/last-run-version.json` (main passes it; never resolved at import time). */
  filePath: string
  currentVersion: string
  logger: UpgradeInterruptionLogger
}

/**
 * One process's check (Electron main). `begin` (whenReady, before the Terminal Server starts) reads
 * the previous version and writes this one; `noteOrphanCleanup` (the orphan cleanup, before the
 * registry is cleared) keeps the ended PTYs and the claude sessions; `finish` (after the Terminal
 * Server started) decides once and logs one line. `takeNotice` hands the notice out once.
 */
export class UpgradeInterruptionCheck {
  private previousVersion: string | null = null
  private begun = false
  private finished = false
  private orphans: OrphanPtyEntry[] = []
  private claudeSessions: PendingClaudeSession[] = []
  /** T0823: the installer quit record of the previous process (null = none). */
  private installerQuit: { ptys: OrphanPtyEntry[]; claudeSessions: PendingClaudeSession[] } | null = null
  private notice: UpgradeInterruptionNotice | null = null

  constructor(private readonly opts: UpgradeInterruptionCheckOptions) {}

  begin(): void {
    if (this.begun) return
    this.begun = true
    this.previousVersion = readLastRunVersion(this.opts.filePath)
    if (this.previousVersion !== this.opts.currentVersion && !writeLastRunVersion(this.opts.filePath, this.opts.currentVersion)) {
      this.opts.logger.log(`[upgrade-interruption] could not write ${path.basename(this.opts.filePath)} (version ${this.opts.currentVersion})`)
    }
  }

  /** Only the first orphan cleanup of the process counts (a later fork is not an upgrade). */
  noteOrphanCleanup(orphans: readonly OrphanPtyEntry[], claudeSessions: readonly PendingClaudeSession[]): void {
    if (this.finished || this.orphans.length > 0) return
    this.orphans = orphans.map(entry => ({ id: entry.id, ...(entry.cwd ? { cwd: entry.cwd } : {}) }))
    this.claudeSessions = claudeSessions.map(session => ({ ...session }))
  }

  /**
   * T0823: the installer quit record (`takeInstallerQuitRecord`, read once at whenReady before the
   * Terminal Server starts). Only the first one counts; ignored after `finish`.
   */
  noteInstallerQuit(record: { ptys: readonly OrphanPtyEntry[]; claudeSessions: readonly PendingClaudeSession[] } | null): void {
    if (this.finished || this.installerQuit || !record) return
    this.installerQuit = {
      ptys: record.ptys.map(entry => ({ id: entry.id, ...(entry.cwd ? { cwd: entry.cwd } : {}) })),
      claudeSessions: record.claudeSessions.map(session => ({ ...session })),
    }
  }

  /**
   * The ended PTYs: the installer quit record's first, then the orphans it did not list (a Terminal
   * Server the normal quit could not stop), by id. Claude sessions: the record's (taken while the PTYs
   * ran) win over the previous process's store.
   */
  private endedPtys(): { ptys: OrphanPtyEntry[]; claudeSessions: PendingClaudeSession[] } {
    const ptys: OrphanPtyEntry[] = []
    const seen = new Set<string>()
    for (const entry of [...(this.installerQuit?.ptys ?? []), ...this.orphans]) {
      if (!entry?.id || seen.has(entry.id)) continue
      seen.add(entry.id)
      ptys.push(entry)
    }
    const sessions = new Map<string, PendingClaudeSession>()
    for (const session of [...(this.installerQuit?.claudeSessions ?? []), ...this.claudeSessions]) {
      if (session?.terminalId && !sessions.has(session.terminalId)) sessions.set(session.terminalId, session)
    }
    return { ptys, claudeSessions: [...sessions.values()] }
  }

  /**
   * Decides once. Returns the agent sources (for InterruptedAgentsStore) when it detected an upgrade
   * interruption, else null. `agentCountOf` turns the sources into the number listed; its `nameOf`
   * gives the `--name=` the previous process recorded for a terminal (claude-sessions.json).
   */
  finish(windows: readonly SavedWindowEntry[], agentCountOf: (sources: InterruptedAgentSource[], nameOf: (terminalId: string) => string | null) => number): InterruptedAgentSource[] | null {
    if (this.finished) return null
    this.finished = true
    const ended = this.endedPtys()
    const ptyCount = ended.ptys.length
    const installerQuitPtyCount = this.installerQuit?.ptys.length ?? 0
    const source = installerQuitPtyCount > 0 ? (this.orphans.length > 0 ? 'installer+orphans' : 'installer') : 'orphans'
    const detected = detectUpgradeInterruption({
      previousVersion: this.previousVersion,
      currentVersion: this.opts.currentVersion,
      orphanPtyCount: this.orphans.length,
      installerQuitPtyCount,
    })
    if (!detected) {
      if (this.previousVersion !== this.opts.currentVersion) {
        this.opts.logger.log(`[upgrade-interruption] none: previous=${this.previousVersion ?? 'unknown'} current=${this.opts.currentVersion} ended-ptys=${ptyCount}`)
      }
      this.claudeSessions = []
      this.installerQuit = null
      return null
    }
    let sources: InterruptedAgentSource[] = []
    try {
      sources = buildUpgradeInterruptedSources(ended.ptys, windows, ended.claudeSessions)
    } catch {
      sources = []
    }
    let agentCount = 0
    try {
      const names = new Map(ended.claudeSessions.map(session => [session.terminalId, session.name]))
      agentCount = agentCountOf(sources, id => names.get(id) ?? null)
    } catch {
      agentCount = 0
    }
    this.notice = { previousVersion: this.previousVersion!, currentVersion: this.opts.currentVersion, ptyCount, agentCount }
    this.claudeSessions = []
    this.installerQuit = null
    const sameVersion = this.previousVersion === this.opts.currentVersion ? ' same-version' : ''
    this.opts.logger.log(`[upgrade-interruption] detected: previous=${this.previousVersion} current=${this.opts.currentVersion} ended-ptys=${ptyCount} agent-tabs=${agentCount} source=${source}${sameVersion}`)
    return sources
  }

  /** The notice for the first window that asks; null afterwards (shown once). */
  takeNotice(): UpgradeInterruptionNotice | null {
    const notice = this.notice
    this.notice = null
    return notice
  }
}
