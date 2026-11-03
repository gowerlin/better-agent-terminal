// PLAN-063 子項 3 / T0823: the NSIS installer's quit request ends BAT normally (no TerminateProcess).
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only (the
// installer is Windows). No installer runs here: the request is what build/installer.nsh starts, a second
// instance `<exe> --installer-quit-request` of the same runtime (single-instance lock → `second-instance`).
//
//   upgrade: BAT with two shell tabs → request → BAT exits within the installer's wait (15 s) without a
//            dialog, its Terminal Server ran its shutdown (pid / port / registry files gone), the shells
//            ended, `installer-quit-record.json` lists the two terminals → `last-run-version.json`
//            rewritten to an older version → relaunch: the T0821 toast names 2 terminals, the log line
//            has `source=installer`, the record is gone (used once)
//   control: the same without touching the version → no toast, no `detected`, the record is gone too
//   server-only: BAT quit keeping its Terminal Server → request (the request process holds the lock) →
//            no window, the server stops (files gone), the record says `server-only`
//
// Teardown ends only what this test started and removes the runtime userData.

import { test, expect, type ElectronApplication } from '@playwright/test'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  E2E_EXECUTABLE,
  REPO_ROOT,
  TERMINAL_SERVER_SCRIPT,
  closeIsolated,
  commandLineOf,
  freePort,
  isolatedEnv,
  launchIsolated,
  readPid,
  run,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0823')
const WS = 'e2e-t0823-ws'
const TABS = ['e2e-t0823-a', 'e2e-t0823-b']
const OLD_VERSION = '0.0.1-e2e.1'
const INSTALLER_WAIT_MS = 15_000 // build/installer.nsh BAT_INSTALLER_QUIT_TIMEOUT_MS
const SHELL_NAMES = new Set(['pwsh.exe', 'powershell.exe', 'cmd.exe', 'bash.exe', 'sh.exe', 'wsl.exe', 'conhost.exe', 'openconsole.exe'])
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ELECTRON_BINARY: string = E2E_EXECUTABLE || (require('electron') as unknown as string)

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

/** What build/installer.nsh does: `<exe> --installer-quit-request` (same runtime → same lock). Resolves with its exit code and run time. */
async function sendInstallerQuitRequest(runtimeId: string): Promise<{ code: number | null; ms: number }> {
  const args = [...(E2E_EXECUTABLE ? [] : [REPO_ROOT]), `--runtime=${runtimeId}`, '--installer-quit-request']
  const env = isolatedEnv(await freePort())
  const started = Date.now()
  return new Promise((resolve) => {
    const child = spawn(ELECTRON_BINARY, args, { env, stdio: 'ignore', windowsHide: true })
    const timer = setTimeout(() => { try { child.kill() } catch { /* gone */ } }, 30_000)
    child.on('exit', (code) => { clearTimeout(timer); resolve({ code, ms: Date.now() - started }) })
    child.on('error', () => { clearTimeout(timer); resolve({ code: null, ms: Date.now() - started }) })
  })
}

async function waitForExit(app: ElectronApplication, timeoutMs: number): Promise<number | null> {
  const proc = app.process()
  if (proc.exitCode !== null) return 0
  const started = Date.now()
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    proc.once('exit', () => { clearTimeout(timer); resolve(Date.now() - started) })
  })
}

async function endServer(pid: number | null): Promise<void> {
  if (pid === null || !isAlive(pid)) return
  const cmd = await commandLineOf(pid)
  if (!cmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase())) {
    log(`Terminal Server pid ${pid} command line does not match this repo — left alone: ${cmd.trim()}`)
    return
  }
  log(`ending leftover Terminal Server pid ${pid}`)
  await run('taskkill', ['/T', '/F', '/PID', String(pid)]).catch(() => '')
}

