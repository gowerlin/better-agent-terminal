// T0963 (BUG-234): does what the keyboard types reach a tab's PTY? Runs one isolated BAT build (packaged exe, own
// `--runtime=e2e-t0963-<ts>`, own userData / Terminal Server / remote port, BAT_* / CT_* and the driving Claude Code
// session's variables dropped) with Settings → Shell = Git Bash and Claude Runtime = system pointing at the T0955
// fake `claude.exe` (fullscreen: alt screen + any-motion mouse tracking + hidden cursor, like the claude TUI; every
// stdin chunk logged). Never touches an installed BAT, its userData or Terminal Server; ends only what it started.
//
// Cases (each: keys typed with Playwright's keyboard into the focused xterm, then a paste through xterm):
//   shell        the seeded Git Bash tab: `echo <token>` + Enter → echoed by the shell
//   claude       a new "Claude CLI" tab (fake claude): `abc` + Enter → the fake's stdin log has `abc` and `\r`
//   claude-⏻     the same tab after ⏻ (a new PTY, the launch command typed again)
//   shell-2      a second Git Bash tab opened after the Claude CLI tab
//
// Not a Playwright test, never run by `npm run test:*`. Required env: BAT_E2E_EXECUTABLE, T0963_RESULTS (outside
// the repo). Optional: T0963_GIT_BASH, T0963_CSC. Run (repo root, after npm ci):
//   node node_modules/tsx/dist/cli.mjs e2e/manual/t0963-keyboard-repro.ts
// Exit 0 = every case PASS, 1 = some case FAIL / 未判定, 2 = usage / setup error. Report: <results>/report-<stamp>.json.

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, freePort, isolatedEnv, NO_UPDATE_CHECK_SETTINGS, REPO_ROOT } from '../fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) { console.error(`missing env ${name} (see the header of e2e/manual/t0963-keyboard-repro.ts)`); process.exit(2) }
  return value
}
const EXE = path.resolve(requireEnv('BAT_E2E_EXECUTABLE'))
const RESULTS = path.resolve(requireEnv('T0963_RESULTS'))
const WINDIR = process.env.WINDIR ?? 'C:\\Windows'
const GIT_BASH = process.env.T0963_GIT_BASH?.trim() || 'C:\\Program Files\\Git\\bin\\bash.exe'
const CSC = process.env.T0963_CSC?.trim() || path.join(WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
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
const LOG_FILE = path.join(RUN_DIR, 'driver.log')
const REPORT = path.join(RESULTS, `report-${STAMP}.json`)
const HOME = os.homedir()
const DROP_ENV = ['CLAUDECODE', /^CLAUDE_CODE_/i, 'CLAUDE_PID', 'CLAUDE_EFFORT', 'CLAUDE_PLUGIN_DATA', 'CLAUDE_PLUGIN_ROOT']

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function clean(text: string): string {
  let t = String(text)
  for (const h of [HOME, HOME.replace(/\\/g, '/'), HOME.replace(/\\/g, '\\\\')]) t = t.replace(new RegExp(escapeRe(h), 'gi'), '<使用者資料夾>')
  return t.replace(/batcap\.[A-Za-z0-9._~+/=-]+/g, 'batcap.<masked>')
}
function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${clean(message)}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8')
}
async function poll<T>(fn: () => T | Promise<T>, timeoutMs: number, intervalMs = 200): Promise<T | undefined> {
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
    execFile(file, args, { timeout, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof (err as AnyApi).code === 'number' ? (err as AnyApi).code : 1) : 0, out: `${stdout}${stderr}` })
    })
  })
}
const plain = (raw: string): string => raw
  .replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)/g, '')
  .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
  .replace(/\u001b[@-_]/g, '')

