import i18next from 'i18next'
import type { WizardContext, WizardStep } from '../../wizard-runner'

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

    if (!startResult.ok) throw new Error(startResult.error ?? `Failed to start Docker container ${containerName}.`)
    // Before the health wait: a pre-fix image never turns healthy, and the
    // warning is what tells the user why.
    if (startResult.exposure) warnLegacyContainer(ctx, containerName, startResult.exposure)

    ctx.remoteToken = startResult.token ?? (typeof ctx.state.remoteToken === 'string' ? ctx.state.remoteToken : undefined)
    ctx.state.remoteToken = ctx.remoteToken
    ctx.systemdServiceActive = true

    await waitForHealthy(containerName)
  },
  async rollback(ctx) {
    const containerName = typeof ctx.state.dockerContainer === 'string' ? ctx.state.dockerContainer : ''
    if (!containerName) return
    if (ctx.state.containerMode === 'new') {
      await window.electronAPI.docker.removeContainer(containerName)
      return
    }
    await window.electronAPI.docker.stopContainer(containerName)
  },
}
