import i18next from 'i18next'
import { stripSnapshotSuffix } from '../../../../lib/snapshot-version'
import { throwIfWizardAborted, type WizardContext, type WizardStep } from '../../wizard-runner'
import { runAbortableOperation } from '../../wizard-abort'
import { PRECONDITION_MISSING_CODE, wizardError } from '../../error-mapper'
import { distributeFailureError, SERVER_BUNDLE_IMPORT_TARGET_KEY } from '../../server-bundle-import'
import { currentDockerImage } from './base-image'
import { DOCKER_OWNERSHIP_KEYS, removeContainerIfCreatedByWizard } from './ownership'

/**
 * Docker install-bundle step.
 *
 * T0853 (PLAN-052 W4b, D283 (c′)): "Create new" pulls the base image the user
 * chose, checks it can run the server bundle, gets the bundle through the
 * PLAN-031 distributor (cache / `.sha256` / download / "Import local
 * tarball…", architecture from `docker:server-arch`) and installs it into the
 * container's bundle volume. start-server then creates the container on the
 * base image. An image whose own ENTRYPOINT / CMD starts the baked-in server
 * (`bat-server:latest`, U3) skips the install and is created as before.
 *
 * "Use existing" on a container BAT created this way (label `bat.server=1`,
 * bundle volume on /opt/bat) is a re-run = upgrade (Q-3): same version → nothing
 * to do; otherwise ask, install the new bundle (`.bat-old` kept, T0554) and
 * start-server restarts the container. Any other existing container is left
 * exactly as before (its image must contain /opt/bat-server).
 */

/** `bundle-volume` = (c′) container (bundle in a volume); `baked` = the image has it (U3). */
export const DOCKER_CONTAINER_KIND_KEY = 'dockerContainerKind'
export type DockerContainerKind = 'bundle-volume' | 'baked'

/** What this run's install did, set only once the install succeeded (rollback acts on nothing else). */
export const DOCKER_BUNDLE_INSTALL_KEY = 'dockerBundleInstall'
export interface DockerBundleInstallRecord {
  container: string
  image: string
  bundleVolume: string
  /** As the install script reported it (T0554): `kept` = the earlier bundle is at `server.bat-old`. */
  previous: 'kept' | 'none' | 'unmanaged'
  /** Re-run on an existing BAT container (Q-3). */
  upgrade: boolean
}

/** Q-3: `installed` → start-server restarts the container; `current` / `skipped` → nothing changed. */
export const DOCKER_UPGRADE_KEY = 'dockerUpgrade'
export type DockerUpgradeState = 'installed' | 'current' | 'skipped'

/** The `operationId` of the running pull; the Shell shows `docker:pull-progress` events of this id. */
export const DOCKER_PULL_OPERATION_KEY = 'dockerPullOperationId'

export const DOCKER_BUNDLE_VOLUME_MOUNT = '/opt/bat'
export const DOCKER_BUNDLE_ROOT = '/opt/bat/server'
/** docker/Dockerfile's install path (baked-in bundle, and the pre-(c′) requirement for existing containers). */
export const DOCKER_BAKED_BUNDLE_ROOT = '/opt/bat-server'

export const DOCKER_UPGRADE_CHOICE = 'upgrade'
export const DOCKER_UPGRADE_SKIP_CHOICE = 'skip'

/** Same names as electron/docker-bundle-volume.ts `batVolumeNames` (keep in sync). */
export function dockerBatVolumeNames(containerName: string): { bundle: string; data: string } {
  return { bundle: `bat-server-${containerName}-bundle`, data: `bat-server-${containerName}-data` }
}

export function readDockerBundleInstall(ctx: WizardContext): DockerBundleInstallRecord | null {
  const record = ctx.state[DOCKER_BUNDLE_INSTALL_KEY] as DockerBundleInstallRecord | undefined
  return record && typeof record.bundleVolume === 'string' && typeof record.image === 'string' ? record : null
}

export function readDockerContainerKind(ctx: WizardContext): DockerContainerKind | undefined {
  const kind = ctx.state[DOCKER_CONTAINER_KIND_KEY]
  return kind === 'bundle-volume' || kind === 'baked' ? kind : undefined
}

type InspectResult = Awaited<ReturnType<typeof window.electronAPI.docker.inspectContainer>>

