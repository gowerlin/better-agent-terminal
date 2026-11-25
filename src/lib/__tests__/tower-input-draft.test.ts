/**
 * PLAN-068 W2 / T0904 (T0902 S1): the conservative guess of "the Tower's input box holds the user's
 * unsent text" from the bytes the user sends (src/lib/tower-input-draft.ts).
 */
import { describe, expect, test } from 'vitest'
import { NO_DRAFT, trackDraft, type DraftState } from '../tower-input-draft'

const ESC = '\x1b'

/** Feeds chunks one after another. */
function feed(...chunks: string[]): DraftState {
  return chunks.reduce((state, chunk) => trackDraft(state, chunk), NO_DRAFT)
}

describe('what makes a draft', () => {
  test.each([
    ['a letter', 'a'],
    ['CJK text (IME commit)', '你好'],
    ['Tab', '\t'],
    ['Ctrl+J / \\n (a new line in the input)', '\n'],
    ['Alt+Enter (a new line in claude)', `${ESC}\r`],
    ['Alt+key', `${ESC}b`],
    ['↑ (history)', `${ESC}[A`],
    ['↓ (history)', `${ESC}[B`],
    ['↑ in application mode', `${ESC}OA`],
    ['Shift+Enter as CSI u', `${ESC}[13;2u`],
    ['F5 (unknown key)', `${ESC}[15~`],
  ])('%s', (_name, data) => {
    expect(feed(data).draft).toBe(true)
  })

  test('a bracketed paste is a draft — its `\\r` does not send it', () => {
    expect(feed(`${ESC}[200~line 1\rline 2${ESC}[201~`)).toEqual({ draft: true, inPaste: false })
  })

  test('a paste split over two writes stays a paste', () => {
    const state = feed(`${ESC}[200~part 1\r`, `part 2${ESC}[201~`)
    expect(state).toEqual({ draft: true, inPaste: false })
  })
})

describe('what clears it', () => {
  test('Enter', () => {
    expect(feed('abc', '\r').draft).toBe(false)
    expect(feed('abc\r').draft).toBe(false)
  })

  test('Ctrl+C', () => {
    expect(feed('abc', '\x03').draft).toBe(false)
  })

  test('text after Enter in the same write is a new draft', () => {
    expect(feed('abc\rde').draft).toBe(true)
  })

  test('Enter after a paste sends it', () => {
    expect(feed(`${ESC}[200~text${ESC}[201~`, '\r').draft).toBe(false)
  })
})

describe('what leaves it as it was', () => {
  test.each([
    ['a lone Esc (interrupts the agent)', ESC],
    ['← / →', `${ESC}[D${ESC}[C`],
    ['Home / End', `${ESC}[H${ESC}[F`],
    ['PageUp / PageDown / Delete', `${ESC}[5~${ESC}[6~${ESC}[3~`],
    ['focus in / out reports', `${ESC}[I${ESC}[O`],
    ['an SGR mouse report', `${ESC}[<64;10;5M`],
    ['an X10 mouse report', `${ESC}[M\x60!!`],
    ['a cursor position report', `${ESC}[12;5R`],
    ['Backspace (0x7f)', '\x7f'],
    ['Ctrl+L', '\x0c'],
  ])('%s', (_name, data) => {
    expect(feed(data).draft).toBe(false)
    expect(feed('abc', data).draft).toBe(true)
  })
})

test('pure: the previous state is not changed', () => {
  const prev: DraftState = { draft: false, inPaste: false }
  trackDraft(prev, 'abc')
  expect(prev).toEqual({ draft: false, inPaste: false })
})
