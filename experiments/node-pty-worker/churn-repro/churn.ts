// T0889 (BUG-214): minimal reproduction of T0888 C2 ① without Electron — 10 PTYs stay open, one more opens and closes
// CYCLES times, the same way the Terminal Server ends a tab (T0540: the shell is ended first, then `pty.kill()`).
// The shared conout Worker is the real one (installSharedConout + shared-conout-worker.cjs) loaded through
// diag-worker.cjs, which also reports the Worker's heap and active handles and can force a GC there.
//
//   npx tsx experiments/node-pty-worker/churn-repro/churn.ts [--cycles 300] [--keep 10] [--shell cmd.exe|pwsh.exe]
//        [--gc-every 25] [--label X] [--mode shared|original] [--out <csv>]
//
// Output: one CSV row per sample (process Private Bytes via PowerShell, Worker heap, handles). No PTY content.
// Processes: only shells this script spawned are ended (`taskkill /F /PID <shell>`, no /T), each logged; the script's
// own conhosts end with their pseudo consoles. Windows only.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { installSharedConout, type SharedConoutWorker } from '../../../electron/terminal-server/shared-conout'

const args = process.argv.slice(2)
const arg = (name: string, def: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def }
const CYCLES = Number(arg('cycles', '300'))
const KEEP = Number(arg('keep', '10'))
const SHELL = arg('shell', 'cmd.exe')
const GC_EVERY = Number(arg('gc-every', '25'))
const LABEL = arg('label', 'repro')
const MODE = arg('mode', 'shared')
const OUT = arg('out', '')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const NODE_PTY_DIR = path.dirname(require.resolve('@lydell/node-pty/package.json', { paths: [ROOT] }))

let diagWorker: Worker | null = null
let diagSeq = 0
const diagWaiters = new Map<number, (m: unknown) => void>()

