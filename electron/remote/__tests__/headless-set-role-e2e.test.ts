// @vitest-environment node
/**
 * T0562 / D147: `bat-terminal.mjs --set-role tower` from a remote Tower, end to end on a real
 * headless server (T0388 harness: in-process server + wss + real node-pty) with the real helper
 * running INSIDE the headless PTYs (driver pattern of headless-close-worker-e2e.test.ts).
 *
 *   Tower PTY ─ bat-terminal --set-role tower ─▶ terminal:set-role (tower capability, its own id)
 *     handler (electron/terminal-role.ts) → the BAT client gets terminal:role-changed
 *     { id, role, ptyAgent?, agent? } (PROXIED_EVENTS) — its window retitles the tab
 *
 * Negative: `--terminal-id` naming another terminal → `Forbidden: target-not-bound`; a worker
 * capability → `Forbidden: role-not-allowed`; both exit 1 with no event.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { agentRegistry } from '../../agent-runtime/agent-registry'
import { HelperCapabilityRegistry } from '../helper-capability'
import { startHeadlessHarness, type HeadlessClient, type HeadlessHarness } from './helpers/headless-harness'

const ECHO_AGENT = 't0562-echo-agent'
const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'
const WORKSPACE = 'client-ws-t0562'
const WO = 'T9562'

let seq = 0
const termId = (label: string) => `t0562-${label}-${process.pid}-${seq++}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let tmpDir: string
let driverScript: string
let registry: HelperCapabilityRegistry
let harness: HeadlessHarness
let bat: HeadlessClient

const DRIVER_SOURCE = `
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const fill = arg => arg.replace(/\\{env:([A-Z0-9_]+)\\}/g, (_, name) => process.env[name] || '')
const run = spawnSync(process.execPath, [path.join(process.env.BAT_HELPER_DIR || '', job.script), ...job.args.map(fill)], {
  env: process.env, encoding: 'utf8', windowsHide: true, timeout: 20000,
})
const result = { code: run.status, stdout: run.stdout || '', stderr: run.stderr || '', error: run.error ? run.error.message : null }
fs.writeFileSync(job.out + '.tmp', JSON.stringify(result))
fs.renameSync(job.out + '.tmp', job.out)
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

/** Types `node driver.cjs <job>` into PTY `id`, then waits for the helper's result. */
async function helperIn(id: string, args: string[]): Promise<HelperRun> {
  const name = `job-${seq++}`
  const out = path.join(tmpDir, `${name}.out.json`)
  const jobFile = path.join(tmpDir, `${name}.json`)
  fs.writeFileSync(jobFile, JSON.stringify({ script: 'bat-terminal.mjs', args, out }))
  expect(await bat.invoke('pty:write', id, `node "${driverScript}" "${jobFile}"\r`)).toMatchObject({ ok: true })
  return JSON.parse(await waitForFile(out)) as HelperRun
}

const outputOf = (id: string) => bat.events.filter(e => e.channel === 'pty:output' && e.args[0] === id).map(e => String(e.args[1] ?? '')).join('')
const roleEvents = (id: string) => bat.events.filter(e => e.channel === 'terminal:role-changed' && (e.args[0] as { id?: string })?.id === id)

async function createPty(id: string, opts: { workspaceId?: string; agentPreset?: string } = {}): Promise<void> {
  const result = await bat.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}), ...opts })
  expect(result).toMatchObject({ ok: true, created: true })
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0562-e2e-'))
  driverScript = path.join(tmpDir, 'driver.cjs')
  fs.writeFileSync(driverScript, DRIVER_SOURCE)
  agentRegistry.registerCustomCli({ id: ECHO_AGENT, name: 'T0562 echo', icon: 'x', color: '#000', command: 'echo' })
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry })
  bat = harness
})

afterAll(async () => {
  await harness?.dispose()
  agentRegistry.removeCustomCli(ECHO_AGENT)
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('remote Tower --set-role through the real helper (T0562)', () => {
  let tower: string
  let plain: string
  let worker: string

  it('setup: a Tower (custom CLI preset), a plain shell, and a Worker the Tower dispatched', async () => {
    tower = termId('tower')
    plain = termId('plain')
    await createPty(tower, { workspaceId: WORKSPACE, agentPreset: ECHO_AGENT })
    await createPty(plain, { workspaceId: WORKSPACE })
    const run = await helperIn(tower, [
      '--agent', ECHO_AGENT, '--skill', 'ct-exec', '--workorder', WO,
      '--notify-id', '{env:BAT_TERMINAL_ID}', '--workspace', '{env:BAT_WORKSPACE_ID}', '--cwd', CWD,
    ])
    expect(run.code, run.stderr).toBe(0)
    worker = /Terminal created: (\S+)/.exec(run.stdout)?.[1] ?? ''
    expect(worker).not.toBe('')
    await vi.waitFor(() => expect(outputOf(worker)).toContain(`/ct-exec ${WO}`), { timeout: 20_000, interval: 100 })
    expect(registry.isWorkerOf(worker, tower)).toBe(true)
  }, 120_000)

  it('the Tower sets its own role → exit 0, terminal:role-changed with the PTY agent and the --agent hint', async () => {
    const run = await helperIn(tower, ['--set-role', 'tower', '--agent', 'codex'])
    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)
    expect(run.stdout.trim()).toBe(`✓ Tower role set: ${tower}`)
    const [change] = await bat.waitForEvent('terminal:role-changed', args => (args[0] as { id?: string })?.id === tower, 10_000)
    expect(change).toMatchObject({ id: tower, role: 'tower', ptyAgent: ECHO_AGENT, ptyAgentName: 'T0562 echo', agent: 'codex-cli' })
  }, 60_000)

  it('a plain shell Tower; an unknown --agent hint is dropped (still exit 0)', async () => {
    const run = await helperIn(plain, ['--set-role', 'tower', '--agent', 'no-such-agent'])
    expect(run.code, run.stderr).toBe(0)
    const [change] = await bat.waitForEvent('terminal:role-changed', args => (args[0] as { id?: string })?.id === plain, 10_000)
    expect(change).toEqual({ id: plain, role: 'tower' })
  }, 60_000)

  it('--terminal-id naming another terminal → Forbidden: target-not-bound (exit 1), no event', async () => {
    const before = roleEvents(plain).length
    const run = await helperIn(tower, ['--set-role', 'tower', '--terminal-id', plain])
    expect(run.code).toBe(1)
    expect(run.stderr).toContain('Forbidden: target-not-bound')
    expect(run.stderr).toContain('set-role: FORBIDDEN')
    await sleep(300)
    expect(roleEvents(plain)).toHaveLength(before)
  }, 60_000)

  it('a worker capability → Forbidden: role-not-allowed (exit 1), no event', async () => {
    const run = await helperIn(worker, ['--set-role', 'tower'])
    expect(run.code).toBe(1)
    expect(run.stderr).toContain('Forbidden: role-not-allowed')
    expect(run.stderr).toContain('set-role: FORBIDDEN')
    await sleep(300)
    expect(roleEvents(worker)).toHaveLength(0)

    for (const id of [worker, plain, tower]) expect(await bat.invoke('pty:kill', id)).toBe(true)
    expect(registry.size).toBe(0)
  }, 60_000)
})
