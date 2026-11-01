// T0736 (v0.7.2-pre.8 automated acceptance of T0735 / D200–D203): the workspace "waiting for you" ⚠️
// raised by REAL agents — the embedded claude CLI's own hooks and the embedded codex TUI's own OSC 7501 —
// instead of a script calling `bat-hook.mjs` (that is e2e/t0735-workspace-waiting-badge.spec.ts).
//
// No token is spent and nothing leaves the machine:
//   - claude talks to fixtures/fake-anthropic-api.ts (ANTHROPIC_BASE_URL, a fake key it never checks,
//     CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1), codex to a fake OpenAI Responses API in this file
//     (its own temp CODEX_HOME/config.toml, as t0621 / t0728);
//   - HTTPS_PROXY / HTTP_PROXY → a proxy that refuses and records everything (NO_PROXY=127.0.0.1);
//   - USERPROFILE / HOME → a temp home whose `.claude.json` pre-answers claude's first-run screens
//     (onboarding, folder trust, the custom API key); inherited ANTHROPIC_* / CLAUDE* / OPENAI_* / CODEX_*
//     variables are dropped. The workspace folders live under %ProgramData% (as T0727): claude loads every
//     ancestor's CLAUDE.md, a folder under the user profile would read the user's own.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Two workspaces:
// A (looked at) and B (holds the agent tabs); the checks read B's row while A is active.
//
//   ① B: a Claude CLI tab opened from the "+" menu (default permission mode); the fake answers a Bash
//      tool_use → claude's own PermissionRequest hook → B's row ⚠️, tooltip = the tab + the permission
//      reason, never the command
//   ② B: an "Open Claude as Tower" tab (launchRole tower); the fake answers AskUserQuestion → `question`
//      → B's row ⚠️ 2
//   ③ B: a Codex CLI tab opened from the "+" menu (not a helper dispatch, `-a on-request -s read-only`);
//      the fake answers an escalated exec_command → approval prompt → OSC 7501 blocked → `input` → ⚠️ 3
//   ④ B: a claude Worker dispatched by B's shell tab (`--skill ct-exec --workorder T0736`; a project
//      skill in B's folder carries the fake's scenario tag) blocks on a Bash permission → ⚠️ 4; its own
//      tab badge is ⚠️ and the Tower's "Close reported Worker tabs (N)" stays 0 (T0609 unchanged)
//   ⑥ (while ①–④ wait) the sidebar on the 塔台 tab → the 工作區 tab title shows ⚠️ 4; collapsed → the bar
//      shows ⚠️ 4, its click expands the sidebar
//   ⑤ a click on B's ⚠️ 4 (B's own workspace tab bar left on another tab first) → B active, the tab
//      waiting longest (①) selected, B's terminal tab shown
//   then every wait is answered in its tab (claude: Enter on the prompt / the question; codex: `y`)
//   → each clears; the ones not looked at leave a faded ⚠️ (D203); ① is looked at → cleared without a
//   faded mark when the window has OS focus (otherwise faded; logged)
//
// Windows only (embedded claude.exe, embedded codex.exe ≥ 0.163.0, pwsh tabs).

import { test, expect, type Locator, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { startBlockingProxy, startFakeAnthropicApi, type FakeAnthropicApi, type Scenario } from './fixtures/fake-anthropic-api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0736')
const WS_A = 'e2e-t0736-a'
const WS_B = 'e2e-t0736-b'
const TAB_A = 'e2e-t0736-a-shell'
const TAB_TOWER = 'e2e-t0736-b-tower'
const TOWER_TITLE = 'T0736 B shell'
const WORKORDER = 'T0736'
const FAKE_KEY = 'sk-t0736-fake-key-not-checked-0000000000'
const SECRET = 't0736-secret-cmd' // in every tool command: must never reach a tooltip or a log
const CODEX_MARK = 'T0736-CODEX-PROMPT'
const CODEX_ARGS = '-a on-request -s read-only'
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const INHERITED = /^(ANTHROPIC_|CLAUDE|OPENAI_|CODEX_)/i
const CLAUDE_ITEM = /^\s*▶\s*Claude CLI\s*(suggested|建議|建议)?\s*$/
const TOWER_ITEM = /以塔台開啟 Claude|Open Claude as Tower|以塔台打开 Claude/
const CODEX_ITEM = /Codex CLI/
const PERMISSION_TIP = /權限確認|permission prompt|权限确认/
const QUESTION_TIP = /回答問題|question to answer|回答问题/
const INPUT_TIP = /codex 等待輸入|codex needs input|codex 等待输入/

/** A command claude asks permission for; port 9 is closed, so it fails at once and never leaves the machine. */
const PERM_CMD = (tag: string) => process.env.T0736_PERM_CMD ? `${process.env.T0736_PERM_CMD} ${tag}` : `curl -s --max-time 3 http://127.0.0.1:9/${tag}`

