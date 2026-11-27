// T0959 (D460): automated acceptance of a packaged build for BUG-233 (a cursor hidden by the program that ⏻ ended
// stays hidden in the new shell) and BUG-232 (keys typed before the Claude login guide's command). See
// e2e/manual/README.md. R0 (the T0955 set) is a separate run of e2e/manual/t0955-v081-acceptance.ts.
//
// Not a Playwright test (the runner only collects `*.spec.ts`), never run by `npm run test:*`. Runs isolated BATs
// (packaged exe, own `--runtime=e2e-t0959-<phase>-<ts>`, own userData / Terminal Server / remote port, BAT_* / CT_*
// and the driving Claude Code session's variables dropped) with Settings → Claude Runtime = system pointing at the
// T0955 fake `claude.exe` (fallbackToEmbedded off: no model, no network). Never touches an installed BAT, its
// userData or Terminal Server; ends only processes it started (by pid). The user's WSL distro is only used as the
// default `wsl.exe` shell of one tab (nothing installed, configured or written there).
//
// Phases:
//   wsl   Settings → Shell = custom `wsl.exe` (skipped → B233 未判定 when wsl.exe is missing):
//         B233     a program hides the cursor (`ESC[?1049h ESC[?25l`) and keeps running; ⏻ → the new shell's cursor is
//                  visible (xterm `isCursorHidden=false`) and the log has `[mouse-tracking] cursor shown: new-pty-spawned`;
//         control  ⏻ on an idle shell (cursor never hidden) → no `cursor shown` / `cursor state unknown` line.
//   git   Settings → Shell = Git Bash, fake `auth status` answers "logged out":
//         B233-gitbash  the same hidden-cursor ⏻ in a Git Bash tab: cursor visible (no regression); idle ⏻: no line;
//         B232-login    Claude Agent panel shows the "not logged in" guide → 開啟終端 → `abc` typed as soon as the
//                       new PTY exists → input row `<cli> auth login` first, `abc` after, nothing submitted, log
//                       `input before the launch command … sent after it`; control: not typing → command only.
//   B232-install needs a remote profile window; recorded 未判定 (see the report note).
//
// Required env:
//   BAT_E2E_EXECUTABLE   BetterAgentTerminal.exe under test (zip build)
//   T0959_RESULTS        results directory outside the repo
// Optional:
//   T0959_WSL            wsl.exe (default %WINDIR%\System32\wsl.exe)
//   T0959_GIT_BASH       Git Bash (default C:\Program Files\Git\bin\bash.exe)
//   T0959_CSC            csc.exe (default .NET Framework 4 csc under %WINDIR%)
//
// Run (repo root, after npm ci):  node node_modules/tsx/dist/cli.mjs e2e/manual/t0959-v081-pre2-acceptance.ts
// Exit 0 = every determinable item PASS (B232-install is always 未判定), 1 = some item FAIL / other 未判定,
// 2 = usage / setup error. Report: <results>/report-<stamp>.json.

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, freePort, isolatedEnv, readPid, REPO_ROOT } from '../fixtures/electron-isolation'
import { NO_UPDATE_CHECK_SETTINGS } from '../fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) { console.error(`missing env ${name} (see the header of e2e/manual/t0959-v081-pre2-acceptance.ts)`); process.exit(2) }
  return value
}

