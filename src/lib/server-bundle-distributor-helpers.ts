// Pure helpers for server bundle distributor (PLAN-031 / T0320).
//
// Extracted from `electron/remote/server-bundle-distributor.ts` so they can be
// unit-tested without dragging the composite tsconfig.node.json project into
// the renderer test config (mirrors T0318/T0319 split pattern).
//
// No fs, no fetch, no env reads, no electron deps. Only path joining via
// caller-provided dirs.

import * as path from 'node:path'
import { tarballNameForArch, type ServerBundleArch } from './arch-normalize'

export type DistributeSource = 'cache' | 'baseline' | 'download'

export type DistributeErrorCode =
  /** Forwarded from T0319 detectRemoteArch. */
  | 'arch-detection-failed'
  /** Local cache + baseline + manifest all unavailable. Reserved for T0326 fail-closed UI. */
  | 'no-source-available'
  /** Forwarded from T0318 download module (any underlying download error). */
  | 'download-failed'
  /** Baseline tarball SHA mismatch — installer integrity issue, do NOT fallback. */
  | 'baseline-corrupted'
  /** AbortSignal triggered. */
  | 'aborted'

/**
 * Build canonical tarball filename for given arch + version.
 * Wraps `tarballNameForArch` for distributor-side ergonomics (named for clarity
 * in the distributor's lookup loop where the value is `expectedFilename`).
 *
 * @example
 *   expectedTarballFilename('linux-arm64', '0.5.0')
 *   // → 'bat-server-linux-arm64-v0.5.0.tar.gz'
 */
export function expectedTarballFilename(
  arch: ServerBundleArch,
  version: string,
): string {
  return tarballNameForArch(arch, version)
}

/**
 * Resolve default cache + baseline directories from caller-provided host dirs.
 *
 * Pure: no electron deps. The electron-side caller passes
 * `{ userDataDir: app.getPath('userData'), resourcesPath: process.resourcesPath }`.
 *
 * @example
 *   resolveDefaultPaths({ userDataDir: '/Users/x/Library/.../bat', resourcesPath: '/Apps/bat.app/.../Resources' })
 *   // → { cacheDir: '.../bat/bat-server-bundles', baselineDir: '.../Resources/bat-server-baseline' }
 */
export function resolveDefaultPaths(opts: {
  userDataDir: string
  resourcesPath: string
}): { cacheDir: string; baselineDir: string } {
  return {
    cacheDir: path.join(opts.userDataDir, 'bat-server-bundles'),
    baselineDir: path.join(opts.resourcesPath, 'bat-server-baseline'),
  }
}

/**
 * Wrap a layer-specific underlying error into a distributor errorCode + message.
 *
 *   layer === 'cache'    → unused in current design (cache misses fall through silently);
 *                          reserved for future cache-write surfaces.
 *   layer === 'baseline' → 'baseline-corrupted' (caller must pre-classify "missing" cases
 *                          using shouldFallbackToDownload — only call this for the
 *                          fail-closed corrupted case).
 *   layer === 'download' → 'download-failed' wrapping inner T0318 errorCode.
 */
export function classifyDistributeError(
  layer: 'cache' | 'baseline' | 'download',
  innerError: string,
): { errorCode: DistributeErrorCode; error: string } {
  if (layer === 'baseline') {
    return {
      errorCode: 'baseline-corrupted',
      error: `Baseline tarball corrupted: ${innerError}. Run installer again or report this issue.`,
    }
  }
  if (layer === 'download') {
    return {
      errorCode: 'download-failed',
      error: `Download fallback failed: ${innerError}`,
    }
  }
  // cache layer (reserved)
  return {
    errorCode: 'no-source-available',
    error: `Cache layer error: ${innerError}`,
  }
}

/**
 * Decide whether a baseline-layer miss should trigger download fallback.
 *
 *   missing-manifest / missing-tarball → true (legitimately not present in baseline)
 *   corrupted                          → false (fail-closed; baseline file present
 *                                              but SHA mismatch indicates installer
 *                                              integrity issue requiring user action)
 */
export function shouldFallbackToDownload(
  baselineState: 'missing-manifest' | 'missing-tarball' | 'corrupted',
): boolean {
  return baselineState !== 'corrupted'
}
