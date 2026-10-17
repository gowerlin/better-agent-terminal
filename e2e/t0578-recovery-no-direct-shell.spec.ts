// T0578 / BUG-146: while the Recovery prompt is open (BAT reopened, Terminal Server kept alive with
// its PTYs), the restored tabs' `pty:create` must not start a direct node-pty shell under BAT's main
// process. Before the fix the create went direct (PtyManager was not connected to the Terminal
// Server yet), so the tab's id had two shells: the surviving server PTY and a hidden local one.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only
// (process tree read with Get-CimInstance).
//
//   recover:     seed one tab → quit WITHOUT stopping the Terminal Server → relaunch → while the
//                prompt is open: no shell under the Electron main process (outside the Terminal
//                Server's tree) → "recover" → still none; the tab is the same server PTY
//                (`pty:create SKIP (idempotent)`, a command in the tab reports the server PTY's pid
//                as its parent, exactly once in the tab's output)
//   fresh start: same, then "fresh start" → a new Terminal Server; the tab gets a new shell on it
//
// Teardown stops every Terminal Server this test started (pid file + command line check) and removes
// the runtime userData, also when a step failed.

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

const log = testLogger('t0578')
const WS = 'e2e-t0578-ws'
const TAB = 'e2e-t0578-tab'
const SHELL_NAMES = new Set(['pwsh.exe', 'powershell.exe', 'cmd.exe', 'bash.exe', 'sh.exe', 'wsl.exe'])
/** How long the prompt stays open before it is measured (the renderer restores its tabs meanwhile). */
const PROMPT_OPEN_MS = 5_000

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

/** Shells BAT's main process runs itself (a direct node-pty spawn), outside any Terminal Server. */
async function directShells(app: ElectronApplication, serverPids: number[]): Promise<Proc[]> {
  const mainPid = await app.evaluate(() => process.pid)
  const shells = descendants(await processTable(), mainPid, new Set(serverPids))
    .filter(p => SHELL_NAMES.has(p.Name.toLowerCase()))
  log(`direct shells under main pid ${mainPid}: ${JSON.stringify(shells)}`)
  return shells
}

function registryPid(userData: string, id: string): number | null {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(userData, 'bat-pty-registry.json'), 'utf8')) as { ptys: { id: string; pid: number }[] }
    return reg.ptys.find(p => p.id === id)?.pid ?? null
  } catch {
    return null
  }
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
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

/** Records this tab's `pty:output` in the page (from now on). */
async function captureOutput(win: Page): Promise<void> {
  await win.evaluate((id) => {
    const w = window as AnyApi
    w.__t0578Output = ''
    w.electronAPI.pty.onOutput((outId: string, data: string) => {
      if (outId === id) w.__t0578Output += data
    })
  }, TAB)
}

/** Types a command that prints its parent's pid; resolves with every `PPID=<n>` the tab printed. */
async function parentPidsInTab(win: Page): Promise<number[]> {
  await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'node -e "console.log(\'PPID=\'+process.ppid)"\r'), TAB)
  const read = async () => {
    const out = await win.evaluate(() => (window as AnyApi).__t0578Output as string)
    return [...out.matchAll(/PPID=(\d+)/g)].map(m => Number(m[1]))
  }
  await expect.poll(async () => (await read()).length, { timeout: 30_000 }).toBeGreaterThan(0)
  await win.waitForTimeout(1_500)
  return read()
}

