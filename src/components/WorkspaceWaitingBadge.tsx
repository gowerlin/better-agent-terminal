/**
 * T0735 (D200 / D202): the "waits for the user" ⚠️ outside the thumbnails.
 *
 *   where                                   shows                        click
 *   workspace row, left of the status dot   ⚠️ / ⚠️ N (its tabs)          the workspace + its tab waiting longest
 *   工作區 tab title (docked side panels)    ⚠️ N (all listed workspaces)  only the 工作區 tab (the button's own click)
 *   collapsed sidebar bar                   ⚠️ N (all listed workspaces)  expands the sidebar on the 工作區 tab
 *
 * All three read `waitingSummary` (src/lib/terminal-attention.ts) — the rule is never inlined here.
 * Tooltips list tab titles / workspace names and the reason, never a question's text.
 * D203: a wait that ended unseen leaves a faded ⚠️ (`.missed`, no count) where nothing waits now;
 * any tab still waiting shows the solid one with the waiting count (`waitingMarkKind`).
 *
 * T0761 (D200 ⑥ / D212): a detached workspace has no row in its parent's list. Its detached window
 * sums its own workspace (`DetachedWaitingReporter`) and main forwards that to the parent, which
 * shows a row only while something waits or was missed (`DetachedWorkspaceWaitingRows`, below
 * the list: `↗ <name>（已分離） ⚠️ N`) and counts it in the 工作區 tab title and the collapsed bar.
 * A click brings the detached window to the front on the tab waiting longest.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { workspaceStore } from '../stores/workspace-store'
import { getDetachedWaiting, getMissedWait, getTerminalAttention, useTerminalAttentionVersion } from '../stores/terminal-attention-store'
import { detachedWaitingReport, detachedWaitingWorkspaces, mergeWaitingSummary, waitingClickTarget, waitingMarkKind, waitingSummary, type WaitingMarkKind, type WaitingSummary, type WaitingTab, type WaitingWorkspace, type WaitingWorkspaceSource } from '../lib/terminal-attention'
import { missedWaitTooltip, waitingForUserTooltip } from './TerminalThumbnail'

/**
 * The summary over `workspaces`, re-rendered on any attention or terminal list change.
 * T0761: + `detachedWorkspaces` (main window: its detached ones), from their windows' reports.
 */
export function useWaitingSummary(workspaces: readonly WaitingWorkspaceSource[], detachedWorkspaces: readonly WaitingWorkspaceSource[] = []): WaitingSummary {
  useTerminalAttentionVersion()
  const terminals = useSyncExternalStore(
    (listener) => workspaceStore.subscribe(listener),
    () => workspaceStore.getState().terminals,
  )
  const local = waitingSummary(terminals, workspaces, getTerminalAttention, getMissedWait)
  return mergeWaitingSummary(local, detachedWaitingWorkspaces(detachedWorkspaces, getDetachedWaiting))
}

/** A workspace ⚠️'s tooltip: the waiting / missed tabs, then what a click does (`clickLine`). */
function workspaceWaitingTooltip(t: TFunction, entry: WaitingWorkspace, clickLine: string): string {
  const waiting = entry.tabs
  return [
    waiting.length > 0 ? t('sidebar.waitingForUserTooltip', { count: waiting.length }) : t('sidebar.waitingForUserMissedTooltip'),
    ...waiting.map(tab => `• ${tab.title}: ${waitingForUserTooltip(t, tab)}`),
    ...entry.missed.map(tab => `• ${tab.title}: ${missedWaitTooltip(t, tab)}`),
    clickLine,
  ].join('\n')
}

/**
 * D200 ③④⑤ / D202 ①: ⚠️ on a workspace row whose tabs wait for the user (the active workspace
 * included); `⚠️ N` when N > 1. A click goes to the workspace and selects the tab waiting longest;
 * a click elsewhere on the row still only selects the workspace.
 */
