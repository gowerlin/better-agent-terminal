// PLAN-050 / T0643 (D167): `terminal:list { scope: 'towers' }` through the Tower's MCP, end to end in
// an isolated BAT.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Every helper
// runs INSIDE a tab with that tab's own env, through the node runner of e2e/t0642 (env / helper /
// mcp steps). Nothing starts an LLM.
//
//   1. two workspaces: A (alias "Alpha") with tab TOWER_A and a plain shell, B with tab TOWER_B; each
//      Tower tab gets a claude-cli launch decision with a session name (the T0641 record)
//   2. before declaring: TOWER_A's bat_list_terminals scope=towers → NOT_OWNER (a shell)
//   3. both declare `--set-role tower`; TOWER_A's MCP lists two rows (itself `self`, TOWER_B with its
//      workspace / session name), nothing more than identification fields; the plain shell is not
//      listed; bat_get_state / bat_read_output of TOWER_B → NOT_OWNER; the plain shell's list →
//      NOT_OWNER; scope=mine / workspace unchanged
//   4. the debug log has `[helper-query] … target=scope=towers → ok count=2` and no session name

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0643')
const WS_A = 'e2e-t0643-ws-a'
const WS_B = 'e2e-t0643-ws-b'
const TOWER_A = 'e2e-t0643-tower-a'
const TOWER_B = 'e2e-t0643-tower-b'
const SHELL_A = 'e2e-t0643-shell-a'
const NAME_A = 'Alpha · Tower'
const NAME_B = 'T0643-B · Tower'
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

/** The runner of e2e/t0642 without the hook step. */
const RUNNER = `
const fs = require('fs')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const env = { ...process.env }
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
    if (step.kind === 'env') {
      results.push({ kind: 'env', terminalId: env.BAT_TERMINAL_ID, token: env.BAT_REMOTE_TOKEN })
    } else if (step.kind === 'helper') {
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...step.args.map(sub)], { env, encoding: 'utf8', timeout: 60000, windowsHide: true })
      results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr })
    } else if (step.kind === 'mcp') {
      results.push(await mcp(step.requests))
    }
    flush()
  }
})()
`

const call = (name: string, args: Record<string, unknown> = {}) => ({ method: 'tools/call', params: { name, arguments: args, ...MODERN } })

function readResults(file: string): StepResult[] | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as StepResult[] : undefined
}

function readDebugLogs(userData: string): string {
  const dir = path.join(userData, 'Logs')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir).filter(f => f.startsWith('debug-')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}

