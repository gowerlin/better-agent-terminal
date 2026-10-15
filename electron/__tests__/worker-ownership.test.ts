// @vitest-environment node
/**
 * PLAN-041 / T0537: `--close-worker` after BAT reopens — main falls back to the Worker ownership
 * saved with the tab (window registry `terminals[].towerTerminalId` / `workorder`).
 *
 * - savedWorkerOwnership: only tabs with a Tower id and a valid work order (normalized); data
 *   saved before T0537 yields nothing; the first tab wins when an id repeats
 * - withSavedWorkerOwnership + WorkerCloseScheduler + a real PtyManager:
 *   a PTY registered from the Terminal Server's list (T0108) or re-created by the restored tab as
 *   a plain shell → ok; another tower → NOT_OWNER; no saved ownership / PTY not running →
 *   NOT_FOUND; what this process recorded wins over the saved tab; the Tower tab itself need not
 *   be saved (closed / renamed); a saved tab + a recorded Worker of one work order → AMBIGUOUS
 */
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { createRequire } from 'module'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('worker-ownership / close-worker / pty-manager must not import electron')
})

import { logger } from '../logger'
import { WorkerCloseScheduler } from '../close-worker'
import { savedWorkerOwnership, withSavedWorkerOwnership } from '../worker-ownership'
import type { PtyManager as PtyManagerType } from '../pty-manager'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
}

