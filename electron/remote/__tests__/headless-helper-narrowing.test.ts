// @vitest-environment node
/**
 * T0450 (T0445 #6 / #7): helper capabilities narrowed, on a real headless server (T0388 harness:
 * in-process server + wss clients + real node-pty).
 *
 *   - worker `pty:write`: printable pre-fill only — `\r` / `\n` / `\x03` / ESC … are refused
 *     before the handler runs; the bat-notify flow (pre-fill + `terminal:keypress`) still works,
 *     and the real bat-notify flattens a multi-line message into one pre-fill line
 *   - tower `terminal:create-agent-command`: registry agents only; ≤ 8 live children per tower;
 *     ≥ 1 s between creations; helpers never take the last 8 PTY slots of a capped server
 *
 * The creation quota gets an injected clock (`helperSpawnQuota`) so the 1 s interval does not
 * slow the suite; the interval itself is covered against that clock.
 */
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { agentRegistry } from '../../agent-runtime/agent-registry'
import { HelperCapabilityRegistry, HelperTowerSpawnQuota } from '../helper-capability'
import {
  connectHeadlessClient,
  startHeadlessHarness,
  type HeadlessClient,
  type HeadlessHarness,
} from './helpers/headless-harness'

const ECHO_AGENT = 't0450-echo-agent'
const REPO_SCRIPTS = path.resolve(__dirname, '..', '..', '..', 'scripts')
const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'

