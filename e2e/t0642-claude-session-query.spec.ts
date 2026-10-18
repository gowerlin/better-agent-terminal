// PLAN-050 / T0642 (D167): `claudeSessionName` / `claudeSessionId` through the Tower's MCP, end to
// end in an isolated BAT, across a BAT restart that keeps the Terminal Server.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Every helper
// runs INSIDE a tab with that tab's own env, through a node runner that records results to a JSON
// file. The "claude" of each tab is that runner calling `node $BAT_HELPER_DIR/bat-hook.mjs
// session-start` with claude's SessionStart JSON on stdin, as claude does for the hook BAT injects.
// Nothing starts an LLM.
//
//   1. the Tower tab gets a claude-cli launch decision (`agent:bat-mcp-launch-args` with a session
//      name → the T0641 record), its "claude" runs SessionStart (session id T), it declares itself
//      tower and dispatches a Worker (custom CLI: no `--name`) whose "claude" runs SessionStart
//      (session id W)
//   2. the Tower's MCP: bat_whoami (its name + T), bat_get_state of the Worker (name null + W),
//      bat_list_terminals (both rows); hooks exit 0 with nothing on stdout; a second SessionStart of
//      the Worker (`source: clear`, session id W2) replaces W and keeps agentStartedAt
//   3. `claude-sessions.json` holds both tabs, no token; logs carry the session ids' first 8
//      characters only
//   4. quit WITHOUT stopping the Terminal Server, relaunch, recover: `[claude-session] kept
//      restored`; the Tower's MCP (its pre-restart token, the new port) reads the name and both
//      session ids again
//   5. teardown stops the Terminal Server and removes the runtime userData

import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
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

const log = testLogger('t0642')
const WS = 'e2e-t0642-ws'
const TOWER = 'e2e-t0642-tower'
const WORKER_AGENT = 'e2e-t0642-worker'
const TOWER_NAME = 'T0642 · Tower'
const SID_T = '7a0c41f2-3b5d-4e6f-8a9b-0c1d2e3f4a5b'
const SID_W = 'c9d8e7f6-a5b4-4c3d-9e2f-1a0b9c8d7e6f'
const SID_W2 = '5e4d3c2b-1a09-4f8e-b7d6-c5b4a3928170'
const SECRET = 'T0642-SECRET-TRANSCRIPT'
const MODERN = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }
const STORE = 'claude-sessions.json'

interface McpReply { id: number; result?: Record<string, unknown>; error?: { code: number; message: string } }
interface StepResult {
  kind: string
  code?: number | null
  stdout?: string
  stderr?: string
  ms?: number
  terminalId?: string
  token?: string
  replies?: McpReply[]
}

/**
 * The runner of e2e/t0600 (env / helper / hook / mcp steps) + `spec.port`, which replaces
 * BAT_REMOTE_PORT (the relaunched isolated instance listens elsewhere; e2e/t0576).
 */
const RUNNER = `
const fs = require('fs')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const env = { ...process.env }
if (spec.port) env.BAT_REMOTE_PORT = String(spec.port)
const sub = s => String(s).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || '')
const subAll = v => typeof v === 'string' ? sub(v) : Array.isArray(v) ? v.map(subAll) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subAll(x)])) : v
const out = sub(spec.out)
const results = []
const flush = () => { fs.writeFileSync(out + '.tmp', JSON.stringify(results, null, 2)); fs.renameSync(out + '.tmp', out) }

function mcp(requests) {
  return new Promise(resolve => {
    const res = { kind: 'mcp', replies: [], stderr: '' }
    const child = spawn(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-mcp.mjs')], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    const timer = setTimeout(() => { res.stderr += 'runner timeout'; child.kill() }, 90000)
    let buf = ''
    let i = 0
    const next = () => {
      if (i >= requests.length) { child.stdin.end(); return }
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, ...subAll(requests[i]) }) + '\\n')
      i++
    }
    child.stdout.on('data', d => {
      buf += d
      let nl
      while ((nl = buf.indexOf('\\n')) !== -1) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        res.replies.push(JSON.parse(line))
        next()
      }
    })
    child.stderr.on('data', d => { res.stderr += d })
    child.on('exit', code => { clearTimeout(timer); res.code = code; resolve(res) })
    next()
  })
}

;(async () => {
  for (const step of spec.steps) {
    if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs))
    if (step.kind === 'env') {
      results.push({ kind: 'env', terminalId: env.BAT_TERMINAL_ID, token: env.BAT_REMOTE_TOKEN })
    } else if (step.kind === 'helper') {
      const started = Date.now()
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...step.args.map(sub)], { env, encoding: 'utf8', timeout: 60000, windowsHide: true })
      results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr, ms: Date.now() - started })
    } else if (step.kind === 'hook') {
      const started = Date.now()
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-hook.mjs'), step.event], { env, input: JSON.stringify(step.input), encoding: 'utf8', timeout: 30000, windowsHide: true })
      results.push({ kind: 'hook', code: run.status, stdout: run.stdout, stderr: run.stderr, ms: Date.now() - started })
    } else if (step.kind === 'mcp') {
      results.push(await mcp(step.requests))
    }
    flush()
  }
})()
`

