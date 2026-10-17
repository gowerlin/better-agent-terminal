// T0600 (D154): Worker launch confirmation, end to end in an isolated BAT.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Every helper
// runs INSIDE a tab with that tab's own env (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN = its capability).
// The Worker is a custom CLI running a node runner that stands in for claude: once started it runs
// `node $BAT_HELPER_DIR/bat-hook.mjs session-start` with claude's SessionStart JSON on stdin (as
// claude does for its SessionStart hook), then stays in the foreground. Nothing starts an LLM.
//
// A custom CLI gets no BAT hooks at launch (`blockedDetection: none`), so this is the "cannot
// tell" path of the helper; the started / unconfirmed paths with a hook-injected tab are covered
// by electron/remote/__tests__/headless-blocked-state-e2e.test.ts (real headless + real PTY + the
// real hook process) and electron/__tests__/bat-terminal-wait-started.test.ts (the helper).
//
//   1. the Tower dispatches with `--wait-started 20000` → exit 0, last stdout line
//      "  started: unknown", stderr `wait-started: NO_SIGNAL`, at once (no 20 s wait)
//   2. a dispatch without it: exit 0, no "started:" line (unchanged)
//   3. the Worker's SessionStart hook exits 0 and prints nothing; the Tower (MCP) then reads
//      agentStarted true + agentStartedAt; bat_wait until=agent-started returns at once
//   4. `agent:bat-mcp-launch-args` for a claude-cli tab: claude-settings.json has the async
//      SessionStart hook (no matcher)
//   5. logs: `[agent-start] terminal=<worker> → started (hook session-start)`; bat-scripts.log has
//      the helper's `wait-started` (NO_SIGNAL) and the hook's `session-start` / `started`, never
//      the hook input or a token

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0600')
const WS = 'e2e-t0600-ws'
const TOWER = 'e2e-t0600-tower'
const WORKER_AGENT = 'e2e-t0600-worker'
const SECRET = 'T0600-SECRET-MODEL'
const MODERN = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }

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

/** The runner of e2e/t0590-blocked-state.spec.ts: env / helper / hook / mcp / hold steps. */
const RUNNER = `
const fs = require('fs')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const env = process.env
const sub = s => String(s).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || '')
const subAll = v => typeof v === 'string' ? sub(v) : Array.isArray(v) ? v.map(subAll) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subAll(x)])) : v
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
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
    if (step.kind === 'env') {
      results.push({ kind: 'env', terminalId: env.BAT_TERMINAL_ID, token: env.BAT_REMOTE_TOKEN })
    } else if (step.kind === 'helper') {
      if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs))
      const started = Date.now()
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...step.args.map(sub)], { env, encoding: 'utf8', timeout: 60000, windowsHide: true })
      results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr, ms: Date.now() - started })
    } else if (step.kind === 'hook') {
      if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs))
      const started = Date.now()
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-hook.mjs'), step.event], { env, input: JSON.stringify(step.input), encoding: 'utf8', timeout: 30000, windowsHide: true })
      results.push({ kind: 'hook', code: run.status, stdout: run.stdout, stderr: run.stderr, ms: Date.now() - started })
    } else if (step.kind === 'mcp') {
      results.push(await mcp(step.requests))
    } else if (step.kind === 'hold') {
      flush()
      const until = Date.now() + 120000
      while (!fs.existsSync(step.file) && Date.now() < until) await new Promise(r => setTimeout(r, 200))
      results.push({ kind: 'hold' })
    }
    flush()
  }
})()
`

const call = (name: string, args: Record<string, unknown> = {}) => ({ method: 'tools/call', params: { name, arguments: args, ...MODERN } })

function readResults(file: string): StepResult[] | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as StepResult[] : undefined
}

