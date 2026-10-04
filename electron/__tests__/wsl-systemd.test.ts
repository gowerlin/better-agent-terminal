/**
 * T0378 (BUG-087 A / B): linger is enabled for an explicit, whitelisted user
 * and judged by `Linger=yes`; the rendered systemd unit carries absolute
 * paths only (systemd never expands `~`). execFile is injected.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  enableLinger,
  renderSystemdUnit,
  resetExecFileImplForTests,
  resolveDistroUser,
  setExecFileImplForTests,
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
