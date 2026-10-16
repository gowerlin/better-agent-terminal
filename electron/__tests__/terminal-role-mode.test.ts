// @vitest-environment node
/**
 * T0565 / D148: `terminal:set-role { terminalId, role, mode? }` records the Tower's CT mode on
 * the PTY (electron/terminal-role.ts → PtyManager.setTerminalRole), for PLAN-044 (T0566).
 *
 * - mode recorded (trimmed / any case), updated (ask → yolo), kept when a request has no mode;
 *   result and `terminal:role-changed` carry the recorded mode; an unknown mode → INVALID_ARGS,
 *   nothing recorded, no event
 * - kept by restart (node-pty and Terminal Server), the idempotent re-create and the recovery
 *   rebuild; gone when the PTY is killed or exits
 * - isYoloTerminal: Tower yolo / Tower ask / Tower without mode / Worker CT_MODE=yolo / Worker
 *   CT_MODE=ask / a plain tab / no such PTY
 * The PtyManager runs against a fake node-pty (pattern of close-worker.test.ts).
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
import { normalizeCtMode } from '../ct-mode'
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
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0565-pty-'))
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

describe('normalizeCtMode (T0565)', () => {
  it('trimmed, case-insensitive; anything else → null', () => {
    expect(normalizeCtMode('yolo')).toBe('yolo')
    expect(normalizeCtMode(' ASK ')).toBe('ask')
    expect(normalizeCtMode('Off')).toBe('off')
    expect(normalizeCtMode('on')).toBe('on')
    expect(normalizeCtMode('auto')).toBeNull()
    expect(normalizeCtMode('')).toBeNull()
    expect(normalizeCtMode(1)).toBeNull()
  })
})

describe('setTerminalRole records the mode (T0565)', () => {
  it('records, updates (ask → yolo) and keeps it when a request has no mode', () => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    const { deps, emitted } = roleDeps(m)

    expect(setTerminalRole({ terminalId: 'tw', role: 'tower', mode: ' ASK ' }, deps)).toEqual({ ok: true, terminalId: 'tw', role: 'tower', mode: 'ask' })
    expect(m.getTerminalRole('tw')).toBe('tower')
    expect(m.getTowerMode('tw')).toBe('ask')
    expect(m.isYoloTerminal('tw')).toBe(false)

    expect(setTerminalRole({ terminalId: 'tw', role: 'tower', mode: 'yolo' }, deps)).toEqual({ ok: true, terminalId: 'tw', role: 'tower', mode: 'yolo' })
    expect(m.getTowerMode('tw')).toBe('yolo')
    expect(m.isYoloTerminal('tw')).toBe(true)

    // CT always passes --mode; a request without it does not clear the recorded one
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower' }, deps)).toEqual({ ok: true, terminalId: 'tw', role: 'tower', mode: 'yolo' })
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower', mode: null }, deps)).toMatchObject({ ok: true, mode: 'yolo' })
    expect(m.getTowerMode('tw')).toBe('yolo')

    expect(emitted.map(([channel, p]) => [channel, (p as { mode?: string }).mode])).toEqual([
      ['terminal:role-changed', 'ask'],
      ['terminal:role-changed', 'yolo'],
      ['terminal:role-changed', 'yolo'],
      ['terminal:role-changed', 'yolo'],
    ])
    expect(deps.mirrorToBatScripts).toHaveBeenCalledWith('set-role', expect.objectContaining({ result: 'OK', mode: 'yolo' }))
  })

  it('without any mode: result and event as in T0562 (no mode field), role still recorded', () => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    const { deps, emitted } = roleDeps(m)
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower' }, deps)).toEqual({ ok: true, terminalId: 'tw', role: 'tower' })
    expect(emitted).toEqual([['terminal:role-changed', { id: 'tw', role: 'tower' }]])
    expect(m.getTerminalRole('tw')).toBe('tower')
    expect(m.getTowerMode('tw')).toBeUndefined()
    expect(m.isYoloTerminal('tw')).toBe(false)
  })

  it.each([['auto'], [''], ['  '], [42], [['yolo']]])('mode %j → INVALID_ARGS, nothing recorded, no event', (mode) => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    const { deps, emitted } = roleDeps(m)
    expect(setTerminalRole({ terminalId: 'tw', role: 'tower', mode }, deps)).toEqual({ ok: false, code: 'INVALID_ARGS' })
    expect(emitted).toEqual([])
    expect(m.getTerminalRole('tw')).toBeUndefined()
  })

  it('no such PTY → NOT_FOUND, nothing recorded', () => {
    const m = makeManager()
    const { deps } = roleDeps(m)
    expect(setTerminalRole({ terminalId: 'gone', role: 'tower', mode: 'yolo' }, deps)).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(m.setTerminalRole('gone', 'tower', 'yolo')).toBe(false)
    expect(m.isYoloTerminal('gone')).toBe(false)
  })
})

describe('PtyManager.isYoloTerminal (T0565)', () => {
  it('Tower yolo / Tower ask / Tower without mode / Worker CT_MODE / plain tab / no PTY', () => {
    const m = makeManager()
    m.create({ id: 'tower-yolo', ...TAB })
    m.create({ id: 'tower-ask', ...TAB })
    m.create({ id: 'tower-none', ...TAB })
    m.create({ id: 'worker-yolo', ...TAB, customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-yolo', CT_MODE: 'yolo' }, workorder: 'T0565' })
    m.create({ id: 'worker-ask', ...TAB, customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-yolo', CT_MODE: 'ask' }, workorder: 'T0566' })
    m.create({ id: 'plain', ...TAB })
    m.setTerminalRole('tower-yolo', 'tower', 'yolo')
    m.setTerminalRole('tower-ask', 'tower', 'ask')
    m.setTerminalRole('tower-none', 'tower')

    expect(m.isYoloTerminal('tower-yolo')).toBe(true)
    expect(m.isYoloTerminal('tower-ask')).toBe(false)
    expect(m.isYoloTerminal('tower-none')).toBe(false)
    expect(m.isYoloTerminal('worker-yolo')).toBe(true)
    expect(m.isYoloTerminal('worker-ask')).toBe(false)
    expect(m.isYoloTerminal('plain')).toBe(false)
    expect(m.isYoloTerminal('no-such-pty')).toBe(false)
    // a Worker is not a Tower: no Tower mode
    expect(m.getTowerMode('worker-yolo')).toBeUndefined()
    expect(m.getTerminalRole('plain')).toBeUndefined()
  })
})

describe('the recorded role / mode across the PTY lifecycle (T0565)', () => {
  it('restart keeps it (node-pty); kill removes it', () => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    m.setTerminalRole('tw', 'tower', 'yolo')
    expect(m.restart('tw', CWD, '/bin/sh')).toBe(true)
    expect(ptySpawn).toHaveBeenCalledTimes(2)
    expect(m.getTowerMode('tw')).toBe('yolo')
    expect(m.isYoloTerminal('tw')).toBe(true)
    m.kill('tw')
    expect(m.getTerminalRole('tw')).toBeUndefined()
    expect(m.isYoloTerminal('tw')).toBe(false)
    // a new PTY with the same id starts without a role
    m.create({ id: 'tw', ...TAB })
    expect(m.getTerminalRole('tw')).toBeUndefined()
  })

  it('the PTY exiting on its own removes it', () => {
    const m = makeManager()
    m.create({ id: 'tw', ...TAB })
    m.setTerminalRole('tw', 'tower', 'yolo')
    const pty = ptySpawn.mock.results[0].value as FakePty
    const onExit = pty.onExit.mock.calls[0][0] as (e: { exitCode: number }) => void
    onExit({ exitCode: 0 })
    expect(m.isAlive('tw')).toBe(false)
    expect(m.isYoloTerminal('tw')).toBe(false)
  })

  it('Terminal Server: restart, the idempotent re-create and the recovery rebuild keep it; exit removes it', async () => {
    const m = makeManager()
    const server = new FakeServer()
    m.setServerProcess(server as unknown as ChildProcess)
    m.create({ id: 'tw', ...TAB })
    m.setTerminalRole('tw', 'tower', 'yolo')
    m.create({ id: 'ask', ...TAB })
    m.setTerminalRole('ask', 'tower', 'ask')

    expect(m.restart('tw', CWD, '/bin/sh')).toBe(true)
    expect(m.getTowerMode('tw')).toBe('yolo')

    // View → Reload: the renderer re-sends pty:create for the running id (idempotent skip)
    expect(m.create({ id: 'tw', ...TAB })).toBe(true)
    expect(m.getTowerMode('tw')).toBe('yolo')

    const next = new FakeServer()
    m.onRequestNewServer = async () => next as unknown as ChildProcess
    server.connected = false
    await (m as unknown as { handleServerDeath(): Promise<void> }).handleServerDeath()
    expect(next.sent.filter(msg => msg.type === 'pty:create').map(msg => msg.id).sort()).toEqual(['ask', 'tw'])
    expect(m.getTowerMode('tw')).toBe('yolo')
    expect(m.isYoloTerminal('tw')).toBe(true)
    expect(m.getTowerMode('ask')).toBe('ask')

    // the server reports the PTY exited (after confirming it was created)
    const internals = m as unknown as { handlePtyExit(id: string, code: number): void; instances: Map<string, { awaitingCreated?: boolean }> }
    internals.instances.get('tw')!.awaitingCreated = false
    internals.handlePtyExit('tw', 0)
    expect(m.isYoloTerminal('tw')).toBe(false)
    expect(m.getTowerMode('ask')).toBe('ask')
  })
})
