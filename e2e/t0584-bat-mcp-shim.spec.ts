// PLAN-047 M1 / T0584: the `bat` MCP shim (scripts/bat-mcp.mjs) from inside the tabs of an
// isolated BAT, and the launch args / config file BAT generates for it.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Every MCP
// session runs INSIDE a tab, with that tab's own env (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN = its
// capability): a node runner starts `node $BAT_HELPER_DIR/bat-mcp.mjs` and speaks JSON-RPC on its
// stdio. The Worker agent is a custom CLI running the same runner — nothing starts an LLM.
//
//   1. the Tower declares itself and dispatches a Worker; the Worker prints a marker and a
//      token-shaped string, then (MCP) bat_whoami = worker, bat_read_output of its tower → NOT_OWNER
//   2. Tower (MCP): server/discover → tools/list → bat_whoami / bat_list_terminals /
//      bat_read_output (marker seen, token masked)
//   3. Tower (MCP): bat_wait until=exit while the Worker's shell exits → changed, exited
//   4. `agent:bat-mcp-launch-args`: claude `--mcp-config=<userData>/bat-mcp/claude.json` (file has
//      command / args only), codex `-c mcp_servers.bat.*`; Settings off → ''
//   5. the embedded claude (isolated CLAUDE_CONFIG_DIR, no prompt) health-checks the server of the
//      BAT-generated file: ✔ Connected
//   6. bat-scripts.log has the bat-mcp tool-call lines, never the output or a token

import { test, expect, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0584')
const WS = 'e2e-t0584-ws'
const TOWER = 'e2e-t0584-tower'
const WORKER_AGENT = 'e2e-t0584-worker'
const MARK = 'T0584-WORKER-MARK'
const MODERN = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }

interface McpReply { id: number; result?: Record<string, unknown>; error?: { code: number; message: string } }
interface StepResult {
  kind: string
  code?: number | null
  stdout?: string
  stderr?: string
  terminalId?: string
  token?: string
  replies?: McpReply[]
}

/**
 * `node runner.cjs <spec.json>`: the spec's steps with this process's env; results to `spec.out`
 * (temp file + rename). `$BAT_TERMINAL_ID` / `$BAT_TOWER_TERMINAL_ID` are replaced in strings.
 *   - `{ kind: 'env' }`                   BAT_TERMINAL_ID / token
 *   - `{ kind: 'print', text }`           writes text to stdout (the tab's output)
 *   - `{ kind: 'helper', script, args }`  `node $BAT_HELPER_DIR/<script> ...args`
 *   - `{ kind: 'mcp', requests }`         `node $BAT_HELPER_DIR/bat-mcp.mjs`, requests one by one
 */
const RUNNER = `
const fs = require('fs')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const env = process.env
const sub = s => String(s).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || '').replace(/\\$BAT_TOWER_TERMINAL_ID/g, env.BAT_TOWER_TERMINAL_ID || '')
const subAll = v => typeof v === 'string' ? sub(v) : Array.isArray(v) ? v.map(subAll) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subAll(x)])) : v
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))

function mcp(requests) {
  return new Promise(resolve => {
    const out = { kind: 'mcp', replies: [], stderr: '' }
    const child = spawn(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-mcp.mjs')], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    const timer = setTimeout(() => { out.stderr += 'runner timeout'; child.kill() }, 90000)
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
        out.replies.push(JSON.parse(line))
        next()
      }
    })
    child.stderr.on('data', d => { out.stderr += d })
    child.on('exit', code => { clearTimeout(timer); out.code = code; resolve(out) })
    next()
  })
}

;(async () => {
  const results = []
  for (const step of spec.steps) {
    if (step.kind === 'env') {
      results.push({ kind: 'env', terminalId: env.BAT_TERMINAL_ID, token: env.BAT_REMOTE_TOKEN })
    } else if (step.kind === 'print') {
      process.stdout.write(step.text + '\\n')
      results.push({ kind: 'print' })
    } else if (step.kind === 'helper') {
      if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs))
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...step.args.map(sub)], { env, encoding: 'utf8', timeout: 30000, windowsHide: true })
      results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr })
    } else if (step.kind === 'mcp') {
      results.push(await mcp(step.requests))
    }
  }
  const out = sub(spec.out)
  fs.writeFileSync(out + '.tmp', JSON.stringify(results, null, 2))
  fs.renameSync(out + '.tmp', out)
})()
`

const call = (name: string, args: Record<string, unknown> = {}) => ({ method: 'tools/call', params: { name, arguments: args, ...MODERN } })

function readResults(file: string): StepResult[] | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as StepResult[] : undefined
}

