import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModalOverlay } from './common/ModalOverlay'
import { workspaceStore } from '../stores/workspace-store'
import {
  OPEN_INTERRUPTED_AGENTS_EVENT,
  forgetInterruptedAgent,
  getInterruptedAgent,
  isCodexResumableAgent,
  isResumableAgent,
  resumeInterruptedAgent,
  setInterruptedAgents,
  useInterruptedAgents,
  type InterruptedAgentInfo,
} from '../stores/interrupted-agents-store'

/**
 * PLAN-055 B1 / T0766 (D211): the agent tabs a Terminal Server recovery interrupted (this window's
 * tabs only), grouped by workspace — Towers first, Workers last (a Worker reports to its Tower's
 * tab). Per row: 恢復 (claude: `--resume=<id>`, or claude's resume menu when the session id is
 * unknown) and 略過; at the bottom 全部恢復 and 關閉. PLAN-055 B2 / T0767: codex rows resume with
 * codex's own `resume` menu (sessions of the tab's directory; BAT knows no codex session id);
 * unknown rows have no resume. Nothing resumes on its own (P-1).
 * T0563 / T0567: `ModalOverlay`, an [X], Esc = close (keeps the list, resumes nothing).
 */

export interface InterruptedAgentRow {
  agent: InterruptedAgentInfo
  title: string
  workspaceId: string
  workspaceName: string
}

/** Towers, then plain tabs, then Workers; the order main listed them within each. */
function rank(agent: InterruptedAgentInfo): number {
  if (agent.role === 'tower') return 0
  if (agent.workorder || agent.towerTerminalId) return 2
  return 1
}

/** Rows grouped by workspace (first-seen order), each group sorted Towers → tabs → Workers. */
export function groupInterruptedAgentRows(rows: readonly InterruptedAgentRow[]): Array<{ workspaceId: string; workspaceName: string; rows: InterruptedAgentRow[] }> {
  const groups = new Map<string, { workspaceId: string; workspaceName: string; rows: InterruptedAgentRow[] }>()
  for (const row of rows) {
    const group = groups.get(row.workspaceId) ?? { workspaceId: row.workspaceId, workspaceName: row.workspaceName, rows: [] }
    group.rows.push(row)
    groups.set(row.workspaceId, group)
  }
  for (const group of groups.values()) {
    group.rows = group.rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => rank(a.row.agent) - rank(b.row.agent) || a.index - b.index)
      .map(({ row }) => row)
  }
  return [...groups.values()]
}

interface InterruptedAgentsDialogProps {
  rows: InterruptedAgentRow[]
  /** terminal ids being resumed right now (buttons disabled). */
  busy: ReadonlySet<string>
  /** The last outcome line (resumed / custom args / failed), or null. */
  message: string | null
  onResume: (terminalId: string) => void
  onResumeAll: () => void
  onDismiss: (terminalId: string) => void
  onClose: () => void
}