/**
 * Q-3: a container BAT created with a bundle volume: label `bat.server=1` and a
 * volume on /opt/bat whose source is `bat-server-<name>-bundle`.
 */
export function isBundleVolumeContainer(
  name: string,
  inspection: Pick<InspectResult, 'mounts'>,
  batCreated: boolean,
): boolean {
  if (!batCreated) return false
  const { bundle } = dockerBatVolumeNames(name)
  return (inspection.mounts ?? []).some((mount) =>
    mount.type === 'volume'
    && mount.destination === DOCKER_BUNDLE_VOLUME_MOUNT
    && mount.source.split(/[\\/]/).includes(bundle))
}

function pushWarning(ctx: WizardContext, warning: string): void {
  if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
}

function describeSource(source: 'cache' | 'baseline' | 'download'): string {
  switch (source) {
    case 'cache':
      return 'Using cached server bundle'
    case 'baseline':
      return 'Using bundled server bundle (offline)'
    case 'download':
      return 'Downloaded server bundle from release'
  }
}

/** `docker pull` with layer progress in the log; the Shell shows the same events (DOCKER_PULL_OPERATION_KEY). */
async function pullBaseImage(ctx: WizardContext, image: string): Promise<void> {
  let operation: string | undefined
  let lastCompleted = -1
  const unsubscribe = window.electronAPI.docker.onPullProgress((event) => {
    if (!operation || event.operationId !== operation) return
    if (event.completed === lastCompleted) return
    lastCompleted = event.completed
    ctx.logger.info(`Pulling ${image}: ${event.completed}/${event.layers} layers`)
  })
  let result: Awaited<ReturnType<typeof window.electronAPI.docker.pullImage>>
  try {
    ctx.logger.info(`Pulling Docker image ${image}…`)
    result = await runAbortableOperation(ctx.signal, (operationId) => {
      operation = operationId
      if (operationId) ctx.state[DOCKER_PULL_OPERATION_KEY] = operationId
      return window.electronAPI.docker.pullImage(image, operationId ? { operationId } : undefined)
    })
  } finally {
    unsubscribe()
    delete ctx.state[DOCKER_PULL_OPERATION_KEY]
  }
  throwIfWizardAborted(ctx)
  if (!result.ok) {
    // A local-only image (e.g. `bat-server:latest` built with npm run build:docker-image, U3,
    // or a base image while offline) cannot be pulled: use the local copy when there is one.
    if (result.errorCode !== 'docker-image-invalid' && result.errorCode !== 'docker-pull-aborted') {
      const local = await window.electronAPI.docker.imageBakedBundle(image)
      throwIfWizardAborted(ctx)
      if (local.ok) {
        ctx.logger.warn(`Could not pull Docker image ${image} (${result.errorCode}); using the local copy.`)
        return
      }
    }
    throw wizardError(result.error, result.errorCode, { image })
  }
  ctx.logger.info(`Docker image ${image}: ${result.status}`)
}

async function probeImage(ctx: WizardContext, image: string, bundleVolume?: string): Promise<void> {
  const result = await window.electronAPI.docker.probeBundleCompat(bundleVolume ? { image, bundleVolume } : { image })
  throwIfWizardAborted(ctx)
  if (!result.ok) {
    throw wizardError(result.error, result.errorCode, {
      image,
      glibc: result.glibcVersion ?? '',
      missing: (result.missing ?? []).join(', '),
    })
  }
  ctx.logger.info(`Docker image ${image}: ${result.libc}${result.glibcVersion ? ` ${result.glibcVersion}` : ''}${result.nodeChecked ? ', bundled node runs' : ''}`)
}

async function daemonArch(ctx: WizardContext): Promise<'linux-x64' | 'linux-arm64'> {
  const result = await window.electronAPI.docker.serverArch()
  throwIfWizardAborted(ctx)
  if (!result.ok) throw wizardError(result.error, result.errorCode, { arch: result.rawArch ?? '' })
  if (result.arch !== 'linux-x64' && result.arch !== 'linux-arm64') {
    throw wizardError(`Docker reports architecture ${result.arch}, which has no Linux server bundle.`, 'docker-arch-unsupported', { arch: result.arch })
  }
  return result.arch
}

