// PLAN-047 M1 / T0582: read-only helper query channels from inside the tabs of an isolated BAT.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Every query
// runs INSIDE a tab, with that tab's own env (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN = its capability),
// through a node runner that speaks the RemoteServer frames and writes the answers to a JSON file.
// The Worker agent is a custom CLI running the same runner — nothing starts an LLM.
//
//   1. the Tower declares itself (`--set-role tower`) and dispatches a Worker (agent mode); the
//      Worker prints a marker and a token-shaped string, then: whoami = worker, its tower's state
//      ok, its tower's output → NOT_OWNER
//   2. Tower: whoami / list (mine, workspace) / get-state / read-output (marker seen, token masked)
//   3. Tower: wait until=exit while the Worker's shell exits → changed, exited
//   4. a plain tab (undeclared tower): whoami = shell, list scope=workspace → NOT_OWNER
//   5. the debug log has the [helper-query] audit lines, never the output or a token

import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0582')
const WS = 'e2e-t0582-ws'
const TOWER = 'e2e-t0582-tower'
const PLAIN = 'e2e-t0582-plain'
const WORKER_AGENT = 'e2e-t0582-worker'
const MARK = 'T0582-WORKER-MARK'

interface Call { channel: string; result?: Record<string, unknown>; error?: string }
interface StepResult {
  kind: string
  code?: number | null
  stdout?: string
  stderr?: string
  terminalId?: string
  token?: string
  calls?: Call[]
  authError?: string
}

/**
 * `node runner.cjs <spec.json>`: the spec's steps with this process's env; results to `spec.out`
 * (temp file + rename). `$BAT_TERMINAL_ID` / `$BAT_TOWER_TERMINAL_ID` are replaced in args, also
 * inside invoke argument objects.
 *   - `{ kind: 'env' }`                   BAT_TERMINAL_ID / token
 *   - `{ kind: 'print', text }`           writes text to stdout (the tab's output)
 *   - `{ kind: 'helper', script, args }`  `node $BAT_HELPER_DIR/<script> ...args`
 *   - `{ kind: 'invoke', calls }`         wss to BAT_REMOTE_PORT, auth with BAT_REMOTE_TOKEN
 */
const RUNNER = (wsModule: string) => `
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const WebSocket = require(${JSON.stringify(wsModule)})
const env = process.env
const sub = s => String(s).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || '').replace(/\\$BAT_TOWER_TERMINAL_ID/g, env.BAT_TOWER_TERMINAL_ID || '')
const subAll = v => typeof v === 'string' ? sub(v) : v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subAll(x)])) : v
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))

function invoke(calls) {
  return new Promise(resolve => {
    const out = { kind: 'invoke', calls: [] }
    const ws = new WebSocket('wss://127.0.0.1:' + env.BAT_REMOTE_PORT, { rejectUnauthorized: false })
    const waiting = new Map()
    const timer = setTimeout(() => { out.authError = out.authError || 'timeout'; ws.terminate(); resolve(out) }, 90000)
    const send = (frame) => new Promise(done => { waiting.set(frame.id, done); ws.send(JSON.stringify(frame)) })
    ws.on('error', e => { out.authError = String(e && e.message); clearTimeout(timer); resolve(out) })
    ws.on('message', raw => {
      let frame
      try { frame = JSON.parse(String(raw)) } catch { return }
      const done = waiting.get(frame.id)
      if (done) { waiting.delete(frame.id); done(frame) }
    })
    ws.on('open', async () => {
      const auth = await send({ type: 'auth', id: 'auth', token: env.BAT_REMOTE_TOKEN, args: ['t0582-probe'] })
      if (auth.error) { out.authError = auth.error } else {
        let n = 0
        for (const call of calls) {
          const frame = await send({ type: 'invoke', id: 'c' + (n++), channel: call.channel, args: call.args.map(subAll) })
          out.calls.push({ channel: call.channel, result: frame.result, error: frame.error })
        }
      }
      clearTimeout(timer)
      ws.close()
      resolve(out)
    })
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
      const args = step.args.map(sub)
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...args], { env, encoding: 'utf8', timeout: 30000, windowsHide: true })
      results.push({ kind: 'helper', code: run.status, stdout: run.stdout, stderr: run.stderr })
    } else if (step.kind === 'invoke') {
      results.push(await invoke(step.calls))
    }
  }
  const out = sub(spec.out)
  fs.writeFileSync(out + '.tmp', JSON.stringify(results, null, 2))
  fs.renameSync(out + '.tmp', out)
})()
`

