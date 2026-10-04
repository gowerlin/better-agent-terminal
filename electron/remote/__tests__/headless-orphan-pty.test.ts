// @vitest-environment node
/**
 * T0404 (PLAN-036): headless orphan PTY reclaim + per-server PTY cap.
 *
 * Pure units:
 *   - HeadlessOrphanPtyReclaimer on fake timers: no client for the idle limit ⇒ kill all;
 *     a reconnect within it cancels; with a client connected it never arms.
 *   - resolveHeadlessPtyLimits: defaults (24h / 64), option > env > default, invalid env.
 * Wire-level through the T0388 harness (real RemoteServer client count + real node-pty):
 *   - the last client leaving for the idle limit reclaims the PTY; a client staying keeps it
 *   - the PTY cap answers an explicit invoke-error, running PTYs survive, kill frees a slot
 */
import * as fs from 'fs'
import * as os from 'os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HEADLESS_MAX_PTYS_DEFAULT,
  HEADLESS_MAX_PTYS_ENV,
  HEADLESS_PTY_IDLE_HOURS_ENV,
  HEADLESS_PTY_IDLE_RECLAIM_DEFAULT_MS,
  HeadlessOrphanPtyReclaimer,
  resolveHeadlessPtyLimits,
} from '../headless-entry'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

describe('HeadlessOrphanPtyReclaimer (fake timers)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function makeReclaimer(idleMs = DAY) {
    vi.useFakeTimers()
    const reclaim = vi.fn(() => 3)
    const log = vi.fn()
    return { reclaimer: new HeadlessOrphanPtyReclaimer({ idleMs, reclaim, log }), reclaim, log }
  }

  it('no client for the idle limit ⇒ kills every PTY once and logs it', () => {
    const { reclaimer, reclaim, log } = makeReclaimer()
    reclaimer.update(0)
    expect(reclaimer.armed).toBe(true)
    vi.advanceTimersByTime(DAY - 1)
    expect(reclaim).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(reclaim).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/no authenticated client for 24h — reclaimed 3 orphan PTY\(s\)/))
    expect(reclaimer.armed).toBe(false)
    vi.advanceTimersByTime(3 * DAY)
    expect(reclaim).toHaveBeenCalledTimes(1)
  })

  it('a client reconnecting within the limit cancels the countdown; leaving again restarts it from zero', () => {
    const { reclaimer, reclaim } = makeReclaimer()
    reclaimer.update(0)
    vi.advanceTimersByTime(23 * HOUR)
    reclaimer.update(1)
    expect(reclaimer.armed).toBe(false)
    vi.advanceTimersByTime(2 * DAY)
    expect(reclaim).not.toHaveBeenCalled()

    reclaimer.update(0)
    vi.advanceTimersByTime(23 * HOUR)
    expect(reclaim).not.toHaveBeenCalled()
    vi.advanceTimersByTime(HOUR)
    expect(reclaim).toHaveBeenCalledTimes(1)
  })

  it('does not count while a client is connected', () => {
    const { reclaimer, reclaim } = makeReclaimer()
    reclaimer.update(2)
    reclaimer.update(1)
    expect(reclaimer.armed).toBe(false)
    vi.advanceTimersByTime(10 * DAY)
    expect(reclaim).not.toHaveBeenCalled()
  })

  it('repeated 0 counts do not restart the countdown', () => {
    const { reclaimer, reclaim } = makeReclaimer()
    reclaimer.update(0)
    vi.advanceTimersByTime(12 * HOUR)
    reclaimer.update(0)
    vi.advanceTimersByTime(12 * HOUR)
    expect(reclaim).toHaveBeenCalledTimes(1)
  })

  it('idleMs 0 disables it; dispose cancels a pending countdown', () => {
    const disabled = makeReclaimer(0)
    disabled.reclaimer.update(0)
    expect(disabled.reclaimer.armed).toBe(false)
    vi.advanceTimersByTime(30 * DAY)
    expect(disabled.reclaim).not.toHaveBeenCalled()

    const disposed = makeReclaimer()
    disposed.reclaimer.update(0)
    disposed.reclaimer.dispose()
    disposed.reclaimer.update(1)
    disposed.reclaimer.update(0) // e.g. RemoteServer.stop() clearing its clients after dispose
    expect(disposed.reclaimer.armed).toBe(false)
    vi.advanceTimersByTime(2 * DAY)
    expect(disposed.reclaim).not.toHaveBeenCalled()
  })
})

