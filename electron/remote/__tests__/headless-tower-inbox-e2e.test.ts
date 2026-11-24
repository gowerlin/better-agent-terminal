// @vitest-environment node
/**
 * PLAN-068 W8 / T0913 ⑤: the remote path of PLAN-068 on a real headless server (T0388 harness: in-process
 * server + wss + real node-pty) — what a remote profile window drives. The Tower and the Worker are real
 * PTYs; their helper calls run INSIDE them with their own capabilities (the node driver of
 * headless-tower-cards-e2e); the harness client is the BAT window.
 *
 *   Tower `--set-role tower --bat-contract 2` → the window gets `terminal:hooks-status` (none, then ok
 *     after a hook report), `role-changed` with the contract
 *   window `tower-inbox:answer` → written to the Tower PTY, the Enter goes to the window as a
 *     `terminal:keypress` (userInput); with the user's draft (window input) it waits: listed by
 *     `terminal:notify-hold-list` (reason `draft`, kind `answer`), sent by `terminal:notify-hold-send-now`
 *   a Worker `pty:write` + `terminal:keypress` (`bat-notify --submit`) into the Tower with a draft → held
 *     (`notify-hold-changed`), cancelled from the window (`terminal:notify-hold-cancel`)
 *   `tower-cards:*` from the window: the Tower's stop message → list / mark-read / pin / clear
 *   the Tower's and the Worker's own PTY capabilities: `tower-inbox:answer`, `terminal:notify-hold-*`,
 *     `tower-cards:*` refused (not helper channels); events carry no text
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
const CARD_TEXT = 'T0913-REMOTE-TURN ⏸ 待你決定：U-1'
const ANSWER_ONE = 'U-1：A'
const ANSWER_TWO = 'A-1：完成'
const WORKER_TEXT = 'T0913 remote notify'

let seq = 0
const termId = (label: string) => `t0913-${label}-${process.pid}-${seq++}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let tmpDir: string
let driverScript: string
let registry: HelperCapabilityRegistry
let harness: HeadlessHarness

// the driver of headless-tower-cards-e2e.test.ts (invoke frames with the PTY's own capability)
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
  const auth = await send({ type: 'auth', id: 'auth', token: env.BAT_REMOTE_TOKEN, args: ['t0913-driver'] })
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
  calls: Array<{ channel: string; result?: unknown; error?: string }>
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

/** Everything PTY `id` printed so far (the `pty:output` events the window got). */
const outputOf = (id: string): string => harness.events
  .filter(e => e.channel === 'pty:output' && e.args[0] === id)
  .map(e => String(e.args[1]))
  .join('')

type HoldEntry = { terminalId: string; items: Array<{ holdId: string; kind?: string }>; reason?: string }
const holdList = async (): Promise<HoldEntry[]> => await harness.invoke('terminal:notify-hold-list') as HoldEntry[]
const holdEntryOf = async (id: string): Promise<HoldEntry | undefined> => (await holdList()).find(entry => entry.terminalId === id)
const holdsOf = async (id: string): Promise<HoldEntry['items']> => (await holdEntryOf(id))?.items ?? []

/** Clears the shell's input line of PTY `id` (Ctrl+C from the window) and lets it settle. */
async function clearLine(id: string): Promise<void> {
  expect(await harness.invoke('pty:write', id, '\x03')).toMatchObject({ ok: true })
  await sleep(1_500)
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0913-e2e-'))
  driverScript = path.join(tmpDir, 'driver.cjs')
  fs.writeFileSync(driverScript, DRIVER_SOURCE(require.resolve('ws').split(path.sep).join('/')))
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry })
})

