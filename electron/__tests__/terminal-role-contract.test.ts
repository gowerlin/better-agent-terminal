// @vitest-environment node
/**
 * PLAN-068 W0 / T0903 (R11, BAT ↔ CT contract v2): `terminal:set-role { …, batContract? }` records the
 * contract a Tower declared on the PTY (electron/terminal-role.ts → PtyManager.setTerminalRole's 4th
 * argument, `getTowerContract`), for W1 / W2 / W3.
 *
 * - 1 / 2 / 3 recorded as requested; the answer carries `towerContract` + `batContract: 2` only for a
 *   call that declared it; 🔴 a call without it answers exactly as before (T0562 / T0565 shapes)
 * - every call overwrites it; a call without `batContract` clears it (mode is kept, as T0565)
 * - not a whole number ≥ 1 → INVALID_ARGS, nothing recorded, no event
 * - `terminal:role-changed` always carries `towerContract` (null = not declared)
 * - kept by ⏻ restart (node-pty and Terminal Server), the idempotent re-create and the recovery
 *   rebuild; gone when the PTY is killed or exits; only a Tower has one
 * - `getTerminalInfo` (helper queries) carries it for a Tower only
 * - `parseBatContract` / `towerContractStatus` (src/lib/tower-contract.ts)
 * The PtyManager runs against a fake node-pty (pattern of terminal-role-mode.test.ts).
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
import { BAT_CONTRACT_VERSION, parseBatContract, towerContractMismatch, towerContractStatus } from '../../src/lib/tower-contract'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { SetTerminalRoleDeps } from '../terminal-role'

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
let PtyManager: typeof PtyManagerType
let setTerminalRole: typeof import('../terminal-role').setTerminalRole

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
  ;({ setTerminalRole } = await import('../terminal-role'))
})

let dataDir: string
const managers: PtyManagerType[] = []

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
  // handleServerDeath clears the PTY registry in dataDir: never let it touch a shared dir
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0903-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function makeManager(): PtyManagerType {
  const manager = new PtyManager({ emit: vi.fn(), dataDir })
  managers.push(manager)
  return manager
}

function roleDeps(manager: PtyManagerType) {
  const emitted: Array<[string, unknown]> = []
  const deps: SetTerminalRoleDeps = {
    getPtyManager: () => manager,
    emit: (channel, payload) => { emitted.push([channel, payload]); return 1 },
    logger: { log: vi.fn() },
    isKnownAgent: () => false,
    agentName: () => undefined,
    mirrorToBatScripts: vi.fn(),
  }
  return { deps, emitted }
}

describe('parseBatContract / towerContractStatus (T0903)', () => {
  it('parseBatContract: whole numbers ≥ 1 (number or digit string, blanks trimmed); anything else → null', () => {
    expect(parseBatContract(2)).toBe(2)
    expect(parseBatContract(1)).toBe(1)
    expect(parseBatContract(' 02 ')).toBe(2)
    expect(parseBatContract('3')).toBe(3)
    for (const bad of [0, -1, 2.5, NaN, Infinity, '0', '-1', '2.5', '', '  ', 'two', '1e3', '0x2', null, undefined, true, [2], { n: 2 }, '99999999999999999999', Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseBatContract(bad)).toBeNull()
    }
  })

  it('towerContractStatus follows T0902 §6′ (the「分頁宣告」column)', () => {
    expect(BAT_CONTRACT_VERSION).toBe(2)
    expect(towerContractStatus('tower', 2)).toBe('match')
    expect(towerContractStatus('tower', null)).toBe('ct-outdated')
    expect(towerContractStatus('tower', undefined)).toBe('ct-outdated')
    expect(towerContractStatus('tower', 1)).toBe('ct-outdated')
    expect(towerContractStatus('tower', 3)).toBe('bat-outdated')
    expect(towerContractStatus('tower', 99)).toBe('bat-outdated')
    expect(towerContractStatus(undefined, 2)).toBe('not-tower')
    expect(towerContractStatus(null, null)).toBe('not-tower')
    expect(towerContractStatus('worker', 2)).toBe('not-tower')
    expect(towerContractMismatch('ct-outdated')).toBe(true)
    expect(towerContractMismatch('bat-outdated')).toBe(true)
    expect(towerContractMismatch('match')).toBe(false)
    expect(towerContractMismatch('not-tower')).toBe(false)
  })
})

describe('setTerminalRole records the BAT ↔ CT contract (T0903)', () => {
  it.each([[2, 2], [' 2 ', 2], [1, 1], [3, 3], ['10', 10]])('batContract %j → recorded %j; answer and event carry it', (given, recorded) => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    const { deps, emitted } = roleDeps(m)
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower', mode: 'yolo', batContract: given }, deps)).toEqual({
      ok: true, terminalId: 'tw', role: 'tower', mode: 'yolo', towerContract: recorded, batContract: 2,
    })
    expect(m.getTowerContract('tw')).toBe(recorded)
    expect(m.getTerminalInfo('tw')).toMatchObject({ role: 'tower', towerContract: recorded })
    expect(emitted).toEqual([['terminal:role-changed', { id: 'tw', role: 'tower', mode: 'yolo', towerContract: recorded }]])
    expect(deps.mirrorToBatScripts).toHaveBeenCalledWith('set-role', expect.objectContaining({ result: 'OK', towerContract: recorded }))
  })

  it('🔴 a call without batContract answers exactly as before (no contract fields); the event says null', () => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    const { deps, emitted } = roleDeps(m)
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower' }, deps)).toEqual({ ok: true, terminalId: 'tw', role: 'tower' })
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower', mode: 'ask' }, deps)).toEqual({ ok: true, terminalId: 'tw', role: 'tower', mode: 'ask' })
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower', batContract: null }, deps)).toEqual({ ok: true, terminalId: 'tw', role: 'tower', mode: 'ask' })
    expect(m.getTowerContract('tw')).toBeUndefined()
    expect(m.getTerminalInfo('tw')).not.toHaveProperty('towerContract')
    expect(emitted.map(([, p]) => (p as { towerContract: unknown }).towerContract)).toEqual([null, null, null])
  })

  it('every call overwrites it; one without batContract clears it (the mode is kept)', () => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    const { deps, emitted } = roleDeps(m)
    setTerminalRole({ terminalId: 'tw', role: 'tower', mode: 'yolo', batContract: 2 }, deps)
    expect(m.getTowerContract('tw')).toBe(2)
    setTerminalRole({ terminalId: 'tw', role: 'tower', mode: 'yolo', batContract: 3 }, deps)
    expect(m.getTowerContract('tw')).toBe(3)
    // CT went back to an older version: its --set-role has no --bat-contract
    setTerminalRole({ terminalId: 'tw', role: 'tower' }, deps)
    expect(m.getTowerContract('tw')).toBeUndefined()
    expect(m.getTowerMode('tw')).toBe('yolo')
    setTerminalRole({ terminalId: 'tw', role: 'tower', batContract: 2 }, deps)
    expect(m.getTowerContract('tw')).toBe(2)
    expect(emitted.map(([, p]) => (p as { towerContract: unknown }).towerContract)).toEqual([2, 3, null, 2])
  })

  it.each([[0], [-1], [2.5], ['two'], [''], ['  '], [true], [[2]], [{ v: 2 }], ['1e3']])('batContract %j → INVALID_ARGS, nothing recorded or cleared, no event', (batContract) => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    m.setTerminalRole('tw', 'tower', 'yolo', 2)
    const { deps, emitted } = roleDeps(m)
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower', batContract }, deps)).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(emitted).toEqual([])
    expect(m.getTowerContract('tw')).toBe(2)
  })

  it('no such PTY → NOT_FOUND, nothing recorded', () => {
    const m = makeManager()
    const { deps } = roleDeps(m)
    expect(setTerminalRole({ terminalId: 'gone', role: 'tower', batContract: 2 }, deps)).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(m.setTerminalRole('gone', 'tower', 'yolo', 2)).toBe(false)
    expect(m.getTowerContract('gone')).toBeUndefined()
  })

  it('only a Tower has one: a plain tab and a Worker answer undefined, getTerminalInfo has no field', () => {
    const m = makeManager()
    m.create({ id: 'plain', ...TAB })
    m.create({ id: 'worker', ...TAB, customEnv: { BAT_TOWER_TERMINAL_ID: 'tw', CT_MODE: 'yolo' }, workorder: 'T0903' })
    expect(m.getTowerContract('plain')).toBeUndefined()
    expect(m.getTowerContract('worker')).toBeUndefined()
    expect(m.getTerminalInfo('plain')).not.toHaveProperty('towerContract')
    expect(m.getTerminalInfo('worker')).not.toHaveProperty('towerContract')
  })
})

describe('the recorded contract across the PTY lifecycle (T0903)', () => {
  it('⏻ restart keeps it (node-pty); kill removes it; a new PTY with the same id starts without it', () => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    m.setTerminalRole('tw', 'tower', 'yolo', 2)
    expect(m.restart('tw', CWD, '/bin/sh')).toBe(true)
    expect(ptySpawn).toHaveBeenCalledTimes(2)
    expect(m.getTowerContract('tw')).toBe(2)
    expect(m.getTowerMode('tw')).toBe('yolo')
    m.kill('tw')
    expect(m.getTowerContract('tw')).toBeUndefined()
    m.create({ id: 'tw', ...TAB })
    expect(m.getTowerContract('tw')).toBeUndefined()
  })

  it('restart of a Tower that declared no contract keeps none', () => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    m.setTerminalRole('tw', 'tower', 'ask')
    expect(m.restart('tw', CWD, '/bin/sh')).toBe(true)
    expect(m.getTerminalRole('tw')).toBe('tower')
    expect(m.getTowerContract('tw')).toBeUndefined()
  })

  it('the PTY exiting on its own removes it', () => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    m.setTerminalRole('tw', 'tower', 'yolo', 3)
    const pty = ptySpawn.mock.results[0].value as FakePty
    const onExit = pty.onExit.mock.calls[0][0] as (e: { exitCode: number }) => void
    onExit({ exitCode: 0 })
    expect(m.isAlive('tw')).toBe(false)
    expect(m.getTowerContract('tw')).toBeUndefined()
  })

  it('Terminal Server: restart, the idempotent re-create and the recovery rebuild keep it; exit removes it', async () => {
    const m = makeManager()
    const server = new FakeServer()
    m.setServerProcess(server as unknown as ChildProcess)
    m.create({ id: 'tw', ...TAB })
    m.setTerminalRole('tw', 'tower', 'yolo', 2)
    m.create({ id: 'v3', ...TAB })
    m.setTerminalRole('v3', 'tower', 'ask', 3)
    m.create({ id: 'v1', ...TAB })
    m.setTerminalRole('v1', 'tower', 'ask')

    expect(m.restart('tw', CWD, '/bin/sh')).toBe(true)
    expect(m.getTowerContract('tw')).toBe(2)

    expect(m.create({ id: 'tw', ...TAB })).toBe(true)
    expect(m.getTowerContract('tw')).toBe(2)

    const next = new FakeServer()
    m.onRequestNewServer = async () => next as unknown as ChildProcess
    server.connected = false
    await (m as unknown as { handleServerDeath(): Promise<void> }).handleServerDeath()
    expect(next.sent.filter(msg => msg.type === 'pty:create').map(msg => msg.id).sort()).toEqual(['tw', 'v1', 'v3'])
    expect(m.getTowerContract('tw')).toBe(2)
    expect(m.getTowerContract('v3')).toBe(3)
    expect(m.getTowerContract('v1')).toBeUndefined()

    const internals = m as unknown as { handlePtyExit(id: string, code: number): void; instances: Map<string, { awaitingCreated?: boolean }> }
    internals.instances.get('tw')!.awaitingCreated = false
    internals.handlePtyExit('tw', 0)
    expect(m.getTowerContract('tw')).toBeUndefined()
    expect(m.getTowerContract('v3')).toBe(3)
  })
})
