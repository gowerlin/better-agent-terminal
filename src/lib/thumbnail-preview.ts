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
    // CSI sequences: \x1b[ followed by params and command char
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
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

/** Preview of PTY output: the previous preview plus the new raw output, escape sequences removed. */
export function outputPreview(raw: string): string {
  return lastLines(stripAnsi(tailPreviewInput(raw)))
}

/** Preview of Claude agent text (a message, or the previous preview plus streamed text); no ANSI. */
export function textPreview(text: string): string {
  return lastLines(tailPreviewInput(text))
}
