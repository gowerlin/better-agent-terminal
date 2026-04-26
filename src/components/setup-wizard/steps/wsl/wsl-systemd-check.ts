import type { WizardStep } from '../../wizard-runner'

export const wslSystemdCheckStep: WizardStep = {
  id: 'wsl-systemd-check',
  title: 'Check systemd availability',
  appliesTo: ['wsl-linux'],
  retryable: true,
  async run(ctx) {
    if (!ctx.wslDistro) {
      throw new Error('Select a WSL distro before checking systemd.')
    }

    const enabled = await window.electronAPI.wsl.systemdEnabled(ctx.wslDistro)
    ctx.wslSystemdEnabled = enabled

    if (!enabled) {
      const warning = 'systemd is not enabled. BAT will fall back to `wsl exec` startup until T0275 adds the service flow.'
      if (!ctx.warnings.includes(warning)) {
        ctx.warnings.push(warning)
      }
    }
  },
}
