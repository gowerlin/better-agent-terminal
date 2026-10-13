// Whisper native addon loader — BUG-116 / T0468
//
// Why BAT does not `import` @kutalia/whisper-node-addon directly:
//   - The package's `dist/js/index.js` calls `loadAddon()` at module top level,
//     so importing it throws as soon as the `.node` is missing. voice-handler is
//     imported by main.ts, so that throw used to take down the whole main process.
//   - Its loader looks for `dist/darwin-<arch>/whisper.node`, but v1.1.0 ships the
//     macOS binaries as `dist/mac-<arch>/` ⇒ on macOS the import always threw and
//     the app could not start at all.
//
// This module requires the `.node` itself, lazily (first transcription), caches the
// outcome (success or failure) and re-implements the upstream `transcribe()` so the
// call semantics stay identical. A load failure only disables voice input.
//
// The directory rule below is duplicated in scripts/verify-native-modules.js
// (plain .js cannot import .ts) — keep the two in sync.

import { createRequire } from 'module'
import { existsSync } from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import type { WhisperOptions } from '@kutalia/whisper-node-addon'
import { logger } from './logger'

export type { WhisperOptions }

export const WHISPER_ADDON_PACKAGE = '@kutalia/whisper-node-addon'
export const WHISPER_ADDON_BINARY = 'whisper.node'

/** Output shape of the upstream `transcribe()` (v1.1.0 `index.d.ts`). */
export type WhisperTranscribeResult = { transcription: string[][] | string[] }

type WhisperAsync = (params: Record<string, unknown>) => Promise<WhisperTranscribeResult>

/** Thrown by `transcribe` when the native addon cannot be loaded on this host. */
export class WhisperAddonUnavailableError extends Error {
  readonly code = 'WHISPER_ADDON_UNAVAILABLE'
  constructor(reason: string) {
    super(`Voice recognition module (whisper) is unavailable: ${reason}`)
    this.name = 'WhisperAddonUnavailableError'
  }
}

/**
 * `dist/` sub-directories that may hold the addon for a host, in lookup order.
 * win32 / linux match upstream (`<platform>-<arch>`). macOS ships as `mac-<arch>`;
 * `darwin-<arch>` is kept as a fallback in case upstream renames to match its loader.
 */
export function whisperAddonDirCandidates(platform: string, arch: string): string[] {
  switch (platform) {
    case 'win32':
      return [`win32-${arch}`]
    case 'linux':
      return [`linux-${arch}`]
    case 'darwin':
      return [`mac-${arch}`, `darwin-${arch}`]
    default:
      return []
  }
}

/**
 * `.../app.asar/...` → `.../app.asar.unpacked/...`. The addon is in `asarUnpack`;
 * dlopen needs the real on-disk file, and `existsSync` on the unpacked path checks
 * the file that will actually be loaded. Paths outside an asar are returned as-is.
 */
export function toAsarUnpackedPath(p: string): string {
  return p.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2')
}

export interface WhisperAddonResolution {
  /** First existing candidate, or null when none exists. */
  addonPath: string | null
  /** Every candidate checked, in order (for error messages). */
  tried: string[]
}

/** Locate `whisper.node` under the package root for the given host. Pure apart from `exists`. */
export function resolveWhisperAddonPath(
  packageRoot: string,
  platform: string,
  arch: string,
  exists: (p: string) => boolean,
): WhisperAddonResolution {
  const tried: string[] = []
  for (const dir of whisperAddonDirCandidates(platform, arch)) {
    const candidate = toAsarUnpackedPath(path.join(packageRoot, 'dist', dir, WHISPER_ADDON_BINARY))
    tried.push(candidate)
    if (exists(candidate)) return { addonPath: candidate, tried }
  }
  return { addonPath: null, tried }
}

/**
 * Upstream `transcribe()` default-parameter merge (v1.1.0 `dist/js/index.js`),
 * including its validation. Caller options override every default.
 */
export function buildWhisperParams(options: WhisperOptions): Record<string, unknown> {
  const params: Record<string, unknown> = {
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
    ...options,
  }
  if (!params.model) {
    throw new Error('Model path is required')
  }
  if (!params.fname_inp && !params.pcmf32) {
    throw new Error('Input file path is required')
  }
  return params
}

