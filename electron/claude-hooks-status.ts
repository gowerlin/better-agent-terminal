/**
 * PLAN-068 W9 / T0910 (T0902 §7.1 / §7.2 / §3.1′, D328 / D329): whether a tab's claude reports BAT's
 * hooks, and why not.
 *
 * Two inputs:
 *   - the **launch decision** of each claude / codex tab BAT launched (`createBatMcpLaunchArgs`,
 *     electron/bat-mcp-launch.ts), per terminal id like `claudeSessionNameRecords` — made before the
 *     PTY exists, kept across ⏻ restart / the Terminal Server recovery, replaced by the next launch of
 *     the id. No record = BAT did not launch a claude there (a shell where the user typed `claude`).
 *   - the **hook reports** the PTY sent (`TerminalBlockedTracker.getHookOriginInfo`): from BAT's injected
 *     `--settings` hooks (`origin: injected`) and / or the `bat-hooks` Claude Code plugin
 *     (`origin: plugin`, plugins/bat-hooks/), each with the hook set version (`set`) of its registration.
 *
 * `hooksStatus` (contract §3.1′, CT parses the `hooks:` line made from it — 🔴 do not change):
 *   - `{ state: 'ok', origin, set }` — a report arrived; `injected` wins when both ran (T0905 §7.4);
 *     `reason: 'plugin-outdated'` only when the plugin alone reports and its event list (`set`) is older
 *     than this BAT's `BAT_HOOK_SET`.
 *   - `{ state: 'none', reason }` — `HooksNoneReason`.
 *   - `{ state: 'n/a', reason: 'codex' }` — a codex tab (no hooks; codex reports by OSC 7501).
 *   - null — the PTY does not run here, or it is neither a declared Tower nor a tab BAT knows runs an agent.
 *
 * 🔴 No `electron` import (headless keeps the same store). One store per process: `claudeHooksRecords`.
 * Metadata only: never a token, a path, a message or a setting's content.
 */

/**
 * PLAN-068 W3 / T0905 (T0902 §7.6): the version of BAT's hook set (`BAT_CLAUDE_HOOKS`). Re-exported by
 * electron/bat-mcp-launch.ts beside that table (the hook script's own copy must be equal,
 * `scripts/__tests__/bat-hook-last-message.test.mjs`). Declared here so this module needs no import of
 * the launch module (which imports this one). Raise it with every change to the events or what they send.
 */
export const BAT_HOOK_SET = 2

/** T0910 (§7.2): how long `--set-role --bat-contract` waits for a claude Tower's first hook report. */
export const HOOKS_STATUS_WAIT_MS = 2000

/**
 * Why a claude launch has no working BAT hooks, decided at launch (T0902 §7.1 G2–G5, G13):
 *   - `settings-off`: Settings › BAT MCP is off (R13: the hooks go with it)
 *   - `user-settings-arg`: the custom args already pass `--settings`
 *   - `claude-hooks-disabled` / `managed-hooks-only`: injected, but claude's own settings turn hooks off
 *     (`disableAllHooks` / managed `allowManagedHooksOnly`, `claudeHooksDisabledBy`)
 *   - `no-endpoint`: RemoteServer not listening (the tab has no helper endpoint)
 *   - `script-missing`: `bat-hook.mjs` not found, or the hook settings file could not be written
 *   - `unrepresentable-path`: the hook command cannot be written for both bash and PowerShell
 */
/*
 * The shape (`HooksStatus`), the codes and the `hooks:` line live in src/lib/hooks-status.ts (shared with
 * the renderer). `HooksNoneReason` = a `HooksLaunchReason` above, or (decided when asked) `no-report`
 * (BAT injected them, none reported — G6, e.g. a project's `disableAllHooks`) / `not-launched-by-bat`
 * (no launch record — G8 / G10).
 */
import type { HooksLaunchReason, HooksStatus } from '../src/lib/hooks-status'
export { HOOKS_NONE_REASONS, hooksStatusLine, type HooksLaunchReason, type HooksNoneReason, type HooksOrigin, type HooksStatus } from '../src/lib/hooks-status'

export type HooksAgentKind = 'claude' | 'codex'

/** One launch decision (T0910). `reason` absent on a claude launch = the hooks went in and are not turned off. */
export interface HooksLaunchRecord {
  kind: HooksAgentKind
  /** claude only. */
  reason?: HooksLaunchReason
  /** When the launch was decided (ms). */
  at: number
}

/** What the tracker knows of a running PTY's hook reports (`TerminalBlockedTracker.getHookOriginInfo`). */
export interface HookReportInfo {
  /** An `injected` report was applied. */
  injected: boolean
  /** A `plugin` report was applied (before any `injected` one; later ones are dropped). */
  plugin: boolean
  /** The latest `set` an injected report carried. */
  injectedSet?: number
  /** The latest `set` (the plugin's `--hook-list`) a plugin report carried. */
  pluginSet?: number
}