describe('resolveHeadlessPtyLimits', () => {
  it('defaults to 24h / 64', () => {
    expect(resolveHeadlessPtyLimits({}, {})).toEqual({ idleReclaimMs: DAY, maxPtys: 64 })
    expect(HEADLESS_PTY_IDLE_RECLAIM_DEFAULT_MS).toBe(DAY)
    expect(HEADLESS_MAX_PTYS_DEFAULT).toBe(64)
  })

  it('env overrides the defaults (hours, fractions allowed; 0 = disabled / unlimited)', () => {
    expect(resolveHeadlessPtyLimits({}, { [HEADLESS_PTY_IDLE_HOURS_ENV]: '1.5', [HEADLESS_MAX_PTYS_ENV]: '8' }))
      .toEqual({ idleReclaimMs: 1.5 * HOUR, maxPtys: 8 })
    expect(resolveHeadlessPtyLimits({}, { [HEADLESS_PTY_IDLE_HOURS_ENV]: '0', [HEADLESS_MAX_PTYS_ENV]: '0' }))
      .toEqual({ idleReclaimMs: 0, maxPtys: 0 })
  })

  it('options win over env', () => {
    expect(resolveHeadlessPtyLimits({ ptyIdleReclaimMs: 500, maxPtys: 2 }, { [HEADLESS_PTY_IDLE_HOURS_ENV]: '5', [HEADLESS_MAX_PTYS_ENV]: '9' }))
      .toEqual({ idleReclaimMs: 500, maxPtys: 2 })
  })

  it('invalid env values warn and fall back to the defaults', () => {
    const warn = vi.fn()
    expect(resolveHeadlessPtyLimits({}, { [HEADLESS_PTY_IDLE_HOURS_ENV]: 'soon', [HEADLESS_MAX_PTYS_ENV]: '-1' }, warn))
      .toEqual({ idleReclaimMs: DAY, maxPtys: 64 })
    expect(resolveHeadlessPtyLimits({}, { [HEADLESS_MAX_PTYS_ENV]: '2.5' }, warn).maxPtys).toBe(64)
    expect(warn).toHaveBeenCalledTimes(3)
    expect(warn.mock.calls[0][0]).toMatch(/BAT_SERVER_PTY_IDLE_HOURS="soon"/)
  })

  it('clamps an idle limit beyond the setTimeout maximum instead of firing immediately', () => {
    const warn = vi.fn()
    expect(resolveHeadlessPtyLimits({}, { [HEADLESS_PTY_IDLE_HOURS_ENV]: '10000' }, warn).idleReclaimMs).toBe(2_147_483_647)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/clamped/))
  })
})

// ── wire level ──────────────────────────────────────────────────────────────

const IS_WIN = process.platform === 'win32'
const SHELL = IS_WIN
  ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe')
  : (fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh')
const CWD = os.tmpdir()
const CREATED = { ok: true, created: true }
const EXISTING = { ok: true, created: false }

let seq = 0
const termId = (label: string) => `t0404-${label}-${process.pid}-${seq++}`
const ptyOpts = (id: string) => ({ id, cwd: CWD, type: 'terminal', shell: SHELL })

describe('headless orphan reclaim + PTY cap (harness, real node-pty)', () => {
  let harness: HeadlessHarness | null = null
  const logLines: string[] = []
  const logger = {
    log: (...args: unknown[]) => { logLines.push(args.map(String).join(' ')) },
    warn: (...args: unknown[]) => { logLines.push(args.map(String).join(' ')) },
    error: () => {},
  }

  afterEach(async () => {
    await harness?.dispose()
    harness = null
    logLines.length = 0
  })

  it('reclaims the PTYs once the last client has been gone for the idle limit', { timeout: 30_000 }, async () => {
    harness = await startHeadlessHarness({ ptyIdleReclaimMs: 400, logger })
    const id = termId('reclaim')
    expect(await harness.invoke('pty:create', ptyOpts(id))).toEqual(CREATED)
    await harness.close()

    await vi.waitFor(() => {
      expect(logLines.some(l => /reclaimed 1 orphan PTY\(s\)/.test(l))).toBe(true)
    }, { timeout: 10_000, interval: 50 })

    // The same id spawns afresh: the old PTY is gone.
    const client = await harness.connect()
    expect(await client.invoke('pty:create', ptyOpts(id))).toEqual(CREATED)
    await client.invoke('pty:kill', id)
  })

  it('keeps the PTYs while a client stays connected past the idle limit', { timeout: 30_000 }, async () => {
    harness = await startHeadlessHarness({ ptyIdleReclaimMs: 300, logger })
    const id = termId('kept')
    expect(await harness.invoke('pty:create', ptyOpts(id))).toEqual(CREATED)
    await new Promise(resolve => setTimeout(resolve, 900))
    expect(await harness.invoke('pty:create', ptyOpts(id))).toEqual(EXISTING)
    expect(logLines.some(l => /reclaimed/.test(l))).toBe(false)
    await harness.invoke('pty:kill', id)
  })

  it('refuses pty:create beyond the cap with an explicit error; running PTYs survive; kill frees a slot', { timeout: 30_000 }, async () => {
    harness = await startHeadlessHarness({ maxPtys: 2, logger })
    const [a, b, c] = [termId('cap-a'), termId('cap-b'), termId('cap-c')]
    expect(await harness.invoke('pty:create', ptyOpts(a))).toEqual(CREATED)
    expect(await harness.invoke('pty:create', ptyOpts(b))).toEqual(CREATED)
    await expect(harness.invoke('pty:create', ptyOpts(c))).rejects.toThrow(/PTY limit reached.*max 2/)

    expect(await harness.invoke('pty:create', ptyOpts(a))).toEqual(EXISTING)
    expect(await harness.invoke('pty:create', ptyOpts(b))).toEqual(EXISTING)

    expect(await harness.invoke('pty:kill', a)).toBe(true)
    expect(await harness.invoke('pty:create', ptyOpts(c))).toEqual(CREATED)
    await harness.invoke('pty:kill', b)
    await harness.invoke('pty:kill', c)
  })

  it('logs the effective limits at startup', { timeout: 30_000 }, async () => {
    harness = await startHeadlessHarness({ logger })
    expect(logLines).toContainEqual(expect.stringMatching(/orphan PTY reclaim: after 24h without a client; PTY limit: 64/))
  })
})
