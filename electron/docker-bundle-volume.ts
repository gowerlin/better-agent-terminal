/**
 * T0852 (PLAN-052 W4a, D283 U1 (c′)): main-process docker primitives for the
 * "base image + server bundle volume" container the Docker wizard will build
 * (the wizard steps are T0853):
 *
 *   1. `pullImage`               — `docker pull <base image>` with progress, abort and a time limit;
 *   2. `dockerServerArch`        — the daemon's OS / arch → `ServerBundleArch` (`normalizeArch`);
 *   3. `createBatVolume` / `removeBatVolume` — `bat-server-<name>-bundle` / `-data`, labelled
 *      `bat.server=1`; removal refuses volumes without the label;
 *   4. `installBundleIntoVolume` — `docker run --rm -i -v <bundle vol>:/opt/bat <base> …` with the
 *      tarball streamed on stdin, running the T0552 / T0554 install script
 *      (`buildSshBundleInstallCommand(BAT_BUNDLE_ROOT)`: `.bat-new` / `.bat-old` swap);
 *      `restoreBundleInVolume` / `discardPreviousBundleInVolume` for the wizard's cancel / finish;
 *   5. `probeBundleCompat`       — `/bin/sh`, `tar`, `gzip`, musl / glibc and `bin/node -e 1`;
 *   6. `buildBatContainerRunArgs` (pure) / `createBatContainer` — the server container;
 *   7. `execContainerCommand`    — the one `docker exec` the wizard's rollback asks for;
 *   8. `readServerCertFingerprint` — SHA-256 of the container's `server-cert.json` (never the cert
 *      or key themselves).
 *   9. `inspectImageBakedBundle` — T0853 (U3): does the image itself start `/opt/bat-server/bin/bat-server`?
 *  10. `readBundleVersionInVolume` — T0853: the bundle version in a bundle volume (upgrade check).
 *
 * Rules (T0852 work order):
 * - every child process is `execFile` / `spawn` with an argument array and a time limit; image,
 *   container and volume names pass a whitelist first (`validateDockerImageRef`,
 *   `validateContainerName`, `validateDockerVolumeName`);
 * - the server container publishes on `DOCKER_PUBLISH_HOST` only (BUG-097), never gets `--token`
 *   (the server makes its own; D283 U5) and runs as root with `--data-dir /var/lib/bat-server`
 *   (U4); the data dir is created 0700;
 * - the tarball goes from the host file straight into the job container's stdin; nothing is
 *   written anywhere but the volume;
 * - nothing here logs; callers log codes and counts only — never a token, a certificate or
 *   docker arguments.
 *
 * No electron import; main.ts wires the IPC (`docker:*`).
 */
import * as childProcess from 'child_process'
import { createHash, randomBytes } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { normalizeArch, type ServerBundleArch } from '../src/lib/arch-normalize'
import { BAT_SERVER_LABEL, DOCKER_PUBLISH_HOST, resolveServerTokenPath } from './docker-lifecycle'
import { validateContainerName, type DockerMount } from './docker-validate'
import {
  assertBundleInstallRoot,
  buildSshBundleDiscardPreviousCommand,
  buildSshBundleInstallCommand,
  buildSshBundleRestoreCommand,
  parseBundleInstallPrevious,
  parseBundleRestoreOutcome,
  type BundleInstallPrevious,
  type BundleRestoreOutcome,
} from './server-bundle-install-script'

// ─── constants ────────────────────────────────────────────────────────────

/** Where the bundle volume is mounted, in the install job and in the server container. */
export const BAT_BUNDLE_VOLUME_MOUNT = '/opt/bat'
/** Install root inside the bundle volume (`<root>.bat-new` / `.bat-old` sit next to it). */
export const BAT_BUNDLE_ROOT = '/opt/bat/server'
export const BAT_BUNDLE_SERVER_BIN = `${BAT_BUNDLE_ROOT}/bin/bat-server`
export const BAT_BUNDLE_NODE_BIN = `${BAT_BUNDLE_ROOT}/bin/node`
/** D283 U4: the server's `--data-dir` (data volume mount point). */
export const BAT_CONTAINER_DATA_DIR = '/var/lib/bat-server'
/** bat-server port inside the container (`--port`), published as `127.0.0.1:<P>:9876`. */
export const BAT_CONTAINER_SERVER_PORT = 9876
/** U4: run as root whatever the base image's `USER` is (uid:gid needs no /etc/passwd entry). */
export const BAT_CONTAINER_USER = '0:0'
/** Lower glibc bound of the linux bundles (scripts/build-server-bundle.mjs `readmeRuntimeLine`). */
export const BUNDLE_GLIBC_MIN: readonly [number, number] = [2, 35]

/** Extra label on volumes BAT creates: which of the two it is. */
export const BAT_VOLUME_ROLE_LABEL_KEY = 'bat.server.volume'
export type BatVolumeRole = 'bundle' | 'data'

const [BAT_LABEL_KEY, BAT_LABEL_VALUE] = BAT_SERVER_LABEL.split('=')

/** `docker pull` may download hundreds of MiB; the wizard can abort it earlier. */
export const DOCKER_PULL_TIMEOUT_MS = 30 * 60_000
/** Install job: the tarball (~190 MiB) is streamed into the container and extracted. */
export const DOCKER_INSTALL_TIMEOUT_MS = 10 * 60_000
/** After stdin is closed (abort / time limit) the job gets this long to exit on its own. */
export const DOCKER_INSTALL_STOP_GRACE_MS = 15_000
/** CLAUDE.md: synchronous detect probes time out at 5s. */
const DETECT_TIMEOUT_MS = 5_000
/** Volume / exec calls (same as docker-lifecycle `IO_TIMEOUT_MS`). */
const IO_TIMEOUT_MS = 30_000
/** One-shot `docker run --rm` jobs (probe / restore / discard): container start can be slow. */
const JOB_TIMEOUT_MS = 120_000
/** `docker run -d` of the server container (the image is already pulled). */
const CREATE_TIMEOUT_MS = 120_000
/** Error text from docker / the scripts is cut to this many characters. */
const MAX_ERROR_CHARS = 2_000

// ─── child process injection (tests) ──────────────────────────────────────

let execFileImpl: (...args: any[]) => unknown = childProcess.execFile
let spawnImpl: (...args: any[]) => childProcess.ChildProcess = childProcess.spawn

export function setExecFileImplForTests(execFile: (...args: any[]) => unknown): void {
  execFileImpl = execFile
}

export function setSpawnImplForTests(spawn: (...args: any[]) => childProcess.ChildProcess): void {
  spawnImpl = spawn
}

export function resetChildProcessImplsForTests(): void {
  execFileImpl = childProcess.execFile
  spawnImpl = childProcess.spawn
}

interface ExecOutcome {
  /** `null` = success. */
  error: (Error & { code?: unknown; killed?: boolean }) | null
  stdout: string
  stderr: string
}

