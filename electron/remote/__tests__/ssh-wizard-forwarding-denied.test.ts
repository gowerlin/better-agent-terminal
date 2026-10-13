// @vitest-environment node
/**
 * T0517 (BUG-124): a target sshd with `AllowTcpForwarding no` lets the wizard's
 * `ssh -L` start, then refuses every forwarded connection
 * (`channel N: open failed: administratively prohibited: open failed`).
 *   - SshTunnel classifies that stderr line as `forwarding-denied`.
 *   - WizardTunnelRegistry remembers it per session; `status()` reports it
 *     (waiting briefly for a line ssh has not printed yet).
 * No real ssh subprocess or TCP connection: spawn / net are injected.
 */
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import type { Socket } from 'net'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

import { SshTunnel, type SshTunnelDeps, type SshTunnelOptions, type SshTunnelWarning } from '../ssh-tunnel'
import { WizardTunnelRegistry, type WizardTunnelHandle, type WizardTunnelRequest } from '../ssh-wizard-verify'

const DENIED_LINE = 'channel 2: open failed: administratively prohibited: open failed'

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

function makeTunnel(): { tunnel: SshTunnel; proc: () => FakeProc } {
  let spawned: FakeProc | null = null
  const deps: SshTunnelDeps = {
    spawn: () => {
      spawned = makeFakeProc()
      return spawned as unknown as ChildProcess
    },
    createConnection: () => {
      const sock = new EventEmitter() as EventEmitter & { destroy(): void }
      sock.destroy = () => undefined
      setImmediate(() => sock.emit('connect'))
      return sock as unknown as Socket
    },
  }
  const options: SshTunnelOptions = { sshHost: 'devbox.example', sshUser: 'alice', remotePort: 9876, localPort: 53111 }
  return {
    tunnel: new SshTunnel(options, deps),
    proc: () => {
      if (!spawned) throw new Error('ssh not spawned')
      return spawned
    },
  }
}

async function warningsFor(stderr: string): Promise<SshTunnelWarning[]> {
  const { tunnel, proc } = makeTunnel()
  const warnings: SshTunnelWarning[] = []
  tunnel.on('warning', (warning: SshTunnelWarning) => warnings.push(warning))
  await tunnel.start()
  proc().stderr.emit('data', Buffer.from(stderr))
  await tunnel.stop()
  return warnings
}

describe('SshTunnel stderr classification (T0517 / BUG-124)', () => {
  it('classifies the sshd refusal as forwarding-denied', async () => {
    const warnings = await warningsFor(`${DENIED_LINE}\n`)
    expect(warnings).toEqual([{ kind: 'forwarding-denied', text: `${DENIED_LINE}\n` }])
  })

  it('matches the refusal inside a multi-line chunk (CRLF)', async () => {
    const warnings = await warningsFor(`Warning: Permanently added 'devbox' (ED25519) to the list of known hosts.\r\n${DENIED_LINE}\r\n`)
    expect(warnings.map((w) => w.kind)).toEqual(['forwarding-denied'])
  })

  it('leaves the existing kinds unchanged', async () => {
    expect((await warningsFor('alice@devbox: Permission denied (publickey).')).map((w) => w.kind)).toEqual(['permission-denied'])
    expect((await warningsFor('ssh: connect to host devbox port 22: Connection refused')).map((w) => w.kind)).toEqual(['connection-refused'])
    expect((await warningsFor('Host key verification failed.')).map((w) => w.kind)).toEqual(['host-key-verification'])
    // remote bat-server not listening is a different failure (connect failed), not a refusal
    expect((await warningsFor('channel 2: open failed: connect failed: Connection refused')).map((w) => w.kind)).toEqual(['connection-refused'])
    expect(await warningsFor('debug1: some unrelated line')).toEqual([])
  })
})

class FakeTunnel extends EventEmitter implements WizardTunnelHandle {
  alive = false
  constructor(private readonly warnOnStart?: SshTunnelWarning) {
    super()
  }
  async start(): Promise<{ localPort: number }> {
    // The readiness probe already goes through the forward, so the refusal
    // can arrive before start() resolves.
    if (this.warnOnStart) this.emit('warning', this.warnOnStart)
    this.alive = true
    return { localPort: 53111 }
  }
  async stop(): Promise<void> {
    this.alive = false
  }
  isAlive(): boolean {
    return this.alive
  }
}

const request: WizardTunnelRequest = { sessionId: 'ssh-verify-t0517', sshHost: 'devbox.example', sshUser: 'alice', remotePort: 9876 }

function makeRegistry(warnOnStart?: SshTunnelWarning) {
  const tunnels: FakeTunnel[] = []
  const registry = new WizardTunnelRegistry({
    createTunnel: () => {
      const tunnel = new FakeTunnel(warnOnStart)
      tunnels.push(tunnel)
      return tunnel
    },
  })
  return { registry, tunnels }
}

describe('WizardTunnelRegistry.status (T0517 / BUG-124)', () => {
  it('reports a refusal seen while the tunnel was starting, with ssh\'s line as detail', async () => {
    const { registry } = makeRegistry({
      kind: 'forwarding-denied',
      text: `Warning: Permanently added 'devbox' to the list of known hosts.\r\n${DENIED_LINE}\r\n`,
    })
    expect(await registry.open(request)).toEqual({ ok: true, localPort: 53111 })
    expect(await registry.status(request.sessionId, 0)).toEqual({ forwardingDenied: true, detail: DENIED_LINE })
  })

  it('reports a refusal that arrives after the handshake failed (within the wait)', async () => {
    const { registry, tunnels } = makeRegistry()
    await registry.open(request)
    setTimeout(() => tunnels[0].emit('warning', { kind: 'forwarding-denied', text: DENIED_LINE }), 20)
    expect(await registry.status(request.sessionId, 1_000)).toEqual({ forwardingDenied: true, detail: DENIED_LINE })
  })

  it('no refusal → not denied once the wait ends; other warnings do not count', async () => {
    const { registry, tunnels } = makeRegistry()
    await registry.open(request)
    tunnels[0].emit('warning', { kind: 'connection-refused', text: 'channel 2: open failed: connect failed: Connection refused' })
    const startedAt = Date.now()
    expect(await registry.status(request.sessionId, 120)).toEqual({ forwardingDenied: false, detail: null })
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(100)
  })

  it('does not wait on a dead tunnel or an unknown session', async () => {
    const { registry, tunnels } = makeRegistry()
    await registry.open(request)
    tunnels[0].alive = false
    const startedAt = Date.now()
    expect(await registry.status(request.sessionId, 5_000)).toEqual({ forwardingDenied: false, detail: null })
    expect(await registry.status('ssh-verify-unknown', 5_000)).toEqual({ forwardingDenied: false, detail: null })
    expect(Date.now() - startedAt).toBeLessThan(1_000)
  })

  it('a closed session forgets the refusal; a reopened tunnel starts clean', async () => {
    const { registry, tunnels } = makeRegistry()
    await registry.open(request)
    tunnels[0].emit('warning', { kind: 'forwarding-denied', text: DENIED_LINE })
    await registry.close(request.sessionId)
    expect(await registry.status(request.sessionId, 0)).toEqual({ forwardingDenied: false, detail: null })
    await registry.open(request)
    expect(tunnels).toHaveLength(2)
    expect(await registry.status(request.sessionId, 0)).toEqual({ forwardingDenied: false, detail: null })
  })
})