export const CLAUDE_HOOKS_RECORD_LIMIT = 512

/** Per-terminal launch decisions and the agent hint of `--set-role --agent`. Bounded (oldest go first). */
export class ClaudeHooksRecords {
  private readonly launches = new Map<string, HooksLaunchRecord>()
  private readonly hints = new Map<string, HooksAgentKind>()

  constructor(private readonly limit = CLAUDE_HOOKS_RECORD_LIMIT) {}

  private bounded<V>(map: Map<string, V>, id: string, value: V): void {
    map.delete(id)
    map.set(id, value)
    while (map.size > this.limit) {
      const oldest = map.keys().next().value
      if (oldest === undefined) break
      map.delete(oldest)
    }
  }

  setLaunch(terminalId: string, record: HooksLaunchRecord): void {
    this.bounded(this.launches, terminalId, record)
  }

  getLaunch(terminalId: string): HooksLaunchRecord | undefined {
    return this.launches.get(terminalId)
  }

  deleteLaunch(terminalId: string): void {
    this.launches.delete(terminalId)
  }

  /** `--set-role --agent` (T0910): the agent a Tower says it is; null clears (every `--set-role` overwrites). */
  setHint(terminalId: string, kind: HooksAgentKind | null): void {
    if (kind) this.bounded(this.hints, terminalId, kind)
    else this.hints.delete(terminalId)
  }

  getHint(terminalId: string): HooksAgentKind | undefined {
    return this.hints.get(terminalId)
  }

  clear(): void {
    this.launches.clear()
    this.hints.clear()
  }
}

/** This process's store (Electron main / headless bat-server). */
export const claudeHooksRecords = new ClaudeHooksRecords()

/** An agent preset / `--agent` registry id → claude / codex, or null. */
export function hooksAgentKindOf(agentId: string | null | undefined): HooksAgentKind | null {
  if (agentId === 'claude-cli' || agentId === 'claude-cli-worktree' || agentId === 'claude-code') return 'claude'
  if (agentId === 'codex-cli') return 'codex'
  return null
}

export interface HooksStatusInput {
  launch?: HooksLaunchRecord
  /** The PTY's `agentPreset`. */
  agentPreset?: string
  /** The `--set-role --agent` hint. */
  hint?: HooksAgentKind
  /** A declared Tower (`--set-role tower`). */
  tower: boolean
  /** null = no report applied yet. */
  reports: HookReportInfo | null
  /** `BAT_HOOK_SET` (tests pass another). */
  batHookSet?: number
}

/** The `hooksStatus` of a running PTY (file header). Pure. */
export function computeHooksStatus(input: HooksStatusInput): HooksStatus | null {
  const batSet = input.batHookSet ?? BAT_HOOK_SET
  const reports = input.reports
  if (reports && (reports.injected || reports.plugin)) {
    if (reports.injected) return { state: 'ok', origin: 'injected', set: reports.injectedSet ?? batSet }
    // a plugin report without a valid `--hook-list` is the oldest list there is
    const set = reports.pluginSet ?? 1
    return set < batSet ? { state: 'ok', origin: 'plugin', set, reason: 'plugin-outdated' } : { state: 'ok', origin: 'plugin', set }
  }
  const kind = input.launch?.kind ?? hooksAgentKindOf(input.agentPreset) ?? input.hint ?? null
  if (kind === 'codex') return { state: 'n/a', reason: 'codex' }
  if (input.launch) return { state: 'none', reason: input.launch.reason ?? 'no-report' }
  // a claude-cli tab without a record: BAT launched it in an earlier process (BAT reopened, the PTY kept)
  if (hooksAgentKindOf(input.agentPreset) === 'claude') return { state: 'none', reason: 'no-report' }
  if (input.tower || kind === 'claude') return { state: 'none', reason: 'not-launched-by-bat' }
  return null
}

/** Whether `--set-role --bat-contract` should wait for a first hook report (§7.2): no report yet, not codex. */
export function hooksStatusNeedsWait(status: HooksStatus | null): boolean {
  return status !== null && status.state === 'none'
}

/** Comparable form of a status (change detection for `terminal:hooks-status`). */
export function hooksStatusKey(status: HooksStatus | null): string {
  if (!status) return 'null'
  if (status.state === 'ok') return `ok:${status.origin}:${status.set}:${status.reason ?? ''}`
  return `${status.state}:${status.reason}`
}


/** `terminal:hooks-status` (main → windows; proxied): a declared Tower's `hooksStatus` changed. */
export const HOOKS_STATUS_CHANNEL = 'terminal:hooks-status'

export interface HooksStatusChange {
  id: string
  hooksStatus: HooksStatus | null
}
