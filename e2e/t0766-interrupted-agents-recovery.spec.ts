// PLAN-055 B1 / T0766: after a Terminal Server recovery the interrupted agent tabs are listed and a
// claude tab resumes with `--resume=<id>` — on a real isolated instance, with a stub claude.
//
//   - Claude Runtime = system, customPath = a stub `claude.exe` compiled here with the .NET Framework
//     `csc` (an .exe: the runtime probe and the `--name` version check spawn it without a shell). It
//     answers `--version` with `2.1.316 (Claude Code)`; any other call appends its argv to
//     `T0766_STUB_LOG`, reports `SessionStart` through BAT's own `bat-hook.mjs session-start` (the tab's
//     scoped token, as claude's hook would) with a session id = the `--resume=` value or one derived
//     from `BAT_TERMINAL_ID`, then waits. No real claude, no login.
//   - one claude-cli tab the user opened (restored → `startClaudeCliPty`), one plain shell tab (the
//     Tower), one Worker dispatched from it with `bat-terminal.mjs --skill ct-exec --agent claude-cli`.
//   - only the Terminal Server is killed (`taskkill /F`, T0704 e2e) → recovery (reason=ipc-exit).
//   - the dialog lists the claude tab and the Worker, not the shell; both thumbnails show ⏸; resume →
//     the stub's argv has `--resume=<id>` with BAT's `--mcp-config=` / `--settings=` / `--name=` (the
//     Worker: no `/ct-exec` prompt), `SessionStart` comes back, the marks go.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only.

import { test, expect, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  REPO_ROOT,
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

const log = testLogger('t0766')
const WS = 'e2e-t0766-ws'
const CLAUDE_TAB = 'e2e-t0766-claude'
const TOWER_TAB = 'e2e-t0766-tower'
const WORKORDER = 'T0766'
const CSC = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')

const STUB_SOURCE = String.raw`
using System;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

class StubClaude {
  static int Main(string[] args) {
    if (args.Length == 1 && args[0] == "--version") { Console.WriteLine("2.1.316 (Claude Code)"); return 0; }
    string tid = Environment.GetEnvironmentVariable("BAT_TERMINAL_ID") ?? "";
    string session = null;
    foreach (string a in args) if (a.StartsWith("--resume=")) session = a.Substring(9);
    if (session == null) {
      string hex = BitConverter.ToString(MD5.Create().ComputeHash(Encoding.UTF8.GetBytes(tid))).Replace("-", "").ToLowerInvariant();
      session = hex.Substring(0, 8) + "-" + hex.Substring(8, 4) + "-4" + hex.Substring(13, 3) + "-8" + hex.Substring(17, 3) + "-" + hex.Substring(20, 12);
    }
    StringBuilder sb = new StringBuilder();
    sb.Append("BEGIN\t").Append(tid).Append("\n");
    foreach (string a in args) sb.Append("ARG\t").Append(a).Append("\n");
    sb.Append("END\n");
    string logPath = Environment.GetEnvironmentVariable("T0766_STUB_LOG");
    if (logPath != null) File.AppendAllText(logPath, sb.ToString(), new UTF8Encoding(false));
    string helper = Environment.GetEnvironmentVariable("BAT_HELPER_DIR");
    if (helper != null) {
      ProcessStartInfo psi = new ProcessStartInfo("node", "\"" + Path.Combine(helper, "bat-hook.mjs") + "\" session-start");
      psi.UseShellExecute = false;
      psi.RedirectStandardInput = true;
      psi.CreateNoWindow = true;
      Process p = Process.Start(psi);
      p.StandardInput.Write("{\"hook_event_name\":\"SessionStart\",\"session_id\":\"" + session + "\"}");
      p.StandardInput.Close();
      p.WaitForExit(10000);
    }
    Console.WriteLine("t0766 stub claude ready");
    Thread.Sleep(Timeout.Infinite);
    return 0;
  }
}
`

/** The session id the stub derives for a terminal (same formula). */
function stubSessionId(terminalId: string): string {
  const hex = createHash('md5').update(terminalId, 'utf8').digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** The stub's invocations: terminal id + argv, in order. */
function stubCalls(logPath: string): Array<{ terminalId: string; args: string[] }> {
  if (!fs.existsSync(logPath)) return []
  const calls: Array<{ terminalId: string; args: string[] }> = []
  let current: { terminalId: string; args: string[] } | null = null
  for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
    if (line.startsWith('BEGIN\t')) current = { terminalId: line.slice(6), args: [] }
    else if (line.startsWith('ARG\t') && current) current.args.push(line.slice(4))
    else if (line === 'END' && current) { calls.push(current); current = null }
  }
  return calls
}

const callsOf = (logPath: string, id: string) => stubCalls(logPath).filter(c => c.terminalId === id)

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

const count = (text: string, needle: string) => text.split(needle).length - 1

interface HelperRun { code: number | null; stdout: string; stderr: string; terminalId?: string }

function runHelper(env: NodeJS.ProcessEnv, args: string[], cwd: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(REPO_ROOT, 'scripts', 'bat-terminal.mjs'), ...args], { env, cwd, timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      const errCode = (err as { code?: unknown } | null)?.code
      const code = !err ? 0 : typeof errCode === 'number' ? errCode : -1
      resolve({ code, stdout: String(stdout), stderr: String(stderr), terminalId: /Terminal created: (\S+)/.exec(String(stdout))?.[1] })
    })
  })
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

