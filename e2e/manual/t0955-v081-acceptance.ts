// T0955 (D450): automated acceptance of a packaged build for A-19–A-23 — BUG-228 (Git Bash rewrote `/control-tower`),
// BUG-229 (mouse reports after ⏻), BUG-230 (Tower declaration lost after reattach), BUG-231 (keys typed during ⏻)
// and T0950 (leftover alt screen after ⏻). See e2e/manual/README.md.
//
// Not a Playwright test (the runner only collects `*.spec.ts`), never run by `npm run test:*`. Runs ONE isolated BAT
// (packaged exe, `--runtime=e2e-t0955-<ts>`, own userData / Terminal Server / remote port, BAT_* / CT_* / the driving
// Claude Code session's variables dropped) with Settings → Shell = Git Bash and Settings → Claude Runtime = system with
// customPath = a fake `claude.exe` (e2e/manual/t0955-fake-claude.cs + t0955-fake-claude.mjs, no model, no network)
// and fallbackToEmbedded off, so the embedded claude never starts. Never touches an installed BAT, its userData or
// Terminal Server; ends only processes it started (by pid).
//
// Required env:
//   BAT_E2E_EXECUTABLE   BetterAgentTerminal.exe under test (zip build)
//   T0955_RESULTS        results directory outside the repo (fake claude, workspace, logs, screenshots, report)
// Optional:
//   T0955_GIT_BASH       Git Bash path checked before the run (default C:\Program Files\Git\bin\bash.exe)
//   T0955_CSC            csc.exe (default .NET Framework 4 csc under %WINDIR%)
//
// Run (repo root, after npm ci):  node node_modules/tsx/dist/cli.mjs e2e/manual/t0955-v081-acceptance.ts
// Exit 0 = every item PASS, 1 = some item FAIL / 未判定, 2 = usage / setup error. Report: <results>/report-<stamp>.json.

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, commandLineOf, freePort, isolatedEnv, readPid, REPO_ROOT } from '../fixtures/electron-isolation'
import { NO_UPDATE_CHECK_SETTINGS } from '../fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) { console.error(`missing env ${name} (see the header of e2e/manual/t0955-v081-acceptance.ts)`); process.exit(2) }
  return value
}

const EXE = path.resolve(requireEnv('BAT_E2E_EXECUTABLE'))
const RESULTS = path.resolve(requireEnv('T0955_RESULTS'))
const GIT_BASH = process.env.T0955_GIT_BASH?.trim() || 'C:\\Program Files\\Git\\bin\\bash.exe'
const CSC = process.env.T0955_CSC?.trim() || path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
if (process.platform !== 'win32') { console.error('Windows only'); process.exit(2) }
if (!fs.existsSync(EXE)) { console.error(`BAT_E2E_EXECUTABLE not found: ${EXE}`); process.exit(2) }

const pad = (n: number) => String(n).padStart(2, '0')
const d0 = new Date()
const STAMP = `${d0.getFullYear()}${pad(d0.getMonth() + 1)}${pad(d0.getDate())}-${pad(d0.getHours())}${pad(d0.getMinutes())}${pad(d0.getSeconds())}`
const FAKE_DIR = path.join(RESULTS, 'fake')
const FAKE_EXE = path.join(FAKE_DIR, 'claude.exe')
const RUN_DIR = path.join(RESULTS, `run-${STAMP}`)
const DATA = path.join(RUN_DIR, 'fake-data')
const WS_DIR = path.join(RUN_DIR, 'ws')
const CFG_DIR = path.join(RUN_DIR, 'claude-config')
const SHOTS = path.join(RUN_DIR, 'shots')
const LOG_FILE = path.join(RUN_DIR, 'driver.log')
const REPORT = path.join(RESULTS, `report-${STAMP}.json`)
const HOME = os.homedir()
/** Variables of the Claude Code session that drives this script; a claude inside the app must not see them. */
const DROP_ENV = ['CLAUDECODE', /^CLAUDE_CODE_/i, 'CLAUDE_PID', 'CLAUDE_EFFORT', 'CLAUDE_PLUGIN_DATA', 'CLAUDE_PLUGIN_ROOT']
const WS_ID = 'ws-t0955'
const WS_NAME = 'T0955'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
/** De-identified text for logs and the report: home directory → <使用者資料夾>, BAT tokens masked. */
function clean(text: string): string {
  let t = String(text)
  for (const h of [HOME, HOME.replace(/\\/g, '/'), HOME.replace(/\\/g, '\\\\')]) t = t.split(h).join('<使用者資料夾>')
  return t.replace(/batcap\.[A-Za-z0-9._~+/=-]+/g, 'batcap.<masked>').replace(/(BAT_REMOTE_TOKEN\s*[=:]\s*)\S+/g, '$1<已設定>')
}
function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${clean(message)}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8')
}
async function poll<T>(fn: () => T | Promise<T>, timeoutMs: number, intervalMs = 250): Promise<T | undefined> {
  const end = Date.now() + timeoutMs
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > end) return undefined
    await sleep(intervalMs)
  }
}
function execText(file: string, args: string[], timeout = 30_000): Promise<{ code: number; out: string }> {
  return new Promise(resolve => {
    execFile(file, args, { timeout, windowsHide: true, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof (err as AnyApi).code === 'number' ? (err as AnyApi).code : 1) : 0, out: `${stdout}${stderr}` })
    })
  })
}

