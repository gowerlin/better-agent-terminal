// T0860 / PLAN-065 W4: the installer's quit request keeps a Terminal Server that runs from the PTY holder.
//
// Needs a packaged build: BAT_E2E_EXECUTABLE=<…\release\win-unpacked\BetterAgentTerminal.exe> (`npm run build:dir`).
// Skipped otherwise, and on anything but Windows. No installer runs: the requests are what build/installer.nsh
// starts, `<exe> --installer-quit-request` / `--uninstall-quit-request` of the same runtime (single-instance lock).
// The path without a holder is e2e/t0823-installer-graceful-quit.spec.ts (source build and packaged build).
//
// Setup (as e2e/t0859-pty-holder.spec.ts, all in temp directories; the installed BAT, its Terminal Server and the
// real %LOCALAPPDATA%\BAT-PtyHolder are never touched): the holder copied to <temp>\Local\BAT-PtyHolder\<key>, the
// T0823 marker created when the build has none (removed afterwards), LOCALAPPDATA = <temp>\Local.
//
//   1 running BAT, upgrade request: a cmd.exe tab runs a stand-in for the embedded agent — the build's own
//     BetterAgentTerminal.exe run as node (its path is under the install directory, like the embedded claude).
//     → BAT exits within the installer's wait without a dialog; the holder and the shell still run; the stand-in
//     ended; no process under the install directory is left; schema 2 record (running-app, holder pid, the tab);
//     log: idle extended, PTY holder kept.
//   2 no BAT (the request process holds the lock), upgrade request: another stand-in started in the same tab over
//     TCP → the request process ends it, keeps the holder, records schema 2 (server-only), exits.
//   3 no BAT, uninstall request: the holder stops (server:shutdown), its files are gone, the shell ended.
// Teardown ends only processes under this test's temp directory or the build under test.

import { test, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {
  E2E_EXECUTABLE,
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

const log = testLogger('t0860')
const MARKER = 'installer-quit-request.supported'
const TAB = 'e2e-t0860-a'
const INSTALLER_WAIT_MS = 15_000 // build/installer.nsh BAT_INSTALLER_QUIT_TIMEOUT_MS
// Windows form (BAT_E2E_EXECUTABLE may use forward slashes): compared with Win32_Process.ExecutablePath
const EXE = path.win32.normalize(E2E_EXECUTABLE || 'unset')

test.skip(process.platform !== 'win32', 'Windows only (the PTY holder is a Windows build feature)')
test.skip(!E2E_EXECUTABLE, 'needs BAT_E2E_EXECUTABLE=<release\\win-unpacked\\BetterAgentTerminal.exe> (npm run build:dir)')

interface Proc { ProcessId: number; ParentProcessId: number; ExecutablePath: string | null; Name: string | null }

async function processes(): Promise<Proc[]> {
  const out = await run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,ExecutablePath,Name | ConvertTo-Json -Compress',
  ], 60_000).catch(() => '[]')
  const parsed = JSON.parse(out.trim() || '[]') as Proc | Proc[]
  return Array.isArray(parsed) ? parsed : [parsed]
}

const under = (p: string | null, dir: string) => !!p && p.toLowerCase().startsWith(dir.toLowerCase().replace(/\\+$/, '') + '\\')

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

function debugLog(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

function registryPid(userData: string, id: string): number | null {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(userData, 'bat-pty-registry.json'), 'utf8')) as { ptys: { id: string; pid: number }[] }
    return reg.ptys.find(p => p.id === id)?.pid ?? null
  } catch {
    return null
  }
}

/** What build/installer.nsh starts; resolves with the request process's exit code and run time. */
async function sendRequest(runtimeId: string, arg: '--installer-quit-request' | '--uninstall-quit-request'): Promise<{ code: number | null; ms: number }> {
  const env = isolatedEnv(await freePort())
  const started = Date.now()
  return new Promise((resolve) => {
    const child = spawn(E2E_EXECUTABLE, [`--runtime=${runtimeId}`, arg], { env, stdio: 'ignore', windowsHide: true })
    const timer = setTimeout(() => { try { child.kill() } catch { /* gone */ } }, 40_000)
    child.on('exit', (code) => { clearTimeout(timer); resolve({ code, ms: Date.now() - started }) })
    child.on('error', () => { clearTimeout(timer); resolve({ code: null, ms: Date.now() - started }) })
  })
}

/** The stand-in for an embedded agent: the build's exe run as node, in the cmd tab (foreground). */
function agentCommand(): string {
  return `set ELECTRON_RUN_AS_NODE=1&& "${EXE}" -e "setInterval(function(){},1000)"\r`
}

