// @vitest-environment node
/**
 * T0949 / BUG-230: a Tower's `--set-role` declaration (role / mode / contract, + the `--agent` hint)
 * survives a BAT reopen that reattaches the same PTY process (electron/terminal-role.ts
 * `TowerRolePersistence`, `decideTowerRoleRestore`; PtyManager `noteTowerDeclaration` /
 * `getTowerDeclaration` / `restoreTowerDeclaration`).
 *
 * Two PtyManagers against fake Terminal Servers stand for the BAT process before and after the
 * reopen; the store file is shared through a temp userData.
 * - same process (pid on the server's list = the declaring pid) → restored + `terminal:role-changed`
 * - ⏻ restart / the T0704 recovery rebuild / exit / another pid / no surviving server / fresh start →
 *   not restored
 * - a tab that never declared → nothing; a later `--set-role` overwrites the restored one
 * - the `--set-role` answer is unchanged; logs carry only the id's first 8 characters
 */
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { createRequire } from 'module'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('terminal-role / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { SetTerminalRoleDeps, TowerRolePersistence as TowerRolePersistenceType } from '../terminal-role'

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
const TAB = { cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' }
const TOWER_ID = 'a1b2c3d4-0000-4000-8000-00000000c0de'
let PtyManager: typeof PtyManagerType
let terminalRole: typeof import('../terminal-role')

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
  terminalRole = await import('../terminal-role')
})

let dataDir: string
let userData: string
let storeFile: string
const managers: PtyManagerType[] = []

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0949-pty-'))
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 't0949-ud-'))
  storeFile = path.join(userData, 'tower-roles.json')
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  fs.rmSync(userData, { recursive: true, force: true })
  vi.restoreAllMocks()
})

interface Internals {
  handlePtyCreated(id: string, pid: number): void
  handleReplayList(ptys: Array<{ id: string; pid: number; cwd: string }>): void
  handlePtyExit(id: string, code: number): void
  handleServerDeath(): Promise<void>
  instances: Map<string, { awaitingCreated?: boolean }>
}
const internals = (m: PtyManagerType) => m as unknown as Internals

const AGENT_NAMES: Record<string, string> = { 'claude-code': 'Claude Code', 'claude-cli': 'Claude CLI' }

/** One BAT main process: a PtyManager on a fake Terminal Server + its Tower store. */
function bat(opts: { settleOnList?: boolean } = {}) {
  const emitted: Array<[string, unknown]> = []
  const logs: string[] = []
  let persistence: TowerRolePersistenceType | null = null
  const manager = new PtyManager({
    emit: vi.fn(),
    dataDir,
    onTowerRoleChange: () => persistence?.persist(),
    onPtyExit: () => persistence?.persist(),
    onServerRecovery: () => persistence?.persist(),
    onSurvivingPtys: (ids) => {
      if (opts.settleOnList === false) return
      const alive = new Set(ids)
      persistence?.settle(id => alive.has(id), 'Terminal Server PTY list')
    },
  })
  managers.push(manager)
  persistence = new terminalRole.TowerRolePersistence({
    getPtyManager: () => manager,
    emit: (channel, payload) => { emitted.push([channel, payload]); return 1 },
    log: { log: (m: string) => logs.push(m), warn: (m: string) => logs.push(m) },
    agentName: id => AGENT_NAMES[id],
  })
  persistence.load(storeFile)
  const server = new FakeServer()
  manager.setServerProcess(server as unknown as ChildProcess)
  return { manager, persistence, emitted, logs, server }
}

function roleDeps(manager: PtyManagerType) {
  const emitted: Array<[string, unknown]> = []
  const deps: SetTerminalRoleDeps = {
    getPtyManager: () => manager,
    emit: (channel, payload) => { emitted.push([channel, payload]); return 1 },
    logger: { log: vi.fn() },
    isKnownAgent: id => id in AGENT_NAMES,
    agentName: id => AGENT_NAMES[id],
    mirrorToBatScripts: vi.fn(),
  }
  return { deps, emitted }
}

function stored(): unknown {
  return JSON.parse(fs.readFileSync(storeFile, 'utf8'))
}

/** Process 1: a claude-cli tab on the server (pid 4242) that CT declares a contract-2 yolo Tower. */
async function declaredBefore(pid = 4242) {
  const first = bat()
  first.manager.create({ id: TOWER_ID, ...TAB, agentPreset: 'claude-cli' })
  internals(first.manager).handlePtyCreated(TOWER_ID, pid)
  first.manager.create({ id: 'plain', ...TAB })
  internals(first.manager).handlePtyCreated('plain', 5000)
  // T0910: a hook already reported → the answer carries hooksStatus at once (no 2 s wait)
  expect(first.manager.acceptHookOrigin(TOWER_ID, undefined, 2)).toBe(true)
  const { deps } = roleDeps(first.manager)
  await terminalRole.setTerminalRole({ terminalId: TOWER_ID, role: 'tower', mode: 'yolo', batContract: 2, agent: 'claude-code' }, deps)
  return first
}

