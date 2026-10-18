import type { WizardStep } from '../../wizard-runner'
import { PRECONDITION_MISSING_CODE, wizardError } from '../../error-mapper'
import { distributeFailureError, SERVER_BUNDLE_IMPORT_TARGET_KEY } from '../../server-bundle-import'
import { resolveSshInstallPath } from './remote-home'
import { describeSshTarget } from './ssh-target'

interface InstallSshBundleState {
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  sshInstallPath?: string
  /** T0379 — `sshInstallPath` resolved against `sshServerHome` (absolute). */
  sshResolvedInstallPath?: string
  sshServerHome?: string
  sshServerArch?: string
  bundleTarballPath?: string
  bundleSource?: 'cache' | 'baseline' | 'download'
  uploadBytesSent?: number
  uploadTotalBytes?: number
  uploadSpeedBytesPerSec?: number
  uploadEtaSeconds?: number
  /**
   * T0426 (BUG-099) / T0554 (BUG-141): what this run's upload did, set only
   * once it succeeded. Rollback acts on nothing else, so a failure before the
   * upload (e.g. bundle download) never deletes a bundle left by an earlier
   * setup, and a failed upload leaves the root as the install script left it
   * (it extracts beside the root and swaps only after a good extract).
   * `previous`: `kept` = the earlier install is at `<root>.bat-old` (rollback
   * puts it back, finalize removes it); `none` = first install (rollback
   * removes the root); `unmanaged` = extracted over a non-BAT directory
   * (nothing is deleted).
   */
  sshBundleInstall?: SshBundleInstallRecord
  /** T0554: set by start-server's rollback; start the service once the bundle is back. */
  sshServiceStartAfterBundleRestore?: boolean
}

export interface SshBundleInstallRecord {
  root: string
  previous: 'kept' | 'none' | 'unmanaged'
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
    // T0505: the user may be empty (ssh config decides it).
    if (!state.sshHost) {
      throw wizardError('SSH host must be set before installing the server bundle.', PRECONDITION_MISSING_CODE)
    }
    if (!state.sshInstallPath) {
      throw wizardError('Install path must be selected before installing the server bundle.', PRECONDITION_MISSING_CODE)
    }
    if (!state.sshServerArch) {
      throw wizardError('SSH server architecture not detected — re-run verify-ssh-auth before installing the server bundle.', PRECONDITION_MISSING_CODE)
    }
    // T0379 / BUG-088: the upload single-quotes the path (`mkdir -p '<path>'`),
    // so a literal `~` would become a directory named `~` under $HOME. Resolve
    // against the probed remote $HOME before downloading anything.
    const installPath = resolveSshInstallPath(state.sshInstallPath, state.sshServerHome)
    state.sshResolvedInstallPath = installPath

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
          sshUser: state.sshUser ?? '',
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
      // T0547: download failures offer "Import local tarball…" (server-bundle-import.ts).
      throw distributeFailureError(ctx, distributeResult)
    }
    delete ctx.state[SERVER_BUNDLE_IMPORT_TARGET_KEY]

    const tarballPath = distributeResult.tarballPath
    state.bundleTarballPath = tarballPath
    state.bundleSource = distributeResult.source
    ctx.logger.info(`${describeSource(distributeResult.source)}: ${tarballPath}`)
    ctx.logger.info(`Uploading ${tarballPath} → ${describeSshTarget(state.sshUser, state.sshHost)}:${installPath}`)

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
          sshUser: state.sshUser ?? '',
          sshPort: state.sshPort,
          sshKeyPath: state.sshKeyPath,
          installPath,
          tarballPath,
          keepPrevious: true,
        },
      })
      if (!result.ok) throw wizardError(result.error, 'server-bundle-install-failed')
      state.sshBundleInstall = { root: installPath, previous: result.previous ?? 'none' }
    } finally {
      unsubscribeUpload()
    }

    ctx.serverInstallPath = installPath
    ctx.logger.info(`✓ Server bundle installed at ${installPath}`)
    if (state.sshBundleInstall.previous === 'kept') {
      ctx.logger.info(`The previous server bundle is kept until setup finishes (${installPath}.bat-old)`)
    } else if (state.sshBundleInstall.previous === 'unmanaged') {
      ctx.logger.warn(`${installPath} was not a BAT server bundle install; extracted over it (cancel cannot undo this)`)
    }
  },
  // PLAN-007 T0289 — RFC C-3 best-effort rollback. Removes the install
  // directory the upload created (`ssh user@host "rm -rf <installPath>"`).
  // Failures are surfaced via warn log only; never throw.
  // T0426: also runs when the wizard is cancelled. T0554 (BUG-141): only for
  // an upload that succeeded; an upgrade puts the previous bundle back (and
  // starts the service again when start-server's rollback asked for it)
  // instead of deleting the root.
  async rollback(ctx) {
    const state = ctx.state as InstallSshBundleState
    const record = state.sshBundleInstall
    const startAfterRestore = state.sshServiceStartAfterBundleRestore === true
    delete state.sshServiceStartAfterBundleRestore
    if (!record || !state.sshHost) {
      return
    }
    const connection = {
      sshHost: state.sshHost,
      sshUser: state.sshUser ?? '',
      sshPort: state.sshPort,
      sshKeyPath: state.sshKeyPath,
    }
    if (record.previous === 'unmanaged') {
      ctx.logger.warn(`Leaving ${record.root} in place: it was not a BAT server bundle install before this setup`)
    } else if (record.previous === 'kept') {
      const target = ctx.targetOS === 'ssh-linux' || ctx.targetOS === 'ssh-darwin' ? ctx.targetOS : undefined
      const result = await window.electronAPI.ssh.uninstallBundle({
        ...connection,
        installPath: record.root,
        mode: 'restore-previous',
        ...(startAfterRestore && target ? { startService: target } : {}),
      })
      if (!result.ok) {
        ctx.logger.warn(`Failed to restore the previous BAT server bundle over SSH: ${result.error}`)
        return
      }
      if (result.outcome === 'missing') {
        ctx.logger.warn(`No previous BAT server bundle at ${record.root}.bat-old to restore; leaving ${record.root} as it is`)
      } else {
        ctx.logger.info(`Restored the previous BAT server bundle at ${record.root}${startAfterRestore ? ' and started it again' : ''}`)
      }
    } else {
      const result = await window.electronAPI.ssh.uninstallBundle({
        ...connection,
        // T0379: remove what the upload actually created (absolute path).
        installPath: record.root,
      })
      if (!result.ok) {
        ctx.logger.warn(`Failed to remove BAT server bundle over SSH: ${result.error}`)
        return
      }
    }
    delete state.sshBundleInstall
    ctx.serverInstallPath = undefined
    state.sshResolvedInstallPath = undefined
  },
  // T0554: setup finished; the previous bundle is no longer needed.
  async finalize(ctx) {
    const state = ctx.state as InstallSshBundleState
    const record = state.sshBundleInstall
    if (!record || record.previous !== 'kept' || !state.sshHost) return
    const result = await window.electronAPI.ssh.uninstallBundle({
      sshHost: state.sshHost,
      sshUser: state.sshUser ?? '',
      sshPort: state.sshPort,
      sshKeyPath: state.sshKeyPath,
      installPath: record.root,
      mode: 'discard-previous',
    })
    if (!result.ok) throw new Error(`Failed to remove the previous BAT server bundle (${record.root}.bat-old): ${result.error}`)
    ctx.logger.info(`Removed the previous BAT server bundle (${record.root}.bat-old)`)
    delete state.sshBundleInstall
  },
}

export const SshInstallBundleStep = installSshServerBundleStep
