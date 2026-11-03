// @vitest-environment node
/**
 * BUG-205 / T0806 (D252): on Linux a PTY child keeps only fd 0–2 (electron/pty-spawn-fd-guard.ts).
 *
 * - guardPtySpawnFds: Linux → /bin/bash (then /usr/bin/bash) with the fixed script, the original
 *   file / args as positional parameters (spaces, quotes, `$`, `-l`, empty strings verbatim);
 *   not Linux → the very same command objects; Linux without bash → unchanged + `no-bash`;
 *   BASH_ENV leaves the wrapper's env and comes back through `$2`; flags for absent PWD / SHLVL
 * - PtyManager direct node-pty branch and its child_process fallback spawn the guarded command on
 *   Linux and exactly the old one elsewhere (injected `fdGuard` deps); logs on Linux only, no env values
 * - Terminal Server createPty: same, plus `pty:created.fdGuard` only from Linux; PtyManager logs it
 * - Linux only (CI ubuntu): the real script through /bin/bash — fd 3 given by spawn is closed,
 *   pid / argv / env / cwd are the original ones
 */
import type { ChildProcess } from 'child_process'
import * as childProcess from 'child_process'
import { EventEmitter } from 'events'
import { createRequire } from 'module'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager / pty-spawn-fd-guard must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))
const cpSpawn = vi.hoisted(() => ({ fn: null as null | ((...a: unknown[]) => unknown) }))
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return { ...actual, spawn: (...a: unknown[]) => (cpSpawn.fn ? cpSpawn.fn(...a) : (actual.spawn as (...x: unknown[]) => unknown)(...a)) }
})

import { logger } from '../logger'
import {
  PTY_FD_GUARD_BASH_CANDIDATES,
  PTY_FD_GUARD_ENV_PATH,
  PTY_FD_GUARD_NAME,
  PTY_FD_GUARD_SCRIPT,
  describePtyFdGuardSkip,
  guardPtySpawnFds,
  type PtyFdGuardDeps,
} from '../pty-spawn-fd-guard'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import type { ServerResponse } from '../terminal-server/protocol'

const LINUX: PtyFdGuardDeps = { platform: 'linux', fileExists: () => true }
const LINUX_USR_ONLY: PtyFdGuardDeps = { platform: 'linux', fileExists: p => p === '/usr/bin/bash' || p === PTY_FD_GUARD_ENV_PATH }
const LINUX_NO_BASH: PtyFdGuardDeps = { platform: 'linux', fileExists: () => false }
const LINUX_NO_ENV: PtyFdGuardDeps = { platform: 'linux', fileExists: p => p !== PTY_FD_GUARD_ENV_PATH }

