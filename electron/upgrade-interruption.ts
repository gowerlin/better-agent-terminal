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
 * T0860 (PLAN-065 W4): a schema 2 record (the quit kept the PTY holder) names its ended PTYs `endedPtys`
 * (normally none) and the tabs whose embedded agent it ended (`endedAgentProcesses`): those tabs are listed as
 * agent sources too and count like the record's PTYs; the notice then has `holderKept: true`. Schema 1 as above.
 * T0861 (PLAN-065 W5, D286 D4 / D5 / D6): main reconnects to the kept holder without the Recovery prompt when
 * `decideHolderReattach` says so, and tells this check (`noteHolderReattached`): the notice then carries
 * `reattachedPtyCount` (the renderer's "reconnected N terminals" toast) even when nothing was ended. A Terminal
 * Server this BAT cannot use (hello refused / no common protocol / no answer, T0857) that main ended is another
 * source of ended PTYs (`noteIncompatibleServer`, N = its registry's PTYs): detected when the version changed or
 * a holder-keeping record exists. `shouldReplaceIdleServer` is main's D6 rule (0 PTYs, another version → replace).
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
  /**
   * T0860 (schema 2 record, the PTY holder was kept): the tabs whose embedded agent the quit ended (D3).
   * Their shells still run in the holder; the agents are listed with `cause: 'upgrade'`. 0 / absent = none.
   */
  installerQuitAgentTabCount?: number
  /**
   * T0861 (D5): PTYs of a Terminal Server main found unusable (T0857 hello failure) and ended — its registry's
   * entries. Counts when the version changed or `holderKept` (a holder-keeping record exists); the same version
   * without one is not an upgrade (only logged). 0 / absent = none.
   */
  incompatibleServerPtyCount?: number
  /** T0861: the previous BAT's installer quit kept the PTY holder (schema 2 record). */
  holderKept?: boolean
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
  // T0860: same rule as the record's PTYs (the installer quit ended them; a crash leaves no record)
  if (atLeastOne(input.installerQuitAgentTabCount)) return true
  // T0861 (D5): the installer kept a holder this BAT could not use, or an upgrade met one
  if (atLeastOne(input.incompatibleServerPtyCount) && (input.holderKept === true || input.previousVersion !== input.currentVersion)) return true
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
  /**
   * T0860: the previous BAT quit for the installer keeping the PTY holder (schema 2 record). `ptyCount` is
   * then the PTYs that quit ended (normally 0, so the renderer shows no "ended N terminals" toast); the
   * agent tabs whose embedded agent it ended are in `agentCount`. W5 (T0861) words the toast for it.
   */
  holderKept?: true
  /**
   * T0861 (D4): main reconnected to the kept PTY holder without the Recovery prompt — the terminals it found
   * running (≥ 1). The renderer shows "reconnected N terminals" instead of "ended N terminals".
   */
  reattachedPtyCount?: number
}

/** T0861: why main does (or does not) reconnect to a Terminal Server without the Recovery prompt. */
export type HolderReattachDecision =
  | { auto: true }
  | { auto: false; reason: 'no-record' | 'no-holder-pid' | 'pid-file-mismatch' | 'no-hello' | 'hello-pid-mismatch' | 'no-ptys' }

export interface HolderReattachInput {
  /** `UpgradeInterruptionCheck.keptHolder()`: the schema 2 record's holder (null = no holder-keeping record). */
  keptHolder: { pid: number | null } | null
  /** `bat-pty-server.pid` now. */
  pidFilePid: number | null
  /** The probe's `server:hello-ok` (null = no hello: a server before T0857, protocol 0). */
  hello: { pid?: unknown } | null
  /** Live PTYs the probe listed. */
  ptyCount: number
}

/**
 * T0861 (D4): reconnect without the Recovery prompt only when **all** hold — a schema 2 installer quit record
 * (`holderKept`), its holder pid equal to the pid file's, a negotiated hello whose pid is that pid too, and ≥ 1
 * live PTY. Anything else (the user kept the server at quit, a per-machine upgrade that forced BAT closed, no
 * record) → the Recovery prompt as before (T0578).
 */
export function decideHolderReattach(input: HolderReattachInput): HolderReattachDecision {
  if (!input.keptHolder) return { auto: false, reason: 'no-record' }
  const pid = input.keptHolder.pid
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return { auto: false, reason: 'no-holder-pid' }
  if (input.pidFilePid !== pid) return { auto: false, reason: 'pid-file-mismatch' }
  if (!input.hello) return { auto: false, reason: 'no-hello' }
  if (input.hello.pid !== pid) return { auto: false, reason: 'hello-pid-mismatch' }
  if (!atLeastOne(input.ptyCount)) return { auto: false, reason: 'no-ptys' }
  return { auto: true }
}

/**
 * T0861 (D6): a Terminal Server that listed 0 PTYs and reports another BAT version → main shuts it down and
 * starts this version's. An unknown version (no hello, or a server that was not told: '') → keep it (silent
 * reconnect, T0108). `listed` false (no `pty:list` answer, so 0 is a guess) → keep it.
 */
export function shouldReplaceIdleServer(input: { listed: boolean; ptyCount: number; serverVersion: unknown; currentVersion: string }): boolean {
  if (!input.listed || input.ptyCount !== 0) return false
  const version = input.serverVersion
  return typeof version === 'string' && VERSION_PATTERN.test(version) && version !== input.currentVersion
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

/**
 * What `noteInstallerQuit` reads of an installer quit record (electron/installer-quit-request.ts matches it
 * structurally): schema 1 `ptys`; T0860 schema 2 `holderKept` + `endedPtys` + `endedAgentProcesses`.
 */
export interface InstallerQuitNoteInput {
  /** The quitting BAT's version (T0861: the notice's `previousVersion` when last-run-version.json is missing). */
  version?: string
  ptys?: readonly OrphanPtyEntry[]
  claudeSessions: readonly PendingClaudeSession[]
  holderKept?: boolean
  /** T0861: the holder's pid at the quit (schema 2); compared with the pid file before reconnecting. */
  holderPid?: number | null
  endedPtys?: readonly OrphanPtyEntry[]
  endedAgentProcesses?: readonly { terminalId: string }[]
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
  /** T0823: the installer quit record of the previous process (null = none). T0860: schema 2 adds the rest. */
  private installerQuit: { ptys: OrphanPtyEntry[]; claudeSessions: PendingClaudeSession[]; holderKept: boolean; holderPid: number | null; version: string | null; agentTabs: OrphanPtyEntry[] } | null = null
  /** T0861: the PTYs of an unusable Terminal Server main ended (its registry), and the claude sessions then. */
  private incompatible: { ptys: OrphanPtyEntry[]; claudeSessions: PendingClaudeSession[] } | null = null
  /** T0861: main reconnected to the kept holder without the Recovery prompt (live PTYs, the holder's BAT version). */
  private reattached: { ptyCount: number; holderVersion: string } | null = null
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
  noteInstallerQuit(record: InstallerQuitNoteInput | null): void {
    if (this.finished || this.installerQuit || !record) return
    // T0860: schema 2 (`holderKept`) names the ended PTYs `endedPtys` and adds the tabs whose agent it ended
    const holderKept = record.holderKept === true
    const ptys = (holderKept ? record.endedPtys : record.ptys) ?? []
    const holderPid = holderKept && typeof record.holderPid === 'number' && Number.isInteger(record.holderPid) && record.holderPid > 0 ? record.holderPid : null
    this.installerQuit = {
      ptys: ptys.map(entry => ({ id: entry.id, ...(entry.cwd ? { cwd: entry.cwd } : {}) })),
      claudeSessions: record.claudeSessions.map(session => ({ ...session })),
      holderKept,
      holderPid,
      version: typeof record.version === 'string' && VERSION_PATTERN.test(record.version) ? record.version : null,
      agentTabs: holderKept ? (record.endedAgentProcesses ?? []).map(entry => ({ id: entry.terminalId })) : [],
    }
  }

  /**
   * T0861: the holder the previous BAT's installer quit kept (schema 2 record; `pid` null = not recorded), or
   * null without such a record. `decideHolderReattach` reads it; valid until `finish`.
   */
  keptHolder(): { pid: number | null } | null {
    return this.installerQuit?.holderKept ? { pid: this.installerQuit.holderPid } : null
  }

  /**
   * T0861 (D5): main ended a Terminal Server it could not use (T0857 hello failure) — the PTYs of its registry
   * (read before the shutdown) and the claude sessions then. Only the first one counts; ignored after `finish`.
   */
  noteIncompatibleServer(ptys: readonly OrphanPtyEntry[], claudeSessions: readonly PendingClaudeSession[]): void {
    if (this.finished || this.incompatible || ptys.length === 0) return
    this.incompatible = {
      ptys: ptys.map(entry => ({ id: entry.id, ...(entry.cwd ? { cwd: entry.cwd } : {}) })),
      claudeSessions: claudeSessions.map(session => ({ ...session })),
    }
  }

  /** T0861 (D4): main reconnected to the kept holder without the Recovery prompt. Ignored after `finish`. */
  noteHolderReattached(ptyCount: number, holderVersion: string): void {
    if (this.finished || this.reattached || !atLeastOne(ptyCount)) return
    this.reattached = { ptyCount, holderVersion: VERSION_PATTERN.test(holderVersion) ? holderVersion : 'unknown' }
  }

  /**
   * The ended PTYs: the installer quit record's first, then the orphans it did not list (a Terminal
   * Server the normal quit could not stop), by id. Claude sessions: the record's (taken while the PTYs
   * ran) win over the previous process's store.
   */
  private endedPtys(): { ptys: OrphanPtyEntry[]; claudeSessions: PendingClaudeSession[] } {
    const ptys: OrphanPtyEntry[] = []
    const seen = new Set<string>()
    for (const entry of [...(this.installerQuit?.ptys ?? []), ...this.orphans, ...(this.incompatible?.ptys ?? [])]) {
      if (!entry?.id || seen.has(entry.id)) continue
      seen.add(entry.id)
      ptys.push(entry)
    }
    const sessions = new Map<string, PendingClaudeSession>()
    for (const session of [...(this.installerQuit?.claudeSessions ?? []), ...this.claudeSessions, ...(this.incompatible?.claudeSessions ?? [])]) {
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
    // T0860: the tabs whose agent the holder-keeping quit ended (their shells were not ended)
    const holderKept = this.installerQuit?.holderKept === true
    const agentTabs = (this.installerQuit?.agentTabs ?? []).filter(tab => !ended.ptys.some(entry => entry.id === tab.id))
    const incompatibleCount = this.incompatible?.ptys.length ?? 0
    const fromInstaller = installerQuitPtyCount > 0 || agentTabs.length > 0
    const source = [fromInstaller ? 'installer' : '', this.orphans.length > 0 ? 'orphans' : '', incompatibleCount > 0 ? 'incompatible' : ''].filter(Boolean).join('+') || 'orphans'
    const detected = detectUpgradeInterruption({
      previousVersion: this.previousVersion,
      currentVersion: this.opts.currentVersion,
      orphanPtyCount: this.orphans.length,
      installerQuitPtyCount,
      ...(holderKept ? { installerQuitAgentTabCount: agentTabs.length, holderKept: true } : {}),
      ...(incompatibleCount > 0 ? { incompatibleServerPtyCount: incompatibleCount } : {}),
    })
    // T0861: the version the reattach notice names — last-run-version.json, else the record's (the quitting BAT)
    const reattachPrevious = this.previousVersion ?? this.installerQuit?.version ?? null
    // (detected implies a previous version, so a detected start always keeps its reattach count)
    const reattached = reattachPrevious !== null ? this.reattached : null
    if (!detected && !reattached) {
      if (this.reattached) {
        this.opts.logger.log(`[upgrade-interruption] reattached: previous=unknown current=${this.opts.currentVersion} reattached-ptys=${this.reattached.ptyCount} holder-version=${this.reattached.holderVersion} (no notice)`)
      } else if (this.previousVersion !== this.opts.currentVersion) {
        this.opts.logger.log(`[upgrade-interruption] none: previous=${this.previousVersion ?? 'unknown'} current=${this.opts.currentVersion} ended-ptys=${ptyCount}`)
      }
      this.claudeSessions = []
      this.installerQuit = null
      this.incompatible = null
      return null
    }
    const previousVersion = reattachPrevious!
    let sources: InterruptedAgentSource[] = []
    let agentCount = 0
    if (detected) {
      try {
        sources = buildUpgradeInterruptedSources([...ended.ptys, ...agentTabs], windows, ended.claudeSessions)
      } catch {
        sources = []
      }
      try {
        const names = new Map(ended.claudeSessions.map(session => [session.terminalId, session.name]))
        agentCount = agentCountOf(sources, id => names.get(id) ?? null)
      } catch {
        agentCount = 0
      }
    }
    this.notice = {
      previousVersion,
      currentVersion: this.opts.currentVersion,
      ptyCount: detected ? ptyCount : 0,
      agentCount,
      ...(holderKept ? { holderKept: true as const } : {}),
      ...(reattached ? { reattachedPtyCount: reattached.ptyCount } : {}),
    }
    this.claudeSessions = []
    this.installerQuit = null
    this.incompatible = null
    const sameVersion = previousVersion === this.opts.currentVersion ? ' same-version' : ''
    const kept = holderKept ? ` holder-kept ended-agent-tabs=${agentTabs.length}` : ''
    const back = reattached ? ` reattached-ptys=${reattached.ptyCount} holder-version=${reattached.holderVersion}` : ''
    if (detected) {
      this.opts.logger.log(`[upgrade-interruption] detected: previous=${previousVersion} current=${this.opts.currentVersion} ended-ptys=${ptyCount} agent-tabs=${agentCount} source=${source}${sameVersion}${kept}${back}`)
    } else {
      this.opts.logger.log(`[upgrade-interruption] reattached: previous=${previousVersion} current=${this.opts.currentVersion}${sameVersion}${back}`)
    }
    return detected ? sources : null
  }

  /** The notice for the first window that asks; null afterwards (shown once). */
  takeNotice(): UpgradeInterruptionNotice | null {
    const notice = this.notice
    this.notice = null
    return notice
  }
}
