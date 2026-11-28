// @vitest-environment node
/**
 * T0983 (PLAN-066 F4 option D, D522; BUG-238): a Windows PTY whose shell exited by itself keeps its conhost while the
 * tab is open and releases it on ✕ (`pty:kill`), ⏻ / restore (`pty:create` with the same id) and server shutdown; BAT's
 * own end of a PTY (T0540: tree first) releases the pseudo console with `releaseExitedPty` instead of node-pty's
 * `kill()` (which called `process.kill` on the old shell pid 5 s after taskkill ended it). Direct mode the same.
 *
 * Units: fake PTY objects shaped like node-pty 1.1.0's Windows terminal. The last block (Windows only) runs real
 * node-pty shells through the Terminal Server's `handleMessage` and counts this process's conhost children.
 */
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createRequire } from 'module'
import { execFileSync, type ChildProcess } from 'child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron (PLAN-036 T0389)')
})

import { releaseExitedPty } from '../terminal-server/process-tree'
import { TerminalServer, type TerminalServerDeps } from '../terminal-server/server'
import type { ServerRequest, ServerResponse } from '../terminal-server/protocol'
import type { ExecFileLike } from '../terminal-server/process-tree'
import { PtyManager, type PtyManagerDeps } from '../pty-manager'
import { logger } from '../logger'

const IS_WIN = process.platform === 'win32'
const REPO = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8')

