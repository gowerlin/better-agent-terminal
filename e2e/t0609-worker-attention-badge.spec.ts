// T0609 (BUG-153): a Worker tab's badge says whether it waits for the user (⚠️, claude hook
// `blocked`), waits for its Tower's answer (?, the old CT `T#### 提問` notify), or reported (✓);
// the Tower's "Close reported Worker tabs (N)" counts only ✓.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The Worker
// agent is a custom CLI running a node script that stays up and runs helper jobs the test drops
// into a temp dir — `bat-notify.mjs` / `bat-hook.mjs` from INSIDE the Worker PTY, with the PTY's own
// capability (the token never leaves the PTY). Nothing starts an LLM. Helper logs go to a temp dir.
//
//   1. Tower dispatches T0611 / T0612; T0611 notifies `完成` → ✓, N = 1
//   2. T0612 notifies `T0612 提問` → ?, tooltip "asked at HH:MM", N stays 1, saved as workerQuestion
//   3. T0611's hook ask-user-question → ⚠️ (reason question), N = 0; hook stop → ✓ again, N = 1
//   4. T0612 notifies `完成` → ✓, N = 2; the batch close confirm lists both
//
// The structured tower question (`--ask`, T0608) is not covered here (not merged yet); its push is
// covered by electron/remote/__tests__/headless-attention-e2e.test.ts and electron/__tests__/terminal-attention.test.ts.

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0609')
const WS = 'e2e-t0609-ws'
const TOWER = 'e2e-t0609-tower'
const WORKER_AGENT = 'e2e-t0609-worker'

