/**
 * T0379 (BUG-088): the SSH wizard's systemd unit / launchd plist carry
 * absolute paths only. systemd never expands `~` in ExecStart, launchd never
 * expands it in ProgramArguments, and the remote `mkdir` / `cat >` /
 * `launchctl load` arguments are single-quoted (no shell `~` expansion), so
 * every path is resolved against the probed remote $HOME. ssh is injected.
 */
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

import {
  __internals,
  startServerOnRemote,
  type StarterDeps,
  type StartServerOptions,
} from '../remote/ssh-start-server'

const { renderSystemdUnit, renderLaunchdPlist, resolveServerHome, expandHomePath } = __internals

const linux: StartServerOptions = {
  sshHost: 'devbox.example',
  sshUser: 'alice',
  targetOS: 'ssh-linux',
  installPath: '~/.local/bat-server',
  serverPort: 51820,
  serverHome: '/home/alice',
}

const darwin: StartServerOptions = { ...linux, targetOS: 'ssh-darwin', serverHome: '/Users/alice' }

/** ssh mock: every exec exits 0; records the remote command (last arg). */
function recordingSpawn(): { commands: string[]; spawn: NonNullable<StarterDeps['spawn']> } {
  const commands: string[] = []
  const spawn: NonNullable<StarterDeps['spawn']> = (_command, args) => {
    commands.push(String(args[args.length - 1]))
    const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean }
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    proc.kill = () => true
    setImmediate(() => {
      proc.stdout.emit('data', Buffer.from('active\n'))
      proc.emit('exit', 0)
    })
    return proc as unknown as ChildProcess
  }
  return { commands, spawn }
}