function execDocker(args: string[], timeoutMs: number): Promise<ExecOutcome> {
  return new Promise((resolve) => {
    execFileImpl(
      'docker',
      args,
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true, timeout: timeoutMs },
      (error: (Error & { code?: unknown; killed?: boolean }) | null, stdout: string, stderr: string) => {
        resolve({ error: error ?? null, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
      },
    )
  })
}

function clip(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > MAX_ERROR_CHARS ? `${trimmed.slice(0, MAX_ERROR_CHARS)}…` : trimmed
}

function outcomeError(outcome: ExecOutcome): string {
  return clip(outcome.stderr) || clip(outcome.stdout) || outcome.error?.message || 'docker failed'
}

/** Numeric exit code of a failed execFile (`code` is a string such as `ENOENT` when spawn failed). */
function exitCodeOf(outcome: ExecOutcome): number | null {
  if (!outcome.error) return 0
  return typeof outcome.error.code === 'number' ? outcome.error.code : null
}

// ─── whitelists ───────────────────────────────────────────────────────────

/** Docker's own limit for a full image reference is 255 characters. */
const MAX_IMAGE_REF_LENGTH = 255
const DOMAIN_COMPONENT = /^(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])$/
const PORT = /^[0-9]{1,5}$/
const PATH_COMPONENT = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/
const TAG = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/
const DIGEST = /^[A-Za-z][A-Za-z0-9]*(?:[-_+.][A-Za-z][A-Za-z0-9]*)*:[0-9a-fA-F]{32,}$/

function isRegistryDomain(value: string): boolean {
  const colon = value.indexOf(':')
  const host = colon >= 0 ? value.slice(0, colon) : value
  if (colon >= 0) {
    const port = value.slice(colon + 1)
    if (!PORT.test(port) || Number(port) < 1 || Number(port) > 65535) return false
  }
  return host.split('.').every((component) => DOMAIN_COMPONENT.test(component))
}

/**
 * Strict image reference check (docker's reference grammar, no IPv6 registry
 * hosts): `[registry[:port]/]path[/path…][:tag][@algo:hex]`. The first segment
 * is a registry only when it contains `.` or `:` or is `localhost` (docker's
 * rule); path components are lower case. A leading `-` (option injection),
 * whitespace, quotes and shell characters can never match.
 */
export function validateDockerImageRef(image: unknown): { ok: true } | { ok: false; error: string } {
  const invalid = { ok: false as const, error: `Invalid Docker image reference: ${JSON.stringify(image)}` }
  if (typeof image !== 'string' || image.length === 0 || image.length > MAX_IMAGE_REF_LENGTH) return invalid
  let rest = image
  const at = rest.indexOf('@')
  if (at >= 0) {
    if (!DIGEST.test(rest.slice(at + 1))) return invalid
    rest = rest.slice(0, at)
  }
  const lastSlash = rest.lastIndexOf('/')
  const lastColon = rest.lastIndexOf(':')
  if (lastColon > lastSlash) {
    if (!TAG.test(rest.slice(lastColon + 1))) return invalid
    rest = rest.slice(0, lastColon)
  }
  const segments = rest.split('/')
  if (segments.length > 1 && (segments[0].includes('.') || segments[0].includes(':') || segments[0] === 'localhost')) {
    if (!isRegistryDomain(segments.shift() as string)) return invalid
  }
  if (segments.length === 0 || !segments.every((segment) => PATH_COMPONENT.test(segment))) return invalid
  return { ok: true }
}

/** Docker volume names: `[a-zA-Z0-9][a-zA-Z0-9_.-]+` (also CLAUDE.md's `^[a-zA-Z0-9._-]+$`). */
const VOLUME_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/
const MAX_VOLUME_NAME_LENGTH = 255

export function validateDockerVolumeName(name: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof name !== 'string' || name.length > MAX_VOLUME_NAME_LENGTH || !VOLUME_NAME_PATTERN.test(name)) {
    return { ok: false, error: `Invalid Docker volume name: ${JSON.stringify(name)}` }
  }
  return { ok: true }
}

function validName(name: unknown): string | null {
  if (typeof name !== 'string') return 'Container name is required.'
  const result = validateContainerName(name)
  return result.ok ? null : result.error ?? `Invalid Docker container name: ${name}`
}

/** The two volumes of a BAT container: `bat-server-<name>-bundle` / `bat-server-<name>-data`. */
export function batVolumeNames(containerName: string): { bundle: string; data: string } {
  const error = validName(containerName)
  if (error) throw new Error(error)
  const names = { bundle: `bat-server-${containerName}-bundle`, data: `bat-server-${containerName}-data` }
  for (const volume of [names.bundle, names.data]) {
    const check = validateDockerVolumeName(volume)
    if (!check.ok) throw new Error(check.error)
  }
  return names
}

// ─── 1. docker pull ───────────────────────────────────────────────────────

export interface DockerPullProgress {
  /** Layers seen so far (`<id>: Pulling fs layer` / `Already exists` / …). */
  layers: number
  /** Layers finished (`Pull complete` / `Already exists` / `Download complete`). */
  completed: number
}

export type DockerPullErrorCode =
  | 'docker-image-invalid'
  | 'docker-image-not-found'
  | 'docker-pull-rate-limited'
  | 'docker-pull-failed'
  | 'docker-pull-timeout'
  | 'docker-pull-aborted'

export type DockerPullResult =
  | { ok: true; status: 'downloaded' | 'up-to-date' | 'unknown'; digest?: string }
  | { ok: false; errorCode: DockerPullErrorCode; error: string }

const LAYER_LINE = /^([0-9a-f]{12,64}): (.+)$/
/**
 * `Download complete` counts too: with the containerd image store (Docker 29, T0852 measured) the
 * config / index blobs only ever print `Download complete`, never `Pull complete`.
 */
const LAYER_DONE = /^(?:Pull complete|Already exists|Download complete)\b/

/**
 * Reads `docker pull` output (non-TTY, one status per line) into layer counts.
 * Pure; `feed` returns new progress only when a count changed.
 */
export class DockerPullProgressTracker {
  private readonly layers = new Set<string>()
  private readonly done = new Set<string>()
  digest: string | undefined
  status: 'downloaded' | 'up-to-date' | 'unknown' = 'unknown'

  feed(rawLine: string): DockerPullProgress | null {
    const line = rawLine.trim()
    if (!line) return null
    if (line.startsWith('Digest: ')) {
      this.digest = line.slice('Digest: '.length).trim()
      return null
    }
    if (line.startsWith('Status: ')) {
      if (/Downloaded newer image/i.test(line)) this.status = 'downloaded'
      else if (/up to date/i.test(line)) this.status = 'up-to-date'
      return null
    }
    const match = LAYER_LINE.exec(line)
    if (!match) return null
    const [, id, state] = match
    const before = this.layers.size * 100_000 + this.done.size
    this.layers.add(id)
    if (LAYER_DONE.test(state)) this.done.add(id)
    if (this.layers.size * 100_000 + this.done.size === before) return null
    return this.progress()
  }

