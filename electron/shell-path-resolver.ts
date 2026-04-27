import * as fsSync from 'fs'

export interface PersistedShellSettings {
  shell?: string
  customShellPath?: string
}

export interface ShellPathResolution {
  shellPath: string
  fallback: boolean
  fallbackReason?: string
}

export interface PersistedShellPathResolution {
  shellPath?: string
  persistedShell: string
  fallback: boolean
  fallbackReason?: string
}

interface ResolveShellPathOptions {
  platform: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  existsSync?: (path: string) => boolean
}

const DEFAULT_WINDOWS_GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'

export function resolveShellPath(shellType: string, options: ResolveShellPathOptions): string {
  return resolveShellPathWithDiagnostics(shellType, options).shellPath
}

export function resolveShellPathWithDiagnostics(shellType: string, options: ResolveShellPathOptions): ShellPathResolution {
  const exists = options.existsSync ?? fsSync.existsSync
  const env = options.env ?? process.env

  if (options.platform === 'darwin' || options.platform === 'linux') {
    if (shellType === 'auto') return { shellPath: env.SHELL || '/bin/zsh', fallback: !env.SHELL, fallbackReason: env.SHELL ? undefined : 'missing-shell-env' }
    if (shellType === 'zsh') return { shellPath: '/bin/zsh', fallback: false }
    if (shellType === 'bash') {
      if (exists('/opt/homebrew/bin/bash')) return { shellPath: '/opt/homebrew/bin/bash', fallback: false }
      if (exists('/usr/local/bin/bash')) return { shellPath: '/usr/local/bin/bash', fallback: false }
      return { shellPath: '/bin/bash', fallback: true, fallbackReason: 'missing-known-executable' }
    }
    if (shellType === 'sh') return { shellPath: '/bin/sh', fallback: false }
    if (shellType === 'pwsh' || shellType === 'powershell' || shellType === 'cmd') {
      return { shellPath: env.SHELL || '/bin/zsh', fallback: true, fallbackReason: env.SHELL ? 'unsupported-shell-on-platform' : 'missing-shell-env' }
    }
    return { shellPath: shellType, fallback: false }
  }

  if (shellType === 'auto' || shellType === 'pwsh') {
    const pwshPaths = [
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
      `${env.LOCALAPPDATA}\\Microsoft\\WindowsApps\\pwsh.exe`,
    ]
    const found = pwshPaths.find(exists)
    if (found) return { shellPath: found, fallback: false }
    if (shellType === 'pwsh') return { shellPath: 'pwsh.exe', fallback: true, fallbackReason: 'missing-known-executable' }
    return { shellPath: 'powershell.exe', fallback: true, fallbackReason: 'missing-known-executable' }
  }
  if (shellType === 'powershell') return { shellPath: 'powershell.exe', fallback: false }
  if (shellType === 'cmd') return { shellPath: 'cmd.exe', fallback: false }
  if (shellType === 'git-bash') {
    const gitBashPaths = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      `${env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
    ]
    const found = gitBashPaths.find(exists)
    if (found) return { shellPath: found, fallback: false }
    return { shellPath: DEFAULT_WINDOWS_GIT_BASH, fallback: true, fallbackReason: 'missing-known-executable' }
  }
  return { shellPath: shellType, fallback: false }
}

export function resolvePersistedShellPath(
  settings: PersistedShellSettings | null | undefined,
  options: ResolveShellPathOptions
): string | undefined {
  return resolvePersistedShellPathWithDiagnostics(settings, options).shellPath
}

export function resolvePersistedShellPathWithDiagnostics(
  settings: PersistedShellSettings | null | undefined,
  options: ResolveShellPathOptions
): PersistedShellPathResolution {
  if (!settings?.shell) {
    return {
      shellPath: undefined,
      persistedShell: 'unset',
      fallback: true,
      fallbackReason: 'missing-persisted-shell',
    }
  }
  const persistedShell = settings.shell
  if (settings.shell === 'custom') {
    const shellPath = settings.customShellPath?.trim() || undefined
    return {
      shellPath,
      persistedShell,
      fallback: !shellPath,
      fallbackReason: shellPath ? undefined : 'empty-custom-shell-path',
    }
  }
  const resolved = resolveShellPathWithDiagnostics(settings.shell, options)
  return {
    shellPath: resolved.shellPath,
    persistedShell,
    fallback: resolved.fallback,
    fallbackReason: resolved.fallbackReason,
  }
}
