// @vitest-environment node
/**
 * T0540 (PLAN-042): closing a tab in Terminal Server mode (✕ / pty:kill / pty:restart /
 * quit with stopTerminalServer) ends the PTY's whole process tree on Windows, like direct
 * mode. node-pty's kill() alone left a child the agent started without a console
 * (detached) running.
 *
 * Units inject execFile / platform / exit; the last block runs a real node-pty shell on
 * Windows with a detached grandchild. Client transport is stubbed (see
 * terminal-server-stale-exit.test.ts).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TerminalServer, type TerminalServerDeps } from '../terminal-server/server'
import { killProcessTree, isValidPid, TASKKILL_TIMEOUT_MS, type ExecFileLike } from '../terminal-server/process-tree'
import type { ServerResponse } from '../terminal-server/protocol'

type Callback = (error: Error | null) => void
interface Call { file: string; args: string[]; options: { timeout: number; windowsHide: boolean }; cb: Callback }

function fakeExecFile() {
  const calls: Call[] = []
  const execFile: ExecFileLike = (file, args, options, cb) => { calls.push({ file, args, options, cb }) }
  return { calls, execFile }
}

interface FakePty { pid: number; kill: ReturnType<typeof vi.fn>; write: () => void; resize: () => void }
interface ServerInternals {
  ptys: Map<string, { pty: unknown; pid: number; cwd: string; buffer?: unknown }>
  broadcastToAll(msg: ServerResponse): void
  sendToClient(msg: ServerResponse): void
}

function fakePty(pid: number, order?: string[]): FakePty {
  return { pid, kill: vi.fn(() => { order?.push(`pty.kill ${pid}`) }), write: vi.fn(), resize: vi.fn() }
}

function makeServer(deps: Partial<TerminalServerDeps>) {
  const server = new TerminalServer(0, 100, deps)
  const internals = server as unknown as ServerInternals
  vi.spyOn(internals, 'broadcastToAll').mockImplementation(() => { /* stub */ })
  vi.spyOn(internals, 'sendToClient').mockImplementation(() => { /* stub */ })
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  return { server, internals }
}

const flush = () => new Promise<void>(r => setTimeout(r, 0))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('killProcessTree', () => {
  it('runs taskkill /F /T /PID <pid> with a timeout and a hidden window on Windows', async () => {
    const { calls, execFile } = fakeExecFile()
    const done = killProcessTree(4321, { platform: 'win32', execFile })
    expect(calls).toHaveLength(1)
    expect(calls[0].file).toBe('taskkill')
    expect(calls[0].args).toEqual(['/F', '/T', '/PID', '4321'])
    expect(calls[0].options).toEqual({ timeout: TASKKILL_TIMEOUT_MS, windowsHide: true })
    expect(TASKKILL_TIMEOUT_MS).toBe(3000)
    calls[0].cb(null)
    await expect(done).resolves.toBe('killed')
  })

  it('resolves failed (never rejects) when taskkill errors, times out or cannot start', async () => {
    const { calls, execFile } = fakeExecFile()
    const done = killProcessTree(77, { platform: 'win32', execFile })
    calls[0].cb(Object.assign(new Error('killed'), { killed: true, signal: 'SIGTERM' }))
    await expect(done).resolves.toBe('failed')

    const throwing: ExecFileLike = () => { throw new Error('spawn EPERM') }
    await expect(killProcessTree(77, { platform: 'win32', execFile: throwing })).resolves.toBe('failed')
  })

  it.each([0, -1, 1.5, NaN, Infinity, 2 ** 53, '123', '1 & calc', null, undefined])(
    'does not run taskkill for pid %p',
    async (pid) => {
      const { calls, execFile } = fakeExecFile()
      await expect(killProcessTree(pid, { platform: 'win32', execFile })).resolves.toBe('invalid-pid')
      expect(calls).toEqual([])
    },
  )

  it('does nothing outside Windows', async () => {
    const { calls, execFile } = fakeExecFile()
    for (const platform of ['darwin', 'linux'] as const) {
      await expect(killProcessTree(4321, { platform, execFile })).resolves.toBe('not-windows')
    }
    expect(calls).toEqual([])
  })

  it('isValidPid accepts positive safe integers only', () => {
    expect(isValidPid(1)).toBe(true)
    expect(isValidPid(65536)).toBe(true)
    expect(isValidPid(0)).toBe(false)
    expect(isValidPid('42')).toBe(false)
  })
})

