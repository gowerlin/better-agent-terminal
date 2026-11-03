// @vitest-environment node
/**
 * BUG-206 / BUG-207 / T0807 (D253): on Linux a child_process child keeps only its stdio fds
 * (electron/child-process-fd-guard.ts). Runs on every platform with injected platform / fs / bindings;
 * the real libuv + bash behaviour is in child-process-fd-guard-linux.test.ts (Linux only).
 *
 * - guardChildSpawn: not Linux → untouched; Linux → /bin/bash (then /usr/bin/bash) with the fixed
 *   script and every value as a positional parameter; keep count = stdio count (fork's IPC fd stays),
 *   CRASHDUMP_SIGNAL_FD kept; argv0 / the executed file are libuv's (PATH search here); a command that
 *   does not resolve is not wrapped (spawn keeps its ENOENT / EACCES); env flags B / W / P / S;
 *   an already guarded command is not wrapped twice
 * - installChildProcessFdGuard: not Linux → no binding touched; Linux → both libuv entry points
 *   wrapped (positional async form, object sync form), opt-out, fail-open on odd shapes / errors,
 *   uninstall restores
 * - T0816 (PLAN-062 A3): withoutCrashpadClient / runWithoutCrashpadClient drop CRASHDUMP_SIGNAL_FD /
 *   CRASHPAD_HANDLER_PID and do not keep that fd; nesting and throw restore it
 * - source guards: main.ts installs it before the Terminal Server fork; the one fork helper
 *   (forkTerminalServer) is guarded without crashpad client; bat-server.mjs installs it before
 *   anything spawns; server-entry exports it
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('child-process-fd-guard must not import electron')
})

import {
  CHILD_FD_GUARD_DEFAULT_PATH,
  CRASHPAD_CLIENT_ENV_KEYS,
  CHILD_FD_GUARD_NAME,
  CHILD_FD_GUARD_SCRIPT,
  guardChildSpawn,
  installChildProcessFdGuard,
  resolveChildExecutable,
  runWithoutChildProcessFdGuard,
  runWithoutCrashpadClient,
  type ChildFdGuardDeps,
  type ChildSpawnRequest,
} from '../child-process-fd-guard'
import { PTY_FD_GUARD_ENV_PATH, PTY_FD_GUARD_SCRIPT } from '../pty-spawn-fd-guard'

const EXEC = new Set(['/usr/bin/git', '/usr/local/bin/claude', '/bin/sh', '/opt/x/run', '/work/repo/tool', '/home/u/node'])

function deps(over: Partial<ChildFdGuardDeps> & { existing?: string[]; executables?: Set<string> } = {}): ChildFdGuardDeps {
  const existing = new Set(over.existing ?? ['/bin/bash', '/usr/bin/bash', PTY_FD_GUARD_ENV_PATH])
  const executables = over.executables ?? EXEC
  return {
    platform: over.platform ?? 'linux',
    fileExists: over.fileExists ?? (p => existing.has(p)),
    isExecutableFile: over.isExecutableFile ?? (p => executables.has(p)),
    cwd: over.cwd ?? (() => '/srv/bat'),
    processEnv: over.processEnv ?? (() => ({ PATH: '/usr/bin:/bin', SHLVL: '1', PWD: '/srv/bat' })),
  }
}

const BASE_ENV = ['PATH=/usr/local/bin:/usr/bin', 'HOME=/home/u', 'PWD=/home/u', 'SHLVL=1']
const req = (over: Partial<ChildSpawnRequest> = {}): ChildSpawnRequest => ({
  file: 'git', args: ['git', 'status', '--porcelain'], cwd: '/work/repo', envPairs: BASE_ENV, stdioCount: 3, ...over,
})

/** positional parameters after the script: name, flags, BASH_ENV, PWD, keep, extra, argv0, target, args… */
function positional(r: ReturnType<typeof guardChildSpawn>) {
  if (!r.wrapped) throw new Error(`not wrapped: ${r.reason}`)
  const [, dashC, script, name, flags, bashEnv, pwd, keep, extra, argv0, target, ...rest] = r.args
  return { file: r.file, argv0OfBash: r.args[0], dashC, script, name, flags, bashEnv, pwd, keep, extra, argv0, target, rest, envPairs: r.envPairs }
}

