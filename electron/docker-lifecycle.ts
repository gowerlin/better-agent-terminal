import * as childProcess from 'child_process'
import * as path from 'path'
import { validateContainerName, type DockerMount } from './docker-validate'
import { pickServerPort } from './wsl-systemd'

/** BUG-097: host interface the container's server port is published on. Never widen. */
export const DOCKER_PUBLISH_HOST = '127.0.0.1'

/** In-image bat-server port (docker/Dockerfile `ENV BAT_SERVER_PORT`). */
const SERVER_CONTAINER_PORT_KEY = '9876/tcp'
const BAT_SERVER_BIN = '/opt/bat-server/bin/bat-server'
/** CLAUDE.md: synchronous detect probes time out at 5s. */
const DETECT_TIMEOUT_MS = 5_000
/** T0849: docker calls that change or read container state (start / stop / exec / logs). */
const IO_TIMEOUT_MS = 30_000
/**
 * T0849: label on every container the wizard creates (W2's picker marks them
 * "created by BAT"). `docker run --label` takes `key=value`.
 */
export const BAT_SERVER_LABEL = 'bat.server=1'
/** headless default dataDir for root (electron/remote/dataDir.ts: `$HOME/.local/share/bat-server`). */
export const DEFAULT_SERVER_DATA_DIR = '/root/.local/share/bat-server'
const SERVER_TOKEN_FILE = 'server-token.json'

/**
 * T0427 (BUG-097 follow-up): what a pre-fix container still carries. Never
 * thrown — `ok:false` means detection could not run (docker unavailable,
 * unknown container) and callers must carry on as before.
 */
export interface DockerContainerExposure {
  ok: boolean
  /** bat-server port is published on a non-loopback host interface. */
  exposed: boolean
  /** Offending `HostIp` values as docker reports them (`''` = all interfaces). */
  hostIps: string[]
  /** Image entrypoint predates `--bind-interface all`; the published port cannot reach the server. */
  legacyImage: boolean
  error?: string
}

interface ExecResult {
  stdout: string
  stderr: string
}

let execFileImpl: (...args: any[]) => unknown = childProcess.execFile

export function setExecFileImplForTests(execFile: (...args: any[]) => unknown): void {
  execFileImpl = execFile
}

export function resetExecFileImplForTests(): void {
  execFileImpl = childProcess.execFile
}

/**
 * T0849: every call states its timeout. `null` = no timeout, kept only for
 * `docker run` (it may pull the image first; its time limit is unchanged).
 * Arguments are never logged — `exec cat` output is a token.
 */
function execDocker(args: string[], timeoutMs: number | null, allowFailure = false): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFileImpl(
      'docker',
      args,
      {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        ...(timeoutMs ? { timeout: timeoutMs } : {}),
      },
      (error: Error | null, stdout: string, stderr: string) => {
        if (error && !allowFailure) {
          reject(new Error(stderr?.trim() || stdout?.trim() || error.message))
          return
        }
        resolve({ stdout: (stdout ?? '').trim(), stderr: (stderr ?? '').trim() })
      },
    )
  })
}

function parsePersistedToken(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as { token?: string; data?: string; encrypted?: boolean }
    if (typeof parsed.token === 'string') return parsed.token
    if (parsed.encrypted === false && typeof parsed.data === 'string') return parsed.data
  } catch {
    return trimmed
  }
  return null
}

/** `Config.Entrypoint` + `Config.Cmd` of a `docker inspect` entry, as strings. */
function containerCommand(entry: Record<string, any> | null | undefined): string[] {
  return [
    ...(Array.isArray(entry?.Config?.Entrypoint) ? entry.Config.Entrypoint : []),
    ...(Array.isArray(entry?.Config?.Cmd) ? entry.Config.Cmd : []),
  ].map((part: unknown) => String(part))
}

/**
 * T0849: value of `--<flag> <v>` / `--<flag>=<v>` in a container command, the
 * way bat-server's `parseArgs` reads it (the last occurrence wins). `null`
 * when absent or empty.
 */
