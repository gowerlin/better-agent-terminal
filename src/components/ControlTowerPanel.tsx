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
import { BmadWorkflowView } from './BmadWorkflowView'
import { CtToast, useCtToast } from './CtToast'
import { BugTrackerView } from './BugTrackerView'
import { BacklogView } from './BacklogView'
import { DecisionsView } from './DecisionsView'
import { type BugEntry, parseBugTracker } from '../types/bug-tracker'
import { type BacklogEntry, parseBacklog } from '../types/backlog'
import { type DecisionEntry, parseDecisionLog } from '../types/decision-log'
import { type BmadWorkflow, buildBmadWorkflow, PHASE_DEFINITIONS } from '../types/bmad-workflow'
import { type BmadEpic, parseEpicsFile, buildSprintStoryMap } from '../types/bmad-epic'
import { BmadEpicsView } from './BmadEpicsView'
import { SprintDashboard } from './SprintDashboard'

type CtTab = 'sprint' | 'orders' | 'kanban' | 'workflow' | 'bugs' | 'backlog' | 'decisions'

interface ControlTowerPanelProps {
  isVisible: boolean
  workspaceFolderPath: string | null
  onExecWorkOrder?: (workOrderId: string) => void
  onDoneWorkOrder?: (workOrderId: string) => void
}

/** Statuses eligible for ct-done remedial close */
const DONE_ELIGIBLE: ReadonlySet<WorkOrderStatus> = new Set(['IN_PROGRESS', 'INTERRUPTED', 'PARTIAL', 'BLOCKED', 'FAILED'])

