/**
 * PLAN-047 M1b-1 / T0590: `blocked` — a claude-cli tab waiting for the user (a permission prompt,
 * AskUserQuestion, an MCP elicitation dialog), reported by the claude hooks BAT injects
 * (`--settings=<dataDir>/bat-mcp/claude-settings.json`, electron/bat-mcp-launch.ts) through
 * `scripts/bat-hook.mjs` → `terminal:report-hook` (helper only, over RemoteServer).
 *
 *   hook event                                   → effect
 *   PermissionRequest                            → blocked / permission (tool_name: log only);
 *                                                  tool_name AskUserQuestion → question (T0597)
 *   PreToolUse, matcher AskUserQuestion          → blocked / question
 *   Notification, elicitation_dialog / _url_     → blocked / elicitation
 *   PostToolUse, matcher AskUserQuestion (T0594) → cleared, only when blocked / question
 *   ElicitationResult; Notification,             → cleared, only when blocked / elicitation
 *     elicitation_response (async, T0620)
 *   PostToolBatch (async, T0657)                 → cleared, only when blocked / permission and
 *                                                  no other agent's prompt is still recorded
 *   UserPromptSubmit, Stop                       → cleared
 *   SessionStart (async, T0600)                  → `agentStarted` (blocked unchanged)
 *
 * Also cleared: the user's input into the tab (`PtyManager.noteUserInput`: a local window's /
 * headless client's `pty:write`, not `{ auto: true }`, not only terminal auto-replies), the PTY
 * ending (exit / kill, so `pty:restart` too), and the Terminal Server recovery.
 *
 * T0657 (BUG-162): a permission prompt answered without the keyboard (by mouse, or claude's own
 * timeout — the dangerous-rm safety check auto-denies after 120 s even under
 * `--dangerously-skip-permissions`) is cleared by `post-tool-batch`. `PostToolBatch` runs once all
 * tool calls of one agent's batch resolved, so a parallel prompt of the same agent is never cleared
 * early; prompts are keyed by the hook's `agent_id` (absent = the main thread), a batch clears only
 * its own agent's, and `blocked` ends when none is left (more than `PERMISSION_AGENTS_MAX` agents →
 * any batch clears).
 *
 * `blockedDetection` (`hook` / `none`) is per terminal id and outlives the PTY (restart, recovery,
 * an exited record): set by the launch decision (`buildBatMcpLaunchArgs`, `none` when no hooks)
 * and by any accepted report (a tab that reports evidently runs the hooks). So a `none` tab never
 * reads a hook reason (T0607 / D156: it may still read `blocked` / `tower`, which needs no hook).
 *
 * T0600 (D154): `agentStarted` — the claude of running PTY `id` ran its `SessionStart` hook (any
 * `source`; only the first time per PTY is kept). Same lifetime as `blocked`: cleared when the PTY
 * ends (exit / kill, so `pty:restart` too; the exited record keeps the time, `agentStartedAt` of
 * `ExitedPtyRecord`) and by the Terminal Server recovery; user input does not clear it.
 *
 * PLAN-050 / T0642 (D167): `claudeSessionId` — the `session_id` a `SessionStart` hook sends
 * (`sessionId`, a UUID; anything else is ignored). Every `SessionStart` (startup / resume / clear /
 * compact) replaces it; `agentStarted` keeps the first time. Same lifetime as `agentStarted` (the
 * exited record keeps it, `ExitedPtyRecord.claudeSessionId`); `restoreSessionId` puts back the one
 * Electron saved for a PTY the Terminal Server kept while BAT was closed. Logs carry its first 8
 * characters only.
 *
 * PLAN-047 M1b-2 / T0621 (D158): codex tabs, from codex's own OSC 7501 in the PTY output
 * (src/lib/codex-terminal-state.ts, `observeCodexState`), no hook:
 *
 *   OSC 7501 state=                              → effect (`blockedDetection: osc`)
 *   any value, the first of the PTY              → `agentStarted` (BAT's receive time)
 *   blocked                                      → blocked / input
 *   working, idle, clear                         → cleared
 *
 * `osc` is set by the first sequence seen (observed: BAT's codex tabs and a `codex` typed into a
 * shell alike) or by the dispatch launch decision (`codex --version` >= 0.163.0, T0621 C-5); never
 * over `hook` (a hook tab ignores the sequence). `input` is not cleared by user input (codex sends
 * its own transitions); the PTY ending and the Terminal Server recovery clear it like a hook reason.
 *
 * T0694 (D180): the agent's turn (`isTurnActive`) — whether the agent of running PTY `id` works on a
 * prompt. Pushed to the windows with `terminal:attention-changed` (`busy`, electron/terminal-attention.ts)
 * so a Worker that reported and then works again (a Renew in the same tab) loses its ✓ for that turn.
 *
 *   signal                                       → turn
 *   claude hook UserPromptSubmit                 → started
 *   claude hook Stop                             → ended
 *   codex OSC 7501 state=working                 → started
 *   codex OSC 7501 state=idle / clear            → ended (blocked: unchanged)
 *   no output for `AGENT_TURN_QUIET_END_MS`      → ended (fallback; never while `blocked`)
 *   the PTY ending, the Terminal Server recovery → ended
 *
 * The fallback exists because claude runs no `Stop` when the user interrupts the turn (Esc) and runs
 * `StopFailure` instead of `Stop` on an API error (claude hooks documentation; both events are in the
 * 2.1.306 binary). BAT injects no `StopFailure` hook: the quiet fallback covers both. A `none` tab
 * (no hooks, no OSC) never has a turn. User input neither starts nor ends one. Logs:
 * `[turn] terminal=<id> → started|ended (<cause>)`.
 *
 * 🔴 No `electron` import here (PtyManager and headless use it).
 */
