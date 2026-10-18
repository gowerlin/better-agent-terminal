// @vitest-environment node
/**
 * PLAN-050 / T0643 (D167, relaxes D149): `terminal:list { scope: 'towers' }`.
 *
 *   - scope functions: `authorizeHelperListScope` / `isTowersScopeMember` / `HELPER_LIST_SCOPES`
 *   - a declared tower lists the running declared towers of every workspace, itself marked `self`;
 *     no Worker / shell / exited tower; rows carry identification fields only (no session id, cwd,
 *     tower mode, work order, questions)
 *   - an undeclared tower capability (shell) / a worker → NOT_OWNER; a server-token client lists all
 *   - get-state / read-output / wait of a listed tower of another workspace stay NOT_OWNER
 *   - `scope: 'mine'` / `'workspace'` unchanged; unknown scope INVALID_ARGS
 *   - audit line / bat-scripts mirror: `scope=towers`, the count, never a name
 *   - `workspaceNameFromRegistry` (alias first); no `getWorkspaceName` (headless) → null; title from
 *     the saved tabs
 *   - main.ts wiring (source guard)
 */
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager / terminal-query-handlers must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'
import {
  authorizeHelperListScope,
  HELPER_LIST_SCOPES,
  HelperCapabilityRegistry,
  isTowersScopeMember,
} from '../remote/helper-capability'
import {
  registerTerminalQueryHandlers,
  workspaceNameFromRegistry,
  type SavedTabInfo,
  type TerminalQueryHandlers,
} from '../terminal-query-handlers'

const ROOT = path.resolve(__dirname, '..', '..')
const SID = '0f3c2a9e-6b1d-4c8e-9a7f-1d2e3f4a5b6c'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: unknown) => new FakePty())
const CWD = os.tmpdir()
let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

const tmpDirs: string[] = []
const managers: PtyManagerType[] = []
let queries: TerminalQueryHandlers | null = null

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
})

