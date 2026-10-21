// T0694 (D180): a Worker that reported and then works again (a Renew in the same tab) shows ↻, not ✓,
// and the Tower's "Close reported Worker tabs (N)" does not count it; the turn ends → ✓ again. The
// batch-close confirm marks a listed tab that printed within 5 s "still printing".
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The Worker agent
// is a custom CLI running a node script that stays up and runs jobs the test drops into a temp dir —
// `bat-notify.mjs` / `bat-hook.mjs` from INSIDE the Worker PTY with the PTY's own capability (the
// claude hooks `UserPromptSubmit` / `Stop` as claude would run them), or prints a line. Nothing starts
// an LLM. Helper logs go to a temp dir.
//
//   1. T0694's turn starts (user-prompt-submit), it reports inside that turn → ✓, N = 1; stop → ✓
//   2. the user makes it work again (user-prompt-submit) → ↻ (data-attention resumed), N = 0
//   3. T0695 reports and prints → N = 1; the confirm lists only T0695, marked "still printing", unmarked after 5 s
//   4. T0694's turn ends without a new report (stop) → ✓, N = 2
//   5. another turn, a new report inside it → ✓ (counted) while the turn still runs
//
// The quiet fallback (60 s without output ends a turn claude ended without `Stop`) is covered by the
// unit tests (electron/__tests__/agent-turn-attention.test.ts), not here.

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0694')
const WS = 'e2e-t0694-ws'
const TOWER = 'e2e-t0694-tower'
const WORKER_AGENT = 'e2e-t0694-worker'

/** Runs `<jobs>/<terminal id>-<n>.json` jobs in order (a helper script, or `print`); writes `<n>.res.json`. */
const workerScript = (jobsDir: string, scriptsDir: string) => `
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
const jobs = ${JSON.stringify(jobsDir)}
const scripts = ${JSON.stringify(scriptsDir)}
const id = process.env.BAT_TERMINAL_ID
const fill = v => String(v).replace(/\\{env:([A-Z0-9_]+)\\}/g, (_, n) => process.env[n] || '')
let n = 0
let busy = false
fs.writeFileSync(path.join(jobs, id + '.ready'), String(Date.now()))
process.stdout.write('t0694 worker ready\\n')
const done = (file, result) => {
  fs.writeFileSync(file + '.tmp', JSON.stringify(result))
  fs.renameSync(file + '.tmp', path.join(jobs, id + '-' + n + '.res.json'))
  n++
  busy = false
}
setInterval(() => {
  const file = path.join(jobs, id + '-' + n + '.json')
  if (busy || !fs.existsSync(file)) return
  busy = true
  const job = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (job.print) {
    process.stdout.write(job.print + '\\n')
    return done(file, { code: 0, stdout: '', stderr: '' })
  }
  const child = spawn(process.execPath, [path.join(scripts, job.script), ...job.args.map(fill)], { env: process.env, windowsHide: true })
  let stdout = '', stderr = ''
  child.stdout.on('data', d => { stdout += d })
  child.stderr.on('data', d => { stderr += d })
  child.on('close', code => done(file, { code, stdout, stderr }))
  child.stdin.end(job.stdin || '')
}, 100)
`

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }
interface SavedTerminal { id: string; workerReport?: { message: string } }

function runHelper(script: string, env: NodeJS.ProcessEnv, args: string[], cwd: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      resolve({ code, stdout: String(stdout), stderr: String(stderr), terminalId: /Terminal created: (\S+)/.exec(String(stdout))?.[1] })
    })
  })
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

async function savedTerminals(win: Page): Promise<SavedTerminal[]> {
  const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? (JSON.parse(raw) as { terminals: SavedTerminal[] }).terminals : []
}

/** Env for helpers the test runs itself (the dispatch): the server token, as t0538 / t0609. */
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

