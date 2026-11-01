// T0776 (BUG-194): a dialog that opens by itself while a terminal tab has the keyboard focus takes the
// focus, so the first Esc closes it and does not reach the background PTY; closing it gives the focus
// back to the terminal — on a real isolated instance.
//
//   - Claude Runtime = system, customPath = a stub `claude.exe` compiled here with the .NET Framework `csc`
//     (`--version` → `2.1.316 (Claude Code)`, otherwise waits): the restored claude-cli tab is an agent
//     tab, so a Terminal Server recovery lists it. No real claude, no login.
//   - the shell tab is the active one and its xterm has the focus. After the recovery a byte logger
//     (node, raw stdin) runs in that tab and appends every chunk it reads as hex to a file: the
//     shell-side record of what the PTY received.
//   - ① only the isolated instance's Terminal Server dies (pid from the isolated userData, command line
//     = the build's terminal-server.js, parent = the isolated main process; T0773) → the interrupted
//     agents dialog opens by itself → the focus is inside the dialog, the first Esc closes it, the
//     logger has no 0x1b, the focus is back in the shell tab's xterm (a typed key reaches the logger).
//   - ② Settings opened by main (`app:open-settings`, T0530: a detached window's "open settings") while
//     the xterm has the focus → same checks.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only.

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

const log = testLogger('t0776')
const WS = 'e2e-t0776-ws'
const CLAUDE_TAB = 'e2e-t0776-claude'
const SHELL_TAB = 'e2e-t0776-shell'
const CSC = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')

const STUB_SOURCE = String.raw`
using System;
using System.Threading;

class StubClaude {
  static int Main(string[] args) {
    if (args.Length == 1 && args[0] == "--version") { Console.WriteLine("2.1.316 (Claude Code)"); return 0; }
    Console.WriteLine("t0776 stub claude ready");
    Thread.Sleep(Timeout.Infinite);
    return 0;
  }
}
`

// Raw stdin → one hex line per chunk; READY once raw mode is on.
const LOGGER_SOURCE = `
const fs = require('fs')
const out = process.argv[2]
process.stdin.setRawMode(true)
process.stdin.resume()
fs.appendFileSync(out, 'READY\\n')
process.stdin.on('data', (chunk) => fs.appendFileSync(out, Buffer.from(chunk).toString('hex') + '\\n'))
`

interface Proc { ProcessId: number; ParentProcessId: number }

async function parentOf(pid: number): Promise<number> {
  const out = await run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}") | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress`,
  ], 30_000)
  return (JSON.parse(out) as Proc).ParentProcessId
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

async function killLeftoverServer(pid: number | null): Promise<void> {
  if (pid === null || !isAlive(pid)) return
  const cmd = await commandLineOf(pid)
  if (!cmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase())) return
  log(`stopping leftover Terminal Server pid ${pid}`)
  await run('taskkill', ['/T', '/F', '/PID', String(pid)]).catch(() => '')
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

const loggerLines = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [])
/** Chunks the logger read (hex), READY excluded. */
const loggerChunks = (file: string) => loggerLines(file).filter(l => l !== 'READY')

/** A chunk (hex, two characters per byte) holds an ESC byte. */
const hasEsc = (hex: string) => /^(?:[0-9a-f]{2})*?1b/.test(hex)

const SHELL_XTERM = '.workspace-container.active .terminal-wrapper.active .xterm-helper-textarea'

function focusOf(win: Page) {
  return win.evaluate((shellSelector) => {
    const el = document.activeElement as HTMLElement | null
    return {
      tag: el?.tagName ?? null,
      cls: (el?.className && typeof el.className === 'string' ? el.className : '').slice(0, 80),
      inXterm: !!el?.closest('.xterm'),
      isShellXterm: !!el && el === document.querySelector(shellSelector),
      inModal: !!el?.closest('[data-modal-overlay]'),
    }
  }, SHELL_XTERM)
}

test.skip(process.platform !== 'win32', 'stub claude.exe compiled with the .NET Framework csc (Windows)')

