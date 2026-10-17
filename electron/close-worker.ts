/**
 * PLAN-041 / T0535: `terminal:close-worker` — a Tower closes the Worker tab it dispatched for a
 * work order (`bat-terminal.mjs --close-worker T#### --notify-id <tower> [--delay-ms N]`).
 *
 * BAT decides whether the tab may be closed (ownership, a single match) and when (it waits for
 * the tab to go quiet); CT decides whether and when to ask (D144: no Settings switch here). Main
 * checks the request, keeps the delay timer and, when it fires, sends
 * `terminal:close-requested { id }` to every window; the window holding the tab closes it the
 * way ✕ does (`workspaceStore.closeTerminalNow`).
 *
 * T0545 / D145: recent output no longer refuses the request (BUSY) and output during the delay
 * no longer cancels it — an agent keeps printing for a while after it reports. When the delay
 * is up and the tab printed within `CLOSE_WORKER_IDLE_MS`, the close waits until the tab has
 * been quiet that long, at most `CLOSE_WORKER_MAX_QUIET_WAIT_MS` past the due time, then gives
 * up (the tab stays). User input (a local window's or a remote client's `pty:write`) during the
 * delay or the wait still cancels.
 *
 * T0551 / BUG-140: a write made only of the terminal's own replies to the program
 * (`isTerminalAutoReply`: focus in / out reports, DSR / DA answers, mouse reports …) is not user
 * input — switching tabs or workspaces makes xterm write `ESC [ I` / `ESC [ O` into a TUI that
 * turned focus reporting on (the claude CLI does), which used to cancel the close.
 *
 * Contract (PLAN-041「介面契約」): `{ towerId, workorder, delayMs? }` →
 *   `{ ok: true, terminalId, closeAt, delayMs }` or `{ ok: false, code }` with code
 *   INVALID_ARGS | NOT_FOUND | NOT_OWNER | AMBIGUOUS (BUSY stays in the contract, but BAT no
 *   longer returns it since T0545).
 *
 * T0536: headless bat-server serves the same scheduler (electron/remote/headless-entry.ts) for a
 * remote Tower's helper; the event then reaches the client windows of that profile.
 *
 * 🔴 No `electron` import here (shared with headless, T0536).
 */

/** No output for this long before a Worker counts as quiet (constant, not a setting). */
export const CLOSE_WORKER_IDLE_MS = 5000
/** T0545: when the delay is up, wait at most this long for the tab to go quiet (constant). */
export const CLOSE_WORKER_MAX_QUIET_WAIT_MS = 60_000
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

// T0551 / BUG-140: what a terminal (xterm.js) writes into the PTY on its own, answering the
// program or reporting an event — never what a key, a paste or an IME commit produces.
const TERMINAL_AUTO_REPLY_SEQUENCES = [
  '\\x1b\\[[IO]', // focus in / out (DECSET 1004)
  '\\x1b\\[\\??\\d+;\\d+(?:;\\d+)?R', // cursor position report (DSR 6 / DECXCPR)
  '\\x1b\\[\\??\\d*n', // device status report (DSR 5, private DSR)
  '\\x1b\\[[?>=][\\d;]*c', // device attributes (DA1 / DA2 / DA3)
  '\\x1b\\[\\??\\d+;\\d+\\$y', // mode report (DECRQM)
  '\\x1b\\[\\d+(?:;\\d+)*t', // window reports (XTWINOPS)
  '\\x1b\\[\\?\\d*u', // keyboard flags (kitty protocol query)
  '\\x1b\\[<\\d+;\\d+;\\d+[Mm]', // mouse report, SGR / SGR-pixels
  '\\x1b\\[\\d+;\\d+;\\d+M', // mouse report, urxvt
  '\\x1b\\[M[\\x20-\\xff]{3}', // mouse report, X10 / normal
  '\\x1b\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)', // OSC reply (colour queries …)
  '\\x1bP[^\\x1b]*\\x1b\\\\', // DCS reply (DECRQSS, XTVERSION, XTGETTCAP)
]
const TERMINAL_AUTO_REPLY_ONLY = new RegExp(`^(?:${TERMINAL_AUTO_REPLY_SEQUENCES.join('|')})+$`)

