// T0862 / PLAN-065 W6 (D286): real Windows upgrade acceptance for the PTY holder.
//
// 🔴 Runs ONLY on a GitHub Actions Windows runner (.github/workflows/windows-upgrade-acceptance.yml): it runs real
// NSIS installers / uninstallers and starts BAT with its DEFAULT runtime (no --runtime=), because the installer's
// quit request (`<exe> --installer-quit-request`, build/installer.nsh) only reaches the default runtime's
// single-instance lock. On a developer machine that would be the installed BAT, its userData and its Terminal
// Server: the spec skips unless GITHUB_ACTIONS=true, RUNNER_OS=Windows and T0862_ACCEPTANCE=1.
//
// Inputs (set by the workflow):
//   T0862_SCENARIO        1–9 (one scenario per runner, so every scenario starts from a clean machine)
//   T0862_INSTALLER_A/B   two desktop-build.yml installers of the same branch (versions differ: 0.0.0-exp.<run>)
//   T0862_VERSION_A/B
//   T0862_INSTALLER_OLD   the current release without a holder (scenario 5), T0862_VERSION_OLD
//   T0862_REPORT_DIR      result-<n>.json, report-<n>.md, sanitized debug logs, screenshots
//
// Scenarios (every one: shell + `ping -t` pids before / after, conhost, holder path, Recovery prompt, output after
// reattach, toast text, holder directories):
//   1 per-user A → B (/S /currentuser): holder kept, reattach, app.upgradeReattached; a stale key directory under the
//     holder root is removed by B's customInstall, the running one kept.
//   2 per-machine A → B (/S /allusers), then a real per-machine uninstall while a process runs from the holder root
//     → the root is kept (the "in use" branch). The runner is elevated: no UAC inner instance (recorded).
//   3 same-version reinstall B → B: reattach, app.upgradeReattachedSameVersion.
//   4 downgrade B → A: reattach, app.upgradeReattached (vB → vA).
//   5 downgrade B → OLD (no holder, protocol 0 client): terminals end, the existing recovery / notice, nothing hangs.
//   6 real per-user uninstall of A: holder ends, the holder root is removed, userData stays.
//   7 A → B with a stand-in for the embedded claude in a tab (L185: the installed exe as node running a timer, no
//     real claude / codex, no login, no model): BAT ends it before quitting, the installer does not wait 15 s, the
//     shell is back at its prompt, the tab is listed and dismissing it empties the list.
//   8 (T0861 D6) A → B with no terminal: the idle older holder is replaced by B's.
//   9 (T0861 D5) A → B, then the token file no longer matches: the unusable holder and its PTY trees are ended, the
//     "upgrade ended N terminals" notice, the tab gets a new shell.
// Every check is recorded (soft) and the test fails at the end when any check failed, so one run gives the whole
// picture. Nothing reads or records a token value, env value or user name (paths are reported as <user>).

import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { freePort, isolatedEnv, run, testLogger } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0862')
const ENV = process.env
const SCENARIO = ENV.T0862_SCENARIO ?? ''
const INSTALLER_A = ENV.T0862_INSTALLER_A ?? ''
const INSTALLER_B = ENV.T0862_INSTALLER_B ?? ''
const INSTALLER_OLD = ENV.T0862_INSTALLER_OLD ?? ''
const VA = ENV.T0862_VERSION_A ?? ''
const VB = ENV.T0862_VERSION_B ?? ''
const VOLD = ENV.T0862_VERSION_OLD ?? ''
const REPORT_DIR = ENV.T0862_REPORT_DIR ?? path.join(os.tmpdir(), 't0862-report')
const ON_RUNNER = ENV.GITHUB_ACTIONS === 'true' && ENV.RUNNER_OS === 'Windows' && ENV.T0862_ACCEPTANCE === '1'

const USER_DATA = path.join(ENV.APPDATA ?? '', 'BetterAgentTerminal')
const ROOT_PER_USER = path.join(ENV.LOCALAPPDATA ?? '', 'BAT-PtyHolder')
const ROOT_PER_MACHINE = path.join(ENV.ProgramW6432 ?? ENV.ProgramFiles ?? 'C:\\Program Files', 'BAT-PtyHolder')
const RECORD = 'installer-quit-record.json'
const INSTALLER_WAIT_MS = 15_000 // build/installer.nsh BAT_INSTALLER_QUIT_TIMEOUT_MS
const WS = 'e2e-t0862-ws'
const PING_TAB = 'e2e-t0862-ping'
const AGENT_TAB = 'e2e-t0862-agent'

test.skip(process.platform !== 'win32', 'Windows NSIS upgrade acceptance')
test.skip(!ON_RUNNER, 'runs only on the GitHub Actions runner of windows-upgrade-acceptance.yml (it installs BAT and uses the default runtime)')

// ── evidence ────────────────────────────────────────────────────────────────────────────────────────────────

interface Check { name: string; ok: boolean; detail: string }
const checks: Check[] = []
const notes: string[] = []
const evidence: Record<string, unknown> = {}

function check(name: string, ok: boolean, detail: unknown = ''): boolean {
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail)
  checks.push({ name, ok, detail: sanitize(d) })
  log(`${ok ? 'PASS' : 'FAIL'} ${name}${d ? ` — ${sanitize(d)}` : ''}`)
  return ok
}

function note(text: string): void {
  notes.push(sanitize(text))
  log(`note: ${sanitize(text)}`)
}

/** No user name in the report: C:\Users\<name> → <user>. */
function sanitize(s: string): string {
  return s.replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/"'\s]+/gi, '<user>')
}

