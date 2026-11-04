import i18next from 'i18next'
import type { WizardChoiceOption, WizardContext, WizardStep } from '../../wizard-runner'
import { wizardError } from '../../error-mapper'
import { askDockerBaseImage, currentDockerImage } from './base-image'
import { isContainerCreatedByWizard, removeContainerIfCreatedByWizard } from './ownership'

function slugifyProfileId(name: unknown): string {
  return typeof name === 'string' && name.trim()
    ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profile'
    : 'profile'
}

/** T0500: set by resetForEdit; the next run asks for the mode even if one is stored. */
const EDIT_REQUESTED_KEY = 'pickContainerEditRequested'

/**
 * T0851: value of the "Create new instead" option of the container prompt.
 * Docker container names start with a letter or digit, so it never collides.
 */
export const DOCKER_CREATE_NEW_CHOICE = '__create-new__'

export type DockerContainerEntry = Awaited<ReturnType<Window['electronAPI']['docker']['listContainers']>>[number]

/** T0851: why "Use existing" cannot use a container (the two errors start-server used to raise). */
export type DockerContainerUnusableReason = 'unpublished' | 'port-in-use'

export function dockerContainerUnusableReason(
  container: Pick<DockerContainerEntry, 'publishedPort'>,
  activeServerPort: number | null | undefined,
): DockerContainerUnusableReason | null {
  // `undefined` = unknown (inspect failed / older host): start-server checks it, as before T0851.
  if (container.publishedPort === undefined) return null
  if (container.publishedPort === null) return 'unpublished'
  if (activeServerPort && container.publishedPort === activeServerPort) return 'port-in-use'
  return null
}

function containerStateText(state: string): string {
  if (state === 'running') return i18next.t('wizard.docker.pickContainer.container.running')
  if (state === 'exited' || state === 'created') return i18next.t('wizard.docker.pickContainer.container.stopped')
  return state
}

/**
 * T0851 (PLAN-052 W2): one option per container for "Use existing". Label =
 * name; description = image · state · published port · "created by BAT".
 * Unusable containers (no published `9876/tcp`, or published on the port
 * this BAT's RemoteServer listens on) are listed disabled with the reason.
 * Order: usable first, then created by BAT, then running; ties keep the
 * `docker ps` order (newest first).
 */
export function buildDockerContainerChoices(
  containers: readonly DockerContainerEntry[],
  activeServerPort: number | null | undefined,
): WizardChoiceOption[] {
  const ranked = containers
    .filter((container) => typeof container.name === 'string' && container.name)
    .map((container, index) => ({ container, index, reason: dockerContainerUnusableReason(container, activeServerPort) }))
  ranked.sort((a, b) =>
    Number(a.reason !== null) - Number(b.reason !== null)
    || Number(!a.container.batCreated) - Number(!b.container.batCreated)
    || Number(a.container.state !== 'running') - Number(b.container.state !== 'running')
    || a.index - b.index)

  return ranked.map(({ container, reason }) => {
    const parts = [container.image, containerStateText(container.state)].filter(Boolean)
    if (typeof container.publishedPort === 'number') {
      parts.push(i18next.t('wizard.docker.pickContainer.container.published', { port: String(container.publishedPort) }))
    } else if (container.publishedPort === null) {
      parts.push(i18next.t('wizard.docker.pickContainer.container.unpublished'))
    }
    if (container.batCreated) parts.push(i18next.t('wizard.docker.pickContainer.container.batCreated'))
    const option: WizardChoiceOption = {
      value: container.name,
      label: container.name,
      description: parts.join(' · '),
    }
    if (reason) {
      option.disabled = true
      option.disabledReasonKey = reason === 'unpublished'
        ? 'wizard.docker.pickContainer.container.disabled.unpublished'
        : 'wizard.docker.pickContainer.container.disabled.portInUse'
      option.disabledReasonParams = { port: String(container.publishedPort ?? '') }
    }
    return option
  })
}

/** T0851: the port this BAT's RemoteServer listens on, or null (not running / unknown). */
async function activeRemoteServerPort(): Promise<number | null> {
  try {
    const status = await window.electronAPI.remote?.serverStatus?.()
    return status?.running && typeof status.port === 'number' ? status.port : null
  } catch {
    return null
  }
}

function noUsableContainersError(hasContainers: boolean): Error {
  return hasContainers
    ? wizardError('None of your Docker containers can be used: none publishes the BAT server port (9876/tcp) on a host port other than this BAT\'s remote server port. Switch to "Create new".', 'docker-no-containers')
    : wizardError('No Docker containers found. Create one first or switch to "Create new".', 'docker-no-containers')
}

/**
 * T0851: which existing container to use. `ask` (the mode prompt was shown
 * this run): the user picks from the list. Otherwise the stored container is
 * kept, else the first usable one. Returns DOCKER_CREATE_NEW_CHOICE when the
 * user switches to "Create new" because no container can be used. Only
 * reads `docker ps` / `docker inspect` (BUG-111: user containers untouched).
 */