const EXE = path.resolve(requireEnv('BAT_E2E_EXECUTABLE'))
const RESULTS = path.resolve(requireEnv('T0959_RESULTS'))
const WINDIR = process.env.WINDIR ?? 'C:\\Windows'
const WSL = process.env.T0959_WSL?.trim() || path.join(WINDIR, 'System32', 'wsl.exe')
const GIT_BASH = process.env.T0959_GIT_BASH?.trim() || 'C:\\Program Files\\Git\\bin\\bash.exe'
const CSC = process.env.T0959_CSC?.trim() || path.join(WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
if (process.platform !== 'win32') { console.error('Windows only'); process.exit(2) }
if (!fs.existsSync(EXE)) { console.error(`BAT_E2E_EXECUTABLE not found: ${EXE}`); process.exit(2) }

const pad = (n: number) => String(n).padStart(2, '0')
const d0 = new Date()
const STAMP = `${d0.getFullYear()}${pad(d0.getMonth() + 1)}${pad(d0.getDate())}-${pad(d0.getHours())}${pad(d0.getMinutes())}${pad(d0.getSeconds())}`
const FAKE_DIR = path.join(RESULTS, 'fake')
const FAKE_EXE = path.join(FAKE_DIR, 'claude.exe')
const RUN_DIR = path.join(RESULTS, `run-${STAMP}`)
const DATA = path.join(RUN_DIR, 'fake-data')
const CFG_DIR = path.join(RUN_DIR, 'claude-config')
const SHOTS = path.join(RUN_DIR, 'shots')
const LOG_FILE = path.join(RUN_DIR, 'driver.log')
const REPORT = path.join(RESULTS, `report-${STAMP}.json`)
const HOME = os.homedir()
const USER = os.userInfo().username
const HOST = os.hostname()
const DROP_ENV = ['CLAUDECODE', /^CLAUDE_CODE_/i, 'CLAUDE_PID', 'CLAUDE_EFFORT', 'CLAUDE_PLUGIN_DATA', 'CLAUDE_PLUGIN_ROOT']
/** Distinctive `sleep` lengths, so leftovers can be found by their command line. */
const SLEEP_WSL = 6007
const SLEEP_GIT = 6008
const HIDE_CURSOR = (secs: number) => `printf '\\033[?1049h\\033[?25l'; sleep ${secs}`

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** De-identified text: home directory (Windows and /mnt forms) → <使用者資料夾>, user / host names, BAT tokens masked. */
function clean(text: string): string {
  let t = String(text)
  const drive = HOME.slice(0, 1).toLowerCase()
  const homes = [HOME, HOME.replace(/\\/g, '/'), HOME.replace(/\\/g, '\\\\'), `/mnt/${drive}${HOME.slice(2).replace(/\\/g, '/')}`]
  for (const h of homes) t = t.replace(new RegExp(escapeRe(h), 'gi'), '<使用者資料夾>')
  if (USER.length >= 3) t = t.replace(new RegExp(`\\b${escapeRe(USER)}\\b`, 'gi'), '<user>')
  if (HOST.length >= 3) t = t.replace(new RegExp(`\\b${escapeRe(HOST)}\\b`, 'gi'), '<host>')
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
function note(item: string, text: string): void {
  items[item] ??= { verdict: 'PASS', checks: [] }
  items[item].note = [items[item].note, clean(text)].filter(Boolean).join('; ')
}

// ── user layer and processes (same scope as T0955) ──
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
interface Proc { pid: number; name: string; exe: string; cmd: string }
async function processes(): Promise<Proc[]> {
  const r = await execText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Compress'], 60_000)
  try {
    const arr = JSON.parse(r.out) as AnyApi[]
    return arr.map(p => ({ pid: p.ProcessId, name: p.Name ?? '', exe: p.ExecutablePath ?? '', cmd: p.CommandLine ?? '' }))
  } catch { return [] }
}
/**
 * BAT processes that are not the build under test. `core` = the installed BAT itself (its Electron processes, Terminal
 * Server, PTY holder): must not change. `agents` = claude / node processes whose command line names BetterAgentTerminal
 * (sessions, BAT MCP shims, hooks running in the user's tabs): they start and end while the user works, so a change
 * there is recorded with what the process was, and the driver's own kill log shows it never touched them.
 */
async function otherBatProcesses(): Promise<{ core: string[]; agents: Proc[] }> {
  const testRoot = path.dirname(EXE).toLowerCase()
  const other = (await processes())
    .filter(p => /betteragentterminal/i.test(p.exe) || /BetterAgentTerminal|BAT-PtyHolder/i.test(p.cmd))
    .filter(p => !p.exe.toLowerCase().startsWith(testRoot) && !p.cmd.toLowerCase().includes(testRoot))
  const isCore = (p: Proc) => /^(BetterAgentTerminal|bat-pty-holder)\.exe$/i.test(p.name)
  return {
    core: other.filter(isCore).map(p => `${p.pid}:${p.name}`).sort(),
    agents: other.filter(p => !isCore(p)).sort((a, b) => a.pid - b.pid),
  }
}
/** What an agent-side process was, without user data: name and the script / tool it ran. */
const describeAgent = (p: Proc): string => {
  const script = (p.cmd.match(/[\w.-]+\.(m?js|cjs|exe)\b/gi) ?? []).filter(s => !/^(node|claude)\.exe$/i.test(s)).slice(0, 2).join(' ')
  return `${p.pid}:${p.name}${script ? ` (${script})` : ''}`
}
/** Processes this driver may have left: the fake claude, and the Git Bash `sleep` it typed (by command line). */
async function ownLeftovers(): Promise<Proc[]> {
  const fakeExe = FAKE_EXE.toLowerCase()
  return (await processes()).filter(p => p.exe.toLowerCase() === fakeExe || p.cmd.includes('t0955-fake-claude.mjs')
    || new RegExp(`sleep(\\.exe)?"?\\s+${SLEEP_GIT}\\b`).test(p.cmd))
}
/** Linux-side `sleep <SLEEP_WSL>` started by this driver in the default distro (read-only query). */
async function wslLeftovers(): Promise<number[]> {
  if (!fs.existsSync(WSL)) return []
  const r = await execText(WSL, ['-e', 'pgrep', '-fx', `sleep ${SLEEP_WSL}`], 30_000)
  return r.out.split(/\s+/).filter(s => /^\d+$/.test(s)).map(Number)
}
const isAlive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }

// ── fake claude (the T0955 one; `auth status` → logged out only when control.json asks) ──
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
/** Every recorded fake claude call (interactive argv files and non-interactive ones). */
function fakeCalls(): { file: string; args: string[] }[] {
  if (!fs.existsSync(DATA)) return []
  return fs.readdirSync(DATA).filter(n => /\.(argv|noninteractive|auth-status)\.txt$/.test(n)).sort().map(n => ({
    file: n,
    args: fs.readFileSync(path.join(DATA, n), 'utf8').split('\n').filter(l => /^argv\[\d+\]=/.test(l)).map(l => l.replace(/^argv\[\d+\]=/, '')),
  }))
}
const plain = (raw: string): string => raw
  .replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)/g, '')
  .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
  .replace(/\u001b[@-_]/g, '')

