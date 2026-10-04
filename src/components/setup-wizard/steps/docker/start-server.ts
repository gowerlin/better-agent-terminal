import i18next from 'i18next'
import type { WizardContext, WizardStep } from '../../wizard-runner'
import {
  DOCKER_OWNERSHIP_KEYS,
  isContainerCreatedByWizard,
  isContainerStartedByWizard,
  isNameConflictError,
  removeContainerIfCreatedByWizard,
} from './ownership'

// BUG-097 (T0418): engines without HEALTHCHECK --start-interval run the first
// probe only after the 30s interval (docker/Dockerfile), so the container stays
// `starting` that long. Wait past interval + timeout instead of the old 5s.
const HEALTH_POLL_INTERVAL_MS = 500
const HEALTH_WAIT_MS = 45_000

async function waitForHealthy(name: string): Promise<void> {
  for (let attempt = 0; attempt < HEALTH_WAIT_MS / HEALTH_POLL_INTERVAL_MS; attempt += 1) {
    const health = await window.electronAPI.docker.getContainerHealth(name)
    if (!health.ok) throw new Error(health.error ?? `Failed to read Docker health for ${name}.`)
    if (health.health === 'healthy' || health.health === 'none') return
    if (health.health === 'unhealthy') throw new Error(`Docker container ${name} reported unhealthy.`)
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS))
  }

  throw new Error(`Timed out waiting for Docker container ${name} to become healthy.`)
}

type DockerExposure = NonNullable<Awaited<ReturnType<typeof window.electronAPI.docker.startContainer>>['exposure']>

function pushWarning(ctx: WizardContext, warning: string): void {
  if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
}

/**
 * T0427 (BUG-097 follow-up): an existing container created before the fix is
 * reported, never changed — recreating it is the user's call (it may hold
 * data in volumes / mounts). Text guidance only; the wizard has no
 * recreate action for existing containers.
 */
function warnLegacyContainer(ctx: WizardContext, name: string, exposure: DockerExposure): void {
  if (exposure.exposed) {
    // docker reports an unset HostIp as '' — that means every host interface.
    const hostIps = exposure.hostIps.map((ip) => ip || '0.0.0.0').join(', ')
    pushWarning(ctx, i18next.t('wizard.docker.warning.containerPortExposed', { name, hostIps }))
  }
  if (exposure.legacyImage) {
    pushWarning(ctx, i18next.t('wizard.docker.warning.containerLegacyImage', { name }))
  }
}

