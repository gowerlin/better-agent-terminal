/**
 * T0331 (PLAN-032 Sprint 2): WizardErrorMapper framework.
 *
 * Translates raw wizard step errors into structured, user-facing
 * `WizardMappedError` records via a 4-stage resolver:
 *   1. exact errorCode match
 *   2. step-scoped regex match
 *   3. platform-wide regex match
 *   4. fallback (raw error.message)
 *
 * T0333 (Sprint 2 follow-up): tightened `WizardRecoveryAction` into a
 * discriminated union and extended DEFAULT_WIZARD_ERROR_REGISTRY with concrete
 * recovery actions for the 3 baseline entries.
 *
 * See spec: _ct-workorders/_spec-wizard-error-ux.md § 3 + § 5.
 */

import i18next from 'i18next'
import type { WizardTargetOS } from './wizard-runner'

/**
 * Error-mapping platform axis. wizard-runner uses a finer-grained
 * `WizardTargetOS` (e.g. `wsl-linux`, `ssh-darwin`); the error registry only
 * needs the coarse platform classification.
 */
export type WizardErrorPlatform = 'wsl' | 'ssh' | 'docker' | 'local'

export function targetOSToErrorPlatform(target: WizardTargetOS): WizardErrorPlatform {
  switch (target) {
    case 'wsl-linux':
      return 'wsl'
    case 'docker-linux':
      return 'docker'
    case 'ssh-linux':
    case 'ssh-darwin':
      return 'ssh'
    case 'local':
    default:
      return 'local'
  }
}

/**
 * T0333 (Sprint 2): Recovery action discriminated union (7 kinds).
 *
 * The first 6 kinds (retry / fixed-and-retry / open-link / edit-config /
 * skip / cancel) are dispatched by SetupWizardShell against WizardRunner +
 * Electron shell APIs. `custom` is an extension point for future kinds.
 * T0547 added an 8th, `import-server-bundle` (Shell: importServerBundleForRetry
 * then retry).
 *
 * T0507: a label is either an i18n key (`labelKey`, translated by the Shell
 * so it follows the UI language) or a literal `label`. `labelKey` wins when
 * both are set; with neither, the Shell uses the generic `wizard.action.*`
 * label for the kind.
 */
interface WizardActionLabel {
  label?: string
  labelKey?: string
}

/** open-link / custom have no generic per-kind label, so one of the two is required. */
type WizardRequiredActionLabel =
  | { label: string; labelKey?: string }
  | { label?: string; labelKey: string }

export type WizardRecoveryAction =
  | ({ kind: 'retry' } & WizardActionLabel)
  | ({ kind: 'fixed-and-retry' } & WizardActionLabel)
  | ({ kind: 'open-link'; href: string } & WizardRequiredActionLabel)
  | ({ kind: 'edit-config'; targetStepId?: string } & WizardActionLabel)
  | ({ kind: 'skip' } & WizardActionLabel)
  | ({ kind: 'cancel' } & WizardActionLabel)
  | ({ kind: 'custom'; run: () => Promise<void> | void } & WizardRequiredActionLabel)
  // T0547 (D146): pick a local server bundle tarball, then retry the step.
  | ({ kind: 'import-server-bundle' } & WizardActionLabel)

/**
 * Backwards-compat alias kept so T0331/T0332 callsites compile without
 * touching their imports. New code should prefer `WizardRecoveryAction`.
 */
export type WizardRecoveryActionTemplate = WizardRecoveryAction

export interface WizardErrorMatch {
  /** Unique identifier (e.g. 'docker-daemon-unavailable'). */
  id: string
  /** Platforms this entry applies to, or 'all'. */
  platforms: WizardErrorPlatform[] | 'all'
  /** Optional step-id allowlist for stage-2 (step-scoped) matching. */
  stepIds?: string[]
  /** Exact-match error codes for stage-1. */
  errorCodes?: string[]
  /** Regex patterns matched against error.message for stage-2/3. */
  patterns?: RegExp[]
  /** i18n key prefix; `<messageKey>.title` / `<messageKey>.body` live in src/locales/*.json. */
  messageKey: string
  /** How the UI should expose the raw error string. */
  detailMode?: 'append-raw' | 'hidden-by-default'
  /** Recovery actions surfaced by the Shell (T0333). */
  actions?: WizardRecoveryAction[]
}

