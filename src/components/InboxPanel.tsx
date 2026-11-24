/**
 * PLAN-068 W4 / T0906: the right sidebar「待辦」(Inbox) tab — skeleton and version gate (T0902 §1 / §6′).
 *
 * Fixed sections: ⏸ 待你決定 · 🙋 待你執行 · ⏰ 到期提醒 · 👷 Worker 等你 · 💬 塔台訊息 · 📋 塔台待辦 · 📊 counts.
 * W4 fills what BAT already has (pending-verify BUGs in 🙋, Worker waits, CT `todo`, counts); W5
 * (T0908) the CT contract v2 lists and the answers (src/components/inbox/InboxLists.tsx); 💬 shows the
 * turn cards (W6 / T0909, `TowerCardsSection`).
 *
 * 🔴 Gated as a whole (D328 R9′, T0906 Q-2): unless the selected Tower matches (§6′), only the Tower
 * picker and the hint (P-1 / P-2 / P-3) are shown. Read-only: data comes from `InboxDataSource` (the
 * Control Tower panel's pipeline) and the existing renderer stores; nothing is written anywhere.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInboxModel } from './inbox/useInboxModel'
import { InboxSection } from './inbox/InboxSection'
import { TowerCardsSection, type TowerCardsSource } from './inbox/TowerCardsSection'
import { loadInboxFiles } from './inbox/InboxDataSource'
import { ActionList, AwaitingList, RecentlyClosedList, ReminderList } from './inbox/InboxLists'
import { requestControlTowerTab, setInboxFiles, setSelectedInboxTower } from '../stores/inbox-store'
import { workspaceStore } from '../stores/workspace-store'
import { OPEN_INTERRUPTED_AGENTS_EVENT } from '../stores/interrupted-agents-store'
import {
  INBOX_FOLDED_STORAGE_KEY,
  foldTodo,
  inboxGateCode,
  inboxGateHint,
  panelTowerTerminalIds,
  parseFoldedSections,
  showsTowerPicker,
  type InboxSectionId,
  type WorkerWaitItem,
} from '../lib/inbox-model'
import { BAT_CONTRACT_VERSION } from '../lib/tower-contract'
import { towerStateBatContract } from '../lib/ct-tower-overview'
import { isCodexTower } from '../lib/tower-card-view'
import { getTowerContract } from '../stores/tower-contract-store'
import '../styles/inbox.css'

interface InboxPanelProps {
  workspaceId: string | null
  workspaceFolderPath: string | null
}

function loadFolded(): Record<InboxSectionId, boolean> {
  try {
    return parseFoldedSections(localStorage.getItem(INBOX_FOLDED_STORAGE_KEY))
  } catch {
    return parseFoldedSections(null)
  }
}

function saveFolded(folded: Record<InboxSectionId, boolean>): void {
  try {
    localStorage.setItem(INBOX_FOLDED_STORAGE_KEY, JSON.stringify(folded))
  } catch { /* a preference only */ }
}

function focusTerminal(id: string): void {
  workspaceStore.setFocusedTerminal(id)
  window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'terminal' } }))
}