const call = (name: string, args: Record<string, unknown> = {}) => ({ method: 'tools/call', params: { name, arguments: args, ...MODERN } })
const sessionStart = (sessionId: string, source: string) => ({
  kind: 'hook',
  event: 'session-start',
  input: { session_id: sessionId, hook_event_name: 'SessionStart', source, model: 'm', transcript_path: `/${SECRET}.jsonl`, cwd: '/c' },
})

function readResults(file: string): StepResult[] | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as StepResult[] : undefined
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

function storedSessions(userData: string): Array<Record<string, unknown>> {
  const file = path.join(userData, STORE)
  if (!fs.existsSync(file)) return []
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { sessions: Array<Record<string, unknown>> }).sessions
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** e2e/t0576: "Quit" WITHOUT "also stop Terminal Server". */
async function quitKeepingTerminalServer(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ dialog }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dialog as any).showMessageBox = async () => ({ response: 1, checkboxChecked: false })
  })
  let timer: NodeJS.Timeout | undefined
  const closed = await Promise.race([
    app.close().then(() => true, () => true),
    new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 20_000) }),
  ])
  clearTimeout(timer)
  if (!closed) {
    log('app.close() did not finish within 20 s — killing the Electron process')
    try { app.process().kill() } catch { /* already gone */ }
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
  if (process.platform === 'win32') await run('taskkill', ['/T', '/F', '/PID', String(pid)]).catch(() => '')
  else try { process.kill(pid, 'SIGKILL') } catch { /* ignore */ }
}

