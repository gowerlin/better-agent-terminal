/**
 * T0385 (BUG-094): classify why opening a remote profile failed, so the
 * dialog stops reporting every failure as "not running or did not respond".
 *
 * Pure module (no electron import) — main.ts builds the dialog from
 * `describeRemoteProfileFailure()`.
 */
import type { ConnectResult } from './remote-client'

/**
 * - `unreachable`: socket never came up (refused / timeout / network / tunnel)
 * - `trust`: reached the server but the pinned fingerprint or token was rejected
 * - `protocol`: connected and authenticated, but the remote call itself failed
 *   (e.g. `No handler for channel: …` from an older/incompatible bat-server)
 * - `limit`: refused before connecting — `MAX_CONCURRENT_REMOTE_PROFILES` other
 *   remote profiles are already connected (T0464 / PLAN-039); none was pushed out
 */
export type RemoteProfileFailureReason = 'unreachable' | 'trust' | 'protocol' | 'limit'

export interface RemoteProfileFailure {
  reason: RemoteProfileFailureReason
  host: string
  port: number
  label: string
  /** Original error text, surfaced verbatim in the dialog detail. */
  error?: string
  /** `limit` only: the concurrent remote profile cap that refused this profile. */
  limit?: number
}

/** Errors RemoteClient.invoke raises when the transport — not the server — failed. */
const TRANSPORT_INVOKE_ERRORS = [
  /^Not connected to remote server$/,
  /^Connection closed$/,
  /^Disconnected$/,
  /^Remote invoke timeout: /,
]

export function classifyConnectFailure(result: ConnectResult): RemoteProfileFailureReason {
  switch (result.errorCode) {
    case 'fingerprint-mismatch':
    case 'auth-failed':
      return 'trust'
    default:
      return 'unreachable'
  }
}

export function classifyInvokeFailure(err: unknown): RemoteProfileFailureReason {
  const message = err instanceof Error ? err.message : String(err)
  return TRANSPORT_INVOKE_ERRORS.some(re => re.test(message)) ? 'unreachable' : 'protocol'
}

/**
 * T0464 (PLAN-039): strings for the remote profile cap. Electron main has no i18next
 * instance (same as the quit dialog, PLAN-012 / T0144), so they live here; keep them
 * in sync with src/locales/{en,zh-TW,zh-CN}.json `remoteProfileLimit.*` (a unit test
 * checks). `title` / `message` / `detail` build main's dialog, `notice` is the
 * renderer's notification when `remote:connect` answers `errorCode: 'remote-limit'`.
 */
export function getRemoteProfileLimitStrings(lang: string | undefined) {
  const code = (lang || '').toLowerCase()
  if (code.startsWith('zh-tw') || code === 'zh' || code.startsWith('zh-hant')) {
    return {
      title: '遠端配置已達上限',
      message: '無法開啟遠端配置「{{label}}」',
      detail: '已有 {{limit}} 個遠端配置同時連線（上限）。請先關閉不再需要的遠端配置的所有視窗（其連線會在 {{seconds}} 秒後釋放），再重試。既有連線不受影響。',
      notice: '遠端連線被拒：已有 {{limit}} 個遠端配置同時連線（上限）。請先關閉不再需要的遠端配置的所有視窗，再重試。',
    }
  }
  if (code.startsWith('zh-cn') || code.startsWith('zh-hans')) {
    return {
      title: '远程配置已达上限',
      message: '无法打开远程配置“{{label}}”',
      detail: '已有 {{limit}} 个远程配置同时连接（上限）。请先关闭不再需要的远程配置的所有窗口（其连接会在 {{seconds}} 秒后释放），再重试。现有连接不受影响。',
      notice: '远程连接被拒绝：已有 {{limit}} 个远程配置同时连接（上限）。请先关闭不再需要的远程配置的所有窗口，再重试。',
    }
  }
  return {
    title: 'Remote profile limit reached',
    message: 'Cannot open remote profile "{{label}}"',
    detail: '{{limit}} remote profiles are already connected, which is the maximum. Close every window of a remote profile you no longer need (its connection is released {{seconds}} seconds later), then try again. Existing connections were not affected.',
    notice: 'Remote connection refused: {{limit}} remote profiles are already connected, which is the maximum. Close every window of a remote profile you no longer need, then try again.',
  }
}

/**
 * T0491: strings for the other failure reasons (`unreachable` / `trust` / `protocol`),
 * the localized prefix of the raw error line and the dialog's button. Same contract as
 * `getRemoteProfileLimitStrings`: keep in sync with src/locales/{en,zh-TW,zh-CN}.json
 * `remoteProfileFailure.*` (a unit test checks).
 */
