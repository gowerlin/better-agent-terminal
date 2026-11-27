/**
 * T0944 / D421: a tab opened by "Open Claude as Tower" (`launchRole: 'tower'`, T0644) starts claude
 * with `/control-tower` as its prompt — a launch argument, never typed into claude afterwards.
 *
 *   - added (`tower`): every launch of a NEW claude session of a tower tab — the new tab, ⏻ restart,
 *     and a tab BAT restores whose PTY is gone (all three go through `startClaudeCliPty` without `resume`)
 *   - not added:
 *       `not-tower` — any other tab (plain Claude CLI, worktree, …): its command is unchanged
 *       `resume`    — the one-click resume of an interrupted tab (T0766: a resume carries no prompt)
 *       `user-args` — the custom args already resume / continue / pick a session
 *                     (`userArgsSetClaudeResume`, the same detection `claudeResumeArgs` uses)
 *   A restored tab whose PTY still runs gets no launch command at all (T0403, `createPtyThenLaunch`).
 *
 * Position and quoting follow the helper dispatch (`createAgentPromptCommandBuilder`,
 * electron/terminal-command-handlers.ts): the prompt is the last argument, after the custom args,
 * through `quoteArgForShell`. The string is fixed (the claude skill name, also with the CT plugin, T0710).
 *
 * Pure: no electron / DOM import. `startClaudeCliPty` (src/components/WorkspaceView.tsx) only wires it.
 */
import { quoteArgForShell, type ShellFamily } from '../utils/shell-quote'
import { userArgsSetClaudeResume } from './claude-resume-args'

/** The prompt a tower tab's new claude session starts with. */
export const TOWER_LAUNCH_PROMPT = '/control-tower'

export type TowerLaunchPromptReason = 'tower' | 'not-tower' | 'resume' | 'user-args'

export interface TowerLaunchPromptDecision {
  /** The quoted argument that goes last on the claude command line; null = nothing added. */
  arg: string | null
  reason: TowerLaunchPromptReason
}

export interface TowerLaunchPromptInput {
  /** The tab's `TerminalInstance.launchRole`. */
  launchRole: 'tower' | undefined | null
  /** This launch resumes a session (`startClaudeCliPty`'s `resume`). */
  resume: boolean
  /** The tab's effective custom args (`getEffectiveAgentArgs`). */
  customArgs: string | undefined | null
  shellFamily: ShellFamily
}

/** Whether this claude launch gets `/control-tower`, and the argument to append. */
export function towerLaunchPrompt(input: TowerLaunchPromptInput): TowerLaunchPromptDecision {
  if (input.launchRole !== 'tower') return { arg: null, reason: 'not-tower' }
  if (input.resume) return { arg: null, reason: 'resume' }
  if (userArgsSetClaudeResume(input.customArgs)) return { arg: null, reason: 'user-args' }
  return { arg: quoteArgForShell(TOWER_LAUNCH_PROMPT, input.shellFamily), reason: 'tower' }
}
