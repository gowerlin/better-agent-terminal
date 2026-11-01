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
 */
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { workspaceStore } from '../stores/workspace-store'
import { getMissedWait, getTerminalAttention, useTerminalAttentionVersion } from '../stores/terminal-attention-store'
import { waitingClickTarget, waitingMarkKind, waitingSummary, type WaitingMarkKind, type WaitingSummary, type WaitingTab, type WaitingWorkspaceSource } from '../lib/terminal-attention'
import { missedWaitTooltip, waitingForUserTooltip } from './TerminalThumbnail'

/** The summary over `workspaces`, re-rendered on any attention or terminal list change. */
export function useWaitingSummary(workspaces: readonly WaitingWorkspaceSource[]): WaitingSummary {
  useTerminalAttentionVersion()
  const terminals = useSyncExternalStore(
    (listener) => workspaceStore.subscribe(listener),
    () => workspaceStore.getState().terminals,
  )
  return waitingSummary(terminals, workspaces, getTerminalAttention, getMissedWait)
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
  const tooltip = [
    waiting.length > 0 ? t('sidebar.waitingForUserTooltip', { count: waiting.length }) : t('sidebar.waitingForUserMissedTooltip'),
    ...waiting.map(tab => `• ${tab.title}: ${waitingForUserTooltip(t, tab)}`),
    ...entry.missed.map(tab => `• ${tab.title}: ${missedWaitTooltip(t, tab)}`),
    t('sidebar.waitingForUserClick', { title: target.title }),
  ].join('\n')
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
export function WaitingTotalBadge({ workspaces, hintKey, onClick, className }: {
  workspaces: readonly WaitingWorkspaceSource[]
  /** The tooltip's last line: what a click does. */
  hintKey: 'sidebar.waitingForUserShowList' | 'sidebar.waitingForUserExpand'
  onClick?: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const summary = useWaitingSummary(workspaces)
  const kind = waitingMarkKind(summary.total, summary.missedTotal)
  if (!kind) return null
  const waitingWorkspaces = summary.workspaces.filter(ws => ws.tabs.length > 0)
  const tooltip = [
    kind === 'waiting'
      ? t('sidebar.waitingForUserWorkspacesTooltip', { count: summary.total, workspaces: waitingWorkspaces.length })
      : t('sidebar.waitingForUserMissedTooltip'),
    ...summary.workspaces.map(ws => ws.tabs.length > 0
      ? t('sidebar.waitingForUserWorkspaceLine', { name: ws.name, count: ws.tabs.length })
      : t('sidebar.waitingForUserWorkspaceMissedLine', { name: ws.name })),
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
