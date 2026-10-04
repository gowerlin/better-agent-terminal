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