export interface WizardMappedError {
  /** Matched registry entry id, or null if fell through to fallback. */
  matchId: string | null
  title: string
  body: string
  rawError: string
  detailMode: 'append-raw' | 'hidden-by-default'
  actions: WizardRecoveryAction[]
}

export interface WizardErrorContext {
  platform: WizardErrorPlatform
  stepId: string
  /** Optional structured error code (e.g. SSH permission-denied). */
  errorCode?: string
  /** T0660 (BUG-161): i18n values for the mapped title / body (see wizardError). */
  params?: WizardErrorParams
  error: Error
}

/**
 * T0660 (BUG-161): interpolation values a step error carries for its mapped
 * title / body (e.g. a container name). `context` selects an i18next context
 * variant (`body_darwin`), falling back to the plain key.
 */
export type WizardErrorParams = Record<string, string | number>

export type WizardCodedError = Error & { code: string; params?: WizardErrorParams }

/**
 * T0660 (BUG-161): build a step error the registry maps by `code` (stage 1).
 * The message stays English: it is what the logs and the raw error detail
 * show; the UI shows the entry's translated title / body instead.
 */
export function wizardError(message: string, code: string, params?: WizardErrorParams): WizardCodedError {
  const error = new Error(message) as WizardCodedError
  error.code = code
  if (params) error.params = params
  return error
}

/**
 * T0660 (BUG-161): a step ran without what an earlier step should have left
 * on ctx (e.g. no distro picked, no server port). One shared entry.
 */
export const PRECONDITION_MISSING_CODE = 'wizard-precondition-missing'

/** T0660: the `params` a wizardError carries, if any. */
export function readWizardErrorParams(error: unknown): WizardErrorParams | undefined {
  const params = (error as { params?: unknown } | null)?.params
  return params && typeof params === 'object' ? params as WizardErrorParams : undefined
}

interface ResolvedMessage {
  title: string
  /** Empty when the key has no body; callers then show the raw error. */
  body: string
}

/** T0507: title of unmatched errors (no body: the raw error message is shown). */
export const FALLBACK_MESSAGE_KEY = 'wizard.shared.error.stepFailed'

/**
 * Last resort when i18next is not initialized (e.g. a test that never imports
 * src/i18n) or the fallback key itself is missing.
 */
const UNINITIALIZED_FALLBACK_TITLE = 'Step failed'

/**
 * T0378 (BUG-086) / T0507: every messageKey is an i18n key (`<key>.title` /
 * `<key>.body` in src/locales/*.json) resolved through i18next, so mapped
 * errors follow the UI language. The zh-TW-only MESSAGE_DICT was removed in
 * T0507; its copy now lives verbatim in zh-TW.json. Unknown keys resolve to
 * the fallback title.
 */
function lookupMessage(key: string, params?: WizardErrorParams): ResolvedMessage {
  if (i18next.isInitialized) {
    for (const candidate of [key, FALLBACK_MESSAGE_KEY]) {
      if (!i18next.exists(`${candidate}.title`)) continue
      return {
        title: i18next.t(`${candidate}.title`, params),
        body: i18next.exists(`${candidate}.body`) ? i18next.t(`${candidate}.body`, params) : '',
      }
    }
  }
  return { title: UNINITIALIZED_FALLBACK_TITLE, body: '' }
}

function platformMatches(
  entryPlatforms: WizardErrorMatch['platforms'],
  ctxPlatform: WizardErrorPlatform,
): boolean {
  if (entryPlatforms === 'all') return true
  return entryPlatforms.includes(ctxPlatform)
}

function patternMatches(patterns: RegExp[] | undefined, message: string): boolean {
  if (!patterns || patterns.length === 0) return false
  return patterns.some((re) => re.test(message))
}

function buildMapped(
  match: WizardErrorMatch,
  ctx: WizardErrorContext,
): WizardMappedError {
  const dict = lookupMessage(match.messageKey, ctx.params)
  const rawError = ctx.error.message
  return {
    matchId: match.id,
    title: dict.title,
    body: dict.body || rawError,
    rawError,
    detailMode: match.detailMode ?? 'append-raw',
    actions: match.actions ?? [],
  }
}

/**
 * T0333: fallback now ships a baseline `[retry, skip, cancel]` action set so
 * the Shell always has something to render even when no registry entry hits.
 * Tests that rely on the old empty-actions behavior were updated alongside
 * this change.
 */
