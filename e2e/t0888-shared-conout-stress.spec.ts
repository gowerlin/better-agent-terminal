// T0888 / PLAN-066: stress and memory scenarios C1–C7 for the Windows Terminal Server's shared node-pty conout Worker
// (electron/terminal-server/shared-conout.ts, T0887), run against a packaged build. Opt-in, Windows only:
//
//   $env:BAT_T0888_STRESS = '1'
//   $env:BAT_E2E_EXECUTABLE = '<extracted zip or release\win-unpacked>\BetterAgentTerminal.exe'
//   $env:BAT_T0888_LABEL = 'N'            # N / O / H … (CSV label only)
//   $env:BAT_T0888_HOLDER = '1'           # H only: Terminal Server from the PTY holder (as e2e/t0859-pty-holder.spec.ts)
//   $env:BAT_T0888_SCENARIOS = 'C1,C4'    # optional, default all
//   npx playwright test e2e/t0888-shared-conout-stress.spec.ts
//
// Skipped without BAT_T0888_STRESS=1, on anything but win32, and without BAT_E2E_EXECUTABLE.
//
// Isolation (e2e/fixtures/electron-isolation.ts): every launch has its own --runtime userData, Terminal Server and
// remote port; the installed BAT, its Terminal Server and the real %LOCALAPPDATA%\BAT-PtyHolder are never touched.
// H copies the build's resources\pty-holder to <temp>\Local\BAT-PtyHolder\<key> and starts the app with
// LOCALAPPDATA=<temp>\Local (the T0823 marker is created in the build under test when missing, removed afterwards).
//
// Tabs are PTYs created through the renderer's electronAPI.pty (the same IPC a tab uses; no xterm is mounted), with the
// default shell (pwsh on the test machine). Output is collected per tab in the renderer (tail only). Nothing is written
// to the results but numbers: no PTY content, no env, no token.
//
// Processes: the spec reads the process table with experiments/node-pty-worker/acceptance/proc-sample.ps1 (ct/T0886
// tree rule). The only process it ends itself is C7's Terminal Server (`taskkill /F /PID`, no /T), and only when its
// executable is the build under test or the holder copy under this test's temp directory; teardown does the same for
// a Terminal Server left alive after quit. Every such PID is logged (`ended pid …`).
//
// Results: experiments/node-pty-worker/results/t0888-<scenario>.csv (one row per sample; label = BAT_T0888_LABEL).
// Memory numbers are the Terminal Server's own Private Bytes (PrivateMemorySize64). Pass / fail thresholds are only
// logged (`verdict …`), not asserted: the old build is measured with the same spec. Functional checks (every tab
// answers a command, completion markers, the server survives) are asserted.

import { test, expect, type Page } from '@playwright/test'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  E2E_EXECUTABLE,
  REPO_ROOT,
  closeIsolated,
  launchIsolated,
  readPid,
  run,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0888')
const LABEL = process.env.BAT_T0888_LABEL || 'unlabelled'
const HOLDER = process.env.BAT_T0888_HOLDER === '1'
const SCENARIOS = new Set((process.env.BAT_T0888_SCENARIOS || 'C1,C2,C3,C4,C5,C6,C7').split(',').map(s => s.trim().toUpperCase()).filter(Boolean))
const C6_MINUTES = Number(process.env.BAT_T0888_C6_MINUTES || 30)
const RUNS = Number(process.env.BAT_T0888_RUNS || 3)
/** C2 ①: open / close cycles of the extra tab (work order: 100; more only to see whether the growth levels off) */
const C2_CHURN = Number(process.env.BAT_T0888_C2_CHURN || 100)
const SAMPLER = path.join(REPO_ROOT, 'experiments', 'node-pty-worker', 'acceptance', 'proc-sample.ps1')
const RESULTS = path.join(REPO_ROOT, 'experiments', 'node-pty-worker', 'results')
const PROMPT = /PS [^\r\n]*>/
const SETTLE_MS = 10_000
const TAIL = 256 * 1024
const MARKER = 'installer-quit-request.supported'

