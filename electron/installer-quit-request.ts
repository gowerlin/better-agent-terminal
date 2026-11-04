/**
 * PLAN-063 子項 3 / T0823: the Windows NSIS installer asks a running BAT to quit normally before it
 * replaces the files, instead of ending every process under the install directory (T0820:
 * `Stop-Process` = TerminateProcess, no flush-save, the Terminal Server's shutdown never runs).
 *
 * Channel: the installer (build/installer.nsh, `customCheckAppRunning`) starts
 * `<install dir>\BetterAgentTerminal.exe --installer-quit-request`. That process is a second instance:
 * Electron's single-instance lock (`app.requestSingleInstanceLock`, per userData) hands its argv to the
 * running BAT (`second-instance`) and it quits at once. Only this one argument is read — nothing else
 * from the request is used; no port, no file, no other data. The lock is per user (per userData), so
 * only a process of the same user on this machine reaches it.
 *
 * The running BAT (`InstallerQuitController`): records the terminals the quit will end and their claude
 * sessions in `<userData>/installer-quit-record.json` (read once by the next start: the upgrade notice of
 * T0821, electron/upgrade-interruption.ts), then quits the normal way — renderer flush-save (T0504),
 * profile snapshots, `stopTerminalServerGracefully` (T0540: IPC / TCP `server:shutdown`, never SIGTERM
 * on Windows), remote / ssh cleanup — without the quit confirmation dialog and without keeping the
 * Terminal Server.
 *
 * No BAT window process but the lock was free (`runInstallerQuitWithoutApp`): the user quit BAT keeping
 * the Terminal Server. The request process then records that server's PTYs (registry) and asks it to
 * shut down (TCP `server:shutdown`, with the server's token since T0857), waits for it, and exits; it
 * never opens a window.
 *
 * Whatever fails (old BAT that ignores the argument, BAT still starting, a quit already in progress,
 * timeout), the installer falls back to electron-builder's own check after its wait
 * (`BAT_INSTALLER_QUIT_TIMEOUT_MS` in build/installer.nsh): the behaviour before T0823.
 *
 * 🔴 No `electron` import; no path at import time (main passes the userData path). Never throws.
 * Logs `[installer-quit] …` with counts only — no cwd, no session id, no token.
 */
import * as fs from 'fs'
import * as path from 'path'
import type { OrphanPtyEntry, PendingClaudeSession } from './upgrade-interruption'

/** The one argument the installer passes (build/installer.nsh `BAT_INSTALLER_QUIT_ARG`, same string). */
export const INSTALLER_QUIT_REQUEST_ARG = '--installer-quit-request'
export const INSTALLER_QUIT_RECORD_FILE = 'installer-quit-record.json'
const INSTALLER_QUIT_RECORD_SCHEMA = 1
/** How long the request process waits for a Terminal Server it asked to shut down (no BAT window process). */
export const INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS = 8_000

const TERMINAL_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VERSION_PATTERN = /^[0-9A-Za-z.+-]{1,64}$/
const MAX_NAME_LENGTH = 256
const MAX_CWD_LENGTH = 4096
const MAX_ENTRIES = 1024

export interface InstallerQuitLogger {
  log(message: string): void
}

/** True when `argv` carries the installer's request (exact argument; Chromium may add others). */
export function isInstallerQuitRequest(argv: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(argv) && argv.some(arg => arg === INSTALLER_QUIT_REQUEST_ARG)
}

/** What the quit ended: the next start's upgrade notice reads it (`noteInstallerQuit`). */
export interface InstallerQuitRecord {
  schema: 1
  /** The version that quit (the one being replaced). */
  version: string
  /** `running-app` = the BAT window process quit; `server-only` = only a kept Terminal Server was stopped. */
  source: 'running-app' | 'server-only'
  ptys: OrphanPtyEntry[]
  claudeSessions: PendingClaudeSession[]
}

function cleanPtys(list: readonly unknown[]): OrphanPtyEntry[] {
  const out: OrphanPtyEntry[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    if (out.length >= MAX_ENTRIES) break
    const entry = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null
    const id = entry?.id
    if (typeof id !== 'string' || !TERMINAL_ID_PATTERN.test(id) || seen.has(id)) continue
    seen.add(id)
    const cwd = entry?.cwd
    out.push({ id, ...(typeof cwd === 'string' && cwd.length > 0 && cwd.length <= MAX_CWD_LENGTH ? { cwd } : {}) })
  }
  return out
}

