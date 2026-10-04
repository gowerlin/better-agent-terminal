// @vitest-environment node
/**
 * T0404 (PLAN-036): PtyManager PTY cap + killAll.
 *
 * - `maxInstances` (headless only): a `pty:create` for a new id beyond the cap throws
 *   `PtyLimitError`; running PTYs are untouched, a re-sent create for a running id stays
 *   idempotent, and a kill frees a slot.
 * - Electron builds PtyManager without `maxInstances`: no cap and no timer of any kind —
 *   local PTY lifetime stays owned by the windows.
 *
 * pty-manager loads `@lydell/node-pty` with a plain `require`, which vi.mock does not
 * intercept, so a fake is seeded into the require cache before pty-manager is imported
 * (same pattern as pty-manager-locale-env.test.ts).
 */
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import { logger } from '../logger'
import type { PtyManager as PtyManagerType, PtyLimitError as PtyLimitErrorType } from '../pty-manager'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
}

const spawned: FakePty[] = []
const ptySpawn = vi.fn(() => {
  const p = new FakePty()
  spawned.push(p)
  return p
})
const CWD = os.tmpdir()
let PtyManager: typeof PtyManagerType
let PtyLimitError: typeof PtyLimitErrorType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager, PtyLimitError } = await import('../pty-manager'))
})

let managers: PtyManagerType[] = []

function makeManager(maxInstances?: number): PtyManagerType {
  const manager = new PtyManager({ emit: vi.fn(), dataDir: CWD, ...(maxInstances === undefined ? {} : { maxInstances }) })
  managers.push(manager)
  return manager
}

const create = (manager: PtyManagerType, id: string) =>
  manager.createWithResult({ id, cwd: CWD, type: 'terminal', shell: '/bin/sh' })

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  spawned.length = 0
  ptySpawn.mockClear()
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('PtyManager maxInstances (T0404)', () => {
  it('refuses the 65th new PTY with an explicit error and leaves the 64 running ones alone', () => {
    const manager = makeManager(64)
    for (let i = 0; i < 64; i++) expect(create(manager, `p${i}`)).toEqual({ ok: true, created: true })

    let error: unknown
    try {
      create(manager, 'p64')
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(PtyLimitError)
    expect((error as Error).message).toMatch(/PTY limit reached.*max 64/)
    expect((error as PtyLimitErrorType).code).toBe('PTY_LIMIT_REACHED')
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/REFUSED id=p64 .*64\/64/))

    expect(ptySpawn).toHaveBeenCalledTimes(64)
    expect(spawned.every(p => p.kill.mock.calls.length === 0)).toBe(true)
    for (let i = 0; i < 64; i++) expect(manager.isAlive(`p${i}`)).toBe(true)
    expect(manager.isAlive('p64')).toBe(false)
  })

  it('a re-sent pty:create for a running id at the cap stays idempotent', () => {
    const manager = makeManager(2)
    create(manager, 'a')
    create(manager, 'b')
    expect(create(manager, 'a')).toEqual({ ok: true, created: false })
    expect(ptySpawn).toHaveBeenCalledTimes(2)
  })

  it('a kill frees a slot: the next create succeeds', () => {
    const manager = makeManager(2)
    create(manager, 'a')
    create(manager, 'b')
    expect(() => create(manager, 'c')).toThrow(PtyLimitError)
    expect(manager.kill('a')).toBe(true)
    expect(create(manager, 'c')).toEqual({ ok: true, created: true })
    expect(() => create(manager, 'd')).toThrow(PtyLimitError)
  })

  it('killAll kills every PTY, returns the count, and frees every slot', () => {
    const manager = makeManager(3)
    create(manager, 'a')
    create(manager, 'b')
    create(manager, 'c')
    expect(manager.killAll()).toBe(3)
    expect(spawned.every(p => p.kill.mock.calls.length === 1)).toBe(true)
    expect(['a', 'b', 'c'].some(id => manager.isAlive(id))).toBe(false)
    expect(manager.killAll()).toBe(0)
    for (const id of ['d', 'e', 'f']) expect(create(manager, id)).toEqual({ ok: true, created: true })
  })

  it('maxInstances 0 means unlimited', () => {
    const manager = makeManager(0)
    for (let i = 0; i < 70; i++) create(manager, `z${i}`)
    expect(ptySpawn).toHaveBeenCalledTimes(70)
  })
})

describe('Electron PtyManager (no maxInstances) — no cap, no reclaim (T0404)', () => {
  it('creates past 64 PTYs and never kills them on its own, however long nothing happens', () => {
    vi.useFakeTimers()
    const manager = makeManager()
    for (let i = 0; i < 80; i++) expect(create(manager, `e${i}`)).toEqual({ ok: true, created: true })
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringMatching(/REFUSED/))

    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000)
    expect(spawned).toHaveLength(80)
    expect(spawned.every(p => p.kill.mock.calls.length === 0)).toBe(true)
    for (let i = 0; i < 80; i++) expect(manager.isAlive(`e${i}`)).toBe(true)
  })
})
