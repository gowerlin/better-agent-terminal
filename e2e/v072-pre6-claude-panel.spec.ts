// T0727 (v0.7.2-pre.6 automated acceptance, part 1): the Claude panel (SDK 0.3 → embedded CLI
// 2.1.316) driven end to end against a local fake Anthropic Messages API — no login, no tokens,
// no request leaves the machine.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The isolated
// BAT gets:
//   - ANTHROPIC_BASE_URL → fixtures/fake-anthropic-api.ts in this test process, a fake
//     ANTHROPIC_API_KEY (never checked), CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1;
//   - HTTPS_PROXY / HTTP_PROXY → a proxy that refuses and records everything (NO_PROXY=127.0.0.1),
//     plus recorders on the main process `fetch` and the session's `webRequest`;
//   - USERPROFILE / HOME → a temp home, so the CLI's `~/.claude` (sessions, settings) and BAT's
//     own `~/.claude` reads (plugins list, session history — BAT reads `os.homedir()/.claude`, not
//     CLAUDE_CONFIG_DIR) are the temp one; inherited CLAUDE* / ANTHROPIC_* variables are dropped.
// The workspace folder lives under %ProgramData%, not under the user profile: the CLI loads every
// ancestor's `.claude/CLAUDE.md` as project memory, so a folder under the user's TMP would read the
// user's own `~/.claude/CLAUDE.md`.
//
//   ① claude-opus-5-5: the first request offers TaskCreate / TaskUpdate / TaskList
//   ② claude-sonnet-4-6: same
//      (CLI 2.1.316 announces them in the ToolSearch deferred list, not in `tools`)
//   ③ 3 × TaskCreate + TaskUpdate tool_use: the panel's list, ticks and 「已完成 n/3」 follow each
//      turn (one turn at a time, gated); no active-task bar entry
//   ④ relaunch the isolated instance: the tab restores, resumes and rebuilds the same list
//   ⑤ streamed text shows while streaming (cursor) and in full afterwards
//   ⑥ a Bash tool_use in `default` mode: permission card, allow → runs, deny → does not run
//   ⑦ a (foreground) Agent tool_use: Agent card + active-task bar while the sub-agent runs, cleared after
//   ⑧ a seeded `claude-code-v2` tab with an sdkSessionId: reads as Claude Agent; records whether
//      the next message resumed or started fresh
//   ⑨ a claude-cli PTY's env has no CLAUDE_CODE_ENABLE_TODO_TOOLS (and the main process neither)
//
// Windows only (embedded claude.exe, pwsh tabs).

import { test, expect, type Page, type Locator } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { startBlockingProxy, startFakeAnthropicApi, type FakeAnthropicApi, type FakeRequest, type Scenario } from './fixtures/fake-anthropic-api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0727')
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const WS = 'e2e-t0727-ws'
const TAB_OPUS = 'e2e-t0727-opus'
const TAB_SONNET = 'e2e-t0727-sonnet'
const TAB_V2 = 'e2e-t0727-v2'
const TAB_CLI = 'e2e-t0727-cli-env'
const OPUS = 'claude-opus-5-5'
const SONNET = 'claude-sonnet-4-6'
const TASK_TOOLS = ['TaskCreate', 'TaskUpdate', 'TaskList']
const STREAM_PARTS = ['T0727 ', 'stream ', 'chunk-2 ', 'chunk-3 ', 'chunk-4 ', 'END-OF-STREAM']
const INHERITED = /^(ANTHROPIC_|CLAUDE)/i

