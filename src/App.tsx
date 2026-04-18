import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useMenuPosition } from './hooks/useMenuPosition'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { workspaceStore } from './stores/workspace-store'
import { settingsStore } from './stores/settings-store'
import { markNotified, markWorkspaceNotified, clearWorkspaceNotification } from './stores/terminal-notifications'
import { Sidebar } from './components/Sidebar'
import { WorkspaceView } from './components/WorkspaceView'
import { SettingsPanel } from './components/SettingsPanel'
import { SnippetSidebar } from './components/SnippetPanel'
import { SkillsPanel } from './components/SkillsPanel'
import { AgentsPanel } from './components/AgentsPanel'
import { MarkdownPreviewPanel } from './components/MarkdownPreviewPanel'
import { WorkspaceEnvDialog } from './components/WorkspaceEnvDialog'
import { ResizeHandle } from './components/ResizeHandle'
import { ProfilePanel } from './components/ProfilePanel'
import { RecoveryPrompt } from './components/RecoveryPrompt'
import type { AppState, EnvVariable, TerminalInstance, DockablePanel, DockZone, DockingConfig } from './types'
import { DOCKABLE_PANELS, DEFAULT_DOCKING_CONFIG } from './types'

// Lazy-loaded panel components for sidebar docking
const LazyFileTree = lazy(() => import('./components/FileTree').then(m => ({ default: m.FileTree })))
const LazyGitPanel = lazy(() => import('./components/GitPanel').then(m => ({ default: m.GitPanel })))
const LazyGitGraphPanel = lazy(() => import('./components/git-panel').then(m => ({ default: m.GitGraphPanel })))
const LazyGitHubPanel = lazy(() => import('./components/GitHubPanel').then(m => ({ default: m.GitHubPanel })))
const LazyControlTowerPanel = lazy(() => import('./components/ControlTowerPanel').then(m => ({ default: m.ControlTowerPanel })))

// Docking configuration persistence
const DOCKING_CONFIG_KEY = 'better-terminal-docking-config'

