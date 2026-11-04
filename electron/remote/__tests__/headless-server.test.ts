// @vitest-environment node
/**
 * Headless server factory (`createHeadlessServer`).
 *
 * T0388: migrated from the tsx script `tests/headless-server.test.ts` (not in
 * vitest include, so it never ran in `npm run test:unit`) and extended with
 * wire-level cases through the headless harness.
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { FileCertificateProvider, type LoadedCertificateBundle } from '../certificate'
import { HEADLESS_UNSUPPORTED } from '../headless-channel-status'
import { createHeadlessServer, type HeadlessServer } from '../headless-entry'
import { readSecretFile } from '../secrets'
import {
  readServerToken,
  resetExecFileImplForTests as resetDockerExecFileImplForTests,
  setExecFileImplForTests as setDockerExecFileImplForTests,
} from '../../docker-lifecycle'
import {
  connectHeadlessClient,
  makeHeadlessDataDir,
  removeHeadlessDataDir,
  startHeadlessHarness,
  type HeadlessHarness,
} from './helpers/headless-harness'

const quietLogger = { log: () => {}, warn: () => {}, error: () => {} }

class TestCertificateProvider extends FileCertificateProvider {
  renewCalls = 0

  override async renew(): Promise<LoadedCertificateBundle> {
    this.renewCalls += 1
    return super.renew()
  }
}

const dataDirs: string[] = []
const servers: HeadlessServer[] = []
const harnesses: HeadlessHarness[] = []

function dataDir(label: string): string {
  const dir = makeHeadlessDataDir(label)
  dataDirs.push(dir)
  return dir
}

async function server(opts: Partial<Parameters<typeof createHeadlessServer>[0]> & { dataDir: string }) {
  const created = await createHeadlessServer({ port: 0, logger: quietLogger, ...opts })
  servers.push(created)
  return created
}

async function harness(opts?: Parameters<typeof startHeadlessHarness>[0]) {
  const created = await startHeadlessHarness(opts)
  harnesses.push(created)
  return created
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map(h => h.dispose()))
  for (const s of servers.splice(0)) await s.stop()
  for (const dir of dataDirs.splice(0)) removeHeadlessDataDir(dir)
})

describe('createHeadlessServer — factory (migrated from tests/headless-server.test.ts)', { timeout: 30_000 }, () => {
  it('constructs without throwing', async () => {
    const s = await server({ dataDir: dataDir('construct') })
    expect(s.getInfo().pid).toBe(process.pid)
  })

  it('start() returns actual port, fingerprint, and bind address', async () => {
    const s = await server({ dataDir: dataDir('start') })
    const started = await s.start()
    expect(started.port).toBeGreaterThan(0)
    expect(started.fingerprint.length).toBeGreaterThan(10)
    expect(started.bindAddress).toBe('127.0.0.1')
  })

  it('token persistence reuses the same token hash for the same dataDir', async () => {
    const dir = dataDir('token')
    const a = await server({ dataDir: dir })
    const hashA = a.getInfo().tokenHash
    await a.stop()

    const b = await server({ dataDir: dir })
    expect(b.getInfo().tokenHash).toBe(hashA)
  })

  // T0849: the Docker wizard reads <dataDir>/server-token.json once the container is healthy —
  // for a container created before D283 (`--token <t>`) as well as for one that made its own.
  it('start() with opts.token writes server-token.json holding that token (T0849)', async () => {
    const dir = dataDir('token-flag')
    const token = 'flag-token-T0849-abcdef'
    const s = await server({ dataDir: dir, token })
    await s.start()

    const record = JSON.parse(fs.readFileSync(path.join(dir, 'server-token.json'), 'utf8')) as { encrypted?: boolean; data?: string }
    expect(record.encrypted).toBe(false)
    expect(record.data).toBe(token)
  })

  it('the file a server writes is what the Docker wizard reads back (T0849)', async () => {
    const dir = dataDir('token-read-back')
    const s = await server({ dataDir: dir })
    await s.start()
    const raw = fs.readFileSync(path.join(dir, 'server-token.json'), 'utf8')
    const expected = await readSecretFile(path.join(dir, 'server-token.json'))
    expect(expected).toBeTruthy()

    setDockerExecFileImplForTests((_file: string, args: string[], _options: unknown, callback: (...cbArgs: unknown[]) => void) => {
      if (args[0] === 'inspect') callback(null, JSON.stringify([{ Config: { Cmd: ['--data-dir', '/var/lib/bat-server'] } }]), '')
      else if (args[0] === 'exec' && args[3] === '/var/lib/bat-server/server-token.json') callback(null, raw, '')
      else callback(new Error('unexpected docker call'), '', '')
    })
    try {
      expect(await readServerToken('bat-dev')).toEqual({ ok: true, token: expected, source: 'file' })
    } finally {
      resetDockerExecFileImplForTests()
    }
  })

  it('lockfile fail-fast rejects a second instance while the first lock is alive', async () => {
    const dir = dataDir('lock')
    const a = await server({ dataDir: dir })
    await a.start()

    const b = await server({ dataDir: dir })
    await expect(b.start()).rejects.toThrow(/Another bat-server instance is already using/)
  })

  it('stop() removes the lockfile', async () => {
    const dir = dataDir('stop')
    const lockfilePath = path.join(dir, 'lockfile.pid')
    const s = await server({ dataDir: dir })
    await s.start()
    expect(fs.existsSync(lockfilePath)).toBe(true)
    await s.stop()
    expect(fs.existsSync(lockfilePath)).toBe(false)
  })

  it('rotateToken and renewCertificate delegate to the underlying server', async () => {
    const dir = dataDir('rotate')
    const certificateProvider = new TestCertificateProvider(dir)
    const s = await server({ dataDir: dir, certificateProvider })
    await s.start()

    const before = s.getInfo().tokenHash
    const rotated = await s.rotateToken({ gracePeriodMs: 1234 })
    expect(rotated.token).not.toBe(rotated.oldToken)
    expect(s.getInfo().tokenHash).not.toBe(before)
    expect(rotated.oldValidUntil).toBeGreaterThan(Date.now())

    const renewed = await s.renewCertificate()
    expect(renewed.fingerprint.length).toBeGreaterThan(10)
    expect(renewed.expiresAt).toBeGreaterThan(Date.now())
    expect(certificateProvider.renewCalls).toBeGreaterThanOrEqual(1)
  })
})

describe('createHeadlessServer — over the wire (headless harness)', { timeout: 30_000 }, () => {
  it('answers a built-in channel through an authenticated wss client', async () => {
    const h = await harness()
    expect(await h.invoke('profile:load-snapshot', 'default')).toBeNull()
    expect(await h.invoke('profile:list')).toEqual({ profiles: [], activeProfileIds: [] })
  })

  it('settings:save then settings:load round-trips through dataDir', async () => {
    const h = await harness()
    expect(await h.invoke('settings:load')).toBeNull()
    expect(await h.invoke('settings:save', JSON.stringify({ fontSize: 15 }))).toBe(true)
    expect(JSON.parse(await h.invoke('settings:load') as string)).toEqual({ fontSize: 15 })
  })

  it('rejects an unregistered channel with the same error a remote window sees', async () => {
    const h = await harness()
    // Any channel headless still lacks (pty:create was the example until T0390 brought it online).
    const channel = Object.keys(HEADLESS_UNSUPPORTED)[0]
    await expect(h.invoke(channel)).rejects.toThrow(`No handler for channel: ${channel}`)
  })

  it('caller-supplied handlers are reachable and can override built-ins', async () => {
    const h = await harness({
      handlers: [
        { channel: 'profile:list', handler: () => ({ profiles: ['override'], activeProfileIds: [] }) },
      ],
    })
    expect(await h.invoke('profile:list')).toEqual({ profiles: ['override'], activeProfileIds: [] })
  })

  it('refuses a client with the wrong token', async () => {
    const h = await harness()
    await expect(
      connectHeadlessClient({ port: h.port, token: 'wrong-token', fingerprint: h.fingerprint }),
    ).rejects.toThrow('Invalid token')
  })

  it('refuses to talk to a server whose fingerprint does not match the pin', async () => {
    const h = await harness()
    await expect(
      connectHeadlessClient({ port: h.port, token: h.token, fingerprint: 'AA:BB' }),
    ).rejects.toThrow(/fingerprint mismatch/)
  })
})