function writeReport(title: string, error?: unknown): void {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const failed = checks.filter(c => !c.ok)
  const verdict = error ? 'ERROR' : failed.length ? 'FAIL' : 'PASS'
  const json = { scenario: SCENARIO, title, verdict, versions: { A: VA, B: VB, OLD: VOLD }, checks, notes, evidence, error: error ? sanitize(String(error)) : undefined }
  fs.writeFileSync(path.join(REPORT_DIR, `result-${SCENARIO}.json`), sanitize(JSON.stringify(json, null, 2)))
  const md = [
    `## Scenario ${SCENARIO}: ${title} — ${verdict}`,
    '',
    `A = \`${VA}\`, B = \`${VB}\`${VOLD ? `, OLD = \`${VOLD}\`` : ''}`,
    '',
    '| | check | detail |',
    '|---|---|---|',
    ...checks.map(c => `| ${c.ok ? '✅' : '❌'} | ${c.name} | ${c.detail.replace(/\|/g, '\\|').slice(0, 400)} |`),
    '',
    ...(notes.length ? ['**Notes**', '', ...notes.map(n => `- ${n}`), ''] : []),
    ...(error ? ['**Error**', '', '```', sanitize(String(error)).slice(0, 2000), '```', ''] : []),
  ].join('\n')
  fs.writeFileSync(path.join(REPORT_DIR, `report-${SCENARIO}.md`), md)
}

// ── processes, registry, files ──────────────────────────────────────────────────────────────────────────────

interface Proc { ProcessId: number; ParentProcessId: number; ExecutablePath: string | null; Name: string | null }

async function powershell(script: string, timeout = 60_000): Promise<string> {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], timeout)
}

async function processes(): Promise<Proc[]> {
  const out = await powershell('ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,ExecutablePath,Name)').catch(() => '[]')
  const parsed = JSON.parse(out.trim() || '[]') as Proc | Proc[]
  return Array.isArray(parsed) ? parsed : [parsed]
}

const under = (p: string | null | undefined, dir: string) => !!p && !!dir && p.toLowerCase().startsWith(dir.toLowerCase().replace(/[\\/]+$/, '') + '\\')

function isAlive(pid: number | null | undefined): boolean {
  if (!pid) return false
  try { process.kill(pid, 0); return true } catch { return false }
}

async function aliveAs(pid: number | null | undefined, name: string | null | undefined): Promise<boolean> {
  if (!pid) return false
  const p = (await processes()).find(x => x.ProcessId === pid)
  return !!p && (!name || (p.Name ?? '').toLowerCase() === name.toLowerCase())
}

async function waitGone(pid: number | null | undefined, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (!isAlive(pid)) return true
    await new Promise(r => setTimeout(r, 250))
  }
  return !isAlive(pid)
}

interface Installed { DisplayName: string; DisplayVersion: string; InstallLocation: string | null; UninstallString: string | null; PSPath: string }

async function installedApps(): Promise<Installed[]> {
  const script = [
    "$k = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'",
    "ConvertTo-Json -Compress -InputObject @(Get-ItemProperty $k -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'BetterAgentTerminal*' } | Select-Object DisplayName,DisplayVersion,InstallLocation,UninstallString,PSPath)",
  ].join('; ')
  const out = (await powershell(script).catch(() => '[]')).trim()
  const parsed = JSON.parse(out || '[]') as Installed | Installed[]
  return Array.isArray(parsed) ? parsed : [parsed]
}

async function installed(): Promise<{ dir: string; exe: string; version: string; uninstall: string; hive: string } | null> {
  const apps = await installedApps()
  if (apps.length !== 1) {
    if (apps.length > 1) note(`more than one uninstall entry: ${apps.map(a => `${a.DisplayVersion}@${a.PSPath.split('::')[1]?.split('\\')[0]}`).join(', ')}`)
    if (!apps.length) return null
  }
  const a = apps[0]
  const uninstall = a.UninstallString ?? ''
  const dir = (a.InstallLocation || path.win32.dirname(uninstall.replace(/^"([^"]+)".*$/, '$1'))).replace(/[\\/]+$/, '')
  return { dir, exe: path.join(dir, 'BetterAgentTerminal.exe'), version: a.DisplayVersion, uninstall, hive: /HKEY_LOCAL_MACHINE/i.test(a.PSPath) ? 'HKLM' : 'HKCU' }
}

async function fileVersion(exe: string): Promise<string> {
  if (!fs.existsSync(exe)) return '(missing)'
  return (await powershell(`(Get-Item -LiteralPath '${exe.replace(/'/g, "''")}').VersionInfo.FileVersion`).catch(() => '?')).trim()
}

function readJson(file: string): AnyApi {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function serverPid(): number | null {
  try {
    const pid = Number(fs.readFileSync(path.join(USER_DATA, 'bat-pty-server.pid'), 'utf8').trim())
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch { return null }
}

function registry(): { id: string; pid: number }[] {
  return (readJson(path.join(USER_DATA, 'bat-pty-registry.json'))?.ptys ?? []) as { id: string; pid: number }[]
}

const registryPid = (id: string) => registry().find(p => p.id === id)?.pid ?? null

function holderDirs(root: string): { name: string; manifest: boolean; exe: boolean }[] {
  if (!fs.existsSync(root)) return []
  return fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => ({
    name: d.name,
    manifest: fs.existsSync(path.join(root, d.name, 'holder-manifest.json')),
    exe: fs.existsSync(path.join(root, d.name, 'bat-pty-holder.exe')),
  }))
}

function logFiles(): string[] {
  const dir = path.join(USER_DATA, 'Logs')
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort() : []
}

/** Debug log text of the files not in `before` (= the launches since then). */
function logSince(before: string[] = []): string {
  const dir = path.join(USER_DATA, 'Logs')
  return logFiles().filter(f => !before.includes(f)).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

function interestingLines(text: string): string[] {
  return text.split('\n')
    .filter(l => /\[terminal-server\]|\[pty-holder\]|\[installer-quit\]|\[upgrade-interruption\]|PTY holder|BUG-146|orphan|Recovery|\[PtyManager\] TCP connected|unusable server|replac/.test(l))
    .map(l => sanitize(l.trim()))
}

function copyLogs(): void {
  const dir = path.join(USER_DATA, 'Logs')
  const out = path.join(REPORT_DIR, `logs-${SCENARIO}`)
  fs.mkdirSync(out, { recursive: true })
  for (const f of logFiles()) fs.writeFileSync(path.join(out, f), sanitize(fs.readFileSync(path.join(dir, f), 'utf8')))
}

// ── installers ──────────────────────────────────────────────────────────────────────────────────────────────

interface InstallResult { exitCode: number | null; ms: number; mainGoneAfterMs: number | null }

/** Runs an installer silently; `watchPid` (BAT's main process) → when it was gone, relative to the start. */
async function install(installer: string, scope: 'currentuser' | 'allusers', label: string, watchPid?: number | null): Promise<InstallResult> {
  expect(fs.existsSync(installer), `installer ${label}`).toBe(true)
  const start = Date.now()
  let mainGoneAfterMs: number | null = null
  let watching = !!watchPid
  const watcher = (async () => {
    while (watching && watchPid) {
      if (!isAlive(watchPid)) { mainGoneAfterMs = Date.now() - start; break }
      await new Promise(r => setTimeout(r, 100))
    }
  })()
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(installer, ['/S', `/${scope}`], { windowsHide: true, stdio: 'ignore' })
    const timer = setTimeout(() => { child.kill(); reject(new Error(`installer ${label} timed out`)) }, 600_000)
    child.on('error', err => { clearTimeout(timer); reject(err) })
    child.on('exit', code => { clearTimeout(timer); resolve(code) })
  })
  watching = false
  await watcher
  const ms = Date.now() - start
  const r = { exitCode, ms, mainGoneAfterMs }
  log(`install ${label} (/${scope}): ${JSON.stringify(r)}`)
  evidence[`install ${label}`] = r
  return r
}

