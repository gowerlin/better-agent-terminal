/**
 * T0774 (BUG-193, D216): the click that gives an unfocused window the focus back focuses the window
 * before it switches tabs (T0774 measured: focus → pointerdown ~1.6 ms → pointerup / click → switch).
 * The tab active at the regain keeps its faded ⚠️ until that click is handled:
 *
 * - focus back + the click switches to another tab → the old tab stays faded; selecting it later clears it
 * - focus back without a click (Alt+Tab, `focus()`) → cleared after the grace (D203 unchanged)
 * - focus back by a click that stays on the tab (its own content) → cleared after the click
 * - a wait that ends while the window is focused and shows the tab leaves no faded ⚠️, also during a hold
 * - blur during a hold, a repeated focus event, a press that never ends, a closed tab
 *
 * The gate is driven the way App wires it: `gate.focus()` then the viewing state, store changes →
 * `setViewingState`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFocusRegainGate,
  getMissedWait,
  resetTerminalAttention,
  retainTerminals,
  setTerminalAttention,
  setViewingState,
  type FocusRegainGate,
} from '../terminal-attention-store'
import {
  FOCUS_REGAIN_CLICK_SETTLE_MS,
  FOCUS_REGAIN_MAX_HOLD_MS,
  FOCUS_REGAIN_POINTER_GRACE_MS,
  type TerminalAttentionEvent,
} from '../../lib/terminal-attention'

const ev = (id: string, extra: Partial<TerminalAttentionEvent> = {}): TerminalAttentionEvent => ({ id, pendingQuestions: 0, ...extra })

/** A window as App sees it: the active tab, the OS focus, and the gate wired like App's effect. */
function makeWindow(active: string) {
  const win = { active, focused: true }
  const logs: string[] = []
  const gate: FocusRegainGate = createFocusRegainGate({
    hasFocus: () => win.focused,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    log: (m) => logs.push(m),
  })
  const update = () => setViewingState(win.active, win.focused)
  update()
  return {
    gate,
    logs,
    blur() { win.focused = false; gate.blur(); update() },
    focus() { win.focused = true; gate.focus(); update() },
    select(id: string) { win.active = id; update() },
    /** A regain click on tab `id`'s thumbnail: focus, pointerdown, (held), pointerup + click → switch. */
    clickToRegain(id: string, holdMs = 90) {
      this.focus()
      vi.advanceTimersByTime(2)
      gate.pointerDown()
      vi.advanceTimersByTime(holdMs)
      gate.pointerUp()
      this.select(id) // the click handler, same task as pointerup
    },
  }
}

/** Tab `id` waits, then the wait ends while the window has no focus → faded. */
function missWhileUnfocused(w: ReturnType<typeof makeWindow>, id: string) {
  setTerminalAttention(ev(id, { blockedReason: 'question', blockedSince: 1 }))
  w.blur()
  setTerminalAttention(ev(id))
  expect(getMissedWait(id)).not.toBeNull()
}

beforeEach(() => {
  resetTerminalAttention()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  resetTerminalAttention()
})

