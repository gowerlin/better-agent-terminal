/**
 * T0509: profiles/index.json read-modify-write is serialized. Concurrent `profile:create` used
 * to race on the shared `index.json.tmp` and the rename over `index.json` (Windows EPERM, plan039
 * e2e M3) and could lose each other's entry. Every ProfileManager method now runs its whole
 * read → modify → write in one queue, and the rename retries EPERM / EBUSY / EACCES a fixed
 * number of times before throwing.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const paths = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => paths.userData } }))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))
vi.mock('fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return { ...actual, rename: vi.fn(actual.rename) }
})

import * as fsp from 'fs/promises'
import { logger } from '../logger'
import { __test__, INDEX_RENAME_RETRY_DELAYS_MS, ProfileManager, type ProfileIndex } from '../profile-manager'

const realRename = (await vi.importActual<typeof import('fs/promises')>('fs/promises')).rename
const renameMock = vi.mocked(fsp.rename)

function profilesDir(): string { return join(paths.userData, 'profiles') }
function indexPath(): string { return join(profilesDir(), 'index.json') }
function readJson(file: string): ProfileIndex { return JSON.parse(readFileSync(file, 'utf-8')) }

function errno(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: operation failed, rename`), { code })
}

let sleeps: number[]
let restoreSleep: (ms: number) => Promise<void>

beforeEach(() => {
  paths.userData = mkdtempSync(join(tmpdir(), 'bat-t0509-'))
  renameMock.mockReset()
  renameMock.mockImplementation(realRename)
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.error).mockClear()
  sleeps = []
  restoreSleep = __test__.setSleep(async ms => { sleeps.push(ms) })
})

afterEach(() => {
  __test__.setSleep(restoreSleep)
  rmSync(paths.userData, { recursive: true, force: true })
})

describe('T0509 concurrent index mutations', () => {
  it('N concurrent creates all land in index.json, with no EPERM and no leftover .tmp', async () => {
    const pm = new ProfileManager()
    const N = 24
    const names = Array.from({ length: N }, (_, i) => `remote ${i}`)
    const results = await Promise.allSettled(names.map(name => pm.create(name, { type: 'remote', remoteHost: '127.0.0.1' })))

    expect(results.filter(r => r.status === 'rejected')).toEqual([])
    const index = readJson(indexPath())
    expect(index.profiles.map(p => p.name).sort()).toEqual(['Default', ...names].sort())
    expect(new Set(index.profiles.map(p => p.id)).size).toBe(N + 1)
    expect(existsSync(`${indexPath()}.tmp`)).toBe(false)

    // .bak rotation unchanged: it is the index as it was before the last write.
    const bak = readJson(`${indexPath()}.bak`)
    expect(bak.profiles).toHaveLength(N)
    expect(index.profiles.slice(0, N)).toEqual(bak.profiles)
  })

  it('same-name concurrent creates (and duplicates) get distinct ids', async () => {
    const pm = new ProfileManager()
    const created = await Promise.all(Array.from({ length: 6 }, () => pm.create('Same Name')))
    const dup = await Promise.all([pm.duplicate('default', 'Same Name'), pm.duplicate('default', 'Same Name')])

    const ids = [...created.map(e => e.id), ...dup.map(e => e!.id)]
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe('same-name')
    const index = readJson(indexPath())
    expect(index.profiles.map(p => p.id).sort()).toEqual(['default', ...ids].sort())
  })

  it('concurrent create / update / rename / delete / activate / deactivate all apply', async () => {
    const pm = new ProfileManager()
    await Promise.all(['a', 'b', 'c', 'd'].map(n => pm.create(n)))

    await Promise.all([
      pm.create('e'),
      pm.create('f', { type: 'remote', remoteHost: 'h' }),
      pm.update('a', { remoteHost: 'host-a', sshPort: 2222 }),
      pm.update('b', { targetOS: 'wsl-linux', wslDistro: 'Ubuntu' }),
      pm.rename('c', 'C renamed'),
      pm.delete('d'),
      pm.activateProfile('a'),
      pm.activateProfile('b'),
      pm.deactivateProfile('default'),
      pm.load('c'),
    ])

    const index = readJson(indexPath())
    const byId = new Map(index.profiles.map(p => [p.id, p]))
    expect([...byId.keys()].sort()).toEqual(['a', 'b', 'c', 'default', 'e', 'f'])
    expect(byId.get('a')).toMatchObject({ remoteHost: 'host-a', sshPort: 2222 })
    expect(byId.get('b')).toMatchObject({ targetOS: 'wsl-linux', wslDistro: 'Ubuntu' })
    expect(byId.get('c')!.name).toBe('C renamed')
    expect(byId.get('f')).toMatchObject({ type: 'remote', remoteHost: 'h' })
    expect([...index.activeProfileIds].sort()).toEqual(['a', 'b', 'c'])
    expect(existsSync(join(profilesDir(), 'd.json'))).toBe(false)
    expect(JSON.parse(readFileSync(join(profilesDir(), 'c.json'), 'utf-8')).name).toBe('C renamed')
  })

  it('a read queued after a create sees that create', async () => {
    const pm = new ProfileManager()
    const [entry, seen, list] = await Promise.all([pm.create('x'), pm.getProfile('x'), pm.list()])
    expect(seen).toMatchObject({ id: 'x', name: 'x', createdAt: entry.createdAt })
    expect(list.profiles.map(p => p.id)).toContain('x')
  })

  it('control group: the same read-modify-write without the lock loses updates', async () => {
    const pm = new ProfileManager()
    await pm.list() // first-run init writes the default index
    const N = 8

    // The pre-T0509 interleaving: every caller reads before any of them writes.
    let reads = 0
    let releaseWrites!: () => void
    const allRead = new Promise<void>(resolve => { releaseWrites = resolve })
    const unlockedCreate = async (i: number) => {
      const index = (await __test__.readIndex())!
      if (++reads === N) releaseWrites()
      await allRead
      index.profiles.push({ id: `p${i}`, name: `p${i}`, type: 'local', createdAt: 0, updatedAt: 0 })
      await __test__.writeIndex(index)
    }
    const results = await Promise.allSettled(Array.from({ length: N }, (_, i) => unlockedCreate(i)))

    const failed = results.filter(r => r.status === 'rejected').length
    const kept = readJson(indexPath()).profiles.length - 1
    // Either some writes failed (EPERM / shared .tmp) or updates were lost — never all N kept.
    expect(failed > 0 || kept < N).toBe(true)
    expect(kept).toBeLessThan(N)
  })
})

describe('T0509 index rename retry', () => {
  it('retries EPERM / EBUSY / EACCES with the documented back-off, then succeeds', async () => {
    const pm = new ProfileManager()
    await pm.list()
    renameMock.mockClear()
    renameMock
      .mockRejectedValueOnce(errno('EPERM'))
      .mockRejectedValueOnce(errno('EBUSY'))
      .mockRejectedValueOnce(errno('EACCES'))

    await expect(pm.create('retry me')).resolves.toMatchObject({ id: 'retry-me' })
    expect(sleeps).toEqual(INDEX_RENAME_RETRY_DELAYS_MS.slice(0, 3))
    expect(renameMock).toHaveBeenCalledTimes(4)
    expect(logger.warn).toHaveBeenCalledTimes(3)
    expect(readJson(indexPath()).profiles.map(p => p.id)).toContain('retry-me')
  })

  it('gives up after a finite number of attempts and throws the last error (not swallowed)', async () => {
    const pm = new ProfileManager()
    await pm.list()
    renameMock.mockClear()
    renameMock.mockRejectedValue(errno('EPERM'))

    await expect(pm.create('never')).rejects.toMatchObject({ code: 'EPERM' })
    expect(INDEX_RENAME_RETRY_DELAYS_MS).toEqual([25, 50, 100, 200, 400, 800])
    expect(sleeps).toEqual([...INDEX_RENAME_RETRY_DELAYS_MS])
    expect(renameMock).toHaveBeenCalledTimes(INDEX_RENAME_RETRY_DELAYS_MS.length + 1)
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(readJson(indexPath()).profiles.map(p => p.id)).toEqual(['default'])

    // A failed mutation does not jam the queue.
    renameMock.mockImplementation(realRename)
    await expect(pm.create('after')).resolves.toMatchObject({ id: 'after' })
    expect(readJson(indexPath()).profiles.map(p => p.id)).toEqual(['default', 'after'])
  })

  it('does not retry other errors', async () => {
    const pm = new ProfileManager()
    await pm.list()
    renameMock.mockClear()
    renameMock.mockRejectedValueOnce(errno('EXDEV'))

    await expect(pm.create('cross device')).rejects.toMatchObject({ code: 'EXDEV' })
    expect(sleeps).toEqual([])
    expect(renameMock).toHaveBeenCalledTimes(1)
  })
})

describe('T0509 corruption fallback unchanged', () => {
  it('a corrupt index.json falls back to .bak and is quarantined, not overwritten', async () => {
    const pm = new ProfileManager()
    await pm.create('kept')
    await pm.create('later') // .bak now holds [default, kept]
    writeFileSync(indexPath(), '{ not json', 'utf-8')

    const list = await pm.list()
    expect(list.profiles.map(p => p.id)).toEqual(['default', 'kept'])
    expect(readFileSync(indexPath(), 'utf-8')).toBe('{ not json')
  })
})
