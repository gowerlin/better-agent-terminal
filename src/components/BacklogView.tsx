import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type BacklogEntry,
  type PlanStatus,
  type PlanPriority,
  planStatusColor,
  planStatusLabel,
} from '../types/backlog'

interface BacklogViewProps {
  entries: BacklogEntry[]
  loading: boolean
  ctDirPath: string | null
}

export function BacklogView({ entries, loading, ctDirPath }: BacklogViewProps) {
  const { t } = useTranslation()
  const [filterStatus, setFilterStatus] = useState<PlanStatus | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<PlanPriority | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [detailCache, setDetailCache] = useState<Record<string, string>>({})
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null)

  const filteredEntries = entries.filter(e => {
    if (!showArchived && e.isArchived) return false
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterPriority !== 'all' && e.priority !== filterPriority) return false
    return true
  })

  const ideaCount       = entries.filter(e => e.status === 'IDEA').length
  const plannedCount    = entries.filter(e => e.status === 'PLANNED').length
  const inProgressCount = entries.filter(e => e.status === 'IN_PROGRESS').length
  const doneCount       = entries.filter(e => e.status === 'DONE').length
  const droppedCount    = entries.filter(e => e.status === 'DROPPED').length

  const handleToggle = useCallback(async (entry: BacklogEntry) => {
    if (expandedId === entry.id) {
      setExpandedId(null)
      return
    }

    setExpandedId(entry.id)

    if (detailCache[entry.id] !== undefined || !ctDirPath || !entry.linkPath) return

    setLoadingDetailId(entry.id)
    try {
      const filePath = `${ctDirPath}/${entry.linkPath}`
      const result = await window.electronAPI.fs.readFile(filePath)
      const content = result.content ?? t('controlTower.backlog.loadError')
      setDetailCache(prev => ({ ...prev, [entry.id]: content }))
    } catch {
      setDetailCache(prev => ({ ...prev, [entry.id]: t('controlTower.backlog.loadError') }))
    } finally {
      setLoadingDetailId(null)
    }
  }, [expandedId, detailCache, ctDirPath, t])

  return (
    <div className="ct-backlog">

      {/* Summary bar */}
      <div className="ct-summary">
        {ideaCount > 0 && (
          <span className="ct-badge ct-plan-badge-idea">💡 {ideaCount}</span>
        )}
        {plannedCount > 0 && (
          <span className="ct-badge ct-plan-badge-planned">📋 {plannedCount}</span>
        )}
        {inProgressCount > 0 && (
          <span className="ct-badge ct-plan-badge-in-progress">🔄 {inProgressCount}</span>
        )}
        {doneCount > 0 && (
          <span className="ct-badge ct-plan-badge-done">✅ {doneCount}</span>
        )}
        {droppedCount > 0 && (
          <span className="ct-badge ct-plan-badge-dropped">🚫 {droppedCount}</span>
        )}
        <span className="ct-badge ct-total">
          {entries.length} {t('controlTower.backlog.total')}
        </span>
        <label className="ct-archive-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
          />
          📦 {t('controlTower.includeArchived')}
        </label>
      </div>

      {/* Status filter */}
      <div className="ct-filter-bar">
        {(['all', 'IDEA', 'PLANNED', 'IN_PROGRESS', 'DONE', 'DROPPED'] as const).map(s => (
          <button
            key={s}
            className={`ct-filter-btn${filterStatus === s ? ' active' : ''}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'all' ? t('controlTower.all') : planStatusLabel(s)}
          </button>
        ))}
      </div>

      {/* Priority filter */}
      <div className="ct-filter-bar ct-filter-bar-secondary">
        {(['all', 'High', 'Medium', 'Low'] as const).map(p => (
          <button
            key={p}
            className={`ct-filter-btn${filterPriority === p ? ' active' : ''}`}
            onClick={() => setFilterPriority(p)}
          >
            {p === 'all' ? t('controlTower.all') : p}
          </button>
        ))}
      </div>

      {/* Backlog list */}
      <div className="ct-backlog-list">
        {loading && <div className="ct-loading">{t('controlTower.loading')}</div>}

        {!loading && filteredEntries.length === 0 && (
          <div className="ct-empty-list">{t('controlTower.backlog.noEntries')}</div>
        )}

        {filteredEntries.map(entry => (
          <div
            key={entry.id}
            className={`ct-backlog-item ${planStatusColor(entry.status)}${expandedId === entry.id ? ' expanded' : ''}${entry.isArchived ? ' ct-archived-item' : ''}`}
            onClick={() => handleToggle(entry)}
          >
            {/* Row header */}
            <div className="ct-backlog-header">
              <span className="ct-plan-id">{entry.id}</span>
              <span className="ct-plan-title">{entry.title}</span>
              <span className={`ct-priority-badge ct-plan-priority-${entry.priority.toLowerCase()}`}>
                {entry.priority}
              </span>
              <span className={`ct-status-badge ${planStatusColor(entry.status)}`}>
                {planStatusLabel(entry.status)}
              </span>
            </div>

            {/* Expanded detail */}
            {expandedId === entry.id && (
              <div className="ct-plan-detail" onClick={e => e.stopPropagation()}>
                <div className="ct-detail-meta">
                  {entry.isArchived && (
                    <span className="ct-plan-archived-badge">
                      📦 {t('controlTower.backlog.archived')}
                    </span>
                  )}
                  {entry.createdAt && (
                    <span className="ct-detail-item">
                      <span className="ct-detail-label">{t('controlTower.created')}:</span>
                      {' '}{entry.createdAt}
                    </span>
                  )}
                </div>
                <div className="ct-plan-content">
                  {loadingDetailId === entry.id ? (
                    <div className="ct-loading">{t('controlTower.loading')}</div>
                  ) : detailCache[entry.id] !== undefined ? (
                    <pre className="ct-plan-markdown">{detailCache[entry.id]}</pre>
                  ) : null}
                </div>
                {entry.linkPath && ctDirPath && (
                  <div className="ct-item-actions">
                    <button
                      className="ct-view-file-btn"
                      onClick={e => {
                        e.stopPropagation()
                        const filePath = `${ctDirPath}/${entry.linkPath}`
                        window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'files' } }))
                        window.dispatchEvent(new CustomEvent('file-tree-reveal', { detail: { path: filePath } }))
                      }}
                    >
                      📄 {t('controlTower.viewFile')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
