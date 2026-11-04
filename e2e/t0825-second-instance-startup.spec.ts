// BUG-210 / T0825 (D268): a second BAT instance (same runtime, so it does not get the single-instance lock)
// hands its argv to the running BAT and runs none of the whenReady startup.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts.
//
//   plain:   BAT with one shell tab → a second instance without arguments → it exits on its own, its debug log
//            has only the hand-off line (no `app.whenReady fired`, no tray / upgrade check / Terminal Server
//            lines), no new Terminal Server process, the pid / port files are unchanged; the running BAT opens
//            a new window (its `second-instance` behavior), its shell and Terminal Server keep running
//   profile: the same with `--profile=<the running window's profile>` → the running BAT brings that window to
//            the front (PLAN-039 / T0750 log line), no new window
//
// Teardown ends only what this test started and removes the runtime userData.

import { test, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  E2E_EXECUTABLE,
  REPO_ROOT,
  TERMINAL_SERVER_SCRIPT,
  closeIsolated,
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

const log = testLogger('t0825')
const WS = 'e2e-t0825-ws'
const TAB = 'e2e-t0825-a'
const SECOND_EXIT_MS = 15_000
const HANDOFF_LINE = '[startup] second instance: handed off to the running BAT, skipping startup'
// Lines the whenReady startup writes (each one would mean the second instance ran it)
const STARTUP_LINES = [
  '[startup] app.whenReady fired',
  '[startup] ═══',
  '[startup] crashDumps path',
  '[upgrade-interruption]',
  '[installer-quit]',
  '[terminal-server]',
  '[remote-server]',
]
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ELECTRON_BINARY: string = E2E_EXECUTABLE || (require('electron') as unknown as string)

function registryPids(userData: string): number[] {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(userData, 'bat-pty-registry.json'), 'utf8')) as { ptys: { pid: number }[] }
    return reg.ptys.map(p => p.pid)
  } catch {
    return []
  }
}

function debugLogFiles(userData: string): string[] {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => path.join(dir, f))
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function fileState(file: string): string {
  try {
    const st = fs.statSync(file)
    return `${st.mtimeMs}:${fs.readFileSync(file, 'utf8').trim()}`
  } catch {
    return 'missing'
  }
}

/** Every running process whose command line is this build's terminal-server.js. */
async function terminalServerPids(): Promise<number[]> {
  const script = TERMINAL_SERVER_SCRIPT.toLowerCase()
  if (process.platform === 'win32') {
    const out = await run('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name LIKE '%electron%' OR Name LIKE '%node%' OR Name LIKE '%BetterAgentTerminal%'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }",
    ], 20_000).catch(() => '')
    return out.split(/\r?\n/).filter(l => l.toLowerCase().includes(script)).map(l => Number(l.split('\t')[0])).filter(Number.isInteger)
  }
  const out = await run('ps', ['-eo', 'pid=,args=']).catch(() => '')
  return out.split('\n').filter(l => l.toLowerCase().includes(script)).map(l => Number(l.trim().split(/\s+/)[0])).filter(Number.isInteger)
}

/** A second instance of the same runtime (same userData → same lock). Resolves with its exit code and run time. */
async function launchSecondInstance(runtimeId: string, extraArgs: string[]): Promise<{ code: number | null; ms: number }> {
  const args = [...(E2E_EXECUTABLE ? [] : [REPO_ROOT]), `--runtime=${runtimeId}`, ...extraArgs]
  const env = isolatedEnv(await freePort())
  const started = Date.now()
  return new Promise((resolve) => {
    const child = spawn(ELECTRON_BINARY, args, { env, stdio: 'ignore', windowsHide: true })
    const timer = setTimeout(() => { try { child.kill() } catch { /* gone */ } }, 30_000)
    child.on('exit', (code) => { clearTimeout(timer); resolve({ code, ms: Date.now() - started }) })
    child.on('error', () => { clearTimeout(timer); resolve({ code: null, ms: Date.now() - started }) })
  })
}

async function seed(inst: IsolatedInstance, folder: string): Promise<void> {
  const { win } = inst
  await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
  const loaded = await win.evaluate(async () => (window as AnyApi).electronAPI.settings.load())
  const settings = typeof loaded === 'string' && loaded ? JSON.parse(loaded) : (loaded ?? {})
  await win.evaluate(async (data) => (window as AnyApi).electronAPI.settings.save(data), JSON.stringify({ ...settings, checkForUpdates: false, checkForUpdatesMigrated: true }))
  const data = {
    workspaces: [{ id: WS, name: 'T0825', folderPath: folder, createdAt: Date.now() }],
    activeWorkspaceId: WS,
    activeGroup: null,
    terminals: [{ id: TAB, workspaceId: WS, type: 'terminal', title: 'Shell 1', cwd: folder }],
    activeTerminalId: TAB,
  }
  expect(await win.evaluate(async (json) => (window as AnyApi).electronAPI.workspace.save(json), JSON.stringify(data))).toBe(true)
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
  await expect.poll(() => registryPids(inst.userData).length, { timeout: 30_000 }).toBe(1)
}

