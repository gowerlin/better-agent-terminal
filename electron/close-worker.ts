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
 * PLAN-047 W1 / T0583: `{ …, worktree?: 'keep' | 'remove' | 'archive' }` (`--close-worker --worktree`).
 * A Worker dispatched with `--isolation worktree` (electron/ct-worktree.ts) has its worktree removed
 * (or removed and its branch archived) once the tab is actually gone — the close request went out
 * and the PTY ended within `CLOSE_WORKER_TAB_CLOSE_WAIT_MS`. A cancelled close cleans nothing; a
 * Worker that is not isolated ignores the option. The cleanup result goes to the log only (the
 * helper has exited by then).
 *
 * 🔴 No `electron` import here (shared with headless, T0536).
 */
import type { CtWorktreeCleanupResult, CtWorktreeCloseMode, CtWorktreeRecord } from './ct-worktree'

/** No output for this long before a Worker counts as quiet (constant, not a setting). */
export const CLOSE_WORKER_IDLE_MS = 5000
/** T0545: when the delay is up, wait at most this long for the tab to go quiet (constant). */
export const CLOSE_WORKER_MAX_QUIET_WAIT_MS = 60_000
/** `delayMs` is clamped to `0..CLOSE_WORKER_MAX_DELAY_MS`. */
export const CLOSE_WORKER_MAX_DELAY_MS = 300_000
/** T0583: after the close request, how long the tab may take to go before its worktree is kept. */
export const CLOSE_WORKER_TAB_CLOSE_WAIT_MS = 60_000
/** T0583: how often a closing tab is checked; it must be gone on two checks in a row (shell exited). */
export const CLOSE_WORKER_TAB_CLOSE_POLL_MS = 1_000

const WORKTREE_CLOSE_MODES: readonly string[] = ['keep', 'remove', 'archive']

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

/**
 * T0583: what a request with `worktree` answers about it — `isolated: false` = the Worker was not
 * dispatched with `--isolation worktree`, the option is ignored (the tab is still closed).
 */
export interface CloseWorkerWorktreeAnswer {
  mode: CtWorktreeCloseMode
  isolated: boolean
  path?: string
  branch?: string
}

export type CloseWorkerResult =
  | { ok: true; terminalId: string; closeAt: number; delayMs: number; worktree?: CloseWorkerWorktreeAnswer }
  | { ok: false; code: CloseWorkerErrorCode; terminalIds?: string[] }

/** What the scheduler needs from PtyManager. */
export interface CloseWorkerPtyManager {
  /** Running PTYs recorded with `workorder`; `towerId` null = any tower (or none). */
  findWorkerTerminals(towerId: string | null, workorder: string): string[]
  getTowerTerminalId(id: string): string | undefined
  getLastOutputAt(id: string): number | null
  getLastUserInputAt(id: string): number | null
  isAlive(id: string): boolean
  /** T0583: the worktree record of an isolated Worker (PtyInstance, else its saved tab). */
  getWorktree?(id: string): CtWorktreeRecord | undefined
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
  /** T0583: removes / archives an isolated Worker's worktree (`CtWorktreeService.cleanup`). Absent = kept. */
  cleanupWorktree?: (record: CtWorktreeRecord, mode: Exclude<CtWorktreeCloseMode, 'keep'>) => Promise<CtWorktreeCleanupResult>
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
  /** T0583: what to do with the Worker's worktree once the tab is gone. */
  worktreeMode: CtWorktreeCloseMode
}

interface PendingClose extends CloseEntry {
  timer: unknown
}

function clampDelay(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 0
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return Math.min(CLOSE_WORKER_MAX_DELAY_MS, Math.max(0, Math.round(raw)))
}

/** T0583: a tab whose close was requested, watched until it is gone, then its worktree cleaned. */
interface ClosingWorktree {
  record: CtWorktreeRecord
  mode: Exclude<CtWorktreeCloseMode, 'keep'>
  tag: string
  requestedAt: number
  /** The previous check already found the tab gone. */
  goneOnce: boolean
  timer: unknown
}

export class WorkerCloseScheduler {
  private readonly pending = new Map<string, PendingClose>()
  private readonly closing = new Map<string, ClosingWorktree>()
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
    const args = (raw && typeof raw === 'object' ? raw : {}) as { towerId?: unknown; workorder?: unknown; delayMs?: unknown; worktree?: unknown }
    const towerId = typeof args.towerId === 'string' ? args.towerId.trim() : ''
    const workorder = normalizeWorkorderId(args.workorder)
    const delayMs = clampDelay(args.delayMs)
    // T0583: absent = keep (the worktree, if any, stays)
    const worktreeGiven = args.worktree !== undefined && args.worktree !== null
    const worktreeValue = !worktreeGiven ? 'keep' : typeof args.worktree === 'string' ? args.worktree.trim().toLowerCase() : ''
    const worktreeMode = WORKTREE_CLOSE_MODES.includes(worktreeValue) ? worktreeValue as CtWorktreeCloseMode : null
    const tag = `tower=${towerId || 'n/a'} workorder=${workorder ?? String(args.workorder ?? 'n/a')}`
    const refuse = (code: CloseWorkerErrorCode, extra = '', terminalIds?: string[]): CloseWorkerResult => {
      this.deps.logger.log(`[close-worker] ${tag} → ${code}${extra}`)
      return terminalIds ? { ok: false, code, terminalIds } : { ok: false, code }
    }

