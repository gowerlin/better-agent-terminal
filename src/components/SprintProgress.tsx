import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SprintStatus, CrossValidation, SprintProgress as SprintProgressType } from '../types/sprint-status'
import { calculateProgress, crossValidate, getKanbanLane } from '../types/sprint-status'
import type { WorkOrder } from '../types/control-tower'

interface SprintProgressProps {
  sprint: SprintStatus
  workOrders: WorkOrder[]
}

export function SprintProgress({ sprint, workOrders }: SprintProgressProps) {
  const { t } = useTranslation()

  const progress = useMemo(() => calculateProgress(sprint.stories), [sprint.stories])

  const validation = useMemo(
    () => crossValidate(
      workOrders.map(wo => ({ id: wo.id, status: wo.status })),
      sprint,
    ),
    [workOrders, sprint],
  )

  const mismatches = validation.filter(v => !v.match && v.yamlStoryId)
  const matchedCount = validation.filter(v => v.match && v.yamlStoryId).length

  return (
    <div className="ct-sprint">
      {/* Sprint header */}
      <div className="ct-sprint-header">
        <span className="ct-sprint-name">{sprint.sprintName}</span>
        {sprint.status && <span className="ct-sprint-status">{sprint.status}</span>}
      </div>

      {/* Progress bar */}
      <ProgressBar progress={progress} />

      {/* Story list by lane */}
      <StoryLanes sprint={sprint} />

      {/* Cross validation */}
      <ValidationSection
        mismatches={mismatches}
        matchedCount={matchedCount}
        total={validation.filter(v => v.yamlStoryId).length}
        t={t}
      />
    </div>
  )
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: SprintProgressType }) {
  const { total, done, inProgress, review, blocked, percentage } = progress
  if (total === 0) return null

  const segments = [
    { width: (done / total) * 100, cls: 'ct-prog-done' },
    { width: (review / total) * 100, cls: 'ct-prog-review' },
    { width: (inProgress / total) * 100, cls: 'ct-prog-active' },
    { width: (blocked / total) * 100, cls: 'ct-prog-blocked' },
  ]

  return (
    <div className="ct-progress-section">
      <div className="ct-progress-bar">
        {segments.map((seg, i) =>
          seg.width > 0
            ? <div key={i} className={`ct-prog-segment ${seg.cls}`} style={{ width: `${seg.width}%` }} />
            : null,
        )}
      </div>
      <div className="ct-progress-stats">
        <span>{percentage}%</span>
        <span className="ct-progress-detail">
          {done}/{total} done
          {inProgress > 0 && ` · ${inProgress} active`}
          {blocked > 0 && ` · ${blocked} blocked`}
        </span>
      </div>
    </div>
  )
}

// ─── Story Lanes ─────────────────────────────────────────────────────────────

function StoryLanes({ sprint }: { sprint: SprintStatus }) {
  const { t } = useTranslation()

  const byLane = useMemo(() => {
    const lanes: Record<string, typeof sprint.stories> = {}
    for (const story of sprint.stories) {
      const lane = getKanbanLane(story.status)
      if (!lanes[lane]) lanes[lane] = []
      lanes[lane].push(story)
    }
    return lanes
  }, [sprint.stories])

  const laneOrder = ['IN_PROGRESS', 'REVIEW', 'TODO', 'BLOCKED', 'DONE'] as const

  return (
    <div className="ct-sprint-stories">
      {laneOrder.map(lane => {
        const items = byLane[lane]
        if (!items || items.length === 0) return null
        return (
          <div key={lane} className="ct-sprint-lane-group">
            <div className="ct-sprint-lane-label">{t(`controlTower.lane.${lane}`)}</div>
            {items.map(story => (
              <div key={story.id} className={`ct-sprint-story ct-lane-bg-${lane.toLowerCase()}`}>
                <span className="ct-story-id">{story.id}</span>
                <span className="ct-story-title">{story.title !== story.id ? story.title : ''}</span>
                {story.workOrderId && (
                  <span className="ct-story-wo" title="Work Order">{story.workOrderId}</span>
                )}
                {story.epic && (
                  <span className="ct-story-epic">{story.epic}</span>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─── Validation Section ──────────────────────────────────────────────────────

function ValidationSection({
  mismatches,
  matchedCount,
  total,
  t,
}: {
  mismatches: CrossValidation[]
  matchedCount: number
  total: number
  t: (key: string) => string
}) {
  if (total === 0) return null

  return (
    <div className="ct-validation">
      <div className="ct-validation-header">
        <span className="ct-validation-title">{t('controlTower.validation.title')}</span>
        {mismatches.length === 0 ? (
          <span className="ct-validation-ok">✅ {matchedCount}/{total} {t('controlTower.validation.allMatch')}</span>
        ) : (
          <span className="ct-validation-warn">⚠️ {mismatches.length} {t('controlTower.validation.mismatch')}</span>
        )}
      </div>
      {mismatches.length > 0 && (
        <div className="ct-validation-list">
          {mismatches.map(m => (
            <div key={m.workOrderId} className="ct-validation-item">
              <span className="ct-validation-wo">{m.workOrderId}</span>
              <span className="ct-validation-arrow">
                {m.workOrderStatus} → {m.yamlStatus}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
