/**
 * PLAN-041 / T0535: `terminal:close-worker` — a Tower closes the Worker tab it dispatched for a
 * work order (`bat-terminal.mjs --close-worker T#### --notify-id <tower> [--delay-ms N]`).
 *
 * BAT decides whether the tab may be closed (ownership, a single match, idle); CT decides
 * whether and when to ask (D144: no Settings switch here). Main checks the request, keeps the
 * delay timer and, when it fires, sends `terminal:close-requested { id }` to every window; the
 * window holding the tab closes it the way ✕ does (`workspaceStore.closeTerminalNow`).
 *
 * Contract (PLAN-041「介面契約」): `{ towerId, workorder, delayMs? }` →
 *   `{ ok: true, terminalId, closeAt, delayMs }` or `{ ok: false, code }` with code
 *   INVALID_ARGS | NOT_FOUND | NOT_OWNER | AMBIGUOUS | BUSY.
 *
 * T0536: headless bat-server serves the same scheduler (electron/remote/headless-entry.ts) for a
 * remote Tower's helper; the event then reaches the client windows of that profile.
 *
 * 🔴 No `electron` import here (shared with headless, T0536).
 */

/** No output for this long before a Worker counts as idle (constant, not a setting). */
export const CLOSE_WORKER_IDLE_MS = 5000
/** `delayMs` is clamped to `0..CLOSE_WORKER_MAX_DELAY_MS`. */
export const CLOSE_WORKER_MAX_DELAY_MS = 300_000

export const CLOSE_REQUESTED_CHANNEL = 'terminal:close-requested'

// T0360/BUG-082 work order grammar — same as `--workorder` (scripts/bat-terminal.mjs
// WORKORDER_ID_PATTERN, electron/terminal-command-handlers.ts).
const WORKORDER_ID_PATTERN = /^(?:[A-Z]{2,4}-)?T\d+$/

/**
 * A work order id as recorded on a Worker PTY and as looked up: trimmed, upper-cased, and
 * matching the `--workorder` grammar. Anything else → null (not recorded / INVALID_ARGS).
 */
export function normalizeWorkorderId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const id = raw.trim().toUpperCase()
  return WORKORDER_ID_PATTERN.test(id) ? id : null
}

export type CloseWorkerErrorCode = 'INVALID_ARGS' | 'NOT_FOUND' | 'NOT_OWNER' | 'AMBIGUOUS' | 'BUSY'

export type CloseWorkerResult =
  | { ok: true; terminalId: string; closeAt: number; delayMs: number }
  | { ok: false; code: CloseWorkerErrorCode; terminalIds?: string[] }

/** What the scheduler needs from PtyManager. */
export interface CloseWorkerPtyManager {
  /** Running PTYs recorded with `workorder`; `towerId` null = any tower (or none). */
  findWorkerTerminals(towerId: string | null, workorder: string): string[]
  getTowerTerminalId(id: string): string | undefined
  getLastOutputAt(id: string): number | null
  getLastUserInputAt(id: string): number | null
  isAlive(id: string): boolean
}

export interface WorkerCloseSchedulerDeps {
  getPtyManager(): CloseWorkerPtyManager | null
  /**
   * T0536: an extra ownership check of a candidate, on top of its `BAT_TOWER_TERMINAL_ID`
   * (headless: the helper capability registry's `isWorkerOf`). False ⇒ NOT_OWNER.
   */
  isOwnedBy?: (terminalId: string, towerId: string) => boolean
  /** Sends the event to every window (detached ones included); returns how many took it. */
  emit(channel: string, payload: unknown): unknown
  logger: { log(...args: unknown[]): void; warn(...args: unknown[]): void }
  now?: () => number
  setTimeout?: (callback: () => void, ms: number) => unknown
  clearTimeout?: (handle: unknown) => void
}

interface PendingClose {
  timer: unknown
  scheduledAt: number
  closeAt: number
  towerId: string
  workorder: string
}

function clampDelay(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 0
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return Math.min(CLOSE_WORKER_MAX_DELAY_MS, Math.max(0, Math.round(raw)))
}

