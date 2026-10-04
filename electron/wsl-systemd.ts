import * as childProcess from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import * as net from 'net'
import { assertValidDistro, assertValidServiceName, assertValidUnixPath } from './wsl-validate'

interface ExecResult {
  stdout: Buffer
  stderr: Buffer
}

interface PersistedSecretV1 {
  v: number
  encrypted: boolean
  data: string
}

type SpawnLike = (
  command: string,
  args?: readonly string[],
  options?: childProcess.SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams

let execFileImpl: (...args: any[]) => unknown = childProcess.execFile
let spawnImpl: SpawnLike = childProcess.spawn as SpawnLike

const DEFAULT_DATA_DIR = '~/.local/share/bat-server'
const DEFAULT_UNIT_PATH = '~/.config/systemd/user/bat-server.service'
const STATUS_TIMEOUT_MS = 10_000
const STATUS_POLL_MS = 500
const PROBE_TIMEOUT_MS = 15_000
// T0382 (BUG-091, D128): a start only counts once the unit has stayed
// `active` this long without systemd auto-restarting it (see startService).
const STABLE_WINDOW_MS = 3_000
const JOURNAL_LINES = 50
const JOURNAL_SUMMARY_LINES = 10
// CLAUDE.md Child Process Spawning whitelist — applied to the WSL user name
// before it is passed to loginctl (T0378, BUG-087 A).
const UNIX_USER_PATTERN = /^[a-zA-Z0-9._-]+$/

export function setExecFileImplForTests(execFile: (...args: any[]) => unknown): void {
  execFileImpl = execFile
}

export function resetExecFileImplForTests(): void {
  execFileImpl = childProcess.execFile
}

export function setSpawnImplForTests(spawn: SpawnLike): void {
  spawnImpl = spawn
}

export function resetSpawnImplForTests(): void {
  spawnImpl = childProcess.spawn as SpawnLike
}

function escapeSystemdValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function execFileBuffered(file: string, args: string[], options?: { timeoutMs?: number }): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFileImpl(
      file,
      args,
      {
        encoding: 'buffer',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        ...(options?.timeoutMs ? { timeout: options.timeoutMs } : {}),
      },
      (error: Error | null, stdout: Buffer | string, stderr: Buffer | string) => {
        const out = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? '')
        const err = Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr ?? '')
        if (error) {
          ;(error as Error & { stdout?: Buffer; stderr?: Buffer }).stdout = out
          ;(error as Error & { stdout?: Buffer; stderr?: Buffer }).stderr = err
          reject(error)
          return
        }
        resolve({ stdout: out, stderr: err })
      },
    )
  })
}

async function runWsl(
  distro: string,
  command: string[],
  options?: { allowFailure?: boolean; timeoutMs?: number },
): Promise<ExecResult> {
  assertValidDistro(distro)
  try {
    return await execFileBuffered('wsl', ['-d', distro, '--', ...command], { timeoutMs: options?.timeoutMs })
  } catch (error) {
    if (options?.allowFailure) {
      const execError = error as Error & { stdout?: Buffer; stderr?: Buffer }
      return {
        stdout: execError.stdout ?? Buffer.alloc(0),
        stderr: execError.stderr ?? Buffer.alloc(0),
      }
    }
    throw error
  }
}

function decodeJsonSecret(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSecretV1> & { token?: string }
    if (typeof parsed.token === 'string') {
      return parsed.token
    }
    if (parsed && parsed.encrypted === false && typeof parsed.data === 'string') {
      return parsed.data
    }
  } catch {
    return null
  }
  return null
}

async function readPersistedToken(distro: string, dataDir: string): Promise<string | null> {
  const tokenPath = `${dataDir}/server-token.json`
  const result = await runWsl(distro, ['cat', tokenPath], { allowFailure: true })
  const stdout = result.stdout.toString('utf8').trim()
  if (!stdout) return null
  return decodeJsonSecret(stdout)
}

