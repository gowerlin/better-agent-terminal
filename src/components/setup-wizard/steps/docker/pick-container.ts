import i18next from 'i18next'
import type { WizardContext, WizardStep } from '../../wizard-runner'
import { wizardError } from '../../error-mapper'
import { isContainerCreatedByWizard, removeContainerIfCreatedByWizard } from './ownership'

function slugifyProfileId(name: unknown): string {
  return typeof name === 'string' && name.trim()
    ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profile'
    : 'profile'
}

/** T0500: set by resetForEdit; the next run asks for the mode even if one is stored. */
const EDIT_REQUESTED_KEY = 'pickContainerEditRequested'

export const pickContainerStep: WizardStep = {
  id: 'pick-container',
  title: 'Choose Docker container mode',
  appliesTo: ['docker-linux'],
  // T0330 (PLAN-032 Sprint 2): mode picker uses ctx.requestChoice — runner
  // flips status to awaiting-input while the user decides.
  kind: 'input',
  retryable: true,
  labelKey: 'wizard.docker.step.pickContainer.label',
  descriptionKey: 'wizard.docker.step.pickContainer.description',
  groupKey: 'wizard.group.detection',
  editableFromFailure: true,
  async run(ctx) {
    const containers = await window.electronAPI.docker.listContainers()
    const defaultMode = containers.length > 0 ? 'existing' : 'new'
    const previousMode = ctx.state.containerMode
    const hasPreviousMode = typeof previousMode === 'string' && previousMode !== 'unknown'
    // T0500: after a jump back the stored mode is the fallback only when there
    // is no prompt to ask with.
    const editRequested = ctx.state[EDIT_REQUESTED_KEY] === true && typeof ctx.requestChoice === 'function'
    const selectedMode = !editRequested && hasPreviousMode
      ? previousMode
      : (
          ctx.requestChoice
            ? await ctx.requestChoice({
                stepId: 'pick-container',
                title: i18next.t('wizard.docker.pickContainer.title'),
                description: i18next.t('wizard.docker.pickContainer.description'),
                options: [
                  {
                    value: 'new',
                    label: 'Create new',
                    labelKey: 'wizard.docker.pickContainer.new.label',
                    description: i18next.t('wizard.docker.pickContainer.new.description'),
                  },
                  {
                    value: 'existing',
                    label: 'Use existing',
                    labelKey: 'wizard.docker.pickContainer.existing.label',
                    description: i18next.t('wizard.docker.pickContainer.existing.description'),
                  },
                ],
              })
            : defaultMode
        )

    const mode = selectedMode === 'existing' ? 'existing' : 'new'
    // T0500: a container picked under the other mode is not carried over
    // (an existing container is never the "new" name, and vice versa).
    const keepContainer = !editRequested || mode === previousMode

    // T0502: containerMode / dockerContainer are written only once the choice
    // checks out. A failed pick leaves the stored mode as it was, so a retry
    // asks again (no stored mode) instead of repeating the failing choice, and
    // this step's rollback still sees the mode and container of the earlier
    // run that may have created one.
    if (mode === 'existing') {
      if (containers.length === 0) throw wizardError('No Docker containers found. Create one first or switch to "Create new".', 'docker-no-containers')
      const selectedContainer = keepContainer && typeof ctx.state.dockerContainer === 'string' && ctx.state.dockerContainer
        ? ctx.state.dockerContainer
        : containers[0].name
      ctx.state.containerMode = mode
      ctx.state.dockerContainer = selectedContainer
      delete ctx.state[EDIT_REQUESTED_KEY]
      return
    }

    const existingName = keepContainer && typeof ctx.state.dockerContainer === 'string' ? ctx.state.dockerContainer : ''
    const containerName = resolveNewContainerName(
      ctx,
      existingName,
      `bat-server-${slugifyProfileId(ctx.profileDraft.name)}`,
      new Set(containers.map((container) => container.name)),
    )
    ctx.state.containerMode = mode
    ctx.state.dockerImage = typeof ctx.state.dockerImage === 'string' && ctx.state.dockerImage ? ctx.state.dockerImage : 'bat-server:latest'
    ctx.state.dockerContainer = containerName
    delete ctx.state[EDIT_REQUESTED_KEY]
  },
  // T0500: jumped back to -> ask for the mode again. containerMode and
  // dockerContainer stay until the re-run replaces them: this step's rollback
  // (cancel before the re-run) still needs them to find a container this run
  // created. The flag is cleared only once the step succeeds, so a retry
  // after a failed re-run asks again.
  resetForEdit(ctx) {
    ctx.state[EDIT_REQUESTED_KEY] = true
  },
  // T0444 (BUG-111): this step creates nothing; start-server does. Remove the
  // container only if this run created it (start-server's rollback normally
  // already has — this is the safety net). No flag => not ours => no-op.
  async rollback(ctx) {
    if (ctx.state.containerMode !== 'new' || typeof ctx.state.dockerContainer !== 'string') return
    if (!isContainerCreatedByWizard(ctx, ctx.state.dockerContainer)) return
    await removeContainerIfCreatedByWizard(ctx, ctx.state.dockerContainer)
  },
}

const MAX_NAME_SUFFIX = 99

/**
 * T0444 (BUG-111): "Create new" never adopts a name that already exists —
 * start-server's `docker run --name` would fail on it, and rollback must not
 * be able to reach a container the user owns. A name this run created itself
 * (re-run after jumping back) is kept. Otherwise a taken name is replaced by
 * the first free `<default>-N` and the user is told; existing containers are
 * never reused or removed.
 */
function resolveNewContainerName(
  ctx: WizardContext,
  preferred: string,
  defaultName: string,
  taken: Set<string>,
): string {
  if (preferred && (isContainerCreatedByWizard(ctx, preferred) || !taken.has(preferred))) return preferred

  let name = ''
  for (let suffix = 1; suffix <= MAX_NAME_SUFFIX && !name; suffix += 1) {
    const candidate = suffix === 1 ? defaultName : `${defaultName}-${suffix}`
    if (isContainerCreatedByWizard(ctx, candidate) || !taken.has(candidate)) name = candidate
  }
  if (!name) {
    throw wizardError(
      `Docker containers ${defaultName} through ${defaultName}-${MAX_NAME_SUFFIX} already exist. Rename the profile or choose "Use existing".`,
      'docker-container-names-exhausted',
      { name: defaultName, last: `${defaultName}-${MAX_NAME_SUFFIX}` },
    )
  }

  const conflicting = preferred || (name !== defaultName ? defaultName : '')
  if (conflicting) {
    ctx.logger.info(`Docker container ${conflicting} already exists and was left untouched; BAT will create ${name} instead.`)
    const warning = i18next.t('wizard.docker.warning.nameTaken', { taken: conflicting, name })
    if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
  }
  return name
}
