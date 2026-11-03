// BUG-207 / T0807 (D253): on Linux a child_process child of the Electron main process keeps only its
// stdio fds (electron/child-process-fd-guard.ts), so long-running children (claude CLI, codex, MCP
// servers they start) no longer carry Chromium's descriptors.
//
// Runs against a packaged Linux build (`BAT_E2E_EXECUTABLE`), isolated runtime, one shell tab only
// (L185: no codex / claude tab, no login, no model call). Rows in `t0807-report.md` / `.json`
// (`LINUX_REPORT_DIR`):
//   G1  the main process logged `[child-fd-guard] installed`
//   G2  `spawn('sleep')`, `execFile('sleep')` and `spawn(process.execPath)` with ELECTRON_RUN_AS_NODE=1
//       (how the Claude SDK fallback / voice probe start) from the main process: no fd ≥ 3 without
//       O_CLOEXEC (the execPath child keeps only the fd its CRASHDUMP_SIGNAL_FD names), no /dev/ptmx
//   G3  reverse control: the main process itself has many fds without O_CLOEXEC (what a child used to
//       inherit, T0806: 49); the shell tab under the Terminal Server is still clean (T0806) and answers.
//       T0816 (PLAN-062 A3): the Terminal Server is no longer forked unguarded, so its count is recorded only
//       (judged by e2e/linux/t0816-terminal-server-fork.spec.ts K2); before T0816 G3 also required it ≥ 10
// Only reads /proc (fd lists, link targets, fdinfo flags, cmdline, environ variable NAMES). Everything
// this test starts is killed by pid after checking its command line. See
// docs/agent-guide/linux-pty-fd-inheritance.md.

import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { E2E_EXECUTABLE, closeIsolated, freePort, isolatedEnv, readPid, testLogger } from '../fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0807')
const WS = 'e2e-t0807-ws'
const TERM_A = 'e2e-t0807-a'

type Result = 'PASS' | 'FAIL'
interface Row { id: string; title: string; result: Result; evidence: string[] }
interface Fd { fd: number; target: string; cloexec: boolean | null }

