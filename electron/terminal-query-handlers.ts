/**
 * PLAN-047 M1 / T0582 (D149 / D152): read-only helper query channels — what an MCP shim (T0584)
 * or CT asks about terminals, over the RemoteServer, with the caller's PTY capability:
 *
 *   terminal:whoami       {}                                           → who the caller is
 *   terminal:list         { scope?: 'mine' | 'workspace' | 'towers' }  → terminals in its scope
 *   terminal:get-state    { terminalId? }                              → working / idle / blocked / exited
 *   terminal:read-output  { terminalId?, cursor?, maxLines? }          → plain screen text, masked
 *   terminal:wait         { terminalId?, until, fromState?, timeoutMs? } → long poll on the state
 *
 * Every answer is `{ ok: true, … }` or `{ ok: false, code, message? }` (INVALID_ARGS / NOT_FOUND /
 * NOT_OWNER, as `--close-worker`; `terminal:wait` also TOO_MANY_WAITS). The caller is the
 * capability the invoke came in with (`ctx.helper`, set by RemoteServer) — never a parameter;
 * `terminalId` defaults to the caller itself. The target scope is `authorizeHelperQueryTarget`
 * (electron/remote/helper-capability.ts). A server-token client (`ctx.helper` absent) is not
 * scoped, but must name `terminalId`.
 *
 * State: `working` = output within `TERMINAL_QUERY_IDLE_MS` (the `--close-worker` quiet time),
 * `idle` otherwise, `exited` = the PTY ended (`PtyManager.getExitedPty`, recent ones only).
 * T0590 (M1b-1): `blocked` = a claude hook reported the tab waits for the user
 * (electron/terminal-blocked-state.ts), with `blockedReason` / `blockedSince` / `source: 'hook'`;
 * precedence exited > blocked > working / idle. Every state answer carries `blockedDetection`
 * (`hook` / `none`): a `none` tab never reads a hook reason, so its `idle` says nothing about a prompt.
 * T0600 (D154): every state answer also carries `agentStarted` — `true` (the tab's claude ran its
 * `SessionStart` hook; + `agentStartedAt`, ms), `false` (`blockedDetection: hook`, not reported
 * yet), `null` (`blockedDetection: none`: cannot tell). `terminal:wait` `until: 'agent-started'`
 * ends when it is no longer `false` or the PTY exited.
 * PLAN-048 / T0607 (D156): `blocked` / `blockedReason: tower` / `source: 'question'` = the Worker has
 * a pending blocking question for its Tower (electron/tower-questions.ts, `getQuestionSummary`;
 * `blockedSince` = the oldest one's `createdAt`), whatever its `blockedDetection` (no hook needed);
 * precedence exited > a hook's blocked > blocked / tower > working / idle. Every state answer
 * carries `pendingQuestions` (blocking or not).
 * PLAN-047 M1b-2 / T0621 (D158): codex tabs — `blockedDetection: osc` (codex's OSC 7501,
 * electron/terminal-blocked-state.ts `observeCodexState`): `blocked` / `blockedReason: input` /
 * `source: 'osc'` (same rank as a hook reason, over `tower`); `agentStarted` true from the first
 * OSC 7501 (`false` before it, as `hook`).
 * PLAN-050 / T0642 (D167): `terminal:whoami`, every `terminal:list` row and `terminal:get-state`
 * carry `claudeSessionName` (the `--name` BAT injected at the tab's last launch,
 * electron/claude-session-name-record.ts; null = none injected) and `claudeSessionId` (the session
 * id its claude's last `SessionStart` hook sent; null = not reported / cannot be / unknown since BAT
 * reopened — 🔴 null does not mean there is no session). An exited tab keeps both.
 * PLAN-050 / T0643 (D167, relaxes D149): `terminal:list scope=towers` — a declared tower (as
 * `scope=workspace`, `authorizeHelperListScope`) lists the running declared towers of this host in
 * every workspace (`isTowersScopeMember`), itself too (`self: true`). Rows carry identification
 * only: `id` / `workspaceId` / `workspaceName` (`alias || name`; null = unknown, always on
 * headless) / `title` (Electron, when saved) / `claudeSessionName` / `state` / `alive` / `self` —
 * 🔴 never the session id, cwd, output, tower mode, work order or questions. get-state /
 * read-output / wait of those tabs stay NOT_OWNER. A BAT before T0643 answers INVALID_ARGS
 * (`message: 'scope'`).
 *
 * Output: the PTY's raw replay buffer (`pty:get-buffer`'s, or the tail kept at exit) → plain text
 * (`plainTextFromOutput`, T0566) → `redactTerminalSecrets` (src/lib/terminal-output-redaction.ts)
 * → lines. `cursor` is an offset into the PTY's whole output stream; see `readOutput`.
 *
 * Audit: one `[helper-query] channel=… caller=… target=… → ok|<code>` line per call (never the
 * output) + a `helper-query` event in bat-scripts.log.
 *
 * Electron main and headless bat-server register this same module (T0579 pattern).
 * 🔴 No `electron` import here (shared with headless).
 */