let seq = 0
const termId = (label: string) => `t0450-${label}-${process.pid}-${seq++}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface Server {
  harness: HeadlessHarness
  registry: HelperCapabilityRegistry
  tick: (ms: number) => void
  towerId: string
  connectAs: (token: string) => Promise<HeadlessClient>
  createPty: (id: string) => Promise<void>
}

async function startServer(opts: { maxPtys: number }): Promise<Server> {
  let now = 1_000_000
  const registry = new HelperCapabilityRegistry()
  const harness = await startHeadlessHarness({
    helperCapabilities: registry,
    helperSpawnQuota: new HelperTowerSpawnQuota({ now: () => now }),
    maxPtys: opts.maxPtys,
  })
  const createPty = async (id: string) => {
    const result = await harness.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}) })
    expect(result).toMatchObject({ ok: true, created: true })
  }
  const towerId = termId('tower')
  await createPty(towerId)
  return {
    harness,
    registry,
    tick: ms => { now += ms },
    towerId,
    connectAs: token => connectHeadlessClient({ port: harness.port, token, fingerprint: harness.fingerprint }),
    createPty,
  }
}

/** Everything PTY `id` printed, as the BAT client received it (`pty:output` broadcasts). */
const outputOf = (server: Server, id: string) => server.harness.events
  .filter(e => e.channel === 'pty:output' && e.args[0] === id)
  .map(e => String(e.args[1] ?? ''))
  .join('')

const agentCommand = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, cwd: CWD, agent: ECHO_AGENT, prompt: 'T0450MARK', ...extra })

let main: Server

beforeAll(async () => {
  agentRegistry.registerCustomCli({ id: ECHO_AGENT, name: 'T0450 echo', icon: 'x', color: '#000', command: 'echo' })
  main = await startServer({ maxPtys: 0 })
})

afterAll(async () => {
  await main?.harness.dispose()
  agentRegistry.removeCustomCli(ECHO_AGENT)
})

describe('worker pty:write — printable pre-fill only (T0450, T0445 #6)', () => {
  it.each([
    ['CR (submit)', 'T0450PWN-CR\r'],
    ['LF', 'T0450PWN-LF\n'],
    ['Ctrl-C then a command', '\x03\x03echo T0450PWN-ETX\r'],
    ['ESC sequence', '\x1b[200~T0450PWN-ESC\x1b[201~'],
    ['TAB', 'T0450PWN\tTAB'],
    ['DEL', 'T0450PWN-DEL\x7f'],
  ])('%s is refused and never reaches the tower PTY', async (_label, data) => {
    const { harness, registry, towerId } = main
    const workerId = termId('worker')
    const worker = await main.connectAs(registry.issue(workerId, { towerId }))
    await expect(worker.invoke('pty:write', towerId, data)).rejects.toThrow(/^Forbidden: control-character-not-allowed$/)
    await worker.close()
    registry.revokeTerminal(workerId)
    await sleep(200)
    expect(outputOf(main, towerId)).not.toContain('T0450PWN')
    expect(String(await harness.invoke('pty:get-buffer', towerId) ?? '')).not.toContain('T0450PWN')
  })

  it('the bat-notify flow still works: notify, printable pre-fill, then keypress Enter', async () => {
    const { harness, registry, towerId } = main
    const workerId = termId('worker')
    const worker = await main.connectAs(registry.issue(workerId, { towerId }))
    expect(await worker.invoke('terminal:notify', { targetId: towerId, message: 'T0450 完成', source: workerId })).toBe(true)
    expect(await worker.invoke('pty:write', towerId, 'T0450PREFILL 完成')).toMatchObject({ ok: true })
    expect(await worker.invoke('terminal:keypress', { targetId: towerId, key: 'Enter', traceId: 't0450-submit' }))
      .toMatchObject({ ok: true, broadcastClients: 1 })
    await harness.waitForEvent('terminal:keypress', args => (args[0] as { traceId?: string })?.traceId === 't0450-submit')
    // The pre-fill reached the tower PTY (echoed by its shell); the renderer's Enter is a client write.
    await vi.waitFor(() => expect(outputOf(main, towerId)).toContain('T0450PREFILL'), { timeout: 10_000, interval: 100 })
    expect(await harness.invoke('pty:write', towerId, '\r')).toMatchObject({ ok: true })
    await worker.close()
    registry.revokeTerminal(workerId)
  }, 20_000)
})

/** Runs the real scripts/bat-notify.mjs with a worker capability; no BAT_* of this machine leaks in. */
function runBatNotify(args: string[], token: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0450-notify-'))
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.toUpperCase().startsWith('BAT_') && !key.toUpperCase().startsWith('CT_')) env[key] = value
  }
  Object.assign(env, {
    BAT_REMOTE_PORT: String(main.harness.port),
    BAT_REMOTE_TOKEN: token,
    BAT_SERVER_CERT_PATH: path.join(main.harness.dataDir, 'server-cert.json'),
    BAT_HELPER_DIR: REPO_SCRIPTS,
    BAT_HELPER_LOG_DIR: logDir,
  })
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(REPO_SCRIPTS, 'bat-notify.mjs'), ...args], { env, cwd: CWD, windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => { stdout += String(d) })
    child.stderr.on('data', d => { stderr += String(d) })
    child.on('error', reject)
    child.on('close', code => {
      fs.rmSync(logDir, { recursive: true, force: true })
      resolve({ code, stdout, stderr })
    })
  })
}

describe('real bat-notify under a worker capability (T0450)', () => {
  it('a multi-line message: the toast keeps it, the pre-fill is one line, --submit still answers ok', async () => {
    const { harness, registry, towerId } = main
    const workerId = termId('worker')
    const message = 'T0450MULTI line1\nline2\r\n\tline3'
    const run = await runBatNotify(['--target', towerId, '--source', workerId, '--submit', message], registry.issue(workerId, { towerId }))
    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)

    const [notified] = await harness.waitForEvent('terminal:notified', args => (args[0] as { source?: string })?.source === workerId, 10_000)
    expect(notified).toMatchObject({ targetId: towerId, message })
    const [keypress] = await harness.waitForEvent('terminal:keypress', args => (args[0] as { source?: string })?.source === workerId, 10_000)
    expect(keypress).toMatchObject({ targetId: towerId, key: 'Enter', reason: 'submit' })
    // ANSI stripped: an interactive shell (pwsh PSReadLine) colours the echoed tokens apart.
    const plainOutput = () => outputOf(main, towerId).replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    await vi.waitFor(() => expect(plainOutput()).toContain('T0450MULTI line1 line2 line3'), { timeout: 10_000, interval: 100 })
    expect(await harness.invoke('pty:write', towerId, '\r')).toMatchObject({ ok: true })
    registry.revokeTerminal(workerId)
  }, 30_000)
})

describe('tower create-agent-command — registry agent, quota (T0450, T0445 #7)', () => {
  it('an unknown agent id is refused; nothing is created', async () => {
    const { harness, registry, towerId } = main
    const tower = await main.connectAs(registry.issue(towerId))
    const childId = termId('child')
    await expect(tower.invoke('terminal:create-agent-command', agentCommand(childId, { agent: 't0450-not-registered' })))
      .rejects.toThrow(/^Forbidden: agent-not-allowed$/)
    await expect(tower.invoke('terminal:create-agent-command', agentCommand(childId, { agent: 'constructor' })))
      .rejects.toThrow(/^Forbidden: agent-not-allowed$/)
    expect(await harness.invoke('pty:get-buffer', childId)).toBeNull()
    await tower.close()
  })

  it('a second creation within 1 s is refused; after 1 s it is allowed', async () => {
    const { harness, registry, towerId, tick } = main
    const tower = await main.connectAs(registry.issue(towerId))
    tick(1000)
    const first = termId('child')
    const second = termId('child')
    expect(await tower.invoke('terminal:create-agent-command', agentCommand(first))).toBe(true)
    await expect(tower.invoke('terminal:create-agent-command', agentCommand(second))).rejects.toThrow(/^Forbidden: create-rate-limited$/)
    expect(await harness.invoke('pty:get-buffer', second)).toBeNull()
    tick(1000)
    expect(await tower.invoke('terminal:create-agent-command', agentCommand(second))).toBe(true)
    await tower.close()
    await harness.invoke('pty:kill', first)
    await harness.invoke('pty:kill', second)
  })

  it('the 9th live child is refused; a child exiting frees a slot; a BAT client is not limited', async () => {
    const { harness, registry, towerId, tick } = main
    const tower = await main.connectAs(registry.issue(towerId))
    const children: string[] = []
    for (let i = 0; i < 8; i++) {
      tick(1000)
      const id = termId('child')
      expect(await tower.invoke('terminal:create-agent-command', agentCommand(id))).toBe(true)
      children.push(id)
    }
    tick(1000)
    const ninth = termId('child')
    await expect(tower.invoke('terminal:create-agent-command', agentCommand(ninth))).rejects.toThrow(/^Forbidden: too-many-children$/)
    expect(await harness.invoke('pty:get-buffer', ninth)).toBeNull()

    // The client opens terminals regardless of the helper quota.
    const clientPty = termId('client')
    await main.createPty(clientPty)

    await harness.invoke('pty:kill', children.shift())
    tick(1000)
    expect(await tower.invoke('terminal:create-agent-command', agentCommand(ninth))).toBe(true)
    children.push(ninth)

    await tower.close()
    for (const id of [...children, clientPty]) await harness.invoke('pty:kill', id)
  }, 60_000)
})

describe('client PTY reserve (T0450, T0445 #7)', () => {
  it('on a capped server a tower stops 8 slots short of the cap; the client still opens terminals up to it', async () => {
    // maxPtys 10: tower PTY = 1 running → helpers may bring it to 2 (= 10 - 8), no further.
    const capped = await startServer({ maxPtys: 10 })
    try {
      const { harness, registry, towerId, tick } = capped
      const tower = await capped.connectAs(registry.issue(towerId))
      expect(await tower.invoke('terminal:create-agent-command', agentCommand(termId('child')))).toBe(true)
      tick(1000)
      const refused = termId('child')
      await expect(tower.invoke('terminal:create-agent-command', agentCommand(refused))).rejects.toThrow(/^Forbidden: pty-quota-reserved$/)
      expect(await harness.invoke('pty:get-buffer', refused)).toBeNull()
      await tower.close()

      // 2 running; the client takes the remaining 8 slots, then hits the server cap itself.
      for (let i = 0; i < 8; i++) await capped.createPty(termId('client'))
      expect(await harness.invoke('pty:create', { id: termId('client'), cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}) }))
        .toMatchObject({ ok: false })
    } finally {
      await capped.harness.dispose()
    }
  }, 60_000)
})
