// @vitest-environment node
/**
 * PLAN-064 / T0827: the Linux fontconfig check (fake execFile here): fc-list args / timeout, every way a run
 * can end, the startup schedule, one hint per BAT start, IPC — and that nothing spawns off Linux.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn) },
}))
vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import {
  createLinuxFontCheck,
  LINUX_FONT_CHECK_DELAY_MS,
  LINUX_FONT_CHECK_TIMEOUT_MS,
  registerLinuxFontCheckHandlers,
  type FcListExecFile,
  type LinuxFontCheckDeps,
} from '../linux-font-check'
import { FC_LIST_QUERIES, LINUX_FONT_CHECK_IPC } from '../../src/lib/linux-font-hint'

type Cb = Parameters<FcListExecFile>[3]
type ExecError = Parameters<Cb>[0]
interface Call { file: string; args: string[]; options: Parameters<FcListExecFile>[2]; cb: Cb }

function fakeExec(): { exec: FcListExecFile; calls: Call[] } {
  const calls: Call[] = []
  const exec: FcListExecFile = (file, args, options, cb) => { calls.push({ file, args, options, cb }); return {} }
  return { exec, calls }
}
const err = (props: Partial<NonNullable<ExecError>>): ExecError => Object.assign(new Error('fc-list failed'), props)

function setup(overrides: Partial<LinuxFontCheckDeps> = {}) {
  const { exec, calls } = fakeExec()
  const logs: string[] = []
  const timers: Array<{ fn: () => void; ms: number }> = []
  let clock = 1000
  const controller = createLinuxFontCheck({
    platform: 'linux',
    execFile: exec,
    now: () => clock,
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return {} },
    log: l => logs.push(l),
    ...overrides,
  })
  const answer = (cjk: { error?: ExecError; stdout?: string }, emoji: { error?: ExecError; stdout?: string }) => {
    clock += 42
    calls[0].cb(cjk.error ?? null, cjk.stdout ?? '', '')
    calls[1].cb(emoji.error ?? null, emoji.stdout ?? '', '')
  }
  return { controller, calls, logs, timers, answer }
}

beforeEach(() => handlers.clear())

describe('Linux: fc-list runs', () => {
  it('runs the two queries with execFile, array args and a ≤ 5 s timeout (no shell)', async () => {
    const { controller, calls, answer } = setup()
    const p = controller.check()
    expect(calls).toHaveLength(2)
    expect(calls.map(c => c.file)).toEqual(['fc-list', 'fc-list'])
    expect(calls[0].args).toEqual([...FC_LIST_QUERIES.cjk])
    expect(calls[1].args).toEqual([...FC_LIST_QUERIES.emoji])
    expect(FC_LIST_QUERIES.cjk).toEqual([':lang=zh', 'family'])
    expect(FC_LIST_QUERIES.emoji).toEqual([':charset=1f4e8', 'family'])
    for (const c of calls) {
      expect(c.options.timeout).toBe(LINUX_FONT_CHECK_TIMEOUT_MS)
      expect(c.options).not.toHaveProperty('shell')
    }
    expect(LINUX_FONT_CHECK_TIMEOUT_MS).toBeLessThanOrEqual(5000)
    answer({ stdout: 'Noto Sans CJK TC\nNoto Sans CJK SC\n' }, { stdout: 'Noto Color Emoji\n' })
    await expect(p).resolves.toEqual({ state: 'ok', cjkFamilies: 2, emojiFamilies: 1 })
  })

  it('missing fonts: empty output (exit 0) = none installed, each flag on its own', async () => {
    const a = setup()
    const p1 = a.controller.check()
    a.answer({ stdout: '' }, { stdout: '' })
    await expect(p1).resolves.toMatchObject({ state: 'missing', cjk: true, emoji: true })
    expect(a.logs).toEqual(['[font-check] missing cjk=true emoji=true in 42 ms (cjk faces=0, emoji faces=0)'])

    const b = setup()
    const p2 = b.controller.check()
    b.answer({ stdout: 'Noto Sans CJK TC\n' }, { stdout: '\n' })
    await expect(p2).resolves.toMatchObject({ state: 'missing', cjk: false, emoji: true })
  })

  it('no fc-list (ENOENT) → unknown(no-fc-list)', async () => {
    const { controller, answer, logs } = setup()
    const p = controller.check()
    answer({ error: err({ code: 'ENOENT' }) }, { error: err({ code: 'ENOENT' }) })
    await expect(p).resolves.toEqual({ state: 'unknown', reason: 'no-fc-list' })
    expect(logs).toEqual(['[font-check] unknown(no-fc-list) in 42 ms'])
  })

  it('killed by the timeout → unknown(timeout), even if the other run answered', async () => {
    const { controller, answer } = setup()
    const p = controller.check()
    answer({ error: err({ killed: true, signal: 'SIGTERM', code: null }) }, { stdout: 'Noto Color Emoji\n' })
    await expect(p).resolves.toEqual({ state: 'unknown', reason: 'timeout' })
  })

  it('exit ≠ 0, other spawn errors, oversized output → unknown(failed)', async () => {
    const a = setup()
    const p1 = a.controller.check()
    a.answer({ stdout: 'x\n' }, { error: err({ code: 1 }), stdout: '' })
    await expect(p1).resolves.toMatchObject({ state: 'unknown', reason: 'failed', detail: 'exit 1' })

    const b = setup()
    const p2 = b.controller.check()
    b.answer({ error: err({ code: 'EACCES' }) }, { stdout: '' })
    await expect(p2).resolves.toMatchObject({ state: 'unknown', reason: 'failed' })

    const c = setup()
    const p3 = c.controller.check()
    c.answer({ error: err({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }) }, { stdout: '' })
    await expect(p3).resolves.toMatchObject({ state: 'unknown', reason: 'failed' })
  })

  it('execFile throwing synchronously → unknown(failed)', async () => {
    const { controller } = setup({ execFile: () => { throw new Error('boom') } })
    await expect(controller.check()).resolves.toMatchObject({ state: 'unknown', reason: 'failed' })
  })

  it('the log line never contains the font list', async () => {
    const { controller, answer, logs } = setup()
    const p = controller.check()
    answer({ stdout: 'Secret Family A\nSecret Family B\n' }, { stdout: 'Noto Color Emoji\n' })
    await p
    expect(logs.join('\n')).not.toMatch(/Secret Family|Noto Color Emoji/)
    expect(logs).toEqual(['[font-check] ok in 42 ms (cjk faces=2, emoji faces=1)'])
  })

  it('schedules once, delayed after startup; a running check is shared', async () => {
    const { controller, calls, timers } = setup()
    expect(controller.get()).toEqual({ state: 'unknown', reason: 'pending' })
    controller.schedule()
    controller.schedule()
    expect(timers).toHaveLength(1)
    expect(timers[0].ms).toBe(LINUX_FONT_CHECK_DELAY_MS)
    expect(calls).toHaveLength(0)
    timers[0].fn()
    expect(calls).toHaveLength(2)
    void controller.check()
    expect(calls).toHaveLength(2)
  })

  it('claimHint: true once, then false', () => {
    const { controller } = setup()
    expect(controller.claimHint()).toBe(true)
    expect(controller.claimHint()).toBe(false)
  })
})

describe('not Linux: nothing spawns, nothing logs, unknown(not-linux)', () => {
  for (const platform of ['win32', 'darwin']) {
    it(platform, async () => {
      const { controller, calls, logs, timers } = setup({ platform })
      expect(controller.get()).toEqual({ state: 'unknown', reason: 'not-linux' })
      controller.schedule()
      expect(timers).toHaveLength(0)
      await expect(controller.check()).resolves.toEqual({ state: 'unknown', reason: 'not-linux' })
      expect(calls).toHaveLength(0)
      expect(controller.claimHint()).toBe(false)
      expect(logs).toEqual([])
    })
  }
})

describe('IPC (local ipcMain.handle)', () => {
  it('registers get / claim-hint and pushes changes to every live window', async () => {
    const sent: Array<[string, unknown]> = []
    const win = { isDestroyed: () => false, webContents: { send: (ch: string, v: unknown) => sent.push([ch, v]) } }
    const gone = { isDestroyed: () => true, webContents: { send: () => { throw new Error('destroyed') } } }
    registerLinuxFontCheckHandlers(() => [win, gone] as never)
    expect([...handlers.keys()].sort()).toEqual([LINUX_FONT_CHECK_IPC.claimHint, LINUX_FONT_CHECK_IPC.get].sort())
    // the process controller of this test host (not Linux on Windows CI) answers unknown(not-linux)
    const got = await handlers.get(LINUX_FONT_CHECK_IPC.get)!()
    expect(got).toMatchObject({ state: 'unknown' })
    expect(sent).toEqual([])
  })

  it('main.ts registers the handlers and starts the check after the voice check (inside whenReady)', () => {
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    const voice = main.indexOf('startVoiceAvailabilityCheck()\n')
    const register = main.indexOf('registerLinuxFontCheckHandlers(getAllWindows)')
    const start = main.indexOf('startLinuxFontCheck()')
    expect(voice).toBeGreaterThan(0)
    expect(register).toBeGreaterThan(voice)
    expect(start).toBeGreaterThan(register)
    expect(main.indexOf('app.whenReady().then(')).toBeGreaterThan(0)
    expect(main.indexOf('app.whenReady().then(')).toBeLessThan(voice)
  })

  it('the module runs nothing at import time', () => {
    const src = readFileSync(join(__dirname, '..', 'linux-font-check.ts'), 'utf8')
    const topLevelCalls = src.split('\n').filter(l => /^(startLinuxFontCheck|getLinuxFontCheck|execFile)\(/.test(l))
    expect(topLevelCalls).toEqual([])
  })
})
