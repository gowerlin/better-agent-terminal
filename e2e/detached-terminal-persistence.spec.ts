// T0491 (BUG-113 known limitation) — terminals opened / closed in a detached workspace
// window are persisted into the parent window's registry entry.
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`),
// NOT the installed BAT, through the shared isolation fixture (T0399).
//
// Flow: seed the main window's entry (Alpha: 1 terminal, Beta: "Beta one" + "Beta two")
// → detach Beta → in the detached window close "Beta one" and open a new shell
// terminal → the parent entry holds Beta = [Beta two, new] while Alpha and the
// workspaces are untouched → a stale save from the parent (its pre-detach copy of
// Beta) does not undo it → close the detached window → the parent window shows the
// new terminal, not "Beta one" → quit and relaunch the same runtime → still correct.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0491-detached-terms')

const WS_ALPHA = 'e2e-t0491-ws-alpha'
const WS_BETA = 'e2e-t0491-ws-beta'
const TERM_ALPHA = 'e2e-t0491-term-alpha'
const TERM_BETA_1 = 'e2e-t0491-term-beta-1'
const TERM_BETA_2 = 'e2e-t0491-term-beta-2'
const NAME_ALPHA = 'T0491-Alpha'
const NAME_BETA = 'T0491-Beta'
const TITLE_BETA_1 = 'T0491 Beta one'
const TITLE_BETA_2 = 'T0491 Beta two'

interface SavedTerminal { id: string; workspaceId: string; title?: string }
interface SavedEntry {
  workspaces: { id: string; name: string }[]
  activeWorkspaceId: string | null
  terminals: SavedTerminal[]
}

async function loadEntry(page: Page): Promise<SavedEntry | null> {
  const raw = await page.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? JSON.parse(raw) as SavedEntry : null
}

const betaIds = (entry: SavedEntry | null) => (entry?.terminals ?? []).filter(t => t.workspaceId === WS_BETA).map(t => t.id)

test('terminals opened / closed in a detached window reach the parent entry and survive reattach + restart', async () => {
  test.setTimeout(180_000)
  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 't0491-'))
  try {
    inst = await launchIsolated('t0491-detached-terms', log)
    const { app, win } = inst

    await expect.poll(async () => (await loadEntry(win)) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_ALPHA, name: NAME_ALPHA, folderPath: folder, createdAt: Date.now() },
        { id: WS_BETA, name: NAME_BETA, folderPath: folder, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_ALPHA,
      activeGroup: null,
      terminals: [
        { id: TERM_ALPHA, workspaceId: WS_ALPHA, type: 'terminal', title: 'T0491 Alpha' },
        { id: TERM_BETA_1, workspaceId: WS_BETA, type: 'terminal', title: TITLE_BETA_1 },
        { id: TERM_BETA_2, workspaceId: WS_BETA, type: 'terminal', title: TITLE_BETA_2 },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const sidebarBeta = win.locator('.workspace-item', { hasText: NAME_BETA })
    await expect(sidebarBeta).toBeVisible({ timeout: 30_000 })
    // The parent's pre-detach view of the entry (what its store autosaves while Beta is detached).
    const parentCopy = await loadEntry(win)
    expect(betaIds(parentCopy)).toEqual([TERM_BETA_1, TERM_BETA_2])

    // Detach Beta.
    const detachedPromise = app.waitForEvent('window', { timeout: 30_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_BETA)).toBe(true)
    const detached = await detachedPromise
    await detached.waitForLoadState('domcontentloaded')
    const view = detached.locator('.workspace-container.active')
    await expect(view).toBeVisible({ timeout: 30_000 })
    await expect(view.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    log('detached window shows Beta with its two terminals')

    // Close the active terminal ("Beta one": the first one gets the focus) — an idle shell closes without a confirm.
    await expect(view.locator('.terminal-wrapper.active')).toContainText(TITLE_BETA_1, { timeout: 15_000 })
    await view.locator('.terminal-wrapper.active button.action-btn.danger', { hasText: '×' }).click()
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 10_000 })
    await expect.poll(async () => betaIds(await loadEntry(win)), { timeout: 10_000 }).toEqual([TERM_BETA_2])
    log('closing "Beta one" in the detached window reached the parent entry')

    // Open a new shell terminal from the thumbnail bar.
    const collapsed = view.locator('.collapsed-bar-bottom')
    if (await collapsed.count()) await collapsed.click()
    await view.locator('.thumbnail-add-btn').click()
    await detached.locator('.thumbnail-add-menu-item.has-submenu').first().click()
    await expect(view.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 10_000 })
    await expect.poll(async () => betaIds(await loadEntry(win)).length, { timeout: 10_000 }).toBe(2)
    const afterAdd = await loadEntry(win)
    const newId = betaIds(afterAdd).find(id => id !== TERM_BETA_2)!
    const newTitle = afterAdd!.terminals.find(t => t.id === newId)!.title!
    expect(betaIds(afterAdd)).toEqual([TERM_BETA_2, newId])
    // Only Beta's terminals moved: Alpha and the workspaces are the parent's.
    expect(afterAdd!.terminals.filter(t => t.workspaceId === WS_ALPHA).map(t => t.id)).toEqual([TERM_ALPHA])
    expect(afterAdd!.workspaces.map(w => w.id)).toEqual([WS_ALPHA, WS_BETA])
    expect(afterAdd!.activeWorkspaceId).toBe(WS_ALPHA)
    log(`opening a terminal in the detached window reached the parent entry (${newId}, "${newTitle}")`)

    // Race: the parent autosaves its stale copy of Beta while Beta is detached → Beta stays as the detached window left it.
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify({ ...parentCopy, activeGroup: null, activeTerminalId: null }))).toBe(true)
    expect(betaIds(await loadEntry(win))).toEqual([TERM_BETA_2, newId])
    log('a stale parent save while detached keeps the detached window\'s terminals')

    // Reattach by closing the detached window.
    const closed = detached.waitForEvent('close', { timeout: 15_000 })
    await detached.close()
    await closed
    await expect(sidebarBeta).toBeVisible({ timeout: 10_000 })
    await sidebarBeta.click()
    const parentBeta = win.locator('.workspace-container.active')
    await expect(parentBeta.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 15_000 })
    await expect(parentBeta).toContainText(newTitle, { timeout: 15_000 })
    await expect(parentBeta).toContainText(TITLE_BETA_2)
    await expect(parentBeta).not.toContainText(TITLE_BETA_1)
    await win.screenshot({ path: test.info().outputPath('parent-after-reattach.png') })
    log('after reattach the parent window shows the detached window\'s terminal list')

    // The parent owns Beta again: its own save is what persists now.
    await expect.poll(async () => betaIds(await loadEntry(win)), { timeout: 10_000 }).toEqual([TERM_BETA_2, newId])

    // Quit (flush-save) and relaunch the same runtime.
    const { runtimeId } = inst
    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined
    relaunched = await launchIsolated('t0491-detached-terms', log, { runtimeId })
    const win2 = relaunched.win
    await expect.poll(async () => betaIds(await loadEntry(win2)), { timeout: 30_000 }).toEqual([TERM_BETA_2, newId])
    const sidebarBeta2 = win2.locator('.workspace-item', { hasText: NAME_BETA })
    await expect(sidebarBeta2).toBeVisible({ timeout: 30_000 })
    await sidebarBeta2.click()
    const restartedBeta = win2.locator('.workspace-container.active')
    await expect(restartedBeta.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 15_000 })
    await expect(restartedBeta).not.toContainText(TITLE_BETA_1)
    log('after a restart the parent entry and window still hold [Beta two, new]')
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    fs.rmSync(folder, { recursive: true, force: true })
  }
})
