// T0664 — v0.7.1-pre.2 installed-build acceptance of BUG-162 / T0657: a permission prompt that ends
// without the keyboard (allowed by mouse, auto-denied) clears `blocked` on claude's `PostToolBatch`.
// OPT-IN: skipped unless BAT_E2E_V071PRE2=1 and BAT_E2E_EXECUTABLE points at the installed build;
// V2 (real claude, spends tokens) additionally needs BAT_E2E_REAL_CLAUDE=1. Windows only.
//
//   $env:BAT_E2E_V071PRE2='1'
//   $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
//   $env:BAT_E2E_REAL_CLAUDE='1'                       # V2 only
//   $env:BAT_E2E_V071PRE2_EVIDENCE_DIR='<scratch dir>'  # default: %TEMP%\bat-v071pre2-blocked\evidence
//   npx playwright test e2e/v071-pre2-blocked-acceptance.spec.ts
//
// Every launch is an isolated instance (fixtures/electron-isolation: own --runtime / userData,
// RemoteServer on a free port); the user's BAT and real userData are never touched. Hook scripts and
// claude are the installed build's own (`resources/scripts/bat-hook.mjs`, the embedded claude).
//
//   V0  installed content: a claude-cli tab's `--settings=<userData>/bat-mcp/claude-settings.json`
//       holds PostToolBatch (async, no matcher) pointing at the installed bat-hook.mjs; that script
//       knows `post-tool-batch`; the embedded claude binary has `PostToolBatch` (version recorded)
//   V1  synthetic hooks, no token: a dispatched Worker tab runs the installed bat-hook.mjs with its
//       own env — PermissionRequest → a few seconds → PostToolBatch: the Tower (MCP) reads blocked /
//       permission / hook, then not blocked. Subagent (`agent_id`): the main thread's batch does not
//       clear it, its own batch does. Every hook exits 0 with an empty stdout. The Worker tab never
//       receives a byte from the test (no user input).
//   V2  real claude (one turn, haiku): a dispatched claude-cli Worker with
//       `--dangerously-skip-permissions` runs `rm -rf <its own temp cwd>`, which claude's built-in
//       dangerous-rm safety check still asks about in bypass mode; nobody answers, claude auto-denies
//       after 120 s. (a) blocked / permission, (b) cleared by post-tool-batch before the turn's Stop,
//       (c) the debug log's `→ cleared (hook post-tool-batch)`. Claude's config is an isolated
//       CLAUDE_CONFIG_DIR (the user's ~/.claude is only read: the access token, never the refresh
//       token, so nothing can rotate the user's login).
//
// Each check writes a verdict to <evidence>/results.json (outside Playwright's outputDir, L169).

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { E2E_EXECUTABLE, closeIsolated, launchIsolated, run, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const ENABLED = process.env.BAT_E2E_V071PRE2 === '1'
const REAL_CLAUDE = process.env.BAT_E2E_REAL_CLAUDE === '1'
const EXPECTED_VERSION = '0.7.1-pre.2'
const ROOT = path.join(os.tmpdir(), 'bat-v071pre2-blocked')
const EVIDENCE_DIR = process.env.BAT_E2E_V071PRE2_EVIDENCE_DIR || path.join(ROOT, 'evidence')
const RESULTS = path.join(EVIDENCE_DIR, 'results.json')
const INSTALL_DIR = E2E_EXECUTABLE ? path.dirname(E2E_EXECUTABLE) : ''
const INSTALLED_HOOK = path.join(INSTALL_DIR, 'resources', 'scripts', 'bat-hook.mjs')
const EMBEDDED_CLAUDE = path.join(INSTALL_DIR, 'resources', 'app.asar.unpacked', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const CLAUDE_MODEL = 'claude-haiku-5-5'
const SUBAGENT = 'a1b2c3d4e5f6'
const SECRET = 'T0664-SECRET-TOOL-INPUT'
const MODERN = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }

test.skip(!ENABLED, 'opt-in: set BAT_E2E_V071PRE2=1 (T0664)')
test.skip(process.platform !== 'win32', 'Windows host only')
test.skip(ENABLED && !E2E_EXECUTABLE, 'set BAT_E2E_EXECUTABLE to the installed BetterAgentTerminal.exe under test')

const log = testLogger('t0664')
const redact = (s: string) => s.replace(/batcap\.[A-Za-z0-9_.-]+/g, 'batcap.<redacted>')

// ── verdicts ─────────────────────────────────────────────────────────────────

type Verdict = 'PASS' | 'FAIL' | 'NEEDS-HUMAN'
interface Result { verdict: Verdict; evidence: string[]; at: string }

function readVerdicts(): Record<string, Result> {
  try {
    return JSON.parse(fs.readFileSync(RESULTS, 'utf8')) as Record<string, Result>
  } catch {
    return {}
  }
}

/** Records one check (`V<n>` or `V<n>.<part>`); returns whether it did not fail. */
function record(key: string, pass: boolean | 'needs-human', evidence: string[]): boolean {
  const verdict: Verdict = pass === 'needs-human' ? 'NEEDS-HUMAN' : pass ? 'PASS' : 'FAIL'
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const all = readVerdicts()
  all[key] = { verdict, evidence: evidence.map(redact), at: new Date().toISOString() }
  fs.writeFileSync(RESULTS, JSON.stringify(all, null, 2))
  log(`${key}: ${verdict} — ${redact(evidence.join(' | ')).replace(/\s+/g, ' ').slice(0, 1500)}`)
  return verdict !== 'FAIL'
}

function saveEvidence(name: string, content: string): string {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const file = path.join(EVIDENCE_DIR, name)
  fs.writeFileSync(file, redact(content))
  return file
}

// ── in-tab runner (T0590's, + a get-state poller) ────────────────────────────

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
 *   - `{ kind: 'env' }`                  BAT_TERMINAL_ID / token
 *   - `{ kind: 'helper', script, args }`  `node $BAT_HELPER_DIR/<script> ...args`
 *   - `{ kind: 'hook', event, input, waitMs? }` `node $BAT_HELPER_DIR/bat-hook.mjs <event>`, input on stdin
 *   - `{ kind: 'mcp', requests }`        `node $BAT_HELPER_DIR/bat-mcp.mjs`, requests one by one
 *   - `{ kind: 'hold', file }`           stays in the foreground until `file` exists (at most 120 s)
 *   - `{ kind: 'poll', terminalId, everyMs, until, samples }` one bat-mcp process, bat_get_state of
 *     `terminalId` every `everyMs` until `until` exists (at most 600 s); each sample appended to `samples`
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
const MODERN = ${JSON.stringify(MODERN)}

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

function poll(step) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-mcp.mjs')], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    const until = Date.now() + 600000
    let buf = ''
    let id = 0
    let stderr = ''
    const ask = () => {
      if (fs.existsSync(step.until) || Date.now() > until) { child.stdin.end(); return }
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'bat_get_state', arguments: { terminalId: step.terminalId }, ...MODERN } }) + '\\n')
    }
    child.stdout.on('data', d => {
      buf += d
      let nl
      while ((nl = buf.indexOf('\\n')) !== -1) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        const reply = JSON.parse(line)
        const s = (reply.result && reply.result.structuredContent) || {}
        fs.appendFileSync(step.samples, JSON.stringify({ t: new Date().toISOString(), state: s.state, blockedReason: s.blockedReason, source: s.source, blockedDetection: s.blockedDetection, agentStarted: s.agentStarted, error: reply.error ? reply.error.message : undefined }) + '\\n')
        setTimeout(ask, step.everyMs)
      }
    })
    child.stderr.on('data', d => { stderr += d })
    child.on('exit', code => resolve({ kind: 'poll', code, stderr }))
    ask()
  })
}

