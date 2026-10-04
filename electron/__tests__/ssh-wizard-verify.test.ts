/**
 * T0387 (BUG-093): SSH wizard verification helpers in main.
 *   - WizardTunnelRegistry: per-session `ssh -L` tunnels (fake tunnels here —
 *     no ssh subprocess is ever spawned), reserved-port guard, cleanup paths.
 *   - readRemoteServerIdentity: one ssh exec (mock spawn) that returns the
 *     remote certificate fingerprint + token; private key never requested.
 *   - fetchTlsFingerprint host validation (new optional host for the wizard).
 */
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

import {
  WizardTunnelRegistry,
  buildIdentityCommand,
  parseIdentityOutput,
  readRemoteServerIdentity,
  remoteServerDataDir,
  type RemoteIdentityDeps,
  type WizardTunnelHandle,
  type WizardTunnelRequest,
} from '../remote/ssh-wizard-verify'
import type { SshTunnelOptions, SshTunnelWarning } from '../remote/ssh-tunnel'
import { fetchTlsFingerprint } from '../tls-fingerprint'

const FP = Array.from({ length: 32 }, (_, i) => (i + 16).toString(16).toUpperCase().padStart(2, '0')).join(':')

class FakeTunnel extends EventEmitter implements WizardTunnelHandle {
  alive = false
  starts = 0
  stops = 0
  constructor(
    public readonly options: SshTunnelOptions,
    private readonly behaviour: { port?: number; fail?: Error; warning?: SshTunnelWarning } = {},
  ) {
    super()
  }
  async start(): Promise<{ localPort: number }> {
    this.starts += 1
    if (this.behaviour.warning) this.emit('warning', this.behaviour.warning)
    if (this.behaviour.fail) throw this.behaviour.fail
    this.alive = true
    return { localPort: this.behaviour.port ?? 53111 }
  }
  async stop(): Promise<void> {
    this.stops += 1
    this.alive = false
  }
  isAlive(): boolean {
    return this.alive
  }
}

function makeRegistry(
  behaviours: Array<ConstructorParameters<typeof FakeTunnel>[1]> = [{}],
  reservedPorts: number[] = [9876],
) {
  const tunnels: FakeTunnel[] = []
  const registry = new WizardTunnelRegistry({
    createTunnel: (options) => {
      const tunnel = new FakeTunnel(options, behaviours[Math.min(tunnels.length, behaviours.length - 1)])
      tunnels.push(tunnel)
      return tunnel
    },
    reservedPorts: () => reservedPorts,
  })
  return { registry, tunnels }
}

const request: WizardTunnelRequest = {
  sessionId: 'ssh-verify-abc123',
  sshHost: 'devbox.example',
  sshUser: 'alice',
  remotePort: 9876,
}

