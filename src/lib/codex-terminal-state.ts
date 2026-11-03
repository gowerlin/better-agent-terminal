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
 * codex `>= 0.166.0` (T0717, D192; `codex-rs/tui/src/terminal_program_status.rs`): a turn that ends
 * sends `state=done` (failed: `state=error`) instead of `idle`, kept until the user presses a key,
 * pastes or clicks; both read as `idle` (`CODEX_IDLE_ALIASES`). `blocked` may carry
 * `:kind=permission|question|auth`, which is ignored (still `blocked`).
 *
 * PLAN-061 / T0811 (D229 / D258): claude (`app=claude-code`, measured with 2.1.316 in T0789) writes
 * the same sequence, but only after the terminal answered its probe `ESC ] 7501 ; ? BEL` (the
 * answer is written by `PtyManager`, `PROGRAM_STATUS_PROBE_REPLY`, on a non-Windows PTY host only):
 *   - allowed apps `PROGRAM_STATUS_APPS` (`codex`, `claude-code`); any other `app=` drops it
 *   - payload up to `CODEX_OSC_PAYLOAD_MAX` = 4096 (claude's `msg` is up to ~2.8k in base64)
 *   - a record with `id=` (claude's background sub-agent: `state=working:app=claude-code:id=…`,
 *     ended by `state=clear:id=…` without `app`) never changes the tab's state; only `state=clear`
 *     without `id` is the tab's clear
 *   - only `state` (and `app` / `id` to accept it) is read; `kind`, `progress`, `title`, `msg` are
 *     never decoded, kept or logged (they hold the prompt and the question text)
 *   - the probe (payload exactly `?`) is counted in `probes`, never a state
 *
 * Read-only: the output itself is never changed (xterm drops the unknown OSC).
 * Shared by main / headless (electron/pty-manager.ts `enqueuePtyOutput`, the Terminal Server replay).
 * 🔴 No `electron` / DOM import.
 */

export type CodexTerminalState = 'idle' | 'working' | 'blocked' | 'clear'

export const CODEX_TERMINAL_STATES: readonly CodexTerminalState[] = ['idle', 'working', 'blocked', 'clear']

/** The first codex release that writes OSC 7501 (0.162.1 and older do not, T0619). */
export const CODEX_OSC_MIN_VERSION = '0.163.0'

/** codex 0.166+ end-of-turn states that mean "not running" (T0717, D192): read as `idle`. */
export const CODEX_IDLE_ALIASES: readonly string[] = ['done', 'error']

/** `ESC ] 7501 ;` */
export const CODEX_OSC_PREFIX = '\x1b]7501;'

/** T0811: the `app=` values whose OSC 7501 is read (no `app` = accepted too: codex / claude `state=clear`). */
export const PROGRAM_STATUS_APPS: readonly string[] = ['codex', 'claude-code']

/**
 * T0811: what `PtyManager` writes into the PTY for each probe `ESC ] 7501 ; ?` it sees (fixed bytes;
 * claude accepts any `ESC ] 7501 ; ?…` ended by BEL or ST before its DA1 answer, T0789 ①).
 */
export const PROGRAM_STATUS_PROBE_REPLY = '\x1b]7501;?\x07'

/** T0811: the probe's payload (`ESC ] 7501 ; ? BEL`). */
const PROBE_PAYLOAD = '?'

/**
 * A payload longer than this without its terminator is dropped; the scan moves on. Also bounds the
 * tail kept for a sequence split across chunks. T0811: 128 → 4096 (claude's `blocked` with its
 * `msg` was 130 in T0789, ~2.8k at most).
 */
export const CODEX_OSC_PAYLOAD_MAX = 4096

/**
 * The value of an OSC 7501 payload (`state=working:app=codex`), or null (another app's, a
 * sub-record with `id=`, no / unknown state).
 */
export function parseCodexOscPayload(payload: string): CodexTerminalState | null {
  let state: string | null = null
  for (const part of payload.split(/[:;]/)) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const key = part.slice(0, eq).trim()
    if (key === 'id') return null // T0811: a sub-agent's record, never the tab's state
    if (key === 'app' && !PROGRAM_STATUS_APPS.includes(part.slice(eq + 1).trim())) return null
    if (key === 'state' && state === null) state = part.slice(eq + 1).trim()
  }
  if (state !== null && CODEX_IDLE_ALIASES.includes(state)) return 'idle'
  return state !== null && (CODEX_TERMINAL_STATES as readonly string[]).includes(state) ? state as CodexTerminalState : null
}

export interface CodexStateScan {
  /** The states found, in order. */
  states: CodexTerminalState[]
  /** T0811: how many probes `ESC ] 7501 ; ?` (BEL or ST) were completed in this text. */
  probes: number
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
  let probes = 0
  let i = 0
  for (;;) {
    const start = text.indexOf(CODEX_OSC_PREFIX, i)
    if (start < 0) break
    const found = sequenceEnd(text, start)
    if (found === 'incomplete') return { states, probes, tail: text.slice(start) }
    if (found === 'invalid') {
      i = start + 1
      continue
    }
    if (found.payload === PROBE_PAYLOAD) probes++
    else {
      const state = parseCodexOscPayload(found.payload)
      if (state) states.push(state)
    }
    i = found.end
  }
  // the prefix itself split: `…ESC ] 75` | `01;state=…`
  const lastEsc = text.lastIndexOf('\x1b')
  if (lastEsc >= i && lastEsc > text.length - CODEX_OSC_PREFIX.length && CODEX_OSC_PREFIX.startsWith(text.slice(lastEsc))) {
    return { states, probes, tail: text.slice(lastEsc) }
  }
  return { states, probes, tail: '' }
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
    return this.scan(id, chunk).states
  }

  /**
   * T0811: the states and the probes completed by `chunk` of PTY `id`. A probe split across chunks
   * is counted once, by the chunk that ends it.
   */
  scan(id: string, chunk: string): { states: CodexTerminalState[]; probes: number } {
    const tail = this.tails.get(id)
    const text = tail ? tail + chunk : chunk
    if (!tail && !text.includes('\x1b')) return { states: [], probes: 0 }
    const scan = scanCodexStates(text)
    if (scan.tail) this.tails.set(id, scan.tail)
    else if (tail !== undefined) this.tails.delete(id)
    return { states: scan.states, probes: scan.probes }
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
