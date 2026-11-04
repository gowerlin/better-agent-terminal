import i18next from 'i18next'
import { throwIfWizardAborted, wizardAbortError, type WizardConsentRequest, type WizardContext, type WizardStep } from '../../wizard-runner'
import { PRECONDITION_MISSING_CODE, wizardError } from '../../error-mapper'
import { runAbortableOperation } from '../../wizard-abort'
import {
  WSL_NETWORK_MIRRORED_ITEM_ID,
  wslMirroredRetryOffer,
  type WslEnvApplyResult,
  type WslMirroredRetryOffer,
} from '../../wsl-env-plan'
import { recordWslAppliedChanges } from './apply-wsl-environment'

/**
 * T0841 (PLAN-043 W4, P-5): "Switch to Mirrored and retry".
 *
 * A WSL connect-test failure under NAT checks (`wsl.detectFacts`, pure
 * `wslMirroredRetryOffer`) whether Mirrored may be offered: no WSL networking
 * policy, no other `networkingMode` the user declared, a `.wslconfig` BAT can
 * parse, Windows / WSL new enough. Offered → the step fails with
 * `wsl-connect-test-failed-nat`, whose error screen has the extra action;
 * not offered → the same `connect-test-failed` as before plus one hint line.
 *
 * The action (SetupWizardShell) only sets `WSL_MIRRORED_RETRY_REQUEST_KEY` and
 * retries this step; the step then re-detects, shows a small consent box (one
 * optional item, unchecked by default, every Running distro listed because
 * `wsl --shutdown` stops them all), and only after consent calls IPC
 * `wsl:apply-network-mirrored` (electron/wsl-env-apply.ts: back up and write
 * `.wslconfig`, `wsl --shutdown`, wait for the keep-alive holder to start the
 * distro, verify with `wslinfo`). The connection test then runs again with a
 * longer wait, because the BAT server restarts with the distro. Declining
 * fails the step again with the same error. Nothing is undone (D272); the
 * `.wslconfig` change is listed with the other WSL environment changes.
 */

/** Set by the Shell's `wsl-mirrored-retry` action; read (and cleared) by the next run. */
export const WSL_MIRRORED_RETRY_REQUEST_KEY = 'wslMirroredRetryRequested'
/** Last NAT failure's error text (declining shows the same error again). */
export const WSL_MIRRORED_RETRY_ERROR_KEY = 'wslMirroredRetryError'

/** Normal connect-test: 3 attempts, 500 ms apart. */
const NORMAL_ATTEMPTS = 3
const NORMAL_RETRY_MS = 500
/** After `wsl --shutdown`: the distro boots and systemd starts the BAT server (~30 s). */
export const MIRRORED_CONNECT_ATTEMPTS = 15
const MIRRORED_RETRY_MS = 2_000

export function requestWslMirroredRetry(state: Record<string, unknown>): void {
  state[WSL_MIRRORED_RETRY_REQUEST_KEY] = true
}

function pushWarning(ctx: WizardContext, warning: string): void {
  if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
}

