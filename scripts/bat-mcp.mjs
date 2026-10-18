#!/usr/bin/env node
// scripts/bat-mcp.mjs
// PLAN-047 M1 / T0584: stdio MCP server that lets the agent in a BAT tab query BAT.
// Zero external dependencies — Node.js 18+ built-in modules only (no MCP SDK).
//
// Transport: newline-delimited JSON-RPC 2.0 on stdin / stdout (MCP stdio). Dual-era:
//   - modern 2026-07-28: `server/discover`, every request carries its protocol version in
//     `_meta["io.modelcontextprotocol/protocolVersion"]`, every result has `resultType`
//   - legacy (2025-11-25 and earlier): `initialize` + `notifications/initialized`, `ping`
//
// Each tool forwards to one read-only helper channel of BAT's RemoteServer
// (wss://127.0.0.1:$BAT_REMOTE_PORT), authenticated with this tab's own scoped capability
// ($BAT_REMOTE_TOKEN, inherited from the PTY env — never read from a file or argv). The
// capability is the caller's identity: a tool without `terminalId` asks about this tab.
//
//   bat_whoami           terminal:whoami
//   bat_list_terminals   terminal:list
//   bat_get_state        terminal:get-state
//   bat_read_output      terminal:read-output
//   bat_wait             terminal:wait
//   bat_worktree_status  worktree:terminal-status (T0585)
//   bat_list_questions   question:list (PLAN-048 / T0608)
//   bat_wait_question    question:wait (PLAN-048 / T0608)
//
// All read-only: asking, cancelling and answering a question go through the helpers
// (bat-notify.mjs --ask / --cancel-question, bat-terminal.mjs --answer; D155 / D156).
//
// Connection: one WebSocket, opened on the first tool call and shared by concurrent calls
// (replies matched by frame id, BUG-114), closed after IDLE_CLOSE_MS without calls. It
// answers the server's heartbeat pings (T0451) so a 45 s `bat_wait` survives them. A shared
// connection keeps parallel calls under the per-capability connection cap (4) that the
// tab's own bat-terminal / bat-notify calls also count against; closing it when idle frees
// the slot and makes a BAT restart (new server, same env) transparent to the next call.
//
// Audit: one `bat-scripts.log` line per tools/call (`script: 'bat-mcp'`, `event:
// 'tool-call'`): tool, ok / code, duration, protocol era, `_meta.traceparent` when present.
// Never the arguments' output, never the token.
//
// Usage (BAT writes this into the agent's MCP config; see CLAUDE.md "BAT MCP shim"):
//   node scripts/bat-mcp.mjs            # serve MCP on stdio
//   node scripts/bat-mcp.mjs --version
//   node scripts/bat-mcp.mjs --help

import { connect as tlsConnect } from 'tls'
import { randomBytes } from 'crypto'
import { readFileSync, realpathSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { logEvent } from './_bat-logger.mjs'
import { loadTrustedFingerprint } from './_bat-cert.mjs'

export const SERVER_NAME = 'bat'
export const MODERN_PROTOCOL = '2026-07-28'
export const LEGACY_PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
export const SUPPORTED_PROTOCOLS = [MODERN_PROTOCOL, ...LEGACY_PROTOCOLS]
const META_PROTOCOL = 'io.modelcontextprotocol/protocolVersion'
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo'

/** JSON-RPC / MCP error codes. */
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  UNSUPPORTED_PROTOCOL_VERSION: -32022,
}

export const CONNECT_TIMEOUT_MS = 3000
/** Helper convention (bat-terminal / bat-notify wait 3 s for a reply). */
export const INVOKE_TIMEOUT_MS = 3000
/** `terminal:wait` / `question:wait` hold the reply up to 45 s (TERMINAL_WAIT_MAX_MS / QUESTION_WAIT_MAX_MS) — wait longer than that. */
export const WAIT_INVOKE_TIMEOUT_MS = 55_000
/** `worktree:terminal-status` runs git (rev-list / merge-tree / diff) on the host. */
export const WORKTREE_INVOKE_TIMEOUT_MS = 15_000
export const IDLE_CLOSE_MS = 5000
/** How long a client may cache tools/list (modern `ttlMs`). */
export const TOOLS_TTL_MS = 60 * 60 * 1000

const VERSION = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    return JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf-8')).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
})()

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const TERMINAL_ID = { type: 'string', description: 'Terminal (tab) id. Omit for this tab.' }

/**
 * The tools. `args` picks the known keys from the call's arguments (the server validates
 * them and answers INVALID_ARGS); `timeoutMs` is the invoke timeout.
 */
