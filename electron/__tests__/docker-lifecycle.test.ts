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
  BAT_SERVER_LABEL,
  DOCKER_PUBLISH_HOST,
  buildCreateContainerArgs,
  detectContainerExposure,
  getContainerHealth,
  getContainerLogs,
  readCommandFlag,
  readServerToken,
  resetExecFileImplForTests,
  resolveServerTokenPath,
  restartContainer,
  setExecFileImplForTests,
  startContainer,
  stopContainer,
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
    const result = await startContainer('bat-dev', { createIfMissing: true, image: 'bat-server:latest' })

    expect(result).toEqual({ ok: true })
    expect(DOCKER_PUBLISH_HOST).toBe('127.0.0.1')
    expect(calls).toHaveLength(1)
    expect(calls[0].file).toBe('docker')
    expect(calls[0].args[0]).toBe('run')
    expect(publishValues(calls[0].args)).toEqual(['127.0.0.1:9876:9876'])
  })

  it('keeps the loopback prefix for a custom host port', async () => {
    const calls = installExec()
    await startContainer('bat-dev', { createIfMissing: true, image: 'bat-server:latest', port: 19876 })

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

  it('reports a failed `docker run` without a token (T0452 → T0849: the token is read from the container later)', async () => {
    setExecFileImplForTests((_file: string, _args: string[], _options: unknown, callback: (...cbArgs: unknown[]) => void) => {
      callback(new Error('exit 125'), '', 'Bind for 127.0.0.1:9876 failed: port is already allocated')
    })

    expect(await startContainer('bat-dev', { createIfMissing: true, image: 'bat-server:latest' })).toEqual({
      ok: false,
      error: 'Bind for 127.0.0.1:9876 failed: port is already allocated',
    })
  })
})

/**
 * T0849 (D283): a new container no longer gets `--token` on its command line
 * (`docker inspect`, `ps`); the server generates its own and the wizard reads
 * it once healthy. The container carries the `bat.server=1` label.
 */
