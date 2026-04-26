import type { WizardStep } from '../../wizard-runner'

function resolveProfileName(ctxName: unknown, distro: string): string {
  if (typeof ctxName === 'string' && ctxName.trim()) {
    return ctxName.trim()
  }
  return `WSL ${distro}`
}

function resolveDockerProfileName(ctxName: unknown, container: string): string {
  if (typeof ctxName === 'string' && ctxName.trim()) {
    return ctxName.trim()
  }
  return `Docker ${container}`
}

export const writeProfileStep: WizardStep = {
  id: 'write-profile',
  title: 'Create remote profile',
  appliesTo: 'all',
  retryable: false,
  async run(ctx) {
    const port = ctx.serverPort ?? 9876
    const fingerprint = ctx.fingerprint ?? undefined

    if (ctx.targetOS === 'docker-linux') {
      const containerName = typeof ctx.state.dockerContainer === 'string' ? ctx.state.dockerContainer : ''
      if (!containerName) {
        throw new Error('A Docker container is required before writing the remote profile.')
      }
      if (!ctx.remoteToken) {
        throw new Error('Remote token missing; BAT cannot create the Docker remote profile.')
      }

      const dockerMounts = Array.isArray(ctx.state.dockerMounts)
        ? ctx.state.dockerMounts as Array<{ host: string; container: string }>
        : []
      const profile = await window.electronAPI.profile.create(resolveDockerProfileName(ctx.profileDraft.name, containerName), {
        type: 'remote',
        remoteHost: 'localhost',
        remotePort: port,
        remoteToken: ctx.remoteToken,
        remoteFingerprint: fingerprint,
      })
      ctx.createdProfileId = profile.id

      const updated = await window.electronAPI.profile.update(profile.id, {
        targetOS: 'docker-linux',
        dockerContainer: containerName,
        dockerMounts,
        remoteHost: 'localhost',
        remotePort: port,
        remoteToken: ctx.remoteToken,
        remoteFingerprint: fingerprint,
      })
      if (!updated) {
        throw new Error('Failed to persist Docker profile metadata.')
      }
      return
    }

    if (!ctx.wslDistro) {
      throw new Error('A WSL distro is required before writing the remote profile.')
    }
    if (!ctx.remoteToken) {
      throw new Error('Remote token missing; BAT cannot create the WSL remote profile.')
    }

    const profile = await window.electronAPI.profile.create(resolveProfileName(ctx.profileDraft.name, ctx.wslDistro), {
      type: 'remote',
      remoteHost: 'localhost',
      remotePort: port,
      remoteToken: ctx.remoteToken,
      remoteFingerprint: fingerprint,
    })
    ctx.createdProfileId = profile.id

    const updated = await window.electronAPI.profile.update(profile.id, {
      targetOS: 'wsl-linux',
      wslDistro: ctx.wslDistro,
      remoteHost: 'localhost',
      remotePort: port,
      remoteToken: ctx.remoteToken,
      remoteFingerprint: fingerprint,
    })
    if (!updated) {
      throw new Error('Failed to persist WSL profile metadata.')
    }
  },
  async rollback(ctx) {
    if (!ctx.createdProfileId) {
      return
    }
    await window.electronAPI.profile.delete(ctx.createdProfileId)
    ctx.createdProfileId = undefined
  },
}
