/**
 * T0378 (BUG-087 A / B): linger is enabled for an explicit, whitelisted user
 * and judged by `Linger=yes`; the rendered systemd unit carries absolute
 * paths only (systemd never expands `~`). execFile is injected.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  enableLinger,
  parseServiceState,
  renderSystemdUnit,
  resetExecFileImplForTests,
  resolveDistroUser,
  setExecFileImplForTests,
  startService,
} from '../wsl-systemd'

type Reply = { code?: number; stdout?: string; stderr?: string }

function installExec(route: (command: string[]) => Reply): string[][] {
  const commands: string[][] = []
  setExecFileImplForTests((_file: string, args: string[], _options: unknown, callback: (...cbArgs: unknown[]) => void) => {
    // args = ['-d', distro, '--', ...command]
    const command = args.slice(3)
    commands.push(command)
    const reply = route(command)
    const stdout = Buffer.from(reply.stdout ?? '')
    const stderr = Buffer.from(reply.stderr ?? '')
    if (reply.code) {
      callback(Object.assign(new Error(`Command failed: ${command.join(' ')}`), { code: reply.code }), stdout, stderr)
    } else {
      callback(null, stdout, stderr)
    }
    return undefined
  })
  return commands
}

afterEach(() => {
  resetExecFileImplForTests()
})

describe('enableLinger (T0378 / BUG-087 A)', () => {
  it('passes the resolved user name to loginctl and succeeds once Linger=yes', async () => {
    let lingerOn = false
    const commands = installExec((command) => {
      const line = command.join(' ')
      if (line === 'id -un') return { stdout: 'gower\n' }
      if (line === 'loginctl show-user gower -p Linger') {
        return lingerOn ? { stdout: 'Linger=yes\n' } : { code: 1, stderr: 'Failed to get user: User ID 1000 is not logged in or lingering' }
      }
      if (line === 'loginctl enable-linger gower') {
        lingerOn = true
        return {}
      }
      return { code: 1, stderr: `unexpected: ${line}` }
    })

    await expect(enableLinger('Ubuntu-24.04')).resolves.toEqual({ ok: true })
    expect(commands.map((c) => c.join(' '))).toEqual([
      'id -un',
      'loginctl show-user gower -p Linger',
      'loginctl enable-linger gower',
      'loginctl show-user gower -p Linger',
    ])
    // never the bare, session-dependent form that fails with ENXIO
    expect(commands.some((c) => c.join(' ') === 'loginctl enable-linger')).toBe(false)
  })

  it('treats an already-enabled linger as success without calling enable-linger', async () => {
    const commands = installExec((command) => {
      const line = command.join(' ')
      if (line === 'id -un') return { stdout: 'gower' }
      if (line === 'loginctl show-user gower -p Linger') return { stdout: 'Linger=yes' }
      return { code: 1 }
    })

    await expect(enableLinger('Ubuntu-24.04')).resolves.toEqual({ ok: true })
    expect(commands.some((c) => c[1] === 'enable-linger')).toBe(false)
  })

  it('judges by Linger=yes, not by loginctl exit code (ENXIO printed with exit 0)', async () => {
    installExec((command) => {
      const line = command.join(' ')
      if (line === 'id -un') return { stdout: 'gower' }
      if (line === 'loginctl show-user gower -p Linger') return { stdout: 'Linger=no' }
      if (line === 'loginctl enable-linger gower') {
        return { stderr: 'Could not enable linger: No such device or address' }
      }
      return { code: 1 }
    })

    const result = await enableLinger('Ubuntu-24.04')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No such device or address/)
  })

  it('reports a still-disabled linger even when loginctl prints nothing', async () => {
    installExec((command) => {
      const line = command.join(' ')
      if (line === 'id -un') return { stdout: 'gower' }
      if (line === 'loginctl show-user gower -p Linger') return { stdout: 'Linger=no' }
      return {}
    })

    const result = await enableLinger('Ubuntu-24.04')
    expect(result).toEqual({ ok: false, error: 'Linger is still disabled for gower' })
  })

  it('fails without running loginctl when the user name is not whitelisted', async () => {
    const commands = installExec((command) => {
      if (command.join(' ') === 'id -un') return { stdout: 'evil;rm -rf /' }
      return {}
    })

    const result = await enableLinger('Ubuntu-24.04')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Invalid WSL user name/)
    expect(commands.map((c) => c[0])).toEqual(['id'])
  })

  it('resolveDistroUser rejects an empty user name', async () => {
    installExec(() => ({ stdout: '' }))
    await expect(resolveDistroUser('Ubuntu')).rejects.toThrow(/Invalid WSL user name/)
  })
})

describe('renderSystemdUnit (T0378 / BUG-087 B)', () => {
  it('writes ExecStart / Environment as absolute paths with no `~`', () => {
    const unit = renderSystemdUnit({
      execStart: '/home/gower/.local/bat-server/bin/bat-server',
      environment: {
        BAT_PORT: '9876',
        BAT_DATA_DIR: '/home/gower/.local/share/bat-server',
        BAT_SERVER_DATA_DIR: '/home/gower/.local/share/bat-server',
      },
    })

    expect(unit).toContain('ExecStart="/home/gower/.local/bat-server/bin/bat-server"')
    expect(unit).toContain('Environment="BAT_DATA_DIR=/home/gower/.local/share/bat-server"')
    expect(unit).toContain('Environment="BAT_SERVER_DATA_DIR=/home/gower/.local/share/bat-server"')
    expect(unit).not.toContain('~')
  })

  it('rejects a tilde ExecStart (systemd: "Neither a valid executable name nor an absolute path")', () => {
    expect(() => renderSystemdUnit({ execStart: '~/.local/bat-server/bin/bat-server' })).toThrow(/Invalid Unix path/)
  })

  it('rejects a tilde Environment value', () => {
    expect(() =>
      renderSystemdUnit({
        execStart: '/home/gower/.local/bat-server/bin/bat-server',
        environment: { BAT_DATA_DIR: '~/.local/share/bat-server' },
      }),
    ).toThrow(/does not expand "~"/)
  })
})

/**
 * T0382 (BUG-091, D128): `Type=simple` is `active` right after fork, so the
 * start is only reported ok once the unit stayed active for the stability
 * window without systemd auto-restarting it; failures read the journal of
 * this start and EADDRINUSE maps to wsl-port-in-use.
 */
