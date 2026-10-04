import type { WizardContext, WizardStep } from '../../wizard-runner'
import { isContainerCreatedByWizard, removeContainerIfCreatedByWizard } from './ownership'

function slugifyProfileId(name: unknown): string {
  return typeof name === 'string' && name.trim()
    ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profile'
    : 'profile'
}

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
    const selectedMode = typeof ctx.state.containerMode === 'string' && ctx.state.containerMode !== 'unknown'
      ? ctx.state.containerMode
      : (
          ctx.requestChoice
            ? await ctx.requestChoice({
                stepId: 'pick-container',
                title: 'Choose Docker container mode',
                description: 'Use an existing container or let BAT create and manage a dedicated one.',
                options: [
                  { value: 'new', label: 'Create new', description: 'BAT creates a new container with restart=unless-stopped.' },
                  { value: 'existing', label: 'Use existing', description: 'BAT starts an existing container without deleting it on rollback.' },
                ],
              })
            : defaultMode
        )

    const mode = selectedMode === 'existing' ? 'existing' : 'new'
    ctx.state.containerMode = mode

    if (mode === 'existing') {
      if (containers.length === 0) throw new Error('No Docker containers found. Create one first or switch to "Create new".')
      const selectedContainer = typeof ctx.state.dockerContainer === 'string' && ctx.state.dockerContainer
        ? ctx.state.dockerContainer
        : containers[0].name
      ctx.state.dockerContainer = selectedContainer
      return
    }

    const existingName = typeof ctx.state.dockerContainer === 'string' ? ctx.state.dockerContainer : ''
    ctx.state.dockerImage = typeof ctx.state.dockerImage === 'string' && ctx.state.dockerImage ? ctx.state.dockerImage : 'bat-server:latest'
    ctx.state.dockerContainer = resolveNewContainerName(
      ctx,
      existingName,
      `bat-server-${slugifyProfileId(ctx.profileDraft.name)}`,
      new Set(containers.map((container) => container.name)),
    )
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
    throw new Error(
      `Docker containers ${defaultName} through ${defaultName}-${MAX_NAME_SUFFIX} already exist. Rename the profile or choose "Use existing".`,
    )
  }

  const conflicting = preferred || (name !== defaultName ? defaultName : '')
  if (conflicting) {
    const warning = `Docker container ${conflicting} already exists and was left untouched; BAT will create ${name} instead.`
    ctx.logger.info(warning)
    if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
  }
  return name
}
