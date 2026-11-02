// T0787 (PLAN-059 Q1 / R1): what a Worker's `bat-notify` does to a Tower that waits for the user.
//
// PROBE ONLY (`T0787_PROBE=1`; `T0787_RUNS=<n>` rounds, default 2): records, asserts nothing about the
// outcome. Kept as the reproduction for a follow-up BUG / regression test.
//
// Real paths, no token (as T0757 / T0736): the Tower is the embedded claude CLI in a "Claude CLI" tab of an
// isolated BAT (fixtures/electron-isolation.ts), talking to fixtures/fake-anthropic-api.ts behind a
// blocking proxy, with a temp home. The Worker is dispatched for real (`bat-terminal.mjs --notify-id
// <tower>`, the test's server token, as e2e/t0609), so its PTY holds a worker capability bound to the
// Tower; its agent is a custom CLI (a node job runner) that runs `bat-notify.mjs` / `bat-mcp.mjs` INSIDE the
// Worker PTY with that capability. The fake API records the tool_result claude sends after each prompt.
//
// Each trial: the Tower gets a tagged prompt → claude shows a Bash permission dialog (`perm`) or an
// AskUserQuestion dialog (`ask`), or stays at its prompt (`idle`); the Worker reads the Tower's state
// (MCP bat_get_state, its own capability) and sends one notify; then the trial records where the text
// landed (screen), the keypress trace, the `[blocked]` lines, whether claude's turn went on and the
// tool_result the fake API received; then the Tower is reset (Esc / Backspace).
//
// Windows only (embedded claude.exe); `npx vite build` first. Results also go to `$T0787_RESULTS` (JSON).
import { test, expect, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'
import { startBlockingProxy, startFakeAnthropicApi, type Scenario, type ScenarioContext } from './fixtures/fake-anthropic-api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0787')
const WS = 'e2e-t0787'
const WORKER_AGENT = 'e2e-t0787-worker'
const FAKE_KEY = 'sk-t0787-fake-key-not-checked-0000000000'
const EMBEDDED_CLAUDE = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const INHERITED = /^(ANTHROPIC_|CLAUDE|OPENAI_|CODEX_)/i
const CLAUDE_ITEM = /^\s*▶\s*Claude CLI\s*(suggested|建議|建议)?\s*$/
const MODERN = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }
const RUNS = Math.max(1, Number(process.env.T0787_RUNS ?? 2) || 2)

/** tool_result text the fake API received in step 1 of each scenario (the answer claude sent). */
const toolResultOf: Record<string, string> = {}
const ask = (q: string) => ({ tool: { name: 'AskUserQuestion', input: { questions: [{
  question: q, header: 'T0787', multiSelect: false,
  options: [{ label: 'Alpha', description: 'the first option' }, { label: 'Beta', description: 'the second option' }],
}] } } })
const bash = (tag: string) => ({ tool: { name: 'Bash', input: { command: `curl -s --max-time 3 http://127.0.0.1:9/${tag}`, description: `T0787 ${tag} probe (closed local port)` } } })
/** `t0787-perm-…` / `t0787-ask-…`: step 0 the tool, step 1 records the tool_result and ends the turn. */
const SCENARIOS = new Proxy({} as Record<string, Scenario>, {
  get: (_t, name) => {
    if (typeof name !== 'string') return undefined
    const m = /^t0787-(perm|ask)-/.exec(name)
    if (!m) return undefined
    return (ctx: ScenarioContext) => {
      if (ctx.step === 0) return m[1] === 'perm' ? bash(name) : ask(`T0787 ${name}?`)
      if (ctx.step === 1) { toolResultOf[name] = ctx.toolResults.at(-1) ?? ''; return { text: ['ack ', name] } }
      return null
    }
  },
})

