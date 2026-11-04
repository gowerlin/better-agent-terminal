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
 * PLAN-065 W4 / T0860 (D286 D3 / D7): when the Terminal Server runs from a valid PTY holder (outside the
 * install directory, T0858 / T0859), an upgrade's request keeps it: the server gets a 24 h idle timeout
 * (`server:extendIdle`), the processes in the tabs' trees whose executable is under the install directory
 * (the embedded claude / codex) are ended by BAT itself and recorded, the record is schema 2
 * (`holderKept`), and only the BAT window process quits (`runKeepingHolder`, `runInstallerQuitWithoutApp`
 * with `keptHolder`). 🔴 Without a holder (zip, dev, holder missing or not matching, macOS / Linux) every
 * step above is the T0823 one, unchanged (schema 1, the server stops). The uninstaller's own request
 * (`--uninstall-quit-request`, a real uninstall) always stops the server, holder or not.
 *
 * 🔴 No `electron` import; no path at import time (main passes the userData path). Never throws.
 * Logs `[installer-quit] …` with counts only — no cwd, no session id, no token, no process path.
 */
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { MAX_IDLE_EXTENSION_MS, createLineParser, openHelloConnection, type HelloOk } from './terminal-server/protocol'
import type { OrphanPtyEntry, PendingClaudeSession } from './upgrade-interruption'

/** The one argument the installer passes (build/installer.nsh `BAT_INSTALLER_QUIT_ARG`, same string). */
export const INSTALLER_QUIT_REQUEST_ARG = '--installer-quit-request'
/**
 * T0860: the uninstaller's argument for a real uninstall (build/installer.nsh `BAT_UNINSTALL_QUIT_ARG`, same
 * string). Separate from the installer's: the request process cannot tell an upgrade from an uninstall.
 */
export const UNINSTALL_QUIT_REQUEST_ARG = '--uninstall-quit-request'
export const INSTALLER_QUIT_RECORD_FILE = 'installer-quit-record.json'
const INSTALLER_QUIT_RECORD_SCHEMA = 1
/** T0860: the record of a quit that kept the PTY holder (`InstallerQuitHolderRecord`). */
const INSTALLER_QUIT_HOLDER_RECORD_SCHEMA = 2
/** D7: the idle timeout a kept holder gets for the upgrade (24 h, the most `server:extendIdle` allows). */
export const INSTALLER_QUIT_HOLDER_IDLE_MS = MAX_IDLE_EXTENSION_MS
/** How long BAT waits for the kept holder's hello / `server:idle-extended` answer. */
export const INSTALLER_QUIT_HOLDER_QUERY_TIMEOUT_MS = 2_000
/** How long BAT waits for the ended agent processes to be gone. */
export const INSTALLER_QUIT_AGENT_EXIT_TIMEOUT_MS = 3_000
/** The process list query (PowerShell Get-CimInstance Win32_Process). */
export const INSTALLER_QUIT_PROCESS_LIST_TIMEOUT_MS = 8_000
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

/** T0860: true when `argv` carries the uninstaller's request (exact argument). */
export function isUninstallQuitRequest(argv: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(argv) && argv.some(arg => arg === UNINSTALL_QUIT_REQUEST_ARG)
}

/** `upgrade` = the installer (or an uninstall run by an upgrade); `uninstall` = a real uninstall. */
export type InstallerQuitKind = 'upgrade' | 'uninstall'

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

/** T0860: one tab whose processes under the install directory (embedded claude / codex) BAT ended. */
export interface EndedAgentProcesses {
  terminalId: string
  /** How many processes of that tab's tree were ended. */
  processes: number
}

/**
 * T0860 (schema 2): a quit that kept the PTY holder. `endedPtys` = the PTYs the quit ended (none: the
 * holder keeps them; the field is there so a later quit kind can say otherwise), `endedAgentProcesses` =
 * the tabs whose embedded agent BAT ended (D3), `claudeSessions` = those tabs' claude sessions.
 */