function buildFallback(ctx: WizardErrorContext): WizardMappedError {
  const dict = lookupMessage(FALLBACK_MESSAGE_KEY)
  const rawError = ctx.error.message
  return {
    matchId: null,
    title: dict.title,
    body: rawError,
    rawError,
    detailMode: 'append-raw',
    actions: [
      { kind: 'retry' },
      { kind: 'skip' },
      { kind: 'cancel' },
    ],
  }
}

/**
 * Resolve a wizard step error against the registry using the spec's 4-stage
 * order. Returns the first match per stage (no cross-stage tie-breaking).
 */
export function resolveWizardError(
  ctx: WizardErrorContext,
  registry: WizardErrorMatch[],
): WizardMappedError {
  const message = ctx.error.message

  // Stage 1 -- exact errorCode match.
  if (ctx.errorCode) {
    const stage1 = registry.find(
      (entry) =>
        platformMatches(entry.platforms, ctx.platform) &&
        entry.errorCodes !== undefined &&
        entry.errorCodes.includes(ctx.errorCode!),
    )
    if (stage1) return buildMapped(stage1, ctx)
  }

  // Stage 2 -- step-scoped regex match (entry has stepIds AND covers ctx.stepId).
  const stage2 = registry.find(
    (entry) =>
      platformMatches(entry.platforms, ctx.platform) &&
      entry.stepIds !== undefined &&
      entry.stepIds.includes(ctx.stepId) &&
      patternMatches(entry.patterns, message),
  )
  if (stage2) return buildMapped(stage2, ctx)

  // Stage 3 -- platform-wide regex match (entries without stepIds restriction).
  const stage3 = registry.find(
    (entry) =>
      platformMatches(entry.platforms, ctx.platform) &&
      (entry.stepIds === undefined || entry.stepIds.length === 0) &&
      patternMatches(entry.patterns, message),
  )
  if (stage3) return buildMapped(stage3, ctx)

  // Stage 4 -- fallback.
  return buildFallback(ctx)
}

/**
 * Sprint-2 minimum viable registry. T0333 attached recovery actions to the 3
 * baseline entries; Sprint-3 BUG-072 / BUG-073 fixes will extend the list.
 * The resolver itself remains registry-agnostic.
 */
