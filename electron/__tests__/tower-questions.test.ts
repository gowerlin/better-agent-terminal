// @vitest-environment node
/**
 * PLAN-048 / T0607 (D155 / D156; contract T0606 C-1–C-4, C-7, C-9, C-10): Worker asks its Tower
 * (electron/tower-questions.ts) on a real PtyManager (fake node-pty) + a real capability registry,
 * with a manual clock / timers injected through the deps (no vitest fake timers).
 *
 *   - ids `q-<boot>-<rand>`: another boot → `lost` (wait ok / answer NOT_FOUND / cancel ok), an
 *     unknown id of this boot → NOT_FOUND, a malformed one → INVALID_ARGS
 *   - C-2 limits and text rules → INVALID_ARGS; `\r\n` → `\n`; TOO_MANY_QUESTIONS; tower not running
 *   - masked on receipt: the store never holds the secret (known secret + pattern)
 *   - roles / binding: `authorizeHelperInvoke` rows; NOT_OWNER for another tower's / worker's
 *     question; a server-token client lists / waits but never writes
 *   - first answer wins → CLOSED; choice / text rules
 *   - expired `timeout` / `not-polled` (blocking only; an open worker wait keeps the lease; a tower
 *     wait does not); retention of ended questions
 *   - PTY end of the Worker / the Tower (kill, exit, restart), Terminal Server recovery
 *   - wait: timeout `changed: false`, an answer wakes it, dispose, TOO_MANY_WAITS
 *   - query state (C-7): blocked / tower / source question; a hook reason wins; `none` tabs too;
 *     pendingQuestions (non-blocking counted); the user's input does not clear it; wait state-change
 *   - logs (C-9): ids / lengths / counts only — never the content, never a token
 *   - a real RemoteServer with scoped capabilities: worker asks → tower lists / answers → worker's
 *     wait gets the answer; denied paths (Forbidden frames)
 */
import * as fs from 'fs'
import { createRequire } from 'module'
import * as os from 'os'
import * as path from 'path'
import WebSocket from 'ws'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('tower-questions / pty-manager must not import electron')
})
vi.mock('../remote/remote-logger', () => ({
  mirrorToBatScripts: () => {},
  pickWhitelistedEnv: () => ({}),
}))

import { logger } from '../logger'
import type { PtyManager as PtyManagerType } from '../pty-manager'
import { registerHandler, type HandlerContext } from '../remote/handler-registry'
import { authorizeHelperInvoke, HELPER_CHANNEL_ROLES, HelperCapabilityRegistry } from '../remote/helper-capability'
import type { RemoteFrame } from '../remote/protocol'
import { RemoteServer } from '../remote/remote-server'
import { registerTerminalQueryHandlers, type TerminalQueryHandlers } from '../terminal-query-handlers'
import {
  ANSWER_TEXT_MAX_CHARS,
  QUESTION_DEFAULT_EXPIRES_MS,
  QUESTION_DETAIL_MAX_CHARS,
  QUESTION_ENDED_MAX,
  QUESTION_ENDED_RETENTION_MS,
  QUESTION_ID_PATTERN,
  QUESTION_MAX_EXPIRES_MS,
  QUESTION_MAX_PENDING_PER_WORKER,
  QUESTION_OPTION_MAX_CHARS,
  QUESTION_OPTIONS_MAX,
  QUESTION_POLL_LEASE_MS,
  QUESTION_TEXT_MAX_CHARS,
  QUESTION_WAIT_MAX_MS,
  QUESTION_WAIT_MAX_PER_CALLER,
  registerTowerQuestionHandlers,
  type TowerQuestionHandlers,
} from '../tower-questions'

class FakePty {
  onData = vi.fn()
  onExit = vi.fn()
  kill = vi.fn()
  write = vi.fn()
  resize = vi.fn()
  pid = 0
}

const ptySpawn = vi.fn((_shell: string, _args: string[], _opts: unknown) => new FakePty())
const CWD = os.tmpdir()
const TAB = { cwd: CWD, type: 'terminal' as const, shell: '/bin/sh' }
const BOOT = 'aaaabbbb'
const OTHER_BOOT_ID = 'q-ccccdddd-0123456789abcdef'
const UNKNOWN_ID = `q-${BOOT}-ffffffffffffffff`
/** Fake content: none of it may reach a log line or a bat-scripts.log event. */
const QUESTION = 'QTEXT-要部署到哪個環境？'
const OPTION_A = 'OPT-ALPHA-staging'
const OPTION_B = 'OPT-BRAVO-prod'
const DETAIL = 'DETAIL-推薦 staging，影響 2 個檔案'
const ANSWER = 'ANSWER-先用 staging'
const SERVER_TOKEN = 'S'.repeat(40)
const FAKE_CAP = 'batcap.' + 'Zq7'.repeat(15)

let PtyManager: typeof PtyManagerType

beforeAll(async () => {
  const req = createRequire(path.resolve(__dirname, '..', 'pty-manager.ts'))
  const resolved = req.resolve('@lydell/node-pty')
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { spawn: ptySpawn } } as unknown as NodeJS.Module
  ;({ PtyManager } = await import('../pty-manager'))
})

let dataDir: string
const managers: PtyManagerType[] = []

beforeEach(() => {
  vi.spyOn(logger, 'log').mockImplementation(() => {})
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  ptySpawn.mockClear()
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0607-pty-'))
})

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  fs.rmSync(dataDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

/** A manual clock with timers, handed to the handlers as `now` / `setTimer` / `clearTimer`. */
function makeClock(start = 1_000_000) {
  let t = start
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number): unknown => {
      const id = ++seq
      timers.set(id, { at: t + ms, fn })
      return id
    },
    clearTimer: (handle: unknown) => { timers.delete(handle as number) },
    /** Moves the clock by `ms`, running the timers that fall due in order; then lets promises settle. */
    async advance(ms: number) {
      const end = t + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        t = Math.max(t, due[1].at)
        due[1].fn()
      }
      t = end
      await new Promise(resolve => setImmediate(resolve))
    },
    get timers() { return timers.size },
  }
}

type Result = Record<string, unknown>

/**
 * Tower `tw` with Workers `wk` (T9001) / `wk2`; tower `tw2` with Worker `wk3`; a plain shell `sh`.
 * Capabilities, PTY exit and the recovery hook wired as main.ts does.
 */
