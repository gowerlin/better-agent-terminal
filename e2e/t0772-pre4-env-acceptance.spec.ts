// T0772 (D215): v0.7.3-pre.4 acceptance in environments the user's machine does not have, built in temp
// directories (names contain `t0772`, all removed afterwards) and run against an isolated BAT — the
// installed build when BAT_E2E_EXECUTABLE points at it (see fixtures/electron-isolation.ts), else the
// source build. The user's PATH, global npm, ~/.codex, ~/.claude and native codex are never touched.
//
// ① BUG-189 / T0758 — codex installed by npm. `npm i -g --prefix <tmp>/npm --cache <tmp>/npm-cache
//    @openai/codex@0.166.0` (real download, real npm shims); the isolated BAT's PATH starts with that
//    prefix, `CODEX_HOME` is an empty temp dir (not logged in). The tabs run that real codex.
//    a) BAT MCP off → a Codex CLI tab from the "+" menu: `[codex-version]` resolves the npm shim to its
//       native codex.exe with version 0.166.0 (`via=<prefix>\codex.cmd`), the decision is
//       `→ injected: --no-daemon`, and the running codex.exe's command line carries `--no-daemon`.
//    b) BAT MCP on → another Codex CLI tab: the MCP args (`-c mcp_servers.bat.*`), no `--no-daemon`.
//    c) the shell tab declared as Tower dispatches a codex Worker (`--agent codex --wait-started`):
//       the dispatch probe sees 0.166.0 through the shim, so the Worker is `blockedDetection: osc`.
//       What a not-logged-in codex then shows and what `--wait-started` answers is recorded as is.
//    npm download failure → ① skipped with the reason (BLOCKED in the report).
//
// ② BUG-191 / T0760 — the CT plugin under `CLAUDE_CODE_PLUGIN_CACHE_DIR`. The embedded claude CLI
//    (`claude plugin marketplace add gowerlin/Control-Tower` + `claude plugin install ct@control-tower`;
//    a local fake marketplace when the public one cannot be reached) installs into temp
//    `CLAUDE_CONFIG_DIR` + `CLAUDE_CODE_PLUGIN_CACHE_DIR`; then three isolated launches:
//    A) both set → `installed_plugins.json` is in the cache dir; `claude:scan-skills` / `scan-star-commands`
//       list CT's skills, the Skills panel shows `/ct-exec`; `ct:read-config-sources` reports the plugin
//       and the default layer (the plugin's tower-config.md, unless a manual install exists: it wins by design)
//    B) same config dir, cache dir not set → nothing found (the plugins are not in `<config>/plugins`)
//    C) control: a config dir whose plugin was installed without the cache dir → found in `<config>/plugins`
//
// Windows only (pwsh tabs, npm shims). No model is called; no token is read or printed.

import { test, expect, type Page } from '@playwright/test'
import { execFile, execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { E2E_EXECUTABLE, REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0772')
const WS = 'e2e-t0772-ws'
const SHELL_TAB = 'e2e-t0772-shell'
const CODEX_VERSION = '0.166.0'
const MODERN = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }

const pathKey = Object.keys(process.env).find(k => k.toLowerCase() === 'path') ?? 'Path'
// `npx playwright` puts node_modules/.bin first on PATH (the repo's embedded codex shim); BAT started
// normally has no such entry, so the app gets PATH without it (same as t0742-codex-no-daemon).
const APP_PATH = (process.env[pathKey] ?? '').split(';').filter(d => !/node_modules[\\/]\.bin/i.test(d)).join(';')

const redact = (s: string) => s.replace(/batcap\.[A-Za-z0-9_.-]+/g, 'batcap.<redacted>')
const slash = (p: string) => p.split(path.sep).join('/')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

function powershell(command: string, timeout = 30_000): Promise<string> {
  return new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout, windowsHide: true, encoding: 'utf8' }, (_err, stdout) => resolve(stdout ?? ''))
  })
}

interface Proc { pid: number; name: string; cmd: string }

