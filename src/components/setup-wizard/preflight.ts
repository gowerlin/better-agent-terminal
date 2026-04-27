/**
 * T0332 (PLAN-032 Sprint 2): WizardPreflight hook framework.
 *
 * Lets a wizard step declare a `preflight(ctx)` callback that runs *before*
 * `step.run()`. The runner uses the result to decide whether to:
 *  - skip step.run() and surface a hard failure (mapped via ErrorMapper)
 *  - run step.run() but record a warning on ctx.warnings
 *  - run step.run() unchanged
 *
 * Cache helpers below are per-wizard-session — runner constructs a fresh
 * Map via createPreflightCache() and injects it into ctx.preflightCache.
 * Steps decide their own cacheKey + ttlMs; runner does not pre-resolve
 * cache hits so step authors keep full control.
 *
 * See _ct-workorders/_spec-wizard-error-ux.md § 4.
 */

export interface WizardPreflightResult {
  ok: boolean
  /** Failure message; wrapped into Error.message before ErrorMapper resolution. */
  reason?: string
  /** errorCode for ErrorMapper stage-1 lookup (e.g. 'docker-daemon-down'). */
  errorCode?: string
  /** When set, runner stores the result in cache (per-wizard-session). */
  cacheKey?: string
  /** Optional cache TTL in ms. Unset = never expires within the session. */
  ttlMs?: number
  /** true = append `reason` to ctx.warnings + continue; false/undefined = block step.run(). */
  warningOnly?: boolean
}

export interface WizardPreflightCacheEntry {
  result: WizardPreflightResult
  storedAt: number
}

export type WizardPreflightCache = Map<string, WizardPreflightCacheEntry>

/** Fresh per-wizard-session cache. Each WizardRunner constructs one. */
export function createPreflightCache(): WizardPreflightCache {
  return new Map()
}

/**
 * Look up a cache entry. Honors `result.ttlMs` against `now` (defaults to
 * Date.now()). Returns undefined on miss / expiry.
 */
export function getPreflightCached(
  cache: WizardPreflightCache,
  key: string,
  now: number = Date.now(),
): WizardPreflightResult | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  const ttl = entry.result.ttlMs
  if (typeof ttl === 'number' && ttl >= 0 && now - entry.storedAt >= ttl) {
    cache.delete(key)
    return undefined
  }
  return entry.result
}

/** Store a preflight result in cache. */
export function setPreflightCached(
  cache: WizardPreflightCache,
  key: string,
  result: WizardPreflightResult,
  now: number = Date.now(),
): void {
  cache.set(key, { result, storedAt: now })
}