// @vitest-environment node
/**
 * T0432 (PLAN-036 P3 / K, T0420 方案 A'): per-PTY helper capabilities on a real headless
 * server (T0388 harness: in-process server + wss clients + real node-pty).
 *
 * Capabilities are issued straight into the server's registry here; injecting them into the
 * PTY env is T0433. `bat` is a BAT window (server token); `tower` / `worker` play
 * bat-terminal / bat-notify running inside PTYs T and W.
 *
 *   - positive: tower creates a worker reporting back to it; worker notifies / pre-fills /
 *     submits to its tower
 *   - negative: every non-whitelisted channel (pty:create, create-with-command, fs:*, claude:*,
 *     git:*, profile:*, settings:* …), a tower writing a PTY, a worker targeting another PTY,
 *     a create over an existing id, a worker bound to another tower — the handler never runs
 *   - revocation: PTY exit revokes (open connection closed, new auth refused); server stop
 *     clears; a restarted server accepts none of the old tokens
 *   - helpers are not clients: no broadcasts, not counted for keypress `no-client` nor for
 *     the T0404 orphan PTY reclaim
 *   - logs: no part of the server token or a capability
 */
import * as os from 'os'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { agentRegistry } from '../../agent-runtime/agent-registry'
import { HelperCapabilityRegistry } from '../helper-capability'
import {
  connectHeadlessClient,
  startHeadlessHarness,
  type HeadlessClient,
  type HeadlessHarness,
} from './helpers/headless-harness'

const ECHO_AGENT = 't0432-echo-agent'
const CWD = os.tmpdir()
const SHELL = process.platform === 'win32' ? undefined : '/bin/sh'

let seq = 0
const termId = (label: string) => `t0432-${label}-${process.pid}-${seq++}`

const logLines: string[] = []
const captureLogger = {
  log: (...args: unknown[]) => { logLines.push(args.map(String).join(' ')) },
  warn: (...args: unknown[]) => { logLines.push(args.map(String).join(' ')) },
  error: (...args: unknown[]) => { logLines.push(args.map(String).join(' ')) },
}

let registry: HelperCapabilityRegistry
let harness: HeadlessHarness
let bat: HeadlessClient
let towerId: string
let towerToken: string

const connectAs = (token: string) =>
  connectHeadlessClient({ port: harness.port, token, fingerprint: harness.fingerprint })

async function createPty(id: string): Promise<void> {
  const result = await bat.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}) })
  expect(result).toMatchObject({ ok: true, created: true })
}

beforeAll(async () => {
  agentRegistry.registerCustomCli({ id: ECHO_AGENT, name: 'T0432 echo', icon: 'x', color: '#000', command: 'echo' })
  registry = new HelperCapabilityRegistry()
  harness = await startHeadlessHarness({ helperCapabilities: registry, logger: captureLogger })
  bat = harness // primary client = the BAT window
  towerId = termId('tower')
  await createPty(towerId)
  towerToken = registry.issue(towerId)
})

afterAll(async () => {
  await harness?.dispose()
  agentRegistry.removeCustomCli(ECHO_AGENT)
})