describe('TerminalServer pty:kill', () => {
  it('Windows: taskkill the tree first, then pty.kill(); the entry is gone at once', async () => {
    const order: string[] = []
    const calls: Call[] = []
    const execFile: ExecFileLike = (file, args, options, cb) => { order.push(`${file} ${args.join(' ')}`); calls.push({ file, args, options, cb }) }
    const { server, internals } = makeServer({ platform: 'win32', execFile })
    const pty = fakePty(500, order)
    internals.ptys.set('t1', { pty, pid: 500, cwd: os.tmpdir() })

    server.handleMessage({ type: 'pty:kill', id: 't1' })

    expect(internals.ptys.has('t1')).toBe(false)
    expect(order).toEqual(['taskkill /F /T /PID 500'])
    expect(pty.kill).not.toHaveBeenCalled()
    calls[0].cb(null)
    await flush()
    expect(order).toEqual(['taskkill /F /T /PID 500', 'pty.kill 500'])
  })

  it('Windows: pty.kill() still runs when taskkill fails or times out', async () => {
    const { calls, execFile } = fakeExecFile()
    const { server, internals } = makeServer({ platform: 'win32', execFile })
    const pty = fakePty(501)
    internals.ptys.set('t1', { pty, pid: 501, cwd: os.tmpdir() })

    server.handleMessage({ type: 'pty:kill', id: 't1' })
    calls[0].cb(new Error('Command failed: taskkill (timeout)'))
    await flush()

    expect(pty.kill).toHaveBeenCalledTimes(1)
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('taskkill tree id=t1 pid=501: failed'))
  })

  it('restart (kill + create with the same id) runs taskkill for the old pid only', async () => {
    const { calls, execFile } = fakeExecFile()
    const { server, internals } = makeServer({ platform: 'win32', execFile })
    const oldPty = fakePty(600)
    internals.ptys.set('t1', { pty: oldPty, pid: 600, cwd: os.tmpdir() })

    server.handleMessage({ type: 'pty:kill', id: 't1' })
    // the new PTY takes the id before taskkill returns
    const newPty = fakePty(601)
    internals.ptys.set('t1', { pty: newPty, pid: 601, cwd: os.tmpdir() })
    calls[0].cb(null)
    await flush()

    expect(calls.map(c => c.args)).toEqual([['/F', '/T', '/PID', '600']])
    expect(oldPty.kill).toHaveBeenCalledTimes(1)
    expect(newPty.kill).not.toHaveBeenCalled()
    expect(internals.ptys.get('t1')?.pty).toBe(newPty)
  })

  it('macOS / Linux: pty.kill() synchronously, no taskkill (unchanged)', () => {
    const { calls, execFile } = fakeExecFile()
    for (const platform of ['darwin', 'linux'] as const) {
      const { server, internals } = makeServer({ platform, execFile })
      const pty = fakePty(700)
      internals.ptys.set('t1', { pty, pid: 700, cwd: os.tmpdir() })
      server.handleMessage({ type: 'pty:kill', id: 't1' })
      expect(pty.kill).toHaveBeenCalledTimes(1)
      vi.restoreAllMocks()
    }
    expect(calls).toEqual([])
  })

  it('unknown id: nothing to kill', () => {
    const { calls, execFile } = fakeExecFile()
    const { server } = makeServer({ platform: 'win32', execFile })
    server.handleMessage({ type: 'pty:kill', id: 'missing' })
    expect(calls).toEqual([])
  })
})