async function scenario(kind: 'plain' | 'profile'): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0825-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated(`t0825-${kind}`, log)
    const { app, userData, runtimeId } = inst
    await seed(inst, folder)
    await inst.win.waitForTimeout(1_500)

    const server = readPid(userData)
    expect(server).not.toBeNull()
    const shells = registryPids(userData)
    const pidFile = path.join(userData, 'bat-pty-server.pid')
    const portFile = path.join(userData, 'bat-pty-server.port')
    const before = { pid: fileState(pidFile), port: fileState(portFile) }
    const serversBefore = await terminalServerPids()
    const logsBefore = new Set(debugLogFiles(userData))
    const windowsBefore = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
    const runningProfile = kind === 'profile'
      ? (JSON.parse(fs.readFileSync(path.join(userData, 'windows.json'), 'utf8')) as { profileId?: string }[]).find(e => e.profileId)?.profileId ?? null
      : null
    log(`before: Terminal Server pid ${server}, shell pids ${JSON.stringify(shells)}, server processes ${JSON.stringify(serversBefore)}, windows ${windowsBefore}${kind === 'profile' ? `, running profile ${runningProfile}` : ''}`)
    if (kind === 'profile') expect(runningProfile, 'the running window has a profile').not.toBeNull()

    const second = await launchSecondInstance(runtimeId, kind === 'profile' ? [`--profile=${runningProfile}`] : [])
    log(`second instance: exit ${second.code} after ${second.ms} ms`)
    expect(second.ms, 'the second instance exits on its own').toBeLessThan(SECOND_EXIT_MS)
    expect(second.code).toBe(0)

    // the second instance's own log file (new file of this runtime) has the hand-off line and no startup line
    const newLogs = debugLogFiles(userData).filter(f => !logsBefore.has(f))
    const secondLog = newLogs.map(f => fs.readFileSync(f, 'utf8')).join('\n')
    log(`second instance log (${newLogs.map(f => path.basename(f)).join(', ')}):\n${secondLog.trim()}`)
    expect(newLogs.length).toBe(1)
    expect(secondLog).toContain(HANDOFF_LINE)
    for (const line of STARTUP_LINES) expect(secondLog, `second instance ran startup: ${line}`).not.toContain(line)
    // the hand-off line carries no argv (the logger's own `Debug logging started … argv=` line predates T0825)
    const handoff = secondLog.split(/\r?\n/).filter(l => l.includes(HANDOFF_LINE))
    expect(handoff.map(l => l.slice(l.indexOf('[startup]')))).toEqual([HANDOFF_LINE])

    // no new Terminal Server, pid / port files untouched, the running one and its shell still run
    await new Promise(r => setTimeout(r, 2_000))
    const serversAfter = await terminalServerPids()
    log(`after: server processes ${JSON.stringify(serversAfter)}`)
    expect(serversAfter.filter(p => !serversBefore.includes(p)), 'no new Terminal Server process').toEqual([])
    expect(fileState(pidFile)).toBe(before.pid)
    expect(fileState(portFile)).toBe(before.port)
    expect(isAlive(server!)).toBe(true)
    for (const pid of shells) expect(isAlive(pid), `shell pid ${pid} still running`).toBe(true)

    // the running BAT handled `second-instance` as before
    if (kind === 'plain') {
      await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), { timeout: 15_000 }).toBe(windowsBefore + 1)
    } else {
      await expect.poll(() => [...logsBefore].map(f => fs.readFileSync(f, 'utf8')).join('\n'), { timeout: 15_000 })
        .toMatch(new RegExp(`\\[profile-window\\] second-instance --profile=${runningProfile}: existing window \\S+`))
      expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(windowsBefore)
    }
    await expect(inst.win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(1)
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

test('plain: a second instance without arguments hands off and runs no startup', async () => {
  test.setTimeout(180_000)
  await scenario('plain')
})

test('profile: a second instance with --profile= hands off; the running BAT brings that window to the front', async () => {
  test.setTimeout(180_000)
  await scenario('profile')
})
