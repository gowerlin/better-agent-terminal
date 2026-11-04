/**
 * T0852 (PLAN-052 W4a, D283 (c′)): main-side docker primitives for the
 * base image + server bundle volume container. execFile / spawn are injected —
 * no real docker runs here (the real-docker run is in the T0852 report).
 */
import { spawnSync } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { PassThrough, Writable } from 'stream'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { computeFingerprint, generateSelfSignedCert, type CertificateBundle } from '../remote/certificate'
import { buildSshBundleInstallCommand } from '../server-bundle-install-script'
import {
  BAKED_BUNDLE_SERVER_BIN,
  BAT_BUNDLE_ROOT,
  BAT_CONTAINER_DATA_DIR,
  BAT_CONTAINER_HEALTH_CMD,
  DockerPullProgressTracker,
  batVolumeNames,
  buildBundleVersionScript,
  classifyImageBakedBundle,
  inspectImageBakedBundle,
  parseBundleVersion,
  readBundleVersionInVolume,
  buildBatContainerRunArgs,
  buildCompatProbeScript,
  buildDockerBundleInstallScript,
  classifyCompatProbe,
  createBatContainer,
  createBatVolume,
  discardPreviousBundleInVolume,
  dockerServerArch,
  execContainerCommand,
  installBundleIntoVolume,
  parseDockerServerArch,
  pemCertificateFingerprint,
  probeBundleCompat,
  pullImage,
  readServerCertFingerprint,
  removeBatVolume,
  resetChildProcessImplsForTests,
  restoreBundleInVolume,
  setExecFileImplForTests,
  setSpawnImplForTests,
  validateDockerImageRef,
  validateDockerVolumeName,
} from '../docker-bundle-volume'

// ─── fakes ────────────────────────────────────────────────────────────────

interface ExecCall {
  file: string
  args: string[]
  options: { timeout?: number }
}

type ExecReply = { error?: (Error & { code?: unknown }) | null; stdout?: string; stderr?: string }

function installExec(reply: (args: string[]) => ExecReply = () => ({})): ExecCall[] {
  const calls: ExecCall[] = []
  setExecFileImplForTests((file: string, args: string[], options: { timeout?: number }, callback: (...cbArgs: unknown[]) => void) => {
    calls.push({ file, args, options })
    const result = reply(args)
    callback(result.error ?? null, result.stdout ?? '', result.stderr ?? '')
  })
  return calls
}

function execError(message: string, code: unknown = 1): Error & { code?: unknown } {
  return Object.assign(new Error(message), { code })
}

class FakeChild extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  stdinChunks: Buffer[] = []
  stdinEnded = false
  killed = 0
  stdin: Writable
  constructor() {
    super()
    this.stdin = new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        this.stdinChunks.push(Buffer.from(chunk))
        callback()
      },
      final: (callback) => {
        this.stdinEnded = true
        this.emit('stdin-ended')
        callback()
      },
    })
  }
  kill(): boolean {
    this.killed += 1
    this.emit('killed')
    return true
  }
  /** Flush stdout / stderr, then emit close. */
  exit(code: number, stdout = '', stderr = ''): void {
    if (stdout) this.stdout.write(stdout)
    if (stderr) this.stderr.write(stderr)
    this.stdout.end()
    this.stderr.end()
    setTimeout(() => this.emit('close', code), 5)
  }
}

interface SpawnCall {
  file: string
  args: string[]
  child: FakeChild
}

function installSpawn(onSpawn: (child: FakeChild, args: string[]) => void): SpawnCall[] {
  const calls: SpawnCall[] = []
  setSpawnImplForTests(((file: string, args: string[]) => {
    const child = new FakeChild()
    calls.push({ file, args, child })
    setTimeout(() => onSpawn(child, args), 0)
    return child
  }) as never)
  return calls
}

/** Run `fn` once the job's stdin is closed (it may already be). */
function onStdinEnded(child: FakeChild, fn: () => void): void {
  if (child.stdinEnded) fn()
  else child.once('stdin-ended', fn)
}

function valuesOf(args: string[], flag: string): string[] {
  return args.flatMap((arg, index) => (arg === flag ? [args[index + 1]] : []))
}

afterEach(() => {
  resetChildProcessImplsForTests()
})

// ─── whitelists ───────────────────────────────────────────────────────────

describe('validateDockerImageRef (T0852 strict image reference)', () => {
  const digest = `sha256:${'a'.repeat(64)}`
  it.each([
    'debian',
    'debian:bookworm-slim',
    'buildpack-deps:bookworm-scm',
    'library/debian:12',
    'bat-server:latest',
    'ghcr.io/gowerlin/bat-server:0.7.4-pre.8',
    'localhost:5000/team/img:dev',
    'localhost/img',
    'registry.example.com:443/a/b_c/d-e:1.0',
    'MyReg.Example.com/team/x',
    'my.reg/x__y:Tag_1',
    `debian@${digest}`,
    `debian:12@${digest}`,
    `ghcr.io/o/i:1@${digest}`,
  ])('accepts %p', (image) => {
    expect(validateDockerImageRef(image)).toEqual({ ok: true })
  })

  it.each([
    '', '-v', '--privileged', '-it', 'Debian', 'debian:', 'debian:-x', 'debian::12', 'a b', 'debian;rm -rf /', "deb'ian",
    'deb"ian', 'debian\n', '/debian', 'debian/', 'a//b', 'debian@sha256:xyz', `debian@${digest}@${digest}`,
    'host:99999/x', 'host:0/x', 'ho_st.com/x', '$(id)', '`id`', 'debian:12 --rm', `x${'y'.repeat(255)}`,
    null, 42, undefined, ['debian'],
  ])('rejects %p', (image) => {
    expect(validateDockerImageRef(image).ok).toBe(false)
  })
})

describe('volume names (T0852)', () => {
  it('derives bat-server-<name>-bundle / -data', () => {
    expect(batVolumeNames('bat-dev')).toEqual({ bundle: 'bat-server-bat-dev-bundle', data: 'bat-server-bat-dev-data' })
  })

  it.each(['', '-x', 'a b', 'a/b', 'x;id'])('refuses container name %p', (name) => {
    expect(() => batVolumeNames(name)).toThrow()
  })

  it.each(['-x', 'a', 'a b', 'a/b', 'a:b', '', null, 'x'.repeat(256)])('validateDockerVolumeName rejects %p', (name) => {
    expect(validateDockerVolumeName(name).ok).toBe(false)
  })

  it('accepts docker volume names', () => {
    expect(validateDockerVolumeName('bat-server-x_1.y-bundle')).toEqual({ ok: true })
  })
})

