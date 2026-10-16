// BUG-142 / T0568: a right-click in a terminal tab opens BAT's Copy / Paste menu only while the
// program does not track the mouse. The claude CLI's TUI tracks it and pastes on right-click
// itself, so the menu used to be a second action for the same click.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. One plain
// shell tab; a node script run in it turns on mouse tracking (DECSET 1000 + 1006, the claude CLI's
// `scroll` mouse mode) and records what reaches its stdin. Nothing starts an LLM.
//
//   1. plain shell: right-click → menu
//   2. script tracking the mouse: right-click → the script gets the SGR right-button report, no menu
//   3. Shift + right-click → menu (Windows / Linux: xterm sends no report while Shift is held)
//   4. script turns tracking off and exits: right-click → menu again
//
// BUG-143 / T0569: with the menu open and focus in xterm's textarea, Esc closes the menu and is not
// written to the PTY (step 3: the script's stdin gets no ESC); with the menu closed Esc reaches the
// program as before (step 3b). Step 1 closes the menu with Esc as well; step 4 by clicking outside.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0568')
const WS = 'e2e-t0568-ws'
const TAB = 'e2e-t0568-tab'
const READY = 'T0568-TRACKING-ON'
const DONE = 'T0568-TRACKING-OFF'

// Mouse tracking on, one line, then appends every stdin chunk (raw mode) to `inputLog` as a JSON
// string. A `q` turns tracking off and exits.
const scriptSource = (inputLog: string): string => [
  "const fs = require('fs')",
  `const INPUT_LOG = ${JSON.stringify(inputLog)}`,
  'if (process.stdin.isTTY) process.stdin.setRawMode(true)',
  "process.stdin.on('data', d => {",
  "  const s = d.toString('latin1')",
  "  fs.appendFileSync(INPUT_LOG, JSON.stringify(s) + '\\n')",
  `  if (s.includes('q')) { process.stdout.write('\\x1b[?1006l\\x1b[?1000l${DONE}\\r\\n'); process.exit(0) }`,
  '})',
  `process.stdout.write('\\x1b[?1000h\\x1b[?1006h${READY}\\r\\n')`,
  '',
].join('\n')

const readInputLog = (file: string): string[] =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as string) : []

const menu = (win: Page) => win.locator('.context-menu')

test('right-click: BAT menu in a plain shell, none while the program tracks the mouse, Shift opens it', async () => {
  test.skip(process.platform === 'darwin', 'macOS xterm bypasses mouse tracking with Option, not Shift; step 3 assumes Shift')
  test.setTimeout(180_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0568-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const script = path.join(tmp, 'tracking.cjs').split(path.sep).join('/')
  const inputLog = path.join(tmp, 'input.log')
  fs.writeFileSync(script, scriptSource(inputLog))
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0568', log)
    const { win } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0568', folderPath: folder, createdAt: Date.now() }],
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
    const rightClick = async (shift = false) => {
      const box = (await screen.boundingBox())!
      const x = box.x + box.width / 2
      const y = box.y + box.height / 2
      if (shift) await win.keyboard.down('Shift')
      await win.mouse.click(x, y, { button: 'right' })
      if (shift) await win.keyboard.up('Shift')
    }
    const textarea = view.locator('.terminal-wrapper.active .xterm-helper-textarea').first()
    // a click outside the terminal closes the menu
    const dismissMenu = async () => {
      await win.locator('.workspace-item', { hasText: 'T0568' }).click()
      await expect(menu(win)).toHaveCount(0)
    }
    // Esc with focus in the terminal closes the menu (T0569 / BUG-143)
    const escapeMenu = async () => {
      await expect(textarea).toBeFocused()
      await win.keyboard.press('Escape')
      await expect(menu(win)).toHaveCount(0, { timeout: 5_000 })
    }

    // ── 1. plain shell ──
    await rightClick()
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    await expect(menu(win)).toContainText('貼上')
    await escapeMenu()

    // ── 2. the program tracks the mouse ──
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: TAB, line: `node "${script}"\r` })
    await expect(view).toContainText(READY, { timeout: 30_000 })
    const before = readInputLog(inputLog).length
    await rightClick()
    // xterm wrote the right button press / release as SGR reports (button 2) into the PTY
    await expect.poll(() => readInputLog(inputLog).slice(before).join(''), { timeout: 10_000 }).toMatch(/\x1b\[<2;\d+;\d+M/)
    log(`stdin after right-click: ${JSON.stringify(readInputLog(inputLog).slice(before))}`)
    await win.waitForTimeout(500)
    await expect(menu(win)).toHaveCount(0)
    await win.screenshot({ path: test.info().outputPath('tracking-no-menu.png') })

    // ── 3. Shift + right-click ──
    const beforeShift = readInputLog(inputLog).length
    await rightClick(true)
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    await win.screenshot({ path: test.info().outputPath('shift-menu.png') })
    await escapeMenu()
    await win.waitForTimeout(500)
    const shiftInput = readInputLog(inputLog).slice(beforeShift).join('')
    log(`stdin after Shift+right-click and Esc: ${JSON.stringify(shiftInput)}`)
    expect(shiftInput).not.toMatch(/\x1b\[<\d+;\d+;\d+[Mm]/)
    // the Esc that closed the menu never reached the program (T0569)
    expect(shiftInput).not.toContain('\x1b')

    // ── 3b. menu closed: Esc reaches the program as before ──
    const beforeEsc = readInputLog(inputLog).length
    await win.keyboard.press('Escape')
    await expect.poll(() => readInputLog(inputLog).slice(beforeEsc).join(''), { timeout: 10_000 }).toBe('\x1b')

    // ── 4. tracking off again ──
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'q'), TAB)
    await expect(view).toContainText(DONE, { timeout: 15_000 })
    await rightClick()
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    await dismissMenu()
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