function setup(opts: { secrets?: string[] } = {}) {
  const clock = makeClock()
  const registry = new HelperCapabilityRegistry()
  const logs: string[] = []
  const mirrors: Array<[string, Record<string, unknown>]> = []
  let store: TowerQuestionHandlers | null = null
  const fakes = new Map<string, FakePty>()
  const manager = new PtyManager({
    emit: vi.fn(),
    dataDir,
    helperEnv: (id, customEnv) => {
      registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined })
      return {}
    },
    onPtyExit: id => {
      registry.revokeTerminal(id)
      store?.terminalEnded(id)
    },
    onServerRecovery: () => store?.serverRecovered(),
  })
  managers.push(manager)
  const handlers = new Map<string, (ctx: HandlerContext, ...args: unknown[]) => unknown>()
  const register = (channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown) => { handlers.set(channel, handler) }
  const timing = { now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer }
  store = registerTowerQuestionHandlers({
    registerHandler: register,
    getPtyManager: () => manager,
    isWorkerOf: (c, t) => registry.isWorkerOf(c, t),
    knownSecrets: () => opts.secrets ?? [],
    logger: { log: (...args: unknown[]) => { logs.push(args.map(String).join(' ')) } },
    mirrorToBatScripts: (event, payload) => { mirrors.push([event, payload]) },
    bootId: BOOT,
    ...timing,
  })
  const towerQuestions = store
  const queries = registerTerminalQueryHandlers({
    registerHandler: register,
    getPtyManager: () => manager,
    isWorkerOf: (c, t) => registry.isWorkerOf(c, t),
    getQuestionSummary: id => towerQuestions.summaryFor(id),
    logger: { log: () => {} },
    ...timing,
  })
  const create = (id: string, towerId?: string, workorder?: string) => {
    const before = ptySpawn.mock.results.length
    expect(manager.create({
      id,
      ...TAB,
      ...(towerId ? { customEnv: { BAT_TOWER_TERMINAL_ID: towerId, CT_MODE: 'yolo' } } : {}),
      ...(workorder ? { workorder } : {}),
    })).toBe(true)
    fakes.set(id, ptySpawn.mock.results[before].value as FakePty)
  }
  create('tw')
  create('wk', 'tw', 'T9001')
  create('wk2', 'tw')
  create('tw2')
  create('wk3', 'tw2')
  create('sh')
  const exit = (id: string, exitCode = 0) => {
    const onExit = fakes.get(id)!.onExit.mock.calls.at(-1)![0] as (e: { exitCode: number }) => void
    onExit({ exitCode })
  }
  const asHelper = (terminalId: string): HandlerContext => {
    const towerId = manager.getTerminalInfo(terminalId)?.towerTerminalId
    return { windowId: null, connectionId: `c-${terminalId}`, helper: towerId ? { terminalId, role: 'worker', towerId } : { terminalId, role: 'tower' } }
  }
  const client: HandlerContext = { windowId: null, connectionId: 'client-1' }
  const call = (channel: string, ctx: HandlerContext, ...args: unknown[]) => handlers.get(channel)!(ctx, ...args) as Result
  const callAsync = (channel: string, ctx: HandlerContext, ...args: unknown[]) => Promise.resolve(handlers.get(channel)!(ctx, ...args)) as Promise<Result>
  const ask = (worker: string, body: Record<string, unknown> = {}) =>
    call('question:ask', asHelper(worker), { question: QUESTION, options: [OPTION_A, OPTION_B], detail: DETAIL, ...body })
  const answer = (tower: string, questionId: unknown, body: Record<string, unknown> = {}) =>
    call('question:answer', asHelper(tower), { towerId: tower, questionId, ...body })
  return { clock, registry, manager, store, queries, logs, mirrors, handlers, create, exit, asHelper, client, call, callAsync, ask, answer }
}

/** Everything the module wrote to its log and bat-scripts.log. */
const written = (h: ReturnType<typeof setup>) => JSON.stringify([h.logs, h.mirrors])

describe('authorizeHelperInvoke: question channels (C-3)', () => {
  const TOWER = { terminalId: 'tw', role: 'tower' as const }
  const WORKER = { terminalId: 'wk', role: 'worker' as const, towerId: 'tw' }
  const reason = (d: { ok: boolean; reason?: string }) => d.ok ? 'ok' : d.reason

  it('the five rows', () => {
    expect(HELPER_CHANNEL_ROLES['question:ask']).toEqual(['worker'])
    expect(HELPER_CHANNEL_ROLES['question:cancel']).toEqual(['worker'])
    expect(HELPER_CHANNEL_ROLES['question:answer']).toEqual(['tower'])
    expect(HELPER_CHANNEL_ROLES['question:list']).toEqual(['tower', 'worker'])
    expect(HELPER_CHANNEL_ROLES['question:wait']).toEqual(['tower', 'worker'])
  })

  it('a worker asks / cancels with an object; a tower may not ask; a worker may not answer', () => {
    expect(reason(authorizeHelperInvoke(WORKER, 'question:ask', [{ question: 'x' }]))).toBe('ok')
    expect(reason(authorizeHelperInvoke(WORKER, 'question:ask', ['x']))).toBe('invalid-payload')
    expect(reason(authorizeHelperInvoke(WORKER, 'question:ask', []))).toBe('invalid-payload')
    expect(reason(authorizeHelperInvoke(WORKER, 'question:cancel', [{ questionId: UNKNOWN_ID }]))).toBe('ok')
    expect(reason(authorizeHelperInvoke(TOWER, 'question:ask', [{ question: 'x' }]))).toBe('role-not-allowed')
    expect(reason(authorizeHelperInvoke(TOWER, 'question:cancel', [{ questionId: UNKNOWN_ID }]))).toBe('role-not-allowed')
    expect(reason(authorizeHelperInvoke(WORKER, 'question:answer', [{ towerId: 'tw', questionId: UNKNOWN_ID }]))).toBe('role-not-allowed')
  })

  it('answer: towerId must be the caller (tower-not-bound), as terminal:close-worker', () => {
    expect(reason(authorizeHelperInvoke(TOWER, 'question:answer', [{ towerId: 'tw', questionId: UNKNOWN_ID }]))).toBe('ok')
    expect(reason(authorizeHelperInvoke(TOWER, 'question:answer', [{ towerId: 'tw2', questionId: UNKNOWN_ID }]))).toBe('tower-not-bound')
    expect(reason(authorizeHelperInvoke(TOWER, 'question:answer', [{ questionId: UNKNOWN_ID }]))).toBe('tower-not-bound')
    expect(reason(authorizeHelperInvoke(TOWER, 'question:answer', ['tw']))).toBe('invalid-payload')
  })

  it('list / wait: both roles, scoped by the handler', () => {
    for (const cap of [TOWER, WORKER]) {
      expect(reason(authorizeHelperInvoke(cap, 'question:list', [{}]))).toBe('ok')
      expect(reason(authorizeHelperInvoke(cap, 'question:wait', [{ questionId: UNKNOWN_ID }]))).toBe('ok')
    }
  })
})

