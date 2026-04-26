// @vitest-environment node
// T0317 unit tests — PLAN-031 SHA256 manifest validator + stream helpers.
// Spec: 工單 §150–184 (≥30 cases, all 8 errorCodes covered).
// node env required: lib uses node:crypto + node:stream which jsdom shim breaks.

import { describe, it, expect } from 'vitest'
import { Readable } from 'node:stream'
import {
  parseManifest,
  isValidManifest,
  lookupTarball,
  createSha256Stream,
  compareSha256,
  type ServerBundleManifest,
} from '../server-bundle-manifest'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const SHA_C = 'c'.repeat(64)
const SHA_HELLO = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
const SHA_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function validManifest(overrides: Partial<ServerBundleManifest> = {}): ServerBundleManifest {
  return {
    schemaVersion: '1',
    version: '0.5.0',
    buildDate: '2026-04-27T00:00:00Z',
    tarballs: {
      'linux-x64': { filename: 'bat-server-linux-x64-v0.5.0.tar.gz', sha256: SHA_A, size: 1024 },
      'linux-arm64': { filename: 'bat-server-linux-arm64-v0.5.0.tar.gz', sha256: SHA_B, size: 2048 },
      'darwin-arm64': { filename: 'bat-server-darwin-arm64-v0.5.0.tar.gz', sha256: SHA_C, size: 3072 },
    },
    ...overrides,
  }
}

function jsonOf(m: unknown): string {
  return JSON.stringify(m)
}

describe('parseManifest', () => {
  describe('happy path', () => {
    it('parses valid manifest with all 3 arches', () => {
      const res = parseManifest(jsonOf(validManifest()))
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.manifest.version).toBe('0.5.0')
        expect(res.manifest.tarballs['linux-x64'].sha256).toBe(SHA_A)
      }
    })

    it('accepts pre-release semver', () => {
      const res = parseManifest(jsonOf(validManifest({ version: '0.5.0-pre.1' })))
      expect(res.ok).toBe(true)
    })
  })

  describe('invalid JSON', () => {
    it('rejects malformed JSON', () => {
      const res = parseManifest('{not json')
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-json')
    })

    it('rejects non-object root (string)', () => {
      const res = parseManifest('"string"')
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-json')
    })

    it('rejects non-object root (array)', () => {
      const res = parseManifest('[]')
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-json')
    })
  })

  describe('schema version mismatch', () => {
    it('rejects schemaVersion=2', () => {
      const res = parseManifest(jsonOf({ ...validManifest(), schemaVersion: '2' }))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('schema-version-mismatch')
    })

    it('rejects missing schemaVersion', () => {
      const m = validManifest() as Partial<ServerBundleManifest>
      delete m.schemaVersion
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('schema-version-mismatch')
    })
  })

  describe('missing field', () => {
    it('rejects missing version', () => {
      const m = validManifest() as Partial<ServerBundleManifest>
      delete m.version
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('missing-field')
    })

    it('rejects missing buildDate', () => {
      const m = validManifest() as Partial<ServerBundleManifest>
      delete m.buildDate
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('missing-field')
    })

    it('rejects missing tarballs', () => {
      const m = validManifest() as Partial<ServerBundleManifest>
      delete m.tarballs
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('missing-field')
    })

    it('rejects empty filename', () => {
      const m = validManifest()
      m.tarballs['linux-x64'] = { ...m.tarballs['linux-x64'], filename: '' }
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('missing-field')
    })
  })

  describe('invalid version format', () => {
    it('rejects non-semver string', () => {
      const res = parseManifest(jsonOf(validManifest({ version: 'abc' })))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-version')
    })

    it('rejects partial version (0.5)', () => {
      const res = parseManifest(jsonOf(validManifest({ version: '0.5' })))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-version')
    })
  })

  describe('invalid build-date', () => {
    it('rejects unparseable date', () => {
      const res = parseManifest(jsonOf(validManifest({ buildDate: 'yesterday' })))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-build-date')
    })
  })

  describe('missing tarball arch', () => {
    it('rejects missing linux-arm64 with arch in error message', () => {
      const m = validManifest()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (m.tarballs as any)['linux-arm64']
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.errorCode).toBe('missing-tarball-arch')
        expect(res.error).toContain('linux-arm64')
      }
    })

    it('rejects missing darwin-arm64', () => {
      const m = validManifest()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (m.tarballs as any)['darwin-arm64']
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('missing-tarball-arch')
    })
  })

  describe('invalid sha256 format', () => {
    it('rejects 60-char SHA', () => {
      const m = validManifest()
      m.tarballs['linux-x64'] = { ...m.tarballs['linux-x64'], sha256: 'a'.repeat(60) }
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-sha256-format')
    })

    it('rejects uppercase SHA', () => {
      const m = validManifest()
      m.tarballs['linux-x64'] = { ...m.tarballs['linux-x64'], sha256: 'A'.repeat(64) }
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-sha256-format')
    })

    it('rejects non-hex char (g)', () => {
      const m = validManifest()
      m.tarballs['linux-x64'] = { ...m.tarballs['linux-x64'], sha256: 'g' + 'a'.repeat(63) }
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-sha256-format')
    })
  })

  describe('invalid size', () => {
    it('rejects negative size', () => {
      const m = validManifest()
      m.tarballs['linux-x64'] = { ...m.tarballs['linux-x64'], size: -1 }
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-size')
    })

    it('rejects float size', () => {
      const m = validManifest()
      m.tarballs['linux-x64'] = { ...m.tarballs['linux-x64'], size: 1.5 }
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-size')
    })

    it('rejects string size', () => {
      const m = validManifest()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(m.tarballs['linux-x64'] as any).size = '100'
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-size')
    })

    it('rejects zero size', () => {
      const m = validManifest()
      m.tarballs['linux-x64'] = { ...m.tarballs['linux-x64'], size: 0 }
      const res = parseManifest(jsonOf(m))
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.errorCode).toBe('invalid-size')
    })
  })
})

