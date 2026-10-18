/**
 * PLAN-050 / T0641 (D167): the session name each claude-cli tab was actually launched with (or
 * why it got none), by terminal id — kept apart from the PTY like `blockedDetection` (the launch
 * decision is made before the PTY exists). Written by the launch decision
 * (`createBatMcpLaunchArgs`, electron/bat-mcp-launch.ts); read by the query handlers (T0642:
 * `claudeSessionName` of `terminal:whoami` / `list` / `get-state`, electron/terminal-query-handlers.ts).
 *
 * A relaunch of the same id (⏻ restart, a restored tab) overwrites its record. Bounded: the oldest
 * records go once `CLAUDE_SESSION_NAME_RECORD_LIMIT` ids are held (no exit hook in this unit).
 *
 * T0642 (C-8): `ClaudeSessionPersistence` — Electron keeps the name and the claude session id
 * (`PtyManager.getClaudeSessionId`) of its running PTYs in `<userData>/claude-sessions.json` and,
 * when BAT reopens and the Terminal Server kept a PTY, puts both back (the T0576 pattern of
 * `helper-capabilities.json`: load as pending, settle on the Terminal Server's PTY list). No token
 * is ever in it. Headless does not persist (its records die with bat-server).
 *
 * 🔴 No `electron` import (headless keeps one too). One store per process: `claudeSessionNameRecords`.
 */
import * as fs from 'fs'
import * as path from 'path'
import { CLAUDE_SESSION_ID_PATTERN } from './terminal-blocked-state'

/**
 * Why a launch got no `--name` (T0640 contract C-3):
 *   - `not-claude-cli`: codex / gemini / a custom CLI (raw command mode and the Claude Agent SDK
 *     panel never reach the launch decision)
 *   - `no-name`: the caller sent no name (a renderer / host older than T0641, or a worker without a
 *     valid work order id)
 *   - `user-args`: the custom args set the name themselves (`--name` / `-n` / a short-flag group
 *     holding `n`); claude takes theirs
 *   - `claude-too-old` / `version-unknown`: the system runtime's claude is `< 2.1.76` / its version
 *     could not be read (electron/claude-version-check.ts)
 */
export type ClaudeSessionNameReason = 'not-claude-cli' | 'no-name' | 'user-args' | 'claude-too-old' | 'version-unknown'

export interface ClaudeSessionNameRecord {
  /** The name injected, or null. */
  name: string | null
  /** Why `name` is null. */
  reason?: ClaudeSessionNameReason
  /** When the launch was decided (ms). */
  at: number
}

export const CLAUDE_SESSION_NAME_RECORD_LIMIT = 512

export class ClaudeSessionNameRecords {
  private readonly records = new Map<string, ClaudeSessionNameRecord>()

  constructor(private readonly limit = CLAUDE_SESSION_NAME_RECORD_LIMIT) {}

  set(terminalId: string, record: ClaudeSessionNameRecord): void {
    this.records.delete(terminalId)
    this.records.set(terminalId, record)
    while (this.records.size > this.limit) {
      const oldest = this.records.keys().next().value
      if (oldest === undefined) break
      this.records.delete(oldest)
    }
  }

  get(terminalId: string): ClaudeSessionNameRecord | undefined {
    return this.records.get(terminalId)
  }

  delete(terminalId: string): void {
    this.records.delete(terminalId)
  }

  get size(): number {
    return this.records.size
  }
}

/** This process's store (Electron main / headless bat-server). */
export const claudeSessionNameRecords = new ClaudeSessionNameRecords()

// ── T0642 (C-8): persistence (Electron only) ──

/** T0642: the file Electron keeps its claude session names / ids in, under userData. */
export const CLAUDE_SESSION_STORE_FILE = 'claude-sessions.json'
/** T0642: store format version (`{ version, sessions: PersistedClaudeSession[] }`). */
export const CLAUDE_SESSION_STORE_VERSION = 1
/** A stored name longer than this is not restored (`claudeSessionName` is at most 200 characters). */
const STORED_NAME_MAX = 512
const STORED_TERMINAL_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