export const TOOLS = [
  {
    name: 'bat_whoami',
    channel: 'terminal:whoami',
    title: 'Who am I (BAT tab)',
    description: 'This BAT tab: terminal id, workspace, role (tower / worker / shell), the tower that dispatched it, work order, yolo, agent, cwd. claudeSessionName = the claude session name BAT gave the tab (--name, null = none); claudeSessionId = its claude session id from the SessionStart hook (null = not known, which does not mean there is no session).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    keys: [],
    timeoutMs: INVOKE_TIMEOUT_MS,
  },
  {
    name: 'bat_list_terminals',
    channel: 'terminal:list',
    title: 'List BAT terminals',
    description: 'Terminals this tab may see: scope "mine" (default) = itself, its Workers (a tower) or its tower (a worker); "workspace" (declared towers only) adds the other tabs of the workspace, metadata only. Each row has claudeSessionName / claudeSessionId as bat_get_state. "towers" (declared towers only) = the running declared towers of this BAT in every workspace, itself too (self=true), each with id / workspaceId / workspaceName / claudeSessionName / state only; their state and output stay out of scope. An older BAT answers INVALID_ARGS to "towers".',
    inputSchema: {
      type: 'object',
      properties: { scope: { type: 'string', enum: ['mine', 'workspace', 'towers'] } },
      additionalProperties: false,
    },
    keys: ['scope'],
    timeoutMs: INVOKE_TIMEOUT_MS,
  },
  {
    name: 'bat_get_state',
    channel: 'terminal:get-state',
    title: 'Terminal state',
    description: 'State of a terminal: working (printed within 5 s) / idle / blocked (a claude tab waits for the user: blockedReason permission / question / elicitation; a codex tab: input = waits for the user, an approval or a question; tower = a Worker waits for its tower to answer a question, any agent) / exited, last output time, idle ms, exit code. blockedDetection = how this tab reports a prompt: hook (claude hooks), osc (codex >= 0.163.0 state sequence), none = it cannot, so idle does not rule out a prompt (tower still shows). pendingQuestions = its questions waiting for an answer. agentStarted: true = its agent has started (agentStartedAt, ms), false = not confirmed yet, null = cannot tell (blockedDetection none, e.g. an older codex). claudeSessionName = the claude session name BAT gave the tab (--name, null = none); claudeSessionId = its claude session id from the SessionStart hook (null = not known, which does not mean there is no session).',
    inputSchema: { type: 'object', properties: { terminalId: TERMINAL_ID }, additionalProperties: false },
    keys: ['terminalId'],
    timeoutMs: INVOKE_TIMEOUT_MS,
  },
  {
    name: 'bat_read_output',
    channel: 'terminal:read-output',
    title: 'Read terminal output',
    description: 'Plain-text output lines of this tab or one of its Workers, secrets masked. Pass the previous nextCursor to read only what is new; partialLine = the last line is still being printed and comes again next time; truncated = output between the reads scrolled out. maxLines default 200, at most 1000.',
    inputSchema: {
      type: 'object',
      properties: {
        terminalId: TERMINAL_ID,
        cursor: { type: 'string', description: 'nextCursor of the previous read' },
        maxLines: { type: 'integer', minimum: 1, maximum: 1000 },
      },
      additionalProperties: false,
    },
    keys: ['terminalId', 'cursor', 'maxLines'],
    timeoutMs: INVOKE_TIMEOUT_MS,
  },
  {
    name: 'bat_wait',
    channel: 'terminal:wait',
    title: 'Wait for a terminal',
    description: 'Wait (server side, at most 45 s) until this tab or one of its Workers changes state (including entering / leaving blocked), exits, or goes idle (blocked counts as not working), or (agent-started) its agent start is confirmed or cannot be told (agentStarted not false). changed=false = timed out (not an error); call again to keep waiting.',
    inputSchema: {
      type: 'object',
      properties: {
        terminalId: TERMINAL_ID,
        until: { type: 'string', enum: ['state-change', 'exit', 'idle', 'agent-started'] },
        fromState: { type: 'string', enum: ['working', 'idle', 'blocked', 'exited'] },
        timeoutMs: { type: 'integer', minimum: 0, maximum: 45000 },
      },
      required: ['until'],
      additionalProperties: false,
    },
    keys: ['terminalId', 'until', 'fromState', 'timeoutMs'],
    timeoutMs: WAIT_INVOKE_TIMEOUT_MS,
    idempotent: false,
  },
  {
    name: 'bat_worktree_status',
    channel: 'worktree:terminal-status',
    title: 'Worker worktree status',
    description: 'Git worktree of an isolated Worker (dispatched with --isolation worktree): branch, base, ahead / behind, dirty, changed files, files outside the work order scope, merge conflicts. isolated=false = not an isolated Worker. Also after the Worker tab closed: source=exited (closed within 10 min) or source=git (workorder only, from the asking Tower repository).',
    inputSchema: {
      type: 'object',
      properties: {
        terminalId: TERMINAL_ID,
        workorder: { type: 'string', description: 'Work order id, e.g. T0585' },
      },
      additionalProperties: false,
    },
    keys: ['terminalId', 'workorder'],
    timeoutMs: WORKTREE_INVOKE_TIMEOUT_MS,
  },
  // PLAN-048 / T0608 (T0606「介面契約」C-6): questions a Worker asked its tower (bat-notify.mjs --ask)
  {
    name: 'bat_list_questions',
    channel: 'question:list',
    title: 'Tower questions',
    description: 'Questions Workers asked their tower, with the full text: a tower sees the questions sent to it (terminalId = one of its Workers to narrow), a worker its own. status pending (default) or all (ended ones kept 10 min: answered / cancelled / expired, endReason). Each: questionId, workerTerminalId, workorder, question, options, allowFreeText, detail, blocking, status, createdAt, expiresAt, answer. Answer with the helper bat-terminal.mjs --answer (this server is read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        terminalId: { type: 'string', description: 'A Worker of this tower (or this tab). Omit for all the questions this tab may see.' },
        status: { type: 'string', enum: ['pending', 'all'] },
      },
      additionalProperties: false,
    },
    keys: ['terminalId', 'status'],
    timeoutMs: INVOKE_TIMEOUT_MS,
  },
  {
    name: 'bat_wait_question',
    channel: 'question:wait',
    title: 'Wait for a tower answer',
    description: 'Wait (server side, at most 45 s) until a question is no longer pending: answered (answer: choice 1-based / text), cancelled, expired (endReason timeout / not-polled: a blocking question nobody waited for in 120 s) or lost (BAT restarted since it was asked: it is gone, fall back to the work order). changed=false + status pending = timed out (not an error); call again. The asking Worker\'s calls keep its blocking question alive.',
    inputSchema: {
      type: 'object',
      properties: {
        questionId: { type: 'string', description: 'The id bat-notify.mjs --ask printed (q-…)' },
        timeoutMs: { type: 'integer', minimum: 0, maximum: 45000 },
      },
      required: ['questionId'],
      additionalProperties: false,
    },
    keys: ['questionId', 'timeoutMs'],
    timeoutMs: WAIT_INVOKE_TIMEOUT_MS,
    idempotent: false,
  },
]

