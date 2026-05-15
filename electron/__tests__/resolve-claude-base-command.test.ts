/**
 * Unit tests for electron/resolve-claude-base-command.ts.
 *
 * Mocks the dynamic `await import('./claude-runtime-router')` call so the test
 * can drive shell-aware command rendering deterministically.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { ResolvedRuntime } from '../claude-runtime-router'
import type { ShellFamily } from '../../src/utils/shell-quote'

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
  const customPath = 'C:\\Users\\u\\claude.exe'
  const embeddedPath = 'C:\\Program Files\\BetterAgentTerminal\\resources\\claude.exe'

  function mockRuntime(path: string, source: ResolvedRuntime['source'] = 'system') {
    const resolved: ResolvedRuntime = {
      path,
      source,
      healthStatus: 'healthy',
      systemVersion: source === 'system' ? '2.1.113' : undefined,
    }
    mocks.resolveClaudeRuntime.mockResolvedValueOnce(resolved)
  }

  it.each([
    ['posix', customPath, `'${customPath}'`],
    ['pwsh', customPath, `& '${customPath}'`],
    ['cmd', customPath, `"${customPath}"`],
  ] satisfies Array<[ShellFamily, string, string]>)('returns %s-quoted customPath when resolver returns a system binary', async (shell, path, expected) => {
    mockRuntime(path)

    const { resolveClaudeBaseCommand } = await import('../resolve-claude-base-command')
    const result = await resolveClaudeBaseCommand(shell)

    expect(result).toBe(expected)
    expect(mocks.resolveClaudeRuntime).toHaveBeenCalledTimes(1)
    expect(mocks.getRuntimeSettingsSnapshot).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['posix', embeddedPath, `'${embeddedPath}'`],
    ['pwsh', embeddedPath, `& '${embeddedPath}'`],
    ['cmd', embeddedPath, `"${embeddedPath}"`],
  ] satisfies Array<[ShellFamily, string, string]>)('returns %s-quoted embedded path when resolver returns embedded source', async (shell, path, expected) => {
    mockRuntime(path, 'embedded')

    const { resolveClaudeBaseCommand } = await import('../resolve-claude-base-command')
    const result = await resolveClaudeBaseCommand(shell)

    expect(result).toBe(expected)
  })

  it('defaults to POSIX quoting when shell is omitted', async () => {
    const resolved: ResolvedRuntime = {
      path: '/usr/local/bin/claude',
      source: 'system',
      healthStatus: 'healthy',
      systemVersion: '2.1.113',
    }
    mocks.resolveClaudeRuntime.mockResolvedValueOnce(resolved)

    const { resolveClaudeBaseCommand } = await import('../resolve-claude-base-command')
    const result = await resolveClaudeBaseCommand()

    expect(result).toBe("'/usr/local/bin/claude'")
  })

  it('falls back to bare "claude" and logs a warning when the resolver throws', async () => {
    mocks.resolveClaudeRuntime.mockRejectedValueOnce(new Error('boom'))

    const { resolveClaudeBaseCommand } = await import('../resolve-claude-base-command')
    const result = await resolveClaudeBaseCommand()

    expect(result).toBe('claude')
    expect(mocks.warn).toHaveBeenCalledTimes(1)
  })
})
