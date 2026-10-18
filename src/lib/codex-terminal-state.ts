/**
 * PLAN-047 M1b-2 / T0621 (D158): codex's own machine-readable state sequence, read from PTY output.
 *
 * codex `>= 0.163.0` writes `ESC ] 7501 ; state=<idle|working|blocked>[:app=codex] ST` (ST = `ESC \`
 * or BEL) on every transition of its TUI, and `ESC ] 7501 ; state=clear ST` when it ends; no
 * setting needed, independent of focus (T0619, measured). The first one comes ~0.5 s after the TUI is
 * ready; a codex stuck on a pre-start screen (Trust this folder? / Hooks need review) sends none.
 * The sequence is undocumented: parse leniently — only the `state=` value counts, an `app=` other
 * than `codex` drops the sequence, an unknown `state=` value is ignored.
 *
 * Read-only: the output itself is never changed (xterm drops the unknown OSC).
 * Shared by main / headless (electron/pty-manager.ts `enqueuePtyOutput`, the Terminal Server replay).
 * 🔴 No `electron` / DOM import.
 */

export type CodexTerminalState = 'idle' | 'working' | 'blocked' | 'clear'

export const CODEX_TERMINAL_STATES: readonly CodexTerminalState[] = ['idle', 'working', 'blocked', 'clear']

/** The first codex release that writes OSC 7501 (0.162.1 and older do not, T0619). */
export const CODEX_OSC_MIN_VERSION = '0.163.0'

/** `ESC ] 7501 ;` */
export const CODEX_OSC_PREFIX = '\x1b]7501;'

/**
 * A payload longer than this without its terminator is not codex's (`state=working:app=codex` is
 * 23 chars); the scan moves on. Also bounds the tail kept for a sequence split across chunks.
 */
export const CODEX_OSC_PAYLOAD_MAX = 128

/** The value of an OSC 7501 payload (`state=working:app=codex`), or null (not codex's / unknown). */
export function parseCodexOscPayload(payload: string): CodexTerminalState | null {
  let state: string | null = null
  for (const part of payload.split(/[:;]/)) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 'app' && value !== 'codex') return null
    if (key === 'state' && state === null) state = value
  }
  return state !== null && (CODEX_TERMINAL_STATES as readonly string[]).includes(state) ? state as CodexTerminalState : null
}

export interface CodexStateScan {
  /** The states found, in order. */
  states: CodexTerminalState[]
  /** An unfinished sequence at the end (≤ prefix + `CODEX_OSC_PAYLOAD_MAX` + 1 chars), '' = none. */
  tail: string
}

/** Where the sequence starting at `start` (its prefix) ends: its terminator's end, `incomplete`, or `invalid`. */
function sequenceEnd(text: string, start: number): { end: number; payload: string } | 'incomplete' | 'invalid' {
  const from = start + CODEX_OSC_PREFIX.length
  const limit = Math.min(text.length, from + CODEX_OSC_PAYLOAD_MAX + 1)
  for (let k = from; k < limit; k++) {
    const ch = text.charCodeAt(k)
    if (ch === 0x07) return { end: k + 1, payload: text.slice(from, k) }
    if (ch === 0x1b) {
      if (k + 1 >= text.length) return 'incomplete'
      return text[k + 1] === '\\' ? { end: k + 2, payload: text.slice(from, k) } : 'invalid'
    }
  }
  return limit === text.length && text.length - from <= CODEX_OSC_PAYLOAD_MAX ? 'incomplete' : 'invalid'
}

/**
 * The codex states in `text` (`tail` of the previous chunk + this chunk). One `indexOf` per
 * sequence, no regular expression, no backtracking; an unfinished sequence (or the start of the
 * prefix) at the end comes back as `tail` for the next chunk.
 */
export function scanCodexStates(text: string): CodexStateScan {
  const states: CodexTerminalState[] = []
  let i = 0
  for (;;) {
    const start = text.indexOf(CODEX_OSC_PREFIX, i)
    if (start < 0) break
    const found = sequenceEnd(text, start)
    if (found === 'incomplete') return { states, tail: text.slice(start) }
    if (found === 'invalid') {
      i = start + 1
      continue
    }
    const state = parseCodexOscPayload(found.payload)
    if (state) states.push(state)
    i = found.end
  }
  // the prefix itself split: `…ESC ] 75` | `01;state=…`
  const lastEsc = text.lastIndexOf('\x1b')
  if (lastEsc >= i && lastEsc > text.length - CODEX_OSC_PREFIX.length && CODEX_OSC_PREFIX.startsWith(text.slice(lastEsc))) {
    return { states, tail: text.slice(lastEsc) }
  }
  return { states, tail: '' }
}

/** The last codex state in `text` (the Terminal Server replay after BAT reopened), or null. */
export function lastCodexState(text: string): CodexTerminalState | null {
  const { states } = scanCodexStates(text)
  return states.length > 0 ? states[states.length - 1] : null
}

/**
 * Per-PTY scanner: keeps only the unfinished tail of each PTY (absent for almost every PTY), so
 * a PTY that never prints OSC 7501 costs one `indexOf` per chunk.
 */
export class CodexStateScanner {
  private readonly tails = new Map<string, string>()

  feed(id: string, chunk: string): CodexTerminalState[] {
    const tail = this.tails.get(id)
    const text = tail ? tail + chunk : chunk
    if (!tail && !text.includes('\x1b')) return []
    const scan = scanCodexStates(text)
    if (scan.tail) this.tails.set(id, scan.tail)
    else if (tail !== undefined) this.tails.delete(id)
    return scan.states
  }

  clear(id: string): void {
    this.tails.delete(id)
  }

  dispose(): void {
    this.tails.clear()
  }
}

const VERSION_RE = /codex-cli\s+v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/i

/**
 * Whether `codex --version` output names a codex that writes OSC 7501 (`>= 0.163.0`; a pre-release
 * of 0.163.0 does not count). null = no version in it.
 */
export function codexVersionWritesOsc(versionOutput: string): boolean | null {
  const m = VERSION_RE.exec(versionOutput)
  if (!m) return null
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const [rMajor, rMinor, rPatch] = CODEX_OSC_MIN_VERSION.split('.').map(Number)
  if (major !== rMajor) return major > rMajor
  if (minor !== rMinor) return minor > rMinor
  if (patch !== rPatch) return patch > rPatch
  return m[4] === undefined
}
