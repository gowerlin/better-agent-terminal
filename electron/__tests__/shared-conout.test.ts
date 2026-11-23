// T0887 (PLAN-066, D308) — one conout Worker for the whole Terminal Server on Windows (electron/terminal-server/shared-conout.ts).
//
// - installSharedConout guards: not win32 reads nothing; version ≠ 1.1.0, class / agent of another shape, missing Worker
//   script, unreadable package → `skipped:<reason>` and the export is left alone; install is idempotent;
// - SharedConoutConnection lifecycle with a fake Worker: one Worker for many PTYs, `ready` routed by id, `<pipe>-worker`,
//   1 s drain before `close`, Worker ended after the last relay closes and started again for the next PTY, logs on error /
//   unexpected exit (never PTY output);
// - the real Worker script relays a pipe (all platforms: named pipe on Windows, unix socket elsewhere);
// - Windows only, real node-pty 1.1.0 in a child process (so the vitest process never runs a patched node-pty):
//   `installed`, 3 PTYs with complete, in-order output, exactly 1 Worker, `exit 7` → 7, kill during heavy output does not
//   hang, the Worker ends after the last PTY and the event loop ends by itself;
// - source guards: only server.ts installs it, before the first spawn; pty-manager.ts (direct mode) does not.
import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import { Worker } from 'worker_threads'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SHARED_CONOUT_FLUSH_DATA_INTERVAL_MS,
  SHARED_CONOUT_NODE_PTY_VERSION,
  SHARED_CONOUT_WORKER_FILE,
  installSharedConout,
  unpackedScriptPath,
  type SharedConoutWorker,
  type WorkerMessage,
} from '../terminal-server/shared-conout'

const REPO = path.resolve(__dirname, '..', '..')
const WORKER_SCRIPT = path.join(REPO, 'electron', 'terminal-server', SHARED_CONOUT_WORKER_FILE)
const REAL_NODE_PTY_DIR = path.join(REPO, 'node_modules', '@lydell', 'node-pty')
const AGENT_LINE = '        this._conoutSocketWorker = new windowsConoutConnection_1.ConoutConnection(term.conout);\n'

