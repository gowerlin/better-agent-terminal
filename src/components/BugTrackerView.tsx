import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type BugEntry,
  type BugStatus,
  type BugSeverity,
  bugStatusColor,
  bugStatusLabel,
  bugSeverityColor,
} from '../types/bug-tracker'

interface BugTrackerViewProps {
  bugs: BugEntry[]
  loading: boolean
  ctDirPath: string | null
}

export function BugTrackerView({ bugs, loading, ctDirPath }: BugTrackerViewProps) {
  const { t } = useTranslation()
  const [filterStatus, setFilterStatus] = useState<BugStatus | 'all'>('all')
  const [filterSeverity, setFilterSeverity] = useState<BugSeverity | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  // Cache for loaded detail content: bugId → markdown string
  const [detailCache, setDetailCache] = useState<Record<string, string>>({})
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null)

  // Apply filters
  const filteredBugs = bugs.filter(b => {
    if (!showArchived && b.isArchived) return false
    if (filterStatus !== 'all' && b.status !== filterStatus) return false
    if (filterSeverity !== 'all' && b.severity !== filterSeverity) return false
    return true
  })

  // Summary counts (from full list, not filtered)
  const openCount   = bugs.filter(b => b.status === 'OPEN').length
  const verifyCount = bugs.filter(b => b.status === 'VERIFY').length
  const fixedCount  = bugs.filter(b => b.status === 'FIXED').length
  const closedCount = bugs.filter(b => b.status === 'CLOSED').length

  // Toggle expand: load individual BUG file on demand
  const handleToggle = useCallback(async (bug: BugEntry) => {
    if (expandedId === bug.id) {
      setExpandedId(null)
      return
    }

    setExpandedId(bug.id)

    // Skip if already cached or no path available
    if (detailCache[bug.id] !== undefined || !ctDirPath || !bug.linkPath) return

    setLoadingDetailId(bug.id)
    try {
      const filePath = `${ctDirPath}/${bug.linkPath}`
      const result = await window.electronAPI.fs.readFile(filePath)
      const content = result.content ?? t('controlTower.bugs.loadError')
      setDetailCache(prev => ({ ...prev, [bug.id]: content }))
    } catch {
      setDetailCache(prev => ({ ...prev, [bug.id]: t('controlTower.bugs.loadError') }))
    } finally {
      setLoadingDetailId(null)
    }
  }, [expandedId, detailCache, ctDirPath, t])

  return (
    <div className="ct-bug-tracker">

      {/* Summary bar */}
      <div className="ct-summary">
        <span className="ct-badge ct-bug-badge-open">🔴 {openCount}</span>
        <span className="ct-badge ct-bug-badge-verify">🧪 {verifyCount}</span>
        <span className="ct-badge ct-bug-badge-fixed">✅ {fixedCount}</span>
        <span className="ct-badge ct-bug-badge-closed">🚫 {closedCount}</span>
        <span className="ct-badge ct-total">{bugs.length} {t('controlTower.bugs.total')}</span>
      </div>

      {/* Status filter */}
      <div className="ct-filter-bar">
        {(['all', 'OPEN', 'VERIFY', 'FIXED', 'CLOSED'] as const).map(s => (
          <button
            key={s}
            className={`ct-filter-btn${filterStatus === s ? ' active' : ''}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'all' ? t('controlTower.all') : bugStatusLabel(s)}
          </button>
        ))}
      </div>

      {/* Severity filter */}
      <div className="ct-filter-bar ct-filter-bar-secondary">
        {(['all', 'High', 'Medium', 'Low'] as const).map(sev => (
          <button
            key={sev}
            className={`ct-filter-btn${filterSeverity === sev ? ' active' : ''}`}
            onClick={() => setFilterSeverity(sev)}
          >
            {sev === 'all' ? t('controlTower.all') : sev}
          </button>
        ))}
        <label className="ct-archive-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
          />
          📦 {t('controlTower.includeArchived')}
        </label>
      </div>

      {/* Bug list */}
      <div className="ct-bug-list">
        {loading && <div className="ct-loading">{t('controlTower.loading')}</div>}

        {!loading && filteredBugs.length === 0 && (
          <div className="ct-empty-list">{t('controlTower.bugs.noBugs')}</div>
        )}

        {filteredBugs.map(bug => (
          <div
            key={bug.id}
            className={`ct-bug-item ${bugStatusColor(bug.status)}${expandedId === bug.id ? ' expanded' : ''}${bug.isArchived ? ' ct-archived-item' : ''}`}
            onClick={() => handleToggle(bug)}
          >
            {/* Row header */}
            <div className="ct-bug-header">
              <span className="ct-bug-id">{bug.id}</span>
              <span className="ct-bug-title">{bug.title}</span>
              <span className={`ct-severity-badge ${bugSeverityColor(bug.severity)}`}>
                {bug.severity}
              </span>
              <span className={`ct-status-badge ${bugStatusColor(bug.status)}`}>
                {bugStatusLabel(bug.status)}
              </span>
            </div>

            {/* Expanded detail */}
            {expandedId === bug.id && (
              <div className="ct-bug-detail" onClick={e => e.stopPropagation()}>
                <div className="ct-detail-meta">
                  {bug.isArchived && (
                    <span className="ct-bug-archived-badge">
                      📦 {t('controlTower.bugs.archived')}
                    </span>
                  )}
                  {bug.reportedAt && (
                    <span className="ct-detail-item">
                      <span className="ct-detail-label">{t('controlTower.created')}:</span>
                      {' '}{bug.reportedAt}
                    </span>
                  )}
                  {bug.relatedWorkOrder && (
                    <span className="ct-detail-item">
                      <span className="ct-detail-label">{t('controlTower.bugs.relatedWO')}:</span>
                      {' '}<span className="ct-bug-wo-ref">{bug.relatedWorkOrder}</span>
                    </span>
                  )}
                </div>

                <div className="ct-bug-content">
                  {loadingDetailId === bug.id ? (
                    <div className="ct-loading">{t('controlTower.loading')}</div>
                  ) : detailCache[bug.id] !== undefined ? (
                    <pre className="ct-bug-markdown">{detailCache[bug.id]}</pre>
                  ) : null}
                </div>
                {bug.linkPath && ctDirPath && (
                  <div className="ct-item-actions">
                    <button
                      className="ct-view-file-btn"
                      onClick={e => {
                        e.stopPropagation()
                        const filePath = `${ctDirPath}/${bug.linkPath}`
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
