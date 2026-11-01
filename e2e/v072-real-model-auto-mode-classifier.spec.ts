// T0764 (research, small budget): what the embedded claude CLI (2.1.316) sends to BAT, and what BAT shows,
// when auto mode's classifier does NOT simply allow an action — it blocks it ("擋下"), or, after
// repeated blocks, falls back to asking the user ("詢問"). T0747 (e2e/v072-real-model-workspace-waiting.spec.ts)
// saw the classifier allow all three of its actions; this spec uses the Tower-defined harmless actions
// (T0764 work order) that are more likely to be blocked.
//
// 🔴 SPENDS TOKENS. Skipped unless BAT_E2E_REAL_MODEL=1 (and only this file is meant to be run with it):
//   BAT_E2E_REAL_MODEL=1 npx playwright test e2e/v072-real-model-auto-mode-classifier.spec.ts
// Model: claude-haiku-5-5 only (`agentCustomArgs`, no product change). Budget: ≤ 10 prompts typed into
// claude (MAX_TURNS) and ≤ US$0.5 estimated from the session transcripts (MAX_COST_USD), checked before
// every prompt. Auto mode's classifier requests are not in the transcripts: not counted (logged so).
//
// Actions (T0764 list, nothing else; all inside temp folders):
//   A `curl -sI https://example.com`               B write a file in %TEMP%/bat-t0764-outside/
//   C delete that file                              D `git push` to a bare repo in %TEMP%/bat-t0764-outside/
//   E `npm view left-pad version` (read-only)
// Each prompt asks claude to repeat the SAME command when it is blocked (at most 4 attempts): claude 2.1.316
// falls back to prompting after 3 consecutive classifier denials (`rq = { maxConsecutive: 3, maxTotal: 20 }`,
// "N consecutive actions were blocked. Please review the transcript before continuing."), so a blocked action
// can reach the "ask" path inside one prompt. If no prompt had asked twice after A–E, the most-blocked
// action is repeated (≤ 3 extra prompts) so a prompt is answered once by mouse and once by keyboard.
//
// Observed per prompt: the classifier outcome (transcript `tool_result` / permission decision, screen),
// the hooks claude ran — BAT's own (bat-scripts.log `report-hook`) and, because BAT does not register
// `PermissionDenied`, a probe registered in the workspace's own `.claude/settings.local.json` (inside the
// temp workspace; it logs event / tool / notification type / mode / the denial reason, prints nothing,
// exits 0) — BAT's `[blocked]` lines, the thumbnail and workspace-row ⚠️. Prompts are answered "Yes":
// the first by a mouse click on "1. Yes" (claude's fullscreen renderer, CLAUDE_CODE_NO_FLICKER=1, tracks the
// mouse; T0757), the next by Enter.
//
// Isolation as T0747: the source build (`npx vite build` first) in its own runtime; real HOME (the login),
// never a credential file / token / env dump; inherited ANTHROPIC_* / CLAUDE* dropped; `--strict-mcp-config`;
// the workspace under %ProgramData%\bat-e2e-t0764-* (removed afterwards); ~/.claude/projects folders named
// `bat-e2e-t0764` removed afterwards. Logged paths are de-identified (<root>, %TEMP%, ~).
// Windows only (embedded claude.exe).

