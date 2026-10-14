// T0532: a workspace opened for the first time creates its default terminal asynchronously (the
// shell lookup). Until it exists the terminal tab shows an opaque placeholder — not the T0531 empty
// state with its "add terminal" button (a click there opened an extra terminal), and not a
// transparent pane (BUG-134: another workspace would show through). Closing the last terminal
// still shows the empty state right away (T0531).
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Plain shell
// terminals only: createDefaultAgentTerminal is off, nothing here starts an LLM.

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0532')
const WS_B = 'e2e-t0532-ws-b'
const WS_NEW = 'e2e-t0532-ws-new'
const NAME_B = 'T0532-B'
const NAME_NEW = 'T0532-New'
const TERM_B = 'e2e-t0532-term-b'
const TITLE_B = 'T0532 shell B'

interface Seen { empty: number; pending: number; pendingBackgrounds: string[] }

test('a new workspace shows no empty state while its default terminal is created', async () => {
  test.setTimeout(150_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0532-'))
  const folderB = path.join(tmp, 'b')
  const folderNew = path.join(tmp, 'new')
  fs.mkdirSync(folderB, { recursive: true })
  fs.mkdirSync(folderNew, { recursive: true })
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0532', log)
    const { win } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    await win.evaluate(async (patch) => {
      const api = (window as AnyApi).electronAPI
      const raw = await api.settings.load()
      await api.settings.save(JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), ...patch }))
    }, { createDefaultAgentTerminal: false, defaultTerminalCount: 1 })
    const seed = {
      workspaces: [
        { id: WS_B, name: NAME_B, folderPath: folderB, createdAt: Date.now() },
        // never opened, no terminals: the default terminal is created on first activation
        { id: WS_NEW, name: NAME_NEW, folderPath: folderNew, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_B,
      activeGroup: null,
      terminals: [{ id: TERM_B, workspaceId: WS_B, type: 'terminal', title: TITLE_B, cwd: folderB }],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')

    const panelB = win.locator('.main-panel', { hasText: TITLE_B })
    const activeView = win.locator('.workspace-container.active')
    const emptyState = activeView.getByTestId('terminals-empty-state')
    await expect(panelB).toBeVisible({ timeout: 30_000 })
    log('B is active and shows its terminal')

    // Record every empty state / placeholder that gets attached, however briefly.
    await win.evaluate(() => {
      const seen = { empty: 0, pending: 0, pendingBackgrounds: [] as string[] }
      ;(window as unknown as { __t0532: Seen }).__t0532 = seen
      const scan = (node: Node) => {
        if (!(node instanceof Element)) return
        const els = [node, ...Array.from(node.querySelectorAll('[data-testid]'))]
        for (const el of els) {
          const id = el.getAttribute('data-testid')
          if (id === 'terminals-empty-state') seen.empty++
          if (id === 'terminals-pending-state') {
            seen.pending++
            seen.pendingBackgrounds.push(getComputedStyle(el).backgroundColor)
          }
        }
      }
      new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(scan)))
        .observe(document.body, { childList: true, subtree: true })
    })

    await win.locator('.workspace-item', { hasText: NAME_NEW }).click()
    await expect(activeView.locator('.terminal-wrapper.active .main-panel')).toBeVisible({ timeout: 30_000 })
    await expect(panelB).toBeHidden()
    const seen = await win.evaluate(() => (window as unknown as { __t0532: Seen }).__t0532)
    log(`opening the new workspace: ${JSON.stringify(seen)}`)
    expect(seen.empty).toBe(0)
    expect(seen.pending).toBeGreaterThan(0)
    for (const bg of seen.pendingBackgrounds) expect(bg).not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/)
    await expect(emptyState).toHaveCount(0)
    await expect(activeView.getByTestId('terminals-pending-state')).toHaveCount(0)
    await expect(activeView.locator('.terminal-wrapper')).toHaveCount(1)
    log('the default terminal shows; no empty state on the way, exactly one terminal')

    // T0531 unchanged: closing the last terminal shows the empty state right away.
    await activeView.locator('.terminal-wrapper.active .main-panel').getByRole('button', { name: '×', exact: true }).click()
    await expect(emptyState).toBeVisible({ timeout: 10_000 })
    await expect(panelB).toBeHidden()
    log('closing the last terminal shows the empty state')
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