/** Runs the uninstall string silently and waits until the entry and the exe are gone (NSIS re-launches itself from %TEMP%). */
async function uninstall(app: { uninstall: string; exe: string }, watchPid?: number | null): Promise<{ exitCode: number | null; ms: number; mainGoneAfterMs: number | null; completed: boolean }> {
  const m = /^"([^"]+)"\s*(.*)$/.exec(app.uninstall)
  expect(m, 'UninstallString is "<exe>" <args>').not.toBeNull()
  const args = ['/S', ...m![2].split(/\s+/).filter(Boolean)]
  const start = Date.now()
  let mainGoneAfterMs: number | null = null
  const exitCode = await new Promise<number | null>((resolve) => {
    const child = spawn(m![1], args, { windowsHide: true, stdio: 'ignore' })
    child.on('error', () => resolve(null))
    child.on('exit', code => resolve(code))
  })
  let completed = false
  while (Date.now() - start < 240_000) {
    if (watchPid && mainGoneAfterMs === null && !isAlive(watchPid)) mainGoneAfterMs = Date.now() - start
    if (!(await installedApps()).length && !fs.existsSync(app.exe)) { completed = true; break }
    await new Promise(r => setTimeout(r, 1000))
  }
  // the uninstaller's copy in %TEMP% may still be finishing (holder root check, DetailPrint)
  for (let i = 0; i < 60; i++) {
    const busy = (await processes()).some(p => /^(Un_[A-Z]\.exe|Au_\.exe)$/i.test(p.Name ?? ''))
    if (!busy) break
    await new Promise(r => setTimeout(r, 1000))
  }
  if (watchPid && mainGoneAfterMs === null && !isAlive(watchPid)) mainGoneAfterMs = Date.now() - start
  const r = { exitCode, ms: Date.now() - start, mainGoneAfterMs, completed }
  log(`uninstall: ${JSON.stringify(r)}`)
  evidence.uninstall = r
  return r
}

// ── BAT ─────────────────────────────────────────────────────────────────────────────────────────────────────

interface Bat { app: ElectronApplication; win: Page; mainPid: number; version: string }

function writeSettings(): void {
  fs.mkdirSync(USER_DATA, { recursive: true })
  const file = path.join(USER_DATA, 'settings.json')
  const current = readJson(file) ?? {}
  // T0863 / T0864: the update check off with its one-time marker (an exp build is always older than GitHub's
  // latest release → the update dialog would cover the window); no default agent tab (L185); cmd tabs.
  fs.writeFileSync(file, JSON.stringify({ ...current, language: 'en', shell: 'cmd', createDefaultAgentTerminal: false, checkForUpdates: false, checkForUpdatesMigrated: true }, null, 2))
}

async function launch(exe: string, label: string): Promise<Bat> {
  writeSettings()
  const env = isolatedEnv(await freePort())
  const app = await electron.launch({ executablePath: exe.replace(/\\/g, '/'), args: [], env, timeout: 120_000 })
  const userData = await app.evaluate(({ app: a }) => a.getPath('userData'))
  expect(userData.toLowerCase(), 'default userData').toBe(USER_DATA.toLowerCase())
  const win = await app.firstWindow({ timeout: 120_000 })
  await expect.poll(() => win.url(), { timeout: 60_000 }).not.toMatch(/^(about:blank)?$/)
  await win.waitForLoadState('domcontentloaded')
  const mainPid = await app.evaluate(() => process.pid)
  const version = await app.evaluate(({ app: a }) => a.getVersion())
  log(`launched ${label}: version ${version}, main pid ${mainPid}`)
  return { app, win, mainPid, version }
}

async function shot(win: Page | undefined, name: string): Promise<void> {
  if (!win) return
  await win.screenshot({ path: path.join(REPORT_DIR, `s${SCENARIO}-${name}.png`) }).catch(() => undefined)
}

/** Seeds one workspace with the given cmd tabs and reloads; the renderer creates their PTYs. */
async function seedTabs(bat: Bat, tabs: string[]): Promise<void> {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0862-ws-'))
  await expect.poll(async () => (await bat.win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 60_000 }).toBe(true)
  const seed = {
    workspaces: [{ id: WS, name: 'T0862', folderPath: folder, createdAt: Date.now() }],
    activeWorkspaceId: WS,
    activeGroup: null,
    terminals: tabs.map(id => ({ id, workspaceId: WS, type: 'terminal', title: id === AGENT_TAB ? 'agent stand-in' : 'ping', cwd: folder })),
    activeTerminalId: tabs[0],
  }
  expect(await bat.win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
  await bat.win.reload()
  await bat.win.waitForLoadState('domcontentloaded')
  for (const id of tabs) await expect.poll(() => registryPid(id), { timeout: 60_000 }).not.toBeNull()
  await bat.win.waitForTimeout(2_000)
}

/** Collects one tab's output in the window. */
async function collectOutput(win: Page, tab: string): Promise<() => Promise<string>> {
  await win.evaluate((t) => {
    const w = window as AnyApi
    w.__t0862 = w.__t0862 ?? {}
    w.__t0862[t] = ''
    w.electronAPI.pty.onOutput((id: string, data: string) => { if (id === t) w.__t0862[t] += data })
  }, tab)
  return () => win.evaluate((t) => ((window as AnyApi).__t0862?.[t] ?? '') as string, tab)
}

const write = (win: Page, tab: string, text: string) => win.evaluate(({ t, s }) => (window as AnyApi).electronAPI.pty.write(t, s), { t: tab, s: text })

async function childOf(parent: number | null, name: RegExp, timeoutMs = 20_000): Promise<Proc | null> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const p = (await processes()).find(x => x.ParentProcessId === parent && name.test(x.Name ?? ''))
    if (p) return p
    await new Promise(r => setTimeout(r, 500))
  }
  return null
}

