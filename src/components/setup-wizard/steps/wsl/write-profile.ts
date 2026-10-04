import type { WizardContext, WizardStep } from '../../wizard-runner'

/**
 * T0444 (BUG-111): every profile this step creates is recorded, so a re-run
 * after a create-then-update failure does not orphan the first profile.
 * `createdProfileId` stays the latest one (what the shell opens on done).
 */
function recordCreatedProfile(ctx: WizardContext, id: string): void {
  ctx.createdProfileId = id
  const ids = ctx.createdProfileIds ?? []
  if (!ids.includes(id)) ids.push(id)
  ctx.createdProfileIds = ids
}

/**
 * T0452: on success, delete the profiles earlier attempts of this run left
 * behind (created, then the step failed), keeping the one just written. Only
 * ids from `createdProfileIds` — never a profile this run did not create. A
 * delete that throws stays recorded (and warned) for rollback.
 */
async function pruneSupersededProfiles(ctx: WizardContext): Promise<void> {
  const keep = ctx.createdProfileId
  if (!keep) return
  const failed: string[] = []
  for (const id of ctx.createdProfileIds ?? []) {
    if (id === keep) continue
    try {
      await window.electronAPI.profile.delete(id)
    } catch (error) {
      failed.push(id)
      ctx.logger.warn(`Failed to delete superseded remote profile ${id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  ctx.createdProfileIds = [...failed, keep]
}

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
    // T0382 (BUG-091): same ctx.serverPort the unit and connect-test use. No
    // 9876 fallback — that is the host RemoteServer's default port.
    const port = ctx.serverPort
    if (typeof port !== 'number') {
      throw new Error('Server port was not resolved before writing the remote profile.')
    }
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
      recordCreatedProfile(ctx, profile.id)

      // Map ctx state -> ProfileEntry schema. Schema doesn't carry sshAlias /
      // sshInstallPath (alias is resolved at connect time via ssh-config;
      // install path is a runtime artifact, not a join key).
      // T0425 (BUG-098): SSH profiles always use the tunnel — the remote
      // bat-server binds to localhost and `remoteHost` is 'localhost', so a
      // legacy `sshTunnelMode: 'direct'` in the state is not honoured.
      const updated = await window.electronAPI.profile.update(profile.id, {
        targetOS: ctx.targetOS,
        sshHost: sshState.sshHost,
        sshUser: sshState.sshUser,
        sshPort: sshState.sshPort,
        sshKeyPath: sshState.sshKeyPath,
        useSshTunnel: true,
        serverHome,
        remoteHost: 'localhost',
        remotePort: port,
        remoteToken: ctx.remoteToken,
        remoteFingerprint: fingerprint,
      })
      if (!updated) {
        throw new Error('Failed to persist SSH profile metadata.')
      }
      await pruneSupersededProfiles(ctx)
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
      recordCreatedProfile(ctx, profile.id)

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
      await pruneSupersededProfiles(ctx)
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
    recordCreatedProfile(ctx, profile.id)

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
    await pruneSupersededProfiles(ctx)
  },
  // T0444 (BUG-111): delete every profile this run created. An id whose
  // delete throws is kept (and warned) so a later rollback can retry it;
  // `false` means it is already gone.
  async rollback(ctx) {
    const ids = [...(ctx.createdProfileIds ?? [])]
    if (ctx.createdProfileId && !ids.includes(ctx.createdProfileId)) ids.push(ctx.createdProfileId)
    if (ids.length === 0) {
      return
    }
    const remaining: string[] = []
    for (const id of ids) {
      try {
        await window.electronAPI.profile.delete(id)
      } catch (error) {
        remaining.push(id)
        ctx.logger.warn(`Failed to delete remote profile ${id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    ctx.createdProfileIds = remaining.length > 0 ? remaining : undefined
    ctx.createdProfileId = remaining.length > 0 ? remaining[remaining.length - 1] : undefined
  },
}
