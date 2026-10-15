/**
 * T0552 (BUG-139): clean overwrite install of a server bundle, shared by the
 * WSL wizard (`wsl-detect.ts` `installBundle`) and the SSH upload
 * (`remote/ssh-bundle-uploader.ts`). Before T0552 both extracted the tarball on
 * top of the old install, so packages a newer bundle dropped stayed behind
 * (0.5.9 -> 0.6.1: `claude-agent-sdk-linux-x64`, `@img`, `better-sqlite3`,
 * `sharp`, ~256 MiB).
 *
 * The bundle is extracted into `<root>.bat-new` and checked for
 * `bin/bat-server`; only then is the old root renamed to `<root>.bat-old`, the
 * new tree renamed into place and the old one removed. A failed download or
 * extract leaves the old install untouched.
 *
 * T0554 (BUG-141): with keep-previous (the setup wizard) the old tree stays at
 * `<root>.bat-old` after the swap. The wizard then either restores it (cancel
 * after a later step failed: `buildWslBundleRestoreScript` /
 * `buildSshBundleRestoreCommand`) or removes it once every step succeeded
 * (`...DiscardPreviousScript` / `...DiscardPreviousCommand`). A swap or restore
 * cut short (BAT closed between the two renames) leaves the previous install
 * only in `<root>.bat-old` with no `<root>`; the next install moves it back
 * before doing anything else, so it is never deleted as a stale leftover.
 *
 * Removal scope (whitelist): `<root>.bat-new`, `<root>.bat-old` and the old
 * `<root>` itself, and the old root only when it is a BAT bundle install
 * (`bin/bat-server`, or a pre-T0511 `staging/bin/bat-server`) or an empty
 * directory. T0554: the same rule now applies to an existing `<root>.bat-old`
 * (a BAT bundle install, an empty directory or a symlink, which `rm -rf` unlinks
 * without following); anything else there stops the install / discard instead
 * of being deleted. Any other existing root (a symlink, a file, a directory
 * holding something else) is extracted over as before and nothing is deleted.
 * The user data directory (`~/.local/share/bat-server`) is never under the root.
 * `<root>` must be an absolute path with at least two segments and must not be
 * `$HOME` (checked in TypeScript and again in the remote shell).
 */

export const BUNDLE_STAGE_SUFFIX = '.bat-new'
export const BUNDLE_OLD_SUFFIX = '.bat-old'

/**
 * T0554: stdout marker of an install (`kept` = the previous install is at
 * `<root>.bat-old`; `none` = there was none, or it was removed because
 * keep-previous was off; `unmanaged` = extracted over a root that is not a BAT
 * bundle install) and of a restore (`restored` / `missing`).
 */
export const BUNDLE_PREVIOUS_MARKER = 'BAT_BUNDLE_PREVIOUS='
export const BUNDLE_RESTORE_MARKER = 'BAT_BUNDLE_RESTORE='

export type BundleInstallPrevious = 'kept' | 'none' | 'unmanaged'
export type BundleRestoreOutcome = 'restored' | 'missing'

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/

/**
 * Validate and normalise (trailing `/` stripped) an install root before any
 * delete runs. Rejects `''`, `/`, `~`, relative paths, single-segment paths
 * (`/opt`), `.` / `..` / empty segments, quotes, backslashes and control chars.
 */
export function assertBundleInstallRoot(installPath: unknown): string {
  if (typeof installPath !== 'string') {
    throw new Error(`Invalid server bundle install path: ${JSON.stringify(installPath)}`)
  }
  const root = installPath.replace(/\/+$/, '')
  const segments = root.split('/').slice(1)
  if (
    !root.startsWith('/')
    || segments.length < 2
    || segments.some((segment) => segment === '' || segment === '.' || segment === '..')
    || /['"\\`$]/.test(root)
    || CONTROL_CHAR_PATTERN.test(root)
  ) {
    throw new Error(`Invalid server bundle install path (absolute, at least two segments, no quotes): ${JSON.stringify(installPath)}`)
  }
  return root
}

function parseMarker<T extends string>(stdout: string, marker: string, values: readonly T[]): T | null {
  let found: T | null = null
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(marker)) continue
    const value = trimmed.slice(marker.length) as T
    if (values.includes(value)) found = value
  }
  return found
}

/** T0554: install stdout -> previous-install state; null when the marker is absent. */
export function parseBundleInstallPrevious(stdout: string): BundleInstallPrevious | null {
  return parseMarker(stdout, BUNDLE_PREVIOUS_MARKER, ['kept', 'none', 'unmanaged'] as const)
}

