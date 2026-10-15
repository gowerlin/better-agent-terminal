import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createRequire } from 'module'
import { afterAll, afterEach, describe, it, expect, vi } from 'vitest'

import type { ClaudeRuntimeInfo } from '../claude-resolver'
import { claudeUpdateGuardEnv, isSafeClaudeCustomPath } from '../claude-resolver'
import {
  __test__,
  configureRuntimeRouter,
  EmbeddedClaudeMissingError,
  embeddedClaudeCandidates,
  getRuntimeSettingsSnapshot,
  resolveClaudeRuntime,
  resolveEmbeddedClaudePath,
  SystemClaudeUnavailableError,
  SystemClaudeUnsafePathError,
} from '../claude-runtime-router'
import { logger } from '../logger'

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
      { detectSystemClaude, resolveEmbeddedClaudePath: () => embeddedPath, embeddedClaudeExists: () => true },
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
      { detectSystemClaude, resolveEmbeddedClaudePath: () => embeddedPath, embeddedClaudeExists: () => true },
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
      { detectSystemClaude, resolveEmbeddedClaudePath: () => embeddedPath, embeddedClaudeExists: () => true },
    )).rejects.toBeInstanceOf(SystemClaudeUnsafePathError)

    expect(detectSystemClaude).not.toHaveBeenCalled()
  })

  it('does not treat an empty customPath as unsafe', async () => {
    const detectSystemClaude = vi.fn(async () => null)

    const result = await resolveClaudeRuntime(
      { mode: 'system', customPath: '', fallbackToEmbedded: true },
      { detectSystemClaude, resolveEmbeddedClaudePath: () => embeddedPath, embeddedClaudeExists: () => true },
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
      { detectSystemClaude, resolveEmbeddedClaudePath: () => embeddedPath, embeddedClaudeExists: () => true },
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
      { detectSystemClaude: vi.fn(), resolveEmbeddedClaudePath: () => embeddedPath, embeddedClaudeExists: () => true },
    )
    expect(result.source).toBe('embedded')
    expect(claudeUpdateGuardEnv(result.source)).toEqual({ DISABLE_UPDATES: '1' })
  })

  it('healthy system claude does not get DISABLE_UPDATES', async () => {
    const result = await resolveClaudeRuntime(
      { mode: 'system', customPath: systemPath, fallbackToEmbedded: true },
      { detectSystemClaude: vi.fn(async () => healthyInfo(systemPath)), resolveEmbeddedClaudePath: () => embeddedPath, embeddedClaudeExists: () => true },
    )
    expect(result.source).toBe('system')
    expect(claudeUpdateGuardEnv(result.source)).toEqual({})
  })

  it('system mode falling back to embedded gets DISABLE_UPDATES', async () => {
    const result = await resolveClaudeRuntime(
      { mode: 'system', fallbackToEmbedded: true },
      { detectSystemClaude: vi.fn(async () => null), resolveEmbeddedClaudePath: () => embeddedPath, embeddedClaudeExists: () => true },
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
  const resourcesPath = path.join('C:', 'Program Files', 'BetterAgentTerminal', 'resources')
  const anthropicDir = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '@anthropic-ai')
  const wrapperBinary = path.join(anthropicDir, 'claude-code', 'bin', 'claude.exe')
  const packaged = { kind: 'electron-packaged', resourcesPath } as const
  const everything = () => true
  const nothing = () => false

  afterEach(() => configureRuntimeRouter({}))

  it('packaged Electron on Windows keeps bin/claude.exe (BUG-052), whatever exists', () => {
    expect(embeddedClaudeCandidates(packaged, 'win32', undefined, { arch: 'x64' })).toEqual([wrapperBinary])
    for (const exists of [everything, nothing]) {
      expect(resolveEmbeddedClaudePath(packaged, 'win32', undefined, { arch: 'x64', exists })).toBe(wrapperBinary)
    }
  })

  // BUG-118 / T0475: electron-builder drops node_modules .exe for non-Windows targets.
  it.each([
    ['darwin', 'arm64', false, 'claude-code-darwin-arm64'],
    ['linux', 'x64', false, 'claude-code-linux-x64'],
    ['linux', 'x64', true, 'claude-code-linux-x64-musl'],
    ['linux', 'arm64', true, 'claude-code-linux-arm64-musl'],
  ] as const)('packaged Electron on %s-%s (musl=%s) prefers the %s platform package', (platform, arch, musl, pkg) => {
    const platformBinary = path.join(anthropicDir, pkg, 'claude')
    expect(embeddedClaudeCandidates(packaged, platform, undefined, { arch, musl })).toEqual([platformBinary, wrapperBinary])
    expect(resolveEmbeddedClaudePath(packaged, platform, undefined, { arch, musl, exists: everything })).toBe(platformBinary)
  })

  it('packaged Electron falls back to bin/claude.exe when the platform package binary is missing', () => {
    const exists = (p: string) => p === wrapperBinary
    expect(resolveEmbeddedClaudePath(packaged, 'darwin', undefined, { arch: 'arm64', exists })).toBe(wrapperBinary)
  })

  it('packaged Electron names the platform package binary when neither candidate exists', () => {
    expect(resolveEmbeddedClaudePath(packaged, 'linux', undefined, { arch: 'x64', musl: false, exists: nothing }))
      .toBe(path.join(anthropicDir, 'claude-code-linux-x64', 'claude'))
  })

  it('musl only applies on Linux', () => {
    expect(embeddedClaudeCandidates(packaged, 'darwin', undefined, { arch: 'arm64', musl: true })[0])
      .toBe(path.join(anthropicDir, 'claude-code-darwin-arm64', 'claude'))
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

  // Dev layout is unchanged by T0475: bin/claude.exe on every platform, no platform package.
  it.each([
    ['darwin', 'arm64', false],
    ['linux', 'x64', false],
    ['linux', 'x64', true],
    ['win32', 'x64', false],
  ] as const)('node-modules layout on %s-%s (musl=%s) keeps bin/claude.exe', (platform, arch, musl) => {
    const pkgDir = path.join('/repo', 'node_modules', '@anthropic-ai', 'claude-code')
    const packageJson = () => path.join(pkgDir, 'package.json')
    expect(embeddedClaudeCandidates({ kind: 'node-modules' }, platform, packageJson, { arch, musl }))
      .toEqual([path.join(pkgDir, 'bin', 'claude.exe')])
    expect(resolveEmbeddedClaudePath({ kind: 'node-modules' }, platform, packageJson, { arch, musl, exists: nothing }))
      .toBe(path.join(pkgDir, 'bin', 'claude.exe'))
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

    const result = await resolveClaudeRuntime(
      { mode: 'embedded', fallbackToEmbedded: true },
      { detectSystemClaude: vi.fn(), embeddedClaudeExists: (p) => p === expected },
    )
    expect(result).toEqual({ path: expected, source: 'embedded', healthStatus: 'healthy' })
  })

  // scripts/verify-packaged-native.js re-implements the packaged rule (a .js script cannot import .ts).
  it.each([
    ['darwin', 'arm64', false],
    ['darwin', 'x64', false],
    ['linux', 'x64', false],
    ['linux', 'x64', true],
    ['linux', 'arm64', false],
    ['win32', 'x64', false],
  ] as const)('matches scripts/verify-packaged-native.js on %s-%s (musl=%s)', (platform, arch, musl) => {
    const req = createRequire(import.meta.url)
    const script = req('../../scripts/verify-packaged-native.js') as {
      packagedEmbeddedClaudeCandidates: (resourcesPath: string, platform: string, arch: string, musl?: boolean) => string[]
    }
    expect(script.packagedEmbeddedClaudeCandidates(resourcesPath, platform, arch, musl))
      .toEqual(embeddedClaudeCandidates(packaged, platform, undefined, { arch, musl }))
  })
})

// BUG-118 / T0475: the embedded binary must exist; the SDK's ENOENT does not say what to do.
describe('resolveClaudeRuntime embedded existence check', () => {
  const missingPath = '/opt/BAT/resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-linux-x64/claude'

  afterEach(() => {
    __test__.loggedMissingEmbedded.clear()
    vi.restoreAllMocks()
  })

  it('embedded mode throws EmbeddedClaudeMissingError naming the missing file, logged once', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const deps = { detectSystemClaude: vi.fn(), resolveEmbeddedClaudePath: () => missingPath, embeddedClaudeExists: () => false }

    for (let i = 0; i < 2; i++) {
      const err = await resolveClaudeRuntime({ mode: 'embedded', fallbackToEmbedded: true }, deps).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(EmbeddedClaudeMissingError)
      expect((err as EmbeddedClaudeMissingError).lookedFor).toEqual([missingPath])
      expect((err as Error).message).toContain(missingPath)
    }
    expect(deps.detectSystemClaude).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0][0])).toContain(missingPath)
  })

  it('lists every packaged candidate when the configured layout has none on disk', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const resourcesPath = path.join(os.tmpdir(), 't0475-no-such-resources')
    configureRuntimeRouter({ getEmbeddedLayout: () => ({ kind: 'electron-packaged', resourcesPath }) })
    try {
      const err = await resolveClaudeRuntime({ mode: 'embedded', fallbackToEmbedded: true }, { detectSystemClaude: vi.fn() })
        .catch((e: unknown) => e)
      expect(err).toBeInstanceOf(EmbeddedClaudeMissingError)
      expect((err as EmbeddedClaudeMissingError).lookedFor).toEqual(embeddedClaudeCandidates())
      expect((err as EmbeddedClaudeMissingError).lookedFor.length).toBe(process.platform === 'win32' ? 1 : 2)
    } finally {
      configureRuntimeRouter({})
    }
  })

  it('an empty embedded path (package not installed, dev) passes through unchanged', async () => {
    const result = await resolveClaudeRuntime(
      { mode: 'embedded', fallbackToEmbedded: true },
      { detectSystemClaude: vi.fn(), resolveEmbeddedClaudePath: () => '', embeddedClaudeExists: () => false },
    )
    expect(result).toEqual({ path: '', source: 'embedded', healthStatus: 'healthy' })
  })

  it('system fallback with embedded missing keeps the system reason and names the missing file', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const err = await resolveClaudeRuntime(
      { mode: 'system', fallbackToEmbedded: true },
      { detectSystemClaude: vi.fn(async () => null), resolveEmbeddedClaudePath: () => missingPath, embeddedClaudeExists: () => false },
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SystemClaudeUnavailableError)
    expect(err).not.toBeInstanceOf(SystemClaudeUnsafePathError)
    expect((err as SystemClaudeUnavailableError).reason).toBe('system-not-found')
    expect((err as SystemClaudeUnavailableError).detail).toContain(missingPath)
  })

  it('unsafe customPath with embedded missing stays a SystemClaudeUnsafePathError', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const err = await resolveClaudeRuntime(
      { mode: 'system', customPath: '/home/$USER/claude', fallbackToEmbedded: true },
      { detectSystemClaude: vi.fn(), resolveEmbeddedClaudePath: () => missingPath, embeddedClaudeExists: () => false },
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SystemClaudeUnsafePathError)
    expect((err as SystemClaudeUnavailableError).detail).toContain(missingPath)
  })

  it('a healthy system claude never looks at the embedded binary', async () => {
    const embeddedClaudeExists = vi.fn(() => false)
    const result = await resolveClaudeRuntime(
      { mode: 'system', customPath: '/usr/local/bin/claude', fallbackToEmbedded: true },
      { detectSystemClaude: vi.fn(async () => healthyInfo('/usr/local/bin/claude')), resolveEmbeddedClaudePath: () => missingPath, embeddedClaudeExists },
    )
    expect(result.source).toBe('system')
    expect(embeddedClaudeExists).not.toHaveBeenCalled()
  })
})