export const startDockerServerStep: WizardStep = {
  id: 'start-server',
  title: 'Start Docker container',
  appliesTo: ['docker-linux'],
  retryable: true,
  labelKey: 'wizard.docker.step.startServer.label',
  descriptionKey: 'wizard.docker.step.startServer.description',
  groupKey: 'wizard.group.deployment',
  editableFromFailure: false,
  async run(ctx) {
    const containerName = typeof ctx.state.dockerContainer === 'string' ? ctx.state.dockerContainer : ''
    if (!containerName) throw new Error('Container name is missing.')

    const containerMode = ctx.state.containerMode
    const port = typeof ctx.state.serverPort === 'number' ? ctx.state.serverPort : (ctx.serverPort ?? 9876)
    ctx.serverPort = port

    // Re-run after an earlier attempt of this run created the container.
    const createdEarlier = containerMode === 'new' && isContainerCreatedByWizard(ctx, containerName)
    if (containerMode === 'new') await claimNewContainer(ctx, containerName)
    else await recordExistingContainerState(ctx, containerName)

    const startResult = await window.electronAPI.docker.startContainer(
      containerName,
      containerMode === 'new'
        ? {
            createIfMissing: true,
            image: typeof ctx.state.dockerImage === 'string' ? ctx.state.dockerImage : 'bat-server:latest',
            mounts: Array.isArray(ctx.state.dockerMounts) ? ctx.state.dockerMounts as Array<{ host: string; container: string }> : [],
            port,
            restartPolicy: 'unless-stopped',
            token: typeof ctx.state.remoteToken === 'string' ? ctx.state.remoteToken : undefined,
            dataVolume: `bat-server-${containerName}-data`,
          }
        : { port },
    )

    if (!startResult.ok) {
      // Lost a race for the name: whatever holds it now is not ours.
      if (containerMode === 'new' && !createdEarlier && isNameConflictError(startResult.error)) {
        delete ctx.state[DOCKER_OWNERSHIP_KEYS.containerCreated]
      }
      throw new Error(startResult.error ?? `Failed to start Docker container ${containerName}.`)
    }
    // Before the health wait: a pre-fix image never turns healthy, and the
    // warning is what tells the user why.
    if (startResult.exposure) warnLegacyContainer(ctx, containerName, startResult.exposure)

    ctx.remoteToken = startResult.token ?? (typeof ctx.state.remoteToken === 'string' ? ctx.state.remoteToken : undefined)
    ctx.state.remoteToken = ctx.remoteToken
    ctx.systemdServiceActive = true

    await waitForHealthy(containerName)
  },
  // T0444 (BUG-111): undo only what run() did — remove the container it
  // created, or stop an existing container it started. Anything else
  // (container was already running, ownership unknown) is left alone.
  async rollback(ctx) {
    const containerName = typeof ctx.state.dockerContainer === 'string' ? ctx.state.dockerContainer : ''
    if (!containerName) return
    if (ctx.state.containerMode === 'new') {
      await removeContainerIfCreatedByWizard(ctx, containerName)
      return
    }
    if (!isContainerStartedByWizard(ctx, containerName)) {
      if (ctx.state[DOCKER_OWNERSHIP_KEYS.containerWasRunningBefore] === true) {
        ctx.logger.info(`Leaving Docker container ${containerName} running: it was running before setup.`)
      } else {
        ctx.logger.warn(`Not stopping Docker container ${containerName}: this setup run did not start it.`)
      }
      return
    }
    const result = await window.electronAPI.docker.stopContainer(containerName)
    if (result && result.ok === false) {
      ctx.logger.warn(`Failed to stop Docker container ${containerName}: ${result.error ?? 'unknown error'}`)
      return
    }
    delete ctx.state[DOCKER_OWNERSHIP_KEYS.containerStarted]
  },
}

/**
 * T0444 (BUG-111): "Create new" must create the container, never adopt one.
 * Re-check right before `docker run` (pick-container may have run long ago)
 * and claim the name: `docker run --name` can only ever create our container,
 * so the claim is set before the call to cover a run that creates the
 * container and then fails (e.g. port already allocated).
 */
async function claimNewContainer(ctx: WizardContext, name: string): Promise<void> {
  if (isContainerCreatedByWizard(ctx, name)) return
  const containers = await window.electronAPI.docker.listContainers()
  if (containers.some((container) => container.name === name)) {
    throw new Error(
      `Docker container ${name} already exists and was not created by this setup run. BAT will not reuse or remove it — go back to "Choose Docker container mode" to pick another name or use the existing container.`,
    )
  }
  ctx.state[DOCKER_OWNERSHIP_KEYS.containerCreated] = name
}

/**
 * T0444 (BUG-111): remember whether the existing container was already
 * running, so rollback stops it only if this run started it. Inspect failure
 * leaves ownership unknown, and unknown means rollback does not stop it.
 */
async function recordExistingContainerState(ctx: WizardContext, name: string): Promise<void> {
  // Started by an earlier attempt of this run: it is running now because of us.
  if (isContainerStartedByWizard(ctx, name)) return
  delete ctx.state[DOCKER_OWNERSHIP_KEYS.containerStarted]
  delete ctx.state[DOCKER_OWNERSHIP_KEYS.containerWasRunningBefore]

  let running: boolean | undefined
  try {
    const inspection = await window.electronAPI.docker.inspectContainer(name)
    running = typeof inspection?.state?.running === 'boolean' ? inspection.state.running : undefined
  } catch (error) {
    ctx.logger.warn(`Unable to inspect Docker container ${name} before starting it: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (running === undefined) return

  ctx.state[DOCKER_OWNERSHIP_KEYS.containerWasRunningBefore] = running
  if (!running) ctx.state[DOCKER_OWNERSHIP_KEYS.containerStarted] = name
}
