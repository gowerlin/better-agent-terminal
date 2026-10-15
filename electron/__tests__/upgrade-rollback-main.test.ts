/**
 * T0554 (BUG-141): main-process side of "a cancelled upgrade puts the previous
 * server back". WSL: `installBundle({ keepPrevious })` / `restoreBundle` /
 * `discardPreviousBundle` (wsl-detect) and the unit snapshot / restore
 * (wsl-systemd). SSH: the upload's `previous`, start-server's unit backup, and
 * the `restore-previous` / `discard-*` teardown commands. execFile / spawn are
 * injected; the shell scripts themselves run under a real `sh` in
 * server-bundle-install-script.test.ts.
 */
import { EventEmitter } from 'events'
import { PassThrough, Readable } from 'stream'
import type { ChildProcess, ChildProcessWithoutNullStreams } from 'child_process'
import type { ReadStream } from 'fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

import {
  discardPreviousBundle,
  installBundle,
  resetExecFileImplForTests as resetDetectExec,
  restoreBundle,
  setExecFileImplForTests as setDetectExec,
} from '../wsl-detect'
import {
  resetExecFileImplForTests as resetSystemdExec,
  resetSpawnImplForTests,
  restartService,
  restoreServiceUnit,
  setExecFileImplForTests as setSystemdExec,
  setSpawnImplForTests,
  snapshotServiceUnit,
} from '../wsl-systemd'
import {
  buildWslBundleDiscardPreviousScript,
  buildWslBundleInstallScript,
  buildWslBundleRestoreScript,
} from '../server-bundle-install-script'
import {
  __internals as starter,
  startServerOnRemote,
  stopServerOnRemote,
  uninstallBundleOnRemote,
  type StarterDeps,
  type StartServerOptions,
} from '../remote/ssh-start-server'
import { uploadServerBundle } from '../remote/ssh-bundle-uploader'

type Reply = { code?: number; stdout?: string; stderr?: string }

function installExec(setter: (impl: (...args: any[]) => unknown) => void, route: (args: string[]) => Reply): string[][] {
  const calls: string[][] = []
  setter((_file: string, args: string[], _options: unknown, callback: (...cbArgs: unknown[]) => void) => {
    calls.push(args)
    const reply = route(args)
    const stdout = Buffer.from(reply.stdout ?? '')
    const stderr = Buffer.from(reply.stderr ?? '')
    if (reply.code) callback(Object.assign(new Error(`Command failed: ${args.join(' ')}`), { code: reply.code }), stdout, stderr)
    else callback(null, stdout, stderr)
    return undefined
  })
  return calls
}

afterEach(() => {
  resetDetectExec()
  resetSystemdExec()
  resetSpawnImplForTests()
})

const ROOT = '/home/me/.local/bat-server'