interface Roles {
  main: number
  holder: number | null
  holderExe: string | null
  shells: Record<string, number | null>
  ping: number | null
  conhosts: number[]
  agent: number | null
}

async function collectRoles(bat: Bat, tabs: string[]): Promise<Roles> {
  const holder = serverPid()
  const table = await processes()
  const shells: Record<string, number | null> = {}
  for (const t of tabs) shells[t] = registryPid(t)
  const ping = tabs.includes(PING_TAB) ? await childOf(shells[PING_TAB], /^ping\.exe$/i) : null
  const agent = tabs.includes(AGENT_TAB) ? await childOf(shells[AGENT_TAB], /^BetterAgentTerminal\.exe$/i) : null
  const roles: Roles = {
    main: bat.mainPid,
    holder,
    holderExe: table.find(p => p.ProcessId === holder)?.ExecutablePath ?? null,
    shells,
    ping: ping?.ProcessId ?? null,
    // ConPTY's conhost is a child of the process that created the pseudo console (the holder)
    conhosts: (await processes()).filter(p => (p.ParentProcessId === holder || Object.values(shells).includes(p.ParentProcessId)) && /^conhost\.exe$/i.test(p.Name ?? '')).map(p => p.ProcessId),
    agent: agent?.ProcessId ?? null,
  }
  log(`roles: ${JSON.stringify(roles)}`)
  return roles
}

/** The checks every holder scenario makes right after the installer: what kept running. */
async function checkKept(roles: Roles, label: string): Promise<void> {
  check(`${label}: holder (Terminal Server) pid ${roles.holder} still running`, await aliveAs(roles.holder, 'bat-pty-holder.exe'))
  for (const [tab, pid] of Object.entries(roles.shells)) check(`${label}: shell of ${tab} (pid ${pid}) still running`, await aliveAs(pid, 'cmd.exe'))
  if (roles.ping !== null) check(`${label}: ping -t (pid ${roles.ping}) still running`, await aliveAs(roles.ping, 'PING.EXE'))
  const alive: number[] = []
  for (const c of roles.conhosts) if (await aliveAs(c, 'conhost.exe')) alive.push(c)
  check(`${label}: conhost(s) of the holder still running`, roles.conhosts.length > 0 && alive.length === roles.conhosts.length, { before: roles.conhosts, alive })
}

async function checkNoInstallDirProcess(dir: string, label: string): Promise<void> {
  const left = (await processes()).filter(p => under(p.ExecutablePath, dir)).map(p => `${p.Name}(${p.ProcessId})`)
  check(`${label}: no process runs from the install directory`, left.length === 0, left)
}

async function recoveryPromptShown(win: Page, waitMs: number): Promise<boolean> {
  const prompt = win.locator('.recovery-prompt-dialog')
  const end = Date.now() + waitMs
  while (Date.now() < end) {
    if (await prompt.isVisible().catch(() => false)) return true
    await win.waitForTimeout(500)
  }
  return false
}

async function toastText(win: Page, key: string, timeoutMs = 30_000): Promise<string | null> {
  const toast = win.locator(`[data-message-key="${key}"]`)
  try {
    await toast.first().waitFor({ state: 'visible', timeout: timeoutMs })
    return (await toast.first().innerText()).replace(/\s+/g, ' ').trim()
  } catch {
    const any = await win.locator('.server-status-toast').evaluateAll(els => els.map(e => `${e.getAttribute('data-message-key')}: ${(e as HTMLElement).innerText}`)).catch(() => [])
    note(`toast ${key} not shown; toasts present: ${JSON.stringify(any)}`)
    return null
  }
}

/** ping -t keeps writing: the count of replies grows while we watch (fresh output, not the replay). */
async function checkPingOutput(win: Page, label: string): Promise<void> {
  const output = await collectOutput(win, PING_TAB)
  const count = async () => ((await output()).match(/127\.0\.0\.1/g) ?? []).length
  await win.waitForTimeout(2_000)
  const first = await count()
  await win.waitForTimeout(4_000)
  const second = await count()
  check(`${label}: the reconnected ping tab keeps receiving output`, second > first && second > 0, { first, second })
}

/** Ctrl+C the ping, then the same shell answers a command (it is back at its prompt). */
async function checkShellAnswers(win: Page, tab: string, label: string, stopPing: boolean): Promise<void> {
  const output = await collectOutput(win, tab)
  if (stopPing) {
    await write(win, tab, '\x03')
    await win.waitForTimeout(1_500)
  }
  const marker = `T0862-${tab.endsWith('agent') ? 'PROMPT' : 'ALIVE'}-${SCENARIO}`
  await write(win, tab, `echo ${marker}\r`)
  let ok = false
  for (let i = 0; i < 30 && !ok; i++) {
    ok = (await output()).includes(marker)
    if (!ok) await win.waitForTimeout(500)
  }
  check(`${label}: ${tab} answers a command (\`echo ${marker}\`)`, ok)
}

/** Quit answering the confirmation with "quit + stop Terminal Server" (end of a scenario). */
async function quitStopping(bat: Bat | undefined): Promise<void> {
  if (!bat) return
  try {
    await bat.app.evaluate(({ dialog }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(dialog as any).showMessageBox = async () => ({ response: 1, checkboxChecked: true })
    })
  } catch { /* already gone */ }
  let timer: NodeJS.Timeout | undefined
  await Promise.race([
    bat.app.close().catch(() => undefined),
    new Promise(resolve => { timer = setTimeout(resolve, 20_000) }),
  ])
  clearTimeout(timer)
  if (isAlive(bat.mainPid)) await run('taskkill', ['/T', '/F', '/PID', String(bat.mainPid)]).catch(() => '')
}

/** Playwright's handle of a BAT the installer ended. */
async function forget(bat: Bat | undefined): Promise<void> {
  if (!bat) return
  try { bat.app.process().kill() } catch { /* gone */ }
  await bat.app.close().catch(() => undefined)
}

