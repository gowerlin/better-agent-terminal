// T0739 (v0.7.2-pre.5 / pre.6 real-model acceptance, small budget): the Claude Agent panel (SDK 0.3 →
// embedded CLI 2.1.316) against the REAL Anthropic API with the user's existing claude login.
//
// 🔴 SPENDS TOKENS. Skipped unless BAT_E2E_REAL_MODEL=1, so a plain `npm run test:e2e` never runs it.
//   BAT_E2E_REAL_MODEL=1 npx playwright test e2e/v072-real-model-claude-panel.spec.ts
// Models: claude-haiku-5-5 for every turn, one claude-haiku-4-5 turn (⑥, the 4.x control). Never Opus /
// Fable / Sonnet. Budget: ≤ 12 model turns, and the run stops before the next turn once the session's
// `total_cost_usd` (a running total in CLI 2.1.316, side requests included) passes US$0.5 (MAX_COST_USD;
// US$1 until T0746).
//
// T0746 (BUG-181 re-check): before closing each launch the spec opens the tab's Cache History and compares
// every R row with the CLI's running totals from the `[Claude result]` log lines (row = this result − the
// previous one, per model; the first row after the resume is `R*` = the running total itself; real $
// total = the last `total_cost_usd`). Mismatches are collected and asserted at the end, so a mismatch
// in launch 1 does not skip the resume. BAT_E2E_RUN_TAG=t#### names the workspace / session folders
// (default t0739).
//
// Isolation: the source build (`npx vite build` first) in its own runtime (fixtures/electron-isolation.ts:
// own userData, own remote port, inherited BAT_* / CT_* dropped). The real HOME is kept (that is where the
// login lives); the spec never opens, copies or prints any credential file or token, and never dumps the
// env. Inherited ANTHROPIC_* / CLAUDE* variables (this spec may run inside Claude Code) are dropped.
// The workspace lives under %ProgramData%\bat-e2e-t0739-* (an ancestor's .claude/CLAUDE.md would be read
// otherwise) and is removed afterwards; so are the CLI's session folders in ~/.claude/projects whose name
// contains `bat-e2e-t0739` — nothing else there is touched.
//
// Scenarios (observational: model behaviour is recorded, not asserted; the BAT side is asserted):
//   ① a message streams and completes
//   ② `default` permission mode: a Bash `mkdir` → permission card → allow → the folder exists
//   ③ "find the file that contains …" → records whether the cards were Grep / Glob or Bash
//   ④ "3-step todo list, then do it" → records TaskCreate / TaskUpdate use and the panel's checklist
//   ⑤ an Agent tool call with run_in_background → records the Agent card, the active-task bar, its clearing
//   ⑥ switch the tab's model to claude-haiku-4-5 and send one turn (the 4.x todo-tool control)
//   ⑦ close and relaunch the same runtime → the tab resumes, the history is rebuilt, one more turn continues
//
// Windows only (embedded claude.exe).

import { test, expect, type Page, type Locator } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0739')
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const WS = 'e2e-t0739-ws'
const TAB = 'e2e-t0739-haiku'
const MODEL = 'claude-haiku-5-5'
const MODEL_4X = 'claude-haiku-4-5'
const MAX_TURNS = 12
const MAX_COST_USD = 0.5
const TURN_TIMEOUT_MS = 240_000
const RUN_TAG = /^t\d{4}$/.test(process.env.BAT_E2E_RUN_TAG ?? '') ? process.env.BAT_E2E_RUN_TAG! : 't0739'
const NEEDLE = 'T0739-NEEDLE-42'
const INHERITED = /^(ANTHROPIC_|CLAUDE)/i
const FORBIDDEN_MODEL = /opus|fable|sonnet/i