;(async () => {
  for (const step of spec.steps) {
    if (step.kind === 'env') {
      results.push({ kind: 'env', terminalId: env.BAT_TERMINAL_ID, token: env.BAT_REMOTE_TOKEN })
    } else if (step.kind === 'helper') {
      if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs))
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...step.args.map(sub)], { env, encoding: 'utf8', timeout: 60000, windowsHide: true })
      results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr })
    } else if (step.kind === 'hook') {
      if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs))
      const started = Date.now()
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-hook.mjs'), step.event], { env, input: JSON.stringify(step.input), encoding: 'utf8', timeout: 30000, windowsHide: true })
      results.push({ kind: 'hook', event: step.event, code: run.status, stdout: run.stdout, stderr: run.stderr, ms: Date.now() - started })
    } else if (step.kind === 'mcp') {
      results.push(await mcp(step.requests))
    } else if (step.kind === 'hold') {
      flush()
      const until = Date.now() + 120000
      while (!fs.existsSync(step.file) && Date.now() < until) await new Promise(r => setTimeout(r, 200))
      results.push({ kind: 'hold' })
    } else if (step.kind === 'poll') {
      flush()
      results.push(await poll(step))
    }
    flush()
  }
})()
`

const call = (name: string, args: Record<string, unknown> = {}) => ({ method: 'tools/call', params: { name, arguments: args, ...MODERN } })
const slash = (p: string) => p.split(path.sep).join('/')

function readResults(file: string): StepResult[] | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as StepResult[] : undefined
}

interface Harness {
  tmp: string
  runner: string
  startInTab: (win: Page, id: string, steps: unknown[]) => Promise<string>
  results: (out: string, count?: number, timeout?: number) => Promise<StepResult[]>
  runInTab: (win: Page, id: string, steps: unknown[]) => Promise<StepResult[]>
}

function harness(tmp: string): Harness {
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)
  let specSeq = 0
  const startInTab = async (win: Page, id: string, steps: unknown[]): Promise<string> => {
    const n = specSeq++
    const out = slash(path.join(tmp, `tab-${n}.json`))
    const spec = slash(path.join(tmp, `tab-${n}-spec.json`))
    fs.writeFileSync(spec, JSON.stringify({ out, steps }))
    // T0664: `{ auto: true }` — not user input (only ever written to the Tower tab)
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line, { auto: true }), { id, line: `node "${runner}" "${spec}"\r` })
    return out
  }
  const results = async (out: string, count = 1, timeout = 90_000): Promise<StepResult[]> => {
    await expect.poll(() => (readResults(out)?.length ?? 0) >= count, { timeout }).toBe(true)
    const r = readResults(out)!
    log(`${path.basename(out)}: ${redact(JSON.stringify(r)).slice(0, 3000)}`)
    return r
  }
  const runInTab = async (win: Page, id: string, steps: unknown[]) => results(await startInTab(win, id, steps), steps.length)
  return { tmp, runner, startInTab, results, runInTab }
}

const structured = (r: StepResult, i: number) => (r.replies?.[i]?.result as { structuredContent?: Record<string, unknown> } | undefined)?.structuredContent

async function seedWorkspace(win: Page, seed: Record<string, unknown>, towerId: string): Promise<void> {
  await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
  expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), towerId), { timeout: 30_000 }).not.toBeNull()
  await win.waitForTimeout(2_000)
}

function readDebugLog(userData: string): string {
  const dir = path.join(userData, 'Logs')
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

function readScriptsLog(userData: string): Array<Record<string, unknown>> {
  const file = path.join(userData, 'Logs', 'bat-scripts.log')
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, unknown>)
}

async function checkVersion(inst: IsolatedInstance): Promise<string[]> {
  const fileVersion = (await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `(Get-Item '${E2E_EXECUTABLE.replace(/'/g, "''")}').VersionInfo.FileVersion`], 20_000).catch(() => '?')).trim()
  const appVersion = await inst.app.evaluate(({ app }) => app.getVersion())
  log(`executable ${E2E_EXECUTABLE} FileVersion ${fileVersion}; app.getVersion() ${appVersion}`)
  expect(fileVersion).toBe(EXPECTED_VERSION)
  expect(appVersion).toBe(EXPECTED_VERSION)
  return [`FileVersion ${fileVersion}`, `app.getVersion() ${appVersion}`]
}