    if (!towerId || !workorder || delayMs === null || worktreeMode === null) return refuse('INVALID_ARGS')
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
    // T0583: an isolated Worker (`--isolation worktree`) — anything else ignores `--worktree`
    const record = ptys.getWorktree?.(terminalId)
    const worktree: CloseWorkerWorktreeAnswer | undefined = worktreeGiven
      ? { mode: worktreeMode, isolated: !!record, ...(record ? { path: record.path, branch: record.branch } : {}) }
      : undefined
    const worktreeNote = worktreeMode === 'keep' ? '' : record ? ` worktree=${worktreeMode}` : ` worktree=${worktreeMode} (not an isolated Worker: ignored)`
    const closeAt = now + delayMs
    this.deps.logger.log(`[close-worker] ${tag} id=${terminalId} → scheduled delayMs=${delayMs}${worktreeNote}${printing}${previous ? ' (replaces the pending close)' : ''}`)
    const entry: CloseEntry = { scheduledAt: now, closeAt, towerId, workorder, waiting: false, worktreeMode: record ? worktreeMode : 'keep' }
    if (delayMs === 0) this.fire(terminalId, entry)
    else this.arm(terminalId, entry, delayMs)
    return worktree ? { ok: true, terminalId, closeAt, delayMs, worktree } : { ok: true, terminalId, closeAt, delayMs }
  }

  /** Clears every pending timer (app quit). */
  dispose(): void {
    for (const entry of this.pending.values()) this.clearTimer(entry.timer)
    this.pending.clear()
    for (const entry of this.closing.values()) this.clearTimer(entry.timer)
    this.closing.clear()
  }

  /** T0583: tabs whose worktree waits for the tab to go (tests / diagnostics). */
  closingWorktreeIds(): string[] {
    return [...this.closing.keys()]
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
    if (entry.worktreeMode !== 'keep') this.watchWorktree(id, entry.worktreeMode, tag, now)
  }

  /**
   * T0583: the close request went out — clean the worktree once the tab is gone (the PTY no longer
   * runs on two checks in a row, so its shell has exited), or keep it when the tab is still there
   * `CLOSE_WORKER_TAB_CLOSE_WAIT_MS` later (no window held it, or the user restarted it).
   */
  private watchWorktree(id: string, mode: Exclude<CtWorktreeCloseMode, 'keep'>, tag: string, requestedAt: number): void {
    const record = this.deps.getPtyManager()?.getWorktree?.(id)
    const previous = this.closing.get(id)
    if (previous) {
      this.clearTimer(previous.timer)
      this.closing.delete(id)
    }
    if (!record) return
    if (!this.deps.cleanupWorktree) {
      this.deps.logger.warn(`[ct-worktree] ${tag} → ${record.path} kept (no cleanup on this host)`)
      return
    }
    this.closing.set(id, { record, mode, tag, requestedAt, goneOnce: false, timer: null })
    this.pollWorktree(id)
  }

  private pollWorktree(id: string): void {
    const entry = this.closing.get(id)
    if (!entry) return
    const timer = this.setTimer(() => {
      const current = this.closing.get(id)
      if (!current || current.timer !== timer) return
      const alive = this.deps.getPtyManager()?.isAlive(id) ?? false
      if (!alive && current.goneOnce) {
        this.closing.delete(id)
        void this.runCleanup(id, current)
        return
      }
      if (alive && this.now() - current.requestedAt >= CLOSE_WORKER_TAB_CLOSE_WAIT_MS) {
        this.closing.delete(id)
        this.deps.logger.warn(`[ct-worktree] ${current.tag} → ${current.record.path} kept (the tab was still open ${CLOSE_WORKER_TAB_CLOSE_WAIT_MS / 1000} s after the close request)`)
        return
      }
      current.goneOnce = !alive
      this.pollWorktree(id)
    }, CLOSE_WORKER_TAB_CLOSE_POLL_MS)
    entry.timer = timer
  }

  private async runCleanup(id: string, entry: ClosingWorktree): Promise<void> {
    const { record, mode, tag } = entry
    const where = `${record.path} (branch ${record.branch})`
    try {
      const result = await this.deps.cleanupWorktree!(record, mode)
      switch (result.status) {
        case 'removed':
          this.deps.logger.log(`[ct-worktree] ${tag} → removed ${where}; branch kept`)
          break
        case 'archived':
          this.deps.logger.log(`[ct-worktree] ${tag} → archived ${where}: worktree removed, branch renamed to ${result.archivedBranch}${result.detail ? ` (${result.detail})` : ''}`)
          break
        case 'missing':
          this.deps.logger.log(`[ct-worktree] ${tag} → ${where} was already gone${result.detail ? ` (${result.detail})` : ''}`)
          break
        case 'kept-dirty':
          this.deps.logger.warn(`[ct-worktree] ${tag} → ${where} kept (uncommitted changes)`)
          break
        default:
          this.deps.logger.warn(`[ct-worktree] ${tag} → ${where} kept (${result.status}: ${result.detail ?? 'n/a'})`)
      }
    } catch (error) {
      this.deps.logger.warn(`[ct-worktree] ${tag} id=${id} → ${where} kept (cleanup failed):`, error)
    }
  }
}