export class WorkerCloseScheduler {
  private readonly pending = new Map<string, PendingClose>()
  private readonly now: () => number
  private readonly setTimer: (callback: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void

  constructor(private readonly deps: WorkerCloseSchedulerDeps) {
    this.now = deps.now ?? Date.now
    this.setTimer = deps.setTimeout ?? ((cb, ms) => setTimeout(cb, ms))
    this.clearTimer = deps.clearTimeout ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  }

  /** Ids with a close still waiting for its timer (tests / diagnostics). */
  pendingIds(): string[] {
    return [...this.pending.keys()]
  }

  /**
   * `terminal:close-worker`. A request that passes replaces a pending close of the same tab
   * (the timer restarts); a refused request leaves a pending close alone.
   */
  request(raw: unknown): CloseWorkerResult {
    const args = (raw && typeof raw === 'object' ? raw : {}) as { towerId?: unknown; workorder?: unknown; delayMs?: unknown }
    const towerId = typeof args.towerId === 'string' ? args.towerId.trim() : ''
    const workorder = normalizeWorkorderId(args.workorder)
    const delayMs = clampDelay(args.delayMs)
    const tag = `tower=${towerId || 'n/a'} workorder=${workorder ?? String(args.workorder ?? 'n/a')}`
    const refuse = (code: CloseWorkerErrorCode, extra = '', terminalIds?: string[]): CloseWorkerResult => {
      this.deps.logger.log(`[close-worker] ${tag} → ${code}${extra}`)
      return terminalIds ? { ok: false, code, terminalIds } : { ok: false, code }
    }

    if (!towerId || !workorder || delayMs === null) return refuse('INVALID_ARGS')
    const ptys = this.deps.getPtyManager()
    if (!ptys) return refuse('NOT_FOUND', ' (no PTY manager)')

    // Look up by work order first, then check the tower: NOT_FOUND and NOT_OWNER stay apart.
    const candidates = ptys.findWorkerTerminals(null, workorder)
    if (candidates.length === 0) return refuse('NOT_FOUND')
    // T0536: a Tower is never its own Worker (it cannot close itself through this).
    const isOwnedBy = this.deps.isOwnedBy
    const owned = candidates.filter(id =>
      id !== towerId && ptys.getTowerTerminalId(id) === towerId && (!isOwnedBy || isOwnedBy(id, towerId)))
    if (owned.length === 0) {
      const towers = candidates.map(id => ptys.getTowerTerminalId(id) ?? '(none)').join(',')
      return refuse('NOT_OWNER', ` (dispatched by ${towers})`)
    }
    if (owned.length > 1) return refuse('AMBIGUOUS', ` (${owned.join(',')})`, owned)

    const terminalId = owned[0]
    const now = this.now()
    const lastOutput = ptys.getLastOutputAt(terminalId)
    if (lastOutput !== null && now - lastOutput < CLOSE_WORKER_IDLE_MS) {
      return refuse('BUSY', ` (id=${terminalId} output ${now - lastOutput} ms ago)`)
    }

    const previous = this.pending.get(terminalId)
    if (previous) {
      this.clearTimer(previous.timer)
      this.pending.delete(terminalId)
    }
    const closeAt = now + delayMs
    this.deps.logger.log(`[close-worker] ${tag} id=${terminalId} → scheduled delayMs=${delayMs}${previous ? ' (replaces the pending close)' : ''}`)
    if (delayMs === 0) {
      this.fire(terminalId, { scheduledAt: now, towerId, workorder })
    } else {
      const timer = this.setTimer(() => {
        const entry = this.pending.get(terminalId)
        if (!entry || entry.timer !== timer) return
        this.pending.delete(terminalId)
        this.fire(terminalId, entry)
      }, delayMs)
      this.pending.set(terminalId, { timer, scheduledAt: now, closeAt, towerId, workorder })
    }
    return { ok: true, terminalId, closeAt, delayMs }
  }

  /** Clears every pending timer (app quit). */
  dispose(): void {
    for (const entry of this.pending.values()) this.clearTimer(entry.timer)
    this.pending.clear()
  }

  private fire(id: string, entry: { scheduledAt: number; towerId: string; workorder: string }): void {
    const tag = `tower=${entry.towerId} workorder=${entry.workorder} id=${id}`
    const ptys = this.deps.getPtyManager()
    if (!ptys || !ptys.isAlive(id)) {
      this.deps.logger.log(`[close-worker] ${tag} → skipped (terminal no longer exists)`)
      return
    }
    const input = ptys.getLastUserInputAt(id)
    if (input !== null && input > entry.scheduledAt) {
      this.deps.logger.log(`[close-worker] ${tag} → cancelled (user input during the delay)`)
      return
    }
    const output = ptys.getLastOutputAt(id)
    if (output !== null && output > entry.scheduledAt) {
      this.deps.logger.log(`[close-worker] ${tag} → cancelled (new output during the delay)`)
      return
    }
    const windows = this.deps.emit(CLOSE_REQUESTED_CHANNEL, { id })
    this.deps.logger.log(`[close-worker] ${tag} → close requested (windows=${typeof windows === 'number' ? windows : 'n/a'})`)
  }
}