test.skip(process.env.BAT_T0888_STRESS !== '1', 'opt-in: set BAT_T0888_STRESS=1')
test.skip(process.platform !== 'win32', 'Windows only (the shared conout Worker is a Windows feature)')
test.skip(!E2E_EXECUTABLE, 'needs BAT_E2E_EXECUTABLE=<…\\BetterAgentTerminal.exe> (packaged build under test)')

// ───────────────────────── results ─────────────────────────

const COLS = ['Label', 'Scenario', 'Run', 'Step', 'Tabs', 'TsPid', 'TsPrivMB', 'TsWsMB', 'TsThreads', 'TsChildren', 'Value', 'Note', 'At']
type Row = Partial<Record<(typeof COLS)[number], string | number>>

function nowIso(): string {
  const d = new Date(); const off = -d.getTimezoneOffset(); const sign = off >= 0 ? '+' : '-'
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')
  const local = new Date(d.getTime() + off * 60_000).toISOString().slice(0, 19)
  return `${local}${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
}

function appendRow(scenario: string, row: Row): void {
  const file = path.join(RESULTS, `t0888-${scenario.toLowerCase()}.csv`)
  fs.mkdirSync(RESULTS, { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, COLS.map(c => `"${c}"`).join(',') + '\n')
  const full: Row = { Label: LABEL, Scenario: scenario, At: nowIso(), ...row }
  fs.appendFileSync(file, COLS.map(c => `"${String(full[c] ?? '').replace(/"/g, "'")}"`).join(',') + '\n')
  log(`${scenario} ${JSON.stringify(full)}`)
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ───────────────────────── processes ─────────────────────────

interface Sample { pid: number; alive: boolean; privMB: number; wsMB: number; threads: number; exe: string; children: { pid: number; name: string }[] }

function sampleProc(pid: number): Promise<Sample> {
  return new Promise((resolve, reject) => {
    execFile('pwsh', ['-NoProfile', '-NonInteractive', '-File', SAMPLER, '-RootPid', String(pid)], { timeout: 60_000, windowsHide: true }, (err, stdout) => {
      if (err) return reject(err)
      const s = JSON.parse(stdout.trim()) as Sample
      s.children = Array.isArray(s.children) ? s.children : (s.children ? [s.children] : [])
      resolve(s)
    })
  })
}

/** Three samples 1 s apart; memory / threads = median, children = last sample. */
async function sample3(pid: number): Promise<Sample> {
  const ss: Sample[] = []
  for (let i = 0; i < 3; i++) { ss.push(await sampleProc(pid)); if (i < 2) await sleep(1000) }
  const last = ss[ss.length - 1]
  return { ...last, privMB: median(ss.map(s => s.privMB)), wsMB: median(ss.map(s => s.wsMB)), threads: median(ss.map(s => s.threads)) }
}

const childSummary = (s: Sample) => {
  const by: Record<string, number> = {}
  for (const c of s.children) by[c.name] = (by[c.name] ?? 0) + 1
  return Object.entries(by).sort().map(([n, k]) => `${n}x${k}`).join(' ')
}

function rowOf(s: Sample, tabs: number): Row {
  return { Tabs: tabs, TsPid: s.pid, TsPrivMB: s.privMB, TsWsMB: s.wsMB, TsThreads: s.threads, TsChildren: `${s.children.length} (${childSummary(s)})` }
}

function isAlive(pid: number): boolean { try { process.kill(pid, 0); return true } catch { return false } }

