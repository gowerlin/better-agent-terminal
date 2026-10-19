/**
 * BUG-166 / T0672: mouse reports a shell types into its command line (the program that tracked the
 * mouse ended without turning tracking off) are recognised so the tab can turn tracking off.
 * Echo forms measured in T0671: bash `^G35;52;69M`, zsh 5.9 `35;52;69M` (with `3^H35;…` redraws).
 */
import { describe, expect, test } from 'vitest'
import {
  ALT_SCREEN_EXIT,
  echoMatchText,
  MOUSE_REPORT_ECHO_WINDOW_MS,
  MOUSE_TRACKING_RESET,
  MouseReportEchoDetector,
  sgrMouseReportBodies,
} from '../mouse-tracking-reset'

const move = (x: number, y: number) => `\x1b[<35;${x};${y}M`

describe('sequences', () => {
  test('the reset turns off every mouse mode and nothing else', () => {
    expect(MOUSE_TRACKING_RESET).toBe('\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1015l\x1b[?1016l')
    expect(MOUSE_TRACKING_RESET).not.toContain('1049')
    expect(ALT_SCREEN_EXIT).toBe('\x1b[?1049l')
    expect(MOUSE_REPORT_ECHO_WINDOW_MS).toBe(500)
  })
})

describe('sgrMouseReportBodies', () => {
  test('press / release / move / wheel reports; other input has none', () => {
    expect(sgrMouseReportBodies(move(52, 69))).toEqual(['35;52;69M'])
    expect(sgrMouseReportBodies('\x1b[<0;3;4m')).toEqual(['0;3;4m'])
    expect(sgrMouseReportBodies(`\x1b[<64;39;3M${move(1, 2)}`)).toEqual(['64;39;3M', '35;1;2M'])
    for (const data of ['a', '\r', '\x1b[A', '\x1b[M #!', '35;52;69M', '\x1b[I']) expect(sgrMouseReportBodies(data)).toEqual([])
  })
})

describe('echoMatchText', () => {
  test('control characters and escape sequences go', () => {
    expect(echoMatchText('\x0735;52;69M')).toBe('35;52;69M')
    expect(echoMatchText('3\x0835;52;69M')).toBe('335;52;69M')
    expect(echoMatchText('\x1b[1m35;52\x1b[0m;69M\x1b[K')).toBe('35;52;69M')
    expect(echoMatchText('\x1b]0;title\x0735;52;69M')).toBe('35;52;69M')
    expect(echoMatchText('\x1b[48;2;0;52;69mtext')).toBe('text')
  })
})

describe('MouseReportEchoDetector', () => {
  test('bash: the report comes back after a BEL → found', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(52, 69), 1000, true)
    expect(d.noteOutput('\x0735;52;69M', 1010, true)).toBe(true)
  })

  test('zsh: backspace redraw between the characters → found', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(52, 69), 1000, true)
    expect(d.noteOutput('3\x0835;52;69M', 1005, true)).toBe(true)
  })

  test('a wheel report echoed among others → found', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput('\x1b[<64;39;3M', 1000, true)
    expect(d.noteOutput('\x1b[?2004h~/proj ❯ 64;39;3M', 1020, true)).toBe(true)
  })

  test('the echo split over several output chunks → found on the chunk that completes it', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(52, 69), 1000, true)
    expect(d.noteOutput('\x07', 1001, true)).toBe(false)
    expect(d.noteOutput('35;5', 1002, true)).toBe(false)
    expect(d.noteOutput('2;6', 1003, true)).toBe(false)
    expect(d.noteOutput('9M', 1004, true)).toBe(true)
  })

  test('an escape sequence split over chunks still counts as one', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(52, 69), 1000, true)
    expect(d.noteOutput('35;52\x1b[3', 1001, true)).toBe(false)
    expect(d.noteOutput('2m;69M', 1002, true)).toBe(true)
  })

  test('different output → not found', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(52, 69), 1000, true)
    expect(d.noteOutput('35;52;70M', 1010, true)).toBe(false)
    expect(d.noteOutput('hello world\r\n', 1020, true)).toBe(false)
  })

  test('the echo after the time window → not found', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(52, 69), 1000, true)
    expect(d.noteOutput('35;52;69M', 1000 + MOUSE_REPORT_ECHO_WINDOW_MS + 1, true)).toBe(false)
  })

  test('at the edge of the window → found', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(52, 69), 1000, true)
    expect(d.noteOutput('35;52;69M', 1000 + MOUSE_REPORT_ECHO_WINDOW_MS, true)).toBe(true)
  })

  test('output before any report is not kept: the text seen earlier does not count', () => {
    const d = new MouseReportEchoDetector()
    expect(d.noteOutput('35;52;69M', 900, true)).toBe(false)
    d.noteInput(move(52, 69), 1000, true)
    expect(d.noteOutput('prompt$ ', 1010, true)).toBe(false)
  })

  test('tracking off: reports are not noted and output never matches', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(52, 69), 1000, false)
    expect(d.noteOutput('35;52;69M', 1010, true)).toBe(false)
    d.noteInput(move(52, 69), 1100, true)
    expect(d.noteOutput('35;52;69M', 1110, false)).toBe(false)
    // tracking went off in between: what was noted is gone
    expect(d.noteOutput('35;52;69M', 1120, true)).toBe(false)
  })

  test('an agent running (reports read, not echoed): its redraws never match', () => {
    const d = new MouseReportEchoDetector()
    let now = 1000
    for (let i = 0; i < 200; i++) {
      d.noteInput(move(10 + (i % 50), 5 + (i % 20)), now, true)
      now += 16
      if (i % 5 === 0) {
        const redraw = `\x1b[?2026h\x1b[${(i % 20) + 1};1H\x1b[38;2;35;52;69m› working (${i}s)\x1b[0m\x1b[K\x1b[?2026l`
        expect(d.noteOutput(redraw, now, true)).toBe(false)
      }
    }
  })

  test('after a match it starts over', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(52, 69), 1000, true)
    expect(d.noteOutput('35;52;69M', 1010, true)).toBe(true)
    expect(d.noteOutput('35;52;69M', 1020, true)).toBe(false)
  })

  test('clear() forgets the reports', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(52, 69), 1000, true)
    d.clear()
    expect(d.noteOutput('35;52;69M', 1010, true)).toBe(false)
  })

  test('only the most recent reports are remembered', () => {
    const d = new MouseReportEchoDetector()
    d.noteInput(move(1, 1), 1000, true)
    for (let i = 0; i < 64; i++) d.noteInput(move(100 + i, 2), 1001, true)
    expect(d.noteOutput('35;1;1M', 1010, true)).toBe(false)
    d.noteInput(move(1, 1), 1020, true)
    expect(d.noteOutput('35;1;1M', 1030, true)).toBe(true)
  })
})
