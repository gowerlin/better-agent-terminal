/**
 * BUG-202 / T0799 (D244): the Linux AppImage starts with `--no-sandbox` only when Chromium's sandbox cannot
 * work on this system; everywhere else it starts exactly as before.
 *
 * Why a launcher script and not `app.commandLine.appendSwitch('no-sandbox')` in main.ts: Chromium chooses its
 * Linux sandbox when it starts the zygote (content/app ContentMainRunnerImpl, before BrowserMain), which is
 * before Electron runs any JS. BUG-202 runs crashed with no BAT debug log at all, i.e. before
 * app-paths-bootstrap's logger.init: a switch added from JS comes too late.
 *
 * How it is installed: the electron-builder `afterPack` hook (scripts/version-manifest.cjs) calls
 * `installAppImageLauncher` for a Linux build that has an AppImage target. It renames
 * `<appOutDir>/<executableName>` (the Electron binary) to `<executableName>.bin` and writes this script in its
 * place; the AppImage's AppRun (`BIN="$APPDIR/<executableName>"`, app-builder-lib appImageUtil.js) runs the
 * script, the script `exec`s the binary. Windows / macOS builds and the `.desktop` Exec line are untouched.
 *
 * The script adds `--no-sandbox` only when all of these hold (anything else: `exec` with the arguments as given):
 *   - ELECTRON_RUN_AS_NODE is empty or unset (Node mode has no Chromium sandbox; `--no-sandbox` would be a bad
 *     Node option);
 *   - no argument is `--no-sandbox` already (the AppImage's own .desktop entry passes it);
 *   - `chrome-sandbox` next to the binary is not root-owned + setuid + other-executable (Chromium's own check,
 *     sandbox/linux/suid/client/setuid_sandbox_host.cc; never true inside an AppImage mount);
 *   - unprivileged user namespaces cannot be used by the binary:
 *       · `apparmor_restrict_unprivileged_userns` = 1 (Ubuntu 23.10+) and the binary does not run under an
 *         AppArmor profile (probe: the binary in Node mode reads /proc/self/attr/apparmor/current; `unconfined`
 *         or unreadable = no profile);
 *       · otherwise: `unshare --user --map-root-user true` fails (what Chromium itself tries: a new user
 *         namespace plus a uid map); without `unshare`, `unprivileged_userns_clone` = 0 or
 *         `max_user_namespaces` = 0.
 * When it adds the switch it prints SANDBOX_FALLBACK_STDERR_LINE on stderr and sets
 * `BAT_APPIMAGE_SANDBOX_FALLBACK=1` for the binary; electron/linux-sandbox-fallback.ts logs it in the debug log
 * and removes it from process.env (so PTYs do not inherit it). The script prints nothing else.
 *
 * See docs/agent-guide/linux-appimage-sandbox.md.
 */

const fs = require('fs');
const path = require('path');

/** First line after the shebang: identifies the launcher (scripts/verify-packaged-native.js `appimage-launcher`). */
const LAUNCHER_MARKER = '# BetterAgentTerminal AppImage launcher (BUG-202 / T0799)';
/** Suffix of the renamed Electron binary next to the launcher. */
const REAL_BINARY_SUFFIX = '.bin';
/** Set to `1` for the binary only when the launcher added `--no-sandbox` (electron/linux-sandbox-fallback.ts). */
const SANDBOX_FALLBACK_ENV = 'BAT_APPIMAGE_SANDBOX_FALLBACK';
/** The one line the launcher writes to stderr when it adds `--no-sandbox` (fixed text, no values). */
const SANDBOX_FALLBACK_STDERR_LINE = '[sandbox] userns restricted and chrome-sandbox not setuid root: starting with --no-sandbox (BUG-202)';

/** POSIX single-quoted shell literal. */
function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/**
 * The launcher's text. `executableName` names the binary (`<executableName>.bin` next to the script).
 * `procSys` and `unshare` exist for the tests only (fixture files / a fake `unshare`); the build always uses
 * the defaults. Nothing at run time can change them.
 */
