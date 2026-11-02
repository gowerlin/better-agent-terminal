import * as fs from 'fs'
import { logger } from '../logger'

// Layout of the persisted secret file:
//   { v: 1, encrypted: true,  data: "<base64 of safeStorage ciphertext>" }
//   { v: 1, encrypted: false, data: "<raw plaintext>" }
//
// T0785: safeStorage goes through the async API only (`isAsyncEncryptionAvailable` /
// `encryptStringAsync` / `decryptStringAsync`). Electron 45 deprecates the sync API and 46
// removes it. Ciphertext written by the sync `encryptString` decrypts with
// `decryptStringAsync` (Electron docs), so existing `server-token.json` files keep working.
// Tokens and ciphertext are never logged.

interface PersistedSecretV1 {
  v: 1
  encrypted: boolean
  data: string
}

export interface SecretStrategy {
  name: string
  isAvailable(): Promise<boolean>
  encrypt(plain: string): Promise<PersistedSecretV1>
  decrypt(record: PersistedSecretV1): Promise<string>
}

interface ElectronSafeStorageLike {
  isAsyncEncryptionAvailable(): Promise<boolean>
  encryptStringAsync(plain: string): Promise<Buffer>
  decryptStringAsync(value: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>
}

class PlaintextStrategy implements SecretStrategy {
  readonly name = 'plaintext'

  constructor(private readonly warnOnUse: boolean = true) {}

  async isAvailable(): Promise<boolean> {
    return true
  }

  async encrypt(plain: string): Promise<PersistedSecretV1> {
    if (this.warnOnUse) warnFallbackOnce()
    return { v: 1, encrypted: false, data: plain }
  }

  async decrypt(record: PersistedSecretV1): Promise<string> {
    if (this.warnOnUse) warnFallbackOnce()
    return record.data
  }
}

class ElectronSafeStorageStrategy implements SecretStrategy {
  readonly name = 'electron-safe-storage'

  constructor(private readonly safeStorage: ElectronSafeStorageLike) {}

  async isAvailable(): Promise<boolean> {
    try {
      return (await this.safeStorage.isAsyncEncryptionAvailable()) === true
    } catch {
      return false
    }
  }

  async encrypt(plain: string): Promise<PersistedSecretV1> {
    if (!(await this.isAvailable())) {
      throw new Error('safeStorage encryption is unavailable')
    }
    const buf = await this.safeStorage.encryptStringAsync(plain)
    return { v: 1, encrypted: true, data: buf.toString('base64') }
  }

  async decrypt(record: PersistedSecretV1): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new Error(
        'Stored secret is encrypted but safeStorage is unavailable on this system'
      )
    }
    // `shouldReEncrypt` is not acted on here: the file is left as it is (T0785: existing
    // ciphertext is never regenerated or invalidated by a read). RemoteServer.start()
    // persists the token again on every start, which writes fresh async ciphertext.
    const { result } = await this.safeStorage.decryptStringAsync(
      Buffer.from(record.data, 'base64')
    )
    return result
  }
}

let warnedUnavailable = false
let activeStrategy: SecretStrategy | null = null

function warnFallbackOnce(): void {
  if (warnedUnavailable) return
  warnedUnavailable = true
  logger.warn(
    '[Secrets] safeStorage encryption is not available (likely Linux without a keychain). ' +
      'Falling back to plaintext storage — tokens and keys will be stored unencrypted on disk.'
  )
}

function isElectronSafeStorageLike(value: unknown): value is ElectronSafeStorageLike {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.isAsyncEncryptionAvailable === 'function' &&
    typeof candidate.encryptStringAsync === 'function' &&
    typeof candidate.decryptStringAsync === 'function'
  )
}

function tryLoadElectronSafeStorage(): ElectronSafeStorageLike | null {
  try {
    const electron = require('electron') as { safeStorage?: unknown }
    return isElectronSafeStorageLike(electron.safeStorage) ? electron.safeStorage : null
  } catch {
    return null
  }
}

/** Test seam: the strategy `detectSecretStrategy` would build for a given safeStorage. */
export function createElectronSafeStorageStrategy(safeStorage: ElectronSafeStorageLike): SecretStrategy {
  return new ElectronSafeStorageStrategy(safeStorage)
}

export async function detectSecretStrategy(): Promise<SecretStrategy> {
  const safeStorage = tryLoadElectronSafeStorage()
  if (safeStorage) {
    const strategy = new ElectronSafeStorageStrategy(safeStorage)
    if (await strategy.isAvailable()) return strategy
  }
  return new PlaintextStrategy(true)
}

export function setSecretStrategy(strategy: SecretStrategy): void {
  activeStrategy = strategy
}

export async function getSecretStrategy(): Promise<SecretStrategy> {
  if (!activeStrategy) {
    activeStrategy = await detectSecretStrategy()
  }
  return activeStrategy
}

export async function encryptString(plain: string): Promise<PersistedSecretV1> {
  const strategy = await getSecretStrategy()
  if (await strategy.isAvailable()) {
    return strategy.encrypt(plain)
  }
  const fallback = new PlaintextStrategy(true)
  setSecretStrategy(fallback)
  return fallback.encrypt(plain)
}

export async function decryptPersisted(record: PersistedSecretV1): Promise<string> {
  if (!record || typeof record !== 'object') {
    throw new Error('decryptPersisted: invalid record')
  }
  if (!record.encrypted) {
    return new PlaintextStrategy(true).decrypt(record)
  }
  return (await getSecretStrategy()).decrypt(record)
}

export async function readSecretFile(filePath: string): Promise<string | null> {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)

    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.v === 'number' &&
      'encrypted' in parsed &&
      typeof parsed.data === 'string'
    ) {
      return await decryptPersisted(parsed as PersistedSecretV1)
    }

    if (parsed && typeof parsed === 'object' && typeof parsed.token === 'string') {
      return parsed.token
    }
    return null
  } catch {
    return null
  }
}

export async function writeSecretFile(filePath: string, plain: string): Promise<void> {
  const record = await encryptString(plain)
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), { mode: 0o600 })
}

export async function isSafeStorageAvailable(): Promise<boolean> {
  return (await getSecretStrategy()).name === 'electron-safe-storage'
}

/** Test seam: forget the cached strategy and the one-time fallback warning. */
export function resetSecretsForTests(): void {
  activeStrategy = null
  warnedUnavailable = false
}

export { PlaintextStrategy }
