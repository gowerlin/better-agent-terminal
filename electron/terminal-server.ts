/**
 * Terminal Server entry point — runs as an independent Node.js process
 * forked by electron/main.ts via child_process.fork().
 *
 * Responsibilities:
 *   - Write PID file on startup (path passed via BAT_USER_DATA env var)
 *   - Dispatch IPC messages from parent to TerminalServer
 *   - Begin idle-timeout countdown when parent disconnects
 *   - Clean up PID file on SIGTERM / shutdown
 */
import * as fs from 'fs'
import * as path from 'path'
import { TerminalServer } from './terminal-server/server'
import { PTY_HOLDER_MANIFEST_FILE } from './pty-holder'
import { writePidFile, removePidFile, removePortFile, removeTokenFile } from './terminal-server/pid-manager'
import type { ServerRequest } from './terminal-server/protocol'

const userDataPath = process.env.BAT_USER_DATA ?? ''

// Write PID file so the parent can detect a running server on restart
if (userDataPath) {
  try {
    writePidFile(process.pid, userDataPath)
  } catch {
    process.stderr.write('[terminal-server] failed to write PID file\n')
  }
}

// Config from env vars (set by main.ts from settings.json — T0109)
const scrollBufferLines = process.env.BAT_SCROLL_BUFFER_LINES
  ? parseInt(process.env.BAT_SCROLL_BUFFER_LINES, 10)
  : undefined
const idleTimeoutMs = process.env.BAT_IDLE_TIMEOUT_MS
  ? parseInt(process.env.BAT_IDLE_TIMEOUT_MS, 10)
  : undefined
// T0857: reported in `server:hello-ok` (left out of every PTY's env, TERMINAL_SERVER_OWN_ENV_KEYS)
const batVersion = process.env.BAT_TERMINAL_SERVER_BAT_VERSION ?? ''
// T0859 (PLAN-065 W3): started from a PTY holder (plain Node, this file next to the holder manifest) →
// hello-ok also says which holder directory holds the PTYs; no env involved, so nothing reaches a PTY
const holderDir = runningFromPtyHolder() ? __dirname : undefined
const server = new TerminalServer(idleTimeoutMs, scrollBufferLines, { identity: { batVersion, ...(holderDir ? { holderDir } : {}) } })

function runningFromPtyHolder(): boolean {
  if (process.versions.electron) return false
  try {
    return fs.existsSync(path.join(__dirname, PTY_HOLDER_MANIFEST_FILE))
  } catch {
    return false
  }
}

// Start TCP server for reconnection after BAT restart (T0108)
if (userDataPath) {
  server.startTcpServer(userDataPath)
}

// Route IPC messages from the parent (BAT main process) to the server
process.on('message', (msg: ServerRequest) => {
  server.handleMessage(msg, 'ipc')
})

// Parent process disconnected — begin idle-timeout countdown
process.on('disconnect', () => {
  server.startIdleTimer()
})

// Graceful shutdown on SIGTERM
process.on('SIGTERM', () => {
  if (userDataPath) {
    try { removePidFile(userDataPath) } catch { /* ignore */ }
    try { removePortFile(userDataPath) } catch { /* ignore */ }
    try { removeTokenFile(userDataPath) } catch { /* ignore */ }
  }
  server.shutdown()
})

// Log but don't crash on unexpected errors
process.on('uncaughtException', (err) => {
  process.stderr.write(`[terminal-server] uncaughtException: ${err}\n`)
})

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[terminal-server] unhandledRejection: ${reason}\n`)
})
