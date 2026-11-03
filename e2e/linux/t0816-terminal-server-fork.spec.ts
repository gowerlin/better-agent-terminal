// T0816 (PLAN-062 option A3, BUG-209, D260): on Linux the Terminal Server fork goes through the child_process
// fd guard without the crashpad client env (electron/main.ts `forkTerminalServer`), keeping only fd 0–3 (IPC)
// and, from an AppImage, the keepalive pipe at fd 4 (electron/appimage-keepalive.ts).
//
// Runs against a packaged Linux build (`BAT_E2E_EXECUTABLE`, the AppImage in linux-acceptance.yml), one
// isolated runtime, one shell tab only (L185: no codex / claude tab, no login, no model call). Rows in
// `t0816-report.md` / `.json` (`LINUX_REPORT_DIR`):
//   K2  the server's inherited fds are 0–3 (+ fd 4 = the main process's AppImage keepalive pipe, held by the
//       FUSE runtime), checked for a Playwright start (keepalive at main fd 5) and a normal start (main fd 3,
//       the BUG-209 case); no CRASHDUMP_SIGNAL_FD / CRASHPAD_HANDLER_PID in its environ (names only); `ss`
//       finds no server socket whose peer the crashpad handler holds; the fork's debug log line
//   K1  normal start under `bash -c 'out=$(… 2>&1)'`, quit keeping the server: the substitution returns
//       ≤ 10 s after the main process exits, and nobody but that bash holds the main process's stdout pipe
//       (judged by /proc and that timing, never by Playwright's app.close(): the FUSE runtime holds
//       Playwright's extra fds 3 / 4 for as long as the mount lives)
//   K3  same run, after the main process exited: /proc/mounts still has the mount the server runs from and
//       the tail of /proc/<server>/exe reads back (BUG-209: ENOTCONN before)
//   K4  relaunch the same runtime: Recovery prompt, "keep": the kept server and shell answer a command
//   K5  a renderer crash (CDP Page.crash) still writes Crashes/pending/*.dmp
// The normal start is driven through the main process's Node inspector (`--inspect=127.0.0.1:<free port>`):
// only to read process.pid and answer the quit dialog the way closeIsolated / t0806 F6 do. Only reads /proc
// (fd lists, link targets, fdinfo flags, mounts, environ variable NAMES); everything this test starts is
// killed by pid after checking its command line. See docs/agent-guide/linux-pty-fd-inheritance.md.

import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
import { E2E_EXECUTABLE, closeIsolated, freePort, isolatedEnv, readPid, testLogger } from '../fixtures/electron-isolation'
import { runCmd } from './linux-os'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0816')
const WS = 'e2e-t0816-ws'
const TERM_A = 'e2e-t0816-a'
const K1_LIMIT_MS = 10_000
const CRASHPAD_ENV = ['CRASHDUMP_SIGNAL_FD', 'CRASHPAD_HANDLER_PID']

type Result = 'PASS' | 'FAIL'
interface Row { id: string; title: string; result: Result; evidence: string[] }
interface Fd { fd: number; target: string; cloexec: boolean | null }

test.skip(process.platform !== 'linux', 'T0816: Linux only')
test.skip(!E2E_EXECUTABLE, 'T0816: BAT_E2E_EXECUTABLE must point to the packaged Linux build')