/** codex.exe / node.exe processes whose command line contains `marker` (this test's temp dir name only). */
async function processesWith(marker: string): Promise<Proc[]> {
  if (!/^[A-Za-z0-9._-]+$/.test(marker)) throw new Error(`bad marker ${marker}`)
  const out = await powershell(`Get-CimInstance Win32_Process -Filter "Name='codex.exe' OR Name='node.exe'" | Where-Object { $_.CommandLine -like '*${marker}*' } | ForEach-Object { [string]$_.ProcessId + [char]9 + $_.Name + [char]9 + $_.CommandLine }`)
  return out.split(/\r?\n/).filter(Boolean).map(l => {
    const [pid, name, ...rest] = l.split('\t')
    return { pid: Number(pid), name, cmd: rest.join('\t') }
  })
}

/** Kills what is left of this test's processes (command line contains the temp dir name), then removes the dir. */
async function cleanupTmp(tmp: string, cleanupLog: (m: string) => void): Promise<void> {
  const marker = path.basename(tmp)
  for (const p of await processesWith(marker).catch(() => [] as Proc[])) {
    cleanupLog(`leftover ${p.name} pid ${p.pid} (command line contains ${marker}) — killing`)
    spawnSync('taskkill', ['/T', '/F', '/PID', String(p.pid)], { windowsHide: true, timeout: 15_000 })
  }
  for (let i = 0; i < 20 && fs.existsSync(tmp); i++) {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { await sleep(500) }
  }
  cleanupLog(`temp dir ${marker} removed: ${!fs.existsSync(tmp)}`)
}

const workspaceLoad = async (win: Page) => JSON.parse(await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) as { terminals: { id: string; agentPreset?: string }[] }

/** Seeds one workspace (`folder`) with one shell tab, reloads the renderer, answers a Recovery prompt. */
async function seedWorkspace(win: Page, folder: string, settings?: Record<string, unknown>): Promise<void> {
  await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
  if (settings) await saveSettings(win, settings)
  const seed = {
    workspaces: [{ id: WS, name: 'T0772', folderPath: folder, createdAt: Date.now() }],
    activeWorkspaceId: WS,
    activeGroup: null,
    terminals: [{ id: SHELL_TAB, workspaceId: WS, type: 'terminal', title: 'T0772 shell', cwd: folder }],
    activeTerminalId: SHELL_TAB,
  }
  expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
  await reloadRenderer(win)
}

async function saveSettings(win: Page, patch: Record<string, unknown>): Promise<void> {
  await win.evaluate(async (p) => {
    const api = (window as AnyApi).electronAPI
    const current = JSON.parse((await api.settings.load()) || '{}')
    await api.settings.save(JSON.stringify({ ...current, ...p }))
  }, patch)
}

/** The renderer keeps its own Settings copy: a reload makes it read what was saved. */
async function reloadRenderer(win: Page): Promise<void> {
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  const recovery = win.locator('.recovery-prompt-dialog')
  if (await recovery.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false)) {
    await recovery.locator('.recovery-prompt-actions .btn-primary').click()
    log('answered the Recovery prompt after the reload (keep)')
  }
  await expect(win.locator('.workspace-container.active .thumbnail-add-btn')).toBeVisible({ timeout: 30_000 })
}

// ─────────────────────────────── ① npm codex ───────────────────────────────

