// T0504 — a detached workspace window flushes its workspace state before it closes.
//
// A rename in a detached window has no save of its own (the 30 s autosave carries it), so
// before T0504 closing the window right after a rename lost it. Now main holds the close,
// asks the window to flush (workspace:flush-save → ack, at most 1.5 s), then closes it.
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`),
// NOT the installed BAT, through the shared isolation fixture (T0399).
//
// Flow: seed Alpha(1) + Beta(1) → detach Beta → rename Beta's terminal in the detached
// window → close the window at once (BrowserWindow.close(), as the title-bar X) → the
// parent entry has the new name and the parent window shows it → quit and relaunch the
// same runtime → still the new name.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0504-detached-flush')

const WS_ALPHA = 'e2e-t0504-ws-alpha'
const WS_BETA = 'e2e-t0504-ws-beta'
const TERM_ALPHA = 'e2e-t0504-term-alpha'
const TERM_BETA = 'e2e-t0504-term-beta'
const NAME_ALPHA = 'T0504-Alpha'
const NAME_BETA = 'T0504-Beta'
const TITLE_OLD = 'T0504 old name'
const TITLE_NEW = 'T0504 renamed in detached'

interface SavedTerminal { id: string; workspaceId: string; title?: string }
interface SavedEntry { workspaces: { id: string }[]; activeWorkspaceId: string | null; terminals: SavedTerminal[] }

async function loadEntry(page: Page): Promise<SavedEntry | null> {
  const raw = await page.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? JSON.parse(raw) as SavedEntry : null
}

const titleOf = (entry: SavedEntry | null, id: string) => entry?.terminals.find(t => t.id === id)?.title

test('a rename in a detached window reaches the parent entry when the window is closed right away', async () => {
  test.setTimeout(180_000)
  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 't0504-'))
  try {
    inst = await launchIsolated('t0504-detached-flush', log)
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
        { id: TERM_ALPHA, workspaceId: WS_ALPHA, type: 'terminal', title: 'T0504 Alpha' },
        { id: TERM_BETA, workspaceId: WS_BETA, type: 'terminal', title: TITLE_OLD },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const sidebarBeta = win.locator('.workspace-item', { hasText: NAME_BETA })
    await expect(sidebarBeta).toBeVisible({ timeout: 30_000 })

    // Detach Beta.
    const detachedPromise = app.waitForEvent('window', { timeout: 30_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_BETA)).toBe(true)
    const detached = await detachedPromise
    await detached.waitForLoadState('domcontentloaded')
    const view = detached.locator('.workspace-container.active')
    await expect(view).toBeVisible({ timeout: 30_000 })
    await expect(view.locator('.main-panel-title')).toContainText(TITLE_OLD, { timeout: 30_000 })

    // Rename through the UI (double-click the title, type, Enter): no save of its own.
    await view.locator('.main-panel-title').dblclick()
    const input = view.locator('.terminal-name-input')
    await expect(input).toBeVisible({ timeout: 5_000 })
    await input.fill(TITLE_NEW)
    await input.press('Enter')
    await expect(view.locator('.main-panel-title')).toContainText(TITLE_NEW, { timeout: 5_000 })
    // Evidence the gap is real: the rename is not in the entry yet (unless the 30 s autosave just ticked).
    const beforeClose = titleOf(await loadEntry(win), TERM_BETA)
    if (beforeClose === TITLE_NEW) log('WARN: the detached autosave persisted the rename before the close — this run does not discriminate')
    else log(`before close the parent entry still has "${beforeClose}"`)

    // Close the detached window at once, as the title-bar X does (BrowserWindow.close → 'close').
    const closed = detached.waitForEvent('close', { timeout: 15_000 })
    const closeAsked = await app.evaluate(({ BrowserWindow }) => {
      const target = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.getURL().includes('detached='))
      if (!target) return false
      target.close()
      return true
    })
    expect(closeAsked).toBe(true)
    await closed
    log('detached window closed')

    // The flush landed before the window went: the parent entry has the new name …
    expect(titleOf(await loadEntry(win), TERM_BETA)).toBe(TITLE_NEW)
    // … and the parent window adopted it on 'workspace:reattached'.
    await expect(sidebarBeta).toBeVisible({ timeout: 10_000 })
    await sidebarBeta.click()
    const parentBeta = win.locator('.workspace-container.active')
    await expect(parentBeta).toContainText(TITLE_NEW, { timeout: 15_000 })
    await expect(parentBeta).not.toContainText(TITLE_OLD)
    await win.screenshot({ path: test.info().outputPath('parent-after-close.png') })
    log('the parent entry and window show the rename made just before the close')

    // Quit (flush-save) and relaunch the same runtime.
    const { runtimeId } = inst
    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined
    relaunched = await launchIsolated('t0504-detached-flush', log, { runtimeId })
    const win2 = relaunched.win
    await expect.poll(async () => titleOf(await loadEntry(win2), TERM_BETA), { timeout: 30_000 }).toBe(TITLE_NEW)
    const sidebarBeta2 = win2.locator('.workspace-item', { hasText: NAME_BETA })
    await expect(sidebarBeta2).toBeVisible({ timeout: 30_000 })
    await sidebarBeta2.click()
    await expect(win2.locator('.workspace-container.active')).toContainText(TITLE_NEW, { timeout: 15_000 })
    log('after a restart the rename is still there')
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    fs.rmSync(folder, { recursive: true, force: true })
  }
})