  progress(): DockerPullProgress {
    return { layers: this.layers.size, completed: this.done.size }
  }
}

function classifyPullFailure(stderr: string): DockerPullErrorCode {
  const text = stderr.toLowerCase()
  if (text.includes('toomanyrequests') || text.includes('rate limit')) return 'docker-pull-rate-limited'
  if (
    text.includes('manifest unknown')
    || text.includes('not found')
    || text.includes('pull access denied')
    || text.includes('repository does not exist')
  ) return 'docker-image-not-found'
  return 'docker-pull-failed'
}

function splitLines(buffer: { rest: string }, chunk: string, onLine: (line: string) => void): void {
  const text = buffer.rest + chunk
  const parts = text.split(/\r\n|\r|\n/)
  buffer.rest = parts.pop() ?? ''
  for (const part of parts) onLine(part)
}

/**
 * `docker pull <image>`. Progress is layer counts only (`onProgress`). `signal`
 * (the wizard's step abort) and the time limit end the docker CLI; the daemon
 * cancels a pull whose client went away.
 */
export function pullImage(
  image: string,
  options: { signal?: AbortSignal; timeoutMs?: number; onProgress?: (progress: DockerPullProgress) => void } = {},
): Promise<DockerPullResult> {
  const check = validateDockerImageRef(image)
  if (!check.ok) return Promise.resolve({ ok: false, errorCode: 'docker-image-invalid', error: check.error })
  if (options.signal?.aborted) return Promise.resolve({ ok: false, errorCode: 'docker-pull-aborted', error: 'Docker image pull was cancelled.' })

  return new Promise((resolve) => {
    const tracker = new DockerPullProgressTracker()
    let stderr = ''
    let settled = false
    let stopReason: 'aborted' | 'timeout' | null = null
    const out = { rest: '' }

    let child: childProcess.ChildProcess
    try {
      child = spawnImpl('docker', ['pull', image], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      resolve({ ok: false, errorCode: 'docker-pull-failed', error: error instanceof Error ? error.message : String(error) })
      return
    }

    const finish = (result: DockerPullResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
      resolve(result)
    }
    const stop = (reason: 'aborted' | 'timeout') => {
      if (stopReason) return
      stopReason = reason
      try { child.kill() } catch { /* already gone */ }
    }
    const onAbort = () => stop('aborted')
    const timer = setTimeout(() => stop('timeout'), options.timeoutMs ?? DOCKER_PULL_TIMEOUT_MS)
    options.signal?.addEventListener('abort', onAbort, { once: true })

    const onLine = (line: string) => {
      const progress = tracker.feed(line)
      if (progress) options.onProgress?.(progress)
    }
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => splitLines(out, chunk, onLine))
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      if (stderr.length < MAX_ERROR_CHARS * 4) stderr += chunk
    })
    child.on('error', (error) => {
      finish({ ok: false, errorCode: 'docker-pull-failed', error: error.message })
    })
    child.on('close', (code) => {
      if (out.rest) onLine(out.rest)
      if (stopReason === 'aborted') {
        finish({ ok: false, errorCode: 'docker-pull-aborted', error: `Docker image pull of ${image} was cancelled.` })
        return
      }
      if (stopReason === 'timeout') {
        finish({ ok: false, errorCode: 'docker-pull-timeout', error: `Docker image pull of ${image} did not finish in time.` })
        return
      }
      if (code === 0) {
        finish({ ok: true, status: tracker.status, ...(tracker.digest ? { digest: tracker.digest } : {}) })
        return
      }
      finish({ ok: false, errorCode: classifyPullFailure(stderr), error: clip(stderr) || `docker pull exited with code ${code}` })
    })
  })
}

// ─── 2. daemon architecture ───────────────────────────────────────────────

export type DockerServerArchResult =
  | { ok: true; arch: ServerBundleArch; rawArch: string }
  | { ok: false; errorCode: 'docker-arch-failed' | 'docker-arch-unsupported' | 'docker-server-not-linux'; error: string; rawArch?: string }

/** `docker version` → `<os>/<arch>` of the daemon → `normalizeArch(…, 'docker-linux')`. Pure. */
export function parseDockerServerArch(stdout: string): DockerServerArchResult {
  const line = stdout.trim().split(/\r?\n/).pop()?.trim() ?? ''
  const slash = line.indexOf('/')
  if (slash <= 0) return { ok: false, errorCode: 'docker-arch-failed', error: `Unexpected docker version output: ${JSON.stringify(clip(line))}` }
  const os = line.slice(0, slash).toLowerCase()
  const rawArch = line.slice(slash + 1)
  if (os !== 'linux') {
    return {
      ok: false,
      errorCode: 'docker-server-not-linux',
      rawArch,
      error: `The Docker engine runs ${os} containers; BAT needs Linux containers. Switch Docker to Linux containers and retry.`,
    }
  }
  const arch = normalizeArch(rawArch, 'docker-linux')
  if (!arch) {
    return { ok: false, errorCode: 'docker-arch-unsupported', rawArch, error: `The Docker engine architecture ${rawArch} has no BAT server bundle (x86_64 / arm64 only).` }
  }
  return { ok: true, arch, rawArch }
}

export async function dockerServerArch(): Promise<DockerServerArchResult> {
  const outcome = await execDocker(['version', '--format', '{{.Server.Os}}/{{.Server.Arch}}'], DETECT_TIMEOUT_MS)
  if (outcome.error) return { ok: false, errorCode: 'docker-arch-failed', error: outcomeError(outcome) }
  return parseDockerServerArch(outcome.stdout)
}

// ─── 3. volumes ───────────────────────────────────────────────────────────

export type DockerVolumeErrorCode = 'docker-volume-invalid' | 'docker-volume-failed' | 'docker-volume-not-owned'

export type DockerCreateVolumeResult =
  /** `created: false` = it existed already (the wizard must not remove it on rollback); `batLabelled` = carries `bat.server=1`. */
  | { ok: true; volume: string; created: boolean; batLabelled: boolean }
  | { ok: false; errorCode: DockerVolumeErrorCode; error: string }

export type DockerRemoveVolumeResult =
  | { ok: true; volume: string; removed: boolean }
  | { ok: false; errorCode: DockerVolumeErrorCode; error: string }

function isNoSuchVolume(outcome: ExecOutcome): boolean {
  return /no such volume/i.test(`${outcome.stderr}\n${outcome.stdout}`)
}

/** Labels of an existing volume; `null` = no such volume; throws on other docker errors. */
async function volumeLabels(name: string): Promise<Record<string, string> | null> {
  const outcome = await execDocker(['volume', 'inspect', '--format', '{{json .Labels}}', name], DETECT_TIMEOUT_MS)
  if (outcome.error) {
    if (isNoSuchVolume(outcome)) return null
    throw new Error(outcomeError(outcome))
  }
  const text = outcome.stdout.trim()
  if (!text || text === 'null') return {}
  try {
    const parsed = JSON.parse(text) as unknown
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {}
  } catch {
    return {}
  }
}