// ─── 6. server container arguments ────────────────────────────────────────

describe('buildBatContainerRunArgs (T0852, D283 U4 / U5, BUG-097)', () => {
  const base = { image: 'buildpack-deps:bookworm-scm', port: 19876, bundleVolume: 'bat-server-bat-dev-bundle', dataVolume: 'bat-server-bat-dev-data' }

  it('publishes on 127.0.0.1 only, never carries a token', () => {
    const args = buildBatContainerRunArgs('bat-dev', base)
    expect(valuesOf(args, '-p')).toEqual(['127.0.0.1:19876:9876'])
    expect(args.filter((arg) => arg === '-p' || arg === '--publish' || arg.startsWith('--publish=') || arg === '-P')).toEqual(['-p'])
    expect(args.some((arg) => /token/i.test(arg))).toBe(false)
  })

  it('root, --init, bundle entrypoint, both volumes, label, restart, server flags', () => {
    const args = buildBatContainerRunArgs('bat-dev', base)
    expect(args.slice(0, 4)).toEqual(['run', '-d', '--name', 'bat-dev'])
    expect(args).toContain('--init')
    expect(valuesOf(args, '--user')).toEqual(['0:0'])
    expect(valuesOf(args, '--entrypoint')).toEqual(['/opt/bat/server/bin/bat-server'])
    expect(valuesOf(args, '--restart')).toEqual(['unless-stopped'])
    expect(valuesOf(args, '--label')).toEqual(['bat.server=1'])
    expect(valuesOf(args, '-v')).toEqual(['bat-server-bat-dev-bundle:/opt/bat', 'bat-server-bat-dev-data:/var/lib/bat-server'])
    const imageIndex = args.indexOf('buildpack-deps:bookworm-scm')
    expect(imageIndex).toBe(args.length - 7)
    expect(args.slice(imageIndex + 1)).toEqual(['--bind-interface', 'all', '--port', '9876', '--data-dir', '/var/lib/bat-server'])
  })

  it('health check is docker/Dockerfile\'s TLS probe with the bundle node and the fixed port', () => {
    const args = buildBatContainerRunArgs('bat-dev', base)
    expect(valuesOf(args, '--health-cmd')).toEqual([BAT_CONTAINER_HEALTH_CMD])
    const dockerfile = fs.readFileSync(path.join(__dirname, '..', '..', 'docker', 'Dockerfile'), 'utf8')
    const cmd = /CMD (\/opt\/bat-server\/bin\/node -e '.*' \|\| exit 1)/.exec(dockerfile)?.[1]
    expect(cmd).toBeTruthy()
    expect(BAT_CONTAINER_HEALTH_CMD).toBe(
      (cmd as string).replace('/opt/bat-server/bin/node', '/opt/bat/server/bin/node').replace('Number(process.env.BAT_SERVER_PORT)', '9876'),
    )
    expect(valuesOf(args, '--health-interval')).toEqual(['30s'])
    expect(valuesOf(args, '--health-timeout')).toEqual(['5s'])
    expect(valuesOf(args, '--health-start-period')).toEqual(['10s'])
    expect(valuesOf(args, '--health-retries')).toEqual(['3'])
  })

  it('adds bind mounts after the two volumes', () => {
    const args = buildBatContainerRunArgs('bat-dev', { ...base, mounts: [{ host: 'C:\\work\\proj', container: '/workspace/proj' }] })
    expect(valuesOf(args, '-v')).toEqual(['bat-server-bat-dev-bundle:/opt/bat', 'bat-server-bat-dev-data:/var/lib/bat-server', 'C:\\work\\proj:/workspace/proj'])
  })

  it.each([
    ['container name', 'bad name', base],
    ['image', 'bat-dev', { ...base, image: '--privileged' }],
    ['bundle volume', 'bat-dev', { ...base, bundleVolume: '/etc' }],
    ['data volume', 'bat-dev', { ...base, dataVolume: 'x:/root' }],
    ['port 0', 'bat-dev', { ...base, port: 0 }],
    ['port 70000', 'bat-dev', { ...base, port: 70000 }],
    ['port 1.5', 'bat-dev', { ...base, port: 1.5 }],
    ['restart policy', 'bat-dev', { ...base, restartPolicy: 'sometimes' as never }],
    ['relative mount', 'bat-dev', { ...base, mounts: [{ host: '/x', container: 'rel' }] }],
  ])('refuses invalid %s', (_label, name, options) => {
    expect(() => buildBatContainerRunArgs(name, options)).toThrow()
  })

  it('createBatContainer runs exactly those arguments with a time limit', async () => {
    const calls = installExec()
    expect(await createBatContainer('bat-dev', base)).toEqual({ ok: true })
    expect(calls).toHaveLength(1)
    expect(calls[0].file).toBe('docker')
    expect(calls[0].args).toEqual(buildBatContainerRunArgs('bat-dev', base))
    expect(calls[0].options.timeout).toBeGreaterThan(0)
  })

  it('createBatContainer: invalid input never runs docker; docker failure returns its message', async () => {
    const calls = installExec(() => ({ error: execError('boom'), stderr: 'port is already allocated' }))
    expect((await createBatContainer('bat-dev', { ...base, image: 'BAD' })).ok).toBe(false)
    expect(calls).toHaveLength(0)
    expect(await createBatContainer('bat-dev', base)).toEqual({ ok: false, error: 'port is already allocated' })
  })
})

// ─── 1. pull ──────────────────────────────────────────────────────────────

