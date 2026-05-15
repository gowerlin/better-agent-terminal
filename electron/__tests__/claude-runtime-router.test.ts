import { describe, it, expect, vi } from 'vitest'

import type { ClaudeRuntimeInfo } from '../claude-resolver'
import { isSafeClaudeCustomPath } from '../claude-resolver'
import {
  resolveClaudeRuntime,
  SystemClaudeUnsafePathError,
} from '../claude-runtime-router'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => 'C:\\Users\\test\\AppData\\Roaming\\BetterAgentTerminal'),
  },
}))

const embeddedPath = 'C:\\BAT\\embedded\\claude.exe'

function healthyInfo(binaryPath: string): ClaudeRuntimeInfo {
  return {
    path: binaryPath,
    version: '2.1.113',
    versionRaw: '2.1.113 (Claude Code)',
    healthStatus: 'healthy',
    source: 'custom',
  }
}

describe('isSafeClaudeCustomPath', () => {
  it.each([
    ['/usr/local/bin/claude'],
    ['C:\\Users\\u\\claude.exe'],
    ['\\\\server\\share\\claude.exe'],
    ['/Applications/My Tools/claude'],
    ['/opt/Claude_Code-2.1.113/bin/claude'],
    ['/opt/tools/claude(backup)+stable'],
    ['/opt/@vendor/claude'],
  ])('accepts safe absolute path %s', (candidate) => {
    expect(isSafeClaudeCustomPath(candidate)).toBe(true)
  })

  it.each([
    [''],
    ['./claude'],
    ['claude'],
    ['Users\\u\\claude.exe'],
    ['C:claude.exe'],
    ['\\\\server'],
  ])('rejects non-absolute path %s', (candidate) => {
    expect(isSafeClaudeCustomPath(candidate)).toBe(false)
  })

  it.each([
    ['/home/$USER/claude'],
    ['/tmp/`whoami`/claude'],
    ['/tmp/x;rm -rf /'],
    ['/tmp/a|b/claude'],
    ['/tmp/a&b/claude'],
    ['/tmp/a>b/claude'],
    ['/tmp/a<b/claude'],
    ['/tmp/a*b/claude'],
    ['/tmp/a?b/claude'],
    ['C:\\Users\\%USERNAME%\\claude.exe'],
    ['/home/u!evil/claude'],
    ["/tmp/it's/claude"],
    ['/tmp/a"b/claude'],
    ['/tmp/a,b/claude'],
  ])('rejects unsafe shell or disallowed character %s', (candidate) => {
    expect(isSafeClaudeCustomPath(candidate)).toBe(false)
  })

  it.each([
    ['/tmp/a\rb/claude'],
    ['/tmp/a\nb/claude'],
    ['/tmp/a\0b/claude'],
    ['/tmp/a\tb/claude'],
    [`/tmp/a${String.fromCharCode(0x7f)}b/claude`],
  ])('rejects control character path', (candidate) => {
    expect(isSafeClaudeCustomPath(candidate)).toBe(false)
  })

  it('rejects paths longer than 4096 chars', () => {
    expect(isSafeClaudeCustomPath(`/${'a'.repeat(4096)}`)).toBe(false)
  })
})

describe('resolveClaudeRuntime customPath whitelist', () => {
  it.each([true, false])('resolves a safe POSIX customPath when fallback=%s', async (fallbackToEmbedded) => {
    const customPath = '/usr/local/bin/claude'
    const detectSystemClaude = vi.fn(async () => healthyInfo(customPath))

    const result = await resolveClaudeRuntime(
      { mode: 'system', customPath, fallbackToEmbedded },
      { detectSystemClaude, resolveEmbeddedClaudePath: () => embeddedPath },
    )

    expect(detectSystemClaude).toHaveBeenCalledWith(customPath)
    expect(result).toMatchObject({
      path: customPath,
      source: 'system',
      healthStatus: 'healthy',
      systemVersion: '2.1.113',
    })
  })

  it.each([
    ['/home/$USER/claude'],
    ['/tmp/`whoami`/claude'],
    ['/tmp/x;rm -rf /'],
    ['/tmp/a|b/claude'],
    ['C:\\Users\\%USERNAME%\\claude.exe'],
    ['/home/u!evil/claude'],
    ['/tmp/a\rb/claude'],
    ['./claude'],
  ])('falls back to embedded for unsafe customPath %s', async (customPath) => {
    const detectSystemClaude = vi.fn()

    const result = await resolveClaudeRuntime(
      { mode: 'system', customPath, fallbackToEmbedded: true },
      { detectSystemClaude, resolveEmbeddedClaudePath: () => embeddedPath },
    )

    expect(detectSystemClaude).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      path: embeddedPath,
      source: 'system-fallback-to-embedded',
      healthStatus: 'healthy',
      degraded: { reason: 'unsafe-custom-path' },
    })
  })

  it('throws SystemClaudeUnsafePathError when fallback is disabled', async () => {
    const detectSystemClaude = vi.fn()

    await expect(resolveClaudeRuntime(
      { mode: 'system', customPath: '/home/$USER/claude', fallbackToEmbedded: false },
      { detectSystemClaude, resolveEmbeddedClaudePath: () => embeddedPath },
    )).rejects.toBeInstanceOf(SystemClaudeUnsafePathError)

    expect(detectSystemClaude).not.toHaveBeenCalled()
  })

  it('does not treat an empty customPath as unsafe', async () => {
    const detectSystemClaude = vi.fn(async () => null)

    const result = await resolveClaudeRuntime(
      { mode: 'system', customPath: '', fallbackToEmbedded: true },
      { detectSystemClaude, resolveEmbeddedClaudePath: () => embeddedPath },
    )

    expect(detectSystemClaude).toHaveBeenCalledWith(undefined)
    expect(result).toMatchObject({
      path: embeddedPath,
      source: 'system-fallback-to-embedded',
      degraded: { reason: 'system-not-found' },
    })
  })

  it.each([
    ['C:\\Users\\u\\claude.exe'],
    ['/Applications/My Tools/claude'],
    ['\\\\server\\share\\claude.exe'],
  ])('resolves safe customPath %s', async (customPath) => {
    const detectSystemClaude = vi.fn(async () => healthyInfo(customPath))

    const result = await resolveClaudeRuntime(
      { mode: 'system', customPath, fallbackToEmbedded: true },
      { detectSystemClaude, resolveEmbeddedClaudePath: () => embeddedPath },
    )

    expect(detectSystemClaude).toHaveBeenCalledWith(customPath)
    expect(result.source).toBe('system')
    expect(result.path).toBe(customPath)
  })
})
