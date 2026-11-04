import i18next from 'i18next'
import { throwIfWizardAborted, wizardAbortError, type WizardContext, type WizardStep } from '../../wizard-runner'
import { PRECONDITION_MISSING_CODE, wizardError } from '../../error-mapper'
import { runAbortableOperation } from '../../wizard-abort'
import type { WslEnvApplyItemId, WslEnvChange, WslEnvPlan } from '../../wsl-env-plan'
import { WSL_APPROVED_ITEMS_STATE_KEY, WSL_ENV_PLAN_STATE_KEY } from './plan-wsl-environment'

/**
 * T0840 (PLAN-043 W3): apply what the user approved in plan-wsl-environment,
 * one item at a time through IPC `wsl:apply-env-item` (electron/wsl-env-apply.ts:
 * re-detect first, back up, write over stdin, terminate, verify the real state).
 *
 *  - Order: WSL 2 conversion first (systemd only runs on WSL 2), then systemd.
 *    `enable-linger` is not applied here: write-systemd-unit keeps doing it.
 *  - A required item that fails fails the step (retry / skip — the connection
 *    may then fail — / cancel); an optional one only adds a warning.
 *  - `wsl --set-version` cannot be stopped midway (it runs in the LxssManager
 *    service): the step marks itself uninterruptible while it waits.
 *  - Every real change is recorded in `ctx.state.wslAppliedChanges`; the done /
 *    cancel screen lists them with the backup location (D272: never undone).
 */

export const WSL_APPLIED_CHANGES_STATE_KEY = 'wslAppliedChanges'

/** Order the fixes are applied in. */
export const WSL_ENV_APPLY_ORDER: readonly WslEnvApplyItemId[] = ['wsl2-convert', 'enable-systemd']

export type WslAppliedChange = WslEnvChange & { distro: string }

export function readWslAppliedChanges(state: Record<string, unknown>): WslAppliedChange[] {
  const value = state[WSL_APPLIED_CHANGES_STATE_KEY]
  return Array.isArray(value) ? (value as WslAppliedChange[]) : []
}

/** T0841: also used by connect-test (P-5, `.wslconfig`). */
export function recordWslAppliedChanges(ctx: WizardContext, distro: string, changes: WslEnvChange[]): void {
  const list = readWslAppliedChanges(ctx.state)
  for (const change of changes) {
    const exists = list.some((c) =>
      c.distro === distro && c.item === change.item && c.kind === change.kind && c.path === change.path)
    if (!exists) list.push({ ...change, distro })
  }
  ctx.state[WSL_APPLIED_CHANGES_STATE_KEY] = list
}

export const applyWslEnvironmentStep: WizardStep = {
  id: 'apply-wsl-environment',
  title: 'Apply WSL environment fixes',
  appliesTo: ['wsl-linux'],
  retryable: true,
  labelKey: 'wizard.wsl.step.applyEnv.label',
  descriptionKey: 'wizard.wsl.step.applyEnv.description',
  groupKey: 'wizard.group.detection',
  editableFromFailure: false,
  async run(ctx) {
    const approved = ctx.state[WSL_APPROVED_ITEMS_STATE_KEY]
    const approvedIds = Array.isArray(approved) ? (approved as string[]) : []
    const toApply = WSL_ENV_APPLY_ORDER.filter((id) => approvedIds.includes(id))
    if (toApply.length === 0) return

    if (!ctx.wslDistro) {
      throw wizardError('Select a WSL distro before applying WSL environment fixes.', PRECONDITION_MISSING_CODE)
    }
    const distro = ctx.wslDistro
    const applyEnvItem = window.electronAPI.wsl.applyEnvItem
    const plan = ctx.state[WSL_ENV_PLAN_STATE_KEY] as WslEnvPlan | undefined

    for (const id of toApply) {
      throwIfWizardAborted(ctx)
      const uninterruptible = id === 'wsl2-convert'
      if (uninterruptible) ctx.setUninterruptible?.('wizard.wsl.apply.uninterruptible.convert')
      let result: Awaited<ReturnType<typeof applyEnvItem>>
      try {
        result = await runAbortableOperation(ctx.signal, (operationId) =>
          operationId ? applyEnvItem(distro, id, { operationId }) : applyEnvItem(distro, id))
      } finally {
        if (uninterruptible) ctx.setUninterruptible?.(null)
      }
      // Record first: an aborted or failed item may still have changed something.
      recordWslAppliedChanges(ctx, distro, result.changes)
      if (result.ok) {
        ctx.logger.info(`WSL environment fix ${id}: ${result.outcome}`)
        continue
      }
      if (result.aborted || ctx.signal?.aborted) throw wizardAbortError()
      const item = plan?.items.find((i) => i.id === id)
      if (item && !item.required) {
        const warning = i18next.t('wizard.wsl.apply.warning.optionalFailed', {
          item: i18next.t(item.labelKey, item.params ?? {}),
          error: result.error,
        })
        if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
        continue
      }
      throw wizardError(`WSL environment fix ${id} failed: ${result.error}`, result.errorCode, { distro })
    }
  },
  async rollback(ctx) {
    // D272 (T0831 Q-1): environment fixes are NOT undone when the wizard is
    // cancelled — undoing systemd would terminate the distro once more, and
    // converting back to WSL 1 takes as long as the conversion. Only the
    // approval is cleared; `wslAppliedChanges` stays so the cancel screen can
    // list what changed and where the backup is.
    delete ctx.state[WSL_APPROVED_ITEMS_STATE_KEY]
  },
}
