/**
 * T0511 — SSH wizard install / start fixes.
 *
 * BUG-120: release tarballs have a top-level `staging/` (build-server-bundle
 * `tar -czf <bundle> staging`); the upload must strip it so the bundle lands
 * at `<installPath>/bin/bat-server`, and clean a `staging/` left by a pre-fix
 * install.
 * BUG-121: bat-server reads `--port` / `--bind-interface`, not
 * `BAT_REMOTE_PORT` / `BAT_REMOTE_BIND`; verify must check that the service's
 * own process listens on the port (no `pgrep -x bat-server` fallback).
 * ssh is injected; nothing is spawned.
 */
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

import { __internals as uploader } from '../ssh-bundle-uploader'
import {
  __internals as starter,
  startServerOnRemote,
  type StarterDeps,
  type StartServerOptions,
} from '../ssh-start-server'

const linux: StartServerOptions = {
  sshHost: 'devbox',
  sshUser: '',
  targetOS: 'ssh-linux',
  installPath: '~/.local/bat-server',
  serverPort: 9876,
  serverHome: '/home/bat',
}
const darwin: StartServerOptions = { ...linux, targetOS: 'ssh-darwin', serverHome: '/Users/bat' }

/** ssh mock: exit code per call index (default 0); records the remote command. */
function scriptedSpawn(exitCodes: number[] = []): { commands: string[]; spawn: NonNullable<StarterDeps['spawn']> } {
  const commands: string[] = []
  const spawn: NonNullable<StarterDeps['spawn']> = (_command, args) => {
    const index = commands.length
    commands.push(String(args[args.length - 1]))
    const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean }
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    proc.kill = () => true
    const code = exitCodes[index] ?? 0
    setImmediate(() => {
      if (code !== 0) proc.stderr.emit('data', Buffer.from('bat-server.service is active (MainPID 42); no socket of that process listens on port 9876\n'))
      proc.emit('exit', code)
    })
    return proc as unknown as ChildProcess
  }
  return { commands, spawn }
}

