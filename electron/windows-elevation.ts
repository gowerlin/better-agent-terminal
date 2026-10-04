/**
 * Windows elevation detection (T0377 / BUG-085).
 *
 * Codex CLI 0.160+ refuses to auto-start its Windows daemon from an elevated
 * token ("start the Windows daemon from a non-elevated terminal"), so the
 * codex-cli terminal preset exits immediately when BAT itself runs elevated
 * (UAC disabled, or "Run as administrator"). Child shells inherit BAT's token,
 * so BAT's own integrity level is what the codex child will see.
 *
 * Detection: `whoami /groups` lists the token's mandatory label; an elevated
 * token carries High Mandatory Level (SID S-1-16-12288). The SID is
 * locale-independent, unlike the group name.
 *
 * Safety (CLAUDE.md Child Process Spawning):
 *   - execFile with an absolute System32 path — Git Bash puts /usr/bin/whoami
 *     earlier on PATH, so a bare `whoami` is not guaranteed to be Windows'.
 *   - 5s timeout; any failure resolves to `false` (no injection = status quo).
 *   - Non-Windows platforms always resolve to `false` without spawning.
 */

import * as childProcess from 'child_process'
import * as path from 'path'

/** Mandatory label SID of an elevated (High integrity) token. */
export const HIGH_MANDATORY_LEVEL_SID = 'S-1-16-12288'

const WHOAMI_TIMEOUT_MS = 5000

type ExecFileFn = (
  file: string,
  args: string[],
  options: childProcess.ExecFileOptions,
  callback: (error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void,
) => unknown

export interface ElevationDetectDeps {
  platform?: NodeJS.Platform
  systemRoot?: string
  execFile?: ExecFileFn
}

/** True when `whoami /groups` output contains the High Mandatory Level SID. */
export function parseWhoamiGroupsElevated(output: string | null | undefined): boolean {
  if (!output) return false
  return /(^|[^0-9-])S-1-16-12288(?![0-9-])/m.test(output)
}

export function getWhoamiPath(systemRoot?: string): string {
  const root = systemRoot || process.env.SystemRoot || process.env.windir || 'C:\\Windows'
  return path.win32.join(root, 'System32', 'whoami.exe')
}

export function detectWindowsElevation(deps: ElevationDetectDeps = {}): Promise<boolean> {
  const platform = deps.platform ?? process.platform
  if (platform !== 'win32') return Promise.resolve(false)

  const execFile = deps.execFile ?? (childProcess.execFile as unknown as ExecFileFn)
  const whoami = getWhoamiPath(deps.systemRoot)

  return new Promise<boolean>((resolve) => {
    try {
      execFile(
        whoami,
        ['/groups'],
        { encoding: 'utf8', timeout: WHOAMI_TIMEOUT_MS, windowsHide: true },
        (error, stdout) => {
          if (error) {
            resolve(false)
            return
          }
          resolve(parseWhoamiGroupsElevated(String(stdout ?? '')))
        },
      )
    } catch {
      resolve(false)
    }
  })
}

let cachedElevation: Promise<boolean> | null = null

/** Detect once per process and cache the result (BAT's token never changes at runtime). */
export function getWindowsElevation(): Promise<boolean> {
  if (!cachedElevation) cachedElevation = detectWindowsElevation()
  return cachedElevation
}

export function resetWindowsElevationCacheForTests(): void {
  cachedElevation = null
}
