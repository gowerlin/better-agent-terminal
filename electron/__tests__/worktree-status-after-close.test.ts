// @vitest-environment node
/**
 * PLAN-047 Q3 / T0589: `worktree:terminal-status` after the Worker tab closed.
 *
 *   - PtyManager's exited record keeps the worktree (kill / exit; a restart or re-create runs again
 *     and hides it; gone after the TTL)
 *   - the handler on a real PtyManager (fake node-pty) + a real capability registry + real git in a
 *     temp repo (never this repo, L155): live → exited (by work order and by id) → after the TTL
 *     git (worktree registered) → `git worktree remove` (branch only, `worktreeMissing`) → branch
 *     deleted → NOT_FOUND; another tower's exited Worker → NOT_OWNER; a server-token client and a
 *     worker capability never reach git; neither checkout changes
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('worktree-status-handlers / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import { CtWorktreeService, type CtWorktreeRecord } from '../ct-worktree'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'
import { HelperCapabilityRegistry } from '../remote/helper-capability'
import { WORKTREE_STATUS_CHANNEL, registerWorktreeStatusHandler } from '../worktree-status-handlers'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: { env: Record<string, string> }) => new FakePty())
let PtyManager: typeof PtyManagerType
let EXITED_PTY_RECORD_TTL_MS = 0

beforeAll(async () => {
  const req = createRequire(resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager, EXITED_PTY_RECORD_TTL_MS } = await import('../pty-manager'))
})

const repoRoot = resolve(__dirname, '..', '..')
const roots: string[] = []
const managers: PtyManagerType[] = []
let dataDir: string

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
  dataDir = mkdtempSync(join(tmpdir(), 't0589-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  rmSync(dataDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
})

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'core.longpaths=true', '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', ...args], {
    cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function same(a: string, b: string): boolean {
  const n = (p: string) => resolve(p).toLowerCase()
  return process.platform === 'win32' || process.platform === 'darwin' ? n(a) === n(b) : resolve(a) === resolve(b)
}

/** A temp `<root>/repo` with one commit and a work order T0589; asserts git sees exactly that directory. */
function makeRepo(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bat-t0589-')))
  roots.push(root)
  const repo = join(root, 'repo')
  mkdirSync(join(repo, '_ct-workorders'), { recursive: true })
  git(repo, 'init', '-q', '-b', 'main')
  const top = git(repo, 'rev-parse', '--show-toplevel')
  if (!same(top, repo) || same(top, repoRoot)) throw new Error(`fixture repo is not isolated: ${top}`)
  writeFileSync(join(repo, 'a.txt'), 'a\n')
  writeFileSync(join(repo, '_ct-workorders', 'T0589-x.md'), '---\nid: T0589\naffects_files:\n  - src/**\n---\n')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'init')
  return repo
}

function snapshot(dir: string) {
  return {
    status: git(dir, 'status', '--porcelain=v1', '--untracked-files=all'),
    head: git(dir, 'rev-parse', 'HEAD'),
    branch: git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'),
    branches: git(dir, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
  }
}

/** A PtyManager against the fake node-pty; capabilities issued / revoked like main.ts. */
function makeManager(registry = new HelperCapabilityRegistry()) {
  const fakes = new Map<string, FakePty>()
  const manager = new PtyManager({
    emit: vi.fn(),
    dataDir,
    helperEnv: (id, customEnv) => {
      registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined })
      return {}
    },
    onPtyExit: id => { registry.revokeTerminal(id) },
  })
  managers.push(manager)
  const create = (id: string, cwd: string, opts: { towerId?: string; workorder?: string; worktree?: CtWorktreeRecord } = {}) => {
    const before = ptySpawn.mock.results.length
    expect(manager.create({
      id,
      cwd,
      type: 'terminal',
      shell: '/bin/sh',
      ...(opts.towerId ? { customEnv: { BAT_TOWER_TERMINAL_ID: opts.towerId } } : {}),
      ...(opts.workorder ? { workorder: opts.workorder } : {}),
      ...(opts.worktree ? { worktree: opts.worktree } : {}),
    })).toBe(true)
    fakes.set(id, ptySpawn.mock.results[before].value as FakePty)
  }
  const exit = (id: string, code: number) => {
    const onExit = fakes.get(id)!.onExit.mock.calls[0][0] as (e: { exitCode: number }) => void
    onExit({ exitCode: code })
  }
  return { manager, registry, create, exit }
}

