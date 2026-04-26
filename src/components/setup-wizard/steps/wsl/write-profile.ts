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

function resolveSshProfileName(ctxName: unknown, sshHost: string): string {
  if (typeof ctxName === 'string' && ctxName.trim()) {
    return ctxName.trim()
  }
  return `SSH ${sshHost}`
}

export const writeProfileStep: WizardStep = {
  id: 'write-profile',
  title: 'Create remote profile',
  appliesTo: 'all',
  retryable: false,
  labelKey: 'wizard.shared.step.writeProfile.label',
  descriptionKey: 'wizard.shared.step.writeProfile.description',
  groupKey: 'wizard.group.finalization',
  editableFromFailure: false,
  async run(ctx) {
    const port = ctx.serverPort ?? 9876
    const fingerprint = ctx.fingerprint ?? undefined

    // T0287: SSH branch — wires ctx.targetOS=ssh-linux/ssh-darwin into a
    // remote profile carrying ssh-specific metadata (host/user/tunnel mode/
    // serverHome) so createTranslator can build an SshPathTranslator on
    // first connect.
    if (ctx.targetOS === 'ssh-linux' || ctx.targetOS === 'ssh-darwin') {
      const sshState = ctx.state as {
        sshHost?: string
        sshUser?: string
        sshPort?: number
        sshKeyPath?: string
        sshAlias?: string
        sshTunnelMode?: 'tunnel' | 'direct'
        sshInstallPath?: string
        sshServerHome?: string
      }
      if (!sshState.sshHost) {
        throw new Error('SSH host is required before writing the remote profile.')
      }
      if (!ctx.remoteToken) {
        throw new Error('Remote token missing; BAT cannot create the SSH remote profile.')
      }
      const serverHome = ctx.serverMetadata?.serverHome ?? sshState.sshServerHome
      const profile = await window.electronAPI.profile.create(resolveSshProfileName(ctx.profileDraft.name, sshState.sshHost), {
        type: 'remote',
        remoteHost: 'localhost',
        remotePort: port,
        remoteToken: ctx.remoteToken,
        remoteFingerprint: fingerprint,
      })
      ctx.createdProfileId = profile.id

      // Map ctx state -> ProfileEntry schema: sshTunnelMode boolean, schema
      // doesn't carry sshAlias / sshInstallPath (alias is resolved at connect
      // time via ssh-config; install path is a runtime artifact, not a join key).
      const updated = await window.electronAPI.profile.update(profile.id, {
        targetOS: ctx.targetOS,
        sshHost: sshState.sshHost,
        sshUser: sshState.sshUser,
        sshPort: sshState.sshPort,
        sshKeyPath: sshState.sshKeyPath,
        useSshTunnel: sshState.sshTunnelMode !== 'direct',
        serverHome,
        remoteHost: 'localhost',
        remotePort: port,
        remoteToken: ctx.remoteToken,
        remoteFingerprint: fingerprint,
      })
      if (!updated) {
        throw new Error('Failed to persist SSH profile metadata.')
      }
      return
    }

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
