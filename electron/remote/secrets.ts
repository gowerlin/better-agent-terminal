import { safeStorage } from 'electron'
import * as fs from 'fs'
import { logger } from '../logger'

// Layout of the persisted secret file:
//   { v: 1, encrypted: true,  data: "<base64 of safeStorage ciphertext>" }
//   { v: 1, encrypted: false, data: "<raw plaintext>" }
// On Linux without a keychain (safeStorage unavailable) we fall back to
// plaintext with a visible warning — this preserves fork behaviour before
// T0182 and matches the decision recorded in the PLAN-018 Q1.A answer.

interface PersistedSecretV1 {
  v: 1
  encrypted: boolean
  data: string
}

let warnedUnavailable = false

function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function warnFallbackOnce(): void {
  if (warnedUnavailable) return
  warnedUnavailable = true
  logger.warn(
    '[Secrets] safeStorage encryption is not available (likely Linux without a keychain). ' +
      'Falling back to plaintext storage — tokens and keys will be stored unencrypted on disk.'
  )
}

export function encryptString(plain: string): PersistedSecretV1 {
  if (isEncryptionAvailable()) {
    const buf = safeStorage.encryptString(plain)
    return { v: 1, encrypted: true, data: buf.toString('base64') }
  }
  warnFallbackOnce()
  return { v: 1, encrypted: false, data: plain }
}

export function decryptPersisted(record: PersistedSecretV1): string {
  if (!record || typeof record !== 'object') {
    throw new Error('decryptPersisted: invalid record')
  }
  if (record.encrypted) {
    if (!isEncryptionAvailable()) {
      throw new Error(
        'Stored secret is encrypted but safeStorage is unavailable on this system'
      )
    }
    const buf = Buffer.from(record.data, 'base64')
    return safeStorage.decryptString(buf)
  }
  warnFallbackOnce()
  return record.data
}

export function readSecretFile(filePath: string): string | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)

    // Legacy plaintext shape written by older fork versions:
    //   { token: "..." } or { cert, key, fingerprint }
    // Detect by absence of { v, encrypted, data }.
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.v === 'number' &&
      'encrypted' in parsed &&
      typeof parsed.data === 'string'
    ) {
      return decryptPersisted(parsed as PersistedSecretV1)
    }

    // Accept legacy { token: string } shape for backward compatibility during
    // first-run migration. Caller is expected to rewrite with encryptString.
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
  return isEncryptionAvailable()
}
