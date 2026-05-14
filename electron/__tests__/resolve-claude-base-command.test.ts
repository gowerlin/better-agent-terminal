/**
 * Unit tests for electron/resolve-claude-base-command.ts.
 *
 * Mocks the dynamic `await import('./claude-runtime-router')` call so the test
 * can drive the three branches deterministically:
 *   1. resolver returns a system / customPath binary → quoted absolute path
 *   2. resolver returns the embedded binary → quoted absolute path
 *   3. resolver throws → bare 'claude' fallback
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { ResolvedRuntime } from '../claude-runtime-router'

const mocks = vi.hoisted(() => ({
  resolveClaudeRuntime: vi.fn(),
  getRuntimeSettingsSnapshot: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('../claude-runtime-router', () => ({
  resolveClaudeRuntime: mocks.resolveClaudeRuntime,
  getRuntimeSettingsSnapshot: mocks.getRuntimeSettingsSnapshot,
}))

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: mocks.warn,
    info: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
}))

beforeEach(() => {
  mocks.resolveClaudeRuntime.mockReset()
  mocks.getRuntimeSettingsSnapshot.mockReset()
  mocks.warn.mockReset()
  mocks.getRuntimeSettingsSnapshot.mockReturnValue({ mode: 'system', fallbackToEmbedded: true })
})

describe('resolveClaudeBaseCommand', () => {
  it('returns quoted customPath when resolver returns a system binary', async () => {
    const resolved: ResolvedRuntime = {
      path: 'C:/custom/claude.exe',
      source: 'system',
      healthStatus: 'healthy',
      systemVersion: '2.1.113',
    }
    mocks.resolveClaudeRuntime.mockResolvedValueOnce(resolved)

    const { resolveClaudeBaseCommand } = await import('../resolve-claude-base-command')
    const result = await resolveClaudeBaseCommand()

    expect(result).toBe('"C:/custom/claude.exe"')
    expect(mocks.resolveClaudeRuntime).toHaveBeenCalledTimes(1)
    expect(mocks.getRuntimeSettingsSnapshot).toHaveBeenCalledTimes(1)
  })

  it('returns quoted embedded path when resolver returns embedded source', async () => {
    const resolved: ResolvedRuntime = {
      path: '/opt/bat/embedded/claude.exe',
      source: 'embedded',
      healthStatus: 'healthy',
    }
    mocks.resolveClaudeRuntime.mockResolvedValueOnce(resolved)

    const { resolveClaudeBaseCommand } = await import('../resolve-claude-base-command')
    const result = await resolveClaudeBaseCommand()

    expect(result).toBe('"/opt/bat/embedded/claude.exe"')
  })

  it('falls back to bare "claude" and logs a warning when the resolver throws', async () => {
    mocks.resolveClaudeRuntime.mockRejectedValueOnce(new Error('boom'))

    const { resolveClaudeBaseCommand } = await import('../resolve-claude-base-command')
    const result = await resolveClaudeBaseCommand()

    expect(result).toBe('claude')
    expect(mocks.warn).toHaveBeenCalledTimes(1)
  })
})