const TOOLS_BY_NAME = new Map(TOOLS.map(tool => [tool.name, tool]))

/** tools/list entries (protocol shape only). */
export function toolDescriptors() {
  return TOOLS.map(tool => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: { title: tool.title, ...READ_ONLY, ...(tool.idempotent === false ? { idempotentHint: false } : {}) },
  }))
}

// ── tool results ──

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** T0590: `blocked (question)` — the state with its reason. */
function stateText(data) {
  return data.state === 'blocked' && data.blockedReason ? `blocked (${data.blockedReason})` : data.state
}

/** T0600: `, agent started` / `, agent not started yet` (nothing when it cannot be told). */
function agentStartedText(data) {
  return data.agentStarted === true ? ', agent started' : data.agentStarted === false ? ', agent not started yet' : ''
}

/** T0608: the first 60 characters of a question, on one line. */
function questionPreview(text) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat
}

/** One short line (plus the output lines for bat_read_output) for `content`. */
export function summarize(toolName, data) {
  switch (toolName) {
    case 'bat_whoami': {
      const parts = [`terminal ${data.terminalId}`, `role=${data.role}`]
      if (data.towerTerminalId) parts.push(`tower=${data.towerTerminalId}`)
      if (data.workorder) parts.push(`workorder=${data.workorder}`)
      if (data.yolo) parts.push('yolo')
      if (data.agent) parts.push(`agent=${data.agent}`)
      if (data.claudeSessionName) parts.push(`session="${data.claudeSessionName}"`) // T0642
      return parts.join(' ')
    }
    case 'bat_list_terminals': {
      const terminals = Array.isArray(data.terminals) ? data.terminals : []
      const items = data.scope === 'towers' // T0643
        ? terminals.map(t => `${t.id} (${[t.self ? 'self' : null, t.workspaceName ? `workspace="${t.workspaceName}"` : null, t.claudeSessionName ? `session="${t.claudeSessionName}"` : null, stateText(t)].filter(Boolean).join(', ')})`)
        : terminals.map(t => `${t.id} (${[t.role, t.workorder, stateText(t)].filter(Boolean).join(', ')})`)
      return `${plural(terminals.length, 'terminal')} (scope=${data.scope})${items.length ? `: ${items.join('; ')}` : ''}`
    }
    case 'bat_get_state':
      return `${data.terminalId}: ${stateText(data)}${typeof data.idleMs === 'number' ? `, idle ${data.idleMs} ms` : ''}${data.exitCode !== undefined && data.exitCode !== null ? `, exit code ${data.exitCode}` : ''}${agentStartedText(data)}`
    case 'bat_read_output': {
      const lines = Array.isArray(data.lines) ? data.lines : []
      const flags = [
        `nextCursor=${data.nextCursor}`,
        `state=${data.state}`,
        ...(data.truncated ? ['truncated'] : []),
        ...(data.skippedLines ? [`skippedLines=${data.skippedLines}`] : []),
        ...(data.partialLine ? ['partialLine'] : []),
        ...(data.masked ? [`masked=${data.masked}`] : []),
      ]
      const head = `${plural(lines.length, 'line')} from ${data.terminalId} (${flags.join(', ')})`
      return lines.length ? `${head}\n${lines.join('\n')}` : head
    }
    case 'bat_wait':
      return `changed=${data.changed} state=${stateText(data)}${agentStartedText(data)} after ${data.waitedMs} ms`
    case 'bat_worktree_status': {
      // T0585 shape: lists capped, counts beside them (dirtyCount / changedCount / outOfScopeCount)
      // T0589: `source` live / exited (the tab closed) / git (no tab left, found by the location rules)
      const from = data.source === 'exited' ? ' (tab closed)' : data.source === 'git' ? ' (no tab; from git)' : ''
      if (!data.isolated) return `${data.terminalId ? `${data.terminalId}: ` : ''}not an isolated worktree${from}`
      const count = (n, list) => typeof n === 'number' ? n : Array.isArray(list) ? list.length : 0
      const parts = [`${data.branch} at ${data.path}${from}`, `ahead ${data.ahead}`, `behind ${data.behind}`]
      if (data.worktreeMissing) parts.push('worktree missing')
      const dirty = count(data.dirtyCount, data.dirty)
      if (dirty) parts.push(`${dirty} uncommitted`)
      parts.push(plural(count(data.changedCount, data.changedFiles), 'changed file'))
      const outOfScope = count(data.outOfScopeCount, data.outOfScopeFiles)
      if (outOfScope) parts.push(`${outOfScope} out of scope`)
      if (Array.isArray(data.conflicts) && data.conflicts.length) parts.push(plural(data.conflicts.length, 'conflict'))
      return parts.join(', ')
    }
    case 'bat_list_questions': {
      // T0606 C-6: `N pending questions: <id> (T####, <first 60 chars>)`; status=all names each status
      const questions = Array.isArray(data.questions) ? data.questions : []
      const allPending = questions.every(q => q.status === 'pending')
      const items = questions.map(q => `${q.questionId} (${[q.workorder, allPending ? null : q.status, questionPreview(q.question)].filter(Boolean).join(', ')})`)
      const head = allPending ? plural(questions.length, 'pending question') : plural(questions.length, 'question')
      return `${head}${items.length ? `: ${items.join('; ')}` : ''}`
    }
    case 'bat_wait_question': {
      // T0606 C-6: `status=<s> after <ms> ms`, with the full answer when answered
      const head = `status=${data.status}${data.endReason ? ` (${data.endReason})` : ''} after ${typeof data.waitedMs === 'number' ? data.waitedMs : 0} ms`
      const answer = data.status === 'answered' && data.answer && typeof data.answer === 'object' ? data.answer : null
      if (!answer) return data.status === 'pending' && data.changed === false ? `${head} (timed out; call again)` : head
      const lines = [head]
      if (typeof answer.choice === 'number') lines.push(`choice: ${answer.choice}`)
      if (typeof answer.text === 'string' && answer.text) lines.push(answer.text)
      return lines.join('\n')
    }
    default:
      return 'ok'
  }
}

