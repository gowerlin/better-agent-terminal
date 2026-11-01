// T0752 (D205): the labels of the per-window entries in the system tray menu. Used by main
// (`rebuildTrayMenu` in `electron/main.ts`); imports neither electron nor the DOM.

/** A tray menu window entry, as far as its label depends on it. */
export interface TrayWindowLabelSource {
  /** The window registry id (`windowMap` key). */
  id: string
  /** `win.getTitle()`; empty → `Window <first 8 chars of id>`. */
  title: string
}

/** The label a window entry had before T0752: its title, or `Window <id prefix>` when the title is empty. */
export function trayWindowBaseLabel(source: TrayWindowLabelSource): string {
  return source.title || `Window ${source.id.slice(0, 8)}`
}

/**
 * Labels for the tray menu's window entries, in the order given (the menu's own order).
 * Two profiles with the same name give windows with the same title, so the entries could not be
 * told apart: within one menu, the first entry with a label keeps it unchanged, later entries with
 * the same label get ` (2)`, ` (3)`, … in order. Labels that occur once are unchanged.
 */
export function trayWindowLabels(sources: readonly TrayWindowLabelSource[]): string[] {
  const seen = new Map<string, number>()
  return sources.map((source) => {
    const base = trayWindowBaseLabel(source)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
}
