import type { WizardStep } from '../../wizard-runner'

function basename(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || 'workspace'
}

function defaultContainerPath(hostPath: string): string {
  return `/workspace/${basename(hostPath)}`
}

export const configureMountsStep: WizardStep = {
  id: 'configure-mounts',
  title: 'Configure bind mounts',
  appliesTo: ['docker-linux'],
  retryable: true,
  labelKey: 'wizard.docker.step.configureMounts.label',
  descriptionKey: 'wizard.docker.step.configureMounts.description',
  groupKey: 'wizard.group.detection',
  editableFromFailure: true,
  async run(ctx) {
    let mounts = Array.isArray(ctx.state.dockerMounts)
      ? ctx.state.dockerMounts as Array<{ host: string; container: string }>
      : []

    if (mounts.length === 0) {
      const selected = await window.electronAPI.dialog.selectFolder()
      const hostPath = selected?.[0]
      if (!hostPath) throw new Error('Select at least one host folder to mount into the Docker container.')
      mounts = [{ host: hostPath, container: defaultContainerPath(hostPath) }]
    }

    const validation = await window.electronAPI.docker.validateMounts(mounts)
    if (!validation.ok) throw new Error(validation.errors.join('\n'))

    ctx.state.dockerMounts = mounts
    ctx.profileDraft.dockerMounts = mounts
  },
  async rollback(ctx) {
    ctx.state.dockerMounts = []
    delete ctx.profileDraft.dockerMounts
  },
}
