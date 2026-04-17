import { useEffect, useCallback, useState, useRef, lazy, Suspense } from 'react'
import { useMenuPosition } from '../hooks/useMenuPosition'
import { ErrorBoundary } from './ErrorBoundary'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Workspace, TerminalInstance, EnvVariable, DockablePanel, DockZone, ShellType } from '../types'
import { workspaceStore } from '../stores/workspace-store'
import { settingsStore } from '../stores/settings-store'
import { ThumbnailBar } from './ThumbnailBar'
import { CloseConfirmDialog } from './CloseConfirmDialog'
import { ResizeHandle } from './ResizeHandle'
import { WorkerPanel } from './WorkerPanel'
import { AgentPresetId, getAgentPreset } from '../types/agent-presets'
import { isClaudeSdk, isClaudeCli, isWorktreeAgent } from '../types/agent-runtime'
import type { AgentDefinition } from '../types/agent-runtime'

// Lazy load heavy components (xterm.js, Claude SDK, etc.)
const MainPanel = lazy(() => import('./MainPanel').then(m => ({ default: m.MainPanel })))
const FileTree = lazy(() => import('./FileTree').then(m => ({ default: m.FileTree })))
const GitPanel = lazy(() => import('./GitPanel').then(m => ({ default: m.GitPanel })))
const GitGraphPanel = lazy(() => import('./git-panel/GitGraphPanel').then(m => ({ default: m.GitGraphPanel })))
const GitHubPanel = lazy(() => import('./GitHubPanel').then(m => ({ default: m.GitHubPanel })))
const SnippetSidebar = lazy(() => import('./SnippetPanel').then(m => ({ default: m.SnippetSidebar })))
const SkillsPanel = lazy(() => import('./SkillsPanel').then(m => ({ default: m.SkillsPanel })))
const AgentsPanel = lazy(() => import('./AgentsPanel').then(m => ({ default: m.AgentsPanel })))
const ControlTowerPanel = lazy(() => import('./ControlTowerPanel').then(m => ({ default: m.ControlTowerPanel })))

type WorkspaceTab = 'terminal' | 'files' | 'git' | 'git-graph' | 'github' | 'snippets' | 'skills' | 'agents' | 'control-tower'
const TAB_KEY = 'better-terminal-workspace-tab'

function loadWorkspaceTab(): WorkspaceTab {
  try {
    const saved = localStorage.getItem(TAB_KEY)
    if (saved === 'terminal' || saved === 'files' || saved === 'git' || saved === 'git-graph' || saved === 'github' || saved === 'snippets' || saved === 'skills' || saved === 'agents' || saved === 'control-tower') return saved
  } catch { /* ignore */ }
  return 'terminal'
}

// ThumbnailBar panel settings
const THUMBNAIL_SETTINGS_KEY = 'better-terminal-thumbnail-settings'
const DEFAULT_THUMBNAIL_HEIGHT = 180
const MIN_THUMBNAIL_HEIGHT = 80
const MAX_THUMBNAIL_HEIGHT = 400

interface ThumbnailSettings {
  height: number
  collapsed: boolean
}

