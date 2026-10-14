// T0531 / BUG-134: after a workspace's last terminal is closed, its terminal tab shows an empty
// state — not another workspace's terminal.
//
// Root cause: `.workspace-tab-panel.active { visibility: visible }` overrode the inherited
// visibility: hidden of a hidden workspace, so every visited workspace kept painting its active
// tab under the active one. A workspace with no terminals left its terminal tab transparent and
// the last-painted hidden workspace showed through; clicks hit the active (empty) workspace on
// top, so the picture could not be used.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Plain shell
// terminals only — nothing here starts an LLM.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0531')
const WS_A = 'e2e-t0531-ws-a'
const WS_B = 'e2e-t0531-ws-b'
const NAME_A = 'T0531-A'
const NAME_B = 'T0531-B'
const TERM_A = 'e2e-t0531-term-a'
const TERM_B = 'e2e-t0531-term-b'
const TITLE_A = 'T0531 shell A'
const TITLE_B = 'T0531 shell B'

/** Computed visibility of every tab panel inside a hidden workspace (all must be 'hidden'). */
function hiddenWorkspacePanels(win: Page): Promise<string[]> {
  return win.evaluate(() => Array.from(document.querySelectorAll('.workspace-container.hidden .workspace-tab-panel.active'))
    .map(el => getComputedStyle(el).visibility))
}

test('closing the last terminal of a workspace shows an empty state, not another workspace', async () => {
  test.setTimeout(150_000)
  // Terminals are only restored for workspaces with a folder (toTerminalInstance). With both
  // seeded terminals restored, no default (agent) terminal is created.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0531-'))
  const folderA = path.join(tmp, 'a')
  const folderB = path.join(tmp, 'b')
  fs.mkdirSync(folderA, { recursive: true })
  fs.mkdirSync(folderB, { recursive: true })
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0531', log)
    const { win } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_A, name: NAME_A, folderPath: folderA, createdAt: Date.now() },
        { id: WS_B, name: NAME_B, folderPath: folderB, createdAt: Date.now() },
      ],
      // B first, so it is mounted (and stays mounted, hidden) when A becomes active.
      activeWorkspaceId: WS_B,
      activeGroup: null,
      terminals: [
        { id: TERM_A, workspaceId: WS_A, type: 'terminal', title: TITLE_A, cwd: folderA },
        { id: TERM_B, workspaceId: WS_B, type: 'terminal', title: TITLE_B, cwd: folderB },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')

    const panelA = win.locator('.main-panel', { hasText: TITLE_A })
    const panelB = win.locator('.main-panel', { hasText: TITLE_B })
    const activeView = win.locator('.workspace-container.active')
    const emptyState = activeView.getByTestId('terminals-empty-state')

    await expect(panelB).toBeVisible({ timeout: 30_000 })
    log('B is active and shows its terminal')

    await win.locator('.workspace-item', { hasText: NAME_A }).click()
    await expect(panelA).toBeVisible({ timeout: 30_000 })
    await expect(panelB).toBeHidden()
    log('A is active and shows its terminal; B is hidden')

    // Close A's only terminal (an idle shell closes without a confirmation).
    await activeView.locator('.main-panel', { hasText: TITLE_A }).getByRole('button', { name: '×', exact: true }).click()
    await expect(panelA).toHaveCount(0, { timeout: 10_000 })
    await win.screenshot({ path: test.info().outputPath('a-after-closing-last-terminal.png') })
    log(`after close: hidden panels visibility=${JSON.stringify(await hiddenWorkspacePanels(win))}`)

    // B's terminal must not paint under A (the bug: computed visibility was 'visible').
    await expect(panelB).toBeHidden()
    expect(await hiddenWorkspacePanels(win)).not.toContain('visible')
    await expect(emptyState).toBeVisible()
    log('A shows the empty state; B stays hidden')

    // Switch away and back: still the empty state.
    await win.locator('.workspace-item', { hasText: NAME_B }).click()
    await expect(panelB).toBeVisible({ timeout: 10_000 })
    await win.locator('.workspace-item', { hasText: NAME_A }).click()
    await expect(emptyState).toBeVisible({ timeout: 10_000 })
    await expect(panelB).toBeHidden()
    expect(await hiddenWorkspacePanels(win)).not.toContain('visible')
    log('switching B → A shows the empty state again')

    // Adding a terminal from the empty state works and leaves B alone.
    await emptyState.getByRole('button').click()
    await expect(activeView.locator('.terminal-wrapper.active .main-panel')).toBeVisible({ timeout: 15_000 })
    await expect(emptyState).toHaveCount(0)
    await expect(panelB).toBeHidden()
    await win.locator('.workspace-item', { hasText: NAME_B }).click()
    await expect(panelB).toBeVisible({ timeout: 10_000 })
    log('new terminal in A shows; B still shows its own terminal')
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
