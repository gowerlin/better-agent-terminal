// T0580 / BUG-146 (follow-up to T0578): while the Recovery prompt is open (BAT reopened, Terminal
// Server kept alive with its PTYs), a Tower in a surviving tab can already dispatch (T0576 restored
// its capability). Before T0580 `terminal:create-with-command` spawned the Worker as a direct
// node-pty shell under BAT's main process; after the answer its input went to the Terminal Server,
// which did not know the id. Now the dispatch waits for the answer (at most
// HELPER_CREATE_HOLD_WAIT_MS = 2 s, below the helper's 3 s invoke timeout):
//
//   1. seed a Tower tab; it runs a watcher (node) that runs helper steps whenever the test drops a
//      `go-<n>.json` in the temp dir — the watcher lives in the server PTY, so it survives the quit
//      and the helpers run INSIDE the surviving tab with its own env (only BAT_REMOTE_PORT is
//      pointed at the relaunched instance, as in t0576)
//   2. quit WITHOUT stopping the Terminal Server → relaunch → the Recovery prompt opens
//   3. prompt unanswered: raw command dispatch → exit 1 `RECOVERY_PENDING` after ~2 s, no direct
//      shell, and the refused Worker is never created later
//   4. dispatch again, answer "recover" while it waits → exit 0; the Worker's shell is a Terminal
//      Server PTY (the Worker command's parent = the server PTY pid), no direct shell, and a command
//      typed into the Worker tab prints once
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only
// (process tree read with Get-CimInstance). Teardown stops the Terminal Server this test started
// (pid file + command line check) and removes the runtime userData, also when a step failed.

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
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

const log = testLogger('t0580')
const WS = 'e2e-t0580-ws'
const TOWER = 'e2e-t0580-tower'
const SHELL_NAMES = new Set(['pwsh.exe', 'powershell.exe', 'cmd.exe', 'bash.exe', 'sh.exe', 'wsl.exe'])
/** electron/terminal-command-handlers.ts HELPER_CREATE_HOLD_WAIT_MS */
const HOLD_WAIT_MS = 2_000

interface StepResult {
  kind: string
  args?: string[]
  code?: number | null
  stdout?: string
  stderr?: string
  terminalId?: string
  token?: string
  ms?: number
}

/**
 * `node watcher.cjs <dir>` (in the Tower tab): every `go-<n>.json` dropped in `dir` runs once —
 * `started-<n>` first, then its steps with this process's env (`spec.port` replaces
 * BAT_REMOTE_PORT), results to `result-<n>.json` (temp file + rename).
 *   - `{ kind: 'env' }`              BAT_TERMINAL_ID / token
 *   - `{ kind: 'helper', args }`     `node $BAT_HELPER_DIR/bat-terminal.mjs ...args`
 */
const WATCHER = `
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const dir = process.argv[2]
const done = new Set()
setInterval(() => {
  for (const f of fs.readdirSync(dir)) {
    const m = /^go-(\\d+)\\.json$/.exec(f)
    if (!m || done.has(f)) continue
    done.add(f)
    const spec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    const env = { ...process.env }
    if (spec.port) env.BAT_REMOTE_PORT = String(spec.port)
    fs.writeFileSync(path.join(dir, 'started-' + m[1]), String(Date.now()))
    const results = []
    for (const step of spec.steps) {
      if (step.kind === 'env') {
        results.push({ kind: 'env', terminalId: env.BAT_TERMINAL_ID, token: env.BAT_REMOTE_TOKEN })
      } else if (step.kind === 'helper') {
        const args = step.args.map(a => String(a).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || ''))
        const t0 = Date.now()
        const r = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-terminal.mjs'), ...args], { env, encoding: 'utf8', timeout: 30000, windowsHide: true })
        results.push({ kind: 'helper', args, code: r.status, stdout: r.stdout, stderr: r.stderr, ms: Date.now() - t0 })
      }
    }
    const out = path.join(dir, 'result-' + m[1] + '.json')
    fs.writeFileSync(out + '.tmp', JSON.stringify(results, null, 2))
    fs.renameSync(out + '.tmp', out)
  }
}, 100)
`