import { plainTextFromOutput } from '../src/lib/usage-limit'
import { redactTerminalSecrets } from '../src/lib/terminal-output-redaction'
import type { PtyReplayBuffer } from '../src/types'
import { CLOSE_WORKER_IDLE_MS } from './close-worker'
import type { CtMode } from './ct-mode'
import type { ExitedPtyRecord, PtyTerminalInfo } from './pty-manager'
import type { BlockedDetection, BlockedReason, BlockedState } from './terminal-blocked-state'
import type { HandlerContext } from './remote/handler-registry'
import type { QuestionSummary } from './tower-questions'
import {
  authorizeHelperListScope,
  authorizeHelperQueryTarget,
  HELPER_LIST_SCOPES,
  helperQueryRole,
  isTowersScopeMember,
  type HelperListScope,
  type HelperCapability,
  type HelperQueryAccess,
  type HelperQueryRole,
  type HelperQueryScopeContext,
} from './remote/helper-capability'

/** No output for this long ⇒ `idle` (the `--close-worker` quiet time; not a setting). */
export const TERMINAL_QUERY_IDLE_MS = CLOSE_WORKER_IDLE_MS
/** `terminal:read-output` `maxLines` default / ceiling. */
export const READ_OUTPUT_DEFAULT_LINES = 200
export const READ_OUTPUT_MAX_LINES = 1000
/**
 * A line still being printed (after the last raw `\n`) is read again next time, so a secret split
 * by the read is masked whole; past this many chars it is consumed as it is.
 */
export const READ_OUTPUT_PARTIAL_LINE_MAX_CHARS = 4096
/** `terminal:wait` `timeoutMs` default and ceiling. */
export const TERMINAL_WAIT_MAX_MS = 45_000
/** How often a `terminal:wait` looks at the state. */
export const TERMINAL_WAIT_POLL_MS = 250
/** `terminal:wait` calls one caller may have open at once. */
export const TERMINAL_WAIT_MAX_PER_CALLER = 8

export type TerminalQueryState = 'working' | 'idle' | 'blocked' | 'exited'
export type TerminalQueryErrorCode = 'INVALID_ARGS' | 'NOT_FOUND' | 'NOT_OWNER' | 'TOO_MANY_WAITS'
export type TerminalQueryFailure = { ok: false; code: TerminalQueryErrorCode; message?: string }

/** T0600: + `agent-started`. */
export type TerminalWaitUntil = 'state-change' | 'exit' | 'idle' | 'agent-started'

/** What the handlers need from PtyManager (the class satisfies it). */
export interface TerminalQueryPtyManager {
  listTerminalIds(): string[]
  getTerminalInfo(id: string): PtyTerminalInfo | null
  getExitedPty(id: string): ExitedPtyRecord | null
  listExitedPtyIds(): string[]
  getLastOutputAt(id: string): number | null
  getReplayBuffer(id: string): PtyReplayBuffer | null
  getTerminalRole(id: string): 'tower' | undefined
  /** T0590: what running PTY `id` is blocked on (null = not blocked). Absent ⇒ never blocked. */
  getBlockedState?(id: string): BlockedState | null
  /** T0590: `hook` / `none` (T0621: + `osc`; per id, outlives the PTY). Absent ⇒ `none`. */
  getBlockedDetection?(id: string): BlockedDetection
  /** T0600: when running PTY `id`'s claude ran `SessionStart` (ms), or null. Absent ⇒ never. */
  getAgentStartedAt?(id: string): number | null
  /** T0642: the session id running PTY `id`'s claude last sent, or null. Absent ⇒ never. */
  getClaudeSessionId?(id: string): string | null
}

/** Electron: what the window registry saved for a tab (title, workspace, its tower). */
export interface SavedTabInfo {
  title?: string
  workspaceId?: string
  towerTerminalId?: string
}

/**
 * Electron: saved tabs by id from window registry entries (a detached window's tabs are in its
 * parent's entry). The first tab wins when an id repeats.
 */
