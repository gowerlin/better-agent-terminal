/**
 * PLAN-047 W1-2 / T0585 (D150): `worktree:terminal-status` — read-only signals of an isolated
 * Worker's worktree (`--isolation worktree`, T0583), so the Tower can decide the merge order,
 * whether `--ff-only` will do, or whether to dispatch a merge work order. BAT never merges.
 *
 *   worktree:terminal-status  { terminalId?, workorder? }  (one of them; neither = the caller)
 *     → { ok: true, terminalId, isolated: false }
 *     → { ok: true, terminalId, isolated: true, path, branch, base, head, mainHead, ahead, behind,
 *         dirty, dirtyCount, changedFiles, changedCount, outOfScopeFiles, conflicts,
 *         touchesCtWorkorders, computedAt, … }   (CtWorktreeService.status, electron/ct-worktree.ts)
 *     → { ok: false, code } with INVALID_ARGS / NOT_FOUND / NOT_OWNER / AMBIGUOUS (as
 *       `--close-worker`), TIMEOUT (10 s for the whole query) or GIT_FAILED (the branch or the main
 *       checkout is gone)
 *
 * `workorder` finds the Worker the way `--close-worker` does (`findWorkerTerminals`, with the saved
 * tabs after BAT reopens — `withSavedWorkerOwnership`), among running tabs only. The scope is
 * T0582's `authorizeHelperQueryTarget` with `output` access: a tower capability → itself + its own
 * Workers; a worker capability → itself only. Electron also counts a Worker owned through its
 * saved tab (`isOwnedBy` = `capabilityOrSavedTabOwnership`, as `--close-worker`). A server-token
 * client is not scoped.
 *
 * Audit: `[helper-query] channel=worktree:terminal-status caller=… target=… → …` (T0582 format) +
 * a `helper-query` event in bat-scripts.log; never file contents.
 *
 * Electron main and headless bat-server register this same module.
 * 🔴 No `electron` import here (shared with headless).
 */
import { normalizeWorkorderId, type CloseWorkerPtyManager } from './close-worker'
import type { CtWorktreeRecord, CtWorktreeStatusResult } from './ct-worktree'
import type { HandlerContext } from './remote/handler-registry'
import { authorizeHelperQueryTarget, type HelperCapability, type HelperQueryScopeContext } from './remote/helper-capability'

export const WORKTREE_STATUS_CHANNEL = 'worktree:terminal-status'

export type WorktreeStatusErrorCode = 'INVALID_ARGS' | 'NOT_FOUND' | 'NOT_OWNER' | 'AMBIGUOUS' | 'TIMEOUT' | 'GIT_FAILED'
export type WorktreeStatusFailure = { ok: false; code: WorktreeStatusErrorCode; message?: string; terminalIds?: string[] }

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

  // a literal channel name: proxied-channels-binding.test.ts scans for it
  deps.registerHandler('worktree:terminal-status', async (ctx: HandlerContext, raw?: unknown) => {
    const opts = raw === undefined || raw === null ? {} : typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
    if (!opts) return fail(ctx, '-', 'INVALID_ARGS')
    const hasTerminal = opts.terminalId !== undefined && opts.terminalId !== null
    const hasWorkorder = opts.workorder !== undefined && opts.workorder !== null
    if (hasTerminal && hasWorkorder) return fail(ctx, '-', 'INVALID_ARGS', 'terminalId or workorder, not both')
    const caller = callerOf(ctx)
    const view = deps.getWorkerView()

    const scope: HelperQueryScopeContext = {
      isWorkerOf(childId, towerId) {
        if (childId === towerId) return false
        if (deps.isWorkerOf(childId, towerId)) return true
        return !!deps.isOwnedBy && !!view && view.getTowerTerminalId(childId) === towerId && deps.isOwnedBy(childId, towerId)
      },
      getTerminalRole: () => undefined,
    }

    let target: string
    if (hasWorkorder) {
      const workorder = normalizeWorkorderId(opts.workorder)
      if (!workorder) return fail(ctx, '-', 'INVALID_ARGS', 'workorder')
      const label = `workorder=${workorder}`
      if (!view) return fail(ctx, label, 'NOT_FOUND')
      const candidates = view.findWorkerTerminals(null, workorder)
      if (candidates.length === 0) return fail(ctx, label, 'NOT_FOUND')
      const allowed = candidates.filter(id => authorizeHelperQueryTarget(caller, id, 'output', scope).ok)
      if (allowed.length === 0) return fail(ctx, label, 'NOT_OWNER')
      if (allowed.length > 1) return fail(ctx, label, 'AMBIGUOUS', undefined, allowed)
      target = allowed[0]
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
      if (!view || !view.isAlive(target)) return fail(ctx, target, 'NOT_FOUND')
      if (!authorizeHelperQueryTarget(caller, target, 'output', scope).ok) return fail(ctx, target, 'NOT_OWNER')
    }

    const record = view?.getWorktree?.(target)
    if (!record) {
      audit(ctx, target, 'ok isolated=false')
      return { ok: true, terminalId: target, isolated: false }
    }
    const startedAt = Date.now()
    let result: CtWorktreeStatusResult
    try {
      result = await deps.status(record)
    } catch (error) {
      return fail(ctx, target, 'GIT_FAILED', error instanceof Error ? error.message : String(error))
    }
    if (!result.ok) {
      return fail(ctx, target, result.code === 'TIMEOUT' ? 'TIMEOUT' : 'GIT_FAILED', result.error)
    }
    const { ok: _ok, ...status } = result
    audit(ctx, target, [
      'ok isolated=true',
      `ahead=${status.ahead}`,
      `behind=${status.behind}`,
      `dirty=${status.dirtyCount ?? 'n/a'}`,
      `changed=${status.changedCount}`,
      `outOfScope=${status.outOfScopeCount ?? 'n/a'}`,
      `conflicts=${status.conflicts ? status.conflicts.length : 'n/a'}`,
      `cached=${status.cached}`,
      `ms=${Date.now() - startedAt}`,
    ].join(' '))
    return { ok: true, terminalId: target, ...status }
  })
}
