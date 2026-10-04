import i18next from 'i18next'
import type { WizardContext, WizardStep } from '../../wizard-runner'

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
    throw new Error(`Unable to resolve the home directory of the WSL user (got ${JSON.stringify(home)}).`)
  }
  ctx.wslHome = home
  return home
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
    if (!ctx.wslDistro) {
      throw new Error('Select a WSL distro before installing the server bundle.')
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
      throw new Error(`[${result.errorCode}] ${result.error}`)
    }

    const tarballPath = result.tarballPath
    ctx.logger.info(`${describeSource(result.source)}: ${tarballPath}`)

    const installResult = await window.electronAPI.wsl.installBundle(ctx.wslDistro, tarballPath, installPath)

    if (!installResult.ok) {
      throw new Error(installResult.error)
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
  async rollback(ctx) {
    if (!ctx.wslDistro || !ctx.serverInstallPath) {
      return
    }
    const result = await window.electronAPI.wsl.uninstallBundle(ctx.wslDistro, ctx.serverInstallPath)
    if (!result.ok) {
      ctx.logger.warn(`Failed to remove BAT server bundle: ${result.error}`)
      return
    }
    ctx.serverInstallPath = undefined
    ctx.networkMode = undefined
  },
}
