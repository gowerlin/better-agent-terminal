import type { FileEntry } from '../../../../types/file'
import type { WizardContext, WizardStep } from '../../wizard-runner'

const INSTALL_PATH = '~/.local/bat-server'

function joinPlatformPath(platform: 'win32' | 'darwin' | 'linux', ...parts: string[]): string {
  const separator = platform === 'win32' ? '\\' : '/'
  return parts.reduce((acc, part) => {
    if (!acc) return part
    return `${acc.replace(/[\\/]+$/, '')}${separator}${part.replace(/^[\\/]+/, '')}`
  })
}

async function findBundleInDirectory(directory: string): Promise<FileEntry | null> {
  try {
    const entries = await window.electronAPI.fs.readdir(directory)
    return entries.find((entry) => !entry.isDirectory && /^bat-server-linux-x64-v.+\.tar\.gz$/i.test(entry.name)) ?? null
  } catch {
    return null
  }
}

async function resolveBundleTarballPath(ctx: WizardContext): Promise<string> {
  const explicit = typeof ctx.state.bundleTarballPath === 'string' ? ctx.state.bundleTarballPath : null
  if (explicit) {
    return explicit
  }

  const userDataPath = await window.electronAPI.app.getUserDataPath()
  const bundleDirectory = joinPlatformPath(window.electronAPI.platform, userDataPath, 'bat-server-bundles')
  const bundleEntry = await findBundleInDirectory(bundleDirectory)
  if (bundleEntry) {
    return bundleEntry.path
  }

  throw new Error('Server bundle tarball not found in userData/bat-server-bundles. Release download flow lands in T0282.')
}

function pushWarning(ctx: WizardContext, warning: string): void {
  if (!ctx.warnings.includes(warning)) {
    ctx.warnings.push(warning)
  }
}

export const installServerBundleStep: WizardStep = {
  id: 'install-server-bundle',
  title: 'Install BAT server bundle',
  appliesTo: ['wsl-linux'],
  retryable: true,
  async run(ctx) {
    if (!ctx.wslDistro) {
      throw new Error('Select a WSL distro before installing the server bundle.')
    }

    const tarballPath = await resolveBundleTarballPath(ctx)
    ctx.logger.info(`Installing BAT server bundle from ${tarballPath}`)
    const result = await window.electronAPI.wsl.installBundle(ctx.wslDistro, tarballPath, INSTALL_PATH)

    if (!result.ok) {
      throw new Error(result.error)
    }

    ctx.serverInstallPath = INSTALL_PATH
    ctx.state.bundleTarballPath = tarballPath
    ctx.state.bundleSha256Verified = false

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
