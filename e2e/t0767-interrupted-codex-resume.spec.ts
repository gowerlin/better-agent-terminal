// PLAN-055 B2 / T0767 (D211 P-4 a): after a Terminal Server recovery an interrupted codex tab resumes
// with `codex resume` — codex's own picker, filtered by the cwd — on a real isolated instance, with a
// stub codex.
//
//   - a stub `codex.exe` compiled here with the .NET Framework `csc`, first on the isolated BAT's PATH
//     (the version probes — `--no-daemon` for a tab, OSC 7501 for a dispatch — and the tabs' shells all
//     find it). It answers `--version` with `codex-cli 0.166.0`; any other call appends its argv to
//     `T0767_STUB_LOG`, writes one OSC 7501 `state=idle` (as codex does once its TUI is up), then waits.
//     No real codex, no login, no model. `CODEX_HOME` is a temp dir.
//   - one codex-cli tab the user opened (restored → the launch command typed into its shell), one plain
//     shell tab (the Tower), one Worker dispatched from it with `bat-terminal.mjs --skill ct-exec --agent
//     codex-cli`. The workspace's codex args are `--model e2e-t0767`.
//   - only the Terminal Server is killed (`taskkill /F`, T0704 e2e) → recovery (reason=ipc-exit).
//   - the dialog lists the codex tab and the Worker (resumable), not the shell; resume → the stub's argv
//     is the first launch's with `resume` inserted before the custom args (the Worker: without the
//     `$ct-exec` prompt), never `--last`; the marks go.
//   - run twice: BAT MCP on (`-c mcp_servers.bat.*`) and off (the tab gets `--no-daemon`, T0651 / T0758).
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Windows only.

import { test, expect, type Page } from '@playwright/test'
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

const log = testLogger('t0767')
const WS = 'e2e-t0767-ws'
const CODEX_TAB = 'e2e-t0767-codex'
const TOWER_TAB = 'e2e-t0767-tower'
const WORKORDER = 'T0767'
const CUSTOM_ARGS = ['--model', 'e2e-t0767']
const CSC = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')

const pathKey = Object.keys(process.env).find(k => k.toLowerCase() === 'path') ?? 'Path'
// `npx playwright` puts node_modules/.bin (the embedded codex's npm shim) on PATH; BAT started normally has none
const APP_PATH = (process.env[pathKey] ?? '').split(';').filter(d => !/node_modules[\\/]\.bin/i.test(d)).join(';')

const STUB_SOURCE = String.raw`
using System;
using System.IO;
using System.Text;
using System.Threading;

class StubCodex {
  static int Main(string[] args) {
    if (args.Length == 1 && (args[0] == "--version" || args[0] == "-V")) { Console.WriteLine("codex-cli 0.166.0"); return 0; }
    string tid = Environment.GetEnvironmentVariable("BAT_TERMINAL_ID") ?? "";
    StringBuilder sb = new StringBuilder();
    sb.Append("BEGIN\t").Append(tid).Append("\n");
    foreach (string a in args) sb.Append("ARG\t").Append(a).Append("\n");
    sb.Append("END\n");
    string logPath = Environment.GetEnvironmentVariable("T0767_STUB_LOG");
    if (logPath != null) File.AppendAllText(logPath, sb.ToString(), new UTF8Encoding(false));
    Console.Write("\u001b]7501;state=idle:app=codex\u0007");
    Console.WriteLine("t0767 stub codex ready");
    Thread.Sleep(Timeout.Infinite);
    return 0;
  }
}
`

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
    ? await app.evaluate(async ({ safeStorage }, data) => (await safeStorage.decryptStringAsync(Buffer.from(data, 'base64'))).result, record.data as string)
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

/** `args` with `resume` inserted right before the custom args. */
function withResumeBeforeCustomArgs(args: string[]): string[] {
  const at = args.indexOf(CUSTOM_ARGS[0])
  expect(at, JSON.stringify(args)).toBeGreaterThan(0)
  expect(args.slice(at, at + CUSTOM_ARGS.length)).toEqual(CUSTOM_ARGS)
  return [...args.slice(0, at), 'resume', ...args.slice(at)]
}