// ── /proc helpers (read only) ────────────────────────────────────────────────

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}
function cmdline(pid: number): string[] {
  try { return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').slice(0, -1) } catch { return [] }
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
function exeOf(pid: number): string {
  try { return fs.readlinkSync(`/proc/${pid}/exe`) } catch { return '' }
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
const envNames = (pid: number) => { try { return fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').map(e => e.split('=')[0]).filter(Boolean) } catch { return [] } }
const describeFds = (fds: Fd[]) => JSON.stringify(fds.map(f => `${f.fd}=${f.target.replace(os.homedir(), '~')}${f.cloexec === false ? '' : '(cloexec)'}`))
/** every process (but `except`) holding an fd whose link target is `target` */
function holders(target: string, except: number[] = []): Array<{ pid: number; fd: number; comm: string }> {
  const out: Array<{ pid: number; fd: number; comm: string }> = []
  for (const pid of pids()) {
    if (except.includes(pid)) continue
    for (const f of fdsOf(pid)) {
      if (f.target === target) {
        let comm = ''
        try { comm = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim() } catch { /* gone */ }
        out.push({ pid, fd: f.fd, comm })
      }
    }
  }
  return out
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
async function until<T>(what: string, fn: () => T | null | false | undefined | Promise<T | null | false | undefined>, ms = 30_000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn()
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
const crashpadPids = () => pids().filter(p => cmdline(p).some(a => a === '--type=crashpad-handler') || /crashpad/.test(path.basename(exeOf(p))))

/** `ss -xapn`: server socket inodes whose peer a crashpad handler holds (null when ss is unavailable). */
async function crashpadPeersOf(server: number): Promise<{ peers: string[]; note: string } | null> {
  const r = await runCmd('ss', ['-xapn'], 15_000, 8 * 1024 * 1024)
  if (r.code !== 0) return null
  const byInode = new Map<string, number[]>()
  const peerOf = new Map<string, string>()
  for (const line of r.stdout.split('\n')) {
    const m = /^\S+\s+\S+\s+\d+\s+\d+\s+\S+\s+(\d+)\s+\S+\s+(\d+)\s*(.*)$/.exec(line.trim())
    if (!m) continue
    byInode.set(m[1], [...m[3].matchAll(/pid=(\d+)/g)].map(x => Number(x[1])))
    peerOf.set(m[1], m[2])
  }
  const crash = new Set(crashpadPids())
  const peers: string[] = []
  let serverSockets = 0
  for (const [inode, owners] of byInode) {
    if (!owners.includes(server)) continue
    serverSockets++
    const peer = peerOf.get(inode)
    if (peer && (byInode.get(peer) ?? []).some(p => crash.has(p))) peers.push(`${inode}→${peer}`)
  }
  return { peers, note: `ss: ${byInode.size} unix sockets, ${serverSockets} held by the server, crashpad pids ${JSON.stringify([...crash])}` }
}

// ── Node inspector (normal start only) ───────────────────────────────────────

async function inspectorUrl(port: number, ms = 150_000): Promise<string> {
  return until(`inspector on ${port}`, async () => {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as Array<{ webSocketDebuggerUrl?: string }>
      return list.find(t => t.webSocketDebuggerUrl)?.webSocketDebuggerUrl
    } catch { return undefined }
  }, ms)
}
async function inspectorEval(url: string, expression: string): Promise<unknown> {
  const ws = new WebSocket(url)
  await new Promise<void>((res, rej) => { ws.once('open', () => res()); ws.once('error', rej) })
  try {
    const reply = new Promise<AnyApi>((res, rej) => {
      ws.on('message', d => { const m = JSON.parse(String(d)); if (m.id === 1) res(m) })
      ws.once('close', () => rej(new Error('inspector closed before replying')))
      setTimeout(() => rej(new Error('inspector reply timed out')), 20_000)
    })
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true } }))
    const m = await reply
    if (m.error || m.result?.exceptionDetails) throw new Error(JSON.stringify(m.error ?? m.result.exceptionDetails).slice(0, 600))
    return m.result?.result?.value
  } finally {
    ws.close()
  }
}
// the main bundle is CommonJS (dist-electron/main.js), so process.mainModule.require reaches 'electron';
// the inspector's command-line `require` is the fallback
const ELECTRON = "(() => { try { return process.mainModule.require('electron') } catch (e) { if (typeof require === 'function') return require('electron'); throw e } })()"

// ── K2 judgement (one server, one start) ─────────────────────────────────────

async function judgeServer(label: string, main: number, server: number, appImage: string | null, ev: string[]): Promise<boolean> {
  const sFds = fdsOf(server)
  const mFds = fdsOf(main)
  const mainTargets = new Set(mFds.map(f => f.target))
  const inherited = sFds.filter(f => f.fd >= 3 && f.cloexec === false && f.target !== '/dev/ptmx')
  // shared with the main process = inherited from it (pipes / sockets are per object; independent opens differ)
  const shared = sFds.filter(f => f.fd >= 3 && /^(pipe|socket):\[/.test(f.target) && mainTargets.has(f.target))
  const fd4 = sFds.find(f => f.fd === 4)
  let ok = true
  ev.push(`${label}: main ${main} has ${mFds.length} fds; Terminal Server ${server} has ${sFds.length} fds, without O_CLOEXEC (not /dev/ptmx) ${describeFds(inherited)}`)
  if (appImage) {
    const runtimes = pids().filter(p => p !== main && exeOf(p).replace(/ \(deleted\)$/, '') === appImage)
    const keepalive = fd4 && /^pipe:\[/.test(fd4.target) ? fd4.target : null
    const runtimeHolds = keepalive ? runtimes.filter(p => fdsOf(p).some(f => f.target === keepalive)) : []
    const mainFd = keepalive ? mFds.find(f => f.target === keepalive)?.fd : undefined
    ev.push(`${label}: server fd 4 ${fd4 ? fd4.target : 'absent'}; main holds it at fd ${mainFd ?? 'none'}; AppImage runtime pids ${JSON.stringify(runtimes)} holding it ${JSON.stringify(runtimeHolds)}`)
    if (!keepalive || mainFd === undefined || runtimeHolds.length === 0) ok = false
    if (shared.some(f => f.target !== keepalive)) ok = false
  } else {
    ev.push(`${label}: not an AppImage: server fd 4 ${fd4 ? fd4.target : 'absent'}`)
    if (shared.length > 0) ok = false
  }
  ev.push(`${label}: server fds ≥ 3 shared with the main process ${describeFds(shared)} (allowed: the keepalive at fd 4)`)
  const crashEnv = envNames(server).filter(n => CRASHPAD_ENV.includes(n))
  ev.push(`${label}: server environ crashpad names: ${crashEnv.join(',') || 'none'}`)
  if (crashEnv.length > 0) ok = false
  const ss = await crashpadPeersOf(server)
  if (ss) {
    ev.push(`${label}: ${ss.note}; server sockets whose peer crashpad holds: ${JSON.stringify(ss.peers)}`)
    if (ss.peers.length > 0) ok = false
  } else {
    ev.push(`${label}: ss -xapn unavailable (not judged)`)
  }
  return ok
}

test('T0816 Terminal Server fork: only IPC + AppImage keepalive, no crashpad client', async () => {
  test.setTimeout(12 * 60_000)
  const reportDir = process.env.LINUX_REPORT_DIR || test.info().outputPath('report')
  fs.mkdirSync(reportDir, { recursive: true })
  const rows: Row[] = []
  const meta: Record<string, string> = { executable: path.basename(E2E_EXECUTABLE), kernel: os.release(), startedAt: new Date().toISOString() }
  const flush = () => {
    fs.writeFileSync(path.join(reportDir, 't0816-report.json'), JSON.stringify({ meta, rows }, null, 2))
    const md = ['# T0816 Terminal Server fork (PLAN-062 A3, BUG-209)', '', ...Object.entries(meta).map(([k, v]) => `- **${k}**: ${v}`), '', '| ID | 結果 | 項目 |', '|---|---|---|']
    for (const r of rows) md.push(`| ${r.id} | ${r.result} | ${r.title} |`)
    for (const r of rows) md.push('', `## ${r.id} — ${r.result}`, '', r.title, '', ...r.evidence.map(e => `- ${e.replace(/\n/g, ' ')}`))
    fs.writeFileSync(path.join(reportDir, 't0816-report.md'), md.join('\n') + '\n')
  }
  const add = (row: Row) => { rows.push(row); log(`${row.id} ${row.result} — ${row.title}`); for (const e of row.evidence) log(`  ${e}`); flush() }

  const appImage = /\.AppImage$/i.test(E2E_EXECUTABLE) ? fs.realpathSync(E2E_EXECUTABLE) : null
  meta.appImage = appImage ? 'yes' : 'no'
  const runtimeId = `e2e-t0816-${Date.now()}`
  const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 't0816-ws-')))
  const env = isolatedEnv(await freePort())
  const launch = () => electron.launch({ executablePath: E2E_EXECUTABLE, args: [`--runtime=${runtimeId}`], env, chromiumSandbox: true, timeout: 120_000 })
  let app: ElectronApplication | null = await launch()
  let win!: Page
  let userData = ''
  let plain: ChildProcess | null = null
  const openWindow = async () => {
    win = await app!.firstWindow()
    await expect.poll(() => win.url(), { timeout: 60_000 }).not.toMatch(/^(about:blank)?$/)
    await win.waitForLoadState('domcontentloaded')
  }
  const k2: { ok: boolean; ev: string[] } = { ok: true, ev: [] }
  try {
    userData = await app.evaluate(({ app: a }) => a.getPath('userData'))
    expect(path.basename(userData)).toContain(`-runtime-${runtimeId}`)
    await openWindow()
    meta.app = await app.evaluate(({ app: a }) => `${a.getVersion()} (Electron ${process.versions.electron})`)

    // ── launch 1 (Playwright): seed one shell tab; K2 for a Playwright start ──
    {
      await expect.poll(async () => win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()).then(v => v !== null), { timeout: 30_000 }).toBe(true)
      const data = { workspaces: [{ id: WS, name: 'T0816 linux', folderPath: folder, createdAt: Date.now() }], activeWorkspaceId: WS, activeGroup: null, terminals: [{ id: TERM_A, title: 'T0816 A', workspaceId: WS, type: 'terminal' }], activeTerminalId: TERM_A }
      expect(await win.evaluate(async (d) => (window as AnyApi).electronAPI.workspace.save(d), JSON.stringify(data))).toBe(true)
      await win.reload()
      await win.waitForLoadState('domcontentloaded')
      const main = await app.evaluate(() => process.pid)
      const server = await until('Terminal Server pid file', () => readPid(userData))
      await until('shell of A', () => shellOf(TERM_A, server))
      await new Promise(r => setTimeout(r, 1500))
      if (!await judgeServer('Playwright start', main, server, appImage, k2.ev)) k2.ok = false
      const line = debugLog(userData).split('\n').find(l => l.includes('[terminal-server] fork (Linux, PLAN-062 A3)')) ?? ''
      k2.ev.push(`Playwright start debug log: ${line.replace(/^.*?\[terminal-server\]/, '[terminal-server]') || 'missing'}`)
      if (!line || (appImage && !/keepalive fd \d+ → 4/.test(line))) k2.ok = false
      await closeIsolated({ app, runtimeId, userData }, log, { keepUserData: true })
      app = null
    }

    // ── normal start: bash -c 'out=$(AppImage … 2>&1)', no fd beyond 0–2; K2, quit keeping the server; K1, K3 ──
    let keptServer = 0
    {
      const inspectPort = await freePort()
      const script = [
        'for f in /proc/self/fd/*; do n=${f##*/}; case $n in 0|1|2|*[!0-9]*) ;; *) eval "exec $n>&-" 2>/dev/null ;; esac; done',
        'out=$("$0" "$@" 2>&1)',
        'printf \'SUBST_DONE %s %s\\n\' "$(date +%s%3N)" "${#out}"',
      ].join('\n')
      let stdout = ''
      plain = spawn('/bin/bash', ['-c', script, E2E_EXECUTABLE, `--runtime=${runtimeId}`, `--inspect=127.0.0.1:${inspectPort}`], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
      plain.stdout!.on('data', d => { stdout += d })
      plain.stderr!.on('data', () => { /* drained */ })
      const bashPid = plain.pid!
      const url = await inspectorUrl(inspectPort)
      const main = Number(await inspectorEval(url, 'process.pid'))
      const previous = readPid(userData)
      const server = await until('Terminal Server of the normal start', () => { const p = readPid(userData); return p && p !== previous && isAlive(p) ? p : null }, 120_000)
      const shell = await until('shell of A (normal start)', () => shellOf(TERM_A, server), 60_000)
      await new Promise(r => setTimeout(r, 1500))
      const stdoutTarget = fdsOf(main).find(f => f.fd === 1)?.target ?? ''
      k2.ev.push(`normal start: bash ${bashPid}, main ${main} (argv[0] ${path.basename(cmdline(main)[0] ?? '?')}, ppid ${ppidOf(main)}), fds ${describeFds(fdsOf(main).filter(f => f.fd <= 5))}`)
      if (!await judgeServer('normal start', main, server, appImage, k2.ev)) k2.ok = false
      const line = debugLog(userData).split('\n').filter(l => l.includes('[terminal-server] fork (Linux, PLAN-062 A3)')).at(-1) ?? ''
      k2.ev.push(`normal start debug log: ${line.replace(/^.*?\[terminal-server\]/, '[terminal-server]') || 'missing'}`)
      if (!line || (appImage && !/keepalive fd 3 → 4/.test(line))) k2.ok = false
      add({ id: 'K2', title: 'Terminal Server: inherited fds only 0–3 (+ fd 4 = AppImage keepalive), no crashpad env, no socket to crashpad', result: k2.ok ? 'PASS' : 'FAIL', evidence: k2.ev })

      // quit, keep the Terminal Server (same answer as t0806 F6)
      await inspectorEval(url, `(() => { const { app, dialog } = ${ELECTRON}; dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false }); setTimeout(() => app.quit(), 200); return true })()`)
      const exitedAt = await until('main process exit', () => (isAlive(main) && cmdline(main).length > 0 ? null : Date.now()), 60_000)
      const k1: string[] = []
      const k3: string[] = []
      await new Promise(r => setTimeout(r, 2_000))
      const left = stdoutTarget ? holders(stdoutTarget, [bashPid]) : []
      k1.push(`main stdout/stderr ${stdoutTarget || '?'}; 2 s after the main process exited, holders other than the reading bash: ${JSON.stringify(left)}; crashpad handlers alive: ${JSON.stringify(crashpadPids())}`)
      const done = await until('SUBST_DONE', () => /SUBST_DONE (\d+) (\d+)/.exec(stdout), 30_000).catch(() => null)
      const waited = done ? Number(done[1]) - exitedAt : null
      k1.push(`out=$(…) returned ${waited === null ? 'not within 32 s' : `${waited} ms after the main process exited`} (captured ${done ? done[2] : '?'} chars); Terminal Server ${server} alive ${isAlive(server)}, shell ${shell} alive ${isAlive(shell)}`)
      add({ id: 'K1', title: `quit keeping the server: out=$(…) returns ≤ ${K1_LIMIT_MS / 1000} s, nobody else holds the main process's stdout`, result: stdoutTarget && left.length === 0 && waited !== null && waited <= K1_LIMIT_MS && isAlive(server) ? 'PASS' : 'FAIL', evidence: k1 })

      if (appImage) {
        const exe = exeOf(server)
        const mount = path.dirname(exe)
        const mounted = fs.readFileSync('/proc/mounts', 'utf8').split('\n').some(l => l.split(' ')[1] === mount)
        let read = 'not tried'
        try {
          const fd = fs.openSync(`/proc/${server}/exe`, 'r')
          try {
            const size = fs.fstatSync(fd).size
            const buf = Buffer.alloc(64 * 1024)
            const n = fs.readSync(fd, buf, 0, buf.length, Math.max(0, size - buf.length))
            read = `read ${n} bytes at offset ${Math.max(0, size - buf.length)} of ${size}`
          } finally { fs.closeSync(fd) }
        } catch (err) { read = `error ${(err as NodeJS.ErrnoException).code ?? (err as Error).message}` }
        k3.push(`server exe ${exe.replace(/^\/tmp\/\.mount_[^/]+/, '/tmp/.mount_*')}; mount ${mounted ? 'present' : 'GONE'} in /proc/mounts; tail of /proc/${server}/exe: ${read}`)
        add({ id: 'K3', title: 'normal start, main process gone: the mount stays and the server binary reads back (BUG-209)', result: mounted && read.startsWith('read ') ? 'PASS' : 'FAIL', evidence: k3 })
      } else {
        add({ id: 'K3', title: 'normal start, main process gone: the mount stays (BUG-209)', result: 'PASS', evidence: ['not an AppImage: no mount (n/a)'] })
      }
      keptServer = server
      plain = null
    }

    // ── launch 3 (Playwright, same runtime): Recovery prompt keep (K4), renderer crash dump (K5) ──
    {
      app = await launch()
      await openWindow()
      const ev: string[] = []
      const prompt = win.locator('.recovery-prompt-dialog')
      await expect(prompt).toBeVisible({ timeout: 60_000 })
      await prompt.locator('.recovery-prompt-actions .btn-primary').click()
      await expect.poll(() => debugLog(userData), { timeout: 30_000 }).toContain(`pty:create SKIP (idempotent) id=${TERM_A}`)
      const shell = shellOf(TERM_A, keptServer)
      await win.evaluate(([i, t]) => (window as AnyApi).electronAPI.pty.write(i, t), [TERM_A, `echo t0816-$((6*7)) > '${folder}/k4.txt'\r`])
      const answered = await until('shell A answered', () => { try { return fs.readFileSync(path.join(folder, 'k4.txt'), 'utf8').trim() === 't0816-42' } catch { return false } }, 20_000).then(() => true, () => false)
      ev.push(`Recovery "keep": server ${readPid(userData)} (kept ${keptServer}), shell A ${shell}; the shell ran a command: ${answered}`)
      add({ id: 'K4', title: 'relaunch: Recovery prompt, "keep": the kept server and shell answer', result: answered && readPid(userData) === keptServer && shell !== null ? 'PASS' : 'FAIL', evidence: ev })

      const ev5: string[] = []
      const crashes = await app.evaluate(({ app: a }) => a.getPath('crashDumps'))
      const pending = path.join(crashes, 'pending')
      const dumps = () => { try { return fs.readdirSync(pending).filter(f => f.endsWith('.dmp')) } catch { return [] } }
      const before = dumps()
      const cdp = await app.context().newCDPSession(win)
      await cdp.send('Page.crash').catch(() => { /* the target dies */ })
      const after = await until('renderer dump', () => { const d = dumps().filter(f => !before.includes(f)); return d.length > 0 ? d : null }, 30_000).catch(() => [] as string[])
      ev5.push(`Crashes/pending before ${before.length}, new after Page.crash: ${after.length}`)
      add({ id: 'K5', title: 'renderer Page.crash still writes Crashes/pending/*.dmp', result: after.length > 0 ? 'PASS' : 'FAIL', evidence: ev5 })
    }
  } finally {
    if (plain?.pid) {
      try { process.kill(-plain.pid, 'SIGKILL') } catch { /* gone */ }
    }
    if (app) await closeIsolated({ app, runtimeId, userData }, log, { keepUserData: true })
    const sp = userData ? readPid(userData) : null
    if (sp && isAlive(sp) && cmdline(sp).join(' ').includes('terminal-server.js')) try { process.kill(sp, 'SIGKILL') } catch { /* gone */ }
    if (userData && path.basename(userData).includes(`-runtime-${runtimeId}`)) {
      try { fs.copyFileSync(path.join(userData, 'Logs', fs.readdirSync(path.join(userData, 'Logs')).filter(f => f.startsWith('debug-')).sort().at(-1)!), path.join(reportDir, 't0816-debug.log')) } catch { /* no log */ }
      fs.rmSync(userData, { recursive: true, force: true })
    }
    fs.rmSync(folder, { recursive: true, force: true })
    meta.finishedAt = new Date().toISOString()
    flush()
  }
  expect(rows.map(r => `${r.id}=${r.result}`)).toEqual(['K2=PASS', 'K1=PASS', 'K3=PASS', 'K4=PASS', 'K5=PASS'])
})
