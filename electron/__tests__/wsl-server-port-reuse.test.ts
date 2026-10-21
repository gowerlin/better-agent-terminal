/**
 * T0552 (BUG-138): re-running the WSL wizard while the old bat-server still
 * runs. Mirrored mode shares localhost, so the old server made its own port
 * look taken and the picker moved to the next one (9877 -> 9878), breaking the
 * existing profile. The port of the unit being rewritten is now reused; the
 * old service is stopped only when the port is busy, and a port really held by
 * another program still moves. execFile and the port probe are injected.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  parseExistingServerUnit,
  pickServerPort,
  pickServerPortForUnit,
  renderSystemdUnit,
  resetExecFileImplForTests,
  resetPortProbeImplForTests,
  setExecFileImplForTests,
  setPortProbeImplForTests,
} from '../wsl-systemd'

type Reply = { code?: number; stdout?: string; stderr?: string }

const UNIT_PATH = '/home/demo/.config/systemd/user/bat-server.service'
const SERVICE = 'bat-server.service'

function unitText(port: number): string {
  return renderSystemdUnit({
    execStart: '/home/demo/.local/bat-server/bin/bat-server',
    environment: {
      BAT_PORT: String(port),
      BAT_SERVER_PORT: String(port),
      BAT_DATA_DIR: '/home/demo/.local/share/bat-server',
      BAT_SERVER_DATA_DIR: '/home/demo/.local/share/bat-server',
    },
  })
}

function installExec(route: (command: string[]) => Reply): string[][] {
  const commands: string[][] = []
  setExecFileImplForTests((_file: string, args: string[], _options: unknown, callback: (...cbArgs: unknown[]) => void) => {
    const command = args.slice(3) // ['-d', distro, '--', ...command]
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

/** Port probe backed by a mutable busy set; records every probe. */
function installProbe(busy: Set<number>): number[] {
  const probed: number[] = []
  setPortProbeImplForTests(async (port) => {
    probed.push(port)
    return !busy.has(port)
  })
  return probed
}

/** A distro whose bat-server (unit port `port`) runs and holds `busy`'s port until stopped. */
function runningServer(port: number, busy: Set<number>, opts: { active?: boolean; unit?: string | null } = {}) {
  let active = opts.active ?? true
  return installExec((command) => {
    const line = command.join(' ')
    if (line === `cat ${UNIT_PATH}`) {
      return opts.unit === null ? { code: 1, stderr: 'No such file or directory' } : { stdout: opts.unit ?? unitText(port) }
    }
    if (line.startsWith(`systemctl --user show ${SERVICE}`)) {
      return { stdout: `ActiveState=${active ? 'active' : 'inactive'}\nSubState=${active ? 'running' : 'dead'}\nNRestarts=0\n` }
    }
    if (line === `systemctl --user stop ${SERVICE}`) {
      active = false
      busy.delete(port)
      return {}
    }
    if (line === `systemctl --user start ${SERVICE}`) {
      active = true
      busy.add(port)
      return {}
    }
    return { code: 1, stderr: `unexpected: ${line}` }
  })
}

const existing = { distro: 'Ubuntu-24.04', unitPath: UNIT_PATH, serviceName: SERVICE }

afterEach(() => {
  resetExecFileImplForTests()
  resetPortProbeImplForTests()
})