/** One running PTY's claude session as stored (at least one of `name` / `sessionId` is set). */
export interface PersistedClaudeSession {
  terminalId: string
  name: string | null
  sessionId: string | null
}

export type ClaudeSessionStoreRead =
  | { status: 'missing'; sessions: [] }
  | { status: 'ok'; sessions: PersistedClaudeSession[]; skipped: number }
  | { status: 'corrupt'; sessions: []; error: string }

function validSession(raw: unknown): PersistedClaudeSession | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { terminalId, name, sessionId } = raw as Record<string, unknown>
  if (typeof terminalId !== 'string' || !STORED_TERMINAL_ID_PATTERN.test(terminalId)) return null
  const okName = name === null || (typeof name === 'string' && name.length > 0 && name.length <= STORED_NAME_MAX)
  const okSession = sessionId === null || (typeof sessionId === 'string' && CLAUDE_SESSION_ID_PATTERN.test(sessionId))
  if (!okName || !okSession || (name === null && sessionId === null)) return null
  return { terminalId, name: name as string | null, sessionId: sessionId as string | null }
}

/**
 * T0642: reads the store. A missing file is `missing`; unreadable JSON, another version or no
 * `sessions` array is `corrupt`; invalid entries are skipped (counted).
 */
export function readClaudeSessionStore(filePath: string): ClaudeSessionStoreRead {
  let text: string
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { status: 'missing', sessions: [] }
    return { status: 'corrupt', sessions: [], error: error instanceof Error ? error.message : String(error) }
  }
  try {
    const parsed = JSON.parse(text) as { version?: unknown; sessions?: unknown }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CLAUDE_SESSION_STORE_VERSION || !Array.isArray(parsed.sessions)) {
      return { status: 'corrupt', sessions: [], error: 'unexpected format' }
    }
    const sessions: PersistedClaudeSession[] = []
    for (const raw of parsed.sessions as unknown[]) {
      const session = validSession(raw)
      if (session) sessions.push(session)
    }
    return { status: 'ok', sessions, skipped: parsed.sessions.length - sessions.length }
  } catch (error) {
    return { status: 'corrupt', sessions: [], error: error instanceof Error ? error.message : String(error) }
  }
}

