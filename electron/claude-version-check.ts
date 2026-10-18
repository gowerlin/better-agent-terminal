/**
 * PLAN-050 / T0641 (D167, T0640 contract C-3): whether the claude a claude-cli tab launches knows
 * `--name` (claude `>= 2.1.76`). An older claude stops with `error: unknown option '--name'`
 * (exit 1), so BAT must never inject it there.
 *
 *   - embedded runtime (also system → embedded fallback): BAT ships a known version, not probed
 *   - system runtime: `<path> --version` through `execFile` (array args, no shell), timeout 5 s,
 *     cached by path + mtime (an in-place upgrade is probed again); only a parsed version is
 *     cached, a failure is probed again next time. `< 2.1.76` → `claude-too-old`; not readable →
 *     `version-unknown`. Both = not injected.
 *   - the runtime cannot be resolved (system claude unusable, fallback off) → `version-unknown`
 *
 * The runtime comes from the same router the launch uses (`resolveClaudeRuntime`), read again at
 * the launch decision. Same pattern as `createCodexOscVersionCheck` (electron/codex-osc-version.ts).
 * One log line per system check: `[claude-version] path=<…> version=<x.y.z|unknown> (cached|probed)
 * → name=yes|no (<reason>)`.
 *
 * 🔴 No `electron` import (headless uses it).
 */
import { execFile } from 'child_process'
import * as fs from 'fs'
import { VERSION_REGEX, compareSemver } from './claude-resolver'
import type { ExecFileLike } from './codex-osc-version'

/** claude CHANGELOG 2.1.76: "Added `-n` / `--name <name>` CLI flag". */
export const CLAUDE_NAME_MIN_VERSION = '2.1.76'
export const CLAUDE_VERSION_TIMEOUT_MS = 5_000

export type ClaudeNameUnsupportedReason = 'claude-too-old' | 'version-unknown'

export type ClaudeNameSupport =
  | { inject: true; runtime: 'embedded' }
  | { inject: true; runtime: 'system'; version: string }
  | { inject: false; reason: ClaudeNameUnsupportedReason; version?: string }

/** What `resolveClaudeRuntime` decided (electron/claude-runtime-router.ts `ResolvedRuntime`). */
export interface ClaudeNameRuntime {
  source: 'embedded' | 'system' | 'system-fallback-to-embedded'
  path: string
}

export interface ClaudeNameSupportDeps {
  /** The claude runtime a launch now would use; throws when none is usable. */
  resolveRuntime(): Promise<ClaudeNameRuntime>
  /** The file's mtime (ms), or null. */
  mtimeMs?(p: string): number | null
  execFile?: ExecFileLike
  logger?: { log(message: string): void }
}

/** `version` (`x.y.z`) knows `--name`. */
export function claudeVersionSupportsName(version: string): boolean {
  return compareSemver(version, CLAUDE_NAME_MIN_VERSION) >= 0
}

/** `() => Promise<ClaudeNameSupport>` for the next claude-cli launch. Never throws, never rejects. */
export function createClaudeNameSupportCheck(deps: ClaudeNameSupportDeps): () => Promise<ClaudeNameSupport> {
  const mtimeMs = deps.mtimeMs ?? ((p: string) => {
    try { return fs.statSync(p).mtimeMs } catch { return null }
  })
  const run: ExecFileLike = deps.execFile ?? (execFile as unknown as ExecFileLike)
  const cache = new Map<string, string>()
  const log = (message: string) => deps.logger?.log(message)

  const probe = (bin: string): Promise<string | null> => new Promise(resolve => {
    try {
      run(bin, ['--version'], { timeout: CLAUDE_VERSION_TIMEOUT_MS, windowsHide: true, encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error) return resolve(null)
        resolve(VERSION_REGEX.exec((stdout || stderr || '').trim())?.[1] ?? null)
      })
    } catch {
      resolve(null) // a synchronous spawn failure (EFTYPE, EINVAL)
    }
  })

  return async (): Promise<ClaudeNameSupport> => {
    let runtime: ClaudeNameRuntime
    try {
      runtime = await deps.resolveRuntime()
    } catch (error) {
      log(`[claude-version] path=- version=unknown (runtime: ${error instanceof Error ? error.message : String(error)}) → name=no (version-unknown)`)
      return { inject: false, reason: 'version-unknown' }
    }
    if (runtime.source !== 'system') return { inject: true, runtime: 'embedded' }
    try {
      if (!runtime.path) {
        log('[claude-version] path=- version=unknown (no path) → name=no (version-unknown)')
        return { inject: false, reason: 'version-unknown' }
      }
      const mtime = mtimeMs(runtime.path)
      const key = `${runtime.path}\0${mtime ?? '-'}`
      let version = mtime !== null ? cache.get(key) ?? null : null
      const how = version !== null ? 'cached' : 'probed'
      if (version === null) {
        version = await probe(runtime.path)
        if (version !== null && mtime !== null) cache.set(key, version)
      }
      const support: ClaudeNameSupport = version === null
        ? { inject: false, reason: 'version-unknown' }
        : claudeVersionSupportsName(version)
          ? { inject: true, runtime: 'system', version }
          : { inject: false, reason: 'claude-too-old', version }
      log(`[claude-version] path=${runtime.path} version=${version ?? 'unknown'} (${how}) → name=${support.inject ? 'yes' : `no (${support.reason})`}`)
      return support
    } catch (error) {
      log(`[claude-version] path=${runtime.path || '-'} version=unknown (${error instanceof Error ? error.message : String(error)}) → name=no (version-unknown)`)
      return { inject: false, reason: 'version-unknown' }
    }
  }
}
