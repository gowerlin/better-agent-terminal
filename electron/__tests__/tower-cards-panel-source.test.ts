// @vitest-environment node
/**
 * PLAN-068 W3 / T0905 (T0902 §2.3 / §4): the Claude Agent panel source of the Tower turn cards —
 * `ClaudeAgentManager.setTurnResultListener` gets a session's `success` result text once per result
 * (real `processMessage`), and `TowerCardStore.offerPanelMessage` keeps it only for a panel marked as a
 * Tower (`setPanelTower`; the decision is W4's, T0902 §6′). Nothing else about the result changes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron: electron.${String(prop)}`)
  },
}))

import { ClaudeAgentManager } from '../claude-agent-manager'
import { TowerCardStore } from '../tower-cards'

type Internals = { processMessage(sessionId: string, session: unknown, message: unknown): void }

const managers: ClaudeAgentManager[] = []
afterEach(() => {
  for (const m of managers.splice(0)) { m.killAll(); m.dispose() }
})

function harness() {
  const emit = vi.fn()
  const manager = new ClaudeAgentManager({ emit, getSettings: () => ({ notifyOnComplete: false }) })
  managers.push(manager)
  const session = {
    cwd: process.cwd(),
    state: { isStreaming: true, totalCost: 0, totalTokens: 0 },
    metadata: { totalCost: 0, inputTokens: 0, outputTokens: 0, durationMs: 0, numTurns: 0, contextWindow: 0, maxOutputTokens: 0, contextTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, callCacheRead: 0, callCacheWrite: 0, lastQueryCalls: 0, lastCall: null },
    activeTasks: new Map(),
    pendingPermissions: new Map(),
    pendingAskUser: new Map(),
    messageQueue: [],
  }
  const result = (subtype: string, text?: unknown) => (manager as unknown as Internals).processMessage('panel-1', session, {
    type: 'result', subtype, num_turns: 1, total_cost_usd: 0.01, duration_ms: 1,
    ...(text !== undefined ? { result: text } : {}),
    usage: { input_tokens: 10, output_tokens: 5 },
  })
  return { manager, emit, result }
}

describe('ClaudeAgentManager.setTurnResultListener (T0905)', () => {
  it('a success result with text → the listener once; error results / blank / no listener → nothing; claude:result unchanged', () => {
    const h = harness()
    h.result('success', 'before the listener') // no listener: nothing breaks
    const calls: Array<[string, string]> = []
    h.manager.setTurnResultListener((sessionId, text) => { calls.push([sessionId, text]) })
    h.result('success', '塔台回合：完成')
    h.result('error_during_execution', 'partial')
    h.result('success', '   ')
    h.result('success')
    expect(calls).toEqual([['panel-1', '塔台回合：完成']])
    const results = h.emit.mock.calls.filter(c => c[0] === 'claude:result').map(c => c[2])
    expect(results).toHaveLength(5)
    expect(results[1]).toMatchObject({ subtype: 'success', result: '塔台回合：完成' })
    h.manager.setTurnResultListener(null)
    h.result('success', 'after removal')
    expect(calls).toHaveLength(1)
  })

  it('a throwing listener changes nothing else', () => {
    const h = harness()
    h.manager.setTurnResultListener(() => { throw new Error('boom') })
    expect(() => h.result('success', 'x')).not.toThrow()
    expect(h.emit.mock.calls.filter(c => c[0] === 'claude:result')).toHaveLength(1)
  })

  it('wired to the card store: kept only for a panel marked as a Tower', () => {
    const h = harness()
    const store = new TowerCardStore({ getTerminalRole: () => undefined, getTowerContract: () => undefined })
    h.manager.setTurnResultListener((sessionId, text) => { store.offerPanelMessage(sessionId, text) })
    h.result('success', 'not a Tower yet')
    expect(store.list(['panel-1'])[0].cards).toEqual([])
    store.setPanelTower('panel-1', true)
    h.result('success', 'panel Tower turn')
    expect(store.list(['panel-1'])[0].cards.map(c => [c.source, c.text])).toEqual([['panel', 'panel Tower turn']])
  })
})
