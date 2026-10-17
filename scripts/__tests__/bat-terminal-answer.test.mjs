// @vitest-environment node
// PLAN-048 / T0608 (T0606「介面契約」C-5): bat-terminal.mjs --answer <id> --notify-id <tower>
// [--choice <n>] < answer.txt, against a mock RemoteServer that keeps broadcasting (frame id, BUG-114):
//   - question:answer { towerId: --notify-id, questionId, choice?, text? }; the stdin text with its
//     trailing line breaks dropped; blank stdin = no text (then --choice is required)
//   - stdout "  answered: <id>", exit 0; CLOSED → exit 9 + "  status: <status> [<endReason>]";
//     NOT_FOUND → 3 (status lost → stderr answer: LOST); NOT_OWNER → 4; INVALID_ARGS / an older
//     host (UNSUPPORTED) / Forbidden → 1; stderr "answer: <CODE>"
//   - D155: the answer text is never in argv or bat-scripts.log (only its length and the choice)
//   - usage errors before any connection: no --notify-id, --choice alone, bad id / choice, other
//     modes or terminal-creating options, nothing to send; bad stdin → answer: INVALID_INPUT
import { afterAll, describe, expect, it } from 'vitest'
import { cleanupTempDirs, helperEvents, helperLogText, offlineEnv, runHelper, startMockRemote } from './_question-mock-remote.mjs'

afterAll(() => cleanupTempDirs())

const QID = 'q-0123abcd-0123456789abcdef'
const ANSWERED = { result: { ok: true, questionId: QID, status: 'answered', answeredAt: 5, masked: 0 } }
const run = (args, env, stdin) => runHelper('bat-terminal.mjs', args, env, stdin)
const ANSWER = ['--answer', QID, '--notify-id', 'tower-1']
const SECRET = 'ANSWERTEXT-8e21 改用方案 B，理由：相容舊資料'

