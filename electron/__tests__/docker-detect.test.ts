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
  Mounts: [{ Source: '/src', Destination: '/workspace/src' }],
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
      mounts: [{ source: '/src', destination: '/workspace/src' }],
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