// ── results ──
type Verdict = 'PASS' | 'FAIL' | '未判定'
interface Item { verdict: Verdict; checks: { ok: boolean; what: string; evidence?: string }[]; note?: string }
const items: Record<string, Item> = {}
function check(item: string, ok: boolean, what: string, evidence?: unknown): boolean {
  items[item] ??= { verdict: 'PASS', checks: [] }
  const ev = evidence === undefined ? undefined : clean(typeof evidence === 'string' ? evidence : JSON.stringify(evidence)).slice(0, 2000)
  items[item].checks.push({ ok, what, ...(ev !== undefined ? { evidence: ev } : {}) })
  if (!ok && items[item].verdict === 'PASS') items[item].verdict = 'FAIL'
  log(`${ok ? 'PASS' : 'FAIL'} ${item}: ${what}${ev !== undefined ? ` — ${ev.slice(0, 400)}` : ''}`)
  return ok
}
function undetermined(item: string, reason: string): void {
  items[item] ??= { verdict: 'PASS', checks: [] }
  items[item].verdict = '未判定'
  items[item].note = clean(reason)
  log(`未判定 ${item}: ${reason}`)
}

// ── user-layer hashes (configuration only: session transcripts of running Claude Code sessions change by design) ──
function userLayerFiles(): string[] {
  const out: string[] = []
  const add = (p: string) => { if (fs.existsSync(p) && fs.statSync(p).isFile()) out.push(p) }
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') walk(p) } else if (e.isFile()) out.push(p)
    }
  }
  const claude = path.join(HOME, '.claude')
  for (const f of ['settings.json', 'settings.local.json', 'CLAUDE.md']) add(path.join(claude, f))
  for (const f of ['installed_plugins.json', 'known_marketplaces.json']) add(path.join(claude, 'plugins', f))
  for (const d of ['skills', 'agents', 'commands']) walk(path.join(claude, d))
  const codex = path.join(HOME, '.codex')
  for (const f of ['config.toml', 'AGENTS.md']) add(path.join(codex, f))
  walk(path.join(codex, 'skills'))
  return out.sort()
}
function userLayerDigest(): { files: number; digest: string; perFile: Record<string, string> } {
  const perFile: Record<string, string> = {}
  const all = crypto.createHash('sha256')
  for (const f of userLayerFiles()) {
    const h = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
    perFile[f] = h
    all.update(`${f}\0${h}\n`)
  }
  return { files: Object.keys(perFile).length, digest: all.digest('hex'), perFile }
}

// ── processes ──
interface Proc { pid: number; name: string; exe: string; cmd: string }
async function processes(): Promise<Proc[]> {
  const r = await execText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Compress'], 60_000)
  try {
    const arr = JSON.parse(r.out) as AnyApi[]
    return arr.map(p => ({ pid: p.ProcessId, name: p.Name ?? '', exe: p.ExecutablePath ?? '', cmd: p.CommandLine ?? '' }))
  } catch { return [] }
}
/** BAT processes that are not the build under test (the installed BAT and its Terminal Server / holder). */
async function otherBatProcesses(): Promise<string[]> {
  const testRoot = path.dirname(EXE).toLowerCase()
  return (await processes())
    .filter(p => /betteragentterminal/i.test(p.exe) || /BetterAgentTerminal|BAT-PtyHolder/i.test(p.cmd))
    .filter(p => !p.exe.toLowerCase().startsWith(testRoot) && !p.cmd.toLowerCase().includes(testRoot))
    .map(p => `${p.pid}:${p.name}`).sort()
}
async function fakeProcesses(): Promise<Proc[]> {
  const fakeExe = FAKE_EXE.toLowerCase()
  return (await processes()).filter(p => p.exe.toLowerCase() === fakeExe || p.cmd.includes('t0955-fake-claude.mjs'))
}
const isAlive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }

// ── fake claude ──
async function buildFake(): Promise<void> {
  fs.mkdirSync(FAKE_DIR, { recursive: true })
  const src = path.join(REPO_ROOT, 'e2e', 'manual', 't0955-fake-claude.cs')
  const r = await execText(CSC, ['/nologo', '/target:exe', `/out:${FAKE_EXE}`, src], 120_000)
  if (r.code !== 0) throw new Error(`csc failed: ${r.out}`)
  fs.writeFileSync(path.join(FAKE_DIR, 'fake-claude.cfg'),
    [process.execPath, path.join(REPO_ROOT, 'e2e', 'manual', 't0955-fake-claude.mjs'), DATA].join('\n') + '\n', 'utf8')
  const v = await execText(FAKE_EXE, ['--version'])
  if (!/^2\.1\.331 \(Claude Code\)/.test(v.out.trim())) throw new Error(`fake --version: ${v.out}`)
  log(`fake claude built: ${FAKE_EXE} (--version → ${v.out.trim()})`)
}
function setControl(control: Record<string, unknown>): void {
  fs.writeFileSync(path.join(DATA, 'control.json'), JSON.stringify(control), 'utf8')
}
interface Run { base: string; meta: AnyApi; argvText: string }
function runsFor(terminalId: string): Run[] {
  if (!fs.existsSync(DATA)) return []
  const runs: Run[] = []
  for (const f of fs.readdirSync(DATA).filter(n => n.endsWith('.meta.json')).sort()) {
    const base = path.join(DATA, f.replace(/\.meta\.json$/, ''))
    let meta: AnyApi
    try { meta = JSON.parse(fs.readFileSync(`${base}.meta.json`, 'utf8')) } catch { continue }
    if (meta.terminalId !== terminalId) continue
    runs.push({ base, meta, argvText: fs.existsSync(`${base}.argv.txt`) ? fs.readFileSync(`${base}.argv.txt`, 'utf8') : '' })
  }
  return runs
}
const readJson = (file: string): AnyApi => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null } }
const readFile = (file: string): string => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
/** stdin chunks of one run, decoded. */
const stdinOf = (run: Run): string => readFile(`${run.base}.stdin.log`).split('\n').filter(Boolean)
  .map(l => Buffer.from(l.slice(l.indexOf(' ') + 1), 'base64').toString('utf8')).join('')
