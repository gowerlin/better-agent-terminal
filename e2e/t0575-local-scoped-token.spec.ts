// PLAN-047 / T0575 (D149): local PTYs get a per-PTY capability (`batcap.`), not the server token.
//
// Isolated source build (`npx vite build` first), see fixtures/electron-isolation.ts. Every helper
// runs INSIDE a tab of the isolated instance, with that tab's own env (BAT_REMOTE_PORT / _TOKEN /
// BAT_TERMINAL_ID / BAT_USER_DATA), through a node runner that records exit codes and output to a
// JSON file. The Worker agent is a custom CLI running the same runner — nothing starts an LLM.
//
//   1. the Tower tab's token starts with `batcap.` and is not the server token; it may not
//      `pty:create`; a manual `bat-notify` from it (not a Worker) is refused (behaviour change)
//   2. Tower dispatches in agent mode (`--skill ct-exec --workorder`): the Worker's token is
//      `batcap.` too; its `bat-notify --submit` reaches the Tower; its `pty:create` / `fs:*` /
//      `terminal:create-with-command` are Forbidden
//   3. Tower dispatches in raw command mode (`bat-terminal.mjs node <script>`, D149) → created
//   4. Tower `--close-worker` → the Worker tab closes; `--set-role tower` → `Claude CLI · Tower`
//   5. the server token still works through the RemoteServer (test process)

import { test, expect, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT, closeIsolated, launchIsolated, testLogger, type IsolatedInstance } from './fixtures/electron-isolation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any

const log = testLogger('t0575')
const WS = 'e2e-t0575-ws'
const TOWER = 'e2e-t0575-tower'
const WORKER_AGENT = 'e2e-t0575-worker'
const RAW_MARK = 'T0575-RAW-COMMAND-RAN'

interface StepResult {
  kind: string
  script?: string
  args?: string[]
  code?: number | null
  stdout?: string
  stderr?: string
  terminalId?: string
  towerTerminalId?: string
  token?: string
  calls?: Array<{ channel: string; result?: unknown; error?: string }>
  authError?: string
}

/**
 * `node runner.cjs <spec.json>`: runs the spec's steps with this process's env and writes the
 * results to `spec.out` (`$BAT_TERMINAL_ID` replaced) — via a temp file + rename, so the test
 * never reads half a file.
 *   - `{ kind: 'env' }`                         BAT_TERMINAL_ID / BAT_TOWER_TERMINAL_ID / token
 *   - `{ kind: 'helper', script, args }`        `node $BAT_HELPER_DIR/<script> ...args`
 *   - `{ kind: 'invoke', calls }`               wss to BAT_REMOTE_PORT, auth with BAT_REMOTE_TOKEN
 * `$BAT_TERMINAL_ID` / `$BAT_TOWER_TERMINAL_ID` in args are replaced from the env.
 */
const RUNNER = (wsModule: string) => `
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const WebSocket = require(${JSON.stringify(wsModule)})
const env = process.env
const sub = s => String(s).replace(/\\$BAT_TERMINAL_ID/g, env.BAT_TERMINAL_ID || '').replace(/\\$BAT_TOWER_TERMINAL_ID/g, env.BAT_TOWER_TERMINAL_ID || '')
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))

function invoke(calls) {
  return new Promise(resolve => {
    const out = { kind: 'invoke', calls: [] }
    const ws = new WebSocket('wss://127.0.0.1:' + env.BAT_REMOTE_PORT, { rejectUnauthorized: false })
    const waiting = new Map()
    const timer = setTimeout(() => { out.authError = out.authError || 'timeout'; ws.terminate(); resolve(out) }, 15000)
    const send = (frame) => new Promise(done => { waiting.set(frame.id, done); ws.send(JSON.stringify(frame)) })
    ws.on('error', e => { out.authError = String(e && e.message); clearTimeout(timer); resolve(out) })
    ws.on('message', raw => {
      let frame
      try { frame = JSON.parse(String(raw)) } catch { return }
      const done = waiting.get(frame.id)
      if (done) { waiting.delete(frame.id); done(frame) }
    })
    ws.on('open', async () => {
      const auth = await send({ type: 'auth', id: 'auth', token: env.BAT_REMOTE_TOKEN, args: ['t0575-probe'] })
      if (auth.error) { out.authError = auth.error } else {
        let n = 0
        for (const call of calls) {
          const frame = await send({ type: 'invoke', id: 'c' + (n++), channel: call.channel, args: call.args.map(a => typeof a === 'string' ? sub(a) : a) })
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
      results.push({ kind: 'env', terminalId: env.BAT_TERMINAL_ID, towerTerminalId: env.BAT_TOWER_TERMINAL_ID, token: env.BAT_REMOTE_TOKEN })
    } else if (step.kind === 'helper') {
      if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs))
      const args = step.args.map(sub)
      const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, step.script), ...args], { env, encoding: 'utf8', timeout: 30000, windowsHide: true })
      results.push({ kind: 'helper', script: step.script, args, code: run.status, stdout: run.stdout, stderr: run.stderr })
    } else if (step.kind === 'invoke') {
      results.push(await invoke(step.calls))
    }
  }
  const out = sub(spec.out)
  fs.writeFileSync(out + '.tmp', JSON.stringify(results, null, 2))
  fs.renameSync(out + '.tmp', out)
})()
`

