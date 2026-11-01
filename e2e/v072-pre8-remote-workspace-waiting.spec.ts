// T0748 (v0.7.2-pre.8 remote acceptance of T0735 / D200–D203): a tab of a WSL remote workspace waits
// for the user → the ⚠️ on that workspace's row in the BAT window on this machine (the remote profile
// window). T0735 / T0736 covered local tabs only; here the wait is detected by a headless bat-server in
// WSL and reaches the window as the server's `terminal:attention-changed` over the remote connection.
//
// A BAT window is bound to one profile (PLAN-039): local workspaces live in the local window, remote
// ones in the remote profile window, and a remote server's events only reach that profile's windows.
// So "A looked at, R holds the tab" is: in the remote window R2 (looked at) and R (holds the tabs);
// the local window has A. ④ checks both windows at once (each counts only its own tabs).
//
// The WSL side never touches the user's own bat-server: a test-only server is started directly (no
// systemd) from a copy of the installed bundle (`~/.local/bat-server`, read only) with this source
// tree's headless JS and helpers built into a temp dir (esbuild, the settings of
// scripts/build-server-bundle.mjs) — all under /tmp/bat-e2e-t0748, its own dataDir / port / token, an
// empty temp HOME and a minimal env. The distro must already be running (it is never started,
// stopped or reconfigured); nothing is installed. Every process of the test server carries
// T0748_E2E_TAG in its environment, so cleanup finds them; /tmp/bat-e2e-t0748 is removed after.
//
// No token is spent: ① runs the bundle's real claude CLI against fixtures/fake-anthropic-api.ts on
// this machine (WSL in mirrored networking reaches 127.0.0.1), HTTPS_PROXY → a refusing proxy that
// records every attempt, a temp HOME whose .claude.json pre-answers the first-run screens.
//
//   ② R's shell tab prints codex's OSC 7501 `blocked` → `input` → R's row ⚠️ (tooltip = the reason);
//      `idle` → no longer waiting
//   ③ that wait ended while R was not looked at → R's row faded ⚠️; R + the tab selected in the focused
//      window → cleared (D203; logged and skipped when Playwright cannot give the window OS focus)
//   ① R: a Claude CLI tab from the "+" menu; the fake answers a Bash tool_use → claude's own
//      PermissionRequest hook (on the server) → R's row ⚠️, tooltip = the permission reason, never the
//      command
//   ④ ① waiting + R's shell blocked again (R ⚠️ 2, remote window total ⚠️ 2) + a local tab in A blocked
//      (local window A ⚠️, its total ⚠️) — neither window counts the other's tabs; a click on R's
//      ⚠️ 2 → R active, the claude tab (waiting longest) selected; then every wait answered
//   ⑤ the test server stopped and started again (T0749 / BUG-182): the old PTY is gone on the restarted
//      server → after reconnecting the window's snapshot drops the solid ⚠️ (faded: not seen, D203), the
//      totals no longer count it; looked at → cleared
//
// Windows host + WSL distro (default Ubuntu-24.04, BAT_E2E_T0748_DISTRO) with an installed bat-server
// bundle; otherwise skipped. Isolated source build (dist-electron), see fixtures/electron-isolation.ts.

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { MAIN_BUNDLE, REPO_ROOT, closeIsolated, freePort, launchIsolated, run, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { startBlockingProxy, startFakeAnthropicApi, type Scenario } from './fixtures/fake-anthropic-api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0748')
const DISTRO = process.env.BAT_E2E_T0748_DISTRO || 'Ubuntu-24.04'
const ROOT = '/tmp/bat-e2e-t0748'
const TAG = 'T0748_E2E_TAG=bat-e2e-t0748'
const WS_A = 'e2e-t0748-a'
const WS_R = 'e2e-t0748-remote'
const WS_R2 = 'e2e-t0748-other'
const TAB_A = 'e2e-t0748-a-shell'
const TAB_R = 'e2e-t0748-r-shell'
const TAB_R2 = 'e2e-t0748-r2-shell'
const TITLE_A = 'T0748 A shell'
const TITLE_R = 'T0748 R shell'
const FAKE_KEY = 'sk-t0748-fake-key-not-checked-0000000000'
const SECRET = 't0748-secret-cmd' // in the tool command: must never reach a tooltip or a log
const CLAUDE_ITEM = /^\s*▶\s*Claude CLI\s*(suggested|建議|建议)?\s*$/
const PERMISSION_TIP = /權限確認|permission prompt|权限确认/
const INPUT_TIP = /codex 等待輸入|codex needs input|codex 等待输入/
const OSC_BASH = (state: string) => `printf '\\033]7501;state=${state}:app=codex\\007'; echo t0748-osc-${state}\r`
const OSC_PWSH = (state: string) => `[Console]::Write([string][char]27 + ']7501;state=${state}:app=codex' + [string][char]7); 't0748-osc-${state}'\r`

const SCENARIOS: Record<string, Scenario> = {
  't0748-perm': ({ step }) => [
    // port 9 is closed: the command (if approved) fails at once and never leaves the machine
    { tool: { name: 'Bash', input: { command: `curl -s --max-time 3 http://127.0.0.1:9/${SECRET}`, description: 'T0748 permission probe (a closed local port)' } } },
    { text: ['perm ', 'done'] },
  ][step] ?? null,
}

