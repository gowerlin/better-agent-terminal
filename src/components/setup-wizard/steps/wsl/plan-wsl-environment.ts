import i18next from 'i18next'
import { throwIfWizardAborted, type WizardStep } from '../../wizard-runner'
import { PRECONDITION_MISSING_CODE, wizardError } from '../../error-mapper'
import { runAbortableOperation } from '../../wizard-abort'
import { buildWslEnvPlan, type WslEnvPlan, type WslEnvPlanItem } from '../../wsl-env-plan'

/**
 * T0840 (PLAN-043 W3): "detect → list → consent once" (T0831 〈調查結論〉2, D272).
 *
 * Collects the WSL facts (IPC `wsl:detect-facts`, abortable: the in-distro probe
 * can cold-start a Stopped distro, ~7 s measured in T0839), builds the plan with
 * `buildWslEnvPlan` (the only place that decides what is needed) and, when it
 * has items, shows the checklist once (`ctx.requestConsent`). The approved ids
 * go to `ctx.state.wslApprovedItems`; `apply-wsl-environment` applies them.
 *
 * 🔴 No regression: an environment that is already fine gives 0 items and 0
 * notices → no checklist, the step just succeeds.
 *  - Blocking notices (WSL disabled by policy, WSL not installed) fail the step.
 *  - Other notices (P-3 root user, P-7 WSL too old, probe failed) become warnings.
 *  - A required item left unchecked (or one that cannot be checked) stops here
 *    with an explanation; retry asks again, cancel is always possible.
 *  - Optional items left unchecked become a warning.
 */

export const WSL_APPROVED_ITEMS_STATE_KEY = 'wslApprovedItems'
export const WSL_ENV_PLAN_STATE_KEY = 'wslEnvPlan'

function itemLabel(item: WslEnvPlanItem): string {
  return i18next.t(item.labelKey, item.params ?? {})
}

export const planWslEnvironmentStep: WizardStep = {
  id: 'plan-wsl-environment',
  title: 'Check the WSL environment',
  appliesTo: ['wsl-linux'],
  kind: 'input',
  retryable: true,
  labelKey: 'wizard.wsl.step.planEnv.label',
  descriptionKey: 'wizard.wsl.step.planEnv.description',
  groupKey: 'wizard.group.detection',
  editableFromFailure: false,
  async run(ctx) {
    if (!ctx.wslDistro) {
      throw wizardError('Select a WSL distro before checking the WSL environment.', PRECONDITION_MISSING_CODE)
    }
    const distro = ctx.wslDistro
    // Every run decides again (retry / jump re-run): nothing approved yet.
    ctx.state[WSL_APPROVED_ITEMS_STATE_KEY] = []

    const detectFacts = window.electronAPI.wsl.detectFacts
    if (typeof detectFacts !== 'function') {
      // A renderer newer than its preload (T0840 Q-1): behave as before T0840.
      ctx.logger.warn('wsl.detectFacts is not available; skipping the WSL environment plan.')
      ctx.state[WSL_ENV_PLAN_STATE_KEY] = { items: [], notices: [] } satisfies WslEnvPlan
      return
    }

    const facts = await runAbortableOperation(ctx.signal, (operationId) =>
      operationId ? detectFacts(distro, { operationId }) : detectFacts(distro))
    throwIfWizardAborted(ctx)

    const plan = buildWslEnvPlan(facts)
    ctx.state[WSL_ENV_PLAN_STATE_KEY] = plan
    ctx.logger.info(
      `WSL environment plan: items=[${plan.items.map((i) => i.id).join(',')}] notices=[${plan.notices.map((n) => n.id).join(',')}]`,
    )

    const blocking = plan.notices.find((notice) => notice.severity === 'blocking')
    if (blocking) {
      if (blocking.id === 'policy-wsl-disabled') {
        throw wizardError('WSL is turned off by a Windows policy (AllowWSL=0).', 'wsl-policy-blocked')
      }
      throw wizardError('Unable to detect WSL. Install WSL2 first, then retry.', 'wsl-not-installed')
    }
    for (const notice of plan.notices) {
      const warning = i18next.t(notice.messageKey, notice.params ?? {})
      if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
    }

    if (plan.items.length === 0) return

    if (!ctx.requestConsent) {
      throw wizardError('This window cannot show the WSL environment checklist.', 'wsl-env-required-declined', {
        items: plan.items.filter((i) => i.required).map(itemLabel).join(', '),
      })
    }

    const answer = await ctx.requestConsent({
      stepId: 'plan-wsl-environment',
      titleKey: 'wizard.wsl.plan.title',
      descriptionKey: 'wizard.wsl.plan.description',
      items: plan.items,
      params: { distro },
      runningDistros: facts.running,
    })
    throwIfWizardAborted(ctx)

    const checked = new Set(answer ?? [])
    // Fixed items are always applied; an item that cannot be checked never is.
    const approved = plan.items
      .filter((item) => item.fixed || (!item.disabledReasonKey && checked.has(item.id)))
      .map((item) => item.id)

    const missingRequired = plan.items.filter((item) => item.required && !approved.includes(item.id))
    const unavailable = missingRequired.filter((item) => item.disabledReasonKey)
    if (unavailable.length > 0) {
      throw wizardError(
        `Required WSL environment fixes cannot be applied: ${unavailable.map((i) => i.id).join(', ')}`,
        'wsl-env-item-unavailable',
        {
          items: unavailable.map(itemLabel).join(', '),
          reason: unavailable.map((i) => i18next.t(i.disabledReasonKey!, i.params ?? {})).join(' '),
        },
      )
    }
    if (missingRequired.length > 0) {
      if (missingRequired.length === 1 && missingRequired[0].id === 'wsl2-convert') {
        // Same error the distro picker gave before T0840 (only WSL 1 distros).
        throw wizardError('BAT requires WSL2. Upgrade an existing distro to version 2 and retry.', 'wsl-requires-wsl2')
      }
      throw wizardError(
        `Required WSL environment fixes were not approved: ${missingRequired.map((i) => i.id).join(', ')}`,
        'wsl-env-required-declined',
        { items: missingRequired.map(itemLabel).join(', ') },
      )
    }

    for (const item of plan.items) {
      if (item.required || approved.includes(item.id)) continue
      const warning = i18next.t('wizard.wsl.plan.warning.optionalSkipped', { item: itemLabel(item) })
      if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
    }

    ctx.state[WSL_APPROVED_ITEMS_STATE_KEY] = approved
    ctx.logger.info(`WSL environment fixes approved: [${approved.join(',')}]`)
  },
  async rollback(ctx) {
    delete ctx.state[WSL_APPROVED_ITEMS_STATE_KEY]
    delete ctx.state[WSL_ENV_PLAN_STATE_KEY]
  },
}
