// @vitest-environment node
// PLAN-048 / T0608 (T0606「介面契約」C-5): bat-notify.mjs --ask / --wait-answer / --cancel-question,
// against a mock RemoteServer that keeps broadcasting (replies matched by frame id, BUG-114):
//   - --ask: stdin JSON → question:ask (only the known keys, --expires-min → expiresInMs), then
//     the usual notify (terminal:notify with questionId, T0613 → pty:write → --submit terminal:keypress); stdout
//     "  question: / expires: / notified: yes"; exit 0 / 3 NOT_FOUND / 10 TOO_MANY_QUESTIONS / 1
//   - T0716: --ask --no-pty-write = exactly question:ask → terminal:notify (CT v5.15.0's batched
//     questions depend on it), same stdout; a `false` notify reply is a failed step under --ask
//   - any notify step failing → question:cancel → exit 1, stderr ask: NOTIFY_STEP <step> then
//     ask: NOTIFY_FAILED (last line); a failed keypress says the pre-fill is left, Enter was not sent
//   - an older host (No handler / channel-not-allowed) → ask: UNSUPPORTED, exit 1, nothing notified
//   - stdin: not JSON / not an object / no question / empty / > 64 KiB / not UTF-8 → exit 1
//     ask: INVALID_INPUT, no connection, the input never echoed; a UTF-8 BOM is dropped
//   - D155: the question / answer text is never in argv, bat-scripts.log or the --ask stdout
//   - --wait-answer: one line of JSON (stdout's last line), exit 0 for any status (pending, lost),
//     3 NOT_FOUND / 4 NOT_OWNER / 1; --timeout-ms is cut to 45000
//   - --cancel-question: exit 0 / 3 / 4; lost is an ended question (exit 0, status: lost — the real
//     main process's reply, T0611); usage errors before any connection
import { afterAll, describe, expect, it } from 'vitest'
import { cleanupTempDirs, helperEvents, helperLogText, offlineEnv, runHelper, startMockRemote } from './_question-mock-remote.mjs'

afterAll(() => cleanupTempDirs())

const QID = 'q-0123abcd-0123456789abcdef'
const ASKED = { result: { ok: true, questionId: QID, status: 'pending', towerTerminalId: 'tower-1', createdAt: Date.UTC(2026, 9, 18, 5, 0, 0), expiresAt: Date.UTC(2026, 9, 18, 5, 30, 0), masked: 0 } }
const run = (args, env, stdin) => runHelper('bat-notify.mjs', args, env, stdin)
const lastLine = (text) => text.trim().split(/\r?\n/).at(-1)

// unique markers: none of them may reach argv, the log or the --ask stdout
const SECRET_Q = 'QTEXT-7f3a 這題要不要改 schema？'
const SECRET_OPT = 'OPTTEXT-91c2'
const SECRET_DETAIL = 'DETAILTEXT-5d0e'
const QUESTION = { question: SECRET_Q, options: [`${SECRET_OPT} A`, `${SECRET_OPT} B`], allowFreeText: true, detail: SECRET_DETAIL, blocking: true }

