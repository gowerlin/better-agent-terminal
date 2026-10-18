// PLAN-047 M1b-2 / T0621 (D158): a real codex TUI (>= 0.163.0) dispatched by a real isolated BAT
// reports `blocked` / `agentStarted` through its own OSC 7501 — without calling a model.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. codex runs its
// real TUI in the Worker tab; the model is a fake OpenAI Responses API in this test process
// (127.0.0.1, SSE), configured in the isolated BAT's own `CODEX_HOME/config.toml` (a temp dir: no
// login, the user's `~/.codex` is never read or written). The fake answers the Worker's first turn
// with an `exec_command` that asks for escalation (the Worker runs `-a on-request -s read-only`, the
// workspace codex args), so codex shows its approval prompt; after the approval it answers `ok`.
// The PATH of the isolated BAT starts with the directory of that codex, so the dispatch's version
// check (C-5, `codex --version`) and the tab's shell both find it.
//
//   1. the Tower dispatches `--agent codex … --wait-started 60000` into a trusted folder → exit 0,
//      "  started: <ISO>"; bat_get_state(Worker): blockedDetection osc, agentStarted true
//   2. the approval prompt → blocked / input / source osc (bat_get_state); `y` into the Worker tab
//      → cleared (working / idle); the OSC 7501 bytes still reach the tab (read-only tap)
//   3. dispatch into an untrusted git repository ("Trust this folder?", no OSC 7501) with
//      `--wait-started 15000` → exit 8, "  started: unconfirmed", stderr create: LAUNCH_UNCONFIRMED;
//      the tab is not closed
//   4. logs: `[codex-version] path=… version=<x.y.z> (probed|cached)`, `[codex-state]`, `[blocked] …
//      reason=input (osc)` / `cleared (osc …)`; never the output (a marker the tool command prints on
//      the screen) and never a token. The dispatch command carries `-c check_for_update_on_startup=false` (C-6)
//
// Skipped (with the reason) when no codex >= 0.163.0 is found: BAT_E2E_CODEX, the official installer
// (%LOCALAPPDATA%\Programs\OpenAI\Codex\bin), PATH, the bundled one. Windows only (pwsh tabs).
// Run it whenever codex is upgraded (OSC 7501 is undocumented).

import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0621')
const WS = 'e2e-t0621-ws'
const TOWER = 'e2e-t0621-tower'
const MARKER = 'T0621-SECRET-OUTPUT'
const WORKER_CODEX_ARGS = '-a on-request -s read-only'
const MODERN = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }

function codexVersion(bin: string): string | null {
  try {
    return /codex-cli\s+v?(\d+\.\d+\.\d+)/.exec(execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 15_000, windowsHide: true }))?.[1] ?? null
  } catch {
    return null
  }
}

function atLeast(version: string, min: string): boolean {
  const a = version.split('.').map(Number)
  const b = min.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return true
}