export const DEFAULT_WIZARD_ERROR_REGISTRY: WizardErrorMatch[] = [
  {
    id: 'docker-daemon-unavailable',
    platforms: ['docker'],
    stepIds: ['detect-env'],
    // T0336 (BUG-073): structured errorCode lets preflight + step.run() throw
    // hit Stage 1 directly; regex patterns kept as Stage 2/3 fallback.
    errorCodes: ['docker-daemon-down'],
    patterns: [
      /pipe.*docker_engine/i,
      /cannot connect to.*docker daemon/i,
      /error during connect/i,
    ],
    messageKey: 'wizard.docker.error.daemonUnavailable',
    detailMode: 'append-raw',
    actions: [
      { kind: 'open-link', labelKey: 'wizard.action.downloadDockerDesktop', href: 'https://www.docker.com/products/docker-desktop/' },
      { kind: 'fixed-and-retry', labelKey: 'wizard.action.dockerStartedRetry' },
      { kind: 'cancel' },
    ],
  },
  {
    id: 'wsl-linger-failure',
    platforms: ['wsl'],
    stepIds: ['write-systemd-unit'],
    // T0337 (BUG-072): structured errorCode lets write-systemd-unit throw hit
    // Stage 1 directly; regex patterns kept as Stage 2/3 fallback.
    errorCodes: ['wsl-linger-failed'],
    patterns: [
      /Could not enable linger/i,
      /No such device or address/i,
    ],
    messageKey: 'wizard.wsl.error.lingerFailure',
    detailMode: 'append-raw',
    actions: [
      { kind: 'fixed-and-retry', labelKey: 'wizard.action.commandRunRetry' },
      { kind: 'skip', labelKey: 'wizard.action.skipStep' },
      { kind: 'cancel' },
    ],
  },
  {
    id: 'ssh-permission-denied',
    platforms: ['ssh'],
    stepIds: ['verify-ssh-auth'],
    errorCodes: ['permission-denied'],
    // T0333: regex fallback so the entry still matches when callers
    // construct WizardErrorContext without an explicit errorCode (Shell
    // currently only forwards error.message from the snapshot).
    // T0511: the step's own message reads `permission-denied: ...` (hyphen).
    patterns: [/permission[- ]denied/i],
    messageKey: 'wizard.ssh.error.permissionDenied',
    detailMode: 'hidden-by-default',
    actions: [
      { kind: 'edit-config', labelKey: 'wizard.action.editSshSettings', targetStepId: 'configure-ssh-host' },
      { kind: 'retry' },
      { kind: 'cancel' },
    ],
  },
  // T0335 (BUG-074, PLAN-032 Sprint 3): empty-host throw fires only after
  // the user actively submits an empty value. edit-config sends them back to
  // the same step; cancel exits cleanly.
  {
    id: 'ssh-configure-host-empty',
    platforms: ['ssh'],
    stepIds: ['configure-ssh-host'],
    errorCodes: ['configure-host-empty'],
    patterns: [/SSH host is required/i],
    messageKey: 'wizard.ssh.error.hostEmpty',
    detailMode: 'hidden-by-default',
    actions: [
      { kind: 'edit-config', labelKey: 'wizard.action.editSshSettings', targetStepId: 'configure-ssh-host' },
      { kind: 'cancel' },
    ],
  },
  // T0506: a typed host (T0502) or an ~/.ssh/config alias (T0505) failed the
  // ssh-name whitelist. Same shape as ssh-configure-host-empty; action labels
  // come from wizard.action.* so they follow the UI language.
  {
    id: 'ssh-configure-host-invalid',
    platforms: ['ssh'],
    stepIds: ['configure-ssh-host'],
    errorCodes: ['configure-host-invalid'],
    patterns: [/SSH host .* is invalid/i, /SSH alias .* cannot be used/i],
    messageKey: 'wizard.ssh.error.hostInvalid',
    detailMode: 'hidden-by-default',
    actions: [
      { kind: 'edit-config', targetStepId: 'configure-ssh-host' },
      { kind: 'cancel' },
    ],
  },
  // T0517 (BUG-124): the target sshd refuses port forwarding
  // (`AllowTcpForwarding no`), so verification through the wizard's tunnel
  // fails with a TLS reset. The SSH verify steps detect it from ssh's stderr
  // and rethrow with this code; the original error stays in the raw detail.
  {
    id: 'ssh-forwarding-denied',
    platforms: ['ssh'],
    stepIds: ['fetch-fingerprint', 'connect-test'],
    errorCodes: ['ssh-forwarding-denied'],
    messageKey: 'wizard.ssh.error.forwardingDenied',
    detailMode: 'append-raw',
    actions: [
      { kind: 'fixed-and-retry' },
      { kind: 'cancel' },
    ],
  },
  // T0382 (BUG-091, D128): the WSL server port collides with a port Windows
  // already uses (Mirrored mode shares localhost). Raised by the Windows-side
  // port pick (user-specified port taken / no free port) and by startService
  // when the journal of this start shows EADDRINUSE. Retry picks a new port.
  {
    id: 'wsl-port-in-use',
    platforms: ['wsl'],
    stepIds: ['write-systemd-unit'],
    errorCodes: ['wsl-port-in-use'],
    patterns: [/EADDRINUSE/],
    messageKey: 'wizard.wsl.error.portInUse',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  // T0337 (BUG-072, PLAN-032 Sprint 3): WSL systemd service start timeout.
  // Distinct from wsl-service-start-failed (generic) so the journalctl hint
  // only surfaces when timeout is the likely root cause.
  // T0652 (BUG-156 / BUG-158): the Docker server port could not be used —
  // no free port to pick, `docker run` could not publish the picked one, or
  // an existing container publishes the port this BAT's own server listens on.
  // Retry picks a new port for a container the wizard creates.
  {
    id: 'docker-port-in-use',
    platforms: ['docker'],
    stepIds: ['start-server'],
    errorCodes: ['docker-port-in-use'],
    messageKey: 'wizard.docker.error.portInUse',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  // T0652: an existing container that does not publish 9876/tcp on the host.
  {
    id: 'docker-port-unpublished',
    platforms: ['docker'],
    stepIds: ['start-server'],
    errorCodes: ['docker-port-unpublished'],
    messageKey: 'wizard.docker.error.portUnpublished',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'wsl-service-start-timeout',
    platforms: ['wsl'],
    stepIds: ['write-systemd-unit'],
    errorCodes: ['wsl-service-start-timeout'],
    patterns: [
      /Timed out waiting for.*service to become active/i,
      /service.*start.*timeout/i,
    ],
    messageKey: 'wizard.wsl.error.serviceStartTimeout',
    detailMode: 'append-raw',
    actions: [
      { kind: 'fixed-and-retry', labelKey: 'wizard.action.journalCheckedRetry' },
      { kind: 'skip', labelKey: 'wizard.action.skipStepManualStart' },
      { kind: 'cancel' },
    ],
  },
  // T0337 (BUG-072): WSL not installed on Windows host. open-link to MSFT
  // install guide; fixed-and-retry once user has run wsl --install.
  {
    id: 'wsl-not-installed',
    platforms: ['wsl'],
    stepIds: ['detect-env'],
    errorCodes: ['wsl-not-installed', 'wsl-not-on-windows'],
    messageKey: 'wizard.wsl.error.notInstalled',
    detailMode: 'append-raw',
    actions: [
      { kind: 'open-link', labelKey: 'wizard.action.wslInstallGuide', href: 'https://learn.microsoft.com/en-us/windows/wsl/install' },
      { kind: 'fixed-and-retry', labelKey: 'wizard.action.wslInstalledRetry' },
      { kind: 'cancel' },
    ],
  },
  // T0378 (BUG-086): WSL is installed but no distro is registered yet
  // (`wsl -l -v` exits non-zero while `wsl --status` exits 0). Guide the user
  // to install a distro instead of reinstalling WSL. i18n-backed message.
  {
    id: 'wsl-no-distro',
    platforms: ['wsl'],
    stepIds: ['pick-wsl-distro'],
    errorCodes: ['wsl-no-distro'],
    patterns: [/No WSL distros found/i],
    messageKey: 'wizard.wsl.error.noDistro',
    detailMode: 'hidden-by-default',
    actions: [
      { kind: 'fixed-and-retry' },
      { kind: 'cancel' },
    ],
  },
  // D146 / T0547: installers no longer ship the server bundle baseline, so the
  // install step downloads it; when that fails (offline / intranet / rate limit)
  // the user can import a local tarball (+ .sha256), then the retry hits the cache.
  {
    id: 'server-bundle-unavailable',
    platforms: ['wsl', 'ssh'],
    stepIds: ['install-server-bundle'],
    errorCodes: ['server-bundle-unavailable'],
    messageKey: 'wizard.shared.error.serverBundleUnavailable',
    detailMode: 'append-raw',
    actions: [
      { kind: 'import-server-bundle' },
      { kind: 'retry' },
      { kind: 'cancel' },
    ],
  },
  // T0381 (BUG-090): fetch-fingerprint now reads the certificate from the TLS
  // handshake with a 5s timeout; main returns these codes and the step
  // rethrows them with `code`. Shared by the WSL / SSH / Docker flows.
  {
    id: 'fingerprint-timeout',
    platforms: 'all',
    stepIds: ['fetch-fingerprint'],
    errorCodes: ['fingerprint-timeout'],
    messageKey: 'wizard.shared.error.fingerprintTimeout',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'fingerprint-unreachable',
    platforms: 'all',
    stepIds: ['fetch-fingerprint'],
    errorCodes: ['fingerprint-unreachable'],
    messageKey: 'wizard.shared.error.fingerprintUnreachable',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'fingerprint-handshake-failed',
    platforms: 'all',
    stepIds: ['fetch-fingerprint'],
    errorCodes: ['fingerprint-handshake-failed'],
    messageKey: 'wizard.shared.error.fingerprintHandshakeFailed',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'fingerprint-invalid-port',
    platforms: 'all',
    stepIds: ['fetch-fingerprint'],
    errorCodes: ['fingerprint-invalid-port'],
    messageKey: 'wizard.shared.error.fingerprintInvalidPort',
    detailMode: 'append-raw',
    actions: [{ kind: 'cancel' }],
  },
  // T0660 (BUG-161): step errors that used to reach the UI as their raw English
  // message. Each step throws with one of these codes (wizardError); the
  // message stays English for the logs and the raw detail.
  {
    id: 'step-precondition-missing',
    platforms: 'all',
    errorCodes: [PRECONDITION_MISSING_CODE],
    messageKey: 'wizard.shared.error.preconditionMissing',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'profile-save-failed',
    platforms: 'all',
    stepIds: ['write-profile'],
    errorCodes: ['wizard-profile-save-failed'],
    messageKey: 'wizard.shared.error.profileSaveFailed',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'cancel' }],
  },
  {
    id: 'connect-test-failed',
    platforms: 'all',
    stepIds: ['connect-test'],
    errorCodes: ['connect-test-failed'],
    messageKey: 'wizard.shared.error.connectTestFailed',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'skip' }, { kind: 'cancel' }],
  },
  {
    id: 'server-bundle-install-failed',
    platforms: ['wsl', 'ssh'],
    stepIds: ['install-server-bundle'],
    errorCodes: ['server-bundle-install-failed'],
    messageKey: 'wizard.shared.error.serverBundleInstallFailed',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'server-bundle-distribute-failed',
    platforms: ['wsl', 'ssh'],
    stepIds: ['install-server-bundle'],
    errorCodes: ['server-bundle-distribute-failed'],
    messageKey: 'wizard.shared.error.serverBundleDistributeFailed',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'docker-no-containers',
    platforms: ['docker'],
    stepIds: ['pick-container'],
    errorCodes: ['docker-no-containers'],
    messageKey: 'wizard.docker.error.noContainers',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'docker-container-names-exhausted',
    platforms: ['docker'],
    stepIds: ['pick-container'],
    errorCodes: ['docker-container-names-exhausted'],
    messageKey: 'wizard.docker.error.containerNamesExhausted',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'docker-mounts-none',
    platforms: ['docker'],
    stepIds: ['configure-mounts'],
    errorCodes: ['docker-mounts-none'],
    messageKey: 'wizard.docker.error.mountsNone',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'docker-mounts-invalid',
    platforms: ['docker'],
    stepIds: ['configure-mounts'],
    errorCodes: ['docker-mounts-invalid'],
    messageKey: 'wizard.docker.error.mountsInvalid',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'docker-inspect-failed',
    platforms: ['docker'],
    stepIds: ['install-server-bundle'],
    errorCodes: ['docker-inspect-failed'],
    messageKey: 'wizard.docker.error.inspectFailed',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'docker-container-not-owned',
    platforms: ['docker'],
    stepIds: ['start-server'],
    errorCodes: ['docker-container-not-owned'],
    messageKey: 'wizard.docker.error.containerNotOwned',
    detailMode: 'hidden-by-default',
    actions: [
      { kind: 'edit-config', targetStepId: 'pick-container' },
      { kind: 'cancel' },
    ],
  },
  {
    id: 'docker-start-failed',
    platforms: ['docker'],
    stepIds: ['start-server'],
    errorCodes: ['docker-start-failed'],
    messageKey: 'wizard.docker.error.startFailed',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'docker-health-unavailable',
    platforms: ['docker'],
    stepIds: ['start-server'],
    errorCodes: ['docker-health-unavailable'],
    messageKey: 'wizard.docker.error.healthUnavailable',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'docker-container-unhealthy',
    platforms: ['docker'],
    stepIds: ['start-server'],
    errorCodes: ['docker-container-unhealthy'],
    messageKey: 'wizard.docker.error.containerUnhealthy',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'docker-health-timeout',
    platforms: ['docker'],
    stepIds: ['start-server'],
    errorCodes: ['docker-health-timeout'],
    messageKey: 'wizard.docker.error.healthTimeout',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'wsl-requires-wsl2',
    platforms: ['wsl'],
    stepIds: ['pick-wsl-distro'],
    errorCodes: ['wsl-requires-wsl2'],
    messageKey: 'wizard.wsl.error.requiresWsl2',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'fixed-and-retry' }, { kind: 'cancel' }],
  },
  {
    id: 'wsl-home-unresolved',
    platforms: ['wsl'],
    stepIds: ['install-server-bundle', 'write-systemd-unit'],
    errorCodes: ['wsl-home-unresolved'],
    messageKey: 'wizard.wsl.error.homeUnresolved',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'wsl-unit-snapshot-failed',
    platforms: ['wsl'],
    stepIds: ['write-systemd-unit'],
    errorCodes: ['wsl-unit-snapshot-failed'],
    messageKey: 'wizard.wsl.error.unitSnapshotFailed',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'wsl-unit-write-failed',
    platforms: ['wsl'],
    stepIds: ['write-systemd-unit'],
    errorCodes: ['wsl-unit-write-failed'],
    messageKey: 'wizard.wsl.error.unitWriteFailed',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  // T0660: write-systemd-unit has thrown this code since T0337 without an entry.
  {
    id: 'wsl-service-start-failed',
    platforms: ['wsl'],
    stepIds: ['write-systemd-unit'],
    errorCodes: ['wsl-service-start-failed'],
    messageKey: 'wizard.wsl.error.serviceStartFailed',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  // T0660: verify-ssh-auth has carried these probe codes since T0511.
  // `no-ssh` passes `context: process.platform` (body_win32 / body_darwin).
  {
    id: 'ssh-client-missing',
    platforms: ['ssh'],
    stepIds: ['verify-ssh-auth'],
    errorCodes: ['no-ssh'],
    messageKey: 'wizard.ssh.error.clientMissing',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'fixed-and-retry' }, { kind: 'cancel' }],
  },
  {
    id: 'ssh-host-key',
    platforms: ['ssh'],
    stepIds: ['verify-ssh-auth'],
    errorCodes: ['host-key'],
    messageKey: 'wizard.ssh.error.hostKey',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'fixed-and-retry' }, { kind: 'cancel' }],
  },
  {
    id: 'ssh-connect-timeout',
    platforms: ['ssh'],
    stepIds: ['verify-ssh-auth'],
    errorCodes: ['connect-timeout'],
    messageKey: 'wizard.ssh.error.connectTimeout',
    detailMode: 'hidden-by-default',
    actions: [
      { kind: 'edit-config', labelKey: 'wizard.action.editSshSettings', targetStepId: 'configure-ssh-host' },
      { kind: 'retry' },
      { kind: 'cancel' },
    ],
  },
  {
    id: 'ssh-remote-path-invalid',
    platforms: ['ssh'],
    stepIds: ['install-server-bundle', 'start-server'],
    errorCodes: ['ssh-remote-path-invalid'],
    messageKey: 'wizard.ssh.error.remotePathInvalid',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  // T0660: ssh-start-server's codes. start-server passes `context: 'darwin'`
  // for macOS, whose copy (body_darwin) names launchd instead of systemd.
  {
    id: 'ssh-start-unit-write-failed',
    platforms: ['ssh'],
    stepIds: ['start-server'],
    errorCodes: ['unit-write-failed'],
    messageKey: 'wizard.ssh.error.unitWriteFailed',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'ssh-start-enable-failed',
    platforms: ['ssh'],
    stepIds: ['start-server'],
    errorCodes: ['enable-failed'],
    messageKey: 'wizard.ssh.error.enableFailed',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'fixed-and-retry' }, { kind: 'cancel' }],
  },
  {
    id: 'ssh-start-crashed',
    platforms: ['ssh'],
    stepIds: ['start-server'],
    errorCodes: ['start-failed'],
    messageKey: 'wizard.ssh.error.startCrashed',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'ssh-start-verify-failed',
    platforms: ['ssh'],
    stepIds: ['start-server'],
    errorCodes: ['verify-failed'],
    messageKey: 'wizard.ssh.error.verifyFailed',
    detailMode: 'hidden-by-default',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'ssh-tunnel-failed',
    platforms: ['ssh'],
    stepIds: ['fetch-fingerprint', 'connect-test'],
    errorCodes: ['ssh-tunnel-failed', 'ssh-tunnel-invalid-input'],
    messageKey: 'wizard.ssh.error.tunnelFailed',
    detailMode: 'append-raw',
    actions: [{ kind: 'retry' }, { kind: 'cancel' }],
  },
  {
    id: 'ssh-fingerprint-mismatch',
    platforms: ['ssh'],
    stepIds: ['fetch-fingerprint'],
    errorCodes: ['fingerprint-mismatch'],
    messageKey: 'wizard.ssh.error.fingerprintMismatch',
    detailMode: 'hidden-by-default',
    actions: [
      { kind: 'edit-config', labelKey: 'wizard.action.editSshSettings', targetStepId: 'configure-ssh-host' },
      { kind: 'retry' },
      { kind: 'cancel' },
    ],
  },
]