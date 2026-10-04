// @vitest-environment node
/**
 * T0434 (PLAN-036 P3 / K 工單 4): remote Tower end to end on a real headless server
 * (T0388 harness: in-process server + wss + real node-pty) with the real node helpers.
 *
 * Unlike T0433 (helpers spawned by the test with a dumped env), every helper here runs
 * INSIDE a headless PTY: the test types `node driver.cjs job.json` into the PTY, the driver
 * (a child of the PTY shell, so it holds exactly that shell's env) spawns the helper with
 * `process.execPath` + array args and writes the result to a file. `{env:NAME}` in a job's
 * args stands for the PTY's own `$NAME` — what a Tower types as `"$BAT_TERMINAL_ID"`.
 *
 *   Tower PTY ─ bat-terminal.mjs ─▶ terminal:create-agent-command ─▶ worker PTY
 *     BAT client sees terminal:created-externally (Tower's workspace)
 *   worker PTY ─ bat-notify.mjs --submit ─▶ terminal:notify / pty:write / terminal:keypress
 *     BAT client sees terminal:notified + terminal:keypress; the Tower PTY gets the text
 *
 * Negative (capability scope, through the real helpers): a worker cannot dispatch, a Tower
 * cannot notify / write a worker, a worker cannot write a PTY other than its Tower, a Tower
 * cannot run a raw command. T0447: after the worker PTY dies its capability is dead — the
 * real helper is refused (`Capability revoked`, T0449), and frames pipelined behind the
 * revocation on an already authenticated socket run no handler. With no BAT client left, `--submit` exits 1
 * (`no-client`) instead of pretending the Tower was submitted.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { TLSSocket } from 'tls'
import WebSocket from 'ws'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { agentRegistry } from '../../agent-runtime/agent-registry'
import { invokeHandler } from '../handler-registry'
import { HelperCapabilityRegistry } from '../helper-capability'
import { startHeadlessHarness, type HeadlessClient, type HeadlessHarness } from './helpers/headless-harness'

vi.mock('../handler-registry', async importOriginal => {
  const actual = await importOriginal<typeof import('../handler-registry')>()
  return { ...actual, invokeHandler: vi.fn(actual.invokeHandler) }
})

const invokeSpy = vi.mocked(invokeHandler)

const ECHO_AGENT = 't0434-echo-agent'
const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'
const WORKSPACE = 'client-ws-t0434'
const WORKORDER = 'T9434'
const NOTIFY_MESSAGE = `${WORKORDER} 完成`

let seq = 0
const termId = (label: string) => `t0434-${label}-${process.pid}-${seq++}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let tmpDir: string
let driverScript: string
let registry: HelperCapabilityRegistry
let harness: HeadlessHarness
/** The BAT window: every invoke / event assertion goes through it (the harness primary closes in the last test). */
let bat: HeadlessClient

