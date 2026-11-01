// T0757 / BUG-188 (D209): an answer by mouse clears the "waiting for you" ⚠️ like a key does.
//
// Real prompts, real clicks: the embedded claude CLI (2.1.316, its fullscreen renderer `tui: fullscreen` —
// alt screen + mouse tracking, what a user who answers by mouse runs) and the embedded codex TUI, answered
// by Playwright clicks on the terminal canvas, so xterm itself writes the mouse reports into the PTY. No
// token, nothing leaves the machine (as T0736): fixtures/fake-anthropic-api.ts, a fake Responses API, a
// blocking proxy, a temp home; an MCP server in this file asks for an elicitation.
//
// Verification (T0757 probe, build before the fix; `T0757_PROBE=1` re-runs it, e.g. after a claude / codex
// upgrade):
//   ① permission, click "1. Yes"            → `post-tool-batch` ~0.6 s later → cleared (T0657)
//   ② permission, click "4. No"             → claude interrupts the turn: no hook at all (no PostToolBatch,
//                                              no Stop) → ⚠️ stayed until the next key / prompt (BUG-188)
//   ③ question, click "1. Alpha"            → `ask-user-question-done` ~0.2 s later → cleared (T0597)
//   ④ question, click "Chat about this"     → claude ignores the click (dialog stays; Esc closes it)
//   ⑤ elicitation, click "Accept"/"Decline" → claude ignores clicks in the form (stays; Esc closes it)
//   ⑥ codex 0.166 approval, click an option → codex ignores the click: no OSC 7501, `input` stays; `y` answers
//
// Fix (D209 fallback, ② has no signal): a left-button press in a blocked tab clears the hook reason
// (`hasMouseButtonPress`, electron/terminal-blocked-state.ts; `→ cleared (mouse press)`), never codex
// `input`, and is still not user input for `--close-worker` / the usage-limit wait.
//
// Acceptance (default run): W the wheel over a blocked tab does not clear; ①–⑤ a click clears the
// thumbnail ⚠️ and the workspace row ⚠️, without a faded mark (the tab is looked at, D203); K Enter
// clears as before; ⑥ a click on codex's approval leaves `input` (⚠️ stays), `y` clears it.
// Without the fix the run fails at ② (mutation check, T0757 report). Windows only; `npx vite build` first.
// claude 2.1.316 also ignored a click right after the terminal got the focus back (focus-out / -in) and after
// a wheel scroll — so the spec does not click the thumbnail and scrolls last (W, before the keyboard answer K).
import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { startBlockingProxy, startFakeAnthropicApi, type FakeAnthropicApi, type Scenario } from './fixtures/fake-anthropic-api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0757')
const WS = 'e2e-t0757'
const TAB_SHELL = 'e2e-t0757-shell'
const FAKE_KEY = 'sk-t0757-fake-key-not-checked-0000000000'
const CODEX_MARK = 'T0757-CODEX-PROMPT'
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const INHERITED = /^(ANTHROPIC_|CLAUDE|OPENAI_|CODEX_)/i
const CLAUDE_ITEM = /^\s*▶\s*Claude CLI\s*(suggested|建議|建议)?\s*$/
const CODEX_ITEM = /Codex CLI/
const PERM_CMD = (tag: string) => `curl -s --max-time 3 http://127.0.0.1:9/${tag}`
const ELIC_TOOL = 'mcp__t0757elic__ask'

const ask = (q: string) => ({ tool: { name: 'AskUserQuestion', input: { questions: [{
  question: q, header: 'T0757', multiSelect: false,
  options: [{ label: 'Alpha', description: 'the first option' }, { label: 'Beta', description: 'the second option' }],
}] } } })
const bash = (tag: string) => ({ tool: { name: 'Bash', input: { command: PERM_CMD(tag), description: `T0757 ${tag} probe (closed local port)` } } })