export interface InstallerQuitHolderRecord {
  schema: 2
  version: string
  source: 'running-app' | 'server-only'
  holderKept: true
  /** The holder's pid at the quit (W5 compares it with the pid file before reconnecting); null = unknown. */
  holderPid: number | null
  endedPtys: OrphanPtyEntry[]
  endedAgentProcesses: EndedAgentProcesses[]
  claudeSessions: PendingClaudeSession[]
}

/** Either schema; `takeInstallerQuitRecord` returns this. */
export type AnyInstallerQuitRecord = InstallerQuitRecord | InstallerQuitHolderRecord

function cleanEndedAgents(list: readonly unknown[]): EndedAgentProcesses[] {
  const out: EndedAgentProcesses[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    if (out.length >= MAX_ENTRIES) break
    const entry = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null
    const terminalId = entry?.terminalId
    const processes = entry?.processes
    if (typeof terminalId !== 'string' || !TERMINAL_ID_PATTERN.test(terminalId) || seen.has(terminalId)) continue
    if (typeof processes !== 'number' || !Number.isInteger(processes) || processes < 1) continue
    seen.add(terminalId)
    out.push({ terminalId, processes: Math.min(processes, MAX_ENTRIES) })
  }
  return out
}

function validPid(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 0x7fffffff ? value : null
}

export function buildHolderKeptQuitRecord(input: {
  version: string
  source: InstallerQuitHolderRecord['source']
  holderPid: unknown
  endedPtys?: readonly unknown[]
  endedAgentProcesses: readonly unknown[]
  claudeSessions: readonly unknown[]
}): InstallerQuitHolderRecord {
  return {
    schema: INSTALLER_QUIT_HOLDER_RECORD_SCHEMA,
    version: VERSION_PATTERN.test(input.version) ? input.version : 'unknown',
    source: input.source === 'server-only' ? 'server-only' : 'running-app',
    holderKept: true,
    holderPid: validPid(input.holderPid),
    endedPtys: cleanPtys(Array.isArray(input.endedPtys) ? input.endedPtys : []),
    endedAgentProcesses: cleanEndedAgents(Array.isArray(input.endedAgentProcesses) ? input.endedAgentProcesses : []),
    claudeSessions: cleanSessions(Array.isArray(input.claudeSessions) ? input.claudeSessions : []),
  }
}

