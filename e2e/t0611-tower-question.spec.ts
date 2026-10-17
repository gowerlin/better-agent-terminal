// PLAN-048 C / T0611: a Worker asks its Tower through BAT (T0607 main store, T0608 helpers and
// read-only MCP tools, T0609 badge), end to end in an isolated BAT.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Every helper
// and MCP session runs INSIDE a tab with that tab's own capability (as e2e/t0584-bat-mcp-shim):
// the Tower is a shell tab the test types `node runner.cjs <spec>` into; the Worker agent is a
// custom CLI running the same runner in `serve` mode, which stays up and runs the jobs the test
// drops into a temp dir. Nothing starts an LLM. Question / answer text goes through stdin only.
//
//   1. Worker `bat-notify --ask` (stdin JSON) → Tower (MCP) bat_list_questions sees it, masked;
//      bat_get_state of the Worker = blocked / tower / pendingQuestions 1; the Worker's badge is
//      the structured `?` (data-attention="question") and the Tower's "Close reported Worker tabs
//      (N)" does not count it
//   2. Worker (MCP) bat_wait_question waits; Tower `bat-terminal --answer` (stdin) wakes it →
//      answered, choice + text; the Worker leaves blocked, pendingQuestions 0, badge ✓, N = 1
//   3. a second question, then the Tower closes the Worker (--close-worker) → Tower (MCP)
//      bat_list_questions status=all: cancelled / worker-exited
//   4. a second Worker asks; BAT quits keeping the Terminal Server, relaunches, recovers →
//      the old id is lost: --cancel-question exit 0 + `status: lost` (T0611), --wait-answer lost,
//      --answer exit 3 answer: LOST, bat_list_questions status=all no longer has it
//   5. bat-scripts.log and the debug logs never have a question, an option, a detail or an answer

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  TERMINAL_SERVER_SCRIPT,
  closeIsolated,
  commandLineOf,
  launchIsolated,
  readPid,
  run,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0611')
const WS = 'e2e-t0611-ws'
const TOWER = 'e2e-t0611-tower'
const WORKER_AGENT = 'e2e-t0611-worker'
const MODERN = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }

// unique markers: none of them may reach a log
const Q1_TEXT = 'T0611-QTEXT-4b1e 要部署到哪個環境？'
const Q1_OPT = 'T0611-OPTTEXT-9c07'
const Q1_DETAIL = 'T0611-DETAILTEXT-2f6a'
const FAKE_TOKEN = 'batcap.' + 'Qm7'.repeat(15)
const A1_TEXT = 'T0611-ANSWERTEXT-6d3c 先 staging'
const Q2_TEXT = 'T0611-QTEXT2-8a51 schema 要不要改？'
const Q3_TEXT = 'T0611-QTEXT3-1e9d 重開前的問題'
const SECRETS = [Q1_TEXT, Q1_OPT, Q1_DETAIL, FAKE_TOKEN, A1_TEXT, Q2_TEXT, Q3_TEXT, 'QTEXT', 'OPTTEXT', 'DETAILTEXT', 'ANSWERTEXT']

interface McpReply { id: number; result?: Record<string, unknown>; error?: { code: number; message: string } }
interface StepResult {
  kind: string
  code?: number | null
  stdout?: string
  stderr?: string
  terminalId?: string
  replies?: McpReply[]
}

/**
 * `node runner.cjs <spec.json>`: the spec's steps with this process's env, results to `spec.out`.
 * `node runner.cjs serve <jobs dir>`: stays up; runs `<jobs>/<BAT_TERMINAL_ID>-<n>.json` specs in
 * order, results to `<n>.res.json`. Results are written with temp file + rename; nothing is printed
 * (the tab's output never carries a question or an answer). `spec.port` replaces BAT_REMOTE_PORT
 * (a relaunched BAT listens elsewhere). `$BAT_TERMINAL_ID` / `$BAT_TOWER_TERMINAL_ID` are replaced.
 *   - `{ kind: 'env' }`                          BAT_TERMINAL_ID
 *   - `{ kind: 'helper', script, args, stdin? }` `node $BAT_HELPER_DIR/<script> ...args` (< stdin)
 *   - `{ kind: 'mcp', requests }`                `node $BAT_HELPER_DIR/bat-mcp.mjs`, requests one by one
 */
