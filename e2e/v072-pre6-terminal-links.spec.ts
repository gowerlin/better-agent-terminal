// T0728 (pre.6 acceptance, BUG-174 / T0713, GitHub #20): terminal links clicked in a real isolated BAT.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. A plain shell tab
// runs a node script that clears the screen and prints the cases at fixed rows, writes the PTY size to a
// file and stays up (no prompt redraw) until the test drops a stop file. In the main process the
// `shell:open-external` handler is replaced by a recorder (and `shell.openExternal` / `openPath` too), so
// nothing is opened. The pointer goes to cell centres computed from `.xterm-screen` and the PTY size.
//
//   ① a `file:///` path with full-width characters (also before it): the first and the LAST cell are the
//      link (pointer cursor; a click sends the whole path), the cells just outside are not
//   ② a `file:///` path longer than the terminal is wide (wraps to a second row): clicking the second row,
//      and its last cell, opens the same full path
//   ③ an OSC 8 hyperlink whose text (`README`) differs from its target: hovering shows the target in the
//      tooltip (`.terminal-link-hover`), a click sends the target, leaving hides the tooltip
//   ④ an OSC 8 `javascript:` link: a click sends nothing; the debug log has `refused OSC 8 link
//      scheme=javascript: length=<n>` and never the URI
//   ⑤ a plain `https://` link (WebLinksAddon): pointer and a click that sends the URL, as before
//
// Windows: the tab runs through ConPTY, so what xterm gets (wrap flags, OSC 8) is what ConPTY re-emits —
// the same path a user's tab takes.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0728-links')
const WS = 'e2e-t0728-links-ws'
const TAB = 'e2e-t0728-links-tab'

// Example paths only (D176): nothing on disk is needed, the open handler is a recorder.
const WIDE_PREFIX = '說明：'
const WIDE_URL = 'file:///C:/Users/demo/文件/測試資料夾/會議紀錄報告.md'
const OSC8_TEXT = 'README'
const OSC8_TARGET = 'file:///C:/Users/demo/project/README.md'
const OSC8_BAD_TEXT = 'click-me'
const OSC8_BAD_TARGET = 'javascript:alert(728)'
const WEB_PREFIX = 'web: '
const WEB_URL = 'https://example.com/t0728?q=1'
const OSC8_PREFIX = 'docs: '
const BAD_PREFIX = 'bad: '

// Rows (1-based) the script prints at; the long path takes LONG_ROW and LONG_ROW + 1.
const ROW_WIDE = 2
const LONG_ROW = 4
const ROW_OSC8 = 7
const ROW_BAD = 8
const ROW_WEB = 9

/** Cells a string takes (the CJK / full-width characters used here are 2, everything else 1). */
function cells(s: string): number {
  let n = 0
  for (const ch of s) n += /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1
  return n
}

const SCRIPT = `
const fs = require('fs')
const [, , sizeFile, stopFile, longUrl] = process.argv
const ESC = '\\x1b'
const BEL = '\\x07'
const at = (row, text) => ESC + '[' + row + ';1H' + text
const osc8 = (target, text) => ESC + ']8;;' + target + BEL + text + ESC + ']8;;' + BEL
let out = ESC + '[2J' + ESC + '[3J' + ESC + '[H'
out += at(1, 'T0728 terminal links')
out += at(${ROW_WIDE}, ${JSON.stringify(WIDE_PREFIX)} + ${JSON.stringify(WIDE_URL)} + '  end')
out += at(${LONG_ROW}, longUrl)
out += at(${ROW_OSC8}, ${JSON.stringify(OSC8_PREFIX)} + osc8(${JSON.stringify(OSC8_TARGET)}, ${JSON.stringify(OSC8_TEXT)}) + '  end')
out += at(${ROW_BAD}, ${JSON.stringify(BAD_PREFIX)} + osc8(${JSON.stringify(OSC8_BAD_TARGET)}, ${JSON.stringify(OSC8_BAD_TEXT)}) + '  end')
out += at(${ROW_WEB}, ${JSON.stringify(WEB_PREFIX)} + ${JSON.stringify(WEB_URL)} + '  end')
out += at(${ROW_WEB + 3}, '')
process.stdout.write(out, () => {
  fs.writeFileSync(sizeFile, JSON.stringify({ cols: process.stdout.columns, rows: process.stdout.rows }))
})
const timer = setInterval(() => { if (fs.existsSync(stopFile)) { clearInterval(timer); process.exit(0) } }, 200)
`

