/**
 * T0649 (BUG-156): the Docker wizard published bat-server on a fixed host
 * 127.0.0.1:9876 — the host RemoteServer's default port on the same address —
 * so "Create new" failed with the port taken. The host port is now picked by
 * the WSL picker (RemoteServer ports excluded, busy ports skipped), and an
 * existing container keeps the port it publishes. execFile and the port probe
 * are injected, except for the one real-socket case.
 */
import * as net from 'net'
import { afterEach, describe, expect, it } from 'vitest'
import {
  pickDockerServerPort,
  publishedServerPort,
  resetExecFileImplForTests,
  setExecFileImplForTests,
} from '../docker-lifecycle'
import {
  pickServerPort,
  resetPortProbeImplForTests,
  SERVER_PORT_SCAN_END,
  SERVER_PORT_SCAN_START,
  setPortProbeImplForTests,
} from '../wsl-systemd'

type Reply = { error?: Error; stdout?: string; stderr?: string }

function installExec(reply: (args: string[]) => Reply): string[][] {
  const calls: string[][] = []
  setExecFileImplForTests((_file: string, args: string[], _options: unknown, callback: (...cbArgs: unknown[]) => void) => {
    calls.push(args)
    const { error = null, stdout = '', stderr = '' } = reply(args)
    callback(error, stdout, stderr)
  })
  return calls
}

function inspectJson(entry: Record<string, unknown>): string {
  return JSON.stringify([entry])
}

function busyPorts(ports: number[]): number[] {
  const probed: number[] = []
  setPortProbeImplForTests(async (port) => {
    probed.push(port)
    return !ports.includes(port)
  })
  return probed
}

afterEach(() => {
  resetExecFileImplForTests()
  resetPortProbeImplForTests()
})

describe('pickDockerServerPort for a container to create (T0649)', () => {
  it('never hands out the RemoteServer port, even when the probe finds it free', async () => {
    busyPorts([])
    const result = await pickDockerServerPort({ excludePorts: [9877] })
    expect(result).toEqual({ ok: true, port: 9878 })
  })

  it('skips ports already in use', async () => {
    const probed = busyPorts([9877, 9878])
    const result = await pickDockerServerPort({ excludePorts: [9876] })
    expect(result).toEqual({ ok: true, port: 9879 })
    expect(probed).toEqual([9877, 9878, 9879])
  })

  it('keeps the port of an earlier attempt while it is free', async () => {
    busyPorts([])
    expect(await pickDockerServerPort({ excludePorts: [9876], previousPort: 9950 })).toEqual({ ok: true, port: 9950 })
  })

  it('moves on when the earlier port is taken now', async () => {
    busyPorts([9950])
    expect(await pickDockerServerPort({ excludePorts: [9876], previousPort: 9950 })).toEqual({ ok: true, port: 9877 })
  })

  it('refuses a preferred port that is the RemoteServer port or busy, with Docker wording', async () => {
    busyPorts([20000])
    const own = await pickDockerServerPort({ excludePorts: [9876], preferredPort: 9876 })
    expect(own).toMatchObject({ ok: false, errorCode: 'docker-port-in-use' })
    expect(own.ok ? '' : own.error).toContain("this BAT's own remote server; choose another port for the Docker container")

    const busy = await pickDockerServerPort({ excludePorts: [9876], preferredPort: 20000 })
    expect(busy).toMatchObject({ ok: false, errorCode: 'docker-port-in-use' })
    expect(busy.ok ? '' : busy.error).toContain('already in use on this machine (127.0.0.1)')

    const invalid = await pickDockerServerPort({ excludePorts: [9876], preferredPort: 80 })
    expect(invalid).toMatchObject({ ok: false, errorCode: 'docker-port-invalid' })
  })

  it('reports no free port with Docker wording', async () => {
    setPortProbeImplForTests(async () => false)
    const result = await pickDockerServerPort({ excludePorts: [9876] })
    expect(result).toEqual({
      ok: false,
      errorCode: 'docker-port-in-use',
      error: `No free port between ${SERVER_PORT_SCAN_START} and ${SERVER_PORT_SCAN_END} on this machine (127.0.0.1) for the Docker container.`,
    })
  })

  it('skips a port really held on 127.0.0.1 (real socket)', async () => {
    const holder = net.createServer()
    await new Promise<void>((resolve) => holder.listen({ port: 0, host: '127.0.0.1' }, resolve))
    const held = (holder.address() as net.AddressInfo).port
    try {
      const result = await pickDockerServerPort({ excludePorts: [9876], previousPort: held })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.port).not.toBe(held)
        expect(result.port).toBeGreaterThanOrEqual(SERVER_PORT_SCAN_START)
        expect(result.port).toBeLessThanOrEqual(SERVER_PORT_SCAN_END)
      }
    } finally {
      await new Promise<void>((resolve) => holder.close(() => resolve()))
    }
  })

  it('does not run docker', async () => {
    busyPorts([])
    const calls = installExec(() => ({}))
    await pickDockerServerPort({ excludePorts: [9876] })
    expect(calls).toEqual([])
  })
})