describe('guardChildSpawn', () => {
  it('not Linux: never wrapped (Windows / macOS spawn what they spawned before)', () => {
    for (const platform of ['win32', 'darwin'] as const) {
      expect(guardChildSpawn(req(), deps({ platform }))).toEqual({ wrapped: false, reason: 'not-linux' })
    }
  })

  it('Linux: /bin/bash -c <fixed script> bat-child-fd-guard …, original argv0 / args verbatim, env unchanged', () => {
    const p = positional(guardChildSpawn(req(), deps()))
    expect(p.file).toBe('/bin/bash')
    expect(p.argv0OfBash).toBe('/bin/bash')
    expect(p.dashC).toBe('-c')
    expect(p.script).toBe(CHILD_FD_GUARD_SCRIPT)
    expect(p.name).toBe(CHILD_FD_GUARD_NAME)
    expect(p.flags).toBe('W')
    expect(p.pwd).toBe('/home/u')
    expect(p.keep).toBe('3')
    expect(p.extra).toBe('')
    expect(p.argv0).toBe('git')
    expect(p.target).toBe('/usr/bin/git') // libuv's PATH pick, exec -a keeps argv[0] = git
    expect(p.rest).toEqual(['status', '--porcelain'])
    expect(p.envPairs).toEqual(BASE_ENV)
  })

  it('arguments with spaces, quotes, $, --, leading dashes and empty strings stay positional, never in the script', () => {
    const odd = ['a b', '"q"', "'s'", '$(id)', '`x`', '--', '-c', '', ';rm -rf /', '\n']
    const p = positional(guardChildSpawn(req({ args: ['git', ...odd] }), deps()))
    expect(p.rest).toEqual(odd)
    for (const a of ['$(id)', '`x`', ';rm -rf /']) expect(CHILD_FD_GUARD_SCRIPT).not.toContain(a)
  })

  it('the script is one fixed string: keeps fds below $4 and $5, closes the rest from /proc/self/fd, then execs', () => {
    expect(CHILD_FD_GUARD_SCRIPT).toContain('/proc/self/fd/*')
    expect(CHILD_FD_GUARD_SCRIPT).toContain('(( _bat_fd < $1 )) || [[ $_bat_fd == "$2" ]]')
    expect(CHILD_FD_GUARD_SCRIPT).toContain('_bat_close_fds "$4" "$5"')
    expect(CHILD_FD_GUARD_SCRIPT).toContain(`exec ${PTY_FD_GUARD_ENV_PATH} -u SHLVL -- "$@"`)
    expect(CHILD_FD_GUARD_SCRIPT.split('\n').at(-1)).toBe('exec -a "$1" "${@:2}"')
  })

  it('falls back to /usr/bin/bash; neither → not wrapped (no-bash)', () => {
    expect(guardChildSpawn(req(), deps({ existing: ['/usr/bin/bash'] }))).toMatchObject({ wrapped: true, file: '/usr/bin/bash' })
    expect(guardChildSpawn(req(), deps({ existing: [] }))).toEqual({ wrapped: false, reason: 'no-bash' })
  })

  it('a command that does not resolve to an executable file is not wrapped (spawn keeps ENOENT / EACCES)', () => {
    expect(guardChildSpawn(req({ file: 'nope', args: ['nope'] }), deps())).toEqual({ wrapped: false, reason: 'not-found' })
    expect(guardChildSpawn(req({ file: '/opt/x/missing', args: ['/opt/x/missing'] }), deps())).toEqual({ wrapped: false, reason: 'not-found' })
    expect(guardChildSpawn(req({ file: '', args: [''] }), deps())).toEqual({ wrapped: false, reason: 'not-found' })
  })

  it('fork-like stdio (ipc / extra pipe at fd 3): keep count = stdio count; below 3 → 3', () => {
    expect(positional(guardChildSpawn(req({ stdioCount: 4 }), deps())).keep).toBe('4')
    expect(positional(guardChildSpawn(req({ stdioCount: 6 }), deps())).keep).toBe('6')
    expect(positional(guardChildSpawn(req({ stdioCount: 1 }), deps())).keep).toBe('3')
    expect(positional(guardChildSpawn(req({ stdioCount: Number.NaN }), deps())).keep).toBe('3')
  })

  it('keeps the fd CRASHDUMP_SIGNAL_FD names (Electron crash reporting in an ELECTRON_RUN_AS_NODE child)', () => {
    expect(positional(guardChildSpawn(req({ envPairs: [...BASE_ENV, 'CRASHDUMP_SIGNAL_FD=42'] }), deps())).extra).toBe('42')
    expect(positional(guardChildSpawn(req({ envPairs: [...BASE_ENV, 'CRASHDUMP_SIGNAL_FD=2'] }), deps())).extra).toBe('')
    expect(positional(guardChildSpawn(req({ envPairs: [...BASE_ENV, 'CRASHDUMP_SIGNAL_FD=4;x'] }), deps())).extra).toBe('')
  })

  it('T0816 withoutCrashpadClient: both crashpad env pairs dropped (every occurrence), that fd not kept; the rest unchanged', () => {
    const env = [...BASE_ENV, 'CRASHDUMP_SIGNAL_FD=42', 'ELECTRON_RUN_AS_NODE=1', 'CRASHPAD_HANDLER_PID=777', 'CRASHDUMP_SIGNAL_FD=43']
    expect(CRASHPAD_CLIENT_ENV_KEYS).toEqual(['CRASHDUMP_SIGNAL_FD', 'CRASHPAD_HANDLER_PID'])
    const off = positional(guardChildSpawn(req({ envPairs: env, stdioCount: 5, withoutCrashpadClient: true }), deps()))
    expect(off.extra).toBe('')
    expect(off.keep).toBe('5')
    expect(off.envPairs).toEqual([...BASE_ENV, 'ELECTRON_RUN_AS_NODE=1'])
    // without the flag: as before (T0807), the fd is kept and the env passed through
    const on = positional(guardChildSpawn(req({ envPairs: env, stdioCount: 5 }), deps()))
    expect(on.extra).toBe('43')
    expect(on.envPairs).toEqual(env)
    // envPairs undefined: this process's env, filtered the same way
    const inherited = positional(guardChildSpawn(req({ envPairs: undefined, withoutCrashpadClient: true }), deps({ processEnv: () => ({ PATH: '/usr/bin', CRASHDUMP_SIGNAL_FD: '9', CRASHPAD_HANDLER_PID: '1', A: 'b' }) })))
    expect(inherited.extra).toBe('')
    expect(inherited.envPairs.sort()).toEqual(['A=b', 'PATH=/usr/bin'])
    // with BASH_ENV too
    const both = positional(guardChildSpawn(req({ envPairs: [...env, 'BASH_ENV=/x'], withoutCrashpadClient: true }), deps()))
    expect(both.envPairs).toEqual([...BASE_ENV, 'ELECTRON_RUN_AS_NODE=1'])
    // caller's array untouched; not Linux still never wrapped
    expect(env).toHaveLength(8)
    expect(guardChildSpawn(req({ envPairs: env, withoutCrashpadClient: true }), deps({ platform: 'win32' }))).toEqual({ wrapped: false, reason: 'not-linux' })
  })

  it('BASH_ENV: not in the wrapper env (bash would source it), passed back as $2 with flag B', () => {
    const p = positional(guardChildSpawn(req({ envPairs: [...BASE_ENV, 'BASH_ENV=/home/u/.bashenv'] }), deps()))
    expect(p.flags).toBe('BW')
    expect(p.bashEnv).toBe('/home/u/.bashenv')
    expect(p.envPairs).toEqual(BASE_ENV)
    // an empty BASH_ENV is still "set"
    expect(positional(guardChildSpawn(req({ envPairs: [...BASE_ENV, 'BASH_ENV='] }), deps())).flags).toBe('BW')
  })

  it('PWD: re-exported as it was (W, even a stale one) or unset again (P)', () => {
    expect(positional(guardChildSpawn(req({ envPairs: ['PATH=/usr/bin', 'SHLVL=2', 'PWD=/stale'] }), deps())).flags).toBe('W')
    const noPwd = positional(guardChildSpawn(req({ envPairs: ['PATH=/usr/bin', 'SHLVL=2'] }), deps()))
    expect(noPwd.flags).toBe('P')
    expect(noPwd.pwd).toBe('')
  })

  it('SHLVL absent and argv0 = file → S: /usr/bin/env -u SHLVL with the file as given (env searches PATH, argv[0] = file)', () => {
    const p = positional(guardChildSpawn(req({ envPairs: ['PATH=/usr/bin', 'PWD=/w'] }), deps()))
    expect(p.flags).toBe('WS')
    expect(p.target).toBe('git')
    // without /usr/bin/env: exec -a with the resolved file (the child sees SHLVL=0, documented)
    const noEnv = positional(guardChildSpawn(req({ envPairs: ['PATH=/usr/bin', 'PWD=/w'] }), deps({ existing: ['/bin/bash'] })))
    expect(noEnv.flags).toBe('W')
    expect(noEnv.target).toBe('/usr/bin/git')
  })

  it('argv0 option ≠ file: exec -a keeps argv0, even when SHLVL is absent (no S)', () => {
    const p = positional(guardChildSpawn(req({ args: ['custom-name', 'x'], envPairs: ['PATH=/usr/bin', 'PWD=/w'] }), deps()))
    expect(p.flags).toBe('W')
    expect(p.argv0).toBe('custom-name')
    expect(p.target).toBe('/usr/bin/git')
    expect(p.rest).toEqual(['x'])
  })

  it('envPairs undefined (child inherits) → this process env is used for PATH / flags and passed explicitly', () => {
    const r = guardChildSpawn(req({ envPairs: undefined }), deps({ processEnv: () => ({ PATH: '/usr/local/bin:/usr/bin', SHLVL: '3', UNDEF: undefined }) }))
    const p = positional(r)
    expect(p.target).toBe('/usr/bin/git')
    expect(p.flags).toBe('P')
    expect(p.envPairs).toEqual(['PATH=/usr/local/bin:/usr/bin', 'SHLVL=3'])
  })

  it('a command that already is a PTY / child fd guard is not wrapped twice', () => {
    const pty = { file: '/bin/bash', args: ['/bin/bash', '-c', PTY_FD_GUARD_SCRIPT, 'bat-pty-fd-guard', '-', '', '/bin/sh'], envPairs: BASE_ENV, stdioCount: 3 }
    expect(guardChildSpawn(pty, deps({ executables: new Set(['/bin/bash']) }))).toEqual({ wrapped: false, reason: 'already-guarded' })
    const once = guardChildSpawn(req(), deps())
    if (!once.wrapped) throw new Error('expected wrapped')
    const twice = guardChildSpawn({ file: once.file, args: once.args, envPairs: once.envPairs, stdioCount: 3 }, deps({ executables: new Set(['/bin/bash']) }))
    expect(twice).toEqual({ wrapped: false, reason: 'already-guarded' })
  })

  it('shell: true (Node already turned it into /bin/sh -c <command>) is wrapped like any file', () => {
    const p = positional(guardChildSpawn(req({ file: '/bin/sh', args: ['/bin/sh', '-c', 'git status | head'] }), deps()))
    expect(p.argv0).toBe('/bin/sh')
    expect(p.target).toBe('/bin/sh')
    expect(p.rest).toEqual(['-c', 'git status | head'])
  })
})