/** Claude processes still running with this instance's userData on the command line. */
async function leftoverClaude(userData: string): Promise<string> {
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(userData).replace(/'/g, "''")}*' } | ForEach-Object { $_.ProcessId }`], 30_000).catch(() => '?')
  return out.trim()
}

// ── V0 + V1 ──────────────────────────────────────────────────────────────────

test('V0 + V1: installed content; synthetic PermissionRequest → PostToolBatch clears blocked (main thread and subagent)', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0664-v1-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const h = harness(tmp)
  const WS = 'e2e-t0664-ws'
  const TOWER = 'e2e-t0664-tower'
  const WORKER_AGENT = 'e2e-t0664-worker'
  const gate = (name: string) => slash(path.join(tmp, `release-${name}`))
  const common = { session_id: '6f0c2a1e-1111-4222-8333-944455556666', transcript_path: 'x.jsonl', cwd: slash(folder), permission_mode: 'bypassPermissions' }
  const permission = (agent?: string) => ({
    ...common, ...(agent ? { agent_id: agent, agent_type: 'general-purpose' } : {}),
    hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: `rm -rf ${SECRET}` }, permission_suggestions: [],
  })
  const batch = (agent?: string) => ({
    ...common, ...(agent ? { agent_id: agent, agent_type: 'general-purpose' } : {}),
    hook_event_name: 'PostToolBatch', tool_calls: [{ tool_name: 'Bash', tool_use_id: 'toolu_e2e', tool_input: { command: `rm -rf ${SECRET}` }, tool_response: `denied ${SECRET}` }],
  })
  const workerSpec = slash(path.join(tmp, 'worker-spec.json'))
  fs.writeFileSync(workerSpec, JSON.stringify({
    out: slash(path.join(tmp, 'worker-$BAT_TERMINAL_ID.json')),
    steps: [
      { kind: 'env' },                                                                // 1
      { kind: 'hook', event: 'permission-request', input: permission() },             // 2
      { kind: 'hold', file: gate('a') },                                              // 3
      { kind: 'hook', event: 'post-tool-batch', waitMs: 3_000, input: batch() },      // 4
      { kind: 'hold', file: gate('b') },                                              // 5
      { kind: 'hook', event: 'permission-request', input: permission(SUBAGENT) },     // 6
      { kind: 'hold', file: gate('c') },                                              // 7
      { kind: 'hook', event: 'post-tool-batch', waitMs: 3_000, input: batch() },      // 8  main thread's batch
      { kind: 'hold', file: gate('d') },                                              // 9
      { kind: 'hook', event: 'post-tool-batch', waitMs: 3_000, input: batch(SUBAGENT) }, // 10 the subagent's own
      { kind: 'hold', file: gate('e') },                                              // 11
    ],
  }))

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0664-v1', log)
    const { win, userData } = inst
    const versionEvidence = await checkVersion(inst)

    // ── V0: installed content ──
    const v0: string[] = [...versionEvidence]
    let v0ok = true
    const args = await win.evaluate(async () => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('claude-cli', 'pwsh', '', 'e2e-t0664-claude-tab'))
    const settingsFile = path.join(userData, 'bat-mcp', 'claude-settings.json')
    v0.push(`launch args: ${args}`)
    v0ok &&= String(args).includes(`'--settings=${settingsFile}'`)
    const settings = fs.existsSync(settingsFile) ? fs.readFileSync(settingsFile, 'utf8') : ''
    saveEvidence('v0-claude-settings.json', settings)
    const parsed = settings ? JSON.parse(settings) as { hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; command: string; async?: boolean }> }>> } : { hooks: {} }
    const ptb = parsed.hooks.PostToolBatch
    v0.push(`claude-settings.json top-level keys ${JSON.stringify(Object.keys(parsed))}; hook events ${JSON.stringify(Object.keys(parsed.hooks))}`)
    v0.push(`PostToolBatch entry: ${JSON.stringify(ptb)}`)
    const hookPath = slash(INSTALLED_HOOK)
    v0ok &&= Object.keys(parsed).length === 1 && Array.isArray(ptb) && ptb.length === 1 && ptb[0].matcher === undefined
      && ptb[0].hooks.length === 1 && ptb[0].hooks[0].async === true
      && ptb[0].hooks[0].command === `node '${hookPath}' post-tool-batch`
    v0ok &&= !/batcap\.|BAT_REMOTE_TOKEN|disableAllHooks/.test(settings)
    const hookSource = fs.readFileSync(INSTALLED_HOOK, 'utf8')
    const events = /export const HOOK_EVENTS = (\[[^\]]*\])/.exec(hookSource)?.[1] ?? ''
    v0.push(`installed bat-hook.mjs HOOK_EVENTS ${events}; HOOK_INPUT_STOP_FIELDS has post-tool-batch: ${/HOOK_INPUT_STOP_FIELDS = \{[^}]*'post-tool-batch': 'tool_calls'/.test(hookSource)}`)
    v0ok &&= events.includes("'post-tool-batch'") && /'post-tool-batch': \['PostToolBatch'\]/.test(hookSource)
    const claudeVersion = (await run(EMBEDDED_CLAUDE, ['--version'], 30_000).catch(e => `? ${e}`)).trim()
    const binary = fs.readFileSync(EMBEDDED_CLAUDE)
    let count = 0
    for (let at = binary.indexOf('PostToolBatch'); at !== -1; at = binary.indexOf('PostToolBatch', at + 1)) count++
    v0.push(`embedded claude ${EMBEDDED_CLAUDE}: --version ${claudeVersion}; 'PostToolBatch' occurrences in the binary: ${count}`)
    v0ok &&= count > 0
    record('V0', v0ok, v0)

    // ── V1: synthetic hooks in a dispatched Worker tab ──
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0664 worker', icon: 'W', color: '#888888', command: 'node', args: [h.runner, workerSpec],
    })).toBeTruthy()
    await seedWorkspace(win, {
      workspaces: [{ id: WS, name: 'T0664', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: TOWER,
    }, TOWER)

    const [role, dispatch] = await h.runInTab(win, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      { kind: 'helper', script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0664', '--mode', 'yolo'] },
    ])
    expect(role.code, role.stderr).toBe(0)
    expect(dispatch.code, dispatch.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(dispatch.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    const workerOut = path.join(tmp, `worker-${worker}.json`)
    const timeline: string[] = []
    const getState = async (label: string) => {
      const [r] = await h.runInTab(win, TOWER, [{ kind: 'mcp', requests: [call('bat_get_state', { terminalId: worker })] }])
      const s = structured(r, 0) ?? {}
      timeline.push(`${new Date().toISOString()} ${label}: state=${s.state} reason=${s.blockedReason ?? '-'} source=${s.source} detection=${s.blockedDetection}`)
      return s
    }

    const hooks: StepResult[] = []
    const w2 = await h.results(workerOut, 2)
    hooks.push(w2[1])
    const s1 = await getState('after PermissionRequest (main)')
    fs.writeFileSync(gate('a'), '')
    const w4 = await h.results(workerOut, 4)
    hooks.push(w4[3])
    const s2 = await getState('after PostToolBatch (main)')
    fs.writeFileSync(gate('b'), '')
    const w6 = await h.results(workerOut, 6)
    hooks.push(w6[5])
    const s3 = await getState(`after PermissionRequest (agent_id ${SUBAGENT})`)
    fs.writeFileSync(gate('c'), '')
    const w8 = await h.results(workerOut, 8)
    hooks.push(w8[7])
    const s4 = await getState('after PostToolBatch (main thread, no agent_id)')
    fs.writeFileSync(gate('d'), '')
    const w10 = await h.results(workerOut, 10)
    hooks.push(w10[9])
    const s5 = await getState(`after PostToolBatch (agent_id ${SUBAGENT})`)
    fs.writeFileSync(gate('e'), '')
    await h.results(workerOut, 11)

    const isPermission = (s: Record<string, unknown>) => s.state === 'blocked' && s.blockedReason === 'permission' && s.source === 'hook'
    const mainOk = isPermission(s1) && s2.state !== 'blocked'
    const subOk = isPermission(s3) && isPermission(s4) && s5.state !== 'blocked'
    const hooksOk = hooks.every(r => r.code === 0 && r.stdout === '')
    const hookEvidence = hooks.map(r => `${(r as StepResult & { event?: string }).event}: exit ${r.code}, stdout ${Buffer.byteLength(r.stdout ?? '')} bytes, ${r.ms} ms`)

    const debug = readDebugLog(userData)
    const blockedLines = debug.split('\n').filter(l => l.includes(`[blocked] terminal=${worker}`) || l.includes(`report-hook caller=${worker}`))
    saveEvidence('v1-debug-blocked.log', blockedLines.join('\n'))
    const entries = readScriptsLog(userData).filter(e => e.terminalId === worker && e.event === 'report-hook')
    saveEvidence('v1-bat-scripts.jsonl', entries.map(e => JSON.stringify(e)).join('\n'))
    const logOk = blockedLines.some(l => l.includes('→ blocked reason=permission (hook permission-request tool=Bash)'))
      && blockedLines.some(l => l.includes('→ cleared (hook post-tool-batch)'))
      && blockedLines.some(l => l.includes(`→ blocked reason=permission (hook permission-request tool=Bash agent=${SUBAGENT})`))
      && blockedLines.some(l => l.includes(`→ cleared (hook post-tool-batch agent=${SUBAGENT})`))
      && !blockedLines.some(l => l.includes('cleared (user input)'))
    const mainBatchDuringSub = entries.filter(e => e.script === 'bat-hook' && e.hook === 'post-tool-batch' && e.agent === undefined).map(e => e.result)
    const noSecret = !debug.includes(SECRET) && !JSON.stringify(readScriptsLog(userData)).includes(SECRET)

    record('V1.main', mainOk, timeline.slice(0, 2))
    record('V1.subagent', subOk && mainBatchDuringSub[1] === 'unchanged', [...timeline.slice(2), `bat-hook post-tool-batch (main thread) results in order: ${JSON.stringify(mainBatchDuringSub)}`])
    record('V1.hooks', hooksOk, hookEvidence)
    record('V1.logs', logOk && noSecret, [...blockedLines.map(l => l.replace(/^.*?\[blocked\]/, '[blocked]')), `tool_input / tool_calls content absent from logs: ${noSecret}`, 'no input was ever written to the Worker tab'])
    record('V1', mainOk && subOk && hooksOk && logOk && noSecret && mainBatchDuringSub[1] === 'unchanged', ['see V1.main / V1.subagent / V1.hooks / V1.logs'])
    expect(readVerdicts().V0?.verdict).toBe('PASS')
    expect(readVerdicts().V1?.verdict).toBe('PASS')
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
    log(`temp dir removed: ${!fs.existsSync(tmp)}`)
  }
})

// ── V2: real claude ──────────────────────────────────────────────────────────

test('V2: real claude — a safety-check permission prompt auto-denied with nobody answering clears before Stop', async () => {
  test.skip(!REAL_CLAUDE, 'spends Claude tokens: set BAT_E2E_REAL_CLAUDE=1 (T0664 V2)')
  test.setTimeout(600_000)
  // Isolated claude config: onboarding / trust / bypass-mode prompts pre-answered; only the access
  // token of the user's login is copied (no refresh token — nothing here can rotate it).
  const userCreds = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), 'utf8')) as { claudeAiOauth?: Record<string, unknown> }
  const oauth = userCreds.claudeAiOauth ?? {}
  const expiresAt = Number(oauth.expiresAt ?? 0)
  test.skip(!oauth.accessToken || expiresAt < Date.now() + 15 * 60_000, 'the user\'s claude access token is missing or expires within 15 minutes (refreshing it would rotate the user\'s login)')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0664-v2-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(path.join(folder, 'victim.txt'), 'T0664 disposable file\n')
  const h = harness(tmp)
  const WS = 'e2e-t0664-claude-ws'
  const TOWER = 'e2e-t0664-claude-tower'
  const claudeHome = path.join(tmp, 'claude-config')
  fs.mkdirSync(claudeHome)
  fs.writeFileSync(path.join(claudeHome, '.credentials.json'), JSON.stringify({ claudeAiOauth: {
    accessToken: oauth.accessToken, expiresAt, scopes: oauth.scopes, subscriptionType: oauth.subscriptionType, rateLimitTier: oauth.rateLimitTier,
  } }))
  const projectEntry = { hasTrustDialogAccepted: true, hasCompletedProjectOnboarding: true, allowedTools: [] }
  fs.writeFileSync(path.join(claudeHome, '.claude.json'), JSON.stringify({
    hasCompletedOnboarding: true, theme: 'dark', bypassPermissionsModeAccepted: true,
    projects: { [slash(folder)]: projectEntry, [folder]: projectEntry },
  }))
  fs.writeFileSync(path.join(claudeHome, 'settings.json'), JSON.stringify({ skipDangerousModePermissionPrompt: true }))

  const target = slash(folder)
  const prompt = `This is an automated test in a disposable temporary directory. Use the Bash tool exactly once to run this exact command, unchanged: rm -rf ${target} -- If the command is denied or fails, do not retry it and do not run any other tool; just reply DONE.`
  const samples = slash(path.join(tmp, 'samples.jsonl'))
  const stopPoll = slash(path.join(tmp, 'stop-poll'))

  let inst: IsolatedInstance | undefined
  let userData = ''
  try {
    inst = await launchIsolated('t0664-v2', log, { env: { CLAUDE_CONFIG_DIR: claudeHome } })
    const { win } = inst
    userData = inst.userData
    await checkVersion(inst)
    await seedWorkspace(win, {
      workspaces: [{
        id: WS, name: 'T0664 claude', folderPath: folder, createdAt: Date.now(), defaultAgent: 'claude-cli',
        agentCustomArgs: { 'claude-cli': `--dangerously-skip-permissions --model ${CLAUDE_MODEL}` },
      }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: TOWER,
    }, TOWER)

    const [role, dispatch] = await h.runInTab(win, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      { kind: 'helper', script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--agent', 'claude-cli', '--prompt', prompt] },
    ])
    expect(role.code, role.stderr).toBe(0)
    expect(dispatch.code, dispatch.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(dispatch.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    log(`claude Worker ${worker} dispatched (one prompt = one turn)`)
    const pollOut = await h.startInTab(win, TOWER, [{ kind: 'poll', terminalId: worker, everyMs: 2_000, until: stopPoll, samples }])

    // The turn: SessionStart → UserPromptSubmit → Bash → PermissionRequest → (120 s auto-deny) →
    // PostToolBatch → reply → Stop. Wait for the Stop report (or give up after 7 minutes).
    const stopSeen = () => readScriptsLog(userData).some(e => e.script === 'bat-hook' && e.terminalId === worker && e.hook === 'stop')
    // A claude stuck in front of the prompt (a first-run dialog) never reports UserPromptSubmit: stop after 90 s.
    const promptSeen = () => readScriptsLog(userData).some(e => e.script === 'bat-hook' && e.terminalId === worker && e.hook === 'user-prompt-submit')
    const started = Date.now()
    const deadline = started + 420_000
    while (!stopSeen() && Date.now() < deadline && (promptSeen() || Date.now() - started < 90_000)) await win.waitForTimeout(2_000)
    await win.waitForTimeout(4_000)
    fs.writeFileSync(stopPoll, '')
    await h.results(pollOut, 1, 30_000)

    const [output] = await h.runInTab(win, TOWER, [{ kind: 'mcp', requests: [call('bat_read_output', { terminalId: worker, maxLines: 200 })] }])
    const outputText = ((output.replies?.[0]?.result as { content?: Array<{ text: string }> } | undefined)?.content ?? []).map(c => c.text).join('\n')
    saveEvidence('v2-worker-output.txt', outputText)
    const sampleLines = fs.existsSync(samples) ? fs.readFileSync(samples, 'utf8').trim().split('\n').filter(Boolean) : []
    saveEvidence('v2-state-samples.jsonl', sampleLines.join('\n'))
    const debug = readDebugLog(userData)
    const blockedLines = debug.split('\n').filter(l => l.includes(`terminal=${worker}`) && /\[(blocked|bat-mcp|agent-start|agent-command)\]/.test(l))
    saveEvidence('v2-debug.log', blockedLines.join('\n'))
    const entries = readScriptsLog(userData).filter(e => e.terminalId === worker && e.script === 'bat-hook' && e.event === 'report-hook')
    saveEvidence('v2-bat-scripts.jsonl', entries.map(e => JSON.stringify(e)).join('\n'))
    const hookSeq = entries.map(e => `${e.ts} ${e.hook}${e.agent ? ` agent=${e.agent}` : ''} → ${e.result}`)
    const turns = entries.filter(e => e.hook === 'user-prompt-submit').length

    const permissionAt = entries.find(e => e.hook === 'permission-request' && e.result === 'blocked')?.ts as string | undefined
    const clearedAt = entries.find(e => e.hook === 'post-tool-batch' && e.result === 'cleared')?.ts as string | undefined
    const stopEntry = entries.find(e => e.hook === 'stop')
    const v2: string[] = [`claude turns (UserPromptSubmit reports): ${turns}`, ...hookSeq]
    if (!permissionAt) {
      v2.push(`no permission-request reached BAT; worker output saved to ${path.join(EVIDENCE_DIR, 'v2-worker-output.txt')}`)
      record('V2', 'needs-human', [...v2, `prompt tried: ${prompt}`, 'mode: --dangerously-skip-permissions (bypass), embedded claude, model ' + CLAUDE_MODEL])
      return
    }
    const blockedSampled = sampleLines.some(l => { const s = JSON.parse(l); return s.state === 'blocked' && s.blockedReason === 'permission' && s.source === 'hook' })
    const firstCleared = sampleLines.map(l => JSON.parse(l)).find(s => s.t > (clearedAt ?? '9') && s.state !== 'blocked')
    const a = blockedSampled
    const b = Boolean(clearedAt && stopEntry && clearedAt < String(stopEntry.ts) && stopEntry.result !== 'cleared')
    const c = blockedLines.some(l => l.includes(`[blocked] terminal=${worker} → blocked reason=permission (hook permission-request tool=Bash)`))
      && blockedLines.some(l => l.includes(`[blocked] terminal=${worker} → cleared (hook post-tool-batch)`))
      && !blockedLines.some(l => l.includes(`[blocked] terminal=${worker} → cleared (user input)`))
    v2.push(`(a) blocked / permission / hook sampled by the Tower: ${a}`)
    v2.push(`(b) permission at ${permissionAt}, post-tool-batch cleared at ${clearedAt ?? 'never'}, Stop at ${stopEntry?.ts ?? 'never'} (${stopEntry?.result ?? '-'}); first non-blocked sample after the clear: ${firstCleared ? `${firstCleared.t} ${firstCleared.state}` : 'none'}`)
    v2.push(`(c) debug log: ${blockedLines.filter(l => l.includes('[blocked]')).map(l => l.replace(/^.*?\[blocked\]/, '[blocked]')).join(' / ')}`)
    v2.push(`turns ${turns} (limit 3)`)
    record('V2', a && b && c && turns <= 3, v2)
    expect(readVerdicts().V2?.verdict).toBe('PASS')
  } finally {
    if (inst) await closeIsolated(inst, log)
    if (userData) log(`claude processes of this instance left after teardown: ${(await leftoverClaude(userData)) || 'none'}`)
    fs.rmSync(tmp, { recursive: true, force: true })
    log(`temp dir removed: ${!fs.existsSync(tmp)}`)
  }
})