test('bat MCP shim: tools from inside the tabs (scoped), launch args, claude health check', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0584-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)
  const fakeToken = 'batcap.' + 'Xk9'.repeat(15)
  const workerSpec = slash(path.join(tmp, 'worker-spec.json'))
  fs.writeFileSync(workerSpec, JSON.stringify({
    out: slash(path.join(tmp, 'worker-$BAT_TERMINAL_ID.json')),
    steps: [
      { kind: 'print', text: `${MARK} BAT_REMOTE_TOKEN=${fakeToken}` },
      { kind: 'env' },
      { kind: 'mcp', requests: [
        { method: 'server/discover', params: MODERN },
        call('bat_whoami'),
        call('bat_read_output', { terminalId: '$BAT_TOWER_TERMINAL_ID' }),
        call('bat_get_state', { terminalId: '$BAT_TOWER_TERMINAL_ID' }),
      ] },
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
  const results = async (out: string): Promise<StepResult[]> => {
    await expect.poll(() => readResults(out) !== undefined, { timeout: 90_000 }).toBe(true)
    const r = readResults(out)!
    log(`${path.basename(out)}: ${JSON.stringify(r).replace(/batcap\.[A-Za-z0-9_-]+/g, 'batcap.<redacted>').slice(0, 3000)}`)
    return r
  }
  const runInTab = async (win: Page, id: string, steps: unknown[]) => results(await startInTab(win, id, steps))
  const tool = (r: StepResult, i: number) => r.replies?.[i]?.result as Record<string, unknown> | undefined

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0584', log)
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0584 worker', icon: 'W', color: '#888888', command: 'node', args: [runner, workerSpec],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0584', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
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

    // ── 1. the Tower declares itself and dispatches a Worker; the Worker asks via MCP ──
    const [role, dispatch] = await runInTab(win, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      { kind: 'helper', script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0584', '--mode', 'yolo'] },
    ])
    expect(role.code, role.stderr).toBe(0)
    expect(dispatch.code, dispatch.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(dispatch.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    const [, workerEnv, workerMcp] = await results(path.join(tmp, `worker-${worker}.json`))
    expect(workerEnv.token?.startsWith('batcap.')).toBe(true)
    expect(workerMcp.code, workerMcp.stderr).toBe(0)
    expect(tool(workerMcp, 0)).toMatchObject({ resultType: 'complete' })
    expect(tool(workerMcp, 1)?.structuredContent).toMatchObject({ terminalId: worker, role: 'worker', towerTerminalId: TOWER, workorder: 'T0584' })
    expect(tool(workerMcp, 2)).toMatchObject({ isError: true, structuredContent: { code: 'NOT_OWNER' } })
    expect(tool(workerMcp, 3)?.structuredContent).toMatchObject({ terminalId: TOWER })

    // ── 2. Tower: discover → tools/list → whoami / list / read-output ──
    const [towerMcp] = await runInTab(win, TOWER, [{ kind: 'mcp', requests: [
      { method: 'server/discover', params: MODERN },
      { method: 'tools/list', params: MODERN },
      call('bat_whoami'),
      call('bat_list_terminals'),
      call('bat_read_output', { terminalId: worker, maxLines: 50 }),
    ] }])
    expect(towerMcp.code, towerMcp.stderr).toBe(0)
    expect(tool(towerMcp, 0)).toMatchObject({ resultType: 'complete', supportedVersions: expect.arrayContaining(['2026-07-28', '2025-11-25']) })
    expect((tool(towerMcp, 1)?.tools as Array<{ name: string }>).map(t => t.name)).toEqual([
      'bat_whoami', 'bat_list_terminals', 'bat_get_state', 'bat_read_output', 'bat_wait', 'bat_worktree_status',
    ])
    expect(tool(towerMcp, 2)?.structuredContent).toMatchObject({ terminalId: TOWER, role: 'tower', yolo: true, workspaceId: WS })
    expect(((tool(towerMcp, 3)?.structuredContent as { terminals: Array<{ id: string }> }).terminals).map(t => t.id).sort()).toEqual([TOWER, worker!].sort())
    const read = tool(towerMcp, 4)!
    expect(read.isError).toBeUndefined()
    const lines = ((read.structuredContent as { lines: string[] }).lines).join('\n')
    expect(lines).toContain(MARK)
    expect(lines).toContain('[REDACTED:batcap]')
    expect(lines).not.toContain(fakeToken)
    expect((read.content as Array<{ text: string }>)[0].text).toContain(MARK)

    // ── 3. Tower: bat_wait until=exit while the Worker's shell exits ──
    const waitOut = await startInTab(win, TOWER, [{ kind: 'mcp', requests: [
      call('bat_wait', { terminalId: worker, until: 'exit', timeoutMs: 40_000 }),
      call('bat_get_state', { terminalId: worker }),
    ] }])
    await win.waitForTimeout(3_000)
    expect(readResults(waitOut)).toBeUndefined()
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'exit\r'), worker)
    const [waited] = await results(waitOut)
    expect(tool(waited, 0)?.structuredContent).toMatchObject({ terminalId: worker, changed: true, state: 'exited' })
    expect(tool(waited, 1)?.structuredContent).toMatchObject({ state: 'exited' })

    // ── 4. launch args BAT puts on claude / codex tabs ──
    const args = await win.evaluate(async () => {
      const api = (window as AnyApi).electronAPI.agent
      return {
        claude: await api.batMcpLaunchArgs('claude-cli', 'pwsh', '--model opus'),
        codexPwsh: await api.batMcpLaunchArgs('codex-cli', 'pwsh', ''),
        codexPosix: await api.batMcpLaunchArgs('codex-cli', 'posix', ''),
        userConfig: await api.batMcpLaunchArgs('claude-cli', 'pwsh', '--mcp-config mine.json'),
        gemini: await api.batMcpLaunchArgs('gemini-cli', 'pwsh', ''),
      }
    })
    log(`launch args: ${JSON.stringify(args)}`)
    const configFile = path.join(userData, 'bat-mcp', 'claude.json')
    expect(args.claude).toBe(`'--mcp-config=${configFile}'`)
    expect(args.codexPwsh).toMatch(/^-c 'mcp_servers\.bat\.command=''node''' -c 'mcp_servers\.bat\.args=\[''.+bat-mcp\.mjs''\]' -c 'mcp_servers\.bat\.env_vars=\[''BAT_REMOTE_PORT'', ''BAT_REMOTE_TOKEN'', .*\]' -c mcp_servers\.bat\.tool_timeout_sec=60$/)
    expect(args.codexPosix).toContain('mcp_servers.bat.tool_timeout_sec=60')
    // T0586 / BUG-148: env names only, never the token value
    expect(args.codexPwsh).not.toContain('batcap.')
    expect(args.userConfig).toBe('')
    expect(args.gemini).toBe('')
    const config = fs.readFileSync(configFile, 'utf8')
    log(`claude.json: ${config}`)
    const bat = JSON.parse(config).mcpServers.bat
    expect(bat).toEqual({ type: 'stdio', command: 'node', args: [path.join(REPO_ROOT, 'scripts', 'bat-mcp.mjs')] })
    expect(config).not.toContain(workerEnv.token!)
    expect(config).not.toMatch(/batcap\.|BAT_REMOTE_TOKEN|"env"/)

    // Settings off → nothing
    await win.evaluate(async () => {
      const api = (window as AnyApi).electronAPI
      const current = JSON.parse((await api.settings.load()) || '{}')
      await api.settings.save(JSON.stringify({ ...current, batMcpEnabled: false }))
    })
    expect(await win.evaluate(() => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('claude-cli', 'pwsh', ''))).toBe('')
    expect(await win.evaluate(() => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('codex-cli', 'pwsh', ''))).toBe('')

    // ── 5. embedded claude health check of the BAT-generated server (no prompt) ──
    const claudeBin = path.join(REPO_ROOT, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
    const claudeHome = path.join(tmp, 'claude-config')
    fs.mkdirSync(claudeHome)
    const claudeEnv = {
      ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith('BAT_') && !k.startsWith('ANTHROPIC_'))),
      CLAUDE_CONFIG_DIR: claudeHome,
      BAT_HELPER_LOG_DIR: path.join(tmp, 'health-logs'),
    }
    const add = spawnSync(claudeBin, ['mcp', 'add-json', '-s', 'user', 'bat', JSON.stringify(bat)], { env: claudeEnv, encoding: 'utf8', timeout: 60_000, cwd: tmp })
    expect(add.status, add.stderr).toBe(0)
    const list = spawnSync(claudeBin, ['mcp', 'list'], { env: claudeEnv, encoding: 'utf8', timeout: 90_000, cwd: tmp })
    log(`claude mcp list: ${list.stdout.trim()}`)
    expect(list.stdout).toMatch(/bat: .*bat-mcp\.mjs - ✔ Connected/)

    // ── 6. audit in bat-scripts.log; never the output or a token ──
    const scriptsLog = fs.readFileSync(path.join(userData, 'Logs', 'bat-scripts.log'), 'utf8')
    const calls = scriptsLog.trim().split('\n').map(l => JSON.parse(l)).filter(e => e.script === 'bat-mcp' && e.event === 'tool-call')
    expect(calls.find(e => e.tool === 'bat_read_output' && e.ok === true)).toBeTruthy()
    expect(calls.find(e => e.tool === 'bat_read_output' && e.code === 'NOT_OWNER')).toBeTruthy()
    expect(calls.find(e => e.tool === 'bat_wait' && e.ok === true)).toBeTruthy()
    expect(scriptsLog).not.toContain(MARK)
    expect(scriptsLog).not.toContain(fakeToken)
    expect(scriptsLog).not.toContain(workerEnv.token!)
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