describe('parseExistingServerUnit (T0552)', () => {
  it('reads the port and ExecStart of a unit renderSystemdUnit wrote', () => {
    expect(parseExistingServerUnit(unitText(9877))).toEqual({
      port: 9877,
      execStart: '/home/demo/.local/bat-server/bin/bat-server',
    })
  })

  it('prefers BAT_SERVER_PORT, falls back to legacy BAT_PORT, accepts several assignments per line', () => {
    expect(parseExistingServerUnit('Environment="BAT_PORT=9890"\nEnvironment="BAT_SERVER_PORT=9877"\n').port).toBe(9877)
    expect(parseExistingServerUnit('[Service]\nEnvironment=BAT_PORT=9890\n').port).toBe(9890)
    expect(parseExistingServerUnit('Environment="BAT_DATA_DIR=/x" "BAT_SERVER_PORT=9881"\n').port).toBe(9881)
    expect(parseExistingServerUnit('ExecStart=/opt/bat/bin/bat-server\r\nEnvironment="BAT_SERVER_PORT=9877"\r\n')).toEqual({
      port: 9877,
      execStart: '/opt/bat/bin/bat-server',
    })
  })

  it.each([
    ['', null],
    ['Environment="BAT_SERVER_PORT=80"', null],
    ['Environment="BAT_SERVER_PORT=70000"', null],
    ['Environment="BAT_SERVER_PORT=98a7"', null],
    ['# Environment="BAT_SERVER_PORT=9877"', null],
  ])('no usable port in %p', (text, port) => {
    expect(parseExistingServerUnit(text).port).toBe(port)
  })
})

describe('pickServerPort with existingPort (T0552)', () => {
  it('reuses a free existing port without releasing anything', async () => {
    const probed = installProbe(new Set())
    let released = false
    await expect(pickServerPort({
      excludePorts: [9876],
      existingPort: 9890,
      releaseExistingPort: async () => { released = true; return true },
    })).resolves.toEqual({ ok: true, port: 9890, reusedExistingPort: true })
    expect(released).toBe(false)
    expect(probed).toEqual([9890])
  })

  it('busy existing port: releases it, waits until it frees up, reuses it', async () => {
    const busy = new Set([9877])
    let probes = 0
    setPortProbeImplForTests(async (port) => {
      probes += 1
      // the old server lets go two probes after the stop
      if (port === 9877 && probes >= 4) busy.delete(9877)
      return !busy.has(port)
    })
    await expect(pickServerPort({
      excludePorts: [9876],
      existingPort: 9877,
      releaseExistingPort: async () => true,
      releaseWaitMs: 5_000,
    })).resolves.toEqual({ ok: true, port: 9877, reusedExistingPort: true })
  })

  it('still busy after the release window -> scans, never handing out the busy port', async () => {
    const probed = installProbe(new Set([9877]))
    await expect(pickServerPort({
      excludePorts: [9876],
      existingPort: 9877,
      releaseExistingPort: async () => true,
      releaseWaitMs: 0,
    })).resolves.toEqual({ ok: true, port: 9878 })
    expect(probed.filter((port) => port === 9877).length).toBe(2) // before and after the release, not in the scan
  })

  it('nothing to release (service not running) -> busy port belongs to someone else -> scan', async () => {
    installProbe(new Set([9877]))
    await expect(pickServerPort({
      excludePorts: [9876],
      existingPort: 9877,
      releaseExistingPort: async () => false,
    })).resolves.toEqual({ ok: true, port: 9878 })
  })

  it('never reuses the host RemoteServer port, nor a junk port', async () => {
    installProbe(new Set())
    await expect(pickServerPort({ excludePorts: [9877], existingPort: 9877 })).resolves.toEqual({ ok: true, port: 9878 })
    await expect(pickServerPort({ excludePorts: [9876], existingPort: 80 })).resolves.toEqual({ ok: true, port: 9877 })
  })

  it('a user-specified port wins over the existing one', async () => {
    const probed = installProbe(new Set())
    await expect(pickServerPort({ excludePorts: [9876], preferredPort: 12345, existingPort: 9877 })).resolves.toEqual({ ok: true, port: 12345 })
    expect(probed).toEqual([12345])
  })
})