async function helperEnv(inst: IsolatedInstance, tmp: string): Promise<NodeJS.ProcessEnv> {
  const { app, userData, remotePort } = inst
  await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
  const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
  const token: string = record.encrypted
    ? await app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(Buffer.from(data, 'base64')), record.data as string)
    : record.data
  const env: NodeJS.ProcessEnv = {}
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) env[k] = v
  Object.assign(env, {
    BAT_REMOTE_PORT: String(remotePort),
    BAT_REMOTE_TOKEN: token,
    BAT_SERVER_CERT_PATH: path.join(userData, 'server-cert.json'),
    BAT_HELPER_LOG_DIR: path.join(tmp, 'helper-logs'),
    BAT_USER_DATA: tmp,
  })
  return env
}

const row = (win: Page, id: string) => win.locator(`.interrupted-agents-dialog li[data-terminal-id="${id}"]`)

test.skip(process.platform !== 'win32', 'stub claude.exe compiled with the .NET Framework csc (Windows)')

test('a recovery lists the interrupted claude tab and Worker; resume adds --resume=<id> to the usual launch', async () => {
  test.setTimeout(300_000)
  test.skip(!fs.existsSync(CSC), `no .NET Framework csc at ${CSC}`)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0766-'))
  const folder = path.join(tmp, 'ws')
  const stubDir = path.join(tmp, 'stub')
  const stubLog = path.join(tmp, 'stub-argv.log')
  fs.mkdirSync(folder, { recursive: true })
  fs.mkdirSync(stubDir, { recursive: true })
  fs.writeFileSync(path.join(stubDir, 'stub.cs'), STUB_SOURCE)
  const stubExe = path.join(stubDir, 'claude.exe')
  await run(CSC, ['/nologo', `/out:${stubExe}`, path.join(stubDir, 'stub.cs')], 60_000)
  expect((await run(stubExe, ['--version'])).trim()).toBe('2.1.316 (Claude Code)')

  let inst: IsolatedInstance | undefined
  const serverPids: number[] = []
  try {
    inst = await launchIsolated('t0766', log, { env: { T0766_STUB_LOG: stubLog } })
    const { win, userData } = inst
    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const loaded = await win.evaluate(async () => (window as AnyApi).electronAPI.settings.load())
    const settings = typeof loaded === 'string' && loaded ? JSON.parse(loaded) : (loaded ?? {})
    await win.evaluate(async (data) => (window as AnyApi).electronAPI.settings.save(data), JSON.stringify({
      ...settings,
      claudeRuntime: { mode: 'system', customPath: stubExe, fallbackToEmbedded: false },
    }))
    const seed = {
      workspaces: [{ id: WS, name: 'T0766', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: CLAUDE_TAB, workspaceId: WS, type: 'terminal', agentPreset: 'claude-cli', title: 'Claude CLI', cwd: folder },
        { id: TOWER_TAB, workspaceId: WS, type: 'terminal', title: 'Tower', cwd: folder },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')

    // the restored claude-cli tab launches the stub with BAT's args; its SessionStart comes back
    await expect.poll(() => callsOf(stubLog, CLAUDE_TAB).length, { timeout: 60_000 }).toBe(1)
    const firstLaunch = callsOf(stubLog, CLAUDE_TAB)[0].args
    log(`claude tab first launch argv: ${JSON.stringify(firstLaunch)}`)
    expect(firstLaunch.some(a => a.startsWith('--resume'))).toBe(false)
    await expect.poll(() => readDebugLogs(userData), { timeout: 30_000 }).toContain(`[agent-start] terminal=${CLAUDE_TAB} → started (hook session-start) session=${stubSessionId(CLAUDE_TAB).slice(0, 8)}`)

    // a Worker dispatched from the Tower tab
    const env = await helperEnv(inst, tmp)
    const dispatched = await runHelper(env, ['--notify-id', TOWER_TAB, '--workspace', WS, '--skill', 'ct-exec', '--workorder', WORKORDER, '--agent', 'claude-cli'], folder)
    log(`dispatch: exit=${dispatched.code}\n${dispatched.stdout}${dispatched.stderr}`)
    expect(dispatched.code, dispatched.stderr).toBe(0)
    const worker = dispatched.terminalId!
    await expect.poll(() => callsOf(stubLog, worker).length, { timeout: 60_000 }).toBe(1)
    expect(callsOf(stubLog, worker)[0].args).toContain(`/ct-exec ${WORKORDER}`)
    await expect.poll(() => readDebugLogs(userData), { timeout: 30_000 }).toContain(`[agent-start] terminal=${worker} → started (hook session-start)`)
    await expect(win.locator(`.workspace-container.active .terminal-wrapper`)).toHaveCount(3, { timeout: 30_000 })

    // only the Terminal Server dies
    const server = readPid(userData)!
    expect(server).not.toBeNull()
    serverPids.push(server)
    await run('taskkill', ['/F', '/PID', String(server)])
    log(`killed Terminal Server ${server} (no /T)`)
    await expect.poll(() => readDebugLogs(userData), { timeout: 30_000 }).toContain('[PtyManager] Terminal Server recovery complete')
    expect(readDebugLogs(userData)).toContain('attempting recovery... (reason=ipc-exit)')
    const newServer = readPid(userData)
    if (newServer) serverPids.push(newServer)
    const debug = readDebugLogs(userData)
    log(`interrupted-agents lines:\n${debug.split('\n').filter(l => l.includes('[interrupted-agents]')).join('\n')}`)
    expect(debug).toContain(`[interrupted-agents] interrupted: terminal=${CLAUDE_TAB} agent=claude-cli launchedBy=tab session=${stubSessionId(CLAUDE_TAB).slice(0, 8)}`)
    expect(debug).toContain(`[interrupted-agents] interrupted: terminal=${worker} agent=claude-cli launchedBy=dispatch workorder=${WORKORDER} session=${stubSessionId(worker).slice(0, 8)}`)
    expect(debug).not.toContain(stubSessionId(CLAUDE_TAB)) // logs carry the first 8 characters only

    // the session ids survive the recovery in claude-sessions.json
    const store = JSON.parse(fs.readFileSync(path.join(userData, 'claude-sessions.json'), 'utf8'))
    expect(store.interrupted.map((e: { terminalId: string; sessionId: string }) => [e.terminalId, e.sessionId]).sort()).toEqual(
      [[CLAUDE_TAB, stubSessionId(CLAUDE_TAB)], [worker, stubSessionId(worker)]].sort(),
    )

    // the dialog: the claude tab and the Worker, not the shell; ⏸ on both thumbnails
    await expect(win.locator('.interrupted-agents-dialog')).toBeVisible({ timeout: 15_000 })
    await expect(row(win, CLAUDE_TAB)).toBeVisible()
    await expect(row(win, worker)).toBeVisible()
    await expect(row(win, TOWER_TAB)).toHaveCount(0)
    await expect(win.locator('.interrupted-agent-badge')).toHaveCount(2)
    await win.screenshot({ path: test.info().outputPath('dialog.png') })

    // resume the claude tab: startClaudeCliPty with --resume=<id> after BAT's args
    await row(win, CLAUDE_TAB).locator('[data-action="resume"]').click()
    await expect.poll(() => callsOf(stubLog, CLAUDE_TAB).length, { timeout: 60_000 }).toBe(2)
    const resumed = callsOf(stubLog, CLAUDE_TAB)[1].args
    log(`claude tab resume argv: ${JSON.stringify(resumed)}`)
    expect(resumed).toContain(`--resume=${stubSessionId(CLAUDE_TAB)}`)
    expect(resumed.some(a => a.startsWith('--mcp-config='))).toBe(true)
    expect(resumed.some(a => a.startsWith('--settings='))).toBe(true)
    const nameArg = firstLaunch.find(a => a.startsWith('--name='))
    expect(nameArg).toBeTruthy()
    expect(resumed).toContain(nameArg)
    expect(resumed.indexOf(`--resume=${stubSessionId(CLAUDE_TAB)}`)).toBeGreaterThan(resumed.indexOf(nameArg!))
    expect(resumed).not.toContain('--fork-session')
    await expect.poll(() => count(readDebugLogs(userData), `[agent-start] terminal=${CLAUDE_TAB} → started`), { timeout: 30_000 }).toBe(2)
    await expect(row(win, CLAUDE_TAB)).toHaveCount(0)

    // resume the Worker: main's dispatch builder, no prompt
    await row(win, worker).locator('[data-action="resume"]').click()
    await expect.poll(() => callsOf(stubLog, worker).length, { timeout: 60_000 }).toBe(2)
    const workerResumed = callsOf(stubLog, worker)[1].args
    log(`worker resume argv: ${JSON.stringify(workerResumed)}`)
    expect(workerResumed).toContain(`--resume=${stubSessionId(worker)}`)
    expect(workerResumed.some(a => a.startsWith('--mcp-config='))).toBe(true)
    expect(workerResumed.some(a => a.includes('/ct-exec'))).toBe(false)
    expect(workerResumed).toContain(callsOf(stubLog, worker)[0].args.find(a => a.startsWith('--name=')))
    await expect.poll(() => count(readDebugLogs(userData), `[agent-start] terminal=${worker} → started`), { timeout: 30_000 }).toBe(2)

    // the list is empty: dialog and marks gone, nothing left in claude-sessions.json
    await expect(win.locator('.interrupted-agents-dialog')).toHaveCount(0, { timeout: 15_000 })
    await expect(win.locator('.interrupted-agent-badge')).toHaveCount(0)
    await expect.poll(() => JSON.parse(fs.readFileSync(path.join(userData, 'claude-sessions.json'), 'utf8')).interrupted, { timeout: 15_000 }).toBeUndefined()
    await win.screenshot({ path: test.info().outputPath('after-resume.png') })
  } finally {
    if (inst) await closeIsolated(inst, log)
    for (const pid of serverPids) await killLeftoverServer(pid)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