/** helper / mcp steps inside a tab, with the tab's own env (its scoped capability). No env dump. */
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
    if (step.kind === 'helper') {
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

interface McpReply { id: number; result?: Record<string, unknown>; error?: { code: number; message: string } }
interface StepResult { kind: string; code?: number | null; stdout?: string; stderr?: string; ms?: number; replies?: McpReply[] }

const NPM_CLI = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

/** `npm i -g --prefix <prefix> @openai/codex@0.166.0` with its own cache; null on success, else why not. */
function npmInstallCodex(prefix: string, cache: string): string | null {
  if (!fs.existsSync(NPM_CLI)) return `npm-cli.js not found next to node (${NPM_CLI})`
  const started = Date.now()
  const r = spawnSync(process.execPath, [NPM_CLI, 'i', '-g', '--prefix', prefix, '--cache', cache, '--no-audit', '--no-fund', '--loglevel', 'error', `@openai/codex@${CODEX_VERSION}`],
    { encoding: 'utf8', timeout: 600_000, windowsHide: true })
  log(`npm i -g --prefix <tmp>\\npm @openai/codex@${CODEX_VERSION}: exit ${r.status} in ${Date.now() - started} ms${r.stderr?.trim() ? `; stderr: ${r.stderr.trim().slice(0, 800)}` : ''}`)
  if (r.status !== 0) return `npm install failed (exit ${r.status}${r.error ? `, ${r.error.message}` : ''})`
  return fs.existsSync(path.join(prefix, 'codex.cmd')) ? null : 'npm install wrote no codex.cmd'
}

/** The native codex.exe somewhere under the npm package (what BAT's probe must find). */
function findNativeCodex(prefix: string): string | null {
  const stack = [path.join(prefix, 'node_modules', '@openai', 'codex')]
  while (stack.length) {
    const dir = stack.pop()!
    let entries: fs.Dirent[] = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (e.name.toLowerCase() === 'codex.exe') return p
    }
  }
  return null
}

const call = (name: string, args: Record<string, unknown> = {}) => ({ method: 'tools/call', params: { name, arguments: args, ...MODERN } })

test.skip(process.platform !== 'win32', 'pwsh tabs and npm shims: Windows only')

