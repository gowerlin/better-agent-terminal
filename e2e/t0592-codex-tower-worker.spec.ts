// D153 A layer / T0592: the real codex CLI (bundled `codex app-server`) against a real isolated
// BAT, as Codex Tower and Codex Worker — without calling a model and without spending a token.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. The isolated
// BAT gets a PATH whose first entry holds a fake `codex.cmd` (the same shape as npm's codex shim):
// whatever BAT types into a tab as `codex …` lands in fake-codex.cjs, which records the argv the
// tab's shell produced and starts the BUNDLED codex as `codex <the same -c overrides> app-server`
// with the tab's own env (its scoped capability). The codex TUI never starts and no turn is opened:
// only `initialize` / `mcpServerStatus/list` / `thread/start { ephemeral }` / `mcpServer/tool/call`
// / `command/exec`. A `model_providers` override points codex at 127.0.0.1:9, so `thread/start`
// does not pre-connect to api.openai.com (it does with the default provider: 401 without
// credentials, T0592 probe), and every codex gets an empty temp CODEX_HOME (no login).
// The isolated BAT's own CODEX_HOME is an empty temp dir as well, and the spec stops before the
// first dispatch unless the tab's shell resolves `codex` to the fake.
//
//   1. Tower tab: `codex <BAT's codex MCP args> <workspace codex args>` typed into pwsh, as a codex
//      tab is launched. Through codex `command/exec` it runs `bat-terminal.mjs --set-role tower`
//      and dispatches `--agent codex --skill ct-exec --workorder T0592`; through codex
//      `mcpServer/tool/call`: bat_whoami = tower, bat_list_terminals has the Worker,
//      bat_get_state(Worker).blockedDetection = none
//   2. Worker tab (the dispatched codex): bat_whoami = worker of the Tower, bat_read_output of the
//      Tower → NOT_OWNER (isError), bat_get_state(self).blockedDetection = none
//   3. dispatch command: the Worker's argv (as its shell parsed BAT's command) = codex, BAT MCP
//      `-c mcp_servers.bat.*` (with env_vars), the workspace codex args (not the Settings ones),
//      `$ct-exec T0592`; no `--settings=` / `--mcp-config=`; main log `[agent-command] resolved`
//      / `[bat-mcp] dispatch agent=codex-cli … injected` without claude hooks
//   4. codex `command/exec` children see BAT_REMOTE_PORT / BAT_REMOTE_TOKEN / BAT_TERMINAL_ID /
//      BAT_TOWER_TERMINAL_ID / BAT_HELPER_DIR (names only, never the token value), and the
//      Worker's `bat-notify --submit` through codex reaches the Tower (pre-fill in its PTY)
//   5. (in 1 and 2) T0590 leaves codex alone: blockedDetection none
//
// Skipped when the bundled codex is absent. Run it whenever the bundled codex is upgraded.

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0592')
const WS = 'e2e-t0592-ws'
const TOWER = 'e2e-t0592-tower'
const WORKORDER = 'T0592'
const NOTIFY_TEXT = 'T0592 完成'
const WORKSPACE_CODEX_ARGS = '--search -c model_reasoning_effort=low'
const SETTINGS_CODEX_ARGS = '--t0592-settings-arg'
const ENV_NAMES = ['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_TERMINAL_ID', 'BAT_TOWER_TERMINAL_ID', 'BAT_HELPER_DIR', 'BAT_WORKSPACE_ID', 'BAT_SESSION', 'BAT_USER_DATA']

