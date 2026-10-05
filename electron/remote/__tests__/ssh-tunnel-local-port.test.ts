// @vitest-environment node
/**
 * T0465 (PLAN-039): SSH tunnel local-port robustness.
 *
 * - `pickFreePort()` closes its probe server before `ssh -L` binds the port, so
 *   another process can take it in between. With a dynamic port, a bind failure
 *   retries once on a fresh port; a second failure takes the existing error path.
 * - A fixed `tunnelLocalPort` shared by two connected profiles warns (no block).
 *
 * No real ssh subprocess, server or TCP connection is created: spawn / net are
 * injected through SshTunnelDeps (T0284 守則 #8).
 */
import { EventEmitter } from 'events'
import type { Server, Socket } from 'net'
import type { ChildProcess } from 'child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../logger'
import type { ProfileEntry } from '../../profile-manager'
import { SshTunnel, type SshTunnelDeps, type SshTunnelOptions } from '../ssh-tunnel'
import { RemoteClient, claimFixedTunnelPort, releaseFixedTunnelPort } from '../remote-client'

interface FakeProc extends EventEmitter {
  stderr: EventEmitter
  exitCode: number | null
  kill(sig?: NodeJS.Signals | number): boolean
}

function makeFakeProc(): FakeProc {
  const proc = new EventEmitter() as FakeProc
  proc.stderr = new EventEmitter()
  proc.exitCode = null
  proc.kill = (sig?: NodeJS.Signals | number) => {
    if (proc.exitCode === null) {
      proc.exitCode = 143
      setImmediate(() => proc.emit('exit', 143, sig ?? null))
    }
    return true
  }
  return proc
}

/** How a spawned ssh behaves: `ready` binds the forward, otherwise it exits. */
type SshBehaviour =
  | { kind: 'ready' }
  | { kind: 'exit'; code: number; stderr?: string }

/**
 * Fake ssh + net. `freePorts` is what successive `listen(0)` calls hand out;
 * `inUsePorts` makes a probe `listen(port)` fail with EADDRINUSE; a port starts
 * accepting TCP only after a `ready` ssh was spawned on it.
 */
function makeHarness(opts: {
  behaviours: SshBehaviour[]
  freePorts?: number[]
  inUsePorts?: number[]
}) {
  const freePorts = [...(opts.freePorts ?? [])]
  const inUse = new Set(opts.inUsePorts ?? [])
  const acceptingPorts = new Set<number>()
  const spawnedPorts: number[] = []
  const probedPorts: number[] = []

  const spawn: NonNullable<SshTunnelDeps['spawn']> = (_command, args) => {
    const forward = args[args.indexOf('-L') + 1]
    const port = Number(forward.split(':')[0])
    spawnedPorts.push(port)
    const behaviour = opts.behaviours.shift() ?? { kind: 'exit', code: 255 }
    const proc = makeFakeProc()
    if (behaviour.kind === 'ready') {
      acceptingPorts.add(port)
    } else {
      setImmediate(() => {
        if (behaviour.stderr) proc.stderr.emit('data', Buffer.from(behaviour.stderr))
        proc.exitCode = behaviour.code
        proc.emit('exit', behaviour.code, null)
      })
    }
    return proc as unknown as ChildProcess
  }

  const createServer = (): Server => {
    const srv = new EventEmitter() as EventEmitter & {
      listen: (port: number, host: string, cb: () => void) => void
      address: () => { port: number } | null
      close: (cb?: () => void) => void
    }
    let bound = 0
    srv.listen = (port, _host, cb) => {
      if (port === 0) {
        bound = freePorts.shift() ?? 0
        setImmediate(cb)
        return
      }
      probedPorts.push(port)
      if (inUse.has(port)) {
        const err = Object.assign(new Error(`listen EADDRINUSE: address already in use 127.0.0.1:${port}`), {
          code: 'EADDRINUSE',
        })
        setImmediate(() => srv.emit('error', err))
        return
      }
      bound = port
      setImmediate(cb)
    }
    srv.address = () => (bound ? { port: bound } : null)
    srv.close = (cb) => { if (cb) setImmediate(cb) }
    return srv as unknown as Server
  }

  const createConnection = ({ port }: { host: string; port: number }): Socket => {
    const sock = new EventEmitter() as EventEmitter & { destroy: () => void }
    sock.destroy = () => {}
    setImmediate(() => {
      if (acceptingPorts.has(port)) sock.emit('connect')
      else sock.emit('error', new Error('ECONNREFUSED'))
    })
    return sock as unknown as Socket
  }

  const deps: SshTunnelDeps = { spawn, createServer, createConnection, pollIntervalMs: 5, readyTimeoutMs: 500 }
  return { deps, spawnedPorts, probedPorts }
}

