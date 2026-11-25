// PLAN-068 W3 / T0905 (D328 R1′): scripts/bat-hook.mjs `stop` sends claude's `last_assistant_message`
// (cut to 16 KiB UTF-8 bytes, `messageTruncated` when cut), and every report from main carries
// `origin` / `set`. The T0590 rules are unchanged (exit 0, nothing on stdout, silent failures):
// the whole script is run as claude runs it.
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'child_process'
import { rmSync } from 'fs'
import { PassThrough } from 'stream'
import path from 'path'
import { fileURLToPath } from 'url'
import { BAT_HOOK_SET, HOOK_ORIGIN_INJECTED, hookReport, LAST_MESSAGE_MAX_BYTES, readHookInput, reportHook, STDIN_MAX_BYTES, truncateUtf8 } from '../bat-hook.mjs'
import { BAT_HOOK_SET as LAUNCH_HOOK_SET, BAT_CLAUDE_HOOKS } from '../../electron/bat-mcp-launch'

const HOOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bat-hook.mjs')
const env = { BAT_REMOTE_PORT: '1', BAT_REMOTE_TOKEN: 'batcap.x' }
const conn = () => {
  const calls = []
  return { calls, close() {}, async invoke(channel, args) { calls.push([channel, args]); return { ok: true, result: { ok: true, result: 'unchanged' } } } }
}

describe('T0905: the hook set version', () => {
  it('the script and electron/bat-mcp-launch.ts declare the same set; 2 = Stop sends the last message', () => {
    expect(BAT_HOOK_SET).toBe(LAUNCH_HOOK_SET)
    expect(BAT_HOOK_SET).toBe(2)
    expect(HOOK_ORIGIN_INJECTED).toBe('injected')
    expect(BAT_CLAUDE_HOOKS.find(h => h.hookEvent === 'Stop')).toEqual({ hookEvent: 'Stop', event: 'stop', async: true })
  })
})

describe('T0905: truncateUtf8', () => {
  it('keeps text within the limit; cuts on a character boundary, never inside a multi-byte one', () => {
    expect(truncateUtf8('abc', 3)).toEqual({ text: 'abc', truncated: false })
    expect(truncateUtf8('abcd', 3)).toEqual({ text: 'abc', truncated: true })
    // 塔 = 3 bytes: a cut at 4 bytes keeps one whole character
    expect(truncateUtf8('塔台', 4)).toEqual({ text: '塔', truncated: true })
    expect(truncateUtf8('塔台', 6)).toEqual({ text: '塔台', truncated: false })
    // a 4-byte emoji cut in the middle goes whole
    expect(truncateUtf8('a😀b', 3)).toEqual({ text: 'a', truncated: true })
    expect(LAST_MESSAGE_MAX_BYTES).toBe(16 * 1024)
    const long = '台'.repeat(10_000) // 30,000 bytes
    const cut = truncateUtf8(long)
    expect(cut.truncated).toBe(true)
    expect(Buffer.byteLength(cut.text, 'utf8')).toBeLessThanOrEqual(LAST_MESSAGE_MAX_BYTES)
    expect(cut.text).not.toContain('�')
    expect(cut.text.length).toBe(Math.floor(LAST_MESSAGE_MAX_BYTES / 3))
  })
})