function loadDockingConfig(): DockingConfig {
  try {
    const saved = localStorage.getItem(DOCKING_CONFIG_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      const config = { ...DEFAULT_DOCKING_CONFIG }
      for (const panel of DOCKABLE_PANELS) {
        if (parsed[panel] === 'left' || parsed[panel] === 'main' || parsed[panel] === 'right') {
          config[panel] = parsed[panel]
        }
      }
      return config
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_DOCKING_CONFIG }
}

function saveDockingConfig(config: DockingConfig): void {
  try {
    localStorage.setItem(DOCKING_CONFIG_KEY, JSON.stringify(config))
  } catch { /* ignore */ }
}

// Panel settings interface
interface PanelSettings {
  sidebar: {
    width: number
    collapsed: boolean
  }
  snippetSidebar: {
    width: number
    collapsed: boolean
  }
  maximized: boolean
  /** Snapshot of collapsed states before maximize, used to restore on un-maximize */
  preMaximize?: {
    sidebarCollapsed: boolean
    snippetSidebarCollapsed: boolean
  }
}

const PANEL_SETTINGS_KEY = 'better-terminal-panel-settings'
const DEFAULT_SIDEBAR_WIDTH = 220
const MIN_SIDEBAR_WIDTH = 160
const MAX_SIDEBAR_WIDTH = 400
const DEFAULT_SNIPPET_WIDTH = 280
const MIN_SNIPPET_WIDTH = 180
const MAX_SNIPPET_WIDTH = 500

function loadPanelSettings(): PanelSettings {
  try {
    const saved = localStorage.getItem(PANEL_SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Ensure sidebar settings exist (migration from old format)
      return {
        sidebar: { width: parsed.sidebar?.width ?? DEFAULT_SIDEBAR_WIDTH, collapsed: parsed.sidebar?.collapsed ?? false },
        snippetSidebar: parsed.snippetSidebar || { width: DEFAULT_SNIPPET_WIDTH, collapsed: true },
        maximized: parsed.maximized ?? false
      }
    }
  } catch (e) {
    console.error('Failed to load panel settings:', e)
  }
  return {
    sidebar: { width: DEFAULT_SIDEBAR_WIDTH, collapsed: false },
    snippetSidebar: { width: DEFAULT_SNIPPET_WIDTH, collapsed: true },
    maximized: false
  }
}

function savePanelSettings(settings: PanelSettings): void {
  try {
    localStorage.setItem(PANEL_SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save panel settings:', e)
  }
}

export default function App() {
  const { t } = useTranslation()
  const [state, setState] = useState<AppState>(workspaceStore.getState())
  const [showSettings, setShowSettings] = useState(false)
  const [showProfiles, setShowProfiles] = useState(false)
  const [activeProfileName, setActiveProfileName] = useState<string>('Default')
  const [isRemoteConnected, setIsRemoteConnected] = useState(false)
  const [appNotification, setAppNotification] = useState<string | null>(null)
  const [recoveryInfo, setRecoveryInfo] = useState<{ ptyCount: number } | null>(null)
  const [serverStatusToast, setServerStatusToast] = useState<string | null>(null)
  const [envDialogWorkspaceId, setEnvDialogWorkspaceId] = useState<string | null>(null)
  // T0133: Worker→Tower notification toasts (queue of transient toasts)
  const [notifyToasts, setNotifyToasts] = useState<{ id: string; text: string }[]>([])
  // Docking system
  const [dockingConfig, setDockingConfig] = useState<DockingConfig>(loadDockingConfig)
  const [leftPanelTab, setLeftPanelTab] = useState<'workspaces' | DockablePanel>('workspaces')
  const [sidebarTabCtxMenu, setSidebarTabCtxMenu] = useState<{ x: number; y: number; panel: DockablePanel; zone: 'left' | 'right' } | null>(null)
  const { pos: sidebarCtxPos, menuRef: sidebarCtxRef } = useMenuPosition(sidebarTabCtxMenu)
  // Right sidebar tabs
  const [rightPanelTab, setRightPanelTab] = useState<DockablePanel>(() => {
    const saved = localStorage.getItem('bat-right-panel-tab')
    if (saved && DOCKABLE_PANELS.includes(saved as DockablePanel)) return saved as DockablePanel
    return 'snippets'
  })
  // Track which sidebar panels have been visited — lazy mount to preserve state
  const [mountedLeftPanels, setMountedLeftPanels] = useState<Set<string>>(() => new Set(['workspaces']))
  const [mountedRightPanels, setMountedRightPanels] = useState<Set<DockablePanel>>(() => {
    const saved = localStorage.getItem('bat-right-panel-tab')
    const initial = (saved && DOCKABLE_PANELS.includes(saved as DockablePanel)) ? saved as DockablePanel : 'snippets'
    return new Set([initial])
  })
  // Markdown preview in right panel
  const [previewMarkdownPath, setPreviewMarkdownPath] = useState<string | null>(null)
  // Track collapsed state before markdown preview opened, to restore on close
  const previewPrevCollapsed = useRef<boolean | null>(null)
  // Panel settings for resizable panels
  const [panelSettings, setPanelSettings] = useState<PanelSettings>(loadPanelSettings)
  // Detached workspace support
  const [detachedWorkspaceId] = useState(() => window.electronAPI.workspace.getDetachedId())
  const [detachedIds, setDetachedIds] = useState<Set<string>>(new Set())
  // Track workspaces that have been visited (for lazy mounting)
  const [mountedWorkspaces, setMountedWorkspaces] = useState<Set<string>>(new Set())

  // Sync window title with active profile
  useEffect(() => {
    document.title = `Better Agent Terminal - ${activeProfileName}`
  }, [activeProfileName])

  // Lazy mount: only render a workspace's terminals once it has been activated
  useEffect(() => {
    if (state.activeWorkspaceId && !mountedWorkspaces.has(state.activeWorkspaceId)) {
      setMountedWorkspaces(prev => new Set(prev).add(state.activeWorkspaceId!))
    }
  }, [state.activeWorkspaceId, mountedWorkspaces])

  // T0133 Renew#1: Clear workspace notification badge when user switches to that workspace.
  // Terminal-level badges are preserved until the user actually focuses the target terminal.
  useEffect(() => {
    if (state.activeWorkspaceId) {
      clearWorkspaceNotification(state.activeWorkspaceId)
    }
  }, [state.activeWorkspaceId])

  // Docking system: computed panel lists per zone
  const leftDockedPanels = useMemo(() =>
    DOCKABLE_PANELS.filter(p => dockingConfig[p] === 'left'), [dockingConfig])
  const mainDockedPanels = useMemo(() =>
    DOCKABLE_PANELS.filter(p => dockingConfig[p] === 'main'), [dockingConfig])
  const rightDockedPanels = useMemo(() =>
    DOCKABLE_PANELS.filter(p => dockingConfig[p] === 'right'), [dockingConfig])

  // Docking: move a panel to a different zone
  const handleDockPanel = useCallback((panel: DockablePanel, zone: DockZone) => {
    setDockingConfig(prev => {
      const updated = { ...prev, [panel]: zone }
      saveDockingConfig(updated)
      return updated
    })
  }, [])

  // Auto-correct active tabs when panels are moved between zones
  useEffect(() => {
    if (leftPanelTab !== 'workspaces' && dockingConfig[leftPanelTab] !== 'left') {
      setLeftPanelTab('workspaces')
    }
    const rightPanels = DOCKABLE_PANELS.filter(p => dockingConfig[p] === 'right')
    if (rightPanels.length > 0 && !rightPanels.includes(rightPanelTab as DockablePanel)) {
      const first = rightPanels[0]
      setRightPanelTab(first)
      localStorage.setItem('bat-right-panel-tab', first)
    }
  }, [dockingConfig, leftPanelTab, rightPanelTab])

  // Close sidebar tab context menu on click
  useEffect(() => {
    if (!sidebarTabCtxMenu) return
    const close = () => setSidebarTabCtxMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [sidebarTabCtxMenu])

  // Handle sidebar resize
  const handleSidebarResize = useCallback((delta: number) => {
    setPanelSettings(prev => {
      // Note: delta is positive when dragging right (making sidebar wider)
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, prev.sidebar.width + delta))
      const updated = { ...prev, sidebar: { ...prev.sidebar, width: newWidth } }
      savePanelSettings(updated)
      return updated
    })
  }, [])

  // Reset sidebar to default width
  const handleSidebarResetWidth = useCallback(() => {
    setPanelSettings(prev => {
      const updated = { ...prev, sidebar: { ...prev.sidebar, width: DEFAULT_SIDEBAR_WIDTH } }
      savePanelSettings(updated)
      return updated
    })
  }, [])

  // Handle snippet sidebar resize
  const handleSnippetResize = useCallback((delta: number) => {
    setPanelSettings(prev => {
      // Note: delta is negative when dragging left (making sidebar wider)
      const newWidth = Math.min(MAX_SNIPPET_WIDTH, Math.max(MIN_SNIPPET_WIDTH, prev.snippetSidebar.width - delta))
      const updated = { ...prev, snippetSidebar: { ...prev.snippetSidebar, width: newWidth } }
      savePanelSettings(updated)
      return updated
    })
  }, [])

  const handleRightPanelTabChange = useCallback((tab: DockablePanel) => {
    setRightPanelTab(tab)
    setMountedRightPanels(prev => prev.has(tab) ? prev : new Set([...prev, tab]))
    localStorage.setItem('bat-right-panel-tab', tab)
    // If collapsed, expand when switching tabs
    setPanelSettings(prev => {
      if (prev.snippetSidebar.collapsed) {
        const updated = { ...prev, snippetSidebar: { ...prev.snippetSidebar, collapsed: false } }
        savePanelSettings(updated)
        return updated
      }
      return prev
    })
  }, [])

  // Toggle snippet sidebar collapse
  const handleSnippetCollapse = useCallback(() => {
    setPanelSettings(prev => {
      const updated = { ...prev, snippetSidebar: { ...prev.snippetSidebar, collapsed: !prev.snippetSidebar.collapsed } }
      savePanelSettings(updated)
      return updated
    })
  }, [])

  // Toggle sidebar collapse
  const handleSidebarCollapse = useCallback(() => {
    setPanelSettings(prev => {
      const updated = { ...prev, sidebar: { ...prev.sidebar, collapsed: !prev.sidebar.collapsed } }
      savePanelSettings(updated)
      return updated
    })
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  // Toggle maximize mode: collapse/restore all surrounding panels
  const handleMaximizeToggle = useCallback(() => {
    setPanelSettings(prev => {
      const nextMaximized = !prev.maximized
      let updated: PanelSettings
      if (nextMaximized) {
        // Save current collapsed states before maximizing
        updated = {
          ...prev,
          maximized: true,
          preMaximize: {
            sidebarCollapsed: prev.sidebar.collapsed,
            snippetSidebarCollapsed: prev.snippetSidebar.collapsed
          },
          sidebar: { ...prev.sidebar, collapsed: true },
          snippetSidebar: { ...prev.snippetSidebar, collapsed: true }
        }
      } else {
        // Restore pre-maximize states (default to not-collapsed if no snapshot)
        const restore = prev.preMaximize
        updated = {
          ...prev,
          maximized: false,
          preMaximize: undefined,
          sidebar: { ...prev.sidebar, collapsed: restore?.sidebarCollapsed ?? false },
          snippetSidebar: { ...prev.snippetSidebar, collapsed: restore?.snippetSidebarCollapsed ?? true }
        }
      }
      savePanelSettings(updated)
      // Dispatch event so WorkspaceView can collapse/restore ThumbnailBar
      window.dispatchEvent(new CustomEvent('maximize-toggle', { detail: { maximized: nextMaximized } }))
      return updated
    })
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  // Reset snippet sidebar to default width
  const handleSnippetResetWidth = useCallback(() => {
    setPanelSettings(prev => {
      const updated = { ...prev, snippetSidebar: { ...prev.snippetSidebar, width: DEFAULT_SNIPPET_WIDTH } }
      savePanelSettings(updated)
      return updated
    })
  }, [])

  // Keyboard shortcuts: Ctrl+B (toggle sidebar), Ctrl+Shift+M (maximize toggle)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      // Ctrl+B: toggle sidebar
      if (e.key === 'b' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        handleSidebarCollapse()
        return
      }
      // Ctrl+Shift+M: maximize toggle
      if ((e.key === 'M' || e.key === 'm') && e.shiftKey && !e.altKey) {
        e.preventDefault()
        handleMaximizeToggle()
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSidebarCollapse, handleMaximizeToggle])

  // Listen for markdown preview requests from PathLinker
  useEffect(() => {
    const handler = (e: Event) => {
      const { path } = (e as CustomEvent).detail as { path: string }
      setPreviewMarkdownPath(path)
      // Save current collapsed state so we can restore it on close, then expand panel
      setPanelSettings(prev => {
        previewPrevCollapsed.current = prev.snippetSidebar.collapsed
        if (prev.snippetSidebar.collapsed) {
          const updated = { ...prev, snippetSidebar: { ...prev.snippetSidebar, collapsed: false } }
          savePanelSettings(updated)
          return updated
        }
        return prev
      })
    }
    window.addEventListener('preview-markdown', handler)
    return () => window.removeEventListener('preview-markdown', handler)
  }, [])

  // Cmd+N / Ctrl+N: open new empty window
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        window.electronAPI.app.newWindow()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Track previous terminal for Cmd+` toggle
  const prevTerminalIdRef = useRef<string | null>(null)

  // Keyboard shortcuts: Cmd+` (toggle terminal), Cmd+Left/Right (cycle tabs), Cmd+Up/Down (switch workspace)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return

      // Cmd+` / Ctrl+`: Toggle between first regular terminal and Claude Code terminal
      if (e.key === '`' && !e.shiftKey) {
        e.preventDefault()
        const currentState = workspaceStore.getState()
        if (!currentState.activeWorkspaceId) return
        const terminals = workspaceStore.getWorkspaceTerminals(currentState.activeWorkspaceId)
        if (terminals.length === 0) return

        const firstRegular = terminals.find(t => !t.agentPreset || t.agentPreset === 'none')
        const agentTerminal = terminals.find(t => t.agentPreset && t.agentPreset !== 'none')
        const focusedId = currentState.focusedTerminalId

        // If focused on agent terminal → switch to first regular terminal
        // If focused on regular terminal → switch back to agent terminal (or previous)
        const focusedTerminal = terminals.find(t => t.id === focusedId)
        const isOnAgent = focusedTerminal?.agentPreset && focusedTerminal.agentPreset !== 'none'

        if (isOnAgent && firstRegular) {
          prevTerminalIdRef.current = focusedId
          workspaceStore.setFocusedTerminal(firstRegular.id)
        } else if (!isOnAgent && agentTerminal) {
          prevTerminalIdRef.current = focusedId
          workspaceStore.setFocusedTerminal(agentTerminal.id)
        } else if (!isOnAgent && prevTerminalIdRef.current) {
          const prev = prevTerminalIdRef.current
          prevTerminalIdRef.current = focusedId
          workspaceStore.setFocusedTerminal(prev)
        }
        // Also ensure we're on the terminal tab
        window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'terminal' } }))
        return
      }

      // Cmd+Up / Cmd+Down: Switch workspaces
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey) {
        e.preventDefault()
        const currentState = workspaceStore.getState()
        const workspaces = currentState.workspaces
        if (workspaces.length <= 1) return
        const currentIndex = workspaces.findIndex(w => w.id === currentState.activeWorkspaceId)
        const direction = e.key === 'ArrowDown' ? 1 : -1
        const nextIndex = (currentIndex + direction + workspaces.length) % workspaces.length
        workspaceStore.setActiveWorkspace(workspaces[nextIndex].id)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const unsubscribe = workspaceStore.subscribe(() => {
      setState(workspaceStore.getState())
    })

    // Global listener for all terminal output - updates activity for ALL terminals
    // This is needed because WorkspaceView only renders terminals for the active workspace
    const unsubscribeOutput = window.electronAPI.pty.onOutput((id) => {
      workspaceStore.updateTerminalActivity(id)
    })

    // T0130: Listen for terminals created externally (via RemoteServer WebSocket).
    // Adds the terminal to workspace state so xterm binds automatically via TerminalPanel.
    // T0137/BUG-031: `info.workspaceId` (optional, from `bat-terminal.mjs --workspace <id>`)
    // selects the target workspace; otherwise falls back to active workspace.
    const unsubExternalTerminal = window.electronAPI.pty.onCreatedExternally((info) => {
      const added = workspaceStore.addExternalTerminal(info)
      if (added) {
        window.electronAPI.debug.log(`[T0130] External terminal added: id=${info.id} cwd=${info.cwd} workspaceId=${info.workspaceId ?? '(active)'}`)
        workspaceStore.save()
      }
    })

    // T0133: Listen for Worker→Tower auto-notify broadcasts.
    // Shows a transient toast AND marks the target terminal's thumbnail badge.
    // If the target terminal is not in the active workspace, also bubble a badge to that workspace.
    const unsubTerminalNotified = window.electronAPI.pty.onTerminalNotified((info) => {
      window.electronAPI.debug.log(`[T0133] Notified target=${info.targetId.slice(0, 8)} source=${info.source ?? '?'} msg="${info.message}"`)
      markNotified(info.targetId)
      // Layer 2: workspace-level bubble — only if target is not in active workspace
      const targetTerminal = workspaceStore.getState().terminals.find(tm => tm.id === info.targetId)
      const targetWorkspaceId = targetTerminal?.workspaceId
      const activeWsId = workspaceStore.getState().activeWorkspaceId
      if (targetWorkspaceId && targetWorkspaceId !== activeWsId) {
        markWorkspaceNotified(targetWorkspaceId)
      }
      const toastId = `notify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const text = info.source ? `📨 ${info.source}: ${info.message}` : `📨 ${info.message}`
      setNotifyToasts(prev => [...prev, { id: toastId, text }])
      // Auto-dismiss after 6s
      setTimeout(() => {
        setNotifyToasts(prev => prev.filter(t => t.id !== toastId))
      }, 6000)
    })

    // Load saved workspaces and settings on startup
    // If launched with --profile, use that profile instead of the stored active one
    const dlog = (...args: unknown[]) => window.electronAPI?.debug?.log(...args)
    const htmlT0 = (window as unknown as { __t0?: number }).__t0 || Date.now()
    dlog(`[startup] App useEffect fired: +${Date.now() - htmlT0}ms from HTML`)
    const initProfile = async () => {
      const t0 = performance.now()
      try {
        const launchProfileId = await window.electronAPI.app.getLaunchProfile()
        dlog(`[init] getLaunchProfile: ${(performance.now() - t0).toFixed(0)}ms`)

        const t1 = performance.now()
        const result = await window.electronAPI.profile.list()
        dlog(`[init] profile.list: ${(performance.now() - t1).toFixed(0)}ms`)

        // Determine which profile this window should use:
        // 1. Launch profile (--profile= argument) takes priority
        // 2. Window registry's profileId (per-window binding)
        // 3. First active profile as fallback
        const windowProfileId = await window.electronAPI.app.getWindowProfile()
        const profileId = launchProfileId || windowProfileId || result.activeProfileIds[0]
        let active = result.profiles.find(p => p.id === profileId)

        // If the id doesn't match anything in `result` (which is the REMOTE
        // host's profile list when a remote connection is already active),
        // fall back to the local profile list. This happens when the window
        // is bound to a LOCAL profile that acts as an alias for a remote
        // connection (e.g. launched with --profile=<local-remote-alias>).
        if (!active && profileId) {
          try {
            const localResult = await window.electronAPI.profile.listLocal()
            active = localResult.profiles.find(p => p.id === profileId)
          } catch {
            // listLocal may not exist on older builds — fall through
          }
        }

        if (active?.type === 'remote' && active.remoteHost && active.remoteToken) {
          // Try connecting to remote
          const tRemote = performance.now()
          const connectResult = await window.electronAPI.remote.connect(
            active.remoteHost,
            active.remotePort || 9876,
            active.remoteToken
          )
          dlog(`[init] remote.connect: ${(performance.now() - tRemote).toFixed(0)}ms`)
          if ('error' in connectResult) {
            if (launchProfileId) {
              // New window launch failed — show error and close instead of corrupting shared state
              setAppNotification(t('app.remoteConnectionFailed', { error: connectResult.error }))
              setTimeout(() => window.close(), 3000)
              return
            }
            // Main window: fall back to first local profile
            const localProfile = result.profiles.find(p => p.type !== 'remote')
            if (localProfile) {
              await window.electronAPI.profile.load(localProfile.id)
              const winIdx = await window.electronAPI.app.getWindowIndex()
              setActiveProfileName(`${localProfile.name}:${winIdx}`)
            }
          } else {
            const winIdx = await window.electronAPI.app.getWindowIndex()
            setActiveProfileName(`${active.name}:${winIdx}`)
            setIsRemoteConnected(true)
          }
        } else if (active?.type === 'remote') {
          // Remote profile missing connection info — fall back
          if (launchProfileId) {
            setAppNotification(t('app.remoteMissingInfo'))
            setTimeout(() => window.close(), 3000)
            return
          }
          const localProfile = result.profiles.find(p => p.type !== 'remote')
          if (localProfile) {
            await window.electronAPI.profile.load(localProfile.id)
            const winIdx = await window.electronAPI.app.getWindowIndex()
            setActiveProfileName(`${localProfile.name}:${winIdx}`)
          }
        } else if (active) {
          // For local profiles opened in a new window, load the profile snapshot
          // so workspaces.json reflects this profile's data (not the previous profile's)
          if (launchProfileId) {
            await window.electronAPI.profile.load(active.id)
          }
          const winIdx = await window.electronAPI.app.getWindowIndex()
          setActiveProfileName(`${active.name}:${winIdx}`)
        } else if (result.profiles.length > 0) {
          // Fallback: activeProfileId didn't match any profile — use first local profile
          const fallback = result.profiles.find(p => p.type !== 'remote') || result.profiles[0]
          const winIdx = await window.electronAPI.app.getWindowIndex()
          setActiveProfileName(`${fallback.name}:${winIdx}`)
        }

        // Store windowId for cross-window workspace drag
        const winId = await window.electronAPI.app.getWindowId()
        if (winId) workspaceStore.setWindowId(winId)

        const tLoad = performance.now()
        // Load settings first (lightweight, no re-render), then workspaces (triggers heavy re-render)
        await settingsStore.load()
        dlog(`[init] settingsStore.load: ${(performance.now() - tLoad).toFixed(0)}ms`)

        // Sync i18n language with saved setting
        const savedLang = settingsStore.getSettings().language || 'en'
        if (i18next.language !== savedLang) i18next.changeLanguage(savedLang)

        const tWs = performance.now()
        await workspaceStore.load()
        dlog(`[init] workspaceStore.load: ${(performance.now() - tWs).toFixed(0)}ms`)
      } catch (e) {
        console.error('Failed to initialize profile:', e)
        // Ensure workspaces still load even if profile init fails
        await settingsStore.load()
        const savedLang = settingsStore.getSettings().language || 'en'
        if (i18next.language !== savedLang) i18next.changeLanguage(savedLang)
        await workspaceStore.load()
      }
      dlog(`[init] total initProfile: ${(performance.now() - t0).toFixed(0)}ms`)
      dlog(`[startup] app ready (initProfile done): +${Date.now() - htmlT0}ms from HTML`)
    }
    initProfile()

    // Listen for system resume from sleep/hibernate — refresh remote connection status
    const unsubSystemResume = window.electronAPI.system.onResume(() => {
      window.electronAPI.remote.clientStatus().then(s => setIsRemoteConnected(s.connected))
    })

    // Listen for cross-window workspace reload
    const unsubReload = workspaceStore.listenForReload()

    // Listen for before-quit flush-save: stop auto-save and do one final save
    const unsubFlushSave = window.electronAPI.workspace.onFlushSave(async () => {
      workspaceStore.stopAutoSave()
      await workspaceStore.save()
    })

    // Listen for workspace detach/reattach events (main window only)
    const unsubDetach = window.electronAPI.workspace.onDetached((wsId) => {
      setDetachedIds(prev => new Set(prev).add(wsId))
    })
    const unsubRecovery = window.electronAPI.terminalServer.onRecoveryAvailable((info) => {
      setRecoveryInfo(info)
    })
    // T0111: pull-model — check if main process already has pending recovery
    // (handles case where push event arrived before this listener was registered)
    window.electronAPI.terminalServer.queryPendingRecovery().then((info) => {
      if (info) setRecoveryInfo(info)
    })

    // T0112: heartbeat watchdog status toast notifications
    const unsubServerStatus = window.electronAPI.terminalServer.onStatusChange((status) => {
      if (status === 'recovering') {
        setServerStatusToast('Terminal Server 異常，正在自動恢復...')
      } else if (status === 'recovered') {
        setServerStatusToast('終端已恢復（歷史輸出已重置）')
        setTimeout(() => setServerStatusToast(null), 3000)
      } else if (status === 'failed') {
        setServerStatusToast('Terminal Server 恢復失敗，請重新啟動應用程式')
      }
    })

    const unsubReattach = window.electronAPI.workspace.onReattached((wsId) => {
      setDetachedIds(prev => {
        const next = new Set(prev)
        next.delete(wsId)
        return next
      })
    })

    return () => {
      unsubscribe()
      unsubscribeOutput()
      unsubExternalTerminal()
      unsubTerminalNotified()
      unsubSystemResume()
      unsubReload()
      unsubFlushSave()
      unsubDetach()
      unsubReattach()
      unsubRecovery()
      unsubServerStatus()
    }
  }, [])

  // Poll remote client connection status
  useEffect(() => {
    const check = () => {
      window.electronAPI.remote.clientStatus().then(s => setIsRemoteConnected(s.connected))
    }
    check()
    const interval = setInterval(check, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleAddWorkspace = useCallback(async () => {
    const folderPaths = await window.electronAPI.dialog.selectFolder()
    if (folderPaths && folderPaths.length > 0) {
      for (const folderPath of folderPaths) {
        const name = folderPath.split(/[/\\]/).pop() || 'Workspace'
        workspaceStore.addWorkspace(name, folderPath)
      }
      workspaceStore.save()
    }
  }, [])


  const handleDetachWorkspace = useCallback(async (workspaceId: string) => {
    await window.electronAPI.workspace.detach(workspaceId)
  }, [])

  // Paste content to focused PTY terminal
  const handlePasteToTerminal = useCallback((content: string) => {
    const currentState = workspaceStore.getState()
    let terminalId = currentState.focusedTerminalId

    if (!terminalId && currentState.activeWorkspaceId) {
      const workspaceTerminals = workspaceStore.getWorkspaceTerminals(currentState.activeWorkspaceId)
      if (workspaceTerminals.length > 0) {
        terminalId = workspaceTerminals[0].id
      }
    }

    if (terminalId) {
      window.electronAPI.pty.write(terminalId, content)
    } else {
      console.warn('No terminal available to paste to')
    }
  }, [])

  // Send content to active Claude agent session
  const handleSendToAgent = useCallback((content: string) => {
    const currentState = workspaceStore.getState()
    // Find focused agent terminal, or first agent in active workspace
    let terminalId = currentState.focusedTerminalId
    let terminal: TerminalInstance | undefined

    if (terminalId) {
      terminal = currentState.terminals.find(t => t.id === terminalId)
      // If focused terminal is not an agent, find the first agent
      if (!terminal?.agentPreset || terminal.agentPreset === 'none') {
        terminal = undefined
        terminalId = null
      }
    }

    if (!terminalId && currentState.activeWorkspaceId) {
      const workspaceTerminals = workspaceStore.getWorkspaceTerminals(currentState.activeWorkspaceId)
      terminal = workspaceTerminals.find(t => t.agentPreset && t.agentPreset !== 'none')
      terminalId = terminal?.id ?? null
    }

    if (terminalId) {
      window.electronAPI.claude.sendMessage(terminalId, content)
    } else {
      console.warn('No Claude agent session available')
    }
  }, [])

  // Render a dockable panel by ID (for sidebar zones)
  const renderDockablePanel = useCallback((panel: DockablePanel) => {
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId)
    if (!activeWorkspace) return <div className="empty-state"><p>{t('app.welcomeHint')}</p></div>

    switch (panel) {
      case 'files':
        return <LazyFileTree rootPath={activeWorkspace.folderPath} />
      case 'git': {
        const wsTerminals = workspaceStore.getWorkspaceTerminals(activeWorkspace.id)
        return <LazyGitPanel
          workspaceFolderPath={activeWorkspace.folderPath}
          worktreePaths={wsTerminals
            .filter(t2 => t2.agentPreset === 'claude-code-worktree' && t2.worktreePath)
            .map(t2 => ({ path: t2.worktreePath!, branch: t2.worktreeBranch || 'worktree' }))}
        />
      }
      case 'git-graph':
        return <LazyGitGraphPanel workspaceFolderPath={activeWorkspace.folderPath} />
      case 'github':
        return <LazyGitHubPanel
          workspaceFolderPath={activeWorkspace.folderPath}
          onSendToClaude={async (content: string) => { handleSendToAgent(content); return true }}
        />
      case 'snippets':
        return <SnippetSidebar
          isVisible={true}
          collapsed={false}
          workspaceId={activeWorkspace.id}
          onPasteToTerminal={handlePasteToTerminal}
          onSendToAgent={handleSendToAgent}
        />
      case 'skills':
        return <SkillsPanel
          isVisible={true}
          activeCwd={activeWorkspace.folderPath}
          activeSessionId={state.focusedTerminalId ?? null}
        />
      case 'agents':
        return <AgentsPanel
          isVisible={true}
          activeSessionId={state.focusedTerminalId ?? null}
        />
      case 'control-tower':
        return <LazyControlTowerPanel
          isVisible={true}
          workspaceFolderPath={activeWorkspace.folderPath}
          onExecWorkOrder={async (workOrderId: string) => {
            const terminal = workspaceStore.addTerminal(activeWorkspace.id)
            const ctArgs = settingsStore.getAgentCustomArgs('claude-cli')
            const command = `claude "/ct-exec ${workOrderId}"${ctArgs ? ` ${ctArgs}` : ''}`
            const settings = settingsStore.getSettings()
            const mergedEnv: Record<string, string> = {}
            for (const v of [...(settings.globalEnvVars || []), ...(activeWorkspace.envVars || [])]) {
              if (v.enabled) mergedEnv[v.key] = v.value
            }
            await window.electronAPI.pty.createWithCommand({
              id: terminal.id,
              cwd: activeWorkspace.folderPath,
              command,
              customEnv: mergedEnv,
              workspaceId: activeWorkspace.id,  // T0176: BAT_WORKSPACE_ID env injection
            })
            workspaceStore.setFocusedTerminal(terminal.id)
            workspaceStore.save()
          }}
          onDoneWorkOrder={async (workOrderId: string) => {
            const terminal = workspaceStore.addTerminal(activeWorkspace.id)
            const ctArgs = settingsStore.getAgentCustomArgs('claude-cli')
            const command = `claude "/ct-done ${workOrderId}"${ctArgs ? ` ${ctArgs}` : ''}`
            const settings = settingsStore.getSettings()
            const mergedEnv: Record<string, string> = {}
            for (const v of [...(settings.globalEnvVars || []), ...(activeWorkspace.envVars || [])]) {
              if (v.enabled) mergedEnv[v.key] = v.value
            }
            await window.electronAPI.pty.createWithCommand({
              id: terminal.id,
              cwd: activeWorkspace.folderPath,
              command,
              customEnv: mergedEnv,
              workspaceId: activeWorkspace.id,  // T0176: BAT_WORKSPACE_ID env injection
            })
            workspaceStore.setFocusedTerminal(terminal.id)
            workspaceStore.save()
          }}
        />
      default:
        return null
    }
  }, [state.workspaces, state.activeWorkspaceId, state.focusedTerminalId, handlePasteToTerminal, handleSendToAgent, t])

  // Open profile in a new app instance (or focus if already open)
  const handleProfileNewWindow = useCallback(async (profileId: string) => {
    const result = await window.electronAPI.app.openNewInstance(profileId)
    if (result?.alreadyOpen) {
      setAppNotification(t('profiles.alreadyOpen'))
    }
    setShowProfiles(false)
  }, [t])

  // Get the workspace for env dialog
  const envDialogWorkspace = envDialogWorkspaceId
    ? state.workspaces.find(w => w.id === envDialogWorkspaceId)
    : null

  // Detached window mode — render only that workspace, no sidebar
  if (detachedWorkspaceId) {
    const ws = state.workspaces.find(w => w.id === detachedWorkspaceId)
    if (!ws) {
      return (
        <div className="app">
          <main className="main-content">
            <div className="empty-state">
              <h2>{t('app.workspaceNotFound')}</h2>
              <p>{t('app.workspaceNotFoundDesc')}</p>
            </div>
          </main>
        </div>
      )
    }
    return (
      <div className="app">
        <main className="main-content" style={{ width: '100%' }}>
          <div className="workspace-container active">
            <WorkspaceView
              workspace={ws}
              terminals={workspaceStore.getWorkspaceTerminals(ws.id)}
              focusedTerminalId={state.focusedTerminalId}
              isActive={true}
            />
          </div>
        </main>
      </div>
    )
  }

  // Filter out detached workspaces from main window
  const nonDetachedWorkspaces = state.workspaces.filter(w => !detachedIds.has(w.id))
  const visibleWorkspaces = nonDetachedWorkspaces.filter(w => !w.archived)
  const archivedWorkspaces = nonDetachedWorkspaces.filter(w => w.archived)

  return (
    <div className="app">
      {/* Left sidebar collapsed bar — always rendered, hidden when expanded */}
      <div className="left-sidebar-collapsed" style={{ display: panelSettings.sidebar.collapsed ? undefined : 'none' }}>
        <button className="left-sidebar-collapsed-btn" onClick={() => { setLeftPanelTab('workspaces'); handleSidebarCollapse(); }} title={t('sidebar.expandSidebar')}>
          {'\u{1F4C2}'}
        </button>
        {leftDockedPanels.map(panel => (
          <button key={panel} className="left-sidebar-collapsed-btn" onClick={() => {
            setLeftPanelTab(panel)
            setMountedLeftPanels(prev => prev.has(panel) ? prev : new Set([...prev, panel]))
            handleSidebarCollapse()
          }} title={t(`workspace.${panel}`)}>
            {panel === 'files' ? '\u{1F4C1}' : panel === 'git' ? '\u{1F500}' : panel === 'git-graph' ? '\u{1F4C8}' : panel === 'github' ? '\u{1F310}' : panel === 'snippets' ? '\u{1F4DD}' : panel === 'skills' ? '\u{26A1}' : panel === 'control-tower' ? '\u{1F5FC}' : '\u{1F916}'}
          </button>
        ))}
      </div>
      {/* Left sidebar expanded content — always rendered, hidden when collapsed to preserve state */}
      {leftDockedPanels.length > 0 ? (
        <>
          <div className="left-sidebar-wrapper" style={{ width: `${panelSettings.sidebar.width}px`, minWidth: `${panelSettings.sidebar.width}px`, display: panelSettings.sidebar.collapsed ? 'none' : 'flex', flexDirection: 'column' as const }}>
            <div className="left-sidebar-tabs">
              <button
                className={`left-sidebar-tab${leftPanelTab === 'workspaces' ? ' active' : ''}`}
                onClick={() => setLeftPanelTab('workspaces')}
              >
                {t('workspace.workspaces')}
              </button>
              {leftDockedPanels.map(panel => (
                <button
                  key={panel}
                  className={`left-sidebar-tab${leftPanelTab === panel ? ' active' : ''}`}
                  onClick={() => { setLeftPanelTab(panel); setMountedLeftPanels(prev => prev.has(panel) ? prev : new Set([...prev, panel])) }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSidebarTabCtxMenu({ x: e.clientX, y: e.clientY, panel, zone: 'left' })
                  }}
                >
                  {t(`workspace.${panel}`)}
                </button>
              ))}
              <button className="left-sidebar-collapse" onClick={handleSidebarCollapse} title={t('sidebar.collapseSidebar')}>&laquo;</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {/* Sidebar — always mounted, hidden when not active */}
              <div style={{ display: leftPanelTab === 'workspaces' ? undefined : 'none', height: '100%' }}>
                <Sidebar
                  width={panelSettings.sidebar.width}
                  workspaces={visibleWorkspaces}
                  activeWorkspaceId={state.activeWorkspaceId}
                  windowId={workspaceStore.getWindowId()}
                  groups={workspaceStore.getGroups()}
                  activeGroup={workspaceStore.getActiveGroup()}
                  archivedWorkspaces={archivedWorkspaces}
                  onSetActiveGroup={(group) => workspaceStore.setActiveGroup(group)}
                  onSetWorkspaceGroup={(id, group) => workspaceStore.setWorkspaceGroup(id, group)}
                  onSelectWorkspace={(id) => workspaceStore.setActiveWorkspace(id)}
                  onAddWorkspace={handleAddWorkspace}
                  onRemoveWorkspace={(id) => {
                    workspaceStore.removeWorkspace(id)
                    workspaceStore.save()
                  }}
                  onRenameWorkspace={(id, alias) => {
                    workspaceStore.renameWorkspace(id, alias)
                    workspaceStore.save()
                  }}
                  onReorderWorkspaces={(workspaceIds) => {
                    workspaceStore.reorderWorkspaces(workspaceIds)
                  }}
                  onArchiveWorkspace={(id) => workspaceStore.archiveWorkspace(id)}
                  onUnarchiveWorkspace={(id) => workspaceStore.unarchiveWorkspace(id)}
                  onOpenEnvVars={(workspaceId) => setEnvDialogWorkspaceId(workspaceId)}
                  onDetachWorkspace={handleDetachWorkspace}
                  activeProfileName={activeProfileName}
                  isRemoteConnected={isRemoteConnected}
                  onOpenProfiles={() => setShowProfiles(true)}
                  onOpenSettings={() => setShowSettings(true)}
                  onCollapse={handleSidebarCollapse}
                />
              </div>
              {/* Docked panels — lazy mounted, hidden when not active */}
              <Suspense fallback={<div className="loading-panel" />}>
                {leftDockedPanels.filter(p => mountedLeftPanels.has(p)).map(panel => (
                  <div key={panel} className="workspace-tab-content" style={{ display: leftPanelTab === panel ? undefined : 'none' }}>
                    {renderDockablePanel(panel)}
                  </div>
                ))}
              </Suspense>
            </div>
          </div>
          {!panelSettings.sidebar.collapsed && (
            <ResizeHandle
              direction="horizontal"
              onResize={handleSidebarResize}
              onDoubleClick={handleSidebarResetWidth}
            />
          )}
        </>
      ) : (
        <>
          <div style={{ display: panelSettings.sidebar.collapsed ? 'none' : undefined }}>
            <Sidebar
              width={panelSettings.sidebar.width}
              workspaces={visibleWorkspaces}
              activeWorkspaceId={state.activeWorkspaceId}
              windowId={workspaceStore.getWindowId()}
              groups={workspaceStore.getGroups()}
              activeGroup={workspaceStore.getActiveGroup()}
              archivedWorkspaces={archivedWorkspaces}
              onSetActiveGroup={(group) => workspaceStore.setActiveGroup(group)}
              onSetWorkspaceGroup={(id, group) => workspaceStore.setWorkspaceGroup(id, group)}
              onSelectWorkspace={(id) => workspaceStore.setActiveWorkspace(id)}
              onAddWorkspace={handleAddWorkspace}
              onRemoveWorkspace={(id) => {
                workspaceStore.removeWorkspace(id)
                workspaceStore.save()
              }}
              onRenameWorkspace={(id, alias) => {
                workspaceStore.renameWorkspace(id, alias)
                workspaceStore.save()
              }}
              onReorderWorkspaces={(workspaceIds) => {
                workspaceStore.reorderWorkspaces(workspaceIds)
              }}
              onArchiveWorkspace={(id) => workspaceStore.archiveWorkspace(id)}
              onUnarchiveWorkspace={(id) => workspaceStore.unarchiveWorkspace(id)}
              onOpenEnvVars={(workspaceId) => setEnvDialogWorkspaceId(workspaceId)}
              onDetachWorkspace={handleDetachWorkspace}
              activeProfileName={activeProfileName}
              isRemoteConnected={isRemoteConnected}
              onOpenProfiles={() => setShowProfiles(true)}
              onOpenSettings={() => setShowSettings(true)}
              onCollapse={handleSidebarCollapse}
            />
          </div>
          {!panelSettings.sidebar.collapsed && (
            <ResizeHandle
              direction="horizontal"
              onResize={handleSidebarResize}
              onDoubleClick={handleSidebarResetWidth}
            />
          )}
        </>
      )}
      <main className="main-content">
        {visibleWorkspaces.length > 0 ? (
          // Only mount workspaces that have been visited (lazy mount)
          visibleWorkspaces.filter(w => mountedWorkspaces.has(w.id)).map(workspace => (
            <div
              key={workspace.id}
              className={`workspace-container ${workspace.id === state.activeWorkspaceId ? 'active' : 'hidden'}`}
            >
              <WorkspaceView
                workspace={workspace}
                terminals={workspaceStore.getWorkspaceTerminals(workspace.id)}
                focusedTerminalId={workspace.id === state.activeWorkspaceId ? state.focusedTerminalId : null}
                isActive={workspace.id === state.activeWorkspaceId}
                isMaximized={panelSettings.maximized}
                onMaximizeToggle={handleMaximizeToggle}
                dockedPanels={mainDockedPanels}
                onDockPanel={handleDockPanel}
              />
            </div>
          ))
        ) : (
          <div className="empty-state">
            <h2>{t('app.welcome')}</h2>
            <p>{t('app.welcomeHint')}</p>
          </div>
        )}
      </main>
      {/* Resize handle for right sidebar */}
      {rightDockedPanels.length > 0 && !panelSettings.snippetSidebar.collapsed && (
        <ResizeHandle
          direction="horizontal"
          onResize={handleSnippetResize}
          onDoubleClick={handleSnippetResetWidth}
        />
      )}
      {/* Right sidebar: docking-config-driven panels — always rendered to preserve state */}
      {rightDockedPanels.length > 0 && (
        <>
          {/* Right sidebar collapsed bar — always rendered, hidden when expanded */}
          <div className="right-sidebar-collapsed" style={{ display: panelSettings.snippetSidebar.collapsed && !previewMarkdownPath ? undefined : 'none' }}>
            {rightDockedPanels.map(panel => (
              <button key={panel} className="right-sidebar-collapsed-btn" onClick={() => handleRightPanelTabChange(panel)} title={t(`workspace.${panel}`)}>
                {panel === 'snippets' ? '\u{1F4DD}' : panel === 'skills' ? '\u{26A1}' : panel === 'agents' ? '\u{1F916}' : panel === 'files' ? '\u{1F4C1}' : panel === 'git' ? '\u{1F500}' : panel === 'git-graph' ? '\u{1F4C8}' : panel === 'control-tower' ? '\u{1F5FC}' : '\u{1F310}'}
              </button>
            ))}
          </div>
          {/* Right sidebar expanded content — hidden when collapsed to preserve state */}
          {!previewMarkdownPath && (() => {
            const effectiveTab = rightDockedPanels.includes(rightPanelTab) ? rightPanelTab : rightDockedPanels[0]
            return (
              <div className="right-sidebar-wrapper" style={{ width: `${panelSettings.snippetSidebar.width}px`, minWidth: `${panelSettings.snippetSidebar.width}px`, display: panelSettings.snippetSidebar.collapsed ? 'none' : 'flex', flexDirection: 'column' as const }}>
                <div className="right-sidebar-tabs">
                  {rightDockedPanels.map(panel => (
                    <button
                      key={panel}
                      className={`right-sidebar-tab${effectiveTab === panel ? ' active' : ''}`}
                      onClick={() => handleRightPanelTabChange(panel)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSidebarTabCtxMenu({ x: e.clientX, y: e.clientY, panel, zone: 'right' })
                      }}
                    >
                      {t(`workspace.${panel}`)}
                    </button>
                  ))}
                  <button className="right-sidebar-collapse" onClick={handleSnippetCollapse} title={t('snippets.collapsePanel')}>&raquo;</button>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <Suspense fallback={<div className="loading-panel" />}>
                    {rightDockedPanels.filter(p => mountedRightPanels.has(p)).map(panel => (
                      <div key={panel} style={{ display: effectiveTab === panel ? undefined : 'none', height: '100%' }}>
                        {renderDockablePanel(panel)}
                      </div>
                    ))}
                  </Suspense>
                </div>
              </div>
            )
          })()}
        </>
      )}
      {/* Markdown preview mode: takes over the entire right panel */}
      {previewMarkdownPath && (
        <div className="right-sidebar-wrapper" style={{ width: `${panelSettings.snippetSidebar.width}px`, minWidth: `${panelSettings.snippetSidebar.width}px`, display: 'flex', flexDirection: 'column' as const }}>
          <MarkdownPreviewPanel
            filePath={previewMarkdownPath}
            onClose={() => {
              setPreviewMarkdownPath(null)
              if (previewPrevCollapsed.current !== null) {
                const wasCollapsed = previewPrevCollapsed.current
                previewPrevCollapsed.current = null
                if (wasCollapsed) {
                  setPanelSettings(prev => {
                    const updated = { ...prev, snippetSidebar: { ...prev.snippetSidebar, collapsed: true } }
                    savePanelSettings(updated)
                    return updated
                  })
                }
              }
            }}
          />
        </div>
      )}
      {/* Sidebar tab context menu (move between zones) */}
      {sidebarTabCtxMenu && createPortal(
        <div
          ref={sidebarCtxRef}
          className="context-menu"
          style={sidebarCtxPos
            ? { position: 'fixed', left: sidebarCtxPos.x, top: sidebarCtxPos.y, zIndex: 1000 }
            : { position: 'fixed', left: sidebarTabCtxMenu.x, top: sidebarTabCtxMenu.y, zIndex: 1000, visibility: 'hidden' as const }
          }
          onClick={e => e.stopPropagation()}
        >
          {sidebarTabCtxMenu.zone === 'left' ? (
            <>
              <button className="context-menu-item" onClick={() => { handleDockPanel(sidebarTabCtxMenu.panel, 'main'); setSidebarTabCtxMenu(null) }}>
                ↗ {t('workspace.moveToMain')}
              </button>
              <button className="context-menu-item" onClick={() => { handleDockPanel(sidebarTabCtxMenu.panel, 'right'); setSidebarTabCtxMenu(null) }}>
                → {t('workspace.moveToRight')}
              </button>
            </>
          ) : (
            <>
              <button className="context-menu-item" onClick={() => { handleDockPanel(sidebarTabCtxMenu.panel, 'left'); setSidebarTabCtxMenu(null) }}>
                ← {t('workspace.moveToLeft')}
              </button>
              <button className="context-menu-item" onClick={() => { handleDockPanel(sidebarTabCtxMenu.panel, 'main'); setSidebarTabCtxMenu(null) }}>
                ↗ {t('workspace.moveToMain')}
              </button>
            </>
          )}
        </div>,
        document.body
      )}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
      {showProfiles && (
        <ProfilePanel
          onClose={() => setShowProfiles(false)}
          onSwitchNewWindow={handleProfileNewWindow}
          onProfileRenamed={async (profileId, newName) => {
            const wpId = await window.electronAPI.app.getWindowProfile()
            if (wpId === profileId) {
              const winIdx = await window.electronAPI.app.getWindowIndex()
              setActiveProfileName(`${newName}:${winIdx}`)
            }
          }}
        />
      )}
      {envDialogWorkspace && (
        <WorkspaceEnvDialog
          workspace={envDialogWorkspace}
          onAdd={(envVar: EnvVariable) => workspaceStore.addWorkspaceEnvVar(envDialogWorkspaceId!, envVar)}
          onRemove={(key: string) => workspaceStore.removeWorkspaceEnvVar(envDialogWorkspaceId!, key)}
          onUpdate={(key: string, updates: Partial<EnvVariable>) => workspaceStore.updateWorkspaceEnvVar(envDialogWorkspaceId!, key, updates)}
          onClose={() => setEnvDialogWorkspaceId(null)}
        />
      )}
      {appNotification && (
        <div className="app-notification-overlay" onClick={() => setAppNotification(null)}>
          <div className="app-notification" onClick={e => e.stopPropagation()}>
            <div className="app-notification-message">{appNotification}</div>
            <button className="app-notification-close" onClick={() => setAppNotification(null)}>{t('common.ok')}</button>
          </div>
        </div>
      )}
      {recoveryInfo && (
        <RecoveryPrompt
          ptyCount={recoveryInfo.ptyCount}
          onRecover={() => {
            window.electronAPI.terminalServer.recover()
            setRecoveryInfo(null)
          }}
          onFreshStart={() => {
            window.electronAPI.terminalServer.freshStart()
            setRecoveryInfo(null)
          }}
        />
      )}
      {serverStatusToast && (
        <div className="server-status-toast" onClick={() => setServerStatusToast(null)}>
          {serverStatusToast}
        </div>
      )}
      {notifyToasts.length > 0 && (
        <div className="bat-notify-toast-stack">
          {notifyToasts.map(toast => (
            <div
              key={toast.id}
              className="bat-notify-toast"
              onClick={() => setNotifyToasts(prev => prev.filter(t => t.id !== toast.id))}
            >
              {toast.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