function loadThumbnailSettings(): ThumbnailSettings {
  try {
    const saved = localStorage.getItem(THUMBNAIL_SETTINGS_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error('Failed to load thumbnail settings:', e)
  }
  return { height: DEFAULT_THUMBNAIL_HEIGHT, collapsed: false }
}

function saveThumbnailSettings(settings: ThumbnailSettings): void {
  try {
    localStorage.setItem(THUMBNAIL_SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save thumbnail settings:', e)
  }
}

// Split view settings
const SPLIT_SETTINGS_KEY = 'better-terminal-split-settings'
const DEFAULT_SPLIT_RATIO = 0.5
const MIN_SPLIT_RATIO = 0.2
const MAX_SPLIT_RATIO = 0.8

type PinnedContentType = 'terminal' | 'files' | 'git' | 'git-graph' | 'github' | 'snippets' | 'skills' | 'agents'

interface PinnedPane {
  type: PinnedContentType
  terminalId?: string  // only when type === 'terminal'
  side: 'left' | 'right'
}

interface SplitSettings {
  pinned: PinnedPane | null
  ratio: number
}

function loadSplitSettings(): SplitSettings {
  try {
    const saved = localStorage.getItem(SPLIT_SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Migration from old format (terminalId-based)
      if ('terminalId' in parsed && !('pinned' in parsed)) {
        const pinned: PinnedPane | null = parsed.terminalId
          ? { type: 'terminal', terminalId: parsed.terminalId, side: 'right' }
          : null
        return { pinned, ratio: parsed.ratio ?? DEFAULT_SPLIT_RATIO }
      }
      return { pinned: parsed.pinned ?? null, ratio: parsed.ratio ?? DEFAULT_SPLIT_RATIO }
    }
  } catch { /* ignore */ }
  return { pinned: null, ratio: DEFAULT_SPLIT_RATIO }
}

function saveSplitSettings(settings: SplitSettings): void {
  try {
    localStorage.setItem(SPLIT_SETTINGS_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

interface WorkspaceViewProps {
  workspace: Workspace
  terminals: TerminalInstance[]
  focusedTerminalId: string | null
  isActive: boolean
  isMaximized?: boolean
  onMaximizeToggle?: () => void
  dockedPanels?: DockablePanel[]
  onDockPanel?: (panel: DockablePanel, zone: DockZone) => void
}

// Helper to get shell path from settings
async function getShellFromSettings(): Promise<string | undefined> {
  const settings = settingsStore.getSettings()
  if (settings.shell === 'custom' && settings.customShellPath) {
    return settings.customShellPath
  }
  return window.electronAPI.settings.getShellPath(settings.shell)
}

// Helper to merge environment variables
function mergeEnvVars(global: EnvVariable[] = [], workspace: EnvVariable[] = []): Record<string, string> {
  const result: Record<string, string> = {}
  // Add global vars first
  for (const env of global) {
    if (env.enabled && env.key) {
      result[env.key] = env.value
    }
  }
  // Workspace vars override global
  for (const env of workspace) {
    if (env.enabled && env.key) {
      result[env.key] = env.value
    }
  }
  return result
}

// Track which workspaces have been initialized (outside component to persist across renders)
const initializedWorkspaces = new Set<string>()

// Allow clearing on profile switch so terminals re-initialize
export function clearInitializedWorkspaces(): void {
  initializedWorkspaces.clear()
}

export function WorkspaceView({ workspace, terminals, focusedTerminalId, isActive, isMaximized, onMaximizeToggle, dockedPanels, onDockPanel }: Readonly<WorkspaceViewProps>) {
  const { t } = useTranslation()
  const [showCloseConfirm, setShowCloseConfirm] = useState<string | null>(null)
  const [thumbnailSettings, setThumbnailSettings] = useState<ThumbnailSettings>(loadThumbnailSettings)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(loadWorkspaceTab)
  const [hasGithubRemote, setHasGithubRemote] = useState(false)
  const [isGitRepo, setIsGitRepo] = useState(false)
  const [agentDefinitions, setAgentDefinitions] = useState<AgentDefinition[]>([])
  const [splitSettings, setSplitSettings] = useState<SplitSettings>(loadSplitSettings)
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tab: PinnedContentType } | null>(null)
  const { pos: tabCtxPos, menuRef: tabCtxRef } = useMenuPosition(tabCtxMenu)

  // Track which tabs have been visited — lazy mount to preserve state via CSS hidden
  const [mountedTabs, setMountedTabs] = useState<Set<WorkspaceTab>>(() => new Set([loadWorkspaceTab()]))

  // Fetch agent definitions from the registry
  useEffect(() => {
    window.electronAPI.agent?.listDefinitions().then((defs: AgentDefinition[]) => {
      const isDebug = window.electronAPI?.debug?.isDebugMode
      // Filter out 'none' and debug-only items (unless in debug mode)
      const visible = defs.filter((d: AgentDefinition) => d.id !== 'none' && (!d.debug || isDebug))
      setAgentDefinitions(visible)
    }).catch(() => {
      // Registry not available, UI will use legacy callbacks
    })
  }, [])

  // Detect git repo and GitHub remote
  useEffect(() => {
    window.electronAPI.git.getGithubUrl(workspace.folderPath).then(url => {
      setHasGithubRemote(!!url)
    }).catch(() => setHasGithubRemote(false))
    window.electronAPI.git.getRoot(workspace.folderPath).then(root => {
      setIsGitRepo(!!root)
    }).catch(() => setIsGitRepo(false))
  }, [workspace.folderPath])

  // Fallback if saved tab is 'github' but no GitHub remote
  useEffect(() => {
    if (activeTab === 'github' && !hasGithubRemote) {
      setActiveTab('terminal')
      try { localStorage.setItem(TAB_KEY, 'terminal') } catch { /* ignore */ }
    }
  }, [hasGithubRemote, activeTab])

  // Auto-correct active tab if docked panel is moved away from main zone
  useEffect(() => {
    if (activeTab !== 'terminal' && dockedPanels && !dockedPanels.includes(activeTab as DockablePanel)) {
      setActiveTab('terminal')
      try { localStorage.setItem(TAB_KEY, 'terminal') } catch { /* ignore */ }
    }
  }, [dockedPanels, activeTab])

  const handleTabChange = useCallback((tab: WorkspaceTab) => {
    setActiveTab(tab)
    setMountedTabs(prev => prev.has(tab) ? prev : new Set([...prev, tab]))
    try { localStorage.setItem(TAB_KEY, tab) } catch { /* ignore */ }
  }, [])

  // Listen for keyboard shortcut events to cycle/switch tabs
  useEffect(() => {
    if (!isActive) return

    const TABS: WorkspaceTab[] = dockedPanels
      ? ['terminal', ...dockedPanels.filter(p => p !== 'github' || hasGithubRemote)] as WorkspaceTab[]
      : hasGithubRemote
        ? ['terminal', 'files', 'git', 'github', 'snippets', 'skills', 'agents', 'control-tower']
        : ['terminal', 'files', 'git', 'snippets', 'skills', 'agents', 'control-tower']

    const handleCycleTab = (e: Event) => {
      const { direction } = (e as CustomEvent).detail as { direction: number }
      setActiveTab(prev => {
        const idx = TABS.indexOf(prev)
        const next = TABS[(idx + direction + TABS.length) % TABS.length]
        setMountedTabs(mt => mt.has(next) ? mt : new Set([...mt, next]))
        try { localStorage.setItem(TAB_KEY, next) } catch { /* ignore */ }
        return next
      })
    }

    const handleSwitchTab = (e: Event) => {
      const { tab } = (e as CustomEvent).detail as { tab: WorkspaceTab }
      setActiveTab(tab)
      setMountedTabs(mt => mt.has(tab) ? mt : new Set([...mt, tab]))
      try { localStorage.setItem(TAB_KEY, tab) } catch { /* ignore */ }
    }

    window.addEventListener('workspace-cycle-tab', handleCycleTab)
    window.addEventListener('workspace-switch-tab', handleSwitchTab)
    return () => {
      window.removeEventListener('workspace-cycle-tab', handleCycleTab)
      window.removeEventListener('workspace-switch-tab', handleSwitchTab)
    }
  }, [isActive, hasGithubRemote])

  // Handle thumbnail bar resize
  const handleThumbnailResize = useCallback((delta: number) => {
    setThumbnailSettings(prev => {
      // Note: delta is negative when dragging up (making bar taller)
      const newHeight = Math.min(MAX_THUMBNAIL_HEIGHT, Math.max(MIN_THUMBNAIL_HEIGHT, prev.height - delta))
      const updated = { ...prev, height: newHeight }
      saveThumbnailSettings(updated)
      return updated
    })
  }, [])

  // Toggle thumbnail bar collapse
  const handleThumbnailCollapse = useCallback(() => {
    setThumbnailSettings(prev => {
      const updated = { ...prev, collapsed: !prev.collapsed }
      saveThumbnailSettings(updated)
      return updated
    })
    // Trigger resize so terminals/xterm can refit after layout change
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
  }, [])

  // Reset thumbnail bar to default height
  const handleThumbnailResetHeight = useCallback(() => {
    setThumbnailSettings(prev => {
      const updated = { ...prev, height: DEFAULT_THUMBNAIL_HEIGHT }
      saveThumbnailSettings(updated)
      return updated
    })
  }, [])

  // Track pre-maximize thumbnail collapsed state for restore
  const preMaximizeThumbnailCollapsed = useRef<boolean | null>(null)

  // Listen for maximize-toggle to collapse/restore thumbnail bar
  useEffect(() => {
    if (!isActive) return
    const handler = (e: Event) => {
      const maximized = (e as CustomEvent).detail?.maximized
      setThumbnailSettings(prev => {
        let updated: ThumbnailSettings
        if (maximized) {
          // Save current state before collapsing
          preMaximizeThumbnailCollapsed.current = prev.collapsed
          updated = { ...prev, collapsed: true }
        } else {
          // Restore pre-maximize state
          const wasCollapsed = preMaximizeThumbnailCollapsed.current
          preMaximizeThumbnailCollapsed.current = null
          updated = { ...prev, collapsed: wasCollapsed ?? false }
        }
        saveThumbnailSettings(updated)
        return updated
      })
    }
    window.addEventListener('maximize-toggle', handler)
    return () => window.removeEventListener('maximize-toggle', handler)
  }, [isActive])

  // Tab context menu (for pin left/right)
  useEffect(() => {
    if (!tabCtxMenu) return
    const close = () => setTabCtxMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [tabCtxMenu])

  const handleTabContextMenu = useCallback((e: React.MouseEvent, tab: PinnedContentType) => {
    e.preventDefault()
    e.stopPropagation()
    setTabCtxMenu({ x: e.clientX, y: e.clientY, tab })
  }, [])

  // Split view handlers
  const handleSplitTerminal = useCallback((terminalId: string, side: 'left' | 'right' = 'right') => {
    setSplitSettings(prev => {
      // If already pinned with this terminal on same side, unsplit
      const updated: SplitSettings = (prev.pinned?.type === 'terminal' && prev.pinned?.terminalId === terminalId)
        ? { ...prev, pinned: null }
        : { ...prev, pinned: { type: 'terminal', terminalId, side } }
      saveSplitSettings(updated)
      return updated
    })
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  const handlePinTab = useCallback((tab: PinnedContentType, side: 'left' | 'right') => {
    setSplitSettings(prev => {
      // If already pinned with same tab, unsplit
      const updated: SplitSettings = (prev.pinned?.type === tab && prev.pinned?.side === side)
        ? { ...prev, pinned: null }
        : { ...prev, pinned: { type: tab, side } }
      saveSplitSettings(updated)
      return updated
    })
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  const handleUnsplit = useCallback(() => {
    setSplitSettings(prev => {
      const updated: SplitSettings = { ...prev, pinned: null }
      saveSplitSettings(updated)
      return updated
    })
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  const handleSplitResize = useCallback((delta: number) => {
    setSplitSettings(prev => {
      const container = document.querySelector('.split-container')
      if (!container) return prev
      const containerWidth = container.clientWidth
      const ratioDelta = delta / containerWidth
      const newRatio = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, prev.ratio + ratioDelta))
      const updated: SplitSettings = { ...prev, ratio: newRatio }
      saveSplitSettings(updated)
      return updated
    })
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  const handleSplitResetRatio = useCallback(() => {
    setSplitSettings(prev => {
      const updated: SplitSettings = { ...prev, ratio: DEFAULT_SPLIT_RATIO }
      saveSplitSettings(updated)
      return updated
    })
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  // Clear split if the pinned terminal was removed
  useEffect(() => {
    if (splitSettings.pinned?.type === 'terminal' && splitSettings.pinned.terminalId
        && !terminals.find(t => t.id === splitSettings.pinned!.terminalId)) {
      handleUnsplit()
    }
  }, [terminals, splitSettings.pinned, handleUnsplit])

  // Clear split if pinned tab is no longer docked to main zone
  useEffect(() => {
    if (splitSettings.pinned && splitSettings.pinned.type !== 'terminal' && dockedPanels
        && !dockedPanels.includes(splitSettings.pinned.type as DockablePanel)) {
      handleUnsplit()
    }
  }, [dockedPanels, splitSettings.pinned, handleUnsplit])

  // Categorize terminals
  const agentTerminal = terminals.find(t => t.agentPreset && t.agentPreset !== 'none')
  const regularTerminals = terminals.filter(t => !t.agentPreset || t.agentPreset === 'none')
  const focusedTerminal = terminals.find(t => t.id === focusedTerminalId)
  const isAgentFocused = focusedTerminal?.agentPreset && focusedTerminal.agentPreset !== 'none'

  // Initialize terminals when workspace becomes active
  // If terminals were restored from a saved profile, start their PTY/agent processes
  // If no terminals exist, create default ones from settings
  useEffect(() => {
    if (!isActive || initializedWorkspaces.has(workspace.id)) return
    initializedWorkspaces.add(workspace.id)

    const initTerminals = async () => {
      const dlog = (...args: unknown[]) => window.electronAPI?.debug?.log(...args)
      const htmlT0 = (window as unknown as { __t0?: number }).__t0 || Date.now()
      dlog(`[startup] initTerminals start: +${Date.now() - htmlT0}ms from HTML`)
      const t0 = performance.now()
      const settings = settingsStore.getSettings()
      const shell = await getShellFromSettings()
      dlog(`[init] getShellFromSettings: ${(performance.now() - t0).toFixed(0)}ms`)
      const customEnv = mergeEnvVars(settings.globalEnvVars, workspace.envVars)

      if (terminals.length > 0) {
        // Restored terminals: start PTY processes for non-integrated terminals
        // Integrated agent terminals (Claude SDK) will be started by ClaudeAgentPanel on mount
        for (const terminal of terminals) {
          if (isClaudeSdk(terminal.agentPreset || '')) continue
          // claude-cli presets use startClaudeCliPty for bundled CLI + env setup
          if (isClaudeCli(terminal.agentPreset || '')) {
            startClaudeCliPty(terminal.id, terminal.cwd || workspace.folderPath, isWorktreeAgent(terminal.agentPreset || ''))
            continue
          }
          window.electronAPI.pty.create({
            id: terminal.id,
            cwd: terminal.cwd || workspace.folderPath,
            type: 'terminal',
            agentPreset: terminal.agentPreset,
            shell,
            customEnv
          })
          // Auto-run agent command for non-Claude terminal-driven agents
          if (terminal.agentPreset && terminal.agentPreset !== 'none') {
            const extraArgs = settingsStore.getAgentCustomArgs(terminal.agentPreset)
            const appendArgs = (base: string) => extraArgs ? `${base} ${extraArgs}` : base
            window.electronAPI.agent?.buildLaunchCommand(terminal.agentPreset).then((cmd: string | null) => {
              if (cmd) {
                setTimeout(() => {
                  window.electronAPI.pty.write(terminal.id, appendArgs(cmd) + '\r')
                }, 500)
              } else if (settings.agentAutoCommand) {
                const preset = getAgentPreset(terminal.agentPreset!)
                if (preset?.command) {
                  setTimeout(() => {
                    window.electronAPI.pty.write(terminal.id, appendArgs(preset.command) + '\r')
                  }, 500)
                }
              }
            }).catch(() => {
              if (settings.agentAutoCommand) {
                const preset = getAgentPreset(terminal.agentPreset!)
                if (preset?.command) {
                  setTimeout(() => {
                    window.electronAPI.pty.write(terminal.id, appendArgs(preset.command) + '\r')
                  }, 500)
                }
              }
            })
          }
        }
      } else {
        // No terminals: create defaults from settings
        const terminalCount = settings.defaultTerminalCount || 1
        const createAgentTerminal = settings.createDefaultAgentTerminal === true
        const defaultAgent = createAgentTerminal
          ? (workspace.defaultAgent || settings.defaultAgent || 'claude')
          : 'none'

        if (createAgentTerminal) {
          const agentTerminal = workspaceStore.addTerminal(workspace.id, defaultAgent as AgentPresetId)
          if (isClaudeCli(defaultAgent)) {
            startClaudeCliPty(agentTerminal.id, workspace.folderPath, isWorktreeAgent(defaultAgent))
          } else if (!isClaudeSdk(defaultAgent)) {
            window.electronAPI.pty.create({
              id: agentTerminal.id,
              cwd: workspace.folderPath,
              type: 'terminal',
              agentPreset: defaultAgent as AgentPresetId,
              shell,
              customEnv
            })
            if (settings.agentAutoCommand) {
              const defExtraArgs = settingsStore.getAgentCustomArgs(defaultAgent)
              const defAppendArgs = (base: string) => defExtraArgs ? `${base} ${defExtraArgs}` : base
              window.electronAPI.agent?.buildLaunchCommand(defaultAgent).then((cmd: string | null) => {
                if (cmd) {
                  setTimeout(() => {
                    window.electronAPI.pty.write(agentTerminal.id, defAppendArgs(cmd) + '\r')
                  }, 500)
                } else {
                  const preset = getAgentPreset(defaultAgent)
                  if (preset?.command) {
                    setTimeout(() => {
                      window.electronAPI.pty.write(agentTerminal.id, defAppendArgs(preset.command) + '\r')
                    }, 500)
                  }
                }
              }).catch(() => {
                const preset = getAgentPreset(defaultAgent)
                if (preset?.command) {
                  setTimeout(() => {
                    window.electronAPI.pty.write(agentTerminal.id, defAppendArgs(preset.command) + '\r')
                  }, 500)
                }
              })
            }
          }
        }

        for (let i = 0; i < terminalCount; i++) {
          const terminal = workspaceStore.addTerminal(workspace.id)
          window.electronAPI.pty.create({
            id: terminal.id,
            cwd: workspace.folderPath,
            type: 'terminal',
            shell,
            customEnv
          })
        }
        // Persist newly created default terminals
        workspaceStore.save()
      }
      dlog(`[init] initTerminals total: ${(performance.now() - t0).toFixed(0)}ms, terminals=${terminals.length}`)
      dlog(`[startup] initTerminals done: +${Date.now() - htmlT0}ms from HTML`)
    }
    initTerminals()
  }, [isActive, workspace.id, terminals.length, workspace.defaultAgent, workspace.folderPath, workspace.envVars])

  // Set default focus - only for active workspace
  useEffect(() => {
    if (isActive && !focusedTerminalId && terminals.length > 0) {
      // Focus the first terminal (agent or regular)
      const firstTerminal = agentTerminal || terminals[0]
      if (firstTerminal) {
        workspaceStore.setFocusedTerminal(firstTerminal.id)
      }
    }
  }, [isActive, focusedTerminalId, terminals, agentTerminal])

  const handleAddTerminal = useCallback(async () => {
    const terminal = workspaceStore.addTerminal(workspace.id)
    const shell = await getShellFromSettings()
    const settings = settingsStore.getSettings()
    const customEnv = mergeEnvVars(settings.globalEnvVars, workspace.envVars)
    window.electronAPI.pty.create({
      id: terminal.id,
      cwd: workspace.folderPath,
      type: 'terminal',
      shell,
      customEnv
    })
    // Focus the new terminal
    workspaceStore.setFocusedTerminal(terminal.id)
    workspaceStore.save()
  }, [workspace.id, workspace.folderPath, workspace.envVars])

  const handleAddTerminalWithShell = useCallback(async (shellType: ShellType) => {
    const terminal = workspaceStore.addTerminal(workspace.id)
    const settings = settingsStore.getSettings()
    const shell = await window.electronAPI.settings.getShellPath(shellType)
    const customEnv = mergeEnvVars(settings.globalEnvVars, workspace.envVars)
    window.electronAPI.pty.create({
      id: terminal.id,
      cwd: workspace.folderPath,
      type: 'terminal',
      shell,
      customEnv
    })
    workspaceStore.setFocusedTerminal(terminal.id)
    workspaceStore.save()
  }, [workspace.id, workspace.folderPath, workspace.envVars])

  // Execute a Control Tower work order in a new terminal
  const handleExecWorkOrder = useCallback(async (workOrderId: string) => {
    const terminal = workspaceStore.addTerminal(workspace.id)
    const ctArgs = settingsStore.getAgentCustomArgs('claude-cli')
    const command = `claude "/ct-exec ${workOrderId}"${ctArgs ? ` ${ctArgs}` : ''}`
    const settings = settingsStore.getSettings()
    const customEnv = mergeEnvVars(settings.globalEnvVars, workspace.envVars)
    await window.electronAPI.pty.createWithCommand({
      id: terminal.id,
      cwd: workspace.folderPath,
      command,
      customEnv,
    })
    workspaceStore.setFocusedTerminal(terminal.id)
    setActiveTab('terminal')
    try { localStorage.setItem(TAB_KEY, 'terminal') } catch { /* ignore */ }
    workspaceStore.save()
  }, [workspace.id, workspace.folderPath, workspace.envVars])

  // Remedial close a Control Tower work order (ct-done) in a new terminal
  const handleDoneWorkOrder = useCallback(async (workOrderId: string) => {
    const terminal = workspaceStore.addTerminal(workspace.id)
    const ctArgs = settingsStore.getAgentCustomArgs('claude-cli')
    const command = `claude "/ct-done ${workOrderId}"${ctArgs ? ` ${ctArgs}` : ''}`
    const settings = settingsStore.getSettings()
    const customEnv = mergeEnvVars(settings.globalEnvVars, workspace.envVars)
    await window.electronAPI.pty.createWithCommand({
      id: terminal.id,
      cwd: workspace.folderPath,
      command,
      customEnv,
    })
    workspaceStore.setFocusedTerminal(terminal.id)
    setActiveTab('terminal')
    try { localStorage.setItem(TAB_KEY, 'terminal') } catch { /* ignore */ }
    workspaceStore.save()
  }, [workspace.id, workspace.folderPath, workspace.envVars])

  const handleAddClaudeAgent = useCallback(() => {
    const agentTerminal = workspaceStore.addTerminal(workspace.id, 'claude-code' as AgentPresetId)
    // Claude Agent SDK session will be started by ClaudeAgentPanel on mount
    workspaceStore.setFocusedTerminal(agentTerminal.id)
    workspaceStore.save()
  }, [workspace.id])

  const handleAddClaudeAgentV2 = useCallback(() => {
    const agentTerminal = workspaceStore.addTerminal(workspace.id, 'claude-code-v2' as AgentPresetId)
    workspaceStore.setFocusedTerminal(agentTerminal.id)
    workspaceStore.save()
  }, [workspace.id])

  const handleAddClaudeWorktree = useCallback(() => {
    const agentTerminal = workspaceStore.addTerminal(workspace.id, 'claude-code-worktree' as AgentPresetId)
    workspaceStore.setFocusedTerminal(agentTerminal.id)
    workspaceStore.save()
  }, [workspace.id])

  /** Create a claude-cli PTY terminal with bundled CLI, CLAUDE_CODE_NO_FLICKER, and optional worktree */
  const startClaudeCliPty = useCallback(async (terminalId: string, cwd: string, isWorktree: boolean) => {
    const settings = settingsStore.getSettings()
    const shell = await getShellFromSettings()
    const customEnv = mergeEnvVars(settings.globalEnvVars, workspace.envVars)
    const cliPath = await window.electronAPI.claude.getCliPath()

    // Set up worktree if needed
    let effectiveCwd = cwd
    if (isWorktree) {
      const wtResult = await window.electronAPI.worktree.create(terminalId, cwd)
      if (wtResult.success && wtResult.worktreePath) {
        effectiveCwd = wtResult.worktreePath
        workspaceStore.setTerminalWorktreeInfo(terminalId, wtResult.worktreePath, wtResult.branchName)
      }
    }

    window.electronAPI.pty.create({
      id: terminalId,
      cwd: effectiveCwd,
      type: 'terminal',
      agentPreset: isWorktree ? 'claude-cli-worktree' as AgentPresetId : 'claude-cli' as AgentPresetId,
      shell,
      customEnv: {
        ...customEnv,
        CLAUDE_CODE_NO_FLICKER: '1',
      }
    })

    // Build CLI command using bundled CLI
    // Worktree sessions start fresh (--continue would resume a session in git root)
    const cmdParts = ['node', `"${cliPath}"`]
    if (!isWorktree) {
      cmdParts.push('--continue')
    }
    if (settings.allowBypassPermissions) {
      cmdParts.push('--dangerously-skip-permissions')
    }
    const presetId = isWorktree ? 'claude-cli-worktree' : 'claude-cli'
    const customArgs = settingsStore.getAgentCustomArgs(presetId)
    if (customArgs) {
      cmdParts.push(customArgs)
    }
    const cmd = cmdParts.join(' ')

    setTimeout(() => {
      window.electronAPI.pty.write(terminalId, cmd + '\r')
    }, 500)
  }, [workspace.folderPath, workspace.envVars])

  const handleAddClaudeCli = useCallback(async () => {
    const terminal = workspaceStore.addTerminal(workspace.id, 'claude-cli' as AgentPresetId)
    workspaceStore.setFocusedTerminal(terminal.id)
    workspaceStore.save()
    await startClaudeCliPty(terminal.id, workspace.folderPath, false)
  }, [workspace.id, workspace.folderPath, startClaudeCliPty])

  const handleAddClaudeCliWorktree = useCallback(async () => {
    const terminal = workspaceStore.addTerminal(workspace.id, 'claude-cli-worktree' as AgentPresetId)
    workspaceStore.setFocusedTerminal(terminal.id)
    workspaceStore.save()
    await startClaudeCliPty(terminal.id, workspace.folderPath, true)
  }, [workspace.id, workspace.folderPath, startClaudeCliPty])

  /** Unified handler — routes through the agent registry to add any agent type */
  const handleAddAgent = useCallback(async (definitionId: string) => {
    const preset = definitionId as AgentPresetId
    const terminal = workspaceStore.addTerminal(workspace.id, preset)

    // Update title from registry definition if not set by preset
    if (terminal.title === 'New Terminal') {
      const def = agentDefinitions.find(d => d.id === definitionId)
      if (def) {
        workspaceStore.renameTerminal(terminal.id, def.name)
      }
    }

    workspaceStore.setFocusedTerminal(terminal.id)
    workspaceStore.save()

    // Integrated (Claude SDK) agents are handled by ClaudeAgentPanel on mount
    if (isClaudeSdk(definitionId)) return

    // Claude CLI gets special handling with bundled CLI path
    if (isClaudeCli(definitionId)) {
      await startClaudeCliPty(terminal.id, workspace.folderPath, isWorktreeAgent(definitionId))
      return
    }

    // All other agents: create a PTY and auto-run the command
    const shell = await getShellFromSettings()
    const settings = settingsStore.getSettings()
    const customEnv = mergeEnvVars(settings.globalEnvVars, workspace.envVars)

    window.electronAPI.pty.create({
      id: terminal.id,
      cwd: workspace.folderPath,
      type: 'terminal',
      agentPreset: preset,
      shell,
      customEnv
    })

    // Auto-run agent command
    const addExtraArgs = settingsStore.getAgentCustomArgs(definitionId)
    const addAppendArgs = (base: string) => addExtraArgs ? `${base} ${addExtraArgs}` : base
    try {
      const launchCmd = await window.electronAPI.agent.buildLaunchCommand(definitionId)
      if (launchCmd) {
        setTimeout(() => {
          window.electronAPI.pty.write(terminal.id, addAppendArgs(launchCmd) + '\r')
        }, 500)
        return
      }
    } catch { /* fallback below */ }

    // Fallback to preset command
    if (settings.agentAutoCommand) {
      const agentPreset = getAgentPreset(definitionId)
      if (agentPreset?.command) {
        setTimeout(() => {
          window.electronAPI.pty.write(terminal.id, addAppendArgs(agentPreset.command) + '\r')
        }, 500)
      }
    }
  }, [workspace.id, workspace.folderPath, workspace.envVars, startClaudeCliPty, agentDefinitions])

  const isDebugMode = window.electronAPI?.debug?.isDebugMode

  const handleCloseTerminal = useCallback((id: string) => {
    const terminal = terminals.find(t => t.id === id)
    // Show confirm if: agent terminal, alt buffer active (TUI/vim/etc.), or pending action.
    // Rationale: any running process warrants a warning; alt buffer is the most reliable signal.
    const isAgentTerminal = !!(terminal?.agentPreset && terminal.agentPreset !== 'none')
    const shouldWarn = isAgentTerminal || !!terminal?.isAltBuffer || !!terminal?.hasPendingAction
    if (shouldWarn) {
      setShowCloseConfirm(id)
    } else {
      // Shell idle (no process, no alt buffer): close directly
      window.electronAPI.pty.kill(id)
      workspaceStore.removeTerminal(id)
      workspaceStore.save()
    }
  }, [terminals])

  const handleConfirmClose = useCallback((cleanWorktree = false) => {
    if (showCloseConfirm) {
      const terminal = terminals.find(t => t.id === showCloseConfirm)
      if (terminal?.agentPreset && isClaudeSdk(terminal.agentPreset)) {
        window.electronAPI.claude.stopSession(showCloseConfirm)
        if (cleanWorktree && terminal.agentPreset === 'claude-code-worktree') {
          window.electronAPI.claude.cleanupWorktree(showCloseConfirm, true)
        }
      } else {
        window.electronAPI.pty.kill(showCloseConfirm)
        if (cleanWorktree && terminal?.agentPreset === 'claude-cli-worktree') {
          window.electronAPI.worktree.remove(showCloseConfirm, true)
        }
      }
      workspaceStore.removeTerminal(showCloseConfirm)
      workspaceStore.save()
      setShowCloseConfirm(null)
    }
  }, [showCloseConfirm, terminals])

  const handleRestart = useCallback(async (id: string) => {
    const terminal = terminals.find(t => t.id === id)
    if (terminal) {
      if (terminal.agentPreset && isClaudeSdk(terminal.agentPreset)) {
        // Stop and restart Claude session
        await window.electronAPI.claude.stopSession(id)
        await window.electronAPI.claude.startSession(id, {
          cwd: terminal.cwd,
          ...(terminal.agentPreset === 'claude-code-worktree' ? { useWorktree: true, worktreePath: terminal.worktreePath, worktreeBranch: terminal.worktreeBranch } : {}),
        })
      } else if (terminal.agentPreset && isClaudeCli(terminal.agentPreset)) {
        // Restart claude-cli PTY with bundled CLI
        await window.electronAPI.pty.kill(id)
        await startClaudeCliPty(id, terminal.cwd || workspace.folderPath, isWorktreeAgent(terminal.agentPreset))
      } else {
        const cwd = await window.electronAPI.pty.getCwd(id) || terminal.cwd
        const shell = await getShellFromSettings()
        await window.electronAPI.pty.restart(id, cwd, shell)
        workspaceStore.updateTerminalCwd(id, cwd)

        // Re-run agent command on restart for terminal-driven agents
        if (terminal.agentPreset && terminal.agentPreset !== 'none') {
          const restartExtraArgs = settingsStore.getAgentCustomArgs(terminal.agentPreset)
          const restartAppendArgs = (base: string) => restartExtraArgs ? `${base} ${restartExtraArgs}` : base
          try {
            const launchCmd = await window.electronAPI.agent.buildLaunchCommand(terminal.agentPreset)
            if (launchCmd) {
              setTimeout(() => {
                window.electronAPI.pty.write(id, restartAppendArgs(launchCmd) + '\r')
              }, 500)
            }
          } catch { /* ignore */ }
        }
      }
    }
  }, [terminals])

  const handleSwitchApiVersion = useCallback(async (id: string) => {
    const terminal = terminals.find(t => t.id === id)
    if (!terminal || !terminal.agentPreset || !isClaudeSdk(terminal.agentPreset) || terminal.agentPreset === 'claude-code-worktree') return
    // Stop current session
    await window.electronAPI.claude.stopSession(id)
    // Switch agentPreset in store
    const newPreset = workspaceStore.switchTerminalApiVersion(id)
    if (!newPreset) return
    const newApiVersion = newPreset === 'claude-code-v2' ? 'v2' as const : 'v1' as const
    // Resume with the same sdkSessionId but new API version
    const sdkSessionId = terminal.sdkSessionId
    if (sdkSessionId) {
      await window.electronAPI.claude.resumeSession(id, sdkSessionId, terminal.cwd, terminal.model, newApiVersion)
    } else {
      await window.electronAPI.claude.startSession(id, { cwd: terminal.cwd, apiVersion: newApiVersion })
    }
    workspaceStore.save()
  }, [terminals])

  const handleFocus = useCallback((id: string) => {
    workspaceStore.setFocusedTerminal(id)
    // Switch back to terminal tab when clicking a terminal thumbnail
    if (activeTab !== 'terminal') {
      handleTabChange('terminal')
    }
  }, [activeTab, handleTabChange])

  const handleReorderTerminals = useCallback((orderedIds: string[]) => {
    workspaceStore.reorderTerminals(orderedIds)
  }, [])

  // Supervisor role management
  const handleSetSupervisor = useCallback((terminalId: string) => {
    workspaceStore.setSupervisor(terminalId, workspace.id)
  }, [workspace.id])

  const handleClearSupervisor = useCallback(() => {
    workspaceStore.clearSupervisor(workspace.id)
  }, [workspace.id])

  const handleSendToWorker = useCallback((targetId: string, text: string) => {
    window.electronAPI.supervisor.sendToWorker(targetId, text + '\r')
  }, [])

  // Determine what to show
  // mainTerminal: the currently focused or first available terminal
  const mainTerminal = focusedTerminal || agentTerminal || terminals[0]

  // Split view computed state
  const pinned = splitSettings.pinned
  const isSplit = pinned !== null
  const pinnedTerminal = (pinned?.type === 'terminal' && pinned.terminalId)
    ? terminals.find(t => t.id === pinned.terminalId)
    : null
  // If pinned is a terminal that no longer exists or is the same as focused, the cleanup effect handles it

  // Send content to the active Claude agent session
  const handleSendToClaude = useCallback(async (content: string) => {
    if (!agentTerminal) return false
    await window.electronAPI.claude.sendMessage(agentTerminal.id, content)
    handleTabChange('terminal')
    workspaceStore.setFocusedTerminal(agentTerminal.id)
    return true
  }, [agentTerminal, handleTabChange])

  // Snippet panel handlers — paste to focused terminal / send to agent
  const handleSnippetPasteToTerminal = useCallback((content: string) => {
    const termId = focusedTerminalId || terminals[0]?.id
    if (termId) {
      window.electronAPI.pty.write(termId, content)
    }
  }, [focusedTerminalId, terminals])

  const handleSnippetSendToAgent = useCallback((content: string) => {
    if (agentTerminal) {
      window.electronAPI.claude.sendMessage(agentTerminal.id, content)
    }
  }, [agentTerminal])

  // Show all terminals in thumbnail bar (clicking switches focus)
  const thumbnailTerminals = terminals

  // Render content for a given tab type (used by both main and pinned panes)
  const renderTabContent = useCallback((tab: PinnedContentType, specificTerminalId?: string) => {
    switch (tab) {
      case 'terminal': {
        if (specificTerminalId) {
          // Render a specific terminal (for pinned terminal)
          const term = terminals.find(t => t.id === specificTerminalId)
          if (!term) return null
          return (
            <div className="terminals-container">
              <div className="terminal-wrapper active">
                <MainPanel
                  terminal={term}
                  isActive={isActive && activeTab === 'terminal'}
                  onClose={handleCloseTerminal}
                  onRestart={handleRestart}
                  onSwitchApiVersion={handleSwitchApiVersion}
                  workspaceId={workspace.id}
                />
              </div>
            </div>
          )
        }
        // Render all terminals with focused one visible
        return (
          <div className="terminals-container">
            {terminals.map(terminal => (
              <div
                key={terminal.id}
                className={`terminal-wrapper ${terminal.id === mainTerminal?.id ? 'active' : 'hidden'}`}
              >
                <MainPanel
                  terminal={terminal}
                  isActive={isActive && activeTab === 'terminal' && terminal.id === mainTerminal?.id}
                  onClose={handleCloseTerminal}
                  onRestart={handleRestart}
                  onSwitchApiVersion={handleSwitchApiVersion}
                  workspaceId={workspace.id}
                />
              </div>
            ))}
            {mainTerminal?.role === 'supervisor' && activeTab === 'terminal' && (
              <WorkerPanel
                workers={terminals.filter(t => t.id !== mainTerminal.id)}
                onSendToWorker={handleSendToWorker}
                onFocusWorker={handleFocus}
              />
            )}
          </div>
        )
      }
      case 'files':
        return (
          <div className="workspace-tab-content">
            <FileTree rootPath={workspace.folderPath} />
          </div>
        )
      case 'git':
        return (
          <div className="workspace-tab-content">
            <GitPanel
              workspaceFolderPath={workspace.folderPath}
              worktreePaths={terminals
                .filter(t => t.agentPreset === 'claude-code-worktree' && t.worktreePath)
                .map(t => ({ path: t.worktreePath!, branch: t.worktreeBranch || 'worktree' }))
              }
            />
          </div>
        )
      case 'git-graph':
        return (
          <div className="workspace-tab-content">
            <GitGraphPanel workspaceFolderPath={workspace.folderPath} />
          </div>
        )
      case 'github':
        return hasGithubRemote ? (
          <div className="workspace-tab-content">
            <GitHubPanel workspaceFolderPath={workspace.folderPath} onSendToClaude={handleSendToClaude} />
          </div>
        ) : null
      case 'snippets':
        return (
          <div className="workspace-tab-content">
            <SnippetSidebar
              isVisible={true}
              collapsed={false}
              workspaceId={workspace.id}
              onPasteToTerminal={handleSnippetPasteToTerminal}
              onSendToAgent={handleSnippetSendToAgent}
            />
          </div>
        )
      case 'skills':
        return (
          <div className="workspace-tab-content">
            <SkillsPanel
              isVisible={true}
              activeCwd={workspace.folderPath}
              activeSessionId={focusedTerminalId}
            />
          </div>
        )
      case 'agents':
        return (
          <div className="workspace-tab-content">
            <AgentsPanel
              isVisible={true}
              activeSessionId={focusedTerminalId}
            />
          </div>
        )
      case 'control-tower':
        return (
          <div className="workspace-tab-content">
            <ControlTowerPanel
              isVisible={true}
              workspaceFolderPath={workspace.folderPath}
              onExecWorkOrder={handleExecWorkOrder}
              onDoneWorkOrder={handleDoneWorkOrder}
            />
          </div>
        )
      default:
        return null
    }
  }, [terminals, mainTerminal, isActive, activeTab, workspace, hasGithubRemote,
      handleCloseTerminal, handleRestart, handleSwitchApiVersion, handleSendToWorker, handleFocus, handleSendToClaude,
      handleSnippetPasteToTerminal, handleSnippetSendToAgent, handleExecWorkOrder, handleDoneWorkOrder, focusedTerminalId])

  // Render the active tab content for the main pane
  const renderPaneContent = useCallback((tab: WorkspaceTab) => {
    return renderTabContent(tab)
  }, [renderTabContent])

  // Render the pinned pane content
  const renderPinnedContent = useCallback(() => {
    if (!pinned) return null
    return renderTabContent(pinned.type, pinned.type === 'terminal' ? pinned.terminalId : undefined)
  }, [pinned, renderTabContent])

  return (
    <div className="workspace-view">
      {/* Top tab bar: Terminal + docked-to-main panels — right-click to pin or move */}
      <div className="workspace-tab-bar">
        {(dockedPanels
          ? ['terminal', ...dockedPanels.filter(p => p !== 'github' || hasGithubRemote)] as PinnedContentType[]
          : ['terminal', 'files', 'git', ...(hasGithubRemote ? ['github'] : []), 'snippets', 'skills', 'agents', 'control-tower'] as PinnedContentType[]
        ).map(tab => (
          <button
            key={tab}
            className={`workspace-tab-btn ${activeTab === tab ? 'active' : ''}${pinned?.type === tab ? ' pinned' : ''}`}
            onClick={() => handleTabChange(tab)}
            onContextMenu={(e) => handleTabContextMenu(e, tab)}
          >
            {pinned?.type === tab && <span className="pin-indicator">{pinned.side === 'left' ? '◧' : '◨'}</span>}
            {t(`workspace.${tab}`)}
          </button>
        ))}
        <div className="workspace-tab-spacer" />
        {isSplit && (
          <button
            className="workspace-tab-action active"
            onClick={handleUnsplit}
            title={t('workspace.unsplit')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
          </button>
        )}
        {onMaximizeToggle && (
          <button
            className={`workspace-tab-action${isMaximized ? ' active' : ''}`}
            onClick={onMaximizeToggle}
            title={isMaximized ? t('workspace.restoreLayout') : t('workspace.maximizePanel')}
          >
            {isMaximized ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="5" width="14" height="14" rx="1" />
                <path d="M9 3h6M3 9v6" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Tab context menu (pin left/right + dock to zone) */}
      {tabCtxMenu && createPortal(
        <div
          ref={tabCtxRef}
          className="context-menu"
          style={tabCtxPos
            ? { position: 'fixed', left: tabCtxPos.x, top: tabCtxPos.y, zIndex: 1000 }
            : { position: 'fixed', left: tabCtxMenu.x, top: tabCtxMenu.y, zIndex: 1000, visibility: 'hidden' as const }
          }
          onClick={e => e.stopPropagation()}
        >
          {pinned?.type === tabCtxMenu.tab ? (
            <button className="context-menu-item" onClick={() => { handleUnsplit(); setTabCtxMenu(null) }}>
              ✕ {t('workspace.unpin')}
            </button>
          ) : (
            <>
              <button className="context-menu-item" onClick={() => { handlePinTab(tabCtxMenu.tab, 'left'); setTabCtxMenu(null) }}>
                ◧ {t('workspace.pinLeft')}
              </button>
              <button className="context-menu-item" onClick={() => { handlePinTab(tabCtxMenu.tab, 'right'); setTabCtxMenu(null) }}>
                ◨ {t('workspace.pinRight')}
              </button>
            </>
          )}
          {tabCtxMenu.tab !== 'terminal' && onDockPanel && (
            <>
              <div className="context-menu-separator" />
              <button className="context-menu-item" onClick={() => { onDockPanel(tabCtxMenu.tab as DockablePanel, 'left'); setTabCtxMenu(null) }}>
                ← {t('workspace.moveToLeft')}
              </button>
              <button className="context-menu-item" onClick={() => { onDockPanel(tabCtxMenu.tab as DockablePanel, 'right'); setTabCtxMenu(null) }}>
                → {t('workspace.moveToRight')}
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Main content area */}
      <ErrorBoundary>
      <Suspense fallback={<div className="loading-panel" />}>
        {isSplit ? (
          <div className="split-container">
            {/* Primary pane (opposite side of pinned) — lazy mount + CSS hidden */}
            {pinned!.side === 'right' && (
              <div className="split-pane" style={{ flex: `0 0 ${splitSettings.ratio * 100}%` }}>
                {Array.from(mountedTabs).map(tab => (
                  <div key={tab} className={`workspace-tab-panel${activeTab === tab ? ' active' : ''}`}>
                    {renderPaneContent(tab)}
                  </div>
                ))}
              </div>
            )}
            {pinned!.side === 'left' && (
              <div className="split-pane" style={{ flex: `0 0 ${(1 - splitSettings.ratio) * 100}%` }}>
                {renderPinnedContent()}
              </div>
            )}
            <ResizeHandle
              direction="horizontal"
              onResize={handleSplitResize}
              onDoubleClick={handleSplitResetRatio}
            />
            {pinned!.side === 'right' && (
              <div className="split-pane" style={{ flex: 1 }}>
                {renderPinnedContent()}
              </div>
            )}
            {pinned!.side === 'left' && (
              <div className="split-pane" style={{ flex: 1 }}>
                {Array.from(mountedTabs).map(tab => (
                  <div key={tab} className={`workspace-tab-panel${activeTab === tab ? ' active' : ''}`}>
                    {renderPaneContent(tab)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="workspace-tab-panels">
            {/* Non-split: keep visited tabs mounted, show only active via visibility */}
            {Array.from(mountedTabs).map(tab => (
              <div key={tab} className={`workspace-tab-panel${activeTab === tab ? ' active' : ''}`}>
                {renderPaneContent(tab)}
              </div>
            ))}
          </div>
        )}
      </Suspense>
      </ErrorBoundary>

      {/* Resize handle for thumbnail bar */}
      {!thumbnailSettings.collapsed && (
        <ResizeHandle
          direction="vertical"
          onResize={handleThumbnailResize}
          onDoubleClick={handleThumbnailResetHeight}
        />
      )}

      <ThumbnailBar
        terminals={thumbnailTerminals}
        focusedTerminalId={focusedTerminalId}
        splitTerminalId={pinned?.type === 'terminal' ? pinned.terminalId ?? null : null}
        onFocus={handleFocus}
        onSplitTerminal={handleSplitTerminal}
        onAddTerminal={handleAddTerminal}
        onAddTerminalWithShell={handleAddTerminalWithShell}
        onAddAgent={handleAddAgent}
        agentDefinitions={agentDefinitions.filter(d => d.id !== 'none').filter(d => !d.debug || isDebugMode).filter(d => !isWorktreeAgent(d.id) || (isDebugMode && isGitRepo))}
        onAddClaudeAgent={handleAddClaudeAgent}
        onAddClaudeAgentV2={handleAddClaudeAgentV2}
        onAddClaudeWorktree={isDebugMode && isGitRepo ? handleAddClaudeWorktree : undefined}
        onAddClaudeCli={handleAddClaudeCli}
        onAddClaudeCliWorktree={isDebugMode && isGitRepo ? handleAddClaudeCliWorktree : undefined}
        onReorder={handleReorderTerminals}
        showAddButton={true}
        height={thumbnailSettings.height}
        collapsed={thumbnailSettings.collapsed}
        onCollapse={handleThumbnailCollapse}
        onSetSupervisor={handleSetSupervisor}
        onClearSupervisor={handleClearSupervisor}
      />

      {showCloseConfirm && (
        <CloseConfirmDialog
          onConfirm={() => handleConfirmClose(false)}
          onCancel={() => setShowCloseConfirm(null)}
          isWorktree={['claude-code-worktree', 'claude-cli-worktree'].includes(terminals.find(t => t.id === showCloseConfirm)?.agentPreset || '')}
          onConfirmAndClean={() => handleConfirmClose(true)}
        />
      )}
    </div>
  )
}
