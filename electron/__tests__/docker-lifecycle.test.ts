/**
 * T0418 (BUG-097): `docker run` must publish the bat-server port on host
 * loopback only. The image binds the server to all container interfaces
 * (docker/Dockerfile), so this host-side bind is the security boundary.
 * execFile is injected — no real docker is spawned.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DOCKER_PUBLISH_HOST,
  detectContainerExposure,
  resetExecFileImplForTests,
  setExecFileImplForTests,
  startContainer,
} from '../docker-lifecycle'

interface Call {
  file: string
  args: string[]
}

function installExec(): Call[] {
  const calls: Call[] = []
  setExecFileImplForTests((file: string, args: string[], _options: unknown, callback: (...cbArgs: unknown[]) => void) => {
    calls.push({ file, args })
    callback(null, '', '')
  })
  return calls
}

function publishValues(args: string[]): string[] {
  return args.flatMap((arg, index) => (arg === '-p' || arg === '--publish' ? [args[index + 1]] : []))
}

afterEach(() => {
  resetExecFileImplForTests()
})

describe('docker-lifecycle startContainer publish bind (BUG-097)', () => {
  it('publishes the default port on host 127.0.0.1 only', async () => {
    const calls = installExec()
    const result = await startContainer('bat-dev', { createIfMissing: true, image: 'bat-server:latest', token: 'tok' })

    expect(result).toEqual({ ok: true, token: 'tok' })
    expect(DOCKER_PUBLISH_HOST).toBe('127.0.0.1')
    expect(calls).toHaveLength(1)
    expect(calls[0].file).toBe('docker')
    expect(calls[0].args[0]).toBe('run')
    expect(publishValues(calls[0].args)).toEqual(['127.0.0.1:9876:9876'])
  })

  it('keeps the loopback prefix for a custom host port', async () => {
    const calls = installExec()
    await startContainer('bat-dev', { createIfMissing: true, image: 'bat-server:latest', port: 19876, token: 'tok' })

    expect(publishValues(calls[0].args)).toEqual(['127.0.0.1:19876:9876'])
  })

  it('never emits an unbound publish spec', async () => {
    const calls = installExec()
    await startContainer('bat-dev', {
      createIfMissing: true,
      image: 'bat-server:latest',
      port: 20000,
      mounts: [{ host: '/home/me/src', container: '/workspace/src' }],
      dataVolume: 'bat-server-bat-dev-data',
    })

    const publishes = publishValues(calls[0].args)
    expect(publishes).toHaveLength(1)
    for (const spec of publishes) expect(spec.startsWith('127.0.0.1:')).toBe(true)
    // container-side args stay on the in-image port
    expect(calls[0].args.slice(calls[0].args.indexOf('bat-server:latest'))).toEqual(
      expect.arrayContaining(['--port', '9876']),
    )
  })

  it('does not run docker for an invalid container name', async () => {
    const calls = installExec()
    const result = await startContainer('bad name;rm', { createIfMissing: true, image: 'bat-server:latest' })

    expect(result.ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('returns the token when `docker run` fails, so a retry can `docker start` the created container (T0452)', async () => {
    setExecFileImplForTests((_file: string, _args: string[], _options: unknown, callback: (...cbArgs: unknown[]) => void) => {
      callback(new Error('exit 125'), '', 'Bind for 127.0.0.1:9876 failed: port is already allocated')
    })

    expect(await startContainer('bat-dev', { createIfMissing: true, image: 'bat-server:latest', token: 'tok' })).toEqual({
      ok: false,
      token: 'tok',
      error: 'Bind for 127.0.0.1:9876 failed: port is already allocated',
    })

    const generated = await startContainer('bat-dev', { createIfMissing: true, image: 'bat-server:latest' })
    expect(generated.ok).toBe(false)
    expect(generated.token).toMatch(/^[0-9a-f]{32}$/)
  })
})

/**
 * T0427: containers created before the BUG-097 fix keep `-p <port>:9876`
 * (every host interface) and the old entrypoint. Detection reads structured
 * `docker inspect` JSON, never changes the container, and never blocks.
 */
interface ScriptedCall extends Call {
  options: Record<string, unknown>
}

type Reply = { error?: Error; stdout?: string; stderr?: string }

