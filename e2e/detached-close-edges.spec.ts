// T0508 — two edges of T0504's flush-before-close on a detached workspace window.
//
//   1. The quit confirmation dialog is open (isAppQuitting is already true) and the user
//      closes a detached window, then cancels the quit. Before T0508 the window closed
//      without a flush (the quit path was assumed to flush it), so a rename made just
//      before was lost. Now only a started quit flush skips the close flush.
//   2. The user detaches the same workspace again while its window is still flushing
//      before close. Before T0508 the closing window was focused and no window opened;
//      the parent then marked the workspace as reattached. Now the detach waits until
//      the old window closed and the parent was told, then opens a new window.
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`),
// NOT the installed BAT, through the shared isolation fixture (T0399).

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0508-detached-close-edges')

const WS_ALPHA = 'e2e-t0508-ws-alpha'
const WS_BETA = 'e2e-t0508-ws-beta'
const TERM_ALPHA = 'e2e-t0508-term-alpha'
const TERM_BETA = 'e2e-t0508-term-beta'
const NAME_ALPHA = 'T0508-Alpha'
const NAME_BETA = 'T0508-Beta'
const TITLE_OLD = 'T0508 old name'
const TITLE_NEW = 'T0508 renamed in detached'

interface SavedTerminal { id: string; workspaceId: string; title?: string }
interface SavedEntry { workspaces: { id: string }[]; activeWorkspaceId: string | null; terminals: SavedTerminal[] }

async function loadEntry(page: Page): Promise<SavedEntry | null> {
  const raw = await page.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? JSON.parse(raw) as SavedEntry : null
}

const titleOf = (entry: SavedEntry | null, id: string) => entry?.terminals.find(t => t.id === id)?.title

/** Seeds Alpha + Beta, detaches Beta and renames its terminal in the detached window (no save of its own). */
async function detachAndRename(app: ElectronApplication, win: Page, folder: string): Promise<Page> {
  await expect.poll(async () => (await loadEntry(win)) !== null, { timeout: 30_000 }).toBe(true)
  const seed = {
    workspaces: [
      { id: WS_ALPHA, name: NAME_ALPHA, folderPath: folder, createdAt: Date.now() },
      { id: WS_BETA, name: NAME_BETA, folderPath: folder, createdAt: Date.now() },
    ],
    activeWorkspaceId: WS_ALPHA,
    activeGroup: null,
    terminals: [
      { id: TERM_ALPHA, workspaceId: WS_ALPHA, type: 'terminal', title: 'T0508 Alpha' },
      { id: TERM_BETA, workspaceId: WS_BETA, type: 'terminal', title: TITLE_OLD },
    ],
    activeTerminalId: null,
  }
  expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await expect(win.locator('.workspace-item', { hasText: NAME_BETA })).toBeVisible({ timeout: 30_000 })

  const detachedPromise = app.waitForEvent('window', { timeout: 30_000 })
  expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_BETA)).toBe(true)
  const detached = await detachedPromise
  await detached.waitForLoadState('domcontentloaded')
  const view = detached.locator('.workspace-container.active')
  await expect(view).toBeVisible({ timeout: 30_000 })
  await expect(view.locator('.main-panel-title')).toContainText(TITLE_OLD, { timeout: 30_000 })
  await expect(win.locator('.workspace-item', { hasText: NAME_BETA })).toBeHidden({ timeout: 10_000 })

  await view.locator('.main-panel-title').dblclick()
  const input = view.locator('.terminal-name-input')
  await expect(input).toBeVisible({ timeout: 5_000 })
  await input.fill(TITLE_NEW)
  await input.press('Enter')
  await expect(view.locator('.main-panel-title')).toContainText(TITLE_NEW, { timeout: 5_000 })
  const beforeClose = titleOf(await loadEntry(win), TERM_BETA)
  if (beforeClose === TITLE_NEW) log('WARN: the detached autosave persisted the rename before the close — this run does not discriminate')
  else log(`before close the parent entry still has "${beforeClose}"`)
  return detached
}

/** BrowserWindow.close() on the detached window, as the title-bar X does. */
async function closeDetachedWindow(app: ElectronApplication): Promise<void> {
  const asked = await app.evaluate(({ BrowserWindow }) => {
    const target = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.getURL().includes('detached='))
    if (!target) return false
    target.close()
    return true
  })
  expect(asked).toBe(true)
}

test('a detached window closed while the quit dialog is open keeps its rename when the quit is cancelled', async () => {
  test.setTimeout(180_000)
  let inst: IsolatedInstance | undefined
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 't0508-'))
  try {
    inst = await launchIsolated('t0508-quit-cancel', log)
    const { app, win } = inst
    const detached = await detachAndRename(app, win, folder)

    // Hold the quit confirmation open: showMessageBox answers only when the test says so.
    await app.evaluate(({ dialog }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any
      g.__t0508DialogShown = false
      g.__t0508Answer = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(dialog as any).showMessageBox = () => {
        g.__t0508DialogShown = true
        return new Promise((resolve) => { g.__t0508Answer = resolve })
      }
    })
    await app.evaluate(({ app: electronApp }) => { electronApp.quit() })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect.poll(() => app.evaluate(() => (globalThis as any).__t0508DialogShown === true), { timeout: 10_000 }).toBe(true)
    log('quit dialog is open')

    const closed = detached.waitForEvent('close', { timeout: 15_000 })
    await closeDetachedWindow(app)
    await closed
    log('detached window closed while the quit dialog was open')
    expect(titleOf(await loadEntry(win), TERM_BETA)).toBe(TITLE_NEW)

    // Cancel the quit.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.evaluate(() => { (globalThis as any).__t0508Answer({ response: 0, checkboxChecked: false }) })
    log('quit cancelled')

    // The app keeps running; the parent adopted the workspace with the rename.
    const sidebarBeta = win.locator('.workspace-item', { hasText: NAME_BETA })
    await expect(sidebarBeta).toBeVisible({ timeout: 10_000 })
    await sidebarBeta.click()
    const parentBeta = win.locator('.workspace-container.active')
    await expect(parentBeta).toContainText(TITLE_NEW, { timeout: 15_000 })
    await expect(parentBeta).not.toContainText(TITLE_OLD)
    expect(titleOf(await loadEntry(win), TERM_BETA)).toBe(TITLE_NEW)
    await win.screenshot({ path: test.info().outputPath('parent-after-cancelled-quit.png') })
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(folder, { recursive: true, force: true })
  }
})

test('detaching the workspace again while its window still flushes opens a new window after the old one closed', async () => {
  test.setTimeout(180_000)
  let inst: IsolatedInstance | undefined
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 't0508-'))
  try {
    inst = await launchIsolated('t0508-redetach', log)
    const { app, win } = inst
    const detached = await detachAndRename(app, win, folder)

    // Keep the detached renderer busy for 1 s (< DETACHED_CLOSE_FLUSH_TIMEOUT_MS = 1.5 s), so its
    // flush ack — and with it the close — waits while the parent detaches the workspace again.
    await detached.evaluate(() => {
      setTimeout(() => {
        const until = Date.now() + 1000
        while (Date.now() < until) { /* busy */ }
      }, 0)
    })
    const oldClosed = detached.waitForEvent('close', { timeout: 15_000 })
    await closeDetachedWindow(app)
    if (detached.isClosed()) log('WARN: the detached window closed before the re-detach — this run does not discriminate')

    // Before T0508 this focused the closing window and no new window ever opened.
    const newWindow = app.waitForEvent('window', { timeout: 15_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_BETA)).toBe(true)
    // The detach answered after the old window went: the parent and the new window are left.
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => !w.isDestroyed()).length)).toBe(2)
    await oldClosed
    const second = await newWindow
    await second.waitForLoadState('domcontentloaded')
    log('a new detached window opened after the closing one went away')

    // The new window shows the workspace with the rename the old one flushed; the parent keeps it detached.
    const view = second.locator('.workspace-container.active')
    await expect(view).toBeVisible({ timeout: 30_000 })
    await expect(view.locator('.main-panel-title')).toContainText(TITLE_NEW, { timeout: 30_000 })
    expect(titleOf(await loadEntry(win), TERM_BETA)).toBe(TITLE_NEW)
    const sidebarBeta = win.locator('.workspace-item', { hasText: NAME_BETA })
    await expect(sidebarBeta).toBeHidden({ timeout: 10_000 })

    // Closing the new window gives the workspace back to the parent as usual.
    const secondClosed = second.waitForEvent('close', { timeout: 15_000 })
    await closeDetachedWindow(app)
    await secondClosed
    await expect(sidebarBeta).toBeVisible({ timeout: 10_000 })
    await sidebarBeta.click()
    await expect(win.locator('.workspace-container.active')).toContainText(TITLE_NEW, { timeout: 15_000 })
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(folder, { recursive: true, force: true })
  }
})
