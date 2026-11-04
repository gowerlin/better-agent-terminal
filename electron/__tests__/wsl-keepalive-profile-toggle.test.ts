/**
 * T0830 (PLAN-043, D271): WSL keep-alive can be turned off per profile (default on).
 *
 * - keepAliveProfileDistros: a profile without `wslKeepAlive` (written before T0830) is held,
 *   `false` is not, `true` is; several profiles on one distro → held while any keeps it on;
 *   non-WSL / empty distro ignored
 * - with WslKeepAlive: turning a profile off kills its holder, back on re-spawns it; a wizard
 *   pin still holds a distro whose profile is off
 * - ProfileManager.update persists `wslKeepAlive` (inside withIndexLock) and leaves it alone
 *   when the update does not carry it
 * - source guard: main.ts syncWslKeepAlive selects distros only through keepAliveProfileDistros
 */
import { EventEmitter } from 'events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const paths = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => paths.userData } }))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import { WslKeepAlive, keepAliveProfileDistros, type KeepAliveProfileLike } from '../wsl-keepalive'
import { ProfileManager } from '../profile-manager'

class FakeChild extends EventEmitter {
  static nextPid = 5000
  pid = FakeChild.nextPid++
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  kill = vi.fn(() => {
    this.signalCode = 'SIGTERM'
    this.emit('exit', null, 'SIGTERM')
    return true
  })
}

let children: Array<{ distro: string; child: FakeChild }>

function make(): WslKeepAlive {
  return new WslKeepAlive({
    platform: 'win32',
    spawn: ((_cmd: string, args: readonly string[]) => {
      const child = new FakeChild()
      children.push({ distro: args[1], child })
      return child as unknown as ChildProcess
    }) as never,
    logger: { log: vi.fn(), error: vi.fn() },
    backoffMs: [100],
    stableMs: 10_000,
  })
}

const wsl = (distro: string, over: Partial<KeepAliveProfileLike> = {}): KeepAliveProfileLike =>
  ({ targetOS: 'wsl-linux', wslDistro: distro, ...over })

beforeEach(() => {
  children = []
})

describe('keepAliveProfileDistros (T0830)', () => {
  it('holds a profile without the field (pre-T0830 profiles keep their holder)', () => {
    expect(keepAliveProfileDistros([wsl('Ubuntu')])).toEqual(['Ubuntu'])
  })

  it('leaves out `wslKeepAlive: false`, keeps `true`', () => {
    expect(keepAliveProfileDistros([wsl('Ubuntu', { wslKeepAlive: false })])).toEqual([])
    expect(keepAliveProfileDistros([wsl('Ubuntu', { wslKeepAlive: true })])).toEqual(['Ubuntu'])
  })

  it('one distro, several profiles: held while any of them keeps it on; listed once', () => {
    expect(keepAliveProfileDistros([
      wsl('Ubuntu', { wslKeepAlive: false }),
      wsl('Ubuntu'),
      wsl('Ubuntu', { wslKeepAlive: true }),
    ])).toEqual(['Ubuntu'])
    expect(keepAliveProfileDistros([
      wsl('Ubuntu', { wslKeepAlive: false }),
      wsl('Ubuntu', { wslKeepAlive: false }),
      wsl('Debian'),
    ])).toEqual(['Debian'])
  })

  it('ignores non-WSL profiles and WSL profiles without a distro', () => {
    expect(keepAliveProfileDistros([
      { targetOS: 'local' },
      { targetOS: 'docker-linux', wslDistro: 'Ubuntu' },
      { targetOS: 'ssh-linux' },
      { targetOS: 'wsl-linux' },
      { targetOS: 'wsl-linux', wslDistro: '' },
      {},
    ])).toEqual([])
  })
})

describe('WslKeepAlive driven by the per-profile setting (T0830)', () => {
  it('turning the profile off stops the holder; back on spawns a new one', () => {
    const ka = make()
    ka.sync(keepAliveProfileDistros([wsl('Ubuntu')]))
    expect(ka.activeDistros()).toEqual(['Ubuntu'])
    const first = children[0].child

    ka.sync(keepAliveProfileDistros([wsl('Ubuntu', { wslKeepAlive: false })]))
    expect(first.kill).toHaveBeenCalledTimes(1)
    expect(ka.activeDistros()).toEqual([])

    ka.sync(keepAliveProfileDistros([wsl('Ubuntu', { wslKeepAlive: true })]))
    expect(children).toHaveLength(2)
    expect(ka.activeDistros()).toEqual(['Ubuntu'])
  })

  it('a profile that is off spawns nothing', () => {
    const ka = make()
    ka.sync(keepAliveProfileDistros([wsl('Ubuntu', { wslKeepAlive: false })]))
    expect(children).toHaveLength(0)
  })

  it('a wizard pin still holds a distro whose profile is off, until unpinned', () => {
    const ka = make()
    ka.pin('Ubuntu')
    ka.sync(keepAliveProfileDistros([wsl('Ubuntu', { wslKeepAlive: false })]))
    expect(ka.activeDistros()).toEqual(['Ubuntu'])
    ka.unpin('Ubuntu')
    expect(ka.activeDistros()).toEqual([])
    expect(children[0].child.kill).toHaveBeenCalledTimes(1)
  })
})

describe('ProfileManager.update wslKeepAlive (T0830)', () => {
  beforeEach(() => {
    paths.userData = mkdtempSync(path.join(tmpdir(), 'bat-t0830-'))
  })
  afterEach(() => {
    rmSync(paths.userData, { recursive: true, force: true })
  })

  it('a new WSL profile has no field (= on); update writes false / true; other updates keep it', async () => {
    const pm = new ProfileManager()
    const created = await pm.create('wsl', { type: 'remote', remoteHost: '127.0.0.1' })
    await pm.update(created.id, { targetOS: 'wsl-linux', wslDistro: 'Ubuntu' })
    expect((await pm.getProfile(created.id))?.wslKeepAlive).toBeUndefined()
    expect(keepAliveProfileDistros((await pm.list()).profiles)).toEqual(['Ubuntu'])

    expect(await pm.update(created.id, { wslKeepAlive: false })).toBe(true)
    expect((await pm.getProfile(created.id))?.wslKeepAlive).toBe(false)
    expect(keepAliveProfileDistros((await pm.list()).profiles)).toEqual([])

    await pm.update(created.id, { remotePort: 9900 })
    expect((await pm.getProfile(created.id))?.wslKeepAlive).toBe(false)

    await pm.update(created.id, { wslKeepAlive: true })
    expect((await pm.getProfile(created.id))?.wslKeepAlive).toBe(true)
    expect(keepAliveProfileDistros((await pm.list()).profiles)).toEqual(['Ubuntu'])
  })

  it('a non-boolean value over IPC is ignored', async () => {
    const pm = new ProfileManager()
    const created = await pm.create('wsl', { type: 'remote', remoteHost: '127.0.0.1' })
    await pm.update(created.id, { wslKeepAlive: 'no' as unknown as boolean })
    expect((await pm.getProfile(created.id))?.wslKeepAlive).toBeUndefined()
  })
})

describe('source guard (T0830)', () => {
  it('main.ts syncWslKeepAlive picks distros through keepAliveProfileDistros', () => {
    const source = readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8')
    const start = source.indexOf('async function syncWslKeepAlive(')
    expect(start).toBeGreaterThan(0)
    const body = source.slice(start, source.indexOf('\n}\n', start))
    expect(body).toContain('keepAliveProfileDistros(profiles)')
    expect(body).not.toMatch(/\.filter\(/)
  })
})
