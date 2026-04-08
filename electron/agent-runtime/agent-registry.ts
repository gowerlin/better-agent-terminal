/**
 * Agent Registry — Central registry for all agent definitions and providers.
 *
 * This replaces the hardcoded agent-presets approach with a dynamic registry
 * that supports built-in providers and user-defined custom CLIs.
 */

import type { AgentDefinition, AgentProvider, AgentCapabilities, CustomCliDefinition } from './types'

// ── Default Capabilities ───────────────────────────────────────────
const TERMINAL_DRIVEN_CAPABILITIES: AgentCapabilities = {
  canStreamMessages: false,
  canShowStructuredToolCalls: false,
  canRequestApproval: false,
  canAttachImages: false,
  canResume: false,
  canFork: false,
  canSwitchModel: false,
  canShowUsage: false,
  canShowSubtasks: false,
}

const CLAUDE_SDK_CAPABILITIES: AgentCapabilities = {
  canStreamMessages: true,
  canShowStructuredToolCalls: true,
  canRequestApproval: true,
  canAttachImages: true,
  canResume: true,
  canFork: true,
  canSwitchModel: true,
  canShowUsage: true,
  canShowSubtasks: true,
}

// ── Built-in Agent Definitions ─────────────────────────────────────
const BUILTIN_DEFINITIONS: AgentDefinition[] = [
  {
    id: 'claude-code',
    name: 'Claude Agent V1',
    icon: '✦',
    color: '#d97706',
    providerId: 'claude-sdk',
    providerMode: 'integrated',
    supportsWorktree: true,
    supportsStructuredEvents: true,
    supportsImages: true,
    supportsResume: true,
    supportsModelSelection: true,
    supportsApprovalFlow: true,
    supportsSandbox: false,
    supportsYolo: true,
    suggested: true,
  },
  {
    id: 'claude-code-v2',
    name: 'Claude Agent V2',
    icon: '✦',
    color: '#eab308',
    providerId: 'claude-sdk',
    providerMode: 'integrated',
    supportsWorktree: false,
    supportsStructuredEvents: true,
    supportsImages: true,
    supportsResume: true,
    supportsModelSelection: true,
    supportsApprovalFlow: true,
    supportsSandbox: false,
    supportsYolo: true,
  },
  {
    id: 'claude-code-worktree',
    name: 'Claude Agent V1 (Worktree)',
    icon: '🌳',
    color: '#22c55e',
    providerId: 'claude-sdk',
    providerMode: 'integrated',
    supportsWorktree: true,
    supportsStructuredEvents: true,
    supportsImages: true,
    supportsResume: true,
    supportsModelSelection: true,
    supportsApprovalFlow: true,
    supportsSandbox: false,
    supportsYolo: true,
    debug: true,
  },
  {
    id: 'claude-cli',
    name: 'Claude CLI',
    icon: '▶',
    color: '#d97706',
    providerId: 'claude-cli',
    providerMode: 'terminal-driven',
    defaultCommand: 'claude',
    supportsWorktree: true,
    supportsStructuredEvents: false,
    supportsImages: false,
    supportsResume: false,
    supportsModelSelection: false,
    supportsApprovalFlow: false,
    supportsSandbox: false,
    supportsYolo: true,
    suggested: true,
  },
  {
    id: 'claude-cli-worktree',
    name: 'Claude CLI (Worktree)',
    icon: '▶🌳',
    color: '#22c55e',
    providerId: 'claude-cli',
    providerMode: 'terminal-driven',
    defaultCommand: 'claude',
    supportsWorktree: true,
    supportsStructuredEvents: false,
    supportsImages: false,
    supportsResume: false,
    supportsModelSelection: false,
    supportsApprovalFlow: false,
    supportsSandbox: false,
    supportsYolo: true,
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    icon: '⬡',
    color: '#10a37f',
    providerId: 'codex-cli',
    providerMode: 'terminal-driven',
    defaultCommand: 'codex',
    supportsWorktree: true,
    supportsStructuredEvents: false,
    supportsImages: false,
    supportsResume: false,
    supportsModelSelection: true,
    supportsApprovalFlow: true,
    supportsSandbox: true,
    supportsYolo: true,
    suggested: true,
    launchOptions: [
      {
        key: 'approval-mode',
        label: 'Approval Mode',
        type: 'select',
        options: [
          { value: 'suggest', label: 'Suggest (safest)' },
          { value: 'auto-edit', label: 'Auto Edit (allow file edits)' },
          { value: 'full-auto', label: 'Full Auto (YOLO mode)' },
        ],
        defaultValue: 'suggest',
      },
      {
        key: 'sandbox',
        label: 'Sandbox',
        type: 'select',
        options: [
          { value: 'true', label: 'Enabled (recommended)' },
          { value: 'false', label: 'Disabled' },
        ],
        defaultValue: 'true',
      },
    ],
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    icon: '◇',
    color: '#4285f4',
    providerId: 'gemini-cli',
    providerMode: 'terminal-driven',
    defaultCommand: 'gemini',
    supportsWorktree: false,
    supportsStructuredEvents: false,
    supportsImages: false,
    supportsResume: false,
    supportsModelSelection: false,
    supportsApprovalFlow: false,
    supportsSandbox: true,
    supportsYolo: true,
    suggested: true,
    launchOptions: [
      {
        key: 'sandbox',
        label: 'Sandbox',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'yolo',
        label: 'YOLO Mode (auto-approve)',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  },
  {
    id: 'copilot-cli',
    name: 'GitHub Copilot CLI',
    icon: '⬢',
    color: '#6e40c9',
    providerId: 'copilot-cli',
    providerMode: 'terminal-driven',
    defaultCommand: 'gh',
    defaultArgs: ['copilot'],
    supportsWorktree: false,
    supportsStructuredEvents: false,
    supportsImages: false,
    supportsResume: false,
    supportsModelSelection: false,
    supportsApprovalFlow: false,
    supportsSandbox: false,
    supportsYolo: false,
    suggested: true,
  },
  {
    id: 'none',
    name: 'Terminal',
    icon: '⌘',
    color: '#888888',
    providerId: 'none',
    providerMode: 'terminal-driven',
    supportsWorktree: false,
    supportsStructuredEvents: false,
    supportsImages: false,
    supportsResume: false,
    supportsModelSelection: false,
    supportsApprovalFlow: false,
    supportsSandbox: false,
    supportsYolo: false,
  },
]

// ── Agent Registry ─────────────────────────────────────────────────
class AgentRegistry {
  private definitions: Map<string, AgentDefinition> = new Map()
  private providers: Map<string, AgentProvider> = new Map()
  private customClis: Map<string, CustomCliDefinition> = new Map()

  constructor() {
    // Register all built-in definitions
    for (const def of BUILTIN_DEFINITIONS) {
      this.definitions.set(def.id, def)
    }
  }

  // ── Definition Management ────────────────────────────────────────

  getDefinition(id: string): AgentDefinition | undefined {
    return this.definitions.get(id)
  }

  /** Alias for getDefinition — used by IPC handlers */
  get(id: string): AgentDefinition | undefined {
    return this.getDefinition(id)
  }

  getAllDefinitions(): AgentDefinition[] {
    return Array.from(this.definitions.values())
  }

  /** Alias for getAllDefinitions — used by IPC handlers */
  listAll(): AgentDefinition[] {
    return this.getAllDefinitions()
  }

  getVisibleDefinitions(isDebugMode: boolean): AgentDefinition[] {
    return this.getAllDefinitions().filter(d => !d.debug || isDebugMode)
  }

  // ── Provider Management ──────────────────────────────────────────

  registerProvider(provider: AgentProvider): void {
    this.providers.set(provider.id, provider)
  }

  getProvider(id: string): AgentProvider | undefined {
    return this.providers.get(id)
  }

  getAllProviders(): AgentProvider[] {
    return Array.from(this.providers.values())
  }

  // ── Custom CLI Management ────────────────────────────────────────

  registerCustomCli(def: CustomCliDefinition): AgentDefinition {
    this.customClis.set(def.id, def)

    const agentDef: AgentDefinition = {
      id: def.id,
      name: def.name,
      icon: def.icon,
      color: def.color,
      providerId: 'generic-cli',
      providerMode: 'terminal-driven',
      defaultCommand: def.command,
      defaultArgs: def.args,
      supportsWorktree: def.supportsWorktree ?? false,
      supportsStructuredEvents: false,
      supportsImages: false,
      supportsResume: false,
      supportsModelSelection: false,
      supportsApprovalFlow: false,
      supportsSandbox: !!def.sandboxFlag,
      supportsYolo: !!def.yoloFlag,
    }

    this.definitions.set(agentDef.id, agentDef)
    return agentDef
  }

  removeCustomCli(id: string): boolean {
    const existed = this.customClis.has(id)
    this.customClis.delete(id)
    this.definitions.delete(id)
    return existed
  }

  getCustomCli(id: string): CustomCliDefinition | undefined {
    return this.customClis.get(id)
  }

  getAllCustomClis(): CustomCliDefinition[] {
    return Array.from(this.customClis.values())
  }

  /** Alias for getAllCustomClis — used by IPC handlers */
  listCustomClis(): CustomCliDefinition[] {
    return this.getAllCustomClis()
  }

  // ── Capability Queries ───────────────────────────────────────────

  getCapabilities(definitionId: string): AgentCapabilities {
    const def = this.definitions.get(definitionId)
    if (!def) return TERMINAL_DRIVEN_CAPABILITIES

    if (def.providerMode === 'integrated') {
      return CLAUDE_SDK_CAPABILITIES
    }

    return {
      ...TERMINAL_DRIVEN_CAPABILITIES,
      canAttachImages: def.supportsImages,
      canResume: def.supportsResume,
      canSwitchModel: def.supportsModelSelection,
      canRequestApproval: def.supportsApprovalFlow,
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  isIntegrated(definitionId: string): boolean {
    const def = this.definitions.get(definitionId)
    return def?.providerMode === 'integrated'
  }

  isClaudeSdk(definitionId: string): boolean {
    return definitionId === 'claude-code' || definitionId === 'claude-code-v2' || definitionId === 'claude-code-worktree'
  }

  isClaudeCli(definitionId: string): boolean {
    return definitionId === 'claude-cli' || definitionId === 'claude-cli-worktree'
  }

  isTerminalDriven(definitionId: string): boolean {
    const def = this.definitions.get(definitionId)
    return def?.providerMode === 'terminal-driven'
  }

  /** Build the CLI command string for a terminal-driven agent */
  buildLaunchCommand(definitionId: string, options?: Record<string, string | boolean>): string | null {
    const def = this.definitions.get(definitionId)
    if (!def || def.providerMode === 'integrated' || def.id === 'none') return null

    // For claude-cli, the command is built separately via bundled CLI path
    if (this.isClaudeCli(definitionId)) return null

    const parts: string[] = []

    // Check for custom CLI
    const customCli = this.customClis.get(definitionId)
    if (customCli) {
      parts.push(customCli.command)
      if (customCli.args) parts.push(...customCli.args)
    } else {
      if (def.defaultCommand) parts.push(def.defaultCommand)
      if (def.defaultArgs) parts.push(...def.defaultArgs)
    }

    // Apply launch options
    if (options && def.launchOptions) {
      for (const opt of def.launchOptions) {
        const val = options[opt.key]
        if (val === undefined) continue

        if (definitionId === 'codex-cli') {
          if (opt.key === 'approval-mode' && typeof val === 'string') {
            parts.push(`--approval-mode=${val}`)
          }
          if (opt.key === 'sandbox') {
            if (val === 'false' || val === false) parts.push('--no-sandbox')
          }
        } else if (definitionId === 'gemini-cli') {
          if (opt.key === 'sandbox' && (val === true || val === 'true')) {
            parts.push('--sandbox')
          }
          if (opt.key === 'yolo' && (val === true || val === 'true')) {
            parts.push('--yolo')
          }
        }
      }
    }

    // Apply generic sandbox/yolo flags for custom CLIs
    if (customCli && options) {
      if (options['sandbox'] && customCli.sandboxFlag) {
        parts.push(customCli.sandboxFlag)
      }
      if (options['yolo'] && customCli.yoloFlag) {
        parts.push(customCli.yoloFlag)
      }
    }

    return parts.length > 0 ? parts.join(' ') : null
  }
}

// ── Singleton ──────────────────────────────────────────────────────
export const agentRegistry = new AgentRegistry()