// ── app ──
let app: ElectronApplication | undefined
let win: Page | undefined
let userData = ''
let runtimeId = ''
let remotePort = 0
let wsDir = ''

function seedSettings(shell: Record<string, unknown>): void {
  const dir = path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), `BetterAgentTerminal-runtime-${runtimeId}`)
  if (fs.existsSync(dir)) throw new Error(`runtime directory already exists: ${dir}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({
    ...NO_UPDATE_CHECK_SETTINGS,
    ...shell,
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
  }))
  log(`launched runtime=${runtimeId} port=${remotePort} userData=${userData} env=${JSON.stringify(envCheck)}`)
}
async function installCapture(): Promise<void> {
  await win!.evaluate(() => {
    const w = window as AnyApi
    if (w.__t0959?.installed) return
    w.__t0959 = { installed: true, out: {} as Record<string, string> }
    w.electronAPI.pty.onOutput((id: string, data: string) => { w.__t0959.out[id] = (w.__t0959.out[id] ?? '') + data })
  })
}
const outputOf = (id: string): Promise<string> => win!.evaluate(i => (window as AnyApi).__t0959?.out?.[i] ?? '', id)
async function saveOutput(id: string, name: string): Promise<string> {
  const file = path.join(RUN_DIR, `out-${name}.txt`)
  const raw = await outputOf(id)
  fs.writeFileSync(file, clean(plain(raw)), 'utf8')
  fs.writeFileSync(`${file}.raw`, clean(raw), 'utf8')
  return path.relative(RESULTS, file)
}

// Renderer snippet: `found[terminalId]` = that tab's xterm Terminal (from the TerminalPanel fiber's refs, as T0955).
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
interface TermState { type: string; mouse: string; cursorHidden: boolean | null; baseY: number; cursorY: number; cursorX: number }
const termState = (id: string) => term<TermState>(id, `const b = t.buffer.active
  return { type: b.type, mouse: t.modes.mouseTrackingMode, cursorHidden: t._core?.coreService?.isCursorHidden ?? null,
    baseY: b.baseY, cursorY: b.cursorY, cursorX: b.cursorX }`)
/** The xterm row the cursor is on, with the rows it wraps from joined. */
const cursorRowText = (id: string) => term<string>(id, `const b = t.buffer.active; let y = b.baseY + b.cursorY
  let s = ''; let r = b.getLine(y); const rows = []
  while (r) { rows.unshift(r.translateToString(true)); if (!r.isWrapped || y === 0) break; y--; r = b.getLine(y) }
  return rows.join('')`)

interface SavedTab { id: string; title?: string; agentPreset?: string; type?: string }
async function savedTabs(): Promise<SavedTab[]> {
  const raw = await win!.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? (JSON.parse(raw) as { terminals: SavedTab[] }).terminals : []
}
async function addFromMenu(name: RegExp): Promise<SavedTab> {
  const known = new Set((await savedTabs()).map(t => t.id))
  await win!.locator('.workspace-container.active .thumbnail-add-btn').click()
  const item = win!.locator('.thumbnail-add-menu-item:not(.disabled)', { hasText: name }).first()
  await item.waitFor({ state: 'visible', timeout: 10_000 })
  await item.click()
  const tab = await poll(async () => (await savedTabs()).find(t => !known.has(t.id)), 15_000)
  if (!tab) throw new Error(`no new tab after clicking ${name}`)
  return tab
}
async function addShellTab(): Promise<SavedTab> {
  const known = new Set((await savedTabs()).map(t => t.id))
  await win!.locator('.workspace-container.active .thumbnail-add-btn').click()
  await win!.locator('.thumbnail-add-menu-item.has-submenu').first().click()
  const tab = await poll(async () => (await savedTabs()).find(t => !known.has(t.id)), 15_000)
  if (!tab) throw new Error('no new shell tab')
  return tab
}
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
const debugLogText = (): string => {
  const dir = path.join(userData, 'Logs')
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') : ''
}
const logLines = (re: RegExp) => debugLogText().split('\n').filter(l => re.test(l))
const cursorLines = (id: string) => logLines(new RegExp(`\\[mouse-tracking\\] cursor (shown|state unknown): new-pty-spawned terminal=${id}`))
const PROMPT_RE = /\$\s*$/

async function seedWorkspace(wsId: string, shellTabId: string): Promise<void> {
  await poll(async () => (await win!.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, 30_000)
  const seed = {
    workspaces: [{ id: wsId, name: 'T0959', folderPath: wsDir, createdAt: Date.now() }],
    activeWorkspaceId: wsId,
    activeGroup: null,
    terminals: [{ id: shellTabId, workspaceId: wsId, type: 'terminal', title: 'New Terminal', cwd: wsDir }],
    activeTerminalId: shellTabId,
  }
  const ok = await win!.evaluate(async data => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))
  if (ok !== true) throw new Error('workspace.save failed')
  await win!.reload()
  await win!.waitForLoadState('domcontentloaded')
  await win!.locator('.workspace-container.active .terminal-wrapper').first().waitFor({ timeout: 30_000 })
  await installCapture()
}
async function waitPrompt(id: string, from: number, timeoutMs = 30_000): Promise<boolean> {
  return !!(await poll(async () => PROMPT_RE.test(plain((await outputOf(id)).slice(from))), timeoutMs, 100))
}
async function typeLine(id: string, text: string): Promise<void> {
  await term(id, 't.focus(); return true')
  await win!.keyboard.type(text, { delay: 10 })
  await win!.keyboard.press('Enter')
}

/**
 * BUG-233 core: a program hides the cursor in the alt screen and keeps running; ⏻; the new shell's cursor must be
 * visible and (when `expectLog`) the log must have `cursor shown: new-pty-spawned`. Then ⏻ on the idle shell: no line.
 */
async function hiddenCursorRestart(item: string, controlItem: string, id: string, sleepSecs: number, expectLog: boolean, shotPrefix: string): Promise<void> {
  if (!(await waitPrompt(id, 0, 60_000))) { undetermined(item, 'the shell prompt never appeared'); undetermined(controlItem, 'no shell prompt'); return }
  await sleep(500)
  // control first: ⏻ on an idle shell whose cursor was never hidden
  const st0 = await termState(id)
  const linesBefore0 = cursorLines(id).length
  let mark = (await outputOf(id)).length
  await clickRestart()
  const prompt0 = await waitPrompt(id, mark, 60_000)
  await sleep(1_500)
  const st0b = await termState(id)
  check(controlItem, st0?.cursorHidden === false, 'before ⏻ the idle shell\'s cursor is visible', st0)
  check(controlItem, prompt0, 'the new shell after ⏻ shows a prompt')
  check(controlItem, cursorLines(id).length === linesBefore0, 'no `cursor shown` / `cursor state unknown` log line for this ⏻', cursorLines(id).slice(linesBefore0))
  check(controlItem, st0b?.cursorHidden === false, 'cursor visible after ⏻', st0b)

  // the program hides the cursor and keeps running
  mark = (await outputOf(id)).length
  await typeLine(id, HIDE_CURSOR(sleepSecs))
  const hidden = await poll(async () => { const s = await termState(id); return s?.cursorHidden === true ? s : undefined }, 15_000, 100)
  check(item, !!hidden, `setup: \`${HIDE_CURSOR(sleepSecs)}\` hid the cursor (xterm isCursorHidden=true) and is still running`, hidden ?? await termState(id))
  const shotHidden = await shot(`${shotPrefix}-hidden-before-restart.png`)
  const linesBefore = cursorLines(id).length
  mark = (await outputOf(id)).length
  await clickRestart()
  const prompt = await waitPrompt(id, mark, 60_000)
  await sleep(1_500)
  const st = await termState(id)
  check(item, prompt, 'the new shell after ⏻ shows a prompt')
  check(item, st?.cursorHidden === false, 'after ⏻ the new shell\'s cursor is visible (xterm isCursorHidden=false)', st)
  check(item, st?.type === 'normal', 'after ⏻ xterm is in the normal buffer', st?.type)
  const newLines = cursorLines(id).slice(linesBefore)
  const shown = newLines.filter(l => /cursor shown: new-pty-spawned/.test(l))
  if (expectLog) check(item, shown.length > 0, 'debug log has `[mouse-tracking] cursor shown: new-pty-spawned terminal=<id>`', newLines)
  else note(item, `cursor log lines for this ⏻: ${newLines.length ? newLines.map(l => l.replace(/^.*\[mouse-tracking\]/, '[mouse-tracking]')).join(' | ') : 'none'}`)
  const leftAlt = logLines(new RegExp(`\\[mouse-tracking\\] alt screen left: new-pty-spawned terminal=${id}`))
  note(item, `alt screen left log lines: ${leftAlt.length}`)
  // did the new shell (or ConPTY) show the cursor by itself? (forensic: tells whether the fix was what made it visible)
  const after = (await outputOf(id)).slice(mark)
  note(item, `new shell's own output after ⏻ contains ESC[?25h: ${after.includes('\u001b[?25h')}; contains ESC[?25l: ${after.includes('\u001b[?25l')}`)
  // the shell works: typing shows up
  const token = `T0959OK${Date.now() % 100000}`
  const m2 = (await outputOf(id)).length
  await typeLine(id, `echo ${token}`)
  const echoed = await poll(async () => plain((await outputOf(id)).slice(m2)).split(token).length >= 3, 15_000, 100)
  check(item, !!echoed, 'the new shell takes input after ⏻ (echo round trip)')
  note(item, `screenshots ${shotHidden}, ${await shot(`${shotPrefix}-after-restart.png`)}; tab output ${await saveOutput(id, shotPrefix)}`)
}

