/**
 * PLAN-068 W2 / T0904 (T0902 §2.4 `reading`): the renderer's "the user reads this Tower tab" signal
 * (src/lib/tower-reading-state.ts) — reported only on a change, only while enabled (contract 2),
 * and still reading `TOWER_READING_LINGER_MS` after the last signal ended.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TOWER_READING_LINGER_MS, TowerReadingTracker } from '../tower-reading-state'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function setup(enabled = true) {
  const reports: boolean[] = []
  const tracker = new TowerReadingTracker({ report: reading => reports.push(reading) })
  if (enabled) tracker.setEnabled(true)
  return { tracker, reports }
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
})