export function readCommandFlag(command: readonly string[], flag: string): string | null {
  const long = `--${flag}`
  let value: string | null = null
  for (let index = 0; index < command.length; index += 1) {
    const part = command[index]
    if (part === long) {
      const next = command[index + 1]
      if (typeof next === 'string' && !next.startsWith('--')) {
        value = next
        index += 1
      }
    } else if (part.startsWith(`${long}=`)) {
      value = part.slice(long.length + 1)
    }
  }
  return value ? value : null
}

function envValue(entry: Record<string, any> | null | undefined, key: string): string | null {
  const env: unknown[] = Array.isArray(entry?.Config?.Env) ? entry.Config.Env : []
  let value: string | null = null
  for (const item of env) {
    const text = String(item)
    if (text.startsWith(`${key}=`)) value = text.slice(key.length + 1)
  }
  return value ? value : null
}

/**
 * T0849: where the container's bat-server keeps `server-token.json` — the
 * same order as scripts/bat-server.mjs `resolveDataDir` + dataDir.ts:
 * `--data-dir` in Entrypoint / Cmd → env `BAT_SERVER_DATA_DIR` →
 * `$XDG_DATA_HOME/bat-server` → `$HOME/.local/share/bat-server` →
 * `/root/.local/share/bat-server`. Relative paths resolve against
 * `Config.WorkingDir` (the server's cwd). Pure; reads inspect JSON only.
 */
export function resolveServerTokenPath(entry: Record<string, any> | null | undefined): string {
  const workingDir = entry?.Config?.WorkingDir
  const cwd = typeof workingDir === 'string' && workingDir.startsWith('/') ? workingDir : '/'
  const resolve = (dir: string) => path.posix.resolve(cwd, dir)
  const dataDirFlag = readCommandFlag(containerCommand(entry), 'data-dir')
  const envDataDir = envValue(entry, 'BAT_SERVER_DATA_DIR')
  const xdg = envValue(entry, 'XDG_DATA_HOME')
  const home = envValue(entry, 'HOME')
  const dataDir = dataDirFlag ? resolve(dataDirFlag)
    : envDataDir ? resolve(envDataDir)
      : xdg ? resolve(path.posix.join(xdg, 'bat-server'))
        : home ? resolve(path.posix.join(home, '.local', 'share', 'bat-server'))
          : DEFAULT_SERVER_DATA_DIR
  return path.posix.join(dataDir, SERVER_TOKEN_FILE)
}

/**
 * T0849 (D283): `docker run` arguments for a container the wizard creates.
 * No `--token` — it would show in `docker inspect` and the process list; the
 * server generates its own on first start (`loadOrGenerateToken`) and the
 * wizard reads it once healthy (`readServerToken`). Publishes on
 * `DOCKER_PUBLISH_HOST` only (BUG-097) and labels the container
 * `BAT_SERVER_LABEL`. Pure.
 */
export function buildCreateContainerArgs(name: string, options: {
  image: string
  port?: number
  mounts?: DockerMount[]
  restartPolicy?: string
  dataVolume?: string
}): string[] {
  const port = options.port ?? 9876
  // BUG-097: publish on host loopback only. The image binds bat-server to
  // all container interfaces (Dockerfile `--bind-interface all`) so the
  // docker forward can reach it; this host-side bind is what keeps the
  // server (a container root shell via pty:create) off the LAN.
  const args = [
    'run', '-d', '--name', name, '--restart', options.restartPolicy ?? 'unless-stopped',
    '--label', BAT_SERVER_LABEL,
    '-p', `${DOCKER_PUBLISH_HOST}:${port}:9876`,
  ]
  for (const mount of options.mounts ?? []) {
    args.push('-v', `${mount.host}:${mount.container}`)
  }
  if (options.dataVolume) {
    args.push('-v', `${options.dataVolume}:${DEFAULT_SERVER_DATA_DIR}`)
  }
  args.push(options.image, '--port', '9876')
  return args
}

function isLoopbackHostIp(hostIp: string): boolean {
  const ip = hostIp.trim().toLowerCase()
  return ip === 'localhost' || ip === '::1' || ip === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(ip)
}

