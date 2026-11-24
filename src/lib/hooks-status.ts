/**
 * PLAN-068 W9 / T0910 (T0902 §3.1′ / §7.2): the shape of `hooksStatus` — whether a tab's claude reports
 * BAT's hooks — and what the renderer shows for it. Shared by main / headless (electron/claude-hooks-status.ts
 * decides the value) and the renderer (badge `🪝✕`, the Inbox header line). No electron / DOM import.
 *
 * 🔴 The `hooks:` line (`hooksStatusLine`) and the reason codes are a contract with CT 6.1.0 (PLAN-068
 * 〈契約細節補充〉): do not rename a code or change the grammar.
 */

/** Launch-time reasons (T0902 §7.1 G2–G5, G13) + `no-report` (G6) + `not-launched-by-bat` (G8 / G10). */
export const HOOKS_NONE_REASONS = [
  'settings-off',
  'user-settings-arg',
  'claude-hooks-disabled',
  'managed-hooks-only',
  'no-report',
  'not-launched-by-bat',
  'no-endpoint',
  'script-missing',
  'unrepresentable-path',
] as const

export type HooksNoneReason = typeof HOOKS_NONE_REASONS[number]
export type HooksLaunchReason = Exclude<HooksNoneReason, 'no-report' | 'not-launched-by-bat'>
export type HooksOrigin = 'injected' | 'plugin'

export type HooksStatus =
  | { state: 'ok'; origin: HooksOrigin; set: number; reason?: 'plugin-outdated' }
  | { state: 'none'; reason: HooksNoneReason }
  | { state: 'n/a'; reason: 'codex' }

/**
 * The `--set-role` stdout line: `  hooks: ok (<injected|plugin>, set <n>[, plugin-outdated])` /
 * `  hooks: none (<code>)` / `  hooks: n/a (codex)`. scripts/bat-terminal.mjs keeps a copy (`hooksLine`).
 */
export function hooksStatusLine(status: HooksStatus): string {
  if (status.state === 'ok') return `  hooks: ok (${status.origin}, set ${status.set}${status.reason ? `, ${status.reason}` : ''})`
  return `  hooks: ${status.state} (${status.reason})`
}

/** A `hooksStatus` from main (an event / a query answer) → a valid status, or null. */
export function parseHooksStatus(raw: unknown): HooksStatus | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.state === 'ok') {
    if ((r.origin !== 'injected' && r.origin !== 'plugin') || typeof r.set !== 'number' || !Number.isSafeInteger(r.set) || r.set < 1) return null
    return r.reason === 'plugin-outdated' ? { state: 'ok', origin: r.origin, set: r.set, reason: 'plugin-outdated' } : { state: 'ok', origin: r.origin, set: r.set }
  }
  if (r.state === 'none' && (HOOKS_NONE_REASONS as readonly unknown[]).includes(r.reason)) return { state: 'none', reason: r.reason as HooksNoneReason }
  if (r.state === 'n/a' && r.reason === 'codex') return { state: 'n/a', reason: 'codex' }
  return null
}

/**
 * The hint (T0902 §7.2) of a status: i18n key under `hooksStatus.*`, or null = nothing to show.
 * `none` → the reason's text (after the common prefix `hooksStatus.prefix`); `ok` + `plugin-outdated`
 * → the update hint (no prefix: the hooks work); `ok` / `n/a` → null.
 */
export function hooksStatusHint(status: HooksStatus | null): { key: string; prefix: boolean } | null {
  if (!status) return null
  if (status.state === 'none') {
    const helperBroken = status.reason === 'no-endpoint' || status.reason === 'script-missing' || status.reason === 'unrepresentable-path'
    return { key: helperBroken ? 'hooksStatus.reason.helper' : `hooksStatus.reason.${status.reason}`, prefix: true }
  }
  if (status.state === 'ok' && status.reason === 'plugin-outdated') return { key: 'hooksStatus.reason.plugin-outdated', prefix: false }
  return null
}

/** Whether the tab shows the `🪝✕` badge: a missing-hooks status (`none`) only. */
export function showsHooksBadge(status: HooksStatus | null): boolean {
  return status?.state === 'none'
}

/** The README section the hint links to ("怎麼修"). */
export const HOOKS_HELP_URL = 'https://github.com/gowerlin/better-agent-terminal#bat-hooks-與-bat-hooks-plugin選用'
