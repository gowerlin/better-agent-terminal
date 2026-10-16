// BUG-145 / T0572: a new tab's PTY must have the size xterm fit to, without the toolbar's redraw.
// The tab enters the store (TerminalPanel mounts and sends its first `pty:resize`) before
// `pty:create` reaches the host (the shell lookup is awaited first); the host dropped a resize for
// an id it did not know yet and the view's dedup never sent the size again, so the PTY kept its
// spawn size (120x30). ⏻ restart spawned the new PTY at 120x30 as well while the view believed the
// size was already sent.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Nothing starts
// an LLM: a node script run in each tab writes the PTY size it sees (`process.stdout.columns` /
// `rows`) to a file, again on every SIGWINCH. Then the toolbar's redraw sends xterm's own size; a
// PTY that already had it gets no new size, one that did not records xterm's size as its last entry.
//
//   1. restored tab (seeded, window reload)
//   2. several new tabs from the + menu
//   3. ⏻ restart of the active tab

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0572')
const WS = 'e2e-t0572-ws'
const TAB = 'e2e-t0572-tab'
const NEW_TABS = 4

type Size = { cols: number; rows: number }

// `node size.cjs <file>`: appends {cols, rows} to <file> now and on every resize; `q` exits.
const scriptSource = [
  "const fs = require('fs')",
  'const file = process.argv[2]',
  "const write = () => fs.appendFileSync(file, JSON.stringify({ cols: process.stdout.columns, rows: process.stdout.rows }) + '\\n')",
  "process.stdout.on('resize', write)",
  'if (process.stdin.isTTY) process.stdin.setRawMode(true)',
  "process.stdin.on('data', d => { if (d.toString().includes('q')) process.exit(0) })",
  "process.stdout.write('T0572 size probe\\r\\n', write)",
  '',
].join('\n')

const readSizes = (file: string): Size[] =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Size) : []

const sameSize = (a: Size, b: Size) => a.cols === b.cols && a.rows === b.rows

test('a new PTY gets the size xterm fit to: restored tab, new tabs, restart (no redraw needed)', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0572-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const script = path.join(tmp, 'size.cjs').split(path.sep).join('/')
  fs.writeFileSync(script, scriptSource)
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0572', log)
    const { win } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0572', folderPath: folder, createdAt: Date.now() }],
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

    // output seen per PTY id (the canvas renderer leaves no text in the DOM)
    await win.evaluate(() => {
      const w = window as AnyApi
      w.__t0572Output = {} as Record<string, number>
      w.electronAPI.pty.onOutput((id: string) => { w.__t0572Output[id] = (w.__t0572Output[id] ?? 0) + 1 })
    })
    const outputCount = (id: string) => win.evaluate((tid) => ((window as AnyApi).__t0572Output[tid] ?? 0) as number, id)
    const savedIds = async (): Promise<string[]> => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      return raw ? (JSON.parse(raw) as { terminals: { id: string }[] }).terminals.map(t => t.id) : []
    }

    let probe = 0
    // Runs the script in tab `id` once its shell printed something; returns
    // the PTY size before the redraw and xterm's size (the last entry after it).
    const measure = async (label: string, id: string): Promise<{ pty: Size; xterm: Size }> => {
      const file = path.join(tmp, `size-${++probe}.jsonl`).split(path.sep).join('/')
      await expect.poll(() => outputCount(id), { timeout: 30_000 }).toBeGreaterThan(0)
      await win.waitForTimeout(1500)
      await win.evaluate(({ tid, line }) => (window as AnyApi).electronAPI.pty.write(tid, line), { tid: id, line: `node "${script}" "${file}"\r` })
      await expect.poll(() => readSizes(file).length, { timeout: 30_000 }).toBeGreaterThan(0).catch(async (err: unknown) => {
        const buf = await win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id)
        log(`${label}: no size from the script; PTY buffer: ${JSON.stringify(buf?.data ?? buf).slice(-1500)}`)
        throw err
      })
      // give a late resize (if any) its chance before the redraw
      await win.waitForTimeout(1000)
      const before = readSizes(file)
      const pty = before[before.length - 1]
      await win.evaluate((tid) => window.dispatchEvent(new CustomEvent('terminal-redraw', { detail: { terminalId: tid } })), id)
      await win.waitForTimeout(1500)
      const after = readSizes(file)
      const xterm = after[after.length - 1]
      log(`${label}: pty ${pty.cols}x${pty.rows}, xterm ${xterm.cols}x${xterm.rows}${sameSize(pty, xterm) ? '' : '  <- MISMATCH'}`)
      await win.evaluate((tid) => (window as AnyApi).electronAPI.pty.write(tid, 'q'), id)
      return { pty, xterm }
    }

    const results: Array<{ label: string; pty: Size; xterm: Size }> = []

    // -- 1. restored tab --
    results.push({ label: 'restored', ...(await measure('restored', TAB)) })

    // -- 2. new tabs --
    let lastNew = TAB
    for (let i = 1; i <= NEW_TABS; i++) {
      const known = new Set(await savedIds())
      await view.locator('.thumbnail-add-btn').click()
      await win.locator('.thumbnail-add-menu-item.has-submenu').first().click()
      await expect(view.locator('.terminal-wrapper')).toHaveCount(1 + i, { timeout: 30_000 })
      let id = ''
      await expect.poll(async () => (id = (await savedIds()).find(t => !known.has(t)) ?? ''), { timeout: 15_000 }).not.toBe('')
      lastNew = id
      results.push({ label: `new #${i}`, ...(await measure(`new #${i}`, id)) })
    }

    // -- 3. restart of the active tab (the last new one) --
    await win.waitForTimeout(1000)
    await win.evaluate((tid) => { (window as AnyApi).__t0572Output[tid] = 0 }, lastNew)
    await win.locator('.main-panel button[title="重新啟動終端"]:visible').first().click()
    await win.locator('.dialog-btn.confirm.danger').click()
    results.push({ label: 'restart', ...(await measure('restart', lastNew)) })

    const mismatches = results.filter(r => !sameSize(r.pty, r.xterm))
    expect(mismatches.map(r => `${r.label}: pty ${r.pty.cols}x${r.pty.rows} ≠ xterm ${r.xterm.cols}x${r.xterm.rows}`)).toEqual([])
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
