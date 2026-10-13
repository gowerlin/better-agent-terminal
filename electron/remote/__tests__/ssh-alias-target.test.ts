// @vitest-environment node
/**
 * T0505: `sshUser` is optional. Without it every ssh call site ends its argv
 * with `-- <host>` (an ~/.ssh/config alias, so ssh config supplies the user);
 * with it the argv is unchanged (`-- user@host`). F-004 guard: neither the
 * user nor the host may reach ssh as an option. All spawns are mocked.
 */
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

import type { ProfileEntry } from '../../profile-manager'
import {
  buildBaseSshArgs,
  buildSshTarget,
  describeSshTarget,
  normalizeOptionalSshUser,
} from '../ssh-args'
import { __internals as probeInternals } from '../ssh-auth-probe'
import { __internals as uploaderInternals } from '../ssh-bundle-uploader'
import {
  startServerOnRemote,
  stopServerOnRemote,
  uninstallBundleOnRemote,
  type StarterDeps,
} from '../ssh-start-server'
import { SshTunnel } from '../ssh-tunnel'
import {
  readRemoteServerIdentity,
  WizardTunnelRegistry,
  type RemoteIdentityDeps,
  type WizardTunnelHandle,
} from '../ssh-wizard-verify'
import { RemoteClient } from '../remote-client'

const PREFIX = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new']

type Spawn = NonNullable<StarterDeps['spawn']>

/** ssh mock: records argv, every exec exits 0 with `stdout`. */
function recordingSpawn(stdout = 'active\n'): { calls: string[][]; spawn: Spawn } {
  const calls: string[][] = []
  const spawn: Spawn = (_command, args) => {
    calls.push([...args])
    const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean; exitCode: number | null }
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    proc.exitCode = null
    proc.kill = () => true
    setImmediate(() => {
      proc.stdout.emit('data', Buffer.from(stdout))
      proc.exitCode = 0
      proc.emit('exit', 0)
    })
    return proc as unknown as ChildProcess
  }
  return { calls, spawn }
}

/** Every user-controlled token sits after `--`; nothing before it starts with the user / host. */
function expectTargetAfterDoubleDash(argv: string[], target: string): void {
  const dd = argv.indexOf('--')
  expect(dd).toBeGreaterThan(0)
  expect(argv[dd + 1]).toBe(target)
  expect(argv.slice(0, dd)).not.toContain(target)
}

describe('buildBaseSshArgs — optional user (T0505)', () => {
  it.each([[''], [undefined]])('user %j → argv ends with `-- <alias>`', (sshUser) => {
    expect(buildBaseSshArgs({ sshHost: 'devbox', sshUser })).toEqual([...PREFIX, '--', 'devbox'])
  })

  it('alias with no port / key emits no -p / -i (ssh config supplies them)', () => {
    const argv = buildBaseSshArgs({ sshHost: 'devbox', sshUser: '' })
    expect(argv).not.toContain('-p')
    expect(argv).not.toContain('-i')
  })

  it('user@host:port argv is unchanged', () => {
    expect(buildBaseSshArgs({ sshHost: 'build.example.com', sshUser: 'deploy', sshPort: 2222 }))
      .toEqual([...PREFIX, '-p', '2222', '--', 'deploy@build.example.com'])
    expect(buildBaseSshArgs({ sshHost: 'devbox.example', sshUser: 'alice', sshKeyPath: 'C:\\keys\\id_ed25519' }, ['-N']))
      .toEqual([...PREFIX, '-i', 'C:\\keys\\id_ed25519', '-N', '--', 'alice@devbox.example'])
  })

  it('host-only targets accept IPv6 literals and dotted names', () => {
    expect(buildSshTarget('', 'fe80::1')).toBe('fe80::1')
    expect(buildSshTarget('', 'build-01.example.com')).toBe('build-01.example.com')
  })

  it.each([
    ['leading dash', '-oProxyCommand=calc'],
    ['bare dash', '-'],
    ['user smuggled via @', 'root@devbox'],
    ['negated pattern', '!devbox'],
    ['wildcard', 'dev*'],
    ['space', 'dev box'],
    ['semicolon', 'devbox;rm'],
    ['command substitution', 'devbox$(id)'],
    ['quote', "dev'box"],
    ['newline', 'devbox\n'],
    ['empty', ''],
    ['too long', 'a'.repeat(254)],
  ])('rejects host-only target with %s', (_label, sshHost) => {
    expect(() => buildBaseSshArgs({ sshHost, sshUser: '' })).toThrow()
  })

  it.each([
    ['leading dash', '-oProxyCommand=calc'],
    ['space', 'al ice'],
    ['newline', 'alice\n'],
  ])('rejects a user with %s', (_label, sshUser) => {
    expect(() => buildBaseSshArgs({ sshHost: 'devbox', sshUser })).toThrow(/sshUser/)
  })

  it('still rejects a leading-dash host when a user is set', () => {
    expect(() => buildBaseSshArgs({ sshHost: '-oProxyCommand=calc', sshUser: 'alice' })).toThrow(/sshHost/)
  })

  it('rejects a non-string user', () => {
    expect(() => normalizeOptionalSshUser(42)).toThrow(/sshUser must be a string/)
    expect(normalizeOptionalSshUser(null)).toBe('')
  })

  it('describeSshTarget formats for logs', () => {
    expect(describeSshTarget('', 'devbox')).toBe('devbox')
    expect(describeSshTarget(undefined, 'devbox')).toBe('devbox')
    expect(describeSshTarget('alice', 'devbox')).toBe('alice@devbox')
  })
})

