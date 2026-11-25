// T0915 (PLAN-068 / D336): interactive driver for the CT 6.1.0 acceptance (checklist M-C1–M-C7).
//
// Not a Playwright test (the runner only collects `*.spec.ts`), never run by `npm run test:*`.
// Starts ONE isolated BAT (packaged exe via BAT_E2E_EXECUTABLE, `--runtime=e2e-<name>-<ts>`, see
// e2e/fixtures/electron-isolation.ts) with CLAUDE_CONFIG_DIR set to the acceptance config directory and
// without the driving Claude Code session's variables, then waits for commands on a loopback HTTP port.
// The commands are sent one at a time with e2e/manual/ct610-ctl.mjs, so a person (or an agent) can look
// at each result before deciding the next step: a real claude answers differently every run.
//
// Required env (paths only from env, nothing machine-specific in the repo):
//   BAT_E2E_EXECUTABLE   BetterAgentTerminal.exe under test (zip build)
//   CT610_CONFIG_DIR     CLAUDE_CONFIG_DIR for every claude the app starts (tower and Workers)
//   CT610_NAME           runtime name, [a-zA-Z0-9._-]+ (runtime id = e2e-<name>-<timestamp>)
//   CT610_LOG            file the driver appends every command and result summary to
// Optional:
//   CT610_STATE_DIR      where the port / secret file goes (default: os.tmpdir())
//   CT610_KEEP_USERDATA  1 = keep the runtime userData on quit (default: removed after the logs are copied)
//
// Start (PowerShell; Git Bash: same with `VAR=value` prefixes):
//   $env:BAT_E2E_EXECUTABLE='C:/Users/demo/BAT/BetterAgentTerminal.exe'; $env:CT610_CONFIG_DIR='C:/Users/demo/accept/claude-config'
//   $env:CT610_NAME='mc7'; $env:CT610_LOG='C:/Users/demo/accept/results/driver-mc7.log'
//   node node_modules/tsx/dist/cli.mjs e2e/manual/ct610-driver.ts
// It prints `CT610 DRIVER READY name=<name> state=<file>`; then use ct610-ctl.mjs (see e2e/manual/README.md).
//
// The HTTP server listens on 127.0.0.1 only and every request must carry the random secret from the state
// file (header `x-ct610-secret`); the state file is deleted on quit. Secrets of the app (BAT_REMOTE_TOKEN,
// batcap.* tokens) never pass through here: captured terminal output is written with tokens masked.

import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, type IsolatedInstance } from '../fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`missing env ${name} (see the header of e2e/manual/ct610-driver.ts)`)
    process.exit(2)
  }
  return value
}

const EXE = requireEnv('BAT_E2E_EXECUTABLE')
const CONFIG_DIR = requireEnv('CT610_CONFIG_DIR')
const NAME = requireEnv('CT610_NAME')
const LOG_FILE = requireEnv('CT610_LOG')
const STATE_DIR = process.env.CT610_STATE_DIR?.trim() || os.tmpdir()
const KEEP_USERDATA = process.env.CT610_KEEP_USERDATA === '1'
if (!/^[a-zA-Z0-9._-]+$/.test(NAME)) { console.error(`invalid CT610_NAME: ${NAME}`); process.exit(2) }
if (!fs.existsSync(EXE)) { console.error(`BAT_E2E_EXECUTABLE not found: ${EXE}`); process.exit(2) }
if (!fs.existsSync(CONFIG_DIR)) { console.error(`CT610_CONFIG_DIR not found: ${CONFIG_DIR}`); process.exit(2) }

/** Variables of the Claude Code session that drives this script; a claude inside the app must not see them. */
const DROP_ENV = ['CLAUDECODE', /^CLAUDE_CODE_/i, 'CLAUDE_PID', 'CLAUDE_EFFORT', 'CLAUDE_PLUGIN_DATA', 'CLAUDE_PLUGIN_ROOT']