describe('T0905: hookReport reads last_assistant_message on stop only', () => {
  it('stop: the message (cut), messageTruncated only when cut; blank / missing / not a string → the event alone', () => {
    expect(hookReport('stop', { hook_event_name: 'Stop', session_id: 's', transcript_path: '/t', last_assistant_message: '完成。下一步…' }))
      .toEqual({ event: 'stop', lastAssistantMessage: '完成。下一步…' })
    const big = 'x'.repeat(LAST_MESSAGE_MAX_BYTES + 10)
    expect(hookReport('stop', { hook_event_name: 'Stop', last_assistant_message: big }))
      .toEqual({ event: 'stop', lastAssistantMessage: 'x'.repeat(LAST_MESSAGE_MAX_BYTES), messageTruncated: true })
    expect(hookReport('stop', { hook_event_name: 'Stop', last_assistant_message: '   \n' })).toEqual({ event: 'stop' })
    expect(hookReport('stop', { hook_event_name: 'Stop', last_assistant_message: 42 })).toEqual({ event: 'stop' })
    expect(hookReport('stop', { hook_event_name: 'Stop' })).toEqual({ event: 'stop' })
    expect(hookReport('stop', null)).toEqual({ event: 'stop' })
  })

  it('no other event reads the field', () => {
    const m = { last_assistant_message: 'SECRET' }
    expect(hookReport('user-prompt-submit', { hook_event_name: 'UserPromptSubmit', ...m })).toEqual({ event: 'user-prompt-submit' })
    expect(hookReport('session-start', { hook_event_name: 'SessionStart', ...m })).toEqual({ event: 'session-start' })
    expect(hookReport('permission-request', { hook_event_name: 'PermissionRequest', tool_name: 'Bash', ...m })).toEqual({ event: 'permission-request', toolName: 'Bash' })
    expect(hookReport('post-tool-batch', { hook_event_name: 'PostToolBatch', ...m })).toEqual({ event: 'post-tool-batch' })
    // the input of another hook: nothing at all
    expect(hookReport('stop', { hook_event_name: 'UserPromptSubmit', ...m })).toBeNull()
  })

  it('stdin keeps the existing limit: an input over STDIN_MAX_BYTES reads as none (the stop is still reported, without a message)', async () => {
    const s = new PassThrough()
    const p = readHookInput(s, 2000)
    s.end(JSON.stringify({ hook_event_name: 'Stop', last_assistant_message: 'y'.repeat(STDIN_MAX_BYTES + 1) }))
    const input = await p
    expect(input).toBeNull()
    expect(hookReport('stop', input)).toEqual({ event: 'stop' })
  })
})

describe('T0905: reportHook sends the message, origin and set; the outcome has the length only', () => {
  it('origin / set as main passes them, beside `at`; absent → not sent (the existing reports unchanged)', async () => {
    const c = conn()
    const out = await reportHook('stop', { hook_event_name: 'Stop', last_assistant_message: '塔台回合' }, { env, connection: c, at: '7', origin: HOOK_ORIGIN_INJECTED, set: BAT_HOOK_SET })
    expect(c.calls).toEqual([['terminal:report-hook', [{ event: 'stop', lastAssistantMessage: '塔台回合', at: '7', origin: 'injected', set: 2 }]]])
    expect(out).toMatchObject({ result: 'unchanged', messageBytes: 12 })
    expect(JSON.stringify(out)).not.toContain('塔台回合')
    const c2 = conn()
    await reportHook('user-prompt-submit', { hook_event_name: 'UserPromptSubmit' }, { env, connection: c2, origin: 'injected', set: 2 })
    expect(c2.calls).toEqual([['terminal:report-hook', [{ event: 'user-prompt-submit', origin: 'injected', set: 2 }]]])
    const c3 = conn()
    await reportHook('stop', { hook_event_name: 'Stop' }, { env, connection: c3, set: 1.5 })
    expect(c3.calls).toEqual([['terminal:report-hook', [{ event: 'stop' }]]])
  })
})

describe('T0905: the script as claude runs it (T0590 rules unchanged)', () => {
  const run = (event, input, extraEnv) => spawnSync(process.execPath, [HOOK, event], {
    input,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, ...extraEnv },
  })

  it('outside BAT: exit 0, nothing on stdout, at once', () => {
    const r = run('stop', JSON.stringify({ hook_event_name: 'Stop', last_assistant_message: 'x' }), { BAT_REMOTE_PORT: '', BAT_REMOTE_TOKEN: '' })
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('')
  })

  it('in BAT with no endpoint listening (port 1): exit 0, nothing on stdout, within the deadline', () => {
    const logDir = path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', `t0905-hook-${process.pid}`)
    const started = Date.now()
    const r = run('stop', JSON.stringify({ hook_event_name: 'Stop', last_assistant_message: 'z'.repeat(40_000) }), {
      BAT_REMOTE_PORT: '1',
      BAT_REMOTE_TOKEN: 'batcap.test',
      BAT_TERMINAL_ID: 't-test',
      BAT_HELPER_LOG_DIR: logDir,
      BAT_USER_DATA: logDir,
    })
    rmSync(logDir, { recursive: true, force: true })
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('')
    expect(Date.now() - started).toBeLessThan(15_000)
  })
})