export type WhisperAddonState =
  | { ok: true; addonPath: string; whisperAsync: WhisperAsync }
  | { ok: false; error: Error }

export interface WhisperAddonLoaderDeps {
  platform: string
  arch: string
  /** Absolute path of the package's `package.json`; throws when not installed. */
  resolvePackageJson: () => string
  /** Loads the native module at an absolute path. */
  requireNative: (addonPath: string) => unknown
  exists: (p: string) => boolean
  logError: (...args: unknown[]) => void
  logInfo: (...args: unknown[]) => void
}

export interface WhisperAddonLoader {
  /** Loads on first call; later calls return the cached state (success or failure). */
  load: () => WhisperAddonState
  /** Same semantics as upstream `transcribe()`; throws WhisperAddonUnavailableError if the addon cannot load. */
  transcribe: (options: WhisperOptions) => Promise<WhisperTranscribeResult>
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function createWhisperAddonLoader(deps: WhisperAddonLoaderDeps): WhisperAddonLoader {
  let state: WhisperAddonState | null = null

  const tryLoad = (): WhisperAddonState => {
    const hostLabel = `${deps.platform}-${deps.arch}`
    if (whisperAddonDirCandidates(deps.platform, deps.arch).length === 0) {
      return { ok: false, error: new Error(`unsupported platform ${hostLabel}`) }
    }

    let packageRoot: string
    try {
      packageRoot = path.dirname(deps.resolvePackageJson())
    } catch (err) {
      return { ok: false, error: new Error(`${WHISPER_ADDON_PACKAGE} is not installed (${errorMessage(err)})`) }
    }

    const { addonPath, tried } = resolveWhisperAddonPath(packageRoot, deps.platform, deps.arch, deps.exists)
    if (!addonPath) {
      return {
        ok: false,
        error: new Error(`no ${WHISPER_ADDON_BINARY} for ${hostLabel} (tried: ${tried.join(', ')})`),
      }
    }

    let whisper: unknown
    try {
      whisper = (deps.requireNative(addonPath) as { whisper?: unknown } | null)?.whisper
    } catch (err) {
      return { ok: false, error: new Error(`failed to load ${addonPath}: ${errorMessage(err)}`) }
    }
    if (typeof whisper !== 'function') {
      return { ok: false, error: new Error(`${addonPath} does not export a whisper() function`) }
    }
    return {
      ok: true,
      addonPath,
      whisperAsync: promisify(whisper as (...args: unknown[]) => void) as unknown as WhisperAsync,
    }
  }

  const load = (): WhisperAddonState => {
    if (state) return state
    state = tryLoad()
    if (state.ok) {
      deps.logInfo(`[voice] whisper addon loaded: ${state.addonPath}`)
    } else {
      // Logged once — the failure is cached, later transcribe calls only rethrow it.
      deps.logError('[voice] whisper addon unavailable, voice input disabled:', state.error)
    }
    return state
  }

  const transcribe = async (options: WhisperOptions): Promise<WhisperTranscribeResult> => {
    const loaded = load()
    if (!loaded.ok) throw new WhisperAddonUnavailableError(loaded.error.message)
    return loaded.whisperAsync(buildWhisperParams(options))
  }

  return { load, transcribe }
}

function createDefaultLoader(): WhisperAddonLoader {
  const req = createRequire(import.meta.url ?? __filename)
  return createWhisperAddonLoader({
    platform: process.platform,
    arch: process.arch,
    resolvePackageJson: () => req.resolve(`${WHISPER_ADDON_PACKAGE}/package.json`),
    requireNative: (addonPath) => req(addonPath),
    exists: existsSync,
    logError: (...args) => logger.error(...args),
    logInfo: (...args) => logger.log(...args),
  })
}

let defaultLoader: WhisperAddonLoader | null = null

function getDefaultLoader(): WhisperAddonLoader {
  defaultLoader ??= createDefaultLoader()
  return defaultLoader
}

/** Process-wide lazy load of the whisper addon (cached). */
export function loadWhisperAddon(): WhisperAddonState {
  return getDefaultLoader().load()
}

/** Drop-in replacement for `transcribe` from `@kutalia/whisper-node-addon`. */
export function transcribe(options: WhisperOptions): Promise<WhisperTranscribeResult> {
  return getDefaultLoader().transcribe(options)
}
