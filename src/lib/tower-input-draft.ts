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