/** Format file mtime to YYYY-MM-DD HH:mm */
function formatMtime(mtimeMs: number): string {
  const d = new Date(mtimeMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ControlTowerPanel({ isVisible, workspaceFolderPath, onExecWorkOrder, onDoneWorkOrder }: ControlTowerPanelProps) {
  const { t } = useTranslation()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [hasCtDir, setHasCtDir] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | 'all'>('all')
  const [activeTab, setActiveTab] = useState<CtTab>('orders')
  const [sprintStatus, setSprintStatus] = useState<SprintStatus | null>(null)
  const [bugEntries, setBugEntries] = useState<BugEntry[]>([])
  const [backlogEntries, setBacklogEntries] = useState<BacklogEntry[]>([])
  const [decisions, setDecisions] = useState<DecisionEntry[]>([])
  const [decisionRawContent, setDecisionRawContent] = useState<string>('')
  const [bmadWorkflow, setBmadWorkflow] = useState<BmadWorkflow | null>(null)
  const [bmadEpics, setBmadEpics] = useState<BmadEpic[]>([])
  const [showArchivedOrders, setShowArchivedOrders] = useState(false)
  const [archivedOrders, setArchivedOrders] = useState<WorkOrder[]>([])
  const ctDirRef = useRef<string | null>(null)
  const bmadOutputRef = useRef<string | null>(null)
  const prevOrdersRef = useRef<Map<string, WorkOrderStatus>>(new Map())
  const sprintStatusRef = useRef<SprintStatus | null>(null)
  const { messages: toastMessages, addToast, dismissToast } = useCtToast()

  // Build paths
  const ctDirPath = workspaceFolderPath ? `${workspaceFolderPath}/_ct-workorders` : null
  const bmadOutputPath = workspaceFolderPath ? `${workspaceFolderPath}/_bmad-output` : null

  // Load BMad workflow by checking artifact file existence
  const loadBmadWorkflow = useCallback(async () => {
    if (!bmadOutputPath) return
    const fileExistsMap: Record<string, boolean> = {}

    const dirs = ['planning-artifacts', 'implementation-artifacts'] as const
    for (const dir of dirs) {
      try {
        const entries = await window.electronAPI.fs.readdir(`${bmadOutputPath}/${dir}`)
        const fileNames = new Set(entries.filter(e => !e.isDirectory).map(e => e.name))
        for (const phaseDef of PHASE_DEFINITIONS) {
          for (const artifact of phaseDef.artifacts) {
            if (artifact.dir === dir) {
              fileExistsMap[`${dir}/${artifact.name}`] = fileNames.has(artifact.name)
            }
          }
        }
      } catch {
        for (const phaseDef of PHASE_DEFINITIONS) {
          for (const artifact of phaseDef.artifacts) {
            if (artifact.dir === dir) {
              fileExistsMap[`${dir}/${artifact.name}`] = false
            }
          }
        }
      }
    }

    setBmadWorkflow(buildBmadWorkflow(fileExistsMap))
  }, [bmadOutputPath])

  // Load Epic/Story data from _bmad-output/planning-artifacts/epics.md
  // Uses ref for sprintStatus to keep callback reference stable and avoid infinite loop
  const loadEpics = useCallback(async () => {
    if (!bmadOutputPath) return
    const epicsPath = `${bmadOutputPath}/planning-artifacts/epics.md`

    try {
      const result = await window.electronAPI.fs.readFile(epicsPath)
      if (!result.content) { setBmadEpics([]); return }

      // Build sprint story map for status cross-reference (read from ref)
      let storyMap: Map<string, { status: import('../types/bmad-epic').StoryStatus; workOrderId?: string }> | undefined
      const currentSprintStatus = sprintStatusRef.current
      if (currentSprintStatus) {
        storyMap = buildSprintStoryMap(
          currentSprintStatus.stories.map(s => ({ id: s.id, status: s.status, workOrderId: s.workOrderId }))
        )
      }

      const parsed = parseEpicsFile(result.content, storyMap)
      setBmadEpics(parsed)
    } catch {
      setBmadEpics([])
    }
  }, [bmadOutputPath])

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
            const stat = await window.electronAPI.fs.stat(yamlPath)
            const withMtime = stat?.mtimeMs
              ? { ...parsed, lastUpdated: formatMtime(stat.mtimeMs) }
              : parsed
            setSprintStatus(withMtime)
            return
          }
        }
      } catch {
        // Try next path
      }
    }
    setSprintStatus(null)
  }, [workspaceFolderPath])

  // Keep sprintStatus ref in sync and reload epics when sprint data changes
  useEffect(() => {
    sprintStatusRef.current = sprintStatus
    if (sprintStatus && isVisible) {
      loadEpics()
    }
  }, [sprintStatus, isVisible, loadEpics])

  // Load bug entries from _bug-tracker.md
  const loadBugs = useCallback(async () => {
    if (!ctDirPath) return
    try {
      const bugTrackerPath = `${ctDirPath}/_bug-tracker.md`
      const result = await window.electronAPI.fs.readFile(bugTrackerPath)
      if (result.content) {
        setBugEntries(parseBugTracker(result.content))
      }
    } catch {
      setBugEntries([])
    }
  }, [ctDirPath])

  // Load backlog entries from _backlog.md
  const loadBacklog = useCallback(async () => {
    if (!ctDirPath) return
    try {
      const backlogPath = `${ctDirPath}/_backlog.md`
      const result = await window.electronAPI.fs.readFile(backlogPath)
      if (result.content) {
        setBacklogEntries(parseBacklog(result.content))
      }
    } catch {
      setBacklogEntries([])
    }
  }, [ctDirPath])

  // Load decision log from _decision-log.md
  const loadDecisions = useCallback(async () => {
    if (!ctDirPath) return
    try {
      const decisionPath = `${ctDirPath}/_decision-log.md`
      const result = await window.electronAPI.fs.readFile(decisionPath)
      if (result.content) {
        setDecisions(parseDecisionLog(result.content))
        setDecisionRawContent(result.content)
      }
    } catch {
      setDecisions([])
      setDecisionRawContent('')
    }
  }, [ctDirPath])

  // Load archived work orders from _archive/workorders/
  const loadArchivedOrders = useCallback(async () => {
    if (!workspaceFolderPath) return
    const archivePath = `${workspaceFolderPath}/_ct-workorders/_archive/workorders`
    try {
      const entries = await window.electronAPI.fs.readdir(archivePath)
      const orderFiles = entries.filter(e => !e.isDirectory && isWorkOrderFile(e.name))
      const orders: WorkOrder[] = []
      for (const file of orderFiles) {
        const result = await window.electronAPI.fs.readFile(file.path)
        if (result.content) {
          orders.push({ ...parseWorkOrder(file.name, result.content), isArchived: true })
        }
      }
      orders.sort((a, b) => b.id.localeCompare(a.id)) // newest first
      setArchivedOrders(orders)
    } catch {
      setArchivedOrders([])
    }
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

      // Deduplicate by order ID (defensive — prevents React key collisions)
      const seen = new Set<string>()
      const uniqueOrders: WorkOrder[] = []
      for (const o of orders) {
        if (!seen.has(o.id)) {
          seen.add(o.id)
          uniqueOrders.push(o)
        }
      }

      // Sort: URGENT first, then IN_PROGRESS, PENDING, others, DONE last
      const priority: Record<string, number> = {
        URGENT: 0, IN_PROGRESS: 1, PENDING: 2, BLOCKED: 3,
        PARTIAL: 4, INTERRUPTED: 5, FAILED: 6, DONE: 7,
      }
      uniqueOrders.sort((a, b) => {
        const statusOrder = (priority[a.status] ?? 99) - (priority[b.status] ?? 99)
        if (statusOrder !== 0) return statusOrder
        return b.id.localeCompare(a.id, undefined, { numeric: true })
      })

      detectStatusChanges(uniqueOrders)
      setWorkOrders(uniqueOrders)
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
    loadBugs()
    loadBacklog()
    loadDecisions()
    loadBmadWorkflow()
    loadEpics()
  }, [isVisible, ctDirPath, loadWorkOrders, loadSprintStatus, loadBugs, loadBacklog, loadDecisions, loadBmadWorkflow, loadEpics])

  // Watch _ct-workorders/ and _bmad-output/ for changes
  useEffect(() => {
    if (!isVisible || !ctDirPath) return

    ctDirRef.current = ctDirPath
    window.electronAPI.fs.watch(ctDirPath)

    // Also watch _bmad-output/ if present (for Workflow/Epics auto-refresh)
    if (bmadOutputPath) {
      window.electronAPI.fs.watch(bmadOutputPath).then((ok: boolean) => {
        if (ok) bmadOutputRef.current = bmadOutputPath
      })
    }

    const unsubscribe = window.electronAPI.fs.onChanged((changedPath: string) => {
      if (changedPath === ctDirRef.current) {
        loadWorkOrders()
        loadSprintStatus()
        loadBugs()
        loadBacklog()
        loadDecisions()
        loadBmadWorkflow()
        loadEpics()
      } else if (changedPath === bmadOutputRef.current) {
        loadBmadWorkflow()
        loadEpics()
      }
    })

    return () => {
      unsubscribe()
      if (ctDirRef.current) {
        window.electronAPI.fs.unwatch(ctDirRef.current)
      }
      if (bmadOutputRef.current) {
        window.electronAPI.fs.unwatch(bmadOutputRef.current)
        bmadOutputRef.current = null
      }
    }
  }, [isVisible, ctDirPath, bmadOutputPath, loadWorkOrders, loadSprintStatus, loadBugs, loadBacklog, loadDecisions, loadBmadWorkflow, loadEpics])

  // Load/clear archived orders when toggle changes
  useEffect(() => {
    if (showArchivedOrders) {
      loadArchivedOrders()
    } else {
      setArchivedOrders([])
    }
  }, [showArchivedOrders, loadArchivedOrders])

  const filteredOrders = filterStatus === 'all'
    ? workOrders
    : workOrders.filter(o => o.status === filterStatus)

  // Combined active + archived orders for rendering (archived always appended at end)
  const displayOrders = showArchivedOrders
    ? [...filteredOrders, ...archivedOrders]
    : filteredOrders

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
          <button className="ct-refresh-btn" onClick={() => { loadWorkOrders(); loadSprintStatus(); loadBugs(); loadBacklog(); loadDecisions(); loadBmadWorkflow(); loadEpics() }} title={t('controlTower.refresh')}>
            ↻
          </button>
        </div>
      </div>

      {/* Sub-tabs: Sprint | Orders | Epics | ... */}
      <div className="ct-tabs">
        <button
          className={`ct-tab${activeTab === 'sprint' ? ' active' : ''}`}
          onClick={() => setActiveTab('sprint')}
        >
          {t('controlTower.tab.sprint')}
        </button>
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
          {t('controlTower.tab.epics')}
        </button>
        <button
          className={`ct-tab${activeTab === 'workflow' ? ' active' : ''}`}
          onClick={() => setActiveTab('workflow')}
        >
          {t('controlTower.tab.workflow')}
        </button>
        <button
          className={`ct-tab${activeTab === 'bugs' ? ' active' : ''}`}
          onClick={() => setActiveTab('bugs')}
        >
          {t('controlTower.tab.bugs')}
        </button>
        <button
          className={`ct-tab${activeTab === 'backlog' ? ' active' : ''}`}
          onClick={() => setActiveTab('backlog')}
        >
          {t('controlTower.tab.backlog')}
        </button>
        <button
          className={`ct-tab${activeTab === 'decisions' ? ' active' : ''}`}
          onClick={() => setActiveTab('decisions')}
        >
          {t('controlTower.tab.decisions')}
        </button>
      </div>

      {/* Summary bar */}
      <div className="ct-summary">
        {activeCount > 0 && <span className="ct-badge ct-status-in-progress">{activeCount} active</span>}
        {pendingCount > 0 && <span className="ct-badge ct-status-pending">{pendingCount} pending</span>}
        {doneCount > 0 && <span className="ct-badge ct-status-done">{doneCount} done</span>}
        <span className="ct-badge ct-total">{workOrders.length} total</span>
        {activeTab === 'orders' && (
          <label className="ct-archive-toggle">
            <input
              type="checkbox"
              checked={showArchivedOrders}
              onChange={e => setShowArchivedOrders(e.target.checked)}
            />
            📦 {t('controlTower.includeArchived')}
          </label>
        )}
      </div>

      {/* Tab content */}
      <div className="ct-tab-content" style={{ display: activeTab === 'sprint' ? undefined : 'none' }}>
        <SprintDashboard sprintStatus={sprintStatus} />
      </div>

      <div style={{ display: activeTab === 'orders' ? undefined : 'none' }}>
        {/* Filter bar */}
        <div className="ct-filter-bar">
          {(['all', 'URGENT', 'IN_PROGRESS', 'PENDING', 'BLOCKED', 'DONE'] as const).map(s => (
            <button
              key={s}
              className={`ct-filter-btn${filterStatus === s ? ' active' : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'all' ? t('controlTower.all') : statusLabel(s)}
            </button>
          ))}
        </div>

        {/* Work order list */}
        <div className="ct-order-list">
          {loading && <div className="ct-loading">{t('controlTower.loading')}</div>}
          {!loading && displayOrders.length === 0 && (
            <div className="ct-empty-list">{t('controlTower.noOrders')}</div>
          )}
          {displayOrders.map(order => (
            <div
              key={order.isArchived ? `arch-${order.id}` : order.id}
              className={`ct-order-card ${statusColor(order.status)}${expandedId === order.id ? ' expanded' : ''}${order.isArchived ? ' ct-archived-item' : ''}`}
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
                        const filePath = order.isArchived
                          ? `${ctDirPath}/_archive/workorders/${order.filename}`
                          : `${ctDirPath}/${order.filename}`
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
      </div>

      <div className="ct-tab-content" style={{ display: activeTab === 'kanban' ? undefined : 'none' }}>
        <BmadEpicsView epics={bmadEpics} loading={loading} ctDirPath={ctDirPath} />
      </div>

      <div className="ct-tab-content" style={{ display: activeTab === 'workflow' ? undefined : 'none' }}>
        <BmadWorkflowView
          workflow={bmadWorkflow}
          loading={loading}
          bmadOutputPath={bmadOutputPath ?? ''}
        />
      </div>

      <div className="ct-tab-content" style={{ display: activeTab === 'bugs' ? undefined : 'none' }}>
        <BugTrackerView bugs={bugEntries} loading={loading} ctDirPath={ctDirPath} />
      </div>

      <div className="ct-tab-content" style={{ display: activeTab === 'backlog' ? undefined : 'none' }}>
        <BacklogView entries={backlogEntries} loading={loading} ctDirPath={ctDirPath} />
      </div>

      <div className="ct-tab-content" style={{ display: activeTab === 'decisions' ? undefined : 'none' }}>
        <DecisionsView decisions={decisions} loading={loading} rawContent={decisionRawContent} ctDirPath={ctDirPath} />
      </div>
    </div>
  )
}