export function savedTabsFromRegistry(entries: ReadonlyArray<{ terminals?: unknown }>): Map<string, SavedTabInfo> {
  const tabs = new Map<string, SavedTabInfo>()
  for (const entry of entries) {
    if (!Array.isArray(entry?.terminals)) continue
    for (const t of entry.terminals as unknown[]) {
      if (!t || typeof t !== 'object') continue
      const { id, title, workspaceId, towerTerminalId } = t as Record<string, unknown>
      if (typeof id !== 'string' || !id || tabs.has(id)) continue
      tabs.set(id, {
        ...(typeof title === 'string' && title ? { title } : {}),
        ...(typeof workspaceId === 'string' && workspaceId ? { workspaceId } : {}),
        ...(typeof towerTerminalId === 'string' && towerTerminalId.trim() ? { towerTerminalId: towerTerminalId.trim() } : {}),
      })
    }
  }
  return tabs
}

/**
 * T0643: the name of workspace `workspaceId` in window registry entries — `alias || name`, the same
 * source as the claude session name (T0641); null when no entry has it.
 */
export function workspaceNameFromRegistry(entries: ReadonlyArray<{ workspaces?: unknown }>, workspaceId: string): string | null {
  for (const entry of entries) {
    if (!Array.isArray(entry?.workspaces)) continue
    for (const w of entry.workspaces as unknown[]) {
      if (!w || typeof w !== 'object') continue
      const { id, alias, name } = w as Record<string, unknown>
      if (id !== workspaceId) continue
      if (typeof alias === 'string' && alias) return alias
      return typeof name === 'string' && name ? name : null
    }
  }
  return null
}

export interface TerminalQueryDeps {
  registerHandler(channel: string, handler: (ctx: HandlerContext, ...args: unknown[]) => unknown): void
  getPtyManager(): TerminalQueryPtyManager | null
  /** The capability registry's `isWorkerOf` (a running Worker of that tower). */
  isWorkerOf(childId: string, towerId: string): boolean
  /** Electron: saved tabs by id (titles; workspace of a PTY the Terminal Server kept). Headless: none. */
  savedTabs?(): ReadonlyMap<string, SavedTabInfo>
  /** Secrets masked literally in `read-output` (the RemoteServer token). */
  knownSecrets?(): readonly string[]
  logger: { log(...args: unknown[]): void }
  mirrorToBatScripts?(event: string, payload: Record<string, unknown>): void
  /** T0607: the tower-question store's `summaryFor` (pending / blocking questions of a Worker). Absent ⇒ none. */
  getQuestionSummary?(terminalId: string): QuestionSummary
  /** T0642: the claude session name injected at the tab's last launch (`claudeSessionNameRecords`). Absent ⇒ null. */
  getClaudeSessionName?(terminalId: string): string | null
  /** T0643: a workspace's `alias || name` (`workspaceNameFromRegistry`). Absent (headless) ⇒ null. */
  getWorkspaceName?(workspaceId: string): string | null
  /** Tests. Default `Date.now` / `setTimeout` / `clearTimeout`. */
  now?(): number
  setTimer?(fn: () => void, ms: number): unknown
  clearTimer?(handle: unknown): void
}

const TERMINAL_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/
const CURSOR_PATTERN = /^\d{1,16}$/
const STATES: readonly TerminalQueryState[] = ['working', 'idle', 'blocked', 'exited']
const WAIT_UNTIL: readonly TerminalWaitUntil[] = ['state-change', 'exit', 'idle', 'agent-started']

function asOptions(raw: unknown): Record<string, unknown> | null {
  if (raw === undefined || raw === null) return {}
  return typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
}

function callerOf(ctx: HandlerContext): HelperCapability | null {
  const h = ctx.helper
  if (!h) return null
  return h.towerId ? { terminalId: h.terminalId, role: h.role, towerId: h.towerId } : { terminalId: h.terminalId, role: h.role }
}

/**
 * Screen lines of plain text: trailing blanks trimmed, runs of blank lines collapsed to one, none
 * at the start or the end (a TUI's cursor moves become many empty lines).
 */
export function screenLines(text: string): string[] {
  const out: string[] = []
  let blank = false
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line) {
      if (out.length > 0) blank = true
      continue
    }
    if (blank) out.push('')
    blank = false
    out.push(line)
  }
  return out
}

export interface ReadOutputResult {
  lines: string[]
  nextCursor: string
  /** The cursor's output is gone (scrolled out of the buffer, or the PTY was restarted). */
  truncated: boolean
  /** Lines dropped from the front for `maxLines`. */
  skippedLines: number
  /** The last line is still being printed; it comes again (whole) on the next read. */
  partialLine: boolean
  masked: number
}

