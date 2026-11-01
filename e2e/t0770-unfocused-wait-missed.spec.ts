// T0770 (D203 ③, pre.4 acceptance; formerly a manual item): a wait that ends while the BAT window has no
// OS focus leaves a faded ⚠️ even though its tab is the active one; it clears once the window has the
// focus again and the tab is shown. A wait that ends while the window has the focus and shows the tab
// leaves nothing.
//
// Isolated instance (fixtures/electron-isolation.ts; `BAT_E2E_EXECUTABLE=<installed exe>` runs the
// installed build, unset = the source build). The waiting tab is a plain shell tab of the seeded
// workspace: the spec types `node <tab.mjs>` into it, and that script runs `bat-hook.mjs` from INSIDE the
// PTY (the PTY's own scoped capability; BAT_HELPER_DIR of the PTY = the helper dir of the build under
// test). The spec reads no token or credential file. Nothing starts an LLM. Folders: %ProgramData%\bat-e2e-t0770-*.
//
// Playwright's focus emulation is turned off for the main window (CDP `Emulation.setFocusEmulationEnabled`
// false), otherwise its document.hasFocus() is always true and no blur event fires.
// How the focus goes away (evidence logged): a second BrowserWindow of the isolated instance takes the
// focus (`focus-sink`); if the main window still has it, `BrowserWindow.blur()`. `document.hasFocus()` of
// the main window and `BrowserWindow.getFocusedWindow()` are logged at every step.
//
//   A. window focused, the tab active: ask → done → no faded ⚠️ (thumbnail / workspace row)
//   B. the tab active, the window loses the focus: ask → done → faded ⚠️ on the thumbnail and the row
//   C. another tab selected while unfocused (DOM click), the window gets the focus back → still faded;
//      the waiting tab selected → cleared
//   D. the tab active throughout: ends unfocused → faded; the window focused again → cleared (D203 ③)
//   E. (T0774 / BUG-193) ends unfocused → faded; a Playwright mouse click on the other tab's thumbnail
//      gives the focus back and switches → still faded; the waiting tab selected → cleared
// Without OS focus at the start (Playwright cannot always take it) A / C are logged and skipped (PARTIAL).

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0770')
const WS = 'e2e-t0770'
const TAB_WAIT = 'e2e-t0770-wait'
const TAB_OTHER = 'e2e-t0770-other'
const TITLE_WAIT = 'T0770 wait'
const TITLE_OTHER = 'T0770 other'
const SINK_TITLE = 't0770-focus-sink'

/** Runs `<jobs>/<n>.json` bat-hook jobs from inside the PTY; writes `<n>.res.json` (as t0735). */
const tabScript = (jobsDir: string, fallbackScripts: string) => `
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
const jobs = ${JSON.stringify(jobsDir)}
const scripts = process.env.BAT_HELPER_DIR || ${JSON.stringify(fallbackScripts)}
let n = 0
let busy = false
fs.writeFileSync(path.join(jobs, 'ready.json'), JSON.stringify({ id: process.env.BAT_TERMINAL_ID, helperDirFromPty: !!process.env.BAT_HELPER_DIR, scripts }))
process.stdout.write('t0770 tab ready\\n')
setInterval(() => {
  const file = path.join(jobs, n + '.json')
  if (busy || !fs.existsSync(file)) return
  busy = true
  const job = JSON.parse(fs.readFileSync(file, 'utf8'))
  const child = spawn(process.execPath, [path.join(scripts, 'bat-hook.mjs'), ...job.args], { env: process.env, windowsHide: true })
  let stdout = '', stderr = ''
  child.stdout.on('data', d => { stdout += d })
  child.stderr.on('data', d => { stderr += d })
  child.on('close', code => {
    fs.writeFileSync(file + '.tmp', JSON.stringify({ code, stdout, stderr }))
    fs.renameSync(file + '.tmp', path.join(jobs, n + '.res.json'))
    n++
    busy = false
  })
  child.stdin.end(job.stdin || '')
}, 100)
`

interface FocusState { hasFocus: boolean; focusedWindow: string }

async function focusState(app: ElectronApplication, win: Page): Promise<FocusState> {
  const focusedWindow = await app.evaluate(({ BrowserWindow }, sink) => {
    const w = BrowserWindow.getFocusedWindow()
    if (!w) return 'none'
    return w.getTitle() === sink ? 'focus-sink' : `window#${w.id}`
  }, SINK_TITLE)
  return { hasFocus: await win.evaluate(() => document.hasFocus()), focusedWindow }
}

