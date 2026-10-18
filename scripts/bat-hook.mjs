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
//   UserPromptSubmit (async)                   → bat-hook.mjs user-prompt-submit
//   Stop (async)                               → bat-hook.mjs stop
//   SessionStart (async, T0600)                → bat-hook.mjs session-start (`agentStarted`;
//                                                `source` is not sent; T0642: + `sessionId`)
//
// It reads claude's hook JSON from stdin (only `hook_event_name` / `tool_name` /
// `notification_type`; T0642: + `session_id` of a SessionStart), sends one `terminal:report-hook` to the tab's BAT with the tab's own
// capability (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN; certificate pinning and frame-id matching of
// scripts/bat-mcp.mjs `BatConnection`) and ends.
//
// 🔴 It must never change what claude does: exit 0 always, nothing on stdout (a PermissionRequest /
// PreToolUse hook printing JSON would decide for the user), silent on any failure, done within
// HOOK_DEADLINE_MS. It sends the event name, (permission prompts only) the tool name and (T0642,
// SessionStart only) the session id when it is a UUID — never tool_input / tool_response, `source`,
// `transcript_path`, `cwd`, an elicitation's content / action, a prompt, a message or a token. Outside BAT (no BAT_REMOTE_*) it exits at once.
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

export const HOOK_EVENTS = ['permission-request', 'ask-user-question', 'ask-user-question-done', 'elicitation', 'elicitation-done', 'user-prompt-submit', 'stop', 'session-start']
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
  'user-prompt-submit': ['UserPromptSubmit'],
  stop: ['Stop'],
  'session-start': ['SessionStart'],
}
const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/
/** T0642 (D167): a claude session id as sent (anything else is not sent). */
export const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * What to report for `event` given claude's hook input (already parsed; null = none / unreadable):
 * `{ event, toolName? }` (T0642: `{ event: 'session-start', sessionId? }`), or null = report nothing (unknown event, the input names another hook,
 * a Notification that is not an elicitation / an elicitation response, a PreToolUse / PostToolUse of
 * another tool).
 */
export function hookReport(event, input) {
  if (!HOOK_EVENTS.includes(event)) return null
  const fields = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const name = typeof fields.hook_event_name === 'string' ? fields.hook_event_name : null
  if (name && !HOOK_EVENT_NAMES[event].includes(name)) return null
  if (event === 'elicitation' && typeof fields.notification_type === 'string' && !ELICITATION_TYPES.includes(fields.notification_type)) return null
  if (event === 'elicitation-done' && name !== 'ElicitationResult' && typeof fields.notification_type === 'string' && fields.notification_type !== ELICITATION_DONE_TYPE) return null
  if ((event === 'ask-user-question' || event === 'ask-user-question-done') && typeof fields.tool_name === 'string' && fields.tool_name !== 'AskUserQuestion') return null
  if (event === 'permission-request' && typeof fields.tool_name === 'string' && TOOL_NAME_PATTERN.test(fields.tool_name)) {
    return { event, toolName: fields.tool_name }
  }
  if (event === 'session-start' && typeof fields.session_id === 'string' && SESSION_ID_PATTERN.test(fields.session_id)) {
    return { event, sessionId: fields.session_id }
  }
  return { event }
}

/** stdin as JSON, or null (no stdin, a TTY, too long, not JSON, timeout). */
export function readHookInput(stream = process.stdin, timeoutMs = STDIN_TIMEOUT_MS) {
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
      if (size > STDIN_MAX_BYTES) {
        finish(null)
        return
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
    })
    stream.on('end', () => finish(parse()))
    stream.on('error', () => finish(null))
  })
}

/**
 * One report. `{ result, code?, sessionId?, durationMs }` (`sessionId`: the one sent, for the log's
 * first 8 characters), never throws. `connection` / `env` for tests.
 */
export async function reportHook(event, input, { env = process.env, connection } = {}) {
  const startedAt = Date.now()
  const report = hookReport(event, input)
  if (!report) return { result: 'skipped', durationMs: Date.now() - startedAt }
  const sent = report.sessionId ? { sessionId: report.sessionId } : {}
  if (!env.BAT_REMOTE_PORT || !env.BAT_REMOTE_TOKEN) return { result: 'not-in-bat', ...sent, durationMs: Date.now() - startedAt }
  const conn = connection ?? new BatConnection({
    port: env.BAT_REMOTE_PORT,
    token: env.BAT_REMOTE_TOKEN,
    connectTimeoutMs: CONNECT_TIMEOUT_MS,
    clientName: 'bat-hook',
  })
  try {
    const outcome = await conn.invoke('terminal:report-hook', [report], INVOKE_TIMEOUT_MS)
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
  const input = await readHookInput()
  const outcome = await reportHook(event, input)
  if (outcome.result !== 'skipped') {
    logEvent('bat-hook', 'report-hook', {
      // `hook`, not `event`: the log record's own `event` is 'report-hook'
      hook: HOOK_EVENTS.includes(event) ? event : String(event ?? '').slice(0, 40),
      result: outcome.result,
      ...(outcome.code ? { code: outcome.code } : {}),
      // T0642: the first 8 characters only
      ...(outcome.sessionId ? { session: outcome.sessionId.slice(0, 8) } : {}),
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
