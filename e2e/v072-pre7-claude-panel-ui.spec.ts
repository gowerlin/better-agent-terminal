// T0737 (v0.7.2-pre.7 automated acceptance, UI layer): BUG-177 / T0729 and BUG-178 / T0730 driven the
// way a user does it — the add-tab menu, the panel's `/model` list, the input box, `/resume` and the
// Control Tower overview — instead of calling IPC directly (e2e ⑩–⑫ in v072-pre6-claude-panel.spec.ts
// already cover the IPC layer). Same no-token isolation as T0727: the embedded claude CLI only talks to
// fixtures/fake-anthropic-api.ts, a fake key, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1, a proxy that
// refuses and records everything, recorders on main `fetch` / `webRequest`, a temp HOME, inherited
// CLAUDE* / ANTHROPIC_* dropped, the workspace folder under %ProgramData%.
//
// Test 1 — BUG-177 (no CLAUDE_CONFIG_DIR):
//   A1 add a Claude Agent tab from the thumbnail "+" menu; wait idle → 0 model requests, no session file
//   A2 type `/model`, wait for the list to load, pick another model → still 0 model requests, no session file
//   A3 send one message → exactly 1 session file; `/resume` lists exactly that one session
//
// Test 2 — BUG-178 (CLAUDE_CONFIG_DIR → a temp dir apart from the temp HOME; decoys under HOME/.claude):
//   B1 add a Claude Agent tab from the menu, send a message → the session file is under CLAUDE_CONFIG_DIR
//   B2 the slash menu offers the plugin command installed under CLAUDE_CONFIG_DIR (not the HOME decoy)
//   B3 Tower › overview: the `*config` default layer is `<CLAUDE_CONFIG_DIR>/skills/control-tower/references/tower-config.md`
//      and its value is shown (the HOME decoy's is not)
//   B4 relaunch BAT: the restored tab shows the history; a NEW tab from the menu → `/resume` lists the
//      session → pick it → history rebuilt, the next message carries the earlier conversation
//   B5 nothing under HOME/.claude was written (same files, sizes and mtimes as seeded)
//
// Windows only (embedded claude.exe, pwsh tabs).

import { test, expect, type Page, type Locator } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { startBlockingProxy, startFakeAnthropicApi, type BlockingProxy, type FakeAnthropicApi, type FakeRequest, type Scenario } from './fixtures/fake-anthropic-api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0737-ui')
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const INHERITED = /^(ANTHROPIC_|CLAUDE)/i
const SCENARIOS: Record<string, Scenario> = {
  ui177: ({ step }) => (step === 0 ? { text: ['bug177 ', 'ui ', 'answer'] } : null),
  ui178: ({ step }) => (step === 0 ? { text: ['bug178 ', 'ui ', 'answer'] } : null),
  ui178b: ({ step }) => (step === 0 ? { text: ['bug178 ', 'resumed ', 'answer'] } : null),
}
const PROMPT_177 = '[[T0727:ui177]] T0737 BUG-177 first message'
const PROMPT_178 = '[[T0727:ui178]] T0737 BUG-178 config dir prompt'
const PROMPT_178B = '[[T0727:ui178b]] T0737 BUG-178 follow-up after /resume'
const CT_KEY = 't0737_probe'

interface SavedTab { id: string; agentPreset?: string; title?: string; sdkSessionId?: string }

function summary(r: FakeRequest): string {
  return `#${r.seq} ${r.method} ${r.url} model=${r.model} scenario=${r.scenario ?? '-'} step=${r.step ?? '-'} tools=${r.tools.length} messages=${r.messageCount}`
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

function makeTempHome(tmp: string): string {
  const home = path.join(tmp, 'home')
  for (const dir of [['AppData', 'Roaming'], ['AppData', 'Local'], ['Documents']]) fs.mkdirSync(path.join(home, ...dir), { recursive: true })
  return home
}

function filesUnder(dir: string, rel = ''): string[] {
  return fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? filesUnder(path.join(dir, e.name), `${rel}${e.name}/`) : [`${rel}${e.name}`]))
    : []
}

/** `rel size mtime` of every file under `dir`, to prove nothing was written there. */
function snapshot(dir: string): string[] {
  return filesUnder(dir).map(rel => { const st = fs.statSync(path.join(dir, rel)); return `${rel} ${st.size} ${st.mtimeMs}` }).sort()
}