export function InboxPanel({ workspaceId, workspaceFolderPath }: Readonly<InboxPanelProps>) {
  const { t } = useTranslation()
  const model = useInboxModel(workspaceId, workspaceFolderPath)
  const [folded, setFolded] = useState(loadFolded)
  const [openTodos, setOpenTodos] = useState<Set<number>>(() => new Set())

  const toggle = useCallback((id: InboxSectionId) => {
    setFolded(prev => {
      const next = { ...prev, [id]: !prev[id] }
      saveFolded(next)
      return next
    })
  }, [])

  const refresh = useCallback(() => {
    if (!workspaceFolderPath) return
    const folder = workspaceFolderPath
    void window.electronAPI.fs.resetWatch?.(`${folder}/_ct-workorders`)?.catch?.(() => false)
    void loadInboxFiles(folder, { reloadGlobal: true }).then(next => setInboxFiles(folder, next))
  }, [workspaceFolderPath])

  if (!workspaceId || !workspaceFolderPath) {
    return <div className="inbox-panel"><div className="inbox-muted">{t('inbox.noWorkspace')}</div></div>
  }

  const { towers, tower, verdict } = model
  const gate = inboxGateHint(verdict)
  const code = inboxGateCode(verdict)

  const header = (
    <div className="inbox-header">
      <span className="inbox-header-label">{t('inbox.tower')}</span>
      {showsTowerPicker(towers) ? (
        <select
          className="inbox-tower-picker"
          aria-label={t('inbox.towerPicker')}
          value={tower?.id ?? ''}
          onChange={e => setSelectedInboxTower(workspaceId, e.target.value || null)}
        >
          {towers.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      ) : (
        <span className="inbox-tower-name" title={tower?.title}>{tower ? tower.title : t('inbox.noTower')}</span>
      )}
      <span className={`inbox-contract inbox-contract-${verdict.kind}`} data-inbox-verdict={verdict.kind}>
        {verdict.kind === 'match' ? t('inbox.contractOk', { version: BAT_CONTRACT_VERSION }) : `⚠️ ${code}`}
      </span>
      <button className="ct-refresh-btn inbox-refresh" onClick={refresh} title={t('inbox.refresh')}>↻</button>
    </div>
  )

  if (model.loading) {
    return <div className="inbox-panel">{header}<div className="inbox-muted">{t('inbox.loading')}</div></div>
  }
  if (!model.applies) {
    return <div className="inbox-panel">{header}<div className="inbox-muted" data-inbox-empty="no-ct">{t('inbox.notDetected')}</div></div>
  }

  const stateNote = model.files.state?.status === 'missing'
    ? t('inbox.stateMissing')
    : model.files.state?.status === 'error'
      ? t('inbox.stateError', { error: model.files.state.error })
      : null

  if (gate) {
    return (
      <div className="inbox-panel">
        {header}
        <div className="inbox-gate" data-inbox-gate={code ?? ''}>
          <div className="inbox-gate-code">{code}</div>
          <p>{t(gate.key, gate.values)}</p>
          {stateNote && <p className="inbox-muted">{stateNote}</p>}
        </div>
      </div>
    )
  }

  // W6 / T0909: whose turn cards「💬」shows — the selected declared Tower, or (none declared, judged
  // by the state file) the workspace's panel Towers merged (T0909 Q-1 A, `panelTowerTerminalIds`)
  const workspaceTerminals = workspaceStore.getState().terminals.filter(tm => tm.workspaceId === workspaceId)
  const towerTab = tower ? workspaceTerminals.find(tm => tm.id === tower.id) : undefined
  const cardSources: TowerCardsSource[] = tower
    ? [{ terminalId: tower.id, title: tower.title }]
    : panelTowerTerminalIds(
      workspaceTerminals,
      model.files.state?.status === 'loaded' ? towerStateBatContract(model.files.state.parsed) : null,
      towers.length,
    ).map(id => ({ terminalId: id, title: workspaceTerminals.find(tm => tm.id === id)?.title ?? id }))
  const codexTower = !!tower && isCodexTower({ agent: getTowerContract(tower.id)?.agent, agentPreset: towerTab?.agentPreset })

  // T0908: `user_inbox: off` → CT writes neither list; the two sections say so (§6′)
  const inboxOff = model.userInbox === 'off'
  const awaiting = inboxOff ? [] : model.awaiting
  const actions = inboxOff ? [] : model.actions

  // §3.3: malformed items are skipped and counted (shown even when nothing else is listed)
  const skippedLine = (count: number) => count > 0
    ? <div className="inbox-muted" data-inbox-skipped={count}>{t('inbox.skipped', { count })}</div>
    : null

  const workerLine = (item: WorkerWaitItem) => {
    switch (item.kind) {
      case 'waiting':
        return t('inbox.worker.waiting', { title: item.title, reason: t(`inbox.worker.reason.${item.reason}`) })
      case 'held':
        return t('inbox.worker.held', { title: item.title, count: item.count })
      case 'interrupted':
        return t('inbox.worker.interrupted', { title: item.title, agent: item.agent })
    }
  }

  return (
    <div className="inbox-panel">
      {header}
      <div className="inbox-body">
        {inboxOff && <div className="inbox-muted inbox-off" data-inbox-off="">{t('inbox.userInboxOff')}</div>}

        <InboxSection id="decide" title={t('inbox.section.decide')} count={awaiting.length} folded={folded.decide} onToggle={toggle}>
          <AwaitingList items={awaiting} skipped={model.skipped.awaiting} targets={model.answerTargets} />
        </InboxSection>
        {!inboxOff && awaiting.length === 0 && skippedLine(model.skipped.awaiting)}

        <InboxSection id="act" title={t('inbox.section.act')} count={actions.length + model.pendingBugs.length} folded={folded.act} onToggle={toggle}>
          {actions.length > 0 && <ActionList items={actions} skipped={model.skipped.actions} targets={model.answerTargets} />}
          <ul className="inbox-list">
            {model.pendingBugs.map(bug => (
              <li key={bug.id} className="inbox-item" data-inbox-bug={bug.id}>
                <span className="inbox-item-source">BUG</span>
                <span className="inbox-item-text" title={bug.title}>
                  {t('inbox.bugPending', { id: bug.id, status: bug.status })} {bug.title}
                </span>
                <button className="inbox-link" onClick={() => requestControlTowerTab('bugs')}>{t('inbox.open')}</button>
              </li>
            ))}
          </ul>
        </InboxSection>

        {!inboxOff && actions.length === 0 && skippedLine(model.skipped.actions)}

        <RecentlyClosedList items={model.recentlyClosed} />

        <InboxSection id="remind" title={t('inbox.section.remind')} count={model.reminders.length} folded={folded.remind} onToggle={toggle}>
          <ReminderList items={model.reminders} skipped={model.skipped.reminders} />
        </InboxSection>
        {model.reminders.length === 0 && skippedLine(model.skipped.reminders)}

        <InboxSection id="workers" title={t('inbox.section.workers')} count={model.workerItems.length} folded={folded.workers} onToggle={toggle}>
          <ul className="inbox-list">
            {model.workerItems.map(item => (
              <li key={`${item.kind}:${item.terminalId}`} className="inbox-item" data-inbox-worker={item.kind}>
                <span className="inbox-item-text">{workerLine(item)}</span>
                {item.kind === 'interrupted' ? (
                  <button className="inbox-link" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_INTERRUPTED_AGENTS_EVENT))}>
                    {t('inbox.worker.resume')}
                  </button>
                ) : (
                  <button className="inbox-link" onClick={() => focusTerminal(item.terminalId)}>{t('inbox.worker.goTo')}</button>
                )}
              </li>
            ))}
          </ul>
        </InboxSection>

        <TowerCardsSection sources={cardSources} codex={codexTower} folded={folded.messages} onToggle={toggle} />

        <InboxSection id="todo" title={t('inbox.section.todo')} count={model.todo.length} folded={folded.todo} onToggle={toggle}>
          <ol className="inbox-todo">
            {model.todo.map((text, i) => {
              const { short, folded: long } = foldTodo(text)
              const open = openTodos.has(i)
              return (
                <li key={i} className="inbox-todo-item">
                  <span className="inbox-todo-text">{long && !open ? short : text}</span>
                  {long && (
                    <button
                      className="inbox-link"
                      onClick={() => setOpenTodos(prev => {
                        const next = new Set(prev)
                        if (next.has(i)) next.delete(i)
                        else next.add(i)
                        return next
                      })}
                    >
                      {open ? t('inbox.todoLess') : t('inbox.todoMore')}
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </InboxSection>

        <div className="inbox-counts" data-inbox-section="counts">
          <span>📊</span>
          <button className="inbox-link" onClick={() => requestControlTowerTab('bugs')}>{t('inbox.counts.bugs', { count: model.counts.openBugs })}</button>
          <span>·</span>
          <button className="inbox-link" onClick={() => requestControlTowerTab('backlog')}>{t('inbox.counts.plans', { count: model.counts.plansInProgress })}</button>
          <span>·</span>
          <button className="inbox-link" onClick={() => requestControlTowerTab('orders')}>{t('inbox.counts.orders', { count: model.counts.openOrders })}</button>
        </div>

        {model.files.readErrors.length > 0 && (
          <div className="inbox-muted inbox-read-errors">{t('inbox.readErrors', { files: model.files.readErrors.join(', ') })}</div>
        )}
      </div>
    </div>
  )
}

/** The text after the tab name: `!` (version mismatch) or the count; nothing when there is nothing. */
export function InboxTabBadge({ workspaceId, workspaceFolderPath }: Readonly<InboxPanelProps>) {
  const { t } = useTranslation()
  const { badge, verdict } = useInboxModel(workspaceId, workspaceFolderPath)
  if (!badge) return null
  const mismatch = verdict.kind !== 'match'
  return (
    <span
      className={`inbox-tab-badge${mismatch ? ' mismatch' : ''}`}
      data-inbox-badge={badge}
      title={mismatch ? t('inbox.badgeMismatch') : t('inbox.badgeCount', { count: Number(badge) })}
    >
      {badge}
    </span>
  )
}
