// @vitest-environment node
/**
 * T0889 (BUG-214): node-pty 1.1.0 never destroys a Windows PTY's conin socket, so every tab the Terminal Server
 * closed left one active write-only pipe handle behind (500 after T0888 C2). `releaseEndedPtyInput` destroys it after
 * the exit of a PTY BAT ended itself (kill / restart / shutdown); a PTY that exited by itself keeps it (F4).
 *
 * Units drive `releaseEndedPtyInput` and `handlePtyExit` with fake PTY objects; the last block (Windows only) runs real
 * node-pty shells through `handleMessage` and counts the main thread's write-only pipe sockets.
 */
import * as os from 'os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { releaseEndedPtyInput } from '../terminal-server/shared-conout'
import { TerminalServer, type TerminalServerDeps } from '../terminal-server/server'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'

const IS_WIN = process.platform === 'win32'

interface FakeSocket { destroyed: boolean; destroy: ReturnType<typeof vi.fn> }
function fakeSocket(): FakeSocket {
  const s: FakeSocket = { destroyed: false, destroy: vi.fn(() => { s.destroyed = true }) }
  return s
}
function fakeWinPty(pid: number, socket: FakeSocket = fakeSocket()) {
  return { pid, kill: vi.fn(), write: vi.fn(), resize: vi.fn(), _agent: { inSocket: socket }, socket }
}

interface ServerInternals {
  ptys: Map<string, { pty: unknown; pid: number; cwd: string }>
  handlePtyExit(id: string, proc: unknown, exitCode: number): void
  broadcastToAll(msg: ServerResponse): void
  sendToClient(msg: ServerResponse): void
}

function makeServer(deps: Partial<TerminalServerDeps>) {
  const server = new TerminalServer(0, 100, deps)
  const internals = server as unknown as ServerInternals
  const broadcasts: ServerResponse[] = []
  const replies: ServerResponse[] = []
  vi.spyOn(internals, 'broadcastToAll').mockImplementation((m) => { broadcasts.push(m) })
  vi.spyOn(internals, 'sendToClient').mockImplementation((m) => { replies.push(m) })
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  return { server, internals, broadcasts, replies }
}

const tick = () => new Promise<void>((r) => setImmediate(r))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('releaseEndedPtyInput', () => {
  it('not win32 → skipped before the PTY object is even read', () => {
    const proc = new Proxy({}, { get: () => { throw new Error('must not be read') } })
    for (const platform of ['darwin', 'linux'] as const) expect(releaseEndedPtyInput(proc, platform)).toBe('skipped:not-win32')
  })

  it('win32: destroys the conin socket once; a second call / an already destroyed socket → skipped:already', () => {
    const proc = fakeWinPty(1)
    expect(releaseEndedPtyInput(proc, 'win32')).toBe('released')
    expect(proc.socket.destroy).toHaveBeenCalledTimes(1)
    expect(releaseEndedPtyInput(proc, 'win32')).toBe('skipped:already')
    expect(proc.socket.destroy).toHaveBeenCalledTimes(1)
  })

  it('win32: anything that is not node-pty’s Windows shape is left alone', () => {
    expect(releaseEndedPtyInput(undefined, 'win32')).toBe('skipped:shape')
    expect(releaseEndedPtyInput({ pid: 1 }, 'win32')).toBe('skipped:shape')
    expect(releaseEndedPtyInput({ _agent: {} }, 'win32')).toBe('skipped:shape')
    expect(releaseEndedPtyInput({ _agent: { inSocket: { destroy: 'no' } } }, 'win32')).toBe('skipped:shape')
    const throwingGetter = { _agent: Object.defineProperty({}, 'inSocket', { get: () => { throw new Error('x') } }) }
    expect(releaseEndedPtyInput(throwingGetter, 'win32')).toBe('skipped:shape')
    const throwingDestroy = { _agent: { inSocket: { destroyed: false, destroy: () => { throw new Error('x') } } } }
    expect(releaseEndedPtyInput(throwingDestroy, 'win32')).toBe('skipped:destroy-failed')
  })
})

