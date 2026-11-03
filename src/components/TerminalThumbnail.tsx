import { useEffect, useState, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { useMenuPosition } from '../hooks/useMenuPosition'
import { useTranslation } from 'react-i18next'
import type { TerminalInstance } from '../types'
import { ActivityIndicator } from './ActivityIndicator'
import { settingsStore } from '../stores/settings-store'
import { getAgentPreset } from '../types/agent-presets'
import { titleShowsWorkorder } from '../lib/external-terminal-title'
import type { AgentDefinition } from '../types/agent-runtime'
import { hasNotification, subscribeNotification, clearNotification } from '../stores/terminal-notifications'
import { useUsageLimitStatus } from '../stores/usage-limit-store'
import { USAGE_LIMIT_MAX_CONSECUTIVE_SENDS, type UsageLimitStatus } from '../lib/usage-limit'
import { useMissedWait, useTerminalAttention, useWorkerResumed } from '../stores/terminal-attention-store'
import { OPEN_INTERRUPTED_AGENTS_EVENT, useInterruptedAgent } from '../stores/interrupted-agents-store'
import { missedWaitToShow, waitingForUser, workerAttention, type MissedWait, type WaitingForUser, type WorkerAttention } from '../lib/terminal-attention'
import { appendPreviewInput, outputPreview, textPreview } from '../lib/thumbnail-preview'
import { cancelNotifyHold, useNotifyHold } from '../stores/notify-hold-store'
import type { NotifyHoldItem } from '../types/notify-hold'

/** PLAN-044 / T0566: `15:05`-style local clock time of an epoch. */
function clockTime(epoch: number | null): string {
  if (epoch === null || !Number.isFinite(epoch)) return ''
  return new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** PLAN-044 / T0566: what the usage-limit badge tells the user (locale keys `usageLimit.*`). */
function usageLimitTooltip(t: (key: string, options?: Record<string, unknown>) => string, status: UsageLimitStatus): string {
  const reset = status.resetText || clockTime(status.resetsAt) || t('usageLimit.unknownTime')
  if (status.state === 'scheduled') {
    return status.action === 'text'
      ? t('usageLimit.scheduledText', { time: clockTime(status.dueAt), reset })
      : t('usageLimit.scheduledEnter', { time: clockTime(status.dueAt) })
  }
  switch (status.hint) {
    case 'cli-auto': return t('usageLimit.cliAuto', { reset })
    case 'cli-stopped': return t('usageLimit.cliStopped')
    case 'cli-unavailable': return t('usageLimit.cliUnavailable', { reset })
    case 'weekly': return t('usageLimit.weekly', { reset })
    case 'no-reset-time': return t('usageLimit.noResetTime')
    case 'non-timed': return t('usageLimit.nonTimed')
    case 'not-yolo': return t('usageLimit.notYolo', { reset })
    case 'cap': return t('usageLimit.cap', { count: USAGE_LIMIT_MAX_CONSECUTIVE_SENDS })
  }
}

/** T0788 / BUG-196: what a held notification still holds (locale keys `notifyHold.parts*`). */
function notifyHoldParts(t: (key: string, options?: Record<string, unknown>) => string, item: NotifyHoldItem): string {
  if (item.hasText && item.hasEnter) return t('notifyHold.partsTextEnter')
  return item.hasEnter ? t('notifyHold.partsEnter') : t('notifyHold.partsText')
}

/** T0609 (BUG-153): the second tooltip line of a Worker badge (locale keys `workerTabs.*`). */
function workerAttentionTooltip(t: (key: string, options?: Record<string, unknown>) => string, attention: WorkerAttention | null): string {
  if (!attention) return t('workerTabs.notReportedTooltip')
  if (attention.kind === 'reported') return t('workerTabs.reportedTooltip', { message: attention.message })
  if (attention.kind === 'resumed') return t('workerTabs.resumedTooltip', { message: attention.message }) // T0694
  const time = clockTime(attention.since) || t('usageLimit.unknownTime')
  if (attention.kind === 'blocked') return t(`workerTabs.blockedTooltip.${attention.reason}`, { time })
  const asked = t('workerTabs.questionTooltip', { time })
  return attention.pending > 1 ? `${asked}\n${t('workerTabs.questionPendingTooltip', { count: attention.pending })}` : asked
}

/** T0735 (D200 ②④): the tooltip of a non-Worker tab's ⚠️ — the same lines as a Worker's ⚠️. */
export function waitingForUserTooltip(t: (key: string, options?: Record<string, unknown>) => string, waiting: WaitingForUser): string {
  return t(`workerTabs.blockedTooltip.${waiting.reason}`, { time: clockTime(waiting.since) || t('usageLimit.unknownTime') })
}

/** T0735 (D203 ②): the tooltip of a faded ⚠️ — when this window saw the wait begin, and that it ended. */
export function missedWaitTooltip(t: (key: string, options?: Record<string, unknown>) => string, missed: Pick<MissedWait, 'startedAt'>): string {
  return t('workerTabs.missedTooltip', { time: clockTime(missed.startedAt) || t('usageLimit.unknownTime') })
}

/**
 * T0609: the badge text — ⚠️ waits for the user, ? waits for the Tower, ✓ reported.
 * T0694: ↻ reported, then working again (a shape, not only a color: tells apart from ✓ without color).
 */
const WORKER_ATTENTION_MARK: Record<WorkerAttention['kind'], string> = { blocked: '⚠️', question: '?', resumed: '↻', reported: '✓' }

// Global preview cache - persists across component unmounts
const MAX_PREVIEW_CACHE = 100
const previewCache = new Map<string, string>()
const previewSubscribers = new Map<string, Set<() => void>>()

/** Remove a terminal's preview from the cache (call when terminal is destroyed) */
export function clearPreviewCache(terminalId: string) {
  previewCache.delete(terminalId)
  previewSubscribers.delete(terminalId)
}

function updatePreviewCache(id: string, value: string) {
  previewCache.set(id, value)
  previewSubscribers.get(id)?.forEach(fn => fn())
}

function subscribeToPreview(id: string, fn: () => void): () => void {
  if (!previewSubscribers.has(id)) previewSubscribers.set(id, new Set())
  previewSubscribers.get(id)!.add(fn)
  return () => {
    const subs = previewSubscribers.get(id)
    if (!subs) return
    subs.delete(fn)
    if (subs.size === 0) previewSubscribers.delete(id)
  }
}

// Batched preview update — accumulate and flush via setTimeout to avoid per-chunk processing
const pendingPreviews = new Map<string, string>()
let previewTimerId = 0

function scheduleBatchedPreviewUpdate(id: string, data: string) {
  const prev = pendingPreviews.get(id) || previewCache.get(id) || ''
  // T0667: kept to its tail — output without `\n` (codex alt screen on Linux / macOS) used to grow forever
  pendingPreviews.set(id, appendPreviewInput(prev, data))
  if (!previewTimerId) {
    previewTimerId = window.setTimeout(() => {
      previewTimerId = 0
      for (const [tid, raw] of pendingPreviews) {
        updatePreviewCache(tid, outputPreview(raw))
      }
      pendingPreviews.clear()
      // Evict oldest entries if cache is too large
      if (previewCache.size > MAX_PREVIEW_CACHE) {
        const firstKey = previewCache.keys().next().value
        if (firstKey) previewCache.delete(firstKey)
      }
    }, 150)
  }
}

// Global listener setup - only once
let globalListenerSetup = false
const setupGlobalListener = () => {
  if (globalListenerSetup) return
  globalListenerSetup = true

  // PTY output for regular terminals — batched via RAF
  window.electronAPI.pty.onOutput((id, data) => {
    scheduleBatchedPreviewUpdate(id, data)
  })

  // Claude agent messages for agent terminal previews
  window.electronAPI.claude.onMessage((sessionId, message) => {
    const msg = message as { role?: string; content?: string }
    if (msg.role === 'assistant' && msg.content) {
      updatePreviewCache(sessionId, textPreview(msg.content))
    }
  })

  // Claude agent streaming text for live preview
  window.electronAPI.claude.onStream((sessionId, data) => {
    const stream = data as { text?: string }
    if (stream.text) {
      const prev = previewCache.get(sessionId) || ''
      updatePreviewCache(sessionId, textPreview(prev + stream.text))
    }
  })
}

interface TerminalThumbnailProps {
  terminal: TerminalInstance
  isActive: boolean
  isSplit?: boolean
  onClick: () => void
  onSplitTerminal?: (id: string, side?: 'left' | 'right') => void
  onSetSupervisor?: (id: string) => void
  onClearSupervisor?: () => void
  /** PLAN-041 / T0538: a Worker tab — the display name of the Tower that dispatched it */
  towerTitle?: string
  /** PLAN-041 / T0538: a Tower tab — how many Worker tabs it has here / how many have reported */
  workerCount?: number
  reportedWorkerCount?: number
  /** T0538: "Close this Worker" — same as ✕ (same confirm rules) */
  onCloseWorker?: (id: string) => void
  /** T0538: "Close reported Worker tabs (N)" — opens the in-page confirm listing them */
  onCloseReportedWorkers?: (towerId: string) => void
}

const dlog = (...args: unknown[]) => window.electronAPI?.debug?.log(...args)
let thumbRenderCount = 0
export const TerminalThumbnail = memo(function TerminalThumbnail({ terminal, isActive, isSplit, onClick, onSplitTerminal, onSetSupervisor, onClearSupervisor, towerTitle, workerCount = 0, reportedWorkerCount = 0, onCloseWorker, onCloseReportedWorkers }: TerminalThumbnailProps) {
  const { t } = useTranslation()
  thumbRenderCount++
  if (thumbRenderCount <= 30 || thumbRenderCount % 50 === 0) {
    dlog(`[render] Thumbnail render #${thumbRenderCount} id=${terminal.id.slice(0,8)} active=${isActive}`)
  }
  const [preview, setPreview] = useState<string>(previewCache.get(terminal.id) || '')
  const [fontFamily, setFontFamily] = useState<string>(settingsStore.getFontFamilyString())
  // T0133: Notification badge — subscribes to cross-terminal auto-notify events
  const [notified, setNotified] = useState<boolean>(hasNotification(terminal.id))

  // Check if this is an agent terminal
  const isAgent = terminal.agentPreset && terminal.agentPreset !== 'none'
  const presetConfig = isAgent ? getAgentPreset(terminal.agentPreset!) : null
  const [registryDef, setRegistryDef] = useState<AgentDefinition | null>(null)

  useEffect(() => {
    if (isAgent && !presetConfig && terminal.agentPreset) {
      window.electronAPI.agent?.getDefinition(terminal.agentPreset).then((def: AgentDefinition | null) => {
        setRegistryDef(def)
      }).catch(() => {})
    }
  }, [isAgent, presetConfig, terminal.agentPreset])

  const agentConfig = presetConfig || (registryDef ? { id: registryDef.id, name: registryDef.name, icon: registryDef.icon, color: registryDef.color } : null)

  useEffect(() => {
    setupGlobalListener()

    // Subscribe to cache updates for this terminal (event-driven, no polling)
    const unsubscribePreview = subscribeToPreview(terminal.id, () => {
      setPreview(previewCache.get(terminal.id) || '')
    })

    // Subscribe to settings changes for font updates
    const unsubscribeSettings = settingsStore.subscribe(() => {
      setFontFamily(settingsStore.getFontFamilyString())
    })

    // T0133: Subscribe to notification badge changes for this terminal
    const unsubscribeNotify = subscribeNotification(terminal.id, () => {
      setNotified(hasNotification(terminal.id))
    })

    return () => {
      unsubscribePreview()
      unsubscribeSettings()
      unsubscribeNotify()
    }
  }, [terminal.id])

  // T0133: Clear notification badge when user switches to this terminal
  useEffect(() => {
    if (isActive && hasNotification(terminal.id)) {
      clearNotification(terminal.id)
    }
  }, [isActive, terminal.id])

  const isSupervisor = terminal.role === 'supervisor'
  // PLAN-041 / T0538: a Worker tab (T0537 ownership) shows its work order; ✓ once it reported.
  const isWorker = !!terminal.towerTerminalId && !!terminal.workorder
  // T0553: the default title ends with the work order (`<agent> · Worker · T####`), so the badge
  // only shows ✓ once it reported; a title the user gave the tab keeps the T0538 badge.
  const workorderInTitle = isWorker && titleShowsWorkorder(terminal.title, terminal.workorder!)
  // T0609 (BUG-153): waits for the user (⚠️) / for its Tower (?) / reported (✓) — main's
  // `terminal:attention-changed` first, then the Worker's latest report
  const attentionEvent = useTerminalAttention(terminal.id)
  // T0694: reported, then a turn started (main's `busy` after this window saw the report) → ↻, not ✓
  const resumed = useWorkerResumed(terminal.id)
  const attention = isWorker ? workerAttention(terminal, attentionEvent, resumed) : null
  const showWorkerBadge = isWorker && (!workorderInTitle || !!attention)
  // T0735 (D200 ②): any other tab that waits for the user (claude hook / codex `input`) shows ⚠️ too;
  // a Worker keeps its own badge (?, ✓, ↻ and the batch close unchanged)
  const waiting = isWorker ? null : waitingForUser(attentionEvent)
  // T0735 (D203 ②): a wait that ended before the user looked at this tab — faded ⚠️ (Workers too:
  // next to their own badge, which is unchanged)
  const missedWait = useMissedWait(terminal.id)
  const missed = missedWaitToShow(attentionEvent, missedWait)
  // PLAN-044 / T0566: the tab's usage-limit state (main's `terminal:usage-limit-status`, memory only)
  const usageLimit = useUsageLimitStatus(terminal.id)
  // PLAN-055 B1 / T0766: its agent was interrupted by a Terminal Server recovery (memory only);
  // T0822: an upgrade-caused entry (`cause: 'upgrade'`, T0821) gets its own tooltip
  const interrupted = useInterruptedAgent(terminal.id)
  const workerTooltip = isWorker
    ? [
        t('workerTabs.badgeTooltip', { workorder: terminal.workorder, tower: towerTitle || terminal.towerTerminalId!.slice(0, 8) }),
        workerAttentionTooltip(t, attention),
      ].join('\n')
    : undefined
  // T0788 / BUG-196: Worker notifications main holds while this tab waits for the user (memory only)
  const heldNotifications = useNotifyHold(terminal.id)
  const [holdMenu, setHoldMenu] = useState<{ x: number; y: number } | null>(null)
  const { pos: holdPos, menuRef: holdRef } = useMenuPosition(holdMenu)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const { pos: ctxPos, menuRef: ctxRef } = useMenuPosition(ctxMenu)

  // T0788: the list is a popover — an outside click closes it; nothing left to show closes it too
  useEffect(() => {
    if (!holdMenu) return
    const close = () => setHoldMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [holdMenu])
  useEffect(() => {
    if (holdMenu && heldNotifications.length === 0) setHoldMenu(null)
  }, [holdMenu, heldNotifications.length])

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [ctxMenu])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div
      className={`thumbnail ${isActive ? 'active' : ''} ${isSplit ? 'split' : ''} ${isAgent ? 'agent-terminal' : ''} ${isSupervisor ? 'supervisor' : ''}`}
      data-workorder={isWorker ? terminal.workorder : undefined}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      style={agentConfig ? { '--agent-color': agentConfig.color } as React.CSSProperties : undefined}
    >
      <div className="thumbnail-header">
        <div className={`thumbnail-title ${isAgent ? 'agent-terminal' : ''}`}>
          {isSupervisor && <span title="Supervisor" className="supervisor-badge">👁</span>}
          {isSplit && <span title="Split" className="split-badge">⫿</span>}
          {isAgent && <span>{agentConfig?.icon}</span>}
          <span title={workorderInTitle && !attention ? workerTooltip : undefined}>{terminal.title}</span>
          {terminal.remoteOrigin && (
            <span className="remote-origin-badge" title={t('workerTabs.remoteOriginTooltip')}>{t('profiles.remote')}</span>
          )}
          {showWorkerBadge && (
            <span
              className={`worker-badge${attention ? ` ${attention.kind}` : ''}`}
              title={workerTooltip}
              data-workorder={terminal.workorder}
              data-attention={attention?.kind}
              data-blocked-reason={attention?.kind === 'blocked' ? attention.reason : undefined}
            >
              {attention
                ? (workorderInTitle ? WORKER_ATTENTION_MARK[attention.kind] : `${WORKER_ATTENTION_MARK[attention.kind]} ${terminal.workorder}`)
                : terminal.workorder}
            </span>
          )}
          {waiting && (
            <span
              className="attention-badge blocked"
              title={waitingForUserTooltip(t, waiting)}
              data-attention="blocked"
              data-blocked-reason={waiting.reason}
            >
              {WORKER_ATTENTION_MARK.blocked}
            </span>
          )}
          {missed && (
            <span
              className="attention-badge missed"
              title={missedWaitTooltip(t, missed)}
              data-attention="missed"
              data-blocked-reason={missed.reason}
            >
              {WORKER_ATTENTION_MARK.blocked}
            </span>
          )}
          {interrupted && (
            <span
              className="interrupted-agent-badge"
              title={t(interrupted.cause === 'upgrade' ? 'interruptedAgents.badgeUpgradeTooltip' : 'interruptedAgents.badgeTooltip')}
              data-interrupted-agent={interrupted.agent}
              style={{ cursor: 'pointer', flexShrink: 0 }}
              onClick={(e) => {
                e.stopPropagation()
                window.dispatchEvent(new CustomEvent(OPEN_INTERRUPTED_AGENTS_EVENT))
              }}
            >
              ⏸
            </span>
          )}
          {heldNotifications.length > 0 && (
            <span
              className="notify-hold-badge"
              title={t('notifyHold.badgeTooltip', { count: heldNotifications.length })}
              data-notify-hold={heldNotifications.length}
              style={{ cursor: 'pointer', flexShrink: 0, fontSize: '0.85em', padding: '0 4px', borderRadius: 4, background: 'var(--bg-tertiary, rgba(128,128,128,0.25))' }}
              onClick={(e) => {
                e.stopPropagation()
                setCtxMenu(null)
                setHoldMenu(holdMenu ? null : { x: e.clientX, y: e.clientY })
              }}
            >
              📨 {t('notifyHold.badge', { count: heldNotifications.length })}
            </span>
          )}
          {usageLimit && (
            <span
              className={`usage-limit-badge ${usageLimit.state}`}
              title={usageLimitTooltip(t, usageLimit)}
              data-usage-limit={usageLimit.state === 'scheduled' ? `scheduled-${usageLimit.action}` : usageLimit.hint}
            >
              {usageLimit.state === 'scheduled' ? `⏳ ${clockTime(usageLimit.dueAt)}` : t('usageLimit.badge')}
            </span>
          )}
          {notified && <span title="New notification" className="notification-badge">●</span>}
        </div>
        <ActivityIndicator terminalId={terminal.id} size="small" />
      </div>
      <div className="thumbnail-preview" style={{ fontFamily }}>
        {preview || (isAgent ? '' : '$ _')}
      </div>
      {holdMenu && heldNotifications.length > 0 && createPortal(
        <div
          ref={holdRef}
          className="context-menu notify-hold-menu"
          data-terminal-id={terminal.id}
          style={{
            ...(holdPos
              ? { position: 'fixed' as const, left: holdPos.x, top: holdPos.y, zIndex: 1000 }
              : { position: 'fixed' as const, left: holdMenu.x, top: holdMenu.y, zIndex: 1000, visibility: 'hidden' as const }),
            maxWidth: 360,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '6px 10px', fontWeight: 600 }}>{t('notifyHold.title', { count: heldNotifications.length })}</div>
          <div style={{ padding: '0 10px 6px', fontSize: '0.85em', opacity: 0.8, whiteSpace: 'normal' }}>{t('notifyHold.desc')}</div>
          {heldNotifications.map(item => (
            <div
              key={item.holdId}
              className="notify-hold-item"
              data-hold-id={item.holdId}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 10px' }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.workorder || t('notifyHold.source', { id: item.sourceTerminalId ? item.sourceTerminalId.slice(0, 8) : '?' })}
                {' · '}{clockTime(item.heldAt)}{' · '}{notifyHoldParts(t, item)}
              </span>
              <button
                className="context-menu-item"
                data-action="cancel-held-notification"
                style={{ width: 'auto', flexShrink: 0 }}
                onClick={() => { void cancelNotifyHold(terminal.id, item.holdId) }}
              >
                {t('notifyHold.cancel')}
              </button>
            </div>
          ))}
          <button
            className="context-menu-item"
            data-action="cancel-all-held-notifications"
            onClick={() => { void cancelNotifyHold(terminal.id); setHoldMenu(null) }}
          >
            ✕ {t('notifyHold.cancelAll')}
          </button>
        </div>,
        document.body
      )}
      {ctxMenu && createPortal(
        <div
          ref={ctxRef}
          className="context-menu"
          style={ctxPos
            ? { position: 'fixed', left: ctxPos.x, top: ctxPos.y, zIndex: 1000 }
            : { position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 1000, visibility: 'hidden' as const }
          }
          onClick={e => e.stopPropagation()}
        >
          {onSplitTerminal && (
            isSplit ? (
              <button className="context-menu-item" onClick={() => { onSplitTerminal(terminal.id); setCtxMenu(null) }}>
                ✕ {t('workspace.unsplit')}
              </button>
            ) : (
              <>
                <button className="context-menu-item" onClick={() => { onSplitTerminal(terminal.id, 'left'); setCtxMenu(null) }}>
                  ◧ {t('workspace.splitLeft')}
                </button>
                <button className="context-menu-item" onClick={() => { onSplitTerminal(terminal.id, 'right'); setCtxMenu(null) }}>
                  ◨ {t('workspace.splitRight')}
                </button>
              </>
            )
          )}
          {isSupervisor ? (
            <button className="context-menu-item" onClick={() => { onClearSupervisor?.(); setCtxMenu(null) }}>
              ✕ {t('workspace.removeSupervisor')}
            </button>
          ) : (
            <button className="context-menu-item" onClick={() => { onSetSupervisor?.(terminal.id); setCtxMenu(null) }}>
              👁 {t('workspace.setSupervisor')}
            </button>
          )}
          {isWorker && onCloseWorker && (
            <button className="context-menu-item" data-action="close-worker" onClick={() => { onCloseWorker(terminal.id); setCtxMenu(null) }}>
              ✕ {t('workerTabs.closeWorker')}
            </button>
          )}
          {workerCount > 0 && onCloseReportedWorkers && (
            <button
              className="context-menu-item"
              data-action="close-reported-workers"
              disabled={reportedWorkerCount === 0}
              onClick={() => { onCloseReportedWorkers(terminal.id); setCtxMenu(null) }}
            >
              ✕ {t('workerTabs.closeReported', { count: reportedWorkerCount })}
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
})
