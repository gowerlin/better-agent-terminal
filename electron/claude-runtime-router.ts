/**
 * Claude runtime routing — picks embedded vs system `claude` binary per spawn.
 *
 * PLAN-027 Phase 1 #2 (T0231) — bridges the resolver infrastructure (T0230)
 * to the three spawn sites in claude-agent-manager.ts. Called on every spawn
 * (R2: "Changes apply to new sessions only" == read-snapshot per spawn, no
 * reactive updates needed).
 *
 * Logic (T0231 § "邏輯"):
 *   embedded     → use embedded path directly (no health probe; embedded is
 *                  shipped with BAT and assumed always present)
 *   system       → detectSystemClaude(customPath?)
 *                  - not found / spawn-failed / version-too-old:
 *                      fallbackToEmbedded=true  → embedded + degraded event
 *                      fallbackToEmbedded=false → throw (caller surfaces)
 *                  - version-warning            → system + warning event
 *                  - healthy                    → system
 */
import { app } from 'electron'
import * as fsSync from 'fs'
import * as pathModule from 'path'
import { createRequire } from 'module'
import type { ClaudeRuntimeSettings } from '../src/types'
import { DEFAULT_CLAUDE_RUNTIME_SETTINGS } from '../src/types'
import { detectSystemClaude, isSafeClaudeCustomPath, type ClaudeRuntimeInfo } from './claude-resolver'
import { logger } from './logger'

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export type ResolvedRuntimeSource =
  | 'embedded'
  | 'system'
  | 'system-fallback-to-embedded'

export type DegradedReason =
  | 'system-not-found'
  | 'system-unhealthy'
  | 'system-too-old'
  | 'unsafe-custom-path'
  | 'detect-threw'

export interface ResolvedRuntime {
  path: string
  source: ResolvedRuntimeSource
  healthStatus: 'healthy' | 'version-warning'
  degraded?: {
    reason: DegradedReason
    detail?: string
  }
  /** Populated when the resolved binary is a system claude (both healthy and fallback paths omit this when the system probe itself never ran). */
  systemVersion?: string
}

// Resolver error surfaced when fallback is disabled. Caller catches and emits
// a toast + refuses to spawn. Kept as a plain Error subclass so downstream
// `instanceof` checks work across module boundaries.
export class SystemClaudeUnavailableError extends Error {
  readonly reason: DegradedReason
  readonly detail?: string
  constructor(reason: DegradedReason, detail?: string) {
    super(`System claude unavailable: ${reason}${detail ? ` — ${detail}` : ''}`)
    this.name = 'SystemClaudeUnavailableError'
    this.reason = reason
    this.detail = detail
  }
}

export class SystemClaudeUnsafePathError extends SystemClaudeUnavailableError {
  constructor(detail?: string) {
    super('unsafe-custom-path', detail)
    this.name = 'SystemClaudeUnsafePathError'
  }
}

// ----------------------------------------------------------------------------
// Embedded path resolver (duplicated from claude-agent-manager to avoid a
// circular import; kept in sync with BUG-047 / BUG-052 logic).
// ----------------------------------------------------------------------------

function resolveEmbeddedClaudePath(): string {
  const binaryName = 'claude.exe'
  if (app.isPackaged) {
    return pathModule.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@anthropic-ai',
      'claude-code',
      'bin',
      binaryName,
    )
  }
  try {
    const req = createRequire(import.meta.url ?? __filename)
    const pkgPath = req.resolve('@anthropic-ai/claude-code/package.json')
    return pathModule.join(pathModule.dirname(pkgPath), 'bin', binaryName)
  } catch {
    try {
      const pkgPath = require.resolve('@anthropic-ai/claude-code/package.json')
      return pathModule.join(pathModule.dirname(pkgPath), 'bin', binaryName)
    } catch {
      return ''
    }
  }
}

// ----------------------------------------------------------------------------
// Settings snapshot (reads from persisted settings.json on disk).
// ----------------------------------------------------------------------------

/**
 * Read `claudeRuntime` from the persisted settings.json on the main process
 * side. Every spawn calls this — there is no in-memory cache because R2
 * requires next-spawn freshness without reactive plumbing.
 *
 * Returns DEFAULT_CLAUDE_RUNTIME_SETTINGS on any read/parse failure so that
 * a broken settings file never blocks session startup (degrades to embedded).
 */
export function getRuntimeSettingsSnapshot(): ClaudeRuntimeSettings {
  try {
    const settingsPath = pathModule.join(app.getPath('userData'), 'settings.json')
    if (!fsSync.existsSync(settingsPath)) {
      return { ...DEFAULT_CLAUDE_RUNTIME_SETTINGS }
    }
    const raw = fsSync.readFileSync(settingsPath, 'utf-8')
    const parsed = JSON.parse(raw) as { claudeRuntime?: Partial<ClaudeRuntimeSettings> }
    const snap = parsed?.claudeRuntime
    if (!snap || typeof snap !== 'object') {
      return { ...DEFAULT_CLAUDE_RUNTIME_SETTINGS }
    }
    return {
      mode: snap.mode === 'system' ? 'system' : 'embedded',
      customPath: typeof snap.customPath === 'string' ? snap.customPath : undefined,
      fallbackToEmbedded: snap.fallbackToEmbedded !== false, // default true
    }
  } catch (err) {
    logger.warn('[runtime-router] getRuntimeSettingsSnapshot read/parse failed, using defaults:', err)
    return { ...DEFAULT_CLAUDE_RUNTIME_SETTINGS }
  }
}

