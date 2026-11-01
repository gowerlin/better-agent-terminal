// T0735 (D200 / D202 / D203): the workspace list shows ⚠️ when a tab of a workspace waits for the
// user — any tab, here a non-Worker "Tower" tab whose claude would run AskUserQuestion — and the
// 工作區 tab title / the collapsed sidebar show the total. A wait that ends unseen leaves a faded ⚠️.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The "Tower"
// tab is a raw-command tab (no --notify-id → not a Worker) running a node script that runs helper
// jobs the test drops into a temp dir — `bat-hook.mjs` from INSIDE that PTY, with the PTY's own
// capability (the token never leaves the PTY). Nothing starts an LLM. Workspace names are e2e-….
//
//   1. B active; the Tower tab in A: hook ask-user-question → A's row ⚠️ (left of the status dot),
//      tooltip lists the tab; the 工作區 tab title shows ⚠️ while the Control Tower tab is shown
//   2. ask-user-question-done unseen → faded ⚠️ on A's row and the tab title
//   3. waits again → solid; the sidebar collapsed → ⚠️ on the bar, its click expands the sidebar
//   4. a click on A's ⚠️ → A active, the Tower tab selected; done while looked at → no faded ⚠️;
//      done while the window has no OS focus → faded ⚠️ (D203)
//
// T0775: Playwright's focus emulation is off for the window (e2e/helpers/real-focus.ts, CDP
// `Emulation.setFocusEmulationEnabled` false), so step 4 branches on the real OS focus: the renderer's
// document.hasFocus() and Electron's BrowserWindow.getFocusedWindow() are logged (`[focus] …`). With the
// emulation on, document.hasFocus() was always true and the "no faded ⚠️" check never measured the focus.
// `BAT_E2E_FORCE_UNFOCUSED=1` gives the focus to a second window instead (counter-check: the faded branch).

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { closeFocusSink, disableFocusEmulation, focusEvidence, takeFocus } from './helpers/real-focus'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0735')
const WS_A = 'e2e-t0735-a'
const WS_B = 'e2e-t0735-b'

/** Runs `<jobs>/<terminal id>-<n>.json` helper jobs in order; writes `<n>.res.json` (as t0609). */
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
process.stdout.write('t0735 tab ready\\n')
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

/** Env for helpers the test runs itself (creating the tab): the server token, as t0538 / t0609. */
async function helperEnv(app: ElectronApplication, userData: string, remotePort: number, tmp: string): Promise<NodeJS.ProcessEnv> {
  await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
  const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
  const token: string = record.encrypted
    ? await app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(Buffer.from(data, 'base64')), record.data as string)
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

const rowOf = (win: Page, name: string) => win.locator('.workspace-item', { hasText: name })

