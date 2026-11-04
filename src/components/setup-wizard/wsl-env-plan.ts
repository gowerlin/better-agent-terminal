/**
 * T0839 (PLAN-043 W2): WSL environment facts → plan of fixes for the
 * "detect → list → consent once" step (T0831 〈調查結論〉2, D127 / D272).
 *
 * Pure module: no imports, no IPC, no clock. `electron/wsl-facts.ts`
 * (`detectWslFacts`) collects `WslFacts`; `buildWslEnvPlan` turns them into
 * consent items and notices. This ticket only computes the plan — nothing is
 * applied and nothing is wired into the wizard yet (W3 adds the checklist UI,
 * the apply step and the i18n strings for the keys used below).
 *
 * Rules (T0831 P-1–P-7, D272):
 *  - Environment already fine → 0 items and 0 notices (the wizard must look
 *    exactly as before, T0831 「不回歸」).
 *  - P-5 (networking mode) is never in this first plan: it is only offered when
 *    connect-test fails (W4). P-6 (`instanceIdleTimeout`) is not done at all.
 *  - P-7 (WSL too old) is a notice only until Phase 3 (W5) can run `wsl --update`.
 *  - P-3 (default user is root) is a notice only; creating a user is Phase 3 (W7).
 *  - P-4 (linger) is applied automatically by the existing write-systemd-unit
 *    step; it is listed as a fixed item only when the list is shown anyway.
 *  - WSL disabled by policy (`AllowWSL=0`) → a blocking notice, no items.
 */

/** Mirrors `WslNetworkMode` in electron/wsl-detect.ts. */
export type WslNetworkModeFact = 'mirrored' | 'nat' | 'virtioproxy' | 'consomme' | 'none' | 'unknown'

export interface WslDistroFact {
  name: string
  version: 1 | 2
  state: 'Running' | 'Stopped'
}

export interface WslVersionFacts {
  /** `wsl --version` exited 0 (inbox WSL and very old Store WSL do not know `--version`). */
  available: boolean
  /** WSL package version, e.g. `2.7.14.0`; null when unavailable or unparsable. */
  wsl: string | null
}

/**
 * `HKLM\SOFTWARE\Policies\WSL` (WSL ADMX, microsoft/WSL `intune/WSL.admx`,
 * read 2026-11-04). Booleans are null when the value is not set.
 */
export interface WslPolicyFacts {
  /** `absent` = no WSL policy key; `unknown` = query failed / not on Windows. */
  status: 'absent' | 'present' | 'unknown'
  /** Every value under the key as reported (REG_DWORD as number, REG_SZ as string). */
  values: Record<string, number | string>
  allowWsl: boolean | null
  allowWsl1: boolean | null
  allowInboxWsl: boolean | null
  allowNetworkingModeUserSetting: boolean | null
  /** ADMX enum: 0 None, 1 NAT, 3 Mirrored, 4 VirtioProxy. */
  defaultNetworkingMode: number | null
}

/** `%USERPROFILE%\.wslconfig` read with the T0838 INI parser (read-only). */
export interface WslConfigFacts {
  status: 'missing' | 'ok' | 'unreadable' | 'invalid-encoding' | 'unparsable'
  encoding: string | null
  /** `[wsl2] networkingMode`; null when not declared (or the file is not `ok`). */
  networkingMode: WslNetworkModeFact | null
  /** `[general] instanceIdleTimeout` raw value; null when not declared. */
  instanceIdleTimeout: string | null
}

/** The distro's `/etc/wsl.conf`, read as the default user. */
export interface WslDistroConfFacts {
  status: 'missing' | 'ok' | 'unreadable' | 'invalid-encoding' | 'unparsable'
  /** `[boot] systemd` raw value; null when not declared. */
  bootSystemd: string | null
  /** `[user] default` raw value; null when not declared. */
  userDefault: string | null
}

export interface WslSelectedDistroFacts {
  name: string
  /** From `wsl -l -v`; null when the distro is not in the list. */
  version: 1 | 2 | null
  state: 'Running' | 'Stopped' | null
  /** In-distro probe: `skipped` = not in the list / out of time. */
  probe: 'ok' | 'failed' | 'skipped'
  /** Default user name and uid (`id -un` / `id -u`). */
  user: string | null
  uid: number | null
  /** `/proc/1/comm`; `systemd` means systemd is PID 1 (running). */
  pid1: string | null
  systemdRunning: boolean | null
  wslConf: WslDistroConfFacts
  /** `/var/lib/systemd/linger/<user>` exists. */
  linger: boolean | null
}