const sessionFiles = (claudeDir: string) => filesUnder(path.join(claudeDir, 'projects')).filter(f => f.endsWith('.jsonl'))

function installLocalPlugin(pluginsDir: string, name: string): void {
  const pluginRoot = path.join(pluginsDir, 'cache', 'e2e-local', name, '0.0.1')
  fs.mkdirSync(path.join(pluginRoot, '.claude-plugin'), { recursive: true })
  fs.writeFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), JSON.stringify({ name, version: '0.0.1', description: `${name} (T0737 e2e)` }))
  fs.mkdirSync(path.join(pluginRoot, 'commands'), { recursive: true })
  fs.writeFileSync(path.join(pluginRoot, 'commands', `${name}.md`), `---\ndescription: ${name} probe\n---\nT0737 probe command\n`)
  fs.writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { [`${name}@e2e-local`]: [{ scope: 'user', installPath: pluginRoot, version: '0.0.1' }] } }))
}

/** A Control Tower `tower-config.md` whose § 可用選項 table has one probe key. */
function writeTowerConfig(skillsDir: string, value: string): string {
  const file = path.join(skillsDir, 'control-tower', 'references', 'tower-config.md')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `# Tower Config (T0737 e2e)\n\n### 可用選項\n\n| 選項 | 有效值 | 預設 | 說明 |\n|---|---|---|---|\n| \`${CT_KEY}\` | any | \`${value}\` | T0737 probe |\n\n## Next\n`)
  return file
}

const activeView = (win: Page): Locator => win.locator('.workspace-container.active')
const activePanel = (win: Page): Locator => win.locator('.workspace-container.active .terminal-wrapper.active .claude-agent-panel')

async function savedTabs(win: Page): Promise<SavedTab[]> {
  const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? ((JSON.parse(raw) as { terminals?: SavedTab[] }).terminals ?? []) : []
}

/** Thumbnail "+" → "Claude Agent" (not the Worktree variant); returns the new tab's id. */
async function addClaudeAgentTab(win: Page): Promise<string> {
  const known = new Set((await savedTabs(win)).map(t => t.id))
  await activeView(win).locator('.thumbnail-add-btn').click()
  const item = win.locator('.thumbnail-add-menu-item:not(.disabled)', { hasText: 'Claude Agent', hasNotText: 'Worktree' }).first()
  await expect(item).toBeVisible({ timeout: 10_000 })
  await item.click()
  await expect(activePanel(win)).toBeVisible({ timeout: 45_000 })
  let id = ''
  await expect.poll(async () => {
    id = (await savedTabs(win)).find(t => !known.has(t.id) && t.agentPreset === 'claude-code')?.id ?? ''
    return id
  }, { timeout: 15_000 }).not.toBe('')
  return id
}

async function typeAndEnter(win: Page, text: string): Promise<void> {
  const input = activePanel(win).locator('textarea.claude-input')
  await input.click()
  await input.fill(text)
  await input.press('Enter')
}

/** A built-in slash command the way a user runs it: the menu completes on the first Enter, the second sends. */
async function runSlash(win: Page, name: string): Promise<void> {
  const panel = activePanel(win)
  const input = panel.locator('textarea.claude-input')
  await input.click()
  await input.fill(`/${name}`)
  const menu = panel.locator('.claude-slash-menu:not(.claude-star-menu)')
  await expect(menu.locator('.claude-slash-item.selected .claude-slash-name')).toHaveText(`/${name}`, { timeout: 10_000 })
  await input.press('Enter')
  await expect(menu).toHaveCount(0)
  await expect(input).toHaveValue(`/${name}`)
  await input.press('Enter')
}

