// PLAN-047 M1b-1 / T0590: scripts/bat-hook.mjs — what a hook reports (pure), stdin reading, and
// `reportHook` against a stand-in connection (the real RemoteServer path is
// electron/__tests__/terminal-blocked-state.test.ts). T0657: `post-tool-batch` / `agentId`, reading
// only the fields before `tool_input` / `tool_calls`.
import { PassThrough } from 'stream'
import { describe, expect, it } from 'vitest'
import { HOOK_EVENTS, HOOK_INPUT_STOP_FIELDS, hookInputPrefix, hookReport, readHookInput, reportHook, SESSION_ID_PATTERN } from '../bat-hook.mjs'

const SID = '0f3c2a9e-6b1d-4c8e-9a7f-1d2e3f4a5b6c'

describe('hookReport', () => {
  it('the event alone, plus the tool name of a permission prompt; never tool_input / prompt', () => {
    const input = { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: ['x'] }, prompt: 'p', session_id: 's' }
    expect(hookReport('ask-user-question', input)).toEqual({ event: 'ask-user-question' })
    expect(hookReport('permission-request', { hook_event_name: 'PermissionRequest', tool_name: 'mcp__bat__bat_wait', tool_input: { a: 1 } }))
      .toEqual({ event: 'permission-request', toolName: 'mcp__bat__bat_wait' })
    expect(hookReport('permission-request', { tool_name: 'bad name with spaces' })).toEqual({ event: 'permission-request' })
    expect(hookReport('user-prompt-submit', { hook_event_name: 'UserPromptSubmit', prompt: 'SECRET' })).toEqual({ event: 'user-prompt-submit' })
    expect(hookReport('stop', null)).toEqual({ event: 'stop' })
    expect(HOOK_EVENTS).toEqual(['permission-request', 'ask-user-question', 'ask-user-question-done', 'elicitation', 'elicitation-done', 'post-tool-batch', 'user-prompt-submit', 'stop', 'session-start'])
    // T0594: the answered question — never tool_response (the answers) / tool_input
    expect(hookReport('ask-user-question-done', { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion', tool_input: { q: 1 }, tool_response: { answers: { a: 'SECRET' } } }))
      .toEqual({ event: 'ask-user-question-done' })
  })

  it('nothing for an unknown event, another hook, a non-elicitation notification, another tool', () => {
    expect(hookReport('bogus', {})).toBeNull()
    expect(hookReport(undefined, {})).toBeNull()
    expect(hookReport('stop', { hook_event_name: 'SubagentStop' })).toBeNull()
    expect(hookReport('elicitation', { hook_event_name: 'Notification', notification_type: 'idle_prompt' })).toBeNull()
    expect(hookReport('elicitation', { hook_event_name: 'Notification', notification_type: 'permission_prompt' })).toBeNull()
    expect(hookReport('elicitation', { hook_event_name: 'Notification', notification_type: 'elicitation_url_dialog' })).toEqual({ event: 'elicitation' })
    expect(hookReport('ask-user-question', { hook_event_name: 'PreToolUse', tool_name: 'Bash' })).toBeNull()
    expect(hookReport('ask-user-question-done', { hook_event_name: 'PostToolUse', tool_name: 'Bash' })).toBeNull()
    expect(hookReport('ask-user-question-done', { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' })).toBeNull()
    expect(hookReport('permission-denied', { hook_event_name: 'PermissionDenied', tool_name: 'Bash' })).toBeNull()
  })

  it('T0620: ElicitationResult / Notification elicitation_response → elicitation-done; never content / action / message', () => {
    expect(hookReport('elicitation-done', {
      hook_event_name: 'ElicitationResult', mcp_server_name: 'srv', elicitation_id: 'e1', mode: 'form', action: 'accept', content: { pin: 'SECRET' },
    })).toEqual({ event: 'elicitation-done' })
    for (const action of ['decline', 'cancel']) {
      expect(hookReport('elicitation-done', { hook_event_name: 'ElicitationResult', action })).toEqual({ event: 'elicitation-done' })
    }
    expect(hookReport('elicitation-done', { hook_event_name: 'Notification', notification_type: 'elicitation_response', message: 'SECRET' }))
      .toEqual({ event: 'elicitation-done' })
    expect(hookReport('elicitation-done', null)).toEqual({ event: 'elicitation-done' })
    // another notification (the server's URL completion, the dialog itself, idle) / another hook: nothing
    for (const type of ['elicitation_complete', 'elicitation_dialog', 'elicitation_url_dialog', 'idle_prompt']) {
      expect(hookReport('elicitation-done', { hook_event_name: 'Notification', notification_type: type }), type).toBeNull()
    }
    expect(hookReport('elicitation-done', { hook_event_name: 'Elicitation' })).toBeNull()
    expect(hookReport('elicitation-done', { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion' })).toBeNull()
    // and the dialog event is not fired by the result hook / the response notification
    expect(hookReport('elicitation', { hook_event_name: 'ElicitationResult' })).toBeNull()
    expect(hookReport('elicitation', { hook_event_name: 'Notification', notification_type: 'elicitation_response' })).toBeNull()
  })

  it('T0600: SessionStart → session-start, nothing of its input (source, model, transcript) is sent', () => {
    for (const source of ['startup', 'resume', 'clear', 'compact', 'fork']) {
      expect(hookReport('session-start', { hook_event_name: 'SessionStart', source, model: 'm', transcript_path: '/t.jsonl', session_id: 's' })).toEqual({ event: 'session-start' })
    }
    expect(hookReport('session-start', null)).toEqual({ event: 'session-start' })
    expect(hookReport('session-start', { hook_event_name: 'Stop' })).toBeNull()
    expect(hookReport('stop', { hook_event_name: 'SessionStart' })).toBeNull()
  })

  it('T0642: a SessionStart sends its session_id when it is a UUID — nothing else of the input; other events never', () => {
    for (const source of ['startup', 'resume', 'clear', 'compact']) {
      expect(hookReport('session-start', { hook_event_name: 'SessionStart', source, model: 'm', transcript_path: '/SECRET.jsonl', cwd: '/c', session_id: SID }))
        .toEqual({ event: 'session-start', sessionId: SID })
    }
    for (const bad of ['s', `${SID}x`, ` ${SID}`, SID.replace(/-/g, ''), 42, null, { id: SID }]) {
      expect(hookReport('session-start', { hook_event_name: 'SessionStart', session_id: bad })).toEqual({ event: 'session-start' })
    }
    expect(hookReport('stop', { hook_event_name: 'Stop', session_id: SID })).toEqual({ event: 'stop' })
    expect(hookReport('permission-request', { hook_event_name: 'PermissionRequest', tool_name: 'Bash', session_id: SID })).toEqual({ event: 'permission-request', toolName: 'Bash' })
    expect(SESSION_ID_PATTERN.test(SID.toUpperCase())).toBe(true)
  })

  it('T0657: PostToolBatch → post-tool-batch with its agent_id (subagent); never tool_calls; unidentifiable input → nothing', () => {
    const batch = { hook_event_name: 'PostToolBatch', tool_calls: [{ tool_name: 'Bash', tool_input: { command: 'SECRET' }, tool_use_id: 't1', tool_response: 'SECRET' }] }
    expect(hookReport('post-tool-batch', batch)).toEqual({ event: 'post-tool-batch' })
    expect(hookReport('post-tool-batch', { ...batch, agent_id: 'a1b2c3d4e5f60718', agent_type: 'Explore' })).toEqual({ event: 'post-tool-batch', agentId: 'a1b2c3d4e5f60718' })
    // a batch that cannot be told apart from the main thread's must not clear the main thread's prompt
    expect(hookReport('post-tool-batch', null)).toBeNull()
    expect(hookReport('post-tool-batch', {})).toBeNull()
    for (const bad of ['a b', '', 'x'.repeat(129), 42, null, { id: 'a' }]) {
      expect(hookReport('post-tool-batch', { hook_event_name: 'PostToolBatch', agent_id: bad }), JSON.stringify(bad)).toBeNull()
    }
    expect(hookReport('post-tool-batch', { hook_event_name: 'PostToolUse', tool_name: 'Bash' })).toBeNull()
    expect(hookReport('stop', { hook_event_name: 'PostToolBatch' })).toBeNull()
  })

  it('T0657: a permission prompt also sends its agent_id; a malformed one is left out; other events never send it', () => {
    expect(hookReport('permission-request', { hook_event_name: 'PermissionRequest', tool_name: 'Bash', agent_id: 'a9', tool_input: { command: 'SECRET' } }))
      .toEqual({ event: 'permission-request', toolName: 'Bash', agentId: 'a9' })
    expect(hookReport('permission-request', { hook_event_name: 'PermissionRequest', agent_id: 'a9' })).toEqual({ event: 'permission-request', agentId: 'a9' })
    expect(hookReport('permission-request', { hook_event_name: 'PermissionRequest', tool_name: 'Bash', agent_id: 'a b' })).toEqual({ event: 'permission-request', toolName: 'Bash' })
    expect(hookReport('stop', { hook_event_name: 'Stop', agent_id: 'a9' })).toEqual({ event: 'stop' })
    expect(hookReport('ask-user-question', { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', agent_id: 'a9' })).toEqual({ event: 'ask-user-question' })
  })
})

describe('hookInputPrefix (T0657)', () => {
  it('the top-level fields before the stop field; a key-looking text inside a string is not the key', () => {
    expect(HOOK_INPUT_STOP_FIELDS).toEqual({ 'permission-request': 'tool_input', 'post-tool-batch': 'tool_calls' })
    const head = '{"session_id":"s","cwd":"C:\\\\x","agent_id":"a1","hook_event_name":"PostToolBatch"'
    expect(hookInputPrefix(`${head},"tool_calls":[{"tool_inp`, 'tool_calls')).toEqual({ session_id: 's', cwd: 'C:\\x', agent_id: 'a1', hook_event_name: 'PostToolBatch' })
    expect(hookInputPrefix(head, 'tool_calls')).toBeNull()
    // `,\"tool_calls\":` inside a string value: escaped quotes never match
    expect(hookInputPrefix('{"cwd":"a,\\"tool_calls\\":b"', 'tool_calls')).toBeNull()
    // the stop field first (no comma before it) / a broken prefix → null (read on as before)
    expect(hookInputPrefix('{"tool_calls":[]}', 'tool_calls')).toBeNull()
    expect(hookInputPrefix('{"a":,"tool_calls":[]}', 'tool_calls')).toBeNull()
  })
})

describe('readHookInput', () => {
  it('JSON → object; garbage → null; a stream that never ends → null after the timeout', async () => {
    const s1 = new PassThrough()
    const p1 = readHookInput(s1, 1000)
    s1.end('{"hook_event_name":"Stop"}')
    expect(await p1).toEqual({ hook_event_name: 'Stop' })
    const s2 = new PassThrough()
    const p2 = readHookInput(s2, 1000)
    s2.end('not json')
    expect(await p2).toBeNull()
    expect(await readHookInput(new PassThrough(), 50)).toBeNull()
    expect(await readHookInput({ isTTY: true }, 50)).toBeNull()
  })

  it('T0657: with a stop field it ends at the fields before it — a batch far over STDIN_MAX_BYTES still reads; otherwise as before', async () => {
    const s1 = new PassThrough()
    const p1 = readHookInput(s1, 1000, 'tool_calls')
    s1.write('{"session_id":"s","agent_id":"a7","hook_event_name":"PostToolBatch",')
    s1.write(`"tool_calls":[{"tool_name":"Read","tool_response":"${'x'.repeat(300 * 1024)}"}]}`) // never ended
    expect(await p1).toEqual({ session_id: 's', agent_id: 'a7', hook_event_name: 'PostToolBatch' })
    // without it the same input is over the cap → null
    const s2 = new PassThrough()
    const p2 = readHookInput(s2, 1000)
    s2.end(`{"hook_event_name":"PostToolBatch","tool_calls":[{"tool_response":"${'x'.repeat(300 * 1024)}"}]}`)
    expect(await p2).toBeNull()
    // the stop field missing: the whole JSON as before
    const s3 = new PassThrough()
    const p3 = readHookInput(s3, 1000, 'tool_input')
    s3.end('{"hook_event_name":"PermissionRequest","tool_name":"Bash"}')
    expect(await p3).toEqual({ hook_event_name: 'PermissionRequest', tool_name: 'Bash' })
  })
})

describe('reportHook', () => {
  const env = { BAT_REMOTE_PORT: '1', BAT_REMOTE_TOKEN: 'batcap.x' }
  const conn = (outcome) => {
    const calls = []
    return { calls, close() { calls.push('close') }, async invoke(channel, args, timeoutMs) { calls.push([channel, args, timeoutMs]); return outcome } }
  }

  it('one terminal:report-hook with the report; the result string; always closes', async () => {
    const c = conn({ ok: true, result: { ok: true, result: 'blocked' } })
    expect(await reportHook('ask-user-question', { tool_input: { secret: 1 } }, { env, connection: c })).toMatchObject({ result: 'blocked' })
    expect(c.calls).toEqual([['terminal:report-hook', [{ event: 'ask-user-question' }], 1000], 'close'])
  })

  it('T0642: the session id goes in the report and back in the outcome (for the log); a BAT refusing it is still a result', async () => {
    const c = conn({ ok: true, result: { ok: true, result: 'started' } })
    expect(await reportHook('session-start', { hook_event_name: 'SessionStart', session_id: SID, source: 'startup' }, { env, connection: c }))
      .toMatchObject({ result: 'started', sessionId: SID })
    expect(c.calls).toEqual([['terminal:report-hook', [{ event: 'session-start', sessionId: SID }], 1000], 'close'])
    expect(await reportHook('session-start', { session_id: SID }, { env, connection: conn({ ok: true, result: { ok: false, code: 'INVALID_ARGS' } }) }))
      .toMatchObject({ result: 'failed', code: 'INVALID_ARGS', sessionId: SID })
    expect(await reportHook('session-start', { session_id: 'nope' }, { env, connection: conn({ ok: true, result: { ok: true, result: 'started' } }) }))
      .not.toHaveProperty('sessionId')
  })

  it('T0657: the agent id goes in the report and back in the outcome (for the log)', async () => {
    const c = conn({ ok: true, result: { ok: true, result: 'cleared' } })
    expect(await reportHook('post-tool-batch', { hook_event_name: 'PostToolBatch', agent_id: 'a5', tool_calls: [{ tool_input: 'SECRET' }] }, { env, connection: c }))
      .toMatchObject({ result: 'cleared', agentId: 'a5' })
    expect(c.calls).toEqual([['terminal:report-hook', [{ event: 'post-tool-batch', agentId: 'a5' }], 1000], 'close'])
    // a BAT before T0657 answers the event INVALID_ARGS: still a result
    expect(await reportHook('post-tool-batch', { hook_event_name: 'PostToolBatch' }, { env, connection: conn({ ok: true, result: { ok: false, code: 'INVALID_ARGS', message: 'event' } }) }))
      .toMatchObject({ result: 'failed', code: 'INVALID_ARGS' })
  })

  it('failures are results, never throws: transport, channel error, throwing connection; skipped / not in BAT', async () => {
    expect(await reportHook('stop', {}, { env, connection: conn({ ok: false, code: 'CONNECT_FAILED' }) })).toMatchObject({ result: 'failed', code: 'CONNECT_FAILED' })
    expect(await reportHook('stop', {}, { env, connection: conn({ ok: true, result: { ok: false, code: 'NOT_FOUND' } }) })).toMatchObject({ result: 'failed', code: 'NOT_FOUND' })
    const throwing = { close() { throw new Error('x') }, async invoke() { throw new Error('boom') } }
    expect(await reportHook('stop', {}, { env, connection: throwing })).toMatchObject({ result: 'failed', code: 'ERROR' })
    expect(await reportHook('bogus', {}, { env, connection: conn({ ok: true }) })).toMatchObject({ result: 'skipped' })
    expect(await reportHook('stop', {}, { env: {} })).toMatchObject({ result: 'not-in-bat' })
  })
})
