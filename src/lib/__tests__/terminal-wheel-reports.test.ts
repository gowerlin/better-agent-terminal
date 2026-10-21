/**
 * BUG-165 / T0698: codex tabs on the alternate screen get one SGR wheel report per line scrolled
 * (at most 8 per event); everything else stays xterm's. The reports are compared with the ones a
 * real xterm 5.5.0 instance encodes (`CoreMouseService.triggerMouseEvent`).
 */
import { describe, expect, test } from 'vitest'
import { Terminal } from '@xterm/xterm'
import {
  DOM_DELTA_LINE,
  DOM_DELTA_PAGE,
  DOM_DELTA_PIXEL,
  isCodexTerminal,
  MAX_WHEEL_REPORTS_PER_EVENT,
  mouseReportEncoding,
  planWheelReports,
  sgrWheelReport,
  shouldSendWheelReports,
  wheelLines,
  WheelLineAccumulator,
  wheelReportCell,
  type ScreenGeometry,
  type WheelReportConditions,
} from '../terminal-wheel-reports'

const ON: WheelReportConditions = { agentPreset: 'codex-cli', bufferType: 'alternate', mouseTrackingMode: 'any', mouseEncoding: 'SGR' }

/** 80 x 24 cells of 9 x 17 px at (10, 20). */
const GEOMETRY: ScreenGeometry = { left: 10, top: 20, width: 720, height: 408, paddingLeft: 0, paddingTop: 0, cols: 80, rows: 24 }

const wheel = (init: Partial<WheelEvent> = {}) => ({
  deltaY: 0, deltaMode: DOM_DELTA_PIXEL, shiftKey: false, altKey: false, ctrlKey: false, clientX: 10, clientY: 20, ...init,
})

/** A real xterm with the program's modes set; `xtermWheelReport` encodes through its CoreMouseService. */
async function realXterm(modes: string): Promise<Terminal> {
  const terminal = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 })
  await new Promise<void>(resolve => terminal.write(modes, resolve))
  return terminal
}

/** What xterm 5.5.0 writes for a wheel event at 0-based (col, row): `Terminal.bindMouse` → `sendEvent`. */
function xtermWheelReport(terminal: Terminal, up: boolean, col: number, row: number, mods: { ctrl?: boolean; alt?: boolean } = {}): string[] {
  const out: string[] = []
  const sub = terminal.onData(data => out.push(data))
  const core = (terminal as unknown as { _core: { coreMouseService: { triggerMouseEvent(e: object): boolean } } })._core
  // CoreMouseButton.WHEEL = 4, CoreMouseAction.UP = 0 / DOWN = 1
  core.coreMouseService.triggerMouseEvent({ col, row, x: 0, y: 0, button: 4, action: up ? 0 : 1, ctrl: !!mods.ctrl, alt: !!mods.alt, shift: false })
  sub.dispose()
  return out
}

describe('conditions (every one that fails hands the event to xterm)', () => {
  test('all four hold → BAT sends the reports', () => {
    expect(shouldSendWheelReports(ON)).toBe(true)
    for (const mode of ['vt200', 'drag', 'any']) expect(shouldSendWheelReports({ ...ON, mouseTrackingMode: mode })).toBe(true)
  })

  test('not a codex tab', () => {
    for (const agentPreset of [undefined, 'none', 'claude-cli', 'claude-cli-worktree', 'codex-agent', 'gemini-cli', 'Codex-CLI']) {
      expect(isCodexTerminal(agentPreset)).toBe(false)
      expect(shouldSendWheelReports({ ...ON, agentPreset })).toBe(false)
    }
    expect(isCodexTerminal('codex-cli')).toBe(true)
  })

  test('normal buffer', () => {
    expect(shouldSendWheelReports({ ...ON, bufferType: 'normal' })).toBe(false)
  })

  test('no tracking, or X10 (presses only, no wheel)', () => {
    for (const mode of ['none', 'x10', '', 'ANY']) expect(shouldSendWheelReports({ ...ON, mouseTrackingMode: mode })).toBe(false)
  })

  test('encoding other than SGR', () => {
    for (const mouseEncoding of ['DEFAULT', 'SGR_PIXELS', undefined]) expect(shouldSendWheelReports({ ...ON, mouseEncoding })).toBe(false)
  })

  test('mouseReportEncoding reads xterm 5.5.0 and turns unknown layouts into undefined', async () => {
    expect(mouseReportEncoding(await realXterm(''))).toBe('DEFAULT')
    expect(mouseReportEncoding(await realXterm('\x1b[?1000h\x1b[?1006h'))).toBe('SGR')
    expect(mouseReportEncoding(await realXterm('\x1b[?1000h\x1b[?1016h'))).toBe('SGR_PIXELS')
    expect(mouseReportEncoding(await realXterm('\x1b[?1006h\x1b[?1006l'))).toBe('DEFAULT')
    for (const other of [null, undefined, {}, { _core: {} }, { _core: { coreMouseService: { activeEncoding: 1 } } }]) {
      expect(mouseReportEncoding(other)).toBeUndefined()
    }
  })

  test('codex 0.163 modes on a real xterm: all four conditions read as on', async () => {
    const terminal = await realXterm('\x1b[?1049h\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h')
    expect(shouldSendWheelReports({
      agentPreset: 'codex-cli',
      bufferType: terminal.buffer.active.type,
      mouseTrackingMode: terminal.modes.mouseTrackingMode,
      mouseEncoding: mouseReportEncoding(terminal),
    })).toBe(true)
  })

  test('no vertical delta or Shift held → null (xterm scrolls nothing then)', () => {
    const acc = new WheelLineAccumulator()
    expect(planWheelReports(wheel({ deltaY: 0 }), GEOMETRY, {}, acc)).toBeNull()
    expect(planWheelReports(wheel({ deltaY: 100, shiftKey: true }), GEOMETRY, {}, acc)).toBeNull()
  })

  test('no geometry yet → null', () => {
    const acc = new WheelLineAccumulator()
    expect(planWheelReports(wheel({ deltaY: 100 }), { ...GEOMETRY, width: 0, height: 0 }, {}, acc)).toBeNull()
  })
})

