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
 *   - T0594: PostToolUse AskUserQuestion (`ask-user-question-done`) clears a question with no
 *     client input (the driver runs both hooks from one typed command, the second after a pause)
 *   - T0597 (BUG-150): claude's real order — `ask-user-question`, ~90 ms later `permission-request`
 *     with tool_name AskUserQuestion, then `ask-user-question-done` — reads blocked / question while
 *     waiting and leaves blocked on the answer, no client input
 *   - T0600 (D154): `SessionStart` (`session-start`) in a claude-cli Worker PTY → agentStarted true
 *     (a client wait until=agent-started returns), false before, null for a codex tab; restart →
 *     false again; the exited record keeps agentStartedAt
 *   - T0657 (BUG-162): `permission-request` then `post-tool-batch` (PostToolBatch) leaves blocked with
 *     no client input; a subagent's prompt (`agent_id`) stays through the main thread's batch and
 *     leaves on its own
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

// Runs `node $BAT_HELPER_DIR/bat-hook.mjs <event>` with the hook JSON on stdin, from the PTY's env;
// then each of `job.then` (`{ delayMs, event, input }`) after its pause (T0594: no input in between).
const DRIVER_SOURCE = `
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const hook = (event, input) => {
  const started = Date.now()
  const run = spawnSync(process.execPath, [path.join(process.env.BAT_HELPER_DIR || '', 'bat-hook.mjs'), event], {
    env: process.env, input: JSON.stringify(input), encoding: 'utf8', windowsHide: true, timeout: 20000,
  })
  return { code: run.status, stdout: run.stdout || '', stderr: run.stderr || '', ms: Date.now() - started }
}
const result = { ...hook(job.event, job.input), hasCert: !!process.env.BAT_SERVER_CERT_PATH, tokenShape: String(process.env.BAT_REMOTE_TOKEN || '').slice(0, 7), then: [] }
for (const next of job.then || []) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, next.delayMs)
  result.then.push(hook(next.event, next.input))
}
fs.writeFileSync(job.out + '.tmp', JSON.stringify(result))
fs.renameSync(job.out + '.tmp', job.out)
`

interface HookRun {
  code: number | null
  stdout: string
  stderr: string
  ms: number
  hasCert: boolean
  tokenShape: string
  then: Array<{ code: number | null; stdout: string; stderr: string; ms: number }>
}
interface HookStep { delayMs: number; event: string; input: Record<string, unknown> }

