// BUG-144 / T0571: in a tab whose program tracks the mouse the way the claude CLI does (alt screen,
// DECSET 1000 + 1002 + 1003 + 1006), Shift + drag selects in xterm and Shift + right-click opens
// BAT's menu with Copy. xterm 5.5.0 clears its selection on every mouse report and with 1003 every
// pointer move is one, so before T0571 the selection was gone by the right-click (menu: Paste only).
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. One plain
// shell tab; a node script run in it draws a line, turns tracking on and records its stdin. Nothing
// starts an LLM. The test writes the system clipboard and puts the previous text back afterwards.
//
//   1. Shift + drag, the pointer moves on (move reports reach the script), Shift + right-click →
//      Copy → clipboard = the selected text
//   2. the selection is still there after the copy (menu again has Copy); Esc closes it without
//      ESC reaching the script (T0569)
//   3. a key typed to the script ends the selection: Shift + right-click → Paste only
//   4. a plain drag goes to the script (press / drag / release reports), xterm selects nothing:
//      Shift + right-click → Paste only (the claude CLI selects and copies that itself)
//   5. right-click without Shift: no menu, the script gets the right button (T0568)
//   6. tracking off: right-click → menu as in a plain shell

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0571')
const WS = 'e2e-t0571-ws'
const TAB = 'e2e-t0571-tab'
const LINE = 'T0571MARK alpha beta gamma delta'
const SENTINEL = 'T0571-clipboard-before'

// Text on the alt screen is not in the page's DOM text, so the script signals through files: its
// size to `sizeFile` once the screen is drawn and tracking is on (again on every resize), `doneFile`
// once tracking is off again. Every stdin chunk (raw mode) goes to `inputLog` as a JSON string; a
// `q` turns everything off and exits.
const scriptSource = (inputLog: string, sizeFile: string, doneFile: string): string => [
  "const fs = require('fs')",
  `const INPUT_LOG = ${JSON.stringify(inputLog)}`,
  `const writeSize = () => fs.writeFileSync(${JSON.stringify(sizeFile)}, JSON.stringify({ cols: process.stdout.columns, rows: process.stdout.rows }))`,
  'if (process.stdin.isTTY) process.stdin.setRawMode(true)',
  "process.stdin.on('data', d => {",
  "  const s = d.toString('latin1')",
  "  fs.appendFileSync(INPUT_LOG, JSON.stringify(s) + '\\n')",
  "  if (s.includes('q')) {",
  "    process.stdout.write('\\x1b[?1006l\\x1b[?1003l\\x1b[?1002l\\x1b[?1000l\\x1b[?1049l', () => {",
  `      fs.writeFileSync(${JSON.stringify(doneFile)}, 'done')`,
  '      process.exit(0)',
  '    })',
  '  }',
  '})',
  "process.stdout.on('resize', writeSize)",
  `process.stdout.write('\\x1b[?1049h\\x1b[2J\\x1b[H${LINE}\\r\\n\\x1b[?1000h\\x1b[?1002h\\x1b[?1003h\\x1b[?1006h', writeSize)`,
  '',
].join('\n')

const readInputLog = (file: string): string[] =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as string) : []

const menu = (win: Page) => win.locator('.context-menu')
const menuItems = (win: Page) => win.locator('.context-menu .context-menu-item').allInnerTexts()

