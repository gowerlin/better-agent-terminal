// @vitest-environment node
/**
 * T0403 (PLAN-036): `pty:create` reports whether it spawned, `pty:get-buffer` replays
 * the PTY's raw output tail.
 *
 *   - trimReplayBuffer: cap, cut after `\n`, else at an ESC, never inside a sequence
 *   - PtyManager (Terminal Server mode, fake fork IPC): createWithResult created/existing,
 *     raw buffer keeps VT sequences, released on kill / exit, seeded from a T0108 replay,
 *     getReplayBuffer never emits
 *   - registerPtyHandlers: `{ ok, created }` shapes, `pty:get-buffer` answers the caller
 */
import { EventEmitter } from 'events'
import * as os from 'os'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import { PtyManager, REPLAY_BUFFER_MAX_CHARS, trimReplayBuffer } from '../pty-manager'
import { registerPtyHandlers } from '../handlers/pty'
import type { HandlerRegistrar } from '../handlers/types'
import { logger } from '../logger'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'

const CWD = os.tmpdir()
const ESC = '\x1b'

class FakeServer extends EventEmitter {
  connected = true
  sent: ServerRequest[] = []
  send = (msg: ServerRequest) => { this.sent.push(msg); return true }
  reply(msg: ServerResponse) { this.emit('message', msg) }
}

/** No ESC sequence is cut: every ESC in `s` starts a complete `ESC [ … final` CSI. */
function hasNoBrokenCsi(s: string): boolean {
  // A kept part that starts mid-sequence would begin with the sequence's tail (e.g. "1;31m").
  return !/^[0-9;?]*[@-~]/.test(s) || s.startsWith(ESC)
}

describe('trimReplayBuffer', () => {
  it('returns the buffer untouched while under the cap', () => {
    expect(trimReplayBuffer('abc\ndef', 100)).toBe('abc\ndef')
  })

  it('cuts right after the first newline inside the kept window', () => {
    const buf = `${ESC}[1;31mold line${ESC}[0m\n${ESC}[32mnew line${ESC}[0m\nlast`
    const max = buf.length - 5 // window starts inside the first sequence
    const out = trimReplayBuffer(buf, max)
    expect(out).toBe(`${ESC}[32mnew line${ESC}[0m\nlast`)
    expect(out.length).toBeLessThanOrEqual(max)
    expect(hasNoBrokenCsi(out)).toBe(true)
  })

  it('without a newline, cuts at the start of an escape sequence, never inside one', () => {
    // A full-screen TUI repaint: cursor moves, no \n at all.
    const frame = (n: number) => `${ESC}[${n};1H${ESC}[2Krow ${n}`
    const buf = Array.from({ length: 50 }, (_, i) => frame(i + 1)).join('')
    for (const max of [10, 33, 100, 257]) {
      const out = trimReplayBuffer(buf, max)
      expect(out.length).toBeLessThanOrEqual(max)
      expect(out.startsWith(ESC), `max=${max}: ${JSON.stringify(out.slice(0, 12))}`).toBe(true)
      expect(buf.endsWith(out)).toBe(true)
    }
  })

  it('plain text without newline or ESC: does not split a surrogate pair', () => {
    const buf = 'x' + '😀'.repeat(10) // each emoji = 2 UTF-16 units
    expect(trimReplayBuffer(buf, 6)).toBe('😀😀😀') // cut on a pair boundary
    expect(trimReplayBuffer(buf, 5)).toBe('😀😀') // cut would leave a lone low surrogate
  })
})

