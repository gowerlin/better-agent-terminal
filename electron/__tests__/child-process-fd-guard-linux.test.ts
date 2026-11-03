// @vitest-environment node
/**
 * BUG-206 / BUG-207 / T0807: Linux only (CI ubuntu-24.04), real libuv + /bin/bash + `@lydell/node-pty`.
 *
 * This process plays the headless bat-server / Electron direct mode: `PtyManager` in direct mode
 * opens two shells, so it holds two pty masters without FD_CLOEXEC (node-pty 1.1.0, T0805). With the
 * guard installed on the real bindings, every child_process API — spawn / execFile / exec / fork /
 * promisified execFile / spawnSync / execFileSync / execSync, and a git hook run by `git commit` —
 * reaches its program with no `/dev/ptmx` and no inherited fd beyond its stdio. The same spawn
 * without the guard (`runWithoutChildProcessFdGuard`, or before install) does see the masters: the
 * reverse control that shows the checks can catch the leak.
 *
 * Fidelity against the unguarded spawn: pid (the wrapper execs), ppid, argv (incl. `argv0`), cwd,
 * env (PWD stale / absent, SHLVL absent, BASH_ENV not sourced), exit status, stdout, signals,
 * detached process-group kill, fork's IPC channel, an extra stdio pipe at fd 3, and the errors of a
 * command that cannot run (ENOENT / EACCES / missing cwd).
 */
import * as childProcess from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager / child-process-fd-guard must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import { installChildProcessFdGuard, runWithoutChildProcessFdGuard } from '../child-process-fd-guard'

const RUN = process.platform === 'linux' && fs.existsSync('/bin/bash') && fs.existsSync('/proc/self/fd')

interface Fd { fd: number; target: string; cloexec: boolean | null }
interface Report { pid: number; ppid: number; fds: Fd[]; argv: string[]; cwd: string; env: Record<string, string> }

const REPORTER = [
  "const fs=require('fs');",
  "const fds=fs.readdirSync('/proc/self/fd').map(Number).sort((a,b)=>a-b).map(fd=>{",
  "  let target='';try{target=fs.readlinkSync('/proc/self/fd/'+fd)}catch{}",
  "  let cloexec=null;try{const m=/^flags:\\s+([0-7]+)/m.exec(fs.readFileSync('/proc/self/fdinfo/'+fd,'utf8'));if(m)cloexec=(parseInt(m[1],8)&0o2000000)!==0}catch{}",
  '  return {fd,target,cloexec}});',
  "const argv=fs.readFileSync('/proc/self/cmdline','utf8').split('\\0').slice(0,-1);",
  'const r={pid:process.pid,ppid:process.ppid,fds,argv,cwd:process.cwd(),env:process.env};',
  'if(process.send){process.send(r,()=>process.exit(0))}else{process.stdout.write(JSON.stringify(r))}',
].join('\n')

/** fds a child may have that it did not open itself: anything ≥ keep without O_CLOEXEC, and any master */
const leaked = (r: Report, keep = 3) => r.fds.filter(f => f.target === '/dev/ptmx' || (f.fd >= keep && f.cloexec === false))
const masters = (r: Report) => r.fds.filter(f => f.target === '/dev/ptmx').length

async function until<T>(fn: () => T | null | false | undefined, ms = 10_000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() > end) throw new Error('timed out')
    await new Promise(r => setTimeout(r, 50))
  }
}