describe('WSL bundle keep / restore / discard (T0554)', () => {
  it('installBundle passes `keep` only when asked and reports the previous install', async () => {
    const calls = installExec(setDetectExec, () => ({ stdout: 'server bundle install: replaced\nBAT_BUNDLE_PREVIOUS=kept\n' }))
    await expect(installBundle('Ubuntu-24.04', 'C:\\b\\x.tar.gz', ROOT, { keepPrevious: true })).resolves.toEqual({ ok: true, previous: 'kept' })
    expect(calls[0]).toEqual(['-d', 'Ubuntu-24.04', '--exec', 'sh', '-c', buildWslBundleInstallScript(), 'sh', ROOT, '/mnt/c/b/x.tar.gz', 'keep'])

    await installBundle('Ubuntu-24.04', 'C:\\b\\x.tar.gz', ROOT)
    expect(calls[1]).not.toContain('keep')
  })

  it('restoreBundle runs the restore script with the root as argv and reports the outcome', async () => {
    const calls = installExec(setDetectExec, () => ({ stdout: 'BAT_BUNDLE_RESTORE=restored\n' }))
    await expect(restoreBundle('Ubuntu-24.04', `${ROOT}/`)).resolves.toEqual({ ok: true, outcome: 'restored' })
    expect(calls[0]).toEqual(['-d', 'Ubuntu-24.04', '--exec', 'sh', '-c', buildWslBundleRestoreScript(), 'sh', ROOT])
  })

  it('restoreBundle: missing outcome passes through; a script without a marker or a failure is an error', async () => {
    installExec(setDetectExec, () => ({ stdout: 'BAT_BUNDLE_RESTORE=missing\n' }))
    await expect(restoreBundle('Ubuntu-24.04', ROOT)).resolves.toEqual({ ok: true, outcome: 'missing' })
    installExec(setDetectExec, () => ({ stdout: '' }))
    expect((await restoreBundle('Ubuntu-24.04', ROOT)).ok).toBe(false)
    installExec(setDetectExec, () => ({ code: 1, stderr: 'server bundle restore: /x is not a BAT server bundle install; leaving it' }))
    const failed = await restoreBundle('Ubuntu-24.04', ROOT)
    expect(failed.ok).toBe(false)
    expect(!failed.ok && failed.error).toMatch(/not a BAT server bundle install/)
  })

  it('discardPreviousBundle runs the cleanup script', async () => {
    const calls = installExec(setDetectExec, () => ({}))
    await expect(discardPreviousBundle('Ubuntu-24.04', ROOT)).resolves.toEqual({ ok: true })
    expect(calls[0]).toEqual(['-d', 'Ubuntu-24.04', '--exec', 'sh', '-c', buildWslBundleDiscardPreviousScript(), 'sh', ROOT])
  })

  it.each(['/', '/home', '~/.local/bat-server', '/home/me/../x', "/home/it's/bat", ''])('restore / discard refuse root %p without running anything', async (root) => {
    const calls = installExec(setDetectExec, () => ({}))
    expect((await restoreBundle('Ubuntu-24.04', root)).ok).toBe(false)
    expect((await discardPreviousBundle('Ubuntu-24.04', root)).ok).toBe(false)
    expect(calls).toEqual([])
  })

  it('refuses an invalid distro name', async () => {
    const calls = installExec(setDetectExec, () => ({}))
    expect((await restoreBundle('Ubuntu; rm -rf /', ROOT)).ok).toBe(false)
    expect(calls).toEqual([])
  })
})

const UNIT = '/home/me/.config/systemd/user/bat-server.service'
const SERVICE = 'bat-server.service'

function wslCommand(args: string[]): string {
  return args.slice(3).join(' ') // ['-d', distro, '--', ...]
}

