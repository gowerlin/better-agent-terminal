// T0752 (D205): tray menu window labels — same title twice gets ` (2)`, ` (3)`, … in menu order.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { trayWindowBaseLabel, trayWindowLabels } from '../tray-window-labels'

const TITLE_A = 'Better Agent Terminal - Profile A:1'
const TITLE_B = 'Better Agent Terminal - Profile B:1'

describe('trayWindowLabels', () => {
  it('no duplicates → labels unchanged', () => {
    expect(trayWindowLabels([
      { id: 'w1', title: TITLE_A },
      { id: 'w2', title: TITLE_B },
    ])).toEqual([TITLE_A, TITLE_B])
  })

  it('empty list → empty list', () => {
    expect(trayWindowLabels([])).toEqual([])
  })

  it('two with the same title → the second gets " (2)"', () => {
    expect(trayWindowLabels([
      { id: 'w1', title: TITLE_A },
      { id: 'w2', title: TITLE_A },
    ])).toEqual([TITLE_A, `${TITLE_A} (2)`])
  })

  it('three with the same title → " (2)", " (3)" in the given order', () => {
    expect(trayWindowLabels([
      { id: 'w1', title: TITLE_A },
      { id: 'w2', title: TITLE_A },
      { id: 'w3', title: TITLE_A },
    ])).toEqual([TITLE_A, `${TITLE_A} (2)`, `${TITLE_A} (3)`])
  })

  it('several groups of duplicates count independently, unique labels in between stay as they are', () => {
    expect(trayWindowLabels([
      { id: 'w1', title: TITLE_A },
      { id: 'w2', title: TITLE_B },
      { id: 'w3', title: 'Unique' },
      { id: 'w4', title: TITLE_A },
      { id: 'w5', title: TITLE_B },
      { id: 'w6', title: TITLE_B },
    ])).toEqual([TITLE_A, TITLE_B, 'Unique', `${TITLE_A} (2)`, `${TITLE_B} (2)`, `${TITLE_B} (3)`])
  })

  it('empty title → "Window <first 8 chars of id>" fallback (unchanged), duplicates of it numbered too', () => {
    expect(trayWindowBaseLabel({ id: '0123456789abcdef', title: '' })).toBe('Window 01234567')
    expect(trayWindowLabels([
      { id: '0123456789abcdef', title: '' },
      { id: 'fedcba9876543210', title: '' },
      { id: '01234567zzzz', title: '' },
    ])).toEqual(['Window 01234567', 'Window fedcba98', 'Window 01234567 (2)'])
  })

  it('does not mutate its input', () => {
    const input = [{ id: 'w1', title: TITLE_A }, { id: 'w2', title: TITLE_A }]
    const copy = JSON.parse(JSON.stringify(input))
    trayWindowLabels(input)
    expect(input).toEqual(copy)
  })
})

describe('main.ts wiring (source guard)', () => {
  const main = fs.readFileSync(path.resolve(__dirname, '../../../electron/main.ts'), 'utf8')
  const tray = main.slice(main.indexOf('function rebuildTrayMenu()'), main.indexOf("label: 'Quit'"))

  it('rebuildTrayMenu labels window entries with trayWindowLabels over the live windows in windowMap order', () => {
    expect(main).toContain("import { trayWindowLabels } from '../src/lib/tray-window-labels'")
    expect(tray).toContain('[...windowMap].filter(([, win]) => !win.isDestroyed())')
    expect(tray).toContain('trayWindowLabels(liveWindows.map(([wId, win]) => ({ id: wId, title: win.getTitle() })))')
    expect(tray).toContain('const label = labels[index]')
    // the pre-T0752 inline label is gone (single implementation in src/lib/tray-window-labels.ts)
    expect(tray).not.toContain('win.getTitle() || `Window ${wId.slice(0, 8)}`')
  })

  it('menu structure unchanged: Show All Windows, per-window Show / Remove from profile, Quit', () => {
    expect(tray).toContain("label: 'Show All Windows'")
    expect(tray).toContain("label: 'Show'")
    expect(tray).toContain("label: 'Remove from profile'")
    expect(main.slice(main.indexOf('function rebuildTrayMenu()'))).toContain("label: 'Quit'")
  })
})