/** TCP hello with the runtime's token, then `pty:write` to the tab (a v1 server needs the hello first). */
async function tcpWrite(userData: string, id: string, data: string): Promise<void> {
  const port = Number(fs.readFileSync(path.join(userData, 'bat-pty-server.port'), 'utf8').trim())
  const token = fs.readFileSync(path.join(userData, 'bat-pty-server.token'), 'utf8').trim()
  await new Promise<void>((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1')
    let buf = ''
    let sent = false
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('hello timeout')) }, 5000)
    socket.on('error', reject)
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      const lines = buf.split('\n')
      buf = lines.pop()!
      for (const line of lines) {
        if (!line.trim() || sent) continue
        const msg = JSON.parse(line) as Record<string, unknown>
        if (msg.type === 'server:hello-ok') {
          sent = true
          socket.write(JSON.stringify({ type: 'pty:write', id, data }) + '\n', () => {
            clearTimeout(timer)
            setTimeout(() => { socket.destroy(); resolve() }, 300)
          })
        }
      }
    })
    socket.write(JSON.stringify({ type: 'server:hello', protocolMin: 1, protocolMax: 1, token }) + '\n')
  })
}

async function waitForAgent(shellPid: number): Promise<number> {
  let pid = 0
  await expect.poll(async () => {
    const found = (await processes()).find(p => p.ParentProcessId === shellPid && (p.ExecutablePath ?? '').toLowerCase() === EXE.toLowerCase())
    pid = found?.ProcessId ?? 0
    return pid
  }, { timeout: 30_000 }).toBeGreaterThan(0)
  return pid
}

