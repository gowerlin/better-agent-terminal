// @vitest-environment node
/**
 * BUG-205 / T0806: Linux only (CI ubuntu-24.04), real `@lydell/node-pty`. Not-regression guard for
 * "a PTY child does not get another tab's pty master": `PtyManager` in direct mode (headless and the
 * Electron fallback use this path) opens two shells; without the fd guard the second one held the
 * first one's `/dev/ptmx` (node-pty 1.1.0 opens masters without FD_CLOEXEC, T0805). Each shell may
 * keep only fd 0–2 (and bash's own 255); the shell's pid is the one node-pty reported (the guard
 * execs into it) and its argv is the original one. The Terminal Server path is the same function
 * (electron/__tests__/pty-spawn-fd-guard.test.ts checks the wiring; e2e/linux/t0806 the packaged app).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'

const RUN = process.platform === 'linux' && fs.existsSync('/bin/bash') && fs.existsSync('/proc/self/fd')
const ALLOWED_FDS = new Set([0, 1, 2, 255])

/** pid of the direct child of this process whose env has BAT_TERMINAL_ID=<id> (reads only that key). */
function shellPidOf(id: string): number | null {
  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    try {
      const stat = fs.readFileSync(`/proc/${entry}/stat`, 'utf8')
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
      if (ppid !== process.pid) continue
      const env = fs.readFileSync(`/proc/${entry}/environ`, 'utf8').split('\0')
      if (env.includes(`BAT_TERMINAL_ID=${id}`)) return Number(entry)
    } catch { /* gone or not ours */ }
  }
  return null
}

function fdsOf(pid: number): Array<{ fd: number; target: string }> {
  return fs.readdirSync(`/proc/${pid}/fd`).map(Number).sort((a, b) => a - b).map(fd => {
    let target = ''
    try { target = fs.readlinkSync(`/proc/${pid}/fd/${fd}`) } catch { /* closed meanwhile */ }
    return { fd, target }
  })
}

async function until<T>(fn: () => T | null, ms = 10_000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const v = fn()
    if (v !== null && v !== undefined && v !== false) return v as T
    if (Date.now() > end) throw new Error('timed out')
    await new Promise(r => setTimeout(r, 50))
  }
}

describe.runIf(RUN)('Linux direct-mode PTYs keep only fd 0–2 (real node-pty)', () => {
  const managers: Array<{ dispose(): void }> = []
  const dirs: string[] = []

  afterEach(() => {
    for (const m of managers.splice(0)) m.dispose()
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('two shells: neither holds a pty master or any other inherited fd; pid and argv are the shell', async () => {
    const logs: string[] = []
    vi.spyOn(logger, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')) })
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { PtyManager } = await import('../pty-manager')
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0806-direct-'))
    dirs.push(dataDir)
    const m = new PtyManager({ emit: () => {}, dataDir })
    managers.push(m)
    const args = ['-l', '-i'] // what PtyManager gives a Linux shell

    expect(m.create({ id: 't0806-a', cwd: os.tmpdir(), type: 'terminal', shell: '/bin/bash' })).toBe(true)
    const pidA = await until(() => shellPidOf('t0806-a'))
    expect(m.create({ id: 't0806-b', cwd: os.tmpdir(), type: 'terminal', shell: '/bin/bash' })).toBe(true)
    const pidB = await until(() => shellPidOf('t0806-b'))
    // the guard has exec'd into bash once its argv is the shell's own
    for (const pid of [pidA, pidB]) {
      await until(() => fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0')[0] === '/bin/bash' && !fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('bat-pty-fd-guard'))
    }

    for (const [id, pid] of [['a', pidA], ['b', pidB]] as const) {
      // a login profile may hold an fd of its own for a moment; an inherited one never goes away
      const extraOf = () => fdsOf(pid).filter(f => !ALLOWED_FDS.has(f.fd))
      await until(() => extraOf().length === 0, 5_000).catch(() => {})
      const fds = fdsOf(pid)
      expect(extraOf(), `shell ${id} (pid ${pid}) fds: ${JSON.stringify(fds)}`).toEqual([])
      expect(fds.some(f => f.target === '/dev/ptmx')).toBe(false)
      expect(fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').slice(0, -1)).toEqual(['/bin/bash', ...args])
    }
    // this process does hold both masters, so a leak would have been visible
    expect(fdsOf(process.pid).filter(f => f.target === '/dev/ptmx').length).toBeGreaterThanOrEqual(2)
    expect(logs.filter(l => l.includes('[pty-fd-guard] node-pty t0806-')).length).toBe(2)
  }, 60_000)
})
