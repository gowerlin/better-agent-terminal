// T0762 (D200 / D203 for the Claude Agent panel): a Claude Agent panel tab that shows a permission
// card waits for the user like a PTY tab — ⚠️ on its thumbnail and on its workspace's row — and the
// ⚠️ clears when the card is answered (allow or deny); a wait that ends while the user is in another
// workspace leaves a faded ⚠️ on the row, and the row's click goes to the tab.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts; the panel runs
// against fixtures/fake-anthropic-api.ts (T0727 base: no login, no tokens, a proxy that refuses
// everything else, a temp home). Workspace names are e2e-….
//
//   0. a warm-up turn, then `default` permission mode (as v072-pre6-claude-panel ⑥)
//   1. Bash tool_use → permission card → thumbnail ⚠️ (permission) + A's row ⚠️ (target = the tab);
//      是 → the card and the thumbnail ⚠️ go; the row ⚠️ goes (window focused) or fades (no focus)
//   2. again, 否 → same
//   3. again, then B made active; the request is answered from outside the panel
//      (`claude.resolvePermission`, as another window would) → A's row ⚠️ fades (missed);
//      the row ⚠️ click → A active, the panel tab selected, the faded ⚠️ goes (window focused)
//
// Windows only (embedded claude.exe).

import { test, expect, type Page, type Locator } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { startBlockingProxy, startFakeAnthropicApi, type Scenario } from './fixtures/fake-anthropic-api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0762')
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const WS_A = 'e2e-t0762-a'
const WS_B = 'e2e-t0762-b'
const TAB = 'e2e-t0762-panel'
const TAB_TITLE = 'T0762 Panel'
const INHERITED = /^(ANTHROPIC_|CLAUDE)/i

const bash = (name: string, folder: string): Scenario => ({ step }) => [
  { tool: { name: 'Bash', input: { command: `mkdir ${folder}`, description: `T0762 permission probe (${name})` } } },
  { text: [`${name} `, 'done'] },
][step] ?? null

const SCENARIOS: Record<string, Scenario> = {
  't0762-warm': ({ step }) => (step === 0 ? { text: ['warm ', 'done'] } : null),
  't0762-allow': bash('allow', 't0762-allow'),
  't0762-deny': bash('deny', 't0762-deny'),
  't0762-missed': bash('missed', 't0762-missed'),
}

async function withoutInheritedClaudeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (INHERITED.test(k) && v !== undefined) { saved[k] = v; delete process.env[k] }
  try {
    return await fn()
  } finally {
    Object.assign(process.env, saved)
  }
}

const panelOf = (win: Page): Locator => win.locator(`.workspace-container .claude-agent-panel`).first()
const rowOf = (win: Page, name: string) => win.locator('.workspace-item', { hasText: name })
const thumbOf = (win: Page) => win.locator('.workspace-container .thumbnail', { hasText: TAB_TITLE }).first()

async function send(panel: Locator, text: string): Promise<void> {
  const input = panel.locator('textarea.claude-input')
  await input.click()
  await input.fill(text)
  await input.press('Enter')
}

async function waitText(panel: Locator, text: string, timeout = 60_000): Promise<void> {
  await expect.poll(async () => (await panel.textContent()) ?? '', { timeout }).toContain(text)
}