/** Peak Private Bytes of `pid` while `fn` runs (a read-only pwsh watcher writes samples to a temp file). */
async function withPeak<T>(pid: number, fn: () => Promise<T>): Promise<{ result: T; peakMB: number; samples: number }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0888-peak-'))
  const out = path.join(dir, 'samples.csv')
  const stop = path.join(dir, 'stop')
  const watcher: ChildProcess = spawn('pwsh', ['-NoProfile', '-NonInteractive', '-File', SAMPLER, '-RootPid', String(pid), '-Watch', '-OutFile', out, '-StopFile', stop, '-IntervalMs', '250'], { windowsHide: true, stdio: 'ignore' })
  try {
    const result = await fn()
    return { result, ...readPeak(out) }
  } finally {
    fs.writeFileSync(stop, '')
    await new Promise<void>(resolve => { const t = setTimeout(resolve, 5000); watcher.once('exit', () => { clearTimeout(t); resolve() }) })
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function readPeak(file: string): { peakMB: number; samples: number } {
  if (!fs.existsSync(file)) return { peakMB: 0, samples: 0 }
  const vals = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(l => Number(l.split(',')[1])).filter(Number.isFinite)
  return { peakMB: vals.length ? Math.round(Math.max(...vals) / 1048576 * 10) / 10 : 0, samples: vals.length }
}

interface ProcInfo { ExecutablePath: string | null; CommandLine: string | null }
async function processInfo(pid: number): Promise<ProcInfo | null> {
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object ExecutablePath,CommandLine | ConvertTo-Json -Compress`], 30_000).catch(() => '')
  return out.trim() ? JSON.parse(out) as ProcInfo : null
}

/** Ends one Terminal Server (no /T) only when it is this test's: executable = the build under test or under `temp`. */
async function endOwnTerminalServer(pid: number, temp: string, why: string): Promise<boolean> {
  if (!isAlive(pid)) return false
  const info = await processInfo(pid)
  const exe = (info?.ExecutablePath ?? '').toLowerCase()
  const cmd = (info?.CommandLine ?? '').toLowerCase()
  const ours = (exe === E2E_EXECUTABLE.toLowerCase() || (temp && exe.startsWith(temp.toLowerCase()))) && cmd.includes('terminal-server.js')
  if (!ours) { log(`pid ${pid} not ended (${why}): not this test's Terminal Server (${path.basename(exe)})`); return false }
  await run('taskkill', ['/F', '/PID', String(pid)]).catch(() => '')
  log(`ended pid ${pid} ${path.basename(exe)} (${why})`)
  return true
}

// ───────────────────────── launch (N / O / H) ─────────────────────────

interface Target { temp: string; env: Record<string, string>; cleanup: () => void }

function prepareTarget(): Target {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0888-'))
  if (!HOLDER) return { temp, env: {}, cleanup: () => fs.rmSync(temp, { recursive: true, force: true }) }
  const resources = path.join(path.dirname(E2E_EXECUTABLE), 'resources')
  const manifest = JSON.parse(fs.readFileSync(path.join(resources, 'pty-holder', 'holder-manifest.json'), 'utf8')) as { key: string }
  const local = path.join(temp, 'Local')
  fs.cpSync(path.join(resources, 'pty-holder'), path.join(local, 'BAT-PtyHolder', manifest.key), { recursive: true })
  const markerPath = path.join(resources, MARKER)
  const createdMarker = !fs.existsSync(markerPath)
  if (createdMarker) fs.writeFileSync(markerPath, '')
  log(`holder ${manifest.key} copied under <temp>\\Local\\BAT-PtyHolder; marker ${createdMarker ? 'created' : 'already present'}`)
  return {
    temp,
    env: { LOCALAPPDATA: local },
    cleanup: () => {
      if (createdMarker) fs.rmSync(markerPath, { force: true })
      fs.rmSync(temp, { recursive: true, force: true })
    },
  }
}

interface Session { inst: IsolatedInstance; win: Page; folder: string; serverPids: Set<number> }

async function open(target: Target, name: string): Promise<Session> {
  const inst = await launchIsolated(name, log, { env: target.env })
  const folder = fs.mkdtempSync(path.join(target.temp, 'cwd-'))
  await inst.win.evaluate((tail) => {
    const w = window as AnyApi
    w.__t0888 = { out: {}, len: {}, exit: {} }
    w.electronAPI.pty.onOutput((id: string, data: string) => {
      const s = w.__t0888
      const cur = (s.out[id] ?? '') + data
      s.out[id] = cur.length > tail ? cur.slice(cur.length - tail) : cur
      s.len[id] = (s.len[id] ?? 0) + data.length
    })
    w.electronAPI.pty.onExit((id: string, code: number) => { w.__t0888.exit[id] = code })
  }, TAIL)
  return { inst, win: inst.win, folder, serverPids: new Set() }
}

async function close(target: Target, s: Session | undefined): Promise<void> {
  if (!s) return
  const pid = readPid(s.inst.userData)
  if (pid) s.serverPids.add(pid)
  await closeIsolated(s.inst, log)
  for (const p of s.serverPids) {
    for (let i = 0; i < 20 && isAlive(p); i++) await sleep(250)
    if (isAlive(p)) await endOwnTerminalServer(p, target.temp, 'alive after quit')
  }
}

async function serverPid(s: Session): Promise<number> {
  let pid: number | null = null
  await expect.poll(() => (pid = readPid(s.inst.userData)), { timeout: 30_000 }).not.toBeNull()
  s.serverPids.add(pid!)
  return pid!
}

/** Logs how the Terminal Server runs (holder or not) once per launch. */
async function describeServer(s: Session, pid: number): Promise<string> {
  const info = await processInfo(pid)
  const exe = info?.ExecutablePath ?? ''
  const kind = /bat-pty-holder\.exe$/i.test(exe) ? 'holder' : 'fork'
  log(`Terminal Server pid ${pid}: ${kind} (${path.basename(exe)})`)
  return kind
}

// ───────────────────────── tabs ─────────────────────────

async function createTab(s: Session, id: string): Promise<void> {
  const r = await s.win.evaluate(({ id, cwd }) => (window as AnyApi).electronAPI.pty.create({ id, cwd, type: 'terminal' }), { id, cwd: s.folder })
  expect(r, `pty.create ${id}`).toBeTruthy()
}

const tail = (s: Session, id: string) => s.win.evaluate((tid) => ((window as AnyApi).__t0888.out[tid] ?? '') as string, id)
const exitCode = (s: Session, id: string) => s.win.evaluate((tid) => (window as AnyApi).__t0888.exit[tid] as number | undefined, id)
const write = (s: Session, id: string, data: string) => s.win.evaluate(({ id, data }) => (window as AnyApi).electronAPI.pty.write(id, data), { id, data })
const kill = (s: Session, id: string) => s.win.evaluate((tid) => (window as AnyApi).electronAPI.pty.kill(tid), id)
const resetOut = (s: Session, id: string) => s.win.evaluate((tid) => { (window as AnyApi).__t0888.out[tid] = '' }, id)

function stripAnsi(t: string): string {
  // eslint-disable-next-line no-control-regex
  return t.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\x1b[@-Z\\-_]/g, '')
}

