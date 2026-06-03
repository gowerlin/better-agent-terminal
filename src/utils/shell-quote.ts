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

/**
 * Quote a single argv-style argument for a target shell.
 *
 * Differs from `quoteCommandPath`:
 *  - safe identifiers (alnum + `._-=:@/`) pass through unquoted (legacy behaviour
 *    of the private POSIX-only helper in electron/main.ts)
 *  - posix uses single-quote escape (`'\''`), same as bash convention
 *  - pwsh uses single-quote double-up (`''`)
 *  - cmd uses double-quote escape (`""`) AND `%` → `%%` to suppress %VAR%
 *    expansion. Note: `!VAR!` delayed expansion is intentionally not handled
 *    (out-of-scope; depends on shell setlocal state).
 */
export function quoteArgForShell(arg: string, shell: ShellFamily): string {
  if (/^[a-zA-Z0-9._\-=:@/]+$/.test(arg)) return arg
  switch (shell) {
    case 'posix':
      return `'${arg.replace(/'/g, "'\\''")}'`
    case 'pwsh':
      return `'${arg.replace(/'/g, "''")}'`
    case 'cmd':
      return `"${arg.replace(/%/g, '%%').replace(/"/g, '""')}"`
  }
}