import type { CodexTerminalState } from '../src/lib/codex-terminal-state'
import type { HandlerContext } from './remote/handler-registry'

/** What a claude hook reports (this file's tracker). */
export type HookBlockedReason = 'permission' | 'question' | 'elicitation'
/**
 * PLAN-048 / T0607 (D156): + `tower` — a Worker waiting for its Tower's answer, synthesized by the
 * query handlers from the tower-question store (electron/tower-questions.ts), never by a hook:
 * no `blockedDetection` needed, not cleared by user input.
 */
export type BlockedReason = HookBlockedReason | 'input' | 'tower'
/** T0621: what the tracker holds — a hook reason, or codex's `input` (OSC 7501 `state=blocked`). */
export type TrackedBlockedReason = HookBlockedReason | 'input'
/** T0621: + `osc` (codex's OSC 7501). */
export type BlockedDetection = 'hook' | 'osc' | 'none'
export type HookReportEvent =
  | 'permission-request'
  | 'ask-user-question'
  | 'ask-user-question-done'
  | 'elicitation'
  | 'elicitation-done'
  | 'post-tool-batch'
  | 'user-prompt-submit'
  | 'stop'
  | 'session-start'

export const HOOK_REPORT_EVENTS: readonly HookReportEvent[] = [
  'permission-request',
  'ask-user-question',
  'ask-user-question-done',
  'elicitation',
  'elicitation-done',
  'post-tool-batch',
  'user-prompt-submit',
  'stop',
  'session-start',
]

/** T0600: the events that only report the launch (`agentStarted`); they never touch `blocked`. */
export type StartReportEvent = 'session-start'
export const START_REPORT_EVENTS: readonly StartReportEvent[] = ['session-start']
export type BlockedReportEvent = Exclude<HookReportEvent, StartReportEvent>

export function isStartReportEvent(event: HookReportEvent): event is StartReportEvent {
  return (START_REPORT_EVENTS as readonly string[]).includes(event)
}

/** Which reason an event enters; null = the event clears. */
export const HOOK_EVENT_REASON: Readonly<Record<BlockedReportEvent, HookBlockedReason | null>> = {
  'permission-request': 'permission',
  'ask-user-question': 'question',
  'ask-user-question-done': null,
  elicitation: 'elicitation',
  'elicitation-done': null,
  'post-tool-batch': null,
  'user-prompt-submit': null,
  stop: null,
}

/**
 * T0597 (BUG-150): the reason `event` enters (null = clears). claude's AskUserQuestion requires user
 * interaction, so its question dialog goes through the permission prompt: a `PermissionRequest`
 * with tool_name AskUserQuestion follows its `PreToolUse` (~90 ms later, any permission mode; claude
 * 2.1.300 / 2.1.302, T0596) — still a question, or `ask-user-question-done` could never clear it.
 */
export function hookEventReason(event: BlockedReportEvent, toolName?: string): HookBlockedReason | null {
  if (event === 'permission-request' && toolName === 'AskUserQuestion') return 'question'
  return HOOK_EVENT_REASON[event]
}

