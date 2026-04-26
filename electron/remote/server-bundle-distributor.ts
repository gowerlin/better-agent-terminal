// Server bundle distributor (PLAN-031 / T0320).
//
// Single-entry façade that resolves a verified server-bundle tarball for a given
// (profileId, version) by composing three upstream modules built in Sprint 2-3:
//
//   T0316 → installer-shipped baseline tarball under `process.resourcesPath/bat-server-baseline/`
//   T0317 → manifest schema parser + SHA256 streaming + timing-safe compare
//   T0318 → runtime download module (GitHub Release fallback with retry / rate-limit handling)
//   T0319 → remote arch detection (WSL / Docker / SSH dispatch)
//
// Lookup priority (spec §3.5): cache → baseline → download.
// Result-based API (no throw); all errors → { ok: false, errorCode, error }.

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app } from 'electron'
import { logger } from '../logger'
import type { ProfileEntry } from '../profile-manager'
import { detectRemoteArch } from './arch-detect'
import {
  downloadServerBundle,
  type ProgressEvent,
} from './server-bundle-download'
import {
  compareSha256,
  createSha256Stream,
  parseManifest,
  type TarballEntry,
} from '../../src/lib/server-bundle-manifest'
import { type ServerBundleArch } from '../../src/lib/arch-normalize'
import {
  classifyDistributeError,
  expectedTarballFilename,
  resolveDefaultPaths,
  shouldFallbackToDownload,
  type DistributeErrorCode,
  type DistributeSource,
} from '../../src/lib/server-bundle-distributor-helpers'

export type {
  DistributeErrorCode,
  DistributeSource,
} from '../../src/lib/server-bundle-distributor-helpers'
export type { ProgressEvent } from './server-bundle-download'

export interface DistributeOptions {
  /**
   * Resolved profile for arch detection (passed to T0319 detectRemoteArch).
   *
   * Note: workorder spec named this `profileId: string` but the IPC layer
   * (electron/main.ts) already resolves profiles from `profileManager`
   * before calling distributor — same pattern as T0319 detectRemoteArch.
   * Accepting the resolved entry directly avoids exporting the
   * profileManager singleton or duplicating profile lookup logic here.
   * The distributor IPC handler does the resolution from `profileId`.
   */
  profile: ProfileEntry
  /** BAT version (default: app.getVersion()). */
  version?: string
  /** Cache dir override (default: app.getPath('userData') + '/bat-server-bundles'). */
  cacheDir?: string
  /** Baseline dir override (default: process.resourcesPath + '/bat-server-baseline'). */
  baselineDir?: string
  /** Download fallback base URL override (passed through to T0318). */
  baseURL?: string
  /** Progress callback (forwards T0318 ProgressEvent during download phase only). */
  onProgress?: (event: ProgressEvent) => void
  /** AbortSignal for user cancel (effective during SHA verify + download). */
  signal?: AbortSignal
  /** Optional GITHUB_TOKEN (passed through to T0318). */
  githubToken?: string
}

export type DistributeResult =
  | {
      ok: true
      tarballPath: string
      sha256: string
      sizeBytes: number
      source: DistributeSource
      arch: ServerBundleArch
    }
  | { ok: false; error: string; errorCode: DistributeErrorCode }

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

interface BaselineLookup {
  state: 'ok' | 'missing-manifest' | 'missing-tarball' | 'corrupted'
  entry?: TarballEntry
  tarballPath?: string
  /** When state === 'corrupted', actual SHA computed during verify. */
  actualSha?: string
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p)
    return stat.isFile()
  } catch {
    return false
  }
}

/**
 * Verify a tarball file at `tarballPath` matches `expected.sha256` using the
 * same streaming hash path as T0318 download. Honors abort.
 */
async function verifyTarballSha(
  tarballPath: string,
  expected: TarballEntry,
  signal: AbortSignal | undefined,
): Promise<{ ok: true } | { ok: false; actualSha: string } | { ok: false; error: string }> {
  let stat
  try {
    stat = await fs.stat(tarballPath)
  } catch (err) {
    return { ok: false, error: `stat failed: ${(err as Error).message}` }
  }
  if (!stat.isFile() || stat.size !== expected.size) {
    return {
      ok: false,
      error: `size mismatch (expected ${expected.size}, got ${stat.size})`,
    }
  }
  try {
    const { stream, getDigest } = createSha256Stream()
    const fh = await fs.open(tarballPath, 'r')
    try {
      const readable = fh.createReadStream()
      const sink = new Writable({
        write(_chunk, _enc, cb) {
          cb()
        },
      })
      await pipeline(readable, stream, sink, { signal })
    } finally {
      await fh.close()
    }
    const actual = await getDigest()
    if (compareSha256(expected.sha256, actual)) {
      return { ok: true }
    }
    return { ok: false, actualSha: actual }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { ok: false, error: 'aborted' }
    }
    return { ok: false, error: (err as Error).message }
  }
}

