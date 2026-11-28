// T0979 ③ (F4) in Terminal Server mode: the built dist-electron/terminal-server.js (shared conout Worker), driven over
// the fork IPC. N pwsh PTYs; each shell runs `exit` by itself; then the server's Private Bytes / handle count and the
// conhost children it keeps. Then N more PTYs are opened and closed with pty:kill (BAT's own close) for comparison.
//
//   node experiments/node-pty-worker/t0979/ts-exit-residue.mjs [--count 20] [--flags "--max-semi-space-size=1"] [--out <jsonl>]
//
// No BAT_USER_DATA (no pid / port / token / registry file). BAT_* / CT_* removed from the server env. Ends with
// `server:shutdown`. Output: numbers and process names only.
import { execFileSync, fork } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const args = process.argv.slice(2)
const arg = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def }
const COUNT = Number(arg('count', '20'))
const FLAGS = arg('flags', '--max-semi-space-size=1').split(' ').filter(Boolean)
const OUT = arg('out', '')
const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
for (const k of Object.keys(env)) if (k.startsWith('BAT_') || k.startsWith('CT_')) delete env[k]
const ts = fork(path.join(ROOT, 'dist-electron', 'terminal-server.js'), [], {
  execPath: path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'), execArgv: FLAGS, env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
})
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const tails = new Map()
const exits = new Map()
const waiters = []
ts.on('message', (m) => {
  if (m?.type === 'pty:data') tails.set(m.id, ((tails.get(m.id) ?? '') + m.data).slice(-4096))
  if (m?.type === 'pty:exit') exits.set(m.id, m.exitCode)
  for (const w of [...waiters]) w()
})
// eslint-disable-next-line no-control-regex
const strip = (t) => t.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
const until = (cond, ms = 60_000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('timeout')), ms)
  const check = () => { if (cond()) { clearTimeout(t); waiters.splice(waiters.indexOf(check), 1); resolve() } }
  waiters.push(check); check()
})
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 't0979-ts-exit-'))
async function open(id) {
  ts.send({ type: 'pty:create', id, shell: 'pwsh.exe', args: ['-NoLogo', '-NoProfile'], cwd, cols: 120, rows: 30 })
  await until(() => /PS [^\r\n]*>/.test(strip(tails.get(id) ?? '')))
}
function sample() {
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$p = Get-Process -Id ${ts.pid}; $c = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=${ts.pid}"); ` +
    `$h = @($c | Where-Object Name -eq 'conhost.exe'); $ws = 0; foreach ($x in $h) { $ws += $x.WorkingSetSize }; ` +
    `'{0}|{1}|{2}|{3}|{4}|{5}' -f [math]::Round($p.PrivateMemorySize64/1MB,1), $p.HandleCount, $p.Threads.Count, $h.Count, [math]::Round((($h | Measure-Object PrivatePageCount -Sum).Sum)/1MB,1), [math]::Round($ws/1MB,1)`],
  { encoding: 'utf8', timeout: 60_000, windowsHide: true }).trim().split('|').map(Number)
  const [privMB, handles, threads, conhosts, conhostPrivMB, conhostWsMB] = out
  return { privMB, handles, threads, conhosts, conhostPrivMB, conhostWsMB }
}
const rows = []
const row = (step) => { const r = { step, count: COUNT, serverPid: ts.pid, ...sample(), at: new Date().toISOString() }; rows.push(r); console.log(JSON.stringify(r)) }
try {
  await sleep(2000)
  row('start')
  for (let i = 1; i <= COUNT; i++) await open(`e${i}`)
  await sleep(3000)
  row('open')
  for (let i = 1; i <= COUNT; i++) ts.send({ type: 'pty:write', id: `e${i}`, data: 'exit\r' })
  await until(() => [...Array(COUNT)].every((_, i) => exits.has(`e${i + 1}`)))
  await sleep(10_000)
  row('natural-exit+10s')
  for (let i = 1; i <= COUNT; i++) ts.send({ type: 'pty:kill', id: `e${i}` }) // what BAT sends when the exited tab is closed: nothing happens
  await sleep(3000)
  row('kill-after-exit')
  for (let i = 1; i <= COUNT; i++) await open(`k${i}`)
  await sleep(3000)
  row('open-2')
  for (let i = 1; i <= COUNT; i++) ts.send({ type: 'pty:kill', id: `k${i}` })
  await sleep(12_000)
  row('bat-kill+12s')
} finally {
  ts.send({ type: 'server:shutdown' })
  await new Promise((r) => { const t = setTimeout(r, 30_000); ts.once('exit', () => { clearTimeout(t); r() }) })
  console.log(JSON.stringify({ tsExited: ts.exitCode !== null || ts.signalCode !== null, pid: ts.pid }))
  fs.rmSync(cwd, { recursive: true, force: true })
  if (OUT) fs.appendFileSync(OUT, rows.map(r => JSON.stringify(r)).join('\n') + '\n')
}