/**
 * Reads `buf` from `cursor` (an offset into the PTY's whole output, `buf.total` = its end).
 * No cursor: the whole buffer. A cursor before the buffer's start or past its end → from the
 * start, `truncated`. `nextCursor` is past what was read, except a line still being printed
 * (`partialLine`) and an incomplete escape sequence, which the next read starts with.
 */
export function readOutput(
  buf: PtyReplayBuffer,
  opts: { cursor?: number; maxLines: number; knownSecrets?: readonly string[] },
): ReadOutputResult {
  const start = buf.total - buf.data.length
  let from = start
  let truncated = false
  if (opts.cursor !== undefined) {
    if (opts.cursor < start || opts.cursor > buf.total) truncated = true
    else from = opts.cursor
  }
  const raw = buf.data.slice(from - start)
  const { text, carry } = plainTextFromOutput(raw)
  const end = buf.total - carry.length
  let next = end
  let partialLine = false
  const nl = raw.lastIndexOf('\n')
  const partialStart = nl + 1
  const partialLength = raw.length - carry.length - partialStart
  if (partialLength > 0 && partialLength <= READ_OUTPUT_PARTIAL_LINE_MAX_CHARS) {
    const partial = plainTextFromOutput(raw.slice(partialStart, raw.length - carry.length)).text
    if (partial.trim() !== '') {
      next = from + partialStart
      partialLine = true
    }
  }
  const redacted = redactTerminalSecrets(text, opts.knownSecrets)
  let lines = screenLines(redacted.text)
  const skippedLines = Math.max(0, lines.length - opts.maxLines)
  if (skippedLines > 0) lines = lines.slice(skippedLines)
  return { lines, nextCursor: String(next), truncated, skippedLines, partialLine, masked: redacted.count }
}

interface StateSnapshot {
  state: TerminalQueryState
  lastOutputAt: number | null
  idleMs: number | null
  exitCode?: number
  exitedAt?: number
  /** T0590: `blocked` only. */
  blockedReason?: BlockedReason
  blockedSince?: number
  /**
   * `hook` for a hook's `blocked` (T0590), `osc` for codex's `blocked` / `input` (T0621),
   * `question` for `blocked` / `tower` (T0607), else `output`.
   */
  source: 'output' | 'hook' | 'osc' | 'question'
  blockedDetection: BlockedDetection
  /** T0607: pending questions this terminal asked its Tower (blocking or not). */
  pendingQuestions: number
  /**
   * T0600: true = `SessionStart` reported (T0621: or the first OSC 7501), false = not yet (`hook` /
   * `osc`), null = cannot tell (`none`).
   */
  agentStarted: boolean | null
  /** T0600: `agentStarted: true` only (ms). */
  agentStartedAt?: number
}

/** T0600: `agentStarted` / `agentStartedAt` of a state answer. */
export function agentStartedFields(detection: BlockedDetection, startedAt: number | null): Pick<StateSnapshot, 'agentStarted' | 'agentStartedAt'> {
  if (startedAt !== null) return { agentStarted: true, agentStartedAt: startedAt }
  return { agentStarted: detection === 'hook' || detection === 'osc' ? false : null }
}

/** T0642: `claudeSessionName` / `claudeSessionId` of whoami / list / get-state. */
export interface ClaudeSessionFields {
  claudeSessionName: string | null
  claudeSessionId: string | null
}

export interface TerminalQueryHandlers {
  /** Ends every open `terminal:wait` (answers `changed: false`); server stop / app quit. */
  dispose(): void
}

/**
 * Registers the five channels on `deps.registerHandler` (Electron main / headless alike).
 */
