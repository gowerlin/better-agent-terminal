/**
 * PLAN-048 / T0607 (D155 / D156; contract T0606 C-1–C-4, C-7, C-9, C-10): a yolo Worker asks its
 * Tower a question and waits for the answer, over the RemoteServer, with its PTY capability:
 *
 *   question:ask     worker  { question, options?, allowFreeText?, detail?, blocking?, expiresInMs? }
 *   question:cancel  worker  { questionId }                        → only its own questions
 *   question:answer  tower   { towerId, questionId, choice?, text? } → only questions sent to it
 *   question:list    both    { terminalId?, status?: 'pending' | 'all' }
 *   question:wait    both    { questionId, timeoutMs? }            → long poll (≤ 45 s) until it ends
 *
 * Every answer is `{ ok: true, … }` or `{ ok: false, code, message? }` (INVALID_ARGS / NOT_FOUND /
 * NOT_OWNER / TOO_MANY_QUESTIONS / TOO_MANY_WAITS / CLOSED). The caller is the capability the
 * invoke came in with (`ctx.helper`); `authorizeHelperInvoke` binds `question:answer`'s `towerId`
 * to it (electron/remote/helper-capability.ts). A server-token client may list / wait (no scope)
 * but never write (INVALID_ARGS: an identity is never a parameter).
 *
 * 🔴 D155: questions, options, details and answers live in this process's memory only — never
 * written to any file — and are masked (`redactTerminalSecrets`) before they are stored. The
 * `[tower-question]` log lines and the bat-scripts.log `tower-question` events carry ids, lengths,
 * counts and results only: never the content, never a token.
 *
 * Ids are `q-<boot>-<rand>`; `<boot>` is this process's (`registerTowerQuestionHandlers` runs
 * once per process), so an id from an earlier BAT / headless server answers `lost`.
 *
 * Lifetime (C-4): answered (first answer wins, then CLOSED) / cancelled (`worker`, `worker-exited`,
 * `tower-exited`, `recovery`) / expired (`timeout`, `not-polled`: a blocking question nobody
 * waited on for `QUESTION_POLL_LEASE_MS`). The user's input into the Worker's tab changes nothing.
 * Expiry is evaluated on every access (no timers); ended questions are kept
 * `QUESTION_ENDED_RETENTION_MS` / `QUESTION_ENDED_MAX` so a late query still gets their status.
 *
 * `summaryFor` feeds `terminal:get-state` / `list` / `wait` (`blocked` / `tower`,
 * `pendingQuestions`; electron/terminal-query-handlers.ts).
 *
 * Electron main and headless bat-server register this same module (T0579 pattern).
 * 🔴 No `electron` import here (shared with headless).
 */
import { randomBytes } from 'crypto'
import { redactTerminalSecrets } from '../src/lib/terminal-output-redaction'
import type { HandlerContext } from './remote/handler-registry'
import { authorizeHelperQueryTarget, type HelperCapability } from './remote/helper-capability'

// C-2 (constants; no Settings switch)
export const QUESTION_TEXT_MAX_CHARS = 4_000
export const QUESTION_DETAIL_MAX_CHARS = 8_000
export const QUESTION_OPTIONS_MAX = 10
export const QUESTION_OPTION_MAX_CHARS = 500
export const ANSWER_TEXT_MAX_CHARS = 8_000
export const QUESTION_MAX_PENDING_PER_WORKER = 8
export const QUESTION_MAX_PENDING_PER_TOWER = 64
export const QUESTION_DEFAULT_EXPIRES_MS = 1_800_000
export const QUESTION_MAX_EXPIRES_MS = 7_200_000
export const QUESTION_POLL_LEASE_MS = 120_000
export const QUESTION_WAIT_MAX_MS = 45_000
export const QUESTION_WAIT_MAX_PER_CALLER = 8
export const QUESTION_ENDED_RETENTION_MS = 600_000
export const QUESTION_ENDED_MAX = 64
/** How often an open `question:wait` looks again (an answer / cancel wakes it at once). */
export const QUESTION_WAIT_POLL_MS = 250

export const QUESTION_ID_PATTERN = /^q-[0-9a-f]{8}-[0-9a-f]{16}$/

