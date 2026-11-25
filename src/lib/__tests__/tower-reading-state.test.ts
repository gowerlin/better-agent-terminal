/**
 * PLAN-068 W2 / T0904 (T0902 §2.4 `reading`): the renderer's "the user reads this Tower tab" signal
 * (src/lib/tower-reading-state.ts) — reported only on a change, only while enabled (contract 2),
 * and still reading `TOWER_READING_LINGER_MS` after the last signal ended.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TOWER_READING_LINGER_MS, TowerReadingTracker, isModifierOnlyKey, wheelRows } from '../tower-reading-state'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function setup(enabled = true) {
  const reports: boolean[] = []
  const altEvents: string[] = []
  const tracker = new TowerReadingTracker({
    report: reading => reports.push(reading),
    onAltScroll: ({ active, cause }) => altEvents.push(active ? 'start' : `end:${cause}`),
  })
  if (enabled) tracker.setEnabled(true)
  return { tracker, reports, altEvents }
}

describe('TowerReadingTracker', () => {
  test('scrolled up / a selection → reading at once; ended → still reading 10 s, then not', () => {
    const { tracker, reports } = setup()
    tracker.setCondition(true)
    expect(reports).toEqual([true])
    vi.advanceTimersByTime(120_000)
    expect(reports).toEqual([true]) // while it lasts, no limit here (the host has the 60 s)
    tracker.setCondition(false)
    vi.advanceTimersByTime(TOWER_READING_LINGER_MS - 1)
    expect(reports).toEqual([true])
    vi.advanceTimersByTime(1)
    expect(reports).toEqual([true, false])
  })

  test('a wheel / PageUp → reading 10 s; another one restarts the 10 s', () => {
    const { tracker, reports } = setup()
    tracker.noteActivity()
    vi.advanceTimersByTime(6_000)
    tracker.noteActivity()
    vi.advanceTimersByTime(9_000)
    expect(reports).toEqual([true])
    vi.advanceTimersByTime(1_000)
    expect(reports).toEqual([true, false])
  })

  test('reported only on a change', () => {
    const { tracker, reports } = setup()
    tracker.setCondition(true)
    tracker.noteActivity()
    tracker.setCondition(true)
    expect(reports).toEqual([true])
  })

  test('not enabled (not a contract-2 Tower): nothing is ever reported', () => {
    const { tracker, reports } = setup(false)
    tracker.setCondition(true)
    tracker.noteActivity()
    vi.advanceTimersByTime(60_000)
    expect(reports).toEqual([])
  })

  test('disabled while reading: `false` once, and nothing after', () => {
    const { tracker, reports } = setup()
    tracker.setCondition(true)
    tracker.setEnabled(false)
    expect(reports).toEqual([true, false])
    tracker.noteActivity()
    expect(reports).toEqual([true, false])
  })

  test('enabled while scrolled up: the next condition update reports it', () => {
    const { tracker, reports } = setup(false)
    tracker.setEnabled(true)
    expect(reports).toEqual([])
    tracker.setCondition(true)
    expect(reports).toEqual([true])
  })

  test('dispose stops the pending timer', () => {
    const { tracker, reports } = setup()
    tracker.noteActivity()
    tracker.dispose()
    vi.advanceTimersByTime(TOWER_READING_LINGER_MS * 2)
    expect(reports).toEqual([true])
  })

  test('normal buffer (T0917): `noteAltScroll` does nothing — a wheel up still ends 10 s after it', () => {
    const { tracker, reports, altEvents } = setup()
    tracker.noteActivity()
    tracker.noteAltScroll(-50)
    vi.advanceTimersByTime(TOWER_READING_LINGER_MS)
    expect(reports).toEqual([true, false])
    expect(altEvents).toEqual([])
    expect(tracker.altScrolledUp).toBe(false)
  })
})

describe('TowerReadingTracker — alt buffer scrolled up (T0917 / BUG-221)', () => {
  /** Enabled, in the alt buffer, one wheel up (activity + rows up, as TerminalPanel does). */
  function scrolledUp(rows = 6) {
    const s = setup()
    s.tracker.setAltBuffer(true)
    s.tracker.noteActivity()
    s.tracker.noteAltScroll(-rows)
    return s
  }

  test('scrolled up and stopped: still reading long after 10 s (the host keeps the 60 s limit)', () => {
    const { tracker, reports, altEvents } = scrolledUp()
    expect(reports).toEqual([true])
    expect(altEvents).toEqual(['start'])
    vi.advanceTimersByTime(TOWER_READING_LINGER_MS + 5_000)
    expect(reports).toEqual([true])
    vi.advanceTimersByTime(120_000)
    expect(reports).toEqual([true])
    expect(tracker.altScrolledUp).toBe(true)
  })

  test('a key ends it at once when the last wheel is older than 10 s', () => {
    const { tracker, reports, altEvents } = scrolledUp()
    vi.advanceTimersByTime(15_000)
    tracker.endAltScroll('key')
    expect(reports).toEqual([true, false])
    expect(altEvents).toEqual(['start', 'end:key'])
  })

  test('a click within 10 s of the wheel: back to the normal rule (the rest of the 10 s), no linger of its own', () => {
    const { tracker, reports, altEvents } = scrolledUp()
    vi.advanceTimersByTime(4_000)
    tracker.endAltScroll('click')
    expect(altEvents).toEqual(['start', 'end:click'])
    vi.advanceTimersByTime(TOWER_READING_LINGER_MS - 4_000 - 1)
    expect(reports).toEqual([true])
    vi.advanceTimersByTime(1)
    expect(reports).toEqual([true, false])
  })

  test('the tab hidden ends it', () => {
    const { tracker, reports, altEvents } = scrolledUp()
    vi.advanceTimersByTime(20_000)
    tracker.endAltScroll('inactive')
    expect(reports).toEqual([true, false])
    expect(altEvents).toEqual(['start', 'end:inactive'])
  })

  test('scrolled back down as far as up → the 10 s linger, then not reading', () => {
    const { tracker, reports, altEvents } = scrolledUp(10)
    vi.advanceTimersByTime(30_000)
    tracker.noteAltScroll(4) // part of the way back: still up
    vi.advanceTimersByTime(30_000)
    expect(reports).toEqual([true])
    expect(tracker.altScrolledUp).toBe(true)
    tracker.noteAltScroll(7) // past the bottom: back
    expect(altEvents).toEqual(['start', 'end:scrolled-back'])
    vi.advanceTimersByTime(TOWER_READING_LINGER_MS - 1)
    expect(reports).toEqual([true])
    vi.advanceTimersByTime(1)
    expect(reports).toEqual([true, false])
  })

  test('more up after some down extends it; down with nothing up does nothing', () => {
    const { tracker, altEvents } = setup()
    tracker.setAltBuffer(true)
    tracker.noteAltScroll(5)
    expect(tracker.altScrolledUp).toBe(false)
    tracker.noteAltScroll(-3)
    tracker.noteAltScroll(2)
    tracker.noteAltScroll(-4) // 3 - 2 + 4 = 5 up
    tracker.noteAltScroll(4)
    expect(tracker.altScrolledUp).toBe(true)
    tracker.noteAltScroll(1)
    expect(tracker.altScrolledUp).toBe(false)
    expect(altEvents).toEqual(['start', 'end:scrolled-back'])
  })

  test('pixel wheels: the same amounts back down end it despite float rounding', () => {
    const { tracker } = setup()
    tracker.setAltBuffer(true)
    const step = wheelRows({ deltaY: 200, deltaMode: 0 }, 17.3, 30)
    for (let i = 0; i < 7; i++) tracker.noteAltScroll(-step)
    for (let i = 0; i < 7; i++) tracker.noteAltScroll(step)
    expect(tracker.altScrolledUp).toBe(false)
  })

  test('the buffer switching back to normal ends it (no linger added)', () => {
    const { tracker, reports, altEvents } = scrolledUp()
    vi.advanceTimersByTime(12_000)
    tracker.setAltBuffer(false)
    expect(reports).toEqual([true, false])
    expect(altEvents).toEqual(['start', 'end:buffer-switch'])
  })

  test('a selection still holds reading after the alt state ended', () => {
    const { tracker, reports } = scrolledUp()
    tracker.setCondition(true)
    vi.advanceTimersByTime(15_000)
    tracker.endAltScroll('key')
    expect(reports).toEqual([true])
    tracker.setCondition(false)
    vi.advanceTimersByTime(TOWER_READING_LINGER_MS)
    expect(reports).toEqual([true, false])
  })

  test('disabled while scrolled up: `false` once; enabled again: not scrolled up', () => {
    const { tracker, reports, altEvents } = scrolledUp()
    tracker.setEnabled(false)
    expect(reports).toEqual([true, false])
    expect(altEvents).toEqual(['start', 'end:disabled'])
    tracker.setEnabled(true)
    expect(tracker.altScrolledUp).toBe(false)
    expect(reports).toEqual([true, false])
  })

  test('not enabled (not a contract-2 Tower): alt scrolling reports nothing', () => {
    const { tracker, reports, altEvents } = setup(false)
    tracker.setAltBuffer(true)
    tracker.noteAltScroll(-10)
    vi.advanceTimersByTime(60_000)
    expect(reports).toEqual([])
    expect(altEvents).toEqual([])
  })

  test('ending it when it is not on changes nothing', () => {
    const { tracker, reports, altEvents } = setup()
    tracker.setAltBuffer(true)
    tracker.endAltScroll('key')
    tracker.setAltBuffer(false)
    expect(reports).toEqual([])
    expect(altEvents).toEqual([])
  })

  test('a throwing onAltScroll does not break reporting', () => {
    const reports: boolean[] = []
    const tracker = new TowerReadingTracker({ report: r => reports.push(r), onAltScroll: () => { throw new Error('x') } })
    tracker.setEnabled(true)
    tracker.setAltBuffer(true)
    tracker.noteAltScroll(-3)
    expect(reports).toEqual([true])
  })
})