describe('guardPtySpawnFds', () => {
  const env = { PATH: '/usr/bin', PWD: '/home/demo', SHLVL: '1', BAT_REMOTE_TOKEN: 'batcap.secret' }

  it('not Linux: returns the very same command (Windows / macOS spawn what they spawned before)', () => {
    for (const platform of ['win32', 'darwin'] as const) {
      const cmd = { file: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', args: ['-NoLogo'], env }
      const r = guardPtySpawnFds(cmd, { platform, fileExists: () => true })
      expect(r).toEqual({ wrapped: false, reason: 'not-linux', command: cmd })
      expect(r.command).toBe(cmd)
      expect(r.command.args).toBe(cmd.args)
      expect(r.command.env).toBe(env)
    }
  })

  it('Linux: /bin/bash -c <fixed script> <name> <flags> <BASH_ENV> <file> <args…>, env unchanged', () => {
    const args = ['-l', '-i']
    const r = guardPtySpawnFds({ file: '/bin/bash', args, env }, LINUX)
    expect(r.wrapped).toBe(true)
    expect(r.command.file).toBe('/bin/bash')
    expect(r.command.args).toEqual(['-c', PTY_FD_GUARD_SCRIPT, PTY_FD_GUARD_NAME, '-', '', '/bin/bash', '-l', '-i'])
    expect(r.command.env).toBe(env)
    expect(args).toEqual(['-l', '-i'])
    if (r.wrapped) expect(r.wrapper).toBe('/bin/bash')
  })

  it('keeps the file as given (argv[0]) and every argument verbatim, never inside the script', () => {
    const args = ['-c', 'echo "a b" $HOME \'q\'', '', '--', '-l', 'x;rm -rf /', '$(id)', '*']
    const r = guardPtySpawnFds({ file: 'zsh', args, env }, LINUX)
    expect(r.command.args.slice(5)).toEqual(['zsh', ...args])
    expect(PTY_FD_GUARD_SCRIPT).not.toContain('zsh')
    expect(r.command.args[1]).toBe(PTY_FD_GUARD_SCRIPT)
  })

  it('the script is one fixed string: closes fds >= 3 from /proc/self/fd, then execs "$@"', () => {
    expect(PTY_FD_GUARD_SCRIPT).toContain('/proc/self/fd/*')
    expect(PTY_FD_GUARD_SCRIPT).toContain('0|1|2|*[!0-9]*) ;;')
    expect(PTY_FD_GUARD_SCRIPT).toContain('exec {_bat_fd}>&-')
    expect(PTY_FD_GUARD_SCRIPT.trim().split('\n').at(-1)).toBe('exec "$@"')
    // the shell running it must not be told to read rc files: plain `-c`, no -i / -l
    const r = guardPtySpawnFds({ file: '/bin/sh', args: [], env }, LINUX)
    expect(r.command.args[0]).toBe('-c')
  })

  it('falls back to /usr/bin/bash; neither → unchanged command with reason no-bash', () => {
    const usr = guardPtySpawnFds({ file: '/bin/zsh', args: [], env }, LINUX_USR_ONLY)
    expect(usr.command.file).toBe('/usr/bin/bash')
    expect(PTY_FD_GUARD_BASH_CANDIDATES).toEqual(['/bin/bash', '/usr/bin/bash'])
    const cmd = { file: '/bin/zsh', args: ['-l'], env }
    const none = guardPtySpawnFds(cmd, LINUX_NO_BASH)
    expect(none).toEqual({ wrapped: false, reason: 'no-bash', command: cmd })
    expect(none.command).toBe(cmd)
  })

  it('BASH_ENV: not in the wrapper env (bash would source it), passed back as $2 with flag B', () => {
    const withBashEnv = { ...env, BASH_ENV: '/home/demo/.bash_env' }
    const r = guardPtySpawnFds({ file: '/bin/bash', args: [], env: withBashEnv }, LINUX)
    expect(r.command.env).not.toHaveProperty('BASH_ENV')
    expect(r.command.env).toEqual(env)
    expect(r.command.args.slice(3, 5)).toEqual(['B', '/home/demo/.bash_env'])
    expect(withBashEnv.BASH_ENV).toBe('/home/demo/.bash_env')
  })

  it('PWD / SHLVL absent → flags P / S (S only when /usr/bin/env exists); undefined counts as absent', () => {
    const bare = { PATH: '/usr/bin', PWD: undefined as string | undefined }
    expect(guardPtySpawnFds({ file: '/bin/sh', args: [], env: bare }, LINUX).command.args[3]).toBe('PS')
    expect(guardPtySpawnFds({ file: '/bin/sh', args: [], env: bare }, LINUX_NO_ENV).command.args[3]).toBe('P')
    expect(guardPtySpawnFds({ file: '/bin/sh', args: [], env: { PWD: '/', SHLVL: '0', BASH_ENV: '' } }, LINUX).command.args.slice(3, 5)).toEqual(['B', ''])
  })

  it('the skip log line names the shell, never env values', () => {
    const line = describePtyFdGuardSkip('/bin/zsh', 'node-pty t1')
    expect(line).toContain('[pty-fd-guard] node-pty t1')
    expect(line).toContain('/bin/zsh')
    expect(line).toContain('BUG-205')
  })
})

// ── PtyManager ────────────────────────────────────────────────────────────────

class FakePty {
  pid = 4242
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
}
let ptyThrows = false
const ptySpawn = vi.fn((_file: string, _args: string[], _opts: { env: Record<string, string> }) => {
  if (ptyThrows) throw new Error('node-pty broken')
  return new FakePty()
})
let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

class FakeServer extends EventEmitter {
  connected = true
  sent: Array<{ type: string; id?: string; shell?: string; args?: string[] }> = []
  send = (msg: { type: string; id?: string }) => { this.sent.push(msg); return true }
}

describe('PtyManager spawns through the fd guard on Linux only (T0806)', () => {
  let dataDir: string
  let managers: PtyManagerType[] = []
  let logs: string[]

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0806-pty-'))
    logs = []
    vi.spyOn(logger, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')) })
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    ptySpawn.mockClear()
  })

  afterEach(() => {
    for (const m of managers.splice(0)) m.dispose()
    fs.rmSync(dataDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function make(fdGuard: PtyFdGuardDeps): PtyManagerType {
    const m = new PtyManager({ emit: vi.fn(), dataDir, fdGuard })
    managers.push(m)
    return m
  }
  const CWD = os.tmpdir()

  it('node-pty, win32 / darwin: spawn(shell, args) exactly as before, no fd-guard log', () => {
    for (const platform of ['win32', 'darwin'] as const) {
      ptySpawn.mockClear()
      logs = []
      const m = make({ platform, fileExists: () => true })
      expect(m.create({ id: `t-${platform}`, cwd: CWD, type: 'terminal', shell: '/bin/zsh' })).toBe(true)
      expect(ptySpawn).toHaveBeenCalledTimes(1)
      const [file, args, opts] = ptySpawn.mock.calls[0]
      expect(file).toBe('/bin/zsh')
      expect(args).not.toContain(PTY_FD_GUARD_SCRIPT)
      expect(opts.env.PATH).toBeDefined()
      expect(logs.some(l => l.includes('pty-fd-guard'))).toBe(false)
    }
  })

  it('node-pty, Linux: spawns the guard with the original shell / args / env; pid is the spawned one', () => {
    const m = make(LINUX)
    expect(m.create({ id: 't1', cwd: CWD, type: 'terminal', shell: '/bin/zsh' })).toBe(true)
    const [file, args, opts] = ptySpawn.mock.calls[0]
    expect(file).toBe('/bin/bash')
    expect(args.slice(0, 3)).toEqual(['-c', PTY_FD_GUARD_SCRIPT, PTY_FD_GUARD_NAME])
    expect(args[5]).toBe('/bin/zsh')
    expect(opts.env.BAT_TERMINAL_ID).toBe('t1')
    expect(opts.env.TERM).toBe('xterm-256color')
    expect(logs.some(l => l.includes('[pty-fd-guard] node-pty t1: /bin/bash closes inherited fds >= 3, then execs /bin/zsh'))).toBe(true)
    expect(logs.join('\n')).not.toContain(opts.env.PATH)
  })

  it('node-pty, Linux without bash: spawns the shell directly and logs one line', () => {
    const m = make(LINUX_NO_BASH)
    m.create({ id: 't2', cwd: CWD, type: 'terminal', shell: '/bin/zsh' })
    expect(ptySpawn.mock.calls[0][0]).toBe('/bin/zsh')
    expect(logs.filter(l => l.includes('[pty-fd-guard]'))).toEqual([describePtyFdGuardSkip('/bin/zsh', 'node-pty t2')])
  })

  it('Terminal Server: pty:create carries the original shell (the server guards it); fd-guard logged from pty:created', () => {
    const m = make(LINUX)
    const server = new FakeServer()
    m.setServerProcess(server as unknown as ChildProcess)
    m.create({ id: 's1', cwd: CWD, type: 'terminal', shell: '/bin/zsh' })
    const create = server.sent.find(s => s.type === 'pty:create')
    expect(create?.shell).toBe('/bin/zsh')
    expect(create?.args).not.toContain(PTY_FD_GUARD_SCRIPT)
    server.emit('message', { type: 'pty:created', id: 's1', pid: 77, fdGuard: 'closed' })
    expect(logs).toContain('[PtyManager] server spawned PTY s1 (pid 77) fd-guard=closed')
    server.emit('message', { type: 'pty:created', id: 's1', pid: 78, fdGuard: 'no-bash' })
    expect(logs.some(l => l.includes('[pty-fd-guard] Terminal Server PTY s1: no bash'))).toBe(true)
    // a server that does not report it (Windows / macOS / older server): the pre-T0806 line
    server.emit('message', { type: 'pty:created', id: 's1', pid: 79 })
    expect(logs).toContain('[PtyManager] server spawned PTY s1 (pid 79)')
  })

  // keep last: node-pty failing turns the module's ptyAvailable off for the rest of this file
  it('child_process fallback: guarded on Linux, unchanged elsewhere', () => {
    const calls: Array<[string, string[], { env: Record<string, string> }]> = []
    cpSpawn.fn = (file, args, opts) => {
      calls.push([file as string, args as string[], opts as { env: Record<string, string> }])
      const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; stdin: { write: () => void }; pid: number; kill: () => void }
      child.kill = () => {}
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      child.stdin = { write: () => {} }
      child.pid = 99
      return child
    }
    try {
      ptyThrows = true
      make(LINUX).create({ id: 'c1', cwd: CWD, type: 'terminal', shell: '/bin/zsh' })
      ptyThrows = false
      expect(calls).toHaveLength(1)
      expect(calls[0][0]).toBe('/bin/bash')
      expect(logs.some(l => l.includes('[pty-fd-guard] child_process c1:'))).toBe(true)
      make({ platform: 'darwin', fileExists: () => true }).create({ id: 'c2', cwd: CWD, type: 'terminal', shell: '/bin/zsh' })
      expect(calls).toHaveLength(2)
      expect(calls[1][0]).toBe('/bin/zsh')
      expect(calls[1][1]).not.toContain(PTY_FD_GUARD_SCRIPT)
      // the guarded call carries exactly the shell + args the unguarded one spawns
      expect(calls[0][1].slice(5)).toEqual(['/bin/zsh', ...calls[1][1]])
    } finally {
      ptyThrows = false
      cpSpawn.fn = null
    }
  })
})

// ── Terminal Server ───────────────────────────────────────────────────────────

describe('Terminal Server createPty (T0806)', () => {
  let replies: ServerResponse[] = []

  async function serverWith(fdGuard: PtyFdGuardDeps) {
    const req = createRequire(path.resolve(__dirname, '..', 'terminal-server', 'server.ts'))
    const resolved = req.resolve('@lydell/node-pty')
    req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
    const { TerminalServer } = await import('../terminal-server/server')
    const s = new TerminalServer(0, 100, { fdGuard, exit: () => {} })
    vi.spyOn(s as unknown as { sendToClient(m: ServerResponse): void }, 'sendToClient').mockImplementation((m) => { replies.push(m) })
    vi.spyOn(s as unknown as { broadcastToAll(m: ServerResponse): void }, 'broadcastToAll').mockImplementation(() => {})
    return s
  }
  const create = (id: string) => ({ type: 'pty:create' as const, id, shell: '/bin/zsh', args: ['-l'], cwd: os.tmpdir(), cols: 80, rows: 24, env: { BAT_TERMINAL_ID: id } })

  beforeEach(() => {
    replies = []
    ptySpawn.mockClear()
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('Linux: spawns the guard; pty:created says fdGuard closed', async () => {
    const s = await serverWith(LINUX)
    s.handleMessage(create('x1'), 'ipc')
    const [file, args, opts] = ptySpawn.mock.calls[0]
    expect(file).toBe('/bin/bash')
    expect(args.slice(5)).toEqual(['/bin/zsh', '-l'])
    expect(opts.env.BAT_TERMINAL_ID).toBe('x1')
    expect(replies.find(m => m.type === 'pty:created')).toEqual({ type: 'pty:created', id: 'x1', pid: 4242, fdGuard: 'closed' })
  })

  it('win32 / darwin: spawn(shell, args) unchanged; pty:created exactly as before', async () => {
    for (const platform of ['win32', 'darwin'] as const) {
      replies = []
      ptySpawn.mockClear()
      const s = await serverWith({ platform, fileExists: () => true })
      s.handleMessage(create(`y-${platform}`), 'ipc')
      expect(ptySpawn.mock.calls[0].slice(0, 2)).toEqual(['/bin/zsh', ['-l']])
      expect(replies.find(m => m.type === 'pty:created')).toEqual({ type: 'pty:created', id: `y-${platform}`, pid: 4242 })
    }
  })

  it('Linux without bash: shell spawned directly; pty:created says no-bash', async () => {
    const s = await serverWith(LINUX_NO_BASH)
    s.handleMessage(create('z1'), 'ipc')
    expect(ptySpawn.mock.calls[0].slice(0, 2)).toEqual(['/bin/zsh', ['-l']])
    expect(replies.find(m => m.type === 'pty:created')).toMatchObject({ fdGuard: 'no-bash' })
  })
})

// ── the real script (Linux only) ──────────────────────────────────────────────

const REAL_LINUX = process.platform === 'linux' && fs.existsSync('/bin/bash')

describe.runIf(REAL_LINUX)('the guard script under the real /bin/bash (Linux)', () => {
  // the child lists where each of its fds >= 3 points; node opens its own fds too, so the check is
  // on targets, not numbers: the file the spawner handed over as fd 3 must be gone
  const probe = [
    "const fs=require('fs');",
    "const fds=fs.readdirSync('/proc/self/fd').map(Number).filter(fd=>fd>=3);",
    "const links=fds.map(fd=>{try{return fs.readlinkSync('/proc/self/fd/'+fd)}catch{return ''}});",
    "const argv=fs.readFileSync('/proc/self/cmdline','utf8').split('\\0').slice(0,-1);",
    'process.stdout.write(JSON.stringify({pid:process.pid,links,argv,cwd:process.cwd(),env:process.env}))',
  ].join('')
  let handed: string
  let handedFd: number

  beforeEach(() => {
    handed = path.join(fs.realpathSync(os.tmpdir()), `t0806-handed-${process.pid}-${Date.now()}`)
    fs.writeFileSync(handed, '')
    handedFd = fs.openSync(handed, 'r')
  })
  afterEach(() => {
    fs.closeSync(handedFd)
    fs.rmSync(handed, { force: true })
  })

  function run(guarded: boolean, env: Record<string, string>) {
    const cmd = { file: process.execPath, args: ['-e', probe, 'a b', '', '$HOME'], env }
    const c = guarded ? guardPtySpawnFds(cmd, { platform: 'linux', fileExists: p => fs.existsSync(p) }).command : cmd
    const r = childProcess.spawnSync(c.file, c.args, { env: c.env as NodeJS.ProcessEnv, cwd: os.tmpdir(), stdio: ['ignore', 'pipe', 'pipe', handedFd], encoding: 'utf8' })
    expect(r.status, String(r.stderr)).toBe(0)
    return { pid: r.pid ?? 0, out: JSON.parse(String(r.stdout)) as { pid: number; links: string[]; argv: string[]; cwd: string; env: Record<string, string> } }
  }

  it('closes the fd the spawner handed over; pid, argv, cwd and env are the original ones', () => {
    const env = { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: os.tmpdir(), PWD: os.tmpdir(), SHLVL: '1', T0806: 'x y' }
    const direct = run(false, env)
    const guarded = run(true, env)
    expect(direct.out.links).toContain(handed)
    expect(guarded.out.links).not.toContain(handed)
    expect(guarded.out.pid).toBe(guarded.pid)
    expect(guarded.out.argv).toEqual(direct.out.argv)
    expect(guarded.out.cwd).toBe(direct.out.cwd)
    expect(guarded.out.env).toEqual(direct.out.env)
  })

  it('PWD / SHLVL absent and BASH_ENV set: the child env is still the original one, BASH_ENV not sourced', () => {
    const marker = path.join(os.tmpdir(), `t0806-bash-env-${process.pid}`)
    const env = { PATH: process.env.PATH ?? '/usr/bin:/bin', BASH_ENV: `${marker}.sh` }
    fs.writeFileSync(`${marker}.sh`, `echo sourced > '${marker}.out'
`)
    try {
      const direct = run(false, env)
      const guarded = run(true, env)
      expect(guarded.out.env).toEqual(direct.out.env)
      expect(fs.existsSync(`${marker}.out`)).toBe(false)
    } finally {
      fs.rmSync(`${marker}.sh`, { force: true })
      fs.rmSync(`${marker}.out`, { force: true })
    }
  })
})
