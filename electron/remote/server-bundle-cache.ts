// Server bundle cache with SHA-256 sidecars (D146 / T0547).
//
// Until T0547 a cached tarball under userData/bat-server-bundles/ was verified
// against the installer's baseline manifest, or (download path) against a
// manifest fetched from the network first. With no baseline in the installer
// (D146), an offline run could not use its own cache. Every tarball that enters
// the cache now gets a `<tarball>.sha256` sidecar (sha256sum format, the same
// as the release assets), written from a verified source:
//   - download: the tarball streamed through SHA verify against the release manifest
//   - import:   the tarball hashed against the .sha256 sidecar the user supplied
//   - baseline: the baseline manifest (installers before T0547 / private forks)
// A later lookup verifies the tarball against its own sidecar, without network.
//
// Result-based (no throw) except where noted.

import { createReadStream } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { logger } from '../logger'
import { compareSha256, createSha256Stream } from '../../src/lib/server-bundle-manifest'
import type { ServerBundleArch } from '../../src/lib/arch-normalize'

export const SHA256_SIDECAR_SUFFIX = '.sha256'

/** A sidecar is one line; anything larger is not a sidecar. */
const MAX_SIDECAR_BYTES = 4096

const SHA256_HEX_RE = /^[a-f0-9]{64}$/

/**
 * `bat-server-<target>-v<version>.tar.gz` (scripts/build-server-bundle.mjs naming).
 * Whitelist only: the three D092 targets and the manifest's semver shape.
 */
export const SERVER_BUNDLE_FILENAME_RE =
  /^bat-server-(linux-x64|linux-arm64|darwin-arm64)-v(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)\.tar\.gz$/

export function parseServerBundleFilename(
  filename: string,
): { arch: ServerBundleArch; version: string } | null {
  const m = SERVER_BUNDLE_FILENAME_RE.exec(filename)
  if (!m) return null
  return { arch: m[1] as ServerBundleArch, version: m[2] }
}

export function sidecarPathFor(tarballPath: string): string {
  return `${tarballPath}${SHA256_SIDECAR_SUFFIX}`
}

/** sha256sum format: `<hex>  <filename>\n` (what build-server-bundle.mjs writes). */
export function formatSha256Sidecar(sha256: string, filename: string): string {
  return `${sha256}  ${filename}\n`
}

/**
 * Parse a sha256sum line. Accepts `<hex>` alone, `<hex>  <name>` and the binary
 * marker `<hex> *<name>`. When a name is present it must equal `expectedFilename`
 * (a sidecar of another file must not vouch for this one).
 */
export function parseSha256Sidecar(
  text: string,
  expectedFilename: string,
): { ok: true; sha256: string } | { ok: false; error: string } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length !== 1) {
    return { ok: false, error: `expected exactly one line, got ${lines.length}` }
  }
  const m = /^([A-Fa-f0-9]{64})(?:\s+\*?(.+))?$/.exec(lines[0])
  if (!m) return { ok: false, error: 'not a sha256sum line (<64 hex>  <filename>)' }
  const sha256 = m[1].toLowerCase()
  const name = m[2]?.trim()
  if (name !== undefined && path.basename(name) !== expectedFilename) {
    return { ok: false, error: `sidecar names ${JSON.stringify(name)}, not ${expectedFilename}` }
  }
  return { ok: true, sha256 }
}

/** Read + parse a sidecar file. `missing` when it does not exist. */
export async function readSha256Sidecar(
  sidecarPath: string,
  expectedFilename: string,
): Promise<{ ok: true; sha256: string } | { ok: false; missing: boolean; error: string }> {
  let stat
  try {
    stat = await fs.stat(sidecarPath)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    return { ok: false, missing: code === 'ENOENT', error: `${sidecarPath}: ${(err as Error).message}` }
  }
  if (!stat.isFile()) return { ok: false, missing: false, error: `${sidecarPath} is not a file` }
  if (stat.size > MAX_SIDECAR_BYTES) {
    return { ok: false, missing: false, error: `${sidecarPath} is ${stat.size} bytes, too large for a sha256 sidecar` }
  }
  let text: string
  try {
    text = await fs.readFile(sidecarPath, 'utf8')
  } catch (err) {
    return { ok: false, missing: false, error: `${sidecarPath}: ${(err as Error).message}` }
  }
  const parsed = parseSha256Sidecar(text, expectedFilename)
  if (!parsed.ok) return { ok: false, missing: false, error: `${sidecarPath}: ${parsed.error}` }
  return parsed
}

