// T0759 / BUG-190: labels on the Agent / Task card of the Claude panel.
//
// The main process (`electron/claude-agent-manager.ts`) writes a sub-agent's end into the tool
// call's `description` as `[completed] …` / `[failed] …` / `[stopped] …` (task_notification) or
// `[stopped by user] …` (stopTask). A foreground Agent's card shows its tool_result instead; a
// background Agent's tool_result is only the launch notice, so its card shows this label once it
// has ended.

import type { ClaudeToolCall } from '../types/claude-agent'

const RESULT_LABEL = /^\[(completed|failed|stopped)[\]\s]/

/** Runs (or ran) as a background task: the main process saw it, or the model asked for it. */
export function isBackgroundAgentCall(call: Pick<ClaudeToolCall, 'input' | 'isBackground'>): boolean {
  return call.isBackground === true || call.input?.run_in_background === true
}

/** The end label to show on a finished background Agent / Task card, or null. */
export function backgroundAgentResultLabel(call: Pick<ClaudeToolCall, 'status' | 'description' | 'isBackground'>): string | null {
  if (call.isBackground !== true || call.status === 'running') return null
  const desc = call.description ?? ''
  return RESULT_LABEL.test(desc) ? desc : null
}
