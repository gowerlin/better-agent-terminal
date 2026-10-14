// T0530 (BUG-133) — "open settings" in a detached workspace window.
//
// The detached window renders no SettingsPanel (Settings are global; every renderer saves its
// whole copy). Its "open settings" asks main, which brings the parent main window to the front
// (restoring it when minimized) and opens Settings there. The UI entry (GitHub panel's
// "set custom path", shown only when gh is missing on a GitHub-remote workspace) calls exactly
// `workspace.openSettingsInParent()`; App.tsx wiring is guarded by
// src/__tests__/detached-open-settings.test.ts.
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`),
// NOT the installed BAT, through the shared isolation fixture (T0399).

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0530-detached-open-settings')

const WS_ALPHA = 'e2e-t0530-ws-alpha'
const WS_BETA = 'e2e-t0530-ws-beta'
const NAME_ALPHA = 'T0530-Alpha'
const NAME_BETA = 'T0530-Beta'

test('open settings in a detached window opens Settings in the parent main window', async () => {
  test.setTimeout(180_000)
  let inst: IsolatedInstance | undefined
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 't0530-'))
  try {
    inst = await launchIsolated('t0530-open-settings', log)
    const { app, win } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_ALPHA, name: NAME_ALPHA, folderPath: folder, createdAt: Date.now() },
        { id: WS_BETA, name: NAME_BETA, folderPath: folder, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_ALPHA,
      activeGroup: null,
      terminals: [],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-item', { hasText: NAME_BETA })).toBeVisible({ timeout: 30_000 })

    // A main window is not a detached sender: main refuses, nothing opens.
    expect(await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.openSettingsInParent()))
      .toEqual({ ok: false, reason: 'not-detached' })
    await expect(win.locator('.settings-panel')).toHaveCount(0)

    const detachedPromise = app.waitForEvent('window', { timeout: 30_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_BETA)).toBe(true)
    const detached = await detachedPromise
    await detached.waitForLoadState('domcontentloaded')
    await expect(detached.locator('.workspace-container.active')).toBeVisible({ timeout: 30_000 })
    await expect(win.locator('.workspace-item', { hasText: NAME_BETA })).toBeHidden({ timeout: 10_000 })

    // Minimize the parent: the request has to bring it back.
    await app.evaluate(({ BrowserWindow }) => {
      const parent = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && !w.webContents.getURL().includes('detached='))
      parent?.minimize()
    })
    await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && !w.webContents.getURL().includes('detached='))?.isMinimized() ?? null,
    ), { timeout: 10_000 }).toBe(true)

    const result = await detached.evaluate(async () => (window as AnyApi).electronAPI.workspace.openSettingsInParent())
    log(`openSettingsInParent → ${JSON.stringify(result)}`)
    expect(result).toMatchObject({ ok: true, viaParent: true })

    await expect(win.locator('.settings-panel')).toBeVisible({ timeout: 10_000 })
    await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && !w.webContents.getURL().includes('detached='))?.isMinimized() ?? null,
    ), { timeout: 10_000 }).toBe(false)
    // The detached window shows neither its own Settings nor a failure notice.
    await expect(detached.locator('.settings-panel')).toHaveCount(0)
    await expect(detached.locator('.app-notification')).toHaveCount(0)
    await win.screenshot({ path: test.info().outputPath('parent-settings-open.png') })
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(folder, { recursive: true, force: true })
  }
})