const SCENARIOS: Record<string, Scenario> = {
  't0757-perm-allow': ({ step }) => [bash('allow'), { text: ['allow ', 'done'] }][step] ?? null,
  't0757-perm-deny': ({ step }) => [bash('deny'), { text: ['deny ', 'done'] }][step] ?? null,
  't0757-ask-pick': ({ step }) => [ask('T0757 pick one?'), { text: ['pick ', 'done'] }][step] ?? null,
  't0757-ask-cancel': ({ step }) => [ask('T0757 cancel me?'), { text: ['cancel ', 'done'] }][step] ?? null,
  't0757-elic': ({ step }) => [{ tool: { name: ELIC_TOOL, input: {} } }, { text: ['elic ', 'done'] }][step] ?? null,
}

/** A zero-dependency stdio MCP server: one tool whose call asks the client for an elicitation. */
const ELIC_SERVER = `
const out = m => process.stdout.write(JSON.stringify(m) + '\\n')
let buf = ''
let pending = null
process.stdin.on('data', d => {
  buf += d
  let i
  while ((i = buf.indexOf('\\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
    if (!line) continue
    let m; try { m = JSON.parse(line) } catch { continue }
    if (m.method === 'initialize') out({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 't0757elic', version: '1.0.0' } } })
    else if (m.method === 'tools/list') out({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'ask', description: 'T0757 elicitation probe', inputSchema: { type: 'object', properties: {} } }] } })
    else if (m.method === 'tools/call') { pending = m.id; out({ jsonrpc: '2.0', id: 'elic-1', method: 'elicitation/create', params: { mode: 'form', message: 'T0757 elicitation: pick', requestedSchema: { type: 'object', properties: { choice: { type: 'string', enum: ['red', 'blue'] } }, required: ['choice'] } } }) }
    else if (m.id === 'elic-1') { out({ jsonrpc: '2.0', id: pending, result: { content: [{ type: 'text', text: 'elicitation ' + JSON.stringify(m.result && m.result.action) }] } }) }
    else if (m.method === 'ping') out({ jsonrpc: '2.0', id: m.id, result: {} })
    else if (m.id !== undefined && m.method) out({ jsonrpc: '2.0', id: m.id, result: {} })
  }
})
`

function codexVersion(bin: string): string | null {
  try {
    return /codex-cli\s+v?(\d+\.\d+\.\d+)/.exec(execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 15_000, windowsHide: true }))?.[1] ?? null
  } catch { return null }
}
function findCodex(): { bin: string; version: string } | null {
  if (process.platform !== 'win32') return null
  const vendor = path.join(REPO_ROOT, 'node_modules', '@openai', `codex-${process.platform}-${process.arch}`, 'vendor')
  const candidates: string[] = process.env.BAT_E2E_CODEX ? [process.env.BAT_E2E_CODEX] : []
  try { for (const triple of fs.readdirSync(vendor)) candidates.push(path.join(vendor, triple, 'bin', 'codex.exe')) } catch { /* none */ }
  for (const bin of candidates) {
    if (!fs.existsSync(bin)) continue
    const version = codexVersion(bin)
    if (version) return { bin, version }
  }
  return null
}
const CODEX = findCodex()

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
      if (hasOutput || !prompted || tools.length === 0 || (toolSent && !JSON.stringify(j.input ?? []).includes(`${CODEX_MARK}-again`))) {
        sse(res, [
          { type: 'response.created', response: { id } },
          { type: 'response.output_item.done', item: { type: 'message', role: 'assistant', id: `msg_${id}`, content: [{ type: 'output_text', text: 'ok' }] } },
          { type: 'response.completed', response: { id, usage } },
        ])
        return
      }
      toolSent = true
      const [name, args] = tools.includes('shell_command')
        ? ['shell_command', { command: toolCommand, sandbox_permissions: 'require_escalated', justification: 'T0757 approval probe' }]
        : ['exec_command', { cmd: toolCommand, sandbox_permissions: 'require_escalated', justification: 'T0757 approval probe' }]
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

interface SavedTab { id: string; workspaceId: string; title?: string; agentPreset?: string }

/** In the renderer: the xterm Terminal of tab `id` (TerminalPanel's ref, found through React's fiber). */
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