/** A fake of node-pty 1.1.0's WindowsTerminal (`_agent` = WindowsPtyAgent); `calls` records the order. */
function fakeWinPty(pid: number) {
  const calls: string[] = []
  const inSocket = { destroyed: false, destroy: vi.fn(() => { calls.push('conin'); inSocket.destroyed = true }) }
  const native = { kill: vi.fn((h: number) => { calls.push(`native-kill:${h}`) }) }
  const conout = { dispose: vi.fn(() => { calls.push('conout') }) }
  const proc = {
    pid,
    calls,
    kill: vi.fn(() => { calls.push('node-pty-kill') }),
    write: vi.fn(),
    resize: vi.fn(),
    _close: vi.fn(() => { calls.push('close') }),
    _agent: { _ptyNative: native, _pty: pid + 1, inSocket, _conoutSocketWorker: conout },
  }
  return { proc, calls, native, inSocket, conout }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('releaseExitedPty', () => {
  it('not win32 → skipped before the PTY object is even read', () => {
    const proc = new Proxy({}, { get: () => { throw new Error('must not be read') } })
    for (const platform of ['darwin', 'linux'] as const) expect(releaseExitedPty(proc, platform)).toBe('skipped:not-win32')
  })

  it('win32: _close → ClosePseudoConsole → conin → conout relay, never node-pty kill(); a second call → skipped:already', () => {
    const f = fakeWinPty(10)
    expect(releaseExitedPty(f.proc, 'win32')).toBe('released')
    expect(f.calls).toEqual(['close', 'native-kill:11', 'conin', 'conout'])
    expect(f.proc.kill).not.toHaveBeenCalled()
    expect(releaseExitedPty(f.proc, 'win32')).toBe('skipped:already')
    expect(f.native.kill).toHaveBeenCalledTimes(1)
    expect(f.calls).toHaveLength(4)
  })

  it('win32: an already destroyed conin socket is not destroyed again; one failing step does not skip the others', () => {
    const f = fakeWinPty(20)
    f.inSocket.destroyed = true
    f.native.kill.mockImplementation(() => { throw new Error('x') })
    expect(releaseExitedPty(f.proc, 'win32')).toBe('failed:pseudo-console')
    expect(f.inSocket.destroy).not.toHaveBeenCalled()
    expect(f.conout.dispose).toHaveBeenCalledTimes(1)
  })

  it('win32: anything that is not node-pty 1.1.0’s Windows shape is left alone', () => {
    expect(releaseExitedPty(undefined, 'win32')).toBe('skipped:shape')
    expect(releaseExitedPty({ pid: 1, kill: vi.fn() }, 'win32')).toBe('skipped:shape')
    for (const drop of ['_ptyNative', '_pty', 'inSocket', '_conoutSocketWorker'] as const) {
      const f = fakeWinPty(30)
      delete (f.proc._agent as Record<string, unknown>)[drop]
      expect(releaseExitedPty(f.proc, 'win32')).toBe('skipped:shape')
      expect(f.calls).toEqual([])
    }
    const throwing = { _agent: Object.defineProperty({}, '_ptyNative', { get: () => { throw new Error('x') } }) }
    expect(releaseExitedPty(throwing, 'win32')).toBe('skipped:shape')
  })
})

interface ServerInternals {
  ptys: Map<string, { pty: unknown; pid: number; cwd: string; buffer?: unknown }>
  exitedPtys: Map<string, unknown>
  handlePtyExit(id: string, proc: unknown, exitCode: number): void
  broadcastToAll(msg: ServerResponse): void
  sendToClient(msg: ServerResponse): void
}

function makeServer(deps: Partial<TerminalServerDeps>) {
  const server = new TerminalServer(0, 100, { exit: () => {}, ...deps })
  const internals = server as unknown as ServerInternals
  const broadcasts: ServerResponse[] = []
  vi.spyOn(internals, 'broadcastToAll').mockImplementation((m) => { broadcasts.push(m) })
  vi.spyOn(internals, 'sendToClient').mockImplementation(() => {})
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  return { server, internals, broadcasts, stderr }
}

const tick = () => new Promise<void>((r) => setImmediate(r))

describe('Terminal Server: self-exited PTYs (fake PTYs)', () => {
  it('win32: kept while the tab is open, released by pty:kill (once), the exit is broadcast as before', async () => {
    const { server, internals, broadcasts } = makeServer({ platform: 'win32' })
    const f = fakeWinPty(100)
    internals.ptys.set('n1', { pty: f.proc, pid: 100, cwd: os.tmpdir() })
    internals.handlePtyExit('n1', f.proc, 0)
    await tick()
    expect(f.calls).toEqual([]) // option D: nothing released while the tab still shows the exit
    expect(internals.ptys.has('n1')).toBe(false)
    expect(broadcasts).toEqual([{ type: 'pty:exit', id: 'n1', exitCode: 0 }])

    server.handleMessage({ type: 'pty:kill', id: 'n1' }, 'ipc')
    expect(f.calls).toEqual(['close', 'native-kill:101', 'conin', 'conout'])
    expect(f.proc.kill).not.toHaveBeenCalled()
    server.handleMessage({ type: 'pty:kill', id: 'n1' }, 'ipc')
    expect(f.native.kill).toHaveBeenCalledTimes(1)
    expect(internals.exitedPtys.size).toBe(0)
    expect(broadcasts).toHaveLength(1)
  })

  it('win32: shutdown releases the self-exited PTYs whose tab was never closed', () => {
    const { server, internals } = makeServer({ platform: 'win32' })
    const a = fakeWinPty(110)
    const b = fakeWinPty(120)
    for (const [id, f] of [['a', a], ['b', b]] as const) {
      internals.ptys.set(id, { pty: f.proc, pid: f.proc.pid, cwd: os.tmpdir() })
      internals.handlePtyExit(id, f.proc, 0)
    }
    server.shutdown()
    expect(a.native.kill).toHaveBeenCalledTimes(1)
    expect(b.native.kill).toHaveBeenCalledTimes(1)
    expect(internals.exitedPtys.size).toBe(0)
  })

  it('win32: exits of PTYs BAT ended (kill / restart) are not kept', async () => {
    const { internals } = makeServer({ platform: 'win32' })
    const killed = fakeWinPty(130)
    internals.handlePtyExit('k1', killed.proc, 1) // entry already removed by pty:kill
    const oldPty = fakeWinPty(140)
    const newPty = fakeWinPty(150)
    internals.ptys.set('r1', { pty: newPty.proc, pid: 150, cwd: os.tmpdir() })
    internals.handlePtyExit('r1', oldPty.proc, 1) // late exit of a restarted PTY
    await tick()
    expect(internals.exitedPtys.size).toBe(0)
    expect(internals.ptys.get('r1')?.pty).toBe(newPty.proc)
    expect(newPty.calls).toEqual([])
  })

  it('not win32: nothing is kept or released; pty:kill of an unknown id does nothing', async () => {
    for (const platform of ['darwin', 'linux'] as const) {
      const { server, internals } = makeServer({ platform })
      const f = fakeWinPty(160)
      internals.ptys.set('u1', { pty: f.proc, pid: 160, cwd: os.tmpdir() })
      internals.handlePtyExit('u1', f.proc, 0)
      server.handleMessage({ type: 'pty:kill', id: 'u1' }, 'ipc')
      await tick()
      expect(internals.exitedPtys.size).toBe(0)
      expect(f.calls).toEqual([])
      vi.restoreAllMocks()
    }
  })

  it('win32 endPty (pty:kill of a live PTY): taskkill /T first, then the release; node-pty kill() is not called (BUG-238)', async () => {
    const order: string[] = []
    const execFile: ExecFileLike = (_file, args, _opts, cb) => { order.push(`taskkill ${args.join(' ')}`); setImmediate(() => cb(null)); return undefined }
    const { server, internals } = makeServer({ platform: 'win32', execFile })
    const f = fakeWinPty(170)
    internals.ptys.set('l1', { pty: f.proc, pid: 170, cwd: os.tmpdir() })
    server.handleMessage({ type: 'pty:kill', id: 'l1' }, 'ipc')
    expect(f.calls).toEqual([]) // nothing before the tree ended
    await vi.waitFor(() => expect(f.native.kill).toHaveBeenCalledTimes(1))
    expect(order).toEqual(['taskkill /F /T /PID 170'])
    expect(f.calls).toEqual(['close', 'native-kill:171', 'conin', 'conout'])
    expect(f.proc.kill).not.toHaveBeenCalled()
  })

  it('win32 endPty: a PTY of another shape still ends through its kill() after the tree (logged)', async () => {
    const execFile: ExecFileLike = (_f, _a, _o, cb) => { setImmediate(() => cb(null)); return undefined }
    const { server, internals, stderr } = makeServer({ platform: 'win32', execFile })
    const other = { pid: 180, kill: vi.fn(), write: vi.fn(), resize: vi.fn() }
    internals.ptys.set('o1', { pty: other, pid: 180, cwd: os.tmpdir() })
    server.handleMessage({ type: 'pty:kill', id: 'o1' }, 'ipc')
    await vi.waitFor(() => expect(other.kill).toHaveBeenCalledTimes(1))
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('release PTY id=o1: skipped:shape'))
  })
})

