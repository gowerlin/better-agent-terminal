// PLAN-047 M1b-1 / T0590: scripts/bat-hook.mjs — what a hook reports (pure), stdin reading, and
// `reportHook` against a stand-in connection (the real RemoteServer path is
// electron/__tests__/terminal-blocked-state.test.ts).
import { PassThrough } from 'stream'
import { describe, expect, it } from 'vitest'
import { HOOK_EVENTS, hookReport, readHookInput, reportHook } from '../bat-hook.mjs'

describe('hookReport', () => {
  it('the event alone, plus the tool name of a permission prompt; never tool_input / prompt', () => {
    const input = { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: ['x'] }, prompt: 'p', session_id: 's' }
    expect(hookReport('ask-user-question', input)).toEqual({ event: 'ask-user-question' })
    expect(hookReport('permission-request', { hook_event_name: 'PermissionRequest', tool_name: 'mcp__bat__bat_wait', tool_input: { a: 1 } }))
      .toEqual({ event: 'permission-request', toolName: 'mcp__bat__bat_wait' })
    expect(hookReport('permission-request', { tool_name: 'bad name with spaces' })).toEqual({ event: 'permission-request' })
    expect(hookReport('user-prompt-submit', { hook_event_name: 'UserPromptSubmit', prompt: 'SECRET' })).toEqual({ event: 'user-prompt-submit' })
    expect(hookReport('stop', null)).toEqual({ event: 'stop' })
    expect(HOOK_EVENTS).toEqual(['permission-request', 'ask-user-question', 'ask-user-question-done', 'elicitation', 'elicitation-done', 'user-prompt-submit', 'stop', 'session-start'])
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

  it('failures are results, never throws: transport, channel error, throwing connection; skipped / not in BAT', async () => {
    expect(await reportHook('stop', {}, { env, connection: conn({ ok: false, code: 'CONNECT_FAILED' }) })).toMatchObject({ result: 'failed', code: 'CONNECT_FAILED' })
    expect(await reportHook('stop', {}, { env, connection: conn({ ok: true, result: { ok: false, code: 'NOT_FOUND' } }) })).toMatchObject({ result: 'failed', code: 'NOT_FOUND' })
    const throwing = { close() { throw new Error('x') }, async invoke() { throw new Error('boom') } }
    expect(await reportHook('stop', {}, { env, connection: throwing })).toMatchObject({ result: 'failed', code: 'ERROR' })
    expect(await reportHook('bogus', {}, { env, connection: conn({ ok: true }) })).toMatchObject({ result: 'skipped' })
    expect(await reportHook('stop', {}, { env: {} })).toMatchObject({ result: 'not-in-bat' })
  })
})