/** Clicks the first visible screen cell of tab `id` whose line matches `re` (at the match). */
async function clickText(win: Page, id: string, re: RegExp, opts: { button?: 'left' | 'right' | 'middle' } = {}): Promise<{ row: number; col: number; line: string }> {
  const s = await screenOf(win, id)
  if (!s) throw new Error(`no xterm for ${id}`)
  let hit: { row: number; col: number; line: string } | null = null
  for (let row = s.lines.length - 1; row >= 0; row--) {
    const m = re.exec(s.lines[row])
    // the middle of the matched word: a click on the blank between "1." and the label is not on the option
    if (m) { hit = { row, col: m.index + Math.floor((m[0].length - 1) / 2), line: s.lines[row] }; break }
  }
  if (!hit) throw new Error(`text ${re} not on screen of ${id}:\n${s.lines.join('\n')}`)
  const rect = await screenRect(win, id)
  const x = rect.x + (hit.col + 0.5) * (rect.width / s.cols)
  const y = rect.y + (hit.row + 0.5) * (rect.height / s.rows)
  // what xterm writes for the click (evidence that the report went to the PTY)
  await win.evaluate(({ id, src }) => {
    // eslint-disable-next-line no-new-func
    const found = (new Function(`return (${src})`)())(id)
    const w = window as unknown as { __t0757Sent?: string[]; __t0757Sub?: { dispose(): void } }
    w.__t0757Sub?.dispose()
    w.__t0757Sent = []
    // the user clicks a terminal they are typing in: focused first (claude ignores the click that comes
    // with a focus-in `ESC [ I`, as when the thumbnail had the focus)
    found.term.focus()
    w.__t0757Sub = found.term.onData((d: string) => { w.__t0757Sent!.push(d) })
  }, { id, src: XTERM_OF })
  await win.waitForTimeout(300)
  await win.mouse.move(x, y)
  await win.mouse.down(opts)
  await win.waitForTimeout(60)
  await win.mouse.up(opts)
  await win.waitForTimeout(200)
  const sent = await win.evaluate(() => (window as unknown as { __t0757Sent?: string[] }).__t0757Sent ?? [])
  log(`click ${re} on ${id}: row ${hit.row} col ${hit.col} (${Math.round(x)},${Math.round(y)}) "${hit.line.trim().slice(0, 60)}" → xterm sent ${JSON.stringify(sent.join('')).slice(0, 120)}`)
  return hit
}

/** The page rectangle of tab `id`'s xterm screen. */
async function screenRect(win: Page, id: string): Promise<{ x: number; y: number; width: number; height: number }> {
  return win.evaluate(({ id, src }) => {
    // eslint-disable-next-line no-new-func
    const found = (new Function(`return (${src})`)())(id)
    const r = found.el.querySelector('.xterm-screen').getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: r.height }
  }, { id, src: XTERM_OF })
}

async function withoutInheritedAgentEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (INHERITED.test(k) && v !== undefined) { saved[k] = v; delete process.env[k] }
  try { return await fn() } finally { Object.assign(process.env, saved) }
}