async function waitText(panel: Locator, text: string, timeout = 60_000): Promise<void> {
  await expect.poll(async () => (await panel.textContent()) ?? '', { timeout }).toContain(text)
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

/** The panel's card titled `title` (`/model` and `/resume` both render a `.claude-resume-card`). */
const card = (panel: Locator, title: string): Locator => panel.locator('.claude-resume-card', { has: panel.page().locator('.claude-permission-title', { hasText: title }) })

async function installNetRecorders(inst: IsolatedInstance): Promise<void> {
  await inst.app.evaluate(({ session }) => {
    const g = globalThis as AnyApi
    g.__t0737 = { fetch: [] as string[], web: [] as string[] }
    const original = g.fetch
    g.fetch = (input: AnyApi, init?: AnyApi) => {
      try { g.__t0737.fetch.push(typeof input === 'string' ? input : String(input?.url ?? input)) } catch { /* ignore */ }
      return original(input, init)
    }
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (!/^(file|devtools|chrome|chrome-extension|data|blob):/i.test(details.url)) g.__t0737.web.push(details.url)
      callback({})
    })
  })
}

interface NetSeen { fetch: string[]; web: string[] }

async function collectNet(inst: IsolatedInstance, into: NetSeen): Promise<void> {
  const r = await inst.app.evaluate(() => (globalThis as AnyApi).__t0737 ?? { fetch: [], web: [] }).catch(() => ({ fetch: [], web: [] })) as NetSeen
  into.fetch.push(...r.fetch)
  into.web.push(...r.web)
}

const offMachine = (net: NetSeen) => [...net.fetch, ...net.web].filter(u => !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(u))

function seedWorkspace(id: string, name: string, folder: string, tabId: string) {
  return {
    workspaces: [{ id, name, folderPath: folder, createdAt: Date.now() }],
    activeWorkspaceId: id,
    activeGroup: null,
    // A plain shell tab, so the workspace is not empty (no default tab is created for it).
    terminals: [{ id: tabId, workspaceId: id, type: 'terminal', title: 'New Terminal', cwd: folder }],
    activeTerminalId: tabId,
  }
}

async function launchWithSeed(name: string, env: Record<string, string>, seed: object): Promise<IsolatedInstance> {
  const inst = await withoutInheritedClaudeEnv(() => launchIsolated(name, log, { env }))
  await installNetRecorders(inst)
  const { win } = inst
  await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
  expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await expect(activeView(win).locator('.thumbnail-add-btn')).toBeVisible({ timeout: 30_000 })
  return inst
}