async function chooseExistingContainer(
  ctx: WizardContext,
  containers: readonly DockerContainerEntry[],
  storedContainer: string,
  ask: boolean,
): Promise<string> {
  if (!ask && storedContainer) return storedContainer
  const choices = buildDockerContainerChoices(containers, await activeRemoteServerPort())
  const usable = choices.filter((choice) => !choice.disabled)

  if (!ask || !ctx.requestChoice) {
    if (usable.length === 0) throw noUsableContainersError(choices.length > 0)
    return usable[0].value
  }

  if (usable.length === 0) {
    // T0851: an explanation and a way out instead of the docker-no-containers error.
    const answer = await ctx.requestChoice({
      stepId: 'pick-container',
      title: i18next.t('wizard.docker.pickContainer.none.title'),
      description: i18next.t(choices.length > 0
        ? 'wizard.docker.pickContainer.none.allUnusable'
        : 'wizard.docker.pickContainer.none.empty'),
      options: [
        ...choices,
        {
          value: DOCKER_CREATE_NEW_CHOICE,
          label: 'Create new instead',
          labelKey: 'wizard.docker.pickContainer.none.createNew',
        },
      ],
    })
    if (answer === DOCKER_CREATE_NEW_CHOICE) return DOCKER_CREATE_NEW_CHOICE
    throw noUsableContainersError(choices.length > 0)
  }

  const answer = await ctx.requestChoice({
    stepId: 'pick-container',
    title: i18next.t('wizard.docker.pickContainer.choose.title'),
    description: i18next.t('wizard.docker.pickContainer.choose.description'),
    options: choices,
  })
  // The step validates what it gets back: only a listed, usable container.
  const picked = usable.find((choice) => choice.value === answer)
  if (!picked) throw noUsableContainersError(true)
  return picked.value
}

/**
 * T0851: mounts belong to the container they were taken from (or were picked
 * for). When a re-run switches mode or container, drop them so
 * configure-mounts reads / asks again instead of keeping stale ones.
 */
function forgetMounts(ctx: WizardContext): void {
  ctx.state.dockerMounts = []
  delete ctx.profileDraft.dockerMounts
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
    const previousMode = ctx.state.containerMode
    const hasPreviousMode = typeof previousMode === 'string' && previousMode !== 'unknown'
    const previousContainer = typeof ctx.state.dockerContainer === 'string' ? ctx.state.dockerContainer : ''
    // T0500: after a jump back the stored mode is the fallback only when there
    // is no prompt to ask with.
    const editRequested = ctx.state[EDIT_REQUESTED_KEY] === true && typeof ctx.requestChoice === 'function'
    // T0851: the mode prompt is shown (first run, or a jump back) -> the container prompt is too.
    const askMode = (editRequested || !hasPreviousMode) && typeof ctx.requestChoice === 'function'
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

    let mode: 'new' | 'existing' = selectedMode === 'existing' ? 'existing' : 'new'

    // T0502: containerMode / dockerContainer are written only once the choice
    // checks out. A failed pick leaves the stored mode as it was, so a retry
    // asks again (no stored mode) instead of repeating the failing choice, and
    // this step's rollback still sees the mode and container of the earlier
    // run that may have created one.
    if (mode === 'existing') {
      // T0500: a container picked under the other mode is not carried over
      // (an existing container is never the "new" name, and vice versa).
      const storedContainer = (!editRequested || previousMode === 'existing') ? previousContainer : ''
      // T0851: the user picks the container whenever the mode prompt was shown.
      const selectedContainer = await chooseExistingContainer(ctx, containers, storedContainer, askMode)
      if (selectedContainer !== DOCKER_CREATE_NEW_CHOICE) {
        if (hasPreviousMode && (previousMode !== 'existing' || previousContainer !== selectedContainer)) forgetMounts(ctx)
        ctx.state.containerMode = mode
        ctx.state.dockerContainer = selectedContainer
        delete ctx.state[EDIT_REQUESTED_KEY]
        return
      }
      // T0851: "Create new instead" from the no-usable-container prompt.
      mode = 'new'
    }

    const keepContainer = !editRequested || previousMode === 'new'
    const existingName = keepContainer ? previousContainer : ''
    const containerName = resolveNewContainerName(
      ctx,
      existingName,
      `bat-server-${slugifyProfileId(ctx.profileDraft.name)}`,
      new Set(containers.map((container) => container.name)),
    )
    // T0853 task 1: the base image field, asked whenever the mode prompt was
    // shown (first run, or a jump back); otherwise the stored image is kept.
    const image = askMode ? await askDockerBaseImage(ctx) : currentDockerImage(ctx)
    if (hasPreviousMode && previousMode !== 'new') forgetMounts(ctx)
    ctx.state.containerMode = mode
    ctx.state.dockerImage = image
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
