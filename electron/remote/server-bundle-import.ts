// Import a local server bundle tarball into the cache (D146 / T0547).
//
// For hosts that cannot reach the GitHub release (offline / intranet): the user
// picks `bat-server-<target>-v<version>.tar.gz` together with its `.sha256`
// sidecar (both are release assets of `server-bundle-v<version>`). The tarball is
// hashed while it is copied into userData/bat-server-bundles/, and only a copy
// that matches the sidecar is kept, with the sidecar written next to it — the
// same cache layout a download leaves (server-bundle-cache.ts), so the
// distributor's next lookup is a plain cache hit.
//
// Paths come from a file dialog; nothing here goes through a shell (CLAUDE.md
// "Child Process Spawning"): the filename is whitelisted, copying is Node fs.

import { createReadStream, createWriteStream } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { logger } from '../logger'
import { compareSha256, createSha256Stream } from '../../src/lib/server-bundle-manifest'
import type { ServerBundleArch } from '../../src/lib/arch-normalize'
import { stripSnapshotSuffix } from '../../src/lib/snapshot-version'
import {
  parseServerBundleFilename,
  readSha256Sidecar,
  sidecarPathFor,
  writeSha256Sidecar,
} from './server-bundle-cache'

export type ServerBundleImportErrorCode =
  /** Bad IPC arguments (arch / version). */
  | 'invalid-arguments'
  /** The user closed the file dialog. */
  | 'cancelled'
  /** Not `bat-server-<target>-v<version>.tar.gz`. */
  | 'invalid-filename'
  | 'arch-mismatch'
  | 'version-mismatch'
  /** No `<tarball>.sha256` next to it and none picked. */
  | 'sidecar-missing'
  | 'sidecar-invalid'
  | 'sha-mismatch'
  | 'read-failed'
  | 'cache-write-failed'

export type ServerBundleImportResult =
  | { ok: true; tarballPath: string; sha256: string; sizeBytes: number; arch: ServerBundleArch; version: string }
  | {
      ok: false
      errorCode: ServerBundleImportErrorCode
      error: string
      /** Values for the localized message (expected / actual / file). */
      details?: { expected?: string; actual?: string; file?: string }
    }

export interface ServerBundleImportOptions {
  /** Absolute path of the picked tarball. */
  tarballPath: string
  /** Sidecar path; default `<tarballPath>.sha256`. */
  sidecarPath?: string
  expectedArch: ServerBundleArch
  /** Server bundle version the setup needs (snapshot suffix already stripped). */
  expectedVersion: string
  cacheDir: string
  signal?: AbortSignal
}

type Failure = Extract<ServerBundleImportResult, { ok: false }>

function fail(
  errorCode: ServerBundleImportErrorCode,
  error: string,
  details?: Failure['details'],
): Failure {
  logger.warn(`[server-bundle-import] ${errorCode}: ${error}`)
  return { ok: false, errorCode, error, details }
}

/** Filename / target / version checks only (no IO). */
export function checkImportFilename(
  filename: string,
  expectedArch: ServerBundleArch,
  expectedVersion: string,
): Failure | { ok: true } {
  const parsed = parseServerBundleFilename(filename)
  if (!parsed) {
    return fail(
      'invalid-filename',
      `${filename} is not a BAT server bundle (expected bat-server-${expectedArch}-v${expectedVersion}.tar.gz)`,
      { file: filename, expected: `bat-server-${expectedArch}-v${expectedVersion}.tar.gz` },
    )
  }
  if (parsed.arch !== expectedArch) {
    return fail('arch-mismatch', `${filename} is for ${parsed.arch}; this remote needs ${expectedArch}`, {
      file: filename,
      expected: expectedArch,
      actual: parsed.arch,
    })
  }
  if (parsed.version !== expectedVersion) {
    return fail('version-mismatch', `${filename} is version ${parsed.version}; this BAT needs ${expectedVersion}`, {
      file: filename,
      expected: expectedVersion,
      actual: parsed.version,
    })
  }
  return { ok: true }
}

