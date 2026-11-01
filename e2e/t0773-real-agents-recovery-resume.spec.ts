// T0773 (v0.7.3-pre.4 automated acceptance, D215): PLAN-055 — after a Terminal Server recovery the
// interrupted agent tabs come back with the REAL agents. t0766 / t0767 use compiled stubs and only check
// the argv BAT sends; this one checks that a real claude takes `--resume=<id>` and continues the same
// conversation, and that a real codex 0.166 accepts BAT's `resume` arguments.
//
// 🔴 SPENDS TOKENS (claude only). Skipped unless BAT_E2E_REAL_MODEL=1, so a plain `npm run test:e2e` never
// runs it:
//   BAT_E2E_REAL_MODEL=1 BAT_E2E_EXECUTABLE="C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe" \
//     npx playwright test e2e/t0773-real-agents-recovery-resume.spec.ts
// Model: claude-haiku-5-5 only (the workspace's `agentCustomArgs`, no product change, no `--settings`);
// never Opus / Fable / Sonnet. Budget: ≤ 4 prompts typed into claude (MAX_TURNS) and ≤ US$0.40 estimated
// from the session transcripts' `usage` (MAX_COST_USD; streamed entries of one message repeat a growing
// usage, so each field keeps its maximum), checked before every prompt. codex never talks to a model:
// `CODEX_HOME` is an empty temp dir (no login), only its resume menu / login screen is looked at.
//
// One isolated instance (fixtures/electron-isolation.ts; BAT_E2E_EXECUTABLE = the installed build, else
// the source build), one workspace with three restored tabs: Claude CLI (embedded claude, the user's
// existing login), Codex CLI (the embedded codex of the build under test, first on PATH), a plain shell.
//   ① claude: "remember 42, answer OK" (1 turn); its session id comes back through the SessionStart hook
//   ② only the isolated instance's Terminal Server is killed — its pid read from the isolated userData,
//      its command line = the build's terminal-server.js AND its parent = the isolated main process,
//      otherwise nothing is killed — `taskkill /F` without /T (T0704) → recovery: toast with the count,
//      dialog lists claude + codex (not the shell), ⏸ on both thumbnails, nothing resumes by itself,
//      Esc closes the dialog without resuming
//   ③ claude row → Resume: the new claude process has `--resume=<the same id>` (no --fork-session) next
//      to BAT's `--mcp-config=` / `--settings=` / `--name=` → "which number?" → 42 (1 turn)
//   ④ codex row → Open resume menu: the new codex process = the first launch's arguments + `resume`
//      (no session id, no --last); codex stays up and shows its own screen (menu / login, recorded)
//
// The real HOME is kept (the claude login lives there); the spec never opens, copies or prints a
// credential file or token and never dumps the env; inherited ANTHROPIC_* / CLAUDE* / OPENAI_* / CODEX_*
// are dropped. Folders live under %ProgramData%\bat-e2e-t0773-* and are removed afterwards, so are the
// claude session folders in ~/.claude/projects whose name contains `bat-e2e-t0773` (nothing else there).
// Logged command lines have the home folder replaced by `<home>`.
//
// Windows only (embedded claude.exe / codex.exe, process table via Get-CimInstance).

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  E2E_EXECUTABLE,
  REPO_ROOT,
  TERMINAL_SERVER_SCRIPT,
  closeIsolated,
  commandLineOf,
  launchIsolated,
  readPid,
  run,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'
import { getModelPricing } from '../src/lib/model-pricing'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0773')
const RUN_TAG = 't0773'
const WS = 'e2e-t0773-ws'
const CLAUDE_TAB = 'e2e-t0773-claude'
const CODEX_TAB = 'e2e-t0773-codex'
const SHELL_TAB = 'e2e-t0773-shell'
const MODEL = 'claude-haiku-5-5'
const CLAUDE_ARGS = `--model ${MODEL} --strict-mcp-config`
const MAX_TURNS = 4
const MAX_COST_USD = 0.4
const TURN_TIMEOUT_MS = 180_000
const FORBIDDEN_MODEL = /opus|fable|sonnet/i
const INHERITED = /^(ANTHROPIC_|CLAUDE|OPENAI_|CODEX_)/i
const TRUST_SCREEN = /Yes,?Itrustthisfolder/i // matched with whitespace removed (the TUI draws with cursor moves)
const ARG_ERROR = /unexpected argument|unrecognized subcommand|Usage:\s*codex|error:\s/i

