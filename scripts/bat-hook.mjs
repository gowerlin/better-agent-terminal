#!/usr/bin/env node
// scripts/bat-hook.mjs
// PLAN-047 M1b-1 / T0590: a claude hook of a BAT tab. BAT injects it into claude-cli tabs
// (`--settings=<dataDir>/bat-mcp/claude-settings.json`, electron/bat-mcp-launch.ts):
//
//   PermissionRequest                          → bat-hook.mjs permission-request
//   PreToolUse (matcher AskUserQuestion)       → bat-hook.mjs ask-user-question
//   Notification (elicitation_dialog / _url_)  → bat-hook.mjs elicitation
//   PostToolUse (matcher AskUserQuestion, async) → bat-hook.mjs ask-user-question-done (T0594)
//   ElicitationResult (async, T0620)           → bat-hook.mjs elicitation-done
//   Notification (elicitation_response, async) → bat-hook.mjs elicitation-done (T0620)
//   PostToolBatch (async, T0657)               → bat-hook.mjs post-tool-batch (clears a permission
//                                                prompt answered without the keyboard)
//   UserPromptSubmit (async)                   → bat-hook.mjs user-prompt-submit
//   Stop (async)                               → bat-hook.mjs stop
//   SessionStart (async, T0600)                → bat-hook.mjs session-start (`agentStarted`;
//                                                `source` is not sent; T0642: + `sessionId`)
//
// It reads claude's hook JSON from stdin (only `hook_event_name` / `tool_name` /
// `notification_type`; T0642: + `session_id` of a SessionStart; T0657: + `agent_id` of a
// PermissionRequest / PostToolBatch, read from the fields before `tool_input` / `tool_calls`), sends one `terminal:report-hook` to the tab's BAT with the tab's own
// capability (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN; certificate pinning and frame-id matching of
// scripts/bat-mcp.mjs `BatConnection`) and ends.
//
// 🔴 It must never change what claude does: exit 0 always, nothing on stdout (a PermissionRequest /
// PreToolUse hook printing JSON would decide for the user), silent on any failure, done within
// HOOK_DEADLINE_MS. It sends the event name, (permission prompts only) the tool name, (T0642,
// SessionStart only) the session id when it is a UUID and (T0657, permission prompts / tool batches
// only) the subagent id — never tool_input / tool_response / tool_calls, `source`,
// `transcript_path`, `cwd`, an elicitation's content / action, a prompt, a message (T0905: except
// the `Stop` hook's `last_assistant_message`, below) or a token. Outside BAT (no BAT_REMOTE_*) it exits at once.
//
// T0790 / BUG-197: + `at`, a time value only — when this process started (`hookStartedAt`), so BAT can
// tell a report that arrived late (claude runs every hook as its own process) from a newer one.
//
// PLAN-068 W3 / T0905 (D328 R1′): `stop` also sends claude's `last_assistant_message` (only that
// event reads the field; cut to `LAST_MESSAGE_MAX_BYTES` UTF-8 bytes before sending, `messageTruncated`
// when cut) for the Tower turn cards. BAT keeps it only for a Tower tab that declared BAT ↔ CT
// contract 2 and drops it for every other tab (electron/tower-cards.ts); this script never logs it
// (the log has its length only). A `stop` report also carries `origin` (`injected`: BAT's `--settings`
// hooks; W9's `bat-hooks` plugin sends `plugin`; BAT reads an absent one as `injected`, so every other
// report is sent exactly as before) and `set` (`BAT_HOOK_SET`, the hook set version).
//
// PLAN-068 W9 / T0910 (T0902 §7.3 / §7.6): `session-start` carries `origin` / `set` too (the `--set-role`
// `hooks:` line wants the set before the first `Stop`). The `bat-hooks` Claude Code plugin
// (plugins/bat-hooks/) runs this script through its launcher with `<event> --hook-list <n>`: every
// report of that run says `origin: plugin` and `set: <n>` (the plugin's event list version; BAT compares
// it with its own `BAT_HOOK_SET` → `plugin-outdated`). Every rule above applies to it unchanged.
//
// Zero external dependencies — Node.js 18+ built-in modules only.

import { realpathSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve } from 'path'
import { logEvent } from './_bat-logger.mjs'
import { BatConnection } from './bat-mcp.mjs'

/** Hard end of the process, whatever is still pending. */
export const HOOK_DEADLINE_MS = 1800
/** How long stdin is read (claude writes the JSON and closes it at once). */
export const STDIN_TIMEOUT_MS = 300
export const STDIN_MAX_BYTES = 256 * 1024
/** Connect + auth + the invoke. */
export const CONNECT_TIMEOUT_MS = 1000
export const INVOKE_TIMEOUT_MS = 1000

export const HOOK_EVENTS = ['permission-request', 'ask-user-question', 'ask-user-question-done', 'elicitation', 'elicitation-done', 'post-tool-batch', 'user-prompt-submit', 'stop', 'session-start']
const ELICITATION_TYPES = ['elicitation_dialog', 'elicitation_url_dialog']
/** T0620: the Notification type `elicitation-done` is wired to. */
const ELICITATION_DONE_TYPE = 'elicitation_response'
/** claude hook_event_name(s) each event is wired to (a mismatch = not ours to report). */
const HOOK_EVENT_NAMES = {
  'permission-request': ['PermissionRequest'],
  'ask-user-question': ['PreToolUse'],
  'ask-user-question-done': ['PostToolUse'],
  elicitation: ['Notification'],
  'elicitation-done': ['ElicitationResult', 'Notification'],
  'post-tool-batch': ['PostToolBatch'],
  'user-prompt-submit': ['UserPromptSubmit'],
  stop: ['Stop'],
  'session-start': ['SessionStart'],
}
const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/
/** T0657: claude's subagent id (`agent_id`, absent on the main thread); same rule as a tool name. */
export const AGENT_ID_PATTERN = TOOL_NAME_PATTERN
/**
 * PLAN-068 W3 / T0905: the version of BAT's hook set — equal to `BAT_HOOK_SET` of
 * electron/bat-mcp-launch.ts (beside `BAT_CLAUDE_HOOKS`; a test guards it). 2 = `stop` sends the last
 * assistant message.
 */
export const BAT_HOOK_SET = 2
/** T0905: where a report comes from — BAT's injected `--settings` hooks (this script run by them). */
export const HOOK_ORIGIN_INJECTED = 'injected'
/** PLAN-068 W9 / T0910: … or the `bat-hooks` Claude Code plugin's launcher (`--hook-list <n>`). */
export const HOOK_ORIGIN_PLUGIN = 'plugin'
/** T0910: the largest `--hook-list` accepted (the host's `HOOK_SET_MAX`). */
export const HOOK_LIST_MAX = 1000
/** T0910: events whose injected report carries `origin` / `set` (T0905: `stop`; T0910: + `session-start`). */
export const ORIGIN_REPORT_EVENTS = ['stop', 'session-start']

/**
 * T0910: `origin` / `set` of one run, from the arguments after the event. The `bat-hooks` plugin's
 * launcher passes `--hook-list <n>` (its own event list version): `plugin` + `set: n` on **every** event
 * (an absent origin reads as `injected` and would drop the plugin's later reports, T0905 §7.4); a
 * malformed `<n>` → `plugin` without `set`. BAT's injected hooks pass nothing: `injected` + `BAT_HOOK_SET`
 * on `ORIGIN_REPORT_EVENTS` only — every other injected report is sent exactly as before T0910.
 */
export function reportOrigin(event, args = []) {
  const at = args.indexOf('--hook-list')
  if (at !== -1) {
    const raw = args[at + 1]
    const n = typeof raw === 'string' && /^[0-9]{1,4}$/.test(raw) ? Number(raw) : NaN
    return Number.isSafeInteger(n) && n >= 1 && n <= HOOK_LIST_MAX ? { origin: HOOK_ORIGIN_PLUGIN, set: n } : { origin: HOOK_ORIGIN_PLUGIN }
  }
  return ORIGIN_REPORT_EVENTS.includes(event) ? { origin: HOOK_ORIGIN_INJECTED, set: BAT_HOOK_SET } : {}
}
/** T0905 (D328 R1′): the last assistant message is cut to this many UTF-8 bytes before it is sent. */
export const LAST_MESSAGE_MAX_BYTES = 16 * 1024

