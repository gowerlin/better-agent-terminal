/**
 * T0940 / BUG-227 (D406): keys that never stay in the Tower's input box do not make a draft
 * (src/lib/tower-input-draft.ts).
 *
 *   - 案 A `trackDraftDuringPrompt`: while a hook / osc prompt is shown, one key leaves the draft as it
 *     was (not set, not cleared); a paste or several characters is tracked as before
 *   - 案 B claude's single-key surveys (claude 2.1.331): the legend in the PTY output is recorded;
 *     exactly one valid key, no draft before, shown 1 s – 30 min ago → no draft
 */
import { describe, expect, test } from 'vitest'
import {
  NO_DRAFT,
  SINGLE_KEY_PROMPT_MAX_AGE_MS,
  SINGLE_KEY_PROMPT_REARM_MS,
  SINGLE_KEY_PROMPT_SETTLE_MS,
  SingleKeyPromptScanner,
  answersSingleKeyPrompt,
  findSingleKeyPrompt,
  isSingleKeyInput,
  normalizeScreenText,
  trackDraft,
  trackDraftDuringPrompt,
  type DraftState,
  type SingleKeyPromptRecord,
} from '../tower-input-draft'

const ESC = '\x1b'
const DRAFT: DraftState = { draft: true, inPaste: false }

/**
 * claude 2.1.331's rating survey as a Windows ConPTY wrote it (T0939 S1 M-3, cut down to the survey
 * lines; colours kept, nothing identifying): spaces partly as `CSI 1 C`, the legend after a cursor
 * position, the input row's cursor / mode sequences after it.
 */
const RATING_SURVEY =
  `${ESC}[38;2;177;185;249m●${ESC}[m${ESC}[1m${ESC}[1CHow is Claude doing this session? (optional)${ESC}[22m      ` +
  `${ESC}[38;2;177;185;249m${ESC}[30;3H1${ESC}[m:${ESC}[1CBad    ${ESC}[38;2;177;185;249m2${ESC}[m: Fine   ` +
  `${ESC}[38;2;177;185;249m3${ESC}[m: Good   ${ESC}[38;2;177;185;249m0${ESC}[m: Dismiss        ` +
  `${ESC}[33;3H${ESC}[?25h${ESC}[?2004h${ESC}[?1000h${ESC}[?1002h${ESC}[?1003h${ESC}[?1006h`

describe('isSingleKeyInput', () => {
  test.each([
    ['a digit', '0'],
    ['a letter', 'y'],
    ['a CJK character', '你'],
    ['Enter', '\r'],
    ['Esc', ESC],
    ['Tab', '\t'],
    ['Backspace', '\x7f'],
    ['Ctrl+C', '\x03'],
    ['↓', `${ESC}[B`],
    ['↑ (application mode)', `${ESC}OA`],
    ['Alt+Enter', `${ESC}\r`],
    ['Shift+Tab', `${ESC}[Z`],
    ['Delete', `${ESC}[3~`],
    ['an SGR mouse press', `${ESC}[<0;10;5M`],
    ['an X10 mouse report', `${ESC}[M !!`],
  ])('%s is one key', (_name, data) => {
    expect(isSingleKeyInput(data)).toBe(true)
  })

  test.each([
    ['two characters', '12'],
    ['a word', 'abc'],
    ['an IME commit', '你好'],
    ['text and Enter', 'a\r'],
    ['two arrows at once', `${ESC}[B${ESC}[B`],
    ['a bracketed paste', `${ESC}[200~1${ESC}[201~`],
    ['the paste start alone', `${ESC}[200~`],
    ['empty', ''],
  ])('%s is not', (_name, data) => {
    expect(isSingleKeyInput(data)).toBe(false)
  })
})

describe('案 A: one key while a hook / osc prompt is shown', () => {
  test('a key does not set a draft (a digit answers a permission prompt)', () => {
    expect(trackDraftDuringPrompt(NO_DRAFT, '1')).toEqual(NO_DRAFT)
    expect(trackDraftDuringPrompt(NO_DRAFT, `${ESC}[B`)).toEqual(NO_DRAFT)
    expect(trackDraftDuringPrompt(NO_DRAFT, 'y')).toEqual(NO_DRAFT)
  })

  test('Enter / Esc / Ctrl+C do not clear a draft typed before the prompt', () => {
    expect(trackDraftDuringPrompt(DRAFT, '\r')).toEqual(DRAFT)
    expect(trackDraftDuringPrompt(DRAFT, ESC)).toEqual(DRAFT)
    expect(trackDraftDuringPrompt(DRAFT, '\x03')).toEqual(DRAFT)
  })

  test('a paste still makes a draft (the prompt may be stale)', () => {
    expect(trackDraftDuringPrompt(NO_DRAFT, `${ESC}[200~text${ESC}[201~`)).toEqual(DRAFT)
  })

  test('several characters at once still make a draft', () => {
    expect(trackDraftDuringPrompt(NO_DRAFT, 'hello')).toEqual(DRAFT)
    expect(trackDraftDuringPrompt(NO_DRAFT, '你好')).toEqual(DRAFT)
  })

  test('the inside of an open paste is tracked as before', () => {
    const open = trackDraft(NO_DRAFT, `${ESC}[200~part`)
    expect(trackDraftDuringPrompt(open, '\r')).toEqual(trackDraft(open, '\r'))
  })
})