describe('pickServerPortForUnit (T0552 / BUG-138)', () => {
  it('old server running on 9877: stops it, keeps 9877 (was 9878 before the fix)', async () => {
    const busy = new Set([9877])
    const commands = runningServer(9877, busy)
    installProbe(busy)
    const logs: string[] = []
    await expect(pickServerPortForUnit({ excludePorts: [9876], existing, log: (m) => logs.push(m) }))
      .resolves.toEqual({ ok: true, port: 9877, reusedExistingPort: true })
    expect(commands.map((c) => c.join(' '))).toContain(`systemctl --user stop ${SERVICE}`)
    expect(commands.map((c) => c.join(' '))).not.toContain(`systemctl --user start ${SERVICE}`)
    expect(logs.join('\n')).toMatch(/stopped the running bat-server\.service/)
  })

  it('old server stopped already: reuses its port without touching systemd', async () => {
    const commands = runningServer(9877, new Set(), { active: false })
    installProbe(new Set())
    await expect(pickServerPortForUnit({ excludePorts: [9876], existing })).resolves.toEqual({ ok: true, port: 9877, reusedExistingPort: true })
    expect(commands.map((c) => c.join(' '))).toEqual([`cat ${UNIT_PATH}`])
  })

  it('port really held by another program: still moves to the next free port', async () => {
    const busy = new Set([9877])
    const commands = installExec((command) => {
      const line = command.join(' ')
      if (line === `cat ${UNIT_PATH}`) return { stdout: unitText(9877) }
      if (line.startsWith(`systemctl --user show ${SERVICE}`)) return { stdout: 'ActiveState=active\nSubState=running\nNRestarts=0\n' }
      if (line === `systemctl --user stop ${SERVICE}`) return {} // stopping does not free it: someone else owns it
      return { code: 1 }
    })
    installProbe(busy)
    await expect(pickServerPortForUnit({ excludePorts: [9876], existing, releaseWaitMs: 0 })).resolves.toEqual({ ok: true, port: 9878 })
    expect(commands.map((c) => c.join(' '))).toContain(`systemctl --user stop ${SERVICE}`)
  })

  it('starts the stopped service again when no port can be picked at all', async () => {
    const commands = installExec((command) => {
      const line = command.join(' ')
      if (line === `cat ${UNIT_PATH}`) return { stdout: unitText(9877) }
      if (line.startsWith(`systemctl --user show ${SERVICE}`)) return { stdout: 'ActiveState=active\n' }
      return {}
    })
    setPortProbeImplForTests(async () => false) // every port busy
    const result = await pickServerPortForUnit({ excludePorts: [9876], existing, releaseWaitMs: 0 })
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-port-in-use' })
    expect(commands.map((c) => c.join(' '))).toContain(`systemctl --user start ${SERVICE}`)
  })

  it('no unit in the distro (first install): plain scan, systemd untouched', async () => {
    const commands = runningServer(9877, new Set(), { unit: null })
    installProbe(new Set([9877]))
    await expect(pickServerPortForUnit({ excludePorts: [9876], existing })).resolves.toEqual({ ok: true, port: 9878 })
    expect(commands.map((c) => c.join(' '))).toEqual([`cat ${UNIT_PATH}`])
  })

  it('a user-specified port skips the unit entirely', async () => {
    const commands = runningServer(9877, new Set([9877]))
    installProbe(new Set())
    await expect(pickServerPortForUnit({ excludePorts: [9876], preferredPort: 12345, existing })).resolves.toEqual({ ok: true, port: 12345 })
    expect(commands).toEqual([])
  })

  it('without `existing` (older renderer) behaves as before', async () => {
    const commands = runningServer(9877, new Set([9877]))
    installProbe(new Set([9877]))
    await expect(pickServerPortForUnit({ excludePorts: [9876] })).resolves.toEqual({ ok: true, port: 9878 })
    expect(commands).toEqual([])
  })

  it.each([
    [{ ...existing, distro: 'bad;distro' }],
    [{ ...existing, unitPath: '~/.config/systemd/user/bat-server.service' }],
    [{ ...existing, serviceName: 'x; rm -rf /' }],
  ])('invalid `existing` input is not executed; falls back to the scan (%p)', async (bad) => {
    const commands = runningServer(9877, new Set([9877]))
    installProbe(new Set([9877]))
    await expect(pickServerPortForUnit({ excludePorts: [9876], existing: bad })).resolves.toEqual({ ok: true, port: 9878 })
    expect(commands).toEqual([])
  })
})