export function registerTerminalQueryHandlers(deps: TerminalQueryDeps): TerminalQueryHandlers {
  const registerHandler = deps.registerHandler
  const now = deps.now ?? (() => Date.now())
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  /** Open waits: caller key → count; every open wait's finisher (dispose). */
  const waitsByCaller = new Map<string, number>()
  const openWaits = new Set<() => void>()

  const callerLabel = (ctx: HandlerContext): string =>
    ctx.helper ? ctx.helper.terminalId : ctx.connectionId ? `client:${ctx.connectionId}` : 'local'

  const audit = (channel: string, ctx: HandlerContext, target: string, result: string): void => {
    const caller = callerLabel(ctx)
    deps.logger.log(`[helper-query] channel=${channel} caller=${caller} target=${target} → ${result}`)
    deps.mirrorToBatScripts?.('helper-query', {
      channel,
      caller,
      ...(ctx.helper ? { callerRole: ctx.helper.role } : {}),
      target,
      result,
    })
  }

  const fail = (channel: string, ctx: HandlerContext, target: string, code: TerminalQueryErrorCode, message?: string): TerminalQueryFailure => {
    audit(channel, ctx, target, message ? `${code} (${message})` : code)
    return message ? { ok: false, code, message } : { ok: false, code }
  }

  const scope = (pm: TerminalQueryPtyManager): HelperQueryScopeContext => ({
    isWorkerOf(childId, towerId) {
      if (pm.getTerminalInfo(childId)) return deps.isWorkerOf(childId, towerId)
      return pm.getExitedPty(childId)?.towerTerminalId === towerId && childId !== towerId
    },
    getTerminalRole: id => pm.getTerminalRole(id),
  })

  const stateOf = (pm: TerminalQueryPtyManager, id: string): StateSnapshot | null => {
    const t = now()
    const blockedDetection: BlockedDetection = pm.getBlockedDetection?.(id) ?? 'none'
    const questions: QuestionSummary = deps.getQuestionSummary?.(id) ?? { pending: 0, blockingSince: null }
    const pendingQuestions = questions.pending
    if (pm.getTerminalInfo(id)) {
      const last = pm.getLastOutputAt(id)
      const idleMs = last === null ? null : Math.max(0, t - last)
      const blocked = pm.getBlockedState?.(id) ?? null
      const started = agentStartedFields(blockedDetection, pm.getAgentStartedAt?.(id) ?? null)
      // a hook reason (T0621: or codex's `input`) first: the user has to act on it, the Tower cannot
      if (blocked) {
        return {
          state: 'blocked',
          lastOutputAt: last,
          idleMs,
          blockedReason: blocked.reason,
          blockedSince: blocked.since,
          source: blocked.source ?? 'hook',
          blockedDetection,
          pendingQuestions,
          ...started,
        }
      }
      // T0607: waiting for its Tower's answer — BAT knows it without a hook, so `none` tabs too
      if (questions.blockingSince !== null) {
        return {
          state: 'blocked',
          lastOutputAt: last,
          idleMs,
          blockedReason: 'tower',
          blockedSince: questions.blockingSince,
          source: 'question',
          blockedDetection,
          pendingQuestions,
          ...started,
        }
      }
      return {
        state: idleMs !== null && idleMs < TERMINAL_QUERY_IDLE_MS ? 'working' : 'idle',
        lastOutputAt: last,
        idleMs,
        source: 'output',
        blockedDetection,
        pendingQuestions,
        ...started,
      }
    }
    const record = pm.getExitedPty(id)
    if (!record) return null
    return {
      state: 'exited',
      lastOutputAt: record.lastOutputAt,
      idleMs: record.lastOutputAt === null ? null : Math.max(0, t - record.lastOutputAt),
      ...(record.exitCode !== undefined ? { exitCode: record.exitCode } : {}),
      exitedAt: record.exitedAt,
      source: 'output',
      blockedDetection,
      pendingQuestions,
      ...agentStartedFields(blockedDetection, record.agentStartedAt ?? null),
    }
  }

  const claudeSessionNameOf = (id: string): string | null => {
    try {
      return deps.getClaudeSessionName?.(id) ?? null
    } catch {
      return null
    }
  }

  /** T0642: running → the PTY's; exited → its record's. */
  const claudeSessionOf = (pm: TerminalQueryPtyManager, id: string): ClaudeSessionFields => {
    const claudeSessionName = claudeSessionNameOf(id)
    const claudeSessionId = pm.getTerminalInfo(id)
      ? pm.getClaudeSessionId?.(id) ?? null
      : pm.getExitedPty(id)?.claudeSessionId ?? null
    return { claudeSessionName, claudeSessionId }
  }

  const savedTab = (id: string): SavedTabInfo | undefined => {
    try {
      return deps.savedTabs?.().get(id)
    } catch {
      return undefined
    }
  }

  const workspaceOf = (pm: TerminalQueryPtyManager, id: string): string | undefined =>
    pm.getTerminalInfo(id)?.workspaceId ?? pm.getExitedPty(id)?.workspaceId ?? savedTab(id)?.workspaceId

  const workspaceNameOf = (workspaceId: string | undefined): string | null => {
    if (!workspaceId) return null
    try {
      return deps.getWorkspaceName?.(workspaceId) ?? null
    } catch {
      return null
    }
  }

  /** A listed terminal's role: dispatched by a tower → worker; declared → tower; else shell. */
  const roleOf = (pm: TerminalQueryPtyManager, id: string): HelperQueryRole => {
    const info = pm.getTerminalInfo(id)
    if (info?.towerTerminalId || (!info && pm.getExitedPty(id)?.towerTerminalId)) return 'worker'
    if (info?.role === 'tower') return 'tower'
    return savedTab(id)?.towerTerminalId ? 'worker' : 'shell'
  }

  /**
   * The target of a call: `terminalId` (validated) or the caller itself; a server-token client
   * must name one. Then it must exist, then be in the caller's scope.
   */
  const resolveTarget = (
    channel: string,
    ctx: HandlerContext,
    opts: Record<string, unknown>,
    access: HelperQueryAccess,
  ): { pm: TerminalQueryPtyManager; caller: HelperCapability | null; target: string } | TerminalQueryFailure => {
    const caller = callerOf(ctx)
    let target: string
    if (opts.terminalId !== undefined && opts.terminalId !== null) {
      if (typeof opts.terminalId !== 'string' || !TERMINAL_ID_PATTERN.test(opts.terminalId.trim())) {
        return fail(channel, ctx, '-', 'INVALID_ARGS', 'terminalId')
      }
      target = opts.terminalId.trim()
    } else if (caller) {
      target = caller.terminalId
    } else {
      return fail(channel, ctx, '-', 'INVALID_ARGS', 'terminalId is required without a helper capability')
    }
    const pm = deps.getPtyManager()
    if (!pm || (!pm.getTerminalInfo(target) && !pm.getExitedPty(target))) return fail(channel, ctx, target, 'NOT_FOUND')
    const decision = authorizeHelperQueryTarget(caller, target, access, scope(pm))
    if (!decision.ok) return fail(channel, ctx, target, decision.code)
    return { pm, caller, target }
  }

  registerHandler('terminal:whoami', (ctx: HandlerContext, raw?: unknown) => {
    const channel = 'terminal:whoami'
    const opts = asOptions(raw)
    if (!opts) return fail(channel, ctx, '-', 'INVALID_ARGS')
    // A helper is who its capability says; a parameter never changes that.
    const resolved = resolveTarget(channel, ctx, ctx.helper ? {} : opts, 'metadata')
    if ('ok' in resolved) return resolved
    const { pm, caller, target } = resolved
    const info = pm.getTerminalInfo(target)
    if (!info) return fail(channel, ctx, target, 'NOT_FOUND', 'the terminal has exited')
    const role: HelperQueryRole = caller ? helperQueryRole(caller, scope(pm)) : roleOf(pm, target)
    const towerTerminalId = caller?.role === 'worker' ? caller.towerId : info.towerTerminalId
    const workspaceId = workspaceOf(pm, target)
    const towerMode: CtMode | undefined = info.towerMode
    audit(channel, ctx, target, 'ok')
    return {
      ok: true,
      terminalId: target,
      ...(workspaceId ? { workspaceId } : {}),
      role,
      ...(towerTerminalId ? { towerTerminalId } : {}),
      ...(info.workorder ? { workorder: info.workorder } : {}),
      yolo: info.yolo,
      ...(towerMode ? { towerMode } : {}),
      ...(info.agentPreset && info.agentPreset !== 'none' ? { agent: info.agentPreset } : {}),
      ...(info.cwd ? { cwd: info.cwd } : {}),
      ...claudeSessionOf(pm, target), // T0642
    }
  })

  registerHandler('terminal:list', (ctx: HandlerContext, raw?: unknown) => {
    const channel = 'terminal:list'
    const opts = asOptions(raw)
    if (!opts) return fail(channel, ctx, '-', 'INVALID_ARGS')
    const rawScope = opts.scope === undefined || opts.scope === null ? 'mine' : opts.scope
    if (!(HELPER_LIST_SCOPES as readonly unknown[]).includes(rawScope)) return fail(channel, ctx, '-', 'INVALID_ARGS', 'scope')
    const listScope = rawScope as HelperListScope
    const pm = deps.getPtyManager()
    const caller = callerOf(ctx)
    if (!pm) return fail(channel, ctx, `scope=${listScope}`, 'NOT_FOUND')
    const sc = scope(pm)
    if (!authorizeHelperListScope(caller, listScope, sc).ok) {
      return fail(channel, ctx, `scope=${listScope}`, 'NOT_OWNER', `scope=${listScope} needs a declared tower (--set-role tower)`)
    }
    if (listScope === 'towers') {
      // T0643: identification only — never claudeSessionId / cwd / output / towerMode / workorder
      const towers = pm.listTerminalIds().flatMap(id => {
        if (!pm.getTerminalInfo(id) || !isTowersScopeMember(id, sc)) return []
        const state = stateOf(pm, id)
        if (!state) return []
        const workspaceId = workspaceOf(pm, id) ?? null
        const title = savedTab(id)?.title
        return [{
          id,
          workspaceId,
          workspaceName: workspaceNameOf(workspaceId ?? undefined),
          ...(title ? { title } : {}),
          claudeSessionName: claudeSessionNameOf(id),
          state: state.state,
          alive: true,
          self: caller?.terminalId === id,
        }]
      })
      audit(channel, ctx, `scope=${listScope}`, `ok count=${towers.length}`)
      return { ok: true, scope: listScope, terminals: towers }
    }
    const all = [...new Set([...pm.listTerminalIds(), ...pm.listExitedPtyIds()])]
    let ids: string[]
    if (!caller) {
      ids = all
    } else {
      const mine = new Set(all.filter(id => authorizeHelperQueryTarget(caller, id, 'metadata', sc).ok))
      if (listScope === 'workspace') {
        const ws = workspaceOf(pm, caller.terminalId)
        if (ws) for (const id of all) if (workspaceOf(pm, id) === ws) mine.add(id)
      }
      ids = all.filter(id => mine.has(id))
    }
    const terminals = ids.flatMap(id => {
      const state = stateOf(pm, id)
      if (!state) return []
      const info = pm.getTerminalInfo(id)
      const record = info ? null : pm.getExitedPty(id)
      const workorder = info?.workorder ?? record?.workorder
      const towerTerminalId = info?.towerTerminalId ?? record?.towerTerminalId ?? savedTab(id)?.towerTerminalId
      const title = savedTab(id)?.title
      return [{
        id,
        role: roleOf(pm, id),
        ...(workorder ? { workorder } : {}),
        ...(towerTerminalId ? { towerTerminalId } : {}),
        ...(title ? { title } : {}),
        state: state.state,
        ...(state.blockedReason ? { blockedReason: state.blockedReason } : {}),
        blockedDetection: state.blockedDetection,
        agentStarted: state.agentStarted,
        pendingQuestions: state.pendingQuestions, // T0607
        ...claudeSessionOf(pm, id), // T0642
        alive: info !== null,
      }]
    })
    audit(channel, ctx, `scope=${listScope}`, `ok count=${terminals.length}`)
    return { ok: true, scope: listScope, terminals }
  })

  registerHandler('terminal:get-state', (ctx: HandlerContext, raw?: unknown) => {
    const channel = 'terminal:get-state'
    const opts = asOptions(raw)
    if (!opts) return fail(channel, ctx, '-', 'INVALID_ARGS')
    const resolved = resolveTarget(channel, ctx, opts, 'metadata')
    if ('ok' in resolved) return resolved
    const state = stateOf(resolved.pm, resolved.target)
    if (!state) return fail(channel, ctx, resolved.target, 'NOT_FOUND')
    audit(channel, ctx, resolved.target, `ok state=${state.state}${state.blockedReason ? ` reason=${state.blockedReason}` : ''}`)
    return { ok: true, terminalId: resolved.target, ...state, ...claudeSessionOf(resolved.pm, resolved.target) }
  })

  registerHandler('terminal:read-output', (ctx: HandlerContext, raw?: unknown) => {
    const channel = 'terminal:read-output'
    const opts = asOptions(raw)
    if (!opts) return fail(channel, ctx, '-', 'INVALID_ARGS')
    let cursor: number | undefined
    if (opts.cursor !== undefined && opts.cursor !== null) {
      if (typeof opts.cursor !== 'string' || !CURSOR_PATTERN.test(opts.cursor)) return fail(channel, ctx, '-', 'INVALID_ARGS', 'cursor')
      cursor = Number(opts.cursor)
    }
    let maxLines = READ_OUTPUT_DEFAULT_LINES
    if (opts.maxLines !== undefined && opts.maxLines !== null) {
      if (typeof opts.maxLines !== 'number' || !Number.isInteger(opts.maxLines) || opts.maxLines < 1) {
        return fail(channel, ctx, '-', 'INVALID_ARGS', 'maxLines')
      }
      maxLines = Math.min(opts.maxLines, READ_OUTPUT_MAX_LINES)
    }
    const resolved = resolveTarget(channel, ctx, opts, 'output')
    if ('ok' in resolved) return resolved
    const { pm, target } = resolved
    const buf = pm.getTerminalInfo(target) ? pm.getReplayBuffer(target) : pm.getExitedPty(target)?.tail ?? null
    const state = stateOf(pm, target)
    if (!buf || !state) return fail(channel, ctx, target, 'NOT_FOUND')
    let secrets: readonly string[] = []
    try {
      secrets = deps.knownSecrets?.() ?? []
    } catch { /* masked by pattern only */ }
    const result = readOutput(buf, { cursor, maxLines, knownSecrets: secrets })
    audit(channel, ctx, target, `ok lines=${result.lines.length} masked=${result.masked}${result.truncated ? ' truncated' : ''}`)
    return { ok: true, terminalId: target, ...result, state: state.state }
  })

  registerHandler('terminal:wait', (ctx: HandlerContext, raw?: unknown) => {
    const channel = 'terminal:wait'
    const opts = asOptions(raw)
    if (!opts) return fail(channel, ctx, '-', 'INVALID_ARGS')
    const until = opts.until
    if (typeof until !== 'string' || !(WAIT_UNTIL as readonly string[]).includes(until)) return fail(channel, ctx, '-', 'INVALID_ARGS', 'until')
    let fromState: TerminalQueryState | undefined
    if (opts.fromState !== undefined && opts.fromState !== null) {
      if (typeof opts.fromState !== 'string' || !(STATES as readonly string[]).includes(opts.fromState)) {
        return fail(channel, ctx, '-', 'INVALID_ARGS', 'fromState')
      }
      fromState = opts.fromState as TerminalQueryState
    }
    let timeoutMs = TERMINAL_WAIT_MAX_MS
    if (opts.timeoutMs !== undefined && opts.timeoutMs !== null) {
      if (typeof opts.timeoutMs !== 'number' || !Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 0) {
        return fail(channel, ctx, '-', 'INVALID_ARGS', 'timeoutMs')
      }
      timeoutMs = Math.min(Math.floor(opts.timeoutMs), TERMINAL_WAIT_MAX_MS)
    }
    const resolved = resolveTarget(channel, ctx, opts, 'output')
    if ('ok' in resolved) return resolved
    const { pm, target } = resolved
    const initial = stateOf(pm, target)
    if (!initial) return fail(channel, ctx, target, 'NOT_FOUND')
    const baseline = fromState ?? initial.state
    const met = (s: StateSnapshot): boolean =>
      until === 'exit' ? s.state === 'exited'
        : until === 'idle' ? s.state !== 'working'
          : until === 'agent-started' ? s.agentStarted !== false || s.state === 'exited'
            : s.state !== baseline

    const key = callerLabel(ctx)
    const open = waitsByCaller.get(key) ?? 0
    if (open >= TERMINAL_WAIT_MAX_PER_CALLER) {
      return fail(channel, ctx, target, 'TOO_MANY_WAITS', `at most ${TERMINAL_WAIT_MAX_PER_CALLER} open waits per caller`)
    }
    const startedAt = now()
    const answer = (s: StateSnapshot, changed: boolean) => {
      audit(channel, ctx, target, `ok until=${until} changed=${changed} state=${s.state}${until === 'agent-started' ? ` agentStarted=${s.agentStarted}` : ''}`)
      return { ok: true as const, terminalId: target, changed, ...s, waitedMs: Math.max(0, now() - startedAt) }
    }
    if (met(initial)) return answer(initial, true)
    if (timeoutMs === 0) return answer(initial, false)

    waitsByCaller.set(key, open + 1)
    return new Promise(resolve => {
      let timer: unknown = null
      let done = false
      const finish = (value: unknown) => {
        if (done) return
        done = true
        if (timer !== null) clearTimer(timer)
        openWaits.delete(stop)
        const left = (waitsByCaller.get(key) ?? 1) - 1
        if (left > 0) waitsByCaller.set(key, left)
        else waitsByCaller.delete(key)
        resolve(value)
      }
      const stop = () => {
        const current = stateOf(pm, target) ?? initial
        finish(answer(current, false))
      }
      openWaits.add(stop)
      const tick = () => {
        timer = null
        const current = deps.getPtyManager() === pm ? stateOf(pm, target) : null
        if (!current) {
          finish(fail(channel, ctx, target, 'NOT_FOUND', 'the terminal is no longer known'))
          return
        }
        if (met(current)) {
          finish(answer(current, true))
          return
        }
        const left = startedAt + timeoutMs - now()
        if (left <= 0) {
          finish(answer(current, false))
          return
        }
        timer = setTimer(tick, Math.min(TERMINAL_WAIT_POLL_MS, left))
      }
      timer = setTimer(tick, Math.min(TERMINAL_WAIT_POLL_MS, timeoutMs))
    })
  })

  return {
    dispose() {
      for (const stop of [...openWaits]) stop()
    },
  }
}
