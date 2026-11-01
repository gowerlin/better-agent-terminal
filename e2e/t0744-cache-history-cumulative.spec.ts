// T0744 / BUG-181: the Claude panel's Cache History against the real embedded CLI (2.1.316), whose
// result `modelUsage` / `total_cost_usd` are session running totals. A local fake Anthropic API
// (fixtures/fake-anthropic-api.ts, T0727) reports known token counts per turn; no login, no tokens,
// no request leaves the machine.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts.
//
//   ① three turns in a new session: each R row shows its own turn's cache read / write
//      (200,000 / 400,000 / 600,000 and 10,000 / 20,000 / 30,000; before T0744 the rows showed the
//      running totals 200,000 / 600,000 / 1,200,000), every R row is `turn`, and the real $ total
//      equals the CLI's running `total_cost_usd` (the status line's session cost)
//   ② relaunch the isolated instance (the tab resumes the session) and send a fourth turn: its R row
//      is `R*` (`includes-prior`, the running total as received), and the real $ total still equals
//      the session cost
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

const log = testLogger('t0744')
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const WS = 'e2e-t0744-ws'
const TAB = 'e2e-t0744-tab'
const MODEL = 'claude-haiku-5-5'
const INHERITED = /^(ANTHROPIC_|CLAUDE)/i
const READ = (n: number) => 200_000 * n
const WRITE = (n: number) => 10_000 * n

const turn = (n: number): Scenario => ({ step }) => (step === 0
  ? { text: [`cum-${n} `, 'done'], usage: { input_tokens: 10, cache_read_input_tokens: READ(n), cache_creation_input_tokens: WRITE(n), output_tokens: 7 } }
  : null)
const SCENARIOS: Record<string, Scenario> = { cum1: turn(1), cum2: turn(2), cum3: turn(3), cum4: turn(4) }

async function withoutInheritedClaudeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (INHERITED.test(k) && v !== undefined) { saved[k] = v; delete process.env[k] }
  try {
    return await fn()
  } finally {
    Object.assign(process.env, saved)
  }
}

const activePanel = (win: Page): Locator => win.locator('.workspace-container.active .terminal-wrapper.active .claude-agent-panel')

async function sendAndWait(win: Page, n: number): Promise<void> {
  const panel = activePanel(win)
  const input = panel.locator('textarea.claude-input')
  await input.click()
  await input.fill(`[[T0727:cum${n}]] turn ${n}`)
  await input.press('Enter')
  await expect.poll(async () => (await panel.textContent()) ?? '', { timeout: 90_000 }).toContain(`cum-${n} done`)
  await expect(panel.locator('.claude-cursor')).toHaveCount(0, { timeout: 30_000 })
}

async function sessionCost(win: Page): Promise<number> {
  const meta = await win.evaluate((sid) => (window as AnyApi).electronAPI.claude.getSessionMeta(sid), TAB) as { totalCost?: number } | null
  return meta?.totalCost ?? 0
}

interface HistoryView {
  results: Array<{ label: string; basis: string | null; turnRead: number; turnWrite: number; real: string }>
  calls: number
  total: { est: string; real: string }
}

/** Opens Cache History from the status line, reads it, closes it. */
async function readHistory(win: Page): Promise<HistoryView> {
  const panel = activePanel(win)
  await panel.locator('.claude-statusline-item', { hasText: /^cache:/ }).click()
  const modal = win.locator('.claude-plan-modal', { hasText: 'Cache Efficiency History' })
  await expect(modal).toBeVisible({ timeout: 10_000 })
  const view = await modal.evaluate((el) => {
    const num = (s: string | null | undefined) => Number((s ?? '').replace(/[^0-9]/g, '') || '0')
    const rows = [...el.querySelectorAll('.claude-cache-history-row')]
    const results = rows.filter(r => r.getAttribute('data-row-kind') === 'result').map(r => {
      const c = [...r.children].map(x => x.textContent ?? '')
      return { label: c[0], basis: r.getAttribute('data-usage-basis'), turnRead: num(c[5]), turnWrite: num(c[6]), real: c[12] }
    })
    const t = [...(el.querySelector('.claude-cache-history-total')?.children ?? [])].map(x => x.textContent ?? '')
    return { results, calls: rows.length - results.length, total: { est: t[1] ?? '', real: t[2] ?? '' } }
  })
  await modal.getByRole('button', { name: /close|關閉/i }).last().click()
  await expect(modal).toHaveCount(0)
  return view
}

