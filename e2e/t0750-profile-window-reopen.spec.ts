// T0750 (BUG-183 / BUG-184): profile windows and the profiles dialog ("配置"), local profiles only
// (no WSL / SSH / Docker is touched), in ONE isolated instance.
//
//   BUG-183  minimize to tray on → close the only window of profile B (hidden, still in windowMap)
//            → "Open" on B's card → B's window is visible again and focused, no "already open" notice.
//   BUG-184  open profile C's window → delete C with the card's ✕ → C's window is gone, so the tray
//            menu (one row per live window in windowMap) no longer lists it; the others stay.
//
// Screenshots go to BAT_E2E_T0750_EVIDENCE_DIR (default <tmp>/bat-t0750/evidence).
//
//   npx vite build
//   npx playwright test e2e/t0750-profile-window-reopen.spec.ts

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

const log = testLogger('t0750')
const EVIDENCE_DIR = process.env.BAT_E2E_T0750_EVIDENCE_DIR || path.join(os.tmpdir(), 'bat-t0750', 'evidence')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`) })
  log(`screenshot ${name}.png`)
}

function card(win: Page, profileId: string) {
  return win.locator(`[data-testid="profile-card"][data-profile-id="${profileId}"]`)
}

/** State of the BrowserWindow that loaded `windowId` (`gone` once destroyed). */
async function windowState(app: ElectronApplication, windowId: string): Promise<'visible' | 'hidden' | 'gone'> {
  return app.evaluate(({ BrowserWindow }, id) => {
    const w = BrowserWindow.getAllWindows().find(b => !b.isDestroyed() && b.webContents.getURL().includes(`windowId=${encodeURIComponent(id)}`))
    if (!w) return 'gone'
    return w.isVisible() && !w.isMinimized() ? 'visible' : 'hidden'
  }, windowId)
}

async function liveWindowCount(app: ElectronApplication): Promise<number> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(b => !b.isDestroyed()).length)
}

async function openProfileWindow(app: ElectronApplication, win: Page, profileId: string): Promise<string> {
  const opened = await win.evaluate(async (id) => (window as AnyApi).electronAPI.app.openNewInstance(id), profileId)
  log(`openNewInstance(${profileId}) → ${JSON.stringify(opened)}`)
  expect(opened.alreadyOpen).toBe(false)
  const windowId = opened.windowIds[0] as string
  await expect.poll(() => windowState(app, windowId), { timeout: 30_000 }).toBe('visible')
  const page = app.windows().find(p => p.url().includes(`windowId=${encodeURIComponent(windowId)}`))
  if (page) await page.waitForLoadState('domcontentloaded')
  return windowId
}

async function openProfilesDialog(win: Page, anyProfileId: string): Promise<void> {
  await win.bringToFront()
  if (!(await card(win, anyProfileId).isVisible())) {
    await win.locator('.sidebar-footer-buttons .settings-btn').nth(0).click()
  }
  await expect(card(win, anyProfileId)).toBeVisible({ timeout: 15_000 })
}

let inst: IsolatedInstance | undefined

test.afterEach(async () => {
  if (inst) await closeIsolated(inst, log)
  inst = undefined
})

test('T0750 hidden profile window comes back on "Open"; a deleted profile leaves no window behind', async () => {
  test.setTimeout(180_000)
  inst = await launchIsolated('t0750-profile-window', log)
  const { app, win } = inst
  await expect(win.locator('.sidebar-footer-buttons .settings-btn').first()).toBeVisible({ timeout: 30_000 })

  // minimize to tray on (the close handler reads settings.json on every close)
  const settingsPath = path.join(inst.userData, 'settings.json')
  const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {}
  fs.writeFileSync(settingsPath, JSON.stringify({ ...settings, minimizeToTray: true }), 'utf8')

  const ids = await win.evaluate(async () => {
    const api = (window as AnyApi).electronAPI
    const b = await api.profile.create('E2E Profile B')
    const c = await api.profile.create('E2E Profile C')
    return { b: b.id as string, c: c.id as string }
  })
  log(`profiles ${JSON.stringify(ids)}`)

  // ── BUG-183 ──
  const bWindow = await openProfileWindow(app, win, ids.b)
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows().find(b => b.webContents.getURL().includes(`windowId=${encodeURIComponent(id)}`))?.close()
  }, bWindow)
  await expect.poll(() => windowState(app, bWindow), { timeout: 15_000 }).toBe('hidden')
  log('profile B window closed → hidden (minimize to tray), still alive')

  await openProfilesDialog(win, ids.b)
  await card(win, ids.b).locator('[data-testid="profile-card-switch"]').click()
  await expect.poll(() => windowState(app, bWindow), { timeout: 15_000 }).toBe('visible')
  const focused = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.webContents.getURL() ?? '')
  log(`after "Open": B visible, focused window url has B id: ${focused.includes(encodeURIComponent(bWindow))}`)
  // the renderer decides the notice right after the IPC answer; give it time to (not) appear
  await win.waitForTimeout(1500)
  await expect(win.locator('.app-notification')).toHaveCount(0)
  const bPage = app.windows().find(p => p.url().includes(`windowId=${encodeURIComponent(bWindow)}`))
  if (bPage) await shot(bPage, 'bug183-window-back')

  // ── BUG-184 ──
  const cWindow = await openProfileWindow(app, win, ids.c)
  const before = await liveWindowCount(app)
  log(`live windows before deleting C: ${before}`)
  await openProfilesDialog(win, ids.c)
  await card(win, ids.c).locator('[data-testid="profile-card-delete"]').click()
  await win.locator('.profile-action-btn.danger').click()
  await expect(card(win, ids.c)).toHaveCount(0, { timeout: 15_000 })
  await expect.poll(() => windowState(app, cWindow), { timeout: 15_000 }).toBe('gone')
  expect(await liveWindowCount(app)).toBe(before - 1)
  expect(await windowState(app, bWindow)).toBe('visible')
  const registry = JSON.parse(fs.readFileSync(path.join(inst.userData, 'windows.json'), 'utf8')) as Array<{ id: string; profileId?: string }>
  expect(registry.some(e => e.profileId === ids.c)).toBe(false)
  log(`after deleting C: window gone, live windows ${before - 1}, no registry entry of C`)
  await shot(win, 'bug184-after-delete')
})