/** The Worker command: records its terminal id, Tower and parent pid, then exits (its shell stays). */
const WORKER = `
const fs = require('fs')
const path = require('path')
const out = path.join(process.argv[2], 'worker-' + process.env.BAT_TERMINAL_ID + '.json')
fs.writeFileSync(out + '.tmp', JSON.stringify({ terminalId: process.env.BAT_TERMINAL_ID, tower: process.env.BAT_TOWER_TERMINAL_ID, ppid: process.ppid }))
fs.renameSync(out + '.tmp', out)
`

interface Proc { ProcessId: number; ParentProcessId: number; Name: string }

async function processTable(): Promise<Proc[]> {
  const out = await run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress',
  ], 30_000)
  return JSON.parse(out) as Proc[]
}

/** Every descendant of `root`, not descending into `exclude` (the Terminal Server's own tree). */
function descendants(table: Proc[], root: number, exclude: Set<number>): Proc[] {
  const children = new Map<number, Proc[]>()
  for (const p of table) {
    if (p.ProcessId === p.ParentProcessId) continue
    const list = children.get(p.ParentProcessId) ?? []
    list.push(p)
    children.set(p.ParentProcessId, list)
  }
  const out: Proc[] = []
  const stack = [root]
  const seen = new Set<number>([root])
  while (stack.length) {
    for (const child of children.get(stack.pop()!) ?? []) {
      if (seen.has(child.ProcessId) || exclude.has(child.ProcessId)) continue
      seen.add(child.ProcessId)
      out.push(child)
      stack.push(child.ProcessId)
    }
  }
  return out
}

/** Shells BAT's main process runs itself (a direct node-pty spawn), outside the Terminal Server. */
async function directShells(app: ElectronApplication, serverPid: number): Promise<Proc[]> {
  const mainPid = await app.evaluate(() => process.pid)
  const shells = descendants(await processTable(), mainPid, new Set([serverPid]))
    .filter(p => SHELL_NAMES.has(p.Name.toLowerCase()))
  log(`direct shells under main pid ${mainPid}: ${JSON.stringify(shells)}`)
  return shells
}

function registry(userData: string): { id: string; pid: number }[] {
  try {
    return (JSON.parse(fs.readFileSync(path.join(userData, 'bat-pty-registry.json'), 'utf8')) as { ptys: { id: string; pid: number }[] }).ptys
  } catch {
    return []
  }
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

function readJson<T>(file: string): T | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as T : undefined
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
    // T0575 / T0576 measurement: app.close() may not return although BAT finished quitting
    log('app.close() did not finish within 20 s — killing the Electron process')
    try { app.process().kill() } catch { /* already gone */ }
  }
}

/** Stops a Terminal Server left behind by this test (command line of this repo only). */
async function killLeftoverServer(pid: number | null): Promise<void> {
  if (pid === null || !isAlive(pid)) return
  const cmd = await commandLineOf(pid)
  if (!cmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase())) {
    log(`Terminal Server pid ${pid} command line does not match this repo — left alone: ${cmd.trim()}`)
    return
  }
  log(`stopping leftover Terminal Server pid ${pid}`)
  await run('taskkill', ['/T', '/F', '/PID', String(pid)]).catch(() => '')
}

/** Records tab `id`'s `pty:output` in the page (from now on). */
async function captureOutput(win: Page, id: string): Promise<void> {
  await win.evaluate((id) => {
    const w = window as AnyApi
    w.__t0580Output = ''
    w.electronAPI.pty.onOutput((outId: string, data: string) => {
      if (outId === id) w.__t0580Output += data
    })
  }, id)
}

/** Types a command that prints its parent's pid into tab `id`; resolves with every `PPID=<n>` it printed. */
async function parentPidsInTab(win: Page, id: string): Promise<number[]> {
  await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'node -e "console.log(\'PPID=\'+process.ppid)"\r'), id)
  const read = async () => {
    const out = await win.evaluate(() => (window as AnyApi).__t0580Output as string)
    return [...out.matchAll(/PPID=(\d+)/g)].map(m => Number(m[1]))
  }
  await expect.poll(async () => (await read()).length, { timeout: 30_000 }).toBeGreaterThan(0)
  await win.waitForTimeout(1_500)
  return read()
}

