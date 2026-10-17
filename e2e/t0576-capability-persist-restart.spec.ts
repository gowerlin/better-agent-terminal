// PLAN-047 / T0576: a local tab's helper capability survives a BAT restart while the Terminal Server
// keeps the tab alive — the regression T0575 measured (`Authentication failed: Invalid token`) is gone.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Every helper
// runs INSIDE a tab of the isolated instance, with that tab's own env (BAT_REMOTE_TOKEN /
// BAT_TERMINAL_ID / BAT_TOWER_TERMINAL_ID / BAT_USER_DATA), through a node runner that records exit
// codes and output to a JSON file. The Worker agent is a custom CLI running the same runner —
// nothing starts an LLM.
//
//   1. the Tower dispatches a Worker (agent mode); both tabs hold `batcap.` tokens; the store
//      `helper-capabilities.json` has both ids and no token
//   2. quit WITHOUT stopping the Terminal Server (its PTYs and their env survive), relaunch the same
//      runtime, answer the Recovery prompt with "recover"
//   3. in the surviving tabs, with the env they had before the restart (only BAT_REMOTE_PORT is
//      pointed at the new instance — the isolated instances get a free port each launch, a real BAT
//      keeps 9876): Tower `--set-role` → 0, Worker `bat-notify --submit` → 0, Tower `--close-worker`
//      → 0 and the Worker tab closes; then the Worker's record is gone from the store
//   4. teardown stops the Terminal Server and removes the runtime userData (also when a step failed)

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0576')
const WS = 'e2e-t0576-ws'
const TOWER = 'e2e-t0576-tower'
const WORKER_AGENT = 'e2e-t0576-worker'
const STORE = 'helper-capabilities.json'

interface StepResult {
  kind: string
  script?: string
  args?: string[]
  code?: number | null
  stdout?: string
  stderr?: string
  terminalId?: string
  towerTerminalId?: string
  token?: string
  port?: string
}

/**
 * `node runner.cjs <spec.json>`: runs the spec's steps with this process's env and writes the
 * results to `spec.out` (temp file + rename). `spec.port` replaces BAT_REMOTE_PORT first (the
 * relaunched isolated instance listens elsewhere); nothing else of the tab's env is changed.
 *   - `{ kind: 'env' }`                    BAT_TERMINAL_ID / BAT_TOWER_TERMINAL_ID / token / port
 *   - `{ kind: 'helper', script, args }`   `node $BAT_HELPER_DIR/<script> ...args`
 */
const RUNNER = `
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const env = { ...process.env }
if (spec.port) env.BAT_REMOTE_PORT = String(spec.port)
const sub = s => String(s).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || '').replace(/\\$BAT_TOWER_TERMINAL_ID/g, env.BAT_TOWER_TERMINAL_ID || '')
const results = []
for (const step of spec.steps) {
  if (step.kind === 'env') {
    results.push({ kind: 'env', terminalId: env.BAT_TERMINAL_ID, towerTerminalId: env.BAT_TOWER_TERMINAL_ID, token: env.BAT_REMOTE_TOKEN, port: env.BAT_REMOTE_PORT })
  } else if (step.kind === 'helper') {
    const args = step.args.map(sub)
    const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...args], { env, encoding: 'utf8', timeout: 30000, windowsHide: true })
    results.push({ kind: 'helper', script: step.script, args, code: run.status, stdout: run.stdout, stderr: run.stderr })
  }
}
const out = sub(spec.out)
fs.writeFileSync(out + '.tmp', JSON.stringify(results, null, 2))
fs.renameSync(out + '.tmp', out)
`

function readResults(file: string): StepResult[] | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as StepResult[] : undefined
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

function storedIds(userData: string): string[] {
  const file = path.join(userData, STORE)
  if (!fs.existsSync(file)) return []
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { capabilities: { terminalId: string }[] }).capabilities.map(c => c.terminalId).sort()
}