/**
 * T0594: a clearing event that clears only this reason (another reason → `unchanged`): the answered
 * AskUserQuestion must not clear a permission prompt shown meanwhile. Absent = clears any reason.
 * T0620: the closed MCP elicitation dialog likewise clears only `elicitation`.
 * T0657: a resolved tool batch clears only `permission` (and only its own agent's prompts).
 */
export const HOOK_EVENT_CLEARS_ONLY: Readonly<Partial<Record<BlockedReportEvent, HookBlockedReason>>> = {
  'ask-user-question-done': 'question',
  'elicitation-done': 'elicitation',
  'post-tool-batch': 'permission',
}

/** T0657: the events that carry the hook's `agent_id` (any other event ignores it). */
export const AGENT_ID_REPORT_EVENTS: readonly BlockedReportEvent[] = ['permission-request', 'post-tool-batch']
/**
 * T0657: agents whose permission prompt one tab remembers; one more → the tab falls back to
 * "any `post-tool-batch` clears" (logged once) until it leaves `permission`.
 */
export const PERMISSION_AGENTS_MAX = 32
/** T0657: the key of the main thread (a hook without `agent_id`). */
const MAIN_AGENT = ''

/** T0642: a claude session id as accepted from a `session-start` report (scripts/bat-hook.mjs checks the same). */
export const CLAUDE_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** T0642: what a log line may show of a session id. */
export function sessionIdForLog(sessionId: string): string {
  return sessionId.slice(0, 8)
}

/** `toolName` as accepted from a hook (claude / MCP tool names: `Bash`, `mcp__bat__bat_wait`). */
export const HOOK_TOOL_NAME_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/
/** T0657: `agentId` as accepted from a hook (claude's subagent id); same rule as a tool name. */
export const HOOK_AGENT_ID_PATTERN = HOOK_TOOL_NAME_PATTERN
/** Terminal ids whose `blockedDetection` is remembered (oldest dropped first). */
export const BLOCKED_DETECTION_MAX = 512
/** An `unchanged` report is mirrored to bat-scripts.log at most this often per terminal. */
export const REPORT_HOOK_UNCHANGED_LOG_INTERVAL_MS = 5_000

export interface BlockedState {
  reason: TrackedBlockedReason
  /** ms epoch the tab entered this reason. */
  since: number
  /** The hook event that entered it; absent for `source: 'osc'`. */
  event?: HookReportEvent
  /** `permission-request` only; never returned by a query, only logged. */
  toolName?: string
  /** T0621: `osc` = entered by codex's OSC 7501 (`reason: input`); absent = a claude hook. */
  source?: 'osc'
}

/**
 * T0694: a turn with no PTY output for this long ends (the fallback for a turn claude ends without
 * `Stop`). claude and codex redraw their working spinner / elapsed time at least every second while a
 * turn runs, so a minute of silence means the turn is over; a turn that really stays silent that long
 * shows ✓ again, as before T0694.
 */
export const AGENT_TURN_QUIET_END_MS = 60_000

/** T0694: the turn fallback's clock and the PTY's output time (PtyManager's `lastOutputAt`). */
export interface AgentTurnOptions {
  /** Default `AGENT_TURN_QUIET_END_MS`; 0 = no fallback. */
  quietEndMs?: number
  /** ms epoch of PTY `id`'s last output, or null. Absent = the turn's start counts as its last output. */
  lastOutputAt?(id: string): number | null
  /** Tests. Default `setTimeout` (unref'd) / `clearTimeout`. */
  setTimer?(fn: () => void, ms: number): unknown
  clearTimer?(handle: unknown): void
}

/** T0621: what `observeCodexState` did. `ignored` = a `hook` tab (its sequences are not read). */
export type CodexStateResult = 'blocked' | 'cleared' | 'unchanged' | 'ignored'

/** T0600: `started` = the first `session-start` of this PTY (a later one is `unchanged`). */
export type HookReportResult = 'blocked' | 'cleared' | 'unchanged' | 'started'

export interface BlockedTrackerLogger {
  log(message: string): void
}

