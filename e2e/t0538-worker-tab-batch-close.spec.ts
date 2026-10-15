// PLAN-041 / T0538: Worker tabs show their work order, a Worker's report (`bat-notify --source
// "T####"` to its Tower) marks the tab reported, and the Tower's "Close reported Worker tabs (N)"
// closes only those — after an in-page confirm listing them. Main window and detached window.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The Worker
// agent is a custom CLI that runs a node script printing one line and exiting — nothing starts
// an LLM. The helpers talk only to the isolated instance's RemoteServer; their logs go to a temp dir.
//
//   1. Tower A (workspace A, active) dispatches T0601 and T0602; T0601 reports → ✓ T0601 only
//   2. Tower A's menu lists (1); the confirm lists T0601 only; confirming closes it, T0602 stays
//   3. Tower B (workspace B) dispatches T0603 / T0604, workspace B is detached, T0604 reports →
//      the detached window shows ✓ T0604 and closes it the same way, T0603 stays

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0538')
const WS_A = 'e2e-t0538-ws-a'
const WS_B = 'e2e-t0538-ws-b'
const TOWER_A = 'e2e-t0538-tower-a'
const TOWER_B = 'e2e-t0538-tower-b'
const WORKER_AGENT = 'e2e-t0538-worker'

const WORKER_SCRIPT = [
  "process.stdout.write('t0538 worker ran: ' + process.argv.slice(2).join(' ') + '\\n')",
  '',
].join('\n')

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }
interface SavedTerminal { id: string; workspaceId?: string; towerTerminalId?: string; workorder?: string; workerReport?: { message: string } }

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

/** Thumbnail of the tab whose work order badge reads `workorder` (with or without ✓). */
const workerThumb = (view: Locator, workorder: string) =>
  view.locator('.thumbnail', { has: view.page().locator(`.worker-badge[data-workorder="${workorder}"]`) })

/** The thumbnail context menu closes on any document click (TerminalThumbnail). */
async function closeMenu(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await expect(page.locator('.context-menu')).toHaveCount(0)
}

/**
 * Tower's "Close reported Worker tabs (N)" → the in-page confirm lists exactly `expected` → confirm.
 * The menu and the dialog render in `page` (the window that shows the Tower).
 */
async function batchCloseReported(page: Page, view: Locator, towerTitle: string, expected: string[]) {
  await view.locator('.thumbnail', { hasText: towerTitle }).click({ button: 'right' })
  const item = page.locator('.context-menu [data-action="close-reported-workers"]')
  // the UI language follows the OS locale — match the count, not the wording
  await expect(item).toHaveText(new RegExp(`[(（]${expected.length}[)）]$`))
  await expect(item).toBeEnabled()
  await item.click()
  const dialog = page.locator('.worker-batch-close-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.worker-batch-close-list li .worker-badge')).toHaveText(expected)
  await page.screenshot({ path: test.info().outputPath(`batch-close-confirm-${towerTitle.replace(/\W+/g, '-')}.png`) })
  await expect(dialog.locator('[data-action="confirm-batch-close"]')).toContainText(String(expected.length))
  await dialog.locator('[data-action="confirm-batch-close"]').click()
  await expect(dialog).toHaveCount(0)
}