export interface WslFacts {
  v: 1
  platform: string
  /** `os.release()` build on Windows (`10.0.<build>`); null elsewhere. */
  windowsBuild: number | null
  wslInstalled: boolean
  version: WslVersionFacts
  distros: WslDistroFact[]
  defaultDistro: string | null
  /** Names of the distros in state Running. */
  running: string[]
  selected: WslSelectedDistroFacts | null
  policy: WslPolicyFacts
  wslConfig: WslConfigFacts
  /** The overall 15 s budget ran out; facts collected after it are missing. */
  timedOut: boolean
  durationMs: number
}

export type WslEnvItemScope = 'machine' | 'distro' | 'user'
export type WslEnvItemEffect = 'elevation' | 'reboot' | 'shutdown-all-distros' | 'terminate-distro' | 'long-running'

/** One consent item (shape: T0831 〈調查結論〉2「一次同意」). */
export interface WslEnvPlanItem {
  id: 'wsl2-convert' | 'enable-systemd' | 'enable-linger'
  labelKey: string
  detailKey?: string
  /** i18n interpolation values for labelKey / detailKey. */
  params?: Record<string, string>
  scope: WslEnvItemScope
  effects: WslEnvItemEffect[]
  /** The wizard cannot succeed without it. */
  required: boolean
  defaultChecked: boolean
  /** Always applied (no checkbox); shown so the user knows. */
  fixed?: boolean
  /** Set → the item cannot be checked; the key says why. */
  disabledReasonKey?: string
}

export interface WslEnvNotice {
  id: 'policy-wsl-disabled' | 'wsl-not-installed' | 'wsl-too-old' | 'distro-probe-failed' | 'default-user-root'
  messageKey: string
  params?: Record<string, string>
  /** `blocking` = the WSL wizard cannot go on. */
  severity: 'info' | 'warning' | 'blocking'
}

export interface WslEnvPlan {
  items: WslEnvPlanItem[]
  notices: WslEnvNotice[]
}

/**
 * T0840 (PLAN-043 W3): items `apply-wsl-environment` applies through IPC
 * `wsl:apply-env-item` (`electron/wsl-env-apply.ts`). `enable-linger` is not
 * one of them: write-systemd-unit keeps doing it (T0378).
 */
export type WslEnvApplyItemId = 'wsl2-convert' | 'enable-systemd'

export type WslEnvApplyErrorCode =
  | 'wsl-set-version-failed'
  | 'wsl-systemd-enable-failed'
  | 'wsl-terminate-failed'
  | 'wsl-env-apply-invalid'

/** One real change on the machine (never undone automatically, D272). */
export interface WslEnvChange {
  item: WslEnvApplyItemId
  /** `wsl-version`: the distro was converted; `file`: a file was written. */
  kind: 'wsl-version' | 'file'
  /** Linux path of the file written (`file`). */
  path?: string
  /** Backup of the previous file; null when the file did not exist before. */
  backupPath?: string | null
}

export type WslEnvApplyResult =
  | { ok: true; outcome: 'applied' | 'already'; changes: WslEnvChange[]; terminated: boolean }
  | {
      ok: false
      errorCode: WslEnvApplyErrorCode
      error: string
      /** What was changed before the failure / abort (still not undone). */
      changes: WslEnvChange[]
      terminated: boolean
      aborted?: true
    }

/** `wslinfo` and reliable systemd support start at WSL 2.0.4 (T0831 P-7). */
export const WSL_MIN_RECOMMENDED_VERSION = '2.0.4'