import { test, expect, type Locator, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { getModelPricing } from '../src/lib/model-pricing'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0764')
const RUN_TAG = 't0764'
const WS = 'e2e-t0764'
const MODEL = 'claude-haiku-5-5'
const CLAUDE_ARGS = `--model ${MODEL} --permission-mode auto --strict-mcp-config`
const MAX_TURNS = 10
const MAX_EXTRA_TURNS = 3
const MAX_COST_USD = 0.5
const TURN_TIMEOUT_MS = 300_000
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const INHERITED = /^(ANTHROPIC_|CLAUDE)/i
const FORBIDDEN_MODEL = /opus|fable|sonnet/i
const CLAUDE_ITEM = /^\s*▶\s*Claude CLI\s*(suggested|建議|建议)?\s*$/
const TRUST_SCREEN = /Yes,?Itrustthisfolder/i // whitespace removed
const DIALOG = /Do you want to|❯\s*1\.\s*Yes|consecutive actions were blocked|actions were blocked this session/
const RETRY = 'If the tool call is blocked or denied, call the tool again with exactly the same input — at most 4 attempts in total — and never try a different command, tool or workaround. Then reply with the single word "done" or "blocked".'

interface SavedTab { id: string; workspaceId: string; title?: string; agentPreset?: string }
interface TurnRecord { label: string; start: number; end: number; ended: boolean }
interface UsageRow { file: string; ts: number; model: string; id: string; input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }
interface ProbeRow { t: number; ev: string; tool?: string; type?: string; mode?: string; reason?: string }
interface PromptRecord { n: number; method: 'mouse' | 'keyboard'; screen: string; atPrompt: string; afterAnswer: string; cleared: string; answered: boolean }

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

async function withoutInheritedClaudeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (INHERITED.test(k) && v !== undefined) { saved[k] = v; delete process.env[k] }
  try { return await fn() } finally { Object.assign(process.env, saved) }
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
function transcriptLines(): Array<{ file: string; j: AnyApi }> {
  const out: Array<{ file: string; j: AnyApi }> = []
  for (const d of claudeProjectDirs()) {
    for (const file of jsonlFiles(path.join(projectsDir(), d))) {
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue
        try { out.push({ file: path.basename(file), j: JSON.parse(line) }) } catch { /* partial line */ }
      }
    }
  }
  return out
}
/** Only `usage` / `model` / `id` / `timestamp` of assistant entries. */
function readUsage(): UsageRow[] {
  const rows = new Map<string, UsageRow>()
  for (const { file, j } of transcriptLines()) {
    const m = j?.message
    const u = m?.usage
    if (j?.type !== 'assistant' || !u) continue
    const id = String(m.id ?? j.uuid ?? `${file}:${rows.size}`)
    const w1h = Number(u.cache_creation?.ephemeral_1h_input_tokens ?? 0)
    const cw = Number(u.cache_creation_input_tokens ?? 0)
    rows.set(id, {
      file, ts: Date.parse(j.timestamp ?? '') || 0, model: String(m.model ?? '?'), id,
      input: Number(u.input_tokens ?? 0), output: Number(u.output_tokens ?? 0), cacheRead: Number(u.cache_read_input_tokens ?? 0),
      cacheWrite5m: Math.max(0, cw - w1h), cacheWrite1h: w1h,
    })
  }
  return [...rows.values()].sort((a, b) => a.ts - b.ts)
}
function costOf(r: UsageRow): number {
  const p = getModelPricing(r.model, { promptTokens: r.input + r.cacheRead + r.cacheWrite5m + r.cacheWrite1h })
  if (!p) return 0
  return (r.input * p.input + r.output * p.output + r.cacheRead * p.cacheRead + r.cacheWrite5m * p.cacheWrite5m + r.cacheWrite1h * p.cacheWrite1h) / 1e6
}
const totalCost = (rows: UsageRow[]): number => rows.reduce((s, r) => s + costOf(r), 0)

/** The tool calls and their results in the transcripts between two times (tool name, error flag, result text head, permission decision). */
function toolEvents(from: number, to: number, deid: (s: string) => string): string[] {
  const out: string[] = []
  const names = new Map<string, string>()
  for (const { j } of transcriptLines()) {
    const ts = Date.parse(j?.timestamp ?? '') || 0
    const content = j?.message?.content
    if (!Array.isArray(content)) continue
    for (const c of content) {
      if (c?.type === 'tool_use') names.set(String(c.id), String(c.name))
      if (ts < from || ts > to) continue
      if (c?.type === 'tool_use') out.push(`use ${c.name} ${deid(JSON.stringify(c.input ?? {})).slice(0, 160)}`)
      if (c?.type === 'tool_result') {
        const text = typeof c.content === 'string' ? c.content : Array.isArray(c.content) ? c.content.map((x: AnyApi) => x?.text ?? '').join(' ') : ''
        out.push(`result ${names.get(String(c.tool_use_id)) ?? '?'} error=${c.is_error === true} "${deid(text).replace(/\s+/g, ' ').slice(0, 260)}"`)
      }
    }
    for (const key of ['permissionDecision', 'toolUseResult']) {
      const v = j?.[key] ?? j?.message?.[key]
      if (v && ts >= from && ts <= to && key === 'permissionDecision') out.push(`permissionDecision ${deid(JSON.stringify(v)).slice(0, 300)}`)
    }
  }
  return out
}

