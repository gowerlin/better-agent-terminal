/**
 * T0917 / BUG-221: source guard for TerminalPanel's wiring of the alt-buffer reading signal
 * (src/lib/tower-reading-state.ts holds the logic; TerminalPanel only feeds it events). The e2e
 * e2e/t0904-tower-notify-protection.spec.ts ⑥ measures the whole path in a real BAT.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

const src = fs.readFileSync(path.resolve(__dirname, '../components/TerminalPanel.tsx'), 'utf8')

describe('TerminalPanel — reading signal wiring (T0917)', () => {
  test('the buffer type reaches the tracker at mount and on every switch', () => {
    expect(src).toContain("readingTracker.setAltBuffer(terminal.buffer.active.type === 'alternate')")
    const onSwitch = src.slice(src.indexOf('terminal.buffer.onBufferChange('))
    expect(onSwitch.slice(0, 400)).toContain('readingTrackerRef.current?.setAltBuffer(isAlt)')
  })

  test('wheel / PageUp / PageDown feed alt scrolling; the wheel stays activity for every buffer (T0904)', () => {
    const wheel = src.slice(src.indexOf('const noteReadingWheel'), src.indexOf('const noteReadingKey'))
    expect(wheel).toContain('readingTracker.noteActivity()')
    expect(wheel).toContain('readingTracker.noteAltScroll(wheelRows(e, readingRowHeight(), terminal.rows))')
    const key = src.slice(src.indexOf('const noteReadingKey'), src.indexOf('const noteReadingClick'))
    expect(key).toContain('readingTracker.noteAltScroll(-terminal.rows)')
    expect(key).toContain('readingTracker.noteAltScroll(terminal.rows)')
    expect(key).toContain("readingTracker.endAltScroll('key')")
    expect(key).toContain('isModifierOnlyKey(e.key)')
  })

  test('a click and the tab hidden end it; listeners are passive / observe only and removed on unmount', () => {
    expect(src).toContain("const noteReadingClick = () => { readingTracker.endAltScroll('click') }")
    expect(src).toContain("addEventListener('mousedown', noteReadingClick, { capture: true })")
    expect(src).toContain("removeEventListener('mousedown', noteReadingClick, { capture: true })")
    expect(src).toContain("addEventListener('wheel', noteReadingWheel, { capture: true, passive: true })")
    expect(src).toContain("if (!isActive) readingTrackerRef.current?.endAltScroll('inactive')")
    // observe only: the reading listeners never stop or cancel the event (T0698 / T0672 untouched)
    const block = src.slice(src.indexOf('const noteReadingWheel'), src.indexOf("addEventListener('mousedown', noteReadingClick"))
    expect(block).not.toMatch(/preventDefault|stopPropagation|stopImmediatePropagation/)
  })
})
