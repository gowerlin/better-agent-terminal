// @vitest-environment node
/**
 * T0431 (PLAN-036 P3 / K): `terminal:create-with-command` / `create-agent-command` /
 * `notify` / `keypress` online on headless, wire-level through the T0388 harness
 * (in-process headless + wss clients, real node-pty).
 *
 * Two clients: `helper` plays bat-terminal / bat-notify (the invoker), `bat` plays
 * a BAT window connected to the server (the event receiver).
 *   - create-agent-command → PTY runs the built command, `bat` gets created-externally
 *   - notify → `bat` gets terminal:notified
 *   - keypress → `bat` gets terminal:keypress; with only the invoker left → no-client
 *   - a client-supplied shell must be an absolute path to an existing file
 *
 * The agent is a custom CLI that runs `echo`, so no real agent starts.
 */
import * as os from 'os'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { agentRegistry } from '../../agent-runtime/agent-registry'
import { HEADLESS_UNSUPPORTED } from '../headless-channel-status'
import { startHeadlessHarness, type HeadlessClient, type HeadlessHarness } from './helpers/headless-harness'

const ECHO_AGENT = 't0431-echo-agent'
const CWD = os.tmpdir()

let harness: HeadlessHarness
let bat: HeadlessClient
let seq = 0
const termId = (label: string) => `t0431-${label}-${process.pid}-${seq++}`

function outputOf(client: HeadlessClient, id: string): string {
  return client.events
    .filter(e => e.channel === 'pty:output' && e.args[0] === id)
    .map(e => String(e.args[1]))
    .join('')
}

beforeAll(async () => {
  agentRegistry.registerCustomCli({ id: ECHO_AGENT, name: 'T0431 echo', icon: 'x', color: '#000', command: 'echo' })
  harness = await startHeadlessHarness()
  bat = await harness.connect()
})

afterAll(async () => {
  await harness?.dispose()
  agentRegistry.removeCustomCli(ECHO_AGENT)
})

describe('headless terminal:* (T0431)', () => {
  it('ledger: only the two codex controls are still unsupported on headless', () => {
    expect(Object.keys(HEADLESS_UNSUPPORTED).sort()).toEqual([
      'claude:set-codex-approval-policy',
      'claude:set-codex-sandbox-mode',
    ])
  })

  it('create-agent-command → PTY runs the agent command and the BAT client gets created-externally', async () => {
    const id = termId('agent')
    const result = await harness.invoke('terminal:create-agent-command', {
      id,
      cwd: CWD,
      agent: ECHO_AGENT,
      prompt: 'T0431MARK',
      workspaceId: 'client-ws-1',
      customEnv: { BAT_TOWER_TERMINAL_ID: 'tower-1' },
    })
    expect(result).toBe(true)

    const [payload] = await bat.waitForEvent('terminal:created-externally', args => (args[0] as { id?: string })?.id === id)
    expect(payload).toEqual({ id, cwd: CWD, command: 'echo T0431MARK', workspaceId: 'client-ws-1' })

    await vi.waitFor(() => expect(outputOf(bat, id)).toContain('T0431MARK'), { timeout: 15_000, interval: 50 })
    await harness.invoke('pty:kill', id)
  })

  it('create-with-command rejects a client shell that is not an absolute path to a file', async () => {
    const id = termId('bad-shell')
    expect(await harness.invoke('terminal:create-with-command', { id, cwd: CWD, command: 'echo x', shell: 'bash' })).toBe(false)
    expect(await harness.invoke('pty:get-buffer', id)).toBeNull()
  })

  it('notify → the BAT client gets terminal:notified', async () => {
    expect(await harness.invoke('terminal:notify', { targetId: 'tower-1', message: 'T0431 完成', source: 'T0431' })).toBe(true)
    const [payload] = await bat.waitForEvent('terminal:notified', args => (args[0] as { source?: string })?.source === 'T0431')
    expect(payload).toEqual({ targetId: 'tower-1', message: 'T0431 完成', source: 'T0431' })
  })

  it('keypress → the BAT client gets terminal:keypress; with only the invoker connected → no-client', async () => {
    expect(await harness.invoke('terminal:keypress', { targetId: 'tower-1', key: 'Enter', traceId: 't0431-a' }))
      .toEqual({ ok: true, broadcastWindows: 0, broadcastClients: 1 })
    const [payload] = await bat.waitForEvent('terminal:keypress', args => (args[0] as { traceId?: string })?.traceId === 't0431-a')
    expect(payload).toMatchObject({ targetId: 'tower-1', key: 'Enter', code: 'Enter', keyCode: 13 })

    await bat.close()
    await vi.waitFor(async () => {
      expect(await harness.invoke('terminal:keypress', { targetId: 'tower-1', key: 'Enter', traceId: 't0431-b' }))
        .toEqual({ ok: false, reason: 'no-client' })
    }, { timeout: 5_000, interval: 50 })
  })
})