describe('bat-notify --ask (T0608)', () => {
  it('asks, then notifies; stdout has id / expiry / notified; the stdin JSON reaches question:ask', async () => {
    const remote = await startMockRemote({ 'question:ask': ASKED })
    try {
      const r = await run(['--ask', '--source', 'T0608', '--expires-min', '30', 'T0608 提問'], remote.env, JSON.stringify({ ...QUESTION, extra: 'dropped' }))
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes.map(i => i.channel)).toEqual(['question:ask', 'terminal:notify', 'pty:write'])
      expect(remote.invokes[0].args).toEqual([{ ...QUESTION, expiresInMs: 1_800_000 }])
      // T0613 (BUG-154): the notify carries the question id (not its text), so the Worker tab is not marked reported
      expect(remote.invokes[1].args).toEqual([{ targetId: 'tower-1', message: 'T0608 提問', source: 'T0608', questionId: QID }])
      expect(remote.invokes[2].args).toEqual(['tower-1', 'T0608 提問'])
      const lines = r.stdout.trim().split(/\r?\n/)
      expect(lines).toEqual([
        '✓ Notified tower-1…: T0608 提問',
        `  question: ${QID}`,
        '  expires: 2026-10-18T05:30:00.000Z',
        '  notified: yes',
      ])
      expect(helperEvents(remote.dir, 'bat-notify', 'question-ask').at(-1)).toMatchObject({
        result: 'ok', questionId: QID, questionLength: SECRET_Q.length, optionsCount: 2, detailLength: SECRET_DETAIL.length, blocking: true, expiresInMs: 1_800_000,
      })
      expect(helperEvents(remote.dir, 'bat-notify', 'exit').at(-1)).toEqual(expect.objectContaining({ code: 0 }))
    } finally {
      await remote.close()
    }
  }, 20000)

  it('T0613: a plain notify (no --ask) carries no questionId', async () => {
    const remote = await startMockRemote({})
    try {
      const r = await run(['--source', 'T0613', '--no-pty-write', 'T0613 完成'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes.map(i => i.channel)).toEqual(['terminal:notify'])
      expect(remote.invokes[0].args).toEqual([{ targetId: 'tower-1', message: 'T0613 完成', source: 'T0613' }])
    } finally {
      await remote.close()
    }
  }, 20000)

  it('T0716: --ask --no-pty-write → only question:ask, terminal:notify; same stdout; flag order does not matter', async () => {
    for (const args of [
      ['--ask', '--no-pty-write', '--source', 'T0716', 'T0716 提問'],
      ['--no-pty-write', '--source', 'T0716', '--ask', 'T0716 提問'],
    ]) {
      const remote = await startMockRemote({ 'question:ask': ASKED })
      try {
        const r = await run(args, remote.env, JSON.stringify({ question: 'ok?' }))
        expect(r.code, `${args.join(' ')}: ${r.stderr}`).toBe(0)
        expect(remote.invokes.map(i => i.channel), args.join(' ')).toEqual(['question:ask', 'terminal:notify'])
        expect(remote.invokes[1].args).toEqual([{ targetId: 'tower-1', message: 'T0716 提問', source: 'T0716', questionId: QID }])
        expect(r.stdout.trim().split(/\r?\n/)).toEqual([
          '✓ Notified tower-1…: T0716 提問',
          `  question: ${QID}`,
          '  expires: 2026-10-18T05:30:00.000Z',
          '  notified: yes',
        ])
        expect(r.stderr).toBe('')
      } finally {
        await remote.close()
      }
    }
  }, 30000)

  it('--submit adds the Enter keypress after the pre-fill; without --expires-min no expiresInMs is sent', async () => {
    const remote = await startMockRemote({ 'question:ask': ASKED })
    try {
      const r = await run(['--ask', '--submit', 'T0608 提問'], remote.env, JSON.stringify({ question: 'ok?' }))
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes.map(i => i.channel)).toEqual(['question:ask', 'terminal:notify', 'pty:write', 'terminal:keypress'])
      expect(remote.invokes[0].args).toEqual([{ question: 'ok?' }])
      expect(remote.invokes[3].args[0]).toMatchObject({ targetId: 'tower-1', key: 'Enter' })
      expect(r.stdout).toContain('  notified: yes')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('D155: question / options / detail text never reach argv, bat-scripts.log or stdout', async () => {
    const remote = await startMockRemote({ 'question:ask': ASKED })
    try {
      const r = await run(['--ask', '--source', 'T0608', '--submit', 'T0608 提問'], remote.env, JSON.stringify(QUESTION))
      expect(r.code, r.stderr).toBe(0)
      // it did reach BAT (only over the socket)
      expect(JSON.stringify(remote.invokes[0].args)).toContain(SECRET_Q)
      const log = helperLogText(remote.dir)
      expect(log.length).toBeGreaterThan(0)
      for (const secret of [SECRET_Q, SECRET_OPT, SECRET_DETAIL, 'QTEXT', '這題要不要改']) {
        expect(log, secret).not.toContain(secret)
        expect(r.stdout, secret).not.toContain(secret)
        expect(r.stderr, secret).not.toContain(secret)
      }
      const invoke = helperEvents(remote.dir, 'bat-notify', 'invoke').at(-1)
      expect(invoke.argv).toEqual(['--ask', '--source', 'T0608', '--submit', 'T0608 提問'])
    } finally {
      await remote.close()
    }
  }, 20000)

  it('a UTF-8 BOM is dropped; CJK text arrives intact', async () => {
    const remote = await startMockRemote({ 'question:ask': ASKED })
    try {
      const body = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify({ question: '選 A 還是 B？', options: ['甲', '乙'] }), 'utf8')])
      const r = await run(['--ask', 'T0608 提問'], remote.env, body)
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes[0].args).toEqual([{ question: '選 A 還是 B？', options: ['甲', '乙'] }])
    } finally {
      await remote.close()
    }
  }, 20000)

  // [name, failing replies, extra flag, channels, NOTIFY_STEP]
  const notifyFailures = [
    ['terminal:notify error', { 'terminal:notify': { error: 'Forbidden: target-not-bound' } }, '--submit', ['question:ask', 'terminal:notify', 'question:cancel'], 'notify'],
    ['terminal:notify error, --no-pty-write', { 'terminal:notify': { error: 'Forbidden: target-not-bound' } }, '--no-pty-write', ['question:ask', 'terminal:notify', 'question:cancel'], 'notify'],
    // T0716 (T0715 A5): the handler refused the payload (`false`): a plain notify ignores it, --ask does not
    ['terminal:notify false', { 'terminal:notify': { result: false } }, '--submit', ['question:ask', 'terminal:notify', 'question:cancel'], 'notify'],
    ['terminal:notify false, --no-pty-write', { 'terminal:notify': { result: false } }, '--no-pty-write', ['question:ask', 'terminal:notify', 'question:cancel'], 'notify'],
    ['pty:write refused', { 'pty:write': { result: { ok: false, reason: 'not-found' } } }, '--submit', ['question:ask', 'terminal:notify', 'pty:write', 'question:cancel'], 'pty-write'],
    ['terminal:keypress refused', { 'terminal:keypress': { result: { ok: false, reason: 'no-renderer' } } }, '--submit', ['question:ask', 'terminal:notify', 'pty:write', 'terminal:keypress', 'question:cancel'], 'keypress'],
  ]
  for (const [name, failing, flag, channels, step] of notifyFailures) {
    it(`notify fails (${name}) → question:cancel, exit 1, ask: NOTIFY_STEP ${step}, ask: NOTIFY_FAILED`, async () => {
      const remote = await startMockRemote({ 'question:ask': ASKED, 'question:cancel': { result: { ok: true, questionId: QID, status: 'cancelled', endReason: 'worker' } }, ...failing })
      try {
        const r = await run(['--ask', flag, 'T0608 提問'], remote.env, JSON.stringify({ question: 'ok?' }))
        expect(r.code).toBe(1)
        expect(remote.invokes.map(i => i.channel)).toEqual(channels)
        expect(remote.invokes.at(-1).args).toEqual([{ questionId: QID }])
        expect(r.stderr.trim().split(/\r?\n/).slice(-2)).toEqual([`ask: NOTIFY_STEP ${step}`, 'ask: NOTIFY_FAILED'])
        expect(r.stderr).toContain(`question ${QID} was cancelled`)
        if (step === 'keypress') {
          // T0716 (T0715 Q-B3): the toast and the pre-fill did reach the Tower
          expect(r.stderr).toContain('Error: terminal keypress failed: no-renderer')
          expect(r.stderr).toContain('the pre-fill was written to its input box, but Enter was not sent')
          expect(r.stderr).not.toContain('was not notified')
        } else {
          expect(r.stderr).toContain('The Tower was not notified')
        }
        expect(r.stdout).not.toContain('notified: yes')
        expect(helperEvents(remote.dir, 'bat-notify', 'question-cancel').at(-1)).toMatchObject({ questionId: QID, after: 'notify-failed', result: 'ok' })
        expect(helperEvents(remote.dir, 'bat-notify', 'exit').at(-1)).toMatchObject({ code: 1, reason: 'ask-notify-failed' })
      } finally {
        await remote.close()
      }
    }, 20000)
  }

  it('notify fails and the cancel fails too → still exit 1, says when the question expires', async () => {
    const remote = await startMockRemote({ 'question:ask': ASKED, 'terminal:notify': { error: 'boom' }, 'question:cancel': { result: { ok: false, code: 'NOT_FOUND' } } })
    try {
      const r = await run(['--ask', 'T0608 提問'], remote.env, JSON.stringify({ question: 'ok?' }))
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('The Tower was not notified, and question')
      expect(r.stderr).toContain('could not be cancelled (NOT_FOUND)')
      expect(r.stderr).toContain('2026-10-18T05:30:00.000Z')
      expect(r.stderr.trim().split(/\r?\n/).slice(-2)).toEqual(['ask: NOTIFY_STEP notify', 'ask: NOTIFY_FAILED'])
    } finally {
      await remote.close()
    }
  }, 20000)

  it('T0716: keypress fails and the cancel fails too → says Enter was not sent and when the question expires', async () => {
    const remote = await startMockRemote({ 'question:ask': ASKED, 'terminal:keypress': { result: { ok: false, reason: 'no-client' } }, 'question:cancel': { result: { ok: false, code: 'NOT_FOUND' } } })
    try {
      const r = await run(['--ask', '--submit', 'T0716 提問'], remote.env, JSON.stringify({ question: 'ok?' }))
      expect(r.code).toBe(1)
      expect(r.stderr).toContain('but Enter was not sent (the text is left there), and question')
      expect(r.stderr).toContain('could not be cancelled (NOT_FOUND)')
      expect(r.stderr).toContain('2026-10-18T05:30:00.000Z')
      expect(r.stderr).not.toContain('was not notified')
      expect(r.stderr.trim().split(/\r?\n/).slice(-2)).toEqual(['ask: NOTIFY_STEP keypress', 'ask: NOTIFY_FAILED'])
    } finally {
      await remote.close()
    }
  }, 20000)

  it('T0716: a plain notify (no --ask) still ignores a `false` notify reply (exit 0, unchanged)', async () => {
    const remote = await startMockRemote({ 'terminal:notify': { result: false } })
    try {
      const r = await run(['--no-pty-write', 'T0716 完成'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes.map(i => i.channel)).toEqual(['terminal:notify'])
      expect(r.stderr).not.toContain('NOTIFY_')
    } finally {
      await remote.close()
    }
  }, 20000)

  const askRefusals = [
    [{ result: { ok: false, code: 'NOT_FOUND' } }, 3, 'NOT_FOUND'],
    [{ result: { ok: false, code: 'TOO_MANY_QUESTIONS' } }, 10, 'TOO_MANY_QUESTIONS'],
    [{ result: { ok: false, code: 'INVALID_ARGS', message: 'question too long' } }, 1, 'INVALID_ARGS'],
    [{ error: 'No handler for channel: question:ask' }, 1, 'UNSUPPORTED'],
    [{ error: 'Forbidden: channel-not-allowed' }, 1, 'UNSUPPORTED'],
    [{ error: 'Forbidden: role-not-allowed' }, 1, 'FORBIDDEN'],
  ]
  it('question:ask refused → its exit code, ask: <CODE>, nothing notified', async () => {
    for (const [reply, exitCode, code] of askRefusals) {
      const remote = await startMockRemote({ 'question:ask': reply })
      try {
        const r = await run(['--ask', '--submit', 'T0608 提問'], remote.env, JSON.stringify({ question: 'ok?' }))
        expect(r.code, `${code}: ${r.stderr}`).toBe(exitCode)
        expect(r.stderr).toContain(`ask: ${code}`)
        if (code === 'UNSUPPORTED') expect(r.stderr.match(/does not support questions/g)).toHaveLength(1)
        expect(remote.invokes.map(i => i.channel)).toEqual(['question:ask'])
        expect(helperEvents(remote.dir, 'bat-notify', 'question-ask').at(-1)).toMatchObject({ result: code })
      } finally {
        await remote.close()
      }
    }
  }, 60000)

  it('replies are matched by frame id (a reply with another id and broadcasts are ignored)', async () => {
    const remote = await startMockRemote({ 'question:ask': ASKED }, { decoy: true })
    try {
      const r = await run(['--ask', 'T0608 提問'], remote.env, JSON.stringify({ question: 'ok?' }))
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout).toContain(`  question: ${QID}`)
    } finally {
      await remote.close()
    }
  }, 20000)

  it('bad stdin → exit 1, ask: INVALID_INPUT, no connection, the input never echoed', async () => {
    const { env, dir } = offlineEnv()
    const cases = [
      ['{"question": "LEAK-1f9a', /stdin is not valid JSON/],
      ['"LEAK-1f9a"', /must be an object/],
      ['["LEAK-1f9a"]', /must be an object/],
      ['{"options": ["LEAK-1f9a"]}', /"question" \(a non-empty string\) is required/],
      ['{"question": "   "}', /"question" \(a non-empty string\) is required/],
      ['', /must come as JSON on stdin/],
      [`{"question": "${'x'.repeat(70_000)}"}`, /larger than 65536 bytes/],
      [Buffer.from([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]), /not UTF-8/],
    ]
    for (const [stdin, message] of cases) {
      const r = await run(['--ask', 'T0608 提問'], env, stdin)
      expect(r.code, String(message)).toBe(1)
      expect(r.stderr, String(message)).toMatch(message)
      expect(r.stderr).toContain('ask: INVALID_INPUT')
      expect(r.stderr).not.toContain('LEAK-1f9a')
      expect(r.stderr).not.toContain('CONNECT_FAILED')
    }
    // no stdin at all ('ignore' = end at once)
    const none = await run(['--ask', 'T0608 提問'], env)
    expect(none.code).toBe(1)
    expect(none.stderr).toContain('ask: INVALID_INPUT')
    expect(helperLogText(dir)).not.toContain('LEAK-1f9a')
  }, 60000)
})

