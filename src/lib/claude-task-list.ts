/**
 * T0725 / D195: the Claude panel's task list, rebuilt by replaying the CLI's task tools in message
 * order (no IPC, no extra state from the main process). Live messages, history and resume all go
 * through `replayTaskList`.
 *
 * Formats (CLI 2.1.316 `mapToolResultToToolResultBlockParam`, T0721 R2):
 * - `TaskCreate` input `{ subject, description, activeForm? }`; result `Task #<id> created successfully: <subject>`.
 *   The id is only in the result text.
 * - `TaskUpdate` input `{ taskId, status?, subject?, activeForm?, … }`, status `pending` / `in_progress` /
 *   `completed` / `deleted`; result `Updated task #<id> <fields>` on success, otherwise an error text
 *   (`Task not found`, a hook's blocking error) without `is_error`.
 * - `TaskList` result: one line per task `#<id> [<status>] <subject>[ (<owner>)][ [blocked by #a, #b]]`,
 *   or `No tasks found`. Taken as a full snapshot.
 *
 * Rules: never throws; a result that cannot be parsed changes nothing (the list is never cleared by a
 * parse failure). Task* are list tools, not sub-agents — this module has nothing to do with
 * `activeTasks` (CLAUDE.md "Sub-agent / Active Tasks Tracking").
 */

export type ClaudeTaskStatus = 'pending' | 'in_progress' | 'completed'

export interface ClaudeTaskItem {
  /** Stable React key: `task-<id>`, or `call-<tool call id>` while a `TaskCreate` has no result yet. */
  key: string
  /** CLI task id; undefined until the `TaskCreate` result arrives. */
  id?: string
  subject: string
  status: ClaudeTaskStatus
  activeForm?: string
}

export interface ClaudeTaskList {
  items: ClaudeTaskItem[]
}

/** Minimal shape of a tool call (`ClaudeToolCall` in `src/types/claude-agent.ts`). */
export interface TaskToolCallLike {
  id: string
  toolName: string
  input?: Record<string, unknown>
  status?: string
  result?: string
  denied?: boolean
}

export const TASK_LIST_TOOL_NAMES: ReadonlySet<string> = new Set(['TaskCreate', 'TaskUpdate', 'TaskList'])

export const EMPTY_TASK_LIST: ClaudeTaskList = { items: [] }

/** History results are cut to this many characters (`claude-agent-manager.ts` history loaders). */
export const HISTORY_RESULT_MAX_CHARS = 2000

export function isTaskListToolName(name: string | undefined): boolean {
  return !!name && TASK_LIST_TOOL_NAMES.has(name)
}

function normalizeStatus(value: unknown): ClaudeTaskStatus | null {
  return value === 'pending' || value === 'in_progress' || value === 'completed' ? value : null
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Text of a stored tool result. BAT stores string content as-is and block arrays as JSON
 * (`JSON.stringify(content)`); for the latter the text blocks are joined.
 */
export function taskResultText(result: unknown): string {
  if (typeof result !== 'string') return ''
  const trimmed = result.trimStart()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .map(b => (b && typeof b === 'object' && typeof (b as { text?: unknown }).text === 'string') ? (b as { text: string }).text : '')
          .filter(Boolean)
          .join('\n')
      }
    } catch {
      // Not JSON (or cut by the history limit): use the raw text.
    }
  }
  return result
}