test('scope=towers: a declared Tower lists the towers of every workspace, nothing more', async () => {
  test.setTimeout(240_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0643-'))
  const folderA = path.join(tmp, 'ws-a')
  const folderB = path.join(tmp, 'ws-b')
  fs.mkdirSync(folderA, { recursive: true })
  fs.mkdirSync(folderB, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER)

  let specSeq = 0
  const runInTab = async (win: Page, id: string, steps: unknown[]): Promise<StepResult[]> => {
    const n = specSeq++
    const out = slash(path.join(tmp, `tab-${n}.json`))
    const spec = slash(path.join(tmp, `tab-${n}-spec.json`))
    fs.writeFileSync(spec, JSON.stringify({ out, steps }))
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id, line: `node "${runner}" "${spec}"\r` })
    await expect.poll(() => (readResults(out)?.length ?? 0) >= steps.length, { timeout: 90_000 }).toBe(true)
    const r = readResults(out)!
    log(`tab ${id} step ${n}: ${JSON.stringify(r).replace(/batcap\.[A-Za-z0-9_-]+/g, 'batcap.<redacted>').slice(0, 3000)}`)
    return r
  }
  const tool = (r: StepResult, i: number) => r.replies?.[i]?.result as Record<string, unknown> | undefined
  const structured = (r: StepResult, i: number) => tool(r, i)?.structuredContent as Record<string, unknown>

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0643', log)
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    const seed = {
      workspaces: [
        { id: WS_A, name: 'T0643-A', alias: 'Alpha', folderPath: folderA, createdAt: Date.now() },
        { id: WS_B, name: 'T0643-B', folderPath: folderB, createdAt: Date.now() },
      ],
      activeWorkspaceId: WS_A,
      activeGroup: null,
      terminals: [
        { id: TOWER_A, workspaceId: WS_A, type: 'terminal', title: 'New Terminal', cwd: folderA },
        { id: SHELL_A, workspaceId: WS_A, type: 'terminal', title: 'New Terminal', cwd: folderA },
        { id: TOWER_B, workspaceId: WS_B, type: 'terminal', title: 'New Terminal', cwd: folderB },
      ],
      activeTerminalId: TOWER_A,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const ptyUp = (id: string) => expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), id), { timeout: 30_000 }).not.toBeNull()
    await ptyUp(TOWER_A)
    await ptyUp(SHELL_A)
    // B's tab gets its PTY once B is opened (e2e/t0523); then back to A
    await win.locator('.workspace-item', { hasText: 'T0643-B' }).click()
    await ptyUp(TOWER_B)
    await win.locator('.workspace-item', { hasText: 'Alpha' }).click()
    await win.waitForTimeout(2_000)

    // ── 1. each Tower tab's claude-cli launch decision (the T0641 record of its session name) ──
    for (const [id, name] of [[TOWER_A, NAME_A], [TOWER_B, NAME_B]]) {
      const launch = await win.evaluate(async ({ id, name }) => (window as AnyApi).electronAPI.agent.batMcpLaunchArgs('claude-cli', 'pwsh', '', id, name), { id, name })
      log(`launch args ${id}: ${JSON.stringify(launch)}`)
      expect(JSON.stringify(launch)).toContain('--name=')
    }

    // ── 2. not declared yet: a shell ──
    const [envA, before] = await runInTab(win, TOWER_A, [
      { kind: 'env' },
      { kind: 'mcp', requests: [call('bat_list_terminals', { scope: 'towers' })] },
    ])
    expect(envA.token?.startsWith('batcap.')).toBe(true)
    expect(before.code, before.stderr).toBe(0)
    expect(tool(before, 0)).toMatchObject({ isError: true, structuredContent: { code: 'NOT_OWNER' } })

    // ── 3. both declare; A lists, B stays out of A's other channels ──
    const [roleB] = await runInTab(win, TOWER_B, [{ kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'ask'] }])
    expect(roleB.code, roleB.stderr).toBe(0)
    const [roleA, mcp] = await runInTab(win, TOWER_A, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      { kind: 'mcp', requests: [
        call('bat_list_terminals', { scope: 'towers' }),
        call('bat_get_state', { terminalId: TOWER_B }),
        call('bat_read_output', { terminalId: TOWER_B }),
        call('bat_list_terminals'),
        call('bat_list_terminals', { scope: 'workspace' }),
      ] },
    ])
    expect(roleA.code, roleA.stderr).toBe(0)
    expect(mcp.code, mcp.stderr).toBe(0)
    const towers = structured(mcp, 0) as { scope: string; terminals: Array<Record<string, unknown>> }
    log(`scope=towers: ${JSON.stringify(towers)}`)
    expect(towers.scope).toBe('towers')
    const ids = towers.terminals.map(t => t.id).sort()
    expect(ids).toEqual([TOWER_A, TOWER_B].sort())
    expect(towers.terminals.find(t => t.id === TOWER_A)).toMatchObject({ workspaceId: WS_A, workspaceName: 'Alpha', claudeSessionName: NAME_A, alive: true, self: true })
    expect(towers.terminals.find(t => t.id === TOWER_B)).toMatchObject({ workspaceId: WS_B, workspaceName: 'T0643-B', claudeSessionName: NAME_B, alive: true, self: false })
    for (const row of towers.terminals) {
      expect(Object.keys(row).filter(k => !['id', 'workspaceId', 'workspaceName', 'title', 'claudeSessionName', 'state', 'alive', 'self'].includes(k))).toEqual([])
    }
    const summary = (tool(mcp, 0)!.content as Array<{ text: string }>)[0].text
    expect(summary).toContain(`session="${NAME_B}"`)
    expect(tool(mcp, 1)).toMatchObject({ isError: true, structuredContent: { code: 'NOT_OWNER' } })
    expect(tool(mcp, 2)).toMatchObject({ isError: true, structuredContent: { code: 'NOT_OWNER' } })
    expect((structured(mcp, 3) as { terminals: Array<{ id: string }> }).terminals.map(t => t.id)).toEqual([TOWER_A])
    expect((structured(mcp, 4) as { terminals: Array<{ id: string }> }).terminals.map(t => t.id).sort()).toEqual([TOWER_A, SHELL_A].sort())

    const [shellList] = await runInTab(win, SHELL_A, [{ kind: 'mcp', requests: [call('bat_list_terminals', { scope: 'towers' })] }])
    expect(tool(shellList, 0)).toMatchObject({ isError: true, structuredContent: { code: 'NOT_OWNER' } })

    // ── 4. audit ──
    const debug = readDebugLogs(userData)
    expect(debug).toContain(`[helper-query] channel=terminal:list caller=${TOWER_A} target=scope=towers → ok count=2`)
    expect(debug).toContain(`[helper-query] channel=terminal:list caller=${SHELL_A} target=scope=towers → NOT_OWNER`)
    const auditLines = debug.split('\n').filter(l => l.includes('target=scope=towers'))
    for (const line of auditLines) {
      expect(line).not.toContain(NAME_A)
      expect(line).not.toContain(NAME_B)
    }
    await win.screenshot({ path: test.info().outputPath('towers.png') })
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
