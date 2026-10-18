import i18next from 'i18next'
import type { WizardContext, WizardStep } from '../../wizard-runner'
import { PRECONDITION_MISSING_CODE, wizardError } from '../../error-mapper'
import { distributeFailureError, SERVER_BUNDLE_IMPORT_TARGET_KEY } from '../../server-bundle-import'

const INSTALL_SUBDIR = '.local/bat-server'

type WslNetworkModeInfo = Awaited<ReturnType<typeof window.electronAPI.wsl.detectNetworkMode>>
type WslNetworkMode = WslNetworkModeInfo['actual']

const NETWORK_MODES: readonly WslNetworkMode[] = ['mirrored', 'nat', 'virtioproxy', 'none', 'unknown']

function isNetworkMode(value: unknown): value is WslNetworkMode {
  return typeof value === 'string' && (NETWORK_MODES as readonly string[]).includes(value)
}

export interface NetworkModeWarning {
  key: string
  params?: Record<string, string>
}

/**
 * T0383 (BUG-089): pick the networking warning from the actual mode
 * (`wslinfo`) and the declared one (`.wslconfig`).
 *  - mirrored / unknown: none (unknown = WSL < 2.0.4 or probe failure; the
 *    connection test is the real arbiter, so stay quiet instead of guessing)
 *  - nat + declared mirrored: setting not applied — restart needed, or Windows
 *    too old for Mirrored; say which when the host build tells us, else both
 *  - nat: informational — localhost works via localhostForwarding
 *  - none / virtioproxy: not verified with BAT
 */
export function selectNetworkModeWarning(info: WslNetworkModeInfo): NetworkModeWarning | null {
  switch (info.actual) {
    case 'mirrored':
    case 'unknown':
      return null
    case 'nat':
      if (info.declared !== 'mirrored') return { key: 'wizard.wsl.warning.networkNat' }
      if (info.mirroredSupported === false) return { key: 'wizard.wsl.warning.networkMirroredUnsupported' }
      if (info.mirroredSupported === true) return { key: 'wizard.wsl.warning.networkMirroredPendingRestart' }
      return { key: 'wizard.wsl.warning.networkMirroredNotApplied' }
    default:
      return { key: 'wizard.wsl.warning.networkUnverified', params: { mode: info.actual } }
  }
}

/**
 * T0378 (BUG-087 B): the install path ends up verbatim in the systemd unit's
 * ExecStart, and systemd does not expand `~` — resolve the distro user's
 * absolute $HOME once and cache it on ctx for later steps.
 */
export async function resolveWslHome(ctx: WizardContext, distro: string): Promise<string> {
  if (ctx.wslHome) return ctx.wslHome
  const home = await window.electronAPI.wsl.resolveHome(distro)
  if (typeof home !== 'string' || !home.startsWith('/') || home.includes('~')) {
    throw wizardError(`Unable to resolve the home directory of the WSL user (got ${JSON.stringify(home)}).`, 'wsl-home-unresolved')
  }
  ctx.wslHome = home
  return home
}

/**
 * T0554 (BUG-141): what this wizard run's install did, set only after the
 * install succeeded. `previous` is what the install script found at the root:
 *  - `kept`: an existing BAT install, now at `<root>.bat-old`; rollback puts it
 *    back, finalize removes it
 *  - `none`: first install; rollback removes the root (as before T0554)
 *  - `unmanaged`: extracted over a directory that is not a BAT install;
 *    rollback cannot undo that and deletes nothing
 */
export const WSL_BUNDLE_INSTALL_KEY = 'wslBundleInstall'
/**
 * T0554: set by write-systemd-unit's rollback when the previous server was
 * running but the previous bundle still had to be put back; this step's
 * rollback starts the service again after restoring the bundle.
 */
export const WSL_SERVICE_START_AFTER_RESTORE_KEY = 'wslServiceStartAfterBundleRestore'
export const WSL_SERVICE_NAME = 'bat-server.service'

