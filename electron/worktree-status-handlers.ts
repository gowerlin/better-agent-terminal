/**
 * PLAN-047 W1-2 / T0585 (D150): `worktree:terminal-status` — read-only signals of an isolated
 * Worker's worktree (`--isolation worktree`, T0583), so the Tower can decide the merge order,
 * whether `--ff-only` will do, or whether to dispatch a merge work order. BAT never merges.
 *
 *   worktree:terminal-status  { terminalId?, workorder? }  (one of them; neither = the caller)
 *     → { ok: true, terminalId, source, isolated: false }
 *     → { ok: true, terminalId, source, isolated: true, path, branch, base, head, mainHead, ahead,
 *         behind, dirty, dirtyCount, changedFiles, changedCount, outOfScopeFiles, conflicts,
 *         touchesCtWorkorders, computedAt, … }   (CtWorktreeService.status, electron/ct-worktree.ts)
 *     → { ok: false, code } with INVALID_ARGS / NOT_FOUND / NOT_OWNER / AMBIGUOUS (as
 *       `--close-worker`), TIMEOUT (10 s for the whole query) or GIT_FAILED (the branch or the main
 *       checkout is gone)
 *
 * `workorder` finds the Worker the way `--close-worker` does (`findWorkerTerminals`, with the saved
 * tabs after BAT reopens — `withSavedWorkerOwnership`). The scope is T0582's
 * `authorizeHelperQueryTarget` with `output` access: a tower capability → itself + its own
 * Workers; a worker capability → itself only. Electron also counts a Worker owned through its
 * saved tab (`isOwnedBy` = `capabilityOrSavedTabOwnership`, as `--close-worker`). A server-token
 * client is not scoped.
 *
 * PLAN-047 Q3 / T0589: the Worker tab may be closed. `source` says where the answer came from,
 * the first that has the target:
 *   `live`    a running tab (T0585 as it was)
 *   `exited`  T0582's record of an exited PTY (`PtyManager.getExitedPty`, 10 min / 32 records),
 *             which keeps its worktree; + `exited: true`, `exitedAt`. By `workorder`: the exited
 *             records of that work order in scope (an exited Worker belongs to the tower recorded
 *             at its exit); several → the latest, unless they come from different towers (a
 *             server-token client) → AMBIGUOUS
 *   `git`     `workorder` asked by a tower capability whose own PTY runs: the `ct/<T####>` branch
 *             in the repository of that PTY's cwd, by the T0583 location rules
 *             (`CtWorktreeService.statusFromGit`); `terminalId: null`. Only what that Tower could
 *             read with git itself — no tab's metadata or output is opened
 * A running or exited tab of the work order outside the caller's scope stays NOT_OWNER.
 *
 * Audit: `[helper-query] channel=worktree:terminal-status caller=… target=… → ok source=… …`
 * (T0582 format) + a `helper-query` event in bat-scripts.log; never file contents.
 *
 * Electron main and headless bat-server register this same module.
 * 🔴 No `electron` import here (shared with headless).
 */
import { normalizeWorkorderId, type CloseWorkerPtyManager } from './close-worker'
import type { CtWorktreeGitStatusResult, CtWorktreeRecord, CtWorktreeStatusResult } from './ct-worktree'
import type { HandlerContext } from './remote/handler-registry'
import { authorizeHelperQueryTarget, type HelperCapability, type HelperQueryScopeContext } from './remote/helper-capability'

export const WORKTREE_STATUS_CHANNEL = 'worktree:terminal-status'

export type WorktreeStatusErrorCode = 'INVALID_ARGS' | 'NOT_FOUND' | 'NOT_OWNER' | 'AMBIGUOUS' | 'TIMEOUT' | 'GIT_FAILED'
export type WorktreeStatusFailure = { ok: false; code: WorktreeStatusErrorCode; message?: string; terminalIds?: string[] }

/** T0589: where a `worktree:terminal-status` answer came from (see the module comment). */
export type WorktreeStatusSource = 'live' | 'exited' | 'git'

/** T0589: what the handler reads of an exited PTY (`PtyManager.getExitedPty`). */
export interface ExitedWorkerRecord {
  towerTerminalId?: string
  workorder?: string
  worktree?: CtWorktreeRecord
  exitedAt: number
}

/** T0589: the exited PTYs (`PtyManager`). */
export interface ExitedWorkerView {
  getExitedPty(id: string): ExitedWorkerRecord | null
  /** Oldest first. */
  listExitedPtyIds(): string[]
}

