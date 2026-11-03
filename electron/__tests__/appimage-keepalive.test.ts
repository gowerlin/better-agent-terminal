// @vitest-environment node
/**
 * T0816 (PLAN-062 option A3, BUG-209): electron/appimage-keepalive.ts with a fake /proc.
 *
 * - findAppImageKeepaliveFd: no APPIMAGE → none, no /proc read; the keepalive is the pipe fd ≥ 3 whose
 *   other end (different access mode) the process with exe === APPIMAGE holds; a pipe both share with
 *   the same mode (inherited from the launcher), stdio pipes, pipes of other processes and unreadable
 *   entries are ignored; realpath / ` (deleted)`; several candidates → ambiguous; read errors → no throw
 * - planTerminalServerFork: Windows / macOS → the pre-T0816 stdio, no lookup, no log; Linux → stdio[4] =
 *   keepalive when found, never 'ignore' in slot 4, one `[terminal-server]` line; a throwing lookup → none
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('appimage-keepalive must not import electron')
})

import {
  TERMINAL_SERVER_KEEPALIVE_FD,
  defaultAppImageKeepaliveDeps,
  findAppImageKeepaliveFd,
  planTerminalServerFork,
  type AppImageKeepaliveDeps,
} from '../appimage-keepalive'

const APPIMAGE = '/home/u/Apps/BAT.AppImage'
const RDONLY = 0o100000 // O_LARGEFILE | O_RDONLY
const WRONLY = 0o100001

interface FakeFd { link: string; flags?: number }
interface FakeProc { exe?: string; fds: Record<number, FakeFd> }

/** `procs['self']` is this process; other keys are pids. Missing paths throw ENOENT. */
function fakeProc(procs: Record<string, FakeProc>, over: Partial<AppImageKeepaliveDeps> = {}): AppImageKeepaliveDeps & { reads: string[] } {
  const reads: string[] = []
  const enoent = (p: string) => Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
  const procOf = (pid: string) => procs[pid] ?? (() => { throw enoent(pid) })()
  const deps: AppImageKeepaliveDeps & { reads: string[] } = {
    reads,
    env: { APPIMAGE },
    selfPid: 100,
    readdir: dir => {
      reads.push(dir)
      if (dir === '/proc') return ['self', 'thread-self', 'sys', ...Object.keys(procs).filter(k => k !== 'self'), '100']
      const m = /^\/proc\/([^/]+)\/fd$/.exec(dir)
      if (!m) throw enoent(dir)
      return Object.keys(procOf(m[1]).fds)
    },
    readlink: p => {
      reads.push(p)
      let m = /^\/proc\/([^/]+)\/exe$/.exec(p)
      if (m) {
        const exe = procOf(m[1]).exe
        if (exe === undefined) throw Object.assign(new Error('EACCES'), { code: 'EACCES' })
        return exe
      }
      m = /^\/proc\/([^/]+)\/fd\/(\d+)$/.exec(p)
      const fd = m ? procOf(m[1]).fds[Number(m[2])] : undefined
      if (!fd) throw enoent(p)
      return fd.link
    },
    readFile: p => {
      reads.push(p)
      const m = /^\/proc\/([^/]+)\/fdinfo\/(\d+)$/.exec(p)
      const fd = m ? procOf(m[1]).fds[Number(m[2])] : undefined
      if (!fd || fd.flags === undefined) throw enoent(p)
      return `pos:\t0\nflags:\t0${fd.flags.toString(8)}\nmnt_id:\t15\n`
    },
    realpath: p => p,
    ...over,
  }
  return deps
}

