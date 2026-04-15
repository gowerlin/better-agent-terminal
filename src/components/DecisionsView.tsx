import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type DecisionEntry } from '../types/decision-log'

interface DecisionsViewProps {
  decisions: DecisionEntry[]
  loading: boolean
  rawContent?: string
  ctDirPath?: string | null
}

/**
 * Extract the decision detail block from rawContent for the given decisionId.
 * Supports both v3 (### D### date — title) and v4 (## D###：title) heading formats.
 */
function extractDecisionDetail(rawContent: string, decisionId: string): string {
  // Range entries like "D001-D012" do not have dedicated detail sections
  if (!decisionId.match(/^D\d+$/)) return ''

  // Match v3 (### D###) and v4 (## D###) headings
  const startPattern = new RegExp(`^#{2,3}\\s+${decisionId}\\b`, 'm')
  const startMatch = startPattern.exec(rawContent)
  if (!startMatch) return ''

  const afterStart = rawContent.slice(startMatch.index)

  // Detect the heading level used so we stop at the same or higher level
  const headingLevel = afterStart.startsWith('###') ? 3 : 2

  // Stop at next heading of same or higher level, or horizontal rule
  const stopPattern = headingLevel === 3
    ? /\n---\n|\n#{1,3}\s+D\d+/
    : /\n---\n|\n#{1,2}\s+D\d+/
  const stopMatch = stopPattern.exec(afterStart.slice(1))

  const block = stopMatch
    ? afterStart.slice(0, 1 + stopMatch.index)
    : afterStart

  return block.trim()
}

export function DecisionsView({ decisions, loading, rawContent = '', ctDirPath }: DecisionsViewProps) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredDecisions = search.trim()
    ? decisions.filter(d =>
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.id.toLowerCase().includes(search.toLowerCase())
      )
    : decisions

  return (
    <div className="ct-decisions">

      {/* Summary bar */}
      <div className="ct-summary">
        <span className="ct-badge ct-decision-badge">
          📌 {decisions.length}
        </span>
        <span className="ct-badge ct-total">
          {decisions.length} {t('controlTower.decisions.total')}
        </span>
      </div>

      {/* Search bar + view file */}
      <div className="ct-filter-bar">
        <input
          className="ct-decision-search"
          type="text"
          placeholder={t('controlTower.decisions.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {ctDirPath && (
          <button
            className="ct-view-file-btn"
            onClick={() => {
              const filePath = `${ctDirPath}/_decision-log.md`
              window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'files' } }))
              window.dispatchEvent(new CustomEvent('file-tree-reveal', { detail: { path: filePath } }))
            }}
          >
            📄 {t('controlTower.viewFile')}
          </button>
        )}
      </div>

      {/* Decision list */}
      <div className="ct-decision-list">
        {loading && <div className="ct-loading">{t('controlTower.loading')}</div>}

        {!loading && filteredDecisions.length === 0 && (
          <div className="ct-empty-list">{t('controlTower.decisions.noDecisions')}</div>
        )}

        {filteredDecisions.map(decision => (
          <div
            key={decision.id}
            className={`ct-decision-item${expandedId === decision.id ? ' expanded' : ''}`}
            onClick={() => setExpandedId(prev => prev === decision.id ? null : decision.id)}
          >
            {/* Row header */}
            <div className="ct-decision-header">
              <span className="ct-decision-id">{decision.id}</span>
              <span className="ct-decision-date">{decision.date}</span>
              <span className="ct-decision-title">{decision.title}</span>
              {decision.relatedWorkOrder && (
                <span className="ct-decision-wo">{decision.relatedWorkOrder}</span>
              )}
            </div>

            {/* Expanded detail */}
            {expandedId === decision.id && (
              <div className="ct-decision-detail" onClick={e => e.stopPropagation()}>
                {rawContent ? (
                  (() => {
                    const detail = extractDecisionDetail(rawContent, decision.id)
                    return detail ? (
                      <pre className="ct-decision-markdown">{detail}</pre>
                    ) : (
                      <div className="ct-decision-no-detail">
                        {t('controlTower.decisions.noDetail')}
                      </div>
                    )
                  })()
                ) : (
                  <div className="ct-decision-no-detail">
                    {t('controlTower.decisions.noDetail')}
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