describe('wheelRows (T0917)', () => {
  test('pixels / row height, lines as is, pages × rows; up is negative', () => {
    expect(wheelRows({ deltaY: -100, deltaMode: 0 }, 20, 30)).toBe(-5)
    expect(wheelRows({ deltaY: 3, deltaMode: 1 }, 20, 30)).toBe(3)
    expect(wheelRows({ deltaY: -1, deltaMode: 2 }, 20, 30)).toBe(-30)
  })
  test('Shift / Ctrl wheels, no vertical delta, bad input → 0; unknown row height → 16 px', () => {
    expect(wheelRows({ deltaY: -100, deltaMode: 0, shiftKey: true }, 20, 30)).toBe(0)
    expect(wheelRows({ deltaY: -100, deltaMode: 0, ctrlKey: true }, 20, 30)).toBe(0)
    expect(wheelRows({ deltaY: 0, deltaMode: 0 }, 20, 30)).toBe(0)
    expect(wheelRows({ deltaY: Number.NaN, deltaMode: 0 }, 20, 30)).toBe(0)
    expect(wheelRows({ deltaY: -32, deltaMode: 0 }, 0, 30)).toBe(-2)
  })
})

describe('isModifierOnlyKey (T0917)', () => {
  test('modifiers alone are not typing; everything else is', () => {
    for (const k of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) expect(isModifierOnlyKey(k)).toBe(true)
    for (const k of ['a', 'Enter', 'Escape', 'ArrowRight', 'Process', 'Dead']) expect(isModifierOnlyKey(k)).toBe(false)
  })
})
