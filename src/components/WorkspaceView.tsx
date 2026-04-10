import { useEffect, useCallback, useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import type { Workspace, TerminalInstance, EnvVariable } from '../types'
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
const GitHubPanel = lazy(() => import('./GitHubPanel').then(m => ({ default: m.GitHubPanel })))

type WorkspaceTab = 'terminal' | 'files' | 'git' | 'github'
const TAB_KEY = 'better-terminal-workspace-tab'

function loadWorkspaceTab(): WorkspaceTab {
  try {
    const saved = localStorage.getItem(TAB_KEY)
    if (saved === 'terminal' || saved === 'files' || saved === 'git' || saved === 'github') return saved
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

interface SplitSettings {
  terminalId: string | null
  ratio: number
}

function loadSplitSettings(): SplitSettings {
  try {
    const saved = localStorage.getItem(SPLIT_SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { terminalId: parsed.terminalId ?? null, ratio: parsed.ratio ?? DEFAULT_SPLIT_RATIO }
    }
  } catch { /* ignore */ }
  return { terminalId: null, ratio: DEFAULT_SPLIT_RATIO }
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

export function WorkspaceView({ workspace, terminals, focusedTerminalId, isActive, isMaximized, onMaximizeToggle }: Readonly<WorkspaceViewProps>) {
  const { t } = useTranslation()
  const [showCloseConfirm, setShowCloseConfirm] = useState<string | null>(null)
  const [thumbnailSettings, setThumbnailSettings] = useState<ThumbnailSettings>(loadThumbnailSettings)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(loadWorkspaceTab)
  const [hasGithubRemote, setHasGithubRemote] = useState(false)
  const [isGitRepo, setIsGitRepo] = useState(false)
  const [agentDefinitions, setAgentDefinitions] = useState<AgentDefinition[]>([])
  const [splitSettings, setSplitSettings] = useState<SplitSettings>(loadSplitSettings)

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

  const handleTabChange = useCallback((tab: WorkspaceTab) => {
    setActiveTab(tab)
    try { localStorage.setItem(TAB_KEY, tab) } catch { /* ignore */ }
  }, [])

  // Listen for keyboard shortcut events to cycle/switch tabs
  useEffect(() => {
    if (!isActive) return

    const TABS: WorkspaceTab[] = hasGithubRemote ? ['terminal', 'files', 'git', 'github'] : ['terminal', 'files', 'git']

    const handleCycleTab = (e: Event) => {
      const { direction } = (e as CustomEvent).detail as { direction: number }
      setActiveTab(prev => {
        const idx = TABS.indexOf(prev)
        const next = TABS[(idx + direction + TABS.length) % TABS.length]
        try { localStorage.setItem(TAB_KEY, next) } catch { /* ignore */ }
        return next
      })
    }

    const handleSwitchTab = (e: Event) => {
      const { tab } = (e as CustomEvent).detail as { tab: WorkspaceTab }
      setActiveTab(tab)
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

  // Listen for maximize-toggle to collapse/restore thumbnail bar
  useEffect(() => {
    if (!isActive) return
    const handler = () => {
      setThumbnailSettings(prev => {
        const updated = { ...prev, collapsed: !prev.collapsed }
        saveThumbnailSettings(updated)
        return updated
      })
    }
    window.addEventListener('maximize-toggle', handler)
    return () => window.removeEventListener('maximize-toggle', handler)
  }, [isActive])

  // Split view handlers
  const handleSplitTerminal = useCallback((terminalId: string) => {
    setSplitSettings(prev => {
      // If already split with this terminal, unsplit
      const updated: SplitSettings = prev.terminalId === terminalId
        ? { ...prev, terminalId: null }
        : { ...prev, terminalId: terminalId }
      saveSplitSettings(updated)
      return updated
    })
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  const handleUnsplit = useCallback(() => {
    setSplitSettings(prev => {
      const updated: SplitSettings = { ...prev, terminalId: null }
      saveSplitSettings(updated)
      return updated
    })
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }, [])

  const handleSplitResize = useCallback((delta: number) => {
    setSplitSettings(prev => {
      // delta is positive when dragging right (left pane gets bigger)
      // Convert pixel delta to ratio delta based on container width
      const container = document.querySelector('.terminals-container')
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

  // Clear split if the split terminal was removed
  useEffect(() => {
    if (splitSettings.terminalId && !terminals.find(t => t.id === splitSettings.terminalId)) {
      handleUnsplit()
    }
  }, [terminals, splitSettings.terminalId, handleUnsplit])

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
            window.electronAPI.agent?.buildLaunchCommand(terminal.agentPreset).then((cmd: string | null) => {
              if (cmd) {
                setTimeout(() => {
                  window.electronAPI.pty.write(terminal.id, cmd + '\r')
                }, 500)
              } else if (settings.agentAutoCommand) {
                const preset = getAgentPreset(terminal.agentPreset!)
                if (preset?.command) {
                  setTimeout(() => {
                    window.electronAPI.pty.write(terminal.id, preset.command + '\r')
                  }, 500)
                }
              }
            }).catch(() => {
              if (settings.agentAutoCommand) {
                const preset = getAgentPreset(terminal.agentPreset!)
                if (preset?.command) {
                  setTimeout(() => {
                    window.electronAPI.pty.write(terminal.id, preset.command + '\r')
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
              window.electronAPI.agent?.buildLaunchCommand(defaultAgent).then((cmd: string | null) => {
                if (cmd) {
                  setTimeout(() => {
                    window.electronAPI.pty.write(agentTerminal.id, cmd + '\r')
                  }, 500)
                } else {
                  const preset = getAgentPreset(defaultAgent)
                  if (preset?.command) {
                    setTimeout(() => {
                      window.electronAPI.pty.write(agentTerminal.id, preset.command + '\r')
                    }, 500)
                  }
                }
              }).catch(() => {
                const preset = getAgentPreset(defaultAgent)
                if (preset?.command) {
                  setTimeout(() => {
                    window.electronAPI.pty.write(agentTerminal.id, preset.command + '\r')
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
    try {
      const launchCmd = await window.electronAPI.agent.buildLaunchCommand(definitionId)
      if (launchCmd) {
        setTimeout(() => {
          window.electronAPI.pty.write(terminal.id, launchCmd + '\r')
        }, 500)
        return
      }
    } catch { /* fallback below */ }

    // Fallback to preset command
    if (settings.agentAutoCommand) {
      const agentPreset = getAgentPreset(definitionId)
      if (agentPreset?.command) {
        setTimeout(() => {
          window.electronAPI.pty.write(terminal.id, agentPreset.command + '\r')
        }, 500)
      }
    }
  }, [workspace.id, workspace.folderPath, workspace.envVars, startClaudeCliPty, agentDefinitions])

  const isDebugMode = window.electronAPI?.debug?.isDebugMode

  const handleCloseTerminal = useCallback((id: string) => {
    const terminal = terminals.find(t => t.id === id)
    // Show confirm for agent terminals
    if (terminal?.agentPreset && terminal.agentPreset !== 'none') {
      setShowCloseConfirm(id)
    } else {
      // Regular terminals always use PTY
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
          try {
            const launchCmd = await window.electronAPI.agent.buildLaunchCommand(terminal.agentPreset)
            if (launchCmd) {
              setTimeout(() => {
                window.electronAPI.pty.write(id, launchCmd + '\r')
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

  // Split view: secondary terminal shown alongside mainTerminal
  const splitTerminal = splitSettings.terminalId ? terminals.find(t => t.id === splitSettings.terminalId) : null
  // Don't split with itself
  const isSplit = splitTerminal && splitTerminal.id !== mainTerminal?.id

  // Send content to the active Claude agent session
  const handleSendToClaude = useCallback(async (content: string) => {
    if (!agentTerminal) return false
    await window.electronAPI.claude.sendMessage(agentTerminal.id, content)
    handleTabChange('terminal')
    workspaceStore.setFocusedTerminal(agentTerminal.id)
    return true
  }, [agentTerminal, handleTabChange])

  // Show all terminals in thumbnail bar (clicking switches focus)
  const thumbnailTerminals = terminals

  return (
    <div className="workspace-view">
      {/* Top tab bar: Terminal | Files | Git | GitHub */}
      <div className="workspace-tab-bar">
        <button
          className={`workspace-tab-btn ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => handleTabChange('terminal')}
        >
          {t('workspace.terminal')}
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => handleTabChange('files')}
        >
          {t('workspace.files')}
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'git' ? 'active' : ''}`}
          onClick={() => handleTabChange('git')}
        >
          {t('workspace.git')}
        </button>
        {hasGithubRemote && (
          <button
            className={`workspace-tab-btn ${activeTab === 'github' ? 'active' : ''}`}
            onClick={() => handleTabChange('github')}
          >
            {t('workspace.github')}
          </button>
        )}
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

      {/* Main content area - terminals always rendered (keep processes alive) */}
      <Suspense fallback={<div className="loading-panel" />}>
        <div className={`terminals-container${isSplit ? ' split-view' : ''} ${activeTab !== 'terminal' ? 'hidden' : ''}`}>
          {isSplit ? (
            <>
              {/* Left pane — focused terminal */}
              <div className="split-pane split-pane-left" style={{ flex: `0 0 ${splitSettings.ratio * 100}%` }}>
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
              </div>
              <ResizeHandle
                direction="horizontal"
                onResize={handleSplitResize}
                onDoubleClick={handleSplitResetRatio}
              />
              {/* Right pane — split terminal */}
              <div className="split-pane split-pane-right" style={{ flex: 1 }}>
                <div className="terminal-wrapper active">
                  <MainPanel
                    terminal={splitTerminal}
                    isActive={isActive && activeTab === 'terminal'}
                    onClose={handleCloseTerminal}
                    onRestart={handleRestart}
                    onSwitchApiVersion={handleSwitchApiVersion}
                    workspaceId={workspace.id}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
          {/* Worker panel — visible when active terminal is supervisor */}
          {mainTerminal?.role === 'supervisor' && activeTab === 'terminal' && (
            <WorkerPanel
              workers={terminals.filter(t => t.id !== mainTerminal.id)}
              onSendToWorker={handleSendToWorker}
              onFocusWorker={handleFocus}
            />
          )}
        </div>
      </Suspense>

      {activeTab === 'files' && (
        <Suspense fallback={<div className="loading-panel" />}>
          <div className="workspace-tab-content">
            <FileTree rootPath={workspace.folderPath} />
          </div>
        </Suspense>
      )}

      {activeTab === 'git' && (
        <Suspense fallback={<div className="loading-panel" />}>
          <div className="workspace-tab-content">
            <GitPanel
              workspaceFolderPath={workspace.folderPath}
              worktreePaths={terminals
                .filter(t => t.agentPreset === 'claude-code-worktree' && t.worktreePath)
                .map(t => ({ path: t.worktreePath!, branch: t.worktreeBranch || 'worktree' }))
              }
            />
          </div>
        </Suspense>
      )}

      {activeTab === 'github' && hasGithubRemote && (
        <Suspense fallback={<div className="loading-panel" />}>
          <div className="workspace-tab-content">
            <GitHubPanel workspaceFolderPath={workspace.folderPath} onSendToClaude={handleSendToClaude} />
          </div>
        </Suspense>
      )}

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
        splitTerminalId={splitSettings.terminalId}
        onFocus={handleFocus}
        onSplitTerminal={handleSplitTerminal}
        onAddTerminal={handleAddTerminal}
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
