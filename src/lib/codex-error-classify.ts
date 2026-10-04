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