const baseOpts: SshTunnelOptions = { sshHost: 'devbox.example', sshUser: 'alice', remotePort: 9876 }
const BIND_STDERR = 'bind [127.0.0.1]:51001: Address already in use\r\nchannel_setup_fwd_listener_tcpip: cannot listen to port: 51001\r\nCould not request local forwarding.\r\n'

function watchTunnelDown(tunnel: SshTunnel): { count: number } {
  const seen = { count: 0 }
  tunnel.on('tunnel-down', () => { seen.count += 1 })
  return seen
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SshTunnel dynamic local port — bind failure retries once (T0465)', () => {
  it('first bind fails (EADDRINUSE) → retries on a new port and resolves', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const h = makeHarness({
      behaviours: [{ kind: 'exit', code: 255, stderr: BIND_STDERR }, { kind: 'ready' }],
      freePorts: [51001, 51002],
      inUsePorts: [51001],
    })
    const tunnel = new SshTunnel(baseOpts, h.deps)
    const down = watchTunnelDown(tunnel)

    await expect(tunnel.start()).resolves.toEqual({ localPort: 51002 })
    expect(h.spawnedPorts).toEqual([51001, 51002])
    expect(tunnel.localPort).toBe(51002)
    expect(tunnel.isAlive()).toBe(true)
    expect(down.count).toBe(0)
    await tunnel.stop()
  })

  it('both binds fail → existing error path (rejects, tunnel-down once, no third spawn)', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const h = makeHarness({
      behaviours: [
        { kind: 'exit', code: 255, stderr: BIND_STDERR },
        { kind: 'exit', code: 255, stderr: BIND_STDERR.replace(/51001/g, '51002') },
      ],
      freePorts: [51001, 51002, 51003],
      inUsePorts: [51001, 51002],
    })
    const tunnel = new SshTunnel(baseOpts, h.deps)
    const down = watchTunnelDown(tunnel)

    await expect(tunnel.start()).rejects.toThrow('ssh process exited before tunnel became ready')
    expect(h.spawnedPorts).toEqual([51001, 51002])
    expect(down.count).toBe(1)
    expect(tunnel.isAlive()).toBe(false)
  })

  it('structured signal decides: exit 255 + probe EADDRINUSE retries even without stderr text', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const h = makeHarness({
      behaviours: [{ kind: 'exit', code: 255 }, { kind: 'ready' }],
      freePorts: [51001, 51002],
      inUsePorts: [51001],
    })
    const tunnel = new SshTunnel(baseOpts, h.deps)

    await expect(tunnel.start()).resolves.toEqual({ localPort: 51002 })
    expect(h.probedPorts).toEqual([51001])
    await tunnel.stop()
  })

  it('stderr fallback: port already released at probe time, ssh bind message still retries', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const h = makeHarness({
      behaviours: [{ kind: 'exit', code: 255, stderr: BIND_STDERR }, { kind: 'ready' }],
      freePorts: [51001, 51002],
    })
    const tunnel = new SshTunnel(baseOpts, h.deps)

    await expect(tunnel.start()).resolves.toEqual({ localPort: 51002 })
    expect(h.spawnedPorts).toEqual([51001, 51002])
    await tunnel.stop()
  })

  it('non-bind exit (auth failure) → no retry, original error, tunnel-down once', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const h = makeHarness({
      behaviours: [{ kind: 'exit', code: 255, stderr: 'alice@devbox.example: Permission denied (publickey).\r\n' }],
      freePorts: [51001, 51002],
    })
    const tunnel = new SshTunnel(baseOpts, h.deps)
    const down = watchTunnelDown(tunnel)

    await expect(tunnel.start()).rejects.toThrow('ssh process exited before tunnel became ready')
    expect(h.spawnedPorts).toEqual([51001])
    expect(down.count).toBe(1)
  })

  it('exit code other than 255 is never treated as a bind failure', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const h = makeHarness({
      behaviours: [{ kind: 'exit', code: 1, stderr: BIND_STDERR }],
      freePorts: [51001, 51002],
      inUsePorts: [51001],
    })
    const tunnel = new SshTunnel(baseOpts, h.deps)

    await expect(tunnel.start()).rejects.toThrow('ssh process exited before tunnel became ready')
    expect(h.spawnedPorts).toEqual([51001])
  })
})