class FakeServer extends EventEmitter {
  connected = true
  sent: ServerRequest[] = []
  send = (msg: ServerRequest) => { this.sent.push(msg); return true }
  reply(msg: ServerResponse) { this.emit('message', msg) }
}

function makeManager(hostPlatform: NodeJS.Platform) {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  const server = new FakeServer()
  const emit = vi.fn<PtyManagerDeps['emit']>()
  const manager = new PtyManager({ emit, dataDir: os.tmpdir(), hostPlatform })
  manager.setServerProcess(server as unknown as ChildProcess)
  return { server, manager }
}

describe('PtyManager (host) with a Terminal Server', () => {
  const managers: PtyManager[] = []
  afterEach(() => {
    for (const m of managers.splice(0)) { m.beginShutdown(); m.dispose() }
  })

  it('win32 host: ✕ on a tab whose PTY exited by itself still sends pty:kill once (returns false: nothing ran)', () => {
    const { server, manager } = makeManager('win32')
    managers.push(manager)
    expect(manager.create({ id: 'e1', cwd: os.tmpdir(), type: 'terminal', shell: 'test-shell' })).toBe(true)
    server.reply({ type: 'pty:created', id: 'e1', pid: 100 })
    server.reply({ type: 'pty:exit', id: 'e1', exitCode: 0 })
    const before = server.sent.length
    expect(manager.kill('e1')).toBe(false)
    expect(server.sent.slice(before)).toEqual([{ type: 'pty:kill', id: 'e1' }])
    expect(manager.kill('e1')).toBe(false)
    expect(manager.kill('never-existed')).toBe(false)
    expect(server.sent.slice(before)).toEqual([{ type: 'pty:kill', id: 'e1' }])
  })

  it('win32 host: a new pty:create of the id (⏻ / restore) replaces the kill — the server releases there', () => {
    const { server, manager } = makeManager('win32')
    managers.push(manager)
    manager.create({ id: 'e2', cwd: os.tmpdir(), type: 'terminal', shell: 'test-shell' })
    server.reply({ type: 'pty:created', id: 'e2', pid: 100 })
    server.reply({ type: 'pty:exit', id: 'e2', exitCode: 0 })
    manager.create({ id: 'e2', cwd: os.tmpdir(), type: 'terminal', shell: 'test-shell' })
    server.reply({ type: 'pty:created', id: 'e2', pid: 200 })
    expect(manager.kill('e2')).toBe(true) // the live one: as before
    expect(server.sent.map((m) => m.type)).toEqual(['pty:create', 'pty:create', 'pty:kill'])
    server.reply({ type: 'pty:exit', id: 'e2', exitCode: 1 }) // exit after BAT's kill: not a self exit
    expect(manager.kill('e2')).toBe(false)
    expect(server.sent.map((m) => m.type)).toEqual(['pty:create', 'pty:create', 'pty:kill'])
  })

  it('not a win32 host: nothing changes (no pty:kill for an exited id)', () => {
    for (const platform of ['darwin', 'linux'] as const) {
      const { server, manager } = makeManager(platform)
      managers.push(manager)
      manager.create({ id: 'u1', cwd: os.tmpdir(), type: 'terminal', shell: 'test-shell' })
      server.reply({ type: 'pty:created', id: 'u1', pid: 100 })
      server.reply({ type: 'pty:exit', id: 'u1', exitCode: 0 })
      const before = server.sent.length
      expect(manager.kill('u1')).toBe(false)
      expect(server.sent.length).toBe(before)
    }
  })
})

