/**
 * T0565 / D148: the Control Tower modes (`--mode yolo|ask|off|on`). A Worker gets one as
 * `customEnv.CT_MODE` when a Tower dispatches it; a Tower declares its own with
 * `bat-terminal.mjs --set-role tower --mode <m>` (electron/terminal-role.ts), recorded on the PTY
 * (`PtyManager.setTerminalRole` / `isYoloTerminal`).
 *
 * 🔴 No `electron` import here (shared with headless).
 */
export const CT_MODES = ['yolo', 'ask', 'off', 'on'] as const
export type CtMode = typeof CT_MODES[number]

/** `--mode` value → mode: trimmed, case-insensitive; anything else → null. */
export function normalizeCtMode(raw: unknown): CtMode | null {
  if (typeof raw !== 'string') return null
  const mode = raw.trim().toLowerCase()
  return (CT_MODES as readonly string[]).includes(mode) ? mode as CtMode : null
}