afterAll(async () => {
  await harness?.dispose()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('PLAN-068 remote path on a headless server (T0913 ⑤)', () => {
  let tower: string
  let worker: string

  it('setup: a Tower and its Worker', async () => {
    tower = termId('tower')
    worker = termId('worker')
    await createPty(tower)
    await createPty(worker, { BAT_TOWER_TERMINAL_ID: tower, CT_MODE: 'yolo' })
    await sleep(1_500) // shells print their prompts
  }, 120_000)

  it('the Tower declares contract 2 → the window gets terminal:hooks-status (none), then ok after a hook report', async () => {
    const run = await runIn(tower, [
      { channel: 'terminal:set-role', args: [{ role: 'tower', terminalId: '{env:BAT_TERMINAL_ID}', batContract: 2 }] },
    ])
    expect(run.calls[0].result).toMatchObject({ ok: true, towerContract: 2, batContract: 2, hooksStatus: { state: 'none', reason: 'not-launched-by-bat' } })
    const [none] = await harness.waitForEvent('terminal:hooks-status', args => (args[0] as { id: string }).id === tower, 30_000)
    expect(none).toEqual({ id: tower, hooksStatus: { state: 'none', reason: 'not-launched-by-bat' } })
    await harness.waitForEvent('terminal:role-changed', args => (args[0] as { id: string; towerContract?: number }).id === tower && (args[0] as { towerContract?: number }).towerContract === 2, 30_000)

    await runIn(tower, [{ channel: 'terminal:report-hook', args: [{ event: 'stop', lastAssistantMessage: CARD_TEXT, origin: 'injected', set: 2 }] }])
    const [ok] = await harness.waitForEvent('terminal:hooks-status', args => {
      const e = args[0] as { id: string; hooksStatus: { state: string } | null }
      return e.id === tower && e.hooksStatus?.state === 'ok'
    }, 30_000)
    expect(ok).toEqual({ id: tower, hooksStatus: { state: 'ok', origin: 'injected', set: 2 } })
  }, 180_000)

  it('tower-cards:* from the window: list, mark-read, pin, clear; the events carry counts only', async () => {
    await harness.waitForEvent('tower-cards:changed', args => (args[0] as TowerCardsChangedEvent).terminalId === tower, 30_000)
    const listed = await harness.invoke('tower-cards:list', { terminalIds: [tower] }) as TowerCardsListResult
    expect(listed).toMatchObject({ ok: true, entries: [{ terminalId: tower, unread: 1, cards: [{ source: 'hook', text: CARD_TEXT, read: false, pinned: false }] }] })
    if (!listed.ok) return
    const cardId = listed.entries[0].cards[0].id
    expect(await harness.invoke('tower-cards:mark-read', { terminalId: tower, cardIds: [cardId] })).toEqual({ ok: true, changed: 1 })
    expect(await harness.invoke('tower-cards:pin', { terminalId: tower, cardId, pinned: true })).toEqual({ ok: true, changed: 1 })
    // `clear` without includePinned keeps the pinned card
    expect(await harness.invoke('tower-cards:clear', { terminalId: tower })).toEqual({ ok: true, changed: 0 })
    const after = await harness.invoke('tower-cards:list', { terminalIds: [tower] }) as TowerCardsListResult
    expect(after).toMatchObject({ ok: true, entries: [{ terminalId: tower, unread: 0, cards: [{ id: cardId, read: true, pinned: true }] }] })
    expect(JSON.stringify(harness.events.filter(e => e.channel === 'tower-cards:changed'))).not.toContain('T0913-REMOTE-TURN')
  }, 60_000)

  it('tower-inbox:answer from the window → written to the Tower PTY; the Enter goes to the window (userInput)', async () => {
    const result = await harness.invoke('tower-inbox:answer', { terminalId: tower, text: ANSWER_ONE })
    expect(result).toMatchObject({ ok: true, held: false })
    const [keypress] = await harness.waitForEvent('terminal:keypress', args => {
      const k = args[0] as { targetId: string; source?: string }
      return k.targetId === tower && k.source === 'answer'
    }, 30_000)
    expect(keypress).toMatchObject({ targetId: tower, key: 'Enter', source: 'answer', userInput: true })
    await expect.poll(() => outputOf(tower).includes('U-1'), { timeout: 15_000 }).toBe(true)
    // not an answer: refused before the queue
    expect(await harness.invoke('tower-inbox:answer', { terminalId: tower, text: 'hello' })).toEqual({ ok: false, reason: 'invalid' })
    expect(await harness.invoke('tower-inbox:answer', { terminalId: worker, text: ANSWER_ONE })).toEqual({ ok: false, reason: 'not-contract-tower' })
  }, 60_000)

  it('with the user\'s draft (window input) an answer and a Worker notification wait; notify-hold-list / -cancel / -send-now from the window', async () => {
    // the window's Ctrl+C then a draft (user input of this client)
    await clearLine(tower)
    expect(await harness.invoke('pty:write', tower, 'draft-remote')).toMatchObject({ ok: true })
    await sleep(300)
    const answered = await harness.invoke('tower-inbox:answer', { terminalId: tower, text: ANSWER_TWO })
    expect(answered).toMatchObject({ ok: true, held: true })
    // the Worker's `bat-notify --submit` (pty:write + terminal:keypress with its capability)
    const run = await runIn(worker, [
      { channel: 'pty:write', args: ['{env:BAT_TOWER_TERMINAL_ID}', WORKER_TEXT] },
      { channel: 'terminal:keypress', args: [{ targetId: '{env:BAT_TOWER_TERMINAL_ID}', key: 'Enter', source: 'T0913' }] },
    ])
    expect(run.calls[0].result).toMatchObject({ ok: true, held: true })
    const entry = await holdEntryOf(tower)
    expect(entry?.reason).toBe('draft')
    const items = entry?.items ?? []
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ kind: 'answer' })
    await harness.waitForEvent('terminal:notify-hold-changed', args => JSON.stringify(args).includes(tower) && JSON.stringify(args).includes('draft'), 30_000)
    for (const e of harness.events.filter(ev => ev.channel === 'terminal:notify-hold-changed')) {
      const text = JSON.stringify(e.args)
      for (const secret of [ANSWER_TWO, WORKER_TEXT, 'draft-remote']) expect(text).not.toContain(secret)
    }
    // cancel the notification from the window; send the answer now (skips `draft`)
    const notifyItem = items.find(item => item.kind !== 'answer')!
    expect(await harness.invoke('terminal:notify-hold-cancel', tower, notifyItem.holdId)).toBe(1)
    expect(await holdsOf(tower)).toHaveLength(1)
    expect(await harness.invoke('terminal:notify-hold-send-now', tower)).toBe(1)
    await expect.poll(async () => (await holdsOf(tower)).length, { timeout: 15_000 }).toBe(0)
    await expect.poll(() => outputOf(tower).includes('A-1'), { timeout: 15_000 }).toBe(true)
    expect(outputOf(tower)).not.toContain(WORKER_TEXT)
    await clearLine(tower)
  }, 120_000)

  it('the PTY capabilities of the Tower and the Worker are refused on every window channel', async () => {
    for (const id of [tower, worker]) {
      const run = await runIn(id, [
        { channel: 'tower-inbox:answer', args: [{ terminalId: tower, text: ANSWER_ONE }] },
        { channel: 'terminal:notify-hold-list', args: [] },
        { channel: 'terminal:notify-hold-cancel', args: [tower] },
        { channel: 'terminal:notify-hold-send-now', args: [tower] },
        { channel: 'tower-cards:list', args: [{}] },
        { channel: 'tower-cards:mark-read', args: [{ terminalId: tower }] },
        { channel: 'tower-cards:pin', args: [{ terminalId: tower, cardId: 'x', pinned: false }] },
        { channel: 'tower-cards:clear', args: [{ terminalId: tower, includePinned: true }] },
        { channel: 'tower-cards:set-panel-tower', args: [{ terminalId: tower, isTower: true }] },
      ])
      for (const call of run.calls) {
        expect(call.result, `${id} ${call.channel}`).toBeUndefined()
        expect(String(call.error), `${id} ${call.channel}`).toMatch(/not allowed|forbidden|channel/i)
      }
    }
    // the card is still there (nothing changed by the refused calls)
    const after = await harness.invoke('tower-cards:list', { terminalIds: [tower] }) as TowerCardsListResult
    expect(after).toMatchObject({ ok: true, entries: [{ terminalId: tower, cards: [{ pinned: true }] }] })
  }, 120_000)

  it('teardown: the PTYs end', async () => {
    for (const id of [tower, worker]) expect(await harness.invoke('pty:kill', id)).toBe(true)
  }, 60_000)
})
