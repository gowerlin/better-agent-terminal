// @vitest-environment node
/**
 * PLAN-048 / T0607 (C-10): the tower-question channels on a real headless server (T0388 harness:
 * in-process server + wss + real node-pty), invoked from INSIDE the headless PTYs with each PTY's
 * own capability (`BAT_REMOTE_TOKEN`), through the node driver of headless-terminal-query-e2e.
 *
 *   Worker → question:ask (its tower is implied) → Tower: get-state blocked / tower,
 *     question:list, question:answer → Worker: question:wait gets the answer → idle again
 *   Worker → question:answer → Forbidden: role-not-allowed; plain shell (another tower
 *     capability) → list its Worker NOT_OWNER
 *   The Worker's shell exits → its pending question is cancelled (worker-exited), seen by the Tower
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HelperCapabilityRegistry } from '../helper-capability'
import { startHeadlessHarness, type HeadlessClient, type HeadlessHarness } from './helpers/headless-harness'

const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'
const QUESTION = 'T0607-QTEXT which environment?'

let seq = 0
const termId = (label: string) => `t0607-${label}-${process.pid}-${seq++}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let tmpDir: string
let driverScript: string
let registry: HelperCapabilityRegistry
let harness: HeadlessHarness
let bat: HeadlessClient

// the driver of headless-terminal-query-e2e.test.ts (+ the frame `error`)
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
  const auth = await send({ type: 'auth', id: 'auth', token: env.BAT_REMOTE_TOKEN, args: ['t0607-driver'] })
  if (auth.error) { out.error = auth.error; return finish() }
  let n = 0
  for (const call of job.calls) {
    const args = call.args.map(a => a && typeof a === 'object' && !Array.isArray(a) ? Object.fromEntries(Object.entries(a).map(([k, v]) => [k, fill(v)])) : fill(a))
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

async function runIn(id: string, calls: Array<{ channel: string; args: unknown[] }>): Promise<DriverRun> {
  const run = JSON.parse(await waitForFile(await startDriver(id, calls))) as DriverRun
  expect(run.error).toBeUndefined()
  return run
}

async function createPty(id: string, customEnv?: Record<string, string>): Promise<void> {
  const result = await bat.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}), ...(customEnv ? { customEnv } : {}) })
  expect(result).toMatchObject({ ok: true, created: true })
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0607-e2e-'))
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

describe('tower questions from inside headless PTYs (T0607)', () => {
  let tower: string
  let worker: string
  let plain: string

  it('setup: Tower, its Worker, a plain shell', async () => {
    tower = termId('tower')
    worker = termId('worker')
    plain = termId('plain')
    await createPty(tower)
    await createPty(worker, { BAT_TOWER_TERMINAL_ID: tower, CT_MODE: 'yolo' })
    await createPty(plain)
    expect(registry.isWorkerOf(worker, tower)).toBe(true)
    await sleep(1_500) // shells print their prompts
  }, 120_000)

  it('Worker asks → Tower sees blocked / tower, lists, answers → Worker’s wait gets the answer', async () => {
    const asked = await runIn(worker, [
      { channel: 'question:ask', args: [{ question: QUESTION, options: ['staging', 'prod'], allowFreeText: false }] },
      // a worker may not answer, not even its own question
      { channel: 'question:answer', args: [{ towerId: '{env:BAT_TERMINAL_ID}', questionId: 'q-00000000-0000000000000000', choice: 1 }] },
    ])
    expect(asked.tokenShape).toBe('batcap.')
    const ask = asked.calls[0].result
    expect(ask).toMatchObject({ ok: true, status: 'pending', towerTerminalId: tower })
    const id = ask?.questionId as string
    expect(asked.calls[1].error).toMatch(/Forbidden: role-not-allowed/)

    const seen = await runIn(tower, [
      { channel: 'terminal:get-state', args: [{ terminalId: worker }] },
      { channel: 'question:list', args: [{}] },
      { channel: 'question:answer', args: [{ towerId: '{env:BAT_TERMINAL_ID}', questionId: id, choice: 2, text: 'T0607-ANSWER' }] },
      { channel: 'terminal:get-state', args: [{ terminalId: worker }] },
    ])
    const [blocked, list, answered, after] = seen.calls.map(c => c.result)
    expect(blocked).toMatchObject({ ok: true, state: 'blocked', blockedReason: 'tower', source: 'question', pendingQuestions: 1 })
    expect(list).toMatchObject({ ok: true, questions: [{ questionId: id, workerTerminalId: worker, question: QUESTION, options: ['staging', 'prod'], allowFreeText: false }] })
    expect(answered).toMatchObject({ ok: true, questionId: id, status: 'answered' })
    expect(after).toMatchObject({ ok: true, pendingQuestions: 0 })
    expect(['working', 'idle']).toContain(after?.state)

    const waited = await runIn(worker, [{ channel: 'question:wait', args: [{ questionId: id, timeoutMs: 5_000 }] }])
    expect(waited.calls[0].result).toMatchObject({ ok: true, questionId: id, changed: true, status: 'answered', answer: { choice: 2, text: 'T0607-ANSWER' } })
  }, 180_000)

  it('plain shell: its tower capability does not reach another tower’s Worker', async () => {
    const run = await runIn(plain, [
      { channel: 'question:list', args: [{ terminalId: worker }] },
      { channel: 'question:list', args: [{}] },
    ])
    expect(run.calls[0].result).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(run.calls[1].result).toEqual({ ok: true, questions: [] })
  }, 90_000)

  it('the Worker’s shell exits → its pending question is cancelled (worker-exited)', async () => {
    const asked = await runIn(worker, [{ channel: 'question:ask', args: [{ question: QUESTION }] }])
    const id = asked.calls[0].result?.questionId as string
    expect(id).toMatch(/^q-[0-9a-f]{8}-[0-9a-f]{16}$/)
    expect(await bat.invoke('pty:write', worker, 'exit\r')).toMatchObject({ ok: true })
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline && registry.isWorkerOf(worker, tower)) await sleep(100)
    const run = await runIn(tower, [{ channel: 'question:list', args: [{ terminalId: worker, status: 'all' }] }])
    expect(run.calls[0].result?.questions).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: id, status: 'cancelled', endReason: 'worker-exited' }),
    ]))
  }, 120_000)

  it('teardown', async () => {
    for (const id of [plain, tower]) expect(await bat.invoke('pty:kill', id)).toBe(true)
    expect(registry.size).toBe(0)
  })
})
