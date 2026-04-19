// scripts/_bat-cert.mjs
// Load BAT app's trusted server certificate fingerprint for dispatcher TLS pinning.
// Used by bat-terminal.mjs and bat-notify.mjs (PLAN-022 Step 1+2 / T0217).
//
// Trust source: <userData>/server-cert.json — the file BAT app itself writes
// when generating / loading its self-signed cert (electron/remote/certificate.ts).
// This is the strongest local source of truth; no TOFU fallback is needed
// because dispatcher and BAT app run on the same machine under the same user.
//
// Behaviour: fail-close on read failure or fingerprint mismatch. Returning
// a result object (instead of throwing) keeps the call site free to log
// structured events with consistent reasons.

import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Electron app name matches electron/main.ts → app.setName('BetterAgentTerminal').
// Mirrors _bat-logger.mjs's APP_NAME / resolveUserDataDir for path consistency.
const APP_NAME = 'BetterAgentTerminal'
const CERT_FILENAME = 'server-cert.json'

function resolveUserDataDir() {
  const runtimeId = process.env.BAT_RUNTIME
  const suffix = runtimeId ? `-runtime-${runtimeId}` : ''
  const dirName = `${APP_NAME}${suffix}`

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA
    if (!appData) return null
    return join(appData, dirName)
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', dirName)
  }
  // Linux / other POSIX: Electron uses $XDG_CONFIG_HOME or ~/.config.
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdgConfig, dirName)
}

/**
 * Read BAT app's persisted server certificate fingerprint.
 *
 * Override path with env BAT_SERVER_CERT_PATH (used by smoke test for
 * mismatch scenario without touching the real cert file).
 *
 * Returns:
 *   - { ok: true,  fingerprint, certPath }
 *   - { ok: false, reason: 'server-cert-unreadable', certPath, error }
 *
 * The 'fingerprint' field name matches electron/remote/certificate.ts
 * (CertificateBundle.fingerprint / PersistedCertificate.fingerprint).
 * Format: uppercase hex with ':' separators (e.g. 'AB:CD:...'), produced
 * by computeFingerprint() and directly comparable to TLSSocket
 * .getPeerCertificate().fingerprint256.
 */
export function loadTrustedFingerprint() {
  const overridePath = process.env.BAT_SERVER_CERT_PATH
  let certPath
  if (overridePath) {
    certPath = overridePath
  } else {
    const userData = resolveUserDataDir()
    if (!userData) {
      return {
        ok: false,
        reason: 'server-cert-unreadable',
        certPath: null,
        error: 'cannot resolve userData directory (APPDATA missing on win32?)',
      }
    }
    certPath = join(userData, CERT_FILENAME)
  }

  let raw
  try {
    raw = readFileSync(certPath, 'utf-8')
  } catch (err) {
    return {
      ok: false,
      reason: 'server-cert-unreadable',
      certPath,
      error: err?.message || String(err),
    }
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    return {
      ok: false,
      reason: 'server-cert-unreadable',
      certPath,
      error: `JSON parse failed: ${err?.message || String(err)}`,
    }
  }

  if (!parsed || typeof parsed.fingerprint !== 'string' || !parsed.fingerprint) {
    return {
      ok: false,
      reason: 'server-cert-unreadable',
      certPath,
      error: 'missing or empty `fingerprint` field in server-cert.json',
    }
  }

  return { ok: true, fingerprint: parsed.fingerprint, certPath }
}