function installScriptedExec(reply: (args: string[]) => Reply): ScriptedCall[] {
  const calls: ScriptedCall[] = []
  setExecFileImplForTests((file: string, args: string[], options: Record<string, unknown>, callback: (...cbArgs: unknown[]) => void) => {
    calls.push({ file, args, options })
    const { error = null, stdout = '', stderr = '' } = reply(args)
    callback(error, stdout, stderr)
  })
  return calls
}

const NEW_ENTRYPOINT = ['/usr/bin/tini', '--', '/opt/bat-server/bin/bat-server', '--bind-interface', 'all']
const OLD_ENTRYPOINT = ['/usr/bin/tini', '--', '/opt/bat-server/bin/bat-server']

function inspectJson(portBindings: unknown, entrypoint: string[] = NEW_ENTRYPOINT, cmd: string[] = ['--port', '9876', '--token', 'tok']): string {
  return JSON.stringify([{ HostConfig: { PortBindings: portBindings }, Config: { Entrypoint: entrypoint, Cmd: cmd } }])
}

function inspectReply(json: string): (args: string[]) => Reply {
  return (args) => (args[0] === 'inspect' ? { stdout: json } : {})
}

describe('detectContainerExposure (T0427, BUG-097 follow-up)', () => {
  it.each([
    ['empty HostIp (docker default = every interface)', ''],
    ['0.0.0.0', '0.0.0.0'],
    ['IPv6 any ::', '::'],
    ['a LAN address', '192.168.1.20'],
  ])('flags a server port published on %s', async (_label, hostIp) => {
    installScriptedExec(inspectReply(inspectJson({ '9876/tcp': [{ HostIp: hostIp, HostPort: '9876' }] })))

    expect(await detectContainerExposure('bat-dev')).toEqual({ ok: true, exposed: true, hostIps: [hostIp], legacyImage: false })
  })

  it.each(['127.0.0.1', '127.0.0.2', '::1'])('accepts a loopback publish on %s', async (hostIp) => {
    installScriptedExec(inspectReply(inspectJson({ '9876/tcp': [{ HostIp: hostIp, HostPort: '19876' }] })))

    expect(await detectContainerExposure('bat-dev')).toEqual({ ok: true, exposed: false, hostIps: [], legacyImage: false })
  })

  it('reports every distinct offending host ip when IPv4 and IPv6 are both published', async () => {
    installScriptedExec(inspectReply(inspectJson({
      '9876/tcp': [
        { HostIp: '0.0.0.0', HostPort: '9876' },
        { HostIp: '::', HostPort: '9876' },
        { HostIp: '0.0.0.0', HostPort: '9876' },
      ],
    })))

    const result = await detectContainerExposure('bat-dev')
    expect(result.exposed).toBe(true)
    expect(result.hostIps).toEqual(['0.0.0.0', '::'])
  })

  it('ignores unrelated container ports unless they bind the given host port', async () => {
    const bindings = {
      '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '19876' }],
      '3000/tcp': [{ HostIp: '', HostPort: '3000' }],
    }
    installScriptedExec(inspectReply(inspectJson(bindings)))
    expect((await detectContainerExposure('bat-dev')).exposed).toBe(false)

    installScriptedExec(inspectReply(inspectJson(bindings)))
    expect(await detectContainerExposure('bat-dev', { hostPort: 3000 })).toMatchObject({ exposed: true, hostIps: [''] })
  })

  it('treats a container without published ports as not exposed', async () => {
    installScriptedExec(inspectReply(inspectJson(null)))

    expect(await detectContainerExposure('bat-dev')).toEqual({ ok: true, exposed: false, hostIps: [], legacyImage: false })
  })

  it('flags a pre-fix bat-server entrypoint as a legacy image', async () => {
    installScriptedExec(inspectReply(inspectJson({ '9876/tcp': [{ HostIp: '', HostPort: '9876' }] }, OLD_ENTRYPOINT)))

    expect(await detectContainerExposure('bat-dev')).toEqual({ ok: true, exposed: true, hostIps: [''], legacyImage: true })
  })

  it('does not call a non-bat-server container a legacy image', async () => {
    installScriptedExec(inspectReply(inspectJson({}, ['/docker-entrypoint.sh'], ['nginx', '-g', 'daemon off;'])))

    expect((await detectContainerExposure('bat-dev')).legacyImage).toBe(false)
  })

  it('runs a read-only structured inspect with a 5s timeout', async () => {
    const calls = installScriptedExec(inspectReply(inspectJson({})))
    await detectContainerExposure('bat-dev')

    expect(calls).toHaveLength(1)
    expect(calls[0].file).toBe('docker')
    expect(calls[0].args).toEqual(['inspect', '--type', 'container', 'bat-dev'])
    expect(calls[0].options.timeout).toBe(5_000)
  })

  it('returns ok:false without throwing when docker is unavailable', async () => {
    installScriptedExec(() => ({
      error: new Error('spawn docker ENOENT'),
      stderr: 'error during connect: open //./pipe/docker_engine: The system cannot find the file specified.',
    }))

    const result = await detectContainerExposure('bat-dev')
    expect(result).toMatchObject({ ok: false, exposed: false, hostIps: [], legacyImage: false })
    expect(result.error).toContain('docker_engine')
  })

  it('returns ok:false on unparseable inspect output', async () => {
    installScriptedExec(inspectReply('not json'))

    expect(await detectContainerExposure('bat-dev')).toMatchObject({ ok: false, exposed: false })
  })

  it('does not run docker for an invalid container name', async () => {
    const calls = installScriptedExec(() => ({}))

    expect((await detectContainerExposure('bad name;rm')).ok).toBe(false)
    expect(calls).toHaveLength(0)
  })
})