describe('resolveChildExecutable (libuv uv__execvpe order)', () => {
  const isExec = (p: string) => EXEC.has(p)

  it('a name with a slash is taken as is (relative to the child cwd) or not at all', () => {
    expect(resolveChildExecutable('/opt/x/run', undefined, '/', isExec)).toBe('/opt/x/run')
    expect(resolveChildExecutable('./tool', undefined, '/work/repo', isExec)).toBe('./tool')
    expect(resolveChildExecutable('repo/tool', undefined, '/work', isExec)).toBe('repo/tool')
    expect(resolveChildExecutable('./tool', undefined, '/elsewhere', isExec)).toBeNull()
  })

  it('first executable on PATH; default /usr/bin:/bin without PATH; empty entry = cwd (always with a slash)', () => {
    expect(resolveChildExecutable('git', '/nope:/usr/bin:/usr/local/bin', '/', isExec)).toBe('/usr/bin/git')
    expect(resolveChildExecutable('git', undefined, '/', isExec)).toBe('/usr/bin/git')
    expect(CHILD_FD_GUARD_DEFAULT_PATH).toBe('/usr/bin:/bin')
    expect(resolveChildExecutable('tool', '/nope::/usr/bin', '/work/repo', isExec)).toBe('./tool')
    expect(resolveChildExecutable('node', 'u', '/home', isExec)).toBe('u/node')
    expect(resolveChildExecutable('git', '/usr/bin/', '/', isExec)).toBe('/usr/bin/git')
    expect(resolveChildExecutable('git', '/opt', '/', isExec)).toBeNull()
  })
})

