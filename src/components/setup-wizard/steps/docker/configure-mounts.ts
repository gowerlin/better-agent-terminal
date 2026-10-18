import type { WizardStep } from '../../wizard-runner'
import { wizardError } from '../../error-mapper'

function basename(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || 'workspace'
}

function defaultContainerPath(hostPath: string): string {
  return `/workspace/${basename(hostPath)}`
}

/** T0500: set by resetForEdit; the next run opens the folder picker even if mounts are stored. */
const EDIT_REQUESTED_KEY = 'dockerMountsEditRequested'

export const configureMountsStep: WizardStep = {
  id: 'configure-mounts',
  title: 'Configure bind mounts',
  appliesTo: ['docker-linux'],
  // T0330 (PLAN-032 Sprint 2): folder picker dialog blocks for user input.
  // No requestChoice today, but `kind: 'input'` correctly signals the
  // semantic — Sprint 3 may wrap selectFolder() the same way.
  kind: 'input',
  retryable: true,
  labelKey: 'wizard.docker.step.configureMounts.label',
  descriptionKey: 'wizard.docker.step.configureMounts.description',
  groupKey: 'wizard.group.detection',
  editableFromFailure: true,
  async run(ctx) {
    let mounts = Array.isArray(ctx.state.dockerMounts)
      ? ctx.state.dockerMounts as Array<{ host: string; container: string }>
      : []
    const editRequested = ctx.state[EDIT_REQUESTED_KEY] === true

    if (mounts.length === 0 || editRequested) {
      const selected = await window.electronAPI.dialog.selectFolder()
      const hostPath = selected?.[0]
      if (hostPath) {
        mounts = [{ host: hostPath, container: defaultContainerPath(hostPath) }]
      } else if (mounts.length === 0) {
        throw wizardError('Select at least one host folder to mount into the Docker container.', 'docker-mounts-none')
      } else {
        // T0500: the folder dialog has no default path, so closing it after a
        // jump back keeps the previous mounts instead of failing.
        ctx.logger.info('No folder selected; keeping the previous bind mounts.')
      }
    }

    const validation = await window.electronAPI.docker.validateMounts(mounts)
    if (!validation.ok) throw wizardError(validation.errors.join('\n'), 'docker-mounts-invalid')

    ctx.state.dockerMounts = mounts
    ctx.profileDraft.dockerMounts = mounts
    delete ctx.state[EDIT_REQUESTED_KEY]
  },
  // T0500: jumped back to -> open the folder picker again even though mounts
  // are stored. Cleared once the step succeeds, so a retry asks again.
  resetForEdit(ctx) {
    ctx.state[EDIT_REQUESTED_KEY] = true
  },
  async rollback(ctx) {
    ctx.state.dockerMounts = []
    delete ctx.profileDraft.dockerMounts
  },
}