export async function importServerBundleTarball(
  options: ServerBundleImportOptions,
): Promise<ServerBundleImportResult> {
  const { tarballPath, expectedArch, expectedVersion, cacheDir, signal } = options
  if (!path.isAbsolute(tarballPath)) {
    return fail('read-failed', `not an absolute path: ${tarballPath}`, { file: tarballPath })
  }
  const filename = path.basename(tarballPath)
  const nameCheck = checkImportFilename(filename, expectedArch, expectedVersion)
  if (!nameCheck.ok) return nameCheck

  try {
    const stat = await fs.stat(tarballPath)
    if (!stat.isFile()) return fail('read-failed', `${tarballPath} is not a file`, { file: filename })
  } catch (err) {
    return fail('read-failed', `${tarballPath}: ${(err as Error).message}`, { file: filename })
  }

  const sidecarPath = options.sidecarPath ?? sidecarPathFor(tarballPath)
  if (!path.isAbsolute(sidecarPath)) {
    return fail('sidecar-invalid', `not an absolute path: ${sidecarPath}`, { file: path.basename(sidecarPath) })
  }
  const sidecar = await readSha256Sidecar(sidecarPath, filename)
  if (!sidecar.ok) {
    return sidecar.missing
      ? fail('sidecar-missing', `no SHA-256 sidecar: ${sidecarPath}`, { file: `${filename}.sha256` })
      : fail('sidecar-invalid', sidecar.error, { file: path.basename(sidecarPath) })
  }

  try {
    await fs.mkdir(cacheDir, { recursive: true })
  } catch (err) {
    return fail('cache-write-failed', `cache dir ${cacheDir}: ${(err as Error).message}`)
  }

  // Hash while copying, so the cache holds exactly the bytes that were verified.
  const cachePath = path.join(cacheDir, filename)
  const tmpPath = `${cachePath}.import-${process.pid}-${Date.now()}.tmp`
  const { stream: shaStream, getDigest } = createSha256Stream()
  let size = 0
  shaStream.on('data', (chunk: Buffer) => {
    size += chunk.length
  })
  try {
    await pipeline(createReadStream(tarballPath), shaStream, createWriteStream(tmpPath), { signal })
  } catch (err) {
    await fs.rm(tmpPath, { force: true }).catch(() => undefined)
    const message = (err as Error).message
    if ((err as Error).name === 'AbortError') return fail('read-failed', 'import aborted', { file: filename })
    // ENOENT / EACCES on the source are read errors; anything else is the cache side.
    const code = (err as NodeJS.ErrnoException).code
    const readSide = code === 'ENOENT' || code === 'EACCES' || code === 'EPERM' || code === 'EISDIR'
    return fail(readSide ? 'read-failed' : 'cache-write-failed', `${tarballPath} → ${cachePath}: ${message}`, { file: filename })
  }

  const actual = await getDigest()
  if (!compareSha256(sidecar.sha256, actual)) {
    await fs.rm(tmpPath, { force: true }).catch(() => undefined)
    return fail(
      'sha-mismatch',
      `${filename}: SHA-256 ${actual} does not match the sidecar (${sidecar.sha256})`,
      { file: filename, expected: sidecar.sha256, actual },
    )
  }

  try {
    await fs.rename(tmpPath, cachePath)
  } catch (err) {
    await fs.rm(tmpPath, { force: true }).catch(() => undefined)
    return fail('cache-write-failed', `rename into ${cachePath}: ${(err as Error).message}`, { file: filename })
  }
  if (!(await writeSha256Sidecar(cachePath, actual))) {
    // Without its sidecar the entry cannot be verified offline: do not leave it half done.
    await fs.rm(cachePath, { force: true }).catch(() => undefined)
    return fail('cache-write-failed', `could not write ${cachePath}.sha256`, { file: filename })
  }

  logger.log(`[server-bundle-import] imported ${tarballPath} → ${cachePath} (${size} bytes, sha256 ${actual.slice(0, 16)}…)`)
  return { ok: true, tarballPath: cachePath, sha256: actual, sizeBytes: size, arch: expectedArch, version: expectedVersion }
}

