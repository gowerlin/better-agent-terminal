import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterAll, afterEach, describe, it, expect, vi } from 'vitest'

import type { ClaudeRuntimeInfo } from '../claude-resolver'
import { claudeUpdateGuardEnv, isSafeClaudeCustomPath } from '../claude-resolver'
import {
  configureRuntimeRouter,
  getRuntimeSettingsSnapshot,
  resolveClaudeRuntime,
  resolveEmbeddedClaudePath,
  SystemClaudeUnsafePathError,
} from '../claude-runtime-router'

// PLAN-036 T0389: the router is host-configured and must not reach for electron.
vi.mock('electron', () => {
  throw new Error('claude-runtime-router must not import electron (PLAN-036 T0389)')
})

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

// BUG-084 / T0372: DISABLE_UPDATES follows the resolved runtime — embedded (incl. fallback) only.
describe('claudeUpdateGuardEnv by resolved runtime', () => {
  const systemPath = '/usr/local/bin/claude'

  it('embedded mode gets DISABLE_UPDATES', async () => {
    const result = await resolveClaudeRuntime(
      { mode: 'embedded', fallbackToEmbedded: true },
      { detectSystemClaude: vi.fn(), resolveEmbeddedClaudePath: () => embeddedPath },
    )
    expect(result.source).toBe('embedded')
    expect(claudeUpdateGuardEnv(result.source)).toEqual({ DISABLE_UPDATES: '1' })
  })

  it('healthy system claude does not get DISABLE_UPDATES', async () => {
    const result = await resolveClaudeRuntime(
      { mode: 'system', customPath: systemPath, fallbackToEmbedded: true },
      { detectSystemClaude: vi.fn(async () => healthyInfo(systemPath)), resolveEmbeddedClaudePath: () => embeddedPath },
    )
    expect(result.source).toBe('system')
    expect(claudeUpdateGuardEnv(result.source)).toEqual({})
  })

  it('system mode falling back to embedded gets DISABLE_UPDATES', async () => {
    const result = await resolveClaudeRuntime(
      { mode: 'system', fallbackToEmbedded: true },
      { detectSystemClaude: vi.fn(async () => null), resolveEmbeddedClaudePath: () => embeddedPath },
    )
    expect(result.source).toBe('system-fallback-to-embedded')
    expect(claudeUpdateGuardEnv(result.source)).toEqual({ DISABLE_UPDATES: '1' })
  })
})

// PLAN-036 T0389: settings source is injected by the host (Electron userData / headless dataDir).
describe('configureRuntimeRouter settings source', () => {
  const tempDirs: string[] = []

  function dataDirWith(settings: unknown): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0389-router-'))
    tempDirs.push(dir)
    if (settings !== undefined) fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(settings))
    return dir
  }

  afterEach(() => configureRuntimeRouter({}))
  afterAll(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('returns defaults when no data directory is configured', () => {
    configureRuntimeRouter({})
    expect(getRuntimeSettingsSnapshot()).toEqual({ mode: 'embedded', fallbackToEmbedded: true })
  })

  it('reads claudeRuntime from the Electron userData getter', () => {
    const userData = dataDirWith({ claudeRuntime: { mode: 'system', customPath: '/usr/local/bin/claude', fallbackToEmbedded: false } })
    configureRuntimeRouter({ getDataDir: () => userData })
    expect(getRuntimeSettingsSnapshot()).toEqual({ mode: 'system', customPath: '/usr/local/bin/claude', fallbackToEmbedded: false })
  })

  it('reads claudeRuntime from a headless dataDir, re-reading the getter on every snapshot', () => {
    const first = dataDirWith({ claudeRuntime: { mode: 'system' } })
    const second = dataDirWith({ claudeRuntime: { mode: 'embedded' } })
    let current = first
    configureRuntimeRouter({ getDataDir: () => current })
    expect(getRuntimeSettingsSnapshot().mode).toBe('system')
    current = second
    expect(getRuntimeSettingsSnapshot().mode).toBe('embedded')
  })

  it('falls back to defaults when settings.json is missing or unparsable', () => {
    configureRuntimeRouter({ getDataDir: () => dataDirWith(undefined) })
    expect(getRuntimeSettingsSnapshot()).toEqual({ mode: 'embedded', fallbackToEmbedded: true })
    const broken = dataDirWith(undefined)
    fs.writeFileSync(path.join(broken, 'settings.json'), '{not json')
    configureRuntimeRouter({ getDataDir: () => broken })
    expect(getRuntimeSettingsSnapshot()).toEqual({ mode: 'embedded', fallbackToEmbedded: true })
  })
})

// PLAN-036 T0389: one embedded resolver for router / agent-manager / claude:detectRuntime.
describe('resolveEmbeddedClaudePath', () => {
  const claudeCodeBin = ['node_modules', '@anthropic-ai', 'claude-code', 'bin']

  afterEach(() => configureRuntimeRouter({}))

  it.each(['win32', 'darwin', 'linux'] as const)('packaged Electron always uses bin/claude.exe (BUG-052) on %s', (platform) => {
    const resourcesPath = path.join('C:', 'Program Files', 'BetterAgentTerminal', 'resources')
    expect(resolveEmbeddedClaudePath({ kind: 'electron-packaged', resourcesPath }, platform))
      .toBe(path.join(resourcesPath, 'app.asar.unpacked', ...claudeCodeBin, 'claude.exe'))
  })

  it.each(['linux', 'darwin'] as const)('server bundle on %s uses the POSIX wrapper bin/claude', (platform) => {
    const installRoot = path.join('/home', 'u', '.local', 'bat-server')
    expect(resolveEmbeddedClaudePath({ kind: 'server-bundle', installRoot }, platform))
      .toBe(path.join(installRoot, ...claudeCodeBin, 'claude'))
  })

  it('server bundle on Windows uses bin/claude.exe', () => {
    const installRoot = path.join('C:', 'bat-server')
    expect(resolveEmbeddedClaudePath({ kind: 'server-bundle', installRoot }, 'win32'))
      .toBe(path.join(installRoot, ...claudeCodeBin, 'claude.exe'))
  })

  it('node-modules layout resolves the installed package (dev / tests)', () => {
    const resolved = resolveEmbeddedClaudePath({ kind: 'node-modules' })
    expect(path.basename(resolved)).toBe('claude.exe')
    expect(fs.existsSync(path.join(path.dirname(resolved), '..', 'package.json'))).toBe(true)
  })

  it('returns an empty path when the package cannot be found', () => {
    const notFound = () => { throw new Error("Cannot find module '@anthropic-ai/claude-code/package.json'") }
    expect(resolveEmbeddedClaudePath({ kind: 'node-modules' }, 'win32', notFound)).toBe('')
  })

  it('defaults to the configured layout, which resolveClaudeRuntime uses for embedded mode', async () => {
    const installRoot = path.join('/srv', 'bat-server')
    configureRuntimeRouter({ getEmbeddedLayout: () => ({ kind: 'server-bundle', installRoot }) })
    const expected = resolveEmbeddedClaudePath({ kind: 'server-bundle', installRoot })
    expect(resolveEmbeddedClaudePath()).toBe(expected)

    const result = await resolveClaudeRuntime({ mode: 'embedded', fallbackToEmbedded: true }, { detectSystemClaude: vi.fn() })
    expect(result).toEqual({ path: expected, source: 'embedded', healthStatus: 'healthy' })
  })
})