describe('startService stability check (T0382 / BUG-091)', () => {
  const SERVICE = 'bat-server.service'
  const FAST = { dataDir: '/home/gower/.local/share/bat-server', stableMs: 40, pollMs: 5, timeoutMs: 150 }
  const SHOW = `systemctl --user show ${SERVICE} -p ActiveState -p SubState -p NRestarts`

  function show(active: string, sub: string, restarts: number | null): Reply {
    const lines = [`ActiveState=${active}`, `SubState=${sub}`]
    if (restarts !== null) lines.unshift(`NRestarts=${restarts}`)
    return { stdout: `${lines.join('\n')}\n` }
  }

  /** Routes systemctl / journalctl; `states` is consumed one per `show` call (the last one repeats). */
  function installService(states: Reply[], journal = ''): string[][] {
    let index = 0
    return installExec((command) => {
      const line = command.join(' ')
      if (line === SHOW) {
        const reply = states[Math.min(index, states.length - 1)]
        index += 1
        return reply
      }
      if (line === 'date +%s') return { stdout: '1790000000\n' }
      if (command[0] === 'journalctl') return { stdout: journal }
      if (command[0] === 'cat') return { stdout: '{"token":"tok-1"}' }
      if (command[0] === 'systemctl') return {}
      return { code: 1, stderr: `unexpected: ${line}` }
    })
  }

  it('parses systemctl show output', () => {
    expect(parseServiceState('NRestarts=3\nActiveState=activating\nSubState=auto-restart\n')).toEqual({
      activeState: 'activating',
      subState: 'auto-restart',
      nRestarts: 3,
    })
    expect(parseServiceState('ActiveState=active\r\nSubState=running')).toEqual({
      activeState: 'active',
      subState: 'running',
      nRestarts: null,
    })
  })

  it('succeeds only after the unit stays active, then reads the token', async () => {
    const commands = installService([show('active', 'running', 0)])
    const result = await startService('Ubuntu-24.04', SERVICE, FAST)
    expect(result).toEqual({ ok: true, token: 'tok-1' })

    const lines = commands.map((c) => c.join(' '))
    expect(lines.slice(0, 4)).toEqual([
      'systemctl --user daemon-reload',
      `systemctl --user enable ${SERVICE}`,
      'date +%s',
      // restart, not `enable --now`: a server still running on an old port is replaced
      `systemctl --user restart ${SERVICE}`,
    ])
    expect(lines.filter((l) => l === SHOW).length).toBeGreaterThan(1)
    expect(lines.some((l) => l.startsWith('journalctl'))).toBe(false)
  })

  it('fails when the unit is active at first but NRestarts grows (crash loop)', async () => {
    installService(
      [show('active', 'running', 0), show('activating', 'auto-restart', 1)],
      'bat-server: starting\nError: boom\n',
    )
    const result = await startService('Ubuntu-24.04', SERVICE, FAST)
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-service-start-failed' })
    expect(!result.ok && result.error).toMatch(/restarted by systemd 1 time/)
    // the journal summary is attached to the error
    expect(!result.ok && result.error).toMatch(/--- journalctl --user -u bat-server\.service ---\n[\s\S]*Error: boom/)
  })

  it('fails when the unit leaves `active` inside the window even without NRestarts', async () => {
    installService([show('active', 'running', null), show('inactive', 'dead', null)])
    const result = await startService('Ubuntu-24.04', SERVICE, FAST)
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-service-start-failed' })
    expect(!result.ok && result.error).toMatch(/did not stay active \(ActiveState=inactive, SubState=dead\)/)
  })

  it('does not count NRestarts accumulated before this restart', async () => {
    installService([show('active', 'running', 7)])
    await expect(startService('Ubuntu-24.04', SERVICE, FAST)).resolves.toEqual({ ok: true, token: 'tok-1' })
  })

  it('maps EADDRINUSE in the journal of this start to wsl-port-in-use', async () => {
    const commands = installService(
      [show('active', 'running', 0), show('activating', 'auto-restart', 1)],
      [
        'Error: listen EADDRINUSE: address already in use 127.0.0.1:9876',
        '    at Server.setupListenHandle [as _listen2] (node:net:1908:16)',
        'bat-server.service: Main process exited, code=exited, status=1/FAILURE',
      ].join('\n'),
    )
    const result = await startService('Ubuntu-24.04', SERVICE, FAST)
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-port-in-use' })
    expect(!result.ok && result.error).toMatch(/could not bind its port 9876 \(EADDRINUSE\)/)

    const journalCall = commands.find((c) => c[0] === 'journalctl')
    expect(journalCall).toEqual([
      'journalctl', '--user', '-u', SERVICE, '--no-pager', '-o', 'cat', '-n', '50', '--since', '@1790000000',
    ])
  })

  it('times out with the journal summary when the unit never becomes active', async () => {
    installService([show('activating', 'start', 0)], 'waiting for something')
    const result = await startService('Ubuntu-24.04', SERVICE, { ...FAST, timeoutMs: 30 })
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-service-start-timeout' })
    expect(!result.ok && result.error).toMatch(/^Timed out waiting for bat-server\.service to become active/)
    expect(!result.ok && result.error).toMatch(/waiting for something/)
  })

  it('reports wsl-service-start-failed when systemctl restart itself fails', async () => {
    installExec((command) => {
      const line = command.join(' ')
      if (line === `systemctl --user restart ${SERVICE}`) return { code: 1, stderr: 'Job failed' }
      if (line === 'date +%s') return { stdout: '1790000000' }
      if (command[0] === 'journalctl') return { stdout: '' }
      return {}
    })
    const result = await startService('Ubuntu-24.04', SERVICE, FAST)
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-service-start-failed' })
  })
})
