// BUG-084 / T0372 — classify Claude Code error strings into actionable kinds.
//
// The server rejects models the CLI is too old for with `error_code: claude_code_version_too_old`.
// The JSON envelope may be wrapped differently depending on the path (assistant text, result,
// thrown SDK error), so we match on the error code / key phrases (case-insensitive) instead of
// parsing JSON. Versions are best-effort and omitted when not extractable.

export type ClaudeErrorKind = 'cli-too-old' | 'unknown'

export interface ClaudeErrorClassification {
  kind: ClaudeErrorKind
  currentVersion?: string
  requiredVersion?: string
}

const ERROR_CODE_RE = /claude_code_version_too_old/i
const REQUIRED_RE = /\bversion\s+v?(\d+\.\d+\.\d+[\w.-]*)\s+or\s+newer\s+is\s+required/i
// "Claude Code 2.1.113 does not support this model" -> 2.1.113
const CURRENT_RE = /\bclaude\s+code\s+v?(\d+\.\d+\.\d+[\w.-]*)\s+does\s+not\s+support\b/i
const DOES_NOT_SUPPORT_RE = /\bclaude\s+code\b[^\n]*?\bdoes\s+not\s+support\s+this\s+model/i

export function classifyClaudeError(message: string): ClaudeErrorClassification {
  const text = typeof message === 'string' ? message : ''
  if (!text) return { kind: 'unknown' }

  const required = text.match(REQUIRED_RE)?.[1]
  if (!ERROR_CODE_RE.test(text) && !(required && DOES_NOT_SUPPORT_RE.test(text))) {
    return { kind: 'unknown' }
  }

  const result: ClaudeErrorClassification = { kind: 'cli-too-old' }
  const current = text.match(CURRENT_RE)?.[1]
  if (current) result.currentVersion = current
  if (required) result.requiredVersion = required
  return result
}