export type QuestionStatus = 'pending' | 'answered' | 'cancelled' | 'expired'
/** What a query answers: + `lost` (the id belongs to an earlier BAT process). */
export type QuestionReportedStatus = QuestionStatus | 'lost'
export type QuestionEndReason = 'worker' | 'worker-exited' | 'tower-exited' | 'recovery' | 'timeout' | 'not-polled'
export type TowerQuestionErrorCode =
  | 'INVALID_ARGS'
  | 'NOT_FOUND'
  | 'NOT_OWNER'
  | 'TOO_MANY_QUESTIONS'
  | 'TOO_MANY_WAITS'
  | 'CLOSED'
export type TowerQuestionFailure = {
  ok: false
  code: TowerQuestionErrorCode
  message?: string
  status?: QuestionReportedStatus
  endReason?: QuestionEndReason
}

export interface QuestionAnswer {
  /** 1-based index into `options`. */
  choice?: number
  text: string
}

interface QuestionRecord {
  id: string
  workerId: string
  towerId: string
  workorder?: string
  question: string
  options: string[]
  allowFreeText: boolean
  detail?: string
  blocking: boolean
  createdAt: number
  expiresAt: number
  lastPolledAt: number
  status: QuestionStatus
  endReason?: QuestionEndReason
  endedAt?: number
  answer?: QuestionAnswer
  answeredAt?: number
}

/** What the handlers need from PtyManager (the class satisfies it). */
export interface TowerQuestionPtyManager {
  getTerminalInfo(id: string): { workorder?: string } | null
  getExitedPty(id: string): { towerTerminalId?: string } | null
  getTerminalRole(id: string): 'tower' | undefined
}

export interface TowerQuestionDeps {
  registerHandler(channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown): void
  getPtyManager(): TowerQuestionPtyManager | null
  /** The capability registry's `isWorkerOf` (a running Worker of that tower). */
  isWorkerOf(childId: string, towerId: string): boolean
  /** Secrets masked literally on receipt (the RemoteServer token). */
  knownSecrets?(): readonly string[]
  logger: { log(...args: unknown[]): void }
  mirrorToBatScripts?(event: string, payload: Record<string, unknown>): void
  /** Tests. Default: 8 random hex chars. */
  bootId?: string
  /** Tests. Default `Date.now` / `setTimeout` / `clearTimeout` / `crypto.randomBytes` hex. */
  now?(): number
  setTimer?(fn: () => void, ms: number): unknown
  clearTimer?(handle: unknown): void
  randomHex?(bytes: number): string
}

/** `terminal:get-state` / `list` / `wait` of Worker `id` (C-7). */
export interface QuestionSummary {
  /** Pending questions of this Worker, blocking or not (`pendingQuestions`). */
  pending: number
  /** `createdAt` of its oldest pending blocking question; null = not `blocked` / `tower`. */
  blockingSince: number | null
}

export interface TowerQuestionHandlers {
  summaryFor(workerId: string): QuestionSummary
  /** A PTY ended (exit / kill, so `pty:restart` too): its questions, asked or received, are cancelled. */
  terminalEnded(id: string): void
  /** Electron: the Terminal Server recovery — every pending question is cancelled. */
  serverRecovered(): void
  /** Ends every open `question:wait` (answers `changed: false`); server stop / app quit. */
  dispose(): void
}

// `\n` and `\t` are allowed; every other C0, DEL and C1 control is refused (after `\r\n` → `\n`)
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/
const TERMINAL_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
}

function callerOf(ctx: HandlerContext): HelperCapability | null {
  const h = ctx.helper
  if (!h) return null
  return h.towerId ? { terminalId: h.terminalId, role: h.role, towerId: h.towerId } : { terminalId: h.terminalId, role: h.role }
}

/** Text as received: `\r\n` → `\n`; null = has a forbidden control character. */
function normalizeText(text: string): string | null {
  const out = text.replace(/\r\n/g, '\n')
  return FORBIDDEN_CONTROL.test(out) ? null : out
}

type TextCheck = { ok: true; text: string } | { ok: false; message: string }

/** A required / optional text field: string, allowed characters, at most `max` chars. */
function checkText(value: unknown, field: string, max: number): TextCheck {
  if (typeof value !== 'string') return { ok: false, message: field }
  const text = normalizeText(value)
  if (text === null) return { ok: false, message: `${field}: control characters` }
  if (text.length > max) return { ok: false, message: `${field}: more than ${max} chars` }
  return { ok: true, text }
}

const isAbsent = (value: unknown): boolean => value === undefined || value === null