describe('delta → lines (as xterm 5.5.0 Viewport.getLinesScrolled)', () => {
  const opts = { rowHeight: 17, rows: 24 }

  test('pixel ÷ row height, line as is, page × rows; sign kept', () => {
    expect(wheelLines(wheel({ deltaY: 34 }), opts)).toBe(2)
    expect(wheelLines(wheel({ deltaY: -8.5 }), opts)).toBe(-0.5)
    expect(wheelLines(wheel({ deltaY: 3, deltaMode: DOM_DELTA_LINE }), opts)).toBe(3)
    expect(wheelLines(wheel({ deltaY: -1, deltaMode: DOM_DELTA_PAGE }), opts)).toBe(-24)
  })

  test('scrollSensitivity, and fastScrollSensitivity with the fast-scroll modifier (default Alt)', () => {
    expect(wheelLines(wheel({ deltaY: 17 }), { ...opts, scrollSensitivity: 2 })).toBe(2)
    expect(wheelLines(wheel({ deltaY: 17, altKey: true }), opts)).toBe(5)
    expect(wheelLines(wheel({ deltaY: 17, altKey: true }), { ...opts, fastScrollSensitivity: 3, scrollSensitivity: 2 })).toBe(6)
    expect(wheelLines(wheel({ deltaY: 17, ctrlKey: true }), { ...opts, fastScrollModifier: 'ctrl' })).toBe(5)
    expect(wheelLines(wheel({ deltaY: 17, altKey: true }), { ...opts, fastScrollModifier: 'none' })).toBe(1)
  })

  test('nothing for Shift, no vertical delta, or no row height', () => {
    expect(wheelLines(wheel({ deltaY: 50, shiftKey: true }), opts)).toBe(0)
    expect(wheelLines(wheel({ deltaY: 0 }), opts)).toBe(0)
    expect(wheelLines(wheel({ deltaY: 50 }), { ...opts, rowHeight: 0 })).toBe(0)
  })
})

describe('carry and cap', () => {
  test('fractions add up across events; whole lines go out', () => {
    const acc = new WheelLineAccumulator()
    expect([0.4, 0.4, 0.4, 0.4, 0.4].map(l => acc.take(l))).toEqual([0, 0, 1, 0, 1])
    expect(acc.take(2.5)).toBe(2)
    expect(acc.take(0.5)).toBe(1)
  })

  test('up (negative) the same way', () => {
    const acc = new WheelLineAccumulator()
    expect([-0.6, -0.6, -0.6, -0.6].map(l => acc.take(l))).toEqual([0, -1, 0, -1])
  })

  test('a change of direction drops the carried fraction', () => {
    const acc = new WheelLineAccumulator()
    expect(acc.take(0.9)).toBe(0)
    expect(acc.take(-0.5)).toBe(0)
    expect(acc.take(-0.5)).toBe(-1)
  })

  test(`at most ${MAX_WHEEL_REPORTS_PER_EVENT} per event; the rest and the fraction are dropped`, () => {
    const acc = new WheelLineAccumulator()
    expect(MAX_WHEEL_REPORTS_PER_EVENT).toBe(8)
    expect(acc.take(8.9)).toBe(8)
    expect(acc.take(0.2)).toBe(1)
    expect(acc.take(25.7)).toBe(8)
    expect(acc.take(0.5)).toBe(0)
    expect(acc.take(-40)).toBe(-8)
    expect(acc.take(-0.5)).toBe(0)
  })

  test('reset() and non-finite input', () => {
    const acc = new WheelLineAccumulator()
    expect(acc.take(0.9)).toBe(0)
    acc.reset()
    expect(acc.take(0.2)).toBe(0)
    expect(acc.take(Number.NaN)).toBe(0)
    expect(acc.take(Number.POSITIVE_INFINITY)).toBe(0)
  })

  test('T0670 burst: 60 events × 50 px at 17 px rows → 173 lines (xterm sent 60 reports)', () => {
    const acc = new WheelLineAccumulator()
    let sent = 0
    for (let i = 0; i < 60; i++) sent += planWheelReports(wheel({ deltaY: 50 }), GEOMETRY, {}, acc)!.reports.length
    expect(sent).toBe(Math.floor(60 * 50 / 17))
  })
})

