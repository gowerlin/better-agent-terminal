import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { logger } from '../logger'
import { buildBaseSshArgs, buildBaseSshSpawnEnv } from './ssh-args'
import { shutdownSshProcess } from './ssh-process-lifecycle'

export interface SshProbeOptions {
  sshHost: string
  sshUser: string
  sshPort?: number
  sshKeyPath?: string
}

export type SshProbeErrorCode =
  | 'no-ssh'
  | 'permission-denied'
  | 'host-key'
  | 'connect-timeout'
  | 'unknown'

export interface SshProbeResult {
  ok: boolean
  serverPlatform?: 'linux' | 'darwin'
  serverArch?: string
  serverHome?: string
  sshExecPath?: string
  error?: string
  errorCode?: SshProbeErrorCode
}

type SpawnFn = (
  command: string,
  args: readonly string[],
  options?: { stdio?: unknown; windowsHide?: boolean; env?: NodeJS.ProcessEnv },
) => ChildProcess

type LookupSshFn = () => Promise<string | null>

/**
 * Test injection point. Production resolves ssh via PATH probe (`which`/`where`)
 * and spawns ssh through dynamic-imported `child_process` to avoid shell parsing
 * (D042 secure spawn). Tests pass mocks here so no real ssh subprocess fires
 * (T0285 守則 #8 + T0284 mock-spawn convention).
 */
export interface SshProbeDeps {
  spawn?: SpawnFn
  lookupSsh?: LookupSshFn
  /** Total wall budget for the probe child process. Default 15s. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000

const REMOTE_PROBE_COMMAND = 'echo BAT_AUTH_OK; uname -sm; echo HOME=$HOME'

function buildSshArgs(opts: SshProbeOptions): string[] {
  // user@host validation (F-004) + BatchMode/ConnectTimeout/StrictHostKeyChecking
  // (EC-003) come from the shared helper. Remote command goes after `--
  // user@host`, where ssh treats it as the command rather than an option.
  const args = buildBaseSshArgs(opts)
  args.push(REMOTE_PROBE_COMMAND)
  return args
}

async function defaultLookupSsh(): Promise<string | null> {
  const isWindows = process.platform === 'win32'
  const cmd = isWindows ? 'where' : 'which'
  const arg = 'ssh'
  try {
    const { spawn } = await import('child_process')
    const proc = spawn(cmd, [arg], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let out = ''
    proc.stdout?.on('data', (chunk: Buffer) => { out += chunk.toString('utf8') })
    const exitCode: number = await new Promise((resolve) => {
      proc.on('exit', (code) => resolve(code ?? 1))
      proc.on('error', () => resolve(1))
    })
    if (exitCode !== 0) return null
    const first = out.split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0)
    return first ?? null
  } catch {
    return null
  }
}

function parsePlatform(line: string): { platform?: 'linux' | 'darwin'; arch?: string } {
  const trimmed = line.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length < 2) return {}
  const sysname = parts[0].toLowerCase()
  const arch = parts[1]
  if (sysname === 'linux') return { platform: 'linux', arch }
  if (sysname === 'darwin') return { platform: 'darwin', arch }
  return { arch }
}

function classifyStderr(stderr: string): SshProbeErrorCode {
  const text = stderr.toLowerCase()
  if (text.includes('permission denied')) return 'permission-denied'
  if (text.includes('host key verification failed')) return 'host-key'
  if (text.includes('no matching host key')) return 'host-key'
  if (text.includes('connection timed out') || text.includes('operation timed out')) return 'connect-timeout'
  if (text.includes('connection refused')) return 'unknown'
  return 'unknown'
}

export async function probeSshAuth(
  opts: SshProbeOptions,
  deps: SshProbeDeps = {},
): Promise<SshProbeResult> {
  const lookupSsh = deps.lookupSsh ?? defaultLookupSsh
  const sshExecPath = await lookupSsh()
  if (!sshExecPath) {
    return { ok: false, errorCode: 'no-ssh', error: 'ssh executable not found in PATH' }
  }

  const spawn = deps.spawn ?? (await import('child_process')).spawn
  const args = buildSshArgs(opts)
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS

  let proc: ChildProcess
  try {
    proc = spawn('ssh', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...buildBaseSshSpawnEnv() },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[ssh-auth-probe] spawn failed: ${message}`)
    return { ok: false, errorCode: 'unknown', error: message, sshExecPath }
  }

  let stdout = ''
  let stderr = ''
  proc.stdout?.on('data', (chunk: Buffer | string) => {
    stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  })
  proc.stderr?.on('data', (chunk: Buffer | string) => {
    stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  })

  const result: { exitCode: number | null; timedOut: boolean; spawnError?: Error } = await new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      // BUG-063 (T0299): SIGTERM → SIGKILL escalation via shared helper so a
      // probe child that ignores SIGTERM doesn't survive past the timeout.
      void shutdownSshProcess(proc, { logger }).catch(() => { /* noop */ })
      resolve({ exitCode: null, timedOut: true })
    }, timeoutMs)
    proc.on('error', (err: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ exitCode: null, timedOut: false, spawnError: err })
    })
    proc.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ exitCode: code ?? 1, timedOut: false })
    })
  })

  if (result.spawnError) {
    return { ok: false, errorCode: 'unknown', error: result.spawnError.message, sshExecPath }
  }
  if (result.timedOut) {
    return { ok: false, errorCode: 'connect-timeout', error: 'ssh probe exceeded timeout', sshExecPath }
  }

  if (result.exitCode !== 0) {
    return {
      ok: false,
      errorCode: classifyStderr(stderr),
      error: stderr.trim() || `ssh exited with code ${result.exitCode}`,
      sshExecPath,
    }
  }

  if (!stdout.includes('BAT_AUTH_OK')) {
    return {
      ok: false,
      errorCode: 'unknown',
      error: 'BAT_AUTH_OK marker missing in ssh stdout',
      sshExecPath,
    }
  }

  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0)
  const okIdx = lines.findIndex((line) => line === 'BAT_AUTH_OK')
  const platformLine = okIdx >= 0 && okIdx + 1 < lines.length ? lines[okIdx + 1] : ''
  const homeLine = lines.find((line) => line.startsWith('HOME=')) ?? ''
  const { platform, arch } = parsePlatform(platformLine)
  const serverHome = homeLine ? homeLine.slice('HOME='.length) : undefined

  return {
    ok: true,
    serverPlatform: platform,
    serverArch: arch,
    serverHome,
    sshExecPath,
  }
}

// re-exported for tests that need to peek at internals (paranoia: keep the
// public surface narrow; tests can spawn-mock via deps, no need to import these).
export const __internals = {
  buildSshArgs,
  parsePlatform,
  classifyStderr,
  EventEmitter,
}