/** The server bundle tarball through the PLAN-031 distributor (T0547 import on download failure). */
async function distributeBundle(ctx: WizardContext, container: string, arch: 'linux-x64' | 'linux-arm64'): Promise<string> {
  const version = await window.electronAPI.update.getVersion()
  const unsubscribeProgress = window.electronAPI.remote.serverBundle.onDistributeProgress((event) => {
    if (event.phase === 'tarball') {
      ctx.logger.info(`Downloading server bundle: ${event.percent}% (${event.bytesDownloaded}/${event.bytesTotal} bytes)`)
    } else if (event.phase === 'manifest') {
      ctx.logger.info('Fetching server bundle manifest…')
    }
  })
  let result: Awaited<ReturnType<typeof window.electronAPI.remote.serverBundle.distribute>>
  try {
    result = await runAbortableOperation(ctx.signal, (operationId) =>
      window.electronAPI.remote.serverBundle.distribute({
        // Q-1: the container may not exist yet, so the daemon arch goes with the draft.
        draftProfile: { targetOS: 'docker-linux', dockerContainer: container, dockerServerArch: arch },
        version,
        ...(operationId ? { operationId } : {}),
      }))
  } finally {
    unsubscribeProgress()
  }
  throwIfWizardAborted(ctx)
  if (!result.ok) throw distributeFailureError(ctx, result)
  delete ctx.state[SERVER_BUNDLE_IMPORT_TARGET_KEY]
  ctx.state.bundleTarballPath = result.tarballPath
  ctx.state.bundleSource = result.source
  ctx.logger.info(`${describeSource(result.source)}: ${result.tarballPath}`)
  return result.tarballPath
}

/** Create a BAT volume; record ownership only for one this run created. */
async function ensureVolume(ctx: WizardContext, name: string, role: 'bundle' | 'data'): Promise<void> {
  const result = await window.electronAPI.docker.createVolume(name, role)
  if (!result.ok) throw wizardError(result.error, result.errorCode, { volume: name })
  const key = role === 'bundle' ? DOCKER_OWNERSHIP_KEYS.bundleVolumeCreated : DOCKER_OWNERSHIP_KEYS.dataVolumeCreated
  if (result.created) ctx.state[key] = name
  else if (ctx.state[key] !== name) ctx.logger.info(`Docker volume ${name} already exists; BAT reuses it and will not remove it.`)
}

/**
 * Install into the bundle volume. A retry after an earlier attempt of this run
 * installed first undoes that attempt (the install script replaces
 * `server.bat-old`, which may hold the bundle that was there before setup).
 */
async function installIntoVolume(
  ctx: WizardContext,
  options: { container: string; image: string; bundleVolume: string; dataVolume?: string; tarballPath: string; upgrade: boolean },
): Promise<DockerBundleInstallRecord> {
  const earlier = readDockerBundleInstall(ctx)
  let originalPrevious: DockerBundleInstallRecord['previous'] | undefined
  if (earlier && earlier.bundleVolume === options.bundleVolume) {
    if (earlier.previous === 'kept') {
      const restored = await window.electronAPI.docker.restoreBundleInVolume({ image: earlier.image, bundleVolume: earlier.bundleVolume })
      if (!restored.ok) throw wizardError(restored.error, 'server-bundle-install-failed')
    } else {
      originalPrevious = earlier.previous
    }
    delete ctx.state[DOCKER_BUNDLE_INSTALL_KEY]
  }
  const keepPrevious = originalPrevious === undefined
  const result = await runAbortableOperation(ctx.signal, (operationId) =>
    window.electronAPI.docker.installBundleIntoVolume({
      image: options.image,
      bundleVolume: options.bundleVolume,
      ...(options.dataVolume ? { dataVolume: options.dataVolume } : {}),
      tarballPath: options.tarballPath,
      keepPrevious,
      ...(operationId ? { operationId } : {}),
    }))
  if (!result.ok) {
    // The swap may have happened before the failure / abort was seen: record it so rollback restores.
    if (result.previous) {
      ctx.state[DOCKER_BUNDLE_INSTALL_KEY] = {
        container: options.container,
        image: options.image,
        bundleVolume: options.bundleVolume,
        previous: originalPrevious ?? result.previous,
        upgrade: options.upgrade,
      } satisfies DockerBundleInstallRecord
    }
    throwIfWizardAborted(ctx)
    throw wizardError(result.error, 'server-bundle-install-failed')
  }
  const record: DockerBundleInstallRecord = {
    container: options.container,
    image: options.image,
    bundleVolume: options.bundleVolume,
    previous: originalPrevious ?? result.previous,
    upgrade: options.upgrade,
  }
  ctx.state[DOCKER_BUNDLE_INSTALL_KEY] = record
  throwIfWizardAborted(ctx)
  return record
}

