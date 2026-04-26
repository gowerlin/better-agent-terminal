import type { WizardStep } from '../../wizard-runner'

export const detectEnvStep: WizardStep = {
  id: 'detect-env',
  title: 'Detect Windows + WSL environment',
  appliesTo: 'all',
  retryable: true,
  async run(ctx) {
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