export function WorkspaceWaitingBadge({ workspace, onSelectWorkspace }: { workspace: WaitingWorkspaceSource; onSelectWorkspace: (id: string) => void }) {
  const { t } = useTranslation()
  const summary = useWaitingSummary([workspace])
  const entry = summary.workspaces[0]
  const kind = waitingMarkKind(entry?.tabs.length ?? 0, entry?.missed.length ?? 0)
  const target = entry ? waitingClickTarget(entry) : null
  if (!entry || !kind || !target) return null
  const waiting = entry.tabs
  const tooltip = workspaceWaitingTooltip(t, entry, t('sidebar.waitingForUserClick', { title: target.title }))
  return (
    <span
      className={badgeClass(kind)}
      title={tooltip}
      data-waiting={kind}
      data-waiting-count={waiting.length}
      data-waiting-target={target.id}
      onClick={(e) => {
        e.stopPropagation()
        focusWaitingTab(workspace.id, target, onSelectWorkspace)
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {kind === 'waiting' ? waitingMark(waiting.length) : '⚠️'}
    </span>
  )
}

/**
 * D202 ②③: the total over the listed workspaces, on the 工作區 tab title or the collapsed bar.
 * `onClick` absent ⇒ the click goes to the element around it (the tab button).
 */
export function WaitingTotalBadge({ workspaces, detachedWorkspaces, hintKey, onClick, className }: {
  workspaces: readonly WaitingWorkspaceSource[]
  /** T0761: the window's detached workspaces (counted from their windows' reports). */
  detachedWorkspaces?: readonly WaitingWorkspaceSource[]
  /** The tooltip's last line: what a click does. */
  hintKey: 'sidebar.waitingForUserShowList' | 'sidebar.waitingForUserExpand'
  onClick?: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const summary = useWaitingSummary(workspaces, detachedWorkspaces)
  const kind = waitingMarkKind(summary.total, summary.missedTotal)
  if (!kind) return null
  const waitingWorkspaces = summary.workspaces.filter(ws => ws.tabs.length > 0)
  const tooltip = [
    kind === 'waiting'
      ? t('sidebar.waitingForUserWorkspacesTooltip', { count: summary.total, workspaces: waitingWorkspaces.length })
      : t('sidebar.waitingForUserMissedTooltip'),
    ...summary.workspaces.map(ws => {
      const name = ws.detached ? t('sidebar.detachedWorkspaceName', { name: ws.name }) : ws.name
      return ws.tabs.length > 0
        ? t('sidebar.waitingForUserWorkspaceLine', { name, count: ws.tabs.length })
        : t('sidebar.waitingForUserWorkspaceMissedLine', { name })
    }),
    t(hintKey),
  ].join('\n')
  return (
    <span
      className={`${badgeClass(kind)} waiting-total${className ? ` ${className}` : ''}`}
      title={tooltip}
      data-waiting={kind}
      data-waiting-count={summary.total}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick() } : undefined}
    >
      {kind === 'waiting' ? waitingMark(summary.total) : '⚠️'}
    </span>
  )
}

function badgeClass(kind: Exclude<WaitingMarkKind, null>): string {
  return kind === 'waiting' ? 'workspace-waiting-badge' : 'workspace-waiting-badge missed'
}

/** ⚠️, with the count once two or more tabs wait. */
export function waitingMark(count: number): string {
  return count > 1 ? `⚠️ ${count}` : '⚠️'
}

/**
 * D200 ⑤: select `workspaceId` and its tab `tab`, and show that workspace's terminal view (as a
 * thumbnail click does: `workspace-switch-tab`, once the workspace is the active one).
 */
export function focusWaitingTab(workspaceId: string, tab: Pick<WaitingTab, 'id'>, onSelectWorkspace: (id: string) => void): void {
  onSelectWorkspace(workspaceId)
  workspaceStore.setFocusedTerminal(tab.id)
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'terminal' } }))
  }, 0)
  window.electronAPI?.debug?.log?.(`[workspace-waiting] go to workspace=${workspaceId} terminal=${tab.id}`)
}

/**
 * T0761 (D212): main window — one row per detached workspace while its detached window reports a
 * waiting or missed tab (nothing otherwise: the list still hides detached workspaces). A click
 * anywhere on the row brings the detached window to the front on the tab waiting longest
 * (`waitingClickTarget`, as D200 ⑤).
 */
export function DetachedWorkspaceWaitingRows({ workspaces }: { workspaces: readonly WaitingWorkspaceSource[] }) {
  const { t } = useTranslation()
  const summary = useWaitingSummary([], workspaces)
  if (summary.workspaces.length === 0) return null
  return (
    <div className="detached-waiting-list">
      {summary.workspaces.map(entry => {
        const kind = waitingMarkKind(entry.tabs.length, entry.missed.length)
        const target = waitingClickTarget(entry)
        if (!kind || !target) return null
        const name = t('sidebar.detachedWorkspaceName', { name: entry.name })
        const tooltip = workspaceWaitingTooltip(t, entry, t('sidebar.detachedWaitingClick', { title: target.title }))
        return (
          <div
            key={entry.workspaceId}
            className="workspace-item detached-waiting-item"
            data-detached-workspace={entry.workspaceId}
            title={tooltip}
            onClick={() => focusDetachedWaitingTab(entry.workspaceId, target)}
          >
            <div className="workspace-item-content">
              <div className="workspace-item-info">
                <span className="workspace-alias">{`\u2197 ${name}`}</span>
              </div>
              <div className="workspace-item-actions">
                <span
                  className={badgeClass(kind)}
                  data-waiting={kind}
                  data-waiting-count={entry.tabs.length}
                  data-waiting-target={target.id}
                >
                  {kind === 'waiting' ? waitingMark(entry.tabs.length) : '⚠️'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** T0761: the detached window of `workspaceId` comes to the front and selects tab `tab` there. */
export function focusDetachedWaitingTab(workspaceId: string, tab: Pick<WaitingTab, 'id'>): void {
  window.electronAPI?.debug?.log?.(`[workspace-waiting] go to detached workspace=${workspaceId} terminal=${tab.id}`)
  Promise.resolve(window.electronAPI.workspace.focusDetachedTerminal(workspaceId, tab.id)).then((result) => {
    if (result !== 'focused' && result !== 'restored') {
      window.electronAPI?.debug?.log?.(`[workspace-waiting] detached workspace=${workspaceId} terminal=${tab.id} → ${String(result)}`)
    }
  }).catch((err: unknown) => {
    window.electronAPI?.debug?.log?.(`[workspace-waiting] detached workspace=${workspaceId} focus failed: ${String(err)}`)
  })
}

/**
 * T0761 (D212): detached window — sends its workspace's summary entry to its parent (through main)
 * whenever it changes, an empty one included (the parent's row goes away). Renders nothing.
 */
export function DetachedWaitingReporter({ workspace }: { workspace: WaitingWorkspaceSource }) {
  const summary = useWaitingSummary([workspace])
  const key = JSON.stringify(detachedWaitingReport(summary.workspaces[0]))
  const lastSent = useRef<string | null>(null)
  useEffect(() => {
    if (lastSent.current === key) return
    lastSent.current = key
    window.electronAPI.workspace.reportDetachedWaiting(JSON.parse(key))
  }, [key])
  return null
}
