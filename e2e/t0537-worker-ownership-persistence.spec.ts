// PLAN-041 / T0537: `--close-worker` still closes a Worker after BAT reopens — main finds it by the
// Tower id and work order saved with the tab (electron/worker-ownership.ts).
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The Worker
// agent is a custom CLI that runs a node script printing one line and exiting — nothing starts
// an LLM. The helper talks only to the isolated instance's RemoteServer; its log goes to a temp dir.
//
//   1. Tower A (workspace A, active) dispatches T0537, Tower B (workspace B) dispatches T0538;
//      both Worker tabs are saved with towerTerminalId / workorder
//   2. close the instance (Terminal Server stopped too) and relaunch it: the Worker tabs come back
//      as plain shells, whose PTYs this main process recorded nothing for
//   3. Tower B asks for T0537 → NOT_OWNER; Tower A closes T0537 → the tab and its saved entry go
//   4. workspace B (not opened since the relaunch: no PTY yet) → NOT_FOUND; detached → its Worker
//      PTY runs, Tower B closes T0538 there

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0537')
const WS_A = 'e2e-t0537-ws-a'
const WS_B = 'e2e-t0537-ws-b'
const TOWER_A = 'e2e-t0537-tower-a'
const TOWER_B = 'e2e-t0537-tower-b'
const WORKER_AGENT = 'e2e-t0537-worker'

const WORKER_SCRIPT = [
  "process.stdout.write('t0537 worker ran: ' + process.argv.slice(2).join(' ') + '\\n')",
  '',
].join('\n')

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }
interface SavedTerminal { id: string; workspaceId?: string; towerTerminalId?: string; workorder?: string }

function runHelper(env: NodeJS.ProcessEnv, args: string[], cwd: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(REPO_ROOT, 'scripts', 'bat-terminal.mjs'), ...args], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
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