const DRIVER_SOURCE = `
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const fill = arg => arg.replace(/\\{env:([A-Z0-9_]+)\\}/g, (_, name) => process.env[name] || '')
setTimeout(() => {
  let result
  if (job.kind === 'env') {
    result = { env: process.env }
  } else {
    const run = spawnSync(process.execPath, [path.join(process.env.BAT_HELPER_DIR || '', job.script), ...job.args.map(fill)], {
      env: process.env, encoding: 'utf8', windowsHide: true, timeout: 20000,
    })
    result = { code: run.status, stdout: run.stdout || '', stderr: run.stderr || '', error: run.error ? run.error.message : null }
  }
  fs.writeFileSync(job.out + '.tmp', JSON.stringify(result))
  fs.renameSync(job.out + '.tmp', job.out)
}, job.delayMs || 0)
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

/** Types `node driver.cjs <job>` into PTY `id` (through `writer`), then waits for the job's result file. */
async function runInPty<T>(id: string, job: Record<string, unknown>, writer: HeadlessClient = bat, beforeWait?: () => Promise<void>): Promise<T> {
  const name = `job-${seq++}`
  const out = path.join(tmpDir, `${name}.out.json`)
  const jobFile = path.join(tmpDir, `${name}.json`)
  fs.writeFileSync(jobFile, JSON.stringify({ ...job, out }))
  expect(await writer.invoke('pty:write', id, `node "${driverScript}" "${jobFile}"\r`)).toMatchObject({ ok: true })
  await beforeWait?.()
  return JSON.parse(await waitForFile(out)) as T
}

const ptyEnv = async (id: string) => (await runInPty<{ env: Record<string, string> }>(id, { kind: 'env' })).env
const helperIn = (id: string, script: string, args: string[]) => runInPty<HelperRun>(id, { kind: 'helper', script, args })

async function createPty(id: string, opts: { customEnv?: Record<string, string>; workspaceId?: string } = {}): Promise<void> {
  const result = await bat.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}), ...opts })
  expect(result).toMatchObject({ ok: true, created: true })
}

/** Everything PTY `id` printed so far, as the BAT client saw it. */
const outputOf = (id: string) =>
  bat.events.filter(e => e.channel === 'pty:output' && e.args[0] === id).map(e => String(e.args[1] ?? '')).join('')

const createdCount = () => bat.events.filter(e => e.channel === 'terminal:created-externally').length
const serverTokenIn = (env: Record<string, string>) => Object.values(env).some(v => v.includes(harness.token))

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0434-e2e-'))
  driverScript = path.join(tmpDir, 'driver.cjs')
  fs.writeFileSync(driverScript, DRIVER_SOURCE)
  agentRegistry.registerCustomCli({ id: ECHO_AGENT, name: 'T0434 echo', icon: 'x', color: '#000', command: 'echo' })
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry })
  bat = harness
})

afterAll(async () => {
  await harness?.dispose()
  agentRegistry.removeCustomCli(ECHO_AGENT)
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('remote Tower end to end through the real helpers (T0434)', () => {
  let towerId: string
  let towerEnv: Record<string, string>
  let workerId: string
  let workerEnv: Record<string, string>
  let bystanderId: string

  it('Tower PTY: BAT_* keys of a remote tab, its own tower capability, no server token', async () => {
    towerId = termId('tower')
    await createPty(towerId, { workspaceId: WORKSPACE })
    towerEnv = await ptyEnv(towerId)

    expect(Object.keys(towerEnv).filter(k => k.startsWith('BAT_')).sort()).toEqual([
      'BAT_HELPER_DIR', 'BAT_HELPER_LOG_DIR', 'BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN',
      'BAT_SERVER_CERT_PATH', 'BAT_SESSION', 'BAT_TERMINAL_ID', 'BAT_WORKSPACE_ID',
    ])
    expect(towerEnv).toMatchObject({ BAT_TERMINAL_ID: towerId, BAT_WORKSPACE_ID: WORKSPACE, BAT_REMOTE_PORT: String(harness.port) })
    expect(serverTokenIn(towerEnv)).toBe(false)
    expect(registry.verify(towerEnv.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: towerId, role: 'tower' })
  }, 60_000)

  it('dispatch: bat-terminal run inside the Tower PTY opens a worker tab in the Tower workspace', async () => {
    // the remote Tower's dispatch form: agent mode (--skill / --workorder). The raw-command
    // form (`bat-terminal.mjs claude "/ct-exec T…"`) is terminal:create-with-command — never
    // allowed for a capability (see the Tower scope test below).
    const run = await helperIn(towerId, 'bat-terminal.mjs', [
      '--agent', ECHO_AGENT, '--skill', 'ct-exec', '--workorder', WORKORDER,
      '--notify-id', '{env:BAT_TERMINAL_ID}', '--workspace', '{env:BAT_WORKSPACE_ID}',
      '--mode', 'yolo', '--no-interactive', '--cwd', CWD,
    ])
    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)
    workerId = /Terminal created: (\S+)/.exec(run.stdout)?.[1] ?? ''
    expect(workerId).not.toBe('')

    const [created] = await bat.waitForEvent('terminal:created-externally', args => (args[0] as { id?: string })?.id === workerId, 10_000)
    expect(created).toMatchObject({ id: workerId, workspaceId: WORKSPACE })
    expect((created as { command: string }).command).toContain(`/ct-exec ${WORKORDER}`)
    // the worker shell really ran the agent command (echo stands in for the agent)
    await vi.waitFor(() => expect(outputOf(workerId)).toContain(`/ct-exec ${WORKORDER}`), { timeout: 20_000, interval: 100 })

    workerEnv = await ptyEnv(workerId)
    expect(workerEnv).toMatchObject({ BAT_TERMINAL_ID: workerId, BAT_TOWER_TERMINAL_ID: towerId, CT_MODE: 'yolo', CT_INTERACTIVE: '0', BAT_WORKSPACE_ID: WORKSPACE })
    expect(serverTokenIn(workerEnv)).toBe(false)
    expect(registry.verify(workerEnv.BAT_REMOTE_TOKEN)?.capability).toEqual({ terminalId: workerId, towerId, role: 'worker' })
  }, 90_000)

  it('completion: bat-notify --submit inside the worker PTY → notified + keypress events, text pre-filled in the Tower PTY', async () => {
    const run = await helperIn(workerId, 'bat-notify.mjs', ['--source', WORKORDER, '--submit', NOTIFY_MESSAGE])
    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)
    expect(run.stdout).toContain('✓ Notified')

    const [notified] = await bat.waitForEvent('terminal:notified', args => (args[0] as { source?: string })?.source === WORKORDER, 10_000)
    expect(notified).toMatchObject({ targetId: towerId, message: NOTIFY_MESSAGE })
    const [keypress] = await bat.waitForEvent('terminal:keypress', args => (args[0] as { targetId?: string })?.targetId === towerId, 10_000)
    expect(keypress).toMatchObject({ targetId: towerId, key: 'Enter', source: WORKORDER, reason: 'submit' })
    // pty:write pre-filled the Tower PTY; the BAT renderer answers the keypress by synthesizing
    // Enter on its xterm, which reaches the PTY as a plain client pty:write (here: the Tower shell
    // runs the pre-filled line, a Tower agent would take it as its next prompt)
    await vi.waitFor(() => expect(outputOf(towerId)).toContain(WORKORDER), { timeout: 10_000, interval: 100 })
    expect(await bat.invoke('pty:write', towerId, '\r')).toMatchObject({ ok: true })
    await sleep(500)
  }, 60_000)

  it('scope: a worker cannot dispatch, and cannot write / notify a PTY other than its Tower', async () => {
    bystanderId = termId('bystander')
    await createPty(bystanderId)

    const before = createdCount()
    const dispatch = await helperIn(workerId, 'bat-terminal.mjs', ['--agent', ECHO_AGENT, '--prompt', 'worker-dispatch', '--cwd', CWD])
    expect(dispatch.code).toBe(1)
    expect(dispatch.stderr).toContain('Forbidden: role-not-allowed')

    const stray = await helperIn(workerId, 'bat-notify.mjs', ['--target', bystanderId, '--source', 'stray', 'T0434-STRAY-WORKER'])
    expect(stray.code).toBe(1)
    expect(stray.stderr).toMatch(/Forbidden: \S+/)
    expect(stray.stderr).toContain('PTY write failed')

    await sleep(300)
    expect(createdCount()).toBe(before)
    expect(outputOf(bystanderId)).not.toContain('T0434-STRAY-WORKER')
    expect(bat.events.some(e => e.channel === 'terminal:notified' && (e.args[0] as { source?: string })?.source === 'stray')).toBe(false)
  }, 60_000)

  it('scope: a Tower cannot notify / write its worker, nor run a raw command', async () => {
    const before = createdCount()
    const raw = await helperIn(towerId, 'bat-terminal.mjs', ['--cwd', CWD, 'echo', 'T0434-RAW'])
    expect(raw.code).toBe(1)
    expect(raw.stderr).toContain('Forbidden: channel-not-allowed')

    const notify = await helperIn(towerId, 'bat-notify.mjs', ['--target', workerId, '--source', 'tower-to-worker', 'T0434-TOWER-WRITE'])
    expect(notify.code).toBe(1)
    expect(notify.stderr).toContain('Forbidden: role-not-allowed')

    // T0450: an agent id the server does not know is refused (what smoke S13 relies on)
    const unknownAgent = await helperIn(towerId, 'bat-terminal.mjs', ['--agent', 'bat-smoke-unregistered-agent', '--prompt', 'x', '--cwd', CWD])
    expect(unknownAgent.code).toBe(1)
    expect(unknownAgent.stderr).toContain('Forbidden: agent-not-allowed')

    await sleep(300)
    expect(createdCount()).toBe(before)
    expect(outputOf(workerId)).not.toContain('T0434-TOWER-WRITE')
    expect(bat.events.some(e => e.channel === 'terminal:notified' && (e.args[0] as { source?: string })?.source === 'tower-to-worker')).toBe(false)
  }, 60_000)

  it('T0447: once the worker PTY is gone its capability is dead — pipelined frames run no handler, the real helper is refused', async () => {
    // A socket authenticated with the worker capability while the worker was alive
    const ws = new WebSocket(`wss://127.0.0.1:${harness.port}`, { rejectUnauthorized: false })
    ws.on('error', () => {})
    const frames: Array<{ id?: string; error?: string }> = []
    ws.on('message', raw => { try { frames.push(JSON.parse(raw.toString())) } catch { /* ignore */ } })
    const closed = new Promise<number>(resolve => ws.once('close', code => resolve(code)))
    await new Promise<void>((resolve, reject) => {
      ws.once('upgrade', res => expect((res.socket as TLSSocket).getPeerCertificate().fingerprint256).toBe(harness.fingerprint))
      ws.once('open', () => resolve())
      ws.once('error', reject)
    })
    ws.send(JSON.stringify({ type: 'auth', id: 'auth-1', token: workerEnv.BAT_REMOTE_TOKEN, args: ['T0434 worker socket'] }))
    await vi.waitFor(() => expect(frames.find(f => f.id === 'auth-1')).toMatchObject({ id: 'auth-1' }), { timeout: 5_000, interval: 20 })
    expect(frames.find(f => f.id === 'auth-1')?.error).toBeUndefined()

    // the worker finishes: its PTY is killed → capability revoked
    expect(await bat.invoke('pty:kill', workerId)).toBe(true)
    expect(registry.verify(workerEnv.BAT_REMOTE_TOKEN)).toBeNull()

    const evilId = termId('evil')
    invokeSpy.mockClear()
    ws.send(JSON.stringify({ type: 'ping', id: 'p-1' }))
    ws.send(JSON.stringify({ type: 'invoke', id: 'i-1', channel: 'pty:write', args: [towerId, 'T0434-REVOKED-WRITE'] }))
    ws.send(JSON.stringify({ type: 'invoke', id: 'i-2', channel: 'pty:create', args: [{ id: evilId, cwd: CWD, type: 'terminal' }] }))
    expect(await closed).toBe(1006) // terminate(), not a lingering close
    await sleep(300)
    expect(invokeSpy).not.toHaveBeenCalled()
    expect(await bat.invoke('pty:get-buffer', evilId)).toBeNull()
    expect(outputOf(towerId)).not.toContain('T0434-REVOKED-WRITE')

    // the real helper with the dead worker's env (run from the Tower PTY's shell, its env swapped by the job)
    const deadEnvJob = path.join(tmpDir, 'dead-worker-notify.cjs')
    fs.writeFileSync(deadEnvJob, `
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path')
const env = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const run = spawnSync(process.execPath, [path.join(env.BAT_HELPER_DIR, 'bat-notify.mjs'), '--source', 'dead', 'T0434-DEAD'], { env, encoding: 'utf8', windowsHide: true, timeout: 20000 })
fs.writeFileSync(process.argv[3] + '.tmp', JSON.stringify({ code: run.status, stderr: run.stderr || '' })); fs.renameSync(process.argv[3] + '.tmp', process.argv[3])
`)
    const envFile = path.join(tmpDir, 'dead-worker-env.json')
    const out = path.join(tmpDir, 'dead-worker-notify.out.json')
    fs.writeFileSync(envFile, JSON.stringify(workerEnv))
    expect(await bat.invoke('pty:write', towerId, `node "${deadEnvJob}" "${envFile}" "${out}"\r`)).toMatchObject({ ok: true })
    const dead = JSON.parse(await waitForFile(out)) as { code: number; stderr: string }
    expect(dead.code).toBe(1)
    // T0449: a revoked capability is named as such (and, unlike a wrong server token, never bans the IP)
    expect(dead.stderr).toContain('Authentication failed: Capability revoked')
    expect(bat.events.some(e => e.channel === 'terminal:notified' && (e.args[0] as { source?: string })?.source === 'dead')).toBe(false)
  }, 60_000)

  it('no BAT client connected: --submit exits 1 (no-client) — yolo never pretends the Tower was submitted', async () => {
    // a second worker, dispatched by the Tower through the real bat-terminal
    const run = await helperIn(towerId, 'bat-terminal.mjs', [
      '--agent', ECHO_AGENT, '--prompt', `/ct-exec ${WORKORDER}`,
      '--notify-id', '{env:BAT_TERMINAL_ID}', '--workspace', '{env:BAT_WORKSPACE_ID}', '--cwd', CWD,
    ])
    expect(run.code).toBe(0)
    const worker2 = /Terminal created: (\S+)/.exec(run.stdout)?.[1] ?? ''
    await bat.waitForEvent('terminal:created-externally', args => (args[0] as { id?: string })?.id === worker2, 10_000)
    await vi.waitFor(() => expect(outputOf(worker2)).toContain(`/ct-exec ${WORKORDER}`), { timeout: 20_000, interval: 100 })

    // the job waits 1.5 s before running bat-notify; the only BAT client disconnects meanwhile
    const result = await runInPty<HelperRun>(
      worker2,
      { kind: 'helper', script: 'bat-notify.mjs', args: ['--source', 'no-client', '--submit', NOTIFY_MESSAGE], delayMs: 1500 },
      bat,
      () => bat.close(),
    )
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('terminal keypress failed: no-client')

    bat = await harness.connect()
    expect(await bat.invoke('pty:kill', worker2)).toBe(true)
    expect(await bat.invoke('pty:kill', bystanderId)).toBe(true)
    expect(await bat.invoke('pty:kill', towerId)).toBe(true)
    expect(registry.verify(towerEnv.BAT_REMOTE_TOKEN)).toBeNull()
    expect(registry.size).toBe(0)
  }, 90_000)
})