describe('WizardTunnelRegistry (T0387 / BUG-093)', () => {
  it('opens a tunnel to the remote port and returns its OS-assigned local port', async () => {
    const { registry, tunnels } = makeRegistry([{ port: 53111 }])
    const result = await registry.open(request, 7)
    expect(result).toEqual({ ok: true, localPort: 53111 })
    expect(tunnels).toHaveLength(1)
    // remotePort = the bat-server port on the SSH host; localPort left to the OS.
    expect(tunnels[0].options).toEqual({
      sshHost: 'devbox.example',
      sshUser: 'alice',
      sshPort: undefined,
      sshKeyPath: undefined,
      remotePort: 9876,
    })
    expect(registry.size).toBe(1)
  })

  it('reuses a live tunnel for the same session + target', async () => {
    const { registry, tunnels } = makeRegistry()
    await registry.open(request)
    const again = await registry.open(request)
    expect(again).toEqual({ ok: true, localPort: 53111 })
    expect(tunnels).toHaveLength(1)
    expect(tunnels[0].starts).toBe(1)
  })

  it('replaces the tunnel when the target changes (e.g. jump back to configure-host)', async () => {
    const { registry, tunnels } = makeRegistry([{ port: 53111 }, { port: 53222 }])
    await registry.open(request)
    const result = await registry.open({ ...request, sshHost: 'other.example' })
    expect(result).toEqual({ ok: true, localPort: 53222 })
    expect(tunnels[0].stops).toBe(1)
    expect(registry.size).toBe(1)
  })

  it('restarts a tunnel that died (tunnel-down drops the entry)', async () => {
    const { registry, tunnels } = makeRegistry([{ port: 53111 }, { port: 53333 }])
    await registry.open(request)
    tunnels[0].alive = false
    tunnels[0].emit('tunnel-down')
    expect(registry.size).toBe(0)
    expect(await registry.open(request)).toEqual({ ok: true, localPort: 53333 })
  })

  it('tunnel start failure → ssh-tunnel-failed with a readable reason', async () => {
    const { registry } = makeRegistry([{
      fail: new Error('ssh process exited before tunnel became ready'),
      warning: { kind: 'permission-denied', text: 'alice@devbox.example: Permission denied (publickey).' },
    }])
    const result = await registry.open(request)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('ssh-tunnel-failed')
    expect(result.error).toContain('alice@devbox.example')
    expect(result.error).toContain('Permission denied')
    expect(registry.size).toBe(0)
  })

  it('falls back to the raw start error when ssh printed nothing classifiable', async () => {
    const { registry } = makeRegistry([{ fail: new Error('ssh tunnel readiness timeout after 10000ms (127.0.0.1:53111)') }])
    const result = await registry.open(request)
    expect(result).toMatchObject({ ok: false, errorCode: 'ssh-tunnel-failed' })
    if (!result.ok) expect(result.error).toContain('readiness timeout')
  })

  it('never hands out a host RemoteServer port as the local end', async () => {
    const { registry, tunnels } = makeRegistry([{ port: 9876 }], [9876, 9877])
    const result = await registry.open(request)
    expect(result).toMatchObject({ ok: false, errorCode: 'ssh-tunnel-failed' })
    expect(tunnels[0].stops).toBe(1)
    expect(registry.size).toBe(0)
  })

  it.each([
    ['session id', { sessionId: '../etc' }],
    ['host starting with -', { sshHost: '-oProxyCommand=evil' }],
    ['user with whitespace', { sshUser: 'al ice' }],
    ['remote port 0', { remotePort: 0 }],
    ['ssh port 70000', { sshPort: 70000 }],
  ])('rejects invalid input (%s) without creating a tunnel', async (_label, patch) => {
    const { registry, tunnels } = makeRegistry()
    const result = await registry.open({ ...request, ...patch } as WizardTunnelRequest)
    expect(result).toMatchObject({ ok: false, errorCode: 'ssh-tunnel-invalid-input' })
    expect(tunnels).toHaveLength(0)
  })

  it('close / closeOwnedBy / closeAll stop every tunnel (no orphan ssh)', async () => {
    const { registry, tunnels } = makeRegistry([{ port: 50001 }, { port: 50002 }, { port: 50003 }])
    await registry.open({ ...request, sessionId: 's1' }, 1)
    await registry.open({ ...request, sessionId: 's2' }, 2)
    await registry.open({ ...request, sessionId: 's3' }, 2)

    await registry.close('s1')
    expect(tunnels[0].stops).toBe(1)
    await registry.close('s1') // idempotent
    expect(tunnels[0].stops).toBe(1)

    await registry.closeOwnedBy(2)
    expect(tunnels[1].stops).toBe(1)
    expect(tunnels[2].stops).toBe(1)
    expect(registry.size).toBe(0)

    await registry.open({ ...request, sessionId: 's4' })
    await registry.closeAll()
    expect(tunnels[3].stops).toBe(1)
    expect(registry.size).toBe(0)
  })
})

/** ssh mock: records argv, replies with the given stdout / exit code. */
function fakeSpawn(reply: { stdout?: string; stderr?: string; code?: number; hang?: boolean }) {
  const calls: Array<{ command: string; args: readonly string[] }> = []
  const spawn: NonNullable<RemoteIdentityDeps['spawn']> = (command, args) => {
    calls.push({ command, args })
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
      kill: () => boolean
      exitCode: number | null
      signalCode: string | null
    }
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    proc.exitCode = null
    proc.signalCode = null
    proc.kill = () => {
      proc.exitCode = 143
      setImmediate(() => proc.emit('exit', null, 'SIGTERM'))
      return true
    }
    if (!reply.hang) {
      setImmediate(() => {
        if (reply.stdout) proc.stdout.emit('data', Buffer.from(reply.stdout))
        if (reply.stderr) proc.stderr.emit('data', Buffer.from(reply.stderr))
        proc.exitCode = reply.code ?? 0
        proc.emit('exit', reply.code ?? 0)
      })
    }
    return proc as unknown as ChildProcess
  }
  return { calls, spawn }
}

const identityRequest = {
  sshHost: 'devbox.example',
  sshUser: 'alice',
  targetOS: 'ssh-linux' as const,
  serverHome: '/home/alice',
}