function checkRecord(expectAgentTab: boolean, holderPid: number | null, label: string): void {
  const record = readJson(path.join(USER_DATA, RECORD))
  evidence[`${label} record`] = record ? { schema: record.schema, source: record.source, holderKept: record.holderKept, holderPidMatches: record.holderPid === holderPid, endedPtys: record.endedPtys?.length, endedAgentProcesses: record.endedAgentProcesses } : null
  const ok = !!record && record.schema === 2 && record.holderKept === true && record.holderPid === holderPid
    && (expectAgentTab ? JSON.stringify(record.endedAgentProcesses) === JSON.stringify([{ terminalId: AGENT_TAB, processes: 1 }]) : (record.endedAgentProcesses ?? []).length === 0)
  check(`${label}: installer quit record is schema 2, holderKept, holderPid = the holder${expectAgentTab ? ', the agent tab with 1 ended process' : ''}`, ok, evidence[`${label} record`])
}

// ── scenario building blocks ────────────────────────────────────────────────────────────────────────────────

const ROOT = (scope: 'currentuser' | 'allusers') => scope === 'allusers' ? ROOT_PER_MACHINE : ROOT_PER_USER

interface Before { bat: Bat; roles: Roles; tabs: string[]; appDir: string; key: string | null }

/** Install `installer`, start BAT, seed the tabs, start ping (and the agent stand-in). */
async function setUp(installer: string, version: string, scope: 'currentuser' | 'allusers', label: string, tabs: string[]): Promise<Before> {
  const r = await install(installer, scope, label)
  check(`install ${label} (${version}, /${scope}) exit 0`, r.exitCode === 0, r)
  const app = await installed()
  check(`install ${label}: uninstall entry ${version} in ${scope === 'allusers' ? 'HKLM' : 'HKCU'}`, !!app && app.version === version && app.hive === (scope === 'allusers' ? 'HKLM' : 'HKCU'), app ? { version: app.version, hive: app.hive, dir: app.dir } : null)
  expect(app, 'installed app').not.toBeNull()
  const bat = await launch(app!.exe, label)
  check(`${label}: BAT runs ${version}`, bat.version === version, bat.version)
  if (tabs.length) {
    await seedTabs(bat, tabs)
    if (tabs.includes(PING_TAB)) await write(bat.win, PING_TAB, 'ping -t 127.0.0.1\r')
    if (tabs.includes(AGENT_TAB)) {
      // L185: the stand-in for the embedded claude is the installed exe run as node with a timer — it runs from the
      // install directory like the embedded claude / codex; nothing logs in or calls a model.
      await write(bat.win, AGENT_TAB, `set ELECTRON_RUN_AS_NODE=1&& "${app!.exe}" -e "setInterval(function(){},1000)"\r`)
    }
  }
  const roles = await collectRoles(bat, tabs)
  const root = ROOT(scope)
  check(`${label}: the Terminal Server runs from the holder under ${scope === 'allusers' ? '%ProgramFiles%' : '%LOCALAPPDATA%'}\\BAT-PtyHolder`, under(roles.holderExe, root) && /\\bat-pty-holder\.exe$/i.test(roles.holderExe ?? ''), roles.holderExe)
  const key = roles.holderExe && under(roles.holderExe, root) ? path.basename(path.dirname(roles.holderExe)) : null
  if (tabs.includes(PING_TAB)) check(`${label}: ping -t runs in the ping tab`, roles.ping !== null)
  if (tabs.includes(AGENT_TAB)) check(`${label}: the agent stand-in runs from the install directory in the agent tab`, roles.agent !== null)
  evidence[`${label} holder dirs`] = holderDirs(root)
  evidence[`${label} roles`] = roles
  await shot(bat.win, `${label}-before`)
  return { bat, roles, tabs, appDir: app!.dir, key }
}

/** Relaunch after an installer that kept the holder: no Recovery prompt, the toast, same pids, output continues. */
async function relaunchReattached(exe: string, before: Before, toastKey: string, from: string, to: string, label: string, logsBefore: string[]): Promise<Bat> {
  const bat = await launch(exe, label)
  check(`${label}: BAT runs ${to}`, bat.version === to, bat.version)
  const prompt = await recoveryPromptShown(bat.win, 8_000)
  check(`${label}: no Recovery prompt`, !prompt && (await bat.win.locator('.recovery-prompt-dialog').count()) === 0)
  check(`${label}: no pending recovery (queryPendingRecovery)`, (await bat.win.evaluate(() => (window as AnyApi).electronAPI.terminalServer.queryPendingRecovery?.() ?? null).catch(() => 'n/a')) === null)
  const text = await toastText(bat.win, toastKey)
  const wantText = toastKey === 'app.upgradeReattachedSameVersion' ? [to] : [from, to]
  check(`${label}: toast ${toastKey}`, !!text && wantText.every(v => text.includes(v)), text)
  await shot(bat.win, `${label}-after`)
  const text2 = logSince(logsBefore)
  check(`${label}: log — reconnecting without the Recovery prompt`, /\[terminal-server\] \d+ live PTYs on the PTY holder the installer kept — reconnecting without the Recovery prompt/.test(text2))
  check(`${label}: log — upgrade-interruption reattached previous=${from} current=${to}`, new RegExp(`\\[upgrade-interruption\\] (reattached|detected): previous=${from.replace(/\./g, '\\.')} current=${to.replace(/\./g, '\\.')}`).test(text2))
  check(`${label}: the same holder (pid file)`, serverPid() === before.roles.holder, { before: before.roles.holder, now: serverPid() })
  for (const tab of before.tabs) check(`${label}: ${tab} has the same shell (registry)`, registryPid(tab) === before.roles.shells[tab], { before: before.roles.shells[tab], now: registryPid(tab) })
  const shellsUnderHolder = (await processes()).filter(p => p.ParentProcessId === before.roles.holder && /^cmd\.exe$/i.test(p.Name ?? '')).length
  check(`${label}: one shell per tab under the holder`, shellsUnderHolder === before.tabs.length, shellsUnderHolder)
  if (before.tabs.includes(PING_TAB)) {
    check(`${label}: ping -t is still the same process`, await aliveAs(before.roles.ping, 'PING.EXE'), before.roles.ping)
    await checkPingOutput(bat.win, label)
  }
  evidence[`${label} log`] = interestingLines(text2)
  return bat
}

