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
  // PLAN-007 T0289 — RFC C-3 best-effort rollback. For "new" mode the
  // pick-container rollback already removes the whole container so there is
  // nothing to clean up here. For "existing" mode we attempt to remove the
  // install path inside the user's container; failures warn-log only.
  async rollback(ctx) {
    if (ctx.state.containerMode !== 'existing') return
    if (typeof ctx.state.dockerContainer !== 'string' || !ctx.serverInstallPath) return
    const result = await window.electronAPI.docker.execCommand(ctx.state.dockerContainer, [
      'rm',
      '-rf',
      ctx.serverInstallPath,
    ])
    if (!result.ok) {
      ctx.logger.warn(`Failed to clean BAT install path inside container ${ctx.state.dockerContainer}: ${result.error}`)
      return
    }
    ctx.serverInstallPath = undefined
  },
}