/** Gives the main window the OS focus (as t0735 / t0757); returns whether its document has it. */
async function focusMain(app: ElectronApplication, win: Page): Promise<boolean> {
  await app.evaluate(({ BrowserWindow }, sink) => {
    const main = BrowserWindow.getAllWindows().find(w => w.getTitle() !== sink)
    main?.show()
    main?.focus()
  }, SINK_TITLE)
  const ok = await expect.poll(() => win.evaluate(() => document.hasFocus()), { timeout: 5_000 }).toBe(true).then(() => true, () => false)
  // the App's viewing state listens to the window focus event
  await win.evaluate(() => window.dispatchEvent(new Event('focus')))
  return ok
}

/** Takes the OS focus away from the main window; returns the method that worked, or null. */
async function blurMain(app: ElectronApplication, win: Page): Promise<string | null> {
  await app.evaluate(({ BrowserWindow }, sink) => {
    const w = new BrowserWindow({ width: 320, height: 200, title: sink, show: true, webPreferences: { sandbox: true } })
    w.on('page-title-updated', e => e.preventDefault())
    void w.loadURL(`data:text/html,<title>${sink}</title>focus sink`)
    w.focus()
  }, SINK_TITLE)
  if (await expect.poll(() => win.evaluate(() => document.hasFocus()), { timeout: 5_000 }).toBe(false).then(() => true, () => false)) return 'focus-sink (a second BrowserWindow of the isolated instance took the focus)'
  log(`focus-sink did not take the focus: ${JSON.stringify(await focusState(app, win))}; trying BrowserWindow.blur()`)
  await app.evaluate(({ BrowserWindow }, sink) => {
    BrowserWindow.getAllWindows().find(w => w.getTitle() !== sink)?.blur()
  }, SINK_TITLE)
  if (await expect.poll(() => win.evaluate(() => document.hasFocus()), { timeout: 5_000 }).toBe(false).then(() => true, () => false)) return 'BrowserWindow.blur() on the main window'
  return null
}

async function closeSink(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }, sink) => {
    for (const w of BrowserWindow.getAllWindows()) if (w.getTitle() === sink && !w.isDestroyed()) w.destroy()
  }, SINK_TITLE).catch(() => undefined)
}

