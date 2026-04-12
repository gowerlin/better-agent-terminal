import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type WorkOrder,
  type WorkOrderStatus,
  parseWorkOrder,
  isWorkOrderFile,
  statusColor,
  statusLabel,
} from '../types/control-tower'
import {
  type SprintStatus,
  parseSprintStatus,
  getSprintYamlPaths,
} from '../types/sprint-status'
import { KanbanView } from './KanbanView'
import { SprintProgress } from './SprintProgress'
import { CtToast, useCtToast } from './CtToast'

type CtTab = 'orders' | 'kanban' | 'sprint'

interface ControlTowerPanelProps {
  isVisible: boolean
  workspaceFolderPath: string | null
  onExecWorkOrder?: (workOrderId: string) => void
  onDoneWorkOrder?: (workOrderId: string) => void
}

/** Statuses eligible for ct-done remedial close */
const DONE_ELIGIBLE: ReadonlySet<WorkOrderStatus> = new Set(['IN_PROGRESS', 'INTERRUPTED', 'PARTIAL', 'BLOCKED', 'FAILED'])

export function ControlTowerPanel({ isVisible, workspaceFolderPath, onExecWorkOrder, onDoneWorkOrder }: ControlTowerPanelProps) {
  const { t } = useTranslation()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [hasCtDir, setHasCtDir] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | 'all'>('all')
  const [activeTab, setActiveTab] = useState<CtTab>('orders')
  const [sprintStatus, setSprintStatus] = useState<SprintStatus | null>(null)
  const ctDirRef = useRef<string | null>(null)
  const prevOrdersRef = useRef<Map<string, WorkOrderStatus>>(new Map())
  const { messages: toastMessages, addToast, dismissToast } = useCtToast()

  // Build _ct-workorders path
  const ctDirPath = workspaceFolderPath ? `${workspaceFolderPath}/_ct-workorders` : null

  // Load sprint-status.yaml from multiple possible locations
  const loadSprintStatus = useCallback(async () => {
    if (!workspaceFolderPath) return
    const paths = getSprintYamlPaths(workspaceFolderPath)

    for (const yamlPath of paths) {
      try {
        const result = await window.electronAPI.fs.readFile(yamlPath)
        if (result.content) {
          const parsed = parseSprintStatus(result.content)
          if (parsed) {
            setSprintStatus(parsed)
            return
          }
        }
      } catch {
        // Try next path
      }
    }
    setSprintStatus(null)
  }, [workspaceFolderPath])

  // Detect work order status changes → toast notification
  const detectStatusChanges = useCallback((newOrders: WorkOrder[]) => {
    const prevMap = prevOrdersRef.current
    if (prevMap.size === 0) {
      // First load, just populate the map
      const newMap = new Map<string, WorkOrderStatus>()
      for (const wo of newOrders) newMap.set(wo.id, wo.status)
      prevOrdersRef.current = newMap
      return
    }

    for (const wo of newOrders) {
      const prevStatus = prevMap.get(wo.id)
      if (prevStatus && prevStatus !== wo.status) {
        // Status changed
        if (wo.status === 'DONE') {
          addToast(`✅ ${wo.id} ${t('controlTower.toast.completed')}`, 'success', 6000)
        } else if (wo.status === 'IN_PROGRESS' && prevStatus === 'PENDING') {
          addToast(`🔄 ${wo.id} ${t('controlTower.toast.started')}`, 'info')
        } else if (wo.status === 'BLOCKED' || wo.status === 'FAILED') {
          addToast(`⚠️ ${wo.id} → ${statusLabel(wo.status)}`, 'warning')
        }
      } else if (!prevStatus) {
        // New work order
        addToast(`📋 ${t('controlTower.toast.newOrder')}: ${wo.id}`, 'info')
      }
    }

    const newMap = new Map<string, WorkOrderStatus>()
    for (const wo of newOrders) newMap.set(wo.id, wo.status)
    prevOrdersRef.current = newMap
  }, [addToast, t])

  // Load work orders from _ct-workorders/
  const loadWorkOrders = useCallback(async () => {
    if (!ctDirPath) return
    setLoading(true)
    try {
      const entries = await window.electronAPI.fs.readdir(ctDirPath)
      const orderFiles = entries.filter(e => !e.isDirectory && isWorkOrderFile(e.name))

      const orders: WorkOrder[] = []
      for (const file of orderFiles) {
        const result = await window.electronAPI.fs.readFile(file.path)
        if (result.content) {
          orders.push(parseWorkOrder(file.name, result.content))
        }
      }

      // Sort: URGENT first, then IN_PROGRESS, PENDING, others, DONE last
      const priority: Record<string, number> = {
        URGENT: 0, IN_PROGRESS: 1, PENDING: 2, BLOCKED: 3,
        PARTIAL: 4, INTERRUPTED: 5, FAILED: 6, DONE: 7,
      }
      orders.sort((a, b) => (priority[a.status] ?? 99) - (priority[b.status] ?? 99))

      detectStatusChanges(orders)
      setWorkOrders(orders)
      setHasCtDir(true)
    } catch {
      setWorkOrders([])
      setHasCtDir(false)
    } finally {
      setLoading(false)
    }
  }, [ctDirPath, detectStatusChanges])

  // Initial load
  useEffect(() => {
    if (!isVisible || !ctDirPath) return
    loadWorkOrders()
    loadSprintStatus()
  }, [isVisible, ctDirPath, loadWorkOrders, loadSprintStatus])

  // Watch _ct-workorders/ for changes
  useEffect(() => {
    if (!isVisible || !ctDirPath) return

    ctDirRef.current = ctDirPath
    window.electronAPI.fs.watch(ctDirPath)

    const unsubscribe = window.electronAPI.fs.onChanged((changedPath: string) => {
      if (changedPath === ctDirRef.current) {
        loadWorkOrders()
        loadSprintStatus()
      }
    })

    return () => {
      unsubscribe()
      if (ctDirRef.current) {
        window.electronAPI.fs.unwatch(ctDirRef.current)
      }
    }
  }, [isVisible, ctDirPath, loadWorkOrders, loadSprintStatus])

  const filteredOrders = filterStatus === 'all'
    ? workOrders
    : workOrders.filter(o => o.status === filterStatus)

  const activeCount = workOrders.filter(o => o.status === 'IN_PROGRESS' || o.status === 'URGENT').length
  const pendingCount = workOrders.filter(o => o.status === 'PENDING').length
  const doneCount = workOrders.filter(o => o.status === 'DONE').length

  if (!isVisible) return null

  // No workspace folder
  if (!workspaceFolderPath) {
    return (
      <div className="ct-panel">
        <div className="ct-panel-header">
          <h3>{t('controlTower.title')}</h3>
        </div>
        <div className="ct-empty">{t('controlTower.noWorkspace')}</div>
      </div>
    )
  }

  // No _ct-workorders/ directory
  if (!hasCtDir && !loading) {
    return (
      <div className="ct-panel">
        <div className="ct-panel-header">
          <h3>{t('controlTower.title')}</h3>
        </div>
        <div className="ct-empty">
          <div className="ct-empty-icon">🗼</div>
          <p>{t('controlTower.notDetected')}</p>
          <code className="ct-path">_ct-workorders/</code>
        </div>
      </div>
    )
  }

  return (
    <div className="ct-panel">
      <CtToast messages={toastMessages} onDismiss={dismissToast} />

      <div className="ct-panel-header">
        <h3>{t('controlTower.title')}</h3>
        <div className="ct-header-actions">
          <button className="ct-refresh-btn" onClick={() => { loadWorkOrders(); loadSprintStatus() }} title={t('controlTower.refresh')}>
            ↻
          </button>
        </div>
      </div>

      {/* Sub-tabs: Orders | Kanban | Sprint */}
      <div className="ct-tabs">
        <button
          className={`ct-tab${activeTab === 'orders' ? ' active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          {t('controlTower.tab.orders')}
        </button>
        <button
          className={`ct-tab${activeTab === 'kanban' ? ' active' : ''}`}
          onClick={() => setActiveTab('kanban')}
        >
          {t('controlTower.tab.kanban')}
        </button>
        {sprintStatus && (
          <button
            className={`ct-tab${activeTab === 'sprint' ? ' active' : ''}`}
            onClick={() => setActiveTab('sprint')}
          >
            {t('controlTower.tab.sprint')}
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="ct-summary">
        {activeCount > 0 && <span className="ct-badge ct-status-in-progress">{activeCount} active</span>}
        {pendingCount > 0 && <span className="ct-badge ct-status-pending">{pendingCount} pending</span>}
        {doneCount > 0 && <span className="ct-badge ct-status-done">{doneCount} done</span>}
        <span className="ct-badge ct-total">{workOrders.length} total</span>
      </div>

      {/* Tab content */}
      {activeTab === 'orders' && (
        <>
          {/* Filter bar */}
          <div className="ct-filter-bar">
            {(['all', 'URGENT', 'IN_PROGRESS', 'PENDING', 'BLOCKED', 'DONE'] as const).map(s => (
              <button
                key={s}
                className={`ct-filter-btn${filterStatus === s ? ' active' : ''}`}
                onClick={() => setFilterStatus(s)}
              >
                {s === 'all' ? t('controlTower.all') : s.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Work order list */}
          <div className="ct-order-list">
            {loading && <div className="ct-loading">{t('controlTower.loading')}</div>}
            {!loading && filteredOrders.length === 0 && (
              <div className="ct-empty-list">{t('controlTower.noOrders')}</div>
            )}
            {filteredOrders.map(order => (
              <div
                key={order.id}
                className={`ct-order-card ${statusColor(order.status)}${expandedId === order.id ? ' expanded' : ''}`}
                onClick={() => setExpandedId(prev => prev === order.id ? null : order.id)}
              >
                <div className="ct-order-header">
                  <span className="ct-order-id">{order.id}</span>
                  <span className="ct-order-title">{order.title}</span>
                  <span className={`ct-status-badge ${statusColor(order.status)}`}>
                    {statusLabel(order.status)}
                  </span>
                </div>

                {expandedId === order.id && (
                  <div className="ct-order-detail">
                    {order.createdAt && (
                      <div className="ct-detail-row">
                        <span className="ct-detail-label">{t('controlTower.created')}</span>
                        <span>{order.createdAt}</span>
                      </div>
                    )}
                    {order.startedAt && (
                      <div className="ct-detail-row">
                        <span className="ct-detail-label">{t('controlTower.started')}</span>
                        <span>{order.startedAt}</span>
                      </div>
                    )}
                    {order.estimatedSize && (
                      <div className="ct-detail-row">
                        <span className="ct-detail-label">{t('controlTower.size')}</span>
                        <span>{order.estimatedSize}</span>
                      </div>
                    )}
                    {order.contextRisk && (
                      <div className="ct-detail-row">
                        <span className="ct-detail-label">{t('controlTower.risk')}</span>
                        <span>{order.contextRisk}</span>
                      </div>
                    )}
                    {order.targetSubproject && (
                      <div className="ct-detail-row">
                        <span className="ct-detail-label">{t('controlTower.subproject')}</span>
                        <span>{order.targetSubproject}</span>
                      </div>
                    )}
                    <div className="ct-order-actions">
                      {onExecWorkOrder && (order.status === 'PENDING' || order.status === 'URGENT') && (
                        <button
                          className="ct-exec-btn"
                          onClick={e => { e.stopPropagation(); onExecWorkOrder(order.id) }}
                        >
                          ▶ {t('controlTower.execute')}
                        </button>
                      )}
                      {onDoneWorkOrder && DONE_ELIGIBLE.has(order.status) && (
                        <button
                          className="ct-done-btn"
                          onClick={e => { e.stopPropagation(); onDoneWorkOrder(order.id) }}
                        >
                          🔧 {t('controlTower.done')}
                        </button>
                      )}
                      <button
                        className="ct-view-file-btn"
                        onClick={e => {
                          e.stopPropagation()
                          if (!ctDirPath) return
                          const filePath = `${ctDirPath}/${order.filename}`
                          window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'files' } }))
                          window.dispatchEvent(new CustomEvent('file-tree-reveal', { detail: { path: filePath } }))
                        }}
                      >
                        📄 {t('controlTower.viewFile')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'kanban' && (
        <div className="ct-tab-content">
          <KanbanView workOrders={workOrders} onExecWorkOrder={onExecWorkOrder} onDoneWorkOrder={onDoneWorkOrder} />
        </div>
      )}

      {activeTab === 'sprint' && sprintStatus && (
        <div className="ct-tab-content">
          <SprintProgress sprint={sprintStatus} workOrders={workOrders} />
        </div>
      )}
    </div>
  )
}
