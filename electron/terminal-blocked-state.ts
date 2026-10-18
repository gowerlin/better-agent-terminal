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
 *   UserPromptSubmit, Stop                       → cleared
 *   SessionStart (async, T0600)                  → `agentStarted` (blocked unchanged)
 *
 * Also cleared: the user's input into the tab (`PtyManager.noteUserInput`: a local window's /
 * headless client's `pty:write`, not `{ auto: true }`, not only terminal auto-replies), the PTY
 * ending (exit / kill, so `pty:restart` too), and the Terminal Server recovery.
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
 * 🔴 No `electron` import here (PtyManager and headless use it).
 */
import type { HandlerContext } from './remote/handler-registry'

/** What a claude hook reports (this file's tracker). */
export type HookBlockedReason = 'permission' | 'question' | 'elicitation'
/**
 * PLAN-048 / T0607 (D156): + `tower` — a Worker waiting for its Tower's answer, synthesized by the
 * query handlers from the tower-question store (electron/tower-questions.ts), never by a hook:
 * no `blockedDetection` needed, not cleared by user input.
 */
export type BlockedReason = HookBlockedReason | 'tower'
export type BlockedDetection = 'hook' | 'none'
export type HookReportEvent =
  | 'permission-request'
  | 'ask-user-question'
  | 'ask-user-question-done'
  | 'elicitation'
  | 'elicitation-done'
  | 'user-prompt-submit'
  | 'stop'
  | 'session-start'

