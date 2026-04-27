import type { WizardStep } from '../../wizard-runner'

interface InstallSshBundleState {
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  sshInstallPath?: string
  sshServerArch?: string
  bundleTarballPath?: string
  bundleSource?: 'cache' | 'baseline' | 'download'
  uploadBytesSent?: number
  uploadTotalBytes?: number
  uploadSpeedBytesPerSec?: number
  uploadEtaSeconds?: number
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

function makeUploadId(): string {
  return `ssh-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * `install-server-bundle` step (T0285 AC5/AC9, rewritten in T0322).
 *
 * PLAN-031 T0322 — delegates tarball lookup to the T0320 distributor (cache →
 * baseline → download three-layer resolution). The wizard's write-profile step
 * runs after install-bundle, so we pass a draftProfile (T0321 sentinel pattern)
 * containing the SSH connection details and the cached `sshServerArch` raw
 * uname value (verify-auth wrote it into ctx.state). The distributor's
 * arch-detect reads `profile.sshServerArch` directly without re-issuing an SSH
 * call — verify-auth is the sole source of arch information for SSH targets.
 *
 * Once the local tarball is resolved, this step still streams it to the remote
 * via `ssh user@host 'mkdir -p X && cd X && tar xz'` (D-SSH-4 invariant: ssh+tar
 * pipe, no scp/rsync). Progress is reported via `ssh:upload-progress` one-way
 * events (still in the `ssh:*` namespace, AC8 ≤3 handler-channel budget intact).
 */
export const installSshServerBundleStep: WizardStep = {
  id: 'install-server-bundle',
  title: 'Install BAT server bundle (SSH)',
  appliesTo: ['ssh-linux', 'ssh-darwin'],
  retryable: true,
  labelKey: 'wizard.ssh.step.installBundle.label',
  descriptionKey: 'wizard.ssh.step.installBundle.description',
  groupKey: 'wizard.group.deployment',
  editableFromFailure: false,
  async run(ctx) {
    const state = ctx.state as InstallSshBundleState
    if (!state.sshHost || !state.sshUser) {
      throw new Error('SSH host and user must be set before installing the server bundle.')
    }
    if (!state.sshInstallPath) {
      throw new Error('Install path must be selected before installing the server bundle.')
    }
    if (!state.sshServerArch) {
      throw new Error('SSH server architecture not detected — re-run verify-ssh-auth before installing the server bundle.')
    }

    // PLAN-031 T0322 — delegate tarball lookup to T0320 distributor via the
    // T0321 draftProfile pattern. ctx.targetOS was set by verify-auth based on
    // the remote `uname -s` output (ssh-linux | ssh-darwin).
    const version = await window.electronAPI.update.getVersion()

    const unsubscribeDistributeProgress = window.electronAPI.remote.serverBundle.onDistributeProgress((event) => {
      if (event.phase === 'tarball') {
        ctx.logger.info(`Downloading server bundle: ${event.percent}% (${event.bytesDownloaded}/${event.bytesTotal} bytes)`)
      } else if (event.phase === 'manifest') {
        ctx.logger.info('Fetching server bundle manifest…')
      }
    })

    let distributeResult: Awaited<ReturnType<typeof window.electronAPI.remote.serverBundle.distribute>>
    try {
      distributeResult = await window.electronAPI.remote.serverBundle.distribute({
        draftProfile: {
          targetOS: ctx.targetOS as 'ssh-linux' | 'ssh-darwin',
          sshHost: state.sshHost,
          sshUser: state.sshUser,
          sshPort: state.sshPort,
          sshKeyPath: state.sshKeyPath,
          sshServerArch: state.sshServerArch,
        },
        version,
      })
    } finally {
      unsubscribeDistributeProgress()
    }

    if (!distributeResult.ok) {
      // Distributor already classified the failure (arch-detection-failed,
      // no-source-available, download-failed, baseline-corrupted, aborted) —
      // surface it directly without local retry / fallback (T0320 owns that).
      throw new Error(`[${distributeResult.errorCode}] ${distributeResult.error}`)
    }

    const tarballPath = distributeResult.tarballPath
    state.bundleTarballPath = tarballPath
    state.bundleSource = distributeResult.source
    ctx.logger.info(`${describeSource(distributeResult.source)}: ${tarballPath}`)
    ctx.logger.info(`Uploading ${tarballPath} → ${state.sshUser}@${state.sshHost}:${state.sshInstallPath}`)

    const uploadId = makeUploadId()
    const startedAt = Date.now()

    const unsubscribeUpload = window.electronAPI.ssh.onUploadProgress((payload) => {
      if (payload.uploadId !== uploadId) return
      const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000)
      const speed = payload.bytesSent / elapsedSec
      const remaining = Math.max(0, payload.totalBytes - payload.bytesSent)
      const eta = speed > 0 ? remaining / speed : Infinity

      state.uploadBytesSent = payload.bytesSent
      state.uploadTotalBytes = payload.totalBytes
      state.uploadSpeedBytesPerSec = speed
      state.uploadEtaSeconds = Number.isFinite(eta) ? eta : undefined
    })

    try {
      const result = await window.electronAPI.ssh.uploadBundle({
        uploadId,
        options: {
          sshHost: state.sshHost,
          sshUser: state.sshUser,
          sshPort: state.sshPort,
          sshKeyPath: state.sshKeyPath,
          installPath: state.sshInstallPath,
          tarballPath,
        },
      })
      if (!result.ok) throw new Error(result.error)
    } finally {
      unsubscribeUpload()
    }

    ctx.serverInstallPath = state.sshInstallPath
    ctx.logger.info(`✓ Server bundle installed at ${state.sshInstallPath}`)
  },
  // PLAN-007 T0289 — RFC C-3 best-effort rollback. Removes the install
  // directory the upload created (`ssh user@host "rm -rf <installPath>"`).
  // Failures are surfaced via warn log only; never throw.
  async rollback(ctx) {
    const state = ctx.state as InstallSshBundleState
    if (!state.sshHost || !state.sshUser || !state.sshInstallPath) {
      return
    }
    const result = await window.electronAPI.ssh.uninstallBundle({
      sshHost: state.sshHost,
      sshUser: state.sshUser,
      sshPort: state.sshPort,
      sshKeyPath: state.sshKeyPath,
      installPath: state.sshInstallPath,
    })
    if (!result.ok) {
      ctx.logger.warn(`Failed to remove BAT server bundle over SSH: ${result.error}`)
      return
    }
    ctx.serverInstallPath = undefined
  },
}

export const SshInstallBundleStep = installSshServerBundleStep
