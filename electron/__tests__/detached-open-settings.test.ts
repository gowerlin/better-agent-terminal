/**
 * T0530 (BUG-133): "open settings" in a detached workspace window did nothing — the
 * detached branch of App.tsx renders no SettingsPanel. It now asks main, which brings
 * the parent main window (or the most recently active main window of the same profile)
 * to the front and tells it to open Settings. Behaviour end to end:
 * e2e/t0530-detached-open-settings.spec.ts.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  OPEN_SETTINGS_CHANNEL,
  OPEN_SETTINGS_IN_PARENT_CHANNEL,
  openSettingsInWindow,
  pickSettingsWindow,
} from '../detached-open-settings'

class FakeWin {
  constructor(readonly name: string, private destroyed = false) {}
  isDestroyed() { return this.destroyed }
}

describe('pickSettingsWindow', () => {
  const a = new FakeWin('a')
  const b = new FakeWin('b')
  const c = new FakeWin('c')
  const gone = new FakeWin('gone', true)
  const windows = new Map<string, FakeWin>([['w-a', a], ['w-b', b], ['w-c', c], ['w-gone', gone]])
  const registryEntries = [
    { id: 'w-a', profileId: 'p1', lastActiveAt: 10 },
    { id: 'w-b', profileId: 'p1', lastActiveAt: 30 },
    { id: 'w-c', profileId: 'p2', lastActiveAt: 99 },
    { id: 'w-gone', profileId: 'p1', lastActiveAt: 100 },
    { id: 'w-closed', profileId: 'p1', lastActiveAt: 200 },
  ]

  it('prefers the live parent, even when another window of the profile was active later', () => {
    expect(pickSettingsWindow({ parentWindowId: 'w-a', profileId: 'p1', windows, registryEntries }))
      .toEqual({ windowId: 'w-a', win: a })
  })

  it('parent gone → most recently active live main window of the same profile', () => {
    for (const parentWindowId of ['w-gone', 'w-closed', null]) {
      expect(pickSettingsWindow({ parentWindowId, profileId: 'p1', windows, registryEntries }))
        .toEqual({ windowId: 'w-b', win: b })
    }
  })

  it('never falls back to a window of another profile', () => {
    expect(pickSettingsWindow({ parentWindowId: 'w-gone', profileId: 'p3', windows, registryEntries })).toBeNull()
  })

  it('an unbound (local, profileId null) detached window matches entries without a profile', () => {
    const local = new FakeWin('local')
    const result = pickSettingsWindow({
      parentWindowId: null,
      profileId: null,
      windows: new Map([['w-local', local], ['w-c', c]]),
      registryEntries: [{ id: 'w-local' }, { id: 'w-c', profileId: 'p2' }],
    })
    expect(result).toEqual({ windowId: 'w-local', win: local })
  })

  it('unresolved binding → only the parent qualifies', () => {
    expect(pickSettingsWindow({ parentWindowId: 'w-a', profileId: undefined, windows, registryEntries }))
      .toEqual({ windowId: 'w-a', win: a })
    expect(pickSettingsWindow({ parentWindowId: 'w-gone', profileId: undefined, windows, registryEntries })).toBeNull()
  })
})

describe('openSettingsInWindow', () => {
  const makeWin = (minimized: boolean, visible: boolean) => {
    const calls: string[] = []
    const win = {
      isMinimized: () => minimized,
      restore: vi.fn(() => { calls.push('restore') }),
      isVisible: () => visible,
      show: vi.fn(() => { calls.push('show') }),
      focus: vi.fn(() => { calls.push('focus') }),
      webContents: { send: vi.fn((channel: string) => { calls.push(`send:${channel}`) }) },
    }
    return { win, calls }
  }

  it('restores a minimized window, shows one hidden to the tray, focuses it, then asks it to open Settings', () => {
    const { win, calls } = makeWin(true, false)
    openSettingsInWindow(win)
    expect(calls).toEqual(['restore', 'show', 'focus', `send:${OPEN_SETTINGS_CHANNEL}`])
  })

  it('a visible window is only focused and asked', () => {
    const { win, calls } = makeWin(false, true)
    openSettingsInWindow(win)
    expect(calls).toEqual(['focus', `send:${OPEN_SETTINGS_CHANNEL}`])
  })
})

describe('wiring (T0530 source guard)', () => {
  const main = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')
  const preload = readFileSync(resolve(__dirname, '../preload.ts'), 'utf8')

  it('main handles the request only for a detached sender and never writes settings itself', () => {
    const at = main.indexOf(`ipcMain.handle('${OPEN_SETTINGS_IN_PARENT_CHANNEL}', async (event)`)
    expect(at).toBeGreaterThan(main.indexOf("ipcMain.handle('workspace:reattach'"))
    const handler = main.slice(at, main.indexOf('// ── Agent Runtime IPC ──', at))
    expect(handler).toMatch(/getDetachedWorkspaceIdByWebContents\(event\.sender\)/)
    expect(handler).toMatch(/if \(workspaceId === null\) return \{ ok: false, reason: 'not-detached' \}/)
    expect(handler).toMatch(/detachedWindowRecords\.get\(workspaceId\)\?\.parentWindowId/)
    expect(handler).toMatch(/await resolveDetachedBinding\(workspaceId\)/)
    expect(handler).toMatch(/pickSettingsWindow\(\{[\s\S]*?windows: windowMap,/)
    expect(handler).toMatch(/openSettingsInWindow\(target\.win\)/)
    // Settings stay a single-editor affair: no settings write, no detached bookkeeping changed.
    expect(handler).not.toMatch(/settings:save|writeFile|detachedWindowRecords\.(set|delete)|detachedWindows\.(set|delete)/)
  })

  it('preload uses the same channels as main', () => {
    expect(preload).toContain(`openSettingsInParent: () => ipcRenderer.invoke('${OPEN_SETTINGS_IN_PARENT_CHANNEL}')`)
    expect(preload).toContain(`ipcRenderer.on('${OPEN_SETTINGS_CHANNEL}', handler)`)
    expect(preload).toContain(`ipcRenderer.removeListener('${OPEN_SETTINGS_CHANNEL}', handler)`)
  })
})
