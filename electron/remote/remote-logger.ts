// electron/remote/remote-logger.ts
// Append-only NDJSON diagnostic mirror for RemoteServer terminal IPC handlers (T0193).
//
// Purpose:
//   Mirror Electron-side terminal family IPC events (create-with-command, notify,
//   ...) into the same `bat-scripts.log` file that scripts/_bat-logger.mjs writes
//   to. This gives a unified timeline across BAT helper scripts (bat-terminal,
//   bat-notify) and the Electron RemoteServer that processes their requests.
//
// Companion to scripts/_bat-logger.mjs (T0192) — events from this module carry
// `script: 'remote-server'` to distinguish them from the script-side entries.
//
// Log location:
//   <userData>/Logs/bat-scripts.log
//   (userData resolved via logger.getLogsDir(); same dir that T0192 targets on
//   the script side via its APPDATA/HOME-based resolve.)
//
// Failure policy (per T0193 § 禁止事項):
//   - NEVER throw from log call sites (try/catch swallows everything).
//   - One-time warn via main-process logger when directory/file is unwritable.
//   - Never block IPC business logic — this is diagnostic-only.
//
// Env whitelist:
//   Deliberately excludes BAT_REMOTE_TOKEN (matches T0192 policy).
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../logger'

const MIRROR_FILENAME = 'bat-scripts.log'
const SCRIPT_TAG = 'remote-server'

// BAT_* / CT_* env keys safe to mirror. Keep alphabetical, keep in sync with
// scripts/_bat-logger.mjs ENV_WHITELIST.
const ENV_WHITELIST = [
  'BAT_REMOTE_PORT',
  'BAT_RUNTIME',
  'BAT_SESSION',
  'BAT_TERMINAL_ID',
  'BAT_TOWER_TERMINAL_ID',
  'BAT_WORKSPACE_ID',
  'CT_INTERACTIVE',
  'CT_MODE',
]

let warnedOnce = false

function warnOnce(reason: string): void {
  if (warnedOnce) return
  warnedOnce = true
  try {
    logger.warn(`[remote-logger] diagnostic mirror disabled: ${reason}`)
  } catch {
    /* logger unavailable — stay silent */
  }
}

function resolveMirrorPath(): string | null {
  const dir = logger.getLogsDir()
  if (!dir) return null
  return path.join(dir, MIRROR_FILENAME)
}

export interface MirrorEventData {
  [key: string]: unknown
}

/**
 * Pick only whitelisted BAT_ / CT_ keys from a customEnv record. Safe to pass
 * raw opts.customEnv; BAT_REMOTE_TOKEN is silently dropped.
 */
export function pickWhitelistedEnv(env: Record<string, string> | undefined): Record<string, string> {
  if (!env) return {}
  const picked: Record<string, string> = {}
  for (const key of ENV_WHITELIST) {
    if (env[key] !== undefined) picked[key] = env[key]
  }
  return picked
}

/**
 * Append a diagnostic event to the shared NDJSON mirror log. Tagged with
 * `script: 'remote-server'` so it can be filtered out of script-side entries.
 *
 * Never throws — all errors are swallowed and reported via warnOnce().
 */
export function mirrorToBatScripts(event: string, data: MirrorEventData = {}): void {
  try {
    const filePath = resolveMirrorPath()
    if (!filePath) {
      warnOnce('cannot resolve logs directory (logger not initialised?)')
      return
    }

    const dir = path.dirname(filePath)
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (err) {
      warnOnce(`mkdir ${dir} failed: ${(err as Error).message}`)
      return
    }

    const record = {
      ts: new Date().toISOString(),
      script: SCRIPT_TAG,
      event,
      pid: process.pid,
      ...data,
    }

    let line: string
    try {
      line = JSON.stringify(record) + '\n'
    } catch (err) {
      line = JSON.stringify({
        ts: record.ts,
        script: SCRIPT_TAG,
        event: 'log-error',
        pid: record.pid,
        originalEvent: event,
        reason: (err as Error).message,
      }) + '\n'
    }

    try {
      fs.appendFileSync(filePath, line, { encoding: 'utf-8' })
    } catch (err) {
      warnOnce(`append ${filePath} failed: ${(err as Error).message}`)
    }
  } catch (err) {
    // Outer guard — logging must never break callers.
    warnOnce(`unexpected: ${(err as Error).message}`)
  }
}