const createdIds = (results: string[]) => results.map(r => /Task #(\d+) created successfully/.exec(r)?.[1]).filter((x): x is string => !!x)

const SCENARIOS: Record<string, Scenario> = {
  tasks: ({ step, toolResults }) => {
    const ids = createdIds(toolResults)
    return [
      { text: ['Planning ', 'three ', 'tasks.'], tool: { name: 'TaskCreate', input: { subject: 'Draft spec', description: 'Write the T0727 spec', activeForm: 'Drafting spec' } } },
      { tool: { name: 'TaskCreate', input: { subject: 'Run checks', description: 'Run the gates', activeForm: 'Running checks' } } },
      { tool: { name: 'TaskCreate', input: { subject: 'Write report', description: 'Fill the report', activeForm: 'Writing report' } } },
      { tool: { name: 'TaskUpdate', input: { taskId: ids[0], status: 'in_progress' } } },
      { tool: { name: 'TaskUpdate', input: { taskId: ids[0], status: 'completed' } } },
      { tool: { name: 'TaskUpdate', input: { taskId: ids[1], status: 'completed' } } },
      { text: STREAM_PARTS, deltaDelayMs: 500 },
    ][step] ?? null
  },
  agent: ({ step, agentTypes }) => [
    { tool: { name: 'Agent', input: { description: 'T0727 sub-agent probe', prompt: '[[T0727:sub]] report back', subagent_type: agentTypes.includes('general-purpose') ? 'general-purpose' : (agentTypes[0] ?? 'general-purpose'), run_in_background: false } } },
    { text: ['agent ', 'done'] },
  ][step] ?? null,
  sub: ({ step }) => (step === 0 ? { text: ['sub-agent ', 'finished'] } : null),
  'perm-allow': ({ step }) => [
    { tool: { name: 'Bash', input: { command: 'mkdir t0727-perm-allow', description: 'T0727 permission probe (allow)' } } },
    { text: ['allow ', 'done'] },
  ][step] ?? null,
  'perm-deny': ({ step }) => [
    { tool: { name: 'Bash', input: { command: 'mkdir t0727-perm-deny', description: 'T0727 permission probe (deny)' } } },
    { text: ['deny ', 'done'] },
  ][step] ?? null,
  v2: ({ step }) => (step === 0 ? { text: ['v2 ', 'continued'] } : null),
}

/** Child-env probe for ⑨: presence / value of a few keys only — never the whole env. */
const ENV_PROBE = `
const fs = require('fs')
const pick = k => (process.env[k] === undefined ? null : process.env[k])
fs.writeFileSync(process.argv[2], JSON.stringify({
  CLAUDE_CODE_ENABLE_TODO_TOOLS: pick('CLAUDE_CODE_ENABLE_TODO_TOOLS'),
  CLAUDE_CODE_ENABLE_TASKS: pick('CLAUDE_CODE_ENABLE_TASKS'),
  DISABLE_UPDATES: pick('DISABLE_UPDATES'),
  DISABLE_AUTOUPDATER: pick('DISABLE_AUTOUPDATER'),
}))
`

function summary(r: FakeRequest): string {
  return `#${r.seq} ${r.method} ${r.url} model=${r.model} stream=${r.stream} scenario=${r.scenario ?? '-'} step=${r.step ?? '-'} tools=${r.tools.length} deferredTask=${r.deferred.filter(d => d.startsWith('Task')).join('+') || '-'}`
}

function offered(r: FakeRequest): string[] {
  return [...r.tools, ...r.deferred]
}

/** Inherited Claude / Anthropic variables (this test may itself run inside Claude Code) stay out of the app. */
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

async function selectTab(win: Page, title: string): Promise<void> {
  await win.locator('.workspace-container.active .thumbnail', { hasText: title }).first().click()
  await expect(activePanel(win)).toBeVisible({ timeout: 30_000 })
}

async function send(win: Page, text: string): Promise<void> {
  const input = activePanel(win).locator('textarea.claude-input')
  await input.click()
  await input.fill(text)
  await input.press('Enter')
}

/** Every `.claude-todo-checklist` in the panel, as `status:subject` rows. */
async function checklists(panel: Locator): Promise<string[][]> {
  return panel.evaluate(el => [...el.querySelectorAll('.claude-todo-checklist')].map(list =>
    [...list.querySelectorAll('.claude-todo-item')].map(item => `${item.className.replace('claude-todo-item claude-todo-', '')}:${item.querySelector('.claude-todo-text')?.textContent ?? ''}`)))
}

/** The progress label (「已完成 n/m」) on the card that carries the last checklist. */
async function lastProgress(panel: Locator): Promise<string> {
  return panel.evaluate(el => {
    const lists = el.querySelectorAll('.claude-todo-checklist')
    const card = lists[lists.length - 1]?.closest('.tl-content')
    const descs = [...(card?.querySelectorAll('.claude-tool-header .claude-tool-desc') ?? [])].map(d => d.textContent ?? '')
    return descs.find(d => /\d+\/\d+/.test(d)) ?? ''
  })
}

async function waitText(panel: Locator, text: string, timeout = 60_000): Promise<void> {
  await expect.poll(async () => (await panel.textContent()) ?? '', { timeout }).toContain(text)
}

async function installNetRecorders(inst: IsolatedInstance): Promise<void> {
  await inst.app.evaluate(({ session }) => {
    const g = globalThis as AnyApi
    g.__t0727 = { fetch: [] as string[], web: [] as string[] }
    const original = g.fetch
    g.fetch = (input: AnyApi, init?: AnyApi) => {
      try { g.__t0727.fetch.push(typeof input === 'string' ? input : String(input?.url ?? input)) } catch { /* ignore */ }
      return original(input, init)
    }
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (!/^(file|devtools|chrome|chrome-extension|data|blob):/i.test(details.url)) g.__t0727.web.push(details.url)
      callback({})
    })
  })
}