test('workspace list ⚠️ for a non-Worker tab waiting for the user; tab title / collapsed totals; faded when missed', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0735-'))
  const folderA = path.join(tmp, 'a')
  const folderB = path.join(tmp, 'b')
  const jobsDir = path.join(tmp, 'jobs')
  for (const dir of [folderA, folderB, jobsDir]) fs.mkdirSync(dir, { recursive: true })
  const script = path.join(tmp, 'tab.mjs').split(path.sep).join('/')
  fs.writeFileSync(script, jobScript(jobsDir, path.join(REPO_ROOT, 'scripts')))
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0735', log)
    const { app, win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_A, name: WS_A, folderPath: folderA, createdAt: Date.now() },
        { id: WS_B, name: WS_B, folderPath: folderB, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_B,
      activeGroup: null,
      terminals: [
        { id: 'e2e-t0735-a-shell', workspaceId: WS_A, type: 'terminal', title: 'Shell A', cwd: folderA },
        { id: 'e2e-t0735-b-shell', workspaceId: WS_B, type: 'terminal', title: 'Shell B', cwd: folderB },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    // the Control Tower panel docked in the left side panel → the 工作區 / 塔台 tabs (D202 ②)
    await win.evaluate(() => {
      const raw = localStorage.getItem('better-terminal-docking-config')
      const config = raw ? JSON.parse(raw) : {}
      localStorage.setItem('better-terminal-docking-config', JSON.stringify({ ...config, 'control-tower': 'left' }))
    })
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(rowOf(win, WS_A)).toBeVisible({ timeout: 30_000 })
    await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    // T0775: the real OS focus from here on (step 4 branches on it)
    await disableFocusEmulation(app, win)
    log(`[focus] emulation off (CDP Emulation.setFocusEmulationEnabled false): ${JSON.stringify(await focusEvidence(app, win))}`)

    // a non-Worker tab in A (raw command, no --notify-id)
    const env = await helperEnv(app, userData, inst.remotePort, tmp)
    const created = await runHelper('bat-terminal.mjs', env, ['--workspace', WS_A, '--cwd', folderA, 'node', script], folderA)
    log(`create: exit=${created.code}\n${created.stdout}${created.stderr}`)
    expect(created.code, created.stderr).toBe(0)
    const towerId = created.terminalId!
    expect(towerId).toBeTruthy()
    await expect.poll(() => fs.existsSync(path.join(jobsDir, `${towerId}.ready`)), { timeout: 30_000 }).toBe(true)
    const saved = JSON.parse(await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) as { terminals: Array<{ id: string; workspaceId: string; towerTerminalId?: string; workorder?: string; title: string }> }
    const tab = saved.terminals.find(t => t.id === towerId)
    log(`tab: ${JSON.stringify(tab)}`)
    expect(tab?.workspaceId).toBe(WS_A)
    expect(tab?.towerTerminalId).toBeUndefined() // not a Worker
    // the helper may have switched workspaces: B is the one the user looks at
    await rowOf(win, WS_B).locator('.workspace-folder').click()
    await expect(rowOf(win, WS_B)).toHaveClass(/\bactive\b/)

    let jobs = 0
    const hook = async (event: string, input: Record<string, string>) => {
      const n = jobs++
      fs.writeFileSync(path.join(jobsDir, `${towerId}-${n}.json`), JSON.stringify({ script: 'bat-hook.mjs', args: [event], stdin: JSON.stringify(input) }))
      const res = path.join(jobsDir, `${towerId}-${n}.res.json`)
      await expect.poll(() => fs.existsSync(res), { timeout: 30_000 }).toBe(true)
      const out = JSON.parse(fs.readFileSync(res, 'utf8')) as HelperRun
      log(`hook ${event} → exit=${out.code}\n${out.stdout}${out.stderr}`)
      expect(out.code).toBe(0)
    }
    const ask = () => hook('ask-user-question', { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' })
    const done = () => hook('ask-user-question-done', { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion' })
    const rowBadge = rowOf(win, WS_A).locator('.workspace-waiting-badge')
    const tabTitle = win.locator('.left-sidebar-tab').first()

    // ── 1. waits → solid ⚠️ on A's row, left of the status dot; the 工作區 tab title too ──
    await expect(rowBadge).toHaveCount(0)
    await ask()
    await expect(rowBadge).toHaveText('⚠️', { timeout: 15_000 })
    await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting')
    await expect(rowBadge).toHaveAttribute('data-waiting-target', towerId)
    await expect(rowBadge).toHaveAttribute('title', new RegExp(`${tab!.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    await expect(rowOf(win, WS_B).locator('.workspace-waiting-badge')).toHaveCount(0)
    // same line, left of the status dot
    const order = await rowOf(win, WS_A).locator('.workspace-item-actions').evaluate(el => [...el.children].map(c => c.className))
    log(`row actions: ${JSON.stringify(order)}`)
    expect(order[0]).toContain('workspace-waiting-badge')
    // D202 ②: the Control Tower tab is shown → the 工作區 tab title shows the total
    await win.locator('.left-sidebar-tab').nth(1).click()
    await expect(tabTitle.locator('.workspace-waiting-badge')).toHaveText('⚠️', { timeout: 10_000 })
    await win.screenshot({ path: test.info().outputPath('tab-title-badge.png') })
    await tabTitle.locator('.workspace-waiting-badge').click()
    await expect(tabTitle).toHaveClass(/\bactive\b/)
    await expect(rowOf(win, WS_B)).toHaveClass(/\bactive\b/) // only the 工作區 tab, no jump
    await win.screenshot({ path: test.info().outputPath('row-badge.png') })

    // ── 2. ends while nobody looks at the tab → faded ──
    await done()
    await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
    await expect(rowBadge).toHaveClass(/\bmissed\b/)
    await expect(rowBadge).toHaveAttribute('title', /\d{1,2}:\d{2}/)
    await expect(tabTitle.locator('.workspace-waiting-badge.missed')).toHaveCount(1)
    await win.screenshot({ path: test.info().outputPath('row-badge-missed.png') })

    // ── 3. waits again → solid; collapsed sidebar shows it, its click expands the sidebar ──
    await ask()
    await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting', { timeout: 15_000 })
    await win.locator('.left-sidebar-collapse').click()
    const collapsedBadge = win.locator('.left-sidebar-collapsed .workspace-waiting-badge')
    await expect(collapsedBadge).toHaveText('⚠️', { timeout: 10_000 })
    await win.screenshot({ path: test.info().outputPath('collapsed-badge.png') })
    await collapsedBadge.click()
    await expect(rowBadge).toBeVisible({ timeout: 10_000 })
    await expect(collapsedBadge).toBeHidden()

    // ── 4. the row ⚠️ click → A active, the tab selected ──
    await rowBadge.click()
    await expect(rowOf(win, WS_A)).toHaveClass(/\bactive\b/, { timeout: 10_000 })
    await expect.poll(() => win.evaluate(() => {
      const active = document.querySelector('.workspace-container.active .thumbnail.active .thumbnail-title')
      return active?.textContent ?? ''
    }), { timeout: 10_000 }).toContain(tab!.title)
    // the active (accent-blue) row keeps the solid ⚠️ readable (D202 ①)
    await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting')
    await win.screenshot({ path: test.info().outputPath('active-row-badge.png') })
    const before = await takeFocus(app, win, 'main', '4. before done', log)
    await done()
    const after = await focusEvidence(app, win)
    log(`[focus] 4. after done: ${JSON.stringify(after)}`)
    // the focus must not have moved while the wait ended, or the branch below would be a guess
    expect(after.hasFocus, 'the window focus changed while the wait ended').toBe(before.hasFocus)
    if (before.hasFocus) {
      expect(before.focusedWindow).toBe('main') // the OS focus is really on the main window
      await expect(rowBadge).toHaveCount(0, { timeout: 15_000 }) // looked at → cleared, no faded mark
      await win.waitForTimeout(1_500) // stays gone (no late faded mark)
      await expect(rowBadge).toHaveCount(0)
      log(`4. focused (${JSON.stringify(before)}): done while looked at → no faded ⚠️`)
    } else {
      // no OS focus for the window: the wait counts as unseen (D203 ③)
      expect(before.focusedWindow).not.toBe('main')
      await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
      await expect(rowBadge).toHaveClass(/\bmissed\b/)
      log(`4. unfocused (${JSON.stringify(before)}): done → faded ⚠️ on A's row`)
      test.info().annotations.push({ type: 'focus', description: `step 4 ran unfocused (${JSON.stringify(before)}): faded ⚠️ asserted` })
    }
  } finally {
    if (inst) {
      await closeFocusSink(inst.app)
      await closeIsolated(inst, log)
    }
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