const pathKey = Object.keys(process.env).find(k => k.toLowerCase() === 'path') ?? 'Path'
// `npx playwright` puts node_modules/.bin on PATH; BAT started normally has none
const APP_PATH = (process.env[pathKey] ?? '').split(';').filter(d => !/node_modules[\\/]\.bin/i.test(d)).join(';')
const MODULES = E2E_EXECUTABLE
  ? path.join(path.dirname(E2E_EXECUTABLE), 'resources', 'app.asar.unpacked', 'node_modules')
  : path.join(REPO_ROOT, 'node_modules')
const CODEX_VENDOR = path.join(MODULES, '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc')
const CODEX_BIN = path.join(CODEX_VENDOR, 'bin')
const EMBEDDED_CLAUDE = path.join(MODULES, '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')

interface Proc { ProcessId: number; ParentProcessId: number; Name: string }
interface UsageRow { ts: number; model: string; id: string; input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }
interface TurnRecord { label: string; start: number; end: number; ended: boolean }

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

const HOME_RE = new RegExp(os.homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
const USER_RE = new RegExp(`\\b${os.userInfo().username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
/** De-identified text for the logs (D176): the home folder and the account name never appear. */
const deid = (text: string) => text.replace(HOME_RE, '<home>').replace(USER_RE, '<user>')

async function withoutInheritedAgentEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (INHERITED.test(k) && v !== undefined) { saved[k] = v; delete process.env[k] }
  try {
    return await fn()
  } finally {
    Object.assign(process.env, saved)
  }
}

async function processTable(): Promise<Proc[]> {
  const out = await run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress',
  ], 30_000)
  return JSON.parse(out) as Proc[]
}

function descendants(table: Proc[], root: number): Proc[] {
  const out: Proc[] = []
  const stack = [root]
  const seen = new Set<number>([root])
  while (stack.length) {
    const parent = stack.pop()!
    for (const p of table) {
      if (p.ParentProcessId !== parent || p.ProcessId === parent || seen.has(p.ProcessId)) continue
      seen.add(p.ProcessId)
      out.push(p)
      stack.push(p.ProcessId)
    }
  }
  return out
}

/** Command lines of the `exe` processes under `root` (the Terminal Server). */
async function agentCommandLines(root: number, exe: string): Promise<Array<{ pid: number; cmd: string }>> {
  const procs = descendants(await processTable(), root).filter(p => p.Name.toLowerCase() === exe)
  const out: Array<{ pid: number; cmd: string }> = []
  for (const p of procs) out.push({ pid: p.ProcessId, cmd: (await commandLineOf(p.ProcessId)).trim() })
  return out.filter(p => p.cmd)
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

/** Teardown only: a Terminal Server pid this spec read from its own userData, command line checked. */
async function killLeftoverServer(pid: number | null): Promise<void> {
  if (pid === null || !isAlive(pid)) return
  const cmd = await commandLineOf(pid)
  if (!cmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase())) return
  log(`stopping leftover Terminal Server pid ${pid}`)
  await run('taskkill', ['/T', '/F', '/PID', String(pid)]).catch(() => '')
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

/** Top-level transcript names (= claude session ids) of this run's project folders. */
function transcriptSessionIds(): string[] {
  const ids: string[] = []
  for (const d of claudeProjectDirs()) {
    for (const e of fs.readdirSync(path.join(projectsDir(), d))) if (e.endsWith('.jsonl')) ids.push(e.slice(0, -6))
  }
  return ids
}

/**
 * Only the `usage` / `model` / `id` / `timestamp` of assistant entries; nothing else is kept or printed.
 * Streamed entries of one message repeat a growing usage: every field keeps its maximum (T0739 F1).
 */
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
        const next: UsageRow = {
          ts: Date.parse(j.timestamp ?? '') || 0, model: String(m.model ?? '?'), id,
          input: Number(u.input_tokens ?? 0), output: Number(u.output_tokens ?? 0), cacheRead: Number(u.cache_read_input_tokens ?? 0),
          cacheWrite5m: Math.max(0, cw - w1h), cacheWrite1h: w1h,
        }
        const prev = rows.get(id)
        rows.set(id, prev ? {
          ...next, ts: Math.min(prev.ts || next.ts, next.ts || prev.ts),
          input: Math.max(prev.input, next.input), output: Math.max(prev.output, next.output), cacheRead: Math.max(prev.cacheRead, next.cacheRead),
          cacheWrite5m: Math.max(prev.cacheWrite5m, next.cacheWrite5m), cacheWrite1h: Math.max(prev.cacheWrite1h, next.cacheWrite1h),
        } : next)
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

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

const row = (win: Page, id: string) => win.locator(`.interrupted-agents-dialog li[data-terminal-id="${id}"]`)

test.skip(process.env.BAT_E2E_REAL_MODEL !== '1', 'real-model acceptance spends tokens: set BAT_E2E_REAL_MODEL=1 to run')
test.skip(process.platform !== 'win32', 'embedded claude.exe / codex.exe and the process table: Windows only')

test('a recovery interrupts the real claude and codex tabs; claude resumes the same conversation, codex opens its resume menu', async () => {
  test.setTimeout(1_200_000)
  test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found at ${EMBEDDED_CLAUDE}`)
  test.skip(!fs.existsSync(path.join(CODEX_BIN, 'codex.exe')), `embedded codex not found at ${CODEX_BIN}`)
  const startedAt = Date.now()
  const results: Record<string, string> = {}
  const turns: TurnRecord[] = []
  let stopped = ''
  expect(FORBIDDEN_MODEL.test(MODEL)).toBe(false)
  expect(claudeProjectDirs()).toEqual([])

  const subject = E2E_EXECUTABLE
    ? `installed build ${E2E_EXECUTABLE} FileVersion ${(await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Item -LiteralPath '${E2E_EXECUTABLE.replace(/'/g, "''")}').VersionInfo.FileVersion`])).trim()}`
    : 'source build (dist / dist-electron)'
  log(`subject: ${subject}`)
  log(`embedded codex: ${(await run(path.join(CODEX_BIN, 'codex.exe'), ['--version'])).trim()}`)

  const root = fs.mkdtempSync(path.join(process.env.ProgramData || 'C:\\ProgramData', `bat-e2e-${RUN_TAG}-`))
  const folder = path.join(root, 'ws')
  const codexHome = path.join(root, 'codex-home')
  for (const dir of [folder, codexHome]) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(folder, 'README.md'), '# T0773 workspace\n\nA scratch folder for the BAT real-model acceptance.\n')

  let inst: IsolatedInstance | undefined
  const serverPids: number[] = []
  try {
    const codexPath = path.join(CODEX_VENDOR, 'codex-path')
    inst = await withoutInheritedAgentEnv(() => launchIsolated(RUN_TAG, log, { env: { PATH: `${CODEX_BIN};${codexPath};${APP_PATH}`, CODEX_HOME: codexHome } }))
    const { app, win, userData } = inst
    const mainPid = await app.evaluate(() => process.pid)

    const logLines = (id: string, tag: string) => readDebugLogs(userData).split('\n').filter(l => l.includes(`terminal=${id}`) && l.includes(tag))
    const startedCount = (id: string) => logLines(id, '[agent-start]').filter(l => /→ started \(hook session-start\)/.test(l)).length
    const turnEnds = (id: string) => logLines(id, '[turn]').filter(l => /→ ended \(/.test(l)).length
    const replay = async (id: string) => {
      const b = (await win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id)) as { data?: string; total?: number } | null
      return { data: b?.data ?? '', total: b?.total ?? 0 }
    }
    const since = async (id: string, total: number) => {
      const b = await replay(id)
      return stripAnsi(b.data.slice(Math.max(0, b.data.length - Math.max(0, b.total - total))))
    }
    const screen = async (id: string, n = 2500) => stripAnsi((await replay(id)).data).slice(-n)
    const write = (id: string, data: string) => win.evaluate(({ tid, d }) => (window as AnyApi).electronAPI.pty.write(tid, d), { tid: id, d: data })
    const typePrompt = async (id: string, text: string) => {
      await write(id, text)
      await win.waitForTimeout(600)
      await write(id, '\r')
    }
    /** Waits for claude's n-th SessionStart; answers the folder-trust screen once through the PTY. */
    const waitStarted = async (n: number, what: string) => {
      let trustAnswered = false
      const deadline = Date.now() + 120_000
      while (Date.now() < deadline) {
        if (startedCount(CLAUDE_TAB) >= n) {
          log(`${what}: started; folder-trust screen answered: ${trustAnswered}`)
          return
        }
        if (!trustAnswered && TRUST_SCREEN.test((await screen(CLAUDE_TAB, 1500)).replace(/\s+/g, ''))) {
          await win.waitForTimeout(800)
          await write(CLAUDE_TAB, '\x1b[B') // claude 2.1.316: "No, exit" first, "Yes, I trust this folder" second
          await win.waitForTimeout(600)
          await write(CLAUDE_TAB, '\r')
          trustAnswered = true
          log(`${what}: folder-trust screen answered (↓ + Enter)`)
        }
        await win.waitForTimeout(1_000)
      }
      log(`${what}: no SessionStart within 120 s. screen:\n${deid(await screen(CLAUDE_TAB))}`)
      throw new Error(`${what}: claude did not start`)
    }
    const budgetOk = (label: string): boolean => {
      if (stopped) return false
      if (turns.length >= MAX_TURNS) { stopped = `turn budget ${MAX_TURNS} reached before ${label}`; return false }
      const cost = totalCost(readUsage())
      if (cost > MAX_COST_USD) { stopped = `estimated cost US$${cost.toFixed(4)} > ${MAX_COST_USD} before ${label}`; return false }
      return true
    }
    /** Types one prompt into the claude tab and waits for its Stop hook; returns the text written meanwhile. */
    const runTurn = async (label: string, prompt: string): Promise<string | null> => {
      if (!budgetOk(label)) return null
      const endsBefore = turnEnds(CLAUDE_TAB)
      const total = (await replay(CLAUDE_TAB)).total
      const rec: TurnRecord = { label, start: Date.now(), end: 0, ended: false }
      turns.push(rec)
      await typePrompt(CLAUDE_TAB, prompt)
      rec.ended = await expect.poll(() => turnEnds(CLAUDE_TAB) > endsBefore, { timeout: TURN_TIMEOUT_MS, intervals: [1_000] }).toBe(true).then(() => true, () => false)
      await win.waitForTimeout(1_500) // the answer's last redraw
      rec.end = Date.now()
      const text = await since(CLAUDE_TAB, total)
      log(`turn ${turns.length} ${label}: ended=${rec.ended} ${Math.round((rec.end - rec.start) / 1000)} s`)
      return text
    }

    // ── seed: one workspace (claude args: Haiku 5.5), Claude CLI + Codex CLI + a plain shell ──
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: WS, folderPath: folder, createdAt: Date.now(), agentCustomArgs: { 'claude-cli': CLAUDE_ARGS } }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: CLAUDE_TAB, workspaceId: WS, type: 'terminal', agentPreset: 'claude-cli', title: 'Claude CLI', cwd: folder },
        { id: CODEX_TAB, workspaceId: WS, type: 'terminal', agentPreset: 'codex-cli', title: 'Codex CLI', cwd: folder },
        { id: SHELL_TAB, workspaceId: WS, type: 'terminal', title: 'T0773 shell', cwd: folder },
      ],
      activeTerminalId: CLAUDE_TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(3, { timeout: 30_000 })

    // ── ① claude starts (SessionStart → session id), remembers 42 ──
    await waitStarted(1, '① claude')
    const server = readPid(userData)!
    expect(server).not.toBeNull()
    serverPids.push(server)
    const sessionLine = logLines(CLAUDE_TAB, '[agent-start]').find(l => /session=[0-9a-f]{8}/.test(l)) ?? ''
    const sessionPrefix = /session=([0-9a-f]{8})/.exec(sessionLine)?.[1] ?? ''
    log(`① SessionStart log: ${sessionLine.replace(/^.*?\[agent-start\]/, '[agent-start]')}`)
    expect(sessionPrefix).toMatch(/^[0-9a-f]{8}$/)
    const firstClaude = (await agentCommandLines(server, 'claude.exe')).find(p => p.cmd.includes('--name='))
    expect(firstClaude, 'the claude process under the isolated Terminal Server').toBeTruthy()
    log(`① claude command line: ${deid(firstClaude!.cmd)}`)
    expect(firstClaude!.cmd).toContain(`--model ${MODEL}`)
    expect(firstClaude!.cmd).not.toMatch(/--resume/)
    const nameArg = /--name=(?:"[^"]*"|\S+)/.exec(firstClaude!.cmd)?.[0] ?? ''
    expect(nameArg).not.toBe('')

    const t1 = await runTurn('① remember 42', '請記住數字 42。只回答 OK，不要使用任何工具。')
    expect(t1, stopped).not.toBeNull()
    const ok1 = /\bOK\b/.test(t1!)
    log(`① answer contains OK: ${ok1}; tail ${JSON.stringify(t1!.replace(/\s+/g, ' ').slice(-160))}`)
    const sessionIds = transcriptSessionIds()
    const sessionId = sessionIds.find(id => id.startsWith(sessionPrefix)) ?? ''
    log(`① transcripts in this run's project folder: ${sessionIds.length}; one matches the hook's session prefix: ${sessionId !== ''}`)
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    results['①'] = `PASS — claude (${MODEL}) started (SessionStart, session ${sessionPrefix}…, = transcript name), answered OK: ${ok1}`

    // codex: the first launch (no model; the temp CODEX_HOME has no login)
    let firstCodex: { pid: number; cmd: string } | undefined
    await expect.poll(async () => (firstCodex = (await agentCommandLines(server, 'codex.exe'))[0]) !== undefined, { timeout: 60_000, intervals: [2_000] }).toBe(true)
    log(`codex first command line: ${deid(firstCodex!.cmd)}`)
    expect(firstCodex!.cmd.toLowerCase()).toContain(CODEX_BIN.toLowerCase())
    expect(firstCodex!.cmd).not.toMatch(/\sresume\b/)
    await win.waitForTimeout(5_000)
    log(`codex first screen (tail): ${JSON.stringify(deid((await screen(CODEX_TAB, 600)).replace(/\s+/g, ' ')))}`)

    // ── ② only the isolated instance's Terminal Server dies ──
    const serverCmd = await commandLineOf(server)
    const parent = (await processTable()).find(p => p.ProcessId === server)?.ParentProcessId ?? -1
    const isOurs = serverCmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase()) && parent === mainPid
    log(`② Terminal Server pid ${server} (from the isolated userData): command line has the build's terminal-server.js ${serverCmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase())}, parent ${parent} = isolated main ${mainPid}: ${parent === mainPid}`)
    if (!isOurs) {
      results['②'] = 'BLOCKED — the pid did not match the isolated instance; nothing was killed'
      throw new Error('Terminal Server pid does not belong to the isolated instance — not killed')
    }
    const resumeLinesBefore = readDebugLogs(userData).split('\n').filter(l => l.includes('[interrupted-agents] resumed')).length
    await run('taskkill', ['/F', '/PID', String(server)])
    log(`② killed Terminal Server ${server} (no /T)`)
    await expect.poll(() => readDebugLogs(userData), { timeout: 30_000 }).toContain('[PtyManager] Terminal Server recovery complete')
    expect(readDebugLogs(userData)).toContain('attempting recovery... (reason=ipc-exit)')
    await expect.poll(() => { const p = readPid(userData); return p !== null && p !== server }, { timeout: 30_000 }).toBe(true)
    const newServer = readPid(userData)!
    serverPids.push(newServer)
    const toast = win.locator('.server-status-toast-interrupted')
    const toastCount = await expect(toast).toBeVisible({ timeout: 15_000 }).then(() => toast.getAttribute('data-interrupted-count'), () => null)
    const toastText = toastCount === null ? '' : ((await toast.textContent()) ?? '').trim()
    log(`② toast: count=${toastCount} text=${JSON.stringify(toastText)}`)
    const interruptedLines = readDebugLogs(userData).split('\n').filter(l => l.includes('[interrupted-agents] interrupted:'))
    log(`② interrupted-agents lines:\n${interruptedLines.map(l => l.replace(/^.*?\[interrupted-agents\]/, '[interrupted-agents]')).join('\n')}`)
    expect(interruptedLines.some(l => l.includes(`terminal=${CLAUDE_TAB} agent=claude-cli`) && l.includes(`session=${sessionPrefix}`))).toBe(true)
    expect(interruptedLines.some(l => l.includes(`terminal=${CODEX_TAB} agent=codex-cli`))).toBe(true)
    expect(interruptedLines.some(l => l.includes(`terminal=${SHELL_TAB}`))).toBe(false)
    const store = JSON.parse(fs.readFileSync(path.join(userData, 'claude-sessions.json'), 'utf8'))
    expect((store.interrupted as Array<{ terminalId: string; sessionId: string }>).find(e => e.terminalId === CLAUDE_TAB)?.sessionId).toBe(sessionId)

    await expect(win.locator('.interrupted-agents-dialog')).toBeVisible({ timeout: 15_000 })
    await expect(row(win, CLAUDE_TAB)).toHaveAttribute('data-resumable', 'true')
    await expect(row(win, CODEX_TAB)).toHaveAttribute('data-resumable', 'true')
    await expect(row(win, SHELL_TAB)).toHaveCount(0)
    await expect(win.locator('.interrupted-agent-badge')).toHaveCount(2)
    await win.screenshot({ path: test.info().outputPath('2-dialog.png') })
    expect(toastCount).toBe('2')

    // nothing resumes by itself; Esc closes the dialog without resuming
    await win.waitForTimeout(5_000)
    // The dialog opens by itself after the recovery: record where the keyboard focus is (run 1 of T0773:
    // the first Esc did not close it). Esc as it comes; if the dialog stays, click its title (focus
    // leaves whatever had it) and press Esc again — observed and reported, the second Esc is asserted.
    const focusOf = () => win.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return { tag: el?.tagName ?? null, cls: (el?.className && typeof el.className === 'string' ? el.className : '').slice(0, 80), inXterm: !!el?.closest('.xterm'), inDialog: !!el?.closest('.interrupted-agents-dialog') }
    })
    const focusBeforeEsc = await focusOf()
    await win.keyboard.press('Escape')
    const firstEscClosed = await expect(win.locator('.interrupted-agents-dialog')).toHaveCount(0, { timeout: 5_000 }).then(() => true, () => false)
    log(`② focus when the dialog had opened by itself: ${JSON.stringify(focusBeforeEsc)}; first Esc closed the dialog: ${firstEscClosed}`)
    if (!firstEscClosed) {
      await win.locator('.interrupted-agents-dialog .dialog-header').click({ position: { x: 5, y: 5 } })
      const focusAfterClick = await focusOf()
      await win.keyboard.press('Escape')
      const secondEscClosed = await expect(win.locator('.interrupted-agents-dialog')).toHaveCount(0, { timeout: 5_000 }).then(() => true, () => false)
      log(`② after clicking the dialog title: focus ${JSON.stringify(focusAfterClick)}; second Esc closed the dialog: ${secondEscClosed}`)
      expect(secondEscClosed).toBe(true)
    }
    await win.waitForTimeout(5_000)
    const noAutoResume = {
      claudeStarts: startedCount(CLAUDE_TAB),
      resumeLines: readDebugLogs(userData).split('\n').filter(l => l.includes('[interrupted-agents] resumed')).length - resumeLinesBefore,
      agentsUnderNewServer: (await agentCommandLines(newServer, 'claude.exe')).length + (await agentCommandLines(newServer, 'codex.exe')).length,
      badges: await win.locator('.interrupted-agent-badge').count(),
    }
    log(`② after recovery + Esc: ${JSON.stringify(noAutoResume)}`)
    expect(noAutoResume).toEqual({ claudeStarts: 1, resumeLines: 0, agentsUnderNewServer: 0, badges: 2 })
    results['②'] = `PASS — recovery (reason=ipc-exit); toast count ${toastCount} ("${toastText}"); dialog lists claude + codex, not the shell; ⏸ ×2; no agent started by itself; ${firstEscClosed ? 'Esc closed the dialog' : `the first Esc did NOT close the dialog (focus ${JSON.stringify(focusBeforeEsc)}), Esc after clicking its title did`}, nothing resumed`

    // reopen from a ⏸ badge
    await win.locator('.interrupted-agent-badge').first().click()
    await expect(win.locator('.interrupted-agents-dialog')).toBeVisible({ timeout: 10_000 })

    // ── ③ claude: Resume → --resume=<same id>, the same conversation ──
    await row(win, CLAUDE_TAB).locator('[data-action="resume"]').click()
    await waitStarted(2, '③ claude resume')
    let resumedClaude: { pid: number; cmd: string } | undefined
    await expect.poll(async () => (resumedClaude = (await agentCommandLines(newServer, 'claude.exe')).find(p => p.cmd.includes('--resume'))) !== undefined, { timeout: 30_000, intervals: [2_000] }).toBe(true)
    const rc = resumedClaude!.cmd
    log(`③ claude command line: ${deid(rc)}`)
    expect(rc).toContain(`--resume=${sessionId}`)
    expect(rc).not.toContain('--fork-session')
    expect(rc).toMatch(/--mcp-config=/)
    expect(rc).toMatch(/--settings=/)
    expect(rc).toContain(nameArg)
    expect(rc).toContain(`--model ${MODEL}`)
    const resumedPrefix = /session=([0-9a-f]{8})/.exec(logLines(CLAUDE_TAB, '[agent-start]').filter(l => /session=/.test(l)).pop() ?? '')?.[1]
    log(`③ SessionStart after resume: session ${resumedPrefix}… (before ${sessionPrefix}…)`)
    await expect(row(win, CLAUDE_TAB)).toHaveCount(0)
    const t3 = await runTurn('③ recall', '剛才要你記住的數字是多少？只回答數字，不要使用任何工具。')
    const recalled = t3 !== null && /\b42\b/.test(t3)
    log(`③ answer contains 42: ${recalled}; tail ${JSON.stringify((t3 ?? '').replace(/\s+/g, ' ').slice(-160))}`)
    expect(t3, stopped).not.toBeNull()
    expect(recalled).toBe(true)
    results['③'] = `PASS — the new claude has --resume=<the same id> (no --fork-session; --mcp-config= / --settings= / ${nameArg.split('=')[0]}= / --model kept); SessionStart session ${resumedPrefix}…; answered 42`

    // ── ④ codex: Open resume menu → the first launch's arguments + `resume` ──
    await row(win, CODEX_TAB).locator('[data-action="resume"]').click()
    let resumedCodex: { pid: number; cmd: string } | undefined
    await expect.poll(async () => (resumedCodex = (await agentCommandLines(newServer, 'codex.exe')).find(p => /\sresume\b/.test(p.cmd))) !== undefined, { timeout: 60_000, intervals: [2_000] }).toBe(true)
    const xc = resumedCodex!.cmd
    log(`④ codex command line: ${deid(xc)}`)
    expect(xc).not.toContain('--last')
    expect(xc.replace(/\s+resume\s*$/, '')).toBe(firstCodex!.cmd)
    await win.waitForTimeout(10_000)
    const codexScreen = await screen(CODEX_TAB, 1500)
    const flat = codexScreen.replace(/\s+/g, ' ')
    const stillUp = isAlive(resumedCodex!.pid)
    log(`④ codex alive after 10 s: ${stillUp}; argument error on screen: ${ARG_ERROR.test(codexScreen)}; screen (tail): ${JSON.stringify(deid(flat.slice(-600)))}`)
    await win.screenshot({ path: test.info().outputPath('4-codex-resume.png') })
    expect(stillUp).toBe(true)
    expect(ARG_ERROR.test(codexScreen)).toBe(false)
    await expect(win.locator('.interrupted-agents-dialog')).toHaveCount(0, { timeout: 15_000 })
    await expect(win.locator('.interrupted-agent-badge')).toHaveCount(0)
    results['④'] = `PASS — the new codex = the first launch's arguments + resume (no id, no --last); still running after 10 s, no argument error; screen recorded`

    const debug = readDebugLogs(userData)
    expect(debug).not.toContain(sessionId) // logs carry the first 8 characters only
    expect(debug).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
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
    log(`transcripts: ${usage.length} assistant API calls by model ${JSON.stringify(byModel)}; estimated total US$${totalCost(usage).toFixed(5)} (src/lib/model-pricing.ts)`)
    if (inst) await closeIsolated(inst, log)
    for (const pid of serverPids) await killLeftoverServer(pid)
    if (stopped) log(`⛔ stopped: ${stopped}`)
    for (const [k, v] of Object.entries(results)) log(`${k} ${v}`)
    log(`turns typed: ${turns.length}`)
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
    log(`workspace folders removed: ${!fs.existsSync(root)}`)
    const sessions = claudeProjectDirs()
    for (const name of sessions) fs.rmSync(path.join(projectsDir(), name), { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    log(`removed ${sessions.length} ~/.claude/projects folder(s) matching bat-e2e-${RUN_TAG}; left: ${claudeProjectDirs().length}`)
    log(`T0773 spec took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  }
  expect(stopped).toBe('')
})
