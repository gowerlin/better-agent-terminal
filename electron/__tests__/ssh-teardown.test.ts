/**
 * T0426 (BUG-100): `ssh:stop-server` / `ssh:uninstall-bundle` — the rollback
 * side of the SSH wizard's start-server / install-server-bundle steps.
 *   - spawn + array args only (`ssh … -- user@host <command>`), mock spawn,
 *     no real ssh subprocess
 *   - remote command = constants + validated `$HOME` / install path
 *   - whitelist rejections never spawn
 *   - 30s default timeout, overridable; timeout → { ok: false }
 *   - IPC handlers registered on the `ssh:*` channels, never throw
 */
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return { ...actual, default: { ...actual, spawn: spawnMock }, spawn: spawnMock }
})

import {
  __internals,
  stopServerOnRemote,
  uninstallBundleOnRemote,
  type StarterDeps,
  type StopServerOptions,
  type UninstallBundleOptions,
} from '../remote/ssh-start-server'
import { registerSshSetupHandlers } from '../remote/ssh-setup-handlers'

const { buildStopServerCommand, buildUninstallBundleCommand, resolveUninstallTarget } = __internals

const linuxStop: StopServerOptions = {
  sshHost: 'devbox.example',
  sshUser: 'alice',
  targetOS: 'ssh-linux',
  serverHome: '/home/alice',
}
const darwinStop: StopServerOptions = { ...linuxStop, targetOS: 'ssh-darwin', serverHome: '/Users/alice' }
const uninstall: UninstallBundleOptions = {
  sshHost: 'devbox.example',
  sshUser: 'alice',
  installPath: '/home/alice/.local/bat-server',
}

interface SpawnCall { command: string; args: string[]; options: { env?: NodeJS.ProcessEnv } | undefined }

type FakeProc = EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean; exitCode: number | null; signalCode: string | null }

function fakeSpawn(behaviour: { exitCode?: number; stderr?: string; hang?: boolean } = {}): {
  calls: SpawnCall[]
  procs: FakeProc[]
  spawn: NonNullable<StarterDeps['spawn']>
} {
  const calls: SpawnCall[] = []
  const procs: FakeProc[] = []
  const spawn: NonNullable<StarterDeps['spawn']> = (command, args, options) => {
    calls.push({ command, args: [...args], options: options as SpawnCall['options'] })
    const proc = new EventEmitter() as FakeProc
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    proc.exitCode = null
    proc.signalCode = null
    proc.kill = () => {
      proc.signalCode = 'SIGTERM'
      setImmediate(() => proc.emit('exit', null, 'SIGTERM'))
      return true
    }
    procs.push(proc)
    if (!behaviour.hang) {
      setImmediate(() => {
        if (behaviour.stderr) proc.stderr.emit('data', Buffer.from(behaviour.stderr))
        proc.exitCode = behaviour.exitCode ?? 0
        proc.emit('exit', behaviour.exitCode ?? 0)
      })
    }
    return proc as unknown as ChildProcess
  }
  return { calls, procs, spawn }
}

function remoteCommand(call: SpawnCall): string {
  return call.args[call.args.length - 1]
}