/**
 * Inspect baseline dir for a given arch. Returns:
 *   - state 'missing-manifest' → manifest.json absent / unreadable / parse-fail
 *   - state 'missing-tarball'  → manifest ok but tarball file not present
 *   - state 'corrupted'        → tarball present but SHA mismatch (fail-closed)
 *   - state 'ok'               → entry + tarballPath set
 */
async function resolveBaselineEntry(
  baselineDir: string,
  arch: ServerBundleArch,
  signal: AbortSignal | undefined,
): Promise<BaselineLookup> {
  const manifestPath = path.join(baselineDir, 'manifest.json')
  let manifestText: string
  try {
    manifestText = await fs.readFile(manifestPath, 'utf8')
  } catch {
    return { state: 'missing-manifest' }
  }
  const parsed = parseManifest(manifestText)
  if (!parsed.ok) {
    logger.warn(`[server-bundle-distributor] baseline manifest parse failed: ${parsed.error}`)
    return { state: 'missing-manifest' }
  }
  const entry = parsed.manifest.tarballs[arch]
  if (!entry) {
    return { state: 'missing-tarball' }
  }
  const tarballPath = path.join(baselineDir, entry.filename)
  if (!(await fileExists(tarballPath))) {
    return { state: 'missing-tarball' }
  }
  const verify = await verifyTarballSha(tarballPath, entry, signal)
  if (verify.ok) {
    return { state: 'ok', entry, tarballPath }
  }
  if ('actualSha' in verify && verify.actualSha) {
    return { state: 'corrupted', entry, tarballPath, actualSha: verify.actualSha }
  }
  // size mismatch / read failure → treat as corrupted (file present but unverifiable)
  return { state: 'corrupted', entry, tarballPath }
}

/**
 * Layer 1 — try cache. Return verified entry if SHA matches the **baseline**
 * manifest (single source of SHA truth without going to network). If baseline
 * manifest is unavailable, skip the cache layer entirely (we cannot verify).
 */
async function resolveCacheEntry(
  cacheDir: string,
  baselineLookup: BaselineLookup,
  signal: AbortSignal | undefined,
): Promise<{ ok: true; tarballPath: string; entry: TarballEntry } | { ok: false }> {
  if (!baselineLookup.entry) return { ok: false }
  const cachePath = path.join(cacheDir, baselineLookup.entry.filename)
  if (!(await fileExists(cachePath))) return { ok: false }
  const verify = await verifyTarballSha(cachePath, baselineLookup.entry, signal)
  if (verify.ok) return { ok: true, tarballPath: cachePath, entry: baselineLookup.entry }
  return { ok: false }
}

