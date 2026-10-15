// @vitest-environment node
/**
 * PLAN-041 / T0536: `bat-terminal.mjs --close-worker` from a remote Tower, end to end on a real
 * headless server (T0388 harness: in-process server + wss + real node-pty) with the real helper
 * running INSIDE the headless PTYs (T0434 driver pattern: the test types `node driver.cjs job.json`
 * into a PTY, the driver spawns the helper with that shell's env and writes the result to a file).
 *
 *   Tower PTY ─ bat-terminal --close-worker ─▶ terminal:close-worker (tower capability, towerId = itself)
 *     handler (electron/close-worker.ts) → its own Worker only (BAT_TOWER_TERMINAL_ID + isWorkerOf)
 *     BAT client gets terminal:close-requested { id } (PROXIED_EVENTS) — its window closes the tab
 *
 * Negative: another tower's Worker → NOT_OWNER (exit 4); `--notify-id` naming another tower →
 * `Forbidden: tower-not-bound`; a Tower whose own PTY carries the work order → NOT_OWNER (never
 * itself); a worker capability → `Forbidden: role-not-allowed`; a revoked tower capability →
 * `Capability revoked`. Delay: the event comes when the timer fires; a BAT client typing into the
 * Worker during the delay cancels it.
 *
 * T0545 / D145: a Worker still printing is not refused (no BUSY): exit 0, and the event comes only
 * after the Worker has been quiet for CLOSE_WORKER_IDLE_MS; a BAT client typing into it while the
 * close waits for quiet cancels it.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { agentRegistry } from '../../agent-runtime/agent-registry'
import { logger } from '../../logger'
import { CLOSE_WORKER_IDLE_MS } from '../../close-worker'
import { HELPER_TOWER_CREATE_INTERVAL_MS, HelperCapabilityRegistry } from '../helper-capability'
import { startHeadlessHarness, type HeadlessClient, type HeadlessHarness } from './helpers/headless-harness'

const ECHO_AGENT = 't0536-echo-agent'
const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'
const WORKSPACE = 'client-ws-t0536'
const WO_A = 'T9536'
const WO_A2 = 'T9537'
const WO_B = 'T9538'
const WO_SELF = 'T9539'

let seq = 0
const termId = (label: string) => `t0536-${label}-${process.pid}-${seq++}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let tmpDir: string
let driverScript: string
let printerScript: string
let registry: HelperCapabilityRegistry
let harness: HeadlessHarness
let bat: HeadlessClient

const DRIVER_SOURCE = `
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const fill = arg => arg.replace(/\\{env:([A-Z0-9_]+)\\}/g, (_, name) => process.env[name] || '')
const env = job.envFile ? JSON.parse(fs.readFileSync(job.envFile, 'utf8')) : process.env
let result
if (job.kind === 'env') {
  result = { env: process.env }
} else {
  const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR || '', job.script), ...job.args.map(fill)], {
    env, encoding: 'utf8', windowsHide: true, timeout: 20000,
  })
  result = { code: run.status, stdout: run.stdout || '', stderr: run.stderr || '', error: run.error ? run.error.message : null }
}
fs.writeFileSync(job.out + '.tmp', JSON.stringify(result))
fs.renameSync(job.out + '.tmp', job.out)
`

/** T0545: an agent still printing its wrap-up — a line every 300 ms for argv[2] ms, then a marker. */
const PRINT_DONE = 'T0545-PRINTER-FINISHED'
const PRINTER_SOURCE = `
const end = Date.now() + Number(process.argv[2])
const timer = setInterval(() => {
  process.stdout.write('t0545 still printing ' + Date.now() + '\\n')
  if (Date.now() >= end) { clearInterval(timer); process.stdout.write('${PRINT_DONE}\\n') }
}, 300)
`

interface HelperRun { code: number | null; stdout: string; stderr: string; error: string | null }

