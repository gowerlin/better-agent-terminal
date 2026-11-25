// T0889 (BUG-215): where does the time go when 10 PTYs print 20,000 lines at once (T0888 C4) — without Electron.
// Spawns TABS pwsh PTYs, starts the same flood command in every one at once, and measures the time until every tab
// printed its done marker, plus the event-loop utilisation (ELU) of the main thread and of the shared conout Worker
// during the flood (ELU ≈ 1 → that thread is the bottleneck).
//
//   npx tsx experiments/node-pty-worker/churn-repro/throughput.ts [--mode shared|original] [--worker <script>]
//        [--tabs 10] [--lines 20000] [--runs 3] [--label X] [--out <csv>]
//
// `--worker` swaps the Worker script (a candidate relay) while keeping installSharedConout. Output: numbers only.
// Processes: the shells this script spawned are ended with `taskkill /F /PID <shell>` (no /T), as in churn.ts.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { performance, type EventLoopUtilization } from 'node:perf_hooks'
import { Worker } from 'node:worker_threads'
import { installSharedConout, type SharedConoutWorker } from '../../../electron/terminal-server/shared-conout'

const args = process.argv.slice(2)
const arg = (name: string, def: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def }
const MODE = arg('mode', 'shared')
const TABS = Number(arg('tabs', '10'))
const LINES = Number(arg('lines', '20000'))
const RUNS = Number(arg('runs', '3'))
const LABEL = arg('label', MODE)
const OUT = arg('out', '')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const WORKER = path.resolve(arg('worker', path.join(ROOT, 'electron', 'terminal-server', 'shared-conout-worker.cjs')))
const NODE_PTY_DIR = path.dirname(require.resolve('@lydell/node-pty/package.json', { paths: [ROOT] }))

const workers = new Set<Worker>()
if (MODE === 'shared') {
  const result = installSharedConout(NODE_PTY_DIR, {
    workerScript: WORKER,
    log: (line) => console.error(line),
    createWorker: (script): SharedConoutWorker => {
      const w = new Worker(script)
      workers.add(w)
      w.on('exit', () => workers.delete(w))
      return w as unknown as SharedConoutWorker
    },
  })
  if (result !== 'installed') { console.error(`installSharedConout: ${result}`); process.exit(1) }
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pty = require(NODE_PTY_DIR)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
// eslint-disable-next-line no-control-regex
const strip = (t: string) => t.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\x1b[@-Z\\-_]/g, '')

interface Tab { p: any; pid: number; tail: string; bytes: number; chunks: number; doneAt: number }

function openTab(): Promise<Tab> {
  return new Promise((resolve, reject) => {
    const p = pty.spawn('pwsh.exe', ['-NoLogo', '-NoProfile'], { name: 'xterm-256color', cols: 120, rows: 30, cwd: process.cwd(), env: process.env })
    const tab: Tab = { p, pid: p.pid, tail: '', bytes: 0, chunks: 0, doneAt: 0 }
    let ready = false
    const t = setTimeout(() => reject(new Error(`no prompt from pid ${p.pid}`)), 60_000)
    p.onData((d: string) => {
      tab.bytes += d.length
      tab.chunks++
      tab.tail = (tab.tail + d).slice(-8192)
      if (!ready && /PS [^\r\n]*>/.test(strip(tab.tail))) { ready = true; clearTimeout(t); resolve(tab) }
    })
  })
}

function endTab(tab: Tab): Promise<void> {
  return new Promise((resolve) => execFile('taskkill', ['/F', '/PID', String(tab.pid)], { timeout: 10_000, windowsHide: true }, () => {
    try { tab.p.kill() } catch { /* gone */ }
    resolve()
  }))
}

const rows: string[] = []
async function oneRun(run: number): Promise<void> {
  const tabs: Tab[] = []
  for (let i = 0; i < TABS; i++) tabs.push(await openTab())
  await sleep(2000)
  const tag = Math.random().toString(16).slice(2, 10)
  const cmd = `1..${LINES} | ForEach-Object { "SEQ$_" }; "DONE_${tag}_" + (1 + 1)\r`
  for (const t of tabs) { t.tail = ''; t.bytes = 0; t.chunks = 0 }
  const want = `DONE_${tag}_2`
  const mainElu0 = performance.eventLoopUtilization()
  const w = [...workers][0]
  const workerElu0: EventLoopUtilization | undefined = w?.performance.eventLoopUtilization()
  const t0 = performance.now()
  for (const t of tabs) t.p.write(cmd)
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('flood timeout')), 300_000)
    const check = setInterval(() => {
      for (const t of tabs) if (!t.doneAt && strip(t.tail).includes(want)) t.doneAt = performance.now()
      if (tabs.every(t => t.doneAt)) { clearInterval(check); clearTimeout(deadline); resolve() }
    }, 20)
  })
  const ms = Math.round(Math.max(...tabs.map(t => t.doneAt)) - t0)
  const mainElu = performance.eventLoopUtilization(mainElu0)
  const workerElu = w && workerElu0 ? w.performance.eventLoopUtilization(workerElu0) : undefined
  const bytes = tabs.reduce((a, t) => a + t.bytes, 0)
  const chunks = tabs.reduce((a, t) => a + t.chunks, 0)
  const row = { Label: LABEL, Mode: MODE, Run: run, Ms: ms, MainElu: mainElu.utilization.toFixed(3), WorkerElu: workerElu ? workerElu.utilization.toFixed(3) : '', Chars: bytes, Chunks: chunks, At: new Date().toISOString() }
  console.log(JSON.stringify(row))
  rows.push(Object.values(row).map(v => `"${v}"`).join(','))
  for (const t of tabs) await endTab(t)
  await sleep(2500)
}

async function main(): Promise<void> {
  for (let r = 1; r <= RUNS; r++) await oneRun(r)
  if (OUT) {
    const header = !fs.existsSync(OUT)
    fs.appendFileSync(OUT, (header ? '"Label","Mode","Run","Ms","MainElu","WorkerElu","Chars","Chunks","At"\n' : '') + rows.join('\n') + '\n')
  }
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
