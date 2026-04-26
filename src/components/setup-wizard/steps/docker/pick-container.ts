import type { WizardStep } from '../../wizard-runner'

function slugifyProfileId(name: unknown): string {
  return typeof name === 'string' && name.trim()
    ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profile'
    : 'profile'
}

export const pickContainerStep: WizardStep = {
  id: 'pick-container',
  title: 'Choose Docker container mode',
  appliesTo: ['docker-linux'],
  retryable: true,
  async run(ctx) {
    const containers = await window.electronAPI.docker.listContainers()
    const defaultMode = containers.length > 0 ? 'existing' : 'new'
    const selectedMode = typeof ctx.state.containerMode === 'string' && ctx.state.containerMode !== 'unknown'
      ? ctx.state.containerMode
      : (
          ctx.requestChoice
            ? await ctx.requestChoice({
                stepId: 'pick-container',
                title: 'Choose Docker container mode',
                description: 'Use an existing container or let BAT create and manage a dedicated one.',
                options: [
                  { value: 'new', label: 'Create new', description: 'BAT creates a new container with restart=unless-stopped.' },
                  { value: 'existing', label: 'Use existing', description: 'BAT starts an existing container without deleting it on rollback.' },
                ],
              })
            : defaultMode
        )

    const mode = selectedMode === 'existing' ? 'existing' : 'new'
    ctx.state.containerMode = mode

    if (mode === 'existing') {
      if (containers.length === 0) throw new Error('No Docker containers found. Create one first or switch to "Create new".')
      const selectedContainer = typeof ctx.state.dockerContainer === 'string' && ctx.state.dockerContainer
        ? ctx.state.dockerContainer
        : containers[0].name
      ctx.state.dockerContainer = selectedContainer
      return
    }

    const existingName = typeof ctx.state.dockerContainer === 'string' ? ctx.state.dockerContainer : ''
    ctx.state.dockerImage = typeof ctx.state.dockerImage === 'string' && ctx.state.dockerImage ? ctx.state.dockerImage : 'bat-server:latest'
    ctx.state.dockerContainer = existingName || `bat-server-${slugifyProfileId(ctx.profileDraft.name)}`
  },
  async rollback(ctx) {
    if (ctx.state.containerMode !== 'new' || typeof ctx.state.dockerContainer !== 'string') return
    await window.electronAPI.docker.removeContainer(ctx.state.dockerContainer)
  },
}
