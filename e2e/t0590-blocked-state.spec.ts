// PLAN-047 M1b-1 / T0590: `blocked` from claude hooks, end to end in an isolated BAT.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Every helper
// runs INSIDE a tab with that tab's own env (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN = its capability).
// The Worker is a custom CLI running a node runner that stands in for claude: it runs
// `node $BAT_HELPER_DIR/bat-hook.mjs ask-user-question` with claude's hook JSON on stdin (as claude
// does for its PreToolUse hook), then stays in the foreground. Nothing starts an LLM.
//
//   1. the Tower declares itself and dispatches the Worker; the Worker's hook exits 0, prints nothing
//   2. Tower (MCP): bat_get_state / bat_list_terminals of the Worker → blocked (question), hook
//   3. typing into the Worker tab (the user answering) → cleared; bat_wait fromState=blocked returns
//   3b. T0594: blocked on a question again, then the Worker's PostToolUse AskUserQuestion hook
//      (`ask-user-question-done`, the question answered by mouse) → cleared with no keyboard input.
//      T0597 (BUG-150): in claude's real order — the question's PermissionRequest hook (tool_name
//      AskUserQuestion) ~90 ms after its PreToolUse — the Tower still reads blocked (question)
//   4. `agent:bat-mcp-launch-args` for a claude-cli tab: `--settings=<userData>/bat-mcp/claude-settings.json`,
//      the file holds hooks only; the tab id records blockedDetection
//   5. debug log: `[blocked] … → blocked reason=question` / `→ cleared (user input)` /
//      `→ cleared (hook ask-user-question-done)`; bat-scripts.log
//      has the report-hook lines, never the hook's tool_input or a token

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0590')
const WS = 'e2e-t0590-ws'
const TOWER = 'e2e-t0590-tower'
const WORKER_AGENT = 'e2e-t0590-worker'
const SECRET_QUESTION = 'T0590-SECRET-QUESTION-TEXT'
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

/**
 * `node runner.cjs <spec.json>`: the spec's steps with this process's env; results to `spec.out`
 * after every step (temp file + rename). `$BAT_TERMINAL_ID` is replaced in strings.
 *   - `{ kind: 'env' }`                 BAT_TERMINAL_ID / token
 *   - `{ kind: 'helper', script, args }` `node $BAT_HELPER_DIR/<script> ...args`
 *   - `{ kind: 'hook', event, input, waitMs? }` `node $BAT_HELPER_DIR/bat-hook.mjs <event>`, input on stdin (claude's way)
 *   - `{ kind: 'mcp', requests }`       `node $BAT_HELPER_DIR/bat-mcp.mjs`, requests one by one
 *   - `{ kind: 'hold', file }`          stays in the foreground until `file` exists (at most 120 s)
 */
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
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...step.args.map(sub)], { env, encoding: 'utf8', timeout: 30000, windowsHide: true })
      results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr })
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

