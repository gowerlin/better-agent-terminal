// T0859 / PLAN-065 W3: the Terminal Server of a packaged Windows build starts from the PTY holder outside the
// install directory, and falls back to today's fork when the holder does not match.
//
// Needs a packaged build: BAT_E2E_EXECUTABLE=<…\release\win-unpacked\BetterAgentTerminal.exe> (`npm run build:dir`;
// its resources\pty-holder is the expected holder). Skipped otherwise, and on anything but Windows.
//
// What it does, all in temp directories (the installed BAT, its Terminal Server and the real
// %LOCALAPPDATA%\BAT-PtyHolder are never touched):
//   - simulates the NSIS install: copies resources\pty-holder to <temp>\Local\BAT-PtyHolder\<key> (what
//     build/installer.nsh customInstall does) and creates the T0823 marker resources\installer-quit-request.supported
//     if the build has none (removed again afterwards);
//   - launch 1 (LOCALAPPDATA = <temp>\Local, isolated runtime): the Terminal Server's ExecutablePath is the holder's
//     bat-pty-holder.exe, its command line runs the holder's terminal-server.js; a cmd.exe tab runs a command; a TCP
//     hello (token from the runtime userData) answers runtime node + holderDir = the holder; the debug log has the
//     `[pty-holder] Terminal Server from holder <key> (per-user)` line;
//   - launch 2 (one holder file changed): `[pty-holder] not used (holder-invalid)` and the Terminal Server is
//     BetterAgentTerminal.exe again (today's fork), and a tab still works.
// Teardown ends only Terminal Servers whose executable is under this test's temp directory or the build under test.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {
  E2E_EXECUTABLE,
  closeIsolated,
  launchIsolated,
  readPid,
  run,
  testLogger,
  type IsolatedInstance,
} from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0859')
const MARKER = 'installer-quit-request.supported'

test.skip(process.platform !== 'win32', 'Windows only (the PTY holder is a Windows build feature)')
test.skip(!E2E_EXECUTABLE, 'needs BAT_E2E_EXECUTABLE=<release\\win-unpacked\\BetterAgentTerminal.exe> (npm run build:dir)')

interface ProcInfo { ExecutablePath: string | null; CommandLine: string | null }