/** Runs `<jobs>/<terminal id>-<n>.json` helper jobs in order; writes `<n>.res.json`. */
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
process.stdout.write('t0609 worker ready\\n')
setInterval(() => {
  const file = path.join(jobs, id + '-' + n + '.json')
  if (busy || !fs.existsSync(file)) return
  busy = true
  const job = JSON.parse(fs.readFileSync(file, 'utf8'))
  const child = spawn(process.execPath, [path.join(scripts, job.script), ...job.args.map(fill)], { env: process.env, windowsHide: true })
  let stdout = '', stderr = ''
  child.stdout.on('data', d => { stdout += d })
  child.stderr.on('data', d => { stderr += d })
  child.on('close', code => {
    fs.writeFileSync(file + '.tmp', JSON.stringify({ code, stdout, stderr }))
    fs.renameSync(file + '.tmp', path.join(jobs, id + '-' + n + '.res.json'))
    n++
    busy = false
  })
  child.stdin.end(job.stdin || '')
}, 100)
`

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }
interface SavedTerminal { id: string; workerReport?: { message: string }; workerQuestion?: { message: string; askedAt: number } }

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

/** Env for helpers the test runs itself (the dispatch): the server token, as t0538. */
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

test('Worker badges: ⚠️ waits for the user, ? waits for the Tower, ✓ reported; only ✓ is batch-closed', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0609-'))
  const folder = path.join(tmp, 'ws')
  const jobsDir = path.join(tmp, 'jobs')
  fs.mkdirSync(folder, { recursive: true })
  fs.mkdirSync(jobsDir, { recursive: true })
  const script = path.join(tmp, 'worker.mjs').split(path.sep).join('/')
  fs.writeFileSync(script, workerScript(jobsDir, path.join(REPO_ROOT, 'scripts')))
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0609', log)
    const { app, win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0609 worker', icon: 'W', color: '#888888', command: 'node', args: [script],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0609', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
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
    /** Runs a helper inside Worker `id`'s PTY (its own capability) and waits for it. */
    const inWorker = async (id: string, job: { script: string; args: string[]; stdin?: string }) => {
      const n = jobCount.get(id) ?? 0
      jobCount.set(id, n + 1)
      fs.writeFileSync(path.join(jobsDir, `${id}-${n}.json`), JSON.stringify(job))
      const res = path.join(jobsDir, `${id}-${n}.res.json`)
      await expect.poll(() => fs.existsSync(res), { timeout: 30_000 }).toBe(true)
      const out = JSON.parse(fs.readFileSync(res, 'utf8')) as HelperRun
      log(`in ${id}: ${job.script} ${job.args.join(' ')} → exit=${out.code}\n${out.stdout}${out.stderr}`)
      expect(out.code, out.stderr).toBe(0)
      return out
    }
    const notify = (id: string, workorder: string, message: string) =>
      inWorker(id, { script: 'bat-notify.mjs', args: ['--source', workorder, '--target', '{env:BAT_TOWER_TERMINAL_ID}', '--no-pty-write', message] })
    const hook = (id: string, event: string, input: Record<string, string>) =>
      inWorker(id, { script: 'bat-hook.mjs', args: [event], stdin: JSON.stringify(input) })

    const w1 = await dispatch('T0611')
    const w2 = await dispatch('T0612')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(3, { timeout: 20_000 })
    await expectReportedCount(win, view, 0)

    // ── 1. T0611 reports → ✓ ──
    await notify(w1, 'T0611', 'T0611 完成')
    await expect(workerThumb(view, 'T0611').locator('.worker-badge.reported')).toHaveText('✓', { timeout: 15_000 })
    await expectReportedCount(win, view, 1)

    // ── 2. T0612 asks its Tower (old CT) → ?, not counted ──
    await notify(w2, 'T0612', 'T0612 提問')
    const asked = workerThumb(view, 'T0612').locator('.worker-badge')
    await expect(asked).toHaveText('?', { timeout: 15_000 })
    await expect(asked).toHaveClass(/\bquestion\b/)
    await expect(asked).toHaveAttribute('data-attention', 'question')
    await expect(asked).toHaveAttribute('title', /\d{1,2}:\d{2}/)
    await expectReportedCount(win, view, 1)
    await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === w2)?.workerQuestion?.message, { timeout: 15_000 }).toBe('T0612 提問')
    expect((await savedTerminals(win)).find(t => t.id === w2)?.workerReport).toBeUndefined()
    await win.screenshot({ path: test.info().outputPath('question-badge.png') })

    // ── 3. T0611's claude would ask the user (hook) → ⚠️, then the turn ends → ✓ ──
    await hook(w1, 'ask-user-question', { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' })
    const blocked = workerThumb(view, 'T0611').locator('.worker-badge')
    await expect(blocked).toHaveText('⚠️', { timeout: 15_000 })
    await expect(blocked).toHaveClass(/\bblocked\b/)
    await expect(blocked).toHaveAttribute('data-blocked-reason', 'question')
    await expectReportedCount(win, view, 0)
    await win.screenshot({ path: test.info().outputPath('blocked-and-question-badges.png') })
    await hook(w1, 'stop', { hook_event_name: 'Stop' })
    await expect(workerThumb(view, 'T0611').locator('.worker-badge.reported')).toHaveText('✓', { timeout: 15_000 })
    await expectReportedCount(win, view, 1)

    // ── 4. T0612 reports after the answer → ✓; both are listed ──
    await notify(w2, 'T0612', 'T0612 完成')
    await expect(workerThumb(view, 'T0612').locator('.worker-badge.reported')).toHaveText('✓', { timeout: 15_000 })
    await expectReportedCount(win, view, 2)
    await view.locator('.thumbnail', { hasText: 'Tower' }).first().click({ button: 'right' })
    await win.locator('.context-menu [data-action="close-reported-workers"]').click()
    const dialog = win.locator('.worker-batch-close-dialog')
    await expect(dialog.locator('.worker-batch-close-list li .worker-badge')).toHaveText(['T0611', 'T0612'])
    await win.screenshot({ path: test.info().outputPath('batch-close-confirm.png') })
    await dialog.locator('[data-action="confirm-batch-close"]').click()
    await expect(dialog).toHaveCount(0)
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 15_000 })

    const debug = readDebugLogs(userData)
    expect(debug).toContain(`[T0538] Worker reported: tower=${TOWER} workorder=T0611 tabs=${w1}`)
    expect(debug).toContain(`[T0609] Worker asked its Tower: tower=${TOWER} workorder=T0612 tabs=${w2}`)
    expect(debug).toContain(`[attention] terminal=${w1} → blocked reason=question pendingQuestions=0`)
    expect(debug).toContain(`[attention] terminal=${w1} → none`)
    expect(debug).toContain(`[T0538] closing reported Workers of tower=${TOWER}: ${w1},${w2}`)
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
