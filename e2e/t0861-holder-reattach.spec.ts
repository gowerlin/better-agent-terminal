// T0861 / PLAN-065 W5 (D286 D4): after an installer quit that kept the PTY holder, BAT reconnects to it without
// the Recovery prompt.
//
// Needs a packaged build: BAT_E2E_EXECUTABLE=<…\release\win-unpacked\BetterAgentTerminal.exe> (`npm run build:dir`).
// Skipped otherwise, and on anything but Windows. No installer runs: the request is what build/installer.nsh
// starts, `<exe> --installer-quit-request` of the same runtime (single-instance lock), as e2e/t0860-installer-quit-holder.spec.ts.
// Setup as that spec (all in temp directories; the installed BAT, its Terminal Server and the real
// %LOCALAPPDATA%\BAT-PtyHolder are never touched): the holder copied to <temp>\Local\BAT-PtyHolder\<key>, the
// T0823 marker created when the build has none (removed afterwards), LOCALAPPDATA = <temp>\Local. The update
// check is off with its T0864 marker (`checkForUpdates: false` + `checkForUpdatesMigrated: true`), since the
// same runtime is reopened.
//
//   1 BAT runs a cmd tab on the holder → upgrade request → BAT exits, holder and shell keep running, schema 2 record.
//   2 reopen the same runtime → no Recovery prompt (none in the DOM, `queryPendingRecovery` null), the reconnected
//     toast, the log line; the same holder pid and the same shell pid; input written now reaches that shell (it
//     writes a file in the tab's cwd) and its output comes back.
//   3 control (D4 negative row): another upgrade request, then the record's holder pid altered → reopen → the
//     Recovery prompt is shown (pid mismatch), "keep" → the same shell still answers.
// Teardown ends only processes under this test's temp directory or the build under test.

import { test, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
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

const log = testLogger('t0861')
const MARKER = 'installer-quit-request.supported'
const TAB = 'e2e-t0861-a'
const RECORD = 'installer-quit-record.json'
const INSTALLER_WAIT_MS = 15_000 // build/installer.nsh BAT_INSTALLER_QUIT_TIMEOUT_MS
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

async function sendUpgradeRequest(runtimeId: string): Promise<number | null> {
  const env = isolatedEnv(await freePort())
  return new Promise((resolve) => {
    const child = spawn(E2E_EXECUTABLE, [`--runtime=${runtimeId}`, '--installer-quit-request'], { env, stdio: 'ignore', windowsHide: true })
    const timer = setTimeout(() => { try { child.kill() } catch { /* gone */ } }, 40_000)
    child.on('exit', (code) => { clearTimeout(timer); resolve(code) })
    child.on('error', () => { clearTimeout(timer); resolve(null) })
  })
}

/** The upgrade request against a running BAT; resolves once BAT exited (or throws after the installer wait). */
async function upgradeQuit(inst: IsolatedInstance): Promise<void> {
  const proc = inst.app.process()
  const exited = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), INSTALLER_WAIT_MS)
    proc.once('exit', () => { clearTimeout(timer); resolve(true) })
  })
  const code = await sendUpgradeRequest(inst.runtimeId)
  log(`upgrade request exit ${code}`)
  expect(await exited, 'BAT quits within the installer wait').toBe(true)
}

/** Collects the tab's output in the window (pty.onOutput) and returns a reader. */
async function collectOutput(win: IsolatedInstance['win']): Promise<() => Promise<string>> {
  await win.evaluate((tab) => {
    const w = window as AnyApi
    w.__t0861 = ''
    w.electronAPI.pty.onOutput((id: string, data: string) => { if (id === tab) w.__t0861 += data })
  }, TAB)
  return () => win.evaluate(() => (window as AnyApi).__t0861 as string)
}