describe('bat-terminal --answer (T0608)', () => {
  it('choice + text: question:answer gets both (trailing newline dropped); stdout answered, exit 0', async () => {
    const remote = await startMockRemote({ 'question:answer': ANSWERED })
    try {
      const r = await run([...ANSWER, '--choice', '2'], remote.env, `${SECRET}\n第二行\r\n\n`)
      expect(r.code, r.stderr).toBe(0)
      expect(remote.invokes.map(i => i.channel)).toEqual(['question:answer'])
      expect(remote.invokes[0].args).toEqual([{ towerId: 'tower-1', questionId: QID, choice: 2, text: `${SECRET}\n第二行` }])
      expect(r.stdout.trim().split(/\r?\n/)).toEqual([`✓ Question answered: ${QID}`, `  answered: ${QID}`])
      // no --workspace advisory: --answer creates no terminal
      expect(r.stderr).not.toContain('--workspace not specified')
      expect(helperEvents(remote.dir, 'bat-terminal', 'answer').at(-1)).toMatchObject({ questionId: QID, towerId: 'tower-1', choice: 2, textLength: `${SECRET}\n第二行`.length, result: 'OK' })
      expect(helperEvents(remote.dir, 'bat-terminal', 'exit').at(-1)).toMatchObject({ code: 0, reason: 'answer-done' })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('text only / --choice only (no stdin, or blank stdin = no text)', async () => {
    const remote = await startMockRemote({ 'question:answer': ANSWERED })
    try {
      const textOnly = await run(ANSWER, remote.env, 'yes')
      expect(textOnly.code, textOnly.stderr).toBe(0)
      const choiceNoStdin = await run([...ANSWER, '--choice', '1'], remote.env)
      expect(choiceNoStdin.code, choiceNoStdin.stderr).toBe(0)
      const choiceBlank = await run([...ANSWER, '--choice', '3'], remote.env, '  \n')
      expect(choiceBlank.code, choiceBlank.stderr).toBe(0)
      expect(remote.invokes.map(i => i.args[0])).toEqual([
        { towerId: 'tower-1', questionId: QID, text: 'yes' },
        { towerId: 'tower-1', questionId: QID, choice: 1 },
        { towerId: 'tower-1', questionId: QID, choice: 3 },
      ])
    } finally {
      await remote.close()
    }
  }, 30000)

  it('D155: the answer text never reaches argv or bat-scripts.log', async () => {
    const remote = await startMockRemote({ 'question:answer': ANSWERED })
    try {
      const r = await run([...ANSWER, '--choice', '1'], remote.env, SECRET)
      expect(r.code, r.stderr).toBe(0)
      expect(JSON.stringify(remote.invokes[0].args)).toContain(SECRET)
      const log = helperLogText(remote.dir)
      expect(log.length).toBeGreaterThan(0)
      for (const s of [SECRET, 'ANSWERTEXT', '改用方案']) {
        expect(log, s).not.toContain(s)
        expect(r.stdout, s).not.toContain(s)
        expect(r.stderr, s).not.toContain(s)
      }
      expect(helperEvents(remote.dir, 'bat-terminal', 'invoke').at(-1).argv).toEqual([...ANSWER, '--choice', '1'])
      expect(helperEvents(remote.dir, 'bat-terminal', 'parsed').at(-1)).toMatchObject({ answer: QID, choice: 1 })
    } finally {
      await remote.close()
    }
  }, 20000)

  it('refusals → exit codes and answer: <CODE> (CLOSED prints the status; lost is LOST)', async () => {
    const cases = [
      [{ result: { ok: false, code: 'CLOSED', status: 'answered' } }, 9, 'CLOSED', '  status: answered'],
      [{ result: { ok: false, code: 'CLOSED', status: 'cancelled', endReason: 'worker-exited' } }, 9, 'CLOSED', '  status: cancelled worker-exited'],
      [{ result: { ok: false, code: 'CLOSED', status: 'expired', endReason: 'not-polled' } }, 9, 'CLOSED', '  status: expired not-polled'],
      [{ result: { ok: false, code: 'NOT_FOUND', status: 'lost' } }, 3, 'LOST', null],
      [{ result: { ok: false, code: 'NOT_FOUND' } }, 3, 'NOT_FOUND', null],
      [{ result: { ok: false, code: 'NOT_OWNER' } }, 4, 'NOT_OWNER', null],
      [{ result: { ok: false, code: 'INVALID_ARGS', message: 'choice out of range' } }, 1, 'INVALID_ARGS', null],
      [{ error: 'No handler for channel: question:answer' }, 1, 'UNSUPPORTED', null],
      [{ error: 'Forbidden: channel-not-allowed' }, 1, 'UNSUPPORTED', null],
      [{ error: 'Forbidden: tower-not-bound' }, 1, 'FORBIDDEN', null],
    ]
    for (const [reply, exitCode, code, statusLine] of cases) {
      const remote = await startMockRemote({ 'question:answer': reply })
      try {
        const r = await run([...ANSWER, '--choice', '1'], remote.env, 'why')
        expect(r.code, `${code}: ${r.stderr}`).toBe(exitCode)
        expect(r.stderr).toContain(`answer: ${code}`)
        expect(r.stdout).not.toContain('answered:')
        if (statusLine) expect(r.stdout.split(/\r?\n/).filter(Boolean)).toEqual([statusLine])
        expect(helperEvents(remote.dir, 'bat-terminal', 'answer').at(-1)).toMatchObject({ result: code })
      } finally {
        await remote.close()
      }
    }
  }, 90000)

  it('replies are matched by frame id (a reply with another id and broadcasts are ignored)', async () => {
    const remote = await startMockRemote({ 'question:answer': ANSWERED }, { decoy: true })
    try {
      const r = await run([...ANSWER, '--choice', '1'], remote.env)
      expect(r.code, r.stderr).toBe(0)
      expect(r.stdout).toContain(`  answered: ${QID}`)
    } finally {
      await remote.close()
    }
  }, 20000)

  it('usage errors and bad stdin, before any connection', async () => {
    const { env } = offlineEnv()
    const cases = [
      [['--answer', QID, '--choice', '1'], undefined, /--answer requires --notify-id/, 'answer: USAGE'],
      [['--choice', '1', '--notify-id', 'tower-1'], undefined, /--choice is only valid with --answer/, 'answer: USAGE'],
      [['--answer', 'Q-0123', '--notify-id', 'tower-1'], undefined, /Invalid --answer value/, 'answer: USAGE'],
      [['--answer'], undefined, /--answer requires a question id/, 'answer: USAGE'],
      [[...ANSWER, '--choice', '0'], undefined, /Invalid --choice value: '0'/, 'answer: USAGE'],
      [[...ANSWER, '--choice', 'two'], undefined, /Invalid --choice value: 'two'/, 'answer: USAGE'],
      [[...ANSWER, '--skill', 'ct-exec', '--workorder', 'T0608'], 'x', /--answer cannot be combined with --skill, --workorder/, 'answer: USAGE'],
      [[...ANSWER, '--close-worker', 'T0608'], 'x', /--answer cannot be combined with --close-worker/, 'answer: USAGE'],
      [[...ANSWER, '--worktree-status'], 'x', /--answer cannot be combined with --worktree-status/, 'answer: USAGE'],
      [[...ANSWER, 'echo', 'hi'], 'x', /--answer cannot be combined with <command>/, 'answer: USAGE'],
      [ANSWER, undefined, /needs the answer text on stdin, or --choice/, 'answer: USAGE'],
      [ANSWER, '\r\n', /needs the answer text on stdin, or --choice/, 'answer: USAGE'],
      [ANSWER, 'x'.repeat(70_000), /larger than 65536 bytes/, 'answer: INVALID_INPUT'],
      [ANSWER, Buffer.from([0x61, 0xff, 0x62]), /not UTF-8/, 'answer: INVALID_INPUT'],
    ]
    for (const [args, stdin, message, tag] of cases) {
      const r = await run(args, env, stdin)
      expect(r.code, args.join(' ')).toBe(1)
      expect(r.stderr, args.join(' ')).toMatch(message)
      expect(r.stderr, args.join(' ')).toContain(tag)
      expect(r.stderr, args.join(' ')).not.toContain('CONNECT_FAILED')
    }
  }, 90000)

  it('--help documents --answer, --choice and exit 9', async () => {
    const r = await run(['--help'], {})
    expect(r.code).toBe(0)
    for (const text of ['--answer <question id>', '--choice <n>', '9 CLOSED', 'answer: LOST', "Unknown option '--answer'", 'bat_list_questions']) {
      expect(r.stdout, text).toContain(text)
    }
  }, 20000)
})
