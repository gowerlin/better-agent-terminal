// T0304 / BUG-069: renderer no longer imports `node:https`. The HTTPS fetch
// runs in the main process via `window.electronAPI.wsl.fetchFingerprint`. The
// renderer-only `node:https` import was the root cause of v0.4.1 NSIS crash
// (`require is not defined`); see D090.
import type { WizardStep } from '../../wizard-runner'

type FetchFingerprintImpl = (port: number) => Promise<string>

const defaultImpl: FetchFingerprintImpl = (port) => window.electronAPI.wsl.fetchFingerprint(port)

let fetchFingerprintImpl: FetchFingerprintImpl = defaultImpl

export function setFetchFingerprintImplForTests(impl: FetchFingerprintImpl): void {
  fetchFingerprintImpl = impl
}

export function resetFetchFingerprintImplForTests(): void {
  fetchFingerprintImpl = defaultImpl
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

    const port = ctx.serverPort ?? 9876
    let lastError: unknown = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        ctx.fingerprint = await fetchFingerprintImpl(port)
        return
      } catch (error) {
        lastError = error
        await new Promise((resolve) => setTimeout(resolve, 1_000))
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  },
}
