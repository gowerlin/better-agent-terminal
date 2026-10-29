import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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
import { openFileInFilesTab } from '../state/openFileInFilesTab'
import { type BugEntry, parseBugTracker, parseBugFile } from '../types/bug-tracker'
import { type BacklogEntry, parseBacklog, parsePlanFile, extractPriorityFromPlanContent } from '../types/backlog'
import { type DecisionEntry, parseDecisionLog } from '../types/decision-log'
import { type BmadWorkflow, buildBmadWorkflow, PHASE_DEFINITIONS } from '../types/bmad-workflow'
import { type BmadEpic, parseEpicsFile, buildSprintStoryMap } from '../types/bmad-epic'
import { BmadEpicsView } from './BmadEpicsView'
import { TowerOverview, type TowerStateLoad, type ProjectConfigLoad, type ConfigSourcesLoad } from './TowerOverview'
import { parseTowerState } from '../lib/ct-tower-overview'
import { unsupportedRemoteChannel } from '../lib/remote-unsupported'

type CtTab = 'sprint' | 'orders' | 'kanban' | 'workflow' | 'bugs' | 'backlog' | 'decisions'

interface ControlTowerPanelProps {
  isVisible: boolean
  workspaceFolderPath: string | null
  onExecWorkOrder?: (workOrderId: string) => void
  onDoneWorkOrder?: (workOrderId: string) => void
}

/** Statuses eligible for ct-done remedial close */
const DONE_ELIGIBLE: ReadonlySet<WorkOrderStatus> = new Set(['IN_PROGRESS', 'INTERRUPTED', 'PAUSED', 'PARTIAL', 'BLOCKED', 'FAILED'])

/**
 * Last seen work order statuses, tagged with the `_ct-workorders/` dir they came from (BUG-127).
 * The right-sidebar panel is one instance whose `workspaceFolderPath` changes on workspace switch,
 * so the baseline must belong to a workspace, not to the panel.
 */
export interface WorkOrderBaseline {
  ctDir: string
  statuses: Map<string, WorkOrderStatus>
}

export type WorkOrderNotice =
  | { kind: 'new'; id: string }
  | { kind: 'completed' | 'started' | 'attention'; id: string; status: WorkOrderStatus }

/** More new orders than this in one load are merged into a single toast. */
export const MAX_NEW_ORDER_TOASTS = 3
/** Toasts kept on screen at once; the oldest are dismissed first. */
export const MAX_VISIBLE_CT_TOASTS = 5

/**
 * Compare a fresh load against the baseline. A load for a dir the baseline does not belong to
 * (first load, or after a workspace switch) only becomes the new baseline: switching workspaces
 * never notifies, and changes made while another workspace was shown are absorbed silently.
 */
export function diffWorkOrders(
  baseline: WorkOrderBaseline | null,
  ctDir: string,
  orders: readonly WorkOrder[],
): { baseline: WorkOrderBaseline; notices: WorkOrderNotice[] } {
  const statuses = new Map<string, WorkOrderStatus>()
  for (const wo of orders) statuses.set(wo.id, wo.status)
  const next = { ctDir, statuses }
  if (!baseline || baseline.ctDir !== ctDir) return { baseline: next, notices: [] }

  const notices: WorkOrderNotice[] = []
  for (const wo of orders) {
    const prevStatus = baseline.statuses.get(wo.id)
    if (prevStatus && prevStatus !== wo.status) {
      if (wo.status === 'DONE' || wo.status === 'FIXED' || wo.status === 'ABANDONED') {
        notices.push({ kind: 'completed', id: wo.id, status: wo.status })
      } else if (wo.status === 'IN_PROGRESS' && prevStatus === 'PENDING') {
        notices.push({ kind: 'started', id: wo.id, status: wo.status })
      } else if (wo.status === 'BLOCKED' || wo.status === 'FAILED') {
        notices.push({ kind: 'attention', id: wo.id, status: wo.status })
      }
    } else if (!prevStatus) {
      notices.push({ kind: 'new', id: wo.id })
    }
  }
  return { baseline: next, notices }
}

/**
 * T0708 (BUG-172): a CT file that exists but could not be read — `fs:readFile` refuses files over
 * 512 KiB (`File too large`, with `size`). Shown as an error, never as an empty list.
 */
export interface CtReadError {
  /** Path shown to the user, relative to the workspace folder */
  file: string
  error: string
  size?: number
}

export type CtFileRead =
  | { kind: 'loaded'; content: string }
  | { kind: 'missing' }
  | { kind: 'error'; error: CtReadError }