async function netRecords(inst: IsolatedInstance): Promise<{ fetch: string[]; web: string[] }> {
  return inst.app.evaluate(() => (globalThis as AnyApi).__t0727 ?? { fetch: [], web: [] })
}

async function sdkSessionIdOf(win: Page, tabId: string): Promise<string> {
  let id = ''
  await expect.poll(async () => {
    const meta = await win.evaluate((sid) => (window as AnyApi).electronAPI.claude.getSessionMeta(sid), tabId) as { sdkSessionId?: string } | null
    id = meta?.sdkSessionId ?? ''
    return id
  }, { timeout: 30_000 }).toMatch(/^[0-9a-f-]{36}$/)
  return id
}

test.skip(process.platform !== 'win32', 'embedded claude.exe and pwsh tabs: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)

test('Claude panel against a fake Anthropic API: task list, resume, streaming, permission, sub-agent, V2 migration, claude-cli env (no token)', async () => {
  test.setTimeout(600_000)
  const startedAt = Date.now()
  const results: Record<string, string> = {}
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0727-'))
  const home = path.join(tmp, 'home')
  // Windows expands the known folders (%USERPROFILE%\AppData\Roaming …) with the process env: Electron's
  // appData (→ the runtime userData) follows the temp home, so the folders must exist.
  for (const dir of [['AppData', 'Roaming'], ['AppData', 'Local'], ['Documents']]) fs.mkdirSync(path.join(home, ...dir), { recursive: true })
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0727-'))
  const folder = path.join(root, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const probe = path.join(tmp, 'env-probe.cjs')
  fs.writeFileSync(probe, ENV_PROBE)
  const userProjects = path.join(os.homedir(), '.claude', 'projects')
  const userProjectsTouched = () => (fs.existsSync(userProjects) ? fs.readdirSync(userProjects).filter(n => /t0727/i.test(n)) : [])
  expect(userProjectsTouched()).toEqual([])

  const fake = await startFakeAnthropicApi(SCENARIOS)
  const proxy = await startBlockingProxy()
  const env = {
    ANTHROPIC_BASE_URL: fake.baseUrl,
    ANTHROPIC_API_KEY: 't0727-fake-key',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    USERPROFILE: home,
    HOME: home,
    HTTPS_PROXY: proxy.url,
    HTTP_PROXY: proxy.url,
    NO_PROXY: '127.0.0.1,localhost',
  }
  log(`fake Anthropic API ${fake.baseUrl}; blocking proxy ${proxy.url}; workspace ${folder}; temp home ${home}`)

  let inst: IsolatedInstance | undefined
  let runtimeId = ''
  let bodyPassed = false
  const netSeen: { fetch: string[]; web: string[] } = { fetch: [], web: [] }
  const collectNet = async (i: IsolatedInstance) => {
    const r = await netRecords(i).catch(() => ({ fetch: [], web: [] }))
    netSeen.fetch.push(...r.fetch)
    netSeen.web.push(...r.web)
  }
  try {
    // ════════ launch 1 ════════
    inst = await withoutInheritedClaudeEnv(() => launchIsolated('t0727', log, { env }))
    runtimeId = inst.runtimeId
    await installNetRecorders(inst)
    let win = inst.win
    expect(await inst.app.evaluate(() => process.env.CLAUDE_CODE_ENABLE_TODO_TOOLS ?? null)).toBeNull()
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0727', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: TAB_OPUS, workspaceId: WS, type: 'terminal', agentPreset: 'claude-code', title: 'T0727 Opus', cwd: folder, model: OPUS },
        { id: TAB_SONNET, workspaceId: WS, type: 'terminal', agentPreset: 'claude-code', title: 'T0727 Sonnet', cwd: folder, model: SONNET },
      ],
      activeTerminalId: TAB_OPUS,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(activePanel(win)).toBeVisible({ timeout: 45_000 })
    const opus = activePanel(win)

    // ── ① / ③ / ⑤: tasks on Claude 5, one model turn at a time ──
    fake.gate('tasks')
    await send(win, '[[T0727:tasks]] plan three tasks')
    const first = await fake.waitFor('tasks', 0, 90_000)
    log(`① first request: ${summary(first)}`)
    expect(first.model).toBe(OPUS)
    for (const name of TASK_TOOLS) expect(offered(first), `${OPUS} offers ${name}`).toContain(name)
    results['①'] = `PASS — ${OPUS} first request: tools[${first.tools.length}] + deferred [${first.deferred.join(', ')}]`

    const expected: Array<{ list: string[]; progress: string }> = [
      { list: ['pending:Draft spec'], progress: '0/1' },
      { list: ['pending:Draft spec', 'pending:Run checks'], progress: '0/2' },
      { list: ['pending:Draft spec', 'pending:Run checks', 'pending:Write report'], progress: '0/3' },
      { list: ['in_progress:Draft spec', 'pending:Run checks', 'pending:Write report'], progress: '0/3' },
      { list: ['completed:Draft spec', 'pending:Run checks', 'pending:Write report'], progress: '1/3' },
      { list: ['completed:Draft spec', 'completed:Run checks', 'pending:Write report'], progress: '2/3' },
    ]
    const seen: string[] = []
    for (let step = 0; step < expected.length; step++) {
      fake.release('tasks', step)
      await fake.waitFor('tasks', step + 1, 60_000) // the tool result of `step` is back; the next turn is held
      await expect.poll(async () => (await checklists(opus)).at(-1), { timeout: 15_000 }).toEqual(expected[step].list)
      await expect.poll(() => lastProgress(opus), { timeout: 15_000 }).toContain(expected[step].progress)
      expect(await opus.locator('.claude-active-task-item').count()).toBe(0)
      seen.push(`${expected[step].progress} [${(await checklists(opus)).at(-1)!.join(', ')}] label=${JSON.stringify(await lastProgress(opus))}`)
    }
    log(`③ list after each turn: ${seen.join(' → ')}`)
    expect(await lastProgress(opus)).toMatch(/已完成 2\/3/)
    expect(await checklists(opus)).toHaveLength(1) // one run of Task* cards → the list is drawn once, on its last card
    await opus.screenshot({ path: test.info().outputPath('t0727-task-list.png') })
    results['③'] = `PASS — ${seen.join(' → ')}; no .claude-active-task-item at any step`

    // ⑤ the last turn streams 6 deltas, 500 ms apart
    fake.release('tasks', expected.length)
    const streaming = opus.locator('.claude-cursor')
    await expect(streaming).toBeVisible({ timeout: 30_000 })
    const partial = (await streaming.locator('xpath=..').textContent()) ?? ''
    log(`⑤ while streaming: ${JSON.stringify(partial)}`)
    expect(partial).toContain('T0727')
    expect(partial).not.toContain('END-OF-STREAM')
    await waitText(opus, STREAM_PARTS.join(''))
    await expect(streaming).toHaveCount(0, { timeout: 15_000 })
    results['⑤'] = `PASS — mid-stream ${JSON.stringify(partial.replace('|', '').trim())} with cursor, then the full text ${JSON.stringify(STREAM_PARTS.join(''))}`
    const opusFinal = { lists: await checklists(opus), progress: await lastProgress(opus) }
    const opusSession = await sdkSessionIdOf(win, TAB_OPUS)

    // ── ② / ⑦: sub-agent on Claude 4.x (the panel's default bypass mode) ──
    await selectTab(win, 'T0727 Sonnet')
    const sonnet = activePanel(win)
    fake.gate('sub')
    await send(win, '[[T0727:agent]] delegate to a sub-agent')
    const second = await fake.waitFor('agent', 0, 90_000)
    log(`② first request: ${summary(second)}`)
    expect(second.model).toBe(SONNET)
    for (const name of TASK_TOOLS) expect(offered(second), `${SONNET} offers ${name}`).toContain(name)
    results['②'] = `PASS — ${SONNET} first request: tools[${second.tools.length}] + deferred [${second.deferred.join(', ')}]`
    const subRequest = await fake.waitFor('sub', 0, 60_000)
    log(`⑦ sub-agent request (held): ${summary(subRequest)}`)
    const agentCard = sonnet.locator('.tl-item', { has: win.locator('.claude-tool-name', { hasText: /^Agent$/ }) })
    await expect(agentCard).toHaveCount(1, { timeout: 15_000 })
    await expect(sonnet.locator('.claude-active-task-item')).toHaveCount(1, { timeout: 15_000 })
    const barLabel = await sonnet.locator('.claude-active-task-item .claude-active-task-label').first().textContent()
    log(`⑦ while running: Agent card dot=${await agentCard.locator('.tl-dot').getAttribute('class')} active-task bar label=${JSON.stringify(barLabel)}`)
    await sonnet.screenshot({ path: test.info().outputPath('t0727-agent-running.png') })
    fake.release('sub', 0)
    await fake.waitFor('agent', 1, 60_000)
    await waitText(sonnet, 'agent done')
    await expect(sonnet.locator('.claude-active-task-item')).toHaveCount(0, { timeout: 15_000 })
    await expect(agentCard.locator('.tl-dot')).toHaveClass(/dot-success/, { timeout: 15_000 })
    results['⑦'] = `PASS — Agent card (${subRequest.model}, subagent request ${subRequest.tools.length} tools) + 1 active-task bar item ${JSON.stringify(barLabel)} while the sub-agent was held; after it: bar empty, card dot-success`

    // ── ⑥: permission in `default` mode, allow then deny ──
    // Between turns the call returns false (the finished query's setPermissionMode throws) but the
    // session keeps the mode for the next turn — the permission card below is the real check.
    const modeSet = await win.evaluate((sid) => (window as AnyApi).electronAPI.claude.setPermissionMode(sid, 'default'), TAB_SONNET)
    log(`⑥ setPermissionMode(default) between turns returned ${JSON.stringify(modeSet)}`)
    const card = sonnet.locator('.claude-permission-card')
    await send(win, '[[T0727:perm-allow]] make a folder')
    await expect(card).toBeVisible({ timeout: 60_000 })
    const allowTitle = (await card.locator('.claude-permission-title').textContent()) ?? ''
    expect(allowTitle).toContain('Bash')
    await expect(card.locator('.claude-permission-command')).toContainText('mkdir t0727-perm-allow')
    await card.screenshot({ path: test.info().outputPath('t0727-permission.png') })
    await card.locator('.claude-permission-option').first().click() // 1 是
    await waitText(sonnet, 'allow done')
    await fake.waitFor('perm-allow', 1)
    expect(fs.existsSync(path.join(folder, 't0727-perm-allow'))).toBe(true)
    await expect(card).toHaveCount(0)

    await send(win, '[[T0727:perm-deny]] make another folder')
    await expect(card).toBeVisible({ timeout: 60_000 })
    await expect(card.locator('.claude-permission-command')).toContainText('mkdir t0727-perm-deny')
    await card.locator('.claude-permission-option:not(.custom)').last().click() // 否
    await waitText(sonnet, 'deny done')
    const denyRequest = requestsFor(fake, 'perm-deny', 1)
    expect(fs.existsSync(path.join(folder, 't0727-perm-deny'))).toBe(false)
    log(`⑥ allow: title=${JSON.stringify(allowTitle)} folder created; deny: folder absent; deny turn messages=${denyRequest?.messageCount}`)
    results['⑥'] = `PASS — permission card (${JSON.stringify(allowTitle.trim())}); 是 → mkdir ran (folder exists); 否 → folder absent, the model got the denial and answered`
    const sonnetSession = await sdkSessionIdOf(win, TAB_SONNET)

    // ── ⑨: a claude-cli PTY's env ──
    const probeOut = path.join(tmp, 'env-probe.json')
    const created = await win.evaluate((opts) => (window as AnyApi).electronAPI.pty.create(opts), { id: TAB_CLI, cwd: folder, type: 'terminal', agentPreset: 'claude-cli', workspaceId: WS })
    log(`⑨ pty.create(claude-cli): ${JSON.stringify(created)}`)
    await win.waitForTimeout(3_000)
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: TAB_CLI, line: `node "${probe}" "${probeOut}"\r` })
    await expect.poll(() => fs.existsSync(probeOut), { timeout: 30_000 }).toBe(true)
    const cliEnv = JSON.parse(fs.readFileSync(probeOut, 'utf8')) as Record<string, string | null>
    log(`⑨ claude-cli PTY env: ${JSON.stringify(cliEnv)}`)
    expect(cliEnv.CLAUDE_CODE_ENABLE_TODO_TOOLS).toBeNull()
    expect(cliEnv.CLAUDE_CODE_ENABLE_TASKS).toBeNull()
    expect(cliEnv.DISABLE_UPDATES).toBe('1') // positive control: the claude-cli embedded-runtime env was applied
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.kill(id), TAB_CLI)
    results['⑨'] = `PASS — claude-cli PTY: CLAUDE_CODE_ENABLE_TODO_TOOLS=${cliEnv.CLAUDE_CODE_ENABLE_TODO_TOOLS}, CLAUDE_CODE_ENABLE_TASKS=${cliEnv.CLAUDE_CODE_ENABLE_TASKS}, DISABLE_UPDATES=${cliEnv.DISABLE_UPDATES} (control); main process CLAUDE_CODE_ENABLE_TODO_TOOLS=null`

    await selectTab(win, 'T0727 Opus')
    await collectNet(inst)
    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined

    // ════════ launch 2: same runtime ════════
    const before = fake.requests.length
    inst = await withoutInheritedClaudeEnv(() => launchIsolated('t0727', log, { env, runtimeId }))
    await installNetRecorders(inst)
    win = inst.win
    await expect(activePanel(win)).toBeVisible({ timeout: 45_000 })
    const restored = activePanel(win)
    // ④ the restored tab resumes its session and replays the history
    await expect.poll(async () => checklists(restored), { timeout: 60_000 }).toEqual(opusFinal.lists)
    await expect.poll(() => lastProgress(restored), { timeout: 15_000 }).toBe(opusFinal.progress)
    expect(await restored.locator('.claude-active-task-item').count()).toBe(0)
    await waitText(restored, STREAM_PARTS.join(''))
    // The main process only learns the id again from the next query's init; the restored tab carries it.
    const saved = JSON.parse(await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()) as string) as { terminals?: Array<{ id: string; sdkSessionId?: string }> }
    expect(saved.terminals?.find(t => t.id === TAB_OPUS)?.sdkSessionId).toBe(opusSession)
    await restored.screenshot({ path: test.info().outputPath('t0727-task-list-resumed.png') })
    log(`④ after relaunch: ${JSON.stringify(await checklists(restored))} ${JSON.stringify(await lastProgress(restored))}; model requests during restore: ${fake.requests.length - before}`)
    results['④'] = `PASS — relaunched runtime; tab restored with sdkSessionId ${opusSession.slice(0, 8)}…, history replay rebuilt ${JSON.stringify(opusFinal.lists.at(-1))} ${JSON.stringify(opusFinal.progress)} (same as before the relaunch; ${fake.requests.length - before} model requests during restore)`

    // ⑧ a `claude-code-v2` tab with the Sonnet session (seeded, then the renderer reloads it)
    const v2seed = {
      workspaces: [{ id: WS, name: 'T0727', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: TAB_OPUS, workspaceId: WS, type: 'terminal', agentPreset: 'claude-code', title: 'T0727 Opus', cwd: folder, model: OPUS, sdkSessionId: opusSession },
        { id: TAB_V2, workspaceId: WS, type: 'terminal', agentPreset: 'claude-code-v2', title: 'Claude Agent V2', cwd: folder, model: SONNET, sdkSessionId: sonnetSession },
      ],
      activeTerminalId: TAB_V2,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(v2seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(activePanel(win)).toBeVisible({ timeout: 45_000 })
    const v2 = activePanel(win)
    const titles = await win.locator('.workspace-container.active .thumbnail .thumbnail-title').allTextContents()
    const reloaded = JSON.parse(await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()) as string) as { terminals?: Array<{ id: string; agentPreset?: string; title?: string }>; activeTerminalId?: string }
    log(`⑧ after reload: thumbnails ${JSON.stringify(titles)}; saved ${JSON.stringify(reloaded.terminals?.map(t => [t.id, t.agentPreset, t.title]))} active=${reloaded.activeTerminalId}`)
    // The renderer keeps its own last-active tab, so select the migrated one explicitly.
    await selectTab(win, 'Claude Agent')
    const v2Title = (await win.locator('.workspace-container.active .thumbnail.active .thumbnail-title').textContent()) ?? ''
    log(`⑧ migrated tab title: ${JSON.stringify(v2Title)}`)
    expect(v2Title).toContain('Claude Agent')
    expect(v2Title).not.toContain('V2')
    await waitText(v2, 'deny done') // the old session's history is shown
    const v2Before = fake.requests.length
    await send(win, '[[T0727:v2]] continue after the migration')
    const v2Request = await fake.waitFor('v2', 0, 90_000)
    await waitText(v2, 'v2 continued')
    const resumed = v2Request.userText.includes('[[T0727:perm-deny]]')
    const freshNote = ((await v2.textContent()) ?? '').includes('Previous session could not be resumed. Starting fresh...')
    const v2Session = await sdkSessionIdOf(win, TAB_V2)
    log(`⑧ v2 request: ${summary(v2Request)} messages=${v2Request.messageCount} carriesOldContext=${resumed} freshNote=${freshNote} sdkSessionId ${sonnetSession.slice(0, 8)} → ${v2Session.slice(0, 8)}; requests ${fake.requests.length - v2Before}`)
    expect(resumed || freshNote).toBe(true)
    const afterSend = JSON.parse(await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load()) as string) as { terminals?: Array<{ id: string; agentPreset?: string; title?: string }> }
    const v2Saved = afterSend.terminals?.find(t => t.id === TAB_V2)
    log(`⑧ saved tab after the message: agentPreset=${v2Saved?.agentPreset} title=${JSON.stringify(v2Saved?.title)}`)
    results['⑧'] = `PASS — seeded agentPreset claude-code-v2 / title "Claude Agent V2" read as ${JSON.stringify(v2Title.trim())} with the Claude Agent panel and the old history (saved afterwards as ${v2Saved?.agentPreset} / ${JSON.stringify(v2Saved?.title)}); next message ${resumed ? `RESUMED (the request carried the earlier conversation, ${v2Request.messageCount} messages; sdkSessionId ${sonnetSession.slice(0, 8)} → ${v2Session.slice(0, 8)})` : 'started fresh ("Previous session could not be resumed. Starting fresh...")'}`
    await collectNet(inst)
    bodyPassed = true
  } finally {
    if (inst) {
      await collectNet(inst)
      await closeIsolated(inst, log)
    }
    // ── no request left the machine ──
    const offMachine = [...netSeen.fetch, ...netSeen.web].filter(u => !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(u))
    log(`model requests (${fake.requests.length}): ${fake.requests.map(summary).join(' | ')}`)
    log(`blocking proxy attempts: ${JSON.stringify(proxy.attempts)}; main fetch / webRequest off-machine: ${JSON.stringify(offMachine)}`)
    log(`user ~/.claude/projects entries for this run: ${JSON.stringify(userProjectsTouched())}; temp home sessions: ${JSON.stringify(fs.existsSync(path.join(home, '.claude', 'projects')) ? fs.readdirSync(path.join(home, '.claude', 'projects')) : [])}`)
    for (const [k, v] of Object.entries(results)) log(`${k} ${v}`)
    await fake.close()
    await proxy.close()
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    log(`T0727 spec took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  }
  // Checked after teardown so they cover both launches (skipped when the body already failed).
  if (bodyPassed) {
    const offMachine = [...netSeen.fetch, ...netSeen.web].filter(u => !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(u))
    expect(proxy.attempts).toEqual([])
    expect(offMachine).toEqual([])
    expect(fake.requests.every(r => r.url.startsWith('/v1/messages'))).toBe(true)
    expect(userProjectsTouched()).toEqual([])
  }
})

function requestsFor(fake: FakeAnthropicApi, scenario: string, step: number): FakeRequest | undefined {
  return fake.requests.find(r => r.scenario === scenario && r.step === step)
}
