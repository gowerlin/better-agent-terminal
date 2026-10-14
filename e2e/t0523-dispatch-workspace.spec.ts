// T0523 / BUG-129: a Tower dispatch lands in the workspace its `--notify-id` terminal belongs
// to, and `--agent default` resolves against that workspace, even when `--workspace` (the Tower
// shell's BAT_WORKSPACE_ID) names another one.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Two
// workspaces: A (active) and B, whose default agent is a custom CLI that runs `echo` — nothing
// here starts an LLM. The Tower tab lives in B. The helper (scripts/bat-terminal.mjs) talks only
// to the isolated instance's RemoteServer; its log goes to a temp directory.

import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0523')
const WS_A = 'e2e-t0523-ws-a'
const WS_B = 'e2e-t0523-ws-b'
const TOWER = 'e2e-t0523-tower-b'
const ECHO_AGENT = 'e2e-t0523-echo-agent'

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

test('dispatch from a Tower tab in B with --workspace A lands in B and uses B\'s default agent', async () => {
  test.setTimeout(180_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0523-'))
  const folderA = path.join(tmp, 'a')
  const folderB = path.join(tmp, 'b')
  fs.mkdirSync(folderA, { recursive: true })
  fs.mkdirSync(folderB, { recursive: true })
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0523', log)
    const { app, win, userData, remotePort } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: ECHO_AGENT, name: 'T0523 echo', icon: 'E', color: '#888888', command: 'echo',
    })).toBeTruthy()
    const seed = {
      workspaces: [
        { id: WS_A, name: 'T0523-A', folderPath: folderA, createdAt: Date.now() },
        { id: WS_B, name: 'T0523-B', folderPath: folderB, createdAt: Date.now(), defaultAgent: ECHO_AGENT },
      ],
      activeWorkspaceId: WS_A,
      activeGroup: null,
      // The Tower tab: only its registry record matters here (it gets a PTY once B is opened).
      terminals: [{ id: TOWER, workspaceId: WS_B, type: 'terminal', title: 'Tower', cwd: folderB }],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-item', { hasText: 'T0523-B' })).toBeVisible({ timeout: 30_000 })

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

    // 1) Tower in B, stale --workspace A, --agent default (agent mode).
    const stale = await runHelper(env, ['--notify-id', TOWER, '--workspace', WS_A, '--skill', 'ct-exec', '--workorder', 'T0523'], folderB)
    log(`stale dispatch: exit=${stale.code}\n${stale.stdout}${stale.stderr}`)
    expect(stale.code, stale.stderr).toBe(0)
    expect(stale.stdout).toContain(`workspace: T0523-B (${WS_B}) — the Tower terminal's workspace (--notify-id)`)
    expect(stale.stdout).toContain(`agent: ${ECHO_AGENT} (--agent default: the workspace's default agent)`)
    expect(stale.stderr).toContain(`--workspace ${WS_A} is not the Tower terminal's workspace`)

    // 2) No tower, --workspace A, raw command mode → A as before.
    const plain = await runHelper(env, ['--workspace', WS_A, 'echo', 't0523-plain'], folderA)
    log(`plain dispatch: exit=${plain.code}\n${plain.stdout}${plain.stderr}`)
    expect(plain.code, plain.stderr).toBe(0)
    expect(plain.stdout).toContain(`workspace: T0523-A (${WS_A}) — from --workspace`)
    // T0527 / BUG-132: both ran from inside their landing workspace's folder → no cwd warning.
    expect(stale.stderr).not.toContain('is not under the landing workspace')
    expect(plain.stderr).not.toContain('is not under the landing workspace')

    // 3) T0527 / BUG-132: Tower in B, but the helper runs from A's folder (the agent CLI kept
    //    another tab's BAT_*), not yolo → still lands in B, with a warning naming A.
    const crossAsk = await runHelper(env, ['--notify-id', TOWER, '--workspace', WS_B, '--mode', 'ask', '--skill', 'ct-exec', '--workorder', 'T0527'], folderA)
    log(`cross-cwd ask dispatch: exit=${crossAsk.code}\n${crossAsk.stdout}${crossAsk.stderr}`)
    expect(crossAsk.code, crossAsk.stderr).toBe(0)
    expect(crossAsk.stdout).toContain(`workspace: T0523-B (${WS_B}) — the Tower terminal's workspace (--notify-id)`)
    expect(crossAsk.stderr).toContain(`cwd ${folderA} is not under the landing workspace's folder ${folderB}.`)
    expect(crossAsk.stderr).toContain(`It belongs to workspace "T0523-A" (${WS_A}).`)

    // 4) Same in yolo → refused, exit 1, nothing created.
    const crossYolo = await runHelper(env, ['--notify-id', TOWER, '--workspace', WS_B, '--mode', 'yolo', '--skill', 'ct-exec', '--workorder', 'T0527'], folderA)
    log(`cross-cwd yolo dispatch: exit=${crossYolo.code}\n${crossYolo.stdout}${crossYolo.stderr}`)
    expect(crossYolo.code).toBe(1)
    expect(crossYolo.stdout).not.toContain('Terminal created')
    expect(crossYolo.stderr).toContain(`Failed to create terminal (DISPATCH_CWD_OTHER_WORKSPACE): cwd ${folderA} belongs to workspace "T0523-A" (${WS_A})`)
    expect(crossYolo.stderr).toContain(`landing workspace: "T0523-B" (${WS_B})`)

    // 5) T0527: an unknown --agent says so (it used to be a bare terminal-not-created).
    const unknownAgent = await runHelper(env, ['--notify-id', TOWER, '--agent', 'no-such-agent-t0527', '--skill', 'ct-exec', '--workorder', 'T0527'], folderB)
    expect(unknownAgent.code).toBe(1)
    expect(unknownAgent.stderr).toContain("Failed to create terminal (AGENT_UNKNOWN): Unknown agent id 'no-such-agent-t0527'. Known agent ids: ")
    expect(unknownAgent.stderr).toContain(ECHO_AGENT)

    // The renderer put each tab where main said, and saved it.
    await expect.poll(async () => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      const entry = raw ? JSON.parse(raw) as { terminals: { id: string; workspaceId: string }[] } : null
      return [stale.terminalId, plain.terminalId, crossAsk.terminalId].map(id => entry?.terminals.find(t => t.id === id)?.workspaceId ?? null)
    }, { timeout: 20_000 }).toEqual([WS_B, WS_A, WS_B])

    const debug = readDebugLogs(userData)
    expect(debug).toContain(`[T0523] dispatch workspace mismatch: tower=${TOWER} belongs to workspace=${WS_B} (T0523-B), --workspace=${WS_A}`)
    expect(debug).toContain(`[agent-command] resolved agent=default to ${ECHO_AGENT} source=workspace workspace=${WS_B} (T0523-B) workspaceSource=tower-terminal`)
    expect(debug).toContain(`External terminal added: id=${stale.terminalId} cwd=${folderB} workspaceId(landed)=${WS_B} workspaceId(requested)=${WS_B} tower=${TOWER}`)
    expect(debug).toContain(`[BUG-132] dispatch cwd outside the landing workspace: cwd=${folderA} landing=${WS_B} (T0523-B) folderPath=${folderB} workspaceSource=tower-terminal cwdWorkspace=${WS_A} (T0523-A) mode=ask → created with a warning`)
    expect(debug).toContain(`cwdWorkspace=${WS_A} (T0523-A) mode=yolo → refused (yolo)`)
    // bat-scripts.log (temp BAT_USER_DATA of this test) records the check and the refusal.
    const scriptsLog = path.join(userData, 'Logs', 'bat-scripts.log')
    const checks = fs.existsSync(scriptsLog)
      ? fs.readFileSync(scriptsLog, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(e => e.event === 'dispatch-cwd-check')
      : []
    expect(checks.map(e => [e.status, e.action])).toEqual(expect.arrayContaining([['inside', 'proceed'], ['other-workspace', 'warn'], ['other-workspace', 'refuse']]))
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
