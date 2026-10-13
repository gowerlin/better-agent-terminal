/**
 * BUG-116 / T0468: BAT's own whisper addon loader — macOS `mac-<arch>` dir,
 * asar → asar.unpacked, lazy + cached (fail-soft) loading, and upstream
 * `transcribe()` parameter semantics (@kutalia/whisper-node-addon 1.1.0).
 */
import { createRequire } from 'module'
import * as path from 'path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import {
  buildWhisperParams,
  createWhisperAddonLoader,
  resolveWhisperAddonPath,
  toAsarUnpackedPath,
  whisperAddonDirCandidates,
  WhisperAddonUnavailableError,
  type WhisperAddonLoaderDeps,
} from '../whisper-addon-loader'

const ROOT = path.resolve('fake', 'node_modules', '@kutalia', 'whisper-node-addon')
const addonIn = (root: string, dir: string) => path.join(root, 'dist', dir, 'whisper.node')

function fakeFs(...present: string[]): (p: string) => boolean {
  const set = new Set(present)
  return (p: string) => set.has(p)
}

describe('whisperAddonDirCandidates', () => {
  it('darwin: mac-<arch> first, darwin-<arch> as fallback', () => {
    expect(whisperAddonDirCandidates('darwin', 'arm64')).toEqual(['mac-arm64', 'darwin-arm64'])
    expect(whisperAddonDirCandidates('darwin', 'x64')).toEqual(['mac-x64', 'darwin-x64'])
  })

  it('win32 / linux keep the upstream <platform>-<arch> naming', () => {
    expect(whisperAddonDirCandidates('win32', 'x64')).toEqual(['win32-x64'])
    expect(whisperAddonDirCandidates('linux', 'x64')).toEqual(['linux-x64'])
    expect(whisperAddonDirCandidates('linux', 'arm64')).toEqual(['linux-arm64'])
  })

  it('unsupported platforms have no candidates', () => {
    expect(whisperAddonDirCandidates('freebsd', 'x64')).toEqual([])
  })

  it('matches the copy in scripts/verify-native-modules.js', () => {
    const req = createRequire(import.meta.url)
    const script = req('../../scripts/verify-native-modules.js') as {
      whisperAddonDirCandidates: (platform: string, arch: string) => string[]
    }
    for (const platform of ['win32', 'linux', 'darwin', 'freebsd', 'aix']) {
      for (const arch of ['x64', 'arm64', 'ia32']) {
        expect(script.whisperAddonDirCandidates(platform, arch)).toEqual(whisperAddonDirCandidates(platform, arch))
      }
    }
  })
})

describe('toAsarUnpackedPath', () => {
  it('rewrites the app.asar segment (POSIX)', () => {
    expect(toAsarUnpackedPath('/Applications/BAT.app/Contents/Resources/app.asar/node_modules/x/whisper.node'))
      .toBe('/Applications/BAT.app/Contents/Resources/app.asar.unpacked/node_modules/x/whisper.node')
  })

  it('rewrites the app.asar segment (Windows)', () => {
    expect(toAsarUnpackedPath('C:\\Program Files\\BAT\\resources\\app.asar\\node_modules\\x\\whisper.node'))
      .toBe('C:\\Program Files\\BAT\\resources\\app.asar.unpacked\\node_modules\\x\\whisper.node')
  })

  it('leaves unpacked and non-asar paths untouched', () => {
    const unpacked = '/r/app.asar.unpacked/node_modules/x/whisper.node'
    expect(toAsarUnpackedPath(unpacked)).toBe(unpacked)
    expect(toAsarUnpackedPath('/repo/node_modules/x/whisper.node')).toBe('/repo/node_modules/x/whisper.node')
    expect(toAsarUnpackedPath('/r/app.asarx/whisper.node')).toBe('/r/app.asarx/whisper.node')
  })
})

