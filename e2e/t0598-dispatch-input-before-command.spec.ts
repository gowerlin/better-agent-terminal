// BUG-151 / T0598: a helper dispatch into a Git Bash tab (settings.json `shell = "git-bash"`).
//
// The dispatched tab takes the keyboard focus when it lands in the active workspace (BUG-135 /
// T0532), and main writes the launch command 500 ms after the PTY is created. Whatever the user
// typed in between went to the new shell first: `, ` typed into the Tower tab became
// `, 'C:\…\claude.exe' …` → `bash: ,: command not found`, and the Worker never started (helper
// exit 0). Since T0598 input that reaches the tab before the command waits and follows it.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The agent is
// a custom CLI running `echo` — nothing here starts an LLM. The stray input is written the way
// xterm writes a keystroke (`pty.write` from the renderer), 150 ms after the tab was added.

import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0598')
const WS = 'e2e-t0598-ws'
const TOWER = 'e2e-t0598-tower'
const ECHO_AGENT = 'e2e-t0598-echo-agent'
const MARKER = 'T0598-MARKER'
const STRAY = ', '
const GIT_BASH_CANDIDATES = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  `${process.env.LOCALAPPDATA ?? ''}\\Programs\\Git\\bin\\bash.exe`,
]

test.skip(process.platform !== 'win32', 'settings.json `shell = "git-bash"` is a Windows setting')
test.skip(!GIT_BASH_CANDIDATES.some(p => fs.existsSync(p)), 'Git for Windows bash.exe is not installed')

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

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

const plain = (s: string) => s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')

test('git-bash dispatch: input typed into the new tab before the command does not break the launch', async () => {
  test.setTimeout(180_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0598-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0598', log)
    const { app, win, userData, remotePort } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    await win.evaluate(async () => {
      const api = (window as AnyApi).electronAPI
      const current = JSON.parse((await api.settings.load()) || '{}')
      await api.settings.save(JSON.stringify({ ...current, shell: 'git-bash', customShellPath: '' }))
    })
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: ECHO_AGENT, name: 'T0598 echo', icon: 'E', color: '#888888', command: 'echo', args: [MARKER],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0598', folderPath: folder, createdAt: Date.now() }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'Tower', cwd: folder }],
      activeTerminalId: TOWER,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TOWER), { timeout: 30_000 }).not.toBeNull()

    await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
    const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
    const token: string = record.encrypted
      ? await app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(Buffer.from(data, 'base64')), record.data as string)
      : record.data

    // The renderer collects every tab's output and, like a keystroke in the freshly focused tab,
    // writes STRAY into the dispatched tab 150 ms after it was added (main writes at 500 ms).
    await win.evaluate((stray) => {
      const w = window as AnyApi
      const api = w.electronAPI
      w.__t0598Out = {} as Record<string, string>
      api.pty.onOutput((id: string, data: string) => { w.__t0598Out[id] = (w.__t0598Out[id] ?? '') + data })
      w.__t0598Typed = new Promise<string>((resolve) => {
        const off = api.pty.onCreatedExternally((info: { id: string }) => {
          off()
          setTimeout(() => { void api.pty.write(info.id, stray).then(() => resolve(info.id)) }, 150)
        })
      })
    }, STRAY)

    const env: NodeJS.ProcessEnv = {}
    for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) env[k] = v
    Object.assign(env, {
      BAT_REMOTE_PORT: String(remotePort),
      BAT_REMOTE_TOKEN: token,
      BAT_SERVER_CERT_PATH: path.join(userData, 'server-cert.json'),
      BAT_HELPER_LOG_DIR: path.join(tmp, 'helper-logs'),
      BAT_USER_DATA: tmp,
    })
    const run = await runHelper(env, ['--notify-id', TOWER, '--workspace', WS, '--mode', 'yolo', '--agent', ECHO_AGENT, '--skill', 'ct-exec', '--workorder', 'T0598'], folder)
    log(`dispatch: exit=${run.code}\n${run.stdout}${run.stderr}`)
    expect(run.code, run.stderr).toBe(0)
    const worker = run.terminalId
    expect(worker).toBeTruthy()
    expect(await win.evaluate(() => (window as AnyApi).__t0598Typed)).toBe(worker)

    // The command ran: echo printed the marker and the prompt (`/ct-exec T0598`) on a line of its own.
    const output = async () => plain(await win.evaluate((id) => (window as AnyApi).__t0598Out[id] ?? '', worker))
    try {
      await expect.poll(async () => (await output()).split(/\r?\n/).some(l => l.trim() === `${MARKER} /ct-exec T0598`), { timeout: 30_000 }).toBe(true)
    } finally {
      log(`worker output:\n${await output()}`)
    }
    const text = await output()
    expect(text).not.toContain('command not found')
    // the stray input followed the command (it waits at the next prompt, no Enter)
    const commandLine = text.indexOf(`echo ${MARKER}`)
    expect(commandLine).toBeGreaterThanOrEqual(0)
    expect(text.lastIndexOf(STRAY.trim())).toBeGreaterThan(commandLine)

    const debug = readDebugLogs(userData)
    expect(debug).toContain(`[agent-command] id=${worker} shell family=posix from=persisted`)
    expect(debug).toMatch(new RegExp(`shell-resolution channel=terminal:create-with-command id=${worker} basename=bash\\.exe persistedShell=git-bash source=persisted fallback=no spawn=bash\\.exe`))
    expect(debug).toContain(`[agent-command] id=${worker} input before the dispatch command: 1 write(s), ${STRAY.length} bytes → sent after it`)
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
