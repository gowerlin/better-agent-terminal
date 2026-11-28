// T0978 / D516 — `launchCommandEndsWithPrompt` (src/lib/launch-command.ts): the host
// (PtyManager.writeLaunchCommand) recognises the launch command of a tower tab's new claude session
// (`/control-tower` last, T0944) to know that the PTY's first `user-prompt-submit` is that prompt's turn.
// The NotifyHoldController / PtyManager side is electron/__tests__/notify-hold-prompt-submit.test.ts.

import { describe, expect, it } from 'vitest'
import { launchCommandEndsWithPrompt } from '../launch-command'
import { TOWER_LAUNCH_PROMPT, towerLaunchCommandPrefix, towerLaunchPrompt } from '../tower-launch-prompt'
import type { ShellFamily } from '../../utils/shell-quote'

const P = TOWER_LAUNCH_PROMPT

describe('launchCommandEndsWithPrompt', () => {
  it.each<[ShellFamily, string]>([
    ['pwsh', "& 'C:/Program Files/BetterAgentTerminal/resources/claude.exe' --mcp-config=x --name=ws"],
    ['cmd', '"C:/Program Files/BetterAgentTerminal/resources/claude.exe" --name=ws'],
    ['posix', "'/opt/bat/claude' --name='ws · Tower' --dangerously-skip-permissions"],
  ])('the command startClaudeCliPty builds for a tower tab (%s) → true', (shellFamily, head) => {
    const decision = towerLaunchPrompt({ launchRole: 'tower', resume: false, customArgs: '--x', shellFamily })
    expect(decision.arg).not.toBeNull()
    expect(launchCommandEndsWithPrompt(`${head} ${decision.arg}\r`, P)).toBe(true)
  })

  it('Git Bash (MSYS): with the assignment in front (T0946) → true', () => {
    const decision = towerLaunchPrompt({ launchRole: 'tower', resume: false, customArgs: '', shellFamily: 'posix' })
    const prefix = towerLaunchCommandPrefix(decision, 'C:/Program Files/Git/bin/bash.exe')
    expect(prefix).not.toBeNull()
    expect(launchCommandEndsWithPrompt(`${prefix} '/c/x/claude.exe' --name=ws ${decision.arg}\r`, P)).toBe(true)
  })

  it('a quoted prompt, no trailing \\r, a trailing \\n → true', () => {
    expect(launchCommandEndsWithPrompt(`claude '${P}'\r`, P)).toBe(true)
    expect(launchCommandEndsWithPrompt(`claude "${P}"`, P)).toBe(true)
    expect(launchCommandEndsWithPrompt(`claude ${P}\r\n`, P)).toBe(true)
  })

  it.each([
    ['a plain claude', 'claude --name=ws\r'],
    ['a resume (no prompt, T0766)', "claude --name=ws --resume=0123abcd-0000-0000-0000-000000000000\r"],
    ['the prompt not last', `claude ${P} --verbose\r`],
    ['part of a longer word', `claude x${P}\r`],
    ['part of a path', `claude --dir=/repo${P}\r`],
    ['only the prompt (no command before it)', `${P}\r`],
    ['another prompt', 'claude /ct-exec T0001\r'],
    ['empty', ''],
  ])('%s → false', (_name, command) => {
    expect(launchCommandEndsWithPrompt(command, P)).toBe(false)
  })

  it('non-strings and an empty prompt → false', () => {
    expect(launchCommandEndsWithPrompt(undefined as unknown as string, P)).toBe(false)
    expect(launchCommandEndsWithPrompt(`claude ${P}`, '')).toBe(false)
  })
})