const RUNNER = `
const fs = require('fs')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const sub = (env, s) => String(s).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || '').replace(/\\$BAT_TOWER_TERMINAL_ID/g, env.BAT_TOWER_TERMINAL_ID || '')
const subAll = (env, v) => typeof v === 'string' ? sub(env, v) : Array.isArray(v) ? v.map(x => subAll(env, x)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subAll(env, x)])) : v

function mcp(env, requests) {
  return new Promise(resolve => {
    const out = { kind: 'mcp', replies: [], stderr: '' }
    const child = spawn(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-mcp.mjs')], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    const timer = setTimeout(() => { out.stderr += 'runner timeout'; child.kill() }, 90000)
    let buf = ''
    let i = 0
    const next = () => {
      if (i >= requests.length) { child.stdin.end(); return }
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, ...subAll(env, requests[i]) }) + '\\n')
      i++
    }
    child.stdout.on('data', d => {
      buf += d
      let nl
      while ((nl = buf.indexOf('\\n')) !== -1) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        out.replies.push(JSON.parse(line))
        next()
      }
    })
    child.stderr.on('data', d => { out.stderr += d })
    child.on('exit', code => { clearTimeout(timer); out.code = code; resolve(out) })
    next()
  })
}

async function runSpec(spec) {
  const env = { ...process.env, ...(spec.port ? { BAT_REMOTE_PORT: String(spec.port) } : {}) }
  const results = []
  for (const step of spec.steps) {
    if (step.kind === 'env') {
      results.push({ kind: 'env', terminalId: env.BAT_TERMINAL_ID })
    } else if (step.kind === 'helper') {
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...step.args.map(a => sub(env, a))], { env, input: step.stdin || '', encoding: 'utf8', timeout: 60000, windowsHide: true })
      results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr })
    } else if (step.kind === 'mcp') {
      results.push(await mcp(env, step.requests))
    }
  }
  return results
}

function write(out, results) {
  fs.writeFileSync(out + '.tmp', JSON.stringify(results, null, 2))
  fs.renameSync(out + '.tmp', out)
}

if (process.argv[2] === 'serve') {
  const jobs = process.argv[3]
  const id = process.env.BAT_TERMINAL_ID
  let n = 0
  let busy = false
  fs.writeFileSync(path.join(jobs, id + '.ready'), String(Date.now()))
  setInterval(() => {
    const file = path.join(jobs, id + '-' + n + '.json')
    if (busy || !fs.existsSync(file)) return
    busy = true
    runSpec(JSON.parse(fs.readFileSync(file, 'utf8'))).then(results => {
      write(path.join(jobs, id + '-' + n + '.res.json'), results)
      n++
      busy = false
    })
  }, 100)
} else {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  runSpec(spec).then(results => write(spec.out, results))
}
`

const call = (name: string, args: Record<string, unknown> = {}) => ({ method: 'tools/call', params: { name, arguments: args, ...MODERN } })
const discover = { method: 'server/discover', params: MODERN }

function readResults(file: string): StepResult[] | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as StepResult[] : undefined
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

function readScriptsLog(userData: string): string {
  const file = path.join(userData, 'Logs', 'bat-scripts.log')
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Quit answering the dialog with "Quit" and the Terminal Server kept (as e2e/t0576). */
async function quitKeepingTerminalServer(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ dialog }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dialog as any).showMessageBox = async () => ({ response: 1, checkboxChecked: false })
  })
  let timer: NodeJS.Timeout | undefined
  const closed = await Promise.race([
    app.close().then(() => true, () => true),
    new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 20_000) }),
  ])
  clearTimeout(timer)
  if (!closed) {
    log('app.close() did not finish within 20 s — killing the Electron process')
    try { app.process().kill() } catch { /* already gone */ }
  }
}

