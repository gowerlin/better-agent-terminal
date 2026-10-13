// Shared isolated launch / teardown for Electron e2e specs (T0399, extracted from T0397).
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`),
// NOT the installed BAT. Every launch gets its own `--runtime=e2e-<name>-<timestamp>`,
// which gives it a separate userData directory. Isolation from a BAT the user is
// running on the same machine:
//   - Terminal Server: PID / port files live in userData and the server listens
//     on an ephemeral port (`listen(0)`), so a separate userData means a
//     separate Terminal Server.
//   - RemoteServer: auto-starts on BAT_REMOTE_PORT > settings.remotePort > 9876.
//     The child env drops every inherited BAT_* variable and sets
//     BAT_REMOTE_PORT to a free port, so it never touches 9876 / 9877.
//   - Teardown answers the quit confirmation dialog (T0144) with "quit + stop
//     Terminal Server" — otherwise `app.close()` hangs forever — then only kills
//     a leftover Terminal Server whose command line is this repo's
//     dist-electron/terminal-server.js, then deletes the runtime userData.
//
// T0510: BAT_E2E_EXECUTABLE=<path to an installed BetterAgentTerminal.exe> launches that
// packaged build instead (same runtime / env isolation). Unset: the source build, as above.

import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

export const REPO_ROOT = path.resolve(__dirname, '..', '..')
export const MAIN_BUNDLE = path.join(REPO_ROOT, 'dist-electron', 'main.js')
/** T0510: packaged executable under test; '' = the source build. */
export const E2E_EXECUTABLE = process.env.BAT_E2E_EXECUTABLE ?? ''
// A packaged app forks the Terminal Server from inside app.asar.
export const TERMINAL_SERVER_SCRIPT = E2E_EXECUTABLE
  ? path.join(path.dirname(E2E_EXECUTABLE), 'resources', 'app.asar', 'dist-electron', 'terminal-server.js')
  : path.join(REPO_ROOT, 'dist-electron', 'terminal-server.js')
const USER_REMOTE_PORTS = new Set([9876, 9877])
const CLOSE_TIMEOUT_MS = 20_000

export type Log = (message: string) => void

export interface IsolatedInstance {
  app: ElectronApplication
  win: Page
  runtimeId: string
  userData: string
  remotePort: number
}

/** Logs to the list reporter and keeps the line as a test annotation for the report. */
export function testLogger(prefix: string): Log {
  return (message: string) => {
    console.log(`[${prefix}] ${message}`)
    test.info().annotations.push({ type: 'evidence', description: message })
  }
}

const defaultLog = testLogger('e2e-isolation')

export function run(file: string, args: string[], timeout = 10_000, encoding: BufferEncoding = 'utf8'): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout, windowsHide: true, encoding: 'buffer' }, (err, stdout) => {
      if (err) reject(err)
      else resolve(Buffer.from(stdout).toString(encoding))
    })
  })
}

export async function freePort(): Promise<number> {
  for (;;) {
    const port = await new Promise<number>((resolve, reject) => {
      const srv = net.createServer()
      srv.once('error', reject)
      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address()
        const p = typeof addr === 'object' && addr ? addr.port : 0
        srv.close(() => resolve(p))
      })
    })
    if (port >= 1024 && !USER_REMOTE_PORTS.has(port)) return port
  }
}

/**
 * `extra` (T0467) overrides inherited variables; a key matching an inherited one
 * case-insensitively (Windows `Path` vs `PATH`) replaces it instead of duplicating it.
 */
export function isolatedEnv(remotePort: number, extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue
    // Inherited BAT_* (tower terminal id, remote port/token, workspace id, …)
    // belong to the BAT this test runs inside — never hand them to the app.
    if (key.startsWith('BAT_') || key.startsWith('CT_') || key === 'ELECTRON_RUN_AS_NODE') continue
    env[key] = value
  }
  for (const [key, value] of Object.entries(extra)) {
    for (const existing of Object.keys(env)) {
      if (existing !== key && existing.toLowerCase() === key.toLowerCase()) delete env[existing]
    }
    env[key] = value
  }
  env.BAT_REMOTE_PORT = String(remotePort)
  return env
}

/** True only for a userData directory created by an isolated e2e runtime. */
function isRuntimeUserData(userData: string, runtimeId: string): boolean {
  return path.basename(userData).includes(`-runtime-${runtimeId}`)
}

/**
 * Launches the source build with `--runtime=e2e-<name>-<timestamp>` and an isolated env.
 * `name` becomes part of the runtime id, e.g. `plan036-e1` → `e2e-plan036-e1-<ts>`.
 * `opts.env` (T0467): extra variables for the app, see `isolatedEnv`.
 * `opts.beforeLaunch` (T0480): runs with the runtime id before the app starts, e.g. to
 * seed a legacy userData directory.
 * `opts.runtimeId` (T0491): relaunch an earlier instance's runtime (closed with
 * `closeIsolated(inst, log, { keepUserData: true })`) to check what survives a restart.
 */
export async function launchIsolated(
  name: string,
  log: Log = defaultLog,
  opts: { env?: Record<string, string>; beforeLaunch?: (runtimeId: string) => void | Promise<void>; runtimeId?: string } = {},
): Promise<IsolatedInstance> {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error(`invalid runtime name: ${name}`)
  if (opts.runtimeId !== undefined && !/^e2e-[a-zA-Z0-9._-]+$/.test(opts.runtimeId)) throw new Error(`invalid runtime id: ${opts.runtimeId}`)
  const runtimeId = opts.runtimeId ?? `e2e-${name}-${Date.now()}`
  await opts.beforeLaunch?.(runtimeId)
  const remotePort = await freePort()
  const env = isolatedEnv(remotePort, opts.env)
  const app = await electron.launch(E2E_EXECUTABLE
    // Playwright starts the executable through a shell on Windows, which drops the
    // backslashes of an unquoted-looking path; forward slashes survive.
    ? { executablePath: E2E_EXECUTABLE.replace(/\\/g, '/'), args: [`--runtime=${runtimeId}`], env }
    : { args: [REPO_ROOT, `--runtime=${runtimeId}`], env })
  let userData = ''
  try {
    userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))
    // Guard: never run against the default (installed BAT) userData.
    expect(path.basename(userData)).toContain(`-runtime-${runtimeId}`)
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    log(`launched runtime=${runtimeId} userData=${userData} remotePort=${remotePort}${E2E_EXECUTABLE ? ` executable=${E2E_EXECUTABLE}` : ''}`)
    return { app, win, runtimeId, userData, remotePort }
  } catch (err) {
    // Do not leave a half-started instance behind. The userData is only removed
    // when it really is this runtime's directory (closeIsolated checks again).
    await closeIsolated({ app, runtimeId, userData }, log)
    throw err
  }
}

export function readPid(userData: string): number | null {
  try {
    const pid = Number(fs.readFileSync(path.join(userData, 'bat-pty-server.pid'), 'utf8').trim())
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function commandLineOf(pid: number): Promise<string> {
  if (process.platform === 'win32') {
    return run('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
    ]).catch(() => '')
  }
  return run('ps', ['-o', 'args=', '-p', String(pid)]).catch(() => '')
}

export async function closeIsolated(
  inst: Pick<IsolatedInstance, 'app' | 'runtimeId' | 'userData'> | undefined,
  log: Log = defaultLog,
  opts: { keepUserData?: boolean } = {},
): Promise<void> {
  if (!inst) return
  const { app, userData, runtimeId } = inst
  const serverPid = userData ? readPid(userData) : null
  try {
    // Answer the quit confirmation with "Quit" + "also stop Terminal Server".
    await app.evaluate(({ dialog }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(dialog as any).showMessageBox = async () => ({ response: 1, checkboxChecked: true })
    })
  } catch { /* app already gone */ }

  let timer: NodeJS.Timeout | undefined
  const closed = await Promise.race([
    app.close().then(() => true, () => true),
    new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), CLOSE_TIMEOUT_MS) }),
  ])
  clearTimeout(timer)
  if (!closed) {
    log(`app.close() did not finish within ${CLOSE_TIMEOUT_MS / 1000}s — killing the Electron process`)
    try { app.process().kill() } catch { /* ignore */ }
  }

  if (serverPid !== null) {
    for (let i = 0; i < 20 && isAlive(serverPid); i++) await new Promise(r => setTimeout(r, 250))
    if (isAlive(serverPid)) {
      const cmd = await commandLineOf(serverPid)
      if (cmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase())) {
        log(`Terminal Server pid ${serverPid} still alive after quit — killing (command line matches this repo)`)
        if (process.platform === 'win32') await run('taskkill', ['/T', '/F', '/PID', String(serverPid)]).catch(() => '')
        else try { process.kill(serverPid, 'SIGKILL') } catch { /* ignore */ }
      } else {
        log(`Terminal Server pid ${serverPid} still alive but command line does not match this repo — left alone: ${cmd.trim()}`)
      }
    }
    log(`Terminal Server pid ${serverPid} alive after teardown: ${isAlive(serverPid)}`)
  }

  if (!userData || !isRuntimeUserData(userData, runtimeId)) {
    log(`userData ${JSON.stringify(userData)} is not this runtime's directory — not removed`)
    return
  }
  if (opts.keepUserData) {
    log(`runtime userData kept for a relaunch: ${userData}`)
    return
  }
  for (let i = 0; i < 10; i++) {
    try {
      fs.rmSync(userData, { recursive: true, force: true })
      break
    } catch {
      await new Promise(r => setTimeout(r, 500))
    }
  }
  log(`runtime userData removed: ${!fs.existsSync(userData)}`)
}
