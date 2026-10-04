export type RemoteFrameType = 'invoke' | 'invoke-result' | 'invoke-error' | 'event' | 'auth' | 'auth-result' | 'ping' | 'pong'

export type AuthServerPlatform = 'win32' | 'linux' | 'darwin'
export type AuthServerArch = 'x64' | 'arm64'
export type AuthServerEnv = 'native' | 'wsl' | 'docker' | 'ssh'

export interface AuthResultMetadata {
  serverPlatform: AuthServerPlatform
  serverArch: AuthServerArch
  serverEnv?: AuthServerEnv
  wslDistro?: string
  dockerMounts?: Array<{ host: string; container: string }>
  serverHome?: string
  nodeVersion: string
  claudeVersion?: string
  bundleVersion: string
  glibcVersion?: string
}

export type AuthResult = true | AuthResultMetadata

export interface RemoteFrame {
  type: RemoteFrameType
  id: string
  channel?: string
  args?: unknown[]
  result?: unknown
  error?: string
  token?: string
}

// Channels proxied to remote host. This set is also the only ipcMain.handle
// binding for registerHandler() channels (main.ts bindProxiedHandlersToIpc):
// a channel registered but missing here is unreachable from the renderer
// (BUG-095). Guarded by electron/remote/__tests__/proxied-channels-binding.test.ts.
export const PROXIED_CHANNELS = new Set([
  // PTY
  'pty:create', 'pty:write', 'pty:resize', 'pty:kill', 'pty:restart', 'pty:get-cwd',
  'pty:get-buffer', // T0403: replay buffer (result to the caller only)
  // Claude
  'claude:start-session', 'claude:send-message', 'claude:stop-session', 'claude:abort-session',
  'claude:set-permission-mode', 'claude:set-codex-sandbox-mode', 'claude:set-codex-approval-policy', 'claude:set-model', 'claude:set-effort', 'claude:reset-session',
  'claude:get-supported-models', 'claude:get-account-info', 'claude:get-supported-commands', 'claude:get-supported-agents', 'claude:get-session-meta',
  'claude:get-worktree-status', 'claude:cleanup-worktree',
  'claude:resolve-permission', 'claude:resolve-ask-user',
  'claude:list-sessions', 'claude:resume-session', 'claude:fork-session', 'claude:rewind-to-prompt', 'claude:stop-task', 'claude:rest-session',
  'claude:wake-session', 'claude:is-resting',
  'claude:archive-messages', 'claude:load-archived', 'claude:clear-archive', 'claude:fetch-subagent-messages',
  'claude:scan-skills', 'claude:scan-star-commands', 'claude:get-context-usage',
  'claude:get-statusline-extras',
  'claude:auth-status', 'claude:auth-login', 'claude:auth-logout', 'claude:account-list', 'claude:account-import-current', 'claude:account-switch',
  'claude:get-cli-path',
  'claude:detectRuntime',
  // Standalone worktree operations (for claude-cli preset)
  'worktree:create', 'worktree:remove', 'worktree:status', 'worktree:rehydrate',
  // Workspace
  'workspace:save', 'workspace:load',
  // Settings
  'settings:save', 'settings:load', 'settings:get-shell-path', 'settings:get-logging-info', 'settings:cleanup-logs',
  // GitHub
  'github:check-cli', 'github:pr-list', 'github:issue-list', 'github:pr-view', 'github:issue-view',
  'github:pr-comment', 'github:issue-comment',
  // Git
  'git:branch', 'git:log', 'git:diff', 'git:diff-files', 'git:status', 'git:get-github-url', 'git:getRoot',
  // Git scaffold (simple-git backed, T0155) — bridged alongside legacy git:* channels
  'git-scaffold:healthCheck', 'git-scaffold:getRepoInfo', 'git-scaffold:listCommits',
  // FS
  'fs:readdir', 'fs:readFile', 'fs:stat', 'fs:search', 'fs:watch', 'fs:unwatch', 'fs:reset-watch',
  'image:read-as-data-url',
  // T0406: client → server workspace roots for the headless fs sandbox (sent by main, not the renderer)
  'workspace:sync-roots',
  // Snippet
  'snippet:getAll', 'snippet:getById', 'snippet:create', 'snippet:update',
  'snippet:delete', 'snippet:toggleFavorite', 'snippet:search',
  'snippet:getCategories', 'snippet:getFavorites', 'snippet:getByWorkspace',
  // Profile
  'profile:list', 'profile:load', 'profile:load-snapshot', 'profile:get-active-ids', 'profile:activate', 'profile:deactivate',
  // Terminal (T0133: Worker→Tower auto-notify; Control Tower auto-session)
  'terminal:create-with-command', 'terminal:create-agent-command', 'terminal:notify', 'terminal:keypress',
  // Remote AI toolchain probe (T0411, PLAN-037 B; electron/handlers/remote-tools.ts)
  'remote-tools:detect',
])

/**
 * T0406: the server's fs sandbox roots. Sent by Electron main's RemoteClient after
 * every auth and after `workspace:save` / `workspace:load` of a bound window
 * (electron/handlers/fs.ts answers it).
 */
export const WORKSPACE_SYNC_ROOTS_CHANNEL = 'workspace:sync-roots'

// Events pushed from host to remote clients. T0406: each one is classified as
// path-translated or not in path-aware-channels.ts (PATH_EVENT_CHANNELS /
// PATH_FREE_EVENTS), guarded by path-aware-channels-coverage.test.ts.
export const PROXIED_EVENTS = new Set([
  'pty:output', 'pty:exit',
  'claude:message', 'claude:tool-use', 'claude:tool-result',
  'claude:stream', 'claude:result', 'claude:error',
  'claude:status', 'claude:permission-request', 'claude:permission-resolved', 'claude:ask-user', 'claude:ask-user-resolved',
  'claude:modeChange', 'claude:history', 'claude:prompt-suggestion', 'claude:session-reset', 'claude:worktree-info', 'claude:rate-limit',
  // T0401: codex turn end + claude runtime routing toasts (T0386 §1 event gaps)
  'claude:turn-end', 'claude:runtime-degraded', 'claude:runtime-warning',
  'fs:changed',
  'workspace:detached', 'workspace:reattached', 'workspace:reload',
  'system:resume',
  // T0133: Worker→Tower auto-notify event
  'terminal:notified',
])