function readResults(file: string): StepResult[] | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as StepResult[] : undefined
}

const ids = (r?: Record<string, unknown>) => ((r?.terminals ?? []) as Array<{ id: string }>).map(t => t.id).sort()

test('helper query channels: whoami / list / get-state / read-output / wait from inside the tabs, scoped', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0582-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER(slash(require.resolve('ws', { paths: [REPO_ROOT] }))))
  const fakeToken = 'batcap.' + 'Zq7'.repeat(15)
  const workerSpec = slash(path.join(tmp, 'worker-spec.json'))
  fs.writeFileSync(workerSpec, JSON.stringify({
    out: slash(path.join(tmp, 'worker-$BAT_TERMINAL_ID.json')),
    steps: [
      { kind: 'print', text: `${MARK} BAT_REMOTE_TOKEN=${fakeToken}` },
      { kind: 'env' },
      { kind: 'invoke', calls: [
        { channel: 'terminal:whoami', args: [] },
        { channel: 'terminal:get-state', args: [{ terminalId: '$BAT_TOWER_TERMINAL_ID' }] },
        { channel: 'terminal:read-output', args: [{ terminalId: '$BAT_TOWER_TERMINAL_ID' }] },
      ] },
    ],
  }))

  let specSeq = 0
  /** Types `node runner.cjs <spec>` into tab `id`; returns the result file to poll. */
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
    // never a token in the test log (T0582: tokens stay out of logs / reports / snapshots)
    log(`${path.basename(out)}: ${JSON.stringify(r).replace(/batcap\.[A-Za-z0-9_-]+/g, 'batcap.<redacted>').slice(0, 3000)}`)
    return r
  }
  const runInTab = async (win: Page, id: string, steps: unknown[]) => results(await startInTab(win, id, steps))

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0582', log)
    const { win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0582 worker', icon: 'W', color: '#888888', command: 'node', args: [runner, workerSpec],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0582', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [
        { id: TOWER, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder },
        { id: PLAIN, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder },
      ],
      activeTerminalId: TOWER,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    for (const id of [TOWER, PLAIN]) {
      await expect.poll(async () => win.evaluate((tid) => (window as AnyApi).electronAPI.pty.getCwd(tid), id), { timeout: 30_000 }).not.toBeNull()
    }
    await win.waitForTimeout(2_000)

    // ── 1. the Tower declares itself and dispatches a Worker ──
    const [role, dispatch] = await runInTab(win, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--mode', 'yolo'] },
      { kind: 'helper', script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0582', '--mode', 'yolo'] },
    ])
    expect(role.code, role.stderr).toBe(0)
    expect(dispatch.code, dispatch.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(dispatch.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    const [, workerEnv, workerQuery] = await results(path.join(tmp, `worker-${worker}.json`))
    expect(workerEnv.token?.startsWith('batcap.')).toBe(true)
    expect(workerQuery.authError).toBeUndefined()
    const [wWhoami, wTowerState, wTowerOutput] = workerQuery.calls!.map(c => c.result)
    expect(wWhoami).toMatchObject({ ok: true, terminalId: worker, role: 'worker', towerTerminalId: TOWER, workorder: 'T0582', workspaceId: WS })
    expect(wTowerState).toMatchObject({ ok: true, terminalId: TOWER, source: 'output' })
    expect(wTowerOutput).toEqual({ ok: false, code: 'NOT_OWNER' })

    // ── 2. Tower: whoami / list / get-state / read-output ──
    const [towerQuery] = await runInTab(win, TOWER, [{ kind: 'invoke', calls: [
      { channel: 'terminal:whoami', args: [] },
      { channel: 'terminal:list', args: [] },
      { channel: 'terminal:list', args: [{ scope: 'workspace' }] },
      { channel: 'terminal:get-state', args: [{ terminalId: worker }] },
      { channel: 'terminal:read-output', args: [{ terminalId: worker }] },
    ] }])
    expect(towerQuery.authError).toBeUndefined()
    const [whoami, mine, workspace, state, read] = towerQuery.calls!.map(c => c.result)
    expect(whoami).toMatchObject({ ok: true, terminalId: TOWER, role: 'tower', workspaceId: WS, yolo: true, towerMode: 'yolo' })
    expect(ids(mine)).toEqual([TOWER, worker!].sort())
    expect(ids(workspace)).toEqual([TOWER, PLAIN, worker!].sort())
    // titles come from the saved tabs (local only)
    expect(((workspace?.terminals ?? []) as Array<{ id: string; title?: string }>).find(t => t.id === worker)?.title).toContain('T0582')
    expect(state).toMatchObject({ ok: true, terminalId: worker, source: 'output' })
    expect(read).toMatchObject({ ok: true, terminalId: worker })
    const text = (read?.lines as string[]).join('\n')
    expect(text).toContain(MARK)
    expect(text).toContain('[REDACTED:batcap]')
    expect(text).not.toContain(fakeToken)
    expect(read?.masked as number).toBeGreaterThanOrEqual(1)

    // ── 3. Tower: wait until=exit while the Worker's shell exits ──
    const waitOut = await startInTab(win, TOWER, [{ kind: 'invoke', calls: [
      { channel: 'terminal:wait', args: [{ terminalId: worker, until: 'exit', timeoutMs: 40_000 }] },
      { channel: 'terminal:get-state', args: [{ terminalId: worker }] },
    ] }])
    await win.waitForTimeout(3_000)
    expect(readResults(waitOut)).toBeUndefined()
    await win.evaluate((id) => (window as AnyApi).electronAPI.pty.write(id, 'exit\r'), worker)
    const [waited] = await results(waitOut)
    expect(waited.authError).toBeUndefined()
    expect(waited.calls![0].result).toMatchObject({ ok: true, terminalId: worker, changed: true, state: 'exited' })
    expect(waited.calls![1].result).toMatchObject({ ok: true, state: 'exited' })

    // ── 4. a plain tab (tower capability, not declared) ──
    const [plainQuery] = await runInTab(win, PLAIN, [{ kind: 'invoke', calls: [
      { channel: 'terminal:whoami', args: [] },
      { channel: 'terminal:list', args: [{ scope: 'workspace' }] },
      { channel: 'terminal:read-output', args: [{ terminalId: TOWER }] },
    ] }])
    const [pWhoami, pList, pRead] = plainQuery.calls!.map(c => c.result)
    expect(pWhoami).toMatchObject({ ok: true, terminalId: PLAIN, role: 'shell' })
    expect(pList).toMatchObject({ ok: false, code: 'NOT_OWNER' })
    expect(pRead).toEqual({ ok: false, code: 'NOT_OWNER' })

    // ── 5. audit lines; never the output or a token ──
    const debugDir = path.join(userData, 'Logs')
    const debug = fs.readdirSync(debugDir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(debugDir, f), 'utf8')).join('\n')
    expect(debug).toContain(`[helper-query] channel=terminal:read-output caller=${TOWER} target=${worker} → ok`)
    expect(debug).toContain(`[helper-query] channel=terminal:read-output caller=${worker} target=${TOWER} → NOT_OWNER`)
    expect(debug).toContain(`[helper-query] channel=terminal:list caller=${PLAIN} target=scope=workspace → NOT_OWNER`)
    expect(debug).not.toContain(fakeToken)
    expect(debug).not.toContain(MARK)
    expect(debug).not.toContain(workerEnv.token!)
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