/**
 * T0427: flag a container created before the BUG-097 fix. Reads structured
 * `docker inspect` fields only: `HostConfig.PortBindings` (empty / `0.0.0.0` /
 * `::` HostIp = published on every host interface) and the entrypoint/cmd
 * (`--bind-interface` missing = pre-fix image). Read-only — never changes or
 * removes the container. `hostPort` also counts bindings of that host port
 * for containers that serve bat-server on another container port.
 */
export async function detectContainerExposure(
  name: string,
  options?: { hostPort?: number },
): Promise<DockerContainerExposure> {
  const unknown = { ok: false, exposed: false, hostIps: [], legacyImage: false }
  const validation = validateContainerName(name)
  if (!validation.ok) return { ...unknown, error: validation.error }

  try {
    const { stdout } = await execDocker(['inspect', '--type', 'container', name], DETECT_TIMEOUT_MS)
    const parsed = JSON.parse(stdout) as unknown
    const entry = (Array.isArray(parsed) ? parsed[0] : null) as Record<string, any> | null
    if (!entry || typeof entry !== 'object') return { ...unknown, error: `No inspect data for container ${name}.` }

    const bindings = (entry.HostConfig?.PortBindings ?? {}) as Record<string, unknown>
    const hostPort = options?.hostPort ? String(options.hostPort) : null
    const hostIps: string[] = []
    for (const [containerPort, list] of Object.entries(bindings)) {
      if (!Array.isArray(list)) continue
      for (const binding of list as Array<Record<string, unknown>>) {
        const relevant = containerPort === SERVER_CONTAINER_PORT_KEY
          || (hostPort !== null && String(binding?.HostPort ?? '') === hostPort)
        if (!relevant) continue
        const hostIp = typeof binding?.HostIp === 'string' ? binding.HostIp : ''
        if (!isLoopbackHostIp(hostIp) && !hostIps.includes(hostIp)) hostIps.push(hostIp)
      }
    }

    const command = containerCommand(entry)
    const legacyImage = command.includes(BAT_SERVER_BIN) && !command.includes('--bind-interface')

    return { ok: true, exposed: hostIps.length > 0, hostIps, legacyImage }
  } catch (error) {
    return { ...unknown, error: error instanceof Error ? error.message : String(error) }
  }
}

export type DockerPickServerPortErrorCode =
  | 'docker-port-in-use'
  | 'docker-port-invalid'
  | 'docker-port-unpublished'
  | 'docker-inspect-failed'

export type DockerPickServerPortResult =
  /** `reusedExistingPort`: the port the container already publishes. */
  | { ok: true; port: number; reusedExistingPort?: boolean }
  | { ok: false; errorCode: DockerPickServerPortErrorCode; error: string }

function toHostPort(value: unknown): number | null {
  const port = Number(value)
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null
}

/**
 * T0649 (BUG-156): host port the container publishes the in-image bat-server
 * port on. `NetworkSettings.Ports` (what docker actually bound, running
 * containers) wins over `HostConfig.PortBindings` (what was asked for; also
 * set on stopped containers). Other container ports are never guessed at.
 */
export function publishedServerPort(entry: Record<string, any> | null | undefined): number | null {
  for (const source of [entry?.NetworkSettings?.Ports, entry?.HostConfig?.PortBindings]) {
    const list = source && typeof source === 'object' ? (source as Record<string, unknown>)[SERVER_CONTAINER_PORT_KEY] : null
    if (!Array.isArray(list)) continue
    for (const binding of list as Array<Record<string, unknown>>) {
      const port = toHostPort(binding?.HostPort)
      if (port !== null) return port
    }
  }
  return null
}

/**
 * T0649 (BUG-156): pick the host port a Docker container publishes bat-server
 * on. The publish host is 127.0.0.1 — where the host RemoteServer listens too
 * (default 9876) — so a fixed 9876 made "Create new" fail with the port taken.
 *
 * - `container`: a container that already exists (Use existing, or the one
 *   this wizard run created): its published port is kept. Only the port the
 *   RemoteServer is actually listening on (`activeServerPort`) is refused —
 *   127.0.0.1:<port> would reach this BAT instead of the container.
 * - otherwise: `pickServerPort` (shared with the WSL wizard) with
 *   `excludePorts` = the RemoteServer's resolved / running ports; `previousPort`
 *   (an earlier attempt of this run) is kept while free.
 */
