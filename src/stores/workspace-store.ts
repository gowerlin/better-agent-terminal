import { v4 as uuidv4 } from 'uuid'
import type { Workspace, TerminalInstance, AppState, CtWorktreeInfo } from '../types'
import { AgentPresetId, getAgentPreset } from '../types/agent-presets'
import { normalizeAgentParams } from '../types/agent-profiles'
import { isIntegrated, isWorktreeAgent } from '../types/agent-runtime'
import { requestPtyReplay } from '../lib/pty-replay'
import { resolveEffectiveAgentArgs, resolveEffectiveDefaultAgent, type EffectiveDefaultAgent } from '../lib/agent-launch-settings'
import { clearPreviewCache } from '../components/TerminalThumbnail'
import { externalTerminalTitle, legacyExternalCommand } from '../lib/external-terminal-title'
import { isDefaultTerminalTitle, towerTerminalTitle, type TerminalRoleChangeInfo } from '../lib/tower-terminal-title'
import { settingsStore } from './settings-store'

/**
 * T0535 (PLAN-041): whether this window closes `terminal` on `terminal:close-requested`. Every
 * window gets the event, and a window's store also holds the terminals of workspaces shown
 * elsewhere: a detached window closes only its own workspace's tabs, a main window only tabs of
 * workspaces that are not detached from it.
 */
export function ownsTerminalForCloseRequest(
  terminal: Pick<TerminalInstance, 'workspaceId'> | undefined,
  detachedWorkspaceId: string | null,
  detachedFromThisWindow: ReadonlySet<string>,
): boolean {
  if (!terminal) return false
  if (detachedWorkspaceId) return terminal.workspaceId === detachedWorkspaceId
  return !detachedFromThisWindow.has(terminal.workspaceId)
}

// Same grammar as main's `normalizeWorkorderId` (electron/close-worker.ts), which normalized the
// `workorder` a Worker tab carries (T0537).
const WORKORDER_ID_PATTERN = /^(?:[A-Z]{2,4}-)?T\d+$/
/** PLAN-041 / T0538: a report's message is kept for the badge tooltip and the batch close list. */
const WORKER_REPORT_MESSAGE_MAX = 200

/**
 * PLAN-041 / T0538: the Worker tabs a `terminal:notified` is a report from — the Workers of the
 * Tower `targetId` whose work order is `source` (ct-exec notifies with `--source "T####"`). The
 * source is trimmed and upper-cased like `--workorder`; anything else (a terminal id, no source)
 * matches nothing.
 */
export function findReportingWorkers(
  terminals: readonly Pick<TerminalInstance, 'id' | 'towerTerminalId' | 'workorder'>[],
  targetId: string,
  source: string | undefined,
): string[] {
  if (!targetId || typeof source !== 'string') return []
  const workorder = source.trim().toUpperCase()
  if (!WORKORDER_ID_PATTERN.test(workorder)) return []
  return terminals.filter(t => t.towerTerminalId === targetId && t.workorder === workorder).map(t => t.id)
}

/** PLAN-041 / T0538: the Worker tabs Tower `towerId` dispatched, in tab order. */
export function workersOfTower<T extends Pick<TerminalInstance, 'id' | 'towerTerminalId'>>(terminals: readonly T[], towerId: string): T[] {
  return terminals.filter(t => t.towerTerminalId === towerId && t.id !== towerId)
}

/**
 * PLAN-041 / T0538: what Tower `towerId`'s "Close reported Worker tabs (N)" closes — its Workers
 * among `terminals` that have reported. N = 0 disables the item.
 */
export function reportedWorkersOfTower<T extends Pick<TerminalInstance, 'id' | 'towerTerminalId' | 'workerReport'>>(terminals: readonly T[], towerId: string): T[] {
  return workersOfTower(terminals, towerId).filter(t => !!t.workerReport)
}

// ── Layout snapshot: collect/restore UI layout from localStorage ──
const LAYOUT_KEYS = {
  panel: 'better-terminal-panel-settings',
  split: 'better-terminal-split-settings',
  thumbnail: 'better-terminal-thumbnail-settings',
  docking: 'better-terminal-docking-config',
  workspaceTab: 'better-terminal-workspace-tab',
  rightPanelTab: 'bat-right-panel-tab',
} as const

interface LayoutSnapshot {
  sidebar?: { width: number; collapsed: boolean }
  rightPanel?: { width: number; collapsed: boolean; activeTab?: string }
  split?: { pinned: unknown; ratio: number }
  thumbnailBar?: { height: number; collapsed: boolean }
  docking?: Record<string, string>
  workspaceTab?: string
  maximized?: boolean
}

function collectLayoutSnapshot(): LayoutSnapshot {
  const layout: LayoutSnapshot = {}
  try {
    const panel = localStorage.getItem(LAYOUT_KEYS.panel)
    if (panel) {
      const p = JSON.parse(panel)
      layout.sidebar = p.sidebar
      layout.rightPanel = p.snippetSidebar
      layout.maximized = p.maximized
    }
    const split = localStorage.getItem(LAYOUT_KEYS.split)
    if (split) layout.split = JSON.parse(split)
    const thumb = localStorage.getItem(LAYOUT_KEYS.thumbnail)
    if (thumb) layout.thumbnailBar = JSON.parse(thumb)
    const dock = localStorage.getItem(LAYOUT_KEYS.docking)
    if (dock) layout.docking = JSON.parse(dock)
    const wsTab = localStorage.getItem(LAYOUT_KEYS.workspaceTab)
    if (wsTab) layout.workspaceTab = wsTab
    const rpTab = localStorage.getItem(LAYOUT_KEYS.rightPanelTab)
    if (rpTab && layout.rightPanel) layout.rightPanel.activeTab = rpTab
  } catch { /* ignore partial failures */ }
  return layout
}

