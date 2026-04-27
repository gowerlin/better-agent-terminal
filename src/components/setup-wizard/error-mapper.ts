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
 */
export type WizardRecoveryAction =
  | { kind: 'retry'; label?: string }
  | { kind: 'fixed-and-retry'; label?: string }
  | { kind: 'open-link'; label: string; href: string }
  | { kind: 'edit-config'; label?: string; targetStepId?: string }
  | { kind: 'skip'; label?: string }
  | { kind: 'cancel'; label?: string }
  | { kind: 'custom'; label: string; run: () => Promise<void> | void }

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
  /** i18n key. T0334 wires up real lookup; today resolved via MESSAGE_DICT. */
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
  error: Error
}

interface MessageDictEntry {
  title: string
  body: string
}

/**
 * Sprint-2 zh-TW dictionary. T0334 will replace this with i18n lookup; until
 * then, registry entries reference these keys directly.
 */
const MESSAGE_DICT: Record<string, MessageDictEntry> = {
  'docker.daemon.unavailable': {
    title: '未偵測到 Docker daemon',
    body: '請確認 Docker Desktop 已安裝並啟動。詳細錯誤可展開查看。',
  },
  'wsl.linger.failure': {
    title: '無法自動啟用 systemd lingering',
    body: 'WSL2 distro 限制可能導致此情況。可手動執行 sudo loginctl enable-linger $USER 後重試。',
  },
  'ssh.auth.permission-denied': {
    title: 'SSH 認證失敗',
    body: '請檢查 SSH key 是否正確設定，或確認帳號密碼。',
  },
  // T0335 (BUG-074): empty-host validation message.
  'ssh.configure-host.empty': {
    title: 'SSH 主機名稱為必填',
    body: '請選擇 ~/.ssh/config 中的 alias 或手動輸入主機名稱。',
  },
  fallback: {
    title: '步驟發生錯誤',
    body: '', // body falls back to ctx.error.message
  },
}

function lookupMessage(key: string): MessageDictEntry {
  return MESSAGE_DICT[key] ?? MESSAGE_DICT.fallback
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
  const dict = lookupMessage(match.messageKey)
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
  const dict = MESSAGE_DICT.fallback
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
    messageKey: 'docker.daemon.unavailable',
    detailMode: 'append-raw',
    actions: [
      { kind: 'open-link', label: '下載 Docker Desktop', href: 'https://www.docker.com/products/docker-desktop/' },
      { kind: 'fixed-and-retry', label: '我已啟動 Docker，重試' },
      { kind: 'cancel', label: '取消' },
    ],
  },
  {
    id: 'wsl-linger-failure',
    platforms: ['wsl'],
    stepIds: ['write-systemd-unit'],
    patterns: [
      /Could not enable linger/i,
      /No such device or address/i,
    ],
    messageKey: 'wsl.linger.failure',
    detailMode: 'append-raw',
    actions: [
      { kind: 'fixed-and-retry', label: '我已執行命令，重試' },
      { kind: 'skip', label: '略過此步驟' },
      { kind: 'cancel', label: '取消' },
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
    patterns: [/permission denied/i],
    messageKey: 'ssh.auth.permission-denied',
    detailMode: 'hidden-by-default',
    actions: [
      { kind: 'edit-config', label: '修改 SSH 設定', targetStepId: 'configure-ssh-host' },
      { kind: 'retry', label: '重試' },
      { kind: 'cancel', label: '取消' },
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
    messageKey: 'ssh.configure-host.empty',
    detailMode: 'hidden-by-default',
    actions: [
      { kind: 'edit-config', label: '修改 SSH 設定', targetStepId: 'configure-ssh-host' },
      { kind: 'cancel', label: '取消' },
    ],
  },
]