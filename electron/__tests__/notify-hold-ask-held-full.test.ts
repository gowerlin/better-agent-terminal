// @vitest-environment node
/**
 * T0788 Renew #1 item 2 (D228): `bat-notify --ask --submit` into a Tower whose held notifications are
 * full. The 9th `pty:write` answers `{ ok: false, reason: 'held-full' }` (the real `pty:write` handler
 * + NotifyHoldController); bat-notify's existing `--ask` failure path (`failAfterAsk`) must cancel the
 * registered question FIRST, then exit 1 with `ask: NOTIFY_STEP pty-write` — so CT, which reads exit ≠ 0
 * as "not registered" and falls back to the work order, never leaves a question the Tower could answer
 * twice. bat-notify's options and output are unchanged (contract item 10).
 *
 * The helper runs for real against the mock RemoteServer of scripts/__tests__; every reply comes from
 * the real handlers: question:ask / question:cancel / question:list from `registerTowerQuestionHandlers`,
 * pty:write from `registerPtyHandlers` with the hold controller.
 */
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { registerPtyHandlers } from '../handlers/pty'
import { NOTIFY_HOLD_MAX_PER_TARGET, NotifyHoldController, type NotifyHoldPtyManager } from '../notify-hold'
import type { PtyManager } from '../pty-manager'
import type { HandlerContext } from '../remote/handler-registry'
import { registerTowerQuestionHandlers } from '../tower-questions'
// @ts-expect-error — plain .mjs test helper (no types)
import { cleanupTempDirs, runHelper, startMockRemote } from '../../scripts/__tests__/_question-mock-remote.mjs'

afterAll(() => cleanupTempDirs())

type Handler = (ctx: HandlerContext, ...args: unknown[]) => unknown

const WORKER: HandlerContext = { windowId: null, connectionId: 'conn-worker', helper: { terminalId: 'worker-1', role: 'worker', towerId: 'tower-1' } }

function realHosts() {
  const handlers = new Map<string, Handler>()
  const register = (channel: string, handler: unknown) => { handlers.set(channel, handler as Handler) }
  registerTowerQuestionHandlers({
    registerHandler: register,
    getPtyManager: () => ({
      getTerminalInfo: (id: string) => (id === 'worker-1' ? { workorder: 'T0788' } : id === 'tower-1' ? {} : null),
      getExitedPty: () => null,
      getTerminalRole: (id: string) => (id === 'tower-1' ? 'tower' : undefined),
    }),
    isWorkerOf: (child, tower) => child === 'worker-1' && tower === 'tower-1',
    logger: { log: () => {} },
  })
  // the Tower waits at a permission prompt and already holds 8 notifications
  const pm: NotifyHoldPtyManager & { writes: string[] } = {
    writes: [],
    isAlive: id => id === 'tower-1',
    getBlockedState: () => ({ reason: 'permission', since: 1 }),
    getBlockedDetection: () => 'hook',
    writeWithResult(_id, data) { this.writes.push(data); return { ok: true } },
  }
  const hold = new NotifyHoldController({ getPtyManager: () => pm, emitKeypress: () => true, logger: { log: () => {} } })
  for (let i = 0; i < NOTIFY_HOLD_MAX_PER_TARGET; i++) {
    const ctx: HandlerContext = { windowId: null, connectionId: `c${i}`, helper: { terminalId: `w${i}`, role: 'worker', towerId: 'tower-1' } }
    expect(hold.interceptWrite(ctx, 'tower-1', `T09${i} 完成`)).toEqual({ ok: true, held: true })
  }
  registerPtyHandlers(register, { getPtyManager: () => pm as unknown as PtyManager, notifyHold: hold })
  const call = (channel: string, ...args: unknown[]) => handlers.get(channel)!(WORKER, ...args)
  return { call, pm, hold }
}

describe('bat-notify --ask --submit meets held-full (T0788 Renew #1)', () => {
  it('the question is cancelled before exit 1; stderr ask: NOTIFY_STEP pty-write; nothing more is held or written', async () => {
    const host = realHosts()
    let questionId = ''
    const order: string[] = []
    const remote = await startMockRemote({
      'question:ask': (invoke: { args: unknown[] }) => {
        const result = host.call('question:ask', ...invoke.args) as { ok: boolean; questionId?: string }
        questionId = result.questionId ?? ''
        order.push('ask')
        return { result }
      },
      'terminal:notify': () => { order.push('notify'); return { result: true } },
      'pty:write': (invoke: { args: unknown[] }) => {
        order.push('pty:write')
        return { result: host.call('pty:write', ...invoke.args) }
      },
      'question:cancel': (invoke: { args: unknown[] }) => {
        order.push('cancel')
        return { result: host.call('question:cancel', ...invoke.args) }
      },
    })
    try {
      const r = await runHelper('bat-notify.mjs', ['--ask', '--source', 'T0788', '--submit', 'T0788 提問'], remote.env, JSON.stringify({ question: 'which one?' }))
      expect(questionId).toMatch(/^q-[0-9a-f]{8}-[0-9a-f]{16}$/)
      // the real handler refused the 9th: the exact reply bat-notify got
      expect(host.call('pty:write', 'tower-1', 'probe')).toEqual({ ok: false, reason: 'held-full' })
      expect(r.code).toBe(1)
      expect(order).toEqual(['ask', 'notify', 'pty:write', 'cancel'])
      expect(remote.invokes.map((i: { channel: string }) => i.channel)).toEqual(['question:ask', 'terminal:notify', 'pty:write', 'question:cancel'])
      expect(r.stderr).toContain('ask: NOTIFY_STEP pty-write')
      expect(r.stderr.trim().split(/\r?\n/).slice(-2)).toEqual(['ask: NOTIFY_STEP pty-write', 'ask: NOTIFY_FAILED'])
      expect(r.stderr).toContain('held-full')
      expect(r.stdout).not.toContain('notified: yes')
      // the real store: the question is cancelled (by the worker), not left pending for the Tower
      const listed = host.call('question:list', { status: 'all' }) as { ok: boolean; questions: Array<{ questionId: string; status: string }> }
      expect(listed.ok).toBe(true)
      expect(listed.questions.find(q => q.questionId === questionId)?.status).toBe('cancelled')
      expect(listed.questions.filter(q => q.status === 'pending')).toEqual([])
      expect(host.hold.count('tower-1')).toBe(NOTIFY_HOLD_MAX_PER_TARGET) // the 9th was never held
      expect(host.pm.writes).toEqual([])
    } finally {
      await remote.close()
    }
  }, 30000)
})
