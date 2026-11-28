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
 * T0790 / BUG-197: each hook is its own `bat-hook.mjs` process, so reports may arrive in another order
 * than the events happened (an async `UserPromptSubmit` of a turn reaching BAT after that turn's
 * `PermissionRequest`). A report may carry `at` — when its hook process started, `process.hrtime` ns
 * of the PTY's host (`HOOK_AT_PATTERN`; a monotonic clock shared by the processes of one host, never
 * the wall clock, BUG-171). A clearing event whose `at` is earlier than the `at` of the event that
 * entered the current blocked state (`post-tool-batch`: that of its own agent's prompt) clears
 * nothing (logged `[blocked] … kept: hook <event> … reported late`); its turn signal still applies.
 * Without `at` on either side (an older hook script, an entry by codex's OSC) clearing is as before.
 * `at` is kept by the tracker only, never returned by a query.
 *
 * Also cleared: the user's input into the tab (`PtyManager.noteUserInput`: a local window's /
 * headless client's `pty:write`, not `{ auto: true }`, not only terminal auto-replies), the PTY
 * ending (exit / kill, so `pty:restart` too), and the Terminal Server recovery.
 *
 * T0757 / BUG-188 (D209): also cleared by a left mouse button press in the tab (`hasMouseButtonPress`,
 * `PtyManager.noteMousePress` → `clearForMousePress`, cause `mouse press`). Verified with the real
 * claude 2.1.316 (fullscreen renderer, the one that tracks the mouse): a click on "No" in a permission
 * prompt interrupts the turn with no hook at all, so only the press itself says the user answered.
 * The press is still not user input (`--close-worker`, the usage-limit wait) and never clears codex's
 * `input`. Table: docs/agent-guide/blocked-state.md「滑鼠回答」.
 *
 * T0657 (BUG-162): a permission prompt answered without the keyboard (by mouse, or claude's own
 * timeout — the dangerous-rm safety check auto-denies after 120 s even under
 * `--dangerously-skip-permissions`) is cleared by `post-tool-batch`. `PostToolBatch` runs once all
 * tool calls of one agent's batch resolved, so a parallel prompt of the same agent is never cleared
 * early; prompts are keyed by the hook's `agent_id` (absent = the main thread), a batch clears only
 * its own agent's, and `blocked` ends when none is left (more than `PERMISSION_AGENTS_MAX` agents →
 * any batch clears).
 *
 * T0918 / BUG-222: one agent may have several permission prompts open at once — claude asks for each
 * call of a parallel batch it may not run (claude 2.1.331: `PermissionRequest` hooks of every queued
 * prompt run when it is queued, before the user answered the first; the screen then shows "2 of 3",
 * "3 of 3" with no hook). The tracker keeps each prompt (its `at`) per agent; while 2 or more are open,
 * the user's input and a mouse press do not clear (the user answered one of them, BAT cannot tell which
 * or whether the answer ended the turn): `post-tool-batch` ends the prompts of its agent that happened
 * before it (a later one belongs to the agent's next batch), and `stop` / `user-prompt-submit` / the PTY
 * ending clear all. One open prompt (the usual case): cleared by input / a press exactly as before.
 * Logged `[blocked] terminal=<id> kept: <cause> while <n> permission prompts are open …` (once per count).
 *
 * T0926 / BUG-224: one AskUserQuestion prompt reports twice, `ask-user-question` (`PreToolUse`) and then
 * `permission-request` tool=AskUserQuestion (its `PermissionRequest`, which runs while the dialog already
 * shows). The user's input / a mouse press that clears `question` before the second one arrived (Esc
 * about 0.1 s after the dialog appeared) is remembered (`answeredQuestions`); that second hook, arriving
 * within `ANSWERED_QUESTION_LATE_HOOK_MS` (monotonic), changes nothing — before T0926 it set `question`
 * back, and an Esc-interrupted turn sends no later hook, so the tab stayed blocked until the next key.
 * The reverse order (`permission-request` applied, its `ask-user-question` late) needs `at` on both and
 * an earlier `at`. A real next prompt still blocks (its `ask-user-question` comes first and drops the
 * record). Logged `[blocked] terminal=<id> kept cleared: hook <event>[ tool=<name>] is of the question
 * the user answered <n>ms ago (reported late)`. Permission prompts are not affected (T0918 counts them).
 *
 * T0965 / BUG-236: the AskUserQuestion menu itself (`hasOpenQuestionMenu`) — apart from `blocked`, which the
 * user's input / a mouse press clears (T0590 / T0757: the user may have answered) while the menu often stays
 * open (an arrow key, the first of several questions, a click that focused the window). Opened by a hook
 * that sets or keeps `question`; closed only by what says the menu is gone: `ask-user-question-done`, `stop`,
 * `user-prompt-submit`, a main-thread `post-tool-batch` (each unless its `at` is earlier, T0790), the user's
 * lone Esc or a Ctrl+C (`clearForUserInput` `data`), BAT's own Esc (`closeQuestionMenu`), the PTY ending, the
 * Terminal Server recovery. Read only by NotifyHoldController (an inbox answer is not typed into the menu);
 * 🔴 `blocked` and every query answer are unchanged. Logged `[blocked] terminal=<id> question menu closed (<cause>)`
 * for the user's / BAT's keys only.
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
 * PLAN-061 / T0811 (D229): claude's OSC 7501 (`app=claude-code`, sent once the PTY host answered
 * its probe — non-Windows hosts only, electron/pty-manager.ts `replyToProgramStatusProbes`) takes
 * the same path and the same table (`done` / `error` read as idle; a sub-agent's `id=` record is
 * dropped by the parser). A claude tab with BAT's hooks is `hook` from its launch and ignores it:
 * only a tab whose hooks are off (`none`) moves to `osc`.
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
 * T0791 / BUG-198: a claude `Stop` whose `at` (T0790) is earlier than the latest `at` of the current
 * turn's `UserPromptSubmit` is the previous turn's, reported late: it does not end the turn (logged
 * `[turn] terminal=<id> kept: hook stop happened <n>ms before the current turn (reported late)`).
 * Without `at` on either side it ends the turn as before. The blocked state is judged by T0790's rule
 * on its own. codex's OSC (one ordered output stream) and the quiet fallback have no such disorder.
 *
 * PLAN-068 W3 / T0905 (T0902 §7.4, D328 R1′): a report may carry `origin` (`injected` = BAT's
 * `--settings` hooks, the default when absent; `plugin` = W9's `bat-hooks` plugin) and `set` (the hook
 * set version, `BAT_HOOK_SET`). Both may run for one claude: once PTY `id` reported from `injected`,
 * its `plugin` reports are dropped (`acceptHookOrigin`, logged once per PTY; the handler answers
 * `result: 'duplicate'`). Same lifetime as `agentStarted`. A `stop` may carry `lastAssistantMessage`
 * (+ `messageTruncated`): the handler hands it to `onStop` (the Tower turn cards, electron/tower-cards.ts)
 * and never logs, mirrors or answers it — the tracker never sees it.
 *
 * PLAN-068 W9 / T0910: `acceptHookOrigin` also keeps whether a `plugin` report was applied and the latest
 * `set` per origin (a plugin's `set` is its `--hook-list`); `getHookOriginInfo` hands them to
 * `hooksStatus` (electron/claude-hooks-status.ts). Same lifetime; the dedupe rule is unchanged.
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
/**
 * T0918: open prompts one agent's list keeps; one more merges into its newest entry (still open, so a
 * tab with that many is held anyway — the bound only keeps the memory of a misbehaving reporter small).
 */
export const PERMISSION_PROMPTS_PER_AGENT_MAX = 64
/** T0918 / BUG-222: open permission prompts from which the user's input / a mouse press no longer clears. */
export const QUEUED_PERMISSION_PROMPTS_MIN = 2
/** T0657: the key of the main thread (a hook without `agent_id`). */
const MAIN_AGENT = ''

/**
 * T0926 / BUG-224: how long (monotonic ms) after the user's input / a mouse press cleared `question`
 * the other hook of the same AskUserQuestion prompt, reported late, is still recognized as that
 * prompt's (`answeredQuestions`). The hook script gives up after `HOOK_DEADLINE_MS` = 1.8 s plus its
 * node start, so a hook that started before the user answered reports well within this; after it the
 * report sets `question` as before T0926.
 */
export const ANSWERED_QUESTION_LATE_HOOK_MS = 5_000

/**
 * T0926 / BUG-224: one AskUserQuestion prompt reports twice — `ask-user-question` (`PreToolUse`) and
 * then `permission-request` tool=AskUserQuestion (`PermissionRequest`, started once the dialog shows,
 * T0597). Which of the two were applied while PTY `id` was in `question`.
 */
interface QuestionHooks {
  preToolUse: boolean
  permissionRequest: boolean
}

/**
 * T0926 / BUG-224: a `question` the user's input / a mouse press cleared before both of its hooks had
 * reported. `at`: the latest `at` of the hooks applied (T0790's `blockedAt`; absent = unknown);
 * `clearedAt`: monotonic ms of the clear (`AgentTurnOptions.monotonicNow`).
 */
interface AnsweredQuestion extends QuestionHooks {
  at?: bigint
  clearedAt: number
}

/**
 * T0657 / T0918: the permission prompts open in one tab. `agents`: agent → the `at` of each of its open
 * prompts (null = reported without one; T0790); `any` = more than `PERMISSION_AGENTS_MAX` agents (any
 * `post-tool-batch` clears). `open`: how many are open (the sum over `agents`; counted on under `any`).
 */
interface PermissionPrompts {
  agents: Map<string, Array<bigint | null>> | 'any'
  open: number
}

/** T0642: a claude session id as accepted from a `session-start` report (scripts/bat-hook.mjs checks the same). */
export const CLAUDE_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** T0642: what a log line may show of a session id. */
export function sessionIdForLog(sessionId: string): string {
  return sessionId.slice(0, 8)
}

/**
 * T0790: `at` as accepted from a hook — the hook process's start, `process.hrtime` ns as a decimal
 * string (a BigInt does not survive JSON; ns since boot outgrow `Number`'s exact range after ~104 days).
 */
export const HOOK_AT_PATTERN = /^[0-9]{1,20}$/
const HOOK_AT_MAX = (1n << 64n) - 1n

/** T0790: the `at` of a report as a bigint, or undefined (absent / not a string / malformed / 0 / > 2^64-1). */
export function parseHookAt(value: unknown): bigint | undefined {
  if (typeof value !== 'string' || !HOOK_AT_PATTERN.test(value)) return undefined
  const at = BigInt(value)
  return at > 0n && at <= HOOK_AT_MAX ? at : undefined
}

/** T0790: a gap between two `at` values (ns) for a log line, in ms with one decimal. */
function formatHookAtGap(ns: bigint): string {
  return `${(Number(ns / 100_000n) / 10).toFixed(1)}ms`
}

/** `toolName` as accepted from a hook (claude / MCP tool names: `Bash`, `mcp__bat__bat_wait`). */
export const HOOK_TOOL_NAME_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/
/** T0657: `agentId` as accepted from a hook (claude's subagent id); same rule as a tool name. */
export const HOOK_AGENT_ID_PATTERN = HOOK_TOOL_NAME_PATTERN
/** Terminal ids whose `blockedDetection` is remembered (oldest dropped first). */
export const BLOCKED_DETECTION_MAX = 512
/** An `unchanged` report is mirrored to bat-scripts.log at most this often per terminal. */
export const REPORT_HOOK_UNCHANGED_LOG_INTERVAL_MS = 5_000

/** T0905 (T0902 §7.4): where a hook report comes from. Absent = `injected`. */
export type HookOrigin = 'injected' | 'plugin'
export const HOOK_ORIGINS: readonly HookOrigin[] = ['injected', 'plugin']
/** T0905: the largest hook set version accepted (`set`; anything else is ignored). */
export const HOOK_SET_MAX = 1000
/**
 * T0905 (D328 R1′): the most of a `stop` report's `lastAssistantMessage` the handler passes on, in
 * UTF-16 code units — a backstop only (the hook cuts it to 16 KiB UTF-8 bytes; the card store cuts it
 * again by bytes). Longer → not passed on at all (a malformed report).
 */
export const REPORT_HOOK_MESSAGE_MAX_CHARS = 64 * 1024

/** T0905: `origin` of a report → a known origin, or undefined (absent / unknown = `injected`). */
export function parseHookOrigin(value: unknown): HookOrigin | undefined {
  return typeof value === 'string' && (HOOK_ORIGINS as readonly string[]).includes(value) ? value as HookOrigin : undefined
}

/** T0905: `set` of a report → a whole number 1…`HOOK_SET_MAX`, or undefined. */
export function parseHookSet(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= HOOK_SET_MAX ? value : undefined
}

// T0757: the mouse reports xterm writes while a program tracks the mouse (same shapes as
// TERMINAL_AUTO_REPLY_SEQUENCES in electron/close-worker.ts): SGR `ESC [ < b ; x ; y M|m`,
// urxvt `ESC [ b+32 ; x ; y M`, X10 / normal `ESC [ M <b+32><x+32><y+32>`.
// eslint-disable-next-line no-control-regex
const MOUSE_REPORT = /\x1b\[<(\d+);\d+;\d+([Mm])|\x1b\[(\d+);\d+;\d+M|\x1b\[M([\x20-\xff])[\x20-\xff]{2}/g

/**
 * T0757 / BUG-188 (D209): true when a `pty:write` holds a press of the left mouse button — what a
 * click on a TUI's prompt option sends. Not a press: a release (SGR `m`; X10 / urxvt button 3), a
 * motion or drag (+32), the wheel (+64), buttons 8–11 (+128), the middle / right button. Shift /
 * Meta / Ctrl (+4 / +8 / +16) are allowed. Anything else in the write is ignored (the caller has
 * already decided it is only terminal auto-replies, `isTerminalAutoReply`).
 */
export function hasMouseButtonPress(data: unknown): boolean {
  if (typeof data !== 'string' || !data.includes('\x1b[')) return false
  for (const m of data.matchAll(MOUSE_REPORT)) {
    let code: number
    if (m[1] !== undefined) {
      if (m[2] !== 'M') continue // SGR release
      code = Number(m[1])
    } else if (m[3] !== undefined) {
      code = Number(m[3]) - 32
    } else {
      code = m[4].charCodeAt(0) - 32
    }
    if ((code & ~(4 | 8 | 16)) === 0) return true // left button, no motion / wheel / extra button bits
  }
  return false
}

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
  /**
   * T0926 / BUG-224: the clock of `ANSWERED_QUESTION_LATE_HOOK_MS` (ms, monotonic; never the wall
   * clock, BUG-171). Tests. Default `performance.now()`.
   */
  monotonicNow?(): number
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
   * T0790: + the `at` of each prompt. T0918: every prompt of an agent, not only its latest.
   */
  private readonly permissionPrompts = new Map<string, PermissionPrompts>()
  /** T0918: PTY id → the open-prompt count of the last `kept: … while <n> permission prompts are open` line. */
  private readonly queuedKeptLogged = new Map<string, number>()
  /** T0790: blocked PTY id → the latest `at` of the hook events that entered / kept its reason. */
  private readonly blockedAt = new Map<string, bigint>()
  /** T0926: PTY id in `question` → which of its prompt's two hooks were applied. */
  private readonly questionHooks = new Map<string, QuestionHooks>()
  /**
   * T0926 / BUG-224: PTY id → the `question` the user answered (input / mouse press) before one of its
   * two hooks reported; that hook, arriving within `ANSWERED_QUESTION_LATE_HOOK_MS`, does not set it back.
   * Survives the clear (it is about what comes after it); dropped by the next setting report, the late
   * hook itself, the PTY ending and the Terminal Server recovery.
   */
  private readonly answeredQuestions = new Map<string, AnsweredQuestion>()
  /**
   * T0965 / BUG-236: PTY id → its AskUserQuestion menu may still be open (outlives a clear by the user's
   * input / a mouse press); `at` = the latest `at` of the hooks that opened / kept it (absent = unknown).
   * T0968: `openedAt` = ms epoch (this tracker's `now`, the wall clock) the record began — set when it is
   * made and again by each `ask-user-question` hook (the PreToolUse of a new AskUserQuestion call), so the
   * host can tell whether CT's `menu_open.opened_at` belongs to this menu.
   */
  private readonly questionMenus = new Map<string, { at?: bigint; openedAt: number }>()
  /**
   * T0694: running PTY id → its agent's turn (start time, the quiet fallback's timer).
   * T0791: + `startedAt` — the latest `at` of the `user-prompt-submit` reports that started / kept it
   * (absent = none carried one).
   */
  private readonly turns = new Map<string, { since: number; timer: unknown; startedAt?: bigint }>()
  /**
   * T0905: running PTY id → whether an `injected` report arrived (from then on `plugin` reports are
   * dropped), whether a dropped `plugin` report was logged, and the latest hook `set` reported.
   */
  private readonly hookOrigins = new Map<string, { injected: boolean; droppedLogged: boolean; set?: number; plugin?: boolean; injectedSet?: number; pluginSet?: number }>()

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
   * T0790: `at` (`parseHookAt`, absent = unknown) — when the hook's process started; a clearing
   * event that happened before the blocked state was entered clears nothing (file header).
   */
  report(id: string, event: HookReportEvent, toolName?: string, sessionId?: string, agentId?: string, at?: bigint): { result: HookReportResult; state: BlockedState | null } {
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
    if (event === 'user-prompt-submit') this.startTurn(id, `hook ${event}`, at)
    else if (event === 'stop') this.endTurnByStop(id, at)
    const reason = hookEventReason(event, toolName)
    const agent = agentId ?? MAIN_AGENT
    const agentLog = agentId ? ` agent=${agentId}` : ''
    if (reason === null) {
      this.noteQuestionMenuEnd(id, event, agentId, at) // T0965: before the early returns below
      const only = HOOK_EVENT_CLEARS_ONLY[event]
      if (only && this.states.get(id)?.reason !== only) return { result: 'unchanged', state: this.get(id) }
      if (event === 'post-tool-batch') {
        // T0657: another agent's prompt may still be open; T0918: or a later prompt of the same agent
        const prompts = this.permissionPrompts.get(id)
        if (prompts && prompts.agents instanceof Map) return this.resolveBatch(id, prompts, prompts.agents, agent, agentLog, at)
      }
      // T0790 / BUG-197: reported late — it happened before the blocked state it would clear
      const enteredAt = this.blockedAt.get(id)
      if (at !== undefined && enteredAt !== undefined && at < enteredAt && this.states.has(id)) {
        this.logger?.log(`[blocked] terminal=${id} kept: hook ${event}${agentLog} happened ${formatHookAtGap(enteredAt - at)} before the blocked state (reported late)`)
        return { result: 'unchanged', state: this.get(id) }
      }
      return { result: this.clear(id, `hook ${event}${agentLog}`) ? 'cleared' : 'unchanged', state: null }
    }
    // T0926 / BUG-224: the other hook of the question the user already answered (reported late)
    if (reason === 'question' && this.lateHookOfAnsweredQuestion(id, event, toolName, at)) return { result: 'unchanged', state: null }
    this.answeredQuestions.delete(id)
    if (reason === 'question') this.noteQuestionMenuOpen(id, at, event) // T0965
    const current = this.states.get(id)
    if (current && current.reason === reason) {
      if (reason === 'permission') this.addPermissionPrompt(id, agent, at)
      if (reason === 'question') this.noteQuestionHook(id, event)
      this.noteBlockedAt(id, at)
      return { result: 'unchanged', state: { ...current } }
    }
    const state: BlockedState = { reason, since: this.now(), event, ...(toolName ? { toolName } : {}) }
    this.states.set(id, state)
    this.blockedAt.delete(id)
    this.noteBlockedAt(id, at)
    this.permissionPrompts.delete(id)
    this.queuedKeptLogged.delete(id) // T0918
    this.questionHooks.delete(id) // T0926
    if (reason === 'permission') this.addPermissionPrompt(id, agent, at)
    if (reason === 'question') this.noteQuestionHook(id, event)
    this.logger?.log(`[blocked] terminal=${id} → blocked reason=${reason} (hook ${event}${toolName ? ` tool=${toolName}` : ''}${reason === 'permission' ? agentLog : ''})`)
    this.changed(id)
    return { result: 'blocked', state: { ...state } }
  }

  /** T0790: the latest `at` of the events behind PTY `id`'s blocked state (an unknown one changes nothing). */
  private noteBlockedAt(id: string, at: bigint | undefined): void {
    if (at === undefined) return
    const known = this.blockedAt.get(id)
    if (known === undefined || at > known) this.blockedAt.set(id, at)
  }

  /** T0965 / BUG-236: a hook that sets / keeps `question` — PTY `id`'s AskUserQuestion menu is open. */
  private noteQuestionMenuOpen(id: string, at: bigint | undefined, event: HookReportEvent): void {
    const known = this.questionMenus.get(id)
    const menu = known ?? { openedAt: this.now() }
    // T0968: a new AskUserQuestion call (its PreToolUse) starts the menu again; its second hook does not
    if (known && event === 'ask-user-question') menu.openedAt = this.now()
    if (at !== undefined && (menu.at === undefined || at > menu.at)) menu.at = at
    this.questionMenus.set(id, menu)
  }

  /**
   * T0965 / BUG-236: the hooks that say PTY `id`'s AskUserQuestion menu is gone — the tool finished
   * (`ask-user-question-done`, the main thread's `post-tool-batch`) or the turn moved on (`stop`,
   * `user-prompt-submit`). One whose `at` is earlier than the menu's happened before it (T0790): kept.
   */
  private noteQuestionMenuEnd(id: string, event: HookReportEvent, agentId: string | undefined, at: bigint | undefined): void {
    const menu = this.questionMenus.get(id)
    if (!menu) return
    const ends = event === 'ask-user-question-done' || event === 'stop' || event === 'user-prompt-submit'
      || (event === 'post-tool-batch' && agentId === undefined)
    if (!ends) return
    if (at !== undefined && menu.at !== undefined && at < menu.at) return
    this.questionMenus.delete(id)
  }

  /**
   * T0965 / BUG-236: whether PTY `id`'s AskUserQuestion menu may still be open — also after the user's
   * input / a mouse press cleared `question` (file header). Never changes `blocked`.
   */
  hasOpenQuestionMenu(id: string): boolean {
    return this.questionMenus.has(id)
  }

  /**
   * T0968: ms epoch (this tracker's clock) PTY `id`'s menu record began (`noteQuestionMenuOpen`), or null
   * when there is none. Read only by NotifyHoldController; never changes `blocked`.
   */
  questionMenuOpenedAt(id: string): number | null {
    return this.questionMenus.get(id)?.openedAt ?? null
  }

  /**
   * T0965 / BUG-236: BAT's own Esc closed PTY `id`'s AskUserQuestion menu (NotifyHoldController saw the
   * PTY answer it): the menu record goes and a `question` still set clears (cause `cause`), remembered like
   * an answer (T0926: its late second hook does not set it back). True when anything changed.
   */
  closeQuestionMenu(id: string, cause: string): boolean {
    const hadMenu = this.questionMenus.delete(id)
    const cleared = this.states.get(id)?.reason === 'question' ? this.clearAnswered(id, cause) : false
    if (hadMenu) this.logger?.log(`[blocked] terminal=${id} question menu closed (${cause})`)
    return hadMenu || cleared
  }

  /** T0926: a hook of the AskUserQuestion prompt PTY `id` shows was applied (`question`). */
  private noteQuestionHook(id: string, event: HookReportEvent): void {
    let hooks = this.questionHooks.get(id)
    if (!hooks) {
      hooks = { preToolUse: false, permissionRequest: false }
      this.questionHooks.set(id, hooks)
    }
    if (event === 'permission-request') hooks.permissionRequest = true
    else hooks.preToolUse = true
  }

  private monotonicNow(): number {
    return this.turnOptions.monotonicNow ? this.turnOptions.monotonicNow() : performance.now()
  }

  /**
   * T0926 / BUG-224: the user's input / a mouse press is about to clear PTY `id`. When it is a
   * `question` whose prompt has reported only one of its two hooks, remembers it (after the clear) so
   * the other one, reported late, does not set it back. Returns what to remember, or undefined.
   */
  private questionAnsweredEarly(id: string): AnsweredQuestion | undefined {
    if (this.states.get(id)?.reason !== 'question') return undefined
    const hooks = this.questionHooks.get(id)
    if (!hooks || hooks.preToolUse === hooks.permissionRequest) return undefined // both reported (or neither: no hook)
    const at = this.blockedAt.get(id)
    return { ...hooks, ...(at !== undefined ? { at } : {}), clearedAt: this.monotonicNow() }
  }

  /**
   * T0926 / BUG-224: whether a `question` setting report of PTY `id` is the missing hook of the prompt
   * the user already answered (`answeredQuestions`), reported late — then it changes nothing (logged).
   * The record is looked at once, whatever the outcome.
   *
   *   answered prompt had reported   this report                     → late hook of that prompt when
   *   `ask-user-question` only       `permission-request` (tool=AUQ) → always (its PermissionRequest
   *                                                                    runs after its PreToolUse, while
   *                                                                    the dialog shows)
   *   `permission-request` only      `ask-user-question`             → `at` known on both sides and
   *                                                                    earlier than the answered one
   *
   * A real next prompt is never taken for it: claude runs a prompt's `PreToolUse` (sync) before its
   * `PermissionRequest`, so the next prompt reports `ask-user-question` first — not the missing hook in
   * the first row (it drops the record and blocks), and in the second row it started after the answered
   * prompt (`at` later; unknown `at` → blocks as before T0926). Past `ANSWERED_QUESTION_LATE_HOOK_MS`
   * → blocks as before T0926.
   */
  private lateHookOfAnsweredQuestion(id: string, event: HookReportEvent, toolName: string | undefined, at: bigint | undefined): boolean {
    const answered = this.answeredQuestions.get(id)
    if (!answered) return false
    this.answeredQuestions.delete(id)
    const elapsed = this.monotonicNow() - answered.clearedAt
    if (!(elapsed >= 0 && elapsed <= ANSWERED_QUESTION_LATE_HOOK_MS)) return false
    let late: boolean
    if (event === 'permission-request') late = answered.preToolUse && !answered.permissionRequest
    else late = answered.permissionRequest && !answered.preToolUse && at !== undefined && answered.at !== undefined && at < answered.at
    if (!late) return false
    this.logger?.log(`[blocked] terminal=${id} kept cleared: hook ${event}${toolName ? ` tool=${toolName}` : ''} is of the question the user answered ${Math.round(elapsed)}ms ago (reported late)`)
    return true
  }

  /**
   * T0657 / T0790 / T0918: a `post-tool-batch` of `agent` while PTY `id` is in `permission` (per agent).
   * The batch ran once every call of it was resolved, so it ends each prompt of its agent that happened
   * before it (or at the same time; a prompt without `at`, or a batch without one: all of them). A prompt
   * that happened after it belongs to the agent's next batch (T0790: the batch was reported late). The
   * state clears when no agent has a prompt left.
   */
  private resolveBatch(
    id: string,
    prompts: PermissionPrompts,
    agents: Map<string, Array<bigint | null>>,
    agent: string,
    agentLog: string,
    at: bigint | undefined,
  ): { result: HookReportResult; state: BlockedState | null } {
    const own = agents.get(agent)
    if (!own) return { result: 'unchanged', state: this.get(id) }
    const later = at === undefined ? [] : own.filter((a): a is bigint => a !== null && a > at)
    if (at !== undefined && later.length > 0) {
      const latest = later.reduce((max, a) => (a > max ? a : max))
      if (later.length === own.length) {
        this.logger?.log(`[blocked] terminal=${id} kept: hook post-tool-batch${agentLog} happened ${formatHookAtGap(latest - at)} before the blocked state (reported late)`)
        return { result: 'unchanged', state: this.get(id) }
      }
    }
    prompts.open = Math.max(0, prompts.open - (own.length - later.length))
    if (later.length > 0) agents.set(agent, later)
    else agents.delete(agent)
    if (agents.size > 0) return { result: 'unchanged', state: this.get(id) } // not logged (as before T0918)
    return { result: this.clear(id, `hook post-tool-batch${agentLog}`) ? 'cleared' : 'unchanged', state: null }
  }

  /**
   * T0657: one more open permission prompt of `agent` in PTY `id` (already `permission`). T0790: + its
   * `at`. T0918: every prompt counts (`open`), not only one per agent.
   */
  private addPermissionPrompt(id: string, agent: string, at?: bigint): void {
    let prompts = this.permissionPrompts.get(id)
    if (!prompts) {
      prompts = { agents: new Map(), open: 0 }
      this.permissionPrompts.set(id, prompts)
    }
    const agents = prompts.agents
    if (agents === 'any') {
      prompts.open++
      return
    }
    const own = agents.get(agent)
    if (!own) agents.set(agent, [at ?? null])
    else if (own.length < PERMISSION_PROMPTS_PER_AGENT_MAX) own.push(at ?? null)
    else {
      // the bound: merged into the newest entry (it stays open), `open` does not grow
      const last = own[own.length - 1]
      if (at !== undefined && (last === null || at > last)) own[own.length - 1] = at
      return
    }
    prompts.open++
    if (agents.size <= PERMISSION_AGENTS_MAX) return
    prompts.agents = 'any'
    this.logger?.log(`[blocked] terminal=${id} permission prompts of more than ${PERMISSION_AGENTS_MAX} agents → any post-tool-batch clears`)
  }

  /** T0918: how many permission prompts PTY `id` has open (0 = not in `permission`). */
  getOpenPermissionPrompts(id: string): number {
    if (this.states.get(id)?.reason !== 'permission') return 0
    return this.permissionPrompts.get(id)?.open ?? 0
  }

  /**
   * T0918 / BUG-222: whether the user's input / a mouse press (`cause`) leaves PTY `id` blocked — true
   * while `QUEUED_PERMISSION_PROMPTS_MIN` or more permission prompts are open (logged once per count).
   */
  private keptForQueuedPrompts(id: string, cause: string): boolean {
    const open = this.getOpenPermissionPrompts(id)
    if (open < QUEUED_PERMISSION_PROMPTS_MIN) return false
    if (this.queuedKeptLogged.get(id) !== open) {
      this.queuedKeptLogged.set(id, open)
      this.logger?.log(`[blocked] terminal=${id} kept: ${cause} while ${open} permission prompts are open (cleared by their tool batch, the turn's end or the next prompt)`)
    }
    return true
  }

  /**
   * T0905 (T0902 §7.4): whether a report of running PTY `id` from `origin` (absent = `injected`) is
   * applied. False = a `plugin` report after an `injected` one of the same PTY (both hook sets run for
   * one claude; the injected one is kept). `set` (absent = unknown) is remembered as the PTY's latest.
   */
  acceptHookOrigin(id: string, origin?: HookOrigin, set?: number): boolean {
    let entry = this.hookOrigins.get(id)
    if (!entry) {
      entry = { injected: false, droppedLogged: false }
      this.hookOrigins.set(id, entry)
    }
    const fromPlugin = origin === 'plugin'
    if (fromPlugin && entry.injected) {
      if (!entry.droppedLogged) {
        entry.droppedLogged = true
        this.logger?.log(`[hooks] terminal=${id} plugin reports dropped (the injected hooks report for this PTY)`)
      }
      return false
    }
    if (!fromPlugin) entry.injected = true
    else entry.plugin = true // T0910
    if (set !== undefined) {
      entry.set = set
      // T0910: per origin — a plugin report's `set` is its `--hook-list` (the plugin's event list)
      if (fromPlugin) entry.pluginSet = set
      else entry.injectedSet = set
    }
    return true
  }

  /** T0905: the latest hook set version PTY `id` reported, or null. */
  getHookSet(id: string): number | null {
    return this.hookOrigins.get(id)?.set ?? null
  }

  /**
   * PLAN-068 W9 / T0910: which origins of PTY `id` had a report applied and the latest `set` of each
   * (`hooksStatus`, electron/claude-hooks-status.ts); null = none applied since the PTY started.
   */
  getHookOriginInfo(id: string): { injected: boolean; plugin: boolean; injectedSet?: number; pluginSet?: number } | null {
    const entry = this.hookOrigins.get(id)
    if (!entry || (!entry.injected && !entry.plugin)) return null
    return {
      injected: entry.injected,
      plugin: entry.plugin === true,
      ...(entry.injectedSet !== undefined ? { injectedSet: entry.injectedSet } : {}),
      ...(entry.pluginSet !== undefined ? { pluginSet: entry.pluginSet } : {}),
    }
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
    this.permissionPrompts.delete(id)
    this.queuedKeptLogged.delete(id) // T0918
    this.blockedAt.delete(id) // T0790
    this.questionHooks.delete(id) // T0926
    this.logger?.log(`[blocked] terminal=${id} → blocked reason=input (osc)`)
    this.changed(id)
    return 'blocked'
  }

  /**
   * T0621: the user typed into PTY `id`: clears a hook reason (T0590), never codex's `input` (codex
   * reports its own transitions). True when it was cleared. T0918 / BUG-222: not while 2 or more
   * permission prompts are open (`keptForQueuedPrompts`).
   * T0965 / BUG-236: `data` (the write, absent = unknown) — a lone Esc or a Ctrl+C closes the
   * AskUserQuestion menu (`hasOpenQuestionMenu`); any other key leaves it open.
   */
  clearForUserInput(id: string, data?: string): boolean {
    if (typeof data === 'string' && (data === '\x1b' || data.includes('\x03')) && this.questionMenus.delete(id)) {
      this.logger?.log(`[blocked] terminal=${id} question menu closed (user ${data === '\x1b' ? 'Esc' : 'Ctrl+C'})`)
    }
    if (this.states.get(id)?.reason === 'input') return false
    if (this.keptForQueuedPrompts(id, 'user input')) return false
    return this.clearAnswered(id, 'user input')
  }

  /**
   * T0757 / BUG-188 (D209): the user pressed the left mouse button in PTY `id`
   * (`hasMouseButtonPress`): clears a hook reason like typed input does (an answer by mouse is an
   * answer), never codex's `input` (same rule as `clearForUserInput`). Only the `blocked` state:
   * it is not user input for `--close-worker` or the usage-limit wait (PtyManager does not record it).
   * T0918 / BUG-222: not while 2 or more permission prompts are open (same rule as typed input).
   */
  clearForMousePress(id: string): boolean {
    if (this.states.get(id)?.reason === 'input') return false
    if (this.keptForQueuedPrompts(id, 'mouse press')) return false
    return this.clearAnswered(id, 'mouse press')
  }

  /**
   * T0926 / BUG-224: the user answered (input / mouse press, `cause`) — clears PTY `id` and, for a
   * `question` whose prompt reported only one of its two hooks, remembers it (`answeredQuestions`).
   */
  private clearAnswered(id: string, cause: string): boolean {
    const answered = this.questionAnsweredEarly(id)
    const cleared = this.clear(id, cause)
    if (cleared && answered) this.answeredQuestions.set(id, answered)
    return cleared
  }

  /** Clears PTY `id`; true when it was blocked. */
  clear(id: string, cause: string): boolean {
    this.permissionPrompts.delete(id)
    this.queuedKeptLogged.delete(id) // T0918
    this.blockedAt.delete(id) // T0790
    this.questionHooks.delete(id) // T0926 (`answeredQuestions` outlives the clear on purpose)
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
    this.hookOrigins.clear() // T0905
    this.answeredQuestions.clear() // T0926
    this.questionMenus.clear() // T0965
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
    this.hookOrigins.delete(id) // T0905
    this.answeredQuestions.delete(id) // T0926
    this.questionMenus.delete(id) // T0965
    this.endTurn(id, 'the PTY ended') // T0694
  }

  /** T0694: whether the agent of PTY `id` is in a turn (hook / OSC signals, see the file header). */
  isTurnActive(id: string): boolean {
    return this.turns.has(id)
  }

  /**
   * T0694: a turn started; a running one keeps its start. True when none was running.
   * T0791: `at` (a hook's, absent = unknown) — a running turn keeps the latest one (a later turn's
   * prompt may arrive before the previous turn's `Stop`).
   */
  private startTurn(id: string, cause: string, at?: bigint): boolean {
    const running = this.turns.get(id)
    if (running) {
      if (at !== undefined && (running.startedAt === undefined || at > running.startedAt)) running.startedAt = at
      return false
    }
    this.turns.set(id, { since: this.now(), timer: this.armTurnTimer(id, this.turnQuietEndMs()), ...(at !== undefined ? { startedAt: at } : {}) })
    this.logger?.log(`[turn] terminal=${id} → started (${cause})`)
    this.changed(id)
    return true
  }

  /**
   * T0791 / BUG-198: a claude `Stop` — ends the turn unless it happened before the current turn's
   * prompt (`at` earlier than `startedAt`: the previous turn's `Stop`, reported late). Without `at` on
   * either side it ends the turn as before. True when the turn ended.
   */
  private endTurnByStop(id: string, at?: bigint): boolean {
    const startedAt = this.turns.get(id)?.startedAt
    if (at !== undefined && startedAt !== undefined && at < startedAt) {
      this.logger?.log(`[turn] terminal=${id} kept: hook stop happened ${formatHookAtGap(startedAt - at)} before the current turn (reported late)`)
      return false
    }
    return this.endTurn(id, 'hook stop')
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
    this.permissionPrompts.clear()
    this.queuedKeptLogged.clear() // T0918
    this.blockedAt.clear() // T0790
    this.questionHooks.clear() // T0926
    this.answeredQuestions.clear() // T0926
    this.questionMenus.clear() // T0965
    this.started.clear()
    this.codexStates.clear()
    this.sessionIds.clear()
    this.hookOrigins.clear() // T0905
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
  reportHookEvent(id: string, event: HookReportEvent, toolName?: string, sessionId?: string, agentId?: string, at?: bigint): { result: HookReportResult; state: BlockedState | null } | null
  /** T0905: `PtyManager.acceptHookOrigin` (absent: every report is applied, as before T0905). */
  acceptHookOrigin?(id: string, origin?: HookOrigin, set?: number): boolean
}

/** T0905 (D328 R1′): what `onStop` gets of an applied `stop` report — never logged by the handler. */
export interface StopReport {
  /** claude's last assistant message (`last_assistant_message`, cut by the hook); absent = none sent. */
  message?: { text: string; truncated: boolean }
  /** The hook set version the report carried (absent = unknown). */
  set?: number
}

export interface ReportHookDeps {
  registerHandler(channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown): void
  getPtyManager(): ReportHookPtyManager | null
  logger: { log(...args: unknown[]): void }
  mirrorToBatScripts?(event: string, payload: Record<string, unknown>): void
  /**
   * T0905 (D328 R1′): an applied `stop` report of the caller's PTY (after the tracker). The Tower turn
   * cards (`TowerCardStore.offerHookStop`, electron/tower-cards.ts) keep the message only for a
   * contract-2 Tower. A throwing listener is logged; the answer is unchanged.
   */
  onStop?(terminalId: string, report: StopReport): void
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
 * T0790: `at` (`HOOK_AT_PATTERN`) — when the hook's process started; malformed → ignored, no error. A BAT
 * before T0790 ignores the field like any unknown one. Never answered, mirrored or logged as a value.
 * T0905: `origin` (`HOOK_ORIGINS`, else `injected`) / `set` (`parseHookSet`, else unknown) — a
 * `plugin` report after an `injected` one of the same PTY answers `{ ok: true, terminalId, result:
 * 'duplicate' }` and changes nothing. A `stop`'s `lastAssistantMessage` (a string ≤
 * `REPORT_HOOK_MESSAGE_MAX_CHARS`; anything else is ignored, no error) and `messageTruncated` go to
 * `onStop` only. A BAT before T0905 ignores all of them like any unknown field.
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
    // T0790: when the hook's process started; malformed → ignored, no error (as without it)
    const at = parseHookAt(opts.at)
    // T0905: which hook set sent it; malformed → ignored, no error
    const origin = parseHookOrigin(opts.origin)
    const set = parseHookSet(opts.set)
    const pm = deps.getPtyManager()
    if (!pm || !pm.isAlive(caller)) return fail(caller, event, 'NOT_FOUND')
    if (pm.acceptHookOrigin && !pm.acceptHookOrigin(caller, origin, set)) {
      mirror(caller, event, 'duplicate')
      return { ok: true, terminalId: caller, result: 'duplicate' }
    }
    const outcome = pm.reportHookEvent(caller, event as HookReportEvent, toolName, sessionId, agentId, at)
    if (!outcome) return fail(caller, event, 'NOT_FOUND')
    mirror(caller, event, outcome.result, sessionId, agentId)
    if (event === 'stop' && deps.onStop) {
      // T0905: the message goes on to the card store only (never logged / mirrored / answered here)
      const text = typeof opts.lastAssistantMessage === 'string' && opts.lastAssistantMessage.length <= REPORT_HOOK_MESSAGE_MAX_CHARS
        ? opts.lastAssistantMessage
        : undefined
      try {
        deps.onStop(caller, {
          ...(text !== undefined ? { message: { text, truncated: opts.messageTruncated === true } } : {}),
          ...(set !== undefined ? { set } : {}),
        })
      } catch (e) {
        deps.logger.log(`[tower-cards] onStop failed terminal=${caller}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return {
      ok: true,
      terminalId: caller,
      result: outcome.result,
      state: outcome.state ? 'blocked' : 'not-blocked',
      ...(outcome.state ? { blockedReason: outcome.state.reason } : {}),
    }
  })
}