function restoreLayoutSnapshot(layout: LayoutSnapshot): void {
  try {
    // Restore panel settings
    if (layout.sidebar || layout.rightPanel || layout.maximized !== undefined) {
      const panel = {
        sidebar: layout.sidebar ?? { width: 220, collapsed: false },
        snippetSidebar: layout.rightPanel
          ? { width: layout.rightPanel.width, collapsed: layout.rightPanel.collapsed }
          : { width: 280, collapsed: true },
        maximized: layout.maximized ?? false,
      }
      localStorage.setItem(LAYOUT_KEYS.panel, JSON.stringify(panel))
    }
    if (layout.split) {
      localStorage.setItem(LAYOUT_KEYS.split, JSON.stringify(layout.split))
    }
    if (layout.thumbnailBar) {
      localStorage.setItem(LAYOUT_KEYS.thumbnail, JSON.stringify(layout.thumbnailBar))
    }
    if (layout.docking) {
      localStorage.setItem(LAYOUT_KEYS.docking, JSON.stringify(layout.docking))
    }
    if (layout.workspaceTab) {
      localStorage.setItem(LAYOUT_KEYS.workspaceTab, layout.workspaceTab)
    }
    if (layout.rightPanel?.activeTab) {
      localStorage.setItem(LAYOUT_KEYS.rightPanelTab, layout.rightPanel.activeTab)
    }
  } catch { /* ignore */ }
}

/** A persisted terminal → store instance; null when its workspace is gone. */
function toTerminalInstance(t: Partial<TerminalInstance>, workspaceMap: Map<string, Workspace>): TerminalInstance | null {
  const ws = t.workspaceId ? workspaceMap.get(t.workspaceId) : undefined
  if (!ws?.folderPath) {
    window.electronAPI?.debug?.log?.(`[workspace-store] Warning: terminal ${t.id} has no valid workspace, skipping`)
    return null
  }
  const cwd = ws.folderPath
  const title = restoredTitle(t)
  // T0562: the saved BAT-generated title; a recomputed pre-T0553 title is BAT's as well
  const autoTitle = typeof t.autoTitle === 'string' && t.autoTitle
    ? t.autoTitle
    : (legacyExternalCommand(t.title) !== null ? autoTitleFor(title) : undefined)
  return {
    id: t.id || '',
    workspaceId: t.workspaceId || '',
    type: 'terminal' as const,
    agentPreset: t.agentPreset,
    title,
    ...(autoTitle ? { autoTitle } : {}),
    alias: t.alias,
    cwd,
    sdkSessionId: t.sdkSessionId,
    model: t.model,
    agentParams: normalizeAgentParams(t.agentPreset, t.agentParams),
    sessionMeta: t.sessionMeta,
    ...workerOwnership(t),
    ...(t.remoteOrigin === true ? { remoteOrigin: true } : {}),
    scrollbackBuffer: [],
    pid: undefined,
  }
}

/**
 * T0553: a saved tab's title. The pre-T0553 default title of a helper-created tab
 * (`Remote: <first word of the command>`) becomes the current default title; any other title —
 * one the user typed included — is kept as saved.
 */
function restoredTitle(t: Partial<TerminalInstance>): string {
  const legacyCommand = legacyExternalCommand(t.title)
  if (legacyCommand === null) return t.title || 'Terminal'
  return externalTerminalTitle({ command: legacyCommand, ...workerOwnership(t) })
}

/**
 * T0562: the `autoTitle` a BAT-generated title needs — only one `isDefaultTerminalTitle` cannot
 * recognize by itself (a command's file name such as `node`); undefined otherwise, so tabs keep
 * the fields they had.
 */
function autoTitleFor(title: string): string | undefined {
  return isDefaultTerminalTitle(title) ? undefined : title
}

/**
 * PLAN-041 / T0537: the saved Worker ownership of a tab (`towerTerminalId` / `workorder`), only
 * the string fields that are there — data saved before T0537 has none and stays without them.
 */
function workerOwnership(t: { towerTerminalId?: unknown; workorder?: unknown; workerReport?: unknown; ctWorktree?: unknown }): Pick<TerminalInstance, 'towerTerminalId' | 'workorder' | 'workerReport' | 'ctWorktree'> {
  const report = t.workerReport as { message?: unknown; reportedAt?: unknown } | null | undefined
  const ctWorktree = ctWorktreeInfo(t.ctWorktree)
  return {
    ...(typeof t.towerTerminalId === 'string' && t.towerTerminalId ? { towerTerminalId: t.towerTerminalId } : {}),
    ...(typeof t.workorder === 'string' && t.workorder ? { workorder: t.workorder } : {}),
    // T0538: the saved "reported" state of a Worker tab (data saved before T0538 has none)
    ...(report && typeof report === 'object' && typeof report.message === 'string' && typeof report.reportedAt === 'number' && Number.isFinite(report.reportedAt)
      ? { workerReport: { message: report.message.slice(0, WORKER_REPORT_MESSAGE_MAX), reportedAt: report.reportedAt } }
      : {}),
    // T0583: the worktree of an isolated Worker (main checks the location / branch rules before using it)
    ...(ctWorktree ? { ctWorktree } : {}),
  }
}

/** T0583: a `ctWorktree` as sent / saved → its string fields, or undefined. */
function ctWorktreeInfo(raw: unknown): CtWorktreeInfo | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const { path, branch, base, mainCheckout, workorder } = raw as Record<string, unknown>
  if (typeof path !== 'string' || !path || typeof branch !== 'string' || !branch || typeof base !== 'string' || !base) return undefined
  if (typeof mainCheckout !== 'string' || !mainCheckout || typeof workorder !== 'string' || !workorder) return undefined
  return { path, branch, base, mainCheckout, workorder }
}

