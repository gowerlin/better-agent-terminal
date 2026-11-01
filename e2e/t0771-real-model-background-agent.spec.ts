// T0771 (v0.7.3-pre.4 automated acceptance, D215): the Claude Agent panel's background sub-agent
// handling (T0759 / BUG-190, T0769 / BUG-192) against the REAL Anthropic API with the user's existing
// claude login. The fake-API side is e2e/v072-pre6-claude-panel.spec.ts ⑦b / ⑦c.
//
// 🔴 SPENDS TOKENS. Skipped unless BAT_E2E_REAL_MODEL=1, so a plain `npm run test:e2e` never runs it.
//   BAT_E2E_REAL_MODEL=1 npx playwright test e2e/t0771-real-model-background-agent.spec.ts
//   (BAT_E2E_EXECUTABLE=<installed BetterAgentTerminal.exe> runs it against an installed build)
// Model: claude-haiku-5-5 for every turn; the isolated instance also gets CLAUDE_CODE_SUBAGENT_MODEL=
// claude-haiku-5-5 so the sub-agents use it too. Never Opus / Fable / Sonnet: a forbidden model in the
// CLI's modelUsage stops the run before the next turn. Budget: ≤ 12 model turns (every `claude:result`
// counts, the CLI's own follow-up turns included) and US$0.60 (MAX_COST_USD). `total_cost_usd` is the
// session's running total (T0739 F1): the spend is its largest value, never a sum.
//
// Isolation (as v072-real-model-claude-panel): its own runtime / userData / remote port (fixtures/
// electron-isolation.ts), inherited BAT_* / CT_* / ANTHROPIC_* / CLAUDE* dropped, the real HOME kept for
// the login. The spec never opens, copies or prints a credential file or token and never dumps the env.
// The workspace lives under %ProgramData%\bat-e2e-t0771-* and is removed afterwards; so are the CLI's
// session folders in ~/.claude/projects whose name contains `bat-e2e-t0771` — nothing else is touched.
//
// Scenarios (model behaviour is recorded; the BAT side is asserted when the model did use a background
// Agent — a model that does not is retried once, then recorded, not failed):
//   ③ (BUG-190) a background Agent that waits ~45 s, then reads notes.txt and summarises it; the main
//      turn replies first → while the sub-agent runs the active-task bar has 1 item; afterwards 0 and
//      the card says `[completed] …`
//   ④ (BUG-192) while ③'s sub-agent runs (main turn already ended) send "what is 1+1" → answered while
//      the sub-agent keeps running (bar still 1, no `Agent terminated unexpectedly`, no 「已中斷」
//      prefix), or the queued note 「等背景子代理結束後送出」 shows (fallback, also a pass): records which
//   ⑤ (budget permitting) another background Agent (~90 s wait), stopped from the bar → bar 0, card
//      `[stopped …`
//
// Windows only (embedded claude.exe).

import { test, expect, type Page, type Locator } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { E2E_EXECUTABLE, REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0771')
const EMBEDDED_CLAUDE = E2E_EXECUTABLE
  ? path.join(path.dirname(E2E_EXECUTABLE), 'resources', 'app.asar.unpacked', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
  : path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const RUN_TAG = 't0771'
const WS = 'e2e-t0771-ws'
const TAB = 'e2e-t0771-haiku'
const MODEL = 'claude-haiku-5-5'
const MAX_TURNS = 12
const MAX_COST_USD = 0.6
const TURN_TIMEOUT_MS = 180_000
const INHERITED = /^(ANTHROPIC_|CLAUDE)/i
const FORBIDDEN_MODEL = /opus|fable|sonnet/i
const INTERRUPTED_PREFIX = '使用者先前的訊息（已中斷）'
const NOTES = 'The T0771 notes file says the harbour lighthouse is painted green and blinks every 7 seconds.\n'

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
const agentCards = (win: Page, panel: Locator): Locator => panel.locator('.tl-item', { has: win.locator('.claude-tool-name', { hasText: /^Agent$/ }) })

/** Renderer-side recorders on the panel's own IPC events (no prompt text, no secrets). */
async function installRecorders(win: Page): Promise<void> {
  await win.evaluate(() => {
    const w = window as AnyApi
    const rec = { results: [] as AnyApi[], errors: [] as string[], tools: [] as AnyApi[], permissions: 0 }
    w.__t0771 = rec
    const api = w.electronAPI.claude
    api.onResult((sid: string, r: AnyApi) => rec.results.push({ sid, subtype: r?.subtype, totalCost: r?.totalCost ?? null, t: Date.now() }))
    api.onError((sid: string, e: string) => rec.errors.push(`${sid}: ${String(e).slice(0, 200)}`))
    api.onToolUse((sid: string, tc: AnyApi) => rec.tools.push({
      sid, name: tc?.toolName, parent: tc?.parentToolUseId ?? null, bg: tc?.input?.run_in_background === true,
      model: typeof tc?.input?.model === 'string' ? tc.input.model : null,
      detail: String(tc?.input?.description ?? tc?.input?.command ?? tc?.input?.file_path ?? '').slice(0, 80), t: Date.now(),
    }))
    api.onPermissionRequest(() => { rec.permissions++ })
  })
}

const recorder = (win: Page): Promise<AnyApi> => win.evaluate(() => (window as AnyApi).__t0771)

/** `[Claude result]` lines of this runtime's debug logs (usage numbers only, no prompt text). */
function resultLogLines(userData: string): string[] {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => f.endsWith('.log')).sort()
    .flatMap(f => fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/))
    .filter(l => l.includes('[Claude result] usage='))
    .map(l => l.replace(/^.*?\[Claude result\] /, ''))
}