interface ManagerInternals {
  instances: Map<string, { process: unknown; type: string; cwd: string; usePty: boolean; pid?: number }>
  handleDirectExit(id: string, proc: unknown, exitCode: number): void
}

describe('PtyManager direct mode (fake node-pty objects)', () => {
  it('win32 host: kill() of a live PTY releases it without node-pty kill(); a self-exited one is released by ✕', () => {
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    const manager = new PtyManager({ emit: vi.fn(), dataDir: os.tmpdir(), hostPlatform: 'win32' })
    const internals = manager as unknown as ManagerInternals
    const live = fakeWinPty(0) // pid 0: no taskkill
    internals.instances.set('d1', { process: live.proc, type: 'terminal', cwd: os.tmpdir(), usePty: true })
    expect(manager.kill('d1')).toBe(true)
    expect(live.calls).toEqual(['close', 'native-kill:1', 'conin', 'conout'])
    expect(live.proc.kill).not.toHaveBeenCalled()
    internals.handleDirectExit('d1', live.proc, 1) // exit after the kill: not kept
    expect(manager.kill('d1')).toBe(false)
    expect(live.native.kill).toHaveBeenCalledTimes(1)

    const self = fakeWinPty(0)
    internals.instances.set('d2', { process: self.proc, type: 'terminal', cwd: os.tmpdir(), usePty: true })
    internals.handleDirectExit('d2', self.proc, 0)
    expect(self.calls).toEqual([])
    expect(manager.kill('d2')).toBe(false)
    expect(self.calls).toEqual(['close', 'native-kill:1', 'conin', 'conout'])
    expect(self.proc.kill).not.toHaveBeenCalled()
    manager.dispose()
  })

  it('not a win32 host: kill() calls node-pty kill() as before and nothing is kept', () => {
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    const manager = new PtyManager({ emit: vi.fn(), dataDir: os.tmpdir(), hostPlatform: 'linux' })
    const internals = manager as unknown as ManagerInternals
    const live = fakeWinPty(0)
    internals.instances.set('d3', { process: live.proc, type: 'terminal', cwd: os.tmpdir(), usePty: true })
    expect(manager.kill('d3')).toBe(true)
    expect(live.calls).toEqual(['node-pty-kill'])
    const self = fakeWinPty(0)
    internals.instances.set('d4', { process: self.proc, type: 'terminal', cwd: os.tmpdir(), usePty: true })
    internals.handleDirectExit('d4', self.proc, 0)
    expect(manager.kill('d4')).toBe(false)
    expect(self.calls).toEqual([])
    manager.dispose()
  })
})