const slash = (p: string) => p.split(path.sep).join('/')
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The temp home, fakes, isolated BAT with one workspace (a shell tab) and the helpers both tests use. */
async function startRig() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0757-'))
  const home = path.join(tmp, 'home')
  for (const dir of [['AppData', 'Roaming'], ['AppData', 'Local'], ['Documents']]) fs.mkdirSync(path.join(home, ...dir), { recursive: true })
  // under %ProgramData% (as T0727 / T0736): claude loads every ancestor's CLAUDE.md
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0757-'))
  const folder = path.join(root, 'w')
  const codexHome = path.join(tmp, 'codex-home')
  for (const dir of [folder, codexHome]) fs.mkdirSync(dir, { recursive: true })
  const elicServer = path.join(tmp, 'elic-server.cjs')
  fs.writeFileSync(elicServer, ELIC_SERVER)
  const projectEntry = {
    hasTrustDialogAccepted: true, hasCompletedProjectOnboarding: true, allowedTools: [],
    mcpServers: { t0757elic: { type: 'stdio', command: process.execPath, args: [slash(elicServer)] } },
  }
  // `tui: fullscreen` = claude's fullscreen renderer (alt screen + mouse), the setting a user who answers by mouse has
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({
    hasCompletedOnboarding: true, theme: 'dark', numStartups: 5, hasSeenAutoDefaultNudge: true, tui: 'fullscreen',
    customApiKeyResponses: { approved: [FAKE_KEY.slice(-20)], rejected: [] },
    projects: { [folder]: projectEntry, [slash(folder)]: projectEntry },
  }))
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ tui: 'fullscreen', permissions: { defaultMode: 'default', allow: [ELIC_TOOL] } }))

  const fake: FakeAnthropicApi = await startFakeAnthropicApi(SCENARIOS)
  const fakeCodex = await startFakeResponses('Write-Output t0757-codex')
  const proxy = await startBlockingProxy()
  fs.writeFileSync(path.join(codexHome, 'config.toml'), [
    'model = "gpt-mock"', 'model_provider = "mock"', 'check_for_update_on_startup = false', '',
    '[analytics]', 'enabled = false', '',
    '[model_providers.mock]', 'name = "mock"', `base_url = "http://127.0.0.1:${fakeCodex.port}/v1"`, 'wire_api = "responses"', '',
    `[projects.'${folder}']`, 'trust_level = "trusted"', '',
  ].join('\n'))
  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: fake.baseUrl, ANTHROPIC_API_KEY: FAKE_KEY,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
    USERPROFILE: home, HOME: home, HTTPS_PROXY: proxy.url, HTTP_PROXY: proxy.url, NO_PROXY: '127.0.0.1,localhost',
    PATH: `${CODEX ? `${path.dirname(CODEX.bin)};` : ''}${process.env.PATH ?? ''}`, CODEX_HOME: codexHome,
  }
  log(`fake Anthropic API ${fake.baseUrl}; fake Responses 127.0.0.1:${fakeCodex.port}; proxy ${proxy.url}; codex ${CODEX?.version ?? 'none'}; folder ${folder}`)

  let inst: IsolatedInstance | undefined
  const cleanup = async () => {
    if (inst) await closeIsolated(inst, log)
    await fake.close()
    await fakeCodex.close()
    await proxy.close()
    for (const dir of [tmp, root]) {
      try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 }) } catch (e) { log(`could not remove ${dir}: ${e instanceof Error ? e.message : String(e)}`) }
    }
  }
  try {
    inst = await withoutInheritedAgentEnv(() => launchIsolated('t0757', log, { env }))
  } catch (e) {
    await cleanup()
    throw e
  }
  const { app, win, userData } = inst
  const debugLog = () => {
    const dir = path.join(userData, 'Logs')
    return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  }
  const scriptsLog = () => { const f = path.join(userData, 'Logs', 'bat-scripts.log'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '' }
  /** `[blocked]` / `[turn]` / `[codex-state]` lines of tab `id` written after `mark` (a `debugLog().length`). */
  const linesSince = (id: string, mark: number) => debugLog().slice(mark).split('\n')
    .filter(l => l.includes(`terminal=${id}`) && /\[(blocked|turn|codex-state|agent-start)\]/.test(l))
    .map(l => l.replace(/^.*?\[(blocked|turn|codex-state|agent-start)\]/, '[$1]'))
  /** `report-hook` entries of tab `id` in bat-scripts.log written after `mark`. */
  const hooksSince = (id: string, mark: number) => scriptsLog().slice(mark).split('\n')
    .filter(l => l.includes(id) && l.includes('report-hook'))
    .map(l => { try { const j = JSON.parse(l.slice(l.indexOf('{'))); return `${j.hook}→${j.result}` } catch { return l.slice(0, 160) } })
  const savedTabs = async (): Promise<SavedTab[]> => {
    const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
    return raw ? (JSON.parse(raw) as { terminals: SavedTab[] }).terminals : []
  }
  const write = (id: string, data: string) => win.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: id, d: data })
  /** Waits for a line of tab `id` after `mark`; on a miss logs the tab's screen and rethrows. */
  const waitLine = async (id: string, mark: number, re: RegExp, what: string, timeout = 60_000) => {
    try {
      await expect.poll(() => linesSince(id, mark).some(l => re.test(l)), { timeout }).toBe(true)
    } catch (error) {
      log(`${what}: not seen. screen of ${id}:\n${(await screenOf(win, id))?.lines.join('\n')}`)
      log(`lines of ${id} since the mark: ${JSON.stringify(linesSince(id, mark))}`)
      throw error
    }
  }
  const waitStart = (id: string, re: RegExp, what: string) => waitLine(id, 0, re, what, 90_000)
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
  const typePrompt = async (id: string, text: string) => { await write(id, text); await win.waitForTimeout(600); await write(id, '\r') }

  await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
  const seed = {
    workspaces: [{ id: WS, name: WS, folderPath: folder, createdAt: Date.now(), agentCustomArgs: { 'codex-cli': '-a on-request -s read-only' } }],
    activeWorkspaceId: WS, activeGroup: null,
    terminals: [{ id: TAB_SHELL, workspaceId: WS, type: 'terminal', title: 'T0757 shell', cwd: folder }],
    activeTerminalId: TAB_SHELL,
  }
  expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TAB_SHELL), { timeout: 30_000 }).not.toBeNull()

  return { app, win, userData, fake, fakeCodex, proxy, debugLog, scriptsLog, linesSince, hooksSince, savedTabs, write, waitLine, waitStart, addFromMenu, typePrompt, cleanup }
}

