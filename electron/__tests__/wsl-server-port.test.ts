/**
 * T0382 (BUG-091, D128): the WSL bat-server port is picked on the Windows
 * side — never the host RemoteServer's port, skipping ports already bound on
 * 127.0.0.1, and a user-specified port is validated instead of replaced.
 */
import * as net from 'net'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SERVER_PORT_SCAN_START,
  pickServerPort,
  probePortFree,
  resetPortProbeImplForTests,
  setPortProbeImplForTests,
} from '../wsl-systemd'

function installProbe(busy: Set<number>): number[] {
  const probed: number[] = []
  setPortProbeImplForTests(async (port) => {
    probed.push(port)
    return !busy.has(port)
  })
  return probed
}

afterEach(() => {
  resetPortProbeImplForTests()
})

describe('pickServerPort (T0382 / BUG-091)', () => {
  it('starts above the host default 9876', async () => {
    const probed = installProbe(new Set())
    await expect(pickServerPort({ excludePorts: [9876] })).resolves.toEqual({ ok: true, port: SERVER_PORT_SCAN_START })
    expect(SERVER_PORT_SCAN_START).toBe(9877)
    expect(probed).toEqual([9877])
  })

  it('never hands out the host RemoteServer port, even when the probe says it is free', async () => {
    // host BAT configured on 9877 (env/settings) and actually running on 9878
    const probed = installProbe(new Set())
    await expect(pickServerPort({ excludePorts: [9877, 9878] })).resolves.toEqual({ ok: true, port: 9879 })
    expect(probed).not.toContain(9877)
    expect(probed).not.toContain(9878)
  })

  it('moves on to the next port when a candidate is occupied', async () => {
    installProbe(new Set([9877, 9878, 9880]))
    await expect(pickServerPort({ excludePorts: [9876, 9879] })).resolves.toEqual({ ok: true, port: 9881 })
  })

  it('reports wsl-port-in-use when the whole range is taken', async () => {
    installProbe(new Set([9877, 9878, 9879]))
    const result = await pickServerPort({ excludePorts: [9876], scanStart: 9877, scanEnd: 9879 })
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-port-in-use' })
    expect(!result.ok && result.error).toMatch(/No free port between 9877 and 9879/)
  })

  it('accepts a free user-specified port as-is', async () => {
    const probed = installProbe(new Set())
    await expect(pickServerPort({ excludePorts: [9876], preferredPort: 12345 })).resolves.toEqual({ ok: true, port: 12345 })
    expect(probed).toEqual([12345])
  })

  it('rejects a user-specified port that is the host RemoteServer port', async () => {
    const probed = installProbe(new Set())
    const result = await pickServerPort({ excludePorts: [9876], preferredPort: 9876 })
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-port-in-use' })
    expect(!result.ok && result.error).toMatch(/BAT's own remote server/)
    expect(probed).toEqual([])
  })

  it('rejects a user-specified port that is already bound on Windows instead of picking another', async () => {
    const probed = installProbe(new Set([20000]))
    const result = await pickServerPort({ excludePorts: [9876], preferredPort: 20000 })
    expect(result).toMatchObject({ ok: false, errorCode: 'wsl-port-in-use' })
    expect(!result.ok && result.error).toMatch(/already in use on Windows/)
    expect(probed).toEqual([20000])
  })

  it.each([0, 80, 65536, 9877.5, '9877', Number.NaN])('rejects invalid user-specified port %p', async (preferredPort) => {
    const probed = installProbe(new Set())
    await expect(pickServerPort({ excludePorts: [9876], preferredPort })).resolves.toMatchObject({
      ok: false,
      errorCode: 'wsl-port-invalid',
    })
    expect(probed).toEqual([])
  })

  it('ignores junk entries in excludePorts', async () => {
    installProbe(new Set())
    await expect(pickServerPort({ excludePorts: [null, undefined, 'x', -1] })).resolves.toEqual({ ok: true, port: 9877 })
  })
})

describe('probePortFree (T0382 / BUG-091)', () => {
  it('reports a port bound on 127.0.0.1 as busy and releases its own probe socket', async () => {
    const holder = net.createServer()
    await new Promise<void>((resolve) => holder.listen(0, '127.0.0.1', resolve))
    const port = (holder.address() as net.AddressInfo).port
    try {
      await expect(probePortFree(port)).resolves.toBe(false)
    } finally {
      await new Promise<void>((resolve) => holder.close(() => resolve()))
    }

    await expect(probePortFree(port)).resolves.toBe(true)
    // the probe closed its own listener: the port can be bound again right away
    await expect(probePortFree(port)).resolves.toBe(true)
    const again = net.createServer()
    await new Promise<void>((resolve, reject) => {
      again.once('error', reject)
      again.listen(port, '127.0.0.1', resolve)
    })
    await new Promise<void>((resolve) => again.close(() => resolve()))
  })
})