const row = (win: Page, id: string) => win.locator(`.interrupted-agents-dialog li[data-terminal-id="${id}"]`)

test.skip(process.platform !== 'win32', 'stub codex.exe compiled with the .NET Framework csc (Windows)')

for (const batMcp of [true, false]) {
  test(`a recovery lists the interrupted codex tab and Worker; resume runs \`codex resume\` the usual way (BAT MCP ${batMcp ? 'on' : 'off'})`, async () => {
    test.setTimeout(300_000)
    test.skip(!fs.existsSync(CSC), `no .NET Framework csc at ${CSC}`)
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0767-'))
    const folder = path.join(tmp, 'ws')
    const stubDir = path.join(tmp, 'stub')
    const stubLog = path.join(tmp, 'stub-argv.log')
    const codexHome = path.join(tmp, 'codex-home')
    fs.mkdirSync(folder, { recursive: true })
    fs.mkdirSync(stubDir, { recursive: true })
    fs.mkdirSync(codexHome, { recursive: true })
    fs.writeFileSync(path.join(stubDir, 'stub.cs'), STUB_SOURCE)
    const stubExe = path.join(stubDir, 'codex.exe')
    await run(CSC, ['/nologo', `/out:${stubExe}`, path.join(stubDir, 'stub.cs')], 60_000)
    expect((await run(stubExe, ['--version'])).trim()).toBe('codex-cli 0.166.0')

    let inst: IsolatedInstance | undefined
    const serverPids: number[] = []
    try {
      inst = await launchIsolated(`t0767-${batMcp ? 'mcp' : 'nomcp'}`, log, { env: { PATH: `${stubDir};${APP_PATH}`, CODEX_HOME: codexHome, T0767_STUB_LOG: stubLog } })
      const { win, userData } = inst
      await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
      const loaded = await win.evaluate(async () => (window as AnyApi).electronAPI.settings.load())
      const settings = typeof loaded === 'string' && loaded ? JSON.parse(loaded) : (loaded ?? {})
      await win.evaluate(async (data) => (window as AnyApi).electronAPI.settings.save(data), JSON.stringify({ ...settings, batMcpEnabled: batMcp }))
      const seed = {
        workspaces: [{ id: WS, name: 'T0767', folderPath: folder, createdAt: Date.now(), agentCustomArgs: { 'codex-cli': CUSTOM_ARGS.join(' ') } }],
        activeWorkspaceId: WS,
        activeGroup: null,
        terminals: [
          { id: CODEX_TAB, workspaceId: WS, type: 'terminal', agentPreset: 'codex-cli', title: 'Codex CLI', cwd: folder },
          { id: TOWER_TAB, workspaceId: WS, type: 'terminal', title: 'Tower', cwd: folder },
        ],
        activeTerminalId: null,
      }
      expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
      await win.reload()
      await win.waitForLoadState('domcontentloaded')

      // the restored codex-cli tab launches the stub with BAT's args and the custom args
      await expect.poll(() => callsOf(stubLog, CODEX_TAB).length, { timeout: 60_000 }).toBe(1)
      const firstLaunch = callsOf(stubLog, CODEX_TAB)[0].args
      log(`codex tab first launch argv: ${JSON.stringify(firstLaunch)}`)
      expect(firstLaunch).not.toContain('resume')
      if (batMcp) expect(firstLaunch.some(a => a.startsWith('mcp_servers.bat.command='))).toBe(true)
      else expect(firstLaunch).toContain('--no-daemon')

      // a Worker dispatched from the Tower tab
      const env = await helperEnv(inst, tmp)
      const dispatched = await runHelper(env, ['--notify-id', TOWER_TAB, '--workspace', WS, '--skill', 'ct-exec', '--workorder', WORKORDER, '--agent', 'codex-cli'], folder)
      log(`dispatch: exit=${dispatched.code}\n${dispatched.stdout}${dispatched.stderr}`)
      expect(dispatched.code, dispatched.stderr).toBe(0)
      const worker = dispatched.terminalId!
      await expect.poll(() => callsOf(stubLog, worker).length, { timeout: 60_000 }).toBe(1)
      const workerFirst = callsOf(stubLog, worker)[0].args
      log(`worker first launch argv: ${JSON.stringify(workerFirst)}`)
      expect(workerFirst[workerFirst.length - 1]).toMatch(new RegExp(`^\\$(ct:)?ct-exec ${WORKORDER}$`))
      await expect.poll(() => readDebugLogs(userData), { timeout: 30_000 }).toContain(`[agent-start] terminal=${worker} → started`)
      await expect(win.locator(`.workspace-container.active .terminal-wrapper`)).toHaveCount(3, { timeout: 30_000 })

      // only the Terminal Server dies
      const server = readPid(userData)!
      expect(server).not.toBeNull()
      serverPids.push(server)
      await run('taskkill', ['/F', '/PID', String(server)])
      log(`killed Terminal Server ${server} (no /T)`)
      await expect.poll(() => readDebugLogs(userData), { timeout: 30_000 }).toContain('[PtyManager] Terminal Server recovery complete')
      const newServer = readPid(userData)
      if (newServer) serverPids.push(newServer)
      const debug = readDebugLogs(userData)
      log(`interrupted-agents lines:\n${debug.split('\n').filter(l => l.includes('[interrupted-agents]')).join('\n')}`)
      expect(debug).toContain(`[interrupted-agents] interrupted: terminal=${CODEX_TAB} agent=codex-cli launchedBy=tab session=unknown`)
      expect(debug).toContain(`[interrupted-agents] interrupted: terminal=${worker} agent=codex-cli launchedBy=dispatch workorder=${WORKORDER} session=unknown`)

      // the dialog: both codex rows resumable (codex's resume menu), not the shell; ⏸ on both thumbnails
      await expect(win.locator('.interrupted-agents-dialog')).toBeVisible({ timeout: 15_000 })
      await expect(row(win, CODEX_TAB)).toHaveAttribute('data-resumable', 'true')
      await expect(row(win, worker)).toHaveAttribute('data-resumable', 'true')
      await expect(row(win, TOWER_TAB)).toHaveCount(0)
      await expect(win.locator('.interrupted-agent-badge')).toHaveCount(2)
      await win.screenshot({ path: test.info().outputPath('dialog.png') })

      // resume the codex tab: ⏻'s path, the same command with `resume` before the custom args
      await row(win, CODEX_TAB).locator('[data-action="resume"]').click()
      await expect.poll(() => callsOf(stubLog, CODEX_TAB).length, { timeout: 60_000 }).toBe(2)
      const resumed = callsOf(stubLog, CODEX_TAB)[1].args
      log(`codex tab resume argv: ${JSON.stringify(resumed)}`)
      expect(resumed).toEqual(withResumeBeforeCustomArgs(firstLaunch))
      expect(resumed).not.toContain('--last')
      await expect(row(win, CODEX_TAB)).toHaveCount(0)

      // resume the Worker: main's dispatch builder — the same command, no prompt, `resume` before the custom args
      await row(win, worker).locator('[data-action="resume"]').click()
      await expect.poll(() => callsOf(stubLog, worker).length, { timeout: 60_000 }).toBe(2)
      const workerResumed = callsOf(stubLog, worker)[1].args
      log(`worker resume argv: ${JSON.stringify(workerResumed)}`)
      expect(workerResumed).toEqual(withResumeBeforeCustomArgs(workerFirst.slice(0, -1)))
      expect(workerResumed).not.toContain('--last')
      expect(workerResumed.some(a => a.includes('ct-exec'))).toBe(false)
      expect(readDebugLogs(userData)).toContain(`[interrupted-agents] resumed dispatch: terminal=${worker} agent=codex-cli launchedBy=dispatch workorder=${WORKORDER} session=unknown mode=picker`)

      // the list is empty: dialog and marks gone
      await expect(win.locator('.interrupted-agents-dialog')).toHaveCount(0, { timeout: 15_000 })
      await expect(win.locator('.interrupted-agent-badge')).toHaveCount(0)
      await win.screenshot({ path: test.info().outputPath('after-resume.png') })
    } finally {
      if (inst) await closeIsolated(inst, log)
      for (const pid of serverPids) await killLeftoverServer(pid)
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
}