describe('decideTowerRoleRestore (T0949)', () => {
  it('only the same running process with nothing declared since', () => {
    const { decideTowerRoleRestore } = terminalRole
    expect(decideTowerRoleRestore({ pid: 10 }, { alive: true, pid: 10 })).toEqual({ restore: true })
    expect(decideTowerRoleRestore({ pid: 10 }, { alive: false, pid: 10 })).toEqual({ restore: false, reason: 'not-running' })
    expect(decideTowerRoleRestore({ pid: 10 }, { alive: true })).toEqual({ restore: false, reason: 'pid-unknown' })
    expect(decideTowerRoleRestore({ pid: 10 }, { alive: true, pid: 11 })).toEqual({ restore: false, reason: 'pid-mismatch' })
    expect(decideTowerRoleRestore({ pid: 10 }, { alive: true, pid: 10, role: 'tower' })).toEqual({ restore: false, reason: 'declared-since' })
  })
})

describe('tower-roles.json (T0949)', () => {
  it('missing / corrupt / invalid entries skipped; written atomically, ids and numbers only', () => {
    const { readTowerRoleStore, writeTowerRoleStore } = terminalRole
    expect(readTowerRoleStore(storeFile)).toEqual({ status: 'missing', towers: [] })
    fs.writeFileSync(storeFile, '{not json')
    expect(readTowerRoleStore(storeFile).status).toBe('corrupt')
    fs.writeFileSync(storeFile, JSON.stringify({ version: 2, towers: [] }))
    expect(readTowerRoleStore(storeFile).status).toBe('corrupt')
    fs.writeFileSync(storeFile, JSON.stringify({
      version: 1,
      towers: [
        { terminalId: 'ok-1', pid: 7, role: 'tower', mode: 'on', towerContract: 2, ptyAgent: 'claude-cli', agent: 'claude-code' },
        { terminalId: 'ok-2', pid: 8, role: 'tower' },
        { terminalId: 'ok-1', pid: 9, role: 'tower' }, // repeated id: the first wins
        { terminalId: 'bad pid', pid: 7, role: 'tower' },
        { terminalId: 'p0', pid: 0, role: 'tower' },
        { terminalId: 'r', pid: 7, role: 'worker' },
        { terminalId: 'm', pid: 7, role: 'tower', mode: 'fast' },
        { terminalId: 'c', pid: 7, role: 'tower', towerContract: 0 },
        { terminalId: 'a', pid: 7, role: 'tower', agent: 'x y' },
        null,
      ],
    }))
    const read = readTowerRoleStore(storeFile)
    expect(read).toEqual({
      status: 'ok',
      skipped: 8,
      towers: [
        { terminalId: 'ok-1', pid: 7, role: 'tower', mode: 'on', towerContract: 2, ptyAgent: 'claude-cli', agent: 'claude-code' },
        { terminalId: 'ok-2', pid: 8, role: 'tower' },
      ],
    })
    writeTowerRoleStore(storeFile, read.towers)
    expect(stored()).toEqual({ version: 1, towers: read.towers })
    expect(fs.readdirSync(userData)).toEqual(['tower-roles.json'])
    if (process.platform !== 'win32') expect(fs.statSync(storeFile).mode & 0o777).toBe(0o600)
  })
})

