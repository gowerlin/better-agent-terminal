// @vitest-environment node
/**
 * PLAN-047 W1-2 / T0585: `worktree:terminal-status` handler — the caller is its capability, the
 * scope is `authorizeHelperQueryTarget` (output): a tower → itself + its Workers, a worker →
 * itself; `workorder` finds the Worker as `--close-worker` does (NOT_FOUND / NOT_OWNER /
 * AMBIGUOUS); a tab that is not isolated → `isolated: false`; TIMEOUT / GIT_FAILED from the
 * service; the `[helper-query]` audit line. Plus the role table and the wiring in main / headless.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CloseWorkerPtyManager } from '../close-worker'
import type { CtWorktreeRecord, CtWorktreeStatusResult } from '../ct-worktree'
import type { HandlerContext } from '../remote/handler-registry'
import { HELPER_CHANNEL_ROLES, authorizeHelperInvoke } from '../remote/helper-capability'
import { WORKTREE_STATUS_CHANNEL, registerWorktreeStatusHandler } from '../worktree-status-handlers'

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
  registerWorktreeStatusHandler({
    registerHandler: (channel, handler) => { handlers.set(channel, handler) },
    getWorkerView: () => view,
    isWorkerOf: (child, tower) => workers[child] === tower,
    ...(opts.isOwnedBy ? { isOwnedBy: opts.isOwnedBy } : {}),
    status: record => { statusCalls.push(record); return (opts.status ?? (async () => STATUS))(record) },
    logger: { log: (...args: unknown[]) => logs.push(args.join(' ')) },
    mirrorToBatScripts: (event, payload) => events.push({ event, ...payload }),
  })
  const asHelper = (terminalId: string): HandlerContext => {
    const towerId = workers[terminalId]
    return { windowId: null, connectionId: 'c1', helper: towerId ? { terminalId, role: 'worker', towerId } : { terminalId, role: 'tower' } }
  }
  const call = (ctx: HandlerContext, ...args: unknown[]) => Promise.resolve(handlers.get(WORKTREE_STATUS_CHANNEL)!(ctx, ...args)) as Promise<Record<string, unknown>>
  return { handlers, logs, events, statusCalls, asHelper, call, client: { windowId: null, connectionId: 'c9' } as HandlerContext }
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
    expect(await h.call(h.asHelper('tw'), { workorder: 'T0002' })).toEqual({ ok: true, terminalId: 'wk2', isolated: false })
    expect(await h.call(h.asHelper('tw'))).toEqual({ ok: true, terminalId: 'tw', isolated: false })
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
    expect(h.logs[0]).toMatch(/^\[helper-query\] channel=worktree:terminal-status caller=tw target=wk → ok isolated=true ahead=1 behind=2 dirty=0 changed=2 outOfScope=1 conflicts=1 cached=false ms=\d+$/)
    expect(h.logs[1]).toBe('[helper-query] channel=worktree:terminal-status caller=tw target=workorder=T0003 → NOT_OWNER')
    expect(h.events[0]).toMatchObject({ event: 'helper-query', channel: 'worktree:terminal-status', caller: 'tw', callerRole: 'tower', target: 'wk' })
    expect(JSON.stringify([h.logs, h.events])).not.toContain('out.ts')
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
    const headless = fs.readFileSync(path.join(electronDir, 'remote', 'headless-entry.ts'), 'utf8')
    expect(headless).toContain('registerWorktreeStatusHandler({')
    // no electron import in the shared module
    const shared = fs.readFileSync(path.join(electronDir, 'worktree-status-handlers.ts'), 'utf8')
    expect(shared).not.toMatch(/from ['"]electron['"]/)
  })
})