test('T0861: an installer quit that kept the holder → reopen reconnects without the Recovery prompt (same shell)', async () => {
  test.setTimeout(360_000)
  const installDir = path.win32.dirname(EXE)
  const resources = path.join(installDir, 'resources')
  const packagedHolder = path.join(resources, 'pty-holder')
  const manifest = JSON.parse(fs.readFileSync(path.join(packagedHolder, 'holder-manifest.json'), 'utf8')) as { key: string }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0861-'))
  const local = path.join(temp, 'Local')
  const cwd = path.join(temp, 'cwd')
  fs.mkdirSync(cwd)
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
    // ── 1: BAT with a cmd tab on the holder → upgrade request ──
    inst = await launchIsolated('t0861-reattach', log, { env: { LOCALAPPDATA: local } })
    userData = inst.userData
    const runtimeId = inst.runtimeId
    const loaded = await inst.win.evaluate(async () => (window as AnyApi).electronAPI.settings.load())
    const settings = typeof loaded === 'string' && loaded ? JSON.parse(loaded) : (loaded ?? {})
    await inst.win.evaluate(async (data) => (window as AnyApi).electronAPI.settings.save(data), JSON.stringify({ ...settings, checkForUpdates: false, checkForUpdatesMigrated: true }))
    await expect.poll(() => (serverPid = readPid(userData)), { timeout: 30_000 }).not.toBeNull()
    await expect.poll(() => debugLog(userData), { timeout: 30_000 }).toContain(`[pty-holder] Terminal Server from holder ${manifest.key}`)
    expect(await inst.win.evaluate(({ tab, dir }) => (window as AnyApi).electronAPI.pty.create({ id: tab, cwd: dir, type: 'terminal', shell: 'cmd.exe' }), { tab: TAB, dir: cwd })).toBeTruthy()
    await expect.poll(() => (shellPid = registryPid(userData, TAB)), { timeout: 30_000 }).not.toBeNull()
    await inst.win.waitForTimeout(1500)
    await inst.win.evaluate((tab) => (window as AnyApi).electronAPI.pty.write(tab, 'echo before> before.txt\r'), TAB)
    await expect.poll(() => fs.existsSync(path.join(cwd, 'before.txt')), { timeout: 15_000 }).toBe(true)
    log(`holder pid ${serverPid}, shell pid ${shellPid}`)

    await upgradeQuit(inst)
    inst = undefined
    expect(isAlive(serverPid!), 'the holder keeps running').toBe(true)
    expect(isAlive(shellPid!), 'the shell keeps running').toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(userData, RECORD), 'utf8'))).toMatchObject({ schema: 2, holderKept: true, holderPid: serverPid })

    // ── 2: reopen → reconnected, no Recovery prompt ──
    inst = await launchIsolated('t0861-reattach', log, { env: { LOCALAPPDATA: local }, runtimeId })
    const win2 = inst.win
    await expect.poll(() => debugLog(userData), { timeout: 30_000 }).toContain('[terminal-server] 1 live PTYs on the PTY holder the installer kept — reconnecting without the Recovery prompt')
    await expect(win2.locator('[data-message-key="app.upgradeReattachedSameVersion"]')).toBeVisible({ timeout: 30_000 })
    await win2.waitForTimeout(3000) // the prompt would have shown by now (pull on mount + did-finish-load)
    expect(await win2.locator('.recovery-prompt-dialog').count()).toBe(0)
    expect(await win2.evaluate(() => (window as AnyApi).electronAPI.terminalServer.queryPendingRecovery())).toBeNull()
    expect(readPid(userData), 'the same holder').toBe(serverPid)
    expect(registryPid(userData, TAB), 'the same shell').toBe(shellPid)
    expect(isAlive(shellPid!)).toBe(true)
    expect(fs.existsSync(path.join(userData, RECORD)), 'the record is read once').toBe(false)
    const log2 = debugLog(userData)
    expect(log2).toContain('[terminal-server] PTY holder reattach — connected to port')
    expect(log2).toMatch(/\[upgrade-interruption\] reattached: previous=\S+ current=\S+ same-version reattached-ptys=1/)
    expect(log2).not.toContain('Recovery prompt pending')
    for (const line of log2.split('\n').filter(l => /\[upgrade-interruption\]|PTY holder reattach|BUG-146/.test(l))) log(line.trim())

    // input reaches the kept shell, its output comes back
    const output = await collectOutput(win2)
    await win2.evaluate((tab) => (window as AnyApi).electronAPI.pty.write(tab, 'echo after> after.txt& echo T0861-ALIVE\r'), TAB)
    await expect.poll(() => fs.existsSync(path.join(cwd, 'after.txt')), { timeout: 15_000 }).toBe(true)
    await expect.poll(output, { timeout: 15_000 }).toContain('T0861-ALIVE')
    expect((await processes()).filter(p => p.ParentProcessId === serverPid && /cmd\.exe$/i.test(p.Name ?? '')).length, 'one shell for the tab').toBe(1)

    // ── 3: control — the record's holder pid does not match → the Recovery prompt as before ──
    await upgradeQuit(inst)
    inst = undefined
    const recordPath = path.join(userData, RECORD)
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'))
    fs.writeFileSync(recordPath, JSON.stringify({ ...record, holderPid: serverPid! + 1 }, null, 2))
    inst = await launchIsolated('t0861-reattach', log, { env: { LOCALAPPDATA: local }, runtimeId })
    const prompt = inst.win.locator('.recovery-prompt-dialog')
    await expect(prompt).toBeVisible({ timeout: 30_000 })
    expect(debugLog(userData)).toContain('[terminal-server] the installer kept a PTY holder, but pid-file-mismatch — showing the Recovery prompt')
    await prompt.locator('.recovery-prompt-actions .btn-primary').click()
    await expect.poll(() => debugLog(userData), { timeout: 15_000 }).toContain('[terminal-server] user chose recovery — connected to port')
    await inst.win.evaluate((tab) => (window as AnyApi).electronAPI.pty.write(tab, 'echo kept> kept.txt\r'), TAB)
    await expect.poll(() => fs.existsSync(path.join(cwd, 'kept.txt')), { timeout: 15_000 }).toBe(true)
    expect(registryPid(userData, TAB)).toBe(shellPid)
  } finally {
    await closeIsolated(inst, log)
    for (const p of await processes()) {
      if (under(p.ExecutablePath, temp) || (p.ExecutablePath ?? '').toLowerCase() === EXE.toLowerCase()) {
        log(`ending leftover ${p.Name} pid ${p.ProcessId}`)
        await run('taskkill', ['/T', '/F', '/PID', String(p.ProcessId)]).catch(() => '')
      }
    }
    if (shellPid !== null && isAlive(shellPid)) await run('taskkill', ['/T', '/F', '/PID', String(shellPid)]).catch(() => '')
    if (createdMarker) fs.rmSync(path.join(resources, MARKER), { force: true })
    if (userData && path.basename(userData).includes('-runtime-e2e-')) fs.rmSync(userData, { recursive: true, force: true })
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(temp, { recursive: true, force: true }); break } catch { await new Promise(r => setTimeout(r, 500)) }
    }
    log(`temp removed: ${!fs.existsSync(temp)}`)
  }
})