test.skip(process.platform !== 'win32', 'embedded claude.exe / codex.exe and pwsh tabs: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)

test('a mouse answer clears ⚠️ (thumbnail + workspace row) like a key does; the wheel does not; codex input stays its own (no token)', async () => {
  test.skip(!!process.env.T0757_PROBE, 'T0757_PROBE=1 runs the probe only')
  test.setTimeout(600_000)
  const results: Record<string, string> = {}
  const rig = await startRig()
  try {
    const { app, win, fake, debugLog, linesSince, hooksSince, scriptsLog, write, waitLine, waitStart, addFromMenu, typePrompt } = rig
    const thumbOf = (title: string) => win.locator('.workspace-container.active .thumbnail')
      .filter({ has: win.locator('.thumbnail-title > span', { hasText: new RegExp(`^${escapeRe(title)}$`) }) })
    const rowBadge = win.locator('.workspace-item', { hasText: WS }).locator('.workspace-waiting-badge')

    const cli = await addFromMenu(CLAUDE_ITEM)
    await waitStart(cli.id, /\[agent-start\] .*→ started \(hook session-start\)/, 'claude SessionStart')
    // the new tab is active and its terminal focused; no click on its thumbnail: that blurs the terminal
    // (focus-out to claude), and claude 2.1.316 then ignored the next clicks on its dialog in runs of this spec
    await expect(thumbOf(cli.title!)).toHaveClass(/\bactive\b/)
    await win.waitForTimeout(2_000)
    const s0 = await screenOf(win, cli.id)
    log(`claude: mouse tracking ${s0?.mouse}, ${s0?.buffer} buffer, ${s0?.cols}x${s0?.rows}`)
    expect(s0?.mouse, 'claude fullscreen renderer tracks the mouse').not.toBe('none')

    // looked at = the active tab of a focused window (D203: an answer while looked at leaves no faded ⚠️)
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus() })
    await win.evaluate(() => window.dispatchEvent(new Event('focus')))
    const focused = await win.evaluate(() => document.hasFocus())
    log(`document.hasFocus() = ${focused}`)
    if (!focused) test.info().annotations.push({ type: 'skip-step', description: 'window focus unavailable: the "no faded ⚠️" checks are skipped' })

    /** Prompt → blocked (⚠️ on the thumbnail and the row); returns the log marks taken before the prompt. */
    const block = async (key: string, scenario: string, reason: string) => {
      const mark = { debug: debugLog().length, scripts: scriptsLog().length }
      await typePrompt(cli.id, `[[T0727:${scenario}]] go`)
      await fake.waitFor(scenario, 0, 60_000)
      await waitLine(cli.id, mark.debug, new RegExp(`→ blocked reason=${reason} `), `${key} blocked`)
      await expect(thumbOf(cli.title!).locator('.attention-badge.blocked')).toHaveCount(1, { timeout: 15_000 })
      await expect(rowBadge).toHaveText('⚠️', { timeout: 15_000 })
      await expect(rowBadge).toHaveAttribute('data-waiting', 'waiting')
      // the dialog is drawn and takes input (a click within ~1 s of the prompt showing up was ignored in runs of this spec)
      await win.waitForTimeout(2_000)
      return mark
    }
    /** ⚠️ gone from the thumbnail and the row, no faded mark (looked at). */
    const expectCleared = async (key: string, mark: { debug: number; scripts: number }, cause: RegExp) => {
      await waitLine(cli.id, mark.debug, /→ cleared \(/, `${key} cleared`, 15_000)
      const cleared = linesSince(cli.id, mark.debug).find(l => /→ cleared \(/.test(l))!
      expect(cleared).toMatch(cause)
      if (focused) {
        await expect(thumbOf(cli.title!).locator('.attention-badge')).toHaveCount(0, { timeout: 15_000 })
        await expect(rowBadge).toHaveCount(0, { timeout: 15_000 })
      } else {
        await expect(thumbOf(cli.title!).locator('.attention-badge.blocked')).toHaveCount(0, { timeout: 15_000 })
      }
      return cleared
    }
    const settle = async (scenario: string, step1: boolean) => {
      if (step1) await fake.waitFor(scenario, 1, 30_000)
      await win.waitForTimeout(2_500)
    }

    // ── ① permission, click "1. Yes" ──
    let mark = await block('①', 't0757-perm-allow', 'permission')
    await clickText(win, cli.id, /(?<=1\. )Yes/)
    let cleared = await expectCleared('①', mark, /\(mouse press\)|\(hook post-tool-batch\)/)
    await settle('t0757-perm-allow', true)
    results['①'] = `PASS — permission, click "1. Yes": ${cleared}; hooks ${JSON.stringify(hooksSince(cli.id, mark.scripts))}; the tool ran`

    // ── ② permission, click "4. No": claude interrupts the turn, no hook at all → the press clears ──
    mark = await block('②', 't0757-perm-deny', 'permission')
    await clickText(win, cli.id, /(?<=4\. )No/)
    cleared = await expectCleared('②', mark, /\(mouse press\)/)
    await settle('t0757-perm-deny', false)
    expect(hooksSince(cli.id, mark.scripts).filter(h => !/^(user-prompt-submit|permission-request)→/.test(h)), 'no hook after a mouse "No"').toEqual([])
    results['②'] = `PASS — permission, click "4. No" (turn interrupted, no hook): ${cleared}`

    // ── ③ AskUserQuestion, click "1. Alpha" ──
    mark = await block('③', 't0757-ask-pick', 'question')
    await clickText(win, cli.id, /(?<=1\. )Alpha/)
    cleared = await expectCleared('③', mark, /\(mouse press\)|\(hook ask-user-question-done\)/)
    await settle('t0757-ask-pick', true)
    results['③'] = `PASS — question, click "1. Alpha": ${cleared}; hooks ${JSON.stringify(hooksSince(cli.id, mark.scripts))}`

    // ── ④ AskUserQuestion, click "Chat about this" (claude 2.1.316 ignores the click; Esc is the only way out) ──
    mark = await block('④', 't0757-ask-cancel', 'question')
    await clickText(win, cli.id, /Chat about this/)
    cleared = await expectCleared('④', mark, /\(mouse press\)/)
    const s4 = await screenOf(win, cli.id)
    const dialogOpen = (s4?.lines ?? []).some(l => /Chat about this/.test(l))
    log(`④ after the click the question dialog is ${dialogOpen ? 'still open (claude ignores the click)' : 'closed'}`)
    await write(cli.id, '\x1b') // Esc (keyboard) closes it
    await settle('t0757-ask-cancel', false)
    results['④'] = `PASS — question, click "Chat about this": ${cleared}; claude dialog ${dialogOpen ? 'stays open (click not supported, Esc closes it)' : 'closed'}`

    // ── ⑤ elicitation, click "Decline" (claude 2.1.316 ignores clicks in the form; the press clears like a key) ──
    mark = await block('⑤', 't0757-elic', 'elicitation')
    await expect.poll(async () => (await screenOf(win, cli.id))?.lines.some(l => /Decline/.test(l)), { timeout: 30_000 }).toBe(true)
    await clickText(win, cli.id, /Decline/)
    cleared = await expectCleared('⑤', mark, /\(mouse press\)|\(hook elicitation-done\)/)
    const s5 = await screenOf(win, cli.id)
    const formOpen = (s5?.lines ?? []).some(l => /Decline/.test(l))
    await write(cli.id, '\x1b')
    await settle('t0757-elic', false)
    results['⑤'] = `PASS — elicitation, click "Decline": ${cleared}; claude form ${formOpen ? 'stays open (click not supported, Esc closes it)' : 'closed'}`

    // ── W + K: the wheel over a blocked tab does not clear; the keyboard answers as before (Enter) ──
    // (the wheel comes last: after scrolling, claude 2.1.316 no longer takes a click on the dialog — its own behaviour)
    mark = await block('K', 't0757-ask-pick', 'question')
    const box = await screenRect(win, cli.id)
    await win.mouse.move(box.x + box.width / 2, box.y + box.height / 3)
    for (let i = 0; i < 6; i++) { await win.mouse.wheel(0, i % 2 ? 240 : -240); await win.waitForTimeout(100) }
    await win.waitForTimeout(2_500)
    expect(linesSince(cli.id, mark.debug).filter(l => /→ cleared/.test(l)), 'the wheel over a blocked tab does not clear').toEqual([])
    await expect(rowBadge).toHaveText('⚠️')
    await expect(thumbOf(cli.title!).locator('.attention-badge.blocked')).toHaveCount(1)
    results.W = 'PASS — 6 wheel events over the blocked claude tab (mouse tracking on): still blocked, thumbnail and row ⚠️'
    await write(cli.id, '\r')
    cleared = await expectCleared('K', mark, /\(user input\)|\(hook ask-user-question-done\)/)
    await settle('t0757-ask-pick', false)
    results.K = `PASS — question, Enter: ${cleared}`

    // ── ⑥ codex input: a click on the approval option changes nothing (codex 0.166 ignores it, no OSC); `y` does ──
    if (CODEX) {
      const codex = await addFromMenu(CODEX_ITEM)
      await waitStart(codex.id, /\[agent-start\] .*→ started \(osc /, 'codex first OSC 7501')
      await expect(thumbOf(codex.title!)).toHaveClass(/\bactive\b/)
      await win.waitForTimeout(2_000)
      const cmark = debugLog().length
      await typePrompt(codex.id, `${CODEX_MARK} run the probe`)
      await waitLine(codex.id, cmark, /→ blocked reason=input \(osc\)/, '⑥ codex input')
      await expect(thumbOf(codex.title!).locator('.attention-badge.blocked')).toHaveCount(1, { timeout: 15_000 })
      await win.waitForTimeout(1_000)
      const s6 = await screenOf(win, codex.id)
      log(`codex: mouse tracking ${s6?.mouse}, ${s6?.buffer} buffer`)
      const clickMark = debugLog().length
      await clickText(win, codex.id, /Yes, proceed/)
      await win.waitForTimeout(4_000)
      expect(linesSince(codex.id, clickMark).filter(l => /→ cleared|\[codex-state\]/.test(l)), 'a click neither answers codex nor clears input').toEqual([])
      await expect(thumbOf(codex.title!).locator('.attention-badge.blocked')).toHaveCount(1)
      await write(codex.id, 'y')
      await waitLine(codex.id, clickMark, /→ cleared \(osc (working|idle)\)/, '⑥ cleared by codex', 30_000)
      results['⑥'] = `PASS — codex ${CODEX.version} approval, click "Yes, proceed": no OSC, input kept; \`y\` → ${linesSince(codex.id, clickMark).find(l => /→ cleared/.test(l))}`
    } else {
      results['⑥'] = 'SKIPPED — no codex found'
    }

    const debug = debugLog()
    expect(debug).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    expect(rig.proxy.attempts.filter(a => /api\.anthropic\.com|api\.openai\.com/.test(a))).toEqual([])
    log(`T0757 results: ${JSON.stringify(results, null, 2)}`)
  } finally {
    await rig.cleanup()
  }
})

/**
 * `T0757_PROBE=1`: re-run the verification (claude / codex upgrade): every path is answered by one mouse
 * click and what follows is only recorded (hooks, OSC, [blocked] lines, whether the turn went on) — no
 * assertion. On a build without T0757 a path with no hook stays blocked; with T0757 the press clears it.
 */
test('PROBE: what a mouse answer of each real prompt produces (hooks / OSC / ⚠️)', async () => {
  test.skip(!process.env.T0757_PROBE, 'set T0757_PROBE=1 to re-run the T0757 verification')
  test.setTimeout(900_000)
  const findings: Record<string, unknown> = {}
  const rig = await startRig()
  try {
    const { win, fake, debugLog, scriptsLog, linesSince, hooksSince, write, waitLine, waitStart, addFromMenu, typePrompt } = rig
    const cli = await addFromMenu(CLAUDE_ITEM)
    await waitStart(cli.id, /\[agent-start\] .*→ started \(hook session-start\)/, 'claude SessionStart')
    await win.waitForTimeout(3_000)
    const s0 = await screenOf(win, cli.id)
    findings.claude = { mouse: s0?.mouse, buffer: s0?.buffer }

    const probe = async (key: string, scenario: string, reason: string, target: RegExp) => {
      const before = debugLog().length
      await typePrompt(cli.id, `[[T0727:${scenario}]] go`)
      await fake.waitFor(scenario, 0, 60_000)
      try {
        await waitLine(cli.id, before, new RegExp(`→ blocked reason=${reason} `), `${key} blocked`)
        await expect.poll(async () => (await screenOf(win, cli.id))?.lines.some(l => target.test(l)), { timeout: 30_000 }).toBe(true)
      } catch {
        findings[key] = { blocked: false }
        return
      }
      const s = await screenOf(win, cli.id)
      log(`${key} screen (mouse=${s?.mouse}):\n${s?.lines.join('\n')}`)
      const mark = { debug: debugLog().length, scripts: scriptsLog().length }
      const clickedAt = Date.now()
      let hit: unknown
      try { hit = await clickText(win, cli.id, target) } catch (e) { hit = `click failed: ${(e as Error).message.slice(0, 200)}` }
      await win.waitForTimeout(12_000)
      const lines = linesSince(cli.id, mark.debug)
      const r = { hit, clickedAt, lines, hooks: hooksSince(cli.id, mark.scripts), turnWentOn: fake.requests.some(q => q.scenario === scenario && q.step === 1), stillBlocked: !lines.some(l => /→ cleared/.test(l)) }
      findings[key] = r
      log(`${key}: ${JSON.stringify(r, null, 2)}\nscreen after:\n${(await screenOf(win, cli.id))?.lines.join('\n')}`)
      await write(cli.id, '\x1b') // close whatever is left (keyboard)
      await win.waitForTimeout(4_000)
    }
    await probe('① permission, "1. Yes"', 't0757-perm-allow', 'permission', /(?<=1\. )Yes/)
    await probe('② permission, "4. No"', 't0757-perm-deny', 'permission', /(?<=4\. )No/)
    await probe('③ question, "1. Alpha"', 't0757-ask-pick', 'question', /(?<=1\. )Alpha/)
    await probe('④ question, "Chat about this"', 't0757-ask-cancel', 'question', /Chat about this/)
    await probe('⑤ elicitation, "Decline"', 't0757-elic', 'elicitation', /Decline/)

    if (CODEX) {
      const codex = await addFromMenu(CODEX_ITEM)
      await waitStart(codex.id, /\[agent-start\] .*→ started \(osc /, 'codex first OSC')
      await win.waitForTimeout(3_000)
      const before = debugLog().length
      await typePrompt(codex.id, `${CODEX_MARK} run the probe`)
      await waitLine(codex.id, before, /→ blocked reason=input \(osc\)/, '⑥ codex input')
      await win.waitForTimeout(1_500)
      const s = await screenOf(win, codex.id)
      log(`⑥ codex screen (mouse=${s?.mouse}):\n${s?.lines.join('\n')}`)
      const mark = debugLog().length
      let hit: unknown
      try { hit = await clickText(win, codex.id, /Yes, proceed/) } catch (e) { hit = `click failed: ${(e as Error).message.slice(0, 300)}` }
      await win.waitForTimeout(12_000)
      findings['⑥ codex, "Yes, proceed"'] = { mouse: s?.mouse, hit, lines: linesSince(codex.id, mark) }
    }
    log(`T0757 PROBE findings: ${JSON.stringify(findings, null, 2)}`)
  } finally {
    await rig.cleanup()
  }
})