test('Shift + drag, then Shift + right-click: Copy in a tab tracking the mouse like the claude CLI', async () => {
  test.skip(process.platform === 'darwin', 'macOS xterm bypasses mouse tracking with Option, not Shift')
  test.setTimeout(180_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0571-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const script = path.join(tmp, 'tracking.cjs').split(path.sep).join('/')
  const inputLog = path.join(tmp, 'input.log')
  const sizeFile = path.join(tmp, 'size.json')
  const doneFile = path.join(tmp, 'done')
  fs.writeFileSync(script, scriptSource(inputLog, sizeFile, doneFile))
  let inst: IsolatedInstance | undefined
  let clipboardBefore: string | undefined
  try {
    inst = await launchIsolated('t0571', log)
    const { app, win } = inst
    const readClipboard = () => app.evaluate(({ clipboard }) => clipboard.readText())
    clipboardBefore = await readClipboard()
    await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), SENTINEL)

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0571', folderPath: folder, createdAt: Date.now() }],
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
    const textarea = view.locator('.terminal-wrapper.active .xterm-helper-textarea').first()

    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: TAB, line: `node "${script}"\r` })
    await expect.poll(() => fs.existsSync(sizeFile), { timeout: 30_000 }).toBe(true)
    // The PTY can still have its spawn size (120x30) while xterm already fit the window; the
    // toolbar's redraw resends the size (SIGWINCH → the script rewrites `sizeFile`).
    await win.evaluate((id) => window.dispatchEvent(new CustomEvent('terminal-redraw', { detail: { terminalId: id } })), TAB)
    await win.waitForTimeout(1500)
    const size = JSON.parse(fs.readFileSync(sizeFile, 'utf8')) as { cols: number; rows: number }
    const box = (await screen.boundingBox())!
    const cell = { w: box.width / size.cols, h: box.height / size.rows }
    // the middle of `col` on row 1 (LINE); `dy` moves within that row
    const at = (col: number, dy = 0) => ({ x: box.x + (col + 0.5) * cell.w, y: box.y + 0.5 * cell.h + dy })
    log(`terminal ${size.cols}x${size.rows}, cell ${cell.w.toFixed(2)}x${cell.h.toFixed(2)}`)

    const drag = async (from: number, to: number, shift: boolean) => {
      if (shift) await win.keyboard.down('Shift')
      await win.mouse.move(at(from).x, at(from).y)
      await win.mouse.down()
      await win.mouse.move(at(to).x, at(to).y, { steps: 5 })
      await win.mouse.up()
      if (shift) await win.keyboard.up('Shift')
    }
    const rightClick = async (col: number, shift: boolean) => {
      if (shift) await win.keyboard.down('Shift')
      await win.mouse.click(at(col, 1).x, at(col, 1).y, { button: 'right' })
      if (shift) await win.keyboard.up('Shift')
    }

    // ── 1. Shift + drag, move on, Shift + right-click → Copy ──
    const before1 = readInputLog(inputLog).length
    await drag(10, 20, true)
    // the pointer moves on: xterm reports every cell to the script (and used to drop the selection)
    await win.mouse.move(at(23).x, at(23).y, { steps: 3 })
    await expect.poll(() => readInputLog(inputLog).slice(before1).join(''), { timeout: 10_000 }).toMatch(/\x1b\[<35;\d+;\d+M/)
    await rightClick(23, true)
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    expect(await menuItems(win)).toEqual(['複製', '貼上'])
    await win.screenshot({ path: test.info().outputPath('shift-menu-copy.png') })
    await menu(win).getByText('複製').click()
    await expect(menu(win)).toHaveCount(0)
    await expect.poll(readClipboard, { timeout: 5_000 }).toBe('alpha beta')
    const step1 = readInputLog(inputLog).slice(before1)
    log(`stdin during step 1: ${JSON.stringify(step1)}`)
    // the Shift + drag and the Shift + right-click never went to the script as button presses
    expect(step1.join('')).not.toMatch(/\x1b\[<(?:0|2|4|6);\d+;\d+[Mm]/)

    // ── 2. still selected; Esc closes the menu, the script gets no ESC ──
    const before2 = readInputLog(inputLog).length
    await win.mouse.move(at(25).x, at(25).y, { steps: 2 })
    await rightClick(25, true)
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    expect(await menuItems(win)).toEqual(['複製', '貼上'])
    await expect(textarea).toBeFocused()
    await win.keyboard.press('Escape')
    await expect(menu(win)).toHaveCount(0, { timeout: 5_000 })
    await win.waitForTimeout(300)
    expect(readInputLog(inputLog).slice(before2).filter(s => s.includes('\x1b') && !s.startsWith('\x1b[<'))).toEqual([])

    // ── 3. a key to the script ends the selection ──
    const before3 = readInputLog(inputLog).length
    await win.keyboard.type('x')
    await expect.poll(() => readInputLog(inputLog).slice(before3).join(''), { timeout: 10_000 }).toContain('x')
    await win.mouse.move(at(27).x, at(27).y, { steps: 2 })
    await rightClick(27, true)
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    expect(await menuItems(win)).toEqual(['貼上'])
    await win.keyboard.press('Escape')
    await expect(menu(win)).toHaveCount(0, { timeout: 5_000 })

    // ── 4. a plain drag belongs to the script ──
    const before4 = readInputLog(inputLog).length
    await drag(10, 20, false)
    await expect.poll(() => readInputLog(inputLog).slice(before4).join(''), { timeout: 10_000 }).toMatch(/\x1b\[<0;\d+;\d+m/)
    const plainDrag = readInputLog(inputLog).slice(before4).join('')
    log(`stdin during the plain drag: ${JSON.stringify(plainDrag)}`)
    expect(plainDrag).toMatch(/\x1b\[<0;\d+;\d+M/)
    expect(plainDrag).toMatch(/\x1b\[<32;\d+;\d+M/)
    await rightClick(20, true)
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    expect(await menuItems(win)).toEqual(['貼上'])
    await win.keyboard.press('Escape')
    await expect(menu(win)).toHaveCount(0, { timeout: 5_000 })

    // ── 5. right-click without Shift: the script's (T0568) ──
    const before5 = readInputLog(inputLog).length
    await rightClick(20, false)
    await expect.poll(() => readInputLog(inputLog).slice(before5).join(''), { timeout: 10_000 }).toMatch(/\x1b\[<2;\d+;\d+M/)
    await win.waitForTimeout(500)
    await expect(menu(win)).toHaveCount(0)

    // ── 6. tracking off: a plain shell again ──
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'q'), TAB)
    await expect.poll(() => fs.existsSync(doneFile), { timeout: 15_000 }).toBe(true)
    await win.waitForTimeout(500)
    await rightClick(5, false)
    await expect(menu(win)).toHaveCount(1, { timeout: 5_000 })
    await win.locator('.workspace-item', { hasText: 'T0571' }).click()
    await expect(menu(win)).toHaveCount(0)
  } finally {
    if (inst) {
      if (clipboardBefore !== undefined) {
        await inst.app.evaluate(({ clipboard }, text) => clipboard.writeText(text), clipboardBefore).catch(() => undefined)
      }
      await closeIsolated(inst, log)
    }
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
