// @vitest-environment node
/**
 * T0406 (PLAN-036 P2-I): fs:* / image:read-as-data-url / workspace:sync-roots on headless.
 *
 * Wire-level through the T0388 harness (in-process headless + real wss clients),
 * against `mkdtemp` directories only — never the user's files.
 *   - nothing synced ⇒ every fs / image call is denied (fail closed)
 *   - sync-roots([dir]) ⇒ inside allowed, outside denied; `/` and `..` rejected
 *   - roots are per connection: union of two clients; closing one drops its roots
 *   - fs:watch → file change → the client receives fs:changed
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HEADLESS_UNSUPPORTED } from '../headless-channel-status'
import { PROXIED_CHANNELS } from '../protocol'
import { startHeadlessHarness, type HeadlessClient, type HeadlessHarness } from './helpers/headless-harness'

const T0406_CHANNELS = [
  'fs:readdir', 'fs:readFile', 'fs:stat', 'fs:search', 'fs:watch', 'fs:unwatch', 'fs:reset-watch',
  'image:read-as-data-url', 'workspace:sync-roots',
]

let harness: HeadlessHarness
let dirA: string
let dirB: string

const denied = { error: 'Path access denied' }

beforeAll(async () => {
  dirA = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0406-a-')))
  dirB = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0406-b-')))
  fs.writeFileSync(path.join(dirA, 'a.txt'), 'from A\n')
  fs.writeFileSync(path.join(dirA, 'img.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  fs.writeFileSync(path.join(dirB, 'b.txt'), 'from B\n')
  harness = await startHeadlessHarness({ timeoutMs: 15_000 })
}, 60_000)

afterAll(async () => {
  await harness?.dispose()
  for (const dir of [dirA, dirB]) if (dir) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
})

describe('T0406 ledger', () => {
  it('fs / image / workspace:sync-roots are proxied and no longer HEADLESS_UNSUPPORTED', () => {
    for (const channel of T0406_CHANNELS) {
      expect(PROXIED_CHANNELS.has(channel), channel).toBe(true)
      expect(HEADLESS_UNSUPPORTED[channel], channel).toBeUndefined()
    }
  })
})

describe('headless fs sandbox (wire level)', () => {
  it('fails closed before any workspace:sync-roots', async () => {
    expect(await harness.invoke('fs:readdir', dirA)).toEqual([])
    expect(await harness.invoke('fs:readFile', path.join(dirA, 'a.txt'))).toEqual(denied)
    expect(await harness.invoke('fs:stat', path.join(dirA, 'a.txt'))).toBeNull()
    expect(await harness.invoke('fs:search', dirA, 'a')).toEqual([])
    expect(await harness.invoke('fs:watch', dirA)).toBe(false)
    await expect(harness.invoke('image:read-as-data-url', path.join(dirA, 'img.png'))).rejects.toThrow('Path access denied')
  })

  it('rejects `/` (filesystem root), `..` and relative roots — nothing opens up', async () => {
    const fsRoot = path.parse(dirA).root
    const result = await harness.invoke('workspace:sync-roots', [fsRoot, `${dirA}${path.sep}..${path.sep}..`, `${dirA}/..`, 'relative/x']) as {
      ok: boolean; roots: string[]; rejected: Array<{ root: string; reason: string }>
    }
    expect(result.ok).toBe(true)
    expect(result.roots).toEqual([])
    expect(result.rejected.map(r => r.reason)).toEqual(['filesystem root', 'contains a .. segment', 'contains a .. segment', 'not an absolute path on the server'])
    expect(await harness.invoke('fs:readFile', path.join(dirA, 'a.txt'))).toEqual(denied)
    expect(await harness.invoke('fs:readdir', fsRoot)).toEqual([])
  })

  it('after sync-roots([dirA]): inside allowed, outside denied', async () => {
    expect(await harness.invoke('workspace:sync-roots', [dirA])).toEqual({ ok: true, roots: [dirA], rejected: [] })
    const entries = await harness.invoke('fs:readdir', dirA) as Array<{ name: string }>
    expect(entries.map(e => e.name).sort()).toEqual(['a.txt', 'img.png'])
    expect(await harness.invoke('fs:readFile', path.join(dirA, 'a.txt'))).toEqual({ content: 'from A\n' })
    expect(await harness.invoke('fs:stat', path.join(dirA, 'a.txt'))).toMatchObject({ size: 7 })
    expect(await harness.invoke('fs:search', dirA, 'IMG')).toEqual([{ name: 'img.png', path: path.join(dirA, 'img.png'), isDirectory: false }])
    expect(await harness.invoke('image:read-as-data-url', path.join(dirA, 'img.png'))).toBe('data:image/png;base64,iVBORw==')
    // outside the synced root
    expect(await harness.invoke('fs:readFile', path.join(dirB, 'b.txt'))).toEqual(denied)
    expect(await harness.invoke('fs:readFile', path.join(dirA, '..', path.basename(dirB), 'b.txt'))).toEqual(denied)
    expect(await harness.invoke('fs:readdir', os.tmpdir())).toEqual([])
  })

  it('roots are per connection: two clients union; closing one drops only its roots', async () => {
    let second: HeadlessClient | null = await harness.connect()
    try {
      // the second connection has pushed nothing yet — but the allowlist is the union
      expect(await second.invoke('fs:readFile', path.join(dirA, 'a.txt'))).toEqual({ content: 'from A\n' })
      expect(await second.invoke('fs:readFile', path.join(dirB, 'b.txt'))).toEqual(denied)
      expect(await second.invoke('workspace:sync-roots', [dirB])).toEqual({ ok: true, roots: [dirB], rejected: [] })
      expect(await harness.invoke('fs:readFile', path.join(dirB, 'b.txt'))).toEqual({ content: 'from B\n' })
      expect(await harness.invoke('fs:readFile', path.join(dirA, 'a.txt'))).toEqual({ content: 'from A\n' })

      await second.close()
      second = null
      // the server drops the closed connection's roots on its close event
      await expect.poll(() => harness.invoke('fs:readFile', path.join(dirB, 'b.txt')), { timeout: 5_000, interval: 50 }).toEqual(denied)
      expect(await harness.invoke('fs:readFile', path.join(dirA, 'a.txt'))).toEqual({ content: 'from A\n' })
    } finally {
      await second?.close()
    }
  })

  it('fs:watch → a file changes → the client receives fs:changed for the watched dir', async () => {
    expect(await harness.invoke('fs:watch', dirA)).toBe(true)
    try {
      fs.writeFileSync(path.join(dirA, 'watched.txt'), String(Date.now()))
      const args = await harness.waitForEvent('fs:changed', a => a[0] === dirA, 10_000)
      expect(args).toEqual([dirA])
    } finally {
      expect(await harness.invoke('fs:unwatch', dirA)).toBe(true)
    }
  })

  it('a push replaces the connection\'s roots; an empty push denies again', async () => {
    expect(await harness.invoke('workspace:sync-roots', [])).toEqual({ ok: true, roots: [], rejected: [] })
    expect(await harness.invoke('fs:readFile', path.join(dirA, 'a.txt'))).toEqual(denied)
    await expect(harness.invoke('workspace:sync-roots', 'not-an-array')).rejects.toThrow(/expects an array/)
  })
})