async function installForNewContainer(ctx: WizardContext, container: string): Promise<void> {
  const image = currentDockerImage(ctx)
  ctx.state.dockerImage = image
  delete ctx.state[DOCKER_CONTAINER_KIND_KEY]

  await pullBaseImage(ctx, image)

  // U3 / Q-2: the image starts its own baked-in server → created as before T0853.
  const baked = await window.electronAPI.docker.imageBakedBundle(image)
  throwIfWizardAborted(ctx)
  if (!baked.ok) throw wizardError(baked.error, baked.errorCode, { image })
  if (baked.baked) {
    ctx.state[DOCKER_CONTAINER_KIND_KEY] = 'baked' satisfies DockerContainerKind
    ctx.serverInstallPath = DOCKER_BAKED_BUNDLE_ROOT
    ctx.state.bundleSource = 'image-baked'
    ctx.logger.info(`Docker image ${image} already contains the BAT server bundle; nothing to install.`)
    return
  }

  // Before anything is created: tools and libc of the base image.
  await probeImage(ctx, image)
  const arch = await daemonArch(ctx)
  const tarballPath = await distributeBundle(ctx, container, arch)

  const volumes = dockerBatVolumeNames(container)
  await ensureVolume(ctx, volumes.bundle, 'bundle')
  await ensureVolume(ctx, volumes.data, 'data')
  throwIfWizardAborted(ctx)

  const record = await installIntoVolume(ctx, {
    container,
    image,
    bundleVolume: volumes.bundle,
    dataVolume: volumes.data,
    tarballPath,
    upgrade: false,
  })
  if (record.previous === 'kept') ctx.logger.info(`Replaced the BAT server bundle in volume ${volumes.bundle}; the previous one is kept until setup finishes.`)

  // After the install: the bundled node must run on this image.
  await probeImage(ctx, image, volumes.bundle)
  ctx.state[DOCKER_CONTAINER_KIND_KEY] = 'bundle-volume' satisfies DockerContainerKind
  ctx.serverInstallPath = DOCKER_BUNDLE_ROOT
  ctx.logger.info(`✓ Server bundle installed in Docker volume ${volumes.bundle}`)
}

async function upgradeExistingContainer(ctx: WizardContext, container: string, image: string): Promise<void> {
  const volumes = dockerBatVolumeNames(container)
  ctx.serverInstallPath = DOCKER_BUNDLE_ROOT
  const target = stripSnapshotSuffix(await window.electronAPI.update.getVersion())
  const installed = await window.electronAPI.docker.readBundleVersionInVolume({ image, bundleVolume: volumes.bundle })
  throwIfWizardAborted(ctx)
  const installedVersion = installed.ok ? installed.version : null
  if (!installed.ok) ctx.logger.warn(`Could not read the BAT server bundle version of ${container}: ${installed.error}`)
  if (installedVersion && installedVersion === target) {
    ctx.state[DOCKER_UPGRADE_KEY] = 'current' satisfies DockerUpgradeState
    ctx.logger.info(`Docker container ${container} already runs BAT server bundle ${target}; nothing to upgrade.`)
    return
  }

  // Q-3: restarting ends what runs in the container, so ask first. No prompt → leave it as it is.
  const answer = typeof ctx.requestChoice === 'function'
    ? await ctx.requestChoice({
        stepId: 'install-server-bundle',
        title: i18next.t('wizard.docker.upgrade.title', { name: container }),
        description: i18next.t(installedVersion ? 'wizard.docker.upgrade.description' : 'wizard.docker.upgrade.descriptionUnknown', {
          name: container,
          from: installedVersion ?? '',
          to: target,
        }),
        options: [
          {
            value: DOCKER_UPGRADE_CHOICE,
            label: 'Upgrade and restart',
            labelKey: 'wizard.docker.upgrade.confirm',
            description: i18next.t('wizard.docker.upgrade.confirmDescription', { name: container }),
          },
          {
            value: DOCKER_UPGRADE_SKIP_CHOICE,
            label: 'Not now',
            labelKey: 'wizard.docker.upgrade.skip',
            description: i18next.t('wizard.docker.upgrade.skipDescription'),
          },
        ],
      })
    : DOCKER_UPGRADE_SKIP_CHOICE
  if (answer !== DOCKER_UPGRADE_CHOICE) {
    ctx.state[DOCKER_UPGRADE_KEY] = 'skipped' satisfies DockerUpgradeState
    ctx.logger.info(`Not upgrading Docker container ${container}; connecting to the server it runs now.`)
    return
  }

  const arch = await daemonArch(ctx)
  const tarballPath = await distributeBundle(ctx, container, arch)
  await installIntoVolume(ctx, { container, image, bundleVolume: volumes.bundle, tarballPath, upgrade: true })
  await probeImage(ctx, image, volumes.bundle)
  ctx.state[DOCKER_UPGRADE_KEY] = 'installed' satisfies DockerUpgradeState
  ctx.logger.info(`✓ New BAT server bundle installed in ${volumes.bundle}; start-server restarts ${container}.`)
}