async function waitForFile(file: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${file}`)
}

/** Types `node driver.cjs <job>` into PTY `id`, then waits for the job's result file. */
async function runInPty<T>(id: string, job: Record<string, unknown>): Promise<T> {
  const name = `job-${seq++}`
  const out = path.join(tmpDir, `${name}.out.json`)
  const jobFile = path.join(tmpDir, `${name}.json`)
  fs.writeFileSync(jobFile, JSON.stringify({ ...job, out }))
  expect(await bat.invoke('pty:write', id, `node "${driverScript}" "${jobFile}"\r`)).toMatchObject({ ok: true })
  return JSON.parse(await waitForFile(out)) as T
}

const ptyEnv = async (id: string) => (await runInPty<{ env: Record<string, string> }>(id, { kind: 'env' })).env
const helperIn = (id: string, args: string[], envFile?: string) =>
  runInPty<HelperRun>(id, { kind: 'helper', script: 'bat-terminal.mjs', args, ...(envFile ? { envFile } : {}) })
const closeWorker = (towerPty: string, workorder: string, extra: string[] = []) =>
  helperIn(towerPty, ['--close-worker', workorder, '--notify-id', '{env:BAT_TERMINAL_ID}', ...extra])

async function createPty(id: string, opts: { workspaceId?: string } = {}): Promise<void> {
  const result = await bat.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}), ...opts })
  expect(result).toMatchObject({ ok: true, created: true })
}

/** Tower PTY `towerPty` dispatches a Worker for `workorder` through the real bat-terminal (skill mode). */
async function dispatch(towerPty: string, workorder: string): Promise<string> {
  const run = await helperIn(towerPty, [
    '--agent', ECHO_AGENT, '--skill', 'ct-exec', '--workorder', workorder,
    '--notify-id', '{env:BAT_TERMINAL_ID}', '--workspace', '{env:BAT_WORKSPACE_ID}', '--cwd', CWD,
  ])
  expect(run.stderr).toBe('')
  expect(run.code).toBe(0)
  const id = /Terminal created: (\S+)/.exec(run.stdout)?.[1] ?? ''
  expect(id).not.toBe('')
  await bat.waitForEvent('terminal:created-externally', args => (args[0] as { id?: string })?.id === id, 10_000)
  await vi.waitFor(() => expect(outputOf(id)).toContain(`/ct-exec ${workorder}`), { timeout: 20_000, interval: 100 })
  return id
}

const outputEvents = (id: string) => bat.events.filter(e => e.channel === 'pty:output' && e.args[0] === id)
const outputOf = (id: string) => outputEvents(id).map(e => String(e.args[1] ?? '')).join('')
const closeRequests = (id: string) => bat.events.filter(e => e.channel === 'terminal:close-requested' && (e.args[0] as { id?: string })?.id === id)

/**
 * Waits until PTY `id` printed nothing for longer than the quiet window (the server stamps output
 * when the PTY emits it, a little before the client sees the batched event — hence the margin).
 */
async function waitIdle(id: string): Promise<void> {
  let count = -1
  let since = Date.now()
  for (;;) {
    const now = outputEvents(id).length
    if (now !== count) { count = now; since = Date.now() }
    if (Date.now() - since > CLOSE_WORKER_IDLE_MS + 1000) return
    await sleep(200)
  }
}

/** T0545: a BAT client starts the printer in Worker `id` (typed before the close request). */
async function startPrinting(id: string, ms: number): Promise<void> {
  const before = outputOf(id).length
  expect(await bat.invoke('pty:write', id, `node "${printerScript}" ${ms}\r`)).toMatchObject({ ok: true })
  await vi.waitFor(() => expect(outputOf(id).slice(before)).toContain('t0545 still printing'), { timeout: 20_000, interval: 50 })
}

/** Resolves with the time the client first sees the printer's marker in Worker `id`. */
async function printerDoneAt(id: string, from: number): Promise<number> {
  await vi.waitFor(() => expect(outputOf(id).slice(from)).toContain(PRINT_DONE), { timeout: 30_000, interval: 50 })
  return Date.now()
}

const logged = (spy: { mock: { calls: unknown[][] } }, text: string) => spy.mock.calls.some(call => String(call[0]).includes(text))

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0536-e2e-'))
  driverScript = path.join(tmpDir, 'driver.cjs')
  fs.writeFileSync(driverScript, DRIVER_SOURCE)
  printerScript = path.join(tmpDir, 'printer.cjs')
  fs.writeFileSync(printerScript, PRINTER_SOURCE)
  agentRegistry.registerCustomCli({ id: ECHO_AGENT, name: 'T0536 echo', icon: 'x', color: '#000', command: 'echo' })
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry })
  bat = harness
})

afterAll(async () => {
  await harness?.dispose()
  agentRegistry.removeCustomCli(ECHO_AGENT)
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('remote Tower --close-worker through the real helper (PLAN-041 / T0536)', () => {
  let towerA: string
  let towerB: string
  let towerBEnv: Record<string, string>
  let workerA: string
  let workerA2: string
  let workerB: string

  it('setup: two Towers, each dispatches its own Workers (work order recorded on the headless PTY)', async () => {
    towerA = termId('tower-a')
    towerB = termId('tower-b')
    await createPty(towerA, { workspaceId: WORKSPACE })
    await createPty(towerB, { workspaceId: WORKSPACE })
    towerBEnv = await ptyEnv(towerB)
    expect(registry.verify(towerBEnv.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: towerB, role: 'tower' })

    workerA = await dispatch(towerA, WO_A)
    await sleep(HELPER_TOWER_CREATE_INTERVAL_MS + 100) // T0450: one creation per tower per second
    workerA2 = await dispatch(towerA, WO_A2)
    workerB = await dispatch(towerB, WO_B)
    expect(registry.isWorkerOf(workerA, towerA)).toBe(true)
    expect(registry.isWorkerOf(workerA2, towerA)).toBe(true)
    expect(registry.isWorkerOf(workerB, towerB)).toBe(true)
    expect(registry.isWorkerOf(workerB, towerA)).toBe(false)
  }, 120_000)

  it("another tower's Worker → NOT_OWNER (exit 4), nothing closed", async () => {
    const run = await closeWorker(towerA, WO_B)
    expect(run.code).toBe(4)
    expect(run.stderr).toContain('close-worker: NOT_OWNER')
    await sleep(300)
    expect(closeRequests(workerB)).toHaveLength(0)
  }, 60_000)

  it('--notify-id naming another tower → Forbidden: tower-not-bound (exit 1)', async () => {
    const run = await helperIn(towerA, ['--close-worker', WO_B, '--notify-id', towerB])
    expect(run.code).toBe(1)
    expect(run.stderr).toContain('Forbidden: tower-not-bound')
    expect(run.stderr).toContain('close-worker: ERROR')
    await sleep(300)
    expect(closeRequests(workerB)).toHaveLength(0)
  }, 60_000)

  it('the target is never the Tower itself: its own PTY carrying the work order → NOT_OWNER (exit 4)', async () => {
    // a BAT window opens a tab in skill mode without a tower: the PTY records the work order and
    // its capability is a tower's
    const selfId = termId('tower-self')
    expect(await bat.invoke('terminal:create-agent-command', {
      id: selfId, cwd: CWD, agent: ECHO_AGENT, skill: 'ct-exec', workorder: WO_SELF, workspaceId: WORKSPACE,
      ...(SHELL ? { shell: SHELL } : {}),
    })).toBe(true)
    await vi.waitFor(() => expect(outputOf(selfId)).toContain(`/ct-exec ${WO_SELF}`), { timeout: 20_000, interval: 100 })
    const selfEnv = await ptyEnv(selfId)
    expect(registry.verify(selfEnv.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: selfId, role: 'tower' })

    const run = await closeWorker(selfId, WO_SELF)
    expect(run.code).toBe(4)
    expect(run.stderr).toContain('close-worker: NOT_OWNER')
    await sleep(300)
    expect(closeRequests(selfId)).toHaveLength(0)
    expect(await bat.invoke('pty:kill', selfId)).toBe(true)
  }, 60_000)

  it('a worker capability cannot close anything → Forbidden: role-not-allowed (exit 1)', async () => {
    const run = await helperIn(workerB, ['--close-worker', WO_B, '--notify-id', '{env:BAT_TOWER_TERMINAL_ID}'])
    expect(run.code).toBe(1)
    expect(run.stderr).toContain('Forbidden: role-not-allowed')
    await sleep(300)
    expect(closeRequests(workerB)).toHaveLength(0)
  }, 60_000)

  it('T0545: own Worker still printing, delay 0 → exit 0 (no BUSY); terminal:close-requested only after 5 s of quiet', async () => {
    const logSpy = vi.spyOn(logger, 'log')
    await waitIdle(workerA)
    const from = outputOf(workerA).length
    await startPrinting(workerA, 6_000)
    const done = printerDoneAt(workerA, from)
    const run = await closeWorker(towerA, WO_A)
    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)
    expect(run.stdout).toContain(`✓ Worker close scheduled: ${workerA} (in 0 ms)`)
    expect(logged(logSpy, `id=${workerA} → scheduled delayMs=0 (output `)).toBe(true)
    expect(logged(logSpy, 'ms ago; will wait for quiet)')).toBe(true)
    expect(logged(logSpy, `id=${workerA} → still printing (output `)).toBe(true)
    const doneAt = await done
    expect(closeRequests(workerA)).toHaveLength(0) // not while it was printing
    const [request] = await bat.waitForEvent('terminal:close-requested', args => (args[0] as { id?: string })?.id === workerA, 20_000)
    expect(request).toEqual({ id: workerA })
    // quiet for CLOSE_WORKER_IDLE_MS after the last line (the client sees output a little late)
    expect(Date.now() - doneAt).toBeGreaterThanOrEqual(CLOSE_WORKER_IDLE_MS - 1000)
    expect(logged(logSpy, `id=${workerA} → close requested after waiting `)).toBe(true)
    expect(closeRequests(workerA)).toHaveLength(1)
    // the client window closes the tab like ✕ (closeTerminalNow → pty:kill); the capability dies with it
    expect(await bat.invoke('pty:kill', workerA)).toBe(true)
    expect(registry.isWorkerOf(workerA, towerA)).toBe(false)
  }, 60_000)

  it('delay: a BAT client typing into the Worker cancels (during the delay, and while waiting for quiet); untouched, the event comes when the timer fires', async () => {
    const logSpy = vi.spyOn(logger, 'log')
    await waitIdle(workerA2)
    const cancelled = await closeWorker(towerA, WO_A2, ['--delay-ms', '1500'])
    expect(cancelled.code).toBe(0)
    // the user types into the Worker tab (a client connection, not a helper)
    expect(await bat.invoke('pty:write', workerA2, 'x')).toMatchObject({ ok: true })
    await vi.waitFor(
      () => expect(logged(logSpy, `id=${workerA2} → cancelled (user input during the delay)`)).toBe(true),
      { timeout: 5_000, interval: 100 },
    )
    expect(closeRequests(workerA2)).toHaveLength(0)

    expect(await bat.invoke('pty:write', workerA2, '\b')).toMatchObject({ ok: true })
    await waitIdle(workerA2)

    // T0545: still printing when the delay is up → the close waits for quiet; the user types meanwhile
    const from = outputOf(workerA2).length
    await startPrinting(workerA2, 8_000)
    const waiting = await closeWorker(towerA, WO_A2)
    expect(waiting.code).toBe(0)
    await vi.waitFor(() => expect(logged(logSpy, `id=${workerA2} → still printing (output `)).toBe(true), { timeout: 5_000, interval: 50 })
    expect(await bat.invoke('pty:write', workerA2, 'y')).toMatchObject({ ok: true })
    await vi.waitFor(
      () => expect(logged(logSpy, `id=${workerA2} → cancelled (user input while waiting for quiet)`)).toBe(true),
      { timeout: 20_000, interval: 100 },
    )
    await printerDoneAt(workerA2, from)
    expect(closeRequests(workerA2)).toHaveLength(0)
    expect(await bat.invoke('pty:write', workerA2, '\b')).toMatchObject({ ok: true })
    await waitIdle(workerA2)
    expect(closeRequests(workerA2)).toHaveLength(0)

    const scheduledAt = Date.now()
    const run = await closeWorker(towerA, WO_A2, ['--delay-ms', '1500'])
    expect(run.code).toBe(0)
    expect(run.stdout).toContain(`✓ Worker close scheduled: ${workerA2} (in 1500 ms)`)
    await bat.waitForEvent('terminal:close-requested', args => (args[0] as { id?: string })?.id === workerA2, 10_000)
    expect(Date.now() - scheduledAt).toBeGreaterThanOrEqual(1500)
    expect(closeRequests(workerA2)).toHaveLength(1)
    expect(await bat.invoke('pty:kill', workerA2)).toBe(true)
  }, 90_000)

  it('a revoked tower capability is refused (Capability revoked); its Worker stays', async () => {
    expect(await bat.invoke('pty:kill', towerB)).toBe(true)
    expect(registry.verify(towerBEnv.BAT_REMOTE_TOKEN)).toBeNull()
    // the real helper with the dead Tower's env, run from Tower A's shell
    const envFile = path.join(tmpDir, 'dead-tower-env.json')
    fs.writeFileSync(envFile, JSON.stringify(towerBEnv))
    const run = await helperIn(towerA, ['--close-worker', WO_B, '--notify-id', towerB], envFile)
    expect(run.code).toBe(1)
    expect(run.stderr).toContain('Capability revoked')
    expect(run.stderr).toContain('close-worker: AUTH_FAILED')
    await sleep(300)
    expect(closeRequests(workerB)).toHaveLength(0)

    expect(await bat.invoke('pty:kill', workerB)).toBe(true)
    expect(await bat.invoke('pty:kill', towerA)).toBe(true)
    expect(registry.size).toBe(0)
  }, 60_000)
})
