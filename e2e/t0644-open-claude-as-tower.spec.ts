// PLAN-050 / T0644 (D167): "Open Claude as Tower" — a claude-cli tab named `<ws> · Tower`, end to end
// in an isolated BAT.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The workspace's
// claude-cli custom args are `--version`, so the embedded claude prints its version and exits (no TUI,
// no prompt, nothing starts an LLM). The name is read from main's `[bat-mcp] tab … → injected:` line,
// written each time the renderer asks for a claude-cli tab's launch args.
//
//   1. add menu → screenshot (e2e-results/t0644/, not versioned) → "Open Claude as Tower": the tab is
//      saved with `launchRole: 'tower'` and title `Claude CLI · Tower`; launch args `--name=<ws> · Tower`
//   2. add menu → "Claude CLI" (the existing entry): `--name=<ws> · <short id>`, no launchRole
//   3. ⏻ restart of the Tower tab: again `<ws> · Tower`
//   4. reload (BAT reopen restores the tabs): the Tower tab again `<ws> · Tower`, the other `<ws> · <short id>`

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0644')
const WS = 'e2e-t0644-ws'
const WS_NAME = '測試工作區 T0644'
const SHELL_TAB = 'e2e-t0644-shell'
const TOWER_ITEM = /以塔台開啟 Claude|Open Claude as Tower|以塔台打开 Claude/
const SHOTS = path.resolve(__dirname, '..', 'e2e-results', 't0644')

interface SavedTab { id: string; title?: string; agentPreset?: string; launchRole?: string }

const shortId = (id: string) => id.replace(/-/g, '').slice(0, 6).toLowerCase()

test('Open Claude as Tower: `<ws> · Tower` on open, ⏻ restart and reopen; Claude CLI keeps `<ws> · <short id>`', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0644-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  fs.mkdirSync(SHOTS, { recursive: true })

  const debugLog = (userData: string) => {
    const dir = path.join(userData, 'Logs')
    return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  }
  /** main's launch-args lines for terminal `id`, oldest first. */
  const launchLines = (userData: string, id: string) =>
    debugLog(userData).split('\n').filter(l => l.includes(`[bat-mcp] tab agent=claude-cli terminal=${id} → injected:`))
  const savedTabs = async (win: Page): Promise<SavedTab[]> => {
    const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
    return raw ? (JSON.parse(raw) as { terminals: SavedTab[] }).terminals : []
  }
  /** Opens the add menu, clicks the item matching `name`, returns the new tab's saved record. */
  const addFromMenu = async (win: Page, name: RegExp | string, shot?: string): Promise<SavedTab> => {
    const known = new Set((await savedTabs(win)).map(t => t.id))
    const view = win.locator('.workspace-container.active')
    await view.locator('.thumbnail-add-btn').click()
    const item = win.locator('.thumbnail-add-menu-item', { hasText: name }).first()
    await expect(item).toBeVisible()
    if (shot) {
      await item.hover()
      await win.screenshot({ path: path.join(SHOTS, shot) })
      log(`screenshot: ${path.join(SHOTS, shot)}`)
    }
    await item.click()
    let tab: SavedTab | undefined
    await expect.poll(async () => (tab = (await savedTabs(win)).find(t => !known.has(t.id))) !== undefined, { timeout: 15_000 }).toBe(true)
    return tab!
  }
  const expectName = async (userData: string, id: string, count: number, name: string) => {
    await expect.poll(() => launchLines(userData, id).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(count)
    const line = launchLines(userData, id)[count - 1]
    log(`${id} #${count}: ${line}`)
    expect(line).toMatch(/; name=yes$/)
    expect(line).toContain(`--name=${name}`)
  }

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0644', log)
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{
        id: WS, name: WS_NAME, folderPath: folder, createdAt: Date.now(),
        // T0529: the workspace's claude-cli args — claude prints its version and exits
        agentCustomArgs: { 'claude-cli': '--version' },
      }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: SHELL_TAB, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: SHELL_TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })

    // ── 1. the new entry ──
    const tower = await addFromMenu(win, TOWER_ITEM, 'add-menu.png')
    log(`tower tab: ${JSON.stringify(tower)}`)
    expect(tower).toMatchObject({ agentPreset: 'claude-cli', launchRole: 'tower', title: 'Claude CLI · Tower' })
    await expectName(userData, tower.id, 1, `${WS_NAME} · Tower`)
    await win.waitForTimeout(1_500)
    await win.screenshot({ path: path.join(SHOTS, 'tower-tab.png') })

    // ── 2. the existing Claude CLI entry is unchanged ──
    // T0660: the "suggested" tag follows the UI language.
    const plain = await addFromMenu(win, /^\s*▶\s*Claude CLI\s*(suggested|建議|建议)?\s*$/)
    log(`plain tab: ${JSON.stringify(plain)}`)
    expect(plain.agentPreset).toBe('claude-cli')
    expect(plain.launchRole).toBeUndefined()
    await expectName(userData, plain.id, 1, `${WS_NAME} · ${shortId(plain.id)}`)

    // ── 3. ⏻ restart of the Tower tab ──
    await win.locator('.workspace-container.active .thumbnail', { hasText: 'Claude CLI · Tower' }).first().click()
    await win.waitForTimeout(500)
    await win.locator('.main-panel button.action-btn.danger:visible', { hasText: '⏻' }).first().click()
    await win.locator('.dialog-btn.confirm.danger').click()
    await expectName(userData, tower.id, 2, `${WS_NAME} · Tower`)

    // ── 4. reopen: the saved launchRole names the restored tab again ──
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expectName(userData, tower.id, 3, `${WS_NAME} · Tower`)
    await expectName(userData, plain.id, 2, `${WS_NAME} · ${shortId(plain.id)}`)
    const restored = (await savedTabs(win)).find(t => t.id === tower.id)
    expect(restored).toMatchObject({ launchRole: 'tower', title: 'Claude CLI · Tower' })
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