/** Writes the record (temp file + rename, owner-only). Returns false on failure; never throws. */
export function writeInstallerQuitRecord(filePath: string, record: AnyInstallerQuitRecord): boolean {
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
  | { status: 'ok'; record: AnyInstallerQuitRecord }

/**
 * Reads the record; never throws. Anything but schema 1 or 2 with a valid version is `invalid`.
 * Schema 1 (T0823) is read exactly as before; schema 2 (T0860) needs `holderKept: true` and its arrays.
 */
export function readInstallerQuitRecord(filePath: string): InstallerQuitRecordRead {
  let text: string
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT' ? { status: 'missing' } : { status: 'invalid' }
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (parsed && typeof parsed === 'object' && parsed.schema === INSTALLER_QUIT_HOLDER_RECORD_SCHEMA) {
      if (typeof parsed.version !== 'string' || !VERSION_PATTERN.test(parsed.version)) return { status: 'invalid' }
      if (parsed.holderKept !== true || !Array.isArray(parsed.endedPtys) || !Array.isArray(parsed.endedAgentProcesses)) return { status: 'invalid' }
      return {
        status: 'ok',
        record: buildHolderKeptQuitRecord({
          version: parsed.version,
          source: parsed.source === 'server-only' ? 'server-only' : 'running-app',
          holderPid: parsed.holderPid,
          endedPtys: parsed.endedPtys,
          endedAgentProcesses: parsed.endedAgentProcesses,
          claudeSessions: Array.isArray(parsed.claudeSessions) ? parsed.claudeSessions : [],
        }),
      }
    }
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
export function takeInstallerQuitRecord(filePath: string, logger: InstallerQuitLogger): AnyInstallerQuitRecord | null {
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
  if (record.schema === INSTALLER_QUIT_HOLDER_RECORD_SCHEMA) {
    logger.log(`[installer-quit] record found: version=${record.version} source=${record.source} holder-kept ended-ptys=${record.endedPtys.length} agent-tabs=${record.endedAgentProcesses.length} claude-sessions=${record.claudeSessions.length}`)
    return record
  }
  logger.log(`[installer-quit] record found: version=${record.version} source=${record.source} ptys=${record.ptys.length} claude-sessions=${record.claudeSessions.length}`)
  return record
}

// ── T0860: the PTY holder at the quit, and the tabs' processes under the install directory ──────────

/** Windows path `child` is `dir` or inside it (case-insensitive, `\` or `/`); false for anything malformed. */
export function isPathInsideDir(child: unknown, dir: unknown): boolean {
  if (typeof child !== 'string' || typeof dir !== 'string' || !child || !dir) return false
  const norm = (p: string) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
  const c = norm(child)
  const d = norm(dir)
  if (!d) return false
  return c === d || c.startsWith(d + '\\')
}

/**
 * The hello says the server runs from a PTY holder that is not inside the install directory: plain node
 * (`runtime.name === 'node'`, T0859 never sets ELECTRON_RUN_AS_NODE for it) **and** a `holderDir` outside
 * `installDir`, which in turn is not inside it. Anything else (a server before v1 with no hello, the
 * Electron-run server, a missing / overlapping directory) → false: the T0823 path.
 */
export function isKeptHolderHello(hello: HelloOk | null | undefined, installDir: string): boolean {
  if (!hello || hello.type !== 'server:hello-ok') return false
  if (hello.runtime?.name !== 'node') return false
  const holderDir = hello.holderDir
  if (typeof holderDir !== 'string' || !holderDir) return false
  return !isPathInsideDir(holderDir, installDir) && !isPathInsideDir(installDir, holderDir)
}

export type HolderIdleExtension = 'extended' | 'already-extended' | 'failed'

/** What `queryKeptHolder` found: the holder (pid, idle extension) or why the T0823 path is taken. */
export type KeptHolderQuery =
  | { holder: true; pid: number | null; extension: HolderIdleExtension }
  | { holder: false; reason: 'no-port' | 'hello-failed' | 'not-a-holder' }

/**
 * T0860: one TCP connection to this userData's Terminal Server: hello (with the token), and when the hello
 * says it is a kept holder (`isKeptHolderHello`), `server:extendIdle` for 24 h on the same connection (D7).
 * The connection closes right after: the server then starts its idle countdown with the extended value once
 * no client is left. `ALREADY_EXTENDED` is not a failure. Never throws.
 */
export async function queryKeptHolder(input: {
  port: number | null
  token: string | null
  installDir: string
  idleMs?: number
  timeoutMs?: number
}): Promise<KeptHolderQuery> {
  if (!input.port) return { holder: false, reason: 'no-port' }
  const timeoutMs = input.timeoutMs ?? INSTALLER_QUIT_HOLDER_QUERY_TIMEOUT_MS
  let conn: Awaited<ReturnType<typeof openHelloConnection>>
  try {
    conn = await openHelloConnection(input.port, input.token, { keepOpen: true, timeoutMs })
  } catch {
    return { holder: false, reason: 'hello-failed' }
  }
  if (!conn.result.ok || !conn.socket) return { holder: false, reason: 'hello-failed' }
  const socket = conn.socket
  const hello = conn.result.hello
  if (!isKeptHolderHello(hello, input.installDir)) {
    socket.destroy()
    return { holder: false, reason: 'not-a-holder' }
  }
  const pid = validPid(hello?.pid)
  const extension = await new Promise<HolderIdleExtension>((resolve) => {
    let done = false
    const finish = (value: HolderIdleExtension) => {
      if (done) return
      done = true
      clearTimeout(timer)
      socket.destroy()
      resolve(value)
    }
    const take = (raw: unknown) => {
      const msg = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null
      if (msg?.type === 'server:idle-extended') finish('extended')
      else if (msg?.type === 'error' && msg.requestType === 'server:extendIdle') finish(msg.code === 'ALREADY_EXTENDED' ? 'already-extended' : 'failed')
    }
    const timer = setTimeout(() => finish('failed'), timeoutMs)
    for (const msg of conn.held) take(msg)
    const parse = createLineParser(take)
    if (conn.tail) parse(conn.tail)
    socket.on('data', parse)
    socket.on('error', () => finish('failed'))
    socket.on('close', () => finish('failed'))
    try {
      socket.write(JSON.stringify({ type: 'server:extendIdle', durationMs: input.idleMs ?? INSTALLER_QUIT_HOLDER_IDLE_MS }) + '\n')
    } catch {
      finish('failed')
    }
  })
  return { holder: true, pid, extension }
}

/** One process as the Windows process list gives it. `createdAt` = ms since epoch, null when unknown. */
export interface ProcessListEntry {
  pid: number
  parentPid: number
  createdAt: number | null
  path: string | null
}

/** A tab's PTY root: the shell the Terminal Server started (registry `pid`). */
export interface PtyRoot {
  id: string
  pid: number
}

/** One process `findInstallDirAgentProcesses` picked. */
export interface InstallDirProcess {
  terminalId: string
  pid: number
}

/**
 * D3: the processes in the tabs' trees whose executable is under `installDir` — decided by path only,
 * never by name. The PTY root (the shell) itself is never picked, whatever its path; nor is anything outside
 * the trees. A process is a child of its parent only when it is not older than the parent (when both creation
 * times are known), so a reused parent pid does not pull in an unrelated process. Each process once.
 */
export function findInstallDirAgentProcesses(
  processes: readonly ProcessListEntry[],
  roots: readonly PtyRoot[],
  installDir: string,
): InstallDirProcess[] {
  if (!installDir) return []
  const byPid = new Map<number, ProcessListEntry>()
  const children = new Map<number, ProcessListEntry[]>()
  for (const p of processes) {
    if (!p || validPid(p.pid) === null) continue
    byPid.set(p.pid, p)
  }
  for (const p of byPid.values()) {
    if (p.parentPid === p.pid) continue
    const list = children.get(p.parentPid)
    if (list) list.push(p)
    else children.set(p.parentPid, [p])
  }
  const out: InstallDirProcess[] = []
  const taken = new Set<number>()
  for (const root of roots) {
    if (!root || typeof root.id !== 'string' || !TERMINAL_ID_PATTERN.test(root.id) || validPid(root.pid) === null) continue
    const rootEntry = byPid.get(root.pid)
    if (!rootEntry) continue
    const visited = new Set<number>([root.pid])
    const queue: ProcessListEntry[] = [rootEntry]
    while (queue.length > 0) {
      const parent = queue.shift()!
      for (const child of children.get(parent.pid) ?? []) {
        if (visited.has(child.pid)) continue
        if (parent.createdAt !== null && child.createdAt !== null && child.createdAt < parent.createdAt) continue
        visited.add(child.pid)
        queue.push(child)
        if (!taken.has(child.pid) && isPathInsideDir(child.path, installDir)) {
          taken.add(child.pid)
          out.push({ terminalId: root.id, pid: child.pid })
        }
      }
    }
  }
  return out
}

/** Per tab, how many of its processes were ended (input order of first appearance). */
export function summarizeEndedAgents(ended: readonly InstallDirProcess[]): EndedAgentProcesses[] {
  const counts = new Map<string, number>()
  for (const entry of ended) counts.set(entry.terminalId, (counts.get(entry.terminalId) ?? 0) + 1)
  return [...counts].map(([terminalId, processes]) => ({ terminalId, processes }))
}

/**
 * Parses the process list (`PROCESS_LIST_SCRIPT`: `pid<TAB>parentPid<TAB>creation ISO<TAB>path` per line).
 * Malformed lines are skipped.
 */
export function parseProcessList(text: string): ProcessListEntry[] {
  const out: ProcessListEntry[] = []
  for (const raw of String(text).split(/\r?\n/)) {
    if (!raw.trim()) continue
    const [pidText, parentText, createdText, ...rest] = raw.split('\t')
    const pid = Number(pidText)
    const parentPid = Number(parentText)
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(parentPid) || parentPid < 0) continue
    const created = createdText ? Date.parse(createdText) : NaN
    const p = rest.join('\t').trim()
    out.push({ pid, parentPid, createdAt: Number.isFinite(created) ? created : null, path: p ? p : null })
  }
  return out
}

/** Fixed script, no input of any kind; UTF-8 so a non-ASCII path compares as it is. */
const PROCESS_LIST_SCRIPT = [
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  'Get-CimInstance -ClassName Win32_Process | ForEach-Object {',
  "  $c = ''; if ($_.CreationDate) { $c = $_.CreationDate.ToUniversalTime().ToString('o') }",
  "  [Console]::Out.WriteLine(([string]$_.ProcessId) + [char]9 + ([string]$_.ParentProcessId) + [char]9 + $c + [char]9 + [string]$_.ExecutablePath)",
  '}',
].join('\n')

/** Windows only: the process list, or null when it cannot be read. `execFile` + array args + timeout. */
export function listWindowsProcesses(timeoutMs = INSTALLER_QUIT_PROCESS_LIST_TIMEOUT_MS): Promise<ProcessListEntry[] | null> {
  if (process.platform !== 'win32') return Promise.resolve(null)
  const systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
  const powershell = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  return new Promise((resolve) => {
    try {
      execFile(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PROCESS_LIST_SCRIPT], {
        timeout: timeoutMs,
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      }, (error, stdout) => {
        if (error) { resolve(null); return }
        resolve(parseProcessList(stdout))
      })
    } catch {
      resolve(null)
    }
  })
}

