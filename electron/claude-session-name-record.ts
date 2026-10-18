/**
 * PLAN-050 / T0641 (D167): the session name each claude-cli tab was actually launched with (or
 * why it got none), by terminal id — kept apart from the PTY like `blockedDetection` (the launch
 * decision is made before the PTY exists). Written by the launch decision
 * (`createBatMcpLaunchArgs`, electron/bat-mcp-launch.ts); read by nothing yet — the query fields
 * (`whoami` / `list` / `get-state`) are T0642's.
 *
 * A relaunch of the same id (⏻ restart, a restored tab) overwrites its record. Bounded: the oldest
 * records go once `CLAUDE_SESSION_NAME_RECORD_LIMIT` ids are held (no exit hook in this unit).
 *
 * 🔴 No `electron` import (headless keeps one too). One store per process: `claudeSessionNameRecords`.
 */

/**
 * Why a launch got no `--name` (T0640 contract C-3):
 *   - `not-claude-cli`: codex / gemini / a custom CLI (raw command mode and the Claude Agent SDK
 *     panel never reach the launch decision)
 *   - `no-name`: the caller sent no name (a renderer / host older than T0641, or a worker without a
 *     valid work order id)
 *   - `user-args`: the custom args set the name themselves (`--name` / `-n` / a short-flag group
 *     holding `n`); claude takes theirs
 *   - `claude-too-old` / `version-unknown`: the system runtime's claude is `< 2.1.76` / its version
 *     could not be read (electron/claude-version-check.ts)
 */
export type ClaudeSessionNameReason = 'not-claude-cli' | 'no-name' | 'user-args' | 'claude-too-old' | 'version-unknown'

export interface ClaudeSessionNameRecord {
  /** The name injected, or null. */
  name: string | null
  /** Why `name` is null. */
  reason?: ClaudeSessionNameReason
  /** When the launch was decided (ms). */
  at: number
}

export const CLAUDE_SESSION_NAME_RECORD_LIMIT = 512

export class ClaudeSessionNameRecords {
  private readonly records = new Map<string, ClaudeSessionNameRecord>()

  constructor(private readonly limit = CLAUDE_SESSION_NAME_RECORD_LIMIT) {}

  set(terminalId: string, record: ClaudeSessionNameRecord): void {
    this.records.delete(terminalId)
    this.records.set(terminalId, record)
    while (this.records.size > this.limit) {
      const oldest = this.records.keys().next().value
      if (oldest === undefined) break
      this.records.delete(oldest)
    }
  }

  get(terminalId: string): ClaudeSessionNameRecord | undefined {
    return this.records.get(terminalId)
  }

  delete(terminalId: string): void {
    this.records.delete(terminalId)
  }

  get size(): number {
    return this.records.size
  }
}

/** This process's store (Electron main / headless bat-server). */
export const claudeSessionNameRecords = new ClaudeSessionNameRecords()