const SCENARIOS: Record<string, Scenario> = {
  't0736-perm': ({ step }) => [
    { tool: { name: 'Bash', input: { command: PERM_CMD(`${SECRET}-tab`), description: 'T0736 permission probe (a closed local port: fails at once, no network)' } } },
    { text: ['perm ', 'done'] },
  ][step] ?? null,
  't0736-ask': ({ step }) => [
    { tool: { name: 'AskUserQuestion', input: { questions: [{
      question: 'T0736 which option?', header: 'T0736', multiSelect: false,
      options: [{ label: 'Alpha', description: 'the first option' }, { label: 'Beta', description: 'the second option' }],
    }] } } },
    { text: ['ask ', 'done'] },
  ][step] ?? null,
  't0736-worker': ({ step }) => [
    { tool: { name: 'Bash', input: { command: PERM_CMD(`${SECRET}-worker`), description: 'T0736 Worker permission probe (a closed local port: fails at once, no network)' } } },
    { text: ['worker ', 'done'] },
  ][step] ?? null,
}

// ── codex ────────────────────────────────────────────────────────────────────

function codexVersion(bin: string): string | null {
  try {
    return /codex-cli\s+v?(\d+\.\d+\.\d+)/.exec(execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 15_000, windowsHide: true }))?.[1] ?? null
  } catch {
    return null
  }
}

function atLeast(version: string, min: string): boolean {
  const a = version.split('.').map(Number)
  const b = min.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return true
}

/** The first codex.exe >= 0.163.0 (OSC 7501): BAT_E2E_CODEX, then the bundled one (as t0728). */
function findCodex(): { bin: string; version: string } | null {
  if (process.platform !== 'win32') return null
  const candidates: string[] = []
  if (process.env.BAT_E2E_CODEX) candidates.push(process.env.BAT_E2E_CODEX)
  const vendor = path.join(REPO_ROOT, 'node_modules', '@openai', `codex-${process.platform}-${process.arch}`, 'vendor')
  try {
    for (const triple of fs.readdirSync(vendor)) candidates.push(path.join(vendor, triple, 'bin', 'codex.exe'))
  } catch { /* not installed */ }
  for (const bin of candidates) {
    if (!fs.existsSync(bin)) continue
    const version = codexVersion(bin)
    if (version && atLeast(version, '0.163.0')) return { bin, version }
  }
  return null
}

const CODEX = findCodex()

/**
 * The fake Responses API: the first request whose input carries CODEX_MARK (the prompt typed into the
 * Codex tab) gets one escalated tool call; everything else `ok`.
 */
function startFakeResponses(toolCommand: string): Promise<{ port: number; requests: string[]; close(): Promise<void> }> {
  const requests: string[] = []
  let toolSent = false
  const usage = { input_tokens: 1, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 2 }
  const sse = (res: http.ServerResponse, events: unknown[]) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    for (const e of events) res.write(`event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`)
    res.end()
  }
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', d => { body += d })
    req.on('end', () => {
      requests.push(`${req.method} ${req.url}`)
      if (!req.url?.includes('/responses')) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{}'); return }
      let j: { tools?: Array<{ name?: string; type?: string }>; input?: Array<{ type?: string }> } = {}
      try { j = JSON.parse(body) } catch { /* empty */ }
      const tools = (j.tools ?? []).map(t => t.name ?? t.type ?? '')
      const id = `resp_${requests.length}`
      const hasOutput = (j.input ?? []).some(i => i.type === 'function_call_output' || i.type === 'custom_tool_call_output')
      const prompted = JSON.stringify(j.input ?? []).includes(CODEX_MARK)
      if (toolSent || hasOutput || !prompted || tools.length === 0) {
        sse(res, [
          { type: 'response.created', response: { id } },
          { type: 'response.output_item.done', item: { type: 'message', role: 'assistant', id: `msg_${id}`, content: [{ type: 'output_text', text: 'ok' }] } },
          { type: 'response.completed', response: { id, usage } },
        ])
        return
      }
      toolSent = true
      const [name, args] = tools.includes('shell_command')
        ? ['shell_command', { command: toolCommand, sandbox_permissions: 'require_escalated', justification: 'T0736 approval probe' }]
        : tools.includes('exec_command')
          ? ['exec_command', { cmd: toolCommand, sandbox_permissions: 'require_escalated', justification: 'T0736 approval probe' }]
          : ['shell', { command: ['powershell', '-Command', toolCommand] }]
      sse(res, [
        { type: 'response.created', response: { id } },
        { type: 'response.output_item.done', item: { type: 'function_call', id: `fc_${id}`, call_id: `call_${id}`, name, arguments: JSON.stringify(args) } },
        { type: 'response.completed', response: { id, usage } },
      ])
    })
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    port: (server.address() as { port: number }).port,
    requests,
    close: () => new Promise<void>(r => { server.closeAllConnections?.(); server.close(() => r()) }),
  })))
}

// ── helpers ──────────────────────────────────────────────────────────────────