export function getRemoteProfileFailureStrings(lang: string | undefined) {
  const code = (lang || '').toLowerCase()
  if (code.startsWith('zh-tw') || code === 'zh' || code.startsWith('zh-hant')) {
    return {
      unreachable: {
        title: '無法連線遠端配置',
        message: '無法連線到遠端配置「{{label}}」',
        detail: '位於 {{host}}:{{port}} 的遠端伺服器未執行，或未在 6 秒內回應。',
      },
      trust: {
        title: '遠端配置未受信任',
        message: '無法通過遠端配置「{{label}}」的驗證',
        detail: '可以連到位於 {{host}}:{{port}} 的遠端伺服器，但其憑證指紋或存取權杖遭拒。請重新配對此配置（釘選預期的指紋／更新權杖）後再試。',
      },
      protocol: {
        title: '遠端伺服器不相容',
        message: '已連線到遠端配置「{{label}}」，但伺服器無法處理請求',
        detail: '位於 {{host}}:{{port}} 的遠端伺服器正在執行且已接受連線，但請求失敗。伺服器版本可能與此 BAT 版本不相容，或伺服器不支援此功能。請更新遠端伺服器套件（server bundle）。',
      },
      error: '錯誤：{{error}}',
      ok: '確定',
    }
  }
  if (code.startsWith('zh-cn') || code.startsWith('zh-hans')) {
    return {
      unreachable: {
        title: '无法连接远程配置',
        message: '无法连接到远程配置“{{label}}”',
        detail: '位于 {{host}}:{{port}} 的远程服务器未运行，或未在 6 秒内响应。',
      },
      trust: {
        title: '远程配置不受信任',
        message: '无法通过远程配置“{{label}}”的验证',
        detail: '可以连接到位于 {{host}}:{{port}} 的远程服务器，但其证书指纹或访问令牌被拒绝。请重新配对此配置（钉选预期的指纹/更新令牌）后重试。',
      },
      protocol: {
        title: '远程服务器不兼容',
        message: '已连接到远程配置“{{label}}”，但服务器无法处理请求',
        detail: '位于 {{host}}:{{port}} 的远程服务器正在运行并已接受连接，但请求失败。服务器版本可能与此 BAT 版本不兼容，或服务器不支持此功能。请更新远程服务器包（server bundle）。',
      },
      error: '错误：{{error}}',
      ok: '确定',
    }
  }
  return {
    unreachable: {
      title: 'Remote profile unreachable',
      message: 'Cannot connect to remote profile "{{label}}"',
      detail: 'The remote server at {{host}}:{{port}} is not running or did not respond within 6 seconds.',
    },
    trust: {
      title: 'Remote profile not trusted',
      message: 'Cannot authenticate to remote profile "{{label}}"',
      detail: 'The remote server at {{host}}:{{port}} is reachable, but its certificate fingerprint or access token was rejected. Re-pair the profile (pin the expected fingerprint / update the token) and try again.',
    },
    protocol: {
      title: 'Remote server incompatible',
      message: 'Remote profile "{{label}}" connected, but the server could not handle the request',
      detail: 'The remote server at {{host}}:{{port}} is running and accepted the connection, but the request failed. The server version may be incompatible with this BAT version, or the feature is not supported by the server. Update the remote server bundle.',
    },
    error: 'Error: {{error}}',
    ok: 'OK',
  }
}

/** Replaces `{{name}}` placeholders; unknown names are left as they are. */
function fillPlaceholders(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in values ? String(values[name]) : match))
}

/**
 * `lang` (persisted settings `language`) picks the dialog language for every reason
 * (T0464 `limit`, T0491 the others); the original error text is appended verbatim.
 * `idleGraceMs` is the registry's idle grace, named in the `limit` detail.
 */
export function describeRemoteProfileFailure(
  failure: RemoteProfileFailure,
  options: { lang?: string; idleGraceMs?: number } = {},
): {
  title: string
  message: string
  detail: string
  /** Label of the dialog's only button. */
  ok: string
} {
  const { host, port, label, error } = failure
  const strings = getRemoteProfileFailureStrings(options.lang)
  if (failure.reason === 'limit') {
    const s = getRemoteProfileLimitStrings(options.lang)
    const values = {
      label,
      limit: failure.limit ?? '?',
      seconds: Math.round((options.idleGraceMs ?? 15_000) / 1000),
    }
    return {
      title: s.title,
      message: fillPlaceholders(s.message, values),
      detail: fillPlaceholders(s.detail, values),
      ok: strings.ok,
    }
  }
  const s = failure.reason === 'trust' || failure.reason === 'protocol' ? strings[failure.reason] : strings.unreachable
  const values = { label, host, port }
  const suffix = error ? `\n\n${fillPlaceholders(strings.error, { error })}` : ''
  return {
    title: s.title,
    message: fillPlaceholders(s.message, values),
    detail: fillPlaceholders(s.detail, values) + suffix,
    ok: strings.ok,
  }
}
