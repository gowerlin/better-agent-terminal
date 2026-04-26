import type { WizardStep } from '../../wizard-runner'

async function waitForHealthy(name: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const health = await window.electronAPI.docker.getContainerHealth(name)
    if (!health.ok) throw new Error(health.error ?? `Failed to read Docker health for ${name}.`)
    if (health.health === 'healthy' || health.health === 'none') return
    if (health.health === 'unhealthy') throw new Error(`Docker container ${name} reported unhealthy.`)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for Docker container ${name} to become healthy.`)
}

export const startDockerServerStep: WizardStep = {
  id: 'start-server',
  title: 'Start Docker container',
  appliesTo: ['docker-linux'],
  retryable: true,
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
        : undefined,
    )

    if (!startResult.ok) throw new Error(startResult.error ?? `Failed to start Docker container ${containerName}.`)

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