/** Worker agent: runs `<jobs>/<terminal id>-<n>.json` ({ steps }) inside its PTY; writes `<n>.res.json`. */
const WORKER_SCRIPT = (jobsDir: string) => `
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
const jobs = ${JSON.stringify(jobsDir)}
const env = process.env
const dir = env.BAT_HELPER_DIR
const id = env.BAT_TERMINAL_ID
const fill = v => typeof v === 'string' ? v.replace(/\\{env:([A-Z0-9_]+)\\}/g, (_, n) => env[n] || '') : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v
function helper(step) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(dir, step.script), ...step.args.map(fill)], { env, windowsHide: true })
    let stdout = '', stderr = ''
    child.stdout.on('data', d => { stdout += d })
    child.stderr.on('data', d => { stderr += d })
    child.on('close', code => resolve({ kind: 'helper', code, stdout, stderr }))
    child.stdin.end(step.stdin || '')
  })
}
function mcp(step) {
  return new Promise(resolve => {
    const out = { kind: 'mcp', replies: [], stderr: '' }
    const child = spawn(process.execPath, [path.join(dir, 'bat-mcp.mjs')], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    const timer = setTimeout(() => { out.stderr += 'runner timeout'; child.kill() }, 60000)
    const requests = fill(step.requests)
    let buf = '', i = 0
    const next = () => { if (i >= requests.length) { child.stdin.end(); return } child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, ...requests[i] }) + '\\n'); i++ }
    child.stdout.on('data', d => { buf += d; let nl; while ((nl = buf.indexOf('\\n')) !== -1) { const line = buf.slice(0, nl); buf = buf.slice(nl + 1); try { out.replies.push(JSON.parse(line)) } catch {} next() } })
    child.stderr.on('data', d => { out.stderr += d })
    child.on('exit', code => { clearTimeout(timer); out.code = code; resolve(out) })
    next()
  })
}
let n = 0, busy = false
fs.writeFileSync(path.join(jobs, id + '.ready'), String(Date.now()))
process.stdout.write('t0787 worker ready\\n')
setInterval(async () => {
  const file = path.join(jobs, id + '-' + n + '.json')
  if (busy || !fs.existsSync(file)) return
  busy = true
  const job = JSON.parse(fs.readFileSync(file, 'utf8'))
  const results = []
  for (const step of job.steps) results.push({ at: Date.now(), ...(step.kind === 'mcp' ? await mcp(step) : await helper(step)) })
  fs.writeFileSync(file + '.tmp', JSON.stringify(results))
  fs.renameSync(file + '.tmp', path.join(jobs, id + '-' + n + '.res.json'))
  n++
  busy = false
}, 100)
`

/** In the renderer: the xterm Terminal of tab `id` (TerminalPanel's ref, found through React's fiber; as T0757). */
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

async function screenOf(win: Page, id: string): Promise<string[]> {
  return win.evaluate(({ id, src }) => {
    // eslint-disable-next-line no-new-func
    const found = (new Function(`return (${src})`)())(id)
    if (!found) return []
    const t = found.term
    const b = t.buffer.active
    const lines: string[] = []
    for (let y = 0; y < t.rows; y++) lines.push(b.getLine(b.viewportY + y)?.translateToString(true) ?? '')
    return lines
  }, { id, src: XTERM_OF })
}

async function withoutInheritedAgentEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (INHERITED.test(k) && v !== undefined) { saved[k] = v; delete process.env[k] }
  try { return await fn() } finally { Object.assign(process.env, saved) }
}

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }
function runHelper(script: string, env: NodeJS.ProcessEnv, args: string[], cwd: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      resolve({ code, stdout: String(stdout), stderr: String(stderr), terminalId: /Terminal created: (\S+)/.exec(String(stdout))?.[1] })
    })
  })
}

const slash = (p: string) => p.split(path.sep).join('/')
const count = (hay: string, needle: string) => hay.split(needle).length - 1
const isDialog = (lines: string[]) => lines.some(l => /Esc to cancel|Do you want to proceed/.test(l))

type Kind = 'perm' | 'ask' | 'idle'
type Mode = 'submit' | 'prefill' | 'ask-no-pty-write' | 'ask-submit'
interface Trial { key: string; kind: Kind; mode: Mode; message: string }

