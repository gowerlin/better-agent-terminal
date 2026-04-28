/**
 * Control Tower Drift Telemetry (PLAN-034 Sprint 5 / T0346, relocated by T0348)
 *
 * Lightweight logger that records parser drift / unknown-status warnings to
 * a per-user log file so we can later audit how often frontmatter and body
 * disagree. **Logger only** — no UI, no aggregation dashboards (those are
 * Sprint 6 polish).
 *
 * Lives in `electron/` (not `src/utils/`) because it imports `node:fs/path/os`
 * — those are forbidden in the renderer bundle (D090 / BUG-069 / BUG-078).
 * Renderer access goes through the `ctDrift:log` / `ctDrift:readRecent` IPC
 * channels exposed in preload.ts.
 *
 * Log location:
 *   - Electron:    <userDataDir>/ct-drift.log    (when `userDataDir` provided)
 *   - Fallback:    ~/.bat-cache/ct-drift.log
 *
 * Format (one line per warning):
 *   <ISO timestamp> | <file> | <warning_kind> | <field> | <fm_value> | <body_value>
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

import type { ParseWarning } from '../src/utils/ct-frontmatter'

export interface DriftEntry {
  timestamp: string
  file: string
  kind: string
  field: string
  fmValue: string
  bodyValue: string
}

export interface LogDriftOptions {
  /** override log file path (mainly for tests) */
  logFile?: string
  /** override clock (tests) */
  now?: () => Date
  /** Electron `app.getPath('userData')` — preferred over `~/.bat-cache/` when present */
  userDataDir?: string
}

/** Default log file path. Prefers `<userDataDir>/ct-drift.log` if provided. */
export function defaultDriftLogPath(userDataDir?: string): string {
  if (userDataDir) return join(userDataDir, 'ct-drift.log')
  return join(homedir(), '.bat-cache', 'ct-drift.log')
}

/** Sanitize a field for the pipe-delimited line format. */
function sanitize(v: unknown): string {
  if (v == null) return ''
  return String(v).replace(/[\r\n|]/g, ' ').trim()
}

/**
 * Append one line per warning to the drift log. Skips silently if the file
 * cannot be written (e.g. read-only FS) — telemetry must never break the app.
 */
export function logDrift(
  file: string,
  warnings: ParseWarning[] | undefined,
  options: LogDriftOptions = {},
): number {
  if (!warnings || warnings.length === 0) return 0

  const logFile = options.logFile ?? defaultDriftLogPath(options.userDataDir)
  const now = options.now ?? (() => new Date())

  try {
    const dir = dirname(logFile)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const ts = now().toISOString()
    const lines = warnings.map((w) => {
      const cells = [
        ts,
        sanitize(file),
        sanitize(w.kind),
        sanitize(w.field),
        sanitize(w.frontmatter_value),
        sanitize(w.body_value),
      ]
      return cells.join(' | ')
    })

    appendFileSync(logFile, lines.join('\n') + '\n', 'utf8')
    return warnings.length
  } catch {
    // Drift telemetry must never break the caller; swallow IO errors.
    return 0
  }
}

/** Parse a single log line back into a DriftEntry. */
function parseLine(line: string): DriftEntry | null {
  const parts = line.split(' | ')
  if (parts.length < 6) return null
  const [timestamp, file, kind, field, fmValue, bodyValue] = parts
  if (!timestamp || !file || !kind) return null
  return { timestamp, file, kind, field, fmValue, bodyValue }
}

export interface ReadRecentOptions {
  /** lookback window in days (default 7) */
  days?: number
  /** override log file path */
  logFile?: string
  /** override clock (tests) */
  now?: () => Date
  /** Electron `app.getPath('userData')` — preferred over `~/.bat-cache/` when present */
  userDataDir?: string
}

/**
 * Read the last `days` worth of drift entries. Returns [] when the log is
 * absent or unreadable — drift telemetry must never throw upwards.
 */
export function readRecentDrift(options: ReadRecentOptions = {}): DriftEntry[] {
  const logFile = options.logFile ?? defaultDriftLogPath(options.userDataDir)
  const days = options.days ?? 7
  const now = options.now ?? (() => new Date())

  try {
    if (!existsSync(logFile)) return []
    const cutoff = now().getTime() - days * 24 * 60 * 60 * 1000
    return readFileSync(logFile, 'utf8')
      .split('\n')
      .map(parseLine)
      .filter((e): e is DriftEntry => {
        if (!e) return false
        const t = Date.parse(e.timestamp)
        return Number.isFinite(t) && t >= cutoff
      })
  } catch {
    return []
  }
}