async function waitPrompts(s: Session, ids: string[], timeout = 120_000): Promise<void> {
  const pending = new Set(ids)
  const deadline = Date.now() + timeout
  while (pending.size && Date.now() < deadline) {
    for (const id of [...pending]) if (PROMPT.test(stripAnsi(await tail(s, id)))) pending.delete(id)
    if (pending.size) await sleep(100)
  }
  expect([...pending], 'tabs that never showed the pwsh prompt').toEqual([])
}

async function openTabs(s: Session, ids: string[]): Promise<void> {
  for (const id of ids) await createTab(s, id)
  await waitPrompts(s, ids)
}

/** Every tab runs a command whose result (not its echo) has to come back: MARK_<rand>_<n+1>. */
async function checkUsable(s: Session, ids: string[], timeout = 60_000): Promise<void> {
  const tag = crypto.randomBytes(4).toString('hex')
  for (const [i, id] of ids.entries()) await write(s, id, `"MARK_${tag}_" + (${i} + 1)\r`)
  const pending = new Map(ids.map((id, i) => [id, `MARK_${tag}_${i + 1}`]))
  const deadline = Date.now() + timeout
  while (pending.size && Date.now() < deadline) {
    for (const [id, want] of [...pending]) if (stripAnsi(await tail(s, id)).includes(want)) pending.delete(id)
    if (pending.size) await sleep(100)
  }
  expect([...pending.keys()], 'tabs that did not answer the usability command').toEqual([])
  log(`usable: ${ids.length} tab(s) answered MARK_${tag}_n`)
}

/** Waits until the Terminal Server has exactly `want` descendants (2 per live pwsh tab: shell + console host). */
async function waitChildren(pid: number, want: number, timeout = 20_000): Promise<Sample> {
  let s = await sampleProc(pid)
  const deadline = Date.now() + timeout
  while (s.children.length !== want && Date.now() < deadline) { await sleep(500); s = await sampleProc(pid) }
  return s
}

const ids = (prefix: string, n: number, from = 0) => Array.from({ length: n }, (_, i) => `t0888-${prefix}-${from + i}`)

