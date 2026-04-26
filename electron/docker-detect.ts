import * as childProcess from 'child_process'
import { validateContainerName } from './docker-validate'

interface ExecResult {
  stdout: string
  stderr: string
}

export interface DockerContainerInfo {
  id: string
  name: string
  image: string
  state: string
  status: string
}

let execFileImpl: (...args: any[]) => unknown = childProcess.execFile

export function setExecFileImplForTests(execFile: (...args: any[]) => unknown): void {
  execFileImpl = execFile
}

export function resetExecFileImplForTests(): void {
  execFileImpl = childProcess.execFile
}

function execDocker(args: string[]): Promise<ExecResult> {
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
        if (error) {
          reject(new Error(stderr?.trim() || stdout?.trim() || error.message))
          return
        }
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
      },
    )
  })
}

export async function dockerStatus(): Promise<{ available: boolean; version?: string; error?: string }> {
  try {
    const version = await execDocker(['--version'])
    await execDocker(['info'])
    return { available: true, version: version.stdout }
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function listContainers(): Promise<DockerContainerInfo[]> {
  const { stdout } = await execDocker(['ps', '-a', '--format', '{{json .}}'])
  if (!stdout) return []
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, string>)
    .map((entry) => ({
      id: entry.ID ?? '',
      name: entry.Names ?? '',
      image: entry.Image ?? '',
      state: entry.State ?? '',
      status: entry.Status ?? '',
    }))
}

export async function inspectContainer(name: string): Promise<{
  id: string
  name: string
  image: string
  state: { status: string; running: boolean; health: string }
  mounts: Array<{ source: string; destination: string }>
  ports: string[]
  env: string[]
}> {
  const validation = validateContainerName(name)
  if (!validation.ok) throw new Error(validation.error)

  const { stdout } = await execDocker(['inspect', name])
  const parsed = JSON.parse(stdout) as Array<Record<string, any>>
  const entry = parsed[0] ?? {}
  return {
    id: String(entry.Id ?? ''),
    name: String(entry.Name ?? '').replace(/^\//, ''),
    image: String(entry.Config?.Image ?? ''),
    state: {
      status: String(entry.State?.Status ?? ''),
      running: Boolean(entry.State?.Running),
      health: String(entry.State?.Health?.Status ?? 'none'),
    },
    mounts: Array.isArray(entry.Mounts)
      ? entry.Mounts.map((mount: Record<string, unknown>) => ({
          source: String(mount.Source ?? ''),
          destination: String(mount.Destination ?? ''),
        }))
      : [],
    ports: Object.keys(entry.NetworkSettings?.Ports ?? {}),
    env: Array.isArray(entry.Config?.Env) ? entry.Config.Env.map((value: unknown) => String(value)) : [],
  }
}
