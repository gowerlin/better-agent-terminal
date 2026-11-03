// BUG-205 / T0806 (D252): on Linux every PTY child keeps only fd 0–2 (electron/pty-spawn-fd-guard.ts).
//
// Runs against a packaged Linux build (`BAT_E2E_EXECUTABLE`: an AppImage or `release/linux-unpacked/
// BetterAgentTerminal`), isolated runtime, shell tabs only (L185: no codex / claude tab, no keys to an
// agent TUI, no login). Steps, each a row in `t0806-report.md` / `.json` (`LINUX_REPORT_DIR`):
//   F1  two shell tabs (B created after A): each shell's /proc/<pid>/fd is 0–2 (+ bash's 255), no
//       /dev/ptmx; the Terminal Server itself holds both masters (so a leak would have shown); the shell
//       is the PTY's pid (`pty:created` log line, `fd-guard=closed`), its parent is the Terminal Server,
//       argv is the shell's own (`<shell> -l -i`)
//   F2  ⏻ restart of A: the new shell is clean too, B still clean
//   F3  closing a tab ends its shell and the shell's foreground child (`sleep`), as before (T0540 on Linux)
//   F4  Terminal Server killed (SIGKILL) → recovery re-forks it and rebuilds A under the same id: clean
//   F6  quit keeping the Terminal Server, relaunch, Recovery prompt → keep: A is the same pid and still
//       clean; a new tab C spawned by the surviving server (A's master open in it) is clean too
//   F5  `setsid sleep … &` left in a tab, quit with "Quit" + "stop Terminal Server": app.close() < 3 s and
//       no process of this build (crashpad) left; the background sleep holds only fd 0–2
// Only reads /proc (fd lists, link targets, cmdline, the BAT_TERMINAL_ID entry of environ — never other
// env values). Everything this test starts is killed by pid after checking its command line.
// See docs/agent-guide/linux-pty-fd-inheritance.md.

import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { E2E_EXECUTABLE, freePort, isolatedEnv, readPid, testLogger } from '../fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0806')
const WS = 'e2e-t0806-ws'
const TERM_A = 'e2e-t0806-a'
const TERM_B = 'e2e-t0806-b'
const TERM_C = 'e2e-t0806-c'
const ALLOWED_FDS = new Set([0, 1, 2, 255])
const CLOSE_LIMIT_MS = 3_000

type Result = 'PASS' | 'FAIL'
interface Row { id: string; title: string; result: Result; evidence: string[] }

test.skip(process.platform !== 'linux', 'T0806: Linux only')
test.skip(!E2E_EXECUTABLE, 'T0806: BAT_E2E_EXECUTABLE must point to the packaged Linux build')

