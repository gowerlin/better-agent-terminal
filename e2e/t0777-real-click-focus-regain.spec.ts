// T0777 (pre.5 acceptance, BUG-193 with a real OS click): a wait that ends while the BAT window has no OS
// focus leaves a faded ⚠️ on the active tab X; a REAL operating-system mouse click (user32 SetCursorPos +
// mouse_event, as the T0774 probe) on the other tab Y's thumbnail gives the window the focus back and
// switches to Y → X keeps its faded ⚠️; selecting X afterwards clears it. t0770 E covers the same steps with
// a Playwright (CDP) click; this spec only adds the OS click.
//
// Isolated instance (fixtures/electron-isolation.ts; `BAT_E2E_EXECUTABLE=<installed exe>` runs the installed
// build, unset = the source build). The waiting tab is a plain shell tab: the spec types `node <tab.mjs>` into
// it and that script runs `bat-hook.mjs` from INSIDE the PTY (the PTY's own scoped capability), as t0770.
// The spec reads no token or credential file. Nothing starts an LLM. Folders: %ProgramData%\bat-e2e-t0777-*.
//
// Safety of the OS click: before pressing, the PowerShell script resolves WindowFromPoint → GetAncestor
// (GA_ROOT) at the target point and compares it with the HWND of the isolated instance's main window
// (BrowserWindow.getNativeWindowHandle()). Different (e.g. the user's own BAT or any other window is there)
// → no click, the step is reported PARTIAL. The main window is set always-on-top only for the click, and
// the cursor is put back afterwards. Windows only (skipped elsewhere).

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0777')
const WS = 'e2e-t0777'
const TAB_WAIT = 'e2e-t0777-wait'
const TAB_OTHER = 'e2e-t0777-other'
const TITLE_WAIT = 'T0777 wait'
const TITLE_OTHER = 'T0777 other'
const SINK_TITLE = 't0777-focus-sink'

/** Runs `<jobs>/<n>.json` bat-hook jobs from inside the PTY; writes `<n>.res.json` (as t0770). */
const tabScript = (jobsDir: string, fallbackScripts: string) => `
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
const jobs = ${JSON.stringify(jobsDir)}
const scripts = process.env.BAT_HELPER_DIR || ${JSON.stringify(fallbackScripts)}
let n = 0
let busy = false
fs.writeFileSync(path.join(jobs, 'ready.json'), JSON.stringify({ id: process.env.BAT_TERMINAL_ID, helperDirFromPty: !!process.env.BAT_HELPER_DIR }))
process.stdout.write('t0777 tab ready\\n')
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

/** OS click at (x, y) only when the root window under the point is `hwnd` (as the T0774 probe). */
const CLICK_PS1 = `
param([int]$x, [int]$y, [string]$hwnd)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class U {
  [StructLayout(LayoutKind.Sequential)] public struct P { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out P p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(P p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint f);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
}
"@
[U]::SetProcessDPIAware() | Out-Null
$old = New-Object U+P
[U]::GetCursorPos([ref]$old) | Out-Null
$p = New-Object U+P; $p.X = $x; $p.Y = $y
$root = [U]::GetAncestor([U]::WindowFromPoint($p), 2)
if ($root.ToInt64().ToString() -ne $hwnd) { Write-Output ("{""clicked"":false,""rootMatches"":false}"); exit 0 }
[U]::SetCursorPos($x, $y) | Out-Null
Start-Sleep -Milliseconds 60
[U]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 90
[U]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 300
[U]::SetCursorPos($old.X, $old.Y) | Out-Null
Write-Output "{""clicked"":true,""rootMatches"":true}"
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

async function focusMain(app: ElectronApplication, win: Page): Promise<boolean> {
  await app.evaluate(({ BrowserWindow }, sink) => {
    const main = BrowserWindow.getAllWindows().find(w => w.getTitle() !== sink)
    main?.show()
    main?.focus()
  }, SINK_TITLE)
  return expect.poll(() => win.evaluate(() => document.hasFocus()), { timeout: 5_000 }).toBe(true).then(() => true, () => false)
}

/** A second BrowserWindow of the isolated instance takes the focus (top-left corner, away from the thumbnails). */
async function blurMain(app: ElectronApplication, win: Page): Promise<boolean> {
  await app.evaluate(({ BrowserWindow }, sink) => {
    const w = new BrowserWindow({ width: 320, height: 200, x: 0, y: 0, title: sink, show: true, webPreferences: { sandbox: true } })
    w.on('page-title-updated', e => e.preventDefault())
    void w.loadURL(`data:text/html,<title>${sink}</title>focus sink`)
    w.focus()
  }, SINK_TITLE)
  return expect.poll(() => win.evaluate(() => document.hasFocus()), { timeout: 5_000 }).toBe(false).then(() => true, () => false)
}

async function closeSink(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }, sink) => {
    for (const w of BrowserWindow.getAllWindows()) if (w.getTitle() === sink && !w.isDestroyed()) w.destroy()
  }, SINK_TITLE).catch(() => undefined)
}