/** Facts for the offer; null when the preload has no `detectFacts` or the probe failed (old behaviour). */
async function detectMirroredOffer(ctx: WizardContext, distro: string): Promise<WslMirroredRetryOffer | null> {
  const detectFacts = window.electronAPI?.wsl?.detectFacts
  if (typeof detectFacts !== 'function') return null
  try {
    const facts = await runAbortableOperation(ctx.signal, (operationId) =>
      operationId ? detectFacts(distro, { operationId }) : detectFacts(distro))
    throwIfWizardAborted(ctx)
    return wslMirroredRetryOffer(ctx.networkMode, facts)
  } catch (error) {
    throwIfWizardAborted(ctx)
    ctx.logger.warn(`Unable to check whether Mirrored can be offered: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

export function buildMirroredConsentRequest(distro: string, running: string[], declaredMirrored: boolean): WizardConsentRequest {
  return {
    stepId: 'connect-test',
    titleKey: 'wizard.wsl.mirrored.title',
    descriptionKey: 'wizard.wsl.mirrored.description',
    params: { distro },
    items: [{
      id: WSL_NETWORK_MIRRORED_ITEM_ID,
      labelKey: 'wizard.wsl.mirrored.item.label',
      detailKey: declaredMirrored ? 'wizard.wsl.mirrored.item.detailDeclared' : 'wizard.wsl.mirrored.item.detail',
      scope: 'user',
      effects: ['shutdown-all-distros'],
      required: false,
      defaultChecked: false,
    }],
    runningDistros: running,
    confirmKey: 'wizard.wsl.mirrored.confirm',
    declineKey: 'wizard.wsl.mirrored.decline',
  }
}

/** Mirrored retry requested: consent, apply, then a longer connection test. Returns false when declined. */
async function switchToMirrored(ctx: WizardContext, distro: string): Promise<boolean> {
  const previousError = typeof ctx.state[WSL_MIRRORED_RETRY_ERROR_KEY] === 'string'
    ? ctx.state[WSL_MIRRORED_RETRY_ERROR_KEY] as string
    : 'Connection test failed'
  const offer = await detectMirroredOffer(ctx, distro)
  if (!offer) {
    throw wizardError(previousError, 'connect-test-failed')
  }
  if (!offer.offer) {
    // Something changed since the error screen (e.g. a policy appeared): hint only.
    if (offer.hintKey) pushWarning(ctx, i18next.t(offer.hintKey, offer.params ?? {}))
    throw wizardError(previousError, 'connect-test-failed')
  }
  if (typeof ctx.requestConsent !== 'function') {
    throw wizardError(previousError, 'wsl-connect-test-failed-nat')
  }
  const approved = await ctx.requestConsent(buildMirroredConsentRequest(distro, offer.running, offer.declaredMirrored))
  throwIfWizardAborted(ctx)
  if (!approved || !approved.includes(WSL_NETWORK_MIRRORED_ITEM_ID)) {
    ctx.logger.info('Switch to Mirrored declined')
    return false
  }

  const applyNetworkMirrored = window.electronAPI.wsl.applyNetworkMirrored
  if (typeof applyNetworkMirrored !== 'function') {
    throw wizardError('This BAT version cannot switch WSL to Mirrored mode.', 'wsl-wslconfig-write-failed')
  }
  // `wsl --shutdown` cannot be stopped once it started (wsl-env-apply.ts).
  ctx.setUninterruptible?.('wizard.wsl.mirrored.uninterruptible')
  let result: WslEnvApplyResult
  try {
    result = await runAbortableOperation(ctx.signal, (operationId) =>
      operationId ? applyNetworkMirrored(distro, { operationId }) : applyNetworkMirrored(distro))
  } finally {
    ctx.setUninterruptible?.(null)
  }
  recordWslAppliedChanges(ctx, distro, result.changes)
  if (!result.ok) {
    if (result.aborted || ctx.signal?.aborted) throw wizardAbortError()
    const code = result.errorCode === 'wsl-env-apply-invalid' ? 'wsl-wslconfig-write-failed' : result.errorCode
    throw wizardError(`Switching WSL to Mirrored failed: ${result.error}`, code, { distro })
  }
  ctx.logger.info(`Switched WSL to Mirrored (${result.outcome}); retrying the connection test`)
  ctx.networkMode = 'mirrored'
  return true
}

export const connectTestStep: WizardStep = {
  id: 'connect-test',
  title: 'Verify remote connection',
  appliesTo: 'all',
  retryable: true,
  labelKey: 'wizard.shared.step.connectTest.label',
  descriptionKey: 'wizard.shared.step.connectTest.description',
  groupKey: 'wizard.group.verification',
  editableFromFailure: false,
  async run(ctx) {
    const mirroredRequested = ctx.state[WSL_MIRRORED_RETRY_REQUEST_KEY] === true
    delete ctx.state[WSL_MIRRORED_RETRY_REQUEST_KEY]

    if (ctx.systemdServiceActive === false || !ctx.fingerprint) {
      ctx.connectTestSkipped = true
      ctx.serverMetadata = null
      return
    }

    if (!ctx.remoteToken) {
      throw wizardError('Remote server token was not available after starting the BAT service.', PRECONDITION_MISSING_CODE)
    }

    // T0382 (BUG-091): same ctx.serverPort the unit and the profile use. No
    // 9876 fallback — that is the host RemoteServer's default port.
    // T0387 (BUG-093): the SSH flow overrides the target with its tunnel's
    // local end (tunnel-only since T0425 / BUG-098).
    const endpoint = ctx.verifyEndpoint
    const host = endpoint ? endpoint.host : 'localhost'
    const port = endpoint ? endpoint.port : ctx.serverPort
    if (typeof port !== 'number') {
      throw wizardError('Server port was not resolved before the connection test; re-run the service step.', PRECONDITION_MISSING_CODE)
    }

    const wslDistro = ctx.targetOS === 'wsl-linux' ? ctx.wslDistro : undefined
    let attempts = NORMAL_ATTEMPTS
    let retryMs = NORMAL_RETRY_MS
    if (mirroredRequested && wslDistro && ctx.networkMode === 'nat') {
      if (!await switchToMirrored(ctx, wslDistro)) {
        // Declined: the same error screen (and offer) as before.
        const previous = ctx.state[WSL_MIRRORED_RETRY_ERROR_KEY]
        throw wizardError(typeof previous === 'string' ? previous : 'Connection test failed', 'wsl-connect-test-failed-nat')
      }
      attempts = MIRRORED_CONNECT_ATTEMPTS
      retryMs = MIRRORED_RETRY_MS
    }

    let lastError: string | null = null
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      throwIfWizardAborted(ctx)
      const result = await window.electronAPI.remote.testConnection(host, port, ctx.remoteToken, ctx.fingerprint)
      if (result.ok) {
        ctx.connectTestSkipped = false
        ctx.serverMetadata = result.metadata ?? null
        delete ctx.state[WSL_MIRRORED_RETRY_ERROR_KEY]
        return
      }
      lastError = result.error ?? 'Connection test failed'
      await new Promise((resolve) => setTimeout(resolve, retryMs))
    }

    // T0383 (BUG-089): NAT is fine as long as localhostForwarding works; only
    // suggest Mirrored / the distro IP once localhost has actually failed.
    if (ctx.networkMode === 'nat') {
      pushWarning(ctx, i18next.t('wizard.wsl.warning.connectFailedNat'))
      // T0841: offer "Switch to Mirrored and retry" when nothing forbids it; else a hint only.
      if (wslDistro) {
        const offer = await detectMirroredOffer(ctx, wslDistro)
        if (offer?.offer) {
          ctx.state[WSL_MIRRORED_RETRY_ERROR_KEY] = lastError ?? 'Connection test failed'
          throw wizardError(lastError ?? 'Connection test failed', 'wsl-connect-test-failed-nat')
        }
        if (offer?.hintKey) pushWarning(ctx, i18next.t(offer.hintKey, offer.params ?? {}))
      }
    }

    throw wizardError(lastError ?? 'Connection test failed', 'connect-test-failed')
  },
}