test('a reported Worker that works again shows ↻ and is not batch-closed; its turn ends → ✓', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0694-'))
  const folder = path.join(tmp, 'ws')
  const jobsDir = path.join(tmp, 'jobs')
  fs.mkdirSync(folder, { recursive: true })
  fs.mkdirSync(jobsDir, { recursive: true })
  const script = path.join(tmp, 'worker.mjs').split(path.sep).join('/')
  fs.writeFileSync(script, workerScript(jobsDir, path.join(REPO_ROOT, 'scripts')))
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0694', log)
    const { app, win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0694 worker', icon: 'W', color: '#888888', command: 'node', args: [script],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0694', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'Tower', cwd: folder }],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const view = win.locator('.workspace-container.active')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })

    const env = await helperEnv(app, userData, inst.remotePort, tmp)
    const dispatch = async (workorder: string) => {
      const run = await runHelper('bat-terminal.mjs', env, ['--notify-id', TOWER, '--workspace', WS, '--skill', 'ct-exec', '--workorder', workorder], folder)
      log(`dispatch ${workorder}: exit=${run.code}\n${run.stdout}${run.stderr}`)
      expect(run.code, run.stderr).toBe(0)
      expect(run.terminalId).toBeTruthy()
      await expect.poll(() => fs.existsSync(path.join(jobsDir, `${run.terminalId}.ready`)), { timeout: 30_000 }).toBe(true)
      return run.terminalId!
    }
    const jobCount = new Map<string, number>()
    /** Runs a job inside Worker `id`'s PTY (its own capability) and waits for it. */
    const inWorker = async (id: string, job: { script?: string; args?: string[]; stdin?: string; print?: string }) => {
      const n = jobCount.get(id) ?? 0
      jobCount.set(id, n + 1)
      fs.writeFileSync(path.join(jobsDir, `${id}-${n}.json`), JSON.stringify(job))
      const res = path.join(jobsDir, `${id}-${n}.res.json`)
      await expect.poll(() => fs.existsSync(res), { timeout: 30_000 }).toBe(true)
      const out = JSON.parse(fs.readFileSync(res, 'utf8')) as HelperRun
      log(`in ${id}: ${job.script ?? 'print'} ${(job.args ?? []).join(' ')} → exit=${out.code}\n${out.stdout}${out.stderr}`)
      expect(out.code, out.stderr).toBe(0)
      return out
    }
    const notify = (id: string, workorder: string, message: string) =>
      inWorker(id, { script: 'bat-notify.mjs', args: ['--source', workorder, '--target', '{env:BAT_TOWER_TERMINAL_ID}', '--no-pty-write', message] })
    const turnStart = (id: string) => inWorker(id, { script: 'bat-hook.mjs', args: ['user-prompt-submit'], stdin: JSON.stringify({ hook_event_name: 'UserPromptSubmit' }) })
    const turnEnd = (id: string) => inWorker(id, { script: 'bat-hook.mjs', args: ['stop'], stdin: JSON.stringify({ hook_event_name: 'Stop' }) })

    const w1 = await dispatch('T0694')
    const w2 = await dispatch('T0695')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(3, { timeout: 20_000 })
    const badge1 = workerThumb(view, 'T0694').locator('.worker-badge')

    // ── 1. the ct-exec turn: it reports inside the turn → ✓ (counted); the turn ends → still ✓ ──
    await turnStart(w1)
    await notify(w1, 'T0694', 'T0694 完成')
    await expect(badge1).toHaveText('✓', { timeout: 15_000 })
    await expect(badge1).toHaveAttribute('data-attention', 'reported')
    await expectReportedCount(win, view, 1)
    await turnEnd(w1)
    await expect.poll(() => readDebugLogs(userData).includes(`[turn] terminal=${w1} → ended (hook stop)`), { timeout: 15_000 }).toBe(true)
    await expect(badge1).toHaveText('✓')
    await expectReportedCount(win, view, 1)

    // ── 2. Renew in the same tab: a new turn → ↻, not counted ──
    await turnStart(w1)
    await expect(badge1).toHaveText('↻', { timeout: 15_000 })
    await expect(badge1).toHaveAttribute('data-attention', 'resumed')
    await expect(badge1).toHaveClass(/\bresumed\b/)
    await expect(badge1).toHaveAttribute('title', /T0694 完成/)
    await expectReportedCount(win, view, 0)
    await win.screenshot({ path: test.info().outputPath('resumed-badge.png') })

    // ── 3. T0695 reports and prints: the confirm lists only it, "still printing", unmarked after 5 s ──
    await notify(w2, 'T0695', 'T0695 完成')
    await expect(workerThumb(view, 'T0695').locator('.worker-badge')).toHaveText('✓', { timeout: 15_000 })
    await expectReportedCount(win, view, 1)
    await inWorker(w2, { print: 'T0695 still printing a summary' })
    await view.locator('.thumbnail', { hasText: 'Tower' }).first().click({ button: 'right' })
    await win.locator('.context-menu [data-action="close-reported-workers"]').click()
    const dialog = win.locator('.worker-batch-close-dialog')
    const items = dialog.locator('.worker-batch-close-list li')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toHaveAttribute('data-terminal-id', w2)
    await expect(items.first()).toHaveAttribute('data-still-printing', 'true')
    await expect(items.first().locator('.worker-batch-close-printing')).toBeVisible()
    await win.screenshot({ path: test.info().outputPath('batch-close-still-printing.png') })
    await expect(items.first()).not.toHaveAttribute('data-still-printing', 'true', { timeout: 15_000 })
    await expect(items.first().locator('.worker-batch-close-printing')).toHaveCount(0)
    await dialog.locator('.dialog-btn.cancel').click()
    await expect(dialog).toHaveCount(0)

    // ── 4. the resumed turn ends without a new report → ✓, counted again ──
    await turnEnd(w1)
    await expect(badge1).toHaveText('✓', { timeout: 15_000 })
    await expectReportedCount(win, view, 2)

    // ── 5. another turn, a new report inside it → ✓ while the turn still runs ──
    await turnStart(w1)
    await expect(badge1).toHaveText('↻', { timeout: 15_000 })
    await notify(w1, 'T0694', 'T0694 完成（Renew #1）')
    await expect(badge1).toHaveText('✓', { timeout: 15_000 })
    await expect(badge1).toHaveAttribute('title', /Renew #1/)
    await expectReportedCount(win, view, 2)
    await turnEnd(w1)
    // memory only: what is saved is the report, nothing about the turn
    await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === w1)?.workerReport?.message, { timeout: 15_000 }).toBe('T0694 完成（Renew #1）')

    const debug = readDebugLogs(userData)
    expect(debug).toContain(`[turn] terminal=${w1} → started (hook user-prompt-submit)`)
    expect(debug).toContain(`[attention] terminal=${w1} → pendingQuestions=0 busy`)
    expect(debug).toContain(`[attention] terminal=${w1} → none`)
    expect(debug).toContain(`[T0538] Worker reported: tower=${TOWER} workorder=T0694 tabs=${w1}`)
    expect(debug).not.toContain('T0695 still printing') // output never reaches the log
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
