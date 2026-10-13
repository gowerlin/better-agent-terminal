// scripts/_bat-logger.mjs
// Append-only NDJSON diagnostic logger for BAT helper scripts (T0192).
//
// Purpose:
//   Record every invocation of bat-terminal.mjs / bat-notify.mjs with their
//   full argv, BAT_* env, and parse/send results. Used to diagnose BUG-043
//   (yolo banner / notify-id propagation chain failures) when they recur.
//
// Log location, first match wins (relative env values are ignored):
//   1. Override (T0433): $BAT_HELPER_LOG_DIR/bat-scripts.log. A headless bat-server
//      sets it to <dataDir>/Logs for its PTYs — the remote machine has no Electron
//      userData dir.
//   2. T0481 (BUG-119): $BAT_USER_DATA/Logs/bat-scripts.log. Local BAT injects
//      app.getPath('userData') into every PTY (electron/pty-manager.ts), so this is
//      exact for any instance, including one started with --runtime=N (its PTYs
//      carry no BAT_RUNTIME).
//   3. Legacy guess (BAT before T0481, or a helper run outside a BAT terminal),
//      mirroring Electron's app.getPath('userData') + '/Logs':
//      Windows: %APPDATA%/BetterAgentTerminal[-runtime-<N>]/Logs/bat-scripts.log
//      macOS:   $HOME/Library/Application Support/BetterAgentTerminal[-runtime-<N>]/Logs/bat-scripts.log
//      Linux:   ${XDG_CONFIG_HOME:-$HOME/.config}/BetterAgentTerminal[-runtime-<N>]/Logs/bat-scripts.log
//
// Format: newline-delimited JSON, one event per line.
//
// Failure policy (per workorder § 禁止事項):
//   - NEVER throw from log call sites (try/catch swallows everything).
//   - One-time stderr warning when directory/file is unwritable, then silent.
//   - Never break business logic — this is diagnostic-only.

import { appendFileSync, mkdirSync } from 'fs'
import { isAbsolute, join } from 'path'
import { homedir } from 'os'

// Electron app name matches electron/main.ts → app.setName('BetterAgentTerminal')
const APP_NAME = 'BetterAgentTerminal'

// BAT_* env whitelist (avoid leaking PATH/secrets). Keep alphabetical.
const ENV_WHITELIST = [
  'BAT_REMOTE_PORT',
  'BAT_RUNTIME',
  'BAT_SESSION',
  'BAT_TERMINAL_ID',
  'BAT_TOWER_TERMINAL_ID',
  'BAT_USER_DATA',
  'BAT_WORKSPACE_ID',
  'CT_INTERACTIVE',
  'CT_MODE',
]
// Note: BAT_REMOTE_TOKEN deliberately excluded — not needed for diagnosis,
// and even in a local-only log we avoid normalising the habit of logging auth.

let warnedOnce = false

// Resolve the userData directory of this BAT instance: the injected $BAT_USER_DATA
// (T0481) when absolute, else the legacy guess from APP_NAME + BAT_RUNTIME (mirrors
// electron/main.ts handling of BAT_RUNTIME / --runtime=N). Same order as _bat-cert.mjs.
function resolveUserDataDir() {
  const injected = process.env.BAT_USER_DATA
  if (injected && isAbsolute(injected)) return injected

  const runtimeId = process.env.BAT_RUNTIME
  const suffix = runtimeId ? `-runtime-${runtimeId}` : ''
  const dirName = `${APP_NAME}${suffix}`

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA
    if (!appData) return null
    return join(appData, dirName)
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', dirName)
  }
  // Linux / other POSIX: Electron uses $XDG_CONFIG_HOME or ~/.config.
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdgConfig, dirName)
}

function resolveLogPath() {
  // T0433: headless bat-server PTYs point the log at the server's data dir.
  // Relative values are ignored so the log never lands in whatever cwd the
  // helper runs from.
  const overrideDir = process.env.BAT_HELPER_LOG_DIR
  if (overrideDir && isAbsolute(overrideDir)) {
    return {
      dir: overrideDir,
      file: join(overrideDir, 'bat-scripts.log'),
    }
  }
  const userData = resolveUserDataDir()
  if (!userData) return null
  // Electron's logger writes to <userData>/Logs (electron/logger.ts, LOGS_DIR_NAME =
  // 'Logs'). We co-locate our diagnostic log there.
  return {
    dir: join(userData, 'Logs'),
    file: join(userData, 'Logs', 'bat-scripts.log'),
  }
}

function pickEnv(env) {
  const picked = {}
  for (const key of ENV_WHITELIST) {
    if (env[key] !== undefined) picked[key] = env[key]
  }
  return picked
}

function warnOnce(reason) {
  if (warnedOnce) return
  warnedOnce = true
  try {
    process.stderr.write(`[bat-logger] diagnostic log disabled: ${reason}\n`)
  } catch {
    // stderr unavailable → nothing we can do, stay silent.
  }
}

/**
 * Append a diagnostic event to the shared NDJSON log.
 *
 * @param {string} script  'bat-terminal' | 'bat-notify' (free-form, recorded verbatim)
 * @param {string} event   Event kind ('invoke' | 'parsed' | 'send' | 'exit' | ...)
 * @param {object} data    Arbitrary JSON-serialisable fields (avoid secrets).
 */
export function logEvent(script, event, data = {}) {
  try {
    const paths = resolveLogPath()
    if (!paths) {
      warnOnce('cannot resolve userData directory (APPDATA/HOME missing)')
      return
    }

    try {
      mkdirSync(paths.dir, { recursive: true })
    } catch (err) {
      warnOnce(`mkdir ${paths.dir} failed: ${err.message}`)
      return
    }

    const record = {
      ts: new Date().toISOString(),
      script,
      event,
      pid: process.pid,
      ...data,
    }

    let line
    try {
      line = JSON.stringify(record) + '\n'
    } catch (err) {
      // Circular ref or BigInt etc. — fall back to a minimal record.
      line = JSON.stringify({
        ts: record.ts,
        script,
        event: 'log-error',
        pid: record.pid,
        originalEvent: event,
        reason: err.message,
      }) + '\n'
    }

    try {
      appendFileSync(paths.file, line, { encoding: 'utf-8' })
    } catch (err) {
      warnOnce(`append ${paths.file} failed: ${err.message}`)
    }
  } catch (err) {
    // Defensive outer catch — logging must never break the caller.
    warnOnce(`unexpected: ${err.message}`)
  }
}

/**
 * Snapshot the BAT_* env whitelist. Exposed so callers can attach it to any
 * event they wish (typically only the first `invoke` event per invocation).
 */
export function snapshotBatEnv() {
  return pickEnv(process.env)
}

/**
 * Path helpers for debugging / tests. Returns null on unresolvable platforms.
 */
export function getLogPaths() {
  return resolveLogPath()
}