// ----------------------------------------------------------------------------
// Core resolver
// ----------------------------------------------------------------------------

function classifyDegradedReason(info: ClaudeRuntimeInfo | null): DegradedReason | null {
  if (!info) return 'system-not-found'
  if (info.healthStatus === 'spawn-failed') return 'system-unhealthy'
  if (info.healthStatus === 'version-too-old') return 'system-too-old'
  return null
}

/**
 * Optional dependency injection for unit tests. Production callers pass nothing;
 * the defaults wire to the real detector and embedded resolver. Tests supply
 * stubs so they can run without electron `app` or a real claude binary present.
 */
export interface ResolveClaudeRuntimeDeps {
  detectSystemClaude?: (customPath?: string) => Promise<ClaudeRuntimeInfo | null>
  resolveEmbeddedClaudePath?: () => string
}

export async function resolveClaudeRuntime(
  settings: ClaudeRuntimeSettings,
  deps: ResolveClaudeRuntimeDeps = {},
): Promise<ResolvedRuntime> {
  const detect = deps.detectSystemClaude ?? detectSystemClaude
  const getEmbeddedPath = deps.resolveEmbeddedClaudePath ?? resolveEmbeddedClaudePath

  // Embedded — trusted, no probe.
  if (settings.mode === 'embedded') {
    return {
      path: getEmbeddedPath(),
      source: 'embedded',
      healthStatus: 'healthy',
    }
  }

  // System — detect + probe, with fallback branching.
  const customPath = settings.customPath?.trim()
  if (customPath && !isSafeClaudeCustomPath(customPath)) {
    const detail = 'customPath rejected by whitelist'
    if (settings.fallbackToEmbedded) {
      return {
        path: getEmbeddedPath(),
        source: 'system-fallback-to-embedded',
        healthStatus: 'healthy',
        degraded: { reason: 'unsafe-custom-path', detail },
      }
    }
    throw new SystemClaudeUnsafePathError(detail)
  }

  let info: ClaudeRuntimeInfo | null
  try {
    info = await detect(customPath || undefined)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    if (settings.fallbackToEmbedded) {
      return {
        path: getEmbeddedPath(),
        source: 'system-fallback-to-embedded',
        healthStatus: 'healthy',
        degraded: { reason: 'detect-threw', detail },
      }
    }
    throw new SystemClaudeUnavailableError('detect-threw', detail)
  }

  const degradedReason = classifyDegradedReason(info)
  if (degradedReason) {
    const detail = info
      ? `${info.path}${info.version ? ` (${info.version})` : ''}`
      : 'no candidate found'
    if (settings.fallbackToEmbedded) {
      return {
        path: getEmbeddedPath(),
        source: 'system-fallback-to-embedded',
        healthStatus: 'healthy',
        degraded: { reason: degradedReason, detail },
      }
    }
    throw new SystemClaudeUnavailableError(degradedReason, detail)
  }

  // info is non-null here — narrow for TS.
  if (!info) {
    // Defensive: shouldn't happen because classifyDegradedReason returned null.
    throw new SystemClaudeUnavailableError('system-not-found')
  }

  if (info.healthStatus === 'version-warning') {
    return {
      path: info.path,
      source: 'system',
      healthStatus: 'version-warning',
      systemVersion: info.version,
    }
  }

  return {
    path: info.path,
    source: 'system',
    healthStatus: 'healthy',
    systemVersion: info.version,
  }
}

// ----------------------------------------------------------------------------
// Per-session event deduplication (R3 — degrade and warning are independent
// types, so the same session may emit one of each but not two of the same).
// ----------------------------------------------------------------------------

type EventType = 'degraded' | 'warning'
const emittedEvents = new Map<string, Set<EventType>>()

export function shouldEmitRuntimeEvent(sessionId: string, type: EventType): boolean {
  let set = emittedEvents.get(sessionId)
  if (!set) {
    set = new Set()
    emittedEvents.set(sessionId, set)
  }
  if (set.has(type)) return false
  set.add(type)
  return true
}

/** Drop dedup state for a session when it's fully torn down. */
export function clearRuntimeEventHistory(sessionId: string): void {
  emittedEvents.delete(sessionId)
}

// Test-only: expose the dedup map for unit tests to reset between cases.
export const __test__ = {
  resolveEmbeddedClaudePath,
  classifyDegradedReason,
  emittedEvents,
}