describe('pullImage (T0852)', () => {
  const pullOutput = [
    'bookworm-scm: Pulling from library/buildpack-deps',
    'aaaaaaaaaaaa: Pulling fs layer',
    'bbbbbbbbbbbb: Already exists',
    'aaaaaaaaaaaa: Downloading',
    'aaaaaaaaaaaa: Pull complete',
    `Digest: sha256:${'c'.repeat(64)}`,
    'Status: Downloaded newer image for buildpack-deps:bookworm-scm',
    'docker.io/library/buildpack-deps:bookworm-scm',
  ].join('\n')

  it('runs `docker pull <image>`, reports layer progress and the result', async () => {
    const calls = installSpawn((child) => child.exit(0, `${pullOutput}\n`))
    const progress: Array<{ layers: number; completed: number }> = []
    const result = await pullImage('buildpack-deps:bookworm-scm', { onProgress: (event) => progress.push(event) })
    expect(calls.map((call) => [call.file, call.args])).toEqual([['docker', ['pull', 'buildpack-deps:bookworm-scm']]])
    expect(result).toEqual({ ok: true, status: 'downloaded', digest: `sha256:${'c'.repeat(64)}` })
    expect(progress).toEqual([{ layers: 1, completed: 0 }, { layers: 2, completed: 1 }, { layers: 2, completed: 2 }])
  })

  it('progress tracker: up-to-date status, CR-separated lines', () => {
    const tracker = new DockerPullProgressTracker()
    expect(tracker.feed('Status: Image is up to date for debian:12')).toBeNull()
    expect(tracker.status).toBe('up-to-date')
    expect(tracker.feed('dddddddddddd: Waiting')).toEqual({ layers: 1, completed: 0 })
    expect(tracker.feed('dddddddddddd: Downloading [==>   ]')).toBeNull()
  })

  it('progress tracker: containerd store blobs that only print Download complete still finish (Docker 29)', () => {
    const tracker = new DockerPullProgressTracker()
    for (const line of [
      '3.19: Pulling from library/alpine',
      '17a39c0ba978: Pulling fs layer',
      '17a39c0ba978: Download complete',
      '17a39c0ba978: Pull complete',
      'ef1614f30685: Download complete',
      'fd18d7b2aa35: Download complete',
    ]) tracker.feed(line)
    expect(tracker.progress()).toEqual({ layers: 3, completed: 3 })
  })

  it('an invalid image never spawns docker', async () => {
    const calls = installSpawn((child) => child.exit(0))
    expect(await pullImage('--help')).toMatchObject({ ok: false, errorCode: 'docker-image-invalid' })
    expect(calls).toHaveLength(0)
  })

  it('abort kills the docker CLI and reports docker-pull-aborted', async () => {
    const controller = new AbortController()
    const calls = installSpawn((child) => {
      child.once('killed', () => child.exit(1))
      controller.abort()
    })
    const result = await pullImage('debian:12', { signal: controller.signal })
    expect(result).toMatchObject({ ok: false, errorCode: 'docker-pull-aborted' })
    expect(calls[0].child.killed).toBe(1)
  })

  it('already aborted: nothing runs', async () => {
    const calls = installSpawn((child) => child.exit(0))
    const controller = new AbortController()
    controller.abort()
    expect(await pullImage('debian:12', { signal: controller.signal })).toMatchObject({ ok: false, errorCode: 'docker-pull-aborted' })
    expect(calls).toHaveLength(0)
  })

  it('time limit kills the docker CLI and reports docker-pull-timeout', async () => {
    const calls = installSpawn((child) => child.once('killed', () => child.exit(1)))
    expect(await pullImage('debian:12', { timeoutMs: 20 })).toMatchObject({ ok: false, errorCode: 'docker-pull-timeout' })
    expect(calls[0].child.killed).toBe(1)
  })

  it.each([
    ['Error response from daemon: manifest for debian:nope not found: manifest unknown', 'docker-image-not-found'],
    ['Error response from daemon: pull access denied for nope, repository does not exist', 'docker-image-not-found'],
    ['toomanyrequests: You have reached your pull rate limit.', 'docker-pull-rate-limited'],
    ['Cannot connect to the Docker daemon at unix:///var/run/docker.sock.', 'docker-pull-failed'],
  ])('classifies failure %p', async (stderr, errorCode) => {
    installSpawn((child) => child.exit(1, '', stderr))
    expect(await pullImage('debian:12')).toEqual({ ok: false, errorCode, error: stderr })
  })
})

// ─── 2. arch ──────────────────────────────────────────────────────────────

describe('docker server arch (T0852)', () => {
  it.each([
    ['linux/amd64', { ok: true, arch: 'linux-x64', rawArch: 'amd64' }],
    ['linux/arm64\n', { ok: true, arch: 'linux-arm64', rawArch: 'arm64' }],
    ['linux/x86_64', { ok: true, arch: 'linux-x64', rawArch: 'x86_64' }],
  ])('%p', (stdout, expected) => {
    expect(parseDockerServerArch(stdout)).toEqual(expected)
  })

  it.each([
    ['windows/amd64', 'docker-server-not-linux'],
    ['linux/s390x', 'docker-arch-unsupported'],
    ['linux/arm', 'docker-arch-unsupported'],
    ['', 'docker-arch-failed'],
    ['amd64', 'docker-arch-failed'],
  ])('%p -> %s', (stdout, errorCode) => {
    expect(parseDockerServerArch(stdout)).toMatchObject({ ok: false, errorCode })
  })

  it('asks docker version for the daemon OS / arch with the detect time limit', async () => {
    const calls = installExec(() => ({ stdout: 'linux/amd64\n' }))
    expect(await dockerServerArch()).toEqual({ ok: true, arch: 'linux-x64', rawArch: 'amd64' })
    expect(calls[0].args).toEqual(['version', '--format', '{{.Server.Os}}/{{.Server.Arch}}'])
    expect(calls[0].options.timeout).toBe(5_000)
  })

  it('docker failure -> docker-arch-failed', async () => {
    installExec(() => ({ error: execError('x'), stderr: 'Cannot connect to the Docker daemon' }))
    expect(await dockerServerArch()).toEqual({ ok: false, errorCode: 'docker-arch-failed', error: 'Cannot connect to the Docker daemon' })
  })
})

// ─── 3. volumes ───────────────────────────────────────────────────────────