export interface WorktreeStatusDeps {
  registerHandler(channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown): void
  /**
   * The `--close-worker` view of the PTYs: Electron `withSavedWorkerOwnership(ptyManager, …)`,
   * headless the PtyManager itself.
   */
  getWorkerView(): CloseWorkerPtyManager | null
  /** The capability registry's `isWorkerOf` (a running Worker of that tower). */
  isWorkerOf(childId: string, towerId: string): boolean
  /**
   * Electron: `capabilityOrSavedTabOwnership` (T0537 / T0576), checked together with the view's
   * tower of the candidate, as `--close-worker`. Absent (headless) = `isWorkerOf` only.
   */
  isOwnedBy?(childId: string, towerId: string): boolean
  /** `CtWorktreeService.status`. */
  status(record: CtWorktreeRecord): Promise<CtWorktreeStatusResult>
  /** T0589: the exited PTYs (`PtyManager`). Absent = no `exited` source. */
  getExitedView?(): ExitedWorkerView | null
  /** T0589: the cwd of running PTY `id` (`PtyManager.getTerminalInfo`). Absent = no `git` source. */
  getTerminalCwd?(id: string): string | undefined
  /** T0589: `CtWorktreeService.statusFromGit`. Absent = no `git` source. */
  statusFromGit?(opts: { cwd: string; workorder: string }): Promise<CtWorktreeGitStatusResult>
  logger: { log(...args: unknown[]): void }
  mirrorToBatScripts?(event: string, payload: Record<string, unknown>): void
}

const TERMINAL_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

function callerOf(ctx: HandlerContext): HelperCapability | null {
  const h = ctx.helper
  if (!h) return null
  return h.towerId ? { terminalId: h.terminalId, role: h.role, towerId: h.towerId } : { terminalId: h.terminalId, role: h.role }
}