async function scenario(choice: 'recover' | 'fresh'): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0578-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })

  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  const serverPids: number[] = []
  let quitUserData: { userData: string; runtimeId: string } | null = null
  try {
    inst = await launchIsolated(`t0578-${choice}`, log)
    const { app, win, userData, runtimeId } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0578', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TAB, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(() => registryPid(userData, TAB), { timeout: 30_000 }).not.toBeNull()
    const firstPtyPid = registryPid(userData, TAB)!
    const firstServer = readPid(userData)
    expect(firstServer).not.toBeNull()
    serverPids.push(firstServer!)
    log(`before restart: Terminal Server pid ${firstServer}, ${TAB} server PTY pid ${firstPtyPid}`)
    await win.waitForTimeout(1_500)

    // ── quit keeping the Terminal Server, relaunch ──
    quitUserData = { userData, runtimeId }
    await quitKeepingTerminalServer(app)
    inst = undefined
    expect(isAlive(firstServer!)).toBe(true)
    expect(isAlive(firstPtyPid)).toBe(true)

    relaunched = await launchIsolated(`t0578-${choice}`, log, { runtimeId })
    const { app: app2, win: win2, userData: userData2 } = relaunched
    expect(userData2).toBe(userData)
    await captureOutput(win2)
    const prompt = win2.locator('.recovery-prompt-dialog')
    await expect(prompt).toBeVisible({ timeout: 30_000 })
    await expect(win2.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await win2.waitForTimeout(PROMPT_OPEN_MS)

    // ── while the prompt is open ──
    const pendingShells = await directShells(app2, serverPids)
    const pendingDebug = readDebugLogs(userData2)
    await win2.screenshot({ path: test.info().outputPath('recovery-prompt.png') })
    expect(pendingShells, 'no direct shell while the Recovery prompt is open').toEqual([])
    expect(pendingDebug).not.toContain('Created terminal using node-pty')
    expect(pendingDebug).toContain(`[BUG-146] pty:create id=${TAB} held until the Recovery prompt is answered`)

    if (choice === 'recover') {
      await prompt.locator('.recovery-prompt-actions .btn-primary').click()
      await expect.poll(() => readDebugLogs(userData2), { timeout: 30_000 }).toContain('[PtyManager] replay: 1 active PTY(s) found on reconnect')
      await expect.poll(() => readDebugLogs(userData2), { timeout: 30_000 }).toContain(`pty:create SKIP (idempotent) id=${TAB}`)
      await win2.waitForTimeout(2_000)
      expect(await directShells(app2, serverPids), 'no direct shell after recover').toEqual([])
      expect(readPid(userData2)).toBe(firstServer)

      // the tab is the surviving server PTY, and its output arrives once
      const ppids = await parentPidsInTab(win2)
      log(`PPID lines in the tab after recover: ${JSON.stringify(ppids)} (server PTY pid ${firstPtyPid})`)
      expect(ppids).toEqual([firstPtyPid])
    } else {
      await prompt.locator('.recovery-prompt-actions .btn-secondary').click()
      await expect.poll(() => { const p = readPid(userData2); return p !== null && p !== firstServer }, { timeout: 30_000 }).toBe(true)
      const newServer = readPid(userData2)!
      serverPids.push(newServer)
      await expect.poll(() => registryPid(userData2, TAB), { timeout: 30_000 }).not.toBeNull()
      const newPtyPid = registryPid(userData2, TAB)!
      log(`after fresh start: Terminal Server pid ${newServer}, ${TAB} server PTY pid ${newPtyPid}`)
      expect(newPtyPid).not.toBe(firstPtyPid)
      await expect.poll(() => isAlive(firstServer!), { timeout: 15_000 }).toBe(false)
      expect(await directShells(app2, serverPids), 'no direct shell after fresh start').toEqual([])

      const ppids = await parentPidsInTab(win2)
      log(`PPID lines in the tab after fresh start: ${JSON.stringify(ppids)} (new server PTY pid ${newPtyPid})`)
      expect(ppids).toEqual([newPtyPid])
    }
    await win2.screenshot({ path: test.info().outputPath(`after-${choice}.png`) })
    const timeline = readDebugLogs(userData2).split('\n')
      .filter(l => /\[BUG-146\]|replay: \d+ active|pty:create |user chose recovery|Created terminal using|server spawned PTY|\[terminal-server\]/.test(l))
    log(`restart timeline:\n${timeline.join('\n')}`)
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    for (const pid of serverPids) await killLeftoverServer(pid)
    if (!relaunched && quitUserData && path.basename(quitUserData.userData).includes(`-runtime-${quitUserData.runtimeId}`)) {
      fs.rmSync(quitUserData.userData, { recursive: true, force: true })
      log(`runtime userData removed: ${!fs.existsSync(quitUserData.userData)}`)
    }
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

test.skip(process.platform !== 'win32', 'process tree read with Get-CimInstance (Windows)')

test('recover: no direct shell while the prompt is open; the tab is the surviving server PTY', async () => {
  test.setTimeout(240_000)
  await scenario('recover')
})

test('fresh start: no direct shell while the prompt is open; the tab gets a new shell on the new Terminal Server', async () => {
  test.setTimeout(240_000)
  await scenario('fresh')
})
