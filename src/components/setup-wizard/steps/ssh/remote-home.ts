/**
 * T0379 / BUG-088 (D126) — absolute remote paths for the SSH wizard.
 *
 * The SSH wizard's default install path is the literal `~/.local/bat-server`.
 * Every place it lands is a non-expanding context: the upload runs
 * `mkdir -p '<path>' && cd '<path>' && tar xz` (bash does not expand `~`
 * inside single quotes — it creates a directory literally named `~`), systemd
 * does not expand `~` in `ExecStart`, and launchd does not expand it in
 * `ProgramArguments`. So the wizard resolves the path against the remote
 * `$HOME` captured by `verify-ssh-auth` before using it.
 *
 * Mirrors `resolveServerHome()` / `expandHomePath()` in
 * `electron/remote/ssh-start-server.ts`, which re-applies the same rule at
 * render time as a second line of defence.
 */

/** Validated remote home without trailing slash (`/` becomes `''`). */
export function resolveSshServerHome(serverHome: unknown): string {
  if (typeof serverHome !== 'string' || serverHome.length === 0) {
    throw new Error('Server $HOME must be probed (verify-ssh-auth) before resolving the install path.')
  }
  if (!/^\/[A-Za-z0-9._/-]*$/.test(serverHome) || serverHome.split('/').includes('..')) {
    throw new Error(`Server $HOME must be an absolute path without special characters: ${JSON.stringify(serverHome)}`)
  }
  return serverHome.replace(/\/+$/, '')
}

/**
 * `~` / `~/...` → `<home>/...`; absolute paths pass through unchanged;
 * anything else (`~user/...`, relative) is rejected.
 */
export function resolveSshInstallPath(installPath: string, serverHome: unknown): string {
  const home = resolveSshServerHome(serverHome)
  if (installPath === '~') return home || '/'
  if (installPath.startsWith('~/')) return `${home}${installPath.slice(1)}`
  if (installPath.startsWith('/')) return installPath
  throw new Error(`Install path must be absolute or start with ~/ (got ${JSON.stringify(installPath)})`)
}
