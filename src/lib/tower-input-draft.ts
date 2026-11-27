/**
 * PLAN-068 W2 / T0904 (T0902 §1 signal S1, §2.4 `draft`, GitHub #23): does the input box of a Tower
 * tab hold text the user typed and has not sent?
 *
 * The host sees every byte the user sends into the PTY (`pty:write` from a local window or a headless
 * client), not the screen. It guesses conservatively: once the user sends anything that may edit the
 * input after the last Enter / Ctrl+C, the tab has a draft. A wrong guess only holds a notification
 * longer (the user still has「立即送出」), never mixes it into the user's text.
 *
 *   - `\r` (Enter, outside a bracketed paste) and `\x03` (Ctrl+C) → no draft
 *   - printable text, Tab, `\n`, a bracketed paste (its `\r` included), Alt + key, ↑ / ↓ (history)
 *     and any other key sequence → draft
 *   - left alone (neither): a lone Esc (interrupts the agent, types nothing), other C0 controls and
 *     Backspace, ← / → / Home / End / Insert / Delete / PageUp / PageDown, focus and mouse reports,
 *     cursor position reports
 *
 * T0940 / BUG-227 — keys that never stay in the input box (both only narrow `trackDraft`; when BAT
 * cannot tell, `trackDraft` decides as before):
 *
 *   - 案 A `trackDraftDuringPrompt`: while a hook / osc prompt is shown (permission, AskUserQuestion,
 *     elicitation, codex approval) one key (`isSingleKeyInput`) goes to the dialog: the draft is left
 *     as it was — not set, not cleared (an Enter that answers the prompt keeps a draft typed before it).
 *     A bracketed paste or several characters at once is tracked as before.
 *   - 案 B claude's single-key surveys (`SINGLE_KEY_PROMPT_LEGENDS`, claude 2.1.331): the key goes into
 *     the input box and the survey takes it out 400 ms later. `SingleKeyPromptScanner` reads the PTY
 *     output (read only) for a survey's legend; `answersSingleKeyPrompt` says whether the user's write
 *     answered it (no draft before, exactly one valid key, the survey shown ≥ `SINGLE_KEY_PROMPT_SETTLE_MS`
 *     and ≤ `SINGLE_KEY_PROMPT_MAX_AGE_MS`; nothing else written since — the caller forgets the record on
 *     every other write).
 *
 * 🔴 No `electron` / DOM import (main and headless share it through electron/notify-hold.ts).
 */

export interface DraftState {
  /** The input box may hold text the user has not sent. */
  draft: boolean
  /** Inside a bracketed paste (`ESC [200~` … `ESC [201~`) that is still open. */
  inPaste: boolean
}

export const NO_DRAFT: DraftState = Object.freeze({ draft: false, inPaste: false })

const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'

/** CSI finals that leave the draft alone: cursor moves, focus / cursor-position reports. */
const NEUTRAL_CSI_FINALS = new Set(['C', 'D', 'H', 'F', 'I', 'O', 'R'])
/** `CSI <n> ~` keys that leave it alone: Home 1 / Insert 2 / Delete 3 / End 4 / PageUp 5 / PageDown 6 / 7 / 8. */
const NEUTRAL_TILDE_KEYS = new Set(['1', '2', '3', '4', '5', '6', '7', '8'])

type Effect = 'draft' | 'clear' | 'none'

/** The effect of one CSI sequence (params `p`, final byte `f`). */
function csiEffect(p: string, f: string): Effect {
  if (p.startsWith('<') && (f === 'M' || f === 'm')) return 'none' // SGR mouse report
  if (f === '~') return NEUTRAL_TILDE_KEYS.has(p.split(';')[0]) ? 'none' : 'draft'
  if (NEUTRAL_CSI_FINALS.has(f)) return 'none'
  return 'draft' // ↑ / ↓ (A / B: history), CSI u keys (Shift+Enter …), anything unknown
}

/**
 * The draft state after the user sent `data`. Pure; `prev` is not changed.
 */