describe('BAT volumes (T0852 ownership)', () => {
  it('creates a missing volume with the BAT labels (created: true)', async () => {
    const calls = installExec((args) => (args[1] === 'inspect' ? { error: execError('x'), stderr: 'Error response from daemon: get v: no such volume' } : {}))
    expect(await createBatVolume('bat-server-x-bundle', 'bundle')).toEqual({ ok: true, volume: 'bat-server-x-bundle', created: true, batLabelled: true })
    expect(calls.map((call) => call.args)).toEqual([
      ['volume', 'inspect', '--format', '{{json .Labels}}', 'bat-server-x-bundle'],
      ['volume', 'create', '--label', 'bat.server=1', '--label', 'bat.server.volume=bundle', 'bat-server-x-bundle'],
    ])
    expect(calls.every((call) => (call.options.timeout ?? 0) > 0)).toBe(true)
  })

  it('an existing volume is not created again (created: false), labels reported', async () => {
    installExec(() => ({ stdout: '{"bat.server":"1","bat.server.volume":"data"}' }))
    expect(await createBatVolume('bat-server-x-data', 'data')).toEqual({ ok: true, volume: 'bat-server-x-data', created: false, batLabelled: true })
    installExec(() => ({ stdout: 'null' }))
    expect(await createBatVolume('bat-server-x-data', 'data')).toEqual({ ok: true, volume: 'bat-server-x-data', created: false, batLabelled: false })
  })

  it('invalid name / role never runs docker', async () => {
    const calls = installExec()
    expect(await createBatVolume('-x', 'bundle')).toMatchObject({ ok: false, errorCode: 'docker-volume-invalid' })
    expect(await createBatVolume('ok-name', 'other' as never)).toMatchObject({ ok: false, errorCode: 'docker-volume-invalid' })
    expect(await removeBatVolume('a/b')).toMatchObject({ ok: false, errorCode: 'docker-volume-invalid' })
    expect(calls).toHaveLength(0)
  })

  it('removes a BAT-labelled volume without -f', async () => {
    const calls = installExec((args) => (args[1] === 'inspect' ? { stdout: '{"bat.server":"1"}' } : {}))
    expect(await removeBatVolume('bat-server-x-bundle')).toEqual({ ok: true, volume: 'bat-server-x-bundle', removed: true })
    expect(calls[1].args).toEqual(['volume', 'rm', 'bat-server-x-bundle'])
  })

  it('never removes a volume without the BAT label', async () => {
    const calls = installExec(() => ({ stdout: '{"com.example":"x"}' }))
    expect(await removeBatVolume('bat-server-x-bundle')).toMatchObject({ ok: false, errorCode: 'docker-volume-not-owned' })
    expect(calls.map((call) => call.args[1])).toEqual(['inspect'])
  })

  it('a missing volume is removed: false; an in-use one fails', async () => {
    installExec(() => ({ error: execError('x'), stderr: 'Error: No such volume: v' }))
    expect(await removeBatVolume('bat-server-x-bundle')).toEqual({ ok: true, volume: 'bat-server-x-bundle', removed: false })
    installExec((args) => (args[1] === 'inspect' ? { stdout: '{"bat.server":"1"}' } : { error: execError('x'), stderr: 'volume is in use' }))
    expect(await removeBatVolume('bat-server-x-bundle')).toEqual({ ok: false, errorCode: 'docker-volume-failed', error: 'volume is in use' })
  })
})

// ─── 4. install into the volume ───────────────────────────────────────────

