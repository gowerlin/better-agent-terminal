export type ShellFamily = 'posix' | 'pwsh' | 'cmd'

function shellBasename(shellPath: string): string {
  const normalized = shellPath.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/')
  return normalized.split('/').pop()?.toLowerCase() ?? ''
}

export function detectShellFamily(shellPath: string): ShellFamily {
  const basename = shellBasename(shellPath).replace(/\.exe$/i, '')

  if (basename === 'pwsh' || basename === 'powershell') {
    return 'pwsh'
  }
  if (basename === 'cmd') {
    return 'cmd'
  }
  if (basename === 'bash' || basename === 'git-bash' || basename === 'zsh' || basename === 'sh' || basename === 'dash' || basename === 'ash') {
    return 'posix'
  }
  return 'posix'
}

export function quoteCommandPath(path: string, shell: ShellFamily): string {
  switch (shell) {
    case 'pwsh':
      return `& '${path.replace(/'/g, "''")}'`
    case 'cmd':
      return `"${path}"`
    case 'posix':
      return `'${path.replace(/'/g, "'\\''")}'`
  }
}