// ───────────────────────── scenarios ─────────────────────────

let target: Target
test.describe.configure({ mode: 'serial' })
test.beforeAll(() => { target = prepareTarget() })
test.afterAll(() => {
  for (let i = 0; i < 10; i++) { try { target?.cleanup(); break } catch { /* busy, retry */ } }
})

test('C1: idle tabs 1 / 5 / 10 / 20 / 30', async () => {
  test.skip(!SCENARIOS.has('C1'))
  test.setTimeout(RUNS * 600_000)
  const steps = [1, 5, 10, 20, 30]
  for (let run = 1; run <= RUNS; run++) {
    let s: Session | undefined
    try {
      s = await open(target, `t0888-c1-r${run}`)
      const pid = await serverPid(s)
      await describeServer(s, pid)
      let have = 0
      for (const n of steps) {
        await openTabs(s, ids('c1', n - have, have))
        have = n
        await s.win.waitForTimeout(SETTLE_MS)
        appendRow('C1', { Run: run, Step: `idle-${n}`, ...rowOf(await sample3(pid), n) })
      }
      await checkUsable(s, ids('c1', 30))
    } finally {
      await close(target, s)
    }
  }
})

test('C2: open / close churn', async () => {
  test.skip(!SCENARIOS.has('C2'))
  test.setTimeout(1_800_000)
  let s: Session | undefined
  try {
    s = await open(target, 't0888-c2')
    const pid = await serverPid(s)
    await describeServer(s, pid)
    // ① 10 tabs stay, one more tab opens and closes 100 times
    const keep = ids('c2keep', 10)
    await openTabs(s, keep)
    await s.win.waitForTimeout(SETTLE_MS)
    const start1 = await sample3(pid)
    appendRow('C2', { Run: 1, Step: 'part1-start', ...rowOf(start1, 10) })
    const closeMs: number[] = []
    for (let i = 0; i < C2_CHURN; i++) {
      const id = `t0888-c2churn-${i}`
      await createTab(s, id)
      await waitPrompts(s, [id], 60_000)
      const t0 = Date.now()
      await kill(s, id)
      closeMs.push(Date.now() - t0)
      // growth curve: one sample every 25 cycles (single sample, no settle; the end row below is the settled one)
      if ((i + 1) % 25 === 0 && i + 1 < C2_CHURN) appendRow('C2', { Run: 1, Step: `part1-churn-${i + 1}`, ...rowOf(await sampleProc(pid), 10) })
    }
    const after1 = await waitChildren(pid, 20)
    await s.win.waitForTimeout(SETTLE_MS)
    const end1 = await sample3(pid)
    appendRow('C2', { Run: 1, Step: 'part1-end', ...rowOf(end1, 10), Value: Math.round((end1.privMB - start1.privMB) * 10) / 10, Note: `delta MB; children after churn ${after1.children.length}; kill ipc median ${median(closeMs)} ms max ${Math.max(...closeMs)} ms` })
    log(`verdict C2① ${LABEL}: +${(end1.privMB - start1.privMB).toFixed(1)} MB (≤ 5) children ${after1.children.length} (want 20)`)
    await checkUsable(s, keep)

    // ② close everything (the shared Worker ends), open 10 again; 20 times
    for (const id of keep) await kill(s, id)
    const empty = await waitChildren(pid, 0)
    await s.win.waitForTimeout(SETTLE_MS)
    const start2 = await sample3(pid)
    appendRow('C2', { Run: 2, Step: 'part2-start-empty', ...rowOf(start2, 0), Note: `children ${empty.children.length}` })
    let round: string[] = []
    let firstFull: Sample | undefined
    const leftovers: number[] = []
    for (let r = 0; r < 20; r++) {
      round = ids(`c2r${r}`, 10)
      await openTabs(s, round)
      if (r === 0) { await s.win.waitForTimeout(SETTLE_MS); firstFull = await sample3(pid); appendRow('C2', { Run: 2, Step: 'part2-round0-10tabs', ...rowOf(firstFull, 10) }) }
      if (r === 19) break
      for (const id of round) await kill(s, id)
      const left = await waitChildren(pid, 0)
      leftovers.push(left.children.length)
    }
    await s.win.waitForTimeout(SETTLE_MS)
    const end2 = await sample3(pid)
    const base2 = firstFull ?? start2
    appendRow('C2', { Run: 2, Step: 'part2-round19-10tabs', ...rowOf(end2, 10), Value: Math.round((end2.privMB - base2.privMB) * 10) / 10, Note: `delta MB vs round 0; leftover children after each close-all: max ${Math.max(...leftovers)}` })
    log(`verdict C2② ${LABEL}: +${(end2.privMB - base2.privMB).toFixed(1)} MB vs round 0 (≤ 5); leftover children after close-all max ${Math.max(...leftovers)} (want 0); children now ${end2.children.length} (want 20)`)
    await checkUsable(s, round)
  } finally {
    await close(target, s)
  }
})