interface TurnRecord {
  label: string
  model: string
  costUSD: number | null
  usage: string
  modelUsage: string
  tools: string[]
  reason: string
  ms: number
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

const activePanel = (win: Page): Locator => win.locator('.workspace-container.active .terminal-wrapper.active .claude-agent-panel')

/** Renderer-side recorders on the panel's own IPC events (lost on reload: install after it). */
async function installRecorders(win: Page): Promise<void> {
  await win.evaluate(() => {
    const w = window as AnyApi
    const rec = { turnEnds: [] as AnyApi[], results: [] as AnyApi[], tools: [] as AnyApi[], suggestions: 0, lastStatus: null as AnyApi, errors: [] as string[] }
    w.__t0739 = rec
    const api = w.electronAPI.claude
    // `claude:turn-end` is codex-only: a Claude panel turn ends with `claude:result` (or `claude:error`).
    api.onResult((sid: string, r: AnyApi) => {
      rec.results.push({ sid, subtype: r?.subtype, totalCost: r?.totalCost ?? null, t: Date.now() })
      rec.turnEnds.push({ sid, reason: r?.subtype === 'success' ? 'completed' : String(r?.subtype), t: Date.now() })
    })
    api.onToolUse((sid: string, tc: AnyApi) => rec.tools.push({
      sid, id: tc?.id, name: tc?.toolName, parent: tc?.parentToolUseId ?? null,
      bg: tc?.input?.run_in_background === true,
      // short, non-secret evidence only: the Bash command / search pattern of this spec's prompts
      detail: String(tc?.input?.command ?? tc?.input?.pattern ?? tc?.input?.subject ?? tc?.input?.status ?? '').slice(0, 80),
      t: Date.now(),
    }))
    api.onPromptSuggestion(() => { rec.suggestions++ })
    api.onStatus((sid: string, meta: AnyApi) => { rec.lastStatus = { sid, model: meta?.model, totalCost: meta?.totalCost, permissionMode: meta?.permissionMode } })
    api.onError((sid: string, e: string) => {
      rec.errors.push(String(e).slice(0, 300))
      rec.turnEnds.push({ sid, reason: 'error', error: String(e).slice(0, 200), t: Date.now() })
    })
  })
}

async function recorder(win: Page): Promise<AnyApi> {
  return win.evaluate(() => (window as AnyApi).__t0739)
}

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

// ── T0746: Cache History vs the CLI running totals ──

type UsageEntry = { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number; costUSD?: number }
type UsageMap = Record<string, UsageEntry>
const TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'] as const

interface HistoryRow {
  label: string; basis: string | null; pct: string; calls: string
  turnRead: number; turnWrite: number; turnTotal: number; output: number; est: string; real: string
  models: Array<{ model: string; cacheRead: number; cacheWrite: number; output: number; est: string }>
}
interface HistoryView { results: HistoryRow[]; calls: number; total: { est: string; real: string } }

/** Opens the tab's Cache History from the status line, reads every row, screenshots it, closes it. */
async function readCacheHistory(win: Page, shot: string): Promise<HistoryView> {
  const panel = activePanel(win)
  await panel.locator('.claude-statusline-item', { hasText: /^cache:/ }).click()
  const modal = win.locator('.claude-plan-modal', { hasText: 'Cache Efficiency History' })
  await expect(modal).toBeVisible({ timeout: 10_000 })
  await modal.screenshot({ path: test.info().outputPath(shot) }).catch(() => undefined)
  const view = await modal.evaluate((el) => {
    const num = (s: string | null | undefined) => Number((s ?? '').replace(/[^0-9]/g, '') || '0')
    const rows = [...el.querySelectorAll('.claude-cache-history-row')]
    const results = rows.filter(r => r.getAttribute('data-row-kind') === 'result').map(r => {
      const c = [...r.children].map(x => x.textContent ?? '')
      const models = [...(r.parentElement?.children ?? [])].slice(1).map(s => {
        const d = [...s.children].map(x => x.textContent ?? '')
        return { model: d[3] ?? '', cacheRead: num(d[5]), cacheWrite: num(d[6]), output: num(d[8]), est: d[11] ?? '' }
      })
      return { label: c[0], basis: r.getAttribute('data-usage-basis'), pct: c[1], calls: c[2], turnRead: num(c[5]), turnWrite: num(c[6]), turnTotal: num(c[7]), output: num(c[8]), est: c[11], real: c[12], models }
    })
    const t = [...(el.querySelector('.claude-cache-history-total')?.children ?? [])].map(x => x.textContent ?? '')
    return { results, calls: rows.length - results.length, total: { est: t[1] ?? '', real: t[2] ?? '' } }
  })
  await modal.getByRole('button', { name: /close|關閉/i }).last().click()
  await expect(modal).toHaveCount(0)
  return view
}

const sameUsage = (a: UsageMap, b: UsageMap): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    for (const f of TOKEN_FIELDS) if ((a[k]?.[f] || 0) !== (b[k]?.[f] || 0)) return false
    if (Math.abs((a[k]?.costUSD || 0) - (b[k]?.costUSD || 0)) > 1e-9) return false
  }
  return true
}