/**
 * The state machine (one per PtyManager). Logs transitions only:
 * `[blocked] terminal=<id> → blocked reason=<r> (hook <event>[ tool=<name>])` / `→ cleared (<cause>)`;
 * T0600: `[agent-start] terminal=<id> → started (hook session-start)`.
 * T0642: + ` session=<first 8>`; a later `session-start` with another session id logs
 * `[agent-start] terminal=<id> session=<first 8> (hook session-start)`.
 * T0609 (BUG-153): `onChange(id)` after every `blocked` transition (entered / reason changed /
 * cleared) — the renderer push (electron/terminal-attention.ts). A throwing listener is ignored.
 * T0642: `onSessionChange(id)` when a report changes PTY `id`'s session id (Electron persists it).
 * T0694: `onChange(id)` also after every turn transition (started / ended).
 */
export class TerminalBlockedTracker {
  private readonly states = new Map<string, BlockedState>()
  private readonly detection = new Map<string, BlockedDetection>()
  /** T0600: running PTY id → ms epoch of its first `session-start` (T0621: or OSC 7501). */
  private readonly started = new Map<string, number>()
  /** T0621: running PTY id → its last codex OSC 7501 state (logs transitions only). */
  private readonly codexStates = new Map<string, CodexTerminalState>()
  /** T0642: running PTY id → the session id its last `session-start` sent. */
  private readonly sessionIds = new Map<string, string>()
  /**
   * T0657: PTY id in `permission` → the agents whose prompt is open (`MAIN_AGENT` = the main
   * thread); `any` = more than `PERMISSION_AGENTS_MAX`, any `post-tool-batch` clears.
   */
  private readonly permissionAgents = new Map<string, Set<string> | 'any'>()
  /** T0694: running PTY id → its agent's turn (start time, the quiet fallback's timer). */
  private readonly turns = new Map<string, { since: number; timer: unknown }>()

  constructor(
    private readonly logger?: BlockedTrackerLogger,
    private readonly now: () => number = () => Date.now(),
    private readonly onChange?: (id: string) => void,
    private readonly onSessionChange?: (id: string) => void,
    private readonly turnOptions: AgentTurnOptions = {},
  ) {}