describe('cell under the pointer (as xterm 5.5.0 MouseService.getMouseReportCoords, 1-based)', () => {
  test('top-left, inside, bottom-right', () => {
    expect(wheelReportCell({ clientX: 10, clientY: 20 }, GEOMETRY)).toEqual({ col: 1, row: 1 })
    expect(wheelReportCell({ clientX: 10 + 9 * 4 + 8, clientY: 20 + 17 * 2 + 16 }, GEOMETRY)).toEqual({ col: 5, row: 3 })
    expect(wheelReportCell({ clientX: 10 + 719, clientY: 20 + 407 }, GEOMETRY)).toEqual({ col: 80, row: 24 })
  })

  test('outside the screen is clamped to the edge cell', () => {
    expect(wheelReportCell({ clientX: -50, clientY: -50 }, GEOMETRY)).toEqual({ col: 1, row: 1 })
    expect(wheelReportCell({ clientX: 5000, clientY: 5000 }, GEOMETRY)).toEqual({ col: 80, row: 24 })
  })

  test('padding is taken off', () => {
    expect(wheelReportCell({ clientX: 10 + 9 + 3, clientY: 20 }, { ...GEOMETRY, paddingLeft: 9 })).toEqual({ col: 1, row: 1 })
  })

  test('no size → null', () => {
    expect(wheelReportCell({ clientX: 10, clientY: 20 }, { ...GEOMETRY, width: 0 })).toBeNull()
    expect(wheelReportCell({ clientX: 10, clientY: 20 }, { ...GEOMETRY, rows: 0 })).toBeNull()
  })
})

describe('SGR wheel report, byte for byte as xterm 5.5.0', () => {
  test('format, direction and modifier bits', () => {
    expect(sgrWheelReport('up', { col: 1, row: 1 }, { ctrlKey: false, altKey: false })).toBe('\x1b[<64;1;1M')
    expect(sgrWheelReport('down', { col: 5, row: 3 }, { ctrlKey: false, altKey: false })).toBe('\x1b[<65;5;3M')
    expect(sgrWheelReport('up', { col: 2, row: 2 }, { ctrlKey: true, altKey: false })).toBe('\x1b[<80;2;2M')
    expect(sgrWheelReport('down', { col: 2, row: 2 }, { ctrlKey: false, altKey: true })).toBe('\x1b[<73;2;2M')
    expect(sgrWheelReport('down', { col: 2, row: 2 }, { ctrlKey: true, altKey: true })).toBe('\x1b[<89;2;2M')
  })

  test('the same bytes a real xterm writes for each direction × modifier × position', async () => {
    const terminal = await realXterm('\x1b[?1049h\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h')
    for (const up of [true, false]) {
      for (const ctrl of [false, true]) {
        for (const alt of [false, true]) {
          for (const [col, row] of [[0, 0], [4, 2], [79, 23], [41, 11]]) {
            const ours = sgrWheelReport(up ? 'up' : 'down', { col: col + 1, row: row + 1 }, { ctrlKey: ctrl, altKey: alt })
            expect([ours]).toEqual(xtermWheelReport(terminal, up, col, row, { ctrl, alt }))
          }
        }
      }
    }
  })

  test('planWheelReports: direction from deltaY as xterm (< 0 = up), cell and mods in every report', async () => {
    const terminal = await realXterm('\x1b[?1049h\x1b[?1000h\x1b[?1006h')
    const acc = new WheelLineAccumulator()
    const down = planWheelReports(wheel({ deltaY: 51, clientX: 10 + 9 * 4 + 1, clientY: 20 + 17 * 2 + 1, ctrlKey: true }), GEOMETRY, {}, acc)!
    expect(down.reports).toEqual(Array(3).fill(xtermWheelReport(terminal, false, 4, 2, { ctrl: true })[0]))
    expect(down.lines).toBe(3)
    const up = planWheelReports(wheel({ deltaY: -34, clientX: 10, clientY: 20 }), GEOMETRY, {}, acc)!
    expect(up.reports).toEqual(Array(2).fill(xtermWheelReport(terminal, true, 0, 0)[0]))
    const small = planWheelReports(wheel({ deltaY: -5 }), GEOMETRY, {}, acc)!
    expect(small.reports).toEqual([])
  })
})