describe('helper capability — positive path (T0432)', () => {
  it('tower creates a worker that reports back to it; the BAT client gets created-externally', async () => {
    const tower = await connectAs(towerToken)
    const workerId = termId('worker')
    const result = await tower.invoke('terminal:create-agent-command', {
      id: workerId,
      cwd: CWD,
      agent: ECHO_AGENT,
      prompt: 'T0432MARK',
      workspaceId: 'client-ws-1',
      customEnv: { MSYS_NO_PATHCONV: '1', BAT_TOWER_TERMINAL_ID: towerId, CT_MODE: 'yolo' },
    })
    expect(result).toBe(true)
    const [payload] = await bat.waitForEvent('terminal:created-externally', args => (args[0] as { id?: string })?.id === workerId)
    expect(payload).toMatchObject({ id: workerId, workspaceId: 'client-ws-1' })
    await tower.close()
    await bat.invoke('pty:kill', workerId)
  })

  it('worker notifies, pre-fills and submits to its tower', async () => {
    const workerId = termId('worker')
    await createPty(workerId)
    const worker = await connectAs(registry.issue(workerId, { towerId }))

    expect(await worker.invoke('terminal:notify', { targetId: towerId, message: 'T0432 完成', source: workerId })).toBe(true)
    const [notified] = await bat.waitForEvent('terminal:notified', args => (args[0] as { source?: string })?.source === workerId)
    expect(notified).toMatchObject({ targetId: towerId, message: 'T0432 完成' })

    expect(await worker.invoke('pty:write', towerId, 'T0432 完成')).toMatchObject({ ok: true })
    expect(await worker.invoke('terminal:keypress', { targetId: towerId, key: 'Enter', traceId: 't0432-submit' }))
      .toMatchObject({ ok: true, broadcastClients: 1 })
    await bat.waitForEvent('terminal:keypress', args => (args[0] as { traceId?: string })?.traceId === 't0432-submit')

    await worker.close()
    await bat.invoke('pty:kill', workerId)
  })
})

describe('helper capability — denied (T0432)', () => {
  const FORBIDDEN: Array<[string, unknown[]]> = [
    ['pty:create', [{ id: 'evil-1', cwd: CWD, type: 'terminal' }]],
    ['pty:kill', ['TOWER']],
    ['pty:restart', ['TOWER', CWD]],
    ['pty:get-buffer', ['TOWER']],
    ['terminal:create-with-command', [{ id: 'evil-2', cwd: CWD, command: 'echo pwned' }]],
    ['fs:readdir', [CWD]],
    ['fs:readFile', [`${CWD}/x`]],
    ['image:read-as-data-url', [`${CWD}/x.png`]],
    ['workspace:sync-roots', [[CWD]]],
    ['claude:start-session', ['s1', { cwd: CWD }]],
    ['claude:list-sessions', [CWD]],
    ['git:status', [CWD]],
    ['worktree:create', [CWD, 'b']],
    ['github:check-cli', []],
    ['profile:list', []],
    ['settings:load', []],
    ['settings:get-shell-path', ['bash']],
    ['remote-tools:detect', []],
  ]
  const withTower = (args: unknown[]) => args.map(a => (a === 'TOWER' ? towerId : a))

  it.each(FORBIDDEN)('tower and worker capabilities cannot invoke %s', async (channel, args) => {
    const workerId = termId('worker')
    const tower = await connectAs(towerToken)
    const worker = await connectAs(registry.issue(workerId, { towerId }))
    await expect(tower.invoke(channel, ...withTower(args))).rejects.toThrow(/^Forbidden: channel-not-allowed$/)
    await expect(worker.invoke(channel, ...withTower(args))).rejects.toThrow(/^Forbidden: channel-not-allowed$/)
    await tower.close()
    await worker.close()
    registry.revokeTerminal(workerId)
    // Nothing was created behind the denial, and the tower PTY is untouched.
    expect(await bat.invoke('pty:get-buffer', 'evil-1')).toBeNull()
    expect(await bat.invoke('pty:get-buffer', 'evil-2')).toBeNull()
    expect(await bat.invoke('pty:get-cwd', towerId)).toBe(CWD)
  })

  it('a tower capability writes no PTY (pty:write / notify / keypress), not even its own', async () => {
    const tower = await connectAs(towerToken)
    await expect(tower.invoke('pty:write', towerId, 'x')).rejects.toThrow('Forbidden: role-not-allowed')
    await expect(tower.invoke('terminal:notify', { targetId: towerId, message: 'm' })).rejects.toThrow('Forbidden: role-not-allowed')
    await expect(tower.invoke('terminal:keypress', { targetId: towerId, key: 'Enter' })).rejects.toThrow('Forbidden: role-not-allowed')
    await tower.close()
  })

  it('a worker cannot target any PTY but its tower, nor create terminals', async () => {
    const otherId = termId('other')
    await createPty(otherId)
    const workerId = termId('worker')
    const worker = await connectAs(registry.issue(workerId, { towerId }))
    await expect(worker.invoke('pty:write', otherId, 'echo pwned\r')).rejects.toThrow('Forbidden: target-not-bound')
    await expect(worker.invoke('terminal:notify', { targetId: otherId, message: 'm' })).rejects.toThrow('Forbidden: target-not-bound')
    await expect(worker.invoke('terminal:keypress', { targetId: otherId, key: 'Enter' })).rejects.toThrow('Forbidden: target-not-bound')
    await expect(worker.invoke('terminal:create-agent-command', { id: termId('x'), cwd: CWD, prompt: 'p' }))
      .rejects.toThrow('Forbidden: role-not-allowed')
    await worker.close()
    registry.revokeTerminal(workerId)
    await bat.invoke('pty:kill', otherId)
  })

  it('a tower cannot create over an existing id, bind a worker to another tower, or pick env / shell', async () => {
    const otherId = termId('other')
    await createPty(otherId)
    const tower = await connectAs(towerToken)
    const base = { cwd: CWD, agent: ECHO_AGENT, prompt: 'T0432PWNED' }
    await expect(tower.invoke('terminal:create-agent-command', { ...base, id: otherId })).rejects.toThrow('Forbidden: terminal-exists')
    await expect(tower.invoke('terminal:create-agent-command', { ...base, id: termId('w'), customEnv: { BAT_TOWER_TERMINAL_ID: otherId } }))
      .rejects.toThrow('Forbidden: tower-not-bound')
    await expect(tower.invoke('terminal:create-agent-command', { ...base, id: termId('w'), customEnv: { LD_PRELOAD: '/tmp/x.so' } }))
      .rejects.toThrow('Forbidden: custom-env-not-allowed')
    await expect(tower.invoke('terminal:create-agent-command', { ...base, id: termId('w'), shell: '/bin/sh' }))
      .rejects.toThrow('Forbidden: shell-not-allowed')
    await tower.close()
    // The existing PTY never received the agent command.
    await new Promise(resolve => setTimeout(resolve, 700))
    expect(String(await bat.invoke('pty:get-buffer', otherId) ?? '')).not.toContain('T0432PWNED')
    await bat.invoke('pty:kill', otherId)
  })

  it('unknown / forged tokens are refused at auth', async () => {
    const forged = (towerToken[0] === 'A' ? 'B' : 'A') + towerToken.slice(1)
    await expect(connectAs(forged)).rejects.toThrow('Invalid token')
    await expect(connectAs(`${harness.token}x`)).rejects.toThrow('Invalid token')
  })
})

