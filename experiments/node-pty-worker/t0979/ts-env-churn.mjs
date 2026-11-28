// T0979 ① (`pty:create` only sends the env difference): T0888 C2 ① against the built Terminal Server alone
// (dist-electron/terminal-server.js, driven over the fork IPC like the app's main process), comparing what each
// `pty:create` carries. 10 pwsh PTYs stay, one more opens and closes CYCLES times; Private Bytes of the server.
//
//   node experiments/node-pty-worker/t0979/ts-env-churn.mjs --mode none|full|diff|ignored [--cycles 300]
//        [--flags "--max-semi-space-size=1"] [--node <node.exe>] [--label X] [--out <csv>]
//
// --mode none    : no `env` (the server spawns with its own env)
// --mode full    : as the app does today — the whole host env plus the per-PTY keys (PtyManager.buildPtyEnv shape)
// --mode diff    : the candidate fix — only the keys whose value differs from the server's env (the per-PTY keys)
// --mode ignored : the whole env, but in a field the server does not read (`envIgnored`): transport + JSON parse only
// --node <exe>   : run the server with this node.exe instead of Electron-as-node (the PTY holder runs official Node)
//
// The per-PTY values are fake (no real token). BAT_* / CT_* of the driver's own shell are removed from everything.
// No BAT_USER_DATA: the server writes no pid / port / token / registry file. Ends with `server:shutdown` (the server
// ends its own PTYs, T0540). Output: numbers only (no env content).
import { execFile, fork } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const args = process.argv.slice(2)
const arg = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def }
const MODE = arg('mode', 'full')
if (!['none', 'full', 'diff', 'ignored'].includes(MODE)) throw new Error(`bad --mode ${MODE}`)
const CYCLES = Number(arg('cycles', '300'))
const FLAGS = arg('flags', '').split(' ').filter(Boolean)
const NODE = arg('node', '')
const LABEL = arg('label', `${NODE ? 'node' : 'electron'} ${MODE} ${FLAGS.join(' ') || 'default'}`)
const OUT = arg('out', '')
const SETTLE_MS = 10_000

const clean = { ...process.env }
for (const k of Object.keys(clean)) if (k.startsWith('BAT_') || k.startsWith('CT_')) delete clean[k]
const serverEnv = { ...clean, ...(NODE ? {} : { ELECTRON_RUN_AS_NODE: '1' }) }
// what PtyManager.buildPtyEnv adds on top of the inherited env (fake values, same lengths as real ones)
const workspaceId = crypto.randomUUID()
function perPtyKeys(id) {
  return {
    PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1',
    TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'better-agent-terminal', TERM_PROGRAM_VERSION: '1.0',
    BAT_SESSION: '1', DISABLE_AUTOUPDATER: '1', BAT_TERMINAL_ID: id, BAT_WORKSPACE_ID: workspaceId,
    BAT_HELPER_DIR: path.join(ROOT, 'scripts'), BAT_USER_DATA: path.join(os.tmpdir(), 't0979-fake-userdata'),
    FORCE_COLOR: '3', CLAUDE_CODE_NO_FLICKER: '1', CI: '',
    BAT_REMOTE_PORT: '9876', BAT_REMOTE_TOKEN: `batcap.${crypto.randomBytes(48).toString('base64url')}`,
  }
}
const fullEnv = (id) => ({ ...clean, ...perPtyKeys(id) })
function diffEnv(id) {
  const full = fullEnv(id)
  const d = {}
  for (const [k, v] of Object.entries(full)) if (serverEnv[k] !== v) d[k] = v
  return d
}
function payload(id) {
  if (MODE === 'full') return { env: fullEnv(id) }
  if (MODE === 'diff') return { env: diffEnv(id) }
  if (MODE === 'ignored') return { envIgnored: fullEnv(id) }
  return {}
}
const sizes = { full: JSON.stringify(fullEnv('churn-1')).length, diff: JSON.stringify(diffEnv('churn-1')).length, keysFull: Object.keys(fullEnv('x')).length, keysDiff: Object.keys(diffEnv('x')).length }

const ts = fork(path.join(ROOT, 'dist-electron', 'terminal-server.js'), [], {
  execPath: NODE || path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'),
  execArgv: FLAGS,
  env: serverEnv,
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
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 't0979-ts-env-'))
async function openTab(id) {
  ts.send({ type: 'pty:create', id, shell: 'pwsh.exe', args: ['-NoLogo', '-NoProfile'], cwd, cols: 120, rows: 30, ...payload(id) })
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
const row = (step, cycle, mb) => { const r = { Label: LABEL, Mode: MODE, Step: step, Cycle: cycle, TsPrivMB: mb, EnvBytes: MODE === 'diff' ? sizes.diff : MODE === 'none' ? 0 : sizes.full, At: new Date().toISOString() }; rows.push(r); console.log(JSON.stringify(r)) }

console.log(JSON.stringify({ label: LABEL, serverPid: ts.pid, ...sizes }))
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
  if (OUT) {
    const header = !fs.existsSync(OUT)
    fs.appendFileSync(OUT, (header ? '"Label","Mode","Step","Cycle","TsPrivMB","EnvBytes","At"\n' : '') + rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n') + '\n')
  }
}