async function quitAndCleanup(phase: string): Promise<void> {
  try {
    const dest = path.join(RUN_DIR, `logs-${phase}`)
    fs.mkdirSync(dest, { recursive: true })
    for (const f of fs.existsSync(path.join(userData, 'Logs')) ? fs.readdirSync(path.join(userData, 'Logs')) : []) {
      fs.writeFileSync(path.join(dest, f), clean(fs.readFileSync(path.join(userData, 'Logs', f), 'utf8')), 'utf8')
    }
  } catch (err) { log(`copy logs failed: ${String(err)}`) }
  const serverPid = userData ? readPid(userData) : null
  if (app) await closeIsolated({ app, runtimeId, userData }, log)
  app = undefined
  await sleep(1_000)
  if (serverPid !== null) check('隔離', !isAlive(serverPid), `${phase}: the test instance's Terminal Server ended`, { serverPid })
  check('隔離', !fs.existsSync(userData), `${phase}: the runtime userData was removed`, { runtimeId })
}

// ── phases ──
async function phaseWsl(): Promise<void> {
  if (!fs.existsSync(WSL)) {
    undetermined('B233', `wsl.exe not found (${WSL})`)
    undetermined('B233-對照（WSL 閒置 ⏻）', 'wsl.exe not found')
    return
  }
  const distros = await execText(WSL, ['-l', '-q'])
  log(`wsl.exe present; default distro listing exit=${distros.code}`)
  runtimeId = `e2e-t0959-wsl-${Date.now()}`
  remotePort = await freePort()
  wsDir = path.join(RUN_DIR, 'ws-wsl')
  fs.mkdirSync(wsDir, { recursive: true })
  seedSettings({ shell: 'custom', customShellPath: WSL })
  try {
    await launch()
    const id = 'shell-t0959-wsl'
    await seedWorkspace('ws-t0959-wsl', id)
    await hiddenCursorRestart('B233', 'B233-對照（WSL 閒置 ⏻）', id, SLEEP_WSL, true, 'b233-wsl')
  } catch (err) {
    log(`WSL phase threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
    undetermined('B233', `driver error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`)
  } finally {
    await quitAndCleanup('wsl')
  }
}

async function b232Login(): Promise<void> {
  setControl({ fullscreen: false, authStatus: 'loggedOut' })
  const panel = await addFromMenu(/Claude Agent/)
  log(`claude agent tab: ${JSON.stringify(panel)}`)
  const guide = win!.locator('.claude-login-guide').first()
  const shown = await guide.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false)
  const authCalls = fakeCalls().filter(c => c.args.join(' ') === 'auth status')
  check('B232-login', shown, 'setup: the Claude Agent panel shows the "not logged in" guide (fake `auth status` → loggedIn false)', { authStatusCalls: authCalls.length, authLog: logLines(/\[auth-status\]/).slice(-2) })
  if (!shown) { undetermined('B232-login', 'the Claude Agent panel never showed the "not logged in" guide'); return }
  const shotGuide = await shot('b232-login-guide.png')

  const openLogin = async (): Promise<SavedTab> => {
    const known = new Set((await savedTabs()).map(t => t.id))
    await win!.locator('.claude-login-guide-btn.primary').first().click()
    const tab = await poll(async () => (await savedTabs()).find(t => !known.has(t.id)), 15_000, 50)
    if (!tab) throw new Error('no login terminal tab after 開啟終端')
    return tab
  }
  const callsBefore = fakeCalls().length
  const tab = await openLogin()
  const openedAt = Date.now()
  // type as soon as the new PTY exists (ConPTY's first output), before the command (500 ms after the PTY is created)
  await poll(async () => (await term<boolean>(tab.id, 'return true')) === true, 10_000, 20)
  await term(tab.id, 't.focus(); return true')
  const newPty = await poll(async () => (await outputOf(tab.id)).includes('\u001b[?9001h'), 20_000, 20)
  const typedAt = Date.now()
  await win!.keyboard.type('abc', { delay: 20 })
  const commandAt = await poll(async () => (plain(await outputOf(tab.id)).includes('auth login') ? Date.now() : 0), 20_000, 20)
  log(`login tab ${tab.id}: typed abc ${typedAt - openedAt} ms after the tab appeared (new PTY output seen: ${!!newPty}); command visible ${commandAt ? commandAt - typedAt : '?'} ms after typing`)
  await sleep(4_000)
  const typedLine = logLines(new RegExp(`\\[T0402\\] login terminal=${tab.id} typed: `))[0] ?? ''
  const command = typedLine.replace(/^.*typed: /, '').trim()
  check('B232-login', command.endsWith('auth login'), 'debug log `[T0402] login terminal=<id> typed: <cli> auth login`', typedLine.replace(/^.*\[T0402\]/, '[T0402]'))
  const row = (await cursorRowText(tab.id)) ?? ''
  const iCmd = row.indexOf('auth login')
  const iAbc = row.indexOf('abc')
  check('B232-login', iCmd >= 0 && iAbc > iCmd && row.trimEnd().endsWith('auth loginabc'), 'input row: `<cli> auth login` first, `abc` after it', row)
  check('B232-login', row.indexOf('abc') === row.lastIndexOf('abc') && (iAbc === -1 || iAbc > iCmd), '`abc` is not in front of the command', row)
  const held = logLines(new RegExp(`\\[agent-command\\] id=${tab.id} input before the launch command: .* sent after it`))
  check('B232-login', held.length > 0, 'debug log has `[agent-command] … input before the launch command … sent after it`', held[0]?.replace(/^.*\[agent-command\]/, '[agent-command]') ?? 'missing')
  const loginCalls = fakeCalls().slice(callsBefore).filter(c => c.args.includes('login'))
  const afterCmd = plain(await outputOf(tab.id)).split('auth login').slice(1).join('auth login')
  check('B232-login', loginCalls.length === 0 && !/[\r\n]/.test(afterCmd.replace(/^abc/, '')), 'nothing submitted (no Enter): the fake claude never ran `auth login`, no new line after the input row', { loginCalls: loginCalls.map(c => c.file), afterCommand: afterCmd.slice(0, 80) })
  const st = await termState(tab.id)
  note('B232-login', `screenshots ${shotGuide}, ${await shot('b232-login-typed.png')}; tab output ${await saveOutput(tab.id, 'b232-login')}; cursor at row ${st?.cursorY} col ${st?.cursorX}`)

  // control: open the login terminal again and do not type → only the command, no hold line
  await win!.locator('.workspace-container.active .thumbnail').filter({ has: win!.locator('.thumbnail-title', { hasText: /Claude Agent/ }) }).first().click().catch(() => undefined)
  const guideAgain = await win!.locator('.claude-login-guide-btn.primary').first().waitFor({ state: 'visible', timeout: 10_000 }).then(() => true, () => false)
  if (!guideAgain) { undetermined('B232-login-對照（不打字）', 'could not get back to the Claude Agent panel\'s guide'); return }
  const tab2 = await openLogin()
  await sleep(4_000)
  const row2 = (await cursorRowText(tab2.id)) ?? ''
  check('B232-login-對照（不打字）', row2.trimEnd().endsWith('auth login'), 'not typing: the input row ends with the command only', row2)
  const held2 = logLines(new RegExp(`\\[agent-command\\] id=${tab2.id} `))
  check('B232-login-對照（不打字）', held2.length === 0, 'no input-hold line for this tab', held2.slice(0, 2))
  note('B232-login-對照（不打字）', `tab output ${await saveOutput(tab2.id, 'b232-login-control')}`)
}

async function phaseGit(): Promise<void> {
  if (!fs.existsSync(GIT_BASH)) {
    for (const i of ['B233-gitbash（不回歸）', 'B233-gitbash-對照（閒置 ⏻）', 'B232-login']) undetermined(i, `Git Bash not found (${GIT_BASH})`)
    return
  }
  runtimeId = `e2e-t0959-git-${Date.now()}`
  remotePort = await freePort()
  wsDir = path.join(RUN_DIR, 'ws-git')
  fs.mkdirSync(wsDir, { recursive: true })
  seedSettings({ shell: 'git-bash' })
  try {
    await launch()
    const id = 'shell-t0959-git'
    await seedWorkspace('ws-t0959-git', id)
    try { await hiddenCursorRestart('B233-gitbash（不回歸）', 'B233-gitbash-對照（閒置 ⏻）', id, SLEEP_GIT, false, 'b233-gitbash') } catch (err) {
      log(`B233-gitbash threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
      undetermined('B233-gitbash（不回歸）', `driver error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`)
    }
    try { await b232Login() } catch (err) {
      log(`B232-login threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
      undetermined('B232-login', `driver error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`)
    }
  } catch (err) {
    log(`Git Bash phase threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
    undetermined('B232-login', `driver error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`)
  } finally {
    await quitAndCleanup('git')
  }
}

// ── main ──
async function main(): Promise<number> {
  fs.mkdirSync(RUN_DIR, { recursive: true })
  fs.mkdirSync(DATA, { recursive: true })
  fs.mkdirSync(CFG_DIR, { recursive: true })
  log(`T0959 driver: exe=${EXE} results=${RESULTS} run=${RUN_DIR}`)
  const version = JSON.parse(fs.readFileSync(path.join(path.dirname(EXE), 'resources', 'package.json'), 'utf8')).version
  log(`build under test: resources/package.json version=${version}`)
  const userLayerBefore = userLayerDigest()
  const otherBefore = await otherBatProcesses()
  const wslBefore = await wslLeftovers()
  log(`user layer: ${userLayerBefore.files} files digest=${userLayerBefore.digest}; installed BAT core: ${otherBefore.core.join(', ')}; agent-side: ${otherBefore.agents.length}; wsl sleep ${SLEEP_WSL} before: ${wslBefore.length}`)
  await buildFake()
  setControl({ fullscreen: false })
  let exit = 0
  try {
    await phaseWsl()
    await phaseGit()
    undetermined('B232-install', 'needs a remote profile window. The only ways to get one on this machine change the user\'s WSL: the WSL profile wizard installs the server bundle and a systemd user unit into the distro, and a hand-run bat-server would also live in it; the tool install itself then runs a real installer on that host. The work order forbids touching the user\'s WSL distro / systemd unit / bat-server.')
  } finally {
    const leftovers = await ownLeftovers()
    for (const p of leftovers) {
      const r = await execText('taskkill', ['/T', '/F', '/PID', String(p.pid)])
      log(`ended leftover pid ${p.pid} (${p.name}): ${r.code === 0 ? 'ok' : r.out.trim()}`)
    }
    const wslAfter = (await wslLeftovers()).filter(pid => !wslBefore.includes(pid))
    for (const pid of wslAfter) {
      const r = await execText(WSL, ['-e', 'kill', String(pid)])
      log(`ended leftover WSL sleep ${SLEEP_WSL} pid ${pid}: exit ${r.code}`)
    }
    const userLayerAfter = userLayerDigest()
    const otherAfter = await otherBatProcesses()
    const changed = Object.keys({ ...userLayerBefore.perFile, ...userLayerAfter.perFile }).filter(f => userLayerBefore.perFile[f] !== userLayerAfter.perFile[f])
    check('隔離', userLayerAfter.digest === userLayerBefore.digest, `user-layer ~/.claude / ~/.codex configuration hashes unchanged (${userLayerBefore.files} files)`, { before: userLayerBefore.digest, after: userLayerAfter.digest, changed })
    check('隔離', JSON.stringify(otherBefore.core) === JSON.stringify(otherAfter.core), 'installed BAT core processes unchanged (Electron / Terminal Server / PTY holder, same pids before and after)', { before: otherBefore.core, after: otherAfter.core })
    const pidsAfter = new Set(otherAfter.agents.map(p => p.pid))
    const pidsBefore = new Set(otherBefore.agents.map(p => p.pid))
    const gone = otherBefore.agents.filter(p => !pidsAfter.has(p.pid)).map(describeAgent)
    const started = otherAfter.agents.filter(p => !pidsBefore.has(p.pid)).map(describeAgent)
    note('隔離', `installed BAT agent-side processes: ${otherBefore.agents.length} before, ${otherAfter.agents.length} after; ended meanwhile: ${gone.join(', ') || 'none'}; started meanwhile: ${started.join(', ') || 'none'} (the driver only ends its own leftovers, listed as "ended leftover" in driver.log)`)
    check('隔離', (await ownLeftovers()).length === 0, 'no fake claude / Git Bash sleep process left')
    check('隔離', (await wslLeftovers()).filter(pid => !wslBefore.includes(pid)).length === 0, `no WSL \`sleep ${SLEEP_WSL}\` left`, { endedByDriver: wslAfter })
    const report = { stamp: STAMP, build: version, items }
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    log(`report: ${REPORT}`)
    for (const [name, it] of Object.entries(items)) {
      log(`== ${name}: ${it.verdict}${it.note ? ` (${it.note})` : ''}`)
      if (it.verdict === 'FAIL' || (it.verdict === '未判定' && name !== 'B232-install')) exit = 1
    }
  }
  return exit
}

main().then(code => process.exit(code), err => { log(`driver failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`); process.exit(2) })
