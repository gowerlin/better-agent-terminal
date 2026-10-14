// PLAN-040 / T0529: workspace-level default agent + agent launch args (D142).
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Every agent
// here is a custom CLI that runs a node script appending its argv (and BAT_TERMINAL_ID) to a
// temp jsonl — nothing starts an LLM, and the check does not depend on how a narrow PTY wraps. The helper
// (scripts/bat-terminal.mjs) talks only to the isolated instance's RemoteServer; its log goes to
// a temp directory.
//
// Global Settings: default agent ECHO_GLOBAL, args for both echo agents.
//   A (Tower A): agent ECHO_WS + override args       B (Tower B): follows Settings
//   C (no tabs): agent ECHO_WS + override args       D (no tabs): follows Settings
// Checked: helper `--agent default` / `--agent <id>` / raw command, the default Agent terminal a
// workspace opens with, and the Workspace Settings dialog writing straight into the registry.

import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0529')
const WS = { A: 'e2e-t0529-ws-a', B: 'e2e-t0529-ws-b', C: 'e2e-t0529-ws-c', D: 'e2e-t0529-ws-d' }
const TOWER_A = 'e2e-t0529-tower-a'
const TOWER_B = 'e2e-t0529-tower-b'
const ECHO_WS = 'e2e-t0529-echo-ws'
const ECHO_GLOBAL = 'e2e-t0529-echo-global'
const ARGS = {
  globalForGlobal: 'globalargs-t0529',
  globalForWs: 'globalargs-wsagent-t0529',
  wsA: 'wsA-args-t0529',
  wsC: 'wsC-args-t0529',
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

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

// argv[2] = the jsonl file, argv[3..] = what the launch command passed after it.
const DUMP_SCRIPT = [
  "import fs from 'node:fs'",
  "fs.appendFileSync(process.argv[2], JSON.stringify({ id: process.env.BAT_TERMINAL_ID ?? null, argv: process.argv.slice(3) }) + '\\n')",
  '',
].join('\n')

test('workspace agent + launch args reach helper --agent dispatch and new agent terminals', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0529-'))
  const folder = Object.fromEntries(Object.entries(WS).map(([k]) => [k, path.join(tmp, k.toLowerCase())])) as Record<keyof typeof WS, string>
  for (const dir of Object.values(folder)) fs.mkdirSync(dir, { recursive: true })
  const dumpScript = path.join(tmp, 'argv-dump.mjs').split(path.sep).join('/')
  const dumpFile = path.join(tmp, 'argv.jsonl').split(path.sep).join('/')
  fs.writeFileSync(dumpScript, DUMP_SCRIPT)
  const argvOf = (terminalId: string): string[] | null => {
    if (!fs.existsSync(dumpFile)) return null
    const lines = fs.readFileSync(dumpFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as { id: string | null; argv: string[] })
    return lines.find(l => l.id === terminalId)?.argv ?? null
  }
  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0529', log)
    const { app, win, userData, remotePort } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    for (const [id, word] of [[ECHO_WS, 't0529-ws-agent'], [ECHO_GLOBAL, 't0529-global-agent']]) {
      expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
        id, name: id, icon: 'E', color: '#888888', command: 'node', args: [dumpScript, dumpFile, word],
      })).toBeTruthy()
    }

    await win.evaluate(async (patch) => {
      const api = (window as AnyApi).electronAPI
      const raw = await api.settings.load()
      await api.settings.save(JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), ...patch }))
    }, {
      defaultAgent: ECHO_GLOBAL,
      agentCustomArgs: { [ECHO_GLOBAL]: ARGS.globalForGlobal, [ECHO_WS]: ARGS.globalForWs },
      createDefaultAgentTerminal: true,
      agentAutoCommand: true,
      defaultTerminalCount: 1,
    })
    const seed = {
      workspaces: [
        { id: WS.A, name: 'T0529-A', folderPath: folder.A, createdAt: Date.now(), defaultAgent: ECHO_WS, agentCustomArgs: { [ECHO_WS]: ARGS.wsA } },
        { id: WS.B, name: 'T0529-B', folderPath: folder.B, createdAt: Date.now() },
        { id: WS.C, name: 'T0529-C', folderPath: folder.C, createdAt: Date.now(), defaultAgent: ECHO_WS, agentCustomArgs: { [ECHO_WS]: ARGS.wsC } },
        { id: WS.D, name: 'T0529-D', folderPath: folder.D, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS.A,
      activeGroup: null,
      terminals: [
        { id: TOWER_A, workspaceId: WS.A, type: 'terminal', title: 'Tower A', cwd: folder.A },
        { id: TOWER_B, workspaceId: WS.B, type: 'terminal', title: 'Tower B', cwd: folder.B },
      ],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect(win.locator('.workspace-item', { hasText: 'T0529-D' })).toBeVisible({ timeout: 30_000 })

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

    // ── helper dispatch ──
    const fromA = await runHelper(env, ['--notify-id', TOWER_A, '--workspace', WS.A, '--skill', 'ct-exec', '--workorder', 'T0529'], folder.A)
    const fromB = await runHelper(env, ['--notify-id', TOWER_B, '--workspace', WS.B, '--skill', 'ct-exec', '--workorder', 'T0529'], folder.B)
    const explicitB = await runHelper(env, ['--notify-id', TOWER_B, '--workspace', WS.B, '--agent', ECHO_WS, '--skill', 'ct-exec', '--workorder', 'T0529'], folder.B)
    const rawA = await runHelper(env, ['--notify-id', TOWER_A, '--workspace', WS.A, 'node', dumpScript, dumpFile, 't0529-raw'], folder.A)
    for (const [name, run] of Object.entries({ fromA, fromB, explicitB, rawA })) {
      log(`${name}: exit=${run.code}\n${run.stdout}${run.stderr}`)
      expect(run.code, `${name}: ${run.stderr}`).toBe(0)
      expect(run.terminalId, name).toBeTruthy()
    }
    expect(fromA.stdout).toContain(`agent: ${ECHO_WS} (--agent default: the workspace's default agent)`)

    // A: workspace agent + workspace args (replacing the global args of that agent)
    await expect.poll(() => argvOf(fromA.terminalId!), { timeout: 30_000 }).toEqual(['t0529-ws-agent', ARGS.wsA, '/ct-exec T0529'])
    // B: follows Settings — global default agent + its global args
    await expect.poll(() => argvOf(fromB.terminalId!), { timeout: 30_000 }).toEqual(['t0529-global-agent', ARGS.globalForGlobal, '/ct-exec T0529'])
    // B, --agent <id>: no override in B → that agent's global args
    await expect.poll(() => argvOf(explicitB.terminalId!), { timeout: 30_000 }).toEqual(['t0529-ws-agent', ARGS.globalForWs, '/ct-exec T0529'])
    // raw command mode: run as given, nothing appended
    await expect.poll(() => argvOf(rawA.terminalId!), { timeout: 30_000 }).toEqual(['t0529-raw'])

    // ── default Agent terminal when a workspace opens (UI path) ──
    const agentTerminalOf = async (workspaceId: string, preset: string) => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      const entry = raw ? JSON.parse(raw) as { terminals: { id: string; workspaceId: string; agentPreset?: string }[] } : null
      return entry?.terminals.find(t => t.workspaceId === workspaceId && t.agentPreset === preset)?.id ?? null
    }
    await win.locator('.workspace-item', { hasText: 'T0529-C' }).click()
    await expect.poll(() => agentTerminalOf(WS.C, ECHO_WS), { timeout: 30_000 }).not.toBeNull()
    const agentC = (await agentTerminalOf(WS.C, ECHO_WS))!
    await expect.poll(() => argvOf(agentC), { timeout: 30_000 }).toEqual(['t0529-ws-agent', ARGS.wsC])

    await win.locator('.workspace-item', { hasText: 'T0529-D' }).click()
    await expect.poll(() => agentTerminalOf(WS.D, ECHO_GLOBAL), { timeout: 30_000 }).not.toBeNull()
    const agentD = (await agentTerminalOf(WS.D, ECHO_GLOBAL))!
    await expect.poll(() => argvOf(agentD), { timeout: 30_000 }).toEqual(['t0529-global-agent', ARGS.globalForGlobal])

    // ── Workspace Settings dialog writes straight into the registry main reads ──
    await win.locator('.workspace-item', { hasText: 'T0529-B' }).click({ button: 'right' })
    await win.locator('.context-menu-item', { hasText: /Workspace Settings|工作區設定|工作区设置/ }).click()
    const dialog = win.locator('.workspace-settings-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('workspace-effective-agent')).toContainText(ECHO_GLOBAL)
    await dialog.locator('#workspace-default-agent').selectOption('codex-cli')
    const codexRow = dialog.locator('.workspace-args-row[data-preset="codex-cli"]')
    await codexRow.locator('input[type="checkbox"]').check()
    await codexRow.locator('input[type="text"]').fill('--model dialog-t0529')
    const savedB = async () => {
      const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
      const entry = raw ? JSON.parse(raw) as { workspaces: Record<string, unknown>[] } : null
      const ws = entry?.workspaces.find(w => w.id === WS.B)
      return { defaultAgent: ws?.defaultAgent ?? null, agentCustomArgs: ws?.agentCustomArgs ?? null }
    }
    await expect.poll(savedB, { timeout: 10_000 }).toEqual({ defaultAgent: 'codex-cli', agentCustomArgs: { 'codex-cli': '--model dialog-t0529' } })
    // back to "follow global" for both
    await dialog.locator('#workspace-default-agent').selectOption('')
    await codexRow.locator('input[type="checkbox"]').uncheck()
    await expect.poll(savedB, { timeout: 10_000 }).toEqual({ defaultAgent: null, agentCustomArgs: null })
    await dialog.locator('.dialog-close-btn').click()

    const debug = readDebugLogs(userData)
    expect(debug).toContain(`[agent-command] resolved agent=default to ${ECHO_WS} source=workspace workspace=${WS.A} (T0529-A) workspaceSource=tower-terminal argsSource=workspace`)
    expect(debug).toContain(`[agent-command] resolved agent=default to ${ECHO_GLOBAL} source=settings workspace=${WS.B} (T0529-B) workspaceSource=tower-terminal argsSource=settings`)
  } finally {
    await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
