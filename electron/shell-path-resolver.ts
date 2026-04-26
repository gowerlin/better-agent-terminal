import * as fsSync from 'fs'

export interface PersistedShellSettings {
  shell?: string
  customShellPath?: string
}

interface ResolveShellPathOptions {
  platform: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  existsSync?: (path: string) => boolean
}

const DEFAULT_WINDOWS_GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'

export function resolveShellPath(shellType: string, options: ResolveShellPathOptions): string {
  const exists = options.existsSync ?? fsSync.existsSync
  const env = options.env ?? process.env

  if (options.platform === 'darwin' || options.platform === 'linux') {
    if (shellType === 'auto') return env.SHELL || '/bin/zsh'
    if (shellType === 'zsh') return '/bin/zsh'
    if (shellType === 'bash') {
      if (exists('/opt/homebrew/bin/bash')) return '/opt/homebrew/bin/bash'
      if (exists('/usr/local/bin/bash')) return '/usr/local/bin/bash'
      return '/bin/bash'
    }
    if (shellType === 'sh') return '/bin/sh'
    if (shellType === 'pwsh' || shellType === 'powershell' || shellType === 'cmd') {
      return env.SHELL || '/bin/zsh'
    }
    return shellType
  }

  if (shellType === 'auto' || shellType === 'pwsh') {
    const pwshPaths = [
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
      `${env.LOCALAPPDATA}\\Microsoft\\WindowsApps\\pwsh.exe`,
    ]
    const found = pwshPaths.find(exists)
    if (found) return found
    if (shellType === 'pwsh') return 'pwsh.exe'
    return 'powershell.exe'
  }
  if (shellType === 'powershell') return 'powershell.exe'
  if (shellType === 'cmd') return 'cmd.exe'
  if (shellType === 'git-bash') {
    const gitBashPaths = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      `${env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
    ]
    return gitBashPaths.find(exists) || DEFAULT_WINDOWS_GIT_BASH
  }
  return shellType
}

export function resolvePersistedShellPath(
  settings: PersistedShellSettings | null | undefined,
  options: ResolveShellPathOptions
): string | undefined {
  if (!settings?.shell) return undefined
  if (settings.shell === 'custom') {
    return settings.customShellPath?.trim() || undefined
  }
  return resolveShellPath(settings.shell, options)
}