const AUTO_SAVE_INTERVAL_MS = 30_000

type Listener = () => void

class WorkspaceStore {
  private state: AppState = {
    workspaces: [],
    activeWorkspaceId: null,
    terminals: [],
    activeTerminalId: null,
    focusedTerminalId: null
  }

  private activeGroup: string | null = null
  private windowId: string | null = null
  private listeners: Set<Listener> = new Set()
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null

  // Usage polling removed — OAuth API calls to Anthropic have been removed.
  // Stubs kept so consumers don't break.
  get claudeUsage() { return null }
  get usageAccount() { return null }
  getUsagePacing() { return null }
  startUsagePolling() { /* no-op */ }
  refreshUsageNow() { /* no-op */ }

  getState(): AppState {
    return this.state
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach(listener => listener())
  }

  // Workspace actions
  addWorkspace(name: string, folderPath: string): Workspace {
    const workspace: Workspace = {
      id: uuidv4(),
      name,
      folderPath,
      createdAt: Date.now()
    }

    this.state = {
      ...this.state,
      workspaces: [...this.state.workspaces, workspace],
      activeWorkspaceId: workspace.id
    }

    this.notify()
    return workspace
  }

  removeWorkspace(id: string): void {
    const terminals = this.state.terminals.filter(t => t.workspaceId !== id)
    const workspaces = this.state.workspaces.filter(w => w.id !== id)
    const activeWorkspaceId = this.state.activeWorkspaceId === id
      ? (workspaces[0]?.id ?? null)
      : this.state.activeWorkspaceId
    const focusKept = activeWorkspaceId === this.state.activeWorkspaceId
      && terminals.some(t => t.id === this.state.focusedTerminalId)

    // BUG-135 / T0532: like setActiveWorkspace, a new active workspace starts without focus
    // (WorkspaceView picks its default terminal); the focus never stays on a removed terminal.
    this.state = {
      ...this.state,
      workspaces,
      terminals,
      activeWorkspaceId,
      focusedTerminalId: focusKept ? this.state.focusedTerminalId : null
    }

    this.notify()
  }

  setActiveWorkspace(id: string): void {
    if (this.state.activeWorkspaceId === id) return

    this.state = {
      ...this.state,
      activeWorkspaceId: id,
      focusedTerminalId: null
    }

    this.notify()
  }