/** `{ ok:false, code, message? }` (channel / connection) → MCP tool error result. */
export function toolError(code, message) {
  return {
    isError: true,
    content: [{ type: 'text', text: message ? `${code}: ${message}` : code }],
    structuredContent: message ? { code, message } : { code },
  }
}

/** Picks the tool's known keys; null when `args` is not an object. */
function pickArgs(tool, args) {
  if (args === undefined || args === null) return {}
  if (typeof args !== 'object' || Array.isArray(args)) return null
  const picked = {}
  for (const key of tool.keys) if (args[key] !== undefined) picked[key] = args[key]
  return picked
}

/**
 * The tool's result from the channel outcome (`invoke`'s value: `{ ok:true, result }` or
 * `{ ok:false, code, message? }`). Exported for tests.
 */
export function toolResult(tool, outcome) {
  if (!outcome.ok) return toolError(outcome.code, outcome.message)
  const result = outcome.result
  if (!result || typeof result !== 'object' || Array.isArray(result)) return toolError('ERROR', 'unexpected reply from BAT')
  if (result.ok === false) {
    const code = typeof result.code === 'string' ? result.code : 'ERROR'
    return toolError(code, typeof result.message === 'string' ? result.message : undefined)
  }
  const { ok: _ok, ...data } = result
  return { content: [{ type: 'text', text: summarize(tool.name, data) }], structuredContent: data }
}