interface StepResult { kind: string; code?: number | null; stdout?: string; stderr?: string; ms?: number }
interface SavedTab { id: string; workspaceId: string; title?: string; agentPreset?: string; launchRole?: string; towerTerminalId?: string; workorder?: string }

/** helper steps inside a tab, with the tab's own env (its scoped capability), as t0621. */
const RUNNER = `
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const env = process.env
const sub = s => String(s).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || '')
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const out = sub(spec.out)
const results = []
const flush = () => { fs.writeFileSync(out + '.tmp', JSON.stringify(results, null, 2)); fs.renameSync(out + '.tmp', out) }
for (const step of spec.steps) {
  const started = Date.now()
  const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...step.args.map(sub)], { env, encoding: 'utf8', timeout: step.timeoutMs || 60000, windowsHide: true })
  results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr, ms: Date.now() - started })
  flush()
}
`

/** The worker's `/ct-exec T0736`: a project skill whose body carries the fake API's scenario tag. */
const WORKER_SKILL = `---
name: ct-exec
description: T0736 e2e stand-in for the Control Tower worker skill (no real work).
---

[[T0727:t0736-worker]] T0736 e2e probe: run the one tool call you are given, then stop.
`

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

async function withoutInheritedAgentEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (INHERITED.test(k) && v !== undefined) { saved[k] = v; delete process.env[k] }
  try {
    return await fn()
  } finally {
    Object.assign(process.env, saved)
  }
}

const rowOf = (win: Page, name: string): Locator => win.locator('.workspace-item', { hasText: name })
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** The active workspace's thumbnail whose title is exactly `title` ("Claude CLI" vs "Claude CLI · Tower"). */
const thumbOf = (win: Page, title: string): Locator => win.locator('.workspace-container.active .thumbnail')
  .filter({ has: win.locator('.thumbnail-title > span', { hasText: new RegExp(`^${escapeRe(title)}$`) }) })
const slash = (p: string) => p.split(path.sep).join('/')