const stamp = () => {
  const d = new Date()
  const off = -d.getTimezoneOffset()
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')
  const local = new Date(d.getTime() + off * 60_000).toISOString().slice(0, 19)
  return `${local}${off >= 0 ? '+' : '-'}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
}

/** Masks BAT capability tokens and any long hex secret-looking value. */
export function maskSecrets(text: string): string {
  return text
    .replace(/batcap\.[A-Za-z0-9._~+/=-]+/g, 'batcap.<masked>')
    .replace(/(BAT_REMOTE_TOKEN\s*[=:]\s*)\S+/g, '$1<已設定>')
}

/** ANSI / OSC stripping for a readable text copy of the raw PTY stream (the raw copy is kept too). */
export function stripAnsi(text: string): string {
  return text
    // OSC … BEL / ST
    .replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)/g, '')
    // CSI (ECMA-48: params 0x30–0x3F, intermediates 0x20–0x2F, final 0x40–0x7E)
    .replace(/\u001b\[[\u0030-\u003f]*[\u0020-\u002f]*[\u0040-\u007e]/g, '\n')
    // other two-byte escapes
    .replace(/\u001b[\u0040-\u005f]/g, '')
    .replace(/\r(?!\n)/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
}

function log(message: string): void {
  const line = `[${stamp()}] ${message}`
  console.log(line)
  try { fs.appendFileSync(LOG_FILE, `${maskSecrets(line)}\n`, 'utf8') } catch { /* ignore */ }
}

interface Op {
  op: string
  [key: string]: unknown
}

let inst: IsolatedInstance | undefined

/** Installs the renderer-side PTY output capture (again after every reload). */
async function installCapture(): Promise<void> {
  await inst!.win.evaluate(() => {
    const w = window as AnyApi
    if (w.__ct610?.installed) return
    w.__ct610 = { installed: true, out: {} as Record<string, string> }
    w.electronAPI.pty.onOutput((id: string, data: string) => {
      const o = w.__ct610.out
      o[id] = (o[id] ?? '') + data
    })
  })
}

async function locatorFor(selector: string, nth?: unknown, hasText?: unknown) {
  let loc = inst!.win.locator(selector)
  if (typeof hasText === 'string' && hasText) loc = loc.filter({ hasText })
  return typeof nth === 'number' ? loc.nth(nth) : loc.first()
}

async function handle(op: Op): Promise<unknown> {
  const win = inst!.win
  switch (op.op) {
    case 'ping':
      return { runtimeId: inst!.runtimeId, userData: inst!.userData, remotePort: inst!.remotePort, url: win.url() }
    case 'eval': // renderer; body of an async function
      return win.evaluate(`(async () => { ${String(op.js)} })()`)
    case 'evalMain': // main process; body of an async function with `electron` in scope
      return inst!.app.evaluate(async (electron, src) => {
        const fn = new Function('electron', `return (async () => { ${src} })()`)
        return fn(electron)
      }, String(op.js))
    case 'reload':
      await win.reload()
      await win.waitForLoadState('domcontentloaded')
      await installCapture()
      return 'reloaded'
    case 'type':
      await win.keyboard.type(String(op.text), { delay: typeof op.delay === 'number' ? op.delay : 20 })
      return 'typed'
    case 'insert': // one input event (IME-like), for long text
      await win.keyboard.insertText(String(op.text))
      return 'inserted'
    case 'press':
      await win.keyboard.press(String(op.key))
      return 'pressed'
    case 'click': {
      const loc = await locatorFor(String(op.selector), op.nth, op.hasText)
      await loc.click({ timeout: typeof op.timeout === 'number' ? op.timeout : 10_000, position: op.position as { x: number; y: number } | undefined })
      return 'clicked'
    }
    case 'hover': {
      const loc = await locatorFor(String(op.selector), op.nth, op.hasText)
      await loc.hover({ timeout: 10_000 })
      return 'hovered'
    }
    case 'fill': {
      const loc = await locatorFor(String(op.selector), op.nth, op.hasText)
      await loc.fill(String(op.value), { timeout: 10_000 })
      return 'filled'
    }
    case 'check': {
      const loc = await locatorFor(String(op.selector), op.nth, op.hasText)
      await loc.check({ timeout: 10_000 })
      return 'checked'
    }
    case 'wheel': { // mouse wheel over an element (scroll the xterm viewport like a user)
      const loc = await locatorFor(String(op.selector), op.nth, op.hasText)
      const box = await loc.boundingBox()
      if (!box) throw new Error('element has no box')
      await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      const steps = typeof op.steps === 'number' ? op.steps : 1
      for (let i = 0; i < steps; i++) {
        await win.mouse.wheel(0, Number(op.dy ?? -300))
        await win.waitForTimeout(80)
      }
      return 'wheeled'
    }
    case 'count':
      return win.locator(String(op.selector)).count()
    case 'text': { // innerText of every match (max 50)
      const loc = win.locator(String(op.selector))
      const n = Math.min(await loc.count(), 50)
      const out: string[] = []
      for (let i = 0; i < n; i++) out.push(await loc.nth(i).innerText())
      return out
    }
    case 'attrs': { // attributes of every match (max 50)
      return win.locator(String(op.selector)).evaluateAll(els => els.slice(0, 50).map(el => {
        const a: Record<string, string> = {}
        for (const at of Array.from(el.attributes)) a[at.name] = at.value
        a['#text'] = (el.textContent ?? '').slice(0, 300)
        return a
      }))
    }
    case 'shot': {
      const file = String(op.path)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      await win.screenshot({ path: file })
      return file
    }
    case 'out': { // captured PTY output of one terminal → raw + stripped text files
      const raw: string = await win.evaluate(id => (window as AnyApi).__ct610?.out?.[id] ?? '', String(op.id))
      const masked = maskSecrets(raw)
      if (typeof op.path === 'string') {
        fs.mkdirSync(path.dirname(op.path), { recursive: true })
        fs.writeFileSync(op.path, stripAnsi(masked), 'utf8')
        fs.writeFileSync(`${op.path}.raw`, masked, 'utf8')
      }
      const tail = typeof op.tail === 'number' ? op.tail : 1500
      return { length: raw.length, tail: stripAnsi(masked).slice(-tail) }
    }
    case 'outMark': // length of the captured output now (use with `outSince`)
      return win.evaluate(id => ((window as AnyApi).__ct610?.out?.[id] ?? '').length, String(op.id))
    case 'outSince': {
      const raw: string = await win.evaluate(id => (window as AnyApi).__ct610?.out?.[id] ?? '', String(op.id))
      return stripAnsi(maskSecrets(raw.slice(Number(op.from ?? 0)))).slice(-(typeof op.tail === 'number' ? op.tail : 3000))
    }
    case 'wait':
      await win.waitForTimeout(Number(op.ms ?? 1000))
      return 'waited'
    case 'waitFor': { // selector visible / hidden
      const loc = await locatorFor(String(op.selector), op.nth, op.hasText)
      await loc.waitFor({ state: (op.state as 'visible' | 'hidden' | 'attached' | 'detached') ?? 'visible', timeout: Number(op.timeout ?? 30_000) })
      return 'ok'
    }
    case 'copyLogs': { // runtime Logs/ → destination directory
      const dest = String(op.dest)
      fs.mkdirSync(dest, { recursive: true })
      const src = path.join(inst!.userData, 'Logs')
      const files = fs.existsSync(src) ? fs.readdirSync(src) : []
      for (const f of files) {
        const text = fs.readFileSync(path.join(src, f), 'utf8')
        fs.writeFileSync(path.join(dest, f), maskSecrets(text), 'utf8')
      }
      return files
    }
    case 'grepLog': { // lines of the runtime debug / bat-scripts logs matching a regex
      const src = path.join(inst!.userData, 'Logs')
      const re = new RegExp(String(op.re))
      const out: string[] = []
      for (const f of fs.existsSync(src) ? fs.readdirSync(src) : []) {
        for (const line of fs.readFileSync(path.join(src, f), 'utf8').split('\n')) if (re.test(line)) out.push(`${f}: ${maskSecrets(line)}`)
      }
      return out.slice(-(typeof op.tail === 'number' ? op.tail : 200))
    }
    default:
      throw new Error(`unknown op ${op.op}`)
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
  log(`starting: exe=${EXE} name=${NAME} CLAUDE_CONFIG_DIR=${CONFIG_DIR}`)
  inst = await launchIsolated(NAME, log, {
    env: { CLAUDE_CONFIG_DIR: CONFIG_DIR },
    dropEnv: DROP_ENV,
  })
  await installCapture()
  const childEnvCheck = await inst.app.evaluate(() => ({
    claudeConfigDir: process.env.CLAUDE_CONFIG_DIR ?? null,
    claudeSessionVars: Object.keys(process.env).filter(k => k === 'CLAUDECODE' || /^CLAUDE_CODE_/i.test(k)),
    ctVars: Object.keys(process.env).filter(k => k.startsWith('CT_')),
  }))
  log(`app env check: ${JSON.stringify(childEnvCheck)}`)

  const secret = crypto.randomBytes(24).toString('hex')
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.headers['x-ct610-secret'] !== secret) {
      res.writeHead(403).end()
      return
    }
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c as Buffer))
    req.on('end', async () => {
      let op: Op
      try {
        op = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Op
      } catch {
        res.writeHead(400).end('bad json')
        return
      }
      const summary = op.op === 'type' || op.op === 'insert' ? `${op.op} len=${String(op.text).length}` : maskSecrets(JSON.stringify(op).slice(0, 300))
      if (op.op === 'quit') {
        log('quit requested')
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, result: 'quitting' }))
        server.close()
        await shutdown(0)
        return
      }
      try {
        const result = await handle(op)
        log(`op ${summary} → ok`)
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, result }))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log(`op ${summary} → error ${message.split('\n')[0]}`)
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: message }))
      }
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  const stateFile = path.join(STATE_DIR, `ct610-driver-${NAME}.json`)
  fs.writeFileSync(stateFile, JSON.stringify({ port, secret, pid: process.pid, runtimeId: inst.runtimeId, userData: inst.userData }), { mode: 0o600 })
  stateFiles.push(stateFile)
  log(`CT610 DRIVER READY name=${NAME} runtime=${inst.runtimeId} state=${stateFile}`)
}

const stateFiles: string[] = []
let shuttingDown = false
async function shutdown(code: number): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  for (const f of stateFiles) fs.rmSync(f, { force: true })
  if (inst) await closeIsolated(inst, log, { keepUserData: KEEP_USERDATA })
  log(`driver exit ${code}`)
  process.exit(code)
}

process.on('SIGINT', () => { void shutdown(130) })
main().catch(async err => {
  log(`driver failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
  await shutdown(1)
})