const tmpDirs: string[] = []
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0887-'))
  tmpDirs.push(d)
  return d
}
afterEach(() => {
  vi.useRealTimers()
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

/** A stand-in for the node-pty package: package.json, windowsPtyAgent.js, windowsConoutConnection.js (stock-like class). */
function fakeNodePty({
  version = SHARED_CONOUT_NODE_PTY_VERSION,
  agentSource = `"use strict";\n${AGENT_LINE}`,
  withOnReady = true,
}: { version?: string; agentSource?: string; withOnReady?: boolean } = {}): string {
  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@lydell/node-pty', version }))
  fs.writeFileSync(path.join(dir, 'windowsPtyAgent.js'), agentSource)
  fs.writeFileSync(path.join(dir, 'windowsConoutConnection.js'), [
    '"use strict";',
    'function ConoutConnection(name) { this.name = name }',
    withOnReady ? 'Object.defineProperty(ConoutConnection.prototype, "onReady", { get: function () { return function () {} } })' : '',
    'ConoutConnection.prototype.dispose = function () {}',
    'ConoutConnection.prototype.connectSocket = function () {}',
    'exports.ConoutConnection = ConoutConnection',
    '',
  ].join('\n'))
  return dir
}

function conoutModuleOf(dir: string): { ConoutConnection: any } { // eslint-disable-line @typescript-eslint/no-explicit-any
  return require(path.join(dir, 'windowsConoutConnection.js'))
}

class FakeWorker extends EventEmitter implements SharedConoutWorker {
  readonly posted: unknown[] = []
  terminated = 0
  postMessage(message: unknown): void { this.posted.push(message) }
  terminate(): Promise<number> {
    this.terminated++
    queueMicrotask(() => this.emit('exit', 1))
    return Promise.resolve(1)
  }
  reply(message: WorkerMessage): void { this.emit('message', message) }
}

function installFake(): { dir: string; workers: FakeWorker[]; logs: string[]; Conn: any } { // eslint-disable-line @typescript-eslint/no-explicit-any
  const dir = fakeNodePty()
  const workers: FakeWorker[] = []
  const logs: string[] = []
  const result = installSharedConout(dir, {
    platform: 'win32',
    workerScript: WORKER_SCRIPT,
    log: (line) => logs.push(line),
    createWorker: () => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    },
  })
  expect(result).toBe('installed')
  return { dir, workers, logs, Conn: conoutModuleOf(dir).ConoutConnection }
}

describe('installSharedConout: when it does not replace anything', () => {
  it('not win32 → skipped:not-win32 before anything is read (the package-dir function is not even called)', () => {
    const dirFn = vi.fn(() => { throw new Error('must not be called') })
    const createWorker = vi.fn()
    for (const platform of ['linux', 'darwin'] as const) {
      expect(installSharedConout(dirFn, { platform, createWorker })).toBe('skipped:not-win32')
    }
    expect(dirFn).not.toHaveBeenCalled()
    expect(createWorker).not.toHaveBeenCalled()
  })

  it.each([
    ['another node-pty version', () => fakeNodePty({ version: '1.2.0-beta.18' }), 'skipped:version-1.2.0-beta.18'],
    ['a class without the onReady getter', () => fakeNodePty({ withOnReady: false }), 'skipped:shape'],
    ['an agent that no longer constructs the class from the exports', () => fakeNodePty({ agentSource: '"use strict";\nconst { ConoutConnection } = require("./windowsConoutConnection");\n' }), 'skipped:agent-shape'],
  ])('%s → %s, the export is left alone', (_name, make, expected) => {
    const dir = make()
    const before = conoutModuleOf(dir).ConoutConnection
    expect(installSharedConout(dir, { platform: 'win32', workerScript: WORKER_SCRIPT })).toBe(expected)
    expect(conoutModuleOf(dir).ConoutConnection).toBe(before)
  })

  it('package that cannot be read → skipped:load-failed; Worker script missing → skipped:worker-missing (export unchanged)', () => {
    expect(installSharedConout(path.join(tmp(), 'none'), { platform: 'win32', workerScript: WORKER_SCRIPT })).toBe('skipped:load-failed')
    expect(installSharedConout(() => { throw new Error('resolve failed') }, { platform: 'win32', workerScript: WORKER_SCRIPT })).toBe('skipped:load-failed')
    const dir = fakeNodePty()
    const before = conoutModuleOf(dir).ConoutConnection
    expect(installSharedConout(dir, { platform: 'win32', workerScript: path.join(tmp(), SHARED_CONOUT_WORKER_FILE) })).toBe('skipped:worker-missing')
    expect(conoutModuleOf(dir).ConoutConnection).toBe(before)
  })

  it('the real node-pty in node_modules is the pinned 1.1.0 and still has the shape the replacement relies on', () => {
    expect(JSON.parse(fs.readFileSync(path.join(REAL_NODE_PTY_DIR, 'package.json'), 'utf8')).version).toBe(SHARED_CONOUT_NODE_PTY_VERSION)
    expect(fs.readFileSync(path.join(REAL_NODE_PTY_DIR, 'windowsPtyAgent.js'), 'utf8')).toContain('new windowsConoutConnection_1.ConoutConnection(')
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'))
    expect(pkg.optionalDependencies['@lydell/node-pty']).toBe(SHARED_CONOUT_NODE_PTY_VERSION) // exact pin, no ^
    expect(pkg.build.asarUnpack).toContain(`dist-electron/${SHARED_CONOUT_WORKER_FILE}`)
  })
})

describe('installSharedConout: the replacement class (fake Worker)', () => {
  it('replaces the export once; a second install keeps the same class and says installed', () => {
    const { dir, Conn } = installFake()
    expect(Conn.__batSharedConout).toBe(true)
    expect(installSharedConout(dir, { platform: 'win32', workerScript: WORKER_SCRIPT })).toBe('installed')
    expect(conoutModuleOf(dir).ConoutConnection).toBe(Conn)
  })

  it('3 PTYs share 1 Worker; ready is routed by id; connectSocket uses <pipe>-worker', () => {
    const { workers, Conn } = installFake()
    const conns = ['\\\\.\\pipe\\conout-a', '\\\\.\\pipe\\conout-b', '\\\\.\\pipe\\conout-c'].map((name) => new Conn(name))
    expect(workers).toHaveLength(1)
    expect(workers[0].posted).toEqual([
      { type: 'open', id: 1, conoutPipeName: '\\\\.\\pipe\\conout-a' },
      { type: 'open', id: 2, conoutPipeName: '\\\\.\\pipe\\conout-b' },
      { type: 'open', id: 3, conoutPipeName: '\\\\.\\pipe\\conout-c' },
    ])
    const fired = conns.map(() => vi.fn())
    conns.forEach((c, i) => c.onReady(fired[i]))
    const off = conns[0].onReady(vi.fn())
    off.dispose()
    workers[0].reply({ type: 'ready', id: 2 })
    expect(fired.map((f) => f.mock.calls.length)).toEqual([0, 1, 0])
    const socket = { connect: vi.fn() }
    conns[1].connectSocket(socket)
    expect(socket.connect).toHaveBeenCalledWith('\\\\.\\pipe\\conout-b-worker')
  })

  it('dispose drains for FLUSH_DATA_INTERVAL before close; the Worker ends after the last relay closes; the next PTY starts a new one', async () => {
    vi.useFakeTimers()
    const { workers, logs, Conn } = installFake()
    const a = new Conn('pipe-a')
    const b = new Conn('pipe-b')
    a.dispose()
    a.dispose() // twice → one close
    vi.advanceTimersByTime(SHARED_CONOUT_FLUSH_DATA_INTERVAL_MS - 1)
    expect(workers[0].posted.filter((m: any) => m.type === 'close')).toEqual([]) // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.advanceTimersByTime(1)
    expect(workers[0].posted.filter((m: any) => m.type === 'close')).toEqual([{ type: 'close', id: 1 }]) // eslint-disable-line @typescript-eslint/no-explicit-any
    workers[0].reply({ type: 'closed', id: 1 })
    expect(workers[0].terminated).toBe(0) // b still open
    b.dispose()
    vi.advanceTimersByTime(SHARED_CONOUT_FLUSH_DATA_INTERVAL_MS)
    workers[0].reply({ type: 'closed', id: 2 })
    expect(workers[0].terminated).toBe(1)
    await Promise.resolve()
    expect(logs).toEqual([]) // an exit this module asked for is not logged

    const c = new Conn('pipe-c')
    expect(workers).toHaveLength(2)
    expect(workers[1].posted).toEqual([{ type: 'open', id: 1, conoutPipeName: 'pipe-c' }])
    c.dispose()
  })

  it('a relay that closes while another PTY is being created keeps the Worker', () => {
    const { workers, Conn } = installFake()
    new Conn('pipe-a').dispose()
    new Conn('pipe-b') // created before the Worker reports pipe-a closed
    workers[0].reply({ type: 'closed', id: 1 })
    expect(workers[0].terminated).toBe(0)
    expect(workers).toHaveLength(1)
  })

  it('Worker error / unexpected exit: one log line each (no pipe name, no output); the next PTY starts a new Worker', () => {
    const { workers, logs, Conn } = installFake()
    const a = new Conn('\\\\.\\pipe\\secret-a')
    workers[0].emit('error', Object.assign(new Error('boom'), { code: 'ERR_WORKER_INIT_FAILED' }))
    workers[0].emit('exit', 1)
    expect(logs).toEqual([
      '[shared-conout] worker error (ERR_WORKER_INIT_FAILED); 1 PTY(s) lose their output',
      '[shared-conout] worker exited unexpectedly (code 1); 1 PTY(s) lose their output, the next PTY starts a new worker',
    ])
    expect(logs.join('\n')).not.toContain('secret')
    expect(() => a.dispose()).not.toThrow()
    new Conn('pipe-b')
    expect(workers).toHaveLength(2)
  })
})

describe('unpackedScriptPath', () => {
  it('prefers the app.asar.unpacked copy when it exists (a Worker reads real files), otherwise keeps the path', () => {
    const asar = path.join('C:', 'BAT', 'resources', 'app.asar', 'dist-electron', SHARED_CONOUT_WORKER_FILE)
    const unpacked = path.join('C:', 'BAT', 'resources', 'app.asar.unpacked', 'dist-electron', SHARED_CONOUT_WORKER_FILE)
    expect(unpackedScriptPath(asar, (p) => p === unpacked)).toBe(unpacked)
    expect(unpackedScriptPath(asar, () => false)).toBe(asar)
    const plain = path.join('C:', 'holder', SHARED_CONOUT_WORKER_FILE)
    expect(unpackedScriptPath(plain, () => true)).toBe(plain)
  })
})

describe('the real Worker script relays a pipe', () => {
  it('open → ready, data reaches the <pipe>-worker client, close → closed; an unreachable pipe → closed only for that id', async () => {
    const name = process.platform === 'win32'
      ? `\\\\.\\pipe\\bat-t0887-${process.pid}-${Date.now()}`
      : path.join(tmp(), 'conout.sock')
    const conout = net.createServer((s) => { s.write('hello '); s.write('world') })
    await new Promise<void>((resolve) => conout.listen(name, resolve))
    const worker = new Worker(WORKER_SCRIPT)
    const messages: WorkerMessage[] = []
    const next = (pred: (m: WorkerMessage) => boolean) => new Promise<void>((resolve) => {
      const check = (m: WorkerMessage) => { messages.push(m); if (pred(m)) { worker.off('message', check); resolve() } }
      worker.on('message', check)
    })
    try {
      const missing = process.platform === 'win32' ? `${name}-missing` : path.join(tmp(), 'missing.sock')
      const missingClosed = next((m) => m.type === 'closed' && m.id === 9)
      worker.postMessage({ type: 'open', id: 9, conoutPipeName: missing })
      await missingClosed

      const ready = next((m) => m.type === 'ready' && m.id === 1)
      worker.postMessage({ type: 'open', id: 1, conoutPipeName: name })
      await ready
      const client = net.connect(`${name}-worker`)
      client.setEncoding('utf8')
      let got = ''
      await new Promise<void>((resolve) => client.on('data', (d) => { got += d; if (got === 'hello world') resolve() }))
      const closed = next((m) => m.type === 'closed' && m.id === 1)
      worker.postMessage({ type: 'close', id: 1 })
      await closed
      await new Promise<void>((resolve) => client.on('close', () => resolve()))
      expect(messages.some((m) => m.type === 'ready' && m.id === 9)).toBe(false)
    } finally {
      await worker.terminate()
      conout.close()
    }
  }, 20000)
})

// The child runs real node-pty 1.1.0 with the replacement installed, prints one JSON line per event on stdout, and is
// never told to exit: the parent checks that it ends by itself. A watchdog (unref'd) ends it with 99 after 25 s.
const CHILD_SCRIPT = `
const { Worker } = require('worker_threads')
const { installSharedConout } = require(process.env.SC_MODULE)
const emit = (o) => process.stdout.write(JSON.stringify(o) + '\\n')
setTimeout(() => { emit({ event: 'watchdog', handles: process.getActiveResourcesInfo() }); process.exit(99) }, 25000).unref()
let workers = 0
const result = installSharedConout(() => process.env.SC_PTY, {
  log: (line) => emit({ event: 'log', line }),
  createWorker: (script) => { workers++; const w = new Worker(script); w.on('exit', () => emit({ event: 'worker-exit' })); return w },
})
emit({ event: 'install', result })
const pty = require(process.env.SC_PTY)
const spawnNode = (code) => pty.spawn(process.execPath, ['-e', code], { cols: 120, rows: 30, cwd: process.cwd(), env: process.env })
// BAT's endPty calls kill() after the exit too (node-pty#887: without it node-pty keeps the relay)
const run = (code) => new Promise((resolve) => {
  const p = spawnNode(code)
  let out = ''
  p.onData((d) => { out += d })
  p.onExit(({ exitCode }) => { try { p.kill() } catch {} resolve({ out, exitCode, shared: p._agent._conoutSocketWorker.constructor.__batSharedConout === true }) })
})
;(async () => {
  const lines = Number(process.env.SC_LINES)
  const printer = 'for(let i=0;i<' + lines + ';i++)process.stdout.write("L"+i+"\\\\n")'
  const three = await Promise.all([run(printer), run(printer), run(printer)])
  for (const r of three) {
    const nums = [...r.out.matchAll(/L(\\d+)/g)].map((m) => Number(m[1]))
    emit({ event: 'output', count: nums.length, inOrder: nums.every((n, i) => n === i), exitCode: r.exitCode, shared: r.shared })
  }
  const seven = await run('process.exit(7)')
  emit({ event: 'exit7', exitCode: seven.exitCode })
  const killed = await new Promise((resolve) => {
    const p = spawnNode('for(;;)process.stdout.write("x".repeat(200)+"\\\\n")')
    let got = 0
    let killedAt = 0
    p.onData((d) => { got += d.length; if (!killedAt && got > 200000) { killedAt = Date.now(); p.kill() } })
    p.onExit(({ exitCode }) => resolve({ exitCode, ms: Date.now() - killedAt }))
  })
  emit({ event: 'kill', exitCode: killed.exitCode, ms: killed.ms })
  emit({ event: 'done', workers })
  const t = Date.now()
  process.on('exit', () => emit({ event: 'exit', afterDoneMs: Date.now() - t }))
})()
`

describe('Windows: real node-pty 1.1.0 with the shared Worker (child process)', () => {
  it.skipIf(process.platform !== 'win32')('installed; 3 PTYs complete and in order; 1 Worker; exit 7; kill under load; Worker ends and the event loop ends by itself', async () => {
    const dir = tmp()
    const script = path.join(dir, 'child.cjs')
    fs.writeFileSync(script, CHILD_SCRIPT)
    const started = Date.now()
    const { code, stdout } = await new Promise<{ code: number | null; stdout: string }>((resolve) => {
      const child = spawn(process.execPath, ['--import', 'tsx', script], {
        cwd: REPO,
        env: {
          ...process.env,
          SC_MODULE: path.join(REPO, 'electron', 'terminal-server', 'shared-conout.ts'),
          SC_PTY: REAL_NODE_PTY_DIR,
          SC_LINES: '3000',
        },
        stdio: ['ignore', 'pipe', 'ignore'], // stderr: node-pty's console-list agent prints "AttachConsole failed" (stock too)
        windowsHide: true,
      })
      let out = ''
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (d) => { out += d })
      child.on('exit', (c) => resolve({ code: c, stdout: out }))
    })
    const events = stdout.split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l))
    const of = (name: string) => events.filter((e) => e.event === name)
    expect(of('watchdog'), stdout).toEqual([])
    expect(code, stdout).toBe(0)
    expect(of('install')).toEqual([{ event: 'install', result: 'installed' }])
    expect(of('output')).toEqual(Array.from({ length: 3 }, () => ({ event: 'output', count: 3000, inOrder: true, exitCode: 0, shared: true })))
    expect(of('exit7')).toEqual([{ event: 'exit7', exitCode: 7 }])
    expect(of('kill')[0].ms).toBeLessThan(5000)
    expect(of('done')).toEqual([{ event: 'done', workers: 1 }]) // one Worker for all 5 PTYs
    expect(of('worker-exit')).toHaveLength(1) // ended after the last PTY
    expect(of('log')).toEqual([])
    expect(of('exit')[0].afterDoneMs).toBeLessThan(15000) // T0886 S7: by itself within 15 s
    expect(Date.now() - started).toBeLessThan(60000)
  }, 90000)
})