describe('TerminalServer shutdown (quit with stopTerminalServer / fresh start / idle)', () => {
  function withUserData() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0540-ts-'))
    fs.writeFileSync(path.join(dir, 'bat-pty-server.pid'), '1234')
    fs.writeFileSync(path.join(dir, 'bat-pty-server.port'), '5678')
    return dir
  }

  it('Windows: exits and removes the pid file only after every tree was taskkilled', async () => {
    const { calls, execFile } = fakeExecFile()
    const exit = vi.fn()
    const { server, internals } = makeServer({ platform: 'win32', execFile, exit })
    const dir = withUserData()
    ;(server as unknown as { _userDataPath: string })._userDataPath = dir
    const a = fakePty(801)
    const b = fakePty(802)
    internals.ptys.set('a', { pty: a, pid: 801, cwd: dir })
    internals.ptys.set('b', { pty: b, pid: 802, cwd: dir })

    server.handleMessage({ type: 'server:shutdown' })

    expect(calls.map(c => c.args[3])).toEqual(['801', '802'])
    expect(internals.ptys.size).toBe(0)
    calls[0].cb(null)
    await flush()
    expect(exit).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(dir, 'bat-pty-server.pid'))).toBe(true)

    calls[1].cb(new Error('timeout'))
    await flush()
    expect(a.kill).toHaveBeenCalledTimes(1)
    expect(b.kill).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(0)
    expect(fs.existsSync(path.join(dir, 'bat-pty-server.pid'))).toBe(false)
    expect(fs.existsSync(path.join(dir, 'bat-pty-server.port'))).toBe(false)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('a second shutdown and any message during shutdown are ignored', async () => {
    const { calls, execFile } = fakeExecFile()
    const exit = vi.fn()
    const { server, internals } = makeServer({ platform: 'win32', execFile, exit })
    internals.ptys.set('a', { pty: fakePty(901), pid: 901, cwd: os.tmpdir() })

    server.handleMessage({ type: 'server:shutdown' })
    server.shutdown()
    server.handleMessage({ type: 'server:shutdown' })
    server.handleMessage({ type: 'pty:create', id: 'n', shell: 'cmd.exe', args: [], cwd: os.tmpdir(), cols: 80, rows: 24 })

    expect(calls).toHaveLength(1)
    expect(internals.ptys.size).toBe(0)
    calls[0].cb(null)
    await flush()
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('no PTYs: exits right away', async () => {
    const exit = vi.fn()
    const { server } = makeServer({ platform: 'win32', execFile: fakeExecFile().execFile, exit })
    server.shutdown()
    await flush()
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('macOS / Linux: pty.kill() for each, then exit (no taskkill)', async () => {
    const { calls, execFile } = fakeExecFile()
    const exit = vi.fn()
    const { server, internals } = makeServer({ platform: 'linux', execFile, exit })
    const a = fakePty(1001)
    internals.ptys.set('a', { pty: a, pid: 1001, cwd: os.tmpdir() })
    server.shutdown()
    expect(a.kill).toHaveBeenCalledTimes(1)
    await flush()
    expect(exit).toHaveBeenCalledWith(0)
    expect(calls).toEqual([])
  })
})

describe('main.ts quit (stopTerminalServer=true) on Windows', () => {
  it('asks the forked server to shut down over IPC instead of kill(SIGTERM) (= TerminateProcess)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8')
    const start = src.indexOf('async function stopTerminalServerGracefully')
    const stepA = src.slice(start, src.indexOf('// Step B', start))
    expect(stepA).toMatch(/process\.platform === 'win32'[\s\S]*child\.send\(\{ type: 'server:shutdown' \}\)[\s\S]*child\.kill\('SIGTERM'\)/)
  })
})

// ── Real node-pty on Windows: a detached grandchild no longer survives pty:kill ──────────

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

async function until(pred: () => boolean, ms: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (pred()) return true
    await new Promise(r => setTimeout(r, 100))
  }
  return pred()
}

describe.runIf(process.platform === 'win32')('real node-pty (Windows)', () => {
  it('pty:kill ends the shell, the agent and its detached child', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0540-real-'))
    const outFile = path.join(dir, 'pids.json')
    const sim = path.join(dir, 'agent-sim.js')
    fs.writeFileSync(sim, [
      "const { spawn } = require('child_process')",
      "const keep = 'setInterval(() => {}, 1e9)'",
      "const d = spawn(process.execPath, ['-e', keep], { stdio: 'ignore', detached: true, windowsHide: true })",
      'd.unref()',
      `require('fs').writeFileSync(${JSON.stringify(outFile)}, JSON.stringify({ agent: process.pid, detached: d.pid }))`,
      'setInterval(() => {}, 1e9)',
    ].join('\n'))
    const server = new TerminalServer(0, 100)
    const internals = server as unknown as ServerInternals
    vi.spyOn(internals, 'broadcastToAll').mockImplementation(() => { /* stub */ })
    vi.spyOn(internals, 'sendToClient').mockImplementation(() => { /* stub */ })
    let pids: { agent: number; detached: number } | null = null
    try {
      server.handleMessage({ type: 'pty:create', id: 'r1', shell: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', args: [], cwd: dir, cols: 80, rows: 24 })
      const shellPid = internals.ptys.get('r1')!.pid
      server.handleMessage({ type: 'pty:write', id: 'r1', data: `"${process.execPath}" "${sim}"\r` })
      expect(await until(() => fs.existsSync(outFile), 15000)).toBe(true)
      await new Promise(r => setTimeout(r, 200))
      pids = JSON.parse(fs.readFileSync(outFile, 'utf8'))
      expect(pidAlive(pids!.detached)).toBe(true)

      server.handleMessage({ type: 'pty:kill', id: 'r1' })

      expect(await until(() => !pidAlive(pids!.detached) && !pidAlive(pids!.agent) && !pidAlive(shellPid), 8000)).toBe(true)
    } finally {
      for (const pid of pids ? [pids.agent, pids.detached] : []) {
        if (pidAlive(pid)) spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { timeout: 5000, windowsHide: true })
      }
      for (const [, entry] of internals.ptys) {
        try { (entry.pty as { kill(): void }).kill() } catch { /* gone */ }
      }
      internals.ptys.clear()
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* still locked */ }
    }
  }, 30000)
})