test('reported Worker tabs are marked and batch-closed from the Tower, in main and detached windows', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0538-'))
  const folderA = path.join(tmp, 'a')
  const folderB = path.join(tmp, 'b')
  fs.mkdirSync(folderA, { recursive: true })
  fs.mkdirSync(folderB, { recursive: true })
  const workerScript = path.join(tmp, 'worker.mjs').split(path.sep).join('/')
  fs.writeFileSync(workerScript, WORKER_SCRIPT)
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0538', log)
    const { app, win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0538 worker', icon: 'W', color: '#888888', command: 'node', args: [workerScript],
    })).toBeTruthy()
    const seed = {
      workspaces: [
        { id: WS_A, name: 'T0538-A', folderPath: folderA, createdAt: Date.now(), defaultAgent: WORKER_AGENT },
        { id: WS_B, name: 'T0538-B', folderPath: folderB, createdAt: Date.now(), defaultAgent: WORKER_AGENT },
      ],
      activeWorkspaceId: WS_A,
      activeGroup: null,
      terminals: [
        { id: TOWER_A, workspaceId: WS_A, type: 'terminal', title: 'Tower A', cwd: folderA },
        { id: TOWER_B, workspaceId: WS_B, type: 'terminal', title: 'Tower B', cwd: folderB },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-item', { hasText: 'T0538-B' })).toBeVisible({ timeout: 30_000 })
    const viewA = win.locator('.workspace-container.active')
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })

    const env = await helperEnv(app, userData, inst.remotePort, tmp)
    const dispatch = async (tower: string, workspace: string, workorder: string, cwd: string) => {
      const run = await runHelper('bat-terminal.mjs', env, ['--notify-id', tower, '--workspace', workspace, '--skill', 'ct-exec', '--workorder', workorder], cwd)
      log(`dispatch ${workorder} from ${tower}: exit=${run.code}\n${run.stdout}${run.stderr}`)
      expect(run.code, run.stderr).toBe(0)
      expect(run.terminalId).toBeTruthy()
      await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === run.terminalId), { timeout: 20_000 })
        .toMatchObject({ workspaceId: workspace, towerTerminalId: tower, workorder })
      return run.terminalId!
    }
    const report = async (tower: string, workorder: string) => {
      const run = await runHelper('bat-notify.mjs', env, ['--source', workorder, '--target', tower, '--no-pty-write', `${workorder} 完成`], tmp)
      log(`notify ${workorder} → ${tower}: exit=${run.code}\n${run.stdout}${run.stderr}`)
      expect(run.code, run.stderr).toBe(0)
    }

    // ── 1. main window: two Workers, one reports ──
    const w1 = await dispatch(TOWER_A, WS_A, 'T0601', folderA)
    const w2 = await dispatch(TOWER_A, WS_A, 'T0602', folderA)
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(3, { timeout: 20_000 })
    await expect(workerThumb(viewA, 'T0601').locator('.worker-badge')).toHaveText('T0601')
    await expect(workerThumb(viewA, 'T0602').locator('.worker-badge')).toHaveText('T0602')
    // before any report: N = 0, disabled
    await viewA.locator('.thumbnail', { hasText: 'Tower A' }).click({ button: 'right' })
    await expect(win.locator('.context-menu [data-action="close-reported-workers"]')).toBeDisabled()
    await closeMenu(win)

    await report(TOWER_A, 'T0601')
    await expect(workerThumb(viewA, 'T0601').locator('.worker-badge.reported')).toHaveText('✓ T0601', { timeout: 15_000 })
    await expect(workerThumb(viewA, 'T0602').locator('.worker-badge')).not.toHaveClass(/reported/)
    await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === w1)?.workerReport?.message, { timeout: 15_000 }).toBe('T0601 完成')
    // the Worker's own menu offers "Close this Worker"
    await workerThumb(viewA, 'T0602').click({ button: 'right' })
    await expect(win.locator('.context-menu [data-action="close-worker"]')).toBeVisible()
    await closeMenu(win)
    await win.screenshot({ path: test.info().outputPath('main-reported-badge.png') })

    // ── 2. batch close from Tower A ──
    await batchCloseReported(win, viewA, 'Tower A', ['T0601'])
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 15_000 })
    await expect(workerThumb(viewA, 'T0601')).toHaveCount(0)
    await expect(workerThumb(viewA, 'T0602')).toHaveCount(1)
    await expect.poll(async () => (await savedTerminals(win)).map(t => t.id), { timeout: 15_000 }).not.toContain(w1)
    expect((await savedTerminals(win)).map(t => t.id)).toEqual(expect.arrayContaining([TOWER_A, w2]))

    // ── 3. detached window ──
    const w3 = await dispatch(TOWER_B, WS_B, 'T0603', folderB)
    const w4 = await dispatch(TOWER_B, WS_B, 'T0604', folderB)
    const detachedPromise = app.waitForEvent('window', { timeout: 30_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_B)).toBe(true)
    const detached = await detachedPromise
    await detached.waitForLoadState('domcontentloaded')
    const viewB = detached.locator('.workspace-container.active')
    await expect(viewB.locator('.terminal-wrapper')).toHaveCount(3, { timeout: 30_000 })

    await report(TOWER_B, 'T0604')
    await expect(workerThumb(viewB, 'T0604').locator('.worker-badge.reported')).toHaveText('✓ T0604', { timeout: 15_000 })
    await expect(workerThumb(viewB, 'T0603').locator('.worker-badge')).not.toHaveClass(/reported/)
    await batchCloseReported(detached, viewB, 'Tower B', ['T0604'])
    await expect(viewB.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 15_000 })
    await expect(workerThumb(viewB, 'T0603')).toHaveCount(1)
    // the detached window saved its list into the parent entry (T0491)
    await expect.poll(async () => (await savedTerminals(win)).map(t => t.id), { timeout: 15_000 }).not.toContain(w4)
    expect((await savedTerminals(win)).map(t => t.id)).toEqual(expect.arrayContaining([TOWER_B, w3]))
    await detached.screenshot({ path: test.info().outputPath('detached-after-batch-close.png') })

    const debug = readDebugLogs(userData)
    expect(debug).toContain(`[T0538] Worker reported: tower=${TOWER_A} workorder=T0601 tabs=${w1}`)
    expect(debug).toContain(`[T0538] closing reported Workers of tower=${TOWER_A}: ${w1}`)
    expect(debug).toContain(`[T0538] closing reported Workers of tower=${TOWER_B}: ${w4}`)
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
