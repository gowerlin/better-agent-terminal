/**
 * PLAN-068 W5 / T0908: the BAT ↔ CT contract v2 lists of the「待辦」(Inbox) tab — pure functions,
 * no IO, no React, no `electron` / DOM import (main, headless and the renderer share it).
 *
 *   - `_tower-state.md` frontmatter `awaiting_user[]` / `user_actions[]` / `reminders[]` /
 *     `next_ids.user` / `next_ids.action` (T0902 §3.3), and a work order's `waiting_user`
 *   - CT times: `+0800` and `+08:00` both accepted; a value that does not parse is shown as written
 *   - `awaiting_user[].source` full names → short labels (PLAN-068〈契約細節補充〉)
 *   - the one-line answers BAT sends (`U-n：<代號或自由文字>` / `A-n：完成` / `A-n：失敗 <說明>`)
 *     and the host's check of them (`tower-inbox:answer`)
 *
 * Error isolation (§3.3): a list that is not a list is ignored; one bad item (a required field
 * missing / malformed, a duplicate id) is skipped and counted, the others stay; an optional field
 * that is malformed is dropped (the item stays); unknown keys are ignored.
 *
 * 🔴 Nothing here logs; callers log ids, lengths and counts only — never `summary` / `options` /
 * `title` / `command` / an answer.
 */

// ─── Times ──────────────────────────────────────────────────────────────────

const CT_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/

/**
 * A CT time (`2026-11-25T03:10:23+08:00`, `…+0800`, `…Z`, without an offset = local, or a date
 * `2026-12-02` = local midnight) as ms epoch; null when it is not one (shown as written).
 */
export function parseCtTime(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null
  const m = CT_TIME.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s, frac, zone] = m
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const hour = h === undefined ? 0 : Number(h)
  const minute = mi === undefined ? 0 : Number(mi)
  const second = s === undefined ? 0 : Number(s)
  const ms = frac === undefined ? 0 : Math.floor(Number(`0.${frac}`) * 1000)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null
  let time: number
  if (zone === undefined) {
    time = new Date(year, month - 1, day, hour, minute, second, ms).getTime()
    const check = new Date(time)
    if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) return null
  } else {
    time = Date.UTC(year, month - 1, day, hour, minute, second, ms)
    const check = new Date(time)
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
    if (zone !== 'Z') {
      const sign = zone.startsWith('-') ? -1 : 1
      const digits = zone.slice(1).replace(':', '')
      const offset = (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4))) * 60_000
      if (Number(digits.slice(2, 4)) > 59) return null
      time -= sign * offset
    }
  }
  return Number.isFinite(time) ? time : null
}