type Verdict = 'PASS' | 'FAIL' | '未判定'
const items: Record<string, { verdict: Verdict; checks: { ok: boolean; what: string; evidence?: string }[]; note?: string }> = {}
function check(item: string, ok: boolean, what: string, evidence?: unknown): boolean {
  items[item] ??= { verdict: 'PASS', checks: [] }
  const ev = evidence === undefined ? undefined : clean(typeof evidence === 'string' ? evidence : JSON.stringify(evidence)).slice(0, 1500)
  items[item].checks.push({ ok, what, ...(ev !== undefined ? { evidence: ev } : {}) })
  if (!ok && items[item].verdict === 'PASS') items[item].verdict = 'FAIL'
  log(`${ok ? 'PASS' : 'FAIL'} ${item}: ${what}${ev !== undefined ? ` — ${ev.slice(0, 300)}` : ''}`)
  return ok
}
function undetermined(item: string, reason: string): void {
  items[item] ??= { verdict: 'PASS', checks: [] }
  items[item].verdict = '未判定'
  items[item].note = clean(reason)
  log(`未判定 ${item}: ${reason}`)
}

async function buildFake(): Promise<void> {
  fs.mkdirSync(FAKE_DIR, { recursive: true })
  const src = path.join(REPO_ROOT, 'e2e', 'manual', 't0955-fake-claude.cs')
  const r = await execText(CSC, ['/nologo', '/target:exe', `/out:${FAKE_EXE}`, src], 120_000)
  if (r.code !== 0) throw new Error(`csc failed: ${r.out}`)
  fs.writeFileSync(path.join(FAKE_DIR, 'fake-claude.cfg'),
    [process.execPath, path.join(REPO_ROOT, 'e2e', 'manual', 't0955-fake-claude.mjs'), DATA].join('\n') + '\n', 'utf8')
}
/** The fake claude runs whose meta says they belong to terminal `id`, newest last. */
function fakeRunsOf(id: string): string[] {
  if (!fs.existsSync(DATA)) return []
  return fs.readdirSync(DATA).filter(n => n.endsWith('.meta.json')).sort().filter(n => {
    try { return JSON.parse(fs.readFileSync(path.join(DATA, n), 'utf8')).terminalId === id } catch { return false }
  }).map(n => path.join(DATA, n.replace(/\.meta\.json$/, '')))
}
const fakeStdin = (base: string): string => {
  const f = `${base}.stdin.log`
  if (!fs.existsSync(f)) return ''
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => Buffer.from(l.split(' ')[1] ?? '', 'base64').toString('utf8')).join('')
}

let app: ElectronApplication | undefined
let win: Page | undefined
let userData = ''
let runtimeId = ''

async function installCapture(): Promise<void> {
  await win!.evaluate(() => {
    const w = window as AnyApi
    if (w.__t0963?.installed) return
    w.__t0963 = { installed: true, out: {} as Record<string, string> }
    w.electronAPI.pty.onOutput((id: string, data: string) => { w.__t0963.out[id] = (w.__t0963.out[id] ?? '') + data })
  })
}
const outputOf = (id: string): Promise<string> => win!.evaluate(i => (window as AnyApi).__t0963?.out?.[i] ?? '', id)
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
/** Where the keyboard focus is, and xterm's input-related state for tab `id`. */
const focusState = (id: string) => term<Record<string, unknown>>(id, `
  const ta = t.textarea; const core = t._core
  const ch = core && core._compositionHelper
  return { activeIsTextarea: document.activeElement === ta, active: document.activeElement && (document.activeElement.className || document.activeElement.tagName),
    disableStdin: t.options.disableStdin, cursorHidden: core && core.coreService ? core.coreService.isCursorHidden : null,
    composing: ch ? !!ch._isComposing : null, sendingComposition: ch ? !!ch._isSendingComposition : null,
    buffer: t.buffer.active.type, mouse: t.modes.mouseTrackingMode }`)

interface SavedTab { id: string; title?: string; agentPreset?: string }
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
async function clickRestart(): Promise<void> {
  await win!.locator('.main-panel button.action-btn.danger:visible', { hasText: '⏻' }).first().click()
  await win!.locator('.dialog-btn.confirm.danger').click()
}
const debugLogText = (): string => {
  const dir = path.join(userData, 'Logs')
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') : ''
}
const logLines = (re: RegExp) => debugLogText().split('\n').filter(l => re.test(l))