// ── installation with fake libuv bindings ─────────────────────────────────────────────────────

type Call = { kind: 'async' | 'sync'; args: unknown[] }

function fakeBindings() {
  const calls: Call[] = []
  class Process {
    spawn(...a: unknown[]) { calls.push({ kind: 'async', args: a }); return 0 }
  }
  const spawnSync = { spawn: (...a: unknown[]) => { calls.push({ kind: 'sync', args: a }); return { status: 0 } } }
  const originalAsync = Process.prototype.spawn
  const originalSync = spawnSync.spawn
  const requested: string[] = []
  const binding = (name: string) => {
    requested.push(name)
    if (name === 'process_wrap') return { Process }
    if (name === 'spawn_sync') return spawnSync
    throw new Error(`No such module: ${name}`)
  }
  return { calls, Process, spawnSync, originalAsync, originalSync, requested, binding }
}

const ENV_PAIRS = ['PATH=/usr/bin', 'SHLVL=1', 'PWD=/w']

describe('installChildProcessFdGuard (fake bindings)', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => { for (const c of cleanups.splice(0)) c() })

  const install = (b: ReturnType<typeof fakeBindings>, over: { platform?: NodeJS.Platform; existing?: string[] } = {}) => {
    const logs: string[] = []
    const existing = new Set(over.existing ?? ['/bin/bash', PTY_FD_GUARD_ENV_PATH])
    const r = installChildProcessFdGuard({
      log: l => logs.push(l), platform: over.platform ?? 'linux', binding: b.binding,
      fileExists: p => existing.has(p), isExecutableFile: p => EXEC.has(p),
    })
    if (r.installed) cleanups.push(r.uninstall)
    return { r, logs }
  }

  it('not Linux: nothing installed, no binding requested, no log', () => {
    for (const platform of ['win32', 'darwin'] as const) {
      const b = fakeBindings()
      const { r, logs } = install(b, { platform })
      expect(r).toEqual({ installed: false, reason: 'not-linux' })
      expect(b.requested).toEqual([])
      expect(b.Process.prototype.spawn).toBe(b.originalAsync)
      expect(b.spawnSync.spawn).toBe(b.originalSync)
      expect(logs).toEqual([])
    }
  })

  it('Linux without bash: nothing patched, one log line', () => {
    const b = fakeBindings()
    const { r, logs } = install(b, { existing: [] })
    expect(r).toEqual({ installed: false, reason: 'no-bash' })
    expect(b.Process.prototype.spawn).toBe(b.originalAsync)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('[child-fd-guard] no bash')
  })

  it('Linux: async positional spawn(file, args, cwd, envPairs, stdio, flags, uid, gid) gets the guarded file / args / env', () => {
    const b = fakeBindings()
    const { r, logs } = install(b)
    expect(r.installed).toBe(true)
    expect(logs).toEqual([expect.stringContaining('[child-fd-guard] installed (/bin/bash)')])
    const stdio = [{ type: 'pipe' }, { type: 'pipe' }, { type: 'pipe' }, { type: 'pipe' }]
    const args = ['git', 'log']
    const env = [...ENV_PAIRS]
    expect(new b.Process().spawn('git', args, '/work/repo', env, stdio, 1, undefined, undefined)).toBe(0)
    const got = b.calls[0].args
    expect(got[0]).toBe('/bin/bash')
    expect((got[1] as string[]).slice(3, 12)).toEqual([CHILD_FD_GUARD_NAME, 'W', '', '/w', '4', '', 'git', '/usr/bin/git', 'log'])
    expect(got.slice(2)).toEqual(['/work/repo', ENV_PAIRS, stdio, 1, undefined, undefined])
    expect(got[4]).toBe(stdio) // same stdio objects (Node reads their handles afterwards)
    expect(args).toEqual(['git', 'log']) // caller's arrays untouched (ChildProcess.spawnargs)
    expect(env).toEqual(ENV_PAIRS)
  })

  it('Linux: sync spawn(options) gets a guarded copy; the caller object is untouched', () => {
    const b = fakeBindings()
    install(b)
    const stdio = [{ type: 'pipe' }, { type: 'pipe' }, { type: 'pipe' }]
    const opts = { file: 'git', args: ['git', 'rev-parse'], cwd: '/work/repo', envPairs: ENV_PAIRS, stdio, timeout: 5000, maxBuffer: 1 }
    b.spawnSync.spawn(opts)
    const got = b.calls[0].args[0] as Record<string, unknown>
    expect(got.file).toBe('/bin/bash')
    expect((got.args as string[]).slice(-3)).toEqual(['git', '/usr/bin/git', 'rev-parse'])
    expect(got).toMatchObject({ cwd: '/work/repo', stdio, timeout: 5000, maxBuffer: 1 })
    expect(opts.file).toBe('git')
    expect(opts.args).toEqual(['git', 'rev-parse'])
  })

  it('not wrapped (not found) → the original call, same arguments array', () => {
    const b = fakeBindings()
    install(b)
    new b.Process().spawn('nope', ['nope'], undefined, ENV_PAIRS, [], 0)
    expect(b.calls[0].args.slice(0, 2)).toEqual(['nope', ['nope']])
  })

  it('runWithoutChildProcessFdGuard: spawns inside it are untouched (Terminal Server fork), nesting and throw restore it', () => {
    const b = fakeBindings()
    install(b)
    const p = new b.Process()
    runWithoutChildProcessFdGuard(() => runWithoutChildProcessFdGuard(() => p.spawn('git', ['git'], undefined, ENV_PAIRS, [], 0)))
    expect(b.calls[0].args[0]).toBe('git')
    expect(() => runWithoutChildProcessFdGuard(() => { throw new Error('boom') })).toThrow('boom')
    p.spawn('git', ['git'], undefined, ENV_PAIRS, [], 0)
    expect(b.calls[1].args[0]).toBe('/bin/bash')
    expect(runWithoutChildProcessFdGuard(() => 7)).toBe(7)
  })

  it('T0816 runWithoutCrashpadClient: async + sync spawns inside it lose the crashpad env and fd; nesting and throw restore it', () => {
    const b = fakeBindings()
    install(b)
    const p = new b.Process()
    const env = [...ENV_PAIRS, 'ELECTRON_RUN_AS_NODE=1', 'CRASHDUMP_SIGNAL_FD=37', 'CRASHPAD_HANDLER_PID=901']
    const fork5 = [{ type: 'ignore' }, { type: 'ignore' }, { type: 'ignore' }, { type: 'pipe', ipc: true }, { type: 'fd', fd: 6 }]
    runWithoutCrashpadClient(() => runWithoutCrashpadClient(() => p.spawn('/home/u/node', ['/home/u/node', 'server.js'], undefined, env, fork5, 0)))
    const a = b.calls[0].args
    expect(a[0]).toBe('/bin/bash')
    expect((a[1] as string[]).slice(7, 9)).toEqual(['5', '']) // keep 0–4, no extra fd
    expect(a[3]).toEqual([...ENV_PAIRS, 'ELECTRON_RUN_AS_NODE=1'])
    expect(a[4]).toBe(fork5)
    runWithoutCrashpadClient(() => b.spawnSync.spawn({ file: '/home/u/node', args: ['/home/u/node'], envPairs: env, stdio: [{}, {}, {}] }))
    const so = b.calls[1].args[0] as { args: string[]; envPairs: string[] }
    expect(so.args.slice(7, 9)).toEqual(['3', ''])
    expect(so.envPairs.some(e => e.startsWith('CRASH'))).toBe(false)
    expect(() => runWithoutCrashpadClient(() => { throw new Error('boom') })).toThrow('boom')
    expect(runWithoutCrashpadClient(() => 7)).toBe(7)
    // outside the scope again: T0807 behaviour (fd kept, env passed)
    p.spawn('/home/u/node', ['/home/u/node'], undefined, env, fork5, 0)
    expect((b.calls[2].args[1] as string[]).slice(7, 9)).toEqual(['5', '37'])
    expect(b.calls[2].args[3]).toEqual(env)
    // inside runWithoutChildProcessFdGuard the guard stays off entirely
    runWithoutCrashpadClient(() => runWithoutChildProcessFdGuard(() => p.spawn('/home/u/node', ['/home/u/node'], undefined, env, fork5, 0)))
    expect(b.calls[3].args[0]).toBe('/home/u/node')
    expect(b.calls[3].args[3]).toBe(env)
  })

  it('unexpected call shape or a failing check → original call, one log line per kind (fail open)', () => {
    const b = fakeBindings()
    const logs: string[] = []
    const r = installChildProcessFdGuard({
      log: l => logs.push(l), platform: 'linux', binding: b.binding,
      fileExists: p => p === '/bin/bash', isExecutableFile: () => { throw new Error('stat exploded') },
    })
    if (r.installed) cleanups.push(r.uninstall)
    const p = new b.Process()
    p.spawn(42, 'x')
    p.spawn(43, 'y')
    p.spawn('git', ['git'], undefined, ENV_PAIRS, [], 0)
    p.spawn('git', ['git'], undefined, ENV_PAIRS, [], 0)
    expect(b.calls.map(c => c.args[0])).toEqual([42, 43, 'git', 'git'])
    expect(logs.filter(l => l.includes('unexpected async'))).toHaveLength(1)
    expect(logs.filter(l => l.includes('guard failed (stat exploded)'))).toHaveLength(1)
  })

  it('second install is refused; uninstall restores both bindings', () => {
    const b = fakeBindings()
    const { r } = install(b)
    expect(install(fakeBindings()).r).toEqual({ installed: false, reason: 'already-installed' })
    if (!r.installed) throw new Error('expected installed')
    r.uninstall()
    cleanups.length = 0
    expect(b.Process.prototype.spawn).toBe(b.originalAsync)
    expect(b.spawnSync.spawn).toBe(b.originalSync)
    const again = install(fakeBindings())
    expect(again.r.installed).toBe(true)
  })

  it('bindings missing → nothing installed, one log line', () => {
    const logs: string[] = []
    const r = installChildProcessFdGuard({ log: l => logs.push(l), platform: 'linux', binding: () => { throw new Error('No such module') }, fileExists: () => true })
    expect(r).toEqual({ installed: false, reason: 'no-binding' })
    expect(logs).toEqual([expect.stringContaining('binding unavailable')])
  })
})