/**
 * Create a BAT volume (`bat.server=1` + `bat.server.volume=<role>`) unless one
 * with that name exists. The wizard records `created` (ownership, T0444 rule)
 * and on rollback removes only volumes it created.
 */
export async function createBatVolume(name: string, role: BatVolumeRole): Promise<DockerCreateVolumeResult> {
  const check = validateDockerVolumeName(name)
  if (!check.ok) return { ok: false, errorCode: 'docker-volume-invalid', error: check.error }
  if (role !== 'bundle' && role !== 'data') return { ok: false, errorCode: 'docker-volume-invalid', error: `Invalid BAT volume role: ${JSON.stringify(role)}` }
  try {
    const existing = await volumeLabels(name)
    if (existing) return { ok: true, volume: name, created: false, batLabelled: existing[BAT_LABEL_KEY] === BAT_LABEL_VALUE }
  } catch (error) {
    return { ok: false, errorCode: 'docker-volume-failed', error: error instanceof Error ? error.message : String(error) }
  }
  const outcome = await execDocker(
    ['volume', 'create', '--label', BAT_SERVER_LABEL, '--label', `${BAT_VOLUME_ROLE_LABEL_KEY}=${role}`, name],
    IO_TIMEOUT_MS,
  )
  if (outcome.error) return { ok: false, errorCode: 'docker-volume-failed', error: outcomeError(outcome) }
  return { ok: true, volume: name, created: true, batLabelled: true }
}

/**
 * Remove a volume BAT created. A volume without `bat.server=1` is never
 * removed (`docker-volume-not-owned`); a missing one is `removed: false`.
 * No `-f`: a volume a container still uses stays (`docker-volume-failed`).
 */
export async function removeBatVolume(name: string): Promise<DockerRemoveVolumeResult> {
  const check = validateDockerVolumeName(name)
  if (!check.ok) return { ok: false, errorCode: 'docker-volume-invalid', error: check.error }
  let labels: Record<string, string> | null
  try {
    labels = await volumeLabels(name)
  } catch (error) {
    return { ok: false, errorCode: 'docker-volume-failed', error: error instanceof Error ? error.message : String(error) }
  }
  if (!labels) return { ok: true, volume: name, removed: false }
  if (labels[BAT_LABEL_KEY] !== BAT_LABEL_VALUE) {
    return { ok: false, errorCode: 'docker-volume-not-owned', error: `Docker volume ${name} was not created by BAT (no ${BAT_SERVER_LABEL} label); it was left in place.` }
  }
  const outcome = await execDocker(['volume', 'rm', name], IO_TIMEOUT_MS)
  if (outcome.error) {
    if (isNoSuchVolume(outcome)) return { ok: true, volume: name, removed: false }
    return { ok: false, errorCode: 'docker-volume-failed', error: outcomeError(outcome) }
  }
  return { ok: true, volume: name, removed: true }
}

// ─── 4. bundle install into the volume ────────────────────────────────────

/** Data dir line of the install job: the server runs as root, so 0700 keeps the token / cert dir private. */
const PREPARE_DATA_DIR = `mkdir -p ${BAT_CONTAINER_DATA_DIR} && chmod 700 ${BAT_CONTAINER_DATA_DIR} || exit 1`

/**
 * The install job's `sh -c` script: optional data dir preparation, then the
 * shared T0552 / T0554 install (`buildSshBundleInstallCommand`, tarball on
 * stdin) for root `/opt/bat/server`. Pure.
 */
export function buildDockerBundleInstallScript(options: { keepPrevious?: boolean; prepareDataDir?: boolean } = {}): string {
  const root = assertBundleInstallRoot(BAT_BUNDLE_ROOT)
  return [
    ...(options.prepareDataDir ? [PREPARE_DATA_DIR] : []),
    buildSshBundleInstallCommand(root, { keepPrevious: options.keepPrevious === true }),
  ].join('\n')
}

/**
 * `docker run --rm` arguments of a one-shot job on the base image: no network,
 * root, `/bin/sh` as entrypoint (so the image's own ENTRYPOINT never runs).
 * Pure; `volumes` are `[name, mountPoint, 'ro'?]`.
 */
export function buildBundleJobArgs(options: {
  image: string
  volumes: Array<{ name: string; target: string; readOnly?: boolean }>
  script: string
  scriptArgs?: string[]
  interactive?: boolean
  jobName?: string
}): string[] {
  const image = validateDockerImageRef(options.image)
  if (!image.ok) throw new Error(image.error)
  const args = ['run', '--rm']
  if (options.interactive) args.push('-i')
  if (options.jobName) {
    const name = validName(options.jobName)
    if (name) throw new Error(name)
    args.push('--name', options.jobName)
  }
  args.push('--network', 'none', '--user', BAT_CONTAINER_USER)
  for (const volume of options.volumes) {
    const check = validateDockerVolumeName(volume.name)
    if (!check.ok) throw new Error(check.error)
    args.push('-v', `${volume.name}:${volume.target}${volume.readOnly ? ':ro' : ''}`)
  }
  args.push('--entrypoint', '/bin/sh', options.image, '-c', options.script, 'sh', ...(options.scriptArgs ?? []))
  return args
}

export type DockerInstallBundleErrorCode =
  | 'docker-install-invalid'
  | 'docker-install-failed'
  | 'docker-install-timeout'
  | 'docker-install-aborted'

export type DockerInstallBundleResult =
  | { ok: true; installPath: string; previous: BundleInstallPrevious }
  /** `previous`: set when the swap already happened before the abort / failure was seen (rollback restores it). */
  | { ok: false; errorCode: DockerInstallBundleErrorCode; error: string; aborted?: boolean; previous?: BundleInstallPrevious }

/**
 * Install a server bundle tarball into the bundle volume:
 * `docker run --rm -i --network none --user 0:0 -v <bundle>:/opt/bat [-v <data>:/var/lib/bat-server]
 *   --entrypoint /bin/sh <image> -c <install script>` with the tarball piped to stdin.
 * `keepPrevious` keeps the replaced install at `/opt/bat/server.bat-old` for
 * `restoreBundleInVolume` / `discardPreviousBundleInVolume` (T0554).
 *
 * Abort / time limit close stdin, never kill mid-script: tar then fails on the
 * truncated archive and the script removes `.bat-new`, leaving the previous
 * install untouched (the same promise as the WSL install, T0830). Only a job
 * that is still running after `DOCKER_INSTALL_STOP_GRACE_MS` is killed and its
 * container removed.
 */
