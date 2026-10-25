// T0704 / BUG-171: the Terminal Server watchdog on a real isolated instance, without any product test
// hook. Three phases on one instance (one seeded tab):
//
//   clock jump:   the main process's `Date.now` is moved forward 5 s, then 20 s more (what an NTP
//                 correction does to it; before T0704 the heartbeat read Date.now, so one 10 s gap
//                 + 3 s recovered a live server) → no recovery, same Terminal Server pid
//   no pong:      the Terminal Server process is suspended (NtSuspendProcess) for ~50 s: it does
//                 not answer pings, its process and IPC stay → `[heartbeat] late pong:` logged, no
//                 recovery; after resuming: `late pong arrived after …`, same pid
//   real death:   a `ping -t` runs in the tab; the Terminal Server alone is killed (`taskkill /F`,
//                 no /T: its shells become orphans, as after a crash) → recovery (reason=ipc-exit),
//                 the old shell and its ping are gone (tree before shell), the tab gets a new shell
//                 on the new server (no pty:exit for it, a command in it reports the new PTY pid)
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only
// (process table via Get-CimInstance, NtSuspendProcess). Teardown resumes a suspended server and stops
// every Terminal Server this test started (pid file + command line check).

import { test, expect, type Page } from '@playwright/test'
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

const log = testLogger('t0704')
const WS = 'e2e-t0704-ws'
const TAB = 'e2e-t0704-tab'

interface Proc { ProcessId: number; ParentProcessId: number; Name: string }

async function processTable(): Promise<Proc[]> {
  const out = await run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress',
  ], 30_000)
  return JSON.parse(out) as Proc[]
}

function descendants(table: Proc[], root: number): Proc[] {
  const out: Proc[] = []
  const stack = [root]
  const seen = new Set<number>([root])
  while (stack.length) {
    const parent = stack.pop()!
    for (const p of table) {
      if (p.ParentProcessId !== parent || p.ProcessId === parent || seen.has(p.ProcessId)) continue
      seen.add(p.ProcessId)
      out.push(p)
      stack.push(p.ProcessId)
    }
  }
  return out
}

/** NtSuspendProcess / NtResumeProcess of `pid` (same user; returns the NTSTATUS, 0 = success). */
async function suspendOrResume(pid: number, action: 'Suspend' | 'Resume'): Promise<string> {
  const script = [
    '$sig = \'[DllImport("ntdll.dll")] public static extern int NtSuspendProcess(IntPtr h); [DllImport("ntdll.dll")] public static extern int NtResumeProcess(IntPtr h);\'',
    'Add-Type -MemberDefinition $sig -Name Nt -Namespace T0704',
    `$p = Get-Process -Id ${pid}`,
    `[T0704.Nt]::Nt${action}Process($p.Handle)`,
  ].join('; ')
  return (await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 30_000)).trim()
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

/** Records this tab's `pty:output` and `pty:exit` in the page (from now on). */
async function captureTab(win: Page): Promise<void> {
  await win.evaluate((id) => {
    const w = window as AnyApi
    w.__t0704Output = ''
    w.__t0704Exits = []
    w.electronAPI.pty.onOutput((outId: string, data: string) => { if (outId === id) w.__t0704Output += data })
    w.electronAPI.pty.onExit((outId: string, code: number) => { if (outId === id) w.__t0704Exits.push(code) })
  }, TAB)
}

async function parentPidsInTab(win: Page): Promise<number[]> {
  await win.evaluate(() => { (window as AnyApi).__t0704Output = '' })
  await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'node -e "console.log(\'PPID=\'+process.ppid)"\r'), TAB)
  const read = async () => {
    const out = await win.evaluate(() => (window as AnyApi).__t0704Output as string)
    return [...out.matchAll(/PPID=(\d+)/g)].map(m => Number(m[1]))
  }
  await expect.poll(async () => (await read()).length, { timeout: 30_000 }).toBeGreaterThan(0)
  await win.waitForTimeout(1_500)
  return read()
}

const recoveries = (userData: string) => (readDebugLogs(userData).match(/Terminal Server died — attempting recovery/g) ?? []).length

test.skip(process.platform !== 'win32', 'process table via Get-CimInstance, NtSuspendProcess (Windows)')