async function isBatCreatedContainer(name: string): Promise<boolean> {
  try {
    const containers = await window.electronAPI.docker.listContainers()
    return containers.some((container) => container.name === name && container.batCreated === true)
  } catch {
    return false
  }
}

async function removeVolumeIfCreatedByWizard(ctx: WizardContext, key: string, role: string): Promise<void> {
  const name = ctx.state[key]
  if (typeof name !== 'string' || !name) return
  const result = await window.electronAPI.docker.removeVolume(name)
  if (!result.ok) {
    ctx.logger.warn(`Failed to remove the ${role} Docker volume ${name}: ${result.error}`)
    return
  }
  delete ctx.state[key]
}

export const installDockerServerBundleStep: WizardStep = {
  id: 'install-server-bundle',
  title: 'Install BAT server bundle',
  appliesTo: ['docker-linux'],
  // T0853: asks before an upgrade restarts an existing container.
  kind: 'input',
  retryable: true,
  labelKey: 'wizard.docker.step.installBundle.label',
  descriptionKey: 'wizard.docker.step.installBundle.description',
  groupKey: 'wizard.group.deployment',
  editableFromFailure: false,
  async run(ctx) {
    // T0426 (BUG-099): serverInstallPath is this step's own output and gates
    // rollback. Clear it so a failed re-run (e.g. after a jump back) is not
    // rolled back with the path from an earlier attempt.
    ctx.serverInstallPath = undefined
    // T0444 (BUG-111): this step never writes into a user's container itself
    // (the bundle goes into BAT's own volume), so the in-container rm stays off.
    ctx.state[DOCKER_OWNERSHIP_KEYS.bundleInstalled] = false
    delete ctx.state[DOCKER_UPGRADE_KEY]
    const mode = ctx.state.containerMode
    const container = typeof ctx.state.dockerContainer === 'string' ? ctx.state.dockerContainer : ''

    if (mode === 'new') {
      if (!container) throw wizardError('Container name is missing.', PRECONDITION_MISSING_CODE)
      await installForNewContainer(ctx, container)
      return
    }

    if (mode !== 'existing' || !container) {
      throw wizardError('Choose a Docker container before validating the BAT server bundle.', PRECONDITION_MISSING_CODE)
    }

    const inspection = await window.electronAPI.docker.inspectContainer(container)
    if (!inspection.image) {
      throw wizardError(`Unable to inspect Docker container ${container}.`, 'docker-inspect-failed', {
        name: container,
      })
    }

    // Q-3: a container BAT created with a bundle volume → re-run = upgrade.
    if (isBundleVolumeContainer(container, inspection, await isBatCreatedContainer(container))) {
      ctx.state.bundleSource = 'volume'
      await upgradeExistingContainer(ctx, container, inspection.image)
      return
    }

    ctx.serverInstallPath = DOCKER_BAKED_BUNDLE_ROOT
    pushWarning(ctx, i18next.t('wizard.docker.warning.existingNeedsBundle', { name: container }))
    ctx.state.bundleSource = 'image-baked'
  },
  // T0853: undo only what this run did. The container start-server created is
  // removed first (its volumes are in use while it exists); then the bundle
  // that was in the volume before is put back (`kept`), and volumes this run
  // created are removed. An upgraded container that start-server restarted is
  // restarted again on the restored bundle.
  // PLAN-007 T0289 / T0444: the in-container `rm -rf` of the install path runs
  // only when this run installed into the container itself, which it never does.
  async rollback(ctx) {
    const container = typeof ctx.state.dockerContainer === 'string' ? ctx.state.dockerContainer : ''
    const record = readDockerBundleInstall(ctx)

    if (ctx.state.containerMode === 'new' && container) {
      await removeContainerIfCreatedByWizard(ctx, container)
    }

    if (record) {
      if (record.previous === 'kept') {
        const result = await window.electronAPI.docker.restoreBundleInVolume({ image: record.image, bundleVolume: record.bundleVolume })
        if (!result.ok) {
          ctx.logger.warn(`Failed to restore the previous BAT server bundle in ${record.bundleVolume}: ${result.error}`)
        } else if (result.outcome === 'missing') {
          ctx.logger.warn(`No previous BAT server bundle in ${record.bundleVolume} to restore; leaving it as it is`)
          delete ctx.state[DOCKER_BUNDLE_INSTALL_KEY]
        } else {
          ctx.logger.info(`Restored the previous BAT server bundle in ${record.bundleVolume}`)
          delete ctx.state[DOCKER_BUNDLE_INSTALL_KEY]
          if (record.upgrade && ctx.state[DOCKER_OWNERSHIP_KEYS.restartedForUpgrade] === record.container) {
            const restarted = await window.electronAPI.docker.restartContainer(record.container)
            if (restarted.ok) ctx.logger.info(`Restarted ${record.container} on the previous BAT server bundle`)
            else ctx.logger.warn(`Failed to restart ${record.container} on the previous BAT server bundle: ${restarted.error ?? 'unknown error'}`)
          }
          delete ctx.state[DOCKER_OWNERSHIP_KEYS.restartedForUpgrade]
        }
      } else {
        if (record.previous === 'unmanaged') ctx.logger.warn(`Leaving ${record.bundleVolume} as it is: it did not hold a BAT server bundle before this setup`)
        // `none`: the volume held nothing; it is removed below when this run created it.
        delete ctx.state[DOCKER_BUNDLE_INSTALL_KEY]
      }
    }

    await removeVolumeIfCreatedByWizard(ctx, DOCKER_OWNERSHIP_KEYS.bundleVolumeCreated, 'bundle')
    await removeVolumeIfCreatedByWizard(ctx, DOCKER_OWNERSHIP_KEYS.dataVolumeCreated, 'data')

    const installed = ctx.state[DOCKER_OWNERSHIP_KEYS.bundleInstalled]
    if (installed !== true) {
      if (installed === undefined && ctx.state.containerMode === 'existing') {
        ctx.logger.warn('Not removing the BAT install path: this setup run did not record installing it.')
      }
      ctx.serverInstallPath = undefined
      return
    }
    if (!container || !ctx.serverInstallPath) return
    const result = await window.electronAPI.docker.execCommand(container, ['rm', '-rf', ctx.serverInstallPath])
    if (!result.ok) {
      ctx.logger.warn(`Failed to clean BAT install path inside container ${container}: ${result.error}`)
      return
    }
    ctx.serverInstallPath = undefined
    ctx.state[DOCKER_OWNERSHIP_KEYS.bundleInstalled] = false
  },
  // T0554: setup finished; the previous bundle is no longer needed.
  async finalize(ctx) {
    const record = readDockerBundleInstall(ctx)
    delete ctx.state[DOCKER_OWNERSHIP_KEYS.restartedForUpgrade]
    if (!record || record.previous !== 'kept') return
    const result = await window.electronAPI.docker.discardPreviousBundleInVolume({ image: record.image, bundleVolume: record.bundleVolume })
    if (!result.ok) throw new Error(`Failed to remove the previous BAT server bundle in ${record.bundleVolume}: ${result.error}`)
    ctx.logger.info(`Removed the previous BAT server bundle in ${record.bundleVolume}`)
    delete ctx.state[DOCKER_BUNDLE_INSTALL_KEY]
  },
}