describe('startContainer existing-container path (T0427)', () => {
  it('detects before docker start and attaches the exposure', async () => {
    const calls = installScriptedExec(inspectReply(inspectJson({ '9876/tcp': [{ HostIp: '', HostPort: '9876' }] }, OLD_ENTRYPOINT)))
    const result = await startContainer('bat-dev')

    expect(calls.map((call) => call.args[0])).toEqual(['inspect', 'start', 'exec'])
    expect(result).toMatchObject({ ok: true, exposure: { ok: true, exposed: true, hostIps: [''], legacyImage: true } })
  })

  it('omits exposure for a container already published on loopback', async () => {
    installScriptedExec(inspectReply(inspectJson({ '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '9876' }] })))
    const result = await startContainer('bat-dev', { port: 9876 })

    expect(result.ok).toBe(true)
    expect(result).not.toHaveProperty('exposure')
  })

  it('still starts the container when detection fails', async () => {
    const calls = installScriptedExec((args) => (args[0] === 'inspect' ? { error: new Error('inspect timed out') } : {}))
    const result = await startContainer('bat-dev')

    expect(calls.map((call) => call.args[0])).toEqual(['inspect', 'start', 'exec'])
    expect(result.ok).toBe(true)
    expect(result).not.toHaveProperty('exposure')
  })

  it('never removes or recreates the container', async () => {
    const calls = installScriptedExec(inspectReply(inspectJson({ '9876/tcp': [{ HostIp: '0.0.0.0', HostPort: '9876' }] }, OLD_ENTRYPOINT)))
    await startContainer('bat-dev')

    for (const call of calls) expect(['rm', 'run', 'create', 'stop', 'update']).not.toContain(call.args[0])
  })

  it('does not inspect on the create path', async () => {
    const calls = installScriptedExec(() => ({}))
    await startContainer('bat-dev', { createIfMissing: true, image: 'bat-server:latest', token: 'tok' })

    expect(calls.map((call) => call.args[0])).toEqual(['run'])
  })
})

describe('docker/Dockerfile contract (BUG-097)', () => {
  const dockerfile = readFileSync(path.join(__dirname, '..', '..', 'docker', 'Dockerfile'), 'utf8')

  it('binds bat-server to all container interfaces via ENTRYPOINT', () => {
    expect(dockerfile).toMatch(
      /^ENTRYPOINT \["\/usr\/bin\/tini", "--", "\/opt\/bat-server\/bin\/bat-server", "--bind-interface", "all"\]$/m,
    )
  })

  it('health-checks with a TLS handshake, not a plaintext or /health probe', () => {
    const start = dockerfile.search(/^HEALTHCHECK /m)
    expect(start).toBeGreaterThanOrEqual(0)
    const healthcheck = dockerfile.slice(start, dockerfile.indexOf('\n#', start))
    expect(healthcheck).toContain('require("tls").connect')
    expect(healthcheck).toContain('process.env.BAT_SERVER_PORT')
    expect(healthcheck).not.toMatch(/\/health\b/)
    expect(healthcheck).not.toMatch(/http:\/\//)
    expect(dockerfile).toMatch(/^ENV BAT_SERVER_PORT=9876$/m)
  })
})
