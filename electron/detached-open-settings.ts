/**
 * T0530 (BUG-133): "open settings" in a detached workspace window.
 *
 * A detached window renders only its workspace (no SettingsPanel), so its
 * `onOpenSettings` did nothing. Settings are global (`settings.json`) and every
 * renderer saves its whole in-memory copy, with no cross-window broadcast; a
 * second SettingsPanel in the detached window would add one more writer that
 * the main window's next save silently overwrites (and vice versa). Instead the
 * request goes to main, which brings the detached window's parent to the front
 * and tells it to open its SettingsPanel.
 */

/** Detached renderer → main. */
export const OPEN_SETTINGS_IN_PARENT_CHANNEL = 'workspace:open-settings-in-parent'
/** Main → the chosen main window's renderer. */
export const OPEN_SETTINGS_CHANNEL = 'app:open-settings'

export type OpenSettingsInParentResult =
  | { ok: true; windowId: string; viaParent: boolean }
  | { ok: false; reason: 'not-detached' | 'no-main-window' }

export interface SettingsTargetWindow {
  isDestroyed(): boolean
}

/**
 * The window that opens Settings for a detached window: its parent while that is
 * live, otherwise the most recently active live main window of the same profile.
 * `profileId` is the detached window's binding (`null` = none, a local window);
 * `undefined` = unresolved, then only the parent qualifies (never guess a window
 * of another profile — remote settings are that profile's server settings).
 */
export function pickSettingsWindow<W extends SettingsTargetWindow>(input: {
  parentWindowId: string | null
  profileId: string | null | undefined
  windows: ReadonlyMap<string, W>
  registryEntries: Iterable<{ id: string; profileId?: string | null; lastActiveAt?: number }>
}): { windowId: string; win: W } | null {
  const live = (id: string | null): W | null => {
    const win = id ? input.windows.get(id) : undefined
    return win && !win.isDestroyed() ? win : null
  }
  const parent = live(input.parentWindowId)
  if (parent && input.parentWindowId) return { windowId: input.parentWindowId, win: parent }
  if (input.profileId === undefined) return null
  let best: { windowId: string; win: W; lastActiveAt: number } | null = null
  for (const entry of input.registryEntries) {
    if ((entry.profileId ?? null) !== input.profileId) continue
    const win = live(entry.id)
    if (!win) continue
    const lastActiveAt = entry.lastActiveAt ?? 0
    if (!best || lastActiveAt > best.lastActiveAt) best = { windowId: entry.id, win, lastActiveAt }
  }
  return best ? { windowId: best.windowId, win: best.win } : null
}

export interface FocusableSettingsWindow {
  isMinimized(): boolean
  restore(): void
  isVisible(): boolean
  show(): void
  focus(): void
  webContents: { send(channel: string): void }
}

/** Brings the window to the front (it may be minimized or hidden to the tray) and opens its Settings. */
export function openSettingsInWindow(win: FocusableSettingsWindow): void {
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
  win.webContents.send(OPEN_SETTINGS_CHANNEL)
}
