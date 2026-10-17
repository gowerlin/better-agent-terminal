// @vitest-environment node
/**
 * PLAN-047 W1-2 / T0585: `worktree:terminal-status` handler — the caller is its capability, the
 * scope is `authorizeHelperQueryTarget` (output): a tower → itself + its Workers, a worker →
 * itself; `workorder` finds the Worker as `--close-worker` does (NOT_FOUND / NOT_OWNER /
 * AMBIGUOUS); a tab that is not isolated → `isolated: false`; TIMEOUT / GIT_FAILED from the
 * service; the `[helper-query]` audit line. Plus the role table and the wiring in main / headless.
 * T0589: `source` live / exited / git — the exited records (by id, by work order: latest, other
 * towers, AMBIGUOUS), git only for a tower capability whose PTY runs, NOT_OWNER never falls to git.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CloseWorkerPtyManager } from '../close-worker'
import type { CtWorktreeGitStatusResult, CtWorktreeRecord, CtWorktreeStatusResult } from '../ct-worktree'
import type { HandlerContext } from '../remote/handler-registry'
import { HELPER_CHANNEL_ROLES, authorizeHelperInvoke } from '../remote/helper-capability'
import { WORKTREE_STATUS_CHANNEL, registerWorktreeStatusHandler, type ExitedWorkerRecord } from '../worktree-status-handlers'

const RECORD: CtWorktreeRecord = { path: '/w/.bat-worktrees/r/T0001', branch: 'ct/T0001', base: 'a'.repeat(40), mainCheckout: '/w/r', workorder: 'T0001' }

const STATUS: CtWorktreeStatusResult = {
  ok: true,
  isolated: true,
  workorder: 'T0001',
  path: RECORD.path,
  branch: RECORD.branch,
  base: RECORD.base,
  mainCheckout: RECORD.mainCheckout,
  head: 'b'.repeat(40),
  mainHead: 'c'.repeat(40),
  ahead: 1,
  behind: 2,
  dirty: [],
  dirtyCount: 0,
  changedFiles: ['src/a.ts', 'out.ts'],
  changedCount: 2,
  outOfScopeFiles: ['out.ts'],
  outOfScopeCount: 1,
  touchesCtWorkorders: false,
  conflicts: ['src/a.ts'],
  computedAt: 1,
  cached: false,
}

interface Pty { tower?: string; workorder?: string; worktree?: CtWorktreeRecord }

/**
 * PTYs: tw (tower), wk (tw's isolated Worker of T0001), wk2 (tw's plain Worker of T0002),
 * other-tw, other-wk (other-tw's Worker of T0003), sh (a shell).
 */
function harness(opts: {
  ptys?: Record<string, Pty>
  /** The capability registry's isWorkerOf. */
  workers?: Record<string, string>
  isOwnedBy?: (child: string, tower: string) => boolean
  status?: (record: CtWorktreeRecord) => Promise<CtWorktreeStatusResult>
  /** T0589: exited PTYs (oldest first) — enables the exited source. */
  exited?: Record<string, ExitedWorkerRecord>
  /** T0589: cwd of running PTYs + statusFromGit — enables the git source. */
  cwd?: Record<string, string>
  statusFromGit?: (opts: { cwd: string; workorder: string }) => Promise<CtWorktreeGitStatusResult>
} = {}) {
  const ptys: Record<string, Pty> = opts.ptys ?? {
    tw: {},
    wk: { tower: 'tw', workorder: 'T0001', worktree: RECORD },
    wk2: { tower: 'tw', workorder: 'T0002' },
    'other-tw': {},
    'other-wk': { tower: 'other-tw', workorder: 'T0003' },
    sh: {},
  }
  const workers = opts.workers ?? { wk: 'tw', wk2: 'tw', 'other-wk': 'other-tw' }
  const view: CloseWorkerPtyManager = {
    findWorkerTerminals: (towerId, workorder) => Object.entries(ptys)
      .filter(([, p]) => p.workorder === workorder && (towerId === null || p.tower === towerId)).map(([id]) => id),
    getTowerTerminalId: id => ptys[id]?.tower,
    getLastOutputAt: () => null,
    getLastUserInputAt: () => null,
    isAlive: id => id in ptys,
    getWorktree: id => ptys[id]?.worktree,
  }
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  const logs: string[] = []
  const events: Array<Record<string, unknown>> = []
  const statusCalls: CtWorktreeRecord[] = []
  const gitCalls: Array<{ cwd: string; workorder: string }> = []
  const exited = opts.exited
  registerWorktreeStatusHandler({
    registerHandler: (channel, handler) => { handlers.set(channel, handler) },
    getWorkerView: () => view,
    isWorkerOf: (child, tower) => workers[child] === tower,
    ...(opts.isOwnedBy ? { isOwnedBy: opts.isOwnedBy } : {}),
    status: record => { statusCalls.push(record); return (opts.status ?? (async () => STATUS))(record) },
    ...(exited ? {
      getExitedView: () => ({
        getExitedPty: (id: string) => (id in ptys ? null : exited[id] ?? null),
        listExitedPtyIds: () => Object.keys(exited).filter(id => !(id in ptys)),
      }),
    } : {}),
    ...(opts.statusFromGit ? {
      getTerminalCwd: (id: string) => (id in ptys ? opts.cwd?.[id] : undefined),
      statusFromGit: (q: { cwd: string; workorder: string }) => { gitCalls.push(q); return opts.statusFromGit!(q) },
    } : {}),
    logger: { log: (...args: unknown[]) => logs.push(args.join(' ')) },
    mirrorToBatScripts: (event, payload) => events.push({ event, ...payload }),
  })
  const asHelper = (terminalId: string): HandlerContext => {
    const towerId = workers[terminalId] ?? exited?.[terminalId]?.towerTerminalId
    return { windowId: null, connectionId: 'c1', helper: towerId ? { terminalId, role: 'worker', towerId } : { terminalId, role: 'tower' } }
  }
  const call = (ctx: HandlerContext, ...args: unknown[]) => Promise.resolve(handlers.get(WORKTREE_STATUS_CHANNEL)!(ctx, ...args)) as Promise<Record<string, unknown>>
  return { handlers, logs, events, statusCalls, gitCalls, asHelper, call, client: { windowId: null, connectionId: 'c9' } as HandlerContext }
}