  private sessionChanged(id: string): void {
    if (!this.onSessionChange) return
    try {
      this.onSessionChange(id)
    } catch (e) {
      this.logger?.log(`[agent-start] onSessionChange listener failed terminal=${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  private changed(id: string): void {
    if (!this.onChange) return
    try {
      this.onChange(id)
    } catch (e) {
      this.logger?.log(`[blocked] onChange listener failed terminal=${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /**
   * Applies a hook report of PTY `id` (the caller checks it is running). T0642: `sessionId` (a
   * `session-start` only, already validated) replaces the PTY's session id. T0657: `agentId` (a
   * `permission-request` / `post-tool-batch` only, already validated; absent = the main thread).
   */
  report(id: string, event: HookReportEvent, toolName?: string, sessionId?: string, agentId?: string): { result: HookReportResult; state: BlockedState | null } {
    this.setDetection(id, 'hook')
    if (isStartReportEvent(event)) {
      const state = this.get(id)
      const sessionChanged = sessionId !== undefined && this.sessionIds.get(id) !== sessionId
      if (sessionChanged) this.sessionIds.set(id, sessionId)
      const session = sessionId !== undefined ? ` session=${sessionIdForLog(sessionId)}` : ''
      let result: HookReportResult = 'unchanged'
      if (!this.started.has(id)) {
        this.started.set(id, this.now())
        this.logger?.log(`[agent-start] terminal=${id} → started (hook ${event})${session}`)
        result = 'started'
      } else if (sessionChanged) {
        this.logger?.log(`[agent-start] terminal=${id}${session} (hook ${event})`)
      }
      if (sessionChanged) this.sessionChanged(id)
      return { result, state }
    }
    // T0694: the turn (independent of `blocked`; the result below stays about `blocked`)
    if (event === 'user-prompt-submit') this.startTurn(id, `hook ${event}`)
    else if (event === 'stop') this.endTurn(id, `hook ${event}`)
    const reason = hookEventReason(event, toolName)
    const agent = agentId ?? MAIN_AGENT
    const agentLog = agentId ? ` agent=${agentId}` : ''
    if (reason === null) {
      const only = HOOK_EVENT_CLEARS_ONLY[event]
      if (only && this.states.get(id)?.reason !== only) return { result: 'unchanged', state: this.get(id) }
      if (event === 'post-tool-batch') {
        // T0657: another agent's prompt may still be open
        const agents = this.permissionAgents.get(id)
        if (agents instanceof Set && (!agents.delete(agent) || agents.size > 0)) return { result: 'unchanged', state: this.get(id) }
      }
      return { result: this.clear(id, `hook ${event}${agentLog}`) ? 'cleared' : 'unchanged', state: null }
    }
    const current = this.states.get(id)
    if (current && current.reason === reason) {
      if (reason === 'permission') this.addPermissionAgent(id, agent)
      return { result: 'unchanged', state: { ...current } }
    }
    const state: BlockedState = { reason, since: this.now(), event, ...(toolName ? { toolName } : {}) }
    this.states.set(id, state)
    if (reason === 'permission') this.permissionAgents.set(id, new Set([agent]))
    else this.permissionAgents.delete(id)
    this.logger?.log(`[blocked] terminal=${id} → blocked reason=${reason} (hook ${event}${toolName ? ` tool=${toolName}` : ''}${reason === 'permission' ? agentLog : ''})`)
    this.changed(id)
    return { result: 'blocked', state: { ...state } }
  }

  /** T0657: one more agent with an open permission prompt in PTY `id` (already `permission`). */
  private addPermissionAgent(id: string, agent: string): void {
    const agents = this.permissionAgents.get(id)
    if (agents === 'any') return
    if (!agents) {
      this.permissionAgents.set(id, new Set([agent]))
      return
    }
    agents.add(agent)
    if (agents.size <= PERMISSION_AGENTS_MAX) return
    this.permissionAgents.set(id, 'any')
    this.logger?.log(`[blocked] terminal=${id} permission prompts of more than ${PERMISSION_AGENTS_MAX} agents → any post-tool-batch clears`)
  }

  /**
   * T0621: codex's OSC 7501 `state` of running PTY `id` (the caller checks it is running). Logs
   * `[codex-state] terminal=<id> → <state>` on a change, `[agent-start] … → started (osc <state>)`,
   * `[blocked] … → blocked reason=input (osc)` / `→ cleared (osc <state>)`.
   */
  observeCodexState(id: string, state: CodexTerminalState): CodexStateResult {
    if (this.getDetection(id) === 'hook') return 'ignored'
    if (this.getDetection(id) !== 'osc') this.setDetection(id, 'osc')
    if (this.codexStates.get(id) !== state) {
      this.codexStates.set(id, state)
      this.logger?.log(`[codex-state] terminal=${id} → ${state}`)
    }
    if (!this.started.has(id)) {
      this.started.set(id, this.now())
      this.logger?.log(`[agent-start] terminal=${id} → started (osc ${state})`)
    }
    // T0694: the turn; `blocked` happens inside one and leaves it as it is
    if (state === 'working') this.startTurn(id, `osc ${state}`)
    else if (state !== 'blocked') this.endTurn(id, `osc ${state}`)
    if (state !== 'blocked') return this.clear(id, `osc ${state}`) ? 'cleared' : 'unchanged'
    if (this.states.get(id)?.reason === 'input') return 'unchanged'
    this.states.set(id, { reason: 'input', since: this.now(), source: 'osc' })
    this.permissionAgents.delete(id)
    this.logger?.log(`[blocked] terminal=${id} → blocked reason=input (osc)`)
    this.changed(id)
    return 'blocked'
  }

  /**
   * T0621: the user typed into PTY `id`: clears a hook reason (T0590), never codex's `input` (codex
   * reports its own transitions). True when it was cleared.
   */
  clearForUserInput(id: string): boolean {
    if (this.states.get(id)?.reason === 'input') return false
    return this.clear(id, 'user input')
  }

  /** Clears PTY `id`; true when it was blocked. */
  clear(id: string, cause: string): boolean {
    this.permissionAgents.delete(id)
    if (!this.states.delete(id)) return false
    this.logger?.log(`[blocked] terminal=${id} → cleared (${cause})`)
    this.changed(id)
    return true
  }

  clearAll(cause: string): void {
    for (const id of [...this.states.keys()]) this.clear(id, cause)
    for (const id of [...this.turns.keys()]) this.endTurn(id, cause) // T0694
    this.started.clear() // T0600
    this.codexStates.clear() // T0621
    this.sessionIds.clear() // T0642
  }

  /** T0600: ms epoch of PTY `id`'s first `session-start`, or null. */
  getStartedAt(id: string): number | null {
    return this.started.get(id) ?? null
  }

  /** T0642: the session id PTY `id`'s last `session-start` sent, or null. */
  getSessionId(id: string): string | null {
    return this.sessionIds.get(id) ?? null
  }

  /**
   * T0642: puts back the session id Electron saved for running PTY `id` (BAT reopened, the Terminal
   * Server kept the PTY). A session id reported since wins. True when it was set.
   */
  restoreSessionId(id: string, sessionId: string): boolean {
    if (this.sessionIds.has(id) || !CLAUDE_SESSION_ID_PATTERN.test(sessionId)) return false
    this.sessionIds.set(id, sessionId)
    this.logger?.log(`[agent-start] terminal=${id} session=${sessionIdForLog(sessionId)} (restored)`)
    return true
  }

  /**
   * T0600: the PTY ended (exit / kill); its exited record keeps the time. T0621: + its codex state.
   * T0642: + its session id (the exited record keeps it too).
   */
  clearStarted(id: string): void {
    this.started.delete(id)
    this.codexStates.delete(id)
    this.sessionIds.delete(id)
    this.endTurn(id, 'the PTY ended') // T0694
  }

  /** T0694: whether the agent of PTY `id` is in a turn (hook / OSC signals, see the file header). */
  isTurnActive(id: string): boolean {
    return this.turns.has(id)
  }

  /** T0694: a turn started; a running one keeps its start. True when none was running. */
  private startTurn(id: string, cause: string): boolean {
    if (this.turns.has(id)) return false
    this.turns.set(id, { since: this.now(), timer: this.armTurnTimer(id, this.turnQuietEndMs()) })
    this.logger?.log(`[turn] terminal=${id} → started (${cause})`)
    this.changed(id)
    return true
  }

  /** T0694: the turn of PTY `id` ended; true when one was running. */
  endTurn(id: string, cause: string): boolean {
    const turn = this.turns.get(id)
    if (!turn) return false
    this.clearTurnTimer(turn.timer)
    this.turns.delete(id)
    this.logger?.log(`[turn] terminal=${id} → ended (${cause})`)
    this.changed(id)
    return true
  }

  private turnQuietEndMs(): number {
    const ms = this.turnOptions.quietEndMs ?? AGENT_TURN_QUIET_END_MS
    return Number.isFinite(ms) && ms > 0 ? ms : 0
  }

  private armTurnTimer(id: string, ms: number): unknown {
    if (ms <= 0) return null
    const fn = () => this.checkTurnQuiet(id)
    if (this.turnOptions.setTimer) return this.turnOptions.setTimer(fn, ms)
    const handle = setTimeout(fn, ms)
    ;(handle as { unref?: () => void }).unref?.()
    return handle
  }

  private clearTurnTimer(handle: unknown): void {
    if (handle === null || handle === undefined) return
    if (this.turnOptions.clearTimer) this.turnOptions.clearTimer(handle)
    else clearTimeout(handle as ReturnType<typeof setTimeout>)
  }

  /** T0694: the quiet fallback — ends the turn after `quietEndMs` without output, never while `blocked`. */
  private checkTurnQuiet(id: string): void {
    const turn = this.turns.get(id)
    if (!turn) return
    const quietMs = this.turnQuietEndMs()
    if (quietMs <= 0) return
    // waiting for the user is part of the turn: it goes on once the prompt is answered
    if (this.states.has(id)) {
      turn.timer = this.armTurnTimer(id, quietMs)
      return
    }
    let last = turn.since
    try {
      last = Math.max(last, this.turnOptions.lastOutputAt?.(id) ?? 0)
    } catch { /* the start time only */ }
    const quietFor = this.now() - last
    if (quietFor >= quietMs) {
      this.endTurn(id, `no output for ${quietMs}ms`)
      return
    }
    turn.timer = this.armTurnTimer(id, quietMs - quietFor)
  }

  get(id: string): BlockedState | null {
    const state = this.states.get(id)
    return state ? { ...state } : null
  }

  setDetection(id: string, mode: BlockedDetection): void {
    this.detection.delete(id)
    this.detection.set(id, mode)
    while (this.detection.size > BLOCKED_DETECTION_MAX) {
      const oldest = this.detection.keys().next().value
      if (oldest === undefined) break
      this.detection.delete(oldest)
    }
  }

  getDetection(id: string): BlockedDetection {
    return this.detection.get(id) ?? 'none'
  }

  dispose(): void {
    for (const turn of this.turns.values()) this.clearTurnTimer(turn.timer) // T0694
    this.turns.clear()
    this.states.clear()
    this.permissionAgents.clear()
    this.started.clear()
    this.codexStates.clear()
    this.sessionIds.clear()
  }
}

/** T0600 option B: how long after the dispatch command the output is looked at, and how much of it. */
export const LAUNCH_SUSPECT_WINDOW_MS = 10_000
export const LAUNCH_SUSPECT_MAX_CHARS = 8_192
/** T0600 option B: what a shell prints when the agent command does not exist (bash / zsh, cmd, pwsh). */
export const LAUNCH_SUSPECT_PATTERNS: ReadonlyArray<readonly [label: string, pattern: RegExp]> = [
  ['command not found', /command not found/i],
  ['is not recognized as', /is not recognized as/i],
  ['CommandNotFoundException', /CommandNotFoundException/],
]
// eslint-disable-next-line no-control-regex
const ANSI_SEQUENCE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-_]/g

/**
 * T0600 option B (D154): log only — the output of a PTY within `LAUNCH_SUSPECT_WINDOW_MS` of its
 * dispatch command (`PtyManager.writeDispatchCommand`) is matched against `LAUNCH_SUSPECT_PATTERNS`;
 * the first match logs `[agent-command] launch-suspect terminal=<id> pattern="<label>" after=<ms>ms`
 * (never the output) and ends the watch. Changes no state, no exit code; O(1) for unwatched PTYs.
 */
export class LaunchSuspectWatcher {
  private readonly watches = new Map<string, { since: number; text: string }>()

  constructor(
    private readonly logger?: BlockedTrackerLogger,
    private readonly now: () => number = () => Date.now(),
  ) {}

  watch(id: string): void {
    this.watches.set(id, { since: this.now(), text: '' })
  }

  output(id: string, data: string): void {
    const watch = this.watches.get(id)
    if (!watch) return
    const elapsed = this.now() - watch.since
    if (elapsed > LAUNCH_SUSPECT_WINDOW_MS) {
      this.watches.delete(id)
      return
    }
    // the tail of the previous chunk too: a message split across chunks
    watch.text = `${watch.text}${data.replace(ANSI_SEQUENCE, '')}`.slice(-LAUNCH_SUSPECT_MAX_CHARS)
    const hit = LAUNCH_SUSPECT_PATTERNS.find(([, pattern]) => pattern.test(watch.text))
    if (!hit) return
    this.watches.delete(id)
    this.logger?.log(`[agent-command] launch-suspect terminal=${id} pattern="${hit[0]}" after=${elapsed}ms`)
  }

  isWatching(id: string): boolean {
    return this.watches.has(id)
  }

  clear(id: string): void {
    this.watches.delete(id)
  }

  dispose(): void {
    this.watches.clear()
  }
}

/** What `terminal:report-hook` needs from PtyManager (the class satisfies it). */
export interface ReportHookPtyManager {
  isAlive(id: string): boolean
  reportHookEvent(id: string, event: HookReportEvent, toolName?: string, sessionId?: string, agentId?: string): { result: HookReportResult; state: BlockedState | null } | null
}

export interface ReportHookDeps {
  registerHandler(channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown): void
  getPtyManager(): ReportHookPtyManager | null
  logger: { log(...args: unknown[]): void }
  mirrorToBatScripts?(event: string, payload: Record<string, unknown>): void
  /** Tests. Default `Date.now`. */
  now?(): number
}

export const REPORT_HOOK_CHANNEL = 'terminal:report-hook'

export type ReportHookFailure = { ok: false; code: 'INVALID_ARGS' | 'NOT_FOUND'; message?: string }

/**
 * `terminal:report-hook` `{ event, toolName?, sessionId?, agentId? }` — the target is always the caller's own terminal
 * (`ctx.helper`, the capability the invoke came in with). Answers
 * `{ ok: true, terminalId, result, state, blockedReason? }` or `{ ok: false, INVALID_ARGS | NOT_FOUND }`
 * (T0600: `result: 'started'` for the first `session-start`).
 * T0642 (D167): `sessionId` of a `session-start` (`CLAUDE_SESSION_ID_PATTERN`) is recorded; on any
 * other event, or not a UUID, it is ignored — no error, `agentStarted` as without it. A BAT before
 * T0642 ignores the field the same way (the hook still exits 0).
 * T0657: `agentId` (`HOOK_AGENT_ID_PATTERN`) of a `permission-request` / `post-tool-batch` keys the
 * permission prompt by agent; not a string / not matching → INVALID_ARGS (a malformed id must not
 * read as the main thread); on any other event it is ignored. A BAT before T0657 ignores the field
 * (and answers `post-tool-batch` INVALID_ARGS; the hook still exits 0).
 * Every report is O(1); transitions are logged by the tracker, an `unchanged` report is mirrored to
 * bat-scripts.log at most once per `REPORT_HOOK_UNCHANGED_LOG_INTERVAL_MS` per terminal.
 */
export function registerReportHookHandler(deps: ReportHookDeps): void {
  const now = deps.now ?? (() => Date.now())
  const lastUnchangedMirror = new Map<string, number>()

  const mirror = (terminalId: string, event: string, result: string, sessionId?: string, agentId?: string): void => {
    if (!deps.mirrorToBatScripts) return
    if (result === 'unchanged') {
      const t = now()
      const last = lastUnchangedMirror.get(terminalId)
      if (last !== undefined && t - last < REPORT_HOOK_UNCHANGED_LOG_INTERVAL_MS) return
      lastUnchangedMirror.set(terminalId, t)
      if (lastUnchangedMirror.size > BLOCKED_DETECTION_MAX) lastUnchangedMirror.delete(lastUnchangedMirror.keys().next().value as string)
    }
    // `hook`, not `event`: the record's own `event` is 'report-hook'
    deps.mirrorToBatScripts('report-hook', {
      terminalId,
      hook: event,
      result,
      ...(sessionId ? { session: sessionIdForLog(sessionId) } : {}), // T0642: first 8 only
      ...(agentId ? { agent: agentId } : {}), // T0657
    })
  }

  const fail = (caller: string, event: string, code: ReportHookFailure['code'], message?: string): ReportHookFailure => {
    deps.logger.log(`[blocked] report-hook caller=${caller} event=${event} → ${code}${message ? ` (${message})` : ''}`)
    mirror(caller, event, code)
    return message ? { ok: false, code, message } : { ok: false, code }
  }

  // literal channel name: the IPC binding guards scan for it (proxied-channels-binding.test.ts)
  deps.registerHandler('terminal:report-hook', (ctx: HandlerContext, raw?: unknown) => {
    const caller = ctx.helper?.terminalId
    const opts = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
    const event = typeof opts?.event === 'string' ? opts.event : '-'
    if (!caller) return fail(ctx.connectionId ? `client:${ctx.connectionId}` : 'local', event, 'INVALID_ARGS', 'a helper capability is required (the target is the caller itself)')
    if (!opts) return fail(caller, event, 'INVALID_ARGS')
    if (!(HOOK_REPORT_EVENTS as readonly string[]).includes(event)) return fail(caller, event, 'INVALID_ARGS', 'event')
    let toolName: string | undefined
    if (opts.toolName !== undefined && opts.toolName !== null) {
      if (typeof opts.toolName !== 'string' || !HOOK_TOOL_NAME_PATTERN.test(opts.toolName)) return fail(caller, event, 'INVALID_ARGS', 'toolName')
      // only a permission prompt names its tool (logged, never returned)
      if (event === 'permission-request') toolName = opts.toolName
    }
    // T0642: a session-start's UUID; anything else is dropped without an error
    const sessionId = event === 'session-start' && typeof opts.sessionId === 'string' && CLAUDE_SESSION_ID_PATTERN.test(opts.sessionId)
      ? opts.sessionId
      : undefined
    // T0657: the subagent a permission prompt / a resolved batch belongs to
    let agentId: string | undefined
    if ((AGENT_ID_REPORT_EVENTS as readonly string[]).includes(event) && opts.agentId !== undefined && opts.agentId !== null) {
      if (typeof opts.agentId !== 'string' || !HOOK_AGENT_ID_PATTERN.test(opts.agentId)) return fail(caller, event, 'INVALID_ARGS', 'agentId')
      agentId = opts.agentId
    }
    const pm = deps.getPtyManager()
    const outcome = pm && pm.isAlive(caller) ? pm.reportHookEvent(caller, event as HookReportEvent, toolName, sessionId, agentId) : null
    if (!outcome) return fail(caller, event, 'NOT_FOUND')
    mirror(caller, event, outcome.result, sessionId, agentId)
    return {
      ok: true,
      terminalId: caller,
      result: outcome.result,
      state: outcome.state ? 'blocked' : 'not-blocked',
      ...(outcome.state ? { blockedReason: outcome.state.reason } : {}),
    }
  })
}