test.skip(process.platform !== 'win32', 'embedded claude.exe: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)

test('Claude Agent panel permission card → thumbnail / workspace ⚠️; allow / deny clear it; ended in another workspace → faded', async () => {
  test.setTimeout(300_000)
  const results: Record<string, string> = {}
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0762-'))
  const home = path.join(tmp, 'home')
  for (const dir of [['AppData', 'Roaming'], ['AppData', 'Local'], ['Documents']]) fs.mkdirSync(path.join(home, ...dir), { recursive: true })
  // not under the user profile: the CLI reads every ancestor's .claude/CLAUDE.md (as v072-pre6-claude-panel)
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0762-'))
  const folderA = path.join(root, 'a')
  const folderB = path.join(root, 'b')
  for (const dir of [folderA, folderB]) fs.mkdirSync(dir, { recursive: true })

  const fake = await startFakeAnthropicApi(SCENARIOS)
  const proxy = await startBlockingProxy()
  const env = {
    ANTHROPIC_BASE_URL: fake.baseUrl,
    ANTHROPIC_API_KEY: 't0762-fake-key',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    USERPROFILE: home,
    HOME: home,
    HTTPS_PROXY: proxy.url,
    HTTP_PROXY: proxy.url,
    NO_PROXY: '127.0.0.1,localhost',
  }
  let inst: IsolatedInstance | undefined
  try {
    inst = await withoutInheritedClaudeEnv(() => launchIsolated('t0762', log, { env }))
    const { app, win } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_A, name: WS_A, folderPath: folderA, createdAt: Date.now() },
        { id: WS_B, name: WS_B, folderPath: folderB, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_A,
      activeGroup: null,
      terminals: [
        { id: TAB, workspaceId: WS_A, type: 'terminal', agentPreset: 'claude-code', title: TAB_TITLE, cwd: folderA, model: 'claude-sonnet-4-6' },
        { id: 'e2e-t0762-b-shell', workspaceId: WS_B, type: 'terminal', title: 'Shell B', cwd: folderB },
      ],
      activeTerminalId: TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const panel = panelOf(win)
    await expect(panel).toBeVisible({ timeout: 45_000 })
    // the latest permission request's toolUseId (step 3 answers it from outside the panel)
    await win.evaluate(() => {
      const w = window as AnyApi
      w.__t0762 = { toolUseIds: [] as string[] }
      w.electronAPI.claude.onPermissionRequest((_sid: string, data: { toolUseId: string }) => { w.__t0762.toolUseIds.push(data.toolUseId) })
    })
    const focusWindow = async (): Promise<boolean> => {
      await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus() })
      await win.evaluate(() => window.dispatchEvent(new Event('focus')))
      return win.evaluate(() => document.hasFocus())
    }

    // ── 0. warm-up turn, then `default` mode ──
    await send(panel, '[[T0727:t0762-warm]] hello')
    await waitText(panel, 'warm done')
    const modeSet = await win.evaluate((sid) => (window as AnyApi).electronAPI.claude.setPermissionMode(sid, 'default'), TAB)
    log(`setPermissionMode(default) between turns returned ${JSON.stringify(modeSet)}`)

    const card = panel.locator('.claude-permission-card')
    const thumbBadge = thumbOf(win).locator('.attention-badge')
    const rowBadge = rowOf(win, WS_A).locator('.workspace-waiting-badge')
    await expect(thumbBadge).toHaveCount(0)
    await expect(rowBadge).toHaveCount(0)

    // ── 1 / 2. allow, then deny: ⚠️ while the card is up, gone after ──
    for (const [scenario, option, dir] of [['t0762-allow', 'first', 't0762-allow'], ['t0762-deny', 'deny', 't0762-deny']] as const) {
      await send(panel, `[[T0727:${scenario}]] make a folder`)
      await expect(card).toBeVisible({ timeout: 60_000 })
      await expect(thumbBadge).toHaveAttribute('data-attention', 'blocked', { timeout: 10_000 })
      await expect(thumbBadge).toHaveAttribute('data-blocked-reason', 'permission')
      await expect(thumbBadge).toHaveText('⚠️')
      await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting', { timeout: 10_000 })
      await expect(rowBadge).toHaveAttribute('data-waiting-target', TAB)
      await expect(rowBadge).toHaveAttribute('title', new RegExp(TAB_TITLE))
      await win.screenshot({ path: test.info().outputPath(`${scenario}-waiting.png`) })
      const focused = await focusWindow()
      if (option === 'first') await card.locator('.claude-permission-option').first().click() // 是
      else await card.locator('.claude-permission-option:not(.custom)').last().click() // 否
      await waitText(panel, scenario === 't0762-allow' ? 'allow done' : 'deny done')
      await expect(card).toHaveCount(0)
      await expect(thumbBadge).toHaveCount(0, { timeout: 10_000 })
      expect(fs.existsSync(path.join(folderA, dir))).toBe(scenario === 't0762-allow')
      // answered while looked at → no faded ⚠️; without OS focus the wait counts as unseen (D203 ③)
      if (focused) await expect(rowBadge).toHaveCount(0, { timeout: 10_000 })
      else await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 10_000 })
      const after = await rowBadge.count() === 0 ? 'none' : await rowBadge.getAttribute('data-waiting')
      log(`${scenario}: focused=${focused} → card gone, thumbnail ⚠️ gone, row ⚠️ ${after}`)
      results[scenario] = `PASS — card → thumbnail ⚠️ (permission) + row ⚠️ (target ${TAB}); answered → thumbnail ⚠️ gone, row ⚠️ ${after} (focused=${focused})`
    }

    // ── 3. ends while the user is in workspace B → faded on A's row; its click goes to the tab ──
    const before = await win.evaluate(() => (window as AnyApi).__t0762.toolUseIds.length) as number
    await send(panel, '[[T0727:t0762-missed]] make a folder')
    await expect(card).toBeVisible({ timeout: 60_000 })
    await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting', { timeout: 10_000 })
    await rowOf(win, WS_B).locator('.workspace-folder').click()
    await expect(rowOf(win, WS_B)).toHaveClass(/\bactive\b/)
    await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting')
    const toolUseId = await win.evaluate((n) => (window as AnyApi).__t0762.toolUseIds[n] ?? null, before) as string | null
    expect(toolUseId).toBeTruthy()
    const resolved = await win.evaluate(({ sid, id }) => (window as AnyApi).electronAPI.claude.resolvePermission(sid, id, { behavior: 'deny', message: 'T0762: answered elsewhere' }), { sid: TAB, id: toolUseId })
    log(`resolvePermission from outside the panel → ${JSON.stringify(resolved)}`)
    await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
    await expect(rowBadge).toHaveClass(/\bmissed\b/)
    await win.screenshot({ path: test.info().outputPath('missed.png') })
    const focused = await focusWindow()
    await rowBadge.click()
    await expect(rowOf(win, WS_A)).toHaveClass(/\bactive\b/, { timeout: 10_000 })
    await expect.poll(() => win.evaluate(() => document.querySelector('.workspace-container.active .thumbnail.active .thumbnail-title')?.textContent ?? ''), { timeout: 10_000 }).toContain(TAB_TITLE)
    if (focused) await expect(rowBadge).toHaveCount(0, { timeout: 10_000 })
    else test.info().annotations.push({ type: 'skip-step', description: 'window focus unavailable: "faded ⚠️ clears when looked at" not checked' })
    expect(fs.existsSync(path.join(folderA, 't0762-missed'))).toBe(false)
    results['missed'] = `PASS — B active, answered elsewhere → A's row faded ⚠️; click → A active, panel tab selected${focused ? ', faded ⚠️ cleared' : ' (no focus: clear not checked)'}`
    log(`results:\n${Object.entries(results).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`)
  } finally {
    if (inst) await closeIsolated(inst, log)
    await fake.close()
    await proxy.close()
    fs.rmSync(tmp, { recursive: true, force: true })
    fs.rmSync(root, { recursive: true, force: true })
  }
})