// ── WSL ──────────────────────────────────────────────────────────────────────

/** `bash -c <script> bash <args…>` in the distro (no login profile); never throws. */
async function wsl(script: string, args: string[] = [], timeout = 60_000): Promise<string> {
  return run('wsl.exe', ['-d', DISTRO, '--exec', 'bash', '-c', script, 'bash', ...args], timeout)
    .catch((err: AnyApi) => `ERR ${String(err?.stdout ?? '')}${String(err?.stderr ?? err?.message ?? '')}`)
}

function distroRunning(): boolean {
  if (process.platform !== 'win32') return false
  try {
    const out = execFileSync('wsl.exe', ['-l', '--running', '-q'], { timeout: 15_000, windowsHide: true })
    return out.toString('utf16le').replace(/\0/g, '').split(/\r?\n/).map(s => s.trim()).includes(DISTRO)
  } catch {
    return false
  }
}

/**
 * What must be the same before and after: the user's home entries, the installed bundle, the user's
 * systemd units and their bat-server, listeners, the processes that existed before (by pid). Only
 * hashes / counts / ports / process names are kept (no home path, no user name).
 */
const USER_STATE = `
echo "## home"; ls -A "$HOME" | sha256sum | cut -c1-16
echo "## install"; find "$HOME/.local/bat-server" -printf '%P %s %T@\\n' 2>/dev/null | sort | sha256sum | cut -c1-16
echo "## units"; ls -A "$HOME/.config/systemd/user" 2>/dev/null | sha256sum | cut -c1-16
echo "## bat-units"; systemctl --user list-units --all --no-legend 'bat*' 2>&1 | awk '{print $1, $3, $4}'
echo "## bat-server"; systemctl --user show -p MainPID -p ActiveState bat-server 2>&1 | tr '\\n' ' '; echo
echo "## listeners"; ss -tlnH | awk '{print $4}' | sort | tr '\\n' ' '; echo
echo "## pids"; ps -eo pid=,comm= | awk '{print $1":"$2}' | tr '\\n' ' '; echo
echo "## tagged"; grep -lsa '${TAG}' /proc/[0-9]*/environ 2>/dev/null | wc -l
echo "## root"; [ -e ${ROOT} ] && echo present || echo absent
`

function section(text: string, name: string): string {
  const hit = text.split(/^## /m).find(p => p.startsWith(`${name}\n`))
  return hit ? hit.slice(name.length + 1).trim() : ''
}

/** Copies the installed bundle (read only) to ROOT/install and lays this tree's headless JS + helpers over it. */
async function buildAndInstall(tmp: string): Promise<string> {
  const out = path.join(tmp, 'headless')
  const dd = await import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'dev-deploy-headless.mjs')).href)
  const config = dd.loadBuildConfig()
  const { build } = await import(pathToFileURL(path.join(REPO_ROOT, 'node_modules', 'esbuild', 'lib', 'main.js')).href)
  await build({
    entryPoints: config.entryPoints.map((e: string) => path.join(REPO_ROOT, ...e.split('/'))),
    outdir: path.join(out, 'remote'),
    ...config.options,
    logLevel: 'warning',
    external: config.externals,
  })
  dd.stageHelperScripts(dd.loadHelperScripts(), path.join(out, 'scripts'))
  const linuxOut = (await wsl('wslpath -u "$1"', [out])).trim()
  return wsl(`set -e
R=${ROOT}; W="$1"
[ -x "$HOME/.local/bat-server/bin/node" ] || { echo NO-INSTALL; exit 3; }
mkdir -p $R/home/.claude $R/data $R/ws/r $R/ws/r2
cp -a "$HOME/.local/bat-server" $R/install
cp "$W"/remote/*.js $R/install/electron/remote/
cp "$W"/scripts/* $R/install/scripts/
echo "installed version $(sed -n 's/.*"version": *"\\([^"]*\\)".*/\\1/p' $R/install/package.json)"
echo "claude $(sed -n 's/.*"version": *"\\([^"]*\\)".*/\\1/p' $R/install/node_modules/@anthropic-ai/claude-code-linux-x64/package.json)"
command -v curl >/dev/null && echo curl-ok || echo curl-missing`, [linuxOut], 180_000)
}

interface ServerArgs { port: number; token: string; fakePort: number; proxyPort: number }

async function startServer(a: ServerArgs): Promise<string> {
  return wsl(`R=${ROOT}; cd $R || exit 3
setsid nohup env -i HOME=$R/home PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin SHELL=/bin/bash LANG=C.UTF-8 TERM=xterm-256color ${TAG} \\
  ANTHROPIC_BASE_URL=http://127.0.0.1:$3 ANTHROPIC_API_KEY=$5 CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1 \\
  HTTPS_PROXY=http://127.0.0.1:$4 HTTP_PROXY=http://127.0.0.1:$4 NO_PROXY=127.0.0.1,localhost \\
  $R/install/bin/node $R/install/bin/bat-server.mjs --data-dir $R/data --port "$1" --bind-interface localhost --token "$2" >>$R/server.log 2>&1 </dev/null &
echo $! > $R/server.pid
for i in $(seq 1 60); do ss -tlnH | grep -q "127.0.0.1:$1 " && { echo listening; exit 0; }; sleep 0.5; done
echo not-listening; tail -20 $R/server.log`, [String(a.port), a.token, String(a.fakePort), String(a.proxyPort), FAKE_KEY], 60_000)
}

