// T0889 (BUG-214): T0888 C2 ① against the built Terminal Server alone (dist-electron/terminal-server.js forked by
// Electron as node, driven over the fork IPC like the app's main process does), so the Terminal Server's own start flags
// can be tried without changing the app: 10 pwsh PTYs stay, one more opens and closes CYCLES times.
//
//   node experiments/node-pty-worker/churn-repro/ts-churn.mjs [--cycles 300] [--flags "--max-semi-space-size=1"]
//        [--label X] [--out <csv>] [--app-like]
//
// --app-like: as the app does — BAT_USER_DATA set to a temp dir (pid / port / token / registry files, TCP listener) and
// every pty:create carries a full env (a copy of this process's env without BAT_*).
//
// Needs `npx vite build` and node_modules/electron/dist/electron.exe. BAT_USER_DATA is not set, so the server writes no
// pid / port / registry file. Ends with `server:shutdown` (the server ends its own PTYs, T0540). Output: numbers only.
import { execFile, fork } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const args = process.argv.slice(2)
const arg = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def }
const CYCLES = Number(arg('cycles', '300'))
const FLAGS = arg('flags', '').split(' ').filter(Boolean)
const LABEL = arg('label', FLAGS.join(' ') || 'default')
const OUT = arg('out', '')
const SETTLE_MS = 10_000
const APP_LIKE = args.includes('--app-like')
/** only one half of --app-like: --env-only (full env per create) / --userdata-only (BAT_USER_DATA) */
const SEND_ENV = APP_LIKE || args.includes('--env-only')
const USE_USERDATA = APP_LIKE || args.includes('--userdata-only')

const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
for (const k of Object.keys(env)) if (k.startsWith('BAT_')) delete env[k]
const ptyEnv = { ...env }
delete ptyEnv.ELECTRON_RUN_AS_NODE
const userData = USE_USERDATA ? fs.mkdtempSync(path.join(os.tmpdir(), 't0889-ts-userdata-')) : ''
if (userData) env.BAT_USER_DATA = userData
// --exe <BetterAgentTerminal.exe>: another build's Terminal Server (its resourcesapp.asardist-electron	erminal-server.js)
const EXE = arg('exe', '')
// --holder <pty-holder dir>: that holder's bat-pty-holder.exe (official Node) runs its terminal-server.js (as the app does)
const HOLDER = arg('holder', '')
const ts = fork(HOLDER ? path.join(HOLDER, 'terminal-server.js') : EXE ? path.join(path.dirname(EXE), 'resources', 'app.asar', 'dist-electron', 'terminal-server.js') : path.join(ROOT, 'dist-electron', 'terminal-server.js'), [], {
  execPath: HOLDER ? path.join(HOLDER, 'bat-pty-holder.exe') : EXE || path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'),
  cwd: HOLDER || undefined,
  execArgv: FLAGS,
  env,
  stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
})
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const tails = new Map()
const waiters = []
ts.on('message', (m) => {
  if (m?.type === 'pty:data') {
    tails.set(m.id, ((tails.get(m.id) ?? '') + m.data).slice(-4096))
    for (const w of [...waiters]) w()
  }
})
// eslint-disable-next-line no-control-regex
const strip = (t) => t.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
function prompt(id) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no prompt ${id}`)), 60_000)
    const check = () => { if (/PS [^\r\n]*>/.test(strip(tails.get(id) ?? ''))) { clearTimeout(t); waiters.splice(waiters.indexOf(check), 1); resolve() } }
    waiters.push(check)
    check()
  })
}
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 't0889-ts-churn-'))
async function openTab(id) {
  ts.send({ type: 'pty:create', id, shell: 'pwsh.exe', args: [], cwd, cols: 120, rows: 30, ...(SEND_ENV ? { env: ptyEnv } : {}) })
  await prompt(id)
}
function privMB() {
  return new Promise((resolve) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${ts.pid}).PrivateMemorySize64`],
    { timeout: 30_000, windowsHide: true }, (err, out) => resolve(err ? NaN : Math.round(Number(out.trim()) / 104857.6) / 10)))
}
async function settled() {
  await sleep(SETTLE_MS)
  const v = []
  for (let i = 0; i < 3; i++) { v.push(await privMB()); if (i < 2) await sleep(1000) }
  return v.sort((a, b) => a - b)[1]
}
const rows = []
const row = (step, cycle, mb) => { const r = { Label: LABEL, Step: step, Cycle: cycle, TsPrivMB: mb, At: new Date().toISOString() }; rows.push(r); console.log(JSON.stringify(r)) }

try {
  for (let i = 0; i < 10; i++) await openTab(`keep-${i}`)
  const start = await settled()
  row('start', 0, start)
  for (let i = 1; i <= CYCLES; i++) {
    const id = `churn-${i}`
    await openTab(id)
    ts.send({ type: 'pty:kill', id })
    tails.delete(id)
    if (i % 50 === 0 && i < CYCLES) row('churn', i, await privMB())
  }
  const end = await settled()
  row('end', CYCLES, end)
  row('delta', CYCLES, Math.round((end - start) * 10) / 10)
} finally {
  ts.send({ type: 'server:shutdown' })
  await new Promise((r) => { const t = setTimeout(r, 30_000); ts.once('exit', () => { clearTimeout(t); r() }) })
  console.log(JSON.stringify({ tsExited: ts.exitCode !== null || ts.signalCode !== null, pid: ts.pid }))
  fs.rmSync(cwd, { recursive: true, force: true })
  if (userData) fs.rmSync(userData, { recursive: true, force: true })
  if (OUT) {
    const header = !fs.existsSync(OUT)
    fs.appendFileSync(OUT, (header ? '"Label","Step","Cycle","TsPrivMB","At"\n' : '') + rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n') + '\n')
  }
}