/** Shell tab: keys, then a paste; both must be echoed by the shell. */
async function shellCase(item: string, id: string): Promise<void> {
  const prompt = await poll(async () => /\$\s*$/.test(plain(await outputOf(id))), 60_000, 100)
  if (!prompt) { undetermined(item, 'the shell prompt never appeared'); return }
  await sleep(800)
  await term(id, 't.focus(); return true')
  check(item, true, 'focus state before typing', await focusState(id))
  const token = `KBD${Date.now() % 100000}`
  let mark = (await outputOf(id)).length
  await win!.keyboard.type(`echo ${token}`, { delay: 15 })
  await win!.keyboard.press('Enter')
  const typed = await poll(async () => plain((await outputOf(id)).slice(mark)).split(token).length >= 3, 15_000, 100)
  check(item, !!typed, 'keyboard: `echo <token>` + Enter is echoed and run by the shell', plain((await outputOf(id)).slice(mark)).slice(-300))
  const ptoken = `PST${Date.now() % 100000}`
  mark = (await outputOf(id)).length
  await term(id, `t.paste(${JSON.stringify(`echo ${ptoken}`)}); return true`)
  await win!.keyboard.press('Enter')
  const pasted = await poll(async () => plain((await outputOf(id)).slice(mark)).split(ptoken).length >= 3, 15_000, 100)
  check(item, !!pasted, 'paste: `echo <token>` pasted + Enter is run by the shell', plain((await outputOf(id)).slice(mark)).slice(-300))
}

/** Claude CLI tab (fake claude): keys, then a paste, must reach the fake's stdin. */
async function claudeCase(item: string, id: string, runsBefore: number): Promise<void> {
  const base = await poll(() => {
    const runs = fakeRunsOf(id)
    return runs.length > runsBefore && fs.existsSync(`${runs[runs.length - 1]}.state.json`) ? runs[runs.length - 1] : undefined
  }, 60_000, 200)
  if (!base) { undetermined(item, 'the fake claude never started in the tab'); return }
  await sleep(1_500)
  await term(id, 't.focus(); return true')
  check(item, true, 'focus state before typing', await focusState(id))
  const before = fakeStdin(base).length
  await win!.keyboard.type('abc', { delay: 30 })
  await win!.keyboard.press('Enter')
  const typed = await poll(() => { const s = fakeStdin(base).slice(before); return s.includes('abc') && s.includes('\r') ? s : undefined }, 8_000, 100)
  check(item, !!typed, 'keyboard: `abc` + Enter reaches the fake claude\'s stdin', JSON.stringify(fakeStdin(base).slice(before).slice(-200)))
  const mid = fakeStdin(base).length
  await term(id, 't.paste("PASTEDTEXT"); return true')
  const pasted = await poll(() => fakeStdin(base).slice(mid).includes('PASTEDTEXT'), 8_000, 100)
  check(item, !!pasted, 'paste: the pasted text reaches the fake claude\'s stdin', JSON.stringify(fakeStdin(base).slice(mid).slice(-200)))
  check(item, true, 'focus state after typing', await focusState(id))
  const agentLines = logLines(new RegExp(`\\[agent-command\\] id=${id} `)).map(l => l.replace(/^.*\[agent-command\]/, '[agent-command]'))
  check(item, true, 'host input-hold log lines for this tab', agentLines)
}