test('a wait that ends while the window has no focus leaves a faded ⚠️ on the active tab; focus + the tab shown clears it', async () => {
  test.setTimeout(300_000)
  const results: Record<string, string> = {}
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0770-'))
  const folder = path.join(root, 'w')
  const jobsDir = path.join(root, 'jobs')
  for (const dir of [folder, jobsDir]) fs.mkdirSync(dir, { recursive: true })
  const script = path.join(root, 'tab.mjs').split(path.sep).join('/')
  fs.writeFileSync(script, tabScript(jobsDir, path.join(REPO_ROOT, 'scripts')))
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0770', log)
    const { app, win } = inst
    log(`build under test: ${process.env.BAT_E2E_EXECUTABLE ? 'installed (BAT_E2E_EXECUTABLE)' : 'source build (dist-electron)'}`)

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: WS, folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: TAB_WAIT, workspaceId: WS, type: 'terminal', title: TITLE_WAIT, cwd: folder },
        { id: TAB_OTHER, workspaceId: WS, type: 'terminal', title: TITLE_OTHER, cwd: folder },
      ],
      activeTerminalId: TAB_WAIT,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const recovery = win.locator('.recovery-prompt-dialog')
    if (await recovery.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false)) {
      await recovery.locator('.recovery-prompt-actions .btn-primary').click()
      await expect(win.locator('.recovery-prompt-overlay')).toHaveCount(0, { timeout: 10_000 })
      log('answered the Recovery prompt after the reload (keep)')
    }

    // Playwright emulates focus on every page (document.hasFocus() stays true and no blur event fires
    // whatever the OS does — first T0770 run: focused window "none", hasFocus true). Turn it off for
    // the main window so its renderer sees the real OS focus.
    const cdp = await app.context().newCDPSession(win)
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false })
    log(`focus emulation off (CDP Emulation.setFocusEmulationEnabled false): ${JSON.stringify(await focusState(app, win))}`)

    const thumbOf = (title: string) => win.locator('.workspace-container.active .thumbnail')
      .filter({ has: win.locator('.thumbnail-title', { hasText: title }) })
    const thumbWait = thumbOf(TITLE_WAIT)
    const thumbOther = thumbOf(TITLE_OTHER)
    const rowBadge = win.locator('.workspace-item', { hasText: WS }).locator('.workspace-waiting-badge')
    await expect(thumbWait).toBeVisible({ timeout: 30_000 })
    await expect(thumbWait).toHaveClass(/\bactive\b/, { timeout: 10_000 })
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TAB_WAIT), { timeout: 30_000 }).not.toBeNull()

    // the shell tab runs the job script (typed like a user would; before any wait, so no clearing)
    await win.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: TAB_WAIT, d: `node "${script}"\r` })
    await expect.poll(() => fs.existsSync(path.join(jobsDir, 'ready.json')), { timeout: 30_000 }).toBe(true)
    const ready = JSON.parse(fs.readFileSync(path.join(jobsDir, 'ready.json'), 'utf8')) as { id: string; helperDirFromPty: boolean; scripts: string }
    log(`tab script ready: terminal=${ready.id} helperDirFromPty=${ready.helperDirFromPty} scripts=${ready.scripts}`)
    expect(ready.id).toBe(TAB_WAIT)

    let jobs = 0
    const hook = async (event: string, input: Record<string, string>) => {
      const n = jobs++
      fs.writeFileSync(path.join(jobsDir, `${n}.json`), JSON.stringify({ args: [event], stdin: JSON.stringify(input) }))
      const res = path.join(jobsDir, `${n}.res.json`)
      await expect.poll(() => fs.existsSync(res), { timeout: 30_000 }).toBe(true)
      const out = JSON.parse(fs.readFileSync(res, 'utf8')) as { code: number | null; stdout: string; stderr: string }
      log(`hook ${event} → exit=${out.code} stdout=${JSON.stringify(out.stdout)} stderr=${JSON.stringify(out.stderr.slice(0, 200))}`)
      expect(out.code).toBe(0)
    }
    const ask = async () => {
      await hook('ask-user-question', { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' })
      await expect(thumbWait.locator('.attention-badge.blocked')).toHaveCount(1, { timeout: 15_000 })
      await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting', { timeout: 15_000 })
    }
    const done = () => hook('ask-user-question-done', { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion' })

    // ── A. focused + the tab shown: the wait ends → nothing left ──
    const focused = await focusMain(app, win)
    log(`A. before: ${JSON.stringify(await focusState(app, win))}`)
    if (focused) {
      await ask()
      await done()
      await expect(thumbWait.locator('.attention-badge')).toHaveCount(0, { timeout: 15_000 })
      await expect(rowBadge).toHaveCount(0, { timeout: 15_000 })
      // stays gone (not a late faded mark)
      await win.waitForTimeout(1_500)
      await expect(thumbWait.locator('.attention-badge.missed')).toHaveCount(0)
      await expect(rowBadge).toHaveCount(0)
      results.A = `PASS — focused (${JSON.stringify(await focusState(app, win))}), the tab active: ended → no faded ⚠️ on the thumbnail / row`
    } else {
      results.A = 'SKIPPED — the main window could not get the OS focus'
      test.info().annotations.push({ type: 'skip-step', description: 'window focus unavailable: A skipped' })
    }

    // ── B. the tab active, the window loses the focus: the wait ends → faded ⚠️ ──
    await ask()
    const method = await blurMain(app, win)
    const blurred = await focusState(app, win)
    log(`B. blur method: ${method ?? 'none worked'}; after: ${JSON.stringify(blurred)}`)
    await expect(thumbWait).toHaveClass(/\bactive\b/) // still the active tab
    if (method) {
      await done()
      await expect(thumbWait.locator('.attention-badge.missed')).toHaveCount(1, { timeout: 15_000 })
      await expect(thumbWait.locator('.attention-badge.blocked')).toHaveCount(0)
      await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
      await expect(rowBadge).toHaveClass(/\bmissed\b/)
      await expect(thumbWait.locator('.attention-badge.missed')).toHaveAttribute('title', /\d{1,2}:\d{2}/)
      await win.screenshot({ path: test.info().outputPath('unfocused-missed.png') })
      results.B = `PASS — ${method}; document.hasFocus()=${blurred.hasFocus}, focused window=${blurred.focusedWindow}; the tab active: ended → faded ⚠️ on the thumbnail and the row (data-waiting=missed)`
    } else {
      results.B = `PARTIAL — no way to take the OS focus from the main window (${JSON.stringify(blurred)})`
      test.info().annotations.push({ type: 'skip-step', description: 'could not blur the main window: B / C skipped' })
      await done()
    }

    // ── C. another tab selected while unfocused, the focus back → still faded; the tab selected → cleared ──
    // The other tab is selected by a DOM click (the thumbnail's onClick) so the window stays unfocused: a
    // Playwright mouse click gives the page the focus first, while the waiting tab is still the active
    // one (first T0770 run: that cleared the mark before the switch — BUG-193, fixed by T0774; the mouse
    // click case is E).
    if (method) {
      await thumbOther.evaluate(el => (el as HTMLElement).click())
      await expect(thumbOther).toHaveClass(/\bactive\b/, { timeout: 10_000 })
      const whileOther = await focusState(app, win)
      log(`C. after selecting the other tab (DOM click): ${JSON.stringify(whileOther)}`)
      expect(whileOther.hasFocus).toBe(false)
      await expect(thumbWait.locator('.attention-badge.missed')).toHaveCount(1)
      await closeSink(app)
      const back = await focusMain(app, win)
      const afterFocus = await focusState(app, win)
      log(`C. focus back: ${back}; ${JSON.stringify(afterFocus)}`)
      await win.waitForTimeout(1_000)
      await expect(thumbWait.locator('.attention-badge.missed')).toHaveCount(1)
      await expect(rowBadge).toHaveAttribute('data-waiting', 'missed')
      await thumbWait.click()
      await expect(thumbWait).toHaveClass(/\bactive\b/, { timeout: 10_000 })
      if (back) {
        await expect(thumbWait.locator('.attention-badge')).toHaveCount(0, { timeout: 15_000 })
        await expect(rowBadge).toHaveCount(0, { timeout: 15_000 })
        results.C = `PASS — the other tab selected while unfocused, focus back (${JSON.stringify(afterFocus)}) → still faded; the waiting tab selected → cleared (thumbnail / row)`
      } else {
        results.C = `PARTIAL — focus could not be given back (${JSON.stringify(afterFocus)}): still faded with the other tab; clearing not checked`
        test.info().annotations.push({ type: 'skip-step', description: 'window focus unavailable: C clearing skipped' })
      }
    } else {
      results.C = 'SKIPPED — depends on B'
    }

    // ── D. the tab stays active; ends unfocused → faded; only the focus back → cleared ──
    if (method && results.C.startsWith('PASS')) {
      await ask()
      const methodD = await blurMain(app, win)
      log(`D. blur method: ${methodD ?? 'none worked'}; ${JSON.stringify(await focusState(app, win))}`)
      expect(methodD).not.toBeNull()
      await done()
      await expect(thumbWait.locator('.attention-badge.missed')).toHaveCount(1, { timeout: 15_000 })
      await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
      await closeSink(app)
      const back = await focusMain(app, win)
      log(`D. focus back: ${back}; ${JSON.stringify(await focusState(app, win))}`)
      expect(back).toBe(true)
      await expect(thumbWait.locator('.attention-badge')).toHaveCount(0, { timeout: 15_000 })
      await expect(rowBadge).toHaveCount(0, { timeout: 15_000 })
      results.D = 'PASS — the waiting tab active throughout: ended unfocused → faded; the window focused again (no click) → cleared'
    } else {
      results.D = 'SKIPPED — depends on B / C'
    }

    // ── E (T0774 / BUG-193). The tab active, ends unfocused → faded; a Playwright MOUSE click on the other
    // tab's thumbnail gives the window the focus back (focus first, then pointerdown / click — T0774 probe)
    // → the waiting tab stays faded; selecting it → cleared ──
    if (results.D.startsWith('PASS')) {
      await ask()
      const methodE = await blurMain(app, win)
      log(`E. blur method: ${methodE ?? 'none worked'}; ${JSON.stringify(await focusState(app, win))}`)
      expect(methodE).not.toBeNull()
      await done()
      await expect(thumbWait.locator('.attention-badge.missed')).toHaveCount(1, { timeout: 15_000 })
      await expect(thumbWait).toHaveClass(/\bactive\b/)
      await thumbOther.click() // Playwright mouse (CDP Input.dispatchMouseEvent), the focus-sink still open
      await expect(thumbOther).toHaveClass(/\bactive\b/, { timeout: 10_000 })
      const afterClick = await focusState(app, win)
      log(`E. after the mouse click on the other tab: ${JSON.stringify(afterClick)}`)
      expect(afterClick.hasFocus).toBe(true) // the click gave the window the focus back
      await win.waitForTimeout(1_500) // past every focus-regain timer except the 10 s max hold (no press is held)
      await expect(thumbWait.locator('.attention-badge.missed')).toHaveCount(1)
      await expect(rowBadge).toHaveAttribute('data-waiting', 'missed')
      await thumbWait.click()
      await expect(thumbWait).toHaveClass(/\bactive\b/, { timeout: 10_000 })
      await expect(thumbWait.locator('.attention-badge')).toHaveCount(0, { timeout: 15_000 })
      await expect(rowBadge).toHaveCount(0, { timeout: 15_000 })
      await closeSink(app)
      results.E = `PASS — ended unfocused → faded; mouse click on the other tab regained the focus (${JSON.stringify(afterClick)}) → still faded; the waiting tab selected → cleared`
    } else {
      results.E = 'SKIPPED — depends on D'
    }
    log(`T0770 ③ results: ${JSON.stringify(results, null, 2)}`)
  } finally {
    if (inst) {
      await closeSink(inst.app)
      await closeIsolated(inst, log)
    }
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 }) } catch (e) { log(`could not remove the t0770 folder: ${e instanceof Error ? e.message : String(e)}`) }
    log(`t0770 folder removed: ${!fs.existsSync(root)}`)
  }
})
