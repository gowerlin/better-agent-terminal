import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import selfsigned from 'selfsigned'
import { logger } from '../logger'

export interface CertificateBundle {
  cert: string
  key: string
  fingerprint: string
}

interface PersistedCertificate {
  cert: string
  key: string
  fingerprint: string
  expiresAt: number // ms epoch
}

const CERT_FILENAME = 'server-cert.json'
const TEN_YEARS_DAYS = 365 * 10
// Renew when less than 90 days remain
const RENEW_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000

function computeFingerprint(certPem: string): string {
  // Extract DER bytes from the PEM envelope to match the standard
  // `openssl x509 -fingerprint -sha256` / `getPeerCertificate().fingerprint256`
  // format, then render as upper-case hex groups separated by ':'.
  const derMatch = certPem.match(
    /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/
  )
  const base64 = (derMatch ? derMatch[1] : certPem).replace(/\s+/g, '')
  const der = Buffer.from(base64, 'base64')
  const hex = createHash('sha256').update(der).digest('hex').toUpperCase()
  return hex.match(/.{2}/g)!.join(':')
}

export async function generateSelfSignedCert(
  days: number = TEN_YEARS_DAYS
): Promise<CertificateBundle> {
  const attrs = [{ name: 'commonName', value: 'better-agent-terminal' }]
  const options = {
    keySize: 2048,
    days,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: false },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '::1' }
        ]
      }
    ]
  }
  // selfsigned v5 is async; awaiting is required (otherwise .cert/.private are undefined).
  const pems = await selfsigned.generate(attrs, options)
  if (!pems?.cert || !pems?.private) {
    throw new Error('selfsigned.generate returned empty bundle')
  }
  return {
    cert: pems.cert,
    key: pems.private,
    fingerprint: computeFingerprint(pems.cert)
  }
}

export async function loadOrCreateServerCertificate(
  configDir: string
): Promise<CertificateBundle> {
  const certPath = path.join(configDir, CERT_FILENAME)
  try {
    const raw = fs.readFileSync(certPath, 'utf-8')
    const persisted = JSON.parse(raw) as PersistedCertificate
    if (
      persisted?.cert &&
      persisted?.key &&
      persisted?.fingerprint &&
      typeof persisted.expiresAt === 'number' &&
      persisted.expiresAt - Date.now() > RENEW_THRESHOLD_MS
    ) {
      return {
        cert: persisted.cert,
        key: persisted.key,
        fingerprint: persisted.fingerprint
      }
    }
    if (persisted?.cert) {
      logger.log('[Certificate] Existing cert near expiry — regenerating')
    }
  } catch {
    // no cert or invalid — generate fresh
  }

  const bundle = await generateSelfSignedCert()
  const persist: PersistedCertificate = {
    ...bundle,
    expiresAt: Date.now() + TEN_YEARS_DAYS * 24 * 60 * 60 * 1000
  }
  try {
    fs.writeFileSync(certPath, JSON.stringify(persist, null, 2), {
      mode: 0o600
    })
  } catch (e) {
    logger.warn('[Certificate] Failed to persist cert:', e)
  }
  return bundle
}

export { computeFingerprint }