test.skip(process.platform !== 'win32', 'embedded claude.exe: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)

test('Cache History: R rows are each turn\'s share of the CLI running totals; real $ total = session cost (no token)', async () => {
  test.setTimeout(420_000)
  const startedAt = Date.now()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0744-'))
  const home = path.join(tmp, 'home')
  for (const dir of [['AppData', 'Roaming'], ['AppData', 'Local'], ['Documents']]) fs.mkdirSync(path.join(home, ...dir), { recursive: true })
  // not under the user profile: the CLI loads every ancestor's `.claude/CLAUDE.md` (see the T0727 spec)
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0744-'))
  const folder = path.join(root, 'ws')
  fs.mkdirSync(folder, { recursive: true })

  const fake = await startFakeAnthropicApi(SCENARIOS)
  const proxy = await startBlockingProxy()
  const env = {
    ANTHROPIC_BASE_URL: fake.baseUrl,
    ANTHROPIC_API_KEY: 't0744-fake-key',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    USERPROFILE: home,
    HOME: home,
    HTTPS_PROXY: proxy.url,
    HTTP_PROXY: proxy.url,
    NO_PROXY: '127.0.0.1,localhost',
  }
  log(`fake Anthropic API ${fake.baseUrl}; workspace ${folder}`)

  let inst: IsolatedInstance | undefined
  try {
    // ════════ launch 1 ════════
    inst = await withoutInheritedClaudeEnv(() => launchIsolated('t0744', log, { env }))
    const runtimeId = inst.runtimeId
    let win = inst.win
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0744', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TAB, workspaceId: WS, type: 'terminal', agentPreset: 'claude-code', title: 'T0744 Cache', cwd: folder, model: MODEL }],
      activeTerminalId: TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    // the status line's `cache:` item (Cache History entry) is hidden by default
    await win.evaluate(async () => {
      const api = (window as AnyApi).electronAPI
      const raw = await api.settings.load()
      const s = raw ? JSON.parse(raw) : {}
      s.statuslineItems = [{ id: 'cacheEff', visible: true, align: 'left' }, { id: 'cost', visible: true, align: 'left' }]
      await api.settings.save(JSON.stringify(s))
    })
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(activePanel(win)).toBeVisible({ timeout: 45_000 })

    // ── ① three turns in a new session ──
    const costs: number[] = []
    for (const n of [1, 2, 3]) {
      await sendAndWait(win, n)
      await expect.poll(() => sessionCost(win), { timeout: 15_000 }).toBeGreaterThan(costs.at(-1) ?? 0)
      costs.push(await sessionCost(win))
    }
    log(`① session cost (CLI running total_cost_usd) after each turn: ${costs.join(' → ')}`)
    const h1 = await readHistory(win)
    log(`① R rows: ${JSON.stringify(h1.results)}; per-call rows ${h1.calls}; total ${JSON.stringify(h1.total)}`)
    expect(h1.results.map(r => r.label)).toEqual(['R', 'R', 'R'])
    expect(h1.results.map(r => r.basis)).toEqual(['turn', 'turn', 'turn'])
    expect(h1.results.map(r => r.turnRead)).toEqual([READ(1), READ(2), READ(3)])
    expect(h1.results.map(r => r.turnWrite)).toEqual([WRITE(1), WRITE(2), WRITE(3)])
    expect(h1.total.real).toBe(`$${costs[2].toFixed(4)}`)
    // the pre-T0744 panel added the running totals up (1 + 3 + 6 units here), well above the session cost (6)
    expect(costs[0] + costs[1] + costs[2]).toBeGreaterThan(costs[2] * 1.5)

    // ════════ launch 2: same runtime, the tab resumes the session ════════
    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined
    inst = await withoutInheritedClaudeEnv(() => launchIsolated('t0744', log, { env, runtimeId }))
    win = inst.win
    await expect(activePanel(win)).toBeVisible({ timeout: 45_000 })
    await expect.poll(async () => (await activePanel(win).textContent()) ?? '', { timeout: 60_000 }).toContain('cum-3 done')

    // ── ② the first result after the resume is R* ──
    await sendAndWait(win, 4)
    await expect.poll(() => sessionCost(win), { timeout: 15_000 }).toBeGreaterThan(0)
    const cost4 = await sessionCost(win)
    const h2 = await readHistory(win)
    log(`② session cost ${cost4} (before the relaunch ${costs[2]}); R rows: ${JSON.stringify(h2.results)}; total ${JSON.stringify(h2.total)}`)
    expect(h2.results).toHaveLength(1)
    expect(h2.results[0].label).toBe('R*')
    expect(h2.results[0].basis).toBe('includes-prior')
    expect(h2.total.real).toBe(`$${cost4.toFixed(4)}`)
    // record whether the CLI carried the running totals over the resume (SDK docs: "when it has them")
    const carried = h2.results[0].turnRead === READ(1) + READ(2) + READ(3) + READ(4)
    log(`② running totals carried over the resume: ${carried} (R* turn c.read ${h2.results[0].turnRead}; this turn alone ${READ(4)})`)
    expect([READ(4), READ(1) + READ(2) + READ(3) + READ(4)]).toContain(h2.results[0].turnRead)
  } finally {
    if (inst) await closeIsolated(inst, log)
    log(`model requests: ${fake.requests.length} (${fake.requests.filter(r => r.scenario).map(r => r.scenario).join(', ')}); proxy attempts ${JSON.stringify(proxy.attempts)}`)
    await fake.close()
    await proxy.close()
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    log(`T0744 spec took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  }
  expect(proxy.attempts).toEqual([])
})
