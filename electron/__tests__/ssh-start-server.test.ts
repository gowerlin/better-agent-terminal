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
    expect(unit).toMatch(/^ExecStart=\/home\/alice\/\.local\/bat-server\/bin\/bat-server --port 51820 --bind-interface localhost$/m)
    expect(unit).not.toContain('~')
    expect(unit).not.toContain('%h')
  })

  it('leaves an absolute installPath unchanged', () => {
    const unit = renderSystemdUnit({ ...linux, installPath: '/opt/bat-server' })
    expect(unit).toMatch(/^ExecStart=\/opt\/bat-server\/bin\/bat-server --port 51820 --bind-interface localhost$/m)
  })

  it('accepts a serverHome with a trailing slash without doubling it', () => {
    const unit = renderSystemdUnit({ ...linux, serverHome: '/home/alice/' })
    expect(unit).toMatch(/^ExecStart=\/home\/alice\/\.local\/bat-server\/bin\/bat-server --port 51820 --bind-interface localhost$/m)
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
    expect(commands[1]).toBe("launchctl unload '/Users/alice/Library/LaunchAgents/com.bat-server.plist' >/dev/null 2>&1; launchctl load -w '/Users/alice/Library/LaunchAgents/com.bat-server.plist'")
  })
})

/**
 * T0681 (BUG-168, D177): scenarios that only tests/ssh-start-server.test.ts
 * covered, carried over with the current expectations (T0511: `--port` /
 * `--bind-interface` flags, `enable` + `restart`, no BAT_REMOTE_* env). Paths
 * are absolute.
 */