/** Screen text of a replay buffer: CSI / OSC sequences removed (pwsh colours `T0575` and `完成` apart). */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

function readResults(file: string): StepResult[] | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as StepResult[] : undefined
}

async function registryTerminalIds(win: Page): Promise<string[]> {
  const raw = await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())
  return raw ? (JSON.parse(raw) as { terminals: { id: string }[] }).terminals.map(t => t.id) : []
}

test('local PTYs: batcap. capabilities, every helper mode from inside the tabs, workers confined', async () => {
  test.setTimeout(300_000)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0575-'))
  const folder = path.join(tmp, 'ws')
  fs.mkdirSync(folder, { recursive: true })
  const slash = (p: string) => p.split(path.sep).join('/')
  const wsModule = slash(require.resolve('ws', { paths: [REPO_ROOT] }))
  const runner = slash(path.join(tmp, 'runner.cjs'))
  fs.writeFileSync(runner, RUNNER(wsModule))
  const rawScript = slash(path.join(tmp, 'raw.cjs'))
  fs.writeFileSync(rawScript, `process.stdout.write('${RAW_MARK}\\n')\n`)
  // The Worker: what ct-exec does at its end (bat-notify --submit), then what it must not do.
  const workerSpec = slash(path.join(tmp, 'worker-spec.json'))
  fs.writeFileSync(workerSpec, JSON.stringify({
    out: slash(path.join(tmp, 'worker-$BAT_TERMINAL_ID.json')),
    steps: [
      { kind: 'env' },
      { kind: 'helper', script: 'bat-notify.mjs', args: ['--source', 'T0575', '--target', '$BAT_TOWER_TERMINAL_ID', '--submit', 'T0575 完成'] },
      { kind: 'invoke', calls: [
        { channel: 'pty:create', args: [{ id: 'e2e-t0575-evil', cwd: slash(folder), type: 'terminal' }] },
        { channel: 'fs:readdir', args: [slash(folder)] },
        { channel: 'terminal:create-with-command', args: [{ id: 'e2e-t0575-evil-2', cwd: slash(folder), command: 'echo pwned' }] },
        { channel: 'pty:get-buffer', args: ['$BAT_TOWER_TERMINAL_ID'] },
      ] },
    ],
  }))
  let specSeq = 0
  /** Types `node runner.cjs <spec>` into tab `id`; resolves with the results it wrote. */
  const runInTab = async (win: Page, id: string, steps: unknown[]): Promise<StepResult[]> => {
    const n = specSeq++
    const out = slash(path.join(tmp, `tab-${n}.json`))
    const spec = slash(path.join(tmp, `tab-${n}-spec.json`))
    fs.writeFileSync(spec, JSON.stringify({ out, steps }))
    await win.evaluate(({ id, line }) => (window as AnyApi).electronAPI.pty.write(id, line), { id, line: `node "${runner}" "${spec}"\r` })
    await expect.poll(() => readResults(out) !== undefined, { timeout: 60_000 }).toBe(true)
    const results = readResults(out)!
    log(`tab ${id} step ${n}: ${JSON.stringify(results).slice(0, 2000)}`)
    return results
  }

  let inst: IsolatedInstance | undefined
  try {
    inst = await launchIsolated('t0575', log)
    const { app, win, userData } = inst

    await expect.poll(async () => (await win.evaluate(async () => (window as AnyApi).electronAPI.workspace.load())) !== null, { timeout: 30_000 }).toBe(true)
    expect(await win.evaluate((def) => (window as AnyApi).electronAPI.agent.registerCustomCli(def), {
      id: WORKER_AGENT, name: 'T0575 worker', icon: 'W', color: '#888888', command: 'node', args: [runner, workerSpec],
    })).toBeTruthy()
    const seed = {
      workspaces: [{ id: WS, name: 'T0575', folderPath: folder, createdAt: Date.now(), defaultAgent: WORKER_AGENT }],
      activeWorkspaceId: WS,
      activeGroup: null,
      terminals: [{ id: TOWER, workspaceId: WS, type: 'terminal', title: 'New Terminal', cwd: folder }],
      activeTerminalId: null,
    }
    expect(await win.evaluate(async (data) => (window as AnyApi).electronAPI.workspace.save(data), JSON.stringify(seed))).toBe(true)
    await win.reload()
    await win.waitForLoadState('domcontentloaded')
    const view = win.locator('.workspace-container.active')
    await expect(view.locator('.terminal-wrapper')).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(async () => win.evaluate((id) => (window as AnyApi).electronAPI.pty.getCwd(id), TOWER), { timeout: 30_000 }).not.toBeNull()
    // give the shell time to print its prompt before the first typed line
    await win.waitForTimeout(2_000)

    await expect.poll(() => fs.existsSync(path.join(userData, 'server-token.json')), { timeout: 30_000 }).toBe(true)
    const record = JSON.parse(fs.readFileSync(path.join(userData, 'server-token.json'), 'utf8'))
    const serverToken: string = record.encrypted
      ? await app.evaluate(({ safeStorage }, data) => safeStorage.decryptString(Buffer.from(data, 'base64')), record.data as string)
      : record.data

    // ── 1. the Tower tab: a tower capability, not the server token ──
    const [towerEnv, towerProbe, manualNotify] = await runInTab(win, TOWER, [
      { kind: 'env' },
      { kind: 'invoke', calls: [{ channel: 'pty:create', args: [{ id: 'e2e-t0575-tower-evil', cwd: slash(folder), type: 'terminal' }] }] },
      { kind: 'helper', script: 'bat-notify.mjs', args: ['--source', 'manual', '--target', '$BAT_TERMINAL_ID', 'manual note'] },
    ])
    expect(towerEnv.terminalId).toBe(TOWER)
    expect(towerEnv.token?.startsWith('batcap.')).toBe(true)
    expect(towerEnv.token).not.toBe(serverToken)
    expect(towerProbe.authError).toBeUndefined()
    expect(towerProbe.calls).toEqual([{ channel: 'pty:create', error: 'Forbidden: channel-not-allowed' }])
    // Behaviour change (T0575 report): bat-notify from a tab that is not a Worker is refused
    expect(manualNotify.code).toBe(1)
    expect(manualNotify.stderr).toContain('Forbidden: role-not-allowed')

    // ── 2. agent mode: Tower dispatches a Worker; the Worker reports with --submit ──
    const [agentDispatch] = await runInTab(win, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, '--skill', 'ct-exec', '--workorder', 'T0575', '--mode', 'yolo'] },
    ])
    expect(agentDispatch.code, agentDispatch.stderr).toBe(0)
    const worker = /Terminal created: (\S+)/.exec(agentDispatch.stdout ?? '')?.[1]
    expect(worker).toBeTruthy()
    const workerFile = path.join(tmp, `worker-${worker}.json`)
    await expect.poll(() => readResults(workerFile) !== undefined, { timeout: 60_000 }).toBe(true)
    const [workerEnv, workerNotify, workerProbe] = readResults(workerFile)!
    log(`worker ${worker}: ${JSON.stringify(readResults(workerFile)).slice(0, 3000)}`)
    expect(workerEnv).toMatchObject({ terminalId: worker, towerTerminalId: TOWER })
    expect(workerEnv.token?.startsWith('batcap.')).toBe(true)
    expect(workerEnv.token).not.toBe(serverToken)
    expect(workerEnv.token).not.toBe(towerEnv.token)
    expect(workerNotify.code, workerNotify.stderr).toBe(0)
    expect(workerNotify.stderr).not.toContain('Forbidden')
    expect(workerProbe.authError).toBeUndefined()
    expect(workerProbe.calls).toEqual([
      { channel: 'pty:create', error: 'Forbidden: channel-not-allowed' },
      { channel: 'fs:readdir', error: 'Forbidden: channel-not-allowed' },
      { channel: 'terminal:create-with-command', error: 'Forbidden: role-not-allowed' },
      { channel: 'pty:get-buffer', error: 'Forbidden: channel-not-allowed' },
    ])
    // the pre-fill reached the Tower PTY (and the submit Enter ran it as a command line)
    await expect.poll(async () => {
      const buffer = await win.evaluate((id) => (window as AnyApi).electronAPI.pty.getBuffer(id), TOWER)
      return stripAnsi((buffer as { data?: string } | null)?.data ?? '')
    }, { timeout: 20_000 }).toContain('T0575 完成')
    expect(await registryTerminalIds(win)).toContain(worker)

    // ── 3. raw command mode (D149): the Tower creates a tab running a command of its choice ──
    const [rawDispatch] = await runInTab(win, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', waitMs: 1_200, args: ['--notify-id', '$BAT_TERMINAL_ID', '--workspace', WS, 'node', rawScript] },
    ])
    expect(rawDispatch.code, rawDispatch.stderr).toBe(0)
    const rawTab = /Terminal created: (\S+)/.exec(rawDispatch.stdout ?? '')?.[1]
    expect(rawTab).toBeTruthy()
    await expect.poll(async () => {
      const buffer = await win.evaluate((id) => (window as AnyApi).electronAPI.pty.getBuffer(id), rawTab)
      return stripAnsi((buffer as { data?: string } | null)?.data ?? '')
    }, { timeout: 30_000 }).toContain(RAW_MARK)

    // ── 4. --close-worker and --set-role from the Tower tab ──
    const [closeRun, roleRun] = await runInTab(win, TOWER, [
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--close-worker', 'T0575', '--notify-id', '$BAT_TERMINAL_ID'] },
      { kind: 'helper', script: 'bat-terminal.mjs', args: ['--set-role', 'tower', '--agent', 'claude', '--mode', 'yolo'] },
    ])
    expect(closeRun.code, closeRun.stderr).toBe(0)
    expect(closeRun.stdout).toContain(`✓ Worker close scheduled: ${worker} (in 0 ms)`)
    expect(roleRun.code, roleRun.stderr).toBe(0)
    expect(roleRun.stdout).toContain(`✓ Tower role set: ${TOWER}`)
    await expect(view.locator('.thumbnail-title', { hasText: 'Claude CLI · Tower' })).toHaveCount(1, { timeout: 20_000 })
    await expect.poll(() => registryTerminalIds(win), { timeout: 40_000 }).not.toContain(worker)
    await win.screenshot({ path: test.info().outputPath('after-close-worker.png') })

    // ── 5. the server token still authenticates a client through the RemoteServer ──
    const serverSpec = path.join(tmp, 'server-spec.json')
    const serverOut = path.join(tmp, 'server-out.json')
    fs.writeFileSync(serverSpec, JSON.stringify({ out: slash(serverOut), steps: [{ kind: 'invoke', calls: [{ channel: 'pty:get-cwd', args: [TOWER] }] }] }))
    const env: NodeJS.ProcessEnv = {}
    for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('BAT_') && !k.startsWith('CT_')) env[k] = v
    Object.assign(env, { BAT_REMOTE_PORT: String(inst.remotePort), BAT_REMOTE_TOKEN: serverToken })
    await new Promise<void>((resolve, reject) => execFile(process.execPath, [runner, serverSpec], { env, timeout: 30_000, windowsHide: true }, err => err ? reject(err) : resolve()))
    const [serverProbe] = readResults(serverOut)!
    expect(serverProbe.authError).toBeUndefined()
    expect(serverProbe.calls?.[0].error).toBeUndefined()
    expect(typeof serverProbe.calls?.[0].result).toBe('string')

    // main logs the issue / revoke of capabilities: terminal and role, never the token
    const debugDir = path.join(userData, 'Logs')
    const debug = fs.readdirSync(debugDir).filter(f => f.startsWith('debug-')).map(f => fs.readFileSync(path.join(debugDir, f), 'utf8')).join('\n')
    expect(debug).toContain(`[helper-cap] issued: terminal=${TOWER} role=tower`)
    expect(debug).toContain(`[helper-cap] issued: terminal=${worker} role=worker tower=${TOWER}`)
    expect(debug).toContain(`[helper-cap] revoked: terminal=${worker}`)
    expect(debug).not.toContain(towerEnv.token!)
    expect(debug).not.toContain(workerEnv.token!)
  } finally {
    if (inst) await closeIsolated(inst, log)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