export function renderSystemdUnit(opts: {
  execStart: string
  description?: string
  environment?: Record<string, string>
}): string {
  // T0378 (BUG-087 B): systemd does not expand `~` — ExecStart must be an
  // absolute path, and no Environment value may rely on tilde expansion.
  assertValidUnixPath(opts.execStart, false)
  for (const [key, value] of Object.entries(opts.environment ?? {})) {
    if (value.startsWith('~')) {
      throw new Error(`systemd does not expand "~"; use an absolute path for ${key}: ${value}`)
    }
  }

  const environmentLines = Object.entries(opts.environment ?? {})
    .map(([key, value]) => `Environment=${escapeSystemdValue(`${key}=${value}`)}`)
    .join('\n')

  return [
    '[Unit]',
    `Description=${opts.description ?? 'Better Agent Terminal headless server'}`,
    '',
    '[Service]',
    'Type=simple',
    `ExecStart=${escapeSystemdValue(opts.execStart)}`,
    environmentLines,
    'Restart=on-failure',
    'RestartSec=2s',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ]
    .filter((line, index, lines) => !(line === '' && lines[index - 1] === ''))
    .join('\n')
}

export async function writeUnit(
  distro: string,
  unit: {
    path?: string
    content?: string
    execStart?: string
    description?: string
    environment?: Record<string, string>
  },
): Promise<{ ok: true }> {
  assertValidDistro(distro)
  const unitPath = unit.path ?? DEFAULT_UNIT_PATH
  assertValidUnixPath(unitPath, true)
  const content = unit.content ?? renderSystemdUnit({
    execStart: unit.execStart ?? '',
    description: unit.description,
    environment: unit.environment,
  })

  const unitDir = unitPath.slice(0, unitPath.lastIndexOf('/')) || '/'
  await runWsl(distro, ['mkdir', '-p', unitDir])

  await new Promise<void>((resolve, reject) => {
    const child = spawnImpl('wsl', ['-d', distro, '--', 'tee', unitPath], {
      windowsHide: true,
      stdio: 'pipe',
    })

    const stderrChunks: Buffer[] = []
    child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(Buffer.concat(stderrChunks).toString('utf8').trim() || `tee exited with code ${code}`))
    })
    child.stdin.end(content)
  })

  return { ok: true }
}

/** T0378 (BUG-087 A): default user of the distro (`id -un`), whitelisted. */
export async function resolveDistroUser(distro: string): Promise<string> {
  assertValidDistro(distro)
  const result = await runWsl(distro, ['id', '-un'], { timeoutMs: PROBE_TIMEOUT_MS })
  const user = result.stdout.toString('utf8').trim()
  if (!UNIX_USER_PATTERN.test(user)) {
    throw new Error(`Invalid WSL user name: ${JSON.stringify(user)}`)
  }
  return user
}

async function isLingerEnabled(distro: string, user: string): Promise<boolean> {
  const result = await runWsl(distro, ['loginctl', 'show-user', user, '-p', 'Linger'], {
    allowFailure: true,
    timeoutMs: PROBE_TIMEOUT_MS,
  })
  return /^Linger=yes\s*$/m.test(result.stdout.toString('utf8'))
}

/**
 * T0378 (BUG-087 A): `wsl -d X -- loginctl enable-linger` without a user name
 * fails with ENXIO because `wsl --` is not a logind session, so name the user
 * explicitly (polkit allows enabling linger for yourself without sudo).
 * loginctl's exit code is unreliable on that error path, so success is judged
 * only by `loginctl show-user <user> -p Linger` reporting `Linger=yes`.
 */
