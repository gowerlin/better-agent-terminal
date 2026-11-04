import type { WizardStep } from '../../wizard-runner'
import { PRECONDITION_MISSING_CODE, wizardError } from '../../error-mapper'

/**
 * T0840 (PLAN-043 W3): a verification now (T0831). plan-wsl-environment /
 * apply-wsl-environment fix systemd before this step, so here systemd must be
 * PID 1 in the distro; otherwise the step fails with `wsl-systemd-disabled`
 * instead of warning and letting write-profile fail several steps later.
 *
 * Signal: `wsl.systemdRunning` (`/proc/1/comm` = `systemd`), the same one the
 * plan uses (T0839 facts), so a `[boot] systemd=true` that has not taken effect
 * yet is "not running". With an older preload it falls back to the pre-T0840
 * `systemdEnabled` (systemctl, then the `/etc/wsl.conf` declaration).
 */
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
      throw wizardError('Select a WSL distro before checking systemd.', PRECONDITION_MISSING_CODE)
    }

    const systemdRunning = window.electronAPI.wsl.systemdRunning
    const enabled = typeof systemdRunning === 'function'
      ? await systemdRunning(ctx.wslDistro)
      : await window.electronAPI.wsl.systemdEnabled(ctx.wslDistro)
    ctx.wslSystemdEnabled = enabled

    if (!enabled) {
      throw wizardError(
        `systemd is not running in WSL distro ${ctx.wslDistro}. The BAT server runs as a systemd user service.`,
        'wsl-systemd-disabled',
        { distro: ctx.wslDistro },
      )
    }
  },
}
