import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkOrder } from '../types/control-tower'
import { statusLabel } from '../types/control-tower'
import type { KanbanLane } from '../types/sprint-status'

interface KanbanViewProps {
  workOrders: WorkOrder[]
  onExecWorkOrder?: (workOrderId: string) => void
}

/** 工單 → 看板 lane 映射 */
function workOrderToLane(status: string): KanbanLane {
  switch (status) {
    case 'PENDING': return 'TODO'
    case 'URGENT': return 'TODO'
    case 'IN_PROGRESS': return 'IN_PROGRESS'
    case 'DONE': return 'DONE'
    case 'FAILED': return 'BLOCKED'
    case 'BLOCKED': return 'BLOCKED'
    case 'PARTIAL': return 'IN_PROGRESS'
    case 'INTERRUPTED': return 'BLOCKED'
    default: return 'TODO'
  }
}

const LANE_ORDER: KanbanLane[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']

const LANE_ICONS: Record<KanbanLane, string> = {
  TODO: '📋',
  IN_PROGRESS: '🔄',
  REVIEW: '👀',
  DONE: '✅',
  BLOCKED: '❌',
}

export function KanbanView({ workOrders, onExecWorkOrder }: KanbanViewProps) {
  const { t } = useTranslation()

  const lanes = useMemo(() => {
    const grouped: Record<KanbanLane, WorkOrder[]> = {
      TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [], BLOCKED: [],
    }
    for (const wo of workOrders) {
      const lane = workOrderToLane(wo.status)
      grouped[lane].push(wo)
    }
    return grouped
  }, [workOrders])

  if (workOrders.length === 0) {
    return <div className="ct-empty-list">{t('controlTower.noOrders')}</div>
  }

  return (
    <div className="ct-kanban">
      {LANE_ORDER.map(lane => {
        const items = lanes[lane]
        // 隱藏空的 REVIEW lane（工單沒有 REVIEW 狀態）
        if (items.length === 0 && lane === 'REVIEW') return null

        return (
          <div key={lane} className={`ct-kanban-lane ct-lane-${lane.toLowerCase()}`}>
            <div className="ct-lane-header">
              <span className="ct-lane-icon">{LANE_ICONS[lane]}</span>
              <span className="ct-lane-title">{t(`controlTower.lane.${lane}`)}</span>
              <span className="ct-lane-count">{items.length}</span>
            </div>
            <div className="ct-lane-items">
              {items.map(wo => (
                <div key={wo.id} className={`ct-kanban-card ct-status-${wo.status.toLowerCase().replace('_', '-')}`}>
                  <div className="ct-kanban-card-id">{wo.id}</div>
                  <div className="ct-kanban-card-title">{wo.title}</div>
                  <div className="ct-kanban-card-footer">
                    <span className="ct-kanban-card-status">{statusLabel(wo.status)}</span>
                    {onExecWorkOrder && (wo.status === 'PENDING' || wo.status === 'URGENT') && (
                      <button
                        className="ct-kanban-exec-btn"
                        onClick={() => onExecWorkOrder(wo.id)}
                        title={t('controlTower.execute')}
                      >
                        ▶
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="ct-kanban-empty">—</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
