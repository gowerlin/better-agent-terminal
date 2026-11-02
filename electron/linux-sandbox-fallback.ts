/**
 * BUG-202 / T0799 (D244): the debug-log side of the Linux AppImage sandbox launcher.
 *
 * The decision itself is made before Electron starts, by the launcher script that replaces the AppImage's
 * executable (scripts/appimage-sandbox-launcher.cjs; Chromium picks its sandbox before any JS runs). When the
 * launcher adds `--no-sandbox` it sets `BAT_APPIMAGE_SANDBOX_FALLBACK=1` for the binary. main.ts calls
 * `takeLinuxSandboxStart` once at startup: it removes that variable from `env` (so PTYs and other children do
 * not inherit it) and returns the one `[sandbox]` line to log on Linux. Only switch / marker presence is
 * logged — never an environment value.
 *
 * Not imported by the renderer; does not import electron. See docs/agent-guide/linux-appimage-sandbox.md.
 */

/** Keep in sync with SANDBOX_FALLBACK_ENV in scripts/appimage-sandbox-launcher.cjs. */
export const APPIMAGE_SANDBOX_FALLBACK_ENV = 'BAT_APPIMAGE_SANDBOX_FALLBACK'

export type LinuxSandboxStart =
  /** the launcher added `--no-sandbox` (BUG-202 fallback) */
  | 'auto-disabled'
  /** `--no-sandbox` came from the command line (e.g. the AppImage .desktop entry), not from the launcher */
  | 'disabled-by-argument'
  /** marker present but the switch is not: unexpected, logged as such */
  | 'marker-without-switch'
  /** Chromium sandbox requested (no `--no-sandbox`) */
  | 'sandbox-on'

export interface LinuxSandboxStartInfo {
  state: LinuxSandboxStart
  /** `[sandbox] …` line for the debug log */
  line: string
}

/**
 * Reads and removes the launcher marker from `env`. Returns null off Linux (the marker is still removed).
 * `hasNoSandboxSwitch` = `app.commandLine.hasSwitch('no-sandbox')`.
 */
export function takeLinuxSandboxStart(
  platform: string,
  env: Record<string, string | undefined>,
  hasNoSandboxSwitch: boolean,
): LinuxSandboxStartInfo | null {
  const marker = env[APPIMAGE_SANDBOX_FALLBACK_ENV] === '1'
  delete env[APPIMAGE_SANDBOX_FALLBACK_ENV]
  if (platform !== 'linux') return null
  const appImage = env.APPIMAGE ? 'yes' : 'no'
  if (marker && hasNoSandboxSwitch) {
    return {
      state: 'auto-disabled',
      line: `[sandbox] Chromium sandbox auto-disabled by the AppImage launcher (BUG-202 fallback): unprivileged user namespaces unusable and chrome-sandbox not setuid root; started with --no-sandbox (appimage=${appImage})`,
    }
  }
  if (marker) {
    return {
      state: 'marker-without-switch',
      line: `[sandbox] AppImage launcher marker present but no --no-sandbox switch; Chromium sandbox requested (appimage=${appImage})`,
    }
  }
  if (hasNoSandboxSwitch) {
    return {
      state: 'disabled-by-argument',
      line: `[sandbox] started with --no-sandbox from the command line (not added by the AppImage launcher) (appimage=${appImage})`,
    }
  }
  return { state: 'sandbox-on', line: `[sandbox] Chromium sandbox requested (no --no-sandbox) (appimage=${appImage})` }
}
