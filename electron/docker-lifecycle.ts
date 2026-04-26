import * as childProcess from 'child_process'
import { randomBytes } from 'crypto'
import { validateContainerName, type DockerMount } from './docker-validate'

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

function execDocker(args: string[], allowFailure = false): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFileImpl(
      'docker',
      args,
      {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
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
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const validation = validateContainerName(name)
  if (!validation.ok) return { ok: false, error: validation.error }

  try {
    if (options?.createIfMissing) {
      if (!options.image) return { ok: false, error: 'Docker image is required to create a new container.' }

      const port = options.port ?? 9876
      const token = options.token ?? randomBytes(16).toString('hex')
      const args = ['run', '-d', '--name', name, '--restart', options.restartPolicy ?? 'unless-stopped', '-p', `${port}:9876`]
      for (const mount of options.mounts ?? []) {
        args.push('-v', `${mount.host}:${mount.container}`)
      }
      if (options.dataVolume) {
        args.push('-v', `${options.dataVolume}:/root/.local/share/bat-server`)
      }
      args.push(options.image, '--port', '9876', '--token', token)
      await execDocker(args)
      return { ok: true, token }
    }

    await execDocker(['start', name])
    const tokenResult = await execDocker(['exec', name, 'cat', '/root/.local/share/bat-server/server-token.json'], true)
    return { ok: true, token: parsePersistedToken(tokenResult.stdout) }
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