/** The rows the panel should show for these running totals: `previous === null` = the first one is R*. */
function expectedRows(cums: UsageMap[], previous: UsageMap | null): Array<{ basis: string; models: UsageMap; cum: UsageMap }> {
  const out: Array<{ basis: string; models: UsageMap; cum: UsageMap }> = []
  let prev = previous
  for (const cur of cums) {
    if (prev && sameUsage(prev, cur)) continue
    if (!prev) { out.push({ basis: 'includes-prior', models: cur, cum: cur }); prev = cur; continue }
    const models: UsageMap = {}
    let negative = false
    for (const [m, u] of Object.entries(cur)) {
      const p = prev[m] ?? {}
      const d: UsageEntry = { costUSD: Math.max(0, (u.costUSD || 0) - (p.costUSD || 0)) }
      for (const f of TOKEN_FIELDS) { d[f] = (u[f] || 0) - (p[f] || 0); if (d[f]! < 0) negative = true }
      if (TOKEN_FIELDS.some(f => d[f]! > 0) || d.costUSD! > 1e-9) models[m] = d
    }
    out.push(negative ? { basis: 'reset', models: cur, cum: cur } : { basis: 'turn', models, cum: cur })
    prev = cur
  }
  return out
}

const sumField = (u: UsageMap, f: keyof UsageEntry): number => Object.values(u).reduce((s, e) => s + (e[f] || 0), 0)
const money = (s: string): number | null => { const m = /\$(\d+\.\d+)/.exec(s); return m ? Number(m[1]) : null }

/** Compares the Cache History of one launch with its result log lines; returns the mismatches. */
function compareCacheHistory(name: string, view: HistoryView, cums: UsageMap[], previous: UsageMap | null, lastTotalCost: number | null, logFn: (m: string) => void): string[] {
  const bad: string[] = []
  const exp = expectedRows(cums, previous)
  logFn(`${name} Cache History: ${view.results.length} R row(s), ${view.calls} per-call row(s), total est ${view.total.est} real ${view.total.real}; result log lines ${cums.length} → expected R rows ${exp.length}; CLI total_cost_usd ${lastTotalCost}`)
  if (view.results.length !== exp.length) bad.push(`${name}: ${view.results.length} R rows, expected ${exp.length}`)
  logFn(`${name} | # | label | basis | models | in | c.read | c.write | out | real $ | expected (in / c.read / c.write / out / $) | cumulative c.read / $ | match`)
  for (let i = 0; i < Math.max(view.results.length, exp.length); i++) {
    const r = view.results[i]
    const e = exp[i]
    if (!r || !e) { logFn(`${name} | ${i + 1} | ${r ? `${r.label} only in the panel` : 'missing in the panel'}`); continue }
    const eIn = sumField(e.models, 'inputTokens'), eRead = sumField(e.models, 'cacheReadInputTokens'), eWrite = sumField(e.models, 'cacheCreationInputTokens')
    const eOut = sumField(e.models, 'outputTokens'), eCost = sumField(e.models, 'costUSD')
    const cRead = sumField(e.cum, 'cacheReadInputTokens'), cCost = sumField(e.cum, 'costUSD')
    const rIn = r.turnTotal - r.turnRead - r.turnWrite
    const rCost = money(r.real)
    const wantLabel = e.basis === 'includes-prior' ? 'R*' : 'R'
    const issues: string[] = []
    if (r.label !== wantLabel) issues.push(`label ${r.label} ≠ ${wantLabel}`)
    if (r.basis !== e.basis) issues.push(`basis ${r.basis} ≠ ${e.basis}`)
    if (rIn !== eIn) issues.push(`input ${rIn} ≠ ${eIn}`)
    if (r.turnRead !== eRead) issues.push(`c.read ${r.turnRead} ≠ ${eRead}`)
    if (r.turnWrite !== eWrite) issues.push(`c.write ${r.turnWrite} ≠ ${eWrite}`)
    if (r.output !== eOut) issues.push(`output ${r.output} ≠ ${eOut}`)
    if (rCost === null || Math.abs(rCost - eCost) > 0.00006) issues.push(`real ${r.real} ≠ ${eCost.toFixed(6)}`)
    const panelModels = r.models.map(m => m.model).sort()
    const wantModels = Object.keys(e.models).sort()
    if (r.models.length > 0 && JSON.stringify(panelModels) !== JSON.stringify(wantModels)) issues.push(`models ${JSON.stringify(panelModels)} ≠ ${JSON.stringify(wantModels)}`)
    // ②: a later row must not be the running total itself (only when the two differ)
    if (e.basis === 'turn' && i > 0 && cRead !== eRead && r.turnRead === cRead) issues.push('row shows the running total')
    for (const m of r.models) {
      const em = e.models[m.model]
      if (em && (m.cacheRead !== (em.cacheReadInputTokens || 0) || m.cacheWrite !== (em.cacheCreationInputTokens || 0) || m.output !== (em.outputTokens || 0))) issues.push(`${m.model} sub-row ${m.cacheRead}/${m.cacheWrite}/${m.output} ≠ ${em.cacheReadInputTokens}/${em.cacheCreationInputTokens}/${em.outputTokens}`)
    }
    logFn(`${name} | ${i + 1} | ${r.label} | ${r.basis} | ${(r.models.length ? r.models.map(m => m.model) : wantModels).join('+')} | ${rIn} | ${r.turnRead} | ${r.turnWrite} | ${r.output} | ${r.real} | ${eIn} / ${eRead} / ${eWrite} / ${eOut} / ${eCost.toFixed(6)} | ${cRead} / ${cCost.toFixed(6)} | ${issues.length ? issues.join('; ') : 'OK'}`)
    for (const s of issues) bad.push(`${name} row ${i + 1}: ${s}`)
  }
  const total = money(view.total.real)
  if (lastTotalCost !== null && (total === null || Math.abs(total - lastTotalCost) > 0.00011)) bad.push(`${name}: real $ total ${view.total.real} ≠ CLI total_cost_usd ${lastTotalCost.toFixed(6)}`)
  logFn(`${name} real $ total ${view.total.real} vs CLI total_cost_usd ${lastTotalCost === null ? 'n/a' : lastTotalCost.toFixed(6)} (diff ${total === null || lastTotalCost === null ? 'n/a' : (total - lastTotalCost).toFixed(6)})`)
  return bad
}