describe('renderSystemdUnit — absolute paths (T0379 / BUG-088)', () => {
  it('expands ~/ against serverHome; unit contains no ~', () => {
    const unit = renderSystemdUnit(linux)
    expect(unit).toMatch(/^ExecStart=\/home\/alice\/\.local\/bat-server\/bin\/bat-server$/m)
    expect(unit).not.toContain('~')
    expect(unit).not.toContain('%h')
  })

  it('leaves an absolute installPath unchanged', () => {
    const unit = renderSystemdUnit({ ...linux, installPath: '/opt/bat-server' })
    expect(unit).toMatch(/^ExecStart=\/opt\/bat-server\/bin\/bat-server$/m)
  })

  it('accepts a serverHome with a trailing slash without doubling it', () => {
    const unit = renderSystemdUnit({ ...linux, serverHome: '/home/alice/' })
    expect(unit).toMatch(/^ExecStart=\/home\/alice\/\.local\/bat-server\/bin\/bat-server$/m)
  })

  it('still rejects systemd structural chars after expansion (T0297 F-005)', () => {
    expect(() => renderSystemdUnit({ ...linux, installPath: '~/x[Service]' })).toThrow(/forbidden char/)
    expect(() => renderSystemdUnit({ ...linux, installPath: '/tmp=oops' })).toThrow(/forbidden char/)
  })

  it('rejects ~user/ and relative install paths instead of guessing', () => {
    expect(() => renderSystemdUnit({ ...linux, installPath: '~bob/bat-server' })).toThrow(/absolute or start with ~\//)
    expect(() => renderSystemdUnit({ ...linux, installPath: '.local/bat-server' })).toThrow(/absolute or start with ~\//)
  })
})

describe('renderLaunchdPlist — absolute paths (T0379 / BUG-088)', () => {
  it('ProgramArguments is absolute; plist contains no ~', () => {
    const plist = renderLaunchdPlist(darwin)
    expect(plist).toContain('<string>/Users/alice/.local/bat-server/bin/bat-server</string>')
    expect(plist).not.toContain('~')
  })

  it('leaves an absolute installPath unchanged', () => {
    const plist = renderLaunchdPlist({ ...darwin, installPath: '/opt/bat-server' })
    expect(plist).toContain('<string>/opt/bat-server/bin/bat-server</string>')
  })

  it('still XML-escapes the expanded path (T0297 F-005)', () => {
    const plist = renderLaunchdPlist({ ...darwin, installPath: '~/a&b</string><key>RunAsUser</key><string>root' })
    expect(plist).toContain('<string>/Users/alice/a&amp;b&lt;/string&gt;&lt;key&gt;RunAsUser&lt;/key&gt;&lt;string&gt;root/bin/bat-server</string>')
    expect(plist).not.toMatch(/<key>RunAsUser<\/key>/)
  })
})

describe('serverHome validation (T0379)', () => {
  const bad: Array<[string, unknown]> = [
    ['missing', undefined],
    ['empty', ''],
    ['relative', 'home/alice'],
    ['tilde', '~'],
    ['space', '/home/al ice'],
    ['quote', "/home/al'ice"],
    ['dollar', '/home/$USER'],
    ['newline', '/home/alice\n[Service]'],
    ['dot-dot', '/home/../root'],
  ]

  it.each(bad)('rejects %s serverHome in both renderers', (_label, serverHome) => {
    const opts = { ...linux, serverHome } as unknown as StartServerOptions
    expect(() => renderSystemdUnit(opts)).toThrow(/serverHome/)
    expect(() => renderLaunchdPlist({ ...opts, targetOS: 'ssh-darwin' })).toThrow(/serverHome/)
  })

  it.each(bad)('rejects %s serverHome before any ssh exec (no file written)', async (_label, serverHome) => {
    const { commands, spawn } = recordingSpawn()
    await expect(
      startServerOnRemote({ ...linux, serverHome } as unknown as StartServerOptions, undefined, { spawn }),
    ).rejects.toThrow(/serverHome/)
    expect(commands).toHaveLength(0)
  })

  it('helpers: resolveServerHome normalises, expandHomePath keeps absolute paths', () => {
    expect(resolveServerHome('/home/alice')).toBe('/home/alice')
    expect(resolveServerHome('/home/alice//')).toBe('/home/alice')
    expect(expandHomePath('~', '/home/alice')).toBe('/home/alice')
    expect(expandHomePath('~/.local/bat-server', '/home/alice')).toBe('/home/alice/.local/bat-server')
    expect(expandHomePath('/opt/bat-server', '/home/alice')).toBe('/opt/bat-server')
    // root home: joins stay single-slash
    expect(expandHomePath('~/.local/bat-server', resolveServerHome('/'))).toBe('/.local/bat-server')
  })
})

describe('startServerOnRemote — written file locations are absolute (T0379)', () => {
  it('systemd: unit written to <home>/.config/systemd/user with absolute ExecStart', async () => {
    const { commands, spawn } = recordingSpawn()
    const result = await startServerOnRemote(linux, undefined, { spawn })
    expect(result.ok).toBe(true)
    expect(result.servicePath).toBe('/home/alice/.config/systemd/user/bat-server.service')
    const write = commands[0]
    expect(write).toContain("mkdir -p '/home/alice/.config/systemd/user'")
    expect(write).toContain("cat > '/home/alice/.config/systemd/user/bat-server.service' << 'EOF'")
    expect(write).toContain('ExecStart=/home/alice/.local/bat-server/bin/bat-server')
    expect(write).not.toContain('~')
  })

  it('launchd: plist written and loaded from <home>/Library/LaunchAgents', async () => {
    const { commands, spawn } = recordingSpawn()
    const result = await startServerOnRemote(darwin, undefined, { spawn })
    expect(result.ok).toBe(true)
    expect(result.servicePath).toBe('/Users/alice/Library/LaunchAgents/com.bat-server.plist')
    expect(commands[0]).toContain("cat > '/Users/alice/Library/LaunchAgents/com.bat-server.plist' << 'EOF'")
    expect(commands[0]).not.toContain('~')
    expect(commands[1]).toBe("launchctl load -w '/Users/alice/Library/LaunchAgents/com.bat-server.plist'")
  })
})