export function installBundleIntoVolume(options: {
  image: string
  bundleVolume: string
  dataVolume?: string
  tarballPath: string
  keepPrevious?: boolean
  signal?: AbortSignal
  timeoutMs?: number
  stopGraceMs?: number
}): Promise<DockerInstallBundleResult> {
  const invalid = (error: string): Promise<DockerInstallBundleResult> => Promise.resolve({ ok: false, errorCode: 'docker-install-invalid', error })
  if (typeof options.tarballPath !== 'string' || !path.isAbsolute(options.tarballPath)) return invalid('Server bundle tarball path must be absolute.')
  try {
    if (!fs.statSync(options.tarballPath).isFile()) return invalid('Server bundle tarball is not a file.')
  } catch {
    return invalid('Server bundle tarball does not exist.')
  }
  const jobName = `bat-bundle-job-${randomBytes(6).toString('hex')}`
  let args: string[]
  try {
    args = buildBundleJobArgs({
      image: options.image,
      volumes: [
        { name: options.bundleVolume, target: BAT_BUNDLE_VOLUME_MOUNT },
        ...(options.dataVolume !== undefined ? [{ name: options.dataVolume, target: BAT_CONTAINER_DATA_DIR }] : []),
      ],
      script: buildDockerBundleInstallScript({ keepPrevious: options.keepPrevious, prepareDataDir: options.dataVolume !== undefined }),
      interactive: true,
      jobName,
    })
  } catch (error) {
    return invalid(error instanceof Error ? error.message : String(error))
  }
  if (options.signal?.aborted) {
    return Promise.resolve({ ok: false, errorCode: 'docker-install-aborted', error: 'Server bundle install was cancelled.', aborted: true })
  }

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    let stopReason: 'aborted' | 'timeout' | null = null
    let readError: string | null = null
    let graceTimer: NodeJS.Timeout | undefined

    let child: childProcess.ChildProcess
    try {
      child = spawnImpl('docker', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (error) {
      resolve({ ok: false, errorCode: 'docker-install-failed', error: error instanceof Error ? error.message : String(error) })
      return
    }
    const tarball = fs.createReadStream(options.tarballPath)

    const closeInput = () => {
      tarball.unpipe()
      tarball.destroy()
      try { child.stdin?.end() } catch { /* already closed */ }
    }
    const finish = (result: DockerInstallBundleResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (graceTimer) clearTimeout(graceTimer)
      options.signal?.removeEventListener('abort', onAbort)
      resolve(result)
    }
    const stop = (reason: 'aborted' | 'timeout') => {
      if (stopReason) return
      stopReason = reason
      closeInput()
      graceTimer = setTimeout(() => {
        try { child.kill() } catch { /* already gone */ }
        void execDocker(['rm', '-f', jobName], IO_TIMEOUT_MS)
      }, options.stopGraceMs ?? DOCKER_INSTALL_STOP_GRACE_MS)
    }
    const onAbort = () => stop('aborted')
    const timer = setTimeout(() => stop('timeout'), options.timeoutMs ?? DOCKER_INSTALL_TIMEOUT_MS)
    options.signal?.addEventListener('abort', onAbort, { once: true })

    child.stdin?.on('error', () => { /* EPIPE once the job exits early; its exit code tells the story */ })
    tarball.on('error', (error) => {
      readError = error.message
      closeInput()
    })
    if (child.stdin) tarball.pipe(child.stdin)

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => { if (stdout.length < 64 * 1024) stdout += chunk })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => { if (stderr.length < 64 * 1024) stderr += chunk })
    child.on('error', (error) => {
      closeInput()
      finish({ ok: false, errorCode: 'docker-install-failed', error: error.message })
    })
    child.on('close', (code) => {
      closeInput()
      const previous = parseBundleInstallPrevious(stdout) ?? undefined
      if (stopReason) {
        const aborted = stopReason === 'aborted'
        finish({
          ok: false,
          errorCode: aborted ? 'docker-install-aborted' : 'docker-install-timeout',
          error: aborted ? 'Server bundle install was cancelled.' : 'Server bundle install did not finish in time.',
          ...(aborted ? { aborted: true } : {}),
          ...(previous ? { previous } : {}),
        })
        return
      }
      if (readError) {
        finish({ ok: false, errorCode: 'docker-install-failed', error: `Could not read the server bundle tarball: ${readError}`, ...(previous ? { previous } : {}) })
        return
      }
      if (code === 0 && previous) {
        finish({ ok: true, installPath: BAT_BUNDLE_ROOT, previous })
        return
      }
      finish({
        ok: false,
        errorCode: 'docker-install-failed',
        error: clip(stderr) || clip(stdout) || `Server bundle install exited with code ${code}.`,
        ...(previous ? { previous } : {}),
      })
    })
  })
}

export type DockerBundleJobResult<T> =
  | ({ ok: true } & T)
  | { ok: false; errorCode: 'docker-install-invalid' | 'docker-install-failed'; error: string }

async function runBundleJob(image: string, bundleVolume: string, script: string): Promise<{ outcome: ExecOutcome } | { invalid: string }> {
  let args: string[]
  try {
    args = buildBundleJobArgs({ image, volumes: [{ name: bundleVolume, target: BAT_BUNDLE_VOLUME_MOUNT }], script })
  } catch (error) {
    return { invalid: error instanceof Error ? error.message : String(error) }
  }
  return { outcome: await execDocker(args, JOB_TIMEOUT_MS) }
}

/** T0554 cancel path: put `/opt/bat/server.bat-old` back (`restored`) or report `missing`. */
export async function restoreBundleInVolume(options: { image: string; bundleVolume: string }): Promise<DockerBundleJobResult<{ outcome: BundleRestoreOutcome }>> {
  const run = await runBundleJob(options.image, options.bundleVolume, buildSshBundleRestoreCommand(assertBundleInstallRoot(BAT_BUNDLE_ROOT)))
  if ('invalid' in run) return { ok: false, errorCode: 'docker-install-invalid', error: run.invalid }
  const outcome = parseBundleRestoreOutcome(run.outcome.stdout)
  if (run.outcome.error || !outcome) return { ok: false, errorCode: 'docker-install-failed', error: outcomeError(run.outcome) }
  return { ok: true, outcome }
}

/** T0554 finish path: remove `/opt/bat/server.bat-old` (whitelist rule of the shared script). */
export async function discardPreviousBundleInVolume(options: { image: string; bundleVolume: string }): Promise<DockerBundleJobResult<Record<never, never>>> {
  const run = await runBundleJob(options.image, options.bundleVolume, buildSshBundleDiscardPreviousCommand(assertBundleInstallRoot(BAT_BUNDLE_ROOT)))
  if ('invalid' in run) return { ok: false, errorCode: 'docker-install-invalid', error: run.invalid }
  if (run.outcome.error) return { ok: false, errorCode: 'docker-install-failed', error: outcomeError(run.outcome) }
  return { ok: true }
}

// ─── 5. compatibility probe ───────────────────────────────────────────────

export const COMPAT_MARKER_PREFIX = 'BAT_PROBE_'

/**
 * Probe script (`sh -c <script> sh [node]`): tools, libc, and with `node` the
 * bundle's runtime. Prints `BAT_PROBE_*=` lines only; always exits 0.
 */
