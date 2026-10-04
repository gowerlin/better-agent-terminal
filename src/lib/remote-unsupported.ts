// PLAN-036 P1-F (T0401) — what a remote-profile window cannot do on its bat-server.
//
// - Codex agents: the server bundle ships no codex, so codex presets / codex-only controls are
//   unavailable in a remote window (the server rejects them; the UI hides / disables them first).
// - A channel the server has no handler for (an older bat-server, or a feature not brought
//   online yet) fails with `No handler for channel: <channel>`. Over Electron IPC that arrives
//   wrapped (`Error invoking remote method '<channel>': Error: No handler for channel: <channel>`);
//   `unsupportedRemoteChannel` digs the channel out so the UI can say something readable.

export const REMOTE_UNSUPPORTED_AGENT_PRESETS: ReadonlySet<string> = new Set(['codex-agent', 'codex-agent-worktree'])

export function isAgentPresetUnsupportedRemotely(presetId: string | undefined | null): boolean {
  return !!presetId && REMOTE_UNSUPPORTED_AGENT_PRESETS.has(presetId)
}

const NO_HANDLER_RE = /No handler (?:for channel|registered for)[:\s]+'?([\w:.-]+)/

/** The channel a remote server had no handler for, or null when `err` is any other failure. */
export function unsupportedRemoteChannel(err: unknown): string | null {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return message.match(NO_HANDLER_RE)?.[1] ?? null
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * Readable text for a remote "no handler" failure (`claude.remoteChannelUnsupported`), or null when
 * `err` is any other failure — callers rethrow those so local behaviour is unchanged.
 */
export function remoteUnsupportedMessage(err: unknown, t: Translate): string | null {
  const channel = unsupportedRemoteChannel(err)
  return channel ? t('claude.remoteChannelUnsupported', { channel }) : null
}