describe('alias path argv at every call site (T0505)', () => {
  const alias = { sshHost: 'devbox', sshUser: '' }

  it('verify-ssh-auth probe', () => {
    const argv = probeInternals.buildSshArgs(alias)
    expectTargetAfterDoubleDash(argv, 'devbox')
    expect(argv[argv.length - 1]).toMatch(/^echo BAT_AUTH_OK/)
  })

  it('install-server-bundle upload', () => {
    const argv = uploaderInternals.buildSshArgs({ ...alias, installPath: '/home/alice/.local/bat-server', tarballPath: 'x.tar.gz' })
    expectTargetAfterDoubleDash(argv, 'devbox')
    expect(argv[argv.length - 1]).toBe(uploaderInternals.buildExtractCommand('/home/alice/.local/bat-server'))
  })

  it('start-server: every exec targets the alias; linger falls back to the login user', async () => {
    const { calls, spawn } = recordingSpawn()
    const result = await startServerOnRemote(
      { ...alias, targetOS: 'ssh-linux', installPath: '~/.local/bat-server', serverPort: 51820, serverHome: '/home/alice' },
      undefined,
      { spawn },
    )
    expect(result.ok).toBe(true)
    expect(calls.length).toBeGreaterThan(0)
    for (const argv of calls) expectTargetAfterDoubleDash(argv, 'devbox')
    const enable = calls.map((argv) => argv[argv.length - 1]).find((cmd) => cmd.includes('enable-linger'))
    expect(enable).toContain('loginctl enable-linger "$(id -un)"')
    expect(enable).not.toContain("enable-linger ''")
  })

  it('start-server with a user keeps the quoted linger user', async () => {
    const { calls, spawn } = recordingSpawn()
    await startServerOnRemote(
      { sshHost: 'devbox', sshUser: 'alice', targetOS: 'ssh-linux', installPath: '~/.local/bat-server', serverHome: '/home/alice' },
      undefined,
      { spawn },
    )
    for (const argv of calls) expectTargetAfterDoubleDash(argv, 'alice@devbox')
    const enable = calls.map((argv) => argv[argv.length - 1]).find((cmd) => cmd.includes('enable-linger'))
    expect(enable).toContain("loginctl enable-linger 'alice'")
  })

  it('start-server rejects a leading-dash alias before spawning', async () => {
    const { calls, spawn } = recordingSpawn()
    await expect(startServerOnRemote(
      { sshHost: '-oProxyCommand=calc', sshUser: '', targetOS: 'ssh-linux', installPath: '~/.local/bat-server', serverHome: '/home/alice' },
      undefined,
      { spawn },
    )).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })

  it('teardown (stop-server / uninstall-bundle) accepts an empty user', async () => {
    const { calls, spawn } = recordingSpawn('')
    expect(await stopServerOnRemote({ ...alias, targetOS: 'ssh-linux', serverHome: '/home/alice' }, { spawn })).toEqual({ ok: true })
    expect(await uninstallBundleOnRemote({ ...alias, installPath: '/home/alice/.local/bat-server' }, { spawn })).toEqual({ ok: true })
    expect(calls).toHaveLength(2)
    for (const argv of calls) expectTargetAfterDoubleDash(argv, 'devbox')
  })

  it.each(['-oProxyCommand=calc', 'root@devbox', 'dev box'])('teardown rejects host %j without spawning', async (sshHost) => {
    const { calls, spawn } = recordingSpawn('')
    expect((await stopServerOnRemote({ sshHost, sshUser: '', targetOS: 'ssh-linux', serverHome: '/home/alice' }, { spawn })).ok).toBe(false)
    expect((await uninstallBundleOnRemote({ sshHost, sshUser: '', installPath: '/home/alice/.local/bat-server' }, { spawn })).ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('SSH tunnel (runtime + wizard verify)', () => {
    const argv = SshTunnel.buildSpawnArgs({ ...alias, remotePort: 51820 }, 53111)
    expectTargetAfterDoubleDash(argv, 'devbox')
    expect(argv).toContain('-N')
    expect(argv.slice(0, argv.indexOf('--'))).toContain('53111:localhost:51820')
  })

  it('wizard verify tunnel opens with an empty user and rejects a dash alias', async () => {
    const created: unknown[] = []
    const registry = new WizardTunnelRegistry({
      createTunnel: (options) => {
        created.push(options)
        const handle: WizardTunnelHandle = {
          start: async () => ({ localPort: 53111 }),
          stop: async () => undefined,
          isAlive: () => true,
          on: () => handle,
        }
        return handle
      },
    })
    expect(await registry.open({ sessionId: 's1', ...alias, remotePort: 51820 })).toEqual({ ok: true, localPort: 53111 })
    expect(created).toEqual([expect.objectContaining({ sshHost: 'devbox', sshUser: '' })])

    const bad = await registry.open({ sessionId: 's2', sshHost: '-oProxyCommand=calc', sshUser: '', remotePort: 51820 })
    expect(bad).toMatchObject({ ok: false, errorCode: 'ssh-tunnel-invalid-input' })
    expect(created).toHaveLength(1)
    await registry.closeAll()
  })

  it('remote server identity read', async () => {
    const { calls, spawn } = recordingSpawn('BAT_TOKEN=\n')
    const result = await readRemoteServerIdentity(
      { ...alias, targetOS: 'ssh-linux', serverHome: '/home/alice' },
      { spawn: spawn as unknown as NonNullable<RemoteIdentityDeps['spawn']> },
    )
    expect(result.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expectTargetAfterDoubleDash(calls[0], 'devbox')
  })
})

describe('saved profile with sshUser "" (T0505)', () => {
  function profile(overrides: Partial<ProfileEntry> = {}): ProfileEntry {
    return {
      id: 'p-alias',
      name: 'devbox',
      type: 'remote',
      remoteHost: 'localhost',
      remotePort: 9876,
      targetOS: 'ssh-linux',
      sshHost: 'devbox',
      sshUser: '',
      useSshTunnel: true,
      createdAt: 0,
      updatedAt: 0,
      ...overrides,
    }
  }

  function tunnelOptionsOf(client: RemoteClient): { sshHost: string; sshUser: string } | null {
    const internals = client as unknown as { tunnel: { options: { sshHost: string; sshUser: string } } | null; maybeCreateTunnel: () => void }
    internals.maybeCreateTunnel()
    return internals.tunnel ? internals.tunnel.options : null
  }

  it('RemoteClient now builds the tunnel instead of skipping it', () => {
    expect(tunnelOptionsOf(new RemoteClient(() => [], profile()))).toMatchObject({ sshHost: 'devbox', sshUser: '' })
  })

  it('a blank host is still skipped', () => {
    expect(tunnelOptionsOf(new RemoteClient(() => [], profile({ sshHost: '' })))).toBeNull()
  })
})
