import * as net from 'net'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface PortTestResult {
  available: boolean
  reason?: 'in-use' | 'invalid' | 'permission-denied' | 'unknown'
  processName?: string
  pid?: number
  detail?: string
}

export const PORT_MIN = 1024
export const PORT_MAX = 65535

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= PORT_MIN && port <= PORT_MAX
}

/**
 * Probe whether a TCP port is available for binding on loopback.
 * Uses net.createServer().listen(port, '127.0.0.1') — returns true iff bind
 * succeeds. Closes the probe server immediately so caller can bind themselves.
 */
async function probeBind(port: number): Promise<{ ok: true } | { ok: false; code?: string }> {
  return await new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', (err: NodeJS.ErrnoException) => {
      resolve({ ok: false, code: err.code })
    })
    server.once('listening', () => {
      server.close(() => resolve({ ok: true }))
    })
    try {
      server.listen(port, '127.0.0.1')
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      resolve({ ok: false, code })
    }
  })
}

async function lookupWindowsProcess(port: number): Promise<{ pid?: number; processName?: string }> {
  try {
    const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'TCP'], {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 4 * 1024 * 1024,
    })
    const portMarker = `:${port}`
    let pid: number | undefined
    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('TCP')) continue
      // Match LISTENING rows only — avoid ESTABLISHED/TIME_WAIT noise.
      if (!/\bLISTENING\b/i.test(trimmed)) continue
      // Local address is 2nd column; split on whitespace and look for :<port>
      const cols = trimmed.split(/\s+/)
      if (cols.length < 5) continue
      const local = cols[1]
      if (!local.endsWith(portMarker)) continue
      const pidNum = Number(cols[cols.length - 1])
      if (Number.isFinite(pidNum) && pidNum > 0) {
        pid = pidNum
        break
      }
    }
    if (pid === undefined) return {}
    try {
      const { stdout: taskOut } = await execFileAsync(
        'tasklist',
        ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
        { windowsHide: true, timeout: 5000 }
      )
      const firstLine = taskOut.split(/\r?\n/).find((l) => l.trim().length > 0)
      if (firstLine) {
        const cols = firstLine.split('","').map((s) => s.replace(/^"|"$/g, ''))
        const imageName = cols[0]
        if (imageName && imageName !== 'INFO:') {
          return { pid, processName: imageName }
        }
      }
    } catch {
      /* tasklist failed — return pid only */
    }
    return { pid }
  } catch {
    return {}
  }
}

async function lookupUnixProcess(port: number): Promise<{ pid?: number; processName?: string }> {
  try {
    const { stdout } = await execFileAsync('lsof', ['-iTCP:' + port, '-sTCP:LISTEN', '-P', '-n', '-t'], {
      timeout: 5000,
    })
    const pidLine = stdout.split(/\n/).find((l) => l.trim().length > 0)
    if (!pidLine) return {}
    const pid = Number(pidLine.trim())
    if (!Number.isFinite(pid) || pid <= 0) return {}
    try {
      const { stdout: psOut } = await execFileAsync('ps', ['-p', String(pid), '-o', 'comm='], {
        timeout: 5000,
      })
      const processName = psOut.trim() || undefined
      return { pid, processName }
    } catch {
      return { pid }
    }
  } catch {
    return {}
  }
}

/**
 * Test whether a port is available for the RemoteServer to bind.
 * Returns structured result. If in-use, attempts OS-specific lookup for
 * the occupying process (netstat+tasklist on Windows, lsof+ps on Unix).
 *
 * Never throws — all lookup failures degrade gracefully to
 * `{ available: false, reason: 'in-use' }` without processName.
 */
export async function testPort(port: number): Promise<PortTestResult> {
  if (!isValidPort(port)) {
    return {
      available: false,
      reason: 'invalid',
      detail: `Port must be an integer in [${PORT_MIN}, ${PORT_MAX}]`,
    }
  }

  const probe = await probeBind(port)
  if (probe.ok) {
    return { available: true }
  }

  if (probe.code === 'EACCES') {
    return { available: false, reason: 'permission-denied' }
  }
  if (probe.code !== 'EADDRINUSE') {
    return { available: false, reason: 'unknown', detail: probe.code }
  }

  // Port in use — attempt process lookup.
  const info =
    process.platform === 'win32'
      ? await lookupWindowsProcess(port)
      : await lookupUnixProcess(port)

  return {
    available: false,
    reason: 'in-use',
    processName: info.processName,
    pid: info.pid,
  }
}