describe('helper capability — revocation (T0432)', () => {
  it('PTY exit revokes: the open connection is closed and a new auth is refused', async () => {
    const workerId = termId('worker')
    await createPty(workerId)
    const workerToken = registry.issue(workerId, { towerId })
    const worker = await connectAs(workerToken)
    expect(await worker.invoke('terminal:notify', { targetId: towerId, message: 'before' })).toBe(true)

    await bat.invoke('pty:kill', workerId)
    await expect(worker.invoke('terminal:notify', { targetId: towerId, message: 'after' })).rejects.toThrow('Capability revoked')
    // T0449 (T0445 #5): a recently revoked capability is named as such (and not counted as a failed auth).
    await expect(connectAs(workerToken)).rejects.toThrow('Capability revoked')
  })

  it('a PTY that exits on its own revokes its capability too', async () => {
    const workerId = termId('exits')
    await createPty(workerId)
    const workerToken = registry.issue(workerId, { towerId })
    await bat.invoke('pty:write', workerId, 'exit\r')
    await vi.waitFor(() => expect(registry.verify(workerToken)).toBeNull(), { timeout: 15_000, interval: 50 })
    await expect(connectAs(workerToken)).rejects.toThrow('Capability revoked')
  })

})

describe('helper capability — helpers receive no broadcasts (T0432)', () => {
  it('a helper receives no broadcasts (no pty:output of other terminals)', async () => {
    const workerId = termId('worker')
    const worker = await connectAs(registry.issue(workerId, { towerId }))
    await bat.invoke('pty:write', towerId, 'echo T0432BROADCAST\r')
    await vi.waitFor(() => expect(bat.events.some(e => e.channel === 'pty:output' && String(e.args[1]).includes('T0432BROADCAST'))).toBe(true), { timeout: 15_000, interval: 50 })
    expect(worker.events).toEqual([])
    await worker.close()
    registry.revokeTerminal(workerId)
  })

})