export function buildCompatProbeScript(): string {
  return [
    'missing=""',
    'for t in tar gzip; do command -v "$t" >/dev/null 2>&1 || missing="$missing $t"; done',
    'echo "BAT_PROBE_MISSING=$missing"',
    'libc=unknown',
    'if [ -e /etc/alpine-release ] || ls /lib/ld-musl-* >/dev/null 2>&1; then libc=musl; fi',
    'v=$(getconf GNU_LIBC_VERSION 2>/dev/null) && case "$v" in "glibc "*) libc=glibc; echo "BAT_PROBE_GLIBC=${v#glibc }";; esac',
    'echo "BAT_PROBE_LIBC=$libc"',
    'if [ "$1" = node ]; then',
    `  if [ -f ${BAT_BUNDLE_NODE_BIN} ]; then`,
    `    out=$(${BAT_BUNDLE_NODE_BIN} -e 1 2>&1); rc=$?`,
    '    echo "BAT_PROBE_NODE=$rc"',
    '    printf "%s\\n" "$out" | head -n 3 | while IFS= read -r line; do echo "BAT_PROBE_NODE_ERR=$line"; done',
    '  else echo "BAT_PROBE_NODE=missing"; fi',
    'fi',
    'exit 0',
  ].join('\n')
}

export type DockerCompatErrorCode =
  | 'docker-compat-no-shell'
  | 'docker-compat-missing-tools'
  | 'docker-compat-musl'
  | 'docker-compat-glibc-too-old'
  | 'docker-compat-bundle-missing'
  | 'docker-compat-node-failed'
  | 'docker-compat-probe-failed'

export type DockerCompatResult =
  | { ok: true; libc: 'glibc' | 'musl' | 'unknown'; glibcVersion?: string; nodeChecked: boolean }
  | { ok: false; errorCode: DockerCompatErrorCode; error: string; libc?: 'glibc' | 'musl' | 'unknown'; glibcVersion?: string; missing?: string[] }

function compareVersion(version: string, min: readonly [number, number]): number | null {
  const match = /^(\d+)\.(\d+)/.exec(version)
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  return major !== min[0] ? major - min[0] : minor - min[1]
}

/**
 * Classify a probe run. Pure. Order: no shell → missing tar / gzip → musl →
 * glibc older than `BUNDLE_GLIBC_MIN` → bundle missing / node failing.
 * `exitCode` is docker's: 126 / 127 = the entrypoint (`/bin/sh`) could not run.
 */
