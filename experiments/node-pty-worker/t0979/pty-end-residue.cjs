// T0979 ② / ③: what node-pty 1.1.0 leaves behind on Windows when a PTY ends, without the app.
// Run with Electron as node (the main process in direct mode) or with node:
//
//   ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe experiments/node-pty-worker/t0979/pty-end-residue.cjs \
//       --scenario kill|exit|attached [--fix none|release] [--count N] [--label X] [--out <jsonl>]
//
// kill     : ② direct mode — open → `pty.kill()` → `taskkill /F /T /PID <shell>` (PtyManager.kill's order), N times.
//            --fix release: destroy the PTY's conin socket after its exit (what T0889 does in the Terminal Server).
// exit     : ③ F4 — open N PTYs, each shell runs `exit` by itself.
//            --fix release: after the exit, ClosePseudoConsole (`_agent._ptyNative.kill`), destroy conin, dispose the
//            conout Worker — the candidate fix (no console process list, no process.kill).
// attached : ③ the product question — the shell starts `ping -n 40` attached to the same console (Start-Process
//            -NoNewWindow), then exits. Is ping still running after the exit, and after the release?
//
// Only processes this script spawned are touched (their pids are printed). The env of every shell is this process's
// env without BAT_* / CT_*. Output: numbers, pids and process names only.
'use strict'
const { execFileSync, fork } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..', '..')
const pty = require(path.join(ROOT, 'node_modules', '@lydell', 'node-pty'))
const args = process.argv.slice(2)
const arg = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def }
const SCENARIO = arg('scenario', 'kill')
const FIX = arg('fix', 'none')
const COUNT = Number(arg('count', SCENARIO === 'kill' ? '100' : SCENARIO === 'exit' ? '20' : '1'))
const LABEL = arg('label', `${process.versions.electron ? 'electron' : 'node'} ${SCENARIO} ${FIX}`)
const OUT = arg('out', '')

const env = { ...process.env }
for (const k of Object.keys(env)) if (k.startsWith('BAT_') || k.startsWith('CT_') || k === 'ELECTRON_RUN_AS_NODE') delete env[k]
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 't0979-residue-'))
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
// eslint-disable-next-line no-control-regex
const strip = (t) => t.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
const spawnedShells = []

function ps(script) {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 60_000, windowsHide: true }).trim()
}
/** Private bytes (MB) and handle count of this process; its direct children by name (count, private MB). */
function sample() {
  const out = ps(`$p = Get-Process -Id ${process.pid}; $c = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=${process.pid}"); ` +
    `$g = $c | Group-Object Name | ForEach-Object { '{0}={1}:{2}' -f $_.Name, $_.Count, [math]::Round((($_.Group | Measure-Object PrivatePageCount -Sum).Sum)/1MB,1) }; ` +
    `'{0}|{1}|{2}' -f [math]::Round($p.PrivateMemorySize64/1MB,1), $p.HandleCount, ($g -join ',')`)
  const [priv, handles, kids] = out.split('|')
  const res = {}
  for (const r of process.getActiveResourcesInfo()) res[r] = (res[r] ?? 0) + 1
  return { privMB: Number(priv), handles: Number(handles), children: kids || '', resources: res }
}
function alive(pid) { try { process.kill(pid, 0); return true } catch { return false } }

