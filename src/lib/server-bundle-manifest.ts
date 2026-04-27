// verify-renderer-imports-allow — main-process only, never imported by renderer.
// Importers (grep-verified): electron/remote/server-bundle-distributor.ts,
// electron/remote/server-bundle-download.ts. Follow-up: relocate to electron/remote/.
//
// Server bundle manifest validator + SHA256 stream helpers (PLAN-031 / T0317).
//
// Pure library — no env reads, no fs IO, no fetch. Only Node `crypto` + `stream`
// built-ins for hash computation. Shared by T0318 (download module) /
// T0319 (IPC handler) / T0320 (distributor).
//
// Spec source: T0314 spec §9 (manifest schema v1) + T0317 工單 §44–116.

import { createHash, timingSafeEqual } from 'node:crypto'
import { Transform } from 'node:stream'
import type { ServerBundleArch } from './arch-normalize'

export type { ServerBundleArch } from './arch-normalize'

const ARCH_LIST: readonly ServerBundleArch[] = [
  'linux-x64',
  'linux-arm64',
  'darwin-arm64',
]

const SHA256_HEX_RE = /^[a-f0-9]{64}$/
const VERSION_RE = /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/

export interface TarballEntry {
  filename: string
  /** Hex 64-char lowercase SHA256 digest. */
  sha256: string
  /** File size in bytes (positive integer). */
  size: number
}

export interface ServerBundleManifest {
  schemaVersion: '1'
  /** Semver string, e.g. `0.5.0` or `0.5.0-pre.1`. */
  version: string
  /** ISO 8601 timestamp parsable by `Date.parse()`. */
  buildDate: string
  tarballs: Record<ServerBundleArch, TarballEntry>
}

export type ManifestErrorCode =
  | 'invalid-json'
  | 'schema-version-mismatch'
  | 'missing-field'
  | 'invalid-version'
  | 'invalid-build-date'
  | 'missing-tarball-arch'
  | 'invalid-sha256-format'
  | 'invalid-size'

export type ParseResult =
  | { ok: true; manifest: ServerBundleManifest }
  | { ok: false; error: string; errorCode: ManifestErrorCode }

function fail(code: ManifestErrorCode, message: string): ParseResult {
  return { ok: false, errorCode: code, error: `${code}: ${message}` }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateTarballEntry(
  entry: unknown,
  arch: ServerBundleArch,
): ParseResult | null {
  if (!isPlainObject(entry)) {
    return fail('missing-tarball-arch', `${arch} entry must be an object`)
  }
  const { filename, sha256, size } = entry as Record<string, unknown>

  if (typeof filename !== 'string' || filename.length === 0) {
    return fail('missing-field', `tarballs.${arch}.filename must be non-empty string`)
  }
  if (typeof sha256 !== 'string' || !SHA256_HEX_RE.test(sha256)) {
    return fail(
      'invalid-sha256-format',
      `tarballs.${arch}.sha256 must be 64-char lowercase hex (got ${JSON.stringify(sha256)})`,
    )
  }
  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
    return fail(
      'invalid-size',
      `tarballs.${arch}.size must be positive integer (got ${JSON.stringify(size)})`,
    )
  }
  return null
}

/**
 * Parse manifest text and validate against schema v1.
 *
 * Never throws on bad input — returns an actionable `{ ok: false, errorCode, error }`
 * result. Caller (T0318 download module) can surface `error` directly to user.
 *
 * @param text Raw JSON string from manifest fetch.
 * @returns `{ ok: true, manifest }` on success, `{ ok: false, ... }` otherwise.
 * @throws Never — bad input always returns `ok: false`.
 *
 * @example
 *   const res = parseManifest(await fetchText(url))
 *   if (!res.ok) { console.error(res.error); return }
 *   const entry = lookupTarball(res.manifest, 'linux-x64')
 */
export function parseManifest(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return fail('invalid-json', (e as Error).message)
  }

  if (!isPlainObject(parsed)) {
    return fail('invalid-json', 'root must be a JSON object')
  }

  const obj = parsed as Record<string, unknown>

  if (obj.schemaVersion !== '1') {
    return fail(
      'schema-version-mismatch',
      `expected schemaVersion='1', got ${JSON.stringify(obj.schemaVersion)}`,
    )
  }

  if (typeof obj.version !== 'string') {
    return fail('missing-field', 'version must be a string')
  }
  if (!VERSION_RE.test(obj.version)) {
    return fail('invalid-version', `version ${JSON.stringify(obj.version)} is not semver`)
  }

  if (typeof obj.buildDate !== 'string') {
    return fail('missing-field', 'buildDate must be a string')
  }
  const buildDateMs = Date.parse(obj.buildDate)
  if (Number.isNaN(buildDateMs)) {
    return fail(
      'invalid-build-date',
      `buildDate ${JSON.stringify(obj.buildDate)} is not parseable ISO 8601`,
    )
  }

  if (!isPlainObject(obj.tarballs)) {
    return fail('missing-field', 'tarballs must be an object')
  }

  const tarballs = obj.tarballs as Record<string, unknown>
  for (const arch of ARCH_LIST) {
    if (!(arch in tarballs)) {
      return fail('missing-tarball-arch', `tarballs.${arch} is required`)
    }
    const err = validateTarballEntry(tarballs[arch], arch)
    if (err) return err
  }

  const manifest: ServerBundleManifest = {
    schemaVersion: '1',
    version: obj.version,
    buildDate: obj.buildDate,
    tarballs: {
      'linux-x64': tarballs['linux-x64'] as TarballEntry,
      'linux-arm64': tarballs['linux-arm64'] as TarballEntry,
      'darwin-arm64': tarballs['darwin-arm64'] as TarballEntry,
    },
  }
  return { ok: true, manifest }
}

