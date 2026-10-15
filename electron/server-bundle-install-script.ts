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
 * Removal scope (whitelist): `<root>.bat-new`, `<root>.bat-old` and the old
 * `<root>` itself, and the old root only when it is a BAT bundle install
 * (`bin/bat-server`, or a pre-T0511 `staging/bin/bat-server`) or an empty
 * directory. Any other existing root (a symlink, a file, a directory holding
 * something else) is extracted over as before and nothing is deleted. The
 * user data directory (`~/.local/share/bat-server`) is never under the root.
 * `<root>` must be an absolute path with at least two segments and must not be
 * `$HOME` (checked in TypeScript and again in the remote shell).
 */

export const BUNDLE_STAGE_SUFFIX = '.bat-new'
export const BUNDLE_OLD_SUFFIX = '.bat-old'

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

/**
 * Shell body (POSIX sh / bash / zsh / BSD userland). Expects `dst` to be set to
 * the validated root; `extract` is a command reading the tarball into the
 * directory named by `$target`.
 */
function buildInstallBody(extract: string): string[] {
  return [
    `stage="$dst${BUNDLE_STAGE_SUFFIX}"`,
    `old="$dst${BUNDLE_OLD_SUFFIX}"`,
    'case "$dst" in /?*/?*) ;; *) echo "server bundle install: refusing install path $dst" >&2; exit 2 ;; esac',
    'if [ -n "$HOME" ] && [ "$dst" = "${HOME%/}" ]; then echo "server bundle install: refusing to replace the home directory $dst" >&2; exit 2; fi',
    'managed=0',
    'if [ ! -e "$dst" ] && [ ! -L "$dst" ]; then managed=1',
    'elif [ -d "$dst" ] && [ ! -L "$dst" ]; then',
    '  if [ -f "$dst/bin/bat-server" ] || [ -f "$dst/staging/bin/bat-server" ] || [ -z "$(ls -A "$dst")" ]; then managed=1; fi',
    'fi',
    'if [ "$managed" = 1 ]; then',
    '  rm -rf -- "$stage" "$old" || exit 1',
    '  mkdir -p -- "$stage" || exit 1',
    '  target="$stage"',
    `  if ! ${extract}; then rm -rf -- "$stage"; echo "server bundle install: extract failed" >&2; exit 1; fi`,
    '  if [ ! -x "$stage/bin/bat-server" ]; then rm -rf -- "$stage"; echo "server bundle layout unexpected: bin/bat-server missing after extract" >&2; exit 1; fi',
    '  if [ -e "$dst" ]; then mv -- "$dst" "$old" || { rm -rf -- "$stage"; exit 1; }; fi',
    '  if ! mv -- "$stage" "$dst"; then if [ -e "$old" ]; then mv -- "$old" "$dst"; fi; exit 1; fi',
    '  rm -rf -- "$old"',
    '  echo "server bundle install: replaced $dst"',
    'else',
    '  echo "server bundle install: $dst is not a BAT server bundle install; extracting over it without removing anything" >&2',
    '  mkdir -p -- "$dst" || exit 1',
    '  target="$dst"',
    `  ${extract} || exit 1`,
    '  if [ ! -x "$dst/bin/bat-server" ]; then echo "server bundle layout unexpected: bin/bat-server missing after extract" >&2; exit 1; fi',
    '  echo "server bundle install: extracted over $dst"',
    'fi',
  ]
}

/**
 * WSL: run as `wsl -d <distro> --exec sh -c <script> sh <root> <tarball>`.
 * `--exec` keeps argv intact (`wsl --` re-parses the joined command line in
 * the login shell and drops the positional arguments; T0552 measured).
 */
export function buildWslBundleInstallScript(): string {
  return [
    'dst="$1"',
    'tarball="$2"',
    ...buildInstallBody('tar -xzf "$tarball" -C "$target" --strip-components=1'),
  ].join('\n')
}

/**
 * SSH: the remote command itself; the tarball arrives on stdin. `safeRoot`
 * must already be validated and free of single quotes.
 */
export function buildSshBundleInstallCommand(safeRoot: string): string {
  return [
    `dst='${safeRoot}'`,
    ...buildInstallBody('tar xz -C "$target" --strip-components=1'),
  ].join('\n')
}