test('a dialog that opens by itself takes the focus: the first Esc closes it, the PTY gets no Esc, the focus goes back to the terminal', async () => {
  test.setTimeout(300_000)
  test.skip(!fs.existsSync(CSC), `no .NET Framework csc at ${CSC}`)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0776-'))
  const folder = path.join(tmp, 'ws')
  const stubDir = path.join(tmp, 'stub')
  const loggerScript = path.join(tmp, 'byte-logger.cjs')
  const loggerOut = path.join(tmp, 'pty-input.log')
  /** Starts the byte logger in the shell tab through IPC (the keyboard focus is not touched). */
  const typeLoggerCommand = (page: Page, out: string) => page.evaluate(({ id, cmd }) => (window as AnyApi).electronAPI.pty.write(id, cmd), {
    id: SHELL_TAB,
    cmd: `& '${process.execPath}' '${loggerScript}' '${out}'\r`,
  })
  fs.mkdirSync(folder, { recursive: true })
  fs.mkdirSync(stubDir, { recursive: true })
  fs.writeFileSync(path.join(stubDir, 'stub.cs'), STUB_SOURCE)
  fs.writeFileSync(loggerScript, LOGGER_SOURCE)
  const stubExe = path.join(stubDir, 'claude.exe')
  await run(CSC, ['/nologo', `/out:${stubExe}`, path.join(stubDir, 'stub.cs')], 60_000)
  expect((await run(stubExe, ['--version'])).trim()).toBe('2.1.316 (Claude Code)')

  let inst: IsolatedInstance | undefined
  const serverPids: number[] = []
  const results: Record<string, string> = {}
  try {
    inst = await launchIsolated('t0776', log)
    const { app, win, userData } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const loaded = await win.evaluate(async () => (window as AnyApi).electronAPI.settings.load())
    const settings = typeof loaded === 'string' && loaded ? JSON.parse(loaded) : (loaded ?? {})
    await win.evaluate(async (data) => (window as AnyApi).electronAPI.settings.save(data), JSON.stringify({
      ...settings,
      claudeRuntime: { mode: 'system', customPath: stubExe, fallbackToEmbedded: false },
      checkForUpdates: false,
    }))
    const seed = {
      workspaces: [{ id: WS, name: 'T0776', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: CLAUDE_TAB, workspaceId: WS, type: 'terminal', agentPreset: 'claude-cli', title: 'Claude CLI', cwd: folder },
        { id: SHELL_TAB, workspaceId: WS, type: 'terminal', title: 'Shell', cwd: folder },
      ],
      activeTerminalId: SHELL_TAB,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-container.active .terminal-wrapper')).toHaveCount(2, { timeout: 30_000 })
    await expect(win.locator(SHELL_XTERM)).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(() => readDebugLogs(userData), { timeout: 60_000 }).toContain(`terminal=${CLAUDE_TAB}`)
    await win.waitForTimeout(3_000)

    // the shell tab is the main one (with no focused tab the agent tab is shown) and its xterm has the focus
    await win.locator('.workspace-container.active .thumbnail:not(.agent-terminal)', { hasText: 'Shell' }).click()
    await win.locator(SHELL_XTERM).focus()
    expect((await focusOf(win)).isShellXterm).toBe(true)
    // method check: with no dialog, a key typed into this xterm reaches the logger in this tab's PTY
    const preOut = `${loggerOut}.pre`
    await typeLoggerCommand(win, preOut)
    await expect.poll(() => loggerLines(preOut), { timeout: 30_000 }).toContain('READY')
    await win.keyboard.type('k')
    await win.keyboard.press('Escape')
    await expect.poll(() => loggerLines(preOut).filter(l => l !== 'READY').join(''), { timeout: 10_000 }).toBe('6b1b')
    log(`pre-recovery method check: 'k' + Esc typed into the shell xterm → logger read ${JSON.stringify(loggerLines(preOut))}`)

    // ── ① only the isolated instance's Terminal Server dies → the interrupted agents dialog opens by itself ──
    const server = readPid(userData)
    expect(server).not.toBeNull()
    serverPids.push(server!)
    const mainPid = await app.evaluate(() => process.pid)
    const serverCmd = await commandLineOf(server!)
    const parent = await parentOf(server!)
    const isOurs = serverCmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase()) && parent === mainPid
    log(`① Terminal Server pid ${server} (isolated userData): build's terminal-server.js ${serverCmd.toLowerCase().includes(TERMINAL_SERVER_SCRIPT.toLowerCase())}, parent ${parent} = isolated main ${mainPid}: ${parent === mainPid}`)
    if (!isOurs) throw new Error('Terminal Server pid does not belong to the isolated instance — not killed')
    await run('taskkill', ['/F', '/PID', String(server)])
    log(`① killed Terminal Server ${server} (no /T)`)
    await expect.poll(() => readDebugLogs(userData), { timeout: 30_000 }).toContain('[PtyManager] Terminal Server recovery complete')
    await expect.poll(() => { const p = readPid(userData); return p !== null && p !== server }, { timeout: 30_000 }).toBe(true)
    serverPids.push(readPid(userData)!)
    await expect(win.locator('.interrupted-agents-dialog')).toBeVisible({ timeout: 15_000 })

    // the byte logger runs in the recovered shell tab (typed through IPC: the keyboard focus is not touched)
    await win.waitForTimeout(3_000)
    await typeLoggerCommand(win, loggerOut)
    await expect.poll(() => loggerLines(loggerOut), { timeout: 30_000 }).toContain('READY')
    await win.waitForTimeout(500)
    const chunksBefore = loggerChunks(loggerOut).length

    const focusOpen1 = await focusOf(win)
    await win.keyboard.press('Escape')
    const closed1 = await expect(win.locator('.interrupted-agents-dialog')).toHaveCount(0, { timeout: 5_000 }).then(() => true, () => false)
    await win.waitForTimeout(1_000)
    const pty1 = loggerChunks(loggerOut).slice(chunksBefore)
    const focusClosed1 = await focusOf(win)
    log(`① dialog open: focus ${JSON.stringify(focusOpen1)}; first Esc closed it: ${closed1}; PTY read after Esc: ${JSON.stringify(pty1)}; focus after close: ${JSON.stringify(focusClosed1)}`)
    await win.screenshot({ path: test.info().outputPath('1-after-esc.png') })
    if (!closed1) {
      // pre-fix behaviour: close it so ② can run, then fail on the assertions below
      await win.locator('.interrupted-agents-dialog [data-action="close"]').click()
    }
    expect.soft(focusOpen1.inModal).toBe(true)
    expect.soft(closed1).toBe(true)
    expect.soft(pty1.some(hasEsc)).toBe(false)
    expect.soft(focusClosed1.isShellXterm).toBe(true)
    // the keyboard is back on the terminal: a typed key reaches the PTY
    await win.keyboard.type('q')
    const typedReached = await expect.poll(() => loggerChunks(loggerOut).slice(chunksBefore), { timeout: 10_000 }).toContain('71').then(() => true, () => false)
    log(`① 'q' typed after the close reached the PTY: ${typedReached}`)
    expect.soft(typedReached).toBe(true)
    results['①'] = `${test.info().errors.length === 0 ? 'PASS' : 'FAIL'} — interrupted agents dialog: focus in dialog ${focusOpen1.inModal}; first Esc closed it ${closed1}; PTY read after Esc ${JSON.stringify(pty1)}; focus back in the shell xterm ${focusClosed1.isShellXterm}; 'q' reached the PTY ${typedReached}`

    // ── ② Settings opened by main while the xterm has the focus ──
    await win.locator(SHELL_XTERM).focus()
    expect((await focusOf(win)).isShellXterm).toBe(true)
    const chunksBefore2 = loggerChunks(loggerOut).length
    await app.evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('app:open-settings')
    })
    await expect(win.locator('.settings-overlay')).toBeVisible({ timeout: 10_000 })
    await win.waitForTimeout(500)
    const focusOpen2 = await focusOf(win)
    await win.keyboard.press('Escape')
    const closed2 = await expect(win.locator('.settings-overlay')).toHaveCount(0, { timeout: 5_000 }).then(() => true, () => false)
    await win.waitForTimeout(1_000)
    const pty2 = loggerChunks(loggerOut).slice(chunksBefore2)
    const focusClosed2 = await focusOf(win)
    log(`② Settings open: focus ${JSON.stringify(focusOpen2)}; first Esc closed it: ${closed2}; PTY read after Esc: ${JSON.stringify(pty2)}; focus after close: ${JSON.stringify(focusClosed2)}`)
    await win.screenshot({ path: test.info().outputPath('2-after-esc.png') })
    expect(focusOpen2.inModal).toBe(true)
    expect(closed2).toBe(true)
    expect(pty2.some(hasEsc)).toBe(false)
    expect(focusClosed2.isShellXterm).toBe(true)
    results['②'] = `PASS — Settings (app:open-settings): focus ${JSON.stringify(focusOpen2)}; first Esc closed it; PTY read nothing; focus back in the shell xterm`
  } finally {
    log(`results: ${JSON.stringify(results)}`)
    if (inst) await closeIsolated(inst, log)
    for (const pid of serverPids) await killLeftoverServer(pid)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
