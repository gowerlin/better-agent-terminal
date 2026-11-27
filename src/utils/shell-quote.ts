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
 * Quote a single argument (e.g. an agent prompt) for interpolation into a
 * shell command line, using the quoting rules of the target shell family.
 *
 * The safe-character fast path is intentionally identical to the private
 * POSIX-only helper this function replaces (`shellQuoteForTerminalCommand` in
 * `electron/main.ts`), so existing dispatch prompts keep byte-identical output.
 *
 * ⚠️ `cmd` limitation — `%VAR%` expansion cannot be escaped.
 * Interactive cmd.exe cannot escape `%VAR%` expansion; if the variable exists
 * it will always expand. `%%` folds back to `%` only inside batch file parsing,
 * not on an interactive / PTY command line, so doubling `%` here would corrupt
 * the common case (`100% done` -> `100%% done`) in order to guard a rare one.
 * This is a limitation of cmd.exe itself, not a defect of this function.
 * Callers that need a literal `%VAR%` must use a non-cmd shell.
 *
 * Double quotes already protect `&`, `|`, `<`, `>` and `^` on cmd; `%` is the
 * only metacharacter that penetrates them.
 */
export function quoteArgForShell(arg: string, shell: ShellFamily): string {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(arg)) return arg

  switch (shell) {
    case 'pwsh':
      // PowerShell single-quoted string: the only escape is a doubled quote.
      return `'${arg.replace(/'/g, "''")}'`
    case 'cmd':
      return quoteArgForCmd(arg)
    case 'posix':
      return `'${arg.replace(/'/g, "'\\''")}'`
  }
}

/** Shells that run on the MSYS / Cygwin runtime when they are a Windows executable (Git Bash). */
const MSYS_SHELL_BASENAMES = new Set(['bash', 'sh', 'git-bash', 'zsh', 'dash', 'ash'])

/**
 * T0946 / BUG-228: whether `shellPath` is a POSIX shell running on Windows through the MSYS
 * runtime (Git Bash, MSYS2, Cygwin). Decided from the path alone, so a remote window (whose
 * shell is a server path such as `/bin/bash`) and a local window answer the same way:
 *
 *   - a Windows path (`C:\…`, `C:/…`, `\\server\…`) whose basename is a POSIX shell → true
 *   - WSL launchers (`…\Windows\System32\bash.exe`, `Sysnative`, `WindowsApps`, `wsl.exe`) → false
 *   - pwsh / powershell / cmd, any POSIX path (macOS / Linux / remote), a bare name → false
 */
export function isWindowsMsysShell(shellPath: string | null | undefined): boolean {
  if (!shellPath) return false
  const normalized = shellPath.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/')
  if (!/^(?:[A-Za-z]:\/|\/\/)/.test(normalized)) return false
  if (/\/windows\/(?:system32|sysnative)\//i.test(normalized) || /\/windowsapps\//i.test(normalized)) return false
  return MSYS_SHELL_BASENAMES.has(shellBasename(shellPath).replace(/\.exe$/i, ''))
}

/**
 * T0946 / BUG-228: Git Bash (MSYS) rewrites an argument that starts with `/` into a Windows path
 * when it runs a native program (`/control-tower` → `C:/Program Files/Git/control-tower`), quoted
 * or not. Returns the assignment that goes in front of that one command so this argument reaches
 * the program unchanged, or null when nothing is needed (not an MSYS shell — see
 * `isWindowsMsysShell` — or the argument does not start with `/`).
 *
 *   MSYS2_ARG_CONV_EXCL="/control-tower${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}"
 *
 * - only for that command (a prefix assignment), never the tab's env (the PTY env and every other
 *   command the user runs are unchanged)
 * - excludes only arguments starting with `arg` (MSYS2_ARG_CONV_EXCL is a `;` list of prefixes,
 *   honoured by Git for Windows and MSYS2): the program's other arguments are converted as before
 * - keeps a value the shell already has (appended after `;`)
 */
export function msysArgConvExclusionPrefix(arg: string, shellPath: string | null | undefined): string | null {
  if (!arg.startsWith('/') || !isWindowsMsysShell(shellPath)) return null
  // `;` separates the list; a prefix up to it still matches the whole argument
  const entry = arg.split(';')[0].replace(/[\\"$`]/g, '\\$&')
  return `MSYS2_ARG_CONV_EXCL="${entry}\${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}"`
}

/**
 * Wrap `arg` in double quotes using the `CommandLineToArgvW` escaping rules
 * (the "Everyone quotes command line arguments the wrong way" algorithm):
 *
 * - a run of backslashes immediately before a `"` is doubled, then one more
 *   backslash is emitted to escape that `"`
 * - a run of backslashes at the end of the string (i.e. immediately before the
 *   closing quote) is doubled
 * - backslashes anywhere else are emitted verbatim
 *
 * `%` is deliberately left untouched — see `quoteArgForShell`.
 */
function quoteArgForCmd(arg: string): string {
  let out = '"'
  let backslashes = 0

  for (const char of arg) {
    if (char === '\\') {
      backslashes += 1
      continue
    }
    if (char === '"') {
      out += '\\'.repeat(backslashes * 2 + 1) + '"'
      backslashes = 0
      continue
    }
    out += '\\'.repeat(backslashes) + char
    backslashes = 0
  }

  return out + '\\'.repeat(backslashes * 2) + '"'
}