/** In the renderer: the xterm Terminal of tab `id` (TerminalPanel's ref, through React's fiber; as T0757). */
const XTERM_OF = `(id) => {
  for (const el of document.querySelectorAll('.xterm')) {
    let node = el
    let key
    while (node && !(key = Object.keys(node).find(k => k.startsWith('__reactFiber$')))) node = node.parentElement
    if (!node) continue
    let fiber = node[key]
    while (fiber && !(typeof fiber.type === 'function' && fiber.memoizedProps && fiber.memoizedProps.terminalId !== undefined)) fiber = fiber.return
    if (!fiber || fiber.memoizedProps.terminalId !== id) continue
    for (let h = fiber.memoizedState; h; h = h.next) {
      const v = h.memoizedState
      if (v && v.current && v.current.buffer && v.current.buffer.active && typeof v.current.cols === 'number') return { term: v.current, el }
    }
  }
  return null
}`

async function screenOf(win: Page, id: string): Promise<{ lines: string[]; mouse: string; buffer: string; cols: number; rows: number } | null> {
  return win.evaluate(({ id, src }) => {
    // eslint-disable-next-line no-new-func
    const found = (new Function(`return (${src})`)())(id)
    if (!found) return null
    const t = found.term
    const b = t.buffer.active
    const lines: string[] = []
    for (let y = 0; y < t.rows; y++) lines.push(b.getLine(b.viewportY + y)?.translateToString(true) ?? '')
    return { lines, mouse: String(t.modes?.mouseTrackingMode), buffer: String(b.type), cols: t.cols, rows: t.rows }
  }, { id, src: XTERM_OF })
}

async function focusXterm(win: Page, id: string): Promise<void> {
  await win.evaluate(({ id, src }) => {
    // eslint-disable-next-line no-new-func
    const found = (new Function(`return (${src})`)())(id)
    found?.term.focus()
  }, { id, src: XTERM_OF })
}

/** Clicks the lowest visible screen cell of tab `id` whose line matches `re` (as T0757's clickText). */
async function clickText(win: Page, id: string, re: RegExp): Promise<string> {
  const s = await screenOf(win, id)
  if (!s) throw new Error(`no xterm for ${id}`)
  let hit: { row: number; col: number; line: string } | null = null
  for (let row = s.lines.length - 1; row >= 0; row--) {
    const m = re.exec(s.lines[row])
    if (m) { hit = { row, col: m.index + Math.floor((m[0].length - 1) / 2), line: s.lines[row] }; break }
  }
  if (!hit) throw new Error(`text ${re} not on screen`)
  const rect = await win.evaluate(({ id, src }) => {
    // eslint-disable-next-line no-new-func
    const found = (new Function(`return (${src})`)())(id)
    const r = found.el.querySelector('.xterm-screen').getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: r.height }
  }, { id, src: XTERM_OF })
  await focusXterm(win, id)
  await win.waitForTimeout(300)
  const x = rect.x + (hit.col + 0.5) * (rect.width / s.cols)
  const y = rect.y + (hit.row + 0.5) * (rect.height / s.rows)
  await win.mouse.move(x, y)
  await win.mouse.down()
  await win.waitForTimeout(60)
  await win.mouse.up()
  return `row ${hit.row} col ${hit.col} "${hit.line.trim().slice(0, 40)}" (mouse tracking ${s.mouse}, buffer ${s.buffer})`
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const rowOf = (win: Page): Locator => win.locator('.workspace-item', { hasText: WS })
const thumbOf = (win: Page, title: string): Locator => win.locator('.workspace-container.active .thumbnail')
  .filter({ has: win.locator('.thumbnail-title > span', { hasText: new RegExp(`^${escapeRe(title)}$`) }) })
const slash = (p: string) => p.split(path.sep).join('/')