describe('source guards', () => {
  const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8')
  const sourceFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(full)
    return /\.tsx?$/.test(e.name) ? [full] : []
  })

  it('only electron/terminal-server/server.ts installs it (direct mode, pty-manager.ts, does not — D308 Q-B)', () => {
    const callers = sourceFiles(path.join(REPO, 'electron'))
      .map((f) => path.relative(REPO, f).split(path.sep).join('/'))
      .filter((rel) => rel !== 'electron/terminal-server/shared-conout.ts')
      .filter((rel) => /\binstallSharedConout\s*\(/.test(read(rel)) || /shared-conout/.test(read(rel)))
    expect(callers).toEqual(['electron/terminal-server/server.ts'])
    expect(read('electron/terminal-server/server.ts').match(/\binstallSharedConout\s*\(/g)).toHaveLength(1)
  })

  it('server.ts installs it in createPty right before the spawn', () => {
    const src = read('electron/terminal-server/server.ts')
    const create = src.slice(src.indexOf('private createPty('))
    const ensure = create.indexOf('ensureSharedConout()')
    expect(ensure).toBeGreaterThan(0)
    expect(ensure).toBeLessThan(create.indexOf('pty.spawn('))
  })

  it('shared-conout.ts: no electron import, nothing at import time but declarations', () => {
    const src = read('electron/terminal-server/shared-conout.ts')
    expect(src).not.toMatch(/from 'electron'|require\('electron'\)/)
    const topLevelCalls = src.split('\n').filter((l) => /^[a-zA-Z_$][\w$.]*\s*\(/.test(l))
    expect(topLevelCalls).toEqual([])
  })

  it('vite emits the Worker next to terminal-server.js', () => {
    const vite = read('vite.config.ts')
    expect(vite).toContain("electron/terminal-server/shared-conout-worker.cjs")
    expect(vite).toContain("fileName: 'shared-conout-worker.cjs'")
  })
})