export async function enableLinger(distro: string): Promise<{ ok: boolean; error?: string }> {
  assertValidDistro(distro)
  let user: string
  try {
    user = await resolveDistroUser(distro)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  if (await isLingerEnabled(distro, user)) {
    return { ok: true }
  }

  const result = await runWsl(distro, ['loginctl', 'enable-linger', user], {
    allowFailure: true,
    timeoutMs: PROBE_TIMEOUT_MS,
  })
  if (await isLingerEnabled(distro, user)) {
    return { ok: true }
  }

  const stderr = result.stderr.toString('utf8').trim()
  const stdout = result.stdout.toString('utf8').trim()
  return { ok: false, error: stderr || stdout || `Linger is still disabled for ${user}` }
}

export type StartServiceErrorCode =
  | 'wsl-port-in-use'
  | 'wsl-service-start-timeout'
  | 'wsl-service-start-failed'

export type StartServiceResult =
  | { ok: true; token: string | null }
  | { ok: false; error: string; errorCode: StartServiceErrorCode; token?: string | null }

export interface ServiceState {
  activeState: string
  subState: string
  /** null when systemd does not report NRestarts (systemd < 235). */
  nRestarts: number | null
}

export function parseServiceState(text: string): ServiceState {
  const values = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf('=')
    if (index > 0) values.set(line.slice(0, index).trim(), line.slice(index + 1).trim())
  }
  const restarts = values.get('NRestarts')
  return {
    activeState: values.get('ActiveState') ?? '',
    subState: values.get('SubState') ?? '',
    nRestarts: restarts !== undefined && /^\d+$/.test(restarts) ? Number(restarts) : null,
  }
}

async function readServiceState(distro: string, serviceName: string): Promise<ServiceState> {
  const result = await runWsl(
    distro,
    ['systemctl', '--user', 'show', serviceName, '-p', 'ActiveState', '-p', 'SubState', '-p', 'NRestarts'],
    { allowFailure: true, timeoutMs: PROBE_TIMEOUT_MS },
  )
  return parseServiceState(result.stdout.toString('utf8'))
}

/** Distro clock (epoch seconds), so the journal read only covers this start. */
async function readDistroEpoch(distro: string): Promise<string | null> {
  const result = await runWsl(distro, ['date', '+%s'], { allowFailure: true, timeoutMs: PROBE_TIMEOUT_MS })
  const epoch = result.stdout.toString('utf8').trim()
  return /^\d+$/.test(epoch) ? epoch : null
}

async function readJournalTail(distro: string, serviceName: string, sinceEpoch: string | null): Promise<string> {
  const args = ['journalctl', '--user', '-u', serviceName, '--no-pager', '-o', 'cat', '-n', String(JOURNAL_LINES)]
  if (sinceEpoch) args.push('--since', `@${sinceEpoch}`)
  try {
    const result = await runWsl(distro, args, { allowFailure: true, timeoutMs: PROBE_TIMEOUT_MS })
    return result.stdout.toString('utf8').trim()
  } catch {
    return ''
  }
}

function summarizeJournal(journal: string): string {
  return journal
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
    .slice(-JOURNAL_SUMMARY_LINES)
    .join('\n')
}

async function buildStartFailure(
  distro: string,
  serviceName: string,
  reason: string,
  errorCode: Exclude<StartServiceErrorCode, 'wsl-port-in-use'>,
  sinceEpoch: string | null,
): Promise<Extract<StartServiceResult, { ok: false }>> {
  const journal = await readJournalTail(distro, serviceName, sinceEpoch)
  const summary = summarizeJournal(journal)
  const withJournal = (text: string) =>
    summary ? `${text}\n--- journalctl --user -u ${serviceName} ---\n${summary}` : text

  if (/EADDRINUSE/.test(journal)) {
    // last `:port` on the EADDRINUSE line, so `::1:9876` yields 9876
    const port = /EADDRINUSE[^\n]*:(\d{1,5})\b/.exec(journal)?.[1]
    return {
      ok: false,
      errorCode: 'wsl-port-in-use',
      error: withJournal(`${serviceName} could not bind its port${port ? ` ${port}` : ''} (EADDRINUSE). ${reason}`),
    }
  }
  return { ok: false, errorCode, error: withJournal(reason) }
}

function describeState(state: ServiceState): string {
  return `ActiveState=${state.activeState || '?'}, SubState=${state.subState || '?'}`
}

