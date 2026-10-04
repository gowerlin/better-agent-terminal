/**
 * T0409 (PLAN-037 C): completion sentinel for install commands typed into a remote
 * terminal tab (T0407 §4).
 *
 * The command gets `; printf '\n__BAT_TOOL_DONE_%s_%s__\n' '<nonce>' "$?"` appended.
 * The terminal echoes the typed line, but that echo only contains the printf *format*
 * (`__BAT_TOOL_DONE_%s_%s__`), never `<nonce>_<digits>`, so only the real printf output
 * matches.
 */

export const SENTINEL_PREFIX = '__BAT_TOOL_DONE_'
export const SENTINEL_NONCE_RE = /^[0-9a-f]{16}$/

/** Raw output kept between chunks; far more than one sentinel plus split escape sequences. */
const MATCHER_TAIL_CHARS = 4096

function assertNonce(nonce: string): void {
  if (typeof nonce !== 'string' || !SENTINEL_NONCE_RE.test(nonce)) {
    throw new TypeError('remote-tools sentinel: nonce must be 16 lowercase hex chars')
  }
}

/** 16 hex chars from the platform CSPRNG (Web Crypto: renderer and Node alike). */
export function generateNonce(): string {
  const bytes = new Uint8Array(8)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Appends the sentinel printf. `$?` is the status of the whole command (the `;` ends it),
 * so the sentinel prints whether the command succeeded or failed.
 */
export function wrapWithSentinel(command: string, nonce: string): string {
  assertNonce(nonce)
  if (typeof command !== 'string') throw new TypeError('remote-tools sentinel: command must be a string')
  // Typed with a single trailing Enter: an embedded newline would submit early.
  if (/[\r\n]/.test(command)) throw new TypeError('remote-tools sentinel: command must be a single line')
  const body = command.trim()
  if (!body) throw new TypeError('remote-tools sentinel: command is empty')
  // `cmd;; printf` / `cmd &; printf` are syntax errors; recipes never end with a separator.
  if (/[;&|]$/.test(body)) throw new TypeError('remote-tools sentinel: command must not end with a separator')
  return `${body}; printf '\\n${SENTINEL_PREFIX}%s_%s__\\n' '${nonce}' "$?"`
}

// CSI (incl. 8-bit), OSC (BEL or ST terminated), charset designation, other 2-byte ESC.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /(?:\x1b\[|\x9b)[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()*+\-./][ -~]|\x1b[ -~]/g

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '')
}

export interface SentinelMatcher {
  /** Feeds one PTY output chunk; returns the exit code on the chunk that completes the sentinel, else null. */
  feed(chunk: string): number | null
  /** Exit code once seen, null before. */
  readonly exitCode: number | null
}

/**
 * Scans PTY output for `__BAT_TOOL_DONE_<nonce>_<code>__`. Handles markers and escape
 * sequences split across chunks by re-scanning a bounded raw tail after each chunk.
 */
export function createSentinelMatcher(nonce: string): SentinelMatcher {
  assertNonce(nonce)
  const marker = new RegExp(`${SENTINEL_PREFIX}${nonce}_(\\d{1,3})__`)
  let tail = ''
  let exitCode: number | null = null

  return {
    feed(chunk: string): number | null {
      if (exitCode !== null || typeof chunk !== 'string' || !chunk) return null
      tail += chunk
      const m = marker.exec(stripAnsi(tail))
      if (m) {
        const code = Number(m[1])
        if (code <= 255) {
          exitCode = code
          tail = ''
          return code
        }
      }
      if (tail.length > MATCHER_TAIL_CHARS) tail = tail.slice(-MATCHER_TAIL_CHARS)
      return null
    },
    get exitCode() {
      return exitCode
    },
  }
}