async function main(): Promise<number> {
  fs.mkdirSync(DATA, { recursive: true })
  fs.mkdirSync(CFG_DIR, { recursive: true })
  const version = JSON.parse(fs.readFileSync(path.join(path.dirname(EXE), 'resources', 'package.json'), 'utf8')).version
  log(`T0963 driver: build=${version} exe=${EXE} run=${RUN_DIR}`)
  if (!fs.existsSync(GIT_BASH)) { console.error(`Git Bash not found: ${GIT_BASH}`); return 2 }
  await buildFake()
  fs.writeFileSync(path.join(DATA, 'control.json'), JSON.stringify({ fullscreen: true }), 'utf8')
  runtimeId = `e2e-t0963-${Date.now()}`
  const remotePort = await freePort()
  const wsDir = path.join(RUN_DIR, 'ws')
  fs.mkdirSync(wsDir, { recursive: true })
  const settingsDir = path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), `BetterAgentTerminal-runtime-${runtimeId}`)
  if (fs.existsSync(settingsDir)) throw new Error(`runtime directory already exists: ${settingsDir}`)
  fs.mkdirSync(settingsDir, { recursive: true })
  fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({
    ...NO_UPDATE_CHECK_SETTINGS, shell: 'git-bash',
    claudeRuntime: { mode: 'system', customPath: FAKE_EXE, fallbackToEmbedded: false },
  }), { flag: 'wx' })
  let exit = 0
  try {
    const env = isolatedEnv(remotePort, { CLAUDE_CONFIG_DIR: CFG_DIR }, DROP_ENV)
    app = await electron.launch({ executablePath: EXE.replace(/\\/g, '/'), args: [`--runtime=${runtimeId}`], env })
    userData = await app.evaluate(({ app: a }) => a.getPath('userData'))
    if (!path.basename(userData).includes(`-runtime-${runtimeId}`)) throw new Error(`unexpected userData ${userData}`)
    win = await app.firstWindow()
    await poll(() => !/^(about:blank)?$/.test(win!.url()), 30_000)
    await win.waitForLoadState('domcontentloaded')
    await poll(async () => (await win!.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, 30_000)
    const shellId = 'shell-t0963'
    const seed = {
      workspaces: [{ id: 'ws-t0963', name: 'T0963', folderPath: wsDir, createdAt: Date.now() }],
      activeWorkspaceId: 'ws-t0963', activeGroup: null,
      terminals: [{ id: shellId, workspaceId: 'ws-t0963', type: 'terminal', title: 'New Terminal', cwd: wsDir }],
      activeTerminalId: shellId,
    }
    if (await win.evaluate(async d => (window as AnyApi).electronAPI.workspace.save(d), JSON.stringify(seed)) !== true) throw new Error('workspace.save failed')
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await win.locator('.workspace-container.active .terminal-wrapper').first().waitFor({ timeout: 30_000 })
    await installCapture()

    try { await shellCase('shell', shellId) } catch (err) { undetermined('shell', String(err)) }
    try {
      const tab = await addFromMenu(/^\W*Claude CLI(?!\s*\()/)
      log(`claude cli tab ${JSON.stringify(tab)}`)
      await claudeCase('claude', tab.id, 0)
      const runs = fakeRunsOf(tab.id).length
      await clickRestart()
      await claudeCase('claude-⏻', tab.id, runs)
    } catch (err) { undetermined('claude', String(err)) }
    try {
      const tab2 = await addShellTab()
      await shellCase('shell-2', tab2.id)
    } catch (err) { undetermined('shell-2', String(err)) }
  } finally {
    try {
      const dest = path.join(RUN_DIR, 'logs')
      fs.mkdirSync(dest, { recursive: true })
      for (const f of fs.existsSync(path.join(userData, 'Logs')) ? fs.readdirSync(path.join(userData, 'Logs')) : []) {
        fs.writeFileSync(path.join(dest, f), clean(fs.readFileSync(path.join(userData, 'Logs', f), 'utf8')), 'utf8')
      }
    } catch (err) { log(`copy logs failed: ${String(err)}`) }
    if (app) await closeIsolated({ app, runtimeId, userData }, log)
    const leftovers = await execText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '${FAKE_EXE.replace(/'/g, "''")}' } | Select-Object -ExpandProperty ProcessId`])
    for (const pid of leftovers.out.split(/\s+/).filter(s => /^\d+$/.test(s))) {
      const r = await execText('taskkill', ['/T', '/F', '/PID', pid])
      log(`ended leftover fake claude pid ${pid}: ${r.code === 0 ? 'ok' : r.out.trim()}`)
    }
    fs.writeFileSync(REPORT, `${JSON.stringify({ stamp: STAMP, build: version, items }, null, 2)}\n`, 'utf8')
    log(`report: ${REPORT}`)
    for (const [name, it] of Object.entries(items)) {
      log(`== ${name}: ${it.verdict}${it.note ? ` (${it.note})` : ''}`)
      if (it.verdict !== 'PASS') exit = 1
    }
  }
  return exit
}

main().then(code => process.exit(code), err => { log(`driver failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`); process.exit(2) })
