import * as fs from 'fs'
import { logger } from '../logger'

// Layout of the persisted secret file:
//   { v: 1, encrypted: true,  data: "<base64 of safeStorage ciphertext>" }
//   { v: 1, encrypted: false, data: "<raw plaintext>" }

interface PersistedSecretV1 {
  v: 1
  encrypted: boolean
  data: string
}

export interface SecretStrategy {
  name: string
  isAvailable(): boolean
  encrypt(plain: string): PersistedSecretV1
  decrypt(record: PersistedSecretV1): string
}

interface ElectronSafeStorageLike {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(value: Buffer): string
}

class PlaintextStrategy implements SecretStrategy {
  readonly name = 'plaintext'

  constructor(private readonly warnOnUse: boolean = true) {}

  isAvailable(): boolean {
    return true
  }

  encrypt(plain: string): PersistedSecretV1 {
    if (this.warnOnUse) warnFallbackOnce()
    return { v: 1, encrypted: false, data: plain }
  }

  decrypt(record: PersistedSecretV1): string {
    if (this.warnOnUse) warnFallbackOnce()
    return record.data
  }
}

class ElectronSafeStorageStrategy implements SecretStrategy {
  readonly name = 'electron-safe-storage'

  constructor(private readonly safeStorage: ElectronSafeStorageLike) {}

  isAvailable(): boolean {
    try {
      return this.safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  encrypt(plain: string): PersistedSecretV1 {
    if (!this.isAvailable()) {
      throw new Error('safeStorage encryption is unavailable')
    }
    const buf = this.safeStorage.encryptString(plain)
    return { v: 1, encrypted: true, data: buf.toString('base64') }
  }

  decrypt(record: PersistedSecretV1): string {
    if (!this.isAvailable()) {
      throw new Error(
        'Stored secret is encrypted but safeStorage is unavailable on this system'
      )
    }
    return this.safeStorage.decryptString(Buffer.from(record.data, 'base64'))
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

function tryLoadElectronSafeStorage(): ElectronSafeStorageLike | null {
  try {
    const electron = require('electron') as { safeStorage?: ElectronSafeStorageLike }
    return electron.safeStorage ?? null
  } catch {
    return null
  }
}

export function detectSecretStrategy(): SecretStrategy {
  const safeStorage = tryLoadElectronSafeStorage()
  if (safeStorage) {
    const strategy = new ElectronSafeStorageStrategy(safeStorage)
    if (strategy.isAvailable()) return strategy
  }
  return new PlaintextStrategy(true)
}

export function setSecretStrategy(strategy: SecretStrategy): void {
  activeStrategy = strategy
}

export function getSecretStrategy(): SecretStrategy {
  if (!activeStrategy) {
    activeStrategy = detectSecretStrategy()
  }
  return activeStrategy
}

export function encryptString(plain: string): PersistedSecretV1 {
  const strategy = getSecretStrategy()
  if (strategy.isAvailable()) {
    return strategy.encrypt(plain)
  }
  const fallback = new PlaintextStrategy(true)
  setSecretStrategy(fallback)
  return fallback.encrypt(plain)
}

export function decryptPersisted(record: PersistedSecretV1): string {
  if (!record || typeof record !== 'object') {
    throw new Error('decryptPersisted: invalid record')
  }
  if (!record.encrypted) {
    return new PlaintextStrategy(true).decrypt(record)
  }
  return getSecretStrategy().decrypt(record)
}

export function readSecretFile(filePath: string): string | null {
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
      return decryptPersisted(parsed as PersistedSecretV1)
    }

    if (parsed && typeof parsed === 'object' && typeof parsed.token === 'string') {
      return parsed.token
    }
    return null
  } catch {
    return null
  }
}

export function writeSecretFile(filePath: string, plain: string): void {
  const record = encryptString(plain)
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), { mode: 0o600 })
}

export function isSafeStorageAvailable(): boolean {
  return getSecretStrategy().name === 'electron-safe-storage'
}

export { PlaintextStrategy }