test('C3: tabs exit by themselves', async () => {
  test.skip(!SCENARIOS.has('C3'))
  test.setTimeout(900_000)
  let s: Session | undefined
  try {
    s = await open(target, 't0888-c3')
    const pid = await serverPid(s)
    await describeServer(s, pid)
    const twenty = ids('c3', 20)
    await openTabs(s, twenty)
    await s.win.waitForTimeout(SETTLE_MS)
    const before = await sample3(pid)
    appendRow('C3', { Step: 'before-exit-20tabs', ...rowOf(before, 20) })
    for (const id of twenty) await write(s, id, 'exit\r')
    await expect.poll(async () => { let n = 0; for (const id of twenty) if ((await exitCode(s!, id)) !== undefined) n++; return n }, { timeout: 60_000 }).toBe(20)
    const gone = await waitChildren(pid, 0)
    await s.win.waitForTimeout(SETTLE_MS)
    const after = await sample3(pid)
    appendRow('C3', { Step: 'after-exit-0tabs', ...rowOf(after, 0), Value: Math.round((after.privMB - before.privMB) * 10) / 10, Note: `delta MB vs 20 tabs; children ${gone.children.length}` })
    const ten = ids('c3new', 10)
    await openTabs(s, ten)
    await s.win.waitForTimeout(SETTLE_MS)
    const again = await sample3(pid)
    appendRow('C3', { Step: 'reopen-10tabs', ...rowOf(again, 10) })
    log(`verdict C3 ${LABEL}: 20 tabs ${before.privMB} MB → all exited ${after.privMB} MB → 10 new ${again.privMB} MB; children after exits ${gone.children.length}`)
    await checkUsable(s, ten)
  } finally {
    await close(target, s)
  }
})

/** pwsh: N numbered lines, then the done marker (computed, so the typed command never matches it). */
const floodCmd = (lines: number, tag: string) => `1..${lines} | ForEach-Object { "SEQ$_" }; "DONE_${tag}_" + (1 + 1)\r`

function seqCheck(text: string, last: number, count: number): { ok: boolean; got: number[] } {
  const nums = [...stripAnsi(text).matchAll(/SEQ(\d+)/g)].map(m => Number(m[1]))
  const got = nums.slice(-count)
  const ok = got.length === count && got.every((n, i) => n === last - count + 1 + i)
  return { ok, got }
}

