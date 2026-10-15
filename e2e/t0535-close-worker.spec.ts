// PLAN-041 / T0535: a Tower closes the Worker tab it dispatched — `bat-terminal.mjs --close-worker`.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The Worker
// agent is a custom CLI that runs a node script printing one line and exiting — nothing starts
// an LLM. The helper talks only to the isolated instance's RemoteServer; its log goes to a temp dir.
//
// Workspaces A (Tower A, active) and B (Tower B, detached later), both defaulting to the Worker CLI.
//   1. NOT_FOUND (unknown work order) / NOT_OWNER (Tower B asks for Tower A's Worker)
//   2. delayed close + typing into the Worker during the delay → cancelled, tab stays
//   3. close (delay 0) while the Worker is still printing → exit 0 (T0545: no BUSY), the tab stays
//      until the Worker has been quiet for 5 s, then goes from the window and the registry
//   4. AMBIGUOUS: two Workers of Tower A for one work order
//   5. a Worker in a detached window closes there; the parent entry no longer holds it
//   6. relaunch the runtime: the closed Workers are not restored

import { test, expect, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0535')
const WS_A = 'e2e-t0535-ws-a'
const WS_B = 'e2e-t0535-ws-b'
const TOWER_A = 'e2e-t0535-tower-a'
const TOWER_B = 'e2e-t0535-tower-b'
const WORKER_AGENT = 'e2e-t0535-worker'

const WORKER_SCRIPT = [
  "process.stdout.write('t0535 worker ran: ' + process.argv.slice(2).join(' ') + '\\n')",
  '',
].join('\n')

// T0545: an agent still printing its wrap-up — a line every 300 ms for argv[2] ms, then a marker.
const PRINT_DONE = 'T0545-PRINTER-FINISHED'
const PRINTER_SCRIPT = [
  'const end = Date.now() + Number(process.argv[2])',
  'const timer = setInterval(() => {',
  "  process.stdout.write('t0545 still printing\\n')",
  `  if (Date.now() >= end) { clearInterval(timer); process.stdout.write('${PRINT_DONE}\\n') }`,
  '}, 300)',
  '',
].join('\n')

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }

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

async function registryTerminalIds(win: Page): Promise<string[]> {
  const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? (JSON.parse(raw) as { terminals: { id: string }[] }).terminals.map(t => t.id) : []
}

