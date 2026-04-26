import type { WizardStep } from '../../wizard-runner'

function resolveProfileName(ctxName: unknown, distro: string): string {
  if (typeof ctxName === 'string' && ctxName.trim()) {
    return ctxName.trim()
  }
  return `WSL ${distro}`
}

export const writeProfileStep: WizardStep = {
  id: 'write-profile',
  title: 'Create remote profile',
  appliesTo: 'all',
  retryable: false,
  async run(ctx) {
    if (!ctx.wslDistro) {
      throw new Error('A WSL distro is required before writing the remote profile.')
    }
    if (!ctx.remoteToken) {
      throw new Error('Remote token missing; BAT cannot create the WSL remote profile.')
    }

    const port = ctx.serverPort ?? 9876
    const fingerprint = ctx.fingerprint ?? undefined
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