export function trackDraft(prev: DraftState, data: string): DraftState {
  let { draft, inPaste } = prev
  let i = 0
  const apply = (effect: Effect) => {
    if (effect === 'draft') draft = true
    else if (effect === 'clear') draft = false
  }
  while (i < data.length) {
    if (data.startsWith(PASTE_START, i)) {
      inPaste = true
      i += PASTE_START.length
      continue
    }
    if (data.startsWith(PASTE_END, i)) {
      inPaste = false
      i += PASTE_END.length
      continue
    }
    const ch = data[i]
    if (inPaste) {
      // the pasted text, its `\r` included, is part of the draft
      draft = true
      i += 1
      continue
    }
    if (ch === '\r' || ch === '\x03') {
      apply('clear')
      i += 1
      continue
    }
    if (ch === '\x1b') {
      if (i + 1 >= data.length) {
        // a lone Esc: interrupts / closes a menu, types nothing
        i += 1
        continue
      }
      const next = data[i + 1]
      if (next === '[') {
        // X10 mouse report: ESC [ M + 3 bytes
        if (data[i + 2] === 'M' && data.length >= i + 6) {
          i += 6
          continue
        }
        let j = i + 2
        while (j < data.length && data.charCodeAt(j) >= 0x20 && data.charCodeAt(j) <= 0x3f) j += 1 // params / intermediates
        if (j >= data.length) {
          // a cut-off sequence: count it as a key
          apply('draft')
          i = j
          continue
        }
        apply(csiEffect(data.slice(i + 2, j), data[j]))
        i = j + 1
        continue
      }
      if (next === 'O') {
        // SS3: F1–F4 / application cursor keys (A / B = ↑ / ↓)
        const f = data[i + 2]
        apply(f === 'A' || f === 'B' ? 'draft' : 'none')
        i += f === undefined ? 2 : 3
        continue
      }
      // Alt + key (Alt+Enter is a new line in claude's input)
      apply('draft')
      i += 2
      continue
    }
    const code = ch.charCodeAt(0)
    if (ch === '\t' || ch === '\n' || code >= 0x20) {
      if (code !== 0x7f) apply('draft')
      i += 1
      continue
    }
    // other C0 controls (Ctrl+L, Ctrl+D, Backspace 0x08 …): leave it
    i += 1
  }
  return { draft, inPaste }
}

// ── T0940 / BUG-227 案 A: keys that answer a hook / osc prompt ──

/**
 * One key in one write: a single character (Enter, Esc, Tab, Backspace, a digit, a letter …) or one
 * complete escape sequence (an arrow, Alt + key, F-keys, a mouse report). Not a bracketed paste and
 * not several characters at once (an IME commit, typing that arrived together).
 */
export function isSingleKeyInput(data: string): boolean {
  if (typeof data !== 'string' || data.length === 0) return false
  if (data.includes(PASTE_START) || data.includes(PASTE_END)) return false
  const chars = Array.from(data)
  if (chars.length === 1) return true
  if (data[0] !== '\x1b') return false
  if (chars.length === 2) return true // Alt + key (Alt+Enter included)
  if (data[1] === '[') {
    if (data[2] === 'M') return data.length === 6 // X10 mouse report
    let j = 2
    while (j < data.length && data.charCodeAt(j) >= 0x20 && data.charCodeAt(j) <= 0x3f) j += 1
    return j === data.length - 1 && data.charCodeAt(j) >= 0x40 && data.charCodeAt(j) <= 0x7e
  }
  if (data[1] === 'O') return data.length === 3 // SS3
  return false
}

/**
 * 案 A: the draft state after `data` came while a hook / osc prompt was shown. One key goes to the
 * dialog, not to the input box: the state is kept as it was (not set, not cleared). Anything else (a
 * paste, several characters — the prompt may be stale and the user types into the input box) is
 * tracked by `trackDraft` as before.
 */
export function trackDraftDuringPrompt(prev: DraftState, data: string): DraftState {
  if (prev.inPaste || !isSingleKeyInput(data)) return trackDraft(prev, data)
  return { draft: prev.draft, inPaste: prev.inPaste }
}

// ── T0940 / BUG-227 案 B: claude's single-key surveys ──

/**
 * A claude survey that takes one key out of the input box. Matched on the legend (`<key>: <label>`
 * list), not on the title (titles vary; a document may quote a title). 🔴 The only copy of these
 * strings: taken from the claude CLI 2.1.331 binary (the survey component and its shared key hook);
 * when the CLI changes them, change them here and in src/lib/__tests__/tower-input-draft.test.ts. A
 * legend that no longer matches only falls back to `trackDraft` (the draft is kept, as before).
 */
export interface SingleKeyPromptLegend {
  id: string
  /** Matched against `normalizeScreenText` output (one space between words). */
  pattern: RegExp
  /** The keys that answer it (claude: the input box is exactly that one key). */
  keys(match: RegExpExecArray): readonly string[]
}