if (MODE === 'shared') {
  const result = installSharedConout(NODE_PTY_DIR, {
    workerScript: path.join(ROOT, 'electron', 'terminal-server', 'shared-conout-worker.cjs'),
    log: (line) => console.error(line),
    createWorker: (script): SharedConoutWorker => {
      const w = new Worker(path.join(__dirname, 'diag-worker.cjs'), { workerData: { realWorker: script } })
      diagWorker = w
      w.on('message', (m: { type?: string; seq?: number }) => {
        if (m?.type === 'diag' && typeof m.seq === 'number') { diagWaiters.get(m.seq)?.(m); diagWaiters.delete(m.seq) }
      })
      w.on('exit', () => { if (diagWorker === w) diagWorker = null })
      return w as unknown as SharedConoutWorker
    },
  })
  console.error(`installSharedConout: ${result}`)
  if (result !== 'installed') process.exit(1)
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pty = require(NODE_PTY_DIR)

function diag(op: 'stats' | 'gc'): Promise<Record<string, unknown> | null> {
  const w = diagWorker
  if (!w) return Promise.resolve(null)
  const seq = ++diagSeq
  return new Promise((resolve) => {
    const t = setTimeout(() => { diagWaiters.delete(seq); resolve(null) }, 5000)
    diagWaiters.set(seq, (m) => { clearTimeout(t); resolve(m as Record<string, unknown>) })
    w.postMessage({ type: 'diag', op, seq })
  })
}

function privateMB(): Promise<number> {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${process.pid}).PrivateMemorySize64`],
      { timeout: 30_000, windowsHide: true }, (err, stdout) => resolve(err ? NaN : Math.round(Number(stdout.trim()) / 104857.6) / 10))
  })
}

function childCount(): Promise<number> {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `@(Get-CimInstance Win32_Process -Filter "ParentProcessId=${process.pid}").Count`],
      { timeout: 30_000, windowsHide: true }, (err, stdout) => resolve(err ? NaN : Number(stdout.trim())))
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Tab { p: any; pid: number; got: number; exited: boolean }
function openTab(): Promise<Tab> {
  return new Promise((resolve, reject) => {
    const p = pty.spawn(SHELL, [], { name: 'xterm-256color', cols: 120, rows: 30, cwd: process.cwd(), env: process.env })
    const tab: Tab = { p, pid: p.pid, got: 0, exited: false }
    const t = setTimeout(() => reject(new Error(`no output from ${SHELL} pid ${p.pid}`)), 30_000)
    let text = ''
    let done = false
    p.onData((d: string) => {
      tab.got += d.length
      if (done) return
      // eslint-disable-next-line no-control-regex
      text = (text + d).slice(-4096).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
      if (/[A-Za-z]:\\[^\r\n]*>/.test(text)) { done = true; clearTimeout(t); resolve(tab) }
    })
    p.onExit(() => { tab.exited = true })
  })
}

/** Terminal Server endPty on Windows (T0540): end the shell (here without /T: it has no children), then pty.kill(). */
function closeTab(tab: Tab): Promise<void> {
  return new Promise((resolve) => {
    execFile('taskkill', ['/F', '/PID', String(tab.pid)], { timeout: 10_000, windowsHide: true }, () => {
      try { tab.p.kill() } catch { /* already gone */ }
      resolve()
    })
  })
}

const COLS = ['Label', 'Mode', 'Step', 'Cycle', 'PrivMB', 'WorkerUsedHeapMB', 'WorkerTotalHeapMB', 'ExternalMB', 'ArrayBuffersMB', 'WorkerHandles', 'MainHandles', 'MainSocketKinds', 'Children', 'At']

/** main-thread active handles by type, and what the main-thread sockets are (net pipe to <pipe>-worker vs fd socket) */
function mainHandles(): { all: string; sockets: string } {
  const by: Record<string, number> = {}
  const kinds: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const h of (process as any)._getActiveHandles()) {
    const n = h?.constructor?.name ?? typeof h
    by[n] = (by[n] ?? 0) + 1
    if (n === 'Socket') {
      const k = `${h.readable ? 'r' : '-'}${h.writable ? 'w' : '-'}${h.destroyed ? 'D' : ''}${h._handle?.constructor?.name ?? 'nohandle'}${h.connecting ? 'C' : ''}`
      kinds[k] = (kinds[k] ?? 0) + 1
    }
  }
  const fmt = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k}x${v}`).join(' ')
  return { all: fmt(by), sockets: fmt(kinds) }
}
const rows: string[] = []
async function sample(step: string, cycle: number, op: 'stats' | 'gc' = 'stats'): Promise<void> {
  await sleep(1500) // past the 1 s drain of the last close
  const d = await diag(op)
  const priv = await privateMB()
  const kids = await childCount()
  const h = d ? Object.entries(d.handles as Record<string, number>).map(([k, v]) => `${k}x${v}`).join(' ') : ''
  const mh = mainHandles()
  const row = [LABEL, MODE, step, cycle, priv, d?.usedHeapMB ?? '', d?.totalHeapMB ?? '', d?.externalMB ?? '', d?.arrayBuffersMB ?? '', h, mh.all, mh.sockets, kids, new Date().toISOString()]
  rows.push(row.map(v => `"${v}"`).join(','))
  console.log(COLS.map((c, i) => `${c}=${row[i]}`).join(' '))
}

async function main(): Promise<void> {
  const keep: Tab[] = []
  for (let i = 0; i < KEEP; i++) keep.push(await openTab())
  await sleep(3000)
  await sample('start', 0)
  await sample('start-gc', 0, 'gc')
  for (let i = 1; i <= CYCLES; i++) {
    const tab = await openTab()
    await closeTab(tab)
    if (i % GC_EVERY === 0) {
      await sample('churn', i)
      await sample('churn-gc', i, 'gc')
    }
  }
  await sleep(3000)
  await sample('end', CYCLES)
  await sample('end-gc', CYCLES, 'gc')
  for (const t of keep) await closeTab(t)
  await sleep(4000)
  await sample('all-closed', CYCLES)
  if (OUT) {
    const header = !fs.existsSync(OUT)
    fs.appendFileSync(OUT, (header ? COLS.map(c => `"${c}"`).join(',') + '\n' : '') + rows.join('\n') + '\n')
  }
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
