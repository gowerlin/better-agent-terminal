// T0403 (PLAN-036) — renderer side of pty:create `{ ok, created }` + pty:get-buffer replay.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CreatePtyOptions, PtyReplayBuffer } from '../../types'
import {
  PtyOutputReplayer,
  createPtyThenLaunch,
  createPtyWithReplay,
  dropReplayedChunks,
  isPtyLimitResult,
  normalizePtyCreateResult,
  onPtyCreateRefused,
  registerPtyNoticeSink,
  registerPtyReplaySink,
  requestPtyReplay,
  resetPtyReplayRegistry,
  shouldSendLaunchCommand,
  showPtyNotice,
} from '../pty-replay'

const OPTS: CreatePtyOptions = { id: 't1', cwd: '/w', type: 'terminal', agentPreset: 'claude-cli' }

afterEach(() => resetPtyReplayRegistry())

describe('normalizePtyCreateResult', () => {
  it('reads the T0403 shape as is', () => {
    expect(normalizePtyCreateResult({ ok: true, created: true })).toEqual({ ok: true, created: true })
    expect(normalizePtyCreateResult({ ok: true, created: false })).toEqual({ ok: true, created: false })
    expect(normalizePtyCreateResult({ ok: false, created: false })).toEqual({ ok: false, created: false })
  })

  it('reads a server before T0403 (bare boolean / undefined) as "created" — pre-T0403 behaviour', () => {
    expect(normalizePtyCreateResult(true)).toEqual({ ok: true, created: true })
    expect(normalizePtyCreateResult(false)).toEqual({ ok: false, created: true })
    expect(normalizePtyCreateResult(undefined)).toEqual({ ok: false, created: true })
    expect(normalizePtyCreateResult({ something: 1 })).toEqual({ ok: true, created: true })
  })

  it('shouldSendLaunchCommand follows `created`', () => {
    expect(shouldSendLaunchCommand(normalizePtyCreateResult(true))).toBe(true)
    expect(shouldSendLaunchCommand(normalizePtyCreateResult({ ok: true, created: true }))).toBe(true)
    expect(shouldSendLaunchCommand(normalizePtyCreateResult({ ok: true, created: false }))).toBe(false)
  })
})

describe('PTY limit refusal (T0424)', () => {
  const LIMIT = { ok: false, created: false, code: 'PTY_LIMIT_REACHED', limit: 2 }

  it('normalize keeps code + limit of a known failure code', () => {
    const result = normalizePtyCreateResult(LIMIT)
    expect(result).toEqual(LIMIT)
    expect(isPtyLimitResult(result)).toBe(true)
  })

  it('normalize drops an unknown code, a code on success, and a non-numeric limit', () => {
    expect(normalizePtyCreateResult({ ok: false, created: false, code: 'SOMETHING_ELSE', limit: 2 })).toEqual({ ok: false, created: false })
    expect(normalizePtyCreateResult({ ok: true, created: true, code: 'PTY_LIMIT_REACHED' })).toEqual({ ok: true, created: true })
    expect(normalizePtyCreateResult({ ...LIMIT, limit: 'x' })).toEqual({ ok: false, created: false, code: 'PTY_LIMIT_REACHED' })
    expect(isPtyLimitResult({ ok: false, created: false })).toBe(false)
  })

  it('a refused create is reported to listeners once, with the options; no launch, no replay', async () => {
    const listener = vi.fn()
    const off = onPtyCreateRefused(listener)
    const launch = vi.fn()
    const sink = vi.fn()
    registerPtyReplaySink('t1', sink)
    const theApi = { create: vi.fn(async () => LIMIT as never) }
    const result = await createPtyThenLaunch(OPTS, launch, theApi)
    expect(result).toEqual(LIMIT)
    expect(theApi.create).toHaveBeenCalledTimes(1) // no retry
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(OPTS, LIMIT)
    expect(launch).not.toHaveBeenCalled()
    expect(sink).not.toHaveBeenCalled()
    off()
    await createPtyWithReplay(OPTS, theApi)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('other outcomes are not reported as refusals', async () => {
    const listener = vi.fn()
    onPtyCreateRefused(listener)
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: true, created: true }) })
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: false, created: false }) })
    await createPtyWithReplay(OPTS, { create: async () => { throw new Error('PTY limit reached') } })
    expect(listener).not.toHaveBeenCalled()
  })

  it('a throwing listener does not fail the create', async () => {
    onPtyCreateRefused(() => { throw new Error('listener') })
    await expect(createPtyWithReplay(OPTS, { create: async () => LIMIT as never })).resolves.toEqual(LIMIT)
  })

  it('notice registry: held until the view mounts (in order), then written directly', () => {
    showPtyNotice('t1', 'first')
    showPtyNotice('t1', 'second')
    const sink = vi.fn()
    const off = registerPtyNoticeSink('t1', sink)
    expect(sink.mock.calls).toEqual([['first'], ['second']])
    showPtyNotice('t1', 'third')
    expect(sink).toHaveBeenLastCalledWith('third')
    off()
    const remount = vi.fn()
    registerPtyNoticeSink('t1', remount)
    expect(remount).not.toHaveBeenCalled() // consumed
  })
})