const RECORD: CtWorktreeRecord = { path: '/w/.bat-worktrees/r/T0589', branch: 'ct/T0589', base: 'a'.repeat(40), mainCheckout: '/w/r', workorder: 'T0589' }

describe('PtyManager exited record keeps the worktree (T0589)', () => {
  it('kill and exit: the record carries a copy of the worktree; a re-create / restart hides it; the TTL drops it', () => {
    const { manager, create, exit } = makeManager()
    create('w1', tmpdir(), { towerId: 'tw', workorder: 'T0589', worktree: RECORD })
    expect(manager.getExitedPty('w1')).toBeNull()
    manager.kill('w1')
    const record = manager.getExitedPty('w1')!
    expect(record).toMatchObject({ towerTerminalId: 'tw', workorder: 'T0589', worktree: RECORD })
    record.worktree!.path = 'changed'
    expect(manager.getExitedPty('w1')!.worktree).toEqual(RECORD)

    create('w2', tmpdir(), { towerId: 'tw', workorder: 'T0590', worktree: { ...RECORD, workorder: 'T0590' } })
    exit('w2', 0)
    expect(manager.getExitedPty('w2')).toMatchObject({ exitCode: 0, worktree: { workorder: 'T0590' } })
    create('w2', tmpdir(), { towerId: 'tw', workorder: 'T0590' })
    expect(manager.getExitedPty('w2')).toBeNull()
    expect(manager.restart('w2', tmpdir(), '/bin/sh')).toBe(true)
    expect(manager.getExitedPty('w2')).toBeNull()

    create('plain', tmpdir())
    manager.kill('plain')
    expect(manager.getExitedPty('plain')).not.toHaveProperty('worktree')

    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + EXITED_PTY_RECORD_TTL_MS + 1)
    expect(manager.getExitedPty('w1')).toBeNull()
  })
})

