// T0563 — Dialogs do not close on a click outside them.
//
//   - Settings: a click on the backdrop, and a drag that starts inside the panel and ends on the
//     backdrop, leave it open; its [X] closes it
//   - Profiles: a click on the backdrop leaves it open; its [X] closes it
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`), NOT the
// installed BAT, through the shared isolation fixture (T0399).

import { test, expect, type Locator, type Page } from '@playwright/test'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

const log = testLogger('t0563-dialog-no-outside-close')

/** Clicks the backdrop at its top-left corner, which no dialog covers. */
async function clickBackdrop(overlay: Locator): Promise<void> {
  await overlay.click({ position: { x: 4, y: 4 } })
}

/** Presses inside `from` and releases on the backdrop corner (a text selection dragged out). */
async function dragOut(win: Page, from: Locator): Promise<void> {
  const box = await from.boundingBox()
  if (!box) throw new Error('drag source not visible')
  await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await win.mouse.down()
  await win.mouse.move(40, 40, { steps: 5 })
  await win.mouse.move(4, 4, { steps: 5 })
  await win.mouse.up()
}

test('Settings and Profiles stay open on a backdrop click and close with [X]', async () => {
  test.setTimeout(120_000)
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0563-dialogs', log)
    const { win } = inst
    const footer = win.locator('.sidebar-footer-buttons')
    await expect(footer).toBeVisible({ timeout: 30_000 })

    // Settings
    await footer.locator('.settings-btn').nth(1).click()
    const settings = win.locator('.settings-panel').first()
    await expect(settings).toBeVisible({ timeout: 10_000 })
    await clickBackdrop(win.locator('.settings-overlay').first())
    await win.waitForTimeout(400)
    await expect(settings).toBeVisible()
    await dragOut(win, settings.locator('.settings-header h2'))
    await win.waitForTimeout(400)
    await expect(settings).toBeVisible()
    await win.screenshot({ path: test.info().outputPath('settings-after-backdrop-click.png') })
    await settings.locator('.settings-header .close-btn').click()
    await expect(win.locator('.settings-overlay')).toHaveCount(0)
    log('settings: backdrop click + drag-out kept it open; [X] closed it')

    // Profiles
    await footer.locator('.settings-btn').nth(0).click()
    const profiles = win.locator('.settings-panel.profile-panel')
    await expect(profiles).toBeVisible({ timeout: 10_000 })
    await clickBackdrop(win.locator('.settings-overlay').first())
    await win.waitForTimeout(400)
    await expect(profiles).toBeVisible()
    await win.screenshot({ path: test.info().outputPath('profiles-after-backdrop-click.png') })
    await profiles.locator('.settings-header .settings-close').click()
    await expect(win.locator('.settings-overlay')).toHaveCount(0)
    log('profiles: backdrop click kept it open; [X] closed it')
  } finally {
    if (inst) await closeIsolated(inst, log)
  }
})
