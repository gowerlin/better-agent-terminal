/**
 * PLAN-055 B2 / T0767: the `resume` subcommand BAT adds to resume an interrupted codex tab
 * (src/lib/codex-resume-args.ts) — codex's own picker, never `--last`, no session id.
 */
import { describe, expect, it } from 'vitest'
import { CODEX_RESUME_SUBCOMMAND, codexResumeArgs, codexResumeCommand, userArgsSetCodexResume } from '../codex-resume-args'

describe('codexResumeArgs', () => {
  it('default: `resume` (codex picker)', () => {
    expect(CODEX_RESUME_SUBCOMMAND).toBe('resume')
    for (const args of [undefined, null, '', '--model gpt-5', '-c model=resume', '--resume-x', '--config=x', '-m resumer']) {
      expect(codexResumeArgs(args), String(args)).toEqual({ mode: 'picker', arg: 'resume' })
    }
  })

  it('custom args that run `resume` / `fork` themselves → nothing (user-args)', () => {
    for (const args of ['resume', 'resume --last', 'fork', '--model m resume', '-c a=b fork --all', '  resume  ']) {
      expect(userArgsSetCodexResume(args), args).toBe(true)
      expect(codexResumeArgs(args), args).toEqual({ mode: 'none', arg: null, reason: 'user-args' })
    }
  })

  it('never `--last`, never a session id', () => {
    expect(JSON.stringify(codexResumeArgs(''))).not.toContain('--last')
  })
})

describe('codexResumeCommand', () => {
  it('launch + BAT args, then `resume`, then the custom args', () => {
    expect(codexResumeCommand("codex -c 'mcp_servers.bat.command=node'", '--model gpt-5')).toEqual({
      command: "codex -c 'mcp_servers.bat.command=node' resume --model gpt-5",
      decision: { mode: 'picker', arg: 'resume' },
    })
    expect(codexResumeCommand('codex --no-daemon', '').command).toBe('codex --no-daemon resume')
    expect(codexResumeCommand('codex --no-daemon', undefined).command).toBe('codex --no-daemon resume')
  })

  it('custom args with their own `resume` → the normal launch, unchanged', () => {
    expect(codexResumeCommand('codex --no-daemon', ' resume --all ')).toEqual({
      command: 'codex --no-daemon resume --all',
      decision: { mode: 'none', arg: null, reason: 'user-args' },
    })
  })
})