describe('bat-notify --wait-answer / --cancel-question (T0608)', () => {
  const ANSWER_TEXT = 'ANSWERTEXT-c41b 用方案 B'

  it('answered: stdout last line is the reply (without ok) as one line of JSON; the log has no answer text', async () => {
    const reply = { ok: true, questionId: QID, changed: true, status: 'answered', answer: { choice: 2, text: `${ANSWER_TEXT}\n第二行` }, answeredAt: 5, waitedMs: 1200 }
    const remote = await startMockRemote({ 'question:wait': { result: reply } })
    try {
      const r = await run(['--wait-answer', QID, '--timeout-ms', '30000'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes.map(i => i.channel)).toEqual(['question:wait'])
      expect(remote.invokes[0].args).toEqual([{ questionId: QID, timeoutMs: 30000 }])
      const { ok: _ok, ...data } = reply
      expect(JSON.parse(lastLine(r.stdout))).toEqual(data)
      expect(r.stdout.trim().split(/\r?\n/)).toHaveLength(1)
      const log = helperLogText(remote.dir)
      expect(log).not.toContain('ANSWERTEXT')
      expect(log).not.toContain('第二行')
      expect(helperEvents(remote.dir, 'bat-notify', 'question-wait').at(-1)).toMatchObject({ questionId: QID, status: 'answered', changed: true, choice: 2, answerLength: reply.answer.text.length })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('pending (timed out) and lost are exit 0; no --timeout-ms = the BAT default (not sent)', async () => {
    for (const reply of [
      { ok: true, questionId: QID, changed: false, status: 'pending', waitedMs: 45000 },
      { ok: true, questionId: QID, changed: true, status: 'lost', waitedMs: 0 },
    ]) {
      const remote = await startMockRemote({ 'question:wait': { result: reply } })
      try {
        const r = await run(['--wait-answer', QID], remote.env)
        expect(r.code, r.stderr).toBe(0)
        expect(remote.invokes[0].args).toEqual([{ questionId: QID }])
        expect(JSON.parse(lastLine(r.stdout))).toMatchObject({ status: reply.status, changed: reply.changed })
      } finally {
        await remote.close()
      }
    }
  }, 30000)

  it('refusals: NOT_FOUND 3 / NOT_OWNER 4 / UNSUPPORTED 1 / TOO_MANY_WAITS 1, stderr wait-answer: <CODE>', async () => {
    for (const [reply, exitCode, code] of [
      [{ result: { ok: false, code: 'NOT_FOUND' } }, 3, 'NOT_FOUND'],
      [{ result: { ok: false, code: 'NOT_OWNER' } }, 4, 'NOT_OWNER'],
      [{ error: 'No handler for channel: question:wait' }, 1, 'UNSUPPORTED'],
      [{ result: { ok: false, code: 'TOO_MANY_WAITS' } }, 1, 'TOO_MANY_WAITS'],
    ]) {
      const remote = await startMockRemote({ 'question:wait': reply })
      try {
        const r = await run(['--wait-answer', QID], remote.env)
        expect(r.code, `${code}: ${r.stderr}`).toBe(exitCode)
        expect(r.stderr).toContain(`wait-answer: ${code}`)
        expect(r.stdout).toBe('')
      } finally {
        await remote.close()
      }
    }
  }, 60000)

  it('--timeout-ms over 45000 is cut (with a note); replies matched by frame id', async () => {
    const remote = await startMockRemote({ 'question:wait': { result: { ok: true, questionId: QID, changed: false, status: 'pending', waitedMs: 1 } } }, { decoy: true })
    try {
      const r = await run(['--wait-answer', QID, '--timeout-ms', '99999'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(r.stderr).toContain('--timeout-ms 99999: waiting at most 45000 ms.')
      expect(remote.invokes[0].args).toEqual([{ questionId: QID, timeoutMs: 45000 }])
      expect(JSON.parse(lastLine(r.stdout)).status).toBe('pending')
    } finally {
      await remote.close()
    }
  }, 20000)

  it('--cancel-question: cancelled / already ended / lost → exit 0; NOT_OWNER 4; NOT_FOUND 3', async () => {
    const ok = await startMockRemote({ 'question:cancel': { result: { ok: true, questionId: QID, status: 'cancelled', endReason: 'worker' } } })
    try {
      const r = await run(['--cancel-question', QID], ok.env)
      expect(r.code, r.stderr).toBe(0)
      expect(ok.invokes.map(i => [i.channel, i.args])).toEqual([['question:cancel', [{ questionId: QID }]]])
      expect(r.stdout.trim().split(/\r?\n/)).toEqual([`✓ Question cancelled: ${QID}`, '  status: cancelled worker'])
    } finally {
      await ok.close()
    }
    const ended = await startMockRemote({ 'question:cancel': { result: { ok: true, questionId: QID, status: 'answered' } } })
    try {
      const r = await run(['--cancel-question', QID], ended.env)
      expect(r.code).toBe(0)
      expect(r.stdout).toContain(`✓ Question already ended: ${QID}`)
      expect(r.stdout).toContain('  status: answered')
    } finally {
      await ended.close()
    }
    // T0611: the real main process answers a lost id with ok + status lost (electron/tower-questions.ts)
    const lost = await startMockRemote({ 'question:cancel': { result: { ok: true, questionId: QID, status: 'lost' } } })
    try {
      const r = await run(['--cancel-question', QID], lost.env)
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout.trim().split(/\r?\n/)).toEqual([`✓ Question already ended: ${QID}`, '  status: lost'])
      expect(r.stderr).toBe('')
      expect(helperEvents(lost.dir, 'bat-notify', 'question-cancel').at(-1)).toMatchObject({ questionId: QID, result: 'ok', status: 'lost' })
    } finally {
      await lost.close()
    }
    for (const [reply, exitCode, code] of [
      [{ result: { ok: false, code: 'NOT_OWNER' } }, 4, 'NOT_OWNER'],
      [{ result: { ok: false, code: 'NOT_FOUND' } }, 3, 'NOT_FOUND'],
      [{ error: 'Forbidden: channel-not-allowed' }, 1, 'UNSUPPORTED'],
    ]) {
      const remote = await startMockRemote({ 'question:cancel': reply })
      try {
        const r = await run(['--cancel-question', QID], remote.env)
        expect(r.code, `${code}: ${r.stderr}`).toBe(exitCode)
        expect(r.stderr).toContain(`cancel-question: ${code}`)
      } finally {
        await remote.close()
      }
    }
  }, 60000)
})

describe('usage errors (no connection)', () => {
  it('bad values / combinations exit 1 with <mode>: USAGE before connecting', async () => {
    const { env } = offlineEnv()
    const cases = [
      [['--ask', '--expires-min', '0', 'T0608 提問'], /Invalid --expires-min value: '0'/, 'ask: USAGE'],
      [['--ask', '--expires-min', '121', 'T0608 提問'], /Invalid --expires-min value: '121'/, 'ask: USAGE'],
      [['--ask', '--expires-min', 'abc', 'T0608 提問'], /Invalid --expires-min value/, 'ask: USAGE'],
      [['--expires-min', '5', 'T0608 完成'], /--expires-min is only valid with --ask/, 'ask: USAGE'],
      [['--ask'], /Message is required/, 'ask: USAGE'],
      [['--ask', '--submit', '--no-pty-write', 'x'], /mutually exclusive/, 'ask: USAGE'],
      [['--wait-answer', 'q-nothex'], /Invalid --wait-answer value/, 'wait-answer: USAGE'],
      [['--wait-answer'], /--wait-answer requires a question id/, 'wait-answer: USAGE'],
      [['--wait-answer', QID, 'some message'], /--wait-answer cannot be combined with <message>/, 'wait-answer: USAGE'],
      [['--wait-answer', QID, '--submit'], /--wait-answer cannot be combined with --submit/, 'wait-answer: USAGE'],
      [['--wait-answer', QID, '--ask'], /--wait-answer cannot be combined with --ask/, 'wait-answer: USAGE'],
      [['--wait-answer', QID, '--cancel-question', QID], /--wait-answer cannot be combined with --cancel-question/, 'wait-answer: USAGE'],
      [['--timeout-ms', '100', 'x'], /--timeout-ms is only valid with --wait-answer/, 'wait-answer: USAGE'],
      [['--wait-answer', QID, '--timeout-ms', '1.5'], /Invalid --timeout-ms value/, 'wait-answer: USAGE'],
      [['--cancel-question', QID, '--target', 'tower-1'], /--cancel-question cannot be combined with --target/, 'cancel-question: USAGE'],
    ]
    for (const [args, message, tag] of cases) {
      const r = await run(args, env, '{"question":"x"}')
      expect(r.code, args.join(' ')).toBe(1)
      expect(r.stderr, args.join(' ')).toMatch(message)
      expect(r.stderr, args.join(' ')).toContain(tag)
      expect(r.stderr, args.join(' ')).not.toContain('CONNECT_FAILED')
    }
  }, 60000)

  it('outside BAT: <mode>: NOT_IN_BAT; a typo gets a suggestion', async () => {
    const r = await run(['--wait-answer', QID], { BAT_HELPER_LOG_DIR: offlineEnv().env.BAT_HELPER_LOG_DIR })
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('wait-answer: NOT_IN_BAT')
    const typo = await run(['--asc', 'x'], offlineEnv().env)
    expect(typo.code).toBe(1)
    expect(typo.stderr).toContain("Unknown option '--asc' (did you mean '--ask'?)")
  }, 20000)

  it('--help documents the modes and exit codes', async () => {
    const r = await run(['--help'], {})
    expect(r.code).toBe(0)
    for (const text of ['--ask', '--wait-answer <id>', '--cancel-question <id>', '--expires-min <n>', '--timeout-ms <n>', '10 TOO_MANY_QUESTIONS', 'ask: <CODE>', "Unknown option '--ask'", 'Exit 0 does not mean this call', 'only "status: cancelled worker" does', 'Can be combined with\n                     --no-pty-write', 'ask: NOTIFY_STEP notify|pty-write|keypress']) {
      expect(r.stdout, text).toContain(text)
    }
  }, 20000)
})