afterEach(() => {
  queries?.dispose()
  queries = null
  for (const manager of managers.splice(0)) manager.dispose()
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

const REGISTRY_ENTRIES = [
  { workspaces: [{ id: 'ws-a', name: 'alpha-dir', alias: 'Alpha' }] },
  { workspaces: [{ id: 'ws-b', name: 'Beta', alias: '' }] },
]
const NAMES: Record<string, string> = {
  twA: 'Alpha · Tower',
  twB: 'Beta · twB',
  wkA: 'Alpha · Worker · T0643',
}

interface SetupOptions {
  workspaceNames?: boolean
  savedTabs?: Map<string, SavedTabInfo>
}

function setup(opts: SetupOptions = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0643-'))
  tmpDirs.push(dataDir)
  const registry = new HelperCapabilityRegistry()
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
  const create = (id: string, workspaceId: string, extra: { towerId?: string; cwd?: string } = {}) => {
    expect(manager.create({
      id,
      cwd: extra.cwd ?? CWD,
      type: 'terminal',
      shell: '/bin/sh',
      workspaceId,
      ...(extra.towerId ? { customEnv: { BAT_TOWER_TERMINAL_ID: extra.towerId } } : {}),
    })).toBe(true)
  }
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  const logs: string[] = []
  const mirrors: Array<[string, Record<string, unknown>]> = []
  queries = registerTerminalQueryHandlers({
    registerHandler: (channel, fn) => { handlers.set(channel, fn) },
    getPtyManager: () => manager,
    isWorkerOf: (c, tw) => registry.isWorkerOf(c, tw),
    getClaudeSessionName: id => NAMES[id] ?? null,
    ...(opts.workspaceNames === false ? {} : { getWorkspaceName: (id: string) => workspaceNameFromRegistry(REGISTRY_ENTRIES, id) }),
    ...(opts.savedTabs ? { savedTabs: () => opts.savedTabs! } : {}),
    getQuestionSummary: () => ({ pending: 0, blockingSince: null }),
    logger: { log: (m: unknown) => { logs.push(String(m)) } },
    mirrorToBatScripts: (event, payload) => { mirrors.push([event, payload]) },
  })
  const asHelper = (terminalId: string): HandlerContext => {
    const towerId = manager.getTerminalInfo(terminalId)?.towerTerminalId
    return { windowId: null, connectionId: `c-${terminalId}`, helper: towerId ? { terminalId, role: 'worker', towerId } : { terminalId, role: 'tower' } }
  }
  const call = (channel: string, ctx: HandlerContext, ...args: unknown[]) => handlers.get(channel)!(ctx, ...args) as Record<string, unknown>

  // two workspaces: ws-a has a declared tower, its Worker and a plain shell; ws-b a declared tower
  // and a plain shell; twC was a declared tower in ws-b and exited
  create('twA', 'ws-a', { cwd: path.join(CWD, 'secret-cwd-a') })
  create('wkA', 'ws-a', { towerId: 'twA' })
  create('shA', 'ws-a')
  create('twB', 'ws-b', { cwd: path.join(CWD, 'secret-cwd-b') })
  create('shB', 'ws-b')
  create('twC', 'ws-b')
  manager.setTerminalRole('twA', 'tower', 'yolo')
  manager.setTerminalRole('twB', 'tower', 'ask')
  manager.setTerminalRole('twC', 'tower')
  manager.kill('twC')
  return { manager, registry, call, asHelper, logs, mirrors }
}

const rowsOf = (answer: Record<string, unknown>) => answer.terminals as Array<Record<string, unknown>>

describe('scope functions (T0643)', () => {
  const ctx = { getTerminalRole: (id: string) => (id === 'tw' ? 'tower' as const : undefined) }

  it('HELPER_LIST_SCOPES = mine / workspace / towers', () => {
    expect(HELPER_LIST_SCOPES).toEqual(['mine', 'workspace', 'towers'])
  })

  it('authorizeHelperListScope: mine for anyone; workspace / towers for a declared tower or a server-token client', () => {
    for (const s of HELPER_LIST_SCOPES) expect(authorizeHelperListScope(null, s, ctx)).toEqual({ ok: true })
    for (const s of ['workspace', 'towers'] as const) {
      expect(authorizeHelperListScope({ terminalId: 'tw', role: 'tower' }, s, ctx)).toEqual({ ok: true })
      expect(authorizeHelperListScope({ terminalId: 'sh', role: 'tower' }, s, ctx)).toEqual({ ok: false, code: 'NOT_OWNER' })
      expect(authorizeHelperListScope({ terminalId: 'wk', role: 'worker', towerId: 'tw' }, s, ctx)).toEqual({ ok: false, code: 'NOT_OWNER' })
    }
    expect(authorizeHelperListScope({ terminalId: 'wk', role: 'worker', towerId: 'tw' }, 'mine', ctx)).toEqual({ ok: true })
  })

  it('isTowersScopeMember: a declared tower only', () => {
    expect(isTowersScopeMember('tw', ctx)).toBe(true)
    expect(isTowersScopeMember('sh', ctx)).toBe(false)
  })
})

describe('terminal:list scope=towers (T0643)', () => {
  it('a declared tower lists the running declared towers of every workspace, itself marked self', () => {
    const h = setup()
    const answer = h.call('terminal:list', h.asHelper('twA'), { scope: 'towers' })
    expect(answer).toMatchObject({ ok: true, scope: 'towers' })
    expect(rowsOf(answer)).toEqual([
      { id: 'twA', workspaceId: 'ws-a', workspaceName: 'Alpha', claudeSessionName: 'Alpha · Tower', state: expect.any(String), alive: true, self: true },
      { id: 'twB', workspaceId: 'ws-b', workspaceName: 'Beta', claudeSessionName: 'Beta · twB', state: expect.any(String), alive: true, self: false },
    ])
    // the other declared tower sees the same two, itself marked
    expect(rowsOf(h.call('terminal:list', h.asHelper('twB'), { scope: 'towers' })).map(r => [r.id, r.self])).toEqual([['twA', false], ['twB', true]])
  })

  it('rows carry identification fields only — never the session id, cwd, tower mode, work order, questions, output', () => {
    const h = setup()
    expect(h.manager.restoreClaudeSessionId('twB', SID)).toBe(true)
    expect(h.manager.getClaudeSessionId('twB')).toBe(SID)
    const rows = rowsOf(h.call('terminal:list', h.asHelper('twA'), { scope: 'towers' }))
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['alive', 'claudeSessionName', 'id', 'self', 'state', 'workspaceId', 'workspaceName'])
    }
    const text = JSON.stringify(rows)
    expect(text).not.toContain(SID)
    expect(text).not.toContain('secret-cwd')
    expect(text).not.toContain('towerMode')
    expect(text).not.toContain('pendingQuestions')
  })

  it('a shell (undeclared tower capability) and a worker → NOT_OWNER; a server-token client lists all towers', () => {
    const h = setup()
    for (const id of ['shA', 'wkA']) {
      expect(h.call('terminal:list', h.asHelper(id), { scope: 'towers' })).toEqual({
        ok: false,
        code: 'NOT_OWNER',
        message: 'scope=towers needs a declared tower (--set-role tower)',
      })
    }
    const client: HandlerContext = { windowId: null, connectionId: 'client-1' }
    expect(rowsOf(h.call('terminal:list', client, { scope: 'towers' })).map(r => [r.id, r.self])).toEqual([['twA', false], ['twB', false]])
  })

  it('a listed tower of another workspace stays out of scope for get-state / read-output / wait', async () => {
    const h = setup()
    const ctx = h.asHelper('twA')
    expect(h.call('terminal:get-state', ctx, { terminalId: 'twB' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(h.call('terminal:read-output', ctx, { terminalId: 'twB' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await h.call('terminal:wait', ctx, { terminalId: 'twB', until: 'exit', timeoutMs: 0 })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(h.call('terminal:get-state', ctx, { terminalId: 'shB' })).toEqual({ ok: false, code: 'NOT_OWNER' })
  })

  it('mine / workspace unchanged; an unknown scope → INVALID_ARGS', () => {
    const h = setup()
    const ctx = h.asHelper('twA')
    const mine = rowsOf(h.call('terminal:list', ctx))
    expect(mine.map(r => r.id).sort()).toEqual(['twA', 'wkA'])
    expect(mine.find(r => r.id === 'wkA')).toMatchObject({ role: 'worker', claudeSessionName: 'Alpha · Worker · T0643', claudeSessionId: null })
    expect(rowsOf(h.call('terminal:list', ctx, { scope: 'workspace' })).map(r => r.id).sort()).toEqual(['shA', 'twA', 'wkA'])
    expect(h.call('terminal:list', h.asHelper('shA'), { scope: 'workspace' })).toEqual({
      ok: false,
      code: 'NOT_OWNER',
      message: 'scope=workspace needs a declared tower (--set-role tower)',
    })
    for (const scope of ['all', 'TOWERS', 1]) {
      expect(h.call('terminal:list', ctx, { scope })).toEqual({ ok: false, code: 'INVALID_ARGS', message: 'scope' })
    }
  })

  it('audit: scope=towers and the count, never a name or workspace', () => {
    const h = setup()
    h.call('terminal:list', h.asHelper('twA'), { scope: 'towers' })
    h.call('terminal:list', h.asHelper('wkA'), { scope: 'towers' })
    expect(h.logs).toEqual([
      '[helper-query] channel=terminal:list caller=twA target=scope=towers → ok count=2',
      '[helper-query] channel=terminal:list caller=wkA target=scope=towers → NOT_OWNER (scope=towers needs a declared tower (--set-role tower))',
    ])
    expect(h.mirrors[0]).toEqual(['helper-query', { channel: 'terminal:list', caller: 'twA', callerRole: 'tower', target: 'scope=towers', result: 'ok count=2' }])
    const text = JSON.stringify([h.logs, h.mirrors])
    for (const s of ['Alpha', 'Beta', 'ws-a', 'ws-b']) expect(text).not.toContain(s)
  })

  it('no getWorkspaceName (headless) → workspaceName null; title from the saved tabs when there', () => {
    const saved = new Map<string, SavedTabInfo>([['twB', { title: 'Claude Code · Tower', workspaceId: 'ws-b' }]])
    const h = setup({ workspaceNames: false, savedTabs: saved })
    const rows = rowsOf(h.call('terminal:list', h.asHelper('twA'), { scope: 'towers' }))
    expect(rows.find(r => r.id === 'twA')).toEqual(expect.objectContaining({ workspaceName: null }))
    expect(rows.find(r => r.id === 'twA')).not.toHaveProperty('title')
    expect(rows.find(r => r.id === 'twB')).toEqual(expect.objectContaining({ workspaceName: null, title: 'Claude Code · Tower' }))
  })
})

describe('workspaceNameFromRegistry (T0643)', () => {
  it('alias first, then name; null when unknown or nameless; malformed entries skipped', () => {
    const entries = [
      { workspaces: 'nope' },
      {},
      { workspaces: [null, 1, { id: 'ws-a', name: 'alpha-dir', alias: 'Alpha' }, { id: 'ws-b', name: 'Beta', alias: '' }, { id: 'ws-c' }] },
    ]
    expect(workspaceNameFromRegistry(entries, 'ws-a')).toBe('Alpha')
    expect(workspaceNameFromRegistry(entries, 'ws-b')).toBe('Beta')
    expect(workspaceNameFromRegistry(entries, 'ws-c')).toBeNull()
    expect(workspaceNameFromRegistry(entries, 'ws-x')).toBeNull()
  })
})

describe('wiring (T0643 source guards)', () => {
  it('main.ts gives the query handlers the registry workspace names; headless does not', () => {
    const main = fs.readFileSync(path.join(ROOT, 'electron', 'main.ts'), 'utf8')
    expect(main).toContain('getWorkspaceName: workspaceId => workspaceNameFromRegistry(windowRegistry.getCachedEntries(), workspaceId)')
    const headless = fs.readFileSync(path.join(ROOT, 'electron', 'remote', 'headless-entry.ts'), 'utf8')
    expect(headless).not.toContain('getWorkspaceName')
  })
})