/**
 * Type guard for runtime manifest object. Use after `JSON.parse` if caller
 * already has the parsed object and only needs structural validation.
 *
 * @param json Unknown candidate object.
 * @returns `true` if `json` matches `ServerBundleManifest` shape.
 *
 * @example
 *   const obj = JSON.parse(text)
 *   if (isValidManifest(obj)) { useManifest(obj) }
 */
export function isValidManifest(json: unknown): json is ServerBundleManifest {
  if (!isPlainObject(json)) return false
  if (json.schemaVersion !== '1') return false
  if (typeof json.version !== 'string' || !VERSION_RE.test(json.version)) return false
  if (typeof json.buildDate !== 'string' || Number.isNaN(Date.parse(json.buildDate))) return false
  if (!isPlainObject(json.tarballs)) return false

  const tarballs = json.tarballs as Record<string, unknown>
  for (const arch of ARCH_LIST) {
    if (!(arch in tarballs)) return false
    if (validateTarballEntry(tarballs[arch], arch) !== null) return false
  }
  return true
}

/**
 * Lookup tarball entry for given arch. Returns `null` if missing
 * (defensive — should not happen for a valid manifest).
 *
 * @param manifest Validated manifest.
 * @param arch Target architecture.
 * @returns `TarballEntry` or `null`.
 *
 * @example
 *   const entry = lookupTarball(manifest, 'linux-arm64')
 *   if (!entry) throw new Error('arch missing from manifest')
 */
export function lookupTarball(
  manifest: ServerBundleManifest,
  arch: ServerBundleArch,
): TarballEntry | null {
  const entry = manifest.tarballs[arch]
  return entry ?? null
}

/**
 * Create a Transform stream that computes SHA256 incrementally while
 * passing data through unchanged.
 *
 * @returns `{ stream, getDigest }` where `stream` is a passthrough Transform
 *   that hashes each chunk, and `getDigest()` resolves with the lowercase
 *   hex digest once the stream emits `end`.
 * @throws Never — `getDigest()` rejects if the upstream emits `error`.
 *
 * @example
 *   const { stream, getDigest } = createSha256Stream()
 *   downloadStream.pipe(stream).pipe(fs.createWriteStream(dest))
 *   const actual = await getDigest()
 *   if (!compareSha256(manifestEntry.sha256, actual)) throw new Error('SHA mismatch')
 */
export function createSha256Stream(): {
  stream: Transform
  getDigest: () => Promise<string>
} {
  const hash = createHash('sha256')
  let resolved: string | null = null
  let rejected: Error | null = null
  const waiters: Array<(value: string) => void> = []
  const errorWaiters: Array<(err: Error) => void> = []

  const stream = new Transform({
    transform(chunk, _enc, cb) {
      try {
        hash.update(chunk)
        cb(null, chunk)
      } catch (e) {
        cb(e as Error)
      }
    },
  })

  stream.on('end', () => {
    resolved = hash.digest('hex')
    for (const w of waiters) w(resolved)
    waiters.length = 0
  })

  stream.on('error', (err: Error) => {
    rejected = err
    for (const w of errorWaiters) w(err)
    errorWaiters.length = 0
  })

  function getDigest(): Promise<string> {
    if (resolved !== null) return Promise.resolve(resolved)
    if (rejected !== null) return Promise.reject(rejected)
    return new Promise<string>((resolve, reject) => {
      waiters.push(resolve)
      errorWaiters.push(reject)
    })
  }

  return { stream, getDigest }
}

/**
 * Constant-time SHA256 hex comparison (avoids timing-attack on user-input).
 * Both args expected hex 64-char lowercase; mismatched length returns `false`
 * without throwing.
 *
 * @param expected Expected SHA256 hex (from manifest).
 * @param actual Actual SHA256 hex (from download stream).
 * @returns `true` if equal.
 *
 * @example
 *   if (!compareSha256(entry.sha256, await getDigest())) {
 *     throw new Error('tarball SHA mismatch')
 *   }
 */
export function compareSha256(expected: string, actual: string): boolean {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false
  if (expected.length !== actual.length) return false
  if (!SHA256_HEX_RE.test(expected) || !SHA256_HEX_RE.test(actual)) return false
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(actual, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
