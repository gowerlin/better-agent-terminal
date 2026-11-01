// T0775: the real OS focus for e2e specs that branch on "the window has the focus".
//
// Playwright emulates focus on every page: document.hasFocus() stays true and no blur event fires,
// whatever the OS does (T0770). A spec that asserts "looked at → no faded ⚠️" therefore never measured
// the real focus. `disableFocusEmulation` turns the emulation off for one page (CDP
// `Emulation.setFocusEmulationEnabled` false, as e2e/t0770-unfocused-wait-missed.spec.ts); after that the
// page's document.hasFocus() and its focus / blur events follow the OS window focus.
//
// Evidence: `focusEvidence` = the renderer's document.hasFocus() + Electron's
// BrowserWindow.getFocusedWindow() (`main` / `detached` / `focus-sink` / `none`).
//
// `BAT_E2E_FORCE_UNFOCUSED=1` (counter-check): `takeFocus` gives the focus to a second BrowserWindow of the
// isolated instance (`focus-sink`) instead of the window under test, so the spec's "unfocused" branch runs
// and its "focused" assertions are shown to depend on the real focus.

import { expect, type ElectronApplication, type Page } from '@playwright/test'

export const FOCUS_SINK_TITLE = 'bat-e2e-focus-sink'

/** `BAT_E2E_FORCE_UNFOCUSED=1`: takeFocus moves the focus away instead (counter-check). */
export const FORCE_UNFOCUSED = process.env.BAT_E2E_FORCE_UNFOCUSED === '1'

export type WindowKind = 'main' | 'detached'

export interface FocusEvidence {
  /** the renderer's document.hasFocus() (real once the emulation is off) */
  hasFocus: boolean
  /** BrowserWindow.getFocusedWindow(): which window of the isolated instance has the OS focus */
  focusedWindow: 'main' | 'detached' | 'focus-sink' | 'none'
}

/** Turns Playwright's focus emulation off for `page` (its renderer then sees the real OS focus). */
export async function disableFocusEmulation(app: ElectronApplication, page: Page): Promise<void> {
  const cdp = await app.context().newCDPSession(page)
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false })
}

export async function focusEvidence(app: ElectronApplication, page: Page): Promise<FocusEvidence> {
  const focusedWindow = await app.evaluate(({ BrowserWindow }, sink) => {
    const w = BrowserWindow.getFocusedWindow()
    if (!w) return 'none' as const
    if (w.getTitle() === sink) return 'focus-sink' as const
    return w.webContents.getURL().includes('detached=') ? 'detached' as const : 'main' as const
  }, FOCUS_SINK_TITLE)
  return { hasFocus: await page.evaluate(() => document.hasFocus()), focusedWindow }
}

/**
 * Shows and focuses the main / detached window of `page` (only when it is not focused already: a focus()
 * on a focused window can blur / refocus the page, and a TUI that reports focus then sees ESC [ O / ESC [ I);
 * true when its document then has the focus.
 */
export async function focusWindow(app: ElectronApplication, page: Page, kind: WindowKind): Promise<boolean> {
  await app.evaluate(({ BrowserWindow }, { sink, kind }) => {
    const target = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.getTitle() !== sink
      && w.webContents.getURL().includes('detached=') === (kind === 'detached'))
    if (!target || target.isFocused()) return
    target.show()
    target.focus()
  }, { sink: FOCUS_SINK_TITLE, kind })
  const ok = await expect.poll(() => page.evaluate(() => document.hasFocus()), { timeout: 5_000 }).toBe(true).then(() => true, () => false)
  // the App's viewing state listens to the window focus event; it re-reads document.hasFocus() (real)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  return ok
}

/** A second BrowserWindow of the isolated instance takes the OS focus; true when `page` lost it. */
export async function openFocusSink(app: ElectronApplication, page: Page): Promise<boolean> {
  await app.evaluate(({ BrowserWindow }, sink) => {
    let w = BrowserWindow.getAllWindows().find(x => !x.isDestroyed() && x.getTitle() === sink)
    if (!w) {
      w = new BrowserWindow({ width: 320, height: 200, title: sink, show: true, webPreferences: { sandbox: true } })
      w.on('page-title-updated', e => e.preventDefault())
      void w.loadURL(`data:text/html,<title>${sink}</title>focus sink`)
    }
    w.show()
    w.focus()
  }, FOCUS_SINK_TITLE)
  return expect.poll(() => page.evaluate(() => document.hasFocus()), { timeout: 5_000 }).toBe(false).then(() => true, () => false)
}

export async function closeFocusSink(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }, sink) => {
    for (const w of BrowserWindow.getAllWindows()) if (w.getTitle() === sink && !w.isDestroyed()) w.destroy()
  }, FOCUS_SINK_TITLE).catch(() => undefined)
}

/**
 * Gives the window of `page` the OS focus (`BAT_E2E_FORCE_UNFOCUSED=1` or `opts.forceUnfocused`: the
 * focus-sink takes it instead),
 * then returns the real focus evidence of `page`, logged as `[focus] <label>: …`.
 */
export async function takeFocus(app: ElectronApplication, page: Page, kind: WindowKind, label: string, log: (msg: string) => void,
  opts: { forceUnfocused?: boolean } = {}): Promise<FocusEvidence> {
  if (opts.forceUnfocused ?? FORCE_UNFOCUSED) {
    const lost = await openFocusSink(app, page)
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    log(`[focus] ${label}: BAT_E2E_FORCE_UNFOCUSED=1 → focus-sink opened (page lost the focus: ${lost})`)
  } else {
    const ok = await focusWindow(app, page, kind)
    log(`[focus] ${label}: focus ${kind} window → document.hasFocus() ${ok}`)
  }
  const evidence = await focusEvidence(app, page)
  log(`[focus] ${label}: ${JSON.stringify(evidence)}`)
  return evidence
}
