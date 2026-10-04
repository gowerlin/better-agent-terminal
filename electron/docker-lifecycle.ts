import * as childProcess from 'child_process'
import { randomBytes } from 'crypto'
import { validateContainerName, type DockerMount } from './docker-validate'

/** BUG-097: host interface the container's server port is published on. Never widen. */
export const DOCKER_PUBLISH_HOST = '127.0.0.1'

/** In-image bat-server port (docker/Dockerfile `ENV BAT_SERVER_PORT`). */
const SERVER_CONTAINER_PORT_KEY = '9876/tcp'
const BAT_SERVER_BIN = '/opt/bat-server/bin/bat-server'
/** CLAUDE.md: synchronous detect probes time out at 5s. */
const DETECT_TIMEOUT_MS = 5_000

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

function execDocker(args: string[], allowFailure = false, timeoutMs?: number): Promise<ExecResult> {
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
    const { stdout } = await execDocker(['inspect', '--type', 'container', name], false, DETECT_TIMEOUT_MS)
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

    const command = [
      ...(Array.isArray(entry.Config?.Entrypoint) ? entry.Config.Entrypoint : []),
      ...(Array.isArray(entry.Config?.Cmd) ? entry.Config.Cmd : []),
    ].map((part: unknown) => String(part))
    const legacyImage = command.includes(BAT_SERVER_BIN) && !command.includes('--bind-interface')

    return { ok: true, exposed: hostIps.length > 0, hostIps, legacyImage }
  } catch (error) {
    return { ...unknown, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function startContainer(
  name: string,
  options?: {
    createIfMissing?: boolean
    image?: string
    mounts?: DockerMount[]
    port?: number
    restartPolicy?: string
    token?: string
    dataVolume?: string
  },
): Promise<{ ok: boolean; token?: string; error?: string; exposure?: DockerContainerExposure }> {
  const validation = validateContainerName(name)
  if (!validation.ok) return { ok: false, error: validation.error }

  try {
    if (options?.createIfMissing) {
      if (!options.image) return { ok: false, error: 'Docker image is required to create a new container.' }

      const port = options.port ?? 9876
      const token = options.token ?? randomBytes(16).toString('hex')
      // BUG-097: publish on host loopback only. The image binds bat-server to
      // all container interfaces (Dockerfile `--bind-interface all`) so the
      // docker forward can reach it; this host-side bind is what keeps the
      // server (a container root shell via pty:create) off the LAN.
      const args = [
        'run', '-d', '--name', name, '--restart', options.restartPolicy ?? 'unless-stopped',
        '-p', `${DOCKER_PUBLISH_HOST}:${port}:9876`,
      ]
      for (const mount of options.mounts ?? []) {
        args.push('-v', `${mount.host}:${mount.container}`)
      }
      if (options.dataVolume) {
        args.push('-v', `${options.dataVolume}:/root/.local/share/bat-server`)
      }
      args.push(options.image, '--port', '9876', '--token', token)
      try {
        await execDocker(args)
      } catch (error) {
        // T0452: `docker run` can create the container and then fail to start
        // it (e.g. port already allocated). Hand the token back so a retry
        // that `docker start`s that container still knows it.
        return { ok: false, token, error: error instanceof Error ? error.message : String(error) }
      }
      return { ok: true, token }
    }

    // T0427: an existing container may predate the BUG-097 fix. Detect before
    // `docker start` and report it; detection failure never blocks the start.
    const exposure = await detectContainerExposure(name, { hostPort: options?.port })
    await execDocker(['start', name])
    const tokenResult = await execDocker(['exec', name, 'cat', '/root/.local/share/bat-server/server-token.json'], true)
    return {
      ok: true,
      token: parsePersistedToken(tokenResult.stdout),
      ...(exposure.ok && (exposure.exposed || exposure.legacyImage) ? { exposure } : {}),
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function stopContainer(name: string, options?: { remove?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const validation = validateContainerName(name)
  if (!validation.ok) return { ok: false, error: validation.error }

  try {
    if (options?.remove) await execDocker(['rm', '-f', name])
    else await execDocker(['stop', name])
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
    await execDocker(['restart', name])
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
    const result = await execDocker(args)
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
    const result = await execDocker(['inspect', '--format', '{{.State.Health.Status}}', name], true)
    const health = (result.stdout || 'none') as 'healthy' | 'unhealthy' | 'starting' | 'none'
    return { ok: true, health: health || 'none' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