describe('worktree:terminal-status after the tab closed — real PtyManager + git (T0589)', () => {
  function wire() {
    const { manager, registry, create, exit } = makeManager()
    const service = new CtWorktreeService()
    const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
    registerWorktreeStatusHandler({
      registerHandler: (channel, handler) => { handlers.set(channel, handler) },
      getWorkerView: () => manager,
      isWorkerOf: (child, tower) => registry.isWorkerOf(child, tower),
      status: record => service.status(record),
      getExitedView: () => manager,
      getTerminalCwd: id => manager.getTerminalInfo(id)?.cwd,
      statusFromGit: q => service.statusFromGit(q),
      logger: { log: () => {} },
    })
    const call = (ctx: HandlerContext, ...args: unknown[]) =>
      Promise.resolve(handlers.get(WORKTREE_STATUS_CHANNEL)!(ctx, ...args)) as Promise<Record<string, unknown>>
    const tower = (id: string): HandlerContext => ({ windowId: null, connectionId: 'c1', helper: { terminalId: id, role: 'tower' } })
    const worker = (id: string, towerId: string): HandlerContext => ({ windowId: null, connectionId: 'c2', helper: { terminalId: id, role: 'worker', towerId } })
    return { manager, create, exit, service, call, tower, worker, client: { windowId: null, connectionId: 'c9' } as HandlerContext }
  }

  it('live → exited → git (registered) → removed (branch only) → branch gone NOT_FOUND', async () => {
    const repo = makeRepo()
    const w = wire()
    const prepared = await w.service.prepare({ cwd: repo, workorder: 'T0589' })
    if (!prepared.ok) throw new Error(prepared.error)
    const wt = prepared.record
    mkdirSync(join(wt.path, 'src'))
    writeFileSync(join(wt.path, 'src', 'x.ts'), 'x\n')
    git(wt.path, 'add', '-A')
    git(wt.path, 'commit', '-q', '-m', 'w')

    w.create('tw', repo)
    w.create('wk', wt.path, { towerId: 'tw', workorder: 'T0589', worktree: wt })
    w.create('other', repo)
    const before = [snapshot(repo), snapshot(wt.path)]

    expect(await w.call(w.tower('tw'), { workorder: 'T0589' })).toMatchObject({ ok: true, terminalId: 'wk', source: 'live', ahead: 1, changedFiles: ['src/x.ts'] })

    w.manager.kill('wk')
    const exited = await w.call(w.tower('tw'), { workorder: 'T0589' })
    expect(exited).toMatchObject({ ok: true, terminalId: 'wk', source: 'exited', exited: true, isolated: true, ahead: 1, dirty: [], outOfScopeFiles: [] })
    expect(typeof exited.exitedAt).toBe('number')
    expect(await w.call(w.tower('tw'), { terminalId: 'wk' })).toMatchObject({ ok: true, source: 'exited' })
    // another tower: the exited record is in the way → NOT_OWNER (not git)
    expect(await w.call(w.tower('other'), { workorder: 'T0589' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await w.call(w.tower('other'), { terminalId: 'wk' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    // a server-token client reads the exited record
    expect(await w.call(w.client, { workorder: 'T0589' })).toMatchObject({ ok: true, source: 'exited' })

    // after the TTL: no record — git from the asking tower's own checkout
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + EXITED_PTY_RECORD_TTL_MS + 1)
    const fromGit = await w.call(w.tower('tw'), { workorder: 'T0589' })
    expect(fromGit).toMatchObject({ ok: true, terminalId: null, source: 'git', isolated: true, branch: 'ct/T0589', ahead: 1, dirty: [], changedFiles: ['src/x.ts'] })
    expect(same(fromGit.path as string, wt.path)).toBe(true)
    // the server token and a terminalId never reach git
    expect(await w.call(w.client, { workorder: 'T0589' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(await w.call(w.tower('tw'), { terminalId: 'wk' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect([snapshot(repo), snapshot(wt.path)]).toEqual(before)

    // `--worktree remove`: the branch is left
    git(repo, 'worktree', 'remove', wt.path)
    expect(await w.call(w.tower('tw'), { workorder: 'T0589' })).toMatchObject({ ok: true, source: 'git', dirty: null, dirtyCount: null, worktreeMissing: true, ahead: 1 })
    git(repo, 'branch', '-D', 'ct/T0589')
    expect(await w.call(w.tower('tw'), { workorder: 'T0589' })).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('a worker capability never reaches git; the exited record answers `--worktree remove` with worktreeMissing', async () => {
    const repo = makeRepo()
    const w = wire()
    const prepared = await w.service.prepare({ cwd: repo, workorder: 'T0589' })
    if (!prepared.ok) throw new Error(prepared.error)
    w.create('tw', repo)
    w.create('wk', prepared.record.path, { towerId: 'tw', workorder: 'T0589', worktree: prepared.record })
    w.create('wk2', repo, { towerId: 'tw', workorder: 'T0601' })
    expect(await w.call(w.worker('wk2', 'tw'), { workorder: 'T0589' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    w.exit('wk', 0)
    expect(await w.call(w.worker('wk2', 'tw'), { workorder: 'T0589' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await w.call(w.worker('wk2', 'tw'), { workorder: 'T0777' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    git(repo, 'worktree', 'remove', prepared.record.path)
    expect(await w.call(w.tower('tw'), { workorder: 'T0589' })).toMatchObject({ ok: true, source: 'exited', exited: true, dirty: null, worktreeMissing: true })
  })
})
