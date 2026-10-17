// @vitest-environment node
/**
 * T0578 (BUG-146): BAT reopened while the Terminal Server kept its PTYs → the Recovery prompt.
 * Before the answer PtyManager is connected to no Terminal Server, and the restored tabs'
 * `pty:create` used to spawn a direct node-pty shell for an id still running on the server.
 * Now Electron holds `pty:create` (the handler waits) until the answer:
 *   - recover: the held creates run once the server's PTY list registered the surviving ids —
 *     those answer `created: false` (no spawn), other ids `created: true` on the server
 *   - fresh start / failed recover: released after the new server is up → `created: true`
 *   - no hold (direct mode, no surviving server, headless): the handler answers synchronously
 *
 * The Terminal Server is a fake fork IPC channel (EventEmitter + send spy), as in
 * pty-manager-server-exit.test.ts.
 */
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import { PtyManager, type PtyManagerDeps } from '../pty-manager'
import { registerPtyHandlers } from '../handlers/pty'
import type { SharedHandler } from '../handlers/types'
import { logger } from '../logger'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'
import type { PtyCreateResult } from '../../src/types'

const SURVIVING = 'tab-surviving'
const NEW_TAB = 'tab-new'
const CWD = os.tmpdir()

class FakeServer extends EventEmitter {
  connected = true
  sent: ServerRequest[] = []
  send = (msg: ServerRequest) => { this.sent.push(msg); return true }
  reply(msg: ServerResponse) { this.emit('message', msg) }
}

let manager: PtyManager
let helperEnv: Mock<NonNullable<PtyManagerDeps['helperEnv']>>
let createSpy: ReturnType<typeof vi.spyOn>
let create: (opts: unknown) => PtyCreateResult | Promise<PtyCreateResult>

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  helperEnv = vi.fn<NonNullable<PtyManagerDeps['helperEnv']>>(() => ({}))
  manager = new PtyManager({ emit: vi.fn(), dataDir: os.tmpdir(), helperEnv })
  createSpy = vi.spyOn(manager, 'createWithResult')
  const handlers = new Map<string, SharedHandler>()
  registerPtyHandlers((channel, handler) => { handlers.set(channel, handler) }, { getPtyManager: () => manager })
  create = (opts) => handlers.get('pty:create')!({ windowId: 'w1' } as never, opts) as PtyCreateResult | Promise<PtyCreateResult>
})

afterEach(() => {
  vi.useRealTimers()
  manager.beginShutdown()
  manager.dispose()
  vi.restoreAllMocks()
})

const opts = (id: string) => ({ id, cwd: CWD, type: 'terminal', shell: 'test-shell' })

/** Lets resolved hold waiters and their `.then(create)` run. */
const flush = () => new Promise<void>(r => setTimeout(r, 0))

function connectServer(): FakeServer {
  const server = new FakeServer()
  manager.setServerProcess(server as unknown as ChildProcess)
  return server
}

describe('pty:create while the Recovery prompt is pending (BUG-146)', () => {
  it('holds: no create, no spawn, no capability until the answer', async () => {
    manager.holdCreates('Recovery prompt pending')
    const pending = create(opts(SURVIVING))
    expect(pending).toBeInstanceOf(Promise)
    let settled = false
    void (pending as Promise<PtyCreateResult>).then(() => { settled = true })
    await flush()

    expect(settled).toBe(false)
    expect(createSpy).not.toHaveBeenCalled()
    expect(helperEnv).not.toHaveBeenCalled()
    expect(manager.isAlive(SURVIVING)).toBe(false)
    expect(logger.log).toHaveBeenCalledWith(`[BUG-146] pty:create id=${SURVIVING} held until the Recovery prompt is answered`)
    manager.releaseCreates('test end')
  })

  it('recover: a surviving id answers created: false (attached, nothing sent to the server); a new id created: true', async () => {
    manager.holdCreates('Recovery prompt pending')
    const surviving = create(opts(SURVIVING)) as Promise<PtyCreateResult>
    const fresh = create(opts(NEW_TAB)) as Promise<PtyCreateResult>
    await flush()

    // the answer: connect, ask for the list, release once it arrives
    const server = connectServer()
    manager.releaseCreatesOnReplayList()
    await flush()
    expect(createSpy).not.toHaveBeenCalled() // still held until the list
    server.reply({ type: 'pty:list', ptys: [{ id: SURVIVING, pid: 4242, cwd: CWD }] })

    await expect(surviving).resolves.toEqual({ ok: true, created: false })
    await expect(fresh).resolves.toEqual({ ok: true, created: true })
    const creates = server.sent.filter(m => m.type === 'pty:create').map(m => (m as { id: string }).id)
    expect(creates).toEqual([NEW_TAB])
    // T0576: the surviving tab keeps its restored capability — no new one is issued for it
    expect(helperEnv.mock.calls.map(([id]) => id)).toEqual([NEW_TAB])
    expect(manager.isCreateHeld()).toBe(false)
  })

  it('recover: held creates run in the order they came', async () => {
    manager.holdCreates('Recovery prompt pending')
    const order: string[] = []
    const ids = ['a', 'b', 'c']
    const all = ids.map(id => (create(opts(id)) as Promise<PtyCreateResult>).then(() => order.push(id)))
    const server = connectServer()
    server.reply({ type: 'pty:list', ptys: [] })
    await Promise.all(all)
    expect(order).toEqual(ids)
  })

  it('recover: no PTY list within the timeout → released anyway', async () => {
    vi.useFakeTimers()
    manager.holdCreates('Recovery prompt pending')
    const held = create(opts(NEW_TAB)) as Promise<PtyCreateResult>
    connectServer()
    manager.releaseCreatesOnReplayList()
    await vi.advanceTimersByTimeAsync(PtyManager.CREATE_HOLD_LIST_TIMEOUT_MS - 1)
    expect(createSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await expect(held).resolves.toEqual({ ok: true, created: true })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('[BUG-146] no Terminal Server PTY list within'))
  })

  it('fresh start: released after the new server is up → every tab created: true on it', async () => {
    manager.holdCreates('Recovery prompt pending')
    const held = create(opts(SURVIVING)) as Promise<PtyCreateResult>
    const server = connectServer() // startTerminalServer forked a new server
    manager.releaseCreates('fresh start')
    await expect(held).resolves.toEqual({ ok: true, created: true })
    expect(server.sent.filter(m => m.type === 'pty:create').map(m => (m as { id: string }).id)).toEqual([SURVIVING])
    expect(helperEnv.mock.calls.map(([id]) => id)).toEqual([SURVIVING])
  })

  it('a later PTY list (reload / reconnect) without a hold changes nothing', async () => {
    const server = connectServer()
    server.reply({ type: 'pty:list', ptys: [{ id: SURVIVING, pid: 1, cwd: CWD }] })
    expect(manager.isCreateHeld()).toBe(false)
    expect(create(opts(SURVIVING))).toEqual({ ok: true, created: false })
  })

  it('release / hold are idempotent', () => {
    manager.releaseCreates('nothing held')
    manager.holdCreates('first')
    manager.holdCreates('second')
    expect(manager.isCreateHeld()).toBe(true)
    manager.releaseCreates('done')
    manager.releaseCreates('again')
    expect(manager.isCreateHeld()).toBe(false)
  })
})