describe('SshTunnel fixed local port — no retry (T0465)', () => {
  it('bind failure on a fixed port takes the existing error path', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const h = makeHarness({
      behaviours: [{ kind: 'exit', code: 255, stderr: BIND_STDERR.replace(/51001/g, '40100') }],
      inUsePorts: [40100],
    })
    const tunnel = new SshTunnel({ ...baseOpts, localPort: 40100 }, h.deps)
    const down = watchTunnelDown(tunnel)

    await expect(tunnel.start()).rejects.toThrow('ssh process exited before tunnel became ready')
    expect(h.spawnedPorts).toEqual([40100])
    expect(h.probedPorts).toEqual([])
    expect(down.count).toBe(1)
  })
})

function sshProfile(id: string, tunnelLocalPort?: number): ProfileEntry {
  return {
    id,
    name: id,
    type: 'remote',
    remoteHost: 'localhost',
    remotePort: 9876,
    targetOS: 'ssh-linux',
    sshHost: `${id}.example`,
    sshUser: 'alice',
    tunnelLocalPort,
    createdAt: 0,
    updatedAt: 0,
  }
}

/** Runs the tunnel setup `connect()` makes, without spawning ssh. */
function prepareTunnel(client: RemoteClient): void {
  ;(client as unknown as { maybeCreateTunnel: () => void }).maybeCreateTunnel()
}

function duplicatePortWarnings(warn: ReturnType<typeof vi.spyOn>): string[] {
  return warn.mock.calls
    .map((args: unknown[]) => String(args[0]))
    .filter((msg: string) => msg.includes('fixed tunnelLocalPort'))
}

describe('fixed tunnelLocalPort shared by profiles — warn, not block (T0465)', () => {
  it('claimFixedTunnelPort reports other profiles; release clears them', () => {
    expect(claimFixedTunnelPort(40200, 'p-a')).toEqual([])
    expect(claimFixedTunnelPort(40200, 'p-a')).toEqual([])
    expect(claimFixedTunnelPort(40200, 'p-b')).toEqual(['p-a'])
    releaseFixedTunnelPort(40200, 'p-b')
    releaseFixedTunnelPort(40200, 'p-a')
    expect(claimFixedTunnelPort(40200, 'p-c')).toEqual(['p-a'])
    releaseFixedTunnelPort(40200, 'p-a')
    releaseFixedTunnelPort(40200, 'p-c')
    expect(claimFixedTunnelPort(40200, 'p-d')).toEqual([])
    releaseFixedTunnelPort(40200, 'p-d')
  })

  it('second profile on the same fixed port warns and still gets its tunnel', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const a = new RemoteClient(() => [], sshProfile('p-a', 40300))
    const b = new RemoteClient(() => [], sshProfile('p-b', 40300))
    prepareTunnel(a)
    expect(duplicatePortWarnings(warn)).toEqual([])
    prepareTunnel(b)

    const warnings = duplicatePortWarnings(warn)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('profile p-b uses fixed tunnelLocalPort 40300')
    expect(warnings[0]).toContain('p-a')
    expect((b as unknown as { tunnel: unknown }).tunnel).not.toBeNull()

    await a.disconnect()
    await b.disconnect()
  })

  it('after the first profile disconnects, reusing its fixed port does not warn', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    const a = new RemoteClient(() => [], sshProfile('p-a', 40400))
    prepareTunnel(a)
    await a.disconnect()

    const b = new RemoteClient(() => [], sshProfile('p-b', 40400))
    prepareTunnel(b)
    expect(duplicatePortWarnings(warn)).toEqual([])
    await b.disconnect()
  })

  it('different fixed ports, dynamic ports, and the same profile twice do not warn', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    const clients = [
      new RemoteClient(() => [], sshProfile('p-a', 40500)),
      new RemoteClient(() => [], sshProfile('p-b', 40501)),
      new RemoteClient(() => [], sshProfile('p-c')),
      new RemoteClient(() => [], sshProfile('p-d')),
      new RemoteClient(() => [], sshProfile('p-a', 40500)),
    ]
    clients.forEach(prepareTunnel)
    expect(duplicatePortWarnings(warn)).toEqual([])
    await Promise.all(clients.map(c => c.disconnect()))
  })
})