function cleanSessions(list: readonly unknown[]): PendingClaudeSession[] {
  const out: PendingClaudeSession[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    if (out.length >= MAX_ENTRIES) break
    const entry = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null
    const terminalId = entry?.terminalId
    if (typeof terminalId !== 'string' || !TERMINAL_ID_PATTERN.test(terminalId) || seen.has(terminalId)) continue
    const name = typeof entry?.name === 'string' && entry.name.length > 0 && entry.name.length <= MAX_NAME_LENGTH ? entry.name : null
    const sessionId = typeof entry?.sessionId === 'string' && SESSION_ID_PATTERN.test(entry.sessionId) ? entry.sessionId : null
    if (name === null && sessionId === null) continue
    seen.add(terminalId)
    out.push({ terminalId, name, sessionId })
  }
  return out
}

export function buildInstallerQuitRecord(input: {
  version: string
  source: InstallerQuitRecord['source']
  ptys: readonly unknown[]
  claudeSessions: readonly unknown[]
}): InstallerQuitRecord {
  return {
    schema: INSTALLER_QUIT_RECORD_SCHEMA,
    version: VERSION_PATTERN.test(input.version) ? input.version : 'unknown',
    source: input.source === 'server-only' ? 'server-only' : 'running-app',
    ptys: cleanPtys(Array.isArray(input.ptys) ? input.ptys : []),
    claudeSessions: cleanSessions(Array.isArray(input.claudeSessions) ? input.claudeSessions : []),
  }
}

