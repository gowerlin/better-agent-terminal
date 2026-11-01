// T0738 / BUG-175: the thumbnail preview of a tab whose program updates the screen in place with
// cursor moves and never sends `\n` (a full-screen TUI) shows the updated rows as separate lines and
// no `>0q` / `>4m` junk (T0714). Before T0714 rows written after `CSI row;col H` were glued onto one
// preview line and the XTVERSION / modifyOtherKeys queries were left as `>0q>4m`.
//
// Two seeded tabs; the inactive one runs a node script: clear the screen and paint dots on three rows
// near the bottom (ConPTY repaints a cleared screen with \r\n), then 800 ms later overwrite the same
// cells with three markers + `CSI > 0 q` / `CSI > 4 m`. ConPTY sends that update as `CSI row;col H` +
// text with no newline — the test checks this in the raw `pty:output` before judging the preview.
//
// Not covered: the raw macOS / Linux PTY stream of BUG-175 (claude's own redraw, no ConPTY in
// between) still needs a real Mac or Linux machine. Isolated source build (`npx vite build` first),
// see fixtures/electron-isolation.ts.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0738-thumb')
const WS = 'e2e-t0738-thumb-ws'
const ACTIVE_TAB = 'e2e-t0738-thumb-active'
const TUI_TAB = 'e2e-t0738-thumb-tui'
const TUI_TITLE = 'T0738 tui'
const ROWS = ['T0738-ROW-ALPHA', 'T0738-ROW-BRAVO', 'T0738-ROW-CHARLIE']

// Markers are only in this file, never on the command line the shell echoes.
const TUI_SCRIPT = [
  'const E = String.fromCharCode(27)',
  `const rows = ${JSON.stringify(ROWS)}`,
  'const h = process.stdout.rows || 30',
  "const at = (i) => E + '[' + (h - 6 + i * 2) + ';3H'",
  "let first = E + '[2J' + E + '[H'",
  "rows.forEach((r, i) => { first += at(i) + '.'.repeat(r.length) })",
  'process.stdout.write(first)',
  'setTimeout(() => {',
  "  let next = ''",
  '  rows.forEach((r, i) => { next += at(i) + r })',
  "  process.stdout.write(next + E + '[>0q' + E + '[>4m')",
  '}, 800)',
  'setTimeout(() => {}, 120000)',
  '',
].join('\n')

const previewOf = (win: Page, title: string): Promise<string> =>
  win.locator('.thumbnail', { hasText: title }).first().locator('.thumbnail-preview').evaluate((el) => (el as HTMLElement).innerText)

test('a tab that updates rows with cursor moves and no newline: its preview shows each row and no >0q / >4m', async () => {
  test.setTimeout(180_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0738-thumb-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const script = path.join(tmp, 'tui.cjs').split(path.sep).join('/')
  fs.writeFileSync(script, TUI_SCRIPT)
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0738-thumb', log)
    const { win } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    await win.evaluate(async (patch) => {
      const a = (window as AnyApi).electronAPI
      const raw = await a.settings.load()
      await a.settings.save(JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), ...patch }))
    }, { createDefaultAgentTerminal: false, defaultTerminalCount: 1, language: 'en' })
    const seed = {
      workspaces: [{ id: WS, name: 'T0738 thumb', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: ACTIVE_TAB, workspaceId: WS, type: 'terminal', title: 'T0738 active', cwd: folder },
        { id: TUI_TAB, workspaceId: WS, type: 'terminal', title: TUI_TITLE, cwd: folder },
      ],
      activeTerminalId: ACTIVE_TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.thumbnail', { hasText: TUI_TITLE })).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => (await win.evaluate((i) => (window as AnyApi).electronAPI.pty.write(i, ''), TUI_TAB))?.ok ?? null,
      { timeout: 30_000 }).toBe(true)
    // let the shell prompt settle so the script's output is the last thing in the stream
    await expect.poll(() => previewOf(win, TUI_TITLE), { timeout: 30_000 }).toMatch(/>\s*$/)
    log(`preview before: ${JSON.stringify(await previewOf(win, TUI_TITLE))}`)

    await win.evaluate((id) => {
      const w = window as AnyApi
      w.__t0738Raw = ''
      w.electronAPI.pty.onOutput((outId: string, data: string) => { if (outId === id) w.__t0738Raw += data })
    }, TUI_TAB)
    await win.evaluate(([i, d]) => (window as AnyApi).electronAPI.pty.write(i, d), [TUI_TAB, `node "${script}"\r`] as const)
    await expect.poll(() => previewOf(win, TUI_TITLE), { timeout: 30_000 }).toContain(ROWS[2])
    await win.waitForTimeout(1_000) // a few more 150 ms flush windows
    const preview = await previewOf(win, TUI_TITLE)
    log(`preview after: ${JSON.stringify(preview)}`)
    const raw = await win.evaluate(() => (window as AnyApi).__t0738Raw as string)
    log(`raw pty:output since the command (${raw.length} chars, last 400): ${JSON.stringify(raw.slice(-400))}`)
    await win.locator('.thumbnail', { hasText: TUI_TITLE }).first().screenshot({ path: test.info().outputPath('tui-thumbnail.png') })

    // the scenario really is BUG-175's: the markers arrived as cursor moves + text, no newline before them
    for (const r of ROWS) expect(raw, `${r} written after CSI row;col H`).toMatch(new RegExp(`\\x1b\\[\\d+;\\d+H${r}`))
    expect(raw).toContain('\x1b[>0q')

    const lines = preview.split('\n')
    const rowLine = ROWS.map(r => lines.findIndex(l => l.includes(r)))
    log(`preview lines holding the rows: ${JSON.stringify(rowLine)}`)
    for (const [i, idx] of rowLine.entries()) expect(idx, `${ROWS[i]} is in the preview`).toBeGreaterThanOrEqual(0)
    expect(new Set(rowLine).size, 'each row on its own preview line').toBe(ROWS.length)
    expect(rowLine, 'rows in screen order').toEqual([...rowLine].sort((a, b) => a - b))
    for (const [i, r] of ROWS.entries()) expect(lines[rowLine[i]].trim(), `${r}'s line holds only that row`).toBe(r)
    expect(preview).not.toContain('>0q')
    expect(preview).not.toContain('>4m')
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