const TRIALS: Trial[] = [
  { key: '①', kind: 'perm', mode: 'submit', message: 'T0787 完成' },
  { key: '②', kind: 'ask', mode: 'submit', message: 'T0787 完成' },
  { key: '①d', kind: 'perm', mode: 'submit', message: 'T0312 完成' },
  { key: '②d', kind: 'ask', mode: 'submit', message: 'T0312 完成' },
  { key: '③', kind: 'idle', mode: 'submit', message: 'T0787 完成' },
  { key: '④p', kind: 'perm', mode: 'prefill', message: 'T0787 完成' },
  { key: '④a', kind: 'ask', mode: 'prefill', message: 'T0787 完成' },
  { key: '⑤', kind: 'perm', mode: 'ask-no-pty-write', message: 'T0787 提問' },
  { key: '⑥p', kind: 'perm', mode: 'ask-submit', message: 'T0787 提問' },
  { key: '⑥a', kind: 'ask', mode: 'ask-submit', message: 'T0787 提問' },
]

test.skip(process.platform !== 'win32', 'embedded claude.exe and pwsh tabs: Windows only')
test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)

test('PROBE: Worker notify into a Tower blocked on a permission / AskUserQuestion dialog (no token)', async () => {
  test.skip(!process.env.T0787_PROBE, 'set T0787_PROBE=1 to run the T0787 probe')
  test.setTimeout(1_800_000)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0787-'))
  const home = path.join(tmp, 'home')
  for (const dir of [['AppData', 'Roaming'], ['AppData', 'Local'], ['Documents']]) fs.mkdirSync(path.join(home, ...dir), { recursive: true })
  // under %ProgramData% (as T0727 / T0736 / T0757): claude loads every ancestor's CLAUDE.md
  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', 'bat-e2e-t0787-'))
  const folder = path.join(root, 'w')
  const jobsDir = path.join(tmp, 'jobs')
  for (const dir of [folder, jobsDir]) fs.mkdirSync(dir, { recursive: true })
  const workerScript = slash(path.join(tmp, 'worker.mjs'))
  fs.writeFileSync(workerScript, WORKER_SCRIPT(slash(jobsDir)))
  const projectEntry = { hasTrustDialogAccepted: true, hasCompletedProjectOnboarding: true, allowedTools: [] }
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({
    hasCompletedOnboarding: true, theme: 'dark', numStartups: 5, hasSeenAutoDefaultNudge: true,
    customApiKeyResponses: { approved: [FAKE_KEY.slice(-20)], rejected: [] },
    projects: { [folder]: projectEntry, [slash(folder)]: projectEntry },
  }))
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ permissions: { defaultMode: 'default' } }))

  const fake = await startFakeAnthropicApi(SCENARIOS)
  const proxy = await startBlockingProxy()
  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: fake.baseUrl, ANTHROPIC_API_KEY: FAKE_KEY,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
    USERPROFILE: home, HOME: home, HTTPS_PROXY: proxy.url, HTTP_PROXY: proxy.url, NO_PROXY: '127.0.0.1,localhost',
  }
  const claudeVersion = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'package.json'), 'utf8')).version
  log(`fake Anthropic API ${fake.baseUrl}; proxy ${proxy.url}; embedded claude ${claudeVersion}; runs ${RUNS}`)

  const results: Array<Record<string, unknown>> = []
  let inst: IsolatedInstance | undefined
  try {
    inst = await withoutInheritedAgentEnv(() => launchIsolated('t0787', log, { env }))
    const { app, win, userData, remotePort } = inst
    const debugLog = () => {
      const dir = path.join(userData, 'Logs')
      return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    }
    const scriptsLog = () => { const f = path.join(userData, 'Logs', 'bat-scripts.log'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '' }
    const linesSince = (id: string, mark: number, re: RegExp) => debugLog().slice(mark).split('\n').filter(l => l.includes(id) && re.test(l))
      .map(l => l.replace(/^.*?(\[(blocked|turn|agent-start|terminal-submit|helper-query|remote\]\[terminal)\])/, '$1').slice(0, 260))
    const write = (id: string, data: string) => win.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: id, d: data })
    const savedTabs = async (): Promise<Array<{ id: string; title?: string }>> => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      return raw ? (JSON.parse(raw) as { terminals: Array<{ id: string; title?: string }> }).terminals : []
    }

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0787 worker', icon: 'W', color: '#888888', command: 'node', args: [workerScript],
    })).toBeTruthy()
    const SHELL = 'e2e-t0787-shell'
    const seed = {
      workspaces: [{ id: WS, name: WS, folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS, activeGroup: null,
      terminals: [{ id: SHELL, workspaceId: WS, type: 'terminal', title: 'T0787 shell', cwd: folder }],
      activeTerminalId: SHELL,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), SHELL), { timeout: 30_000 }).not.toBeNull()

    // ── the Tower: a Claude CLI tab ──
    const known = new Set((await savedTabs()).map(t => t.id))
    await win.locator('.workspace-container.active .thumbnail-add-btn').click()
    const item = win.locator('.thumbnail-add-menu-item', { hasText: CLAUDE_ITEM }).first()
    await expect(item).toBeVisible()
    await item.click()
    let tower: { id: string; title?: string } | undefined
    await expect.poll(async () => (tower = (await savedTabs()).find(t => !known.has(t.id))) !== undefined, { timeout: 15_000 }).toBe(true)
    const T = tower!.id
    await expect.poll(() => linesSince(T, 0, /\[agent-start\] .*→ started \(hook session-start\)/).length, { timeout: 90_000 }).toBeGreaterThan(0)
    await win.waitForTimeout(3_000)
    // Q2: what claude wrote to the PTY about OSC 7501 (its probe `ESC ] 7501 ; ?`, any `state=` report). The replay
    // buffer `{ data, total }` keeps the tail of the output, so it is read right after the start and at the end.
    const q2Capture = async () => {
      const replay = (await win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), T)) as { data?: string; total?: number } | null
      const buffer = typeof replay?.data === 'string' ? replay.data : ''
      const osc = buffer.match(/\x1b\]7501;[^\x07\x1b]{0,200}/g) ?? []
      return { bufferChars: buffer.length, totalWritten: replay?.total ?? null, osc7501: osc.length, probes: osc.filter(x => x.endsWith(';?')).length, reports: osc.filter(x => /state=/.test(x)).map(x => x.slice(1)) }
    }
    const q2AfterStart = await q2Capture()
    log(`Q2 claude ${claudeVersion} PTY (replay buffer) after the start: ${JSON.stringify(q2AfterStart)}`)

    // ── the Worker: dispatched for real (server token in the test, as e2e/t0609); its PTY holds a worker capability ──
    await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
    const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
    const token: string = record.encrypted
      ? await app.evaluate(async ({ safeStorage }, data) => (await safeStorage.decryptStringAsync(Buffer.from(data, 'base64'))).result, record.data as string)
      : record.data
    const helperEnv: NodeJS.ProcessEnv = {}
    for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) helperEnv[k] = v
    Object.assign(helperEnv, {
      BAT_REMOTE_PORT: String(remotePort), BAT_REMOTE_TOKEN: token,
      BAT_SERVER_CERT_PATH: path.join(userData, 'server-cert.json'), BAT_HELPER_LOG_DIR: path.join(tmp, 'helper-logs'), BAT_USER_DATA: tmp,
    })
    const dispatched = await runHelper('bat-terminal.mjs', helperEnv, ['--notify-id', T, '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0787'], folder)
    log(`dispatch: exit=${dispatched.code} ${dispatched.stdout.trim().split('\n')[0]}`)
    expect(dispatched.code, dispatched.stderr).toBe(0)
    const W = dispatched.terminalId!
    await expect.poll(() => fs.existsSync(path.join(jobsDir, `${W}.ready`)), { timeout: 30_000 }).toBe(true)
    expect(debugLog()).toContain(`[helper-cap] issued: terminal=${W} role=worker tower=${T}`)

    // The dispatched Worker tab becomes the active one (measured: T0599 keeps the OS focus, not the tab), so the
    // Tower is a background tab — the case of a Tower the user is not looking at. `T0787_TOWER_ACTIVE=1` clicks
    // the Tower's thumbnail back (the user looks at the Tower's dialog). Either way its xterm gets the focus.
    const activeTab = async () => win.evaluate(() => document.querySelector('.workspace-container.active .thumbnail.active .thumbnail-title')?.textContent ?? null)
    log(`active tab after the dispatch: ${await activeTab()} (tower title ${tower!.title})`)
    const towerActive = process.env.T0787_TOWER_ACTIVE === '1'
    if (towerActive) {
      await win.locator('.workspace-container.active .thumbnail').filter({ has: win.locator('.thumbnail-title', { hasText: tower!.title ?? 'Claude CLI' }) }).first().click()
      await expect(win.locator('.workspace-container.active .thumbnail.active .thumbnail-title')).toContainText(tower!.title ?? 'Claude CLI')
      await win.waitForTimeout(1_000)
      log(`active tab now: ${await activeTab()}`)
    }
    await win.evaluate(({ id, src }) => {
      // eslint-disable-next-line no-new-func
      ;(new Function(`return (${src})`)())(id)?.term.focus()
    }, { id: T, src: XTERM_OF })

    let jobN = 0
    const inWorker = async (steps: unknown[]): Promise<Array<Record<string, AnyApi>>> => {
      const n = jobN++
      fs.writeFileSync(path.join(jobsDir, `${W}-${n}.json`), JSON.stringify({ steps }))
      const res = path.join(jobsDir, `${W}-${n}.res.json`)
      await expect.poll(() => fs.existsSync(res), { timeout: 90_000 }).toBe(true)
      return JSON.parse(fs.readFileSync(res, 'utf8'))
    }
    const notifyArgs = (t: Trial, source: string) => {
      const base = ['--source', source, '--target', '{env:BAT_TOWER_TERMINAL_ID}']
      if (t.mode === 'submit') return [...base, '--submit', t.message]
      if (t.mode === 'prefill') return [...base, t.message]
      if (t.mode === 'ask-no-pty-write') return ['--ask', ...base, '--no-pty-write', t.message]
      return ['--ask', ...base, '--submit', t.message]
    }
    const getState = { kind: 'mcp', requests: [
      { method: 'server/discover', params: MODERN },
      { method: 'tools/call', params: { name: 'bat_get_state', arguments: { terminalId: '{env:BAT_TOWER_TERMINAL_ID}' }, ...MODERN } },
    ] }
    const stateOf = (r: Record<string, AnyApi>) => {
      const s = r.replies?.[1]?.result?.structuredContent
      return s ? { state: s.state, blockedReason: s.blockedReason ?? null, blockedDetection: s.blockedDetection } : { error: JSON.stringify(r.replies?.[1] ?? r.stderr).slice(0, 200) }
    }

    /** Esc while a dialog is up, then Backspace over whatever was typed; the Tower back at an empty prompt. */
    const resetTower = async () => {
      for (let i = 0; i < 3 && isDialog(await screenOf(win, T)); i++) { await write(T, '\x1b'); await win.waitForTimeout(1_500) }
      await write(T, '\x7f'.repeat(40))
      await win.waitForTimeout(2_500)
    }

    for (let run = 1; run <= RUNS; run++) {
      for (const t of TRIALS) {
        const name = `t0787-${t.kind}-r${run}-${t.key.replace(/[^a-z0-9]/gi, '') || 'x'}${t.key.codePointAt(0)}`
        const source = /^(T\d{4})/.exec(t.message)![1]
        const mark = { debug: debugLog().length, scripts: scriptsLog().length, req: fake.requests.length }
        const before = Math.max(0, ...fake.requests.map(r => count(r.userText, t.message)))
        let screenBefore: string[] = []
        if (t.kind !== 'idle') {
          await write(T, `[[T0727:${name}]] go`)
          await win.waitForTimeout(600)
          await write(T, '\r')
          await fake.waitFor(name, 0, 60_000)
          const reason = t.kind === 'perm' ? 'permission' : 'question'
          await expect.poll(() => linesSince(T, mark.debug, new RegExp(`→ blocked reason=${reason} `)).length, { timeout: 60_000 }).toBeGreaterThan(0)
          await win.waitForTimeout(2_000) // the dialog is drawn and takes input (T0757)
          screenBefore = await screenOf(win, T)
        }
        const sentAt = Date.now()
        const job = await inWorker([getState, { kind: 'helper', script: 'bat-notify.mjs', args: notifyArgs(t, source),
          stdin: t.mode.startsWith('ask') ? JSON.stringify({ question: 'T0787 probe question', options: ['a', 'b'] }) : '' }])
        const notifyRun = job[1]
        await win.waitForTimeout(t.kind === 'idle' ? 6_000 : 8_000)
        const screenAfter = await screenOf(win, T)
        const turnWentOn = fake.requests.some(r => r.scenario === name && r.step === 1)
        const after = Math.max(0, ...fake.requests.map(r => count(r.userText, t.message)))
        const qid = /^\s*question: (q-[0-9a-f]{8}-[0-9a-f]{16})$/m.exec(notifyRun.stdout ?? '')?.[1]
        const r: Record<string, unknown> = {
          trial: t.key, run, kind: t.kind, mode: t.mode, message: t.message, towerTab: towerActive ? 'active' : 'background',
          towerStateSeenByWorker: stateOf(job[0]),
          notify: { exit: notifyRun.code, stdout: String(notifyRun.stdout ?? '').trim().split(/\r?\n/), stderr: String(notifyRun.stderr ?? '').trim() },
          dialogBefore: t.kind === 'idle' ? null : isDialog(screenBefore),
          dialogAfter: isDialog(screenAfter),
          messageOnScreenAfter: screenAfter.filter(l => l.includes(t.message)).map(l => l.trim()),
          claudeTurnWentOn: turnWentOn,
          toolResult: toolResultOf[name] ?? null,
          messageSentToModel: after > before,
          blockedLines: linesSince(T, mark.debug, /\[(blocked|turn)\]/),
          submitTrace: linesSince(T, mark.debug, /\[terminal-submit\] remote Enter dispatched/),
          sentAt,
        }
        log(`${t.key} run ${run}: ${JSON.stringify(r, null, 1)}`)
        if (process.env.T0787_SCREENS) log(`${t.key} run ${run} screen before:\n${screenBefore.join('\n')}\nscreen after:\n${screenAfter.join('\n')}`)
        results.push(r)
        if (qid) await inWorker([{ kind: 'helper', script: 'bat-notify.mjs', args: ['--cancel-question', qid] }])
        await resetTower()
        // a turn that went on: let it end before the next trial
        await win.waitForTimeout(1_000)
      }
    }

    const q2 = { afterStart: q2AfterStart, atEnd: await q2Capture() }
    log(`Q2 claude ${claudeVersion} PTY (replay buffer) at the end: ${JSON.stringify(q2.atEnd)}`)

    expect(debugLog()).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    expect(proxy.attempts.filter(a => /api\.anthropic\.com/.test(a))).toEqual([])
    const out = { claudeVersion, runs: RUNS, towerTab: towerActive ? 'active' : 'background', results, q2 }
    fs.writeFileSync(test.info().outputPath('t0787-results.json'), JSON.stringify(out, null, 2))
    if (process.env.T0787_RESULTS) fs.writeFileSync(process.env.T0787_RESULTS, JSON.stringify(out, null, 2))
  } finally {
    if (inst) await closeIsolated(inst, log)
    await fake.close()
    await proxy.close()
    for (const dir of [tmp, root]) {
      try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 }) } catch (e) { log(`could not remove ${dir}: ${e instanceof Error ? e.message : String(e)}`) }
    }
  }
})