function claudeProjectDirs(): string[] {
  const dir = path.join(os.homedir(), '.claude', 'projects')
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => n.toLowerCase().includes(`bat-e2e-${RUN_TAG}`)) : []
}

function safeJson(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s) as Record<string, unknown> } catch { return null }
}

const bgPrompt = (label: string, description: string, pingCount: number, task: string): string =>
  `${label}: Use the Agent tool exactly once with subagent_type "general-purpose", model "haiku", run_in_background true, ` +
  `description "${description}", and this prompt for the agent: "First run this exact Bash command and wait for it to finish: ` +
  `ping -n ${pingCount} 127.0.0.1 > /dev/null — then ${task}" ` +
  'Right after launching the agent, reply with the single word "launched" and end your turn. Do not wait for the agent and do not use any other tool.'

test.skip(process.env.BAT_E2E_REAL_MODEL !== '1', 'real-model acceptance spends tokens: set BAT_E2E_REAL_MODEL=1 to run')
test.skip(process.platform !== 'win32', 'embedded claude.exe: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)

test('Claude panel background sub-agent against the real model (Haiku 5.5): bar while running (BUG-190), send while it runs (BUG-192), stop from the bar', async () => {
  test.setTimeout(1_500_000)
  const startedAt = Date.now()
  const results: Record<string, string> = {}
  let costSum = 0
  let stopped = ''
  const forbiddenSeen: string[] = []
  expect(FORBIDDEN_MODEL.test(MODEL)).toBe(false)
  expect(claudeProjectDirs()).toEqual([])

  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', `bat-e2e-${RUN_TAG}-`))
  const folder = path.join(root, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const notesPath = path.join(folder, 'notes.txt')
  fs.writeFileSync(notesPath, NOTES)
  log(`workspace ${folder}; executable ${E2E_EXECUTABLE || '(source build)'}`)

  let inst: IsolatedInstance | undefined
  let win: Page
  let panel: Locator
  let logLines: string[] = []

  /** Budget gate before anything that makes the model work. */
  const canSpend = async (what: string): Promise<boolean> => {
    if (stopped) return false
    const rec = await recorder(win)
    await updateCost()
    if (forbiddenSeen.length) { stopped = `forbidden model ${forbiddenSeen.join(', ')} seen before ${what}`; return false }
    if (rec.results.length >= MAX_TURNS) { stopped = `turn budget ${MAX_TURNS} reached before ${what}`; return false }
    if (costSum > MAX_COST_USD) { stopped = `cost US$${costSum.toFixed(4)} > ${MAX_COST_USD} before ${what}`; return false }
    return true
  }
  const updateCost = async (): Promise<void> => {
    const rec = await recorder(win)
    for (const r of rec.results) if (typeof r.totalCost === 'number') costSum = Math.max(costSum, r.totalCost)
    for (const line of resultLogLines(inst!.userData)) {
      for (const m of Object.keys(safeJson(/modelUsage=(.*)$/.exec(line)?.[1] ?? '') ?? {})) {
        if (FORBIDDEN_MODEL.test(m) && !forbiddenSeen.includes(m)) { forbiddenSeen.push(m); log(`⚠ forbidden model in modelUsage: ${m}`) }
      }
    }
  }
  const send = async (text: string): Promise<void> => {
    const input = panel.locator('textarea.claude-input')
    await input.click()
    await input.fill(text)
    await input.press('Enter')
  }
  const waitResults = async (n: number, timeout = TURN_TIMEOUT_MS): Promise<boolean> =>
    expect.poll(async () => (await recorder(win)).results.length, { timeout, intervals: [1_000] }).toBeGreaterThanOrEqual(n).then(() => true, () => false)
  /** Waits until no new result for `quietMs` (the CLI's own follow-up turns), at most `maxMs`. */
  const settle = async (quietMs = 15_000, maxMs = 90_000): Promise<void> => {
    const t0 = Date.now()
    let last = (await recorder(win)).results.length
    let lastChange = Date.now()
    while (Date.now() - t0 < maxMs) {
      await win.waitForTimeout(2_000)
      const n = (await recorder(win)).results.length
      if (n !== last) { last = n; lastChange = Date.now() }
      const streaming = await panel.locator('.claude-cursor').count()
      if (!streaming && Date.now() - lastChange >= quietMs) return
    }
  }
  /** Allows any permission card that shows up (the panel's default mode should not need one). */
  let watchPermissions = true
  const permissionWatcher = (async () => {
    while (watchPermissions) {
      try {
        const card = win.locator('.claude-permission-card').first()
        if (await card.isVisible().catch(() => false)) {
          const title = ((await card.locator('.claude-permission-title').textContent().catch(() => '')) ?? '').trim()
          log(`permission card shown (${JSON.stringify(title)}) → allow`)
          await card.locator('.claude-permission-option').first().click().catch(() => undefined)
        }
      } catch { /* window gone */ }
      await new Promise(r => setTimeout(r, 1_000))
    }
  })

  /** Sends a background-Agent prompt (retried once when the model does not launch one) and waits for the main turn. */
  const launchBackground = async (label: string, prompt: (attempt: number) => string): Promise<{ launched: boolean; card: Locator | null; mainEndedWhileRunning: boolean; tools: string[] }> => {
    const tools: string[] = []
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (!(await canSpend(`${label} attempt ${attempt}`))) break
      const before = await recorder(win)
      const cardsBefore = await agentCards(win, panel).count()
      await send(prompt(attempt))
      const ended = await waitResults(before.results.length + 1)
      const after = await recorder(win)
      const these = after.tools.slice(before.tools.length)
      tools.push(...these.map((x: AnyApi) => `${x.parent ? 'sub:' : ''}${x.name}${x.bg ? '[bg]' : ''}${x.model ? `{${x.model}}` : ''}${x.detail ? `(${x.detail})` : ''}`))
      const agentUse = these.find((x: AnyApi) => x.name === 'Agent' && !x.parent)
      const cards = await agentCards(win, panel).count()
      const bar = await panel.locator('.claude-active-task-item').count()
      log(`${label} attempt ${attempt}: main turn ended=${ended}; Agent tool_use=${!!agentUse} run_in_background=${agentUse?.bg ?? '-'}; Agent cards ${cardsBefore}→${cards}; bar items now ${bar}; tools ${JSON.stringify(tools)}`)
      if (agentUse && cards > cardsBefore) {
        const card = agentCards(win, panel).last()
        const running = /dot-running/.test((await card.locator('.tl-dot').getAttribute('class')) ?? '')
        return { launched: true, card, mainEndedWhileRunning: ended && running && bar >= 1, tools }
      }
      await settle(5_000, 30_000)
    }
    return { launched: false, card: null, mainEndedWhileRunning: false, tools }
  }

  try {
    inst = await withoutInheritedClaudeEnv(() => launchIsolated(RUN_TAG, log, { env: { CLAUDE_CODE_SUBAGENT_MODEL: MODEL } }))
    win = inst.win
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0771', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TAB, workspaceId: WS, type: 'terminal', agentPreset: 'claude-code', title: 'T0771 Haiku', cwd: folder, model: MODEL }],
      activeTerminalId: TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    panel = activePanel(win)
    await expect(panel).toBeVisible({ timeout: 45_000 })
    await installRecorders(win)
    void permissionWatcher()

    // ── ③ BUG-190: background Agent stays in the bar while it runs ──
    const r3 = await launchBackground('③', (attempt) => bgPrompt(`T0771-3${attempt > 1 ? ' (retry: you MUST call the Agent tool with run_in_background true)' : ''}`,
      'T0771 bg summary', 45, `read the file ${notesPath} and reply with a one-sentence summary of it.`))
    let bar3 = -1
    let barLabel3 = ''
    let barTags3: string[] = []
    if (r3.launched && r3.card) {
      await win.waitForTimeout(2_000) // T0739 F2: before the fix the bar emptied ~1.5 s after the launch
      bar3 = await panel.locator('.claude-active-task-item').count()
      barLabel3 = (await panel.locator('.claude-active-task-item .claude-active-task-label').first().textContent().catch(() => '')) ?? ''
      barTags3 = await panel.locator('.claude-active-task-item .claude-task-tag').allTextContents()
      await panel.screenshot({ path: test.info().outputPath('t0771-bg-running.png') }).catch(() => undefined)
      log(`③ 2 s after the main turn: bar items ${bar3} label ${JSON.stringify(barLabel3)} tags ${JSON.stringify(barTags3)}; card dot ${await r3.card.locator('.tl-dot').getAttribute('class')}; main turn ended while the sub-agent ran: ${r3.mainEndedWhileRunning}`)

      // ── ④ BUG-192: send while the background sub-agent runs ──
      if (bar3 === 1 && await canSpend('④')) {
        const before = await recorder(win)
        const sentAt = Date.now()
        await send('T0771-4: Quick question while the agent runs: what is 1+1? Reply with just the number.')
        const queuedNote = panel.locator('.claude-queued-note')
        let path4 = 'none'
        await expect.poll(async () => {
          if ((await recorder(win)).results.length > before.results.length) return (path4 = 'injected')
          if (await queuedNote.count()) return (path4 = 'queued')
          return 'none'
        }, { timeout: 120_000, intervals: [500] }).not.toBe('none').catch(() => undefined)
        const ms4 = Date.now() - sentAt
        const barAfter4 = await panel.locator('.claude-active-task-item').count()
        const cardDot4 = (await r3.card.locator('.tl-dot').getAttribute('class')) ?? ''
        const text4 = (await panel.textContent()) ?? ''
        // textContent runs the message times into the answer ("…05:18" + "2" + "上午05:18"): drop them first
        const answer4 = (text4.split('Reply with just the number.').at(-1) ?? '').replace(/(上午|下午)?\d{1,2}:\d{2}(\s?[AP]M)?/g, ' ')
        const terminated4 = text4.includes('Agent terminated unexpectedly')
        const prefix4 = text4.includes(INTERRUPTED_PREFIX)
        await panel.screenshot({ path: test.info().outputPath('t0771-send-during-bg.png') }).catch(() => undefined)
        log(`④ path=${path4} after ${ms4} ms; bar items ${barAfter4}; card dot ${cardDot4}; answer has "2": ${/(^|\D)2(\D|$)/.test(answer4)}; "Agent terminated unexpectedly": ${terminated4}; 「已中斷」 prefix: ${prefix4}; queued notes ${await queuedNote.count()}`)
        if (path4 === 'injected') {
          expect(terminated4).toBe(false)
          expect(prefix4).toBe(false)
          const stillRunning = barAfter4 === 1 && /dot-running/.test(cardDot4)
          results['④'] = `${stillRunning ? 'PASS' : 'RECORDED'} — injected: answered in ${ms4} ms (answer has "2": ${/(^|\D)2(\D|$)/.test(answer4)}) while the sub-agent ${stillRunning ? 'kept running (bar 1, card running)' : `was no longer running (bar ${barAfter4}, card ${cardDot4})`}; no "Agent terminated unexpectedly", no 「已中斷」 prefix`
        } else if (path4 === 'queued') {
          expect(terminated4).toBe(false)
          results['④'] = `PASS (queued fallback) — 「等背景子代理結束後送出」 note after ${ms4} ms; bar ${barAfter4}; card ${cardDot4}; no "Agent terminated unexpectedly"`
        } else {
          results['④'] = `FAIL — no answer and no queued note within 120 s; bar ${barAfter4}; card ${cardDot4}; terminated ${terminated4}`
        }
      } else if (!stopped) {
        results['④'] = `NOT RUN — the bar did not have 1 item after ③ (${bar3}): nothing to send into`
      }

      // ③ continued: the sub-agent ends → bar 0, card [completed]
      const cleared = await expect.poll(async () => panel.locator('.claude-active-task-item').count(), { timeout: 240_000, intervals: [2_000] }).toBe(0).then(() => true, () => false)
      const endLabel3 = (await r3.card.locator('.claude-task-end-label').textContent({ timeout: 15_000 }).catch(() => '')) ?? ''
      const dot3 = (await r3.card.locator('.tl-dot').getAttribute('class')) ?? ''
      await panel.screenshot({ path: test.info().outputPath('t0771-bg-after.png') }).catch(() => undefined)
      const mentions = ((await panel.textContent()) ?? '').toLowerCase().includes('lighthouse')
      log(`③ after the sub-agent: bar cleared ${cleared}; card dot ${dot3}; end label ${JSON.stringify(endLabel3.slice(0, 160))}; panel mentions the notes content: ${mentions}`)
      await settle()
      const ok3 = bar3 === 1 && cleared && endLabel3.startsWith('[completed]')
      results['③'] = `${ok3 ? 'PASS' : 'FAIL'} — model launched a background Agent (tools ${JSON.stringify(r3.tools)}); main turn ended first: ${r3.mainEndedWhileRunning}; while running bar ${bar3} item(s) ${JSON.stringify(barLabel3)} tags ${JSON.stringify(barTags3)}; after: bar cleared ${cleared}, card ${dot3.replace('tl-dot ', '')}, label ${JSON.stringify(endLabel3.slice(0, 120))}`
      expect(bar3).toBe(1)
      expect(cleared).toBe(true)
      expect(endLabel3).toMatch(/^\[completed\]/)
    } else if (!stopped) {
      results['③'] = `RECORDED — the model did not launch a background Agent in 2 attempts (tools ${JSON.stringify(r3.tools)}); not a BAT defect`
      results['④'] = 'NOT RUN — no background sub-agent to send into'
    }

    // ── ⑤ stop a background Agent from the bar ──
    if (await canSpend('⑤')) {
      const r5 = await launchBackground('⑤', (attempt) => bgPrompt(`T0771-5${attempt > 1 ? ' (retry: you MUST call the Agent tool with run_in_background true)' : ''}`,
        'T0771 bg stop', 90, 'reply with the single word PONG.'))
      if (r5.launched && r5.card) {
        await win.waitForTimeout(2_000)
        const bar5 = await panel.locator('.claude-active-task-item').count()
        let cleared5 = false
        let label5 = ''
        if (bar5 >= 1) {
          await panel.locator('.claude-active-task-item .claude-task-stop-btn').first().click()
          cleared5 = await expect.poll(async () => panel.locator('.claude-active-task-item').count(), { timeout: 60_000, intervals: [1_000] }).toBe(0).then(() => true, () => false)
          label5 = (await r5.card.locator('.claude-task-end-label').textContent({ timeout: 15_000 }).catch(() => '')) ?? ''
        }
        await panel.screenshot({ path: test.info().outputPath('t0771-bg-stopped.png') }).catch(() => undefined)
        log(`⑤ bar before stop ${bar5}; after stop cleared ${cleared5}; card label ${JSON.stringify(label5.slice(0, 160))}`)
        await settle()
        const ok5 = bar5 === 1 && cleared5 && label5.startsWith('[stopped')
        results['⑤'] = `${ok5 ? 'PASS' : 'FAIL'} — tools ${JSON.stringify(r5.tools)}; bar ${bar5} → stop button → cleared ${cleared5}; card ${JSON.stringify(label5.slice(0, 120))}`
        expect(ok5).toBe(true)
      } else if (!stopped) {
        results['⑤'] = `RECORDED — the model did not launch a background Agent in 2 attempts (tools ${JSON.stringify(r5.tools)}); not a BAT defect`
      }
    }
    if (stopped && !results['⑤']) results['⑤'] = `NOT RUN — ${stopped}`
  } finally {
    watchPermissions = false
    if (inst) {
      try {
        await updateCost()
        const rec = await recorder(win!)
        log(`results ${rec.results.length} (${rec.results.map((r: AnyApi) => `${r.subtype}:${r.totalCost}`).join(', ')}); errors ${JSON.stringify(rec.errors)}; permission requests ${rec.permissions}`)
        log(`all tool_use: ${JSON.stringify(rec.tools.map((x: AnyApi) => `${x.parent ? 'sub:' : ''}${x.name}${x.bg ? '[bg]' : ''}${x.model ? `{${x.model}}` : ''}`))}`)
      } catch { /* window gone */ }
      logLines = resultLogLines(inst.userData)
      await closeIsolated(inst, log)
    }
    if (stopped) log(`⛔ stopped: ${stopped}`)
    for (const [k, v] of Object.entries(results)) log(`${k} ${v}`)
    for (const [i, line] of logLines.entries()) log(`result log ${i + 1}: ${line}`)
    log(`model turns (claude:result): ${logLines.length}; session cost (largest total_cost_usd) US$${costSum.toFixed(6)}; forbidden models: ${JSON.stringify(forbiddenSeen)}`)
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    const sessions = claudeProjectDirs()
    for (const name of sessions) fs.rmSync(path.join(os.homedir(), '.claude', 'projects', name), { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    log(`removed ${sessions.length} ~/.claude/projects folder(s) matching bat-e2e-${RUN_TAG}; left: ${claudeProjectDirs().length}`)
    log(`T0771 spec took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  }
  expect(forbiddenSeen).toEqual([])
  expect(costSum).toBeLessThanOrEqual(MAX_COST_USD)
})
