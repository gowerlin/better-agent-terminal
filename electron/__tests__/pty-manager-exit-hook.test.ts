// @vitest-environment node
/**
 * T0432 (PLAN-036 P3 / K): `PtyManagerDeps.onPtyExit` — the hook headless uses to revoke
 * a PTY's helper capability.
 *
 * - reported on kill, killAll, and an exit of its own
 * - a stale exit of a replaced process (restart = kill + create with the same id) is NOT
 *   reported, so the new PTY's capability survives it
 * - a throwing listener does not break kill / exit handling
 * - no hook (Electron) = nothing to call, behaviour unchanged
 *
 * Same fake node-pty seeding as pty-manager-limits.test.ts.
 */
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  /** Fires the exit callback PtyManager registered. */
  exit(exitCode = 0) {
    const cb = this.onExit.mock.calls[0]?.[0] as ((e: { exitCode: number }) => void) | undefined
    cb?.({ exitCode })
  }
}

const spawned: FakePty[] = []
const ptySpawn = vi.fn(() => {
  const p = new FakePty()
  spawned.push(p)
  return p
})
const CWD = os.tmpdir()
let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

let managers: PtyManagerType[] = []
const emit = vi.fn()

function makeManager(onPtyExit?: (id: string) => void): PtyManagerType {
  const manager = new PtyManager({ emit, dataDir: CWD, ...(onPtyExit ? { onPtyExit } : {}) })
  managers.push(manager)
  return manager
}

const create = (manager: PtyManagerType, id: string) =>
  manager.create({ id, cwd: CWD, type: 'terminal', shell: '/bin/sh' })

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  spawned.length = 0
  ptySpawn.mockClear()
  emit.mockClear()
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  vi.restoreAllMocks()
})

describe('PtyManager onPtyExit (T0432)', () => {
  it('reports kill', () => {
    const onPtyExit = vi.fn()
    const manager = makeManager(onPtyExit)
    create(manager, 'a')
    expect(manager.kill('a')).toBe(true)
    expect(onPtyExit).toHaveBeenCalledWith('a')
  })

  it('reports a PTY that exits on its own, alongside pty:exit', () => {
    const onPtyExit = vi.fn()
    const manager = makeManager(onPtyExit)
    create(manager, 'a')
    spawned[0].exit(3)
    expect(onPtyExit).toHaveBeenCalledWith('a')
    expect(emit).toHaveBeenCalledWith('pty:exit', 'a', 3)
    expect(manager.isAlive('a')).toBe(false)
  })

  it('reports every PTY of killAll', () => {
    const onPtyExit = vi.fn()
    const manager = makeManager(onPtyExit)
    create(manager, 'a')
    create(manager, 'b')
    expect(manager.killAll()).toBe(2)
    expect(onPtyExit.mock.calls.map(c => c[0]).sort()).toEqual(['a', 'b'])
  })

  it('restart: the old process\'s late exit is stale and NOT reported (new PTY keeps its capability)', () => {
    const onPtyExit = vi.fn()
    const manager = makeManager(onPtyExit)
    create(manager, 'a')
    expect(manager.restart('a', CWD, '/bin/sh')).toBe(true)
    expect(onPtyExit).toHaveBeenCalledTimes(1) // the kill inside restart
    onPtyExit.mockClear()
    spawned[0].exit(0) // old process exits after the new one was spawned
    expect(onPtyExit).not.toHaveBeenCalled()
    expect(manager.isAlive('a')).toBe(true)
  })

  it('a throwing listener does not break kill or exit handling', () => {
    const manager = makeManager(() => { throw new Error('boom') })
    create(manager, 'a')
    create(manager, 'b')
    expect(manager.kill('a')).toBe(true)
    expect(manager.isAlive('a')).toBe(false)
    spawned[1].exit(0)
    expect(manager.isAlive('b')).toBe(false)
    expect(emit).toHaveBeenCalledWith('pty:exit', 'b', 0)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('onPtyExit listener failed id=a'), expect.any(Error))
  })

  it('without a hook (Electron) kill and exit behave as before', () => {
    const manager = makeManager()
    create(manager, 'a')
    create(manager, 'b')
    expect(manager.kill('a')).toBe(true)
    spawned[1].exit(1)
    expect(emit).toHaveBeenCalledWith('pty:exit', 'b', 1)
    expect(logger.warn).not.toHaveBeenCalled()
  })
})
