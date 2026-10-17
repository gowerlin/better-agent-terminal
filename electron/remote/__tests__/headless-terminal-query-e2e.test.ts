// @vitest-environment node
/**
 * PLAN-047 M1 / T0582: the read-only helper query channels on a real headless server (T0388
 * harness: in-process server + wss + real node-pty). The queries run INSIDE the headless PTYs,
 * with each PTY's own env (`BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` = its capability), through a node
 * driver that speaks the RemoteServer frames (what the T0584 MCP shim will do).
 *
 *   Tower (declared with terminal:set-role) → whoami / list mine + workspace / get-state /
 *     read-output of its Worker (the token printed there masked) / wait until=exit while the
 *     Worker's shell exits → exited
 *   Worker → whoami (worker, its tower) / its tower's state ok / its tower's output → NOT_OWNER
 *   plain shell (undeclared tower) → whoami shell / list scope=workspace → NOT_OWNER
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { HelperCapabilityRegistry } from '../helper-capability'
import { startHeadlessHarness, type HeadlessClient, type HeadlessHarness } from './helpers/headless-harness'

const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'
const WORKSPACE = 'client-ws-t0582'
const MARK = 'T0582-WORKER-MARK'

let seq = 0
const termId = (label: string) => `t0582-${label}-${process.pid}-${seq++}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let tmpDir: string
let driverScript: string
let registry: HelperCapabilityRegistry
let harness: HeadlessHarness
let bat: HeadlessClient

const DRIVER_SOURCE = (wsModule: string) => `
const fs = require('fs')
const WebSocket = require(${JSON.stringify(wsModule)})
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const env = process.env
const fill = v => typeof v === 'string' ? v.replace(/\\{env:([A-Z0-9_]+)\\}/g, (_, n) => env[n] || '') : v
const out = { terminalId: env.BAT_TERMINAL_ID, tokenShape: String(env.BAT_REMOTE_TOKEN || '').slice(0, 7), calls: [] }
const finish = () => { fs.writeFileSync(job.out + '.tmp', JSON.stringify(out)); fs.renameSync(job.out + '.tmp', job.out); process.exit(0) }
const ws = new WebSocket('wss://127.0.0.1:' + env.BAT_REMOTE_PORT, { rejectUnauthorized: false })
const waiting = new Map()
const send = frame => new Promise(done => { waiting.set(frame.id, done); ws.send(JSON.stringify(frame)) })
setTimeout(() => { out.error = 'timeout'; finish() }, 60000)
ws.on('error', e => { out.error = String(e && e.message); finish() })
ws.on('message', raw => { let f; try { f = JSON.parse(String(raw)) } catch { return } const d = waiting.get(f.id); if (d) { waiting.delete(f.id); d(f) } })
ws.on('open', async () => {
  const auth = await send({ type: 'auth', id: 'auth', token: env.BAT_REMOTE_TOKEN, args: ['t0582-driver'] })
  if (auth.error) { out.error = auth.error; return finish() }
  let n = 0
  for (const call of job.calls) {
    const args = call.args.map(a => a && typeof a === 'object' ? Object.fromEntries(Object.entries(a).map(([k, v]) => [k, fill(v)])) : fill(a))
    const frame = await send({ type: 'invoke', id: 'c' + (n++), channel: call.channel, args })
    out.calls.push({ channel: call.channel, result: frame.result, error: frame.error })
  }
  ws.close()
  finish()
})
`

interface DriverRun {
  terminalId: string
  tokenShape: string
  error?: string
  calls: Array<{ channel: string; result?: Record<string, unknown>; error?: string }>
}

async function waitForFile(file: string, timeoutMs = 60_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${file}`)
}

/** Types `node driver.cjs <job>` into PTY `id`; returns the job's result file. */
async function startDriver(id: string, calls: Array<{ channel: string; args: unknown[] }>): Promise<string> {
  const name = `job-${seq++}`
  const out = path.join(tmpDir, `${name}.out.json`)
  const jobFile = path.join(tmpDir, `${name}.json`)
  fs.writeFileSync(jobFile, JSON.stringify({ calls, out }))
  expect(await bat.invoke('pty:write', id, `node "${driverScript}" "${jobFile}"\r`)).toMatchObject({ ok: true })
  return out
}

async function queryIn(id: string, calls: Array<{ channel: string; args: unknown[] }>): Promise<DriverRun> {
  const run = JSON.parse(await waitForFile(await startDriver(id, calls))) as DriverRun
  expect(run.error).toBeUndefined()
  return run
}

const outputOf = (id: string) => bat.events.filter(e => e.channel === 'pty:output' && e.args[0] === id).map(e => String(e.args[1] ?? '')).join('')

async function createPty(id: string, customEnv?: Record<string, string>): Promise<void> {
  const result = await bat.invoke('pty:create', { id, cwd: CWD, type: 'terminal', workspaceId: WORKSPACE, ...(SHELL ? { shell: SHELL } : {}), ...(customEnv ? { customEnv } : {}) })
  expect(result).toMatchObject({ ok: true, created: true })
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0582-e2e-'))
  driverScript = path.join(tmpDir, 'driver.cjs')
  fs.writeFileSync(driverScript, DRIVER_SOURCE(require.resolve('ws').split(path.sep).join('/')))
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry })
  bat = harness
})