/**
 * Write `<tarballPath>.sha256` (tmp + rename). Never throws; a failed write only
 * means the next offline run cannot use this cache entry.
 */
export async function writeSha256Sidecar(tarballPath: string, sha256: string): Promise<boolean> {
  if (!SHA256_HEX_RE.test(sha256)) {
    logger.warn(`[server-bundle-cache] refusing to write sidecar with invalid sha256 for ${tarballPath}`)
    return false
  }
  const sidecar = sidecarPathFor(tarballPath)
  const tmp = `${sidecar}.tmp`
  try {
    await fs.writeFile(tmp, formatSha256Sidecar(sha256, path.basename(tarballPath)), 'utf8')
    await fs.rename(tmp, sidecar)
    return true
  } catch (err) {
    logger.warn(`[server-bundle-cache] writing ${sidecar} failed: ${(err as Error).message}`)
    await fs.rm(tmp, { force: true }).catch(() => undefined)
    return false
  }
}

/** Stream a file through SHA-256. Throws on read error / abort (AbortError). */
export async function hashFile(
  filePath: string,
  signal?: AbortSignal,
): Promise<{ sha256: string; size: number }> {
  const { stream, getDigest } = createSha256Stream()
  let size = 0
  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      size += chunk.length
      cb()
    },
  })
  await pipeline(createReadStream(filePath), stream, sink, { signal })
  return { sha256: await getDigest(), size }
}

export type CachedTarballLookup =
  | { state: 'hit'; tarballPath: string; sha256: string; sizeBytes: number }
  /** No tarball in the cache. */
  | { state: 'missing' }
  /** Tarball present but no (valid) sidecar: cannot be verified without another source. */
  | { state: 'unverifiable'; tarballPath: string; reason: string }
  /** Tarball does not match its sidecar: both were removed. */
  | { state: 'mismatch'; tarballPath: string }
  | { state: 'aborted' }

async function removeEntry(tarballPath: string): Promise<void> {
  for (const p of [tarballPath, sidecarPathFor(tarballPath)]) {
    try {
      await fs.rm(p, { force: true })
    } catch (err) {
      logger.warn(`[server-bundle-cache] failed to remove ${p}: ${(err as Error).message}`)
    }
  }
}

/**
 * Look up `<cacheDir>/<filename>` and verify it against its own sidecar.
 * A mismatching entry is deleted so the caller can download / import again.
 */
export async function lookupCachedTarball(
  cacheDir: string,
  filename: string,
  signal?: AbortSignal,
): Promise<CachedTarballLookup> {
  const tarballPath = path.join(cacheDir, filename)
  try {
    const stat = await fs.stat(tarballPath)
    if (!stat.isFile()) return { state: 'missing' }
  } catch {
    return { state: 'missing' }
  }
  const sidecar = await readSha256Sidecar(sidecarPathFor(tarballPath), filename)
  if (!sidecar.ok) {
    return { state: 'unverifiable', tarballPath, reason: sidecar.missing ? 'no sidecar' : sidecar.error }
  }
  let actual: { sha256: string; size: number }
  try {
    actual = await hashFile(tarballPath, signal)
  } catch (err) {
    if ((err as Error).name === 'AbortError') return { state: 'aborted' }
    return { state: 'unverifiable', tarballPath, reason: (err as Error).message }
  }
  if (!compareSha256(sidecar.sha256, actual.sha256)) {
    logger.warn(
      `[server-bundle-cache] ${tarballPath} does not match its sidecar (expected ${sidecar.sha256.slice(0, 16)}…, got ${actual.sha256.slice(0, 16)}…); removing it`,
    )
    await removeEntry(tarballPath)
    return { state: 'mismatch', tarballPath }
  }
  return { state: 'hit', tarballPath, sha256: actual.sha256, sizeBytes: actual.size }
}
