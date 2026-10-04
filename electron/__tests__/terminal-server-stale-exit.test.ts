// @vitest-environment node
/**
 * T0394 (BUG-101): Terminal Server restart = pty:kill + pty:create with the same id.
 * The killed PTY's exit arrives after the new PTY took the id; it must not delete the
 * new entry / registry row, and must not broadcast pty:exit for the new terminal.
 * A plain kill and a shell that exits on its own still delete + broadcast pty:exit.
 *
 * Decision units drive `handlePtyExit` with fake PTY objects; the restart flow runs a
 * real node-pty shell through `handleMessage`. Client transport is stubbed: under the
 * vitest forks pool `process.send` exists and would talk to the vitest parent.
 */
import * as fs from 'fs'
import * as os from 'os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalServer } from '../terminal-server/server'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'

const IS_WIN = process.platform === 'win32'
const SHELL = IS_WIN
  ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe')
  : (fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh')
const NL = IS_WIN ? '\r\n' : '\n'
/** Output contains `T0394:<tag>:E`; the echo of the typed command does not (cmd `^:` / printf `%s`). */
const markerCmd = (tag: string) => IS_WIN ? `echo T0394^:${tag}^:E` : `printf 'T0394:%s:E\\n' ${tag}`

interface FakePty { pid: number; kill: () => void; write: () => void; resize: () => void }
interface ServerInternals {
  ptys: Map<string, { pty: unknown; pid: number; cwd: string }>
  handlePtyExit(id: string, proc: unknown, exitCode: number): void
  broadcastToAll(msg: ServerResponse): void
  sendToClient(msg: ServerResponse): void
}

let server: TerminalServer
let internals: ServerInternals
let broadcasts: ServerResponse[]
let replies: ServerResponse[]

function fakePty(pid: number): FakePty {
  return { pid, kill: vi.fn(), write: vi.fn(), resize: vi.fn() }
}

function exitsFor(id: string) {
  return broadcasts.filter(m => m.type === 'pty:exit' && m.id === id)
}

beforeEach(() => {
  server = new TerminalServer(0, 100)
  internals = server as unknown as ServerInternals
  broadcasts = []
  replies = []
  vi.spyOn(internals, 'broadcastToAll').mockImplementation((msg) => { broadcasts.push(msg) })
  vi.spyOn(internals, 'sendToClient').mockImplementation((msg) => { replies.push(msg) })
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  for (const [, entry] of internals.ptys) {
    try { (entry.pty as { kill(): void }).kill() } catch { /* already gone */ }
  }
  internals.ptys.clear()
  vi.restoreAllMocks()
})

describe('handlePtyExit (decision)', () => {
  it('late exit of a replaced PTY keeps the new entry and broadcasts nothing', () => {
    const oldPty = fakePty(100)
    const newPty = fakePty(200)
    internals.ptys.set('t1', { pty: newPty, pid: 200, cwd: os.tmpdir() })

    internals.handlePtyExit('t1', oldPty, 1)

    expect(internals.ptys.get('t1')?.pty).toBe(newPty)
    expect(exitsFor('t1')).toEqual([])
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('stale exit ignored id=t1'))
  })

  it('exit after a plain kill (entry already removed) is still broadcast', () => {
    internals.handlePtyExit('t2', fakePty(100), 0)

    expect(internals.ptys.has('t2')).toBe(false)
    expect(exitsFor('t2')).toEqual([{ type: 'pty:exit', id: 't2', exitCode: 0 }])
  })

  it('exit of the current PTY deletes the entry and broadcasts', () => {
    const current = fakePty(300)
    internals.ptys.set('t3', { pty: current, pid: 300, cwd: os.tmpdir() })

    internals.handlePtyExit('t3', current, 7)

    expect(internals.ptys.has('t3')).toBe(false)
    expect(exitsFor('t3')).toEqual([{ type: 'pty:exit', id: 't3', exitCode: 7 }])
  })
})

describe('real node-pty through handleMessage', () => {
  const ID = `t0394-${process.pid}`

  function create(): void {
    const req: ServerRequest = { type: 'pty:create', id: ID, shell: SHELL, args: [], cwd: os.tmpdir(), cols: 80, rows: 24 }
    server.handleMessage(req, 'ipc')
  }

  function createdPids(): number[] {
    return replies.flatMap(m => (m.type === 'pty:created' && m.id === ID ? [m.pid] : []))
  }

  function outputSince(from: number): string {
    return broadcasts.slice(from)
      .flatMap(m => (m.type === 'pty:data' && m.id === ID ? [m.data] : []))
      .join('')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[=>]/g, '')
  }

  async function expectMarker(tag: string): Promise<void> {
    const from = broadcasts.length
    server.handleMessage({ type: 'pty:write', id: ID, data: markerCmd(tag) + NL }, 'ipc')
    await vi.waitFor(() => {
      expect(outputSince(from)).toContain(`T0394:${tag}:E`)
    }, { timeout: 15_000, interval: 50 })
  }

  it('restart: old exit arrives late, new PTY survives and no pty:exit is broadcast; kill still exits', async () => {
    const handleExit = vi.spyOn(internals, 'handlePtyExit')

    create()
    expect(createdPids()).toHaveLength(1)
    await expectMarker('first')
    const oldPty = internals.ptys.get(ID)!.pty

    // restart(): kill + create with the same id, back to back
    server.handleMessage({ type: 'pty:kill', id: ID }, 'ipc')
    create()
    const [oldPid, newPid] = createdPids()
    expect(newPid).toBeDefined()
    expect(newPid).not.toBe(oldPid)

    // the old PTY's exit fires after the new PTY took the id
    await vi.waitFor(() => {
      expect(handleExit.mock.calls.some(([id, proc]) => id === ID && proc === oldPty)).toBe(true)
    }, { timeout: 15_000, interval: 50 })

    expect(internals.ptys.get(ID)?.pid).toBe(newPid)
    expect(exitsFor(ID)).toEqual([])
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining(`stale exit ignored id=${ID}`))
    expect(broadcasts.some(m => m.type === 'error' && m.requestType === 'pty:write')).toBe(false)
    await expectMarker('second')

    // a plain kill still reports the exit
    server.handleMessage({ type: 'pty:kill', id: ID }, 'ipc')
    await vi.waitFor(() => {
      expect(exitsFor(ID)).toHaveLength(1)
    }, { timeout: 15_000, interval: 50 })
    expect(internals.ptys.has(ID)).toBe(false)
  }, 60_000)

  it('shell exiting on its own deletes the entry and broadcasts pty:exit', async () => {
    create()
    await expectMarker('alive')
    server.handleMessage({ type: 'pty:write', id: ID, data: `exit${NL}` }, 'ipc')
    await vi.waitFor(() => {
      expect(exitsFor(ID)).toHaveLength(1)
    }, { timeout: 15_000, interval: 50 })
    expect(internals.ptys.has(ID)).toBe(false)
  }, 30_000)
})