describe('resolveWhisperAddonPath', () => {
  it('darwin-arm64 resolves the shipped mac-arm64 binary (BUG-116)', () => {
    const exists = fakeFs(addonIn(ROOT, 'mac-arm64'), addonIn(ROOT, 'mac-x64'), addonIn(ROOT, 'win32-x64'))
    expect(resolveWhisperAddonPath(ROOT, 'darwin', 'arm64', exists)).toEqual({
      addonPath: addonIn(ROOT, 'mac-arm64'),
      tried: [addonIn(ROOT, 'mac-arm64')],
    })
  })

  it('darwin prefers mac-* when both exist, falls back to darwin-*', () => {
    const both = fakeFs(addonIn(ROOT, 'mac-x64'), addonIn(ROOT, 'darwin-x64'))
    expect(resolveWhisperAddonPath(ROOT, 'darwin', 'x64', both).addonPath).toBe(addonIn(ROOT, 'mac-x64'))

    const renamedUpstream = fakeFs(addonIn(ROOT, 'darwin-x64'))
    expect(resolveWhisperAddonPath(ROOT, 'darwin', 'x64', renamedUpstream)).toEqual({
      addonPath: addonIn(ROOT, 'darwin-x64'),
      tried: [addonIn(ROOT, 'mac-x64'), addonIn(ROOT, 'darwin-x64')],
    })
  })

  it('win32-x64 resolves to exactly the path the upstream loader uses', () => {
    // upstream: join(resolve(__dirname), '..', `${platform}-${arch}`, 'whisper.node'), __dirname = <root>/dist/js
    const upstreamPath = path.join(path.resolve(ROOT, 'dist', 'js'), '..', 'win32-x64', 'whisper.node')
    const { addonPath } = resolveWhisperAddonPath(ROOT, 'win32', 'x64', fakeFs(upstreamPath))
    expect(addonPath).toBe(upstreamPath)
  })

  it('linux-x64 resolves to exactly the path the upstream loader uses', () => {
    const upstreamPath = path.join(path.resolve(ROOT, 'dist', 'js'), '..', 'linux-x64', 'whisper.node')
    expect(resolveWhisperAddonPath(ROOT, 'linux', 'x64', fakeFs(upstreamPath)).addonPath).toBe(upstreamPath)
  })

  it('returns null with every tried path when nothing exists', () => {
    expect(resolveWhisperAddonPath(ROOT, 'darwin', 'arm64', fakeFs())).toEqual({
      addonPath: null,
      tried: [addonIn(ROOT, 'mac-arm64'), addonIn(ROOT, 'darwin-arm64')],
    })
  })

  it('a package root inside app.asar resolves into app.asar.unpacked', () => {
    const asarRoot = path.join(path.resolve('Resources'), 'app.asar', 'node_modules', '@kutalia', 'whisper-node-addon')
    const unpackedRoot = path.join(path.resolve('Resources'), 'app.asar.unpacked', 'node_modules', '@kutalia', 'whisper-node-addon')
    const exists = fakeFs(addonIn(unpackedRoot, 'mac-arm64'))
    expect(resolveWhisperAddonPath(asarRoot, 'darwin', 'arm64', exists).addonPath).toBe(addonIn(unpackedRoot, 'mac-arm64'))
  })
})

describe('buildWhisperParams (upstream transcribe defaults)', () => {
  it('applies the upstream 1.1.0 defaults', () => {
    expect(buildWhisperParams({ model: '/m.bin', fname_inp: '/a.wav' })).toEqual({
      language: 'en',
      use_gpu: true,
      flash_attn: false,
      no_prints: true,
      comma_in_time: false,
      translate: true,
      no_timestamps: false,
      detect_language: false,
      audio_ctx: 0,
      max_len: 0,
      model: '/m.bin',
      fname_inp: '/a.wav',
    })
  })

  it('caller options override defaults (voice-handler: translate=false, use_gpu, language)', () => {
    const params = buildWhisperParams({
      model: '/m.bin', fname_inp: '/a.wav', use_gpu: false, no_prints: true, translate: false, language: 'zh',
    })
    expect(params).toMatchObject({ translate: false, use_gpu: false, language: 'zh', no_prints: true })
  })

  it('keeps the upstream validation errors', () => {
    expect(() => buildWhisperParams({ model: '', fname_inp: '/a.wav' })).toThrow('Model path is required')
    expect(() => buildWhisperParams({ model: '/m.bin', fname_inp: '' })).toThrow('Input file path is required')
    expect(() => buildWhisperParams({ model: '/m.bin', pcmf32: new Float32Array(1) })).not.toThrow()
  })
})

function makeDeps(overrides: Partial<WhisperAddonLoaderDeps> = {}): WhisperAddonLoaderDeps {
  return {
    platform: 'darwin',
    arch: 'arm64',
    resolvePackageJson: vi.fn(() => path.join(ROOT, 'package.json')),
    requireNative: vi.fn(),
    exists: fakeFs(addonIn(ROOT, 'mac-arm64')),
    logError: vi.fn(),
    logInfo: vi.fn(),
    ...overrides,
  }
}