export function InterruptedAgentsDialog({ rows, busy, message, onResume, onResumeAll, onDismiss, onClose }: Readonly<InterruptedAgentsDialogProps>) {
  const { t } = useTranslation()
  const groups = groupInterruptedAgentRows(rows)
  const resumable = rows.filter(row => isResumableAgent(row.agent))
  const towerFirst = rows.some(row => row.agent.role === 'tower') && rows.some(row => !!(row.agent.workorder || row.agent.towerTerminalId))

  const statusOf = (agent: InterruptedAgentInfo): string => {
    if (isCodexResumableAgent(agent)) return t('interruptedAgents.codexPicker')
    if (isResumableAgent(agent)) {
      return agent.claudeSessionId
        ? t('interruptedAgents.sessionKnown', { id: agent.claudeSessionId.slice(0, 8) })
        : t('interruptedAgents.sessionUnknown')
    }
    return t('interruptedAgents.unknownAgent')
  }

  return (
    <ModalOverlay className="dialog-overlay" onEscape={onClose}>
      <div className="dialog interrupted-agents-dialog" role="dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, width: '100%' }}>
        <div className="dialog-header">
          <h3 style={{ margin: 0 }}>{t('interruptedAgents.title')}</h3>
          <button className="dialog-close-btn interrupted-agents-x" aria-label={t('common.close')} title={t('common.close')} onClick={onClose}>×</button>
        </div>
        <p>{t('interruptedAgents.desc')}</p>
        {towerFirst && <p className="interrupted-agents-tower-first" style={{ color: 'var(--text-secondary)' }}>{t('interruptedAgents.towerFirst')}</p>}
        <div className="interrupted-agents-groups" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {groups.map(group => (
            <section key={group.workspaceId} className="interrupted-agents-group" data-workspace-id={group.workspaceId}>
              <h4 style={{ margin: '8px 0 4px' }}>{group.workspaceName}</h4>
              <ul className="interrupted-agents-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {group.rows.map(({ agent, title }) => {
                  const canResume = isResumableAgent(agent)
                  const isBusy = busy.has(agent.terminalId)
                  return (
                    <li
                      key={agent.terminalId}
                      data-terminal-id={agent.terminalId}
                      data-agent={agent.agent}
                      data-resumable={canResume ? 'true' : 'false'}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
                    >
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={agent.cwd}>
                        {agent.role === 'tower' && <span className="worker-badge">{t('interruptedAgents.tower')}</span>}{' '}
                        {agent.workorder && <span className="worker-badge">{t('interruptedAgents.worker', { workorder: agent.workorder })}</span>}{' '}
                        <span className="interrupted-agents-title">{title}</span>{' '}
                        <span className="interrupted-agents-status" style={{ color: 'var(--text-secondary)' }}>{statusOf(agent)}</span>
                      </span>
                      {canResume && (
                        <button className="dialog-btn confirm" data-action="resume" disabled={isBusy} onClick={() => onResume(agent.terminalId)}>
                          {agent.claudeSessionId && !isCodexResumableAgent(agent) ? t('interruptedAgents.resume') : t('interruptedAgents.resumePicker')}
                        </button>
                      )}
                      <button className="dialog-btn cancel" data-action="dismiss" disabled={isBusy} onClick={() => onDismiss(agent.terminalId)}>
                        {t('interruptedAgents.dismiss')}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
        {message && <p className="interrupted-agents-message" role="status">{message}</p>}
        <div className="dialog-actions">
          <button className="dialog-btn cancel" data-action="close" onClick={onClose}>
            {t('common.close')}
          </button>
          <button className="dialog-btn confirm" data-action="resume-all" disabled={resumable.length === 0 || resumable.every(row => busy.has(row.agent.terminalId))} onClick={onResumeAll}>
            {t('interruptedAgents.resumeAll', { count: resumable.length })}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

/**
 * T0766: App's part — main's list (event + pull on mount), this window's tabs only (a workspace
 * shown in a detached window is excluded from the main window), the dialog (opened by a recovery
 * that interrupted one of this window's tabs, the ⏸ mark, the recovery toast) and its actions.
 */
export function InterruptedAgentsController({ excludeWorkspaceIds }: Readonly<{ excludeWorkspaceIds?: ReadonlySet<string> }>) {
  const { t } = useTranslation()
  const agents = useInterruptedAgents()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set())
  const [message, setMessage] = useState<string | null>(null)
  const rawRef = useRef<InterruptedAgentInfo[]>([])
  const excludeRef = useRef(excludeWorkspaceIds)
  excludeRef.current = excludeWorkspaceIds

  const owns = useCallback((terminalId: string) => {
    const terminal = workspaceStore.getState().terminals.find(tm => tm.id === terminalId)
    return !!terminal && !excludeRef.current?.has(terminal.workspaceId)
  }, [])

  useEffect(() => {
    const api = window.electronAPI?.terminalServer
    if (!api?.onAgentsInterrupted) return
    const apply = (list: InterruptedAgentInfo[] | null | undefined) => {
      rawRef.current = Array.isArray(list) ? list : []
      return setInterruptedAgents(rawRef.current, owns)
    }
    const unsub = api.onAgentsInterrupted((event) => {
      const kept = apply(event?.agents)
      if (event?.reason === 'recovery' && kept.length > 0) {
        setMessage(null)
        setOpen(true)
      }
    })
    // T0111 pattern: the list may predate this window (reload, a window opened after the recovery)
    api.queryInterruptedAgents?.().then(list => { apply(list) }).catch(() => { /* older main */ })
    // tabs loaded / moved later → re-filter the last list
    const unsubStore = workspaceStore.subscribe(() => { setInterruptedAgents(rawRef.current, owns) })
    const openDialog = () => { setMessage(null); setOpen(true) }
    window.addEventListener(OPEN_INTERRUPTED_AGENTS_EVENT, openDialog)
    return () => {
      unsub()
      unsubStore()
      window.removeEventListener(OPEN_INTERRUPTED_AGENTS_EVENT, openDialog)
    }
  }, [owns])

  useEffect(() => {
    setInterruptedAgents(rawRef.current, owns)
  }, [excludeWorkspaceIds, owns])

  useEffect(() => {
    if (open && agents.length === 0) setOpen(false)
  }, [open, agents.length])

  const rows: InterruptedAgentRow[] = useMemo(() => {
    const state = workspaceStore.getState()
    return agents.map(agent => {
      const terminal = state.terminals.find(tm => tm.id === agent.terminalId)
      const workspaceId = terminal?.workspaceId ?? agent.workspaceId ?? ''
      const workspace = state.workspaces.find(ws => ws.id === workspaceId)
      return {
        agent,
        title: terminal?.title ?? agent.claudeSessionName ?? agent.terminalId.slice(0, 8),
        workspaceId,
        workspaceName: workspace ? (workspace.alias || workspace.name) : '—',
      }
    })
  }, [agents])

  const resumeOne = useCallback(async (terminalId: string): Promise<void> => {
    const agent = getInterruptedAgent(terminalId)
    if (!agent) return
    const title = workspaceStore.getState().terminals.find(tm => tm.id === terminalId)?.title ?? terminalId.slice(0, 8)
    setBusy(prev => new Set(prev).add(terminalId))
    try {
      const result = await resumeInterruptedAgent(agent, {
        terminalOf: (id) => {
          const terminal = workspaceStore.getState().terminals.find(tm => tm.id === id)
          return terminal ? { agentPreset: terminal.agentPreset, workspaceId: terminal.workspaceId } : null
        },
        resumeInMain: (id) => window.electronAPI.terminalServer.resumeInterruptedAgent(id),
        activateWorkspace: (wsId) => workspaceStore.setActiveWorkspace(wsId),
      })
      window.electronAPI?.debug?.log(`[interrupted-agents] resume terminal=${terminalId} agent=${agent.agent} launchedBy=${agent.launchedBy} → ${result.ok ? `ok mode=${result.mode}${result.reason ? ` reason=${result.reason}` : ''}` : `failed ${result.code}`}`)
      const codex = isCodexResumableAgent(agent) // T0767: codex's own resume menu
      if (!result.ok) setMessage(t('interruptedAgents.resumeFailed', { title, reason: result.code }))
      else if (result.reason === 'user-args') setMessage(t(codex ? 'interruptedAgents.resumedCodexUserArgs' : 'interruptedAgents.resumedUserArgs', { title }))
      else if (codex) setMessage(t('interruptedAgents.resumedCodexPicker', { title }))
      else setMessage(t(result.mode === 'picker' ? 'interruptedAgents.resumedPicker' : 'interruptedAgents.resumed', { title }))
    } catch (err) {
      setMessage(t('interruptedAgents.resumeFailed', { title, reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(prev => {
        const next = new Set(prev)
        next.delete(terminalId)
        return next
      })
    }
  }, [t])

  const handleResumeAll = useCallback(async () => {
    // Towers first (groupInterruptedAgentRows order), one at a time
    for (const group of groupInterruptedAgentRows(rows)) {
      for (const row of group.rows) {
        if (isResumableAgent(row.agent)) await resumeOne(row.agent.terminalId)
      }
    }
  }, [rows, resumeOne])

  const handleDismiss = useCallback((terminalId: string) => {
    forgetInterruptedAgent(terminalId)
    void window.electronAPI.terminalServer.dismissInterruptedAgent(terminalId).catch(() => false)
  }, [])

  if (!open || rows.length === 0) return null
  return (
    <InterruptedAgentsDialog
      rows={rows}
      busy={busy}
      message={message}
      onResume={(id) => { void resumeOne(id) }}
      onResumeAll={() => { void handleResumeAll() }}
      onDismiss={handleDismiss}
      onClose={() => setOpen(false)}
    />
  )
}