test.skip(process.platform !== 'win32', 'embedded claude.exe and pwsh tabs: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)
test.describe.configure({ mode: 'serial' })

test('BUG-177 from the UI: a new Claude Agent tab and its /model list send no model request; one message → one session', async () => {
  test.setTimeout(300_000)
  const results: Record<string, string> = {}
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0737-177-'))
  const home = makeTempHome(tmp)
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0737-'))
  const folder = path.join(root, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const claudeHome = path.join(home, '.claude')
  const userProjects = path.join(os.homedir(), '.claude', 'projects')
  const userProjectsTouched = () => (fs.existsSync(userProjects) ? fs.readdirSync(userProjects).filter(n => /t0737/i.test(n)) : [])
  expect(userProjectsTouched()).toEqual([])
  let fake: FakeAnthropicApi | undefined
  let proxy: BlockingProxy | undefined
  let inst: IsolatedInstance | undefined
  const net: NetSeen = { fetch: [], web: [] }
  let bodyPassed = false
  try {
    fake = await startFakeAnthropicApi(SCENARIOS)
    proxy = await startBlockingProxy()
    const env = {
      ANTHROPIC_BASE_URL: fake.baseUrl,
      ANTHROPIC_API_KEY: 't0737-fake-key',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      USERPROFILE: home,
      HOME: home,
      HTTPS_PROXY: proxy.url,
      HTTP_PROXY: proxy.url,
      NO_PROXY: '127.0.0.1,localhost',
    }
    log(`A: fake API ${fake.baseUrl}; proxy ${proxy.url}; workspace ${folder}; temp home ${home}`)
    inst = await launchWithSeed('t0737-ui177', env, seedWorkspace('e2e-t0737-ui177-ws', 'e2e-t0737-ui177', folder, 'e2e-t0737-ui177-shell'))
    const { win } = inst

    // ── A1: new tab from the menu, left idle ──
    const tabId = await addClaudeAgentTab(win)
    const panel = activePanel(win)
    await win.waitForTimeout(6_000) // BUG-177: the old probe's turn reached the API within ~3 s
    const a1Requests = fake.requests.length
    const a1Files = sessionFiles(claudeHome)
    log(`A1 tab ${tabId} added from the "+" menu; after 6 s: ${a1Requests} model requests ${JSON.stringify(fake.requests.map(summary))}; session files ${JSON.stringify(a1Files)}`)
    expect(fake.requests).toEqual([])
    expect(a1Files).toEqual([])
    results.A1 = `PASS — Claude Agent tab ${tabId} added from the thumbnail "+" menu; 6 s idle: 0 model requests, 0 session files under the temp home`

    // ── A2: /model list, pick another model ──
    await runSlash(win, 'model')
    const models = card(panel, 'Select a model')
    await expect(models).toBeVisible({ timeout: 15_000 })
    await expect(models.locator('.claude-model-group-label', { hasText: 'Claude Agent' })).toBeVisible({ timeout: 60_000 }) // the CLI's own list arrived
    const items = models.locator('.claude-resume-item')
    const rows = await items.evaluateAll(els => els.map(el => ({ name: el.querySelector('.claude-resume-item-id')?.textContent ?? '', active: el.classList.contains('active') })))
    const pick = rows.findIndex(r => !r.active && !/1m/i.test(r.name) && /sonnet/i.test(r.name))
    const index = pick >= 0 ? pick : rows.findIndex(r => !r.active && !/1m/i.test(r.name))
    expect(index).toBeGreaterThanOrEqual(0)
    await items.nth(index).click()
    await expect(models).toHaveCount(0)
    const footer = (await panel.locator('.claude-status-btn', { hasText: '</>' }).first().textContent().catch(() => '')) ?? ''
    await win.waitForTimeout(5_000)
    const a2Files = sessionFiles(claudeHome)
    log(`A2 /model list: ${rows.length} rows ${JSON.stringify(rows.map(r => `${r.active ? '*' : ''}${r.name}`))}; picked ${JSON.stringify(rows[index].name)}; footer ${JSON.stringify(footer)}; model requests ${fake.requests.length}; session files ${JSON.stringify(a2Files)}`)
    expect(fake.requests).toEqual([])
    expect(a2Files).toEqual([])
    results.A2 = `PASS — typed /model: the list loaded (${rows.length} rows incl. the CLI's "Claude Agent" group), picked ${JSON.stringify(rows[index].name)}; 0 model requests, 0 session files`

    // ── A3: one message → one session, /resume shows only it ──
    await typeAndEnter(win, PROMPT_177)
    const first = await fake.waitFor('ui177', 0, 90_000)
    await waitText(panel, 'bug177 ui answer')
    const sdkSessionId = await sdkSessionIdOf(win, tabId)
    await expect.poll(() => sessionFiles(claudeHome).length, { timeout: 30_000 }).toBe(1)
    await win.waitForTimeout(3_000) // the panel now reads the model list again (session meta arrived)
    const a3Files = sessionFiles(claudeHome)
    expect(a3Files).toHaveLength(1)
    expect(a3Files[0].endsWith(`${sdkSessionId}.jsonl`)).toBe(true)
    await runSlash(win, 'resume')
    const resumeCard = panel.locator('.claude-resume-card')
    await expect(resumeCard).toBeVisible({ timeout: 15_000 })
    await expect(resumeCard.locator('.claude-resume-empty', { hasText: 'Loading' })).toHaveCount(0, { timeout: 30_000 })
    const listed = await resumeCard.locator('.claude-resume-item .claude-resume-item-id').allTextContents()
    await panel.screenshot({ path: test.info().outputPath('t0737-a3-resume-list.png') })
    log(`A3 request ${summary(first)}; session ${sdkSessionId}; session files ${JSON.stringify(a3Files)}; /resume list ${JSON.stringify(listed)}; requests total ${fake.requests.length} ${JSON.stringify(fake.requests.map(summary))}`)
    expect(listed).toEqual([sdkSessionId.slice(0, 8)])
    await activePanel(win).locator('textarea.claude-input').press('Escape')
    // Every model request belongs to the marked conversation (no blank-prompt probe turn).
    expect(fake.requests.filter(r => r.tools.length > 0 && !r.userText.includes('[[T0727:')).map(summary)).toEqual([])
    results.A3 = `PASS — one message: request model=${first.model}; exactly 1 session file (${sdkSessionId.slice(0, 8)}…); /resume lists exactly [${listed.join(', ')}]; ${fake.requests.length} model request(s) in total, all from the marked conversation`
    await collectNet(inst, net)
    bodyPassed = true
  } finally {
    if (inst) {
      await collectNet(inst, net)
      await closeIsolated(inst, log)
    }
    log(`A blocking proxy attempts: ${JSON.stringify(proxy?.attempts ?? [])}; off-machine main fetch / webRequest: ${JSON.stringify(offMachine(net))}`)
    for (const [k, v] of Object.entries(results)) log(`${k} ${v}`)
    await fake?.close()
    await proxy?.close()
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
  }
  if (bodyPassed) {
    expect(proxy!.attempts).toEqual([])
    expect(offMachine(net)).toEqual([])
    expect(fake!.requests.every(r => r.url.startsWith('/v1/messages'))).toBe(true)
    expect(userProjectsTouched()).toEqual([])
  }
})

test('BUG-178 from the UI: CLAUDE_CONFIG_DIR drives the session, /resume, plugins and the *config default layer; HOME/.claude untouched', async () => {
  test.setTimeout(420_000)
  const results: Record<string, string> = {}
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0737-178-'))
  const home = makeTempHome(tmp)
  const homeClaude = path.join(home, '.claude')
  const configDir = path.join(tmp, 'claude-config')
  installLocalPlugin(path.join(configDir, 'plugins'), 't0737-cfg')
  installLocalPlugin(path.join(homeClaude, 'plugins'), 't0737-home') // decoy
  const cfgTowerConfig = writeTowerConfig(path.join(configDir, 'skills'), 't0737-from-config-dir')
  writeTowerConfig(path.join(homeClaude, 'skills'), 't0737-from-home') // decoy: the pre-T0730 default layer
  const homeBefore = snapshot(homeClaude)
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0737-'))
  const folder = path.join(root, 'ws')
  fs.mkdirSync(path.join(folder, '_ct-workorders'), { recursive: true })
  const userProjects = path.join(os.homedir(), '.claude', 'projects')
  const userProjectsTouched = () => (fs.existsSync(userProjects) ? fs.readdirSync(userProjects).filter(n => /t0737/i.test(n)) : [])
  let fake: FakeAnthropicApi | undefined
  let proxy: BlockingProxy | undefined
  let inst: IsolatedInstance | undefined
  const net: NetSeen = { fetch: [], web: [] }
  let bodyPassed = false
  try {
    fake = await startFakeAnthropicApi(SCENARIOS)
    proxy = await startBlockingProxy()
    const env = {
      ANTHROPIC_BASE_URL: fake.baseUrl,
      ANTHROPIC_API_KEY: 't0737-fake-key',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      CLAUDE_CONFIG_DIR: configDir,
      USERPROFILE: home,
      HOME: home,
      HTTPS_PROXY: proxy.url,
      HTTP_PROXY: proxy.url,
      NO_PROXY: '127.0.0.1,localhost',
    }
    log(`B: fake API ${fake.baseUrl}; workspace ${folder}; temp home ${home}; CLAUDE_CONFIG_DIR ${configDir}`)
    const seed = seedWorkspace('e2e-t0737-ui178-ws', 'e2e-t0737-ui178', folder, 'e2e-t0737-ui178-shell')
    inst = await launchWithSeed('t0737-ui178', env, seed)
    const runtimeId = inst.runtimeId
    let win = inst.win

    // ── B1: tab from the menu, one message ──
    const tabId = await addClaudeAgentTab(win)
    const panel = activePanel(win)
    await typeAndEnter(win, PROMPT_178)
    const first = await fake.waitFor('ui178', 0, 90_000)
    await waitText(panel, 'bug178 ui answer')
    const sdkSessionId = await sdkSessionIdOf(win, tabId)
    await expect.poll(() => sessionFiles(configDir).some(f => f.endsWith(`${sdkSessionId}.jsonl`)), { timeout: 30_000 }).toBe(true)
    const inConfig = sessionFiles(configDir)
    const inHome = sessionFiles(homeClaude)
    log(`B1 tab ${tabId}; request ${summary(first)}; session files: CLAUDE_CONFIG_DIR ${JSON.stringify(inConfig)}; HOME/.claude ${JSON.stringify(inHome)}`)
    expect(inHome).toEqual([])
    results.B1 = `PASS — Claude Agent tab from the "+" menu, one message → session ${sdkSessionId.slice(0, 8)}… under CLAUDE_CONFIG_DIR (${inConfig.length} file), none under HOME/.claude`

    // ── B2: the slash menu offers the CLAUDE_CONFIG_DIR plugin's command ──
    const input = panel.locator('textarea.claude-input')
    await input.click()
    await input.fill('/t0737')
    const slash = panel.locator('.claude-slash-menu:not(.claude-star-menu)')
    let slashNames: string[] = []
    await expect.poll(async () => {
      slashNames = (await slash.locator('.claude-slash-name').allTextContents().catch(() => [])) as string[]
      return slashNames.some(n => n.includes('t0737-cfg'))
    }, { timeout: 30_000 }).toBe(true)
    log(`B2 slash menu for "/t0737": ${JSON.stringify(slashNames)}`)
    expect(slashNames.some(n => n.includes('t0737-home'))).toBe(false)
    await input.fill('')
    results.B2 = `PASS — typing "/t0737" offers ${JSON.stringify(slashNames)} (plugin under CLAUDE_CONFIG_DIR); the HOME/.claude decoy t0737-home is not offered`

    // ── B3: Tower › overview, the *config default layer ──
    // Default docking puts the Tower panel in the right sidebar (DEFAULT_DOCKING_CONFIG); a docked-to-main
    // layout shows it as a workspace tab instead.
    const sidebarTab = win.locator('.right-sidebar-tab:visible', { hasText: /^(Tower|塔台)$/ })
    const collapsedBtn = win.locator('.right-sidebar-collapsed-btn:visible[title="Tower"], .right-sidebar-collapsed-btn:visible[title="塔台"]')
    const mainTab = activeView(win).locator('.workspace-tab-btn:visible', { hasText: /^(Tower|塔台)$/ })
    const opener = (await sidebarTab.count()) > 0 ? sidebarTab : (await collapsedBtn.count()) > 0 ? collapsedBtn : mainTab
    log(`B3 opening the Tower panel via ${(await sidebarTab.count()) > 0 ? 'the right sidebar tab' : (await collapsedBtn.count()) > 0 ? 'the collapsed right sidebar button' : 'the workspace tab bar'}`)
    await opener.first().click()
    // The panel opens on its last sub-tab; the first one is 總覽 / Overview (`activeTab === 'sprint'`).
    const ctPanel = win.locator('.ct-panel:visible')
    await expect(ctPanel).toHaveCount(1, { timeout: 30_000 })
    await ctPanel.locator('.ct-tabs .ct-tab').first().click()
    const overview = win.locator('.ct-overview:visible')
    await expect(overview).toBeVisible({ timeout: 30_000 })
    const layers = overview.locator('.ct-overview-layer')
    let layerTexts: string[] = []
    await expect.poll(async () => {
      layerTexts = await layers.allTextContents()
      return layerTexts.some(t => t.includes('tower-config.md'))
    }, { timeout: 30_000 }).toBe(true)
    const row = overview.locator('.ct-overview-config-row', { has: win.locator('.ct-overview-config-key', { hasText: CT_KEY }) })
    await expect(row).toHaveCount(1, { timeout: 15_000 })
    const rowValue = (await row.locator('.ct-overview-config-value').textContent()) ?? ''
    const rowSource = (await row.locator('.ct-overview-source').getAttribute('class')) ?? ''
    await overview.screenshot({ path: test.info().outputPath('t0737-b3-config-layers.png') })
    log(`B3 overview layers ${JSON.stringify(layerTexts)}; ${CT_KEY} = ${JSON.stringify(rowValue)} (${rowSource})`)
    expect(layerTexts.some(t => t.includes(cfgTowerConfig))).toBe(true)
    expect(layerTexts.some(t => t.includes(path.join(homeClaude, 'skills')))).toBe(false)
    expect(rowValue).toBe('t0737-from-config-dir')
    expect(rowSource).toContain('ct-overview-source-default')
    results.B3 = `PASS — Tower › overview default layer = ${cfgTowerConfig}; ${CT_KEY} shows "t0737-from-config-dir" from the default layer (HOME/.claude decoy "t0737-from-home" not read)`
    if (opener === mainTab) await activeView(win).locator('.workspace-tab-btn').first().click()
    await expect(activePanel(win)).toBeVisible({ timeout: 15_000 })

    await collectNet(inst, net)
    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined

    // ── B4: relaunch, history; a new tab resumes the session through /resume ──
    inst = await withoutInheritedClaudeEnv(() => launchIsolated('t0737-ui178', log, { env, runtimeId }))
    await installNetRecorders(inst)
    win = inst.win
    await expect(activePanel(win)).toBeVisible({ timeout: 45_000 })
    const restored = activePanel(win)
    await waitText(restored, 'bug178 ui answer')
    await waitText(restored, 'T0737 BUG-178 config dir prompt')
    const restoreRequests = fake.requests.length
    const tab2 = await addClaudeAgentTab(win)
    const panel2 = activePanel(win)
    await runSlash(win, 'resume')
    const resumeCard = panel2.locator('.claude-resume-card')
    await expect(resumeCard).toBeVisible({ timeout: 15_000 })
    await expect(resumeCard.locator('.claude-resume-empty', { hasText: 'Loading' })).toHaveCount(0, { timeout: 30_000 })
    const listed = await resumeCard.locator('.claude-resume-item .claude-resume-item-id').allTextContents()
    log(`B4 /resume in new tab ${tab2}: ${JSON.stringify(listed)}`)
    expect(listed).toContain(sdkSessionId.slice(0, 8))
    await resumeCard.locator('.claude-resume-item', { hasText: sdkSessionId.slice(0, 8) }).click()
    await waitText(panel2, 'bug178 ui answer')
    await waitText(panel2, 'T0737 BUG-178 config dir prompt')
    await typeAndEnter(win, PROMPT_178B)
    const followUp = await fake.waitFor('ui178b', 0, 90_000)
    await waitText(panel2, 'bug178 resumed answer')
    await panel2.screenshot({ path: test.info().outputPath('t0737-b4-resumed.png') })
    const carried = followUp.userText.includes('T0737 BUG-178 config dir prompt')
    log(`B4 follow-up ${summary(followUp)} carriesEarlierConversation=${carried}; model requests up to the restore: ${restoreRequests}`)
    expect(carried).toBe(true)
    results.B4 = `PASS — relaunched: the restored tab shows the prompt and answer; new tab ${tab2} from the menu → /resume lists [${listed.join(', ')}] → picked ${sdkSessionId.slice(0, 8)} → history rebuilt; the next message carried the earlier conversation (${followUp.messageCount} messages)`
    await collectNet(inst, net)
    bodyPassed = true
  } finally {
    if (inst) {
      await collectNet(inst, net)
      await closeIsolated(inst, log)
    }
    const homeAfter = snapshot(homeClaude)
    const changed = [...homeAfter.filter(x => !homeBefore.includes(x)), ...homeBefore.filter(x => !homeAfter.includes(x)).map(x => `-${x}`)]
    log(`B5 HOME/.claude: ${homeBefore.length} files seeded, ${homeAfter.length} after; changed ${JSON.stringify(changed)}; HOME top level ${JSON.stringify(fs.existsSync(home) ? fs.readdirSync(home) : [])}`)
    if (bodyPassed) results.B5 = changed.length === 0 ? `PASS — HOME/.claude unchanged (${homeAfter.length} seeded decoy files, same size / mtime)` : `FAIL — changed ${JSON.stringify(changed)}`
    log(`B model requests (${fake?.requests.length ?? 0}): ${(fake?.requests ?? []).map(summary).join(' | ')}`)
    log(`B blocking proxy attempts: ${JSON.stringify(proxy?.attempts ?? [])}; off-machine main fetch / webRequest: ${JSON.stringify(offMachine(net))}`)
    for (const [k, v] of Object.entries(results)) log(`${k} ${v}`)
    await fake?.close()
    await proxy?.close()
    if (bodyPassed) expect(changed).toEqual([])
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
  }
  if (bodyPassed) {
    expect(proxy!.attempts).toEqual([])
    expect(offMachine(net)).toEqual([])
    expect(fake!.requests.every(r => r.url.startsWith('/v1/messages'))).toBe(true)
    expect(userProjectsTouched()).toEqual([])
  }
})
