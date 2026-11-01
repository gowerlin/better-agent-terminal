// T0747 (v0.7.2-pre.8 real-model acceptance, small budget): the workspace "waiting for you" ⚠️ (T0735 /
// D200–D203) raised by the embedded claude CLI talking to the REAL Anthropic API with the user's existing
// claude login. T0736 (e2e/v072-pre8-workspace-waiting-real-agents.spec.ts) covered the same rows with a
// fake API; this one adds what a fake cannot show: claude 2.1.316's auto mode (a gateway offers no
// classifier, so auto mode never reached a permission prompt there).
//
// 🔴 SPENDS TOKENS. Skipped unless BAT_E2E_REAL_MODEL=1, so a plain `npm run test:e2e` never runs it.
//   BAT_E2E_REAL_MODEL=1 npx playwright test e2e/v072-real-model-workspace-waiting.spec.ts
// Model: claude-haiku-5-5 only (B's workspace `agentCustomArgs`, no product change); never Opus / Fable /
// Sonnet. Budget: ≤ 10 prompts typed into claude (MAX_TURNS) and ≤ US$0.5 estimated from the session
// transcripts' `usage` fields (MAX_COST_USD), checked before every prompt. Auto mode's classifier
// requests are the CLI's own and do not appear in the transcripts: they are not counted (logged so).
//
// Isolation: the source build (`npx vite build` first) in its own runtime (fixtures/electron-isolation.ts:
// own userData, own remote port, inherited BAT_* / CT_* dropped). The real HOME is kept (that is where the
// login lives); the spec never opens, copies or prints a credential file or token, and never dumps the
// env. Inherited ANTHROPIC_* / CLAUDE* variables are dropped. The claude arguments carry no `--settings`
// (BAT injects its hooks with one) and `--strict-mcp-config` (only BAT's own MCP server, none of the
// user's). Workspace folders live under %ProgramData%\bat-e2e-t0747-* (an ancestor's .claude/CLAUDE.md
// would be read otherwise) and are removed afterwards, so are the CLI's session folders in
// ~/.claude/projects whose name contains `bat-e2e-t0747` — nothing else there is touched. claude's
// folder-trust screen is answered through the tab's PTY.
//
// Two workspaces: A (looked at) and B (holds the claude tabs); the checks read B's row while A is active.
//   ① B: a Claude CLI tab ("+" menu, --permission-mode default) → a Bash command that needs approval →
//      claude's PermissionRequest hook → B's row ⚠️, tooltip = the tab + the permission reason, never the
//      command → approved in B (B active, the tab selected) → cleared / faded per D203 (focus logged)
//   ② the same tab switched to auto mode (Shift+Tab until the footer says "auto mode on") → three
//      actions of different risk (echo; a file written outside the workspace; a file deleted): per
//      action whether claude asked, whether the PermissionRequest hook fired, whether B's row showed ⚠️
//      (observational, not asserted; a prompt is approved through the PTY)
//   ③ B: an "Open Claude as Tower" tab → AskUserQuestion → `question` → B's row ⚠️
//   ④ ③ answered through the PTY while A is looked at → B's row faded ⚠️ → B and the Tower tab selected
//      with window focus → cleared (D203)
// Model behaviour (a tool not used) is recorded; a scenario is retried at most once.
//
// Windows only (embedded claude.exe).