describe('stopServerOnRemote (T0426 / BUG-100)', () => {
  it('linux: one ssh exec with array args; disables + removes the absolute unit, then checks', async () => {
    const { calls, spawn } = fakeSpawn()
    const result = await stopServerOnRemote(linuxStop, { spawn })

    expect(result).toEqual({ ok: true })
    expect(calls).toHaveLength(1)
    expect(calls[0].command).toBe('ssh')
    const args = calls[0].args
    expect(args).toContain('BatchMode=yes')
    expect(args[args.indexOf('--') + 1]).toBe('alice@devbox.example')
    const cmd = remoteCommand(calls[0])
    expect(cmd).toContain('systemctl --user disable --now bat-server')
    expect(cmd).toContain("rm -f '/home/alice/.config/systemd/user/bat-server.service'")
    expect(cmd).toContain('systemctl --user daemon-reload')
    expect(cmd).toContain("test ! -e '/home/alice/.config/systemd/user/bat-server.service'")
    // linger may predate BAT — never undone
    expect(cmd).not.toContain('linger')
    expect(cmd).not.toContain('~')
    expect(calls[0].options?.env?.LC_ALL).toBe('C')
  })

  it('darwin: unloads + removes the LaunchAgent plist', async () => {
    const { calls, spawn } = fakeSpawn()
    expect(await stopServerOnRemote(darwinStop, { spawn })).toEqual({ ok: true })
    const cmd = remoteCommand(calls[0])
    expect(cmd).toContain("launchctl unload -w '/Users/alice/Library/LaunchAgents/com.bat-server.plist'")
    expect(cmd).toContain('launchctl remove com.bat-server')
    expect(cmd).toContain("rm -f '/Users/alice/Library/LaunchAgents/com.bat-server.plist'")
  })

  it('is idempotent: every teardown action tolerates "not there"; only the final check decides', () => {
    const linuxCmd = buildStopServerCommand(linuxStop)
    // the four teardown actions swallow failures (unknown unit / missing file)
    expect(linuxCmd.split('; ').slice(0, 4)).toEqual([
      'systemctl --user disable --now bat-server >/dev/null 2>&1',
      "rm -f '/home/alice/.config/systemd/user/bat-server.service'",
      'systemctl --user daemon-reload >/dev/null 2>&1',
      'systemctl --user reset-failed bat-server >/dev/null 2>&1',
    ])
    expect(linuxCmd).not.toContain('&&')
    expect(buildStopServerCommand(darwinStop).split('; ').slice(0, 3)).toEqual([
      "launchctl unload -w '/Users/alice/Library/LaunchAgents/com.bat-server.plist' >/dev/null 2>&1",
      'launchctl remove com.bat-server >/dev/null 2>&1',
      "rm -f '/Users/alice/Library/LaunchAgents/com.bat-server.plist'",
    ])
  })

  it('passes sshPort / sshKeyPath through as separate argv elements', async () => {
    const { calls, spawn } = fakeSpawn()
    await stopServerOnRemote({ ...linuxStop, sshPort: 2222, sshKeyPath: 'C:\\Users\\alice\\.ssh\\id_ed25519' }, { spawn })
    const args = calls[0].args
    expect(args[args.indexOf('-p') + 1]).toBe('2222')
    expect(args[args.indexOf('-i') + 1]).toBe('C:\\Users\\alice\\.ssh\\id_ed25519')
  })

  it('accepts an IPv6 literal host', async () => {
    const { calls, spawn } = fakeSpawn()
    expect(await stopServerOnRemote({ ...linuxStop, sshHost: 'fe80::1' }, { spawn })).toEqual({ ok: true })
    expect(calls[0].args).toContain('alice@fe80::1')
  })

  it.each([
    ['host with @', { sshHost: 'bob@devbox' }],
    ['host with ;', { sshHost: 'devbox;reboot' }],
    ['host with space', { sshHost: 'dev box' }],
    ['host starting with -', { sshHost: '-oProxyCommand=x' }],
    ['host with $()', { sshHost: '$(id)' }],
    ['user with @', { sshUser: 'alice@x' }],
    ['user with quote', { sshUser: "al'ice" }],
    ['user starting with -', { sshUser: '-alice' }],
    ['port 0', { sshPort: 0 }],
    ['port 70000', { sshPort: 70000 }],
    ['port not integer', { sshPort: 22.5 }],
    ['relative serverHome', { serverHome: 'home/alice' }],
    ['serverHome with ..', { serverHome: '/home/../root' }],
    ['serverHome with quote', { serverHome: "/home/al'ice" }],
    ['missing serverHome', { serverHome: '' }],
    ['unknown targetOS', { targetOS: 'wsl-linux' }],
    ['key path starting with -', { sshKeyPath: '-oProxyCommand=x' }],
  ])('rejects %s without spawning', async (_label, patch) => {
    const { calls, spawn } = fakeSpawn()
    const result = await stopServerOnRemote({ ...linuxStop, ...(patch as Partial<StopServerOptions>) }, { spawn })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/^stop-server-failed: /)
    expect(calls).toHaveLength(0)
  })

  it('reports a non-zero exit with the remote stderr', async () => {
    const { spawn } = fakeSpawn({ exitCode: 1, stderr: 'bat-server is still active\n' })
    expect(await stopServerOnRemote(linuxStop, { spawn })).toEqual({
      ok: false,
      error: 'stop-server-failed: bat-server is still active',
    })
  })

  it('times out (default 30s budget is overridable) and kills the ssh process', async () => {
    const { procs, spawn } = fakeSpawn({ hang: true })
    const result = await stopServerOnRemote(linuxStop, { spawn, timeoutMs: 20 })
    expect(result).toEqual({ ok: false, error: 'stop-server-failed: timed out' })
    expect(procs).toHaveLength(1)
  })
})