describe('WSL unit snapshot / restore (T0554)', () => {
  it('snapshot: unit content, active and enabled', async () => {
    const calls = installExec(setSystemdExec, (args) => {
      const line = wslCommand(args)
      if (line === `test -f ${UNIT}`) return {}
      if (line === `cat ${UNIT}`) return { stdout: '[Service]\nExecStart="/x"\n' }
      if (line.startsWith(`systemctl --user show ${SERVICE}`)) return { stdout: 'ActiveState=active\nSubState=running\nNRestarts=0\n' }
      if (line === `systemctl --user is-enabled ${SERVICE}`) return { stdout: 'enabled\n' }
      return { code: 1, stderr: `unexpected ${line}` }
    })
    await expect(snapshotServiceUnit('Ubuntu-24.04', SERVICE, { path: UNIT })).resolves.toEqual({
      ok: true,
      content: '[Service]\nExecStart="/x"\n',
      active: true,
      enabled: true,
    })
    expect(calls.map(wslCommand)).not.toContain(expect.stringMatching(/stop|restart|disable/))
  })

  it('snapshot: no unit file -> content null; a stopped / disabled service', async () => {
    installExec(setSystemdExec, (args) => {
      const line = wslCommand(args)
      if (line === `test -f ${UNIT}`) return { code: 1 }
      if (line.startsWith(`systemctl --user show ${SERVICE}`)) return { stdout: 'ActiveState=inactive\nSubState=dead\n' }
      if (line === `systemctl --user is-enabled ${SERVICE}`) return { code: 1, stdout: 'disabled\n' }
      return { code: 1 }
    })
    await expect(snapshotServiceUnit('Ubuntu-24.04', SERVICE, { path: UNIT })).resolves.toEqual({ ok: true, content: null, active: false, enabled: false })
  })

  it('snapshot: wsl.exe failing is an error (not "no unit")', async () => {
    installExec(setSystemdExec, () => ({ code: 4294967295, stderr: 'WSL is not running' }))
    const result = await snapshotServiceUnit('Ubuntu-24.04', SERVICE, { path: UNIT })
    expect(result.ok).toBe(false)
  })

  it.each([
    ['distro', 'bad distro;', SERVICE, UNIT],
    ['service', 'Ubuntu-24.04', 'bat-server.service; rm', UNIT],
    ['path', 'Ubuntu-24.04', SERVICE, '~/.config/systemd/user/bat-server.service'],
  ])('snapshot rejects an invalid %s without running anything', async (_label, distro, service, unitPath) => {
    const calls = installExec(setSystemdExec, () => ({}))
    expect((await snapshotServiceUnit(distro, service, { path: unitPath })).ok).toBe(false)
    expect(calls).toEqual([])
  })

  function installTee(): string[] {
    const written: string[] = []
    setSpawnImplForTests(((_command: string, args?: readonly string[]) => {
      const child = new EventEmitter() as ChildProcessWithoutNullStreams
      const stdin = new PassThrough()
      const chunks: Buffer[] = []
      stdin.on('data', (chunk: Buffer) => chunks.push(chunk))
      stdin.on('end', () => {
        written.push(`${(args ?? []).join(' ')}\n${Buffer.concat(chunks).toString('utf8')}`)
        setImmediate(() => child.emit('close', 0))
      })
      Object.assign(child, { stdin, stdout: new PassThrough(), stderr: new PassThrough() })
      return child
    }) as never)
    return written
  }

  it('restore writes the unit back, reloads, restores enabled state and starts only when asked', async () => {
    const written = installTee()
    const calls = installExec(setSystemdExec, () => ({}))
    await expect(restoreServiceUnit('Ubuntu-24.04', SERVICE, { path: UNIT, content: 'OLD UNIT\n', enabled: true, start: false })).resolves.toEqual({ ok: true })
    expect(written).toEqual([`-d Ubuntu-24.04 -- tee ${UNIT}\nOLD UNIT\n`])
    expect(calls.map(wslCommand)).toEqual([
      `systemctl --user stop ${SERVICE}`,
      `mkdir -p /home/me/.config/systemd/user`,
      'systemctl --user daemon-reload',
      `systemctl --user enable ${SERVICE}`,
    ])

    calls.length = 0
    await restoreServiceUnit('Ubuntu-24.04', SERVICE, { path: UNIT, content: 'OLD UNIT\n', enabled: false, start: true })
    expect(calls.map(wslCommand).slice(-2)).toEqual([`systemctl --user disable ${SERVICE}`, `systemctl --user restart ${SERVICE}`])
  })

  it('restore rejects bad content / options without touching the distro', async () => {
    const calls = installExec(setSystemdExec, () => ({}))
    expect((await restoreServiceUnit('Ubuntu-24.04', SERVICE, { path: UNIT, content: 'x'.repeat(70 * 1024), enabled: true, start: true })).ok).toBe(false)
    expect((await restoreServiceUnit('Ubuntu-24.04', SERVICE, { path: UNIT, content: 42 as never, enabled: true, start: true })).ok).toBe(false)
    expect((await restoreServiceUnit('Ubuntu-24.04', SERVICE, { path: UNIT, content: 'x', enabled: 'yes' as never, start: true })).ok).toBe(false)
    expect(calls).toEqual([])
  })

  it('restartService restarts; a failure comes back as { ok: false }', async () => {
    const calls = installExec(setSystemdExec, () => ({}))
    await expect(restartService('Ubuntu-24.04', SERVICE)).resolves.toEqual({ ok: true })
    expect(calls.map(wslCommand)).toEqual([`systemctl --user restart ${SERVICE}`])
    installExec(setSystemdExec, () => ({ code: 1, stderr: 'Job for bat-server.service failed' }))
    const failed = await restartService('Ubuntu-24.04', SERVICE)
    expect(failed.ok).toBe(false)
    expect(!failed.ok && failed.error).toMatch(/Job for bat-server.service failed/)
  })
})