describe('handlePtyExit releases the conin socket of PTYs BAT ended (fake PTYs)', () => {
  it('win32: exit after a plain kill (entry already removed) → released after the exit callback, exit still broadcast', async () => {
    const { internals, broadcasts } = makeServer({ platform: 'win32' })
    const proc = fakeWinPty(100)
    internals.handlePtyExit('k1', proc, 0)
    expect(proc.socket.destroy).not.toHaveBeenCalled() // not synchronously: node-pty's own exit handling runs first
    await tick()
    expect(proc.socket.destroy).toHaveBeenCalledTimes(1)
    expect(broadcasts).toEqual([{ type: 'pty:exit', id: 'k1', exitCode: 0 }])
  })

  it('win32: late exit of a PTY replaced by a restart → released; the new PTY’s socket is untouched', async () => {
    const { internals, broadcasts } = makeServer({ platform: 'win32' })
    const oldPty = fakeWinPty(100)
    const newPty = fakeWinPty(200)
    internals.ptys.set('r1', { pty: newPty, pid: 200, cwd: os.tmpdir() })
    internals.handlePtyExit('r1', oldPty, 1)
    await tick()
    expect(oldPty.socket.destroy).toHaveBeenCalledTimes(1)
    expect(newPty.socket.destroy).not.toHaveBeenCalled()
    expect(internals.ptys.get('r1')?.pty).toBe(newPty)
    expect(broadcasts).toEqual([])
  })

  it('win32: a PTY that exited by itself (still the current entry) keeps its socket (F4 unchanged)', async () => {
    const { internals, broadcasts } = makeServer({ platform: 'win32' })
    const proc = fakeWinPty(300)
    internals.ptys.set('n1', { pty: proc, pid: 300, cwd: os.tmpdir() })
    internals.handlePtyExit('n1', proc, 7)
    await tick()
    expect(proc.socket.destroy).not.toHaveBeenCalled()
    expect(internals.ptys.has('n1')).toBe(false)
    expect(broadcasts).toEqual([{ type: 'pty:exit', id: 'n1', exitCode: 7 }])
  })

  it('not win32: nothing is released, the exit path is unchanged', async () => {
    for (const platform of ['darwin', 'linux'] as const) {
      const { internals, broadcasts } = makeServer({ platform })
      const proc = fakeWinPty(400)
      internals.handlePtyExit('u1', proc, 0)
      await tick()
      expect(proc.socket.destroy).not.toHaveBeenCalled()
      expect(broadcasts).toEqual([{ type: 'pty:exit', id: 'u1', exitCode: 0 }])
      vi.restoreAllMocks()
    }
  })
})

/** Main-thread write-only pipe sockets (node-pty's conin sockets; stdout/stderr pipes are counted in the baseline). */
function coninSockets(): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (process as any)._getActiveHandles().filter((h: any) =>
    h?.constructor?.name === 'Socket' && h.writable && !h.readable && h._handle?.constructor?.name === 'Pipe').length
}

describe.skipIf(!IS_WIN)('Windows: real node-pty through handleMessage', () => {
  it('opening and closing PTYs leaves no conin socket behind; a self-exited PTY keeps its one (F4)', async () => {
    const { server, internals, broadcasts } = makeServer({})
    const shell = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe'
    const exits = (id: string) => broadcasts.filter((m) => m.type === 'pty:exit' && m.id === id).length
    const create = (id: string) => server.handleMessage({ type: 'pty:create', id, shell, args: [], cwd: os.tmpdir(), cols: 80, rows: 24 } as ServerRequest, 'ipc')
    const prompt = (id: string) => vi.waitFor(() => {
      const out = broadcasts.flatMap((m) => (m.type === 'pty:data' && m.id === id ? [m.data] : [])).join('')
      expect(out).toMatch(/>/)
    }, { timeout: 20_000, interval: 50 })

    const baseline = coninSockets()
    const ids = [0, 1, 2, 3, 4].map((i) => `t0889-rel-${process.pid}-${i}`)
    for (const id of ids) { create(id); await prompt(id) }
    expect(coninSockets()).toBe(baseline + ids.length)
    for (const id of ids) server.handleMessage({ type: 'pty:kill', id }, 'ipc')
    await vi.waitFor(() => { for (const id of ids) expect(exits(id)).toBe(1) }, { timeout: 30_000, interval: 100 })
    await vi.waitFor(() => expect(coninSockets()).toBe(baseline), { timeout: 5_000, interval: 50 })

    const self = `t0889-rel-${process.pid}-self`
    create(self)
    await prompt(self)
    server.handleMessage({ type: 'pty:write', id: self, data: 'exit\r\n' }, 'ipc')
    await vi.waitFor(() => expect(exits(self)).toBe(1), { timeout: 20_000, interval: 50 })
    await tick()
    expect(coninSockets()).toBe(baseline + 1)
    expect(internals.ptys.size).toBe(0)
  }, 120_000)
})