import { test, expect, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { getModelPricing } from '../src/lib/model-pricing'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0747')
const RUN_TAG = 't0747'
const WS_A = 'e2e-t0747-a'
const WS_B = 'e2e-t0747-b'
const MODEL = 'claude-haiku-5-5'
const CLAUDE_ARGS = `--model ${MODEL} --permission-mode default --strict-mcp-config`
const MAX_TURNS = 10
const MAX_COST_USD = 0.5
const TURN_TIMEOUT_MS = 240_000
const SECRET = 't0747-secret-cmd' // in the ① command: must never reach a tooltip or a log
const QUESTION = 'T0747 which option?'
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const INHERITED = /^(ANTHROPIC_|CLAUDE)/i
const FORBIDDEN_MODEL = /opus|fable|sonnet/i
const CLAUDE_ITEM = /^\s*▶\s*Claude CLI\s*(suggested|建議|建议)?\s*$/
const TOWER_ITEM = /以塔台開啟 Claude|Open Claude as Tower|以塔台打开 Claude/
const PERMISSION_TIP = /權限確認|permission prompt|权限确认/
const QUESTION_TIP = /回答問題|question to answer|回答问题/
const TRUST_SCREEN = /Yes,?Itrustthisfolder/i // matched with whitespace removed (the TUI draws with cursor moves)
const PROMPT_SCREEN = /Doyouwantto|don'taskagain/i // matched with whitespace removed

interface SavedTab { id: string; workspaceId: string; title?: string; agentPreset?: string; launchRole?: string }
interface TurnRecord { label: string; tab: string; start: number; end: number; ended: boolean }
interface UsageRow { file: string; ts: number; model: string; id: string; input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
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

const projectsDir = () => path.join(os.homedir(), '.claude', 'projects')
function claudeProjectDirs(): string[] {
  return fs.existsSync(projectsDir()) ? fs.readdirSync(projectsDir()).filter(n => n.toLowerCase().includes(`bat-e2e-${RUN_TAG}`)) : []
}

function jsonlFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...jsonlFiles(p))
    else if (e.name.endsWith('.jsonl')) out.push(p)
  }
  return out
}

/** Only the `usage` / `model` / `id` / `timestamp` of assistant entries; nothing else is kept or printed. */
function readUsage(): UsageRow[] {
  const rows = new Map<string, UsageRow>()
  for (const d of claudeProjectDirs()) {
    for (const file of jsonlFiles(path.join(projectsDir(), d))) {
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        if (!line.includes('"usage"')) continue
        let j: AnyApi
        try { j = JSON.parse(line) } catch { continue }
        const m = j?.message
        const u = m?.usage
        if (j?.type !== 'assistant' || !u) continue
        const id = String(m.id ?? j.uuid ?? `${file}:${rows.size}`)
        const w1h = Number(u.cache_creation?.ephemeral_1h_input_tokens ?? 0)
        const cw = Number(u.cache_creation_input_tokens ?? 0)
        // streamed entries of one message repeat its usage: keep the last
        rows.set(id, {
          file: path.basename(file), ts: Date.parse(j.timestamp ?? '') || 0, model: String(m.model ?? '?'), id,
          input: Number(u.input_tokens ?? 0), output: Number(u.output_tokens ?? 0), cacheRead: Number(u.cache_read_input_tokens ?? 0),
          cacheWrite5m: Math.max(0, cw - w1h), cacheWrite1h: w1h,
        })
      }
    }
  }
  return [...rows.values()].sort((a, b) => a.ts - b.ts)
}

function costOf(r: UsageRow): number | null {
  const promptTokens = r.input + r.cacheRead + r.cacheWrite5m + r.cacheWrite1h
  const p = getModelPricing(r.model, { promptTokens })
  if (!p) return null
  return (r.input * p.input + r.output * p.output + r.cacheRead * p.cacheRead + r.cacheWrite5m * p.cacheWrite5m + r.cacheWrite1h * p.cacheWrite1h) / 1e6
}

const totalCost = (rows: UsageRow[]): number => rows.reduce((s, r) => s + (costOf(r) ?? 0), 0)

const rowOf = (win: Page, name: string): Locator => win.locator('.workspace-item', { hasText: name })
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** The active workspace's thumbnail whose title is exactly `title` ("Claude CLI" vs "Claude CLI · Tower"). */
const thumbOf = (win: Page, title: string): Locator => win.locator('.workspace-container.active .thumbnail')
  .filter({ has: win.locator('.thumbnail-title > span', { hasText: new RegExp(`^${escapeRe(title)}$`) }) })