/**
 * Read a CT file and tell "missing" apart from "unreadable". `fs:readFile` reports a missing file
 * as `Failed to read file`, so any error other than `File too large` is checked with `fs:stat`
 * (as loadTowerOverview does): no stat → missing, keeping the empty-list behaviour.
 */
export async function readCtFile(path: string, file: string): Promise<CtFileRead> {
  let result: { content?: string | null; error?: string; size?: number }
  try {
    result = await window.electronAPI.fs.readFile(path)
  } catch (err) {
    result = { error: err instanceof Error ? err.message : 'Failed to read file' }
  }
  if (result.content != null) return { kind: 'loaded', content: result.content }
  if (result.error === 'File too large') return { kind: 'error', error: { file, error: result.error, size: result.size } }
  let exists = false
  try {
    exists = !!(await window.electronAPI.fs.stat(path))
  } catch {
    exists = false
  }
  return exists ? { kind: 'error', error: { file, error: result.error ?? 'Failed to read file' } } : { kind: 'missing' }
}

export function formatCtReadError(t: TFunction, e: CtReadError): string {
  return e.error === 'File too large'
    ? t('controlTower.readError.tooLarge', { file: e.file, kb: Math.round((e.size ?? 0) / 1024) })
    : t('controlTower.readError.failed', { file: e.file, error: e.error })
}