describe('readRemoteServerIdentity (T0387 / BUG-093)', () => {
  it('derives the default bat-server data dir from the remote $HOME', () => {
    expect(remoteServerDataDir('ssh-linux', '/home/alice')).toBe('/home/alice/.local/share/bat-server')
    expect(remoteServerDataDir('ssh-darwin', '/Users/alice/')).toBe('/Users/alice/Library/Application Support/bat-server')
    expect(() => remoteServerDataDir('ssh-linux', '~')).toThrow()
    expect(() => remoteServerDataDir('ssh-linux', '/home/../root')).toThrow()
  })

  it('only extracts the fingerprint field of server-cert.json (private key never leaves the host)', () => {
    const command = buildIdentityCommand('/home/alice/.local/share/bat-server')
    expect(command).toContain("'/home/alice/.local/share/bat-server/server-cert.json'")
    expect(command).toContain('"fingerprint"')
    expect(command).not.toMatch(/cat '[^']*server-cert\.json'/)
    expect(command).toContain("cat '/home/alice/.local/share/bat-server/server-token.json'")
  })

  it('single-quote escapes the darwin data dir (space in "Application Support")', () => {
    const command = buildIdentityCommand(remoteServerDataDir('ssh-darwin', '/Users/alice'))
    expect(command).toContain("'/Users/alice/Library/Application Support/bat-server/server-cert.json'")
  })

  it('parses fingerprint + plaintext token from the ssh output', async () => {
    const { calls, spawn } = fakeSpawn({
      stdout: `BAT_FP=${FP.toLowerCase()}\nBAT_TOKEN={  "v": 1,  "encrypted": false,  "data": "tok-123"}\n`,
    })
    const result = await readRemoteServerIdentity(identityRequest, { spawn })
    expect(result).toEqual({ ok: true, fingerprint: FP, token: 'tok-123' })
    expect(calls).toHaveLength(1)
    expect(calls[0].command).toBe('ssh')
    const args = calls[0].args
    // array args, user@host after `--`, remote command last
    expect(args[args.indexOf('--') + 1]).toBe('alice@devbox.example')
    expect(args[args.length - 1]).toContain('/home/alice/.local/share/bat-server')
    expect(args).toContain('BatchMode=yes')
  })

  it('missing files → ok with null fingerprint / token (caller degrades)', async () => {
    const { spawn } = fakeSpawn({ stdout: 'BAT_TOKEN=\n' })
    expect(await readRemoteServerIdentity(identityRequest, { spawn })).toEqual({ ok: true, fingerprint: null, token: null })
  })

  it('ssh failure → ok:false with stderr', async () => {
    const { spawn } = fakeSpawn({ code: 255, stderr: 'ssh: connect to host devbox.example port 22: Connection refused' })
    const result = await readRemoteServerIdentity(identityRequest, { spawn })
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.error).toContain('Connection refused')
  })

  it('timeout → ok:false and the ssh process is shut down', async () => {
    const { spawn } = fakeSpawn({ hang: true })
    const result = await readRemoteServerIdentity(identityRequest, { spawn, timeoutMs: 20 })
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.error).toContain('timed out')
  })

  it('invalid input never spawns ssh', async () => {
    const { calls, spawn } = fakeSpawn({})
    expect(await readRemoteServerIdentity({ ...identityRequest, serverHome: 'relative' }, { spawn })).toMatchObject({ ok: false })
    expect(await readRemoteServerIdentity({ ...identityRequest, sshHost: '-oProxyCommand=x' }, { spawn })).toMatchObject({ ok: false })
    expect(calls).toHaveLength(0)
  })

  it('parseIdentityOutput: legacy {token}, encrypted secret, malformed fingerprint', () => {
    expect(parseIdentityOutput('BAT_TOKEN={"token":"legacy"}')).toEqual({ fingerprint: null, token: 'legacy' })
    expect(parseIdentityOutput('BAT_TOKEN={"v":1,"encrypted":true,"data":"QUJD"}')).toEqual({ fingerprint: null, token: null })
    expect(parseIdentityOutput('BAT_FP=AB:CD\r\nBAT_TOKEN=not-json')).toEqual({ fingerprint: null, token: null })
  })
})

describe('fetchTlsFingerprint host validation (T0387)', () => {
  it.each(['-oProxyCommand', 'bad host', '', 'a;b'])('rejects host %j without connecting', async (host) => {
    expect(await fetchTlsFingerprint(9876, { host })).toMatchObject({ ok: false, errorCode: 'fingerprint-invalid-host' })
  })
})
