// @vitest-environment node
/**
 * T0785: secrets.ts uses safeStorage's async API only (Electron 45 deprecates the sync
 * API, 46 removes it). A fake safeStorage stands in for Electron's: its sync methods throw,
 * so any remaining sync call fails the test.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const warn = vi.fn()
vi.mock('../../logger', () => ({
  logger: { error: vi.fn(), warn: (...args: unknown[]) => warn(...args), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

import {
  createElectronSafeStorageStrategy,
  decryptPersisted,
  detectSecretStrategy,
  encryptString,
  getSecretStrategy,
  isSafeStorageAvailable,
  readSecretFile,
  resetSecretsForTests,
  setSecretStrategy,
  writeSecretFile,
} from '../secrets'

const PREFIX = Buffer.from('v10')

/** Fake cipher: "v10" + reversed bytes. Sync and async share it, like Electron's (docs). */
function fakeCipher(plain: string): Buffer {
  return Buffer.concat([PREFIX, Buffer.from(plain, 'utf8').reverse()])
}
function fakeDecipher(value: Buffer): string {
  if (!value.subarray(0, 3).equals(PREFIX)) throw new Error('bad ciphertext')
  return Buffer.from(value.subarray(3)).reverse().toString('utf8')
}

function makeFakeSafeStorage(opts: { available?: boolean | 'reject'; shouldReEncrypt?: boolean } = {}) {
  const available = opts.available ?? true
  const calls = { isAvailable: 0, encrypt: 0, decrypt: 0 }
  const syncCalled = () => {
    throw new Error('sync safeStorage API must not be called (T0785)')
  }
  return {
    calls,
    safeStorage: {
      isAsyncEncryptionAvailable: async () => {
        calls.isAvailable++
        if (available === 'reject') throw new Error('init failed')
        return available
      },
      encryptStringAsync: async (plain: string) => {
        calls.encrypt++
        return fakeCipher(plain)
      },
      decryptStringAsync: async (value: Buffer) => {
        calls.decrypt++
        return { result: fakeDecipher(value), shouldReEncrypt: opts.shouldReEncrypt ?? false }
      },
      isEncryptionAvailable: syncCalled,
      encryptString: syncCalled,
      decryptString: syncCalled,
    },
  }
}

let tmpDir: string

beforeEach(() => {
  resetSecretsForTests()
  warn.mockClear()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't0785-secrets-'))
})

afterEach(() => {
  resetSecretsForTests()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('secrets (T0785 async safeStorage)', () => {
  it('encrypts and decrypts through the async API only', async () => {
    const fake = makeFakeSafeStorage()
    setSecretStrategy(createElectronSafeStorageStrategy(fake.safeStorage))

    const file = path.join(tmpDir, 'server-token.json')
    await writeSecretFile(file, 'tok-abc')
    const record = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(record).toEqual({ v: 1, encrypted: true, data: fakeCipher('tok-abc').toString('base64') })
    expect(await readSecretFile(file)).toBe('tok-abc')
    expect(fake.calls.encrypt).toBe(1)
    expect(fake.calls.decrypt).toBe(1)
    expect(await isSafeStorageAvailable()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('reads a file written by the old sync encryptString without rewriting it', async () => {
    // Same bytes the pre-T0785 code wrote: base64 of the sync encryptString API's output.
    const file = path.join(tmpDir, 'server-token.json')
    const legacy = JSON.stringify({ v: 1, encrypted: true, data: fakeCipher('legacy-token').toString('base64') }, null, 2)
    fs.writeFileSync(file, legacy)
    const fake = makeFakeSafeStorage({ shouldReEncrypt: true })
    setSecretStrategy(createElectronSafeStorageStrategy(fake.safeStorage))

    expect(await readSecretFile(file)).toBe('legacy-token')
    // A read never touches the file, even when the async API suggests re-encrypting.
    expect(fs.readFileSync(file, 'utf8')).toBe(legacy)
    expect(fake.calls.encrypt).toBe(0)
  })

  it('falls back to plaintext and warns once when async encryption is unavailable', async () => {
    const fake = makeFakeSafeStorage({ available: false })
    setSecretStrategy(createElectronSafeStorageStrategy(fake.safeStorage))

    expect(await encryptString('p1')).toEqual({ v: 1, encrypted: false, data: 'p1' })
    expect(await encryptString('p2')).toEqual({ v: 1, encrypted: false, data: 'p2' })
    expect((await getSecretStrategy()).name).toBe('plaintext')
    expect(await isSafeStorageAvailable()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('[Secrets] safeStorage encryption is not available')
    // The warning never carries the secret.
    expect(String(warn.mock.calls[0][0])).not.toContain('p1')
  })

  it('treats a rejected isAsyncEncryptionAvailable as unavailable', async () => {
    const fake = makeFakeSafeStorage({ available: 'reject' })
    const strategy = createElectronSafeStorageStrategy(fake.safeStorage)
    expect(await strategy.isAvailable()).toBe(false)
    await expect(strategy.encrypt('x')).rejects.toThrow('safeStorage encryption is unavailable')
  })

  it('returns null for an encrypted file when safeStorage is unavailable (caller regenerates)', async () => {
    const file = path.join(tmpDir, 'server-token.json')
    fs.writeFileSync(file, JSON.stringify({ v: 1, encrypted: true, data: fakeCipher('t').toString('base64') }))
    setSecretStrategy(createElectronSafeStorageStrategy(makeFakeSafeStorage({ available: false }).safeStorage))
    expect(await readSecretFile(file)).toBeNull()
  })

  it('returns null when decryption fails', async () => {
    const file = path.join(tmpDir, 'server-token.json')
    fs.writeFileSync(file, JSON.stringify({ v: 1, encrypted: true, data: Buffer.from('garbage').toString('base64') }))
    setSecretStrategy(createElectronSafeStorageStrategy(makeFakeSafeStorage().safeStorage))
    expect(await readSecretFile(file)).toBeNull()
  })

  it('reads plaintext records and the legacy { token } layout', async () => {
    const plain = path.join(tmpDir, 'plain.json')
    fs.writeFileSync(plain, JSON.stringify({ v: 1, encrypted: false, data: 'plain-tok' }))
    const legacy = path.join(tmpDir, 'legacy.json')
    fs.writeFileSync(legacy, JSON.stringify({ token: 'old-tok' }))
    setSecretStrategy(createElectronSafeStorageStrategy(makeFakeSafeStorage().safeStorage))

    expect(await readSecretFile(plain)).toBe('plain-tok')
    expect(await readSecretFile(legacy)).toBe('old-tok')
    expect(await readSecretFile(path.join(tmpDir, 'missing.json'))).toBeNull()
    await expect(decryptPersisted(null as never)).rejects.toThrow('invalid record')
  })

  it('detects plaintext when electron has no usable safeStorage (headless / tests)', async () => {
    expect((await detectSecretStrategy()).name).toBe('plaintext')
  })

  it('source guard: no sync safeStorage API call is left in electron/', () => {
    const root = path.resolve(__dirname, '..', '..')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full)
        } else if (/\.tsx?$/.test(entry.name)) {
          const text = fs.readFileSync(full, 'utf8')
          if (/safeStorage\??\.(isEncryptionAvailable|encryptString|decryptString)\s*\(/.test(text)) offenders.push(full)
        }
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })
})