export interface WslBundleInstallRecord {
  distro: string
  root: string
  previous: 'kept' | 'none' | 'unmanaged'
}

export function readWslBundleInstall(ctx: WizardContext): WslBundleInstallRecord | null {
  const record = ctx.state[WSL_BUNDLE_INSTALL_KEY] as WslBundleInstallRecord | undefined
  return record && typeof record.root === 'string' && typeof record.distro === 'string' ? record : null
}

function pushWarning(ctx: WizardContext, warning: string): void {
  if (!ctx.warnings.includes(warning)) {
    ctx.warnings.push(warning)
  }
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

export const installServerBundleStep: WizardStep = {
  id: 'install-server-bundle',
  title: 'Install BAT server bundle',
  appliesTo: ['wsl-linux'],
  retryable: true,
  labelKey: 'wizard.wsl.step.installBundle.label',
  descriptionKey: 'wizard.wsl.step.installBundle.description',
  groupKey: 'wizard.group.deployment',
  editableFromFailure: false,
  async run(ctx) {
    // T0489: ctx.serverInstallPath starts as the default `~/.local/bat-server`,
    // so it cannot gate rollback: a failure before the install (then cancel, or
    // a jump back from the failure screen) would `rm -rf` a bundle an earlier
    // setup left in the distro. T0554 (BUG-141): rollback acts only on
    // WSL_BUNDLE_INSTALL_KEY, set once the install succeeded. A failed install
    // has nothing to undo: the script extracts beside the root and swaps only
    // after a good extract (before T0554 its rollback removed the root, which
    // after T0552 was the untouched previous install).
    if (!ctx.wslDistro) {
      throw wizardError('Select a WSL distro before installing the server bundle.', PRECONDITION_MISSING_CODE)
    }

    // Resolve before downloading so a broken distro user fails fast.
    const installPath = `${await resolveWslHome(ctx, ctx.wslDistro)}/${INSTALL_SUBDIR}`

    // PLAN-031 T0321 — delegate tarball lookup to T0320 distributor.
    // Profile is not yet persisted at this stage of the wizard (write-profile
    // runs after install-bundle), so we pass a draftProfile with the minimal
    // fields detectRemoteArch needs for the WSL target.
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
      result = await window.electronAPI.remote.serverBundle.distribute({
        draftProfile: {
          targetOS: 'wsl-linux',
          wslDistro: ctx.wslDistro,
        },
        version,
      })
    } finally {
      unsubscribeProgress()
    }

    if (!result.ok) {
      // Distributor already classified the failure (arch-detection-failed,
      // no-source-available, download-failed, baseline-corrupted, aborted) —
      // surface it directly without local retry / fallback (T0320 owns that).
      // T0547: download failures offer "Import local tarball…" (server-bundle-import.ts).
      throw distributeFailureError(ctx, result)
    }
    delete ctx.state[SERVER_BUNDLE_IMPORT_TARGET_KEY]

    const tarballPath = result.tarballPath
    ctx.logger.info(`${describeSource(result.source)}: ${tarballPath}`)

    const installResult = await window.electronAPI.wsl.installBundle(ctx.wslDistro, tarballPath, installPath, { keepPrevious: true })

    if (!installResult.ok) {
      throw wizardError(installResult.error, 'server-bundle-install-failed')
    }
    const previous = installResult.previous ?? 'none'
    ctx.state[WSL_BUNDLE_INSTALL_KEY] = { distro: ctx.wslDistro, root: installPath, previous } satisfies WslBundleInstallRecord
    if (previous === 'kept') {
      ctx.logger.info(`Replaced the existing BAT server bundle; the previous one is kept until setup finishes (${installPath}.bat-old)`)
    } else if (previous === 'unmanaged') {
      ctx.logger.warn(`${installPath} was not a BAT server bundle install; extracted over it (cancel cannot undo this)`)
    }

    ctx.serverInstallPath = installPath
    ctx.state.bundleTarballPath = tarballPath
    ctx.state.bundleSha256Verified = true
    ctx.state.bundleSource = result.source

    const presetNetworkMode = typeof ctx.state.networkMode === 'string' ? ctx.state.networkMode : null
    let networkInfo: WslNetworkModeInfo
    if (isNetworkMode(presetNetworkMode)) {
      networkInfo = { actual: presetNetworkMode, declared: null, mirroredSupported: null }
    } else {
      try {
        networkInfo = await window.electronAPI.wsl.detectNetworkMode(ctx.wslDistro)
      } catch (error) {
        networkInfo = { actual: 'unknown', declared: null, mirroredSupported: null }
        ctx.logger.warn(`Unable to detect WSL networking mode: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    ctx.networkMode = networkInfo.actual
    ctx.logger.info(
      `WSL networking mode: actual=${networkInfo.actual}, declared=${networkInfo.declared ?? 'none'}, mirroredSupported=${String(networkInfo.mirroredSupported)}`,
    )

    const warning = selectNetworkModeWarning(networkInfo)
    if (warning) {
      pushWarning(ctx, i18next.t(warning.key, warning.params))
    }
  },
  // T0554 (BUG-141): an upgrade puts the previous bundle back (and starts the
  // previous server again when write-systemd-unit's rollback asked for it); a
  // first install is removed as before; nothing is deleted for a failed
  // install or a root that was not a BAT install.
  async rollback(ctx) {
    const record = readWslBundleInstall(ctx)
    const startAfterRestore = ctx.state[WSL_SERVICE_START_AFTER_RESTORE_KEY] === true
    delete ctx.state[WSL_SERVICE_START_AFTER_RESTORE_KEY]
    if (!record) {
      return
    }
    if (record.previous === 'unmanaged') {
      ctx.logger.warn(`Leaving ${record.root} in place: it was not a BAT server bundle install before this setup`)
    } else if (record.previous === 'kept') {
      const result = await window.electronAPI.wsl.restoreBundle(record.distro, record.root)
      if (!result.ok) {
        ctx.logger.warn(`Failed to restore the previous BAT server bundle: ${result.error}`)
        return
      }
      if (result.outcome === 'missing') {
        ctx.logger.warn(`No previous BAT server bundle at ${record.root}.bat-old to restore; leaving ${record.root} as it is`)
      } else {
        ctx.logger.info(`Restored the previous BAT server bundle at ${record.root}`)
        if (startAfterRestore) {
          const started = await window.electronAPI.wslSystemd.restartService(record.distro, WSL_SERVICE_NAME)
          if (started.ok) ctx.logger.info(`Started the previous ${WSL_SERVICE_NAME} again`)
          else ctx.logger.warn(`Failed to start the previous ${WSL_SERVICE_NAME} again: ${started.error}`)
        }
      }
    } else {
      const result = await window.electronAPI.wsl.uninstallBundle(record.distro, record.root)
      if (!result.ok) {
        ctx.logger.warn(`Failed to remove BAT server bundle: ${result.error}`)
        return
      }
    }
    delete ctx.state[WSL_BUNDLE_INSTALL_KEY]
    ctx.serverInstallPath = undefined
    ctx.networkMode = undefined
  },
  // T0554: setup finished; the previous bundle is no longer needed.
  async finalize(ctx) {
    const record = readWslBundleInstall(ctx)
    if (!record || record.previous !== 'kept') return
    const result = await window.electronAPI.wsl.discardPreviousBundle(record.distro, record.root)
    if (!result.ok) throw new Error(`Failed to remove the previous BAT server bundle (${record.root}.bat-old): ${result.error}`)
    ctx.logger.info(`Removed the previous BAT server bundle (${record.root}.bat-old)`)
    delete ctx.state[WSL_BUNDLE_INSTALL_KEY]
  },
}
