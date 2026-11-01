// T0728 (pre.6 acceptance, T0694 / D180 with codex 0.166, T0717): a real codex TUI Worker reports, the
// user gives it another prompt → ↻ (resumed, not counted by "Close reported Worker tabs (N)"), the turn
// ends (OSC 7501 `done` on 0.166, read as `idle`) → ✓ again. Signals are codex's own OSC 7501 — no hook.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The model is a fake
// OpenAI Responses API in this test process (127.0.0.1, SSE), set in the isolated BAT's own
// `CODEX_HOME/config.toml` (a temp dir: no login, the user's `~/.codex` is never read or written, no
// token spent). The Worker runs `-a never -s danger-full-access` (the workspace codex args) so the tool
// call runs without an approval prompt:
//   - turn 1 (the dispatch prompt): the fake answers with one shell tool call — `bat-notify.mjs
//     --no-pty-write` from INSIDE the Worker's codex, with the Worker PTY's own capability, as a CT
//     Worker reports — then `ok`
//   - turn 2 (the test types a prompt into the Worker tab): the fake holds its answer until the test has
//     seen ↻, then `ok`
//
//   1. dispatch `--agent codex --wait-started 60000` → started; bat_get_state shape is t0621's job, here
//      only `[agent-start] … (osc …)`
//   2. the report inside turn 1 → ✓ (data-attention reported), N = 1; turn 1 ends → still ✓
//   3. a new prompt → OSC `working` → ↻ (data-attention resumed, class resumed), N = 0
//   4. the answer is released → the turn ends (OSC `done` / `idle`) → ✓, N = 1
//
// Skipped (with the reason) when no codex >= 0.166.0 is found: BAT_E2E_CODEX, then the bundled one
// (node_modules/@openai/codex-win32-x64), the official installer, PATH. Windows only (pwsh tabs).

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0728-codex')
const WS = 'e2e-t0728-codex-ws'
const TOWER = 'e2e-t0728-codex-tower'
const WORKORDER = 'T0728'
const WORKER_CODEX_ARGS = '-a never -s danger-full-access'
const MIN_CODEX = '0.166.0'

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