test.skip(process.platform !== 'win32', 'embedded claude.exe / codex.exe and pwsh tabs: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)
test.skip(!CODEX, 'no codex >= 0.163.0 found (BAT_E2E_CODEX, node_modules/@openai/codex-win32-x64): OSC 7501 needs it')

test('workspace ⚠️ from real claude CLI hooks and real codex OSC 7501: manual / Tower / Codex / Worker tabs, totals, jump, faded (no token)', async () => {
  test.setTimeout(600_000)
  const startedAt = Date.now()
  const results: Record<string, string> = {}
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0736-'))
  const home = path.join(tmp, 'home')
  // Electron's appData (→ the runtime userData) follows USERPROFILE: the known folders must exist.
  for (const dir of [['AppData', 'Roaming'], ['AppData', 'Local'], ['Documents']]) fs.mkdirSync(path.join(home, ...dir), { recursive: true })
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0736-'))
  const folderA = path.join(root, 'a')
  const folderB = path.join(root, 'b')
  const codexHome = path.join(tmp, 'codex-home')
  for (const dir of [folderA, folderB, codexHome, path.join(folderB, '.claude', 'skills', 'ct-exec')]) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(folderB, '.claude', 'skills', 'ct-exec', 'SKILL.md'), WORKER_SKILL)
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)

  // claude's first-run screens, answered ahead: onboarding, folder trust (both spellings of the path),
  // the custom API key (claude remembers the last 20 characters).
  const projectEntry = { hasTrustDialogAccepted: true, hasCompletedProjectOnboarding: true, allowedTools: [] }
  const projects: Record<string, unknown> = {}
  for (const f of [folderA, folderB]) { projects[f] = projectEntry; projects[slash(f)] = projectEntry }
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({
    hasCompletedOnboarding: true, theme: 'dark', numStartups: 5,
    // with a non-auto defaultMode (below) claude 2.1.316 first asks "Make auto mode your default permission mode?"
    hasSeenAutoDefaultNudge: true,
    customApiKeyResponses: { approved: [FAKE_KEY.slice(-20)], rejected: [] },
    projects,
  }))
  // "the default permission mode": claude 2.1.316 otherwise starts in auto mode, whose classifier a custom
  // ANTHROPIC_BASE_URL (a gateway) does not offer: it stops on an "ask your gateway" dialog instead of a
  // permission prompt (seen in this spec's first runs, see the T0736 report)
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ permissions: { defaultMode: 'default' } }))

  const fake: FakeAnthropicApi = await startFakeAnthropicApi(SCENARIOS)
  const fakeCodex = await startFakeResponses(`Write-Output ${SECRET}-codex`)
  const proxy = await startBlockingProxy()
  const toml = (s: string) => `'${s}'`
  fs.writeFileSync(path.join(codexHome, 'config.toml'), [
    'model = "gpt-mock"',
    'model_provider = "mock"',
    'check_for_update_on_startup = false',
    '',
    '[analytics]',
    'enabled = false',
    '',
    '[model_providers.mock]',
    'name = "mock"',
    `base_url = "http://127.0.0.1:${fakeCodex.port}/v1"`,
    'wire_api = "responses"',
    '',
    `[projects.${toml(folderB)}]`,
    'trust_level = "trusted"',
    '',
  ].join('\n'))
  const env = {
    ANTHROPIC_BASE_URL: fake.baseUrl,
    ANTHROPIC_API_KEY: FAKE_KEY,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
    USERPROFILE: home,
    HOME: home,
    HTTPS_PROXY: proxy.url,
    HTTP_PROXY: proxy.url,
    NO_PROXY: '127.0.0.1,localhost',
    PATH: `${path.dirname(CODEX!.bin)};${process.env.PATH ?? ''}`,
    CODEX_HOME: codexHome,
  }
  log(`fake Anthropic API ${fake.baseUrl}; fake Responses API 127.0.0.1:${fakeCodex.port}; blocking proxy ${proxy.url}; codex ${CODEX!.version}; folders under ${root}; temp home ${home}`)

  let inst: IsolatedInstance | undefined
  try {
    inst = await withoutInheritedAgentEnv(() => launchIsolated('t0736', log, { env }))
    const { app, win, userData } = inst

    const debugLog = () => {
      const dir = path.join(userData, 'Logs')
      return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    }
    const logLines = (id: string, tag: string) => debugLog().split('\n').filter(l => l.includes(`terminal=${id}`) && l.includes(tag))
    const buffer = async (id: string) => ((await win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id)) as { data?: string } | null)?.data ?? ''
    const screen = async (id: string) => stripAnsi(await buffer(id)).slice(-2500)
    const savedTabs = async (): Promise<SavedTab[]> => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      return raw ? (JSON.parse(raw) as { terminals: SavedTab[] }).terminals : []
    }
    const write = (id: string, data: string) => win.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: id, d: data })
    /** Waits for a debug-log line; on a miss logs the tab's screen and rethrows. */
    const waitLog = async (id: string, re: RegExp, what: string, timeout = 60_000) => {
      try {
        await expect.poll(() => debugLog().split('\n').some(l => l.includes(`terminal=${id}`) && re.test(l)), { timeout }).toBe(true)
      } catch (error) {
        log(`${what}: not seen. screen of ${id}:\n${await screen(id)}`)
        log(`debug log of ${id}:\n${debugLog().split('\n').filter(l => l.includes(id)).map(l => l.slice(0, 400)).join('\n')}`)
        const scripts = path.join(userData, 'Logs', 'bat-scripts.log')
        if (fs.existsSync(scripts)) log(`bat-scripts.log of ${id}:\n${fs.readFileSync(scripts, 'utf8').split('\n').filter(l => l.includes(id)).map(l => l.slice(0, 400)).join('\n')}`)
        log(`fake Anthropic requests: ${JSON.stringify(fake.requests.map(r => `${r.url} ${r.scenario ?? '-'}#${r.step ?? '-'}`))}; codex: ${JSON.stringify(fakeCodex.requests)}; proxy attempts: ${JSON.stringify(proxy.attempts)}`)
        throw error
      }
    }
    /** Opens B's "+" menu, clicks the item, returns the new tab's saved record. */
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
    /** Types a prompt into a TUI: the text, a pause (no paste burst), Enter. */
    const typePrompt = async (id: string, text: string) => {
      await write(id, text)
      await win.waitForTimeout(600)
      await write(id, '\r')
    }
    let specSeq = 0
    const runInTab = async (id: string, steps: unknown[], timeout = 120_000): Promise<StepResult[]> => {
      const n = specSeq++
      const out = slash(path.join(tmp, `tab-${n}.json`))
      const spec = slash(path.join(tmp, `tab-${n}-spec.json`))
      fs.writeFileSync(spec, JSON.stringify({ out, steps }))
      await write(id, `node "${runner}" "${spec}"\r`)
      const read = () => (fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) as StepResult[] : [])
      await expect.poll(() => read().length >= steps.length, { timeout }).toBe(true)
      const r = read()
      log(`${path.basename(out)}: ${JSON.stringify(r).replace(/batcap\.[A-Za-z0-9_-]+/g, 'batcap.<redacted>').slice(0, 2000)}`)
      return r
    }
    const selectWorkspace = async (name: string) => {
      await rowOf(win, name).locator('.workspace-folder').click()
      await expect(rowOf(win, name)).toHaveClass(/\bactive\b/)
    }

    // ── seed: A (a shell) and B (the Tower shell; codex args), the Control Tower panel docked left ──
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_A, name: WS_A, folderPath: folderA, createdAt: Date.now() },
        { id: WS_B, name: WS_B, folderPath: folderB, createdAt: Date.now(), agentCustomArgs: { 'codex-cli': CODEX_ARGS } },
      ],
      activeWorkspaceId: WS_B,
      activeGroup: null,
      terminals: [
        { id: TAB_A, workspaceId: WS_A, type: 'terminal', title: 'T0736 A shell', cwd: folderA },
        { id: TAB_TOWER, workspaceId: WS_B, type: 'terminal', title: TOWER_TITLE, cwd: folderB },
      ],
      activeTerminalId: TAB_TOWER,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.evaluate(() => {
      const raw = localStorage.getItem('better-terminal-docking-config')
      const config = raw ? JSON.parse(raw) : {}
      localStorage.setItem('better-terminal-docking-config', JSON.stringify({ ...config, 'control-tower': 'left' }))
    })
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(rowOf(win, WS_B)).toHaveClass(/\bactive\b/, { timeout: 30_000 })
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TAB_TOWER), { timeout: 30_000 }).not.toBeNull()

    // ── open the three agent tabs in B from the "+" menu ──
    // proxy snapshots per phase attribute any off-machine attempt (BAT itself / claude / codex)
    const attemptsAt: Record<string, string[]> = { 'BAT start': [...proxy.attempts] }
    const cli = await addFromMenu(CLAUDE_ITEM)
    const tower = await addFromMenu(TOWER_ITEM)
    await waitLog(cli.id, /\[agent-start\] .*→ started \(hook session-start\)/, 'claude CLI SessionStart', 90_000)
    await waitLog(tower.id, /\[agent-start\] .*→ started \(hook session-start\)/, 'Tower claude SessionStart', 90_000)
    await win.waitForTimeout(3_000)
    attemptsAt['claude tabs started'] = proxy.attempts.slice(attemptsAt['BAT start'].length)
    const codex = await addFromMenu(CODEX_ITEM)
    log(`tabs: claude ${JSON.stringify(cli)} / tower ${JSON.stringify(tower)} / codex ${JSON.stringify(codex)}`)
    expect(cli).toMatchObject({ workspaceId: WS_B, agentPreset: 'claude-cli' })
    expect(cli.launchRole).toBeUndefined()
    expect(tower).toMatchObject({ workspaceId: WS_B, agentPreset: 'claude-cli', launchRole: 'tower' })
    expect(codex).toMatchObject({ workspaceId: WS_B, agentPreset: 'codex-cli' })
    // claude is up when its SessionStart hook reported; codex when its first OSC 7501 arrived
    await waitLog(codex.id, /\[agent-start\] .*→ started \(osc /, 'codex first OSC 7501', 90_000)
    await win.waitForTimeout(3_000)
    const seen = attemptsAt['BAT start'].length + attemptsAt['claude tabs started'].length
    attemptsAt['codex tab started'] = proxy.attempts.slice(seen)
    const seenBeforeScenarios = proxy.attempts.length
    // A tab opened and switched away from at once is resized while hidden (`[resize] initial doResize …
    // cols=9 rows=5`, see the report); selecting each one once gives its PTY the real size again.
    const ptySize = (id: string) => {
      const sizes = debugLog().split('\n').filter(l => l.includes(`[resize] pty:resize id=${id} `)).map(l => /cols=(\d+) rows=(\d+)/.exec(l)).filter(Boolean)
      const last = sizes.at(-1)
      return last ? `${last[1]}x${last[2]}` : 'none'
    }
    for (const t of [cli, tower, codex]) {
      const before = ptySize(t.id)
      await thumbOf(win, t.title!).click()
      await expect.poll(() => Number(ptySize(t.id).split('x')[0]) || 0, { timeout: 10_000 }).toBeGreaterThan(40)
      log(`PTY size of ${t.title}: ${before} before selecting it, ${ptySize(t.id)} after`)
    }
    // B's own workspace tab bar on another tab (⑤ checks the jump switches it back to the terminal)
    const bTabs = win.locator('.workspace-container.active .workspace-tab-btn')
    await bTabs.nth(1).click()
    const otherTab = (await bTabs.nth(1).textContent())?.trim()
    await expect(bTabs.nth(1)).toHaveClass(/\bactive\b/)
    log(`B's workspace tab bar left on "${otherTab}"`)

    await selectWorkspace(WS_A)
    const rowBadge = rowOf(win, WS_B).locator('.workspace-waiting-badge')
    await expect(rowBadge).toHaveCount(0)
    await expect(rowOf(win, WS_A).locator('.workspace-waiting-badge')).toHaveCount(0)

    // ── ① the manual Claude CLI tab: Bash → PermissionRequest → ⚠️ ──
    await typePrompt(cli.id, '[[T0727:t0736-perm]] run the probe')
    await fake.waitFor('t0736-perm', 0, 60_000).catch(async (e) => { log(`claude CLI screen:
${await screen(cli.id)}`); throw e })
    await waitLog(cli.id, /→ blocked reason=permission \(hook permission-request tool=Bash/, '① permission')
    await expect(rowBadge).toHaveText('⚠️', { timeout: 15_000 })
    await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting')
    await expect(rowBadge).toHaveAttribute('data-waiting-target', cli.id)
    const tip1 = (await rowBadge.getAttribute('title')) ?? ''
    log(`① B row tooltip: ${JSON.stringify(tip1)}`)
    expect(tip1).toContain(cli.title!)
    expect(tip1).toMatch(PERMISSION_TIP)
    expect(tip1).not.toContain(SECRET)
    expect(tip1).not.toContain('127.0.0.1:9')
    expect(stripAnsi(await buffer(cli.id))).toContain(SECRET) // the prompt really shows the command
    await expect(rowOf(win, WS_A).locator('.workspace-waiting-badge')).toHaveCount(0)
    await win.screenshot({ path: test.info().outputPath('1-claude-cli-permission.png') })
    results['①'] = `PASS — claude CLI (+ menu) PermissionRequest tool=Bash → B row ⚠️ (target ${cli.id}), tooltip "${cli.title}" + permission reason, no command text`

    // ── ② the "Open Claude as Tower" tab: AskUserQuestion → question → ⚠️ 2 ──
    await typePrompt(tower.id, '[[T0727:t0736-ask]] ask me')
    await fake.waitFor('t0736-ask', 0, 60_000).catch(async (e) => { log(`tower screen:
${await screen(tower.id)}`); throw e })
    await waitLog(tower.id, /→ blocked reason=question \(hook ask-user-question/, '② question')
    await expect(rowBadge).toHaveText('⚠️ 2', { timeout: 15_000 })
    await expect(rowBadge).toHaveAttribute('data-waiting-count', '2')
    await expect(rowBadge).toHaveAttribute('data-waiting-target', cli.id) // still the one waiting longest
    const tip2 = (await rowBadge.getAttribute('title')) ?? ''
    log(`② B row tooltip: ${JSON.stringify(tip2)}`)
    expect(tip2).toContain(tower.title!)
    expect(tip2).toMatch(QUESTION_TIP)
    expect(tip2).not.toContain('T0736 which option')
    results['②'] = `PASS — "Open Claude as Tower" tab (launchRole tower) AskUserQuestion → question → B row ⚠️ 2, tooltip has the reason, not the question text`

    // ── ③ the manual Codex CLI tab: escalated exec_command → approval → OSC blocked → input → ⚠️ 3 ──
    await typePrompt(codex.id, `${CODEX_MARK} run the probe`)
    await waitLog(codex.id, /→ blocked reason=input \(osc\)/, '③ codex input')
    await expect(rowBadge).toHaveText('⚠️ 3', { timeout: 15_000 })
    const tip3 = (await rowBadge.getAttribute('title')) ?? ''
    log(`③ B row tooltip: ${JSON.stringify(tip3)}`)
    expect(tip3).toContain(codex.title!)
    expect(tip3).toMatch(INPUT_TIP)
    expect(tip3).not.toContain(SECRET)
    const codexCommand = stripAnsi(await buffer(codex.id))
    expect(codexCommand).not.toContain('check_for_update_on_startup') // a manual tab, not a helper dispatch
    results['③'] = `PASS — Codex CLI (+ menu, codex ${CODEX!.version}, ${CODEX_ARGS}) approval prompt → OSC 7501 blocked → input → B row ⚠️ 3`

    // ── ④ a helper-dispatched claude Worker (lands in B, its Tower's workspace) → permission → ⚠️ 4 ──
    const [dispatch] = await runInTab(TAB_TOWER, [{
      script: 'bat-terminal.mjs', timeoutMs: 90_000,
      args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS_B, '--agent', 'claude-cli', '--skill', 'ct-exec', '--workorder', WORKORDER],
    }], 150_000)
    expect(dispatch.code, `${dispatch.stdout}\n${dispatch.stderr}`).toBe(0)
    const workerId = /Terminal created: (\S+)/.exec(dispatch.stdout ?? '')?.[1]
    expect(workerId).toBeTruthy()
    // the helper may switch the window to B: A is the one looked at
    await selectWorkspace(WS_A)
    await fake.waitFor('t0736-worker', 0, 90_000).catch(async (e) => { log(`worker screen:\n${await screen(workerId!)}`); throw e })
    await waitLog(workerId!, /→ blocked reason=permission \(hook permission-request tool=Bash/, '④ Worker permission')
    const worker = (await savedTabs()).find(t => t.id === workerId)
    log(`Worker tab: ${JSON.stringify(worker)}`)
    expect(worker).toMatchObject({ workspaceId: WS_B, towerTerminalId: TAB_TOWER, workorder: WORKORDER })
    await expect(rowBadge).toHaveText('⚠️ 4', { timeout: 15_000 })
    await expect(rowBadge).toHaveAttribute('data-waiting-target', cli.id)
    await win.screenshot({ path: test.info().outputPath('4-row-badge-4.png') })

    // ── ⑥ totals: the 塔台 tab shown → the 工作區 tab title; collapsed → the bar ──
    const tabTitle = win.locator('.left-sidebar-tab').first()
    await win.locator('.left-sidebar-tab').nth(1).click()
    await expect(tabTitle.locator('.workspace-waiting-badge')).toHaveText('⚠️ 4', { timeout: 10_000 })
    await expect(tabTitle.locator('.workspace-waiting-badge')).toHaveAttribute('data-waiting-count', '4')
    await win.screenshot({ path: test.info().outputPath('6-tower-tab-title.png') })
    await tabTitle.click()
    await expect(tabTitle).toHaveClass(/\bactive\b/)
    await win.locator('.left-sidebar-collapse').click()
    const collapsedBadge = win.locator('.left-sidebar-collapsed .workspace-waiting-badge')
    await expect(collapsedBadge).toHaveText('⚠️ 4', { timeout: 10_000 })
    await win.screenshot({ path: test.info().outputPath('6-collapsed.png') })
    await collapsedBadge.click()
    await expect(rowBadge).toBeVisible({ timeout: 10_000 })
    await expect(collapsedBadge).toBeHidden()
    results['⑥'] = 'PASS — with ①–④ waiting: the 工作區 tab title (塔台 tab shown) and the collapsed bar show ⚠️ 4; the bar click expands the sidebar'

    // ── ⑤ the row click → B, the tab waiting longest (①), B's terminal tab ──
    await rowBadge.click()
    await expect(rowOf(win, WS_B)).toHaveClass(/\bactive\b/, { timeout: 10_000 })
    await expect(win.locator('.workspace-container.active .workspace-tab-btn').first()).toHaveClass(/\bactive\b/, { timeout: 10_000 })
    await expect(thumbOf(win, cli.title!)).toHaveClass(/\bactive\b/, { timeout: 10_000 })
    await expect.poll(() => debugLog().includes(`[workspace-waiting] go to workspace=${WS_B} terminal=${cli.id}`), { timeout: 10_000 }).toBe(true)
    await win.screenshot({ path: test.info().outputPath('5-jumped.png') })
    results['⑤'] = `PASS — ⚠️ 4 on B's row; click → B active, "${cli.title}" (waiting longest) selected, B's tab bar back from "${otherTab}" to the terminal tab`

    // ④ cont.: the Worker's own badge ⚠️ (input reason permission); the Tower's N stays 0
    const view = win.locator('.workspace-container.active')
    const workerBadge = view.locator(`.thumbnail[data-workorder="${WORKORDER}"] .worker-badge`)
    await expect(workerBadge).toHaveText(/⚠️/, { timeout: 15_000 })
    await expect(workerBadge).toHaveAttribute('data-blocked-reason', 'permission')
    await view.locator('.thumbnail', { hasText: TOWER_TITLE }).first().click({ button: 'right' })
    const reportedItem = win.locator('.context-menu [data-action="close-reported-workers"]')
    await expect(reportedItem).toHaveText(/[(（]0[)）]$/)
    await expect(reportedItem).toBeDisabled()
    await win.evaluate(() => document.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await expect(win.locator('.context-menu')).toHaveCount(0)
    // the non-Worker tabs carry the plain ⚠️ (T0735), the Worker only its own badge
    for (const t of [cli, tower, codex]) {
      await expect(thumbOf(win, t.title!).locator('.attention-badge.blocked')).toHaveCount(1)
    }
    await expect(view.locator(`.thumbnail[data-workorder="${WORKORDER}"] .attention-badge`)).toHaveCount(0)
    results['④'] = `PASS — helper-dispatched claude Worker ${workerId} (towerTerminalId ${TAB_TOWER}, ${WORKORDER}) PermissionRequest → B row ⚠️ 4; its badge ⚠️ (permission); "Close reported Worker tabs" (0), disabled`

    // ── answers: each wait clears; not looked at → faded (D203) ──
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus() })
    await win.evaluate(() => window.dispatchEvent(new Event('focus')))
    const focused = await win.evaluate(() => document.hasFocus())
    log(`document.hasFocus() = ${focused}`)
    const thumb = (t: SavedTab) => thumbOf(win, t.title!)

    // ① looked at (B active, ① selected): Enter = "Yes" on claude's permission prompt
    await write(cli.id, '\r')
    await waitLog(cli.id, /→ cleared \(/, '① cleared', 30_000)
    await fake.waitFor('t0736-perm', 1, 60_000).catch(async (e) => { log(`claude CLI screen:
${await screen(cli.id)}`); throw e }) // the approved tool ran, the turn went on
    await expect(rowBadge).toHaveText('⚠️ 3', { timeout: 15_000 })
    if (focused) {
      await expect(thumb(cli).locator('.attention-badge')).toHaveCount(0, { timeout: 15_000 })
    } else {
      await expect(thumb(cli).locator('.attention-badge.missed')).toHaveCount(1, { timeout: 15_000 })
      test.info().annotations.push({ type: 'skip-step', description: 'window focus unavailable: ① "answered while looked at" ends faded' })
    }
    // ② not looked at: Enter on the first option (a review step, if any, takes another Enter)
    await write(tower.id, '\r')
    await waitLog(tower.id, /→ cleared \(/, '② cleared', 30_000)
    await expect(rowBadge).toHaveText('⚠️ 2', { timeout: 15_000 })
    await expect(thumb(tower).locator('.attention-badge.missed')).toHaveCount(1, { timeout: 15_000 })
    const askDone = await fake.waitFor('t0736-ask', 1, 20_000).then(() => true, () => false)
    if (!askDone) {
      await write(tower.id, '\r')
      await fake.waitFor('t0736-ask', 1, 30_000).catch(async (e) => { log(`tower screen:\n${await screen(tower.id)}`); throw e })
    }
    // ③ not looked at: `y` on codex's approval prompt (user input does not clear `input`; OSC does)
    await write(codex.id, 'y')
    await waitLog(codex.id, /→ cleared \(osc (working|idle)\)/, '③ cleared', 30_000)
    await expect(rowBadge).toHaveText('⚠️', { timeout: 15_000 })
    await expect(thumb(codex).locator('.attention-badge.missed')).toHaveCount(1, { timeout: 15_000 })
    // ④ not looked at: Enter on the Worker's permission prompt
    await write(workerId!, '\r')
    await waitLog(workerId!, /→ cleared \(/, '④ cleared', 30_000)
    // the default Worker title holds T0736: with nothing to show (not reported, not waiting) the badge is gone
    await expect(view.locator(`.thumbnail[data-workorder="${WORKORDER}"] .worker-badge.blocked`)).toHaveCount(0, { timeout: 15_000 })
    await expect(view.locator(`.thumbnail[data-workorder="${WORKORDER}"] .attention-badge.missed`)).toHaveCount(1, { timeout: 15_000 })
    await expect(rowBadge).toHaveAttribute('data-waiting', 'missed', { timeout: 15_000 })
    await expect(rowBadge).toHaveText('⚠️')
    await win.screenshot({ path: test.info().outputPath('7-all-answered.png') })
    for (const [k, t] of [['①', cli], ['②', tower], ['③', codex], ['④', { id: workerId! }]] as const) {
      log(`${k} [blocked] lines: ${logLines(t.id, '[blocked]').map(l => l.replace(/^.*?\[blocked\]/, '[blocked]')).join(' / ')}`)
    }
    results['answers'] = `PASS — ① Enter (looked at, focus=${focused}) → ${focused ? 'cleared, no faded mark' : 'faded'}; ② Enter / ③ y / ④ Enter (not looked at) → each cleared, faded ⚠️ on its thumbnail; B row ⚠️ 3 → 2 → 1 → faded`

    // ── logs: never a command / question text, never a token ──
    const debug = debugLog()
    expect(debug).not.toContain(SECRET)
    expect(debug).not.toContain('T0736 which option')
    expect(debug).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    const scriptsLog = fs.readFileSync(path.join(userData, 'Logs', 'bat-scripts.log'), 'utf8')
    expect(scriptsLog).not.toContain(SECRET)
    expect(scriptsLog).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)

    // ── nothing left the machine ──
    log(`fake Anthropic requests: ${fake.requests.length} (${JSON.stringify(fake.requests.map(r => `${r.model} ${r.scenario ?? '-'}#${r.step ?? '-'}`))})`)
    log(`fake Responses requests: ${JSON.stringify(fakeCodex.requests)}`)
    log(`blocking proxy attempts (off-machine requests): ${proxy.attempts.length} ${JSON.stringify(proxy.attempts)}`)
    attemptsAt['scenarios ①–⑥'] = proxy.attempts.slice(seenBeforeScenarios)
    log(`off-machine attempts by phase (all refused by the proxy): ${JSON.stringify(attemptsAt)}`)
    results['network'] = `fake Anthropic ${fake.requests.length} requests, fake Responses ${fakeCodex.requests.length} requests, off-machine attempts ${proxy.attempts.length}, all refused (by phase ${JSON.stringify(attemptsAt)})`
    // The proxy refuses everything, so nothing reached the network; what was attempted is recorded. The
    // model APIs must never be among it (claude / codex only talk to the fakes).
    expect(proxy.attempts.filter(a => /api\.anthropic\.com|api\.openai\.com/.test(a))).toEqual([])
    log(`T0736 results: ${JSON.stringify(results, null, 2)}`)
    log(`T0736 spec body took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  } finally {
    if (inst) await closeIsolated(inst, log)
    await fake.close()
    await fakeCodex.close()
    await proxy.close()
    for (const dir of [tmp, root]) {
      try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 }) } catch (e) { log(`could not remove ${dir}: ${e instanceof Error ? e.message : String(e)}`) }
      log(`temp dir ${dir} removed: ${!fs.existsSync(dir)}`)
    }
  }
})