describe('PtyManager replay buffer (Terminal Server mode)', () => {
  let server: FakeServer
  let manager: PtyManager
  let emit: ReturnType<typeof vi.fn>

  const flush = () => vi.advanceTimersByTime(20) // > BATCH_INTERVAL_MS (16)
  const data = (id: string, text: string) => server.reply({ type: 'pty:data', id, data: text })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    server = new FakeServer()
    emit = vi.fn()
    manager = new PtyManager({ emit, dataDir: CWD })
    manager.setServerProcess(server as unknown as ChildProcess)
  })

  afterEach(() => {
    manager.beginShutdown()
    manager.dispose()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('createWithResult: first create spawns, a re-sent create reports the existing PTY', () => {
    expect(manager.createWithResult({ id: 'a', cwd: CWD, type: 'terminal', shell: 'sh' })).toEqual({ ok: true, created: true })
    expect(manager.createWithResult({ id: 'a', cwd: CWD, type: 'terminal', shell: 'sh' })).toEqual({ ok: true, created: false })
    expect(server.sent.filter(m => m.type === 'pty:create')).toHaveLength(1)
  })

  it('keeps raw output with VT sequences, and getReplayBuffer emits nothing', () => {
    manager.createWithResult({ id: 'a', cwd: CWD, type: 'terminal', shell: 'sh' })
    data('a', `${ESC}[?2004h$ `)
    data('a', `echo hi\r\n${ESC}[32mhi${ESC}[0m\r\n`)
    flush()
    const emitsBefore = emit.mock.calls.length
    const buf = manager.getReplayBuffer('a')
    expect(buf).toEqual({ data: `${ESC}[?2004h$ echo hi\r\n${ESC}[32mhi${ESC}[0m\r\n`, total: buf!.data.length })
    expect(emit.mock.calls.length).toBe(emitsBefore)
  })

  it('is empty (not null) for a running PTY with no output yet, null for an unknown id', () => {
    manager.createWithResult({ id: 'a', cwd: CWD, type: 'terminal', shell: 'sh' })
    expect(manager.getReplayBuffer('a')).toEqual({ data: '', total: 0 })
    expect(manager.getReplayBuffer('nope')).toBeNull()
  })

  it('holds at most cap + slack, trims to the cap at a newline, and counts every char in total', () => {
    manager.createWithResult({ id: 'a', cwd: CWD, type: 'terminal', shell: 'sh' })
    const line = `${ESC}[33m${'y'.repeat(90)}${ESC}[0m\r\n` // 101 chars
    let sent = 0
    for (let i = 0; i < 4000; i++) { data('a', line); sent += line.length; if (i % 50 === 0) flush() }
    flush()
    const buf = manager.getReplayBuffer('a')!
    expect(buf.total).toBe(sent)
    expect(buf.data.length).toBeLessThanOrEqual(REPLAY_BUFFER_MAX_CHARS + 64 * 1024)
    expect(buf.data.length).toBeGreaterThan(REPLAY_BUFFER_MAX_CHARS / 2)
    expect(buf.data.startsWith(`${ESC}[33m`)).toBe(true) // cut landed right after a \n
    expect(buf.data.endsWith(line)).toBe(true)
  })

  it('is released on kill and on exit; output flushed after the exit is not kept', () => {
    manager.createWithResult({ id: 'a', cwd: CWD, type: 'terminal', shell: 'sh' })
    manager.createWithResult({ id: 'b', cwd: CWD, type: 'terminal', shell: 'sh' })
    server.reply({ type: 'pty:created', id: 'b', pid: 2 })
    data('a', 'aaa'); data('b', 'bbb'); flush()

    expect(manager.kill('a')).toBe(true)
    expect(manager.getReplayBuffer('a')).toBeNull()
    // re-created under the same id: starts empty
    manager.createWithResult({ id: 'a', cwd: CWD, type: 'terminal', shell: 'sh' })
    expect(manager.getReplayBuffer('a')).toEqual({ data: '', total: 0 })

    data('b', 'late')
    server.reply({ type: 'pty:exit', id: 'b', exitCode: 0 })
    flush()
    expect(manager.getReplayBuffer('b')).toBeNull()
    expect(manager.createWithResult({ id: 'b', cwd: CWD, type: 'terminal', shell: 'sh' })).toEqual({ ok: true, created: true })
    expect(manager.getReplayBuffer('b')).toEqual({ data: '', total: 0 })
  })

  it('seeds an empty buffer from the Terminal Server replay (T0108), but never doubles history', () => {
    server.reply({ type: 'pty:list', ptys: [{ id: 'r', pid: 7, cwd: CWD }] })
    server.reply({ type: 'pty:buffer', id: 'r', lines: ['line1', `${ESC}[1mline2${ESC}[0m`] })
    expect(manager.getReplayBuffer('r')?.data).toBe(`line1\n${ESC}[1mline2${ESC}[0m`)
    // reconnect registered the id → a renderer create re-attaches
    expect(manager.createWithResult({ id: 'r', cwd: CWD, type: 'terminal', shell: 'sh' })).toEqual({ ok: true, created: false })

    data('r', '\r\nmore'); flush()
    server.reply({ type: 'pty:buffer', id: 'r', lines: ['line1', 'line2', 'more'] })
    expect(manager.getReplayBuffer('r')?.data).toBe(`line1\n${ESC}[1mline2${ESC}[0m\r\nmore`)
  })
})

describe('registerPtyHandlers (T0403 shapes)', () => {
  type Handler = (ctx: unknown, ...args: unknown[]) => unknown
  function setup(manager: Partial<PtyManager> | null, validateShell = false) {
    const handlers = new Map<string, Handler>()
    const register = ((channel: string, handler: Handler) => { handlers.set(channel, handler) }) as unknown as HandlerRegistrar
    registerPtyHandlers(register, { getPtyManager: () => manager as PtyManager | null, validateShell })
    return (channel: string, ...args: unknown[]) => handlers.get(channel)!({}, ...args)
  }

  it('pty:create passes the manager result through', () => {
    const createWithResult = vi.fn()
      .mockReturnValueOnce({ ok: true, created: true })
      .mockReturnValueOnce({ ok: true, created: false })
    const invoke = setup({ createWithResult })
    expect(invoke('pty:create', { id: 'x', cwd: CWD, type: 'terminal' })).toEqual({ ok: true, created: true })
    expect(invoke('pty:create', { id: 'x', cwd: CWD, type: 'terminal' })).toEqual({ ok: true, created: false })
  })

  it('pty:create refuses as { ok: false, created: false } (bad shell, manager not ready)', () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const createWithResult = vi.fn()
    expect(setup({ createWithResult }, true)('pty:create', { id: 'x', cwd: CWD, type: 'terminal', shell: 'relative-shell' }))
      .toEqual({ ok: false, created: false })
    expect(createWithResult).not.toHaveBeenCalled()
    expect(setup(null)('pty:create', { id: 'x', cwd: CWD, type: 'terminal' })).toEqual({ ok: false, created: false })
    vi.restoreAllMocks()
  })

  it('pty:get-buffer answers with the manager buffer, null when there is none', () => {
    const getReplayBuffer = vi.fn((id: string) => id === 'x' ? { data: 'out', total: 3 } : null)
    const invoke = setup({ getReplayBuffer })
    expect(invoke('pty:get-buffer', 'x')).toEqual({ data: 'out', total: 3 })
    expect(invoke('pty:get-buffer', 'y')).toBeNull()
    expect(setup(null)('pty:get-buffer', 'x')).toBeNull()
  })
})