describe('startServerOnRemote — carried over from tests/ssh-start-server.test.ts (T0681)', () => {
  const absLinux: StartServerOptions = { ...linux, installPath: '/home/alice/.local/bat-server' }
  const absDarwin: StartServerOptions = { ...darwin, installPath: '/Users/alice/.local/bat-server' }

  type Script = { stdout?: string; stderr?: string; exitCode?: number }

  /** ssh mock: one script per call, in order; extra calls throw. Records the full argv. */
  function scriptedSpawn(scripts: Script[]): { calls: string[][]; spawn: NonNullable<StarterDeps['spawn']> } {
    const calls: string[][] = []
    const spawn: NonNullable<StarterDeps['spawn']> = (_command, args) => {
      if (calls.length >= scripts.length) throw new Error(`spawn called more times than scripted (idx=${calls.length})`)
      const script = scripts[calls.length]
      calls.push([...args])
      const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean }
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      proc.kill = () => true
      setImmediate(() => {
        if (script.stdout) proc.stdout.emit('data', Buffer.from(script.stdout))
        if (script.stderr) proc.stderr.emit('data', Buffer.from(script.stderr))
        proc.emit('exit', script.exitCode ?? 0)
      })
      return proc as unknown as ChildProcess
    }
    return { calls, spawn }
  }

  const remoteCommand = (argv: string[]): string => argv[argv.length - 1]

  it('systemd unit carries the fixed sections and restart policy, and no Environment= lines', () => {
    const lines = renderSystemdUnit(absLinux).split('\n')
    for (const line of [
      '[Unit]',
      'Description=BAT remote server (PLAN-007)',
      'After=network.target',
      '[Service]',
      'Type=simple',
      'ExecStart=/home/alice/.local/bat-server/bin/bat-server --port 51820 --bind-interface localhost',
      'Restart=on-failure',
      'RestartSec=5s',
      '[Install]',
      'WantedBy=default.target',
    ]) {
      expect(lines).toContain(line)
    }
    expect(lines.some((line) => line.startsWith('Environment='))).toBe(false)
  })

  it('launchd plist carries Label, RunAtLoad and KeepAlive (Crashed / SuccessfulExit) in one plist root', () => {
    const plist = renderLaunchdPlist(absDarwin)
    expect(plist).toMatch(/<key>Label<\/key>\s*<string>com\.bat-server<\/string>/)
    expect(plist).toMatch(/<key>RunAtLoad<\/key>\s*<true\/>/)
    expect(plist).toMatch(/<key>KeepAlive<\/key>\s*<dict>\s*<key>Crashed<\/key>\s*<true\/>\s*<key>SuccessfulExit<\/key>\s*<false\/>\s*<\/dict>/)
    expect(plist.match(/<plist version="1\.0">/g)).toHaveLength(1)
    expect(plist.match(/<\/plist>/g)).toHaveLength(1)
    // a benign path needs no entity refs
    expect(plist).not.toMatch(/&amp;|&lt;|&gt;|&quot;|&apos;/)
  })

  it('systemd happy path: write → enable → verify, phases in order', async () => {
    const { calls, spawn } = scriptedSpawn([{}, {}, { stdout: 'bat-server active (pid 42), listening on port 51820\n' }])
    const phases: string[] = []
    const result = await startServerOnRemote(absLinux, (phase) => phases.push(phase), { spawn })
    expect(result).toMatchObject({ ok: true, method: 'systemd', checkOutput: 'bat-server active (pid 42), listening on port 51820' })
    expect(calls).toHaveLength(3)
    expect(phases).toEqual(['writing-unit', 'enabling', 'starting', 'verifying'])
  })

  it('launchd happy path: write → load → verify', async () => {
    const { calls, spawn } = scriptedSpawn([{}, {}, { stdout: 'com.bat-server running (pid 42), listening on port 51820\n' }])
    const result = await startServerOnRemote(absDarwin, undefined, { spawn })
    expect(result).toMatchObject({ ok: true, method: 'launchd' })
    expect(calls).toHaveLength(3)
    expect(remoteCommand(calls[2])).toBe(__internals.buildVerifyCommand('ssh-darwin', 51820))
  })

  it('a unit-write failure stops before enabling (one ssh exec, unit-write-failed)', async () => {
    const { calls, spawn } = scriptedSpawn([{ exitCode: 1, stderr: 'mkdir: cannot create directory: Read-only file system\n' }])
    const result = await startServerOnRemote(absLinux, undefined, { spawn })
    expect(result).toMatchObject({ ok: false, method: 'failed', errorCode: 'unit-write-failed' })
    expect(result.error).toMatch(/Read-only file system/)
    expect(calls).toHaveLength(1)
  })

  it('an enable failure stops before verifying (two ssh execs, enable-failed)', async () => {
    const { calls, spawn } = scriptedSpawn([{}, { exitCode: 1, stderr: 'Failed to enable-linger: not authorized\n' }])
    const result = await startServerOnRemote(absLinux, undefined, { spawn })
    expect(result).toMatchObject({ ok: false, method: 'failed', errorCode: 'enable-failed' })
    expect(result.error).toMatch(/not authorized/)
    expect(calls).toHaveLength(2)
  })

  it('a verify failure keeps the probe output in checkOutput', async () => {
    const { spawn } = scriptedSpawn([{}, {}, { exitCode: 1, stdout: 'inactive\n', stderr: 'Unit bat-server is not active\n' }])
    const result = await startServerOnRemote(absLinux, undefined, { spawn })
    expect(result).toMatchObject({ ok: false, errorCode: 'verify-failed' })
    expect(result.checkOutput).toMatch(/inactive/)
  })

  it('every ssh exec carries -o BatchMode=yes (T0296 EC-003)', async () => {
    const { calls, spawn } = scriptedSpawn([{}, {}, { stdout: 'ok\n' }])
    await startServerOnRemote(absLinux, undefined, { spawn })
    expect(calls).toHaveLength(3)
    for (const argv of calls) {
      const index = argv.indexOf('BatchMode=yes')
      expect(index).toBeGreaterThan(0)
      expect(argv[index - 1]).toBe('-o')
    }
  })

  it('an sshHost starting with - is rejected before any ssh exec (T0296 F-004)', async () => {
    const { calls, spawn } = scriptedSpawn([])
    await expect(startServerOnRemote({ ...absLinux, sshHost: '-oProxyCommand=evil.sh' }, undefined, { spawn }))
      .rejects.toThrow(/sshHost.*cannot start with '-'/)
    expect(calls).toHaveLength(0)
  })

  it('escapeSingleQuotes escapes apostrophes and rejects newline / control chars (T0296 EC-002)', () => {
    const { escapeSingleQuotes } = __internals
    expect(escapeSingleQuotes("O'Brien")).toBe("O'\\''Brien")
    expect(escapeSingleQuotes("a'b'c")).toBe("a'\\''b'\\''c")
    expect(escapeSingleQuotes('plain')).toBe('plain')
    expect(() => escapeSingleQuotes('evil\nuser')).toThrow(/forbidden newline/)
    expect(() => escapeSingleQuotes('/home/alice/.local/bat\rserver')).toThrow(/forbidden control char/)
  })

  it('an install path with an apostrophe still yields balanced remote commands', async () => {
    const { calls, spawn } = scriptedSpawn([{}, {}, { stdout: 'ok\n' }])
    await startServerOnRemote({ ...absLinux, installPath: "/opt/O'Brien/bat-server" }, undefined, { spawn })
    // the unit body sits between heredoc EOF markers: no shell interpretation
    expect(remoteCommand(calls[0])).toContain("ExecStart=/opt/O'Brien/bat-server/bin/bat-server --port 51820")
    const quotes = (remoteCommand(calls[1]).match(/'/g) ?? []).length
    expect(quotes % 2).toBe(0)
  })

  it('buildWriteUnitCommand: mkdir, then a single-quoted heredoc closed by EOF (D-T0286-#10)', () => {
    const cmd = __internals.buildWriteUnitCommand('/home/alice/.config/systemd/user', '/home/alice/.config/systemd/user/bat-server.service', 'unit body')
    expect(cmd).toBe([
      "mkdir -p '/home/alice/.config/systemd/user'",
      "cat > '/home/alice/.config/systemd/user/bat-server.service' << 'EOF'",
      'unit body',
      'EOF',
    ].join('\n'))
  })

  it('escapeXml maps the 5 XML special chars, & first (T0297 F-005)', () => {
    const { escapeXml } = __internals
    expect(escapeXml('&')).toBe('&amp;')
    expect(escapeXml('<')).toBe('&lt;')
    expect(escapeXml('>')).toBe('&gt;')
    expect(escapeXml('"')).toBe('&quot;')
    expect(escapeXml("'")).toBe('&apos;')
    expect(escapeXml('a&b<c')).toBe('a&amp;b&lt;c')
    expect(escapeXml('</string><key>Foo</key><string>x')).toBe('&lt;/string&gt;&lt;key&gt;Foo&lt;/key&gt;&lt;string&gt;x')
    expect(escapeXml('/home/alice/.local/bat-server')).toBe('/home/alice/.local/bat-server')
  })

  it('renderLaunchdPlist escapes a double quote in the install path (T0297 F-005)', () => {
    const plist = renderLaunchdPlist({ ...absDarwin, installPath: '/tmp/he said "hi"' })
    expect(plist).toContain('<string>/tmp/he said &quot;hi&quot;/bin/bat-server</string>')
  })

  it('renderSystemdUnit also rejects ] in the install path (T0297 F-005)', () => {
    expect(() => renderSystemdUnit({ ...absLinux, installPath: '/tmp/foo]bar' })).toThrow(/installPath contains forbidden char/)
  })

  it('validateSystemdValue passes benign values and rejects a newline (T0297 F-005)', () => {
    const { validateSystemdValue } = __internals
    expect(validateSystemdValue('/home/alice/.local/bat-server', 'installPath')).toBe('/home/alice/.local/bat-server')
    expect(validateSystemdValue('/opt/bat', 'installPath')).toBe('/opt/bat')
    expect(() => validateSystemdValue('/tmp\n[Service]\nExecStart=evil', 'installPath')).toThrow(/forbidden char/)
  })
})