describe('reattaching the same PTY restores the declaration (T0949 / BUG-230)', () => {
  it('stores the declaration with the declaring pid; a tab that never declared is not stored', async () => {
    const first = await declaredBefore()
    expect(stored()).toEqual({
      version: 1,
      towers: [{ terminalId: TOWER_ID, pid: 4242, role: 'tower', mode: 'yolo', towerContract: 2, ptyAgent: 'claude-cli', agent: 'claude-code' }],
    })
    expect(first.manager.getTowerAgent(TOWER_ID)).toBe('claude-code')
  })

  it('same process on the reopened BAT → role / mode / contract back, isYolo, role-changed sent', async () => {
    await declaredBefore()
    const second = bat()
    internals(second.manager).handleReplayList([
      { id: TOWER_ID, pid: 4242, cwd: CWD },
      { id: 'plain', pid: 5000, cwd: CWD },
    ])
    const m = second.manager
    expect(m.getTerminalRole(TOWER_ID)).toBe('tower')
    expect(m.getTowerMode(TOWER_ID)).toBe('yolo')
    expect(m.getTowerContract(TOWER_ID)).toBe(2)
    expect(m.isYoloTerminal(TOWER_ID)).toBe(true)
    expect(m.getTerminalInfo(TOWER_ID)).toMatchObject({ role: 'tower', towerMode: 'yolo', towerContract: 2, yolo: true })
    expect(m.getTerminalRole('plain')).toBeUndefined()
    expect(second.emitted).toEqual([[terminalRole.ROLE_CHANGED_CHANNEL, {
      id: TOWER_ID,
      role: 'tower',
      towerContract: 2,
      ptyAgent: 'claude-cli',
      ptyAgentName: 'Claude CLI',
      agent: 'claude-code',
      agentName: 'Claude Code',
      mode: 'yolo',
    }]])
    // the restored declaration is still stored (the same process may be reattached again)
    expect((stored() as { towers: unknown[] }).towers).toEqual([
      { terminalId: TOWER_ID, pid: 4242, role: 'tower', mode: 'yolo', towerContract: 2, ptyAgent: 'claude-cli', agent: 'claude-code' },
    ])
    // a window that loads now gets the same event (startup reattach before any window, View→Reload)
    expect(second.persistence.roleChanges()).toEqual([second.emitted[0][1]])
    // logs: the id's first 8 characters, role, mode, contract — never the whole id
    const restoredLog = second.logs.find(line => line.startsWith('[tower-role] restored:'))
    expect(restoredLog).toBe('[tower-role] restored: terminal=a1b2c3d4 role=tower mode=yolo contract=2 (Terminal Server PTY list)')
    expect(second.logs.join('\n')).not.toContain(TOWER_ID)
  })

  it('another pid under the id (pid reused list / another process) → not restored, entry dropped', async () => {
    await declaredBefore()
    const second = bat()
    internals(second.manager).handleReplayList([{ id: TOWER_ID, pid: 9999, cwd: CWD }])
    expect(second.manager.getTerminalRole(TOWER_ID)).toBeUndefined()
    expect(second.manager.isYoloTerminal(TOWER_ID)).toBe(false)
    expect(second.emitted).toEqual([])
    expect(second.logs).toContain('[tower-role] not restored: terminal=a1b2c3d4 (pid-mismatch; Terminal Server PTY list)')
    expect(stored()).toEqual({ version: 1, towers: [] })
  })

  it('no surviving Terminal Server / the Recovery fresh start → nothing restored', async () => {
    await declaredBefore()
    const second = bat()
    second.persistence.settle(() => false, 'no surviving Terminal Server')
    second.manager.create({ id: TOWER_ID, ...TAB, agentPreset: 'claude-cli' }) // the restored tab's new shell
    internals(second.manager).handlePtyCreated(TOWER_ID, 4242) // even a reused pid
    expect(second.manager.getTerminalRole(TOWER_ID)).toBeUndefined()
    expect(second.emitted).toEqual([])
    expect(stored()).toEqual({ version: 1, towers: [] })
  })

  it('⏻ restart before BAT closed → the new process is not restored (the in-session role is kept as before)', async () => {
    const first = await declaredBefore()
    expect(first.manager.restart(TOWER_ID, CWD, '/bin/sh')).toBe(true)
    internals(first.manager).handlePtyCreated(TOWER_ID, 6060)
    expect(first.manager.getTerminalRole(TOWER_ID)).toBe('tower') // T0565: unchanged
    expect(first.manager.getTowerContract(TOWER_ID)).toBe(2)
    expect(stored()).toEqual({ version: 1, towers: [] })
    const second = bat()
    internals(second.manager).handleReplayList([{ id: TOWER_ID, pid: 6060, cwd: CWD }])
    expect(second.manager.getTerminalRole(TOWER_ID)).toBeUndefined()
    expect(second.emitted).toEqual([])
  })

  it('the T0704 recovery rebuild before BAT closed → not restored', async () => {
    const first = await declaredBefore()
    const next = new FakeServer()
    first.manager.onRequestNewServer = async () => next as unknown as ChildProcess
    first.server.connected = false
    await internals(first.manager).handleServerDeath()
    expect(first.manager.getTerminalRole(TOWER_ID)).toBe('tower') // unchanged in this process
    expect(stored()).toEqual({ version: 1, towers: [] })
    internals(first.manager).handlePtyCreated(TOWER_ID, 7070)
    expect(stored()).toEqual({ version: 1, towers: [] })
    const second = bat()
    internals(second.manager).handleReplayList([{ id: TOWER_ID, pid: 7070, cwd: CWD }])
    expect(second.manager.getTerminalRole(TOWER_ID)).toBeUndefined()
  })

  it('the Tower PTY ended (tab closed / exit) → its entry goes', async () => {
    const first = await declaredBefore()
    internals(first.manager).instances.get(TOWER_ID)!.awaitingCreated = false
    internals(first.manager).handlePtyExit(TOWER_ID, 0)
    expect(stored()).toEqual({ version: 1, towers: [] })
  })

  it('a declaration made in this process before the settle wins over the stored one', async () => {
    await declaredBefore()
    const second = bat({ settleOnList: false })
    internals(second.manager).handleReplayList([{ id: TOWER_ID, pid: 4242, cwd: CWD }])
    const { deps } = roleDeps(second.manager)
    terminalRole.setTerminalRole({ terminalId: TOWER_ID, role: 'tower', mode: 'ask' }, deps)
    second.persistence.settle(() => true, 'Terminal Server PTY list')
    expect(second.manager.getTowerMode(TOWER_ID)).toBe('ask')
    expect(second.manager.getTowerContract(TOWER_ID)).toBeUndefined()
    expect(second.emitted).toEqual([])
    expect(second.logs).toContain('[tower-role] not restored: terminal=a1b2c3d4 (declared-since; Terminal Server PTY list)')
  })

  it('a later --set-role overwrites the restored declaration (and is what gets stored)', async () => {
    await declaredBefore()
    const second = bat()
    internals(second.manager).handleReplayList([{ id: TOWER_ID, pid: 4242, cwd: CWD }])
    const { deps, emitted } = roleDeps(second.manager)
    expect(terminalRole.setTerminalRole({ terminalId: TOWER_ID, role: 'tower', mode: 'on' }, deps)).toEqual({ ok: true, terminalId: TOWER_ID, role: 'tower', mode: 'on' })
    expect(second.manager.getTowerMode(TOWER_ID)).toBe('on')
    expect(second.manager.getTowerContract(TOWER_ID)).toBeUndefined()
    expect(second.manager.isYoloTerminal(TOWER_ID)).toBe(false)
    expect(emitted).toEqual([[terminalRole.ROLE_CHANGED_CHANNEL, { id: TOWER_ID, role: 'tower', towerContract: null, mode: 'on' }]])
    expect(stored()).toEqual({ version: 1, towers: [{ terminalId: TOWER_ID, pid: 4242, role: 'tower', mode: 'on', ptyAgent: 'claude-cli' }] })
  })

  it('the restored tab re-created by the renderer stays restored (idempotent pty:create)', async () => {
    await declaredBefore()
    const second = bat()
    internals(second.manager).handleReplayList([{ id: TOWER_ID, pid: 4242, cwd: CWD }])
    expect(second.manager.create({ id: TOWER_ID, ...TAB, agentPreset: 'claude-cli' })).toBe(true)
    expect(second.manager.getTowerContract(TOWER_ID)).toBe(2)
    expect(second.manager.getAgentPreset(TOWER_ID)).toBe('claude-cli')
  })

  it('nothing declared → no store entries, nothing restored, no events', async () => {
    const first = bat()
    first.manager.create({ id: 'plain', ...TAB })
    internals(first.manager).handlePtyCreated('plain', 5000)
    expect(fs.existsSync(storeFile)).toBe(false)
    const second = bat()
    internals(second.manager).handleReplayList([{ id: 'plain', pid: 5000, cwd: CWD }])
    expect(second.manager.getTerminalRole('plain')).toBeUndefined()
    expect(second.emitted).toEqual([])
    expect(second.persistence.roleChanges()).toEqual([])
  })
})

describe('main.ts wiring (T0949 source guard)', () => {
  const main = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf8')

  it('loads next to the claude sessions and settles on the PTY list / without a surviving server', () => {
    expect(main).toMatch(/loadClaudeSessions\(\) \/\/ T0642[^\n]*\n\s*loadTowerRoles\(\)/)
    expect(main).toContain("towerRolePersistence.settle(id => alive.has(id), 'Terminal Server PTY list')")
    expect(main).toContain("towerRolePersistence.settle(() => false, 'no surviving Terminal Server')")
  })

  it('persists on a declaration / pid change, a PTY exit and the recovery', () => {
    expect(main).toContain('onTowerRoleChange: () => towerRolePersistence.persist()')
    expect(main.match(/towerRolePersistence\.persist\(\)/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('a window that finished loading gets the Towers main knows', () => {
    expect(main).toMatch(/app\.on\('browser-window-created'[\s\S]{0,200}did-finish-load[\s\S]{0,200}towerRolePersistence\.roleChanges\(\)/)
  })
})
