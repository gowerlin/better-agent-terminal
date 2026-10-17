/**
 * PLAN-047 M1 / T0582: secrets masked out of terminal text before `terminal:read-output` hands it
 * to a helper (an MCP shim, CT). The one implementation; `electron/terminal-query-handlers.ts`
 * runs every read through it. Masks only — a read is never refused because of what it contains.
 *
 * Kinds (`[REDACTED:<kind>]`):
 *   - `pem`            `-----BEGIN … PRIVATE KEY-----` up to its `-----END … -----` (to the end of
 *                      the text when the END line has not been printed yet; from the start of the
 *                      text when an END line comes without its BEGIN — a read that began inside a key)
 *   - `authorization`  the value after `Authorization:` (to the end of the line)
 *   - `bearer`         the token after `Bearer `
 *   - `batcap`         a BAT helper capability (`batcap.` + base64url)
 *   - `server-token`   a known secret the host passes (its RemoteServer token, exact match), and a
 *                      standalone 43-character base64url run mixing upper case, lower case and
 *                      digits (the form `randomBytes(32).toString('base64url')` server tokens have)
 *   - `sk`             `sk-…` API keys (Anthropic `sk-ant-…`, OpenAI `sk-proj-…`, …)
 *   - `github`         `ghp_` / `gho_` / `ghu_` / `ghs_` / `ghr_` / `github_pat_` tokens
 *   - `aws`            `AKIA…` / `ASIA…` access key ids
 *   - `secret-env`     the value of `<NAME>=` / `<NAME>:` where NAME ends in TOKEN / SECRET /
 *                      PASSWORD / API_KEY / APIKEY / ACCESS_KEY (e.g. `BAT_REMOTE_TOKEN=…` in `env`)
 *
 * A prefixed token (`batcap.`, `sk-`, `ghp_`, `github_pat_`) that reaches the very end of the text
 * is masked whatever its length: a read can end in the middle of a line still being printed, and
 * the rest of that token comes with the next read.
 *
 * Pure: no `electron`, no DOM.
 */

export type RedactionKind =
  | 'pem'
  | 'authorization'
  | 'bearer'
  | 'batcap'
  | 'server-token'
  | 'sk'
  | 'github'
  | 'aws'
  | 'secret-env'

export interface RedactionResult {
  text: string
  /** How many values were replaced. */
  count: number
}

/** Known secrets shorter than this are not matched literally (an empty / tiny value would mask everything). */
const KNOWN_SECRET_MIN_LENGTH = 16

function placeholder(kind: RedactionKind): string {
  return `[REDACTED:${kind}]`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface Rule {
  kind: RedactionKind
  pattern: RegExp
  /** Replacement keeping a captured prefix (`$1`); default: the whole match. */
  keepPrefix?: boolean
}

// Order matters: whole blocks first, then header values, then single tokens.
const RULES: readonly Rule[] = [
  // A read that starts inside a key (its BEGIN line came with an earlier read): mask up to its END.
  { kind: 'pem', pattern: /^(?:(?!-----BEGIN )[\s\S])*?-----END [A-Z0-9 ]*PRIVATE KEY-----/ },
  { kind: 'pem', pattern: /-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?(?:-----END \1-----|$(?![\s\S]))/g },
  { kind: 'authorization', pattern: /(\bAuthorization[ \t]*:[ \t]*)(?![ \t]*\[REDACTED:)[^\r\n]+/gi, keepPrefix: true },
  { kind: 'bearer', pattern: /(\bBearer[ \t]+)(?!\[REDACTED:)[A-Za-z0-9._~+/=-]{8,}/g, keepPrefix: true },
  { kind: 'batcap', pattern: /\bbatcap\.(?:[A-Za-z0-9_-]{16,}|[A-Za-z0-9_-]*$(?![\s\S]))/g },
  { kind: 'sk', pattern: /\bsk-(?:[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]*$(?![\s\S]))/g },
  { kind: 'github', pattern: /\b(?:gh[pousr]_(?:[A-Za-z0-9]{20,}|[A-Za-z0-9]*$(?![\s\S]))|github_pat_(?:[A-Za-z0-9_]{20,}|[A-Za-z0-9_]*$(?![\s\S])))/g },
  { kind: 'aws', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  {
    kind: 'secret-env',
    pattern: /(\b[A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|APIKEY|ACCESS_KEY)[ \t]*[=:][ \t]*)(?!["']?\[REDACTED:)["']?[^\s"']+["']?/g,
    keepPrefix: true,
  },
  // A standalone 43-char base64url run with upper, lower and digits (server token form).
  {
    kind: 'server-token',
    pattern: /(?<![A-Za-z0-9_-])(?=[A-Za-z0-9_-]{0,42}[A-Z])(?=[A-Za-z0-9_-]{0,42}[a-z])(?=[A-Za-z0-9_-]{0,42}[0-9])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g,
  },
]

/**
 * `text` with every secret replaced by `[REDACTED:<kind>]`, and how many were replaced.
 * `knownSecrets` are matched literally first (kind `server-token`).
 */
export function redactTerminalSecrets(text: string, knownSecrets: readonly string[] = []): RedactionResult {
  let out = text
  let count = 0
  for (const secret of knownSecrets) {
    if (typeof secret !== 'string' || secret.length < KNOWN_SECRET_MIN_LENGTH) continue
    out = out.replace(new RegExp(escapeRegExp(secret), 'g'), () => {
      count++
      return placeholder('server-token')
    })
  }
  for (const rule of RULES) {
    out = out.replace(rule.pattern, (_match: string, prefix?: unknown) => {
      count++
      return rule.keepPrefix && typeof prefix === 'string' ? prefix + placeholder(rule.kind) : placeholder(rule.kind)
    })
  }
  return { text: out, count }
}