/** T0554: restore stdout -> outcome; null when the marker is absent. */
export function parseBundleRestoreOutcome(stdout: string): BundleRestoreOutcome | null {
  return parseMarker(stdout, BUNDLE_RESTORE_MARKER, ['restored', 'missing'] as const)
}

/** `$1` holds a BAT bundle install (`bin/bat-server` or pre-T0511 `staging/bin/bat-server`). */
function isBundleInstall(variable: string): string {
  return `{ [ -d "${variable}" ] && [ ! -L "${variable}" ] && { [ -f "${variable}/bin/bat-server" ] || [ -f "${variable}/staging/bin/bat-server" ]; }; }`
}

/** A directory BAT may delete: a bundle install or an empty directory. */
function isRemovableBundleDir(variable: string): string {
  return `{ [ -d "${variable}" ] && [ ! -L "${variable}" ] && { [ -f "${variable}/bin/bat-server" ] || [ -f "${variable}/staging/bin/bat-server" ] || [ -z "$(ls -A "${variable}")" ]; }; }`
}

/** Shared prelude: `$dst` set; derives `$stage` / `$old` and refuses unsafe roots. */
function buildRootChecks(): string[] {
  return [
    `stage="$dst${BUNDLE_STAGE_SUFFIX}"`,
    `old="$dst${BUNDLE_OLD_SUFFIX}"`,
    'case "$dst" in /?*/?*) ;; *) echo "server bundle install: refusing install path $dst" >&2; exit 2 ;; esac',
    'if [ -n "$HOME" ] && [ "$dst" = "${HOME%/}" ]; then echo "server bundle install: refusing to replace the home directory $dst" >&2; exit 2; fi',
  ]
}

/**
 * Refuses to go on when `$old` exists and is something BAT must not delete (a
 * symlink is fine: `rm -rf` unlinks it without following).
 */
function buildOldGuard(action: string): string {
  return `if [ -e "$old" ] && [ ! -L "$old" ] && ! ${isRemovableBundleDir('$old')}; then echo "server bundle ${action}: $old is not a BAT server bundle install; move it away and retry" >&2; exit 1; fi`
}

/**
 * Shell body (POSIX sh / bash / zsh / BSD userland). Expects `dst` to be set to
 * the validated root and `keep` to `1` (keep the previous install at `$old`) or
 * anything else; `extract` is a command reading the tarball into the directory
 * named by `$target`.
 */
function buildInstallBody(extract: string): string[] {
  return [
    ...buildRootChecks(),
    // T0554: a swap / restore cut short left the previous install only in $old.
    `if [ ! -e "$dst" ] && [ ! -L "$dst" ] && ${isBundleInstall('$old')}; then`,
    '  mv -- "$old" "$dst" || exit 1',
    '  echo "server bundle install: recovered $dst from $old (an earlier install was interrupted)"',
    'fi',
    'managed=0',
    'if [ ! -e "$dst" ] && [ ! -L "$dst" ]; then managed=1',
    'elif [ -d "$dst" ] && [ ! -L "$dst" ]; then',
    '  if [ -f "$dst/bin/bat-server" ] || [ -f "$dst/staging/bin/bat-server" ] || [ -z "$(ls -A "$dst")" ]; then managed=1; fi',
    'fi',
    'if [ "$managed" = 1 ]; then',
    `  ${buildOldGuard('install')}`,
    '  rm -rf -- "$stage" "$old" || exit 1',
    '  mkdir -p -- "$stage" || exit 1',
    '  target="$stage"',
    `  if ! ${extract}; then rm -rf -- "$stage"; echo "server bundle install: extract failed" >&2; exit 1; fi`,
    '  if [ ! -x "$stage/bin/bat-server" ]; then rm -rf -- "$stage"; echo "server bundle layout unexpected: bin/bat-server missing after extract" >&2; exit 1; fi',
    '  previous=none',
    '  if [ -e "$dst" ]; then mv -- "$dst" "$old" || { rm -rf -- "$stage"; exit 1; }; previous=kept; fi',
    '  if ! mv -- "$stage" "$dst"; then if [ -e "$old" ]; then mv -- "$old" "$dst"; fi; exit 1; fi',
    '  if [ "$previous" = kept ] && [ "$keep" != 1 ]; then rm -rf -- "$old"; previous=none; fi',
    '  echo "server bundle install: replaced $dst"',
    `  echo "${BUNDLE_PREVIOUS_MARKER}$previous"`,
    'else',
    '  echo "server bundle install: $dst is not a BAT server bundle install; extracting over it without removing anything" >&2',
    '  mkdir -p -- "$dst" || exit 1',
    '  target="$dst"',
    `  ${extract} || exit 1`,
    '  if [ ! -x "$dst/bin/bat-server" ]; then echo "server bundle layout unexpected: bin/bat-server missing after extract" >&2; exit 1; fi',
    '  echo "server bundle install: extracted over $dst"',
    `  echo "${BUNDLE_PREVIOUS_MARKER}unmanaged"`,
    'fi',
  ]
}

