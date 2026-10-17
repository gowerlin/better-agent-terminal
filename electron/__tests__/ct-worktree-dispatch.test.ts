// @vitest-environment node
/**
 * PLAN-047 W1 / T0583: worktree-isolated dispatch and `--close-worker --worktree`.
 *
 * - `terminal:create-agent-command` with `isolation: 'worktree'`: the worktree is prepared after
 *   the Recovery hold and before the PTY; the PTY gets the worktree cwd, `CT_HOME` / `CT_WORKTREE*`
 *   (a caller's own values dropped) and the record; the report and `terminal:created-externally`
 *   carry it; a failure is `{ ok: false, code: 'WORKTREE_FAILED' }` with nothing created; invalid
 *   isolation / prompt mode / the create-with-command channel are refused; without isolation
 *   nothing changes (create-with-command still goes through `invokeHandler`)
 * - WorkerCloseScheduler: `worktree` keep / remove / archive / invalid; the answer says whether the
 *   Worker is isolated; cleanup only after the tab is gone (two checks), kept when the tab stays
 *   60 s, none when the close is cancelled; the saved tab's record after BAT reopens (T0537 path)
 * - PtyManager keeps the record across restart and the idempotent re-create
 * - helper capability: `isolation` only on create-agent-command, only `worktree`
 * - end to end with real git in a temp repo: dispatch → env / cwd → close → worktree gone, branch kept
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('ct-worktree / close-worker / pty-manager must not import electron')
})

import { logger } from '../logger'
import { WorkerCloseScheduler, CLOSE_WORKER_TAB_CLOSE_POLL_MS, CLOSE_WORKER_TAB_CLOSE_WAIT_MS, normalizeWorkorderId, type CloseWorkerPtyManager } from '../close-worker'
import { CtWorktreeService, type CtWorktreePrepareResult, type CtWorktreeRecord } from '../ct-worktree'
import { registerTerminalCommandHandlers, type TerminalCommandHandlerDeps } from '../terminal-command-handlers'
import { savedWorkerOwnership, withSavedWorkerOwnership } from '../worker-ownership'
import { authorizeHelperInvoke, type HelperCapability } from '../remote/helper-capability'
import type { PtyManager as PtyManagerType } from '../pty-manager'

const repoRoot = path.resolve(__dirname, '..', '..')

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const RECORD: CtWorktreeRecord = {
  path: path.resolve('/w/.bat-worktrees/repo/T0583'),
  branch: 'ct/T0583',
  base: 'b'.repeat(40),
  mainCheckout: path.resolve('/w/repo'),
  workorder: 'T0583',
}

// ── handlers ──

interface CreateCall { id: string; cwd: string; customEnv?: Record<string, string>; workorder?: string; worktree?: CtWorktreeRecord }

function setupHandlers(opts: {
  prepare?: (o: { cwd: string; workorder: unknown }) => Promise<CtWorktreePrepareResult>
  invokeHandler?: TerminalCommandHandlerDeps['invokeHandler']
  held?: { released: Promise<boolean> }
} = {}) {
  const handlers = new Map<string, (ctx: unknown, ...args: unknown[]) => unknown>()
  const creates: CreateCall[] = []
  const emitted: Array<{ channel: string; payload: Record<string, unknown> }> = []
  const events: Array<{ event: string; payload: Record<string, unknown> }> = []
  const order: string[] = []
  const prepare = vi.fn(async (o: { cwd: string; workorder: unknown }) => {
    order.push('prepare')
    return opts.prepare ? opts.prepare(o) : { ok: true as const, record: RECORD, reused: false, createdBranch: true, cwd: path.join(RECORD.path, 'sub') }
  })
  let held = !!opts.held
  const ptyManager = {
    isAlive: () => false,
    create: vi.fn((o: CreateCall) => { order.push('create'); creates.push(o); return true }),
    write: vi.fn(),
    isCreateHeld: () => held,
    whenCreatesReleased: async () => {
      order.push('hold')
      const released = await opts.held!.released
      held = false
      return released
    },
  }
  registerTerminalCommandHandlers({
    registerHandler: (channel, handler) => { handlers.set(channel, handler as (ctx: unknown, ...args: unknown[]) => unknown) },
    ...(opts.invokeHandler ? { invokeHandler: opts.invokeHandler } : {}),
    getPtyManager: () => ptyManager,
    emit: (channel, payload) => { emitted.push({ channel, payload: payload as Record<string, unknown> }) },
    readPersistedSettingsSync: () => null,
    buildAgentPromptCommand: async (o) => ({ command: `agent /${o.skill} ${o.workorder}`, agentId: 'claude-cli', prompt: '', prefixNormalized: false }),
    pickWhitelistedEnv: env => ({ ...(env ?? {}) }),
    mirrorToBatScripts: (event, payload) => { events.push({ event, payload }) },
    logger: { log: () => {}, warn: () => {} },
    setTimeout: () => 0,
    ctWorktree: { prepare } as unknown as CtWorktreeService,
  })
  const invoke = (channel: string, ...args: unknown[]) => Promise.resolve(handlers.get(channel)!({ windowId: null, connectionId: 'helper' }, ...args))
  return { invoke, creates, emitted, events, prepare, ptyManager, order }
}

const DISPATCH = {
  id: 'worker-1',
  cwd: path.resolve('/w/repo/sub'),
  shell: '/bin/sh',
  skill: 'ct-exec',
  workorder: 't0583',
  reportLanding: true,
  customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-1', CT_MODE: 'yolo', CT_HOME: '/evil', CT_WORKTREE: '/evil' },
}

describe('terminal:create-agent-command --isolation worktree (T0583)', () => {
  it('prepares the worktree, then creates the PTY in it with CT_HOME / CT_WORKTREE* from BAT', async () => {
    const h = setupHandlers()
    const result = await h.invoke('terminal:create-agent-command', { ...DISPATCH, isolation: ' Worktree ' }) as Record<string, unknown>
    expect(h.prepare).toHaveBeenCalledWith({ cwd: DISPATCH.cwd, workorder: 'T0583' })
    expect(h.creates).toHaveLength(1)
    expect(h.creates[0]).toMatchObject({ id: 'worker-1', cwd: path.join(RECORD.path, 'sub'), workorder: 't0583', worktree: RECORD })
    expect(h.creates[0].customEnv).toEqual({
      BAT_TOWER_TERMINAL_ID: 'tower-1',
      CT_MODE: 'yolo',
      CT_HOME: RECORD.mainCheckout,
      CT_WORKTREE: RECORD.path,
      CT_WORKTREE_BRANCH: 'ct/T0583',
      CT_WORKTREE_BASE: RECORD.base,
    })
    expect(result).toMatchObject({
      ok: true,
      terminalId: 'worker-1',
      worktree: { path: RECORD.path, branch: 'ct/T0583', base: RECORD.base, mainCheckout: RECORD.mainCheckout, reused: false },
    })
    const created = h.emitted.find(e => e.channel === 'terminal:created-externally')!.payload
    expect(created).toMatchObject({ id: 'worker-1', cwd: path.join(RECORD.path, 'sub'), workorder: 'T0583', ctWorktree: RECORD })
    expect(h.events.find(e => e.event === 'ct-worktree')?.payload).toMatchObject({ isolation: 'worktree', worktree: RECORD.path, branch: 'ct/T0583', base: RECORD.base, reused: false })
  })

  it('isolated dispatch does not go through invokeHandler (its payload cannot carry the worktree)', async () => {
    const invokeHandler = vi.fn(async () => true)
    const h = setupHandlers({ invokeHandler })
    await h.invoke('terminal:create-agent-command', { ...DISPATCH, isolation: 'worktree' })
    expect(invokeHandler).not.toHaveBeenCalled()
    expect(h.creates[0].worktree).toEqual(RECORD)
  })

  it('reused worktree → report says reused', async () => {
    const h = setupHandlers({ prepare: async () => ({ ok: true, record: RECORD, reused: true, createdBranch: false, cwd: RECORD.path }) })
    const result = await h.invoke('terminal:create-agent-command', { ...DISPATCH, isolation: 'worktree' }) as { worktree: { reused: boolean } }
    expect(result.worktree.reused).toBe(true)
  })

  it('worktree failure → WORKTREE_FAILED, nothing created, logged', async () => {
    const h = setupHandlers({ prepare: async () => ({ ok: false, error: 'cwd /x is not a git repository (fatal: not a git repository)' }) })
    const result = await h.invoke('terminal:create-agent-command', { ...DISPATCH, isolation: 'worktree' })
    expect(result).toEqual({ ok: false, code: 'WORKTREE_FAILED', error: 'cwd /x is not a git repository (fatal: not a git repository)' })
    expect(h.creates).toHaveLength(0)
    expect(h.emitted).toHaveLength(0)
    expect(h.events.find(e => e.event === 'ipc-result')?.payload).toMatchObject({ reason: 'WORKTREE_FAILED', isolation: 'worktree' })
  })

  it('invalid isolation / prompt mode → WORKTREE_FAILED without preparing', async () => {
    const h = setupHandlers()
    expect(await h.invoke('terminal:create-agent-command', { ...DISPATCH, isolation: 'copy' })).toMatchObject({ ok: false, code: 'WORKTREE_FAILED' })
    const { skill: _s, workorder: _w, ...promptMode } = DISPATCH
    expect(await h.invoke('terminal:create-agent-command', { ...promptMode, prompt: '/ct-exec T0583', isolation: 'worktree' })).toMatchObject({ ok: false, code: 'WORKTREE_FAILED' })
    expect(h.prepare).not.toHaveBeenCalled()
    expect(h.creates).toHaveLength(0)
  })

  it('create-with-command with isolation → refused (raw command mode is not isolated)', async () => {
    const h = setupHandlers()
    const result = await h.invoke('terminal:create-with-command', { id: 'raw', cwd: DISPATCH.cwd, command: 'echo hi', isolation: 'worktree', worktree: RECORD })
    expect(result).toMatchObject({ ok: false, code: 'WORKTREE_FAILED' })
    expect(h.creates).toHaveLength(0)
  })

  it('without isolation nothing changes: original cwd / env, no worktree, invokeHandler used', async () => {
    const invokeHandler = vi.fn(async () => true)
    const h = setupHandlers({ invokeHandler })
    await h.invoke('terminal:create-agent-command', DISPATCH)
    expect(invokeHandler).toHaveBeenCalledTimes(1)
    const h2 = setupHandlers()
    const result = await h2.invoke('terminal:create-agent-command', DISPATCH) as Record<string, unknown>
    expect(h2.prepare).not.toHaveBeenCalled()
    expect(h2.creates[0].cwd).toBe(DISPATCH.cwd)
    expect(h2.creates[0].customEnv).toEqual(DISPATCH.customEnv)
    expect(h2.creates[0]).not.toHaveProperty('worktree')
    expect(result).not.toHaveProperty('worktree')
    expect(h2.emitted[0].payload).not.toHaveProperty('ctWorktree')
  })

  it('Recovery hold first, then the worktree, then the PTY (T0578 / T0580 order)', async () => {
    let release!: (v: boolean) => void
    const h = setupHandlers({ held: { released: new Promise(r => { release = r }) } })
    const pending = h.invoke('terminal:create-agent-command', { ...DISPATCH, isolation: 'worktree' })
    await new Promise(r => setTimeout(r, 10))
    expect(h.prepare).not.toHaveBeenCalled()
    release(true)
    await pending
    expect(h.order).toEqual(['hold', 'prepare', 'create'])
  })

  it('Recovery never answered → RECOVERY_PENDING, no worktree prepared', async () => {
    const h = setupHandlers({ held: { released: Promise.resolve(false) } })
    expect(await h.invoke('terminal:create-agent-command', { ...DISPATCH, isolation: 'worktree' })).toMatchObject({ ok: false, code: 'RECOVERY_PENDING' })
    expect(h.prepare).not.toHaveBeenCalled()
  })
})

// ── scheduler ──

interface FakeWorker { tower: string; workorder: string; worktree?: CtWorktreeRecord; lastInput?: number | null }

function setupScheduler(workers: Record<string, FakeWorker>, cleanup = vi.fn(async () => ({ status: 'removed' as const }))) {
  const ptys: CloseWorkerPtyManager = {
    findWorkerTerminals: (towerId, workorder) => Object.entries(workers)
      .filter(([, w]) => w.workorder === normalizeWorkorderId(workorder) && (towerId === null || w.tower === towerId)).map(([id]) => id),
    getTowerTerminalId: id => workers[id]?.tower,
    getLastOutputAt: () => null,
    getLastUserInputAt: id => workers[id]?.lastInput ?? null,
    isAlive: id => id in workers,
    getWorktree: id => workers[id]?.worktree,
  }
  const logs: string[] = []
  const warns: string[] = []
  const scheduler = new WorkerCloseScheduler({
    getPtyManager: () => ptys,
    emit: () => 1,
    logger: { log: (...a: unknown[]) => { logs.push(a.join(' ')) }, warn: (...a: unknown[]) => { warns.push(a.join(' ')) } },
    cleanupWorktree: cleanup,
  })
  return { scheduler, cleanup, logs, warns, workers }
}

describe('WorkerCloseScheduler --worktree (T0583)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })

  it('INVALID_ARGS for an unknown mode; absent / keep → no worktree answer or cleanup', () => {
    const { scheduler, cleanup } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0583', worktree: RECORD } })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: 'nuke' })).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: 3 })).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0583' })).not.toHaveProperty('worktree')
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: 'keep' })).toMatchObject({ worktree: { mode: 'keep', isolated: true } })
    expect(scheduler.closingWorktreeIds()).toEqual([])
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('remove: cleans after the tab is gone on two checks', async () => {
    const { scheduler, cleanup, workers, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0583', worktree: RECORD } })
    const r = scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: ' Remove ' })
    expect(r).toMatchObject({ ok: true, terminalId: 'w1', worktree: { mode: 'remove', isolated: true, path: RECORD.path, branch: 'ct/T0583' } })
    expect(scheduler.closingWorktreeIds()).toEqual(['w1'])
    await vi.advanceTimersByTimeAsync(CLOSE_WORKER_TAB_CLOSE_POLL_MS * 3)
    expect(cleanup).not.toHaveBeenCalled() // the tab is still open
    delete workers.w1 // the window closed it
    await vi.advanceTimersByTimeAsync(CLOSE_WORKER_TAB_CLOSE_POLL_MS)
    expect(cleanup).not.toHaveBeenCalled() // gone once
    await vi.advanceTimersByTimeAsync(CLOSE_WORKER_TAB_CLOSE_POLL_MS)
    expect(cleanup).toHaveBeenCalledWith(RECORD, 'remove')
    expect(logs.some(l => l.includes('[ct-worktree]') && l.includes('removed'))).toBe(true)
    expect(scheduler.closingWorktreeIds()).toEqual([])
  })

  it('archive: the archived branch is logged', async () => {
    const cleanup = vi.fn(async () => ({ status: 'archived' as const, archivedBranch: 'ct-archive/T0583' }))
    const { scheduler, workers, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0583', worktree: RECORD } }, cleanup as never)
    scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: 'archive' })
    delete workers.w1
    await vi.advanceTimersByTimeAsync(CLOSE_WORKER_TAB_CLOSE_POLL_MS * 2)
    expect(cleanup).toHaveBeenCalledWith(RECORD, 'archive')
    expect(logs.some(l => l.includes('ct-archive/T0583'))).toBe(true)
  })

  it('kept-dirty is a warning', async () => {
    const cleanup = vi.fn(async () => ({ status: 'kept-dirty' as const, detail: 'uncommitted changes' }))
    const { scheduler, workers, warns } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0583', worktree: RECORD } }, cleanup as never)
    scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: 'remove' })
    delete workers.w1
    await vi.advanceTimersByTimeAsync(CLOSE_WORKER_TAB_CLOSE_POLL_MS * 2)
    expect(warns.some(w => w.includes('kept (uncommitted changes)'))).toBe(true)
  })

  it('a Worker that is not isolated ignores --worktree (closed anyway)', () => {
    const { scheduler, cleanup, logs } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0583' } })
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: 'remove' })).toMatchObject({ ok: true, worktree: { mode: 'remove', isolated: false } })
    expect(logs.some(l => l.includes('not an isolated Worker: ignored'))).toBe(true)
    expect(logs.some(l => l.includes('close requested'))).toBe(true)
    expect(scheduler.closingWorktreeIds()).toEqual([])
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('the tab still open 60 s after the request (or restarted) → kept', async () => {
    const { scheduler, cleanup, warns } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0583', worktree: RECORD } })
    scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: 'remove' })
    await vi.advanceTimersByTimeAsync(CLOSE_WORKER_TAB_CLOSE_WAIT_MS + CLOSE_WORKER_TAB_CLOSE_POLL_MS)
    expect(cleanup).not.toHaveBeenCalled()
    expect(warns.some(w => w.includes('kept (the tab was still open'))).toBe(true)
    expect(scheduler.closingWorktreeIds()).toEqual([])
  })

  it('gone once, then back (restart) → not cleaned', async () => {
    const { scheduler, cleanup, workers } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0583', worktree: RECORD } })
    scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: 'remove' })
    const w1 = workers.w1
    delete workers.w1
    await vi.advanceTimersByTimeAsync(CLOSE_WORKER_TAB_CLOSE_POLL_MS)
    workers.w1 = w1
    await vi.advanceTimersByTimeAsync(CLOSE_WORKER_TAB_CLOSE_POLL_MS * 3)
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('a close cancelled by user input cleans nothing', async () => {
    const { scheduler, cleanup, workers } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0583', worktree: RECORD } })
    scheduler.request({ towerId: 'tw', workorder: 'T0583', delayMs: 5000, worktree: 'remove' })
    workers.w1.lastInput = Date.now() + 10
    await vi.advanceTimersByTimeAsync(6000)
    delete workers.w1
    await vi.advanceTimersByTimeAsync(CLOSE_WORKER_TAB_CLOSE_POLL_MS * 5)
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('dispose clears the watch', () => {
    const { scheduler } = setupScheduler({ w1: { tower: 'tw', workorder: 'T0583', worktree: RECORD } })
    scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: 'remove' })
    scheduler.dispose()
    expect(scheduler.closingWorktreeIds()).toEqual([])
  })
})

describe('saved tab worktree after BAT reopens (T0537 path)', () => {
  const platform = process.platform
  const saved = (ctWorktree: unknown) => [{ terminals: [{ id: 'w1', towerTerminalId: 'tw', workorder: 'T0583', ctWorktree }] }]

  it('savedWorkerOwnership keeps a record that follows the rules and matches the work order', () => {
    expect(savedWorkerOwnership(saved(RECORD), platform).get('w1')?.worktree).toEqual(RECORD)
    expect(savedWorkerOwnership(saved({ ...RECORD, path: path.resolve('/elsewhere') }), platform).get('w1')?.worktree).toBeUndefined()
    expect(savedWorkerOwnership(saved({ ...RECORD, workorder: 'T0001', branch: 'ct/T0001', path: path.resolve('/w/.bat-worktrees/repo/T0001') }), platform).get('w1')?.worktree).toBeUndefined()
    expect(savedWorkerOwnership(saved(undefined), platform).get('w1')).toEqual({ towerTerminalId: 'tw', workorder: 'T0583' })
  })

  it('withSavedWorkerOwnership: the PTY record wins, else the saved one (running PTY with no work order)', () => {
    const base = {
      findWorkerTerminals: () => [],
      getTowerTerminalId: () => undefined,
      getLastOutputAt: () => null,
      getLastUserInputAt: () => null,
      isAlive: (id: string) => id === 'w1',
      getWorkorder: () => undefined,
      getWorktree: () => undefined as CtWorktreeRecord | undefined,
    }
    const view = withSavedWorkerOwnership(base, () => savedWorkerOwnership(saved(RECORD), platform))
    expect(view.getWorktree?.('w1')).toEqual(RECORD)
    expect(view.getWorktree?.('gone')).toBeUndefined()
    const own = { ...RECORD, base: 'c'.repeat(40) }
    const view2 = withSavedWorkerOwnership({ ...base, getWorkorder: () => 'T0583', getWorktree: () => own }, () => savedWorkerOwnership(saved(RECORD), platform))
    expect(view2.getWorktree?.('w1')).toEqual(own)
  })
})

describe('helper capability: isolation (T0583)', () => {
  const tower: HelperCapability = { terminalId: 'tower-1', role: 'tower' }
  const ctx = { isTerminalAlive: () => false, isKnownAgent: () => true }
  const create = { id: 'new-1', cwd: '/r', skill: 'ct-exec', workorder: 'T1', customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-1' } }

  it('create-agent-command allows isolation worktree only', () => {
    expect(authorizeHelperInvoke(tower, 'terminal:create-agent-command', [{ ...create, isolation: 'worktree' }], ctx)).toEqual({ ok: true })
    expect(authorizeHelperInvoke(tower, 'terminal:create-agent-command', [{ ...create, isolation: ' WorkTree ' }], ctx)).toEqual({ ok: true })
    expect(authorizeHelperInvoke(tower, 'terminal:create-agent-command', [{ ...create, isolation: 'copy' }], ctx)).toEqual({ ok: false, reason: 'invalid-isolation' })
    expect(authorizeHelperInvoke(tower, 'terminal:create-agent-command', [{ ...create, isolation: ['worktree'] }], ctx)).toEqual({ ok: false, reason: 'invalid-isolation' })
    expect(authorizeHelperInvoke(tower, 'terminal:create-with-command', [{ id: 'new-2', cwd: '/r', command: 'x', isolation: 'worktree' }], ctx)).toEqual({ ok: false, reason: 'isolation-not-allowed' })
  })

  it('CT_HOME / CT_WORKTREE* stay outside the customEnv whitelist', () => {
    expect(authorizeHelperInvoke(tower, 'terminal:create-agent-command', [{ ...create, isolation: 'worktree', customEnv: { CT_HOME: '/evil' } }], ctx)).toEqual({ ok: false, reason: 'custom-env-not-allowed' })
  })
})

// ── PtyManager keeps the record ──

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
}

describe('PtyManager worktree record (T0583)', () => {
  let PtyManager: typeof PtyManagerType
  const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: { cwd: string; env: Record<string, string> }) => new FakePty())
  const managers: PtyManagerType[] = []
  const dataDir = mkdtempSync(path.join(tmpdir(), 'bat-t0583-pty-'))

  beforeAll(async () => {
    const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
    const resolved = req.resolve('@lydell/node-pty')
    req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
    ;({ PtyManager } = await import('../pty-manager'))
  })

  afterAll(() => {
    for (const m of managers) m.dispose()
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('records it, keeps it across restart, drops it with the PTY; CT_* reach the env', () => {
    const m = new PtyManager({ emit: vi.fn(), dataDir })
    managers.push(m)
    const env = { BAT_TOWER_TERMINAL_ID: 'tw', CT_HOME: RECORD.mainCheckout, CT_WORKTREE: RECORD.path }
    m.create({ id: 'w1', cwd: tmpdir(), type: 'terminal', shell: '/bin/sh', customEnv: env, workorder: 'T0583', worktree: RECORD })
    m.create({ id: 'plain', cwd: tmpdir(), type: 'terminal', shell: '/bin/sh' })
    expect(m.getWorktree('w1')).toEqual(RECORD)
    expect(m.getWorktree('plain')).toBeUndefined()
    expect(ptySpawn.mock.calls[0][2].env).toMatchObject({ CT_HOME: RECORD.mainCheckout, CT_WORKTREE: RECORD.path })
    expect(m.restart('w1', tmpdir(), '/bin/sh')).toBe(true)
    expect(m.getWorktree('w1')).toEqual(RECORD)
    expect(ptySpawn.mock.calls.at(-1)?.[2].env).toMatchObject({ CT_HOME: RECORD.mainCheckout })
    m.kill('w1')
    expect(m.getWorktree('w1')).toBeUndefined()
  })
})

// ── end to end with real git ──

describe('real git: dispatch → close --worktree remove (T0583)', () => {
  const roots: string[] = []
  afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }) })

  function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', ['-c', 'core.longpaths=true', '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  }

  it('the PTY starts in the worktree with CT_* and the worktree is removed after the tab closes', async () => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'bat-t0583-e2e-')))
    roots.push(root)
    const repo = path.join(root, 'repo')
    mkdirSync(path.join(repo, 'pkg'), { recursive: true })
    git(repo, 'init', '-q', '-b', 'main')
    const top = path.resolve(git(repo, 'rev-parse', '--show-toplevel'))
    if (top.toLowerCase() !== path.resolve(repo).toLowerCase() || top.toLowerCase() === repoRoot.toLowerCase()) throw new Error(`fixture not isolated: ${top}`)
    writeFileSync(path.join(repo, 'pkg', 'x.txt'), 'x\n')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'init')
    const head = git(repo, 'rev-parse', 'HEAD')

    const service = new CtWorktreeService()
    const h = setupHandlers({ prepare: o => service.prepare(o) })
    const result = await h.invoke('terminal:create-agent-command', { ...DISPATCH, cwd: path.join(repo, 'pkg'), customEnv: { BAT_TOWER_TERMINAL_ID: 'tw' }, isolation: 'worktree', workorder: 'T0583' }) as { worktree: { path: string; base: string } }
    const wt = path.join(root, '.bat-worktrees', 'repo', 'T0583')
    expect(result.worktree.path.toLowerCase()).toBe(wt.toLowerCase())
    expect(result.worktree.base).toBe(head)
    expect(h.creates[0].cwd.toLowerCase()).toBe(path.join(wt, 'pkg').toLowerCase())
    expect(h.creates[0].customEnv).toMatchObject({ CT_WORKTREE_BRANCH: 'ct/T0583', CT_WORKTREE_BASE: head })
    expect(h.creates[0].customEnv!.CT_HOME.toLowerCase()).toBe(path.resolve(repo).toLowerCase())

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const workers: Record<string, FakeWorker> = { [DISPATCH.id]: { tower: 'tw', workorder: 'T0583', worktree: h.creates[0].worktree } }
    const { scheduler } = setupScheduler(workers, vi.fn((record: CtWorktreeRecord, mode: 'remove' | 'archive') => service.cleanup(record, mode)) as never)
    expect(scheduler.request({ towerId: 'tw', workorder: 'T0583', worktree: 'remove' })).toMatchObject({ ok: true, worktree: { isolated: true } })
    delete workers[DISPATCH.id]
    await vi.advanceTimersByTimeAsync(CLOSE_WORKER_TAB_CLOSE_POLL_MS * 2)
    vi.useRealTimers()
    await vi.waitFor(() => expect(existsSync(wt)).toBe(false), { timeout: 10_000 })
    expect(git(repo, 'branch', '--list', 'ct/T0583')).toContain('ct/T0583')
    expect(git(repo, 'status', '--porcelain')).toBe('')
  }, 30_000)
})
