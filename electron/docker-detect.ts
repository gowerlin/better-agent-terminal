import * as childProcess from 'child_process'
import { validateContainerName } from './docker-validate'
import { BAT_SERVER_LABEL, publishedServerPort } from './docker-lifecycle'

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
  /** T0851: `docker ps` Ports column as printed (empty for stopped containers). */
  ports: string
  /** T0851: `docker ps` CreatedAt column. */
  createdAt: string
  /** T0851: carries the `bat.server=1` label the wizard puts on containers it creates (T0849). */
  batCreated: boolean
  /**
   * T0851: host port the container publishes the in-image bat-server port
   * (`9876/tcp`) on (`publishedServerPort`: running bindings, then the
   * requested ones, so stopped containers count too). `null` = not published;
   * `undefined` = unknown (inspect failed) — the picker then leaves the check
   * to start-server, as before T0851.
   */
  publishedPort?: number | null
}

/** T0851: `docker ps` prints labels as `k=v,k2=v2`. */
export function parsePsLabels(raw: unknown): Record<string, string> {
  const labels: Record<string, string> = {}
  if (typeof raw !== 'string' || !raw) return labels
  for (const part of raw.split(',')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    labels[part.slice(0, eq).trim()] = part.slice(eq + 1)
  }
  return labels
}

/**
 * T0851: fallback when inspect failed — the host port in a `docker ps` Ports
 * column such as `127.0.0.1:19876->9876/tcp, [::]:19876->9876/tcp`. Only a
 * running container has bindings there, so `null` only means "not seen".
 */
export function parsePsPublishedServerPort(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  const match = /:(\d+)->9876\/tcp\b/.exec(raw)
  if (!match) return null
  const port = Number(match[1])
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null
}

const [BAT_LABEL_KEY, BAT_LABEL_VALUE] = BAT_SERVER_LABEL.split('=')
/** Container ids from `docker ps` are hex; anything else is not passed to docker. */
const CONTAINER_ID_PATTERN = /^[a-f0-9]{12,64}$/i

/** CLAUDE.md: synchronous detect probes time out at 5s (T0849: every docker call here is one). */
export const DOCKER_DETECT_TIMEOUT_MS = 5_000

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
        timeout: DOCKER_DETECT_TIMEOUT_MS,
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
  const containers = stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, string>)
    .map((entry): DockerContainerInfo => {
      const labels = parsePsLabels(entry.Labels)
      return {
        id: entry.ID ?? '',
        name: entry.Names ?? '',
        image: entry.Image ?? '',
        state: entry.State ?? '',
        status: entry.Status ?? '',
        ports: entry.Ports ?? '',
        createdAt: entry.CreatedAt ?? '',
        batCreated: labels[BAT_LABEL_KEY] === BAT_LABEL_VALUE,
      }
    })
  await addPublishedPorts(containers)
  return containers
}

/**
 * T0851: one `docker inspect` for every listed container (read only) gives
 * the published bat-server port of stopped containers too and the exact
 * labels. A failed inspect is not an error: the ports fall back to the
 * `docker ps` column of running containers and stay unknown otherwise.
 */
async function addPublishedPorts(containers: DockerContainerInfo[]): Promise<void> {
  const ids = containers.map((container) => container.id).filter((id) => CONTAINER_ID_PATTERN.test(id))
  const byId = new Map<string, Record<string, any>>()
  if (ids.length > 0) {
    try {
      const { stdout } = await execDocker(['inspect', '--type', 'container', ...ids])
      const parsed = JSON.parse(stdout) as unknown
      for (const entry of Array.isArray(parsed) ? parsed as Array<Record<string, any>> : []) {
        const id = String(entry?.Id ?? '')
        if (id) byId.set(id, entry)
      }
    } catch {
      // keep byId empty -> ps fallback below
    }
  }
  for (const container of containers) {
    const entry = [...byId.entries()].find(([fullId]) => container.id && fullId.startsWith(container.id))?.[1]
    if (entry) {
      container.publishedPort = publishedServerPort(entry)
      const labels = entry.Config?.Labels
      if (labels && typeof labels === 'object') container.batCreated = labels[BAT_LABEL_KEY] === BAT_LABEL_VALUE
      continue
    }
    const fromPs = parsePsPublishedServerPort(container.ports)
    if (fromPs !== null) container.publishedPort = fromPs
  }
}

export async function inspectContainer(name: string): Promise<{
  id: string
  name: string
  image: string
  state: { status: string; running: boolean; health: string }
  mounts: Array<{ source: string; destination: string; type: string }>
  ports: string[]
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
          // T0851: `bind` / `volume` / … — "Use existing" offers only the bind mounts.
          type: String(mount.Type ?? ''),
        }))
      : [],
    ports: Object.keys(entry.NetworkSettings?.Ports ?? {}),
    // T0849: no `Config.Env` — a user's container env may hold secrets, and
    // the renderer only uses image / state.
  }
}