// ────────────────────────────────────────────────────────────────────────────
// IPC flow (`server-bundle:import-local`): dialogs are injected so the flow is
// testable without Electron (main.ts passes dialog.showOpenDialog wrappers).
// ────────────────────────────────────────────────────────────────────────────

const IMPORT_ARCHS: readonly ServerBundleArch[] = ['linux-x64', 'linux-arm64', 'darwin-arm64']
/** app.getVersion() shapes, including local snapshot suffixes (stripped below). */
const REQUEST_VERSION_RE = /^\d+\.\d+\.\d+[0-9A-Za-z.+-]{0,64}$/
const MAX_DIALOG_TITLE = 200

export interface ImportLocalRequest {
  arch: ServerBundleArch
  /** Already snapshot-stripped. */
  version: string
  dialogTitle?: string
  sidecarDialogTitle?: string
}

/** Validate the renderer's request (IPC arguments are not type-checked at runtime). */
export function parseImportLocalRequest(raw: unknown): ImportLocalRequest | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.arch !== 'string' || !(IMPORT_ARCHS as readonly string[]).includes(r.arch)) return null
  if (typeof r.version !== 'string' || !REQUEST_VERSION_RE.test(r.version)) return null
  const title = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 && v.length <= MAX_DIALOG_TITLE ? v : undefined
  return {
    arch: r.arch as ServerBundleArch,
    version: stripSnapshotSuffix(r.version),
    dialogTitle: title(r.dialogTitle),
    sidecarDialogTitle: title(r.sidecarDialogTitle),
  }
}

export interface ImportLocalDeps {
  cacheDir: string
  /** Returns the picked tarball path, or null when cancelled. */
  pickTarball: (title: string) => Promise<string | null>
  /** Asked only when `<tarball>.sha256` is not next to the tarball. */
  pickSidecar: (title: string, tarballFilename: string) => Promise<string | null>
}

export async function importLocalServerBundle(
  rawRequest: unknown,
  deps: ImportLocalDeps,
): Promise<ServerBundleImportResult> {
  const request = parseImportLocalRequest(rawRequest)
  if (!request) return fail('invalid-arguments', 'Invalid arguments to server-bundle:import-local')
  const expectedName = `bat-server-${request.arch}-v${request.version}.tar.gz`

  const tarballPath = await deps.pickTarball(request.dialogTitle ?? `Select ${expectedName}`)
  if (!tarballPath) return { ok: false, errorCode: 'cancelled', error: 'Import cancelled.' }

  // Reject a wrong file before asking for its sidecar.
  const nameCheck = checkImportFilename(path.basename(tarballPath), request.arch, request.version)
  if (!nameCheck.ok) return nameCheck

  let sidecarPath = sidecarPathFor(tarballPath)
  let sidecarNextToTarball = true
  try {
    await fs.access(sidecarPath)
  } catch {
    sidecarNextToTarball = false
  }
  if (!sidecarNextToTarball) {
    const picked = await deps.pickSidecar(
      request.sidecarDialogTitle ?? `Select ${expectedName}.sha256`,
      path.basename(tarballPath),
    )
    if (!picked) {
      return fail('sidecar-missing', `no SHA-256 sidecar for ${tarballPath}`, { file: `${path.basename(tarballPath)}.sha256` })
    }
    sidecarPath = picked
  }

  return importServerBundleTarball({
    tarballPath,
    sidecarPath,
    expectedArch: request.arch,
    expectedVersion: request.version,
    cacheDir: deps.cacheDir,
  })
}
