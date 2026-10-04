// T0304 / BUG-069: renderer no longer imports `node:https`. The fingerprint
// fetch runs in the main process via `window.electronAPI.wsl.fetchFingerprint`.
// The renderer-only `node:https` import was the root cause of v0.4.1 NSIS crash
// (`require is not defined`); see D090.
// T0381 / BUG-090 (D128): main reads the fingerprint from the TLS handshake
// with a 5s timeout and returns a structured result; failures are rethrown
// here with `code` so WizardErrorMapper resolves them at stage 1.
import type { WizardStep } from '../../wizard-runner'

// T0387 (BUG-093): host is only passed when ctx.verifyEndpoint is set (SSH).
type FetchFingerprintImpl = (port: number, host?: string) => Promise<string>

/** Only "nothing listening yet" is worth retrying (service may still be starting). */
const NON_RETRYABLE_CODES = new Set([
  'fingerprint-invalid-port',
  'fingerprint-invalid-host',
  'fingerprint-timeout',
  'fingerprint-handshake-failed',
])
const MAX_ATTEMPTS = 5
const RETRY_DELAY_MS = 1_000

const defaultImpl: FetchFingerprintImpl = async (port, host) => {
  const result = host === undefined
    ? await window.electronAPI.wsl.fetchFingerprint(port)
    : await window.electronAPI.wsl.fetchFingerprint(port, host)
  if (result.ok) return result.fingerprint
  throw Object.assign(new Error(result.error), { code: result.errorCode })
}

let fetchFingerprintImpl: FetchFingerprintImpl = defaultImpl

export function setFetchFingerprintImplForTests(impl: FetchFingerprintImpl): void {
  fetchFingerprintImpl = impl
}

export function resetFetchFingerprintImplForTests(): void {
  fetchFingerprintImpl = defaultImpl
}

function errorCodeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}

export const fetchFingerprintStep: WizardStep = {
  id: 'fetch-fingerprint',
  title: 'Fetch TLS fingerprint',
  appliesTo: 'all',
  retryable: true,
  labelKey: 'wizard.shared.step.fetchFingerprint.label',
  descriptionKey: 'wizard.shared.step.fetchFingerprint.description',
  groupKey: 'wizard.group.verification',
  editableFromFailure: false,
  async run(ctx) {
    if (ctx.systemdServiceActive === false) {
      ctx.fingerprint = null
      return
    }

    // T0383 (T0382 follow-up): no 9876 fallback — that is the host
    // RemoteServer's default port, so the handshake would pin this BAT's own
    // certificate. Same rule as connect-test / write-profile.
    // T0387 (BUG-093): the SSH flow points this at its tunnel / remote host.
    const endpoint = ctx.verifyEndpoint
    const port = endpoint ? endpoint.port : ctx.serverPort
    if (typeof port !== 'number') {
      throw new Error('Server port was not resolved before fetching the TLS fingerprint; re-run the service step.')
    }
    let lastError: unknown = null
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        ctx.fingerprint = endpoint
          ? await fetchFingerprintImpl(port, endpoint.host)
          : await fetchFingerprintImpl(port)
        return
      } catch (error) {
        lastError = error
        const code = errorCodeOf(error)
        if (code && NON_RETRYABLE_CODES.has(code)) break
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  },
}
