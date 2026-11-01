// T0750 (BUG-183 / BUG-184): a profile's existing window when the profile is opened again, and
// the windows a deleted profile leaves behind. Shared by main (`electron/main.ts`) and the
// renderer (`src/App.tsx`); imports neither electron nor the DOM.

/** The BrowserWindow methods `bringWindowToFront` uses (a BrowserWindow satisfies it). */
export interface FrontableWindow {
  isDestroyed(): boolean
  isMinimized(): boolean
  isVisible(): boolean
  restore(): void
  show(): void
  focus(): void
}

/**
 * - `focused`: the window was already on screen (not hidden, not minimized) and got the focus.
 * - `restored`: the window was hidden (minimize to tray) or minimized and is on screen again.
 * - `not-shown`: the window is still not visible afterwards (or was destroyed).
 */
export type BringToFrontResult = 'focused' | 'restored' | 'not-shown'

/**
 * BUG-183: a window hidden by "minimize to tray" (`win.hide()`) stays in `windowMap`, so opening
 * its profile again found it "already open", but `focus()` alone never shows a hidden window.
 * Hidden → `show()`; minimized → `restore()` (as before); then `focus()`.
 */
export function bringWindowToFront(win: FrontableWindow): BringToFrontResult {
  if (win.isDestroyed()) return 'not-shown'
  const wasHidden = !win.isVisible()
  const wasMinimized = win.isMinimized()
  if (wasHidden) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
  if (win.isDestroyed() || !win.isVisible()) return 'not-shown'
  return wasHidden || wasMinimized ? 'restored' : 'focused'
}

/** `app:open-new-instance` answer, as far as the renderer's notice depends on it. */
export interface ProfileOpenResult {
  alreadyOpen?: boolean
  /** T0750: what bringing the existing window to the front did (absent from older main processes). */
  broughtToFront?: BringToFrontResult
}

/**
 * The renderer's notice after "open" in the profiles dialog:
 * - `already-open`: the window was already on screen (unchanged pre-T0750 notice "already open in another window").
 * - `not-shown`: the window could not be shown — point the user at the tray icon.
 * - `null`: a new window opened, or a hidden / minimized window came back (the user sees it; no notice).
 */
export type ProfileOpenNotice = 'already-open' | 'not-shown' | null

export function profileOpenNotice(result: ProfileOpenResult | null | undefined): ProfileOpenNotice {
  if (!result?.alreadyOpen) return null
  if (result.broughtToFront === 'restored') return null
  if (result.broughtToFront === 'not-shown') return 'not-shown'
  return 'already-open'
}

/** A window registry entry, as far as `planDeletedProfileWindows` needs it. */
export interface ProfileBoundEntry {
  id: string
  profileId?: string
}

export interface DeletedProfileWindowPlan {
  /** Live windows bound to the deleted profile: destroy them (and drop their entries). */
  closeIds: string[]
  /** Registry entries of the deleted profile without a live window: drop them. */
  staleEntryIds: string[]
  /**
   * Closing `closeIds` would leave no live window at all (with minimize-to-tray off the app
   * would quit): open the Default profile first.
   */
  openFallback: boolean
}

/**
 * BUG-184: deleting a profile in the profiles dialog (✕) removed the profile but left its open
 * windows alive and bound to a profile that no longer exists — listed in the tray menu, under
 * the same title as the window of a re-created profile of the same name.
 */
export function planDeletedProfileWindows(
  entries: readonly ProfileBoundEntry[],
  liveWindowIds: readonly string[],
  profileId: string,
): DeletedProfileWindowPlan {
  const live = new Set(liveWindowIds)
  const bound = entries.filter(e => e.profileId === profileId)
  const closeIds = bound.filter(e => live.has(e.id)).map(e => e.id)
  const staleEntryIds = bound.filter(e => !live.has(e.id)).map(e => e.id)
  const closing = new Set(closeIds)
  const openFallback = closeIds.length > 0 && liveWindowIds.every(id => closing.has(id))
  return { closeIds, staleEntryIds, openFallback }
}
