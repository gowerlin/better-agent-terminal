// BUG-166 / T0672: a program that tracked the mouse ended without turning tracking off (codex killed
// by a signal, T0671), xterm kept tracking and the shell typed every report into its command line
// (`35;52;69M35;55;66M…`). BAT now turns tracking off in its own xterm when a report it sent comes
// back as text (F1), and Shift + right-click while tracking offers "重設滑鼠模式" (F2).
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. One plain
// shell tab; a node script run in it stands in for the shell under leftover tracking: it turns on
// DECSET 1003 + 1006 (codex) and, in raw mode, records every stdin chunk and echoes it the way bash
// readline does (`ESC [ <` → BEL, the rest as text). Windows' own pwsh under ConPTY never shows the
// symptom (conhost turns the reports into console mouse events, T0671), so the echo is the script's.
// Nothing starts an LLM.
//
//   1. pointer moves → the first report(s) reach the script and come back as text → BAT turns
//      tracking off: more moves send nothing, a plain right-click opens BAT's menu (the program no
//      longer gets the button), the log has `[mouse-tracking] reset: reports echoed as text`
//   2. `t`: the script turns tracking on again and stops echoing (a program that reads the mouse):
//      moves reach it and tracking stays on; Shift + right-click → menu with 重設滑鼠模式 → click →
//      moves send nothing, a plain right-click opens BAT's menu, the log has `reset: manual`
//   3. `q`: the script exits

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0672')
const WS = 'e2e-t0672-ws'
const TAB = 'e2e-t0672-tab'
const READY = 'T0672-TRACKING-ON'
const READS = 'T0672-READS-MOUSE'
const DONE = 'T0672-EXIT'
const RESET_ITEM = '重設滑鼠模式'

const scriptSource = (inputLog: string): string => [
  "const fs = require('fs')",
  `const INPUT_LOG = ${JSON.stringify(inputLog)}`,
  'let echo = true',
  'if (process.stdin.isTTY) process.stdin.setRawMode(true)',
  "process.stdin.on('data', d => {",
  "  const s = d.toString('latin1')",
  "  fs.appendFileSync(INPUT_LOG, JSON.stringify(s) + '\\n')",
  "  const keys = s.replace(/\\x1b\\[<\\d+;\\d+;\\d+[Mm]/g, '')",
  `  if (keys.includes('q')) { process.stdout.write('\\r\\n${DONE}\\r\\n'); process.exit(0) }`,
  `  if (keys.includes('t')) { echo = false; process.stdout.write('\\x1b[?1003h\\x1b[?1006h\\r\\n${READS}\\r\\n'); return }`,
  // bash readline: rings the bell for `ESC [ <` and inserts the rest
  "  if (echo) process.stdout.write(s.replace(/\\x1b\\[</g, '\\x07'))",
  '})',
  `process.stdout.write('\\x1b[?1003h\\x1b[?1006h${READY}\\r\\n')`,
  '',
].join('\n')