test('claude session name / id: hook → MCP queries → claude-sessions.json → restored after a BAT restart', async () => {
  test.setTimeout(360_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0642-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)
  // The Worker's "claude": SessionStart once up (the helper has answered by then), then its shell prompt.
  const workerSpec = slash(path.join(tmp, 'worker-spec.json'))
  fs.writeFileSync(workerSpec, JSON.stringify({
    out: slash(path.join(tmp, 'worker-$BAT_TERMINAL_ID.json')),
    steps: [{ kind: 'env' }, { ...sessionStart(SID_W, 'startup'), waitMs: 1_500 }],
  }))

  let specSeq = 0
  const runInTab = async (win: Page, id: string, steps: unknown[], port?: number): Promise<StepResult[]> => {
    const n = specSeq++
    const out = slash(path.join(tmp, `tab-${n}.json`))
    const spec = slash(path.join(tmp, `tab-${n}-spec.json`))
    fs.writeFileSync(spec, JSON.stringify({ out, steps, port }))
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id, line: `node "${runner}" "${spec}"\r` })
    await expect.poll(() => (readResults(out)?.length ?? 0) >= steps.length, { timeout: 90_000 }).toBe(true)
    const r = readResults(out)!
    log(`tab ${id} step ${n}: ${JSON.stringify(r).replace(/batcap\.[A-Za-z0-9_-]+/g, 'batcap.<redacted>').slice(0, 3000)}`)
    return r
  }
  const tool = (r: StepResult, i: number) => r.replies?.[i]?.result as Record<string, unknown> | undefined
  const structured = (r: StepResult, i: number) => tool(r, i)?.structuredContent as Record<string, unknown>

  let inst: IsolatedInstance | undefined
  let relaunched: IsolatedInstance | undefined
  let serverPid: number | null = null
  let quitUserData: { userData: string; runtimeId: string } | null = null
  try {
    inst = await launchIsolated('t0642', log)
    const { app, win, userData, runtimeId } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0642 worker', icon: 'W', color: '#888888', command: 'node', args: [runner, workerSpec],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0642', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: TOWER,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), TOWER), { timeout: 30_000 }).not.toBeNull()
    await win.waitForTimeout(2_000)

    // ── 1. the Tower's claude-cli launch decision (the T0641 record), its SessionStart, a Worker ──
    const launch = await win.evaluate(async ({ id, name }) => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('claude-cli', 'pwsh', '', id, name), { id: TOWER, name: TOWER_NAME })
    log(`tower launch args: ${JSON.stringify(launch)}`)
    expect(JSON.stringify(launch)).toContain('--name=')
    const [towerEnv, towerHook, role, dispatch] = await runInTab(win, TOWER, [
      { kind: 'env' },
      sessionStart(SID_T, 'startup'),
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      { kind: 'helper', script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0642', '--mode', 'yolo'] },
    ])
    expect(towerEnv.token?.startsWith('batcap.')).toBe(true)
    expect(towerHook).toMatchObject({ kind: 'hook', code: 0, stdout: '' })
    expect(role.code, role.stderr).toBe(0)
    expect(dispatch.code, dispatch.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(dispatch.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    const workerOut = path.join(tmp, `worker-${worker}.json`)
    await expect.poll(() => (readResults(workerOut)?.length ?? 0) >= 2, { timeout: 90_000 }).toBe(true)
    const [workerEnv, workerHook] = readResults(workerOut)!
    expect(workerHook).toMatchObject({ kind: 'hook', code: 0, stdout: '' })
    expect(workerHook.ms).toBeLessThan(2_000)

    // ── 2. the Tower's MCP ──
    const [mcp] = await runInTab(win, TOWER, [{ kind: 'mcp', requests: [
      call('bat_whoami'),
      call('bat_get_state', { terminalId: worker }),
      call('bat_list_terminals'),
    ] }])
    expect(mcp.code, mcp.stderr).toBe(0)
    const who = structured(mcp, 0)
    log(`bat_whoami: ${JSON.stringify(who)}`)
    expect(who).toMatchObject({ terminalId: TOWER, role: 'tower', claudeSessionName: TOWER_NAME, claudeSessionId: SID_T })
    expect((tool(mcp, 0)!.content as Array<{ text: string }>)[0].text).toContain(`session="${TOWER_NAME}"`)
    const state = structured(mcp, 1)
    log(`bat_get_state (worker): ${JSON.stringify(state)}`)
    expect(state).toMatchObject({ terminalId: worker, agentStarted: true, claudeSessionName: null, claudeSessionId: SID_W })
    const startedAt = state.agentStartedAt
    const rows = (structured(mcp, 2) as { terminals: Array<Record<string, unknown>> }).terminals
    expect(rows.find(t => t.id === TOWER)).toMatchObject({ claudeSessionName: TOWER_NAME, claudeSessionId: SID_T })
    expect(rows.find(t => t.id === worker)).toMatchObject({ claudeSessionName: null, claudeSessionId: SID_W })

    // `/clear` in the Worker: a new session id, agentStartedAt unchanged
    const [clearHook] = await runInTab(win, worker!, [sessionStart(SID_W2, 'clear')])
    expect(clearHook).toMatchObject({ code: 0, stdout: '' })
    const [mcp2] = await runInTab(win, TOWER, [{ kind: 'mcp', requests: [call('bat_get_state', { terminalId: worker })] }])
    expect(structured(mcp2, 0)).toMatchObject({ claudeSessionId: SID_W2, agentStartedAt: startedAt })

    // ── 3. the store and the logs ──
    await expect.poll(() => storedSessions(userData), { timeout: 10_000 }).toEqual(expect.arrayContaining([
      { terminalId: TOWER, name: TOWER_NAME, sessionId: SID_T },
      { terminalId: worker, name: null, sessionId: SID_W2 },
    ]))
    const storeText = fs.readFileSync(path.join(userData, STORE), 'utf8')
    expect(storeText).not.toContain('batcap.')
    const debug = readDebugLogs(userData)
    expect(debug).toContain(`[agent-start] terminal=${worker} → started (hook session-start) session=${SID_W.slice(0, 8)}`)
    expect(debug).toContain(`[agent-start] terminal=${worker} session=${SID_W2.slice(0, 8)} (hook session-start)`)
    const scriptsLog = fs.readFileSync(path.join(userData, 'Logs', 'bat-scripts.log'), 'utf8')
    const hookEntries = scriptsLog.trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>).filter(e => e.script === 'bat-hook')
    expect(hookEntries.map(e => e.session)).toEqual(expect.arrayContaining([SID_T.slice(0, 8), SID_W.slice(0, 8), SID_W2.slice(0, 8)]))
    for (const text of [debug, scriptsLog]) {
      for (const sid of [SID_T, SID_W, SID_W2]) expect(text).not.toContain(sid)
      expect(text).not.toContain(SECRET)
      expect(text).not.toContain(towerEnv.token!)
      expect(text).not.toContain(workerEnv.token!)
    }

    // ── 4. quit keeping the Terminal Server, relaunch, recover ──
    serverPid = readPid(userData)
    expect(serverPid).not.toBeNull()
    quitUserData = { userData, runtimeId }
    await quitKeepingTerminalServer(app)
    inst = undefined
    expect(isAlive(serverPid!)).toBe(true)
    expect(storedSessions(userData)).toHaveLength(2)

    relaunched = await launchIsolated('t0642', log, { runtimeId })
    const { win: win2, userData: userData2, remotePort } = relaunched
    expect(userData2).toBe(userData)
    const prompt = win2.locator('.recovery-prompt-dialog')
    await expect(prompt).toBeVisible({ timeout: 30_000 })
    await prompt.locator('.recovery-prompt-actions .btn-primary').click()
    await expect.poll(() => readDebugLogs(userData2), { timeout: 30_000 }).toContain(`[claude-session] kept restored: terminal=${TOWER}`)
    const restartDebug = readDebugLogs(userData2)
    expect(restartDebug).toContain(`[claude-session] loaded 2 entries from ${STORE}`)
    expect(restartDebug).toContain(`[claude-session] kept restored: terminal=${worker} session=${SID_W2.slice(0, 8)} (Terminal Server PTY list)`)
    expect(readPid(userData2)).toBe(serverPid)
    await win2.waitForTimeout(1_500)

    const [mcp3] = await runInTab(win2, TOWER, [{ kind: 'mcp', requests: [
      call('bat_whoami'),
      call('bat_get_state', { terminalId: worker }),
    ] }], remotePort)
    expect(mcp3.code, mcp3.stderr).toBe(0)
    log(`after restart: ${JSON.stringify([structured(mcp3, 0), structured(mcp3, 1)])}`)
    expect(structured(mcp3, 0)).toMatchObject({ terminalId: TOWER, claudeSessionName: TOWER_NAME, claudeSessionId: SID_T })
    expect(structured(mcp3, 1)).toMatchObject({ terminalId: worker, claudeSessionName: null, claudeSessionId: SID_W2 })
    for (const sid of [SID_T, SID_W, SID_W2]) expect(readDebugLogs(userData2)).not.toContain(sid)
    await win2.screenshot({ path: test.info().outputPath('after-restart.png') })
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (relaunched) await closeIsolated(relaunched, log)
    await killLeftoverServer(serverPid)
    if (!relaunched && quitUserData && path.basename(quitUserData.userData).includes(`-runtime-${quitUserData.runtimeId}`)) {
      fs.rmSync(quitUserData.userData, { recursive: true, force: true })
      log(`runtime userData removed: ${!fs.existsSync(quitUserData.userData)}`)
    }
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