export const HOOK_REPORT_EVENTS: readonly HookReportEvent[] = [
  'permission-request',
  'ask-user-question',
  'ask-user-question-done',
  'elicitation',
  'elicitation-done',
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
 */
export const HOOK_EVENT_CLEARS_ONLY: Readonly<Partial<Record<BlockedReportEvent, HookBlockedReason>>> = {
  'ask-user-question-done': 'question',
  'elicitation-done': 'elicitation',
}

/** `toolName` as accepted from a hook (claude / MCP tool names: `Bash`, `mcp__bat__bat_wait`). */
export const HOOK_TOOL_NAME_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/
/** Terminal ids whose `blockedDetection` is remembered (oldest dropped first). */
export const BLOCKED_DETECTION_MAX = 512
/** An `unchanged` report is mirrored to bat-scripts.log at most this often per terminal. */
export const REPORT_HOOK_UNCHANGED_LOG_INTERVAL_MS = 5_000

export interface BlockedState {
  reason: HookBlockedReason
  /** ms epoch the tab entered this reason. */
  since: number
  /** The hook event that entered it. */
  event: HookReportEvent
  /** `permission-request` only; never returned by a query, only logged. */
  toolName?: string
}

/** T0600: `started` = the first `session-start` of this PTY (a later one is `unchanged`). */
export type HookReportResult = 'blocked' | 'cleared' | 'unchanged' | 'started'

export interface BlockedTrackerLogger {
  log(message: string): void
}

/**
 * The state machine (one per PtyManager). Logs transitions only:
 * `[blocked] terminal=<id> → blocked reason=<r> (hook <event>[ tool=<name>])` / `→ cleared (<cause>)`;
 * T0600: `[agent-start] terminal=<id> → started (hook session-start)`.
 * T0609 (BUG-153): `onChange(id)` after every `blocked` transition (entered / reason changed /
 * cleared) — the renderer push (electron/terminal-attention.ts). A throwing listener is ignored.
 */
export class TerminalBlockedTracker {
  private readonly states = new Map<string, BlockedState>()
  private readonly detection = new Map<string, BlockedDetection>()
  /** T0600: running PTY id → ms epoch of its first `session-start`. */
  private readonly started = new Map<string, number>()

  constructor(
    private readonly logger?: BlockedTrackerLogger,
    private readonly now: () => number = () => Date.now(),
    private readonly onChange?: (id: string) => void,
  ) {}

  private changed(id: string): void {
    if (!this.onChange) return
    try {
      this.onChange(id)
    } catch (e) {
      this.logger?.log(`[blocked] onChange listener failed terminal=${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /** Applies a hook report of PTY `id` (the caller checks it is running). */
  report(id: string, event: HookReportEvent, toolName?: string): { result: HookReportResult; state: BlockedState | null } {
    this.setDetection(id, 'hook')
    if (isStartReportEvent(event)) {
      const state = this.get(id)
      if (this.started.has(id)) return { result: 'unchanged', state }
      this.started.set(id, this.now())
      this.logger?.log(`[agent-start] terminal=${id} → started (hook ${event})`)
      return { result: 'started', state }
    }
    const reason = hookEventReason(event, toolName)
    if (reason === null) {
      const only = HOOK_EVENT_CLEARS_ONLY[event]
      if (only && this.states.get(id)?.reason !== only) return { result: 'unchanged', state: this.get(id) }
      return { result: this.clear(id, `hook ${event}`) ? 'cleared' : 'unchanged', state: null }
    }
    const current = this.states.get(id)
    if (current && current.reason === reason) return { result: 'unchanged', state: { ...current } }
    const state: BlockedState = { reason, since: this.now(), event, ...(toolName ? { toolName } : {}) }
    this.states.set(id, state)
    this.logger?.log(`[blocked] terminal=${id} → blocked reason=${reason} (hook ${event}${toolName ? ` tool=${toolName}` : ''})`)
    this.changed(id)
    return { result: 'blocked', state: { ...state } }
  }

  /** Clears PTY `id`; true when it was blocked. */
  clear(id: string, cause: string): boolean {
    if (!this.states.delete(id)) return false
    this.logger?.log(`[blocked] terminal=${id} → cleared (${cause})`)
    this.changed(id)
    return true
  }

  clearAll(cause: string): void {
    for (const id of [...this.states.keys()]) this.clear(id, cause)
    this.started.clear() // T0600
  }

  /** T0600: ms epoch of PTY `id`'s first `session-start`, or null. */
  getStartedAt(id: string): number | null {
    return this.started.get(id) ?? null
  }

  /** T0600: the PTY ended (exit / kill); its exited record keeps the time. */
  clearStarted(id: string): void {
    this.started.delete(id)
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
    this.states.clear()
    this.started.clear()
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
  reportHookEvent(id: string, event: HookReportEvent, toolName?: string): { result: HookReportResult; state: BlockedState | null } | null
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
 * `terminal:report-hook` `{ event, toolName? }` — the target is always the caller's own terminal
 * (`ctx.helper`, the capability the invoke came in with). Answers
 * `{ ok: true, terminalId, result, state, blockedReason? }` or `{ ok: false, INVALID_ARGS | NOT_FOUND }`
 * (T0600: `result: 'started'` for the first `session-start`).
 * Every report is O(1); transitions are logged by the tracker, an `unchanged` report is mirrored to
 * bat-scripts.log at most once per `REPORT_HOOK_UNCHANGED_LOG_INTERVAL_MS` per terminal.
 */
export function registerReportHookHandler(deps: ReportHookDeps): void {
  const now = deps.now ?? (() => Date.now())
  const lastUnchangedMirror = new Map<string, number>()

  const mirror = (terminalId: string, event: string, result: string): void => {
    if (!deps.mirrorToBatScripts) return
    if (result === 'unchanged') {
      const t = now()
      const last = lastUnchangedMirror.get(terminalId)
      if (last !== undefined && t - last < REPORT_HOOK_UNCHANGED_LOG_INTERVAL_MS) return
      lastUnchangedMirror.set(terminalId, t)
      if (lastUnchangedMirror.size > BLOCKED_DETECTION_MAX) lastUnchangedMirror.delete(lastUnchangedMirror.keys().next().value as string)
    }
    // `hook`, not `event`: the record's own `event` is 'report-hook'
    deps.mirrorToBatScripts('report-hook', { terminalId, hook: event, result })
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
    const pm = deps.getPtyManager()
    const outcome = pm && pm.isAlive(caller) ? pm.reportHookEvent(caller, event as HookReportEvent, toolName) : null
    if (!outcome) return fail(caller, event, 'NOT_FOUND')
    mirror(caller, event, outcome.result)
    return {
      ok: true,
      terminalId: caller,
      result: outcome.result,
      state: outcome.state ? 'blocked' : 'not-blocked',
      ...(outcome.state ? { blockedReason: outcome.state.reason } : {}),
    }
  })
}
