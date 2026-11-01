// T0742 / BUG-135: after a detached workspace window closes and the main window takes its terminals
// back (`workspace:adopt-detached` → `replaceWorkspaceTerminals`), the focused terminal stays in the
// main window's active workspace (T0532). Before T0532 the fallback focus was the first terminal of
// the whole list, which can belong to the workspace that just came back.
//
// The focus is not on screen, so the test reads it the way a user hits it: a snippet's "paste to
// terminal" button (Snippets panel, right sidebar by default) writes to the focused terminal
// (App `handlePasteToTerminal`), and the receiving PTY's buffer shows the text.
//
// One scenario, two closes of B's detached window (A active both times):
//   1. A keeps its terminal, focused → after the close the paste lands in A's terminal.
//      The pre-T0532 code passes this too: the focused terminal was still there, so no fallback ran.
//   2. A's only terminal is closed first (focus = null, T0531 empty state) → after the close the
//      paste must not land in B's terminal. Pre-T0532 the fallback took `terminals[0]` = B's terminal
//      (B is seeded first in the list), so the paste went to B. A positive control then pastes from
//      B active to show the same snippet does reach B's terminal.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Plain shell
// terminals only — nothing here starts an LLM.

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0742-adopt-focus')
const WS_A = 'e2e-t0742-ws-a'
const WS_B = 'e2e-t0742-ws-b'
const NAME_A = 'T0742-A'
const NAME_B = 'T0742-B'
const TERM_A = 'e2e-t0742-term-a'
const TERM_B = 'e2e-t0742-term-b'
const TITLE_A = 'T0742 shell A'
const TITLE_B = 'T0742 shell B'
const MARK_ONE = 'T0742MARKONE'
const MARK_TWO = 'T0742MARKTWO'
const SNIPPETS_TAB = /^(Snippets|程式碼片段|代码片段)$/

const bufferOf = (win: Page, id: string): Promise<string> =>
  win.evaluate(async (i) => (await (window as AnyApi).electronAPI.pty.getBuffer(i))?.data ?? '', id)

/** Rows joined (ConPTY wraps) and ANSI removed, for matching typed / echoed text. */
const plain = (s: string) => s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*\x07/g, '').replace(/\r?\n/g, '')

async function detachB(app: ElectronApplication, win: Page): Promise<Page> {
  const opened = app.waitForEvent('window', { timeout: 30_000 })
  expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_B)).toBe(true)
  const detached = await opened
  await detached.waitForLoadState('domcontentloaded')
  await expect(detached.locator('.workspace-container.active .main-panel-title')).toContainText(TITLE_B, { timeout: 30_000 })
  await expect(win.locator('.workspace-item', { hasText: NAME_B })).toBeHidden({ timeout: 10_000 })
  return detached
}

/** BrowserWindow.close() on the detached window (the title-bar X), then wait for the main window to show B again. */
async function closeDetached(app: ElectronApplication, win: Page, detached: Page): Promise<void> {
  const closed = detached.waitForEvent('close', { timeout: 15_000 })
  expect(await app.evaluate(({ BrowserWindow }) => {
    const target = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.getURL().includes('detached='))
    if (!target) return false
    target.close()
    return true
  })).toBe(true)
  await closed
  await expect(win.locator('.workspace-item', { hasText: NAME_B })).toBeVisible({ timeout: 15_000 })
  // The adopt runs after `workspace:reattached`; give its store update a moment to land.
  await win.waitForTimeout(1_000)
}

/**
 * The Snippets panel (docked in the right sidebar by default: App `handlePasteToTerminal`, which
 * writes to `focusedTerminalId`, else the active workspace's first terminal) → the snippet's
 * "paste to terminal" button.
 */
async function pasteSnippet(win: Page, title: string): Promise<void> {
  const sidebar = win.locator('.right-sidebar-wrapper')
  if (!(await sidebar.isVisible())) {
    await win.locator('.right-sidebar-collapsed-btn').first().click()
    await expect(sidebar).toBeVisible({ timeout: 10_000 })
  }
  await sidebar.locator('.right-sidebar-tab', { hasText: SNIPPETS_TAB }).click()
  const item = sidebar.locator('.snippet-sidebar-item', { hasText: title })
  await expect(item).toBeVisible({ timeout: 15_000 })
  await item.locator('.snippet-action-btn').first().click()
}

