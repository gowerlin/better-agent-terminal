import type { CreatePtyOptions } from './index'
import type {
  WhisperModelSize,
  VoiceGpuStatus,
  VoiceModelInfo,
  VoicePreferences,
  VoiceTranscribeOptions,
  VoiceTranscribeResult,
  VoiceModelDownloadProgress,
} from './voice'

// Shared profile record shape (mirrors preload.ts + profile-manager.ts surface).
// PLAN-007 T0268: targetOS schema (kept in sync with electron/profile-manager.ts)
type ProfileTargetOS = 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'

interface ProfileRecord {
  id: string
  name: string
  type: 'local' | 'remote'
  remoteHost?: string
  remotePort?: number
  remoteToken?: string
  remoteProfileId?: string
  remoteFingerprint?: string
  createdAt: number
  updatedAt: number
  // PLAN-007 T0268: targetOS + per-OS metadata (all optional, legacy profiles unaffected)
  targetOS?: ProfileTargetOS
  wslDistro?: string
  dockerContainer?: string
  dockerHost?: string
  dockerMounts?: Array<{ host: string; container: string }>
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  useSshTunnel?: boolean
  tunnelLocalPort?: number
}

type RemoteBindInterface = 'localhost' | 'tailscale' | 'all'
type WslState = 'Running' | 'Stopped'

interface WslDistroRecord {
  name: string
  version: 1 | 2
  state: WslState
}

