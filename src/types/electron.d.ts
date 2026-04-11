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
    createWithCommand: (opts: { id: string; cwd: string; command: string; shell?: string; customEnv?: Record<string, string> }) => Promise<boolean>
    onOutput: (callback: (id: string, data: string) => void) => () => void
    onExit: (callback: (id: string, exitCode: number) => void) => () => void
  }
  workspace: {
    save: (data: string) => Promise<boolean>
    load: () => Promise<string | null>
    moveToWindow: (sourceWindowId: string, targetWindowId: string, workspaceId: string, insertIndex: number) => Promise<boolean>
    onReload: (callback: () => void) => () => void
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
    getConnection: () => Promise<{ url: string; token: string; mode: string; addresses: { ip: string; mode: string; label: string }[] } | { error: string }>
  }
  debug: {
    log: (...args: unknown[]) => void
    writeRenderer: (level: 'error' | 'warn' | 'info' | 'log' | 'debug', args: unknown[]) => void
    isDebugMode: boolean
  }
  shell: {
    openExternal: (url: string) => Promise<void>
    openPath: (folderPath: string) => Promise<void>
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