describe('createWhisperAddonLoader', () => {
  it('loads lazily, once, and calls the native whisper with merged params', async () => {
    const whisper = vi.fn((_params: unknown, cb: (err: unknown, res: unknown) => void) => {
      cb(null, { transcription: [['00:00', '00:01', ' hello']] })
    })
    const deps = makeDeps({ requireNative: vi.fn(() => ({ whisper })) })
    const loader = createWhisperAddonLoader(deps)

    expect(deps.requireNative).not.toHaveBeenCalled()

    const result = await loader.transcribe({ model: '/m.bin', fname_inp: '/a.wav', translate: false })
    await loader.transcribe({ model: '/m.bin', fname_inp: '/b.wav' })

    expect(result).toEqual({ transcription: [['00:00', '00:01', ' hello']] })
    expect(deps.requireNative).toHaveBeenCalledTimes(1)
    expect(deps.requireNative).toHaveBeenCalledWith(addonIn(ROOT, 'mac-arm64'))
    expect(whisper.mock.calls[0][0]).toEqual(buildWhisperParams({ model: '/m.bin', fname_inp: '/a.wav', translate: false }))
    expect(loader.load()).toMatchObject({ ok: true, addonPath: addonIn(ROOT, 'mac-arm64') })
  })

  it('propagates a native callback error', async () => {
    const whisper = (_p: unknown, cb: (err: unknown) => void) => cb(new Error('bad wav'))
    const loader = createWhisperAddonLoader(makeDeps({ requireNative: () => ({ whisper }) }))
    await expect(loader.transcribe({ model: '/m.bin', fname_inp: '/a.wav' })).rejects.toThrow('bad wav')
  })

  it('caches a load failure, logs it once and rejects every transcribe (fail-soft)', async () => {
    const deps = makeDeps({
      requireNative: vi.fn(() => { throw new Error('dlopen failed') }),
    })
    const loader = createWhisperAddonLoader(deps)

    for (let i = 0; i < 3; i++) {
      const err = await loader.transcribe({ model: '/m.bin', fname_inp: '/a.wav' }).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(WhisperAddonUnavailableError)
      expect((err as WhisperAddonUnavailableError).code).toBe('WHISPER_ADDON_UNAVAILABLE')
      expect((err as Error).message).toContain('dlopen failed')
    }
    expect(deps.requireNative).toHaveBeenCalledTimes(1)
    expect(deps.logError).toHaveBeenCalledTimes(1)
    expect(loader.load()).toMatchObject({ ok: false })
  })

  it('reports the tried paths when no binary exists for the host', () => {
    const deps = makeDeps({ exists: fakeFs() })
    const state = createWhisperAddonLoader(deps).load()
    expect(state.ok).toBe(false)
    if (state.ok) return
    expect(state.error.message).toContain('darwin-arm64')
    expect(state.error.message).toContain(addonIn(ROOT, 'mac-arm64'))
    expect(state.error.message).toContain(addonIn(ROOT, 'darwin-arm64'))
    expect(deps.requireNative).not.toHaveBeenCalled()
  })

  it('reports a missing package', () => {
    const deps = makeDeps({ resolvePackageJson: () => { throw new Error('Cannot find module') } })
    const state = createWhisperAddonLoader(deps).load()
    expect(state).toMatchObject({ ok: false })
    if (!state.ok) expect(state.error.message).toContain('is not installed')
  })

  it('reports an unsupported platform without touching the filesystem', () => {
    const deps = makeDeps({ platform: 'freebsd', arch: 'x64' })
    const state = createWhisperAddonLoader(deps).load()
    expect(state).toMatchObject({ ok: false })
    if (!state.ok) expect(state.error.message).toContain('unsupported platform freebsd-x64')
    expect(deps.resolvePackageJson).not.toHaveBeenCalled()
  })

  it('rejects a module without a whisper() export', () => {
    const state = createWhisperAddonLoader(makeDeps({ requireNative: () => ({}) })).load()
    expect(state).toMatchObject({ ok: false })
  })

  it('surfaces upstream parameter validation once the addon is loaded', async () => {
    const loader = createWhisperAddonLoader(makeDeps({ requireNative: () => ({ whisper: vi.fn() }) }))
    await expect(loader.transcribe({ model: '', fname_inp: '/a.wav' })).rejects.toThrow('Model path is required')
  })
})