const readInputLog = (file: string): string[] =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as string) : []
const reportsIn = (chunks: string[]): string[] => chunks.join('').match(/\x1b\[<\d+;\d+;\d+[Mm]/g) ?? []

const debugLogText = (userData: string): string => {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.endsWith('.log')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

const menu = (win: Page) => win.locator('.context-menu')

test('mouse tracking left on: reports echoed as text turn it off; Shift + right-click resets it', async () => {
  test.skip(process.platform === 'darwin', 'macOS xterm bypasses mouse tracking with Option, not Shift; step 2 assumes Shift')
  test.setTimeout(180_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0672-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const script = path.join(tmp, 'echo-shell.cjs').split(path.sep).join('/')
  const inputLog = path.join(tmp, 'input.log')
  fs.writeFileSync(script, scriptSource(inputLog))
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0672', log)
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0672', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TAB, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const view = win.locator('.workspace-container.active')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(async () => win.evaluate((id) => (window as AnyApi).electronAPI.pty.getCwd(id), TAB), { timeout: 30_000 }).not.toBeNull()

    const screen = view.locator('.terminal-wrapper.active .xterm-screen').first()
    await expect(screen).toBeVisible({ timeout: 15_000 })
    const box = async () => (await screen.boundingBox())!
    // a sweep over the middle of the terminal: one move report per cell crossed while 1003 is on
    const sweep = async () => {
      const b = await box()
      await win.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5)
      await win.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.6, { steps: 12 })
    }
    const rightClick = async (shift = false) => {
      const b = await box()
      if (shift) await win.keyboard.down('Shift')
      await win.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { button: 'right' })
      if (shift) await win.keyboard.up('Shift')
    }
    const dismissMenu = async () => {
      await win.locator('.workspace-item', { hasText: 'T0672' }).click()
      await expect(menu(win)).toHaveCount(0)
    }
    const send = (text: string) => win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: TAB, line: text })

    await send(`node "${script}"\r`)
    await expect(view).toContainText(READY, { timeout: 30_000 })

    // ── 1. F1: the reports come back as text → tracking off ──
    await sweep()
    await expect.poll(() => reportsIn(readInputLog(inputLog)).length, { timeout: 10_000 }).toBeGreaterThan(0)
    await expect.poll(() => debugLogText(userData), { timeout: 10_000 }).toContain('[mouse-tracking] reset: reports echoed as text')
    await win.waitForTimeout(800)
    const afterReset = reportsIn(readInputLog(inputLog)).length
    log(`step 1: ${afterReset} report(s) reached the script before the reset`)
    await sweep()
    await sweep()
    await win.waitForTimeout(800)
    expect(reportsIn(readInputLog(inputLog)).length).toBe(afterReset)
    // no tracking: a plain right-click is BAT's again, and the script gets no button report
    await rightClick()
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    await expect(menu(win)).not.toContainText(RESET_ITEM)
    await dismissMenu()
    await win.waitForTimeout(300)
    expect(reportsIn(readInputLog(inputLog)).length).toBe(afterReset)
    await win.screenshot({ path: test.info().outputPath('after-auto-reset.png') })

    // ── 2. F2: a program reading the mouse; reset by hand ──
    await send('t')
    await expect(view).toContainText(READS, { timeout: 15_000 })
    const beforeReads = reportsIn(readInputLog(inputLog)).length
    await sweep()
    await expect.poll(() => reportsIn(readInputLog(inputLog)).length, { timeout: 10_000 }).toBeGreaterThan(beforeReads)
    // not echoed → tracking stays on: more moves keep arriving
    await win.waitForTimeout(800)
    const stillOn = reportsIn(readInputLog(inputLog)).length
    await sweep()
    await expect.poll(() => reportsIn(readInputLog(inputLog)).length, { timeout: 10_000 }).toBeGreaterThan(stillOn)
    expect(debugLogText(userData).match(/\[mouse-tracking\] reset:/g)).toHaveLength(1)

    await rightClick(true)
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    await win.screenshot({ path: test.info().outputPath('shift-menu-reset-item.png') })
    await menu(win).getByText(RESET_ITEM).click()
    await expect(menu(win)).toHaveCount(0, { timeout: 5_000 })
    await expect.poll(() => debugLogText(userData), { timeout: 10_000 }).toContain('[mouse-tracking] reset: manual')
    await win.waitForTimeout(500)
    const afterManual = reportsIn(readInputLog(inputLog)).length
    await sweep()
    await win.waitForTimeout(800)
    expect(reportsIn(readInputLog(inputLog)).length).toBe(afterManual)
    await rightClick()
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    await dismissMenu()
    await win.waitForTimeout(300)
    expect(reportsIn(readInputLog(inputLog)).length).toBe(afterManual)

    // ── 3. exit ──
    await send('q')
    await expect(view).toContainText(DONE, { timeout: 15_000 })
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
