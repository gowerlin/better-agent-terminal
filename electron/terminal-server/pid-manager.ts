import * as fs from 'fs'
import * as path from 'path'

const PID_FILENAME = 'bat-pty-server.pid'

function getPidFilePath(userDataPath: string): string {
  return path.join(userDataPath, PID_FILENAME)
}

export function writePidFile(pid: number, userDataPath: string): void {
  const pidPath = getPidFilePath(userDataPath)
  fs.writeFileSync(pidPath, String(pid), 'utf8')
}

export function readPidFile(userDataPath: string): number | null {
  const pidPath = getPidFilePath(userDataPath)
  try {
    const content = fs.readFileSync(pidPath, 'utf8').trim()
    const pid = parseInt(content, 10)
    return isNaN(pid) ? null : pid
  } catch {
    return null
  }
}

export function removePidFile(userDataPath: string): void {
  const pidPath = getPidFilePath(userDataPath)
  try {
    fs.unlinkSync(pidPath)
  } catch {
    // File may not exist — ignore
  }
}

/**
 * Returns true if a terminal server process is actively running.
 * Reads the PID file and sends signal 0 to check process existence
 * without actually delivering any signal.
 */
export function isServerRunning(userDataPath: string): boolean {
  const pid = readPidFile(userDataPath)
  if (pid === null) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    // ESRCH: process does not exist; EPERM: exists but no permission (treat as running)
    return false
  }
}

// ── Port file (TCP reconnect — T0108) ────────────────────────────────────────

const PORT_FILENAME = 'bat-pty-server.port'

function getPortFilePath(userDataPath: string): string {
  return path.join(userDataPath, PORT_FILENAME)
}

export function writePortFile(port: number, userDataPath: string): void {
  const portPath = getPortFilePath(userDataPath)
  fs.writeFileSync(portPath, String(port), 'utf8')
}

export function readPortFile(userDataPath: string): number | null {
  const portPath = getPortFilePath(userDataPath)
  try {
    const content = fs.readFileSync(portPath, 'utf8').trim()
    const port = parseInt(content, 10)
    return isNaN(port) ? null : port
  } catch {
    return null
  }
}

export function removePortFile(userDataPath: string): void {
  const portPath = getPortFilePath(userDataPath)
  try {
    fs.unlinkSync(portPath)
  } catch {
    // File may not exist — ignore
  }
}

// ── Token file (TCP authentication — PLAN-065 W1 / T0857, D8) ───────────────
// File I/O only (fs / path: this module is on the app-paths-bootstrap import chain, T0480).
//
// The server makes a new token every time it starts (server.ts `generateServerToken`) and writes it
// here before it listens, so a client that finds the port file also finds the token. The file
// lives as long as that server: shutdown removes it, the next server overwrites it (rotation =
// server restart). POSIX: 0600 (written to a 0600 temp file, then renamed over the old one, so
// it is never readable by others, not even for a moment). Windows: the ACL of the user's
// userData folder (%APPDATA%), as for server-token.json. 🔴 The value is never logged, never
// put in an env (server or PTY) and never on a command line.

const TOKEN_FILENAME = 'bat-pty-server.token'

export function getTokenFilePath(userDataPath: string): string {
  return path.join(userDataPath, TOKEN_FILENAME)
}

export function writeTokenFile(token: string, userDataPath: string): void {
  const tokenPath = getTokenFilePath(userDataPath)
  const tmpPath = `${tokenPath}.${process.pid}.tmp`
  fs.writeFileSync(tmpPath, token, { encoding: 'utf8', mode: 0o600 })
  try {
    // mode applies only when the file is created; a leftover temp file keeps its own mode
    if (process.platform !== 'win32') fs.chmodSync(tmpPath, 0o600)
    fs.renameSync(tmpPath, tokenPath)
  } catch (e) {
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    throw e
  }
}

/** The token, or null when there is no token file (a server before T0857) or it is empty. */
export function readTokenFile(userDataPath: string): string | null {
  try {
    const content = fs.readFileSync(getTokenFilePath(userDataPath), 'utf8').trim()
    return content ? content : null
  } catch {
    return null
  }
}

export function removeTokenFile(userDataPath: string): void {
  try {
    fs.unlinkSync(getTokenFilePath(userDataPath))
  } catch {
    // File may not exist — ignore
  }
}