async function waitForFile(file: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${file}`)
}

async function hookIn(id: string, event: string, input: Record<string, unknown>, then: HookStep[] = []): Promise<HookRun> {
  const name = `job-${seq++}`
  const out = path.join(tmpDir, `${name}.out.json`)
  const jobFile = path.join(tmpDir, `${name}.json`)
  fs.writeFileSync(jobFile, JSON.stringify({ event, input, out, then }))
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

  it('T0594: the answered question (PostToolUse AskUserQuestion) clears it with no client input', async () => {
    const ask = { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'SECRET?' }] } }
    const done = { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion', tool_response: { answers: { 'SECRET?': 'SECRET' } } }
    // one typed command (the only client input) runs both hooks, the second 3 s later
    const hook = hookIn(worker, 'ask-user-question', ask, [{ delayMs: 3_000, event: 'ask-user-question-done', input: done }])
    let last: Record<string, unknown> = await state(worker)
    const deadline = Date.now() + 30_000
    while (last.state !== 'blocked' && Date.now() < deadline) {
      last = await harness.invoke('terminal:wait', { terminalId: worker, until: 'state-change', fromState: last.state, timeoutMs: 30_000 }) as Record<string, unknown>
    }
    expect(last).toMatchObject({ state: 'blocked', blockedReason: 'question' })
    const left = await harness.invoke('terminal:wait', { terminalId: worker, until: 'state-change', fromState: 'blocked', timeoutMs: 20_000 }) as Record<string, unknown>
    expect(left).toMatchObject({ ok: true, changed: true, source: 'output' })
    expect(left.state).not.toBe('blocked')
    const run = await hook
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(run.then).toEqual([expect.objectContaining({ code: 0, stdout: '' })])
    expect(await state(worker)).toMatchObject({ blockedDetection: 'hook' })
    expect((await state(worker)).state).not.toBe('blocked')
  }, 60_000)

  it('T0597: claude’s real order — PreToolUse, PermissionRequest(AskUserQuestion), PostToolUse — stays a question, then clears with no client input', async () => {
    const ask = { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'SECRET?' }] } }
    const prompt = { hook_event_name: 'PermissionRequest', tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'SECRET?' }] }, permission_suggestions: [] }
    const done = { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion', tool_response: { answers: { 'SECRET?': 'SECRET' } } }
    // claude runs the PermissionRequest hook ~90 ms after PreToolUse; the answer comes 3 s later
    const hook = hookIn(worker, 'ask-user-question', ask, [
      { delayMs: 90, event: 'permission-request', input: prompt },
      { delayMs: 3_000, event: 'ask-user-question-done', input: done },
    ])
    let last: Record<string, unknown> = await state(worker)
    const deadline = Date.now() + 30_000
    while (last.state !== 'blocked' && Date.now() < deadline) {
      last = await harness.invoke('terminal:wait', { terminalId: worker, until: 'state-change', fromState: last.state, timeoutMs: 30_000 }) as Record<string, unknown>
    }
    expect(last).toMatchObject({ state: 'blocked', blockedReason: 'question' })
    await sleep(1_500) // the PermissionRequest hook has reported by now, the answer has not
    expect(await state(worker)).toMatchObject({ state: 'blocked', blockedReason: 'question', blockedSince: last.blockedSince })
    const left = await harness.invoke('terminal:wait', { terminalId: worker, until: 'state-change', fromState: 'blocked', timeoutMs: 20_000 }) as Record<string, unknown>
    expect(left).toMatchObject({ ok: true, changed: true, source: 'output' })
    expect(left.state).not.toBe('blocked')
    const run = await hook
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(run.then).toEqual([expect.objectContaining({ code: 0, stdout: '' }), expect.objectContaining({ code: 0, stdout: '' })])
    expect((await state(worker)).state).not.toBe('blocked')
  }, 60_000)

  it('T0657 (BUG-162): a permission prompt resolved without the keyboard (PostToolBatch) leaves blocked; a subagent’s prompt waits for its own batch', async () => {
    const prompt = (agent?: string) => ({
      ...(agent ? { agent_id: agent, agent_type: 'general-purpose' } : {}),
      hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'rm -rf SECRET' }, permission_suggestions: [],
    })
    const batch = (agent?: string) => ({
      ...(agent ? { agent_id: agent, agent_type: 'general-purpose' } : {}),
      hook_event_name: 'PostToolBatch',
      tool_calls: [{ tool_name: 'Bash', tool_input: { command: 'rm -rf SECRET' }, tool_use_id: 'toolu_1', tool_response: 'denied' }],
    })
    // one typed command (the only client input): the prompt, then 3 s later its batch resolves
    // (claude's own 120 s timeout of the dangerous-rm check, shortened)
    const hook = hookIn(worker, 'permission-request', prompt(), [{ delayMs: 3_000, event: 'post-tool-batch', input: batch() }])
    let last: Record<string, unknown> = await state(worker)
    const deadline = Date.now() + 30_000
    while (last.state !== 'blocked' && Date.now() < deadline) {
      last = await harness.invoke('terminal:wait', { terminalId: worker, until: 'state-change', fromState: last.state, timeoutMs: 30_000 }) as Record<string, unknown>
    }
    expect(last).toMatchObject({ state: 'blocked', blockedReason: 'permission' })
    const left = await harness.invoke('terminal:wait', { terminalId: worker, until: 'state-change', fromState: 'blocked', timeoutMs: 20_000 }) as Record<string, unknown>
    expect(left).toMatchObject({ ok: true, changed: true, source: 'output' })
    expect(left.state).not.toBe('blocked')
    const run = await hook
    expect(run).toMatchObject({ code: 0, stdout: '' })
    expect(run.then).toEqual([expect.objectContaining({ code: 0, stdout: '' })])

    // a background subagent's prompt: the main thread's batch keeps it, the subagent's clears it
    const sub = hookIn(worker, 'permission-request', prompt('a5e7'), [
      { delayMs: 500, event: 'post-tool-batch', input: batch() },
      { delayMs: 2_500, event: 'post-tool-batch', input: batch('a5e7') },
    ])
    last = await state(worker)
    while (last.state !== 'blocked' && Date.now() < deadline + 30_000) {
      last = await harness.invoke('terminal:wait', { terminalId: worker, until: 'state-change', fromState: last.state, timeoutMs: 30_000 }) as Record<string, unknown>
    }
    expect(last).toMatchObject({ state: 'blocked', blockedReason: 'permission' })
    await sleep(1_500) // the main thread's batch has reported by now, the subagent's has not
    expect(await state(worker)).toMatchObject({ state: 'blocked', blockedReason: 'permission', blockedSince: last.blockedSince })
    const subLeft = await harness.invoke('terminal:wait', { terminalId: worker, until: 'state-change', fromState: 'blocked', timeoutMs: 20_000 }) as Record<string, unknown>
    expect(subLeft).toMatchObject({ ok: true, changed: true })
    expect(subLeft.state).not.toBe('blocked')
    const subRun = await sub
    expect(subRun).toMatchObject({ code: 0, stdout: '' })
    expect(subRun.then).toEqual([expect.objectContaining({ code: 0, stdout: '' }), expect.objectContaining({ code: 0, stdout: '' })])
    expect((await state(worker)).state).not.toBe('blocked')
  }, 90_000)

  it('T0600: SessionStart inside the PTY → agentStarted; a client wait until=agent-started returns; codex null; restart → false; exited keeps it', async () => {
    const starter = termId('starter')
    const codex = termId('codex')
    await harness.invoke('agent:bat-mcp-launch-args', 'claude-cli', 'posix', '', starter)
    await harness.invoke('agent:bat-mcp-launch-args', 'codex-cli', 'posix', '', codex)
    await createPty(starter, { BAT_TOWER_TERMINAL_ID: tower })
    await createPty(codex, { BAT_TOWER_TERMINAL_ID: tower })
    await sleep(1_000)
    expect(await state(starter)).toMatchObject({ ok: true, blockedDetection: 'hook', agentStarted: false })
    expect(await state(codex)).toMatchObject({ ok: true, blockedDetection: 'none', agentStarted: null })
    expect(await harness.invoke('terminal:wait', { terminalId: codex, until: 'agent-started', timeoutMs: 5_000 })).toMatchObject({ ok: true, changed: true, agentStarted: null })

    const waiting = harness.invoke('terminal:wait', { terminalId: starter, until: 'agent-started', timeoutMs: 30_000 }) as Promise<Record<string, unknown>>
    const run = await hookIn(starter, 'session-start', { hook_event_name: 'SessionStart', source: 'startup', model: 'SECRET-MODEL' })
    expect(run).toMatchObject({ code: 0, stdout: '', tokenShape: 'batcap.' })
    const started = await waiting
    expect(started).toMatchObject({ ok: true, changed: true, agentStarted: true, agentStartedAt: expect.any(Number), blockedDetection: 'hook' })
    expect((await state(starter)).state).not.toBe('blocked')

    expect(await harness.invoke('pty:restart', starter, CWD, SHELL)).toBe(true)
    await sleep(500)
    expect(await state(starter)).toMatchObject({ blockedDetection: 'hook', agentStarted: false })
    await hookIn(starter, 'session-start', { hook_event_name: 'SessionStart', source: 'startup' })
    const again = await state(starter)
    expect(again).toMatchObject({ agentStarted: true })
    await harness.invoke('pty:kill', starter)
    expect(await state(starter)).toMatchObject({ state: 'exited', agentStarted: true, agentStartedAt: again.agentStartedAt })
    await harness.invoke('pty:kill', codex)
  }, 90_000)

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
