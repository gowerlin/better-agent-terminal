import { describe, expect, test } from 'vitest'
import { canFitTerminalContainer } from '../terminal-fit-guard'

describe('canFitTerminalContainer (T0741 / BUG-180)', () => {
  test('a laid-out container may be fitted', () => {
    expect(canFitTerminalContainer({ width: 1200, height: 700 })).toBe(true)
    expect(canFitTerminalContainer({ width: 0.5, height: 0.5 })).toBe(true)
  })

  test('no box, 0 or negative width / height, or a non-finite value → not fitted', () => {
    expect(canFitTerminalContainer(null)).toBe(false)
    expect(canFitTerminalContainer(undefined)).toBe(false)
    expect(canFitTerminalContainer({ width: 0, height: 0 })).toBe(false)
    expect(canFitTerminalContainer({ width: 0, height: 700 })).toBe(false)
    expect(canFitTerminalContainer({ width: 1200, height: 0 })).toBe(false)
    expect(canFitTerminalContainer({ width: -1, height: 700 })).toBe(false)
    expect(canFitTerminalContainer({ width: Number.NaN, height: 700 })).toBe(false)
    expect(canFitTerminalContainer({ width: Number.POSITIVE_INFINITY, height: 700 })).toBe(false)
  })
})