test('blocked: a claude hook in a Worker tab → the Tower reads blocked (MCP); typing clears it', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0590-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)
  const release = slash(path.join(tmp, 'release-worker'))
  const releaseAgain = slash(path.join(tmp, 'release-worker-again'))
  const askInput = (question: string) => ({
    session_id: 'e2e', hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion',
    tool_input: { questions: [{ question, options: [{ label: 'a' }] }] },
  })
  const workerSpec = slash(path.join(tmp, 'worker-spec.json'))
  fs.writeFileSync(workerSpec, JSON.stringify({
    out: slash(path.join(tmp, 'worker-$BAT_TERMINAL_ID.json')),
    steps: [
      { kind: 'env' },
      { kind: 'hook', event: 'ask-user-question', input: askInput(SECRET_QUESTION) },
      { kind: 'hold', file: release },
      // T0594: asked again, answered without the keyboard (claude's PostToolUse after the answer);
      // T0597: claude's real order, the question's PermissionRequest ~90 ms after its PreToolUse
      { kind: 'hook', event: 'ask-user-question', input: askInput(SECRET_QUESTION) },
      { kind: 'hook', event: 'permission-request', waitMs: 90, input: {
        session_id: 'e2e', hook_event_name: 'PermissionRequest', tool_name: 'AskUserQuestion',
        tool_input: { questions: [{ question: SECRET_QUESTION }] }, permission_suggestions: [],
      } },
      { kind: 'hook', event: 'ask-user-question-done', waitMs: 6_000, input: {
        session_id: 'e2e', hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion', tool_use_id: 'toolu_e2e',
        tool_input: { questions: [{ question: SECRET_QUESTION }] }, tool_response: { answers: { [SECRET_QUESTION]: SECRET_QUESTION } },
      } },
      { kind: 'hold', file: releaseAgain },
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
    inst = await launchIsolated('t0590', log)
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0590 worker', icon: 'W', color: '#888888', command: 'node', args: [runner, workerSpec],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0590', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
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

    // ── 1. the Tower declares itself and dispatches the Worker; the Worker's hook reports ──
    const [role, dispatch] = await runInTab(win, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      { kind: 'helper', script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0590', '--mode', 'yolo'] },
    ])
    expect(role.code, role.stderr).toBe(0)
    expect(dispatch.code, dispatch.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(dispatch.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    const workerOut = path.join(tmp, `worker-${worker}.json`)
    const [workerEnv, hook] = await results(workerOut, 2)
    expect(workerEnv.token?.startsWith('batcap.')).toBe(true)
    expect(hook).toMatchObject({ kind: 'hook', code: 0, stdout: '' })
    log(`bat-hook.mjs one report inside the tab: ${hook.ms} ms`)
    expect(hook.ms).toBeLessThan(2_000)

    // ── 2. Tower (MCP): the Worker is blocked on a question ──
    const [blockedMcp] = await runInTab(win, TOWER, [{ kind: 'mcp', requests: [
      call('bat_get_state', { terminalId: worker }),
      call('bat_list_terminals'),
    ] }])
    expect(blockedMcp.code, blockedMcp.stderr).toBe(0)
    const blocked = tool(blockedMcp, 0)!
    log(`bat_get_state (blocked): ${JSON.stringify(blocked)}`)
    expect(blocked.structuredContent).toMatchObject({
      terminalId: worker, state: 'blocked', blockedReason: 'question', blockedSince: expect.any(Number), source: 'hook', blockedDetection: 'hook',
    })
    expect((blocked.content as Array<{ text: string }>)[0].text).toContain('blocked (question)')
    const listed = (tool(blockedMcp, 1)?.structuredContent as { terminals: Array<Record<string, unknown>> }).terminals
    expect(listed.find(t => t.id === worker)).toMatchObject({ state: 'blocked', blockedReason: 'question' })
    expect(listed.find(t => t.id === TOWER)).toMatchObject({ blockedDetection: 'none' })

    // ── 3. the user answers in the Worker tab → cleared; a wait from blocked returns ──
    const waitOut = await startInTab(win, TOWER, [{ kind: 'mcp', requests: [
      call('bat_wait', { terminalId: worker, until: 'state-change', fromState: 'blocked', timeoutMs: 40_000 }),
    ] }])
    await win.waitForTimeout(3_000)
    expect(readResults(waitOut)).toBeUndefined()
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, '1'), worker)
    const [waited] = await results(waitOut)
    expect(tool(waited, 0)?.structuredContent).toMatchObject({ terminalId: worker, changed: true })
    expect((tool(waited, 0)?.structuredContent as { state: string }).state).not.toBe('blocked')
    fs.writeFileSync(release, '')
    await results(workerOut, 3)

    // ── 3b. blocked on a question again; the answered-question hook clears it, no keyboard ──
    const [, , , again, prompt] = await results(workerOut, 5)
    expect(again).toMatchObject({ kind: 'hook', code: 0, stdout: '' })
    expect(prompt).toMatchObject({ kind: 'hook', code: 0, stdout: '' })
    const [answered] = await runInTab(win, TOWER, [{ kind: 'mcp', requests: [
      call('bat_get_state', { terminalId: worker }),
      call('bat_wait', { terminalId: worker, until: 'state-change', fromState: 'blocked', timeoutMs: 40_000 }),
    ] }])
    expect(answered.code, answered.stderr).toBe(0)
    // the done hook runs 6 s after the question's PermissionRequest: the get-state lands in between
    expect(tool(answered, 0)?.structuredContent).toMatchObject({ terminalId: worker, state: 'blocked', blockedReason: 'question' })
    expect(tool(answered, 1)?.structuredContent).toMatchObject({ terminalId: worker, changed: true, blockedDetection: 'hook' })
    expect((tool(answered, 1)?.structuredContent as { state: string }).state).not.toBe('blocked')
    const [, , , , , done] = await results(workerOut, 6)
    expect(done).toMatchObject({ kind: 'hook', code: 0, stdout: '' })
    fs.writeFileSync(releaseAgain, '')
    await results(workerOut, 7)

    // ── 4. launch args of a claude-cli tab: --settings= with hooks only ──
    const args = await win.evaluate(async () => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('claude-cli', 'pwsh', '--model opus', 'e2e-t0590-claude-tab'))
    log(`launch args: ${args}`)
    const settingsFile = path.join(userData, 'bat-mcp', 'claude-settings.json')
    expect(args).toBe(`'--mcp-config=${path.join(userData, 'bat-mcp', 'claude.json')}' '--settings=${settingsFile}'`)
    const settings = fs.readFileSync(settingsFile, 'utf8')
    log(`claude-settings.json: ${settings}`)
    const parsed = JSON.parse(settings) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> }
    expect(Object.keys(parsed)).toEqual(['hooks'])
    // T0600: + SessionStart (launch confirmation)
    expect(Object.keys(parsed.hooks)).toEqual(['PermissionRequest', 'PreToolUse', 'Notification', 'PostToolUse', 'UserPromptSubmit', 'Stop', 'SessionStart'])
    expect(parsed.hooks.PostToolUse).toEqual([{ matcher: 'AskUserQuestion', hooks: [expect.objectContaining({ command: `node '${slash(path.join(REPO_ROOT, 'scripts', 'bat-hook.mjs'))}' ask-user-question-done`, async: true })] }])
    expect(parsed.hooks.Stop[0].hooks[0].command).toBe(`node '${slash(path.join(REPO_ROOT, 'scripts', 'bat-hook.mjs'))}' stop`)
    expect(settings).not.toMatch(/batcap\.|BAT_REMOTE_TOKEN|disableAllHooks/)
    expect(await win.evaluate(async () => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('claude-cli', 'pwsh', '--settings mine.json'))).toBe(`'--mcp-config=${path.join(userData, 'bat-mcp', 'claude.json')}'`)

    // ── 5. logs: transitions in the debug log; report-hook lines without content or token ──
    const debugDir = path.join(userData, 'Logs')
    const debug = fs.readdirSync(debugDir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(debugDir, f), 'utf8')).join('\n')
    expect(debug).toContain(`[blocked] terminal=${worker} → blocked reason=question (hook ask-user-question)`)
    expect(debug).toContain(`[blocked] terminal=${worker} → cleared (user input)`)
    expect(debug).toContain(`[blocked] terminal=${worker} → cleared (hook ask-user-question-done)`)
    // T0597: the question's PermissionRequest never turned it into a permission prompt
    expect(debug).not.toContain(`[blocked] terminal=${worker} → blocked reason=permission`)
    expect(debug).toMatch(/\[bat-mcp\] tab agent=claude-cli terminal=e2e-t0590-claude-tab → injected: .*; hooks=yes/)
    expect(debug).not.toContain(SECRET_QUESTION)
    const scriptsLog = fs.readFileSync(path.join(userData, 'Logs', 'bat-scripts.log'), 'utf8')
    const entries = scriptsLog.trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>)
    expect(entries.find(e => e.script === 'bat-hook' && e.event === 'report-hook' && e.hook === 'ask-user-question' && e.result === 'blocked')).toBeTruthy()
    expect(entries.find(e => e.event === 'report-hook' && e.hook === 'ask-user-question' && e.result === 'blocked' && e.script !== 'bat-hook')).toBeTruthy()
    expect(entries.find(e => e.script === 'bat-hook' && e.event === 'report-hook' && e.hook === 'ask-user-question-done' && e.result === 'cleared')).toBeTruthy()
    expect(entries.find(e => e.script === 'bat-hook' && e.event === 'report-hook' && e.hook === 'permission-request' && e.result === 'unchanged')).toBeTruthy()
    expect(scriptsLog).not.toContain(SECRET_QUESTION)
    expect(scriptsLog).not.toContain(workerEnv.token!)
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