// ── SSH ─────────────────────────────────────────────────────────────────────

type FakeProc = EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean }

function routedSpawn(route: (command: string) => Reply): { commands: string[]; spawn: NonNullable<StarterDeps['spawn']> } {
  const commands: string[] = []
  const spawn: NonNullable<StarterDeps['spawn']> = (_command, args) => {
    const remote = args[args.length - 1]
    commands.push(remote)
    const reply = route(remote)
    const proc = new EventEmitter() as FakeProc
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    proc.kill = () => true
    setImmediate(() => {
      if (reply.stdout) proc.stdout.emit('data', Buffer.from(reply.stdout))
      if (reply.stderr) proc.stderr.emit('data', Buffer.from(reply.stderr))
      proc.emit('exit', reply.code ?? 0)
    })
    return proc as unknown as ChildProcess
  }
  return { commands, spawn }
}

const linuxStart: StartServerOptions = {
  sshHost: 'devbox.example',
  sshUser: 'alice',
  targetOS: 'ssh-linux',
  installPath: '/home/alice/.local/bat-server',
  serverPort: 9876,
  serverHome: '/home/alice',
}

const BACKUP_OUT = 'BAT_PREV_UNIT=1\nBAT_PREV_ACTIVE=1\nBAT_PREV_ENABLED=1\n'

describe('SSH start-server unit backup (T0554)', () => {
  it('backupPrevious: backs up first and reports previous on success', async () => {
    const { commands, spawn } = routedSpawn((command) => (command.includes('.bat-prev') ? { stdout: BACKUP_OUT } : { stdout: 'ok' }))
    const result = await startServerOnRemote({ ...linuxStart, backupPrevious: true }, () => undefined, { spawn })
    expect(result.ok).toBe(true)
    expect(result.previous).toEqual({ unit: true, active: true, enabled: true })
    expect(commands[0]).toContain("unit='/home/alice/.config/systemd/user/bat-server.service'")
    expect(commands[0]).toContain('cp -p -- "$unit" "$prev"')
    expect(commands).toHaveLength(4)
  })

  it('previous travels with a later failure too', async () => {
    const { spawn } = routedSpawn((command) => {
      if (command.includes('.bat-prev')) return { stdout: 'BAT_PREV_UNIT=0\nBAT_PREV_ACTIVE=0\nBAT_PREV_ENABLED=0\n' }
      if (command.includes('systemctl --user restart')) return { code: 1, stderr: 'Failed to enable unit' }
      return {}
    })
    const result = await startServerOnRemote({ ...linuxStart, backupPrevious: true }, () => undefined, { spawn })
    expect(result.ok).toBe(false)
    expect(result.previous).toEqual({ unit: false, active: false, enabled: false })
  })

  it('a failed backup stops before writing anything', async () => {
    const { commands, spawn } = routedSpawn(() => ({ code: 1, stderr: 'cp: Permission denied' }))
    const result = await startServerOnRemote({ ...linuxStart, backupPrevious: true }, () => undefined, { spawn })
    expect(result).toMatchObject({ ok: false, errorCode: 'unit-write-failed' })
    expect(result.previous).toBeUndefined()
    expect(commands).toHaveLength(1)
  })

  it('without backupPrevious (a retry): no backup command, no previous', async () => {
    const { commands, spawn } = routedSpawn(() => ({ stdout: 'ok' }))
    const result = await startServerOnRemote(linuxStart, () => undefined, { spawn })
    expect(result.previous).toBeUndefined()
    expect(commands.some((c) => c.includes('.bat-prev'))).toBe(false)
  })

  it('darwin backs up the plist and reads the launchd job', () => {
    const command = starter.buildBackupCommand('ssh-darwin', '/Users/alice/Library/LaunchAgents/com.bat-server.plist')
    expect(command).toContain("unit='/Users/alice/Library/LaunchAgents/com.bat-server.plist'")
    expect(command).toContain('launchctl list com.bat-server')
  })

  it('parseBackupOutput needs all three markers', () => {
    expect(starter.parseBackupOutput(BACKUP_OUT)).toEqual({ unit: true, active: true, enabled: true })
    expect(starter.parseBackupOutput('BAT_PREV_UNIT=1\nBAT_PREV_ACTIVE=0\n')).toBeNull()
  })
})

