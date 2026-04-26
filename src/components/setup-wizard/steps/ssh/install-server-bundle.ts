import type { FileEntry } from '../../../../types/file'
import type { WizardContext, WizardStep } from '../../wizard-runner'

interface InstallSshBundleState {
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  sshInstallPath?: string
  sshServerArch?: string
  bundleTarballPath?: string
  uploadBytesSent?: number
  uploadTotalBytes?: number
  uploadSpeedBytesPerSec?: number
  uploadEtaSeconds?: number
}

function joinPlatformPath(platform: 'win32' | 'darwin' | 'linux', ...parts: string[]): string {
  const separator = platform === 'win32' ? '\\' : '/'
  return parts.reduce((acc, part) => {
    if (!acc) return part
    return `${acc.replace(/[\\/]+$/, '')}${separator}${part.replace(/^[\\/]+/, '')}`
  })
}

async function findBundleInDirectory(directory: string, archHint: string): Promise<FileEntry | null> {
  try {
    const entries = await window.electronAPI.fs.readdir(directory)
    // Prefer arch-specific tarball; fall back to x64 for backwards compat.
    const archCandidates = archHint === 'arm64' || archHint === 'aarch64'
      ? [/^bat-server-linux-arm64-v.+\.tar\.gz$/i, /^bat-server-linux-x64-v.+\.tar\.gz$/i]
      : [/^bat-server-linux-x64-v.+\.tar\.gz$/i]
    for (const pattern of archCandidates) {
      const match = entries.find((entry) => !entry.isDirectory && pattern.test(entry.name))
      if (match) return match
    }
    return null
  } catch {
    return null
  }
}

async function resolveBundleTarballPath(ctx: WizardContext, archHint: string): Promise<string> {
  const explicit = typeof ctx.state.bundleTarballPath === 'string' ? (ctx.state.bundleTarballPath as string) : null
  if (explicit) return explicit

  const userDataPath = await window.electronAPI.app.getUserDataPath()
  const bundleDirectory = joinPlatformPath(window.electronAPI.platform, userDataPath, 'bat-server-bundles')
  const bundleEntry = await findBundleInDirectory(bundleDirectory, archHint)
  if (bundleEntry) return bundleEntry.path

  throw new Error('Server bundle tarball not found in userData/bat-server-bundles. Ensure the BAT release shipped the linux-x64 / linux-arm64 tarball.')
}

function makeUploadId(): string {
  return `ssh-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * `install-server-bundle` step (T0285 AC5/AC9).
 *
 * Streams the local server bundle tarball over `ssh user@host 'mkdir -p X
 * && cd X && tar xz'` (D-SSH-4: ssh+tar pipe, no scp/rsync). Progress is
 * reported via `ssh:upload-progress` one-way events (still in the `ssh:*`
 * namespace, so AC8 ≤3 handler-channel budget is preserved).
 */
export const installSshServerBundleStep: WizardStep = {
  id: 'install-server-bundle',
  title: 'Install BAT server bundle (SSH)',
  appliesTo: ['ssh-linux', 'ssh-darwin'],
  retryable: true,
  async run(ctx) {
    const state = ctx.state as InstallSshBundleState
    if (!state.sshHost || !state.sshUser) {
      throw new Error('SSH host and user must be set before installing the server bundle.')
    }
    if (!state.sshInstallPath) {
      throw new Error('Install path must be selected before installing the server bundle.')
    }

    const archHint = state.sshServerArch ?? 'x86_64'
    const tarballPath = await resolveBundleTarballPath(ctx, archHint)
    state.bundleTarballPath = tarballPath
    ctx.logger.info(`Uploading ${tarballPath} → ${state.sshUser}@${state.sshHost}:${state.sshInstallPath}`)

    const uploadId = makeUploadId()
    const startedAt = Date.now()

    const unsubscribe = window.electronAPI.ssh.onUploadProgress((payload) => {
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
      unsubscribe()
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