function launcherScript(executableName, { procSys = '/proc/sys', unshare = 'unshare' } = {}) {
  if (!/^[A-Za-z0-9._-]+$/.test(executableName)) throw new Error(`launcherScript: unsafe executable name ${JSON.stringify(executableName)}`);
  const probeJs = 'const f=require("fs");let l="";for(const p of ["/proc/self/attr/apparmor/current","/proc/self/attr/current"]){try{l=f.readFileSync(p,"utf8");break}catch(e){}}process.stdout.write(l.replace(/[\\0\\s]+$/,""))';
  return `#!/bin/sh
${LAUNCHER_MARKER}
# Starts ${executableName}${REAL_BINARY_SUFFIX} (the Electron binary). Adds --no-sandbox only when Chromium's
# sandbox cannot work here: unprivileged user namespaces unusable AND chrome-sandbox not setuid root.
# See docs/agent-guide/linux-appimage-sandbox.md. Arguments, stdin/stdout/stderr, exit code and signals pass
# through: the last step is always exec.
set -u

self=$(readlink -f -- "$0" 2>/dev/null) || self=
[ -n "$self" ] || self=$0
dir=$(dirname -- "$self")
bin="$dir/${executableName}${REAL_BINARY_SUFFIX}"
proc_sys=${shellQuote(procSys)}
unshare_cmd=${shellQuote(unshare)}
probe_js=${shellQuote(probeJs)}
unset ${SANDBOX_FALLBACK_ENV}

# Node mode (ELECTRON_RUN_AS_NODE non-empty, as Electron reads it): no Chromium sandbox, no extra switch.
if [ -n "\${ELECTRON_RUN_AS_NODE:-}" ]; then
  exec "$bin" "$@"
fi

has_no_sandbox() {
  for a in "$@"; do
    [ "$a" = "--no-sandbox" ] && return 0
  done
  return 1
}

# Chromium's check: owned by root, setuid, executable by others.
sandbox_helper_ok() {
  [ -f "$1" ] && [ -u "$1" ] || return 1
  owner=$(stat -L -c %u -- "$1" 2>/dev/null) || return 1
  [ "$owner" = 0 ] || return 1
  mode=$(stat -L -c %a -- "$1" 2>/dev/null) || return 1
  case $mode in
    *[1357]) return 0 ;;
  esac
  return 1
}

read_sys() {
  v=$(cat "$proc_sys/$1" 2>/dev/null) || v=absent
  printf '%s' "$v"
}

# The AppArmor label the binary itself runs under; empty when it cannot be read.
binary_apparmor_label() {
  if command -v timeout >/dev/null 2>&1; then
    ELECTRON_RUN_AS_NODE=1 NODE_OPTIONS='' timeout 5 "$bin" -e "$probe_js" 2>/dev/null </dev/null
  else
    ELECTRON_RUN_AS_NODE=1 NODE_OPTIONS='' "$bin" -e "$probe_js" 2>/dev/null </dev/null
  fi
}

userns_unusable() {
  if [ "$(read_sys kernel/apparmor_restrict_unprivileged_userns)" = 1 ]; then
    label=$(binary_apparmor_label) || label=
    if [ -n "$label" ] && [ "$label" != unconfined ]; then
      return 1
    fi
    return 0
  fi
  if command -v "$unshare_cmd" >/dev/null 2>&1; then
    if "$unshare_cmd" --user --map-root-user true >/dev/null 2>&1 </dev/null; then
      return 1
    fi
    return 0
  fi
  [ "$(read_sys kernel/unprivileged_userns_clone)" = 0 ] && return 0
  [ "$(read_sys user/max_user_namespaces)" = 0 ] && return 0
  return 1
}

if ! has_no_sandbox "$@" && ! sandbox_helper_ok "$dir/chrome-sandbox" && userns_unusable; then
  printf '%s\\n' ${shellQuote(SANDBOX_FALLBACK_STDERR_LINE)} >&2
  ${SANDBOX_FALLBACK_ENV}=1
  export ${SANDBOX_FALLBACK_ENV}
  exec "$bin" --no-sandbox "$@"
fi
exec "$bin" "$@"
`;
}

/** True when `<file>` is a launcher this module wrote. */
function isLauncherFile(file) {
  try {
    const head = fs.readFileSync(file, 'utf8').slice(0, 200);
    return head.startsWith('#!/bin/sh\n') && head.includes(LAUNCHER_MARKER);
  } catch {
    return false;
  }
}

/**
 * Renames `<appOutDir>/<executableName>` to `<executableName>.bin` and writes the launcher in its place
 * (mode 0755). Running it twice on the same directory keeps the already-renamed binary. Returns both paths.
 */
function installAppImageLauncher(appOutDir, executableName) {
  const launcher = path.join(appOutDir, executableName);
  const real = launcher + REAL_BINARY_SUFFIX;
  if (!fs.existsSync(launcher)) throw new Error(`installAppImageLauncher (T0799): ${launcher} does not exist`);
  if (isLauncherFile(launcher)) {
    if (!fs.existsSync(real)) throw new Error(`installAppImageLauncher (T0799): ${launcher} is a launcher but ${real} is missing`);
  } else {
    fs.renameSync(launcher, real);
  }
  fs.writeFileSync(launcher, launcherScript(executableName), { encoding: 'utf8', mode: 0o755 });
  fs.chmodSync(launcher, 0o755);
  return { launcher, real };
}

/** afterPack context of a Linux build with an AppImage target (`build.linux.target`). */
function isLinuxAppImageBuild(context) {
  if (!context || context.electronPlatformName !== 'linux') return false;
  const targets = Array.isArray(context.targets) ? context.targets : [];
  return targets.some((t) => t && typeof t.name === 'string' && t.name.toLowerCase() === 'appimage');
}

/** Part of the electron-builder afterPack hook (scripts/version-manifest.cjs). No-op unless isLinuxAppImageBuild. */
function afterPackAppImageLauncher(context) {
  if (!isLinuxAppImageBuild(context)) return null;
  const executableName = context.packager.executableName;
  const result = installAppImageLauncher(context.appOutDir, executableName);
  console.log(`  • afterPack (T0799): ${path.basename(result.launcher)} = AppImage sandbox launcher, Electron binary = ${path.basename(result.real)}`);
  return result;
}

module.exports = {
  LAUNCHER_MARKER,
  REAL_BINARY_SUFFIX,
  SANDBOX_FALLBACK_ENV,
  SANDBOX_FALLBACK_STDERR_LINE,
  launcherScript,
  isLauncherFile,
  installAppImageLauncher,
  isLinuxAppImageBuild,
  afterPackAppImageLauncher,
};