  renameWorkspace(id: string, alias: string): void {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w =>
        w.id === id ? { ...w, alias: alias.trim() || undefined } : w
      )
    }

    this.notify()
  }

  reorderWorkspaces(workspaceIds: string[]): void {
    const workspaceMap = new Map(this.state.workspaces.map(w => [w.id, w]))
    const reordered = workspaceIds
      .map(id => workspaceMap.get(id))
      .filter((w): w is Workspace => w !== undefined)

    this.state = {
      ...this.state,
      workspaces: reordered
    }

    this.notify()
    this.save()
  }

  // Workspace environment variables
  setWorkspaceEnvVars(id: string, envVars: import('../types').EnvVariable[]): void {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w =>
        w.id === id ? { ...w, envVars } : w
      )
    }
    this.notify()
    this.save()
  }

  // PLAN-040 / T0529: workspace default agent; undefined = follow the global Settings value.
  setWorkspaceDefaultAgent(id: string, agent: AgentPresetId | undefined): void {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w => {
        if (w.id !== id) return w
        const next = { ...w }
        if (agent) next.defaultAgent = agent
        else delete next.defaultAgent
        return next
      })
    }
    this.notify()
    this.save()
  }

  // T0529: per-preset launch args override. A string (empty included) replaces the global
  // args of that preset; undefined removes the override (follow Settings again).
  setWorkspaceAgentCustomArg(id: string, presetId: string, args: string | undefined): void {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w => {
        if (w.id !== id) return w
        const updated = { ...(w.agentCustomArgs || {}) }
        if (args === undefined) delete updated[presetId]
        else updated[presetId] = args
        const next = { ...w }
        if (Object.keys(updated).length > 0) next.agentCustomArgs = updated
        else delete next.agentCustomArgs
        return next
      })
    }
    this.notify()
    this.save()
  }

  // T0529: effective values read from the latest store state (not a render-time snapshot),
  // so callbacks memoized before a settings change still launch with the current values.
  getEffectiveDefaultAgent(workspaceId: string): EffectiveDefaultAgent {
    const workspace = this.state.workspaces.find(w => w.id === workspaceId)
    return resolveEffectiveDefaultAgent(workspace, settingsStore.getSettings())
  }

  getEffectiveAgentArgs(workspaceId: string, presetId: string): string {
    const workspace = this.state.workspaces.find(w => w.id === workspaceId)
    return resolveEffectiveAgentArgs(workspace, settingsStore.getSettings(), presetId).args
  }

  addWorkspaceEnvVar(id: string, envVar: import('../types').EnvVariable): void {
    const workspace = this.state.workspaces.find(w => w.id === id)
    if (!workspace) return
    const envVars = [...(workspace.envVars || []), envVar]
    this.setWorkspaceEnvVars(id, envVars)
  }

  removeWorkspaceEnvVar(id: string, key: string): void {
    const workspace = this.state.workspaces.find(w => w.id === id)
    if (!workspace) return
    const envVars = (workspace.envVars || []).filter(e => e.key !== key)
    this.setWorkspaceEnvVars(id, envVars)
  }

  updateWorkspaceEnvVar(id: string, key: string, updates: Partial<import('../types').EnvVariable>): void {
    const workspace = this.state.workspaces.find(w => w.id === id)
    if (!workspace) return
    const envVars = (workspace.envVars || []).map(e =>
      e.key === key ? { ...e, ...updates } : e
    )
    this.setWorkspaceEnvVars(id, envVars)
  }

  // SDK session persistence — per terminal
  setTerminalSdkSessionId(terminalId: string, sdkSessionId: string | undefined): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === terminalId ? { ...t, sdkSessionId } : t
      )
    }
    this.notify()
    this.save()
  }

  setTerminalWorktreeInfo(terminalId: string, worktreePath: string | undefined, worktreeBranch: string | undefined): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === terminalId ? { ...t, worktreePath, worktreeBranch } : t
      )
    }
    this.notify()
    this.save()
  }

  setTerminalSessionMeta(terminalId: string, meta: { totalCost: number; inputTokens: number; outputTokens: number; durationMs: number; numTurns: number; contextWindow: number; cacheReadTokens?: number; cacheCreationTokens?: number }): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === terminalId ? { ...t, sessionMeta: meta } : t
      )
    }
    // Don't notify — this is a background persistence update, no UI re-render needed
    this.save()
  }

  setTerminalPendingPrompt(terminalId: string, prompt: string, images?: string[]): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === terminalId ? { ...t, pendingPrompt: prompt, pendingImages: images } : t
      )
    }
    this.notify()
  }

  // Legacy: also store on workspace for backwards compatibility
  setLastSdkSessionId(workspaceId: string, sdkSessionId: string): void {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w =>
        w.id === workspaceId ? { ...w, lastSdkSessionId: sdkSessionId } : w
      )
    }
    this.notify()
    this.save()
  }

  // Terminal actions
  addTerminal(workspaceId: string, agentPreset?: AgentPresetId): TerminalInstance {
    const workspace = this.state.workspaces.find(w => w.id === workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    // Get agent preset info for title
    const preset = agentPreset ? getAgentPreset(agentPreset) : null
    const title = preset && preset.id !== 'none'
      ? preset.name
      : 'New Terminal'

    const terminal: TerminalInstance = {
      id: uuidv4(),
      workspaceId,
      type: 'terminal',
      agentPreset,
      title,
      cwd: workspace.folderPath,
      scrollbackBuffer: [],
      lastActivityTime: Date.now(),
      agentParams: normalizeAgentParams(agentPreset)
    }

    // Auto-focus if it's an agent terminal or no current focus
    const shouldFocus = (agentPreset && agentPreset !== 'none') || !this.state.focusedTerminalId

    this.state = {
      ...this.state,
      terminals: [...this.state.terminals, terminal],
      focusedTerminalId: shouldFocus ? terminal.id : this.state.focusedTerminalId
    }

    this.notify()
    return terminal
  }

  /** T0130: Add a terminal that was created externally (e.g. via RemoteServer WebSocket).
   *  The PTY already exists in main process with the given id — no pty.create() needed.
   *  T0137/BUG-031: Workspace allocation priority:
   *    1. explicit `workspaceId` (from `--workspace` CLI flag) if it matches a known workspace
   *    2. fallback to current active workspace
   *  cwd-based matching was removed because it caused PTYs to land in a parent-folder
   *  workspace rather than the user's currently-focused one.
   *  T0431: `remote: true` (stamped by RemoteClient on events from a server, see
   *  REMOTE_ORIGIN_EVENTS in electron/remote/path-aware-channels.ts) — step 2 does not
   *  apply: a remote event whose workspace is not in this window is ignored. Every BAT
   *  connected to the server gets the event; only the one holding the workspace adds it.
   *  T0523/BUG-129: before step 1, the workspace of `towerTerminalId` (`--notify-id`) when
   *  this window holds that terminal — the Tower shell's `BAT_WORKSPACE_ID` can be stale.
   *  T0537 (PLAN-041): `towerTerminalId` / `workorder` are kept on the tab and saved with it —
   *  the Worker ownership `--close-worker` looks up after BAT reopens.
   *  T0553: the title is `<agent> · Worker · <workorder>` for a Worker, else the agent or the
   *  command's file name (`externalTerminalTitle`); a tab a remote server created is marked
   *  `remoteOrigin` (thumbnail badge) instead of the old `Remote:` title prefix. */
  addExternalTerminal(info: { id: string; cwd: string; command?: string; agent?: string; agentName?: string; workspaceId?: string; towerTerminalId?: string; workorder?: string; ctWorktree?: CtWorktreeInfo; workspaceResolved?: boolean; remote?: boolean }): TerminalInstance | null {
    // Avoid duplicates — PTY already tracked
    if (this.state.terminals.some(t => t.id === info.id)) return null

    let workspace: Workspace | undefined
    const tower = info.towerTerminalId ? this.state.terminals.find(t => t.id === info.towerTerminalId) : undefined
    if (tower) {
      workspace = this.state.workspaces.find(w => w.id === tower.workspaceId)
      if (workspace && info.workspaceId && info.workspaceId !== workspace.id) {
        window.electronAPI?.debug?.log?.(
          `[T0523] External terminal follows its tower: tower=${tower.id} workspace=${workspace.id} requested=${info.workspaceId} terminal=${info.id}`
        )
      }
    }
    if (!workspace && info.workspaceId) {
      workspace = this.state.workspaces.find(w => w.id === info.workspaceId)
    }
    if (!workspace && info.remote) {
      window.electronAPI?.debug?.log?.(
        `[T0431] Remote external terminal ignored: workspace ${info.workspaceId ?? '(none)'} not in this window, terminal=${info.id}`
      )
      return null
    }
    // T0523: main found the workspace in the window registry, so another window holds it
    // (every window gets the event); falling back to this window's active workspace would
    // duplicate the tab in the wrong place.
    if (!workspace && info.workspaceResolved) {
      window.electronAPI?.debug?.log?.(
        `[T0523] External terminal ignored: workspace ${info.workspaceId ?? '(none)'} is in another window, tower=${info.towerTerminalId ?? 'n/a'} terminal=${info.id}`
      )
      return null
    }
    // T0361: 純觀測訊號 —— 帶了 workspaceId 卻查無時，原本會靜默 fallback 到 active
    // workspace，且與「完全沒帶」在 log 上無法區分（T0360 Part C）。這裡只發 warn，
    // 不驗證、不攔截、不改 fallback 語意。
    const workspaceMiss = Boolean(info.workspaceId) && !workspace
    if (!workspace) {
      workspace = this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId)
    }
    if (workspaceMiss) {
      window.electronAPI?.debug?.log?.(
        `[T0361] Workspace miss: requested=${info.workspaceId} landed=${workspace?.id ?? '(none)'} terminal=${info.id}`
      )
    }
    if (!workspace) return null

    const title = externalTerminalTitle({ ...info, ...workerOwnership(info) })
    const terminal: TerminalInstance = {
      id: info.id,
      workspaceId: workspace.id,
      type: 'terminal',
      title,
      // T0562: BAT's title, when only this tells (a command's file name)
      ...(autoTitleFor(title) ? { autoTitle: title } : {}),
      cwd: info.cwd,
      ...workerOwnership(info),
      ...(info.remote ? { remoteOrigin: true } : {}),
      scrollbackBuffer: [],
      lastActivityTime: Date.now()
    }

    // BUG-135 / T0532: a terminal that lands in a workspace the user is not looking at (T0523:
    // the tower's workspace) does not take the focus away from the active workspace.
    this.state = {
      ...this.state,
      terminals: [...this.state.terminals, terminal],
      focusedTerminalId: workspace.id === this.state.activeWorkspaceId ? terminal.id : this.state.focusedTerminalId
    }

    this.notify()
    return terminal
  }

  removeTerminal(id: string): void {
    clearPreviewCache(id)
    const removed = this.state.terminals.find(t => t.id === id)
    const terminals = this.state.terminals.filter(t => t.id !== id)

    // BUG-134 / T0531: the next focus stays in the removed terminal's workspace. Falling back to
    // the first terminal overall focused another workspace's terminal once a workspace's last
    // terminal was closed.
    this.state = {
      ...this.state,
      terminals,
      focusedTerminalId: this.state.focusedTerminalId === id
        ? (terminals.find(t => t.workspaceId === removed?.workspaceId)?.id ?? null)
        : this.state.focusedTerminalId
    }

    this.notify()
  }

  /**
   * T0535 (PLAN-041): close tab `id` the way ✕ does once it may close — stop its process (the
   * SDK session of an integrated agent, otherwise the PTY), clean its worktree when asked,
   * remove the tab, save. ✕ (WorkspaceView `handleCloseTerminal` / `handleConfirmClose`) and
   * main's `terminal:close-requested` (`--close-worker`: no confirm, never cleans a worktree)
   * both close through here.
   */
  closeTerminalNow(id: string, { cleanWorktree = false }: { cleanWorktree?: boolean } = {}): void {
    const terminal = this.state.terminals.find(t => t.id === id)
    if (terminal?.agentPreset && isIntegrated(terminal.agentPreset)) {
      window.electronAPI.claude.stopSession(id)
      if (cleanWorktree && (isWorktreeAgent(terminal.agentPreset) || !!terminal.worktreePath)) {
        window.electronAPI.claude.cleanupWorktree(id, true)
      }
    } else {
      window.electronAPI.pty.kill(id)
      if (cleanWorktree && terminal?.agentPreset === 'claude-cli-worktree') {
        window.electronAPI.worktree.remove(id, true)
      }
    }
    this.removeTerminal(id)
    this.save()
  }

  /**
   * PLAN-041 / T0538: a `terminal:notified` (every window gets it) — the Workers it is a report
   * from (`findReportingWorkers`) are marked reported with the latest message. Display only:
   * nothing is closed. Saves when a tab changed; returns the marked ids.
   */
  markWorkerReported(info: { targetId: string; source?: string; message: string }): string[] {
    const ids = findReportingWorkers(this.state.terminals, info.targetId, info.source)
    if (ids.length === 0) return ids
    const workerReport = { message: String(info.message ?? '').slice(0, WORKER_REPORT_MESSAGE_MAX), reportedAt: Date.now() }
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t => ids.includes(t.id) ? { ...t, workerReport } : t),
    }
    this.notify()
    this.save()
    return ids
  }

  switchTerminalApiVersion(id: string): 'claude-code' | 'claude-code-v2' | null {
    const terminal = this.state.terminals.find(t => t.id === id)
    if (!terminal) return null
    const newPreset = terminal.agentPreset === 'claude-code' ? 'claude-code-v2' as const : 'claude-code' as const
    const newTitle = newPreset === 'claude-code-v2' ? 'Claude Agent V2' : 'Claude Agent V1'
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, agentPreset: newPreset, title: t.alias || newTitle } : t
      )
    }
    this.notify()
    return newPreset
  }

  /** The user names tab `id` (MainPanel). T0562: the title is no longer BAT's (`autoTitle` cleared). */
  renameTerminal(id: string, title: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, title, autoTitle: undefined } : t
      )
    }

    this.notify()
  }

  /**
   * T0562: BAT titles tab `id` (a custom CLI's name, the remote tool install tab) — unlike
   * `renameTerminal`, the title stays BAT's, so `--set-role tower` may still replace it.
   */
  setAutoTitle(id: string, title: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, title, autoTitle: title } : t
      )
    }

    this.notify()
  }

  /**
   * T0562 / D147: `terminal:role-changed` (`bat-terminal.mjs --set-role tower`; every window gets
   * it — the caller checks this window holds the tab). The tab is titled `<agent> · Tower` when its
   * title is still BAT's (`isDefaultTerminalTitle`, an earlier Tower title included); a title the
   * user gave it is kept. Saves when the title changed.
   */
  applyTerminalRole(info: TerminalRoleChangeInfo): { result: 'applied' | 'unchanged' | 'kept' | 'not-found'; title?: string } {
    const terminal = this.state.terminals.find(t => t.id === info.id)
    if (!terminal || info.role !== 'tower') return { result: 'not-found' }
    if (!isDefaultTerminalTitle(terminal.title, { autoTitle: terminal.autoTitle, agentNames: [info.ptyAgentName, info.agentName] })) {
      return { result: 'kept', title: terminal.title }
    }
    const title = towerTerminalTitle({
      agentPreset: terminal.agentPreset,
      ptyAgent: info.ptyAgent,
      ptyAgentName: info.ptyAgentName,
      agent: info.agent,
      agentName: info.agentName,
    })
    if (title === terminal.title) return { result: 'unchanged', title }
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t => t.id === info.id ? { ...t, title, autoTitle: undefined } : t),
    }
    this.notify()
    this.save()
    return { result: 'applied', title }
  }

  setFocusedTerminal(id: string | null): void {
    if (this.state.focusedTerminalId === id) return

    this.state = {
      ...this.state,
      focusedTerminalId: id
    }

    this.notify()
  }

  updateTerminalCwd(id: string, cwd: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, cwd } : t
      )
    }

    this.notify()
  }

  updateTerminalModel(id: string, model: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, model } : t
      )
    }

    this.notify()
    this.save()
  }

  updateTerminalAgentParams(id: string, params: Record<string, string | number | boolean>): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? {
          ...t,
          agentParams: normalizeAgentParams(t.agentPreset, { ...(t.agentParams || {}), ...params }),
        } : t
      )
    }

    this.notify()
    this.save()
  }

  appendScrollback(id: string, data: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, scrollbackBuffer: [...t.scrollbackBuffer, data] } : t
      )
    }
    // Don't notify for scrollback updates to avoid re-renders
  }

  clearScrollback(id: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, scrollbackBuffer: [] } : t
      )
    }

    this.notify()
  }

  reorderTerminals(terminalIds: string[]): void {
    const terminalMap = new Map(this.state.terminals.map(t => [t.id, t]))
    const reordered = terminalIds
      .map(id => terminalMap.get(id))
      .filter((t): t is TerminalInstance => t !== undefined)

    // Append any terminals not in the provided list (e.g. from other workspaces)
    for (const t of this.state.terminals) {
      if (!terminalIds.includes(t.id)) {
        reordered.push(t)
      }
    }

    this.state = {
      ...this.state,
      terminals: reordered
    }

    this.notify()
    this.save()
  }

  // Get terminals for current workspace
  getWorkspaceTerminals(workspaceId: string): TerminalInstance[] {
    return this.state.terminals.filter(t => t.workspaceId === workspaceId)
  }

  // Get agent terminal for workspace (first agent terminal, regardless of type)
  getAgentTerminal(workspaceId: string): TerminalInstance | undefined {
    return this.state.terminals.find(
      t => t.workspaceId === workspaceId && t.agentPreset && t.agentPreset !== 'none'
    )
  }

  // Legacy compatibility - alias for getAgentTerminal
  getClaudeCodeTerminal(workspaceId: string): TerminalInstance | undefined {
    return this.getAgentTerminal(workspaceId)
  }

  getRegularTerminals(workspaceId: string): TerminalInstance[] {
    return this.state.terminals.filter(
      t => t.workspaceId === workspaceId && (!t.agentPreset || t.agentPreset === 'none')
    )
  }

  // Group management
  getActiveGroup(): string | null {
    return this.activeGroup
  }

  setActiveGroup(group: string | null): void {
    this.activeGroup = group

    // Auto-select first workspace in the group if current is not visible
    if (group) {
      const visibleWorkspaces = this.state.workspaces.filter(w => w.group === group)
      const currentVisible = visibleWorkspaces.some(w => w.id === this.state.activeWorkspaceId)
      if (!currentVisible && visibleWorkspaces.length > 0) {
        this.state = {
          ...this.state,
          activeWorkspaceId: visibleWorkspaces[0].id,
          focusedTerminalId: null
        }
      } else {
        // Force new reference so React re-renders the sidebar filter
        this.state = { ...this.state }
      }
    } else {
      this.state = { ...this.state }
    }

    this.notify()
    this.save()
  }

  setWorkspaceGroup(id: string, group: string | undefined): void {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w =>
        w.id === id ? { ...w, group } : w
      )
    }
    this.notify()
    this.save()
  }

  setWorkspaceColor(id: string, color: string | undefined): void {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w =>
        w.id === id ? { ...w, color } : w
      )
    }
    this.notify()
    this.save()
  }

  archiveWorkspace(id: string): void {
    // If archiving the active workspace, switch to the first non-archived one
    const nextActive = this.state.activeWorkspaceId === id
      ? this.state.workspaces.find(w => w.id !== id && !w.archived)?.id ?? null
      : this.state.activeWorkspaceId

    // BUG-135 / T0532: switching away from the archived workspace clears the focus, as
    // setActiveWorkspace does, instead of leaving it on the archived workspace's terminal.
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w =>
        w.id === id ? { ...w, archived: true } : w
      ),
      activeWorkspaceId: nextActive,
      focusedTerminalId: nextActive === this.state.activeWorkspaceId ? this.state.focusedTerminalId : null,
    }
    this.notify()
    this.save()
  }

  unarchiveWorkspace(id: string): void {
    this.state = {
      ...this.state,
      workspaces: this.state.workspaces.map(w =>
        w.id === id ? { ...w, archived: undefined } : w
      )
    }
    this.notify()
    this.save()
  }

  getActiveWorkspaces(): Workspace[] {
    return this.state.workspaces.filter(w => !w.archived)
  }

  getArchivedWorkspaces(): Workspace[] {
    return this.state.workspaces.filter(w => w.archived)
  }

  getGroups(): string[] {
    const groups = new Set<string>()
    for (const w of this.state.workspaces) {
      if (w.group) groups.add(w.group)
    }
    return Array.from(groups).sort()
  }

  // Activity tracking
  private lastActivityNotify: number = 0
  private _savePromise: Promise<void> = Promise.resolve()
  private _savePending = false

  updateTerminalActivity(id: string): void {
    const now = Date.now()
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, lastActivityTime: now } : t
      )
    }
    // Throttle notifications to avoid excessive re-renders (max once per 2s for activity)
    if (now - this.lastActivityNotify > 2000) {
      this.lastActivityNotify = now
      this.notify()
    }
  }

  setTerminalPendingAction(id: string, pending: boolean): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, hasPendingAction: pending } : t
      )
    }
    this.notify()
    this.updateDockBadge()
  }

  setTerminalAltBuffer(id: string, isAlt: boolean): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t =>
        t.id === id ? { ...t, isAltBuffer: isAlt } : t
      )
    }
    this.notify()
  }

  private updateDockBadge(): void {
    const settings = settingsStore.getSettings()
    if (settings.showDockBadge === false) return
    const count = this.state.terminals.filter(t => t.hasPendingAction).length
    window.electronAPI?.app?.setDockBadge?.(count)
  }

  getWorkspaceLastActivity(workspaceId: string): number | null {
    const terminals = this.getWorkspaceTerminals(workspaceId)
    const lastActivities = terminals
      .map(t => t.lastActivityTime)
      .filter((time): time is number => time !== undefined)

    return lastActivities.length > 0 ? Math.max(...lastActivities) : null
  }

  // Window identity for cross-window drag
  setWindowId(id: string): void { this.windowId = id }
  getWindowId(): string | null { return this.windowId }

  // Supervisor / Worker role management
  setSupervisor(terminalId: string, workspaceId: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t => {
        if (t.workspaceId !== workspaceId) return t
        if (t.id === terminalId) return { ...t, role: 'supervisor' as const }
        if (t.role === 'supervisor') return { ...t, role: 'worker' as const }
        return t
      })
    }
    this.notify()
    this.save()
  }

  clearSupervisor(workspaceId: string): void {
    this.state = {
      ...this.state,
      terminals: this.state.terminals.map(t => {
        if (t.workspaceId !== workspaceId && t.role === 'supervisor') return { ...t, role: undefined }
        return t
      })
    }
    this.notify()
    this.save()
  }

  getSupervisor(workspaceId: string): TerminalInstance | undefined {
    return this.state.terminals.find(t => t.workspaceId === workspaceId && t.role === 'supervisor')
  }

  getWorkers(workspaceId: string): TerminalInstance[] {
    return this.state.terminals.filter(t => t.workspaceId === workspaceId && t.role !== 'supervisor')
  }

  listenForReload(): () => void {
    const unsubReload = window.electronAPI.workspace.onReload((data?: string) => {
      if (data) {
        this.applySerializedData(data)
        this.save()
        return
      }
      this.load()
    })
    // T0491: a detached window of this window closed — show the terminals it left behind.
    const unsubReattached = window.electronAPI.workspace.onReattached((workspaceId: string) => {
      this.adoptDetachedWorkspaceTerminals(workspaceId).then((adoptedIds) => {
        const adopted = this.state.terminals.filter(t => adoptedIds.includes(t.id))
        // Terminals opened in the detached window already run; replay their output once mounted.
        for (const t of adopted) {
          if (!isIntegrated(t.agentPreset || '')) requestPtyReplay(t.id)
        }
      }).catch(e => {
        window.electronAPI?.debug?.log?.(`[workspace-store] adopt detached ${workspaceId} failed: ${e}`)
      })
    })
    return () => {
      unsubReload()
      unsubReattached()
    }
  }

  /**
   * T0491: replace `workspaceId`'s terminals with the list its detached window persisted
   * into this window's entry (main: `workspace:adopt-detached`). Runs in the save queue: a
   * save requested earlier is sent first (main still keeps the detached list for it), every
   * later save already carries the adopted list. Terminals this store already had keep their
   * runtime state. Returns the ids that are new to this window.
   */
  adoptDetachedWorkspaceTerminals(workspaceId: string): Promise<string[]> {
    const run = this._savePromise.then(async () => {
      const result = await window.electronAPI.workspace.adoptDetached(workspaceId)
      if (!result) return []
      return this.replaceWorkspaceTerminals(workspaceId, result.terminals as Partial<TerminalInstance>[])
    })
    this._savePromise = run.then(() => undefined, () => undefined)
    return run
  }

  private replaceWorkspaceTerminals(workspaceId: string, persisted: Partial<TerminalInstance>[]): string[] {
    const workspaceMap = new Map(this.state.workspaces.map(w => [w.id, w]))
    const current = new Map(this.state.terminals.map(t => [t.id, t]))
    const adoptedIds: string[] = []
    const incoming = persisted
      .filter(t => t.workspaceId === workspaceId)
      .map(t => {
        const restored = toTerminalInstance(t, workspaceMap)
        if (!restored) return null
        const existing = current.get(restored.id)
        if (!existing) {
          adoptedIds.push(restored.id)
          return restored
        }
        return {
          ...existing,
          agentPreset: restored.agentPreset,
          title: restored.title,
          autoTitle: restored.autoTitle,
          alias: restored.alias,
          sdkSessionId: restored.sdkSessionId,
          model: restored.model,
          agentParams: restored.agentParams,
          sessionMeta: restored.sessionMeta,
          // T0538: a report the detached window saw (this window got the same event)
          workerReport: restored.workerReport ?? existing.workerReport,
        }
      })
      .filter((t): t is TerminalInstance => t !== null)

    const removedIds = new Set(this.state.terminals.filter(t => t.workspaceId === workspaceId).map(t => t.id))
    for (const t of incoming) removedIds.delete(t.id)
    removedIds.forEach(id => clearPreviewCache(id))

    const at = this.state.terminals.findIndex(t => t.workspaceId === workspaceId)
    const rest = this.state.terminals.filter(t => t.workspaceId !== workspaceId)
    const terminals = at < 0 ? [...rest, ...incoming] : [...rest.slice(0, at), ...incoming, ...rest.slice(at)]
    const stillThere = (id: string | null) => id !== null && terminals.some(t => t.id === id)

    // BUG-135 / T0532: the fallback focus is a terminal of the active workspace, or null.
    // terminals[0] could be another workspace's terminal.
    this.state = {
      ...this.state,
      terminals,
      focusedTerminalId: stillThere(this.state.focusedTerminalId)
        ? this.state.focusedTerminalId
        : (terminals.find(t => t.workspaceId === this.state.activeWorkspaceId)?.id ?? null),
      activeTerminalId: stillThere(this.state.activeTerminalId) ? this.state.activeTerminalId : null,
    }
    this.notify()
    return adoptedIds
  }

  // Persistence — serialized to prevent concurrent writes from corrupting the file
  async save(): Promise<void> {
    // If a save is already queued, skip — the queued save will capture the latest state.
    // T0504: still hand back that save's promise, so a flush-save waits until it was sent.
    if (this._savePending) return this._savePromise
    this._savePending = true

    // Wait for any in-flight save to finish, then perform ours
    this._savePromise = this._savePromise.then(async () => {
      this._savePending = false
      const savedTerminals = this.state.terminals.map(t => ({
        id: t.id,
        workspaceId: t.workspaceId,
        type: t.type,
        agentPreset: t.agentPreset,
        title: t.title,
        alias: t.alias,
        cwd: t.cwd,
        sdkSessionId: t.sdkSessionId,
        model: t.model,
        agentParams: t.agentParams,
        sessionMeta: t.sessionMeta,
        towerTerminalId: t.towerTerminalId,
        workorder: t.workorder,
        workerReport: t.workerReport,
        ctWorktree: t.ctWorktree,
        remoteOrigin: t.remoteOrigin,
        autoTitle: t.autoTitle,
      }))
      const data = JSON.stringify({
        workspaces: this.state.workspaces,
        activeWorkspaceId: this.state.activeWorkspaceId,
        activeGroup: this.activeGroup,
        terminals: savedTerminals,
        activeTerminalId: this.state.activeTerminalId,
        layout: collectLayoutSnapshot(),
      })
      await window.electronAPI.workspace.save(data)
    }).catch(e => {
      console.error('Failed to save workspace data:', e)
    })

    return this._savePromise
  }

  async load(): Promise<void> {
    const data = await window.electronAPI.workspace.load()
    if (data) {
      this.applySerializedData(data)
    }

    // Start periodic auto-save (30s) after initial load
    this.startAutoSave()
  }

  private applySerializedData(data: string): void {
    try {
      const parsed = JSON.parse(data)
      const workspaces: Workspace[] = parsed.workspaces || []
      const workspaceMap = new Map(workspaces.map((w: Workspace) => [w.id, w]))
      const terminals: TerminalInstance[] = (parsed.terminals || [])
        .map((t: Partial<TerminalInstance>) => toTerminalInstance(t, workspaceMap))
        .filter((t: TerminalInstance | null): t is TerminalInstance => t !== null)
      const activeWorkspaceId: string | null = parsed.activeWorkspaceId || null
      // BUG-135 / T0532: a reload keeps the focus only on a terminal of the active workspace.
      const focusKept = terminals.some(t => t.id === this.state.focusedTerminalId && t.workspaceId === activeWorkspaceId)
      this.state = {
        ...this.state,
        workspaces,
        activeWorkspaceId,
        terminals,
        activeTerminalId: parsed.activeTerminalId || null,
        focusedTerminalId: focusKept ? this.state.focusedTerminalId : null,
      }
      this.activeGroup = parsed.activeGroup || null

      if (parsed.layout) {
        restoreLayoutSnapshot(parsed.layout)
      }

      this.notify()
    } catch (e) {
      window.electronAPI?.debug?.log?.(`Failed to parse workspace data: ${e}`)
      console.error('Failed to parse workspace data:', e)
    }
  }

  /** Start periodic auto-save to protect against crash data loss */
  startAutoSave(): void {
    if (this.autoSaveTimer) return
    this.autoSaveTimer = setInterval(() => {
      this.save().catch(e => {
        window.electronAPI?.debug?.log?.(`[workspace-store] Auto-save failed: ${e}`)
      })
    }, AUTO_SAVE_INTERVAL_MS)
  }

  /** Stop periodic auto-save (called on quit) */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
  }
}

export const workspaceStore = new WorkspaceStore()