// ── /proc helpers (read only) ────────────────────────────────────────────────

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}
function cmdline(pid: number): string[] {
  try { return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').slice(0, -1) } catch { return [] }
}
function ppidOf(pid: number): number {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
    return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
  } catch { return -1 }
}
function fdsOf(pid: number): Array<{ fd: number; target: string }> {
  try {
    return fs.readdirSync(`/proc/${pid}/fd`).map(Number).sort((a, b) => a - b).map(fd => {
      let target = ''
      try { target = fs.readlinkSync(`/proc/${pid}/fd/${fd}`) } catch { /* closed meanwhile */ }
      return { fd, target }
    })
  } catch { return [] }
}
const extraFds = (pid: number) => fdsOf(pid).filter(f => !ALLOWED_FDS.has(f.fd))
function pids(): number[] {
  return fs.readdirSync('/proc').filter(e => /^\d+$/.test(e)).map(Number)
}
/** Shells whose environ has BAT_TERMINAL_ID=<id> and whose parent is `parent` (only that one entry is compared). */
function shellOf(id: string, parent: number): number | null {
  for (const pid of pids()) {
    if (ppidOf(pid) !== parent) continue
    try {
      if (fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(`BAT_TERMINAL_ID=${id}`)) return pid
    } catch { /* not ours / gone */ }
  }
  return null
}
function childrenOf(parent: number): number[] {
  return pids().filter(p => ppidOf(p) === parent)
}
/** Processes running a binary of the build under test (crashpad, zygotes, the app itself). */
function processesOfBuild(appDir: string): Array<{ pid: number; exe: string }> {
  const out: Array<{ pid: number; exe: string }> = []
  for (const pid of pids()) {
    try {
      const exe = fs.readlinkSync(`/proc/${pid}/exe`)
      if (exe.startsWith(appDir + path.sep) || exe.startsWith('/tmp/.mount_')) out.push({ pid, exe: path.basename(exe) })
    } catch { /* not ours / gone */ }
  }
  return out
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
const describeFds = (pid: number) => JSON.stringify(fdsOf(pid).map(f => `${f.fd}=${f.target.replace(os.homedir(), '~')}`))

test('T0806 Linux PTY children keep only fd 0–2', async () => {
  test.setTimeout(10 * 60_000)
  const reportDir = process.env.LINUX_REPORT_DIR || test.info().outputPath('report')
  fs.mkdirSync(reportDir, { recursive: true })
  const rows: Row[] = []
  const meta: Record<string, string> = { executable: path.basename(E2E_EXECUTABLE), kernel: os.release(), startedAt: new Date().toISOString() }
  const flush = () => {
    fs.writeFileSync(path.join(reportDir, 't0806-report.json'), JSON.stringify({ meta, rows }, null, 2))
    const md = ['# T0806 Linux PTY fd inheritance', '', ...Object.entries(meta).map(([k, v]) => `- **${k}**: ${v}`), '', '| ID | 結果 | 項目 |', '|---|---|---|']
    for (const r of rows) md.push(`| ${r.id} | ${r.result} | ${r.title} |`)
    for (const r of rows) md.push('', `## ${r.id} — ${r.result}`, '', r.title, '', ...r.evidence.map(e => `- ${e.replace(/\n/g, ' ')}`))
    fs.writeFileSync(path.join(reportDir, 't0806-report.md'), md.join('\n') + '\n')
  }
  const add = (row: Row) => { rows.push(row); log(`${row.id} ${row.result} — ${row.title}`); for (const e of row.evidence) log(`  ${e}`); flush() }

  const appDir = path.dirname(fs.realpathSync(E2E_EXECUTABLE))
  const runtimeId = `e2e-t0806-${Date.now()}`
  const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 't0806-ws-')))
  const env = isolatedEnv(await freePort())
  const launch = () => electron.launch({ executablePath: E2E_EXECUTABLE, args: [`--runtime=${runtimeId}`], env, chromiumSandbox: true, timeout: 120_000 })
  let app: ElectronApplication = await launch()
  let win!: Page
  let userData = ''
  const started: number[] = [] // background processes this test made (killed at the end after a cmdline check)
  try {
    userData = await app.evaluate(({ app: a }) => a.getPath('userData'))
    expect(path.basename(userData)).toContain(`-runtime-${runtimeId}`)
    const openWindow = async () => {
      win = await app.firstWindow()
      await expect.poll(() => win.url(), { timeout: 60_000 }).not.toMatch(/^(about:blank)?$/)
      await win.waitForLoadState('domcontentloaded')
    }
    await openWindow()
    meta.app = await app.evaluate(({ app: a }) => `${a.getVersion()} (Electron ${process.versions.electron})`)

    const save = async (terminals: Array<{ id: string; title: string }>) => {
      await expect.poll(async () => win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()).then(v => v !== null), { timeout: 30_000 }).toBe(true)
      const data = {
        workspaces: [{ id: WS, name: 'T0806 linux', folderPath: folder, createdAt: Date.now() }],
        activeWorkspaceId: WS,
        activeGroup: null,
        terminals: terminals.map(t => ({ ...t, workspaceId: WS, type: 'terminal' })),
        activeTerminalId: terminals[terminals.length - 1].id,
      }
      expect(await win.evaluate(async (d) => (window as AnyApi).electronAPI.workspace.save(d), JSON.stringify(data))).toBe(true)
      await win.reload()
      await win.waitForLoadState('domcontentloaded')
    }
    const write = (id: string, text: string) => win.evaluate(([i, t]) => (window as AnyApi).electronAPI.pty.write(i, t), [id, text])
    const serverPid = () => readPid(userData)

    /** Waits until the shell for `id` under the current server has exec'd (argv no longer the guard) and its fds settled. */
    async function settledShell(id: string, parent: number): Promise<number> {
      const pid = await until(`shell of ${id}`, () => shellOf(id, parent))
      await until(`${id} exec'd into the shell`, () => cmdline(pid).length > 0 && !cmdline(pid).includes('bat-pty-fd-guard'))
      // a login profile may hold an fd of its own for a moment; an inherited one never goes away.
      // T0816: also wait for fd 255 (interactive bash opens it once its startup is done): judging mid-startup
      // caught a profile's transient fd once (24.04, linux-acceptance run 41661353142, F4)
      await until(`${id} fds settle`, () => extraFds(pid).length === 0 && fdsOf(pid).some(f => f.fd === 255), 8_000).catch(() => { /* judged below */ })
      return pid
    }
    async function judgeShell(label: string, id: string, pid: number, parent: number, ev: string[]): Promise<boolean> {
      const argv = cmdline(pid)
      // T0816: one /proc snapshot for the verdict and the evidence (they were read separately)
      const fds = fdsOf(pid)
      const ptmx = fds.some(f => f.target === '/dev/ptmx')
      // T0816: an inherited fd never goes away; a login profile's own one does (22.04, linux-acceptance run
      // 41664258284: `3=/etc/init.d` while a profile listed it). Only extras still open — same fd, same
      // target — after up to 5 s count.
      const first = fds.filter(f => !ALLOWED_FDS.has(f.fd))
      let extra = first
      for (let i = 0; i < 20 && extra.length > 0; i++) {
        await new Promise(r => setTimeout(r, 250))
        const now = fdsOf(pid)
        extra = extra.filter(e => now.some(f => f.fd === e.fd && f.target === e.target))
      }
      const transient = first.filter(e => !extra.includes(e))
      const logged = new RegExp(`server spawned PTY ${id} \\(pid ${pid}\\) fd-guard=closed`).test(debugLog(userData))
      ev.push(`${label}: pid ${pid}, parent ${ppidOf(pid)} (Terminal Server ${parent}), argv ${JSON.stringify(argv)}, fds ${JSON.stringify(fds.map(f => `${f.fd}=${f.target.replace(os.homedir(), '~')}`))}${transient.length ? ` (closed again within 5 s, not inherited: ${JSON.stringify(transient.map(f => `${f.fd}=${f.target}`))})` : ''}, /dev/ptmx: ${ptmx}, log "server spawned PTY ${id} (pid ${pid}) fd-guard=closed": ${logged}`)
      return extra.length === 0 && !ptmx && ppidOf(pid) === parent && logged && argv.slice(1).join(' ') === '-l -i' && !argv.includes('-c')
    }

    // ── F1: two shell tabs ──
    {
      const ev: string[] = []
      await save([{ id: TERM_A, title: 'T0806 A' }])
      const server = await until('Terminal Server pid file', () => serverPid())
      const a = await settledShell(TERM_A, server)
      await save([{ id: TERM_A, title: 'T0806 A' }, { id: TERM_B, title: 'T0806 B' }])
      const b = await settledShell(TERM_B, server)
      expect(shellOf(TERM_A, server)).toBe(a) // the reload re-sent pty:create for A idempotently
      ev.push(`B (pid ${b}) was spawned while A (pid ${a}) was running`)
      const okA = await judgeShell('A', TERM_A, a, server, ev)
      const okB = await judgeShell('B', TERM_B, b, server, ev)
      const serverMasters = fdsOf(server).filter(f => f.target === '/dev/ptmx').length
      ev.push(`Terminal Server ${server} holds ${serverMasters} /dev/ptmx (both tabs' masters; a leak would have been visible)`)
      add({ id: 'F1', title: 'two shell tabs: only fd 0–2 (+255), no /dev/ptmx; pid / parent / argv unchanged', result: okA && okB && serverMasters >= 2 ? 'PASS' : 'FAIL', evidence: ev })
    }

    // ── F2: ⏻ restart ──
    {
      const ev: string[] = []
      const server = serverPid()!
      const before = shellOf(TERM_A, server)!
      expect(await win.evaluate(([i, c]) => (window as AnyApi).electronAPI.pty.restart(i, c), [TERM_A, folder])).toBe(true)
      await until('old shell A gone', () => !isAlive(before))
      const a = await settledShell(TERM_A, server)
      const okA = await judgeShell('A after restart', TERM_A, a, server, ev)
      const b = shellOf(TERM_B, server)!
      const okB = extraFds(b).length === 0
      ev.push(`B (pid ${b}) after A's restart: fds ${describeFds(b)}`)
      add({ id: 'F2', title: '⏻ restart: the new shell is clean, the other tab still clean', result: okA && okB && a !== before ? 'PASS' : 'FAIL', evidence: ev })
    }

    // ── F3: closing a tab ends its shell and the shell's foreground child ──
    {
      const ev: string[] = []
      const server = serverPid()!
      const b = shellOf(TERM_B, server)!
      await write(TERM_B, 'sleep 3601\r')
      const sleep = await until('foreground sleep in B', () => childrenOf(b).find(p => cmdline(p).join(' ') === 'sleep 3601'))
      started.push(sleep)
      ev.push(`B shell ${b}, foreground child sleep ${sleep} fds ${describeFds(sleep)}`)
      await win.evaluate((i) => (window as AnyApi).electronAPI.pty.kill(i), TERM_B)
      const gone = await until('B and its sleep gone', () => !isAlive(b) && !isAlive(sleep), 10_000).then(() => true, () => false)
      ev.push(`after closing B: shell alive ${isAlive(b)}, sleep alive ${isAlive(sleep)}`)
      add({ id: 'F3', title: 'closing a tab ends the shell and its foreground child (T0540 on Linux)', result: gone ? 'PASS' : 'FAIL', evidence: ev })
    }

    // ── F4: Terminal Server recovery ──
    {
      const ev: string[] = []
      const oldServer = serverPid()!
      const oldA = shellOf(TERM_A, oldServer)!
      const cmd = cmdline(oldServer).join(' ')
      expect(cmd).toContain('terminal-server.js')
      process.kill(oldServer, 'SIGKILL')
      const server = await until('re-forked Terminal Server', () => { const p = serverPid(); return p && p !== oldServer && isAlive(p) ? p : null }, 30_000)
      const a = await settledShell(TERM_A, server)
      ev.push(`killed Terminal Server ${oldServer} (shell A was ${oldA}, alive after recovery: ${isAlive(oldA)}); new server ${server}`)
      const okA = await judgeShell('A rebuilt by the recovery', TERM_A, a, server, ev)
      add({ id: 'F4', title: 'Terminal Server recovery rebuild: the rebuilt shell is clean', result: okA && !isAlive(oldA) ? 'PASS' : 'FAIL', evidence: ev })
    }

    // ── F6: quit keeping the Terminal Server, relaunch, Recovery prompt → keep ──
    {
      const ev: string[] = []
      const server = serverPid()!
      const a = shellOf(TERM_A, server)!
      await app.evaluate(({ dialog }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(dialog as any).showMessageBox = async () => ({ response: 1, checkboxChecked: false }) // Quit, keep Terminal Server
      })
      const closed = await Promise.race([app.close().then(() => true, () => true), new Promise<boolean>(r => setTimeout(() => r(false), 20_000))])
      if (!closed) try { app.process().kill('SIGKILL') } catch { /* gone */ }
      ev.push(`quit keeping the server: app.close() finished ${closed}; Terminal Server ${server} alive ${isAlive(server)}, shell A ${a} alive ${isAlive(a)}`)
      app = await launch()
      await openWindow()
      const prompt = win.locator('.recovery-prompt-dialog')
      await expect(prompt).toBeVisible({ timeout: 30_000 })
      await prompt.locator('.recovery-prompt-actions .btn-primary').click()
      await expect.poll(() => debugLog(userData), { timeout: 30_000 }).toContain(`pty:create SKIP (idempotent) id=${TERM_A}`)
      const sameA = shellOf(TERM_A, server) === a && serverPid() === server
      ev.push(`after Recovery "keep": server ${serverPid()}, shell A pid ${shellOf(TERM_A, server)} (same: ${sameA}), fds ${describeFds(a)}`)
      await save([{ id: TERM_A, title: 'T0806 A' }, { id: TERM_C, title: 'T0806 C' }])
      const c = await settledShell(TERM_C, server)
      const okC = await judgeShell('C (new tab on the surviving server)', TERM_C, c, server, ev)
      const masters = fdsOf(server).filter(f => f.target === '/dev/ptmx').length
      ev.push(`surviving Terminal Server ${server} holds ${masters} /dev/ptmx`)
      add({ id: 'F6', title: 'Recovery prompt "keep": the kept shell stays clean; a new tab on the surviving server is clean', result: sameA && extraFds(a).length === 0 && okC && masters >= 2 ? 'PASS' : 'FAIL', evidence: ev })
    }

    // ── F5: background process + quit (stop Terminal Server) ──
    {
      const ev: string[] = []
      const server = serverPid()!
      const a = shellOf(TERM_A, server)!
      await write(TERM_A, 'setsid sleep 3602 </dev/null >/dev/null 2>&1 &\r')
      const bg = await until('background sleep', () => pids().find(p => cmdline(p).join(' ') === 'sleep 3602'))
      started.push(bg)
      const bgExtra = extraFds(bg).filter(f => f.fd !== 255)
      ev.push(`background sleep ${bg} (from shell ${a}) fds ${describeFds(bg)}`)
      const before = processesOfBuild(appDir)
      ev.push(`processes of this build before quit: ${JSON.stringify(before.map(p => p.exe))}`)
      await app.evaluate(({ dialog }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(dialog as any).showMessageBox = async () => ({ response: 1, checkboxChecked: true }) // Quit + stop Terminal Server
      })
      const t0 = Date.now()
      const closed = await Promise.race([app.close().then(() => true, () => true), new Promise<boolean>(r => setTimeout(() => r(false), 20_000))])
      const closeMs = Date.now() - t0
      await new Promise(r => setTimeout(r, 1_000))
      const left = processesOfBuild(appDir)
      ev.push(`app.close(): ${closed ? `${closeMs} ms` : 'did not finish in 20 s'}; Terminal Server alive ${isAlive(server)}; background sleep alive ${isAlive(bg)}`)
      ev.push(`processes of this build 1 s after quit: ${JSON.stringify(left.map(p => `${p.pid}:${p.exe}`))}`)
      if (!closed) try { app.process().kill('SIGKILL') } catch { /* gone */ }
      add({
        id: 'F5',
        title: `background \`setsid sleep\` + quit (stop Terminal Server): app.close() < ${CLOSE_LIMIT_MS / 1000} s, no crashpad left, the sleep has only fd 0–2`,
        result: closed && closeMs < CLOSE_LIMIT_MS && left.length === 0 && bgExtra.length === 0 && !isAlive(server) ? 'PASS' : 'FAIL',
        evidence: ev,
      })
    }
  } finally {
    try { await Promise.race([app.close(), new Promise(r => setTimeout(r, 5_000))]) } catch { /* already closed */ }
    try { app.process().kill('SIGKILL') } catch { /* gone */ }
    for (const pid of started) {
      if (isAlive(pid) && cmdline(pid)[0] === 'sleep') try { process.kill(pid, 'SIGKILL') } catch { /* gone */ }
    }
    const sp = userData ? readPid(userData) : null
    if (sp && isAlive(sp) && cmdline(sp).join(' ').includes('terminal-server.js')) try { process.kill(sp, 'SIGKILL') } catch { /* gone */ }
    if (userData && path.basename(userData).includes(`-runtime-${runtimeId}`)) {
      try { fs.copyFileSync(path.join(userData, 'Logs', fs.readdirSync(path.join(userData, 'Logs')).filter(f => f.startsWith('debug-')).sort().at(-1)!), path.join(reportDir, 't0806-debug.log')) } catch { /* no log */ }
      fs.rmSync(userData, { recursive: true, force: true })
    }
    fs.rmSync(folder, { recursive: true, force: true })
    meta.finishedAt = new Date().toISOString()
    flush()
  }
  expect(rows.map(r => `${r.id}=${r.result}`)).toEqual(['F1=PASS', 'F2=PASS', 'F3=PASS', 'F4=PASS', 'F6=PASS', 'F5=PASS'])
})
