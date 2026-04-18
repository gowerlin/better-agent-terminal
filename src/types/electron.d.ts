import type { CreatePtyOptions } from './index'
import type {
  WhisperModelSize,
  VoiceLanguage,
  VoiceModelInfo,
  VoicePreferences,
  VoiceTranscribeOptions,
  VoiceTranscribeResult,
  VoiceModelDownloadProgress,
} from './voice'

interface ElectronAPI {
  platform: 'win32' | 'darwin' | 'linux'
  pty: {
    create: (options: CreatePtyOptions) => Promise<boolean>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    kill: (id: string) => Promise<boolean>
    restart: (id: string, cwd: string, shell?: string) => Promise<boolean>
    getCwd: (id: string) => Promise<string | null>
    createWithCommand: (opts: { id: string; cwd: string; command: string; shell?: string; customEnv?: Record<string, string>; workspaceId?: string }) => Promise<boolean>
    onOutput: (callback: (id: string, data: string) => void) => () => void
    onExit: (callback: (id: string, exitCode: number) => void) => () => void
    onCreatedExternally: (callback: (info: { id: string; cwd: string; command?: string; workspaceId?: string }) => void) => () => void
    onTerminalNotified: (callback: (info: { targetId: string; message: string; source?: string }) => void) => () => void
  }
  workspace: {
    save: (data: string) => Promise<boolean>
    load: () => Promise<string | null>
    moveToWindow: (sourceWindowId: string, targetWindowId: string, workspaceId: string, insertIndex: number) => Promise<boolean>
    onReload: (callback: () => void) => () => void
    onFlushSave: (callback: () => Promise<void>) => () => void
  }
  settings: {
    save: (data: string) => Promise<boolean>
    load: () => Promise<string | null>
    getShellPath: (shell: string) => Promise<string>
    getLoggingInfo: () => Promise<{
      logsDir: string
      currentLogFilePath: string | null
      loggingEnabled: boolean
      logLevel: 'error' | 'warn' | 'info' | 'log' | 'debug'
      crashesDir: string
    }>
    cleanupLogs: () => Promise<{ deletedCount: number }>
  }
  dialog: {
    selectFolder: () => Promise<string[] | null>
  }
  clipboard: {
    saveImage: () => Promise<string | null>
    writeImage: (filePath: string) => Promise<boolean>
  }
  app: {
    openNewInstance: (profileId: string) => Promise<{ alreadyOpen: boolean; windowId?: string; windowIds?: string[] }>
    getLaunchProfile: () => Promise<string | null>
  }
  tunnel: {
    getConnection: () => Promise<{ url: string; token: string; fingerprint: string; mode: string; addresses: { ip: string; mode: string; label: string }[] } | { error: string }>
  }
  debug: {
    log: (...args: unknown[]) => void
    writeRenderer: (level: 'error' | 'warn' | 'info' | 'log' | 'debug', args: unknown[]) => void
    isDebugMode: boolean
  }
  shell: {
    openExternal: (url: string) => Promise<void>
    openPath: (folderPath: string) => Promise<void>
    openInEditor: (folderPath: string, editorType: 'code' | 'code-insiders', customPath?: string) => Promise<{ success: boolean; error?: { type: string; executable: string; message: string } }>
  }
  git: {
    getGithubUrl: (folderPath: string) => Promise<string | null>
    getBranch: (cwd: string) => Promise<string | null>
    getLog: (cwd: string, count?: number) => Promise<{ hash: string; author: string; date: string; message: string }[]>
    getDiff: (cwd: string, commitHash?: string, filePath?: string) => Promise<string>
    getDiffFiles: (cwd: string, commitHash?: string) => Promise<{ path: string; status: string }[]>
    getStatus: (cwd: string) => Promise<{ path: string; status: string }[]>
    getRoot: (cwd: string) => Promise<string | null>
  }
  // Phase 3 Tα1 scaffold (T0155) — simple-git backed channels
  gitScaffold: {
    healthCheck: (cwd: string) => Promise<{
      ok: boolean
      isRepo: boolean
      gitRoot: string | null
      error?: string
    }>
    getRepoInfo: (cwd: string) => Promise<{
      ok: boolean
      head: string | null
      branch: string | null
      detached: boolean
      remotes: Array<{ name: string; url: string }>
      gitRoot: string | null
      error?: string
    }>
    listCommits: (cwd: string, options?: { limit?: number; offset?: number }) => Promise<{
      ok: boolean
      commits: Array<{
        hash: string
        abbrevHash: string
        parents: string[]
        authorName: string
        authorEmail: string
        date: string
        subject: string
      }>
      error?: string
    }>
  }
  github: {
    checkCli: () => Promise<{ installed: boolean; authenticated: boolean }>
    listPRs: (cwd: string) => Promise<unknown>
    listIssues: (cwd: string) => Promise<unknown>
    viewPR: (cwd: string, number: number) => Promise<unknown>
    viewIssue: (cwd: string, number: number) => Promise<unknown>
    commentPR: (cwd: string, number: number, body: string) => Promise<{ success: true } | { error: string }>
    commentIssue: (cwd: string, number: number, body: string) => Promise<{ success: true } | { error: string }>
  }
  agent: {
    listDefinitions: () => Promise<import('./agent-runtime').AgentDefinition[]>
    getDefinition: (id: string) => Promise<import('./agent-runtime').AgentDefinition | null>
    buildLaunchCommand: (definitionId: string, options?: Record<string, string | boolean>) => Promise<string | null>
    registerCustomCli: (def: import('./agent-runtime').CustomCliDefinition) => Promise<import('./agent-runtime').AgentDefinition>
    removeCustomCli: (id: string) => Promise<boolean>
    listCustomClis: () => Promise<import('./agent-runtime').CustomCliDefinition[]>
    saveCustomClis: () => Promise<boolean>
    loadCustomClis: () => Promise<boolean>
  }
  supervisor: {
    listWorkers: (terminalIds: string[]) => Promise<{ id: string; lastOutput: string; alive: boolean }[]>
    sendToWorker: (targetId: string, text: string) => Promise<boolean>
    getWorkerOutput: (targetId: string, lines: number) => Promise<string[]>
  }
  claude: {
    startSession: (sessionId: string, options: { cwd: string; prompt?: string; permissionMode?: string; model?: string; effort?: string; apiVersion?: 'v1' | 'v2'; useWorktree?: boolean; worktreePath?: string; worktreeBranch?: string }) => Promise<void>
    sendMessage: (sessionId: string, prompt: string, images?: string[]) => Promise<void>
    stopSession: (sessionId: string) => Promise<void>
    onMessage: (callback: (sessionId: string, message: unknown) => void) => () => void
    onToolUse: (callback: (sessionId: string, toolCall: unknown) => void) => () => void
    onToolResult: (callback: (sessionId: string, result: unknown) => void) => () => void
    onResult: (callback: (sessionId: string, result: unknown) => void) => () => void
    onError: (callback: (sessionId: string, error: string) => void) => () => void
    onStream: (callback: (sessionId: string, data: unknown) => void) => () => void
    onStatus: (callback: (sessionId: string, meta: unknown) => void) => () => void
    onModeChange: (callback: (sessionId: string, mode: string) => void) => () => void
    setPermissionMode: (sessionId: string, mode: string) => Promise<void>
    setModel: (sessionId: string, model: string) => Promise<void>
    setEffort: (sessionId: string, effort: string) => Promise<void>
    resetSession: (sessionId: string) => Promise<void>
    getSupportedModels: (sessionId: string) => Promise<unknown>
    getAccountInfo: (sessionId: string) => Promise<{ email?: string; organization?: string; subscriptionType?: string } | null>
    getSupportedCommands: (sessionId: string) => Promise<{ name: string; description: string; argumentHint: string }[]>
    getSupportedAgents: (sessionId: string) => Promise<{ name: string; description: string; model?: string }[]>
    getWorktreeStatus: (sessionId: string) => Promise<{ diff: string; branchName: string; worktreePath: string; sourceBranch: string } | null>
    cleanupWorktree: (sessionId: string, deleteBranch: boolean) => Promise<boolean>
    scanSkills: (cwd: string) => Promise<{ name: string; description: string; scope: 'project' | 'global' }[]>
    scanStarCommands: () => Promise<{ name: string; description: string; prefix: 'ct' | 'gsd' }[]>
    getStatuslineExtras: () => Promise<{
      accountLabel?: string; planLabel?: string
      memsync?: { status: string; queueSize: number; age: string }
      rateLimits?: { five_hour?: { used_percentage: number; resets_at: number }; seven_day?: { used_percentage: number; resets_at: number } }
    }>
    getSessionMeta: (sessionId: string) => Promise<Record<string, unknown> | null>
    getContextUsage: (sessionId: string) => Promise<{
      categories: { name: string; tokens: number; color: string; isDeferred?: boolean }[]
      totalTokens: number
      maxTokens: number
      percentage: number
      model: string
      memoryFiles?: { path: string; type: string; tokens: number }[]
      mcpTools?: { name: string; serverName: string; tokens: number; isLoaded?: boolean }[]
    } | null>
    getCliPath: () => Promise<string>
    authStatus: () => Promise<{ loggedIn: boolean; email?: string; subscriptionType?: string; authMethod?: string } | null>
    authLogout: () => Promise<{ success: boolean; error?: string }>
    resolvePermission: (sessionId: string, toolUseId: string, result: { behavior: string; updatedInput?: Record<string, unknown>; updatedPermissions?: unknown[]; message?: string; dontAskAgain?: boolean }) => Promise<void>
    resolveAskUser: (sessionId: string, toolUseId: string, answers: Record<string, string>) => Promise<void>
    listSessions: (cwd: string) => Promise<unknown>
    resumeSession: (sessionId: string, sdkSessionId: string, cwd: string, model?: string, apiVersion?: 'v1' | 'v2', useWorktree?: boolean, worktreePath?: string, worktreeBranch?: string) => Promise<void>
    forkSession: (sessionId: string) => Promise<{ newSdkSessionId: string } | null>
    stopTask: (sessionId: string, taskId: string) => Promise<boolean>
    restSession: (sessionId: string) => Promise<boolean>
    wakeSession: (sessionId: string) => Promise<boolean>
    isResting: (sessionId: string) => Promise<boolean>
    fetchSubagentMessages: (sessionId: string, agentToolUseId: string) => Promise<unknown[]>
    archiveMessages: (sessionId: string, messages: unknown[]) => Promise<boolean>
    loadArchived: (sessionId: string, offset: number, limit: number) => Promise<{ messages: unknown[]; total: number; hasMore: boolean }>
    clearArchive: (sessionId: string) => Promise<boolean>
    onHistory: (callback: (sessionId: string, items: unknown[]) => void) => () => void
    onPermissionRequest: (callback: (sessionId: string, data: unknown) => void) => () => void
    onAskUser: (callback: (sessionId: string, data: unknown) => void) => () => void
    onAskUserResolved: (callback: (sessionId: string, toolUseId: string) => void) => () => void
    onPermissionResolved: (callback: (sessionId: string, toolUseId: string) => void) => () => void
    onSessionReset: (callback: (sessionId: string) => void) => () => void
    onRateLimit: (callback: (sessionId: string, info: { rateLimitType: string; resetsAt: number; utilization: number | null; isUsingOverage: boolean }) => void) => () => void
    onWorktreeInfo: (callback: (sessionId: string, info: { branchName: string; worktreePath: string; sourceBranch: string; gitRoot?: string } | null) => void) => () => void
    onPromptSuggestion: (callback: (sessionId: string, suggestion: string) => void) => () => void
  }
  voice: {
    // model management
    listModels: () => Promise<VoiceModelInfo[]>
    isModelDownloaded: (size: WhisperModelSize) => Promise<boolean>
    downloadModel: (size: WhisperModelSize) => Promise<void>
    deleteModel: (size: WhisperModelSize) => Promise<void>
    cancelDownload: (size: WhisperModelSize) => Promise<void>
    // preferences (persisted to userData/voice-preferences.json)
    getPreferences: () => Promise<VoicePreferences>
    setPreferences: (prefs: Partial<VoicePreferences>) => Promise<VoicePreferences>
    // transcription (file-based, request/response — no streaming)
    transcribe: (
      audioBuffer: ArrayBuffer,
      sampleRate: number,
      options?: VoiceTranscribeOptions
    ) => Promise<VoiceTranscribeResult>
    // download progress event — returns an unsubscribe function
    onModelDownloadProgress: (
      callback: (progress: VoiceModelDownloadProgress) => void
    ) => () => void
    // expose the userData-relative path where models live (shared with T0004)
    getModelsDirectory: () => Promise<string>
  }
  fs: {
    readdir: (dirPath: string) => Promise<{ name: string; path: string; isDirectory: boolean }[]>
    readFile: (filePath: string) => Promise<{ content?: string; error?: string; size?: number }>
    stat: (filePath: string) => Promise<{ mtimeMs: number; size: number } | null>
    search: (dirPath: string, query: string) => Promise<{ name: string; path: string; isDirectory: boolean }[]>
    watch: (dirPath: string) => Promise<boolean>
    unwatch: (dirPath: string) => Promise<boolean>
    resetWatch: (dirPath: string) => Promise<boolean>
    onChanged: (callback: (dirPath: string) => void) => () => void
  }
  terminalServer: {
    /** Listen for recovery-available event from main process. Returns unsubscribe fn. */
    onRecoveryAvailable: (callback: (info: { ptyCount: number }) => void) => () => void
    /** User chose to recover live PTY session (TCP reconnect + buffer replay). */
    recover: () => void
    /** User chose fresh start (shutdown old server, fork new one). */
    freshStart: () => void
    /** T0111: Pull-model — query if there is a pending recovery prompt. */
    queryPendingRecovery: () => Promise<{ ptyCount: number } | null>
    /** T0112: Heartbeat watchdog status changes (recovering | recovered | failed). Returns unsubscribe fn. */
    onStatusChange: (callback: (status: string) => void) => () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