function bundledCodex(): string | null {
  const pkgDir = path.join(REPO_ROOT, 'node_modules', '@openai', `codex-${process.platform}-${process.arch}`, 'vendor')
  const exe = process.platform === 'win32' ? 'codex.exe' : 'codex'
  let triples: string[]
  try { triples = fs.readdirSync(pkgDir) } catch { return null }
  for (const triple of triples) {
    for (const rel of [['bin', exe], ['codex', exe]]) {
      const candidate = path.join(pkgDir, triple, ...rel)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

const CODEX = bundledCodex()

/** Prints which BAT_* names this process has; the token only as present / `batcap.` prefix. `net`: TCP connect to BAT. */
const ENV_PROBE = `
const names = ${JSON.stringify(ENV_NAMES)}
const token = process.env.BAT_REMOTE_TOKEN
const out = { has: Object.fromEntries(names.map(n => [n, typeof process.env[n] === 'string' && process.env[n] !== ''])), tokenIsCapability: token ? token.startsWith('batcap.') : null }
if (process.argv[2] === 'net') {
  const socket = require('net').connect({ host: '127.0.0.1', port: Number(process.env.BAT_REMOTE_PORT) })
  const done = r => { out.net = r; socket.destroy(); console.log(JSON.stringify(out)) }
  socket.setTimeout(5000, () => done('timeout'))
  socket.on('connect', () => done('connected'))
  socket.on('error', e => done('error:' + e.code))
} else {
  console.log(JSON.stringify(out))
}
`

/** \`node helper-run.cjs <script> ...args\`: $BAT_* placeholders from THIS process's env, then node $BAT_HELPER_DIR/<script>. */
const HELPER_RUN = `
const path = require('path')
const { spawnSync } = require('child_process')
const env = process.env
const sub = s => s.replace(/\\$BAT_TOWER_TERMINAL_ID/g, env.BAT_TOWER_TERMINAL_ID || '').replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || '')
if (!env.BAT_HELPER_DIR) { console.log(JSON.stringify({ code: null, error: 'BAT_HELPER_DIR missing' })); process.exit(1) }
const [script, ...args] = process.argv.slice(2)
const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, script), ...args.map(sub)], { env, encoding: 'utf8', timeout: 30000, windowsHide: true })
console.log(JSON.stringify({ code: run.status, stdout: run.stdout, stderr: run.stderr }))
process.exit(run.status === 0 ? 0 : 1)
`

/**
 * The fake \`codex\`: records argv, starts the bundled codex app-server with the same -c overrides
 * (+ the offline provider) and runs the spec's steps. Spec: $T0592_SPEC, else the Worker spec.
 *   - { kind: 'rpc', method, params }
 *   - { kind: 'tool', name, args }           mcpServer/tool/call on server 'bat' (thread on demand)
 *   - { kind: 'exec', argv, sandbox?, capture? }  command/exec; capture = { name, regex } from stdout
 *   - { kind: 'waitFile', file, timeoutMs } / { kind: 'sleep', ms }
 * Strings (not in exec argv): $BAT_TERMINAL_ID / $BAT_TOWER_TERMINAL_ID from this env, $<capture name> from captures.
 */
const FAKE_CODEX = (conf: { codex: string; tmp: string; workerSpec: string }) => `
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const CONF = ${JSON.stringify(conf)}
const OFFLINE = ['model_provider="bat_offline"', 'model_providers.bat_offline={name="BAT offline",base_url="http://127.0.0.1:9/v1",wire_api="responses"}']
const env = process.env
const argv = process.argv.slice(2)
const vars = { BAT_TOWER_TERMINAL_ID: env.BAT_TOWER_TERMINAL_ID || '', BAT_TERMINAL_ID: env.BAT_TERMINAL_ID || '' }
const sub = s => String(s).replace(/\\$([A-Z_]+)/g, (m, k) => k in vars ? vars[k] : m)
const subAll = v => typeof v === 'string' ? sub(v) : Array.isArray(v) ? v.map(subAll) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subAll(x)])) : v
const write = (file, data) => { fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2)); fs.renameSync(file + '.tmp', file) }
const progressFile = path.join(CONF.tmp, 'progress-' + (env.BAT_TERMINAL_ID || 'none') + '.log')
const progress = text => fs.appendFileSync(progressFile, new Date().toISOString() + ' ' + text + '\\n')
process.on('uncaughtException', e => { progress('uncaught: ' + (e && e.stack || e)); process.exit(1) })
process.on('exit', code => progress('fake codex exit ' + code))
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) process.on(sig, () => { progress('signal ' + sig); process.exit(130) })
write(path.join(CONF.tmp, 'argv-' + (env.BAT_TERMINAL_ID || 'none') + '.json'), argv)
const spec = JSON.parse(fs.readFileSync(env.T0592_SPEC || CONF.workerSpec, 'utf8'))
const overrides = []
for (let i = 0; i < argv.length; i++) if (argv[i] === '-c' && i + 1 < argv.length) overrides.push(argv[++i])
const home = fs.mkdtempSync(path.join(CONF.tmp, 'codex-home-'))
const child = spawn(CONF.codex, [...[...overrides, ...OFFLINE].flatMap(v => ['-c', v]), 'app-server'], { env: { ...env, CODEX_HOME: home }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
let buf = ''
let stderr = ''
const waiters = new Map()
child.stdout.setEncoding('utf8')
child.stdout.on('data', d => {
  buf += d
  let nl
  while ((nl = buf.indexOf('\\n')) >= 0) {
    const line = buf.slice(0, nl)
    buf = buf.slice(nl + 1)
    let m
    try { m = JSON.parse(line) } catch { continue }
    if (m.id !== undefined && !m.method && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id) }
    else if (m.id !== undefined && m.method) child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 't0592 client: no server requests' } }) + '\\n')
  }
})
child.stderr.on('data', d => { stderr += d })
child.on('exit', (code, signal) => progress('codex app-server exit ' + code + ' ' + signal + ' stderr: ' + stderr.slice(-2000)))
let nextId = 1
const call = (method, params) => new Promise(resolve => {
  const id = nextId++
  const timer = setTimeout(() => { waiters.delete(id); resolve({ error: { message: 'timeout ' + method } }) }, 90000)
  waiters.set(id, m => { clearTimeout(timer); resolve(m) })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\\n')
})
;(async () => {
  const results = []
  const init = await call('initialize', { clientInfo: { name: 't0592', title: 't0592', version: '0.0.0' } })
  results.push({ kind: 'initialize', error: init.error, userAgent: init.result && init.result.userAgent })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\\n')
  let threadId
  for (const raw of spec.steps) {
    progress(raw.kind + ' ' + (raw.name || raw.method || ''))
    // exec argv is left alone: the command/exec child expands $BAT_* from its own env (helper-run.cjs)
    const step = raw.kind === 'exec' ? raw : subAll(raw)
    if (step.kind === 'rpc') {
      const r = await call(step.method, step.params || {})
      results.push({ kind: 'rpc', method: step.method, result: r.result, error: r.error })
    } else if (step.kind === 'tool') {
      if (!threadId) {
        const t = await call('thread/start', { ephemeral: true })
        threadId = t.result && t.result.thread && t.result.thread.id
        if (!threadId) { results.push({ kind: 'thread', error: t.error }); break }
      }
      const r = await call('mcpServer/tool/call', { server: 'bat', threadId, tool: step.name, arguments: step.args || {} })
      results.push({ kind: 'tool', name: step.name, result: r.result, error: r.error })
    } else if (step.kind === 'exec') {
      const params = { command: [process.execPath, ...step.argv], timeoutMs: 40000 }
      if (step.sandbox) params.sandboxPolicy = step.sandbox
      const r = await call('command/exec', params)
      const out = { kind: 'exec', sandbox: step.sandbox ? step.sandbox.type : 'default', result: r.result, error: r.error }
      if (step.capture && r.result) {
        const m = new RegExp(step.capture.regex).exec(r.result.stdout || '')
        if (m) vars[step.capture.name] = out.captured = m[1]
      }
      results.push(out)
    } else if (step.kind === 'waitFile') {
      const until = Date.now() + (step.timeoutMs || 60000)
      while (!fs.existsSync(step.file) && Date.now() < until) await new Promise(r => setTimeout(r, 250))
      results.push({ kind: 'waitFile', found: fs.existsSync(step.file) })
    } else if (step.kind === 'sleep') {
      await new Promise(r => setTimeout(r, step.ms))
    }
  }
  const exited = new Promise(r => { if (child.exitCode !== null) r(); else child.once('exit', r) })
  child.stdin.end()
  child.kill()
  await exited
  results.push({ kind: 'codex-stderr', openaiHost: /api\\.openai\\.com|chatgpt\\.com\\/backend-api\\/codex/.test(stderr), errorLines: stderr.split('\\n').filter(l => /ERROR/.test(l)).map(l => l.replace(/\\x1b\\[[0-9;]*m/g, '').slice(0, 300)) })
  write(sub(spec.out), results)
  try { fs.rmSync(home, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }) } catch {}
})()
`

interface ToolResult { content?: Array<{ text: string }>; structuredContent?: Record<string, unknown>; isError?: boolean }
interface Step {
  kind: string
  name?: string
  method?: string
  sandbox?: string
  captured?: string
  found?: boolean
  error?: unknown
  result?: Record<string, unknown> & ToolResult & { exitCode?: number; stdout?: string; stderr?: string }
  openaiHost?: boolean
  errorLines?: string[]
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

function readJson<T>(file: string): T | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as T : undefined
}

/** The `-c` values (in order) of an argv. */
function cValues(argv: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < argv.length; i++) if (argv[i] === '-c') out.push(argv[++i])
  return out
}

test.skip(!CODEX, 'bundled codex (node_modules/@openai/codex-<platform>-<arch>) is not installed')
test.skip(process.platform !== 'win32', 'the fake codex shim and the pwsh launch line are Windows-only')

/** The whole flow; `shellSetting` = the `shell` key in settings.json (undefined = absent). */
async function scenario(label: string, shellSetting: string | undefined): Promise<void> {
  test.setTimeout(300_000)
  const started = Date.now()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0592-'))
  const folder = path.join(tmp, 'ws')
  const fakeDir = path.join(tmp, 'fake-bin')
  const batCodexHome = path.join(tmp, 'bat-codex-home')
  for (const dir of [folder, fakeDir, batCodexHome]) fs.mkdirSync(dir, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const envProbe = slash(path.join(tmp, 'envprobe.cjs'))
  const helperRun = slash(path.join(tmp, 'helper-run.cjs'))
  const workerSpec = slash(path.join(tmp, 'worker-spec.json'))
  const towerSpec = slash(path.join(tmp, 'tower-spec.json'))
  const towerOut = slash(path.join(tmp, 'tower-result.json'))
  fs.writeFileSync(envProbe, ENV_PROBE)
  fs.writeFileSync(helperRun, HELPER_RUN)
  fs.writeFileSync(path.join(tmp, 'fake-codex.cjs'), FAKE_CODEX({ codex: CODEX!, tmp: slash(tmp), workerSpec }))
  fs.writeFileSync(path.join(fakeDir, 'codex.cmd'), `@echo off\r\n"${process.execPath}" "${path.join(tmp, 'fake-codex.cjs')}" %*\r\n`)

  const full = { type: 'dangerFullAccess' }
  fs.writeFileSync(towerSpec, JSON.stringify({
    out: towerOut,
    steps: [
      { kind: 'exec', argv: [envProbe] },
      { kind: 'exec', sandbox: full, argv: [helperRun, 'bat-terminal.mjs', '--set-role', 'tower', '--mode', 'yolo'] },
      { kind: 'exec', sandbox: full, capture: { name: 'WORKER', regex: 'Terminal created: ([A-Za-z0-9_-]+)' }, argv: [helperRun, 'bat-terminal.mjs',
        '--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--agent', 'codex', '--skill', 'ct-exec', '--workorder', WORKORDER, '--mode', 'yolo'] },
      { kind: 'tool', name: 'bat_whoami' },
      { kind: 'tool', name: 'bat_list_terminals' },
      { kind: 'tool', name: 'bat_get_state', args: { terminalId: '$WORKER' } },
    ],
  }))
  fs.writeFileSync(workerSpec, JSON.stringify({
    out: slash(path.join(tmp, 'worker-result-$BAT_TERMINAL_ID.json')),
    steps: [
      { kind: 'rpc', method: 'mcpServerStatus/list' },
      { kind: 'tool', name: 'bat_whoami' },
      { kind: 'tool', name: 'bat_read_output', args: { terminalId: '$BAT_TOWER_TERMINAL_ID' } },
      { kind: 'tool', name: 'bat_get_state' },
      { kind: 'exec', argv: [envProbe] },
      { kind: 'exec', argv: [envProbe, 'net'] },
      // the Tower's codex session must be over (its pwsh back at the prompt) before the pre-fill
      { kind: 'waitFile', file: towerOut, timeoutMs: 120_000 },
      { kind: 'sleep', ms: 2_000 },
      { kind: 'exec', sandbox: full, argv: [helperRun, 'bat-notify.mjs', '--source', WORKORDER, '--target', '$BAT_TOWER_TERMINAL_ID', '--submit', NOTIFY_TEXT] },
    ],
  }))

  const tool = (steps: Step[], name: string, nth = 0) => steps.filter(s => s.kind === 'tool' && s.name === name)[nth]?.result as ToolResult | undefined
  const execs = (steps: Step[]) => steps.filter(s => s.kind === 'exec')
  const redact = (v: unknown) => JSON.stringify(v).replace(/batcap\.[A-Za-z0-9_-]+/g, 'batcap.<redacted>')

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated(label, log, { env: { PATH: `${fakeDir};${process.env.PATH ?? ''}`, CODEX_HOME: batCodexHome } })
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const persisted = await win.evaluate(async ({ args, shell }) => {
      const api = (window as AnyApi).electronAPI
      const current = JSON.parse((await api.settings.load()) || '{}')
      const next = { ...current, agentCustomArgs: { ...(current.agentCustomArgs ?? {}), 'codex-cli': args } }
      if (shell) next.shell = shell
      else delete next.shell
      await api.settings.save(JSON.stringify(next))
      return { before: Object.prototype.hasOwnProperty.call(current, 'shell') ? current.shell : '(absent)', after: next.shell ?? '(absent)' }
    }, { args: SETTINGS_CODEX_ARGS, shell: shellSetting })
    log(`settings.json shell: ${persisted.before} → ${persisted.after}`)
    const seed = {
      workspaces: [{ id: WS, name: 'T0592', folderPath: folder, createdAt: Date.now(), agentCustomArgs: { 'codex-cli': WORKSPACE_CODEX_ARGS } }],
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
    const typeIn = (page: Page, id: string, line: string) => page.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id, line: `${line}\r` })

    // ── guard: the tab's shell (pwsh, with the user's profile) must resolve `codex` to the fake ──
    const whichFile = path.join(tmp, 'which.txt')
    await typeIn(win, TOWER, `(Get-Command codex).Source | Out-File -Encoding utf8 '${whichFile}'`)
    await expect.poll(() => fs.existsSync(whichFile), { timeout: 30_000 }).toBe(true)
    await expect.poll(() => fs.readFileSync(whichFile, 'utf8').trim().toLowerCase(), { timeout: 5_000 }).toBe(path.join(fakeDir, 'codex.cmd').toLowerCase())

    // ── 1. Codex Tower: launched like a codex tab (BAT's MCP args + the workspace codex args) ──
    const mcpArgs = await win.evaluate((extra) => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('codex-cli', 'pwsh', extra), WORKSPACE_CODEX_ARGS) as string
    log(`codex MCP args (pwsh): ${mcpArgs}`)
    expect(mcpArgs).toContain('mcp_servers.bat.env_vars=')
    await typeIn(win, TOWER, `$env:T0592_SPEC='${towerSpec}'; codex ${mcpArgs} ${WORKSPACE_CODEX_ARGS}`)
    await expect.poll(() => fs.existsSync(towerOut), { timeout: 150_000 }).toBe(true)
    const tower = readJson<Step[]>(towerOut)!
    log(`tower: ${redact(tower).slice(0, 6000)}`)

    expect(tower[0]).toMatchObject({ kind: 'initialize' })
    expect(tower[0].error).toBeUndefined()
    const [towerEnv, setRole, dispatch] = execs(tower)
    // 4. the codex `command/exec` child of the Tower sees the BAT env (names only)
    expect(towerEnv.result?.exitCode).toBe(0)
    const towerEnvOut = JSON.parse(towerEnv.result!.stdout!) as { has: Record<string, boolean>; tokenIsCapability: boolean }
    expect(towerEnvOut).toMatchObject({ has: { BAT_REMOTE_PORT: true, BAT_REMOTE_TOKEN: true, BAT_TERMINAL_ID: true, BAT_HELPER_DIR: true }, tokenIsCapability: true })
    expect(towerEnv.result!.stdout).not.toMatch(/batcap\./)
    // set-role and the dispatch through codex `command/exec`
    expect(setRole.result?.exitCode, redact(setRole)).toBe(0)
    expect(JSON.parse(setRole.result!.stdout!).stdout).toContain(`Tower role set: ${TOWER}`)
    expect(dispatch.result?.exitCode, redact(dispatch)).toBe(0)
    const worker = dispatch.captured
    expect(worker).toBeTruthy()
    expect(tool(tower, 'bat_whoami')?.structuredContent).toMatchObject({ terminalId: TOWER, role: 'tower', yolo: true, workspaceId: WS })
    expect(((tool(tower, 'bat_list_terminals')?.structuredContent as { terminals: Array<{ id: string }> }).terminals).map(t => t.id).sort()).toEqual([TOWER, worker!].sort())
    // 5. a codex Worker: no claude hooks → blockedDetection none
    expect(tool(tower, 'bat_get_state')?.structuredContent).toMatchObject({ terminalId: worker, blockedDetection: 'none' })
    expect(tower.at(-1)).toMatchObject({ kind: 'codex-stderr', openaiHost: false })

    // ── 2. Codex Worker (dispatched by BAT, its command parsed by its own shell) ──
    const workerOut = path.join(tmp, `worker-result-${worker}.json`)
    try {
      await expect.poll(() => fs.existsSync(workerOut), { timeout: 150_000 }).toBe(true)
    } catch (error) {
      const buffer = await win.evaluate((id) => (window as AnyApi).electronAPI.pty.getBuffer(id), worker)
      log(`worker tab output: ${stripAnsi((buffer as { data?: string } | null)?.data ?? '').slice(-4000)}`)
      log(`worker argv: ${fs.existsSync(path.join(tmp, `argv-${worker}.json`)) ? fs.readFileSync(path.join(tmp, `argv-${worker}.json`), "utf8") : "(none)"}`)
      const progressFile = path.join(tmp, `progress-${worker}.log`)
      log(`worker progress: ${fs.existsSync(progressFile) ? fs.readFileSync(progressFile, 'utf8') : '(none)'}`)
      throw error
    }
    const workerSteps = readJson<Step[]>(workerOut)!
    log(`worker: ${redact(workerSteps).slice(0, 6000)}`)
    expect(workerSteps[0].error).toBeUndefined()
    const status = (workerSteps.find(s => s.kind === 'rpc' && s.method === 'mcpServerStatus/list')?.result as { data: Array<{ name: string; serverInfo?: { name?: string }; tools?: Record<string, unknown> }> }).data.find(s => s.name === 'bat')
    expect(status?.serverInfo?.name).toBe('bat')
    expect(Object.keys(status?.tools ?? {}).sort()).toEqual(['bat_get_state', 'bat_list_terminals', 'bat_read_output', 'bat_wait', 'bat_whoami', 'bat_worktree_status'])
    expect(tool(workerSteps, 'bat_whoami')?.structuredContent).toMatchObject({ terminalId: worker, role: 'worker', towerTerminalId: TOWER, workorder: WORKORDER })
    expect(tool(workerSteps, 'bat_read_output')).toMatchObject({ isError: true, structuredContent: { code: 'NOT_OWNER' } })
    expect(tool(workerSteps, 'bat_get_state')?.structuredContent).toMatchObject({ terminalId: worker, blockedDetection: 'none' })
    // 4. the Worker's codex `command/exec` children: env, and bat-notify --submit to the Tower
    const [workerEnv, workerNet, notify] = execs(workerSteps)
    const workerEnvOut = JSON.parse(workerEnv.result!.stdout!) as { has: Record<string, boolean>; tokenIsCapability: boolean }
    expect(workerEnvOut).toMatchObject({ has: { BAT_REMOTE_PORT: true, BAT_REMOTE_TOKEN: true, BAT_TERMINAL_ID: true, BAT_TOWER_TERMINAL_ID: true, BAT_HELPER_DIR: true }, tokenIsCapability: true })
    log(`worker env (codex default sandbox): ${workerEnv.result!.stdout!.trim()}; TCP to BAT from the default sandbox: ${workerNet.result?.stdout?.trim()}`)
    expect(workerSteps.find(s => s.kind === 'waitFile')?.found).toBe(true)
    expect(notify.result?.exitCode, redact(notify)).toBe(0)
    expect(JSON.parse(notify.result!.stdout!).stderr).not.toContain('Forbidden')
    expect(workerSteps.at(-1)).toMatchObject({ kind: 'codex-stderr', openaiHost: false })
    await expect.poll(async () => {
      const buffer = await win.evaluate((id) => (window as AnyApi).electronAPI.pty.getBuffer(id), TOWER)
      return stripAnsi((buffer as { data?: string } | null)?.data ?? '')
    }, { timeout: 20_000 }).toContain(NOTIFY_TEXT)

    // ── 3. the dispatch command BAT built for `--agent codex`, as the Worker's shell parsed it ──
    const workerArgv = readJson<string[]>(path.join(tmp, `argv-${worker}.json`))!
    const towerArgv = readJson<string[]>(path.join(tmp, `argv-${TOWER}.json`))!
    log(`worker argv: ${JSON.stringify(workerArgv)}`)
    log(`tower argv: ${JSON.stringify(towerArgv)}`)
    const batMcp = cValues(workerArgv).filter(v => v.startsWith('mcp_servers.bat.'))
    expect(batMcp).toEqual([
      "mcp_servers.bat.command='node'",
      `mcp_servers.bat.args=['${path.join(REPO_ROOT, 'scripts', 'bat-mcp.mjs')}']`,
      expect.stringMatching(/^mcp_servers\.bat\.env_vars=\['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_TERMINAL_ID', .*\]$/),
      'mcp_servers.bat.tool_timeout_sec=60',
    ])
    // the codex tab (Tower) and the dispatch (Worker) give codex the same BAT MCP overrides
    expect(cValues(towerArgv).filter(v => v.startsWith('mcp_servers.bat.'))).toEqual(batMcp)
    // base [daemon opt-out when elevated] → BAT MCP → workspace codex args → `$ct-exec T0592`
    const tail = ['--search', '-c', 'model_reasoning_effort=low', `$ct-exec ${WORKORDER}`]
    expect(workerArgv.slice(-tail.length)).toEqual(tail)
    expect(workerArgv.indexOf('--search')).toBeGreaterThan(workerArgv.indexOf('mcp_servers.bat.tool_timeout_sec=60'))
    expect(workerArgv).not.toContain(SETTINGS_CODEX_ARGS)
    expect(workerArgv.join(' ')).not.toMatch(/--settings=|--mcp-config=|\/ct-exec/)
    const debugDir = path.join(userData, 'Logs')
    const debug = fs.readdirSync(debugDir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(debugDir, f), 'utf8')).join('\n')
    expect(debug).toMatch(/\[agent-command\] resolved agent=codex to codex-cli source=explicit .*argsSource=workspace/)
    const injected = debug.split('\n').find(l => l.includes(`[bat-mcp] dispatch agent=codex-cli terminal=${worker}`))
    log(`main log: ${injected}`)
    expect(injected).toContain('→ injected: -c ')
    expect(injected).not.toMatch(/--settings=|--mcp-config=|hooks=/)

    log(`T0592 spec body took ${Math.round((Date.now() - started) / 1000)} s`)
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
  }
}

// Settings → Shell left at its default ("auto", persisted once any setting is saved): the pwsh tab
// and the pwsh quoting of the dispatch agree.
test('codex CLI as Tower / Worker against a real BAT (app-server, no model call)', async () => {
  await scenario('t0592', 'auto')
})

// T0592 finding (product defect, not fixed here): settings.json without a `shell` key (a fresh
// install that never saved a setting) makes `terminal:create-agent-command` quote for posix
// (`resolveTerminalShell` → basename `pty-default` → `detectShellFamily` = posix) while the
// Windows PTY default is pwsh. The posix-quoted codex `-c` values (TOML literal strings, `'` escaped
// as `'\''`) then split in pwsh (argv `mcp_servers.bat.command=`, `\node\'`, …) and the Worker's
// codex exits at once: `invalid type: string "[", expected a
// sequence in mcp_servers.bat.args`. Remove fixme once the dispatch quotes for the PTY's real shell.
test.fixme('codex Worker dispatch with settings.json lacking "shell" (posix quoting into pwsh)', async () => {
  await scenario('t0592-noshell', undefined)
})
