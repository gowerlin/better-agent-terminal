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
 * T0552: `keep` undefined (an existing profile was updated) deletes them all.
 */
async function pruneSupersededProfiles(ctx: WizardContext, keep: string | undefined = ctx.createdProfileId): Promise<void> {
  if (!keep && !(ctx.createdProfileIds?.length)) return
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
  ctx.createdProfileIds = keep ? [...failed, keep] : (failed.length > 0 ? failed : undefined)
}

type ProfileUpdates = Parameters<typeof window.electronAPI.profile.update>[1]
type ListedProfile = Awaited<ReturnType<typeof window.electronAPI.profile.listLocal>>['profiles'][number]

function isLoopbackHost(host: string | undefined): boolean {
  return host === undefined || host === 'localhost' || host === '127.0.0.1'
}

/**
 * T0552 (BUG-138): re-running the wizard against a server that already has a
 * profile (same WSL distro / SSH target and the same server port) updates that
 * profile instead of adding a second one. Profiles this run created are never
 * "existing". `listLocal`: this machine's profiles even in a remote window.
 */
async function findExistingProfiles(ctx: WizardContext, matches: (profile: ListedProfile) => boolean): Promise<ListedProfile[]> {
  let profiles: ListedProfile[]
  try {
    profiles = (await window.electronAPI.profile.listLocal()).profiles
  } catch (error) {
    ctx.logger.warn(`Could not list existing profiles; creating a new one: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
  const own = new Set(ctx.createdProfileIds ?? [])
  if (ctx.createdProfileId) own.add(ctx.createdProfileId)
  return profiles.filter((profile) => profile.type === 'remote' && !own.has(profile.id) && matches(profile))
}

/**
 * T0552 (BUG-138): write the new token / fingerprint into the existing
 * profile(s); the name stays. The previous values are kept so rollback can
 * restore them, and the profiles earlier attempts of this run created are
 * deleted. The first match is what the shell opens on done.
 */
async function updateExistingProfiles(ctx: WizardContext, existing: ListedProfile[], updates: ProfileUpdates): Promise<void> {
  const records = ctx.updatedProfiles ?? []
  ctx.updatedProfiles = records
  for (const profile of existing) {
    if (!records.some((record) => record.id === profile.id)) {
      const previous: Record<string, unknown> = {}
      for (const key of Object.keys(updates)) {
        const value = (profile as unknown as Record<string, unknown>)[key]
        if (value !== undefined) previous[key] = value
      }
      records.push({ id: profile.id, previous: previous as ProfileUpdates })
    }
    const updated = await window.electronAPI.profile.update(profile.id, updates)
    if (!updated) {
      throw new Error(`Failed to update the existing remote profile "${profile.name}".`)
    }
    ctx.logger.info(`Updated the existing remote profile "${profile.name}" instead of creating a new one`)
  }
  ctx.updatedProfileId = existing[0].id
  ctx.createdProfileId = undefined
  await pruneSupersededProfiles(ctx, undefined)
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
      const sshUpdates: ProfileUpdates = {
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
      }
      // T0552: same SSH target (host / user / ssh port) and server port.
      const existingSsh = await findExistingProfiles(ctx, (profile) =>
        (profile.targetOS === 'ssh-linux' || profile.targetOS === 'ssh-darwin')
        && profile.sshHost === sshState.sshHost
        && (profile.sshUser ?? '') === (sshState.sshUser ?? '')
        && (profile.sshPort ?? 22) === (sshState.sshPort ?? 22)
        && profile.remotePort === port
        && isLoopbackHost(profile.remoteHost))
      if (existingSsh.length > 0) {
        await updateExistingProfiles(ctx, existingSsh, sshUpdates)
        return
      }
      ctx.updatedProfileId = undefined
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
      const updated = await window.electronAPI.profile.update(profile.id, sshUpdates)
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

    const wslDistro = ctx.wslDistro
    const wslUpdates: ProfileUpdates = {
      targetOS: 'wsl-linux',
      wslDistro,
      remoteHost: 'localhost',
      remotePort: port,
      remoteToken: ctx.remoteToken,
      remoteFingerprint: fingerprint,
    }
    // T0552 (BUG-138): same distro and server port — the upgrade of a server
    // write-systemd-unit kept on its old port.
    const existingWsl = await findExistingProfiles(ctx, (profile) =>
      profile.targetOS === 'wsl-linux'
      && profile.wslDistro === wslDistro
      && profile.remotePort === port
      && isLoopbackHost(profile.remoteHost))
    if (existingWsl.length > 0) {
      await updateExistingProfiles(ctx, existingWsl, wslUpdates)
      return
    }
    ctx.updatedProfileId = undefined

    const profile = await window.electronAPI.profile.create(resolveProfileName(ctx.profileDraft.name, wslDistro), {
      type: 'remote',
      remoteHost: 'localhost',
      remotePort: port,
      remoteToken: ctx.remoteToken,
      remoteFingerprint: fingerprint,
    })
    recordCreatedProfile(ctx, profile.id)

    const updated = await window.electronAPI.profile.update(profile.id, wslUpdates)
    if (!updated) {
      throw new Error('Failed to persist WSL profile metadata.')
    }
    await pruneSupersededProfiles(ctx)
  },
  // T0444 (BUG-111): delete every profile this run created. An id whose
  // delete throws is kept (and warned) so a later rollback can retry it;
  // `false` means it is already gone.
  async rollback(ctx) {
    // T0552: put back what an update of an existing profile overwrote.
    if (ctx.updatedProfiles?.length) {
      for (const record of ctx.updatedProfiles) {
        try {
          await window.electronAPI.profile.update(record.id, record.previous)
        } catch (error) {
          ctx.logger.warn(`Failed to restore remote profile ${record.id}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      ctx.updatedProfiles = undefined
      ctx.updatedProfileId = undefined
    }
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