describe('without a hold the handler is unchanged', () => {
  it('answers synchronously (Terminal Server mode)', () => {
    connectServer()
    const result = create(opts(NEW_TAB))
    expect(result).not.toBeInstanceOf(Promise)
    expect(result).toEqual({ ok: true, created: true })
    expect(create(opts(NEW_TAB))).toEqual({ ok: true, created: false })
  })

  it('answers synchronously with a manager that has no hold API (older test doubles / hosts)', () => {
    const handlers = new Map<string, SharedHandler>()
    const createWithResult = vi.fn(() => ({ ok: true, created: true }))
    registerPtyHandlers((channel, handler) => { handlers.set(channel, handler) }, {
      getPtyManager: () => ({ createWithResult }) as unknown as PtyManager,
    })
    expect(handlers.get('pty:create')!({} as never, opts(NEW_TAB))).toEqual({ ok: true, created: true })
  })
})

describe('main.ts wiring (source guard)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8')
  const section = (start: string, end: string) => {
    const from = src.indexOf(start)
    expect(from).toBeGreaterThan(-1)
    const to = src.indexOf(end, from + start.length)
    return src.slice(from, to === -1 ? undefined : to)
  }

  it('the Recovery prompt holds creates where the live PTYs are found', () => {
    const block = section('pendingRecovery = { port, ptyCount }', 'return  // Recovery prompt')
    expect(block).toContain("ptyManager?.holdCreates('Recovery prompt pending')")
  })

  it('recover releases on the PTY list; a failed recover releases after the new server', () => {
    const block = section("ipcMain.on('terminal-server:recover'", "ipcMain.on('terminal-server:fresh-start'")
    expect(block.match(/releaseCreatesOnReplayList\(\)/g)).toHaveLength(2)
    expect(block.indexOf("ptyManager.sendToServer({ type: 'pty:list' })")).toBeLessThan(block.indexOf('releaseCreatesOnReplayList()'))
    expect(block.indexOf('await startTerminalServer()')).toBeLessThan(block.indexOf("releaseCreates('recovery failed"))
    expect(block).toMatch(/finally \{\s*ptyManager\?\.releaseCreates\('recovery failed/)
  })

  it('fresh start waits for the old server to exit, forks, then releases', () => {
    const block = section("ipcMain.on('terminal-server:fresh-start'", '\n  })')
    const wait = block.indexOf('waitForTerminalServerExit(')
    const removePid = block.indexOf('removePidFile(')
    const start = block.indexOf('await startTerminalServer()')
    const release = block.indexOf("releaseCreates('fresh start')")
    expect(wait).toBeGreaterThan(-1)
    expect(wait).toBeLessThan(removePid)
    expect(removePid).toBeLessThan(start)
    expect(start).toBeLessThan(release)
    // released even when starting the new server throws
    expect(block).toMatch(/finally \{\s*\/\/[^\n]*\n\s*ptyManager\?\.releaseCreates\('fresh start'\)/)
  })
})
