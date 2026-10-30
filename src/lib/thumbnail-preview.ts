/**
 * T0667 (BUG-136 hypothesis C): the text a terminal thumbnail shows (`.thumbnail-preview`, the
 * last few lines of the tab's output), with a size limit on both ends. Used by
 * src/components/TerminalThumbnail.tsx for PTY output and for Claude agent messages / streams.
 * No `electron` / DOM import.
 *
 * Before T0667 the preview was only cut at `\n` (`split('\n').slice(-8)`). Codex draws its alt
 * screen with `CSI row;col H` and on Linux / macOS PTYs sends almost no `\n` (T0666, WSL: 145 KB of
 * output, 0 `\n`), so the preview kept everything the tab ever printed: every 150 ms flush re-ran
 * stripAnsi over all of it and React wrote it into one `white-space: pre` text node, even for a tab
 * that is not active (T0666: 1 MiB = 5.5 ms of JS; DOM layout 1 M chars = 126 ms, 4 M = 512 ms).
 * Windows ConPTY inserts `\n`, so Windows never showed it.
 *
 * Limits:
 *   input   PREVIEW_INPUT_TAIL_CHARS (16 Ki)   raw output kept before stripAnsi; the cut starts at
 *                                              an ESC or after a `\n` (never inside a sequence)
 *   output  PREVIEW_LINES (8) × PREVIEW_LINE_MAX_CHARS (256)  → PREVIEW_MAX_CHARS (2055)
 *
 * T0714 (BUG-175): with the size bounded, such output still showed only the first 256 characters
 * of one endless line, so the preview stayed on the startup screen. Lines now also break where the
 * cursor moves to another row, and the preview restarts at a screen clear / alt screen switch
 * (markScreenMoves below); stripAnsi removes every CSI (it left `>0q` of `CSI > 0 q`).
 */

/** Lines the thumbnail shows (unchanged from before T0667). */
export const PREVIEW_LINES = 8

/**
 * Characters kept per preview line. The thumbnail is ~30 characters wide (9px monospace in a
 * sidebar thumbnail, `overflow: hidden`), so 256 keeps 8× what is visible; with 8 lines the
 * whole preview stays at about 2 KiB.
 */
export const PREVIEW_LINE_MAX_CHARS = 256

/** Upper bound of a preview: 8 lines of 256 characters plus 7 `\n`. */
export const PREVIEW_MAX_CHARS = PREVIEW_LINES * PREVIEW_LINE_MAX_CHARS + (PREVIEW_LINES - 1)

/**
 * Raw output kept before stripAnsi. 8 lines of 256 characters are 2 Ki; a full-screen redraw
 * carries several escape sequences per visible character (`CSI row;col H` + SGR), so 16 Ki leaves
 * room for the visible text of the latest redraw while keeping one flush well under a millisecond.
 */
export const PREVIEW_INPUT_TAIL_CHARS = 16 * 1024

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff

/**
 * The last `max` characters of `raw`, cut so the result does not start inside an escape sequence
 * or a line: it starts at the first ESC in the window, or right after the first `\n`, whichever
 * comes first. A window with neither keeps the plain cut (without a leading half surrogate pair).
 */
export function tailPreviewInput(raw: string, max: number = PREVIEW_INPUT_TAIL_CHARS): string {
  if (raw.length <= max) return raw
  const window = raw.slice(raw.length - max)
  const esc = window.indexOf('\x1b')
  const nl = window.indexOf('\n')
  if (esc >= 0 && (nl < 0 || esc < nl)) return window.slice(esc)
  if (nl >= 0) return window.slice(nl + 1)
  return isLowSurrogate(window.charCodeAt(0)) ? window.slice(1) : window
}

/**
 * Append new output to what is waiting for the next flush. Trims only when the text is twice the
 * input limit, so many small chunks cost O(1) per character instead of one trim per chunk;
 * `outputPreview` / `textPreview` trim to the exact limit at flush time.
 */
export function appendPreviewInput(pending: string, data: string): string {
  const combined = pending + data
  return combined.length > 2 * PREVIEW_INPUT_TAIL_CHARS ? tailPreviewInput(combined) : combined
}