export function registerWorktreeStatusHandler(deps: WorktreeStatusDeps): void {
  const channel = WORKTREE_STATUS_CHANNEL

  const audit = (ctx: HandlerContext, target: string, result: string): void => {
    const caller = ctx.helper ? ctx.helper.terminalId : ctx.connectionId ? `client:${ctx.connectionId}` : 'local'
    deps.logger.log(`[helper-query] channel=${channel} caller=${caller} target=${target} → ${result}`)
    deps.mirrorToBatScripts?.('helper-query', {
      channel,
      caller,
      ...(ctx.helper ? { callerRole: ctx.helper.role } : {}),
      target,
      result,
    })
  }

  const fail = (ctx: HandlerContext, target: string, code: WorktreeStatusErrorCode, message?: string, terminalIds?: string[]): WorktreeStatusFailure => {
    audit(ctx, target, message ? `${code} (${message})` : code)
    return { ok: false, code, ...(message ? { message } : {}), ...(terminalIds ? { terminalIds } : {}) }
  }

  /** A computed status → the answer (`{ ok: true, terminalId, source, … }`) or TIMEOUT / GIT_FAILED. */
  const answer = (
    ctx: HandlerContext,
    label: string,
    terminalId: string | null,
    source: WorktreeStatusSource,
    result: CtWorktreeStatusResult,
    startedAt: number,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> => {
    if (!result.ok) {
      return fail(ctx, label, result.code === 'TIMEOUT' ? 'TIMEOUT' : 'GIT_FAILED', result.error)
    }
    const { ok: _ok, ...status } = result
    audit(ctx, label, [
      `ok source=${source}`,
      'isolated=true',
      `ahead=${status.ahead}`,
      `behind=${status.behind}`,
      `dirty=${status.dirtyCount ?? 'n/a'}`,
      `changed=${status.changedCount}`,
      `outOfScope=${status.outOfScopeCount ?? 'n/a'}`,
      `conflicts=${status.conflicts ? status.conflicts.length : 'n/a'}`,
      `cached=${status.cached}`,
      `ms=${Date.now() - startedAt}`,
    ].join(' '))
    return { ok: true, terminalId, source, ...extra, ...status }
  }

  /**
   * T0589: no tab remembers `workorder` — a tower capability whose PTY runs reads the `ct/<T####>`
   * branch of its own repository (the cwd of its PTY). Anyone else → NOT_FOUND.
   */
  const fromGit = async (ctx: HandlerContext, label: string, workorder: string, caller: HelperCapability | null): Promise<Record<string, unknown>> => {
    if (!caller || caller.role !== 'tower' || !deps.statusFromGit || !deps.getTerminalCwd) return fail(ctx, label, 'NOT_FOUND')
    const cwd = deps.getTerminalCwd(caller.terminalId)
    if (!cwd) return fail(ctx, label, 'NOT_FOUND')
    const startedAt = Date.now()
    let result: CtWorktreeGitStatusResult
    try {
      result = await deps.statusFromGit({ cwd, workorder })
    } catch (error) {
      return fail(ctx, label, 'GIT_FAILED', error instanceof Error ? error.message : String(error))
    }
    if (!result.ok && result.code === 'NOT_FOUND') return fail(ctx, label, 'NOT_FOUND')
    return answer(ctx, label, null, 'git', result as CtWorktreeStatusResult, startedAt)
  }

  // a literal channel name: proxied-channels-binding.test.ts scans for it
  deps.registerHandler('worktree:terminal-status', async (ctx: HandlerContext, raw?: unknown) => {
    const opts = raw === undefined || raw === null ? {} : typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
    if (!opts) return fail(ctx, '-', 'INVALID_ARGS')
    const hasTerminal = opts.terminalId !== undefined && opts.terminalId !== null
    const hasWorkorder = opts.workorder !== undefined && opts.workorder !== null
    if (hasTerminal && hasWorkorder) return fail(ctx, '-', 'INVALID_ARGS', 'terminalId or workorder, not both')
    const caller = callerOf(ctx)
    const view = deps.getWorkerView()
    const exitedView = deps.getExitedView?.() ?? null

    const scope: HelperQueryScopeContext = {
      isWorkerOf(childId, towerId) {
        if (childId === towerId) return false
        if (!view || view.isAlive(childId)) {
          if (deps.isWorkerOf(childId, towerId)) return true
          return !!deps.isOwnedBy && !!view && view.getTowerTerminalId(childId) === towerId && deps.isOwnedBy(childId, towerId)
        }
        // T0589 (as T0582): an exited Worker belongs to the tower recorded at its exit
        return exitedView?.getExitedPty(childId)?.towerTerminalId === towerId
      },
      getTerminalRole: () => undefined,
    }
    const inScope = (id: string): boolean => authorizeHelperQueryTarget(caller, id, 'output', scope).ok

    let target: string
    let source: WorktreeStatusSource = 'live'
    let exited: ExitedWorkerRecord | null = null
    if (hasWorkorder) {
      const workorder = normalizeWorkorderId(opts.workorder)
      if (!workorder) return fail(ctx, '-', 'INVALID_ARGS', 'workorder')
      const label = `workorder=${workorder}`
      const candidates = view ? view.findWorkerTerminals(null, workorder) : []
      if (candidates.length > 0) {
        const allowed = candidates.filter(inScope)
        if (allowed.length === 0) return fail(ctx, label, 'NOT_OWNER')
        if (allowed.length > 1) return fail(ctx, label, 'AMBIGUOUS', undefined, allowed)
        target = allowed[0]
      } else {
        // T0589: no running tab — the exited records of the work order, then git
        const records: Array<{ id: string; record: ExitedWorkerRecord }> = []
        for (const id of exitedView?.listExitedPtyIds() ?? []) {
          const record = exitedView?.getExitedPty(id)
          if (record && record.workorder === workorder) records.push({ id, record })
        }
        if (records.length === 0) return fromGit(ctx, label, workorder, caller)
        const allowed = records.filter(e => inScope(e.id))
        if (allowed.length === 0) return fail(ctx, label, 'NOT_OWNER')
        const towers = new Set(allowed.map(e => e.record.towerTerminalId ?? ''))
        if (towers.size > 1) return fail(ctx, label, 'AMBIGUOUS', undefined, allowed.map(e => e.id))
        const latest = allowed.reduce((a, b) => (b.record.exitedAt >= a.record.exitedAt ? b : a))
        target = latest.id
        exited = latest.record
        source = 'exited'
      }
    } else {
      if (hasTerminal) {
        if (typeof opts.terminalId !== 'string' || !TERMINAL_ID_PATTERN.test(opts.terminalId.trim())) {
          return fail(ctx, '-', 'INVALID_ARGS', 'terminalId')
        }
        target = opts.terminalId.trim()
      } else if (caller) {
        target = caller.terminalId
      } else {
        return fail(ctx, '-', 'INVALID_ARGS', 'terminalId or workorder is required without a helper capability')
      }
      if (!view || !view.isAlive(target)) {
        exited = exitedView?.getExitedPty(target) ?? null
        if (!exited) return fail(ctx, target, 'NOT_FOUND')
        source = 'exited'
      }
      if (!inScope(target)) return fail(ctx, target, 'NOT_OWNER')
    }

    const exitedFields = exited ? { exited: true as const, exitedAt: exited.exitedAt } : {}
    const record = exited ? exited.worktree : view?.getWorktree?.(target)
    if (!record) {
      audit(ctx, target, `ok source=${source} isolated=false`)
      return { ok: true, terminalId: target, source, ...exitedFields, isolated: false }
    }
    const startedAt = Date.now()
    let result: CtWorktreeStatusResult
    try {
      result = await deps.status(record)
    } catch (error) {
      return fail(ctx, target, 'GIT_FAILED', error instanceof Error ? error.message : String(error))
    }
    return answer(ctx, target, target, source, result, startedAt, exitedFields)
  })
}