// ── MCP server (transport-agnostic; stdio wiring in main()) ──

function rpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id: id ?? null, error: data === undefined ? { code, message } : { code, message, data } }
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result }
}

/**
 * @param {object} deps
 * @param {(channel: string, args: unknown[], timeoutMs: number) => Promise<{ok: true, result: unknown} | {ok: false, code: string, message?: string}>} deps.invoke
 * @param {(event: string, data: object) => void} [deps.log]
 * @param {() => number} [deps.now]
 */
export function createMcpServer(deps) {
  const log = deps.log ?? (() => {})
  const now = deps.now ?? Date.now
  const serverInfo = { name: SERVER_NAME, title: 'Better Agent Terminal', version: VERSION }
  const instructions = 'Read-only queries about BAT terminals and tower questions: this tab (bat_whoami), the tabs it may see (bat_list_terminals), their state / output, waiting for them, the worktree of an isolated Worker, and the questions Workers asked their tower (bat_list_questions, bat_wait_question). Omit terminalId to ask about this tab.'

  /** 'modern' | 'legacy' | { unsupported: version } for a request. */
  function eraOf(params) {
    const version = params && typeof params === 'object' && params._meta && typeof params._meta === 'object'
      ? params._meta[META_PROTOCOL]
      : undefined
    if (version === undefined) return 'legacy'
    if (version === MODERN_PROTOCOL) return 'modern'
    if (LEGACY_PROTOCOLS.includes(version)) return 'legacy'
    return { unsupported: version }
  }

  function complete(era, result) {
    return era === 'modern' ? { resultType: 'complete', ...result } : result
  }

  async function callTool(id, params, era) {
    const name = params?.name
    const tool = typeof name === 'string' ? TOOLS_BY_NAME.get(name) : undefined
    if (!tool) return rpcError(id, RPC.INVALID_PARAMS, `Unknown tool: ${String(name)}`)
    const traceparent = typeof params?._meta?.traceparent === 'string' ? params._meta.traceparent : undefined
    const started = now()
    const picked = pickArgs(tool, params.arguments)
    let result
    if (picked === null) {
      result = toolError('INVALID_ARGS', 'arguments must be an object')
    } else {
      const args = tool.keys.length === 0 ? [] : [picked]
      let outcome
      try {
        outcome = await deps.invoke(tool.channel, args, tool.timeoutMs)
      } catch (err) {
        outcome = { ok: false, code: 'ERROR', message: err?.message || String(err) }
      }
      result = toolResult(tool, outcome)
    }
    log('tool-call', {
      tool: tool.name,
      ok: !result.isError,
      ...(result.isError ? { code: result.structuredContent.code } : {}),
      durationMs: now() - started,
      era,
      ...(traceparent ? { traceparent } : {}),
    })
    return rpcResult(id, complete(era, result))
  }

  /**
   * One parsed JSON-RPC message → the response, or null (notification / response).
   */
  async function handleMessage(msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0') {
      return rpcError(msg && typeof msg === 'object' ? msg.id : null, RPC.INVALID_REQUEST, 'Invalid Request')
    }
    if (typeof msg.method !== 'string') return null // a response to us (we send no requests)
    const isNotification = !('id' in msg)
    if (isNotification) return null // notifications/initialized, notifications/cancelled, …
    const { id, method } = msg
    const params = msg.params

    if (method === 'initialize') {
      const requested = params?.protocolVersion
      const protocolVersion = LEGACY_PROTOCOLS.includes(requested) ? requested : LEGACY_PROTOCOLS[0]
      return rpcResult(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo, instructions })
    }

    const era = eraOf(params)
    if (typeof era === 'object') {
      return rpcError(id, RPC.UNSUPPORTED_PROTOCOL_VERSION, 'Unsupported protocol version', {
        supported: SUPPORTED_PROTOCOLS,
        requested: era.unsupported,
      })
    }

    switch (method) {
      case 'server/discover':
        return rpcResult(id, {
          resultType: 'complete',
          ttlMs: TOOLS_TTL_MS,
          cacheScope: 'private',
          supportedVersions: SUPPORTED_PROTOCOLS,
          capabilities: { tools: {} },
          instructions,
          _meta: { [META_SERVER_INFO]: serverInfo },
        })
      case 'ping':
        return rpcResult(id, complete(era, {}))
      case 'tools/list':
        return rpcResult(id, era === 'modern'
          ? { resultType: 'complete', ttlMs: TOOLS_TTL_MS, cacheScope: 'private', tools: toolDescriptors() }
          : { tools: toolDescriptors() })
      case 'tools/call':
        if (!params || typeof params !== 'object') return rpcError(id, RPC.INVALID_PARAMS, 'tools/call needs params')
        return callTool(id, params, era)
      default:
        return rpcError(id, RPC.METHOD_NOT_FOUND, `Method not found: ${method}`)
    }
  }

  /** One stdin line → the response line (without newline), or null. */
  async function handleLine(line) {
    const text = line.trim()
    if (!text) return null
    let msg
    try {
      msg = JSON.parse(text)
    } catch {
      return JSON.stringify(rpcError(null, RPC.PARSE_ERROR, 'Parse error'))
    }
    let response
    try {
      response = await handleMessage(msg)
    } catch (err) {
      response = rpcError(msg?.id, RPC.INTERNAL_ERROR, err?.message || String(err))
    }
    return response ? JSON.stringify(response) : null
  }

  return { handleMessage, handleLine }
}