test('clock jump and a silent server do not recover; a real server death recovers without exit or leftovers', async () => {
  test.setTimeout(420_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0704-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  let inst: IsolatedInstance | undefined
  const serverPids: number[] = []
  let suspended: number | null = null
  try {
    inst = await launchIsolated('t0704', log)
    const { app, win, userData } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0704', folderPath: folder, createdAt: Date.now() }],
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
    const server = readPid(userData)!
    expect(server).not.toBeNull()
    serverPids.push(server)
    const shell = registryPid(userData, TAB)!
    log(`Terminal Server pid ${server}, ${TAB} shell pid ${shell}`)
    await captureTab(win)

    // ── phase 1: the main process's wall clock jumps forward ──
    for (const jump of [5_000, 20_000]) {
      await app.evaluate((_e, ms) => {
        const g = globalThis as AnyApi
        g.__t0704RealNow ??= Date.now.bind(Date)
        g.__t0704Offset = (g.__t0704Offset ?? 0) + ms
        Date.now = () => g.__t0704RealNow() + g.__t0704Offset
      }, jump)
      log(`main Date.now moved forward ${jump} ms`)
      await win.waitForTimeout(25_000) // ≥ 2 heartbeat ticks after the jump
    }
    expect(recoveries(userData), 'no recovery after the clock jumps').toBe(0)
    expect(readDebugLogs(userData)).not.toContain('[heartbeat] late pong')
    expect(readPid(userData)).toBe(server)
    expect(isAlive(shell)).toBe(true)
    await app.evaluate(() => { const g = globalThis as AnyApi; if (g.__t0704RealNow) Date.now = g.__t0704RealNow })

    // ── phase 2: the server stops answering (suspended), its process and IPC stay ──
    log(`suspend Terminal Server ${server}: NTSTATUS ${await suspendOrResume(server, 'Suspend')}`)
    suspended = server
    await expect.poll(() => readDebugLogs(userData), { timeout: 70_000, intervals: [2_000] }).toContain('[heartbeat] late pong:')
    expect(recoveries(userData), 'no recovery while the server only does not answer').toBe(0)
    log(`resume Terminal Server ${server}: NTSTATUS ${await suspendOrResume(server, 'Resume')}`)
    suspended = null
    await expect.poll(() => readDebugLogs(userData), { timeout: 30_000, intervals: [1_000] }).toContain('[heartbeat] late pong arrived after')
    expect(recoveries(userData)).toBe(0)
    expect(readPid(userData)).toBe(server)
    expect(isAlive(shell)).toBe(true)
    const lateLines = readDebugLogs(userData).split('\n').filter(l => l.includes('[heartbeat]'))
    log(`heartbeat lines:\n${lateLines.join('\n')}`)
    expect(await win.evaluate(() => (window as AnyApi).__t0704Exits)).toEqual([])

    // ── phase 3: the server really dies, its shell keeps a child ──
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'ping -t 127.0.0.1\r'), TAB)
    let ping: Proc | undefined
    await expect.poll(async () => {
      ping = descendants(await processTable(), shell).find(p => p.Name.toLowerCase() === 'ping.exe')
      return ping !== undefined
    }, { timeout: 30_000 }).toBe(true)
    log(`ping pid ${ping!.ProcessId} under shell ${shell}`)
    await run('taskkill', ['/F', '/PID', String(server)]) // the server alone: its shells become orphans
    log(`killed Terminal Server ${server} (no /T)`)
    await expect.poll(() => readDebugLogs(userData), { timeout: 30_000 }).toContain('[PtyManager] Terminal Server recovery complete')
    const debug = readDebugLogs(userData)
    expect(debug).toContain('attempting recovery... (reason=ipc-exit)')
    await expect.poll(() => { const p = readPid(userData); return p !== null && p !== server }, { timeout: 30_000 }).toBe(true)
    const newServer = readPid(userData)!
    serverPids.push(newServer)
    await expect.poll(() => { const p = registryPid(userData, TAB); return p !== null && p !== shell }, { timeout: 30_000 }).toBe(true)
    const newShell = registryPid(userData, TAB)!
    log(`after recovery: Terminal Server ${newServer}, ${TAB} shell ${newShell}`)
    await expect.poll(() => isAlive(shell) || isAlive(ping!.ProcessId), { timeout: 15_000 }).toBe(false)
    const table = await processTable()
    const leftovers = table.filter(p => p.ParentProcessId === server || p.ParentProcessId === shell)
    log(`processes whose parent was the old server / shell: ${JSON.stringify(leftovers)}`)
    expect(leftovers).toEqual([])
    expect(descendants(table, newServer).some(p => p.ProcessId === newShell)).toBe(true)
    expect(await win.evaluate(() => (window as AnyApi).__t0704Exits), 'no pty:exit for the rebuilt tab').toEqual([])
    const ppids = await parentPidsInTab(win)
    log(`PPID lines in the tab after recovery: ${JSON.stringify(ppids)} (new shell ${newShell})`)
    expect(ppids).toEqual([newShell])
    await win.screenshot({ path: test.info().outputPath('after-recovery.png') })
    const timeline = readDebugLogs(userData).split('\n')
      .filter(l => /\[heartbeat\]|attempting recovery|recovery:|orphan PTY|re-fork|server spawned PTY|recovery complete|dropped message/.test(l))
    log(`timeline:\n${timeline.join('\n')}`)
  } finally {
    if (suspended !== null) await suspendOrResume(suspended, 'Resume').catch(() => '')
    if (inst) await closeIsolated(inst, log)
    for (const pid of serverPids) await killLeftoverServer(pid)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