export async function pickDockerServerPort(options: {
  excludePorts: readonly unknown[]
  activeServerPort?: number | null
  preferredPort?: unknown
  previousPort?: unknown
  container?: string
}): Promise<DockerPickServerPortResult> {
  if (options.container !== undefined) {
    const name = options.container
    const validation = validateContainerName(name)
    if (!validation.ok) return { ok: false, errorCode: 'docker-inspect-failed', error: validation.error ?? 'Invalid container name.' }
    let entry: Record<string, any> | null
    try {
      const { stdout } = await execDocker(['inspect', '--type', 'container', name], DETECT_TIMEOUT_MS)
      const parsed = JSON.parse(stdout) as unknown
      entry = (Array.isArray(parsed) ? parsed[0] : null) as Record<string, any> | null
    } catch (error) {
      return { ok: false, errorCode: 'docker-inspect-failed', error: error instanceof Error ? error.message : String(error) }
    }
    const port = publishedServerPort(entry)
    if (port === null) {
      return {
        ok: false,
        errorCode: 'docker-port-unpublished',
        error: `Docker container ${name} does not publish the BAT server port (${SERVER_CONTAINER_PORT_KEY}) on the host, so BAT cannot connect to it. Choose "Create new", or recreate the container with -p ${DOCKER_PUBLISH_HOST}:<port>:9876.`,
      }
    }
    if (options.activeServerPort && port === options.activeServerPort) {
      return {
        ok: false,
        errorCode: 'docker-port-in-use',
        error: `Docker container ${name} publishes the BAT server on host port ${port}, which this BAT's own remote server is listening on. Change the remote server port in Settings, or choose "Create new".`,
      }
    }
    return { ok: true, port, reusedExistingPort: true }
  }

  const result = await pickServerPort({
    excludePorts: options.excludePorts,
    preferredPort: options.preferredPort,
    existingPort: options.previousPort,
    serverLabel: 'Docker container',
    hostLabel: 'this machine',
  })
  if (result.ok) return { ok: true, port: result.port }
  return {
    ok: false,
    errorCode: result.errorCode === 'wsl-port-invalid' ? 'docker-port-invalid' : 'docker-port-in-use',
    error: result.error,
  }
}

/**
 * Create (`createIfMissing`) or `docker start` a container. T0849: never
 * reads or returns the server token — the server may not have written it
 * yet; the wizard calls `readServerToken` once the container is healthy.
 */