/** T0642: writes the store atomically (temp file + rename, as `writeHelperCapabilityStore`). Throws on failure. */
export function writeClaudeSessionStore(filePath: string, sessions: readonly PersistedClaudeSession[]): void {
  const body = JSON.stringify({ version: CLAUDE_SESSION_STORE_VERSION, sessions }, null, 2) + '\n'
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`)
  fs.writeFileSync(tmp, body, { encoding: 'utf8', mode: 0o600 })
  try {
    fs.renameSync(tmp, filePath)
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }) } catch { /* best-effort */ }
    throw error
  }
}

/** What `ClaudeSessionPersistence` reads from / puts back into PtyManager (the class satisfies it). */
export interface ClaudeSessionPtySource {
  listTerminalIds(): string[]
  getClaudeSessionId(id: string): string | null
  restoreClaudeSessionId(id: string, sessionId: string): boolean
}

export interface ClaudeSessionPersistenceOptions {
  records: ClaudeSessionNameRecords
  /** null until the PtyManager exists. */
  getPtyManager(): ClaudeSessionPtySource | null
  log: { log(message: string): void; warn(message: string): void }
  /** Tests. Default `Date.now`. */
  now?(): number
}

/**
 * T0642 (C-8): Electron's claude session store. `load` (whenReady, before the Terminal Server
 * reconnects) reads the previous process's entries as pending; `settle` (the Terminal Server's PTY
 * list, or no surviving Terminal Server) puts back those whose PTY still runs — the name into
 * `records` unless the launch decision recorded one since, the session id unless a `SessionStart`
 * reported one since — and drops the rest; `persist` (a launch decision, a session id change, a PTY
 * exit, the Terminal Server recovery) writes the running PTYs' entries plus the still-pending ones.
 * Nothing is written before `load`, nor when the content did not change. Never throws.
 * Logs `[claude-session] …` with a session id's first 8 characters only.
 */
export class ClaudeSessionPersistence {
  private filePath: string | null = null
  private pending = new Map<string, PersistedClaudeSession>()
  private lastWritten: string | null = null

  constructor(private readonly opts: ClaudeSessionPersistenceOptions) {}

  load(filePath: string): ClaudeSessionStoreRead['status'] {
    if (this.filePath) return 'ok'
    const name = path.basename(filePath)
    const stored = readClaudeSessionStore(filePath)
    if (stored.status === 'corrupt') {
      this.opts.log.warn(`[claude-session] ${name} unreadable (${stored.error}) — nothing restored`)
    } else if (stored.status === 'ok') {
      for (const session of stored.sessions) this.pending.set(session.terminalId, session)
      if (stored.sessions.length > 0 || stored.skipped > 0) {
        this.opts.log.log(`[claude-session] loaded ${stored.sessions.length} entr${stored.sessions.length === 1 ? 'y' : 'ies'} from ${name}${stored.skipped > 0 ? ` (${stored.skipped} invalid skipped)` : ''} — pending the Terminal Server's PTY list`)
      }
    }
    this.filePath = filePath
    // a damaged store / skipped entries are rewritten from what is valid
    if (stored.status === 'corrupt' || (stored.status === 'ok' && stored.skipped > 0)) this.persist()
    else this.lastWritten = stored.status === 'ok' ? this.body() : '[]' // a missing file is written once there is something
    return stored.status
  }

  hasPending(): boolean {
    return this.pending.size > 0
  }

  settle(isAlive: (terminalId: string) => boolean, reason: string): void {
    if (this.pending.size === 0) return
    const pm = this.opts.getPtyManager()
    const now = this.opts.now ?? (() => Date.now())
    for (const session of this.pending.values()) {
      const id = session.terminalId
      if (!isAlive(id)) {
        this.opts.log.log(`[claude-session] dropped restored: terminal=${id} (${reason})`)
        continue
      }
      const restored: string[] = []
      if (session.name !== null && !this.opts.records.get(id)) {
        this.opts.records.set(id, { name: session.name, at: now() })
        restored.push('name')
      }
      if (session.sessionId !== null && pm?.restoreClaudeSessionId(id, session.sessionId)) {
        restored.push(`session=${session.sessionId.slice(0, 8)}`)
      }
      this.opts.log.log(`[claude-session] kept restored: terminal=${id}${restored.length ? ` ${restored.join(' ')}` : ' (newer values kept)'} (${reason})`)
    }
    this.pending.clear()
    this.persist()
  }

  /** The entries to store: running PTYs (their current values win), then the pending ones. */
  entries(): PersistedClaudeSession[] {
    const out = new Map<string, PersistedClaudeSession>()
    const pm = this.opts.getPtyManager()
    for (const id of pm?.listTerminalIds() ?? []) {
      const name = this.opts.records.get(id)?.name ?? null
      const sessionId = pm?.getClaudeSessionId(id) ?? null
      if (name !== null || sessionId !== null) out.set(id, { terminalId: id, name, sessionId })
    }
    for (const session of this.pending.values()) {
      if (!out.has(session.terminalId)) out.set(session.terminalId, { ...session })
    }
    return [...out.values()]
  }

  private body(): string {
    return JSON.stringify(this.entries())
  }

  persist(): void {
    if (!this.filePath) return
    try {
      const entries = this.entries()
      const body = JSON.stringify(entries)
      if (body === this.lastWritten) return
      writeClaudeSessionStore(this.filePath, entries)
      this.lastWritten = body
    } catch (error) {
      this.opts.log.warn(`[claude-session] could not write ${path.basename(this.filePath)}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