describe('buildCreateContainerArgs (T0849)', () => {
  const full = buildCreateContainerArgs('bat-dev', {
    image: 'bat-server:latest',
    port: 19877,
    mounts: [{ host: 'C:\\src\\app', container: '/workspace/app' }],
    restartPolicy: 'unless-stopped',
    dataVolume: 'bat-server-bat-dev-data',
  })

  it('has no --token anywhere', () => {
    expect(full.some((arg) => arg === '--token' || arg.startsWith('--token='))).toBe(false)
  })

  it('publishes on 127.0.0.1 only', () => {
    expect(publishValues(full)).toEqual(['127.0.0.1:19877:9876'])
  })

  it('labels the container bat.server=1', () => {
    expect(BAT_SERVER_LABEL).toBe('bat.server=1')
    expect(full[full.indexOf('--label') + 1]).toBe('bat.server=1')
  })

  it('keeps the rest of the command as before', () => {
    expect(full).toEqual([
      'run', '-d', '--name', 'bat-dev', '--restart', 'unless-stopped',
      '--label', 'bat.server=1',
      '-p', '127.0.0.1:19877:9876',
      '-v', 'C:\\src\\app:/workspace/app',
      '-v', 'bat-server-bat-dev-data:/root/.local/share/bat-server',
      'bat-server:latest', '--port', '9876',
    ])
  })

  it('defaults to host port 9876 and unless-stopped', () => {
    expect(buildCreateContainerArgs('bat-dev', { image: 'img' })).toEqual([
      'run', '-d', '--name', 'bat-dev', '--restart', 'unless-stopped', '--label', 'bat.server=1',
      '-p', '127.0.0.1:9876:9876', 'img', '--port', '9876',
    ])
  })

  it('is what startContainer runs, with no timeout (docker run may pull the image)', async () => {
    const calls = installScriptedExec(() => ({}))
    await startContainer('bat-dev', { createIfMissing: true, image: 'img', port: 19877 })

    expect(calls).toHaveLength(1)
    expect(calls[0].args).toEqual(buildCreateContainerArgs('bat-dev', { image: 'img', port: 19877 }))
    expect(calls[0].options).not.toHaveProperty('timeout')
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

    expect(calls.map((call) => call.args[0])).toEqual(['inspect', 'start'])
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

    expect(calls.map((call) => call.args[0])).toEqual(['inspect', 'start'])
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
    await startContainer('bat-dev', { createIfMissing: true, image: 'bat-server:latest' })

    expect(calls.map((call) => call.args[0])).toEqual(['run'])
  })

  it('does not read the token (T0849: the wizard reads it once the container is healthy)', async () => {
    const calls = installScriptedExec(inspectReply(inspectJson({ '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '9876' }] })))
    const result = await startContainer('bat-dev', { port: 9876 })

    expect(calls.some((call) => call.args[0] === 'exec')).toBe(false)
    expect(result).not.toHaveProperty('token')
  })
})

describe('readCommandFlag (T0849)', () => {
  it.each([
    [['--port', '9876', '--token', 'abc'], 'abc'],
    [['--token=abc'], 'abc'],
    [['--token', 'first', '--token=second'], 'second'],
    [['--token'], null],
    [['--token', '--port', '9876'], null],
    [['--token='], null],
    [['--tokens', 'x', 'token', 'y'], null],
    [[], null],
  ])('%j → %j', (command, expected) => {
    expect(readCommandFlag(command, 'token')).toBe(expected)
  })
})

describe('resolveServerTokenPath (T0849)', () => {
  const entry = (config: Record<string, unknown>) => ({ Config: config })

  it('uses --data-dir from Entrypoint / Cmd first', () => {
    expect(resolveServerTokenPath(entry({
      Entrypoint: ['/opt/bat/server/bin/bat-server'],
      Cmd: ['--data-dir', '/var/lib/bat-server', '--port', '9876'],
      Env: ['HOME=/home/dev', 'XDG_DATA_HOME=/xdg', 'BAT_SERVER_DATA_DIR=/env-dir'],
    }))).toBe('/var/lib/bat-server/server-token.json')
    expect(resolveServerTokenPath(entry({ Entrypoint: ['bat-server', '--data-dir=/data/'] })))
      .toBe('/data/server-token.json')
  })

  it('resolves a relative --data-dir against WorkingDir (or /)', () => {
    expect(resolveServerTokenPath(entry({ Cmd: ['--data-dir', 'state'], WorkingDir: '/srv/app' })))
      .toBe('/srv/app/state/server-token.json')
    expect(resolveServerTokenPath(entry({ Cmd: ['--data-dir', 'state'] }))).toBe('/state/server-token.json')
  })

  it('then env BAT_SERVER_DATA_DIR, XDG_DATA_HOME, HOME — the bat-server resolveDataDir order', () => {
    expect(resolveServerTokenPath(entry({ Env: ['HOME=/home/dev', 'XDG_DATA_HOME=/xdg', 'BAT_SERVER_DATA_DIR=/env-dir'] })))
      .toBe('/env-dir/server-token.json')
    expect(resolveServerTokenPath(entry({ Env: ['HOME=/home/dev', 'XDG_DATA_HOME=/xdg'] })))
      .toBe('/xdg/bat-server/server-token.json')
    expect(resolveServerTokenPath(entry({ Env: ['PATH=/usr/bin', 'HOME=/home/dev'] })))
      .toBe('/home/dev/.local/share/bat-server/server-token.json')
  })

  it('ignores empty env values', () => {
    expect(resolveServerTokenPath(entry({ Env: ['XDG_DATA_HOME=', 'HOME=/home/dev'] })))
      .toBe('/home/dev/.local/share/bat-server/server-token.json')
  })

  it('falls back to /root/.local/share/bat-server (the image default)', () => {
    expect(resolveServerTokenPath(entry({ Env: ['PATH=/usr/bin'] }))).toBe('/root/.local/share/bat-server/server-token.json')
    expect(resolveServerTokenPath({})).toBe('/root/.local/share/bat-server/server-token.json')
    expect(resolveServerTokenPath(null)).toBe('/root/.local/share/bat-server/server-token.json')
  })
})

describe('readServerToken (T0849)', () => {
  const FILE_TOKEN = 'file-token-AbC_123'
  const CMD_TOKEN = 'legacy-cmd-token-0123'

  function inspectOf(config: Record<string, unknown>): string {
    return JSON.stringify([{ Config: config }])
  }

  function script(options: { inspect: string | Error; cat?: { stdout?: string; error?: Error } }): ScriptedCall[] {
    return installScriptedExec((args) => {
      if (args[0] === 'inspect') {
        return options.inspect instanceof Error ? { error: options.inspect } : { stdout: options.inspect }
      }
      if (args[0] === 'exec') {
        return options.cat?.error
          ? { error: options.cat.error, stderr: 'cat: /x: No such file or directory' }
          : { stdout: options.cat?.stdout ?? '' }
      }
      return {}
    })
  }

  it('reads server-token.json (plaintext strategy) from the resolved data dir', async () => {
    const calls = script({
      inspect: inspectOf({ Cmd: ['--data-dir', '/var/lib/bat-server', '--token', CMD_TOKEN] }),
      cat: { stdout: JSON.stringify({ v: 1, encrypted: false, data: FILE_TOKEN }) },
    })

    expect(await readServerToken('bat-dev')).toEqual({ ok: true, token: FILE_TOKEN, source: 'file' })
    expect(calls.map((call) => call.args)).toEqual([
      ['inspect', '--type', 'container', 'bat-dev'],
      ['exec', 'bat-dev', 'cat', '/var/lib/bat-server/server-token.json'],
    ])
    expect(calls[0].options.timeout).toBe(5_000)
    expect(calls[1].options.timeout).toBe(30_000)
  })

  it('accepts the older { token } file shape', async () => {
    script({ inspect: inspectOf({}), cat: { stdout: JSON.stringify({ token: FILE_TOKEN }) } })
    expect(await readServerToken('bat-dev')).toEqual({ ok: true, token: FILE_TOKEN, source: 'file' })
  })

  it('falls back to a legacy --token when the file cannot be read', async () => {
    script({
      inspect: inspectOf({ Entrypoint: NEW_ENTRYPOINT, Cmd: ['--port', '9876', '--token', CMD_TOKEN] }),
      cat: { error: new Error('exit 1') },
    })
    expect(await readServerToken('bat-dev')).toEqual({ ok: true, token: CMD_TOKEN, source: 'command' })
  })

  it('falls back to --token when the file is encrypted (not readable outside the server)', async () => {
    script({
      inspect: inspectOf({ Cmd: [`--token=${CMD_TOKEN}`] }),
      cat: { stdout: JSON.stringify({ v: 1, encrypted: true, data: 'b64…' }) },
    })
    expect(await readServerToken('bat-dev')).toEqual({ ok: true, token: CMD_TOKEN, source: 'command' })
  })

  it('reports docker-token-unavailable without leaking env / command values', async () => {
    script({
      inspect: inspectOf({ Cmd: ['--port', '9876'], Env: ['SECRET_API_KEY=sk-live-should-not-leak', 'HOME=/home/dev'] }),
      cat: { error: new Error('exit 1') },
    })
    const result = await readServerToken('bat-dev')

    expect(result).toMatchObject({ ok: false, errorCode: 'docker-token-unavailable' })
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toContain('/home/dev/.local/share/bat-server/server-token.json')
    expect(result.error).toContain('docker logs bat-dev')
    expect(result.error).not.toContain('sk-live-should-not-leak')
  })

  it('reports docker-inspect-failed when the container cannot be inspected', async () => {
    const calls = script({ inspect: new Error('No such container: bat-dev') })
    expect(await readServerToken('bat-dev')).toMatchObject({ ok: false, errorCode: 'docker-inspect-failed' })
    expect(calls).toHaveLength(1)

    script({ inspect: '[]' })
    expect(await readServerToken('bat-dev')).toMatchObject({ ok: false, errorCode: 'docker-inspect-failed' })
  })

  it('never re-issues a token or changes the container (BUG-111)', async () => {
    const calls = script({ inspect: inspectOf({}), cat: { error: new Error('exit 1') } })
    await readServerToken('bat-dev')

    for (const call of calls) expect(['inspect', 'exec']).toContain(call.args[0])
    expect(calls.filter((call) => call.args[0] === 'exec').map((call) => call.args.slice(2, 3))).toEqual([['cat']])
  })

  it('does not run docker for an invalid container name', async () => {
    const calls = script({ inspect: inspectOf({}) })
    expect(await readServerToken('bad name;rm')).toMatchObject({ ok: false, errorCode: 'docker-inspect-failed' })
    expect(calls).toHaveLength(0)
  })
})

describe('docker call timeouts (T0849)', () => {
  it('IO calls time out at 30s, detect calls at 5s', async () => {
    const calls = installScriptedExec(() => ({ stdout: 'healthy' }))
    await startContainer('bat-dev')
    await stopContainer('bat-dev')
    await stopContainer('bat-dev', { remove: true })
    await restartContainer('bat-dev')
    await getContainerLogs('bat-dev')
    await getContainerHealth('bat-dev')

    expect(calls.map((call) => [call.args[0], call.options.timeout])).toEqual([
      ['inspect', 5_000],
      ['start', 30_000],
      ['stop', 30_000],
      ['rm', 30_000],
      ['restart', 30_000],
      ['logs', 30_000],
      ['inspect', 5_000],
    ])
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