test.skip(process.platform !== 'win32', 'pwsh tab through ConPTY: Windows only')

test('BUG-174: file:/// with full-width chars / wrapped, OSC 8 target + tooltip, javascript: refused, https unchanged', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0728-links-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const script = slash(path.join(tmp, 'links.cjs'))
  const sizeFile = slash(path.join(tmp, 'size.json'))
  const stopFile = slash(path.join(tmp, 'stop'))
  fs.writeFileSync(script, SCRIPT)
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0728-links', log)
    const { app, win, userData } = inst
    const debugLog = () => {
      const dir = path.join(userData, 'Logs')
      return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    }

    // ── the main-process open handler records instead of opening ──
    expect(await app.evaluate(({ ipcMain, shell }) => {
      const g = globalThis as AnyApi
      g.__t0728Opened = []
      g.__t0728Shell = []
      ipcMain.removeHandler('shell:open-external')
      ipcMain.handle('shell:open-external', (_event, url: unknown) => { g.__t0728Opened.push(url); return 'opened' })
      ;(shell as AnyApi).openExternal = async (url: string) => { g.__t0728Shell.push(`openExternal ${url}`) }
      ;(shell as AnyApi).openPath = async (p: string) => { g.__t0728Shell.push(`openPath ${p}`); return '' }
      return true
    })).toBe(true)
    const opened = async (): Promise<string[]> => app.evaluate(() => (globalThis as AnyApi).__t0728Opened.splice(0))

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0728 links', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TAB, workspaceId: WS, type: 'terminal', title: 'Links', cwd: folder }],
      activeTerminalId: TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TAB), { timeout: 30_000 }).not.toBeNull()
    await win.waitForTimeout(2_000)
    const screen = win.locator('.workspace-container.active .terminal-wrapper.active .xterm-screen').first()
    await expect(screen).toBeVisible()

    // ② needs a path of more than `cols` cells (ASCII only, so it is only about the wrap): read the width first.
    const sizeProbe = slash(path.join(tmp, 'probe.json'))
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), {
      id: TAB, line: `node -e "require('fs').writeFileSync('${sizeProbe}', JSON.stringify({ cols: process.stdout.columns }))"\r`,
    })
    await expect.poll(() => fs.existsSync(sizeProbe), { timeout: 30_000 }).toBe(true)
    const probe = JSON.parse(fs.readFileSync(sizeProbe, 'utf8')) as { cols: number }
    const longUrl = `file:///C:/Users/demo/projects/t0728/${'deep-folder-name/'.repeat(Math.ceil((probe.cols + 30) / 17))}final-report.md`
    expect(longUrl.length).toBeGreaterThan(probe.cols)
    expect(longUrl.length).toBeLessThan(probe.cols * 2)

    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), {
      id: TAB, line: `node "${script}" "${sizeFile}" "${stopFile}" "${longUrl}"\r`,
    })
    await expect.poll(() => fs.existsSync(sizeFile), { timeout: 30_000 }).toBe(true)
    const size = JSON.parse(fs.readFileSync(sizeFile, 'utf8')) as { cols: number; rows: number }
    expect(size.cols).toBe(probe.cols)
    await win.waitForTimeout(1_000) // ConPTY repaint + the 150 ms output batching
    const box = (await screen.boundingBox())!
    const cellW = box.width / size.cols
    const cellH = box.height / size.rows
    log(`pty ${size.cols}x${size.rows}; .xterm-screen ${Math.round(box.width)}x${Math.round(box.height)} → cell ${cellW.toFixed(2)}x${cellH.toFixed(2)}; long path ${longUrl.length} chars`)
    await win.screenshot({ path: test.info().outputPath('links-screen.png') })

    const pointerOn = win.locator('.workspace-container.active .terminal-wrapper.active .xterm-cursor-pointer')
    const tooltip = win.locator('.workspace-container.active .terminal-wrapper.active .terminal-link-hover')
    const park = async () => {
      await win.mouse.move(box.x + box.width - cellW / 2, box.y + box.height - cellH / 2)
      await expect(pointerOn).toHaveCount(0)
    }
    /** Moves to (row, col) — 1-based cell — and reports whether xterm shows a link there. */
    const hover = async (row: number, col: number): Promise<boolean> => {
      await park()
      await win.mouse.move(box.x + (col - 0.5) * cellW, box.y + (row - 0.5) * cellH, { steps: 3 })
      try {
        await expect(pointerOn).toHaveCount(1, { timeout: 1_500 })
        return true
      } catch {
        return false
      }
    }
    const click = async (row: number, col: number): Promise<string[]> => {
      await hover(row, col)
      await win.mouse.down()
      await win.mouse.up()
      await win.waitForTimeout(400)
      return opened()
    }
    await opened() // nothing before the cases

    // ── ① full-width characters: the whole path, first and last cell ──
    const wideStart = cells(WIDE_PREFIX) + 1
    const wideEnd = wideStart + cells(WIDE_URL) - 1
    log(`① ${WIDE_URL}: cells ${wideStart}..${wideEnd} on row ${ROW_WIDE} (string length ${WIDE_URL.length}, ${cells(WIDE_URL) - WIDE_URL.length} wide chars)`)
    expect(await hover(ROW_WIDE, wideStart - 1), '① the cell before the path is not a link').toBe(false)
    expect(await hover(ROW_WIDE, wideStart), '① first cell').toBe(true)
    expect(await hover(ROW_WIDE, wideEnd), '① last cell (BUG-174: short by one cell per wide char)').toBe(true)
    expect(await hover(ROW_WIDE, wideEnd + 1), '① the cell after the path is not a link').toBe(false)
    expect(await click(ROW_WIDE, wideEnd), '① click on the last cell').toEqual([WIDE_URL])
    expect(await click(ROW_WIDE, wideStart), '① click on the first cell').toEqual([WIDE_URL])
    expect(await click(ROW_WIDE, wideEnd + 1), '① click just after it').toEqual([])

    // ── ② the wrapped path: both rows open the same full path ──
    const longEndCol = longUrl.length - size.cols
    log(`② wrapped path: row ${LONG_ROW} cols 1..${size.cols}, row ${LONG_ROW + 1} cols 1..${longEndCol}`)
    expect(await click(LONG_ROW, 1), '② first row, first cell').toEqual([longUrl])
    expect(await click(LONG_ROW + 1, 2), '② second row').toEqual([longUrl])
    expect(await click(LONG_ROW + 1, longEndCol), '② second row, last cell').toEqual([longUrl])
    expect(await hover(LONG_ROW + 1, longEndCol + 1), '② after the end of the second row').toBe(false)

    // ── ③ OSC 8: tooltip with the target, click sends the target ──
    const osc8Col = OSC8_PREFIX.length + 2
    expect(await hover(ROW_OSC8, osc8Col), '③ OSC 8 text is a link').toBe(true)
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveText(OSC8_TARGET)
    await win.screenshot({ path: test.info().outputPath('links-osc8-tooltip.png') })
    await park()
    await expect(tooltip).toHaveCount(0)
    expect(await click(ROW_OSC8, osc8Col), '③ click on the OSC 8 text').toEqual([OSC8_TARGET])
    expect(await hover(ROW_OSC8, OSC8_PREFIX.length + OSC8_TEXT.length + 1), '③ the cell after the text').toBe(false)

    // ── ④ OSC 8 javascript: — nothing opened, scheme + length logged only ──
    expect(await click(ROW_BAD, BAD_PREFIX.length + 2), '④ click on the javascript: link').toEqual([])
    await expect.poll(() => debugLog().includes(`[terminal-links] refused OSC 8 link scheme=javascript: length=${OSC8_BAD_TARGET.length}`), { timeout: 10_000 }).toBe(true)
    expect(debugLog()).not.toContain(OSC8_BAD_TARGET)

    // ── ⑤ https (WebLinksAddon) unchanged ──
    const webStart = WEB_PREFIX.length + 1
    const webEnd = webStart + WEB_URL.length - 1
    expect(await hover(ROW_WEB, webEnd), '⑤ last cell of the https link').toBe(true)
    expect(await hover(ROW_WEB, webEnd + 1), '⑤ after it').toBe(false)
    expect(await click(ROW_WEB, webStart), '⑤ click on the https link').toEqual([WEB_URL])
    await park()

    const shellCalls = await app.evaluate(() => (globalThis as AnyApi).__t0728Shell)
    expect(shellCalls, 'nothing reached the real shell.openExternal / openPath').toEqual([])
    fs.writeFileSync(stopFile, '')
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
  }
})