describe('installBundleIntoVolume (T0852)', () => {
  let dir: string
  let tarball: string
  const payload = Buffer.from(Array.from({ length: 200_000 }, (_, i) => i % 251))

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0852-'))
    tarball = path.join(dir, 'bat-server-linux-x64-v0.0.0.tar.gz')
    fs.writeFileSync(tarball, payload)
  })

  it('script = the shared SSH install for /opt/bat/server; data dir prepared 0700 when asked', () => {
    expect(buildDockerBundleInstallScript({ keepPrevious: true })).toBe(buildSshBundleInstallCommand('/opt/bat/server', { keepPrevious: true }))
    expect(buildDockerBundleInstallScript()).toBe(buildSshBundleInstallCommand('/opt/bat/server'))
    const withData = buildDockerBundleInstallScript({ prepareDataDir: true })
    expect(withData.split('\n')[0]).toBe('mkdir -p /var/lib/bat-server && chmod 700 /var/lib/bat-server || exit 1')
    expect(withData.split('\n').slice(1).join('\n')).toBe(buildSshBundleInstallCommand('/opt/bat/server'))
  })

  it('docker run --rm -i on the base image, tarball streamed to stdin, marker parsed', async () => {
    const calls = installSpawn((child) => {
      onStdinEnded(child, () => child.exit(0, 'server bundle install: replaced /opt/bat/server\nBAT_BUNDLE_PREVIOUS=kept\n'))
    })
    const result = await installBundleIntoVolume({
      image: 'buildpack-deps:bookworm-scm',
      bundleVolume: 'bat-server-x-bundle',
      dataVolume: 'bat-server-x-data',
      tarballPath: tarball,
      keepPrevious: true,
    })
    expect(result).toEqual({ ok: true, installPath: BAT_BUNDLE_ROOT, previous: 'kept' })
    const { file, args, child } = calls[0]
    expect(file).toBe('docker')
    expect(args.slice(0, 3)).toEqual(['run', '--rm', '-i'])
    expect(valuesOf(args, '--name')[0]).toMatch(/^bat-bundle-job-[0-9a-f]{12}$/)
    expect(valuesOf(args, '--network')).toEqual(['none'])
    expect(valuesOf(args, '--user')).toEqual(['0:0'])
    expect(valuesOf(args, '-v')).toEqual(['bat-server-x-bundle:/opt/bat', `bat-server-x-data:${BAT_CONTAINER_DATA_DIR}`])
    expect(valuesOf(args, '--entrypoint')).toEqual(['/bin/sh'])
    expect(args.slice(-4)).toEqual(['buildpack-deps:bookworm-scm', '-c', buildDockerBundleInstallScript({ keepPrevious: true, prepareDataDir: true }), 'sh'])
    expect(Buffer.concat(child.stdinChunks).equals(payload)).toBe(true)
    expect(args.some((arg) => arg.includes(tarball) || arg.includes(dir))).toBe(false)
  })

  it('without a data volume: only the bundle volume, no data dir line', async () => {
    const calls = installSpawn((child) => onStdinEnded(child, () => child.exit(0, 'BAT_BUNDLE_PREVIOUS=none\n')))
    expect(await installBundleIntoVolume({ image: 'debian:12', bundleVolume: 'bat-server-x-bundle', tarballPath: tarball })).toEqual({
      ok: true, installPath: BAT_BUNDLE_ROOT, previous: 'none',
    })
    expect(valuesOf(calls[0].args, '-v')).toEqual(['bat-server-x-bundle:/opt/bat'])
    expect(calls[0].args.at(-2)).toBe(buildSshBundleInstallCommand('/opt/bat/server'))
  })

  it('script failure returns its stderr', async () => {
    installSpawn((child) => onStdinEnded(child, () => child.exit(1, '', 'server bundle layout unexpected: bin/bat-server missing after extract\n')))
    expect(await installBundleIntoVolume({ image: 'debian:12', bundleVolume: 'v1', tarballPath: tarball })).toEqual({
      ok: false, errorCode: 'docker-install-failed', error: 'server bundle layout unexpected: bin/bat-server missing after extract',
    })
  })

  it('exit 0 without the marker is a failure (wrong script / image)', async () => {
    installSpawn((child) => onStdinEnded(child, () => child.exit(0, 'hello\n')))
    expect(await installBundleIntoVolume({ image: 'debian:12', bundleVolume: 'v1', tarballPath: tarball })).toMatchObject({ ok: false, errorCode: 'docker-install-failed' })
  })

  it('abort closes stdin (tar fails, old install untouched) and never kills within the grace period', async () => {
    const controller = new AbortController()
    let sawEnd = false
    const calls = installSpawn((child) => {
      controller.abort()
      onStdinEnded(child, () => {
        sawEnd = true
        child.exit(1, '', 'server bundle install: extract failed\n')
      })
    })
    const result = await installBundleIntoVolume({ image: 'debian:12', bundleVolume: 'v1', tarballPath: tarball, signal: controller.signal, stopGraceMs: 1_000 })
    expect(result).toEqual({ ok: false, errorCode: 'docker-install-aborted', error: 'Server bundle install was cancelled.', aborted: true })
    expect(sawEnd).toBe(true)
    expect(calls[0].child.killed).toBe(0)
  })

  it('abort after the swap reports the previous install so rollback can restore it', async () => {
    const controller = new AbortController()
    installSpawn((child) => {
      onStdinEnded(child, () => {
        controller.abort()
        child.exit(0, 'BAT_BUNDLE_PREVIOUS=kept\n')
      })
    })
    expect(await installBundleIntoVolume({ image: 'debian:12', bundleVolume: 'v1', tarballPath: tarball, keepPrevious: true, signal: controller.signal })).toMatchObject({
      ok: false, errorCode: 'docker-install-aborted', aborted: true, previous: 'kept',
    })
  })

  it('a job still running after the grace period is killed and its container removed', async () => {
    const execCalls = installExec()
    const calls = installSpawn((child) => child.once('killed', () => child.exit(137)))
    const result = await installBundleIntoVolume({ image: 'debian:12', bundleVolume: 'v1', tarballPath: tarball, timeoutMs: 10, stopGraceMs: 20 })
    expect(result).toEqual({ ok: false, errorCode: 'docker-install-timeout', error: 'Server bundle install did not finish in time.' })
    expect(calls[0].child.killed).toBe(1)
    const jobName = valuesOf(calls[0].args, '--name')[0]
    expect(execCalls.map((call) => call.args)).toEqual([['rm', '-f', jobName]])
  })

  it.each([
    ['relative tarball', { tarballPath: 'bundle.tar.gz' }],
    ['missing tarball', { tarballPath: path.join(os.tmpdir(), 'bat-t0852-missing.tar.gz') }],
    ['directory', { tarballPath: os.tmpdir() }],
    ['bad image', { image: '--privileged' }],
    ['bad bundle volume', { bundleVolume: '/etc' }],
    ['bad data volume', { dataVolume: 'x:/y' }],
  ])('refuses %s without running docker', async (_label, override) => {
    const calls = installSpawn((child) => child.exit(0))
    const result = await installBundleIntoVolume({ image: 'debian:12', bundleVolume: 'v1', tarballPath: tarball, ...override })
    expect(result).toMatchObject({ ok: false, errorCode: 'docker-install-invalid' })
    expect(calls).toHaveLength(0)
  })

  it('restore / discard run the T0554 scripts for /opt/bat/server on the base image', async () => {
    const calls = installExec((args) => ({ stdout: args.at(-2)?.includes('BAT_BUNDLE_RESTORE=') ? 'BAT_BUNDLE_RESTORE=restored\n' : '' }))
    expect(await restoreBundleInVolume({ image: 'debian:12', bundleVolume: 'v1' })).toEqual({ ok: true, outcome: 'restored' })
    expect(await discardPreviousBundleInVolume({ image: 'debian:12', bundleVolume: 'v1' })).toEqual({ ok: true })
    for (const call of calls) {
      expect(call.args.slice(0, 2)).toEqual(['run', '--rm'])
      expect(call.args).not.toContain('-i')
      expect(valuesOf(call.args, '-v')).toEqual(['v1:/opt/bat'])
      expect(call.args.at(-2)?.split('\n')[0]).toBe("dst='/opt/bat/server'")
      expect(call.options.timeout).toBeGreaterThan(0)
    }
    expect(calls[0].args.at(-2)).toContain('BAT_BUNDLE_RESTORE=')
    expect(calls[1].args.at(-2)).toContain('server bundle cleanup: removed $old')
  })

  it('restore failure / missing marker -> docker-install-failed', async () => {
    installExec(() => ({ error: execError('x'), stderr: 'server bundle restore: /opt/bat/server is not a BAT server bundle install; leaving it' }))
    expect(await restoreBundleInVolume({ image: 'debian:12', bundleVolume: 'v1' })).toMatchObject({ ok: false, errorCode: 'docker-install-failed' })
    installExec(() => ({ stdout: '' }))
    expect(await restoreBundleInVolume({ image: 'debian:12', bundleVolume: 'v1' })).toMatchObject({ ok: false, errorCode: 'docker-install-failed' })
  })
})

// ─── 5. compatibility probe ───────────────────────────────────────────────