// T0546 (C2a): packaged builds no longer ship `@anthropic-ai/claude-agent-sdk-<platform>`.
// The SDK only falls back to that bundled binary when `pathToClaudeCodeExecutable` is
// empty, so the router must never point at it and never hand back '' outside the
// node-modules (dev / tests) layout.
describe('no fallback to the SDK-bundled claude (T0546)', () => {
  const hosts: Array<{ platform: NodeJS.Platform; arch: string; musl?: boolean }> = [
    { platform: 'win32', arch: 'x64' },
    { platform: 'darwin', arch: 'arm64' },
    { platform: 'linux', arch: 'x64', musl: false },
    { platform: 'linux', arch: 'x64', musl: true },
    { platform: 'linux', arch: 'arm64', musl: false },
  ]
  const dirs: string[] = []

  afterEach(() => {
    configureRuntimeRouter({})
    __test__.loggedMissingEmbedded.clear()
    vi.restoreAllMocks()
  })
  afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('no packaged / server-bundle candidate is a claude-agent-sdk path, and none is empty', () => {
    for (const { platform, arch, musl } of hosts) {
      const layouts = [
        { kind: 'electron-packaged' as const, resourcesPath: path.join('/r', 'resources') },
        { kind: 'server-bundle' as const, installRoot: path.join('/opt', 'bat-server') },
      ]
      for (const layout of layouts) {
        const candidates = embeddedClaudeCandidates(layout, platform, () => '/unused', { arch, musl })
        expect(candidates.length).toBeGreaterThan(0)
        for (const candidate of candidates) {
          expect(candidate).not.toBe('')
          expect(candidate).not.toMatch(/claude-agent-sdk/)
        }
        const resolved = resolveEmbeddedClaudePath(layout, platform, () => '/unused', { arch, musl, exists: () => false })
        expect(resolved).not.toBe('')
        expect(resolved).not.toMatch(/claude-agent-sdk/)
      }
    }
  })

  it('embedded mode throws EmbeddedClaudeMissingError even when an SDK-bundled claude is on disk', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const resourcesPath = fs.mkdtempSync(path.join(os.tmpdir(), 't0546-resources-'))
    dirs.push(resourcesPath)
    const anthropic = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '@anthropic-ai')
    const sdkBinaries = [
      path.join(anthropic, `claude-agent-sdk-${process.platform}-${process.arch}`, process.platform === 'win32' ? 'claude.exe' : 'claude'),
      path.join(anthropic, 'claude-agent-sdk', 'cli.js'),
    ]
    for (const file of sdkBinaries) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, '')
    }
    configureRuntimeRouter({ getEmbeddedLayout: () => ({ kind: 'electron-packaged', resourcesPath }) })

    const err = await resolveClaudeRuntime({ mode: 'embedded', fallbackToEmbedded: true }, { detectSystemClaude: vi.fn() })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(EmbeddedClaudeMissingError)
    const lookedFor = (err as EmbeddedClaudeMissingError).lookedFor
    expect(lookedFor.length).toBeGreaterThan(0)
    for (const candidate of lookedFor) expect(candidate).not.toMatch(/claude-agent-sdk/)

    // system → embedded fallback with embedded missing: still an error, never the SDK binary
    const fallbackErr = await resolveClaudeRuntime({ mode: 'system', fallbackToEmbedded: true }, { detectSystemClaude: vi.fn(async () => null) })
      .catch((e: unknown) => e)
    expect(fallbackErr).toBeInstanceOf(SystemClaudeUnavailableError)
    expect((fallbackErr as SystemClaudeUnavailableError).detail).not.toMatch(/claude-agent-sdk/)
  })
})