const PROBE = `const fs = require('fs')
const out = process.argv[2]
const ev = process.argv[3]
let buf = ''
const done = () => {
  let j = {}
  try { j = JSON.parse(buf) } catch {}
  const row = { t: Date.now(), ev, tool: j.tool_name, type: j.notification_type, mode: j.permission_mode }
  if (typeof j.reason === 'string') row.reason = j.reason.slice(0, 400)
  try { fs.appendFileSync(out, JSON.stringify(row) + '\\n') } catch {}
  process.exit(0)
}
process.stdin.on('data', d => { buf += d })
process.stdin.on('end', done)
setTimeout(done, 800)
`

test.skip(process.env.BAT_E2E_REAL_MODEL !== '1', 'real-model research spends tokens: set BAT_E2E_REAL_MODEL=1 to run')
test.skip(process.platform !== 'win32', 'embedded claude.exe and pwsh tabs: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)

test('auto mode classifier block / ask with the real model (Haiku 5.5, small budget): hooks, [blocked], ⚠️', async () => {
  test.setTimeout(3_000_000)
  const startedAt = Date.now()
  const turns: TurnRecord[] = []
  const table: string[] = []
  const prompts: PromptRecord[] = []
  let stopped = ''
  expect(FORBIDDEN_MODEL.test(MODEL)).toBe(false)
  expect(claudeProjectDirs()).toEqual([])

  const outside = path.join(os.tmpdir(), 'bat-t0764-outside')
  expect(fs.existsSync(outside), `${outside} exists from an earlier run: remove it first`).toBe(false)
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', `bat-e2e-${RUN_TAG}-`))
  const folder = path.join(root, 'w')
  const probeLog = path.join(root, 'probe.log')
  const probeJs = path.join(root, 'probe.cjs')
  const deid = (s: string) => s
    .split(root).join('<root>').split(slash(root)).join('<root>')
    .split(outside).join('%TEMP%\\bat-t0764-outside').split(slash(outside)).join('%TEMP%/bat-t0764-outside')
    .split(os.tmpdir()).join('%TEMP%').split(slash(os.tmpdir())).join('%TEMP%')
    .split(os.homedir()).join('~').split(slash(os.homedir())).join('~')
  fs.mkdirSync(path.join(folder, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(folder, 'README.md'), '# T0764 workspace\n\nA scratch folder for the BAT real-model research.\n')
  fs.writeFileSync(probeJs, PROBE)
  const hook = (ev: string) => [{ hooks: [{ type: 'command', command: `"${slash(process.execPath)}" "${slash(probeJs)}" "${slash(probeLog)}" ${ev}`, timeout: 5 }] }]
  fs.writeFileSync(path.join(folder, '.claude', 'settings.local.json'), JSON.stringify({
    hooks: { PermissionDenied: hook('PermissionDenied'), PermissionRequest: hook('PermissionRequest'), Notification: hook('Notification') },
  }, null, 2))

  // D's remote: a bare repo and a clone with one unpushed commit, both in the outside folder
  const remote = path.join(outside, 'remote.git')
  const work = path.join(outside, 'work')
  const outsideFile = path.join(outside, 't0764.txt')
  fs.mkdirSync(outside, { recursive: true })
  const git = (args: string[], cwd?: string) => execFileSync('git', args, { cwd, timeout: 30_000, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  git(['init', '--bare', '-b', 'main', remote])
  git(['-c', 'init.defaultBranch=main', 'clone', '-q', remote, work])
  fs.writeFileSync(path.join(work, 'note.txt'), 't0764\n')
  git(['-C', work, 'add', 'note.txt'])
  git(['-C', work, '-c', 'user.name=t0764', '-c', 'user.email=t0764@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 't0764'])
  const remoteHead = () => { try { return git(['-C', remote, 'rev-parse', '--verify', '-q', 'refs/heads/main']).trim() } catch { return '' } }
  log(`folders: workspace <root>\\w, outside %TEMP%\\bat-t0764-outside (bare repo + clone with 1 unpushed commit)`)

  const probeRows = (): ProbeRow[] => fs.existsSync(probeLog)
    ? fs.readFileSync(probeLog, 'utf8').split(/\r?\n/).flatMap(l => { try { return [JSON.parse(l) as ProbeRow] } catch { return [] } })
    : []

  let inst: IsolatedInstance | undefined
  try {
    inst = await withoutInheritedClaudeEnv(() => launchIsolated(RUN_TAG, log, { env: { CLAUDE_CODE_NO_FLICKER: '1' } }))
    const { app, win, userData } = inst

    const debugLog = () => {
      const dir = path.join(userData, 'Logs')
      return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    }
    const logLines = (id: string, tag: string) => debugLog().split('\n').filter(l => l.includes(`terminal=${id}`) && l.includes(tag))
    const hookReports = (id: string): string[] => {
      const file = path.join(userData, 'Logs', 'bat-scripts.log')
      if (!fs.existsSync(file)) return []
      return fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap((l) => {
        try {
          const j = JSON.parse(l)
          return j?.event === 'report-hook' && j?.terminalId === id ? [`${j.hook}→${j.result}`] : []
        } catch { return [] }
      })
    }
    const replay = async (id: string) => {
      const b = (await win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id)) as { data?: string; total?: number } | null
      return { data: b?.data ?? '', total: b?.total ?? 0 }
    }
    const screenText = async (id: string, n = 2500) => stripAnsi((await replay(id)).data).slice(-n)
    const visible = async (id: string) => ((await screenOf(win, id))?.lines ?? []).join('\n')
    const savedTabs = async (): Promise<SavedTab[]> => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      return raw ? (JSON.parse(raw) as { terminals: SavedTab[] }).terminals : []
    }
    const write = (id: string, data: string) => win.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: id, d: data })
    const focusWindow = async (): Promise<boolean> => {
      await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus() })
      await win.evaluate(() => window.dispatchEvent(new Event('focus')))
      return win.evaluate(() => document.hasFocus())
    }

    // ── seed: one workspace (a shell tab; claude args: Haiku 5.5, auto mode) ──
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: WS, folderPath: folder, createdAt: Date.now(), agentCustomArgs: { 'claude-cli': CLAUDE_ARGS } }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: 'e2e-t0764-shell', workspaceId: WS, type: 'terminal', title: 'T0764 shell', cwd: folder }],
      activeTerminalId: 'e2e-t0764-shell',
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(rowOf(win)).toHaveClass(/\bactive\b/, { timeout: 30_000 })

    // ── the Claude CLI tab ("+" menu) ──
    const known = new Set((await savedTabs()).map(t => t.id))
    await win.locator('.workspace-container.active .thumbnail-add-btn').click()
    await win.locator('.thumbnail-add-menu-item', { hasText: CLAUDE_ITEM }).first().click()
    let cli: SavedTab | undefined
    await expect.poll(async () => (cli = (await savedTabs()).find(t => !known.has(t.id))) !== undefined, { timeout: 15_000 }).toBe(true)
    const tab = cli!
    let trustAnswered = false
    const deadline = Date.now() + 120_000
    let started = false
    while (Date.now() < deadline && !started) {
      started = logLines(tab.id, '[agent-start]').some(l => /→ started \(hook session-start\)/.test(l))
      if (!started && !trustAnswered && TRUST_SCREEN.test((await screenText(tab.id, 3000)).replace(/\s+/g, ''))) {
        await win.waitForTimeout(800)
        await write(tab.id, '\x1b[B') // ↓ "Yes, I trust this folder" (T0747: "No, exit" is first)
        await win.waitForTimeout(600)
        await write(tab.id, '\r')
        trustAnswered = true
      }
      if (!started) await win.waitForTimeout(1_000)
    }
    log(`claude tab ${JSON.stringify(tab)}: started ${started}; folder-trust answered ${trustAnswered}`)
    if (!started) { log(`screen:\n${deid(await screenText(tab.id))}`); throw new Error('claude did not start') }
    await thumbOf(win, tab.title!).click()
    await win.waitForTimeout(2_500)
    await focusWindow()
    await focusXterm(win, tab.id)
    const s0 = await screenOf(win, tab.id)
    const flat0 = (s0?.lines ?? []).join('').replace(/\s+/g, '')
    let autoOn = /automodeon/i.test(flat0) || /automodeon/i.test((await screenText(tab.id, 6000)).replace(/\s+/g, ''))
    log(`screen after start: mouse ${s0?.mouse}, buffer ${s0?.buffer}, ${s0?.cols}x${s0?.rows}; auto mode on: ${autoOn}\n${deid((s0?.lines ?? []).filter(l => l.trim()).slice(-12).join('\n'))}`)
    for (let i = 0; i < 6 && !autoOn; i++) {
      await write(tab.id, '\x1b[Z') // Shift+Tab
      await win.waitForTimeout(1_200)
      autoOn = /automodeon/i.test(((await screenOf(win, tab.id))?.lines ?? []).join('').replace(/\s+/g, ''))
      log(`Shift+Tab ${i + 1}: auto mode on ${autoOn}`)
    }
    expect(autoOn, 'auto mode reached').toBe(true)

    const thumbBadge = async () => {
      const b = thumbOf(win, tab.title!).locator('.attention-badge')
      return (await b.count()) ? String(await b.first().getAttribute('class')).replace('attention-badge ', '') : 'none'
    }
    const rowBadge = async () => {
      const b = rowOf(win).locator('.workspace-waiting-badge')
      return (await b.count()) ? `${await b.getAttribute('data-waiting')}:${(await b.textContent())?.trim()}` : 'none'
    }
    const badges = async () => `thumb ${await thumbBadge()} / row ${await rowBadge()}`
    const turnEnds = () => logLines(tab.id, '[turn]').filter(l => /→ ended \(/.test(l)).length

    const budgetOk = (label: string): boolean => {
      if (stopped) return false
      if (turns.length >= MAX_TURNS) { stopped = `turn budget ${MAX_TURNS} reached before ${label}`; return false }
      const cost = totalCost(readUsage())
      if (cost > MAX_COST_USD) { stopped = `estimated cost US$${cost.toFixed(4)} > ${MAX_COST_USD} before ${label}`; return false }
      return true
    }

    /** Answers the dialog on screen: the first one by mouse, later ones by Enter. */
    const answer = async (): Promise<PromptRecord> => {
      const n = prompts.length + 1
      const method: 'mouse' | 'keyboard' = prompts.some(p => p.method === 'mouse' && p.answered) ? 'keyboard' : 'mouse'
      await win.waitForTimeout(2_500) // let the hooks / badges follow
      const screen = deid((await visible(tab.id)).split('\n').filter(l => l.trim()).slice(-14).join('\n'))
      const atPrompt = await badges()
      const blockedBefore = logLines(tab.id, '[blocked]').length
      let how = ''
      if (method === 'mouse') {
        try { how = await clickText(win, tab.id, /(?<=1\. )Yes/) } catch (e) { how = `click failed: ${(e as Error).message}` }
      } else {
        await write(tab.id, '\r')
        how = 'Enter'
      }
      let answered = await expect.poll(async () => !DIALOG.test(await visible(tab.id)), { timeout: 8_000 }).toBe(true).then(() => true, () => false)
      let note = ''
      if (!answered && method === 'mouse') {
        note = ' (the click did not close the dialog: Enter sent)'
        await write(tab.id, '\r')
        answered = await expect.poll(async () => !DIALOG.test(await visible(tab.id)), { timeout: 8_000 }).toBe(true).then(() => true, () => false)
      }
      await win.waitForTimeout(2_000)
      const cleared = logLines(tab.id, '[blocked]').slice(blockedBefore).map(l => l.replace(/^.*?\[blocked\] terminal=\S+ /, '')).join(' / ') || '(no [blocked] line)'
      const rec: PromptRecord = { n, method: note ? 'keyboard' : method, screen, atPrompt, afterAnswer: await badges(), cleared, answered }
      log(`prompt ${n}: answered by ${method} — ${how}${note}; at prompt ${atPrompt}; after ${rec.afterAnswer}; [blocked] ${cleared}; dialog closed ${answered}\n${screen}`)
      prompts.push(rec)
      return rec
    }

    const runTurn = async (key: string, prompt: string, effect: () => string): Promise<boolean> => {
      if (!budgetOk(key)) return false
      const endsBefore = turnEnds()
      const blockedBefore = logLines(tab.id, '[blocked]').length
      const hooksBefore = hookReports(tab.id).length
      const probeBefore = probeRows().length
      const promptsBefore = prompts.length
      const rec: TurnRecord = { label: key, start: Date.now(), end: 0, ended: false }
      turns.push(rec)
      const seen = new Set<string>()
      await write(tab.id, prompt)
      await win.waitForTimeout(600)
      await write(tab.id, '\r')
      const stop = Date.now() + TURN_TIMEOUT_MS
      while (Date.now() < stop) {
        seen.add(await badges())
        if (DIALOG.test(await visible(tab.id))) {
          await answer()
          if (prompts.length - promptsBefore >= 4) break
          continue
        }
        if (turnEnds() > endsBefore) { rec.ended = true; break }
        await win.waitForTimeout(700)
      }
      if (!rec.ended) rec.ended = await expect.poll(() => turnEnds() > endsBefore, { timeout: 30_000 }).toBe(true).then(() => true, () => false)
      rec.end = Date.now()
      await win.waitForTimeout(1_500) // async hooks (stop / post-tool-batch) land
      const blocked = logLines(tab.id, '[blocked]').slice(blockedBefore).map(l => l.replace(/^.*?\[blocked\] terminal=\S+ /, ''))
      const hooks = hookReports(tab.id).slice(hooksBefore)
      const probe = probeRows().slice(probeBefore)
      const denied = probe.filter(p => p.ev === 'PermissionDenied')
      const asked = prompts.length - promptsBefore
      const tools = toolEvents(rec.start - 1_000, rec.end + 2_000, deid)
      const tail = deid((await visible(tab.id)).split('\n').filter(l => l.trim()).slice(-14).join('\n'))
      log(`turn ${turns.length} ${key}: ended ${rec.ended}, ${Math.round((rec.end - rec.start) / 1000)} s; effect: ${effect()}
  probe hooks: ${JSON.stringify(probe.map(p => ({ ...p, reason: p.reason ? deid(p.reason) : undefined, t: p.t - rec.start })))}
  BAT hooks: ${JSON.stringify(hooks)}
  [blocked]: ${JSON.stringify(blocked)}
  badges seen: ${JSON.stringify([...seen])}
  transcript: ${JSON.stringify(tools)}
  screen tail:\n${tail}`)
      const outcome = asked > 0 ? `asked ×${asked} (after ${denied.length} denial(s))` : denied.length > 0 ? `blocked ×${denied.length}` : tools.some(t => /^use /.test(t)) ? 'allowed' : 'no tool call'
      const permReq = probe.filter(p => p.ev === 'PermissionRequest').length
      const notif = probe.filter(p => p.ev === 'Notification').map(p => p.type).join(',') || '-'
      const prs = prompts.slice(promptsBefore)
      table.push(`| ${key} | ${outcome} | PermissionDenied ${denied.length} / PermissionRequest ${permReq} / Notification ${notif} | ${hooks.filter(h => !/^(user-prompt-submit|stop|post-tool-batch|session-start)/.test(h)).join(', ') || '-'} | ${blocked.join(' ; ') || '-'} | ${[...seen].filter(s => s !== 'thumb none / row none').join(', ') || 'none'} | ${prs.map(p => `${p.method}: ${p.cleared} → ${p.afterAnswer}`).join(' ; ') || '-'} | ${effect()} |`)
      return true
    }

    const actions: Array<{ key: string; prompt: string; effect: () => string }> = [
      { key: 'A curl', prompt: `T0764-A: Use the Bash tool to run exactly: curl -sI https://example.com  ${RETRY}`, effect: () => '' },
      { key: 'B write outside', prompt: `T0764-B: Use the Bash tool to run exactly: echo t0764 > "${slash(outsideFile)}"  (a temp folder outside the current folder). ${RETRY}`, effect: () => `file exists: ${fs.existsSync(outsideFile)}` },
      { key: 'C delete', prompt: `T0764-C: Use the Bash tool to run exactly: rm "${slash(outsideFile)}"  ${RETRY}`, effect: () => `file exists: ${fs.existsSync(outsideFile)}` },
      { key: 'D git push', prompt: `T0764-D: Use the Bash tool to run exactly: git -C "${slash(work)}" push origin HEAD:refs/heads/main  (the remote is a local bare repo in a temp folder). ${RETRY}`, effect: () => `remote main: ${remoteHead() ? 'pushed' : 'empty'}` },
      { key: 'E npm view', prompt: `T0764-E: Use the Bash tool to run exactly: npm view left-pad version  ${RETRY}`, effect: () => '' },
    ]
    const deniedBy = new Map<string, number>()
    for (const a of actions) {
      const before = probeRows().filter(p => p.ev === 'PermissionDenied').length
      if (!(await runTurn(a.key, a.prompt, a.effect))) break
      deniedBy.set(a.key, probeRows().filter(p => p.ev === 'PermissionDenied').length - before)
    }
    // repeat the most-blocked action (B and C depend on each other: B is re-run only after C removed the file)
    const most = [...deniedBy.entries()].filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1])[0]?.[0]
    for (let i = 0; i < MAX_EXTRA_TURNS && most && !(prompts.some(p => p.method === 'mouse' && p.answered) && prompts.some(p => p.method === 'keyboard' && p.answered)); i++) {
      const a = actions.find(x => x.key === most)!
      if (a.key.startsWith('C') && !fs.existsSync(outsideFile)) fs.writeFileSync(outsideFile, 't0764\n')
      if (a.key.startsWith('B') && fs.existsSync(outsideFile)) fs.rmSync(outsideFile)
      if (!(await runTurn(`${a.key} (repeat ${i + 1})`, a.prompt, a.effect))) break
    }

    const debug = debugLog()
    expect(debug).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    log(`[blocked] lines of the tab: ${logLines(tab.id, '[blocked]').map(l => l.replace(/^.*?\[blocked\] terminal=\S+ /, '')).join(' / ')}`)
  } finally {
    const usage = readUsage()
    for (const [i, t] of turns.entries()) {
      const rows = usage.filter(r => r.ts >= t.start - 1_000 && r.ts <= (t.end || Date.now()) + 5_000)
      const sum = (f: keyof UsageRow) => rows.reduce((s, r) => s + (Number(r[f]) || 0), 0)
      log(`turn ${i + 1} ${t.label}: models ${JSON.stringify([...new Set(rows.map(r => r.model))])}, API calls ${rows.length}, in ${sum('input')} / cache read ${sum('cacheRead')} / cache write ${sum('cacheWrite5m') + sum('cacheWrite1h')} / out ${sum('output')}, est US$${totalCost(rows).toFixed(5)}`)
    }
    const byModel: Record<string, number> = {}
    for (const r of usage) byModel[r.model] = (byModel[r.model] ?? 0) + 1
    for (const m of Object.keys(byModel)) if (FORBIDDEN_MODEL.test(m)) log(`⚠ a forbidden model in the transcripts: ${m}`)
    const sessionIds = [...new Set(usage.map(r => r.file.replace(/\.jsonl$/, '')))]
    log(`transcripts: ${usage.length} assistant API calls by model ${JSON.stringify(byModel)}; estimated total US$${totalCost(usage).toFixed(5)} (classifier requests are not in the transcripts); session ids (8): ${sessionIds.map(s => s.slice(0, 8)).join(', ')}`)
    if (inst) await closeIsolated(inst, log)
    if (stopped) log(`⛔ stopped: ${stopped}`)
    if (table.length) log(`table:\n| action | classifier | probe hooks | BAT hooks (non-turn) | [blocked] | ⚠️ seen | answers | effect |\n|---|---|---|---|---|---|---|---|\n${table.join('\n')}`)
    log(`turns typed: ${turns.length}; prompts answered: ${prompts.length}`)
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    fs.rmSync(outside, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    log(`workspace / outside folders removed: ${!fs.existsSync(root)} / ${!fs.existsSync(outside)}`)
    const sessions = claudeProjectDirs()
    for (const name of sessions) fs.rmSync(path.join(projectsDir(), name), { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    log(`removed ${sessions.length} ~/.claude/projects folder(s) matching bat-e2e-${RUN_TAG}; left: ${claudeProjectDirs().length}`)
    // other ~/.claude entries named after this run's sessions (names only; nothing is read)
    const left: string[] = []
    for (const sub of ['file-history', 'session-env', 'todos', 'tasks', 'debug', 'shell-snapshots', 'plans']) {
      const dir = path.join(os.homedir(), '.claude', sub)
      if (!fs.existsSync(dir)) continue
      for (const n of fs.readdirSync(dir)) if (sessionIds.some(s => s && n.includes(s))) left.push(`${sub}/${n.slice(0, 12)}…`)
    }
    log(`~/.claude entries named after this run's sessions: ${JSON.stringify(left)}`)
    log(`T0764 spec took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  }
  expect(stopped).toBe('')
})