describe('focus regain by a click (T0774 / BUG-193)', () => {
  it('the click that gives the focus back switches to another tab → the old tab stays faded; selecting it clears it', () => {
    const w = makeWindow('X')
    missWhileUnfocused(w, 'X')
    w.clickToRegain('Y')
    vi.advanceTimersByTime(FOCUS_REGAIN_MAX_HOLD_MS * 2)
    expect(getMissedWait('X')).not.toBeNull()
    expect(w.logs.at(-1)).toMatch(/held=X active=Y focused=true → kept/)
    w.select('X')
    expect(getMissedWait('X')).toBeNull()
  })

  it('a long press before the switching click → still kept', () => {
    const w = makeWindow('X')
    missWhileUnfocused(w, 'X')
    w.clickToRegain('Y', FOCUS_REGAIN_MAX_HOLD_MS - 10)
    vi.advanceTimersByTime(FOCUS_REGAIN_CLICK_SETTLE_MS)
    expect(getMissedWait('X')).not.toBeNull()
  })

  it('the focus back without a click (Alt+Tab, focus()) and the tab active → cleared after the grace (D203)', () => {
    const w = makeWindow('X')
    missWhileUnfocused(w, 'X')
    w.focus()
    expect(getMissedWait('X')).not.toBeNull() // not yet: a click may follow
    vi.advanceTimersByTime(FOCUS_REGAIN_POINTER_GRACE_MS)
    expect(getMissedWait('X')).toBeNull()
    expect(w.logs.at(-1)).toMatch(/held=X active=X focused=true → looked at/)
  })

  it('a regain click that stays on the tab (its own content) → cleared once the click is handled', () => {
    const w = makeWindow('X')
    missWhileUnfocused(w, 'X')
    w.clickToRegain('X')
    expect(getMissedWait('X')).not.toBeNull()
    vi.advanceTimersByTime(FOCUS_REGAIN_CLICK_SETTLE_MS)
    expect(getMissedWait('X')).toBeNull()
  })

  it('a tab switch deferred by a tick after the click still counts as the switch', () => {
    const w = makeWindow('X')
    missWhileUnfocused(w, 'X')
    w.focus()
    w.gate.pointerDown()
    vi.advanceTimersByTime(80)
    w.gate.pointerUp()
    vi.advanceTimersByTime(1) // e.g. a handler that switches in setTimeout(0)
    w.select('Y')
    vi.advanceTimersByTime(FOCUS_REGAIN_CLICK_SETTLE_MS)
    expect(getMissedWait('X')).not.toBeNull()
  })

  it('the tab switched to by the regain click loses its own faded ⚠️ at once (D203)', () => {
    const w = makeWindow('X')
    missWhileUnfocused(w, 'Y')
    w.clickToRegain('Y')
    expect(getMissedWait('Y')).toBeNull()
  })

  it('a wait that ends while focused and looked at leaves nothing — also during a hold (no flash)', () => {
    const w = makeWindow('X')
    setTerminalAttention(ev('X', { blockedReason: 'permission', blockedSince: 1 }))
    w.blur()
    w.focus() // hold on X begins
    setTerminalAttention(ev('X')) // ends during the grace
    expect(getMissedWait('X')).toBeNull()
    vi.advanceTimersByTime(FOCUS_REGAIN_POINTER_GRACE_MS)
    expect(getMissedWait('X')).toBeNull()
    // and with no hold at all
    setTerminalAttention(ev('X', { blockedReason: 'question', blockedSince: 2 }))
    setTerminalAttention(ev('X'))
    expect(getMissedWait('X')).toBeNull()
  })

  it('blur during the hold → nothing cleared; a repeated focus event starts no new hold', () => {
    const w = makeWindow('X')
    missWhileUnfocused(w, 'X')
    w.focus()
    w.blur()
    vi.advanceTimersByTime(FOCUS_REGAIN_MAX_HOLD_MS)
    expect(getMissedWait('X')).not.toBeNull()
    w.focus()
    vi.advanceTimersByTime(FOCUS_REGAIN_POINTER_GRACE_MS)
    expect(getMissedWait('X')).toBeNull()
    // already focused: another focus event is no regain (an earlier miss on the active tab never exists then)
    missWhileUnfocused(w, 'X')
    w.focus()
    w.gate.focus() // repeated (e.g. a synthetic focus event)
    vi.advanceTimersByTime(FOCUS_REGAIN_POINTER_GRACE_MS)
    expect(getMissedWait('X')).toBeNull()
  })

  it('a press that never ends → judged after the max hold', () => {
    const w = makeWindow('X')
    missWhileUnfocused(w, 'X')
    w.focus()
    w.gate.pointerDown()
    vi.advanceTimersByTime(FOCUS_REGAIN_MAX_HOLD_MS - 1)
    expect(getMissedWait('X')).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(getMissedWait('X')).toBeNull()
  })

  it('a press already down when the focus comes back is the regain click', () => {
    const w = makeWindow('X')
    missWhileUnfocused(w, 'X')
    w.gate.pointerDown()
    w.focus()
    vi.advanceTimersByTime(FOCUS_REGAIN_POINTER_GRACE_MS)
    expect(getMissedWait('X')).not.toBeNull()
    w.gate.pointerUp()
    w.select('Y')
    vi.advanceTimersByTime(FOCUS_REGAIN_CLICK_SETTLE_MS)
    expect(getMissedWait('X')).not.toBeNull()
  })

  it('a pointer press while focused (no regain) changes nothing; a closed held tab is forgotten', () => {
    const w = makeWindow('X')
    w.gate.pointerDown()
    w.gate.pointerUp()
    vi.advanceTimersByTime(FOCUS_REGAIN_MAX_HOLD_MS)
    expect(w.logs).toEqual([])
    missWhileUnfocused(w, 'X')
    w.focus()
    retainTerminals(['Y'])
    expect(getMissedWait('X')).toBeNull()
    vi.advanceTimersByTime(FOCUS_REGAIN_POINTER_GRACE_MS)
    expect(getMissedWait('X')).toBeNull()
  })

  it('dispose drops the hold without clearing', () => {
    const w = makeWindow('X')
    missWhileUnfocused(w, 'X')
    w.focus()
    w.gate.dispose()
    vi.advanceTimersByTime(FOCUS_REGAIN_MAX_HOLD_MS)
    expect(getMissedWait('X')).not.toBeNull()
  })
})