describe('compatibility probe (T0852)', () => {
  const glibc = (version: string, extra = '') => `BAT_PROBE_MISSING=\nBAT_PROBE_GLIBC=${version}\nBAT_PROBE_LIBC=glibc\n${extra}`

  it.each([
    ['no /bin/sh (docker exit 127)', { exitCode: 127, stdout: '', stderr: 'exec: "/bin/sh": stat /bin/sh: no such file or directory', checkedNode: false }, 'docker-compat-no-shell'],
    ['no /bin/sh (docker exit 126)', { exitCode: 126, stdout: '', stderr: '', checkedNode: true }, 'docker-compat-no-shell'],
    ['docker error (125)', { exitCode: 125, stdout: '', stderr: 'Unable to find image', checkedNode: false }, 'docker-compat-probe-failed'],
    ['missing tar / gzip', { exitCode: 0, stdout: 'BAT_PROBE_MISSING= tar gzip\nBAT_PROBE_LIBC=unknown\n', stderr: '', checkedNode: false }, 'docker-compat-missing-tools'],
    ['musl (Alpine)', { exitCode: 0, stdout: 'BAT_PROBE_MISSING=\nBAT_PROBE_LIBC=musl\nBAT_PROBE_NODE=127\nBAT_PROBE_NODE_ERR=sh: /opt/bat/server/bin/node: not found\n', stderr: '', checkedNode: true }, 'docker-compat-musl'],
    ['glibc 2.31 before install', { exitCode: 0, stdout: glibc('2.31'), stderr: '', checkedNode: false }, 'docker-compat-glibc-too-old'],
    ['node fails with GLIBC_ not found', { exitCode: 0, stdout: `BAT_PROBE_MISSING=\nBAT_PROBE_LIBC=unknown\nBAT_PROBE_NODE=1\nBAT_PROBE_NODE_ERR=/opt/bat/server/bin/node: /lib/x86_64-linux-gnu/libc.so.6: version \`GLIBC_2.34' not found\n`, stderr: '', checkedNode: true }, 'docker-compat-glibc-too-old'],
    ['bundle missing', { exitCode: 0, stdout: glibc('2.36', 'BAT_PROBE_NODE=missing\n'), stderr: '', checkedNode: true }, 'docker-compat-bundle-missing'],
    ['node fails otherwise', { exitCode: 0, stdout: glibc('2.36', 'BAT_PROBE_NODE=139\nBAT_PROBE_NODE_ERR=Segmentation fault\n'), stderr: '', checkedNode: true }, 'docker-compat-node-failed'],
  ])('%s', (_label, input, errorCode) => {
    expect(classifyCompatProbe(input)).toMatchObject({ ok: false, errorCode })
  })

  it('missing tools are listed', () => {
    expect(classifyCompatProbe({ exitCode: 0, stdout: 'BAT_PROBE_MISSING= gzip\nBAT_PROBE_LIBC=glibc\n', stderr: '', checkedNode: false })).toMatchObject({ missing: ['gzip'] })
  })

  it.each([
    ['glibc 2.36 before install', { exitCode: 0, stdout: glibc('2.36'), stderr: '', checkedNode: false }, { ok: true, libc: 'glibc', glibcVersion: '2.36', nodeChecked: false }],
    ['glibc 2.35 (the floor)', { exitCode: 0, stdout: glibc('2.35'), stderr: '', checkedNode: false }, { ok: true, libc: 'glibc', glibcVersion: '2.35', nodeChecked: false }],
    ['libc unknown before install', { exitCode: 0, stdout: 'BAT_PROBE_MISSING=\nBAT_PROBE_LIBC=unknown\n', stderr: '', checkedNode: false }, { ok: true, libc: 'unknown', nodeChecked: false }],
    ['node runs', { exitCode: 0, stdout: glibc('2.36', 'BAT_PROBE_NODE=0\n'), stderr: '', checkedNode: true }, { ok: true, libc: 'glibc', glibcVersion: '2.36', nodeChecked: true }],
    ['CRLF output', { exitCode: 0, stdout: glibc('2.39', 'BAT_PROBE_NODE=0\n').replace(/\n/g, '\r\n'), stderr: '', checkedNode: true }, { ok: true, libc: 'glibc', glibcVersion: '2.39', nodeChecked: true }],
  ])('%s', (_label, input, expected) => {
    expect(classifyCompatProbe(input)).toEqual(expected)
  })

  it('probe job: read-only bundle volume and the `node` argument only after the install', async () => {
    const calls = installExec(() => ({ stdout: glibc('2.36', 'BAT_PROBE_NODE=0\n') }))
    expect(await probeBundleCompat({ image: 'debian:12', bundleVolume: 'v1' })).toEqual({ ok: true, libc: 'glibc', glibcVersion: '2.36', nodeChecked: true })
    expect(await probeBundleCompat({ image: 'debian:12' })).toMatchObject({ ok: true, nodeChecked: false })
    expect(valuesOf(calls[0].args, '-v')).toEqual(['v1:/opt/bat:ro'])
    expect(calls[0].args.slice(-4)).toEqual(['-c', buildCompatProbeScript(), 'sh', 'node'])
    expect(valuesOf(calls[1].args, '-v')).toEqual([])
    expect(calls[1].args.slice(-3)).toEqual(['-c', buildCompatProbeScript(), 'sh'])
    for (const call of calls) {
      expect(valuesOf(call.args, '--network')).toEqual(['none'])
      expect(valuesOf(call.args, '--entrypoint')).toEqual(['/bin/sh'])
    }
  })

  it('probe job: docker exit 127 -> no shell', async () => {
    installExec(() => ({ error: execError('Command failed', 127), stderr: 'exec: "/bin/sh": stat /bin/sh: no such file or directory' }))
    expect(await probeBundleCompat({ image: 'gcr.io/distroless/base' })).toMatchObject({ ok: false, errorCode: 'docker-compat-no-shell' })
  })

  const shellAvailable = spawnSync('sh', ['-c', 'echo ok'], { encoding: 'utf8', windowsHide: true }).stdout?.trim() === 'ok'
  it.skipIf(!shellAvailable)('probe script runs under a real sh and always prints the libc marker', () => {
    const before = spawnSync('sh', ['-c', buildCompatProbeScript(), 'sh'], { encoding: 'utf8', windowsHide: true })
    expect(before.status).toBe(0)
    expect(before.stdout).toMatch(/^BAT_PROBE_LIBC=(glibc|musl|unknown)$/m)
    expect(before.stdout).not.toMatch(/BAT_PROBE_NODE=/)
    const after = spawnSync('sh', ['-c', buildCompatProbeScript(), 'sh', 'node'], { encoding: 'utf8', windowsHide: true })
    expect(after.status).toBe(0)
    expect(after.stdout).toMatch(/^BAT_PROBE_NODE=missing$/m)
  })
})

// ─── 7. docker exec ───────────────────────────────────────────────────────