// ── scenarios ───────────────────────────────────────────────────────────────────────────────────────────────

/** 1 / 2 / 3 / 4 / 7: an installer over a running BAT with a holder → reattach. */
async function upgradeScenario(opts: {
  title: string
  first: [string, string]
  second: [string, string]
  scope: 'currentuser' | 'allusers'
  toastKey: string
  agent?: boolean
  staleDir?: boolean
  thenUninstallWithBlocker?: boolean
}): Promise<void> {
  const tabs = opts.agent ? [PING_TAB, AGENT_TAB] : [PING_TAB]
  let bat: Bat | undefined
  let blocker: number | null = null
  try {
    const before = await setUp(opts.first[0], opts.first[1], opts.scope, 'first', tabs)
    bat = before.bat
    const root = ROOT(opts.scope)
    const stale = path.join(root, 'stale-t0862')
    if (opts.staleDir) {
      fs.mkdirSync(stale, { recursive: true })
      fs.writeFileSync(path.join(stale, 'placeholder.txt'), 'T0862: a directory no process runs from — customInstall removes it (D9)')
    }
    const logsBefore = logFiles()

    const r = await install(opts.second[0], opts.scope, 'second', bat.mainPid)
    check(`install second (${opts.second[1]}) exit 0`, r.exitCode === 0, r)
    check('second: BAT quit before the installer\'s 15 s wait ran out (no second "is running" prompt / force-end)', r.mainGoneAfterMs !== null && r.mainGoneAfterMs < INSTALLER_WAIT_MS, r)
    await forget(bat)
    bat = undefined
    const app = await installed()
    check(`second: uninstall entry is ${opts.second[1]}`, app?.version === opts.second[1], app?.version)
    evidence['second: installed exe FileVersion'] = await fileVersion(app!.exe)
    await checkKept(before.roles, 'after install')
    await checkNoInstallDirProcess(app!.dir, 'after install')
    if (opts.agent) {
      check('after install: the agent stand-in was ended', !(await aliveAs(before.roles.agent, 'BetterAgentTerminal.exe')), before.roles.agent)
      check('first BAT log: ended 1 agent process in 1 tab', logSince().includes('[installer-quit] ended 1 agent process(es) under the install directory in 1 tab(s)'))
    }
    check('first BAT log: quit keeping the PTY holder', logSince().includes('[installer-quit] quit without confirmation (stopTerminalServer=false, PTY holder kept)'))
    checkRecord(!!opts.agent, before.roles.holder, 'after install')
    const dirs = holderDirs(root)
    evidence['holder dirs after install'] = dirs
    check('after install: the running holder directory is intact (an --updated uninstall and customInstall left it)', !!before.key && dirs.some(d => d.name === before.key && d.manifest && d.exe), { key: before.key, dirs })
    if (opts.staleDir) check('after install: the unused stale directory was removed by customInstall (D9)', !fs.existsSync(stale), dirs)

    bat = await relaunchReattached(app!.exe, before, opts.toastKey, opts.first[1], opts.second[1], 'relaunch', logsBefore)
    if (opts.agent) {
      const listed = await bat.win.evaluate(() => (window as AnyApi).electronAPI.terminalServer.queryInterruptedAgents()).catch(() => null) as AnyApi[] | null
      const ids = (listed ?? []).map((a: AnyApi) => a?.terminalId ?? a?.id)
      check('relaunch: the agent tab is listed as interrupted (cause upgrade)', ids.includes(AGENT_TAB), listed)
      check('relaunch: the agent stand-in did not come back', (await processes()).every(p => !(p.ParentProcessId === before.roles.shells[AGENT_TAB] && /^BetterAgentTerminal\.exe$/i.test(p.Name ?? ''))))
      await checkShellAnswers(bat.win, AGENT_TAB, 'relaunch', false)
      await bat.win.evaluate((t) => (window as AnyApi).electronAPI.terminalServer.dismissInterruptedAgent(t), AGENT_TAB).catch(() => false)
      const after = await bat.win.evaluate(() => (window as AnyApi).electronAPI.terminalServer.queryInterruptedAgents()).catch(() => null) as AnyApi[] | null
      check('relaunch: after dismissing it the interrupted list is empty again', Array.isArray(after) && after.length === 0, after)
    }
    await checkShellAnswers(bat.win, PING_TAB, 'relaunch', true)

    if (opts.thenUninstallWithBlocker) {
      // per-machine real uninstall while an unrelated process runs from the holder root: BAT and the holder end,
      // the root is kept (batPtyHolderInUse → "in use"; DetailPrint is not visible under /S).
      const holderDir = path.dirname(before.roles.holderExe!)
      const child = spawn(path.join(holderDir, 'bat-pty-holder.exe'), ['-e', 'setInterval(function(){},1000)'], { detached: true, stdio: 'ignore', windowsHide: true })
      child.unref()
      blocker = child.pid ?? null
      await new Promise(r => setTimeout(r, 1500))
      check('uninstall: a blocker process runs from the holder root', await aliveAs(blocker, 'bat-pty-holder.exe'), blocker)
      const u = await uninstall(app!, bat.mainPid)
      await forget(bat)
      bat = undefined
      check('uninstall (per-machine): completed (entry and exe gone)', u.completed, u)
      check('uninstall (per-machine): BAT quit', u.mainGoneAfterMs !== null, u)
      check('uninstall (per-machine): the holder (Terminal Server) ended', await waitGone(before.roles.holder, 30_000), before.roles.holder)
      check('uninstall (per-machine): the holder root is kept while a process runs from it', fs.existsSync(root), holderDirs(root))
      check('uninstall (per-machine): userData is kept', fs.existsSync(path.join(USER_DATA, 'settings.json')))
      note('per-machine uninstall: the "kept … in use" DetailPrint is not visible with /S; the kept root is the evidence')
    }
  } finally {
    if (bat) { copyLogs(); await quitStopping(bat) }
    if (blocker && isAlive(blocker)) await run('taskkill', ['/T', '/F', '/PID', String(blocker)]).catch(() => '')
  }
}

