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