describe('logs (T0432)', () => {
  it('no part of the server token or a capability is logged; helper logs carry terminal id and role', async () => {
    const tower = await connectAs(towerToken)
    await expect(tower.invoke('fs:readdir', CWD)).rejects.toThrow('Forbidden')
    await tower.close()
    const all = logLines.join('\n')
    expect(all).toContain('[RemoteServer] Started on')
    expect(all).not.toContain('token=')
    expect(all).not.toContain(harness.token.substring(0, 8))
    expect(all).not.toContain(towerToken.substring(0, 8))
    expect(all).toContain(`Helper authenticated: role=tower terminal=${towerId}`)
    expect(all).toContain(`Helper invoke denied: channel=fs:readdir role=tower terminal=${towerId} reason=channel-not-allowed`)
  })
})

// Each harness re-registers every handler in the process-global handler registry, so the
// tests below (own servers) run after every test that uses the main harness.
describe('helper capability — separate servers (T0432)', () => {
  it('server stop clears the registry; a restarted server accepts none of the old tokens', async () => {
    const reg = new HelperCapabilityRegistry()
    const first = await startHeadlessHarness({ helperCapabilities: reg })
    const id = termId('restart')
    await first.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}) })
    const token = reg.issue(id)
    await first.dispose()
    expect(reg.size).toBe(0)

    const second = await startHeadlessHarness() // default: fresh registry
    try {
      await expect(connectHeadlessClient({ port: second.port, token, fingerprint: second.fingerprint }))
        .rejects.toThrow('Invalid token')
    } finally {
      await second.dispose()
    }
  })
  it('keypress counts only clients: with the BAT client gone, a connected helper does not count → no-client', async () => {
    const reg = new HelperCapabilityRegistry()
    const h = await startHeadlessHarness({ helperCapabilities: reg })
    try {
      const tId = termId('tower')
      await h.invoke('pty:create', { id: tId, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}) })
      const worker = await connectHeadlessClient({ port: h.port, token: reg.issue(termId('w'), { towerId: tId }), fingerprint: h.fingerprint })
      const idle = await connectHeadlessClient({ port: h.port, token: reg.issue(termId('w2'), { towerId: tId }), fingerprint: h.fingerprint })
      expect(await worker.invoke('terminal:keypress', { targetId: tId, key: 'Enter' })).toMatchObject({ ok: true, broadcastClients: 1 })
      await h.invoke('pty:kill', tId)
      await h.close() // the only BAT client leaves; two helpers stay connected
      await vi.waitFor(async () => {
        expect(await worker.invoke('terminal:keypress', { targetId: tId, key: 'Enter' })).toEqual({ ok: false, reason: 'no-client' })
      }, { timeout: 5_000, interval: 50 })
      await worker.close()
      await idle.close()
    } finally {
      await h.dispose()
    }
  })

  it('a connected helper does not hold off the orphan PTY reclaim (T0404)', async () => {
    const reg = new HelperCapabilityRegistry()
    const h = await startHeadlessHarness({ helperCapabilities: reg, ptyIdleReclaimMs: 400 })
    try {
      const id = termId('orphan')
      await h.invoke('pty:create', { id, cwd: CWD, type: 'terminal', ...(SHELL ? { shell: SHELL } : {}) })
      const token = reg.issue(id)
      const helper = await connectHeadlessClient({ port: h.port, token, fingerprint: h.fingerprint })
      await h.close() // no client left; the helper stays connected
      await vi.waitFor(() => expect(reg.verify(token)).toBeNull(), { timeout: 10_000, interval: 50 })
      const probe = await h.connect()
      expect(await probe.invoke('pty:get-cwd', id)).toBeNull() // reclaimed (killAll)
      await helper.close()
    } finally {
      await h.dispose()
    }
  })
})