describe('source guards (T0983)', () => {
  const body = (src: string, start: string, end: string) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)))

  it('releaseExitedPty only calls the native kill — never node-pty’s kill()', () => {
    const src = read('electron/terminal-server/process-tree.ts')
    const fn = src.slice(src.indexOf('export function releaseExitedPty('))
    expect(fn.match(/\.kill\(/g)).toEqual(['.kill('])
    expect(fn).toContain('native.kill(ptyHandle)')
  })

  it('server.ts: the Windows endPty path and the exited-PTY release do not call node-pty kill()', () => {
    const src = read('electron/terminal-server/server.ts')
    const endPty = body(src, 'private endPty(', 'private listPtys(')
    const win = endPty.slice(endPty.indexOf('return killProcessTree('))
    expect(win).not.toMatch(/entry\.pty\.kill\(/)
    expect(win.indexOf('killProcessTree(')).toBeLessThan(win.indexOf('releaseExitedPty('))
    const releaseExited = body(src, 'private releaseExited(', 'private writePty(')
    expect(releaseExited).toContain('releaseExitedPty(proc')
    expect(releaseExited).not.toMatch(/\.kill\(/)
    // the release of a same-id PTY comes before the spawn
    const create = src.slice(src.indexOf('private createPty('))
    expect(create.indexOf("this.releaseExited(req.id, 'create')")).toBeGreaterThan(0)
    expect(create.indexOf("this.releaseExited(req.id, 'create')")).toBeLessThan(create.indexOf('pty.spawn('))
  })

  it('pty-manager.ts: the Windows direct kill releases after taskkill; the exited release does not call kill()', () => {
    const src = read('electron/pty-manager.ts')
    const kill = body(src, '  kill(id: string): boolean {', '  /** T0404:')
    expect(kill.indexOf("execFileSync('taskkill'")).toBeLessThan(kill.indexOf('this.releaseDirectPty(id, instance.process'))
    const exited = body(src, '  private releaseExitedDirect(', '  /**\n   * T0983: `releaseExitedPty` for a direct-mode')
    expect(exited).not.toMatch(/\.kill\(/)
  })
})

/** conhost.exe children of this process (ConPTY starts one per pseudo console). */
function conhostChildren(): number[] {
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `@(Get-CimInstance Win32_Process -Filter "ParentProcessId=${process.pid} AND Name='conhost.exe'") | ForEach-Object { $_.ProcessId }`],
  { encoding: 'utf8', timeout: 60_000, windowsHide: true })
  return out.split(/\s+/).filter(Boolean).map(Number)
}
function childPids(parent: number, name: string): number[] {
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `@(Get-CimInstance Win32_Process -Filter "ParentProcessId=${parent} AND Name='${name}'") | ForEach-Object { $_.ProcessId }`],
  { encoding: 'utf8', timeout: 60_000, windowsHide: true })
  return out.split(/\s+/).filter(Boolean).map(Number)
}
/** Main-thread write-only pipe sockets (node-pty's conin sockets), as in shared-conout-release.test.ts. */
function coninSockets(): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (process as any)._getActiveHandles().filter((h: any) =>
    h?.constructor?.name === 'Socket' && h.writable && !h.readable && h._handle?.constructor?.name === 'Pipe').length
}
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM' }
}