async function stopServer(): Promise<string> {
  return wsl(`R=${ROOT}; [ -f $R/server.pid ] || { echo no-pid; exit 0; }
P=$(cat $R/server.pid); kill $P 2>/dev/null
for i in $(seq 1 40); do kill -0 $P 2>/dev/null || { echo stopped; exit 0; }; sleep 0.25; done
kill -9 $P 2>/dev/null; echo killed`)
}

/** Every process left with the tag (the server, its shells, claude): SIGTERM, then SIGKILL; then ROOT. */
async function cleanupWsl(): Promise<string> {
  return wsl(`R=${ROOT}
tagged() { grep -lsa '${TAG}' /proc/[0-9]*/environ 2>/dev/null | sed 's#/proc/\\([0-9]*\\)/environ#\\1#' | grep -vx "$$"; }
P=$(tagged); echo "tagged before: $(echo $P | wc -w) ($(for p in $P; do cat /proc/$p/comm 2>/dev/null; done | sort | uniq -c | tr -s ' ' | tr '\\n' ','))"
[ -n "$P" ] && kill $P 2>/dev/null; sleep 1
P=$(tagged); [ -n "$P" ] && { echo "SIGKILL $(echo $P | wc -w)"; kill -9 $P 2>/dev/null; sleep 0.5; }
echo "tagged after: $(tagged | wc -w)"
rm -rf $R && echo "removed ${ROOT}"`)
}

// ── UI ───────────────────────────────────────────────────────────────────────

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

const rowOf = (win: Page, name: string): Locator => win.locator('.workspace-item', { hasText: name })
const badgeOf = (win: Page, name: string): Locator => rowOf(win, name).locator('.workspace-waiting-badge')
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const thumbOf = (win: Page, title: string): Locator => win.locator('.workspace-container.active .thumbnail')
  .filter({ has: win.locator('.thumbnail-title > span', { hasText: new RegExp(`^${escapeRe(title)}$`) }) })

async function selectWorkspace(win: Page, name: string): Promise<void> {
  await rowOf(win, name).locator('.workspace-folder').click()
  await expect(rowOf(win, name)).toHaveClass(/\bactive\b/)
}

/** The 工作區 tab title's total (shown while the 塔台 tab is the visible one); back to the 工作區 tab after. */
async function windowTotal(win: Page): Promise<{ text: string; count: string | null; kind: string | null }> {
  const tabs = win.locator('.left-sidebar-tab')
  await tabs.nth(1).click()
  const badge = tabs.first().locator('.workspace-waiting-badge')
  await expect(badge).toHaveCount(1, { timeout: 10_000 })
  const value = { text: (await badge.textContent())?.trim() ?? '', count: await badge.getAttribute('data-waiting-count'), kind: await badge.getAttribute('data-waiting') }
  await tabs.first().click()
  await expect(tabs.first()).toHaveClass(/\bactive\b/)
  return value
}

async function focusWindow(app: ElectronApplication, page: Page): Promise<boolean> {
  const url = page.url()
  await app.evaluate(({ BrowserWindow }, u) => {
    const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL() === u)
    w?.show()
    w?.focus()
  }, url)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  return page.evaluate(() => document.hasFocus())
}

test.skip(process.platform !== 'win32', 'Windows host with WSL only')
test.skip(!fs.existsSync(MAIN_BUNDLE), 'dist-electron/ missing — run `npx vite build` first')
test.skip(process.platform === 'win32' && !distroRunning(), `WSL distro ${DISTRO} is not running (this test never starts it)`)