// ── RemoteServer connection (TLS + WebSocket, shared, multiplexed by frame id) ──

/** An `invoke-error` frame's text → `{ code, message }`. Exported for tests. */
export function classifyInvokeError(error) {
  const message = String(error ?? '')
  if (/^No handler for channel/.test(message) || message === 'Forbidden: channel-not-allowed') {
    return { code: 'UNSUPPORTED', message: 'this BAT does not offer this query (update BAT)' }
  }
  if (message.startsWith('Forbidden: ')) return { code: 'FORBIDDEN', message: message.slice('Forbidden: '.length) }
  return { code: 'ERROR', message }
}

function maskedFrame(opcode, payload) {
  const mask = randomBytes(4)
  let header
  if (payload.length < 126) {
    header = Buffer.alloc(6)
    header[1] = 0x80 | payload.length
    mask.copy(header, 2)
  } else if (payload.length < 65536) {
    header = Buffer.alloc(8)
    header[1] = 0x80 | 126
    header.writeUInt16BE(payload.length, 2)
    mask.copy(header, 4)
  } else {
    header = Buffer.alloc(14)
    header[1] = 0x80 | 127
    header.writeBigUInt64BE(BigInt(payload.length), 2)
    mask.copy(header, 10)
  }
  header[0] = 0x80 | opcode
  const masked = Buffer.alloc(payload.length)
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i & 3]
  return Buffer.concat([header, masked])
}

function makeId() {
  return randomBytes(8).toString('hex')
}

export class BatConnection {
  #host
  #port
  #token
  #idleCloseMs
  #connectTimeoutMs
  #clientName
  #socket = null
  #ready = null // Promise<void> while connecting / connected
  #buffer = Buffer.alloc(0)
  #upgraded = false
  #pending = new Map() // frame id → { resolve, timer }
  #idleTimer = null
  #unsupported = new Set() // channels this BAT answered UNSUPPORTED (no repeat denials)

  // T0590: scripts/bat-hook.mjs reuses this connection (`clientName` = the auth frame's label)
  constructor({ port, token, host = '127.0.0.1', idleCloseMs = IDLE_CLOSE_MS, connectTimeoutMs = CONNECT_TIMEOUT_MS, clientName = 'bat-mcp' }) {
    this.#host = host
    this.#clientName = clientName
    this.#port = Number(port)
    this.#token = token
    this.#idleCloseMs = idleCloseMs
    this.#connectTimeoutMs = connectTimeoutMs
  }

