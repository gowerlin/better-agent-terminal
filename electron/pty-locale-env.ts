import { execFileSync } from 'child_process'
import { logger } from './logger'

/**
 * BUG-102 (T0398): UTF-8 locale env for PTY shells, decided per platform.
 *
 * Before T0398 every spawn path forced `LANG` / `LC_ALL=en_US.UTF-8` after `customEnv`.
 * Ubuntu 24.04 WSL only ships `C.UTF-8`, so each remote shell printed
 * `bash: warning: setlocale: LC_ALL: cannot change locale (en_US.UTF-8)` and fell back to `C`,
 * and a user's own `LANG` in customEnv was overwritten.
 *
 * - customEnv wins on every platform: a key it sets is never returned, and `LC_ALL` is dropped
 *   when it sets any of LANG / LC_ALL / LC_CTYPE (LC_ALL would override the user's choice).
 * - win32 / darwin: `en_US.UTF-8` for both, as before (Git Bash / MSYS; macOS has no C.UTF-8).
 * - linux: `LANG` only, so the user's shell `LC_*` settings still apply. An inherited UTF-8
 *   `LANG` that `locale -a` lists is kept; otherwise the first available of C.UTF-8,
 *   en_US.UTF-8; C.UTF-8 when the probe fails or lists neither.
 */

/** Installed locale names (`locale -a`), or null when the probe failed. */
export type LocaleLister = () => string[] | null

export interface PtyLocaleEnvInput {
  platform: NodeJS.Platform
  /** Env the PTY inherits (`process.env` after the host's drop filter). */
  inheritedEnv: NodeJS.ProcessEnv
  customEnv: Record<string, string | undefined>
  /** Defaults to the cached `locale -a` probe; only consulted on linux. */
  listLocales?: LocaleLister
}

const DEFAULT_LOCALE = 'en_US.UTF-8'
const LINUX_CANDIDATES = ['C.UTF-8', 'en_US.UTF-8']
const LOCALE_PROBE_TIMEOUT_MS = 5_000

/** `en_US.UTF-8` / `en_US.utf8` / `EN_us.Utf-8` compare equal. */
function normalizeLocale(name: string): string {
  return name.trim().toLowerCase().replace(/\.utf-8/, '.utf8')
}

function isUtf8Locale(name: string): boolean {
  return /\.utf-?8(@|$)/i.test(name)
}

function runLocaleA(): string {
  return execFileSync('locale', ['-a'], {
    encoding: 'utf8',
    timeout: LOCALE_PROBE_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  })
}

/** Runs `locale -a` once, caching the result (including a failure as null). */
export function createCachedLocaleLister(run: () => string = runLocaleA): LocaleLister {
  let cached: string[] | null | undefined
  return () => {
    if (cached !== undefined) return cached
    try {
      cached = run().split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    } catch (e) {
      logger.warn('[pty-locale-env] locale -a probe failed, LANG falls back to C.UTF-8:', e)
      cached = null
    }
    return cached
  }
}

const listAvailableLocales = createCachedLocaleLister()

function pickLinuxLang(inheritedLang: string | undefined, listLocales: LocaleLister): string {
  const available = listLocales()
  if (!available) return LINUX_CANDIDATES[0]
  const installed = new Set(available.map(normalizeLocale))
  if (inheritedLang && isUtf8Locale(inheritedLang) && installed.has(normalizeLocale(inheritedLang))) {
    return inheritedLang
  }
  return LINUX_CANDIDATES.find(c => installed.has(normalizeLocale(c))) ?? LINUX_CANDIDATES[0]
}

/** Locale entries to spread after `customEnv` in the PTY env. */
export function resolvePtyLocaleEnv(input: PtyLocaleEnvInput): Record<string, string> {
  const { platform, inheritedEnv, customEnv, listLocales = listAvailableLocales } = input
  const custom = (key: string) => customEnv[key] !== undefined
  const env: Record<string, string> = {}

  if (platform === 'linux') {
    if (!custom('LANG')) env.LANG = pickLinuxLang(inheritedEnv.LANG, listLocales)
    return env
  }

  if (!custom('LANG')) env.LANG = DEFAULT_LOCALE
  if (!custom('LANG') && !custom('LC_ALL') && !custom('LC_CTYPE')) env.LC_ALL = DEFAULT_LOCALE
  return env
}