class FakeServer extends EventEmitter {
  connected = true
  sent: Array<{ type: string; id?: string }> = []
  send = (msg: { type: string; id?: string }) => { this.sent.push(msg); return true }
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: { env: Record<string, string> }) => new FakePty())
const CWD = os.tmpdir()
const SHELL = { cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' }
let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('savedWorkerOwnership (T0537)', () => {
  it('keeps tabs with a Tower id and a valid work order, normalized; the first tab of an id wins', () => {
    const owned = savedWorkerOwnership([
      {
        terminals: [
          { id: 'w1', workspaceId: 'ws', towerTerminalId: 'tw-a', workorder: ' t0537 ' },
          { id: 'w2', workspaceId: 'ws', towerTerminalId: 'tw-b', workorder: 'CT-T0012' },
          { id: 'tower', workspaceId: 'ws', title: 'Tower' },                       // pre-T0537 / plain tab
          { id: 'prompt', workspaceId: 'ws', towerTerminalId: 'tw-a' },              // prompt dispatch: no work order
          { id: 'bad', workspaceId: 'ws', towerTerminalId: 'tw-a', workorder: 'nope' },
          { id: 'blank', workspaceId: 'ws', towerTerminalId: '  ', workorder: 'T0001' },
          { id: 'num', workspaceId: 'ws', towerTerminalId: 7, workorder: 'T0001' },
          null,
          'junk',
        ],
      },
      { terminals: 'not-an-array' },
      {},
      { terminals: [{ id: 'w1', towerTerminalId: 'tw-z', workorder: 'T9999' }] },
    ])
    expect([...owned.entries()]).toEqual([
      ['w1', { towerTerminalId: 'tw-a', workorder: 'T0537' }],
      ['w2', { towerTerminalId: 'tw-b', workorder: 'CT-T0012' }],
    ])
  })

  it('data saved before T0537 (no new fields) yields nothing', () => {
    expect(savedWorkerOwnership([{ terminals: [{ id: 'a', workspaceId: 'ws', type: 'terminal', title: 'T', cwd: '/x' }] }]).size).toBe(0)
  })
})

describe('--close-worker with the saved ownership after BAT reopens (T0537)', () => {
  let dataDir: string
  const managers: PtyManagerType[] = []

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0537-pty-'))
  })

  afterEach(() => {
    for (const manager of managers.splice(0)) manager.dispose()
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  function makeManager(): PtyManagerType {
    const manager = new PtyManager({ emit: vi.fn(), dataDir })
    managers.push(manager)
    return manager
  }

  function setup(m: PtyManagerType, entries: Array<{ terminals?: unknown[] }>) {
    const emitted: Array<{ channel: string; payload: unknown }> = []
    const logs: string[] = []
    const log = (...args: unknown[]) => { logs.push(args.join(' ')) }
    const getSaved = vi.fn(() => savedWorkerOwnership(entries))
    const scheduler = new WorkerCloseScheduler({
      getPtyManager: () => withSavedWorkerOwnership(m, getSaved, { log }),
      emit: (channel, payload) => { emitted.push({ channel, payload }); return 1 },
      logger: { log, warn: () => {} },
    })
    return { scheduler, emitted, logs, getSaved }
  }

  const replayList = (m: PtyManagerType, ids: string[]) =>
    (m as unknown as { handleReplayList(p: Array<{ id: string; pid: number; cwd: string }>): void })
      .handleReplayList(ids.map((id, i) => ({ id, pid: 100 + i, cwd: CWD })))

  // Parent entry of a main window; a detached window's tabs are saved into it too (T0491).
  const ENTRIES = [{
    terminals: [
      { id: 'tower-a', workspaceId: 'ws-a', title: 'Tower A' },
      { id: 'worker-a', workspaceId: 'ws-a', towerTerminalId: 'tower-a', workorder: 'T0537' },
      { id: 'worker-b', workspaceId: 'ws-b', towerTerminalId: 'tower-b', workorder: 'T0538' },
    ],
  }]

  it('Terminal Server survived: a PTY registered from its list (no customEnv / work order) closes', () => {
    const m = makeManager()
    m.setServerProcess(new FakeServer() as unknown as ChildProcess)
    replayList(m, ['tower-a', 'worker-a'])
    expect(m.getWorkorder('worker-a')).toBeUndefined()
    const t = setup(m, ENTRIES)
    expect(t.scheduler.request({ towerId: 'tower-a', workorder: 't0537' })).toMatchObject({ ok: true, terminalId: 'worker-a', delayMs: 0 })
    expect(t.emitted).toEqual([{ channel: 'terminal:close-requested', payload: { id: 'worker-a' } }])
    expect(t.logs.join('\n')).toContain('[close-worker] id=worker-a workorder=T0537: ownership from the saved tab (tower=tower-a)')
  })

  it('Terminal Server gone: the restored tab re-created a plain shell (no work order) — still closes', () => {
    const m = makeManager()
    // WorkspaceView restore: pty:create with the workspace env only
    m.create({ id: 'worker-a', ...SHELL, customEnv: { FOO: '1' }, workspaceId: 'ws-a' })
    const t = setup(m, ENTRIES)
    expect(t.scheduler.request({ towerId: 'tower-a', workorder: 'T0537' })).toMatchObject({ ok: true, terminalId: 'worker-a' })
  })

  it('another tower → NOT_OWNER; unknown work order → NOT_FOUND', () => {
    const m = makeManager()
    m.create({ id: 'worker-a', ...SHELL })
    const t = setup(m, ENTRIES)
    expect(t.scheduler.request({ towerId: 'tower-b', workorder: 'T0537' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(t.scheduler.request({ towerId: 'tower-a', workorder: 'T0001' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(t.emitted).toEqual([])
  })

  it('saved tab whose PTY is not running (workspace not opened since the reopen) → NOT_FOUND', () => {
    const m = makeManager()
    const t = setup(m, ENTRIES)
    expect(t.scheduler.request({ towerId: 'tower-b', workorder: 'T0538' })).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('data saved before T0537 → NOT_FOUND, as before', () => {
    const m = makeManager()
    m.create({ id: 'worker-a', ...SHELL })
    const t = setup(m, [{ terminals: [{ id: 'worker-a', workspaceId: 'ws-a', title: 'Remote: claude' }] }])
    expect(t.scheduler.request({ towerId: 'tower-a', workorder: 'T0537' })).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('the Tower tab itself need not be saved (closed or renamed after the dispatch)', () => {
    const m = makeManager()
    m.create({ id: 'worker-a', ...SHELL })
    const t = setup(m, [{ terminals: [{ id: 'worker-a', workspaceId: 'ws-a', towerTerminalId: 'tower-a', workorder: 'T0537' }] }])
    expect(t.scheduler.request({ towerId: 'tower-a', workorder: 'T0537' })).toMatchObject({ ok: true, terminalId: 'worker-a' })
  })

  it('what this process recorded wins over the saved tab', () => {
    const m = makeManager()
    // re-dispatched in this session with another tower / work order than the stale saved tab
    m.create({ id: 'worker-a', ...SHELL, customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-x' }, workorder: 'T0600' })
    const t = setup(m, ENTRIES)
    expect(t.scheduler.request({ towerId: 'tower-a', workorder: 'T0537' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(t.scheduler.request({ towerId: 'tower-x', workorder: 'T0600' })).toMatchObject({ ok: true, terminalId: 'worker-a' })
  })

  it('a saved Worker and a Worker recorded in this session for one work order → AMBIGUOUS', () => {
    const m = makeManager()
    m.create({ id: 'worker-a', ...SHELL })
    m.create({ id: 'worker-new', ...SHELL, customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-a' }, workorder: 'T0537' })
    const t = setup(m, ENTRIES)
    expect(t.scheduler.request({ towerId: 'tower-a', workorder: 'T0537' })).toEqual({ ok: false, code: 'AMBIGUOUS', terminalIds: ['worker-new', 'worker-a'] })
  })

  it('a Worker closed by ✕ (tab no longer saved, PTY killed) → NOT_FOUND', () => {
    const m = makeManager()
    m.create({ id: 'worker-a', ...SHELL })
    const entries = [{ terminals: [...ENTRIES[0].terminals] }]
    const t = setup(m, entries)
    m.kill('worker-a')
    entries[0].terminals = entries[0].terminals.filter(tab => tab.id !== 'worker-a')
    expect(t.scheduler.request({ towerId: 'tower-a', workorder: 'T0537' })).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('reads the saved tabs once per request', () => {
    const m = makeManager()
    m.create({ id: 'worker-a', ...SHELL })
    const t = setup(m, ENTRIES)
    t.scheduler.request({ towerId: 'tower-a', workorder: 'T0537' })
    expect(t.getSaved).toHaveBeenCalledTimes(1)
  })
})