/**
 * T0551 / BUG-140: true when a `pty:write` consists entirely of terminal auto-replies (see
 * TERMINAL_AUTO_REPLY_SEQUENCES) — it still goes to the PTY, but it is not the user's input and
 * does not cancel a pending close. A single other character (typed text, Enter, a paste, Esc
 * alone) makes the whole write input. Known overlap: a modified F3 (`ESC [ 1 ; <m> R`) has the
 * cursor position report's shape and is not counted.
 */
export function isTerminalAutoReply(data: unknown): boolean {
  return typeof data === 'string' && TERMINAL_AUTO_REPLY_ONLY.test(data)
}

/** `BUSY` is kept for the contract (helper exit 6) but no longer returned (T0545 / D145). */
export type CloseWorkerErrorCode ='INVALID_ARGS' | 'NOT_FOUND' | 'NOT_OWNER' | 'AMBIGUOUS' | 'BUSY'

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

/**
 * PLAN-047 / T0575: Electron's `isOwnedBy`. A Worker this process recorded a work order for must
 * hold a worker capability bound to the asking tower (`isWorkerOf`, as headless T0536). A Worker
 * whose ownership came from its saved tab (T0537, `withSavedWorkerOwnership`: nothing recorded by
 * this process) keeps that as its record: after BAT reopens its PTY was registered from the
 * Terminal Server's list or re-created as a plain shell, so it holds no worker capability — the
 * saved tab is written by BAT windows only (`workspace:save` needs `ctx.windowId`).
 *
 * PLAN-047 / T0576: a PTY that survived the reopen on the Terminal Server keeps its restored
 * capability, and a worker capability is the binding of its own env (`BAT_TOWER_TERMINAL_ID`).
 * Order: (1) a worker capability (`hasWorkerCapability`) decides — it must be bound to the asking
 * tower (`isWorkerOf`), whatever the saved tab says; (2) otherwise a work order this process
 * recorded needs one (`NOT_OWNER`); (3) otherwise the saved tab's ownership stands (T0537: the
 * Terminal Server did not survive and the tab came back as a plain shell — a tower capability —
 * or the PTY predates T0576 / T0575). The work order itself still comes from the saved tab.
 */
export function capabilityOrSavedTabOwnership(
  isWorkerOf: (terminalId: string, towerId: string) => boolean,
  hasRecordedWorkorder: (terminalId: string) => boolean,
  hasWorkerCapability: (terminalId: string) => boolean = () => false,
): (terminalId: string, towerId: string) => boolean {
  return (terminalId, towerId) => {
    if (isWorkerOf(terminalId, towerId)) return true
    if (hasWorkerCapability(terminalId)) return false
    return !hasRecordedWorkorder(terminalId)
  }
}

export interface WorkerCloseSchedulerDeps {
  getPtyManager(): CloseWorkerPtyManager | null
  /**
   * T0536: an extra ownership check of a candidate, on top of its `BAT_TOWER_TERMINAL_ID`
   * (headless: the helper capability registry's `isWorkerOf`; Electron since T0575:
   * `capabilityOrSavedTabOwnership`). False ⇒ NOT_OWNER.
   */
  isOwnedBy?: (terminalId: string, towerId: string) => boolean
  /** Sends the event to every window (detached ones included); returns how many took it. */
  emit(channel: string, payload: unknown): unknown
  logger: { log(...args: unknown[]): void; warn(...args: unknown[]): void }
  now?: () => number
  setTimeout?: (callback: () => void, ms: number) => unknown
  clearTimeout?: (handle: unknown) => void
}

interface CloseEntry {
  scheduledAt: number
  /** When the delay is up; the quiet wait is measured from here. */
  closeAt: number
  towerId: string
  workorder: string
  /** T0545: the delay is up and the close is waiting for the tab to go quiet. */
  waiting: boolean
}

interface PendingClose extends CloseEntry {
  timer: unknown
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