describe('agent preset restore: createPtyThenLaunch', () => {
  const api = (raw: unknown) => ({ create: vi.fn(async () => raw as never) })

  it('created:false → launch command NOT sent, replay requested', async () => {
    const launch = vi.fn()
    const sink = vi.fn()
    registerPtyReplaySink('t1', sink)
    const result = await createPtyThenLaunch(OPTS, launch, api({ ok: true, created: false }))
    expect(result).toEqual({ ok: true, created: false })
    expect(launch).not.toHaveBeenCalled()
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['T0403 created:true', { ok: true, created: true }],
    ['old server true', true],
    ['old server false', false],
  ])('%s → launch command sent, no replay', async (_label, raw) => {
    const launch = vi.fn()
    const sink = vi.fn()
    registerPtyReplaySink('t1', sink)
    const theApi = api(raw)
    await createPtyThenLaunch(OPTS, launch, theApi)
    expect(theApi.create).toHaveBeenCalledWith(OPTS)
    expect(launch).toHaveBeenCalledTimes(1)
    expect(sink).not.toHaveBeenCalled()
  })

  it('create rejecting keeps the old fire-and-forget behaviour (launch still sent)', async () => {
    const launch = vi.fn()
    const result = await createPtyThenLaunch(OPTS, launch, { create: vi.fn(async () => { throw new Error('boom') }) })
    expect(result).toEqual({ ok: false, created: true })
    expect(launch).toHaveBeenCalledTimes(1)
  })
})

describe('replay request registry', () => {
  it('a request before the view mounts is held and runs once on register', async () => {
    await createPtyWithReplay(OPTS, { create: async () => ({ ok: true, created: false }) })
    const sink = vi.fn()
    registerPtyReplaySink('t1', sink)
    expect(sink).toHaveBeenCalledTimes(1)
    // consumed: a remount does not replay again
    const again = vi.fn()
    registerPtyReplaySink('t1', again)
    expect(again).not.toHaveBeenCalled()
  })

  it('unregister only removes its own sink', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = registerPtyReplaySink('t1', a)
    registerPtyReplaySink('t1', b) // remount replaced a
    offA()
    requestPtyReplay('t1')
    expect(b).toHaveBeenCalledTimes(1)
    expect(a).not.toHaveBeenCalled()
  })
})

describe('dropReplayedChunks', () => {
  it('drops queued chunks already at the end of the buffer, keeps the rest', () => {
    expect(dropReplayedChunks('…prompt$ ab', ['a', 'b', 'c', 'd'])).toEqual(['c', 'd'])
    expect(dropReplayedChunks('history', ['new1', 'new2'])).toEqual(['new1', 'new2'])
    expect(dropReplayedChunks('history-x-y', ['-x', '-y'])).toEqual([])
    expect(dropReplayedChunks('', ['a'])).toEqual(['a'])
    expect(dropReplayedChunks('abc', [])).toEqual([])
  })
})

describe('PtyOutputReplayer', () => {
  function setup(getBuffer: (id: string) => Promise<PtyReplayBuffer | null>) {
    const written: string[] = []
    const view = { write: vi.fn((d: string) => { written.push(d) }), reset: vi.fn(() => { written.length = 0 }) }
    const replayer = new PtyOutputReplayer('t1', view, getBuffer)
    return { replayer, view, written }
  }
  function deferred<T>() {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }

  it('writes live output straight through when no replay is running', () => {
    const { replayer, written } = setup(async () => null)
    replayer.push('a')
    replayer.push('b')
    expect(written).toEqual(['a', 'b'])
  })

  it('replay: buffer first, chunks covered by the buffer dropped, later chunks after it', async () => {
    const d = deferred<PtyReplayBuffer | null>()
    const { replayer, view, written } = setup(() => d.promise)
    const done = replayer.replay()
    replayer.push('x') // broadcast before the buffer was read → inside it
    replayer.push('y') // broadcast after → not inside
    d.resolve({ data: 'HISTORY-x', total: 9 })
    expect(await done).toBe(9)
    expect(view.reset).not.toHaveBeenCalled() // nothing was on screen yet
    expect(written).toEqual(['HISTORY-x', 'y'])
    replayer.push('z')
    expect(written).toEqual(['HISTORY-x', 'y', 'z'])
  })

  it('live output already on screen is reset away (the buffer contains it)', async () => {
    const { replayer, view, written } = setup(async () => ({ data: 'HISTORY-live', total: 12 }))
    replayer.push('-live') // arrived before pty:create resolved
    await replayer.replay()
    expect(view.reset).toHaveBeenCalledTimes(1)
    expect(written).toEqual(['HISTORY-live'])
  })

  it('server before T0403 (No handler) → no replay, queued live output flushed in order', async () => {
    const d = deferred<PtyReplayBuffer | null>()
    const { replayer, view, written } = setup(() => d.promise)
    const done = replayer.replay()
    replayer.push('a')
    replayer.push('b')
    d.reject(new Error('No handler for channel: pty:get-buffer'))
    expect(await done).toBe(0)
    expect(view.reset).not.toHaveBeenCalled()
    expect(written).toEqual(['a', 'b'])
  })

  it('empty / null buffer → queued output flushed, nothing reset', async () => {
    for (const buf of [null, { data: '', total: 0 }]) {
      const { replayer, view, written } = setup(async () => buf)
      const done = replayer.replay()
      replayer.push('a')
      await done
      expect(view.reset).not.toHaveBeenCalled()
      expect(written).toEqual(['a'])
    }
  })

  it('disposed mid-replay → writes nothing', async () => {
    const d = deferred<PtyReplayBuffer | null>()
    const { replayer, view } = setup(() => d.promise)
    const done = replayer.replay()
    replayer.dispose()
    d.resolve({ data: 'HISTORY', total: 7 })
    expect(await done).toBe(0)
    expect(view.write).not.toHaveBeenCalled()
  })
})
