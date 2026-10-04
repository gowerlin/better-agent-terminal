// T0453 (BUG-113) — a detached workspace window loads its parent window's workspaces.
//
// Runs against the source build (`dist-electron/`, produced by `npx vite build`),
// NOT the installed BAT, through the shared isolation fixture (T0399).
//
// Flow: seed the main window's registry entry with two workspaces (Beta has one
// terminal) → reload → detach Beta → the detached window shows Beta (not
// "Workspace not found") and its terminal answers input → a save from the
// detached window does not touch the parent entry → reattach closes the window
// and Beta is back in the main window's sidebar.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// The renderer bridge is untyped from the test's point of view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0453-detached')

const WS_ALPHA = 'e2e-t0453-ws-alpha'
const WS_BETA = 'e2e-t0453-ws-beta'
const TERM_BETA = 'e2e-t0453-term-beta'
const NAME_ALPHA = 'T0453-Alpha'
const NAME_BETA = 'T0453-Beta'

interface SavedEntry {
  workspaces: { id: string; name: string }[]
  terminals: { id: string; workspaceId: string }[]
}

async function loadEntry(page: Page): Promise<SavedEntry | null> {
  const raw = await page.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? JSON.parse(raw) as SavedEntry : null
}

test('detached workspace window loads the parent entry, never writes it, and reattaches', async () => {
  let inst: IsolatedInstance | undefined
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 't0453-'))
  try {
    inst = await launchIsolated('t0453-detached', log)
    const { app, win } = inst

    // The main window's registry entry exists once initProfile has run.
    await expect.poll(async () => (await loadEntry(win)) !== null, { timeout: 30_000 }).toBe(true)

    const seed = {
      workspaces: [
        { id: WS_ALPHA, name: NAME_ALPHA, folderPath: folder, createdAt: Date.now() },
        { id: WS_BETA, name: NAME_BETA, folderPath: folder, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_ALPHA,
      activeGroup: null,
      terminals: [{ id: TERM_BETA, workspaceId: WS_BETA, type: 'terminal', title: 'Beta terminal' }],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const sidebarBeta = win.locator('.workspace-item', { hasText: NAME_BETA })
    await expect(sidebarBeta).toBeVisible({ timeout: 30_000 })
    log('main window shows both seeded workspaces')

    // Detach Beta.
    const detachedPromise = app.waitForEvent('window', { timeout: 30_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_BETA)).toBe(true)
    const detached = await detachedPromise
    await detached.waitForLoadState('domcontentloaded')
    expect(detached.url()).toContain(`detached=${WS_BETA}`)
    await expect(sidebarBeta).toHaveCount(0, { timeout: 10_000 })
    log('main window hides Beta after detach')

    // Current-state check (BUG-113): the detached window must not show "Workspace not found".
    const view = detached.locator('.workspace-container.active')
    // app.workspaceNotFound in en / zh-CN / zh-TW (the isolated runtime starts in the OS language).
    const notFound = detached.locator('.empty-state h2', { hasText: /Workspace not found|找不到工作[区區]/ })
    await expect(view.or(notFound)).toBeVisible({ timeout: 30_000 }).catch(() => { /* reported below */ })
    await detached.screenshot({ path: test.info().outputPath('detached-window.png') })
    const bodyText = (await detached.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim()
    log(`detached window state: view=${await view.count()} empty-state=${await notFound.count()} text=${JSON.stringify(bodyText.slice(0, 200))}`)
    await expect(view).toBeVisible()
    await expect(notFound).toHaveCount(0)
    log('detached window renders the Beta workspace view')

    // The detached window's own load returns the parent entry (read-only).
    const detachedView = await loadEntry(detached)
    expect(detachedView?.workspaces.map(w => w.id)).toEqual([WS_ALPHA, WS_BETA])

    // Its terminal answers input: `MARK""ER` only becomes MARKER when the shell runs it.
    const output = await detached.evaluate(async (termId) => {
      const api = (window as AnyApi).electronAPI
      return new Promise<string>((resolve) => {
        let buf = ''
        // eslint-disable-next-line no-control-regex
        const clean = () => buf.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
        const finish = (result: string) => { clearInterval(retry); clearTimeout(deadline); off(); resolve(result) }
        const off = api.pty.onOutput((id: string, data: string) => {
          if (id !== termId) return
          buf += data
          if (clean().includes('T0453_MARKER_OK')) finish(clean())
        })
        // The PTY may still be starting: resend until the shell answers.
        const send = () => api.pty.write(termId, 'echo T0453_MARK""ER_OK\r')
        const retry = setInterval(send, 3_000)
        const deadline = setTimeout(() => finish(`TIMEOUT: ${clean().slice(-400)}`), 25_000)
        send()
      })
    }, TERM_BETA)
    expect(output).toContain('T0453_MARKER_OK')
    log('detached window terminal ran a command')

    // A save from the detached window never touches the parent entry.
    const before = await loadEntry(win)
    const wipe = JSON.stringify({ workspaces: [], activeWorkspaceId: null, activeGroup: null, terminals: [], activeTerminalId: null })
    expect(await detached.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), wipe)).toBe(true)
    const after = await loadEntry(win)
    expect(after?.workspaces.map(w => w.id)).toEqual([WS_ALPHA, WS_BETA])
    expect(after?.workspaces).toEqual(before?.workspaces)
    expect(after?.terminals.some(t => t.id === TERM_BETA && t.workspaceId === WS_BETA)).toBe(true)
    log('detached workspace:save is a no-op on the parent entry')

    // Reattach: the detached window closes and Beta returns to the main sidebar.
    const closed = detached.waitForEvent('close', { timeout: 15_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.reattach(id), WS_BETA)).toBe(true)
    await closed
    await expect(sidebarBeta).toBeVisible({ timeout: 10_000 })
    const final = await loadEntry(win)
    expect(final?.workspaces.map(w => w.id)).toEqual([WS_ALPHA, WS_BETA])
    log('reattach closed the detached window and Beta is back in the main window')
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(folder, { recursive: true, force: true })
  }
})