/**
 * T0554: put the install kept at `$old` back. The current root (the bundle this
 * wizard run installed) is moved aside to `$stage` first and deleted only after
 * the previous install is in place; a root that is not a BAT bundle install is
 * left alone (exit 1). No previous install -> `missing`, nothing changed.
 */
function buildRestoreBody(): string[] {
  return [
    ...buildRootChecks(),
    `if ! ${isBundleInstall('$old')}; then`,
    '  echo "server bundle restore: no previous install at $old" >&2',
    `  echo "${BUNDLE_RESTORE_MARKER}missing"`,
    '  exit 0',
    'fi',
    'if [ -e "$dst" ] || [ -L "$dst" ]; then',
    `  if ! ${isRemovableBundleDir('$dst')}; then echo "server bundle restore: $dst is not a BAT server bundle install; leaving it" >&2; exit 1; fi`,
    '  rm -rf -- "$stage" || exit 1',
    '  mv -- "$dst" "$stage" || exit 1',
    'fi',
    'if ! mv -- "$old" "$dst"; then if [ -e "$stage" ]; then mv -- "$stage" "$dst"; fi; exit 1; fi',
    'rm -rf -- "$stage"',
    'echo "server bundle restore: restored $dst from $old"',
    `echo "${BUNDLE_RESTORE_MARKER}restored"`,
  ]
}

/** T0554: the wizard finished; remove the install kept at `$old` (whitelist rule). */
function buildDiscardPreviousBody(): string[] {
  return [
    ...buildRootChecks(),
    buildOldGuard('cleanup'),
    'rm -rf -- "$old" || exit 1',
    'echo "server bundle cleanup: removed $old"',
  ]
}

/**
 * WSL: run as `wsl -d <distro> --exec sh -c <script> sh <root> <tarball> [keep]`.
 * `--exec` keeps argv intact (`wsl --` re-parses the joined command line in
 * the login shell and drops the positional arguments; T0552 measured).
 * T0554: `keep` as the third argument keeps the previous install at `$old`.
 */
export function buildWslBundleInstallScript(): string {
  return [
    'dst="$1"',
    'tarball="$2"',
    'keep=0; if [ "$3" = keep ]; then keep=1; fi',
    ...buildInstallBody('tar -xzf "$tarball" -C "$target" --strip-components=1'),
  ].join('\n')
}

/** T0554 — WSL: `wsl -d <distro> --exec sh -c <script> sh <root>`. */
export function buildWslBundleRestoreScript(): string {
  return ['dst="$1"', ...buildRestoreBody()].join('\n')
}

/** T0554 — WSL: `wsl -d <distro> --exec sh -c <script> sh <root>`. */
export function buildWslBundleDiscardPreviousScript(): string {
  return ['dst="$1"', ...buildDiscardPreviousBody()].join('\n')
}

/**
 * SSH: the remote command itself; the tarball arrives on stdin. `safeRoot`
 * must already be validated and free of single quotes.
 */
export function buildSshBundleInstallCommand(safeRoot: string, options: { keepPrevious?: boolean } = {}): string {
  return [
    `dst='${safeRoot}'`,
    `keep=${options.keepPrevious ? 1 : 0}`,
    ...buildInstallBody('tar xz -C "$target" --strip-components=1'),
  ].join('\n')
}

/**
 * T0554 — SSH restore. `afterRestore` (a fixed command built by the caller from
 * constants, e.g. starting the service again) runs only when the previous
 * install was put back.
 */
export function buildSshBundleRestoreCommand(safeRoot: string, afterRestore?: string): string {
  return [`dst='${safeRoot}'`, ...buildRestoreBody(), ...(afterRestore ? [afterRestore] : [])].join('\n')
}

/** T0554 — SSH: remove the install kept at `$old`. */
export function buildSshBundleDiscardPreviousCommand(safeRoot: string): string {
  return [`dst='${safeRoot}'`, ...buildDiscardPreviousBody()].join('\n')
}