/**
 * Registers the five channels on `deps.registerHandler` (Electron main / headless alike).
 */
export function registerTowerQuestionHandlers(deps: TowerQuestionDeps): TowerQuestionHandlers {
  const now = deps.now ?? (() => Date.now())
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  const randomHex = deps.randomHex ?? ((bytes: number) => randomBytes(bytes).toString('hex'))
  const bootId = deps.bootId ?? randomHex(4)
  /** Every question of this process, oldest first. */
  const questions = new Map<string, QuestionRecord>()
  /** Open waits: caller key → count; every open wait's finisher (dispose) and waker (a change). */
  const waitsByCaller = new Map<string, number>()
  const openWaits = new Map<() => void, () => void>()
  /** Question id → open `question:wait`s of the Worker that asked it (they keep its lease). */
  const workerWaits = new Map<string, number>()

  const callerLabel = (ctx: HandlerContext): string =>
    ctx.helper ? ctx.helper.terminalId : ctx.connectionId ? `client:${ctx.connectionId}` : 'local'

  /** One `[tower-question]` line + the bat-scripts.log event. Ids, numbers and results only. */
  const log = (action: string, fields: Record<string, string | number | boolean>, result: string): void => {
    const text = Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(' ')
    deps.logger.log(`[tower-question] ${action}${text ? ` ${text}` : ''} → ${result}`)
    deps.mirrorToBatScripts?.('tower-question', { action, ...fields, result })
  }

  const failure = (code: TowerQuestionErrorCode, message?: string, extra: Partial<TowerQuestionFailure> = {}): TowerQuestionFailure => ({
    ok: false,
    code,
    ...(message ? { message } : {}),
    ...extra,
  })

  const resultOf = (f: TowerQuestionFailure): string => f.message ? `${f.code} (${f.message})` : f.code

  const secrets = (): readonly string[] => {
    try {
      return deps.knownSecrets?.() ?? []
    } catch {
      return [] // masked by pattern only
    }
  }

  const wakeWaits = (): void => {
    for (const wake of [...openWaits.values()]) wake()
  }

  /** Ends pending question `q` (cancelled / expired), logs it, wakes its waits. */
  const end = (q: QuestionRecord, status: 'cancelled' | 'expired', reason: QuestionEndReason, at: number): void => {
    q.status = status
    q.endReason = reason
    q.endedAt = at
    log('end', { q: q.id }, `${status} (${reason})`)
  }

  /** Expires what is due, forgets ended questions past their retention. Every access runs it. */
  const sweep = (): void => {
    const t = now()
    let changed = false
    for (const q of questions.values()) {
      if (q.status !== 'pending') continue
      if (t >= q.expiresAt) {
        end(q, 'expired', 'timeout', t)
        changed = true
      } else if (q.blocking && !workerWaits.has(q.id) && t - q.lastPolledAt >= QUESTION_POLL_LEASE_MS) {
        end(q, 'expired', 'not-polled', t)
        changed = true
      }
    }
    const ended = [...questions.values()].filter(q => q.status !== 'pending').sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0))
    for (const [i, q] of ended.entries()) {
      if (t - (q.endedAt ?? 0) >= QUESTION_ENDED_RETENTION_MS || ended.length - i > QUESTION_ENDED_MAX) questions.delete(q.id)
    }
    if (changed) wakeWaits()
  }

  /** The record of `id`, `lost` (another process's id), or null (unknown / forgotten). */
  const lookup = (id: string): QuestionRecord | 'lost' | null => {
    sweep()
    if (id.slice(2, 10) !== bootId) return 'lost'
    return questions.get(id) ?? null
  }

  const view = (q: QuestionRecord) => ({
    questionId: q.id,
    workerTerminalId: q.workerId,
    towerTerminalId: q.towerId,
    ...(q.workorder ? { workorder: q.workorder } : {}),
    question: q.question,
    options: [...q.options],
    allowFreeText: q.allowFreeText,
    ...(q.detail !== undefined ? { detail: q.detail } : {}),
    blocking: q.blocking,
    status: q.status,
    ...(q.endReason ? { endReason: q.endReason } : {}),
    createdAt: q.createdAt,
    expiresAt: q.expiresAt,
    ...(q.answer ? { answer: { ...q.answer } } : {}),
    ...(q.answeredAt !== undefined ? { answeredAt: q.answeredAt } : {}),
  })

  const outcome = (q: QuestionRecord) => ({
    status: q.status,
    ...(q.endReason ? { endReason: q.endReason } : {}),
    ...(q.answer ? { answer: { ...q.answer } } : {}),
    ...(q.answeredAt !== undefined ? { answeredAt: q.answeredAt } : {}),
  })

  const questionIdOf = (opts: Record<string, unknown> | null): string | null =>
    opts && typeof opts.questionId === 'string' && QUESTION_ID_PATTERN.test(opts.questionId) ? opts.questionId : null

  // literal channel names: the IPC binding guards scan for them (proxied-channels-binding.test.ts)
  deps.registerHandler('question:ask', (ctx: HandlerContext, raw?: unknown) => {
    const caller = callerOf(ctx)
    const who = callerLabel(ctx)
    // C-9 field order; '-' until known
    const fields: Record<string, string | number | boolean> = {
      q: '-', worker: who, tower: caller?.towerId ?? '-', workorder: '-', len: '-', options: '-', blocking: '-', expires: '-', masked: '-',
    }
    const fail = (f: TowerQuestionFailure): TowerQuestionFailure => {
      log('ask', fields, resultOf(f))
      return f
    }
    if (!caller || caller.role !== 'worker' || !caller.towerId) {
      return fail(failure('INVALID_ARGS', 'a worker capability is required (the target is its tower)'))
    }
    const opts = asRecord(raw)
    if (!opts) return fail(failure('INVALID_ARGS'))
    const question = checkText(opts.question, 'question', QUESTION_TEXT_MAX_CHARS)
    if (!question.ok) return fail(failure('INVALID_ARGS', question.message))
    if (question.text.trim() === '') return fail(failure('INVALID_ARGS', 'question: empty'))
    fields.len = question.text.length
    const options: string[] = []
    if (!isAbsent(opts.options)) {
      if (!Array.isArray(opts.options) || opts.options.length > QUESTION_OPTIONS_MAX) {
        return fail(failure('INVALID_ARGS', `options: an array of at most ${QUESTION_OPTIONS_MAX}`))
      }
      for (const option of opts.options as unknown[]) {
        const checked = checkText(option, 'options', QUESTION_OPTION_MAX_CHARS)
        if (!checked.ok) return fail(failure('INVALID_ARGS', checked.message))
        if (checked.text.trim() === '') return fail(failure('INVALID_ARGS', 'options: empty'))
        options.push(checked.text)
      }
    }
    fields.options = options.length
    if (!isAbsent(opts.allowFreeText) && typeof opts.allowFreeText !== 'boolean') return fail(failure('INVALID_ARGS', 'allowFreeText'))
    const allowFreeText = opts.allowFreeText !== false
    if (!allowFreeText && options.length === 0) return fail(failure('INVALID_ARGS', 'allowFreeText: false needs options'))
    let detail: string | undefined
    if (!isAbsent(opts.detail)) {
      const checked = checkText(opts.detail, 'detail', QUESTION_DETAIL_MAX_CHARS)
      if (!checked.ok) return fail(failure('INVALID_ARGS', checked.message))
      if (checked.text !== '') detail = checked.text
    }
    if (!isAbsent(opts.blocking) && typeof opts.blocking !== 'boolean') return fail(failure('INVALID_ARGS', 'blocking'))
    const blocking = opts.blocking !== false
    fields.blocking = blocking
    let expiresInMs = QUESTION_DEFAULT_EXPIRES_MS
    if (!isAbsent(opts.expiresInMs)) {
      const v = opts.expiresInMs
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > QUESTION_MAX_EXPIRES_MS) {
        return fail(failure('INVALID_ARGS', `expiresInMs: 1-${QUESTION_MAX_EXPIRES_MS}`))
      }
      expiresInMs = v
    }
    fields.expires = expiresInMs
    const pm = deps.getPtyManager()
    if (!pm || !pm.getTerminalInfo(caller.towerId)) return fail(failure('NOT_FOUND', 'the tower terminal is not running'))
    const workorder = pm.getTerminalInfo(caller.terminalId)?.workorder
    fields.workorder = workorder ?? '-'
    sweep()
    let pendingOfWorker = 0
    let pendingOfTower = 0
    for (const q of questions.values()) {
      if (q.status !== 'pending') continue
      if (q.workerId === caller.terminalId) pendingOfWorker++
      if (q.towerId === caller.towerId) pendingOfTower++
    }
    if (pendingOfWorker >= QUESTION_MAX_PENDING_PER_WORKER) {
      return fail(failure('TOO_MANY_QUESTIONS', `at most ${QUESTION_MAX_PENDING_PER_WORKER} pending questions per worker`))
    }
    if (pendingOfTower >= QUESTION_MAX_PENDING_PER_TOWER) {
      return fail(failure('TOO_MANY_QUESTIONS', `at most ${QUESTION_MAX_PENDING_PER_TOWER} pending questions per tower`))
    }
    // D155: masked before it is stored — the store never holds the unmasked text
    const known = secrets()
    let masked = 0
    const mask = (text: string): string => {
      const r = redactTerminalSecrets(text, known)
      masked += r.count
      return r.text
    }
    const createdAt = now()
    let id = `q-${bootId}-${randomHex(8)}`
    while (questions.has(id)) id = `q-${bootId}-${randomHex(8)}`
    const record: QuestionRecord = {
      id,
      workerId: caller.terminalId,
      towerId: caller.towerId,
      ...(workorder ? { workorder } : {}),
      question: mask(question.text),
      options: options.map(mask),
      allowFreeText,
      ...(detail !== undefined ? { detail: mask(detail) } : {}),
      blocking,
      createdAt,
      expiresAt: createdAt + expiresInMs,
      lastPolledAt: createdAt, // asking counts as a poll
      status: 'pending',
    }
    questions.set(id, record)
    fields.q = id
    fields.masked = masked
    log('ask', fields, 'ok')
    return { ok: true, questionId: id, status: 'pending', towerTerminalId: record.towerId, createdAt, expiresAt: record.expiresAt, masked }
  })

  deps.registerHandler('question:cancel', (ctx: HandlerContext, raw?: unknown) => {
    const caller = callerOf(ctx)
    const opts = asRecord(raw)
    const id = questionIdOf(opts)
    const fields = { q: id ?? '-', by: callerLabel(ctx) }
    const fail = (f: TowerQuestionFailure): TowerQuestionFailure => {
      log('cancel', fields, resultOf(f))
      return f
    }
    if (!caller || caller.role !== 'worker') return fail(failure('INVALID_ARGS', 'a worker capability is required'))
    if (!id) return fail(failure('INVALID_ARGS', 'questionId'))
    const q = lookup(id)
    if (q === 'lost') {
      // an earlier process's question is gone already (not an error, as an ended one)
      log('cancel', fields, 'ok status=lost')
      return { ok: true, questionId: id, status: 'lost' }
    }
    if (!q) return fail(failure('NOT_FOUND'))
    if (q.workerId !== caller.terminalId) return fail(failure('NOT_OWNER'))
    if (q.status === 'pending') {
      end(q, 'cancelled', 'worker', now())
      wakeWaits()
    }
    log('cancel', fields, `ok status=${q.status}`)
    return { ok: true, questionId: id, status: q.status, ...(q.endReason ? { endReason: q.endReason } : {}) }
  })

  deps.registerHandler('question:answer', (ctx: HandlerContext, raw?: unknown) => {
    const caller = callerOf(ctx)
    const opts = asRecord(raw)
    const id = questionIdOf(opts)
    const fields: Record<string, string | number | boolean> = { q: id ?? '-', by: callerLabel(ctx), len: 0, choice: '-' }
    const fail = (f: TowerQuestionFailure): TowerQuestionFailure => {
      log('answer', fields, resultOf(f))
      return f
    }
    if (!caller || caller.role !== 'tower') return fail(failure('INVALID_ARGS', 'a tower capability is required'))
    if (!opts) return fail(failure('INVALID_ARGS'))
    // authorizeHelperInvoke binds it already (tower-not-bound); kept for callers that skip it
    if (opts.towerId !== caller.terminalId) return fail(failure('NOT_OWNER', 'towerId'))
    if (!id) return fail(failure('INVALID_ARGS', 'questionId'))
    let text: string | undefined
    if (!isAbsent(opts.text)) {
      const checked = checkText(opts.text, 'text', ANSWER_TEXT_MAX_CHARS)
      if (!checked.ok) return fail(failure('INVALID_ARGS', checked.message))
      if (checked.text !== '') text = checked.text
    }
    fields.len = text?.length ?? 0
    let choice: number | undefined
    if (!isAbsent(opts.choice)) {
      if (typeof opts.choice !== 'number' || !Number.isInteger(opts.choice) || opts.choice < 1) return fail(failure('INVALID_ARGS', 'choice'))
      choice = opts.choice
      fields.choice = choice
    }
    const q = lookup(id)
    if (q === 'lost') return fail(failure('NOT_FOUND', undefined, { status: 'lost' }))
    if (!q) return fail(failure('NOT_FOUND'))
    if (q.towerId !== caller.terminalId) return fail(failure('NOT_OWNER'))
    if (q.status !== 'pending') return fail(failure('CLOSED', undefined, { status: q.status, ...(q.endReason ? { endReason: q.endReason } : {}) }))
    if (choice !== undefined && choice > q.options.length) return fail(failure('INVALID_ARGS', 'choice: out of range'))
    if (choice === undefined && text === undefined) return fail(failure('INVALID_ARGS', 'choice or text is required'))
    if (choice === undefined && !q.allowFreeText) return fail(failure('INVALID_ARGS', 'choice is required (no free text)'))
    const r = text === undefined ? { text: '', count: 0 } : redactTerminalSecrets(text, secrets())
    const answeredAt = now()
    q.status = 'answered'
    q.answer = { ...(choice !== undefined ? { choice } : {}), text: r.text }
    q.answeredAt = answeredAt
    q.endedAt = answeredAt
    log('answer', fields, 'ok')
    wakeWaits()
    return { ok: true, questionId: id, status: 'answered', answeredAt, masked: r.count }
  })

  deps.registerHandler('question:list', (ctx: HandlerContext, raw?: unknown) => {
    const caller = callerOf(ctx)
    const opts = isAbsent(raw) ? {} : asRecord(raw)
    const fields: Record<string, string | number | boolean> = { caller: callerLabel(ctx), target: '-', status: 'pending' }
    const fail = (f: TowerQuestionFailure): TowerQuestionFailure => {
      log('list', fields, resultOf(f))
      return f
    }
    if (!opts) return fail(failure('INVALID_ARGS'))
    const which = isAbsent(opts.status) ? 'pending' : opts.status
    if (which !== 'pending' && which !== 'all') return fail(failure('INVALID_ARGS', 'status'))
    fields.status = which
    let target: string | undefined
    if (!isAbsent(opts.terminalId)) {
      if (typeof opts.terminalId !== 'string' || !TERMINAL_ID_PATTERN.test(opts.terminalId.trim())) return fail(failure('INVALID_ARGS', 'terminalId'))
      target = opts.terminalId.trim()
      fields.target = target
    }
    sweep()
    let match: (q: QuestionRecord) => boolean
    if (!caller) {
      match = q => target === undefined || q.workerId === target || q.towerId === target
    } else if (caller.role === 'worker') {
      // its own questions; naming its tower (metadata scope) lists the same ones
      if (target !== undefined && target !== caller.terminalId && target !== caller.towerId) return fail(failure('NOT_OWNER'))
      match = q => q.workerId === caller.terminalId
    } else {
      if (target !== undefined && target !== caller.terminalId) {
        const pm = deps.getPtyManager()
        const isMine = (pm !== null && authorizeHelperQueryTarget(caller, target, 'metadata', {
          isWorkerOf: (childId, towerId) => pm.getTerminalInfo(childId)
            ? deps.isWorkerOf(childId, towerId)
            : pm.getExitedPty(childId)?.towerTerminalId === towerId && childId !== towerId,
          getTerminalRole: id => pm.getTerminalRole(id),
        }).ok) || [...questions.values()].some(q => q.workerId === target && q.towerId === caller.terminalId)
        if (!isMine) return fail(failure('NOT_OWNER'))
      }
      match = q => q.towerId === caller.terminalId && (target === undefined || target === caller.terminalId || q.workerId === target)
    }
    const list = [...questions.values()]
      .filter(q => match(q) && (which === 'all' || q.status === 'pending'))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(view)
    log('list', fields, `ok count=${list.length}`)
    return { ok: true, questions: list }
  })

  deps.registerHandler('question:wait', (ctx: HandlerContext, raw?: unknown) => {
    const caller = callerOf(ctx)
    const key = callerLabel(ctx)
    const opts = asRecord(raw)
    const id = questionIdOf(opts)
    const fields = { q: id ?? '-', caller: key }
    const fail = (f: TowerQuestionFailure): TowerQuestionFailure => {
      log('wait', fields, resultOf(f))
      return f
    }
    if (!opts) return fail(failure('INVALID_ARGS'))
    if (!id) return fail(failure('INVALID_ARGS', 'questionId'))
    let timeoutMs = QUESTION_WAIT_MAX_MS
    if (!isAbsent(opts.timeoutMs)) {
      if (typeof opts.timeoutMs !== 'number' || !Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 0) return fail(failure('INVALID_ARGS', 'timeoutMs'))
      timeoutMs = Math.min(Math.floor(opts.timeoutMs), QUESTION_WAIT_MAX_MS)
    }
    const q = lookup(id)
    const startedAt = now()
    if (q === 'lost') {
      log('wait', fields, 'lost changed=true waited=0')
      return { ok: true, questionId: id, changed: true, status: 'lost', waitedMs: 0 }
    }
    if (!q) return fail(failure('NOT_FOUND'))
    if (caller && (caller.role === 'worker' ? q.workerId : q.towerId) !== caller.terminalId) return fail(failure('NOT_OWNER'))
    // only the asking Worker's waits keep a question's lease
    const asker = caller?.role === 'worker'
    if (asker) q.lastPolledAt = startedAt
    const answer = (changed: boolean) => {
      const waitedMs = Math.max(0, now() - startedAt)
      log('wait', fields, `${q.status} changed=${changed} waited=${waitedMs}`)
      return { ok: true as const, questionId: id, changed, ...outcome(q), waitedMs }
    }
    if (q.status !== 'pending') return answer(true)
    if (timeoutMs === 0) return answer(false)
    const open = waitsByCaller.get(key) ?? 0
    if (open >= QUESTION_WAIT_MAX_PER_CALLER) return fail(failure('TOO_MANY_WAITS', `at most ${QUESTION_WAIT_MAX_PER_CALLER} open waits per caller`))

    waitsByCaller.set(key, open + 1)
    if (asker) workerWaits.set(id, (workerWaits.get(id) ?? 0) + 1)
    return new Promise(resolve => {
      let timer: unknown = null
      let done = false
      const finish = (changed: boolean) => {
        if (done) return
        done = true
        if (timer !== null) clearTimer(timer)
        openWaits.delete(stop)
        const left = (waitsByCaller.get(key) ?? 1) - 1
        if (left > 0) waitsByCaller.set(key, left)
        else waitsByCaller.delete(key)
        if (asker) {
          const n = (workerWaits.get(id) ?? 1) - 1
          if (n > 0) workerWaits.set(id, n)
          else workerWaits.delete(id)
          q.lastPolledAt = now() // the lease restarts when the wait ends
        }
        resolve(answer(changed))
      }
      const stop = () => finish(false)
      const check = () => {
        if (done) return
        if (q.status !== 'pending') {
          finish(true)
          return
        }
        if (startedAt + timeoutMs - now() <= 0) finish(false)
      }
      const tick = () => {
        timer = null
        sweep() // expiry while waiting
        check()
        if (done) return
        timer = setTimer(tick, Math.min(QUESTION_WAIT_POLL_MS, Math.max(0, startedAt + timeoutMs - now())))
      }
      openWaits.set(stop, check)
      timer = setTimer(tick, Math.min(QUESTION_WAIT_POLL_MS, timeoutMs))
    })
  })

  const cancelWhere = (match: (q: QuestionRecord) => QuestionEndReason | null): void => {
    const t = now()
    let changed = false
    for (const q of questions.values()) {
      if (q.status !== 'pending') continue
      const reason = match(q)
      if (!reason) continue
      end(q, 'cancelled', reason, t)
      changed = true
    }
    if (changed) wakeWaits()
  }

  return {
    summaryFor(workerId) {
      sweep()
      let pending = 0
      let blockingSince: number | null = null
      for (const q of questions.values()) {
        if (q.status !== 'pending' || q.workerId !== workerId) continue
        pending++
        if (q.blocking && (blockingSince === null || q.createdAt < blockingSince)) blockingSince = q.createdAt
      }
      return { pending, blockingSince }
    },
    terminalEnded(id) {
      cancelWhere(q => q.workerId === id ? 'worker-exited' : q.towerId === id ? 'tower-exited' : null)
    },
    serverRecovered() {
      cancelWhere(() => 'recovery')
    },
    dispose() {
      for (const stop of [...openWaits.keys()]) stop()
    },
  }
}
