// T0567 — Esc closes a Dialog through the shared ModalOverlay mechanism (topmost dialog only).
//
//   - Settings: Esc closes it
//   - Profiles with the SSH setup wizard open: Esc closes neither the wizard nor Profiles (the
//     wizard is not unmounted = not cancelled / rolled back); after the wizard's own [X], Esc
//     closes Profiles
//
// The SSH wizard's first step only lists `~/.ssh/config` aliases and waits for input, so opening
// and closing it has no side effects.
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`), NOT the
// installed BAT, through the shared isolation fixture (T0399).

import { test, expect } from '@playwright/test'
import en from '../src/locales/en.json'
import zhTW from '../src/locales/zh-TW.json'
import zhCN from '../src/locales/zh-CN.json'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

const log = testLogger('t0567-dialog-esc')

// The isolated instance follows the OS language.
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const oneOf = (values: string[]) => new RegExp(`^(${[...new Set(values)].map(escapeRe).join('|')})$`)
const LOCALES = [en, zhTW, zhCN]
const ADD_MORE = oneOf(LOCALES.map(l => l.profiles.addMore))
const ADD_SSH = new RegExp([...new Set(LOCALES.map(l => l.profiles.addSshProfile))].map(escapeRe).join('|'))

test('Esc closes Settings; with a setup wizard open Esc closes neither the wizard nor Profiles', async () => {
  test.setTimeout(120_000)
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0567-dialog-esc', log)
    const { win } = inst
    const footer = win.locator('.sidebar-footer-buttons')
    await expect(footer).toBeVisible({ timeout: 30_000 })

    // Settings: Esc = [X]
    await footer.locator('.settings-btn').nth(1).click()
    await expect(win.locator('.settings-panel').first()).toBeVisible({ timeout: 10_000 })
    await win.keyboard.press('Escape')
    await expect(win.locator('.settings-overlay')).toHaveCount(0)
    log('settings: Esc closed it')

    // Profiles + SSH wizard
    await footer.locator('.settings-btn').nth(0).click()
    const profiles = win.locator('.settings-panel.profile-panel')
    await expect(profiles).toBeVisible({ timeout: 10_000 })
    await win.getByRole('button', { name: ADD_MORE }).click()
    await win.locator('.thumbnail-add-menu-item').filter({ hasText: ADD_SSH }).click()
    const wizard = win.locator('.settings-panel').filter({ has: win.getByRole('heading', { name: 'Add SSH Profile' }) })
    await expect(wizard).toBeVisible({ timeout: 10_000 })
    await win.waitForTimeout(500)

    await win.keyboard.press('Escape')
    await win.waitForTimeout(400)
    // Esc again with nothing focused inside the wizard.
    await win.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await win.keyboard.press('Escape')
    await win.waitForTimeout(400)
    await expect(wizard).toBeVisible()
    await expect(profiles).toBeVisible()
    await win.screenshot({ path: test.info().outputPath('wizard-after-esc.png') })
    log('wizard: Esc kept the wizard and Profiles open')

    await wizard.locator('.settings-header .settings-close').click()
    await expect(wizard).toHaveCount(0)
    await expect(profiles).toBeVisible()
    await win.keyboard.press('Escape')
    await expect(win.locator('.settings-overlay')).toHaveCount(0)
    log('profiles: after the wizard [X], Esc closed Profiles')
  } finally {
    if (inst) await closeIsolated(inst, log)
  }
})