export async function startContainer(
  name: string,
  options?: {
    createIfMissing?: boolean
    image?: string
    mounts?: DockerMount[]
    port?: number
    restartPolicy?: string
    dataVolume?: string
  },
): Promise<{ ok: boolean; error?: string; exposure?: DockerContainerExposure }> {
  const validation = validateContainerName(name)
  if (!validation.ok) return { ok: false, error: validation.error }

  try {
    if (options?.createIfMissing) {
      if (!options.image) return { ok: false, error: 'Docker image is required to create a new container.' }
      // Time limit unchanged (none): `docker run` may pull the image first.
      await execDocker(buildCreateContainerArgs(name, {
        image: options.image,
        port: options.port,
        mounts: options.mounts,
        restartPolicy: options.restartPolicy,
        dataVolume: options.dataVolume,
      }), null)
      return { ok: true }
    }

    // T0427: an existing container may predate the BUG-097 fix. Detect before
    // `docker start` and report it; detection failure never blocks the start.
    const exposure = await detectContainerExposure(name, { hostPort: options?.port })
    await execDocker(['start', name], IO_TIMEOUT_MS)
    return {
      ok: true,
      ...(exposure.ok && (exposure.exposed || exposure.legacyImage) ? { exposure } : {}),
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export type DockerReadServerTokenErrorCode = 'docker-token-unavailable' | 'docker-inspect-failed'

export type DockerReadServerTokenResult =
  | { ok: true; token: string; source: 'file' | 'command' }
  | { ok: false; errorCode: DockerReadServerTokenErrorCode; error: string }

/**
 * T0849: the bat-server token of a running (healthy) container, in three
 * stages — all in main; only the token leaves (`docker:read-server-token`
 * drops `source`):
 *   1. `docker exec <name> cat <dataDir>/server-token.json` (`resolveServerTokenPath`);
 *   2. a container created with `--token <t>` (before D283) → `<t>`;
 *   3. neither → `docker-token-unavailable`.
 * Never re-issues a token or changes the container (BUG-111). The error text
 * names the path, never a token or the container's env / command.
 */
export async function readServerToken(name: string): Promise<DockerReadServerTokenResult> {
  const validation = validateContainerName(name)
  if (!validation.ok) return { ok: false, errorCode: 'docker-inspect-failed', error: validation.error ?? 'Invalid container name.' }

  let entry: Record<string, any> | null
  try {
    const { stdout } = await execDocker(['inspect', '--type', 'container', name], DETECT_TIMEOUT_MS)
    const parsed = JSON.parse(stdout) as unknown
    entry = (Array.isArray(parsed) ? parsed[0] : null) as Record<string, any> | null
  } catch (error) {
    return { ok: false, errorCode: 'docker-inspect-failed', error: error instanceof Error ? error.message : String(error) }
  }
  if (!entry || typeof entry !== 'object') {
    return { ok: false, errorCode: 'docker-inspect-failed', error: `No inspect data for container ${name}.` }
  }

  const tokenPath = resolveServerTokenPath(entry)
  // allowFailure: a missing file is stage 2's case, not an error.
  const { stdout } = await execDocker(['exec', name, 'cat', tokenPath], IO_TIMEOUT_MS, true)
  const fileToken = parsePersistedToken(stdout)
  if (fileToken) return { ok: true, token: fileToken, source: 'file' }

  const commandToken = readCommandFlag(containerCommand(entry), 'token')
  if (commandToken) return { ok: true, token: commandToken, source: 'command' }

  return {
    ok: false,
    errorCode: 'docker-token-unavailable',
    error: `Docker container ${name} is running, but BAT could not read its BAT server token: ${tokenPath} is missing or unreadable, `
      + `and the container command has no --token. Make sure the container runs bat-server, and check the container log (docker logs ${name}).`,
  }
}

export async function stopContainer(name: string, options?: { remove?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const validation = validateContainerName(name)
  if (!validation.ok) return { ok: false, error: validation.error }

  try {
    if (options?.remove) await execDocker(['rm', '-f', name], IO_TIMEOUT_MS)
    else await execDocker(['stop', name], IO_TIMEOUT_MS)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function removeContainer(name: string): Promise<{ ok: boolean; error?: string }> {
  return stopContainer(name, { remove: true })
}

export async function restartContainer(name: string): Promise<{ ok: boolean; error?: string }> {
  const validation = validateContainerName(name)
  if (!validation.ok) return { ok: false, error: validation.error }

  try {
    await execDocker(['restart', name], IO_TIMEOUT_MS)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function getContainerLogs(
  name: string,
  opts?: { tail?: number; follow?: boolean },
): Promise<{ ok: boolean; logs?: string; error?: string }> {
  const validation = validateContainerName(name)
  if (!validation.ok) return { ok: false, error: validation.error }

  try {
    const args = ['logs', '--tail', String(opts?.tail ?? 100)]
    if (opts?.follow) args.push('--follow')
    args.push(name)
    const result = await execDocker(args, IO_TIMEOUT_MS)
    return { ok: true, logs: result.stdout }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function getContainerHealth(
  name: string,
): Promise<{ ok: boolean; health?: 'healthy' | 'unhealthy' | 'starting' | 'none'; error?: string }> {
  const validation = validateContainerName(name)
  if (!validation.ok) return { ok: false, error: validation.error }

  try {
    const result = await execDocker(['inspect', '--format', '{{.State.Health.Status}}', name], DETECT_TIMEOUT_MS, true)
    const health = (result.stdout || 'none') as 'healthy' | 'unhealthy' | 'starting' | 'none'
    return { ok: true, health: health || 'none' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