test('--close-worker closes the Tower\'s own idle Worker tab like ✕, in main and detached windows', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0535-'))
  const folderA = path.join(tmp, 'a')
  const folderB = path.join(tmp, 'b')
  fs.mkdirSync(folderA, { recursive: true })
  fs.mkdirSync(folderB, { recursive: true })
  const workerScript = path.join(tmp, 'worker.mjs').split(path.sep).join('/')
  fs.writeFileSync(workerScript, WORKER_SCRIPT)
  const printerScript = path.join(tmp, 'printer.cjs').split(path.sep).join('/')
  fs.writeFileSync(printerScript, PRINTER_SCRIPT)
  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0535', log)
    const { app, win, userData, remotePort } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0535 worker', icon: 'W', color: '#888888', command: 'node', args: [workerScript],
    })).toBeTruthy()
    const seed = {
      workspaces: [
        { id: WS_A, name: 'T0535-A', folderPath: folderA, createdAt: Date.now(), defaultAgent: WORKER_AGENT },
        { id: WS_B, name: 'T0535-B', folderPath: folderB, createdAt: Date.now(), defaultAgent: WORKER_AGENT },
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
    await expect(win.locator('.workspace-item', { hasText: 'T0535-B' })).toBeVisible({ timeout: 30_000 })
    const viewA = win.locator('.workspace-container.active')
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })

    await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
    const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
    const token: string = record.encrypted
      ? await app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(Buffer.from(data, 'base64')), record.data as string)
      : record.data
    const env: NodeJS.ProcessEnv = {}
    for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) env[k] = v
    Object.assign(env, {
      BAT_REMOTE_PORT: String(remotePort),
      BAT_REMOTE_TOKEN: token,
      BAT_SERVER_CERT_PATH: path.join(userData, 'server-cert.json'),
      BAT_HELPER_LOG_DIR: path.join(tmp, 'helper-logs'),
      BAT_USER_DATA: tmp,
    })

    const dispatch = async (tower: string, workspace: string, workorder: string, cwd: string) => {
      const run = await runHelper(env, ['--notify-id', tower, '--workspace', workspace, '--skill', 'ct-exec', '--workorder', workorder], cwd)
      log(`dispatch ${workorder} from ${tower}: exit=${run.code}\n${run.stdout}${run.stderr}`)
      expect(run.code, run.stderr).toBe(0)
      expect(run.terminalId).toBeTruthy()
      await expect.poll(() => registryTerminalIds(win), { timeout: 20_000 }).toContain(run.terminalId)
      return run.terminalId!
    }
    const closeWorker = (tower: string, workorder: string, extra: string[] = []) =>
      runHelper(env, ['--close-worker', workorder, '--notify-id', tower, ...extra], tmp)
    // T0545 / D145: no retry loop — a Worker that printed recently is not refused (no BUSY);
    // BAT waits for it to go quiet before closing.

    // ── Tower A dispatches T0535 ──
    const worker = await dispatch(TOWER_A, WS_A, 'T0535', folderA)
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 20_000 })
    await expect(viewA).toContainText('t0535 worker ran: /ct-exec T0535', { timeout: 30_000 })

    // 1) NOT_FOUND / NOT_OWNER
    const notFound = await closeWorker(TOWER_A, 'T9999')
    expect(notFound.code, notFound.stderr).toBe(3)
    expect(notFound.stderr).toContain('close-worker: NOT_FOUND')
    const notOwner = await closeWorker(TOWER_B, 'T0535')
    expect(notOwner.code, notOwner.stderr).toBe(4)
    expect(notOwner.stderr).toContain('close-worker: NOT_OWNER')

    // 2) delayed close, the user types into the Worker during the delay → cancelled
    const delayed = await closeWorker(TOWER_A, 'T0535', ['--delay-ms', '4000'])
    log(`delayed close: exit=${delayed.code}\n${delayed.stdout}${delayed.stderr}`)
    expect(delayed.code, delayed.stderr).toBe(0)
    expect(delayed.stdout).toContain(`✓ Worker close scheduled: ${worker} (in 4000 ms)`)
    await win.evaluate(async (id) => (window as AnyApi).electronAPI.pty.write(id, 'x'), worker)
    await new Promise(r => setTimeout(r, 6_000))
    expect(await registryTerminalIds(win)).toContain(worker)
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(2)
    expect(readDebugLogs(userData)).toContain(`[close-worker] tower=${TOWER_A} workorder=T0535 id=${worker} → cancelled (user input during the delay)`)
    await win.evaluate(async (id) => (window as AnyApi).electronAPI.pty.write(id, '\x7f'), worker) // erase the typed x

    // 3) T0545: close (delay 0) while the Worker is still printing → exit 0, waits for quiet,
    //    then the tab goes and the registry drops it
    await new Promise(r => setTimeout(r, 1_000))
    await win.evaluate(async ({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: worker, line: `node "${printerScript}" 6000\r` })
    await expect(viewA).toContainText('t0545 still printing', { timeout: 15_000 })
    const closed = await closeWorker(TOWER_A, 'T0535')
    log(`close: exit=${closed.code}\n${closed.stdout}${closed.stderr}`)
    expect(closed.code, closed.stderr).toBe(0)
    expect(closed.stdout).toContain(`✓ Worker close scheduled: ${worker} (in 0 ms)`)
    expect(closed.stdout).toContain('BAT waits until it is quiet (at most 60 s more)')
    await expect.poll(() => readDebugLogs(userData), { timeout: 10_000 })
      .toContain(`[close-worker] tower=${TOWER_A} workorder=T0535 id=${worker} → still printing (output `)
    expect(readDebugLogs(userData)).toMatch(new RegExp(`id=${worker} → scheduled delayMs=0 \\(output \\d+ ms ago; will wait for quiet\\)`))
    // still open while it prints
    await expect(viewA).toContainText(PRINT_DONE, { timeout: 20_000 })
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(2)
    await expect(viewA.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 20_000 })
    expect(readDebugLogs(userData)).toMatch(new RegExp(`id=${worker} → close requested after waiting \\d+\\.\\d s for quiet`))
    await expect.poll(() => registryTerminalIds(win), { timeout: 15_000 }).not.toContain(worker)
    // the PTY is gone too → asking again finds nothing
    await expect.poll(async () => (await closeWorker(TOWER_A, 'T0535')).code, { timeout: 15_000 }).toBe(3)
    await win.screenshot({ path: test.info().outputPath('after-close-worker.png') })

    // 4) AMBIGUOUS: two Workers of Tower A for one work order
    const twinA = await dispatch(TOWER_A, WS_A, 'T0536', folderA)
    const twinB = await dispatch(TOWER_A, WS_A, 'T0536', folderA)
    const ambiguous = await closeWorker(TOWER_A, 'T0536')
    expect(ambiguous.code, ambiguous.stderr).toBe(5)
    expect(ambiguous.stderr).toContain('close-worker: AMBIGUOUS')
    expect(ambiguous.stderr).toContain(twinA)
    expect(ambiguous.stderr).toContain(twinB)

    // 5) a Worker of Tower B, then B goes to a detached window → closed there
    const workerB = await dispatch(TOWER_B, WS_B, 'T0537', folderB)
    const detachedPromise = app.waitForEvent('window', { timeout: 30_000 })
    expect(await win.evaluate(async (id) => (window as AnyApi).electronAPI.workspace.detach(id), WS_B)).toBe(true)
    const detached = await detachedPromise
    await detached.waitForLoadState('domcontentloaded')
    const viewB = detached.locator('.workspace-container.active')
    await expect(viewB.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    const closedB = await closeWorker(TOWER_B, 'T0537')
    log(`detached close: exit=${closedB.code}\n${closedB.stdout}${closedB.stderr}`)
    expect(closedB.code, closedB.stderr).toBe(0)
    await expect(viewB.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    // the detached window saved its list into the parent entry (T0491)
    await expect.poll(() => registryTerminalIds(win), { timeout: 15_000 }).not.toContain(workerB)
    expect(await registryTerminalIds(win)).toContain(TOWER_B)
    await detached.screenshot({ path: test.info().outputPath('detached-after-close-worker.png') })

    const debug = readDebugLogs(userData)
    expect(debug).toContain(`[close-worker] tower=${TOWER_A} workorder=T0535 id=${worker} → close requested`)
    expect(debug).toContain(`[close-worker] tower=${TOWER_B} workorder=T0537 id=${workerB} → close requested`)
    expect(debug).toContain(`[close-worker] closing tab id=${workerB} workspace=${WS_B} (detached window)`)
    const helperLog = path.join(tmp, 'helper-logs', 'bat-scripts.log')
    const events = fs.readFileSync(helperLog, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as { event: string; result?: string })
    expect(events.filter(e => e.event === 'close-worker').map(e => e.result)).toEqual(expect.arrayContaining(['NOT_FOUND', 'NOT_OWNER', 'OK', 'AMBIGUOUS']))

    // 6) relaunch: the closed Workers are not restored
    const closeDetached = detached.waitForEvent('close', { timeout: 15_000 })
    await detached.close()
    await closeDetached
    const { runtimeId } = inst
    await closeIsolated(inst, log, { keepUserData: true })
    inst = undefined
    relaunched = await launchIsolated('t0535', log, { runtimeId })
    const win2 = relaunched.win
    await expect.poll(async () => (await registryTerminalIds(win2)).length, { timeout: 30_000 }).toBeGreaterThan(0)
    const restored = await registryTerminalIds(win2)
    log(`after relaunch: ${restored.join(', ')}`)
    expect(restored).toEqual(expect.arrayContaining([TOWER_A, TOWER_B, twinA, twinB]))
    expect(restored).not.toContain(worker)
    expect(restored).not.toContain(workerB)
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