describe('案 B: finding a single-key survey in the output', () => {
  test('normalising: escapes dropped, cursor moves and controls as one space', () => {
    expect(normalizeScreenText(`a${ESC}[1Cb${ESC}[31mc${ESC}[2;3Hd\r\ne${ESC}]0;title\x07f`)).toBe('a bc d ef')
  })

  test('the T0939 rating survey', () => {
    expect(findSingleKeyPrompt(normalizeScreenText(RATING_SURVEY))).toEqual({ legend: 'rating', keys: ['0', '1', '2', '3'] })
  })

  test('with Unsure the survey takes 4 too', () => {
    expect(findSingleKeyPrompt('1: Bad 2: Fine 3: Good 4: Unsure 0: Dismiss')).toEqual({ legend: 'rating', keys: ['0', '1', '2', '3', '4'] })
  })

  test('the transcript prompt (y / n / d) and the bypass-reason survey (0–5)', () => {
    expect(findSingleKeyPrompt("y: Yes n: No d: Don't ask again")?.legend).toBe('transcript')
    expect(findSingleKeyPrompt('1: Auto mode blocks safe work 2: Auto mode is too slow 3: Unattended runs 4: Sandboxed setup 5: Other 0: Not now'))
      .toEqual({ legend: 'bypass-reason', keys: ['0', '1', '2', '3', '4', '5'] })
  })

  test.each([
    ['the title alone', 'How is Claude doing this session? (optional)'],
    ['a shortened legend in a document', 'How is Claude doing … 1/2/3/0: Dismiss'],
    ['plain text', 'nothing to see here'],
  ])('%s is not a survey', (_name, text) => {
    expect(findSingleKeyPrompt(text)).toBeNull()
  })

  test('the scanner records it once; a redraw keeps when it appeared', () => {
    const scanner = new SingleKeyPromptScanner()
    expect(scanner.scan('t', RATING_SURVEY, 1_000)).toMatchObject({ legend: 'rating', shownAt: 1_000 })
    expect(scanner.scan('t', RATING_SURVEY, 5_000)).toBeNull()
    expect(scanner.take('t', 6_000)).toMatchObject({ shownAt: 1_000 })
  })

  test('a legend split over two chunks', () => {
    const scanner = new SingleKeyPromptScanner()
    const cut = RATING_SURVEY.indexOf('Good')
    expect(scanner.scan('t', RATING_SURVEY.slice(0, cut), 1_000)).toBeNull()
    expect(scanner.scan('t', RATING_SURVEY.slice(cut), 1_010)).toMatchObject({ legend: 'rating', shownAt: 1_010 })
  })

  test('take / drop forget it; take does not record claude\'s echo frame again for a moment', () => {
    const scanner = new SingleKeyPromptScanner()
    scanner.scan('t', RATING_SURVEY, 1_000)
    expect(scanner.take('t', 3_000)).not.toBeNull()
    expect(scanner.take('t', 3_001)).toBeNull() // every write re-arms the pause
    expect(scanner.scan('t', RATING_SURVEY, 3_001 + SINGLE_KEY_PROMPT_REARM_MS - 1)).toBeNull()
    expect(scanner.scan('t', RATING_SURVEY, 3_001 + SINGLE_KEY_PROMPT_REARM_MS)).not.toBeNull()
    scanner.drop('t')
    expect(scanner.has('t')).toBe(false)
  })

  test('tabs are separate', () => {
    const scanner = new SingleKeyPromptScanner()
    scanner.scan('a', RATING_SURVEY, 1_000)
    expect(scanner.has('a')).toBe(true)
    expect(scanner.has('b')).toBe(false)
  })
})

describe('案 B: does the key answer the survey?', () => {
  const record: SingleKeyPromptRecord = { legend: 'rating', keys: ['0', '1', '2', '3'], shownAt: 10_000 }
  const later = 10_000 + SINGLE_KEY_PROMPT_SETTLE_MS

  test('a valid key, no draft, shown ≥ 1 s ago → answered', () => {
    for (const key of ['0', '1', '2', '3']) expect(answersSingleKeyPrompt(record, NO_DRAFT, key, later)).toBe(true)
  })

  test.each([
    ['no survey', null, NO_DRAFT, '0', later],
    ['a key the survey does not take', record, NO_DRAFT, '5', later],
    ['two keys', record, NO_DRAFT, '01', later],
    ['shown < 1 s ago (claude leaves it in the input box)', record, NO_DRAFT, '0', later - 1],
    ['shown > 30 min ago', record, NO_DRAFT, '0', 10_000 + SINGLE_KEY_PROMPT_MAX_AGE_MS + 1],
    ['a draft before (the key joins it)', record, DRAFT, '0', later],
    ['inside a paste', record, { draft: false, inPaste: true }, '0', later],
  ])('%s → not answered', (_name, rec, prev, data, now) => {
    expect(answersSingleKeyPrompt(rec as SingleKeyPromptRecord | null, prev as DraftState, data as string, now as number)).toBe(false)
  })
})
