// T0133: Worker→Tower auto-notify — tracks pending notification badges at two layers:
//   Layer 1: terminal badge (on TerminalThumbnail, clears when user switches to that terminal)
//   Layer 2: workspace badge (on workspace-item in Sidebar, clears when user switches to that workspace)
//
// Pub/sub pattern mirrors TerminalThumbnail's previewCache so consumers can subscribe per-id
// without prop drilling, while App.tsx can trigger toasts from the same event.

const notifiedTerminalIds = new Set<string>()
const notifiedWorkspaceIds = new Set<string>()
const terminalSubscribers = new Map<string, Set<() => void>>()
const workspaceSubscribers = new Map<string, Set<() => void>>()

export interface TerminalNotification {
  targetId: string
  message: string
  source?: string
}

// ── Terminal-level ──────────────────────────────────────────────────────────

/** Returns true if the given terminal has a pending notification badge. */
export function hasNotification(terminalId: string): boolean {
  return notifiedTerminalIds.has(terminalId)
}

/** Mark a terminal as notified. Caller may also mark the owning workspace via markWorkspaceNotified. */
export function markNotified(terminalId: string): void {
  if (notifiedTerminalIds.has(terminalId)) return
  notifiedTerminalIds.add(terminalId)
  terminalSubscribers.get(terminalId)?.forEach(fn => fn())
}

/** Clear the notification badge for a terminal (e.g. user switched to it). */
export function clearNotification(terminalId: string): void {
  if (!notifiedTerminalIds.delete(terminalId)) return
  terminalSubscribers.get(terminalId)?.forEach(fn => fn())
}

/** Subscribe to changes for a specific terminal id. Returns unsubscribe fn. */
export function subscribeNotification(terminalId: string, fn: () => void): () => void {
  if (!terminalSubscribers.has(terminalId)) terminalSubscribers.set(terminalId, new Set())
  terminalSubscribers.get(terminalId)!.add(fn)
  return () => {
    const subs = terminalSubscribers.get(terminalId)
    if (!subs) return
    subs.delete(fn)
    if (subs.size === 0) terminalSubscribers.delete(terminalId)
  }
}

// ── Workspace-level ─────────────────────────────────────────────────────────

/** Returns true if the workspace has a pending notification badge. */
export function hasWorkspaceNotification(workspaceId: string): boolean {
  return notifiedWorkspaceIds.has(workspaceId)
}

/** Mark a workspace as notified (used when the notified terminal is not in the active workspace). */
export function markWorkspaceNotified(workspaceId: string): void {
  if (notifiedWorkspaceIds.has(workspaceId)) return
  notifiedWorkspaceIds.add(workspaceId)
  workspaceSubscribers.get(workspaceId)?.forEach(fn => fn())
}

/** Clear the workspace notification badge (e.g. user switched to that workspace). */
export function clearWorkspaceNotification(workspaceId: string): void {
  if (!notifiedWorkspaceIds.delete(workspaceId)) return
  workspaceSubscribers.get(workspaceId)?.forEach(fn => fn())
}

/** Subscribe to changes for a specific workspace id. Returns unsubscribe fn. */
export function subscribeWorkspaceNotification(workspaceId: string, fn: () => void): () => void {
  if (!workspaceSubscribers.has(workspaceId)) workspaceSubscribers.set(workspaceId, new Set())
  workspaceSubscribers.get(workspaceId)!.add(fn)
  return () => {
    const subs = workspaceSubscribers.get(workspaceId)
    if (!subs) return
    subs.delete(fn)
    if (subs.size === 0) workspaceSubscribers.delete(workspaceId)
  }
}