async function setMainOnTop(app: ElectronApplication, onTop: boolean): Promise<void> {
  await app.evaluate(({ BrowserWindow }, { sink, onTop }) => {
    BrowserWindow.getAllWindows().find(w => w.getTitle() !== sink)?.setAlwaysOnTop(onTop)
  }, { sink: SINK_TITLE, onTop }).catch(() => undefined)
}

test('BUG-193 with a real OS click: the click that gives the focus back and switches tabs keeps the faded ⚠️', async () => {
  test.skip(process.platform !== 'win32', 'user32 OS click: Windows only')
  test.setTimeout(240_000)
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0777-'))
  const folder = path.join(root, 'w')
  const jobsDir = path.join(root, 'jobs')
  for (const dir of [folder, jobsDir]) fs.mkdirSync(dir, { recursive: true })
  const script = path.join(root, 'tab.mjs').split(path.sep).join('/')
  fs.writeFileSync(script, tabScript(jobsDir, path.join(REPO_ROOT, 'scripts')))
  const ps1 = path.join(root, 'click.ps1')
  fs.writeFileSync(ps1, CLICK_PS1)
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0777', log)
    const { app, win } = inst
    log(`build under test: ${process.env.BAT_E2E_EXECUTABLE ? 'installed (BAT_E2E_EXECUTABLE)' : 'source build (dist-electron)'}; version=${await app.evaluate(({ app }) => app.getVersion())}`)

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
    const cdp = await app.context().newCDPSession(win)
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false })

    const thumbOf = (title: string) => win.locator('.workspace-container.active .thumbnail')
      .filter({ has: win.locator('.thumbnail-title', { hasText: title }) })
    const thumbWait = thumbOf(TITLE_WAIT)
    const thumbOther = thumbOf(TITLE_OTHER)
    const rowBadge = win.locator('.workspace-item', { hasText: WS }).locator('.workspace-waiting-badge')
    await expect(thumbWait).toHaveClass(/\bactive\b/, { timeout: 30_000 })
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TAB_WAIT), { timeout: 30_000 }).not.toBeNull()

    await win.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: TAB_WAIT, d: `node "${script}"\r` })
    await expect.poll(() => fs.existsSync(path.join(jobsDir, 'ready.json')), { timeout: 30_000 }).toBe(true)
    const ready = JSON.parse(fs.readFileSync(path.join(jobsDir, 'ready.json'), 'utf8')) as { id: string; helperDirFromPty: boolean }
    log(`tab script ready: terminal=${ready.id} helperDirFromPty=${ready.helperDirFromPty}`)
    expect(ready.id).toBe(TAB_WAIT)

    let jobs = 0
    const hook = async (event: string, input: Record<string, string>) => {
      const n = jobs++
      fs.writeFileSync(path.join(jobsDir, `${n}.json`), JSON.stringify({ args: [event], stdin: JSON.stringify(input) }))
      const res = path.join(jobsDir, `${n}.res.json`)
      await expect.poll(() => fs.existsSync(res), { timeout: 30_000 }).toBe(true)
      const out = JSON.parse(fs.readFileSync(res, 'utf8')) as { code: number | null; stdout: string; stderr: string }
      log(`hook ${event} → exit=${out.code} stdout=${JSON.stringify(out.stdout)} stderrLength=${out.stderr.length}`)
      expect(out.code).toBe(0)
    }

    // X waits; the window loses the focus; the wait ends → faded ⚠️ on X (still the active tab)
    expect(await focusMain(app, win)).toBe(true)
    await setMainOnTop(app, true) // the sink must not cover the main window at the click point
    await hook('ask-user-question', { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' })
    await expect(thumbWait.locator('.attention-badge.blocked')).toHaveCount(1, { timeout: 15_000 })
    expect(await blurMain(app, win)).toBe(true)
    log(`after blur: ${JSON.stringify(await focusState(app, win))}`)
    await hook('ask-user-question-done', { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion' })
    await expect(thumbWait.locator('.attention-badge.missed')).toHaveCount(1, { timeout: 15_000 })
    await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
    await expect(thumbWait).toHaveClass(/\bactive\b/)

    // real OS click on Y's thumbnail (only when the isolated main window is the root window at the point)
    const box = await thumbOther.boundingBox()
    expect(box).not.toBeNull()
    const target = await app.evaluate(({ BrowserWindow, screen }, { sink, bx, by }) => {
      const m = BrowserWindow.getAllWindows().find(w => w.getTitle() !== sink)!
      const c = m.getContentBounds()
      const pt = screen.dipToScreenPoint({ x: Math.round(c.x + bx), y: Math.round(c.y + by) })
      return { x: pt.x, y: pt.y, hwnd: m.getNativeWindowHandle().readBigUInt64LE(0).toString() }
    }, { sink: SINK_TITLE, bx: box!.x + box!.width / 2, by: box!.y + Math.min(12, box!.height / 2) })
    const out = await new Promise<string>((resolve) => execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, String(target.x), String(target.y), target.hwnd], { timeout: 30_000, windowsHide: true }, (err, so, se) => resolve(`${so}${se}${err ? ` err=${err.message}` : ''}`)))
    log(`OS click at screen (${target.x}, ${target.y}): ${out.trim()}`)
    await setMainOnTop(app, false)
    const clicked = /"clicked":true/.test(out)
    test.skip(!clicked, 'PARTIAL: the isolated main window was not the root window at the click point — no OS click was made')

    await expect(thumbOther).toHaveClass(/\bactive\b/, { timeout: 10_000 })
    const afterClick = await focusState(app, win)
    log(`after the OS click: ${JSON.stringify(afterClick)}`)
    expect(afterClick.hasFocus).toBe(true)
    await win.waitForTimeout(1_500) // past every focus-regain timer except the 10 s max hold (no press is held)
    await expect(thumbWait.locator('.attention-badge.missed')).toHaveCount(1)
    await expect(rowBadge).toHaveAttribute('data-waiting', 'missed')
    await win.screenshot({ path: test.info().outputPath('after-os-click-kept.png') })

    // selecting X clears it
    await thumbWait.click()
    await expect(thumbWait).toHaveClass(/\bactive\b/, { timeout: 10_000 })
    await expect(thumbWait.locator('.attention-badge')).toHaveCount(0, { timeout: 15_000 })
    await expect(rowBadge).toHaveCount(0, { timeout: 15_000 })

    const logsDir = path.join(inst.userData, 'Logs')
    for (const f of fs.readdirSync(logsDir).filter(n => n.startsWith('debug-'))) {
      for (const line of fs.readFileSync(path.join(logsDir, f), 'utf8').split(/\r?\n/)) if (line.includes('focus regain')) log(`gate log: ${line.replace(/^.*?\[workspace-waiting\]/, '[workspace-waiting]')}`)
    }
    log('RESULT PASS — ended unfocused → faded on X; real OS click on Y regained the focus and switched → X still faded; X selected → cleared')
  } finally {
    if (inst) {
      await setMainOnTop(inst.app, false)
      await closeSink(inst.app)
      await closeIsolated(inst, log)
    }
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 }) } catch (e) { log(`could not remove the t0777 folder: ${e instanceof Error ? e.message : String(e)}`) }
    log(`t0777 folder removed: ${!fs.existsSync(root)}`)
  }
})