/** Captured PTY output of one tab, ANSI / OSC removed (for matching typed text that an OSC title update split). */
const plain = (raw: string): string => raw
  .replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)/g, '')
  .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
  .replace(/\u001b[@-_]/g, '')
async function saveOutput(id: string, name: string): Promise<string> {
  const file = path.join(RUN_DIR, `out-${name}.txt`)
  const raw = await outputOf(id)
  fs.writeFileSync(file, clean(plain(raw)), 'utf8')
  fs.writeFileSync(`${file}.raw`, clean(raw), 'utf8')
  return path.relative(RESULTS, file)
}

// ── app ──
let app: ElectronApplication | undefined
let win: Page | undefined
let userData = ''
let runtimeId = ''
let remotePort = 0

function seedSettings(): void {
  const dir = path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), `BetterAgentTerminal-runtime-${runtimeId}`)
  if (fs.existsSync(dir)) throw new Error(`runtime directory already exists: ${dir}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({
    ...NO_UPDATE_CHECK_SETTINGS,
    shell: 'git-bash',
    claudeRuntime: { mode: 'system', customPath: FAKE_EXE, fallbackToEmbedded: false },
  }), { flag: 'wx' })
}

async function launch(): Promise<void> {
  const env = isolatedEnv(remotePort, { CLAUDE_CONFIG_DIR: CFG_DIR }, DROP_ENV)
  app = await electron.launch({ executablePath: EXE.replace(/\\/g, '/'), args: [`--runtime=${runtimeId}`], env })
  userData = await app.evaluate(({ app: a }) => a.getPath('userData'))
  if (!path.basename(userData).includes(`-runtime-${runtimeId}`)) throw new Error(`unexpected userData ${userData}`)
  win = await app.firstWindow()
  await poll(() => !/^(about:blank)?$/.test(win!.url()), 30_000)
  await win.waitForLoadState('domcontentloaded')
  const envCheck = await app.evaluate(() => ({
    batVars: Object.keys(process.env).filter(k => k.startsWith('BAT_')).sort(),
    ctVars: Object.keys(process.env).filter(k => k.startsWith('CT_')),
    claudeSession: Object.keys(process.env).filter(k => k === 'CLAUDECODE' || /^CLAUDE_CODE_/i.test(k)),
    claudeConfigDir: process.env.CLAUDE_CONFIG_DIR ?? null,
  }))
  log(`launched runtime=${runtimeId} port=${remotePort} userData=${userData} env=${JSON.stringify(envCheck)}`)
}

async function installCapture(): Promise<void> {
  await win!.evaluate(() => {
    const w = window as AnyApi
    if (w.__t0955?.installed) return
    w.__t0955 = { installed: true, out: {} as Record<string, string> }
    w.electronAPI.pty.onOutput((id: string, data: string) => { w.__t0955.out[id] = (w.__t0955.out[id] ?? '') + data })
  })
}
const outputOf = (id: string): Promise<string> => win!.evaluate(i => (window as AnyApi).__t0955?.out?.[i] ?? '', id)

// Renderer snippet: `found[terminalId]` = that tab's xterm Terminal (from the TerminalPanel fiber's refs, as ct-accept-act.mjs).
const FIND = `
const found = {}
for (const x of document.querySelectorAll('.xterm')) {
  let el = x; let k
  while (el && !(k = Object.keys(el).find(n => n.startsWith('__reactFiber$')))) el = el.parentElement
  let f = k ? el[k] : null
  for (let i = 0; f && i < 40; i++, f = f.return) {
    const id = f.memoizedProps && f.memoizedProps.terminalId
    if (!id) continue
    let h = f.memoizedState
    for (let j = 0; h && j < 200; j++, h = h.next) {
      const v = h.memoizedState && h.memoizedState.current
      if (v && v.buffer && v.buffer.active && typeof v.focus === 'function') { found[id] = v; break }
    }
    if (found[id]) break
  }
}
`
async function term<T>(id: string, body: string): Promise<T> {
  return win!.evaluate(`(async () => { ${FIND} const t = found[${JSON.stringify(id)}]; if (!t) return null; ${body} })()`) as Promise<T>
}
interface TermState { type: string; mouse: string; cursorHidden: boolean | null; baseY: number; viewportY: number; length: number; rows: number }
const termState = (id: string) => term<TermState>(id, `const b = t.buffer.active
  return { type: b.type, mouse: t.modes.mouseTrackingMode, cursorHidden: t._core?.coreService?.isCursorHidden ?? null,
    baseY: b.baseY, viewportY: b.viewportY, length: b.length, rows: t.rows }`)
const bufferText = (id: string) => term<string>(id, `const b = t.buffer.active; const l = []
  for (let y = 0; y < b.length; y++) { const r = b.getLine(y); l.push(r ? r.translateToString(true) : '') } return l.join('\\n')`)
const viewportText = (id: string) => term<string>(id, `const b = t.buffer.active; const l = []
  for (let y = 0; y < t.rows; y++) { const r = b.getLine(b.viewportY + y); l.push(r ? r.translateToString(true) : '') } return l.join('\\n')`)

interface SavedTab { id: string; title?: string; agentPreset?: string; launchRole?: string }
async function savedTabs(): Promise<SavedTab[]> {
  const raw = await win!.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? (JSON.parse(raw) as { terminals: SavedTab[] }).terminals : []
}
async function addFromMenu(name: RegExp, hover?: boolean): Promise<SavedTab> {
  const known = new Set((await savedTabs()).map(t => t.id))
  await win!.locator('.workspace-container.active .thumbnail-add-btn').click()
  const item = win!.locator('.thumbnail-add-menu-item', { hasText: name }).first()
  await item.waitFor({ state: 'visible', timeout: 10_000 })
  if (hover) await item.hover()
  await item.click()
  const tab = await poll(async () => (await savedTabs()).find(t => !known.has(t.id)), 15_000)
  if (!tab) throw new Error(`no new tab after clicking ${name}`)
  return tab
}
const screenLocator = () => win!.locator('.workspace-container.active .terminal-wrapper.active .xterm-screen').first()
async function shot(name: string): Promise<string> {
  fs.mkdirSync(SHOTS, { recursive: true })
  const file = path.join(SHOTS, name)
  await win!.screenshot({ path: file })
  return path.relative(RESULTS, file)
}
async function clickRestart(): Promise<void> {
  await win!.locator('.main-panel button.action-btn.danger:visible', { hasText: '⏻' }).first().click()
  await win!.locator('.dialog-btn.confirm.danger').click()
}
function debugLogs(): string[] {
  const dir = path.join(userData, 'Logs')
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort() : []
}
const debugLogText = (latestOnly = false): string => {
  const files = debugLogs()
  return (latestOnly ? files.slice(-1) : files).map(f => fs.readFileSync(path.join(userData, 'Logs', f), 'utf8')).join('\n')
}
const logLines = (re: RegExp, latestOnly = false) => debugLogText(latestOnly).split('\n').filter(l => re.test(l))
const MOUSE_REPORT_RE = /(\u001b\[<|\[<|<)?35;\d+;\d+[Mm]/

async function quitApp(stopServer: boolean): Promise<void> {
  await app!.evaluate(({ dialog }, stop) => {
    ;(dialog as AnyApi).showMessageBox = async () => ({ response: 1, checkboxChecked: stop })
  }, stopServer)
  const electronProcess = app!.process()
  const electronPid = electronProcess.pid
  let timer: NodeJS.Timeout | undefined
  const closed = await Promise.race([
    app!.close().then(() => true, () => true),
    new Promise<boolean>(r => { timer = setTimeout(() => r(false), 30_000) }),
  ])
  clearTimeout(timer)
  const exitedByItself = electronPid === undefined || !isAlive(electronPid)
  if (!closed) {
    // Playwright also waits for the app's stdio pipes, which a kept Terminal Server may still hold
    log(`app.close() did not resolve within 30 s; Electron main pid ${electronPid} ${exitedByItself ? 'had already exited by itself' : 'still alive — killing it (own pid)'}`)
    if (!exitedByItself) try { electronProcess.kill() } catch { /* ignore */ }
  }
  const quitLine = logLines(/\[quit\] user confirmed quit/, true).slice(-1)[0] ?? 'missing'
  log(`app quit (stopTerminalServer=${stopServer}); BAT log: ${quitLine}`)
}

async function seedWorkspace(): Promise<void> {
  await poll(async () => (await win!.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, 30_000)
  const seed = {
    workspaces: [{ id: WS_ID, name: WS_NAME, folderPath: WS_DIR, createdAt: Date.now() }],
    activeWorkspaceId: WS_ID,
    activeGroup: null,
    terminals: [{ id: 'shell-t0955', workspaceId: WS_ID, type: 'terminal', title: 'New Terminal', cwd: WS_DIR }],
    activeTerminalId: 'shell-t0955',
  }
  const ok = await win!.evaluate(async data => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))
  if (ok !== true) throw new Error('workspace.save failed')
  await win!.reload()
  await win!.waitForLoadState('domcontentloaded')
  await win!.locator('.workspace-container.active .terminal-wrapper').first().waitFor({ timeout: 30_000 })
  await installCapture()
}

// ── scenarios ──
let towerId = ''

async function a19(): Promise<void> {
  setControl({ fullscreen: true })
  const tower = await addFromMenu(/以塔台開啟 Claude|Open Claude as Tower|以塔台/)
  towerId = tower.id
  log(`tower tab: ${JSON.stringify(tower)}`)
  const run = await poll(() => runsFor(towerId)[0], 30_000)
  if (!run) { undetermined('A-19', 'the fake claude never started in the Tower tab'); return }
  const args: string[] = run.meta.args
  check('A-19', args[args.length - 1] === '/control-tower', 'fake claude argv: the last argument is `/control-tower`', args.slice(-3))
  check('A-19', !args.some(a => /Program Files\/Git\/control-tower|Git[\\/]+control-tower/i.test(a)), 'no argument was rewritten to a Git path', run.argvText.split('\n').filter(l => /control-tower/.test(l)))
  check('A-19', run.meta.msys2ArgConvExcl !== null, 'the fake claude saw MSYS2_ARG_CONV_EXCL (set for this command only)', { MSYS2_ARG_CONV_EXCL: run.meta.msys2ArgConvExcl })
  const out = await outputOf(towerId)
  const cmdLine = out.split(/\r?\n/).find(l => l.includes('MSYS2_ARG_CONV_EXCL=')) ?? ''
  check('A-19', cmdLine.length > 0, 'the tab\'s command line starts with the `MSYS2_ARG_CONV_EXCL=` prefix', cmdLine.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '').slice(0, 600))
  const t0946 = await poll(() => logLines(/\[T0946\] tower tab terminal=/).filter(l => l.includes(towerId))[0], 10_000)
  check('A-19', !!t0946, 'debug log has `[T0946]`', t0946 ?? 'missing')
  const setrole = await poll(() => readJson(`${run.base}.setrole.json`), 30_000)
  check('A-19', setrole?.exit === 0 && /bat-contract: 2/.test(setrole?.stdout ?? ''), 'fake claude declared the Tower (`--set-role tower --bat-contract 2 --mode on`, exit 0)', setrole)
  const state = await poll(async () => { const s = await termState(towerId); return s && s.type === 'alternate' && s.mouse === 'any' ? s : undefined }, 15_000)
  check('A-19', !!state, 'fake claude entered alt screen + any-motion mouse tracking in xterm (setup for A-20)', state ?? await termState(towerId))
  items['A-19'].note = `screenshot ${await shot('a19-tower-fullscreen.png')}`
}

async function a20a23(): Promise<void> {
  const before = runsFor(towerId)
  const run1 = before[before.length - 1]
  if (!run1) { undetermined('A-20', 'no Tower run to restart'); undetermined('A-23', 'no Tower run to restart'); return }
  const box = await screenLocator().boundingBox()
  if (!box) throw new Error('no xterm screen box')
  // armed: mouse motion over the tab reaches the running fake claude as SGR reports
  for (let i = 0; i < 10; i++) { await win!.mouse.move(box.x + 30 + i * 25, box.y + 40 + i * 8); await sleep(30) }
  const armed = await poll(() => (MOUSE_REPORT_RE.test(stdinOf(run1)) ? stdinOf(run1) : undefined), 5_000)
  check('A-20', !!armed, 'setup: before ⏻, mouse motion reaches the old fake claude as SGR `35;…M` reports', (armed ?? stdinOf(run1)).slice(0, 120))
  setControl({ fullscreen: false })
  const mark = (await outputOf(towerId)).length
  const markerLines = Array.from({ length: 5 }, (_, i) => `T0955-MARK-${run1.meta.pid}-${i + 1}`)
  const restartAt = Date.now()

  await clickRestart()
  let moving = true
  const mover = (async () => {
    let i = 0
    while (moving) {
      await win!.mouse.move(box.x + 20 + ((i * 37) % Math.max(1, box.width - 40)), box.y + 20 + ((i * 23) % Math.max(1, box.height - 40))).catch(() => undefined)
      i++
      await sleep(15)
    }
  })()
  await term(towerId, 't.focus(); return true')
  // type while the new shell starts: the new PTY exists (ConPTY's first output) and the launch command is not typed yet
  const newPty = await poll(async () => (await outputOf(towerId)).slice(mark).includes('\u001b[?9001h'), 20_000, 20)
  const typedAt = Date.now()
  await win!.keyboard.type('abc', { delay: 20 })
  const launchSeenAt = await poll(async () => (plain((await outputOf(towerId)).slice(mark)).includes('claude.exe') ? Date.now() : 0), 20_000, 20)
  log(`typed abc ${typedAt - restartAt} ms after ⏻ (new PTY output seen: ${!!newPty}); launch command visible ${launchSeenAt ? launchSeenAt - typedAt : '?'} ms after typing`)
  const run2 = await poll(() => runsFor(towerId).find(r => r.base !== run1.base && !before.some(b => b.base === r.base)), 30_000)
  await sleep(4_000)
  moving = false
  await mover
  log(`new run: ${run2 ? 'ok' : 'none'} (mouse kept moving over the tab from ⏻ until 4 s after the new claude started)`)
  if (!run2) { undetermined('A-20', 'no new fake claude run after ⏻'); undetermined('A-23', 'no new fake claude run after ⏻'); return }

  const args1: string[] = run1.meta.args
  const args2: string[] = run2.meta.args
  check('A-20', args2[args2.length - 1] === '/control-tower', 'new fake claude argv: the last argument is `/control-tower`', args2.slice(-3))
  check('A-20', args2.length === args1.length && args2.every((a, i) => a === args1[i]), 'new argv complete (same arguments as the first launch)', { first: args1.length, second: args2.length, diff: args2.filter((a, i) => a !== args1[i]) })
  const stdin2 = stdinOf(run2)
  const heldLine = logLines(new RegExp(`\\[agent-command\\] id=${towerId} input before the launch command: .* sent after it`))[0]
  check('A-20', stdin2.includes('abc') || !!heldLine, 'the keys typed during ⏻ reach the new claude (stdin has `abc`, or the hold log line)', { stdin: stdin2.slice(0, 200), heldLine: heldLine ?? null })
  check('A-20', !MOUSE_REPORT_RE.test(stdin2), 'new claude stdin has no `35;…M` mouse report', stdin2.slice(0, 200))
  const after = (await outputOf(towerId)).slice(mark)
  check('A-20', !MOUSE_REPORT_RE.test(after), 'tab output after ⏻ has no `35;…M` fragment', after.replace(/\u001b/g, '␛').slice(0, 600))
  const reset = logLines(new RegExp(`\\[mouse-tracking\\] reset: before-new-pty terminal=${towerId}`))
  check('A-20', reset.length > 0, 'debug log has `[mouse-tracking] reset: before-new-pty`', reset[reset.length - 1] ?? 'missing')
  const leftAlt = logLines(new RegExp(`\\[mouse-tracking\\] alt screen left: new-pty-spawned terminal=${towerId}`))
  check('A-23', leftAlt.length > 0, 'debug log has `[mouse-tracking] alt screen left: new-pty-spawned` (T0950)', leftAlt[leftAlt.length - 1] ?? 'missing')
  const bufAfter = (await bufferText(towerId)) ?? ''
  check('A-20', !/35;\d+;\d+M/.test(bufAfter), 'xterm buffer (tab text) has no `35;…M` fragment', bufAfter.split('\n').filter(l => /35;/.test(l)).slice(0, 5))

  // A-23
  const st = await termState(towerId)
  check('A-23', st?.type === 'normal', 'after ⏻ xterm is in the normal buffer', st)
  const lines = bufAfter.split('\n')
  const markerRows = markerLines.map(m => lines.findIndex(l => l.includes(m)))
  check('A-23', markerRows.every(r => r >= 0), 'the marker lines written before claude went fullscreen are still in the buffer', { markerRows, baseY: st?.baseY, length: st?.length })
  // scroll up with the mouse wheel like a user (normal buffer, tracking off)
  await win!.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 15; i++) { await win!.mouse.wheel(0, -400); await sleep(60) }
  await sleep(300)
  const vp = (await viewportText(towerId)) ?? ''
  const stScrolled = await termState(towerId)
  const markerVisible = markerLines.some(m => vp.includes(m))
  check('A-23', markerVisible, 'scrolling up with the mouse wheel reaches the marker lines', { viewportY: stScrolled?.viewportY, visibleMarkers: markerLines.filter(m => vp.includes(m)) })
  const shotScrolled = await shot('a23-scrolled-up.png')
  await term(towerId, 't.scrollToBottom(); return true')
  await sleep(200)
  const stBottom = await termState(towerId)
  items['A-23'].note = `cursor after ⏻: ${stBottom?.cursorHidden === true ? 'hidden (看不到)' : stBottom?.cursorHidden === false ? 'visible (看得到)' : 'unknown'}; mouseTrackingMode=${stBottom?.mouse}; screenshots ${shotScrolled}, ${await shot('a23-bottom.png')}`
  items['A-20'].note = `screenshot ${path.join('run-' + STAMP, 'shots', 'a23-bottom.png')}; tab output ${await saveOutput(towerId, 'tower-after-restart')}; stdin ${path.relative(RESULTS, `${run2.base}.stdin.log`)}`
  const setrole2 = await poll(() => readJson(`${run2.base}.setrole.json`), 30_000)
  log(`second run re-declared the Tower: exit=${setrole2?.exit} ${String(setrole2?.stdout ?? '').replace(/\s+/g, ' ')}`)
}

async function counterExamples(): Promise<void> {
  // ① plain Claude CLI tab: ⏻ never adds /control-tower
  setControl({ fullscreen: false })
  const plainTab = await addFromMenu(/^\s*▶\s*Claude CLI\s*(suggested|建議|建议)?\s*$/)
  log(`plain claude tab: ${JSON.stringify(plainTab)}`)
  const p1 = await poll(() => runsFor(plainTab.id)[0], 30_000)
  if (!p1) { undetermined('反例-Claude CLI', 'the fake claude never started in the plain Claude CLI tab') } else {
    await sleep(1_000)
    await clickRestart()
    const p2 = await poll(() => runsFor(plainTab.id).find(r => r.base !== p1.base), 30_000)
    if (!p2) undetermined('反例-Claude CLI', 'no new run after ⏻')
    else {
      check('反例-Claude CLI', !p1.meta.args.includes('/control-tower') && !p2.meta.args.some((a: string) => /control-tower/.test(a)), 'plain Claude CLI tab: neither launch nor ⏻ carries `/control-tower`', { first: p1.meta.args.slice(-2), afterRestart: p2.meta.args.slice(-2) })
      check('反例-Claude CLI', !fs.existsSync(`${p2.base}.setrole.json`), 'the plain tab never declared a Tower')
    }
  }
  // ② plain shell tab: typed keys show up right after ⏻ (no launch hold)
  await win!.locator('.workspace-container.active .thumbnail-add-btn').click()
  const known = new Set((await savedTabs()).map(t => t.id))
  await win!.locator('.thumbnail-add-menu-item.has-submenu').first().click()
  const shell = await poll(async () => (await savedTabs()).find(t => !known.has(t.id)), 15_000)
  if (!shell) { undetermined('反例-shell', 'no new shell tab'); return }
  await poll(async () => /\$\s*$/m.test(await outputOf(shell.id)), 20_000)
  await sleep(1_000)
  const mark = (await outputOf(shell.id)).length
  await clickRestart()
  const token = `T0955SHELL${Date.now() % 100000}`
  await term(shell.id, 't.focus(); return true')
  const typedAt = Date.now()
  await win!.keyboard.type(`echo ${token}`, { delay: 15 })
  await win!.keyboard.press('Enter')
  let typedSeenMs = -1
  const echoed = await poll(async () => {
    const o = plain((await outputOf(shell.id)).slice(mark))
    if (typedSeenMs < 0 && o.includes(`echo ${token}`)) typedSeenMs = Date.now() - typedAt
    return o.split(token).length >= 3 ? o : undefined // the typed line + the echo output
  }, 15_000, 50)
  const ms = Date.now() - typedAt
  check('反例-shell', !!echoed && typedSeenMs >= 0, `shell tab: keys typed right after ⏻ appear (typed text visible after ${typedSeenMs} ms, command output after ${ms} ms)`, (echoed ?? plain((await outputOf(shell.id)).slice(mark))).slice(-300))
  items['反例-shell'].note = `tab output ${await saveOutput(shell.id, 'shell-after-restart')}`
  const held = logLines(new RegExp(`\\[agent-command\\] id=${shell.id} `))
  check('反例-shell', held.length === 0, 'no launch hold for the shell tab', held.slice(0, 2))
}

async function towerRolesSnapshot(): Promise<unknown> {
  return readJson(path.join(userData, 'tower-roles.json'))
}

async function a21(): Promise<boolean> {
  const runs = runsFor(towerId)
  const live = runs[runs.length - 1]
  if (!live) { undetermined('A-21', 'no Tower run'); return false }
  const roles = await towerRolesSnapshot()
  log(`tower-roles.json before quit: ${JSON.stringify(roles)}`)
  await quitApp(false)
  const serverPid = readPid(userData)
  const serverAlive = serverPid !== null && isAlive(serverPid)
  const serverCmd = serverPid ? await commandLineOf(serverPid) : ''
  const fakeAlive = isAlive(live.meta.pid)
  log(`after quit: Terminal Server pid=${serverPid} alive=${serverAlive} cmd=${serverCmd.trim().slice(0, 200)}; fake claude pid=${live.meta.pid} alive=${fakeAlive}`)
  if (!serverAlive || !fakeAlive) {
    undetermined('A-21', `quit with the Terminal Server kept did not keep it running (server alive=${serverAlive}, fake claude alive=${fakeAlive}); zip build may not support keeping terminals`)
    return false
  }
  check('A-21', true, 'quit kept the Terminal Server and the Tower tab\'s fake claude running', { serverPid, fakePid: live.meta.pid, towerRoles: roles })
  await launch()
  const prompt = await poll(async () => (await win!.locator('.recovery-prompt-dialog').count()) > 0, 30_000)
  if (!prompt) { undetermined('A-21', 'no Recovery prompt after relaunch'); return true }
  const shotPrompt = await shot('a21-recovery-prompt.png')
  await win!.locator('.recovery-prompt-dialog .btn-primary').click()
  await installCapture()
  const restored = await poll(() => logLines(new RegExp(`\\[tower-role\\] restored: terminal=${towerId.slice(0, 8)}`), true)[0], 30_000)
  check('A-21', !!restored, 'debug log has `[tower-role] restored:`', restored ?? logLines(/\[tower-role\]/, true))
  check('A-21', isAlive(live.meta.pid), 'the same fake claude process is still running in the Tower tab (reattached, not restarted)', { pid: live.meta.pid, runs: runsFor(towerId).length })
  fs.writeFileSync(path.join(DATA, `cmd-${towerId}.json`), JSON.stringify({ op: 'whoami', tag: 'a21' }), 'utf8')
  const who = await poll(() => readJson(`${live.base}.cmd-a21.json`), 30_000)
  const whoami: AnyApi = who?.response?.result?.structuredContent ?? null
  check('A-21', whoami?.role === 'tower' && whoami?.towerContract === 2, 'helper query from the reattached tab (BAT MCP `bat_whoami`): role tower, contract 2',
    whoami ? { role: whoami.role, towerContract: whoami.towerContract, towerMode: whoami.towerMode, text: who?.response?.result?.content?.[0]?.text } : who)
  // the Inbox tab's tower picker (best effort: only when the panel is rendered)
  const inboxName = await win!.locator('.inbox-tower-name').allInnerTexts().catch(() => [] as string[])
  log(`inbox tower name(s): ${JSON.stringify(inboxName)}`)
  if (inboxName.length > 0) check('A-21', !inboxName.some(n => /沒有已宣告的塔台分頁|No declared Tower/i.test(n)), 'Inbox tab does not show「沒有已宣告的塔台分頁」', inboxName)
  items['A-21'].note = `screenshots ${shotPrompt}, ${await shot('a21-after-keep.png')}`
  return true
}

async function a22(): Promise<void> {
  const before = runsFor(towerId)
  await quitApp(false)
  const serverPid = readPid(userData)
  if (serverPid === null || !isAlive(serverPid)) { undetermined('A-22', 'Terminal Server not kept on quit'); await launch(); return }
  await launch()
  const prompt = await poll(async () => (await win!.locator('.recovery-prompt-dialog').count()) > 0, 30_000)
  if (!prompt) { undetermined('A-22', 'no Recovery prompt after relaunch'); return }
  await win!.locator('.recovery-prompt-dialog .btn-secondary').click()
  await installCapture()
  const run = await poll(() => runsFor(towerId).find(r => !before.some(b => b.base === r.base)), 60_000)
  if (!run) { undetermined('A-22', 'the Tower tab did not start a new fake claude after「重新開始」'); return }
  const args: string[] = run.meta.args
  check('A-22', args[args.length - 1] === '/control-tower', 'after「重新開始」the Tower tab starts claude again with `/control-tower` last', args.slice(-3))
  const notRestored = await poll(() => logLines(new RegExp(`\\[tower-role\\] not restored: terminal=${towerId.slice(0, 8)}`), true)[0], 20_000)
  check('A-22', !!notRestored, 'debug log has `[tower-role] not restored`', notRestored ?? logLines(/\[tower-role\]/, true))
  items['A-22'].note = `screenshot ${await shot('a22-after-fresh-start.png')}`
}

// ── main ──
async function main(): Promise<number> {
  fs.mkdirSync(RUN_DIR, { recursive: true })
  fs.mkdirSync(DATA, { recursive: true })
  fs.mkdirSync(path.join(WS_DIR, '_ct-workorders'), { recursive: true })
  fs.mkdirSync(CFG_DIR, { recursive: true })
  // a contract-2 tower state so the Inbox tab has something to judge (frontmatter only)
  fs.writeFileSync(path.join(WS_DIR, '_ct-workorders', '_tower-state.md'), '---\nschema_kind: tower-state\nsummary_version: 1\nbat_contract: 2\n---\n\n# T0955 test tower state\n', 'utf8')
  log(`T0955 driver: exe=${EXE} results=${RESULTS} run=${RUN_DIR}`)
  const version = readJson(path.join(path.dirname(EXE), 'resources', 'package.json'))?.version
  log(`build under test: resources/package.json version=${version}`)
  if (!fs.existsSync(GIT_BASH)) { log(`Git Bash not found: ${GIT_BASH} — BLOCKED`); return 2 }
  const userLayerBefore = userLayerDigest()
  const otherBefore = await otherBatProcesses()
  log(`user layer: ${userLayerBefore.files} files digest=${userLayerBefore.digest}; other BAT processes: ${otherBefore.join(', ')}`)
  await buildFake()

  runtimeId = `e2e-t0955-${Date.now()}`
  remotePort = await freePort()
  seedSettings()
  let exit = 0
  try {
    await launch()
    await seedWorkspace()
    for (const [name, fn] of [['A-19', a19], ['A-20/A-23', a20a23], ['反例', counterExamples]] as const) {
      try { await fn() } catch (err) { log(`${name} threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`); undetermined(name, `driver error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`) }
    }
    let kept = false
    try { kept = await a21() } catch (err) { log(`A-21 threw: ${err instanceof Error ? err.stack : String(err)}`); undetermined('A-21', `driver error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`) }
    if (kept) {
      try { await a22() } catch (err) { log(`A-22 threw: ${err instanceof Error ? err.stack : String(err)}`); undetermined('A-22', `driver error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`) }
    } else undetermined('A-22', 'A-21 could not keep the Terminal Server')
  } finally {
    // logs and tower-roles.json (masked) before the runtime userData is removed
    try {
      const dest = path.join(RUN_DIR, 'logs')
      fs.mkdirSync(dest, { recursive: true })
      for (const f of fs.existsSync(path.join(userData, 'Logs')) ? fs.readdirSync(path.join(userData, 'Logs')) : []) {
        fs.writeFileSync(path.join(dest, f), clean(fs.readFileSync(path.join(userData, 'Logs', f), 'utf8')), 'utf8')
      }
      const roles = path.join(userData, 'tower-roles.json')
      if (fs.existsSync(roles)) fs.copyFileSync(roles, path.join(dest, 'tower-roles.json'))
    } catch (err) { log(`copy logs failed: ${String(err)}`) }
    const serverPid = userData ? readPid(userData) : null
    if (app) await closeIsolated({ app, runtimeId, userData }, log)
    if (serverPid !== null) log(`Terminal Server pid ${serverPid} alive after teardown: ${isAlive(serverPid)}`)
    // fake claude processes left by kept / reattached PTYs: only those started from our fake exe / script, by pid
    const leftovers = await fakeProcesses()
    for (const p of leftovers) {
      const r = await execText('taskkill', ['/T', '/F', '/PID', String(p.pid)])
      log(`ended leftover fake claude pid ${p.pid} (${p.name}): ${r.code === 0 ? 'ok' : r.out.trim()}`)
    }
    const userLayerAfter = userLayerDigest()
    const otherAfter = await otherBatProcesses()
    const changed = Object.keys({ ...userLayerBefore.perFile, ...userLayerAfter.perFile }).filter(f => userLayerBefore.perFile[f] !== userLayerAfter.perFile[f])
    check('隔離', userLayerAfter.digest === userLayerBefore.digest, `user-layer ~/.claude / ~/.codex configuration hashes unchanged (${userLayerBefore.files} files)`, { before: userLayerBefore.digest, after: userLayerAfter.digest, changed })
    check('隔離', JSON.stringify(otherBefore) === JSON.stringify(otherAfter), 'installed BAT processes unchanged (same pids before and after)', { before: otherBefore, after: otherAfter })
    check('隔離', (await fakeProcesses()).length === 0, 'no fake claude process left')
    if (serverPid !== null) check('隔離', !isAlive(serverPid), 'the test instance\'s Terminal Server ended', { serverPid })
    check('隔離', !fs.existsSync(userData), 'the runtime userData was removed', { runtimeId })
    const report = { stamp: STAMP, build: version, runtimeId, items }
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    log(`report: ${REPORT}`)
    for (const [name, it] of Object.entries(items)) {
      log(`== ${name}: ${it.verdict}${it.note ? ` (${it.note})` : ''}`)
      if (it.verdict !== 'PASS') exit = 1
    }
  }
  return exit
}

main().then(code => process.exit(code), err => { log(`driver failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`); process.exit(2) })