test('① BUG-189: codex installed by npm (temp prefix) — Codex CLI tabs with BAT MCP off / on, a dispatched codex Worker', async () => {
  test.setTimeout(900_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0772-npm-'))
  const marker = path.basename(tmp)
  const prefix = path.join(tmp, 'npm')
  const folder = path.join(tmp, 'ws')
  const codexHome = path.join(tmp, 'codex-home')
  for (const d of [prefix, folder, codexHome]) fs.mkdirSync(d, { recursive: true })
  let inst: IsolatedInstance | undefined
  try {
    const failure = npmInstallCodex(prefix, path.join(tmp, 'npm-cache'))
    test.skip(failure !== null, `BLOCKED: ${failure}`)
    const native = findNativeCodex(prefix)
    expect(native, 'npm installed a native codex.exe under the package').toBeTruthy()
    const nativeVersion = /codex-cli\s+v?(\d+\.\d+\.\d+)/i.exec(execFileSync(native!, ['--version'], { encoding: 'utf8', timeout: 15_000, windowsHide: true }))?.[1]
    const rel = (p: string) => path.relative(tmp, p)
    log(`npm prefix layout: codex.cmd=${fs.existsSync(path.join(prefix, 'codex.cmd'))} codex.ps1=${fs.existsSync(path.join(prefix, 'codex.ps1'))} native=<tmp>\\${rel(native!)} (${nativeVersion})`)
    expect(nativeVersion).toBe(CODEX_VERSION)

    inst = await launchIsolated('t0772-npm', log, { env: { [pathKey]: `${prefix};${APP_PATH}`, CODEX_HOME: codexHome } })
    const { win, userData } = inst
    await seedWorkspace(win, folder, { batMcpEnabled: false })
    expect(JSON.parse((await win.evaluate(async () => (window as AnyApi).electronAPI.settings.load())) || '{}').batMcpEnabled).toBe(false)

    // guard: the tabs' shell (pwsh with the user's profile) finds the npm codex first
    await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), SHELL_TAB), { timeout: 30_000 }).not.toBeNull()
    await win.waitForTimeout(2_000)
    const whichFile = path.join(tmp, 'which.txt')
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: SHELL_TAB, line: `(Get-Command codex).Source | Out-File -Encoding utf8 '${whichFile}'\r` })
    await expect.poll(() => fs.existsSync(whichFile), { timeout: 30_000 }).toBe(true)
    let which = ''
    await expect.poll(() => (which = fs.readFileSync(whichFile, 'utf8').replace(/^﻿/, '').trim()), { timeout: 5_000 }).not.toBe('')
    log(`the tab's shell runs codex from: <tmp>\\${rel(which)}`)
    expect(which.toLowerCase().startsWith(prefix.toLowerCase() + path.sep)).toBe(true)

    const view = win.locator('.workspace-container.active')
    const openCodexTab = async (): Promise<string> => {
      const known = new Set((await workspaceLoad(win)).terminals.map(t => t.id))
      await view.locator('.thumbnail-add-btn').click()
      const item = win.locator('.thumbnail-add-menu-item:not(.disabled)', { hasText: 'Codex CLI' }).first()
      await expect(item).toBeVisible({ timeout: 10_000 })
      await item.click()
      let id = ''
      await expect.poll(async () => (id = (await workspaceLoad(win)).terminals.find(t => !known.has(t.id) && t.agentPreset === 'codex-cli')?.id ?? ''), { timeout: 15_000 }).not.toBe('')
      return id
    }
    const decisionOf = async (tabId: string): Promise<string> => {
      let line = ''
      await expect.poll(() => (line = readDebugLogs(userData).split('\n').find(l => l.includes('[bat-mcp] tab agent=codex-cli') && l.includes(`terminal=${tabId}`)) ?? ''), { timeout: 20_000 }).not.toBe('')
      return line.trim()
    }
    const probeLines = () => readDebugLogs(userData).split('\n').filter(l => l.includes('[codex-version]')).map(l => l.trim())
    const nativeCodexProcs = async (exclude: Set<number>): Promise<Proc[]> => {
      let procs: Proc[] = []
      await expect.poll(async () => (procs = (await processesWith(marker)).filter(p => p.name.toLowerCase() === 'codex.exe' && !exclude.has(p.pid))).length, { timeout: 30_000 }).toBeGreaterThan(0)
      return procs
    }
    const showCmd = (p: Proc) => redact(p.cmd.split(tmp).join('<tmp>'))
    const showLine = (l: string) => redact(l.split(tmp).join('<tmp>'))

    // ── a) BAT MCP off → --no-daemon, probe through the npm shim ──
    const tabA = await openCodexTab()
    const decisionA = await decisionOf(tabA)
    const probesA = probeLines()
    log(`a) tab ${tabA} decision: ${showLine(decisionA)}`)
    log(`a) probe: ${probesA.map(showLine).join(' | ')}`)
    expect(decisionA).toContain('→ injected: --no-daemon')
    expect(decisionA).toMatch(/mcp=no \(/)
    expect(probesA.some(l => l.toLowerCase().includes(`path=${native!.toLowerCase()} `) && l.includes(`version=${CODEX_VERSION}`)
      && l.toLowerCase().includes(`via=${path.join(prefix, 'codex.cmd').toLowerCase()}`))).toBe(true)
    expect(probesA.some(l => l.includes('version=unknown'))).toBe(false)
    const procsA = await nativeCodexProcs(new Set())
    log(`a) running codex.exe: ${procsA.map(showCmd).join(' | ')}`)
    expect(procsA.some(p => /(^|\s)--no-daemon(\s|$)/.test(p.cmd))).toBe(true)
    await win.waitForTimeout(3_000)
    await win.screenshot({ path: test.info().outputPath('a-codex-tab-mcp-off.png') })

    // ── b) BAT MCP on → the MCP args, no --no-daemon ──
    await saveSettings(win, { batMcpEnabled: true })
    await reloadRenderer(win)
    expect(JSON.parse((await win.evaluate(async () => (window as AnyApi).electronAPI.settings.load())) || '{}').batMcpEnabled).toBe(true)
    const tabB = await openCodexTab()
    const decisionB = await decisionOf(tabB)
    log(`b) tab ${tabB} decision: ${showLine(decisionB)}`)
    expect(decisionB).toMatch(/→ injected: -c /)
    expect(decisionB).toContain('mcp_servers.bat')
    expect(decisionB).not.toContain('--no-daemon')
    const procsB = await nativeCodexProcs(new Set(procsA.map(p => p.pid)))
    log(`b) running codex.exe: ${procsB.map(showCmd).join(' | ')}`)
    expect(procsB.some(p => p.cmd.includes('mcp_servers.bat') && !/(^|\s)--no-daemon(\s|$)/.test(p.cmd))).toBe(true)
    await win.waitForTimeout(3_000)
    await win.screenshot({ path: test.info().outputPath('b-codex-tab-mcp-on.png') })

    // ── c) the shell tab as Tower dispatches a codex Worker ──
    const runner = slash(path.join(tmp, 'runner.cjs'))
    fs.writeFileSync(runner, RUNNER)
    let seq = 0
    const runInTab = async (steps: unknown[], timeout = 180_000): Promise<StepResult[]> => {
      const n = seq++
      const out = slash(path.join(tmp, `tab-${n}.json`))
      const spec = slash(path.join(tmp, `tab-${n}-spec.json`))
      fs.writeFileSync(spec, JSON.stringify({ out, steps }))
      await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id: SHELL_TAB, line: `node "${runner}" "${spec}"\r` })
      const read = () => (fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) as StepResult[] : [])
      await expect.poll(() => read().length >= steps.length, { timeout }).toBe(true)
      const r = read()
      log(`c) ${path.basename(out)}: ${showLine(JSON.stringify(r)).slice(0, 3000)}`)
      return r
    }
    const probesBefore = probeLines().length
    const [role, dispatched] = await runInTab([
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      { kind: 'helper', script: 'bat-terminal.mjs', timeoutMs: 120_000,
        args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--agent', 'codex', '--skill', 'ct-exec', '--workorder', 'T0772', '--cwd', folder, '--mode', 'yolo', '--wait-started', '30000'] },
    ])
    expect(role.code, role.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(dispatched.stdout ?? '')?.[1]
    const startedLine = (dispatched.stdout ?? '').trim().split(/\r?\n/).at(-1) ?? ''
    log(`c) dispatch exit ${dispatched.code}; last stdout line ${JSON.stringify(startedLine)}; stderr ${JSON.stringify((dispatched.stderr ?? '').trim())}; ${dispatched.ms} ms`)
    expect(worker, `${dispatched.stdout}\n${dispatched.stderr}`).toBeTruthy()
    expect([0, 8]).toContain(dispatched.code)
    const dispatchProbes = probeLines().slice(probesBefore)
    log(`c) dispatch probe: ${dispatchProbes.map(showLine).join(' | ')}`)
    expect(dispatchProbes.some(l => l.includes(`version=${CODEX_VERSION}`) && l.toLowerCase().includes(`via=${path.join(prefix, 'codex.cmd').toLowerCase()}`))).toBe(true)
    const [stateRun] = await runInTab([{ kind: 'mcp', requests: [call('bat_get_state', { terminalId: worker })] }])
    const state = stateRun.replies?.[0]?.result?.structuredContent as Record<string, unknown> | undefined
    log(`c) bat_get_state(Worker): ${JSON.stringify(state)}`)
    expect(state).toMatchObject({ terminalId: worker, blockedDetection: 'osc' })
    const command = readDebugLogs(userData).split('\n').filter(l => l.includes('[agent-command]') && l.includes('codex')).map(l => showLine(l.trim()))
    log(`c) [agent-command] lines: ${command.join(' | ').slice(0, 2000)}`)
    const workerProcs = (await processesWith(marker)).filter(p => p.name.toLowerCase() === 'codex.exe' && !procsA.some(a => a.pid === p.pid) && !procsB.some(b => b.pid === p.pid))
    log(`c) Worker codex.exe: ${workerProcs.map(showCmd).join(' | ') || '(none running)'}`)
    const tail = (await win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getBuffer(tid), worker)) as { data?: string } | null
    // eslint-disable-next-line no-control-regex
    const screen = (tail?.data ?? '').replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, ' ').replace(/\s+/g, ' ').trim()
    log(`c) Worker screen (last 600 chars): ${showLine(screen.slice(-600))}`)
    await win.screenshot({ path: test.info().outputPath('c-codex-worker.png') })
  } finally {
    await closeIsolated(inst, log)
    await cleanupTmp(tmp, log)
  }
})