test('launch confirmation: --wait-started on a tab without a start signal → unknown; SessionStart → agentStarted (MCP)', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0600-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)
  const release = slash(path.join(tmp, 'release-workers'))
  const workerSpec = slash(path.join(tmp, 'worker-spec.json'))
  fs.writeFileSync(workerSpec, JSON.stringify({
    out: slash(path.join(tmp, 'worker-$BAT_TERMINAL_ID.json')),
    steps: [
      { kind: 'env' },
      // claude runs SessionStart once it is up; the helper has answered by then
      { kind: 'hook', event: 'session-start', waitMs: 1_500, input: {
        session_id: 'e2e', hook_event_name: 'SessionStart', source: 'startup', model: SECRET, transcript_path: '/SECRET/t.jsonl',
      } },
      { kind: 'hold', file: release },
    ],
  }))

  let specSeq = 0
  const startInTab = async (win: Page, id: string, steps: unknown[]): Promise<string> => {
    const n = specSeq++
    const out = slash(path.join(tmp, `tab-${n}.json`))
    const spec = slash(path.join(tmp, `tab-${n}-spec.json`))
    fs.writeFileSync(spec, JSON.stringify({ out, steps }))
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id, line: `node "${runner}" "${spec}"\r` })
    return out
  }
  const results = async (out: string, count = 1): Promise<StepResult[]> => {
    await expect.poll(() => (readResults(out)?.length ?? 0) >= count, { timeout: 90_000 }).toBe(true)
    const r = readResults(out)!
    log(`${path.basename(out)}: ${JSON.stringify(r).replace(/batcap\.[A-Za-z0-9_-]+/g, 'batcap.<redacted>').slice(0, 3000)}`)
    return r
  }
  const runInTab = async (win: Page, id: string, steps: unknown[]) => results(await startInTab(win, id, steps), steps.length)
  const tool = (r: StepResult, i: number) => r.replies?.[i]?.result as Record<string, unknown> | undefined

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0600', log)
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0600 worker', icon: 'W', color: '#888888', command: 'node', args: [runner, workerSpec],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0600', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
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

    // ── 1. + 2. dispatch with --wait-started (no start signal: unknown, at once) and without ──
    const [role, waited, plain] = await runInTab(win, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      { kind: 'helper', script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0600', '--mode', 'yolo', '--wait-started', '20000'] },
      // one create per second per Tower (HELPER_TOWER_CREATE_INTERVAL_MS)
      { kind: 'helper', script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0601', '--mode', 'yolo'] },
    ])
    expect(role.code, role.stderr).toBe(0)
    expect(waited.code, waited.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(waited.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    const waitedLines = (waited.stdout ?? '').trim().split(/\r?\n/)
    expect(waitedLines.at(-1)).toBe('  started: unknown')
    expect(waited.stderr).toContain('wait-started: NO_SIGNAL')
    expect(waited.stderr).not.toContain('LAUNCH_UNCONFIRMED')
    log(`--wait-started (no signal) took ${waited.ms} ms`)
    expect(waited.ms).toBeLessThan(15_000)
    expect(plain.code, plain.stderr).toBe(0)
    expect(plain.stdout).toMatch(/Terminal created: \S+/)
    expect(plain.stdout).not.toContain('started:')
    expect(plain.stderr).not.toContain('wait-started')

    // ── 3. the Worker's SessionStart hook → the Tower reads agentStarted ──
    const workerOut = path.join(tmp, `worker-${worker}.json`)
    const [workerEnv, hook] = await results(workerOut, 2)
    expect(workerEnv.token?.startsWith('batcap.')).toBe(true)
    expect(hook).toMatchObject({ kind: 'hook', code: 0, stdout: '' })
    expect(hook.ms).toBeLessThan(2_000)
    const [mcp] = await runInTab(win, TOWER, [{ kind: 'mcp', requests: [
      call('bat_get_state', { terminalId: worker }),
      call('bat_wait', { terminalId: worker, until: 'agent-started', timeoutMs: 10_000 }),
      call('bat_list_terminals'),
    ] }])
    expect(mcp.code, mcp.stderr).toBe(0)
    const state = tool(mcp, 0)!
    log(`bat_get_state (after SessionStart): ${JSON.stringify(state)}`)
    expect(state.structuredContent).toMatchObject({ terminalId: worker, agentStarted: true, agentStartedAt: expect.any(Number), blockedDetection: 'hook' })
    expect((state.content as Array<{ text: string }>)[0].text).toContain('agent started')
    expect(tool(mcp, 1)?.structuredContent).toMatchObject({ terminalId: worker, changed: true, agentStarted: true })
    const listed = (tool(mcp, 2)?.structuredContent as { terminals: Array<Record<string, unknown>> }).terminals
    expect(listed.find(t => t.id === worker)).toMatchObject({ agentStarted: true })
    expect(listed.find(t => t.id === TOWER)).toMatchObject({ agentStarted: null })
    fs.writeFileSync(release, '')

    // ── 4. launch args of a claude-cli tab: the SessionStart hook in claude-settings.json ──
    await win.evaluate(async () => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('claude-cli', 'pwsh', '', 'e2e-t0600-claude-tab'))
    const settings = fs.readFileSync(path.join(userData, 'bat-mcp', 'claude-settings.json'), 'utf8')
    const parsed = JSON.parse(settings) as { hooks: Record<string, unknown> }
    expect(parsed.hooks.SessionStart).toEqual([{ hooks: [{ type: 'command', command: `node '${slash(path.join(REPO_ROOT, 'scripts', 'bat-hook.mjs'))}' session-start`, timeout: 5, async: true }] }])

    // ── 5. logs ──
    const debugDir = path.join(userData, 'Logs')
    const debug = fs.readdirSync(debugDir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(debugDir, f), 'utf8')).join('\n')
    expect(debug).toContain(`[agent-start] terminal=${worker} → started (hook session-start)`)
    expect(debug).toContain(`[helper-query] channel=terminal:wait caller=${TOWER} target=${worker} → ok until=agent-started changed=true state=`)
    expect(debug).not.toContain(SECRET)
    const scriptsLog = fs.readFileSync(path.join(userData, 'Logs', 'bat-scripts.log'), 'utf8')
    const entries = scriptsLog.trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>)
    expect(entries.find(e => e.script === 'bat-terminal' && e.event === 'wait-started' && e.terminalId === worker && e.result === 'NO_SIGNAL')).toBeTruthy()
    expect(entries.find(e => e.script === 'bat-hook' && e.event === 'report-hook' && e.hook === 'session-start' && e.result === 'started')).toBeTruthy()
    expect(scriptsLog).not.toContain(SECRET)
    expect(scriptsLog).not.toContain(workerEnv.token!)
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