describe('BUG-120: upload extracts the bundle without the staging/ level', () => {
  const command = uploader.buildSshArgs({
    sshHost: 'devbox',
    sshUser: '',
    installPath: '/home/bat/.local/bat-server',
    tarballPath: 'bat-server.tar.gz',
  }).at(-1)!

  it('strips the top-level directory', () => {
    expect(command).toContain("mkdir -p '/home/bat/.local/bat-server' && cd '/home/bat/.local/bat-server'")
    expect(command).toContain('tar xz --strip-components=1')
    expect(command).not.toMatch(/tar xz( &&|$)/)
  })

  it('removes a staging/ left by a pre-fix install, only when it holds a bundle launcher', () => {
    expect(command).toContain('{ if [ -f staging/bin/bat-server ]; then rm -rf -- staging; fi; }')
    // cleanup runs after `cd` succeeded (inside the && chain), never in another cwd
    expect(command.indexOf("cd '/home/bat/.local/bat-server'")).toBeLessThan(command.indexOf('rm -rf -- staging'))
    expect(command.indexOf('rm -rf -- staging')).toBeLessThan(command.indexOf('tar xz'))
  })

  it('fails the upload when the extracted layout has no bin/bat-server', () => {
    expect(command).toMatch(/tar xz --strip-components=1 && \{ test -x bin\/bat-server \|\| \{ echo '[^']+' >&2; exit 1; \}; \}$/)
  })
})

describe('BUG-121: unit / plist pass --port and --bind-interface', () => {
  it('systemd ExecStart carries the flags; no BAT_REMOTE_* env', () => {
    const unit = starter.renderSystemdUnit(linux)
    expect(unit).toMatch(/^ExecStart=\/home\/bat\/\.local\/bat-server\/bin\/bat-server --port 9876 --bind-interface localhost$/m)
    expect(unit).not.toContain('BAT_REMOTE_PORT')
    expect(unit).not.toContain('BAT_REMOTE_BIND')
  })

  it('launchd ProgramArguments carries the flags; no BAT_REMOTE_* env', () => {
    const plist = starter.renderLaunchdPlist(darwin)
    expect(plist).toContain([
      '  <key>ProgramArguments</key>',
      '  <array>',
      '    <string>/Users/bat/.local/bat-server/bin/bat-server</string>',
      '    <string>--port</string>',
      '    <string>9876</string>',
      '    <string>--bind-interface</string>',
      '    <string>localhost</string>',
      '  </array>',
    ].join('\n'))
    expect(plist).not.toContain('BAT_REMOTE_PORT')
    expect(plist).not.toContain('BAT_REMOTE_BIND')
    expect(plist).not.toContain('EnvironmentVariables')
  })

  it('uses the default port when none is given and rejects a non-integer port', () => {
    const { serverPort: _omit, ...noPort } = linux
    expect(starter.renderSystemdUnit(noPort as StartServerOptions)).toContain(`--port ${starter.DEFAULT_SERVER_PORT} `)
    for (const bad of [0, 65536, 1.5, Number.NaN]) {
      expect(() => starter.renderSystemdUnit({ ...linux, serverPort: bad })).toThrow(/serverPort/)
    }
  })

  it('rejects a bad port before any ssh exec', async () => {
    const { commands, spawn } = scriptedSpawn()
    await expect(startServerOnRemote({ ...linux, serverPort: 70000 }, undefined, { spawn })).rejects.toThrow(/serverPort/)
    expect(commands).toHaveLength(0)
  })
})

describe('BUG-121: enable restarts; verify checks the service process listens on the port', () => {
  it('systemd: enable + restart (a running service picks up the new bundle / args)', async () => {
    const { commands, spawn } = scriptedSpawn()
    const result = await startServerOnRemote(linux, undefined, { spawn })
    expect(result.ok).toBe(true)
    expect(commands[1]).toBe('loginctl enable-linger "$(id -un)" && systemctl --user daemon-reload && systemctl --user enable bat-server && systemctl --user restart bat-server')
  })

  it('launchd: unload (ignored) then load -w', async () => {
    const { commands, spawn } = scriptedSpawn()
    await startServerOnRemote(darwin, undefined, { spawn })
    expect(commands[1]).toBe("launchctl unload '/Users/bat/Library/LaunchAgents/com.bat-server.plist' >/dev/null 2>&1; launchctl load -w '/Users/bat/Library/LaunchAgents/com.bat-server.plist'")
  })

  it('systemd verify: active + MainPID owns a LISTEN socket on the port; no pgrep / bare ss fallback', () => {
    const cmd = starter.buildVerifyCommand('ssh-linux', 9876)
    expect(cmd.startsWith("sh -c '")).toBe(true)
    expect(cmd).toContain('systemctl --user is-active bat-server')
    expect(cmd).toContain('systemctl --user show -p MainPID bat-server')
    expect(cmd).toContain('/proc/net/tcp /proc/net/tcp6')
    // 9876 = 0x2694, state 0A = LISTEN
    expect(cmd).toContain('$4 == "0A" && $2 ~ /:2694$/')
    expect(cmd).toContain('grep -qF "socket:[$n]"')
    expect(cmd).toContain('exit 1')
    expect(cmd).not.toContain('pgrep')
    expect(cmd).not.toContain('ss -tnlp')
    expect(cmd).not.toMatch(/\|\|/)
  })

  it('launchd verify: the job PID must hold the LISTEN socket; no pgrep', () => {
    const cmd = starter.buildVerifyCommand('ssh-darwin', 9876)
    expect(cmd).toContain('launchctl list')
    expect(cmd).toContain('$3 == "com.bat-server"')
    expect(cmd).toContain('lsof -nP -a -p "$pid" -iTCP:9876 -sTCP:LISTEN')
    expect(cmd).not.toContain('pgrep')
  })

  it('the remote verify command is the generated script', async () => {
    const { commands, spawn } = scriptedSpawn()
    await startServerOnRemote(linux, undefined, { spawn })
    expect(commands[2]).toBe(starter.buildVerifyCommand('ssh-linux', 9876))
  })

  it('a failing verify returns verify-failed with the probe output', async () => {
    const { spawn } = scriptedSpawn([0, 0, 1])
    const result = await startServerOnRemote(linux, undefined, { spawn })
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('verify-failed')
    expect(result.error).toContain('no socket of that process listens on port 9876')
  })
})