export function classifyCompatProbe(input: { exitCode: number | null; stdout: string; stderr: string; checkedNode: boolean }): DockerCompatResult {
  const markers = new Map<string, string[]>()
  for (const raw of input.stdout.split(/\r?\n/)) {
    const line = raw.replace(/\r$/, '')
    if (!line.startsWith(COMPAT_MARKER_PREFIX)) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(COMPAT_MARKER_PREFIX.length, eq)
    markers.set(key, [...(markers.get(key) ?? []), line.slice(eq + 1)])
  }
  const minText = `${BUNDLE_GLIBC_MIN[0]}.${BUNDLE_GLIBC_MIN[1]}`
  if (!markers.has('LIBC')) {
    if (input.exitCode === 126 || input.exitCode === 127) {
      return { ok: false, errorCode: 'docker-compat-no-shell', error: 'The base image has no /bin/sh; BAT needs /bin/sh, tar and gzip in the image.' }
    }
    return { ok: false, errorCode: 'docker-compat-probe-failed', error: clip(input.stderr) || clip(input.stdout) || 'The compatibility probe produced no result.' }
  }
  const libcValue = markers.get('LIBC')?.[0]
  const libc = libcValue === 'glibc' || libcValue === 'musl' ? libcValue : 'unknown'
  const glibcVersion = markers.get('GLIBC')?.[0]?.trim() || undefined
  const facts = { libc, ...(glibcVersion ? { glibcVersion } : {}) } as const
  const missing = (markers.get('MISSING')?.[0] ?? '').split(/\s+/).filter(Boolean)
  if (missing.length > 0) {
    return { ok: false, errorCode: 'docker-compat-missing-tools', ...facts, missing, error: `The base image is missing ${missing.join(', ')}; BAT needs /bin/sh, tar and gzip in the image.` }
  }
  if (libc === 'musl') {
    return { ok: false, errorCode: 'docker-compat-musl', ...facts, error: `The base image uses musl libc (for example Alpine); the BAT server bundle needs glibc ${minText} or newer. Choose a Debian / Ubuntu based image.` }
  }
  const nodeExit = markers.get('NODE')?.[0]
  const nodeErrors = (markers.get('NODE_ERR') ?? []).join('\n')
  const tooOld = glibcVersion !== undefined && (compareVersion(glibcVersion, BUNDLE_GLIBC_MIN) ?? 0) < 0
  const glibcError = {
    ok: false as const,
    errorCode: 'docker-compat-glibc-too-old' as const,
    ...facts,
    error: `The base image has glibc ${glibcVersion ?? '(older)'}; the BAT server bundle needs glibc ${minText} or newer. Choose a newer image (for example Debian 12 / Ubuntu 22.04 or later).`,
  }
  if (input.checkedNode) {
    if (nodeExit === '0') return { ok: true, ...facts, nodeChecked: true }
    if (nodeExit === 'missing') {
      return { ok: false, errorCode: 'docker-compat-bundle-missing', ...facts, error: `The bundle volume has no ${BAT_BUNDLE_NODE_BIN}; install the server bundle first.` }
    }
    if (tooOld || /GLIBC_[0-9.]+'? not found/.test(nodeErrors)) return glibcError
    if (nodeExit === undefined) {
      return { ok: false, errorCode: 'docker-compat-probe-failed', ...facts, error: clip(input.stderr) || 'The compatibility probe did not run the bundled node.' }
    }
    return { ok: false, errorCode: 'docker-compat-node-failed', ...facts, error: `The bundled node does not run in this image (exit ${nodeExit})${nodeErrors ? `: ${clip(nodeErrors)}` : '.'}` }
  }
  if (tooOld) return glibcError
  return { ok: true, ...facts, nodeChecked: false }
}

/**
 * Probe a base image: `/bin/sh`, `tar`, `gzip`, musl / glibc. With
 * `bundleVolume` (after the install) also `/opt/bat/server/bin/node -e 1`,
 * with the volume mounted read-only.
 */
export async function probeBundleCompat(options: { image: string; bundleVolume?: string }): Promise<DockerCompatResult> {
  let args: string[]
  try {
    args = buildBundleJobArgs({
      image: options.image,
      volumes: options.bundleVolume !== undefined ? [{ name: options.bundleVolume, target: BAT_BUNDLE_VOLUME_MOUNT, readOnly: true }] : [],
      script: buildCompatProbeScript(),
      scriptArgs: options.bundleVolume !== undefined ? ['node'] : [],
    })
  } catch (error) {
    return { ok: false, errorCode: 'docker-compat-probe-failed', error: error instanceof Error ? error.message : String(error) }
  }
  const outcome = await execDocker(args, JOB_TIMEOUT_MS)
  return classifyCompatProbe({ exitCode: exitCodeOf(outcome), stdout: outcome.stdout, stderr: outcome.stderr, checkedNode: options.bundleVolume !== undefined })
}

// ─── 6. the server container ──────────────────────────────────────────────

/**
 * Container health check: a TLS handshake with the bundled node (the server
 * has no HTTP routes) — the probe of docker/Dockerfile `HEALTHCHECK`, with the
 * port fixed to the in-container `--port` (the base image has no
 * `BAT_SERVER_PORT`).
 */
export const BAT_CONTAINER_HEALTH_CMD = `${BAT_BUNDLE_NODE_BIN} -e 'const s=require("tls").connect({host:"127.0.0.1",port:${BAT_CONTAINER_SERVER_PORT},rejectUnauthorized:false},()=>{s.end();process.exit(0)});s.setTimeout(4000,()=>process.exit(1));s.on("error",()=>process.exit(1))' || exit 1`

/**
 * `docker run -d` arguments of a BAT server container on a base image (D283 (c′)). Pure; throws on
 * invalid input. Publishes on `DOCKER_PUBLISH_HOST` only (BUG-097), never `--token` (U5), root +
 * `--data-dir /var/lib/bat-server` (U4), label `bat.server=1` (T0849).
 */
export function buildBatContainerRunArgs(name: string, options: {
  image: string
  port: number
  bundleVolume: string
  dataVolume: string
  mounts?: DockerMount[]
  restartPolicy?: 'unless-stopped' | 'always' | 'no' | 'on-failure'
}): string[] {
  const nameError = validName(name)
  if (nameError) throw new Error(nameError)
  const image = validateDockerImageRef(options.image)
  if (!image.ok) throw new Error(image.error)
  for (const volume of [options.bundleVolume, options.dataVolume]) {
    const check = validateDockerVolumeName(volume)
    if (!check.ok) throw new Error(check.error)
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error(`Invalid host port: ${JSON.stringify(options.port)}`)
  }
  const restart = options.restartPolicy ?? 'unless-stopped'
  if (!['unless-stopped', 'always', 'no', 'on-failure'].includes(restart)) throw new Error(`Invalid restart policy: ${JSON.stringify(restart)}`)

  const args = [
    'run', '-d', '--name', name,
    '--init',
    '--user', BAT_CONTAINER_USER,
    '--restart', restart,
    '--label', BAT_SERVER_LABEL,
    '--entrypoint', BAT_BUNDLE_SERVER_BIN,
    '--health-cmd', BAT_CONTAINER_HEALTH_CMD,
    '--health-interval', '30s',
    '--health-timeout', '5s',
    '--health-start-period', '10s',
    '--health-retries', '3',
    '-e', 'NODE_ENV=production',
    // BUG-097: host loopback only; the server binds all container interfaces (`--bind-interface all`).
    '-p', `${DOCKER_PUBLISH_HOST}:${options.port}:${BAT_CONTAINER_SERVER_PORT}`,
    '-v', `${options.bundleVolume}:${BAT_BUNDLE_VOLUME_MOUNT}`,
    '-v', `${options.dataVolume}:${BAT_CONTAINER_DATA_DIR}`,
  ]
  for (const mount of options.mounts ?? []) {
    if (typeof mount?.host !== 'string' || !mount.host.trim() || typeof mount.container !== 'string' || !mount.container.startsWith('/')) {
      throw new Error('Invalid bind mount (host path and an absolute container path are required).')
    }
    args.push('-v', `${mount.host}:${mount.container}`)
  }
  args.push(
    options.image,
    '--bind-interface', 'all',
    '--port', String(BAT_CONTAINER_SERVER_PORT),
    '--data-dir', BAT_CONTAINER_DATA_DIR,
  )
  return args
}

/** `docker run -d` with `buildBatContainerRunArgs`; the arguments are never logged or returned. */
export async function createBatContainer(
  name: string,
  options: Parameters<typeof buildBatContainerRunArgs>[1],
): Promise<{ ok: true } | { ok: false; error: string }> {
  let args: string[]
  try {
    args = buildBatContainerRunArgs(name, options)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  const outcome = await execDocker(args, CREATE_TIMEOUT_MS)
  if (outcome.error) return { ok: false, error: outcomeError(outcome) }
  return { ok: true }
}

// ─── 7. docker exec (wizard rollback) ─────────────────────────────────────

/**
 * `docker.execCommand` (T0289 type, implemented by T0852). Not a general exec:
 * the only command allowed is the install-server-bundle rollback's
 * `rm -rf <bundle install root>`, with the root passing
 * `assertBundleInstallRoot`. Anything else is refused without running docker.
 */
export async function execContainerCommand(name: string, command: unknown): Promise<{ ok: true; stdout?: string } | { ok: false; error: string }> {
  const nameError = validName(name)
  if (nameError) return { ok: false, error: nameError }
  const allowed = Array.isArray(command)
    && command.length === 3
    && command[0] === 'rm'
    && command[1] === '-rf'
    && typeof command[2] === 'string'
  if (!allowed) return { ok: false, error: 'docker exec: only removing a BAT server bundle install path is allowed.' }
  let root: string
  try {
    root = assertBundleInstallRoot(command[2])
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  // No shell runs it, but keep the path to plain characters anyway.
  if (!/^[A-Za-z0-9._/-]+$/.test(root)) return { ok: false, error: `docker exec: unexpected characters in ${JSON.stringify(root)}.` }
  const outcome = await execDocker(['exec', name, 'rm', '-rf', '--', root], IO_TIMEOUT_MS)
  if (outcome.error) return { ok: false, error: outcomeError(outcome) }
  return { ok: true, stdout: outcome.stdout.trim() }
}

// ─── 8. certificate fingerprint ───────────────────────────────────────────

/**
 * SHA-256 of a PEM certificate's DER bytes as `AA:BB:…` — the format of
 * electron/remote/certificate.ts `computeFingerprint` and of the TLS handshake
 * (`getPeerCertificate().fingerprint256`). Kept here so this module does not
 * pull in selfsigned / the logger.
 */
export function pemCertificateFingerprint(certPem: string): string | null {
  const match = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/.exec(certPem)
  if (!match) return null
  const der = Buffer.from(match[1].replace(/\s+/g, ''), 'base64')
  if (der.length === 0) return null
  const hex = createHash('sha256').update(der).digest('hex').toUpperCase()
  return (hex.match(/.{2}/g) as string[]).join(':')
}

export type DockerCertFingerprintResult =
  | { ok: true; fingerprint: string }
  | { ok: false; errorCode: 'docker-cert-unavailable' | 'docker-inspect-failed'; error: string }

/**
 * T0851 option 6: fingerprint of the container's `<dataDir>/server-cert.json`
 * (`{ cert, key, fingerprint, expiresAt }`, written 0600 by FileCertificateProvider;
 * dataDir as `resolveServerTokenPath`). Computed from `cert`, not the stored
 * `fingerprint`. Only the fingerprint leaves this function — never the
 * certificate or the private key.
 */
export async function readServerCertFingerprint(name: string): Promise<DockerCertFingerprintResult> {
  const nameError = validName(name)
  if (nameError) return { ok: false, errorCode: 'docker-inspect-failed', error: nameError }
  const inspect = await execDocker(['inspect', '--type', 'container', name], DETECT_TIMEOUT_MS)
  if (inspect.error) return { ok: false, errorCode: 'docker-inspect-failed', error: outcomeError(inspect) }
  let entry: Record<string, any> | null = null
  try {
    const parsed = JSON.parse(inspect.stdout) as unknown
    entry = (Array.isArray(parsed) ? parsed[0] : null) as Record<string, any> | null
  } catch {
    entry = null
  }
  if (!entry || typeof entry !== 'object') return { ok: false, errorCode: 'docker-inspect-failed', error: `No inspect data for container ${name}.` }
  const certPath = path.posix.join(path.posix.dirname(resolveServerTokenPath(entry)), 'server-cert.json')
  const read = await execDocker(['exec', name, 'cat', certPath], IO_TIMEOUT_MS)
  let fingerprint: string | null = null
  if (!read.error) {
    try {
      const persisted = JSON.parse(read.stdout) as { cert?: unknown }
      if (typeof persisted.cert === 'string') fingerprint = pemCertificateFingerprint(persisted.cert)
    } catch {
      fingerprint = null
    }
  }
  if (!fingerprint) {
    return { ok: false, errorCode: 'docker-cert-unavailable', error: `Docker container ${name}: ${certPath} is missing or unreadable.` }
  }
  return { ok: true, fingerprint }
}

// ─── 9. image with a baked-in bundle (T0853, D283 U3) ─────────────────────

/** Where docker/Dockerfile puts the server (`bat-server:latest`, the advanced path, U3). */
export const BAKED_BUNDLE_SERVER_BIN = '/opt/bat-server/bin/bat-server'

export type DockerImageBakedBundleResult =
  /** `reason`: where the baked server was found (`entrypoint` / `cmd`), or `none`. */
  | { ok: true; baked: boolean; reason: 'entrypoint' | 'cmd' | 'none' }
  | { ok: false; errorCode: 'docker-image-invalid' | 'docker-image-inspect-failed'; error: string }

function mentionsBakedServer(value: unknown): boolean {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  return parts.some((part) => typeof part === 'string' && part.includes(BAKED_BUNDLE_SERVER_BIN))
}

/**
 * T0853 (Q-2): does the image's own `ENTRYPOINT` or `CMD` start the baked-in
 * server (`/opt/bat-server/bin/bat-server`, docker/Dockerfile)? Pure; reads the
 * `Config` of `docker image inspect`. The image name plays no part.
 */
export function classifyImageBakedBundle(config: { Entrypoint?: unknown; Cmd?: unknown } | null | undefined): { baked: boolean; reason: 'entrypoint' | 'cmd' | 'none' } {
  if (mentionsBakedServer(config?.Entrypoint)) return { baked: true, reason: 'entrypoint' }
  if (mentionsBakedServer(config?.Cmd)) return { baked: true, reason: 'cmd' }
  return { baked: false, reason: 'none' }
}

/**
 * T0853 (Q-2): `docker image inspect <image>` (the wizard calls it after the
 * pull, so the image is local) → whether it already contains the BAT server
 * bundle. Returns a boolean and a reason code only.
 */
export async function inspectImageBakedBundle(image: string): Promise<DockerImageBakedBundleResult> {
  const check = validateDockerImageRef(image)
  if (!check.ok) return { ok: false, errorCode: 'docker-image-invalid', error: check.error }
  const outcome = await execDocker(['image', 'inspect', image], DETECT_TIMEOUT_MS)
  if (outcome.error) return { ok: false, errorCode: 'docker-image-inspect-failed', error: outcomeError(outcome) }
  let config: { Entrypoint?: unknown; Cmd?: unknown } | null = null
  try {
    const parsed = JSON.parse(outcome.stdout) as unknown
    const entry = Array.isArray(parsed) ? parsed[0] as Record<string, unknown> | undefined : undefined
    config = entry && typeof entry.Config === 'object' ? entry.Config as { Entrypoint?: unknown; Cmd?: unknown } : null
  } catch {
    return { ok: false, errorCode: 'docker-image-inspect-failed', error: `No inspect data for image ${image}.` }
  }
  return { ok: true, ...classifyImageBakedBundle(config) }
}

// ─── 10. bundle version in the volume (T0853, Q-3) ────────────────────────

export const BUNDLE_VERSION_MARKER = 'BAT_BUNDLE_VERSION='
const BUNDLE_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/

/** Job script: the `version` of `/opt/bat/server/package.json` (scripts/build-server-bundle.mjs), one marker line. */
export function buildBundleVersionScript(): string {
  return [
    `f=${BAT_BUNDLE_ROOT}/package.json`,
    // `  "version": "0.7.4"` → 4th `"`-separated field (versionManifestContent writes one key per line).
    `if [ -f "$f" ]; then v=$(grep '"version"' "$f" | head -n 1 | cut -d '"' -f 4); echo "${BUNDLE_VERSION_MARKER}$v"; else echo "${BUNDLE_VERSION_MARKER}"; fi`,
    'exit 0',
  ].join('\n')
}

/** Pure: the version from the job's stdout, or `null` (no file, no version, odd value). */
export function parseBundleVersion(stdout: string): string | null {
  for (const raw of stdout.split(/\r?\n/)) {
    if (!raw.startsWith(BUNDLE_VERSION_MARKER)) continue
    const value = raw.slice(BUNDLE_VERSION_MARKER.length).trim()
    return BUNDLE_VERSION_PATTERN.test(value) ? value : null
  }
  return null
}

export type DockerBundleVersionResult =
  /** `version: null` = no readable version (the wizard then treats the bundle as needing an upgrade). */
  | { ok: true; version: string | null }
  | { ok: false; errorCode: 'docker-install-invalid' | 'docker-install-failed'; error: string }

/**
 * T0853 (Q-3): the server bundle version installed in a bundle volume, read by
 * a one-shot job on the container's image with the volume mounted read-only
 * (works whether the container runs or not).
 */
export async function readBundleVersionInVolume(options: { image: string; bundleVolume: string }): Promise<DockerBundleVersionResult> {
  let args: string[]
  try {
    args = buildBundleJobArgs({
      image: options.image,
      volumes: [{ name: options.bundleVolume, target: BAT_BUNDLE_VOLUME_MOUNT, readOnly: true }],
      script: buildBundleVersionScript(),
    })
  } catch (error) {
    return { ok: false, errorCode: 'docker-install-invalid', error: error instanceof Error ? error.message : String(error) }
  }
  const outcome = await execDocker(args, JOB_TIMEOUT_MS)
  if (outcome.error) return { ok: false, errorCode: 'docker-install-failed', error: outcomeError(outcome) }
  return { ok: true, version: parseBundleVersion(outcome.stdout) }
}