interface RemoteAuthMetadata {
  serverPlatform: 'win32' | 'linux' | 'darwin'
  serverArch: 'x64' | 'arm64'
  serverEnv?: 'native' | 'wsl' | 'docker' | 'ssh'
  wslDistro?: string
  dockerMounts?: Array<{ host: string; container: string }>
  serverHome?: string
  nodeVersion: string
  claudeVersion?: string
  bundleVersion: string
  glibcVersion?: string
}

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
    detach: (workspaceId: string) => Promise<unknown>
    reattach: (workspaceId: string) => Promise<unknown>
    getDetachedId: () => string | null
    onDetached: (callback: (workspaceId: string) => void) => () => void
    onReattached: (callback: (workspaceId: string) => void) => () => void
    moveToWindow: (sourceWindowId: string, targetWindowId: string, workspaceId: string, insertIndex: number) => Promise<boolean>
    onReload: (callback: (data?: string) => void) => () => void
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
    selectImages: () => Promise<string[]>
    selectFiles: () => Promise<string[]>
    confirm: (message: string, title?: string) => Promise<boolean>
  }
  image: {
    readAsDataUrl: (filePath: string) => Promise<string>
  }
  clipboard: {
    saveImage: () => Promise<string | null>
    writeImage: (filePath: string) => Promise<boolean>
  }
  app: {
    openNewInstance: (profileId: string) => Promise<{ alreadyOpen: boolean; windowId?: string; windowIds?: string[] }>
    getLaunchProfile: () => Promise<string | null>
    getWindowId: () => Promise<string | null>
    getWindowProfile: () => Promise<string | null>
    getUserDataPath: () => Promise<string>
    getWindowIndex: () => Promise<number>
    newWindow: () => Promise<string>
    setDockBadge: (count: number) => Promise<void>
  }
  update: {
    check: () => Promise<unknown>
    getVersion: () => Promise<string>
  }
  tunnel: {
    getConnection: () => Promise<{ url: string; token: string; fingerprint: string; mode: string; addresses: { ip: string; mode: string; label: string }[] } | { error: string }>
  }
  system: {
    onResume: (callback: () => void) => () => void
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
    getDiffFiles: (cwd: string, commitHash?: string) => Promise<{ status: string; file: string }[]>
    getStatus: (cwd: string) => Promise<{ status: string; file: string }[]>
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
    startSession: (sessionId: string, options: { cwd: string; prompt?: string; permissionMode?: string; model?: string; effort?: string; apiVersion?: 'v1' | 'v2'; useWorktree?: boolean; worktreePath?: string; worktreeBranch?: string; agentPreset?: string; codexSandboxMode?: string; codexApprovalPolicy?: string }) => Promise<void>
    sendMessage: (sessionId: string, prompt: string, images?: string[]) => Promise<void>
    stopSession: (sessionId: string) => Promise<void>
    abortSession: (sessionId: string) => Promise<void>
    onMessage: (callback: (sessionId: string, message: unknown) => void) => () => void
    onToolUse: (callback: (sessionId: string, toolCall: unknown) => void) => () => void
    onToolResult: (callback: (sessionId: string, result: unknown) => void) => () => void
    onResult: (callback: (sessionId: string, result: unknown) => void) => () => void
    onTurnEnd: (callback: (sessionId: string, payload: { reason: 'completed' | 'error' | 'aborted'; error?: string }) => void) => () => void
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
    // PLAN-027 #1 (T0230): probe embedded + system claude binaries for the runtime selector UI.
    detectRuntime: (customPath?: string) => Promise<{
      embedded: {
        path: string
        version: string
        versionRaw: string
        healthStatus: 'healthy' | 'version-warning' | 'version-too-old' | 'spawn-failed'
      }
      system: {
        path: string
        version: string
        versionRaw: string
        healthStatus: 'healthy' | 'version-warning' | 'version-too-old' | 'spawn-failed'
        source: 'path' | 'common-location' | 'custom'
      } | null
    }>
    authStatus: () => Promise<{ loggedIn: boolean; email?: string; subscriptionType?: string; authMethod?: string } | null>
    authLogout: () => Promise<{ success: boolean; error?: string }>
    resolvePermission: (sessionId: string, toolUseId: string, result: { behavior: string; updatedInput?: Record<string, unknown>; updatedPermissions?: unknown[]; message?: string; dontAskAgain?: boolean }) => Promise<void>
    resolveAskUser: (sessionId: string, toolUseId: string, answers: Record<string, string>) => Promise<void>
    listSessions: (cwd: string) => Promise<unknown>
    resumeSession: (sessionId: string, sdkSessionId: string, cwd: string, model?: string, apiVersion?: 'v1' | 'v2', useWorktree?: boolean, worktreePath?: string, worktreeBranch?: string, agentPreset?: string, codexSandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access', codexApprovalPolicy?: 'untrusted' | 'on-request' | 'never', permissionMode?: string, effort?: string) => Promise<void>
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
    onRuntimeDegraded: (callback: (event: {
      sessionId: string
      reason: 'system-not-found' | 'system-unhealthy' | 'system-too-old' | 'detect-threw'
      detail?: string
    }) => void) => () => void
    onRuntimeWarning: (callback: (event: {
      sessionId: string
      version: string
      message: string
    }) => void) => () => void
  }
  worktree: {
    create: (sessionId: string, cwd: string) => Promise<{ success: boolean; worktreePath?: string; branchName?: string; gitRoot?: string; sourceBranch?: string; error?: string }>
    remove: (sessionId: string, deleteBranch: boolean) => Promise<{ success: boolean; error?: string }>
    status: (sessionId: string) => Promise<{ diff: string; branchName: string; worktreePath: string; sourceBranch: string } | null>
    merge: (sessionId: string, strategy: 'merge' | 'cherry-pick') => Promise<{ success: boolean; error?: string }>
    rehydrate: (sessionId: string, cwd: string, worktreePath: string, branchName: string) => Promise<{ success: boolean }>
  }
  profile: {
    list: () => Promise<{ profiles: ProfileRecord[]; activeProfileIds: string[] }>
    listLocal: () => Promise<{ profiles: ProfileRecord[]; activeProfileIds: string[] }>
    create: (name: string, options?: { type?: 'local' | 'remote'; remoteHost?: string; remotePort?: number; remoteToken?: string; remoteProfileId?: string; remoteFingerprint?: string }) => Promise<{ id: string; name: string; type: 'local' | 'remote'; createdAt: number; updatedAt: number }>
    save: (profileId: string) => Promise<boolean>
    load: (profileId: string) => Promise<unknown>
    delete: (profileId: string) => Promise<boolean>
    rename: (profileId: string, newName: string) => Promise<boolean>
    update: (profileId: string, updates: { remoteHost?: string; remotePort?: number; remoteToken?: string; remoteProfileId?: string; remoteFingerprint?: string; targetOS?: ProfileTargetOS; wslDistro?: string; dockerContainer?: string; dockerHost?: string; dockerMounts?: Array<{ host: string; container: string }>; sshHost?: string; sshUser?: string; sshPort?: number; sshKeyPath?: string; useSshTunnel?: boolean; tunnelLocalPort?: number; serverHome?: string }) => Promise<boolean>
    duplicate: (profileId: string, newName: string) => Promise<{ id: string; name: string; createdAt: number; updatedAt: number } | null>
    get: (profileId: string) => Promise<ProfileRecord | null>
    getActiveIds: () => Promise<string[]>
    activate: (profileId: string) => Promise<void>
    deactivate: (profileId: string) => Promise<void>
  }
  wsl: {
    list: () => Promise<{ distros: WslDistroRecord[]; default: string | null }>
    systemdEnabled: (distro: string) => Promise<boolean>
    detectNetworkMode: (distro: string) => Promise<'mirrored' | 'nat' | 'unknown'>
    installBundle: (distro: string, tarballPath: string, installPath: string) => Promise<{ ok: true } | { ok: false; error: string }>
    uninstallBundle: (distro: string, installPath: string) => Promise<{ ok: true } | { ok: false; error: string }>
  }
  docker: {
    status: () => Promise<{ available: boolean; version?: string; error?: string }>
    listContainers: () => Promise<Array<{ id: string; name: string; image: string; state: string; status: string }>>
    inspectContainer: (name: string) => Promise<{
      id: string
      name: string
      image: string
      state: { status: string; running: boolean; health: string }
      mounts: Array<{ source: string; destination: string }>
      ports: string[]
      env: string[]
    }>
    validateMounts: (mounts: Array<{ host: string; container: string }>) => Promise<{ ok: boolean; errors: string[] }>
    startContainer: (name: string, options?: { createIfMissing?: boolean; image?: string; mounts?: Array<{ host: string; container: string }>; port?: number; restartPolicy?: string; token?: string; dataVolume?: string }) => Promise<{ ok: boolean; token?: string; error?: string }>
    stopContainer: (name: string, options?: { remove?: boolean }) => Promise<{ ok: boolean; error?: string }>
    removeContainer: (name: string) => Promise<{ ok: boolean; error?: string }>
    restartContainer: (name: string) => Promise<{ ok: boolean; error?: string }>
    getContainerLogs: (name: string, options?: { tail?: number; follow?: boolean }) => Promise<{ ok: boolean; logs?: string; error?: string }>
    getContainerHealth: (name: string) => Promise<{ ok: boolean; health?: 'healthy' | 'unhealthy' | 'starting' | 'none'; error?: string }>
  }
  wslSystemd: {
    writeUnit: (distro: string, unit: { path?: string; content?: string; execStart?: string; description?: string; environment?: Record<string, string> }) => Promise<{ ok: true }>
    enableLinger: (distro: string) => Promise<{ ok: boolean; error?: string }>
    startService: (distro: string, serviceName: string, options?: { dataDir?: string; timeoutMs?: number }) => Promise<{ ok: true; token: string | null } | { ok: false; error: string; token?: string | null }>
    removeUnit: (distro: string, serviceName: string, options?: { path?: string }) => Promise<{ ok: true }>
  }
  ssh: {
    listHosts: () => Promise<string[]>
    probeAuth: (opts: { sshHost: string; sshUser: string; sshPort?: number; sshKeyPath?: string }) => Promise<{
      ok: boolean
      serverPlatform?: 'linux' | 'darwin'
      serverArch?: string
      serverHome?: string
      sshExecPath?: string
      error?: string
      errorCode?: 'no-ssh' | 'permission-denied' | 'host-key' | 'connect-timeout' | 'unknown'
    }>
    uploadBundle: (request: {
      uploadId: string
      options: {
        sshHost: string
        sshUser: string
        sshPort?: number
        sshKeyPath?: string
        installPath: string
        tarballPath: string
      }
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    onUploadProgress: (callback: (payload: { uploadId: string; bytesSent: number; totalBytes: number }) => void) => () => void
    // PLAN-007 T0286 — start-server (systemd unit / launchd plist + enable + verify)
    startServer: (request: {
      startId: string
      options: {
        sshHost: string
        sshUser: string
        sshPort?: number
        sshKeyPath?: string
        targetOS: 'ssh-linux' | 'ssh-darwin'
        installPath: string
        serverPort?: number
        serverHome: string
      }
    }) => Promise<{
      ok: boolean
      method: 'systemd' | 'launchd' | 'failed'
      servicePath: string
      checkOutput?: string
      error?: string
      errorCode?: 'unit-write-failed' | 'enable-failed' | 'start-failed' | 'verify-failed' | 'unknown'
    }>
    onStartProgress: (callback: (payload: { startId: string; phase: 'writing-unit' | 'enabling' | 'starting' | 'verifying' }) => void) => () => void
  }
  remote: {
    startServer: (port?: number, token?: string, bindInterface?: RemoteBindInterface) => Promise<{ port: number; token: string; fingerprint: string; bindInterface: RemoteBindInterface; host: string } | { error: string }>
    stopServer: () => Promise<boolean>
    serverStatus: () => Promise<{ running: boolean; port: number | null; bindInterface: RemoteBindInterface; host: string; fingerprint: string; clients: { label: string; connectedAt: number }[] }>
    connect: (host: string, port: number, token: string, label?: string, fingerprint?: string) => Promise<{ connected: boolean; fingerprint?: string } | { error: string; errorCode?: string; fingerprint?: string }>
    disconnect: () => Promise<boolean>
    clientStatus: () => Promise<{ connected: boolean; info: { host: string; port: number; fingerprint: string } | null }>
    testConnection: (host: string, port: number, token: string, fingerprint?: string) => Promise<{ ok: boolean; fingerprint?: string; errorCode?: string; error?: string; metadata?: RemoteAuthMetadata | null }>
    listProfiles: (host: string, port: number, token: string, fingerprint?: string) => Promise<{ profiles: { id: string; name: string; type: string }[]; activeProfileIds: string[]; fingerprint?: string } | { error: string; errorCode?: string; fingerprint?: string }>
    restartServer: (newPort: number) => Promise<
      | { port: number; token: string; fingerprint: string; bindInterface: RemoteBindInterface; host: string; restartError?: string }
      | { error: string }
    >
  }
  snippet: {
    getAll: () => Promise<unknown>
    getById: (id: number) => Promise<unknown>
    create: (input: { title: string; content: string; format?: string; category?: string; tags?: string; isFavorite?: boolean; workspaceId?: string }) => Promise<unknown>
    update: (id: number, updates: { title?: string; content?: string; format?: string; category?: string; tags?: string; isFavorite?: boolean; workspaceId?: string }) => Promise<unknown>
    delete: (id: number) => Promise<unknown>
    toggleFavorite: (id: number) => Promise<unknown>
    search: (query: string) => Promise<unknown>
    getCategories: () => Promise<unknown>
    getFavorites: () => Promise<unknown>
    getByWorkspace: (workspaceId?: string) => Promise<unknown>
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
    /**
     * T0239 — lightweight GPU capability hint for Settings UI.
     * Returns detected platform, whether Vulkan loader is available, the
     * expected backend, and a human-readable hint string. The hint factors
     * in the current user preference (auto vs force-cpu).
     */
    getGpuStatus: () => Promise<VoiceGpuStatus>
  }
  fs: {
    readdir: (dirPath: string) => Promise<import('./file').FileEntry[]>
    readFile: (filePath: string) => Promise<{ content?: string; error?: string; size?: number }>
    stat: (filePath: string) => Promise<{ mtimeMs: number; size: number } | null>
    search: (dirPath: string, query: string) => Promise<import('./file').FileEntry[]>
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