describe('execContainerCommand (T0852: docker.execCommand)', () => {
  it('runs the rollback rm -rf of a bundle install root', async () => {
    const calls = installExec()
    expect(await execContainerCommand('mine', ['rm', '-rf', '/opt/bat-server'])).toEqual({ ok: true, stdout: '' })
    expect(calls.map((call) => call.args)).toEqual([['exec', 'mine', 'rm', '-rf', '--', '/opt/bat-server']])
    expect(calls[0].options.timeout).toBeGreaterThan(0)
  })

  it.each([
    [['sh', '-c', 'id']],
    [['rm', '-rf', '/']],
    [['rm', '-rf', '/opt']],
    [['rm', '-rf', '/opt/x;id']],
    [['rm', '-rf', '/opt/$(id)']],
    [['rm', '-rf', '/opt/../etc']],
    [['rm', '-rf', 'relative/dir']],
    [['rm', '-r', '/opt/bat-server']],
    [['rm', '-rf', '/opt/bat-server', '/etc']],
    ['rm -rf /opt/bat-server'],
    [[]],
  ])('refuses %p without running docker', async (command) => {
    const calls = installExec()
    expect((await execContainerCommand('mine', command)).ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('refuses an invalid container name', async () => {
    const calls = installExec()
    expect((await execContainerCommand('-it', ['rm', '-rf', '/opt/bat-server'])).ok).toBe(false)
    expect(calls).toHaveLength(0)
  })
})

// ─── 8. certificate fingerprint ───────────────────────────────────────────

describe('readServerCertFingerprint (T0852, T0851 option 6)', () => {
  let bundle: CertificateBundle
  beforeAll(async () => {
    bundle = await generateSelfSignedCert(1)
  })

  const inspect = JSON.stringify([{ Config: { Entrypoint: ['/opt/bat/server/bin/bat-server'], Cmd: ['--bind-interface', 'all', '--port', '9876', '--data-dir', '/var/lib/bat-server'] } }])

  it('same format as certificate.ts computeFingerprint', () => {
    expect(pemCertificateFingerprint(bundle.cert)).toBe(computeFingerprint(bundle.cert))
    expect(pemCertificateFingerprint('not a cert')).toBeNull()
  })

  it('reads <dataDir>/server-cert.json and returns only the fingerprint', async () => {
    const persisted = JSON.stringify({ ...bundle, fingerprint: 'STORED:VALUE:IGNORED', expiresAt: 1 })
    const calls = installExec((args) => (args[0] === 'inspect' ? { stdout: inspect } : { stdout: persisted }))
    const result = await readServerCertFingerprint('bat-dev')
    expect(result).toEqual({ ok: true, fingerprint: bundle.fingerprint })
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE KEY|BEGIN CERTIFICATE/)
    expect(calls.map((call) => call.args)).toEqual([
      ['inspect', '--type', 'container', 'bat-dev'],
      ['exec', 'bat-dev', 'cat', '/var/lib/bat-server/server-cert.json'],
    ])
  })

  it('legacy image without --data-dir: the default root data dir', async () => {
    const calls = installExec((args) => (args[0] === 'inspect' ? { stdout: '[{"Config":{}}]' } : { stdout: JSON.stringify(bundle) }))
    expect(await readServerCertFingerprint('old')).toEqual({ ok: true, fingerprint: bundle.fingerprint })
    expect(calls[1].args.at(-1)).toBe('/root/.local/share/bat-server/server-cert.json')
  })

  it('missing / unreadable file -> docker-cert-unavailable; the error never carries file content', async () => {
    installExec((args) => (args[0] === 'inspect' ? { stdout: inspect } : { error: execError('x'), stdout: '', stderr: 'cat: no such file' }))
    expect(await readServerCertFingerprint('bat-dev')).toMatchObject({ ok: false, errorCode: 'docker-cert-unavailable' })
    installExec((args) => (args[0] === 'inspect' ? { stdout: inspect } : { stdout: `{"key":${JSON.stringify(bundle.key)}}` }))
    const result = await readServerCertFingerprint('bat-dev')
    expect(result).toMatchObject({ ok: false, errorCode: 'docker-cert-unavailable' })
    expect(JSON.stringify(result)).not.toContain('PRIVATE KEY')
  })

  it('inspect failure / invalid name', async () => {
    installExec(() => ({ error: execError('x'), stderr: 'No such container: x' }))
    expect(await readServerCertFingerprint('x1')).toMatchObject({ ok: false, errorCode: 'docker-inspect-failed' })
    const calls = installExec()
    expect(await readServerCertFingerprint('bad name')).toMatchObject({ ok: false, errorCode: 'docker-inspect-failed' })
    expect(calls).toHaveLength(0)
  })
})

// ─── source guards ────────────────────────────────────────────────────────

describe('docker-bundle-volume source rules (T0852)', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'docker-bundle-volume.ts'), 'utf8')

  it('no electron import, no logger, no shell-spawning exec API', () => {
    expect(source).not.toMatch(/from 'electron'/)
    expect(source).not.toMatch(/^import .*logger/m)
    expect(source).not.toMatch(/childProcess\.exec\b|execSync|shell:\s*true/)
  })

  it('never passes --token and never widens the publish host', () => {
    expect(source).not.toMatch(/'--token'/)
    expect(source).not.toMatch(/0\.0\.0\.0/)
  })
})

// ─── T0853 (PLAN-052 W4b): U3 baked-bundle check, bundle version in the volume ─

