import { describe, expect, it } from 'vitest'
import {
  isAgentPresetUnsupportedRemotely,
  remoteUnsupportedMessage,
  unsupportedRemoteChannel,
} from '../remote-unsupported'

describe('unsupportedRemoteChannel (T0401)', () => {
  it('reads the channel from the bat-server error', () => {
    expect(unsupportedRemoteChannel(new Error('No handler for channel: claude:start-session'))).toBe('claude:start-session')
  })

  it('reads it through the Electron IPC wrapper', () => {
    const err = new Error("Error invoking remote method 'claude:send-message': Error: No handler for channel: claude:send-message")
    expect(unsupportedRemoteChannel(err)).toBe('claude:send-message')
  })

  it('reads the local registry wording too', () => {
    expect(unsupportedRemoteChannel("No handler registered for 'claude:abort-session'")).toBe('claude:abort-session')
  })

  it('is null for any other failure', () => {
    expect(unsupportedRemoteChannel(new Error('Remote invoke timeout: claude:start-session'))).toBeNull()
    expect(unsupportedRemoteChannel(undefined)).toBeNull()
    expect(unsupportedRemoteChannel({ message: 'No handler for channel: x' })).toBeNull()
  })
})

describe('remoteUnsupportedMessage', () => {
  const t = (key: string, opts?: Record<string, unknown>) => `${key}|${String(opts?.channel)}`

  it('translates a no-handler failure with the channel', () => {
    expect(remoteUnsupportedMessage(new Error('No handler for channel: claude:fork-session'), t))
      .toBe('claude.remoteChannelUnsupported|claude:fork-session')
  })

  it('returns null for other failures so callers rethrow', () => {
    expect(remoteUnsupportedMessage(new Error('boom'), t)).toBeNull()
  })
})

describe('isAgentPresetUnsupportedRemotely', () => {
  it('flags codex presets only', () => {
    expect(isAgentPresetUnsupportedRemotely('codex-agent')).toBe(true)
    expect(isAgentPresetUnsupportedRemotely('codex-agent-worktree')).toBe(true)
    expect(isAgentPresetUnsupportedRemotely('claude-code')).toBe(false)
    expect(isAgentPresetUnsupportedRemotely('codex-cli')).toBe(false) // a terminal CLI, runs in the remote shell
    expect(isAgentPresetUnsupportedRemotely(undefined)).toBe(false)
  })
})