// Strip all ANSI escape sequences and problematic characters
export const stripAnsi = (str: string): string => {
  return str
    // CSI sequences (ECMA-48): \x1b[, parameter bytes 0x30–0x3F (digits ; : < = > ?), intermediate
    // bytes 0x20–0x2F, final byte 0x40–0x7E. T0714: before, only `[0-9;?]` params and a letter
    // final were removed, so `CSI > 0 q` / `CSI > 4 ; 2 m` / `CSI 2 SP q` left `>0q` / `>4;2m` / ` q`.
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    // OSC sequences: \x1b] ... (terminated by BEL \x07 or ST \x1b\\)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Other escape sequences: \x1b followed by single char
    .replace(/\x1b[()][AB012]/g, '')
    .replace(/\x1b[=>]/g, '')
    // DCS, PM, APC sequences
    .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, '')
    // Bell character
    .replace(/\x07/g, '')
    // Carriage return (often used for overwriting lines)
    .replace(/\r/g, '')
    // Any remaining single-char escapes
    .replace(/\x1b./g, '')
    // Private Use Area characters (Powerline, Nerd Fonts icons) - causes box characters
    .replace(/[-]/g, '')
    // Braille patterns (often used for terminal graphics)
    .replace(/[⠀-⣿]/g, '')
    // Box drawing characters that may not render well at small sizes
    .replace(/[─-╿]/g, '')
}

/*
 * T0714 (BUG-175): cursor moves. A full-screen TUI on a Linux / macOS PTY (claude, codex) redraws
 * with cursor moves and no `\n` (T0714, claude 2.1.287 REPL on a WSL PTY: 0 `\n` after the alt
 * screen switch), so the preview was one endless line whose first 256 characters (the startup
 * screen) never changed. markScreenMoves runs before stripAnsi and leaves three markers
 * (noncharacters, so they never come from the output itself):
 *   SOFT_BREAK        text written after the cursor moved to another row starts a new line
 *   UPDATE_IN_PLACE   the same, but the text is short and starts past column 1: an in-place update
 *                     of a row (a diff renderer rewriting a timer, a counter, a spinner frame); it is
 *                     dropped, or every tick would become a preview line
 *   SCREEN_RESET      `CSI 2 J` / alt screen switch: the preview restarts after it
 * A break is placed only before visible text, so a move with nothing written after it, or followed
 * by a `\n`, adds no line: output that changes rows only with `\n` (a shell, most Windows ConPTY
 * output) keeps the same lines as before. This is not a terminal model: rows and columns are
 * tracked only to tell these cases apart (widths are not measured), nothing is overwritten, and
 * nothing is kept across flushes.
 */
const SOFT_BREAK = '\uFDD0'
const UPDATE_IN_PLACE = '\uFDD1'
const SCREEN_RESET = '\uFDD2'
const MARKER_RE = /[\uFDD0\uFDD1]/g

/** Visible characters fewer than this, written past column 1 of a new row, are an in-place update. */
export const IN_PLACE_UPDATE_MAX_CHARS = 8

/**
 * In order: CSI (params, intermediates, final); OSC / DCS / SOS / PM / APC up to its terminator;
 * any other ESC sequence; `\n`, `\r`, BS; a run of text.
 */