/** a normal AppImage start: keepalive read end at fd 3, FUSE (pid 90) holds the write end */
const normalStart = (): Record<string, FakeProc> => ({
  self: { fds: { 0: { link: '/dev/null', flags: RDONLY }, 1: { link: 'pipe:[500]', flags: WRONLY }, 2: { link: 'pipe:[500]', flags: WRONLY }, 3: { link: 'pipe:[700]', flags: RDONLY }, 4: { link: 'socket:[701]', flags: 2 }, 5: { link: 'pipe:[702]', flags: RDONLY } } },
  90: { exe: APPIMAGE, fds: { 0: { link: '/dev/null', flags: RDONLY }, 1: { link: '/dev/null', flags: WRONLY }, 2: { link: '/dev/null', flags: WRONLY }, 4: { link: 'pipe:[700]', flags: WRONLY }, 5: { link: '/dev/fuse', flags: 2 } } },
  91: { exe: '/usr/bin/bash', fds: { 0: { link: 'pipe:[702]', flags: WRONLY } } },
  92: { fds: {} }, // another user's process: exe unreadable
})

describe('findAppImageKeepaliveFd', () => {
  it('no APPIMAGE → not-appimage, nothing read from /proc', () => {
    for (const env of [{}, { APPIMAGE: '' }]) {
      const d = fakeProc(normalStart(), { env })
      expect(findAppImageKeepaliveFd(d)).toEqual({ fd: null, reason: 'not-appimage' })
      expect(d.reads).toEqual([])
    }
  })

  it('normal start: the read end at fd 3 whose write end the runtime process holds', () => {
    expect(findAppImageKeepaliveFd(fakeProc(normalStart()))).toEqual({ fd: 3, runtimePid: 90 })
  })

  it('Playwright start: launcher fds 3 / 4 are shared with the runtime (same mode) and skipped; keepalive at fd 5', () => {
    const procs: Record<string, FakeProc> = {
      self: { fds: { 0: { link: '/dev/null', flags: RDONLY }, 3: { link: 'pipe:[801]', flags: WRONLY }, 4: { link: 'pipe:[802]', flags: RDONLY }, 5: { link: 'pipe:[700]', flags: RDONLY } } },
      90: { exe: APPIMAGE, fds: { 3: { link: 'pipe:[801]', flags: WRONLY }, 4: { link: 'pipe:[802]', flags: RDONLY }, 7: { link: 'pipe:[700]', flags: WRONLY } } },
    }
    expect(findAppImageKeepaliveFd(fakeProc(procs))).toEqual({ fd: 5, runtimePid: 90 })
  })

  it('stdio pipes shared with the runtime are never taken; a pipe only another process holds is not the keepalive', () => {
    const procs = normalStart()
    procs[90].fds[1] = { link: 'pipe:[500]', flags: RDONLY } // other end of our stdout (hypothetical)
    expect(findAppImageKeepaliveFd(fakeProc(procs))).toEqual({ fd: 3, runtimePid: 90 })
    delete procs[90].fds[4]
    expect(findAppImageKeepaliveFd(fakeProc(procs))).toEqual({ fd: null, reason: 'not-found' })
  })

  it('no process runs the AppImage file → no-runtime-process; realpath and " (deleted)" also match', () => {
    const procs = normalStart()
    procs[90].exe = '/usr/bin/something'
    expect(findAppImageKeepaliveFd(fakeProc(procs))).toEqual({ fd: null, reason: 'no-runtime-process' })
    procs[90].exe = '/data/real/BAT.AppImage'
    expect(findAppImageKeepaliveFd(fakeProc(procs, { realpath: () => '/data/real/BAT.AppImage' }))).toEqual({ fd: 3, runtimePid: 90 })
    procs[90].exe = `${APPIMAGE} (deleted)`
    expect(findAppImageKeepaliveFd(fakeProc(procs, { realpath: () => { throw new Error('ENOENT') } }))).toEqual({ fd: 3, runtimePid: 90 })
  })

  it('this process is never the runtime process, even when its exe is the AppImage', () => {
    const procs = normalStart()
    delete procs[90]
    procs['100'] = { exe: APPIMAGE, fds: procs.self.fds }
    expect(findAppImageKeepaliveFd(fakeProc(procs))).toEqual({ fd: null, reason: 'no-runtime-process' })
  })

  it('several pipes to the runtime: two distinct keepalive candidates → ambiguous; two fds of one pipe → the lowest', () => {
    const procs = normalStart()
    procs.self.fds[8] = { link: 'pipe:[900]', flags: RDONLY }
    procs[90].fds[9] = { link: 'pipe:[900]', flags: WRONLY }
    expect(findAppImageKeepaliveFd(fakeProc(procs))).toEqual({ fd: null, reason: 'ambiguous', detail: '2 pipes' })
    const dup = normalStart()
    dup.self.fds[9] = { link: 'pipe:[700]', flags: RDONLY }
    expect(findAppImageKeepaliveFd(fakeProc(dup))).toEqual({ fd: 3, runtimePid: 90 })
  })

  it('unreadable fdinfo / vanished fds are skipped; /proc unreadable → error, never a throw', () => {
    const procs = normalStart()
    delete procs[90].fds[4].flags
    expect(findAppImageKeepaliveFd(fakeProc(procs))).toEqual({ fd: null, reason: 'not-found' })
    const boom = fakeProc(normalStart(), { readdir: () => { throw new Error('EACCES /proc') } })
    expect(findAppImageKeepaliveFd(boom)).toEqual({ fd: null, reason: 'error', detail: 'EACCES /proc' })
    const runtimeGone = fakeProc(normalStart())
    const readdir = runtimeGone.readdir
    runtimeGone.readdir = dir => { if (dir === '/proc/90/fd') throw new Error('ENOENT'); return readdir(dir) }
    expect(findAppImageKeepaliveFd(runtimeGone)).toEqual({ fd: null, reason: 'not-found' })
  })

  it('default deps read the real process (smoke: never throws; no APPIMAGE in the test env → not-appimage)', () => {
    const d = defaultAppImageKeepaliveDeps()
    expect(d.selfPid).toBe(process.pid)
    const r = findAppImageKeepaliveFd({ ...d, env: {} })
    expect(r).toEqual({ fd: null, reason: 'not-appimage' })
  })
})

