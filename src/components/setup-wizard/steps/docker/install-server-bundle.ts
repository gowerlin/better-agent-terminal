import type { WizardStep } from '../../wizard-runner'

export const installDockerServerBundleStep: WizardStep = {
  id: 'install-server-bundle',
  title: 'Verify BAT server bundle',
  appliesTo: ['docker-linux'],
  retryable: true,
  async run(ctx) {
    const mode = ctx.state.containerMode
    const image = typeof ctx.state.dockerImage === 'string' ? ctx.state.dockerImage : 'bat-server:latest'
    if (mode === 'new') {
      ctx.serverInstallPath = '/opt/bat-server'
      ctx.logger.info(`Docker image ${image} will provide the BAT server bundle.`)
      return
    }

    if (mode !== 'existing' || typeof ctx.state.dockerContainer !== 'string') {
      throw new Error('Choose a Docker container before validating the BAT server bundle.')
    }

    const inspection = await window.electronAPI.docker.inspectContainer(ctx.state.dockerContainer)
    if (!inspection.image) throw new Error(`Unable to inspect Docker container ${ctx.state.dockerContainer}.`)

    ctx.serverInstallPath = '/opt/bat-server'
    const warning = `Existing container ${ctx.state.dockerContainer} must already contain /opt/bat-server.`
    if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
  },
  async rollback() {
    return
  },
}