const CREATE_RE = /^Task #(\S+) created successfully: ?(.*)$/m
const UPDATE_OK_RE = /^Updated task #(\S+)/m
const LIST_LINE_RE = /^#(\S+) \[([a-z_]+)\] (.*)$/
const BLOCKED_SUFFIX_RE = / \[blocked by #[^\]]*\]$/

export function parseTaskCreateResult(text: string): { id: string; subject: string } | null {
  const m = CREATE_RE.exec(text)
  return m ? { id: m[1], subject: m[2].trim() } : null
}

export function isTaskUpdateSuccess(text: string): boolean {
  return UPDATE_OK_RE.test(text)
}

/**
 * Parses a `TaskList` result. Returns `[]` for `No tasks found`, `null` when nothing in the text is a
 * task line. `truncated` (history cut at `HISTORY_RESULT_MAX_CHARS`) drops the last, possibly partial, line.
 */
export function parseTaskListResult(text: string, truncated = false): Array<{ id: string; status: ClaudeTaskStatus; text: string }> | null {
  const trimmed = text.trim()
  if (/^No tasks found\b/.test(trimmed)) return []
  const lines = trimmed.split(/\r?\n/)
  if (truncated && lines.length > 0) lines.pop()
  const rows: Array<{ id: string; status: ClaudeTaskStatus; text: string }> = []
  for (const line of lines) {
    const m = LIST_LINE_RE.exec(line.trimEnd())
    if (!m) continue
    rows.push({ id: m[1], status: normalizeStatus(m[2]) ?? 'pending', text: m[3].replace(BLOCKED_SUFFIX_RE, '') })
  }
  return rows.length > 0 ? rows : null
}

/**
 * A `TaskList` line's subject may end with ` (<owner>)`, which cannot be told apart from a subject that
 * ends in parentheses. Keep the known subject when the line is that subject plus an owner suffix.
 */
function listSubject(lineText: string, known: string | undefined): string {
  if (known && lineText !== known && lineText.startsWith(known) && /^ \([^()]*\)$/.test(lineText.slice(known.length))) return known
  return lineText
}

/** Applies one tool call to the list. Unrelated tools, denied / failed calls and unparseable results return `list` unchanged. */
export function applyTaskToolCall(list: ClaudeTaskList, call: TaskToolCallLike): ClaudeTaskList {
  try {
    if (!isTaskListToolName(call.toolName) || call.denied || call.status === 'error') return list
    const input = (call.input && typeof call.input === 'object') ? call.input : {}
    const text = taskResultText(call.result)
    const hasResult = text.length > 0

    if (call.toolName === 'TaskCreate') {
      const subject = str(input.subject)
      const activeForm = str(input.activeForm)
      const provisionalKey = `call-${call.id}`
      const withoutProvisional = list.items.filter(i => i.key !== provisionalKey)
      if (!hasResult) {
        // Still running: show the item now, without an id.
        if (call.status !== 'running' || !subject) return list
        if (withoutProvisional.length !== list.items.length) return list
        return { items: [...list.items, { key: provisionalKey, subject, status: 'pending', ...(activeForm ? { activeForm } : {}) }] }
      }
      const created = parseTaskCreateResult(text)
      if (!created) return list
      const item: ClaudeTaskItem = { key: `task-${created.id}`, id: created.id, subject: subject ?? created.subject, status: 'pending', ...(activeForm ? { activeForm } : {}) }
      const existing = withoutProvisional.findIndex(i => i.id === created.id)
      if (existing !== -1) {
        const items = [...withoutProvisional]
        items[existing] = { ...items[existing], subject: item.subject, ...(activeForm ? { activeForm } : {}) }
        return { items }
      }
      return { items: [...withoutProvisional, item] }
    }

    if (call.toolName === 'TaskUpdate') {
      const taskId = str(input.taskId) ?? (typeof input.taskId === 'number' ? String(input.taskId) : undefined)
      if (!taskId) return list
      // No result yet → apply optimistically; a later failure result undoes it on the next replay.
      if (hasResult && !isTaskUpdateSuccess(text)) return list
      const idx = list.items.findIndex(i => i.id === taskId)
      if (idx === -1) return list
      if (input.status === 'deleted') return { items: list.items.filter((_, i) => i !== idx) }
      const status = normalizeStatus(input.status)
      const subject = str(input.subject)
      const activeForm = str(input.activeForm)
      if (!status && !subject && !activeForm) return list
      const items = [...list.items]
      items[idx] = { ...items[idx], ...(status ? { status } : {}), ...(subject ? { subject } : {}), ...(activeForm ? { activeForm } : {}) }
      return { items }
    }

    // TaskList
    if (!hasResult) return list
    const truncated = typeof call.result === 'string' && call.result.length >= HISTORY_RESULT_MAX_CHARS
    const rows = parseTaskListResult(text, truncated)
    if (!rows) return list
    const byId = new Map(list.items.filter(i => i.id).map(i => [i.id as string, i]))
    const fromRows: ClaudeTaskItem[] = rows.map(r => {
      const known = byId.get(r.id)
      return {
        key: `task-${r.id}`,
        id: r.id,
        subject: listSubject(r.text, known?.subject),
        status: r.status,
        ...(known?.activeForm ? { activeForm: known.activeForm } : {}),
      }
    })
    if (!truncated) {
      // Full snapshot; provisional (still-running) creates are kept.
      return { items: [...fromRows, ...list.items.filter(i => !i.id)] }
    }
    // A cut-off history result is not a full snapshot: update listed tasks, keep the others.
    const rowIds = new Set(rows.map(r => r.id))
    const updated = list.items.map(i => (i.id && rowIds.has(i.id)) ? fromRows.find(f => f.id === i.id)! : i)
    const known = new Set(list.items.map(i => i.id).filter(Boolean))
    return { items: [...updated, ...fromRows.filter(f => !known.has(f.id))] }
  } catch {
    return list
  }
}

export interface TaskListReplay {
  /** List after the last item. */
  list: ClaudeTaskList
  /** List right after each Task* tool call, by tool call id. */
  snapshots: Map<string, ClaudeTaskList>
}

/** Replays `items` (tool calls and anything else, in message order) on top of `base`. */
export function replayTaskList(items: ReadonlyArray<unknown>, base: ClaudeTaskList = EMPTY_TASK_LIST): TaskListReplay {
  let list = base
  const snapshots = new Map<string, ClaudeTaskList>()
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('toolName' in item)) continue
    const call = item as TaskToolCallLike
    if (!isTaskListToolName(call.toolName)) continue
    list = applyTaskToolCall(list, call)
    if (call.id) snapshots.set(call.id, list)
  }
  return { list, snapshots }
}

/** Counts for a header such as "2 / 5". */
export function taskListProgress(list: ClaudeTaskList): { completed: number; total: number } {
  return { completed: list.items.filter(i => i.status === 'completed').length, total: list.items.length }
}