  /** Ids with a close still waiting for its delay or for quiet (tests / diagnostics). */
  pendingIds(): string[] {
    return [...this.pending.keys()]
  }

  /**
   * `terminal:close-worker`. A request that passes replaces a pending close of the same tab,
   * one waiting for quiet included (the timer restarts); a refused request leaves a pending
   * close alone.
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
    // T0545: recent output is no longer a refusal; the close waits for quiet when it is due.
    const lastOutput = ptys.getLastOutputAt(terminalId)
    const printing = lastOutput !== null && now - lastOutput < CLOSE_WORKER_IDLE_MS
      ? ` (output ${now - lastOutput} ms ago; will wait for quiet)`
      : ''

    const previous = this.pending.get(terminalId)
    if (previous) {
      this.clearTimer(previous.timer)
      this.pending.delete(terminalId)
    }
    const closeAt = now + delayMs
    this.deps.logger.log(`[close-worker] ${tag} id=${terminalId} → scheduled delayMs=${delayMs}${printing}${previous ? ' (replaces the pending close)' : ''}`)
    const entry: CloseEntry = { scheduledAt: now, closeAt, towerId, workorder, waiting: false }
    if (delayMs === 0) this.fire(terminalId, entry)
    else this.arm(terminalId, entry, delayMs)
    return { ok: true, terminalId, closeAt, delayMs }
  }

  /** Clears every pending timer (app quit). */
  dispose(): void {
    for (const entry of this.pending.values()) this.clearTimer(entry.timer)
    this.pending.clear()
  }

  /** Runs `fire` for `id` after `ms`, unless a newer request or `dispose` replaced the entry. */
  private arm(id: string, entry: CloseEntry, ms: number): void {
    const timer = this.setTimer(() => {
      const current = this.pending.get(id)
      if (!current || current.timer !== timer) return
      this.pending.delete(id)
      this.fire(id, current)
    }, ms)
    this.pending.set(id, { ...entry, timer })
  }

  /** The delay is up, or a quiet-wait check is due: close, keep waiting for quiet, or give up. */
  private fire(id: string, entry: CloseEntry): void {
    const tag = `tower=${entry.towerId} workorder=${entry.workorder} id=${id}`
    const ptys = this.deps.getPtyManager()
    if (!ptys || !ptys.isAlive(id)) {
      this.deps.logger.log(`[close-worker] ${tag} → skipped (terminal no longer exists)`)
      return
    }
    const input = ptys.getLastUserInputAt(id)
    if (input !== null && input > entry.scheduledAt) {
      this.deps.logger.log(`[close-worker] ${tag} → cancelled (user input ${entry.waiting ? 'while waiting for quiet' : 'during the delay'})`)
      return
    }
    const now = this.now()
    const output = ptys.getLastOutputAt(id)
    if (output !== null && now - output < CLOSE_WORKER_IDLE_MS) {
      const deadline = entry.closeAt + CLOSE_WORKER_MAX_QUIET_WAIT_MS
      if (now >= deadline) {
        this.deps.logger.log(`[close-worker] ${tag} → cancelled (still printing ${CLOSE_WORKER_MAX_QUIET_WAIT_MS / 1000} s after the delay; tab kept)`)
        return
      }
      if (!entry.waiting) {
        this.deps.logger.log(`[close-worker] ${tag} → still printing (output ${now - output} ms ago): waiting for quiet (at most ${CLOSE_WORKER_MAX_QUIET_WAIT_MS / 1000} s)`)
      }
      // Look again once the latest output is IDLE_MS old, or at the deadline.
      this.arm(id, { ...entry, waiting: true }, Math.max(1, Math.min(output + CLOSE_WORKER_IDLE_MS, deadline) - now))
      return
    }
    const windows = this.deps.emit(CLOSE_REQUESTED_CHANNEL, { id })
    const waited = entry.waiting ? ` after waiting ${((now - entry.closeAt) / 1000).toFixed(1)} s for quiet` : ''
    this.deps.logger.log(`[close-worker] ${tag} → close requested${waited} (windows=${typeof windows === 'number' ? windows : 'n/a'})`)
  }
}
