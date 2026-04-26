import type { WizardContext, WizardStep } from '../../wizard-runner'

const INSTALL_PATH = '~/.local/bat-server'

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

    const installResult = await window.electronAPI.wsl.installBundle(ctx.wslDistro, tarballPath, INSTALL_PATH)

    if (!installResult.ok) {
      throw new Error(installResult.error)
    }

    ctx.serverInstallPath = INSTALL_PATH
    ctx.state.bundleTarballPath = tarballPath
    ctx.state.bundleSha256Verified = true
    ctx.state.bundleSource = result.source

    const presetNetworkMode = typeof ctx.state.networkMode === 'string' ? ctx.state.networkMode : null
    if (presetNetworkMode === 'mirrored' || presetNetworkMode === 'nat' || presetNetworkMode === 'unknown') {
      ctx.networkMode = presetNetworkMode
    } else {
      try {
        ctx.networkMode = await window.electronAPI.wsl.detectNetworkMode(ctx.wslDistro)
      } catch (error) {
        ctx.networkMode = 'unknown'
        ctx.logger.warn(`Unable to detect WSL networking mode: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (ctx.networkMode === 'nat') {
      pushWarning(
        ctx,
        'WSL is using NAT networking. Switch to mirrored mode or be ready to replace localhost with the distro IP if connect-test fails.',
      )
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
