/**
 * T0393 (PLAN-036 P0-E): default folder for "add workspace" in a WSL profile
 * window — the distro user's home over the WSL UNC share
 * (`\\wsl.localhost\<distro>\home\<user>`), so new workspaces land inside the
 * distro instead of on a drvfs-mounted Windows drive (`/mnt/c/…`).
 *
 * Any failure (invalid distro, wsl.exe slow / failing, UNC share missing)
 * resolves to `null`; the caller keeps its original default.
 */
import { promises as fs } from 'fs'
import { resolveHome } from './wsl-detect'
import { wslToWin } from '../src/utils/wsl-path'

const DISTRO_PATTERN = /^[a-zA-Z0-9._-]+$/
const HOME_PATH_PATTERN = /^\/[A-Za-z0-9._/-]*$/
const WSL_LOCALHOST_PREFIX = /^\\\\wsl\.localhost\\/i

/** Cap on `wsl -d <distro> -- printenv HOME` while a dialog is waiting to open. */
export const WSL_HOME_PROBE_TIMEOUT_MS = 5_000
/** Cap on stat of the UNC share (a stopped distro can stall the first access). */
export const WSL_UNC_STAT_TIMEOUT_MS = 3_000

export interface WslFolderProfile {
  type?: string
  targetOS?: string
  wslDistro?: string
}

/** Distro of a WSL remote profile, or null (non-WSL profile, missing / non-whitelisted distro). */
export function wslDistroForFolderDialog(profile: WslFolderProfile | null | undefined): string | null {
  if (!profile || profile.type !== 'remote' || profile.targetOS !== 'wsl-linux') return null
  const distro = profile.wslDistro?.trim()
  return distro && DISTRO_PATTERN.test(distro) ? distro : null
}

/**
 * UNC candidates for a distro home, preferred first: `\\wsl.localhost\…`
 * (Windows 11 / recent Windows 10), then the legacy `\\wsl$\…`.
 */
export function wslHomeUncCandidates(distro: string, home: string): string[] {
  if (!DISTRO_PATTERN.test(distro) || !HOME_PATH_PATTERN.test(home) || home.includes('..')) return []
  const primary = wslToWin(home, distro)
  return [primary, primary.replace(WSL_LOCALHOST_PREFIX, '\\\\wsl$\\')]
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export interface WslFolderDefaultDeps {
  resolveHome: (distro: string) => Promise<string>
  isDirectory: (p: string) => Promise<boolean>
  log?: (message: string) => void
  homeTimeoutMs?: number
  statTimeoutMs?: number
}

const defaultDeps: WslFolderDefaultDeps = {
  resolveHome,
  isDirectory: async (p) => (await fs.stat(p)).isDirectory(),
}

/**
 * Returns a resolver `(distro) => Promise<string | null>`. Successful results
 * are cached per distro (the home of a distro's default user does not change
 * while BAT runs); failures are retried on the next dialog.
 */
export function createWslFolderDefaultResolver(overrides: Partial<WslFolderDefaultDeps> = {}) {
  const deps: WslFolderDefaultDeps = { ...defaultDeps, ...overrides }
  const cache = new Map<string, string>()
  const homeTimeoutMs = deps.homeTimeoutMs ?? WSL_HOME_PROBE_TIMEOUT_MS
  const statTimeoutMs = deps.statTimeoutMs ?? WSL_UNC_STAT_TIMEOUT_MS

  return async (distro: string): Promise<string | null> => {
    if (!DISTRO_PATTERN.test(distro)) return null
    const cached = cache.get(distro)
    if (cached) return cached

    let home: string
    try {
      home = await withTimeout(deps.resolveHome(distro), homeTimeoutMs, `wsl home probe (${distro})`)
    } catch (err) {
      deps.log?.(`[wsl-folder] home probe failed for ${distro}: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }

    for (const candidate of wslHomeUncCandidates(distro, home)) {
      try {
        if (await withTimeout(deps.isDirectory(candidate), statTimeoutMs, `stat ${candidate}`)) {
          cache.set(distro, candidate)
          return candidate
        }
      } catch (err) {
        deps.log?.(`[wsl-folder] ${candidate} unavailable: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return null
  }
}