afterAll(async () => {
  await harness?.dispose()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('helper query channels from inside headless PTYs (T0582)', () => {
  let tower: string
  let worker: string
  let plain: string
  const fakeToken = 'batcap.' + 'Zq7'.repeat(15)

  it('setup: Tower (declares its role), its Worker, a plain shell — same workspace', async () => {
    tower = termId('tower')
    worker = termId('worker')
    plain = termId('plain')
    await createPty(tower)
    await createPty(worker, { BAT_TOWER_TERMINAL_ID: tower, CT_MODE: 'yolo' })
    await createPty(plain)
    expect(registry.isWorkerOf(worker, tower)).toBe(true)
    await sleep(1_500) // shells print their prompts
    const run = await queryIn(tower, [{ channel: 'terminal:set-role', args: [{ terminalId: '{env:BAT_TERMINAL_ID}', role: 'tower' }] }])
    expect(run.tokenShape).toBe('batcap.')
    expect(run.calls[0].result).toMatchObject({ ok: true, terminalId: tower, role: 'tower' })
    // the Worker prints a marker and something token-shaped
    expect(await bat.invoke('pty:write', worker, `echo ${MARK} ${fakeToken}\r`)).toMatchObject({ ok: true })
    await vi.waitFor(() => expect(outputOf(worker)).toContain(MARK), { timeout: 20_000, interval: 100 })
  }, 120_000)

  it('Worker: whoami = worker of its tower; its tower’s state ok, its tower’s output → NOT_OWNER', async () => {
    const run = await queryIn(worker, [
      { channel: 'terminal:whoami', args: [] },
      { channel: 'terminal:get-state', args: [{ terminalId: tower }] },
      { channel: 'terminal:read-output', args: [{ terminalId: tower }] },
      { channel: 'terminal:list', args: [] },
    ])
    expect(run.calls[0].result).toMatchObject({ ok: true, terminalId: worker, role: 'worker', towerTerminalId: tower, workspaceId: WORKSPACE, yolo: true })
    expect(run.calls[1].result).toMatchObject({ ok: true, terminalId: tower, source: 'output' })
    expect(run.calls[2].result).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect((run.calls[3].result?.terminals as Array<{ id: string }>).map(t => t.id).sort()).toEqual([tower, worker].sort())
  }, 90_000)

  it('plain shell: whoami = shell; list scope=workspace → NOT_OWNER; another tab → NOT_OWNER', async () => {
    const run = await queryIn(plain, [
      { channel: 'terminal:whoami', args: [] },
      { channel: 'terminal:list', args: [{ scope: 'workspace' }] },
      { channel: 'terminal:get-state', args: [{ terminalId: worker }] },
    ])
    expect(run.calls[0].result).toMatchObject({ ok: true, terminalId: plain, role: 'shell' })
    expect(run.calls[1].result).toMatchObject({ ok: false, code: 'NOT_OWNER' })
    expect(run.calls[2].result).toEqual({ ok: false, code: 'NOT_OWNER' })
  }, 90_000)

  it('Tower: whoami / list / get-state / read-output (masked) / wait until=exit while the Worker exits', async () => {
    const outFile = await startDriver(tower, [
      { channel: 'terminal:whoami', args: [] },
      { channel: 'terminal:list', args: [{ scope: 'mine' }] },
      { channel: 'terminal:list', args: [{ scope: 'workspace' }] },
      { channel: 'terminal:get-state', args: [{ terminalId: worker }] },
      { channel: 'terminal:read-output', args: [{ terminalId: worker }] },
      { channel: 'terminal:wait', args: [{ terminalId: worker, until: 'exit', timeoutMs: 30_000 }] },
      { channel: 'terminal:get-state', args: [{ terminalId: worker }] },
    ])
    // the Worker's shell exits while the Tower waits
    await sleep(3_000)
    expect(await bat.invoke('pty:write', worker, 'exit\r')).toMatchObject({ ok: true })
    const run = JSON.parse(await waitForFile(outFile)) as DriverRun
    expect(run.error).toBeUndefined()
    const [whoami, mine, workspace, state, read, wait, after] = run.calls.map(c => c.result)
    expect(whoami).toMatchObject({ ok: true, terminalId: tower, role: 'tower', workspaceId: WORKSPACE })
    expect((mine?.terminals as Array<{ id: string }>).map(t => t.id).sort()).toEqual([tower, worker].sort())
    expect((workspace?.terminals as Array<{ id: string }>).map(t => t.id).sort()).toEqual([tower, worker, plain].sort())
    expect(state).toMatchObject({ ok: true, terminalId: worker, source: 'output' })
    expect(['working', 'idle']).toContain(state?.state)
    expect(read).toMatchObject({ ok: true, terminalId: worker })
    const text = (read?.lines as string[]).join('\n')
    expect(text).toContain(MARK)
    expect(text).toContain('[REDACTED:batcap]')
    expect(text).not.toContain(fakeToken)
    expect(read?.masked).toBeGreaterThanOrEqual(1)
    expect(wait).toMatchObject({ ok: true, terminalId: worker, changed: true, state: 'exited' })
    expect(after).toMatchObject({ ok: true, state: 'exited' })
    // the Worker's capability went with its PTY
    expect(registry.isWorkerOf(worker, tower)).toBe(false)
  }, 120_000)

  it('teardown', async () => {
    for (const id of [plain, tower]) expect(await bat.invoke('pty:kill', id)).toBe(true)
    expect(registry.size).toBe(0)
  })
})
