import * as childProcess from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
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

function execFileBuffered(file: string, args: string[]): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFileImpl(
      file,
      args,
      {
        encoding: 'buffer',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
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

async function runWsl(distro: string, command: string[], options?: { allowFailure?: boolean }): Promise<ExecResult> {
  assertValidDistro(distro)
  try {
    return await execFileBuffered('wsl', ['-d', distro, '--', ...command])
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
  assertValidUnixPath(opts.execStart, true)

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

  await runWsl(distro, ['mkdir', '-p', '~/.config/systemd/user'])

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

export async function enableLinger(distro: string): Promise<{ ok: boolean; error?: string }> {
  assertValidDistro(distro)
  const result = await runWsl(distro, ['loginctl', 'enable-linger'], { allowFailure: true })
  const stderr = result.stderr.toString('utf8').trim()
  const stdout = result.stdout.toString('utf8').trim()
  if (stderr || stdout.toLowerCase().includes('failed')) {
    return { ok: false, error: stderr || stdout }
  }
  return { ok: true }
}

export async function startService(
  distro: string,
  serviceName: string,
  options?: { dataDir?: string; timeoutMs?: number },
): Promise<{ ok: true; token: string | null } | { ok: false; error: string; token?: string | null }> {
  assertValidDistro(distro)
  assertValidServiceName(serviceName)
  const dataDir = options?.dataDir ?? DEFAULT_DATA_DIR
  assertValidUnixPath(dataDir, true)

  try {
    await runWsl(distro, ['systemctl', '--user', 'daemon-reload'])
    await runWsl(distro, ['systemctl', '--user', 'enable', '--now', serviceName])

    const deadline = Date.now() + (options?.timeoutMs ?? STATUS_TIMEOUT_MS)
    while (Date.now() < deadline) {
      const status = await runWsl(distro, ['systemctl', '--user', 'is-active', serviceName], { allowFailure: true })
      const state = status.stdout.toString('utf8').trim()
      if (state === 'active') {
        return { ok: true, token: await readPersistedToken(distro, dataDir) }
      }
      await sleep(STATUS_POLL_MS)
    }

    return { ok: false, error: `Timed out waiting for ${serviceName} to become active` }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
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