/** Stops a Terminal Server left behind by this test (pid file of this runtime, command line of this repo). */
async function killLeftoverServer(pid: number | null): Promise<void> {
  if (pid === null || !isAlive(pid)) return
  const cmd = await commandLineOf(pid)
  if (!cmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase())) {
    log(`Terminal Server pid ${pid} command line does not match this repo — left alone: ${cmd.trim()}`)
    return
  }
  log(`stopping leftover Terminal Server pid ${pid}`)
  if (process.platform === 'win32') await run('taskkill', ['/T', '/F', '/PID', String(pid)]).catch(() => '')
  else try { process.kill(pid, 'SIGKILL') } catch { /* ignore */ }
}

const workerThumb = (view: Locator, workorder: string) => view.locator(`.thumbnail[data-workorder="${workorder}"]`)

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

test('Worker asks its Tower: ask → list / blocked tower / ? → answer → wait; close → worker-exited; restart → lost', async () => {
  test.setTimeout(420_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0611-'))
  const folder = path.join(tmp, 'ws')
  const jobsDir = path.join(tmp, 'jobs')
  fs.mkdirSync(folder, { recursive: true })
  fs.mkdirSync(jobsDir, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)

  let specSeq = 0
  /** Types `node runner.cjs <spec>` into tab `id` (the Tower); resolves with the results. */
  const inTower = async (win: Page, steps: unknown[], port?: number): Promise<StepResult[]> => {
    const n = specSeq++
    const out = slash(path.join(tmp, `tower-${n}.json`))
    const spec = slash(path.join(tmp, `tower-${n}-spec.json`))
    fs.writeFileSync(spec, JSON.stringify({ out, steps, port }))
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: TOWER, line: `node "${runner}" "${spec}"\r` })
    await expect.poll(() => readResults(out) !== undefined, { timeout: 90_000 }).toBe(true)
    const r = readResults(out)!
    log(`tower step ${n}: ${JSON.stringify(r).slice(0, 4000)}`)
    return r
  }
  const jobCount = new Map<string, number>()
  /** Drops a job for Worker `id` (its runner runs it in its own PTY); returns its result file. */
  const startInWorker = (id: string, steps: unknown[], port?: number): string => {
    const n = jobCount.get(id) ?? 0
    jobCount.set(id, n + 1)
    fs.writeFileSync(path.join(jobsDir, `${id}-${n}.json`), JSON.stringify({ steps, port }))
    return path.join(jobsDir, `${id}-${n}.res.json`)
  }
  const results = async (out: string): Promise<StepResult[]> => {
    await expect.poll(() => readResults(out) !== undefined, { timeout: 90_000 }).toBe(true)
    const r = readResults(out)!
    log(`${path.basename(out)}: ${JSON.stringify(r).slice(0, 4000)}`)
    return r
  }
  const inWorker = async (id: string, steps: unknown[], port?: number) => results(startInWorker(id, steps, port))
  const tool = (r: StepResult, i: number) => r.replies?.[i]?.result as Record<string, unknown> | undefined
  const structured = (r: StepResult, i: number) => tool(r, i)?.structuredContent as Record<string, AnyApi> | undefined
  const questionIdOf = (r: StepResult) => /^ {2}question: (q-[0-9a-f]{8}-[0-9a-f]{16})$/m.exec(r.stdout ?? '')?.[1]
  const ask = (workorder: string, message: string, question: Record<string, unknown>) => ({
    kind: 'helper',
    script: 'bat-notify.mjs',
    args: ['--ask', '--source', workorder, '--target', '$BAT_TOWER_TERMINAL_ID', '--no-pty-write', message],
    stdin: JSON.stringify(question),
  })

  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  let serverPid: number | null = null
  let quitUserData: { userData: string; runtimeId: string } | null = null
  try {
    inst = await launchIsolated('t0611', log)
    const { app, win, userData, runtimeId } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0611 worker', icon: 'W', color: '#888888', command: 'node', args: [runner, 'serve', slash(jobsDir)],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0611', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
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
    await win.waitForTimeout(2_000)

    const dispatch = async (w: Page, workorder: string) => {
      const [run] = await inTower(w, [
        { kind: 'helper', script: 'bat-terminal.mjs', args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', workorder] },
      ])
      expect(run.code, run.stderr).toBe(0)
      const id = /Terminal created: (\S+)/.exec(run.stdout ?? '')?.[1]
      expect(id).toBeTruthy()
      await expect.poll(() => fs.existsSync(path.join(jobsDir, `${id}.ready`)), { timeout: 30_000 }).toBe(true)
      return id!
    }

    const w1 = await dispatch(win, 'T0611')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 20_000 })
    await expectReportedCount(win, view, 0)

    // ── 1. the Worker asks; the Tower sees it; blocked / tower; structured ? not counted ──
    // The notify message deliberately does not end with `提問`: alone it would mark the tab
    // reported (✓), so the `?` and N = 0 below come from the structured question only.
    const [asked1] = await inWorker(w1, [ask('T0611', 'T0611 等塔台答覆', {
      question: Q1_TEXT,
      options: [`${Q1_OPT} staging`, `${Q1_OPT} prod`],
      allowFreeText: true,
      detail: `${Q1_DETAIL} BAT_REMOTE_TOKEN=${FAKE_TOKEN}`,
      blocking: true,
    })])
    expect(asked1.code, asked1.stderr).toBe(0)
    expect(asked1.stdout).toContain('  notified: yes')
    expect(asked1.stdout).not.toContain(Q1_TEXT)
    const q1 = questionIdOf(asked1)
    expect(q1).toBeTruthy()

    const [towerSees] = await inTower(win, [{ kind: 'mcp', requests: [
      discover,
      call('bat_list_questions'),
      call('bat_get_state', { terminalId: w1 }),
    ] }])
    expect(towerSees.code, towerSees.stderr).toBe(0)
    const listed = structured(towerSees, 1)!.questions as Array<Record<string, AnyApi>>
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({
      questionId: q1, workerTerminalId: w1, towerTerminalId: TOWER, workorder: 'T0611',
      question: Q1_TEXT, options: [`${Q1_OPT} staging`, `${Q1_OPT} prod`], allowFreeText: true, blocking: true, status: 'pending',
    })
    expect(listed[0].detail).toContain(Q1_DETAIL)
    expect(listed[0].detail).toContain('[REDACTED:batcap]')
    expect(listed[0].detail).not.toContain(FAKE_TOKEN)
    expect((tool(towerSees, 1)!.content as Array<{ text: string }>)[0].text).toMatch(new RegExp(`^1 pending questions?: ${q1} \\(T0611, `))
    expect(structured(towerSees, 2)).toMatchObject({ terminalId: w1, state: 'blocked', blockedReason: 'tower', source: 'question', pendingQuestions: 1 })

    const badge1 = workerThumb(view, 'T0611').locator('.worker-badge')
    await expect(badge1).toHaveText('?', { timeout: 15_000 })
    await expect(badge1).toHaveAttribute('data-attention', 'question')
    await expect(badge1).toHaveClass(/\bquestion\b/)
    await expectReportedCount(win, view, 0)
    await win.screenshot({ path: test.info().outputPath('structured-question-badge.png') })

    // ── 2. the Worker waits (MCP); the Tower answers (stdin) and wakes it ──
    const waitOut = startInWorker(w1, [{ kind: 'mcp', requests: [
      discover,
      call('bat_wait_question', { questionId: q1, timeoutMs: 40_000 }),
      call('bat_get_state'),
    ] }])
    await win.waitForTimeout(2_000)
    expect(readResults(waitOut)).toBeUndefined()
    const [answered] = await inTower(win, [{
      kind: 'helper', script: 'bat-terminal.mjs', args: ['--answer', q1!, '--notify-id', '$BAT_TERMINAL_ID', '--choice', '1'], stdin: `${A1_TEXT}\n`,
    }])
    expect(answered.code, answered.stderr).toBe(0)
    expect(answered.stdout.trim().split(/\r?\n/)).toEqual([`✓ Question answered: ${q1}`, `  answered: ${q1}`])
    const [waited] = await results(waitOut)
    expect(waited.code, waited.stderr).toBe(0)
    const got = structured(waited, 1)!
    expect(got).toMatchObject({ questionId: q1, changed: true, status: 'answered', answer: { choice: 1, text: A1_TEXT } })
    expect(got.waitedMs).toBeGreaterThan(1_000)
    expect((tool(waited, 1)!.content as Array<{ text: string }>)[0].text).toContain(A1_TEXT)
    const self = structured(waited, 2)!
    expect(self).toMatchObject({ terminalId: w1, pendingQuestions: 0 })
    expect(self.state).not.toBe('blocked')
    expect(self.blockedReason).toBeUndefined()

    const [after1] = await inTower(win, [{ kind: 'mcp', requests: [discover, call('bat_get_state', { terminalId: w1 }), call('bat_list_questions')] }])
    expect(structured(after1, 1)).toMatchObject({ terminalId: w1, pendingQuestions: 0 })
    expect(structured(after1, 1)!.state).not.toBe('blocked')
    expect(structured(after1, 2)!.questions).toEqual([])
    // no question left: the badge is the report (the --ask notify), counted again
    await expect(workerThumb(view, 'T0611').locator('.worker-badge.reported')).toHaveText('✓', { timeout: 15_000 })
    await expectReportedCount(win, view, 1)

    // ── 3. a second question (CT's real `T#### 提問`), then the Tower closes the Worker ──
    const [asked2] = await inWorker(w1, [ask('T0611', 'T0611 提問', { question: Q2_TEXT })])
    expect(asked2.code, asked2.stderr).toBe(0)
    const q2 = questionIdOf(asked2)
    expect(q2).toBeTruthy()
    await expect(workerThumb(view, 'T0611').locator('.worker-badge')).toHaveAttribute('data-attention', 'question', { timeout: 15_000 })
    await expectReportedCount(win, view, 0)
    const [closeRun] = await inTower(win, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--close-worker', 'T0611', '--notify-id', '$BAT_TERMINAL_ID'] },
    ])
    expect(closeRun.code, closeRun.stderr).toBe(0)
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 40_000 })
    const [ended] = await inTower(win, [{ kind: 'mcp', requests: [discover, call('bat_list_questions', { status: 'all' }), call('bat_list_questions')] }])
    const all = structured(ended, 1)!.questions as Array<Record<string, AnyApi>>
    expect(all.map(q => [q.questionId, q.status, q.endReason ?? null])).toEqual([
      [q1, 'answered', null],
      [q2, 'cancelled', 'worker-exited'],
    ])
    expect((tool(ended, 1)!.content as Array<{ text: string }>)[0].text).toContain(`${q2} (T0611, cancelled`)
    expect(structured(ended, 2)!.questions).toEqual([])

    // ── 4. a question from before a BAT restart is lost ──
    const w2 = await dispatch(win, 'T0612')
    const [asked3] = await inWorker(w2, [ask('T0612', 'T0612 提問', { question: Q3_TEXT })])
    expect(asked3.code, asked3.stderr).toBe(0)
    const q3 = questionIdOf(asked3)
    expect(q3).toBeTruthy()
    await expect(workerThumb(view, 'T0612').locator('.worker-badge')).toHaveAttribute('data-attention', 'question', { timeout: 15_000 })

    serverPid = readPid(userData)
    expect(serverPid).not.toBeNull()
    const firstDebug = readDebugLogs(userData)
    quitUserData = { userData, runtimeId }
    await quitKeepingTerminalServer(app)
    inst = undefined
    expect(isAlive(serverPid!)).toBe(true)

    relaunched = await launchIsolated('t0611', log, { runtimeId })
    const { win: win2, userData: userData2, remotePort } = relaunched
    expect(userData2).toBe(userData)
    const prompt = win2.locator('.recovery-prompt-dialog')
    await expect(prompt).toBeVisible({ timeout: 30_000 })
    await prompt.locator('.recovery-prompt-actions .btn-primary').click()
    const view2 = win2.locator('.workspace-container.active')
    await expect(view2.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    await expect.poll(() => readDebugLogs(userData2), { timeout: 30_000 }).toContain(`[helper-cap] kept restored: terminal=${w2}`)
    expect(readPid(userData2)).toBe(serverPid)

    const [cancelLost, waitLost, stateAfter] = await inWorker(w2, [
      { kind: 'helper', script: 'bat-notify.mjs', args: ['--cancel-question', q3!] },
      { kind: 'helper', script: 'bat-notify.mjs', args: ['--wait-answer', q3!, '--timeout-ms', '1000'] },
      { kind: 'mcp', requests: [discover, call('bat_get_state'), call('bat_wait_question', { questionId: q3, timeoutMs: 1_000 })] },
    ], remotePort)
    // T0611: lost is an ended question — exit 0, the status line says it (not "cancelled worker")
    expect(cancelLost.code, cancelLost.stderr).toBe(0)
    expect(cancelLost.stdout.trim().split(/\r?\n/)).toEqual([`✓ Question already ended: ${q3}`, '  status: lost'])
    expect(cancelLost.stderr).toBe('')
    expect(waitLost.code, waitLost.stderr).toBe(0)
    expect(JSON.parse(waitLost.stdout.trim().split(/\r?\n/).at(-1)!)).toMatchObject({ questionId: q3, changed: true, status: 'lost' })
    expect(structured(stateAfter, 1)).toMatchObject({ terminalId: w2, pendingQuestions: 0 })
    expect(structured(stateAfter, 1)!.blockedReason).toBeUndefined()
    expect(structured(stateAfter, 2)).toMatchObject({ questionId: q3, status: 'lost' })

    const [answerLost, listAfter] = await inTower(win2, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--answer', q3!, '--notify-id', '$BAT_TERMINAL_ID', '--choice', '1'] },
      { kind: 'mcp', requests: [discover, call('bat_list_questions', { status: 'all' })] },
    ], remotePort)
    expect(answerLost.code).toBe(3)
    expect(answerLost.stderr).toContain('answer: LOST')
    expect(structured(listAfter, 1)!.questions).toEqual([])
    await win2.screenshot({ path: test.info().outputPath('after-restart.png') })

    // ── 5. logs: ids, counts and results only ──
    const debug = readDebugLogs(userData2)
    const scriptsLog = readScriptsLog(userData2)
    log(`[tower-question] lines:\n${debug.split('\n').filter(l => l.includes('[tower-question]') || l.includes('[attention]')).join('\n')}`)
    expect(firstDebug).toContain(`[attention] terminal=${w1} → blocked reason=tower pendingQuestions=1`)
    expect(firstDebug).toContain(`[attention] terminal=${w1} → none`)
    expect(firstDebug).toMatch(new RegExp(`\\[tower-question\\] answer .*q=${q1}`))
    expect(scriptsLog).toContain('"script":"bat-mcp"')
    expect(scriptsLog).toContain('"event":"question-cancel"')
    for (const text of SECRETS) {
      expect(debug, text).not.toContain(text)
      expect(scriptsLog, text).not.toContain(text)
    }
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    await killLeftoverServer(serverPid)
    if (!relaunched && quitUserData && path.basename(quitUserData.userData).includes(`-runtime-${quitUserData.runtimeId}`)) {
      fs.rmSync(quitUserData.userData, { recursive: true, force: true })
      log(`runtime userData removed: ${!fs.existsSync(quitUserData.userData)}`)
    }
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