describe('worktree:terminal-status — scope', () => {
  it('registers exactly the one channel', () => {
    expect([...harness().handlers.keys()]).toEqual(['worktree:terminal-status'])
  })

  it('a worker: its own status (no args); its tower or another worker → NOT_OWNER', async () => {
    const h = harness()
    const own = await h.call(h.asHelper('wk'))
    expect(own).toMatchObject({ ok: true, terminalId: 'wk', isolated: true, ahead: 1, behind: 2, conflicts: ['src/a.ts'] })
    expect(own).not.toHaveProperty('code')
    expect(h.statusCalls).toEqual([RECORD])
    expect(await h.call(h.asHelper('wk'), { terminalId: 'tw' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await h.call(h.asHelper('wk'), { terminalId: 'wk2' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await h.call(h.asHelper('wk'), { workorder: 'T0002' })).toEqual({ ok: false, code: 'NOT_OWNER' })
  })

  it('a tower: its Worker by work order or id; another tower\'s Worker → NOT_OWNER', async () => {
    const h = harness()
    expect(await h.call(h.asHelper('tw'), { workorder: ' t0001 ' })).toMatchObject({ ok: true, terminalId: 'wk', isolated: true })
    expect(await h.call(h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ ok: true, terminalId: 'wk' })
    expect(await h.call(h.asHelper('tw'), { workorder: 'T0003' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await h.call(h.asHelper('tw'), { terminalId: 'other-wk' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await h.call(h.asHelper('tw'), { terminalId: 'sh' })).toEqual({ ok: false, code: 'NOT_OWNER' })
  })

  it('not isolated → { isolated: false } (the service is not called)', async () => {
    const h = harness()
    expect(await h.call(h.asHelper('tw'), { workorder: 'T0002' })).toEqual({ ok: true, terminalId: 'wk2', source: 'live', isolated: false })
    expect(await h.call(h.asHelper('tw'))).toEqual({ ok: true, terminalId: 'tw', source: 'live', isolated: false })
    expect(h.statusCalls).toEqual([])
  })

  it('NOT_FOUND / AMBIGUOUS by work order; NOT_FOUND by id', async () => {
    const h = harness({
      ptys: { tw: {}, a: { tower: 'tw', workorder: 'T0001' }, b: { tower: 'tw', workorder: 'T0001' }, c: { tower: 'x', workorder: 'T0001' } },
      workers: { a: 'tw', b: 'tw', c: 'x' },
    })
    expect(await h.call(h.asHelper('tw'), { workorder: 'T0099' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(await h.call(h.asHelper('tw'), { workorder: 'T0001' })).toEqual({ ok: false, code: 'AMBIGUOUS', terminalIds: ['a', 'b'] })
    expect(await h.call(h.asHelper('tw'), { terminalId: 'gone' })).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('INVALID_ARGS: both, a bad id / work order, a non-object; a server-token client must name one', async () => {
    const h = harness()
    expect(await h.call(h.asHelper('tw'), { terminalId: 'wk', workorder: 'T0001' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(await h.call(h.asHelper('tw'), { workorder: 'nope' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(await h.call(h.asHelper('tw'), { terminalId: 'a b' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(await h.call(h.asHelper('tw'), 'wk')).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(await h.call(h.client)).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    // a server-token client is not scoped
    expect(await h.call(h.client, { terminalId: 'wk' })).toMatchObject({ ok: true, terminalId: 'wk', isolated: true })
    expect(await h.call(h.client, { workorder: 'T0003' })).toMatchObject({ ok: true, terminalId: 'other-wk', isolated: false })
  })

  it('Electron: a Worker owned through its saved tab (isOwnedBy) is in scope; without isOwnedBy it is not', async () => {
    const ptys = { tw: {}, wk: { tower: 'tw', workorder: 'T0001', worktree: RECORD } }
    const without = harness({ ptys, workers: {} })
    expect(await without.call(without.asHelper('tw'), { workorder: 'T0001' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    const withSaved = harness({ ptys, workers: {}, isOwnedBy: () => true })
    expect(await withSaved.call(withSaved.asHelper('tw'), { workorder: 'T0001' })).toMatchObject({ ok: true, terminalId: 'wk', isolated: true })
    // the view's tower must still be the caller
    const otherTower = harness({ ptys: { tw: {}, wk: { tower: 'x', workorder: 'T0001', worktree: RECORD } }, workers: {}, isOwnedBy: () => true })
    expect(await otherTower.call(otherTower.asHelper('tw'), { workorder: 'T0001' })).toEqual({ ok: false, code: 'NOT_OWNER' })
  })

  it('TIMEOUT / GIT_FAILED from the service', async () => {
    const t = harness({ status: async () => ({ ok: false, code: 'TIMEOUT', error: 'took longer than 10000 ms' }) })
    expect(await t.call(t.asHelper('wk'))).toMatchObject({ ok: false, code: 'TIMEOUT' })
    const g = harness({ status: async () => ({ ok: false, code: 'GIT_FAILED', error: 'branch ct/T0001 not found' }) })
    expect(await g.call(g.asHelper('wk'))).toMatchObject({ ok: false, code: 'GIT_FAILED', message: 'branch ct/T0001 not found' })
    const thrown = harness({ status: async () => { throw new Error('boom') } })
    expect(await thrown.call(thrown.asHelper('wk'))).toMatchObject({ ok: false, code: 'GIT_FAILED' })
  })

  it('audit: one [helper-query] line + a helper-query event, no file names', async () => {
    const h = harness()
    await h.call(h.asHelper('tw'), { workorder: 'T0001' })
    await h.call(h.asHelper('tw'), { workorder: 'T0003' })
    expect(h.logs[0]).toMatch(/^\[helper-query\] channel=worktree:terminal-status caller=tw target=wk → ok source=live isolated=true ahead=1 behind=2 dirty=0 changed=2 outOfScope=1 conflicts=1 cached=false ms=\d+$/)
    expect(h.logs[1]).toBe('[helper-query] channel=worktree:terminal-status caller=tw target=workorder=T0003 → NOT_OWNER')
    expect(h.events[0]).toMatchObject({ event: 'helper-query', channel: 'worktree:terminal-status', caller: 'tw', callerRole: 'tower', target: 'wk' })
    expect(JSON.stringify([h.logs, h.events])).not.toContain('out.ts')
  })
})

const EXITED_AT = 1_000

describe('worktree:terminal-status — after the Worker tab closed (T0589)', () => {
  const GIT_STATUS = { ...STATUS, dirty: null, dirtyCount: null, worktreeMissing: true } as CtWorktreeGitStatusResult

  /** tw (tower, cwd /w/r/src) with an exited isolated Worker wk of T0001; other-tw's exited Worker ow of T0003. */
  function closed(extra: Parameters<typeof harness>[0] = {}) {
    return harness({
      ptys: { tw: {}, 'other-tw': {}, sh: {} },
      workers: {},
      exited: {
        wk: { towerTerminalId: 'tw', workorder: 'T0001', worktree: RECORD, exitedAt: EXITED_AT },
        ow: { towerTerminalId: 'other-tw', workorder: 'T0003', worktree: { ...RECORD, workorder: 'T0003' }, exitedAt: EXITED_AT },
      },
      cwd: { tw: '/w/r/src', 'other-tw': '/w/r' },
      statusFromGit: async () => GIT_STATUS,
      ...extra,
    })
  }

  it('live first: a running Worker answers source=live (T0585 unchanged)', async () => {
    const h = harness({ exited: { old: { towerTerminalId: 'tw', workorder: 'T0001', worktree: RECORD, exitedAt: EXITED_AT } }, cwd: { tw: '/w/r' }, statusFromGit: async () => GIT_STATUS })
    expect(await h.call(h.asHelper('tw'), { workorder: 'T0001' })).toMatchObject({ ok: true, terminalId: 'wk', source: 'live', isolated: true })
    expect(h.gitCalls).toEqual([])
  })

  it('exited: by work order and by id — its recorded worktree, exited + exitedAt', async () => {
    const h = closed()
    const byWorkorder = await h.call(h.asHelper('tw'), { workorder: 't0001' })
    expect(byWorkorder).toMatchObject({ ok: true, terminalId: 'wk', source: 'exited', exited: true, exitedAt: EXITED_AT, isolated: true, ahead: 1 })
    expect(h.statusCalls).toEqual([RECORD])
    expect(await h.call(h.asHelper('tw'), { terminalId: 'wk' })).toMatchObject({ ok: true, terminalId: 'wk', source: 'exited', exited: true })
    expect(h.gitCalls).toEqual([])
    expect(h.logs[0]).toMatch(/target=wk → ok source=exited isolated=true /)
  })

  it('exited, not isolated → isolated:false with source=exited (the service is not called)', async () => {
    const h = closed({ exited: { wk2: { towerTerminalId: 'tw', workorder: 'T0002', exitedAt: EXITED_AT } } })
    expect(await h.call(h.asHelper('tw'), { workorder: 'T0002' })).toEqual({ ok: true, terminalId: 'wk2', source: 'exited', exited: true, exitedAt: EXITED_AT, isolated: false })
    expect(h.statusCalls).toEqual([])
  })

  it('exited of another tower → NOT_OWNER, never git; by id too', async () => {
    const h = closed()
    expect(await h.call(h.asHelper('tw'), { workorder: 'T0003' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await h.call(h.asHelper('tw'), { terminalId: 'ow' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(h.gitCalls).toEqual([])
    // its own tower sees it
    expect(await h.call(h.asHelper('other-tw'), { terminalId: 'ow' })).toMatchObject({ ok: true, source: 'exited' })
  })

  it('several exited of one tower → the latest; of different towers (server token) → AMBIGUOUS', async () => {
    const same = closed({
      exited: {
        a: { towerTerminalId: 'tw', workorder: 'T0001', worktree: { ...RECORD, base: 'd'.repeat(40) }, exitedAt: 5 },
        b: { towerTerminalId: 'tw', workorder: 'T0001', worktree: RECORD, exitedAt: 9 },
        c: { towerTerminalId: 'other-tw', workorder: 'T0001', worktree: RECORD, exitedAt: 20 },
      },
    })
    expect(await same.call(same.asHelper('tw'), { workorder: 'T0001' })).toMatchObject({ ok: true, terminalId: 'b', source: 'exited', exitedAt: 9 })
    expect(await same.call(same.client, { workorder: 'T0001' })).toEqual({ ok: false, code: 'AMBIGUOUS', terminalIds: ['a', 'b', 'c'] })
    expect(await same.call(same.client, { terminalId: 'c' })).toMatchObject({ ok: true, terminalId: 'c', source: 'exited' })
  })

  it('git: no tab record, a tower capability → its own PTY cwd; terminalId null, source=git', async () => {
    const h = closed()
    const r = await h.call(h.asHelper('tw'), { workorder: 'T0042' })
    expect(r).toMatchObject({ ok: true, terminalId: null, source: 'git', isolated: true, dirty: null, worktreeMissing: true })
    expect(r).not.toHaveProperty('exited')
    expect(h.gitCalls).toEqual([{ cwd: '/w/r/src', workorder: 'T0042' }])
    expect(h.logs[0]).toMatch(/^\[helper-query\] channel=worktree:terminal-status caller=tw target=workorder=T0042 → ok source=git isolated=true /)
  })

  it('git NOT_FOUND / TIMEOUT / GIT_FAILED / thrown', async () => {
    const nf = closed({ statusFromGit: async () => ({ ok: false, code: 'NOT_FOUND', error: 'branch ct/T0042 not found' }) })
    expect(await nf.call(nf.asHelper('tw'), { workorder: 'T0042' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    const to = closed({ statusFromGit: async () => ({ ok: false, code: 'TIMEOUT', error: 'slow' }) })
    expect(await to.call(to.asHelper('tw'), { workorder: 'T0042' })).toMatchObject({ ok: false, code: 'TIMEOUT' })
    const gf = closed({ statusFromGit: async () => ({ ok: false, code: 'GIT_FAILED', error: 'no HEAD' }) })
    expect(await gf.call(gf.asHelper('tw'), { workorder: 'T0042' })).toMatchObject({ ok: false, code: 'GIT_FAILED', message: 'no HEAD' })
    const th = closed({ statusFromGit: async () => { throw new Error('boom') } })
    expect(await th.call(th.asHelper('tw'), { workorder: 'T0042' })).toMatchObject({ ok: false, code: 'GIT_FAILED' })
  })

  it('no git for a worker capability, a server-token client, a terminalId, or a tower whose PTY is gone', async () => {
    const h = closed({
      ptys: { tw: {}, wk: { tower: 'tw', workorder: 'T0001' } },
      workers: { wk: 'tw' },
      exited: {},
      cwd: { tw: '/w/r', wk: '/w/wt' },
    })
    expect(await h.call(h.asHelper('wk'), { workorder: 'T0042' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(await h.call(h.client, { workorder: 'T0042' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(await h.call(h.asHelper('tw'), { terminalId: 'gone' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    const gone: HandlerContext = { windowId: null, connectionId: 'c1', helper: { terminalId: 'ghost', role: 'tower' } }
    expect(await h.call(gone, { workorder: 'T0042' })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(h.gitCalls).toEqual([])
    // without the T0589 deps (an old wiring) nothing changes
    const old = harness({ ptys: { tw: {} }, workers: {} })
    expect(await old.call(old.asHelper('tw'), { workorder: 'T0042' })).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('audit / events never carry file names', async () => {
    const h = closed()
    await h.call(h.asHelper('tw'), { workorder: 'T0001' })
    await h.call(h.asHelper('tw'), { workorder: 'T0042' })
    expect(JSON.stringify([h.logs, h.events])).not.toContain('out.ts')
    expect(h.events.map(e => e.result)).toEqual([expect.stringMatching(/^ok source=exited /), expect.stringMatching(/^ok source=git /)])
  })
})

describe('worktree:terminal-status — role table and wiring', () => {
  it('both roles may invoke it (the handler scopes the target)', () => {
    expect(HELPER_CHANNEL_ROLES['worktree:terminal-status']).toEqual(['tower', 'worker'])
    expect(authorizeHelperInvoke({ terminalId: 'tw', role: 'tower' }, 'worktree:terminal-status', [{ workorder: 'T1' }])).toEqual({ ok: true })
    expect(authorizeHelperInvoke({ terminalId: 'wk', role: 'worker', towerId: 'tw' }, 'worktree:terminal-status', [{}])).toEqual({ ok: true })
  })

  it('main.ts and headless register it with the --close-worker view of the Workers', () => {
    const electronDir = path.resolve(__dirname, '..')
    const main = fs.readFileSync(path.join(electronDir, 'main.ts'), 'utf8')
    const block = main.slice(main.indexOf('registerWorktreeStatusHandler({'))
    expect(block).toMatch(/getWorkerView: \(\) => ptyManager\s*\?\s*withSavedWorkerOwnership\(/)
    expect(block.slice(0, 800)).toContain('isOwnedBy: capabilityOrSavedTabOwnership(')
    expect(block.slice(0, 1200)).toContain('status: record => ctWorktreeService.status(record)')
    // T0589: the exited records and git, Electron and headless alike
    expect(block.slice(0, 1600)).toContain('getExitedView: () => ptyManager,')
    expect(block.slice(0, 1600)).toContain('statusFromGit: opts => ctWorktreeService.statusFromGit(opts)')
    const headless = fs.readFileSync(path.join(electronDir, 'remote', 'headless-entry.ts'), 'utf8')
    expect(headless).toContain('registerWorktreeStatusHandler({')
    const headlessBlock = headless.slice(headless.indexOf('registerWorktreeStatusHandler({'))
    expect(headlessBlock.slice(0, 900)).toContain('getExitedView: opts.getPtyManager,')
    expect(headlessBlock.slice(0, 900)).toContain('statusFromGit: query => ctWorktree.statusFromGit(query)')
    // no electron import in the shared module
    const shared = fs.readFileSync(path.join(electronDir, 'worktree-status-handlers.ts'), 'utf8')
    expect(shared).not.toMatch(/from ['"]electron['"]/)
  })
})