/** The first codex.exe >= 0.166.0 on this machine — the bundled one before the user's own. */
function findCodex(): { bin: string; version: string } | null {
  if (process.platform !== 'win32') return null
  const candidates: string[] = []
  if (process.env.BAT_E2E_CODEX) candidates.push(process.env.BAT_E2E_CODEX)
  const vendor = path.join(REPO_ROOT, 'node_modules', '@openai', `codex-${process.platform}-${process.arch}`, 'vendor')
  try {
    for (const triple of fs.readdirSync(vendor)) candidates.push(path.join(vendor, triple, 'bin', 'codex.exe'))
  } catch { /* not installed */ }
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  candidates.push(path.join(local, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'))
  for (const dir of (process.env.PATH ?? '').split(';')) if (dir.trim()) candidates.push(path.join(dir.trim().replace(/^"(.*)"$/, '$1'), 'codex.exe'))
  for (const bin of candidates) {
    if (!fs.existsSync(bin)) continue
    const version = codexVersion(bin)
    if (version && atLeast(version, MIN_CODEX)) return { bin, version }
  }
  return null
}

const CODEX = findCodex()

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

interface FakeModel {
  port: number
  requests: string[]
  /** Turns (requests with tools) answered so far. */
  turnRequests(): number
  /** The held answer of the next turn has been asked for. */
  holding(): boolean
  release(): void
  close(): Promise<void>
}

/**
 * The fake Responses API. Requests with tools, in order: #1 → one shell tool call (`toolCommand`),
 * #2 → `ok` (turn 1 ends), #3 and later → `ok` once `release()` was called. Requests without tools → `ok`.
 */
function startFakeModel(toolCommand: string): Promise<FakeModel> {
  const requests: string[] = []
  let turns = 0
  let released = false
  let held: Array<() => void> = []
  const usage = { input_tokens: 1, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 2 }
  const sse = (res: http.ServerResponse, events: unknown[]) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    for (const e of events) res.write(`event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`)
    res.end()
  }
  const ok = (res: http.ServerResponse, id: string) => sse(res, [
    { type: 'response.created', response: { id } },
    { type: 'response.output_item.done', item: { type: 'message', role: 'assistant', id: `msg_${id}`, content: [{ type: 'output_text', text: 'ok' }] } },
    { type: 'response.completed', response: { id, usage } },
  ])
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', d => { body += d })
    req.on('end', () => {
      requests.push(`${req.method} ${req.url}`)
      if (!req.url?.includes('/responses')) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{}'); return }
      let j: { tools?: Array<{ name?: string; type?: string }> } = {}
      try { j = JSON.parse(body) } catch { /* empty */ }
      const tools = (j.tools ?? []).map(t => t.name ?? t.type ?? '')
      const id = `resp_${requests.length}`
      if (tools.length === 0) { ok(res, id); return }
      turns++
      if (turns === 1) {
        const [name, args] = tools.includes('shell_command')
          ? ['shell_command', { command: toolCommand }]
          : tools.includes('exec_command')
            ? ['exec_command', { cmd: toolCommand }]
            : ['shell', { command: ['powershell', '-Command', toolCommand] }]
        sse(res, [
          { type: 'response.created', response: { id } },
          { type: 'response.output_item.done', item: { type: 'function_call', id: `fc_${id}`, call_id: `call_${id}`, name, arguments: JSON.stringify(args) } },
          { type: 'response.completed', response: { id, usage } },
        ])
        return
      }
      if (turns === 2 || released) { ok(res, id); return }
      held.push(() => ok(res, id))
    })
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    port: (server.address() as { port: number }).port,
    requests,
    turnRequests: () => turns,
    holding: () => held.length > 0,
    release: () => {
      released = true
      const pending = held
      held = []
      for (const answer of pending) answer()
    },
    close: () => new Promise<void>(r => { server.closeAllConnections?.(); server.close(() => r()) }),
  })))
}

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }

function runHelper(env: NodeJS.ProcessEnv, args: string[], cwd: string, timeout: number): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(REPO_ROOT, 'scripts', 'bat-terminal.mjs'), ...args], { env, cwd, timeout, windowsHide: true }, (err, stdout, stderr) => {
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      resolve({ code, stdout: String(stdout), stderr: String(stderr), terminalId: /Terminal created: (\S+)/.exec(String(stdout))?.[1] })
    })
  })
}

/** Env for the dispatch the test runs itself: the server token, as t0694 / t0538. */
async function helperEnv(app: ElectronApplication, userData: string, remotePort: number, tmp: string): Promise<NodeJS.ProcessEnv> {
  await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
  const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
  const token: string = record.encrypted
    ? await app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(Buffer.from(data, 'base64')), record.data as string)
    : record.data
  const env: NodeJS.ProcessEnv = {}
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) env[k] = v
  return Object.assign(env, {
    BAT_REMOTE_PORT: String(remotePort),
    BAT_REMOTE_TOKEN: token,
    BAT_SERVER_CERT_PATH: path.join(userData, 'server-cert.json'),
    BAT_HELPER_LOG_DIR: path.join(tmp, 'helper-logs'),
    BAT_USER_DATA: tmp,
  })
}

async function closeMenu(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await expect(page.locator('.context-menu')).toHaveCount(0)
}

/** The Tower's "Close reported Worker tabs (N)" shows `count` (the UI language follows the OS locale). */
async function expectReportedCount(page: Page, view: Locator, count: number) {
  await view.locator('.thumbnail', { hasText: 'Tower' }).first().click({ button: 'right' })
  const item = page.locator('.context-menu [data-action="close-reported-workers"]')
  await expect(item).toHaveText(new RegExp(`[(（]${count}[)）]$`))
  if (count === 0) await expect(item).toBeDisabled()
  else await expect(item).toBeEnabled()
  await closeMenu(page)
}