async function registryTerminalIds(win: Page): Promise<string[]> {
  const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? (JSON.parse(raw) as { terminals: { id: string }[] }).terminals.map(t => t.id) : []
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Quits with "Quit" but WITHOUT "also stop Terminal Server"; the app process is gone afterwards. */
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
    // T0575 measurement: app.close() may not return although BAT finished quitting
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

/**
 * Dispatch → quit keeping the Terminal Server → relaunch → recover → helpers in the surviving tabs.
 * `control`: the store is deleted before the relaunch — the T0575 behaviour (nothing persisted):
 * the same helpers must fail with `Invalid token`, the regression this work order fixes.
 */
async function scenario(control: boolean): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0576-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)
  // The Worker records its env when it starts and then sits at its shell prompt.
  const workerSpec = slash(path.join(tmp, 'worker-spec.json'))
  fs.writeFileSync(workerSpec, JSON.stringify({ out: slash(path.join(tmp, 'worker-$BAT_TERMINAL_ID.json')), steps: [{ kind: 'env' }] }))

  let specSeq = 0
  /** Types `node runner.cjs <spec>` into tab `id`; resolves with the results it wrote. */
  const runInTab = async (win: Page, id: string, steps: unknown[], port?: number): Promise<StepResult[]> => {
    const n = specSeq++
    const out = slash(path.join(tmp, `tab-${n}.json`))
    const spec = slash(path.join(tmp, `tab-${n}-spec.json`))
    fs.writeFileSync(spec, JSON.stringify({ out, steps, port }))
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id, line: `node "${runner}" "${spec}"\r` })
    await expect.poll(() => readResults(out) !== undefined, { timeout: 60_000 }).toBe(true)
    const results = readResults(out)!
    log(`tab ${id} step ${n}: ${JSON.stringify(results.map(r => ({ ...r, token: r.token ? `${r.token.slice(0, 7)}…` : undefined }))).slice(0, 2000)}`)
    return results
  }

  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  let serverPid: number | null = null
  let quitUserData: { userData: string; runtimeId: string } | null = null
  try {
    inst = await launchIsolated(control ? 't0576-control' : 't0576', log)
    const { app, win, userData, runtimeId } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0576 worker', icon: 'W', color: '#888888', command: 'node', args: [runner, workerSpec],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0576', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const view = win.locator('.workspace-container.active')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(async () => win.evaluate((id) => (window as AnyApi).electronAPI.pty.getCwd(id), TOWER), { timeout: 30_000 }).not.toBeNull()
    await win.waitForTimeout(2_000)

    // ── 1. dispatch a Worker before the restart ──
    const [towerEnv, dispatch] = await runInTab(win, TOWER, [
      { kind: 'env' },
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0576', '--mode', 'yolo'] },
    ])
    expect(towerEnv.token?.startsWith('batcap.')).toBe(true)
    expect(dispatch.code, dispatch.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(dispatch.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    const workerFile = path.join(tmp, `worker-${worker}.json`)
    await expect.poll(() => readResults(workerFile) !== undefined, { timeout: 60_000 }).toBe(true)
    const [workerEnv] = readResults(workerFile)!
    expect(workerEnv).toMatchObject({ terminalId: worker, towerTerminalId: TOWER })
    expect(workerEnv.token?.startsWith('batcap.')).toBe(true)
    await expect.poll(() => registryTerminalIds(win), { timeout: 20_000 }).toContain(worker)
    // the store has both tabs, and neither token
    await expect.poll(() => storedIds(userData), { timeout: 10_000 }).toEqual([TOWER, worker!].sort())
    const storeText = fs.readFileSync(path.join(userData, STORE), 'utf8')
    expect(storeText).not.toContain(towerEnv.token!)
    expect(storeText).not.toContain(workerEnv.token!)
    expect(storeText).not.toContain('batcap.')

    // ── 2. quit keeping the Terminal Server, relaunch, recover ──
    serverPid = readPid(userData)
    expect(serverPid).not.toBeNull()
    quitUserData = { userData, runtimeId }
    await quitKeepingTerminalServer(app)
    inst = undefined
    expect(isAlive(serverPid!)).toBe(true)
    // BAT quit without reporting the PTYs gone: both records are still there
    expect(storedIds(userData)).toEqual([TOWER, worker!].sort())
    const firstDebug = readDebugLogs(userData)
    expect(firstDebug).toContain('[quit] user confirmed quit (stopTerminalServer=false)')

    if (control) {
      fs.rmSync(path.join(userData, STORE))
      log('control: helper-capabilities.json deleted before the relaunch (T0575 behaviour)')
    }
    relaunched = await launchIsolated(control ? 't0576-control' : 't0576', log, { runtimeId })
    const { win: win2, userData: userData2, remotePort } = relaunched
    expect(userData2).toBe(userData)
    const prompt = win2.locator('.recovery-prompt-dialog')
    await expect(prompt).toBeVisible({ timeout: 30_000 })
    await win2.screenshot({ path: test.info().outputPath('recovery-prompt.png') })
    await prompt.locator('.recovery-prompt-actions .btn-primary').click()
    const view2 = win2.locator('.workspace-container.active')
    await expect(view2.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    await expect.poll(() => readDebugLogs(userData2), { timeout: 30_000 }).toContain('[PtyManager] replay: 2 active PTY(s) found on reconnect')
    const timeline = readDebugLogs(userData2).split('\n')
      .filter(l => /\[helper-cap\]|replay: \d+ active|pty:create |user chose recovery|Created terminal using|server spawned PTY/.test(l))
    log(`restart timeline:\n${timeline.join('\n')}`)

    if (control) {
      // ── T0575 behaviour: the surviving tabs' tokens are unknown to the new process ──
      const [, roleFail] = await runInTab(win2, TOWER, [
        { kind: 'env' },
        { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--agent', 'claude', '--mode', 'yolo'] },
      ], remotePort)
      expect(roleFail.code).toBe(1)
      expect(roleFail.stderr).toContain('Authentication failed: Invalid token')
      expect(roleFail.stderr).toContain('set-role: AUTH_FAILED')
      const [notifyFail] = await runInTab(win2, worker!, [
        { kind: 'helper', script: 'bat-notify.mjs', args: ['--source', 'T0576', '--target', '$BAT_TOWER_TERMINAL_ID', 'T0576 完成'] },
      ], remotePort)
      expect(notifyFail.code).toBe(1)
      expect(notifyFail.stderr).toContain('Authentication failed: Invalid token')
      return
    }
    await expect.poll(() => readDebugLogs(userData2), { timeout: 30_000 }).toContain(`[helper-cap] kept restored: terminal=${worker}`)
    const restartDebug = readDebugLogs(userData2)
    expect(restartDebug).toContain('[helper-cap] restored 2 capability record(s) from helper-capabilities.json')
    expect(restartDebug).toContain(`[helper-cap] kept restored: terminal=${TOWER}`)
    // the Terminal Server kept the very same PTYs (no fresh spawn)
    expect(readPid(userData2)).toBe(serverPid)

    // ── 3. helpers in the surviving tabs, with their pre-restart tokens ──
    const [towerEnv2, roleRun] = await runInTab(win2, TOWER, [
      { kind: 'env' },
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--agent', 'claude', '--mode', 'yolo'] },
    ], remotePort)
    expect(towerEnv2.token).toBe(towerEnv.token)
    expect(towerEnv2.port).toBe(String(remotePort))
    expect(roleRun.code, roleRun.stderr).toBe(0)
    expect(roleRun.stdout).toContain(`✓ Tower role set: ${TOWER}`)
    expect(roleRun.stderr).not.toContain('Invalid token')
    await expect(view2.locator('.thumbnail-title', { hasText: 'Claude CLI · Tower' })).toHaveCount(1, { timeout: 20_000 })

    const [workerEnv2, notifyRun] = await runInTab(win2, worker!, [
      { kind: 'env' },
      { kind: 'helper', script: 'bat-notify.mjs', args: ['--source', 'T0576', '--target', '$BAT_TOWER_TERMINAL_ID', '--submit', 'T0576 完成'] },
    ], remotePort)
    expect(workerEnv2.token).toBe(workerEnv.token)
    expect(notifyRun.code, notifyRun.stderr).toBe(0)
    expect(notifyRun.stderr).not.toContain('Invalid token')
    // the submit Enter ran the pre-filled line in the Tower; give the shell its prompt back
    await win2.waitForTimeout(1_500)

    const [closeRun] = await runInTab(win2, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--close-worker', 'T0576', '--notify-id', '$BAT_TERMINAL_ID'] },
    ], remotePort)
    expect(closeRun.code, closeRun.stderr).toBe(0)
    expect(closeRun.stdout).toContain(`✓ Worker close scheduled: ${worker} (in 0 ms)`)
    await expect(view2.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 40_000 })
    await expect.poll(() => registryTerminalIds(win2), { timeout: 40_000 }).not.toContain(worker)
    // the Worker ended: its record left the store; the Tower's stays
    await expect.poll(() => storedIds(userData2), { timeout: 20_000 }).toEqual([TOWER])
    await win2.screenshot({ path: test.info().outputPath('after-restart-close-worker.png') })

    const debug = readDebugLogs(userData2)
    expect(debug).toContain(`[set-role] id=${TOWER}`)
    expect(debug).toContain(`[helper-cap] revoked: terminal=${worker}`)
    for (const token of [towerEnv.token!, workerEnv.token!]) expect(debug).not.toContain(token)
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    await killLeftoverServer(serverPid)
    // quit kept the userData for the relaunch; when the relaunch did not happen, remove it here
    if (!relaunched && quitUserData && path.basename(quitUserData.userData).includes(`-runtime-${quitUserData.runtimeId}`)) {
      fs.rmSync(quitUserData.userData, { recursive: true, force: true })
      log(`runtime userData removed: ${!fs.existsSync(quitUserData.userData)}`)
    }
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

test('a tab\'s capability survives a BAT restart with the Terminal Server kept: set-role / close-worker / bat-notify', async () => {
  test.setTimeout(300_000)
  await scenario(false)
})

test('control: without the store (T0575 behaviour) the same helpers fail with Invalid token', async () => {
  test.setTimeout(300_000)
  await scenario(true)
})