test('WSL remote workspace: tab waits (codex OSC 7501 / real claude hook on the server) → the remote window row ⚠️, faded, totals per window, jump (no token)', async () => {
  test.setTimeout(600_000)
  const startedAt = Date.now()
  const results: Record<string, string> = {}
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0748-'))
  const folderA = path.join(tmp, 'a')
  fs.mkdirSync(folderA, { recursive: true })

  const before = await wsl(USER_STATE)
  log(`WSL before: ${before.replace(/^## pids\n.*$/m, '## pids <list>').replace(/\n/g, ' | ')}`)
  expect(section(before, 'root'), `${ROOT} already exists: a previous run did not clean up`).toBe('absent')

  const fake = await startFakeAnthropicApi(SCENARIOS)
  const proxy = await startBlockingProxy()
  const port = await freePort()
  const token = `t0748-${randomBytes(18).toString('base64url')}`
  let inst: IsolatedInstance | undefined
  let failure: unknown
  const serverLog = async () => (await wsl(`cat ${ROOT}/server.log 2>/dev/null`)).replace(/\r/g, '')
  const waitServerLog = async (re: RegExp, what: string, timeout = 60_000) => {
    try {
      await expect.poll(async () => re.test(await serverLog()), { timeout, intervals: [1_000] }).toBe(true)
    } catch (error) {
      log(`${what}: not seen. server log tail:\n${(await serverLog()).split('\n').slice(-40).map(l => l.slice(0, 300)).join('\n')}`)
      throw error
    }
  }

  try {
    // ── WSL: the test server ──
    const installed = await buildAndInstall(tmp)
    log(`install: ${installed.replace(/\n/g, ' | ')}`)
    expect(installed).toContain('installed version')
    const started = await startServer({ port, token, fakePort: fake.port, proxyPort: proxy.port })
    log(`server on 127.0.0.1:${port}: ${started.trim().replace(/\n/g, ' | ')}`)
    expect(started).toContain('listening')
    const fingerprint = (await wsl(`sed -n 's/^.*"fingerprint"[[:space:]]*:[[:space:]]*"\\([0-9A-Fa-f:]*\\)".*$/\\1/p' ${ROOT}/data/server-cert.json`)).trim()
    expect(fingerprint).toMatch(/^[0-9A-F:]{95}$/i)
    // claude's first-run screens, answered ahead (as T0736); the default permission mode
    const project = { hasTrustDialogAccepted: true, hasCompletedProjectOnboarding: true, allowedTools: [] }
    const claudeJson = JSON.stringify({
      hasCompletedOnboarding: true, theme: 'dark', numStartups: 5, hasSeenAutoDefaultNudge: true,
      customApiKeyResponses: { approved: [FAKE_KEY.slice(-20)], rejected: [] },
      projects: { [`${ROOT}/ws/r`]: project, [`${ROOT}/ws/r2`]: project },
    })
    const wrote = await wsl(`printf '%s' "$1" > ${ROOT}/home/.claude.json && printf '%s' "$2" > ${ROOT}/home/.claude/settings.json && echo ok`,
      [claudeJson, JSON.stringify({ permissions: { defaultMode: 'default' } })])
    expect(wrote.trim()).toBe('ok')
    log(`fake Anthropic API ${fake.baseUrl}; blocking proxy ${proxy.url}`)

    // ── this machine: the isolated BAT, local window with A ──
    inst = await launchIsolated('t0748', log)
    const { app, win, userData } = inst
    const debugLog = () => {
      const dir = path.join(userData, 'Logs')
      return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    }
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify({
      workspaces: [{ id: WS_A, name: WS_A, folderPath: folderA, createdAt: Date.now() }],
      activeWorkspaceId: WS_A, activeGroup: null,
      terminals: [{ id: TAB_A, workspaceId: WS_A, type: 'terminal', title: TITLE_A, cwd: folderA }],
      activeTerminalId: TAB_A,
    }))).toBe(true)
    // the Control Tower panel docked left → the 工作區 / 塔台 tabs (the totals, D202 ②); same origin for both windows
    await win.evaluate(() => {
      const raw = localStorage.getItem('better-terminal-docking-config')
      localStorage.setItem('better-terminal-docking-config', JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), 'control-tower': 'left' }))
    })
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(rowOf(win, WS_A)).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TAB_A), { timeout: 30_000 }).not.toBeNull()

    // ── the remote profile window (WSL) with R and R2 ──
    const profileId = await win.evaluate(async ({ p, t, fp, distro }) => {
      const api = (window as AnyApi).electronAPI
      const created = await api.profile.create('e2e-t0748 WSL', { type: 'remote', remoteHost: '127.0.0.1', remotePort: p, remoteToken: t, remoteFingerprint: fp })
      await api.profile.update(created.id, { targetOS: 'wsl-linux', wslDistro: distro })
      return created.id as string
    }, { p: port, t: token, fp: fingerprint, distro: DISTRO })
    const opened = await win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), profileId) as { windowIds?: string[]; error?: string }
    log(`openNewInstance → ${JSON.stringify(opened)}`)
    expect(opened.error).toBeUndefined()
    const needle = `windowId=${encodeURIComponent(opened.windowIds![0])}`
    let rwin: Page | undefined
    await expect.poll(() => (rwin = app.windows().find(p => p.url().includes(needle))) !== undefined, { timeout: 30_000 }).toBe(true)
    const r = rwin!
    await r.waitForLoadState('domcontentloaded')
    const connected = () => r.evaluate(async () => ((await (window as AnyApi).electronAPI.remote.clientStatus()) as { connected: boolean }).connected)
    await expect.poll(connected, { timeout: 30_000 }).toBe(true)
    expect(await r.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify({
      workspaces: [
        { id: WS_R, name: WS_R, folderPath: `${ROOT}/ws/r`, createdAt: Date.now() },
        { id: WS_R2, name: WS_R2, folderPath: `${ROOT}/ws/r2`, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_R, activeGroup: null,
      terminals: [
        { id: TAB_R, workspaceId: WS_R, type: 'terminal', title: TITLE_R, cwd: `${ROOT}/ws/r` },
        { id: TAB_R2, workspaceId: WS_R2, type: 'terminal', title: 'T0748 R2 shell', cwd: `${ROOT}/ws/r2` },
      ],
      activeTerminalId: TAB_R,
    }))).toBe(true)
    await r.reload()
    await r.waitForLoadState('domcontentloaded')
    await expect.poll(connected, { timeout: 30_000 }).toBe(true)
    await expect(rowOf(r, WS_R)).toHaveClass(/\bactive\b/, { timeout: 30_000 })
    const buffer = async (page: Page, id: string) => ((await page.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id)) as { data?: string } | null)?.data ?? ''
    const write = (page: Page, id: string, data: string) => page.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: id, d: data })
    await expect.poll(async () => stripAnsi(await buffer(r, TAB_R)).includes('$'), { timeout: 30_000, message: 'remote shell prompt' }).toBe(true)
    const where = await (async () => {
      await write(r, TAB_R, 'echo "t0748-where $(uname -s) $PWD ${T0748_E2E_TAG:-untagged}"\r')
      let line = ''
      await expect.poll(async () => (line = /t0748-where Linux \S+ \S+/.exec(stripAnsi(await buffer(r, TAB_R)))?.[0] ?? ''), { timeout: 15_000 }).not.toBe('')
      return line
    })()
    log(`remote shell: ${where}`)
    expect(where).toBe(`t0748-where Linux ${ROOT}/ws/r bat-e2e-t0748`) // runs in WSL, on the test server
    // the Claude CLI tab in R ("+" menu), started now so ① only waits for the model turn
    const savedTabs = async () => JSON.parse(await r.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())).terminals as Array<{ id: string; workspaceId: string; title?: string; agentPreset?: string }>
    const known = new Set((await savedTabs()).map(t => t.id))
    await r.locator('.workspace-container.active .thumbnail-add-btn').click()
    await r.locator('.thumbnail-add-menu-item', { hasText: CLAUDE_ITEM }).first().click()
    let cli: { id: string; workspaceId: string; title?: string; agentPreset?: string } | undefined
    await expect.poll(async () => (cli = (await savedTabs()).find(t => !known.has(t.id))) !== undefined, { timeout: 15_000 }).toBe(true)
    log(`claude tab: ${JSON.stringify(cli)}`)
    expect(cli).toMatchObject({ workspaceId: WS_R, agentPreset: 'claude-cli' })
    const claude = cli!
    await waitServerLog(new RegExp(`\\[agent-start\\].*${escapeRe(claude.id)}.*started \\(hook session-start\\)|terminal=${escapeRe(claude.id)}.*started \\(hook session-start\\)`), 'claude SessionStart on the server', 120_000)
    await win.waitForTimeout(2_000)
    await selectWorkspace(r, WS_R2)
    const rBadge = badgeOf(r, WS_R)
    await expect(rBadge).toHaveCount(0)
    await expect(badgeOf(r, WS_R2)).toHaveCount(0)
    await expect(win.locator('.workspace-waiting-badge')).toHaveCount(0)

    // ── ② codex OSC 7501 in R's shell → input → R's row ⚠️ ──
    await write(r, TAB_R, OSC_BASH('blocked'))
    await waitServerLog(new RegExp(`${escapeRe(TAB_R)}.*→ blocked reason=input \\(osc\\)`), '② input on the server')
    await expect(rBadge).toHaveText('⚠️', { timeout: 15_000 })
    await expect(rBadge).toHaveAttribute('data-waiting', 'waiting')
    await expect(rBadge).toHaveAttribute('data-waiting-target', TAB_R)
    const tip2 = (await rBadge.getAttribute('title')) ?? ''
    log(`② R row tooltip: ${JSON.stringify(tip2)}`)
    expect(tip2).toContain(TITLE_R)
    expect(tip2).toMatch(INPUT_TIP)
    await expect(badgeOf(r, WS_R2)).toHaveCount(0)
    await expect(win.locator('.workspace-waiting-badge')).toHaveCount(0) // the local window never sees remote tabs
    await r.screenshot({ path: test.info().outputPath('2-remote-row-input.png') })
    await write(r, TAB_R, OSC_BASH('idle'))
    await waitServerLog(new RegExp(`${escapeRe(TAB_R)}.*→ cleared \\(osc idle\\)`), '② cleared on the server')
    await expect(rBadge).not.toHaveAttribute('data-waiting', 'waiting', { timeout: 15_000 })
    results['②'] = `PASS — remote shell OSC 7501 blocked → server ${TAB_R} input (osc) → remote window R row ⚠️ (target ${TAB_R}, tooltip "${TITLE_R}" + input reason); local window no badge; idle → not waiting`

    // ── ③ ended unseen → faded; R + the tab looked at in the focused window → cleared ──
    await expect(rBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
    await expect(rBadge).toHaveClass(/\bmissed\b/)
    await expect(rBadge).toHaveAttribute('title', /\d{1,2}:\d{2}/)
    const missedTotal = await windowTotal(r)
    log(`③ remote window total while faded: ${JSON.stringify(missedTotal)}`)
    expect(missedTotal.kind).toBe('missed')
    await r.screenshot({ path: test.info().outputPath('3-remote-row-faded.png') })
    const focused3 = await focusWindow(app, r)
    log(`③ remote window document.hasFocus() = ${focused3}`)
    await selectWorkspace(r, WS_R)
    await thumbOf(r, TITLE_R).click()
    if (focused3) {
      await expect(rBadge).toHaveCount(0, { timeout: 15_000 })
      results['③'] = 'PASS — the wait ended while R was not looked at → R row faded ⚠️ (time in tooltip), remote total faded; R + its tab selected in the focused remote window → cleared'
    } else {
      await expect(rBadge).toHaveAttribute('data-waiting', 'missed')
      test.info().annotations.push({ type: 'skip-step', description: '③ window focus unavailable: "cleared once looked at" not checked' })
      results['③'] = 'PARTIAL — faded ⚠️ checked; the clearing once looked at needs OS focus, which this run did not get'
    }

    // ── ① the real claude CLI on the server: Bash → PermissionRequest hook → R's row ⚠️ ──
    await thumbOf(r, claude.title!).click()
    await selectWorkspace(r, WS_R2)
    await write(r, claude.id, '[[T0727:t0748-perm]] run the probe')
    await r.waitForTimeout(600)
    await write(r, claude.id, '\r')
    await fake.waitFor('t0748-perm', 0, 90_000).catch(async (e) => { log(`claude screen:\n${stripAnsi(await buffer(r, claude.id)).slice(-2500)}`); throw e })
    await waitServerLog(new RegExp(`${escapeRe(claude.id)}.*→ blocked reason=permission \\(hook permission-request tool=Bash`), '① permission on the server')
    await expect(rBadge).toHaveText('⚠️', { timeout: 15_000 })
    await expect(rBadge).toHaveAttribute('data-waiting', 'waiting')
    await expect(rBadge).toHaveAttribute('data-waiting-target', claude.id)
    const tip1 = (await rBadge.getAttribute('title')) ?? ''
    log(`① R row tooltip: ${JSON.stringify(tip1)}`)
    expect(tip1).toContain(claude.title!)
    expect(tip1).toMatch(PERMISSION_TIP)
    expect(tip1).not.toContain(SECRET)
    expect(tip1).not.toContain('127.0.0.1:9')
    expect(stripAnsi(await buffer(r, claude.id))).toContain(SECRET) // the prompt really shows the command
    await r.screenshot({ path: test.info().outputPath('1-remote-claude-permission.png') })
    results['①'] = `PASS — real claude CLI (the bundle's, on the WSL test server) + fake API: Bash tool_use → PermissionRequest hook → server ${claude.id} permission → R row ⚠️ (target ${claude.id}), tooltip "${claude.title}" + permission reason, no command text`

    // ── ④ remote + local waits at once: per-window rows and totals; the jump ──
    await write(r, TAB_R, OSC_BASH('blocked'))
    await waitServerLog(new RegExp(`${escapeRe(TAB_R)}.*→ blocked reason=input \\(osc\\)[\\s\\S]*${escapeRe(TAB_R)}.*→ blocked reason=input \\(osc\\)`), '④ R shell input again')
    await expect(rBadge).toHaveText('⚠️ 2', { timeout: 15_000 })
    await expect(rBadge).toHaveAttribute('data-waiting-target', claude.id) // the one waiting longest
    await write(win, TAB_A, OSC_PWSH('blocked'))
    await expect.poll(() => debugLog().split('\n').some(l => l.includes(TAB_A) && /→ blocked reason=input \(osc\)/.test(l)), { timeout: 30_000 }).toBe(true)
    const aBadge = badgeOf(win, WS_A)
    await expect(aBadge).toHaveText('⚠️', { timeout: 15_000 })
    await expect(aBadge).toHaveAttribute('data-waiting-target', TAB_A)
    const remoteTotal = await windowTotal(r)
    const localTotal = await windowTotal(win)
    log(`④ totals: remote window ${JSON.stringify(remoteTotal)}, local window ${JSON.stringify(localTotal)}`)
    expect(remoteTotal).toEqual({ text: '⚠️ 2', count: '2', kind: 'waiting' })
    expect(localTotal).toEqual({ text: '⚠️', count: '1', kind: 'waiting' })
    await expect(r.locator('.workspace-item', { hasText: WS_A })).toHaveCount(0)
    await expect(win.locator('.workspace-item', { hasText: WS_R })).toHaveCount(0)
    await r.screenshot({ path: test.info().outputPath('4-remote-window-2.png') })
    await win.screenshot({ path: test.info().outputPath('4-local-window-1.png') })
    await rBadge.click()
    await expect(rowOf(r, WS_R)).toHaveClass(/\bactive\b/, { timeout: 10_000 })
    await expect(thumbOf(r, claude.title!)).toHaveClass(/\bactive\b/, { timeout: 10_000 })
    await expect.poll(() => debugLog().includes(`[workspace-waiting] go to workspace=${WS_R} terminal=${claude.id}`), { timeout: 10_000 }).toBe(true)
    results['④-totals'] = 'PASS — remote window: R row ⚠️ 2 (claude permission + shell input), total ⚠️ 2; local window: A row ⚠️, total ⚠️ (1); neither lists / counts the other\'s workspace'
    results['④-jump'] = `PASS — a click on R's ⚠️ 2 → R active, "${claude.title}" (waiting longest) selected`

    // answers: claude looked at (Enter = yes), R shell and A not looked at
    const focused4 = await focusWindow(app, r)
    log(`④ remote window document.hasFocus() = ${focused4}`)
    await write(r, claude.id, '\r')
    await waitServerLog(new RegExp(`${escapeRe(claude.id)}.*→ cleared \\(`), '① cleared on the server', 30_000)
    await fake.waitFor('t0748-perm', 1, 60_000).catch(async (e) => { log(`claude screen:\n${stripAnsi(await buffer(r, claude.id)).slice(-2500)}`); throw e })
    await expect(rBadge).toHaveText('⚠️', { timeout: 15_000 })
    await expect(rBadge).toHaveAttribute('data-waiting-target', TAB_R)
    if (focused4) await expect(thumbOf(r, claude.title!).locator('.attention-badge')).toHaveCount(0, { timeout: 15_000 })
    await write(r, TAB_R, OSC_BASH('idle'))
    await expect(rBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
    await write(win, TAB_A, OSC_PWSH('idle'))
    // A is the local window's active workspace and tab: seen during the wait (the window was clicked) →
    // cleared, otherwise faded; either way no longer waiting
    let aAfter = ''
    await expect.poll(async () => (aAfter = (await aBadge.count()) === 0 ? 'cleared' : (await aBadge.getAttribute('data-waiting')) ?? ''), { timeout: 15_000 }).toMatch(/^(cleared|missed)$/)
    results['④-answers'] = `PASS — Enter on claude's prompt (looked at, focus=${focused4}) → cleared, the approved turn went on; R shell idle (not looked at) → R row faded; A idle → ${aAfter}`

    // ── ⑤ the server stopped / started again (T0749 / BUG-182) ──
    // R's shell blocked; the claude tab exits first (a restarted server would start claude again).
    // The restarted server has no PTY for the old tabs (and never sends their exit): after the window
    // connects again it asks the server (`terminal:attention-snapshot`) and drops the ⚠️ of the tabs
    // whose PTY is gone, as a PTY exit — the wait was not seen (R's active tab is the claude tab), so
    // it ends as a faded ⚠️ (D203) and the totals no longer count it.
    await write(r, claude.id, '/exit\r')
    await write(r, TAB_R, OSC_BASH('blocked'))
    await expect(rBadge).toHaveAttribute('data-waiting', 'waiting', { timeout: 15_000 })
    await expect(rBadge).toHaveAttribute('data-waiting-target', TAB_R, { timeout: 15_000 })
    await expect(rBadge).toHaveText('⚠️', { timeout: 15_000 })
    const totalBefore = await windowTotal(r)
    expect(totalBefore).toMatchObject({ kind: 'waiting', count: '1' })
    const shellPid = async (mark: string) => {
      await write(r, TAB_R, `echo ${mark}-$$\r`)
      let pid = ''
      await expect.poll(async () => (pid = [...stripAnsi(await buffer(r, TAB_R)).matchAll(new RegExp(`${mark}-(\\d+)`, 'g'))].at(-1)?.[1] ?? ''), { timeout: 20_000 }).not.toBe('')
      return pid
    }
    const badgeState = async () => ({ kind: await rBadge.getAttribute('data-waiting', { timeout: 1_000 }).catch(() => null), count: await rBadge.count(), target: await rBadge.getAttribute('data-waiting-target', { timeout: 1_000 }).catch(() => null) })
    const reconcileLines = () => debugLog().split('\n').filter(l => l.includes('[attention] reconnect reconcile'))
    const reconcileBefore = reconcileLines().length
    const pidBefore = await shellPid('t0748-pid-a')
    const stopped = await stopServer()
    let disconnected = false
    await expect.poll(async () => (disconnected = !(await connected())), { timeout: 30_000 }).toBe(true).catch(() => {})
    await r.waitForTimeout(3_000)
    const whileDown = { connected: !disconnected, ...(await badgeState()) }
    const logBeforeRestart = (await serverLog()).length
    const restarted = await startServer({ port, token, fakePort: fake.port, proxyPort: proxy.port })
    expect(restarted).toContain('listening')
    let reconnected = false
    await expect.poll(async () => (reconnected = await connected()), { timeout: 90_000 }).toBe(true)
    // the solid ⚠️ goes (faded: not seen), then the reconcile log: one snapshot, the shell tab gone on the server
    await expect(rBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 30_000 })
    let reconcile = ''
    await expect.poll(() => (reconcile = reconcileLines().slice(reconcileBefore).at(-1) ?? ''), { timeout: 15_000 }).toMatch(/ gone=[1-9]\d* /)
    const afterUp = { connected: reconnected, ...(await badgeState()) }
    expect(afterUp).toMatchObject({ kind: 'missed', count: 1 })
    expect(await rBadge.textContent()).toBe('⚠️') // no count: nothing waits
    const totalAfter = await windowTotal(r)
    expect(totalAfter).toMatchObject({ kind: 'missed', count: '0' })
    const sinceRestart = (await serverLog()).slice(logBeforeRestart)
    const blockedSinceRestart = sinceRestart.split('\n').filter(l => l.includes(TAB_R) && /\[blocked\]/.test(l)).map(l => l.replace(/^.*\[blocked\]/, '[blocked]'))
    const snapshotLines = sinceRestart.split('\n').filter(l => l.includes('[attention] snapshot')).map(l => l.replace(/^.*\[attention\]/, '[attention]'))
    const cwdAfter = await r.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TAB_R).catch((e: unknown) => `error ${String(e).slice(0, 120)}`)
    const tail = stripAnsi(await buffer(r, TAB_R)).trim().split('\n').slice(-3).join(' / ').slice(-300)
    log(`⑤ after reconnect: reconcile ${JSON.stringify(reconcile.replace(/^.*\[attention\]/, '[attention]'))}; server ${JSON.stringify(snapshotLines)}; pty.getCwd = ${JSON.stringify(cwdAfter)}; screen tail: ${JSON.stringify(tail)}`)
    await r.screenshot({ path: test.info().outputPath('5-after-reconnect.png') })
    // the faded ⚠️ goes when the tab is looked at (focused window)
    const focused5 = await focusWindow(app, r)
    await selectWorkspace(r, WS_R)
    await thumbOf(r, TITLE_R).click()
    let lookedAt = await badgeState()
    if (focused5) {
      await expect(rBadge).toHaveCount(0, { timeout: 15_000 })
      lookedAt = await badgeState()
    } else {
      log(`⑤ document.hasFocus() = false — "looked at" not checked`)
    }
    log(`⑤ shell pid ${pidBefore} → stop: ${stopped.trim()} → while down ${JSON.stringify(whileDown)}; restart: ${restarted.trim().split('\n')[0]}; server [blocked] lines for ${TAB_R} since restart: ${JSON.stringify(blockedSinceRestart)}; total before ${JSON.stringify(totalBefore)} → after ${JSON.stringify(totalAfter)}; after reconnect ${JSON.stringify(afterUp)}; looked at (focus=${focused5}) ${JSON.stringify(lookedAt)}`)
    results['⑤'] = `PASS — R row waiting (${TAB_R}, shell pid ${pidBefore}), total ⚠️ 1; server stopped → while disconnected ${JSON.stringify(whileDown)}; started again, reconnected; the window's snapshot: ${reconcile.replace(/^.*reconnect reconcile /, '')} → R row faded ⚠️ (no count), total faded (count 0)${focused5 ? '; looked at → cleared' : ' (looked at: no OS focus, not checked)'}`

    // ── logs: never the command text, never a token ──
    const slog = await serverLog()
    const debug = debugLog()
    expect(slog).not.toContain(SECRET)
    expect(debug).not.toContain(SECRET)
    expect(slog).not.toContain(token)
    expect(debug).not.toContain(token)
    expect(slog).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    expect(debug).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)

    // ── nothing left the machine ──
    const modelCalls = proxy.attempts.filter(a => /anthropic\.com|openai\.com/.test(a))
    log(`fake Anthropic requests: ${fake.requests.length} (${JSON.stringify(fake.requests.map(q => `${q.model} ${q.scenario ?? '-'}#${q.step ?? '-'}`))}); proxy attempts (all refused): ${proxy.attempts.length} ${JSON.stringify(proxy.attempts)}`)
    results['network'] = `fake Anthropic ${fake.requests.length} requests (local); off-machine attempts ${proxy.attempts.length}, all refused; to a model API: ${modelCalls.length}`
    expect(modelCalls).toEqual([])
    log(`T0748 body took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  } catch (error) {
    failure = error
  } finally {
    if (inst) await closeIsolated(inst, log).catch(e => log(`closeIsolated: ${String(e)}`))
    log(`WSL stop: ${(await stopServer()).trim()}`)
    log(`WSL cleanup: ${(await cleanupWsl()).trim().replace(/\n/g, ' | ')}`)
    await fake.close()
    await proxy.close()
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
  }

  // ── the user's WSL: the same as before ──
  const after = await wsl(USER_STATE)
  const beforePids = section(before, 'pids').split(' ').filter(Boolean)
  const afterPids = new Set(section(after, 'pids').split(' ').filter(Boolean))
  const gone = beforePids.filter(p => !afterPids.has(p) && !/:(ps|awk|bash|sh|tr|wslpath|sleep|cat|grep|sed|sort|ss|\(udev-worker\)|SessionLeader|Relay\(\d+\))$/.test(p))
  const compare: Record<string, string> = {}
  for (const key of ['home', 'install', 'units', 'bat-units', 'bat-server', 'listeners', 'tagged', 'root']) {
    compare[key] = section(before, key) === section(after, key) ? 'same' : `before ${JSON.stringify(section(before, key))} after ${JSON.stringify(section(after, key))}`
  }
  log(`WSL after: ${JSON.stringify(compare)}; processes of before that are gone (short-lived tools excluded): ${JSON.stringify(gone)}`)
  log(`T0748 results: ${JSON.stringify(results, null, 2)}`)
  if (failure) throw failure
  for (const key of ['install', 'units', 'bat-units', 'bat-server', 'tagged', 'root']) expect(compare[key], key).toBe('same')
  expect(section(after, 'tagged')).toBe('0')
  expect(section(after, 'root')).toBe('absent')
})