test.skip(process.platform !== 'linux', 'T0807: Linux only')
test.skip(!E2E_EXECUTABLE, 'T0807: BAT_E2E_EXECUTABLE must point to the packaged Linux build')

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}
function cmdline(pid: number): string[] {
  try { return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').slice(0, -1) } catch { return [] }
}
function fdsOf(pid: number): Fd[] {
  try {
    return fs.readdirSync(`/proc/${pid}/fd`).map(Number).sort((a, b) => a - b).map(fd => {
      let target = ''
      try { target = fs.readlinkSync(`/proc/${pid}/fd/${fd}`) } catch { /* closed meanwhile */ }
      let cloexec: boolean | null = null
      try {
        const m = /^flags:\s+([0-7]+)/m.exec(fs.readFileSync(`/proc/${pid}/fdinfo/${fd}`, 'utf8'))
        if (m) cloexec = (parseInt(m[1], 8) & 0o2000000) !== 0
      } catch { /* closed meanwhile */ }
      return { fd, target, cloexec }
    })
  } catch { return [] }
}
const inheritable = (pid: number) => fdsOf(pid).filter(f => f.fd >= 3 && f.cloexec === false)
const envNames = (pid: number) => { try { return fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').map(e => e.split('=')[0]).filter(Boolean) } catch { return [] } }
const envValue = (pid: number, name: string) => { try { return fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').find(e => e.startsWith(`${name}=`))?.slice(name.length + 1) } catch { return undefined } }
const describe = (fds: Fd[]) => JSON.stringify(fds.map(f => `${f.fd}=${f.target.replace(os.homedir(), '~')}`))
const classify = (fds: Fd[]) => {
  const c: Record<string, number> = {}
  for (const f of fds) {
    const k = f.target.startsWith('socket:') ? 'socket' : f.target.startsWith('pipe:') ? 'pipe' : f.target.startsWith('anon_inode:') ? f.target.slice(11) : f.target === '/dev/ptmx' ? 'ptmx' : 'file'
    c[k] = (c[k] ?? 0) + 1
  }
  return JSON.stringify(c)
}
function pids(): number[] {
  return fs.readdirSync('/proc').filter(e => /^\d+$/.test(e)).map(Number)
}
function ppidOf(pid: number): number {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
    return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
  } catch { return -1 }
}
function shellOf(id: string, parent: number): number | null {
  for (const pid of pids()) {
    if (ppidOf(pid) !== parent) continue
    try {
      if (fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(`BAT_TERMINAL_ID=${id}`)) return pid
    } catch { /* not ours / gone */ }
  }
  return null
}
async function until<T>(what: string, fn: () => T | null | false | undefined, ms = 20_000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await new Promise(r => setTimeout(r, 100))
  }
}
function debugLog(userData: string): string {
  const dir = path.join(userData, 'Logs')
  try {
    return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  } catch { return '' }
}

test('T0807 Electron main-process children keep only their stdio fds', async () => {
  test.setTimeout(5 * 60_000)
  const reportDir = process.env.LINUX_REPORT_DIR || test.info().outputPath('report')
  fs.mkdirSync(reportDir, { recursive: true })
  const rows: Row[] = []
  const meta: Record<string, string> = { executable: path.basename(E2E_EXECUTABLE), kernel: os.release(), startedAt: new Date().toISOString() }
  const flush = () => {
    fs.writeFileSync(path.join(reportDir, 't0807-report.json'), JSON.stringify({ meta, rows }, null, 2))
    const md = ['# T0807 Linux child_process fd inheritance', '', ...Object.entries(meta).map(([k, v]) => `- **${k}**: ${v}`), '', '| ID | 結果 | 項目 |', '|---|---|---|']
    for (const r of rows) md.push(`| ${r.id} | ${r.result} | ${r.title} |`)
    for (const r of rows) md.push('', `## ${r.id} — ${r.result}`, '', r.title, '', ...r.evidence.map(e => `- ${e.replace(/\n/g, ' ')}`))
    fs.writeFileSync(path.join(reportDir, 't0807-report.md'), md.join('\n') + '\n')
  }
  const add = (row: Row) => { rows.push(row); log(`${row.id} ${row.result} — ${row.title}`); for (const e of row.evidence) log(`  ${e}`); flush() }

  const runtimeId = `e2e-t0807-${Date.now()}`
  const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 't0807-ws-')))
  const env = isolatedEnv(await freePort())
  const app: ElectronApplication = await electron.launch({ executablePath: E2E_EXECUTABLE, args: [`--runtime=${runtimeId}`], env, chromiumSandbox: true, timeout: 120_000 })
  let win!: Page
  let userData = ''
  const started: number[] = []
  try {
    userData = await app.evaluate(({ app: a }) => a.getPath('userData'))
    expect(path.basename(userData)).toContain(`-runtime-${runtimeId}`)
    win = await app.firstWindow()
    await expect.poll(() => win.url(), { timeout: 60_000 }).not.toMatch(/^(about:blank)?$/)
    await win.waitForLoadState('domcontentloaded')
    meta.app = await app.evaluate(({ app: a }) => `${a.getVersion()} (Electron ${process.versions.electron})`)
    const mainPid = await app.evaluate(() => process.pid)

    // one shell tab, so the Terminal Server is forked and holds a master
    await expect.poll(async () => win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()).then(v => v !== null), { timeout: 30_000 }).toBe(true)
    const data = { workspaces: [{ id: WS, name: 'T0807 linux', folderPath: folder, createdAt: Date.now() }], activeWorkspaceId: WS, activeGroup: null, terminals: [{ id: TERM_A, title: 'T0807 A', workspaceId: WS, type: 'terminal' }], activeTerminalId: TERM_A }
    expect(await win.evaluate(async (d) => (window as AnyApi).electronAPI.workspace.save(d), JSON.stringify(data))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const server = await until('Terminal Server pid file', () => readPid(userData))
    const shell = await until('shell of A', () => shellOf(TERM_A, server))

    // ── G1 ──
    {
      const line = debugLog(userData).split('\n').find(l => l.includes('[child-fd-guard]')) ?? ''
      add({ id: 'G1', title: 'the main process installed the child_process fd guard', result: /\[child-fd-guard\] installed \(\/(usr\/)?bin\/bash\)/.test(line) ? 'PASS' : 'FAIL', evidence: [`debug log: ${line.replace(/^.*?\[child-fd-guard\]/, '[child-fd-guard]')}`] })
    }

    // ── G2 ──
    {
      const ev: string[] = []
      const kids = await app.evaluate(async () => {
        const cp = process.getBuiltinModule('child_process') as typeof import('child_process')
        const a = cp.spawn('sleep', ['3707'], { stdio: 'ignore' })
        const b = cp.execFile('sleep', ['3708'], () => {})
        const c = cp.spawn(process.execPath, ['-e', 'setTimeout(()=>{},3709000)'], { stdio: 'ignore', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } })
        return { spawn: a.pid!, execFile: b.pid!, execPathNode: c.pid! }
      })
      started.push(kids.spawn, kids.execFile, kids.execPathNode)
      // Reference for the Electron-as-node child: the same binary started from a clean slate (every fd
      // ≥ 3 closed before exec, from this test process). Electron opens a few fds of its own without
      // O_CLOEXEC (v8 snapshot, eventpoll, eventfd); those are not inherited and show up here too.
      // "The same binary" is the main process's process.execPath — exactly what the execPathNode child
      // runs — not BAT_E2E_EXECUTABLE (T0810): for the AppImage, BAT_E2E_EXECUTABLE is the .AppImage, whose
      // runtime mounts the squashfs (adding its own FUSE fds) and goes through AppRun and the T0799 launcher
      // to `/tmp/.mount_*/BetterAgentTerminal.bin`, so the reference never had the AppImage path as
      // argv[0]. The mount stays while the app runs; for a `--linux dir` build execPath is the
      // executable itself, as before.
      const refExe = await app.evaluate(() => process.execPath)
      ev.push(`reference binary: main process execPath ${refExe} (BAT_E2E_EXECUTABLE ${path.basename(E2E_EXECUTABLE)}, /proc/${mainPid}/exe ${(() => { try { return fs.readlinkSync(`/proc/${mainPid}/exe`) } catch { return '?' } })()})`)
      const refPid = spawn('/bin/bash', ['-c', 'for f in /proc/self/fd/*; do n=${f##*/}; case $n in 0|1|2|*[!0-9]*) ;; *) eval "exec $n>&-" ;; esac; done; exec "$0" "$@"', refExe, '-e', 'setTimeout(()=>{},3710000)'], { stdio: 'ignore', env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: os.homedir(), ELECTRON_RUN_AS_NODE: '1' } }).pid!
      started.push(refPid)
      await until('reference exec\'d', () => cmdline(refPid)[0] === refExe).catch(e => { throw new Error(`${(e as Error).message} (reference argv ${JSON.stringify(cmdline(refPid))})`) })
      await new Promise(r => setTimeout(r, 1500))
      const kind = (t: string) => t.startsWith('socket:') ? 'socket' : t.startsWith('pipe:') ? 'pipe' : t
      const ownKinds = inheritable(refPid).map(f => kind(f.target)) // numbers vary between runs, kinds do not
      ev.push(`reference (same binary, clean start) pid ${refPid}: fd>=3 without O_CLOEXEC ${describe(inheritable(refPid))}`)
      let ok = true
      for (const [name, pid] of Object.entries(kids)) {
        await until(`${name} exec'd`, () => cmdline(pid).length > 0 && !cmdline(pid).includes('bat-child-fd-guard'))
        // let the program finish starting (an Electron-as-node child opens its own fds, with O_CLOEXEC)
        await new Promise(r => setTimeout(r, name === 'execPathNode' ? 1500 : 200))
        const fds = fdsOf(pid)
        const inh = inheritable(pid)
        const crash = envValue(pid, 'CRASHDUMP_SIGNAL_FD')
        // not allowed: anything beyond stdio that the program did not open itself (own = the clean-start reference)
        const own = name === 'execPathNode' ? [...ownKinds] : []
        const allowed = inh.filter(f => {
          if (String(f.fd) === crash) return false
          const i = own.indexOf(kind(f.target))
          if (i >= 0) { own.splice(i, 1); return false }
          return true
        })
        const ptmx = fds.some(f => f.target === '/dev/ptmx')
        ev.push(`${name} pid ${pid} argv ${JSON.stringify(cmdline(pid)).replace(process.execPath, '<execPath>')}: ${fds.length} fds, fd>=3 without O_CLOEXEC ${inh.length} ${describe(inh)}${crash ? ` (CRASHDUMP_SIGNAL_FD=${crash} kept)` : ''}, /dev/ptmx ${ptmx}, crashpad env names: ${envNames(pid).filter(n => /^CRASH/.test(n)).join(',') || 'none'}`)
        if (allowed.length !== 0 || ptmx || ppidOf(pid) !== mainPid) ok = false
      }
      add({ id: 'G2', title: 'main-process children (spawn / execFile / Electron-as-node): nothing inherited beyond stdio', result: ok ? 'PASS' : 'FAIL', evidence: ev })
    }

    // ── G3 ──
    {
      const ev: string[] = []
      const mainInh = inheritable(mainPid)
      const serverInh = inheritable(server)
      ev.push(`main process ${mainPid}: ${mainInh.length} fds without O_CLOEXEC ${classify(mainInh)} (what an unguarded child inherits)`)
      ev.push(`Terminal Server ${server} (T0816: forked through the guard, only IPC + AppImage keepalive inherited; recorded only, see t0816 K2): ${serverInh.length} fds without O_CLOEXEC ${classify(serverInh)}`)
      const shellFds = fdsOf(shell)
      const shellExtra = shellFds.filter(f => ![0, 1, 2, 255].includes(f.fd))
      ev.push(`shell A ${shell} under the server: fds ${describe(shellFds)}`)
      await win.evaluate(([i, t]) => (window as AnyApi).electronAPI.pty.write(i, t), [TERM_A, `echo t0807-$((6*7)) > '${folder}/a.txt'\r`])
      const answered = await until('shell A answered', () => { try { return fs.readFileSync(path.join(folder, 'a.txt'), 'utf8').trim() === 't0807-42' } catch { return false } }, 15_000).then(() => true, () => false)
      ev.push(`shell A ran a command: ${answered}`)
      add({ id: 'G3', title: 'reverse control: the main process carries inheritable fds; the shell tab still works and is clean', result: mainInh.length >= 10 && shellExtra.length === 0 && answered ? 'PASS' : 'FAIL', evidence: ev })
    }
  } finally {
    for (const pid of started) {
      const c = cmdline(pid).join(' ')
      if (isAlive(pid) && /(sleep 370[78]|setTimeout\(\(\)=>\{\},37(09|10)000\))/.test(c)) { try { process.kill(pid, 'SIGKILL') } catch { /* gone */ } }
    }
    await closeIsolated({ app, runtimeId, userData }, log)
    fs.rmSync(folder, { recursive: true, force: true })
  }
  expect(rows.filter(r => r.result !== 'PASS').map(r => r.id)).toEqual([])
})
