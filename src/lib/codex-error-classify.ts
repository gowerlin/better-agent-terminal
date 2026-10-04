// BUG-083 / T0367 — classify Codex error strings into actionable kinds.
//
// Codex wording changes often, so we match on short key phrases (case-insensitive)
// instead of full strings. `detail` is best-effort and omitted when not extractable.

export type CodexErrorKind = 'config-incompatible' | 'cli-too-old' | 'unknown'

export interface CodexErrorClassification {
  kind: CodexErrorKind
  detail?: string
}

const CONFIG_LOAD_RE = /error loading config\.toml/i
const CLI_TOO_OLD_RE = /requires a newer version of codex/i

// "... expected `fast` or `flex` in `service_tier`" -> service_tier
const CONFIG_KEY_IN_RE = /\bin\s+`([^`\s]+)`/i
// "unknown field `foo`" / "missing field `foo`" -> foo
const CONFIG_KEY_FIELD_RE = /\b(?:unknown|missing|invalid|duplicate)\s+(?:field|key)\s+`([^`\s]+)`/i

// "The 'gpt-5.6-terra' model requires a newer version of Codex" -> gpt-5.6-terra
const MODEL_QUOTED_RE = /['"`‘’“”]([^'"`‘’“”\s]+)['"`‘’“”]\s+model\s+requires\s+a\s+newer\s+version/i
const MODEL_BARE_RE = /\bthe\s+(\S+)\s+model\s+requires\s+a\s+newer\s+version/i

export function classifyCodexError(message: string): CodexErrorClassification {
  const text = typeof message === 'string' ? message : ''
  if (!text) return { kind: 'unknown' }

  if (CONFIG_LOAD_RE.test(text)) {
    const key = text.match(CONFIG_KEY_IN_RE)?.[1] ?? text.match(CONFIG_KEY_FIELD_RE)?.[1]
    return key ? { kind: 'config-incompatible', detail: key } : { kind: 'config-incompatible' }
  }

  if (CLI_TOO_OLD_RE.test(text)) {
    const model = text.match(MODEL_QUOTED_RE)?.[1] ?? text.match(MODEL_BARE_RE)?.[1]
    return model ? { kind: 'cli-too-old', detail: model } : { kind: 'cli-too-old' }
  }

  return { kind: 'unknown' }
}

// BUG-083 / T0370 — progress messages Codex emits while the turn keeps running. They arrive as
// top-level `{ type: 'error' }` or `item.type="error"`, but are not failures: the final outcome
// still comes from `turn.completed` / `turn.failed`.
export type CodexTransientNoticeKind = 'config-warning' | 'reconnecting' | 'transport-fallback'

const TRANSIENT_NOTICE_RES: ReadonlyArray<[CodexTransientNoticeKind, RegExp]> = [
  // "Codex is ignoring 1 unrecognized configuration setting. ..." (T0367)
  ['config-warning', /^\s*codex is ignoring\b/i],
  // "Reconnecting... 2/5 (unexpected status 401 Unauthorized: ...)"
  ['reconnecting', /\breconnecting\.{3}\s*\d+\s*\/\s*\d+/i],
  // "Falling back from WebSockets to HTTPS transport. ..."
  ['transport-fallback', /falling back from websockets? to https transport/i],
]

export function codexTransientNoticeKind(message: string): CodexTransientNoticeKind | undefined {
  const text = typeof message === 'string' ? message : ''
  if (!text) return undefined
  for (const [kind, re] of TRANSIENT_NOTICE_RES) {
    if (re.test(text)) return kind
  }
  return undefined
}

export function isCodexTransientNotice(message: string): boolean {
  return codexTransientNoticeKind(message) !== undefined
}