test.skip(process.env.BAT_E2E_REAL_MODEL !== '1', 'real-model acceptance spends tokens: set BAT_E2E_REAL_MODEL=1 to run')
test.skip(process.platform !== 'win32', 'embedded claude.exe and pwsh tabs: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)

test('workspace ⚠️ from the real model (Haiku 5.5, small budget): permission, auto mode, Tower AskUserQuestion, faded', async () => {
  test.setTimeout(1_500_000)
  const startedAt = Date.now()
  const results: Record<string, string> = {}
  const autoRows: string[] = []
  const turns: TurnRecord[] = []
  let stopped = ''
  expect(FORBIDDEN_MODEL.test(MODEL)).toBe(false)
  expect(claudeProjectDirs()).toEqual([])

  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', `bat-e2e-${RUN_TAG}-`))
  const folderA = path.join(root, 'a')
  const folderB = path.join(root, 'b')
  const outside = path.join(root, 'outside')
  for (const dir of [folderA, folderB, outside]) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(folderB, 'README.md'), '# T0747 workspace\n\nA scratch folder for the BAT real-model acceptance.\n')
  fs.writeFileSync(path.join(folderB, 't0747-delete-me.txt'), 'delete me\n')
  log(`folders under ${root}`)

  let inst: IsolatedInstance | undefined
  try {
    inst = await withoutInheritedClaudeEnv(() => launchIsolated(RUN_TAG, log))
    const { app, win, userData } = inst

    const debugLog = () => {
      const dir = path.join(userData, 'Logs')
      return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    }
    const logLines = (id: string, tag: string) => debugLog().split('\n').filter(l => l.includes(`terminal=${id}`) && l.includes(tag))
    /** `report-hook` records of bat-scripts.log for a tab: [{ hook, result }] (no payload is logged there). */
    const hookReports = (id: string): Array<{ hook: string; result: string }> => {
      const file = path.join(userData, 'Logs', 'bat-scripts.log')
      if (!fs.existsSync(file)) return []
      return fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap((l) => {
        try {
          const j = JSON.parse(l)
          return j?.event === 'report-hook' && j?.terminalId === id ? [{ hook: String(j.hook), result: String(j.result) }] : []
        } catch { return [] }
      })
    }
    const replay = async (id: string) => {
      const b = (await win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id)) as { data?: string; total?: number } | null
      return { data: b?.data ?? '', total: b?.total ?? 0 }
    }
    const buffer = async (id: string) => (await replay(id)).data
    /** The output written since `total` (the replay buffer keeps only a tail; `total` counts every byte). */
    const since = async (id: string, total: number) => {
      const b = await replay(id)
      return { text: stripAnsi(b.data.slice(Math.max(0, b.data.length - Math.max(0, b.total - total)))), total: b.total }
    }
    const screen = async (id: string, n = 2500) => stripAnsi(await buffer(id)).slice(-n)
    const savedTabs = async (): Promise<SavedTab[]> => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      return raw ? (JSON.parse(raw) as { terminals: SavedTab[] }).terminals : []
    }
    const write = (id: string, data: string) => win.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: id, d: data })
    const typePrompt = async (id: string, text: string) => {
      await write(id, text)
      await win.waitForTimeout(600)
      await write(id, '\r')
    }
    const selectWorkspace = async (name: string) => {
      await rowOf(win, name).locator('.workspace-folder').click()
      await expect(rowOf(win, name)).toHaveClass(/\bactive\b/)
    }
    const focusWindow = async (): Promise<boolean> => {
      await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus() })
      await win.evaluate(() => window.dispatchEvent(new Event('focus')))
      return win.evaluate(() => document.hasFocus())
    }
    const addFromMenu = async (name: RegExp): Promise<SavedTab> => {
      const known = new Set((await savedTabs()).map(t => t.id))
      await win.locator('.workspace-container.active .thumbnail-add-btn').click()
      const item = win.locator('.thumbnail-add-menu-item', { hasText: name }).first()
      await expect(item).toBeVisible()
      await item.click()
      let tab: SavedTab | undefined
      await expect.poll(async () => (tab = (await savedTabs()).find(t => !known.has(t.id))) !== undefined, { timeout: 15_000 }).toBe(true)
      return tab!
    }
    /** Waits for claude's SessionStart hook; answers the folder-trust screen once through the PTY. */
    const waitStarted = async (tab: SavedTab, what: string) => {
      let trustAnswered = false
      const deadline = Date.now() + 120_000
      while (Date.now() < deadline) {
        if (logLines(tab.id, '[agent-start]').some(l => /→ started \(hook session-start\)/.test(l))) {
          log(`${what}: started; folder-trust screen answered: ${trustAnswered}`)
          return
        }
        if (!trustAnswered && TRUST_SCREEN.test((await screen(tab.id, 1500)).replace(/\s+/g, ''))) {
          // claude 2.1.316: "❯ No, exit" is selected first, "Yes, I trust this folder" second (the first
          // run of this spec pressed Enter on the first option and claude exited)
          await win.waitForTimeout(800)
          await write(tab.id, '\x1b[B') // ↓ to "Yes, I trust this folder"
          await win.waitForTimeout(600)
          const choice = (await screen(tab.id, 400)).replace(/\s+/g, '')
          log(`${what}: folder-trust screen after ↓ ends with ${JSON.stringify(choice.slice(-120))}`)
          await write(tab.id, '\r')
          trustAnswered = true
          log(`${what}: folder-trust screen answered (↓ + Enter: trust the folder)`)
        }
        await win.waitForTimeout(1_000)
      }
      log(`${what}: no SessionStart within 120 s. screen:\n${await screen(tab.id)}`)
      throw new Error(`${what}: claude did not start`)
    }
    const turnEnds = (id: string) => logLines(id, '[turn]').filter(l => /→ ended \(/.test(l)).length

    /** Budget gate before a prompt: turns typed so far and the transcript estimate. */
    const budgetOk = (label: string): boolean => {
      if (stopped) return false
      if (turns.length >= MAX_TURNS) { stopped = `turn budget ${MAX_TURNS} reached before ${label}`; return false }
      const cost = totalCost(readUsage())
      if (cost > MAX_COST_USD) { stopped = `estimated cost US$${cost.toFixed(4)} > ${MAX_COST_USD} before ${label}`; return false }
      return true
    }

    /**
     * Types one prompt and follows the turn until its Stop hook: every permission prompt that appears is
     * recorded (screen text, BAT blocked line, B's row badge) and handled by `onPrompt`.
     */
    const runTurn = async (label: string, tab: SavedTab, prompt: string, onPrompt: (n: number) => Promise<void>): Promise<{ prompts: number; blocked: string[]; hooks: string[]; badge: string[]; ended: boolean } | null> => {
      if (!budgetOk(label)) return null
      const endsBefore = turnEnds(tab.id)
      const blockedBefore = logLines(tab.id, '[blocked]').length
      const hooksBefore = hookReports(tab.id).length
      let seenTotal = (await replay(tab.id)).total
      const rec: TurnRecord = { label, tab: tab.title ?? tab.id, start: Date.now(), end: 0, ended: false }
      turns.push(rec)
      await typePrompt(tab.id, prompt)
      const badge = new Set<string>()
      let prompts = 0
      const deadline = Date.now() + TURN_TIMEOUT_MS
      while (Date.now() < deadline) {
        const b = rowOf(win, WS_B).locator('.workspace-waiting-badge')
        badge.add((await b.count()) ? `${await b.getAttribute('data-waiting')}:${(await b.textContent())?.trim()}` : 'none')
        const fresh = (await since(tab.id, seenTotal)).text
        const blockedNow = logLines(tab.id, '[blocked]').slice(blockedBefore).some(l => /→ blocked reason=/.test(l))
        if (PROMPT_SCREEN.test(fresh.replace(/\s+/g, '')) || (blockedNow && prompts === 0)) {
          prompts++
          await win.waitForTimeout(2_000) // let the row badge follow
          const b2 = rowOf(win, WS_B).locator('.workspace-waiting-badge')
          badge.add((await b2.count()) ? `${await b2.getAttribute('data-waiting')}:${(await b2.textContent())?.trim()}` : 'none')
          await onPrompt(prompts)
          seenTotal = (await replay(tab.id)).total
          if (prompts >= 4) break
        }
        if (turnEnds(tab.id) > endsBefore) { rec.ended = true; break }
        await win.waitForTimeout(700)
      }
      if (!rec.ended) await expect.poll(() => turnEnds(tab.id) > endsBefore, { timeout: 30_000 }).toBe(true).then(() => { rec.ended = true }, () => undefined)
      rec.end = Date.now()
      const blocked = logLines(tab.id, '[blocked]').slice(blockedBefore).map(l => l.replace(/^.*?\[blocked\]/, '[blocked]'))
      const hooks = hookReports(tab.id).slice(hooksBefore).map(h => `${h.hook}→${h.result}`)
      log(`turn ${turns.length} ${label}: ended=${rec.ended} ${Math.round((rec.end - rec.start) / 1000)} s; permission prompts handled ${prompts}; [blocked] ${JSON.stringify(blocked)}; hooks ${JSON.stringify(hooks)}; B row ${JSON.stringify([...badge])}`)
      if (!rec.ended) log(`${label}: screen of ${tab.title}:\n${await screen(tab.id)}`)
      return { prompts, blocked, hooks, badge: [...badge], ended: rec.ended }
    }

    // ── seed: A (a shell) and B (a shell; claude args: Haiku 5.5, default mode) ──
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_A, name: WS_A, folderPath: folderA, createdAt: Date.now() },
        { id: WS_B, name: WS_B, folderPath: folderB, createdAt: Date.now(), agentCustomArgs: { 'claude-cli': CLAUDE_ARGS } },
      ],
      activeWorkspaceId: WS_B,
      activeGroup: null,
      terminals: [
        { id: 'e2e-t0747-a-shell', workspaceId: WS_A, type: 'terminal', title: 'T0747 A shell', cwd: folderA },
        { id: 'e2e-t0747-b-shell', workspaceId: WS_B, type: 'terminal', title: 'T0747 B shell', cwd: folderB },
      ],
      activeTerminalId: 'e2e-t0747-b-shell',
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(rowOf(win, WS_B)).toHaveClass(/\bactive\b/, { timeout: 30_000 })

    // ── the two claude tabs in B; the first one answers the folder-trust screen ──
    const cli = await addFromMenu(CLAUDE_ITEM)
    await waitStarted(cli, 'Claude CLI tab')
    const tower = await addFromMenu(TOWER_ITEM)
    await waitStarted(tower, 'Tower tab')
    expect(cli).toMatchObject({ workspaceId: WS_B, agentPreset: 'claude-cli' })
    expect(tower).toMatchObject({ workspaceId: WS_B, agentPreset: 'claude-cli', launchRole: 'tower' })
    for (const t of [cli, tower]) {
      await thumbOf(win, t.title!).click()
      await win.waitForTimeout(1_500)
    }
    const cmdLine = (await screen(cli.id, 6000)).split(/\r?\n/).find(l => l.includes('--model')) ?? ''
    log(`tabs: claude ${JSON.stringify(cli)} / tower ${JSON.stringify(tower)}; launch line has --model ${MODEL}: ${cmdLine.includes(MODEL)}, --permission-mode default: ${cmdLine.includes('--permission-mode default')}`)
    const rowBadge = rowOf(win, WS_B).locator('.workspace-waiting-badge')

    // ── ① default mode: a Bash command that needs approval → ⚠️ → approved in B ──
    await selectWorkspace(WS_A)
    await expect(rowBadge).toHaveCount(0)
    let tip1 = ''
    let focus1: boolean | null = null
    const after1 = async (label: string, prompt: string) => runTurn(label, cli, prompt, async (n) => {
      if (n === 1) {
        await expect(rowBadge).toHaveText('⚠️', { timeout: 15_000 })
        await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting')
        await expect(rowBadge).toHaveAttribute('data-waiting-target', cli.id)
        tip1 = (await rowBadge.getAttribute('title')) ?? ''
        await win.screenshot({ path: test.info().outputPath('1-permission-row-badge.png') })
        // approve in B: B active, the tab selected, the window focused
        await selectWorkspace(WS_B)
        await thumbOf(win, cli.title!).click()
        focus1 = await focusWindow()
      }
      await write(cli.id, '\r') // "Yes"
    })
    const p1 = `T0747-1: Use the Bash tool to run exactly this command once: mkdir ${SECRET}-dir  — then reply with the single word "done".`
    let r1 = await after1('①', p1)
    if (r1 && r1.prompts === 0) {
      log('① no permission prompt: retrying once')
      await selectWorkspace(WS_A)
      r1 = await after1('① retry', `${p1} You must use the Bash tool; do not answer without running it.`)
    }
    if (r1 && r1.prompts > 0) {
      log(`① B row tooltip: ${JSON.stringify(tip1)}; focus when approving: ${focus1}`)
      expect(tip1).toContain(cli.title!)
      expect(tip1).toMatch(PERMISSION_TIP)
      expect(tip1).not.toContain(SECRET)
      expect(r1.blocked.some(l => /→ blocked reason=permission \(hook permission-request tool=Bash/.test(l))).toBe(true)
      await expect.poll(async () => (await rowBadge.count()) ? await rowBadge.getAttribute('data-waiting') : 'none', { timeout: 15_000 }).toBe(focus1 ? 'none' : 'missed')
      const after = (await rowBadge.count()) ? await rowBadge.getAttribute('data-waiting') : 'none'
      results['①'] = `PASS — Claude CLI (+ menu, ${MODEL}, default mode) Bash mkdir → PermissionRequest tool=Bash → B row ⚠️ (target ${cli.id}), tooltip "${cli.title}" + permission reason, no command; approved in B with window focus=${focus1} → row ${after === 'none' ? 'cleared (no faded mark)' : after}; folder created: ${fs.existsSync(path.join(folderB, `${SECRET}-dir`))}`
    } else {
      results['①'] = `NOT COVERED — no permission prompt (${stopped || `turn ended ${r1?.ended}, hooks ${JSON.stringify(r1?.hooks)}`})`
    }

    // ── ② auto mode: Shift+Tab until the footer says so, then three actions of different risk ──
    await selectWorkspace(WS_B)
    await thumbOf(win, cli.title!).click()
    await focusWindow()
    let autoOn = false
    const footers: string[] = []
    for (let i = 0; i < 6 && !autoOn; i++) {
      const mark = (await replay(cli.id)).total
      await write(cli.id, '\x1b[Z') // Shift+Tab
      await win.waitForTimeout(1_200)
      const tail = (await since(cli.id, mark)).text.replace(/\s+/g, '')
      const mode = /automodeon/i.test(tail) ? 'auto mode on' : /accepteditson/i.test(tail) ? 'accept edits on' : /planmodeon/i.test(tail) ? 'plan mode on' : /bypasspermissionson/i.test(tail) ? 'bypass permissions on' : 'default?'
      footers.push(mode)
      autoOn = mode === 'auto mode on'
    }
    log(`② Shift+Tab footers: ${JSON.stringify(footers)}; auto mode on: ${autoOn}`)
    if (!autoOn) log(`② screen:\n${await screen(cli.id, 1500)}`)
    await selectWorkspace(WS_A)
    const outsideFile = path.join(outside, 't0747-auto.txt')
    const actions: Array<{ key: string; prompt: string; check: () => string }> = [
      { key: 'echo', prompt: 'T0747-2a: Use the Bash tool to run exactly: echo t0747-auto-low  — then reply "done".', check: () => '' },
      { key: 'write outside the workspace', prompt: `T0747-2b: Use the Write tool to create the file ${outsideFile} with the content "t0747" (this path is outside the current folder). Then reply "done".`, check: () => `file exists: ${fs.existsSync(outsideFile)}` },
      { key: 'delete a file', prompt: 'T0747-2c: Use the Bash tool to run exactly: rm t0747-delete-me.txt  — then reply "done".', check: () => `file deleted: ${!fs.existsSync(path.join(folderB, 't0747-delete-me.txt'))}` },
    ]
    if (autoOn) {
      for (const a of actions) {
        const r = await runTurn(`② ${a.key}`, cli, a.prompt, async () => { await write(cli.id, '\r') })
        if (!r) break
        const hookFired = r.hooks.some(h => h.startsWith('permission-request'))
        const row = r.badge.some(s => s.startsWith('waiting')) ? '⚠️ shown' : r.badge.some(s => s.startsWith('missed')) ? 'faded only' : 'none'
        const asked = r.prompts > 0
        autoRows.push(`| ${a.key} | ${asked ? 'asked' : 'not asked'} | ${hookFired ? 'fired' : 'not fired'} | ${row} | ${a.check()} | ${r.ended ? 'turn ended' : 'turn did not end'} |`)
        log(`② ${a.key}: screen tail:\n${(await screen(cli.id, 1200)).replace(new RegExp(escapeRe(root), 'gi'), '<root>')}`)
      }
      results['②'] = `RECORDED — auto mode reached by ${footers.length} Shift+Tab; see the table`
    } else {
      results['②'] = `NOT COVERED — auto mode not reached by Shift+Tab (footers ${JSON.stringify(footers)})`
    }
    // look at the CLI tab once so a faded mark from ② does not hide ④'s result
    await selectWorkspace(WS_B)
    await thumbOf(win, cli.title!).click()
    await focusWindow()
    await win.waitForTimeout(1_500)
    await selectWorkspace(WS_A)
    log(`before ③: B row ${(await rowBadge.count()) ? await rowBadge.getAttribute('data-waiting') : 'none'}`)

    // ── ③ the Tower tab: AskUserQuestion → question → ⚠️; ④ answered while A is looked at → faded ──
    let tip3 = ''
    let missed4 = ''
    let focus4: boolean | null = null
    const p3 = `T0747-3: Use the AskUserQuestion tool exactly once to ask me "${QUESTION}" with the two options "Alpha" and "Beta". After I answer, reply with the single word "ok".`
    // runTurn's loop treats the `question` blocked line as a prompt: answer it there while A is looked at
    const answer3 = async () => {
      await expect(rowBadge).toHaveText('⚠️', { timeout: 15_000 })
      await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting')
      await expect(rowBadge).toHaveAttribute('data-waiting-target', tower.id)
      tip3 = (await rowBadge.getAttribute('title')) ?? ''
      await win.screenshot({ path: test.info().outputPath('3-question-row-badge.png') })
      focus4 = await focusWindow()
      await write(tower.id, '\r') // the first option
      const cleared = await expect.poll(() => logLines(tower.id, '[blocked]').some(l => /→ cleared \(/.test(l)), { timeout: 20_000 }).toBe(true).then(() => true, () => false)
      if (!cleared) await write(tower.id, '\r') // a review / submit step
      await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 20_000 })
      missed4 = (await rowBadge.getAttribute('title')) ?? ''
      await win.screenshot({ path: test.info().outputPath('4-faded-row-badge.png') })
    }
    const asked = (r: Awaited<ReturnType<typeof runTurn>>) => !!r && r.blocked.some(l => /→ blocked reason=question/.test(l))
    let r3 = await runTurn('③④', tower, p3, answer3)
    if (r3 && !asked(r3)) {
      log('③ no AskUserQuestion: retrying once')
      r3 = await runTurn('③④ retry', tower, `${p3} You must call the AskUserQuestion tool; do not ask in plain text.`, answer3)
    }
    if (asked(r3)) {
      log(`③ B row tooltip: ${JSON.stringify(tip3)}; ④ faded tooltip: ${JSON.stringify(missed4)}; window focus while answering from A: ${focus4}`)
      expect(tip3).toContain(tower.title!)
      expect(tip3).toMatch(QUESTION_TIP)
      expect(tip3).not.toContain(QUESTION)
      results['③'] = `PASS — "Open Claude as Tower" tab AskUserQuestion → question → B row ⚠️ (target ${tower.id}), tooltip has the tab and the reason, not the question; answered → cleared`
      // ④ look at the Tower tab with window focus → the faded mark goes
      await selectWorkspace(WS_B)
      await thumbOf(win, tower.title!).click()
      const focusLook = await focusWindow()
      await expect(thumbOf(win, tower.title!).locator('.attention-badge.missed')).toHaveCount(focusLook ? 0 : 1, { timeout: 15_000 })
      await selectWorkspace(WS_A)
      await expect(rowBadge).toHaveCount(focusLook ? 0 : 1, { timeout: 15_000 })
      results['④'] = `PASS — answered through the PTY while A was looked at (focus ${focus4}) → B row faded ⚠️ ("${missed4}"); B + the Tower tab selected with focus=${focusLook} → ${focusLook ? 'faded mark cleared, B row empty' : 'still faded (no window focus)'}`
    } else {
      results['③'] = `NOT COVERED — no AskUserQuestion (${stopped || `hooks ${JSON.stringify(r3?.hooks)}`}); turns typed ${turns.length}`
      results['④'] = 'NOT COVERED — depends on ③'
    }

    // ── logs: never a command / question text, never a token ──
    const debug = debugLog()
    expect(debug).not.toContain(SECRET)
    expect(debug).not.toContain(QUESTION)
    expect(debug).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    const scriptsLog = fs.readFileSync(path.join(userData, 'Logs', 'bat-scripts.log'), 'utf8')
    expect(scriptsLog).not.toContain(SECRET)
    expect(scriptsLog).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    for (const t of [cli, tower]) log(`${t.title} [blocked] lines: ${logLines(t.id, '[blocked]').map(l => l.replace(/^.*?\[blocked\]/, '[blocked]')).join(' / ')}`)
  } finally {
    // ── usage from the transcripts (read before they are removed) ──
    const usage = readUsage()
    for (const [i, t] of turns.entries()) {
      const rows = usage.filter(r => r.ts >= t.start - 1_000 && r.ts <= (t.end || Date.now()) + 5_000 && r.file)
      const sum = (f: keyof UsageRow) => rows.reduce((s, r) => s + (Number(r[f]) || 0), 0)
      log(`turn ${i + 1} ${t.label} (${t.tab}): models ${JSON.stringify([...new Set(rows.map(r => r.model))])}, API calls ${rows.length}, in ${sum('input')} / cache read ${sum('cacheRead')} / cache write ${sum('cacheWrite5m') + sum('cacheWrite1h')} / out ${sum('output')}, est US$${totalCost(rows).toFixed(5)}`)
    }
    const byModel: Record<string, number> = {}
    for (const r of usage) byModel[r.model] = (byModel[r.model] ?? 0) + 1
    for (const m of Object.keys(byModel)) if (FORBIDDEN_MODEL.test(m)) log(`⚠ a forbidden model in the transcripts: ${m}`)
    log(`transcripts: ${usage.length} assistant API calls by model ${JSON.stringify(byModel)}; estimated total US$${totalCost(usage).toFixed(5)} (Haiku 5.5 prices from src/lib/model-pricing.ts; auto-mode classifier requests are not in the transcripts)`)
    if (inst) await closeIsolated(inst, log)
    if (stopped) log(`⛔ stopped: ${stopped}`)
    for (const [k, v] of Object.entries(results)) log(`${k} ${v}`)
    if (autoRows.length) log(`② auto mode:\n| action | claude asked | PermissionRequest hook | B row | effect | turn |\n|---|---|---|---|---|---|\n${autoRows.join('\n')}`)
    log(`turns typed: ${turns.length}`)
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    log(`workspace folders removed: ${!fs.existsSync(root)}`)
    const sessions = claudeProjectDirs()
    for (const name of sessions) fs.rmSync(path.join(projectsDir(), name), { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    log(`removed ${sessions.length} ~/.claude/projects folder(s) matching bat-e2e-${RUN_TAG}; left: ${claudeProjectDirs().length}`)
    log(`T0747 spec took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  }
  expect(stopped).toBe('')
})