describe('where the guard is installed (source guards)', () => {
  const root = path.resolve(__dirname, '..', '..')
  const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

  it('main.ts installs it at module level before the Terminal Server fork; T0816: one fork, guarded without crashpad client', () => {
    const src = read('electron/main.ts')
    const install = src.indexOf('installChildProcessFdGuard({')
    expect(install).toBeGreaterThan(0)
    expect(install).toBeLessThan(src.indexOf('fork(serverScript'))
    expect(src.match(/fork\(serverScript/g)).toHaveLength(1)
    expect(src.match(/runWithoutCrashpadClient\(\(\) => fork\(serverScript, \[\], \{\s*detached: true,\s*stdio: plan\.stdio,/g)).toHaveLength(1)
    expect(src).not.toMatch(/runWithoutChildProcessFdGuard\(/)
    // startTerminalServer and T0704's reforkTerminalServer both use the helper
    const body = (name: string) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)))
    for (const fn of ['startTerminalServer', 'reforkTerminalServer']) expect(body(fn)).toContain('forkTerminalServer(serverScript, userDataPath)')
    expect(body('forkTerminalServer')).toContain('planTerminalServerFork(process.platform, () => findAppImageKeepaliveFd(defaultAppImageKeepaliveDeps()))')
  })

  it('bat-server.mjs installs it right after loading server-entry, before the login-shell PATH and the server', () => {
    const src = read('scripts/bat-server.mjs')
    const install = src.indexOf('serverEntry.installChildProcessFdGuard?.(')
    expect(install).toBeGreaterThan(src.indexOf('const serverEntry = loadServerEntry(true)'))
    expect(install).toBeLessThan(src.indexOf('applyHeadlessLoginShellPath?.('))
    expect(install).toBeLessThan(src.indexOf('serverEntry.createHeadlessServer('))
    expect(read('electron/remote/server-entry.ts')).toContain("export { installChildProcessFdGuard } from '../child-process-fd-guard'")
  })

  it('the Terminal Server does not install it (PLAN-062 option C)', () => {
    expect(read('electron/terminal-server.ts')).not.toContain('installChildProcessFdGuard')
    expect(read('electron/terminal-server/server.ts')).not.toContain('installChildProcessFdGuard')
  })
})