test('C4: 10 tabs print 20,000 lines each at once', async () => {
  test.skip(!SCENARIOS.has('C4'))
  test.setTimeout(RUNS * 600_000)
  const LINES = 20_000
  for (let run = 1; run <= RUNS; run++) {
    let s: Session | undefined
    try {
      s = await open(target, `t0888-c4-r${run}`)
      const pid = await serverPid(s)
      await describeServer(s, pid)
      const ten = ids('c4', 10)
      await openTabs(s, ten)
      await s.win.waitForTimeout(SETTLE_MS)
      const idle = await sample3(pid)
      const tag = crypto.randomBytes(4).toString('hex')
      for (const id of ten) await resetOut(s, id)
      const { result: ms, peakMB, samples } = await withPeak(pid, async () => {
        const t0 = Date.now()
        await Promise.all(ten.map(id => write(s!, id, floodCmd(LINES, tag))))
        const pending = new Set(ten)
        const deadline = Date.now() + 300_000
        while (pending.size && Date.now() < deadline) {
          for (const id of [...pending]) if (stripAnsi(await tail(s!, id)).includes(`DONE_${tag}_2`)) pending.delete(id)
          if (pending.size) await sleep(100)
        }
        expect([...pending], 'tabs without the completion marker').toEqual([])
        return Date.now() - t0
      })
      const gaps: string[] = []
      for (const id of ten) { const c = seqCheck(await tail(s, id), LINES, 200); if (!c.ok) gaps.push(`${id}: last ${c.got.length} = ${c.got.slice(0, 3).join(',')}…${c.got.slice(-3).join(',')}`) }
      appendRow('C4', { Run: run, Step: 'flood-done', ...rowOf(await sample3(pid), 10), Value: ms, Note: `ms to all DONE; idle ${idle.privMB} MB; peak ${peakMB} MB (${samples} samples); last-200 gaps ${gaps.length}` })
      log(`verdict C4 ${LABEL} run ${run}: ${ms} ms, peak ${peakMB} MB, last-200 sequence gaps in ${gaps.length} tab(s) ${gaps.join(' | ')}`)
      expect(gaps, 'last 200 SEQ numbers continuous in every tab').toEqual([])
      await checkUsable(s, ten)
    } finally {
      await close(target, s)
    }
  }
})

function registryPids(userData: string): Map<string, number> {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(userData, 'bat-pty-registry.json'), 'utf8')) as { ptys: { id: string; pid: number }[] }
    return new Map(reg.ptys.map(p => [p.id, p.pid]))
  } catch { return new Map() }
}

test('C5: close 5 of 10 tabs while they flood', async () => {
  test.skip(!SCENARIOS.has('C5'))
  test.setTimeout(900_000)
  let s: Session | undefined
  try {
    s = await open(target, 't0888-c5')
    const pid = await serverPid(s)
    await describeServer(s, pid)
    const ten = ids('c5', 10)
    await openTabs(s, ten)
    await s.win.waitForTimeout(SETTLE_MS)
    const before = await sample3(pid)
    const shells = registryPids(s.inst.userData)
    const tag = crypto.randomBytes(4).toString('hex')
    const LINES = 200_000
    for (const id of ten) await resetOut(s, id)
    await Promise.all(ten.map(id => write(s!, id, floodCmd(LINES, tag))))
    // every tab is flooding before the closes start
    await expect.poll(async () => { let n = 0; for (const id of ten) if (/SEQ\d+/.test(await tail(s!, id))) n++; return n }, { timeout: 30_000 }).toBe(10)
    await s.win.waitForTimeout(1000)
    const closing = ten.slice(0, 5)
    const keep = ten.slice(5)
    const closeMs: Record<string, number> = {}
    await Promise.all(closing.map(async (id) => {
      const shell = shells.get(id)
      const t0 = Date.now()
      await kill(s!, id)
      while (shell && isAlive(shell) && Date.now() - t0 < 30_000) await sleep(50)
      closeMs[id] = Date.now() - t0
    }))
    const tsAlive = isAlive(pid)
    expect(tsAlive, 'Terminal Server alive after closing flooding tabs').toBe(true)
    const pending = new Set(keep)
    const deadline = Date.now() + 600_000
    while (pending.size && Date.now() < deadline) {
      for (const id of [...pending]) if (stripAnsi(await tail(s, id)).includes(`DONE_${tag}_2`)) pending.delete(id)
      if (pending.size) await sleep(250)
    }
    expect([...pending], 'remaining tabs without the completion marker').toEqual([])
    const kids = await waitChildren(pid, 10)
    await s.win.waitForTimeout(SETTLE_MS)
    const after = await sample3(pid)
    const slow = Object.entries(closeMs).filter(([, ms]) => ms >= 5000)
    appendRow('C5', { Step: 'after', ...rowOf(after, 5), Value: Math.max(...Object.values(closeMs)), Note: `max close ms (shell gone); per tab ${Object.values(closeMs).join('/')}; before ${before.privMB} MB; children ${kids.children.length} (want 10); same server pid ${readPid(s.inst.userData) === pid}` })
    log(`verdict C5 ${LABEL}: closes ${Object.values(closeMs).join('/')} ms (each < 5000: ${slow.length === 0}), server alive ${tsAlive}, children ${kids.children.length} (want 10)`)
    await checkUsable(s, keep)
    for (const id of keep) await kill(s, id)
    const none = await waitChildren(pid, 0)
    appendRow('C5', { Step: 'all-closed', ...rowOf(none, 0), Note: `children ${none.children.length} (want 0)` })
  } finally {
    await close(target, s)
  }
})