const logUsage = (line: string): UsageMap => (safeJson(/modelUsage=(.*)$/.exec(line)?.[1] ?? '') ?? {}) as UsageMap

test.skip(process.env.BAT_E2E_REAL_MODEL !== '1', 'real-model acceptance spends tokens: set BAT_E2E_REAL_MODEL=1 to run')
test.skip(process.platform !== 'win32', 'embedded claude.exe: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)

test('Claude panel against the real model (Haiku 5.5, small budget): stream, permission, search, task list, background Agent, model switch, resume', async () => {
  test.setTimeout(1_800_000)
  const startedAt = Date.now()
  const results: Record<string, string> = {}
  const turns: TurnRecord[] = []
  let costSum = 0
  let stopped = ''
  expect(FORBIDDEN_MODEL.test(MODEL) || FORBIDDEN_MODEL.test(MODEL_4X)).toBe(false)
  expect(claudeProjectDirs()).toEqual([])

  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', `bat-e2e-${RUN_TAG}-`))
  const folder = path.join(root, 'ws')
  fs.mkdirSync(path.join(folder, 'docs', 'notes'), { recursive: true })
  fs.writeFileSync(path.join(folder, 'README.md'), '# T0739 workspace\n\nA scratch folder for the BAT real-model acceptance.\n')
  fs.writeFileSync(path.join(folder, 'docs', 'intro.md'), 'Nothing to see here.\n')
  fs.writeFileSync(path.join(folder, 'docs', 'notes', 'deep.txt'), `marker: ${NEEDLE}\n`)
  log(`workspace ${folder}`)

  let inst: IsolatedInstance | undefined
  let win: Page
  let runtimeId = ''
  const logLines: string[] = []
  const cacheMismatches: string[] = []
  let launch1UserData = ''
  let launch1LogCount = 0
  const sessionTotalCost = async (): Promise<number | null> => ((await win.evaluate((sid) => (window as AnyApi).electronAPI.claude.getSessionMeta(sid), TAB)) as { totalCost?: number } | null)?.totalCost ?? null

  /** Sends one turn and waits for its turn end; records model, cost, usage and tools. */
  const turn = async (label: string, prompt: string, model: string, during?: (panel: Locator) => Promise<void>): Promise<TurnRecord | null> => {
    if (stopped) return null
    if (turns.length >= MAX_TURNS) { stopped = `turn budget ${MAX_TURNS} reached before ${label}`; return null }
    if (costSum > MAX_COST_USD) { stopped = `cost US$${costSum.toFixed(4)} > ${MAX_COST_USD} before ${label}`; return null }
    expect(FORBIDDEN_MODEL.test(model)).toBe(false)
    const panel = activePanel(win)
    const before = await recorder(win)
    const endsBefore = before.turnEnds.length
    const resultsBefore = before.results.length
    const toolsBefore = before.tools.length
    const t0 = Date.now()
    const input = panel.locator('textarea.claude-input')
    await input.click()
    await input.fill(prompt)
    await input.press('Enter')
    if (during) await during(panel)
    await expect.poll(async () => (await recorder(win)).turnEnds.length, { timeout: TURN_TIMEOUT_MS, intervals: [1_000] }).toBeGreaterThan(endsBefore)
    await win.waitForTimeout(1_000)
    const after = await recorder(win)
    const end = after.turnEnds[endsBefore]
    const res = after.results.slice(resultsBefore).at(-1)
    const lines = resultLogLines(inst!.userData)
    const usageLine = lines.at(-1) ?? ''
    const rec: TurnRecord = {
      label, model,
      costUSD: typeof res?.totalCost === 'number' ? res.totalCost : null,
      usage: /usage=(\{.*?\}), modelUsage=/.exec(usageLine)?.[1] ?? 'n/a',
      modelUsage: /modelUsage=(.*)$/.exec(usageLine)?.[1] ?? 'n/a',
      tools: after.tools.slice(toolsBefore).map((x: AnyApi) => `${x.parent ? 'sub:' : ''}${x.name}${x.bg ? '[bg]' : ''}${x.detail ? `(${x.detail})` : ''}`),
      reason: end?.reason ?? '?',
      ms: Date.now() - t0,
    }
    turns.push(rec)
    // CLI 2.1.316: `total_cost_usd` / `modelUsage` are the SESSION's running totals (side requests such as
    // prompt suggestions included, restored on resume), not this turn's — the spend so far is the largest value.
    const delta = rec.costUSD === null ? null : rec.costUSD - costSum
    costSum = Math.max(costSum, rec.costUSD ?? 0)
    log(`turn ${turns.length} ${label}: model=${model} reason=${rec.reason}${end?.error ? ` error=${JSON.stringify(end.error)}` : ''} session cost=${rec.costUSD} (Δ ${delta === null ? 'n/a' : delta.toFixed(6)}) ${Math.round(rec.ms / 1000)} s tools=${JSON.stringify(rec.tools)}`)
    log(`turn ${turns.length} ${label}: usage=${rec.usage} modelUsage=${rec.modelUsage}`)
    for (const m of Object.keys(safeJson(rec.modelUsage) ?? {})) if (FORBIDDEN_MODEL.test(m)) log(`⚠ turn ${turns.length} used a forbidden model: ${m}`)
    return rec
  }

  try {
    // ════════ launch 1 ════════
    inst = await withoutInheritedClaudeEnv(() => launchIsolated('t0739', log))
    runtimeId = inst.runtimeId
    win = inst.win
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0739', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TAB, workspaceId: WS, type: 'terminal', agentPreset: 'claude-code', title: 'T0739 Haiku', cwd: folder, model: MODEL }],
      activeTerminalId: TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    // T0746: the status line's cache item opens Cache History (hidden by default); cost shows the session total
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
    await installRecorders(win)
    const panel = activePanel(win)

    // ── ① stream + complete ──
    let sawCursor = false
    const r1 = await turn('①', 'T0739-1: Reply with exactly the text "T0739 hello" and nothing else. Do not use any tools.', MODEL, async (p) => {
      sawCursor = await p.locator('.claude-cursor').first().waitFor({ state: 'visible', timeout: 60_000 }).then(() => true, () => false)
    })
    const text1 = (await panel.textContent()) ?? ''
    expect(r1?.reason).toBe('completed')
    expect(text1).toContain('T0739 hello')
    await expect(panel.locator('.claude-cursor')).toHaveCount(0, { timeout: 15_000 })
    results['①'] = `PASS — streamed (cursor seen while streaming: ${sawCursor}), completed; the answer "T0739 hello" is shown and the cursor is gone`

    // ── ② permission in `default` mode ──
    const startMode = (await recorder(win)).lastStatus?.permissionMode ?? 'unknown'
    const modeSet = await win.evaluate((sid) => (window as AnyApi).electronAPI.claude.setPermissionMode(sid, 'default'), TAB)
    log(`② mode before: ${startMode}; setPermissionMode(default) → ${JSON.stringify(modeSet)}`)
    const card = panel.locator('.claude-permission-card')
    let cardTitle = ''
    let cardCommand = ''
    const r2 = await turn('②', 'T0739-2: Run this exact Bash command once: mkdir t0739-perm  — then reply with the single word "done".', MODEL, async () => {
      const shown = await card.first().waitFor({ state: 'visible', timeout: 120_000 }).then(() => true, () => false)
      if (!shown) return
      cardTitle = ((await card.first().locator('.claude-permission-title').textContent().catch(() => '')) ?? '').trim()
      cardCommand = ((await card.first().locator('.claude-permission-command').textContent().catch(() => '')) ?? '').trim()
      await card.first().screenshot({ path: test.info().outputPath('t0739-permission.png') }).catch(() => undefined)
      await card.first().locator('.claude-permission-option').first().click()
    })
    const permFolder = fs.existsSync(path.join(folder, 't0739-perm'))
    log(`② card title=${JSON.stringify(cardTitle)} command=${JSON.stringify(cardCommand)}; folder created: ${permFolder}; card count after: ${await card.count()}`)
    if (cardTitle) {
      expect(cardCommand).toContain('mkdir')
      expect(permFolder).toBe(true)
      results['②'] = `PASS — permission card ${JSON.stringify(cardTitle)} / ${JSON.stringify(cardCommand)}; 是 → the command ran (folder exists), turn ${r2?.reason}`
    } else {
      results['②'] = `NO CARD — the model's tools: ${JSON.stringify(r2?.tools)}; folder created: ${permFolder} (recorded, not retried)`
    }
    const restoreMode = startMode === 'unknown' ? 'bypassPermissions' : startMode
    log(`② restore mode ${restoreMode} → ${JSON.stringify(await win.evaluate(({ sid, m }) => (window as AnyApi).electronAPI.claude.setPermissionMode(sid, m), { sid: TAB, m: restoreMode }))}`)

    // ── ③ search: Grep / Glob or Bash ──
    const r3 = await turn('③', `T0739-3: In this workspace, find which file contains the string ${NEEDLE}. Reply with only its relative path.`, MODEL)
    const names3 = await panel.locator('.claude-tool-name').allTextContents()
    const found3 = ((await panel.textContent()) ?? '').includes('deep.txt')
    results['③'] = `RECORDED — tools this turn: ${JSON.stringify(r3?.tools)}; answer mentions deep.txt: ${found3}; card names in the panel so far: ${JSON.stringify([...new Set(names3)])}`

    // ── ④ task list (Claude 5) ──
    const r4 = await turn('④', 'T0739-4: First create a todo list of exactly 3 steps named "step A", "step B" and "step C" using your task/todo tools, then mark each one completed in order. The steps need no real work. Finally reply "tasks done".', MODEL)
    const lists4 = await panel.evaluate(el => [...el.querySelectorAll('.claude-todo-checklist')].map(list =>
      [...list.querySelectorAll('.claude-todo-item')].map(item => `${item.className.replace('claude-todo-item claude-todo-', '')}:${item.querySelector('.claude-todo-text')?.textContent ?? ''}`)))
    await panel.screenshot({ path: test.info().outputPath('t0739-task-list.png') }).catch(() => undefined)
    const usedTask = (r4?.tools ?? []).some(t => /^Task(Create|Update)/.test(t))
    const usedTodoWrite = (r4?.tools ?? []).some(t => /^TodoWrite/.test(t))
    log(`④ checklists: ${JSON.stringify(lists4)}`)
    results['④'] = `RECORDED — Task* used: ${usedTask}, TodoWrite used: ${usedTodoWrite}; tools ${JSON.stringify(r4?.tools)}; panel checklist(s): ${JSON.stringify(lists4)}`

    // ── ⑤ background Agent ──
    let barWhileRunning = -1
    let agentCardWhileRunning = -1
    let bgTag = false
    const r5 = await turn('⑤', 'T0739-5: Use the Agent tool exactly once with subagent_type "general-purpose", run_in_background true, description "T0739 bg probe", and prompt "Reply with the single word PONG. Do not use any tools." Then reply "launched" and stop.', MODEL, async (p) => {
      const agentCard = p.locator('.tl-item', { has: win.locator('.claude-tool-name', { hasText: /^Agent$/ }) })
      const shown = await agentCard.first().waitFor({ state: 'visible', timeout: 120_000 }).then(() => true, () => false)
      if (!shown) return
      await win.waitForTimeout(1_500)
      agentCardWhileRunning = await agentCard.count()
      barWhileRunning = await p.locator('.claude-active-task-item').count()
      bgTag = (await agentCard.first().locator('.claude-task-meta .claude-task-tag').count()) > 0
      await p.screenshot({ path: test.info().outputPath('t0739-agent-running.png') }).catch(() => undefined)
    })
    // the background agent may finish after the main turn ended: give it up to 120 s, then record
    let barAfter = -1
    await expect.poll(async () => (barAfter = await panel.locator('.claude-active-task-item').count()), { timeout: 120_000 }).toBe(0).catch(() => undefined)
    await win.waitForTimeout(5_000)
    const recAfter5 = await recorder(win)
    const extraEnds = recAfter5.turnEnds.length - turns.length // turn ends nobody sent (an auto follow-up turn)
    const agentCard = panel.locator('.tl-item', { has: win.locator('.claude-tool-name', { hasText: /^Agent$/ }) })
    const agentDot = agentCard.count().then(n => (n ? agentCard.first().locator('.tl-dot').getAttribute('class') : 'none'))
    const agentDesc = agentCard.count().then(n => (n ? agentCard.first().locator('.claude-tool-desc').first().textContent() : ''))
    log(`⑤ while running: Agent cards=${agentCardWhileRunning} bar items=${barWhileRunning} background tag=${bgTag}; after: bar items=${barAfter} dot=${await agentDot} desc=${JSON.stringify(await agentDesc)} extra turn ends=${extraEnds}`)
    await panel.screenshot({ path: test.info().outputPath('t0739-agent-after.png') }).catch(() => undefined)
    results['⑤'] = `RECORDED — tools ${JSON.stringify(r5?.tools)}; while running: Agent card ${agentCardWhileRunning}, active-task bar ${barWhileRunning}, 背景 tag ${bgTag}; after ≤ 120 s: bar ${barAfter}, card dot ${await agentDot}, desc ${JSON.stringify(await agentDesc)}; auto follow-up turn ends: ${extraEnds}`
    for (let i = 0; i < extraEnds; i++) turns.push({ label: '⑤ auto follow-up', model: MODEL, costUSD: null, usage: 'see log', modelUsage: 'see log', tools: [], reason: 'auto', ms: 0 })

    // ── ⑥ switch to the 4.x model, one turn (the 4.x todo-tool control) ──
    const set4 = await win.evaluate(({ sid, m }) => (window as AnyApi).electronAPI.claude.setModel(sid, m), { sid: TAB, m: MODEL_4X })
    log(`⑥ setModel(${MODEL_4X}) → ${JSON.stringify(set4)}`)
    const r6 = await turn('⑥', 'T0739-6: Create a todo list of exactly 2 steps named "step X" and "step Y" using your task/todo tools, mark both completed, then reply "4.x done".', MODEL_4X)
    const used6 = Object.keys(safeJson(r6?.modelUsage ?? '') ?? {})
    results['⑥'] = `RECORDED — setModel → ${set4}; models in the result: ${JSON.stringify(used6)}; tools ${JSON.stringify(r6?.tools)} (Task*: ${(r6?.tools ?? []).some(t => /^Task(Create|Update)/.test(t))}, TodoWrite: ${(r6?.tools ?? []).some(t => /^TodoWrite/.test(t))})`
    log(`⑥ setModel back to ${MODEL} → ${JSON.stringify(await win.evaluate(({ sid, m }) => (window as AnyApi).electronAPI.claude.setModel(sid, m), { sid: TAB, m: MODEL }))}`)

    const sdkSessionId = ((await win.evaluate((sid) => (window as AnyApi).electronAPI.claude.getSessionMeta(sid), TAB)) as { sdkSessionId?: string } | null)?.sdkSessionId ?? ''
    const rec1 = await recorder(win)
    log(`launch 1: prompt suggestions ${rec1.suggestions}; errors ${JSON.stringify(rec1.errors)}; sdkSessionId ${sdkSessionId.slice(0, 8)}…`)
    // T0746: launch 1 starts a new session → every R row is a difference, the first from 0
    await win.waitForTimeout(3_000)
    const hist1 = await readCacheHistory(win, 't0746-cache-history-launch1.png').catch((e: unknown) => { cacheMismatches.push(`launch 1: Cache History not readable: ${String(e).slice(0, 200)}`); return null })
    const launch1Lines = resultLogLines(inst.userData)
    if (hist1) cacheMismatches.push(...compareCacheHistory('launch 1', hist1, launch1Lines.map(logUsage), {}, await sessionTotalCost(), log))
    launch1UserData = inst.userData
    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined
    launch1LogCount = resultLogLines(launch1UserData).length
    logLines.push(...resultLogLines(launch1UserData))

    // ════════ launch 2: same runtime → resume ════════
    inst = await withoutInheritedClaudeEnv(() => launchIsolated('t0739', log, { runtimeId }))
    win = inst.win
    await expect(activePanel(win)).toBeVisible({ timeout: 45_000 })
    await installRecorders(win)
    const restored = activePanel(win)
    await expect.poll(async () => (await restored.textContent()) ?? '', { timeout: 60_000 }).toContain('T0739 hello')
    const rebuilt = ((await restored.textContent()) ?? '')
    const savedId = (JSON.parse(await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()) as string) as { terminals?: Array<{ id: string; sdkSessionId?: string; model?: string }> }).terminals?.find(t => t.id === TAB)
    log(`⑦ restored: sdkSessionId ${savedId?.sdkSessionId?.slice(0, 8)}… (before ${sdkSessionId.slice(0, 8)}…) model=${savedId?.model}; history has ①: ${rebuilt.includes('T0739 hello')} ④: ${rebuilt.includes('tasks done')}`)
    const r7 = await turn('⑦', 'T0739-7: What exact text did I ask you to reply with in my T0739-1 message? Answer in one line.', MODEL)
    const after7 = (await restored.textContent()) ?? ''
    const continued = after7.split('T0739-7').at(-1)?.includes('T0739 hello') ?? false
    results['⑦'] = `${continued ? 'PASS' : 'RECORDED'} — relaunch restored the tab (sdkSessionId ${savedId?.sdkSessionId === sdkSessionId ? 'same' : 'changed'}), history rebuilt (① text shown); the next turn ${continued ? 'answered "T0739 hello" (context carried over)' : 'did not quote "T0739 hello"'}; reason ${r7?.reason}`
    const rec2 = await recorder(win)
    log(`launch 2: prompt suggestions ${rec2.suggestions}; errors ${JSON.stringify(rec2.errors)}`)
    // T0746: after the resume the first R row is R* (the running total so far), later rows are differences
    await win.waitForTimeout(3_000)
    const hist2 = await readCacheHistory(win, 't0746-cache-history-launch2.png').catch((e: unknown) => { cacheMismatches.push(`launch 2: Cache History not readable: ${String(e).slice(0, 200)}`); return null })
    const launch2Lines = resultLogLines(inst.userData).slice(launch1LogCount)
    if (hist2) cacheMismatches.push(...compareCacheHistory('launch 2', hist2, launch2Lines.map(logUsage), null, await sessionTotalCost(), log))
    logLines.push(...launch2Lines)
  } finally {
    if (inst) {
      if (!logLines.length) logLines.push(...resultLogLines(inst.userData))
      else if (logLines.length === launch1LogCount) logLines.push(...resultLogLines(inst.userData).slice(launch1LogCount))
      await closeIsolated(inst, log)
    }
    if (stopped) log(`⛔ stopped: ${stopped}`)
    for (const [k, v] of Object.entries(results)) log(`${k} ${v}`)
    log(`turns: ${turns.length}; session cost (largest result total_cost_usd) US$${costSum.toFixed(4)}`)
    log(`T0746 Cache History mismatches: ${cacheMismatches.length ? JSON.stringify(cacheMismatches) : 'none'}`)
    for (const [i, line] of logLines.entries()) log(`result log ${i + 1}: ${line}`)
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    const sessions = claudeProjectDirs()
    for (const name of sessions) fs.rmSync(path.join(os.homedir(), '.claude', 'projects', name), { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    log(`removed ${sessions.length} ~/.claude/projects folder(s) matching bat-e2e-${RUN_TAG}; left: ${claudeProjectDirs().length}`)
    log(`T0739 spec took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  }
  expect(stopped).toBe('')
  expect(costSum).toBeLessThanOrEqual(MAX_COST_USD)
  expect(cacheMismatches).toEqual([])
})

function safeJson(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s) as Record<string, unknown> } catch { return null }
}