/** Writes the record (temp file + rename, owner-only). Returns false on failure; never throws. */
export function writeInstallerQuitRecord(filePath: string, record: InstallerQuitRecord): boolean {
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`)
  try {
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
    fs.renameSync(tmp, filePath)
    return true
  } catch {
    try { fs.rmSync(tmp, { force: true }) } catch { /* best-effort */ }
    return false
  }
}

export type InstallerQuitRecordRead =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'ok'; record: InstallerQuitRecord }

/** Reads the record; never throws. Anything but schema 1 with a valid version is `invalid`. */
export function readInstallerQuitRecord(filePath: string): InstallerQuitRecordRead {
  let text: string
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT' ? { status: 'missing' } : { status: 'invalid' }
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || parsed.schema !== INSTALLER_QUIT_RECORD_SCHEMA) return { status: 'invalid' }
    if (typeof parsed.version !== 'string' || !VERSION_PATTERN.test(parsed.version)) return { status: 'invalid' }
    if (!Array.isArray(parsed.ptys)) return { status: 'invalid' }
    return {
      status: 'ok',
      record: buildInstallerQuitRecord({
        version: parsed.version,
        source: parsed.source === 'server-only' ? 'server-only' : 'running-app',
        ptys: parsed.ptys,
        claudeSessions: Array.isArray(parsed.claudeSessions) ? parsed.claudeSessions : [],
      }),
    }
  } catch {
    return { status: 'invalid' }
  }
}

/**
 * The next start (whenReady, before the Terminal Server starts): reads the record and deletes it, so
 * it is used once whatever the upgrade check decides. Returns null when there is none / it is invalid.
 */
export function takeInstallerQuitRecord(filePath: string, logger: InstallerQuitLogger): InstallerQuitRecord | null {
  const read = readInstallerQuitRecord(filePath)
  if (read.status === 'missing') return null
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    logger.log(`[installer-quit] could not remove ${path.basename(filePath)}`)
  }
  if (read.status === 'invalid') {
    logger.log(`[installer-quit] ${path.basename(filePath)} unreadable — ignored`)
    return null
  }
  const { record } = read
  logger.log(`[installer-quit] record found: version=${record.version} source=${record.source} ptys=${record.ptys.length} claude-sessions=${record.claudeSessions.length}`)
  return record
}

export interface InstallerQuitSnapshot {
  ptys: readonly unknown[]
  claudeSessions: readonly unknown[]
}

export interface InstallerQuitControllerDeps {
  version: string
  /** A quit (the user's, or an earlier request) is already under way. */
  isQuitting(): boolean
  /** The running PTYs (`ptyManager.listTerminalIds` + `getCwd`) and their claude sessions. */
  collect(): InstallerQuitSnapshot
  writeRecord(record: InstallerQuitRecord): boolean
  /** The normal quit without the confirmation dialog, stopping the Terminal Server. */
  quit(): void
  logger: InstallerQuitLogger
}

/**
 * The running BAT's side (Electron main). `request` comes from `second-instance`; before
 * `markReady` (startup not finished: windows not created yet) it is kept and run by `markReady`.
 * Handled once per process.
 */
export class InstallerQuitController {
  private ready = false
  private pending = false
  private handled = false

  constructor(private readonly deps: InstallerQuitControllerDeps) {}

  request(): void {
    if (this.handled) {
      this.deps.logger.log('[installer-quit] request received again — already quitting')
      return
    }
    if (!this.ready) {
      if (!this.pending) this.deps.logger.log('[installer-quit] request received during startup — quitting once startup finished')
      this.pending = true
      return
    }
    this.run()
  }

  /** Startup finished (the point the other `second-instance` handling starts too). */
  markReady(): void {
    if (this.ready) return
    this.ready = true
    if (this.pending) {
      this.pending = false
      this.run()
    }
  }

  private run(): void {
    this.handled = true
    try {
      if (this.deps.isQuitting()) {
        // e.g. the user's quit dialog is open: its answer decides; the installer falls back after its wait
        this.deps.logger.log('[installer-quit] request ignored: a quit is already in progress')
        return
      }
      let snapshot: InstallerQuitSnapshot = { ptys: [], claudeSessions: [] }
      try {
        snapshot = this.deps.collect()
      } catch {
        snapshot = { ptys: [], claudeSessions: [] }
      }
      const record = buildInstallerQuitRecord({ version: this.deps.version, source: 'running-app', ...snapshot })
      const written = this.deps.writeRecord(record)
      this.deps.logger.log(`[installer-quit] request received: ${written ? 'recorded' : 'could not record'} ${record.ptys.length} terminal(s), ${record.claudeSessions.length} claude session(s) — quitting without confirmation, stopping the Terminal Server`)
    } catch (error) {
      this.deps.logger.log(`[installer-quit] record failed: ${error instanceof Error ? error.message : String(error)} — quitting anyway`)
    }
    try {
      this.deps.quit()
    } catch (error) {
      this.deps.logger.log(`[installer-quit] quit failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export interface InstallerQuitWithoutAppDeps {
  version: string
  /** This userData's Terminal Server is alive (pid file + process). */
  serverRunning(): boolean
  /** Its PTY registry (`bat-pty-registry.json` `ptys`), [] when unreadable. */
  registryPtys(): readonly unknown[]
  /** The claude sessions the last BAT process stored (`claude-sessions.json` `sessions`), [] when unreadable. */
  storedClaudeSessions(): readonly unknown[]
  writeRecord(record: InstallerQuitRecord): boolean
  /**
   * TCP `server:shutdown` (main.ts `sendShutdownToServer`); false when there is no port file.
   * T0857 (PLAN-065 W1): after a `server:hello` with the server's token (`bat-pty-server.token`) —
   * a v1 server refuses an unauthenticated request; a server before T0857 ignores the hello.
   */
  sendShutdown(): Promise<boolean>
  /** Resolves true once the server is gone (main.ts `waitForTerminalServerExit`). */
  waitForServerExit(timeoutMs: number): Promise<boolean>
  logger: InstallerQuitLogger
}

export type InstallerQuitWithoutAppResult = 'no-server' | 'server-stopped' | 'server-still-running' | 'no-port'

/**
 * The request process holds the lock: no BAT window process runs. When a kept Terminal Server runs,
 * record its PTYs and ask it to shut down (its own shutdown: T0540 tree-then-shell, pid / port /
 * registry files removed). Never opens a window; the caller exits afterwards. Never throws.
 */
export async function runInstallerQuitWithoutApp(deps: InstallerQuitWithoutAppDeps): Promise<InstallerQuitWithoutAppResult> {
  try {
    if (!deps.serverRunning()) {
      deps.logger.log('[installer-quit] no running BAT and no Terminal Server — nothing to do')
      return 'no-server'
    }
    let ptys: readonly unknown[] = []
    let sessions: readonly unknown[] = []
    try { ptys = deps.registryPtys() } catch { ptys = [] }
    try { sessions = deps.storedClaudeSessions() } catch { sessions = [] }
    const record = buildInstallerQuitRecord({ version: deps.version, source: 'server-only', ptys, claudeSessions: sessions })
    const written = record.ptys.length > 0 ? deps.writeRecord(record) : false
    deps.logger.log(`[installer-quit] no running BAT; Terminal Server running with ${record.ptys.length} terminal(s)${record.ptys.length > 0 ? (written ? ' (recorded)' : ' (could not record)') : ''} — asking it to shut down`)
    const sent = await deps.sendShutdown()
    if (!sent) {
      deps.logger.log('[installer-quit] Terminal Server has no port file — left to the installer')
      return 'no-port'
    }
    const gone = await deps.waitForServerExit(INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS)
    deps.logger.log(gone ? '[installer-quit] Terminal Server stopped (server:shutdown)' : `[installer-quit] Terminal Server still running after ${INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS} ms — left to the installer`)
    return gone ? 'server-stopped' : 'server-still-running'
  } catch (error) {
    deps.logger.log(`[installer-quit] failed: ${error instanceof Error ? error.message : String(error)}`)
    return 'server-still-running'
  }
}