// ─────────────────────────── ② CT plugin, cache dir ───────────────────────────

const EMBEDDED_CLAUDE = E2E_EXECUTABLE
  ? path.join(path.dirname(E2E_EXECUTABLE), 'resources', 'app.asar.unpacked', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
  : path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
const PUBLIC_MARKETPLACE = 'gowerlin/Control-Tower'

/** The env for the embedded claude: no BAT_* / CT_* / CLAUDE* / ANTHROPIC* of this session, a temp home. */
function claudeCliEnv(home: string, configDir: string, cacheDir?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || /^(BAT_|CT_|CLAUDE|ANTHROPIC)/i.test(k)) continue
    env[k] = v
  }
  Object.assign(env, { HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: configDir, DISABLE_AUTOUPDATER: '1', GIT_TERMINAL_PROMPT: '0' })
  if (cacheDir) env.CLAUDE_CODE_PLUGIN_CACHE_DIR = cacheDir
  return env
}

function claudeCli(args: string[], env: NodeJS.ProcessEnv): { code: number | null; out: string } {
  const r = spawnSync(EMBEDDED_CLAUDE, args, { env, encoding: 'utf8', timeout: 180_000, windowsHide: true })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() }
}

/** A local `directory` marketplace with a fake `ct` plugin (T0760's method), for when the public one is unreachable. */
function fakeMarketplace(dir: string): string {
  const plugin = path.join(dir, 'plugins', 'ct')
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true })
  fs.mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: 't0772-local', owner: { name: 't0772' }, plugins: [{ name: 'ct', source: './plugins/ct', description: 'T0772 fake CT' }] }, null, 2))
  fs.writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'ct', version: '9.9.9', description: 'T0772 fake CT' }, null, 2))
  for (const skill of ['ct-exec', 'ct-done', 'ct-status', 'control-tower']) {
    fs.mkdirSync(path.join(plugin, 'skills', skill), { recursive: true })
    fs.writeFileSync(path.join(plugin, 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\ndescription: T0772 fake ${skill}\n---\n\n# ${skill}\n`)
  }
  fs.mkdirSync(path.join(plugin, 'skills', 'control-tower', 'references'), { recursive: true })
  fs.writeFileSync(path.join(plugin, 'skills', 'control-tower', 'references', 'tower-config.md'), '# tower-config (T0772 fake)\n')
  return 't0772-local'
}

/** Installs `ct@<marketplace>` with the embedded claude; returns the marketplace name and source used. */
function installCtPlugin(tmp: string, home: string, configDir: string, cacheDir: string | undefined, preferred?: { name: string; source: string }): { name: string; source: string } {
  const env = claudeCliEnv(home, configDir, cacheDir)
  const tries = preferred ? [preferred] : [{ name: 'control-tower', source: PUBLIC_MARKETPLACE }, { name: '', source: path.join(tmp, 'fake-mkt') }]
  for (const t of tries) {
    let name = t.name
    if (!name) name = fakeMarketplace(t.source)
    const add = claudeCli(['plugin', 'marketplace', 'add', t.source], env)
    log(`claude plugin marketplace add ${t.source.startsWith(tmp) ? '<tmp>\\fake-mkt' : t.source} (config=${path.basename(configDir)}${cacheDir ? `, cache=${path.basename(cacheDir)}` : ''}): exit ${add.code}: ${add.out.split(tmp).join('<tmp>').slice(-300)}`)
    if (add.code !== 0) continue
    const install = claudeCli(['plugin', 'install', `ct@${name}`, '--scope', 'user'], env)
    log(`claude plugin install ct@${name} --scope user: exit ${install.code}: ${install.out.slice(-300)}`)
    if (install.code === 0) return { name, source: t.source }
  }
  throw new Error('could not install the CT plugin from the public marketplace or a local fake one')
}

interface InstalledPlugins { plugins: Record<string, { scope: string; installPath: string; version: string }[]> }

test('② BUG-191: CT plugin installed under CLAUDE_CODE_PLUGIN_CACHE_DIR — skills, * completion, ct-config default layer; control without it', async () => {
  test.setTimeout(420_000)
  test.skip(!fs.existsSync(EMBEDDED_CLAUDE), `embedded claude CLI not found: ${EMBEDDED_CLAUDE}`)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0772-plugin-'))
  const home = path.join(tmp, 'home')
  const cfgA = path.join(tmp, 'claude-config-a')
  const cacheA = path.join(tmp, 'plugin-cache-a')
  const cfgB = path.join(tmp, 'claude-config-b')
  const folder = path.join(tmp, 'ws')
  for (const d of [home, cfgA, cacheA, cfgB, folder]) fs.mkdirSync(d, { recursive: true })
  const show = (s: string) => s.split(tmp).join('<tmp>')
  let inst: IsolatedInstance | undefined
  try {
    const cliVersion = claudeCli(['--version'], claudeCliEnv(home, cfgA)).out
    log(`embedded claude: ${E2E_EXECUTABLE ? 'installed BAT' : 'repo'} ${cliVersion}`)
    const mkt = installCtPlugin(tmp, home, cfgA, cacheA)
    installCtPlugin(tmp, home, cfgB, undefined, mkt)
    const id = `ct@${mkt.name}`
    log(`marketplace used: ${mkt.name} (${mkt.source === PUBLIC_MARKETPLACE ? `public ${PUBLIC_MARKETPLACE}` : 'local fake'})`)

    // where the CLI put things
    const jsonA = path.join(cacheA, 'installed_plugins.json')
    const jsonB = path.join(cfgB, 'plugins', 'installed_plugins.json')
    log(`files: cacheA/installed_plugins.json=${fs.existsSync(jsonA)} cfgA/plugins/installed_plugins.json=${fs.existsSync(path.join(cfgA, 'plugins', 'installed_plugins.json'))} cfgB/plugins/installed_plugins.json=${fs.existsSync(jsonB)}; temp home entries=${fs.readdirSync(home).length}`)
    expect(fs.existsSync(jsonA)).toBe(true)
    expect(fs.existsSync(path.join(cfgA, 'plugins', 'installed_plugins.json'))).toBe(false)
    expect(fs.existsSync(jsonB)).toBe(true)
    const entryA = (JSON.parse(fs.readFileSync(jsonA, 'utf8')) as InstalledPlugins).plugins[id]?.[0]
    const entryB = (JSON.parse(fs.readFileSync(jsonB, 'utf8')) as InstalledPlugins).plugins[id]?.[0]
    log(`installed_plugins A: ${show(JSON.stringify(entryA))}; B: ${show(JSON.stringify(entryB))}`)
    expect(entryA?.installPath.toLowerCase().startsWith(cacheA.toLowerCase() + path.sep)).toBe(true)
    expect(entryB?.installPath.toLowerCase().startsWith(path.join(cfgB, 'plugins').toLowerCase() + path.sep)).toBe(true)
    const pluginSkills = fs.readdirSync(path.join(entryA!.installPath, 'skills'))
    log(`plugin skills: ${pluginSkills.join(', ')}`)

    // the user's own manual CT installs that the default layer would read first (existence only)
    const realHome = os.homedir()
    const manualDefaults = [
      path.join(realHome, '.codex', 'skills', 'control-tower', 'references', 'tower-config.md'),
    ].filter(p => fs.existsSync(p))
    const passthroughCache = Object.keys(process.env).some(k => k.toUpperCase() === 'CLAUDE_CODE_PLUGIN_CACHE_DIR') ? { CLAUDE_CODE_PLUGIN_CACHE_DIR: '' } : {}

    const check = async (label: string, env: Record<string, string>, expectFound: boolean, rootPrefix?: string, ui = false) => {
      inst = await launchIsolated(`t0772-plugin-${label}`, log, { env })
      const { win, app } = inst
      log(`${label}) app home is the user home: ${(await app.evaluate(({ app: a }) => a.getPath('home'))) === realHome}`)
      await seedWorkspace(win, folder)
      const skills = await win.evaluate(async (cwd) => (window as AnyApi).electronAPI.claude.scanSkills(cwd), folder) as { name: string; scope: string }[]
      const stars = await win.evaluate(async () => (window as AnyApi).electronAPI.claude.scanStarCommands()) as { name: string; prefix: string }[]
      const sources = await win.evaluate(async () => (window as AnyApi).electronAPI.ctConfig.readSources()) as { defaults: { status: string; path?: string }; installs?: { claude?: { plugin?: { version: string | null; marketplace: string } | null } } }
      log(`${label}) scan-skills: ${skills.map(s => `${s.name}(${s.scope})`).join(', ') || '(none)'}`)
      log(`${label}) scan-star-commands: ${stars.map(s => `${s.prefix}-${s.name}`).join(', ') || '(none)'}`)
      log(`${label}) ct:read-config-sources: defaults=${sources.defaults.status} ${show(sources.defaults.path ? sources.defaults.path.split(realHome).join('<home>') : '')}; installs.claude.plugin=${JSON.stringify(sources.installs?.claude?.plugin ?? null)}`)
      const ctSkills = skills.filter(s => /^ct-|^control-tower$/.test(s.name)).map(s => s.name)
      if (expectFound) {
        expect(ctSkills).toEqual(expect.arrayContaining(['ct-exec', 'control-tower']))
        expect(ctSkills.sort()).toEqual(pluginSkills.filter(s => /^ct-|^control-tower$/.test(s)).sort())
        expect(stars.filter(s => s.prefix === 'ct').map(s => s.name)).toContain('exec')
        expect(sources.installs?.claude?.plugin).toEqual({ version: entryA!.version, marketplace: mkt.name })
        if (manualDefaults.length) {
          // T0710 3-2: a manual install wins (it is what runs)
          expect(sources.defaults).toMatchObject({ status: 'found', path: manualDefaults[0] })
        } else {
          expect(sources.defaults.status).toBe('found')
          expect(sources.defaults.path?.toLowerCase().startsWith(rootPrefix!.toLowerCase() + path.sep)).toBe(true)
        }
      } else {
        expect(ctSkills).toEqual([])
        expect(stars.filter(s => s.prefix === 'ct')).toEqual([])
        expect(sources.installs?.claude?.plugin ?? null).toBeNull()
      }
      if (ui) {
        // the Skills panel (docked right by default)
        const tab = win.locator('.right-sidebar-tab', { hasText: /^Skills$/ })
        if (await tab.isVisible().catch(() => false)) await tab.click()
        else await win.locator('.right-sidebar-collapsed-btn[title="Skills"]').first().click()
        await expect(win.locator('.skills-item-name', { hasText: '/ct-exec' }).first()).toBeVisible({ timeout: 15_000 })
        const names = await win.locator('.skills-item-name').allInnerTexts()
        log(`${label}) Skills panel: ${names.join(', ')}`)
        await win.screenshot({ path: test.info().outputPath(`${label}-skills-panel.png`) })
      }
      await closeIsolated(inst, log)
      inst = undefined
    }

    await check('A', { CLAUDE_CONFIG_DIR: cfgA, CLAUDE_CODE_PLUGIN_CACHE_DIR: cacheA }, true, cacheA, true)
    await check('B', { CLAUDE_CONFIG_DIR: cfgA, ...passthroughCache }, false)
    await check('C', { CLAUDE_CONFIG_DIR: cfgB, ...passthroughCache }, true, path.join(cfgB, 'plugins'))
    if (manualDefaults.length) log(`note: a manual CT install exists at <home>\\${path.relative(realHome, manualDefaults[0])} — the default layer reads it (T0710 3-2); the plugin's own copy is not shown on this machine`)
  } finally {
    await closeIsolated(inst, log)
    await cleanupTmp(tmp, log)
  }
})
