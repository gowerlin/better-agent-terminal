/**
 * PLAN-055 B1 / T0766: the `--resume` argument of an interrupted claude tab (src/lib/claude-resume-args.ts).
 */
import { describe, expect, it } from 'vitest'
import { claudeResumeArgs, userArgsSetClaudeResume } from '../claude-resume-args'
// The id grammar's parity with electron/terminal-blocked-state.ts is asserted in
// electron/__tests__/interrupted-agents.test.ts (src/ may not import electron/: tsconfig references).

const ID = '0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e'

describe('claudeResumeArgs', () => {
  it('a known session id → --resume=<id> (always the = form); unknown / malformed → --resume (picker)', () => {
    expect(claudeResumeArgs(ID, '')).toEqual({ mode: 'session', arg: `--resume=${ID}` })
    expect(claudeResumeArgs(ID, '--dangerously-skip-permissions --model opus')).toEqual({ mode: 'session', arg: `--resume=${ID}` })
    expect(claudeResumeArgs(null, '')).toEqual({ mode: 'picker', arg: '--resume' })
    expect(claudeResumeArgs(undefined, undefined)).toEqual({ mode: 'picker', arg: '--resume' })
    expect(claudeResumeArgs('../../etc', null)).toEqual({ mode: 'picker', arg: '--resume' })
  })

  it('custom args that choose the session → nothing (user-args)', () => {
    for (const args of ['-c', '-r', '-cr', '--continue', '--resume', '--resume abc', '--resume=abc', '--session-id x', '--session-id=x', '--from-pr 12', '--teleport', '--model opus -c']) {
      expect(userArgsSetClaudeResume(args), args).toBe(true)
      expect(claudeResumeArgs(ID, args), args).toEqual({ mode: 'none', arg: null, reason: 'user-args' })
    }
  })

  it('other args do not count', () => {
    for (const args of ['', '--dangerously-skip-permissions', '--model claude-opus', '-p', '--resumes', '--no-chrome', 'x-c', '--fork-session', '--mcp-config=a.json']) {
      expect(userArgsSetClaudeResume(args), args).toBe(false)
    }
    expect(userArgsSetClaudeResume(undefined)).toBe(false)
  })
})