test('--close-worker closes a Worker dispatched before BAT reopened, in main and detached windows', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0537-'))
  const folderA = path.join(tmp, 'a')
  const folderB = path.join(tmp, 'b')
  fs.mkdirSync(folderA, { recursive: true })
  fs.mkdirSync(folderB, { recursive: true })
  const workerScript = path.join(tmp, 'worker.mjs').split(path.sep).join('/')
  fs.writeFileSync(workerScript, WORKER_SCRIPT)
  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0537', log)
    const { app, win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0537 worker', icon: 'W', color: '#888888', command: 'node', args: [workerScript],
    })).toBeTruthy()
    const seed = {
      workspaces: [
        { id: WS_A, name: 'T0537-A', folderPath: folderA, createdAt: Date.now(), defaultAgent: WORKER_AGENT },
        { id: WS_B, name: 'T0537-B', folderPath: folderB, createdAt: Date.now(), defaultAgent: WORKER_AGENT },
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
    await expect(win.locator('.workspace-item', { hasText: 'T0537-B' })).toBeVisible({ timeout: 30_000 })
    const viewA = win.locator('.workspace-container.active')
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })

    const env = await helperEnv(app, userData, inst.remotePort, tmp)
    const dispatch = async (tower: string, workspace: string, workorder: string, cwd: string) => {
      const run = await runHelper(env, ['--notify-id', tower, '--workspace', workspace, '--skill', 'ct-exec', '--workorder', workorder], cwd)
      log(`dispatch ${workorder} from ${tower}: exit=${run.code}\n${run.stdout}${run.stderr}`)
      expect(run.code, run.stderr).toBe(0)
      expect(run.terminalId).toBeTruthy()
      // saved with the tab: the ownership main falls back to after the relaunch
      await expect.poll(async () => (await savedTerminals(win)).find(t => t.id === run.terminalId), { timeout: 20_000 })
        .toMatchObject({ workspaceId: workspace, towerTerminalId: tower, workorder })
      return run.terminalId!
    }

    // ── 1. dispatch before the relaunch ──
    const workerA = await dispatch(TOWER_A, WS_A, 'T0537', folderA)
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 20_000 })
    await expect(viewA).toContainText('t0537 worker ran: /ct-exec T0537', { timeout: 30_000 })
    const workerB = await dispatch(TOWER_B, WS_B, 'T0538', folderB)

    // ── 2. close (Terminal Server stopped too) and relaunch ──
    const { runtimeId } = inst
    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined
    relaunched = await launchIsolated('t0537', log, { runtimeId })
    const { app: app2, win: win2, userData: userData2 } = relaunched
    await expect.poll(async () => (await savedTerminals(win2)).map(t => t.id), { timeout: 30_000 })
      .toEqual(expect.arrayContaining([TOWER_A, TOWER_B, workerA, workerB]))
    const viewA2 = win2.locator('.workspace-container.active')
    await expect(viewA2.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })

    const env2 = await helperEnv(app2, userData2, relaunched.remotePort, tmp)
    const closeWorker = (tower: string, workorder: string) =>
      runHelper(env2, ['--close-worker', workorder, '--notify-id', tower], tmp)
    /** Retries while the Worker is BUSY (its restored shell printed in the last 5 s) or its PTY is not up yet. */
    const closeWhenIdle = async (tower: string, workorder: string): Promise<HelperRun> => {
      const deadline = Date.now() + 60_000
      for (;;) {
        const run = await closeWorker(tower, workorder)
        if ((run.code !== 6 && run.code !== 3) || Date.now() > deadline) return run
        await new Promise(r => setTimeout(r, 1_000))
      }
    }

    // ── 3. Tower A's Worker, in the main window ──
    const notOwner = await closeWorker(TOWER_B, 'T0537')
    log(`not owner: exit=${notOwner.code}\n${notOwner.stdout}${notOwner.stderr}`)
    expect(notOwner.code, notOwner.stderr).toBe(4)
    expect(notOwner.stderr).toContain('close-worker: NOT_OWNER')
    const closedA = await closeWhenIdle(TOWER_A, 'T0537')
    log(`close A: exit=${closedA.code}\n${closedA.stdout}${closedA.stderr}`)
    expect(closedA.code, closedA.stderr).toBe(0)
    expect(closedA.stdout).toContain(`✓ Worker close scheduled: ${workerA} (in 0 ms)`)
    await expect(viewA2.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 15_000 })
    await expect.poll(async () => (await savedTerminals(win2)).map(t => t.id), { timeout: 15_000 }).not.toContain(workerA)
    await win2.screenshot({ path: test.info().outputPath('after-relaunch-close-worker.png') })

    // ── 4. Tower B's Worker: workspace B has no PTYs until it is opened; detached → closes there ──
    const notOpened = await closeWorker(TOWER_B, 'T0538')
    expect(notOpened.code, notOpened.stderr).toBe(3)
    const detachedPromise = app2.waitForEvent('window', { timeout: 30_000 })
    expect(await win2.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_B)).toBe(true)
    const detached = await detachedPromise
    await detached.waitForLoadState('domcontentloaded')
    const viewB = detached.locator('.workspace-container.active')
    await expect(viewB.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    const closedB = await closeWhenIdle(TOWER_B, 'T0538')
    log(`close B (detached): exit=${closedB.code}\n${closedB.stdout}${closedB.stderr}`)
    expect(closedB.code, closedB.stderr).toBe(0)
    await expect(viewB.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 15_000 })
    // the detached window saved its list into the parent entry (T0491)
    await expect.poll(async () => (await savedTerminals(win2)).map(t => t.id), { timeout: 15_000 }).not.toContain(workerB)
    expect((await savedTerminals(win2)).map(t => t.id)).toContain(TOWER_B)
    await detached.screenshot({ path: test.info().outputPath('detached-after-relaunch-close-worker.png') })

    const debug = readDebugLogs(userData2)
    expect(debug).toContain(`[close-worker] id=${workerA} workorder=T0537: ownership from the saved tab (tower=${TOWER_A})`)
    expect(debug).toContain(`[close-worker] tower=${TOWER_A} workorder=T0537 id=${workerA} → close requested`)
    expect(debug).toContain(`[close-worker] id=${workerB} workorder=T0538: ownership from the saved tab (tower=${TOWER_B})`)
    expect(debug).toContain(`[close-worker] closing tab id=${workerB} workspace=${WS_B} (detached window)`)
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