test.skip(process.platform !== 'win32', 'pwsh tabs and codex.exe resolution: Windows only')
test.skip(!CODEX, `no codex >= ${MIN_CODEX} found (BAT_E2E_CODEX, bundled, %LOCALAPPDATA%\\Programs\\OpenAI\\Codex\\bin, PATH)`)

test('codex 0.166 Worker: report → ✓, a new prompt → ↻ (not counted), the turn ends → ✓ (real codex TUI, fake model)', async () => {
  test.setTimeout(360_000)
  const startedAt = Date.now()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0728-codex-'))
  const folder = path.join(tmp, 'ws')
  const trusted = path.join(folder, 'trusted')
  const codexHome = path.join(tmp, 'codex-home')
  for (const dir of [folder, trusted, codexHome]) fs.mkdirSync(dir, { recursive: true })
  // What a CT Worker runs to report (`--no-pty-write`: the Tower here is a plain shell tab).
  const notifyCommand = `node "$env:BAT_HELPER_DIR\\bat-notify.mjs" --source ${WORKORDER} --target $env:BAT_TOWER_TERMINAL_ID --no-pty-write "${WORKORDER} done"`
  const fake = await startFakeModel(notifyCommand)
  const toml = (s: string) => `'${s}'`
  fs.writeFileSync(path.join(codexHome, 'config.toml'), [
    'model = "gpt-mock"',
    'model_provider = "mock"',
    '',
    '[model_providers.mock]',
    'name = "mock"',
    `base_url = "http://127.0.0.1:${fake.port}/v1"`,
    'wire_api = "responses"',
    '',
    `[projects.${toml(trusted)}]`,
    'trust_level = "trusted"',
    '',
  ].join('\n'))
  log(`codex ${CODEX!.version} at ${path.relative(REPO_ROOT, CODEX!.bin).startsWith('..') ? CODEX!.bin : path.relative(REPO_ROOT, CODEX!.bin)}; fake model on 127.0.0.1:${fake.port}`)

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0728-codex', log, { env: { PATH: `${path.dirname(CODEX!.bin)};${process.env.PATH ?? ''}`, CODEX_HOME: codexHome } })
    const { app, win, userData } = inst
    const debugLog = () => {
      const dir = path.join(userData, 'Logs')
      return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    }
    const buffer = async (id: string) => ((await win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id)) as { data?: string } | null)?.data ?? ''

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0728 codex', folderPath: folder, createdAt: Date.now(), agentCustomArgs: { 'codex-cli': WORKER_CODEX_ARGS } }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'Tower', cwd: folder }],
      activeTerminalId: TOWER,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const view = win.locator('.workspace-container.active')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TOWER), { timeout: 30_000 }).not.toBeNull()

    // ── 1. dispatch the codex Worker ──
    const env = await helperEnv(app, userData, inst.remotePort, tmp)
    const run = await runHelper(env, ['--notify-id', TOWER, '--workspace', WS, '--agent', 'codex', '--skill', 'ct-exec', '--workorder', WORKORDER, '--cwd', trusted, '--mode', 'yolo', '--wait-started', '60000'], folder, 120_000)
    log(`dispatch: exit=${run.code}\n${run.stdout}${run.stderr}`)
    expect(run.code, run.stderr).toBe(0)
    const worker = run.terminalId!
    expect(worker).toBeTruthy()
    expect(run.stdout.trim().split(/\r?\n/).at(-1)).toMatch(/^ {2}started: \d{4}-/)
    const workerLines = () => debugLog().split('\n').filter(l => l.includes(worker)).map(l => l.replace(/^\[[^\]]*\] \[[A-Z]+\] /, ''))
    const badge = view.locator(`.thumbnail[data-workorder="${WORKORDER}"] .worker-badge`)

    // ── 2. turn 1 reports from inside codex → ✓, counted; the turn ends → still ✓ ──
    try {
      await expect.poll(() => debugLog().includes(`[T0538] Worker reported: tower=${TOWER} workorder=${WORKORDER} tabs=${worker}`), { timeout: 90_000 }).toBe(true)
    } catch (error) {
      log(`worker screen: ${stripAnsi(await buffer(worker)).slice(-3000)}`)
      log(`fake model requests: ${JSON.stringify(fake.requests)}`)
      throw error
    }
    await expect(badge).toHaveText('✓', { timeout: 15_000 })
    await expect(badge).toHaveAttribute('data-attention', 'reported')
    await expect.poll(() => fake.turnRequests(), { timeout: 30_000 }).toBeGreaterThanOrEqual(2)
    await expect.poll(() => workerLines().some(l => /\[turn\] terminal=\S+ → ended \(osc idle\)/.test(l)), { timeout: 30_000 }).toBe(true)
    await expect(badge).toHaveText('✓')
    await expectReportedCount(win, view, 1)
    const afterTurn1 = await buffer(worker)
    const doneSeen = afterTurn1.includes('\x1b]7501;state=done')
    log(`turn 1: OSC 7501 states on screen: ${JSON.stringify([...afterTurn1.matchAll(/\x1b\]7501;state=([a-z]+)/g)].map(m => m[1]))}`)

    // ── 3. a new prompt → working → ↻, not counted ──
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'please check again'), worker)
    await win.waitForTimeout(800) // past codex's paste-burst window, so Enter submits
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, '\r'), worker)
    try {
      await expect.poll(() => fake.holding(), { timeout: 30_000 }).toBe(true)
    } catch (error) {
      log(`worker screen: ${stripAnsi(await buffer(worker)).slice(-3000)}`)
      throw error
    }
    await expect(badge).toHaveText('↻', { timeout: 15_000 })
    await expect(badge).toHaveAttribute('data-attention', 'resumed')
    await expect(badge).toHaveClass(/\bresumed\b/)
    await expect(badge).toHaveAttribute('title', new RegExp(`${WORKORDER} done`))
    await expectReportedCount(win, view, 0)
    await win.screenshot({ path: test.info().outputPath('codex-resumed-badge.png') })

    // ── 4. the answer → the turn ends → ✓, counted again ──
    const endedBefore = workerLines().filter(l => /\[turn\] terminal=\S+ → ended/.test(l)).length
    fake.release()
    await expect.poll(() => workerLines().filter(l => /\[turn\] terminal=\S+ → ended/.test(l)).length, { timeout: 30_000 }).toBeGreaterThan(endedBefore)
    await expect(badge).toHaveText('✓', { timeout: 15_000 })
    await expect(badge).toHaveAttribute('data-attention', 'reported')
    await expectReportedCount(win, view, 1)
    const final = await buffer(worker)
    const states = [...final.matchAll(/\x1b\]7501;state=([a-z]+)/g)].map(m => m[1])
    log(`OSC 7501 states on screen: ${JSON.stringify(states)}; done after turn 1: ${doneSeen}`)
    expect(states).toContain('working')
    expect(states.some(s => s === 'done' || s === 'idle')).toBe(true)

    const lines = workerLines().filter(l => /\[(turn|codex-state|agent-start|attention)\]/.test(l))
    log(`worker log lines:\n${lines.join('\n')}`)
    expect(lines.some(l => l.startsWith(`[agent-start] terminal=${worker} → started (osc `))).toBe(true)
    expect(lines.filter(l => l === `[turn] terminal=${worker} → started (osc working)`).length).toBeGreaterThanOrEqual(2)
    expect(lines.some(l => l.startsWith(`[attention] terminal=${worker} → pendingQuestions=0 busy`))).toBe(true)
    expect(debugLog()).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    log(`fake model requests: ${JSON.stringify(fake.requests)}`)
    log(`spec body took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  } finally {
    if (inst) await closeIsolated(inst, log)
    await fake.close()
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
  }
})
