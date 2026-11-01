// T0742 / BUG-156: the Docker wizard's "Create new" container gets a host port picked by
// `docker:pick-server-port` (T0649, `pickDockerServerPort` → the shared `pickServerPort`), never the
// port this BAT's RemoteServer listens on and never a port another program holds. Before T0649 the
// wizard published bat-server on host 127.0.0.1:9876 — the RemoteServer's default port — so
// "Create new" failed with the port taken (`git show 99abe9a1^:src/components/setup-wizard/steps/docker/start-server.ts`:
// `ctx.state.serverPort ?? ctx.serverPort ?? 9876`; there was no pick IPC).
//
// Without a `container` option the pick never runs docker (only "Use existing" inspects a container),
// so this needs no Docker engine and creates nothing. One scenario: the isolated instance's
// RemoteServer listens on `remotePort`; the test holds the first free port of the scan range
// (9877–9976); the wizard's three pick shapes are asked:
//   - previousPort = the RemoteServer port (an earlier attempt's port is normally kept while free)
//   - previousPort = the held port
//   - preferredPort = the RemoteServer port → refused as this BAT's own remote server
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts.

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0742-docker-port')
const SCAN_START = 9877 // SERVER_PORT_SCAN_START, electron/wsl-systemd.ts
const SCAN_END = 9976

type Pick = { ok: true; port: number; reusedExistingPort?: boolean } | { ok: false; errorCode: string; error: string }

function listen(port: number): Promise<net.Server | null> {
  return new Promise(resolve => {
    const srv = net.createServer()
    srv.once('error', () => resolve(null))
    srv.listen({ port, host: '127.0.0.1', exclusive: true }, () => resolve(srv))
  })
}

async function isFree(port: number): Promise<boolean> {
  const srv = await listen(port)
  if (!srv) return false
  await new Promise<void>(r => srv.close(() => r()))
  return true
}

function canConnect(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const sock = net.connect({ port, host: '127.0.0.1' })
    sock.once('connect', () => { sock.destroy(); resolve(true) })
    sock.once('error', () => resolve(false))
  })
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

test('the Docker wizard port pick skips the RemoteServer port and a busy port, without docker', async () => {
  test.setTimeout(120_000)
  let inst: IsolatedInstance | undefined
  let held: net.Server | null = null
  try {
    inst = await launchIsolated('t0742-docker-port', log)
    const { win, userData, remotePort } = inst
    await expect.poll(() => canConnect(remotePort), { timeout: 30_000, message: 'RemoteServer listening' }).toBe(true)
    log(`RemoteServer listens on 127.0.0.1:${remotePort}`)

    let heldPort = 0
    for (let p = SCAN_START; p <= SCAN_END && !held; p++) {
      if (p === remotePort) continue
      held = await listen(p)
      if (held) heldPort = p
    }
    expect(held, 'a free port to hold in the scan range').not.toBeNull()
    log(`holding 127.0.0.1:${heldPort} (the first free port of ${SCAN_START}–${SCAN_END})`)

    const pick = (options: object) => win.evaluate(async (o) => (window as AnyApi).electronAPI.docker.pickServerPort(o), options) as Promise<Pick>

    const afterRemote = await pick({ previousPort: remotePort })
    const afterHeld = await pick({ previousPort: heldPort })
    const preferRemote = await pick({ preferredPort: remotePort })
    log(`pick(previousPort=${remotePort}) → ${JSON.stringify(afterRemote)}`)
    log(`pick(previousPort=${heldPort}) → ${JSON.stringify(afterHeld)}`)
    log(`pick(preferredPort=${remotePort}) → ${JSON.stringify(preferRemote)}`)

    for (const r of [afterRemote, afterHeld]) {
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.port).not.toBe(remotePort)
      expect(r.port).not.toBe(heldPort)
      expect(r.port).not.toBe(9876)
      expect(r.port).toBeGreaterThanOrEqual(SCAN_START)
      expect(r.port).toBeLessThanOrEqual(SCAN_END)
      expect(r.reusedExistingPort ?? false).toBe(false)
      expect(await isFree(r.port), `picked port ${r.port} is really free`).toBe(true)
    }
    expect(preferRemote.ok).toBe(false)
    if (!preferRemote.ok) {
      expect(preferRemote.errorCode).toBe('docker-port-in-use')
      expect(preferRemote.error).toContain("this BAT's own remote server")
    }

    const lines = readDebugLogs(userData).split('\n').filter(l => l.includes('docker pick-server-port'))
    log(`debug log:\n${lines.join('\n')}`)
    expect(lines.some(l => l.includes(`excluded host ports: ${remotePort}`))).toBe(true)
    // No container option → no `docker inspect` (the only docker call in pickDockerServerPort).
    expect(lines.some(l => /docker-inspect-failed/.test(l))).toBe(false)
  } finally {
    if (held) await new Promise<void>(r => held!.close(() => r()))
    await closeIsolated(inst, log)
  }
})
