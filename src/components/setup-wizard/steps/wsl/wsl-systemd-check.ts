import i18next from 'i18next'
import type { WizardStep } from '../../wizard-runner'

export const wslSystemdCheckStep: WizardStep = {
  id: 'wsl-systemd-check',
  title: 'Check systemd availability',
  appliesTo: ['wsl-linux'],
  retryable: true,
  labelKey: 'wizard.wsl.step.systemdCheck.label',
  descriptionKey: 'wizard.wsl.step.systemdCheck.description',
  groupKey: 'wizard.group.detection',
  editableFromFailure: false,
  async run(ctx) {
    if (!ctx.wslDistro) {
      throw new Error('Select a WSL distro before checking systemd.')
    }

    const enabled = await window.electronAPI.wsl.systemdEnabled(ctx.wslDistro)
    ctx.wslSystemdEnabled = enabled

    if (!enabled) {
      const warning = i18next.t('wizard.wsl.warning.systemdDisabled')
      if (!ctx.warnings.includes(warning)) {
        ctx.warnings.push(warning)
      }
    }
  },
}