describe('pickDockerServerPort for an existing container (T0649)', () => {
  it('keeps the host port the container publishes, without probing it', async () => {
    const probed = busyPorts([20001])
    const calls = installExec(() => ({
      stdout: inspectJson({ HostConfig: { PortBindings: { '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '20001' }] } } }),
    }))
    const result = await pickDockerServerPort({ excludePorts: [9876], activeServerPort: 9876, container: 'bat-old' })

    expect(result).toEqual({ ok: true, port: 20001, reusedExistingPort: true })
    expect(calls).toEqual([['inspect', '--type', 'container', 'bat-old']])
    expect(probed).toEqual([])
  })

  it('accepts the RemoteServer default when the RemoteServer is not listening on it', async () => {
    installExec(() => ({ stdout: inspectJson({ HostConfig: { PortBindings: { '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '9876' }] } } }) }))
    expect(await pickDockerServerPort({ excludePorts: [9876], activeServerPort: null, container: 'bat-old' }))
      .toEqual({ ok: true, port: 9876, reusedExistingPort: true })
  })

  it('refuses a published port the RemoteServer is listening on (it would reach this BAT)', async () => {
    installExec(() => ({ stdout: inspectJson({ HostConfig: { PortBindings: { '9876/tcp': [{ HostIp: '', HostPort: '9876' }] } } }) }))
    const result = await pickDockerServerPort({ excludePorts: [9876], activeServerPort: 9876, container: 'bat-old' })
    expect(result).toMatchObject({ ok: false, errorCode: 'docker-port-in-use' })
  })

  it('fails clearly when the server port is not published', async () => {
    installExec(() => ({ stdout: inspectJson({ HostConfig: { PortBindings: { '8080/tcp': [{ HostIp: '127.0.0.1', HostPort: '8080' }] } } }) }))
    const result = await pickDockerServerPort({ excludePorts: [9876], container: 'bat-old' })
    expect(result).toMatchObject({ ok: false, errorCode: 'docker-port-unpublished' })
    expect(result.ok ? '' : result.error).toContain('-p 127.0.0.1:<port>:9876')
  })

  it('rejects an invalid container name without running docker', async () => {
    const calls = installExec(() => ({}))
    const result = await pickDockerServerPort({ excludePorts: [9876], container: 'bad name;rm' })
    expect(result).toMatchObject({ ok: false, errorCode: 'docker-inspect-failed' })
    expect(calls).toEqual([])
  })

  it('reports an inspect failure', async () => {
    installExec(() => ({ error: new Error('exit 1'), stderr: 'Error: No such container: bat-old' }))
    expect(await pickDockerServerPort({ excludePorts: [9876], container: 'bat-old' }))
      .toEqual({ ok: false, errorCode: 'docker-inspect-failed', error: 'Error: No such container: bat-old' })
  })
})

describe('publishedServerPort (T0649)', () => {
  it('prefers what docker bound (NetworkSettings) over what was asked for', () => {
    expect(publishedServerPort({
      NetworkSettings: { Ports: { '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '32768' }] } },
      HostConfig: { PortBindings: { '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '' }] } },
    })).toBe(32768)
  })

  it('reads PortBindings of a stopped container', () => {
    expect(publishedServerPort({
      NetworkSettings: { Ports: {} },
      HostConfig: { PortBindings: { '9876/tcp': [{ HostIp: '127.0.0.1', HostPort: '9900' }] } },
    })).toBe(9900)
  })

  it('ignores other container ports and malformed entries', () => {
    expect(publishedServerPort({ HostConfig: { PortBindings: { '8080/tcp': [{ HostPort: '8080' }] } } })).toBeNull()
    expect(publishedServerPort({ NetworkSettings: { Ports: { '9876/tcp': null } } })).toBeNull()
    expect(publishedServerPort(null)).toBeNull()
  })
})

describe('pickServerPort wording (T0649 keeps the WSL messages)', () => {
  it('defaults to the WSL / Windows wording', async () => {
    setPortProbeImplForTests(async () => false)
    const result = await pickServerPort({ excludePorts: [9876] })
    expect(result.ok ? '' : result.error).toBe(
      `No free port between ${SERVER_PORT_SCAN_START} and ${SERVER_PORT_SCAN_END} on Windows (127.0.0.1) for the WSL server.`,
    )
  })
})