  /** `{ ok:true, result }` or `{ ok:false, code, message? }`; never throws. */
  async invoke(channel, args, timeoutMs = INVOKE_TIMEOUT_MS) {
    if (this.#unsupported.has(channel)) return { ok: false, code: 'UNSUPPORTED', message: 'this BAT does not offer this query (update BAT)' }
    if (!this.#port || !this.#token) {
      return { ok: false, code: 'CONNECT_FAILED', message: 'not running inside a BAT terminal (BAT_REMOTE_PORT / BAT_REMOTE_TOKEN not set)' }
    }
    this.#clearIdle()
    try {
      await this.#connect()
    } catch (err) {
      return err?.batOutcome ?? { ok: false, code: 'CONNECT_FAILED', message: err?.message || String(err) }
    }
    const id = makeId()
    const reply = new Promise(resolvePending => {
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        resolvePending({ ok: false, code: 'TIMEOUT', message: `no reply from BAT within ${timeoutMs} ms` })
        this.#scheduleIdle()
      }, timeoutMs)
      this.#pending.set(id, { resolve: resolvePending, timer })
    })
    this.#send(JSON.stringify({ type: 'invoke', id, channel, args }))
    const outcome = await reply
    if (!outcome.ok && outcome.code === 'UNSUPPORTED') this.#unsupported.add(channel)
    return outcome
  }

  close() {
    this.#clearIdle()
    this.#teardown('closed')
  }

  #connect() {
    if (this.#ready) return this.#ready
    this.#ready = new Promise((resolveReady, rejectReady) => {
      let settled = false
      const fail = (outcome) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        const err = new Error(outcome.message)
        err.batOutcome = outcome
        rejectReady(err)
        this.#teardown(outcome.message, socket)
      }
      const timer = setTimeout(() => fail({ ok: false, code: 'CONNECT_FAILED', message: `connection timeout (${this.#connectTimeoutMs} ms)` }), this.#connectTimeoutMs)
      const authId = makeId()
      this.#buffer = Buffer.alloc(0)
      this.#upgraded = false
      const isIpLiteral = /^(\d{1,3}\.){3}\d{1,3}$/.test(this.#host) || this.#host.includes(':')
      // Self-signed server cert: chain validation off, fingerprint pinned instead (T0217).
      const socket = tlsConnect({
        host: this.#host,
        port: this.#port,
        rejectUnauthorized: false,
        ...(isIpLiteral ? {} : { servername: this.#host }),
      })
      this.#socket = socket

      socket.once('secureConnect', () => {
        // Pin before the upgrade so the token never reaches a server we do not trust.
        const trust = loadTrustedFingerprint()
        if (!trust.ok) {
          fail({ ok: false, code: 'CONNECT_FAILED', message: `server-cert-unreadable: ${trust.error} (path: ${trust.certPath || 'unresolved'})` })
          return
        }
        const actual = socket.getPeerCertificate()?.fingerprint256
        if (!actual || actual !== trust.fingerprint) {
          fail({ ok: false, code: 'CONNECT_FAILED', message: 'fingerprint-mismatch: the server certificate is not the one BAT wrote (BAT regenerated it? restart this tab)' })
          return
        }
        const key = randomBytes(16).toString('base64')
        socket.write(
          `GET / HTTP/1.1\r\nHost: ${this.#host}:${this.#port}\r\nUpgrade: websocket\r\n` +
          `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
        )
      })

      const onText = (raw) => {
        let frame
        try { frame = JSON.parse(raw) } catch { return }
        if (!settled) {
          // Auth reply: matched by id, or the server's id-less pre-auth rejection (T0499).
          if (frame?.type !== 'auth-result' || (frame.id !== authId && frame.id !== '0')) return
          if (frame.error) {
            fail({ ok: false, code: 'AUTH_FAILED', message: String(frame.error) })
            return
          }
          settled = true
          clearTimeout(timer)
          resolveReady()
          return
        }
        if (frame?.type !== 'invoke-result' && frame?.type !== 'invoke-error') return // broadcasts etc.
        const pending = this.#pending.get(frame.id)
        if (!pending) return
        this.#pending.delete(frame.id)
        clearTimeout(pending.timer)
        pending.resolve(frame.type === 'invoke-error'
          ? { ok: false, ...classifyInvokeError(frame.error) }
          : { ok: true, result: frame.result })
        this.#scheduleIdle()
      }

      socket.on('data', (chunk) => {
        if (this.#socket !== socket) return // a connection torn down earlier
        this.#buffer = Buffer.concat([this.#buffer, chunk])
        if (!this.#upgraded) {
          const idx = this.#buffer.indexOf('\r\n\r\n')
          if (idx === -1) return
          const head = this.#buffer.subarray(0, idx).toString()
          this.#buffer = this.#buffer.subarray(idx + 4)
          if (!head.startsWith('HTTP/1.1 101')) {
            fail({ ok: false, code: 'CONNECT_FAILED', message: 'WebSocket upgrade failed' })
            return
          }
          this.#upgraded = true
          this.#send(JSON.stringify({ type: 'auth', id: authId, token: this.#token, args: [this.#clientName] }))
        }
        this.#drain(onText)
      })
      socket.on('error', (err) => fail({ ok: false, code: 'CONNECT_FAILED', message: err?.message || String(err) }))
      socket.once('close', () => {
        if (!settled) {
          fail({ ok: false, code: 'CONNECT_FAILED', message: 'connection closed before authentication' })
          return
        }
        this.#teardown('connection closed', socket)
      })
    })
    return this.#ready
  }

  #drain(onText) {
    while (this.#buffer.length >= 2) {
      const opcode = this.#buffer[0] & 0x0f
      const isMasked = (this.#buffer[1] & 0x80) !== 0
      let len = this.#buffer[1] & 0x7f
      let off = 2
      if (len === 126) {
        if (this.#buffer.length < 4) return
        len = this.#buffer.readUInt16BE(2)
        off = 4
      } else if (len === 127) {
        if (this.#buffer.length < 10) return
        len = Number(this.#buffer.readBigUInt64BE(2))
        off = 10
      }
      const maskKey = isMasked ? this.#buffer.subarray(off, off + 4) : null
      if (isMasked) off += 4
      if (this.#buffer.length < off + len) return
      let payload = this.#buffer.subarray(off, off + len)
      this.#buffer = this.#buffer.subarray(off + len)
      if (maskKey) payload = Buffer.from(payload.map((b, i) => b ^ maskKey[i & 3]))

      if (opcode === 0x01) onText(payload.toString('utf-8'))
      else if (opcode === 0x09) this.#write(maskedFrame(0x0a, payload)) // ping → pong (T0451 heartbeat)
      else if (opcode === 0x08) {
        this.#teardown('server closed the connection')
        return
      }
    }
  }

  #send(text) {
    this.#write(maskedFrame(0x01, Buffer.from(text, 'utf-8')))
  }

  #write(buf) {
    try { this.#socket?.write(buf) } catch { /* closing */ }
  }

  /** Ends `socket` (default: the current one); a socket that is no longer current is left alone. */
  #teardown(reason, socket = this.#socket) {
    if (!socket || socket !== this.#socket) return
    this.#socket = null
    this.#ready = null
    this.#upgraded = false
    this.#buffer = Buffer.alloc(0)
    for (const [id, pending] of this.#pending) {
      clearTimeout(pending.timer)
      pending.resolve({ ok: false, code: 'CONNECT_FAILED', message: reason })
      this.#pending.delete(id)
    }
    try { socket.write(maskedFrame(0x08, Buffer.alloc(0))) } catch { /* already closing */ }
    try { socket.end() } catch { /* ignore */ }
    socket.destroy()
  }

  #scheduleIdle() {
    if (this.#pending.size > 0 || !this.#socket) return
    this.#clearIdle()
    this.#idleTimer = setTimeout(() => {
      this.#idleTimer = null
      if (this.#pending.size === 0) this.#teardown('idle')
    }, this.#idleCloseMs)
    this.#idleTimer.unref?.()
  }

  #clearIdle() {
    if (this.#idleTimer) clearTimeout(this.#idleTimer)
    this.#idleTimer = null
  }
}

// ── stdio entry ──

const HELP_TEXT = `Usage: bat-mcp.mjs [--help | --version]

MCP server on stdio (JSON-RPC, one message per line) answering read-only queries about
BAT terminals with this tab's capability ($BAT_REMOTE_PORT / $BAT_REMOTE_TOKEN).
BAT starts it for claude / codex tabs (Settings → Advanced → BAT MCP).

Tools: ${TOOLS.map(tool => tool.name).join(', ')}
`

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
  for (const arg of process.argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(HELP_TEXT)
      process.exit(0)
    }
    if (arg === '--version') {
      process.stdout.write(`bat-mcp.mjs v${VERSION}\n`)
      process.exit(0)
    }
  }

  const connection = new BatConnection({ port: process.env.BAT_REMOTE_PORT, token: process.env.BAT_REMOTE_TOKEN })
  const server = createMcpServer({
    invoke: (channel, args, timeoutMs) => connection.invoke(channel, args, timeoutMs),
    log: (event, data) => logEvent('bat-mcp', event, data),
  })
  logEvent('bat-mcp', 'start', {
    version: VERSION,
    terminalId: process.env.BAT_TERMINAL_ID ?? null,
    hasEndpoint: Boolean(process.env.BAT_REMOTE_PORT && process.env.BAT_REMOTE_TOKEN),
  })

  const inflight = new Set()
  let buffered = ''
  let ended = false
  const write = (line) => { if (line) process.stdout.write(`${line}\n`) }
  const finish = () => {
    if (!ended || inflight.size > 0) return
    connection.close()
    logEvent('bat-mcp', 'exit', { reason: 'stdin closed' })
    process.exit(0)
  }

  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => {
    buffered += chunk
    let nl
    while ((nl = buffered.indexOf('\n')) !== -1) {
      const line = buffered.slice(0, nl)
      buffered = buffered.slice(nl + 1)
      const task = server.handleLine(line).then(write, (err) => {
        process.stderr.write(`[bat-mcp] ${err?.message || String(err)}\n`)
      }).finally(() => {
        inflight.delete(task)
        finish()
      })
      inflight.add(task)
    }
  })
  process.stdin.on('end', () => {
    ended = true
    if (buffered.trim()) {
      const task = server.handleLine(buffered).then(write).finally(() => {
        inflight.delete(task)
        finish()
      })
      inflight.add(task)
      buffered = ''
    }
    finish()
  })
}

if (isMainModule()) {
  main().catch((err) => {
    process.stderr.write(`[bat-mcp] ${err?.message || String(err)}\n`)
    logEvent('bat-mcp', 'exit', { reason: 'unhandled', error: err?.message || String(err) })
    process.exit(1)
  })
}
