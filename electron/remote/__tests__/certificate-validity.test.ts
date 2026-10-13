// @vitest-environment node
/**
 * T0496: selfsigned v5 has no `days` option (it fell back to 365 days), so the
 * remote server certificate's validity is set with notAfterDate. The persisted
 * `expiresAt` (renewal clock) is ten years; the X.509 notAfter has to match it.
 */
import { X509Certificate } from 'crypto'
import { describe, expect, it } from 'vitest'
import { generateSelfSignedCert } from '../certificate'

const DAY_MS = 24 * 60 * 60 * 1000

describe('generateSelfSignedCert validity', () => {
  it('defaults to ten years', async () => {
    const before = Date.now()
    const { cert } = await generateSelfSignedCert()
    const x509 = new X509Certificate(cert)
    const notBefore = Date.parse(x509.validFrom)
    const notAfter = Date.parse(x509.validTo)
    // validFrom / validTo have one-second resolution.
    expect(notBefore).toBeGreaterThanOrEqual(before - 1000)
    expect(notAfter - notBefore).toBeGreaterThanOrEqual(365 * 10 * DAY_MS - 1000)
    expect(notAfter - notBefore).toBeLessThanOrEqual(365 * 10 * DAY_MS + 1000)
  })

  it('honours an explicit number of days', async () => {
    const { cert } = await generateSelfSignedCert(30)
    const x509 = new X509Certificate(cert)
    const span = Date.parse(x509.validTo) - Date.parse(x509.validFrom)
    expect(Math.round(span / DAY_MS)).toBe(30)
  })
})