/**
 * T0905: `text` cut to at most `maxBytes` UTF-8 bytes on a character boundary →
 * `{ text, truncated }`. Never throws.
 */
export function truncateUtf8(text, maxBytes = LAST_MESSAGE_MAX_BYTES) {
  const buf = Buffer.from(text, 'utf8')
  if (buf.length <= maxBytes) return { text, truncated: false }
  let end = maxBytes
  // a continuation byte (10xxxxxx) at the cut: back off to the start of that character
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--
  return { text: buf.subarray(0, end).toString('utf8'), truncated: true }
}
/**
 * T0657: the first field of claude's hook JSON that is never needed; only what comes before it is
 * read (claude puts `session_id` … `agent_id` … `hook_event_name` / `tool_name` first, then the
 * tool's input / the batch, which can be megabytes).
 */
export const HOOK_INPUT_STOP_FIELDS = { 'permission-request': 'tool_input', 'post-tool-batch': 'tool_calls' }
/** T0642 (D167): a claude session id as sent (anything else is not sent). */
export const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * T0790 / BUG-197: when this hook process started, as `process.hrtime` ns (a decimal string; BigInt does
 * not survive JSON), or undefined. `process.hrtime` is the host's monotonic clock (libuv `uv_hrtime`:
 * QueryPerformanceCounter on Windows, CLOCK_MONOTONIC on Linux, mach_absolute_time on macOS), the same
 * counter in every process of the host — never the wall clock (BUG-171: NTP moves it). The process start
 * (`hrtime - uptime`; node's uptime counts from its own start on the same clock), not the time this line
 * runs: module loading varies by tens of ms between two hook processes (T0790 measured on Windows: a
 * second process spawned 0–5 ms later read an earlier script time in 83 of 90 pairs, an earlier process
 * start in 0 of 90).
 */
export function hookStartedAt(hrtime = () => process.hrtime.bigint(), uptime = () => process.uptime()) {
  try {
    const at = hrtime() - BigInt(Math.round(uptime() * 1e9))
    return at > 0n ? String(at) : undefined
  } catch {
    return undefined
  }
}

/**
 * What to report for `event` given claude's hook input (already parsed; null = none / unreadable):
 * `{ event, toolName? }` (T0642: `{ event: 'session-start', sessionId? }`), or null = report nothing (unknown event, the input names another hook,
 * a Notification that is not an elicitation / an elicitation response, a PreToolUse / PostToolUse of
 * another tool).
 * T0657: + `agentId` (a valid `agent_id`) of `permission-request` / `post-tool-batch`. A
 * `post-tool-batch` is reported only from a readable PostToolBatch input with no / a valid
 * `agent_id`: one that cannot be told apart must not clear the main thread's prompt.
 * T0905: `stop` + `lastAssistantMessage` (a non-blank `last_assistant_message`, cut to
 * `LAST_MESSAGE_MAX_BYTES`) and `messageTruncated: true` when it was cut; no other event reads it.
 */
export function hookReport(event, input) {
  if (!HOOK_EVENTS.includes(event)) return null
  const fields = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const name = typeof fields.hook_event_name === 'string' ? fields.hook_event_name : null
  if (name && !HOOK_EVENT_NAMES[event].includes(name)) return null
  if (event === 'elicitation' && typeof fields.notification_type === 'string' && !ELICITATION_TYPES.includes(fields.notification_type)) return null
  if (event === 'elicitation-done' && name !== 'ElicitationResult' && typeof fields.notification_type === 'string' && fields.notification_type !== ELICITATION_DONE_TYPE) return null
  if ((event === 'ask-user-question' || event === 'ask-user-question-done') && typeof fields.tool_name === 'string' && fields.tool_name !== 'AskUserQuestion') return null
  const agentId = typeof fields.agent_id === 'string' && AGENT_ID_PATTERN.test(fields.agent_id) ? fields.agent_id : undefined
  if (event === 'post-tool-batch') {
    if (name !== 'PostToolBatch' || (fields.agent_id !== undefined && agentId === undefined)) return null
    return agentId ? { event, agentId } : { event }
  }
  if (event === 'permission-request') {
    const toolName = typeof fields.tool_name === 'string' && TOOL_NAME_PATTERN.test(fields.tool_name) ? fields.tool_name : undefined
    return { event, ...(toolName ? { toolName } : {}), ...(agentId ? { agentId } : {}) }
  }
  if (event === 'session-start' && typeof fields.session_id === 'string' && SESSION_ID_PATTERN.test(fields.session_id)) {
    return { event, sessionId: fields.session_id }
  }
  if (event === 'stop' && typeof fields.last_assistant_message === 'string' && fields.last_assistant_message.trim() !== '') {
    const cut = truncateUtf8(fields.last_assistant_message)
    return { event, lastAssistantMessage: cut.text, ...(cut.truncated ? { messageTruncated: true } : {}) }
  }
  return { event }
}

/**
 * T0657: the hook JSON up to its top-level field `stopField` (exclusive) as an object, or null (not
 * there yet / not parseable). JSON escapes every `"` inside a string, so `,"<field>":` matches a key.
 */
export function hookInputPrefix(text, stopField) {
  const match = new RegExp(`,\\s*"${stopField}"\\s*:`).exec(text)
  if (!match) return null
  try {
    const value = JSON.parse(`${text.slice(0, match.index)}}`)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

/**
 * stdin as JSON, or null (no stdin, a TTY, too long, not JSON, timeout). T0657: with `stopField`,
 * reading ends as soon as the fields before it parse (`hookInputPrefix`); otherwise as before.
 */
export function readHookInput(stream = process.stdin, timeoutMs = STDIN_TIMEOUT_MS, stopField = undefined) {
  return new Promise(resolveInput => {
    if (!stream || stream.isTTY) {
      resolveInput(null)
      return
    }
    const chunks = []
    let size = 0
    let done = false
    const finish = (value) => {
      if (done) return
      done = true
      clearTimeout(timer)
      stream.removeAllListeners('data')
      stream.removeAllListeners('end')
      stream.removeAllListeners('error')
      try { stream.pause() } catch { /* ignore */ }
      resolveInput(value)
    }
    const parse = () => {
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return null }
    }
    const timer = setTimeout(() => finish(parse()), timeoutMs)
    stream.on('data', (chunk) => {
      size += chunk.length
      if (size > STDIN_MAX_BYTES && !stopField) {
        finish(null)
        return
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
      if (stopField) {
        // T0657: the fields before the stop field may arrive with the start of a huge batch
        const prefix = hookInputPrefix(Buffer.concat(chunks).toString('utf8'), stopField)
        if (prefix || size > STDIN_MAX_BYTES) finish(prefix)
      }
    })
    stream.on('end', () => finish(parse()))
    stream.on('error', () => finish(null))
  })
}

/**
 * One report. `{ result, code?, sessionId?, agentId?, messageBytes?, durationMs }` (`sessionId`: the one sent, for
 * the log's first 8 characters; T0657: `agentId`, the one sent; T0905: `messageBytes`, the UTF-8 length of
 * the last assistant message sent — the log's only trace of it), never throws. `connection` / `env` for tests.
 * T0790: `at` (`hookStartedAt()`, main passes it) goes into the report as is; absent = not sent.
 * T0905: `origin` / `set` (main passes `HOOK_ORIGIN_INJECTED` / `BAT_HOOK_SET`) likewise.
 */
export async function reportHook(event, input, { env = process.env, connection, at, origin, set } = {}) {
  const startedAt = Date.now()
  const report = hookReport(event, input)
  if (!report) return { result: 'skipped', durationMs: Date.now() - startedAt }
  const sent = {
    ...(report.sessionId ? { sessionId: report.sessionId } : {}),
    ...(report.agentId ? { agentId: report.agentId } : {}),
    ...(typeof report.lastAssistantMessage === 'string' ? { messageBytes: Buffer.byteLength(report.lastAssistantMessage, 'utf8') } : {}),
  }
  if (!env.BAT_REMOTE_PORT || !env.BAT_REMOTE_TOKEN) return { result: 'not-in-bat', ...sent, durationMs: Date.now() - startedAt }
  const conn = connection ?? new BatConnection({
    port: env.BAT_REMOTE_PORT,
    token: env.BAT_REMOTE_TOKEN,
    connectTimeoutMs: CONNECT_TIMEOUT_MS,
    clientName: 'bat-hook',
  })
  try {
    const extra = {
      ...(typeof at === 'string' ? { at } : {}),
      ...(typeof origin === 'string' ? { origin } : {}),
      ...(Number.isSafeInteger(set) ? { set } : {}),
    }
    const outcome = await conn.invoke('terminal:report-hook', [{ ...report, ...extra }], INVOKE_TIMEOUT_MS)
    if (!outcome.ok) return { result: 'failed', code: outcome.code, ...sent, durationMs: Date.now() - startedAt }
    const value = outcome.result
    if (value && typeof value === 'object' && value.ok === false) {
      return { result: 'failed', code: typeof value.code === 'string' ? value.code : 'ERROR', ...sent, durationMs: Date.now() - startedAt }
    }
    return { result: value && typeof value.result === 'string' ? value.result : 'ok', ...sent, durationMs: Date.now() - startedAt }
  } catch {
    return { result: 'failed', code: 'ERROR', ...sent, durationMs: Date.now() - startedAt }
  } finally {
    try { conn.close() } catch { /* ignore */ }
  }
}

function isMainModule() {
  if (!process.argv[1]) return false
  try {
    const self = realpathSync(fileURLToPath(import.meta.url))
    const entry = realpathSync(resolve(process.argv[1]))
    return process.platform === 'win32' ? self.toLowerCase() === entry.toLowerCase() : self === entry
  } catch {
    return false
  }
}

async function main() {
  const event = process.argv[2]
  // Outside BAT: nothing to report to (and nothing to read).
  if (!process.env.BAT_REMOTE_PORT || !process.env.BAT_REMOTE_TOKEN) process.exit(0)
  const stopField = Object.hasOwn(HOOK_INPUT_STOP_FIELDS, event) ? HOOK_INPUT_STOP_FIELDS[event] : undefined
  const input = await readHookInput(process.stdin, STDIN_TIMEOUT_MS, stopField)
  // T0905: `origin` / `set` ride on `stop` (T0910: + `session-start`, so `--set-role` sees the set
  // before the first `Stop`); every other injected report stays as it was (BAT reads an absent origin
  // as `injected`, T0902 §7.4). T0910: the plugin's launcher (`--hook-list <n>`) sends them on every event.
  const origin = reportOrigin(event, process.argv.slice(3))
  const outcome = await reportHook(event, input, { at: hookStartedAt(), ...origin })
  if (outcome.result !== 'skipped') {
    logEvent('bat-hook', 'report-hook', {
      // `hook`, not `event`: the log record's own `event` is 'report-hook'
      hook: HOOK_EVENTS.includes(event) ? event : String(event ?? '').slice(0, 40),
      result: outcome.result,
      ...(outcome.code ? { code: outcome.code } : {}),
      // T0642: the first 8 characters only
      ...(outcome.sessionId ? { session: outcome.sessionId.slice(0, 8) } : {}),
      // T0657: a subagent id is not a secret
      ...(outcome.agentId ? { agent: outcome.agentId } : {}),
      // T0905: the length of the last assistant message sent, never its text
      ...(outcome.messageBytes !== undefined ? { messageBytes: outcome.messageBytes } : {}),
      // T0910: the plugin's reports say so (an injected one logs as before)
      ...(origin.origin === HOOK_ORIGIN_PLUGIN ? { origin: HOOK_ORIGIN_PLUGIN, ...(origin.set ? { hookList: origin.set } : {}) } : {}),
      durationMs: outcome.durationMs,
      terminalId: process.env.BAT_TERMINAL_ID ?? null,
    })
  }
  process.exit(0)
}

if (isMainModule()) {
  // Never a non-zero exit, never stdout, never past the deadline.
  const deadline = setTimeout(() => process.exit(0), HOOK_DEADLINE_MS)
  process.on('uncaughtException', () => process.exit(0))
  process.on('unhandledRejection', () => process.exit(0))
  main().catch(() => process.exit(0)).finally(() => clearTimeout(deadline))
}