const count = (text: string, needle: string) => text.split(needle).length - 1

test.skip(process.platform !== 'win32', 'process tree read with Get-CimInstance (Windows)')

test('helper dispatch during the Recovery prompt: refused after 2 s unanswered, created on the Terminal Server when answered', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0580-'))
  const folder = path.join(tmp, 'ws')
  const drop = path.join(tmp, 'drop')
  fs.mkdirSync(folder, { recursive: true })
  fs.mkdirSync(drop, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const watcher = slash(path.join(tmp, 'watcher.cjs'))
  const workerScript = slash(path.join(tmp, 'worker.cjs'))
  fs.writeFileSync(watcher, WATCHER)
  fs.writeFileSync(workerScript, WORKER)

  let seq = 0
  /** Drops a spec for the Tower's watcher; resolves when its steps started (not finished). */
  const startInTower = async (steps: unknown[], port?: number): Promise<number> => {
    const n = seq++
    const go = path.join(drop, `go-${n}.json`)
    fs.writeFileSync(go + '.tmp', JSON.stringify({ steps, port }))
    fs.renameSync(go + '.tmp', go)
    await expect.poll(() => fs.existsSync(path.join(drop, `started-${n}`)), { timeout: 30_000 }).toBe(true)
    return n
  }
  const resultOf = async (n: number): Promise<StepResult[]> => {
    const file = path.join(drop, `result-${n}.json`)
    await expect.poll(() => fs.existsSync(file), { timeout: 60_000 }).toBe(true)
    const results = readJson<StepResult[]>(file)!
    log(`tower step ${n}: ${JSON.stringify(results.map(r => ({ ...r, token: r.token ? `${r.token.slice(0, 7)}…` : undefined }))).slice(0, 2000)}`)
    return results
  }
  const dispatchArgs = ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, 'node', workerScript, slash(drop)]

  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  let serverPid: number | null = null
  let quitUserData: { userData: string; runtimeId: string } | null = null
  try {
    inst = await launchIsolated('t0580', log)
    const { app, win, userData, runtimeId } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0580', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(() => registry(userData).some(p => p.id === TOWER), { timeout: 30_000 }).toBe(true)
    await win.waitForTimeout(2_000)

    // ── 1. the watcher runs in the Tower tab ──
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: TOWER, line: `node "${watcher}" "${slash(drop)}"\r` })
    const [towerEnv] = await resultOf(await startInTower([{ kind: 'env' }]))
    expect(towerEnv.terminalId).toBe(TOWER)
    expect(towerEnv.token?.startsWith('batcap.')).toBe(true)

    // ── 2. quit keeping the Terminal Server, relaunch ──
    serverPid = readPid(userData)
    expect(serverPid).not.toBeNull()
    quitUserData = { userData, runtimeId }
    await quitKeepingTerminalServer(app)
    inst = undefined
    expect(isAlive(serverPid!)).toBe(true)

    relaunched = await launchIsolated('t0580', log, { runtimeId })
    const { app: app2, win: win2, userData: userData2, remotePort } = relaunched
    expect(userData2).toBe(userData)
    const prompt = win2.locator('.recovery-prompt-dialog')
    await expect(prompt).toBeVisible({ timeout: 30_000 })
    await expect(win2.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(() => readDebugLogs(userData2), { timeout: 30_000 }).toContain(`[BUG-146] pty:create id=${TOWER} held until the Recovery prompt is answered`)

    // ── 3. prompt unanswered: the dispatch gives up after 2 s, nothing is spawned ──
    const refusedRun = await startInTower([{ kind: 'helper', args: dispatchArgs }], remotePort)
    const [refused] = await resultOf(refusedRun)
    expect(refused.code, refused.stderr).toBe(1)
    expect(refused.stderr).toContain('Failed to create terminal (RECOVERY_PENDING)')
    expect(refused.ms!).toBeGreaterThanOrEqual(HOLD_WAIT_MS - 200)
    expect(refused.ms!).toBeLessThan(3_000 + 1_000)
    const refusedDebug = readDebugLogs(userData2)
    expect(refusedDebug).toContain('[BUG-146] terminal:create-with-command id=')
    expect(refusedDebug).toContain(`not created: the Recovery prompt is still unanswered after ${HOLD_WAIT_MS} ms`)
    expect(refusedDebug).not.toContain('Created terminal using node-pty')
    expect(await directShells(app2, serverPid!), 'no direct shell for the refused dispatch').toEqual([])
    await win2.screenshot({ path: test.info().outputPath('recovery-prompt-refused.png') })
    await win2.waitForTimeout(1_200) // the Tower capability's 1 s dispatch interval

    // ── 4. dispatch again, answer "recover" while it waits ──
    const heldBefore = count(readDebugLogs(userData2), '[BUG-146] terminal:create-with-command id=')
    const acceptedRun = await startInTower([{ kind: 'helper', args: dispatchArgs }], remotePort)
    // the dispatch reached the hold (its "held" line), then the user answers
    await expect.poll(() => count(readDebugLogs(userData2), 'held until the Recovery prompt is answered (at most'), { timeout: 1_800, intervals: [50] }).toBe(2)
    expect(count(readDebugLogs(userData2), '[BUG-146] terminal:create-with-command id=')).toBeGreaterThan(heldBefore)
    await prompt.locator('.recovery-prompt-actions .btn-primary').click()
    const [accepted] = await resultOf(acceptedRun)
    expect(accepted.code, accepted.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(accepted.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    log(`accepted dispatch took ${accepted.ms} ms, worker ${worker}`)

    // the Worker is a Terminal Server PTY: its command's parent is the server PTY's shell
    await expect.poll(() => registry(userData2).some(p => p.id === worker), { timeout: 30_000 }).toBe(true)
    const workerPtyPid = registry(userData2).find(p => p.id === worker)!.pid
    const workerFile = path.join(drop, `worker-${worker}.json`)
    await expect.poll(() => fs.existsSync(workerFile), { timeout: 30_000 }).toBe(true)
    const workerEnv = readJson<{ terminalId: string; tower: string; ppid: number }>(workerFile)!
    log(`worker env ${JSON.stringify(workerEnv)}, server PTY pid ${workerPtyPid}`)
    expect(workerEnv).toEqual({ terminalId: worker, tower: TOWER, ppid: workerPtyPid })
    expect(await directShells(app2, serverPid!), 'no direct shell after recover').toEqual([])
    expect(readPid(userData2)).toBe(serverPid)

    const view = win2.locator('.workspace-container.active')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    await captureOutput(win2, worker!)
    const ppids = await parentPidsInTab(win2, worker!)
    log(`PPID lines in the Worker tab: ${JSON.stringify(ppids)} (server PTY pid ${workerPtyPid})`)
    expect(ppids).toEqual([workerPtyPid])

    // the refused dispatch was not created after the answer either: Tower + one Worker only
    await win2.waitForTimeout(2_000)
    await expect(view.locator('.terminal-wrapper')).toHaveCount(2)
    expect(registry(userData2).map(p => p.id).sort()).toEqual([TOWER, worker!].sort())

    const debug = readDebugLogs(userData2)
    expect(debug).toContain(`[BUG-146] terminal:create-with-command id=${worker} released: reused=false`)
    expect(debug).not.toContain('spawns directly while creates are held')
    expect(debug).not.toContain('Created terminal using node-pty')
    expect(debug).not.toContain(towerEnv.token!)
    await win2.screenshot({ path: test.info().outputPath('after-recover.png') })
    const timeline = debug.split('\n')
      .filter(l => /\[BUG-146\]|replay: \d+ active|pty:create |user chose recovery|Created terminal using|server spawned PTY|terminal-created|terminal-reused/.test(l))
    log(`restart timeline:\n${timeline.join('\n')}`)
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