describe('uninstallBundleOnRemote (T0426 / BUG-100)', () => {
  it('absolute path: rm -rf -- the quoted path, then verify it is gone', async () => {
    const { calls, spawn } = fakeSpawn()
    expect(await uninstallBundleOnRemote(uninstall, { spawn })).toEqual({ ok: true })
    expect(remoteCommand(calls[0])).toBe(
      "rm -rf -- '/home/alice/.local/bat-server' && test ! -e '/home/alice/.local/bat-server'",
    )
  })

  it('~/ path: expands through the remote $HOME constant, never a literal ~ directory', () => {
    expect(buildUninstallBundleCommand('~/.local/bat-server')).toBe(
      `rm -rf -- "$HOME"/'.local/bat-server' && test ! -e "$HOME"/'.local/bat-server'`,
    )
  })

  it('accepts /opt/bat-server and a trailing slash', () => {
    expect(resolveUninstallTarget('/opt/bat-server')).toBe("'/opt/bat-server'")
    expect(resolveUninstallTarget('/home/alice/.local/bat-server/')).toBe("'/home/alice/.local/bat-server'")
  })

  it.each([
    ['root', '/'],
    ['home itself', '~'],
    ['home dir absolute', '/home/alice'],
    ['other directory', '/home/alice/projects'],
    ['relative', '.local/bat-server'],
    ['~user', '~bob/bat-server'],
    ['.. segment', '/home/alice/../bob/bat-server'],
    ['. segment', '/home/./bat-server'],
    ['empty segment', '/home//bat-server'],
    ['quote', "/home/al'ice/bat-server"],
    ['command substitution', '/home/$(id)/bat-server'],
    ['space', '/home/alice/my dir/bat-server'],
    ['newline', '/home/alice\n/bat-server'],
    ['glob', '/home/*/bat-server'],
    ['not a string', 42],
  ])('rejects %s without spawning', async (_label, installPath) => {
    const { calls, spawn } = fakeSpawn()
    const result = await uninstallBundleOnRemote({ ...uninstall, installPath: installPath as string }, { spawn })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/^uninstall-bundle-failed: /)
    expect(calls).toHaveLength(0)
  })

  it('rejects a bad host / user without spawning', async () => {
    const { calls, spawn } = fakeSpawn()
    expect((await uninstallBundleOnRemote({ ...uninstall, sshHost: 'a b' }, { spawn })).ok).toBe(false)
    expect((await uninstallBundleOnRemote({ ...uninstall, sshUser: '' }, { spawn })).ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('reports ssh failures and timeouts', async () => {
    const failing = fakeSpawn({ exitCode: 255, stderr: 'Permission denied (publickey).' })
    expect(await uninstallBundleOnRemote(uninstall, { spawn: failing.spawn })).toEqual({
      ok: false,
      error: 'uninstall-bundle-failed: Permission denied (publickey).',
    })
    const hanging = fakeSpawn({ hang: true })
    expect(await uninstallBundleOnRemote(uninstall, { spawn: hanging.spawn, timeoutMs: 20 })).toEqual({
      ok: false,
      error: 'uninstall-bundle-failed: timed out',
    })
  })
})

describe('ssh:stop-server / ssh:uninstall-bundle IPC handlers (T0426)', () => {
  type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>
  let handlers: Map<string, Handler>

  beforeEach(() => {
    spawnMock.mockReset()
    handlers = new Map()
    const ipcMain = { handle: (channel: string, fn: Handler) => { handlers.set(channel, fn) } }
    registerSshSetupHandlers(ipcMain as never)
  })

  it('registers both channels', () => {
    expect(handlers.has('ssh:stop-server')).toBe(true)
    expect(handlers.has('ssh:uninstall-bundle')).toBe(true)
  })

  it('stop-server spawns ssh (array args) through child_process', async () => {
    spawnMock.mockImplementation(fakeSpawn().spawn)
    const result = await handlers.get('ssh:stop-server')!({}, linuxStop)
    expect(result).toEqual({ ok: true })
    expect(spawnMock).toHaveBeenCalledTimes(1)
    const [command, args] = spawnMock.mock.calls[0] as [string, string[]]
    expect(command).toBe('ssh')
    expect(Array.isArray(args)).toBe(true)
    expect(args[args.indexOf('--') + 1]).toBe('alice@devbox.example')
  })

  it('uninstall-bundle spawns ssh (array args) through child_process', async () => {
    spawnMock.mockImplementation(fakeSpawn().spawn)
    expect(await handlers.get('ssh:uninstall-bundle')!({}, uninstall)).toEqual({ ok: true })
    const args = spawnMock.mock.calls[0][1] as string[]
    expect(args[args.length - 1]).toContain("rm -rf -- '/home/alice/.local/bat-server'")
  })

  it('invalid or missing requests resolve { ok: false } without spawning', async () => {
    await expect(handlers.get('ssh:stop-server')!({}, { ...linuxStop, sshHost: 'x;y' })).resolves.toMatchObject({ ok: false })
    await expect(handlers.get('ssh:stop-server')!({}, undefined)).resolves.toMatchObject({ ok: false })
    await expect(handlers.get('ssh:uninstall-bundle')!({}, { ...uninstall, installPath: '/' })).resolves.toMatchObject({ ok: false })
    await expect(handlers.get('ssh:uninstall-bundle')!({}, null)).resolves.toMatchObject({ ok: false })
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