describe('planTerminalServerFork', () => {
  it('Windows / macOS: the pre-T0816 stdio, no keepalive lookup, no log', () => {
    for (const platform of ['win32', 'darwin'] as const) {
      const find = vi.fn(() => ({ fd: 3, runtimePid: 1 }))
      expect(planTerminalServerFork(platform, find)).toEqual({ stdio: ['ignore', 'ignore', 'ignore', 'ipc'], keepaliveFd: null, log: null })
      expect(find).not.toHaveBeenCalled()
    }
  })

  it('Linux with a keepalive: stdio[4] = that fd, one [terminal-server] line', () => {
    const p = planTerminalServerFork('linux', () => ({ fd: 5, runtimePid: 90 }))
    expect(TERMINAL_SERVER_KEEPALIVE_FD).toBe(4)
    expect(p.stdio).toEqual(['ignore', 'ignore', 'ignore', 'ipc', 5])
    expect(p.keepaliveFd).toBe(5)
    expect(p.log).toBe('[terminal-server] fork (Linux, PLAN-062 A3): fd guard without crashpad client; AppImage keepalive fd 5 → 4 (runtime pid 90)')
  })

  it('Linux without a keepalive: 4 slots, never \'ignore\' in slot 4; the reason is logged; a throwing lookup is caught', () => {
    for (const [find, reason] of [
      [() => ({ fd: null, reason: 'not-appimage' as const }), 'none (not-appimage)'],
      [() => ({ fd: null, reason: 'ambiguous' as const, detail: '2 pipes' }), 'none (ambiguous: 2 pipes)'],
      [() => { throw new Error('boom') }, 'none (error: boom)'],
    ] as const) {
      const p = planTerminalServerFork('linux', find)
      expect(p.stdio).toEqual(['ignore', 'ignore', 'ignore', 'ipc'])
      expect(p.stdio).toHaveLength(4)
      expect(p.keepaliveFd).toBeNull()
      expect(p.log).toMatch(/^\[terminal-server\] fork \(Linux, PLAN-062 A3\): fd guard without crashpad client; AppImage keepalive: /)
      expect(p.log!.endsWith(reason)).toBe(true)
    }
  })
})