/** Whether a CT time is a date only (`2026-12-02`): its day, not an instant. */
export function isCtDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** A CT time for display: local `YYYY-MM-DD HH:mm` (a date: `YYYY-MM-DD`); as written when it does not parse. */
export function formatCtTime(value: string): string {
  const time = parseCtTime(value)
  if (time === null) return value
  const d = new Date(time)
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return isCtDateOnly(value) ? date : `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── Sources ────────────────────────────────────────────────────────────────

/** `awaiting_user[].source` full names CT 6.1.0 writes (PLAN-068〈契約細節補充〉). */
export const AWAITING_SOURCES = [
  'breakpoint-A',
  'breakpoint-B-1',
  'breakpoint-B-2',
  'breakpoint-C',
  'breakpoint-E',
  'worker-question',
  'tower-question',
] as const
export type AwaitingSource = typeof AWAITING_SOURCES[number]

/** i18n key of a known source's short label (`inbox.source.<key>`); null = unknown (shown as written). */
export function awaitingSourceLabelKey(source: string | undefined): string | null {
  if (!source) return null
  return (AWAITING_SOURCES as readonly string[]).includes(source) ? `inbox.source.${source}` : null
}

/** `user_actions[].kind` values with a label; anything else is shown as written. */
export const USER_ACTION_KINDS = ['verify', 'run', 'manual'] as const

export function userActionKindLabelKey(kind: string | undefined): string | null {
  if (!kind) return null
  return (USER_ACTION_KINDS as readonly string[]).includes(kind) ? `inbox.actionKind.${kind}` : null
}

// ─── Lists (§3.3) ───────────────────────────────────────────────────────────

export const AWAITING_ID = /^U-\d+$/
export const ACTION_ID = /^A-\d+$/
export const REMINDER_ID = /^[a-z0-9-]{1,40}$/
/** An option's code (§3.2 1″ ①): `<代號> <說明>`, the code `^[A-Za-z0-9]{1,3}$`. */
export const OPTION_PATTERN = /^([A-Za-z0-9]{1,3})\s+(\S[\s\S]*)$/
export const USER_ACTION_TITLE_MAX = 120
export const USER_ACTION_COMMAND_MAX = 300
/** §3: more than this many items in a list → only these are drawn, plus "N more". */
export const INBOX_LIST_RENDER_MAX = 50
/** §2.3 reminders: shown when due or due within this many days. */
export const REMINDER_WINDOW_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export interface AwaitingOption {
  /** The code exactly as CT wrote it (BAT sends it as is, HANDOVER D330). */
  code: string
  label: string
}

export interface AwaitingItem {
  id: string
  workorder?: string
  kind?: string
  source?: string
  summary: string
  /** Options as buttons; null = a free answer (no options, or one of them is not `<代號> <說明>`). */
  options: AwaitingOption[] | null
  /** `options` was given but could not be used as buttons. */
  optionsInvalid: boolean
  createdAt?: string
}

export interface UserAction {
  id: string
  title: string
  ref?: string
  kind?: string
  /** Copy only — 🔴 BAT never runs it. */
  command?: string
  createdAt?: string
}

export interface Reminder {
  id: string
  title: string
  ref?: string
  lastAt?: string
  dueAt: string
  /** `dueAt` as ms epoch. */
  due: number
}

export interface TowerInboxLists {
  awaiting: AwaitingItem[]
  actions: UserAction[]
  reminders: Reminder[]
  /** Items skipped per list (§3.3 error isolation). */
  skipped: { awaiting: number; actions: number; reminders: number }
  /** Which of the three keys the file has (a missing key ≠ an empty list). */
  present: { awaiting: boolean; actions: boolean; reminders: boolean }
  nextUser?: string
  nextAction?: string
}

export const EMPTY_TOWER_INBOX_LISTS: TowerInboxLists = Object.freeze({
  awaiting: [],
  actions: [],
  reminders: [],
  skipped: { awaiting: 0, actions: 0, reminders: 0 },
  present: { awaiting: false, actions: false, reminders: false },
}) as TowerInboxLists

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function idOf(value: unknown, pattern: RegExp): string | undefined {
  return typeof value === 'string' && pattern.test(value) ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/**
 * `<代號> <說明>` options → buttons; null when any option is not that form or two codes are the
 * same (case-insensitive: CT matches the code case-insensitively and needs a unique hit, D330).
 */
export function parseAwaitingOptions(raw: unknown): { options: AwaitingOption[] | null; invalid: boolean } {
  if (raw === undefined || raw === null) return { options: null, invalid: false }
  if (!Array.isArray(raw)) return { options: null, invalid: true }
  if (raw.length === 0) return { options: null, invalid: false }
  const options: AwaitingOption[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') return { options: null, invalid: true }
    const m = OPTION_PATTERN.exec(item.trim())
    if (!m) return { options: null, invalid: true }
    const key = m[1].toLowerCase()
    if (seen.has(key)) return { options: null, invalid: true }
    seen.add(key)
    options.push({ code: m[1], label: m[2].trim() })
  }
  return { options, invalid: false }
}

/** ms of `createdAt` for ordering (unparsable / missing → after the others, file order kept). */
function orderKey(createdAt: string | undefined): number {
  const time = createdAt ? parseCtTime(createdAt) : null
  return time ?? Number.POSITIVE_INFINITY
}

function stableSort<T>(items: T[], key: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index, k: key(item) }))
    .sort((a, b) => (a.k === b.k ? a.index - b.index : a.k < b.k ? -1 : 1))
    .map(entry => entry.item)
}

/**
 * The contract v2 lists of a parsed `_tower-state.md` frontmatter (a YAML map). Pending items are
 * ordered by `created_at`, oldest first (§1); reminders by `due_at`, earliest first.
 */
export function parseTowerInboxLists(frontmatter: unknown): TowerInboxLists {
  const fm = asRecord(frontmatter) ?? {}
  const skipped = { awaiting: 0, actions: 0, reminders: 0 }
  const present = {
    awaiting: Object.prototype.hasOwnProperty.call(fm, 'awaiting_user'),
    actions: Object.prototype.hasOwnProperty.call(fm, 'user_actions'),
    reminders: Object.prototype.hasOwnProperty.call(fm, 'reminders'),
  }

  const awaiting: AwaitingItem[] = []
  if (Array.isArray(fm.awaiting_user)) {
    const ids = new Set<string>()
    for (const raw of fm.awaiting_user) {
      const item = asRecord(raw)
      const id = item ? idOf(item.id, AWAITING_ID) : undefined
      const summary = item ? text(item.summary) : undefined
      if (!item || !id || !summary || ids.has(id)) { skipped.awaiting++; continue }
      ids.add(id)
      const { options, invalid } = parseAwaitingOptions(item.options)
      const entry: AwaitingItem = { id, summary, options, optionsInvalid: invalid }
      const workorder = text(item.workorder)
      if (workorder) entry.workorder = workorder
      const kind = text(item.kind)
      if (kind) entry.kind = kind
      const source = text(item.source)
      if (source) entry.source = source
      const createdAt = text(item.created_at)
      if (createdAt) entry.createdAt = createdAt
      awaiting.push(entry)
    }
  }

  const actions: UserAction[] = []
  if (Array.isArray(fm.user_actions)) {
    const ids = new Set<string>()
    for (const raw of fm.user_actions) {
      const item = asRecord(raw)
      const id = item ? idOf(item.id, ACTION_ID) : undefined
      const title = item ? text(item.title) : undefined
      if (!item || !id || !title || title.length > USER_ACTION_TITLE_MAX || ids.has(id)) { skipped.actions++; continue }
      ids.add(id)
      const entry: UserAction = { id, title }
      const ref = text(item.ref)
      if (ref) entry.ref = ref
      const kind = text(item.kind)
      if (kind) entry.kind = kind
      const command = typeof item.command === 'string' && item.command.trim() !== '' && item.command.length <= USER_ACTION_COMMAND_MAX
        ? item.command
        : undefined
      if (command) entry.command = command
      const createdAt = text(item.created_at)
      if (createdAt) entry.createdAt = createdAt
      actions.push(entry)
    }
  }

  const reminders: Reminder[] = []
  if (Array.isArray(fm.reminders)) {
    const ids = new Set<string>()
    for (const raw of fm.reminders) {
      const item = asRecord(raw)
      const id = item ? idOf(item.id, REMINDER_ID) : undefined
      const title = item ? text(item.title) : undefined
      const dueAt = item ? text(item.due_at) : undefined
      const due = dueAt ? parseCtTime(dueAt) : null
      if (!item || !id || !title || !dueAt || due === null || ids.has(id)) { skipped.reminders++; continue }
      ids.add(id)
      const entry: Reminder = { id, title, dueAt, due }
      const ref = text(item.ref)
      if (ref) entry.ref = ref
      const lastAt = text(item.last_at)
      if (lastAt) entry.lastAt = lastAt
      reminders.push(entry)
    }
  }

  const lists: TowerInboxLists = {
    awaiting: stableSort(awaiting, item => orderKey(item.createdAt)),
    actions: stableSort(actions, item => orderKey(item.createdAt)),
    reminders: stableSort(reminders, item => item.due),
    skipped,
    present,
  }
  const nextIds = asRecord(fm.next_ids)
  if (nextIds) {
    const nextUser = idOf(nextIds.user, AWAITING_ID)
    if (nextUser) lists.nextUser = nextUser
    const nextAction = idOf(nextIds.action, ACTION_ID)
    if (nextAction) lists.nextAction = nextAction
  }
  return lists
}

/** A work order frontmatter's `waiting_user` (`^U-\d+$`); anything else = not waiting (§3.3). */
export function parseWaitingUser(value: unknown): string | null {
  return typeof value === 'string' && AWAITING_ID.test(value.trim()) ? value.trim() : null
}

// ─── Reminders (§2.3) ───────────────────────────────────────────────────────

export interface DueReminder extends Reminder {
  /** Whole days past due (≥ 1), 0 = due today, < 0 = due in that many days. */
  days: number
}

function localDay(time: number): number {
  const d = new Date(time)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Reminders due already or within `REMINDER_WINDOW_DAYS`; most overdue first. */
export function dueReminders(reminders: readonly Reminder[], now: number): DueReminder[] {
  const today = localDay(now)
  const result: DueReminder[] = []
  for (const reminder of reminders) {
    const dueDay = localDay(reminder.due)
    const days = Math.round((today - dueDay) / DAY_MS)
    const dueNow = reminder.due <= now || days >= 0
    if (dueNow || reminder.due - now <= REMINDER_WINDOW_DAYS * DAY_MS) result.push({ ...reminder, days: dueNow ? Math.max(days, 0) : Math.min(days, -1) })
  }
  return result.sort((a, b) => a.due - b.due)
}

// ─── Answers (§2.4 / §3.3) ──────────────────────────────────────────────────

/** Longest answer line (the host checks it again). */
export const INBOX_ANSWER_MAX_CHARS = 1_000
/** Only these lines may be typed into a Tower through `tower-inbox:answer` (no free input channel). */
export const INBOX_ANSWER_PREFIX = /^[UA]-\d+[：:]/

export type InboxAnswerCheck = 'ok' | 'not-string' | 'empty' | 'multiline' | 'too-long' | 'bad-prefix'

/** The host's check of an answer line (`tower-inbox:answer`): one line, ≤ 1,000 chars, `^[UA]-\d+[：:]` + text. */
export function checkInboxAnswer(value: unknown): InboxAnswerCheck {
  if (typeof value !== 'string') return 'not-string'
  if (value.length === 0) return 'empty'
  if (/[\r\n]/.test(value)) return 'multiline'
  if (value.length > INBOX_ANSWER_MAX_CHARS) return 'too-long'
  const m = INBOX_ANSWER_PREFIX.exec(value)
  if (!m || value.slice(m[0].length).trim() === '') return 'bad-prefix'
  return 'ok'
}

/** Line breaks and tabs in a free text → spaces (the answer is one line). */
function oneLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').trim()
}

/** `U-n：<代號或自由文字>` (full-width colon, as CT documents). */
export function awaitingAnswerText(id: string, answer: string): string {
  return `${id}：${oneLine(answer)}`
}

/** `A-n：完成` / `A-n：失敗 <說明>` (the words are the contract's, not translated). */
export function actionAnswerText(id: string, result: 'done' | 'failed', note?: string): string {
  if (result === 'done') return `${id}：完成`
  const detail = note ? oneLine(note) : ''
  return detail ? `${id}：失敗 ${detail}` : `${id}：失敗`
}