/** Compare dotted numeric versions; missing parts count as 0. */
export function compareWslVersions(a: string, b: string): number {
  const pa = a.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const pb = b.split('.').map((part) => Number.parseInt(part, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

/**
 * WSL is installed but `wsl --version` fails (inbox WSL) or reports < 2.0.4.
 * An unparsable version from a working `--version` is not "too old".
 */
export function isWslTooOld(facts: Pick<WslFacts, 'wslInstalled' | 'version'>): boolean {
  if (!facts.wslInstalled) return false
  if (!facts.version.available) return true
  return facts.version.wsl !== null && compareWslVersions(facts.version.wsl, WSL_MIN_RECOMMENDED_VERSION) < 0
}

const KEY = 'wizard.wsl.plan'

function systemdDisabledReason(facts: WslFacts, selected: WslSelectedDistroFacts): string | undefined {
  if (isWslTooOld(facts)) return `${KEY}.reason.wslTooOld`
  switch (selected.wslConf.status) {
    case 'unparsable':
    case 'invalid-encoding':
      // T0831 〈風險〉: never edit a file we cannot parse (could make it worse).
      return `${KEY}.reason.wslConfUnparsable`
    case 'unreadable':
      return `${KEY}.reason.wslConfUnreadable`
    default:
      return undefined
  }
}

export function buildWslEnvPlan(facts: WslFacts): WslEnvPlan {
  const items: WslEnvPlanItem[] = []
  const notices: WslEnvNotice[] = []
  // Non-Windows hosts are rejected by detect-env's preflight; nothing to plan.
  if (facts.platform !== 'win32') return { items, notices }

  if (facts.policy.allowWsl === false) {
    notices.push({ id: 'policy-wsl-disabled', messageKey: `${KEY}.notice.policyWslDisabled`, severity: 'blocking' })
    return { items, notices }
  }
  if (!facts.wslInstalled) {
    // Phase 3 (W5) turns this into an "install WSL" item.
    notices.push({ id: 'wsl-not-installed', messageKey: `${KEY}.notice.wslNotInstalled`, severity: 'blocking' })
    return { items, notices }
  }
  if (isWslTooOld(facts)) {
    notices.push({
      id: 'wsl-too-old',
      messageKey: `${KEY}.notice.wslTooOld`,
      params: { version: facts.version.wsl ?? '', minimum: WSL_MIN_RECOMMENDED_VERSION },
      severity: 'warning',
    })
  }

  const selected = facts.selected
  // No distro / unknown distro: pick-wsl-distro reports it (wsl-no-distro).
  if (!selected || selected.version === null) return { items, notices }
  const params = { distro: selected.name }

  // P-1: WSL1 → WSL2. Required, but unchecked by default (slow, may fail on big distros).
  if (selected.version === 1) {
    items.push({
      id: 'wsl2-convert',
      labelKey: `${KEY}.item.wsl2Convert.label`,
      detailKey: `${KEY}.item.wsl2Convert.detail`,
      params,
      scope: 'distro',
      effects: ['terminate-distro', 'long-running'],
      required: true,
      defaultChecked: false,
    })
  }

  if (selected.probe !== 'ok') {
    notices.push({ id: 'distro-probe-failed', messageKey: `${KEY}.notice.distroProbeFailed`, params, severity: 'warning' })
    return { items, notices }
  }

  // P-2: systemd. WSL2 → needed unless systemd is PID 1 now (declared but not yet
  // restarted still needs the terminate). WSL1 → only the declaration matters
  // (systemd starts after the conversion).
  const declaredOn = selected.wslConf.bootSystemd !== null && selected.wslConf.bootSystemd.toLowerCase() === 'true'
  const needsSystemd = selected.version === 2 ? selected.systemdRunning !== true : !declaredOn
  if (needsSystemd) {
    const disabledReasonKey = systemdDisabledReason(facts, selected)
    items.push({
      id: 'enable-systemd',
      labelKey: `${KEY}.item.enableSystemd.label`,
      detailKey: `${KEY}.item.enableSystemd.detail`,
      params,
      scope: 'distro',
      effects: ['terminate-distro'],
      required: true,
      defaultChecked: disabledReasonKey === undefined,
      ...(disabledReasonKey ? { disabledReasonKey } : {}),
    })
  }

  // P-3: root default user — hint only.
  if (selected.uid === 0) {
    notices.push({ id: 'default-user-root', messageKey: `${KEY}.notice.defaultUserRoot`, params, severity: 'warning' })
  }

  // P-4: linger stays automatic; listed only when the checklist is shown anyway,
  // so a healthy machine still gets 0 items.
  if (items.length > 0 && selected.linger !== true) {
    items.push({
      id: 'enable-linger',
      labelKey: `${KEY}.item.enableLinger.label`,
      detailKey: `${KEY}.item.enableLinger.detail`,
      params,
      scope: 'user',
      effects: [],
      required: true,
      defaultChecked: true,
      fixed: true,
    })
  }

  return { items, notices }
}