describe.skipIf(!IS_WIN)('Windows: real node-pty through the Terminal Server', () => {
  const cjsRequire = createRequire(__filename)
  const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

  function realServer() {
    const { server, internals, broadcasts } = makeServer({})
    const create = (id: string) => server.handleMessage({ type: 'pty:create', id, shell, args: ['-NoLogo', '-NoProfile'], cwd: os.tmpdir(), cols: 80, rows: 24 } as ServerRequest, 'ipc')
    const output = (id: string) => broadcasts.flatMap((m) => (m.type === 'pty:data' && m.id === id ? [m.data] : [])).join('')
    const prompt = (id: string) => vi.waitFor(() => expect(output(id)).toMatch(/PS [^\r\n]*>/), { timeout: 30_000, interval: 100 })
    const exits = (id: string) => broadcasts.filter((m) => m.type === 'pty:exit' && m.id === id).length
    const pidOf = (id: string) => internals.ptys.get(id)?.pid as number
    return { server, internals, broadcasts, create, prompt, exits, pidOf }
  }

  it('self exit keeps the conhost; ✕ (pty:kill) ends it; BAT’s own kill ends its conhost without the console-list agent', async () => {
    const cp = cjsRequire('child_process') as typeof import('child_process')
    const fork = vi.spyOn(cp, 'fork')
    const s = realServer()
    const before = new Set(conhostChildren())
    const self = `t0983-self-${process.pid}`
    s.create(self)
    await s.prompt(self)
    const selfConhosts = conhostChildren().filter((p) => !before.has(p))
    expect(selfConhosts).toHaveLength(1)
    s.server.handleMessage({ type: 'pty:write', id: self, data: 'exit\r' }, 'ipc')
    await vi.waitFor(() => expect(s.exits(self)).toBe(1), { timeout: 20_000, interval: 100 })
    await new Promise((r) => setTimeout(r, 1500))
    expect(alive(selfConhosts[0])).toBe(true) // option D: kept while the tab is open
    s.server.handleMessage({ type: 'pty:kill', id: self }, 'ipc')
    await vi.waitFor(() => expect(alive(selfConhosts[0])).toBe(false), { timeout: 15_000, interval: 200 })

    const live = `t0983-live-${process.pid}`
    s.create(live)
    await s.prompt(live)
    const liveConhosts = conhostChildren().filter((p) => !before.has(p))
    expect(liveConhosts).toHaveLength(1)
    s.server.handleMessage({ type: 'pty:kill', id: live }, 'ipc')
    await vi.waitFor(() => expect(s.exits(live)).toBe(1), { timeout: 20_000, interval: 100 })
    await vi.waitFor(() => expect(alive(liveConhosts[0])).toBe(false), { timeout: 15_000, interval: 200 })
    await new Promise((r) => setTimeout(r, 1000))
    // BUG-238: node-pty kill() would have forked conpty_console_list_agent
    expect(fork.mock.calls.filter(([mod]) => String(mod).includes('conpty_console_list_agent'))).toEqual([])
  }, 120_000)

  it('a process still attached to the console runs while the exited tab is open and ends on ✕', async () => {
    const s = realServer()
    const id = `t0983-attached-${process.pid}`
    s.create(id)
    await s.prompt(id)
    const shellPid = s.pidOf(id)
    s.server.handleMessage({ type: 'pty:write', id, data: "Start-Process -NoNewWindow -FilePath ping.exe -ArgumentList '-n','60','127.0.0.1'; Start-Sleep -Milliseconds 800; exit\r" }, 'ipc')
    await vi.waitFor(() => expect(s.exits(id)).toBe(1), { timeout: 20_000, interval: 100 })
    const pings = childPids(shellPid, 'PING.EXE')
    try {
      expect(pings).toHaveLength(1)
      await new Promise((r) => setTimeout(r, 1500))
      expect(alive(pings[0])).toBe(true)
      s.server.handleMessage({ type: 'pty:kill', id }, 'ipc')
      await vi.waitFor(() => expect(alive(pings[0])).toBe(false), { timeout: 15_000, interval: 200 })
    } finally {
      for (const p of pings) if (alive(p)) { try { execFileSync('taskkill', ['/F', '/PID', String(p)], { stdio: 'ignore', timeout: 3000, windowsHide: true }) } catch { /* gone */ } }
    }
  }, 120_000)

  it('direct mode (PtyManager without a server): kills leave no conin socket; a self-exited tab’s conhost ends on ✕', async () => {
    vi.spyOn(logger, 'log').mockImplementation(() => {})
    const emit = vi.fn<PtyManagerDeps['emit']>()
    const manager = new PtyManager({ emit, dataDir: os.tmpdir() })
    const output = (id: string) => emit.mock.calls.filter(([c, i]) => c === 'pty:output' && i === id).map(([, , d]) => String(d)).join('')
    const exited = (id: string) => emit.mock.calls.some(([c, i]) => c === 'pty:exit' && i === id)
    const open = async (id: string) => {
      expect(manager.create({ id, cwd: os.tmpdir(), type: 'terminal', shell, args: ['-NoLogo', '-NoProfile'] } as Parameters<PtyManager['create']>[0])).toBe(true)
      await vi.waitFor(() => expect(output(id)).toMatch(/PS [^\r\n]*>/), { timeout: 30_000, interval: 100 })
    }
    try {
      const baseline = coninSockets()
      const ids = [0, 1, 2].map((i) => `t0983-direct-${process.pid}-${i}`)
      for (const id of ids) await open(id)
      expect(coninSockets()).toBe(baseline + ids.length)
      for (const id of ids) expect(manager.kill(id)).toBe(true)
      await vi.waitFor(() => { for (const id of ids) expect(exited(id)).toBe(true) }, { timeout: 30_000, interval: 100 })
      await vi.waitFor(() => expect(coninSockets()).toBe(baseline), { timeout: 5_000, interval: 50 })

      const before = new Set(conhostChildren())
      const self = `t0983-direct-self-${process.pid}`
      await open(self)
      const conhosts = conhostChildren().filter((p) => !before.has(p))
      expect(conhosts).toHaveLength(1)
      manager.write(self, 'exit\r')
      await vi.waitFor(() => expect(exited(self)).toBe(true), { timeout: 20_000, interval: 100 })
      await new Promise((r) => setTimeout(r, 1500))
      expect(alive(conhosts[0])).toBe(true)
      expect(coninSockets()).toBe(baseline + 1)
      expect(manager.kill(self)).toBe(false)
      await vi.waitFor(() => expect(alive(conhosts[0])).toBe(false), { timeout: 15_000, interval: 200 })
      expect(coninSockets()).toBe(baseline)
    } finally {
      manager.killAll()
      manager.dispose()
    }
  }, 120_000)

  it('pty:create with the id of a self-exited PTY releases the old conhost before the new shell starts', async () => {
    const s = realServer()
    const before = new Set(conhostChildren())
    const id = `t0983-recreate-${process.pid}`
    s.create(id)
    await s.prompt(id)
    const first = conhostChildren().filter((p) => !before.has(p))
    expect(first).toHaveLength(1)
    s.server.handleMessage({ type: 'pty:write', id, data: 'exit\r' }, 'ipc')
    await vi.waitFor(() => expect(s.exits(id)).toBe(1), { timeout: 20_000, interval: 100 })
    s.create(id)
    await vi.waitFor(() => expect(alive(first[0])).toBe(false), { timeout: 15_000, interval: 200 })
    await vi.waitFor(() => expect(s.internals.ptys.has(id)).toBe(true))
    const second = conhostChildren().filter((p) => !before.has(p))
    expect(second).toHaveLength(1)
    expect(second[0]).not.toBe(first[0])
    s.server.handleMessage({ type: 'pty:kill', id }, 'ipc')
    await vi.waitFor(() => expect(alive(second[0])).toBe(false), { timeout: 15_000, interval: 200 })
  }, 120_000)
})