test('T0860: an upgrade keeps the PTY holder (BAT running / not running); an uninstall stops it', async () => {
  test.setTimeout(300_000)
  const installDir = path.win32.dirname(EXE)
  const resources = path.join(installDir, 'resources')
  const packagedHolder = path.join(resources, 'pty-holder')
  const manifest = JSON.parse(fs.readFileSync(path.join(packagedHolder, 'holder-manifest.json'), 'utf8')) as { key: string }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0860-'))
  const local = path.join(temp, 'Local')
  const holderDir = path.join(local, 'BAT-PtyHolder', manifest.key)
  fs.cpSync(packagedHolder, holderDir, { recursive: true })
  const markerPath = path.join(resources, MARKER)
  const createdMarker = !fs.existsSync(markerPath)
  if (createdMarker) fs.writeFileSync(markerPath, '')
  log(`holder ${manifest.key} copied under <temp>\\Local\\BAT-PtyHolder; marker ${createdMarker ? 'created' : 'already present'}`)

  let inst: IsolatedInstance | undefined
  let userData = ''
  let serverPid: number | null = null
  let shellPid: number | null = null
  try {
    // ── 1: running BAT, upgrade request ──
    inst = await launchIsolated('t0860-holder', log, { env: { LOCALAPPDATA: local } })
    userData = inst.userData
    const { app, win, runtimeId } = inst
    const version = await app.evaluate(({ app: electronApp }) => electronApp.getVersion())
    await expect.poll(() => (serverPid = readPid(userData)), { timeout: 30_000 }).not.toBeNull()
    await expect.poll(() => debugLog(userData), { timeout: 30_000 }).toContain(`[pty-holder] Terminal Server from holder ${manifest.key}`)
    expect(await win.evaluate((tab) => (window as AnyApi).electronAPI.pty.create({ id: tab, cwd: 'C:\\', type: 'terminal', shell: 'cmd.exe' }), TAB)).toBeTruthy()
    await expect.poll(() => (shellPid = registryPid(userData, TAB)), { timeout: 30_000 }).not.toBeNull()
    await win.waitForTimeout(1500)
    await win.evaluate(({ tab, data }) => (window as AnyApi).electronAPI.pty.write(tab, data), { tab: TAB, data: agentCommand() })
    const agent1 = await waitForAgent(shellPid!)
    log(`server pid ${serverPid} (holder), shell pid ${shellPid}, stand-in agent pid ${agent1}`)

    const proc = app.process()
    const exited = new Promise<number | null>((resolve) => {
      const started = Date.now()
      const timer = setTimeout(() => resolve(null), INSTALLER_WAIT_MS)
      proc.once('exit', () => { clearTimeout(timer); resolve(Date.now() - started) })
    })
    const req1 = await sendRequest(runtimeId, '--installer-quit-request')
    const quitMs = await exited
    log(`request process exit ${req1.code} after ${req1.ms} ms; BAT exited ${quitMs === null ? 'NOT' : `${quitMs} ms`} within ${INSTALLER_WAIT_MS} ms`)
    expect(quitMs, 'BAT quits within the installer wait').not.toBeNull()
    inst = undefined

    expect(isAlive(serverPid!), 'the holder keeps running').toBe(true)
    expect(isAlive(shellPid!), 'the shell keeps running').toBe(true)
    await expect.poll(() => isAlive(agent1), { timeout: 5_000 }).toBe(false)
    await expect.poll(async () => (await processes()).filter(p => under(p.ExecutablePath, installDir)).length, { timeout: 10_000 }).toBe(0)
    const holderProc = (await processes()).find(p => p.ProcessId === serverPid)
    expect((holderProc?.ExecutablePath ?? '').toLowerCase()).toBe(path.join(holderDir, 'bat-pty-holder.exe').toLowerCase())
    const record1 = JSON.parse(fs.readFileSync(path.join(userData, 'installer-quit-record.json'), 'utf8'))
    expect(record1).toMatchObject({ schema: 2, version, source: 'running-app', holderKept: true, holderPid: serverPid, endedPtys: [], endedAgentProcesses: [{ terminalId: TAB, processes: 1 }] })
    const log1 = debugLog(userData)
    expect(log1).toContain('[installer-quit] request received: Terminal Server runs from the PTY holder (idle extended) — keeping it with 1 terminal(s); recorded 1 tab(s) with ended agent processes')
    expect(log1).toContain('[installer-quit] ended 1 agent process(es) under the install directory in 1 tab(s)')
    expect(log1).toContain('[installer-quit] quit without confirmation (stopTerminalServer=false, PTY holder kept)')
    expect(log1).not.toMatch(/\[quit\] terminal server stopped/)
    for (const line of log1.split('\n').filter(l => l.includes('[installer-quit]'))) log(line.trim())

    // ── 2: no BAT, upgrade request (the request process holds the lock) ──
    fs.rmSync(path.join(userData, 'installer-quit-record.json'), { force: true })
    await tcpWrite(userData, TAB, agentCommand())
    const agent2 = await waitForAgent(shellPid!)
    expect((await processes()).filter(p => p.ParentProcessId === shellPid).length, 'one stand-in in the tab').toBe(1)
    const req2 =await sendRequest(runtimeId, '--installer-quit-request')
    log(`request process (holds the lock): exit ${req2.code} after ${req2.ms} ms; stand-in agent pid ${agent2}`)
    expect(req2.code).toBe(0)
    expect(req2.ms).toBeLessThan(INSTALLER_WAIT_MS)
    await expect.poll(() => isAlive(agent2), { timeout: 5_000 }).toBe(false)
    expect(isAlive(serverPid!), 'the holder keeps running').toBe(true)
    expect(isAlive(shellPid!), 'the shell keeps running').toBe(true)
    const record2 = JSON.parse(fs.readFileSync(path.join(userData, 'installer-quit-record.json'), 'utf8'))
    expect(record2).toMatchObject({ schema: 2, source: 'server-only', holderKept: true, holderPid: serverPid, endedAgentProcesses: [{ terminalId: TAB, processes: 1 }] })
    expect(debugLog(userData)).toContain('[installer-quit] no running BAT; Terminal Server runs from the PTY holder (idle extended) — keeping it with 1 terminal(s); recorded 1 tab(s) with ended agent processes')

    // ── 3: no BAT, uninstall request → the holder stops ──
    const req3 = await sendRequest(runtimeId, '--uninstall-quit-request')
    log(`uninstall request process: exit ${req3.code} after ${req3.ms} ms`)
    expect(req3.code).toBe(0)
    await expect.poll(() => isAlive(serverPid!), { timeout: 10_000 }).toBe(false)
    await expect.poll(() => isAlive(shellPid!), { timeout: 10_000 }).toBe(false)
    for (const f of ['bat-pty-server.pid', 'bat-pty-server.port', 'bat-pty-server.token']) {
      expect(fs.existsSync(path.join(userData, f)), `${f} removed`).toBe(false)
    }
    const log3 = debugLog(userData)
    expect(log3).toContain('[installer-quit] Terminal Server stopped (server:shutdown)')
    expect(await processes().then(list => list.filter(p => under(p.ExecutablePath, holderDir)).length)).toBe(0)
  } finally {
    await closeIsolated(inst, log)
    for (const p of await processes()) {
      if (under(p.ExecutablePath, temp) || (p.ExecutablePath ?? '').toLowerCase() === EXE.toLowerCase()) {
        log(`ending leftover ${p.Name} pid ${p.ProcessId}`)
        await run('taskkill', ['/T', '/F', '/PID', String(p.ProcessId)]).catch(() => '')
      }
    }
    if (shellPid !== null && isAlive(shellPid)) await run('taskkill', ['/T', '/F', '/PID', String(shellPid)]).catch(() => '')
    if (createdMarker) fs.rmSync(markerPath, { force: true })
    if (userData && path.basename(userData).includes('-runtime-e2e-')) fs.rmSync(userData, { recursive: true, force: true })
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(temp, { recursive: true, force: true }); break } catch { await new Promise(r => setTimeout(r, 500)) }
    }
    log(`temp removed: ${!fs.existsSync(temp)}`)
  }
})