/**
 * T0382 (BUG-091, D128): success means "active for `stableMs` in a row and
 * NRestarts did not grow", not "seen active once" — `Type=simple` is `active`
 * the moment it forks, even when the server exits 100ms later. Chosen over a
 * listen check because it behaves the same in NAT and Mirrored mode and needs
 * no extra tool in the distro; the fetch-fingerprint step right after already
 * proves the TLS listener answers. `restart` (not `enable --now`) so a unit
 * rewritten with a new port also replaces a server still running on the old
 * one. Failures read the journal of this start: EADDRINUSE -> wsl-port-in-use.
 */
export async function startService(
  distro: string,
  serviceName: string,
  options?: { dataDir?: string; timeoutMs?: number; stableMs?: number; pollMs?: number },
): Promise<StartServiceResult> {
  assertValidDistro(distro)
  assertValidServiceName(serviceName)
  const dataDir = options?.dataDir ?? DEFAULT_DATA_DIR
  assertValidUnixPath(dataDir, true)
  const stableMs = options?.stableMs ?? STABLE_WINDOW_MS
  const pollMs = options?.pollMs ?? STATUS_POLL_MS

  let sinceEpoch: string | null = null
  try {
    await runWsl(distro, ['systemctl', '--user', 'daemon-reload'])
    await runWsl(distro, ['systemctl', '--user', 'enable', serviceName])
    sinceEpoch = await readDistroEpoch(distro)
    await runWsl(distro, ['systemctl', '--user', 'restart', serviceName])

    let state = await readServiceState(distro, serviceName)
    const baseRestarts = state.nRestarts ?? 0
    const deadline = Date.now() + (options?.timeoutMs ?? STATUS_TIMEOUT_MS)
    let activeSince: number | null = null

    for (;;) {
      if (state.nRestarts !== null && state.nRestarts > baseRestarts) {
        return await buildStartFailure(
          distro,
          serviceName,
          `${serviceName} exited and was restarted by systemd ${state.nRestarts - baseRestarts} time(s) during the start check (${describeState(state)}).`,
          'wsl-service-start-failed',
          sinceEpoch,
        )
      }
      if (state.activeState === 'failed' || (activeSince !== null && state.activeState !== 'active')) {
        return await buildStartFailure(
          distro,
          serviceName,
          `${serviceName} did not stay active (${describeState(state)}).`,
          'wsl-service-start-failed',
          sinceEpoch,
        )
      }
      if (state.activeState === 'active') {
        activeSince ??= Date.now()
        if (Date.now() - activeSince >= stableMs) {
          return { ok: true, token: await readPersistedToken(distro, dataDir) }
        }
      } else if (Date.now() >= deadline) {
        return await buildStartFailure(
          distro,
          serviceName,
          `Timed out waiting for ${serviceName} to become active (${describeState(state)}).`,
          'wsl-service-start-timeout',
          sinceEpoch,
        )
      }
      await sleep(pollMs)
      state = await readServiceState(distro, serviceName)
    }
  } catch (error) {
    return await buildStartFailure(
      distro,
      serviceName,
      error instanceof Error ? error.message : String(error),
      'wsl-service-start-failed',
      sinceEpoch,
    )
  }
}

