/**
 * T0849: every docker call in docker-detect has the 5s detect timeout, and
 * `docker:inspect-container` no longer hands the container's `Config.Env` to
 * the renderer (a user's container env may hold secrets; the renderer only
 * uses image / state). execFile is injected — no real docker is spawned.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  DOCKER_DETECT_TIMEOUT_MS,
  dockerStatus,
  inspectContainer,
  listContainers,
  parsePsLabels,
  parsePsPublishedServerPort,
  resetExecFileImplForTests,
  setExecFileImplForTests,
} from '../docker-detect'

interface Call {
  args: string[]
  options: Record<string, unknown>
}

function installExec(reply: (args: string[]) => { stdout?: string; error?: Error }): Call[] {
  const calls: Call[] = []
  setExecFileImplForTests((_file: string, args: string[], options: Record<string, unknown>, callback: (...cbArgs: unknown[]) => void) => {
    calls.push({ args, options })
    const { stdout = '', error = null } = reply(args)
    callback(error, stdout, '')
  })
  return calls
}

const INSPECT = JSON.stringify([{
  Id: 'abc123',
  Name: '/bat-dev',
  Config: {
    Image: 'bat-server:latest',
    Env: ['SECRET_API_KEY=sk-live-should-not-leak', 'PATH=/usr/bin'],
    Cmd: ['--port', '9876', '--token', 'legacy-token-should-not-leak'],
  },
  State: { Status: 'running', Running: true, Health: { Status: 'healthy' } },
  Mounts: [{ Type: 'bind', Source: '/src', Destination: '/workspace/src' }],
  NetworkSettings: { Ports: { '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '19877' }] } },
}])

afterEach(() => {
  resetExecFileImplForTests()
})

describe('docker-detect timeouts (T0849)', () => {
  it('uses a 5s timeout for status, list and inspect', async () => {
    const calls = installExec((args) => (args[0] === 'inspect' ? { stdout: INSPECT } : { stdout: '' }))
    await dockerStatus()
    await listContainers()
    await inspectContainer('bat-dev')

    expect(DOCKER_DETECT_TIMEOUT_MS).toBe(5_000)
    expect(calls.map((call) => call.args[0])).toEqual(['--version', 'info', 'ps', 'inspect'])
    for (const call of calls) expect(call.options.timeout).toBe(5_000)
  })

  it('reports docker unavailable when a call times out', async () => {
    installExec(() => ({ error: Object.assign(new Error('Command failed: docker info'), { killed: true, signal: 'SIGTERM' }) }))
    expect(await dockerStatus()).toMatchObject({ available: false })
  })
})

describe('inspectContainer (T0849)', () => {
  it('returns image / state / mounts / ports and no env', async () => {
    installExec(() => ({ stdout: INSPECT }))
    const result = await inspectContainer('bat-dev')

    expect(result).toEqual({
      id: 'abc123',
      name: 'bat-dev',
      image: 'bat-server:latest',
      state: { status: 'running', running: true, health: 'healthy' },
      mounts: [{ source: '/src', destination: '/workspace/src', type: 'bind' }],
      ports: ['9876/tcp'],
    })
    expect(result).not.toHaveProperty('env')
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('sk-live-should-not-leak')
    expect(serialized).not.toContain('legacy-token-should-not-leak')
  })

  it('rejects an invalid container name without running docker', async () => {
    const calls = installExec(() => ({ stdout: INSPECT }))
    await expect(inspectContainer('bad name;rm')).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })
})

describe('listContainers (T0851)', () => {
  const PS = [
    { ID: 'aaaaaaaaaaaa', Names: 'bat-mine', Image: 'bat-server:latest', State: 'running', Status: 'Up 1 hour', Ports: '127.0.0.1:19877->9876/tcp', Labels: 'bat.server=1,other=x', CreatedAt: '2026-11-04 10:00:00 +0800 CST' },
    { ID: 'bbbbbbbbbbbb', Names: 'user-stopped', Image: 'alpine', State: 'exited', Status: 'Exited (0)', Ports: '', Labels: '', CreatedAt: '2026-11-03 10:00:00 +0800 CST' },
    { ID: 'cccccccccccc', Names: 'no-port', Image: 'debian', State: 'running', Status: 'Up', Ports: '', Labels: 'bat.server=0', CreatedAt: '2026-11-02 10:00:00 +0800 CST' },
  ].map((row) => JSON.stringify(row)).join('\n')
  const INSPECT_ALL = JSON.stringify([
    { Id: 'a'.repeat(64), Config: { Labels: { 'bat.server': '1' } }, NetworkSettings: { Ports: { '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '19877' }] } } },
    // Stopped: no live bindings, the requested one still counts.
    { Id: 'b'.repeat(64), Config: { Labels: {} }, NetworkSettings: { Ports: {} }, HostConfig: { PortBindings: { '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '20001' }] } } },
    { Id: 'c'.repeat(64), Config: { Labels: null }, NetworkSettings: { Ports: { '22/tcp': [{ HostPort: '2222' }] } } },
  ])

  it('adds Ports / CreatedAt / created-by-BAT and the published bat-server port from one inspect', async () => {
    const calls = installExec((args) => (args[0] === 'ps' ? { stdout: PS } : { stdout: INSPECT_ALL }))
    const containers = await listContainers()

    expect(calls.map((call) => call.args)).toEqual([
      ['ps', '-a', '--format', '{{json .}}'],
      ['inspect', '--type', 'container', 'aaaaaaaaaaaa', 'bbbbbbbbbbbb', 'cccccccccccc'],
    ])
    for (const call of calls) expect(call.options.timeout).toBe(5_000)
    expect(containers).toEqual([
      { id: 'aaaaaaaaaaaa', name: 'bat-mine', image: 'bat-server:latest', state: 'running', status: 'Up 1 hour', ports: '127.0.0.1:19877->9876/tcp', createdAt: '2026-11-04 10:00:00 +0800 CST', batCreated: true, publishedPort: 19877 },
      { id: 'bbbbbbbbbbbb', name: 'user-stopped', image: 'alpine', state: 'exited', status: 'Exited (0)', ports: '', createdAt: '2026-11-03 10:00:00 +0800 CST', batCreated: false, publishedPort: 20001 },
      { id: 'cccccccccccc', name: 'no-port', image: 'debian', state: 'running', status: 'Up', ports: '', createdAt: '2026-11-02 10:00:00 +0800 CST', batCreated: false, publishedPort: null },
    ])
  })

  it('inspect failure: ports from the docker ps column, unknown otherwise; labels from docker ps', async () => {
    installExec((args) => (args[0] === 'ps' ? { stdout: PS } : { error: new Error('inspect timed out') }))
    const containers = await listContainers()

    expect(containers.map((c) => [c.name, c.publishedPort, c.batCreated])).toEqual([
      ['bat-mine', 19877, true],
      ['user-stopped', undefined, false],
      ['no-port', undefined, false],
    ])
  })

  it('never passes a non-hex id to docker inspect', async () => {
    const ps = JSON.stringify({ ID: 'x; rm -rf /', Names: 'weird', Image: 'i', State: 'running', Status: '', Ports: '', Labels: '' })
    const calls = installExec(() => ({ stdout: ps }))
    const containers = await listContainers()

    expect(calls).toHaveLength(1)
    expect(containers[0].publishedPort).toBeUndefined()
  })

  it('parses docker ps labels and Ports', () => {
    expect(parsePsLabels('bat.server=1,a=b=c,broken,=x')).toEqual({ 'bat.server': '1', a: 'b=c' })
    expect(parsePsLabels(undefined)).toEqual({})
    expect(parsePsPublishedServerPort('0.0.0.0:8080->80/tcp, 127.0.0.1:19877->9876/tcp, [::]:19877->9876/tcp')).toBe(19877)
    expect(parsePsPublishedServerPort('9876/tcp')).toBeNull()
    expect(parsePsPublishedServerPort('127.0.0.1:1->98760/tcp')).toBeNull()
    expect(parsePsPublishedServerPort('')).toBeNull()
  })
})
