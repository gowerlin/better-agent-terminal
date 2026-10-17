// @vitest-environment node
/**
 * PLAN-047 M1b-1 / T0590: `blocked` on a real headless server (T0388 harness: in-process server +
 * wss + real node-pty) with the real scripts/bat-hook.mjs run INSIDE the headless PTYs, with each
 * PTY's own env (`BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` = its capability, `BAT_SERVER_CERT_PATH`).
 *
 *   - `agent:bat-mcp-launch-args` for a claude-cli tab (4th argument = the tab id) → `--settings=`
 *     injected, the tab's `blockedDetection` = hook
 *   - Worker PTY: hook `ask-user-question` → get-state blocked / question / source hook (the
 *     Worker's tower capability is not needed: the target is the caller)
 *   - a client wait until=state-change returns when the hook fires in the PTY
 *   - the client's `pty:write` clears it; `{ auto: true }` does not
 *   - a plain shell (tower capability, undeclared) reports for itself too
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HelperCapabilityRegistry } from '../helper-capability'
import { startHeadlessHarness, type HeadlessHarness } from './helpers/headless-harness'

const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'
const WORKSPACE = 'client-ws-t0590'

let seq = 0
const termId = (label: string) => `t0590-${label}-${process.pid}-${seq++}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let tmpDir: string
let driverScript: string
let registry: HelperCapabilityRegistry
let harness: HeadlessHarness

// Runs `node $BAT_HELPER_DIR/bat-hook.mjs <event>` with the hook JSON on stdin, from the PTY's env.
const DRIVER_SOURCE = `
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const started = Date.now()
const run = spawnSync(process.execPath, [path.join(process.env.BAT_HELPER_DIR || '', 'bat-hook.mjs'), job.event], {
  env: process.env, input: JSON.stringify(job.input), encoding: 'utf8', windowsHide: true, timeout: 20000,
})
const result = { code: run.status, stdout: run.stdout || '', stderr: run.stderr || '', ms: Date.now() - started, hasCert: !!process.env.BAT_SERVER_CERT_PATH, tokenShape: String(process.env.BAT_REMOTE_TOKEN || '').slice(0, 7) }
fs.writeFileSync(job.out + '.tmp', JSON.stringify(result))
fs.renameSync(job.out + '.tmp', job.out)
`

interface HookRun { code: number | null; stdout: string; stderr: string; ms: number; hasCert: boolean; tokenShape: string }

async function waitForFile(file: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${file}`)
}

async function hookIn(id: string, event: string, input: Record<string, unknown>): Promise<HookRun> {
  const name = `job-${seq++}`
  const out = path.join(tmpDir, `${name}.out.json`)
  const jobFile = path.join(tmpDir, `${name}.json`)
  fs.writeFileSync(jobFile, JSON.stringify({ event, input, out }))
  expect(await harness.invoke('pty:write', id, `node "${driverScript}" "${jobFile}"\r`)).toMatchObject({ ok: true })
  return JSON.parse(await waitForFile(out)) as HookRun
}

async function createPty(id: string, customEnv?: Record<string, string>): Promise<void> {
  const result = await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', workspaceId: WORKSPACE, ...(SHELL ? { shell: SHELL } : {}), ...(customEnv ? { customEnv } : {}) })
  expect(result).toMatchObject({ ok: true, created: true })
}

const state = (id: string) => harness.invoke('terminal:get-state', { terminalId: id }) as Promise<Record<string, unknown>>

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0590-e2e-'))
  driverScript = path.join(tmpDir, 'driver.cjs')
  fs.writeFileSync(driverScript, DRIVER_SOURCE)
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry })
})

afterAll(async () => {
  await harness?.dispose()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('blocked from claude hooks inside headless PTYs (T0590)', () => {
  let tower: string
  let worker: string
  let plain: string

  it('setup: a claude-cli Worker tab gets --settings= and blockedDetection hook', async () => {
    tower = termId('tower')
    worker = termId('worker')
    plain = termId('plain')
    const args = await harness.invoke('agent:bat-mcp-launch-args', 'claude-cli', 'posix', '', worker) as string
    expect(args).toMatch(/--settings=[^ ]*bat-mcp[\\/]claude-settings\.json/)
    await createPty(tower)
    await createPty(worker, { BAT_TOWER_TERMINAL_ID: tower, CT_MODE: 'yolo' })
    await createPty(plain)
    expect(registry.isWorkerOf(worker, tower)).toBe(true)
    await sleep(1_500) // shells print their prompts
    expect(await state(worker)).toMatchObject({ ok: true, blockedDetection: 'hook' })
    expect(await state(plain)).toMatchObject({ ok: true, blockedDetection: 'none' })
  }, 60_000)

  it('Worker: the AskUserQuestion hook → blocked; a client wait until=state-change returns; exit 0 with no stdout', async () => {
    // typing the driver command makes the shell `working` (its echo) first: follow the changes
    const hook = hookIn(worker, 'ask-user-question', { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'SECRET?' }] } })
    let last: Record<string, unknown> = await state(worker)
    const deadline = Date.now() + 30_000
    while (last.state !== 'blocked' && Date.now() < deadline) {
      last = await harness.invoke('terminal:wait', { terminalId: worker, until: 'state-change', fromState: last.state, timeoutMs: 30_000 }) as Record<string, unknown>
      expect(last).toMatchObject({ ok: true })
    }
    expect(last).toMatchObject({ changed: true, state: 'blocked', blockedReason: 'question', source: 'hook' })
    const run = await hook
    expect(run).toMatchObject({ code: 0, stdout: '', hasCert: true, tokenShape: 'batcap.' })
    expect(run.ms).toBeLessThan(2_000)
    expect(await state(worker)).toMatchObject({ state: 'blocked', blockedReason: 'question', blockedSince: expect.any(Number), blockedDetection: 'hook' })
  }, 60_000)

  it('the client’s { auto: true } write keeps it; the client’s typing clears it', async () => {
    expect(await harness.invoke('pty:write', worker, ' ', { auto: true })).toMatchObject({ ok: true })
    expect(await state(worker)).toMatchObject({ state: 'blocked' })
    expect(await harness.invoke('pty:write', worker, ' ')).toMatchObject({ ok: true })
    expect((await state(worker)).state).not.toBe('blocked')
  }, 30_000)

  it('a plain shell (undeclared, tower capability) reports for itself; Stop clears', async () => {
    const run = await hookIn(plain, 'permission-request', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' })
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(await state(plain)).toMatchObject({ state: 'blocked', blockedReason: 'permission', blockedDetection: 'hook' })
    expect(await state(tower)).not.toMatchObject({ state: 'blocked' })
    expect(await hookIn(plain, 'stop', { hook_event_name: 'Stop' })).toMatchObject({ code: 0, stdout: '' })
    // Stop is async in claude's config; the report itself is synchronous on the server
    expect((await state(plain)).state).not.toBe('blocked')
  }, 60_000)
})
