import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BmadEpic, BmadStory } from '../types/bmad-epic'
import { epicStatusColor, epicStatusLabel, storyStatusColor, storyStatusLabel } from '../types/bmad-epic'

interface BmadEpicsViewProps {
  epics: BmadEpic[]
  loading: boolean
  ctDirPath: string | null
}

export function BmadEpicsView({ epics, loading, ctDirPath }: BmadEpicsViewProps) {
  const { t } = useTranslation()
  const [expandedEpicId, setExpandedEpicId] = useState<number | null>(null)

  if (loading) {
    return <div className="ct-loading">{t('controlTower.loading')}</div>
  }

  if (epics.length === 0) {
    return (
      <div className="ct-epics-empty">
        <div className="ct-empty-icon">📋</div>
        <p>{t('controlTower.epics.empty')}</p>
        <code className="ct-path">_bmad-output/planning-artifacts/epics.md</code>
      </div>
    )
  }

  // Summary stats
  const totalStories = epics.reduce((sum, e) => sum + e.stories.length, 0)
  const doneStories = epics.reduce((sum, e) => sum + e.stories.filter(s => s.status === 'DONE').length, 0)

  return (
    <div className="ct-epics">
      {/* Summary bar */}
      <div className="ct-epics-summary">
        <span className="ct-badge ct-total">{epics.length} {t('controlTower.epics.epicCount')}</span>
        <span className="ct-badge ct-total">{totalStories} {t('controlTower.epics.storyCount')}</span>
        {doneStories > 0 && (
          <span className="ct-badge ct-status-done">{doneStories} {t('controlTower.epics.doneCount')}</span>
        )}
        {totalStories > 0 && (
          <div className="ct-epics-progress-bar">
            <div
              className="ct-epics-progress-fill"
              style={{ width: `${Math.round((doneStories / totalStories) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Epic cards */}
      <div className="ct-epic-list">
        {epics.map(epic => (
          <EpicCard
            key={epic.id}
            epic={epic}
            expanded={expandedEpicId === epic.id}
            onToggle={() => setExpandedEpicId(prev => prev === epic.id ? null : epic.id)}
            ctDirPath={ctDirPath}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Epic Card ──────────────────────────────────────────────────────────────

function EpicCard({
  epic,
  expanded,
  onToggle,
  ctDirPath,
}: {
  epic: BmadEpic
  expanded: boolean
  onToggle: () => void
  ctDirPath: string | null
}) {
  const { t } = useTranslation()
  const doneCount = epic.stories.filter(s => s.status === 'DONE').length
  const totalCount = epic.stories.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <div className={`ct-epic-card ${epicStatusColor(epic.status)}${expanded ? ' expanded' : ''}`}>
      <div className="ct-epic-header" onClick={onToggle}>
        <span className="ct-epic-expand">{expanded ? '▼' : '▶'}</span>
        <span className="ct-epic-id">E{epic.id}</span>
        <span className="ct-epic-title">{epic.title}</span>
        {totalCount > 0 && (
          <span className="ct-epic-story-count">{doneCount}/{totalCount}</span>
        )}
        <span className={`ct-status-badge ${epicStatusColor(epic.status)}`}>
          {epicStatusLabel(epic.status)}
        </span>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="ct-epic-progress-bar">
          <div className="ct-epic-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {expanded && (
        <div className="ct-epic-detail">
          {epic.description && (
            <p className="ct-epic-desc">{epic.description}</p>
          )}
          {epic.frs && (
            <div className="ct-epic-frs">
              <span className="ct-detail-label">FRs:</span> {epic.frs}
            </div>
          )}

          {/* Story list */}
          {epic.stories.length > 0 && (
            <div className="ct-story-list">
              <div className="ct-story-list-header">{t('controlTower.epics.stories')}</div>
              {epic.stories.map(story => (
                <StoryItem key={story.id} story={story} ctDirPath={ctDirPath} />
              ))}
            </div>
          )}
          {epic.stories.length === 0 && (
            <div className="ct-story-empty">{t('controlTower.epics.noStories')}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Story Item ─────────────────────────────────────────────────────────────

function StoryItem({
  story,
  ctDirPath,
}: {
  story: BmadStory
  ctDirPath: string | null
}) {
  return (
    <div className={`ct-story-item ${storyStatusColor(story.status)}`}>
      <span className="ct-story-id">{story.id}</span>
      <span className="ct-story-title">{story.title}</span>
      <span className={`ct-status-badge ${storyStatusColor(story.status)}`}>
        {storyStatusLabel(story.status)}
      </span>
      {story.workOrderId && (
        <button
          className="ct-story-wo-badge"
          title={story.workOrderId}
          onClick={() => {
            if (!ctDirPath) return
            // Switch to Orders tab and try to reveal the work order
            window.dispatchEvent(new CustomEvent('ct-switch-tab', { detail: { tab: 'orders' } }))
          }}
        >
          {story.workOrderId}
        </button>
      )}
    </div>
  )
}