export async function removeUnit(
  distro: string,
  serviceName: string,
  options?: { path?: string },
): Promise<{ ok: true }> {
  assertValidDistro(distro)
  assertValidServiceName(serviceName)
  const unitPath = options?.path ?? DEFAULT_UNIT_PATH
  assertValidUnixPath(unitPath, true)

  await runWsl(distro, ['systemctl', '--user', 'disable', '--now', serviceName], { allowFailure: true })
  await runWsl(distro, ['rm', '-f', unitPath], { allowFailure: true })
  await runWsl(distro, ['systemctl', '--user', 'daemon-reload'], { allowFailure: true })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// T0382 (BUG-091, D128): WSL bat-server port selection, probed on the Windows
// side. In Mirrored mode Windows and the distro share localhost, so a port
// Windows already uses (above all the host BAT RemoteServer, default 9876)
// makes the Linux server fail with EADDRINUSE and crash-loop under systemd.
// ---------------------------------------------------------------------------

/** First automatic candidate; 9876 is the host RemoteServer default. */
export const SERVER_PORT_SCAN_START = 9877
/** Last automatic candidate (at most 100 ports are probed). */
export const SERVER_PORT_SCAN_END = 9976
const SERVER_PORT_MIN = 1024
const SERVER_PORT_MAX = 65535
const PORT_PROBE_HOST = '127.0.0.1'
const PORT_PROBE_TIMEOUT_MS = 2_000

export type PickServerPortErrorCode = 'wsl-port-in-use' | 'wsl-port-invalid'

export type PickServerPortResult =
  | { ok: true; port: number }
  | { ok: false; errorCode: PickServerPortErrorCode; error: string }

type PortProbe = (port: number) => Promise<boolean>

function isValidServerPort(port: unknown): port is number {
  return typeof port === 'number' && Number.isInteger(port) && port >= SERVER_PORT_MIN && port <= SERVER_PORT_MAX
}

/**
 * True when `host:port` can be bound right now. The probe server is closed as
 * soon as it listens (and on error / timeout nothing was bound), so the port
 * is never held after the probe resolves.
 */
export function probePortFree(
  port: number,
  host: string = PORT_PROBE_HOST,
  timeoutMs: number = PORT_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    let settled = false
    const timer = setTimeout(() => {
      settled = true
      try { server.close() } catch { /* not listening */ }
      resolve(false)
    }, timeoutMs)
    server.once('error', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(false)
    })
    server.once('listening', () => {
      if (settled) {
        server.close()
        return
      }
      settled = true
      clearTimeout(timer)
      server.close(() => resolve(true))
    })
    server.unref()
    server.listen({ port, host, exclusive: true })
  })
}

let portProbeImpl: PortProbe = (port) => probePortFree(port)

export function setPortProbeImplForTests(probe: PortProbe): void {
  portProbeImpl = probe
}

export function resetPortProbeImplForTests(): void {
  portProbeImpl = (port) => probePortFree(port)
}

/**
 * Pick the port the WSL bat-server will listen on. `excludePorts` carries the
 * host RemoteServer's resolved / running port(s), which are never handed out
 * even if the probe happens to find them free. With `preferredPort` exactly
 * that port is validated (conflict -> error); otherwise
 * SERVER_PORT_SCAN_START..SERVER_PORT_SCAN_END is scanned for the first free one.
 */
export async function pickServerPort(options: {
  excludePorts: readonly unknown[]
  preferredPort?: unknown
  scanStart?: number
  scanEnd?: number
}): Promise<PickServerPortResult> {
  const excluded = new Set(options.excludePorts.filter(isValidServerPort))

  if (options.preferredPort !== undefined && options.preferredPort !== null) {
    const port = options.preferredPort
    if (!isValidServerPort(port)) {
      return {
        ok: false,
        errorCode: 'wsl-port-invalid',
        error: `Server port must be an integer between ${SERVER_PORT_MIN} and ${SERVER_PORT_MAX}, got ${JSON.stringify(port)}.`,
      }
    }
    if (excluded.has(port)) {
      return {
        ok: false,
        errorCode: 'wsl-port-in-use',
        error: `Port ${port} is used by this BAT's own remote server; choose another port for the WSL server.`,
      }
    }
    if (!(await portProbeImpl(port))) {
      return {
        ok: false,
        errorCode: 'wsl-port-in-use',
        error: `Port ${port} is already in use on Windows (${PORT_PROBE_HOST}); choose another port for the WSL server.`,
      }
    }
    return { ok: true, port }
  }

  const start = options.scanStart ?? SERVER_PORT_SCAN_START
  const end = options.scanEnd ?? SERVER_PORT_SCAN_END
  for (let port = start; port <= end; port += 1) {
    if (excluded.has(port)) continue
    if (await portProbeImpl(port)) {
      return { ok: true, port }
    }
  }
  return {
    ok: false,
    errorCode: 'wsl-port-in-use',
    error: `No free port between ${start} and ${end} on Windows (${PORT_PROBE_HOST}) for the WSL server.`,
  }
}