async function seed(inst: IsolatedInstance, folder: string): Promise<void> {
  const { win } = inst
  await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
  const loaded = await win.evaluate(async () => (window as AnyApi).electronAPI.settings.load())
  const settings = typeof loaded === 'string' && loaded ? JSON.parse(loaded) : (loaded ?? {})
  await win.evaluate(async (data) => (window as AnyApi).electronAPI.settings.save(data), JSON.stringify({ ...settings, checkForUpdates: false }))
  const data = {
    workspaces: [{ id: WS, name: 'T0823', folderPath: folder, createdAt: Date.now() }],
    activeWorkspaceId: WS,
    activeGroup: null,
    terminals: TABS.map((id, i) => ({ id, workspaceId: WS, type: 'terminal', title: `Shell ${i + 1}`, cwd: folder })),
    activeTerminalId: TABS[0],
  }
  expect(await win.evaluate(async (json) => (window as AnyApi).electronAPI.workspace.save(json), JSON.stringify(data))).toBe(true)
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
  await expect.poll(() => registryPids(inst.userData).size, { timeout: 30_000 }).toBe(2)
}

async function scenario(kind: 'upgrade' | 'control' | 'server-only'): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0823-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })

  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  const serverPids: number[] = []
  let ptyPids: number[] = []
  let quitUserData: { userData: string; runtimeId: string } | null = null
  try {
    inst = await launchIsolated(`t0823-${kind}`, log)
    const { app, userData, runtimeId } = inst
    const version = await app.evaluate(({ app: electronApp }) => electronApp.getVersion())
    await seed(inst, folder)
    ptyPids = [...registryPids(userData).values()]
    const server = readPid(userData)
    expect(server).not.toBeNull()
    serverPids.push(server!)
    log(`before: version ${version}, Terminal Server pid ${server}, PTY pids ${JSON.stringify(ptyPids)}`)
    await inst.win.waitForTimeout(1_500)
    quitUserData = { userData, runtimeId }
    const recordFile = path.join(userData, 'installer-quit-record.json')
    const files = ['bat-pty-server.pid', 'bat-pty-server.port', 'bat-pty-registry.json'].map(f => path.join(userData, f))

    if (kind === 'server-only') {
      // the user quit BAT keeping the Terminal Server (quit dialog: Quit, checkbox off)
      await app.evaluate(({ dialog }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(dialog as any).showMessageBox = async () => ({ response: 1, checkboxChecked: false })
      })
      await Promise.race([app.close().catch(() => undefined), new Promise(r => setTimeout(r, 20_000))])
      inst = undefined
      expect(isAlive(server!), 'the kept Terminal Server runs').toBe(true)
      const req = await sendInstallerQuitRequest(runtimeId)
      log(`request process (holds the lock): exit ${req.code} after ${req.ms} ms`)
      expect(req.code).toBe(0)
      expect(req.ms).toBeLessThan(INSTALLER_WAIT_MS)
      await expect.poll(() => isAlive(server!), { timeout: 10_000 }).toBe(false)
      for (const f of files) expect(fs.existsSync(f), `${path.basename(f)} removed by the server's shutdown`).toBe(false)
      const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'))
      expect(record).toMatchObject({ schema: 1, version, source: 'server-only' })
      expect(record.ptys.map((p: { id: string }) => p.id).sort()).toEqual([...TABS].sort())
      const debug = readDebugLogs(userData)
      expect(debug).toContain('[installer-quit] no running BAT; Terminal Server running with 2 terminal(s) (recorded)')
      expect(debug).toContain('[installer-quit] Terminal Server stopped (server:shutdown)')
    } else {
      const exited = waitForExit(app, INSTALLER_WAIT_MS)
      const req = await sendInstallerQuitRequest(runtimeId)
      log(`request process (second instance): exit ${req.code} after ${req.ms} ms`)
      const quitMs = await exited
      log(`BAT main process exited ${quitMs === null ? 'NOT within' : `${quitMs} ms after the request started, within`} ${INSTALLER_WAIT_MS} ms`)
      expect(quitMs, 'BAT quits within the installer wait (a quit dialog would block it)').not.toBeNull()
      inst = undefined
      const all = readDebugLogs(userData).split('\n')
      const timeline = all.slice(Math.max(0, all.findIndex(l => l.includes('[installer-quit]')) - 2))
      log(`quit timeline:\n${timeline.join('\n')}`)
      await expect.poll(() => isAlive(server!), { timeout: 5_000 }).toBe(false)
      for (const f of files) expect(fs.existsSync(f), `${path.basename(f)} removed by the server's shutdown`).toBe(false)
      const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'))
      expect(record).toMatchObject({ schema: 1, version, source: 'running-app' })
      expect(record.ptys.map((p: { id: string }) => p.id).sort()).toEqual([...TABS].sort())
      const debug = readDebugLogs(userData)
      expect(debug).toContain('[installer-quit] request received: recorded 2 terminal(s), 0 claude session(s)')
      expect(debug).toContain('[installer-quit] quit without confirmation (stopTerminalServer=true)')
      expect(debug).toMatch(/\[quit\] terminal server stopped \(via (IPC server:shutdown|TCP shutdown)\)/)
      expect(debug).not.toContain('[quit] user confirmed quit')
    }

    // the shells ended with the server's shutdown
    for (const pid of ptyPids) {
      const name = isAlive(pid) ? await processName(pid) : ''
      expect(SHELL_NAMES.has(name.toLowerCase()), `shell pid ${pid} still running (${name})`).toBe(false)
    }

    if (kind === 'server-only') return

    const versionFile = path.join(userData, 'last-run-version.json')
    if (kind === 'upgrade') fs.writeFileSync(versionFile, JSON.stringify({ schema: 1, version: OLD_VERSION }))
    relaunched = await launchIsolated(`t0823-${kind}`, log, { runtimeId })
    const { win: win2, userData: userData2 } = relaunched
    const newServer = readPid(userData2)
    if (newServer !== null) serverPids.push(newServer)
    await expect(win2.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    await expect.poll(() => readDebugLogs(userData2), { timeout: 30_000 }).toContain('[installer-quit] record found: version=')
    expect(fs.existsSync(recordFile), 'the record is used once').toBe(false)
    const debug2 = readDebugLogs(userData2)
    expect(debug2, 'a normal quit leaves no orphan').not.toContain('orphan PTY process(es) from registry')
    const toast = win2.locator('.server-status-toast[data-message-key="app.upgradeInterrupted"]')
    if (kind === 'upgrade') {
      await expect(toast).toBeVisible({ timeout: 30_000 })
      const text = await toast.innerText()
      log(`toast: ${text}`)
      expect(text).toContain('2')
      expect(text).toContain(`v${OLD_VERSION}`)
      expect(text).toContain(`v${version}`)
      expect(readDebugLogs(userData2)).toContain(`[upgrade-interruption] detected: previous=${OLD_VERSION} current=${version} ended-ptys=2 agent-tabs=0 source=installer`)
      await win2.screenshot({ path: test.info().outputPath('upgrade-toast.png') })
    } else {
      await win2.waitForTimeout(6_000)
      await expect(toast).toHaveCount(0)
      expect(readDebugLogs(userData2)).not.toContain('[upgrade-interruption] detected')
    }
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    for (const pid of serverPids) await endServer(pid)
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

test.skip(process.platform !== 'win32', 'the NSIS installer is Windows only')

test('upgrade: the request quits BAT normally (server shutdown, no dialog) and the next start shows the notice', async () => {
  test.setTimeout(240_000)
  await scenario('upgrade')
})

test('control: same version → no notice, the record is still used once', async () => {
  test.setTimeout(240_000)
  await scenario('control')
})

test('server-only: no BAT window process — the request process stops the kept Terminal Server', async () => {
  test.setTimeout(240_000)
  await scenario('server-only')
})
