// T0761 (D200 ⑥ / D212): a detached workspace's "waits for the user" ⚠️ in its parent main window.
// The main list still hides the detached workspace; while a tab of it waits (or a wait ended unseen)
// a row `↗ <name> (detached) ⚠️` shows below the list, the 工作區 tab title counts it, and a click
// brings the detached window to the front on that tab.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The waiting
// tab is a raw-command tab in B (no --notify-id → not a Worker) running a node script that runs
// `bat-hook.mjs` from INSIDE that PTY with the PTY's own capability (as t0735). Nothing starts an LLM.
//
//   1. B detached → no row for B in the main window
//   2. hook ask-user-question in B's tab → main: row ⚠️ (tooltip lists the tab), tab title ⚠️
//   3. done while the detached window shows another tab → row faded (D203, decided in the detached window)
//   4. waits again → solid; a click on the row → the detached window in front, the tab selected
//   5. done while looked at in the detached window → the row goes; done while the detached window has no
//      OS focus → the row stays, faded (D203)
//   6. the detached window closes → no row, B's own row is back
//
// T0775: Playwright's focus emulation is off for both windows (e2e/helpers/real-focus.ts, CDP
// `Emulation.setFocusEmulationEnabled` false), so step 5 branches on the real OS focus of the detached
// window: its document.hasFocus() and Electron's BrowserWindow.getFocusedWindow() are logged (`[focus] …`).
// With the emulation on, document.hasFocus() was always true and step 5 never measured the focus.
// `BAT_E2E_FORCE_UNFOCUSED=1` gives the focus to a second window instead (counter-check: the faded branch).

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { closeFocusSink, disableFocusEmulation, focusEvidence, focusWindow, takeFocus } from './helpers/real-focus'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0761')
const WS_A = 'e2e-t0761-a'
const WS_B = 'e2e-t0761-b'
const NAME_B = 'T0761-B'

/** Runs `<jobs>/<terminal id>-<n>.json` helper jobs in order; writes `<n>.res.json` (as t0735). */
const jobScript = (jobsDir: string, scriptsDir: string) => `
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
const jobs = ${JSON.stringify(jobsDir)}
const scripts = ${JSON.stringify(scriptsDir)}
const id = process.env.BAT_TERMINAL_ID
let n = 0
let busy = false
fs.writeFileSync(path.join(jobs, id + '.ready'), String(Date.now()))
process.stdout.write('t0761 tab ready\\n')
setInterval(() => {
  const file = path.join(jobs, id + '-' + n + '.json')
  if (busy || !fs.existsSync(file)) return
  busy = true
  const job = JSON.parse(fs.readFileSync(file, 'utf8'))
  const child = spawn(process.execPath, [path.join(scripts, job.script), ...job.args], { env: process.env, windowsHide: true })
  let stdout = '', stderr = ''
  child.stdout.on('data', d => { stdout += d })
  child.stderr.on('data', d => { stderr += d })
  child.on('close', code => {
    fs.writeFileSync(file + '.tmp', JSON.stringify({ code, stdout, stderr }))
    fs.renameSync(file + '.tmp', path.join(jobs, id + '-' + n + '.res.json'))
    n++
    busy = false
  })
  child.stdin.end(job.stdin || '')
}, 100)
`

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }

function runHelper(script: string, env: NodeJS.ProcessEnv, args: string[], cwd: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      resolve({ code, stdout: String(stdout), stderr: String(stderr), terminalId: /Terminal created: (\S+)/.exec(String(stdout))?.[1] })
    })
  })
}

/** Env for helpers the test runs itself (creating the tab): the server token, as t0735. */
async function helperEnv(app: ElectronApplication, userData: string, remotePort: number, tmp: string): Promise<NodeJS.ProcessEnv> {
  await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
  const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
  const token: string = record.encrypted
    ? await app.evaluate(async ({ safeStorage }, data) => (await safeStorage.decryptStringAsync(Buffer.from(data, 'base64'))).result, record.data as string)
    : record.data
  const env: NodeJS.ProcessEnv = {}
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) env[k] = v
  return Object.assign(env, {
    BAT_REMOTE_PORT: String(remotePort),
    BAT_REMOTE_TOKEN: token,
    BAT_SERVER_CERT_PATH: path.join(userData, 'server-cert.json'),
    BAT_HELPER_LOG_DIR: path.join(tmp, 'helper-logs'),
    BAT_USER_DATA: tmp,
  })
}

/** Which BrowserWindow has the OS focus: 'detached' / 'main' / 'none'. */
const focusedWindow = (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getFocusedWindow()
  if (!w) return 'none'
  return w.webContents.getURL().includes('detached=') ? 'detached' : 'main'
})

const activeThumbTitle = (page: Page) => page.evaluate(() =>
  document.querySelector('.workspace-container.active .thumbnail.active .thumbnail-title')?.textContent ?? '')