async function scenario5(): Promise<void> {
  let bat: Bat | undefined
  try {
    const before = await setUp(INSTALLER_B, VB, 'currentuser', 'first', [PING_TAB])
    bat = before.bat
    const logsBefore = logFiles()
    const r = await install(INSTALLER_OLD, 'currentuser', 'old', bat.mainPid)
    check(`install OLD (${VOLD}) over B exit 0`, r.exitCode === 0, r)
    check('old installer: B quit within the installer wait (OLD sends --installer-quit-request)', r.mainGoneAfterMs !== null && r.mainGoneAfterMs < INSTALLER_WAIT_MS, r)
    await forget(bat)
    bat = undefined
    const app = await installed()
    check(`old: uninstall entry is ${VOLD}`, app?.version === VOLD, app?.version)
    note(`after the OLD installer: holder alive ${isAlive(before.roles.holder)}, shell alive ${isAlive(before.roles.shells[PING_TAB])}, ping alive ${isAlive(before.roles.ping)}`)
    evidence['holder dirs after install'] = holderDirs(ROOT_PER_USER)

    const t0 = Date.now()
    bat = await launch(app!.exe, 'old')
    check(`old: BAT ${VOLD} starts (window loaded)`, bat.version === VOLD, { version: bat.version, ms: Date.now() - t0 })
    const prompt = await recoveryPromptShown(bat.win, 15_000)
    evidence['old: Recovery prompt'] = prompt
    if (prompt) {
      await shot(bat.win, 'old-recovery-prompt')
      note('OLD showed the Recovery prompt; answered with its primary button (keep)')
      await bat.win.locator('.recovery-prompt-dialog .recovery-prompt-actions .btn-primary').click().catch(() => undefined)
      await bat.win.waitForTimeout(5_000)
    }
    const toasts = await bat.win.locator('.server-status-toast').evaluateAll(els => els.map(e => `${e.getAttribute('data-message-key')}: ${(e as HTMLElement).innerText.replace(/\s+/g, ' ')}`)).catch(() => [])
    evidence['old: toasts'] = toasts
    note(`OLD toasts: ${JSON.stringify(toasts)}`)
    // the tab must be usable: a shell (old or new) answers within 60 s
    const output = await collectOutput(bat.win, PING_TAB)
    let answered = false
    const end = Date.now() + 60_000
    while (!answered && Date.now() < end) {
      await write(bat.win, PING_TAB, '\x03').catch(() => undefined)
      await write(bat.win, PING_TAB, 'echo T0862-OLD-ALIVE\r').catch(() => undefined)
      await bat.win.waitForTimeout(3_000)
      answered = (await output()).includes('T0862-OLD-ALIVE')
    }
    check('old: the tab answers a command within 60 s (BAT is not stuck)', answered)
    await shot(bat.win, 'old-after')
    const oldShellAlive = isAlive(before.roles.shells[PING_TAB])
    const pingAlive = isAlive(before.roles.ping)
    check('old: the terminal ended — the pre-downgrade shell and ping no longer run', !oldShellAlive && !pingAlive, { shell: oldShellAlive, ping: pingAlive })
    note(`after OLD started: B's holder pid ${before.roles.holder} alive ${isAlive(before.roles.holder)}; registry shell ${registryPid(PING_TAB)} (before ${before.roles.shells[PING_TAB]}); server pid file ${serverPid()}`)
    evidence['old log'] = interestingLines(logSince(logsBefore))
  } finally {
    if (bat) { copyLogs(); await quitStopping(bat) }
  }
}

async function scenario6(): Promise<void> {
  let bat: Bat | undefined
  try {
    const before = await setUp(INSTALLER_A, VA, 'currentuser', 'first', [PING_TAB])
    bat = before.bat
    const app = await installed()
    const u = await uninstall(app!, bat.mainPid)
    await forget(bat)
    bat = undefined
    check('uninstall (per-user): completed (entry and exe gone)', u.completed, u)
    check('uninstall: BAT quit', u.mainGoneAfterMs !== null, u)
    check('uninstall: the holder (Terminal Server) ended', await waitGone(before.roles.holder, 30_000), before.roles.holder)
    check('uninstall: the shell and ping ended', !isAlive(before.roles.shells[PING_TAB]) && !isAlive(before.roles.ping))
    check('uninstall: the per-user holder root %LOCALAPPDATA%\\BAT-PtyHolder is removed', !fs.existsSync(ROOT_PER_USER), holderDirs(ROOT_PER_USER))
    check('uninstall: the install directory is removed', !fs.existsSync(app!.exe), app!.dir)
    check('uninstall: userData is kept (settings.json, Logs)', fs.existsSync(path.join(USER_DATA, 'settings.json')) && fs.existsSync(path.join(USER_DATA, 'Logs')))
    const pidFile = fs.existsSync(path.join(USER_DATA, 'bat-pty-server.pid'))
    check('uninstall: the Terminal Server pid file is cleared', !pidFile)
    evidence['uninstall log'] = interestingLines(logSince())
  } finally {
    if (bat) { copyLogs(); await quitStopping(bat) }
  }
}

async function scenario8(): Promise<void> {
  let bat: Bat | undefined
  try {
    const before = await setUp(INSTALLER_A, VA, 'currentuser', 'first', [])
    bat = before.bat
    await bat.win.waitForTimeout(3_000)
    for (const p of registry()) await bat.win.evaluate((id) => (window as AnyApi).electronAPI.pty.kill(id), p.id).catch(() => undefined)
    await expect.poll(() => registry().length, { timeout: 20_000 }).toBe(0)
    const oldHolder = serverPid()
    check('first: the holder runs with 0 PTYs', !!oldHolder && registry().length === 0, { holder: oldHolder })
    const logsBefore = logFiles()
    const r = await install(INSTALLER_B, 'currentuser', 'second', bat.mainPid)
    check(`install second (${VB}) exit 0`, r.exitCode === 0, r)
    await forget(bat)
    bat = undefined
    note(`after install: the idle holder pid ${oldHolder} alive ${isAlive(oldHolder)}`)
    const app = await installed()
    bat = await launch(app!.exe, 'relaunch')
    check('relaunch: no Recovery prompt', !(await recoveryPromptShown(bat.win, 8_000)))
    const text = logSince(logsBefore)
    check(`relaunch: log — the idle holder of v${VA} is replaced`, text.includes(`has no PTYs and runs v${VA} (this is v${VB}) — replacing it`))
    check('relaunch: the old holder ended', await waitGone(oldHolder, 30_000), oldHolder)
    const newHolder = serverPid()
    const exe = (await processes()).find(p => p.ProcessId === newHolder)?.ExecutablePath ?? null
    check('relaunch: a new holder runs (new pid, from the holder root)', !!newHolder && newHolder !== oldHolder && under(exe, ROOT_PER_USER), { oldHolder, newHolder, exe })
    check(`relaunch: log — Terminal Server from holder (${VB}'s server)`, /\[pty-holder\] Terminal Server from holder \S+ \(per-user\)/.test(text))
    evidence['relaunch log'] = interestingLines(text)
  } finally {
    if (bat) { copyLogs(); await quitStopping(bat) }
  }
}

