// @vitest-environment node
/**
 * T0609 (BUG-153): `terminal:attention-changed` on a real headless server (T0388 harness: in-process
 * server + wss + real node-pty) — what a remote window (RemoteClient → `PROXIED_EVENTS`) gets to mark
 * a Worker badge. The Worker's calls run INSIDE its headless PTY with its own capability (the node
 * driver of headless-tower-questions-e2e); the harness client is the BAT window.
 *
 *   Worker question:ask → client: blocked / tower, pendingQuestions 1
 *   Worker hook ask-user-question → client: blocked / question (hook first), hook stop → tower again
 *   Tower question:answer → client: empty state
 *   D155: no attention event carries the question or the answer
 *   T0694: hook user-prompt-submit → client: busy; hook stop → client: empty state
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HelperCapabilityRegistry } from '../helper-capability'
import { PROXIED_EVENTS } from '../protocol'
import { startHeadlessHarness, type HeadlessClient, type HeadlessHarness } from './helpers/headless-harness'
import type { TerminalAttentionEvent } from '../../../src/lib/terminal-attention'

const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'
const QUESTION = 'T0609-QTEXT which environment?'
const ANSWER = 'T0609-ANSWER staging'

let seq = 0
const termId = (label: string) => `t0609-${label}-${process.pid}-${seq++}`
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
  const auth = await send({ type: 'auth', id: 'auth', token: env.BAT_REMOTE_TOKEN, args: ['t0609-driver'] })
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0609-e2e-'))
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

const attentionOf = (id: string): TerminalAttentionEvent[] => harness.events
  .filter(e => e.channel === 'terminal:attention-changed' && (e.args[0] as TerminalAttentionEvent).id === id)
  .map(e => e.args[0] as TerminalAttentionEvent)

async function nextAttention(id: string, predicate: (e: TerminalAttentionEvent) => boolean): Promise<TerminalAttentionEvent> {
  const [event] = await harness.waitForEvent('terminal:attention-changed', args => {
    const e = args[0] as TerminalAttentionEvent
    return e.id === id && predicate(e)
  }, 30_000)
  return event as TerminalAttentionEvent
}

describe('terminal:attention-changed from a headless server (T0609)', () => {
  let tower: string
  let worker: string

  it('is a proxied event (a remote window receives it)', () => {
    expect(PROXIED_EVENTS.has('terminal:attention-changed')).toBe(true)
  })

  it('setup: Tower and its Worker', async () => {
    tower = termId('tower')
    worker = termId('worker')
    await createPty(tower)
    await createPty(worker, { BAT_TOWER_TERMINAL_ID: tower, CT_MODE: 'yolo' })
    expect(registry.isWorkerOf(worker, tower)).toBe(true)
    await sleep(1_500) // shells print their prompts
  }, 120_000)

  it('ask → tower; a hook prompt wins; hook stop → tower; answer → empty', async () => {
    const asked = await runIn(worker, [
      { channel: 'question:ask', args: [{ question: QUESTION }] },
      { channel: 'terminal:report-hook', args: [{ event: 'ask-user-question' }] },
    ])
    const id = asked.calls[0].result?.questionId as string
    expect(asked.calls[0].result).toMatchObject({ ok: true, status: 'pending' })
    expect(asked.calls[1].result).toMatchObject({ ok: true, result: 'blocked' })
    const towerEvent = await nextAttention(worker, e => e.blockedReason === 'tower')
    expect(towerEvent).toMatchObject({ id: worker, blockedReason: 'tower', pendingQuestions: 1 })
    expect(await nextAttention(worker, e => e.blockedReason === 'question')).toMatchObject({ pendingQuestions: 1 })

    await runIn(worker, [{ channel: 'terminal:report-hook', args: [{ event: 'stop' }] }])
    await nextAttention(worker, e => e.blockedReason === 'tower' && attentionOf(worker).some(x => x.blockedReason === 'question'))

    const answered = await runIn(tower, [
      { channel: 'question:answer', args: [{ towerId: '{env:BAT_TERMINAL_ID}', questionId: id, text: ANSWER }] },
    ])
    expect(answered.calls[0].result).toMatchObject({ ok: true, status: 'answered' })
    expect(await nextAttention(worker, e => e.pendingQuestions === 0)).toEqual({ id: worker, pendingQuestions: 0 })
    expect(attentionOf(worker).map(e => e.blockedReason ?? 'none')).toEqual(['tower', 'question', 'tower', 'none'])
    expect(attentionOf(tower)).toEqual([])
    const all = JSON.stringify(harness.events.filter(e => e.channel === 'terminal:attention-changed'))
    expect(all).not.toContain(QUESTION)
    expect(all).not.toContain(ANSWER)
  }, 180_000)

  // T0694 (D180): the agent's turn reaches a remote window too (`busy`, `isAgentTurnActive` on the
  // headless notifier, same wiring as Electron main)
  it('T0694: hook user-prompt-submit → busy; hook stop → empty', async () => {
    const before = attentionOf(worker).length
    await runIn(worker, [{ channel: 'terminal:report-hook', args: [{ event: 'user-prompt-submit' }] }])
    expect(await nextAttention(worker, e => e.busy === true)).toEqual({ id: worker, pendingQuestions: 0, busy: true })
    await runIn(worker, [{ channel: 'terminal:report-hook', args: [{ event: 'stop' }] }])
    await nextAttention(worker, e => e.busy === undefined && attentionOf(worker).slice(before).some(x => x.busy === true))
    expect(attentionOf(worker).slice(before)).toEqual([
      { id: worker, pendingQuestions: 0, busy: true },
      { id: worker, pendingQuestions: 0 },
    ])
    expect(attentionOf(tower)).toEqual([])
  }, 180_000)

  it('teardown', async () => {
    for (const id of [worker, tower]) expect(await bat.invoke('pty:kill', id)).toBe(true)
  })
})