/** T0708: list entry for a work order file that exists but could not be read */
function unreadableWorkOrder(filename: string): WorkOrder {
  return { ...parseWorkOrder(filename, ''), status: 'UNKNOWN', parseWarnings: undefined }
}

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
  const [showArchivedBugs, setShowArchivedBugs] = useState(false)
  const [archivedBugs, setArchivedBugs] = useState<BugEntry[]>([])
  const [showArchivedBacklog, setShowArchivedBacklog] = useState(false)
  const [archivedBacklog, setArchivedBacklog] = useState<BacklogEntry[]>([])
  // T0708 (BUG-172): files that exist but could not be read, per view (null / empty = none)
  const [bugReadError, setBugReadError] = useState<CtReadError | null>(null)
  const [backlogReadError, setBacklogReadError] = useState<CtReadError | null>(null)
  const [decisionReadError, setDecisionReadError] = useState<CtReadError | null>(null)
  const [epicsReadError, setEpicsReadError] = useState<CtReadError | null>(null)
  const [sprintReadError, setSprintReadError] = useState<CtReadError | null>(null)
  const [archivedBugReadErrors, setArchivedBugReadErrors] = useState<CtReadError[]>([])
  const [archivedBacklogReadErrors, setArchivedBacklogReadErrors] = useState<CtReadError[]>([])
  /** Unreadable work orders stay in the list as `UNKNOWN`; keyed by filename */
  const [orderReadErrors, setOrderReadErrors] = useState<Record<string, CtReadError>>({})
  const [archivedOrderReadErrors, setArchivedOrderReadErrors] = useState<Record<string, CtReadError>>({})
  // T0701: overview inputs (null = not loaded yet for this workspace)
  const [towerState, setTowerState] = useState<TowerStateLoad | null>(null)
  const [projectConfig, setProjectConfig] = useState<ProjectConfigLoad | null>(null)
  const [configSources, setConfigSources] = useState<ConfigSourcesLoad | null>(null)
  const ctDirRef = useRef<string | null>(null)
  const bmadOutputRef = useRef<string | null>(null)
  const orderBaselineRef = useRef<WorkOrderBaseline | null>(null)
  const orderLoadSeqRef = useRef(0)
  const appliedOrderLoadSeqRef = useRef(0)
  const sprintStatusRef = useRef<SprintStatus | null>(null)
  const { messages: toastMessages, addToast, dismissToast } = useCtToast()
  const toastMessagesRef = useRef(toastMessages)
  toastMessagesRef.current = toastMessages

  // Build paths
  const ctDirPath = workspaceFolderPath ? `${workspaceFolderPath}/_ct-workorders` : null
  const bmadOutputPath = workspaceFolderPath ? `${workspaceFolderPath}/_bmad-output` : null

  // Loads are async; a result for a workspace that is no longer shown is dropped (BUG-127)
  const currentWorkspaceRef = useRef(workspaceFolderPath)
  currentWorkspaceRef.current = workspaceFolderPath
  const isStale = useCallback((folder: string | null) => currentWorkspaceRef.current !== folder, [])

  // Toasts belong to the workspace that raised them: clear them on switch
  useEffect(() => {
    for (const m of toastMessagesRef.current) dismissToast(m.id)
  }, [workspaceFolderPath, dismissToast])

  // Cap the stack; the oldest toasts go first
  useEffect(() => {
    if (toastMessages.length <= MAX_VISIBLE_CT_TOASTS) return
    for (const m of toastMessages.slice(0, toastMessages.length - MAX_VISIBLE_CT_TOASTS)) dismissToast(m.id)
  }, [toastMessages, dismissToast])

  // Load BMad workflow by checking artifact file existence
  const loadBmadWorkflow = useCallback(async () => {
    if (!bmadOutputPath) return
    const folder = workspaceFolderPath
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

    if (isStale(folder)) return
    setBmadWorkflow(buildBmadWorkflow(fileExistsMap))
  }, [bmadOutputPath, workspaceFolderPath, isStale])

  // Load Epic/Story data from _bmad-output/planning-artifacts/epics.md
  // Uses ref for sprintStatus to keep callback reference stable and avoid infinite loop
  const loadEpics = useCallback(async () => {
    if (!bmadOutputPath) return
    const epicsPath = `${bmadOutputPath}/planning-artifacts/epics.md`
    const folder = workspaceFolderPath

    try {
      const read = await readCtFile(epicsPath, '_bmad-output/planning-artifacts/epics.md')
      if (isStale(folder)) return
      setEpicsReadError(read.kind === 'error' ? read.error : null)
      if (read.kind !== 'loaded' || !read.content) { setBmadEpics([]); return }

      // Build sprint story map for status cross-reference (read from ref)
      let storyMap: Map<string, { status: import('../types/bmad-epic').StoryStatus; workOrderId?: string }> | undefined
      const currentSprintStatus = sprintStatusRef.current
      if (currentSprintStatus) {
        storyMap = buildSprintStoryMap(
          currentSprintStatus.stories.map(s => ({ id: s.id, status: s.status, workOrderId: s.workOrderId }))
        )
      }

      const parsed = parseEpicsFile(read.content, storyMap)
      setBmadEpics(parsed)
    } catch {
      if (isStale(folder)) return
      setBmadEpics([])
      setEpicsReadError(null)
    }
  }, [bmadOutputPath, workspaceFolderPath, isStale])

  // Load sprint-status.yaml from multiple possible locations
  const loadSprintStatus = useCallback(async () => {
    if (!workspaceFolderPath) return
    const folder = workspaceFolderPath
    const paths = getSprintYamlPaths(workspaceFolderPath)

    // T0708: the first unreadable candidate is reported only when no later candidate parses
    let firstError: CtReadError | null = null
    for (const yamlPath of paths) {
      try {
        const read = await readCtFile(yamlPath, yamlPath.slice(workspaceFolderPath.length + 1))
        if (read.kind === 'error') firstError ??= read.error
        if (read.kind === 'loaded' && read.content) {
          const parsed = parseSprintStatus(read.content)
          if (parsed) {
            const stat = await window.electronAPI.fs.stat(yamlPath)
            if (isStale(folder)) return
            const withMtime = stat?.mtimeMs
              ? { ...parsed, lastUpdated: formatMtime(stat.mtimeMs) }
              : parsed
            setSprintStatus(withMtime)
            setSprintReadError(null)
            return
          }
        }
      } catch {
        // Try next path
      }
    }
    if (isStale(folder)) return
    setSprintStatus(null)
    setSprintReadError(firstError)
  }, [workspaceFolderPath, isStale])

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
    const folder = workspaceFolderPath
    try {
      const bugTrackerPath = `${ctDirPath}/_bug-tracker.md`
      const read = await readCtFile(bugTrackerPath, '_ct-workorders/_bug-tracker.md')
      if (isStale(folder)) return
      // Always update state: parse content if available, clear if missing / unreadable
      setBugEntries(read.kind === 'loaded' ? parseBugTracker(read.content) : [])
      setBugReadError(read.kind === 'error' ? read.error : null)
    } catch {
      if (isStale(folder)) return
      setBugEntries([])
      setBugReadError(null)
    }
  }, [ctDirPath, workspaceFolderPath, isStale])

  // Load backlog entries from _backlog.md
  const loadBacklog = useCallback(async () => {
    if (!ctDirPath) return
    const folder = workspaceFolderPath
    try {
      const backlogPath = `${ctDirPath}/_backlog.md`
      const read = await readCtFile(backlogPath, '_ct-workorders/_backlog.md')
      const entries = read.kind === 'loaded' ? parseBacklog(read.content) : []

      // Enrich entries whose 優先級 is missing in _backlog.md (e.g. Completed table)
      // by reading the PLAN file and parsing its metadata block.
      const enriched = await Promise.all(
        entries.map(async entry => {
          if (entry.priority !== 'Unknown' || !entry.linkPath) return entry
          try {
            const planPath = `${ctDirPath}/${entry.linkPath}`
            const planResult = await window.electronAPI.fs.readFile(planPath)
            if (planResult.content == null) return entry
            const realPriority = extractPriorityFromPlanContent(planResult.content)
            return realPriority !== 'Unknown' ? { ...entry, priority: realPriority } : entry
          } catch {
            return entry
          }
        }),
      )

      if (isStale(folder)) return
      setBacklogEntries(enriched)
      setBacklogReadError(read.kind === 'error' ? read.error : null)
    } catch {
      if (isStale(folder)) return
      setBacklogEntries([])
      setBacklogReadError(null)
    }
  }, [ctDirPath, workspaceFolderPath, isStale])

  // Load decision log from _decision-log.md
  const loadDecisions = useCallback(async () => {
    if (!ctDirPath) return
    const folder = workspaceFolderPath
    try {
      const decisionPath = `${ctDirPath}/_decision-log.md`
      const read = await readCtFile(decisionPath, '_ct-workorders/_decision-log.md')
      if (isStale(folder)) return
      const content = read.kind === 'loaded' ? read.content : ''
      setDecisions(read.kind === 'loaded' ? parseDecisionLog(content) : [])
      setDecisionRawContent(content)
      setDecisionReadError(read.kind === 'error' ? read.error : null)
    } catch {
      if (isStale(folder)) return
      setDecisions([])
      setDecisionRawContent('')
      setDecisionReadError(null)
    }
  }, [ctDirPath, workspaceFolderPath, isStale])

  // Load archived work orders from _archive/workorders/
  const loadArchivedOrders = useCallback(async () => {
    if (!workspaceFolderPath) return
    const folder = workspaceFolderPath
    const archivePath = `${workspaceFolderPath}/_ct-workorders/_archive/workorders`
    try {
      const entries = await window.electronAPI.fs.readdir(archivePath)
      const orderFiles = entries.filter(e => !e.isDirectory && isWorkOrderFile(e.name))
      const orders: WorkOrder[] = []
      const readErrors: Record<string, CtReadError> = {}
      for (const file of orderFiles) {
        const read = await readCtFile(file.path, `_ct-workorders/_archive/workorders/${file.name}`)
        if (read.kind === 'loaded') {
          orders.push({ ...parseWorkOrder(file.name, read.content), isArchived: true })
        } else if (read.kind === 'error') {
          orders.push({ ...unreadableWorkOrder(file.name), isArchived: true })
          readErrors[file.name] = read.error
        }
      }
      orders.sort((a, b) => b.id.localeCompare(a.id)) // newest first
      if (isStale(folder)) return
      setArchivedOrders(orders)
      setArchivedOrderReadErrors(readErrors)
    } catch {
      if (isStale(folder)) return
      setArchivedOrders([])
      setArchivedOrderReadErrors({})
    }
  }, [workspaceFolderPath, isStale])

  // Load archived bugs from _archive/bugs/ — lazy on toggle flip
  const loadArchivedBugs = useCallback(async () => {
    if (!workspaceFolderPath) return
    const folder = workspaceFolderPath
    const archivePath = `${workspaceFolderPath}/_ct-workorders/_archive/bugs`
    try {
      const entries = await window.electronAPI.fs.readdir(archivePath)
      const bugFiles = entries.filter(e => !e.isDirectory && e.name.startsWith('BUG-') && e.name.endsWith('.md'))
      const bugs: BugEntry[] = []
      const readErrors: CtReadError[] = []
      for (const file of bugFiles) {
        const read = await readCtFile(file.path, `_ct-workorders/_archive/bugs/${file.name}`)
        if (read.kind === 'loaded') {
          const entry = parseBugFile(read.content, `_archive/bugs/${file.name}`)
          if (entry) bugs.push(entry)
        } else if (read.kind === 'error') {
          readErrors.push(read.error)
        }
      }
      bugs.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))
      if (isStale(folder)) return
      setArchivedBugs(bugs)
      setArchivedBugReadErrors(readErrors)
    } catch {
      if (isStale(folder)) return
      setArchivedBugs([])
      setArchivedBugReadErrors([])
    }
  }, [workspaceFolderPath, isStale])

  // Load archived plans from _archive/plans/ — lazy on toggle flip
  const loadArchivedBacklog = useCallback(async () => {
    if (!workspaceFolderPath) return
    const folder = workspaceFolderPath
    const archivePath = `${workspaceFolderPath}/_ct-workorders/_archive/plans`
    try {
      const entries = await window.electronAPI.fs.readdir(archivePath)
      const planFiles = entries.filter(e => !e.isDirectory && e.name.startsWith('PLAN-') && e.name.endsWith('.md'))
      const plans: BacklogEntry[] = []
      const readErrors: CtReadError[] = []
      for (const file of planFiles) {
        const read = await readCtFile(file.path, `_ct-workorders/_archive/plans/${file.name}`)
        if (read.kind === 'loaded') {
          const entry = parsePlanFile(read.content, `_archive/plans/${file.name}`)
          if (entry) plans.push(entry)
        } else if (read.kind === 'error') {
          readErrors.push(read.error)
        }
      }
      plans.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))
      if (isStale(folder)) return
      setArchivedBacklog(plans)
      setArchivedBacklogReadErrors(readErrors)
    } catch {
      if (isStale(folder)) return
      setArchivedBacklog([])
      setArchivedBacklogReadErrors([])
    }
  }, [workspaceFolderPath, isStale])

  // T0701: `_tower-state.md` + `_tower-config.yaml` (project layer). Both live in `_ct-workorders/`,
  // so the directory watcher's reloadAll keeps them current (R5).
  const loadTowerOverview = useCallback(async () => {
    if (!ctDirPath) return
    const folder = workspaceFolderPath
    const statePath = `${ctDirPath}/_tower-state.md`
    const configPath = `${ctDirPath}/_tower-config.yaml`
    const [stateResult, configResult] = await Promise.all([
      window.electronAPI.fs.readFile(statePath).catch(() => ({ error: 'Failed to read file' } as { content?: string; error?: string })),
      window.electronAPI.fs.readFile(configPath).catch(() => ({ error: 'Failed to read file' } as { content?: string; error?: string })),
    ])

    let nextState: TowerStateLoad
    if (stateResult.content != null) {
      const parsed = parseTowerState(stateResult.content)
      if (parsed.kind === 'no-summary' && parsed.summaryError) {
        window.electronAPI.debug.log(`[ct-overview] _tower-state.md summary ignored: ${parsed.summaryError}`)
      }
      let mtime: string | null = null
      if (parsed.kind === 'no-summary' && !parsed.lastUpdated) {
        const stat = await window.electronAPI.fs.stat(statePath).catch(() => null)
        mtime = stat?.mtimeMs ? formatMtime(stat.mtimeMs) : null
      }
      nextState = { status: 'loaded', parsed, mtime }
    } else {
      // fs:readFile reports a missing file as a read failure; tell them apart with stat
      const stat = await window.electronAPI.fs.stat(statePath).catch(() => null)
      nextState = stat ? { status: 'error', error: stateResult.error ?? 'Failed to read file' } : { status: 'missing' }
    }

    let nextConfig: ProjectConfigLoad
    if (configResult.content != null) {
      nextConfig = { status: 'loaded', content: configResult.content }
    } else {
      const stat = await window.electronAPI.fs.stat(configPath).catch(() => null)
      nextConfig = stat ? { status: 'error', error: configResult.error ?? 'Failed to read file' } : { status: 'missing' }
    }

    if (isStale(folder)) return
    setTowerState(nextState)
    setProjectConfig(nextConfig)
  }, [ctDirPath, workspaceFolderPath, isStale])

  // T0701: global + default config layers, read by the host this window is bound to. Outside the
  // watched directory, so reloaded when the overview becomes visible and on refresh (R5).
  const loadConfigSources = useCallback(async () => {
    if (!workspaceFolderPath) return
    const folder = workspaceFolderPath
    let next: ConfigSourcesLoad
    try {
      next = { status: 'ok', sources: await window.electronAPI.ctConfig.readSources() }
    } catch (err) {
      next = unsupportedRemoteChannel(err)
        ? { status: 'unsupported' }
        : { status: 'error', error: err instanceof Error ? err.message : String(err) }
      window.electronAPI.debug.log(`[ct-overview] config sources unavailable: ${next.status === 'error' ? next.error : 'no handler on this host'}`)
    }
    if (isStale(folder)) return
    setConfigSources(next)
  }, [workspaceFolderPath, isStale])

  // Detect work order status changes → toast notification
  const detectStatusChanges = useCallback((ctDir: string, newOrders: WorkOrder[]) => {
    const { baseline, notices } = diffWorkOrders(orderBaselineRef.current, ctDir, newOrders)
    orderBaselineRef.current = baseline

    const newIds = notices.filter(n => n.kind === 'new').map(n => n.id)
    if (newIds.length > MAX_NEW_ORDER_TOASTS) {
      const shown = newIds.slice(0, MAX_NEW_ORDER_TOASTS).join(', ')
      addToast(`📋 ${t('controlTower.toast.newOrder')}: ${shown} +${newIds.length - MAX_NEW_ORDER_TOASTS}`, 'info')
    }
    for (const n of notices) {
      if (n.kind === 'completed') {
        addToast(`✅ ${n.id} ${t('controlTower.toast.completed')}`, 'success', 6000)
      } else if (n.kind === 'started') {
        addToast(`🔄 ${n.id} ${t('controlTower.toast.started')}`, 'info')
      } else if (n.kind === 'attention') {
        addToast(`⚠️ ${n.id} → ${statusLabel(n.status)}`, 'warning')
      } else if (newIds.length <= MAX_NEW_ORDER_TOASTS) {
        addToast(`📋 ${t('controlTower.toast.newOrder')}: ${n.id}`, 'info')
      }
    }
  }, [addToast, t])

  // Load work orders from _ct-workorders/
  const loadWorkOrders = useCallback(async () => {
    if (!ctDirPath) return
    const folder = workspaceFolderPath
    const seq = ++orderLoadSeqRef.current
    // A newer load already applied, or the workspace changed while reading (BUG-127)
    const superseded = () => isStale(folder) || seq < appliedOrderLoadSeqRef.current
    setLoading(true)
    try {
      const entries = await window.electronAPI.fs.readdir(ctDirPath)
      const orderFiles = entries.filter(e => !e.isDirectory && isWorkOrderFile(e.name))

      const orders: WorkOrder[] = []
      const readErrors: Record<string, CtReadError> = {}
      for (const file of orderFiles) {
        const read = await readCtFile(file.path, `_ct-workorders/${file.name}`)
        if (read.kind === 'error') {
          // T0708 (BUG-172): an unreadable order stays listed as UNKNOWN instead of disappearing
          orders.push(unreadableWorkOrder(file.name))
          readErrors[file.name] = read.error
        } else if (read.kind === 'loaded') {
          const wo = parseWorkOrder(file.name, read.content)
          orders.push(wo)
          // T0348 / BUG-078 — silent fire-and-forget drift telemetry.
          // IO + log path live in main process (D090). One caller is enough
          // for Sprint 5 wiring; full ParseWarning fan-out is Sprint 6 polish.
          if (wo.parseWarnings && wo.parseWarnings.length > 0 && window.electronAPI?.ctDrift) {
            window.electronAPI.ctDrift.log(file.name, wo.parseWarnings).catch(() => {})
          }
        }
      }

      // Deduplicate by order ID (defensive — prevents React key collisions).
      // T0701 (R4): a status-less report sharing the ID (`T0177-report-….md` next to
      // `T0177-….md`) must not hide the work order itself, whichever sorts first.
      const seen = new Map<string, number>()
      const uniqueOrders: WorkOrder[] = []
      for (const o of orders) {
        const at = seen.get(o.id)
        if (at === undefined) {
          seen.set(o.id, uniqueOrders.length)
          uniqueOrders.push(o)
        } else if (uniqueOrders[at].status === 'UNKNOWN' && o.status !== 'UNKNOWN') {
          uniqueOrders[at] = o
        }
      }

      // Sort: URGENT first, then IN_PROGRESS, PENDING, others, DONE last
      const priority: Record<string, number> = {
        URGENT: 0, IN_PROGRESS: 1, PENDING: 2, BLOCKED: 3,
        PARTIAL: 4, INTERRUPTED: 5, PAUSED: 5, FAILED: 6, FIXED: 7, DONE: 7, ABANDONED: 8,
      }
      uniqueOrders.sort((a, b) => {
        const statusOrder = (priority[a.status] ?? 99) - (priority[b.status] ?? 99)
        if (statusOrder !== 0) return statusOrder
        return b.id.localeCompare(a.id, undefined, { numeric: true })
      })

      if (superseded()) return
      appliedOrderLoadSeqRef.current = seq
      // An unreadable order keeps its last known status for toasts, so becoming readable
      // again is not reported as a status change
      const prev = orderBaselineRef.current
      const forDiff = uniqueOrders.map(o => {
        const known = readErrors[o.filename] && prev?.ctDir === ctDirPath ? prev.statuses.get(o.id) : undefined
        return known ? { ...o, status: known } : o
      })
      detectStatusChanges(ctDirPath, forDiff)
      setWorkOrders(uniqueOrders)
      setOrderReadErrors(readErrors)
      setHasCtDir(true)
    } catch {
      if (superseded()) return
      appliedOrderLoadSeqRef.current = seq
      // No readable dir: the next successful load starts a fresh, silent baseline
      orderBaselineRef.current = null
      setWorkOrders([])
      setOrderReadErrors({})
      setHasCtDir(false)
    } finally {
      if (!isStale(folder) && seq === orderLoadSeqRef.current) setLoading(false)
    }
  }, [ctDirPath, workspaceFolderPath, isStale, detectStatusChanges])

  // Reload all CT data (used by auto-refresh and initial load)
  const reloadAll = useCallback(() => {
    loadWorkOrders()
    loadSprintStatus()
    loadBugs()
    loadBacklog()
    loadDecisions()
    loadBmadWorkflow()
    loadEpics()
    loadTowerOverview()
  }, [loadWorkOrders, loadSprintStatus, loadBugs, loadBacklog, loadDecisions, loadBmadWorkflow, loadEpics, loadTowerOverview])

  // Force-refresh: destroy + recreate watcher, then re-read all data from disk.
  // This recovers from broken watcher state (e.g. after git mv buffer overflow on Windows).
  const forceRefresh = useCallback(async () => {
    if (!ctDirPath) return
    // Reset watchers to recover from broken state
    await window.electronAPI.fs.resetWatch(ctDirPath)
    if (bmadOutputPath) {
      window.electronAPI.fs.resetWatch(bmadOutputPath)
    }
    // Re-read all data fresh from disk
    reloadAll()
    loadConfigSources()
    if (showArchivedOrders) loadArchivedOrders()
    if (showArchivedBugs) loadArchivedBugs()
    if (showArchivedBacklog) loadArchivedBacklog()
  }, [ctDirPath, bmadOutputPath, reloadAll, loadConfigSources, showArchivedOrders, loadArchivedOrders, showArchivedBugs, loadArchivedBugs, showArchivedBacklog, loadArchivedBacklog])

  // Initial load
  useEffect(() => {
    if (!isVisible || !ctDirPath) return
    reloadAll()
  }, [isVisible, ctDirPath, reloadAll])

  // T0701: a workspace switch drops the previous workspace's overview inputs
  useEffect(() => {
    setTowerState(null)
    setProjectConfig(null)
    setConfigSources(null)
  }, [workspaceFolderPath])

  // T0701: re-read the out-of-workspace config layers each time the overview becomes visible
  const overviewVisible = isVisible && activeTab === 'sprint' && !!ctDirPath
  useEffect(() => {
    if (overviewVisible) loadConfigSources()
  }, [overviewVisible, loadConfigSources])

  // Watch _ct-workorders/, _bmad-output/, and .git/index for changes
  useEffect(() => {
    if (!isVisible || !ctDirPath || !workspaceFolderPath) return

    ctDirRef.current = ctDirPath
    window.electronAPI.fs.watch(ctDirPath)

    // Also watch _bmad-output/ if present (for Workflow/Epics auto-refresh)
    if (bmadOutputPath) {
      window.electronAPI.fs.watch(bmadOutputPath).then((ok: boolean) => {
        if (ok) bmadOutputRef.current = bmadOutputPath
      })
    }

    // P1: Watch .git/ directory for git operations (merge, pull, mv, checkout)
    const gitDirPath = `${workspaceFolderPath}/.git`
    let gitWatchActive = false
    window.electronAPI.fs.watch(gitDirPath).then((ok: boolean) => {
      gitWatchActive = ok
    })

    const unsubscribe = window.electronAPI.fs.onChanged((changedPath: string) => {
      if (changedPath === ctDirRef.current) {
        reloadAll()
      } else if (changedPath === bmadOutputRef.current) {
        loadBmadWorkflow()
        loadEpics()
      } else if (changedPath === gitDirPath) {
        // Git operation detected (commit, merge, pull, checkout, mv)
        // Trigger a full refresh to catch any file changes
        reloadAll()
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
      if (gitWatchActive) {
        window.electronAPI.fs.unwatch(gitDirPath)
      }
    }
  }, [isVisible, ctDirPath, bmadOutputPath, workspaceFolderPath, reloadAll, loadBmadWorkflow, loadEpics])

  // Load/clear archived orders when toggle changes
  useEffect(() => {
    if (showArchivedOrders) {
      loadArchivedOrders()
    } else {
      setArchivedOrders([])
      setArchivedOrderReadErrors({})
    }
  }, [showArchivedOrders, loadArchivedOrders])

  useEffect(() => {
    if (showArchivedBugs) {
      loadArchivedBugs()
    } else {
      setArchivedBugs([])
      setArchivedBugReadErrors([])
    }
  }, [showArchivedBugs, loadArchivedBugs])

  useEffect(() => {
    if (showArchivedBacklog) {
      loadArchivedBacklog()
    } else {
      setArchivedBacklog([])
      setArchivedBacklogReadErrors([])
    }
  }, [showArchivedBacklog, loadArchivedBacklog])

  // Combined active + archived orders, then apply status filter (consistent with BugTrackerView/BacklogView)
  const allOrders = showArchivedOrders ? [...workOrders, ...archivedOrders] : workOrders
  const displayOrders = filterStatus === 'all'
    ? allOrders
    : allOrders.filter(o => o.status === filterStatus)

  const activeCount = workOrders.filter(o => o.status === 'IN_PROGRESS' || o.status === 'URGENT').length
  const pendingCount = workOrders.filter(o => o.status === 'PENDING').length
  const doneCount = workOrders.filter(o => o.status === 'DONE').length
  const abandonedCount = workOrders.filter(o => o.status === 'ABANDONED').length
  // T0701 (R4): legacy files with no status (reports) — shown apart, never as pending
  const noStatusCount = workOrders.filter(o => o.status === 'UNKNOWN').length

  // T0708 (BUG-172): read failures, formatted for the views
  const orderReadError = (o: WorkOrder) => (o.isArchived ? archivedOrderReadErrors : orderReadErrors)[o.filename]
  const readErrorTexts = (...errors: Array<CtReadError | null | undefined>) =>
    errors.filter((e): e is CtReadError => !!e).map(e => formatCtReadError(t, e))

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
          <button className="ct-refresh-btn" onClick={forceRefresh} title={t('controlTower.refresh')}>
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
        {abandonedCount > 0 && <span className="ct-badge ct-status-abandoned">{abandonedCount} inactive</span>}
        {noStatusCount > 0 && <span className="ct-badge ct-status-unknown">{noStatusCount} no status</span>}
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
        {/* T0701: mounted only while shown — it repeats work order titles from the Orders tab */}
        {activeTab === 'sprint' && (
          <TowerOverview
            towerState={towerState}
            workOrders={workOrders}
            projectConfig={projectConfig}
            configSources={configSources}
            sprintStatus={sprintStatus}
            sprintReadError={sprintReadError ? formatCtReadError(t, sprintReadError) : null}
            ctDirPath={ctDirPath}
            onOpenFile={openFileInFilesTab}
          />
        )}
      </div>

      <div className="ct-orders-tab" style={{ display: activeTab === 'orders' ? undefined : 'none' }}>
        {/* Filter bar */}
        <div className="ct-filter-bar">
          {(['all', 'URGENT', 'IN_PROGRESS', 'PENDING', 'BLOCKED', 'FIXED', 'DONE', 'ABANDONED'] as const).map(s => (
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
                {orderReadError(order) ? (
                  <span className="ct-order-title ct-read-error">⚠️ {formatCtReadError(t, orderReadError(order))}</span>
                ) : (
                  <span className="ct-order-title">{order.title}</span>
                )}
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
                        openFileInFilesTab(filePath)
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
        <BmadEpicsView epics={bmadEpics} loading={loading} ctDirPath={ctDirPath} readErrors={readErrorTexts(epicsReadError)} />
      </div>

      <div className="ct-tab-content" style={{ display: activeTab === 'workflow' ? undefined : 'none' }}>
        <BmadWorkflowView
          workflow={bmadWorkflow}
          loading={loading}
          bmadOutputPath={bmadOutputPath ?? ''}
        />
      </div>

      <div className="ct-tab-content" style={{ display: activeTab === 'bugs' ? undefined : 'none' }}>
        <BugTrackerView
          bugs={showArchivedBugs ? [...bugEntries, ...archivedBugs] : bugEntries}
          loading={loading}
          ctDirPath={ctDirPath}
          showArchived={showArchivedBugs}
          onShowArchivedChange={setShowArchivedBugs}
          readErrors={readErrorTexts(bugReadError, ...(showArchivedBugs ? archivedBugReadErrors : []))}
        />
      </div>

      <div className="ct-tab-content" style={{ display: activeTab === 'backlog' ? undefined : 'none' }}>
        <BacklogView
          entries={showArchivedBacklog ? [...backlogEntries, ...archivedBacklog] : backlogEntries}
          loading={loading}
          ctDirPath={ctDirPath}
          showArchived={showArchivedBacklog}
          onShowArchivedChange={setShowArchivedBacklog}
          readErrors={readErrorTexts(backlogReadError, ...(showArchivedBacklog ? archivedBacklogReadErrors : []))}
        />
      </div>

      <div className="ct-tab-content" style={{ display: activeTab === 'decisions' ? undefined : 'none' }}>
        <DecisionsView
          decisions={decisions}
          loading={loading}
          rawContent={decisionRawContent}
          ctDirPath={ctDirPath}
          readErrors={readErrorTexts(decisionReadError)}
        />
      </div>
    </div>
  )
}
