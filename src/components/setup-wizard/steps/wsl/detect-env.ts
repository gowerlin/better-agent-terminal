import type { WizardStep } from '../../wizard-runner'

export const detectEnvStep: WizardStep = {
  id: 'detect-env',
  title: 'Detect target environment',
  appliesTo: 'all',
  retryable: true,
  async run(ctx) {
    if (ctx.targetOS === 'docker-linux') {
      const status = await window.electronAPI.docker.status()
      if (!status.available) {
        throw new Error(status.error || 'Docker is not available on this machine.')
      }
      ctx.logger.info(`Docker detected (${status.version ?? 'version unknown'}).`)
      return
    }

    if (window.electronAPI.platform !== 'win32') {
      throw new Error('WSL setup is only available from the Windows BAT client.')
    }

    try {
      await window.electronAPI.wsl.list()
    } catch (error) {
      throw new Error(
        `Unable to detect WSL. Install WSL2 first, then retry. ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    ctx.logger.info('WSL environment detected.')
  },
}
