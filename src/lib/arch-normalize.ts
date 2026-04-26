// Server bundle architecture normalization (PLAN-031 / T0314).
//
// Pure functions — no side effects, no env reads, no fetches, no file IO.
// Shared by T0319 (arch detection IPC) and T0322 (SSH install-bundle step).
// Spec source: T0313 D.1 / D.2 + T0314 spec §3.4 / §9.

export type ServerBundleArch = 'linux-x64' | 'linux-arm64' | 'darwin-arm64'

export type TargetOS =
  | 'wsl-linux'
  | 'docker-linux'
  | 'ssh-linux'
  | 'ssh-darwin'
  | 'local'

const LINUX_TARGETS: readonly TargetOS[] = ['wsl-linux', 'docker-linux', 'ssh-linux']
const DARWIN_TARGETS: readonly TargetOS[] = ['ssh-darwin']

/**
 * Default GitHub Release base URL for server bundle tarballs.
 * Tag namespace: `server-bundle-vX.Y.Z` (D093, separate from desktop `vX.Y.Z`).
 *
 * Caller may override via `baseURL` param (typical source:
 * `BAT_SERVER_BUNDLE_BASE_URL` env, resolved by caller — this module
 * stays pure and does not read env directly).
 */
export const DEFAULT_RELEASE_BASE_URL =
  'https://github.com/anthropics/better-agent-terminal/releases/download'

/**
 * Normalize raw `uname -m` output to canonical ServerBundleArch.
 * Returns null if arch is not supported (caller should produce
 * actionable error — see spec §3.4 unsupported-arch IPC error).
 *
 * Supported mappings:
 *   Linux target + (x86_64 | amd64) → linux-x64
 *   Linux target + (aarch64 | arm64) → linux-arm64
 *   Darwin target + (arm64 | aarch64) → darwin-arm64
 *   Anything else → null
 *
 * Linux targets: wsl-linux | docker-linux | ssh-linux
 * Darwin target: ssh-darwin
 * `local` always returns null (server bundle distribution not applicable).
 *
 * Spec §1.3 排除：darwin-x64（Intel Mac SSH server <20%，T0266 §3）。
 */
export function normalizeArch(
  rawUname: string,
  targetOS: TargetOS,
): ServerBundleArch | null {
  const trimmed = rawUname.trim().toLowerCase()
  if (trimmed === '') return null

  if (LINUX_TARGETS.includes(targetOS)) {
    if (trimmed === 'x86_64' || trimmed === 'amd64') return 'linux-x64'
    if (trimmed === 'aarch64' || trimmed === 'arm64') return 'linux-arm64'
    return null
  }

  if (DARWIN_TARGETS.includes(targetOS)) {
    if (trimmed === 'arm64' || trimmed === 'aarch64') return 'darwin-arm64'
    return null
  }

  return null
}

/**
 * Build canonical tarball filename for given arch + BAT version.
 * Pattern: `bat-server-${arch}-v${version}.tar.gz`
 * Matches T0283 build script naming convention.
 */
export function tarballNameForArch(
  arch: ServerBundleArch,
  batVersion: string,
): string {
  return `bat-server-${arch}-v${batVersion}.tar.gz`
}

/**
 * Build full GitHub Release URL for tarball.
 *
 * Default base composes `${DEFAULT_RELEASE_BASE_URL}/server-bundle-v${version}`.
 * Caller may pass `baseURL` to override (private deployment / fork);
 * trailing slash on `baseURL` is tolerated (no double-slash output).
 *
 * Note: this module does NOT read `BAT_SERVER_BUNDLE_BASE_URL` env;
 * caller is responsible for env resolution to keep this pure.
 */
export function tarballURL(
  arch: ServerBundleArch,
  batVersion: string,
  baseURL?: string,
): string {
  const base = baseURL ?? `${DEFAULT_RELEASE_BASE_URL}/server-bundle-v${batVersion}`
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${trimmedBase}/${tarballNameForArch(arch, batVersion)}`
}