test('after a detached workspace comes back, the focused terminal stays in the active workspace', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0742-focus-'))
  const folderA = path.join(tmp, 'a')
  const folderB = path.join(tmp, 'b')
  fs.mkdirSync(folderA, { recursive: true })
  fs.mkdirSync(folderB, { recursive: true })
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0742-focus', log)
    const { app, win } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_A, name: NAME_A, folderPath: folderA, createdAt: Date.now() },
        { id: WS_B, name: NAME_B, folderPath: folderB, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_A,
      activeGroup: null,
      // B's terminal first: the pre-T0532 fallback (`terminals[0]`) is then B's terminal.
      terminals: [
        { id: TERM_B, workspaceId: WS_B, type: 'terminal', title: TITLE_B, cwd: folderB },
        { id: TERM_A, workspaceId: WS_A, type: 'terminal', title: TITLE_A, cwd: folderA },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    for (const [title, content] of [['T0742 snip one', `echo ${MARK_ONE}`], ['T0742 snip two', `echo ${MARK_TWO}`]]) {
      const created = await win.evaluate(async ([t, c]) => (window as AnyApi).electronAPI.snippet.create({ title: t, content: c, action: 'terminal' }), [title, content] as const)
      expect(typeof created?.id, `snippet ${title}`).toBe('number')
    }
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    // The first launch's default terminal is still alive in the Terminal Server, so the reload may
    // ask the Recovery question; keep the sessions (the seeded tabs get their shells either way).
    const recovery = win.locator('.recovery-prompt-dialog')
    if (await recovery.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false)) {
      await recovery.locator('.recovery-prompt-actions .btn-primary').click()
      await expect(win.locator('.recovery-prompt-overlay')).toHaveCount(0, { timeout: 10_000 })
      log('answered the Recovery prompt after the reload (keep)')
    }

    const activeView = win.locator('.workspace-container.active')
    await expect(activeView.locator('.main-panel', { hasText: TITLE_A })).toBeVisible({ timeout: 30_000 })
    // B's shell starts when B's window shows it; A's when A is shown.
    await expect.poll(async () => (await win.evaluate(([i]) => (window as AnyApi).electronAPI.pty.write(i, ''), [TERM_A] as const))?.ok ?? null, { timeout: 20_000 }).toBe(true)
    log('A is active with its terminal')

    // ── 1. A keeps a focused terminal (the work order's literal scenario) ──
    let detached = await detachB(app, win)
    await expect.poll(async () => (await win.evaluate(([i]) => (window as AnyApi).electronAPI.pty.write(i, ''), [TERM_B] as const))?.ok ?? null, { timeout: 20_000 }).toBe(true)
    await activeView.locator('.main-panel', { hasText: TITLE_A }).click()
    log('B detached; A focused in the main window')
    await closeDetached(app, win, detached)
    await expect(win.locator('.workspace-item.active')).toContainText(NAME_A)
    await expect(activeView.locator('.main-panel', { hasText: TITLE_A })).toBeVisible()
    await pasteSnippet(win, 'T0742 snip one')
    await expect.poll(async () => plain(await bufferOf(win, TERM_A)), { timeout: 15_000 }).toContain(MARK_ONE)
    expect(plain(await bufferOf(win, TERM_B))).not.toContain(MARK_ONE)
    log(`1: after the close A is active; the snippet pasted into A's terminal (${MARK_ONE} in ${TERM_A}, not in ${TERM_B})`)

    // ── 2. A has no terminal left when B comes back (the discriminating half) ──
    detached = await detachB(app, win)
    await activeView.locator('.main-panel', { hasText: TITLE_A }).getByRole('button', { name: '×', exact: true }).click()
    await expect(activeView.getByTestId('terminals-empty-state')).toBeVisible({ timeout: 15_000 })
    log('B detached again; A\'s only terminal closed → A shows the empty state (focus = null)')
    await closeDetached(app, win, detached)
    await expect(win.locator('.workspace-item.active')).toContainText(NAME_A)
    await expect(activeView.getByTestId('terminals-empty-state')).toBeVisible()
    const bBefore = plain(await bufferOf(win, TERM_B))
    expect(bBefore).not.toContain(MARK_TWO)
    await pasteSnippet(win, 'T0742 snip two')
    await win.waitForTimeout(3_000)
    const bAfter = plain(await bufferOf(win, TERM_B))
    log(`2: after the close A is still active and empty; B's buffer has ${MARK_TWO}: ${bAfter.includes(MARK_TWO)}`)
    expect(bAfter, 'the paste from A must not reach B\'s terminal (pre-T0532: focus fell back to terminals[0] = B)').not.toContain(MARK_TWO)

    // Positive control: the same paste from B's own Snippets tab does reach B's terminal.
    await win.locator('.workspace-item', { hasText: NAME_B }).click()
    await expect(activeView.locator('.main-panel', { hasText: TITLE_B })).toBeVisible({ timeout: 15_000 })
    await pasteSnippet(win, 'T0742 snip two')
    await expect.poll(async () => plain(await bufferOf(win, TERM_B)), { timeout: 15_000 }).toContain(MARK_TWO)
    log("control: pasting with B active reaches B's terminal")
    await win.screenshot({ path: test.info().outputPath('b-after-control-paste.png') })
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