async function scenario9(): Promise<void> {
  let bat: Bat | undefined
  try {
    const before = await setUp(INSTALLER_A, VA, 'currentuser', 'first', [PING_TAB])
    bat = before.bat
    const logsBefore = logFiles()
    const r = await install(INSTALLER_B, 'currentuser', 'second', bat.mainPid)
    check(`install second (${VB}) exit 0`, r.exitCode === 0, r)
    await forget(bat)
    bat = undefined
    await checkKept(before.roles, 'after install')
    // D5: the token no longer matches (a holder this BAT cannot use). The value is never read into the report.
    const tokenFile = path.join(USER_DATA, 'bat-pty-server.token')
    check('the token file exists', fs.existsSync(tokenFile))
    fs.writeFileSync(tokenFile, crypto.randomBytes(32).toString('base64url'))
    note('the token file was overwritten with a random value of the same form (value not recorded)')
    const app = await installed()
    bat = await launch(app!.exe, 'relaunch')
    const text = await toastText(bat.win, 'app.upgradeInterrupted')
    check('relaunch: toast app.upgradeInterrupted names 1 terminal and both versions', !!text && text.includes(VA) && text.includes(VB) && /\b1 terminal\b/.test(text), text)
    const prompt = await recoveryPromptShown(bat.win, 3_000)
    check('relaunch: no Recovery prompt', !prompt)
    await shot(bat.win, 'relaunch-after')
    const log2 = logSince(logsBefore)
    check('relaunch: log — the unusable holder is ended (hello unauthenticated)', /hello unauthenticated — ending it/.test(log2))
    check('relaunch: log — upgrade-interruption detected … incompatible', /\[upgrade-interruption\] detected: .*incompatible/.test(log2))
    check('relaunch: the old holder ended', await waitGone(before.roles.holder, 30_000), before.roles.holder)
    check('relaunch: the old shell and ping ended (PTY trees)', !isAlive(before.roles.shells[PING_TAB]) && !isAlive(before.roles.ping))
    await expect.poll(() => registryPid(PING_TAB), { timeout: 60_000 }).not.toBeNull()
    check('relaunch: the tab has a new shell', registryPid(PING_TAB) !== before.roles.shells[PING_TAB], { before: before.roles.shells[PING_TAB], now: registryPid(PING_TAB) })
    await checkShellAnswers(bat.win, PING_TAB, 'relaunch', false)
    if (/unusable (server|replaced server) (ended|still running)|still running after 5000 ms/.test(log2)) note('the holder was still running after server:shutdown and was ended with taskkill (Windows D5 path)')
    evidence['relaunch log'] = interestingLines(log2)
  } finally {
    if (bat) { copyLogs(); await quitStopping(bat) }
  }
}

const TITLES: Record<string, string> = {
  1: 'per-user upgrade A → B',
  2: 'per-machine upgrade A → B, then per-machine uninstall with the holder root in use',
  3: 'same-version reinstall B → B',
  4: 'downgrade B → A',
  5: 'downgrade B → OLD (no holder)',
  6: 'real per-user uninstall',
  7: 'A → B with an embedded-agent stand-in in a tab',
  8: 'D6: A → B with an idle holder (0 PTYs)',
  9: 'D5: A → B, holder unusable (token mismatch)',
}

test(`T0862 scenario ${SCENARIO}: ${TITLES[SCENARIO] ?? '?'}`, async () => {
  test.setTimeout(1_800_000)
  expect(TITLES[SCENARIO], 'T0862_SCENARIO 1–9').toBeTruthy()
  expect(INSTALLER_A && INSTALLER_B && VA && VB, 'installers A and B').toBeTruthy()
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const elevated = (await powershell('([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)')).trim()
  evidence.runner = { os: os.release(), elevated, preinstalled: (await installedApps()).length }
  check('runner: no BetterAgentTerminal installed before the scenario', (await installedApps()).length === 0)
  let error: unknown
  try {
    switch (SCENARIO) {
      case '1': await upgradeScenario({ title: TITLES[1], first: [INSTALLER_A, VA], second: [INSTALLER_B, VB], scope: 'currentuser', toastKey: 'app.upgradeReattached', staleDir: true }); break
      case '2':
        note(`runner elevated: ${elevated} — /allusers runs without a UAC inner instance, so the inner-instance path (no installer quit, no record → Recovery prompt) is not exercised here`)
        await upgradeScenario({ title: TITLES[2], first: [INSTALLER_A, VA], second: [INSTALLER_B, VB], scope: 'allusers', toastKey: 'app.upgradeReattached', thenUninstallWithBlocker: true })
        break
      case '3': await upgradeScenario({ title: TITLES[3], first: [INSTALLER_B, VB], second: [INSTALLER_B, VB], scope: 'currentuser', toastKey: 'app.upgradeReattachedSameVersion' }); break
      case '4': await upgradeScenario({ title: TITLES[4], first: [INSTALLER_B, VB], second: [INSTALLER_A, VA], scope: 'currentuser', toastKey: 'app.upgradeReattached' }); break
      case '5':
        expect(INSTALLER_OLD && VOLD, 'T0862_INSTALLER_OLD').toBeTruthy()
        await scenario5()
        break
      case '6': await scenario6(); break
      case '7': await upgradeScenario({ title: TITLES[7], first: [INSTALLER_A, VA], second: [INSTALLER_B, VB], scope: 'currentuser', toastKey: 'app.upgradeReattached', agent: true }); break
      case '8': await scenario8(); break
      case '9': await scenario9(); break
    }
  } catch (err) {
    error = err
  } finally {
    try { copyLogs() } catch { /* no logs */ }
    writeReport(TITLES[SCENARIO] ?? '?', error)
  }
  if (error) throw error
  expect(checks.filter(c => !c.ok).map(c => c.name)).toEqual([])
})