describe('inspectImageBakedBundle (T0853 Q-2, U3)', () => {
  /** docker/Dockerfile ENTRYPOINT / CMD as `docker image inspect` reports them (JSON form). */
  function dockerfileInstruction(name: 'ENTRYPOINT' | 'CMD'): unknown {
    const dockerfile = fs.readFileSync(path.join(__dirname, '..', '..', 'docker', 'Dockerfile'), 'utf8')
    const line = dockerfile.split(/\r?\n/).find((entry) => entry.startsWith(`${name} `))
    return line ? JSON.parse(line.slice(name.length + 1)) : undefined
  }

  it('docker/Dockerfile (bat-server:latest) is baked: its ENTRYPOINT starts the baked-in server', () => {
    const entrypoint = dockerfileInstruction('ENTRYPOINT')
    expect(Array.isArray(entrypoint)).toBe(true)
    expect(entrypoint as string[]).toContain(BAKED_BUNDLE_SERVER_BIN)
    expect(classifyImageBakedBundle({ Entrypoint: entrypoint, Cmd: dockerfileInstruction('CMD') ?? null })).toEqual({ baked: true, reason: 'entrypoint' })
  })

  it('CMD counts too; a base image or an empty config is not baked', () => {
    expect(classifyImageBakedBundle({ Entrypoint: null, Cmd: [BAKED_BUNDLE_SERVER_BIN, '--bind-interface', 'all'] })).toEqual({ baked: true, reason: 'cmd' })
    expect(classifyImageBakedBundle({ Entrypoint: null, Cmd: `${BAKED_BUNDLE_SERVER_BIN} --port 9876` })).toEqual({ baked: true, reason: 'cmd' })
    expect(classifyImageBakedBundle({ Entrypoint: null, Cmd: ['bash'] })).toEqual({ baked: false, reason: 'none' })
    expect(classifyImageBakedBundle({ Entrypoint: ['/opt/bat/server/bin/bat-server'], Cmd: null })).toEqual({ baked: false, reason: 'none' })
    expect(classifyImageBakedBundle(null)).toEqual({ baked: false, reason: 'none' })
  })

  it('reads `docker image inspect <image>` and returns a boolean and a reason only', async () => {
    const calls = installExec(() => ({ stdout: JSON.stringify([{ Id: 'sha256:x', Config: { Entrypoint: ['/usr/bin/tini', '--', BAKED_BUNDLE_SERVER_BIN], Cmd: null, Env: ['SECRET=1'] } }]) }))
    const result = await inspectImageBakedBundle('bat-server:latest')
    expect(result).toEqual({ ok: true, baked: true, reason: 'entrypoint' })
    expect(calls).toHaveLength(1)
    expect(calls[0].file).toBe('docker')
    expect(calls[0].args).toEqual(['image', 'inspect', 'bat-server:latest'])
    expect(calls[0].options.timeout).toBeGreaterThan(0)
  })

  it('the image name plays no part: a base image named bat-server is not baked', async () => {
    installExec(() => ({ stdout: JSON.stringify([{ Config: { Entrypoint: null, Cmd: ['bash'] } }]) }))
    expect(await inspectImageBakedBundle('registry.example.com/team/bat-server:1')).toEqual({ ok: true, baked: false, reason: 'none' })
  })

  it('invalid image -> no docker call; inspect failure / bad JSON -> docker-image-inspect-failed', async () => {
    const calls = installExec()
    expect(await inspectImageBakedBundle('-v /:/host')).toMatchObject({ ok: false, errorCode: 'docker-image-invalid' })
    expect(calls).toHaveLength(0)
    installExec(() => ({ error: execError('no such image'), stderr: 'Error: No such image: x' }))
    expect(await inspectImageBakedBundle('x:1')).toMatchObject({ ok: false, errorCode: 'docker-image-inspect-failed' })
    installExec(() => ({ stdout: 'not json' }))
    expect(await inspectImageBakedBundle('x:1')).toMatchObject({ ok: false, errorCode: 'docker-image-inspect-failed' })
  })
})

describe('readBundleVersionInVolume (T0853 Q-3)', () => {
  it('parses the marker line; anything odd is null', () => {
    expect(parseBundleVersion('BAT_BUNDLE_VERSION=0.7.4-pre.8\n')).toBe('0.7.4-pre.8')
    expect(parseBundleVersion('noise\r\nBAT_BUNDLE_VERSION=0.7.3\r\n')).toBe('0.7.3')
    expect(parseBundleVersion('BAT_BUNDLE_VERSION=\n')).toBeNull()
    expect(parseBundleVersion('BAT_BUNDLE_VERSION=1.0; rm -rf /\n')).toBeNull()
    expect(parseBundleVersion('')).toBeNull()
  })

  it('runs a one-shot job on the image with the bundle volume read-only, no network', async () => {
    const calls = installExec(() => ({ stdout: 'BAT_BUNDLE_VERSION=0.7.3-pre.3\n' }))
    const result = await readBundleVersionInVolume({ image: 'buildpack-deps:bookworm-scm', bundleVolume: 'bat-server-dev-bundle' })
    expect(result).toEqual({ ok: true, version: '0.7.3-pre.3' })
    const args = calls[0].args
    expect(args.slice(0, 2)).toEqual(['run', '--rm'])
    expect(args).not.toContain('-i')
    expect(valuesOf(args, '--network')).toEqual(['none'])
    expect(valuesOf(args, '-v')).toEqual(['bat-server-dev-bundle:/opt/bat:ro'])
    expect(valuesOf(args, '--entrypoint')).toEqual(['/bin/sh'])
    expect(args).toContain(buildBundleVersionScript())
  })

  it('no version file -> version null; job failure / invalid input -> error codes', async () => {
    installExec(() => ({ stdout: 'BAT_BUNDLE_VERSION=\n' }))
    expect(await readBundleVersionInVolume({ image: 'debian:12', bundleVolume: 'bat-server-dev-bundle' })).toEqual({ ok: true, version: null })
    installExec(() => ({ error: execError('boom', 125), stderr: 'docker: error' }))
    expect(await readBundleVersionInVolume({ image: 'debian:12', bundleVolume: 'bat-server-dev-bundle' })).toMatchObject({ ok: false, errorCode: 'docker-install-failed' })
    const calls = installExec()
    expect(await readBundleVersionInVolume({ image: 'debian:12', bundleVolume: '../x' })).toMatchObject({ ok: false, errorCode: 'docker-install-invalid' })
    expect(calls).toHaveLength(0)
  })

  const shellAvailable = spawnSync('sh', ['-c', 'echo ok'], { encoding: 'utf8', windowsHide: true }).stdout?.trim() === 'ok'
  it.skipIf(!shellAvailable)('the version script reads versionManifestContent output under a real sh', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0853-version-'))
    try {
      const root = path.join(dir, 'server')
      fs.mkdirSync(root)
      // scripts/version-manifest.cjs versionManifestContent format.
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'better-agent-terminal', version: '0.7.4-pre.8' }, null, 2) + '\n')
      const script = buildBundleVersionScript().split(BAT_BUNDLE_ROOT).join(root.replace(/\\/g, '/'))
      const run = spawnSync('sh', ['-c', script], { encoding: 'utf8', windowsHide: true })
      expect(parseBundleVersion(run.stdout)).toBe('0.7.4-pre.8')
      fs.rmSync(path.join(root, 'package.json'))
      const missing = spawnSync('sh', ['-c', script], { encoding: 'utf8', windowsHide: true })
      expect(missing.stdout.trim()).toBe('BAT_BUNDLE_VERSION=')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