async function processInfo(pid: number): Promise<ProcInfo | null> {
  const out = await run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object ExecutablePath,CommandLine | ConvertTo-Json -Compress`,
  ], 30_000).catch(() => '')
  return out.trim() ? JSON.parse(out) as ProcInfo : null
}

async function killIfUnder(pid: number | null, roots: string[]): Promise<void> {
  if (pid === null) return
  const info = await processInfo(pid)
  const exe = (info?.ExecutablePath ?? '').toLowerCase()
  if (exe && roots.some((r) => exe.startsWith(r.toLowerCase()))) {
    log(`Terminal Server pid ${pid} still alive (${path.basename(exe)}) — ending its tree`)
    await run('taskkill', ['/T', '/F', '/PID', String(pid)]).catch(() => '')
  }
}

async function waitForServerPid(userData: string): Promise<number> {
  let pid: number | null = null
  await expect.poll(() => (pid = readPid(userData)), { timeout: 30_000 }).not.toBeNull()
  return pid!
}

function debugLog(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter((f) => f.startsWith('debug-')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

/** A cmd.exe tab runs `echo <marker>`; resolves with the tab's output once the marker comes back. */
async function runInTab(win: Page, id: string, marker: string): Promise<string> {
  await win.evaluate((tab) => {
    const w = window as AnyApi
    w.__t0859Out = w.__t0859Out ?? {}
    w.__t0859Out[tab] = ''
    w.electronAPI.pty.onOutput((outId: string, data: string) => { if (outId === tab) w.__t0859Out[tab] += data })
  }, id)
  expect(await win.evaluate((tab) => (window as AnyApi).electronAPI.pty.create({ id: tab, cwd: 'C:\\', type: 'terminal', shell: 'cmd.exe' }), id)).toBeTruthy()
  await win.waitForTimeout(1500)
  await win.evaluate(({ tab, m }) => (window as AnyApi).electronAPI.pty.write(tab, `echo ${m}_%PROCESSOR_ARCHITECTURE%\r`), { tab: id, m: marker })
  let out = ''
  await expect.poll(async () => (out = await win.evaluate((tab) => (window as AnyApi).__t0859Out[tab] as string, id)), { timeout: 20_000 }).toMatch(new RegExp(`${marker}_(AMD64|ARM64)`))
  return out
}

/** `server:hello` with the runtime's token over TCP → the hello-ok line. */
async function tcpHello(userData: string): Promise<Record<string, unknown>> {
  const port = Number(fs.readFileSync(path.join(userData, 'bat-pty-server.port'), 'utf8').trim())
  const token = fs.readFileSync(path.join(userData, 'bat-pty-server.token'), 'utf8').trim()
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1')
    let buf = ''
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('hello timeout')) }, 5000)
    socket.on('error', reject)
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      for (const line of buf.split('\n').slice(0, -1)) {
        const msg = JSON.parse(line) as Record<string, unknown>
        if (msg.type === 'server:hello-ok' || msg.type === 'error') {
          clearTimeout(timer)
          socket.destroy()
          resolve(msg)
        }
      }
    })
    socket.write(JSON.stringify({ type: 'server:hello', protocolMin: 1, protocolMax: 1, token }) + '\n')
  })
}

test('T0859: the Terminal Server starts from the PTY holder; a changed holder falls back to the fork', async () => {
  test.setTimeout(240_000)
  const installDir = path.dirname(E2E_EXECUTABLE)
  const resources = path.join(installDir, 'resources')
  const packagedHolder = path.join(resources, 'pty-holder')
  const manifest = JSON.parse(fs.readFileSync(path.join(packagedHolder, 'holder-manifest.json'), 'utf8')) as { key: string; arch: string }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0859-'))
  const local = path.join(temp, 'Local')
  const holderDir = path.join(local, 'BAT-PtyHolder', manifest.key)
  fs.cpSync(packagedHolder, holderDir, { recursive: true })
  const markerPath = path.join(resources, MARKER)
  const createdMarker = !fs.existsSync(markerPath)
  if (createdMarker) fs.writeFileSync(markerPath, '')
  log(`holder ${manifest.key} copied under <temp>\\Local\\BAT-PtyHolder; marker ${createdMarker ? 'created' : 'already present'}`)

  let inst: IsolatedInstance | undefined
  let serverPid: number | null = null
  try {
    // ── launch 1: holder used ──
    inst = await launchIsolated('t0859-holder', log, { env: { LOCALAPPDATA: local } })
    serverPid = await waitForServerPid(inst.userData)
    const info = await processInfo(serverPid)
    log(`Terminal Server pid ${serverPid}: ${info?.ExecutablePath}`)
    expect((info?.ExecutablePath ?? '').toLowerCase()).toBe(path.join(holderDir, 'bat-pty-holder.exe').toLowerCase())
    expect((info?.CommandLine ?? '').toLowerCase()).toContain(path.join(holderDir, 'terminal-server.js').toLowerCase())
    expect(info?.CommandLine ?? '').not.toMatch(/app\.asar/i)

    const out = await runInTab(inst.win, 'e2e-t0859-holder', 'HOLDER_E2E')
    log(`tab output has HOLDER_E2E_<arch> (${out.length} chars)`)

    const hello = await tcpHello(inst.userData)
    log(`hello-ok: runtime ${JSON.stringify(hello.runtime)}, holderDir key ${String(hello.holderDir ?? '').split(/[\\/]/).pop()}`)
    expect(hello).toMatchObject({ type: 'server:hello-ok', protocol: 1, pid: serverPid, runtime: { name: 'node' } })
    expect(String(hello.holderDir ?? '').toLowerCase()).toBe(holderDir.toLowerCase())

    const logText = debugLog(inst.userData)
    expect(logText).toMatch(new RegExp(`\\[pty-holder\\] Terminal Server from holder ${manifest.key.replace(/\./g, '\\.')} \\(per-user\\), verified in \\d+ ms`))
    log(logText.split('\n').find((l) => l.includes('[pty-holder]'))?.trim() ?? '(no [pty-holder] line)')

    await closeIsolated(inst, log)
    inst = undefined
    await killIfUnder(serverPid, [temp])

    // ── launch 2: a changed holder file → today's fork ──
    fs.appendFileSync(path.join(holderDir, 'terminal-server.js'), '\n// changed by t0859\n')
    inst = await launchIsolated('t0859-fallback', log, { env: { LOCALAPPDATA: local } })
    serverPid = await waitForServerPid(inst.userData)
    const info2 = await processInfo(serverPid)
    log(`Terminal Server pid ${serverPid}: ${info2?.ExecutablePath}`)
    expect((info2?.ExecutablePath ?? '').toLowerCase()).toBe(E2E_EXECUTABLE.toLowerCase())
    await runInTab(inst.win, 'e2e-t0859-fallback', 'FALLBACK_E2E')
    const logText2 = debugLog(inst.userData)
    expect(logText2).toMatch(/\[pty-holder\] not used \(holder-invalid\) \S+ after \d+ ms: per-user: terminal-server\.js: size \d+, manifest \d+ — forking the Terminal Server as before/)
    log(logText2.split('\n').find((l) => l.includes('[pty-holder]'))?.trim() ?? '(no [pty-holder] line)')
  } finally {
    await closeIsolated(inst, log)
    await killIfUnder(serverPid, [temp, installDir])
    if (createdMarker) fs.rmSync(markerPath, { force: true })
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(temp, { recursive: true, force: true }); break } catch { await new Promise((r) => setTimeout(r, 500)) }
    }
    log(`temp removed: ${!fs.existsSync(temp)}`)
  }
})
