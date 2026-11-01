// T0738 / BUG-127: the Control Tower panel docked in the right sidebar is one instance whose
// workspace folder changes when the user switches workspaces. Switching must not raise "new work
// order" / "completed" / "started" toasts for work orders that already exist (T0521); a work order
// that really appears still raises one, and a workspace's toasts go away when the user leaves it.
//
// Two seeded workspaces, each with `_ct-workorders/` holding six work orders in mixed states. Every
// `.ct-toast` that is ever added to the page is recorded by a MutationObserver, so a toast that shows
// and fades between two polls still counts. Before T0521 each switch raised toasts for every order.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Plain files only:
// no agent, no LLM, no clipboard.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0738-ct')
const WS_A = 'e2e-t0738-ct-a'
const WS_B = 'e2e-t0738-ct-b'
const STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'PARTIAL', 'DONE'] as const
const QUIET_MS = 5_000

const workOrder = (id: string, status: string) =>
  `---\nschema_version: 1\nschema_kind: workorder\nid: ${id}\ntitle: "${id} e2e order"\nstatus: ${status}\n---\n\n# ${id}\n`

function seedOrders(folder: string, base: number): string[] {
  const dir = path.join(folder, '_ct-workorders')
  fs.mkdirSync(dir, { recursive: true })
  return STATUSES.map((status, i) => {
    const id = `T${base + i}`
    fs.writeFileSync(path.join(dir, `${id}-e2e-order.md`), workOrder(id, status))
    return id
  })
}

const rowOf = (win: Page, name: string) => win.locator('.workspace-item', { hasText: name })
const panel = (win: Page) => win.locator('.right-sidebar-wrapper')
const toastsSeen = (win: Page): Promise<string[]> => win.evaluate(() => [...((window as AnyApi).__t0738Toasts as string[])])

async function switchTo(win: Page, name: string): Promise<void> {
  await rowOf(win, name).locator('.workspace-folder').click()
  await expect(rowOf(win, name)).toHaveClass(/\bactive\b/)
}

test('switching workspaces under the right-docked Tower panel raises no toast for existing work orders', async () => {
  test.setTimeout(180_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0738-ct-'))
  const folderA = path.join(tmp, 'a')
  const folderB = path.join(tmp, 'b')
  for (const dir of [folderA, folderB]) fs.mkdirSync(dir, { recursive: true })
  const idsA = seedOrders(folderA, 7301)
  const idsB = seedOrders(folderB, 7401)
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0738-ct', log)
    const { win } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    await win.evaluate(async (patch) => {
      const a = (window as AnyApi).electronAPI
      const raw = await a.settings.load()
      await a.settings.save(JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), ...patch }))
    }, { createDefaultAgentTerminal: false, defaultTerminalCount: 1, language: 'en' })
    const seed = {
      workspaces: [
        { id: WS_A, name: WS_A, folderPath: folderA, createdAt: Date.now() },
        { id: WS_B, name: WS_B, folderPath: folderB, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_A,
      activeGroup: null,
      terminals: [
        { id: 'e2e-t0738-ct-a-shell', workspaceId: WS_A, type: 'terminal', title: 'Shell A', cwd: folderA },
        { id: 'e2e-t0738-ct-b-shell', workspaceId: WS_B, type: 'terminal', title: 'Shell B', cwd: folderB },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    // the Control Tower panel docked in the right sidebar, as the BUG-127 reporter had it
    await win.evaluate(() => {
      const raw = localStorage.getItem('better-terminal-docking-config')
      const config = raw ? JSON.parse(raw) : {}
      localStorage.setItem('better-terminal-docking-config', JSON.stringify({ ...config, 'control-tower': 'right' }))
      localStorage.setItem('bat-right-panel-tab', 'control-tower')
    })
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(rowOf(win, WS_A)).toHaveClass(/\bactive\b/, { timeout: 30_000 })
    const collapsed = win.locator('.right-sidebar-collapsed-btn[title="Tower"]')
    if (await collapsed.isVisible().catch(() => false)) await collapsed.click()
    await expect(panel(win)).toBeVisible({ timeout: 15_000 })
    await expect(panel(win)).toContainText(idsA[0], { timeout: 30_000 })
    log(`right sidebar shows workspace A's orders (${idsA.join(', ')})`)

    // from now on, record every toast that is added anywhere in the page
    await win.evaluate(() => {
      const w = window as AnyApi
      w.__t0738Toasts = []
      const seen = new WeakSet<Element>()
      const scan = () => {
        for (const el of document.querySelectorAll('.ct-toast')) {
          if (seen.has(el)) continue
          seen.add(el)
          w.__t0738Toasts.push((el.textContent ?? '').trim())
        }
      }
      scan()
      new MutationObserver(scan).observe(document.body, { childList: true, subtree: true })
    })
    await win.waitForTimeout(2_000)
    const atStart = await toastsSeen(win)
    log(`toasts already on screen before switching: ${JSON.stringify(atStart)}`)

    // ── switch A → B → A → B: never a toast for an existing order ──
    for (const [name, ids] of [[WS_B, idsB], [WS_A, idsA], [WS_B, idsB]] as const) {
      const before = (await toastsSeen(win)).length
      await switchTo(win, name)
      await expect(panel(win)).toContainText(ids[0], { timeout: 30_000 })
      await win.waitForTimeout(QUIET_MS)
      const added = (await toastsSeen(win)).slice(before)
      log(`switch to ${name}: panel shows ${ids[0]}…; toasts added within ${QUIET_MS} ms: ${JSON.stringify(added)}`)
      expect(added, `no toast after switching to ${name}`).toEqual([])
    }

    // ── positive control: a work order that really appears in B still raises a toast ──
    const fresh = 'T7499'
    fs.writeFileSync(path.join(folderB, '_ct-workorders', `${fresh}-e2e-order.md`), workOrder(fresh, 'PENDING'))
    await expect.poll(async () => (await toastsSeen(win)).some(t => t.includes('New work order') && t.includes(fresh)),
      { timeout: 30_000 }).toBe(true)
    log(`new ${fresh} in B → toast: ${JSON.stringify((await toastsSeen(win)).filter(t => t.includes(fresh)))}`)
    await expect(win.locator('.ct-toast', { hasText: fresh })).toBeVisible()

    // ── leaving B clears B's toast and raises nothing for A ──
    const beforeLeave = (await toastsSeen(win)).length
    await switchTo(win, WS_A)
    await expect(panel(win)).toContainText(idsA[0], { timeout: 30_000 })
    await expect(win.locator('.ct-toast', { hasText: fresh })).toHaveCount(0, { timeout: 5_000 })
    await win.waitForTimeout(QUIET_MS)
    const afterLeave = (await toastsSeen(win)).slice(beforeLeave)
    log(`switch back to A: toasts added: ${JSON.stringify(afterLeave)}; on screen: ${await win.locator('.ct-toast').count()}`)
    expect(afterLeave).toEqual([])
    await win.screenshot({ path: test.info().outputPath('after-switches.png') })
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
