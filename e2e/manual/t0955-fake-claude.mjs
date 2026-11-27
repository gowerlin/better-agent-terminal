// T0955: helper half of the fake claude (see t0955-fake-claude.cs and e2e/manual/README.md).
//
// The fake claude.exe owns the console (VT modes, output, stdin); it runs this script with stdin / stdout / stderr
// redirected, so this script never reads or writes the tab. Modes (first argument):
//   meta     <run>.meta.json: pid of the exe, BAT_TERMINAL_ID, argv, control.json, MSYS2_ARG_CONV_EXCL, and the
//            names (never values) of the BAT_* / CT_* variables the tab's claude sees
//   setrole  <run>.setrole.json: `bat-terminal.mjs --set-role tower --bat-contract 2 --mode on` with the tab's own
//            helper env (what the real /control-tower skill does): exit code, stdout, stderr (batcap.* tokens masked)
//   serve    stays running; <dataDir>/cmd-<BAT_TERMINAL_ID>.json = { "op": "whoami", "tag": "<name>" } is picked up
//            within 0.5 s, deleted, and answered in <run>.cmd-<tag>.json with the BAT MCP tool `bat_whoami` run
//            through the tab's own helper env (its port and scoped token)
// <run> = the exe's argv file without `.argv.txt` (FAKE_CLAUDE_ARGV_FILE). No model, no network beyond loopback.

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const argvFile = process.env.FAKE_CLAUDE_ARGV_FILE
const dataDir = process.env.FAKE_CLAUDE_DATA_DIR
if (!argvFile || !dataDir) {
  console.error('t0955-fake-claude: started only by the fake claude.exe')
  process.exit(2)
}
const base = argvFile.replace(/\.argv\.txt$/, '')
const launcherPid = Number(process.env.FAKE_CLAUDE_LAUNCHER_PID) || null
const terminalId = process.env.BAT_TERMINAL_ID ?? ''
const helperNode = process.env.BAT_HELPER_NODE || process.execPath
const helperDir = process.env.BAT_HELPER_DIR ?? ''

const mask = text => String(text)
  .replace(/batcap\.[A-Za-z0-9._~+/=-]+/g, 'batcap.<masked>')
  .replace(/(BAT_REMOTE_TOKEN\s*[=:]\s*)\S+/g, '$1<已設定>')
const now = () => new Date().toISOString()
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')

function meta() {
  const args = fs.readFileSync(argvFile, 'utf8').split('\n')
    .filter(line => /^argv\[\d+\]=/.test(line))
    .map(line => line.replace(/^argv\[\d+\]=/, ''))
  let control = null
  try { control = JSON.parse(fs.readFileSync(path.join(dataDir, 'control.json'), 'utf8')) } catch { /* none */ }
  writeJson(`${base}.meta.json`, {
    startedAt: now(),
    pid: launcherPid,
    terminalId,
    args,
    control,
    msys2ArgConvExcl: process.env.MSYS2_ARG_CONV_EXCL ?? null,
    envNames: Object.keys(process.env).filter(k => /^(BAT|CT)_/.test(k)).sort(),
  })
}

function setrole() {
  const started = Date.now()
  const r = spawnSync(helperNode, [path.join(helperDir, 'bat-terminal.mjs'), '--set-role', 'tower', '--bat-contract', '2', '--mode', 'on'], {
    encoding: 'utf8', timeout: 30_000, windowsHide: true,
  })
  writeJson(`${base}.setrole.json`, {
    at: now(), ms: Date.now() - started, exit: r.status, signal: r.signal, error: r.error ? String(r.error) : null,
    stdout: mask(r.stdout ?? ''), stderr: mask(r.stderr ?? ''),
  })
}

/** `bat_whoami` through the BAT MCP shim, with this tab's env (its own port and scoped token). */
function whoami() {
  return new Promise(resolve => {
    const child = spawn(helperNode, [path.join(helperDir, 'bat-mcp.mjs')], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    let buf = ''
    let stderr = ''
    const timer = setTimeout(() => { child.kill(); resolve({ error: 'timeout', stderr: mask(stderr) }) }, 20_000)
    child.stderr.on('data', d => { stderr += d })
    child.stdout.on('data', d => {
      buf += d
      for (const line of buf.split('\n')) {
        let msg
        try { msg = JSON.parse(line) } catch { continue }
        if (msg.id === 2) {
          clearTimeout(timer)
          child.kill()
          resolve({ response: JSON.parse(mask(JSON.stringify(msg))) })
          return
        }
      }
    })
    child.on('error', err => { clearTimeout(timer); resolve({ error: String(err) }) })
    const send = m => child.stdin.write(`${JSON.stringify(m)}\n`)
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't0955-fake-claude', version: '1' } } })
    send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'bat_whoami', arguments: {} } })
  })
}

function serve() {
  const cmdFile = path.join(dataDir, `cmd-${terminalId}.json`)
  let busy = false
  setInterval(async () => {
    if (busy || !terminalId || !fs.existsSync(cmdFile)) return
    busy = true
    try {
      const cmd = JSON.parse(fs.readFileSync(cmdFile, 'utf8'))
      fs.rmSync(cmdFile, { force: true })
      const tag = String(cmd.tag ?? 'cmd').replace(/[^a-zA-Z0-9._-]/g, '_')
      const result = cmd.op === 'whoami' ? await whoami() : { error: `unknown op ${cmd.op}` }
      writeJson(`${base}.cmd-${tag}.json`, { at: now(), op: cmd.op, pid: process.pid, ...result })
    } catch (err) {
      writeJson(`${base}.cmd-error.json`, { at: now(), error: String(err) })
    } finally {
      busy = false
    }
  }, 500)
  // the exe (our parent) goes away with the tab's PTY: stop too
  setInterval(() => {
    try { process.kill(launcherPid, 0) } catch { process.exit(0) }
  }, 2_000)
}

const mode = process.argv[2]
if (mode === 'meta') meta()
else if (mode === 'setrole') setrole()
else if (mode === 'serve') serve()
else { console.error(`unknown mode ${mode}`); process.exit(2) }