/** The first codex.exe >= 0.163.0 (OSC 7501) on this machine, or null. */
function findOscCodex(): { bin: string; version: string } | null {
  if (process.platform !== 'win32') return null
  const candidates: string[] = []
  if (process.env.BAT_E2E_CODEX) candidates.push(process.env.BAT_E2E_CODEX)
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  candidates.push(path.join(local, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'))
  for (const dir of (process.env.PATH ?? '').split(';')) if (dir.trim()) candidates.push(path.join(dir.trim().replace(/^"(.*)"$/, '$1'), 'codex.exe'))
  const vendor = path.join(REPO_ROOT, 'node_modules', '@openai', `codex-${process.platform}-${process.arch}`, 'vendor')
  try {
    for (const triple of fs.readdirSync(vendor)) candidates.push(path.join(vendor, triple, 'bin', 'codex.exe'))
  } catch { /* not installed */ }
  for (const bin of candidates) {
    if (!fs.existsSync(bin)) continue
    const version = codexVersion(bin)
    if (version && atLeast(version, '0.163.0')) return { bin, version }
  }
  return null
}

const CODEX = findOscCodex()

interface McpReply { id: number; result?: Record<string, unknown>; error?: { code: number; message: string } }
interface StepResult { kind: string; code?: number | null; stdout?: string; stderr?: string; ms?: number; token?: string; replies?: McpReply[] }

/** helper / mcp / env steps inside a tab, with the tab's own env (its scoped capability). */
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
      results.push({ kind: 'env', token: env.BAT_REMOTE_TOKEN })
    } else if (step.kind === 'helper') {
      const started = Date.now()
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...step.args.map(sub)], { env, encoding: 'utf8', timeout: step.timeoutMs || 60000, windowsHide: true })
      results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr, ms: Date.now() - started })
    } else if (step.kind === 'mcp') {
      results.push(await mcp(step.requests))
    }
    flush()
  }
})()
`

const call = (name: string, args: Record<string, unknown> = {}) => ({ method: 'tools/call', params: { name, arguments: args, ...MODERN } })

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

/** The fake Responses API: the first turn of a session that has tools gets one escalated tool call, everything else `ok`. */
function startFakeModel(toolCommand: string): Promise<{ port: number; requests: string[]; close(): Promise<void> }> {
  const requests: string[] = []
  let toolSent = false
  const usage = { input_tokens: 1, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 2 }
  const sse = (res: http.ServerResponse, events: unknown[]) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    for (const e of events) res.write(`event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`)
    res.end()
  }
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', d => { body += d })
    req.on('end', () => {
      requests.push(`${req.method} ${req.url}`)
      if (!req.url?.includes('/responses')) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{}'); return }
      let j: { tools?: Array<{ name?: string; type?: string }>; input?: Array<{ type?: string }> } = {}
      try { j = JSON.parse(body) } catch { /* empty */ }
      const tools = (j.tools ?? []).map(t => t.name ?? t.type ?? '')
      const id = `resp_${requests.length}`
      const hasOutput = (j.input ?? []).some(i => i.type === 'function_call_output' || i.type === 'custom_tool_call_output')
      if (toolSent || hasOutput || tools.length === 0) {
        sse(res, [
          { type: 'response.created', response: { id } },
          { type: 'response.output_item.done', item: { type: 'message', role: 'assistant', id: `msg_${id}`, content: [{ type: 'output_text', text: 'ok' }] } },
          { type: 'response.completed', response: { id, usage } },
        ])
        return
      }
      toolSent = true
      const [name, args] = tools.includes('shell_command')
        ? ['shell_command', { command: toolCommand, sandbox_permissions: 'require_escalated', justification: 'T0621 approval probe' }]
        : tools.includes('exec_command')
          ? ['exec_command', { cmd: toolCommand, sandbox_permissions: 'require_escalated', justification: 'T0621 approval probe' }]
          : ['shell', { command: ['powershell', '-Command', toolCommand] }]
      sse(res, [
        { type: 'response.created', response: { id } },
        { type: 'response.output_item.done', item: { type: 'function_call', id: `fc_${id}`, call_id: `call_${id}`, name, arguments: JSON.stringify(args) } },
        { type: 'response.completed', response: { id, usage } },
      ])
    })
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    port: (server.address() as { port: number }).port,
    requests,
    close: () => new Promise<void>(r => { server.closeAllConnections?.(); server.close(() => r()) }),
  })))
}

test.skip(process.platform !== 'win32', 'pwsh tabs and codex.exe resolution: Windows only')
test.skip(!CODEX, 'no codex >= 0.163.0 found (BAT_E2E_CODEX, %LOCALAPPDATA%\\Programs\\OpenAI\\Codex\\bin, PATH, bundled): OSC 7501 needs it')

test('codex OSC 7501: --wait-started started / unconfirmed, blocked / input / osc and its clearing (real codex TUI, no model call)', async () => {
  test.setTimeout(420_000)
  const startedAt = Date.now()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0621-'))
  const folder = path.join(tmp, 'ws')
  const trusted = path.join(folder, 'trusted')
  const untrusted = path.join(folder, 'untrusted')
  const codexHome = path.join(tmp, 'codex-home')
  for (const dir of [folder, trusted, untrusted, codexHome]) fs.mkdirSync(dir, { recursive: true })
  execFileSync('git', ['init', '-q', untrusted], { timeout: 15_000, windowsHide: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)
  const fake = await startFakeModel(`Write-Output ${MARKER}`)
  const toml = (s: string) => `'${s}'`
  fs.writeFileSync(path.join(codexHome, 'config.toml'), [
    'model = "gpt-mock"',
    'model_provider = "mock"',
    '',
    '[model_providers.mock]',
    'name = "mock"',
    `base_url = "http://127.0.0.1:${fake.port}/v1"`,
    'wire_api = "responses"',
    '',
    `[projects.${toml(trusted)}]`,
    'trust_level = "trusted"',
    '',
  ].join('\n'))
  log(`codex ${CODEX!.version} at ${CODEX!.bin}; fake model on 127.0.0.1:${fake.port}`)

  let specSeq = 0
  const runInTab = async (win: Page, id: string, steps: unknown[], timeout = 120_000): Promise<StepResult[]> => {
    const n = specSeq++
    const out = slash(path.join(tmp, `tab-${n}.json`))
    const spec = slash(path.join(tmp, `tab-${n}-spec.json`))
    fs.writeFileSync(spec, JSON.stringify({ out, steps }))
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id, line: `node "${runner}" "${spec}"\r` })
    const read = () => (fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) as StepResult[] : [])
    await expect.poll(() => read().length >= steps.length, { timeout }).toBe(true)
    const r = read()
    log(`${path.basename(out)}: ${JSON.stringify(r).replace(/batcap\.[A-Za-z0-9_-]+/g, 'batcap.<redacted>').slice(0, 3000)}`)
    return r
  }
  const state = async (win: Page, terminalId: string): Promise<Record<string, unknown>> => {
    const [mcp] = await runInTab(win, TOWER, [{ kind: 'mcp', requests: [call('bat_get_state', { terminalId })] }])
    return mcp.replies?.[0]?.result?.structuredContent as Record<string, unknown>
  }
  const dispatch = (cwd: string, workorder: string, waitMs: number) => ({
    kind: 'helper',
    script: 'bat-terminal.mjs',
    timeoutMs: waitMs + 60_000,
    args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--agent', 'codex', '--skill', 'ct-exec', '--workorder', workorder, '--cwd', cwd, '--mode', 'yolo', '--wait-started', String(waitMs)],
  })

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0621', log, { env: { PATH: `${path.dirname(CODEX!.bin)};${process.env.PATH ?? ''}`, CODEX_HOME: codexHome } })
    const { win, userData } = inst
    const debugLog = () => {
      const dir = path.join(userData, 'Logs')
      return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    }
    const buffer = async (id: string) => ((await win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), id)) as { data?: string } | null)?.data ?? ''

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [{ id: WS, name: 'T0621', folderPath: folder, createdAt: Date.now(), agentCustomArgs: { 'codex-cli': WORKER_CODEX_ARGS } }],
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

    // ── guard: the tab's shell (pwsh, with the user's profile) runs that codex ──
    const whichFile = path.join(tmp, 'which.txt')
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: TOWER, line: `(Get-Command codex).Source | Out-File -Encoding utf8 '${whichFile}'\r` })
    await expect.poll(() => fs.existsSync(whichFile), { timeout: 30_000 }).toBe(true)
    await expect.poll(() => fs.readFileSync(whichFile, 'utf8').replace(/^﻿/, '').trim().toLowerCase(), { timeout: 5_000 }).toBe(CODEX!.bin.toLowerCase())

    // ── 1. dispatch into the trusted folder, --wait-started → started ──
    const [role, started] = await runInTab(win, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      dispatch(trusted, 'T0621', 60_000),
    ], 180_000)
    expect(role.code, role.stderr).toBe(0)
    expect(started.code, `${started.stdout}\n${started.stderr}`).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(started.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    const startedLine = (started.stdout ?? '').trim().split(/\r?\n/).at(-1)!
    log(`--wait-started (trusted): ${JSON.stringify(startedLine)} after ${started.ms} ms`)
    expect(startedLine).toMatch(/^ {2}started: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    const first = await state(win, worker!)
    log(`bat_get_state (started): ${JSON.stringify(first)}`)
    expect(first).toMatchObject({ terminalId: worker, blockedDetection: 'osc', agentStarted: true, agentStartedAt: expect.any(Number) })

    // ── 2. the approval prompt → blocked / input / osc; `y` → cleared ──
    try {
      await expect.poll(() => debugLog().includes(`[blocked] terminal=${worker} → blocked reason=input (osc)`), { timeout: 60_000 }).toBe(true)
    } catch (error) {
      log(`worker screen: ${stripAnsi(await buffer(worker!)).slice(-3000)}`)
      log(`fake model requests: ${JSON.stringify(fake.requests)}`)
      throw error
    }
    const blocked = await state(win, worker!)
    log(`bat_get_state (approval prompt): ${JSON.stringify(blocked)}`)
    expect(blocked).toMatchObject({ terminalId: worker, state: 'blocked', blockedReason: 'input', blockedSince: expect.any(Number), source: 'osc', blockedDetection: 'osc', agentStarted: true })
    expect(stripAnsi(await buffer(worker!))).toContain(MARKER) // the command is on the screen…
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'y'), worker)
    await expect.poll(() => /\[blocked\] terminal=\S+ → cleared \(osc (working|idle)\)/.test(debugLog().split('\n').filter(l => l.includes(worker!)).join('\n')), { timeout: 30_000 }).toBe(true)
    const cleared = await state(win, worker!)
    log(`bat_get_state (approved): ${JSON.stringify(cleared)}`)
    expect(cleared.state).not.toBe('blocked')
    expect(cleared).toMatchObject({ blockedDetection: 'osc', agentStarted: true })
    const raw = await buffer(worker!)
    expect(raw).toContain('\x1b]7501;state=') // read only: the sequence still reaches the tab
    expect(stripAnsi(raw)).toContain('check_for_update_on_startup=false') // C-6, the command as typed

    // ── 3. an untrusted git repository: "Trust this folder?", no OSC 7501 → unconfirmed (exit 8) ──
    const [unconfirmed] = await runInTab(win, TOWER, [dispatch(untrusted, 'T0622', 15_000)], 150_000)
    log(`--wait-started (untrusted): code=${unconfirmed.code} stdout=${JSON.stringify(unconfirmed.stdout)} stderr=${JSON.stringify(unconfirmed.stderr)} ${unconfirmed.ms} ms`)
    expect(unconfirmed.code).toBe(8)
    expect((unconfirmed.stdout ?? '').trim().split(/\r?\n/).at(-1)).toBe('  started: unconfirmed')
    expect(unconfirmed.stderr).toContain('create: LAUNCH_UNCONFIRMED')
    const stuck = /Terminal created: (\S+)/.exec(unconfirmed.stdout ?? '')?.[1]
    expect(stuck).toBeTruthy()
    const stuckState = await state(win, stuck!)
    log(`bat_get_state (trust prompt): ${JSON.stringify(stuckState)}`)
    expect(stuckState).toMatchObject({ terminalId: stuck, blockedDetection: 'osc', agentStarted: false })
    expect(stuckState.state).not.toBe('exited') // the tab is kept
    expect(stripAnsi(await buffer(stuck!))).toMatch(/trust/i)

    // ── 4. logs ──
    const debug = debugLog()
    const versionLines = debug.split('\n').filter(l => l.includes('[codex-version]'))
    log(`version check: ${versionLines.map(l => l.replace(/^.*\[codex-version\]/, '[codex-version]')).join(' | ')}`)
    expect(versionLines[0]).toContain(`[codex-version] path=${CODEX!.bin} version=${CODEX!.version} (probed)`)
    expect(versionLines[1]).toContain(`version=${CODEX!.version} (cached)`)
    expect(debug).toContain(`[codex-state] terminal=${worker} → idle`)
    expect(debug).toContain(`[agent-start] terminal=${worker} → started (osc `)
    expect(debug).not.toContain(`[agent-start] terminal=${stuck}`)
    expect(debug).not.toContain(MARKER)
    expect(debug).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    const scriptsLog = fs.readFileSync(path.join(userData, 'Logs', 'bat-scripts.log'), 'utf8')
    expect(scriptsLog).not.toContain(MARKER)
    expect(scriptsLog).not.toMatch(/batcap\.[A-Za-z0-9_-]{16,}/)
    // the fake model only — and nothing but /responses was needed
    log(`fake model requests: ${JSON.stringify(fake.requests)}`)
    expect(fake.requests.filter(r => r.includes('/responses')).length).toBeGreaterThanOrEqual(2)

    log(`T0621 spec body took ${Math.round((Date.now() - startedAt) / 1000)} s`)
  } finally {
    if (inst) await closeIsolated(inst, log)
    await fake.close()
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 })
  }
})