export const SINGLE_KEY_PROMPT_LEGENDS: readonly SingleKeyPromptLegend[] = Object.freeze([
  // "How is Claude doing this session? (optional)", the memory / long-context / post-compact /
  // organisation surveys: `1: Bad 2: Fine 3: Good [4: Unsure] 0: Dismiss`
  { id: 'rating', pattern: /1: Bad 2: Fine 3: Good (4: Unsure )?0: Dismiss/, keys: (m: RegExpExecArray) => (m[1] ? ['0', '1', '2', '3', '4'] : ['0', '1', '2', '3']) },
  // "Can Anthropic look at your session transcript to help us improve Claude Code?" (lower-cased by claude)
  { id: 'transcript', pattern: /y: Yes n: No d: Don't ask again/, keys: () => ['y', 'n', 'd', 'Y', 'N', 'D'] },
  // "Why bypass permissions instead of auto mode?"
  { id: 'bypass-reason', pattern: /1: Auto mode blocks safe work 2: Auto mode is too slow 3: Unattended runs 4: Sandboxed setup 5: Other 0: Not now/, keys: () => ['0', '1', '2', '3', '4', '5'] },
])

/** claude ignores a key for 600 ms after the survey appears (it stays in the input box); + margin. */
export const SINGLE_KEY_PROMPT_SETTLE_MS = 1_000
/** A survey seen longer ago than this no longer counts (the record may be stale). */
export const SINGLE_KEY_PROMPT_MAX_AGE_MS = 30 * 60_000
/** After a key, the survey's legend in this much output (claude's echo frame) is not recorded again. */
export const SINGLE_KEY_PROMPT_REARM_MS = 2_000
/** Raw output kept between chunks (a legend split over two chunks). */
const SCAN_TAIL_CHARS = 2_048
/** A chunk without any of these needs no normalising (cheap pre-check). */
const LEGEND_ANCHORS = /Dismiss|Don|Not/

/**
 * Screen text from raw PTY output, good enough to find a legend: OSC / other escapes dropped, cursor
 * moves (claude writes spaces as `CSI n C`) and control characters as a space, spaces collapsed.
 */
export function normalizeScreenText(raw: string): string {
  return raw
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*([@-~])/g, (_m, final: string) => ('ABCDEFGHfd'.includes(final) ? ' ' : ''))
    .replace(/\x1b[^[\]]?/g, '')
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
}

/** The single-key survey whose legend is in `text` (normalised), or null. */
export function findSingleKeyPrompt(text: string): { legend: string; keys: readonly string[] } | null {
  for (const legend of SINGLE_KEY_PROMPT_LEGENDS) {
    const match = legend.pattern.exec(text)
    if (match) return { legend: legend.id, keys: legend.keys(match) }
  }
  return null
}

export interface SingleKeyPromptRecord {
  legend: string
  keys: readonly string[]
  /** When its legend was first seen (ms; the caller's clock). */
  shownAt: number
}

/**
 * Per tab: the single-key survey last seen in the output and not followed by any write yet. Pure
 * state, the caller gives the time. `take` / `drop` on every write into the tab (condition ④).
 */
export class SingleKeyPromptScanner {
  private readonly tails = new Map<string, string>()
  private readonly shown = new Map<string, SingleKeyPromptRecord>()
  private readonly rearmAt = new Map<string, number>()

  /** Output of tab `id`; returns the record when a survey was newly recorded. */
  scan(id: string, data: string, now: number): SingleKeyPromptRecord | null {
    if (typeof data !== 'string' || data.length === 0) return null
    const raw = (this.tails.get(id) ?? '') + data
    const found = LEGEND_ANCHORS.test(raw) ? findSingleKeyPrompt(normalizeScreenText(raw)) : null
    if (!found) {
      this.tails.set(id, raw.length > SCAN_TAIL_CHARS ? raw.slice(-SCAN_TAIL_CHARS) : raw)
      return null
    }
    this.tails.delete(id)
    const rearm = this.rearmAt.get(id)
    if (rearm !== undefined && now < rearm) return null
    this.rearmAt.delete(id)
    const current = this.shown.get(id)
    if (current && current.legend === found.legend) return null // a redraw: keep when it appeared
    const record: SingleKeyPromptRecord = { legend: found.legend, keys: found.keys, shownAt: now }
    this.shown.set(id, record)
    return record
  }

  /** The user's write to tab `id`: returns the record (if any) and forgets it. */
  take(id: string, now: number): SingleKeyPromptRecord | null {
    const record = this.shown.get(id) ?? null
    this.shown.delete(id)
    this.tails.delete(id)
    this.rearmAt.set(id, now + SINGLE_KEY_PROMPT_REARM_MS)
    return record
  }

  /** Any other write to tab `id` (helper, answer, BAT's own, a mouse press): forget the record. */
  drop(id: string): void {
    this.shown.delete(id)
    this.tails.delete(id)
  }

  has(id: string): boolean {
    return this.shown.has(id)
  }

  forget(id: string): void {
    this.shown.delete(id)
    this.tails.delete(id)
    this.rearmAt.delete(id)
  }

  clear(): void {
    this.shown.clear()
    this.tails.clear()
    this.rearmAt.clear()
  }
}

/**
 * 案 B: did the user's `data` answer the survey `record` (so the input box stays empty)? All of: no
 * draft before (not in a paste); exactly one key the survey takes; the survey shown at least
 * `SINGLE_KEY_PROMPT_SETTLE_MS` and at most `SINGLE_KEY_PROMPT_MAX_AGE_MS` ago. Otherwise false
 * (`trackDraft` decides, as before).
 */
export function answersSingleKeyPrompt(record: SingleKeyPromptRecord | null, prev: DraftState, data: string, now: number): boolean {
  if (!record || prev.draft || prev.inPaste) return false
  if (!record.keys.includes(data)) return false
  const age = now - record.shownAt
  return age >= SINGLE_KEY_PROMPT_SETTLE_MS && age <= SINGLE_KEY_PROMPT_MAX_AGE_MS
}