test('a detached workspace waiting for the user shows a row in the main window; a click brings its window on the tab', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0761-'))
  const folderA = path.join(tmp, 'a')
  const folderB = path.join(tmp, 'b')
  const jobsDir = path.join(tmp, 'jobs')
  for (const dir of [folderA, folderB, jobsDir]) fs.mkdirSync(dir, { recursive: true })
  const script = path.join(tmp, 'tab.mjs').split(path.sep).join('/')
  fs.writeFileSync(script, jobScript(jobsDir, path.join(REPO_ROOT, 'scripts')))
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0761', log)
    const { app, win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_A, name: 'T0761-A', folderPath: folderA, createdAt: Date.now() },
        { id: WS_B, name: NAME_B, folderPath: folderB, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_A,
      activeGroup: null,
      terminals: [
        { id: 'e2e-t0761-a-shell', workspaceId: WS_A, type: 'terminal', title: 'Shell A', cwd: folderA },
        { id: 'e2e-t0761-b-shell', workspaceId: WS_B, type: 'terminal', title: 'Shell B', cwd: folderB },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    // the Control Tower panel docked left → the 工作區 tab title carries the total (D202 ②)
    await win.evaluate(() => {
      const raw = localStorage.getItem('better-terminal-docking-config')
      const config = raw ? JSON.parse(raw) : {}
      localStorage.setItem('better-terminal-docking-config', JSON.stringify({ ...config, 'control-tower': 'left' }))
    })
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const recovery = win.locator('.recovery-prompt-dialog')
    if (await recovery.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false)) {
      await recovery.locator('.recovery-prompt-actions .btn-primary').click()
      await expect(win.locator('.recovery-prompt-overlay')).toHaveCount(0, { timeout: 10_000 })
      log('answered the Recovery prompt after the reload (keep)')
    }
    const rowB = win.locator('.workspace-list .workspace-item', { hasText: NAME_B })
    await expect(rowB).toBeVisible({ timeout: 30_000 })
    // T0775: the real OS focus from here on (step 5 branches on it)
    await disableFocusEmulation(app, win)
    log(`[focus] main: emulation off: ${JSON.stringify(await focusEvidence(app, win))}`)

    // ── 1. B detached → hidden in the main list, no row ──
    const opened = app.waitForEvent('window', { timeout: 30_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_B)).toBe(true)
    const detached = await opened
    await detached.waitForLoadState('domcontentloaded')
    await disableFocusEmulation(app, detached)
    log(`[focus] detached: emulation off: ${JSON.stringify(await focusEvidence(app, detached))}`)
    await expect(detached.locator('.workspace-container.active .thumbnail', { hasText: 'Shell B' })).toBeVisible({ timeout: 30_000 })
    await expect(rowB).toBeHidden({ timeout: 10_000 })
    const detachedRow = win.locator('.detached-waiting-item')
    await expect(detachedRow).toHaveCount(0)

    // a non-Worker tab in B, opened while B is detached
    const env = await helperEnv(app, userData, inst.remotePort, tmp)
    const created = await runHelper('bat-terminal.mjs', env, ['--workspace', WS_B, '--cwd', folderB, 'node', script], folderB)
    log(`create: exit=${created.code}\n${created.stdout}${created.stderr}`)
    expect(created.code, created.stderr).toBe(0)
    const tabId = created.terminalId!
    expect(tabId).toBeTruthy()
    await expect.poll(() => fs.existsSync(path.join(jobsDir, `${tabId}.ready`)), { timeout: 30_000 }).toBe(true)
    const tabThumb = detached.locator('.workspace-container.active .thumbnail').filter({ hasNotText: 'Shell B' })
    await expect(tabThumb).toHaveCount(1, { timeout: 15_000 })
    const tabTitle = (await tabThumb.locator('.thumbnail-title').textContent())?.trim() ?? ''
    log(`B's new tab in the detached window: id=${tabId} title="${tabTitle}"`)
    // the detached window shows Shell B, the main window has the focus → the user does not look at the tab
    await detached.locator('.workspace-container.active .thumbnail', { hasText: 'Shell B' }).click()
    await expect.poll(() => activeThumbTitle(detached), { timeout: 10_000 }).toContain('Shell B')
    const mainFocused = await focusWindow(app, win, 'main')
    log(`[focus] before the wait: main focused ${mainFocused}; main ${JSON.stringify(await focusEvidence(app, win))}; detached ${JSON.stringify(await focusEvidence(app, detached))}`)

    let jobs = 0
    const hook = async (event: string, input: Record<string, string>) => {
      const n = jobs++
      fs.writeFileSync(path.join(jobsDir, `${tabId}-${n}.json`), JSON.stringify({ script: 'bat-hook.mjs', args: [event], stdin: JSON.stringify(input) }))
      const res = path.join(jobsDir, `${tabId}-${n}.res.json`)
      await expect.poll(() => fs.existsSync(res), { timeout: 30_000 }).toBe(true)
      const out = JSON.parse(fs.readFileSync(res, 'utf8')) as HelperRun
      log(`hook ${event} → exit=${out.code}\n${out.stdout}${out.stderr}`)
      expect(out.code).toBe(0)
    }
    const ask = () => hook('ask-user-question', { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' })
    const done = () => hook('ask-user-question-done', { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion' })
    const rowBadge = detachedRow.locator('.workspace-waiting-badge')
    const tabTitleBadge = win.locator('.left-sidebar-tab').first().locator('.workspace-waiting-badge')

    // ── 2. waits → the row with a solid ⚠️; the 工作區 tab title counts it ──
    await ask()
    await expect(detachedRow).toHaveCount(1, { timeout: 15_000 })
    await expect(detachedRow).toContainText(`↗ ${NAME_B}`)
    await expect(rowBadge).toHaveText('⚠️')
    await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting')
    await expect(rowBadge).toHaveAttribute('data-waiting-target', tabId)
    await expect(detachedRow).toHaveAttribute('title', new RegExp(tabTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    await expect(rowB).toBeHidden() // the list still hides B (D201)
    await expect(tabTitleBadge).toHaveText('⚠️', { timeout: 10_000 })
    await expect(win.locator('.left-sidebar-tab').first().locator('.workspace-waiting-badge')).toHaveAttribute('title', new RegExp(`${NAME_B}`))
    await win.screenshot({ path: test.info().outputPath('detached-row-waiting.png') })
    // the detached window's own thumbnail ⚠️ as before
    await expect(tabThumb.locator('.attention-badge.blocked')).toHaveCount(1, { timeout: 10_000 })

    // ── 3. ends unseen (the detached window shows Shell B) → faded ──
    await done()
    await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
    await expect(rowBadge).toHaveClass(/\bmissed\b/)
    await win.screenshot({ path: test.info().outputPath('detached-row-missed.png') })

    // ── 4. waits again → solid; a click → the detached window in front, the tab selected ──
    await ask()
    await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting', { timeout: 15_000 })
    await detachedRow.click()
    await expect.poll(() => activeThumbTitle(detached), { timeout: 10_000 }).toContain(tabTitle)
    const focusAfterClick = await focusedWindow(app)
    log(`focused window after the click: ${focusAfterClick}`)
    expect(await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().includes('detached='))
      return !!w && w.isVisible() && !w.isMinimized()
    })).toBe(true)
    await detached.screenshot({ path: test.info().outputPath('detached-window-tab.png') })

    log(`[focus] 4. detached after the click: ${JSON.stringify(await focusEvidence(app, detached))}`)

    // ── 5. answered while looked at → the row goes; answered while the detached window has no OS focus → faded ──
    const before = await takeFocus(app, detached, 'detached', '5. before done', log)
    await done()
    const after = await focusEvidence(app, detached)
    log(`[focus] 5. after done: ${JSON.stringify(after)}`)
    // the focus must not have moved while the wait ended, or the branch below would be a guess
    expect(after.hasFocus, 'the detached window focus changed while the wait ended').toBe(before.hasFocus)
    if (before.hasFocus) {
      expect(before.focusedWindow).toBe('detached') // the OS focus is really on the detached window
      await expect(detachedRow).toHaveCount(0, { timeout: 15_000 })
      await win.waitForTimeout(1_500) // stays gone (no late faded mark)
      await expect(detachedRow).toHaveCount(0)
      log(`5. detached focused (${JSON.stringify(before)}): done while looked at → no row`)
    } else {
      expect(before.focusedWindow).not.toBe('detached')
      await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
      await expect(rowBadge).toHaveClass(/\bmissed\b/)
      log(`5. detached unfocused (${JSON.stringify(before)}): done → the row stays, faded`)
      test.info().annotations.push({ type: 'focus', description: `step 5 ran with the detached window unfocused (${JSON.stringify(before)}): faded row asserted` })
    }
    await closeFocusSink(app)

    // ── 6. the detached window closes → no row; B's own row is back ──
    await ask()
    await expect(detachedRow).toHaveCount(1, { timeout: 15_000 })
    const closed = detached.waitForEvent('close', { timeout: 15_000 })
    expect(await app.evaluate(({ BrowserWindow }) => {
      const target = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.getURL().includes('detached='))
      if (!target) return false
      target.close()
      return true
    })).toBe(true)
    await closed
    await expect(rowB).toBeVisible({ timeout: 15_000 })
    await expect(detachedRow).toHaveCount(0, { timeout: 10_000 })
    // B's tab now waits in the main window's own list (T0735 row ⚠️)
    await expect(rowB.locator('.workspace-waiting-badge')).toHaveAttribute('data-waiting', 'waiting', { timeout: 15_000 })
    await win.screenshot({ path: test.info().outputPath('reattached.png') })
  } finally {
    if (inst) {
      await closeFocusSink(inst.app)
      await closeIsolated(inst, log)
    }
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