test('C6: 10 tabs print a line every 5 s for 30 minutes', async () => {
  test.skip(!SCENARIOS.has('C6'))
  test.setTimeout((C6_MINUTES + 15) * 60_000)
  let s: Session | undefined
  try {
    s = await open(target, 't0888-c6')
    const pid = await serverPid(s)
    await describeServer(s, pid)
    const ten = ids('c6', 10)
    await openTabs(s, ten)
    for (const id of ten) await write(s, id, 'while ($true) { "TICK " + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); Start-Sleep -Seconds 5 }\r')
    const t0 = Date.now()
    const samples: number[] = []
    for (let m = 1; m <= C6_MINUTES; m++) {
      const wait = t0 + m * 60_000 - Date.now()
      if (wait > 0) await sleep(wait)
      const x = await sample3(pid)
      samples.push(x.privMB)
      // every tab still prints: its output length grew during the last minute
      const lens = await s.win.evaluate(() => ({ ...(window as AnyApi).__t0888.len }))
      appendRow('C6', { Step: `minute-${m}`, ...rowOf(x, 10), Value: Math.round((x.privMB - samples[0]) * 10) / 10, Note: `delta MB vs minute 1; output bytes ${ten.map(id => lens[id] ?? 0).join('/')}` })
    }
    // stop the loops (Ctrl+C), then every tab has to answer
    for (const id of ten) await write(s, id, '\x03')
    await waitPrompts(s, ten, 30_000)
    await checkUsable(s, ten)
    log(`verdict C6 ${LABEL}: minute 1 ${samples[0]} MB → minute ${C6_MINUTES} ${samples[samples.length - 1]} MB (+${(samples[samples.length - 1] - samples[0]).toFixed(1)}, ≤ 5)`)
  } finally {
    await close(target, s)
  }
})

test('C7: Terminal Server recovery with 10 tabs', async () => {
  test.skip(!SCENARIOS.has('C7'))
  test.setTimeout(900_000)
  let s: Session | undefined
  try {
    s = await open(target, 't0888-c7')
    const pid = await serverPid(s)
    const kind = await describeServer(s, pid)
    const ten = ids('c7', 10)
    await openTabs(s, ten)
    await s.win.waitForTimeout(SETTLE_MS)
    const before = await sample3(pid)
    appendRow('C7', { Step: 'before-kill', ...rowOf(before, 10), Note: kind })
    const oldShells = [...registryPids(s.inst.userData).values()]
    expect(await endOwnTerminalServer(pid, target.temp, 'C7 recovery'), 'C7 ends the isolated Terminal Server').toBe(true)
    const debugLog = () => {
      const dir = path.join(s!.inst.userData, 'Logs')
      return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') : ''
    }
    await expect.poll(debugLog, { timeout: 60_000 }).toContain('[PtyManager] Terminal Server recovery complete')
    let newPid = 0
    await expect.poll(() => { const p = readPid(s!.inst.userData); newPid = p ?? 0; return p !== null && p !== pid }, { timeout: 30_000 }).toBe(true)
    s.serverPids.add(newPid)
    const newKind = await describeServer(s, newPid)
    await waitPrompts(s, ten, 120_000)
    await s.win.waitForTimeout(SETTLE_MS)
    const after = await sample3(newPid)
    const oldAlive = oldShells.filter(isAlive)
    appendRow('C7', { Step: 'after-recovery', ...rowOf(after, 10), Note: `${newKind}; old shells alive ${oldAlive.length}/${oldShells.length}` })
    log(`verdict C7 ${LABEL}: server ${pid} (${kind}) → ${newPid} (${newKind}); 10 tabs ${before.privMB} → ${after.privMB} MB (< 45 = shared Worker), threads ${before.threads} → ${after.threads}; old shells alive ${oldAlive.length}`)
    await checkUsable(s, ten)
  } finally {
    await close(target, s)
  }
})
