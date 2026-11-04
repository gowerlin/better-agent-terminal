// PLAN-063 / T0821: the first start after an upgrade that ended the terminals tells the user so.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only
// (the installer behaviour T0820 measured; process names read with Get-CimInstance).
//
// The installer is simulated the way T0820 measured it: BAT quits keeping its Terminal Server, then
// the Terminal Server this test started is ended by pid (`taskkill /F /PID`, no `/T`: TerminateProcess
// of that one process, as the installer's Stop-Process). Its shells end with it; the pid file and
// the PTY registry stay behind, so the relaunch takes the orphan cleanup path.
//
//   upgrade: `last-run-version.json` rewritten to an older version + a previous-process claude session
//            record for one tab (claude-sessions.json; no claude runs, no model is called) → relaunch →
//            the toast names 2 terminals and both versions, the log line, both tabs restored, a click
//            opens InterruptedAgentsDialog with the claude tab (upgrade text); after a reload the toast
//            is not shown again (once)
//   control: the same without touching the version → no toast, no `detected` line (the orphan cleanup
//            itself runs and logs as before)
//
// Teardown ends only what this test started (Terminal Server by pid + command line check, leftover
// shells of its registry by pid + process name) and removes the runtime userData.

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

const log = testLogger('t0821')
const WS = 'e2e-t0821-ws'
const TAB_SHELL = 'e2e-t0821-shell'
const TAB_CLAUDE = 'e2e-t0821-claude'
const S1 = '11111111-2222-4333-8444-555555555555'
const OLD_VERSION = '0.0.1-e2e.1'
const SHELL_NAMES = new Set(['pwsh.exe', 'powershell.exe', 'cmd.exe', 'bash.exe', 'sh.exe', 'wsl.exe', 'conhost.exe', 'openconsole.exe'])

function registryPids(userData: string): Map<string, number> {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(userData, 'bat-pty-registry.json'), 'utf8')) as { ptys: { id: string; pid: number }[] }
    return new Map(reg.ptys.map(p => [p.id, p.pid]))
  } catch {
    return new Map()
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

async function processName(pid: number): Promise<string> {
  return (await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").Name`]).catch(() => '')).trim()
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
    log('app.close() did not finish within 20 s — killing the Electron process')
    try { app.process().kill() } catch { /* already gone */ }
  }
}

/** Ends one Terminal Server this test started (command line of this repo only); `tree` = with its children. */
async function endServer(pid: number | null, tree: boolean): Promise<void> {
  if (pid === null || !isAlive(pid)) return
  const cmd = await commandLineOf(pid)
  if (!cmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase())) {
    log(`Terminal Server pid ${pid} command line does not match this repo — left alone: ${cmd.trim()}`)
    return
  }
  log(`ending Terminal Server pid ${pid}${tree ? ' (tree)' : ' (this process only, as the installer)'}`)
  await run('taskkill', [...(tree ? ['/T'] : []), '/F', '/PID', String(pid)]).catch(() => '')
}

async function seed(win: Page, folder: string): Promise<void> {
  await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
  const loaded = await win.evaluate(async () => (window as AnyApi).electronAPI.settings.load())
  const settings = typeof loaded === 'string' && loaded ? JSON.parse(loaded) : (loaded ?? {})
  await win.evaluate(async (data) => (window as AnyApi).electronAPI.settings.save(data), JSON.stringify({ ...settings, checkForUpdates: false, checkForUpdatesMigrated: true }))
  const data = {
    workspaces: [{ id: WS, name: 'T0821', folderPath: folder, createdAt: Date.now() }],
    activeWorkspaceId: WS,
    activeGroup: null,
    terminals: [
      { id: TAB_SHELL, workspaceId: WS, type: 'terminal', title: 'Shell', cwd: folder },
      { id: TAB_CLAUDE, workspaceId: WS, type: 'terminal', title: 'Was claude', cwd: folder },
    ],
    activeTerminalId: TAB_SHELL,
  }
  expect(await win.evaluate(async (json) => (window as AnyApi).electronAPI.workspace.save(json), JSON.stringify(data))).toBe(true)
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
}

