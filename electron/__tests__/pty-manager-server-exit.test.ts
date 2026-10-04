// @vitest-environment node
/**
 * T0394 (BUG-101): PtyManager in Terminal Server mode, defence in depth.
 *
 * restart() = kill + create with the same id. If the old PTY exits between the server
 * handling pty:kill and pty:create, the server (correctly) broadcasts that exit, and it
 * reaches main after restart() registered the new instance. The server answers
 * pty:created before any exit of the PTY it spawns, so an exit seen before pty:created
 * belongs to the replaced process: it must not delete the new instance or reach the
 * renderer. After pty:created, and for plain kill, exits behave as before.
 *
 * The Terminal Server is a fake fork IPC channel (EventEmitter + send spy).
 */
import { EventEmitter } from 'events'
import * as os from 'os'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import { PtyManager } from '../pty-manager'
import { logger } from '../logger'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'

const ID = 'term-1'
const CWD = os.tmpdir()

class FakeServer extends EventEmitter {
  connected = true
  sent: ServerRequest[] = []
  send = (msg: ServerRequest) => { this.sent.push(msg); return true }
  reply(msg: ServerResponse) { this.emit('message', msg) }
}

let server: FakeServer
let manager: PtyManager
let emit: ReturnType<typeof vi.fn>

function exitEvents() {
  return emit.mock.calls.filter(([channel]) => channel === 'pty:exit')
}

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  server = new FakeServer()
  emit = vi.fn()
  manager = new PtyManager({ emit, dataDir: os.tmpdir() })
  manager.setServerProcess(server as unknown as ChildProcess)
  expect(manager.create({ id: ID, cwd: CWD, type: 'terminal', shell: 'test-shell' })).toBe(true)
  server.reply({ type: 'pty:created', id: ID, pid: 100 })
})

afterEach(() => {
  manager.beginShutdown()
  manager.dispose()
  vi.restoreAllMocks()
})

describe('PtyManager Terminal Server exit handling', () => {
  it('restart: old exit before the new pty:created is ignored', () => {
    expect(manager.restart(ID, CWD)).toBe(true)
    expect(server.sent.map(m => m.type)).toEqual(['pty:create', 'pty:kill', 'pty:create'])

    server.reply({ type: 'pty:exit', id: ID, exitCode: 1 }) // old PTY, raced the create

    expect(exitEvents()).toEqual([])
    expect(manager.getCwd(ID)).toBe(CWD)
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(`stale exit ignored id=${ID}`))

    // new PTY confirmed; it still works and its own exit is reported
    server.reply({ type: 'pty:created', id: ID, pid: 200 })
    manager.write(ID, 'echo hi\r')
    expect(server.sent.at(-1)).toEqual({ type: 'pty:write', id: ID, data: 'echo hi\r' })

    server.reply({ type: 'pty:exit', id: ID, exitCode: 0 })
    expect(exitEvents()).toEqual([['pty:exit', ID, 0]])
    expect(manager.getCwd(ID)).toBeNull()
  })

  it('plain kill: the exit is still forwarded to the renderer', () => {
    expect(manager.kill(ID)).toBe(true)
    expect(server.sent.at(-1)).toEqual({ type: 'pty:kill', id: ID })

    server.reply({ type: 'pty:exit', id: ID, exitCode: 1 })

    expect(exitEvents()).toEqual([['pty:exit', ID, 1]])
    expect(manager.getCwd(ID)).toBeNull()
  })

  it('shell exiting on its own: instance removed and pty:exit forwarded', () => {
    server.reply({ type: 'pty:exit', id: ID, exitCode: 0 })

    expect(exitEvents()).toEqual([['pty:exit', ID, 0]])
    expect(manager.getCwd(ID)).toBeNull()
  })

  it('reconnect replay: PTYs registered from pty:list still report their exit', () => {
    server.reply({ type: 'pty:list', ptys: [{ id: 'replayed', pid: 300, cwd: CWD }] })
    expect(manager.getCwd('replayed')).toBe(CWD)

    server.reply({ type: 'pty:exit', id: 'replayed', exitCode: 0 })

    expect(exitEvents()).toEqual([['pty:exit', 'replayed', 0]])
    expect(manager.getCwd('replayed')).toBeNull()
  })
})
