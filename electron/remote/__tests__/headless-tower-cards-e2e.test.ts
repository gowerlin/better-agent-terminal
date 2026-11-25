// @vitest-environment node
/**
 * PLAN-068 W3 / T0905 (T0902 §5, D328 R1′): the Tower turn cards on a real headless server (T0388
 * harness: in-process server + wss + real node-pty) — what a remote window reads. The hook reports run
 * INSIDE the tabs' headless PTYs with their own capabilities (the node driver of
 * headless-attention-e2e); the harness client is the BAT window.
 *
 *   Tower `--set-role tower --bat-contract 2`, hook stop + message → client: one card (`tower-cards:list`)
 *   a Worker's stop + message → dropped (no card); a Tower without the contract → dropped
 *   `tower-cards:changed` carries counts only; mark-read from the window → changed
 *   the Tower's own PTY capability cannot call `tower-cards:*` (not a helper channel)
 *   the Tower's PTY ends → its cards go
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HelperCapabilityRegistry } from '../helper-capability'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'
import type { TowerCardsChangedEvent, TowerCardsListResult } from '../../../src/types/tower-cards'

const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'
const TOWER_TEXT = 'T0905-TOWER-TURN summary of the turn'
const WORKER_TEXT = 'T0905-WORKER-TURN must not be kept'
const OLD_TOWER_TEXT = 'T0905-OLD-TOWER-TURN must not be kept'

let seq = 0
const termId = (label: string) => `t0905-${label}-${process.pid}-${seq++}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let tmpDir: string
let driverScript: string
let registry: HelperCapabilityRegistry
let harness: HeadlessHarness

// the driver of headless-attention-e2e.test.ts
const DRIVER_SOURCE = (wsModule: string) => `
const fs = require('fs')
const WebSocket = require(${JSON.stringify(wsModule)})
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const env = process.env
const fill = v => typeof v === 'string' ? v.replace(/\\{env:([A-Z0-9_]+)\\}/g, (_, n) => env[n] || '') : v
const out = { terminalId: env.BAT_TERMINAL_ID, calls: [] }
const finish = () => { fs.writeFileSync(job.out + '.tmp', JSON.stringify(out)); fs.renameSync(job.out + '.tmp', job.out); process.exit(0) }
const ws = new WebSocket('wss://127.0.0.1:' + env.BAT_REMOTE_PORT, { rejectUnauthorized: false })
const waiting = new Map()
const send = frame => new Promise(done => { waiting.set(frame.id, done); ws.send(JSON.stringify(frame)) })
setTimeout(() => { out.error = 'timeout'; finish() }, 60000)
ws.on('error', e => { out.error = String(e && e.message); finish() })
ws.on('message', raw => { let f; try { f = JSON.parse(String(raw)) } catch { return } const d = waiting.get(f.id); if (d) { waiting.delete(f.id); d(f) } })
ws.on('open', async () => {
  const auth = await send({ type: 'auth', id: 'auth', token: env.BAT_REMOTE_TOKEN, args: ['t0905-driver'] })
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

async function runIn(id: string, calls: Array<{ channel: string; args: unknown[] }>): Promise<DriverRun> {
  const name = `job-${seq++}`
  const out = path.join(tmpDir, `${name}.out.json`)
  const jobFile = path.join(tmpDir, `${name}.json`)
  fs.writeFileSync(jobFile, JSON.stringify({ calls, out }))
  expect(await harness.invoke('pty:write', id, `node "${driverScript}" "${jobFile}"\r`)).toMatchObject({ ok: true })
  const run = JSON.parse(await waitForFile(out)) as DriverRun
  expect(run.error).toBeUndefined()
  return run
}

async function createPty(id: string, customEnv?: Record<string, string>): Promise<void> {
  const result = await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}), ...(customEnv ? { customEnv } : {}) })
  expect(result).toMatchObject({ ok: true, created: true })
}

const list = async (ids: string[]) => await harness.invoke('tower-cards:list', { terminalIds: ids }) as TowerCardsListResult
const changedOf = (id: string): TowerCardsChangedEvent[] => harness.events
  .filter(e => e.channel === 'tower-cards:changed' && (e.args[0] as TowerCardsChangedEvent).terminalId === id)
  .map(e => e.args[0] as TowerCardsChangedEvent)

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0905-e2e-'))
  driverScript = path.join(tmpDir, 'driver.cjs')
  fs.writeFileSync(driverScript, DRIVER_SOURCE(require.resolve('ws').split(path.sep).join('/')))
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry })
})

afterAll(async () => {
  await harness?.dispose()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('Tower turn cards on a headless server (T0905)', () => {
  let tower: string
  let oldTower: string
  let worker: string

  it('setup: a contract-2 Tower, a Tower without the contract, a Worker', async () => {
    tower = termId('tower')
    oldTower = termId('old')
    worker = termId('worker')
    await createPty(tower)
    await createPty(oldTower)
    await createPty(worker, { BAT_TOWER_TERMINAL_ID: tower, CT_MODE: 'yolo' })
    await sleep(1_500) // shells print their prompts
  }, 120_000)

  it('the Tower declares contract 2 and its Stop hook sends a message → one card for the window; the event has counts only', async () => {
    const run = await runIn(tower, [
      { channel: 'terminal:set-role', args: [{ role: 'tower', terminalId: '{env:BAT_TERMINAL_ID}', batContract: 2 }] },
      { channel: 'terminal:report-hook', args: [{ event: 'stop', lastAssistantMessage: TOWER_TEXT, origin: 'injected', set: 2 }] },
      // the Tower's own capability: no access to the cards (not a helper channel)
      { channel: 'tower-cards:list', args: [{}] },
      { channel: 'tower-cards:clear', args: [{ terminalId: '{env:BAT_TERMINAL_ID}', includePinned: true }] },
    ])
    expect(run.calls[0].result).toMatchObject({ ok: true, towerContract: 2 })
    expect(run.calls[1].result).toMatchObject({ ok: true, result: 'unchanged' })
    for (const call of run.calls.slice(2)) {
      expect(call.result).toBeUndefined()
      expect(String(call.error)).toMatch(/not allowed|forbidden|channel/i)
    }
    const [event] = await harness.waitForEvent('tower-cards:changed', args => (args[0] as TowerCardsChangedEvent).terminalId === tower, 30_000)
    expect(event).toEqual({ terminalId: tower, revision: expect.any(Number), unread: 1, total: 1 })
    const answer = await list([tower])
    expect(answer).toMatchObject({ ok: true, entries: [{ terminalId: tower, alive: true, unread: 1, cards: [{ source: 'hook', text: TOWER_TEXT, read: false, pinned: false }] }] })
  }, 180_000)

  it('a Worker and a Tower without the contract send messages → no card; the window marks the Tower card read', async () => {
    await runIn(worker, [{ channel: 'terminal:report-hook', args: [{ event: 'stop', lastAssistantMessage: WORKER_TEXT }] }])
    await runIn(oldTower, [
      { channel: 'terminal:set-role', args: [{ role: 'tower', terminalId: '{env:BAT_TERMINAL_ID}' }] },
      { channel: 'terminal:report-hook', args: [{ event: 'stop', lastAssistantMessage: OLD_TOWER_TEXT }] },
    ])
    const answer = await list([tower, worker, oldTower])
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    expect(answer.entries.map(e => [e.terminalId, e.cards.length])).toEqual([[tower, 1], [worker, 0], [oldTower, 0]])
    expect(changedOf(worker)).toEqual([])
    expect(changedOf(oldTower)).toEqual([])
    const cardId = answer.entries[0].cards[0].id
    expect(await harness.invoke('tower-cards:mark-read', { terminalId: tower, cardIds: [cardId] })).toEqual({ ok: true, changed: 1 })
    await harness.waitForEvent('tower-cards:changed', args => {
      const e = args[0] as TowerCardsChangedEvent
      return e.terminalId === tower && e.unread === 0 && e.total === 1
    }, 30_000)
    const all = JSON.stringify(harness.events.filter(e => e.channel === 'tower-cards:changed'))
    for (const text of [TOWER_TEXT, WORKER_TEXT, OLD_TOWER_TEXT]) expect(all).not.toContain(text)
  }, 180_000)

  it('the Tower PTY ends → its cards go (the window is told)', async () => {
    expect(await harness.invoke('pty:kill', tower)).toBe(true)
    await harness.waitForEvent('tower-cards:changed', args => {
      const e = args[0] as TowerCardsChangedEvent
      return e.terminalId === tower && e.total === 0
    }, 30_000)
    expect(await list([tower])).toMatchObject({ ok: true, entries: [{ terminalId: tower, alive: false, cards: [] }] })
    for (const id of [worker, oldTower]) expect(await harness.invoke('pty:kill', id)).toBe(true)
  }, 60_000)
})