const connection = { sshHost: 'devbox.example', sshUser: 'alice' }

describe('SSH teardown restore / discard (T0554)', () => {
  it('stop-server restore-previous: puts the backup back, enabled state, starts only when asked', () => {
    const command = starter.buildStopServerCommand({
      ...connection,
      targetOS: 'ssh-linux',
      serverHome: '/home/alice',
      action: 'restore-previous',
      restore: { enabled: true, start: false },
    })
    expect(command).toContain("unit='/home/alice/.config/systemd/user/bat-server.service'")
    expect(command).toContain('mv -f -- "$prev" "$unit"')
    expect(command).toContain('systemctl --user enable bat-server')
    expect(command).not.toContain('restart')
    expect(command).not.toContain('rm -')

    const started = starter.buildStopServerCommand({
      ...connection,
      targetOS: 'ssh-linux',
      serverHome: '/home/alice',
      action: 'restore-previous',
      restore: { enabled: false, start: true },
    })
    expect(started).toContain('systemctl --user disable bat-server')
    expect(started).toContain('systemctl --user restart bat-server')
  })

  it('stop-server restore-previous on darwin reloads the plist only when starting', () => {
    const stopped = starter.buildStopServerCommand({
      ...connection, targetOS: 'ssh-darwin', serverHome: '/Users/alice', action: 'restore-previous', restore: { enabled: true, start: false },
    })
    expect(stopped).toContain('launchctl unload "$unit"')
    expect(stopped).not.toContain('launchctl load')
    const started = starter.buildStopServerCommand({
      ...connection, targetOS: 'ssh-darwin', serverHome: '/Users/alice', action: 'restore-previous', restore: { enabled: true, start: true },
    })
    expect(started).toContain('launchctl load -w "$unit"')
  })

  it('stop-server discard-backup only deletes the backup file', () => {
    const command = starter.buildStopServerCommand({ ...connection, targetOS: 'ssh-linux', serverHome: '/home/alice', action: 'discard-backup' })
    expect(command).toBe("rm -f -- '/home/alice/.config/systemd/user/bat-server.service.bat-prev'")
  })

  it('the default action is unchanged (T0426)', () => {
    const base = { ...connection, targetOS: 'ssh-linux' as const, serverHome: '/home/alice' }
    expect(starter.buildStopServerCommand({ ...base, action: 'stop' })).toBe(starter.buildStopServerCommand(base))
  })

  it.each([
    ['unknown action', { action: 'nuke' }],
    ['restore without options', { action: 'restore-previous' }],
    ['restore with non-boolean', { action: 'restore-previous', restore: { enabled: 'yes', start: true } }],
  ])('stop-server rejects %s without spawning', async (_label, extra) => {
    const { commands, spawn } = routedSpawn(() => ({}))
    const result = await stopServerOnRemote({ ...connection, targetOS: 'ssh-linux', serverHome: '/home/alice', ...(extra as object) }, { spawn })
    expect(result.ok).toBe(false)
    expect(commands).toEqual([])
  })

  it('uninstall-bundle restore-previous: restore script + optional service start, outcome parsed', async () => {
    const { commands, spawn } = routedSpawn(() => ({ stdout: 'BAT_BUNDLE_RESTORE=restored\n' }))
    const result = await uninstallBundleOnRemote(
      { ...connection, installPath: '/home/alice/.local/bat-server', mode: 'restore-previous', startService: 'ssh-linux' },
      { spawn },
    )
    expect(result).toEqual({ ok: true, outcome: 'restored' })
    expect(commands[0]).toContain("dst='/home/alice/.local/bat-server'")
    expect(commands[0]).toContain('BAT_BUNDLE_RESTORE=restored')
    expect(commands[0].trim().split('\n').pop()).toContain('systemctl --user restart bat-server')
  })

  it('uninstall-bundle restore-previous without a marker is a failure', async () => {
    const { spawn } = routedSpawn(() => ({}))
    const result = await uninstallBundleOnRemote({ ...connection, installPath: '/home/alice/.local/bat-server', mode: 'restore-previous' }, { spawn })
    expect(result.ok).toBe(false)
  })

  it('uninstall-bundle discard-previous runs the cleanup script', async () => {
    const { commands, spawn } = routedSpawn(() => ({}))
    await expect(uninstallBundleOnRemote({ ...connection, installPath: '/home/alice/.local/bat-server', mode: 'discard-previous' }, { spawn }))
      .resolves.toEqual({ ok: true })
    expect(commands[0]).toContain('server bundle cleanup')
  })

  it.each([
    ['a ~ path', { installPath: '~/.local/bat-server', mode: 'restore-previous' }],
    ['a path not ending in bat-server', { installPath: '/home/alice/.local/other', mode: 'discard-previous' }],
    ['a one-segment path', { installPath: '/bat-server', mode: 'discard-previous' }],
    ['an unknown mode', { installPath: '/home/alice/.local/bat-server', mode: 'wipe' }],
    ['a bad startService', { installPath: '/home/alice/.local/bat-server', mode: 'restore-previous', startService: 'rm -rf' }],
  ])('uninstall-bundle rejects %s without spawning', async (_label, extra) => {
    const { commands, spawn } = routedSpawn(() => ({}))
    const result = await uninstallBundleOnRemote({ ...connection, ...(extra as { installPath: string }) }, { spawn })
    expect(result.ok).toBe(false)
    expect(commands).toEqual([])
  })

  it('remove mode (default) is unchanged (T0426)', () => {
    expect(starter.buildBundleTeardownCommand({ ...connection, installPath: '~/.local/bat-server' }))
      .toBe(starter.buildUninstallBundleCommand('~/.local/bat-server'))
  })
})