async function scenario(kind: 'upgrade' | 'control'): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0821-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })

  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  const serverPids: number[] = []
  let ptyPids: number[] = []
  let quitUserData: { userData: string; runtimeId: string } | null = null
  try {
    inst = await launchIsolated(`t0821-${kind}`, log)
    const { app, win, userData, runtimeId } = inst
    const version = await app.evaluate(({ app: electronApp }) => electronApp.getVersion())
    await seed(win, folder)
    await expect.poll(() => registryPids(userData).size, { timeout: 30_000 }).toBe(2)
    ptyPids = [...registryPids(userData).values()]
    const server = readPid(userData)
    expect(server).not.toBeNull()
    serverPids.push(server!)
    const versionFile = path.join(userData, 'last-run-version.json')
    expect(JSON.parse(fs.readFileSync(versionFile, 'utf8')).version).toBe(version)
    log(`before: version ${version}, Terminal Server pid ${server}, PTY pids ${JSON.stringify(ptyPids)}`)
    await win.waitForTimeout(1_500)

    // ── quit keeping the Terminal Server, then end it as the installer does ──
    quitUserData = { userData, runtimeId }
    await quitKeepingTerminalServer(app)
    inst = undefined
    expect(isAlive(server!)).toBe(true)
    await endServer(server, false)
    await expect.poll(() => isAlive(server!), { timeout: 15_000 }).toBe(false)
    expect(fs.existsSync(path.join(userData, 'bat-pty-server.pid')), 'the pid file stays behind').toBe(true)
    expect(registryPids(userData).size, 'the registry stays behind').toBe(2)

    // a claude session record of the previous process for one tab (no claude is started)
    fs.writeFileSync(path.join(userData, 'claude-sessions.json'), JSON.stringify({ version: 1, sessions: [{ terminalId: TAB_CLAUDE, name: 'T0821 · e2e', sessionId: S1 }] }, null, 2))
    if (kind === 'upgrade') fs.writeFileSync(versionFile, JSON.stringify({ schema: 1, version: OLD_VERSION }))

    relaunched = await launchIsolated(`t0821-${kind}`, log, { runtimeId })
    const { app: app2, win: win2, userData: userData2 } = relaunched
    expect(userData2).toBe(userData)
    const newServer = readPid(userData2)
    if (newServer !== null) serverPids.push(newServer)
    await expect(win2.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    await expect.poll(() => readDebugLogs(userData2), { timeout: 30_000 }).toContain('Cleaned 2 orphan PTY process(es) from registry')
    expect(JSON.parse(fs.readFileSync(versionFile, 'utf8')).version).toBe(version)
    const toast = win2.locator('.server-status-toast[data-message-key="app.upgradeInterrupted"]')

    if (kind === 'upgrade') {
      await expect(toast).toBeVisible({ timeout: 30_000 })
      const text = await toast.innerText()
      log(`toast: ${text}`)
      expect(text).toContain('2')
      expect(text).toContain(`v${OLD_VERSION}`)
      expect(text).toContain(`v${version}`)
      expect(await toast.locator('.server-status-toast-interrupted').getAttribute('data-interrupted-count')).toBe('1')
      const debug = readDebugLogs(userData2)
      expect(debug).toContain(`[upgrade-interruption] detected: previous=${OLD_VERSION} current=${version} ended-ptys=2 agent-tabs=1`)
      expect(debug).toContain('[interrupted-agents] upgrade interrupted 1 agent tab(s)')
      expect(debug).not.toContain(S1) // session id: first 8 characters at most
      await win2.screenshot({ path: test.info().outputPath('upgrade-toast.png') })

      await toast.click()
      const dialog = win2.locator('.interrupted-agents-dialog')
      await expect(dialog).toBeVisible({ timeout: 10_000 })
      await expect(dialog.locator('.interrupted-agents-desc')).toHaveAttribute('data-cause', 'upgrade')
      const rows = dialog.locator('li[data-terminal-id]')
      await expect(rows).toHaveCount(1)
      await expect(rows.first()).toHaveAttribute('data-terminal-id', TAB_CLAUDE)
      await expect(rows.first()).toHaveAttribute('data-agent', 'claude-cli')
      await expect(rows.first()).toHaveAttribute('data-resumable', 'true')
      await expect(rows.first().locator('.interrupted-agents-status')).toContainText(S1.slice(0, 8))
      await win2.screenshot({ path: test.info().outputPath('upgrade-dialog.png') })
      await dialog.locator('[data-action="close"]').click()
      await expect(dialog).toHaveCount(0)

      // once: a reload does not show it again (the list is still there, nothing resumed)
      await win2.reload()
      await win2.waitForLoadState('domcontentloaded')
      await expect(win2.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
      await win2.waitForTimeout(4_000)
      await expect(toast).toHaveCount(0)
      expect(await win2.evaluate(async () => ((await (window as AnyApi).electronAPI.terminalServer.queryInterruptedAgents()) as unknown[]).length)).toBe(1)
    } else {
      await win2.waitForTimeout(6_000)
      await expect(toast).toHaveCount(0)
      const debug = readDebugLogs(userData2)
      expect(debug).not.toContain('[upgrade-interruption] detected')
      expect(debug).not.toContain('[interrupted-agents] upgrade interrupted')
      expect(await win2.evaluate(async () => ((await (window as AnyApi).electronAPI.terminalServer.queryInterruptedAgents()) as unknown[]).length)).toBe(0)
    }

    // the previous shells are gone (the server took them / the orphan cleanup ended them)
    const newPtyPids = new Set(registryPids(userData2).values())
    for (const pid of ptyPids) {
      if (newPtyPids.has(pid)) continue // a pid reused by a restored tab's new shell
      const name = isAlive(pid) ? await processName(pid) : ''
      log(`previous PTY pid ${pid}: ${name || 'gone'}`)
      expect(SHELL_NAMES.has(name.toLowerCase()), `previous shell pid ${pid} still running`).toBe(false)
    }
    const timeline = readDebugLogs(userData2).split('\n').filter(l => /\[upgrade-interruption\]|\[interrupted-agents\]|orphan|\[terminal-server\]/.test(l))
    log(`relaunch timeline:\n${timeline.join('\n')}`)
    void app2
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    for (const pid of serverPids) await endServer(pid, true)
    for (const pid of ptyPids) {
      if (!isAlive(pid)) continue
      const name = (await processName(pid)).toLowerCase()
      if (SHELL_NAMES.has(name)) {
        log(`ending leftover shell pid ${pid} (${name})`)
        await run('taskkill', ['/T', '/F', '/PID', String(pid)]).catch(() => '')
      }
    }
    if (!relaunched && quitUserData && path.basename(quitUserData.userData).includes(`-runtime-${quitUserData.runtimeId}`)) {
      fs.rmSync(quitUserData.userData, { recursive: true, force: true })
      log(`runtime userData removed: ${!fs.existsSync(quitUserData.userData)}`)
    }
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

test.skip(process.platform !== 'win32', 'the installer behaviour T0820 measured (Windows)')

test('upgrade: the toast names the ended terminals and versions, lists the claude tab, once', async () => {
  test.setTimeout(240_000)
  await scenario('upgrade')
})

test('control: same version → no toast, the orphan cleanup as before', async () => {
  test.setTimeout(240_000)
  await scenario('control')
})
