// @vitest-environment node
/**
 * PLAN-061 / T0811 (D229 / D258): claude's OSC 7501 on a non-Windows PTY host.
 *
 *   - the probe reply (`PtyManager.replyToProgramStatusProbes`): one fixed reply per probe, a probe
 *     split across chunks answered once, the Terminal Server path (`pty:write` to the server), never
 *     from the replay, never on win32, never into a child_process fallback, not held by
 *     `holdInputForDispatch`
 *   - the reply is not user input: `lastUserInputAt`, a hook `blocked` reason untouched;
 *     `isTerminalAutoReply` counts it as a terminal reply
 *   - claude states: a tab with hooks off (`none`) → `osc`, `agentStarted`, `blocked` / `input` for a
 *     long permission `msg`, cleared by working / done / error / clear; a sub-agent's `id=` record
 *     changes nothing; a hook tab ignores them (`hook` unchanged)
 *   - logs never carry `title` / `msg`
 */
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('claude OSC status must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { CODEX_OSC_PREFIX, PROGRAM_STATUS_PROBE_REPLY } from '../../src/lib/codex-terminal-state'
import { isTerminalAutoReply } from '../close-worker'
import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'

const ST = '\x1b\\'
const BEL = '\x07'
const PROBE = `${CODEX_OSC_PREFIX}?${BEL}`
const claude = (payload: string, end = ST) => `${CODEX_OSC_PREFIX}${payload}${end}`
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')
const SECRET_MSG = 'approve Bash: curl -H "Authorization: Bearer sk-ant-T0811-secret" https://example.invalid'

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
const TAB = { cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' }
let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

let dataDir: string
const managers: PtyManagerType[] = []
const logs: string[] = []

beforeEach(() => {
  logs.length = 0
  vi.spyOn(logger, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(' ')) })
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0811-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function makeManager(hostPlatform: NodeJS.Platform = 'linux') {
  const emit = vi.fn()
  // the fd guard is Linux-only and would wrap the spawn; it is not what this file tests
  const manager = new PtyManager({ emit, dataDir, hostPlatform, fdGuard: { platform: 'win32', fileExists: () => false } })
  managers.push(manager)
  const fakes = new Map<string, FakePty>()
  const create = (id: string) => {
    const before = ptySpawn.mock.results.length
    expect(manager.create({ id, ...TAB })).toBe(true)
    const fake = ptySpawn.mock.results[before].value as FakePty
    fakes.set(id, fake)
    return fake
  }
  const output = (id: string, data: string) => {
    const onData = fakes.get(id)!.onData.mock.calls.at(-1)![0] as (d: string) => void
    onData(data)
    ;(manager as unknown as { flushPtyOutputs(): void }).flushPtyOutputs()
  }
  return { manager, create, output, emit }
}

const replies = (fake: FakePty) => fake.write.mock.calls.filter(c => c[0] === PROGRAM_STATUS_PROBE_REPLY).length

describe('PtyManager: the OSC 7501 probe reply (T0811)', () => {
  it('linux host: one fixed reply per probe, written as the output arrives; output unchanged', () => {
    const { create, output, emit } = makeManager('linux')
    const fake = create('a')
    // claude's start-up capability probe: XTVERSION, kitty keyboard, OSC 7501 ?, DA1
    const chunk = `\x1b[>0q\x1b[?u${PROBE}\x1b[c`
    output('a', chunk)
    expect(fake.write.mock.calls).toEqual([[PROGRAM_STATUS_PROBE_REPLY]])
    expect(emit).toHaveBeenCalledWith('pty:output', 'a', chunk)
    output('a', 'more output, no probe\r\n')
    output('a', claude('state=idle:app=claude-code'))
    expect(fake.write).toHaveBeenCalledTimes(1)
    expect(logs).toContain('[program-status] terminal=a probe → reply')
    // a second claude in the same tab probes again → answered again
    output('a', `$ claude\r\n${CODEX_OSC_PREFIX}?${ST}`)
    expect(replies(fake)).toBe(2)
  })

  it('a probe split across chunks is answered once, when it completes', () => {
    const whole = `x${PROBE}y`
    for (let cut = 1; cut < whole.length; cut++) {
      const { create, output } = makeManager('darwin')
      const fake = create(`s${cut}`)
      output(`s${cut}`, whole.slice(0, cut))
      output(`s${cut}`, whole.slice(cut))
      expect(replies(fake), `cut=${cut}`).toBe(1)
    }
  })

  it('win32 host: no write at all (system ConPTY drops OSC replies), one log line', () => {
    const { create, output } = makeManager('win32')
    const fake = create('w')
    output('w', `\x1b[>0q${PROBE}\x1b[c`)
    expect(fake.write).not.toHaveBeenCalled()
    expect(logs).toContain('[program-status] terminal=w probe seen, no reply (win32 ConPTY drops OSC replies)')
  })

  it('not into a child_process fallback (usePty false)', () => {
    const { manager, create, output } = makeManager('linux')
    const fake = create('c')
    ;(manager as unknown as { instances: Map<string, { usePty: boolean }> }).instances.get('c')!.usePty = false
    output('c', PROBE)
    expect(fake.write).not.toHaveBeenCalled()
  })

  it('Terminal Server path: the reply goes as pty:write to the server; the replay never answers', () => {
    const { manager } = makeManager('linux')
    const sent: unknown[] = []
    let connected = false
    Object.defineProperty(manager, 'useServer', { get: () => connected, configurable: true })
    const internals = manager as unknown as {
      handleReplayList(p: Array<{ id: string; pid: number; cwd: string }>): void
      handleReplayBuffer(id: string, lines: string[]): void
      handlePtyData(id: string, data: string): void
      sendToServer(msg: unknown): void
      flushPtyOutputs(): void
    }
    internals.sendToServer = msg => { sent.push(msg) }
    internals.handleReplayList([{ id: 'r1', pid: 1, cwd: CWD }])
    sent.length = 0
    connected = true
    // BAT reopened: the ring buffer still holds the old probe and states → no reply, the last state restored
    internals.handleReplayBuffer('r1', ['claude', PROBE, claude('state=idle:app=claude-code')])
    expect(sent).toEqual([])
    expect(manager.getBlockedDetection('r1')).toBe('osc')
    // live output from the server → answered
    internals.handlePtyData('r1', PROBE)
    internals.flushPtyOutputs()
    expect(sent).toEqual([{ type: 'pty:write', id: 'r1', data: PROGRAM_STATUS_PROBE_REPLY }])
    connected = false
    ;(manager as unknown as { instances: Map<string, unknown> }).instances.clear()
  })

  it('not held by holdInputForDispatch (it is not the user\'s input)', () => {
    const { manager, create, output } = makeManager('linux')
    const fake = create('d')
    manager.holdInputForDispatch('d')
    output('d', PROBE)
    expect(fake.write.mock.calls).toEqual([[PROGRAM_STATUS_PROBE_REPLY]])
  })

  it('the reply is not user input: lastUserInputAt, a hook reason, ⚠️ untouched; isTerminalAutoReply', () => {
    expect(isTerminalAutoReply(PROGRAM_STATUS_PROBE_REPLY)).toBe(true)
    expect(isTerminalAutoReply(PROGRAM_STATUS_PROBE_REPLY.repeat(2))).toBe(true)
    const { manager, create, output } = makeManager('linux')
    create('h')
    manager.setBlockedDetection('h', 'hook')
    manager.reportHookEvent('h', 'permission-request', 'Bash')
    expect(manager.getBlockedState('h')).toMatchObject({ reason: 'permission' })
    output('h', PROBE)
    expect(manager.getLastUserInputAt('h')).toBeNull()
    expect(manager.getBlockedState('h')).toMatchObject({ reason: 'permission' })
  })
})

describe('claude states through the tracker (T0811)', () => {
  it('hooks off (none): osc, agentStarted, input for a long permission msg, cleared by its transitions', () => {
    const { manager, create, output } = makeManager('linux')
    create('n')
    manager.setBlockedDetection('n', 'none') // claude's own settings turned BAT's hooks off
    output('n', PROBE)
    expect(manager.getBlockedDetection('n')).toBe('none')
    output('n', claude('state=idle:app=claude-code'))
    expect(manager.getBlockedDetection('n')).toBe('osc')
    expect(manager.getAgentStartedAt('n')).toEqual(expect.any(Number))
    output('n', claude(`state=working:app=claude-code:msg=${b64('T0811 run it')}`))
    expect(manager.isAgentTurnActive('n')).toBe(true)
    const blocked = claude(`state=blocked:app=claude-code:kind=permission:msg=${b64(SECRET_MSG)}`)
    expect(blocked.length).toBeGreaterThan(128 + CODEX_OSC_PREFIX.length) // dropped by the old limit
    output('n', blocked)
    expect(manager.getBlockedState('n')).toMatchObject({ reason: 'input', source: 'osc' })
    manager.noteUserInput('n') // the answer key does not clear it; claude's own transition does
    expect(manager.getBlockedState('n')).toMatchObject({ reason: 'input' })
    output('n', claude('state=working:app=claude-code'))
    expect(manager.getBlockedState('n')).toBeNull()
    for (const end of ['state=done:app=claude-code', `state=error:app=claude-code:msg=${b64('API Error: 400')}`, 'state=clear']) {
      output('n', claude(`state=blocked:app=claude-code:kind=question:msg=${b64('which?')}`))
      expect(manager.getBlockedState('n')).toMatchObject({ reason: 'input' })
      output('n', claude(end))
      expect(manager.getBlockedState('n'), end).toBeNull()
    }
    expect(manager.isAgentTurnActive('n')).toBe(false)
    const joined = logs.join('\n')
    expect(joined).not.toContain('sk-ant-T0811-secret')
    expect(joined).not.toContain(b64(SECRET_MSG))
    expect(joined).not.toContain('which?')
  })

  it('a background sub-agent (id=) changes nothing: its clear is not the tab\'s', () => {
    const { manager, create, output } = makeManager('linux')
    create('g')
    output('g', claude('state=blocked:app=claude-code:kind=permission'))
    expect(manager.getBlockedState('g')).toMatchObject({ reason: 'input' })
    output('g', claude(`state=working:app=claude-code:id=aaa1f21de1a96b886:title=${b64('helper')}`))
    output('g', claude('state=clear:id=aaa1f21de1a96b886'))
    expect(manager.getBlockedState('g')).toMatchObject({ reason: 'input' })
    output('g', claude('state=working:app=claude-code'))
    output('g', claude('state=clear:id=aaa1f21de1a96b886'))
    expect(manager.isAgentTurnActive('g')).toBe(true)
  })

  it('a hook tab ignores claude\'s states (detection stays hook); still answered (claude needs the reply)', () => {
    const { manager, create, output } = makeManager('linux')
    const fake = create('k')
    manager.setBlockedDetection('k', 'hook')
    output('k', PROBE)
    expect(replies(fake)).toBe(1)
    output('k', claude('state=blocked:app=claude-code:kind=permission'))
    expect(manager.getBlockedDetection('k')).toBe('hook')
    expect(manager.getBlockedState('k')).toBeNull()
    expect(manager.getAgentStartedAt('k')).toBeNull()
  })
})