function open(id, shellArgs = ['-NoLogo', '-NoProfile']) {
  const p = pty.spawn('pwsh.exe', shellArgs, { name: 'xterm-256color', cols: 120, rows: 30, cwd, env })
  spawnedShells.push(p.pid)
  let tail = ''
  const waiters = []
  p.onData((d) => { tail = (tail + d).slice(-4096); for (const w of [...waiters]) w() })
  const exited = new Promise((resolve) => p.onExit((e) => resolve(e)))
  const until = (re, ms = 60_000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${id} ${re}`)), ms)
    const check = () => { if (re.test(strip(tail))) { clearTimeout(t); waiters.splice(waiters.indexOf(check), 1); resolve() } }
    waiters.push(check)
    check()
  })
  return { p, id, exited, until }
}
/** The candidate releases, reaching into node-pty 1.1.0's WindowsPtyAgent (shape-checked; nothing if it differs). */
function releaseConin(p) {
  const s = p?._agent?.inSocket
  if (s && typeof s.destroy === 'function' && !s.destroyed) { s.destroy(); return true }
  return false
}
function closePseudoConsole(p) {
  const a = p?._agent
  if (a && a._ptyNative && typeof a._ptyNative.kill === 'function' && a._pty !== undefined) { a._ptyNative.kill(a._pty); return true }
  return false
}
function disposeConout(p) {
  const w = p?._agent?._conoutSocketWorker
  if (w && typeof w.dispose === 'function') { w.dispose(); return true }
  return false
}
function consoleProcessList(pid) {
  return new Promise((resolve) => {
    const agent = fork(path.join(ROOT, 'node_modules', '@lydell', 'node-pty', 'conpty_console_list_agent.js'), [String(pid)], { env })
    const t = setTimeout(() => { agent.kill(); resolve('timeout') }, 5000)
    agent.on('message', (m) => { clearTimeout(t); resolve(m.consoleProcessList) })
    agent.on('exit', (code) => { clearTimeout(t); resolve(`agent exit ${code}`) })
  })
}

const rows = []
const row = (step, extra = {}) => { const r = { label: LABEL, scenario: SCENARIO, fix: FIX, count: COUNT, step, at: new Date().toISOString(), ...sample(), ...extra }; rows.push(r); console.log(JSON.stringify(r)) }

async function main() {
  row('start')
  if (SCENARIO === 'kill') {
    for (let i = 1; i <= COUNT; i++) {
      const t = open(`k${i}`)
      await t.until(/PS [^\r\n]*>/)
      if (FIX === 'release') t.p.onExit(() => setImmediate(() => releaseConin(t.p)))
      const pid = t.p.pid
      t.p.kill()
      try { execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore', timeout: 3000, windowsHide: true }) } catch { /* gone */ }
      await Promise.race([t.exited, sleep(10_000)])
      if (i % 25 === 0) row('cycle', { cycle: i })
    }
    await sleep(8000) // node-pty kill(): console list agent (≤ 5 s) then ClosePseudoConsole
    row('end')
  } else if (SCENARIO === 'exit') {
    const tabs = []
    for (let i = 1; i <= COUNT; i++) { const t = open(`e${i}`); await t.until(/PS [^\r\n]*>/); tabs.push(t) }
    row('open')
    for (const t of tabs) {
      if (FIX === 'release') t.p.onExit(() => setImmediate(() => { closePseudoConsole(t.p); releaseConin(t.p); disposeConout(t.p) }))
      t.p.write('exit\r')
    }
    await Promise.all(tabs.map(t => t.exited))
    await sleep(5000)
    row('exited')
    await sleep(25_000)
    row('exited+30s')
  } else if (SCENARIO === 'attached') {
    const t = open('a1')
    await t.until(/PS [^\r\n]*>/)
    t.p.write("Start-Process -NoNewWindow -FilePath ping.exe -ArgumentList '-n','40','127.0.0.1'; Start-Sleep -Milliseconds 800; exit\r")
    const shellPid = t.p.pid
    await t.exited
    await sleep(1500)
    const pingPids = ps(`@(Get-CimInstance Win32_Process -Filter "ParentProcessId=${shellPid} AND Name='PING.EXE'") | ForEach-Object { $_.ProcessId }`).split(/\s+/).filter(Boolean).map(Number)
    const listByShell = await consoleProcessList(shellPid)
    const listByPing = pingPids.length ? await consoleProcessList(pingPids[0]) : 'no ping'
    row('exited', { shellPid, pingPids, pingAlive: pingPids.map(alive), consoleListByDeadShell: listByShell, consoleListByPing: listByPing })
    if (FIX === 'release') {
      closePseudoConsole(t.p); releaseConin(t.p); disposeConout(t.p)
      await sleep(3000)
      row('released', { pingAlive: pingPids.map(alive) })
    }
    for (const pid of pingPids) if (alive(pid)) { try { execFileSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore', timeout: 3000, windowsHide: true }) } catch { /* gone */ } }
  }
}

main().catch((e) => { console.log(JSON.stringify({ error: String(e) })); process.exitCode = 1 }).finally(() => {
  const left = spawnedShells.filter(alive)
  for (const pid of left) { try { execFileSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore', timeout: 3000, windowsHide: true }) } catch { /* gone */ } }
  console.log(JSON.stringify({ selfPid: process.pid, shellsSpawned: spawnedShells.length, shellsStillAliveAtEnd: left }))
  if (OUT) fs.appendFileSync(OUT, rows.map(r => JSON.stringify(r)).join('\n') + '\n')
  try { fs.rmSync(cwd, { recursive: true, force: true }) } catch { /* in use */ }
  // the PTYs left on purpose (exit scenario, fix none) end with this process
  setTimeout(() => process.exit(), 500)
})