describe('question:ask / list / answer / wait (C-1–C-3)', () => {
  let h: ReturnType<typeof setup>
  beforeEach(() => { h = setup() })
  afterEach(() => { h.store.dispose(); h.queries.dispose() })

  it('ask → list (tower) → answer → wait (worker): the whole round trip', async () => {
    const asked = h.ask('wk')
    expect(asked).toEqual({
      ok: true,
      questionId: expect.stringMatching(QUESTION_ID_PATTERN),
      status: 'pending',
      towerTerminalId: 'tw',
      createdAt: h.clock.now(),
      expiresAt: h.clock.now() + QUESTION_DEFAULT_EXPIRES_MS,
      masked: 0,
    })
    const id = asked.questionId as string
    expect(id.startsWith(`q-${BOOT}-`)).toBe(true)

    const listed = h.call('question:list', h.asHelper('tw'))
    expect(listed).toEqual({
      ok: true,
      questions: [{
        questionId: id,
        workerTerminalId: 'wk',
        towerTerminalId: 'tw',
        workorder: 'T9001',
        question: QUESTION,
        options: [OPTION_A, OPTION_B],
        allowFreeText: true,
        detail: DETAIL,
        blocking: true,
        status: 'pending',
        createdAt: asked.createdAt,
        expiresAt: asked.expiresAt,
      }],
    })

    const waiting = h.callAsync('question:wait', h.asHelper('wk'), { questionId: id })
    await h.clock.advance(1_000)
    const answered = h.answer('tw', id, { choice: 1, text: ANSWER })
    expect(answered).toEqual({ ok: true, questionId: id, status: 'answered', answeredAt: h.clock.now(), masked: 0 })
    expect(await waiting).toEqual({
      ok: true,
      questionId: id,
      changed: true,
      status: 'answered',
      answer: { choice: 1, text: ANSWER },
      answeredAt: answered.answeredAt,
      waitedMs: 1_000,
    })
    // the answered question is gone from the pending list, still in `all`
    expect(h.call('question:list', h.asHelper('tw'))).toEqual({ ok: true, questions: [] })
    expect(h.call('question:list', h.asHelper('tw'), { status: 'all' }).questions).toEqual([
      expect.objectContaining({ questionId: id, status: 'answered', answer: { choice: 1, text: ANSWER } }),
    ])
  })

  it('first answer wins; a later one → CLOSED with the status', () => {
    const id = h.ask('wk').questionId
    expect(h.answer('tw', id, { text: ANSWER })).toMatchObject({ ok: true })
    expect(h.answer('tw', id, { choice: 2 })).toEqual({ ok: false, code: 'CLOSED', status: 'answered' })
    expect(h.call('question:cancel', h.asHelper('wk'), { questionId: id })).toEqual({ ok: true, questionId: id, status: 'answered' })
  })

  it('cancel: own question → cancelled (worker); CLOSED for the tower afterwards', () => {
    const id = h.ask('wk').questionId
    expect(h.call('question:cancel', h.asHelper('wk'), { questionId: id })).toEqual({ ok: true, questionId: id, status: 'cancelled', endReason: 'worker' })
    expect(h.answer('tw', id, { choice: 1 })).toEqual({ ok: false, code: 'CLOSED', status: 'cancelled', endReason: 'worker' })
  })

  it('ids: another boot → lost; unknown of this boot → NOT_FOUND; malformed → INVALID_ARGS', async () => {
    expect(await h.callAsync('question:wait', h.asHelper('wk'), { questionId: OTHER_BOOT_ID }))
      .toEqual({ ok: true, questionId: OTHER_BOOT_ID, changed: true, status: 'lost', waitedMs: 0 })
    expect(h.answer('tw', OTHER_BOOT_ID, { choice: 1 })).toEqual({ ok: false, code: 'NOT_FOUND', status: 'lost' })
    expect(h.call('question:cancel', h.asHelper('wk'), { questionId: OTHER_BOOT_ID })).toEqual({ ok: true, questionId: OTHER_BOOT_ID, status: 'lost' })
    expect(await h.callAsync('question:wait', h.asHelper('wk'), { questionId: UNKNOWN_ID })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(h.answer('tw', UNKNOWN_ID, { choice: 1 })).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(h.call('question:cancel', h.asHelper('wk'), { questionId: UNKNOWN_ID })).toEqual({ ok: false, code: 'NOT_FOUND' })
    for (const bad of [undefined, 'q-1', `q-${BOOT}-XYZ`, 42]) {
      expect(await h.callAsync('question:wait', h.asHelper('wk'), { questionId: bad })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
      expect(h.answer('tw', bad, { choice: 1 })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    }
  })

  it('C-2 limits and text rules → INVALID_ARGS; `\\r\\n` → `\\n`', () => {
    const bad: Array<Record<string, unknown>> = [
      { question: '' },
      { question: '   \n ' },
      { question: 42 },
      { question: 'x'.repeat(QUESTION_TEXT_MAX_CHARS + 1) },
      { question: 'bell\u0007' },
      { question: 'esc\u001b[2J' },
      { question: 'lone\rcr' },
      { question: 'c1\u0085' },
      { options: 'a' },
      { options: Array.from({ length: QUESTION_OPTIONS_MAX + 1 }, (_, i) => `o${i}`) },
      { options: ['ok', 'x'.repeat(QUESTION_OPTION_MAX_CHARS + 1)] },
      { options: ['ok', ''] },
      { options: ['ok', 3] },
      { options: [], allowFreeText: false },
      { options: undefined, allowFreeText: false },
      { allowFreeText: 'no' },
      { detail: 'x'.repeat(QUESTION_DETAIL_MAX_CHARS + 1) },
      { detail: 'nul\u0000' },
      { blocking: 'yes' },
      { expiresInMs: 0 },
      { expiresInMs: QUESTION_MAX_EXPIRES_MS + 1 },
      { expiresInMs: 1.5 },
    ]
    for (const body of bad) expect(h.ask('wk', body), JSON.stringify(body).slice(0, 80)).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('question:ask', h.asHelper('wk'), 'just text')).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('question:list', h.asHelper('tw'))).toEqual({ ok: true, questions: [] })

    const ok = h.ask('wk', { question: 'line1\r\nline2\ttab', options: undefined, detail: '', expiresInMs: QUESTION_MAX_EXPIRES_MS, blocking: false })
    expect(ok).toMatchObject({ ok: true, expiresAt: h.clock.now() + QUESTION_MAX_EXPIRES_MS })
    const [q] = h.call('question:list', h.asHelper('wk')).questions as Result[]
    expect(q).toMatchObject({ question: 'line1\nline2\ttab', options: [], allowFreeText: true, blocking: false })
    expect(q).not.toHaveProperty('detail')
  })

  it('answer: choice / text rules', () => {
    const closed = h.ask('wk', { allowFreeText: false }).questionId
    expect(h.answer('tw', closed, { text: ANSWER })).toMatchObject({ ok: false, code: 'INVALID_ARGS' }) // choice required
    expect(h.answer('tw', closed, {})).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.answer('tw', closed, { choice: 3 })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.answer('tw', closed, { choice: 0 })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.answer('tw', closed, { choice: '1' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.answer('tw', closed, { choice: 2, text: 'x'.repeat(ANSWER_TEXT_MAX_CHARS + 1) })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.answer('tw', closed, { choice: 2, text: 'why\u0007' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.answer('tw', closed, { choice: 2, text: '理由\r\n第二行' })).toMatchObject({ ok: true })
    expect((h.call('question:list', h.asHelper('wk'), { status: 'all' }).questions as Result[])[0].answer).toEqual({ choice: 2, text: '理由\n第二行' })

    const free = h.ask('wk', { options: undefined }).questionId
    expect(h.answer('tw', free, { choice: 1 })).toMatchObject({ ok: false, code: 'INVALID_ARGS' }) // no options
    expect(h.answer('tw', free, { text: '' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.answer('tw', free, { text: ANSWER })).toMatchObject({ ok: true })
  })

  it('TOO_MANY_QUESTIONS per worker; a tower that is not running → NOT_FOUND', () => {
    for (let i = 0; i < QUESTION_MAX_PENDING_PER_WORKER; i++) expect(h.ask('wk')).toMatchObject({ ok: true })
    expect(h.ask('wk')).toMatchObject({ ok: false, code: 'TOO_MANY_QUESTIONS' })
    expect(h.ask('wk2')).toMatchObject({ ok: true }) // another worker of the same tower
    h.manager.kill('tw2')
    expect(h.ask('wk3')).toMatchObject({ ok: false, code: 'NOT_FOUND' })
  })

  it('masked on receipt: neither the known secret nor a token pattern is ever stored', () => {
    const s = setup({ secrets: [SERVER_TOKEN] })
    const asked = s.ask('wk', { question: `token ${SERVER_TOKEN}?`, options: [`use ${FAKE_CAP}`, 'no'], detail: `BAT_REMOTE_TOKEN=${SERVER_TOKEN}` })
    expect(asked).toMatchObject({ ok: true, masked: 3 })
    const answered = s.answer('tw', asked.questionId, { choice: 2, text: `it is ${FAKE_CAP}` })
    expect(answered).toMatchObject({ ok: true, masked: 1 })
    const all = JSON.stringify(s.call('question:list', s.asHelper('tw'), { status: 'all' }))
    expect(all).toContain('[REDACTED:server-token]')
    expect(all).toContain('[REDACTED:batcap]')
    expect(all).not.toContain(SERVER_TOKEN)
    expect(all).not.toContain(FAKE_CAP)
    s.store.dispose()
  })

  it('scope: NOT_OWNER for another tower / another worker; list scope per role; server-token client reads only', async () => {
    const id = h.ask('wk').questionId
    const id3 = h.ask('wk3').questionId
    // another tower answers / waits on it
    expect(h.answer('tw2', id, { choice: 1 })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await h.callAsync('question:wait', h.asHelper('tw2'), { questionId: id, timeoutMs: 0 })).toEqual({ ok: false, code: 'NOT_OWNER' })
    // another worker (same tower) cancels / waits on it
    expect(h.call('question:cancel', h.asHelper('wk2'), { questionId: id })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await h.callAsync('question:wait', h.asHelper('wk2'), { questionId: id, timeoutMs: 0 })).toEqual({ ok: false, code: 'NOT_OWNER' })
    // handler-level role / binding checks (authorizeHelperInvoke denies these before, over RemoteServer)
    expect(h.call('question:ask', h.asHelper('tw'), { question: QUESTION })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('question:answer', h.asHelper('wk'), { towerId: 'wk', questionId: id, choice: 1 })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('question:answer', h.asHelper('tw'), { towerId: 'tw2', questionId: id, choice: 1 })).toMatchObject({ ok: false, code: 'NOT_OWNER' })

    const ids = (r: Result) => (r.questions as Result[]).map(q => q.questionId)
    expect(ids(h.call('question:list', h.asHelper('tw')))).toEqual([id])
    expect(ids(h.call('question:list', h.asHelper('tw'), { terminalId: 'wk' }))).toEqual([id])
    expect(ids(h.call('question:list', h.asHelper('tw'), { terminalId: 'wk2' }))).toEqual([])
    expect(h.call('question:list', h.asHelper('tw'), { terminalId: 'wk3' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(h.call('question:list', h.asHelper('tw'), { terminalId: 'sh' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(ids(h.call('question:list', h.asHelper('tw2')))).toEqual([id3])
    expect(ids(h.call('question:list', h.asHelper('wk')))).toEqual([id])
    expect(ids(h.call('question:list', h.asHelper('wk'), { terminalId: 'tw' }))).toEqual([id]) // its tower: still its own only
    expect(ids(h.call('question:list', h.asHelper('wk2')))).toEqual([])
    expect(h.call('question:list', h.asHelper('wk'), { terminalId: 'wk2' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(h.call('question:list', h.asHelper('wk'), { status: 'open' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('question:list', h.asHelper('wk'), { terminalId: 'bad id!' })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })

    // a server-token client: lists / waits without scope, never writes (an identity is not a parameter)
    expect(ids(h.call('question:list', h.client)).sort()).toEqual([id, id3].sort())
    expect(ids(h.call('question:list', h.client, { terminalId: 'tw2' }))).toEqual([id3])
    expect(await h.callAsync('question:wait', h.client, { questionId: id, timeoutMs: 0 })).toMatchObject({ ok: true, status: 'pending', changed: false })
    expect(h.call('question:ask', h.client, { question: QUESTION })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('question:cancel', h.client, { questionId: id })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(h.call('question:answer', h.client, { towerId: 'tw', questionId: id, choice: 1 })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
  })

  it('a tower lists the questions of a Worker that has exited (ended ones with status=all)', () => {
    const id = h.ask('wk').questionId
    h.manager.kill('wk')
    expect(h.call('question:list', h.asHelper('tw'), { terminalId: 'wk', status: 'all' }).questions)
      .toEqual([expect.objectContaining({ questionId: id, status: 'cancelled', endReason: 'worker-exited' })])
  })
})

describe('lifetime (C-4)', () => {
  let h: ReturnType<typeof setup>
  beforeEach(() => { h = setup() })
  afterEach(() => { h.store.dispose(); h.queries.dispose() })

  const statusOf = (questionId: unknown) =>
    (h.call('question:list', h.client, { status: 'all' }).questions as Result[]).find(q => q.questionId === questionId)

  it('expired / timeout at expiresAt', async () => {
    // non-blocking: no lease, so only the expiry ends it
    const id = h.ask('wk', { expiresInMs: 60_000, blocking: false }).questionId
    await h.clock.advance(59_999)
    expect(statusOf(id)).toMatchObject({ status: 'pending' })
    await h.clock.advance(1)
    expect(statusOf(id)).toMatchObject({ status: 'expired', endReason: 'timeout' })
    expect(h.answer('tw', id, { choice: 1 })).toEqual({ ok: false, code: 'CLOSED', status: 'expired', endReason: 'timeout' })
    expect(h.logs).toContain(`[tower-question] end q=${id} → expired (timeout)`)
  })

  it('expired / not-polled: a blocking question nobody waited on for the lease; non-blocking ones are not leased', async () => {
    const blocking = h.ask('wk').questionId
    const loose = h.ask('wk2', { blocking: false }).questionId
    await h.clock.advance(QUESTION_POLL_LEASE_MS - 1)
    expect(statusOf(blocking)).toMatchObject({ status: 'pending' })
    // a tower wait does not extend the lease
    expect(await h.callAsync('question:wait', h.asHelper('tw'), { questionId: blocking, timeoutMs: 0 })).toMatchObject({ status: 'pending' })
    await h.clock.advance(1)
    expect(statusOf(blocking)).toMatchObject({ status: 'expired', endReason: 'not-polled' })
    expect(statusOf(loose)).toMatchObject({ status: 'pending' })
  })

  it('the asking Worker’s calls keep the lease: each wait call, and an open wait the whole time', async () => {
    const id = h.ask('wk').questionId
    await h.clock.advance(QUESTION_POLL_LEASE_MS - 1_000)
    expect(await h.callAsync('question:wait', h.asHelper('wk'), { questionId: id, timeoutMs: 0 })).toMatchObject({ status: 'pending', changed: false })
    await h.clock.advance(QUESTION_POLL_LEASE_MS - 1_000)
    expect(statusOf(id)).toMatchObject({ status: 'pending' })
    // three back-to-back 45 s waits: never not-polled
    for (let i = 0; i < 3; i++) {
      const w = h.callAsync('question:wait', h.asHelper('wk'), { questionId: id })
      await h.clock.advance(QUESTION_WAIT_MAX_MS)
      expect(await w).toMatchObject({ status: 'pending', changed: false, waitedMs: QUESTION_WAIT_MAX_MS })
    }
    expect(statusOf(id)).toMatchObject({ status: 'pending' })
  })

  it('PTY end: the Worker (kill / exit / restart) → worker-exited; the Tower → tower-exited; others untouched', () => {
    const a = h.ask('wk').questionId
    const b = h.ask('wk2').questionId
    const c = h.ask('wk3').questionId
    h.exit('wk', 1)
    expect(statusOf(a)).toMatchObject({ status: 'cancelled', endReason: 'worker-exited' })
    expect(h.manager.restart('wk2', CWD, '/bin/sh')).toBe(true)
    expect(statusOf(b)).toMatchObject({ status: 'cancelled', endReason: 'worker-exited' })
    expect(statusOf(c)).toMatchObject({ status: 'pending' })
    const d = h.ask('wk2').questionId // the restarted Worker asks again
    h.manager.kill('tw')
    expect(statusOf(d)).toMatchObject({ status: 'cancelled', endReason: 'tower-exited' })
    expect(statusOf(c)).toMatchObject({ status: 'pending' })
    h.manager.restart('tw2', CWD, '/bin/sh')
    expect(statusOf(c)).toMatchObject({ status: 'cancelled', endReason: 'tower-exited' })
  })

  it('Terminal Server recovery → every pending question cancelled (recovery)', async () => {
    const a = h.ask('wk').questionId
    const c = h.ask('wk3').questionId
    const done = h.ask('wk2').questionId
    h.answer('tw', done, { choice: 1 })
    await (h.manager as unknown as { handleServerDeath(): Promise<void> }).handleServerDeath()
    expect(statusOf(a)).toMatchObject({ status: 'cancelled', endReason: 'recovery' })
    expect(statusOf(c)).toMatchObject({ status: 'cancelled', endReason: 'recovery' })
    expect(statusOf(done)).toMatchObject({ status: 'answered' })
  })

  it('ended questions are kept for the retention, then NOT_FOUND; at most QUESTION_ENDED_MAX', async () => {
    const id = h.ask('wk').questionId
    h.answer('tw', id, { choice: 1 })
    await h.clock.advance(QUESTION_ENDED_RETENTION_MS - 1)
    expect(await h.callAsync('question:wait', h.asHelper('wk'), { questionId: id })).toMatchObject({ status: 'answered', changed: true })
    await h.clock.advance(1)
    expect(await h.callAsync('question:wait', h.asHelper('wk'), { questionId: id })).toEqual({ ok: false, code: 'NOT_FOUND' })

    const ended: unknown[] = []
    for (let i = 0; i < QUESTION_ENDED_MAX + 2; i++) {
      const q = h.ask('wk2').questionId
      h.answer('tw', q, { choice: 1 })
      ended.push(q)
      await h.clock.advance(1)
    }
    const kept = (h.call('question:list', h.client, { status: 'all' }).questions as Result[]).map(q => q.questionId)
    expect(kept).toEqual(ended.slice(2))
  })
})

describe('question:wait', () => {
  let h: ReturnType<typeof setup>
  beforeEach(() => { h = setup() })
  afterEach(() => { h.store.dispose(); h.queries.dispose() })

  it('timeout → changed false / pending; default and ceiling 45 s; timeoutMs 0 answers at once', async () => {
    const id = h.ask('wk').questionId
    expect(await h.callAsync('question:wait', h.asHelper('wk'), { questionId: id, timeoutMs: 0 })).toEqual({ ok: true, questionId: id, changed: false, status: 'pending', waitedMs: 0 })
    const w = h.callAsync('question:wait', h.asHelper('wk'), { questionId: id, timeoutMs: 999_999 })
    await h.clock.advance(QUESTION_WAIT_MAX_MS)
    expect(await w).toEqual({ ok: true, questionId: id, changed: false, status: 'pending', waitedMs: QUESTION_WAIT_MAX_MS })
    expect(await h.callAsync('question:wait', h.asHelper('wk'), { questionId: id, timeoutMs: -1 })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
  })

  it('cancel / PTY end wakes an open wait with the end reason; the tower may wait too', async () => {
    const id = h.ask('wk').questionId
    const worker = h.callAsync('question:wait', h.asHelper('wk'), { questionId: id })
    const tower = h.callAsync('question:wait', h.asHelper('tw'), { questionId: id })
    await h.clock.advance(500)
    h.call('question:cancel', h.asHelper('wk'), { questionId: id })
    expect(await worker).toMatchObject({ changed: true, status: 'cancelled', endReason: 'worker', waitedMs: 500 })
    expect(await tower).toMatchObject({ changed: true, status: 'cancelled', endReason: 'worker' })

    const id2 = h.ask('wk2').questionId
    const w2 = h.callAsync('question:wait', h.asHelper('tw'), { questionId: id2 })
    h.manager.kill('wk2')
    expect(await w2).toMatchObject({ changed: true, status: 'cancelled', endReason: 'worker-exited' })
  })

  it('TOO_MANY_WAITS per caller; dispose ends every open wait with changed false', async () => {
    const id = h.ask('wk').questionId
    const open = Array.from({ length: QUESTION_WAIT_MAX_PER_CALLER }, () => h.callAsync('question:wait', h.asHelper('tw'), { questionId: id }))
    expect(await h.callAsync('question:wait', h.asHelper('tw'), { questionId: id })).toMatchObject({ ok: false, code: 'TOO_MANY_WAITS' })
    // another caller is counted on its own
    const own = h.callAsync('question:wait', h.asHelper('wk'), { questionId: id })
    h.store.dispose()
    for (const w of [...open, own]) expect(await w).toMatchObject({ ok: true, changed: false, status: 'pending' })
  })
})

describe('query state: blocked / tower and pendingQuestions (C-7)', () => {
  let h: ReturnType<typeof setup>
  beforeEach(() => { h = setup() })
  afterEach(() => { h.store.dispose(); h.queries.dispose() })

  const state = (id: string) => h.call('terminal:get-state', h.asHelper('tw'), { terminalId: id })

  it('a blocking pending question → blocked / tower / source question; blockedSince = the oldest; pendingQuestions counts all', async () => {
    expect(state('wk')).toMatchObject({ state: 'idle', source: 'output', pendingQuestions: 0, blockedDetection: 'none' })
    h.ask('wk', { blocking: false })
    expect(state('wk')).toMatchObject({ state: 'idle', source: 'output', pendingQuestions: 1 })
    await h.clock.advance(1_000)
    const first = h.ask('wk')
    await h.clock.advance(1_000)
    h.ask('wk')
    // codex-like tab (blockedDetection none) still reads blocked / tower
    expect(state('wk')).toEqual({
      ok: true,
      terminalId: 'wk',
      state: 'blocked',
      lastOutputAt: null,
      idleMs: null,
      blockedReason: 'tower',
      blockedSince: first.createdAt,
      source: 'question',
      blockedDetection: 'none',
      agentStarted: null,
      pendingQuestions: 3,
      claudeSessionName: null, // T0642
      claudeSessionId: null,
    })
    const rows = h.call('terminal:list', h.asHelper('tw')).terminals as Result[]
    expect(rows.find(t => t.id === 'wk')).toMatchObject({ state: 'blocked', blockedReason: 'tower', pendingQuestions: 3 })
    expect(rows.find(t => t.id === 'wk2')).toMatchObject({ state: 'idle', pendingQuestions: 0 })
    // the worker itself sees it too
    expect(h.call('terminal:get-state', h.asHelper('wk'))).toMatchObject({ state: 'blocked', blockedReason: 'tower' })
  })

  it('a hook reason wins over tower; when it clears, tower shows again', () => {
    h.manager.setBlockedDetection('wk', 'hook')
    h.ask('wk')
    h.manager.reportHookEvent('wk', 'permission-request', 'Bash')
    expect(state('wk')).toMatchObject({ state: 'blocked', blockedReason: 'permission', source: 'hook', pendingQuestions: 1 })
    h.manager.reportHookEvent('wk', 'stop')
    expect(state('wk')).toMatchObject({ state: 'blocked', blockedReason: 'tower', source: 'question', blockedDetection: 'hook' })
  })

  it('the user’s input does not clear tower (a hook reason it does)', () => {
    h.manager.setBlockedDetection('wk', 'hook')
    h.ask('wk')
    h.manager.reportHookEvent('wk', 'ask-user-question')
    h.manager.noteUserInput('wk')
    expect(state('wk')).toMatchObject({ state: 'blocked', blockedReason: 'tower' })
    expect(h.manager.getBlockedState('wk')).toBeNull()
  })

  it('answered / cancelled / exited → no longer blocked; exited answers carry pendingQuestions 0', () => {
    const id = h.ask('wk').questionId
    h.answer('tw', id, { choice: 1 })
    expect(state('wk')).toMatchObject({ state: 'idle', pendingQuestions: 0 })
    h.ask('wk2')
    h.manager.kill('wk2')
    expect(state('wk2')).toMatchObject({ state: 'exited', pendingQuestions: 0 })
  })

  it('terminal:wait state-change ends when the answer arrives (blocked → idle)', async () => {
    const id = h.ask('wk').questionId
    const w = h.callAsync('terminal:wait', h.asHelper('tw'), { terminalId: 'wk', until: 'state-change' })
    await h.clock.advance(1_000)
    h.answer('tw', id, { text: ANSWER })
    await h.clock.advance(250)
    expect(await w).toMatchObject({ ok: true, changed: true, state: 'idle', pendingQuestions: 0 })
  })
})

describe('logs (C-9): ids / lengths / counts only', () => {
  it('ask / list / answer / wait / end / failures never carry the content or a token', async () => {
    const h = setup({ secrets: [SERVER_TOKEN] })
    const id = h.ask('wk', { question: `${QUESTION} ${SERVER_TOKEN}` }).questionId as string
    h.call('question:list', h.asHelper('tw'))
    h.answer('tw', id, { choice: 2, text: `${ANSWER} ${FAKE_CAP}` })
    await h.callAsync('question:wait', h.asHelper('wk'), { questionId: id })
    const id2 = h.ask('wk', { question: QUESTION, options: undefined }).questionId as string
    h.call('question:cancel', h.asHelper('wk'), { questionId: id2 })
    h.ask('wk', { question: `${QUESTION}\u0007` }) // INVALID_ARGS
    h.answer('tw2', id, { text: ANSWER }) // NOT_OWNER

    expect(h.logs).toEqual(expect.arrayContaining([
      `[tower-question] ask q=${id} worker=wk tower=tw workorder=T9001 len=${QUESTION.length + 1 + SERVER_TOKEN.length} options=2 blocking=true expires=${QUESTION_DEFAULT_EXPIRES_MS} masked=1 → ok`,
      `[tower-question] list caller=tw target=- status=pending → ok count=1`,
      `[tower-question] answer q=${id} by=tw len=${ANSWER.length + 1 + FAKE_CAP.length} choice=2 → ok`,
      `[tower-question] wait q=${id} caller=wk → answered changed=true waited=0`,
      `[tower-question] end q=${id2} → cancelled (worker)`,
      `[tower-question] cancel q=${id2} by=wk → ok status=cancelled`,
      `[tower-question] answer q=${id} by=tw2 len=${ANSWER.length} choice=- → NOT_OWNER`,
    ]))
    expect(h.logs.find(l => l.includes('INVALID_ARGS'))).toMatch(/^\[tower-question\] ask q=- worker=wk tower=tw .*→ INVALID_ARGS \(question: control characters\)$/)
    expect(h.mirrors.every(([event]) => event === 'tower-question')).toBe(true)
    expect(h.mirrors.find(([, p]) => p.action === 'ask')?.[1]).toMatchObject({ action: 'ask', q: id, worker: 'wk', tower: 'tw', options: 2, result: 'ok' })
    const all = written(h)
    for (const content of ['QTEXT', 'OPT-ALPHA', 'OPT-BRAVO', 'DETAIL-', 'ANSWER-', SERVER_TOKEN, FAKE_CAP, 'batcap.', '部署']) {
      expect(all, content).not.toContain(content)
    }
    h.store.dispose()
  })
})

// ── a real RemoteServer with scoped capabilities (the main.ts wiring) ──

describe('RemoteServer + capabilities: worker asks → tower lists / answers → worker wait gets it', () => {
  let dir: string
  let manager: PtyManagerType
  let registry: HelperCapabilityRegistry
  let server: RemoteServer
  let port: number
  let store: TowerQuestionHandlers
  let queries: TerminalQueryHandlers
  const tokens = new Map<string, string>()
  const sockets: WebSocket[] = []
  const logLines: string[] = []

  interface Conn { ws: WebSocket; frames: RemoteFrame[] }

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0607-rs-'))
    registry = new HelperCapabilityRegistry()
    manager = new PtyManager({
      emit: () => {},
      dataDir: dir,
      helperEnv: (id, customEnv) => {
        tokens.set(id, registry.issue(id, { towerId: customEnv.BAT_TOWER_TERMINAL_ID || undefined }))
        return {}
      },
      onPtyExit: id => {
        registry.revokeTerminal(id)
        store?.terminalEnded(id)
      },
    })
    manager.create({ id: 'rs-tower', ...TAB })
    manager.create({ id: 'rs-worker', ...TAB, customEnv: { BAT_TOWER_TERMINAL_ID: 'rs-tower' }, workorder: 'T9002' })
    manager.create({ id: 'rs-other', ...TAB })
    store = registerTowerQuestionHandlers({
      registerHandler,
      getPtyManager: () => manager,
      isWorkerOf: (c, t) => registry.isWorkerOf(c, t),
      knownSecrets: () => [SERVER_TOKEN],
      logger: { log: (...args: unknown[]) => { logLines.push(args.map(String).join(' ')) } },
    })
    queries = registerTerminalQueryHandlers({
      registerHandler,
      getPtyManager: () => manager,
      isWorkerOf: (c, t) => registry.isWorkerOf(c, t),
      getQuestionSummary: id => store.summaryFor(id),
      logger: { log: () => {} },
    })
    const silent = () => {}
    server = new RemoteServer({
      logger: { log: silent, warn: silent, error: silent },
      helperCapabilities: registry,
      isTerminalAlive: id => manager.isAlive(id),
      getPtyCapacity: () => manager.getCapacity(),
    })
    server.configDir = dir
    port = (await server.start(0, SERVER_TOKEN, 'localhost')).port
  })

  afterAll(() => {
    store?.dispose()
    queries?.dispose()
    for (const ws of sockets) ws.terminate()
    server?.stop()
    manager?.dispose()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  async function connect(token: string): Promise<Conn> {
    const ws = new WebSocket(`wss://127.0.0.1:${port}`, { rejectUnauthorized: false })
    sockets.push(ws)
    const conn: Conn = { ws, frames: [] }
    ws.on('error', () => {})
    ws.on('message', data => { try { conn.frames.push(JSON.parse(data.toString())) } catch { /* ignore */ } })
    await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject) })
    ws.send(JSON.stringify({ type: 'auth', id: 'auth', token, args: ['t0607'] }))
    const frame = await frameOf(conn, 'auth')
    expect(frame.error).toBeUndefined()
    return conn
  }

  function frameOf(conn: Conn, id: string, timeoutMs = 10_000): Promise<RemoteFrame> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${id}`)), timeoutMs)
      const check = () => {
        const frame = conn.frames.find(f => f.id === id)
        if (!frame) return
        clearTimeout(timer)
        conn.ws.off('message', check)
        resolve(frame)
      }
      conn.ws.on('message', check)
      check()
    })
  }

  let seq = 0
  function send(conn: Conn, channel: string, ...args: unknown[]): string {
    const id = `f-${seq++}`
    conn.ws.send(JSON.stringify({ type: 'invoke', id, channel, args }))
    return id
  }
  const invokeFrame = async (conn: Conn, channel: string, ...args: unknown[]) => frameOf(conn, send(conn, channel, ...args))
  const invoke = async (conn: Conn, channel: string, ...args: unknown[]) => (await invokeFrame(conn, channel, ...args)).result as Result

  it('round trip with each PTY’s own capability; blocked / tower while it waits', async () => {
    const worker = await connect(tokens.get('rs-worker')!)
    const tower = await connect(tokens.get('rs-tower')!)

    const asked = await invoke(worker, 'question:ask', { question: QUESTION, options: [OPTION_A, OPTION_B], detail: `${DETAIL} ${SERVER_TOKEN}` })
    expect(asked).toMatchObject({ ok: true, status: 'pending', towerTerminalId: 'rs-tower', masked: 1 })
    const id = asked.questionId as string

    const listed = await invoke(tower, 'question:list', { terminalId: 'rs-worker' })
    expect(listed).toMatchObject({ ok: true, questions: [{ questionId: id, workerTerminalId: 'rs-worker', workorder: 'T9002', question: QUESTION, options: [OPTION_A, OPTION_B] }] })
    expect(JSON.stringify(listed)).not.toContain(SERVER_TOKEN)

    expect(await invoke(tower, 'terminal:get-state', { terminalId: 'rs-worker' })).toMatchObject({
      ok: true, state: 'blocked', blockedReason: 'tower', source: 'question', pendingQuestions: 1,
    })

    const waitId = send(worker, 'question:wait', { questionId: id, timeoutMs: 20_000 })
    // a long wait does not hold up the other connection
    const answered = await invoke(tower, 'question:answer', { towerId: 'rs-tower', questionId: id, choice: 1, text: ANSWER })
    expect(answered).toMatchObject({ ok: true, questionId: id, status: 'answered' })
    const waited = (await frameOf(worker, waitId)).result as Result
    expect(waited).toMatchObject({ ok: true, questionId: id, changed: true, status: 'answered', answer: { choice: 1, text: ANSWER } })
    expect(waited.waitedMs as number).toBeLessThan(5_000)

    expect(await invoke(tower, 'terminal:get-state', { terminalId: 'rs-worker' })).toMatchObject({ ok: true, state: 'idle', pendingQuestions: 0 })
    expect(await invoke(tower, 'question:answer', { towerId: 'rs-tower', questionId: id, choice: 2 })).toEqual({ ok: false, code: 'CLOSED', status: 'answered' })
    expect(logLines.join('\n')).not.toMatch(/QTEXT|OPT-|DETAIL-|ANSWER-|SSSSSSSS|batcap\./)
  })

  it('denied: a worker cannot answer, a tower cannot ask, a tower answers as itself only, another tab → NOT_OWNER', async () => {
    const worker = await connect(tokens.get('rs-worker')!)
    const tower = await connect(tokens.get('rs-tower')!)
    const other = await connect(tokens.get('rs-other')!)
    const id = (await invoke(worker, 'question:ask', { question: QUESTION })).questionId as string

    expect((await invokeFrame(worker, 'question:answer', { towerId: 'rs-tower', questionId: id, choice: 1 })).error).toMatch(/Forbidden: role-not-allowed/)
    expect((await invokeFrame(tower, 'question:ask', { question: QUESTION })).error).toMatch(/Forbidden: role-not-allowed/)
    expect((await invokeFrame(tower, 'question:answer', { towerId: 'rs-other', questionId: id, text: ANSWER })).error).toMatch(/Forbidden: tower-not-bound/)
    // rs-other is a tower capability too, but the question was not sent to it
    expect(await invoke(other, 'question:answer', { towerId: 'rs-other', questionId: id, text: ANSWER })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await invoke(other, 'question:wait', { questionId: id, timeoutMs: 0 })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await invoke(other, 'question:list', { terminalId: 'rs-worker' })).toEqual({ ok: false, code: 'NOT_OWNER' })
    expect(await invoke(other, 'question:list')).toEqual({ ok: true, questions: [] })
    // a server-token client may read, never write
    const client = await connect(SERVER_TOKEN)
    expect(await invoke(client, 'question:ask', { question: QUESTION })).toMatchObject({ ok: false, code: 'INVALID_ARGS' })
    expect(await invoke(client, 'question:list', { terminalId: 'rs-worker' })).toMatchObject({ ok: true, questions: [{ questionId: id }] })
    // the Worker's tab closes → cancelled (worker-exited); the tower's answer → CLOSED
    manager.kill('rs-worker')
    expect(await invoke(tower, 'question:answer', { towerId: 'rs-tower', questionId: id, text: ANSWER }))
      .toEqual({ ok: false, code: 'CLOSED', status: 'cancelled', endReason: 'worker-exited' })
  })
})