export interface EndAgentProcessesDeps {
  listProcesses(): Promise<ProcessListEntry[] | null>
  /** `process.kill(pid)` (TerminateProcess on Windows); throws when it is gone. */
  kill(pid: number): void
  /** `process.kill(pid, 0)` — true while it runs. */
  isAlive(pid: number): boolean
  sleep(ms: number): Promise<void>
  logger: InstallerQuitLogger
}

export const defaultEndAgentProcessesDeps = (logger: InstallerQuitLogger): EndAgentProcessesDeps => ({
  listProcesses: () => listWindowsProcesses(),
  kill: pid => { process.kill(pid) },
  isAlive: pid => {
    try { process.kill(pid, 0); return true } catch { return false }
  },
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  logger,
})

/**
 * D3: ends the processes in the tabs' trees whose executable is under `installDir` (only those: the shells
 * and every other process stay) and waits for them to be gone (≤ INSTALLER_QUIT_AGENT_EXIT_TIMEOUT_MS).
 * Returns what was ended, per process. No process list → nothing is ended. Never throws; logs counts only.
 */
export async function endInstallDirAgentProcesses(
  roots: readonly PtyRoot[],
  installDir: string,
  deps: EndAgentProcessesDeps,
): Promise<InstallDirProcess[]> {
  try {
    if (roots.length === 0) return []
    const list = await deps.listProcesses()
    if (!list) {
      deps.logger.log('[installer-quit] process list unavailable — no agent process ended')
      return []
    }
    const found = findInstallDirAgentProcesses(list, roots, installDir)
    if (found.length === 0) return []
    const ended: InstallDirProcess[] = []
    for (const entry of found) {
      try {
        deps.kill(entry.pid)
        ended.push(entry)
      } catch {
        // already gone: it no longer runs from the install directory either
        if (!deps.isAlive(entry.pid)) ended.push(entry)
      }
    }
    const start = Date.now()
    while (ended.some(entry => deps.isAlive(entry.pid)) && Date.now() - start < INSTALLER_QUIT_AGENT_EXIT_TIMEOUT_MS) {
      await deps.sleep(100)
    }
    const left = ended.filter(entry => deps.isAlive(entry.pid)).length
    deps.logger.log(`[installer-quit] ended ${ended.length} agent process(es) under the install directory in ${summarizeEndedAgents(ended).length} tab(s)${left ? ` (${left} still running)` : ''}`)
    return ended
  } catch (error) {
    deps.logger.log(`[installer-quit] ending agent processes failed: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

/** The registry's PTY roots (`bat-pty-registry.json` `ptys`: id + shell pid). */
export function ptyRootsOf(list: readonly unknown[]): PtyRoot[] {
  const out: PtyRoot[] = []
  for (const raw of Array.isArray(list) ? list : []) {
    const entry = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null
    const id = entry?.id
    const pid = validPid(entry?.pid)
    if (typeof id === 'string' && TERMINAL_ID_PATTERN.test(id) && pid !== null) out.push({ id, pid })
  }
  return out
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
  /** T0860: writes the schema 2 record (holder kept); absent → not written. */
  writeHolderRecord?(record: InstallerQuitHolderRecord): boolean
  /**
   * T0860: what this process knows about the current Terminal Server — started from the PTY holder
   * (forkTerminalServer) or a hello that said so (`isKeptHolderHello`). false → the T0823 run, unchanged.
   */
  serverFromHolder?(): boolean
  /**
   * T0860: the Terminal Server runs from a valid PTY holder → its pid and the idle extension (one hello on
   * a fresh TCP connection, `queryKeptHolder`); null → the T0823 path. Absent = no holder support (T0823).
   */
  keptHolder?(): Promise<{ pid: number | null; extension: HolderIdleExtension } | null>
  /** T0860: the tabs' PTY roots (registry id + shell pid), for `endAgentProcesses`. */
  ptyRoots?(): readonly PtyRoot[]
  /** T0860: `endInstallDirAgentProcesses` with the install directory. */
  endAgentProcesses?(roots: readonly PtyRoot[]): Promise<InstallDirProcess[]>
  /** T0860: the normal quit without the confirmation dialog, keeping the Terminal Server (the holder). */
  quitKeepingServer?(): void
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
  /** T0860: an uninstall request wins over an upgrade one received before it ran. */
  private kind: InstallerQuitKind = 'upgrade'
  /** T0860: the promise of a holder-keeping run (tests await it). */
  private running: Promise<void> | null = null

  constructor(private readonly deps: InstallerQuitControllerDeps) {}

  /** `kind`: `uninstall` for `--uninstall-quit-request` (T0860); the installer's request is `upgrade`. */
  request(kind: InstallerQuitKind = 'upgrade'): void {
    if (this.handled) {
      this.deps.logger.log('[installer-quit] request received again — already quitting')
      return
    }
    if (kind === 'uninstall') this.kind = 'uninstall'
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

  /** T0860: resolves once a holder-keeping run finished (immediately otherwise). */
  whenDone(): Promise<void> {
    return this.running ?? Promise.resolve()
  }

  private run(): void {
    this.handled = true
    // T0860: a real uninstall stops the server (T0823 path); an upgrade looks for a kept holder first
    // 🔴 `serverFromHolder` false / absent (zip, dev, no holder, macOS / Linux) → the T0823 run, synchronously
    if (this.kind === 'upgrade' && this.deps.keptHolder && this.deps.quitKeepingServer && this.serverFromHolder()) {
      this.running = this.runKeepingHolder()
      return
    }
    if (this.kind === 'uninstall') this.deps.logger.log('[installer-quit] uninstall request — the Terminal Server stops too')
    this.runStopping()
  }

  /**
   * T0860: the Terminal Server runs from a valid PTY holder → keep it (24 h idle), end the tabs' processes
   * under the install directory (D3), record schema 2, quit keeping the server. No holder → `runStopping`.
   */
  private async runKeepingHolder(): Promise<void> {
    if (this.quittingAlready()) return
    let holder: { pid: number | null; extension: HolderIdleExtension } | null = null
    try {
      holder = await this.deps.keptHolder!()
    } catch {
      holder = null
    }
    if (!holder) {
      this.runStopping()
      return
    }
    try {
      let snapshot: InstallerQuitSnapshot = { ptys: [], claudeSessions: [] }
      try { snapshot = this.deps.collect() } catch { snapshot = { ptys: [], claudeSessions: [] } }
      let ended: InstallDirProcess[] = []
      try {
        const roots = this.deps.ptyRoots?.() ?? []
        ended = this.deps.endAgentProcesses ? await this.deps.endAgentProcesses(roots) : []
      } catch {
        ended = []
      }
      const endedTabs = new Set(ended.map(entry => entry.terminalId))
      const sessions = (Array.isArray(snapshot.claudeSessions) ? snapshot.claudeSessions : []).filter(raw => {
        const id = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).terminalId : undefined
        return typeof id === 'string' && endedTabs.has(id)
      })
      const record = buildHolderKeptQuitRecord({
        version: this.deps.version,
        source: 'running-app',
        holderPid: holder.pid,
        endedPtys: [],
        endedAgentProcesses: summarizeEndedAgents(ended),
        claudeSessions: sessions,
      })
      const written = this.deps.writeHolderRecord?.(record) ?? false
      const kept = Array.isArray(snapshot.ptys) ? snapshot.ptys.length : 0
      this.deps.logger.log(`[installer-quit] request received: Terminal Server runs from the PTY holder (idle ${holder.extension}) — keeping it with ${kept} terminal(s); ${written ? 'recorded' : 'could not record'} ${record.endedAgentProcesses.length} tab(s) with ended agent processes, ${record.claudeSessions.length} claude session(s) — quitting without confirmation`)
    } catch (error) {
      this.deps.logger.log(`[installer-quit] record failed: ${error instanceof Error ? error.message : String(error)} — quitting anyway`)
    }
    try {
      this.deps.quitKeepingServer!()
    } catch (error) {
      this.deps.logger.log(`[installer-quit] quit failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private serverFromHolder(): boolean {
    try { return this.deps.serverFromHolder?.() === true } catch { return false }
  }

  private quittingAlready(): boolean {
    let quitting = false
    try { quitting = this.deps.isQuitting() } catch { quitting = false }
    if (quitting) this.deps.logger.log('[installer-quit] request ignored: a quit is already in progress')
    return quitting
  }

  /** T0823's run: record what will end, quit stopping the Terminal Server. */
  private runStopping(): void {
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
  /** T0860: writes the schema 2 record (holder kept); absent → not written. */
  writeHolderRecord?(record: InstallerQuitHolderRecord): boolean
  /**
   * TCP `server:shutdown` (main.ts `sendShutdownToServer`); false when there is no port file.
   * T0857 (PLAN-065 W1): after a `server:hello` with the server's token (`bat-pty-server.token`) —
   * a v1 server refuses an unauthenticated request; a server before T0857 ignores the hello.
   */
  sendShutdown(): Promise<boolean>
  /** Resolves true once the server is gone (main.ts `waitForTerminalServerExit`). */
  waitForServerExit(timeoutMs: number): Promise<boolean>
  logger: InstallerQuitLogger
  /** T0860: `upgrade` (`--installer-quit-request`, default) or `uninstall` (`--uninstall-quit-request`). */
  kind?: InstallerQuitKind
  /**
   * T0860, upgrade only: the server is a kept PTY holder (`queryKeptHolder`: hello + 24 h idle) → its pid;
   * null → the T0823 path (record, shutdown). Absent = no holder support.
   */
  keptHolder?(): Promise<{ pid: number | null; extension: HolderIdleExtension } | null>
  /** T0860, holder kept: `endInstallDirAgentProcesses` over the registry's PTY roots. */
  endAgentProcesses?(roots: readonly PtyRoot[]): Promise<InstallDirProcess[]>
  /**
   * T0860, uninstall only: the server is still running after `server:shutdown` → end its PTY trees (T0540
   * order) and the server process itself, checked against the pid file. true = gone afterwards.
   */
  forceStopServer?(): Promise<boolean>
}

export type InstallerQuitWithoutAppResult = 'no-server' | 'server-stopped' | 'server-still-running' | 'no-port' | 'holder-kept' | 'server-force-stopped'

/**
 * The request process holds the lock: no BAT window process runs. When a kept Terminal Server runs,
 * record its PTYs and ask it to shut down (its own shutdown: T0540 tree-then-shell, pid / port /
 * registry files removed). Never opens a window; the caller exits afterwards. Never throws.
 * T0860: an upgrade whose server is a kept PTY holder (`keptHolder`) keeps it instead — 24 h idle, the tabs'
 * processes under the install directory ended and recorded (schema 2), no shutdown. A real uninstall
 * (`kind: 'uninstall'`) stops it as below and, if it is still running after the wait, `forceStopServer`.
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
    const kind: InstallerQuitKind = deps.kind === 'uninstall' ? 'uninstall' : 'upgrade'
    if (kind === 'upgrade' && deps.keptHolder) {
      let holder: { pid: number | null; extension: HolderIdleExtension } | null = null
      try { holder = await deps.keptHolder() } catch { holder = null }
      if (holder) return await keepHolderWithoutApp(deps, holder, ptys, sessions)
    }
    const record = buildInstallerQuitRecord({ version: deps.version, source: 'server-only', ptys, claudeSessions: sessions })
    const written = record.ptys.length > 0 ? deps.writeRecord(record) : false
    deps.logger.log(`[installer-quit] no running BAT; Terminal Server running with ${record.ptys.length} terminal(s)${record.ptys.length > 0 ? (written ? ' (recorded)' : ' (could not record)') : ''} — asking it to shut down`)
    const sent = await deps.sendShutdown()
    if (!sent) {
      deps.logger.log('[installer-quit] Terminal Server has no port file — left to the installer')
      return 'no-port'
    }
    const gone = await deps.waitForServerExit(INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS)
    if (!gone && kind === 'uninstall' && deps.forceStopServer) {
      // T0860: a real uninstall — the holder is outside the install directory, nothing else would end it
      let forced = false
      try { forced = await deps.forceStopServer() } catch { forced = false }
      deps.logger.log(forced
        ? `[installer-quit] Terminal Server still running after ${INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS} ms — ended (uninstall)`
        : `[installer-quit] Terminal Server still running after ${INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS} ms and could not be ended — left to the uninstaller`)
      return forced ? 'server-force-stopped' : 'server-still-running'
    }
    deps.logger.log(gone ? '[installer-quit] Terminal Server stopped (server:shutdown)' : `[installer-quit] Terminal Server still running after ${INSTALLER_QUIT_SERVER_EXIT_TIMEOUT_MS} ms — left to the installer`)
    return gone ? 'server-stopped' : 'server-still-running'
  } catch (error) {
    deps.logger.log(`[installer-quit] failed: ${error instanceof Error ? error.message : String(error)}`)
    return 'server-still-running'
  }
}

/** T0860: the request process's holder path — end the agents in the holder's tabs, record, keep the holder. */
async function keepHolderWithoutApp(
  deps: InstallerQuitWithoutAppDeps,
  holder: { pid: number | null; extension: HolderIdleExtension },
  ptys: readonly unknown[],
  sessions: readonly unknown[],
): Promise<InstallerQuitWithoutAppResult> {
  let ended: InstallDirProcess[] = []
  try {
    ended = deps.endAgentProcesses ? await deps.endAgentProcesses(ptyRootsOf(ptys)) : []
  } catch {
    ended = []
  }
  const endedTabs = new Set(ended.map(entry => entry.terminalId))
  const record = buildHolderKeptQuitRecord({
    version: deps.version,
    source: 'server-only',
    holderPid: holder.pid,
    endedPtys: [],
    endedAgentProcesses: summarizeEndedAgents(ended),
    claudeSessions: (Array.isArray(sessions) ? sessions : []).filter(raw => {
      const id = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).terminalId : undefined
      return typeof id === 'string' && endedTabs.has(id)
    }),
  })
  let written = false
  try { written = deps.writeHolderRecord?.(record) ?? false } catch { written = false }
  const kept = cleanPtys(Array.isArray(ptys) ? ptys : []).length
  deps.logger.log(`[installer-quit] no running BAT; Terminal Server runs from the PTY holder (idle ${holder.extension}) — keeping it with ${kept} terminal(s); ${written ? 'recorded' : 'could not record'} ${record.endedAgentProcesses.length} tab(s) with ended agent processes`)
  return 'holder-kept'
}
