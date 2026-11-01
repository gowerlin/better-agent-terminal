// BUG-180 / T0741: a tab opened from "+" and switched away from at once (the next "+" tab became
// active within the 100 ms of its initial resize) had its PTY resized to ~9x5 until it was selected.
// TerminalPanel's initial `doResize()` fit the hidden (display: none) container: FitAddon reads its
// size from getComputedStyle, which for an element that is not rendered gives `100%` → 100 px.
//
// Only "+" items that focus the new tab before awaiting anything (Claude CLI, Open Claude as Tower)
// mount it active and so arm that timer; a shell tab is focused after `await getShellFromSettings()`
// and mounts hidden (T0741 checked: the shell variant of this test passed on the unfixed build).
// So, as in T0736: "+" → Claude CLI, then "+" → Open Claude as Tower, one frame apart, 3 rounds.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Claude is not
// meant to get anywhere: temp home, a dead API base URL and proxy (127.0.0.1:9), no inherited
// ANTHROPIC_* / CLAUDE* env. The PTY size is read from the main process's `[resize] pty:resize id=…`
// lines (every size the view sends to the PTY).

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0741')
const WS = 'e2e-t0741-ws'
const TAB = 'e2e-t0741-tab'
const ROUNDS = 3
const CLAUDE_ITEM = /^\s*▶\s*Claude CLI\s*(suggested|建議|建议)?\s*$/
const TOWER_ITEM = /以塔台開啟 Claude|Open Claude as Tower|以塔台打开 Claude/
const INHERITED = /^(ANTHROPIC_|CLAUDE|OPENAI_|CODEX_)/i

type Size = { cols: number; rows: number }
const fmt = (s: Size | undefined) => (s ? `${s.cols}x${s.rows}` : 'none')
/** Smaller than any real terminal view; the bug gave 9x5. */
const tooSmall = (s: Size) => s.cols < 20 || s.rows < 8

async function withoutInheritedAgentEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (INHERITED.test(k) && v !== undefined) { saved[k] = v; delete process.env[k] }
  try {
    return await fn()
  } finally {
    Object.assign(process.env, saved)
  }
}

test('a new tab switched away from at once keeps a real PTY size until selected, then gets its fit size', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0741-'))
  const folder = path.join(tmp, 'ws')
  const home = path.join(tmp, 'home')
  fs.mkdirSync(folder, { recursive: true })
  // Electron's appData (→ the runtime userData) follows USERPROFILE: the known folders must exist (as in T0736).
  for (const dir of [['AppData', 'Roaming'], ['AppData', 'Local'], ['Documents']]) fs.mkdirSync(path.join(home, ...dir), { recursive: true })
  const env = {
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:9',
    ANTHROPIC_API_KEY: 'sk-t0741-not-a-key',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
    USERPROFILE: home,
    HOME: home,
    HTTPS_PROXY: 'http://127.0.0.1:9',
    HTTP_PROXY: 'http://127.0.0.1:9',
    NO_PROXY: '127.0.0.1,localhost',
  }
  let inst: IsolatedInstance | undefined
  try {
    inst = await withoutInheritedAgentEnv(() => launchIsolated('t0741', log, { env }))
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0741', folderPath: folder, createdAt: Date.now() }],
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
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TAB), { timeout: 30_000 }).not.toBeNull()

    const savedIds = async (): Promise<string[]> => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      return raw ? (JSON.parse(raw) as { terminals: { id: string }[] }).terminals.map(t => t.id) : []
    }
    const debugLog = () => {
      const dir = path.join(userData, 'Logs')
      return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    }
    const ptyResizes = (id: string): Size[] => debugLog().split('\n')
      .filter(l => l.includes(`[resize] pty:resize id=${id} `))
      .map(l => /cols=(\d+) rows=(\d+)/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(m => ({ cols: Number(m[1]), rows: Number(m[2]) }))
    const viewLines = (id: string) => debugLog().split('\n').filter(l => l.includes(id) && l.includes('resize]')).map(l => l.slice(0, 300))

    const failures: string[] = []
    for (let round = 1; round <= ROUNDS; round++) {
      const known = new Set(await savedIds())
      const count = await view.locator('.terminal-wrapper').count()
      // "+" → Claude CLI, then "+" → Open Claude as Tower, one frame apart: the first new tab is
      // hidden well within its 100 ms. The menu (AddMenu) may render outside the workspace container.
      await win.evaluate(async ({ claude, tower }) => {
        const frame = () => new Promise(r => requestAnimationFrame(() => r(null)))
        const menuItem = async (re: RegExp) => {
          for (let i = 0; i < 30; i++) {
            const el = Array.from(document.querySelectorAll('.thumbnail-add-menu-item')).find(e => re.test(e.textContent ?? '')) as HTMLElement | undefined
            if (el) return el
            await frame()
          }
          throw new Error(`"+" menu item ${re} not found`)
        }
        const add = async (re: RegExp) => {
          ;(document.querySelector('.workspace-container.active .thumbnail-add-btn') as HTMLElement).click()
          ;(await menuItem(re)).click()
          await frame()
        }
        await add(new RegExp(claude))
        await add(new RegExp(tower))
      }, { claude: CLAUDE_ITEM.source, tower: TOWER_ITEM.source })
      await expect(view.locator('.terminal-wrapper')).toHaveCount(count + 2, { timeout: 30_000 })
      let ids: string[] = []
      await expect.poll(async () => (ids = (await savedIds()).filter(t => !known.has(t))).length, { timeout: 15_000 }).toBe(2)
      const [first, second] = ids
      // both PTYs exist, the active one has sent its fit size
      await expect.poll(() => ptyResizes(second).length, { timeout: 30_000 }).toBeGreaterThan(0)
      await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), first), { timeout: 30_000 }).not.toBeNull()
      await win.waitForTimeout(2000)

      // the first tab was hidden at once and never selected since
      const hidden = ptyResizes(first)
      const fit = ptyResizes(second).at(-1)!
      log(`round ${round}: ${first} (Claude CLI, switched away at once) before selecting it: pty:resize ${JSON.stringify(hidden.map(fmt))}; active ${second}: ${fmt(fit)}`)
      const small = hidden.filter(tooSmall)
      if (small.length) failures.push(`round ${round}: pty:resize to ${small.map(fmt).join(', ')} while hidden`)

      // select it: its PTY ends at the same fit size as the active tab's (same container)
      await view.locator('.thumbnail').nth((await savedIds()).indexOf(first)).click()
      await win.waitForTimeout(1500)
      const after = ptyResizes(first)
      log(`round ${round}: after selecting it: pty:resize ${JSON.stringify(after.map(fmt))}`)
      if (fmt(after.at(-1)) !== fmt(fit)) failures.push(`round ${round}: after selecting, PTY ${fmt(after.at(-1))} ≠ fit ${fmt(fit)}`)
      if (round === 1 || failures.length) log(`round ${round}: resize lines of ${first}:\n${viewLines(first).join('\n')}`)
    }
    await win.screenshot({ path: test.info().outputPath('t0741-final.png') })
    expect(failures).toEqual([])
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