async function copyBaselineToCache(
  baselineTarballPath: string,
  cacheDir: string,
  filename: string,
): Promise<void> {
  const cachePath = path.join(cacheDir, filename)
  try {
    await fs.copyFile(baselineTarballPath, cachePath)
    logger.log(`[server-bundle-distributor] copied baseline → cache at ${cachePath}`)
  } catch (err) {
    // Non-fatal: caller still gets baseline result; cache will retry next time.
    logger.warn(
      `[server-bundle-distributor] copy baseline → cache failed (${(err as Error).message}); next call will re-verify baseline`,
    )
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry
// ────────────────────────────────────────────────────────────────────────────

export async function distributeServerBundle(
  options: DistributeOptions,
): Promise<DistributeResult> {
  const { profile, signal, onProgress, baseURL, githubToken } = options

  // Early abort check.
  if (signal?.aborted) {
    return { ok: false, errorCode: 'aborted', error: 'Aborted before start.' }
  }

  // ── Resolve defaults ───────────────────────────────────────────────────
  const version = options.version ?? app.getVersion()
  const defaults = resolveDefaultPaths({
    userDataDir: app.getPath('userData'),
    resourcesPath: process.resourcesPath,
  })
  const cacheDir = options.cacheDir ?? defaults.cacheDir
  const baselineDir = options.baselineDir ?? defaults.baselineDir

  try {
    await fs.mkdir(cacheDir, { recursive: true })
  } catch (err) {
    const msg = (err as Error).message
    logger.error(`[server-bundle-distributor] cacheDir mkdir failed: ${msg}`)
    return {
      ok: false,
      errorCode: 'download-failed',
      error: `Cache dir mkdir failed (${cacheDir}): ${msg}`,
    }
  }

  // ── Phase 1: Arch detection (T0319) ────────────────────────────────────
  const archResult = await detectRemoteArch(profile)
  if (!archResult.ok) {
    return {
      ok: false,
      errorCode: 'arch-detection-failed',
      error: `Arch detection failed: ${archResult.error}`,
    }
  }
  const arch = archResult.arch
  const expectedFilename = expectedTarballFilename(arch, version)
  logger.log(
    `[server-bundle-distributor] start: profile=${profile.id} arch=${arch} version=${version} target=${expectedFilename}`,
  )

  // ── Phase 2: Baseline manifest lookup (needed for cache SHA verify) ────
  const baselineLookup = await resolveBaselineEntry(baselineDir, arch, signal)

  if (signal?.aborted) {
    return { ok: false, errorCode: 'aborted', error: 'Aborted during baseline check.' }
  }

  // ── Layer 1: Cache hit (verified against baseline manifest) ────────────
  const cacheHit = await resolveCacheEntry(cacheDir, baselineLookup, signal)
  if (cacheHit.ok) {
    logger.log(`[server-bundle-distributor] cache hit at ${cacheHit.tarballPath}`)
    return {
      ok: true,
      tarballPath: cacheHit.tarballPath,
      sha256: cacheHit.entry.sha256,
      sizeBytes: cacheHit.entry.size,
      source: 'cache',
      arch,
    }
  }

  if (signal?.aborted) {
    return { ok: false, errorCode: 'aborted', error: 'Aborted during cache check.' }
  }

  // ── Layer 2: Baseline ──────────────────────────────────────────────────
  if (baselineLookup.state === 'ok' && baselineLookup.entry && baselineLookup.tarballPath) {
    await copyBaselineToCache(baselineLookup.tarballPath, cacheDir, expectedFilename)
    logger.log(
      `[server-bundle-distributor] baseline hit at ${baselineLookup.tarballPath} (no network)`,
    )
    return {
      ok: true,
      tarballPath: baselineLookup.tarballPath,
      sha256: baselineLookup.entry.sha256,
      sizeBytes: baselineLookup.entry.size,
      source: 'baseline',
      arch,
    }
  }

  // Baseline corrupted → fail-closed (do NOT fallback to download).
  if (baselineLookup.state === 'corrupted') {
    const detail =
      baselineLookup.entry && baselineLookup.actualSha
        ? `at ${baselineLookup.tarballPath}, expected SHA ${baselineLookup.entry.sha256.slice(0, 16)}…, actual ${baselineLookup.actualSha.slice(0, 16)}…`
        : `at ${baselineLookup.tarballPath ?? baselineDir}`
    const cls = classifyDistributeError('baseline', detail)
    logger.error(`[server-bundle-distributor] ${cls.error}`)
    return { ok: false, errorCode: cls.errorCode, error: cls.error }
  }

  // baselineLookup.state in { 'missing-manifest', 'missing-tarball' } → fall through to download
  if (!shouldFallbackToDownload(baselineLookup.state)) {
    // Defensive: shouldFallbackToDownload returns false only for 'corrupted',
    // which is handled above. Kept for future expansion of baselineState union.
    return {
      ok: false,
      errorCode: 'no-source-available',
      error: `Baseline state ${baselineLookup.state} blocks download fallback.`,
    }
  }

  // ── Layer 3: Download fallback (T0318) ─────────────────────────────────
  logger.log(
    `[server-bundle-distributor] baseline ${baselineLookup.state} → falling back to download for ${arch} v${version}`,
  )
  const downloadResult = await downloadServerBundle({
    arch,
    version,
    cacheDir,
    baseURL,
    githubToken,
    onProgress,
    signal,
  })

  if (downloadResult.ok) {
    return {
      ok: true,
      tarballPath: downloadResult.tarballPath,
      sha256: downloadResult.sha256,
      sizeBytes: downloadResult.sizeBytes,
      source: 'download',
      arch,
    }
  }

  // Map T0318 errorCode → distributor errorCode.
  if (downloadResult.errorCode === 'aborted') {
    return { ok: false, errorCode: 'aborted', error: downloadResult.error }
  }
  const cls = classifyDistributeError(
    'download',
    `${downloadResult.errorCode}: ${downloadResult.error}`,
  )
  return { ok: false, errorCode: cls.errorCode, error: cls.error }
}