describe('SSH upload reports the previous install (T0554)', () => {
  function uploadSpawn(stdout: string): { args: string[][]; spawn: NonNullable<Parameters<typeof uploadServerBundle>[2]>['spawn'] } {
    const args: string[][] = []
    const spawn = ((_command: string, spawnArgs: readonly string[]) => {
      args.push([...spawnArgs])
      const proc = new EventEmitter() as EventEmitter & { stdin: PassThrough; stdout: PassThrough; stderr: PassThrough; kill: () => boolean }
      proc.stdin = new PassThrough()
      proc.stdout = new PassThrough()
      proc.stderr = new PassThrough()
      proc.kill = () => true
      proc.stdin.resume()
      proc.stdin.on('end', () => {
        proc.stdout.write(stdout)
        setImmediate(() => proc.emit('exit', 0))
      })
      return proc as unknown as ChildProcess
    }) as never
    return { args, spawn }
  }

  const deps = (spawn: unknown) => ({
    spawn: spawn as never,
    stat: async () => ({ size: 4 }),
    createReadStream: () => Readable.from([Buffer.from('tgz!')]) as unknown as ReadStream,
  })

  it('keepPrevious puts keep=1 in the remote command; previous parsed from stdout', async () => {
    const { args, spawn } = uploadSpawn('server bundle install: replaced\nBAT_BUNDLE_PREVIOUS=kept\n')
    const result = await uploadServerBundle(
      { sshHost: 'devbox', sshUser: 'alice', installPath: '/home/alice/.local/bat-server', tarballPath: 'C:\\b.tgz', keepPrevious: true },
      () => undefined,
      deps(spawn),
    )
    expect(result).toEqual({ previous: 'kept' })
    expect(args[0][args[0].length - 1]).toContain('keep=1')
  })

  it('without keepPrevious: keep=0 and no previous when the script printed none', async () => {
    const { args, spawn } = uploadSpawn('')
    const result = await uploadServerBundle(
      { sshHost: 'devbox', sshUser: 'alice', installPath: '/home/alice/.local/bat-server', tarballPath: 'C:\\b.tgz' },
      () => undefined,
      deps(spawn),
    )
    expect(result).toEqual({})
    expect(args[0][args[0].length - 1]).toContain('keep=0')
  })
})