describe('isValidManifest', () => {
  it('accepts a full valid manifest', () => {
    expect(isValidManifest(validManifest())).toBe(true)
  })

  it('rejects null', () => {
    expect(isValidManifest(null)).toBe(false)
  })

  it('rejects array', () => {
    expect(isValidManifest([])).toBe(false)
  })

  it('rejects manifest without tarballs', () => {
    const m = validManifest() as Partial<ServerBundleManifest>
    delete m.tarballs
    expect(isValidManifest(m)).toBe(false)
  })

  it('rejects manifest with invalid SHA in entry', () => {
    const m = validManifest()
    m.tarballs['linux-x64'] = { ...m.tarballs['linux-x64'], sha256: 'bad' }
    expect(isValidManifest(m)).toBe(false)
  })
})

describe('lookupTarball', () => {
  it('returns entry for present arch', () => {
    const m = validManifest()
    const entry = lookupTarball(m, 'linux-arm64')
    expect(entry?.sha256).toBe(SHA_B)
  })

  it('returns null for missing arch (defensive)', () => {
    const m = validManifest()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (m.tarballs as any)['darwin-arm64']
    const entry = lookupTarball(m, 'darwin-arm64')
    expect(entry).toBeNull()
  })
})

describe('createSha256Stream', () => {
  it('hashes "hello" to known SHA256', async () => {
    const { stream, getDigest } = createSha256Stream()
    const out: Buffer[] = []
    stream.on('data', (c) => out.push(c))
    Readable.from([Buffer.from('hello')]).pipe(stream)
    const digest = await getDigest()
    expect(digest).toBe(SHA_HELLO)
    expect(Buffer.concat(out).toString()).toBe('hello')
  })

  it('hashes empty stream to known SHA256', async () => {
    const { stream, getDigest } = createSha256Stream()
    stream.resume()
    Readable.from([]).pipe(stream)
    const digest = await getDigest()
    expect(digest).toBe(SHA_EMPTY)
  })

  it('preserves data across multiple chunks', async () => {
    const { stream, getDigest } = createSha256Stream()
    const out: Buffer[] = []
    stream.on('data', (c) => out.push(c))
    Readable.from([Buffer.from('he'), Buffer.from('ll'), Buffer.from('o')]).pipe(stream)
    const digest = await getDigest()
    expect(digest).toBe(SHA_HELLO)
    expect(Buffer.concat(out).toString()).toBe('hello')
  })

  it('getDigest() resolves consistently when called after end', async () => {
    const { stream, getDigest } = createSha256Stream()
    stream.resume()
    Readable.from([Buffer.from('hello')]).pipe(stream)
    const first = await getDigest()
    const second = await getDigest()
    expect(first).toBe(second)
    expect(first).toBe(SHA_HELLO)
  })
})

describe('compareSha256', () => {
  it('returns true for equal hex', () => {
    expect(compareSha256(SHA_A, SHA_A)).toBe(true)
  })

  it('returns false for different hex', () => {
    expect(compareSha256(SHA_A, SHA_B)).toBe(false)
  })

  it('returns false (no throw) for length mismatch', () => {
    expect(compareSha256('a'.repeat(60), SHA_A)).toBe(false)
  })

  it('returns false for upper vs lower case (lowercase-only contract)', () => {
    expect(compareSha256(SHA_A.toUpperCase(), SHA_A)).toBe(false)
  })

  it('returns false for non-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(compareSha256(SHA_A, null as any)).toBe(false)
  })
})
