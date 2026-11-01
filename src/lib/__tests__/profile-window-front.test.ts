// T0750 (BUG-183 / BUG-184): bringing a profile's existing window back, the renderer's notice,
// and the windows a deleted profile leaves behind.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  bringWindowToFront,
  planDeletedProfileWindows,
  profileOpenNotice,
  type FrontableWindow,
} from '../profile-window-front'

/** A BrowserWindow stand-in: hidden / minimized / destroyed state and the calls made on it. */
function fakeWindow(state: { visible: boolean; minimized: boolean; destroyed?: boolean; showWorks?: boolean }) {
  const calls: string[] = []
  const win: FrontableWindow = {
    isDestroyed: () => state.destroyed === true,
    isMinimized: () => state.minimized,
    isVisible: () => state.visible,
    restore: () => { calls.push('restore'); state.minimized = false },
    show: () => { calls.push('show'); if (state.showWorks !== false) state.visible = true },
    focus: () => { calls.push('focus') },
  }
  return { win, calls, state }
}

describe('bringWindowToFront (BUG-183)', () => {
  it('hidden (minimize to tray) → show + focus, restored', () => {
    const { win, calls, state } = fakeWindow({ visible: false, minimized: false })
    expect(bringWindowToFront(win)).toBe('restored')
    expect(calls).toEqual(['show', 'focus'])
    expect(state.visible).toBe(true)
  })

  it('minimized → restore + focus (no show), restored', () => {
    const { win, calls } = fakeWindow({ visible: true, minimized: true })
    expect(bringWindowToFront(win)).toBe('restored')
    expect(calls).toEqual(['restore', 'focus'])
  })

  it('hidden while minimized → show, restore, focus', () => {
    const { win, calls } = fakeWindow({ visible: false, minimized: true })
    expect(bringWindowToFront(win)).toBe('restored')
    expect(calls).toEqual(['show', 'restore', 'focus'])
  })

  it('already on screen → focus only (pre-T0750 behavior), focused', () => {
    const { win, calls } = fakeWindow({ visible: true, minimized: false })
    expect(bringWindowToFront(win)).toBe('focused')
    expect(calls).toEqual(['focus'])
  })

  it('show() does not make it visible → not-shown', () => {
    const { win } = fakeWindow({ visible: false, minimized: false, showWorks: false })
    expect(bringWindowToFront(win)).toBe('not-shown')
  })

  it('destroyed → not-shown, nothing called', () => {
    const { win, calls } = fakeWindow({ visible: false, minimized: false, destroyed: true })
    expect(bringWindowToFront(win)).toBe('not-shown')
    expect(calls).toEqual([])
  })
})

describe('profileOpenNotice', () => {
  it('a hidden / minimized window that came back → no notice', () => {
    expect(profileOpenNotice({ alreadyOpen: true, broughtToFront: 'restored' })).toBeNull()
  })

  it('a window already on screen → the unchanged "already open" notice', () => {
    expect(profileOpenNotice({ alreadyOpen: true, broughtToFront: 'focused' })).toBe('already-open')
  })

  it('an older main process without broughtToFront → "already open" as before', () => {
    expect(profileOpenNotice({ alreadyOpen: true })).toBe('already-open')
  })

  it('could not be shown → not-shown notice', () => {
    expect(profileOpenNotice({ alreadyOpen: true, broughtToFront: 'not-shown' })).toBe('not-shown')
  })

  it('no live window (new window opened, or an error) → no notice', () => {
    expect(profileOpenNotice({ alreadyOpen: false })).toBeNull()
    expect(profileOpenNotice(null)).toBeNull()
    expect(profileOpenNotice(undefined)).toBeNull()
  })
})

describe('planDeletedProfileWindows (BUG-184)', () => {
  const entries = [
    { id: 'w-default', profileId: 'default' },
    { id: 'w-wsl-a', profileId: 'wsl-a' },
    { id: 'w-wsl-a-2', profileId: 'wsl-a' },
    { id: 'w-wsl-a-stale', profileId: 'wsl-a' },
    { id: 'w-wsl-b', profileId: 'wsl-b' },
    { id: 'w-unbound' },
  ]

  it('closes the live windows of the deleted profile only; drops its stale entries', () => {
    const plan = planDeletedProfileWindows(entries, ['w-default', 'w-wsl-a', 'w-wsl-a-2', 'w-wsl-b'], 'wsl-a')
    expect(plan.closeIds).toEqual(['w-wsl-a', 'w-wsl-a-2'])
    expect(plan.staleEntryIds).toEqual(['w-wsl-a-stale'])
    expect(plan.openFallback).toBe(false)
  })

  it('a profile with no window → nothing to close, no fallback', () => {
    const plan = planDeletedProfileWindows(entries, ['w-default'], 'wsl-c')
    expect(plan).toEqual({ closeIds: [], staleEntryIds: [], openFallback: false })
  })

  it('its windows are the only live windows → open the Default profile first', () => {
    const plan = planDeletedProfileWindows(entries, ['w-wsl-b'], 'wsl-b')
    expect(plan.closeIds).toEqual(['w-wsl-b'])
    expect(plan.openFallback).toBe(true)
  })

  it('a hidden window of another profile still counts as live → no fallback', () => {
    // windowMap keeps hidden (minimize to tray) windows; the caller passes them as live
    const plan = planDeletedProfileWindows(entries, ['w-default', 'w-wsl-b'], 'wsl-b')
    expect(plan.openFallback).toBe(false)
  })
})

describe('main.ts wiring (source guard)', () => {
  const main = fs.readFileSync(path.resolve(__dirname, '../../../electron/main.ts'), 'utf8')

  it('openProfileWindows and second-instance bring the existing window back with bringWindowToFront', () => {
    const open = main.slice(main.indexOf('const openProfileWindows = async'), main.indexOf("ipcMain.handle('app:open-new-instance'"))
    expect(open).toContain('bringWindowToFront(windowMap.get(mostRecent.id)!)')
    expect(open).toContain('broughtToFront')
    const second = main.slice(main.indexOf("app.on('second-instance'"), main.indexOf('No profile arg'))
    expect(second).toContain('bringWindowToFront(')
    // no bare focus() path left for an existing profile window
    expect(open).not.toMatch(/win\.focus\(\)/)
  })

  it('profile:delete closes the deleted profile\'s windows', () => {
    const del = main.slice(main.indexOf("ipcMain.handle('profile:delete'"), main.indexOf("ipcMain.handle('profile:rename'"))
    expect(del).toContain('closeWindowsOfDeletedProfile(profileId)')
  })
})