describe.runIf(RUN)('child_process children of a process holding pty masters (real libuv, Linux)', () => {
  let dir: string
  let reporter: string
  let manager: { create(o: object): boolean; dispose(): void } | null = null
  let uninstall: (() => void) | null = null
  const logs: string[] = []
  const baseEnv = () => ({ PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: dir, LANG: 'C.UTF-8' })

  const spawnSyncReport = (opts: childProcess.SpawnSyncOptions = {}, args: string[] = []): { pid: number; out: Report; status: number | null } => {
    const r = childProcess.spawnSync(process.execPath, [reporter, ...args], { encoding: 'utf8', ...opts })
    expect(r.status, String(r.stderr)).toBe(0)
    return { pid: r.pid ?? 0, out: JSON.parse(String(r.stdout)) as Report, status: r.status }
  }

  beforeAll(async () => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 't0807-cp-')))
    reporter = path.join(dir, 'report.js')
    fs.writeFileSync(reporter, REPORTER)
    vi.spyOn(logger, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')) })
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { PtyManager } = await import('../pty-manager')
    manager = new PtyManager({ emit: () => {}, dataDir: dir }) as unknown as typeof manager
    expect(manager!.create({ id: 't0807-a', cwd: dir, type: 'terminal', shell: '/bin/bash' })).toBe(true)
    expect(manager!.create({ id: 't0807-b', cwd: dir, type: 'terminal', shell: '/bin/bash' })).toBe(true)
    await until(() => fs.readdirSync('/proc/self/fd').filter(fd => { try { return fs.readlinkSync(`/proc/self/fd/${fd}`) === '/dev/ptmx' } catch { return false } }).length >= 2)
  }, 60_000)

  afterAll(() => {
    uninstall?.()
    manager?.dispose()
    vi.restoreAllMocks()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('reverse control: before the guard a child gets both masters', () => {
    const { out } = spawnSyncReport()
    expect(masters(out), JSON.stringify(out.fds)).toBeGreaterThanOrEqual(2)
    expect(leaked(out).length).toBeGreaterThanOrEqual(2)
  })

  it('installs on the real bindings', () => {
    const r = installChildProcessFdGuard({ log: l => logs.push(l) })
    expect(r.installed).toBe(true)
    if (r.installed) uninstall = r.uninstall
    expect(logs.some(l => l.includes('[child-fd-guard] installed'))).toBe(true)
  })

  it('every child_process API: no pty master, nothing inherited beyond stdio', async () => {
    const parse = (s: string | Buffer) => JSON.parse(String(s)) as Report
    const results: Array<[string, Report, number]> = []
    results.push(['spawnSync', spawnSyncReport().out, 3])
    results.push(['execFileSync', parse(childProcess.execFileSync(process.execPath, [reporter])), 3])
    results.push(['execSync', parse(childProcess.execSync(`'${process.execPath}' '${reporter}'`)), 3])
    results.push(['execFile', await new Promise<Report>((res, rej) => childProcess.execFile(process.execPath, [reporter], (e, so) => e ? rej(e) : res(parse(so)))), 3])
    results.push(['exec', await new Promise<Report>((res, rej) => childProcess.exec(`'${process.execPath}' '${reporter}'`, (e, so) => e ? rej(e) : res(parse(so)))), 3])
    results.push(['promisify(execFile)', parse((await promisify(childProcess.execFile)(process.execPath, [reporter])).stdout), 3])
    results.push(['spawn', await new Promise<Report>((res) => {
      const c = childProcess.spawn(process.execPath, [reporter])
      let so = ''
      c.stdout.on('data', d => { so += d })
      c.on('close', () => res(parse(so)))
    }), 3])
    results.push(['fork (ipc)', await new Promise<Report>((res, rej) => {
      const c = childProcess.fork(reporter, [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
      c.once('message', m => res(m as Report))
      c.once('error', rej)
    }), 4])
    for (const [api, r, keep] of results) {
      expect(masters(r), `${api}: ${JSON.stringify(r.fds)}`).toBe(0)
      expect(leaked(r, keep), `${api}: ${JSON.stringify(r.fds)}`).toEqual([])
    }
    // fork's IPC channel survived: the child answered over it, from fd 3 (Node drops NODE_CHANNEL_FD
    // from the child's process.env once the channel is set up)
    const forked = results.find(([api]) => api === 'fork (ipc)')![1]
    expect(forked.fds.find(f => f.fd === 3)?.target).toMatch(/^socket:/)
  })

  it('an extra stdio pipe at fd 3 stays and works', async () => {
    const script = "require('fs').writeSync(3,'via-fd3');" + REPORTER
    const c = childProcess.spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'inherit', 'pipe'] })
    let so = ''
    let fd3 = ''
    c.stdout!.on('data', d => { so += d })
    ;(c.stdio[3] as NodeJS.ReadableStream).on('data', d => { fd3 += d })
    await new Promise(r => c.on('close', r))
    const out = JSON.parse(so) as Report
    expect(fd3).toBe('via-fd3')
    expect(masters(out)).toBe(0)
    expect(leaked(out, 4)).toEqual([])
  })

  it('a git hook run by `git commit` (repo code) gets no pty master', () => {
    const git = ['/usr/bin/git', '/bin/git'].find(p => fs.existsSync(p))
    if (!git) return // no git on this host: covered by the API checks above
    const repo = path.join(dir, 'repo')
    const hooks = path.join(dir, 'hooks')
    fs.mkdirSync(hooks, { recursive: true })
    const hookOut = path.join(dir, 'hook.json')
    fs.writeFileSync(path.join(hooks, 'pre-commit'), `#!/bin/sh\nexec '${process.execPath}' '${reporter}' > '${hookOut}'\n`, { mode: 0o755 })
    const env = { ...baseEnv(), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
    childProcess.execFileSync('git', ['init', '-q', repo], { env })
    childProcess.execFileSync('git', ['-c', `core.hooksPath=${hooks}`, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'x'], { cwd: repo, env })
    const out = JSON.parse(fs.readFileSync(hookOut, 'utf8')) as Report
    expect(masters(out), JSON.stringify(out.fds)).toBe(0)
    expect(leaked(out)).toEqual([])
    // reverse control: the same hook unguarded sees the masters
    runWithoutChildProcessFdGuard(() => childProcess.execFileSync('git', ['-c', `core.hooksPath=${hooks}`, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'y'], { cwd: repo, env }))
    expect(masters(JSON.parse(fs.readFileSync(hookOut, 'utf8')) as Report)).toBeGreaterThanOrEqual(2)
  })

  it('runWithoutChildProcessFdGuard: the spawn is the unguarded one (Terminal Server fork)', () => {
    const { out } = runWithoutChildProcessFdGuard(() => spawnSyncReport())
    expect(masters(out)).toBeGreaterThanOrEqual(2)
  })

  it('pid, ppid, argv, cwd and env equal the unguarded spawn (PWD stale / absent, SHLVL absent, BASH_ENV)', () => {
    const marker = path.join(dir, 'bash-env')
    fs.writeFileSync(`${marker}.sh`, `echo sourced > '${marker}.out'\n`)
    const envs: Array<Record<string, string>> = [
      { ...baseEnv(), PWD: '/stale', SHLVL: '1', OLDPWD: dir, T0807: 'x y' },
      { ...baseEnv() },
      { ...baseEnv(), BASH_ENV: `${marker}.sh`, SHLVL: '4' },
    ]
    for (const env of envs) {
      for (const opts of [{ argv0: undefined }, { argv0: 'custom-argv0' }]) {
        const o: childProcess.SpawnSyncOptions = { env, cwd: dir, encoding: 'utf8', ...(opts.argv0 ? { argv0: opts.argv0 } : {}) }
        const direct = runWithoutChildProcessFdGuard(() => spawnSyncReport(o, ['a b', '', '$HOME']))
        const guarded = spawnSyncReport(o, ['a b', '', '$HOME'])
        expect(guarded.out.pid).toBe(guarded.pid)
        expect(guarded.out.ppid).toBe(process.pid)
        expect(guarded.out.argv).toEqual(direct.out.argv)
        expect(guarded.out.cwd).toBe(direct.out.cwd)
        const label = `${JSON.stringify(env)} argv0=${opts.argv0}`
        if (opts.argv0 && !env.SHLVL) {
          // documented: argv0 wins over an absent SHLVL — the child sees SHLVL=0
          const { SHLVL, ...rest } = guarded.out.env
          expect(SHLVL, label).toBe('0')
          expect(rest, label).toEqual(direct.out.env)
        } else {
          expect(guarded.out.env, label).toEqual(direct.out.env)
        }
      }
    }
    expect(fs.existsSync(`${marker}.out`)).toBe(false)
  })

  it('a command found through PATH (shebang script) runs with the same argv as before', () => {
    const bin = path.join(dir, 'bin')
    fs.mkdirSync(bin, { recursive: true })
    fs.writeFileSync(path.join(bin, 'fake-git'), `#!/bin/sh\nexec '${process.execPath}' '${reporter}' "$@"\n`, { mode: 0o755 })
    const env = { ...baseEnv(), PATH: `${bin}:${baseEnv().PATH}` }
    const run = () => JSON.parse(childProcess.execFileSync('fake-git', ['status', '--x'], { env, encoding: 'utf8' })) as Report
    const direct = runWithoutChildProcessFdGuard(run)
    const guarded = run()
    expect(guarded.argv).toEqual(direct.argv)
    expect(guarded.env).toEqual(direct.env)
    expect(masters(guarded)).toBe(0)
  })

  it('exit status, stdout / stderr, signals and a detached process-group kill behave as before', async () => {
    const r = childProcess.spawnSync(process.execPath, ['-e', 'process.stdout.write("o");process.stderr.write("e");process.exit(7)'], { encoding: 'utf8' })
    expect([r.status, r.stdout, r.stderr]).toEqual([7, 'o', 'e'])
    const c = childProcess.spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'])
    await until(() => fs.existsSync(`/proc/${c.pid}/cmdline`) && fs.readFileSync(`/proc/${c.pid}/cmdline`, 'utf8').startsWith(process.execPath))
    c.kill('SIGTERM')
    expect(await new Promise(res => c.on('exit', (_code, sig) => res(sig)))).toBe('SIGTERM')
    const d = childProcess.spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: true, stdio: 'ignore' })
    await until(() => fs.existsSync(`/proc/${d.pid}/cmdline`) && fs.readFileSync(`/proc/${d.pid}/cmdline`, 'utf8').startsWith(process.execPath))
    process.kill(-d.pid!, 'SIGKILL')
    expect(await new Promise(res => d.on('exit', (_code, sig) => res(sig)))).toBe('SIGKILL')
  })

  it('a command that cannot run fails exactly as before (ENOENT / EACCES / missing cwd)', async () => {
    const errOf = (fn: () => unknown) => { try { fn(); return null } catch (e) { const x = e as NodeJS.ErrnoException; return { code: x.code, syscall: x.syscall, path: x.path, message: x.message } } }
    const asyncErrOf = (file: string, opts: childProcess.SpawnOptions = {}) => new Promise<object>(res => {
      const c = childProcess.spawn(file, [], opts)
      c.on('error', e => { const x = e as NodeJS.ErrnoException; res({ code: x.code, syscall: x.syscall, path: x.path, spawnfile: c.spawnfile }) })
    })
    const notExec = path.join(dir, 'not-exec')
    fs.writeFileSync(notExec, 'x', { mode: 0o644 })
    for (const [file, opts] of [['t0807-no-such-command', {}], [notExec, {}], [process.execPath, { cwd: path.join(dir, 'missing') }]] as const) {
      const direct = runWithoutChildProcessFdGuard(() => errOf(() => childProcess.execFileSync(file, [], opts)))
      expect(direct).not.toBeNull()
      expect(errOf(() => childProcess.execFileSync(file, [], opts))).toEqual(direct)
      const directAsync = await runWithoutChildProcessFdGuard(() => asyncErrOf(file, opts))
      expect(await asyncErrOf(file, opts)).toEqual(directAsync)
    }
  })
})