const SCREEN_TOKEN_RE = /\x1b\[([0-?]*)([ -/]*)([@-~])|\x1b[\]PX^_][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[ -/]*[0-~]|[\n\r\x08]|[^\x1b\n\r\x08]+/g

/** Characters stripAnsi removes or that show nothing; text without anything else is not visible. */
const INVISIBLE_RE = /[\x00-\x20\x7f\u00a0\uE000-\uF8FF\u2800-\u28FF\u2500-\u257F]/g

/** DEC private modes that switch to or from the alternate screen. */
const ALT_SCREEN_MODES = new Set(['?47', '?1047', '?1049'])

/**
 * Adds SOFT_BREAK / UPDATE_IN_PLACE / SCREEN_RESET (see above) and leaves every escape sequence for
 * stripAnsi. Row and column start unknown in every pass. A `CSI row;col H` with column > 1 while the
 * row is unknown is taken as a jump within the current line (ConPTY re-draws a PSReadLine prompt
 * line that way), so it breaks nothing, as before T0714.
 */
function markScreenMoves(raw: string): string {
  let row: number | null = null
  let col: number | null = null
  let moved = false // the cursor went to another row and no visible text was written since
  const toRow = (to: number | null) => {
    if (to === null || to !== row) moved = true
    row = to
  }
  return raw.replace(SCREEN_TOKEN_RE, (token: string, params?: string, intermediates?: string, final?: string) => {
    if (final !== undefined) {
      if (intermediates) return token
      if (ALT_SCREEN_MODES.has(params!) && (final === 'h' || final === 'l')) {
        row = col = null
        moved = false
        return SCREEN_RESET
      }
      if (!/^[0-9;]*$/.test(params!)) return token // other private sequences (`?`, `>`, `<`, `=`)
      const n = parseInt(params!, 10) // the first parameter
      const count = n > 0 ? n : 1
      switch (final) {
        case 'H': case 'f': { // CUP / HVP
          const semi = params!.indexOf(';')
          const toCol = semi < 0 ? 1 : Math.max(parseInt(params!.slice(semi + 1), 10) || 1, 1)
          if (row === null && toCol > 1) row = count
          else toRow(count)
          col = toCol
          break
        }
        case 'd': toRow(count); break // VPA
        case 'A': toRow(row === null ? null : row - count); break // CUU
        case 'B': toRow(row === null ? null : row + count); break // CUD
        case 'E': toRow(row === null ? null : row + count); col = 1; break // CNL
        case 'F': toRow(row === null ? null : row - count); col = 1; break // CPL
        case 'G': case '`': col = count; break // CHA / HPA
        case 'C': if (col !== null) col += count; break // CUF
        case 'D': if (col !== null) col = Math.max(col - count, 1); break // CUB
        case 'J':
          if (n !== 2) break
          moved = false
          return SCREEN_RESET
      }
      return token
    }
    switch (token[0]) {
      case '\x1b':
        switch (token[1]) {
          case 'D': toRow(row === null ? null : row + 1); break // IND
          case 'E': toRow(row === null ? null : row + 1); col = 1; break // NEL
          case 'M': toRow(row === null ? null : row - 1); break // RI
          case '8': row = col = null; break // DECRC
        }
        return token
      case '\n':
        if (row !== null) row++
        moved = false // the `\n` itself ends the line
        return token
      case '\r':
        col = 1
        return token
      case '\x08':
        if (col !== null && col > 1) col--
        return token
    }
    const visible = token.replace(INVISIBLE_RE, '').length
    const startCol = col
    if (col !== null) col += token.length
    if (!moved) return token
    if (visible === 0) return '' // blank padding on the new row
    moved = false
    const inPlace = startCol !== null && startCol > 1 && visible < IN_PLACE_UPDATE_MAX_CHARS
    return (inPlace ? UPDATE_IN_PLACE : SOFT_BREAK) + token
  })
}

/**
 * Turns the markers into lines: the preview restarts after the last SCREEN_RESET, SOFT_BREAK starts
 * a new line (unless one just started), UPDATE_IN_PLACE drops the text up to the next marker or `\n`.
 */
function applyScreenMoves(text: string): string {
  const reset = text.lastIndexOf(SCREEN_RESET)
  if (reset >= 0) text = text.slice(reset + 1)
  if (!text.includes(SOFT_BREAK) && !text.includes(UPDATE_IN_PLACE)) return text
  let out = ''
  let start = 0
  let marker = ''
  for (const m of text.matchAll(MARKER_RE)) {
    out = appendPiece(out, marker, text.slice(start, m.index))
    marker = m[0]
    start = m.index + 1
  }
  return appendPiece(out, marker, text.slice(start))
}

function appendPiece(out: string, marker: string, piece: string): string {
  if (marker === UPDATE_IN_PLACE) {
    const nl = piece.indexOf('\n')
    return nl < 0 ? out : out + piece.slice(nl)
  }
  if (marker === SOFT_BREAK && out !== '' && !out.endsWith('\n')) return out + '\n' + piece
  return out + piece
}

/** The first PREVIEW_LINE_MAX_CHARS characters of a line (the part the thumbnail shows). */
function capLine(line: string): string {
  if (line.length <= PREVIEW_LINE_MAX_CHARS) return line
  const end = isHighSurrogate(line.charCodeAt(PREVIEW_LINE_MAX_CHARS - 1)) ? PREVIEW_LINE_MAX_CHARS - 1 : PREVIEW_LINE_MAX_CHARS
  return line.slice(0, end)
}

/** The last PREVIEW_LINES lines of plain text, each capped; at most PREVIEW_MAX_CHARS long. */
function lastLines(text: string): string {
  return text.split('\n').slice(-PREVIEW_LINES).map(capLine).join('\n')
}

/**
 * Preview of PTY output: the previous preview plus the new raw output, escape sequences removed,
 * restarted after the last screen clear / alt screen switch, cursor moves to another row as line
 * breaks (T0714).
 */
export function outputPreview(raw: string): string {
  return lastLines(applyScreenMoves(stripAnsi(markScreenMoves(tailPreviewInput(raw)))))
}

/** Preview of Claude agent text (a message, or the previous preview plus streamed text); no ANSI. */
export function textPreview(text: string): string {
  return lastLines(tailPreviewInput(text))
}
